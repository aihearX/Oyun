// 29 Ekim — «Ben bir sesim»: Sesin Yolculuğu Reels'i. 29-ekim-sesin-yolculugu.py ile zaman çizelgesi + anlatı izini üretir, sahneyi
// (29-ekim-sesin-yolculugu.html) 30 kare/sn kare kare çeker, özgün müzik + anlatı karışımını ekler ve H.264 High yuv420p + AAC 48 kHz stereo,
// faststart olarak marketing/reels/29-ekim-sesin-yolculugu.mp4'e yazar (−14 LUFS, ≤ −1 dBTP, AAC PNS kapalı).
// Kullanım: PLAYWRIGHT_CHROMIUM=... node tools/reels/29-ekim-sesin-yolculugu.mjs [--sadece-ses | --onizle 3,12,27 | --kapak]
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../..');
const SLUG = '29-ekim-sesin-yolculugu';
const work = path.join(root, 'tools/harness/out/reels', SLUG);
const out = path.join(root, `marketing/reels/${SLUG}.mp4`);
const FPS = 30;
const run = (cmd, a) => { const r = spawnSync(cmd, a, { stdio: 'inherit' }); if (r.status !== 0) throw new Error(cmd + ' ' + r.status); };
const py = path.join(here, `${SLUG}.py`);

fs.mkdirSync(work, { recursive: true });
run('python3', [py, 'zaman']);
const TL = JSON.parse(fs.readFileSync(path.join(work, 'zaman.js'), 'utf8').replace(/^window\.TL = /, '').replace(/;\s*$/, ''));
const DUR = TL.S.dur;
async function open() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.join(here, `${SLUG}.html`));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
  await page.waitForTimeout(400);
  return { browser, page, errs };
}
const oi = process.argv.indexOf('--onizle');
if (oi > 0) {
  const { browser, page, errs } = await open();
  for (const ts of process.argv[oi + 1].split(',')) { await page.evaluate((t) => window.render(t), +ts); await page.screenshot({ path: path.join(work, `onizle-${ts}.png`) }); }
  await browser.close(); if (errs.length) console.error(errs.join('\n')); process.exit(0);
}
if (!process.argv.includes('--sadece-ses')) {
  const fr = path.join(work, 'kare');
  const { browser, page, errs } = await open();
  if (!process.argv.includes('--kapak')) {
    fs.rmSync(fr, { recursive: true, force: true }); fs.mkdirSync(fr, { recursive: true });
    const n = Math.round(DUR * FPS);
    for (let i = 0; i < n; i++) {
      await page.evaluate((t) => window.render(t), i / FPS);
      await page.screenshot({ path: path.join(fr, `f${String(i).padStart(4, '0')}.png`) });
      if (i % 150 === 0) console.log(`kare ${i}/${n}`);
    }
  }
  await page.evaluate(() => window.kapak());
  await page.screenshot({ path: path.join(root, `marketing/reels/${SLUG}-kapak.png`) });
  await browser.close();
  if (errs.length) throw new Error(errs.join(' | '));
  if (process.argv.includes('--kapak')) process.exit(0);
}
run('python3', [py, 'ses']);
const wav = path.join(work, 'karisim.wav');
// iki geçişli doğrusal ses yüksekliği: önce ölç, sonra ölçülenle doğrusal kazanç → −14 LUFS, ≤ −1 dBTP
const ln = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=20:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const m = JSON.parse(ln.slice(ln.lastIndexOf('{'), ln.lastIndexOf('}') + 1));
const lnf = `loudnorm=I=-14:TP=-1.5:LRA=20:linear=true:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}`;
run('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(work, 'kare', 'f%04d.png'), '-i', wav,
  '-af', lnf + ',aresample=48000', '-ar', '48000', '-ac', '2',
  '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'slow', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '192k', '-aac_pns', '0', '-t', String(DUR), '-movflags', '+faststart', out]);
console.log('yazıldı:', out, DUR, 'sn');
