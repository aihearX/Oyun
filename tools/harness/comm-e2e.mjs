#!/usr/bin/env node
// ODİ iletişim uçtan uca testi (docs/13-iletisim.md): gerçek sunucu (ODI_DB=:memory:, ODI_EVENTS_FAST=1 → Günün Sorusu 45 sn'de
// açıklanır) + web test derlemesi (VITE_ODI_E2E=1: window.__etkinlik.net() ile kurulum çağrıları) + üç gerçek tarayıcı oyuncusu.
// Akış (her tarayıcıda): Takım Akışı kartı → tepki + "Tebrik et" (konu) → @bahsetme bildirimi → güvenli varsayılan (serbest yazı kapalı
//   → aç) → sonuç ekranında "Takımdan yardım iste" → yardım kartı: ipucu + kalkan + birlikte yarış daveti → isteyen geçer → teşekkür
//   şeridi + "Rica ederim" + ödül → Usta–Çırak teklifi/kabul → dönüm noktası → "Tebrik et" (özel mesaj) → İkili Görev daveti/kabul
//   → ortak notalar → sandık → özel mesajda hazır söz → yarış lobisinde hazır söz → Günün Sorusu cevap → açıklama + haftalık tablo.
// dom hedefi: Expo DOM telefon paketi (apps/mobile/dist/www.bundle) bir oyuncu olarak takıma kodla katılır, akış kartına tepki verir,
//   tebrik eder ve Günün Sorusu'nu cevaplar (gerçek WebApp köprüsü + yerel scrollEnabled:false kilidi taklidi).
// Kullanım: node tools/harness/comm-e2e.mjs [--browsers chromium,webkit] [--target web|dom|both] [--no-build] [--build-dom] [--headed]
// Çıktı: tools/harness/out/iletisim/<hedef>-<tarayıcı>/NN-oyuncu-ad.png
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, webkit } from 'playwright';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '1'; };
const has = (k) => argv.includes(`--${k}`);
const root = resolve(new URL('../..', import.meta.url).pathname);
const webRoot = resolve(root, 'apps/web');
const outRoot = resolve(root, 'tools/harness/out/iletisim'); mkdirSync(outRoot, { recursive: true });
const distDir = resolve(outRoot, 'dist');
const browsers = opt('browsers', 'chromium,webkit').split(',');
const targets = opt('target', 'both') === 'both' ? ['web', 'dom'] : [opt('target')];
const VW = 390, VH = 844;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => console.log(`  ${m}`);
const cleanup = [];
let failures = 0;
const results = [];
async function done(code) { for (const f of cleanup.reverse()) { try { await f(); } catch { /* yok */ } } process.exit(code); }
process.on('SIGINT', () => void done(130));
const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const run = (cmd, a, o = {}) => new Promise((res, rej) => { const p = spawn(cmd, a, { cwd: root, stdio: 'inherit', ...o }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${a.join(' ')} → ${c}`)))); });

// ---------------------------------------------------------------- 1) sunucu
if (!has('no-build') || !existsSync(resolve(root, 'apps/server/dist/server.mjs'))) await run('npm', ['run', 'build:server', '--silent']);
const srvPort = await freePort();
const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'apps/server/dist/server.mjs'], {
  cwd: root, env: { ...process.env, PORT: String(srvPort), HOST: '127.0.0.1', ODI_DB: ':memory:', ODI_EVENTS_FAST: '1', ODI_TEST_STORE: '1', ODI_LOG: '0', ODI_FREE_TEXT_AT: '3' /* güvenli sohbet eşiği testte 3 bölüm: Ayşe/Bora yazar, Cem önce yalnız hazır söz */ }, stdio: ['ignore', 'pipe', 'inherit'],
});
cleanup.push(async () => { server.kill(); });
await new Promise((res, rej) => { server.stdout.on('data', (d) => { if (String(d).includes('hazır')) res(); }); server.on('exit', (c) => rej(new Error('sunucu kapandı ' + c))); setTimeout(() => rej(new Error('sunucu başlamadı')), 15_000); });
const wsUrl = `ws://127.0.0.1:${srvPort}`;
log(`sunucu hazır: ${wsUrl} (ODI_EVENTS_FAST=1)`);

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

/** dom hedefi: Expo DOM köprüsü + yerel scrollEnabled:false kilidi (ui-mobile-check.mjs ile aynı) */
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
    dir, rec,
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
const tid = (p, id) => p.page.getByTestId(id);
const runOf = (level, over = {}) => ({ runId: `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, level, completed: true, stars: 3, score: 1200, timeSec: 60, coins: 80, biome: 'dis-kulak', mechanic: 'kosu', ...over });
async function climb(p, from, to, over = {}) { for (let l = from; l < to; l++) await net(p, 'progress.submit', runOf(l, over)); }
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
  for (let i = 0; i < 4 && !(await p.page.locator('nav.tabbar').count()); i++) { await p.page.getByRole('button', { name: 'Geri' }).first().click({ timeout: 3000 }).catch(() => undefined); await sleep(350); }
}
async function teamChat(p) {
  await closeBanners(p);
  await backToTabs(p);
  await p.page.locator('nav.tabbar .tab[data-tab="team"]').click();
  await p.page.locator('.team-head').waitFor({ timeout: 15_000 });
  await p.page.locator('.subtabs .subtab', { hasText: 'Sohbet' }).first().click();
  await p.page.locator('.chat-box').waitFor();
  await sleep(500);
}
async function scrollTo(p, sel) { await p.page.locator(sel).last().scrollIntoViewIfNeeded().catch(() => undefined); await sleep(250); }
const syncTeam = (p) => p.page.evaluate(async () => { const e = window.__etkinlik; const t = await e.net().call('team.detail', {}); e.netStore.setState({ team: t.team }); });

async function newPlayer(bt, browser, name, slug, errors) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, hasTouch: true, ...(bt === 'chromium' ? { isMobile: true } : {}), locale: 'tr-TR', reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('odi-v1')) localStorage.setItem('odi-v1', JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true } }, version: 3 })); } catch { /* yok */ } });
  const page = await ctx.newPage();
  const p = { name, slug, ctx, page };
  page.on('pageerror', (e) => errors.push(`${slug}: ${e.message}`));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/favicon|AudioContext|WebGL|GPU|Autoplay|manifest|Failed to load resource|WebSocket connection/i.test(t)) errors.push(`${slug}: ${t.slice(0, 160)}`); });
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__etkinlik?.net()?.status === 'bağlı', null, { timeout: 25_000 });
  await net(p, 'profile.update', { name });
  await page.getByRole('button', { name: /Yola çık|Devam et/ }).click();
  await page.locator('nav.tabbar').waitFor({ timeout: 20_000 });
  await settle(p);
  // takma ad sayfası (ilk bağlantı) açıldıysa kapat: ad sunucuda zaten ayarlı
  if (await page.locator('.onboard').count()) { await page.getByRole('textbox', { name: 'Takma ad' }).fill(name).catch(() => undefined); await page.getByRole('button', { name: 'Başla' }).click().catch(() => undefined); }
  await page.locator('nav.tabbar .tab[data-tab="profile"]').click();
  return p;
}

// ---------------------------------------------------------------- 4) web akışı
async function webSuite(bt) {
  const S = makeSuite(`web-${bt}`);
  console.log(`\n▶ web · ${bt}`);
  const browser = await (bt === 'webkit' ? webkit : chromium).launch({ headless: !has('headed'), executablePath: bt === 'chromium' ? process.env.PLAYWRIGHT_CHROMIUM || undefined : undefined,
    args: bt === 'chromium' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] : [] });
  const errors = [];
  try {
    const tag = bt.slice(0, 2).toUpperCase();
    const A = await newPlayer(bt, browser, 'Ayşe', 'ayse', errors);
    const B = await newPlayer(bt, browser, 'Bora', 'bora', errors);
    const C = await newPlayer(bt, browser, 'Cem', 'cem', errors);
    log('üç oyuncu bağlandı');
    // kurulum (sunucu çağrıları; asıl akışlar aşağıda arayüzden)
    const team = (await net(A, 'team.create', { name: `Koklea Kaşifleri ${tag}`, emblem: '🐚', description: 'Kulaktan beyne, hep birlikte.' })).team;
    await net(B, 'team.join', { code: team.code }); await net(C, 'team.join', { code: team.code });
    for (const p of [A, B, C]) await syncTeam(p);
    const code = async (p) => p.page.evaluate(() => window.__etkinlik.net().me.friendCode);
    await net(A, 'friends.add', { code: await code(B) }); await net(B, 'friends.add', { code: await code(A) });
    await climb(A, 1, 11, { coins: 30 }); // Ayşe usta olur (10 bölüm), akışa birleşen tek kart düşer
    await climb(B, 1, 4, { coins: 20 });
    await net(C, 'progress.submit', runOf(1, { coins: 10 })); // Cem yeni başlıyor (2. bölümde)

    // ---- Günün Sorusu (takım sohbetine ilk girişte Tüy Dede bırakır): iki kişi cevaplar, doğru şık gizli
    await teamChat(A);
    const qA0 = A.page.locator('[data-testid="gunun-sorusu"]').first();
    await qA0.waitFor({ timeout: 10_000 });
    await scrollTo(A, '[data-testid="gunun-sorusu"]');
    await S.shot(A, 'gunun-sorusu');
    await qA0.locator('.dq-opt[data-choice="0"]').click();
    await qA0.locator('.dq-opt.picked').waitFor({ timeout: 8000 });
    await teamChat(C);
    const qC = C.page.locator('[data-testid="gunun-sorusu"]').first();
    await qC.locator('.dq-opt[data-choice="1"]').click();
    await qA0.locator('.dq-wait', { hasText: '2 kişi cevapladı' }).waitFor({ timeout: 8000 });
    S.check(true, 'cevap sayısı canlı güncellendi (doğru şık gizli)');
    await scrollTo(A, '[data-testid="gunun-sorusu"]');
    await S.shot(A, 'gunun-sorusu-cevaplandi');
    await qA0.getByTestId('tartis').click();
    await A.page.getByTestId('konu-sayfasi').waitFor();
    await A.page.locator('.sheet .th-input input').fill('Bence koklea ile ilgili; siz ne dersiniz?');
    await A.page.locator('.sheet .th-input button[type="submit"]').click();
    await A.page.locator('.sheet .th-list .th-text', { hasText: 'Bence koklea' }).waitFor({ timeout: 8000 });
    S.check(true, 'tartışma konusu (serbest yazı)');
    await A.page.locator('.sheet').getByRole('button', { name: 'Kapat' }).click();
    // ---- Takım Akışı: kart + tepki + Tebrik et
    await teamChat(B);
    const card = B.page.locator('[data-testid="akis-karti"][data-type="bolum"]').filter({ hasText: 'Ayşe' }).first();
    await card.waitFor({ timeout: 10_000 });
    S.check((await card.innerText()).includes('10 bölümde ilerledi (1–10)'), 'akış kartı birleşti: “Ayşe 10 bölümde ilerledi (1–10)”');
    await scrollTo(B, '[data-testid="akis-karti"][data-type="bolum"]');
    await S.shot(B, 'akis-karti');
    await teamChat(A);
    await card.locator('[data-reaction="alkis"]').click();
    const aCard = A.page.locator('[data-testid="akis-karti"][data-type="bolum"]').first();
    await aCard.locator('[data-reaction="alkis"] .rc', { hasText: '1' }).waitFor({ timeout: 8000 });
    S.check(true, 'Bora’nın alkışı Ayşe’ye ulaştı (gerçek zamanlı)');
    await card.getByTestId('tebrik-et').click();
    await aCard.locator('.thread .th-text', { hasText: 'Tebrikler!' }).waitFor({ timeout: 8000 });
    S.check(true, '“Tebrik et” kartın konusuna yazıldı');
    await sleep(1300);
    await C.page.evaluate(() => 0);
    await teamChat(C);
    const cCard = C.page.locator('[data-testid="akis-karti"][data-type="bolum"]').first();
    await cCard.locator('[data-reaction="kalp"]').click();
    await aCard.locator('[data-reaction="kalp"] .rc', { hasText: '1' }).waitFor({ timeout: 8000 });
    await scrollTo(A, '[data-testid="akis-karti"][data-type="bolum"]');
    await S.shot(A, 'akis-tepki-tebrik');
    // konu sayfası
    await aCard.getByRole('button', { name: 'Yanıtla' }).click();
    await A.page.getByTestId('konu-sayfasi').waitFor();
    await S.shot(A, 'konu-sayfasi');
    await A.page.locator('.sheet').getByRole('button', { name: 'Kapat' }).click();

    // ---- @bahsetme (Ayşe başka sekmede)
    await A.page.locator('nav.tabbar .tab[data-tab="profile"]').click(); await sleep(400);
    await B.page.getByRole('textbox', { name: 'Mesaj' }).fill('@Ay');
    await B.page.locator('.at-suggest button', { hasText: '@Ayşe' }).waitFor({ timeout: 4000 });
    await S.shot(B, 'bahsetme-oneri');
    await B.page.locator('.at-suggest button', { hasText: '@Ayşe' }).click();
    await B.page.getByRole('textbox', { name: 'Mesaj' }).type('bu akşam baskına var mısın?');
    await B.page.getByRole('button', { name: 'Gönder', exact: true }).click();
    const mention = A.page.locator('[data-testid="iletisim-bildirimi"][data-kind="mention"]');
    await mention.waitFor({ timeout: 8000 });
    S.check((await mention.innerText()).includes('Bora senden bahsetti'), 'bahsetme bildirimi geldi');
    S.check(await A.page.locator('nav.tabbar .tab[data-tab="team"] .dot').count() > 0, 'Takım sekmesinde rozet');
    await S.shot(A, 'bahsetme-bildirimi');
    await mention.locator('[data-act="bak"]').click();
    await A.page.locator('.subtabs .subtab', { hasText: 'Sohbet' }).first().click();
    await A.page.locator('.msg.mentioned').last().waitFor({ timeout: 8000 });
    await S.shot(A, 'bahsetme-vurgu');

    // ---- güvenli sohbet ZORUNLU: Cem (1 bölüm) yalnız hazır söz/emoji; açma seçeneği yok, dürüst not
    await C.page.locator('.chat-input input[readonly]').waitFor({ timeout: 8000 });
    S.check(await C.page.locator('.quick-line .phrase-row').count() === 1, 'yeni oyuncu: hazır sözler açık, serbest yazı kapalı');
    S.check((await C.page.getByRole('textbox', { name: 'Mesaj' }).getAttribute('placeholder')).includes('3. bölümden sonra açılır'), 'giriş kutusunda dürüst not: “Serbest yazı N. bölümden sonra açılır”');
    await S.shot(C, 'guvenli-hazir-sozler');
    await C.page.locator('.quick-line .phrase[data-phrase="selam"]').click();
    await B.page.locator('.msg.preset .bubble', { hasText: 'Selam!' }).last().waitFor({ timeout: 8000 });
    S.check(true, 'hazır söz gönderildi (Selam!)');
    await C.page.getByRole('textbox', { name: 'Mesaj' }).click();
    await C.page.getByTestId('serbest-not').waitFor();
    S.check(!(await C.page.getByTestId('serbest-ac').count()) && /3\. bölümden sonra açılır/.test(await C.page.getByTestId('serbest-not').innerText()), 'açma seçeneği yok: yalnız açıklama ve kurallar');
    await S.shot(C, 'guvenli-sohbet-notu');
    await C.page.getByTestId('guvenli-tamam').click();
    S.check(await C.page.evaluate(async () => { try { await window.__etkinlik.net().call('chat.send', { room: `takim:${window.__etkinlik.netStore.getState().team.id}`, text: 'deneme' }); return false; } catch (e) { return e.code === 'SERBEST_KAPALI'; } }), 'sunucu da serbest yazıyı reddeder (SERBEST_KAPALI)');
    await toastGone(C);

    // ---- Yardım İste: sonuç ekranında (3 başarısızlık) → kart → ipucu / kalkan / birlikte yarış
    await C.page.evaluate(() => { const raw = JSON.parse(localStorage.getItem('odi-v1') ?? '{}'); raw.state = { ...(raw.state ?? {}), failStreak: 3 }; localStorage.setItem('odi-v1', JSON.stringify(raw)); });
    await C.page.goto(`${base}&demo=sonuc&yildiz=0&skor=310&bolum=2&kutlama=0`, { waitUntil: 'load' });
    await C.page.waitForFunction(() => window.__etkinlik?.net()?.status === 'bağlı', null, { timeout: 25_000 });
    await syncTeam(C);
    await C.page.locator('.result-title').click().catch(() => undefined);
    await tid(C, 'yardim-iste').waitFor({ timeout: 15_000 });
    await tid(C, 'yardim-iste').scrollIntoViewIfNeeded();
    await S.shot(C, 'sonuc-yardim-iste');
    await tid(C, 'yardim-iste-dugme').click();
    await tid(C, 'yardim-iste').locator('b', { hasText: 'Yardım istedin' }).waitFor({ timeout: 8000 });
    S.check(true, 'sonuç ekranından takımdan yardım istendi');
    const help = B.page.locator('[data-testid="yardim-karti"]').last();
    await help.waitFor({ timeout: 8000 });
    await scrollTo(B, '[data-testid="yardim-karti"]');
    await S.shot(B, 'yardim-karti');
    await help.getByTestId('ipucu-ver').click();
    await B.page.locator('.tip-opt[data-phrase="ipucu-bas"]').waitFor();
    await S.shot(B, 'ipucu-sec');
    await B.page.locator('.tip-opt[data-phrase="ipucu-bas"]').click();
    await help.locator('.thread .th-text', { hasText: 'uzun zıplamak' }).waitFor({ timeout: 8000 });
    S.check(true, 'ipucu kartın konusunda');
    await teamChat(A);
    const aHelp = A.page.locator('[data-testid="yardim-karti"]').last();
    await aHelp.getByTestId('kalkan-gonder').click();
    await aHelp.locator('.fc-help-stats', { hasText: '1 kalkan' }).waitFor({ timeout: 8000 });
    S.check(true, 'kalkan gönderildi, kart sayacı güncellendi');
    // birlikte yarış: Bora oda kurar, Cem'e davet gider
    await C.page.goto(base, { waitUntil: 'load' });
    await C.page.waitForFunction(() => window.__etkinlik?.net()?.status === 'bağlı', null, { timeout: 25_000 });
    await C.page.getByRole('button', { name: /Yola çık|Devam et/ }).click(); await C.page.locator('nav.tabbar').waitFor(); await settle(C);
    await toastGone(B);
    await help.getByTestId('birlikte-yaris').click();
    await B.page.getByTestId('yaris-sohbet').waitFor({ timeout: 10_000 });
    const invite = C.page.getByTestId('yaris-davet-karti');
    const gotInvite = await invite.waitFor({ timeout: 8000 }).then(() => true, () => false);
    S.check(gotInvite, 'isteyene “birlikte yarış” daveti geldi');
    await B.page.locator('[data-testid="yaris-sohbet"] .phrase[data-phrase="iyi-sans"]').click();
    await B.page.locator('[data-testid="yaris-sohbet"] .race-msg', { hasText: 'İyi şanslar!' }).waitFor({ timeout: 8000 });
    S.check(true, 'yarış lobisinde hazır söz');
    await S.shot(B, 'yaris-lobisi-hazir-soz');
    if (gotInvite) await S.shot(C, 'yaris-daveti');
    await net(B, 'race.leave', {});
    await B.page.goto(base, { waitUntil: 'load' }); await B.page.waitForFunction(() => window.__etkinlik?.net()?.status === 'bağlı', null, { timeout: 25_000 });
    await B.page.getByRole('button', { name: /Yola çık|Devam et/ }).click(); await B.page.locator('nav.tabbar').waitFor(); await settle(B);
    await teamChat(B);
    // Cem bölümü geçer → istek çözülür: teşekkür + ödül
    await closeBanners(C);
    await net(C, 'progress.submit', runOf(2, { coins: 40 }));
    const thanks = B.page.locator('[data-testid="iletisim-bildirimi"][data-kind="thanks"]');
    await thanks.waitFor({ timeout: 8000 });
    S.check((await thanks.innerText()).includes('Cem 2. bölümü geçti'), 'yardım edene teşekkür şeridi');
    await S.shot(B, 'tesekkur-seridi');
    await thanks.locator('[data-act="rica"]').click();
    const bHelp = B.page.locator('[data-testid="yardim-karti"][data-done="1"]').last();
    await bHelp.waitFor({ timeout: 8000 });
    await bHelp.locator('.thread .th-text', { hasText: 'Rica ederim' }).waitFor({ timeout: 8000 });
    S.check(true, '“Rica ederim” kartın konusunda; kart “geçildi”');
    const yardimCard = B.page.locator('[data-testid="akis-karti"][data-type="yardim"]').last();
    await yardimCard.waitFor({ timeout: 8000 });
    await scrollTo(B, '[data-testid="akis-karti"][data-type="yardim"]');
    await S.shot(B, 'yardimla-gecti-karti');
    const inboxB = (await net(B, 'inbox.list', {})).items.filter((i) => i.ref === 'yardim').reduce((a, i) => a + i.amount, 0);
    const inboxC = (await net(C, 'inbox.list', {})).items.filter((i) => i.ref === 'yardim').reduce((a, i) => a + i.amount, 0);
    S.check(inboxB === 20 && inboxC === 15, `ödüller bir kez: yardım eden 20, isteyen 15 (${inboxB}/${inboxC})`);

    // ---- Usta–Çırak: Ayşe (11. bölüm) Cem'e (3. bölüm) teklif eder
    await closeBanners(A);
    await A.page.locator('nav.tabbar .tab[data-tab="profile"]').click();
    await A.page.locator('.menu-tile[data-tile="together"]').click();
    await tid(A, 'usta-cirak').waitFor({ timeout: 10_000 });
    await A.page.locator('[data-testid="usta-aday"]', { hasText: 'Cem' }).getByTestId('usta-teklif-et').click();
    const offer = C.page.locator('[data-testid="iletisim-bildirimi"][data-kind="mentor"]');
    await offer.waitFor({ timeout: 8000 });
    S.check((await offer.innerText()).includes('Ayşe sana usta olmak istiyor'), 'çırağa teklif bildirimi');
    await S.shot(C, 'usta-teklif-bildirimi');
    await offer.locator('[data-act="bak"]').click();
    await tid(C, 'usta-teklif').waitFor({ timeout: 8000 });
    await S.shot(C, 'birlikte-teklif');
    await tid(C, 'usta-kabul').click();
    await tid(C, 'ustam').waitFor({ timeout: 8000 });
    S.check(true, 'Usta–Çırak bağı kuruldu');
    await toastGone(C);
    await S.shot(C, 'birlikte-ustam');
    await net(C, 'progress.submit', runOf(3)); await net(C, 'progress.submit', runOf(4));
    // Cem artık eşiği (testte 3 bölüm) geçti: Birlikte › Sohbet ayarları'nda serbest yazı kendiliğinden açık
    await C.page.getByTestId('serbest-durum').scrollIntoViewIfNeeded().catch(() => undefined);
    await C.page.getByTestId('serbest-durum').locator('.pill', { hasText: 'Açık' }).waitFor({ timeout: 8000 });
    S.check(true, 'eşik bölüm geçilince serbest yazı kendiliğinden açıldı');
    const ms = A.page.locator('[data-testid="iletisim-bildirimi"][data-kind="mentor"]');
    await ms.waitFor({ timeout: 8000 });
    S.check((await ms.innerText()).includes('Çırağın Cem 5. bölüme ulaştı'), 'ustaya dönüm noktası dürtmesi');
    await S.shot(A, 'cirak-donum-noktasi');
    await ms.locator('[data-act="tebrik"]').click();
    const dmOk = await C.page.locator('[data-testid="mesaj-bildirimi"]').waitFor({ timeout: 8000 }).then(() => true, () => false);
    S.check(dmOk, 'tek dokunuş “Tebrikler!” özel mesajı çırağa ulaştı');
    await A.page.locator('[data-testid="cirak"] .mentor-step.on').first().waitFor({ timeout: 8000 });
    await S.shot(A, 'birlikte-cirak');
    const mA = (await net(A, 'inbox.list', {})).items.filter((i) => i.ref === 'usta-cirak');
    S.check(mA.some((i) => i.kind === 'jeton' && i.amount === 30) && mA.some((i) => i.kind === 'kristal' && i.amount === 5), 'usta ödülü ödül kutusunda');

    // ---- İkili Görev: Bora → Ayşe
    await closeBanners(B);
    await B.page.locator('nav.tabbar .tab[data-tab="profile"]').click();
    await B.page.locator('.menu-tile[data-tile="together"]').click();
    await tid(B, 'ikili-gorev').waitFor({ timeout: 10_000 });
    await S.shot(B, 'ikili-davet-et');
    await B.page.locator('[data-testid="ikili-aday"]', { hasText: 'Ayşe' }).getByTestId('ikili-davet-et').click();
    const duoN = A.page.locator('[data-testid="iletisim-bildirimi"][data-kind="duo"]');
    await duoN.waitFor({ timeout: 8000 });
    await closeBanners(A);
    await A.page.getByRole('button', { name: 'Geri' }).first().click().catch(() => undefined);
    await A.page.locator('.menu-tile[data-tile="together"]').click();
    await tid(A, 'ikili-davet').getByRole('button', { name: 'Kabul' }).click();
    await A.page.locator('[data-testid="ikili-gorev"] .duo-pair').waitFor({ timeout: 8000 });
    S.check(true, 'İkili Görev kabul edildi');
    await B.page.locator('[data-testid="ikili-gorev"] .duo-pair').waitFor({ timeout: 8000 });
    await net(A, 'progress.submit', runOf(11, { coins: 180 })); await net(B, 'progress.submit', runOf(4, { coins: 160 }));
    await B.page.locator('[data-testid="ikili-kademe-0"][data-reached="1"]').waitFor({ timeout: 8000 });
    S.check(true, 'ortak notalar 300’ü geçti: sandık açıldı (ikisine de)');
    await toastGone(B); await closeBanners(B);
    await S.shot(B, 'ikili-gorev-sandik');
    const duoInbox = (await net(A, 'inbox.list', {})).items.filter((i) => i.ref === 'ikili');
    S.check(duoInbox.length === 2, 'İkili Görev ödülü Ayşe’nin kutusunda');

    // ---- özel mesajda hazır söz
    await net(A, 'dm.send', { to: (await B.page.evaluate(() => window.__etkinlik.net().me.id)), text: 'selam', kind: 'hazir' });
    await B.page.getByRole('button', { name: 'Geri' }).first().click().catch(() => undefined);
    await B.page.locator('.menu-tile[data-tile="messages"]').click();
    await B.page.locator('[data-testid="sohbet-satiri"]', { hasText: 'Ayşe' }).first().click({ timeout: 8000 });
    await tid(B, 'dm-ekrani').waitFor({ timeout: 8000 });
    await B.page.getByRole('button', { name: 'Emoji ve çıkartmalar' }).click();
    await B.page.locator('.dm-panel-tabs button', { hasText: 'Hazır sözler' }).click();
    await S.shot(B, 'dm-hazir-sozler');
    await B.page.locator('.dm-phrases .phrase[data-phrase="birlikte"]').click();
    await B.page.locator('[data-testid="dm-mesaj"]', { hasText: 'Birlikte oynayalım mı?' }).waitFor({ timeout: 8000 });
    S.check(true, 'özel mesajda hazır söz gönderildi');

    // ---- Günün Sorusu: açıklama (hızlı modda soru açıldıktan 45 sn sonra) → haftalık tablo
    await teamChat(A);
    await A.page.locator('[data-testid="gunun-sorusu"]').first().waitFor({ timeout: 10_000 });
    log('Günün Sorusu açıklaması bekleniyor (en çok 60 sn)…');
    await A.page.locator('[data-testid="gunun-sorusu"][data-rev="1"]').first().waitFor({ timeout: 70_000 });
    await scrollTo(A, '[data-testid="gunun-sorusu"]');
    S.check(await A.page.locator('[data-testid="gunun-sorusu"][data-rev="1"] .dq-opt.ok').count() === 1, 'açıklama: doğru şık ve açıklama görünür');
    await S.shot(A, 'gunun-sorusu-aciklandi');
    await A.page.locator('[data-testid="gunun-sorusu"] .fc-reply', { hasText: 'Haftalık tablo' }).first().click();
    await A.page.locator('.dq-board li').first().waitFor({ timeout: 8000 });
    await S.shot(A, 'haftalik-tablo');
    await A.page.locator('.sheet').getByRole('button', { name: 'Kapat' }).click();

    // ---- son genel görünüm (takım sohbeti, Kim çevrimiçi)
    await teamChat(B);
    S.check(await B.page.getByTestId('kim-cevrimici').innerText().then((t) => /2 çevrimiçi/.test(t)), 'Kim çevrimiçi: 2 takım arkadaşı');
    await S.shot(B, 'takim-sohbeti-genel');
    for (const p of [A, B, C]) await p.ctx.close();
  } catch (e) {
    failures++; S.rec.fails.push(String(e.message ?? e).split('\n')[0]); log(`✗ akış: ${String(e.message ?? e).split('\n')[0]}`);
  } finally {
    if (errors.length) { failures++; S.rec.fails.push(`konsol: ${errors.slice(0, 3).join(' | ')}`); log(`✗ konsol: ${errors.slice(0, 3).join(' | ')}`); }
    await browser.close();
  }
}

// ---------------------------------------------------------------- 4b) FTUE: yeni iletişim yerleri Tüy Dede turuyla açılır
const BASE_TOURS = ['result1', 'map', 'today', 'camp', 'camp-build', 'friends', 'glossary', 'team', 'shop', 'events', 'race'];
const ALL_OLD_TOURS = [...BASE_TOURS, 'siralama'];
async function tourSuite(bt) {
  const S = makeSuite(`tur-${bt}`);
  console.log(`\n▶ tur · ${bt}`);
  const browser = await (bt === 'webkit' ? webkit : chromium).launch({ headless: true, executablePath: bt === 'chromium' ? process.env.PLAYWRIGHT_CHROMIUM || undefined : undefined, args: bt === 'chromium' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] : [] });
  const errors = [];
  try {
    for (const [cleared, done, want] of [[5, BASE_TOURS.filter((t) => !['shop', 'events', 'race'].includes(t)), 'siralama'], [6, ALL_OLD_TOURS, 'akis'], [8, [...ALL_OLD_TOURS, 'akis'], 'yazi'], [9, [...ALL_OLD_TOURS, 'akis', 'yazi'], 'soru'], [10, [...ALL_OLD_TOURS, 'akis', 'yazi', 'soru'], 'ikili'], [11, [...ALL_OLD_TOURS, 'akis', 'yazi', 'soru', 'ikili'], 'usta']]) {
      const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, hasTouch: true, ...(bt === 'chromium' ? { isMobile: true } : {}), locale: 'tr-TR', reducedMotion: 'reduce' });
      const progress = {}; for (let i = 1; i <= cleared; i++) progress[i] = { stars: 2, best: 800, plays: 1 };
      await ctx.addInitScript((st) => { try { if (!localStorage.getItem('odi-v1')) localStorage.setItem('odi-v1', JSON.stringify({ state: st, version: 3 })); } catch { /* yok */ } }, { progress, coins: 300, ftue: { v: 1, story: true, tours: done } });
      const page = await ctx.newPage(); const p = { slug: `tur-${want}`, page };
      page.on('pageerror', (e) => errors.push(`${want}: ${e.message}`));
      await page.goto(base, { waitUntil: 'load' });
      await page.getByRole('button', { name: /Devam et|Yola çık/ }).click({ timeout: 30_000 });
      for (let i = 0; i < 30 && !(await page.locator(`[data-testid="anlatici-tur"][data-tour="${want}"]`).count()); i++) {
        if (await page.locator('.onboard').count()) { await page.getByRole('textbox', { name: 'Takma ad' }).fill(`Tur${want}`).catch(() => undefined); await page.getByRole('button', { name: 'Başla' }).click().catch(() => undefined); }
        await sleep(500);
      }
      const tour = page.locator(`[data-testid="anlatici-tur"][data-tour="${want}"]`);
      S.check(await tour.count() === 1, `${cleared} bölümden sonra “${want}” turu başladı`);
      let guard = 0; let shotDone = false;
      while (await tour.count() && guard++ < 30) {
        if (!shotDone) { await sleep(700); await S.shot(p, `tur-${want}`); shotDone = true; }
        const next = page.locator('[data-testid="anlatici-ileri"]');
        if (await next.count()) { await next.click().catch(() => undefined); await sleep(450); continue; }
        const r = await page.locator('.coach-ring').boundingBox().catch(() => null);
        if (r) { await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await sleep(900); continue; }
        await sleep(400);
      }
      S.check(!(await tour.count()), `“${want}” turu bitti`);
      await ctx.close();
    }
  } catch (e) {
    failures++; S.rec.fails.push(String(e.message ?? e).split('\n')[0]); log(`✗ akış: ${String(e.message ?? e).split('\n')[0]}`);
  } finally {
    if (errors.length) { failures++; S.rec.fails.push(`konsol: ${errors.slice(0, 3).join(' | ')}`); }
    await browser.close();
  }
}

// ---------------------------------------------------------------- 4c) Odi rengi: takma ad sayfasında seçilen renk her yerde
async function colorSuite(bt) {
  const S = makeSuite(`renk-${bt}`);
  console.log(`\n▶ renk · ${bt}`);
  const browser = await (bt === 'webkit' ? webkit : chromium).launch({ headless: true, executablePath: bt === 'chromium' ? process.env.PLAYWRIGHT_CHROMIUM || undefined : undefined, args: bt === 'chromium' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] : [] });
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, hasTouch: true, ...(bt === 'chromium' ? { isMobile: true } : {}), locale: 'tr-TR', reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { if (!localStorage.getItem('odi-v1')) localStorage.setItem('odi-v1', JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true } }, version: 3 })); } catch { /* yok */ } });
    const page = await ctx.newPage(); const p = { slug: 'renk', page };
    page.on('pageerror', (e) => errors.push(e.message));
    const PICK = 4; const HEX = 'ff4f7a'; // takma ad sayfasındaki 5. renk (pembe-kırmızı; varsayılan mor değil)
    await page.goto(`${base}&oyun-bot=1`, { waitUntil: 'load' });
    await page.getByRole('button', { name: /Yola çık/ }).click({ timeout: 30_000 });
    await page.locator('.onboard').waitFor({ timeout: 20_000 });
    await page.getByRole('textbox', { name: 'Takma ad' }).fill('Renkli Odi');
    await page.locator('.swatch').nth(PICK).click();
    await S.shot(p, 'takma-ad-renk');
    await page.getByRole('button', { name: 'Başla' }).click();
    await page.locator('.onboard').waitFor({ state: 'detached' });
    await toastGone(p);
    const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('odi-v1') ?? '{}').state ?? {});
    await page.waitForFunction(() => (JSON.parse(localStorage.getItem('odi-v1') ?? '{}').state ?? {}).odiColor != null, null, { timeout: 8000 }).catch(() => undefined);
    S.check((await store()).odiColor === 0xff4f7a, 'seçilen renk kayıtta (tek kaynak, kalıcı)');
    S.check(await page.evaluate(() => window.__etkinlik.net().me.color) === 0xff4f7a, 'sunucu profilinde aynı renk (arkadaşlar/takım/yarış görür)');
    // harita
    await page.locator('[data-odi-color]').first().waitFor({ timeout: 15_000 });
    S.check(await page.locator('.map-screen [data-odi-color]').first().getAttribute('data-odi-color') === HEX, `haritadaki Odi seçilen renkte (#${HEX})`);
    // profil
    await page.locator('nav.tabbar .tab[data-tab="profile"]').click();
    S.check(await page.getByTestId('profil-odi-renk').getAttribute('data-color') === HEX, 'Profil’deki Odi seçilen renkte');
    await S.shot(p, 'profil-renk');
    // Dolap: "Kendi rengin" giyili; başka renk giyip geri dönmek
    await page.getByRole('button', { name: 'Dolabı aç' }).click();
    await page.getByTestId('kendi-rengin').waitFor();
    S.check(await page.getByTestId('kendi-rengin').getAttribute('aria-pressed') === 'true', 'Dolap: “Kendi rengin” giyili');
    await page.getByRole('button', { name: 'Klasik Mor' }).click();
    await page.waitForFunction(() => (JSON.parse(localStorage.getItem('odi-v1') ?? '{}').state ?? {}).odiColor === 0x6c4cf1, null, { timeout: 5000 });
    await page.waitForFunction(() => window.__etkinlik.net().me.color === 0x6c4cf1, null, { timeout: 8000 }).then(() => S.check(true, 'Dolap’ta açıkça giyilen renk sunucuya da yazıldı'), () => S.check(false, 'Dolap rengi sunucuya yazılmadı'));
    await page.getByTestId('kendi-rengin').click();
    await page.waitForFunction(() => (JSON.parse(localStorage.getItem('odi-v1') ?? '{}').state ?? {}).odiColor === 0xff4f7a, null, { timeout: 5000 });
    S.check(true, 'Dolap: kendi rengine geri dönüldü');
    await S.shot(p, 'dolap-kendi-rengin');
    await page.getByRole('button', { name: 'Geri' }).first().click();
    // kamp
    await page.locator('nav.tabbar .tab[data-tab="camp"]').click();
    const camp = await page.locator('[data-odi-color]').first().waitFor({ timeout: 15_000 }).then(() => page.locator('[data-odi-color]').first().getAttribute('data-odi-color'), () => null);
    S.check(camp === HEX, `kamptaki kendi Odi'n seçilen renkte (${camp})`);
    // bölüm: harita → bölüm (bot oynar) → bölüme verilen kahraman rengi
    await page.locator('nav.tabbar .tab[data-tab="map"]').click();
    await page.locator('.map-play').click({ timeout: 15_000 });
    await page.getByRole('button', { name: /Haydi|Başla|Oyna/ }).first().click({ timeout: 4000 }).catch(() => undefined);
    await page.waitForFunction(() => !!window.__odi?.spec, null, { timeout: 30_000 });
    const lvl = await page.evaluate(() => window.__odi.cosmetic?.color ?? null);
    S.check(lvl === 0xff4f7a, `bölümdeki kahraman seçilen renkte (${lvl?.toString(16)})`);
    await sleep(1500); await S.shot(p, 'bolum-kahraman');
    await ctx.close();
  } catch (e) {
    failures++; S.rec.fails.push(String(e.message ?? e).split('\n')[0]); log(`✗ akış: ${String(e.message ?? e).split('\n')[0]}`);
  } finally {
    if (errors.length) { failures++; S.rec.fails.push(`konsol: ${errors.slice(0, 3).join(' | ')}`); }
    await browser.close();
  }
}

// ---------------------------------------------------------------- 4d) Sıralama: üç oyuncu (herkes / arkadaşlar / yakınım), podyum, bilgi, satır → profil kartı → takıma davet
async function rankSuite(bt) {
  const S = makeSuite(`siralama-${bt}`);
  console.log(`\n▶ sıralama · ${bt}`);
  const browser = await (bt === 'webkit' ? webkit : chromium).launch({ headless: true, executablePath: bt === 'chromium' ? process.env.PLAYWRIGHT_CHROMIUM || undefined : undefined, args: bt === 'chromium' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] : [] });
  const errors = [];
  try {
    const k = bt === 'webkit' ? 'W' : 'K';
    const A = await newPlayer(bt, browser, `Sira${k}Ayse`, 'ayse', errors);
    const B = await newPlayer(bt, browser, `Sira${k}Bora`, 'bora', errors);
    const C = await newPlayer(bt, browser, `Sira${k}Cem`, 'cem', errors);
    const me = (p) => p.page.evaluate(() => window.__etkinlik.net().me);
    const [a, b, c] = [await me(A), await me(B), await me(C)];
    // doğrulanmış koşular: Ayşe 7, Cem 6, Bora 5 bölüm (3 yıldız) → güç sırası Ayşe > Cem > Bora
    await climb(A, 1, 8); await climb(C, 1, 7); await climb(B, 1, 6);
    await net(A, 'friends.add', { code: b.friendCode }); await net(B, 'friends.add', { code: a.friendCode });
    await net(A, 'team.create', { name: `Liderler ${k}`, emblem: '🦉' }); await syncTeam(A);
    // Profil › Sıralama
    await closeBanners(A); await backToTabs(A);
    await A.page.locator('nav.tabbar .tab[data-tab="profile"]').click();
    await A.page.locator('.menu-tile[data-tile="ranking"]').click();
    await A.page.getByTestId('siralama').waitFor();
    await A.page.locator('.rank[data-board="guc"][data-scope="herkes"] .rank-row.me').first().waitFor({ timeout: 15_000 });
    const view = (p, board, scope) => net(p, 'rank.board', { board, scope }).then((r) => r.view);
    const all = await view(A, 'guc', 'herkes');
    const pos = (v, id) => v.rows.find((r) => r.id === id)?.rank ?? 0;
    S.check(pos(all, a.id) > 0 && pos(all, a.id) < pos(all, c.id) && pos(all, c.id) < pos(all, b.id), `güç sırası Ayşe (${pos(all, a.id)}) < Cem (${pos(all, c.id)}) < Bora (${pos(all, b.id)})`);
    S.check(all.rows.find((r) => r.id === a.id)?.value === 7 * 3 * 10 + 7 * 20 + 15, 'güç şeffaf formülle: 21 yıldız × 10 + 7 bölüm × 20 + kamp 1 × 15');
    // kendi satırım: listede görünmüyorsa (ör. podyumdaysa) altta sabit; görünüyorsa tekrar edilmez
    const mine = A.page.locator('.rank .rank-row.me');
    S.check(await mine.count() === 1 && Number(await mine.first().getAttribute('data-rank')) === pos(all, a.id), `kendi satırım bir kez ve doğru sırada (${pos(all, a.id)}.)`);
    S.check(await A.page.getByTestId('podyum').count() === 1, 'ilk 3 podyumda');
    const podColors = await A.page.locator('.podium .pd .pd-face svg').count();
    S.check(podColors >= 1, 'podyumda Odi avatarları (oyuncunun kendi rengiyle)');
    await S.shot(A, 'herkes-podyum');
    // bilgi sayfası: formül ve ödüller
    await A.page.getByRole('button', { name: 'Nasıl hesaplanır?' }).click();
    const info = await A.page.locator('.sheet').innerText();
    S.check(/yıldız × 10/.test(info) && /bölüm × 20/.test(info) && /kristal/.test(info), 'bilgi sayfası formülü ve ödülleri gösterir');
    await S.shot(A, 'bilgi');
    await A.page.getByRole('button', { name: 'Anladım' }).click();
    // arkadaşlar
    await A.page.locator('.rank-scope button[data-scope="arkadas"]').click();
    await A.page.locator('.rank[data-scope="arkadas"] [data-testid="sira-satiri"]').first().waitFor({ timeout: 10_000 });
    const fr = await A.page.locator('[data-testid="sira-satiri"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
    S.check(JSON.stringify(fr) === JSON.stringify([a.id, b.id]), 'Arkadaşlar: yalnız ben ve arkadaşım, güç sırasıyla');
    await S.shot(A, 'arkadaslar');
    // yakınım (±5)
    await A.page.locator('.rank-scope button[data-scope="yakin"]').click();
    await A.page.locator('.rank[data-scope="yakin"] [data-testid="sira-satiri"]').first().waitFor({ timeout: 10_000 });
    const near = await view(A, 'guc', 'yakin');
    const ar = pos(near, a.id);
    S.check(ar > 0 && near.rows.length <= 11 && near.rows.every((r) => Math.abs(r.rank - ar) <= 5), `Yakınım: ±5 sıra (${near.rows.length} satır, benim sıram ${ar})`);
    const bn = await view(B, 'guc', 'yakin');
    S.check(bn.me?.id === b.id && bn.rows.some((r) => r.id === b.id), 'Bora’nın yakınım tablosunda kendisi var');
    // satıra dokun → profil kartı → takıma davet
    await A.page.locator('.rank-scope button[data-scope="arkadas"]').click();
    await A.page.locator(`[data-testid="sira-satiri"][data-id="${b.id}"] button`).click();
    await A.page.getByTestId('profil-karti').waitFor();
    S.check(await A.page.getByTestId('takima-davet').count() === 1, 'profil kartında “Takıma davet et”');
    await S.shot(A, 'profil-karti');
    await A.page.getByTestId('takima-davet').click();
    await A.page.getByTestId('takima-davet').filter({ hasText: 'Davet gönderildi' }).waitFor({ timeout: 8000 }).then(() => S.check(true, 'takım daveti gönderildi'), () => S.check(false, 'takım daveti gönderilemedi'));
    await A.page.keyboard.press('Escape').catch(() => undefined);
    await A.page.locator('.sheet-wrap').waitFor({ state: 'detached', timeout: 3000 }).catch(() => undefined);
    // Bora: Mesajlar › davet kartı › Takıma katıl
    await closeBanners(B); await backToTabs(B);
    await B.page.locator('nav.tabbar .tab[data-tab="profile"]').click();
    await B.page.locator('.menu-tile[data-tile="messages"]').click();
    await B.page.getByTestId('sohbet-satiri').first().click();
    const card = B.page.getByTestId('davet-karti').last();
    await card.waitFor({ timeout: 10_000 });
    S.check(/Liderler/.test(await card.innerText()), 'davet kartında takım adı ve kodu (metni sunucu yazdı)');
    await card.getByRole('button', { name: 'Takıma katıl' }).click();
    await B.page.waitForFunction(() => !!window.__etkinlik.netStore.getState().team, null, { timeout: 8000 }).then(() => S.check(true, 'Bora davetle takıma katıldı'), () => S.check(false, 'Bora takıma katılamadı'));
    // Takım › Sıralama sekmesi: takım tabloları
    await closeBanners(A); await backToTabs(A);
    await A.page.locator('nav.tabbar .tab[data-tab="team"]').click();
    await A.page.locator('.team-head').waitFor({ timeout: 15_000 });
    await A.page.locator('.subtabs .subtab', { hasText: 'Sıralama' }).first().click();
    await A.page.locator('.rank[data-board="t-guc"]').waitFor({ timeout: 10_000 });
    await A.page.locator('.rank .rank-row.me').first().waitFor({ timeout: 10_000 });
    S.check(await A.page.locator('.rank .rank-row.me').count() === 1, 'kendi satırım listede görünürken altta tekrar edilmez');
    const tv = await view(A, 't-guc', 'herkes');
    S.check(tv.me?.name === `Liderler ${k}` && tv.me.emblem === '🦉', `Takım gücü tablosunda takımım (${tv.me?.rank}.)`);
    S.check(tv.me?.value === all.rows.find((r) => r.id === a.id).value + all.rows.find((r) => r.id === b.id).value, 'takım gücü = üyelerin gücü toplamı (Ayşe + Bora)');
    await S.shot(A, 'takim-siralama');
    await A.page.locator('.rank-kind button', { hasText: 'Oyuncular' }).click();
    await A.page.locator('.rank[data-board="guc"]').waitFor();
    S.check(true, 'Takım sekmesinden oyuncu tablolarına geçiş');
    for (const p of [A, B, C]) await p.ctx.close();
  } catch (e) {
    failures++; S.rec.fails.push(String(e.message ?? e).split('\n')[0]); log(`✗ akış: ${String(e.message ?? e).split('\n')[0]}`);
  } finally {
    if (errors.length) { failures++; S.rec.fails.push(`konsol: ${errors.slice(0, 3).join(' | ')}`); log(`✗ konsol: ${errors.slice(0, 3).join(' | ')}`); }
    await browser.close();
  }
}

// ---------------------------------------------------------------- 5) dom (telefon paketi) akışı
async function domSuite(bt) {
  const S = makeSuite(`dom-${bt}`);
  console.log(`\n▶ dom · ${bt}`);
  const browser = await (bt === 'webkit' ? webkit : chromium).launch({ headless: true, executablePath: bt === 'chromium' ? process.env.PLAYWRIGHT_CHROMIUM || undefined : undefined, args: bt === 'chromium' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] : [] });
  const errors = [];
  try {
    const A = await newPlayer(bt, browser, 'Defne', 'defne', errors);
    const team = (await net(A, 'team.create', { name: `Telefon Takımı ${bt.slice(0, 2)}`, emblem: '🦻' })).team; await syncTeam(A);
    // telefon oyuncusu
    const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, hasTouch: true, ...(bt === 'chromium' ? { isMobile: true } : {}), locale: 'tr-TR', reducedMotion: 'reduce' });
    await ctx.addInitScript(domBridge, [wsUrl, 47, 34]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`tel: ${e.message}`));
    const T = { slug: 'telefon', page, ctx };
    await page.goto(domHtml, { waitUntil: 'load' });
    await page.getByRole('button', { name: /Yola çık|Devam et/ }).click({ timeout: 45_000 });
    await page.locator('.onboard').waitFor({ timeout: 15_000 });
    await page.getByRole('textbox', { name: 'Takma ad' }).fill('Telefoncu');
    await page.getByRole('button', { name: 'Başla' }).click();
    await page.locator('.onboard').waitFor({ state: 'detached' });
    for (let i = 0; i < 8 && await page.locator('.toast-top').count(); i++) { await page.locator('.toast-top').first().click({ timeout: 500 }).catch(() => undefined); await sleep(150); }
    await page.locator('nav.tabbar .tab[data-tab="team"]').click();
    await page.getByLabel('Takım davet kodu').fill(team.code);
    await page.locator('.code-join').getByRole('button', { name: 'Katıl' }).click();
    await page.locator('.team-head').waitFor({ timeout: 10_000 });
    for (let i = 0; i < 8 && await page.locator('.toast-top').count(); i++) { await page.locator('.toast-top').first().click({ timeout: 500 }).catch(() => undefined); await sleep(150); }
    S.check(true, 'telefon paketi takıma kodla katıldı');
    await net(A, 'progress.submit', runOf(1, { mechanic: 'boss', stars: 3 }));
    const card = page.locator('[data-testid="akis-karti"][data-type="boss"]').first();
    await card.waitFor({ timeout: 10_000 });
    await card.locator('[data-reaction="ates"]').click();
    await card.getByTestId('tebrik-et').click();
    await teamChat(A);
    const aCard = A.page.locator('[data-testid="akis-karti"][data-type="boss"]').first();
    await aCard.locator('[data-reaction="ates"] .rc', { hasText: '1' }).waitFor({ timeout: 8000 });
    await aCard.locator('.thread .th-text', { hasText: 'Tebrikler!' }).waitFor({ timeout: 8000 });
    S.check(true, 'telefondan tepki + tebrik web oyuncusuna ulaştı');
    await page.locator('[data-testid="akis-karti"][data-type="boss"]').first().scrollIntoViewIfNeeded().catch(() => undefined);
    await S.shot(T, 'akis-boss-karti');
    const q = page.locator('[data-testid="gunun-sorusu"]').first();
    await q.waitFor({ timeout: 10_000 });
    await q.scrollIntoViewIfNeeded();
    await q.locator('.dq-opt[data-choice="2"]').click();
    await q.locator('.dq-opt.picked').waitFor({ timeout: 8000 });
    S.check(true, 'telefondan Günün Sorusu cevaplandı');
    await S.shot(T, 'gunun-sorusu');
    // sohbet girişi sekme çubuğunun üstünde
    const box = await page.evaluate(() => { const f = document.querySelector('.chat-input')?.getBoundingClientRect(); const t = document.querySelector('.tabbar')?.getBoundingClientRect(); return f && t ? { f: f.bottom, t: t.top } : null; });
    S.check(!!box && box.f <= box.t + 0.5, `telefon: sohbet girişi sekme çubuğunun üstünde (${JSON.stringify(box)})`);
    await ctx.close(); await A.ctx.close();
  } catch (e) {
    failures++; S.rec.fails.push(String(e.message ?? e).split('\n')[0]); log(`✗ akış: ${String(e.message ?? e).split('\n')[0]}`);
  } finally {
    if (errors.length) { failures++; S.rec.fails.push(`konsol: ${errors.slice(0, 3).join(' | ')}`); log(`✗ konsol: ${errors.slice(0, 3).join(' | ')}`); }
    await browser.close();
  }
}

try {
  for (const t of targets) for (const b of browsers) { if (t === 'web') { if (has('only-rank') || has('only-tour')) { if (has('only-tour')) await tourSuite(b); if (has('only-rank')) await rankSuite(b); continue; } if (!has('only-color')) { await webSuite(b); await tourSuite(b); await rankSuite(b); } await colorSuite(b); } else await domSuite(b); }
} finally {
  console.log('\n— özet —');
  for (const r of results) console.log(`  ${r.fails.length ? '✗' : '✓'} ${r.label}: ${r.checks} denetim${r.fails.length ? `, sorunlar: ${r.fails.join(' ; ')}` : ''}`);
  console.log(failures ? `\n✗ ${failures} sorun` : '\n✓ iletişim uçtan uca testi geçti');
  await done(failures ? 1 : 0);
}
