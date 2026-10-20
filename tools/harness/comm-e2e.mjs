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
  cwd: root, env: { ...process.env, PORT: String(srvPort), HOST: '127.0.0.1', ODI_DB: ':memory:', ODI_EVENTS_FAST: '1', ODI_TEST_STORE: '1', ODI_LOG: '0' }, stdio: ['ignore', 'pipe', 'inherit'],
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

    // ---- güvenli varsayılan: Cem (2. bölüm) serbest yazıyı kapatır → hazır sözler; sonra kendisi açar
    await net(C, 'comm.settings', { freeText: false });
    await net(C, 'profile.update', { color: 0x2ee6d6 }); // profil değişince ayarlar yeniden okunur
    await C.page.locator('.chat-input input[readonly]').waitFor({ timeout: 8000 });
    S.check(await C.page.locator('.quick-line .phrase-row').count() === 1, 'yeni oyuncu: hazır sözler açık, serbest yazı kapalı');
    await S.shot(C, 'guvenli-hazir-sozler');
    await C.page.locator('.quick-line .phrase[data-phrase="selam"]').click();
    await B.page.locator('.msg.preset .bubble', { hasText: 'Selam!' }).last().waitFor({ timeout: 8000 });
    S.check(true, 'hazır söz gönderildi (Selam!)');
    await C.page.getByRole('textbox', { name: 'Mesaj' }).click();
    await C.page.getByTestId('serbest-ac').waitFor();
    await S.shot(C, 'serbest-yazi-onay');
    await C.page.getByTestId('serbest-ac').click();
    await C.page.locator('.chat-input input:not([readonly])').waitFor({ timeout: 8000 });
    S.check(true, 'serbest yazı kendisi açınca açıldı');
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
  for (const t of targets) for (const b of browsers) { if (t === 'web') await webSuite(b); else await domSuite(b); }
} finally {
  console.log('\n— özet —');
  for (const r of results) console.log(`  ${r.fails.length ? '✗' : '✓'} ${r.label}: ${r.checks} denetim${r.fails.length ? `, sorunlar: ${r.fails.join(' ; ')}` : ''}`);
  console.log(failures ? `\n✗ ${failures} sorun` : '\n✓ iletişim uçtan uca testi geçti');
  await done(failures ? 1 : 0);
}
