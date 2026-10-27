#!/usr/bin/env node
// ODİ web: ana ekran ve çevrimdışı açılış testi (MK-037). Üretim derlemesi (VITE_ODI_E2E yok) + vite preview; Chromium + WebKit.
//   (a) manifest ve simgeler: 200, doğru boyut (PNG başlığı + tarayıcıda çözülen görüntü), koyu background_color,
//       index.html'de apple-touch-icon (180×180), durum çubuğu (black-translucent), ana ekran adı "ODİ"
//   (b) çevrimdışı: ilk ziyaret (service worker kurulur, kabuk önbelleğe alınır) → context.setOffline(true) → yenile:
//       açılış ekranı gelir; "Yola çık" → hikâye → Atla → 1. bölüm (Phaser) başlar; aynı bağlantısız durumda
//       `?bot=1&level=1` bölümü baştan sona oynar (bot). Çalınmış ses kaydı bağlantısızken gelir; /saglik ve /olcum
//       önbelleğe girmez; bağlantısızken düşen istek yalnız hiç çalınmamış ses kaydı olabilir. Sayfa hatası olmamalı.
//   (c) güncelleme: v1 açıkken v2 yayımlanır → v2 arka planda kurulur ve BEKLER (açık sayfa yenilenmez, hâlâ v1'de);
//       sayfa kapanıp yeniden açılınca v2 gelir (eski index'te takılmaz), eski önbellek silinir; ardından çevrimdışı
//       açılış da v2'yi açar.
//   (d) açılışta beyaz kare yok: ilk çizilen kareler (Chromium: CDP screencast, gerçek kareler; WebKit: art arda ekran
//       görüntüsü) koyu; CSS dosyası gelmeden önceki zemin (satır içi stil) koyu; çevrimdışı açılışın ilk karesi de koyu.
// Kullanım: node tools/harness/pwa-e2e.mjs [--browsers chromium,webkit] [--no-build]
// Çıktı: tools/harness/out/pwa/ (v1, v2, yayin, ekran görüntüleri)
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { chromium, webkit } from 'playwright';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1]; };
const has = (k) => argv.includes(`--${k}`);
const root = resolve(new URL('../..', import.meta.url).pathname);
const browsers = opt('browsers', 'chromium,webkit').split(',');
const out = resolve(root, 'tools/harness/out/pwa');
const V1 = resolve(out, 'v1'), V2 = resolve(out, 'v2'), YAYIN = resolve(out, 'yayin');
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = new Set();
const cleanup = () => { for (const p of procs) { try { p.kill(); } catch { /* yok */ } } };
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { cleanup(); process.exit(130); });
const run = (cmd, a, o = {}) => new Promise((res, rej) => { const p = spawn(cmd, a, { cwd: root, stdio: 'inherit', ...o }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${a.join(' ')} → ${c}`)))); });

// ---------------------------------------------------------------- derleme: v1 ve (farklı içerikli) v2
const vite = resolve(root, 'node_modules/vite/bin/vite.js');
const build = (dir, env = {}) => run(process.execPath, [vite, 'build', '--outDir', dir, '--emptyOutDir', '--logLevel', 'warn'], { cwd: resolve(root, 'apps/web'), env: { ...process.env, VITE_ODI_E2E: '', ...env } });
if (!has('no-build') || !existsSync(resolve(V1, 'sw.js')) || !existsSync(resolve(V2, 'sw.js'))) {
  await build(V1);
  // v2: başka bir sunucu adresi gömülü → paket içeriği, dosya adları ve service worker sürümü değişir (yeni yayın gibi)
  await build(V2, { VITE_ODI_SERVER: 'ws://127.0.0.1:59998' });
}
const surum = (dir) => /const SURUM = '([0-9a-f]+)'/.exec(readFileSync(resolve(dir, 'sw.js'), 'utf8'))?.[1];
const giris = (dir) => /<script type="module" crossorigin src="([^"]+)"/.exec(readFileSync(resolve(dir, 'index.html'), 'utf8'))?.[1];
const S1 = surum(V1), S2 = surum(V2), G1 = giris(V1), G2 = giris(V2);
if (!S1 || !S2 || !G1 || !G2) throw new Error('derleme çıktısı beklenen biçimde değil (sw.js sürümü / index.html giriş betiği)');
if (S1 === S2 || G1 === G2) throw new Error(`v1 ve v2 aynı çıktı (${S1}/${S2}, ${G1}/${G2})`);
console.log(`v1 ${S1} ${G1} · v2 ${S2} ${G2}`);

// ---------------------------------------------------------------- yayın: vite preview (yeni sürüm = durdur, dosyaları üstüne kopyala, aynı portta yeniden aç)
const port = 6100 + Math.floor(Math.random() * 300);
const base = `http://localhost:${port}`;
let preview = null;
async function yayinla(dir, temizle) {
  if (preview) { const p = preview; preview = null; const bitti = new Promise((r) => p.once('exit', r)); p.kill(); await bitti; procs.delete(p); }
  if (temizle) rmSync(YAYIN, { recursive: true, force: true });
  // sunucudaki gibi: yeni sürüm üstüne yazılır, önceki /assets dosyaları kalır (docs/18-sunucu-kurulum.md)
  cpSync(dir, YAYIN, { recursive: true });
  preview = spawn(process.execPath, [vite, 'preview', '--port', String(port), '--strictPort', '--outDir', YAYIN], { cwd: resolve(root, 'apps/web'), stdio: 'ignore' });
  procs.add(preview);
  for (let i = 0; i < 150; i++) { try { if ((await fetch(`${base}/`)).ok) return; } catch { /* henüz */ } await sleep(200); }
  throw new Error('vite preview açılmadı');
}

// ---------------------------------------------------------------- yardımcılar
/** PNG çöz (8 bit RGB/RGBA, taramasız: Playwright ekran görüntüleri ve simgeler) */
function pngBoyut(buf) {
  if (buf.length < 24 || buf.toString('latin1', 1, 4) !== 'PNG' || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
function pngCoz(buf) {
  let p = 8, w = 0, h = 0, ct = 0, depth = 0, inter = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8); const d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ct = d[9]; inter = d[12]; } else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || inter !== 0 || (ct !== 2 && ct !== 6)) throw new Error(`desteklenmeyen PNG (derinlik ${depth}, renk ${ct}, tarama ${inter})`);
  const bpp = ct === 6 ? 4 : 3; const raw = inflateSync(Buffer.concat(idat)); const stride = w * bpp; const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, bpp, px };
}
/** kare ölçümü: ortalama parlaklık (0–255) ve parlak (>200) piksel oranı */
function parlaklik(buf) {
  const { w, h, bpp, px } = pngCoz(buf); const n = w * h; let s = 0, br = 0;
  for (let i = 0; i < n; i++) { const l = 0.2126 * px[i * bpp] + 0.7152 * px[i * bpp + 1] + 0.0722 * px[i * bpp + 2]; s += l; if (l > 200) br++; }
  return { ort: Math.round(s / n), parlak: +(br / n).toFixed(3) };
}
/** koyu kare: ortalama parlaklık düşük ve parlak piksel azı (açılış ekranında beyaz yazı ve Odi'nin gözleri var) */
const koyu = (m) => m.ort < 80 && m.parlak < 0.15;
const renkKoyu = (css) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css); return !!m && 0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3] < 60; };

const sonuc = []; // { tarayici, adim, ok, not }
const kaydet = (tarayici, adim, ok, not = '') => { sonuc.push({ tarayici, adim, ok, not }); console.log(`${ok ? 'GEÇTİ' : 'KALDI'}  ${tarayici.padEnd(8)} ${adim}${not ? ` · ${not}` : ''}`); };
async function adim(tarayici, ad, fn) {
  try { const not = await fn(); kaydet(tarayici, ad, true, typeof not === 'string' ? not : ''); } catch (e) { kaydet(tarayici, ad, false, String(e?.message ?? e).split('\n')[0].slice(0, 300)); }
}
const beklenen = (kosul, mesaj) => { if (!kosul) throw new Error(mesaj); };
/** sayfada eşzamansız koşul (waitForFunction Promise döndüren işlevi beklemez): doğru olana dek yokla */
async function bekle(page, fn, arg, ms, ne) {
  const t0 = Date.now();
  for (;;) {
    if (await page.evaluate(fn, arg).catch(() => false)) return;
    if (Date.now() - t0 > ms) throw new Error(`zaman aşımı (${ms / 1000} sn): ${ne}`);
    await sleep(250);
  }
}

/** service worker etkin, sayfayı denetliyor ve kabuk önbellekte (sw.js ön bellek listesinin tamamı) */
async function kabukHazir(page, s) {
  await bekle(page, async (s) => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg?.active || reg.active.state !== 'activated' || !navigator.serviceWorker.controller) return false;
    return (await caches.keys()).includes(`odi-kabuk-${s}`) && new URL(reg.active.scriptURL).pathname === '/sw.js';
  }, s, 60_000, `service worker ${s} etkin ve sayfayı denetliyor`);
  const [n, beklenenN] = await page.evaluate(async (s) => {
    const c = await caches.open(`odi-kabuk-${s}`);
    const src = await (await fetch('/sw.js', { cache: 'no-store' })).text();
    const liste = JSON.parse(/const ONDEN = (\[.*\]);/.exec(src)[1]);
    const keys = new Set((await c.keys()).map((r) => new URL(r.url).pathname));
    return [liste.filter(([, k]) => keys.has(k)).length, liste.length];
  }, s);
  beklenen(n === beklenenN, `kabuk eksik önbellekte: ${n}/${beklenenN}`);
  return n;
}
const sayfaGiris = (page) => page.evaluate(() => document.querySelector('script[type="module"][src]')?.getAttribute('src'));
const yeniBaglam = (browser) => browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, locale: 'tr-TR' });
const hataDinle = (page, list) => page.on('pageerror', (e) => list.push(String(e?.message ?? e).slice(0, 200)));

// ---------------------------------------------------------------- tarayıcı başına
await yayinla(V1, true);
for (const bn of browsers) {
  const B = bn === 'webkit' ? webkit : chromium;
  const browser = await B.launch({ headless: true, executablePath: bn === 'chromium' ? process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined, args: bn === 'chromium' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] : [] });
  const shot = (page, ad) => page.screenshot({ path: resolve(out, `${bn}-${ad}.png`) }).catch(() => undefined);

  // (a) manifest ve simgeler
  await adim(bn, '(a) manifest + simgeler', async () => {
    const ctx = await yeniBaglam(browser); const page = await ctx.newPage();
    try {
      await page.goto(`${base}/`);
      const head = await page.evaluate(() => {
        const m = (n) => document.querySelector(`meta[name="${n}"]`)?.getAttribute('content') ?? null;
        return { manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href'), touch: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
          capable: m('apple-mobile-web-app-capable'), bar: m('apple-mobile-web-app-status-bar-style'), title: m('apple-mobile-web-app-title'), theme: m('theme-color') };
      });
      beklenen(head.capable === 'yes' && head.bar === 'black-translucent' && head.title === 'ODİ', `iOS meta etiketleri: ${JSON.stringify(head)}`);
      beklenen(head.manifest && head.touch, `manifest / apple-touch-icon bağlantısı yok: ${JSON.stringify(head)}`);
      const mr = await page.request.get(new URL(head.manifest, base).href);
      beklenen(mr.status() === 200, `manifest ${mr.status()}`);
      const man = JSON.parse(await mr.text());
      beklenen(man.background_color?.toLowerCase() === '#140c35' && man.theme_color && man.id && man.scope === '/' && man.display === 'standalone' && man.start_url === '/', `manifest alanları: ${JSON.stringify({ ...man, icons: undefined })}`);
      beklenen(renkKoyu(`rgb(${parseInt(man.background_color.slice(1, 3), 16)},${parseInt(man.background_color.slice(3, 5), 16)},${parseInt(man.background_color.slice(5, 7), 16)})`), 'background_color koyu değil');
      const istek = [...man.icons.filter((i) => i.type === 'image/png').map((i) => ({ src: i.src, size: i.sizes, purpose: i.purpose ?? 'any' })), { src: head.touch, size: '180x180', purpose: 'apple-touch-icon' }];
      for (const p of ['any', 'maskable']) for (const s of ['192x192', '512x512']) if (p === 'any' || s === '512x512') beklenen(istek.some((i) => i.size === s && i.purpose.split(' ').includes(p)), `manifestte ${p} ${s} PNG yok`);
      const notlar = [];
      for (const ic of istek) {
        const r = await page.request.get(new URL(ic.src, base).href);
        beklenen(r.status() === 200 && /image\/png/.test(r.headers()['content-type'] ?? ''), `${ic.src}: ${r.status()} ${r.headers()['content-type']}`);
        const bd = pngBoyut(await r.body()); const [w, h] = ic.size.split('x').map(Number);
        beklenen(bd && bd.w === w && bd.h === h, `${ic.src}: PNG ${bd?.w}×${bd?.h}, beklenen ${ic.size}`);
        const nat = await page.evaluate((src) => new Promise((ok) => { const im = new Image(); im.onload = () => ok([im.naturalWidth, im.naturalHeight]); im.onerror = () => ok(null); im.src = src; }), ic.src);
        beklenen(nat && nat[0] === w && nat[1] === h, `${ic.src}: tarayıcıda ${nat}`);
        if (ic.purpose === 'maskable' || ic.purpose === 'apple-touch-icon') {
          // güvenli alan dışı (köşeler) koyu mor gece zeminiyle dolu olmalı (YN-010 ikonu): saydam ya da beyaz köşe = kırpılınca boşluk
          const { px, bpp, w: W } = pngCoz(await r.body());
          for (const [x, y] of [[1, 1], [W - 2, 1], [1, W - 2], [W - 2, W - 2]]) { const i = (y * W + x) * bpp; beklenen((bpp === 3 || px[i + 3] === 255) && Math.max(px[i], px[i + 1], px[i + 2]) < 140 && px[i + 2] > px[i + 1], `${ic.src}: köşe (${x},${y}) koyu mor değil: ${[...px.subarray(i, i + bpp)]}`); }
        }
        notlar.push(`${ic.src.split('/').pop()} ${w}×${h}`);
      }
      return notlar.join(', ');
    } finally { await ctx.close(); }
  });

  // (d) açılışta beyaz kare yok (ilk ziyaret: service worker yok)
  await adim(bn, '(d) ilk kareler koyu', async () => {
    const ctx = await yeniBaglam(browser); const page = await ctx.newPage();
    try {
      // önceki sayfa düz gri: gri kareler henüz bizim belgemiz çizilmeden önceki ekrandır; ilk gri olmayan kare bizim ilk karemiz
      await page.setContent('<html style="background:#808080"><body></body></html>'); await sleep(300);
      const kareler = [];
      if (bn === 'chromium') {
        // gerçek kareler: CDP screencast (her çizilen kare)
        const cdp = await ctx.newCDPSession(page);
        cdp.on('Page.screencastFrame', (f) => { kareler.push(Buffer.from(f.data, 'base64')); void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => undefined); });
        await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
        await sleep(300);
        await page.goto(`${base}/`, { waitUntil: 'commit' });
        await page.waitForSelector('.title-screen', { timeout: 30_000 }); await sleep(800);
        await cdp.send('Page.stopScreencast');
      } else {
        await page.goto(`${base}/`, { waitUntil: 'commit' });
        const t0 = Date.now();
        while (Date.now() - t0 < 2500) { try { kareler.push(await page.screenshot({ timeout: 5000 })); } catch { /* kare yok */ } }
      }
      const tum = kareler.map(parlaklik);
      const gri = (x) => x.ort >= 124 && x.ort <= 132 && x.parlak === 0;
      const m = tum.slice(Math.max(0, tum.findIndex((x) => !gri(x))));
      beklenen(m.length >= 2 && !gri(m[0]), `sayfanın karesi alınamadı (${tum.length} kare, ${m.length} sayfa karesi)`);
      const kotu = m.findIndex((x) => !koyu(x));
      writeFileSync(resolve(out, `${bn}-ilk-kare.png`), kareler[tum.length - m.length]);
      beklenen(kotu < 0, `sayfanın ${kotu + 1}. karesi açık renk: ${JSON.stringify(m[kotu])} (ilk: ${JSON.stringify(m[0])})`);
      // CSS dosyası gelmeden önceki zemin: satır içi stil (yavaş bağlantıda ilk boyama)
      const ctx2 = await yeniBaglam(browser); const p2 = await ctx2.newPage();
      try {
        const tutulan = [];
        await p2.route('**/assets/*.css', (r) => { tutulan.push(r); });
        await p2.goto(`${base}/`, { waitUntil: 'commit' });
        await p2.waitForFunction(() => document.body !== null, null, { timeout: 15_000 });
        const zemin = await p2.evaluate(() => [getComputedStyle(document.documentElement).backgroundColor, getComputedStyle(document.body).backgroundColor, document.styleSheets.length]);
        for (const r of tutulan) await r.continue().catch(() => undefined);
        beklenen(tutulan.length > 0 || zemin[2] === 1, 'CSS isteği tutulamadı');
        beklenen(renkKoyu(zemin[0]) && renkKoyu(zemin[1]), `CSS'ten önce zemin açık: html ${zemin[0]}, body ${zemin[1]}`);
        return `${m.length} sayfa karesi (${tum.length - m.length} önceki), ilk ort ${m[0].ort}, en açık ort ${Math.max(...m.map((x) => x.ort))}; CSS öncesi zemin ${zemin[0]}`;
      } finally { await ctx2.close(); }
    } finally { await ctx.close(); }
  });

  // (b) çevrimdışı açılış + 1. bölüm
  await adim(bn, '(b) çevrimdışı açılış + 1. bölüm', async () => {
    const ctx = await yeniBaglam(browser); const page = await ctx.newPage(); const hatalar = []; hataDinle(page, hatalar);
    // bağlantısızken düşen istekler: yalnız henüz çalınmamış (önbellekte olmayan) ses kayıtları olabilir, kabuk dosyası olamaz
    const dusen = []; let cevrimdisi = false;
    page.on('requestfailed', (r) => { if (cevrimdisi) dusen.push(new URL(r.url()).pathname); });
    try {
      await page.goto(`${base}/`); await page.waitForSelector('.title-screen', { timeout: 30_000 });
      const n = await kabukHazir(page, S1);
      // çalınan ses kaydı önbelleğe girer; /saglik ve /olcum hiç girmez
      const sesDosya = readdirSync(resolve(V1, 'voice')).find((f) => f.endsWith('.mp3'));
      const onb = await page.evaluate(async ([ses, s]) => {
        for (const u of [`/voice/${ses}`, '/saglik', '/olcum']) await fetch(u).then((r) => r.arrayBuffer()).catch(() => undefined);
        await new Promise((r) => setTimeout(r, 500));
        const c = await caches.open(`odi-kabuk-${s}`);
        return { ses: !!(await c.match(`/voice/${ses}`)), saglik: !!(await caches.match('/saglik', { ignoreSearch: true })), olcum: !!(await caches.match('/olcum', { ignoreSearch: true })) };
      }, [sesDosya, S1]);
      beklenen(onb.ses && !onb.saglik && !onb.olcum, `önbellek kuralları: ${JSON.stringify(onb)}`);
      await ctx.setOffline(true); cevrimdisi = true;
      await page.reload({ waitUntil: 'commit' });
      let ilk = null; try { ilk = parlaklik(await page.screenshot({ timeout: 10_000 })); } catch { /* yok */ }
      await page.waitForSelector('.title-screen', { timeout: 30_000 });
      beklenen(!ilk || koyu(ilk), `çevrimdışı açılış ilk karesi açık: ${JSON.stringify(ilk)}`);
      beklenen(await page.evaluate(() => !!navigator.serviceWorker.controller && !navigator.onLine), 'sayfa service worker denetiminde ve çevrimdışı değil');
      await shot(page, 'cevrimdisi-acilis');
      // normal akış: Yola çık → hikâye → Atla → 1. bölüm başlar (bölüm üreticisi + Phaser parçaları önbellekten)
      await page.getByRole('button', { name: /Yola çık/ }).click();
      await page.locator('.story-skip').click({ timeout: 30_000 });
      // ilk biyomun tanıtımı (Haydi!) → bölüm (Phaser önbellekten) → dokun ve başla
      const t0 = Date.now(); let basladi = false;
      while (!basladi && Date.now() - t0 < 60_000) {
        basladi = await page.evaluate(() => !!window.__odi?.events?.some((e) => e.type === 'started'));
        const h = page.getByRole('button', { name: /Haydi/ });
        if (!basladi && await h.count()) await h.click({ timeout: 5000 }).catch(() => undefined);
        // bölüm açıldı: "Dokun ve başla"
        else if (!basladi && await page.locator('canvas').count()) await page.mouse.click(195, 600).catch(() => undefined);
        await sleep(300);
      }
      if (!basladi) { await shot(page, 'cevrimdisi-bolum1-HATA'); throw new Error('çevrimdışı 1. bölüm başlamadı (60 sn)'); }
      await sleep(1500); await shot(page, 'cevrimdisi-bolum1');
      const sesCevrimdisi = await page.evaluate((ses) => fetch(`/voice/${ses}`).then((r) => r.ok && r.arrayBuffer()).then((b) => (b ? b.byteLength : 0)).catch(() => 0), sesDosya);
      beklenen(sesCevrimdisi > 0, 'çalınmış ses kaydı bağlantısızken gelmedi');
      const canvas = await page.evaluate(() => { const c = document.querySelector('canvas'); return c ? [c.width, c.height] : null; });
      beklenen(canvas && canvas[0] > 0, 'bölüm tuvali yok');
      // aynı bağlantısız durumda bölüm baştan sona oynanır (bot)
      await page.goto(`${base}/?bot=1&level=1&ts=2`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__odi?.done, null, { timeout: 240_000 });
      const r = await page.evaluate(() => window.__odi.result);
      await shot(page, 'cevrimdisi-bolum1-son');
      beklenen(r?.completed, `1. bölüm tamamlanmadı: ${JSON.stringify(r)?.slice(0, 200)}`);
      const SES = /^\/voice\/[^/]+\.mp3$/;
      const kabukDusen = dusen.filter((p) => !SES.test(p));
      beklenen(!kabukDusen.length, `bağlantısızken kabuk isteği düştü: ${[...new Set(kabukDusen)].join(', ')}`);
      // WebKit, bağlantısızken düşen (uygulamanın yakaladığı) ses isteklerini sayfa hatası olarak da bildirir: yalnız bunlar ve
      // yalnız düşen ses isteği varken kabul edilir
      const NET = /^(TypeError: Load failed|Response served by service worker is an error)/;
      const gercek = hatalar.filter((h) => !(bn === 'webkit' && dusen.length && NET.test(h)));
      beklenen(!gercek.length, `sayfa hatası: ${gercek.join(' | ')}`);
      return `${n} dosya önbellekte; çevrimdışı 1. bölüm ⭐${r.stars}, ${r.timeSec} sn; önbellekte olmayan ${new Set(dusen).size} ses kaydı çalınamadı (beklenen)`;
    } finally { await ctx.close(); }
  });

  // (c) güncelleme: oyun ortasında yenileme yok, yeniden açılışta yeni sürüm
  await adim(bn, '(c) yeni sürüm yeniden açılışta', async () => {
    await yayinla(V1, true);
    const ctx = await yeniBaglam(browser); let page = await ctx.newPage(); const hatalar = []; hataDinle(page, hatalar);
    try {
      await page.goto(`${base}/`); await page.waitForSelector('.title-screen', { timeout: 30_000 });
      await kabukHazir(page, S1);
      beklenen(await sayfaGiris(page) === G1, 'ilk açılış v1 değil');
      await page.evaluate(() => { window.__eskiSayfa = true; });
      await yayinla(V2, false);
      // tarayıcı güncellemeyi denetler (gerçekte açılışta / arada); yeni sürüm kurulur ve bekler
      await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); await reg.update(); });
      await bekle(page, async (s2) => { const reg = await navigator.serviceWorker.getRegistration(); return !!reg?.waiting && reg.waiting.state === 'installed' && (await caches.keys()).includes(`odi-kabuk-${s2}`); }, S2, 60_000, 'v2 kuruldu ve bekliyor');
      await sleep(1000);
      const durum = await page.evaluate(async (s1) => ({ eski: window.__eskiSayfa === true, keys: await caches.keys(), title: !!document.querySelector('.title-screen'), s1Var: (await caches.keys()).includes(`odi-kabuk-${s1}`) }), S1);
      beklenen(durum.eski && durum.title, 'açık sayfa yenilendi (oyun ortasında yenileme olmamalı)');
      beklenen(durum.s1Var, `bekleyen sürüm varken eski önbellek silindi: ${durum.keys}`);
      beklenen(await sayfaGiris(page) === G1, 'açık sayfa v1 değil');
      // uygulama kapanır, yeniden açılır
      await page.close();
      page = await ctx.newPage(); hataDinle(page, hatalar);
      await page.goto(`${base}/`); await page.waitForSelector('.title-screen', { timeout: 30_000 });
      const g = await sayfaGiris(page);
      beklenen(g === G2, `yeniden açılış eski sürümde kaldı: ${g} (v2 ${G2})`);
      await kabukHazir(page, S2);
      await bekle(page, async (s1) => !(await caches.keys()).includes(`odi-kabuk-${s1}`), S1, 30_000, 'eski önbellek silindi');
      // güncellemeden sonra çevrimdışı açılış: v2'nin index'i (eski sürüme dönmez)
      await ctx.setOffline(true);
      await page.reload(); await page.waitForSelector('.title-screen', { timeout: 30_000 });
      const g2 = await sayfaGiris(page);
      beklenen(g2 === G2, `çevrimdışı açılış eski sürüm: ${g2}`);
      beklenen(!hatalar.length, `sayfa hatası: ${hatalar.join(' | ')}`);
      return `v1 açıkken v2 bekledi, yeniden açılışta v2; önbellek ${JSON.stringify(await page.evaluate(() => caches.keys()))}`;
    } finally { await ctx.close(); await yayinla(V1, true); }
  });

  await browser.close();
}
cleanup();

const kalan = sonuc.filter((s) => !s.ok);
console.log(`\n${sonuc.length} adım · ${sonuc.length - kalan.length} geçti · ${kalan.length} kaldı`);
writeFileSync(resolve(out, 'sonuc.json'), JSON.stringify(sonuc, null, 2));
process.exit(kalan.length ? 1 : 0);
