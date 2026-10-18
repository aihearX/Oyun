// Reels sahne zamanlaması: bölümü bot ile oynatır, yetenek olaylarını (simülasyon saniyesiyle) yazar.
// Kullanım: PLAYWRIGHT_CHROMIUM=... node tools/reels/probe.mjs <dist> <bölüm> [salt]   (dist: ör. tools/harness/out/reels/dist)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const [distArg, level, salt] = process.argv.slice(2);
const dist = path.resolve(distArg);
const port = 4300 + Math.floor(Math.random() * 300);
const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort', '--outDir', dist], { cwd: path.join(root, 'apps/web'), stdio: 'ignore', detached: true });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
await page.goto(`http://localhost:${port}/?bot=1&level=${level}${salt ? `&salt=${salt}` : ''}`);
await page.waitForFunction(() => window.__odi?.events.some((e) => e.type === 'started') && globalThis.__odiScene, null, { timeout: 30000 });
await page.evaluate(() => {
  const sc = globalThis.__odiScene; const orig = sc.onEvent.bind(sc); globalThis.__evlog = [];
  const keep = new Set(['jump', 'walljump', 'cling', 'slide', 'glide', 'tramp-strong', 'hook', 'unhook', 'poundland', 'dash', 'flip', 'swim', 'splash', 'hurt', 'kill', 'break', 'bossHit', 'bossPhase', 'tutor', 'cochlea', 'spring', 'launch', 'switch']);
  sc.onEvent = (e) => { if (keep.has(e.k)) globalThis.__evlog.push(`${sc.sim.t.toFixed(1)}:${e.k}${e.s ? '/' + e.s : ''}`); return orig(e); };
});
await page.waitForFunction(() => window.__odi?.done, null, { timeout: 280000, polling: 500 }).catch(() => {});
const log = await page.evaluate(() => globalThis.__evlog);
console.log(`L${level}: ` + log.join(' '));
await browser.close(); try { process.kill(-preview.pid); } catch { /* yok */ }
