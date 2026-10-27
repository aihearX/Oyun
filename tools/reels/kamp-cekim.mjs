#!/usr/bin/env node
/**
 * Reels (3. dalga) için oyunun yeni ekranlarından gerçek görüntü çekimi: büyüyen kamp, Kulak Yolu anıtları, Hasta Vakaları, kamp oyunları.
 * Sahte ekran yok: hepsi oyunun kendi çizimi ve arayüzü. Oyuncu verisi yok (kamp önizlemesi `?demo=kamp` yerel sahte durum; vaka ve oyun
 * çekimleri bellek içi veritabanlı sunucuda tek bir örnek oyuncuyla — vaka-e2e.mjs ile aynı yol). Yönetici modu kullanılmaz.
 *
 * Kullanım: PLAYWRIGHT_CHROMIUM=… node tools/reels/kamp-cekim.mjs [--only zaman,ada,anit,susle,vaka,oyun] [--no-build]
 * Çıktı: tools/harness/out/reels3/cekim/<bölüm>/… (+ <bölüm>/index.json: kamera görünümü, ekran konumları)
 *   zaman  Kamp önizlemesi Sv 1..25 (Kamp Sv ≈ 1,2 × Sv), Odyoloji Merkezi ortada, sabit kadraj, 1080×1920 (yalnız oyun tuvali)
 *   ada    Sv 25 / Kamp Sv 30: Merkez'den bütün takımadaya yakınlaştırma basamakları (her biri ×0,9; kamera görünümü kayıtlı)
 *   anit   Kulak Yolu (10 anıt) sahnede + her anıtın oyun çiziminden yüksek çözünürlüklü PNG'si (paintMonument)
 *   susle  Süsle kipi (önizleme)
 *   vaka   Odyoloji Kliniği: kv11 ve kv19 vakalarının hasta, test (otoskopi, timpanometri, refleks, odyometri) ekranları; odyoloji düzeyi
 *   oyun   Ton Avı ve Timpanogram Eşleştir ekranları
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1]; };
const ONLY = opt('only', 'zaman,ada,anit,susle,vaka,oyun').split(',');
const want = (s) => ONLY.includes(s);
const root = resolve(new URL('../..', import.meta.url).pathname);
const webRoot = resolve(root, 'apps/web');
const OUT = resolve(root, 'tools/harness/out/reels3/cekim'); mkdirSync(OUT, { recursive: true });
const distDir = resolve(root, 'tools/harness/out/reels3/dist');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[çekim]', ...a);

const vite = await import('vite');
if (!argv.includes('--no-build') || !existsSync(resolve(distDir, 'index.html'))) {
  process.env.VITE_ODI_E2E = '1';
  await vite.build({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: distDir, emptyOutDir: true } });
  delete process.env.VITE_ODI_E2E;
}
const wport = await new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const pv = await vite.preview({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: distDir }, preview: { port: wport, strictPort: true, host: '127.0.0.1' } });
const host = `http://127.0.0.1:${wport}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ALL = ['dis-kulak', 'kanal', 'zar', 'kemikcikler', 'koklea-1', 'koklea-2', 'koklea-3', 'sinir', 'beyin-sapi', 'korteks'];

/** yalnız oyun tuvali görünsün (üst bant, önizleme etiketi, alt düğmeler, sekme çubuğu gizli) */
const CANVAS_ONLY = 'body * { visibility: hidden !important; } .camp-base canvas { visibility: visible !important; }';

async function campPage({ w = 480, h = 853, dsf = 2.25, knowledge = 'genel' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, locale: 'tr-TR' });
  await ctx.addInitScript(([seen, kn]) => {
    try {
      const progress = {}; for (let i = 1; i <= 39; i++) progress[i] = { stars: 3, best: 1000, plays: 1 };
      localStorage.setItem('odi-v1', JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true }, progress, knowledge: kn, sounds: false }, version: 3 }));
      localStorage.setItem('odi.kamp.anitlar', JSON.stringify(seen));
      for (const k of ['seviyeTanitim', 'susTanitim', 'ziyaretTanitim']) localStorage.setItem('odi.kamp.' + k, '1');
    } catch { /* yok */ }
  }, [ALL, knowledge]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('sayfa hatası:', e.message));
  return page;
}
async function openDemo(page, L, K) {
  await page.goto(`${host}/?demo=kamp&seviye=${L}&kampsv=${K}&sunucu=${encodeURIComponent('ws://127.0.0.1:5')}`, { waitUntil: 'load' });
  await page.getByRole('button', { name: /Yola çık|Devam/ }).first().click();
  await page.locator('nav.tabbar .tab', { hasText: 'Kamp' }).click();
  await page.locator('.camp-base').waitFor({ timeout: 40_000 });
  await page.waitForFunction(() => !!window.__kamp && !!window.__kamp.pos('merkez') && !!window.__kamp.view(), null, { timeout: 40_000 });
  await page.locator('.camp-loading').waitFor({ state: 'detached', timeout: 40_000 });
  for (let i = 0; i < 10 && await page.locator('.cel-root.on').count(); i++) { await page.mouse.click(240, 300).catch(() => undefined); await sleep(300); }
  await page.addStyleTag({ content: CANVAS_ONLY });
  await sleep(1500);
}
const view = (page) => page.evaluate(() => window.__kamp.view());
/** yakınlaştırma: tekerlek adımı ×0,9 / ×1,1 (ekran ortasında) */
async function zoomTo(page, z, W, H) {
  for (let i = 0; i < 60; i++) {
    const v = await view(page); const r = z / v.zoom;
    if (r < 0.95) await page.mouse.move(W / 2, H / 2).then(() => page.mouse.wheel(0, 120));
    else if (r > 1.05) await page.mouse.move(W / 2, H / 2).then(() => page.mouse.wheel(0, -120));
    else break;
    await sleep(60);
  }
  await sleep(200);
}
/** kamerayı dünya noktasına kaydır (sürükleme; kayma durulana dek) */
async function panTo(page, x, y, W, H) {
  for (let k = 0; k < 6; k++) {
    const v = await view(page); const dx = (v.x - x) * v.zoom, dy = (v.y - y) * v.zoom;
    if (Math.abs(dx) < 1.2 && Math.abs(dy) < 1.2) break;
    const n = Math.max(8, Math.ceil(Math.hypot(dx, dy) / 25));
    await page.mouse.move(W / 2, H / 2); await page.mouse.down();
    for (let i = 1; i <= n; i++) { await page.mouse.move(W / 2 + (dx * i) / n, H / 2 + (dy * i) / n); await sleep(16); }
    await sleep(250); await page.mouse.up(); await sleep(900);
  }
}

try {
  // ------------------------------------------------------------ zaman: Merkez Sv 1 → 25
  if (want('zaman')) {
    const dir = resolve(OUT, 'zaman'); mkdirSync(dir, { recursive: true });
    const page = await campPage(); const W = 480, H = 853; const idx = [];
    for (let L = 1; L <= 25; L++) {
      const K = Math.min(30, Math.ceil(L * 1.2));
      // sürdürülebilir: kapsayıcı yeniden başlarsa çekilmiş seviyeler (png + yan json) atlanır
      const fp = resolve(dir, `sv${String(L).padStart(2, '0')}.png`), fj = fp.replace(/\.png$/, '.json');
      if (existsSync(fp) && existsSync(fj)) { idx.push(JSON.parse(readFileSync(fj, 'utf8'))); log(`zaman Sv ${L} hazır`); continue; }
      await openDemo(page, L, K);
      const m = await page.evaluate(() => { const p = window.__kamp.pos('merkez'); const v = window.__kamp.view(); return { p, v }; });
      // Merkez'in dünya noktası (rozet konumu → bina tabanı)
      const mx = m.v.x + (m.p.x - W / 2) / m.v.zoom, my = m.v.y + (m.p.y - H / 2) / m.v.zoom;
      // sabit kadraj: Merkez arsasının dünya noktası (binanın boyu rozet konumunu değiştirir; kadraj ondan bağımsız)
      await zoomTo(page, 1.25, W, H); await panTo(page, 0, -112, W, H);
      await sleep(1200);
      const v = await view(page);
      const f = resolve(dir, `sv${String(L).padStart(2, '0')}.png`); await page.screenshot({ path: f });
      idx.push({ L, K, file: f, view: v, merkez: [mx, my] }); writeFileSync(fj, JSON.stringify(idx.at(-1))); log(`zaman Sv ${L} (Kamp Sv ${K})`, JSON.stringify(v));
    }
    writeFileSync(resolve(dir, 'index.json'), JSON.stringify(idx, null, 1));
    await page.context().close();
  }
  // ------------------------------------------------------------ ada: yakınlaştırma basamakları
  if (want('ada')) {
    const dir = resolve(OUT, 'ada'); mkdirSync(dir, { recursive: true });
    const page = await campPage(); const W = 480, H = 853;
    await openDemo(page, 25, 30);
    const m = await page.evaluate(() => ({ p: window.__kamp.pos('merkez'), v: window.__kamp.view(), d: ['koru', 'koy', 'tepe', 'yerleske', 'orman'].map((id) => [id, window.__kamp.district(id)]) }));
    const mx = m.v.x + (m.p.x - W / 2) / m.v.zoom, my = m.v.y + (m.p.y - H / 2) / m.v.zoom;
    const steps = []; let z = 1.25;
    while (z > 0.2) { steps.push(+z.toFixed(4)); z *= 0.9; }
    const z0 = steps[0], z1 = steps.at(-1);
    // hedef merkez: yakında Merkez, uzakta takımadanın ortası (log-ölçekte doğrusal)
    const P = [160, 40];
    const idx = [];
    for (const [i, zz] of steps.entries()) {
      const t = Math.log(zz / z0) / Math.log(z1 / z0); const e = t * t * (3 - 2 * t);
      const tx = 0 + (P[0] - 0) * e, ty = -112 + (P[1] + 112) * e;
      await zoomTo(page, zz, W, H); await panTo(page, tx, ty, W, H); await sleep(800);
      const v = await view(page);
      const f = resolve(dir, `z${String(i).padStart(2, '0')}.png`); await page.screenshot({ path: f });
      const d = await page.evaluate(() => ['koru', 'koy', 'tepe', 'yerleske', 'orman'].map((id) => [id, window.__kamp.district(id)]));
      idx.push({ i, target: [tx, ty, zz], view: v, file: f, districts: d }); log(`ada ${i}: ${JSON.stringify(v)}`);
    }
    writeFileSync(resolve(dir, 'index.json'), JSON.stringify({ merkez: [mx, my], steps: idx }, null, 1));
    await page.context().close();
  }
  // ------------------------------------------------------------ anıtlar: sahnede Kulak Yolu + yüksek çözünürlüklü çizimler
  if (want('anit')) {
    const dir = resolve(OUT, 'anit'); mkdirSync(dir, { recursive: true });
    const page = await campPage(); const W = 480, H = 853;
    await openDemo(page, 15, 18);
    const pos = await page.evaluate((all) => ({ v: window.__kamp.view(), m: all.map((r) => [r, window.__kamp.monument(r)]) }), ALL);
    const world = Object.fromEntries(pos.m.filter(([, p]) => p).map(([r, p]) => [r, [pos.v.x + (p.x - W / 2) / pos.v.zoom, pos.v.y + (p.y - H / 2) / pos.v.zoom]]));
    const shots = [];
    for (const [name, regions, zz] of [['yol', ALL, 0.95], ['koklea', ['koklea-1', 'koklea-2', 'koklea-3'], 2.4], ['dis', ['dis-kulak', 'kanal', 'zar'], 2.4], ['beyin', ['sinir', 'beyin-sapi', 'korteks'], 2.4]]) {
      const pts = regions.map((r) => world[r]); const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      await zoomTo(page, zz, W, H); await panTo(page, cx, cy - 20, W, H); await sleep(900);
      const v = await view(page); const f = resolve(dir, `sahne-${name}.png`); await page.screenshot({ path: f });
      const scr = await page.evaluate((all) => all.map((r) => [r, window.__kamp.monument(r)]), ALL);
      shots.push({ name, file: f, view: v, monuments: Object.fromEntries(scr) }); log('anıt sahnesi', name, JSON.stringify(v));
    }
    // yüksek çözünürlüklü anıt çizimleri (oyunun paintMonument'i)
    const entry = resolve(dir, 'entry.ts');
    writeFileSync(entry, `import { paintMonument, MONUMENT_BOX } from '${resolve(root, 'packages/game-core/src/camp/monuments.ts')}';\n(window as any).anit = { paintMonument, MONUMENT_BOX };\n`);
    const res = await build({ entryPoints: [entry], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2020', logLevel: 'warning',
      alias: { '@odi/shared': resolve(root, 'packages/shared/src/index.ts'), '@odi/content': resolve(root, 'packages/content/src/index.ts') } });
    const p2 = await browser.newPage(); await p2.setContent('<html><body style="margin:0;background:transparent"></body></html>');
    await p2.addScriptTag({ content: res.outputFiles[0].text });
    for (const r of ALL) {
      const url = await p2.evaluate((reg) => { const { paintMonument, MONUMENT_BOX: B } = window.anit; const S = 12; const c = document.createElement('canvas'); c.width = B.w * S; c.height = B.h * S; const x = c.getContext('2d'); x.scale(S, S); x.translate(B.ox, B.oy); paintMonument(x, reg, true); return c.toDataURL('image/png'); }, r);
      writeFileSync(resolve(dir, `anit-${r}.png`), Buffer.from(url.split(',')[1], 'base64'));
    }
    await p2.close();
    writeFileSync(resolve(dir, 'index.json'), JSON.stringify({ world, shots }, null, 1));
    await page.context().close();
  }
  // ------------------------------------------------------------ süsle kipi (önizleme)
  if (want('susle')) {
    const dir = resolve(OUT, 'susle'); mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'tr-TR' });
    await ctx.addInitScript(([seen]) => { try { const progress = {}; for (let i = 1; i <= 39; i++) progress[i] = { stars: 3, best: 1000, plays: 1 }; localStorage.setItem('odi-v1', JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true }, progress, sounds: false }, version: 3 })); localStorage.setItem('odi.kamp.anitlar', JSON.stringify(seen)); for (const k of ['seviyeTanitim', 'susTanitim']) localStorage.setItem('odi.kamp.' + k, '1'); } catch { /* yok */ } }, [ALL]);
    const page = await ctx.newPage();
    await page.goto(`${host}/?demo=kamp&seviye=18&kampsv=22&sunucu=${encodeURIComponent('ws://127.0.0.1:5')}`, { waitUntil: 'load' });
    await page.getByRole('button', { name: /Yola çık|Devam/ }).first().click();
    await page.locator('nav.tabbar .tab', { hasText: 'Kamp' }).click();
    await page.locator('.camp-base').waitFor({ timeout: 40_000 }); await page.locator('.camp-loading').waitFor({ state: 'detached', timeout: 40_000 });
    await page.addStyleTag({ content: '.camp-demo-tag { display: none !important; }' });
    await sleep(1500);
    await page.getByTestId('susle').click(); await page.getByTestId('sus-panel').waitFor(); await sleep(1200);
    await page.locator('.dede-card .en-x').click({ timeout: 1500 }).catch(() => undefined);
    await page.screenshot({ path: resolve(dir, 'susle-panel.png') });
    await page.locator('.sus-card').first().click(); await sleep(1500);
    await page.screenshot({ path: resolve(dir, 'susle-hayalet.png') });
    await ctx.close(); log('süsle tamam');
  }

  // ------------------------------------------------------------ sunucu gerektirenler: vaka, oyun
  if (want('vaka') || want('oyun')) {
    const srvFile = resolve(OUT, '..', 'server-inproc.mjs');
    await build({ entryPoints: [resolve(root, 'apps/server/src/server.ts')], outfile: srvFile, bundle: true, platform: 'node', target: 'node22', format: 'esm', external: ['bufferutil', 'utf-8-validate'], banner: { js: "import { createRequire as __r } from 'node:module'; const require = __r(import.meta.url);" }, logLevel: 'warning' });
    const { startServer, configFromEnv } = await import(pathToFileURL(srvFile).href);
    const srv = await startServer({ ...configFromEnv({ ODI_DB: ':memory:', ODI_TEST_STORE: '1', NODE_ENV: 'test' }), port: 8800 + Math.floor(Math.random() * 400), host: '127.0.0.1', log: false, sweepMs: 1000 });
    const db = srv.app.db; const base = `${host}/?sunucu=${encodeURIComponent(srv.url)}`;
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, locale: 'tr-TR', reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { if (!localStorage.getItem('odi-v1')) { const progress = {}; for (let i = 1; i <= 12; i++) progress[i] = { stars: 3, best: 1000, plays: 1 }; localStorage.setItem('odi-v1', JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true }, progress, knowledge: 'odyoloji', sounds: true, sfxVol: 0.9 }, version: 3 })); } } catch { /* yok */ } });
    const page = await ctx.newPage(); page.on('pageerror', (e) => log('sayfa hatası:', e.message));
    const name = 'Odyolog';
    await page.goto(base, { waitUntil: 'load' });
    await page.getByRole('button', { name: /Yola çık|Devam/ }).first().click();
    await page.locator('.onboard').waitFor({ timeout: 20_000 });
    await page.getByRole('textbox', { name: 'Takma ad' }).fill(name);
    await page.getByRole('button', { name: 'Başla' }).click();
    await page.locator('.onboard').waitFor({ state: 'detached' });
    let pid = null; for (let i = 0; i < 40 && !(pid = db.get('SELECT id FROM players WHERE name = ?', name)?.id); i++) await sleep(250);
    db.run('UPDATE players SET highest = 13, jeton = 5000, kristal = 50 WHERE id = ?', pid);
    for (const [id, l] of [['merkez', 6], ['depo', 4], ['revir', 5], ['laboratuvar', 4], ['kule', 4]]) db.run('UPDATE buildings SET level = ? WHERE player_id = ? AND id = ?', l, pid, id);
    const toastGone = async () => { for (let i = 0; i < 8 && await page.locator('.toast-top').count(); i++) { await page.locator('.toast-top').first().evaluate((el) => el.click()).catch(() => undefined); await sleep(150); } };
    const settle = async () => { for (let i = 0; i < 12 && await page.locator('.cel-root.on').count(); i++) { const c = page.locator('.cel-cta button'); if (await c.count()) await c.first().click().catch(() => undefined); else await page.mouse.click(195, 300).catch(() => undefined); await sleep(350); } await toastGone(); };
    await page.locator('nav.tabbar .tab', { hasText: 'Kamp' }).click(); await page.locator('.camp-base').waitFor({ timeout: 30_000 });
    await sleep(2500); await settle();
    const shot = async (dir, label, el) => { await sleep(500); const f = resolve(dir, `${label}.png`); if (el) await el.screenshot({ path: f }); else await page.screenshot({ path: f }); log('📸', f.replace(root + '/', '')); };

    if (want('vaka')) {
      const dir = resolve(OUT, 'vaka'); mkdirSync(dir, { recursive: true });
      const day = new Date().toISOString().slice(0, 10);
      for (const [k, c] of ['kv11', 'kv19', 'kv06'].entries()) db.run('INSERT OR REPLACE INTO kv_queue (player_id, case_id, arrived_at, day) VALUES (?, ?, ?, ?)', pid, c, Date.now() - k * 1000, day);
      await page.evaluate(() => window.__kg?.refresh());
      await page.evaluate(() => window.__kg.open({ kind: 'klinik', tab: 'salon' })); await page.locator('[data-testid="klinik-panel"]').waitFor(); await sleep(1200);
      await shot(dir, 'salon');
      for (const id of ['kv11', 'kv19']) {
        await page.locator(`.kg-hasta-kart[data-vaka="${id}"]`).click(); await page.locator('[data-testid="hasta-adim"]').waitFor();
        await shot(dir, `${id}-hasta`);
        await page.locator('[data-testid="testlere-gec"]').click();
        // sırayla iste: en son istenen en üstte görünür
        for (const t of ['refleks', 'timpanometri', 'odyometri', 'otoskopi']) await page.locator(`.kg-test[data-test="${t}"]`).click();
        await sleep(600);
        for (const t of ['otoskopi', 'odyometri', 'timpanometri', 'refleks']) {
          const card = page.locator(`[data-sonuc="${t}"]`); await card.scrollIntoViewIfNeeded(); await shot(dir, `${id}-kart-${t}`, card);
        }
        await page.locator('[data-sonuc="otoskopi"]').scrollIntoViewIfNeeded(); await shot(dir, `${id}-testler`);
        await page.locator('.kg-test-grid').scrollIntoViewIfNeeded(); await shot(dir, `${id}-test-grid`);
        await page.locator('.bp-x').first().click(); await sleep(600);
        await page.evaluate(() => window.__kg.open({ kind: 'klinik', tab: 'salon' })); await page.locator('[data-testid="klinik-panel"]').waitFor(); await sleep(800);
      }
      await page.locator('.bp-x').first().click(); await sleep(500);
    }
    if (want('oyun')) {
      const dir = resolve(OUT, 'oyun'); mkdirSync(dir, { recursive: true });
      for (const oyun of ['timpano', 'ton']) {
        await page.evaluate((o) => window.__kg?.open?.({ kind: 'oyun', oyun: o }), oyun).catch(() => undefined);
        if (!(await page.locator(`[data-testid="oyun-${oyun}"]`).count())) {
          await page.locator('[data-testid="kg-btn"]').click(); await page.locator('[data-testid="kg-panel"]').waitFor();
          await page.locator('[data-tab="etkinlik"]').click().catch(() => undefined); await sleep(500);
          await page.locator(`[data-oyun="${oyun}"]`).first().click();
        }
        await page.locator(`[data-testid="oyun-${oyun}"]`).waitFor(); await sleep(600);
        await shot(dir, `${oyun}-giris`);
        await page.locator('[data-testid="oyun-basla"]').click();
        if (oyun === 'timpano') {
          for (let i = 0; i < 5; i++) {
            await page.locator(`[data-testid="timpano-tur"][data-bulmaca="${i}"]`).waitFor(); await sleep(500);
            await shot(dir, `timpano-${i}`);
            await page.locator('.kg-timpano .kg-opt').first().click(); await page.locator('[data-testid="timp-aciklama"]').waitFor(); await sleep(400); await shot(dir, `timpano-${i}-cevap`);
            await page.locator('[data-testid="timp-ileri"]').click(); await sleep(500);
          }
        } else {
          for (let i = 0; i < 8; i++) {
            const tr = page.locator(`[data-testid="ton-tur"][data-deneme="${i}"]`); await tr.waitFor();
            await sleep(300); await shot(dir, `ton-${i}-dinle`);
            await page.locator(`[data-testid="ton-tur"][data-deneme="${i}"][data-faz="cevap"]`).waitFor({ timeout: 15_000 });
            await shot(dir, `ton-${i}-cevap`);
            await page.locator('.kg-cevap .btn').first().click(); await sleep(200); await shot(dir, `ton-${i}-geri`); await sleep(600);
          }
        }
        await sleep(1500); await settle(); await shot(dir, `${oyun}-sonuc`);
        await page.locator('.bp-x').first().click().catch(() => undefined); await sleep(600); await settle();
      }
    }
    await ctx.close(); await srv.close().catch(() => undefined);
  }
} finally {
  await browser.close(); await pv.close().catch(() => undefined);
}
log('bitti');
