/**
 * 29 Ekim Reels (2): "Bir odyoloğun kulağından" — sessizlikten sese, karanlıktan bayrağa. Tamamen çizim (gerçek kişi, fotoğraf, Atatürk
 * görseli yok). Görüntü: tools/reels/ekim29b.html (tek tuval, kare kare deterministik). Ses: tools/reels/ekim29b_ses.py (özgün skor + ses
 * tasarımı; marş/kayıt yok). Bayrak: resmî oranlı SVG (BAYRAK aşağıda, birebir; geometri/renk değişmez, üstüne hiçbir şey konmaz).
 *
 * Kullanım (kökten):
 *   node tools/reels/ekim29b.mjs --at 12.8               → tek kare PNG (tools/harness/out/ekim29b/kare-12.8.png)
 *   node tools/reels/ekim29b.mjs --sheet                 → 0,5 sn'de bir kare + temas sayfası (sheet.png)
 *   node tools/reels/ekim29b.mjs --video                 → video.mp4 (sessiz) + kapak.png + zaman.json
 *   python3 tools/reels/ekim29b_ses.py                   → ses + birleştirme → marketing/reels/29-ekim-odyolog.mp4
 * Ağır iş, başka üretim sürüyorsa: nice -n 10 node ...
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
const OUT = path.join(ROOT, 'tools/harness/out/ekim29b');
fs.mkdirSync(OUT, { recursive: true });
const a = process.argv.slice(2);
const arg = (k) => (a.includes(k) ? a[a.indexOf(k) + 1] : null);
const FPS = 30;

/** Türk bayrağı, resmî oranlar (Türk Bayrağı Kanunu tüzüğü; G = 1000: ay dış dairesi 0,5G, iç daire 0,5625G, yıldız merkezi 0,8208G,
 *  yıldız düzgün beş köşeli, bir ucu gönderden yana). 29 Ekim (1) Reels'iyle aynı düzeltilmiş çizim. DEĞİŞTİRME. */
export const BAYRAK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1000"><rect width="1500" height="1000" fill="#E30A17"/>
<circle cx="500" cy="500" r="250" fill="#fff"/><circle cx="562.5" cy="500" r="200" fill="#E30A17"/>
<polygon fill="#fff" points="695.80,500.00 782.17,471.94 782.17,381.12 835.55,454.59 921.93,426.53 868.55,500.00 921.93,573.47 835.55,545.41 782.17,618.88 782.17,528.06"/></svg>`;
/** Odi: marka simgesi, zemin dikdörtgenleri çıkarılmış */
const ODI = fs.readFileSync(path.join(ROOT, 'marketing/ikon/kavram-a-odi.svg'), 'utf8').replace(/<rect width="1024" height="1024"[^>]*\/>/g, '');

/* ------------------------------------------------------------------ zaman çizelgesi (ses de bunu okur) */
const BPM = 65, BEAT = 60 / BPM, BAR = 4 * BEAT;
const FLAG = 18.6;
const bar = (k) => +(FLAG + k * BAR).toFixed(3);
const G = '#ffd98a', GR = '#ffe3a3', Wh = '#f6f3ee';
export const T = {
  dur: 38.6, bpm: BPM, flag: FLAG, cut: 18.2, click: 12.75, mother: 7.25, end: bar(4), period: 2 * BEAT,
  heart: [3.95, 4.95, 5.95, 6.95, 7.95, 8.95, 9.95],
  packets: [{ t0: 8.0, dur: 1.15, x0: 255, x1: 825, amp: 44 }, { t0: 9.35, dur: 1.15, x0: 255, x1: 825, amp: 32 }],
  pre: [
    { a: 0.6, b: 3.6, y: 690, size: 84, lines: ['Bir odyolog', { segs: [['sessizliği', G], [' iyi bilir.', Wh]] }] },
    { a: 3.9, b: 7.1, y: 690, size: 80, lines: ['Ve hayatını,', 'o sessizliği bozan', { segs: [['ilk sese', G], [' adar.', Wh]] }] },
    { a: 7.35, b: 10.9, y: 690, size: 80, lines: ['Bir bebeğin,', { segs: [['annesinin sesine', G]] }, 'ilk kez döndüğü an…'] },
    { a: 11.1, b: 14.6, y: 690, size: 78, lines: ['…bir koklear implantın', { segs: [['ilk açıldığı ', Wh], ['o saniye.', G]] }] },
    { a: 14.9, b: 18.1, y: 690, size: 100, weight: 800, lines: ['Bazı sesler vardır,', { segs: [['hiç susmaz.', G]] }], fi: 0.9 },
  ],
  post: [
    { a: 18.75, b: bar(1) - 0.15, y: 1130, lh: 1.05, weight: 900, lines: [{ t: '29 Ekim', size: 200 }, { t: '1923', size: 120, weight: 800, color: GR, ls: 26 }], fi: 0.5 },
    { a: bar(1) + 0.1, b: bar(2) - 0.15, y: 1130, size: 104, weight: 900, lh: 1.1, lines: ['Bir milletin,', { segs: [['kendi sesini', GR]] }, 'duyduğu gün.'] },
    { a: bar(2) + 0.1, b: bar(3) - 0.15, y: 1120, size: 84, weight: 800, lh: 1.45, lines: [{ segs: [['103 yıldır ', Wh], ['kulağımızda.', GR]] }, { segs: [['103 yıldır ', Wh], ['kalbimizde.', GR]], at: 1.2 }] },
    { a: bar(3) + 0.1, b: bar(4) - 0.12, y: 1130, weight: 900, lh: 1.12, lines: [{ t: 'Cumhuriyetimizin', size: 80 }, { t: '103. yılı', size: 150, color: GR }, { t: 'kutlu olsun!', size: 80 }] },
    { a: bar(3) + 1.3, b: bar(4) - 0.12, y: 1420, size: 31, weight: 700, ls: 4, color: GR, shadowBlur: 12, lines: ['EGEMENLİK KAYITSIZ ŞARTSIZ MİLLETİNDİR'] },
  ],
};
T.b4 = { a: T.pre[3].a }; T.b5 = { a: T.pre[4].a };
fs.writeFileSync(path.join(OUT, 'zaman.json'), JSON.stringify(T, null, 1));

/* ------------------------------------------------------------------ çizim */
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto('file://' + path.join(ROOT, 'tools/reels/ekim29b.html'));
await page.evaluate((o) => window.init(o), { T, flag: BAYRAK, odi: ODI });
const frame = async (t, mode, png) => {
  const url = await page.evaluate(([t, m, p]) => { window.draw(t, m); return p ? window.snapPng() : window.snap(0.94); }, [t, mode, png]);
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
  let i = 0;
  for (let t = 0; t < T.dur; t += 0.5) fs.writeFileSync(path.join(dir, `f${String(i++).padStart(3, '0')}.jpg`), await frame(t, null, false));
  const cols = 8, rows = Math.ceil(i / cols);
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
