/**
 * 29 Ekim Reels: "Bu odyogramda bir şey var…" — saf ses odyometrisi oynar; sağ kulak (kırmızı O) ve sol kulak (mavi X) yanıtları
 * işitme alanını 20 Hz – 20 kHz'e açınca ay ve yıldıza dizilir, sonra resmî bayrağa erir. Tamamen çizim (gerçek kişi, fotoğraf yok).
 * Görüntü: tools/reels/29-ekim-odyogram.html (tek tuval, kare kare deterministik). Ses: tools/reels/29-ekim-odyogram_ses.py (özgün).
 * Nokta konumları resmî bayrak geometrisinden (BAYRAK aşağıda, 1500×1000 birim) örneklenir; 103 nokta = 103 yanıt = 103. yıl.
 * Eksen eşlemesi (tam alan): u = 1500·log10(f/20)/3 (20 Hz…20 kHz → 0…1500), v = (dB HL + 10)/130·1000 (−10…120 dB HL → 0…1000).
 *
 * Kullanım (kökten):
 *   node tools/reels/29-ekim-odyogram.mjs --at 12.8      → tek kare PNG (tools/harness/out/29-ekim-odyogram/kare-12.8.png)
 *   node tools/reels/29-ekim-odyogram.mjs --sheet        → 0,5 sn'de bir kare + temas sayfası (sheet.png)
 *   node tools/reels/29-ekim-odyogram.mjs --video        → video.mp4 (sessiz) + kapak.png + zaman.json
 *   python3 tools/reels/29-ekim-odyogram_ses.py          → ses + birleştirme → marketing/reels/29-ekim-odyogram.mp4
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
const OUT = path.join(ROOT, 'tools/harness/out/29-ekim-odyogram');
fs.mkdirSync(OUT, { recursive: true });
const a = process.argv.slice(2);
const arg = (k) => (a.includes(k) ? a[a.indexOf(k) + 1] : null);
const FPS = 30;

/** Türk bayrağı, resmî oranlar (G = 1000: ay dış dairesi merkezi 0,5G, yarıçap 0,25G; iç daire merkezi 0,5625G, yarıçap 0,2G;
 *  yıldız merkezi 0,8208G, çevrel yarıçap 0,125G, bir ucu gönderden yana). Ortak bayrak dosyasıyla birebir. DEĞİŞTİRME. */
export const BAYRAK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1000"><rect width="1500" height="1000" fill="#E30A17"/>
<circle cx="500" cy="500" r="250" fill="#fff"/><circle cx="562.5" cy="500" r="200" fill="#E30A17"/>
<polygon fill="#fff" points="695.80,500.00 782.17,471.94 782.17,381.12 835.55,454.59 921.93,426.53 868.55,500.00 921.93,573.47 835.55,545.41 782.17,618.88 782.17,528.06"/></svg>`;
const STAR = [[695.80, 500], [782.17, 471.94], [782.17, 381.12], [835.55, 454.59], [921.93, 426.53], [868.55, 500], [921.93, 573.47], [835.55, 545.41], [782.17, 618.88], [782.17, 528.06]];
const SC = [820.8, 500];
const ODI = fs.readFileSync(path.join(ROOT, 'marketing/ikon/kavram-a-odi.svg'), 'utf8').replace(/<rect width="1024" height="1024"[^>]*\/>/g, '');

/* ------------------------------------------------------------------ bayraktan örnekleme (103 nokta) */
const uOf = (f) => (1500 * Math.log10(f / 20)) / 3;
const vOf = (db) => ((db + 10) / 130) * 1000;
const inCres = (x, y, m = 0) => Math.hypot(x - 500, y - 500) <= 250 - m && Math.hypot(x - 562.5, y - 500) >= 200 + m;
function inPoly(x, y, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function segDist(px, py, [x1, y1], [x2, y2]) {
  const dx = x2 - x1, dy = y2 - y1, k = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - x1 - k * dx, py - y1 - k * dy);
}
const inStar = (x, y, m = 0) => inPoly(x, y, STAR) && STAR.every((p, i) => segDist(x, y, p, STAR[(i + 1) % 10]) >= m);
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ilk üç yavaş yanıt: klinikte gerçekten test edilen frekanslar ve 5 dB adımları, tam olarak şeklin üstünde
const FIXED = [
  { f: 125, db: 75, ear: 'R' }, // sağ kulak → hilalin alt yayı (standart grafiğin sol kenarı: şekil grafiğin dışına taşıyor)
  { f: 250, db: 25, ear: 'R' }, //  → hilalin üst yayı
  { f: 750, db: 45, ear: 'L' }, // sol kulak → yıldızın üst kolunun kenarı
].map((p) => ({ ...p, u: uOf(p.f), v: vOf(p.db), fixed: true }));

function sample(shape, d, extraFirst) {
  const C = [...extraFirst];
  if (shape === 'R') {
    const ins = 15;
    // boynuz uçları: içe kaydırılmış iki dairenin kesişimi
    const R1 = 250 - ins, R2 = 200 + ins, dx = 62.5, xx = (R1 * R1 - R2 * R2 + dx * dx) / (2 * dx), yy = Math.sqrt(R1 * R1 - xx * xx);
    const arc = [];
    for (let k = 0; k < 2000; k++) { const th = (k / 2000) * Math.PI * 2; const x = 500 + R1 * Math.cos(th), y = 500 + R1 * Math.sin(th); if (inCres(x, y, ins - 1)) arc.push([x, y]); }
    for (let k = 0; k < 2000; k++) { const th = (k / 2000) * Math.PI * 2; const x = 562.5 + R2 * Math.cos(th), y = 500 + R2 * Math.sin(th); if (inCres(x, y, ins - 1)) arc.push([x, y]); }
    arc.sort((p, q) => Math.atan2(p[1] - 500, -(p[0] - 500)) - Math.atan2(q[1] - 500, -(q[0] - 500)));
    C.push(...arc);
    // orta çizgi: incelen boynuzlara kadar (içe kaydırılmış yaylar boynuz uçlarına ulaşamaz)
    const med = [];
    for (let k = 0; k < 1200; k++) {
      const ph = -Math.PI + (k / 1200) * 2 * Math.PI, cx = Math.cos(ph), cy = Math.sin(ph);
      // (500,500)'den φ yönünde iç daireden çıkış yarıçapı
      const bq = 2 * (cx * -62.5), cq = 62.5 * 62.5 - 200 * 200, disc = bq * bq - 4 * cq; const rin = (-bq + Math.sqrt(disc)) / 2;
      if (rin >= 247) continue; const rm = (rin + 250) / 2; med.push([500 + rm * cx, 500 + rm * cy, 250 - rin]);
    }
    med.sort((p, q) => p[2] - q[2]); // önce en ince (uçlar)
    C.push(...med.filter((m) => m[2] < 40).map(([x, y]) => [x, y]));
    const r = rnd(7); const G = [];
    for (let x = 250; x < 760; x += 6) for (let y = 250; y < 750; y += 6) if (inCres(x, y, ins + 8)) G.push([x, y, r()]);
    G.sort((p, q) => Math.hypot(q[0] - 562.5, q[1] - 500) - Math.hypot(p[0] - 562.5, p[1] - 500) + (p[2] - q[2]) * 4);
    C.push(...G.map(([x, y]) => [x, y]));
  } else {
    // yalnız dış hat: 5 uç (merkeze 17 birim), 5 iç köşe (merkeze 9 birim), 10 kenar ortası (içe 9 birim) — yıldız X'lerle çizilir
    STAR.forEach(([x, y], i) => { const k = i % 2 ? 4 : 12; const L = Math.hypot(x - SC[0], y - SC[1]); C.push([x - ((x - SC[0]) / L) * k, y - ((y - SC[1]) / L) * k]); });
    for (let i = 0; i < 10; i++) {
      const p = STAR[i], q = STAR[(i + 1) % 10];
      for (const s of [0.5]) { const x = p[0] + (q[0] - p[0]) * s, y = p[1] + (q[1] - p[1]) * s; const L = Math.hypot(x - SC[0], y - SC[1]); const xx = x - ((x - SC[0]) / L) * 6, yy = y - ((y - SC[1]) / L) * 6; if (inStar(xx, yy, 2)) C.push([xx, yy]); }
    }
  }
  const A = [];
  for (const c of C) if (A.every((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) >= d)) A.push(c);
  return A;
}
function sampleN(shape, n, fixed) {
  let best = null;
  for (let d = 90; d > 20; d -= 0.05) { const A = sample(shape, d, fixed); if (A.length === n) return { A, d }; if (A.length > n && !best) best = { A: A.slice(0, n), d }; }
  return best;
}
const NR = 83, NL = 20;
const cres = sampleN('R', NR, FIXED.filter((p) => p.ear === 'R').map((p) => [p.u, p.v]));
const star = sampleN('L', NL, FIXED.filter((p) => p.ear === 'L').map((p) => [p.u, p.v]));
console.log(`örnekleme: hilal ${cres.A.length} (d=${cres.d.toFixed(2)}), yıldız ${star.A.length} (d=${star.d.toFixed(2)})`);

/* ------------------------------------------------------------------ zaman çizelgesi (ses de bunu okur) */
const BPM = 72, BEAT = 60 / BPM;
const T = {
  dur: 33.6, bpm: BPM,
  zoom: [9.6, 10.6], align: [15.25, 15.85], last: { on: 15.95, r: 16.45 }, trace: [16.5, 17.2],
  flood: 17.25, melt: [17.7, 18.75], flagDone: 19.0, glide: [19.8, 20.8],
  report: { a: 20.5, lines: [21.2, 22.1, 23.1, 24.5], stamp: 25.5, b: 27.0 },
  kutlu: { a: 27.2, b: 30.2 }, end: 30.2,
  cap: [
    { a: 0.35, b: 4.75, lines: ['Bugün odyometride', { segs: [['ilginç bir hasta', '#ffd98a'], [' var…', '#f6f3ee']] }] },
    { a: 6.5, b: 9.55, lines: ['Bir dakika…', { segs: [['bu odyogramda ', '#f6f3ee'], ['bir şey var.', '#ffd98a']] }] },
    { a: 9.75, b: 12.9, lines: ['Tüm işitme alanını açalım:', { segs: [['20 Hz – 20 kHz', '#ffd98a']] }] },
    { a: 13.1, b: 17.15, lines: [{ segs: [['Sağ kulak: ', '#f6f3ee'], ['ay.', '#ff8a8a']] }, { segs: [['Sol kulak: ', '#f6f3ee'], ['yıldız.', '#8fb6ff']] }] },
  ],
  notes: {},
};
// --- yanıt sırası ve zamanları
const r = rnd(1923);
const toPt = ([u, v], ear) => ({ u, v, ear });
const R = cres.A.map((p) => toPt(p, 'R')), L = star.A.map((p) => toPt(p, 'L'));
const key = (p) => `${p.u.toFixed(2)},${p.v.toFixed(2)}`;
const fixedKeys = new Set(FIXED.map((p) => key(p)));
const lastTip = L.reduce((b, p) => (p.u < b.u ? p : b)); // gönderi gösteren uç: son (103.) yanıt
const tip4k = key(L.reduce((b, p) => (p.u + p.v > b.u + b.v ? p : b)));
const pool = [...R, ...L].filter((p) => !fixedKeys.has(key(p)) && p !== lastTip && key(p) !== tip4k);
const shuffle = (A) => { for (let i = A.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [A[i], A[j]] = [A[j], A[i]]; } return A; };
shuffle(pool);
const STD_U0 = uOf(125) + 14;
const inStd = pool.filter((p) => p.u > STD_U0);
const accL = inStd.filter((p) => p.ear === 'L').slice(0, 8), accR = inStd.filter((p) => p.ear === 'R').slice(0, 8);
const acc = shuffle([...accL, ...accR]);
const rest = shuffle(pool.filter((p) => !acc.includes(p)));
const P = [];
const slow = [{ on: 1.2, r: 1.95, n: 3 }, { on: 2.45, r: 3.15, n: 3 }, { on: 3.55, r: 4.08, n: 2 }, { on: 4.35, r: 4.85, n: 2 }];
// dördüncü yavaş yanıt: yıldızın sağ alt ucu (frekansı standart dışı: tuhaflık burada başlar). Yavaş tonlar gerçek frekansında çalar.
const tip4 = L.reduce((b, p) => (p.u + p.v > b.u + b.v ? p : b));
[...FIXED, { ...tip4, fixed: true }].forEach((p, i) => P.push({ ...p, on: slow[i].on, t: slow[i].r, pulses: slow[i].n, note: null, phase: 'slow' }));
const ACC_NOTES = [72, 76, 79, 84, 69, 72, 76, 81, 77, 81, 84, 89, 79, 83, 86, 91];
let tt = 5.1;
acc.forEach((p, i) => { const gap = 0.5 * Math.pow(0.915, i); P.push({ ...p, on: tt, t: tt + 0.16, pulses: 1, note: ACC_NOTES[i], phase: 'acc' }); tt += gap; });
// hızlı ateş: üç dalga, her biri giderek yoğunlaşır
const bursts = [{ a: 10.8, b: 12.0, n: 18, notes: [72, 76, 79, 84, 88, 91, 96] }, { a: 12.2, b: 13.55, n: 26, notes: [69, 72, 77, 81, 84, 89, 93] }, { a: 13.7, b: 15.2, n: 38, notes: [67, 71, 74, 77, 79, 83, 86, 89, 91, 95] }];
let k = 0;
for (const B of bursts) {
  for (let i = 0; i < B.n; i++) {
    const x = (i + 0.5) / B.n, t = B.a + (B.b - B.a) * Math.pow(x, 0.62);
    const p = rest[k++]; const nt = B.notes[i % B.notes.length] + (B === bursts[2] ? 0 : 0);
    P.push({ ...p, on: t - 0.07, t, pulses: 0, note: nt, phase: 'burst' });
  }
}
P.push({ ...lastTip, on: T.last.on, t: T.last.r, pulses: 2, note: 72, phase: 'last' });
// küçük ölçüm sapması (test-tekrar test): dizilme anında sıfırlanır
P.forEach((p) => { p.ju = p.fixed || p.phase === 'last' ? 0 : (r() - 0.5) * 26; p.jv = p.fixed || p.phase === 'last' ? 0 : (r() - 0.5) * 26; });
P.forEach((p, i) => { p.i = i; p.f = 20 * Math.pow(1000, (p.u + p.ju) / 1500); p.db = ((p.v + p.jv) / 1000) * 130 - 10; });
console.log('yanıt sayısı:', P.length, '· hızlı ateş:', k, '/', rest.length);
T.points = P;
fs.writeFileSync(path.join(OUT, 'zaman.json'), JSON.stringify(T, null, 1));

/* ------------------------------------------------------------------ çizim */
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('console', (m) => console.log('[sayfa]', m.text()));
page.on('pageerror', (e) => console.log('[hata]', e.message));
await page.goto('file://' + path.join(ROOT, 'tools/reels/29-ekim-odyogram.html'));
await page.evaluate((o) => window.init(o), { T, flag: BAYRAK, odi: ODI, star: STAR });
const frame = async (t, mode, png) => {
  const url = await page.evaluate(([t, m, p]) => { window.draw(t, m); return p ? window.snapPng() : window.snap(0.94); }, [t, mode, png]);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
};

if (arg('--at')) {
  for (const s of arg('--at').split(',')) { const f = path.join(OUT, `kare-${s}.png`); fs.writeFileSync(f, await frame(+s, null, true)); console.log(f); }
}
if (a.includes('--cover') || a.includes('--video')) {
  fs.writeFileSync(path.join(OUT, 'kapak.png'), await frame(16.4, 'cover', true));
  fs.writeFileSync(path.join(OUT, 'son-kare.png'), await frame(T.dur - 1 / FPS, null, true));
  console.log('kapak + son kare');
}
if (a.includes('--sheet')) {
  const dir = path.join(OUT, 'sheet'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  let i = 0;
  for (let t = 0; t < T.dur; t += 0.5) fs.writeFileSync(path.join(dir, `f${String(i++).padStart(3, '0')}.jpg`), await frame(t, null, false));
  const cols = 9, rows = Math.ceil(i / cols);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', path.join(dir, 'f%03d.jpg'), '-vf', `scale=216:384,tile=${cols}x${rows}:padding=4:color=white`, '-frames:v', '1', path.join(OUT, 'sheet.png')]);
  console.log(path.join(OUT, 'sheet.png'), i, 'kare');
}
if (a.includes('--video')) {
  const out = path.join(OUT, 'video.mp4'); const N = Math.round(T.dur * FPS);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const buf = await frame(i / FPS, null, false);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`kare ${i}/${N} (${((Date.now() - t0) / 1000).toFixed(0)} sn)`);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  console.log('video:', out);
}
await browser.close();
