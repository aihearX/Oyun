#!/usr/bin/env node
// ODİ etkinlikler uçtan uca testi: gerçek sunucu (ODI_DB=:memory:, ODI_EVENTS_FAST=1, ODI_TEST_STORE=1) + web derlemesi
// (VITE_ODI_E2E=1: yalnızca bu test derlemesinde `?etkinlik-bot=1` bölümü harness botuna oynatır; normal derlemede bu yol yoktur)
// + 3 tarayıcı (Ayşe ve Bora aynı takım, Cem başka takım), 390×844.
// Akış: harita yüzen Etkinlik düğmesi → merkez → düello eşleşmesi → ralli (başlat, bildirim, katıl, ikisi de bölümü bot ile oynar, kazanılır)
//       → quiz (iki üye aynı anda cevaplar, cevap + açıklama) → bayrak (koş, devret, "Bayrak sende!", ikinci ayak) → düello skor çubuğu
//       → Günün Meydan Okuması (üçü de oynar, sıralama) → takım sekmesi, görevler, Ses Avı, turnuva
//       → bot olmadan Bayrak ayağı (Cem: "Dokun ve başla", dokunuşla zıplama, sonuç yazılır) → quiz sonucu
//       → Cem'in baştan başlattığı tek kişilik rallinin süresi dolar: günlük hak değişmez, sohbet "hakkı geri verildi" der (YN-095).
// Kullanım: node tools/harness/events-e2e.mjs [--no-build] [--headed]
// Çıktı: tools/harness/out/etkinlik/*.png ve e2e.json
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const args = new Set(process.argv.slice(2));
const root = resolve(new URL('../..', import.meta.url).pathname);
const webRoot = resolve(root, 'apps/web');
// E2E_VIEW=320x640 (dar ekran) · E2E_KNOWLEDGE=odyoloji (Ayarlar › Bilgi düzeyi: quiz öğrenci sorularını öne çıkarır) · çıktı klasörü ayrı
const [VW, VH] = (process.env.E2E_VIEW ?? '390x844').split('x').map(Number);
const KNOW = process.env.E2E_KNOWLEDGE === 'odyoloji' ? 'odyoloji' : 'genel';
const outDir = resolve(root, `tools/harness/out/etkinlik${process.env.E2E_VIEW || KNOW !== 'genel' ? `-${VW}-${KNOW}` : ''}`); mkdirSync(outDir, { recursive: true });
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
  const over = await p.page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.getElementById('root')?.scrollWidth ?? 0) - window.innerWidth);
  if (over > 0) p.errors.push(`${name}: yatay taşma ${over}px`);
  log(`📸 ${file}`);
  return file;
}
const net = (p, op, data = {}) => p.page.evaluate(([o, d]) => window.__etkinlik.net().call(o, d), [op, data]);
const tid = (p, id) => p.page.getByTestId(id);

async function player(name, slug) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: Number(process.env.E2E_DSF ?? 1), isMobile: true, hasTouch: true, locale: 'tr-TR' });
  // ilk açılış rehberini (hikâye + anlatıcı turları + kilitler) atla: bu test başka bir akışı sınar (bkz. onboarding-e2e.mjs)
  await ctx.addInitScript((knowledge) => { try { if (!localStorage.getItem('odi-v1')) localStorage.setItem('odi-v1', JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true }, knowledge }, version: 3 })); } catch { /* depolama yok */ } }, KNOW);
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
  await p.page.evaluate(() => document.getElementById('root')?.scrollTo(0, 0));
  // doğrudan açılan etkinlikte (duyuru, Takım sekmesi) Geri etkinlik ekranından çıkar (YN-107): o zaman merkez yeniden açılır
  if (view && await tid(p, 'etkinlikler').count()) { const back = p.page.locator('.ev-head button[aria-label="Geri"]'); if (await back.count()) { await back.click(); await sleep(300); } }
  if (!(await tid(p, 'etkinlikler').count())) {
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
  const tA = (await net(A, 'team.create', { name: 'Koklea Kartalları', emblem: '🦉', description: 'Her gün biraz, hep birlikte.' })).team;
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
  await A.page.evaluate(() => { const r = document.getElementById('root'); r?.scrollTo(0, r.scrollHeight); });
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

  // ---- TEK KİŞİLİK RALLİ (YN-095, OT-takim-kaptani-13): Cem'in takımında ikinci üye yok; ralli 10 dk açık kalır, kimse katılmaz.
  // Süre dolunca (testin sonunda beklenir) takımın günlük ralli hakkı değişmemiş olmalı ve sohbet "hakkınız geri verildi" demeli.
  const soloLeft0 = (await net(C, 'rally.state')).startsLeft;
  await openEvents(C, 'ralli');
  await tid(C, 'ralli-baslat-serumen-yavrusu').click();
  await tid(C, 'ralli-onay-baslat').click(); // başlatma onayı (YN-116)
  await tid(C, 'ralli-bekleme').waitFor();
  const soloRally = await C.page.evaluate(() => window.__etkinlik.events.getState().rally);
  check((await tid(C, 'ralli-kural').innerText()).includes('günlük ralli hakkı geri verilir'), 'ralli (tek kişi): bekleme kartında açık kural cümlesi');
  check((await tid(C, 'ralli-akis-bos').innerText()).includes('Bir takım arkadaşın katılınca saldırı açılır'), 'ralli (tek kişi): akış "Bir takım arkadaşın katılınca saldırı açılır" (çelişki yok)');
  await shot(C, 'ralli-tek-kisi-bekleme');

  // ---- RALLİ
  await openEvents(A, 'ralli');
  await tid(A, 'ralli-secim').waitFor();
  await shot(A, 'ralli-canavar-secimi');
  // dürüst bilgi (YN-116, karar 43 / YN-117): can katılımcıya göre; kartta 2 kişiyle can ve kişi başı ortalama hasar (Yankı Hayaleti 2 kişiyle 440)
  check(/Can katılımcıya göre: 2 kişiyle 440/.test(await tid(A, 'ralli-gerekli-yanki-hayaleti').innerText()), 'ralli: canavar kartında "Can katılımcıya göre: 2 kişiyle 440" bilgisi');
  await tid(A, 'ralli-baslat-serumen-yavrusu').click();
  await tid(A, 'ralli-onay').waitFor();
  check(/Can katılımcıya göre: 2 kişiyle 200/.test(await tid(A, 'ralli-onay-gerekli').innerText()), 'ralli: başlatma onayında katılımcıya göre can bilgisi');
  await shot(A, 'ralli-baslatma-onayi');
  await tid(A, 'ralli-onay-baslat').click();
  await tid(A, 'ralli-oda').waitFor();
  await tid(B, 'ev-bildirim').waitFor({ timeout: 10_000 });
  check((await tid(B, 'ev-bildirim').innerText()).includes('Ayşe ralli başlattı'), 'Bora: "Ayşe ralli başlattı! 10:00" bildirimi');
  await shot(B, 'bildirim-ralli');
  await tid(B, 'ev-bildirim').locator('.ev-notice-main').click();
  await tid(B, 'ralli-katil').waitFor();
  // ---- çağrı kaydı (YN-224, OT-takim-kaptani-39): Ayşe Bora'yı özel mesajla çağırır; ralli ekranında "Çağrıldı: Bora · henüz görmedi".
  // Bora özel mesajı okuyunca (dm.read: özel mesajdaki çift tikle aynı kaynak) "gördü"; okunmadan "gördü" yazmaz.
  await tid(A, 'ralli-cagir').click();
  await A.page.locator('.sheet [data-testid="cagir-uye"]').filter({ hasText: 'Bora' }).getByRole('button', { name: 'Bora çağır' }).click();
  await A.page.locator('.sheet [data-testid="cagir-uye"]').filter({ hasText: 'Gönderildi' }).waitFor({ timeout: 10_000 });
  await A.page.keyboard.press('Escape');
  const cagri = A.page.locator('[data-testid="ralli-cagrilan"]').filter({ hasText: 'Bora' });
  await cagri.waitFor({ timeout: 10_000 });
  check((await cagri.getAttribute('data-durum')) === 'henüz görmedi' && (await cagri.innerText()).includes('Çağrıldı'), 'ralli: çağrılan satırı "Çağrıldı: Bora · henüz görmedi" (okunmadan "gördü" yok)');
  await shot(A, 'ralli-cagri-gormedi');
  const idA = await A.page.evaluate(() => window.__etkinlik.net().me.id);
  await net(B, 'dm.read', { id: idA });
  await A.page.locator('[data-testid="ralli-cagrilan"][data-durum="gördü"]').waitFor({ timeout: 10_000 }).catch(() => fail('ralli: Bora daveti okuyunca "gördü" yazmadı'));
  check(true, 'ralli: Bora daveti okuyunca satır "gördü" (sunucunun okundu bilgisi)');
  await shot(A, 'ralli-cagri-gordu');
  for (let i = 0; i < 3 && await B.page.locator('[data-testid="mesaj-bildirimi"] .fr-banner-x').count(); i++) await B.page.locator('[data-testid="mesaj-bildirimi"] .fr-banner-x').first().click({ timeout: 800 }).catch(() => undefined);
  await tid(B, 'ralli-katil').click();
  await tid(B, 'ralli-saldir').waitFor();
  await tid(A, 'ralli-saldir').waitFor();
  // can katılımcıya göre (YN-117): 2 katılımcıyla Serumen Yavrusu 200, ilk vuruşa dek "şu an 2 katılımcıya göre"
  await A.page.locator('[data-testid="ralli-oda"][data-hp="200"]').waitFor({ timeout: 10_000 });
  check(/şu an 2 katılımcıya göre/.test(await tid(A, 'ralli-can-temel').innerText()), 'ralli: can 2 katılımcıya göre (200) ve ilk vuruşta sabitleneceği yazıyor');
  await shot(A, 'ralli-odasi');
  const walletA0 = (await net(A, 'wallet.get')).wallet;
  const rallyRuns = [];
  // Bora bölümü bot ile oynar (bir vuruş); Ayşe bölümdeyken Bora'nın kalan vuruşları canavarı yener (YN-193, OT-takim-kaptani-34):
  // Ayşe bölüm içinde "Canavar yenildi! Ralli kazanıldı" şeridini görür ve "Çık" ile tek dokunuşla ralli ekranına döner
  await tid(B, 'ralli-saldir').click();
  await sleep(6000); await shot(B, 'ralli-bolum-bot');
  rallyRuns.push({ who: B.name, ...(await waitLevelDone(B)) });
  await A.page.locator('[data-testid="ralli-oda"]:not([data-hp="200"])').waitFor({ timeout: 15_000 }).catch(() => fail('Bora\'nın vuruşu yazılmadı'));
  await tid(A, 'ralli-saldir').click();
  await A.page.locator('.level-host canvas').waitFor({ timeout: 30_000 });
  await sleep(2500);
  check(!(await tid(A, 'ralli-bolum-yenildi').count()), 'ralli: canavar yenilmeden bölüm içinde şerit yok');
  const rallyId = await A.page.evaluate(() => window.__etkinlik.events.getState().rally?.id);
  for (let i = 0; i < 2; i++) {
    const x = await net(B, 'rally.hit', { rallyId, runId: `e2e-ralli-${Date.now().toString(36)}-${i}`, completed: true, stars: 3, score: 1500, timeSec: 30 });
    rallyRuns.push({ who: `${B.name} (istemci)`, damage: x.damage, hp: x.rally.hp });
    if (x.rally.status === 'kazanildi') break;
  }
  log('ralli koşuları:', JSON.stringify(rallyRuns));
  const serit = await tid(A, 'ralli-bolum-yenildi').waitFor({ timeout: 10_000 }).then(() => tid(A, 'ralli-bolum-yenildi').innerText(), () => '');
  check(serit.includes('Canavar yenildi! Ralli kazanıldı') && !!(await A.page.locator('.level-host canvas').count()), `ralli: Ayşe bölümdeyken canavar yenildi, bölüm içinde şerit ("${serit.replace(/\s+/g, ' ').trim()}")`);
  await shot(A, 'ralli-bolum-ici-yenildi');
  await tid(A, 'ralli-bolum-cik').click();
  const cikis = await tid(A, 'ev-flash').waitFor({ timeout: 10_000 }).then(() => tid(A, 'ev-flash').innerText(), () => '');
  check(cikis.includes('Ralli kazanıldı') && !(await A.page.locator('.level-host').count()), `ralli: "Çık" ile tek dokunuşla ralli ekranına dönüldü ("${cikis.replace(/\s+/g, ' ').trim()}")`);
  await A.page.locator('[data-testid="ralli-oda"][data-status="kazanildi"]').waitFor({ timeout: 15_000 }).catch(() => fail('ralli kazanılmadı'));
  check(true, 'ralli kazanıldı (can sıfır)');
  await sleep(600);
  await shot(A, 'ralli-kazanildi-sandik');
  check(await A.page.locator('.cel-cta button', { hasText: 'Topla' }).waitFor({ timeout: 10_000 }).then(() => true, () => false), 'ralli: kazanma sandığında "Topla" (ödül kutusundaki satırlar alınacak)');
  await settle(A); await settle(B);
  await shot(B, 'ralli-kazanildi');
  // "Topla" gerçekten toplar (OT-ekonomi-denetci-32): o rallinin ödül kutusu satırları alındı, cüzdan sunucuyla aynı
  const rallyRows = async (p) => (await net(p, 'inbox.list')).items.filter((i) => i.reason.startsWith('Ralli kazanıldı'));
  for (let i = 0; i < 20 && ((await rallyRows(A)).length || (await rallyRows(B)).length); i++) await sleep(500);
  check((await rallyRows(A)).length === 0 && (await rallyRows(B)).length === 0, 'ralli: "Topla" sonrası Ödül kutusunda o rallinin satırı kalmadı (Ayşe ve Bora)');
  const walletA = (await net(A, 'wallet.get')).wallet;
  check(walletA.jeton - walletA0.jeton === 150 && walletA.kristal - walletA0.kristal === 10, `ralli: ödül bir kez cüzdana girdi (+${walletA.jeton - walletA0.jeton} jeton, +${walletA.kristal - walletA0.kristal} kristal)`);
  const shownA = await A.page.evaluate(() => window.__etkinlik.netStore.getState().wallet);
  check(shownA?.jeton === walletA.jeton && shownA?.kristal === walletA.kristal, 'ralli: istemci cüzdanı sunucu cüzdanıyla eşit');
  // "Topla"dan sonra Etkinlikler kartı ödülü doğru yerde söyler: cüzdanında, ödül kutunda değil (YN-171, OT-takim-kaptani-31)
  { const back = A.page.locator('.ev-head button[aria-label="Geri"]'); if (await back.count()) await back.click();
    await tid(A, 'ev-ralli-sonuc').waitFor({ timeout: 10_000 });
    let t = ''; for (let i = 0; i < 20 && !(t = await tid(A, 'ev-ralli-sonuc').innerText()).includes('cüzdanında'); i++) await sleep(300);
    check(t.includes('ödülün cüzdanında') && !t.includes('ödül kutunda'), `ralli: Etkinlikler kartı "ödülün cüzdanında" diyor (${t.replace(/\s+/g, ' ').trim()})`);
    await shot(A, 'ralli-sonuc-karti-cuzdan'); }

  // ---- QUIZ (iki üye aynı anda cevaplar)
  await openEvents(A, 'quiz');
  await tid(A, 'quiz-baslat').click();
  await A.page.locator('[data-testid="quiz"][data-phase="lobi"]').waitFor();
  await tid(B, 'ev-bildirim').filter({ hasText: 'Bilgi yarışması' }).waitFor({ timeout: 10_000 });
  await tid(B, 'ev-bildirim').locator('.ev-notice-main').click();
  await tid(B, 'quiz-katil').click();
  { const kural = await tid(B, 'quiz-hemen-kurali').innerText(); const duzey = await tid(B, 'quiz-duzey').innerText();
    check(/^Hemen başlat: .*günlük hakkından düşmez\.$/.test(kural), `quiz: bekleme odasında "Hemen başlat" kuralı yazılı ("${kural}")`);
    check(/^Sorular: (genel düzey|öğrenci düzeyi|karışık \(\d+ öğrenci \+ \d+ genel\))$/.test(duzey), `quiz: bekleme odasında düzey satırı ("${duzey}")`); }
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
  // Takım › Etkinlikler'den açılan Bayrak Yarışı: bugünkü takım satırı (YN-194); tek Geri Takım › Etkinlikler'e döner (YN-107, OT-buyuk-yazi-59)
  await tid(B, 'takim-etkinlikler').locator('[data-testid="ev-kart-bayrak"] .ev-band').click();
  await B.page.locator('[data-testid="etkinlikler"][data-view="bayrak"]').waitFor();
  { const t = await tid(B, 'bayrak-takim-ayak').innerText().catch(() => '');
    check(t === 'Bugünkü takımın koştuğu ayak: 2/4', `bayrak: başlıkta bugünkü takım ("${t}")`); }
  await B.page.locator('.ev-head button[aria-label="Geri"]').click();
  await tid(B, 'takim-etkinlikler').waitFor({ timeout: 5000 }).catch(() => undefined);
  check(!!(await tid(B, 'takim-etkinlikler').count()) && !(await tid(B, 'etkinlikler').count()), 'bayrak: Takım › Etkinlikler\'den açılınca tek Geri Takım › Etkinlikler sekmesine döner');
  await net(B, 'progress.submit', { runId: `e2e-${Date.now()}-3`, level: 1, completed: true, stars: 2, score: 800, timeSec: 22, coins: 180, biome: 'dis-kulak', mechanic: 'kosu' });
  await openEvents(A, 'gorev'); await tid(A, 'takim-gorevleri').waitFor(); await shot(A, 'takim-gorevleri');
  await openEvents(A, 'avi'); await tid(A, 'ses-avi').waitFor(); await shot(A, 'ses-avi');
  await openEvents(C, 'turnuva'); await tid(C, 'turnuva').waitFor(); await shot(C, 'haftalik-turnuva');

  // ---- gerçek oyuncu akışı (YN-068): bot parametresi olmadan Bayrak ayağı "Dokun ve başla"da bekler; o dokunuş yutulur
  // (consumeActive: zıplatmaz), sonraki dokunuş zıplatır; oyuncu bırakınca Odi düşer ve sonuç normal yoldan (onDone) yazılır
  await C.page.goto(base.replace('&etkinlik-bot=1', ''), { waitUntil: 'load' });
  await C.page.waitForFunction(() => window.__etkinlik?.net()?.status === 'bağlı', null, { timeout: 20_000 });
  await C.page.getByRole('button', { name: /Yola çık|Devam et/ }).click();
  await tid(C, 'ev-fab').waitFor({ timeout: 20_000 });
  await openEvents(C, 'bayrak');
  await tid(C, 'bayrak-al').click(); await tid(C, 'bayrak-kos').click();
  await C.page.waitForFunction(() => window.__odi?.events?.some((e) => e.type === 'ready'), null, { timeout: 30_000 });
  await sleep(1500);
  check(!(await C.page.evaluate(() => window.__odi.events.some((e) => e.type === 'started'))), 'bayrak (bot yok): ayak "Dokun ve başla"da bekliyor');
  await shot(C, 'bayrak-dokun-ve-basla');
  const cv = await C.page.locator('.level-host canvas').first().boundingBox();
  await C.page.touchscreen.tap(cv.x + cv.width / 2, cv.y + cv.height * 0.6);
  await C.page.waitForFunction(() => window.__odi?.events?.some((e) => e.type === 'started'), null, { timeout: 5000 });
  // yükselen Odi (yerden kalkmış, hızı yerçekiminin tersine) sayılır
  await C.page.evaluate(() => { const w = window; w.__zipla = 0; const f = () => { const h = w.__odiScene?.sim?.hero; if (h && !h.grounded && h.vy * h.g < -1) w.__zipla++; if (w.__odiScene) requestAnimationFrame(f); }; f(); });
  await sleep(500);
  check((await C.page.evaluate(() => window.__zipla)) === 0, 'bayrak (bot yok): başlatan dokunuş yutuldu, Odi zıplamadı');
  await C.page.touchscreen.tap(cv.x + cv.width / 2, cv.y + cv.height * 0.6);
  await C.page.waitForFunction(() => window.__zipla > 0, null, { timeout: 3000 }).catch(() => undefined);
  check((await C.page.evaluate(() => window.__zipla)) > 0, 'bayrak (bot yok): sonraki dokunuşla Odi zıpladı');
  await C.page.locator('[data-testid="ev-flash"]').waitFor({ timeout: 150_000 });
  const flashC = (await C.page.locator('[data-testid="ev-flash"]').innerText()).replace(/\s+/g, ' ');
  check(/ayak/i.test(flashC), `bayrak (bot yok): sonuç etkinliğe yazıldı ("${flashC}")`);
  await shot(C, 'bayrak-elle-sonuc');

  // ---- quiz sonucu (10 soru × 21 sn; arka planda bitti)
  await openEvents(B, 'quiz');
  await B.page.locator('[data-testid="quiz"][data-phase="bitti"]').waitFor({ timeout: 240_000 }).catch(() => fail('quiz bitmedi'));
  check(true, 'quiz bitti: takım ortalaması hesaplandı');
  // bitişte sıralama tazelenir, kendi takımı vurgulu; takım ödülü ve düzey satırı (YN-185, YN-187)
  await B.page.locator('[data-testid="quiz"] .rank-list li.me').filter({ hasText: 'Koklea Kartalları' }).last().waitFor({ timeout: 10_000 }).catch(() => fail('quiz: takım sıralamasında kendi takımı yok'));
  { const odul = await tid(B, 'quiz-takim-odulu').innerText(); const duzey = await tid(B, 'quiz-duzey').innerText();
    check(/^Takım ortalaması [\d.]+(, eşik 700: doğru cevabı olan herkese \+10 kristal \(ödül kutunda\)|: takım ödülü eşiği 700, [\d.]+ puan eksik kaldı)$/.test(odul), `quiz: sonuçta takım ödülü satırı ("${odul}")`);
    check(duzey.startsWith('Sorular: '), `quiz: sonuçta düzey satırı ("${duzey}")`); }
  check(!(await B.page.locator('[data-testid="quiz"]').innerText()).includes('Bugün henüz yarışma bitiren takım yok'), 'quiz: bitince "henüz yarışma bitiren takım yok" yazmıyor');
  await shot(B, 'quiz-sonuc');

  // ---- tek kişilik rallinin süresi doldu: hak sayısı değişmedi (sunucu ve ekrandaki sayı), sohbet hakkın geri verildiğini söyledi
  const soloWait = Math.max(0, soloRally.endsAt - (Date.now() + (await C.page.evaluate(() => window.__etkinlik.events.getState().offset))));
  log(`tek kişilik ralli: süre dolana dek ${Math.round(soloWait / 1000)} sn bekleniyor`);
  await C.page.waitForFunction((id) => { const s = window.__etkinlik.events.getState(); return s.rally?.id === id && s.rally.status === 'kaybedildi'; }, soloRally.id, { timeout: soloWait + 60_000, polling: 1000 })
    .catch(() => fail('tek kişilik ralli kaybedildi olmadı'));
  const soloSt = await net(C, 'rally.state');
  const soloUi = await C.page.evaluate(() => window.__etkinlik.events.getState().rallyStartsLeft);
  check(soloSt.startsLeft === soloLeft0 && soloUi === soloLeft0, `ralli (tek kişi): süre dolunca günlük hak değişmedi (önce ${soloLeft0}, sonra sunucu ${soloSt.startsLeft} / ekran ${soloUi})`);
  const soloChat = (await net(C, 'chat.join', { room: `takim:${soloRally.teamId}` })).history.filter((m) => m.meta?.event === 'ralli' && m.text.includes('kaçtı'));
  check(soloChat.some((m) => m.text.includes('hakkı geri verildi')), `ralli (tek kişi): sohbet "${soloChat.at(-1)?.text ?? '—'}"`);
  await openEvents(C, 'ralli'); await tid(C, 'ralli-oda').waitFor(); await shot(C, 'ralli-tek-kisi-kacti');
  // takım sohbetindeki ralli kartı (YN-116): süresi dolunca geri sayım ve düğme yok, "Bitti: canavar kaçtı" der
  await toTab(C, 'Takım'); await C.page.locator('.subtabs .subtab', { hasText: 'Sohbet' }).first().click();
  const rcard = C.page.locator('[data-testid="ralli-karti"]').last(); await rcard.waitFor({ timeout: 10_000 });
  const rtext = (await rcard.innerText()).replace(/\s+/g, ' ');
  check((await rcard.getAttribute('data-durum')) === 'kacti' && rtext.includes('Bitti: canavar kaçtı') && !(await rcard.getByTestId('ralli-karti-git').count()), `ralli sohbet kartı: "${rtext}"`);
  await rcard.scrollIntoViewIfNeeded(); await shot(C, 'ralli-sohbet-karti-bitti');

  const errors = players.map((p) => ({ player: p.name, errors: [...new Set(p.errors)] }));
  writeFileSync(resolve(outDir, 'e2e.json'), JSON.stringify({ checks, rallyRuns, leg1, leg2, board, errors, seconds: Math.round((Date.now() - t0) / 1000) }, null, 2));
  const errCount = errors.reduce((a, e) => a + e.errors.length, 0);
  for (const f of cleanup.reverse()) { try { await f(); } catch { /* yok */ } }
  if (errCount) { console.error('✗ sayfa hataları:', JSON.stringify(errors)); process.exit(2); }
  console.log(`\n✓ etkinlikler uçtan uca: ${checks.length} denetim geçti, ${shotN} ekran görüntüsü: ${outDir}`);
  process.exit(0);
} catch (e) { console.error(String(e?.stack ?? e).split('\n').filter((l) => /events-e2e|Error|Timeout/.test(l)).slice(0, 6).join('\n')); await fail(String(e?.message ?? e).split('\n')[0]); }
