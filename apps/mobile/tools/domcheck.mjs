#!/usr/bin/env node
/**
 * Mobil DOM paketi denetimi: `expo export` çıktısındaki www.bundle sayfasını (web uygulamasının tamamı)
 * yerel köprüyü taklit ederek Chromium/WebKit'te açar.
 *  1) Açılış: arayüz yüklenir, "Sesin Yolu" görünür, ekran görüntüsü.
 *  2) Bölüm: ?bot=1&level=N ile otomatik oyuncu bölümü oynar; levelComplete/levelFailed beklenir.
 * Kullanım: PLAYWRIGHT_CHROMIUM=... node tools/domcheck.mjs [--dist dist] [--level 1] [--browser chromium|webkit] [--timeout 180]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, webkit } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1'] : []).filter(Boolean));
const appRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.resolve(appRoot, args.dist ?? 'dist');
const level = Number(args.level ?? 1);
const timeoutSec = Number(args.timeout ?? 180);
const outDir = path.join(appRoot, 'tools/out'); fs.mkdirSync(outDir, { recursive: true });
const bundleDir = path.join(dist, 'www.bundle');
const htmls = fs.existsSync(bundleDir) ? fs.readdirSync(bundleDir).filter((f) => f.endsWith('.html')) : [];
if (!htmls.length) { console.error('www.bundle içinde html yok — önce: npx expo export --platform ios --output-dir dist'); process.exit(2); }
const html = pathToFileURL(path.join(bundleDir, htmls[0])).href;

const isWebkit = args.browser === 'webkit';
const browser = await (isWebkit ? webkit : chromium).launch({ headless: true, executablePath: isWebkit ? undefined : process.env.PLAYWRIGHT_CHROMIUM || undefined, args: isWebkit ? [] : ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

async function open(query) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: !isWebkit, deviceScaleFactor: 1 });
  const errors = []; const actions = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/favicon|AudioContext|WebGL|GPU|Autoplay|WebSocket|ERR_CONNECTION/i.test(t)) errors.push('console: ' + t.slice(0, 300)); });
  await page.exposeFunction('__hostMessage', (s) => { try { const m = JSON.parse(s); if (process.env.DEBUG_DOM) console.log('MSG', s.slice(0, 200)); if (m.type === '$$native_action') actions.push(m.data?.actionId ?? '?'); } catch { /* yok */ } });
  // Expo DOM köprüsü taklidi: başlangıç prop'ları + yerel fonksiyon çağrılarına (depolama, titreşim, paylaşım) yanıt.
  await page.addInitScript(() => {
    const store = {};
    window.ReactNativeWebView = {
      injectedObjectJson: () => JSON.stringify({ EXPO_DOM_HOST_OS: 'ios', initialProps: { names: ['getItem', 'setItem', 'removeItem', 'haptic', 'share'], props: { serverUrl: '', insetTop: 47, insetBottom: 34 } } }),
      postMessage: (s) => {
        window.__hostMessage(s);
        try {
          const m = JSON.parse(s);
          if (m.type === '$$native_action') {
            const [k, v] = m.data.args ?? [];
            let result = null;
            if (m.data.actionId === 'getItem') result = store[k] ?? null;
            if (m.data.actionId === 'setItem') store[k] = v;
            if (m.data.actionId === 'share') result = 'shared';
            setTimeout(() => window.dispatchEvent(new CustomEvent('$$dom_event', { detail: { type: '$$native_action_result', data: { uid: m.data.uid, actionId: m.data.actionId, result } } })), 0);
          }
        } catch { /* yok */ }
      },
    };
  });
  await page.goto(html + query, { waitUntil: 'load' });
  return { page, errors, actions };
}

let failed = 0;
// 1) açılış
{
  const { page, errors, actions } = await open('');
  let ok = true;
  try { await page.getByText('Sesin Yolu').first().waitFor({ timeout: 45_000 }); } catch { ok = false; }
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'domcheck-acilis.png') });
  const summary = { step: 'açılış', ok, nativeActions: [...new Set(actions)], errors: errors.slice(0, 6) };
  console.log(JSON.stringify(summary));
  if (!ok || errors.length) failed++;
  await page.close();
}
// 2) bölüm (bot)
{
  const { page, errors } = await open(`?bot=1&level=${level}`);
  const t0 = Date.now(); let result = null; let timedOut = false;
  try {
    await page.waitForFunction(() => window.__odi && window.__odi.events.some((e) => e.type === 'started'), null, { timeout: 45_000 });
    await page.screenshot({ path: path.join(outDir, `domcheck-L${String(level).padStart(2, '0')}-start.png`) });
    await page.waitForFunction(() => window.__odi && window.__odi.done, null, { timeout: timeoutSec * 1000 });
    result = await page.evaluate(() => window.__odi.result);
  } catch (e) { timedOut = true; errors.push('zaman aşımı: ' + String(e.message ?? e).split('\n')[0]); }
  await page.screenshot({ path: path.join(outDir, `domcheck-L${String(level).padStart(2, '0')}-end.png`) }).catch(() => {});
  const summary = { step: 'bölüm', level, canvas: await page.evaluate(() => !!document.querySelector('canvas')).catch(() => false), result: result && { completed: result.completed, stars: result.stars, score: result.score }, errors: errors.slice(0, 6), timedOut, wall: Math.round((Date.now() - t0) / 1000) };
  console.log(JSON.stringify(summary));
  if (!result?.completed || errors.length) failed++;
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
