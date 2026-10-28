/**
 * 29 Ekim Reels (3): "Sesini yükselt" — bir odyolog her gün "sesi kıs" der; ama bugün değil. Ses düzeyi ölçerin kendisi bayrağa
 * dönüşür (LED basamakları → bayrağın dalgalanan sıraları, kadran yayı → ay, tepe işareti → yıldız). Tamamen çizim; gerçek kişi yok.
 * Görüntü: tools/reels/29-ekim-sesini-yukselt.html (tek tuval, kare kare deterministik).
 * Ses: tools/reels/29-ekim-sesini-yukselt_ses.py (özgün skor + ses tasarımı; marş/kayıt yok).
 * Bayrak: resmî oranlı SVG (BAYRAK aşağıda, ekim29b.mjs ile birebir; geometri/renk değişmez, üstüne hiçbir şey konmaz).
 *
 * Kullanım (kökten):
 *   node tools/reels/29-ekim-sesini-yukselt.mjs --at 12.8      → tek kare PNG (tools/harness/out/29-ekim-sesini-yukselt/kare-12.8.png)
 *   node tools/reels/29-ekim-sesini-yukselt.mjs --sheet        → 0,5 sn'de bir kare + temas sayfası (sheet.png)
 *   node tools/reels/29-ekim-sesini-yukselt.mjs --video        → video.mp4 (sessiz) + kapak.png + zaman.json
 *   python3 tools/reels/29-ekim-sesini-yukselt_ses.py          → ses + birleştirme → marketing/reels/29-ekim-sesini-yukselt.mp4
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
const OUT = path.join(ROOT, 'tools/harness/out/29-ekim-sesini-yukselt');
fs.mkdirSync(OUT, { recursive: true });
const a = process.argv.slice(2);
const arg = (k) => (a.includes(k) ? a[a.indexOf(k) + 1] : null);
const FPS = 30;

/** Türk bayrağı, resmî oranlar (Türk Bayrağı Kanunu tüzüğü; G = 1000: ay dış dairesi 0,5G, iç daire 0,5625G, yıldız merkezi 0,8208G,
 *  yıldız düzgün beş köşeli, bir ucu gönderden yana). Önceki 29 Ekim Reels'leriyle aynı çizim. DEĞİŞTİRME. */
export const BAYRAK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1000"><rect width="1500" height="1000" fill="#E30A17"/>
<circle cx="500" cy="500" r="250" fill="#fff"/><circle cx="562.5" cy="500" r="200" fill="#E30A17"/>
<polygon fill="#fff" points="695.80,500.00 782.17,471.94 782.17,381.12 835.55,454.59 921.93,426.53 868.55,500.00 921.93,573.47 835.55,545.41 782.17,618.88 782.17,528.06"/></svg>`;
const ODI = fs.readFileSync(path.join(ROOT, 'marketing/ikon/kavram-a-odi.svg'), 'utf8').replace(/<rect width="1024" height="1024"[^>]*\/>/g, '');

/* ------------------------------------------------------------------ zaman çizelgesi (ses de bunu okur) */
const HL = '#ffcf5a', Wt = '#fff';
export const T = {
  dur: 29.6, bpm: 120,
  // ibre (dB SPL): [zaman, değer, yumuşatma] — b: yaylı aşma, io: yumuşak, l: doğrusal, boş: hızlı yavaşlama
  needle: [[0, 50], [0.6, 54, 'io'], [0.95, 96, 'b'], [1.6, 95, 'l'], [2.05, 62, 'b'], [2.8, 63, 'l'], [3.05, 104, 'b'], [3.6, 103, 'l'], [4.1, 79, 'b'],
    [4.8, 77, 'l'], [5.1, 70, 'io'], [6.2, 84.6, 'io'], [6.55, 84.9, 'l'], [6.85, 83.4, 'b'], [7.2, 83, 'l'], [7.32, 70, 'b'], [7.6, 70, 'l'], [7.72, 58, 'b'],
    [8.0, 58, 'l'], [8.12, 40, 'b'], [10.4, 40, 'l'], [11.4, 60, 'b'], [12.9, 80, 'b'], [14.4, 100, 'b'], [15.4, 100, 'l']],
  cards: [
    { a: 0.8, b: 2.8, lines: [{ segs: [['Kulaklığın', Wt]], size: 116 }, { segs: [['sesini ', Wt], ['kıs.', HL, 1]], size: 116 }], down: 1.6 },
    { a: 2.8, b: 4.8, lines: [{ segs: [['Konserde', Wt]], size: 104 }, { segs: [['kulak tıkacı', Wt]], size: 104 }, { segs: [['tak.', HL, 1]], size: 104 }], down: 3.6 },
    { a: 4.8, b: 7.2, lines: [{ segs: [['85 dB’yi', Wt]], size: 132 }, { segs: [['geçme.', HL, 1]], size: 132 }], y: 1290, down: 6.2,
      note: ['NIOSH (1998): 8 saatlik maruziyette', 'önerilen sınır 85 dBA.'] },
  ],
  kis: [1.6, 3.6, 6.2, 7.2, 7.6, 8.0],   // "kıs" sayacı: 23 → 29
  rapid: [{ a: 7.2, b: 7.6, t: 'Kıs.', size: 170 }, { a: 7.6, b: 8.0, t: 'Biraz daha.', size: 128 }, { a: 8.0, b: 8.4, t: 'KIS DEDİM.', size: 124 }],
  scratch: 8.4, ama: { a: 8.75, dots: [9.15, 9.45, 9.75] }, flip: 9.95,
  C0: 10.4,
  steps: [{ t: 11.4, db: 60, w: 'gurur' }, { t: 12.9, db: 80, w: 'coşku' }, { t: 14.4, db: 100, w: '29 Ekim!' }],
  M0: 15.4, F: 19.4, txt: [19.7, 21.3, 22.7], E: 25.4, cover: 15.0,
};
fs.writeFileSync(path.join(OUT, 'zaman.json'), JSON.stringify(T, null, 1));

/* ------------------------------------------------------------------ çizim */
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + path.join(ROOT, 'tools/reels/29-ekim-sesini-yukselt.html'));
await page.evaluate((o) => window.init(o), { T, flag: BAYRAK, odi: ODI });
const frame = async (t, mode, png) => {
  const url = await page.evaluate(([t, m, p]) => { window.draw(t, m); return p ? window.snapPng() : window.snap(0.94); }, [t, mode, png]);
  if (errs.length) throw new Error(errs.join(' | '));
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
};

if (arg('--at')) {
  for (const s of arg('--at').split(',')) { const f = path.join(OUT, `kare-${s}.png`); fs.writeFileSync(f, await frame(+s, null, true)); console.log(f); }
}
if (a.includes('--cover') || a.includes('--video')) {
  fs.writeFileSync(path.join(OUT, 'kapak.png'), await frame(0, 'cover', true));
  fs.writeFileSync(path.join(OUT, 'son-kare.png'), await frame(T.dur - 1 / FPS, null, true));
  console.log('kapak + son kare');
}
if (a.includes('--sheet')) {
  const dir = path.join(OUT, 'sheet'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  let i = 0; const step = +(arg('--step') ?? 0.5);
  for (let t = 0; t < T.dur; t += step) fs.writeFileSync(path.join(dir, `f${String(i++).padStart(3, '0')}.jpg`), await frame(t, null, false));
  const cols = 10, rows = Math.ceil(i / cols);
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
