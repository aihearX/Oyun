#!/usr/bin/env node
// Uzun oturum ölçümü (YN-163): aynı sayfada N döngü "harita → bölüm (bot) → sonuç → Haritaya dön (dönüş sahnesi) → bir alt ekran
// (Takım / Mağaza / Etkinlikler) → harita". Her döngünün sonunda, haritada 1,5 sn boşta beklendikten sonra ölçülür:
//   · bellek: Chromium CDP (çöp toplama sonrası JSHeapUsedSize, DOM düğümü, JSEventListeners); her iki tarayıcıda sayfa sürecinin RSS'i
//     (/proc; Chromium --type=renderer, WebKit WebKitWebProcess) ve haritada 3 sn boşta sayfa süreci işlemcisi (%)
//   · Phaser: haritanın doku / görüntü listesi / tween / zamanlayıcı sayısı (MapScene __odiMap kancası), yok edilmemiş Phaser oyunu
//     (kurulmuş ama Game.destroy'u tamamlanmamış harita/bölüm sahneleri), canlı WebGL bağlamı (kaybedilmemiş)
//   · belge/pencere olay dinleyicisi (addEventListener sayacı), açık setInterval, açık WebSocket, ağ istemcisi aboneleri (on/onStatus),
//     oyuncu kaydı (store) boyutu
//   · süreler: Haritaya dön → dönüş sahnesi bitti (data-donus="bitti"), alt ekranın açılışı (Mağaza: ürünler geldi), haritaya dönüş
// Düzen: test derlemesi (VITE_ODI_E2E=1, ?oyun-bot=1: bot-harness'in ve oyuncu testinin kullandığı yol), kendi vite önizlemesi ve kendi
// test sunucusu (süreç içi, bellek veritabanı; boş portlar — oyuncu testinin ortak sunucusuna dokunmaz). Tarayıcılar sırayla koşar
// (RSS ayrımı için). Oyuncu kaydı 1-6. bölümler geçilmiş başlar: döngüler 7. bölümden ilerler (oyuncu testindeki gibi).
// Kullanım: node tools/harness/uzun-oturum.mjs [--browsers chromium,webkit] [--dongu 20] [--tag once] [--no-build] [--hiz 4]
//           [--alt takim,magaza,etkinlik] (döngülerde sırayla açılan alt ekranlar) [--olcek 2] (deviceScaleFactor)
// Çıktı: tools/harness/out/uzun-oturum/<tag>/<tarayıcı>.json, tablo.md (tek tablo + döngü başına eğim), son ekran görüntüleri
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { build } from 'esbuild';
import { chromium, webkit } from 'playwright';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '1'; };
const has = (k) => argv.includes(`--${k}`);
const browsers = opt('browsers', 'chromium,webkit').split(',').filter(Boolean);
const DONGU = Math.max(1, Number(opt('dongu', 20)));
const HIZ = Math.min(4, Math.max(1, Number(opt('hiz', 4))));
const ALT = opt('alt', 'takim,magaza,etkinlik').split(',').filter(Boolean);
const OLCEK = Number(opt('olcek', 2));
const tag = opt('tag', 'son');
const root = resolve(new URL('../..', import.meta.url).pathname);
const webRoot = resolve(root, 'apps/web');
const outBase = resolve(root, 'tools/harness/out/uzun-oturum');
const outDir = resolve(outBase, tag); mkdirSync(outDir, { recursive: true });
// derleme etikete göre ayrı: "önce" ve "sonra" koşuları kendi derlemeleriyle (aynı ağaçta kod değişince yeniden derlenir)
const distDir = resolve(outBase, `dist-${tag}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res, rej) => { const s = createServer(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

// ---------------------------------------------------------------- derleme, sunucu, önizleme
const vite = await import('vite');
if (!has('no-build') || !existsSync(resolve(distDir, 'index.html'))) {
  process.env.VITE_ODI_E2E = '1';
  await vite.build({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: distDir, emptyOutDir: true } });
  delete process.env.VITE_ODI_E2E;
}
const srvFile = resolve(outBase, 'server-inproc.mjs');
await build({ entryPoints: [resolve(root, 'apps/server/src/server.ts')], outfile: srvFile, bundle: true, platform: 'node', target: 'node22', format: 'esm', external: ['bufferutil', 'utf-8-validate'], banner: { js: "import { createRequire as __r } from 'node:module'; const require = __r(import.meta.url);" }, logLevel: 'warning' });
const { startServer, configFromEnv } = await import(pathToFileURL(srvFile).href);
const srv = await startServer({ ...configFromEnv({ ODI_DB: ':memory:', ODI_TEST_STORE: '1', NODE_ENV: 'test' }), port: 0, host: '127.0.0.1', log: false });
const wport = await freePort();
const pv = await vite.preview({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: distDir }, preview: { port: wport, strictPort: true, host: '127.0.0.1' } });
const url = `http://127.0.0.1:${wport}/?sunucu=${encodeURIComponent(srv.url)}&oyun-bot=1&oyun-hiz=${HIZ}`;
let closed = false;
const cleanup = async () => { if (closed) return; closed = true; await pv.close().catch(() => undefined); await srv.close().catch(() => undefined); };
for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { void cleanup().finally(() => process.exit(130)); });

// ---------------------------------------------------------------- süreçler (/proc): bu Node sürecinin torunları
function procTree() {
  const kids = new Map(); const info = new Map();
  for (const d of readdirSync('/proc')) {
    if (!/^\d+$/.test(d)) continue;
    try {
      const st = readFileSync(`/proc/${d}/stat`, 'utf8'); const f = st.slice(st.lastIndexOf(')') + 2).split(' ');
      const pp = Number(f[1]); const ticks = Number(f[11]) + Number(f[12]); // utime + stime
      const comm = st.slice(st.indexOf('(') + 1, st.lastIndexOf(')'));
      const rssKb = Number(/VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${d}/status`, 'utf8'))?.[1] ?? 0);
      const cmd = readFileSync(`/proc/${d}/cmdline`, 'utf8').replace(/\0/g, ' ');
      if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(Number(d)); info.set(Number(d), { comm, rssKb, ticks, cmd });
    } catch { /* süreç bitti */ }
  }
  const out = []; const stack = [...(kids.get(process.pid) ?? [])];
  while (stack.length) { const p = stack.pop(); stack.push(...(kids.get(p) ?? [])); const i = info.get(p); if (i) out.push({ pid: p, ...i }); }
  return out;
}
/** sayfa süreci(leri): Chromium oluşturucu, WebKit içerik süreci */
const isPage = (p) => /WebKitWebProces|WPEWebProcess/.test(p.comm) || /--type=renderer/.test(p.cmd);
const isGpu = (p) => /--type=gpu-process/.test(p.cmd) || /WebKitGPUProces/.test(p.comm);
function procMem() {
  const t = procTree();
  const page = t.filter(isPage); const gpu = t.filter(isGpu);
  return { pageMb: Math.round(page.reduce((a, p) => a + p.rssKb, 0) / 1024), gpuMb: Math.round(gpu.reduce((a, p) => a + p.rssKb, 0) / 1024), allMb: Math.round(t.reduce((a, p) => a + p.rssKb, 0) / 1024), pageTicks: page.reduce((a, p) => a + p.ticks, 0), pagePids: page.map((p) => p.pid) };
}
const HZ = 100; // /proc saat tıkı (Linux varsayılanı)

// ---------------------------------------------------------------- sayfa içi sayaçlar (uygulamadan önce kurulur)
function SAYAC() {
  if (window.__olc) return;
  const o = { iv: new Set(), gl: [], glMade: 0, ws: [], dl: new Map(), scenes: [], raf: 0 };
  window.__olc = o;
  const si = window.setInterval, ci = window.clearInterval;
  window.setInterval = function (...a) { const id = si.apply(this, a); o.iv.add(id); return id; };
  window.clearInterval = function (id) { o.iv.delete(id); return ci.call(this, id); };
  const W = window.WebSocket;
  if (W) window.WebSocket = new Proxy(W, { construct(t, a, nt) { const s = Reflect.construct(t, a, nt); o.ws.push(new WeakRef(s)); return s; } });
  const gc = HTMLCanvasElement.prototype.getContext; const seen = new WeakSet();
  HTMLCanvasElement.prototype.getContext = function (type, ...r) { const c = gc.call(this, type, ...r); if (c && /webgl/i.test(String(type)) && !seen.has(c)) { seen.add(c); o.glMade++; o.gl.push(new WeakRef(c)); } return c; };
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = function (cb) { o.raf++; return raf.call(this, cb); };
  // belge ve pencere dinleyicileri (tür + yakalama + işlev; aynı üçlü iki kez eklenmez, tarayıcı gibi)
  const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
  const key = (t, type, opts) => `${t === window ? 'w' : 'd'}|${type}|${typeof opts === 'boolean' ? opts : !!opts?.capture}`;
  EventTarget.prototype.addEventListener = function (type, fn, opts) { if ((this === window || this === document) && fn) { const k = key(this, type, opts); if (!o.dl.has(k)) o.dl.set(k, new Set()); o.dl.get(k).add(fn); } return add.call(this, type, fn, opts); };
  EventTarget.prototype.removeEventListener = function (type, fn, opts) { if ((this === window || this === document) && fn) o.dl.get(key(this, type, opts))?.delete(fn); return rem.call(this, type, fn, opts); };
  // Phaser sahne kancaları (LevelScene __odiScene, MapScene __odiMap): atanan her sahne kaydedilir (zayıf), yok edilip edilmediği sayılır
  for (const name of ['__odiScene', '__odiMap']) {
    let v;
    Object.defineProperty(globalThis, name, { configurable: true, get: () => v, set: (s) => { v = s; if (s) o.scenes.push({ kind: name === '__odiMap' ? 'harita' : 'bolum', ref: new WeakRef(s) }); } });
  }
}
/** haritada, döngü sonunda (sayfa içinde) */
function OLC() {
  const o = window.__olc; const r = {};
  r.interval = o.iv.size;
  r.wsOpen = o.ws.filter((w) => { const s = w.deref(); return s && s.readyState <= 1; }).length;
  r.glMade = o.glMade; r.glLive = o.gl.filter((w) => { const c = w.deref(); return c && !c.isContextLost(); }).length;
  let dl = 0; for (const s of o.dl.values()) dl += s.size; r.docListeners = dl;
  r.canvas = document.querySelectorAll('canvas').length;
  // Phaser: yok edilmemiş oyunlar (Game.destroy istenmiş ama tamamlanmamışlar dahil) ve onların dokuları
  const games = new Set(); let pending = 0;
  for (const s of o.scenes) { const sc = s.ref.deref(); const g = sc?.game ?? sc?.sys?.game; if (!g || games.has(g)) continue; if (sc.sys?.settings?.status === 9 /* DESTROYED */ || !g.textures) continue; games.add(g); if (g.pendingDestroy) pending++; }
  r.phaserGames = games.size; r.phaserPending = pending;
  r.phaserTexAll = [...games].reduce((a, g) => a + Object.keys(g.textures.list ?? {}).length, 0);
  const m = globalThis.__odiMap;
  if (m?.sys && m.sys.settings.status !== 9) {
    r.mapTex = Object.keys(m.game.textures.list).length; r.mapDisplay = m.sys.displayList.length;
    r.mapTweens = m.tweens.getTweens().length; r.mapTimers = (m.time._active?.length ?? 0) + (m.time._pendingInsertion?.length ?? 0);
    r.mapScenes = m.game.scene.scenes.length;
  }
  // oyuncu kaydı ve ağ istemcisi (test derlemesi kancası window.__ag; net.ts)
  const ag = window.__ag;
  if (ag) {
    try { r.storeKb = Math.round(JSON.stringify(ag.store.getState()).length / 1024); } catch { /* yok */ }
    try { r.socialKb = Math.round(JSON.stringify(ag.social.getState()).length / 1024); } catch { /* yok */ }
    const c = ag.net?.();
    if (c) {
      // abone sayacı: ilk ölçümde istemcinin on/onStatus'u sarılır, sonrakiler açık abonelikleri sayar (ilk ölçümden önce kurulanlar hariç)
      if (!c.__olc) { c.__olc = { live: 0 }; for (const fn of ['on', 'onStatus', 'onMe']) { const f = c[fn]; if (typeof f !== 'function') continue; c[fn] = (...a) => { c.__olc.live++; const off = f.apply(c, a); let done = false; return () => { if (!done) { done = true; c.__olc.live--; } return off(); }; }; } }
      r.netSubs = c.__olc.live; r.netQueue = c.queued?.() ?? 0;
    }
  }
  return r;
}

// ---------------------------------------------------------------- akış yardımcıları
/** sayfa içinde tıkla (yalnız click; haritanın pointerdown'ı dönüş sahnesini atlatırdı); bulunduysa true */
const tikla = (page, sel) => page.evaluate((q) => { const el = document.querySelector(q); if (el instanceof HTMLElement) { el.click(); return true; } return false; }, sel).catch(() => false);
/** kutlama pencereleri, bildirimler, takma ad (yalnız DOM düğmeleriyle) */
async function settle(page) {
  for (let i = 0; i < 12; i++) {
    let did = false;
    if (await page.locator('.onboard').count()) { await page.getByRole('textbox', { name: 'Takma ad' }).fill('Ölçer').catch(() => undefined); await page.getByRole('button', { name: 'Başla' }).click().catch(() => undefined); did = true; }
    if (await page.locator('.cel-root.on').count()) { did = (await tikla(page, '.cel-root.on .cel-cta button')) || (await tikla(page, '.cel-root.on')) || did; }
    if (await tikla(page, '.toast-top')) did = true;
    if (!did) return;
    await sleep(350);
  }
}
async function waitFor(page, pred, ms, onTick) {
  const until = Date.now() + ms;
  while (Date.now() < until) { if (await pred()) return true; if (onTick) await onTick(); await sleep(250); }
  return false;
}
const mapReady = (page) => page.evaluate(() => !!document.querySelector('.map-screen[data-donus="bitti"] .map-stage canvas')).catch(() => false);

async function suite(bt) {
  console.log(`\n▶ ${bt} · ${DONGU} döngü · alt ekranlar ${ALT.join(', ')} · bot hızı ${HIZ}`);
  const browser = await (bt === 'webkit' ? webkit : chromium).launch({ headless: true, executablePath: bt === 'chromium' ? process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined, args: bt === 'chromium' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc'] : [] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: OLCEK, hasTouch: true, ...(bt === 'chromium' ? { isMobile: true } : {}), locale: 'tr-TR', serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    try {
      if (!localStorage.getItem('odi-v1')) {
        const progress = {}; for (let i = 1; i <= 6; i++) progress[i] = { stars: 3, best: 1000, plays: 1 };
        localStorage.setItem('odi-v1', JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true }, progress, sounds: false }, version: 3 }));
      }
    } catch { /* depolama yok */ }
  });
  await ctx.addInitScript(SAYAC);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|AudioContext|WebGL|GPU|Autoplay|WebSocket connection|ERR_CONNECTION|Failed to load resource|swiftshader|GroupMarkerNotSet/i.test(m.text())) errors.push(m.text()); });
  const cdp = bt === 'chromium' ? await ctx.newCDPSession(page) : null;
  if (cdp) await cdp.send('Performance.enable');
  const rows = [];
  const shot = (label) => page.screenshot({ path: resolve(outDir, `${bt}-${label}.png`) }).catch(() => undefined);
  try {
    await page.goto(url, { waitUntil: 'load' });
    await page.getByRole('button', { name: /Yola çık|Devam et/ }).first().click({ timeout: 90_000 });
    await page.locator('nav.tabbar').waitFor({ timeout: 60_000 });
    await settle(page);
    if (!(await waitFor(page, () => mapReady(page), 120_000, () => settle(page)))) throw new Error('harita açılmadı');
    for (let c = 1; c <= DONGU; c++) {
      const row = { dongu: c };
      // ---- bölüm (bot)
      const unlocked = await page.evaluate(() => Number(/\d+/.exec(document.querySelector('.map-play')?.textContent ?? '')?.[0] ?? 0));
      row.bolum = unlocked;
      const tL = Date.now();
      await tikla(page, '.map-play');
      const res = await waitFor(page, async () => (await page.locator('.result-actions').count()) > 0, 8 * 60_000, async () => { await page.getByRole('button', { name: /Haydi/ }).click({ timeout: 800 }).catch(() => undefined); });
      if (!res) throw new Error(`döngü ${c}: bölüm ${unlocked} bitmedi`);
      row.bolumSn = Math.round((Date.now() - tL) / 1000);
      row.sonuc = await page.evaluate(() => (window.__odi?.result?.completed ? `+${window.__odi.result.stars}` : 'x')).catch(() => '?');
      await sleep(800); await settle(page);
      // ---- Haritaya dön → dönüş sahnesi
      const tM = Date.now();
      if (!(await tikla(page, '.result-actions [data-act="harita"]'))) throw new Error(`döngü ${c}: sonuçta Harita düğmesi yok`);
      let cel = 0;
      const ok = await waitFor(page, () => mapReady(page), 10 * 60_000, async () => { if (await page.locator('.cel-root.on').count()) { cel++; await settle(page); } });
      if (!ok) { await shot(`d${c}-donus`); throw new Error(`döngü ${c}: dönüş sahnesi 10 dk'da bitmedi`); }
      row.donusSn = +((Date.now() - tM) / 1000).toFixed(1); row.kutlama = cel;
      await settle(page);
      // ---- alt ekran ve haritaya geri
      const alt = ALT[(c - 1) % ALT.length]; row.alt = alt;
      const tA = Date.now(); let opened = false;
      if (alt === 'takim') { await tikla(page, 'nav.tabbar .tab[data-tab="team"]'); opened = await waitFor(page, async () => (await page.locator('.team-hero, .team-head').count()) > 0, 120_000, () => settle(page)); }
      if (alt === 'magaza') { await tikla(page, '[aria-label="Kristal ve mağaza"]'); opened = await waitFor(page, async () => (await page.locator('.screen .test-banner, .screen .stack .card').count()) > 0, 120_000); }
      if (alt === 'etkinlik') { await tikla(page, '[data-testid="ev-fab"]'); opened = await waitFor(page, async () => (await page.getByRole('heading', { name: 'Etkinlikler' }).count()) > 0 && !(await page.locator('.map-screen').count()), 120_000); }
      row.altSn = opened ? +((Date.now() - tA) / 1000).toFixed(1) : null;
      await sleep(600);
      const tH = Date.now();
      if (alt === 'takim') await tikla(page, 'nav.tabbar .tab[data-tab="map"]'); else await tikla(page, 'button[aria-label="Geri"]');
      if (!(await waitFor(page, () => mapReady(page), 5 * 60_000, () => settle(page)))) { await tikla(page, 'nav.tabbar .tab[data-tab="map"]'); if (!(await waitFor(page, () => mapReady(page), 5 * 60_000, () => settle(page)))) throw new Error(`döngü ${c}: alt ekrandan haritaya dönülmedi`); }
      row.haritaSn = +((Date.now() - tH) / 1000).toFixed(1);
      // ---- ölçüm (haritada boşta)
      await sleep(1500);
      const p0 = procMem(); const r0 = await page.evaluate(() => window.__olc.raf); await sleep(3000); const p1 = procMem(); const r1 = await page.evaluate(() => window.__olc.raf);
      row.bostaCpu = Math.round(((p1.pageTicks - p0.pageTicks) / HZ / 3) * 100); row.rafSn = Math.round((r1 - r0) / 3);
      if (cdp) {
        await cdp.send('HeapProfiler.collectGarbage').catch(() => undefined);
        const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
        row.heapMb = +(m.JSHeapUsedSize / 1048576).toFixed(1); row.nodes = m.Nodes; row.jsListeners = m.JSEventListeners;
      }
      const pm = procMem(); row.pageMb = pm.pageMb; row.gpuMb = pm.gpuMb; row.allMb = pm.allMb;
      Object.assign(row, await page.evaluate(OLC));
      rows.push(row);
      console.log(`  ${String(c).padStart(2)} B${row.bolum}${row.sonuc} dönüş ${row.donusSn}s ${row.alt} ${row.altSn ?? '-'}s · ${row.heapMb != null ? `yığın ${row.heapMb} MB · ` : ''}sayfa ${row.pageMb} MB · boşta %${row.bostaCpu} · Phaser oyun ${row.phaserGames} (bekleyen ${row.phaserPending}) doku ${row.mapTex ?? '-'}/${row.phaserTexAll} · GL ${row.glLive}/${row.glMade} · dinleyici ${row.docListeners} · interval ${row.interval} · ws ${row.wsOpen} · ağ abone ${row.netSubs ?? '-'}`);
      writeFileSync(resolve(outDir, `${bt}.json`), JSON.stringify({ bt, dongu: DONGU, olcek: OLCEK, hiz: HIZ, at: new Date().toISOString().slice(0, 16), rows, errors }, null, 2));
    }
    await shot('son');
  } catch (e) { errors.push(`akış: ${String(e.message ?? e).split('\n')[0]}`); console.log(`  ✗ ${errors.at(-1)}`); await shot('hata'); }
  await browser.close();
  writeFileSync(resolve(outDir, `${bt}.json`), JSON.stringify({ bt, dongu: DONGU, olcek: OLCEK, hiz: HIZ, at: new Date().toISOString().slice(0, 16), rows, errors }, null, 2));
  return { bt, rows, errors };
}

// ---------------------------------------------------------------- tablo
/** en küçük kareler eğimi (döngü başına); ilk iki döngü ısınma (önbellek, ilk parça yüklemesi) sayılmaz */
function slope(rows, k) {
  const pts = rows.filter((r) => r.dongu > 2 && typeof r[k] === 'number').map((r) => [r.dongu, r[k]]);
  if (pts.length < 3) return null;
  const n = pts.length; const mx = pts.reduce((a, p) => a + p[0], 0) / n; const my = pts.reduce((a, p) => a + p[1], 0) / n;
  const sxx = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0); return sxx ? pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / sxx : 0;
}
const COLS = [['dongu', 'Döngü'], ['bolum', 'Bölüm'], ['sonuc', 'Sonuç'], ['donusSn', 'Dönüş sn'], ['alt', 'Alt ekran'], ['altSn', 'Alt sn'], ['haritaSn', 'Harita sn'], ['heapMb', 'Yığın MB'], ['pageMb', 'Sayfa RSS MB'], ['gpuMb', 'GPU RSS MB'], ['bostaCpu', 'Boşta CPU %'], ['phaserGames', 'Phaser oyun'], ['phaserPending', 'Yok edilmeyi bekleyen'], ['mapTex', 'Harita doku'], ['phaserTexAll', 'Doku (tüm oyunlar)'], ['mapDisplay', 'Görüntü listesi'], ['mapTweens', 'Tween'], ['mapTimers', 'Zamanlayıcı'], ['glLive', 'Canlı GL'], ['glMade', 'Kurulan GL'], ['docListeners', 'Belge dinleyici'], ['jsListeners', 'JS dinleyici (CDP)'], ['nodes', 'DOM düğümü'], ['interval', 'setInterval'], ['wsOpen', 'WebSocket'], ['netSubs', 'Ağ abonesi'], ['storeKb', 'Kayıt KB']];
const own = [];
try { for (const bt of browsers) own.push(await suite(bt)); } finally { await cleanup(); }
// tablo etiketin bütün tarayıcılarını birleştirir: aynı etiketle ayrı süreçlerde koşan tarayıcılar (ör. --browsers chromium ve
// --browsers webkit aynı anda; RSS her süreçte yalnız kendi tarayıcısınınki) tek tabloda
const results = ['chromium', 'webkit'].map((bt) => { try { return JSON.parse(readFileSync(resolve(outDir, `${bt}.json`), 'utf8')); } catch { return null; } }).filter(Boolean);
const lines = [`# Uzun oturum ölçümü · ${tag}`, '', results.map((r) => `${r.bt}: ${r.at} · ${r.dongu} döngü · bot hızı ${r.hiz} · 390×844 @${r.olcek}`).join(' · '), `Alt ekranlar sırayla: ${ALT.join(', ')}. Ölçüm her döngünün sonunda haritada, 1,5 sn boşta beklendikten sonra (Chromium yığını çöp toplama sonrası).`, ''];
lines.push(`| Tarayıcı | ${COLS.map((c) => c[1]).join(' | ')} |`, `|${'---|'.repeat(COLS.length + 1)}`);
for (const r of results) {
  for (const row of r.rows) lines.push(`| ${r.bt} | ${COLS.map(([k]) => row[k] ?? '-').join(' | ')} |`);
  const sl = COLS.slice(3).map(([k]) => { const s = slope(r.rows, k); return s == null ? '-' : (Math.abs(s) < 0.05 ? '0' : s.toFixed(2)); });
  lines.push(`| ${r.bt} | **eğim / döngü (3.+)** | | | ${sl.join(' | ')} |`);
}
for (const r of results) if (r.errors.length) lines.push('', `${r.bt} hataları: ${[...new Set(r.errors)].slice(0, 6).join(' · ')}`);
writeFileSync(resolve(outDir, 'tablo.md'), lines.join('\n') + '\n');
console.log('\n' + lines.join('\n'));
console.log(`\nçıktı: tools/harness/out/uzun-oturum/${tag}/tablo.md`);
process.exit(own.some((r) => r.rows.length < DONGU) ? 1 : 0);
