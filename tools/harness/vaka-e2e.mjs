#!/usr/bin/env node
// Kamp Görevleri uçtan uca testi (docs/17-kamp-gorevleri.md): gerçek sunucu (aynı süreçte, bellek içi veritabanı) + web test derlemesi
// + gerçek tarayıcı oyuncuları. Her tarayıcıda (Chromium + WebKit):
//   1) A ve B takma ad + takım (A kurar, B kodla katılır); sunucuda 10 bölüm geçilmiş, Klinik/Odyometri/Kule/Depo kurulu
//   2) Kamp: "Görevler" ve "Klinik" düğmeleri; Kulak Deposu toplanır (gerçek kamp eylemi) → hikâye 1. bölüm biter
//   3) Görevler › Hikâye: "Ödülü al" iki kez hızlıca → sunucu bir kez verir, kutlama TAM BİR KEZ
//   4) Görevler › Günlük: depo görevi tamam → Al (bir kez); bir görev değiştirilir
//   5) Klinik: ilk hasta → testler (odyogram, timpanogram) → tanı + yönetim → 3 yıldız, ödül, Vaka Defteri
//   6) Konsültasyon: A ikinci hasta için takımına danışır → B takım sohbetindeki kartta hazır seçenekle oy verir → A görür
//   7) Ton Avı bir tur (ödüllü), Timpanogram Eşleştir bir tur
// dom hedefi (Expo DOM telefon paketi, Chromium): Görevler paneli, Klinik ve vaka akışı.
// Kullanım: node tools/harness/vaka-e2e.mjs [--no-build] [--build-dom] [--browsers chromium,webkit] [--no-dom] [--headed]
// Çıktı: tools/harness/out/vaka/<takım>/*.png
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { build } from 'esbuild';
import { chromium, webkit } from 'playwright';

const argv = process.argv.slice(2); const args = new Set(argv);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1]; };
const browsers = opt('browsers', 'chromium,webkit').split(',');
const root = resolve(new URL('../..', import.meta.url).pathname);
const webRoot = resolve(root, 'apps/web');
const outRoot = resolve(root, 'tools/harness/out/vaka'); mkdirSync(outRoot, { recursive: true });
const distDir = resolve(outRoot, 'dist');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
const step = (n) => console.log(`\n▶ ${n}`);
const ok = (m) => console.log(`  ✓ ${m}`);
function check(cond, m) { if (!cond) { failed = true; console.log(`  ✗ ${m}`); throw new Error(m); } ok(m); }
const run = (cmd, a, opts = {}) => new Promise((res, rej) => { const p = spawn(cmd, a, { cwd: root, stdio: 'inherit', ...opts }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${a.join(' ')} → ${c}`)))); });

// ---- web test derlemesi
const vite = await import('vite');
if (!args.has('--no-build') || !existsSync(resolve(distDir, 'index.html'))) {
  process.env.VITE_ODI_E2E = '1';
  await vite.build({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: distDir, emptyOutDir: true } });
  delete process.env.VITE_ODI_E2E;
}
// ---- sunucu (aynı süreç: test yardımcısı veritabanına yazar)
const srvFile = resolve(outRoot, 'server-inproc.mjs');
await build({ entryPoints: [resolve(root, 'apps/server/src/server.ts')], outfile: srvFile, bundle: true, platform: 'node', target: 'node22', format: 'esm', external: ['bufferutil', 'utf-8-validate'], banner: { js: "import { createRequire as __r } from 'node:module'; const require = __r(import.meta.url);" }, logLevel: 'warning' });
const { startServer, configFromEnv } = await import(pathToFileURL(srvFile).href);
const srv = await startServer({ ...configFromEnv({ ODI_DB: ':memory:', ODI_TEST_STORE: '1', NODE_ENV: 'test' }), port: 8800 + Math.floor(Math.random() * 400), host: '127.0.0.1', log: false, sweepMs: 1000 });
const db = srv.app.db;
const pidOf = (name) => db.get('SELECT id FROM players WHERE name = ?', name)?.id;
const wsUrl = srv.url;
const wport = await new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const pv = await vite.preview({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: distDir }, preview: { port: wport, strictPort: true, host: '127.0.0.1' } });
const base = `http://127.0.0.1:${wport}/?sunucu=${encodeURIComponent(wsUrl)}`;
const cleanup = async () => { await pv.close().catch(() => undefined); await srv.close().catch(() => undefined); };

const errors = [];
const launch = (bt) => (bt === 'webkit' ? webkit : chromium).launch({ headless: !args.has('--headed'), executablePath: bt === 'chromium' ? process.env.PLAYWRIGHT_CHROMIUM || undefined : undefined, args: bt === 'chromium' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] : [] });
/** sayfaya eklenen kutlama sahneleri ve afişler: "tam bir kez" denetimi */
const OLAY = () => {
  const o = { cel: 0, banner: [] }; window.__olay = o;
  const scan = (n) => { if (!(n instanceof Element)) return; for (const c of [n, ...n.querySelectorAll('.cel-stage')]) if (c.matches('.cel-stage')) o.cel++; for (const t of [n, ...n.querySelectorAll('.toast-top')]) if (t.matches('.toast-top')) o.banner.push(t.querySelector('b')?.textContent ?? t.textContent ?? ''); };
  const start = () => new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) scan(n); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);
};
async function player(browser, bt, tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, ...(bt === 'chromium' ? { isMobile: true } : {}), locale: 'tr-TR', reducedMotion: 'reduce' });
  await ctx.addInitScript(() => {
    try { if (!localStorage.getItem('odi-v1')) { const progress = {}; for (let i = 1; i <= 10; i++) progress[i] = { stars: 3, best: 1000, plays: 1 }; localStorage.setItem('odi-v1', JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true }, progress }, version: 3 })); } } catch { /* yok */ }
  });
  const page = await ctx.newPage();
  await page.addInitScript(OLAY);
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|AudioContext|WebGL|GPU|Autoplay|WebSocket connection|ERR_CONNECTION|Failed to load resource|manifest/i.test(m.text())) errors.push(`${tag}: ${m.text()}`); });
  return page;
}
function suite(name) {
  const dir = resolve(outRoot, name); mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (f.endsWith('.png')) rmSync(resolve(dir, f));
  let n = 0;
  return async function shot(page, label, wait = 450) {
    await sleep(wait);
    const f = resolve(dir, `${String(++n).padStart(2, '0')}-${label}.png`);
    await page.screenshot({ path: f });
    const over = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.getElementById('root')?.scrollWidth ?? 0) - window.innerWidth);
    if (over > 0) errors.push(`${name}/${label}: yatay taşma ${over}px`);
    console.log(`  📸 ${f.replace(root + '/', '')}`);
  };
}
const tab = (page, label) => page.locator('nav.tabbar .tab', { hasText: label }).click();
const toastGone = async (page) => { for (let i = 0; i < 8 && await page.locator('.toast-top').count(); i++) { await page.locator('.toast-top').first().evaluate((el) => el.click(), undefined, { timeout: 500 }).catch(() => undefined); await sleep(150); } };
async function settle(page) {
  for (let i = 0; i < 12; i++) {
    if (!(await page.locator('.cel-root.on').count())) break;
    const cta = page.locator('.cel-cta button');
    if (await cta.count() && await cta.first().isVisible()) await cta.first().click().catch(() => undefined); else await page.mouse.click(195, 300).catch(() => undefined);
    await sleep(350);
  }
  await toastGone(page);
}
const kgRefresh = (page) => page.evaluate(() => window.__kg?.refresh());
/** sunucu tarafı hazırlık: 10 bölüm geçilmiş, kamp binaları */
function prepare(pid) {
  db.run('UPDATE players SET highest = 11, jeton = 5000, kristal = 50 WHERE id = ?', pid);
  for (const [id, l] of [['merkez', 2], ['depo', 1], ['revir', 1], ['laboratuvar', 1], ['kule', 1]]) db.run('UPDATE buildings SET level = ? WHERE player_id = ? AND id = ?', l, pid, id);
  db.run('UPDATE players SET depot_at = ? WHERE id = ?', Date.now() - 2 * 3_600_000, pid);
}
const claims = (pid, like) => db.get('SELECT COUNT(*) AS n FROM kg_claim WHERE player_id = ? AND ref LIKE ?', pid, like).n;

/** bir vakayı doğru çöz (anahtar testler + doğru tanı/yönetim; içerik sunucu paketinden) */
const cBundle = resolve(outRoot, 'content.mjs');
await build({ entryPoints: [resolve(root, 'packages/content/src/kamp-gorev.ts')], outfile: cBundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'warning' });
const C = await import(pathToFileURL(cBundle).href);

async function solveCase(page, shot, id, prefix) {
  const v = C.vakaById(id);
  await page.locator(`.kg-hasta-kart[data-vaka="${id}"]`).click();
  await page.locator('[data-testid="hasta-adim"]').waitFor();
  await shot(page, `${prefix}-hasta`, 400);
  await page.locator('[data-testid="testlere-gec"]').click();
  for (const t of v.anahtar) await page.locator(`.kg-test[data-test="${t}"]`).click();
  if (!v.anahtar.includes('odyometri')) await page.locator('.kg-test[data-test="odyometri"]').click();
  await page.locator('[data-sonuc="odyometri"] [data-testid="odyogram"]').waitFor();
  check(await page.locator('[data-testid="odyogram"] [data-ear="R"] circle').count() === 8 && await page.locator('[data-testid="odyogram"] [data-ear="L"] path').count() > 8, 'odyogram: sağ kırmızı O (8 frekans), sol mavi X, kemik yolu < >');
  await shot(page, `${prefix}-testler-odyogram`, 400);
  await page.locator('[data-testid="karara-gec"]').click();
  await page.locator(`.kg-opt[data-dx="${v.tani.dogru}"]`).click();
  await page.locator(`.kg-opt[data-mg="${v.yonetim[0].id}"]`).click();
  await shot(page, `${prefix}-karar`, 300);
  await page.locator('[data-testid="karar-gonder"]').click();
  await page.locator('[data-testid="vaka-sonuc"]').waitFor();
  return v;
}

try {
  for (const bt of browsers) {
    const browser = await launch(bt);
    const shot = suite(`gercek-${bt}`);
    const tagA = `Ayşe${bt[0]}`, tagB = `Bora${bt[0]}`;
    const A = await player(browser, bt, `A-${bt}`); const B = await player(browser, bt, `B-${bt}`);
    step(`1 · [${bt}] takma ad + takım; sunucuda 10 bölüm ve kamp binaları`);
    for (const [p, name, color] of [[A, tagA, 2], [B, tagB, 5]]) {
      await p.goto(base, { waitUntil: 'load' });
      await p.getByRole('button', { name: /Yola çık|Devam/ }).first().click();
      await p.locator('.onboard').waitFor({ timeout: 20_000 });
      await p.getByRole('textbox', { name: 'Takma ad' }).fill(name);
      await p.locator('.swatch').nth(color).click();
      await p.getByRole('button', { name: 'Başla' }).click();
      await p.locator('.onboard').waitFor({ state: 'detached' });
      await toastGone(p);
    }
    await tab(A, 'Takım'); await A.locator('.team-hero').waitFor();
    await A.getByRole('button', { name: '＋ Takım kur' }).first().click();
    await A.locator('.sheet').getByPlaceholder('ör. Koklea Kaşifleri').fill(`Klinik ${bt}`);
    await A.locator('.emoji-opt', { hasText: '🐚' }).click();
    await A.locator('.sheet').getByRole('button', { name: /Takımı kur/ }).click();
    await A.locator('.team-head').waitFor(); await toastGone(A);
    await A.getByLabel('Takım menüsü').click();
    const code = (await A.locator('.big-code').innerText()).trim();
    await A.locator('.sheet-wrap').click({ position: { x: 10, y: 10 } });
    await tab(B, 'Takım'); await B.getByLabel('Takım davet kodu').fill(code);
    await B.locator('.code-join').getByRole('button', { name: 'Katıl' }).click();
    await B.locator('.team-head').waitFor(); await toastGone(B);
    const aId = pidOf(tagA), bId = pidOf(tagB); check(!!aId && !!bId, 'oyuncular sunucuda');
    prepare(aId); prepare(bId);

    step(`2 · [${bt}] Kamp: Görevler + Klinik düğmeleri; Kulak Deposu toplanır → hikâye 1. bölüm biter`);
    await tab(A, 'Kamp'); await A.locator('.camp-base').waitFor({ timeout: 25_000 }); await kgRefresh(A);
    await A.locator('[data-testid="kg-btn"]').waitFor({ timeout: 10_000 });
    check(await A.locator('[data-testid="klinik-btn"]').count() === 1, 'Klinik düğmesi (hasta bekliyor)');
    await shot(A, 'kamp-gorev-dugmeleri', 1500);
    await A.getByRole('button', { name: 'Liste görünümü' }).click();
    await A.locator('.card.depot button.btn').first().click();
    for (let i = 0; i < 30 && !(await A.locator('[data-testid="kg-rozet"]').count()); i++) await sleep(200);
    check(await A.locator('[data-testid="kg-rozet"]').count() === 1, 'rozet: ödül hazır (depo toplama sayıldı, sunucu itmesi)');
    await toastGone(A);

    step(`3 · [${bt}] Hikâye ödülü: iki hızlı dokunuş → bir ödül, bir kutlama`);
    await A.locator('[data-testid="kg-btn"]').click();
    await A.locator('[data-testid="kg-panel"]').waitFor();
    await A.locator('[data-tab="hikaye"]').click();
    await A.locator('[data-testid="kg-story"][data-bolum="1"]').waitFor();
    await shot(A, 'gorev-hikaye-1', 500);
    const jeton0 = db.get('SELECT jeton FROM players WHERE id = ?', aId).jeton;
    const cel0 = await A.evaluate(() => window.__kg.celebrations());
    const btn = A.locator('[data-testid="kg-al"][data-ref="hikaye:1"]');
    await btn.evaluate((el) => { el.click(); el.click(); });
    await A.locator('[data-testid="kg-bolum-son"]').waitFor({ timeout: 8000 });
    await sleep(800);
    check(claims(aId, 'hikaye:1') === 1, 'sunucu: hikaye:1 bir kez alındı');
    check(db.get('SELECT jeton FROM players WHERE id = ?', aId).jeton === jeton0 + 80, 'cüzdan: +80 (bir kez)');
    check((await A.evaluate(() => window.__kg.celebrations())) - cel0 === 1, 'kutlama tam bir kez (iki dokunuş, bir ödül)');
    check(await A.evaluate(() => window.__olay.cel) >= 1, 'sandık kutlaması ekranda');
    await shot(A, 'gorev-hikaye-kutlama', 300);
    await settle(A);
    await shot(A, 'gorev-hikaye-bolum-son', 300);

    step(`4 · [${bt}] Günlük görev: depo görevi tamam → Al (bir kez); bir görev değiştir`);
    const day = srv.app.db.get("SELECT day FROM kg_daily WHERE player_id = ?", aId)?.day;
    db.run('UPDATE kg_daily SET tasks = ? WHERE player_id = ?', JSON.stringify(['g-depo', 'g-ton', 'g-vaka']), aId);
    await kgRefresh(A);
    await A.locator('[data-tab="gunluk"]').click();
    await A.locator('[data-gorev="g-depo"] [data-testid="kg-al"]').waitFor({ timeout: 8000 });
    await shot(A, 'gorev-gunluk', 400);
    const celD = await A.evaluate(() => window.__kg.celebrations()); const banD = await A.evaluate(() => window.__olay.banner.filter((b) => /Kamp görevi/.test(b)).length);
    await A.locator('[data-gorev="g-depo"] [data-testid="kg-al"]').click();
    await A.locator('[data-gorev="g-depo"] .kg-alindi').waitFor({ timeout: 8000 });
    check(claims(aId, `gunluk:${day}:g-depo`) === 1, 'sunucu: günlük görev bir kez alındı');
    await sleep(600);
    check((await A.evaluate(() => window.__olay.banner.filter((b) => /Kamp görevi/.test(b)).length)) - banD === 1 && (await A.evaluate(() => window.__kg.celebrations())) - celD === 1, 'günlük görev: tek kutlama, tek afiş');
    await A.locator('[data-gorev="g-ton"] [data-testid="kg-degistir"]').click();
    await A.locator('[data-gorev="g-ton"]').waitFor({ state: 'detached', timeout: 8000 });
    check(await A.locator('[data-testid="kg-degistir"]').count() === 0, 'değiştirme hakkı kullanıldı (bir kez)');
    await toastGone(A);

    step(`5 · [${bt}] Klinik: ilk hasta → testler → tanı + yönetim → 3 yıldız`);
    await A.locator('[data-tab="etkinlik"]').click();
    await shot(A, 'gorev-etkinlik', 400);
    await A.locator('[data-testid="etk-klinik"]').click();
    await A.locator('[data-testid="klinik-panel"]').waitFor();
    await shot(A, 'klinik-salon', 500);
    const v1 = await solveCase(A, shot, 'kv01', 'vaka1');
    check(await A.locator('[data-testid="vaka-sonuc"]').getAttribute('data-stars') === '3', `${v1.baslik}: 3 yıldız`);
    check(await A.locator('[data-testid="vaka-terim"]').count() === 1, 'sonuçta Kulak Sözlüğü terimi');
    check(db.get("SELECT stars FROM kv_book WHERE player_id = ? AND case_id = 'kv01'", aId)?.stars === 3, 'sunucu: Vaka Defteri 3 yıldız');
    await shot(A, 'vaka1-sonuc', 600);
    await settle(A);
    await A.locator('[data-testid="salona-don"]').click();
    await A.locator('[data-testid="defter-tab"]').click();
    await A.locator('[data-testid="vaka-defteri"]').waitFor();
    await shot(A, 'vaka-defteri', 400);
    await A.locator('.kg-tabs [role="tab"]').first().click();

    step(`6 · [${bt}] Konsültasyon: A danışır → B takım sohbetinde hazır seçenekle oy verir`);
    await A.locator('.kg-hasta-kart[data-vaka="kv02"]').click();
    await A.locator('[data-testid="testlere-gec"]').click();
    await A.locator('.kg-test[data-test="otoskopi"]').click();
    await A.locator('[data-testid="konsult-iste"]').click();
    await A.locator('[data-testid="konsult-durum"]').waitFor({ timeout: 8000 });
    await tab(B, 'Takım'); await B.locator('.team-head').waitFor();
    const card = B.locator('[data-testid="konsult-karti"]').last();
    await card.waitFor({ timeout: 15_000 }); await card.scrollIntoViewIfNeeded();
    await shot(B, 'konsult-kart', 500);
    const opts = C.konsultSecenekleri(C.vakaById('kv02')); const right = opts.findIndex((o) => o.id === 'serumen');
    const jB = db.get('SELECT jeton FROM players WHERE id = ?', bId).jeton;
    await card.locator(`.kg-ks-opt[data-choice="${right}"]`).click();
    for (let i = 0; i < 30 && !db.get('SELECT 1 AS x FROM kv_oy WHERE player_id = ?', bId); i++) await sleep(200);
    check(!!db.get('SELECT 1 AS x FROM kv_oy WHERE player_id = ?', bId), 'B oy verdi (sunucu)');
    check(db.get('SELECT jeton FROM players WHERE id = ?', bId).jeton === jB + C.KG_ODUL.konsultOy.jeton, 'B görüş ödülü aldı');
    await sleep(500); await settle(B);
    await shot(B, 'konsult-oy-sonrasi', 300);
    for (let i = 0; i < 30 && !(await A.locator('[data-testid="konsult-durum"]').innerText()).includes(' 1'); i++) await sleep(200);
    check((await A.locator('[data-testid="konsult-durum"]').innerText()).includes(' 1'), 'A takımının görüşünü görüyor');
    await shot(A, 'konsult-a-gorus', 300);
    await A.locator('.kg-sheet .bp-x').click();

    step(`7 · [${bt}] Ton Avı ve Timpanogram Eşleştir birer tur`);
    await A.locator('[data-testid="kg-btn"]').click(); await A.locator('[data-tab="etkinlik"]').click();
    await A.locator('[data-testid="etk-ton"]').click();
    await A.locator('[data-testid="oyun-ton"]').waitFor();
    await shot(A, 'ton-giris', 300);
    await A.locator('[data-testid="oyun-basla"]').click();
    await A.locator('[data-testid="ton-tur"]').waitFor();
    for (let i = 0; i < 8; i++) {
      await A.locator(`[data-testid="ton-tur"][data-deneme="${i}"][data-faz="cevap"]`).waitFor({ timeout: 10_000 });
      if (i === 0) await shot(A, 'ton-deneme', 0);
      await A.locator('[data-testid="ton-tur"] [data-cevap="1"]').click();
    }
    await A.locator('[data-testid="oyun-sonuc"]').waitFor({ timeout: 10_000 });
    check(db.get("SELECT COUNT(*) AS n FROM ko_round WHERE player_id = ? AND game = 'ton' AND done = 1", aId).n === 1, 'Ton Avı turu sunucuda bitti');
    await settle(A); await shot(A, 'ton-sonuc', 300);
    await A.locator('.kg-sheet .bp-x').click();
    await A.locator('[data-testid="kg-btn"]').click(); await A.locator('[data-tab="etkinlik"]').click();
    await A.locator('[data-testid="etk-timpano"]').click();
    await A.locator('[data-testid="oyun-basla"]').click();
    for (let i = 0; i < 5; i++) {
      await A.locator(`[data-testid="timpano-tur"][data-bulmaca="${i}"] .kg-opt:not([disabled])`).first().waitFor({ timeout: 10_000 });
      if (i === 0) await shot(A, 'timpano-bulmaca', 200);
      await A.locator('[data-testid="timpano-tur"] .kg-opt').first().click();
      await sleep(1700);
    }
    await A.locator('[data-testid="oyun-sonuc"]').waitFor({ timeout: 10_000 });
    check(db.get("SELECT COUNT(*) AS n FROM ko_round WHERE player_id = ? AND game = 'timpano' AND done = 1", aId).n === 1, 'Timpanogram Eşleştir turu sunucuda bitti');
    await settle(A); await shot(A, 'timpano-sonuc', 300);
    await browser.close();
  }

  // ======================================================================== dom hedefi
  if (!args.has('--no-dom') && browsers.includes('chromium')) {
    step('D · dom hedefi (Expo DOM telefon paketi): Görevler paneli, Klinik, vaka akışı');
    const mobileDist = resolve(root, 'apps/mobile/dist');
    if (args.has('--build-dom') || !existsSync(resolve(mobileDist, 'www.bundle'))) { rmSync(mobileDist, { recursive: true, force: true }); await run('npx', ['expo', 'export', '--platform', 'ios', '--output-dir', 'dist', '--clear'], { cwd: resolve(root, 'apps/mobile') }); }
    const dir = resolve(mobileDist, 'www.bundle'); const domHtml = pathToFileURL(resolve(dir, readdirSync(dir).find((f) => f.endsWith('.html')))).href;
    const browser = await launch('chromium'); const shot = suite('dom-chromium');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'tr-TR', reducedMotion: 'reduce' });
    await ctx.addInitScript(([serverUrl]) => {
      const progress = {}; for (let i = 1; i <= 10; i++) progress[i] = { stars: 3, best: 1000, plays: 1 };
      const store = { 'odi-v1': JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true }, progress }, version: 3 }) };
      window.ReactNativeWebView = {
        injectedObjectJson: () => JSON.stringify({ EXPO_DOM_HOST_OS: 'ios', initialProps: { names: ['getItem', 'setItem', 'removeItem', 'haptic', 'share'], props: { serverUrl, canPurchase: false, insetTop: 47, insetBottom: 34 } } }),
        postMessage: (s) => { try { const m = JSON.parse(s); if (m.type !== '$$native_action') return; const [k, v] = m.data.args ?? []; let result = null; if (m.data.actionId === 'getItem') result = store[k] ?? null; if (m.data.actionId === 'setItem') store[k] = v; if (m.data.actionId === 'removeItem') delete store[k]; setTimeout(() => window.dispatchEvent(new CustomEvent('$$dom_event', { detail: { type: '$$native_action_result', data: { uid: m.data.uid, actionId: m.data.actionId, result } } })), 0); } catch { /* yok */ } },
      };
    }, [wsUrl]);
    const D = await ctx.newPage(); await D.addInitScript(OLAY);
    D.on('pageerror', (e) => errors.push(`dom: ${e.message}`));
    await D.goto(domHtml, { waitUntil: 'load' });
    await D.getByRole('button', { name: /Yola çık|Devam/ }).first().click();
    if (await D.locator('.onboard').waitFor({ timeout: 8000 }).then(() => true, () => false)) {
      await D.getByRole('textbox', { name: 'Takma ad' }).fill('Domcu'); await D.getByRole('button', { name: 'Başla' }).click(); await D.locator('.onboard').waitFor({ state: 'detached' });
    }
    for (let i = 0; i < 40 && !pidOf('Domcu'); i++) await sleep(250);
    prepare(pidOf('Domcu'));
    await toastGone(D); await tab(D, 'Kamp'); await D.locator('.camp-base').waitFor({ timeout: 25_000 }); await kgRefresh(D);
    await D.locator('[data-testid="kg-btn"]').waitFor({ timeout: 10_000 });
    await shot(D, 'dom-kamp', 1500);
    await D.locator('[data-testid="kg-btn"]').click(); await D.locator('[data-testid="kg-panel"]').waitFor();
    await D.locator('[data-tab="gunluk"]').click(); await shot(D, 'dom-gunluk', 400);
    await D.locator('.kg-sheet .bp-x').click();
    await D.locator('[data-testid="klinik-btn"]').click(); await D.locator('[data-testid="klinik-panel"]').waitFor();
    await shot(D, 'dom-klinik', 400);
    const v = await solveCase(D, shot, 'kv01', 'dom-vaka');
    check(await D.locator('[data-testid="vaka-sonuc"]').getAttribute('data-stars') === '3', `dom: ${v.baslik} 3 yıldız`);
    await shot(D, 'dom-vaka-sonuc', 500);
    await browser.close();
  }
} catch (e) {
  failed = true;
  console.error('\nHATA:', e.stack ?? e.message);
} finally {
  await cleanup();
}
const realErrors = errors.filter((e) => !/WebSocket/i.test(e));
if (realErrors.length) { console.log('\nKonsol/taşma uyarıları:'); for (const e of [...new Set(realErrors)]) console.log('  · ' + e); }
console.log(`\n${failed ? '✗ Başarısız' : '✓ Tüm adımlar geçti'} → ${outRoot.replace(root + '/', '')}`);
process.exit(failed || realErrors.length ? 1 : 0);
