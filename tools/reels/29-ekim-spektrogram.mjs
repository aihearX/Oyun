/**
 * 29 Ekim Reels: "Bir sesin içinde ne saklıdır?" — sesten doğan bayrak (spektrogram sanatı). Görüntü: tools/reels/29-ekim-spektrogram.html
 * (tek tuval, kare kare deterministik). Ses ve spektrogram verisi: tools/reels/29-ekim-spektrogram.py (önce o çalışır: zaman.json + spek.png).
 * Bayrak: resmî oranlı SVG (BAYRAK aşağıda, birebir; geometri/renk değişmez, üstüne hiçbir şey konmaz).
 *
 * Kullanım (kökten):
 *   python3 tools/reels/29-ekim-spektrogram.py              → zaman.json, spek.png, ses.wav
 *   node tools/reels/29-ekim-spektrogram.mjs --at 12.8       → tek kare PNG (tools/harness/out/29-ekim-spektrogram/kare-12.8.png)
 *   node tools/reels/29-ekim-spektrogram.mjs --sheet         → 0,5 sn'de bir kare + temas sayfası (sheet.png)
 *   node tools/reels/29-ekim-spektrogram.mjs --video         → video.mp4 (sessiz) + kapak.png
 *   python3 tools/reels/29-ekim-spektrogram.py --mux        → marketing/reels/29-ekim-spektrogram.mp4 (+ kapak)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
const OUT = path.join(ROOT, 'tools/harness/out/29-ekim-spektrogram');
const a = process.argv.slice(2);
const arg = (k) => (a.includes(k) ? a[a.indexOf(k) + 1] : null);
const FPS = 30;

/** Türk bayrağı, resmî oranlar (G = 1000: ay dış dairesi 0,5G, iç daire 0,5625G, yıldız merkezi 0,8208G, bir ucu gönderden yana). DEĞİŞTİRME. */
export const BAYRAK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1000"><rect width="1500" height="1000" fill="#E30A17"/>
<circle cx="500" cy="500" r="250" fill="#fff"/><circle cx="562.5" cy="500" r="200" fill="#E30A17"/>
<polygon fill="#fff" points="695.80,500.00 782.17,471.94 782.17,381.12 835.55,454.59 921.93,426.53 868.55,500.00 921.93,573.47 835.55,545.41 782.17,618.88 782.17,528.06"/></svg>`;
const ODI = fs.readFileSync(path.join(ROOT, 'marketing/ikon/kavram-a-odi.svg'), 'utf8').replace(/<rect width="1024" height="1024"[^>]*\/>/g, '');
const T = JSON.parse(fs.readFileSync(path.join(OUT, 'zaman.json'), 'utf8'));
const SPEK = 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, 'spek.png')).toString('base64');

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto('file://' + path.join(ROOT, 'tools/reels/29-ekim-spektrogram.html'));
await page.evaluate((o) => window.init(o), { T, flag: BAYRAK, odi: ODI, spek: SPEK });
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
