// Reels çekim yardımcıları: derleme + önizleme sunucusu + temiz oynanış klibi (kare kare, simülasyon saniyesiyle).
// Yazılım GL'de oyun makine yüküne göre 1-8 kare/sn çizer; bu yüzden gerçek zamanlı video kaydı yerine sanal saatle kare kare
// çekilir (clip.html): her kare tam 1/30 sn, makine yüklüyken bile kusursuz akıcı.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../..', import.meta.url));
export const outRoot = path.join(root, 'tools/harness/out/reels');
export const dist = path.join(outRoot, 'dist');

const run = (cmd, a, cwd) => new Promise((res, rej) => { const p = spawn(cmd, a, { cwd, stdio: 'inherit' }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(cmd + ' ' + c)))); });

/** web uygulamasını dist'e derler (isteğe bağlı) ve Reels sayfalarını, yazı tiplerini dist/reels altına koyar */
export async function prepareDist({ build = true } = {}) {
  if (build || !fs.existsSync(path.join(dist, 'index.html'))) await run('npx', ['vite', 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'error'], path.join(root, 'apps/web'));
  const dst = path.join(dist, 'reels'); fs.mkdirSync(path.join(dst, 'img'), { recursive: true }); fs.mkdirSync(path.join(dst, 'fonts'), { recursive: true });
  for (const f of ['studio.html', 'clip.html', 'overlay.html']) if (fs.existsSync(path.join(root, 'tools/reels', f))) fs.copyFileSync(path.join(root, 'tools/reels', f), path.join(dst, f));
  for (const f of fs.readdirSync(path.join(root, 'tools/reels/fonts'))) fs.copyFileSync(path.join(root, 'tools/reels/fonts', f), path.join(dst, 'fonts', f));
  return dst;
}
/** tools/harness/out altındaki bir görseli dist/reels/img'ye kopyalar, sayfadaki adresini döndürür */
export function stageImage(rel) {
  const src = path.isAbsolute(rel) ? rel : path.join(root, 'tools/harness/out', rel);
  const name = path.relative(path.join(root, 'tools/harness/out'), src).replace(/[/\\]/g, '-');
  fs.copyFileSync(src, path.join(dist, 'reels/img', name));
  return `/reels/img/${name}`;
}

export async function startPreview() {
  const port = 4700 + Math.floor(Math.random() * 200);
  const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort', '--outDir', dist], { cwd: path.join(root, 'apps/web'), stdio: 'ignore', detached: true });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 250)); try { const r = await fetch(`http://localhost:${port}/`); if (r.ok) break; } catch { /* bekle */ } }
  return { port, stop: () => { try { process.kill(-preview.pid); } catch { /* yok */ } } };
}

export async function launch(chromium) {
  return chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling'] });
}

export const clipId = (c) => `L${String(c.level).padStart(2, '0')}${c.salt ? `-s${c.salt}` : ''}-t${c.fromT}-d${c.dur}${c.fps && c.fps !== 30 ? `-f${c.fps}` : ''}`;
export const clipDir = (c) => path.join(outRoot, 'clips', clipId(c));

/**
 * Temiz oynanış klibini kare kare çeker: clips/<id>/f00001.jpg… + index.json { frames: [{ f, t }] } (t: simülasyon saniyesi).
 * c: { level, salt?, fromT, dur, hd?, fps? }  (kırpma/ölçek birleştirmede yapılır)
 */
export async function captureClip(browser, port, c, { force = false, log = console.log } = {}) {
  const dir = clipDir(c);
  if (!force && fs.existsSync(path.join(dir, 'index.json'))) { log(`↺ ${clipId(c)} hazır`); return dir; }
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/reels/clip.html`, { waitUntil: 'load' });
  const t0 = Date.now();
  await page.evaluate((s) => window.startClip(s), c);
  await page.waitForFunction(() => window.clip.ready || window.clip.error, null, { timeout: 400_000, polling: 100 });
  const err = await page.evaluate(() => window.clip.error); if (err) throw new Error(`${clipId(c)}: ${err}`);
  const fps = c.fps ?? 30, end = c.fromT + c.dur + 0.1;
  const frames = []; let i = 0, last = null;
  for (;;) {
    const r = await page.evaluate((f) => window.frame(f), fps);
    const file = `f${String(++i).padStart(5, '0')}.jpg`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(r.data.slice(r.data.indexOf(',') + 1), 'base64'));
    frames.push({ f: file, t: +r.t.toFixed(4) }); last = r;
    if (r.t >= end || r.done) break;
    if (i > 6000) throw new Error(`${clipId(c)}: çok kare`);
  }
  await ctx.close();
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ clip: c, fps, frames, errors, wallSec: (Date.now() - t0) / 1000 }, null, 0));
  log(`🎬 ${clipId(c)}: ${frames.length} kare, sim ${frames[0].t.toFixed(2)}→${last.t.toFixed(2)}, ${((Date.now() - t0) / 1000).toFixed(0)} sn${errors.length ? ' HATA: ' + errors.join(' | ') : ''}`);
  return dir;
}
