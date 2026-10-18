#!/usr/bin/env node
// Görsel vitrin: render modülünü esbuild ile paketler, Playwright (Chromium, swiftshader) ile her biyomu ve galeriyi çeker.
// Kullanım: node tools/harness/scratch/render-showcase/shoot.mjs [--modes level,gallery,heroes,hud,backdrop,smoke] [--only kanal,zar] [--t 1600]
// Çıktı: tools/harness/out/render/*.png (gallery-1/2, hero-poses, hud-states, level-<biyom>, backdrop-<biyom>, smoke)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const here = dirname(new URL(import.meta.url).pathname);
const root = resolve(here, '../../../..');
const out = resolve(root, 'tools/harness/out/render');
mkdirSync(out, { recursive: true });
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] ?? '1'] : []).filter((x) => x.length));
const BIOMES = ['dis-kulak', 'kanal', 'zar', 'kemikcikler', 'koklea-1', 'koklea-2', 'koklea-3', 'sinir', 'beyin-sapi', 'korteks'];
const only = args.only ? String(args.only).split(',') : BIOMES;

const t0 = Date.now();
const bundle = await build({
  entryPoints: [resolve(here, 'main.ts')], bundle: true, write: false, format: 'iife', target: 'es2020', logLevel: 'warning',
  tsconfig: resolve(root, 'tsconfig.json'), define: { 'process.env.NODE_ENV': '"production"' },
});
const code = bundle.outputFiles[0].text;
// isteğe bağlı yuvarlak yazı tipi (fonts/nunito-latin*.woff2, OFL): yoksa sistem yazı tipleriyle çekilir
const fontFile = (f) => resolve(here, 'fonts', f);
const font = (f) => readFileSync(fontFile(f)).toString('base64');
const hasFonts = existsSync(fontFile('nunito-latin.woff2')) && existsSync(fontFile('nunito-latin-ext.woff2'));
const fontCss = hasFonts ? `@font-face{font-family:'Nunito';font-weight:600 900;src:url(data:font/woff2;base64,${font('nunito-latin.woff2')}) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}
@font-face{font-family:'Nunito';font-weight:600 900;src:url(data:font/woff2;base64,${font('nunito-latin-ext.woff2')}) format('woff2');unicode-range:U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;}` : '';
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${fontCss}
html,body{margin:0;background:#140c35;overflow:hidden}#game{width:390px;height:844px}
</style></head><body><div id="game"></div></body></html>`;
writeFileSync(resolve(out, '_showcase.html'), html);
console.log(`paket: ${(code.length / 1e6).toFixed(1)} MB, ${Date.now() - t0} ms`);

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const shots = [];
const run = async (params, file) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('GL Driver')) errors.push(`[${m.type()}] ${m.text()}`); });
  await page.setContent(html);
  if (hasFonts) await page.evaluate(() => document.fonts.load('800 20px Nunito'));
  await page.evaluate((p) => { window.__params = p; }, params);
  await page.addScriptTag({ content: code });
  const t = Date.now();
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const info = await page.evaluate(() => window.__info ?? null);
  const smoke = await page.evaluate(() => window.__smoke ?? null); if (smoke) console.log('SMOKE', smoke.length ? smoke.join('\n  ') : 'temiz');
  const shot = resolve(out, file);
  await page.screenshot({ path: shot });
  shots.push(shot);
  console.log(`${file}  ${Date.now() - t} ms  ${info ? JSON.stringify(info) : ''}`);
  if (errors.length) console.log('  HATALAR:\n   ' + errors.slice(0, 8).join('\n   '));
  await page.close();
};
// --modes level,gallery,heroes,hud (varsayılan hepsi) · --only biyom1,biyom2 (yalnız level)
const modes = new Set(String(args.modes ?? 'level,gallery,heroes,hud').split(','));
if (modes.has('level')) for (const b of only) await run({ mode: 'level', biome: b, t: Number(args.t ?? 1600) }, `level-${b}.png`);
if (modes.has('gallery')) { await run({ mode: 'gallery', biome: 'kemikcikler', page: 0 }, 'gallery-1.png'); await run({ mode: 'gallery', biome: 'koklea-2', page: 1 }, 'gallery-2.png'); }
if (modes.has('backdrop')) for (const b of only) await run({ mode: 'backdrop', biome: b, t: 800 }, `backdrop-${b}.png`);
if (modes.has('smoke')) { await run({ mode: 'smoke', biome: 'dis-kulak', t: 1500 }, 'smoke.png'); }
if (modes.has('heroes')) await run({ mode: 'heroes', biome: 'beyin-sapi', t: 1600 }, 'hero-poses.png');
if (modes.has('hud')) await run({ mode: 'hud', biome: 'zar', t: 1600 }, 'hud-states.png');
await browser.close();
