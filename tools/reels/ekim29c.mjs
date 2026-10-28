// 29 Ekim Atatürk anma/kutlama Reels'i: ekim29c.html sahnesini 30 kare/sn kare kare çeker, ekim29c_ses.py ile özgün müziği üretir,
// H.264 High yuv420p + AAC 48 kHz stereo, faststart olarak marketing/reels/29-ekim-ataturk.mp4'e birleştirir (−14 LUFS, ≤ −1 dBTP).
// Kullanım: PLAYWRIGHT_CHROMIUM=... node tools/reels/ekim29c.mjs [--sadece-ses | --onizle 3,12,27 | --bastan <kare>]
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../..');
const work = path.join(root, 'tools/harness/out/reels/29-ekim-ataturk');
const out = path.join(root, 'marketing/reels/29-ekim-ataturk.mp4');
const DUR = 39.5, KAPAK = 16.6, FPS = 30;
const run = (cmd, a) => { const r = spawnSync(cmd, a, { stdio: 'inherit' }); if (r.status !== 0) throw new Error(cmd + ' ' + r.status); };

fs.mkdirSync(work, { recursive: true });
// --onizle 1,7.5,16 : yalnız bu anların karelerini work/onizle-*.png olarak çeker (hızlı göz denetimi)
const oi = process.argv.indexOf('--onizle');
if (oi > 0) {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(here, 'ekim29c.html')); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
  for (const ts of process.argv[oi + 1].split(',')) { await page.evaluate((t) => window.render(t), +ts); await page.screenshot({ path: path.join(work, `onizle-${ts}.png`) }); }
  await browser.close(); process.exit(0);
}
const fr = path.join(work, 'kare');
if (!process.argv.includes('--sadece-ses')) {
  // --bastan N: var olan kareleri koruyup N. kareden itibaren yeniden çeker (yalnız sondaki sahne değiştiyse)
  const bi = process.argv.indexOf('--bastan'); const start = bi > 0 ? +process.argv[bi + 1] : 0;
  if (!start) fs.rmSync(fr, { recursive: true, force: true });
  else for (const f of fs.readdirSync(fr)) if (+f.slice(1, 5) >= start) fs.rmSync(path.join(fr, f));
  fs.mkdirSync(fr, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + path.join(here, 'ekim29c.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const n = Math.round(DUR * FPS);
  for (let i = start; i < n; i++) {
    await page.evaluate((t) => window.render(t), i / FPS);
    await page.screenshot({ path: path.join(fr, `f${String(i).padStart(4, '0')}.png`) });
    if (i % 60 === 0) console.log(`kare ${i}/${n}`);
  }
  await page.evaluate((t) => window.render(t), KAPAK);
  await page.screenshot({ path: path.join(root, 'marketing/reels/29-ekim-ataturk-kapak.png') });
  await browser.close();
  if (errs.length) throw new Error(errs.join(' | '));
}
const wav = path.join(work, 'muzik.wav');
run('python3', [path.join(here, 'ekim29c_ses.py'), wav, String(DUR)]);
// iki geçişli doğrusal ses yüksekliği: önce ölç, sonra ölçülenle doğrusal kazanç (dinamik pompalama yok) → −14 LUFS, ≤ −1 dBTP
const ln = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=20:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const m = JSON.parse(ln.slice(ln.lastIndexOf('{'), ln.lastIndexOf('}') + 1));
const lnf = `loudnorm=I=-14:TP=-1.5:LRA=20:linear=true:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}`;
run('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(fr, 'f%04d.png'), '-i', wav,
  '-af', lnf + ',aresample=48000', '-ar', '48000', '-ac', '2',
  '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'slow', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '192k', '-t', String(DUR), '-movflags', '+faststart', out]);
console.log('yazıldı:', out);
