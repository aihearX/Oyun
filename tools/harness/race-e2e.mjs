#!/usr/bin/env node
// ODİ canlı yarış uçtan uca testi: gerçek sunucu (ODI_DB=:memory:) + web derlemesi (vite build + vite preview) + 3 tarayıcı bağlamı.
// Akış: Ayşe oda kurar → Bora'yı davet eder (arkadaş) → Cem oda koduyla katılır → lobide sohbet → hepsi "Hazırım" →
// geri sayım → üçü de aynı bölüme girer, harness botu oynar (?yaris-bot=1, yalnızca yarış test sayfasında) →
// her istemcide diğer iki oyuncunun hayaleti + üst şerit → bitiş sırası üç istemcide aynı.
// Kullanım: node tools/harness/race-e2e.mjs [--no-build] [--timeout 240] [--headed]
// Çıktı: tools/harness/out/yaris/*.png (360×740) ve e2e.json
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1'] : []).filter(Boolean));
const root = resolve(new URL('../..', import.meta.url).pathname);
const webRoot = resolve(root, 'apps/web');
const outDir = resolve(root, 'tools/harness/out/yaris'); mkdirSync(outDir, { recursive: true });
const distDir = resolve(outDir, 'dist');
const timeoutSec = Number(args.timeout ?? 240);
const log = (...a) => console.log(`[yarış-e2e ${new Date().toISOString().slice(11, 19)}]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd, a, opts = {}) => new Promise((res, rej) => { const p = spawn(cmd, a, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...opts }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${a.join(' ')} → ${c}`)))); });

const cleanup = [];
const ps = [];
const fail = async (msg) => {
  console.error(`\n✗ ${msg} (${new Date().toISOString().slice(11, 19)})`);
  // tanı: her istemcinin ekranı ve son durumu
  for (const p of ps) {
    try {
      await p.page.screenshot({ path: resolve(outDir, `hata-${p.name}.png`) });
      console.error(`  ${p.name}:`, JSON.stringify(await p.page.evaluate(() => ({ route: window.__yaris?.route, events: (window.__odi?.events ?? []).filter((e) => e.type !== 'haptic' && e.type !== 'progress').map((e) => e.type), last: (window.__odi?.events ?? []).filter((e) => e.type === 'progress').pop(), race: window.__odi?.race?.status }))), p.errors.slice(0, 5));
    } catch { /* yok */ }
  }
  for (const f of cleanup.reverse()) { try { await f(); } catch { /* yok */ } } process.exit(1); };

// ---------------------------------------------------------------- 1) sunucu (arka planda, bellek içi veritabanı)
const { createServer } = await import('node:net');
const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });
await run('npm', ['run', 'build', '-w', '@odi/server']);
const srvPort = await freePort();

const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', resolve(root, 'apps/server/dist/server.mjs')], {
  cwd: root, env: { ...process.env, PORT: String(srvPort), HOST: '127.0.0.1', ODI_DB: ':memory:', ODI_LOG: '0', ODI_FREE_TEXT_AT: '0' /* yeni hesaplar serbest yazar (güvenli sohbet kuralı comm-e2e'de sınanır) */ }, stdio: ['ignore', 'pipe', 'pipe'],
});
srv.stderr.on('data', (d) => { const t = String(d); if (!/ExperimentalWarning|trace-warnings/.test(t)) process.stderr.write(`[sunucu] ${t}`); });
cleanup.push(async () => srv.kill('SIGTERM'));
process.on('exit', () => { try { srv.kill('SIGTERM'); } catch { /* yok */ } });
process.on('unhandledRejection', (e) => { void fail(`beklenmeyen hata: ${String(e?.message ?? e).split('\n')[0]}`); });
for (let i = 0; ; i++) {
  try { const r = await fetch(`http://127.0.0.1:${srvPort}/saglik`); if (r.ok) break; } catch { /* henüz değil */ }
  if (i > 50) await fail('sunucu başlamadı');
  await sleep(200);
}
log(`sunucu hazır: ws://127.0.0.1:${srvPort} (ODI_DB=:memory:)`);

// ---------------------------------------------------------------- 2) web: vite build (+ yarış test sayfası) ve vite preview
const vite = await import('vite');
const testPage = 'src/race/dev/yaris.html';
if (!args['no-build'] || !existsSync(resolve(distDir, testPage))) {
  await vite.build({
    root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn',
    build: { outDir: distDir, emptyOutDir: true, rollupOptions: { input: { main: resolve(webRoot, 'index.html'), yaris: resolve(webRoot, testPage) } } },
  });
}
const webPort = await freePort();
const pv = await vite.preview({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: distDir }, preview: { port: webPort, strictPort: true, host: '127.0.0.1' } });
cleanup.push(async () => { await pv.close(); });
const base = `http://127.0.0.1:${webPort}`;
log(`önizleme: ${base}/${testPage}`);

// ---------------------------------------------------------------- 3) üç oyuncu
// Chromium: PLAYWRIGHT_CHROMIUM > Playwright'ın beklediği sürüm > PLAYWRIGHT_BROWSERS_PATH altında kurulu herhangi bir chromium
function chromiumExe() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  try { const p = chromium.executablePath(); if (existsSync(p)) return p; } catch { /* yok */ }
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (dir && existsSync(dir)) for (const d of readdirSync(dir).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse()) for (const sub of ['chrome-linux/chrome', 'chrome-linux64/chrome']) { const p = resolve(dir, d, sub); if (existsSync(p)) return p; }
  return undefined;
}
const browser = await chromium.launch({ headless: !args.headed, executablePath: chromiumExe(), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required',
  // üç pencere aynı anda oynar: arka plandaki/örtülü pencerelerin requestAnimationFrame'i kısılmasın
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
cleanup.push(async () => browser.close());
// bot gecikmeleri: botlar aynı bölümü aynı biçimde oynar; kısa gecikmeyle bitiş sırası ayrışır ve hayaletler aynı ekrana sığar
const PLAYERS = [{ name: 'Ayşe', delay: 0 }, { name: 'Bora', delay: 350 }, { name: 'Cem', delay: 700 }];
const shot = (p, file) => p.page.screenshot({ path: resolve(outDir, file) });
for (const pl of PLAYERS) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: Number(process.env.E2E_DSF ?? 1), isMobile: true, hasTouch: true, locale: 'tr-TR' });
  // ilk açılış rehberini (hikâye + anlatıcı turları + kilitler) atla: bu test başka bir akışı sınar (bkz. onboarding-e2e.mjs)
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('odi-v1')) localStorage.setItem('odi-v1', JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true } }, version: 3 })); } catch { /* depolama yok */ } });
  const page = await ctx.newPage();
  const p = { ...pl, ctx, page, errors: [] };
  page.on('pageerror', (e) => p.errors.push(String(e.message ?? e)));
  page.on('response', (r) => { if (r.status() >= 400) p.errors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/favicon|AudioContext|WebGL|GPU|Autoplay|manifest|Failed to load resource/i.test(t)) p.errors.push(t); });
  const url = `${base}/${testPage}?ad=${encodeURIComponent(pl.name)}&yaris-bot=1&bot-gecikme=${pl.delay}&sunucu=${encodeURIComponent(`ws://127.0.0.1:${srvPort}`)}`;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction((n) => window.__yaris?.net()?.me?.name === n, pl.name, { timeout: 20_000 }).catch(() => fail(`${pl.name} bağlanamadı`));
  ps.push(p);
}
const [A, B, C] = ps;
const tid = (p, id) => p.page.getByTestId(id);
log('üç oyuncu bağlandı');

// Bora, Ayşe'yi arkadaş ekler (davet yalnızca arkadaşa); arkadaş ekranı sosyal ekibin, burada doğrudan istemciyle
const code = await A.page.evaluate(() => window.__yaris.net().me.friendCode);
await B.page.evaluate((c) => window.__yaris.net().call('friends.add', { code: c }), code);
// arkadaşlık istekle kurulur: Ayşe de Bora'yı ekleyince (karşılıklı) arkadaş olurlar
const codeB = await B.page.evaluate(() => window.__yaris.net().me.friendCode);
await A.page.evaluate((c) => window.__yaris.net().call('friends.add', { code: c }), codeB);

// Ayşe oda kurar (yeni oyuncu: yalnızca 1. bölüm açık)
await tid(A, 'yaris-oda-kur').click();
await tid(A, 'yaris-seviye-1').click();
await tid(A, 'yaris-kod').waitFor();
const roomId = await tid(A, 'yaris-kod').getAttribute('data-code');
await tid(A, 'yaris-bekleme').waitFor();
await sleep(1200);
await shot(A, '01-ayse-oda-bekleme.png');
log(`oda kuruldu: ${roomId}`);

// Ayşe → Bora davet; Bora davet kartından katılır
await tid(A, 'yaris-bekleme-davet').click();
await tid(A, 'yaris-davet-Bora').click();
await tid(B, 'yaris-davet-karti').waitFor({ timeout: 10_000 });
await sleep(500);
await shot(B, '02-bora-davet.png');
await tid(B, 'yaris-davet-kabul').click();
await B.page.locator('[data-testid="yaris-oyuncu"][data-name="Bora"]').waitFor();

// Cem oda koduyla katılır
await tid(C, 'yaris-kod-gir').click();
await tid(C, 'yaris-kod-input').fill(roomId);
await tid(C, 'yaris-kod-katil').click();
await C.page.locator('[data-testid="yaris-oyuncu"][data-name="Cem"]').waitFor();
for (const p of ps) await p.page.waitForFunction(() => document.querySelectorAll('[data-testid="yaris-oyuncu"]').length === 3, null, { timeout: 10_000 });
log('üç oyuncu lobide');

// lobide sohbet (yalnızca odadakiler)
await tid(A, 'yaris-sohbet-input').fill('Selam! Hazır mısınız?');
await tid(A, 'yaris-sohbet-gonder').click();
await C.page.getByText('Selam! Hazır mısınız?').waitFor({ timeout: 5000 });
await sleep(1300);
await tid(C, 'yaris-sohbet-input').fill('Hazırım, görüşürüz kapıda 🏁');
await tid(C, 'yaris-sohbet-gonder').click();
await A.page.getByText('Hazırım, görüşürüz kapıda').waitFor({ timeout: 5000 });
await tid(B, 'yaris-hazir').click();
await sleep(600);
await shot(A, '03-ayse-lobi-sohbet.png');

// hepsi hazır → geri sayım → bölüm
await tid(C, 'yaris-hazir').click();
await tid(A, 'yaris-hazir').click();
for (const p of ps) await p.page.waitForFunction(() => window.__odi?.events?.some((e) => e.type === 'ready'), null, { timeout: 20_000 }).catch(() => fail(`${p.name} bölüme girmedi`));
log('geri sayım: üçü de bölümde');
await sleep(700);
await shot(B, '04-bora-geri-sayim.png');
for (const p of ps) await p.page.waitForFunction(() => window.__odi?.events?.some((e) => e.type === 'started'), null, { timeout: 20_000 }).catch(() => fail(`${p.name} başlamadı`));
log('başladı');

// yarış ortası: her istemcide diğer iki oyuncunun hayaleti (konum alındı) + üst şerit
await sleep(4500);
const ghostInfo = [];
for (const p of ps) {
  const g = await p.page.waitForFunction(() => {
    const r = globalThis.__odiScene?.race; if (!r) return null;
    const list = [...r.ghosts.values()].map((x) => ({ name: x.info.name, seen: x.seen, x: Math.round(x.x), pct: x.pct, visible: x.body.visible && x.body.alpha > 0.3 }));
    return list.length === 2 && list.every((x) => x.seen) ? { ghosts: list, rank: r.rankText.text, me: Math.round(globalThis.__odiScene.hero.x), fps: Math.round(globalThis.__odiScene.game.loop.actualFps) } : null;
  }, null, { timeout: 15_000 }).then((h) => h.jsonValue()).catch(() => null);
  if (!g) await fail(`${p.name}: iki rakip hayaleti görünmedi`);
  ghostInfo.push({ player: p.name, ...g });
}
await Promise.all(ps.map((p) => shot(p, `05-${p.name === 'Ayşe' ? 'ayse' : p.name.toLowerCase()}-yarista.png`)));
log('hayaletler:', JSON.stringify(ghostInfo));
await sleep(5000);
await Promise.all(ps.map((p) => shot(p, `06-${p.name === 'Ayşe' ? 'ayse' : p.name.toLowerCase()}-yarista-2.png`)));

// bitiş: sonuç ekranı (sunucu 'bitti' deyince)
for (const p of ps) {
  await p.page.locator('[data-testid="yaris-sonuc"][data-status="bitti"]').waitFor({ timeout: timeoutSec * 1000 }).catch(() => fail(`${p.name}: yarış sonucu gelmedi`));
}
await sleep(800);
const orders = [];
for (const p of ps) {
  orders.push(await p.page.$$eval('[data-testid="yaris-sonuc-sira"]', (els) => els.map((e) => `${e.getAttribute('data-place') || '-'}:${e.getAttribute('data-name')}`)));
  await shot(p, `07-${p.name === 'Ayşe' ? 'ayse' : p.name.toLowerCase()}-sonuc.png`);
}
const results = await Promise.all(ps.map((p) => p.page.evaluate(() => window.__odi?.result && { completed: window.__odi.result.completed, timeSec: window.__odi.result.timeSec, score: window.__odi.result.score })));
const same = orders.every((o) => JSON.stringify(o) === JSON.stringify(orders[0]));
const errors = ps.map((p) => ({ player: p.name, errors: [...new Set(p.errors)] }));
const summary = { roomId, orders, same, results, ghostInfo, errors };
writeFileSync(resolve(outDir, 'e2e.json'), JSON.stringify(summary, null, 2));
log('sonuç sırası:', JSON.stringify(orders));
log('koşular:', JSON.stringify(results));
for (const f of cleanup.reverse()) { try { await f(); } catch { /* yok */ } }
const errCount = errors.reduce((a, e) => a + e.errors.length, 0);
if (!same) { console.error('✗ bitiş sırası istemciler arasında farklı'); process.exit(1); }
if (errCount) { console.error('✗ sayfa hataları:', JSON.stringify(errors)); process.exit(2); }
console.log(`\n✓ canlı yarış uçtan uca: 3 oyuncu, aynı sıra (${orders[0].join(', ')}), ekran görüntüleri: ${outDir}`);
process.exit(0);
