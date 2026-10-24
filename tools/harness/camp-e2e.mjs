#!/usr/bin/env node
// Kulak Kampı uçtan uca testi (docs/14-kamp.md): gerçek sunucu (bellek içi veritabanı, ODI_DB=:memory: ODI_TEST_STORE=1; aynı süreçte
// çalışır ki test yardımcısı veritabanına doğrudan yazabilsin) + web test derlemesi (VITE_ODI_E2E=1) + gerçek tarayıcı oyuncuları.
// A) Önizleme (Chromium): ?demo=kamp&seviye=1|5|10|15 → kamp seviyeleri, Odyometri Odası paneli, Tedavi Odası paneli, Kulak Yolu anıtları.
// B) Gerçek akış (her tarayıcıda: Chromium + WebKit): B kampı açar → Odyoloji Merkezi'ne dokunur (kanvas) → panel → Yükselt (iskele +
//    sayaç) → takımdan yardım ister → A "Herkese yardım et" → B'nin süresi kısalır → kristalle bitirir → depo dolu → Topla → liste görünümü
//    → Odyometri Odası Sv 2 (Kulak Sözlüğü: Saf ses odyometrisi açılır) → Sv 3 (Dolap: Sol Kulak Mavisi açılır; Tüy Dede satırı)
//    → Tedavi Odası kurulur → Kulak tıkacı hazırlanır → raf dolar → Topla (çanta) → haritada bölüm kartı → Çanta'ya kulak tıkacı
//    → Oyna → LevelOptions.remedies test kancasında (window.__odi.remedies) → sunucusuz nazik kart.
// C) Anıt: haritada 12 bölüm geçilmiş (tohumlanmış ilerleme) → kamp açılınca Kemikçikler anıtı yükselir + Tüy Dede satırı; anıta dokununca bilgi.
// D) dom hedefi (Expo DOM telefon paketi, Chromium): anıt kutlaması + Tedavi Odası paneli.
// E) Yükseltme kutlaması (Chromium + WebKit + dom): kristalle (panel açıkken) / süre dolunca / takım yardımıyla biten inşaat →
//    "<Bina> Sv N!" afişi ve Tüy Dede kartı tam bir kez; kristalle bitince panel kendiliğinden kapanır.
// G) Kamp büyümesi (Chromium + WebKit + dom; docs/14-kamp.md §8–13): Kamp Seviyesi atlaması tam bir kez kutlanır → süsleme kipi
//    (hayalet sürükle, Yerleştir, yeniden açınca yerinde, Taşı, Depoya) → Kamp Sv 3'te Sessiz Koru açılır (Tüy Dede bölge satırı,
//    Akustik Kabin kurulur) → arkadaş profil kartından "Kampını gez" → alkış (günde bir; sahibine bildirim) → eski istemci yalnız
//    eski binaları alır; önizlemede Kamp Sv 1 / 9 / 30 ekran görüntüleri; dom: yüksek seviyeli kampta doku belleği sınırı.
// Kullanım: node tools/harness/camp-e2e.mjs [--no-build] [--build-dom] [--only demo|real|anit|dom|kutlama|buyume] [--browsers chromium,webkit] [--headed]
// Çıktı: tools/harness/out/kamp/<takım>/*.png
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { build } from 'esbuild';
import { chromium, webkit } from 'playwright';
import { measureHudFit } from './hud-fit.mjs';

const argv = process.argv.slice(2); const args = new Set(argv);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1]; };
const only = opt('only', null);
const browsers = opt('browsers', 'chromium,webkit').split(',');
const want = (s) => !only || only === s;
const root = resolve(new URL('../..', import.meta.url).pathname);
const webRoot = resolve(root, 'apps/web');
const outRoot = resolve(root, 'tools/harness/out/kamp'); mkdirSync(outRoot, { recursive: true });
const distDir = resolve(outRoot, 'dist');
const procs = [];
const run = (cmd, a, opts = {}) => new Promise((res, rej) => { const p = spawn(cmd, a, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...opts }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${a.join(' ')} → ${c}`)))); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
const step = (n) => console.log(`\n▶ ${n}`);
const ok = (m) => console.log(`  ✓ ${m}`);
function check(cond, m) { if (!cond) { failed = true; console.log(`  ✗ ${m}`); throw new Error(m); } ok(m); }
const soft = (cond, m) => { if (cond) ok(m); else { failed = true; console.log(`  ✗ ${m}`); } };

// ---- web test derlemesi (VITE_ODI_E2E=1: ?oyun-bot=1 bölümü bot oynar, window.__harita test kancası)
const vite = await import('vite');
if (!args.has('--no-build') || !existsSync(resolve(distDir, 'index.html'))) {
  process.env.VITE_ODI_E2E = '1';
  await vite.build({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: distDir, emptyOutDir: true } });
  delete process.env.VITE_ODI_E2E;
}

// ---- sunucu: aynı süreçte (test yardımcısı veritabanına yazar)
const srvFile = resolve(outRoot, 'server-inproc.mjs');
await build({ entryPoints: [resolve(root, 'apps/server/src/server.ts')], outfile: srvFile, bundle: true, platform: 'node', target: 'node22', format: 'esm', external: ['bufferutil', 'utf-8-validate'], banner: { js: "import { createRequire as __r } from 'node:module'; const require = __r(import.meta.url);" }, logLevel: 'warning' });
const { startServer, configFromEnv } = await import(pathToFileURL(srvFile).href);
const sport = 8800 + Math.floor(Math.random() * 400);
const srv = await startServer({ ...configFromEnv({ ODI_DB: ':memory:', ODI_TEST_STORE: '1', NODE_ENV: 'test' }), port: sport, host: '127.0.0.1', log: false, sweepMs: 1000 });
const db = srv.app.db;
/** test yardımcısı: oyuncuyu adıyla bul, alanlarını doğrudan yaz */
const pidOf = (name) => db.get('SELECT id FROM players WHERE name = ?', name)?.id;
const wsUrl = srv.url;

// ---- web önizleme (boş bir port: eski, sahipsiz bir önizleme sunucusuna denk gelmeyelim)
const wport = await new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const pv = await vite.preview({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: distDir }, preview: { port: wport, strictPort: true, host: '127.0.0.1' } });
const host = `http://127.0.0.1:${wport}`;
const base = `${host}/?sunucu=${encodeURIComponent(wsUrl)}`;
const cleanup = async () => { for (const p of procs) { try { p.kill(); } catch { /* yok */ } } await pv.close().catch(() => undefined); await srv.close().catch(() => undefined); };

const errors = [];
const launch = (bt) => (bt === 'webkit' ? webkit : chromium).launch({ headless: !args.has('--headed'), executablePath: bt === 'chromium' ? process.env.PLAYWRIGHT_CHROMIUM || undefined : undefined, args: bt === 'chromium' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] : [] });
const SEED = (cleared, seen) => ({ cleared, seen });
async function player(browser, bt, tag, seed = null, reduced = false) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(process.env.E2E_DSF ?? 2), hasTouch: true, ...(bt === 'chromium' ? { isMobile: true } : {}), locale: 'tr-TR', ...(reduced ? { reducedMotion: 'reduce' } : {}) });
  // ilk açılış rehberini (hikâye + anlatıcı turları + kilitler) atla: bu test başka bir akışı sınar (bkz. onboarding-e2e.mjs)
  await ctx.addInitScript(([s]) => {
    try {
      if (!localStorage.getItem('odi-v1')) {
        const progress = {}; for (let i = 1; i <= (s?.cleared ?? 0); i++) progress[i] = { stars: 3, best: 1000, plays: 1 };
        localStorage.setItem('odi-v1', JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true }, progress }, version: 3 }));
        if (s?.seen) localStorage.setItem('odi.kamp.anitlar', JSON.stringify(s.seen));
      }
    } catch { /* depolama yok */ }
  }, [seed]);
  const page = await ctx.newPage();
  await page.addInitScript(OLAY_SAYACI); // görünen afiş / Tüy Dede kartı kaydı (kısa süre görünenler de)
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
    if (over > 0) { errors.push(`${name}/${label}: yatay taşma ${over}px`); console.log(`  ⚠ ${label}: yatay taşma ${over}px`); }
    console.log(`  📸 ${f.replace(root + '/', '')}`);
  };
}
const tab = (page, label) => page.locator('nav.tabbar .tab', { hasText: label }).click();
// bildirimi öğenin kendisine tıklayarak kapat (konumla tıklama, bildirim tam o an kaybolursa alttaki üst çubuk düğmesine — ör. Mesajlar — düşer)
const toastGone = async (page) => { for (let i = 0; i < 8 && await page.locator('.toast-top').count(); i++) { await page.locator('.toast-top').first().evaluate((el) => el.click(), undefined, { timeout: 500 }).catch(() => undefined); await sleep(150); } };
async function settle(page) {
  for (let i = 0; i < 10; i++) {
    if (!(await page.locator('.cel-root.on').count())) break;
    const cta = page.locator('.cel-cta button');
    if (await cta.count() && await cta.first().isVisible()) await cta.first().click().catch(() => undefined); else await page.mouse.click(195, 420).catch(() => undefined);
    await sleep(350);
  }
  await toastGone(page);
}
const campReady = async (page) => { await page.locator('.camp-base').waitFor({ timeout: 25_000 }); await page.waitForFunction(() => !!window.__kamp && !!window.__kamp.pos('merkez'), null, { timeout: 25_000 }); await page.locator('.camp-loading').waitFor({ state: 'detached', timeout: 25_000 }); };
/** binaya kanvas üzerinden dokun (gerçek dokunuş). Önce kamera binaya odaklanır ve dokunulacak nokta gerçekten kanvas olmalı:
 *  bina üst göstergenin (ör. Mesajlar düğmesi) ya da alt kartların altında kalırsa dokunuş o düğmeye gider. */
async function tapBuilding(page, id) {
  await page.waitForFunction((b) => !!window.__kamp?.pos(b), id, { timeout: 25_000 }).catch(async (e) => {
    const d = await page.evaluate(() => ({ kamp: !!window.__kamp, base: !!document.querySelector('.camp-base') }));
    await page.screenshot({ path: resolve(outRoot, `HATA-konum-${id}.png`) }).catch(() => undefined);
    throw new Error(`${e.message.split('\n')[0]} · ${id} konumu yok: ${JSON.stringify(d)}`);
  });
  await page.evaluate((b) => window.__kamp.focus(b), id); await sleep(1100);
  const p = await page.evaluate((b) => { const q = window.__kamp.pos(b); if (!q) return null; const el = document.elementFromPoint(q.x, q.y + 10); return { ...q, free: el instanceof HTMLCanvasElement }; }, id);
  if (!p?.free) { console.log(`  · ${id}: dokunulacak nokta kanvas değil, yeniden denenecek (${JSON.stringify(p)})`); return; }
  await page.touchscreen.tap(p.x, p.y + 10);
}
async function openPanel(page, id) {
  for (let i = 0; i < 3; i++) { await tapBuilding(page, id); if (await page.locator('.bp').waitFor({ timeout: 4000 }).then(() => true, () => false)) return; await sleep(800); }
  await page.screenshot({ path: resolve(outRoot, `HATA-panel-${id}.png`) }).catch(() => undefined);
  throw new Error(`panel açılmadı: ${id} (bkz. ${resolve(outRoot, `HATA-panel-${id}.png`).replace(root + '/', '')})`);
}
/** paneli kapat: inşaat bitince panel kendiliğinden de kapanır (yarış: düğme tıklanmadan kaybolabilir) */
const closePanel = async (page) => {
  for (let i = 0; i < 4 && await page.locator('.bp').count(); i++) {
    await page.locator('.bp-x').first().evaluate((el) => el.click(), undefined, { timeout: 1000 }).catch(() => undefined);
    await page.locator('.bp').waitFor({ state: 'detached', timeout: 3000 }).catch(() => undefined);
  }
  if (await page.locator('.bp').count()) throw new Error('panel kapanmadı');
};
const builderLeft = async (page) => { const t = (await page.locator('.hud-chip.builder b').innerText().catch(() => '')).trim(); const m = t.match(/(?:(\d+) sa )?(\d+)(?::| dk)(\d+)?/); if (!m) return null; return t.includes('sa') ? Number(m[1]) * 3600 + Number(m[2]) * 60 : Number(m[2]) * 60 + Number(m[3] ?? 0); };
const lvlOf = (pid, id) => db.get('SELECT level FROM buildings WHERE player_id = ? AND id = ?', pid, id)?.level ?? 0;
/** kamp yeniden okunsun (sekme değiştir) */
const reopenCamp = async (page) => { await tab(page, 'Takım'); await sleep(300); await tab(page, 'Kamp'); await campReady(page); await toastGone(page); };
/** binayı panelden yükselt ve kristalle hemen bitir */
async function upgradeNow(page, id, pid) {
  const before = lvlOf(pid, id);
  await openPanel(page, id);
  await page.locator('.bp').getByRole('button', { name: /^(Kur|Yükselt)/ }).click();
  await page.locator('.bp-build').waitFor({ timeout: 8000 });
  await page.locator('.bp').getByRole('button', { name: /ile bitir/ }).click();
  await closePanel(page);
  for (let i = 0; i < 40 && lvlOf(pid, id) <= before; i++) await sleep(250);
  check(lvlOf(pid, id) === before + 1, `${id}: Sv ${before} → Sv ${before + 1}`);
}

/** Expo DOM telefon paketi (apps/mobile/dist): yoksa ya da --build-dom verildiyse derlenir */
async function domBundle() {
  const mobileDist = resolve(root, 'apps/mobile/dist');
  if ((args.has('--build-dom') && !domBuilt) || !existsSync(resolve(mobileDist, 'www.bundle'))) { rmSync(mobileDist, { recursive: true, force: true }); await run('npx', ['expo', 'export', '--platform', 'ios', '--output-dir', 'dist', '--clear'], { cwd: resolve(root, 'apps/mobile') }); domBuilt = true; }
  const dir = resolve(mobileDist, 'www.bundle'); return pathToFileURL(resolve(dir, readdirSync(dir).find((f) => f.endsWith('.html')))).href;
}
let domBuilt = false;
/** dom hedefi bağlamı: sahte ReactNativeWebView köprüsü (depolama, haptik), 8 bölüm geçilmiş, görülen anıtlar */
async function domContext(browser, seen) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'tr-TR', reducedMotion: 'reduce' });
  await ctx.addInitScript(([serverUrl, seenRegions]) => {
    const progress = {}; for (let i = 1; i <= 8; i++) progress[i] = { stars: 3, best: 1000, plays: 1 };
    const store = { 'odi-v1': JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true }, progress }, version: 3 }) };
    window.ReactNativeWebView = {
      injectedObjectJson: () => JSON.stringify({ EXPO_DOM_HOST_OS: 'ios', initialProps: { names: ['getItem', 'setItem', 'removeItem', 'haptic', 'share'], props: { serverUrl, canPurchase: false, insetTop: 47, insetBottom: 34 } } }),
      postMessage: (s) => {
        try {
          const m = JSON.parse(s); if (m.type !== '$$native_action') return;
          const [k, v] = m.data.args ?? []; let result = null;
          if (m.data.actionId === 'getItem') result = store[k] ?? null;
          if (m.data.actionId === 'setItem') store[k] = v;
          if (m.data.actionId === 'removeItem') delete store[k];
          setTimeout(() => window.dispatchEvent(new CustomEvent('$$dom_event', { detail: { type: '$$native_action_result', data: { uid: m.data.uid, actionId: m.data.actionId, result } } })), 0);
        } catch { /* yok */ }
      },
    };
    try { localStorage.setItem('odi.kamp.anitlar', JSON.stringify(seenRegions)); } catch { /* file:// */ }
    const lock = () => { const st = document.createElement('style'); st.textContent = 'html{overflow:hidden!important}'; document.head.appendChild(st); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lock); else lock();
  }, [wsUrl, seen]);
  return ctx;
}
/** sayfaya eklenen her bildirim afişi (.toast-top), kutlama sahnesi (.cel-root) ve Tüy Dede kartı kaydedilir: "tam bir kez" denetimi */
const OLAY_SAYACI = () => {
  const o = { toast: [], dede: [], cel: 0, titles: [] }; window.__olay = o;
  const scan = (n) => {
    if (!(n instanceof Element)) return;
    for (const t of [n, ...n.querySelectorAll('.toast-top')]) if (t.matches('.toast-top')) o.toast.push(t.querySelector('b')?.textContent ?? '');
    for (const d of [n, ...n.querySelectorAll('[data-testid="kamp-dede"]')]) if (d.matches('[data-testid="kamp-dede"]')) o.dede.push(d.getAttribute('data-line') ?? '');
    for (const c of [n, ...n.querySelectorAll('.cel-root')]) if (c.matches('.cel-root')) o.cel++;
    for (const c of [n, ...n.querySelectorAll('.lvl-stage')]) if (c.matches('.lvl-stage')) o.titles.push(c.querySelector('.cel-title')?.textContent ?? '');
  };
  const start = () => new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) scan(n); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);
};

/** tarayıcısız gerçek oyuncu (sunucuya doğrudan WebSocket; social-e2e.mjs ile aynı) */
function rawClient(url) {
  const ws = new WebSocket(url); let id = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.t === 'res') { const p = pend.get(m.id); pend.delete(m.id); if (!p) return; if (m.ok) p.res(m.data); else p.rej(new Error(`${m.code}: ${m.error}`)); } };
  const ready = new Promise((r) => { ws.onopen = r; });
  const call = async (op, data) => { await ready; return new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ t: 'req', id: i, op, data })); }); };
  return { call, close: () => ws.close() };
}

try {
  // ======================================================================== A) önizleme
  if (want('demo')) {
    const browser = await launch('chromium');
    const shot = suite('onizleme');
    step('A · Önizleme: kamp seviyeleri, paneller, Kulak Yolu anıtları');
    const all = ['dis-kulak', 'kanal', 'zar', 'kemikcikler', 'koklea-1', 'koklea-2', 'koklea-3', 'sinir', 'beyin-sapi', 'korteks'];
    const P = await player(browser, 'chromium', 'önizleme', SEED(39, all));
    for (const L of [1, 5, 10, 15]) {
      await P.goto(`${host}/?demo=kamp&seviye=${L}&sunucu=${encodeURIComponent('ws://127.0.0.1:5')}`, { waitUntil: 'load' });
      await P.getByRole('button', { name: /Yola çık|Devam/ }).first().click();
      await tab(P, 'Kamp'); await campReady(P); await settle(P);
      await shot(P, `kamp-sv${String(L).padStart(2, '0')}`, 1600);
      if (L === 10) {
        await openPanel(P, 'laboratuvar');
        check((await P.locator('.bp h2').innerText()).includes('Odyometri Odası'), 'panel: Odyometri Odası (yeni ad)');
        check(await P.locator('[data-testid="bina-bilgi"]').count() === 1, 'panelde "Odyolojide" bilgisi');
        await shot(P, 'panel-odyometri', 1500);
        await closePanel(P);
        await openPanel(P, 'tedavi');
        check((await P.locator('.bp h2').innerText()).includes('Tedavi Odası'), 'panel: Tedavi Odası');
        await P.locator('[data-recipe="ventilasyon-tupu"]').waitFor();
        await shot(P, 'panel-tedavi', 1200);
        await P.locator('.tp-info').scrollIntoViewIfNeeded(); await P.locator('.tp-info .ml-btn').click();
        await shot(P, 'panel-tedavi-tarif', 500);
        await closePanel(P);
      }
    }
    await P.goto(`${host}/?demo=kamp&seviye=8&insaat=kule&sunucu=${encodeURIComponent('ws://127.0.0.1:5')}`, { waitUntil: 'load' });
    await P.getByRole('button', { name: /Yola çık|Devam/ }).first().click(); await tab(P, 'Kamp'); await campReady(P); await settle(P);
    await shot(P, 'onizleme-insaat-kule', 1600);
    await P.getByRole('button', { name: 'Liste görünümü' }).click(); await P.locator('.building').first().waitFor();
    check(await P.locator('.building').count() === 12, '12 bina kartı (Tedavi Odası + 5 bölge binası; kilitliler "Kamp Sv N")');
    await P.locator('[data-testid="tedavi-panel"]').scrollIntoViewIfNeeded();
    await shot(P, 'liste-tedavi', 400);
    await browser.close();
  }

  // ======================================================================== B) gerçek akış (Chromium + WebKit)
  if (want('real')) for (const bt of browsers) {
    const browser = await launch(bt);
    const shot = suite(`gercek-${bt}`);
    const tagA = `Ayşe${bt[0]}`, tagB = `Bora${bt[0]}`;
    const A = await player(browser, bt, `A-${bt}`); const B = await player(browser, bt, `B-${bt}`);
    step(`B1 · [${bt}] Takma ad + takım (A kurar, B kodla katılır)`);
    for (const [p, name, color] of [[A, tagA, 2], [B, tagB, 5]]) {
      await p.goto(`${base}&oyun-bot=1`, { waitUntil: 'load' });
      await p.getByRole('button', { name: /Yola çık/ }).click();
      await p.locator('.onboard').waitFor({ timeout: 20_000 });
      await p.getByRole('textbox', { name: 'Takma ad' }).fill(name);
      await p.locator('.swatch').nth(color).click();
      await p.getByRole('button', { name: 'Başla' }).click();
      await p.locator('.onboard').waitFor({ state: 'detached' });
      await toastGone(p);
    }
    await tab(A, 'Takım'); await A.locator('.team-hero').waitFor();
    await A.getByRole('button', { name: '＋ Takım kur' }).first().click();
    await A.locator('.sheet').getByPlaceholder('ör. Koklea Kaşifleri').fill(`Kampçılar ${bt}`);
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

    const bId = pidOf(tagB); check(!!bId, 'B sunucuda bulundu');
    db.run('UPDATE players SET jeton = 50000, kristal = 2000, m5 = 3, m60 = 1 WHERE id = ?', bId); srv.app.walletChanged(bId);

    step(`B2 · [${bt}] Kamp açılır (üs görünümü, 7 bina)`);
    await tab(B, 'Kamp'); await campReady(B); await toastGone(B);
    await shot(B, 'B-kamp-acilis', 1500);

    step(`B3 · [${bt}] Odyoloji Merkezi'ne dokun → panel → Yükselt`);
    await openPanel(B, 'merkez');
    check((await B.locator('.bp h2').innerText()).includes('Odyoloji Merkezi'), 'panel: Odyoloji Merkezi (yeni ad)');
    check((await B.locator('[data-testid="bina-bilgi"]').innerText()).includes('Odyoloji'), 'panelde odyolojik işlev');
    await shot(B, 'B-panel-merkez', 1800);
    await B.locator('.bp').getByRole('button', { name: /Yükselt/ }).click();
    await B.locator('.bp-build').waitFor({ timeout: 8000 });
    await B.locator('.bp').getByRole('button', { name: /Takımdan yardım iste/ }).click();
    await B.locator('.bp').getByRole('button', { name: /Yardım istendi/ }).waitFor({ timeout: 8000 });
    ok('inşaat başladı, takımdan yardım istendi');
    await closePanel(B); await toastGone(B);
    await shot(B, 'B-insaat-iskele-sayac', 1400);
    const left0 = await builderLeft(B);
    check(left0 != null && left0 > 60, `sayaç çalışıyor: ${left0} sn`);

    step(`B4 · [${bt}] A "Herkese yardım et" → B'nin süresi kısalır`);
    await tab(A, 'Kamp'); await campReady(A); await toastGone(A);
    await A.getByRole('button', { name: /Herkese yardım et \(1\)/ }).waitFor({ timeout: 10_000 });
    await A.getByRole('button', { name: /Herkese yardım et/ }).click({ force: true });
    await sleep(2300);
    const left1 = await builderLeft(B);
    check(left1 != null && left1 <= left0 - 55, `süre kısaldı: ${left0} sn → ${left1} sn`);
    await toastGone(B);
    await shot(B, 'B-yardim-sonrasi', 300);
    await tab(A, 'Bugün'); // A'nın sahnesi kapanır

    step(`B5 · [${bt}] Kristalle bitir → Odyoloji Merkezi Sv 2 + Tüy Dede satırı`);
    await openPanel(B, 'merkez');
    await B.locator('.bp').getByRole('button', { name: /ile bitir/ }).click();
    await closePanel(B);
    await B.locator('[data-testid="kamp-dede"][data-line^="kamp-sv-merkez-"]').waitFor({ timeout: 15_000 });
    ok('Tüy Dede yükseltme satırı: ' + await B.locator('[data-testid="kamp-dede"]').getAttribute('data-line'));
    await settle(B);
    await shot(B, 'B-bitis-dede', 300);
    check(lvlOf(bId, 'merkez') === 2, 'Odyoloji Merkezi Sv 2');

    step(`B6 · [${bt}] Depo dolu → Topla`);
    db.run("UPDATE buildings SET level = 3 WHERE player_id = ? AND id = 'depo'", bId);
    db.run('UPDATE players SET depot_at = ? WHERE id = ?', Date.now() - 9 * 3_600_000, bId);
    await reopenCamp(B);
    const hudJeton = async () => Number(await B.locator('.tb-pill[data-hud="jeton"]').getAttribute('data-value'));
    const coinsBefore = await hudJeton();
    await openPanel(B, 'depo');
    const j0 = db.get('SELECT jeton FROM players WHERE id = ?', bId).jeton;
    await B.locator('.bp').getByRole('button', { name: /Topla \+/ }).click();
    for (let i = 0; i < 30 && db.get('SELECT jeton FROM players WHERE id = ?', bId).jeton === j0; i++) await sleep(200);
    check(db.get('SELECT jeton FROM players WHERE id = ?', bId).jeton > j0, 'sunucu: depo jetonu cüzdana girdi');
    let coinsAfter = coinsBefore;
    for (let i = 0; i < 25 && coinsAfter === coinsBefore; i++) { await sleep(200); coinsAfter = await hudJeton(); }
    check(coinsAfter !== coinsBefore, `jeton: ${coinsBefore} → ${coinsAfter}`);
    await closePanel(B);

    step(`B7 · [${bt}] Odyometri Odası Sv 2 → Kulak Sözlüğü terimi; Sv 3 → Dolap kozmetiği`);
    db.run("UPDATE buildings SET level = 3 WHERE player_id = ? AND id = 'merkez'", bId);
    db.run("UPDATE buildings SET level = 1 WHERE player_id = ? AND id = 'laboratuvar'", bId);
    await reopenCamp(B);
    await openPanel(B, 'laboratuvar');
    check((await B.locator('.bp-unlocks.next').innerText()).includes('Saf ses odyometrisi'), 'panel: "Sv 2 açar · Sözlük: Saf ses odyometrisi"');
    await shot(B, 'B-panel-odyometri-acilim', 1200);
    await closePanel(B);
    await upgradeNow(B, 'laboratuvar', bId);
    await settle(B);
    await upgradeNow(B, 'laboratuvar', bId);
    await B.locator('[data-testid="kamp-dede"][data-line="kamp-sv-laboratuvar-3"]').waitFor({ timeout: 15_000 });
    ok('Tüy Dede: kamp-sv-laboratuvar-3');
    await sleep(600); await shot(B, 'B-odyometri-sv3-kutlama', 0);
    await settle(B);
    const cos = JSON.parse(db.get('SELECT cosmetics FROM players WHERE id = ?', bId).cosmetics);
    check(cos.includes('renk-sol-kulak'), 'sunucu: Sol Kulak Mavisi oyuncu profiline yazıldı');
    await tab(B, 'Profil'); await B.locator('[data-tile="wardrobe"]').click();
    const tile = B.getByRole('button', { name: 'Sol Kulak Mavisi', exact: true });
    await tile.waitFor({ timeout: 10_000 }); check(await tile.isEnabled(), 'Dolap: Sol Kulak Mavisi açık (Odyometri Odası Sv 3)');
    await tile.scrollIntoViewIfNeeded(); await shot(B, 'B-dolap-sol-kulak', 300);
    await B.getByRole('button', { name: 'Geri' }).first().click();
    await B.locator('[data-tile="glossary"]').click();
    const term = B.locator('[data-region="kamp"] [data-term="saf-ses-odyometrisi"]');
    await term.waitFor({ timeout: 10_000 }); await term.scrollIntoViewIfNeeded();
    check(await B.locator('[data-region="kamp"] [data-term="hava-kemik-yolu"]').count() === 0, 'Sözlük: Sv 5 terimi henüz kilitli');
    ok('Kulak Sözlüğü: Saf ses odyometrisi açık');
    await shot(B, 'B-sozluk-kamp-terimi', 300);
    await B.getByRole('button', { name: 'Geri' }).first().click();

    step(`B8 · [${bt}] Tedavi Odası: kur → Kulak tıkacı hazırla → raf dolar → Topla`);
    await tab(B, 'Kamp'); await campReady(B); await toastGone(B);
    await upgradeNow(B, 'tedavi', bId);
    await settle(B);
    await openPanel(B, 'tedavi');
    await B.locator('[data-recipe="kulak-tikaci"]').click();
    await B.locator('.tp-info').getByRole('button', { name: 'Bunu hazırla' }).click();
    await B.locator('[data-making="kulak-tikaci"]').waitFor({ timeout: 8000 });
    ok('hazırlanıyor: Kulak tıkacı');
    await shot(B, 'B-tedavi-hazirlaniyor', 600);
    await closePanel(B);
    db.run('UPDATE remedy_prod SET since = since - ? WHERE player_id = ?', 3 * 3_600_000, bId);
    await reopenCamp(B);
    await shot(B, 'B-tedavi-raf-baloncuk', 1200);
    await openPanel(B, 'tedavi');
    check((await B.locator('.tp-shelf .qn').innerText()).includes('2/2'), 'raf dolu: 2/2 (Sv 1)');
    await B.locator('.tp-shelf').getByRole('button', { name: 'Topla' }).click();
    await B.locator('[data-inv="kulak-tikaci"]').waitFor({ timeout: 8000 });
    check((await B.locator('[data-inv="kulak-tikaci"]').innerText()).includes('×2'), 'çantada Kulak tıkacı ×2');
    const inv = db.get("SELECT n FROM remedy_inv WHERE player_id = ? AND id = 'kulak-tikaci'", bId)?.n;
    check(inv === 2, `sunucu envanteri: ${inv}`);
    await closePanel(B);
    // kart kendiliğinden kapanır (11 sn): görünür kalmasını değil, gösterildiğini denetle
    await B.waitForFunction(() => window.__olay?.dede.includes('tedavi-al-01'), null, { timeout: 8000 }).then(() => ok('Tüy Dede: tedavi-al-01 (ilk toplama)'), () => soft(false, 'Tüy Dede: tedavi-al-01'));
    await shot(B, 'B-tedavi-topla-dede', 400);

    step(`B9 · [${bt}] Bölüm kartı → Çanta'ya Kulak tıkacı → Oyna → LevelOptions.remedies`);
    await tab(B, 'Harita');
    await B.waitForFunction(() => !!window.__harita, null, { timeout: 20_000 });
    await B.evaluate(() => window.__harita.card(1));
    await B.locator('[data-testid="canta"]').waitFor();
    await B.locator('[data-testid="canta"] .bag-row').click();
    await B.locator('.bag-item[data-remedy="kulak-tikaci"]').getByRole('button', { name: 'Kulak tıkacı ekle' }).click();
    await B.locator('.bag-chip[data-remedy="kulak-tikaci"]').waitFor();
    check((await B.locator('.bag-slots').innerText()).trim() === '1/2', 'çanta: 1/2');
    await shot(B, 'B-bolum-karti-canta', 400);
    // küçük telefon (320×640): çanta seçimi taşmadan sığmalı
    await B.setViewportSize({ width: 320, height: 640 }); await sleep(500);
    await B.locator('[data-testid="canta"]').scrollIntoViewIfNeeded();
    await shot(B, 'B-bolum-karti-canta-320', 300);
    await B.setViewportSize({ width: 390, height: 844 }); await sleep(400);
    await B.locator('.map-btn.shine').click();
    for (let i = 0; i < 20 && !(await B.evaluate(() => !!window.__odi)); i++) { const h = B.getByRole('button', { name: /Haydi/ }); if (await h.count()) await h.click().catch(() => undefined); await sleep(400); }
    const passed = await B.evaluate(() => window.__odi?.remedies);
    check(JSON.stringify(passed) === JSON.stringify([{ id: 'kulak-tikaci', count: 1 }]), `LevelOptions.remedies = ${JSON.stringify(passed)}`);
    await sleep(800); await shot(B, 'B-bolum-basladi', 0);

    step(`B10 · [${bt}] Sunucusuz: nazik kart`);
    const off = await player(browser, bt, `Ç-${bt}`);
    await off.goto(`${host}/?sunucu=${encodeURIComponent('ws://127.0.0.1:5')}`, { waitUntil: 'load' });
    await off.getByRole('button', { name: /Yola çık/ }).click();
    await tab(off, 'Kamp');
    await off.locator('.camp-offline').waitFor({ timeout: 20_000 });
    check((await off.locator('.camp-offline').innerText()).includes('bağlanınca görünür'), 'çevrimdışı kartı + Tekrar dene');
    await browser.close();
  }

  // ======================================================================== C) bölge anıtı (tohumlanmış ilerleme)
  if (want('anit')) for (const bt of browsers) {
    const browser = await launch(bt);
    const shot = suite(`anit-${bt}`);
    step(`C · [${bt}] 12 bölüm geçilmiş → Kemikçikler anıtı yükselir`);
    const M = await player(browser, bt, `M-${bt}`, SEED(12, ['dis-kulak', 'kanal', 'zar']), true);
    await M.goto(base, { waitUntil: 'load' });
    await M.getByRole('button', { name: /Yola çık|Devam/ }).first().click();
    await M.locator('nav.tabbar').waitFor({ timeout: 20_000 }); await settle(M);
    if (await M.locator('.onboard').count()) { await M.getByRole('textbox', { name: 'Takma ad' }).fill(`Melis${bt[0]}`); await M.getByRole('button', { name: 'Başla' }).click(); }
    await tab(M, 'Kamp'); await campReady(M);
    await M.locator('[data-testid="kamp-dede"][data-line="anit-kemikcikler"]').waitFor({ timeout: 30_000 });
    ok('Tüy Dede: anit-kemikcikler');
    check(JSON.stringify(await M.evaluate(() => window.__kamp.regions())) === JSON.stringify(['dis-kulak', 'kanal', 'zar', 'kemikcikler']), 'ulaşılan bölgeler: 4');
    check(await M.evaluate(() => window.__kamp.celebrated()) === 'kemikcikler', 'kutlanan anıt: Kemikçikler');
    await sleep(1500); await toastGone(M); await shot(M, 'anit-kemikcikler-yukseldi', 300);
    const seen = await M.evaluate(() => JSON.parse(localStorage.getItem('odi.kamp.anitlar') ?? '[]'));
    check(seen.includes('kemikcikler'), 'anıt görüldü olarak işaretlendi (bir kez kutlanır)');
    const zp = await M.evaluate(() => window.__kamp.monument('zar'));
    await M.touchscreen.tap(zp.x, zp.y);
    await M.locator('[data-testid="kamp-dede"]', { hasText: 'Kulak Zarı Davulu' }).waitFor({ timeout: 8000 });
    ok('anıta dokununca bilgi: Kulak Zarı Davulu');
    await shot(M, 'anit-dokun-zar', 300);
    await browser.close();
  }

  // ======================================================================== D) dom hedefi (Expo DOM telefon paketi)
  if (want('dom') && browsers.includes('chromium')) {
    step('D · dom hedefi: anıt kutlaması + Tedavi Odası paneli (telefon paketi)');
    const domHtml = await domBundle();
    const browser = await launch('chromium');
    const shot = suite('dom-chromium');
    const ctx = await domContext(browser, ['dis-kulak', 'kanal']);
    const D = await ctx.newPage();
    D.on('pageerror', (e) => errors.push(`dom: ${e.message}`));
    await D.goto(domHtml, { waitUntil: 'load' });
    await D.getByRole('button', { name: /Yola çık|Devam/ }).first().click({ timeout: 45_000 });
    await D.locator('nav.tabbar').waitFor({ timeout: 25_000 }); await settle(D);
    if (await D.locator('.onboard').count()) { await D.getByRole('textbox', { name: 'Takma ad' }).fill('Dila'); await D.getByRole('button', { name: 'Başla' }).click(); }
    for (let i = 0; i < 60 && !db.get('SELECT id FROM players ORDER BY created_at DESC LIMIT 1'); i++) await sleep(250);
    await sleep(1500);
    const all = db.all('SELECT id, name FROM players ORDER BY created_at DESC');
    console.log('  · dom oyuncuları: ' + all.map((r) => r.name).join(', '));
    const dId = (all.find((r) => r.name === 'Dila') ?? all[0]).id;
    // kamp istemcide önceden yüklü: sunucu bitmiş bir inşaatı tamamlayınca (camp.updated) güncel durum gelir — sahne açılmadan
    db.run("UPDATE buildings SET level = 2 WHERE player_id = ? AND id = 'merkez'", dId);
    db.run("UPDATE buildings SET level = 1, upgrading_to = 2, started_at = ?, ends_at = ? WHERE player_id = ? AND id = 'tedavi'", Date.now() - 5000, Date.now() - 1000, dId);
    db.run('INSERT OR REPLACE INTO remedy_prod(player_id, item, since) VALUES(?, ?, ?)', dId, 'serumen-damlasi', Date.now() - 50 * 60_000);
    for (let i = 0; i < 40 && lvlOf(dId, 'tedavi') < 2; i++) await sleep(250);
    await sleep(1200); await settle(D);
    await tab(D, 'Kamp'); await campReady(D);
    await D.locator('[data-testid="kamp-dede"][data-line="anit-zar"]').waitFor({ timeout: 30_000 });
    ok('dom: Kulak Zarı anıtı yükseldi (Tüy Dede: anit-zar)');
    await sleep(1200); await shot(D, 'dom-anit-zar', 300);
    await D.locator('.dede-card .en-x').click().catch(() => undefined);
    // Tedavi Odası adanın arkasında: üst göstergenin altında kalmasın diye kamerayı parmakla aşağı kaydır
    await D.mouse.move(195, 400); await D.mouse.down(); await D.mouse.move(195, 520, { steps: 6 }); await D.mouse.move(195, 640, { steps: 6 }); await D.mouse.up(); await sleep(900);
    await openPanel(D, 'tedavi');
    check(await D.locator('[data-making="serumen-damlasi"]').count() === 1, 'dom: Tedavi Odası paneli (Kulak kiri yumuşatıcı damla hazırlanıyor)');
    await shot(D, 'dom-panel-tedavi', 900);
    await browser.close();
  }

  // ======================================================================== E) yükseltme kutlaması: kristalle / süre dolunca / takım yardımıyla biten inşaat
  //    → afiş ("<Bina> Sv N!") ve Tüy Dede kartı TAM BİR KEZ (aynı bitiş istemciye işlem yanıtı + camp.updated itmesiyle birden çok kez gelir)
  if (want('kutlama')) {
    const targets = [...browsers.map((bt) => ({ bt, dom: false })), ...(browsers.includes('chromium') ? [{ bt: 'chromium', dom: true }] : [])];
    let idx = 0;
    for (const { bt, dom } of targets) {
      const tg = dom ? 'dom' : bt; idx++;
      const browser = await launch(bt);
      const shot = suite(`kutlama-${tg}`);
      const seen = ['dis-kulak', 'kanal', 'zar'];
      step(`E1 · [${tg}] oyuncu + tarayıcısız takım arkadaşı`);
      let K;
      if (dom) { const ctx = await domContext(browser, seen); K = await ctx.newPage(); K.on('pageerror', (e) => errors.push(`kutlama-dom: ${e.message}`)); }
      else K = await player(browser, bt, `kutlama-${tg}`, SEED(8, seen));
      await K.addInitScript(OLAY_SAYACI);
      const nm = `Kutlu${idx}${Date.now() % 100}`;
      await K.goto(dom ? await domBundle() : base, { waitUntil: 'load' });
      await K.getByRole('button', { name: /Yola çık|Devam/ }).first().click({ timeout: 45_000 });
      await K.locator('.onboard').waitFor({ timeout: 20_000 });
      await K.getByRole('textbox', { name: 'Takma ad' }).fill(nm);
      await K.getByRole('button', { name: 'Başla' }).click();
      await K.locator('.onboard').waitFor({ state: 'detached' }); await settle(K);
      let kId = null; for (let i = 0; i < 40 && !(kId = pidOf(nm)); i++) await sleep(250);
      check(!!kId, `${nm} sunucuda`);
      const ece = rawClient(wsUrl);
      await ece.call('hello', { version: 1, name: `Ece${idx}${Date.now() % 100}` });
      const { team } = await ece.call('team.create', { name: `Kutlama ${tg}`, emblem: '🐚' });
      await tab(K, 'Takım'); await K.getByLabel('Takım davet kodu').fill(team.code);
      await K.locator('.code-join').getByRole('button', { name: 'Katıl' }).click();
      await K.locator('.team-head').waitFor(); await toastGone(K);
      ok(`takım ${team.code}: ${nm} + tarayıcısız takım arkadaşı`);
      for (const [b, l] of [['merkez', 5], ['atolye', 2], ['kule', 2], ['revir', 2]]) db.run('UPDATE buildings SET level = ? WHERE player_id = ? AND id = ?', l, kId, b);
      db.run('UPDATE players SET jeton = 50000, kristal = 2000 WHERE id = ?', kId); srv.app.walletChanged(kId);
      await tab(K, 'Kamp'); await campReady(K); await sleep(1200); await settle(K);
      const hush = async () => { await K.locator('.dede-card .en-x').click({ timeout: 1000 }).catch(() => undefined); };
      /** afiş ve Tüy Dede kartı tam bir kez: ilk göründükten sonra ~7 sn kuyruk boşaltılır (ikinci bir kopya varsa bu arada çıkar) */
      const once = async (id, name, level, how) => {
        const title = `${name} Sv ${level}!`; const line = `kamp-sv-${id}-${((level - 1) % 3) + 1}`;
        const card = K.locator(`[data-testid="kamp-dede"][data-line="${line}"]`);
        await card.waitFor({ timeout: 20_000 });
        check(await card.isVisible() && await K.locator('.bp').count() === 0, `[${tg}] ${how}: Tüy Dede kartı görünür (panel açık değil)`);
        await sleep(500); await shot(K, `${id}-${how}`, 0);
        for (let i = 0; i < 14; i++) { await toastGone(K); await sleep(500); }
        const o = await K.evaluate(() => window.__olay);
        const nT = o.toast.filter((t) => t.includes(title)).length; const nD = o.dede.filter((d) => d === line).length;
        check(nT === 1 && nD === 1, `[${tg}] ${how}: "${title}" afişi ×${nT}, Tüy Dede ${line} ×${nD} (beklenen 1 / 1)`);
        check(lvlOf(kId, id) === level, `[${tg}] sunucu: ${id} Sv ${level}`);
        await hush();
      };
      const start = async (id) => {
        await K.evaluate((b) => window.__kamp.focus(b), id); await sleep(1200); // bina ekranın dışında kalmasın
        await openPanel(K, id);
        await K.locator('.bp').getByRole('button', { name: /^(Kur|Yükselt)/ }).click();
        await K.locator('.bp-build').waitFor({ timeout: 8000 });
      };

      step(`E2 · [${tg}] kristalle bitir (panel açıkken) → panel kapanır, kutlama bir kez`);
      await start('atolye');
      await K.locator('.bp').getByRole('button', { name: /ile bitir/ }).click();
      await K.locator('.bp').waitFor({ state: 'detached', timeout: 8000 });
      ok(`[${tg}] inşaat bitince panel kendiliğinden kapandı`);
      await once('atolye', 'İşitme Cihazı Atölyesi', 3, 'kristal');

      step(`E3 · [${tg}] süre dolunca (sunucu itmesi + istemci tazelemesi) → kutlama bir kez`);
      await start('kule'); await closePanel(K);
      db.run("UPDATE buildings SET started_at = ?, ends_at = ? WHERE player_id = ? AND id = 'kule'", Date.now() - 60_000, Date.now() + 12_000, kId);
      await reopenCamp(K);
      await once('kule', 'Timpanometri Kulesi', 3, 'sure');

      step(`E4 · [${tg}] takım yardımıyla biter (art arda iki camp.updated) → kutlama bir kez`);
      await start('revir');
      await K.locator('.bp').getByRole('button', { name: /Takımdan yardım iste/ }).click();
      await K.locator('.bp').getByRole('button', { name: /Yardım istendi/ }).waitFor({ timeout: 8000 });
      await closePanel(K); await toastGone(K);
      db.run("UPDATE buildings SET ends_at = ? WHERE player_id = ? AND id = 'revir'", Date.now() + 40_000, kId);
      const { given } = await ece.call('team.camp.helpAll', {});
      check(given === 1, `[${tg}] takım arkadaşı yardım etti (${given})`);
      await once('revir', 'Odyoloji Kliniği', 3, 'yardim');
      ece.close();
      await browser.close();
    }
  }

  // ======================================================================== G) kamp büyümesi
  if (want('buyume')) {
    // önizleme: kamp seviye seviye büyür (erken / orta / en yüksek; uzaktan bütün takımada)
    {
      const browser = await launch('chromium');
      const shot = suite('buyume-onizleme');
      step('G0 · Önizleme: Kamp Sv 1 / 9 / 30 — takımada büyür');
      const all = ['dis-kulak', 'kanal', 'zar', 'kemikcikler', 'koklea-1', 'koklea-2', 'koklea-3', 'sinir', 'beyin-sapi', 'korteks'];
      const P = await player(browser, 'chromium', 'büyüme-önizleme', SEED(39, all));
      await P.addInitScript(() => { try { for (const k of ['seviyeTanitim', 'susTanitim']) localStorage.setItem('odi.kamp.' + k, '1'); } catch { /* yok */ } });
      for (const [L, K] of [[1, 1], [8, 9], [25, 30]]) {
        await P.goto(`${host}/?demo=kamp&seviye=${L}&kampsv=${K}&sunucu=${encodeURIComponent('ws://127.0.0.1:5')}`, { waitUntil: 'load' });
        await P.getByRole('button', { name: /Yola çık|Devam/ }).first().click(); await tab(P, 'Kamp'); await campReady(P); await settle(P);
        check(Number(await P.getByTestId('kamp-seviye').getAttribute('data-level')) === K, `önizleme: Kamp Sv ${K} göstergesi`);
        await shot(P, `kamp-sv${String(K).padStart(2, '0')}-yakin`, 1400);
        await P.mouse.move(195, 360); for (let i = 0; i < 14; i++) { await P.mouse.wheel(0, 120); await sleep(50); }
        await shot(P, `kamp-sv${String(K).padStart(2, '0')}-uzak`, 1800);
        const open = await P.evaluate(() => window.__kamp.districts());
        check(open.length === [3, 6, 12, 16, 20].filter((l) => K >= l).length, `Kamp Sv ${K}: açık bölgeler ${open.join(', ') || '—'}`);
      }
      await browser.close();
    }
    for (const bt of browsers) {
      const browser = await launch(bt);
      const shot = suite(`buyume-${bt}`);
      step(`G1 · [${bt}] oyuncu → Kamp Seviyesi 2 (inşaat XP'si) → kutlama tam bir kez`);
      const G = await player(browser, bt, `G-${bt}`);
      await G.addInitScript(OLAY_SAYACI);
      const nm = `Gezgin${bt[0]}${Date.now() % 1000}`;
      await G.goto(base, { waitUntil: 'load' });
      await G.getByRole('button', { name: /Yola çık/ }).click();
      await G.locator('.onboard').waitFor({ timeout: 20_000 });
      await G.getByRole('textbox', { name: 'Takma ad' }).fill(nm);
      await G.getByRole('button', { name: 'Başla' }).click();
      await G.locator('.onboard').waitFor({ state: 'detached' }); await settle(G);
      let gId = null; for (let i = 0; i < 40 && !(gId = pidOf(nm)); i++) await sleep(250);
      check(!!gId, `${nm} sunucuda`);
      db.run('UPDATE players SET jeton = 80000, kristal = 3000 WHERE id = ?', gId); srv.app.walletChanged(gId);
      await tab(G, 'Kamp'); await campReady(G); await sleep(800); await settle(G);
      check(Number(await G.getByTestId('kamp-seviye').getAttribute('data-level')) === 1, 'Kamp Seviyesi 1 göstergesi');
      db.run('UPDATE camp_xp SET xp = 55 WHERE player_id = ?', gId);
      await reopenCamp(G); await settle(G);
      await upgradeNow(G, 'depo', gId);
      await G.getByTestId('kamp-seviye').and(G.locator('[data-level="2"]')).waitFor({ timeout: 15_000 });
      await G.locator('.cel-root.on', { hasText: 'Kamp Seviyesi 2' }).waitFor({ timeout: 15_000 });
      await shot(G, 'G-kamp-seviye-2', 600);
      await settle(G); for (let i = 0; i < 12; i++) { await toastGone(G); await sleep(1000); }
      const o1 = await G.evaluate(() => window.__olay);
      const nK = o1.titles.filter((t) => t.includes('Kamp Seviyesi 2')).length;
      check(nK === 1, `[${bt}] "Kamp Seviyesi 2!" kutlaması ×${nK} (beklenen 1)`);
      check(o1.dede.filter((d) => d === 'kamp-seviye-up').length === 1, `[${bt}] Tüy Dede kamp-seviye-up ×${o1.dede.filter((d) => d === 'kamp-seviye-up').length}`);
      check(o1.dede.some((d) => d.startsWith('kamp-sv-depo-')), `[${bt}] bina satırı da söylendi (Kamp Seviyesi satırı onu kesmedi)`);
      await G.locator('.dede-card .en-x').click({ timeout: 1000 }).catch(() => undefined);

      step(`G2 · [${bt}] Süsle: hayaleti sürükle → Yerleştir → yeniden açınca yerinde → Taşı → Depoya`);
      if (await G.locator('.bp').count()) await closePanel(G); // kutlamayı geçen dokunuş bir binaya denk gelmiş olabilir
      await G.getByTestId('susle').click(); await G.getByTestId('sus-panel').waitFor();
      await G.locator('.dede-card .en-x').click({ timeout: 1500 }).catch(() => undefined);
      const inv0 = await G.locator('.sus-card').count(); check(inv0 >= 2, `envanterde ${inv0} süs türü (Sv 1–2 ödülleri)`);
      await G.locator('.sus-card').first().click(); await sleep(900);
      const gp = await G.evaluate(() => window.__kamp.ghost()); const gs0 = await G.evaluate(() => window.__kamp.ghostState());
      check(!!gp && !!gs0, `hayalet süs belirdi (${gs0?.id}, ${gs0?.ok ? 'konabilir' : 'konamaz'})`);
      // dokunmatik sürükleme (Chromium: CDP; WebKit: fare)
      if (bt === 'chromium') {
        const cdp = await G.context().newCDPSession(G);
        const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
        await tp('touchStart', gp.x, gp.y); for (let i = 1; i <= 10; i++) { await tp('touchMove', gp.x + i * 6, gp.y + i * 2); await sleep(40); } await tp('touchEnd');
      } else { await G.mouse.move(gp.x, gp.y); await G.mouse.down(); for (let i = 1; i <= 10; i++) { await G.mouse.move(gp.x + i * 6, gp.y + i * 2); await sleep(40); } await G.mouse.up(); }
      await sleep(500);
      const gs1 = await G.evaluate(() => window.__kamp.ghostState());
      check(gs1.gx !== gs0.gx || gs1.gy !== gs0.gy, `sürükleme hayaleti taşıdı: (${gs0.gx},${gs0.gy}) → (${gs1.gx},${gs1.gy})`);
      if (!gs1.ok) { // sürükleme bir arsaya denk geldiyse yakındaki boş hücreye al (dokunmatik taşıma yukarıda sınandı)
        await G.evaluate(([x, y]) => { for (let r = 1; r < 8; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) { const g = window.__kamp.moveGhost(x + i, y + j); if (g?.ok) return; } }, [gs1.gx, gs1.gy]);
      }
      const gs2 = await G.evaluate(() => window.__kamp.ghostState()); Object.assign(gs1, gs2);
      await shot(G, 'G-susle-hayalet', 200);
      await G.getByTestId('sus-yerlestir').click();
      for (let i = 0; i < 30 && !db.get('SELECT 1 AS x FROM decor_placed WHERE player_id = ?', gId); i++) await sleep(200);
      const row = db.get('SELECT uid, id, gx, gy FROM decor_placed WHERE player_id = ?', gId);
      check(!!row && row.gx === gs1.gx && row.gy === gs1.gy, `sunucuda yerleşik: ${row?.id} (${row?.gx},${row?.gy})`);
      await shot(G, 'G-susle-yerlesti', 700);
      await G.locator('.sus-done').click(); await G.getByTestId('sus-panel').waitFor({ state: 'detached' });
      await reopenCamp(G);
      check(!!(await G.evaluate((u) => window.__kamp.decor(u), row.uid)), 'kamp yeniden açılınca süs yerinde');
      await G.getByTestId('susle').click(); await G.getByTestId('sus-panel').waitFor();
      const dp = await G.evaluate((u) => window.__kamp.decor(u), row.uid);
      await G.mouse.click(dp.x, dp.y); await G.getByTestId('sus-tasi').waitFor({ timeout: 6000 });
      await G.getByTestId('sus-tasi').click(); await sleep(700);
      const g2 = await G.evaluate(() => window.__kamp.ghostState());
      // boş bir yere dokun: hayalet oraya gider
      const gp2 = await G.evaluate(() => window.__kamp.ghost());
      await G.mouse.click(gp2.x - 64, gp2.y + 20); await sleep(500);
      const g3 = await G.evaluate(() => window.__kamp.ghostState());
      check(g3.gx !== g2.gx || g3.gy !== g2.gy, `dokunulan yere taşındı (${g3.gx},${g3.gy}; ${g3.ok ? 'konabilir' : 'konamaz'})`);
      if (g3.ok) { await G.getByTestId('sus-yerlestir').click(); for (let i = 0; i < 20 && db.get('SELECT gx FROM decor_placed WHERE uid = ?', row.uid).gx !== g3.gx; i++) await sleep(200); check(db.get('SELECT gx, gy FROM decor_placed WHERE uid = ?', row.uid).gx === g3.gx, 'sunucu: süs taşındı'); }
      else await G.getByRole('button', { name: 'Vazgeç' }).click();
      const dp2 = await G.evaluate((u) => window.__kamp.decor(u), row.uid);
      await G.mouse.click(dp2.x, dp2.y); await G.getByTestId('sus-kaldir').waitFor({ timeout: 6000 });
      await shot(G, 'G-susle-secili', 300);
      await G.getByTestId('sus-kaldir').click();
      for (let i = 0; i < 20 && db.get('SELECT 1 AS x FROM decor_placed WHERE uid = ?', row.uid); i++) await sleep(200);
      check(!db.get('SELECT 1 AS x FROM decor_placed WHERE uid = ?', row.uid), 'depoya kaldırıldı (envantere döndü)');
      await G.locator('.sus-done').click();

      step(`G3 · [${bt}] Kamp Sv 3 → Sessiz Koru açılır (Tüy Dede bölge satırı) → Akustik Kabin kurulur`);
      const total3 = db.get('SELECT xp FROM camp_xp WHERE player_id = ?', gId).xp;
      db.run('UPDATE camp_xp SET xp = ? WHERE player_id = ?', Math.max(total3, 160), gId);
      await reopenCamp(G); await settle(G); if (await G.locator('.bp').count()) await closePanel(G);
      await upgradeNow(G, 'laboratuvar', gId);
      await G.waitForFunction(() => window.__kamp.districts().includes('koru'), null, { timeout: 15_000 });
      ok('sahnede Sessiz Koru açık');
      await G.locator('[data-testid="kamp-dede"][data-line="kamp-bolge-koru"]').waitFor({ timeout: 25_000 });
      await settle(G); if (await G.locator('.bp').count()) await closePanel(G);
      await G.evaluate(() => window.__kamp.focusDistrict('koru')); await G.waitForFunction(() => Math.abs(window.__kamp.view().x + 780) < 60, null, { timeout: 20_000 });
      await shot(G, 'G-sessiz-koru', 900);
      await upgradeNow(G, 'kabin', gId);
      check(lvlOf(gId, 'kabin') === 1, 'Akustik Kabin Sv 1');
      for (let i = 0; i < 10; i++) { await toastGone(G); await sleep(800); }
      const o3 = await G.evaluate(() => window.__olay);
      check(o3.dede.filter((d) => d === 'kamp-bolge-koru').length === 1, `[${bt}] Tüy Dede kamp-bolge-koru ×${o3.dede.filter((d) => d === 'kamp-bolge-koru').length} (beklenen 1)`);

      step(`G4 · [${bt}] arkadaş profil kartından "Kampını gez" → alkış (günde bir) → sahibine bildirim`);
      const H = await player(browser, bt, `H-${bt}`);
      const hn = `Konuk${bt[0]}${Date.now() % 1000}`;
      await H.goto(base, { waitUntil: 'load' });
      await H.getByRole('button', { name: /Yola çık/ }).click();
      await H.locator('.onboard').waitFor({ timeout: 20_000 });
      await H.getByRole('textbox', { name: 'Takma ad' }).fill(hn);
      await H.getByRole('button', { name: 'Başla' }).click();
      await H.locator('.onboard').waitFor({ state: 'detached' }); await settle(H);
      let hId = null; for (let i = 0; i < 40 && !(hId = pidOf(hn)); i++) await sleep(250);
      for (const [a, b] of [[gId, hId], [hId, gId]]) db.run('INSERT OR IGNORE INTO friends(a, b, at) VALUES(?, ?, ?)', a, b, Date.now());
      await tab(H, 'Profil'); await H.locator('.menu-tile', { hasText: 'Arkadaşlar' }).click(); await H.locator('.fr-mycode').waitFor();
      await H.getByRole('button', { name: `${nm} profili` }).click({ timeout: 10_000 });
      await H.locator('[data-testid="profil-karti"]').waitFor();
      await H.getByTestId('kampini-gez').click();
      await H.locator('.camp-base.visiting').waitFor({ timeout: 20_000 });
      await H.waitForFunction(() => !!window.__kamp?.pos('merkez'), null, { timeout: 25_000 });
      check((await H.locator('.visit-bar h1').innerText()).includes(nm), `ziyaret: ${nm} kampı (salt okunur)`);
      check(await H.locator('[data-testid="susle"]').count() === 0 && await H.locator('.camp-helpall').count() === 0, 'ziyarette süsleme ve inşaat düğmesi yok');
      await H.locator('[data-testid="kamp-dede"][data-line="kamp-ziyaret-01"]').waitFor({ timeout: 10_000 }).catch(() => undefined);
      await shot(H, 'H-ziyaret', 900);
      // ziyaret kipinde üst bant 390 ve 320 px'te ekrana sığar
      for (const [w, h] of [[390, 844], [320, 640]]) {
        await H.setViewportSize({ width: w, height: h }); await sleep(400);
        const hf = await H.evaluate(measureHudFit);
        check(hf.present && hf.offenders.length === 0, `ziyaret üst bandı ${w} px'te sığıyor${hf.offenders.length ? ': ' + hf.offenders.join(' | ') : ''}`);
      }
      await shot(H, 'H-ziyaret-320', 300);
      await H.setViewportSize({ width: 390, height: 844 }); await sleep(300);
      await G.evaluate(() => { window.__olay.toast = []; });
      await H.getByTestId('alkis').getByRole('button', { name: 'Alkış!' }).click();
      await H.locator('.cheer-done').waitFor({ timeout: 8000 });
      check(db.get('SELECT COUNT(*) AS n FROM camp_cheers WHERE from_id = ? AND to_id = ?', hId, gId).n === 1, 'sunucu: bir alkış');
      await G.waitForFunction(() => window.__olay.toast.some((t) => t.includes('kampına tepki bıraktı')), null, { timeout: 10_000 });
      ok('kamp sahibine "kampına tepki bıraktı" bildirimi');
      await shot(H, 'H-alkis', 400);
      await H.context().close();

      step(`G5 · eski istemci (campV yok) yalnız eski 7 binayı alır`);
      const old = rawClient(wsUrl); await old.call('hello', { version: 1, name: `Eski${bt[0]}${Date.now() % 1000}` });
      const st = await old.call('camp.state', {});
      check(st.camp.buildings.length === 7 && st.camp.buildings.every((b) => ['merkez', 'laboratuvar', 'atolye', 'depo', 'kule', 'revir', 'tedavi'].includes(b.id)), `eski istemci: ${st.camp.buildings.length} bina`);
      old.close();
      await browser.close();
    }
  }
  // dom hedefi: yüksek seviyeli kamp (Kamp Sv 30, binalar Sv 25/20) — doku belleği sınırı ve görüntü (--only buyume-dom tek başına)
  if (want('buyume') || only === 'buyume-dom') {
    if (browsers.includes('chromium')) {
      step('G6 · [dom] yüksek seviyeli kamp: bütün bölgeler açık, doku belleği sınırda');
      const browser = await launch('chromium');
      const shot = suite('buyume-dom');
      const ctx = await domContext(browser, ['dis-kulak', 'kanal', 'zar']);
      const D = await ctx.newPage(); D.on('pageerror', (e) => errors.push(`buyume-dom: ${e.message}`));
      const nm = `Usta${Date.now() % 1000}`;
      await D.goto(await domBundle(), { waitUntil: 'load' });
      await D.getByRole('button', { name: /Yola çık|Devam/ }).first().click({ timeout: 45_000 });
      await D.locator('.onboard').waitFor({ timeout: 20_000 });
      await D.getByRole('textbox', { name: 'Takma ad' }).fill(nm);
      await D.getByRole('button', { name: 'Başla' }).click();
      await D.locator('.onboard').waitFor({ state: 'detached' }); await settle(D);
      let dId = null; for (let i = 0; i < 40 && !(dId = pidOf(nm)); i++) await sleep(250);
      for (const b of ['merkez', 'laboratuvar', 'atolye', 'depo', 'kule', 'revir', 'tedavi']) db.run('UPDATE buildings SET level = 25 WHERE player_id = ? AND id = ?', dId, b);
      for (const b of ['kabin', 'tarama', 'park', 'denge', 'kutuphane']) db.run('UPDATE buildings SET level = 20 WHERE player_id = ? AND id = ?', dId, b);
      // en yüksek Kamp Seviyesi (eğrinin toplamı; kamp açılırken ödüller bir kez verilir)
      let need30 = 0; for (let l = 1; l < 30; l++) need30 += Math.round(30 * Math.pow(l, 1.4)) + 30;
      db.run('INSERT INTO camp_xp(player_id, xp, lib_at) VALUES(?, ?, ?) ON CONFLICT(player_id) DO UPDATE SET xp = excluded.xp', dId, need30, Date.now() - 4 * 3_600_000);
      await tab(D, 'Kamp'); await campReady(D); await sleep(1500); await settle(D);
      const m = await D.evaluate(() => window.__kamp.mem());
      check(Number(await D.getByTestId('kamp-seviye').getAttribute('data-level')) === 30, 'Kamp Sv 30');
      check((await D.evaluate(() => window.__kamp.districts())).length === 5, 'beş bölge açık');
      check(m.mb < 140, `doku belleği ${m.mb} MB (${m.textures} doku; sınır 140 MB)`);
      await shot(D, 'dom-kamp-sv30', 600);
      await D.mouse.move(195, 360); for (let i = 0; i < 14; i++) { await D.mouse.wheel(0, 120); await sleep(50); }
      await shot(D, 'dom-kamp-sv30-uzak', 1500);
      await browser.close();
    }
  }
} catch (e) {
  failed = true;
  console.error('\nHATA:', e.message);
} finally {
  await cleanup();
}
const realErrors = errors.filter((e) => !/WebSocket/i.test(e));
if (realErrors.length) { console.log('\nKonsol/taşma uyarıları:'); for (const e of [...new Set(realErrors)]) console.log('  · ' + e); }
console.log(`\n${failed ? '✗ Başarısız' : '✓ Tüm adımlar geçti'} → ${outRoot.replace(root + '/', '')}`);
process.exit(failed || realErrors.length ? 1 : 0);
