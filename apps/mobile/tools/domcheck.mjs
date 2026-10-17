/**
 * DOM bileşeni duman testi: `expo export` ile üretilen GERÇEK www.bundle sayfasını (iPhone'a giden dosyaların aynısı)
 * native köprüyü taklit ederek Chromium'da açar; 1. bölümü bot modunda oynatır, levelComplete/levelFailed olayını bekler.
 * Kullanım: PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/domcheck.mjs [--dist dist] [--level 1] [--ts 2] [--timeout 180] [--skills all] [--salt 0]
 * Çıktı: tools/out/domcheck-L<N>-{start,end}.png ve JSON özet. Çıkış kodu 0 = bölüm bitti ve konsol hatası yok.
 */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1'] : []).filter(Boolean));
const appRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const wsRoot = path.resolve(appRoot, '../..');
const dist = path.resolve(appRoot, args.dist ?? 'dist');
const level = Number(args.level ?? 1);
const ts = Number(args.ts ?? 2);
const timeoutSec = Number(args.timeout ?? 180);
const salt = Number(args.salt ?? 0);
const outDir = path.resolve(appRoot, 'tools/out'); fs.mkdirSync(outDir, { recursive: true });

// 1) Bölüm üretimi (native tarafın yaptığı iş): level-gen'i Node için paketle ve çağır.
const genFile = path.join(outDir, 'level-gen.node.mjs');
await build({ entryPoints: [path.join(wsRoot, 'packages/level-gen/src/index.ts')], bundle: true, format: 'esm', platform: 'node', outfile: genFile, logLevel: 'error', target: 'es2022',
  alias: Object.fromEntries(['game-core', 'content', 'level-gen', 'shared'].map((p) => [`@odi/${p}`, path.join(wsRoot, 'packages', p, 'src')])) });
const { generateLevel } = await import(pathToFileURL(genFile).href);
const skills = args.skills === 'all' ? { doubleJump: true, longSlide: true, magnet: 3, shield: 2, breath: 3, echoSight: true } : { doubleJump: false, longSlide: false, magnet: 0, shield: 0, breath: 0, echoSight: false };
const spec = generateLevel('insan', level, { recentStars: 2, failStreak: 0, skills }, salt);

// 2) DOM sayfası: www.bundle içinde LevelDom'a ait html (tek DOM bileşeni var; birden çoksa hepsi denenir).
const bundleDir = path.join(dist, 'www.bundle');
if (!fs.existsSync(bundleDir)) { console.error('www.bundle yok: önce `npx expo export --platform ios --output-dir dist`'); process.exit(2); }
const htmls = fs.readdirSync(bundleDir).filter((f) => f.endsWith('.html'));
if (!htmls.length) { console.error('www.bundle içinde html yok'); process.exit(2); }

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let failed = 0;
for (const h of htmls) {
  const page = await browser.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const errors = []; const native = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/favicon|AudioContext|WebGL|GPU|Autoplay/i.test(t)) errors.push('console: ' + t.slice(0, 300)); });
  await page.exposeFunction('__hostMessage', (s) => { try { native.push(JSON.parse(s)); } catch { native.push({ type: 'raw', data: s }); } });
  // Expo DOM köprüsü taklidi: injectedObjectJson başlangıç prop'larını verir; $$native_action çağrılarına sonuç döner.
  await page.addInitScript(({ initialProps }) => {
    window.ReactNativeWebView = {
      injectedObjectJson: () => JSON.stringify({ EXPO_DOM_HOST_OS: 'ios', initialProps }),
      postMessage: (s) => {
        window.__hostMessage(s);
        try {
          const m = JSON.parse(s);
          if (m.type === '$$native_action') {
            setTimeout(() => window.dispatchEvent(new CustomEvent('$$dom_event', { detail: { type: '$$native_action_result', data: { uid: m.data.uid, actionId: m.data.actionId, result: null } } })), 0);
          }
        } catch { /* yok */ }
      },
    };
  }, { initialProps: { names: ['onEvent'], props: { spec, skills, sounds: false, bot: true, timeScale: ts, paused: false } } });

  const t0 = Date.now(); let result = null; let timedOut = false;
  try {
    await page.goto(pathToFileURL(path.join(bundleDir, h)).href, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__odi && window.__odi.events.some((e) => e.type === 'started'), null, { timeout: 45_000 });
    await page.screenshot({ path: path.join(outDir, `domcheck-L${String(level).padStart(2, '0')}-start.png`) });
    await page.waitForFunction(() => window.__odi && window.__odi.done, null, { timeout: timeoutSec * 1000 });
    result = await page.evaluate(() => window.__odi.result);
  } catch (e) { timedOut = true; errors.push('timeout/err: ' + String(e.message ?? e).split('\n')[0]); }
  await page.screenshot({ path: path.join(outDir, `domcheck-L${String(level).padStart(2, '0')}-end.png`) }).catch(() => {});
  const canvas = await page.evaluate(() => !!document.querySelector('canvas')).catch(() => false);
  const prog = await page.evaluate(() => { const p = window.__odi?.events.filter((e) => e.type === 'progress').pop(); return p ? p.pct : 0; }).catch(() => 0);
  const bridged = native.filter((m) => m.type === '$$native_action').map((m) => m.data?.args?.[0]?.type);
  const summary = { page: h, level, name: spec.name, mechanic: spec.mechanic, canvas, result: result && { completed: result.completed, stars: result.stars, score: result.score, coins: result.coins, timeSec: result.timeSec }, progress: Number(prog.toFixed(2)), bridgedEvents: bridged.length, bridgedKinds: [...new Set(bridged)], domReady: native.some((m) => m.type === '$$dom_ready'), errors: [...new Set(errors)].slice(0, 6), timedOut, wall: Math.round((Date.now() - t0) / 1000) };
  const ok = !timedOut && canvas && errors.length === 0 && result && bridged.includes(result.completed ? 'levelComplete' : 'levelFailed');
  if (!ok) failed++;
  console.log(JSON.stringify(summary, null, 2));
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
