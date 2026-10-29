// 29 Ekim — «Yankı» Reels'i: önce sesi üretir (29-ekim-onuncu-yil-yankisi.py → ses.wav + zaman.json), sonra sahneyi
// (29-ekim-onuncu-yil-yankisi.html) aynı zaman çizelgesiyle 30 kare/sn çeker ve marketing/reels/29-ekim-onuncu-yil-yankisi.mp4'e birleştirir:
// H.264 High yuv420p + AAC 48 kHz stereo (aac_pns 0), faststart, iki geçişli doğrusal loudnorm (−14 LUFS, ≤ −1 dBTP).
// Kullanım: PLAYWRIGHT_CHROMIUM=... node tools/reels/29-ekim-onuncu-yil-yankisi.mjs [--sadece-ses | --kareler-hazir | --onizle 3,12,27]
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../..');
const SLUG = '29-ekim-onuncu-yil-yankisi';
const work = path.join(root, 'tools/harness/out/reels', SLUG);
const out = path.join(root, 'marketing/reels', SLUG + '.mp4');
const FPS = 30;
const run = (cmd, a) => { const r = spawnSync(cmd, a, { stdio: 'inherit' }); if (r.status !== 0) throw new Error(cmd + ' ' + r.status); };
fs.mkdirSync(work, { recursive: true });
const wav = path.join(work, 'ses.wav'), tlp = path.join(here, SLUG + '.zaman.json');

const oi = process.argv.indexOf('--onizle');
if (oi < 0 || !fs.existsSync(tlp)) run('python3', [path.join(here, SLUG + '.py'), wav, tlp]);
if (process.argv.includes('--sadece-ses')) process.exit(0);
const TL = JSON.parse(fs.readFileSync(tlp, 'utf8'));

async function open() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.addInitScript((tl) => { window.TL = tl; }, TL);
  await page.goto('file://' + path.join(here, SLUG + '.html'));
  await page.evaluate(() => window.ready);
  return { browser, page, errs };
}

if (oi > 0) { // hızlı göz denetimi: yalnız istenen anlar
  const { browser, page, errs } = await open();
  for (const ts of process.argv[oi + 1].split(',')) {
    if (ts === 'kapak') await page.evaluate(() => window.renderCover()); else await page.evaluate((t) => window.render(t), +ts);
    await page.screenshot({ path: path.join(work, `onizle-${ts}.png`) });
  }
  await browser.close(); if (errs.length) console.log('HATA:', errs.join(' | ')); process.exit(0);
}

const fr = path.join(work, 'kare');
// --kareler-hazir: kareler değişmediyse (yalnız ses değişti) yeniden çekmeden birleştirir
if (!process.argv.includes('--kareler-hazir')) {
fs.rmSync(fr, { recursive: true, force: true }); fs.mkdirSync(fr, { recursive: true });
const { browser, page, errs } = await open();
const n = Math.round(TL.END * FPS);
for (let i = 0; i < n; i++) {
  await page.evaluate((t) => window.render(t), i / FPS);
  await page.screenshot({ path: path.join(fr, `f${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 95 });
  if (i % 150 === 0) console.log(`kare ${i}/${n}`);
}
await page.evaluate(() => window.renderCover());
await page.screenshot({ path: path.join(root, 'marketing/reels', SLUG + '-kapak.png') });
await browser.close();
if (errs.length) throw new Error(errs.join(' | '));
}

const ln = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=20:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const m = JSON.parse(ln.slice(ln.lastIndexOf('{'), ln.lastIndexOf('}') + 1));
const lnf = `loudnorm=I=-14:TP=-1.5:LRA=20:linear=true:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}`;
run('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(fr, 'f%04d.jpg'), '-i', wav,
  '-af', lnf + ',aresample=48000', '-ar', '48000', '-ac', '2',
  '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'slow', '-r', String(FPS),
  '-c:a', 'aac', '-aac_pns', '0', '-b:a', '192k', '-t', String(TL.END), '-movflags', '+faststart', out]);
console.log('yazıldı:', out);
