#!/usr/bin/env node
// ODİ bot harness: web derlemesini önizleme sunucusunda açar, her bölümü otomatik oyuncuyla oynatır,
// konsol hatalarını ve sonuçları toplar, ekran görüntüsü alır.
// Kullanım: node tools/harness/bot.mjs [--levels 1-40] [--browser chromium|webkit] [--parallel 3] [--ts 1] [--skills all] [--no-build] [--timeout 180] [--tag isim] [--shots 1] [--json 1]
// --tag: ayrı derleme ve çıktı klasörü (tools/harness/out/<tag>/) — aynı anda birden çok harness çalıştırmak için.
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { chromium, webkit } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1'] : []).filter(Boolean));
const [lo, hi] = (args.levels ?? '1-1').split('-').map(Number);
const levels = Array.from({ length: (hi ?? lo) - lo + 1 }, (_, i) => lo + i);
const browserName = args.browser ?? 'chromium';
const parallel = Number(args.parallel ?? 3);
const ts = Number(args.ts ?? 1);
const timeoutSec = Number(args.timeout ?? 180);
const root = resolve(new URL('../..', import.meta.url).pathname);
const tag = args.tag ?? 'default';
const outDir = resolve(root, 'tools/harness/out', tag); mkdirSync(outDir, { recursive: true });
const distDir = resolve(outDir, 'dist');

const run = (cmd, a, opts = {}) => new Promise((res, rej) => { const p = spawn(cmd, a, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...opts }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${a.join(' ')} → ${c}`)))); });

if (!args['no-build'] || !existsSync(resolve(distDir, 'index.html'))) await run('npx', ['vite', 'build', '--outDir', distDir, '--emptyOutDir'], { cwd: resolve(root, 'apps/web') });
// boş bir port (işletim sistemi verir): aynı anda koşan başka ağaçların önizlemeleriyle çakışmasın
const port = await new Promise((res, rej) => { const s = createServer(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort', '--outDir', distDir], { cwd: resolve(root, 'apps/web'), stdio: 'ignore', shell: process.platform === 'win32', detached: process.platform !== 'win32' });
const base = `http://localhost:${port}`;
// önizleme her çıkış yolunda kapanır (MK-036): tarayıcı açılamazsa (ör. PLAYWRIGHT_CHROMIUM yanlış), beklenmeyen hata, Ctrl+C / SIGTERM.
// Önizleme kendi süreç grubunda (detached) koşar; bu süreç ölse de yaşar, bu yüzden grup olarak kapatılır. SIGKILL ile öldürülürsek
// (ör. kabul zaman sınırı) bunu kabul.mjs'in koşu kimliğiyle yaptığı temizlik kapatır.
let previewUp = true;
function stopPreview() {
  if (!previewUp) return;
  previewUp = false;
  try { if (process.platform !== 'win32') process.kill(-preview.pid, 'SIGKILL'); else preview.kill(); } catch { try { preview.kill('SIGKILL'); } catch { /* zaten kapalı */ } }
}
process.on('exit', stopPreview);
for (const [sig, n] of [['SIGINT', 2], ['SIGTERM', 15], ['SIGHUP', 1]]) process.once(sig, () => { stopPreview(); process.exit(128 + n); });
// önizleme yanıt verene kadar bekle (sabit süre değil: yüklü makinede npx + vite açılışı 1,5 sn'yi aşıp "connection refused" veriyordu)
{
  let exited = null; preview.once('exit', (c) => { exited = c ?? 'sinyal'; });
  const until = Date.now() + 90_000;
  for (;;) {
    if (exited !== null) throw new Error(`vite preview kapandı (çıkış ${exited}) · port ${port}`);
    if (await fetch(base, { signal: AbortSignal.timeout(3000) }).then((r) => r.ok, () => false)) break;
    if (Date.now() > until) throw new Error(`vite preview 90 sn içinde yanıt vermedi · ${base}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

const exe = browserName === 'webkit' ? undefined : process.env.PLAYWRIGHT_CHROMIUM;
const browser = await (browserName === 'webkit' ? webkit : chromium).launch({ headless: true, executablePath: exe, args: browserName === 'webkit' ? [] : ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

async function playLevel(n) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1, isMobile: browserName !== 'webkit', hasTouch: true });
  const page = await ctx.newPage();
  const errors = []; const events = [];
  page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/favicon|AudioContext|WebGL|GPU|Autoplay/i.test(t)) errors.push(t); if (t.startsWith('ODI_EVENT ')) { try { events.push(JSON.parse(t.slice(10))); } catch { /* yok */ } } });
  const url = `${base}/?bot=1&level=${n}&ts=${ts}${args.skills === 'all' ? '&skills=all' : ''}${args.salt ? `&salt=${args.salt}` : ''}${args.idle ? '&idle=1' : ''}`;
  const t0 = Date.now();
  let result = null; let timedOut = false;
  try {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__odi && window.__odi.events.some((e) => e.type === 'started'), null, { timeout: 30_000 });
    if (args.shots) await page.screenshot({ path: resolve(outDir, `L${String(n).padStart(2, '0')}-start.png`) });
    await page.waitForFunction(() => window.__odi && window.__odi.done, null, { timeout: timeoutSec * 1000 });
    result = await page.evaluate(() => window.__odi.result);
  } catch (e) { timedOut = true; errors.push('timeout/err: ' + String(e.message ?? e).split('\n')[0]); }
  const spec = await page.evaluate(() => window.__odi?.spec && { name: window.__odi.spec.name, mechanic: window.__odi.spec.mechanic, biome: window.__odi.spec.biome, objective: window.__odi.spec.objective.id, modifiers: window.__odi.spec.modifiers, lengthPx: window.__odi.spec.lengthPx, par: window.__odi.spec.parTimeSec, coins: window.__odi.spec.coinsTotal }).catch(() => null);
  const fps = await page.evaluate(() => Math.round(globalThis.__odiScene?.game?.loop?.actualFps ?? 0)).catch(() => 0);
  const prog = await page.evaluate(() => { const p = window.__odi?.events.filter((e) => e.type === 'progress').pop(); return p ? p.pct : 0; }).catch(() => 0);
  await page.screenshot({ path: resolve(outDir, `L${String(n).padStart(2, '0')}-end.png`) }).catch(() => {});
  await ctx.close();
  return { n, spec, result, progress: prog, errors: [...new Set(errors)], timedOut, wall: Math.round((Date.now() - t0) / 1000), events: events.length, fps };
}

const results = [];
const queue = [...levels];
await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, async () => { while (queue.length) { const n = queue.shift(); const r = await playLevel(n); results.push(r); const s = r.spec ?? {}; console.log(`L${String(n).padStart(2, '0')} ${(s.mechanic ?? '?').padEnd(9)} ${(s.biome ?? '?').padEnd(12)} ${(s.objective ?? '?').padEnd(11)} ${r.result ? (r.result.completed ? `OK ⭐${r.result.stars}` : 'FAIL  ') : 'TIMEOUT'} prog ${(r.progress * 100).toFixed(0).padStart(3)}% coins ${r.result?.coins ?? 0}/${s.coins ?? '?'} dmg ${r.result?.damageTaken ?? '-'} fall ${r.result?.deaths ?? '-'} ${r.result?.extra?.reason ?? ''} t=${r.result?.timeSec ?? '-'}s fps ${r.fps} wall ${r.wall}s${r.errors.length ? ' ERR: ' + r.errors.join(' | ').slice(0, 300) : ''}`); } }));
results.sort((a, b) => a.n - b.n);
await browser.close(); stopPreview();
const failed = results.filter((r) => !r.result?.completed);
const errored = results.filter((r) => r.errors.length);
console.log(`\n${results.length} bölüm · ${results.length - failed.length} tamamlandı · ${failed.length} başarısız/timeout · ${errored.length} hatalı`);
if (args.json) { const { writeFileSync } = await import('node:fs'); writeFileSync(resolve(outDir, 'results.json'), JSON.stringify(results, null, 2)); }
process.exit(errored.length ? 2 : 0);
