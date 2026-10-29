// «Cumhuriyet herkese bir ses verdi» (29 Ekim, 103. yıl) Reels'i: önce 29-ekim-herkese-bir-ses_ses.py ile anlatıcı + özgün müzik
// karışımını ve zaman çizelgesini (zaman.json) üretir, sonra 29-ekim-herkese-bir-ses.html sahnesini 30 kare/sn kare kare çeker ve
// H.264 High yuv420p + AAC 48 kHz stereo (aac_pns kapalı), faststart olarak marketing/reels/29-ekim-herkese-bir-ses.mp4'e birleştirir
// (iki geçişli doğrusal loudnorm: −14 LUFS, ≤ −1 dBTP). Kapak: marketing/reels/29-ekim-herkese-bir-ses-kapak.png.
// Kullanım: PLAYWRIGHT_CHROMIUM=... node tools/reels/29-ekim-herkese-bir-ses.mjs [--sadece-ses | --onizle 3,12.5,27]
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../..');
const SLUG = '29-ekim-herkese-bir-ses';
const work = path.join(root, 'tools/harness/out/reels', SLUG);
const out = path.join(root, 'marketing/reels', SLUG + '.mp4');
const FPS = 30;
const run = (cmd, a) => { const r = spawnSync(cmd, a, { stdio: 'inherit' }); if (r.status !== 0) throw new Error(cmd + ' ' + r.status); };
fs.mkdirSync(work, { recursive: true });

const wav = path.join(work, 'karisim.wav'); const zj = path.join(work, 'zaman.json');
if (!fs.existsSync(zj) || !process.argv.includes('--ses-hazir')) run('python3', [path.join(here, SLUG + '_ses.py'), wav, zj]);
const TL = JSON.parse(fs.readFileSync(zj, 'utf8'));
const DUR = TL.total;

async function open() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.join(here, SLUG + '.html'));
  await page.evaluate((tl) => { window.TL = tl; }, TL);
  await page.evaluate(() => window.ready());
  await page.waitForTimeout(200);
  return { browser, page, errs };
}

const oi = process.argv.indexOf('--onizle');
if (oi > 0) {
  const { browser, page, errs } = await open();
  for (const ts of process.argv[oi + 1].split(',')) { await page.evaluate((t) => window.render(t), +ts); await page.screenshot({ path: path.join(work, `onizle-${ts}.png`) }); }
  await browser.close(); if (errs.length) console.error(errs.join(' | ')); process.exit(0);
}
const fr = path.join(work, 'kare');
if (!process.argv.includes('--sadece-ses')) {
  fs.rmSync(fr, { recursive: true, force: true }); fs.mkdirSync(fr, { recursive: true });
  const { browser, page, errs } = await open();
  const n = Math.round(DUR * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.render(t), i / FPS);
    await page.screenshot({ path: path.join(fr, `f${String(i).padStart(4, '0')}.png`) });
    if (i % 90 === 0) console.log(`kare ${i}/${n}`);
  }
  // kapak: kara tahta fotoğrafı açık + kısa başlık
  await page.evaluate((t) => window.render(t, { kapak: true }), TL.S.U2 + 3.0);
  await page.screenshot({ path: path.join(root, 'marketing/reels', SLUG + '-kapak.png') });
  await browser.close();
  if (errs.length) throw new Error(errs.join(' | '));
}
const ln = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=20:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const m = JSON.parse(ln.slice(ln.lastIndexOf('{'), ln.lastIndexOf('}') + 1));
const lnf = `loudnorm=I=-14:TP=-1.5:LRA=20:linear=true:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}`;
run('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(fr, 'f%04d.png'), '-i', wav,
  '-af', lnf + ',aresample=48000', '-ar', '48000', '-ac', '2',
  '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '20', '-maxrate', '9000k', '-bufsize', '18000k', '-preset', 'slow', '-r', String(FPS),
  '-c:a', 'aac', '-aac_pns', '0', '-b:a', '192k', '-t', String(DUR), '-movflags', '+faststart', out]);
console.log('yazıldı:', out, DUR, 'sn');
