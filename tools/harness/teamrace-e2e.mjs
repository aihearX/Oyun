#!/usr/bin/env node
// ODİ takım rekabeti uçtan uca testi (docs/16-takim-rekabeti.md): gerçek sunucu (ODI_DB=:memory:) + web test derlemesi (VITE_ODI_E2E=1:
// window.__etkinlik.net(), ?oyun-bot=1 takım yarışını da bot koşar) + beş gerçek tarayıcı oyuncusu, iki takım (3'e 2, denge çarpanı).
// Akış (her tarayıcıda): lider Takım › Takım Yarışı'nda lobi açar → üyeler arayüzden katılıp "Hazırım" → lider "Rakip ara" (rakip yok:
//   dürüst not) → ikinci takım lobi + arama → eşleşme → beşi de aynı bölüme girer (hayaletler takım renginde, takım şeridi, yarış içi
//   tepki) → botlar bitirir → sonuç ekranı (iki takımda aynı skor) → akış kartı → Takım › Lig'de yarış puanı.
// dom hedefi (bir akış): telefon paketi bir takımın lideri olarak lobi açar, web üyesi katılır, arama + dürüst not, meydan okuma listesi, Lig.
// Kullanım: node tools/harness/teamrace-e2e.mjs [--browsers chromium,webkit] [--target web|dom|both] [--no-build] [--build-dom]
// Çıktı: tools/harness/out/takim-yarisi/<hedef>-<tarayıcı>/NN-oyuncu-ad.png
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
const outRoot = resolve(root, 'tools/harness/out/takim-yarisi'); mkdirSync(outRoot, { recursive: true });
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
  cwd: root, env: { ...process.env, PORT: String(srvPort), HOST: '127.0.0.1', ODI_DB: ':memory:', ODI_TEST_STORE: '1', ODI_LOG: '0', ODI_FREE_TEXT_AT: '0' }, stdio: ['ignore', 'pipe', 'inherit'],
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
const base = `http://127.0.0.1:${webPort}/?sunucu=${encodeURIComponent(wsUrl)}&oyun-bot=1&oyun-hiz=3`;
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
async function teamTab(p, sub) {
  await closeBanners(p); await toastGone(p); await backToTabs(p);
  await p.page.locator('nav.tabbar .tab[data-tab="team"]').click();
  await p.page.locator('.team-head').waitFor({ timeout: 15_000 });
  const t = p.page.locator('.subtabs .subtab', { hasText: sub }).first();
  await t.scrollIntoViewIfNeeded().catch(() => undefined);
  await t.click();
  await sleep(400);
}
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
const launch = (bt) => (bt === 'webkit' ? webkit : chromium).launch({ headless: true, executablePath: bt === 'chromium' ? process.env.PLAYWRIGHT_CHROMIUM || undefined : undefined, args: bt === 'chromium' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] : [] });

// ---------------------------------------------------------------- 4) web: iki takım, beş oyuncu, tam akış
async function webSuite(bt) {
  const S = makeSuite(`web-${bt}`);
  console.log(`\n▶ web · ${bt}`);
  const browser = await launch(bt);
  const errors = [];
  const k = bt === 'webkit' ? 'W' : 'K';
  const all = [];
  try {
    const A = [await newPlayer(bt, browser, `Ay${k}se`, 'ayse', errors), await newPlayer(bt, browser, `Al${k}i`, 'ali', errors), await newPlayer(bt, browser, `As${k}ya`, 'asya', errors)];
    const B = [await newPlayer(bt, browser, `Bo${k}ra`, 'bora', errors), await newPlayer(bt, browser, `Ba${k}nu`, 'banu', errors)];
    all.push(...A, ...B);
    log('beş oyuncu bağlandı');
    for (const p of [...A, ...B]) await p.page.evaluate(() => { const n = window.__etkinlik.net(); const orig = n.call.bind(n); n.call = (o, d) => orig(o, d).catch((e) => { window.__errs = [...(window.__errs ?? []), `${o}:${e.code}:${e.message}`]; throw e; }); });
    const ta = (await net(A[0], 'team.create', { name: `Kulaklar ${k}`, emblem: '🦉' })).team;
    const tb = (await net(B[0], 'team.create', { name: `Yunuslar ${k}`, emblem: '🐬' })).team;
    for (const p of A.slice(1)) await net(p, 'team.join', { teamId: ta.id });
    await net(B[1], 'team.join', { teamId: tb.id });
    for (const p of [...A, ...B]) await syncTeam(p);
    // A lideri lobi açar (arayüz)
    await teamTab(A[0], 'Takım Yarışı');
    await A[0].page.getByTestId('takim-yarisi').waitFor();
    await A[0].page.getByTestId('tr-ac-3').click();
    await A[0].page.getByTestId('tr-lobi').waitFor();
    S.check(true, 'lider 3’e 3 lobi açtı');
    // üyeler arayüzden katılır ve hazır
    for (const p of A.slice(1)) {
      await teamTab(p, 'Takım Yarışı');
      await p.page.getByTestId('tr-katil').click();
      await p.page.getByTestId('tr-hazir').click();
    }
    await A[0].page.getByTestId('tr-hazir').click();
    await A[0].page.locator('[data-testid="tr-uye"][data-ready="1"]').nth(2).waitFor({ timeout: 10_000 });
    S.check(await A[0].page.locator('[data-testid="tr-uye"][data-ready="1"]').count() === 3, 'üç üye hazır (canlı güncellendi)');
    await S.shot(A[0], 'lobi-hazir');
    // rakip ara: kimse yok → dürüst not
    await A[0].page.getByTestId('tr-ara').click();
    await A[0].page.locator('[data-testid="tr-durum"]', { hasText: 'Rakip aranıyor' }).waitFor({ timeout: 8000 });
    const note = await A[0].page.getByTestId('tr-not').innerText().catch(() => '');
    S.check(/arayan başka takım yok/.test(note), `rakip yoksa açıkça söylenir (“${note.slice(0, 60)}…”)`);
    await S.shot(A[0], 'araniyor-durust');
    // B takımı: lobi + 2 hazır (az kişi: denge çarpanı) + ara → eşleşme
    await teamTab(B[0], 'Takım Yarışı');
    await B[0].page.getByTestId('tr-ac-3').click();
    await teamTab(B[1], 'Takım Yarışı');
    await B[1].page.getByTestId('tr-katil').click();
    await B[1].page.getByTestId('tr-hazir').click();
    await B[0].page.getByTestId('tr-hazir').click();
    await B[0].page.locator('[data-testid="tr-uye"][data-ready="1"]').nth(1).waitFor({ timeout: 10_000 });
    await B[0].page.getByTestId('tr-ara').click();
    // beşi de takım yarışı bölümüne girer
    for (const p of [...A, ...B]) await p.page.waitForFunction(() => !!window.__odi?.race?.team, null, { timeout: 45_000 });
    const room = await A[0].page.evaluate(() => window.__odi.race);
    S.check(room.team.a.n === 3 && room.team.b.n === 2 && room.team.b.mult === 1.5, `eşleşti: ${room.team.a.name} (3) – ${room.team.b.name} (2, ×1,5)`);
    S.check(new Set(await Promise.all([...A, ...B].map((p) => p.page.evaluate(() => `${window.__odi.race.id}:${window.__odi.spec.id}`)))).size === 1, 'beşi de aynı yarış odasında, aynı bölümde');
    await A[1].page.getByTestId('tr-hud').waitFor({ timeout: 10_000 });
    S.check(true, 'yarış içi takım şeridi görünür');
    // yarış içi tepki: Ali → Ayşe görür (yalnızca takım arkadaşları)
    await A[1].page.waitForFunction(() => window.__odi?.race?.status === 'yarista' || (window.__odi?.events ?? []).some((e) => e.type === 'started'), null, { timeout: 20_000 }).catch(() => undefined);
    await sleep(800);
    await A[1].page.locator('.tr-reacts button').first().click();
    await A[0].page.locator('.tr-float').first().waitFor({ timeout: 6000 }).then(() => S.check(true, 'takım arkadaşının tepkisi göründü'), () => S.check(false, 'tepki görünmedi'));
    S.check(await B[0].page.locator('.tr-float').count() === 0, 'rakip takım tepkiyi görmez');
    await S.shot(A[0], 'yaris-ici');
    await S.shot(B[0], 'yaris-ici-rakip');
    // botlar bitirir → sonuç ekranı (yıldızlar gelince yazılır)
    for (const p of [...A, ...B]) await p.page.locator('[data-testid="tr-sonuc-ekrani"]:not([data-outcome="bekliyor"])').waitFor({ timeout: 200_000 });
    for (const p of [...A, ...B]) log(`${p.name}: ${JSON.stringify(await p.page.evaluate(() => ({ ev: (window.__odi?.events ?? []).filter((e) => !['progress', 'haptic', 'checkpoint'].includes(e.type)).map((e) => e.type + (e.result ? `:${e.result.completed}/${Math.round(e.result.timeSec)}s` : '')).slice(-6), race: window.__odi?.race?.status, me: window.__odi?.race?.players?.map((x) => [x.name, x.place, x.left, x.finishedAt]), st: window.__odi?.race?.startsAt, errs: window.__errs })))}`);
    const score = async (p) => [Number(await p.page.getByTestId('tr-skor-biz').innerText()), Number(await p.page.getByTestId('tr-skor-rakip').innerText()), await p.page.getByTestId('tr-sonuc-ekrani').getAttribute('data-outcome')];
    const [a0, b0] = [await score(A[0]), await score(B[0])];
    S.check(a0[0] === b0[1] && a0[1] === b0[0], `iki takımda aynı skor: ${a0[0]} – ${a0[1]}`);
    S.check((a0[2] === 'win' && b0[2] === 'lose') || (a0[2] === 'lose' && b0[2] === 'win') || (a0[2] === 'draw' && b0[2] === 'draw'), `sonuç tutarlı (${a0[2]} / ${b0[2]})`);
    S.check(await A[0].page.locator('[data-testid="tr-satir"]').count() === 5, 'beş oyuncunun bireysel puanı');
    await S.shot(A[0], 'sonuc');
    await S.shot(B[1], 'sonuc-rakip');
    // akış kartı + lig puanı
    await A[0].page.getByTestId('tr-takima-don').click();
    await teamTab(A[0], 'Sohbet');
    await A[0].page.locator('[data-testid="akis-karti"][data-type="tyaris"]').first().waitFor({ timeout: 10_000 }).then(() => S.check(true, 'sonuç takım akışında (rövanş düğmesiyle)'), () => S.check(false, 'akış kartı yok'));
    await S.shot(A[0], 'akis-karti');
    const la = (await net(A[0], 'tlig.state', {})).state; const lb = (await net(B[0], 'tlig.state', {})).state;
    const want = (o) => (o === 'win' ? 20 : o === 'draw' ? 8 : 4);
    S.check(la.mine.race === want(a0[2]) && lb.mine.race === want(b0[2]), `Takım Ligi yarış puanı: ${la.mine.race} / ${lb.mine.race}`);
    await teamTab(A[0], 'Lig');
    await A[0].page.getByTestId('tl-puanlarimiz').waitFor({ timeout: 10_000 });
    const rows = await A[0].page.locator('[data-testid="tl-satir"]').count();
    S.check(rows >= 2, `Lig grubunda ${rows} takım`);
    await S.shot(A[0], 'lig');
    // sıralama: Takım Ligi tablosu
    const board = (await net(A[0], 'rank.board', { board: 't-lig', scope: 'herkes' })).view;
    S.check(board.rows.some((r) => r.name === `Kulaklar ${k}`), 'Sıralama › Takım Ligi tablosunda');
  } catch (e) {
    failures++; S.rec.fails.push(String(e.message ?? e).split('\n')[0]); log(`✗ akış: ${String(e.message ?? e).split('\n')[0]}`);
    for (const p of all) { await p.page.screenshot({ path: resolve(outRoot, `web-${bt}`, `hata-${p.slug}.png`) }).catch(() => undefined); log(`  ${p.slug}: ${JSON.stringify(await p.page.evaluate(() => ({ url: location.pathname, race: window.__odi?.race?.status, errs: window.__errs })).catch(() => null))}`); }
  } finally {
    if (errors.length) { failures++; S.rec.fails.push(`konsol: ${errors.slice(0, 3).join(' | ')}`); log(`✗ konsol: ${errors.slice(0, 3).join(' | ')}`); }
    await browser.close(); saveProgress();
  }
}

// ---------------------------------------------------------------- 5) dom: telefon paketi lider
async function domSuite(bt) {
  const S = makeSuite(`dom-${bt}`);
  console.log(`\n▶ dom · ${bt}`);
  const browser = await launch(bt);
  const errors = [];
  try {
    const W = await newPlayer(bt, browser, 'Webci', 'webci', errors);
    const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, hasTouch: true, ...(bt === 'chromium' ? { isMobile: true } : {}), locale: 'tr-TR', reducedMotion: 'reduce' });
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
    await toastGone(T);
    // telefoncu takım kurar (arayüz)
    await page.locator('nav.tabbar .tab[data-tab="team"]').click();
    await page.getByRole('button', { name: '＋ Takım kur' }).first().click();
    await page.locator('.sheet').getByPlaceholder('ör. Koklea Kaşifleri').fill(`Telefon ${bt.slice(0, 2)}`);
    await page.locator('.sheet').getByRole('button', { name: /Takımı kur/ }).click();
    await page.locator('.team-head').waitFor({ timeout: 10_000 });
    await toastGone(T);
    const team = (await net(W, 'team.list', { query: `Telefon ${bt.slice(0, 2)}` })).teams[0];
    await net(W, 'team.join', { teamId: team.id }); await syncTeam(W);
    await teamTab(T, 'Takım Yarışı');
    await page.getByTestId('tr-ac-3').click();
    await page.getByTestId('tr-hazir').click();
    await teamTab(W, 'Takım Yarışı');
    await W.page.getByTestId('tr-katil').click();
    await W.page.getByTestId('tr-hazir').click();
    await page.locator('[data-testid="tr-uye"][data-ready="1"]').nth(1).waitFor({ timeout: 10_000 });
    S.check(true, 'telefondan lobi: web üyesi katıldı, ikisi hazır');
    await page.getByTestId('tr-ara').click();
    await page.getByTestId('tr-not').waitFor({ timeout: 8000 });
    S.check(/takım/.test(await page.getByTestId('tr-not').innerText()), 'telefonda arama durumu ve dürüst not');
    await S.shot(T, 'lobi-araniyor');
    await page.getByTestId('tr-meydan').click();
    await page.getByTestId('tr-takimlar').waitFor();
    S.check(true, 'meydan okuma: takım listesi');
    await S.shot(T, 'meydan-oku');
    await page.locator('.sheet').getByRole('button', { name: 'Kapat' }).click();
    await page.getByTestId('tr-ara-dur').click().catch(() => undefined);
    await teamTab(T, 'Lig');
    await page.getByTestId('takim-ligi').waitFor({ timeout: 10_000 });
    S.check(true, 'telefonda Takım Ligi');
    await S.shot(T, 'lig');
    await ctx.close();
  } catch (e) {
    failures++; S.rec.fails.push(String(e.message ?? e).split('\n')[0]); log(`✗ akış: ${String(e.message ?? e).split('\n')[0]}`);
  } finally {
    if (errors.length) { failures++; S.rec.fails.push(`konsol: ${errors.slice(0, 3).join(' | ')}`); log(`✗ konsol: ${errors.slice(0, 3).join(' | ')}`); }
    await browser.close(); saveProgress();
  }
}

try {
  for (const t of targets) for (const b of browsers) { if (t === 'web') await webSuite(b); else if (b === browsers[0]) await domSuite(b); }
} finally {
  console.log('\n— özet —');
  for (const r of results) console.log(`  ${r.fails.length ? '✗' : '✓'} ${r.label}: ${r.checks} denetim${r.fails.length ? `, sorunlar: ${r.fails.join(' ; ')}` : ''}`);
  console.log(failures ? `\n✗ ${failures} sorun` : '\n✓ takım rekabeti uçtan uca testi geçti');
  await done(failures ? 1 : 0);
}
