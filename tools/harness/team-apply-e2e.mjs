#!/usr/bin/env node
// ODİ takım bulma ve başvuru uçtan uca testi (docs/16-takim-rekabeti.md "Takım bulma ve başvuru"): gerçek sunucu (ODI_DB=:memory:)
// + web test derlemesi (VITE_ODI_E2E=1: window.__etkinlik.net()) + tarayıcı oyuncuları + tarayıcısız gerçek istemciler.
// Akış (her tarayıcıda): A arayüzden "Başvuruyla" takım kurar → Y davet koduyla doğrudan katılır (kod kısayolu) ve yardımcı olur →
//   B takımı keşif listesinde (filtre + arama) ve Sıralama › Takımlar › Takım gücü'nde bulur → profil → hazır notla başvurur →
//   A Takım sekmesi rozetini ve "N yeni başvuru"yu görür → Başvurular'dan kabul eder → B takımda (bildirim + takım ekranı + akış kartı) →
//   C başvurur → yardımcı Y hazır gerekçeyle reddeder → C "Başvurularım"da gerekçeyi görür → D başvurur → yardımcı Y kabul eder →
//   C "Doğrudan katıl" filtresinde açık takıma tek dokunuşla katılır.
// dom hedefi: telefon paketi başvuran olur (liste → profil → başvuru), web lideri kabul eder, telefon takım ekranına geçer.
// Kullanım: node tools/harness/team-apply-e2e.mjs [--browsers chromium,webkit] [--target web|dom|both] [--no-build] [--build-dom]
// Çıktı: tools/harness/out/takim-basvuru/<hedef>-<tarayıcı>/NN-oyuncu-ad.png
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, webkit } from 'playwright';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '1'; };
const has = (k) => argv.includes(`--${k}`);
const root = resolve(new URL('../..', import.meta.url).pathname);
const webRoot = resolve(root, 'apps/web');
const outRoot = resolve(root, 'tools/harness/out/takim-basvuru'); mkdirSync(outRoot, { recursive: true });
const distDir = resolve(outRoot, 'dist');
const browsers = opt('browsers', 'chromium,webkit').split(',');
const targets = opt('target', 'both') === 'both' ? ['web', 'dom'] : [opt('target')];
const VW = 390, VH = 844;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => console.log(`  ${m}`);
const cleanup = [];
let failures = 0;
const results = [];
/** yeniden başlatmada ilerleme kaybolmasın: her paket bitince özet dosyaya */
const progressFile = resolve(outRoot, 'ilerleme.json');
const saveProgress = () => { try { writeFileSync(progressFile, JSON.stringify(results, null, 2)); } catch { /* yok */ } };
async function done(code) { saveProgress(); for (const f of cleanup.reverse()) { try { await f(); } catch { /* yok */ } } process.exit(code); }
process.on('SIGINT', () => void done(130));
const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const run = (cmd, a, o = {}) => new Promise((res, rej) => { const p = spawn(cmd, a, { cwd: root, stdio: 'inherit', ...o }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${a.join(' ')} → ${c}`)))); });

// ---------------------------------------------------------------- 1) sunucu
if (!has('no-build') || !existsSync(resolve(root, 'apps/server/dist/server.mjs'))) await run('npm', ['run', 'build:server', '--silent']);
const srvPort = await freePort();
const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'apps/server/dist/server.mjs'], {
  cwd: root, env: { ...process.env, PORT: String(srvPort), HOST: '127.0.0.1', ODI_DB: ':memory:', ODI_TEST_STORE: '1', ODI_LOG: '0' /* güvenli sohbet varsayılanı (8 bölüm): yeni oyuncu yalnızca hazır not seçer */ }, stdio: ['ignore', 'pipe', 'inherit'],
});
cleanup.push(async () => { server.kill(); });
await new Promise((res, rej) => { server.stdout.on('data', (d) => { if (String(d).includes('hazır')) res(); }); server.on('exit', (c) => rej(new Error('sunucu kapandı ' + c))); setTimeout(() => rej(new Error('sunucu başlamadı')), 15_000); });
const wsUrl = `ws://127.0.0.1:${srvPort}`;
log(`sunucu hazır: ${wsUrl}`);

// ---------------------------------------------------------------- 2) web test derlemesi + önizleme; dom paketi
const vite = await import('vite');
if (!has('no-build') || !existsSync(resolve(distDir, 'index.html'))) {
  process.env.VITE_ODI_E2E = '1';
  await vite.build({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: distDir, emptyOutDir: true } });
  delete process.env.VITE_ODI_E2E;
}
const webPort = await freePort();
const pv = await vite.preview({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: distDir }, preview: { port: webPort, strictPort: true, host: '127.0.0.1' } });
cleanup.push(async () => { await pv.close(); });
const base = `http://127.0.0.1:${webPort}/?sunucu=${encodeURIComponent(wsUrl)}`;
const mobileDist = resolve(root, 'apps/mobile/dist');
let domHtml = '';
if (targets.includes('dom')) {
  if (has('build-dom') || !existsSync(resolve(mobileDist, 'www.bundle'))) { rmSync(mobileDist, { recursive: true, force: true }); await run('npx', ['expo', 'export', '--platform', 'ios', '--output-dir', 'dist'], { cwd: resolve(root, 'apps/mobile') }); }
  const dir = resolve(mobileDist, 'www.bundle'); domHtml = pathToFileURL(resolve(dir, readdirSync(dir).find((f) => f.endsWith('.html')))).href;
}

/** dom hedefi: Expo DOM köprüsü + yerel scrollEnabled:false kilidi (comm-e2e.mjs ile aynı) */
function domBridge([serverUrl, top, bottom]) {
  const store = { 'odi-v1': JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true } }, version: 3 }) };
  window.ReactNativeWebView = {
    injectedObjectJson: () => JSON.stringify({ EXPO_DOM_HOST_OS: 'ios', initialProps: { names: ['getItem', 'setItem', 'removeItem', 'haptic', 'share'], props: { serverUrl, canPurchase: false, insetTop: top, insetBottom: bottom } } }),
    postMessage: (s) => {
      try {
        const m = JSON.parse(s); if (m.type !== '$$native_action') return;
        const [k, v] = m.data.args ?? []; let result = null;
        if (m.data.actionId === 'getItem') result = store[k] ?? null;
        if (m.data.actionId === 'setItem') store[k] = v;
        if (m.data.actionId === 'removeItem') delete store[k];
        if (m.data.actionId === 'share') result = 'copied';
        setTimeout(() => window.dispatchEvent(new CustomEvent('$$dom_event', { detail: { type: '$$native_action_result', data: { uid: m.data.uid, actionId: m.data.actionId, result } } })), 0);
      } catch { /* yok */ }
    },
  };
  const lock = () => { const st = document.createElement('style'); st.textContent = 'html{overflow:hidden!important}'; document.head.appendChild(st); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lock); else lock();
}

// ---------------------------------------------------------------- 3) yardımcılar
function makeSuite(label) {
  const dir = resolve(outRoot, label); mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (f.endsWith('.png')) rmSync(resolve(dir, f));
  let n = 0;
  const rec = { label, checks: 0, fails: [] };
  results.push(rec);
  return {
    rec,
    check(cond, m) { rec.checks++; if (cond) log(`✓ ${m}`); else { failures++; rec.fails.push(m); log(`✗ ${m}`); } },
    async shot(p, name) {
      await sleep(450);
      const file = `${String(++n).padStart(2, '0')}-${p.slug}-${name}.png`;
      await p.page.screenshot({ path: resolve(dir, file) });
      const over = await p.page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.getElementById('root')?.scrollWidth ?? 0) - window.innerWidth);
      if (over > 0) { failures++; rec.fails.push(`${name}: yatay taşma ${over}px`); log(`✗ ${name}: yatay taşma ${over}px`); }
      log(`📸 ${label}/${file}`);
    },
  };
}
const net = (p, op, data = {}) => p.page.evaluate(([o, d]) => window.__etkinlik.net().call(o, d), [op, data]);
const toastGone = async (p) => { for (let i = 0; i < 8 && await p.page.locator('.toast-top').count(); i++) { await p.page.locator('.toast-top').first().click({ timeout: 500 }).catch(() => undefined); await sleep(150); } };
const closeBanners = async (p) => { for (const sel of ['[data-testid="iletisim-bildirimi"] .fr-banner-x', '[data-testid="mesaj-bildirimi"] .fr-banner-x']) for (let i = 0; i < 4 && await p.page.locator(sel).count(); i++) await p.page.locator(sel).first().click({ timeout: 800 }).catch(() => undefined); };
async function settle(p) {
  for (let i = 0; i < 10; i++) {
    if (!(await p.page.locator('.cel-root.on').count())) break;
    const cta = p.page.locator('.cel-cta button');
    if (await cta.count() && await cta.first().isVisible()) await cta.first().click().catch(() => undefined); else await p.page.mouse.click(195, 420).catch(() => undefined);
    await sleep(350);
  }
  await toastGone(p);
}
async function backToTabs(p) {
  for (let i = 0; i < 4 && !(await p.page.locator('nav.tabbar').count()); i++) { await p.page.getByRole('button', { name: /Geri|Takıma dön/ }).first().click({ timeout: 3000 }).catch(() => undefined); await sleep(350); }
}
const syncTeam = (p) => p.page.evaluate(async () => { const e = window.__etkinlik; const t = await e.net().call('team.detail', {}); e.netStore.setState({ team: t.team }); });
async function newPlayer(bt, browser, name, slug, errors) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, hasTouch: true, ...(bt === 'chromium' ? { isMobile: true } : {}), locale: 'tr-TR', reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('odi-v1')) localStorage.setItem('odi-v1', JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true }, sounds: false }, version: 3 })); } catch { /* yok */ } });
  const page = await ctx.newPage();
  const p = { name, slug, ctx, page };
  page.on('pageerror', (e) => errors.push(`${slug}: ${e.message}`));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/favicon|AudioContext|WebGL|GPU|Autoplay|manifest|Failed to load resource|WebSocket connection/i.test(t)) errors.push(`${slug}: ${t.slice(0, 160)}`); });
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__etkinlik?.net()?.status === 'bağlı', null, { timeout: 25_000 });
  await net(p, 'profile.update', { name });
  await page.getByRole('button', { name: /Yola çık|Devam et/ }).click();
  for (let i = 0; i < 20 && !(await page.locator('nav.tabbar').count()); i++) {
    if (await page.locator('.onboard').count()) { await page.getByRole('textbox', { name: 'Takma ad' }).fill(name).catch(() => undefined); await page.getByRole('button', { name: 'Başla' }).click().catch(() => undefined); }
    await sleep(500);
  }
  await page.locator('nav.tabbar').waitFor({ timeout: 20_000 });
  await settle(p);
  if (await page.locator('.onboard').count()) { await page.getByRole('textbox', { name: 'Takma ad' }).fill(name).catch(() => undefined); await page.getByRole('button', { name: 'Başla' }).click().catch(() => undefined); }
  return p;
}
const PW_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const launch = (bt) => (bt === 'webkit' ? webkit : chromium).launch({ headless: true, executablePath: bt === 'chromium' ? process.env.PLAYWRIGHT_CHROMIUM || (existsSync(PW_CHROME) ? PW_CHROME : undefined) : undefined, args: bt === 'chromium' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] : [] });


/** tarayıcısız gerçek istemci (sunucuya doğrudan) */
function rawClient(name) {
  const ws = new WebSocket(wsUrl); let id = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.t === 'res') { const p = pend.get(m.id); pend.delete(m.id); if (!p) return; if (m.ok) p.res(m.data); else p.rej(new Error(`${m.code}: ${m.error}`)); } };
  const ready = new Promise((r) => { ws.onopen = r; });
  const call = async (op, data = {}) => { await ready; return new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ t: 'req', id: i, op, data })); }); };
  const hello = call('hello', { version: 1, name });
  cleanup.push(async () => ws.close());
  return { call: async (op, data) => { await hello; return call(op, data); }, close: () => ws.close() };
}
const runOf = (level) => ({ runId: `e2e${Date.now()}${Math.random().toString(36).slice(2, 8)}`, level, completed: true, stars: 3, score: 900, timeSec: 40, coins: 50, biome: 'dis-kulak', mechanic: 'kosu' });
const teamTabOnly = async (p) => { await closeBanners(p); await toastGone(p); await backToTabs(p); await p.page.locator('nav.tabbar .tab[data-tab="team"]').click(); await sleep(400); };
/** keşif listesinde takımı bul (filtre + arama) */
async function findInList(p, name, filter) {
  await teamTabOnly(p);
  await p.page.locator('.team-hero').waitFor({ timeout: 15_000 });
  if (filter) await p.page.locator(`.ta-filters [data-filter="${filter}"]`).click();
  await p.page.getByRole('searchbox', { name: 'Takım ara' }).fill(name);
  const row = p.page.locator(`[data-testid="takim-satiri"][data-name="${name}"]`);
  await row.waitFor({ timeout: 10_000 });
  return row;
}
async function createTeamUi(p, name, basvuru) {
  await teamTabOnly(p);
  await p.page.getByRole('button', { name: '＋ Takım kur' }).first().click();
  await p.page.locator('.sheet').getByPlaceholder('ör. Koklea Kaşifleri').fill(name);
  await p.page.locator('.sheet').getByPlaceholder('ör. Her gün biraz, hep birlikte.').fill('Her akşam birlikte koşuyoruz.');
  if (basvuru) await p.page.locator('.sheet [role="radiogroup"][aria-label="Katılım"]').getByRole('radio', { name: 'Başvuruyla' }).click();
  return p;
}

// ---------------------------------------------------------------- 4) web: lider, yardımcı, başvuranlar
async function webSuite(bt) {
  const S = makeSuite(`web-${bt}`);
  console.log(`\n▶ web · ${bt}`);
  const browser = await launch(bt);
  const errors = [];
  const k = bt === 'webkit' ? 'W' : 'K';
  const all = [];
  try {
    const A = await newPlayer(bt, browser, `Ayşe${k}`, 'ayse', errors);
    const Y = await newPlayer(bt, browser, `Yasin${k}`, 'yasin', errors);
    const B = await newPlayer(bt, browser, `Bora${k}`, 'bora', errors);
    const C = await newPlayer(bt, browser, `Cemre${k}`, 'cemre', errors);
    all.push(A, Y, B, C);
    const TN = `Kepçe ${k}${Date.now() % 1000}`;
    // A: Başvuruyla takım kur (arayüz)
    await createTeamUi(A, TN, true);
    await S.shot(A, 'takim-kur-basvuruyla');
    await A.page.locator('.sheet').getByRole('button', { name: /Takımı kur/ }).click();
    await A.page.locator('.team-head').waitFor({ timeout: 10_000 });
    await toastGone(A);
    await net(A, 'progress.submit', runOf(1)); // takım gücü > 0: Sıralama'da görünsün
    await A.page.getByLabel('Takım menüsü').click();
    const code = (await A.page.locator('.big-code').innerText()).trim();
    S.check(await A.page.locator('[data-testid="katilim-ayari"] [role="radio"][aria-checked="true"]').innerText() === 'Başvuruyla', 'takım menüsünde katılım: Başvuruyla');
    await S.shot(A, 'takim-menusu-katilim');
    await A.page.locator('.sheet').getByRole('button', { name: 'Kapat' }).click();
    // Y: davet koduyla doğrudan (başvuruyla takımda bile)
    await teamTabOnly(Y);
    await Y.page.getByLabel('Takım davet kodu').fill(code);
    await Y.page.locator('.code-join').getByRole('button', { name: 'Katıl' }).click();
    await Y.page.locator('.team-head').waitFor({ timeout: 10_000 });
    S.check(true, 'kod kısayolu: başvuruyla takıma doğrudan katıldı');
    const yId = (await net(Y, 'team.detail', {})).team.roster.find((m) => m.name === `Yasin${k}`).id;
    await net(A, 'team.role', { id: yId, role: 'yardimci' });
    await syncTeam(A); await syncTeam(Y);
    const team = (await net(A, 'team.detail', {})).team;

    // B: keşif listesinde (Başvuruyla filtresi + arama)
    const row = await findInList(B, TN, 'basvuru');
    S.check(await row.getByTestId('takim-katil').getAttribute('data-state') === 'basvur', 'listede “Başvur” düğmesi');
    S.check((await row.getByTestId('katilim-modu').innerText()).includes('Başvuruyla'), 'satırda katılım modu');
    await S.shot(B, 'kesif-listesi');
    // B: Sıralama › Takımlar › Takım gücü → takım profili
    await closeBanners(B); await B.page.locator('nav.tabbar .tab[data-tab="profile"]').click();
    await B.page.locator('.menu-tile[data-tile="ranking"]').click();
    await B.page.getByTestId('siralama').waitFor();
    await B.page.locator('.rank-kind button', { hasText: 'Takımlar' }).click();
    const rk = B.page.locator(`.rank[data-board="t-guc"] [data-id="${team.id}"], .rank[data-board="t-guc"] .podium .pd`).filter({ hasText: TN }).first();
    await rk.waitFor({ timeout: 10_000 });
    S.check(true, 'Sıralama › Takım gücü tablosunda');
    await rk.click();
    await B.page.getByTestId('takim-profili').waitFor({ timeout: 10_000 });
    S.check(await B.page.locator('.ta-roster li').count() === 2, 'profilde üyeler (lider + yardımcı)');
    await S.shot(B, 'siralamadan-takim-profili');
    await B.page.locator('[data-testid="takim-profili"] [data-testid="takim-katil"]').click();
    await B.page.getByTestId('basvuru-sayfasi').waitFor();
    await B.page.locator('.ta-note[data-note="hergun"]').click();
    await S.shot(B, 'basvuru-sayfasi');
    await B.page.getByTestId('basvuru-gonder').click();
    await B.page.locator('[data-testid="takim-profili"] [data-testid="takim-katil"][data-state="gonderildi"]').waitFor({ timeout: 10_000 });
    S.check(true, 'profilde “Başvuru gönderildi”');
    await B.page.keyboard.press('Escape'); await sleep(300);

    // A: rozet + Başvurular → kabul
    await A.page.locator('[data-testid="basvuru-rozeti"]').waitFor({ timeout: 10_000 });
    const tabDot = await A.page.locator('nav.tabbar .tab[data-tab="team"] .dot').innerText().catch(() => '0');
    S.check(Number(tabDot) >= 1, `Takım sekmesinde rozet (${tabDot})`);
    S.check((await A.page.getByTestId('basvuru-rozeti').innerText()).includes('1 yeni başvuru'), 'takım başlığında “1 yeni başvuru”');
    await S.shot(A, 'lider-rozet');
    await A.page.getByTestId('basvuru-rozeti').click();
    const card = A.page.locator(`[data-testid="basvuru"][data-player="Bora${k}"]`);
    await card.waitFor({ timeout: 10_000 });
    S.check((await card.innerText()).includes('Her gün oynuyorum.'), 'başvuru notu görünür');
    await S.shot(A, 'basvurular');
    await card.getByTestId('basvuru-kabul').click();
    await card.waitFor({ state: 'detached', timeout: 10_000 });
    await B.page.locator('.toast-top', { hasText: 'kabul edildin' }).waitFor({ timeout: 10_000 }).catch(() => undefined);
    await S.shot(B, 'kabul-bildirimi');
    await teamTabOnly(B);
    await B.page.locator('.team-head').waitFor({ timeout: 10_000 });
    S.check((await B.page.locator('.team-head h2').innerText()).trim() === TN, 'B takımda (takım ekranı)');
    await A.page.locator('.subtabs .subtab', { hasText: 'Sohbet' }).first().click();
    await A.page.locator('.chat .msg, .chat [data-testid="akis-karti"]', { hasText: `Bora${k} takıma katıldı` }).first().waitFor({ timeout: 10_000 });
    S.check(true, 'takım akışı: “Bora takıma katıldı”');
    await S.shot(A, 'akis-katildi');

    // C başvurur (arayüz, satır düğmesi) → yardımcı Y hazır gerekçeyle reddeder
    const rowC = await findInList(C, TN);
    await rowC.getByTestId('takim-katil').click();
    await C.page.getByTestId('basvuru-sayfasi').waitFor();
    await C.page.getByTestId('basvuru-gonder').click();
    await rowC.locator('[data-testid="takim-katil"][data-state="gonderildi"]').waitFor({ timeout: 10_000 });
    await C.page.getByTestId('basvurularim').waitFor();
    S.check(true, 'satırda “Başvuru gönderildi” ve Başvurularım kartı');
    await S.shot(C, 'basvurularim-bekliyor');
    await toastGone(Y);
    await Y.page.locator('[data-testid="basvuru-rozeti"]').waitFor({ timeout: 10_000 });
    S.check(true, 'yardımcıda da başvuru rozeti');
    await Y.page.getByTestId('basvuru-rozeti').click();
    const cardC = Y.page.locator(`[data-testid="basvuru"][data-player="Cemre${k}"]`);
    await cardC.waitFor({ timeout: 10_000 });
    await cardC.getByTestId('basvuru-ret').click();
    await Y.page.getByTestId('ret-gerekceleri').waitFor();
    await S.shot(Y, 'ret-gerekceleri');
    await Y.page.locator('[data-testid="ret-gerekceleri"] [data-reason="aktif"]').click();
    await cardC.waitFor({ state: 'detached', timeout: 10_000 });
    await C.page.locator('[data-testid="basvurularim"] [data-status="red"]').waitFor({ timeout: 10_000 });
    S.check((await C.page.getByTestId('basvurularim').innerText()).includes('daha sık oynayan'), 'C ret gerekçesini görür');
    await S.shot(C, 'basvurularim-red');
    S.check((await net(C, 'team.list', { query: TN })).teams[0].state === 'bekle', 'ret sonrası 24 saat bekleme');

    // D (tarayıcısız) başvurur → yardımcı Y kabul eder
    const D = rawClient(`Deniz${k}`);
    await D.call('team.apply', { teamId: team.id, noteId: 'savas' });
    const cardD = Y.page.locator(`[data-testid="basvuru"][data-player="Deniz${k}"]`);
    await cardD.waitFor({ timeout: 10_000 });
    await cardD.getByTestId('basvuru-kabul').click();
    await cardD.waitFor({ state: 'detached', timeout: 10_000 });
    const dTeam = (await D.call('team.detail', {})).team;
    S.check(dTeam?.id === team.id, 'yardımcı kabul etti: D takımda');
    const hist = (await net(A, 'chat.join', { room: `takim:${team.id}` })).history.map((m) => m.text);
    S.check(hist.includes(`Yasin${k}, Deniz${k} adlı oyuncunun başvurusunu kabul etti.`), 'karar veren takım sohbetinde yazılı');

    // C: açık takıma "Doğrudan katıl" filtresinden tek dokunuşla
    const F = rawClient(`Fulya${k}`);
    const ON = `Açık Kulak ${k}${Date.now() % 1000}`;
    await F.call('team.create', { name: ON, emblem: '🎧' });
    const rowO = await findInList(C, ON, 'acik');
    S.check(await rowO.getByTestId('takim-katil').getAttribute('data-state') === 'katil', 'açık takımda “Katıl”');
    await S.shot(C, 'dogrudan-katil-filtresi');
    await rowO.getByTestId('takim-katil').click();
    await C.page.locator('.team-head').waitFor({ timeout: 10_000 });
    S.check((await C.page.locator('.team-head h2').innerText()).trim() === ON, 'C açık takıma doğrudan katıldı');
    await S.shot(C, 'acik-takimda');
  } catch (e) {
    failures++; S.rec.fails.push(String(e.message ?? e).split('\n')[0]); log(`✗ akış: ${String(e.message ?? e).split('\n')[0]}`);
    for (const p of all) await p.page.screenshot({ path: resolve(outRoot, `web-${bt}`, `hata-${p.slug}.png`) }).catch(() => undefined);
  } finally {
    if (errors.length) { failures++; S.rec.fails.push(`konsol: ${errors.slice(0, 3).join(' | ')}`); log(`✗ konsol: ${errors.slice(0, 3).join(' | ')}`); }
    await browser.close(); saveProgress();
  }
}

// ---------------------------------------------------------------- 5) dom: telefon paketi başvuran
async function domSuite(bt) {
  const S = makeSuite(`dom-${bt}`);
  console.log(`\n▶ dom · ${bt}`);
  const browser = await launch(bt);
  const errors = [];
  let T = null; let L = null;
  try {
    L = await newPlayer(bt, browser, 'Webli Lider', 'lider', errors);
    const TN = `Telefon Kepçe ${bt.slice(0, 2)}`;
    const team = (await net(L, 'team.create', { name: TN, emblem: '🐚', open: false })).team;
    await syncTeam(L);
    const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, hasTouch: true, ...(bt === 'chromium' ? { isMobile: true } : {}), locale: 'tr-TR', reducedMotion: 'reduce' });
    await ctx.addInitScript(domBridge, [wsUrl, 47, 34]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`tel: ${e.message}`));
    T = { slug: 'telefon', page, ctx };
    await page.goto(domHtml, { waitUntil: 'load' });
    await page.getByRole('button', { name: /Yola çık|Devam et/ }).click({ timeout: 45_000 });
    await page.locator('.onboard').waitFor({ timeout: 15_000 });
    await page.getByRole('textbox', { name: 'Takma ad' }).fill('Telefoncu');
    await page.getByRole('button', { name: 'Başla' }).click();
    await page.locator('.onboard').waitFor({ state: 'detached' });
    await toastGone(T);
    const row = await findInList(T, TN, 'basvuru');
    await S.shot(T, 'kesif-listesi');
    await row.locator('.tr-main').click();
    await page.getByTestId('takim-profili').waitFor({ timeout: 10_000 });
    await S.shot(T, 'takim-profili');
    await page.locator('[data-testid="takim-profili"] [data-testid="takim-katil"]').click();
    await page.getByTestId('basvuru-sayfasi').waitFor();
    S.check(await page.locator('.ta-free-note').count() === 1, 'telefonda serbest not kilitli (8 bölüm kuralı)');
    await page.getByTestId('basvuru-gonder').click();
    await page.locator('[data-testid="takim-profili"] [data-testid="takim-katil"][data-state="gonderildi"]').waitFor({ timeout: 10_000 });
    S.check(true, 'telefondan başvuru gönderildi');
    await page.keyboard.press('Escape'); await sleep(300);
    await S.shot(T, 'basvurularim');
    await teamTabOnly(L);
    await L.page.locator('[data-testid="basvuru-rozeti"]').waitFor({ timeout: 10_000 });
    S.check(true, 'web liderinde başvuru rozeti');
    await L.page.getByTestId('basvuru-rozeti').click();
    await L.page.locator('[data-testid="basvuru"][data-player="Telefoncu"] [data-testid="basvuru-kabul"]').click();
    await page.locator('.team-head').waitFor({ timeout: 15_000 });
    S.check((await page.locator('.team-head h2').innerText()).trim() === TN, 'telefon takım ekranına geçti (kabul edildi)');
    await S.shot(T, 'takimda');
    S.check((await net(L, 'team.detail', {})).team.members === 2 && team.id.length > 0, 'web liderinde 2 üye');
    await ctx.close();
  } catch (e) {
    failures++; S.rec.fails.push(String(e.message ?? e).split('\n')[0]); log(`✗ akış: ${String(e.message ?? e).split('\n')[0]}`);
    for (const p of [T, L].filter(Boolean)) await p.page.screenshot({ path: resolve(outRoot, `dom-${bt}`, `hata-${p.slug}.png`) }).catch(() => undefined);
  } finally {
    if (errors.length) { failures++; S.rec.fails.push(`konsol: ${errors.slice(0, 3).join(' | ')}`); log(`✗ konsol: ${errors.slice(0, 3).join(' | ')}`); }
    await browser.close(); saveProgress();
  }
}

try {
  for (const t of targets) for (const b of browsers) { if (t === 'web') await webSuite(b); else if (b === browsers[0]) await domSuite(b); }
} catch (e) {
  // paket dışı hata (ör. tarayıcı açılamadı) sessizce "geçti" sayılmasın
  failures++; console.log(`✗ ${String(e?.message ?? e).split('\n')[0]}`);
} finally {
  console.log('\n— özet —');
  for (const r of results) console.log(`  ${r.fails.length ? '✗' : '✓'} ${r.label}: ${r.checks} denetim${r.fails.length ? `, sorunlar: ${r.fails.join(' ; ')}` : ''}`);
  console.log(failures ? `\n✗ ${failures} sorun` : '\n✓ takım başvurusu uçtan uca testi geçti');
  await done(failures ? 1 : 0);
}
