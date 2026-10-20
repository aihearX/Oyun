#!/usr/bin/env node
// Kulak Kampı uçtan uca testi: gerçek sunucu (bellek içi veritabanı, ODI_DB=:memory: ODI_TEST_STORE=1; aynı süreçte çalışır ki
// test yardımcısı veritabanına doğrudan yazabilsin) + web derlemesi + iki tarayıcı oyuncusu.
// A) Önizleme: ?demo=kamp&seviye=1|5|10|15 → farklı kamp seviyeleri (390×844).
// B) Gerçek akış: B kampı açar → Kamp Merkezi'ne dokunur (kanvas) → panel → Yükselt (iskele + sayaç) → takımdan yardım ister
//    → A "Herkese yardım et" → B'nin süresi kısalır (kalp/el uçuşu) → B kristalle bitirir (bitiş animasyonu) → depo dolu → Topla (jeton uçuşu)
//    → liste görünümü → sunucusuz nazik kart.
// Kullanım: node tools/harness/camp-e2e.mjs [--no-build] [--only demo|real] [--headed]
// Çıktı: tools/harness/out/kamp/*.png
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const argv = process.argv.slice(2); const args = new Set(argv);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const root = resolve(new URL('../..', import.meta.url).pathname);
const outDir = resolve(root, 'tools/harness/out/kamp'); mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (f.endsWith('.png')) rmSync(resolve(outDir, f));
const distDir = resolve(outDir, 'dist');
const procs = [];
const run = (cmd, a, opts = {}) => new Promise((res, rej) => { const p = spawn(cmd, a, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...opts }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${a.join(' ')} → ${c}`)))); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
const step = (n) => console.log(`\n▶ ${n}`);
const ok = (m) => console.log(`  ✓ ${m}`);
function check(cond, m) { if (!cond) { failed = true; console.log(`  ✗ ${m}`); throw new Error(m); } ok(m); }

if (!args.has('--no-build') || !existsSync(resolve(distDir, 'index.html'))) await run('npx', ['vite', 'build', '--outDir', distDir, '--emptyOutDir', '--logLevel', 'warn'], { cwd: resolve(root, 'apps/web') });

// ---- sunucu: aynı süreçte (test yardımcısı veritabanına yazar)
const srvFile = resolve(outDir, 'server-inproc.mjs');
await build({ entryPoints: [resolve(root, 'apps/server/src/server.ts')], outfile: srvFile, bundle: true, platform: 'node', target: 'node22', format: 'esm', external: ['bufferutil', 'utf-8-validate'], banner: { js: "import { createRequire as __r } from 'node:module'; const require = __r(import.meta.url);" }, logLevel: 'warning' });
const { startServer, configFromEnv } = await import(pathToFileURL(srvFile).href);
const sport = 8800 + Math.floor(Math.random() * 400);
const srv = await startServer({ ...configFromEnv({ ODI_DB: ':memory:', ODI_TEST_STORE: '1', NODE_ENV: 'test' }), port: sport, host: '127.0.0.1', log: false, sweepMs: 1000 });
const db = srv.app.db;
/** test yardımcısı: oyuncuyu adıyla bul, alanlarını doğrudan yaz */
const pidOf = (name) => db.get('SELECT id FROM players WHERE name = ?', name)?.id;
const wsUrl = srv.url;

// ---- web önizleme
// boş bir port (eski, sahipsiz bir önizleme sunucusuna denk gelip eski derlemeyi görmeyelim)
const wport = await new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const preview = spawn('npx', ['vite', 'preview', '--port', String(wport), '--strictPort', '--outDir', distDir], { cwd: resolve(root, 'apps/web'), stdio: 'ignore', shell: process.platform === 'win32', detached: process.platform !== 'win32' });
procs.push(preview);
await sleep(1800);
const host = `http://localhost:${wport}`;
const base = `${host}/?sunucu=${encodeURIComponent(wsUrl)}`;
const cleanup = async () => { for (const p of procs) { try { if (process.platform !== 'win32') process.kill(-p.pid); else p.kill(); } catch { try { p.kill(); } catch { /* yok */ } } } await srv.close().catch(() => undefined); };

const browser = await chromium.launch({ headless: !args.has('--headed'), executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
async function player(tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(process.env.E2E_DSF ?? 2), isMobile: true, hasTouch: true, locale: 'tr-TR' });
  // ilk açılış rehberini (hikâye + anlatıcı turları + kilitler) atla: bu test başka bir akışı sınar (bkz. onboarding-e2e.mjs)
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('odi-v1')) localStorage.setItem('odi-v1', JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true } }, version: 3 })); } catch { /* depolama yok */ } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|AudioContext|WebGL|GPU|Autoplay|WebSocket connection|ERR_CONNECTION/i.test(m.text())) errors.push(`${tag}: ${m.text()}`); });
  return page;
}
let shotN = 0;
async function shot(page, name, wait = 450) {
  await sleep(wait);
  const f = resolve(outDir, `${String(++shotN).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: f });
  const over = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.getElementById('root')?.scrollWidth ?? 0) - window.innerWidth);
  if (over > 0) { errors.push(`${name}: yatay taşma ${over}px`); console.log(`  ⚠ ${name}: yatay taşma ${over}px`); }
  console.log(`  📸 ${f.replace(root + '/', '')}`);
}
const tab = (page, label) => page.locator('nav.tabbar .tab', { hasText: label }).click();
const toastGone = async (page) => { for (let i = 0; i < 8 && await page.locator('.toast-top').count(); i++) { await page.locator('.toast-top').first().click({ timeout: 500 }).catch(() => undefined); await sleep(150); } };
const campReady = async (page) => { await page.locator('.camp-base').waitFor({ timeout: 20_000 }); await page.waitForFunction(() => !!window.__kamp && !!window.__kamp.pos('merkez'), null, { timeout: 20_000 }); await page.locator('.camp-loading').waitFor({ state: 'detached', timeout: 20_000 }); };
/** binaya kanvas üzerinden dokun (gerçek dokunuş) */
async function tapBuilding(page, id) {
  const p = await page.evaluate((b) => window.__kamp.pos(b), id);
  await page.touchscreen.tap(p.x, p.y + 10);
}
const builderLeft = async (page) => { const t = (await page.locator('.hud-chip.builder b').innerText().catch(() => '')).trim(); const m = t.match(/(?:(\d+) sa )?(\d+)(?::| dk)(\d+)?/); if (!m) return null; return t.includes('sa') ? Number(m[1]) * 3600 + Number(m[2]) * 60 : Number(m[2]) * 60 + Number(m[3] ?? 0); };

try {
  if (only !== 'real') {
    step('A · Önizleme: kamp seviyeleri 1, 5, 10, 15');
    const P = await player('önizleme');
    for (const L of [1, 5, 10, 15]) {
      await P.goto(`${host}/?demo=kamp&seviye=${L}&sunucu=${encodeURIComponent('ws://127.0.0.1:9')}`, { waitUntil: 'load' });
      await P.getByRole('button', { name: /Yola çık|Devam/ }).first().click();
      await tab(P, 'Kamp');
      await campReady(P);
      await toastGone(P);
      await shot(P, `kamp-sv${String(L).padStart(2, '0')}`, 1600);
      if (L === 10) {
        await tapBuilding(P, 'laboratuvar');
        await P.locator('.bp').waitFor();
        await shot(P, 'panel-onizleme-lab', 1800);
        await P.locator('.bp-x').click();
      }
    }
    await P.goto(`${host}/?demo=kamp&seviye=8&insaat=kule&sunucu=${encodeURIComponent('ws://127.0.0.1:9')}`, { waitUntil: 'load' });
    await P.getByRole('button', { name: /Yola çık|Devam/ }).first().click(); await tab(P, 'Kamp'); await campReady(P); await toastGone(P);
    await shot(P, 'onizleme-insaat-kule', 1600);
    await P.close();
  }

  if (only !== 'demo') {
    const A = await player('A'); const B = await player('B');
    step('B1 · Takma ad + takım (A kurar, B kodla katılır)');
    for (const [p, name, color] of [[A, 'Ayşe', 2], [B, 'Bora', 5]]) {
      await p.goto(base, { waitUntil: 'load' });
      await p.getByRole('button', { name: /Yola çık/ }).click();
      await p.locator('.onboard').waitFor({ timeout: 15_000 });
      await p.getByRole('textbox', { name: 'Takma ad' }).fill(name);
      await p.locator('.swatch').nth(color).click();
      await p.getByRole('button', { name: 'Başla' }).click();
      await p.locator('.onboard').waitFor({ state: 'detached' });
      await toastGone(p);
    }
    await tab(A, 'Takım'); await A.locator('.team-hero').waitFor();
    await A.getByRole('button', { name: '＋ Takım kur' }).first().click();
    await A.locator('.sheet').getByPlaceholder('ör. Koklea Kaşifleri').fill('Kulak Kampçıları');
    await A.locator('.emoji-opt', { hasText: '🐚' }).click();
    await A.locator('.sheet').getByRole('button', { name: /Takımı kur/ }).click();
    await A.locator('.team-head').waitFor(); await toastGone(A);
    await A.getByLabel('Takım menüsü').click();
    const code = (await A.locator('.big-code').innerText()).trim();
    await A.locator('.sheet-wrap').click({ position: { x: 10, y: 10 } });
    await tab(B, 'Takım'); await B.getByLabel('Takım davet kodu').fill(code);
    await B.locator('.code-join').getByRole('button', { name: 'Katıl' }).click();
    await B.locator('.team-head').waitFor(); await toastGone(B);
    ok(`takım kodu ${code}, B katıldı`);

    // test yardımcısı: B'ye inşaat için jeton/kristal (doğrudan veritabanına)
    const bId = pidOf('Bora'); check(!!bId, 'B sunucuda bulundu');
    db.run('UPDATE players SET jeton = 5000, kristal = 400, m5 = 3, m60 = 1 WHERE id = ?', bId); srv.app.walletChanged(bId);

    step('B2 · Kamp açılır (üs görünümü)');
    await tab(B, 'Kamp'); await campReady(B); await toastGone(B);
    await shot(B, 'B-kamp-acilis', 1500);

    step('B3 · Kamp Merkezi\'ne dokun → panel → Yükselt');
    await tapBuilding(B, 'merkez');
    await B.locator('.bp').waitFor();
    check((await B.locator('.bp h2').innerText()).includes('Kamp Merkezi'), 'panel: Kamp Merkezi');
    await shot(B, 'B-panel-merkez', 1800);
    await B.locator('.bp').getByRole('button', { name: /Yükselt/ }).click();
    await B.locator('.bp-build').waitFor({ timeout: 8000 });
    ok('inşaat başladı (panelde geri sayım)');
    await B.locator('.bp').getByRole('button', { name: /Takımdan yardım iste/ }).click();
    await B.locator('.bp').getByRole('button', { name: /Yardım istendi/ }).waitFor({ timeout: 8000 });
    ok('takımdan yardım istendi');
    await B.locator('.bp-x').click(); await toastGone(B);
    await shot(B, 'B-insaat-iskele-sayac', 1400);
    const left0 = await builderLeft(B);
    check(left0 != null && left0 > 60, `sayaç çalışıyor: ${left0} sn`);

    step('B4 · A kampından "Herkese yardım et" → B\'nin süresi kısalır');
    await tab(A, 'Kamp'); await campReady(A); await toastGone(A);
    await A.getByRole('button', { name: /Herkese yardım et \(1\)/ }).waitFor({ timeout: 8000 });
    await shot(A, 'A-kamp-yardim-bekliyor', 800);
    await A.getByRole('button', { name: /Herkese yardım et/ }).click({ force: true });
    await sleep(1100);
    await shot(B, 'B-yardim-ucusu', 0);
    await sleep(1200);
    const left1 = await builderLeft(B);
    check(left1 != null && left1 <= left0 - 55, `süre kısaldı: ${left0} sn → ${left1} sn`);
    await toastGone(B);
    await shot(B, 'B-yardim-sonrasi', 300);
    await tab(A, 'Bugün'); // A'nın sahnesi kapanır (Phaser yok edilir)

    step('B5 · Kristalle bitir → bitiş animasyonu');
    await tapBuilding(B, 'merkez'); await B.locator('.bp').waitFor();
    await B.locator('.bp').getByRole('button', { name: /ile bitir/ }).click();
    await B.locator('.bp-x').click();
    await sleep(700);
    await shot(B, 'B-bitis-ani', 0);
    await sleep(1600);
    await toastGone(B);
    await shot(B, 'B-bitis-sonrasi', 200);
    await tapBuilding(B, 'merkez'); await B.locator('.bp').waitFor();
    check((await B.locator('.bp-tier').innerText()).includes('Sv 2'), 'Kamp Merkezi Sv 2');
    await B.locator('.bp-x').click();

    step('B6 · Depo dolu → Topla (jeton uçuşu)');
    db.run("UPDATE buildings SET level = 3 WHERE player_id = ? AND id = 'depo'", bId);
    db.run('UPDATE players SET depot_at = ? WHERE id = ?', Date.now() - 9 * 3_600_000, bId);
    await tab(B, 'Takım'); await sleep(300); await tab(B, 'Kamp'); await campReady(B); await toastGone(B);
    await shot(B, 'B-depo-dolu', 1500);
    const coinsBefore = (await B.locator('.tb-pill[data-hud="jeton"]').innerText()).trim();
    await tapBuilding(B, 'depo'); await B.locator('.bp').waitFor();
    if (process.env.DEBUG_KAMP) console.log('kamera', JSON.stringify(await B.evaluate(() => window.__kamp.view())), JSON.stringify(await B.evaluate(() => window.__kamp.pos('depo'))));
    await shot(B, 'B-panel-depo', 1800);
    await B.locator('.bp').getByRole('button', { name: /Topla/ }).click();
    await sleep(350);
    await shot(B, 'B-depo-topla-ucus', 0);
    await sleep(900);
    const coinsAfter = (await B.locator('.tb-pill[data-hud="jeton"]').innerText()).trim();
    check(coinsAfter !== coinsBefore, `jeton: ${coinsBefore} → ${coinsAfter}`);
    await B.locator('.bp-x').click();

    step('B7 · Liste görünümü (erişilebilirlik) ve geri');
    await B.getByRole('button', { name: 'Liste görünümü' }).click();
    await B.locator('.building').first().waitFor();
    check(await B.locator('.building').count() === 6, '6 bina kartı');
    await shot(B, 'B-liste', 400);
    await B.getByRole('button', { name: 'Üs görünümü' }).click();
    await campReady(B);

    const fps = await B.evaluate(() => new Promise((r) => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 2000) requestAnimationFrame(f); else r(Math.round(n / 2)); }; requestAnimationFrame(f); }));
    console.log(`  · rAF ${fps}/sn (yazılım GL; gerçek cihazda GPU ile ölçülmeli)`);

    step('B8 · Sunucusuz: nazik kart');
    const off = await player('Ç');
    await off.goto(`${host}/?sunucu=${encodeURIComponent('ws://127.0.0.1:9')}`, { waitUntil: 'load' });
    await off.getByRole('button', { name: /Yola çık/ }).click();
    await tab(off, 'Kamp');
    await off.locator('.camp-offline').waitFor({ timeout: 20_000 });
    check((await off.locator('.camp-offline').innerText()).includes('bağlanınca görünür'), 'çevrimdışı kartı + Tekrar dene');
    await shot(off, 'cevrimdisi-kamp');
  }
} catch (e) {
  failed = true;
  console.error('\nHATA:', e.message);
} finally {
  await browser.close().catch(() => undefined);
  await cleanup();
}
const realErrors = errors.filter((e) => !/WebSocket/i.test(e));
if (realErrors.length) { console.log('\nKonsol/taşma uyarıları:'); for (const e of [...new Set(realErrors)]) console.log('  · ' + e); }
console.log(`\n${failed ? '✗ Başarısız' : '✓ Tüm adımlar geçti'} · ${shotN} ekran görüntüsü → ${outDir.replace(root + '/', '')}`);
process.exit(failed || realErrors.length ? 1 : 0);
