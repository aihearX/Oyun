#!/usr/bin/env node
// ODİ Kod Gir uçtan uca testi (docs/10-sunucu.md "Kodlar"): gerçek sunucu (ODI_DB=:memory:, ODI_ADMIN_CODE_HASH = TEST yönetici kodunun
// özeti; gerçek yönetici kodu depoda yoktur) + web test derlemesi + iki tarayıcı oyuncusu.
// Akış (her tarayıcıda): Profil › Kod gir → yanlış kod mesajı → test yönetici kodu → harita "Bölüm 40" oynanabilir, 40. bölüm açılır →
//   Ayarlar'da "Yönetici modu açık" rozeti → Kod paneli'nden ödül kodu oluşturulur → ikinci oyuncu kodu küçük harf + boşlukla girer →
//   sandık kutlaması + ödül kutusunda ödüller → ikinci kez "zaten kullandın" → süresi dolmuş kod → yönetici modu kapanır, harita gerçek
//   ilerlemeye kilitlenir.
// dom hedefi (bir akış): telefon paketi oyuncusu yanlış kod ve ödül kodu girer, ödül gelir.
// Kullanım: node tools/harness/codes-e2e.mjs [--browsers chromium,webkit] [--target web|dom|both] [--no-build] [--build-dom]
// Çıktı: tools/harness/out/kod-gir/<hedef>-<tarayıcı>/NN-oyuncu-ad.png
import { randomBytes, scryptSync } from 'node:crypto';
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
const outRoot = resolve(root, 'tools/harness/out/kod-gir'); mkdirSync(outRoot, { recursive: true });
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

// ---------------------------------------------------------------- 1) sunucu (test yönetici kodu; gerçeği değil)
const TEST_ADMIN_CODE = 'TESTYONETICI';
const TEST_ADMIN_HASH = (() => { const salt = randomBytes(16).toString('hex'); return `scrypt:${salt}:${scryptSync(TEST_ADMIN_CODE, salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex')}`; })();
if (!has('no-build') || !existsSync(resolve(root, 'apps/server/dist/server.mjs'))) await run('npm', ['run', 'build:server', '--silent']);
const srvPort = await freePort();
const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'apps/server/dist/server.mjs'], {
  cwd: root, env: { ...process.env, PORT: String(srvPort), HOST: '127.0.0.1', ODI_DB: ':memory:', ODI_TEST_STORE: '1', ODI_LOG: '0', ODI_FREE_TEXT_AT: '0', ODI_ADMIN_CODE_HASH: TEST_ADMIN_HASH }, stdio: ['ignore', 'pipe', 'inherit'],
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


async function profileTab(p) { await closeBanners(p); await toastGone(p); await backToTabs(p); await p.page.locator('nav.tabbar .tab[data-tab="profile"]').click(); await p.page.locator('.menu-tile').first().waitFor(); }
async function enterCode(p, code) {
  const sheet = p.page.getByTestId('kod-sayfasi');
  if (!(await sheet.count())) { await profileTab(p); await p.page.locator('.menu-tile[data-tile="kod"]').click(); await sheet.waitFor(); }
  await p.page.getByTestId('kod-girdi').fill(code);
  await p.page.getByTestId('kod-kullan').click();
}
const resultText = async (p) => { await p.page.getByTestId('kod-sonuc').waitFor({ timeout: 8000 }); return p.page.getByTestId('kod-sonuc').innerText(); };
const mapPlay = async (p) => { await closeBanners(p); await toastGone(p); await backToTabs(p); await p.page.locator('nav.tabbar .tab[data-tab="map"]').click(); await p.page.locator('.map-play').waitFor({ timeout: 15_000 }); return (await p.page.locator('.map-play').innerText()).trim(); };

// ---------------------------------------------------------------- 4) web
async function webSuite(bt) {
  const S = makeSuite(`web-${bt}`);
  console.log(`\n▶ web · ${bt}`);
  const browser = await launch(bt);
  const errors = [];
  const k = bt === 'webkit' ? 'W' : 'K';
  try {
    const A = await newPlayer(bt, browser, `Yon${k}etici`, 'yonetici', errors);
    const B = await newPlayer(bt, browser, `Oyu${k}ncu`, 'oyuncu', errors);
    S.check(/Bölüm 1\b/.test(await mapPlay(A)), 'başlangıçta harita gerçek ilerlemede (Bölüm 1)');
    // yanlış kod: dürüst mesaj
    await enterCode(A, 'yanlış kod');
    S.check((await resultText(A)) === 'Kod geçersiz.', 'yanlış kod: “Kod geçersiz.”');
    await S.shot(A, 'yanlis-kod');
    // test yönetici kodu (küçük harf + boşluk; Türkçe güvenli biçim)
    await enterCode(A, ' testyonetici ');
    await A.page.locator('[data-testid="kod-sonuc"]', { hasText: 'Yönetici modu açık' }).waitFor({ timeout: 8000 });
    S.check(true, 'yönetici kodu kabul edildi');
    await S.shot(A, 'yonetici-acildi');
    await A.page.keyboard.press('Escape');
    // harita: 40. bölüm oynanabilir; yıldız sahte değil
    S.check(/Bölüm 40\b/.test(await mapPlay(A)), 'yönetici modunda haritada “Bölüm 40” oynanabilir');
    S.check(await A.page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('odi-v1') ?? '{}').state?.progress ?? {}).length) === 0, 'yıldız/ilerleme sahte değil (kayıt boş)');
    await S.shot(A, 'harita-40');
    await A.page.locator('.map-play').click();
    // bölge tanıtımı (yeni bölge) varsa geç
    for (let i = 0; i < 20 && !(await A.page.evaluate(() => window.__odi?.spec?.number === 40)); i++) { await A.page.getByRole('button', { name: /Haydi|Başla|Oyna/ }).first().click({ timeout: 1000 }).catch(() => undefined); await sleep(500); }
    await A.page.waitForFunction(() => window.__odi?.spec?.number === 40, null, { timeout: 30_000 }).then(() => S.check(true, '40. bölüm açıldı'), () => S.check(false, '40. bölüm açılmadı'));
    await A.page.goto(base, { waitUntil: 'load' });
    await A.page.getByRole('button', { name: /Yola çık|Devam et/ }).click();
    await A.page.locator('nav.tabbar').waitFor({ timeout: 20_000 }); await settle(A);
    S.check(/Bölüm 40\b/.test(await mapPlay(A)), 'yeniden açılışta yönetici modu sürüyor (yerelde kalıcı)');
    // Ayarlar: rozet + panel → ödül kodu oluştur
    await profileTab(A); await A.page.locator('.menu-tile[data-tile="settings"]').click();
    await A.page.getByTestId('yonetici-rozet').waitFor();
    S.check(/Yönetici modu açık/.test(await A.page.getByTestId('yonetici-rozet').innerText()), 'Ayarlar’da “Yönetici modu açık” rozeti');
    await A.page.getByTestId('kod-ayar').scrollIntoViewIfNeeded(); await S.shot(A, 'ayarlar-rozet');
    await A.page.getByTestId('kod-paneli-ac').click(); await A.page.getByTestId('kod-paneli').waitFor();
    const code = `E2E-${k}-ODUL`;
    await A.page.getByTestId('panel-code').fill(code.toLowerCase());
    await A.page.getByTestId('panel-jeton').fill('300'); await A.page.getByTestId('panel-kristal').fill('5'); await A.page.getByTestId('panel-max').fill('10');
    await A.page.getByTestId('panel-note').fill('Hoş geldin!');
    await A.page.getByTestId('panel-olustur').click();
    await A.page.locator(`[data-testid="panel-kod"][data-code="${code}"]`).waitFor({ timeout: 8000 }).then(() => S.check(true, `panelden kod oluşturuldu (${code})`), () => S.check(false, 'panel kodu listede yok'));
    await S.shot(A, 'kod-paneli');
    await A.page.keyboard.press('Escape');
    await net(A, 'code.create', { code: `E2E-${k}-ESKI`, rewards: { jeton: 5 }, endsAt: Date.now() - 1000 });
    // ikinci oyuncu kodu kullanır: sandık + ödül kutusu
    await enterCode(B, `  ${code.toLowerCase()} `);
    await B.page.locator('.cel-root.on').waitFor({ timeout: 8000 }).then(() => S.check(true, 'ödül sandığı kutlaması'), () => S.check(false, 'sandık kutlaması yok'));
    await S.shot(B, 'sandik');
    await settle(B);
    const items = (await net(B, 'inbox.list', {})).items.filter((i) => i.ref === 'kod');
    S.check(JSON.stringify(items.map((i) => [i.kind, i.amount]).sort()) === JSON.stringify([['jeton', 300], ['kristal', 5]]), 'ödüller ödül kutusunda (300 jeton + 5 kristal)');
    await enterCode(B, code);
    S.check((await resultText(B)) === 'Bu kodu zaten kullandın.', 'ikinci kez: “Bu kodu zaten kullandın.”');
    await enterCode(B, `E2E-${k}-ESKI`);
    S.check((await resultText(B)) === 'Bu kodun süresi dolmuş.', 'süresi dolmuş kod mesajı');
    await S.shot(B, 'suresi-dolmus');
    await B.page.keyboard.press('Escape');
    // yönetici modunu kapat → harita gerçek ilerlemeye kilitlenir
    await profileTab(A); await A.page.locator('.menu-tile[data-tile="settings"]').click();
    await A.page.getByTestId('yonetici-anahtar').click();
    await A.page.locator('[data-testid="yonetici-rozet"]', { hasText: 'kapalı' }).waitFor({ timeout: 8000 });
    S.check(/Bölüm 1\b/.test(await mapPlay(A)), 'kapatınca harita gerçek ilerlemeye kilitlendi (Bölüm 1)');
    const st = (await net(A, 'admin.state', {})).admin;
    S.check(st.isAdmin && !st.on, 'sunucuda: yönetici hesabı, mod kapalı');
  } catch (e) {
    failures++; S.rec.fails.push(String(e.message ?? e).split('\n')[0]); log(`✗ akış: ${String(e.message ?? e).split('\n')[0]}`);
  } finally {
    if (errors.length) { failures++; S.rec.fails.push(`konsol: ${errors.slice(0, 3).join(' | ')}`); log(`✗ konsol: ${errors.slice(0, 3).join(' | ')}`); }
    await browser.close(); saveProgress();
  }
}

// ---------------------------------------------------------------- 5) dom: telefon paketi oyuncusu
async function domSuite(bt) {
  const S = makeSuite(`dom-${bt}`);
  console.log(`\n▶ dom · ${bt}`);
  const browser = await launch(bt);
  const errors = [];
  try {
    const W = await newPlayer(bt, browser, 'Webci', 'webci', errors);
    await enterCode(W, TEST_ADMIN_CODE);
    await W.page.locator('[data-testid="kod-sonuc"]', { hasText: 'Yönetici modu' }).waitFor({ timeout: 8000 });
    await net(W, 'code.create', { code: 'TELEFON-ODUL', rewards: { kristal: 7 } });
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
    await enterCode(T, 'olmayan');
    S.check((await resultText(T)) === 'Kod geçersiz.', 'telefonda yanlış kod mesajı');
    await S.shot(T, 'yanlis');
    await enterCode(T, 'telefon-odul');
    await page.locator('.cel-root.on').waitFor({ timeout: 8000 }).then(() => S.check(true, 'telefonda sandık kutlaması'), () => S.check(false, 'telefonda sandık yok'));
    await S.shot(T, 'sandik');
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
} catch (e) {
  // tarayıcı açılamadı ya da akış dışı hata: başarı sayılmasın (önceden finally içindeki çıkış hatayı yutuyordu)
  failures++; console.log(`✗ beklenmeyen hata: ${String(e?.message ?? e).split('\n')[0]}`);
} finally {
  console.log('\n— özet —');
  for (const r of results) console.log(`  ${r.fails.length ? '✗' : '✓'} ${r.label}: ${r.checks} denetim${r.fails.length ? `, sorunlar: ${r.fails.join(' ; ')}` : ''}`);
  console.log(failures ? `\n✗ ${failures} sorun` : '\n✓ Kod Gir uçtan uca testi geçti');
  await done(failures ? 1 : 0);
}
