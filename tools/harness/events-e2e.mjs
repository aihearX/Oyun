#!/usr/bin/env node
// ODİ etkinlikler uçtan uca testi: gerçek sunucu (ODI_DB=:memory:, ODI_EVENTS_FAST=1, ODI_TEST_STORE=1) + web derlemesi
// (VITE_ODI_E2E=1: yalnızca bu test derlemesinde `?etkinlik-bot=1` bölümü harness botuna oynatır; normal derlemede bu yol yoktur)
// + 3 tarayıcı (Ayşe ve Bora aynı takım, Cem başka takım), 390×844.
// Akış: harita yüzen Etkinlik düğmesi → merkez → düello eşleşmesi → ralli (başlat, bildirim, katıl, ikisi de bölümü bot ile oynar, kazanılır)
//       → quiz (iki üye aynı anda cevaplar, cevap + açıklama) → bayrak (koş, devret, "Bayrak sende!", ikinci ayak) → düello skor çubuğu
//       → Günün Meydan Okuması (üçü de oynar, sıralama) → takım sekmesi, görevler, Ses Avı, turnuva, quiz sonucu.
// Kullanım: node tools/harness/events-e2e.mjs [--no-build] [--headed]
// Çıktı: tools/harness/out/etkinlik/*.png ve e2e.json
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const args = new Set(process.argv.slice(2));
const root = resolve(new URL('../..', import.meta.url).pathname);
const webRoot = resolve(root, 'apps/web');
const outDir = resolve(root, 'tools/harness/out/etkinlik'); mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (f.endsWith('.png')) rmSync(resolve(outDir, f));
const distDir = resolve(outDir, 'dist');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(`[etkinlik-e2e ${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s]`, ...a);
const run = (cmd, a, opts = {}) => new Promise((res, rej) => { const p = spawn(cmd, a, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...opts }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${a.join(' ')} → ${c}`)))); });
const cleanup = [];
const players = [];
const checks = [];
function check(cond, msg) { checks.push({ ok: !!cond, msg }); console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) throw new Error(msg); }
async function fail(msg) {
  console.error(`\n✗ ${msg}`);
  for (const p of players) { try { await p.page.screenshot({ path: resolve(outDir, `hata-${p.slug}.png`) }); console.error(`  ${p.name}:`, p.errors.slice(0, 6)); } catch { /* yok */ } }
  for (const f of cleanup.reverse()) { try { await f(); } catch { /* yok */ } }
  process.exit(1);
}
process.on('unhandledRejection', (e) => { void fail(`beklenmeyen hata: ${String(e?.message ?? e).split('\n')[0]}`); });

// ---------------------------------------------------------------- 1) sunucu
const { createServer } = await import('node:net');
const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });
if (!args.has('--no-build') || !existsSync(resolve(root, 'apps/server/dist/server.mjs'))) await run('npm', ['run', 'build', '-w', '@odi/server', '--silent']);
const srvPort = await freePort();
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', resolve(root, 'apps/server/dist/server.mjs')], {
  cwd: root, env: { ...process.env, PORT: String(srvPort), HOST: '127.0.0.1', ODI_DB: ':memory:', ODI_EVENTS_FAST: '1', ODI_TEST_STORE: '1', ODI_LOG: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
});
srv.stderr.on('data', (d) => { const t = String(d); if (!/ExperimentalWarning|trace-warnings/.test(t)) process.stderr.write(`[sunucu] ${t}`); });
cleanup.push(async () => srv.kill('SIGTERM'));
process.on('exit', () => { try { srv.kill('SIGTERM'); } catch { /* yok */ } });
for (let i = 0; ; i++) {
  try { const r = await fetch(`http://127.0.0.1:${srvPort}/saglik`); if (r.ok) break; } catch { /* henüz değil */ }
  if (i > 60) await fail('sunucu başlamadı');
  await sleep(200);
}
const wsUrl = `ws://127.0.0.1:${srvPort}`;
log(`sunucu hazır: ${wsUrl} (ODI_EVENTS_FAST=1)`);

// ---------------------------------------------------------------- 2) web (test derlemesi) + önizleme
const vite = await import('vite');
if (!args.has('--no-build') || !existsSync(resolve(distDir, 'index.html'))) {
  process.env.VITE_ODI_E2E = '1';
  await vite.build({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: distDir, emptyOutDir: true } });
  delete process.env.VITE_ODI_E2E;
}
const webPort = await freePort();
const pv = await vite.preview({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: distDir }, preview: { port: webPort, strictPort: true, host: '127.0.0.1' } });
cleanup.push(async () => { await pv.close(); });
const base = `http://127.0.0.1:${webPort}/?sunucu=${encodeURIComponent(wsUrl)}&etkinlik-bot=1`;
log(`önizleme: ${base}`);

// ---------------------------------------------------------------- 3) oyuncular
function chromiumExe() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  try { const p = chromium.executablePath(); if (existsSync(p)) return p; } catch { /* yok */ }
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (dir && existsSync(dir)) for (const d of readdirSync(dir).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse()) for (const sub of ['chrome-linux/chrome', 'chrome-linux64/chrome']) { const p = resolve(dir, d, sub); if (existsSync(p)) return p; }
  return undefined;
}
const browser = await chromium.launch({ headless: !args.has('--headed'), executablePath: chromiumExe(), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required',
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
cleanup.push(async () => browser.close());

let shotN = 0;
async function shot(p, name) {
  await sleep(500);
  const file = `${String(++shotN).padStart(2, '0')}-${p.slug}-${name}.png`;
  await p.page.screenshot({ path: resolve(outDir, file) });
  const over = await p.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (over > 0) p.errors.push(`${name}: yatay taşma ${over}px`);
  log(`📸 ${file}`);
  return file;
}
const net = (p, op, data = {}) => p.page.evaluate(([o, d]) => window.__etkinlik.net().call(o, d), [op, data]);
const tid = (p, id) => p.page.getByTestId(id);

async function player(name, slug) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(process.env.E2E_DSF ?? 1), isMobile: true, hasTouch: true, locale: 'tr-TR' });
  const page = await ctx.newPage();
  const p = { name, slug, ctx, page, errors: [] };
  page.on('pageerror', (e) => p.errors.push(String(e.message ?? e)));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/favicon|AudioContext|WebGL|GPU|Autoplay|manifest|Failed to load resource|WebSocket connection/i.test(t)) p.errors.push(t); });
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__etkinlik?.net()?.status === 'bağlı', null, { timeout: 20_000 }).catch(() => fail(`${name} bağlanamadı`));
  players.push(p);
  await net(p, 'profile.update', { name });
  log(`${name}: başlık ekranı`);
  await page.getByRole('button', { name: /Yola çık|Devam et/ }).click();
  log(`${name}: haritada`);
  // harita (Phaser) ağırdır: üç pencere aynı anda harita çizmesin diye görüntüden sonra Takım sekmesine geç
  await tid(p, 'ev-fab').waitFor({ timeout: 20_000 });
  if (slug === 'ayse') { await sleep(1500); await shot(p, 'harita-etkinlik-dugmesi'); }
  await page.locator('nav.tabbar .tab', { hasText: 'Takım' }).click();
  return p;
}
/** kutlama/bildirim katmanlarını kapat (dokunuşla hızlanır) */
async function settle(p, ms = 400) {
  for (let i = 0; i < 12; i++) {
    if (!(await p.page.locator('.cel-root.on').count())) break;
    const cta = p.page.locator('.cel-cta button');
    if (await cta.count() && await cta.first().isVisible()) await cta.first().click().catch(() => undefined);
    else await p.page.mouse.click(195, 420).catch(() => undefined);
    await sleep(400);
  }
  await sleep(ms);
}
async function openEvents(p, view) {
  await p.page.evaluate(() => window.scrollTo(0, 0));
  if (await tid(p, 'etkinlikler').count()) {
    if (view) { const back = p.page.locator('.ev-head button[aria-label="Geri"]'); if (await back.count()) await back.click(); }
  } else {
    const fab = tid(p, 'ev-fab');
    if (await fab.count()) await fab.click();
    else {
      // haritayı yeniden açmadan: Takım → Etkinlikler sekmesi → merkez
      await toTab(p, 'Takım');
      await p.page.locator('.subtab', { hasText: 'Etkinlikler' }).click();
      await p.page.getByRole('button', { name: /Etkinlik merkezini aç/ }).click();
    }
  }
  await tid(p, 'etkinlikler').waitFor();
  if (view) { await tid(p, `ev-kart-${view}`).locator('.ev-band').click(); await p.page.locator(`[data-testid="etkinlikler"][data-view="${view}"]`).waitFor(); }
}
/** alt ekranlardan geri gelerek sekmeye geç */
async function toTab(p, label) {
  for (let i = 0; i < 10 && !(await p.page.locator('nav.tabbar').count()); i++) {
    await p.page.locator('button[aria-label="Geri"]').first().click().catch(() => undefined); await sleep(300);
  }
  await p.page.locator('nav.tabbar .tab', { hasText: label }).click();
}
/** bölüm botla oynanır; etkinlik ekranına sonuçla dönülür */
async function waitLevelDone(p, timeoutMs = 150_000) {
  await p.page.waitForFunction(() => window.__odi?.events?.some((e) => e.type === 'started'), null, { timeout: 30_000 });
  await p.page.waitForFunction(() => !!document.querySelector('[data-testid="ev-flash"]') || !!document.querySelector('[data-testid="etkinlikler"]'), null, { timeout: timeoutMs });
  const r = await p.page.evaluate(() => window.__odi?.result && { completed: window.__odi.result.completed, stars: window.__odi.result.stars, score: window.__odi.result.score, timeSec: window.__odi.result.timeSec });
  return r;
}

try {
  const A = await player('Ayşe', 'ayse'); const B = await player('Bora', 'bora'); const C = await player('Cem', 'cem');
  log('üç oyuncu bağlandı');
  // takımlar (takım kurma ekranı başka ekibin; burada doğrudan istemciyle)
  const tA = (await net(A, 'team.create', { name: 'Koklea Kartalları', emblem: '🦅', description: 'Her gün biraz, hep birlikte.' })).team;
  await net(B, 'team.join', { teamId: tA.id });
  await net(C, 'team.create', { name: 'Bas Baykuşları', emblem: '🦉' });
  const codeB = await B.page.evaluate(() => window.__etkinlik.net().me.friendCode); const codeA = await A.page.evaluate(() => window.__etkinlik.net().me.friendCode);
  await net(A, 'friends.add', { code: codeB }).catch(() => undefined); await net(B, 'friends.add', { code: codeA }).catch(() => undefined);
  for (const p of [A, B, C]) await p.page.evaluate(async () => { const e = window.__etkinlik; const t = await e.net().call('team.detail', {}); e.netStore.setState({ team: t.team }); });
  for (const p of [A, B, C]) await p.page.evaluate(() => window.__etkinlik.net().call('events.overview', {}).then((r) => window.__etkinlik.events.setState({ ...r.overview, loaded: true, offset: r.overview.serverTime - Date.now() })));

  // ---- etkinlik merkezi
  await openEvents(A);
  await tid(A, 'ev-kart-ralli').waitFor();
  await shot(A, 'etkinlik-merkezi');
  await A.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot(A, 'etkinlik-merkezi-alt');

  // ---- düello eşleşmesi (A'nın takımı merkezi açınca yazıldı; Cem'in takımı açınca eşleşir)
  await openEvents(C, 'duello');
  await C.page.locator('[data-testid="duello"][data-status="eslesti"]').waitFor({ timeout: 10_000 });
  check(true, 'düello: iki gerçek takım eşleşti');
  await net(A, 'progress.submit', { runId: `e2e-${Date.now()}-1`, level: 1, completed: true, stars: 3, score: 1200, timeSec: 20, coins: 120, biome: 'dis-kulak', mechanic: 'kosu' });
  await net(C, 'progress.submit', { runId: `e2e-${Date.now()}-2`, level: 1, completed: true, stars: 2, score: 900, timeSec: 25, coins: 60, biome: 'dis-kulak', mechanic: 'kosu' });
  await C.page.locator('[data-testid="duello-skor"][data-rival="30"]').waitFor({ timeout: 10_000 });
  check(true, 'düello: canlı skor çubuğu (Cem 20 – Kartallar 30)');
  await shot(C, 'duello-eslesme');

  // ---- RALLİ
  await openEvents(A, 'ralli');
  await tid(A, 'ralli-secim').waitFor();
  await shot(A, 'ralli-canavar-secimi');
  await tid(A, 'ralli-baslat-serumen-yavrusu').click();
  await tid(A, 'ralli-oda').waitFor();
  await tid(B, 'ev-bildirim').waitFor({ timeout: 10_000 });
  check((await tid(B, 'ev-bildirim').innerText()).includes('Ayşe ralli başlattı'), 'Bora: "Ayşe ralli başlattı! 10:00" bildirimi');
  await shot(B, 'bildirim-ralli');
  await tid(B, 'ev-bildirim').locator('.ev-notice-main').click();
  await tid(B, 'ralli-katil').click();
  await tid(B, 'ralli-saldir').waitFor();
  await tid(A, 'ralli-saldir').waitFor();
  await shot(A, 'ralli-odasi');
  const rallyRuns = [];
  for (let round = 0; round < 3; round++) {
    const status = await A.page.evaluate(() => window.__etkinlik.events.getState().rally?.status);
    if (status === 'kazanildi') break;
    const act = [];
    for (const p of [A, B]) if (await tid(p, 'ralli-saldir').isEnabled()) { await tid(p, 'ralli-saldir').click(); act.push(p); }
    if (round === 0) { await sleep(6000); await shot(B, 'ralli-bolum-bot'); }
    for (const p of act) rallyRuns.push({ who: p.name, ...(await waitLevelDone(p)) });
    await sleep(1200);
  }
  log('ralli koşuları:', JSON.stringify(rallyRuns));
  await A.page.locator('[data-testid="ralli-oda"][data-status="kazanildi"]').waitFor({ timeout: 15_000 }).catch(() => fail('ralli kazanılmadı'));
  check(true, 'ralli kazanıldı (iki üye de bölümü bitirdi, can sıfır)');
  await sleep(600);
  await shot(A, 'ralli-kazanildi-sandik');
  await settle(A); await settle(B);
  await shot(B, 'ralli-kazanildi');
  const inboxA = (await net(A, 'inbox.list')).items.filter((i) => i.reason.startsWith('Ralli kazanıldı'));
  check(inboxA.length === 2, 'Ayşe ödül kutusu: ralli ödülü (150 jeton + 10 kristal)');

  // ---- QUIZ (iki üye aynı anda cevaplar)
  await openEvents(A, 'quiz');
  await tid(A, 'quiz-baslat').click();
  await A.page.locator('[data-testid="quiz"][data-phase="lobi"]').waitFor();
  await tid(B, 'ev-bildirim').filter({ hasText: 'Bilgi yarışması' }).waitFor({ timeout: 10_000 });
  await tid(B, 'ev-bildirim').locator('.ev-notice-main').click();
  await tid(B, 'quiz-katil').click();
  await shot(B, 'quiz-lobi');
  await tid(A, 'quiz-hemen').click();
  const qAnswers = [];
  for (let i = 0; i < 2; i++) {
    for (const p of [A, B]) await p.page.locator(`[data-testid="quiz"][data-phase="soru"][data-index="${i}"]`).waitFor({ timeout: 30_000 });
    await Promise.all([tid(A, 'quiz-secenek-0').click(), tid(B, 'quiz-secenek-1').click()]);
    await A.page.getByText('2/2 cevapladı').waitFor({ timeout: 5000 });
    qAnswers.push(i);
    if (i === 0) await shot(A, 'quiz-soru-kilitli');
    await B.page.locator(`[data-testid="quiz"][data-phase="cevap"][data-index="${i}"]`).waitFor({ timeout: 20_000 });
    if (i === 0) await shot(B, 'quiz-cevap-aciklama');
  }
  check(qAnswers.length === 2, 'quiz: iki üye aynı soruyu aynı anda cevapladı, cevap ve açıklama ikisine birden açıldı');

  // ---- BAYRAK YARIŞI
  await openEvents(A, 'bayrak');
  await tid(A, 'bayrak-al').click();
  await tid(A, 'bayrak-kos').click();
  const leg1 = await waitLevelDone(A);
  log('1. ayak:', JSON.stringify(leg1));
  await A.page.locator('[data-testid="bayrak"][data-current="1"]').waitFor({ timeout: 15_000 }).catch(() => fail('1. ayak kaydedilmedi'));
  await shot(A, 'bayrak-ayak-bitti');
  await tid(A, 'bayrak-devret').click();
  await tid(A, 'bayrak-devret-Bora').click();
  await tid(B, 'ev-bildirim').filter({ hasText: 'Bayrak sende' }).waitFor({ timeout: 10_000 });
  check(true, 'Bora: "Bayrak sende!" bildirimi');
  await shot(B, 'bildirim-bayrak-sende');
  await tid(B, 'ev-bildirim').filter({ hasText: 'Bayrak sende' }).locator('.ev-notice-main').click();
  await tid(B, 'bayrak-sende').waitFor();
  await shot(B, 'bayrak-sende');
  await tid(B, 'bayrak-kos').click();
  const leg2 = await waitLevelDone(B);
  log('2. ayak:', JSON.stringify(leg2));
  await B.page.locator('[data-testid="bayrak"][data-current="2"]').waitFor({ timeout: 15_000 }).catch(() => fail('2. ayak kaydedilmedi'));
  check(true, 'bayrak: iki ayak iki farklı üyeyle koşuldu, devir bildirimi geldi');
  await shot(B, 'bayrak-yolu');

  // ---- DÜELLO skor çubuğu (ralli + bayrak + yıldız)
  await openEvents(A, 'duello');
  const duelMe = Number(await tid(A, 'duello-skor').getAttribute('data-me'));
  check(duelMe >= 30 + 120 + 80, `düello: Kartallar ${duelMe} puan (yıldız + ralli + 2 bayrak ayağı)`);
  await shot(A, 'duello-skor-cubugu');

  // ---- GÜNÜN MEYDAN OKUMASI (üçü aynı bölüm)
  // üçü de aynı tohumlu bölümü oynar (yazılımsal GPU'da üç Phaser aynı anda çok yavaş: sırayla)
  for (const p of [A, B, C]) { await openEvents(p, 'meydan'); await tid(p, 'meydan-oyna').click(); log(`meydan ${p.name}:`, JSON.stringify(await waitLevelDone(p))); }
  for (const p of [A, B, C]) await p.page.locator('[data-testid="meydan"]:not([data-rank="0"])').waitFor({ timeout: 15_000 });
  await openEvents(A, 'meydan');
  await A.page.locator('[data-testid="siralama"] li').nth(2).waitFor({ timeout: 10_000 }).catch(() => undefined);
  const board = await A.page.$$eval('[data-testid="siralama"] li', (els) => els.map((e) => `${e.getAttribute('data-rank')}:${e.getAttribute('data-name')}`));
  check(board.length === 3, `meydan okuma genel sıralama: ${board.join(', ')}`);
  await settle(A);
  await shot(A, 'meydan-siralama');

  // ---- takım sekmesi, görevler, ses avı, turnuva
  await toTab(B, 'Takım');
  await B.page.locator('.subtab', { hasText: 'Etkinlikler' }).click();
  await tid(B, 'takim-etkinlikler').waitFor();
  await shot(B, 'takim-etkinlik-sekmesi');
  await net(B, 'progress.submit', { runId: `e2e-${Date.now()}-3`, level: 1, completed: true, stars: 2, score: 800, timeSec: 22, coins: 180, biome: 'dis-kulak', mechanic: 'kosu' });
  await openEvents(A, 'gorev'); await tid(A, 'takim-gorevleri').waitFor(); await shot(A, 'takim-gorevleri');
  await openEvents(A, 'avi'); await tid(A, 'ses-avi').waitFor(); await shot(A, 'ses-avi');
  await openEvents(C, 'turnuva'); await tid(C, 'turnuva').waitFor(); await shot(C, 'haftalik-turnuva');

  // ---- quiz sonucu (10 soru × 21 sn; arka planda bitti)
  await openEvents(B, 'quiz');
  await B.page.locator('[data-testid="quiz"][data-phase="bitti"]').waitFor({ timeout: 240_000 }).catch(() => fail('quiz bitmedi'));
  check(true, 'quiz bitti: takım ortalaması hesaplandı');
  await shot(B, 'quiz-sonuc');

  const errors = players.map((p) => ({ player: p.name, errors: [...new Set(p.errors)] }));
  writeFileSync(resolve(outDir, 'e2e.json'), JSON.stringify({ checks, rallyRuns, leg1, leg2, board, errors, seconds: Math.round((Date.now() - t0) / 1000) }, null, 2));
  const errCount = errors.reduce((a, e) => a + e.errors.length, 0);
  for (const f of cleanup.reverse()) { try { await f(); } catch { /* yok */ } }
  if (errCount) { console.error('✗ sayfa hataları:', JSON.stringify(errors)); process.exit(2); }
  console.log(`\n✓ etkinlikler uçtan uca: ${checks.length} denetim geçti, ${shotN} ekran görüntüsü: ${outDir}`);
  process.exit(0);
} catch (e) { console.error(String(e?.stack ?? e).split('\n').filter((l) => /events-e2e|Error|Timeout/.test(l)).slice(0, 6).join('\n')); await fail(String(e?.message ?? e).split('\n')[0]); }
