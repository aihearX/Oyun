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
// 3) dokunmatik oyun: DPR 3 + dokunma; duraklat düğmesi zıplatmadan menüyü açar, gösterge güvenli alanın (insetTop 47) altında,
//    Devam / Yeniden başla çalışır
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: !isWebkit, deviceScaleFactor: 3 });
  const errors = []; page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(() => { window.ReactNativeWebView = { injectedObjectJson: () => JSON.stringify({ EXPO_DOM_HOST_OS: 'ios', initialProps: { names: ['getItem', 'setItem', 'removeItem', 'haptic', 'share'], props: { serverUrl: '', insetTop: 47, insetBottom: 34 } } }), postMessage: (s) => { try { const m = JSON.parse(s); if (m.type === '$$native_action') setTimeout(() => window.dispatchEvent(new CustomEvent('$$dom_event', { detail: { type: '$$native_action_result', data: { uid: m.data.uid, actionId: m.data.actionId, result: null } } })), 0); } catch { /* yok */ } } }; });
  const r = { step: 'dokunma', pauseOpens: false, noJump: false, hudBelowInset: false, resume: false, restart: false };
  try {
    await page.goto(html + '?bot=1&human=1&level=1&hd=3', { waitUntil: 'load' });
    await page.waitForFunction(() => !!globalThis.__odiScene?.hud, null, { timeout: 45_000 });
    const box = await page.locator('canvas').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); // dokun ve başla
    await page.waitForFunction(() => window.__odi?.events.some((e) => e.type === 'started'), null, { timeout: 20_000 });
    await page.waitForTimeout(500);
    const pb = await page.evaluate(() => globalThis.__odiScene.pauseButtonPage());
    r.hudBelowInset = pb.y - 22 >= 47;
    const y0 = await page.evaluate(() => globalThis.__odiScene.sim.hero.y);
    await page.touchscreen.tap(pb.x, pb.y);
    await page.getByText('Duraklatıldı').waitFor({ timeout: 5000 }); r.pauseOpens = true;
    const st = await page.evaluate(() => { const sc = globalThis.__odiScene; return { y: sc.sim.hero.y, g: sc.sim.hero.grounded, vy: sc.sim.hero.vy, paused: sc.scene.isPaused() }; });
    r.noJump = st.g && st.vy === 0 && Math.abs(st.y - y0) < 1 && st.paused;
    await page.getByText('Devam').click(); await page.waitForTimeout(400);
    r.resume = await page.evaluate(() => !globalThis.__odiScene.scene.isPaused());
    const pb2 = await page.evaluate(() => globalThis.__odiScene.pauseButtonPage());
    await page.touchscreen.tap(pb2.x, pb2.y); await page.getByText('Yeniden başla').click();
    await page.waitForFunction(() => globalThis.__odiScene && globalThis.__odiScene.sim.t < 1 && !globalThis.__odiScene.state.finished, null, { timeout: 10_000 }); r.restart = true;
    await page.screenshot({ path: path.join(outDir, `domcheck-dokunma-${isWebkit ? 'webkit' : 'chromium'}.png`) });
  } catch (e) { errors.push('dokunma: ' + String(e.message ?? e).split('\n')[0]); }
  const ok = r.pauseOpens && r.noJump && r.hudBelowInset && r.resume && r.restart && !errors.length;
  console.log(JSON.stringify({ ...r, ok, errors: errors.slice(0, 4) }));
  if (!ok) failed++;
  await page.close();
}
// 4) (Chromium, DPR 1 — yazılım GL'de DPR 3 kareleri saniyeler sürer, kaydırma hızı ölçülemez) yatay kaydırma
if (!isWebkit) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(() => { window.ReactNativeWebView = { injectedObjectJson: () => JSON.stringify({ EXPO_DOM_HOST_OS: 'ios', initialProps: { names: ['getItem', 'setItem', 'removeItem', 'haptic', 'share'], props: { serverUrl: '', insetTop: 47, insetBottom: 34 } } }), postMessage: (s) => { try { const m = JSON.parse(s); if (m.type === '$$native_action') setTimeout(() => window.dispatchEvent(new CustomEvent('$$dom_event', { detail: { type: '$$native_action_result', data: { uid: m.data.uid, actionId: m.data.actionId, result: null } } })), 0); } catch { /* yok */ } } }; });
  const r = { step: 'kaydırma', swipeTurn: false, forwardIgnored: false };
  try {
    await page.goto(html + '?bot=1&human=1&level=1', { waitUntil: 'load' });
    await page.waitForFunction(() => !!globalThis.__odiScene?.hud, null, { timeout: 45_000 });
    const box = await page.locator('canvas').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(() => window.__odi?.events.some((e) => e.type === 'started'), null, { timeout: 20_000 });
    // Odi sol duvardan biraz uzaklaşsın (çukura varmadan)
    await page.waitForFunction(() => { const sc = globalThis.__odiScene; return sc.sim.hero.x > 330 && sc.sim.hero.grounded; }, null, { timeout: 60_000, polling: 50 });
    // CDP dokunma: koşunun tersine (sola) hızlı kaydırma → dönüş; sağa kaydırma (darbe kapalı) yön değiştirmez
    const cdp = await page.context().newCDPSession(page);
    // olay zaman damgaları açıkça verilir (yazılım GL'de ana iş parçacığı takılınca CDP olayları geç işlenir; hız yine 40 ms'lik kaydırmadan ölçülür)
    const swipe = async (x0, x1) => { const y = box.y + box.height * 0.6; const t0 = Date.now() / 1000; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }], timestamp: t0 }); for (let i = 1; i <= 4; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / 4, y }], timestamp: t0 + i * 0.01 }); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: t0 + 0.05 }); };
    const dir = () => page.evaluate(() => globalThis.__odiScene.sim.hero.dir);
    // yerdeyken kaydır (havadaki/zıplama penceresindeki hâller ayrı); zaman aşımında bir kez daha dener, deneme sayısı raporlanır
    const groundSwipe = async (x0, x1, want) => { for (let k = 1; k <= 3; k++) { await page.waitForFunction(() => { const h = globalThis.__odiScene.sim.hero; return h.grounded && h.turnCd <= 0; }, null, { timeout: 20_000, polling: 30 }); await swipe(x0, x1); await page.waitForTimeout(250); if ((await dir()) === want) return k; } return 0; };
    const d0 = await dir();
    r.tries = [await groundSwipe(box.x + 300, box.x + 120, -1)];
    const d1 = await dir();
    r.swipeTurn = d0 === 1 && d1 === -1;
    r.tries.push(await groundSwipe(box.x + 120, box.x + 300, 1)); // şimdi koşu sola: sağa kaydırma = geri dön
    const d2 = await dir();
    await swipe(box.x + 120, box.x + 300); await page.waitForTimeout(250); // koşu sağa: sağa kaydırma = ileri (darbe kapalı) → yön aynı
    const d3 = await page.evaluate(() => globalThis.__odiScene.sim.hero.dir);
    r.forwardIgnored = d2 === 1 && d3 === 1; r.dirs = [d0, d1, d2, d3];
  } catch (e) { errors.push('kaydırma: ' + String(e.message ?? e).split('\n')[0]); }
  const ok = r.swipeTurn === true && r.forwardIgnored === true && !errors.length;
  console.log(JSON.stringify({ ...r, ok, errors: errors.slice(0, 4) }));
  if (!ok) failed++;
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
