#!/usr/bin/env node
// ODİ ilk deneyim (FTUE) uçtan uca testi: yeni oyuncu akışı baştan sona.
//   açılış → hikâye (7 cümle, Tüy Dede) → 1. bölüm (bot) → sonuç turu (yıldızlar, notalar) → harita turu (kilitli sekmeler)
//   → 2. bölüm → "Bugün" açılır (tur: sekmeye dokun, takvim ödülünü al) → 3. bölüm → "Kamp" açılır → kamp öğreticisi
//   (binaya dokun, panel, gerçek inşaat başlar) → 4. bölüm → Arkadaşlar → 5. bölüm → Takım açılır (tur).
// Her adımda: kilit durumları, anlatıcı metni (Türkçe) ve konuşma köprüsünün Türkçe metinle çağrıldığı denetlenir;
// her anlatıcı adımının ekran görüntüsü alınır (çentik 47 px bandı işaretli).
//   web Chromium: 6–10. bölüm de oynanır; her açılım turu yürütülür, bölüm başına tur sayısı (anlatıcı yükü) raporlanır.
// Hedefler: web (Chromium + WebKit, test derlemesi VITE_ODI_E2E=1: `?oyun-bot=1` bölümleri harness botu oynar)
//           dom (Expo DOM telefon paketi: bot yok → kayıt tohumlanmış kontrol noktaları: hikâye+1. bölüm başlangıcı,
//                harita turu, Bugün, Kamp öğreticisi (gerçek inşaat), Takım)
// Kullanım: node tools/harness/onboarding-e2e.mjs [--target web|dom|both] [--browsers chromium,webkit] [--sizes 390x844,320x640] [--no-build] [--build-dom]
// Çıktı: tools/harness/out/onboarding/<hedef>-<tarayıcı>-<GxY>/NN-ad.png
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, webkit } from 'playwright';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '1'; };
const has = (k) => argv.includes(`--${k}`);
const root = resolve(new URL('../..', import.meta.url).pathname);
const targets = opt('target', 'both') === 'both' ? ['web', 'dom'] : [opt('target')];
const browsers = opt('browsers', 'chromium,webkit').split(',');
const sizes = opt('sizes', '390x844,320x640').split(',').map((s) => s.split('x').map(Number));
const INSET = 47, INSET_B = 34;
const outRoot = resolve(root, 'tools/harness/out/onboarding'); mkdirSync(outRoot, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = [];
const cleanup = () => { for (const p of procs) { try { p.kill(); } catch { /* yok */ } } };
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { cleanup(); process.exit(130); });
const run = (cmd, a, o = {}) => new Promise((res, rej) => { const p = spawn(cmd, a, { cwd: root, stdio: 'inherit', ...o }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${a.join(' ')} → ${c}`)))); });

// ---------------------------------------------------------------- derleme + sunucu
const distDir = resolve(outRoot, 'dist');
if (targets.includes('web') && (!has('no-build') || !existsSync(resolve(distDir, 'index.html')))) {
  await run('npx', ['vite', 'build', '--outDir', distDir, '--emptyOutDir', '--logLevel', 'warn'], { cwd: resolve(root, 'apps/web'), env: { ...process.env, VITE_ODI_E2E: '1' } });
}
if (!existsSync(resolve(root, 'apps/server/dist/server.mjs')) || !has('no-build')) await run('npm', ['run', 'build:server', '--silent']);
const mobileDist = resolve(root, 'apps/mobile/dist');
if (targets.includes('dom') && (has('build-dom') || !existsSync(resolve(mobileDist, 'www.bundle')))) {
  rmSync(mobileDist, { recursive: true, force: true });
  await run('npx', ['expo', 'export', '--platform', 'ios', '--output-dir', 'dist'], { cwd: resolve(root, 'apps/mobile') });
}
const sport = 9200 + Math.floor(Math.random() * 400);
const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'apps/server/dist/server.mjs'], { cwd: root, env: { ...process.env, PORT: String(sport), HOST: '127.0.0.1', ODI_DB: ':memory:', ODI_TEST_STORE: '1', ODI_LOG: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
procs.push(server);
await new Promise((res, rej) => { server.stdout.on('data', (d) => { if (String(d).includes('hazır')) res(); }); server.on('exit', (c) => rej(new Error('sunucu kapandı ' + c))); setTimeout(() => rej(new Error('sunucu başlamadı')), 15_000); });
const wsUrl = `ws://127.0.0.1:${sport}`;
let webBase = '';
if (targets.includes('web')) {
  const wport = 5900 + Math.floor(Math.random() * 300);
  procs.push(spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(wport), '--strictPort', '--outDir', distDir], { cwd: resolve(root, 'apps/web'), stdio: 'ignore' }));
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://localhost:${wport}/`)).ok) break; } catch { /* henüz */ } await sleep(200); }
  webBase = `http://localhost:${wport}/`;
}
let domHtml = '';
if (targets.includes('dom')) { const dir = resolve(mobileDist, 'www.bundle'); domHtml = pathToFileURL(resolve(dir, readdirSync(dir).find((f) => f.endsWith('.html')))).href; }

// ---------------------------------------------------------------- sayfa içi yardımcılar
function paintInsets([top, bottom]) {
  const put = () => {
    if (document.getElementById('__inset_top')) return;
    const mk = (id, css) => { const d = document.createElement('div'); d.id = id; d.style.cssText = `position:fixed;left:0;right:0;z-index:2147483647;pointer-events:none;${css}`; document.documentElement.appendChild(d); };
    mk('__inset_top', `top:0;height:${top}px;background:repeating-linear-gradient(135deg,rgba(255,0,80,.22) 0 6px,rgba(255,0,80,.08) 6px 12px);border-bottom:1px dashed rgba(255,0,80,.8)`);
    mk('__inset_bottom', `bottom:0;height:${bottom}px;background:rgba(255,0,80,.12);border-top:1px dashed rgba(255,0,80,.6)`);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', put); else put();
}
/** web: köprünün güvenli alan değişkenleri + konuşma kaydı (speechSynthesis yoksa sahte) */
function webSetup([top, bottom, maleVoice]) {
  const set = () => { const de = document.documentElement; if (!de) return false; de.style.setProperty('--safe-top', `${top}px`); de.style.setProperty('--safe-bottom', `${bottom}px`); return true; };
  if (!set()) document.addEventListener('DOMContentLoaded', set);
  window.__spoken = [];
  // kayıtlı ses GERÇEK yolla çalar (indir → WebAudio decodeAudioData → ses motoru); hangi satırların kayıttan çaldığı uygulamanın günlüğünden okunur
  Object.defineProperty(window, '__played', { get: () => (window.__odiVoice?.log ?? []).filter((x) => x.mode === 'kayıt').map((x) => x.file) });
  // isteğe bağlı: cihazda erkek Türkçe ses varmış gibi (yedek TTS testi). Yoksa başsız tarayıcıda Türkçe erkek ses yoktur → sessiz kalınmalı
  if (maleVoice && window.speechSynthesis) {
    const fake = { name: 'Microsoft Tolga - Turkish (Turkey)', lang: 'tr-TR', localService: true, default: false, voiceURI: 'tolga' };
    window.SpeechSynthesis.prototype.getVoices = () => [fake];
    Object.defineProperty(window.SpeechSynthesisUtterance.prototype, 'voice', { configurable: true, get() { return null; }, set() {} });
  }
  if (typeof window.SpeechSynthesisUtterance === 'undefined') window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  const ss = window.speechSynthesis;
  // prototip üzerinden kaydet (WebKit sarmalayıcıyı yeniden kurabilir; örnek üzerindeki yama kaybolur)
  if (ss && window.SpeechSynthesis) { const P = window.SpeechSynthesis.prototype; const orig = P.speak; P.speak = function (u) { window.__spoken.push(u.text); try { orig.call(this, u); } catch { /* yok */ } }; }
  else if (ss) { const orig = ss.speak.bind(ss); ss.speak = (u) => { window.__spoken.push(u.text); try { orig(u); } catch { /* yok */ } }; }
  else Object.defineProperty(window, 'speechSynthesis', { value: { speak: (u) => window.__spoken.push(u.text), cancel() {}, getVoices: () => [] } });
}
/** dom: Expo DOM köprüsü (tohumlanmış kayıt + konuşma çağrıları kaydı) + yerel scrollEnabled:false kilidi */
function domBridge([serverUrl, top, bottom, seed, manifest]) {
  const store = { ...(seed || {}) }; window.__spoken = []; window.__speakArgs = [];
  Object.defineProperty(window, '__played', { get: () => (window.__odiVoice?.log ?? []).filter((x) => x.mode === 'kayıt').map((x) => x.file) });
  window.ReactNativeWebView = {
    injectedObjectJson: () => JSON.stringify({ EXPO_DOM_HOST_OS: 'ios', initialProps: { names: ['getItem', 'setItem', 'removeItem', 'haptic', 'share', 'speak', 'stopSpeaking', 'voiceManifest', 'voiceData', 'clearAll', 'restartApp'], props: { serverUrl, canPurchase: false, insetTop: top, insetBottom: bottom } } }),
    postMessage: (s) => {
      try {
        const m = JSON.parse(s); if (m.type !== '$$native_action') return;
        const [k, v] = m.data.args ?? []; let result = null;
        if (m.data.actionId === 'getItem') result = store[k] ?? null;
        if (m.data.actionId === 'setItem') store[k] = v;
        if (m.data.actionId === 'removeItem') delete store[k];
        const reply = (r) => setTimeout(() => window.dispatchEvent(new CustomEvent('$$dom_event', { detail: { type: '$$native_action_result', data: { uid: m.data.uid, actionId: m.data.actionId, result: r } } })), 0);
        // iPhone gibi: yalnız kadın Türkçe ses var → kabuk maleOnly isteğinde okumaz (false); çağrı yine kaydedilir
        if (m.data.actionId === 'speak') { window.__speakArgs.push(m.data.args); if (m.data.args?.[3] !== true) window.__spoken.push(k); result = false; }
        if (m.data.actionId === 'voiceManifest') result = manifest ?? null;
        // gömülü dosyanın baytları (gerçek mp3, base64) — kabuktaki expo-asset + expo-file-system okumasının yerine
        if (m.data.actionId === 'voiceData') { void window.__nativeVoice(k).then(reply, () => reply(null)); return; }
        if (m.data.actionId === 'share') result = 'copied';
        setTimeout(() => window.dispatchEvent(new CustomEvent('$$dom_event', { detail: { type: '$$native_action_result', data: { uid: m.data.uid, actionId: m.data.actionId, result } } })), 0);
      } catch { /* yok */ }
    },
  };
  const lock = () => { const st = document.createElement('style'); st.textContent = 'html{overflow:hidden!important}'; document.head.appendChild(st); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lock); else lock();
}
const TR = /[çğıöşüÇĞİÖŞÜ]/;
// gömülü anlatıcı sesleri (tools/voice/generate.mjs): uygulama bu listedeki dosyaları TTS'ye tercih etmeli
const MANIFEST = readFileSync(resolve(root, 'apps/web/public/voice/manifest.json'), 'utf8');
const VOICED = Object.keys(JSON.parse(MANIFEST).lines ?? {});
/** hikaye-01 kaydı çıkarılmış liste: o satırda cihaz sesine (TTS) düşmeli */
const MANIFEST_NO_H1 = (() => { const m = JSON.parse(MANIFEST); delete m.lines['hikaye-01']; return JSON.stringify(m); })();
const seedFor = (cleared, tours) => {
  const progress = {}; for (let i = 1; i <= cleared; i++) progress[i] = { stars: 2, best: 800, plays: 1 };
  return { 'odi-v1': JSON.stringify({ state: { progress, coins: 120 * cleared, ftue: { v: 1, story: true, tours } }, version: 3 }) };
};

// ---------------------------------------------------------------- akış
let failures = 0; const report = [];
async function suite(target, browserName, [W, H]) {
  const name = `${target}-${browserName}-${W}x${H}`;
  const dir = resolve(outRoot, name); mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (f.endsWith('.png')) rmSync(resolve(dir, f));
  const log = []; const fail = (m) => { failures++; log.push(`✗ ${m}`); console.log(`  ✗ ${name} · ${m}`); };
  const ok = (m) => { log.push(`✓ ${m}`); console.log(`  ✓ ${name} · ${m}`); };
  const check = (c, m) => (c ? ok(m) : fail(m));
  const B = browserName === 'webkit' ? webkit : chromium;
  const browser = await B.launch({ headless: true, executablePath: browserName === 'chromium' ? process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined, args: browserName === 'chromium' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] : [] });
  let n = 0; const errors = [];
  async function newPage(seed, manifestOverride, maleVoice) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 3, hasTouch: true, ...(browserName === 'chromium' ? { isMobile: true } : {}), locale: 'tr-TR', reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|AudioContext|WebGL|GPU|Autoplay|WebSocket|ERR_CONNECTION|ERR_FILE/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
    await page.addInitScript(paintInsets, [INSET, INSET_B]);
    if (target === 'dom') {
      await ctx.exposeFunction('__nativeVoice', (f) => { const p = resolve(root, 'apps/web/public/voice', String(f).replace(/[^a-z0-9.-]/gi, '')); return existsSync(p) ? readFileSync(p).toString('base64') : null; });
      await page.addInitScript(domBridge, [wsUrl, INSET, INSET_B, seed, manifestOverride ?? MANIFEST]);
    } else {
      await page.addInitScript(webSetup, [INSET, INSET_B, !!maleVoice]); if (seed) await page.addInitScript((sd) => { for (const [k, v] of Object.entries(sd)) localStorage.setItem(k, v); }, seed);
      if (manifestOverride) await page.route('**/voice/manifest.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: manifestOverride }));
    }
    return { ctx, page };
  }
  const url = (q = '') => (target === 'dom' ? domHtml + (q ? `?${q}` : '') : `${webBase}?sunucu=${encodeURIComponent(wsUrl)}&oyun-bot=1${q ? `&${q}` : ''}`);
  const shot = async (page, label) => { await sleep(300); await page.screenshot({ path: resolve(dir, `${String(++n).padStart(2, '0')}-${label}.png`) }); };
  const say = (page) => page.locator('[data-testid="anlatici"]').first().getAttribute('data-say').catch(() => null);

  /** anlatıcı turunu sonuna kadar yürüt: İleri'ye bas, bekleyen adımda parlayan halkanın ortasına dokun */
  async function driveTour(page, tourId, label, act = {}) {
    await page.locator(`[data-testid="anlatici-tur"][data-tour="${tourId}"]`).waitFor({ timeout: 40_000 });
    ok(`tur başladı: ${tourId}`);
    let last = ''; let guard = 0;
    let voiced = await page.evaluate(() => (window.__played?.length ?? 0) + (window.__spoken?.length ?? 0));
    while (await page.locator(`[data-testid="anlatici-tur"][data-tour="${tourId}"]`).count() && guard++ < 60) {
      const step = await page.locator('[data-testid="anlatici-tur"]').getAttribute('data-step').catch(() => null);
      const text = await say(page);
      if (step !== last && text) {
        last = step;
        // Tüy Dede bu satırı söylemeye başlasın (kayıtlı ses ya da TTS) — kullanıcı da dinleyip sonra ilerler
        await page.waitForFunction((n) => ((window.__played?.length ?? 0) + (window.__spoken?.length ?? 0)) > n, voiced, { timeout: 4000 }).catch(() => undefined);
        voiced = await page.evaluate(() => (window.__played?.length ?? 0) + (window.__spoken?.length ?? 0));
        await sleep(450);
        // dokunma adımı: halka yerine oturunca çek (kamp kamerası kayarken halka gizli)
        if (await page.locator('[data-testid="anlatici-ipucu"]').count()) await page.locator('.coach-ring').waitFor({ timeout: 3000 }).catch(() => undefined);
        await shot(page, `${label}-${step}`);
        if (!TR.test(text) && !/[a-z]/.test(text)) fail(`anlatıcı metni boş/yanlış (${tourId}#${step})`);
      }
      if (act[step]) { await act[step](page); act[step] = null; await sleep(600); continue; }
      const next = page.locator('[data-testid="anlatici-ileri"]');
      if (await next.count()) { await next.click().catch(() => undefined); await sleep(350); continue; }
      if (await page.locator('[data-testid="anlatici-ipucu"]').count()) {
        // halka yerine oturana kadar bekle (kamp kamerası kayarken hedef de kayar), sonra gerçek dokunuş
        let r = null;
        for (let k = 0; k < 12; k++) {
          const a = await page.locator('.coach-ring').boundingBox().catch(() => null); await sleep(150);
          const b = await page.locator('.coach-ring').boundingBox().catch(() => null);
          if (a && b && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1) { r = b; break; }
        }
        if (r) { await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2 + 6); await sleep(900); continue; }
      }
      await sleep(400);
    }
    check(!(await page.locator(`[data-testid="anlatici-tur"][data-tour="${tourId}"]`).count()), `tur bitti: ${tourId}`);
  }
  async function nickname(page) {
    for (let i = 0; i < 20; i++) {
      if (await page.locator('.onboard').count()) {
        await page.getByRole('textbox', { name: 'Takma ad' }).fill(`Yeni${browserName.slice(0, 2)}${W}`.slice(0, 16));
        await page.getByRole('button', { name: 'Başla' }).click(); await page.locator('.onboard').waitFor({ state: 'detached' }); return;
      }
      if (await page.locator('[data-testid="anlatici-tur"]').count()) return;
      await sleep(300);
    }
  }
  async function dismissCel(page) {
    for (let i = 0; i < 12 && await page.locator('.cel-stage').count(); i++) {
      const b = page.locator('.cel-cta .btn'); if (await b.count()) await b.click().catch(() => undefined); else await page.locator('.cel-stage').click().catch(() => undefined);
      await sleep(500);
    }
  }
  /** sırada bekleyen anlatıcı turlarını (hangisi gelirse) sonuna kadar yürüt; gelen tur kimliklerini döndür */
  async function drainTours(page, label) {
    const seen = [];
    for (let k = 0; k < 12; k++) {
      const t = page.locator('[data-testid="anlatici-tur"]').first();
      try { await t.waitFor({ timeout: 5000 }); } catch { break; }
      const id = await t.getAttribute('data-tour');
      if (!id) break;
      seen.push(id); await driveTour(page, id, `${label}-${id}`);
      await dismissCel(page);
      // tur bir alt sayfa/panel açık bıraktıysa kapat (Görevler paneli vb.)
      if (await page.locator('.sheet-wrap, [data-testid="kg-panel"]').count()) { await page.keyboard.press('Escape').catch(() => undefined); await sleep(400); }
    }
    return seen;
  }
  /** tur bir alt ekranda bıraktıysa (ör. Sıralama) Geri ile sekmelere dön, sonra haritaya geç */
  async function toMap(page) {
    for (let i = 0; i < 4 && !(await page.locator('nav.tabbar').isVisible().catch(() => false)); i++) { await page.getByRole('button', { name: 'Geri' }).first().click().catch(() => undefined); await sleep(500); }
    await page.locator('nav.tabbar .tab[data-tab="map"]').click(); await page.locator('.map-play').waitFor({ timeout: 20_000 });
  }
  const lockedTabs = (page) => page.locator('nav.tabbar .tab.locked').evaluateAll((els) => els.map((e) => e.getAttribute('data-tab')));
  async function playFromMap(page, lv) {
    await page.locator('.map-play').click();
    if (await page.getByRole('button', { name: /Haydi/ }).count()) await page.getByRole('button', { name: /Haydi/ }).click();
    await waitResult(page, lv);
  }
  async function waitResult(page, lv) {
    for (let i = 0; i < 400 && !(await page.locator('.result-actions').count()); i++) {
      const h = page.getByRole('button', { name: /Haydi/ }); if (await h.count()) await h.click().catch(() => undefined);
      await sleep(500);
    }
    await page.locator('.result-actions').waitFor({ timeout: 5000 });
    const won = await page.locator('.result-screen:not(.lost)').count();
    if (!won) { fail(`${lv}. bölüm kaybedildi (bot) — tekrar`); }
    else ok(`${lv}. bölüm geçildi (bot)`);
    return !!won;
  }

  try {
    if (target === 'web') {
      const { page, ctx } = await newPage();
      // ---- 1 · açılış + hikâye
      await page.goto(url(), { waitUntil: 'load' });
      await page.getByRole('button', { name: /Yola çık/ }).waitFor({ timeout: 45_000 }); await shot(page, 'acilis');
      await page.getByRole('button', { name: /Yola çık/ }).click();
      await page.locator('[data-testid="hikaye"]').waitFor();
      for (let i = 0; i < 7; i++) {
        await page.locator(`[data-testid="hikaye"][data-step="${i}"]`).waitFor(); await sleep(500);
        const t = await say(page); check(!!t && TR.test(t), `hikâye ${i + 1}/7: “${(t ?? '').slice(0, 48)}…”`);
        await shot(page, `hikaye-${i + 1}`);
        await page.locator('[data-testid="anlatici-ileri"]').click(); await sleep(200);
        if (await page.locator(`[data-testid="hikaye"][data-step="${i}"]`).count()) await page.locator('[data-testid="anlatici-ileri"]').click();
      }
      check(!(await page.locator('nav.tabbar').count()), 'hikâyeden sonra sekme yok: tek giriş 1. bölüm');
      // ---- 2 · 1. bölüm (biyom tanıtımı → bot)
      await page.getByRole('button', { name: /Haydi/ }).waitFor({ timeout: 20_000 }); await shot(page, 'biyom-tanitimi');
      check(await page.locator('.biome-intro [data-testid="tuy-notu"]').count() === 1, `biyom tanıtımında Tüy Dede'nin Notu: ${await page.locator('[data-testid="tuy-notu"]').getAttribute('data-note').catch(() => '-')}`);
      await page.getByRole('button', { name: /Haydi/ }).click();
      await page.waitForFunction(() => window.__odi?.events?.some((e) => e.type === 'started'), null, { timeout: 30_000 }); await sleep(800); await shot(page, 'bolum-1');
      await waitResult(page, 1);
      check(await page.locator('.result-actions [data-act="meydan"][disabled]').count() === 1, 'sonuç: Meydan oku kilitli (Bölüm 8)');
      await driveTour(page, 'result1', 'sonuc-turu');
      // ---- 3 · harita turu
      await page.locator('.map-play').waitFor({ timeout: 20_000 }); await nickname(page);
      const l1 = await lockedTabs(page); check(['today', 'camp', 'team'].every((t) => l1.includes(t)), `harita: kilitli sekmeler ${l1.join(', ')}`);
      check(!(await page.locator('[data-testid="ev-fab"]').count()), 'harita: Etkinlik çadırı henüz yok');
      await driveTour(page, 'map', 'harita-turu');
      // map turunun son adımı 2. bölümü başlatır
      if (await page.getByRole('button', { name: /Haydi/ }).count()) await page.getByRole('button', { name: /Haydi/ }).click();
      await waitResult(page, 2);
      await page.locator('.result-actions [data-act="harita"]').click();
      // ---- 4 · Bugün açılır
      await driveTour(page, 'today', 'bugun-turu');
      await dismissCel(page);
      check(!(await lockedTabs(page)).includes('today'), 'Bugün sekmesi açıldı');
      check(await page.locator('.cal-today .btn:disabled').count() === 1, 'takvim ödülü alındı (gerçek eylem)');
      // ---- 5 · 3. bölüm → Kamp
      await page.locator('nav.tabbar .tab[data-tab="map"]').click(); await page.locator('.map-play').waitFor();
      await playFromMap(page, 3);
      await page.locator('.result-actions [data-act="harita"]').click();
      await driveTour(page, 'camp', 'kamp-acilis');
      await page.locator('.camp-base').waitFor({ timeout: 20_000 });
      await driveTour(page, 'camp-build', 'kamp-ogretici', {
        // tuval içindeki binaya dokun (halkanın ortası binadır)
      });
      check(await page.locator('.bp-build').count() === 1, 'kamp: gerçek inşaat başladı');
      await page.getByRole('button', { name: 'Kapat' }).first().click().catch(() => undefined);
      // ---- 6 · 4. ve 5. bölüm → Arkadaşlar, Takım
      await page.locator('nav.tabbar .tab[data-tab="map"]').click(); await page.locator('.map-play').waitFor();
      await playFromMap(page, 4); await page.locator('.result-actions [data-act="harita"]').click();
      await driveTour(page, 'friends', 'arkadaslar-turu');
      // Kulak Sözlüğü (4. bölümden sonra, arkadaşlardan hemen sonra): kutucuğa dokun → sözlük açılır → ilk terim
      await driveTour(page, 'glossary', 'sozluk-turu');
      check(await page.locator('[data-testid="sozluk"] .gl-term').count() >= 5, `Kulak Sözlüğü açıldı (${await page.locator('[data-testid="sozluk"] .gl-term').count()} terim)`);
      check(await page.locator('[data-testid="sozluk"] .gl-region.locked').count() >= 5, 'ulaşılmamış bölgelerin terimleri kilitli');
      await page.locator('[data-testid="sozluk"] .gl-term .ml-btn').first().click(); await sleep(300); await shot(page, 'sozluk-daha-fazla');
      check(await page.locator('[data-testid="sozluk"] .ml-tech').count() >= 1, 'Daha fazla: teknik tanım açıldı');
      await page.getByRole('button', { name: 'Geri' }).first().click();
      await page.locator('nav.tabbar .tab[data-tab="map"]').click(); await page.locator('.map-play').waitFor();
      check((await lockedTabs(page)).includes('team'), 'Takım hâlâ kilitli (Bölüm 5)');
      await playFromMap(page, 5); await page.locator('.result-actions [data-act="harita"]').click();
      await driveTour(page, 'team', 'takim-turu');
      check(!(await lockedTabs(page)).length, 'bütün sekmeler açık');
      // ---- 7 · 6–10. bölüm: her açılım tek tek, anlatıcı yükü ölçülür (yalnız Chromium; WebKit aynı turları 1–5'te denetler)
      if (browserName === 'chromium') {
        const perLevel = { 5: await drainTours(page, 'b5') };
        for (let lv = 6; lv <= 10; lv++) {
          await toMap(page);
          await playFromMap(page, lv); await page.locator('.result-actions [data-act="harita"]').click();
          await dismissCel(page);
          perLevel[lv] = await drainTours(page, `b${lv}`);
        }
        // kamp turları yalnız kampta başlar
        await toMap(page); await page.locator('nav.tabbar .tab[data-tab="camp"]').click(); await sleep(1500); await dismissCel(page);
        perLevel.kamp = await drainTours(page, 'kamp');
        ok(`anlatıcı turları (bölüm → turlar): ${Object.entries(perLevel).map(([k, v]) => `${k}: ${v.join('+') || '-'}`).join(' · ')}`);
        const most = Math.max(...Object.values(perLevel).map((v) => v.length));
        ok(`bir bölümde en çok ${most} tur art arda`);
        const tours = await page.evaluate(() => JSON.parse(localStorage.getItem('odi-v1') ?? '{}').state?.ftue?.tours ?? []);
        const want = ['siralama', 'tlig', 'shop', 'akis', 'events', 'race', 'yazi', 'tyaris', 'soru', 'ikili', 'gorev', 'kampoyun', 'vaka'];
        const miss = want.filter((t) => !tours.includes(t));
        check(!miss.length, `10. bölüme kadar bütün açılım turları görüldü${miss.length ? `; eksik: ${miss.join(', ')}` : ''}`);
        check(!(await page.locator('[data-testid="anlatici-tur"]').count()), '10. bölümden sonra bekleyen tur kalmadı');
      }
      const played = await page.evaluate(() => window.__played ?? []);
      const spoken = await page.evaluate(() => window.__spoken ?? []);
      const need = ['hikaye-01.mp3', 'sonuc-01.mp3', 'kamp-insa-02-depo.mp3', 'sozluk-03.mp3', 'takim-03.mp3'].filter((f) => !played.includes(f));
      check(played.some((f) => f.startsWith('not-')), `Tüy Dede'nin Notu seslendirildi (${played.filter((f) => f.startsWith('not-')).join(', ')})`);
      check(VOICED.length >= 30 && played.length >= 25 && !need.length, `gömülü Tüy Dede sesi çalındı (${played.length} satır${need.length ? `; eksik: ${need.join(', ')}` : ''}; çalınanlar: ${played.join(' ')})`);
      check(spoken.length === 0, `kaydı olan satırlarda cihaz sesi (TTS) kullanılmadı (${spoken.length})`);
      const vs = await page.evaluate(() => window.__odiVoice.status());
      check(vs.decoded >= 20 && vs.source === 'indirme', `WebAudio gerçek çözüm: ${vs.decoded} kayıt çözüldü (kaynak: ${vs.source}; son hata: ${vs.error ?? '-'})`);
      // dosyalar gerçekten sunuluyor ve tarayıcı çözebiliyor mu
      const probe = await page.evaluate(async () => { const a = new Audio('voice/hikaye-01.mp3'); const r = await new Promise((res) => { a.oncanplaythrough = () => res('ok'); a.onerror = () => res(`hata ${a.error?.code}`); setTimeout(() => res('zaman aşımı'), 8000); a.load(); }); return { r, dur: a.duration }; });
      const resp = await page.request.get(new URL('voice/hikaye-01.mp3', page.url()).href);
      check(resp.ok() && /audio\/mpeg/.test(resp.headers()['content-type'] ?? '') && (await resp.body()).length > 4000, `voice/hikaye-01.mp3 sunuluyor (${resp.status()}, ${resp.headers()['content-type']}); tarayıcı çözümü: ${probe.r}${probe.dur ? ` ${probe.dur.toFixed(1)} sn` : ''}`);
      await ctx.close();
      // yedek 1: kaydı olmayan satır + cihazda erkek Türkçe ses yok → SESSİZ (kadın sesle asla konuşmaz), altyazı ekranda
      { const { page: p2, ctx: c2 } = await newPage(undefined, MANIFEST_NO_H1);
        await p2.goto(url(), { waitUntil: 'load' }); await p2.getByRole('button', { name: /Yola çık/ }).click({ timeout: 45_000 });
        await p2.locator('[data-testid="hikaye"][data-step="0"]').waitFor(); await sleep(1500);
        const sp = await p2.evaluate(() => window.__spoken ?? []); const st = await p2.evaluate(() => window.__odiVoice.status());
        check(!sp.length && st.mode === 'sessiz' && st.line === 'hikaye-01', `kaydı olmayan satır, erkek ses yokken sessiz kaldı (durum: ${st.mode}, TTS: ${sp.length})`);
        await c2.close(); }
      // yedek 2: cihazda erkek Türkçe ses varsa o okur
      { const { page: p2, ctx: c2 } = await newPage(undefined, MANIFEST_NO_H1, true);
        await p2.goto(url(), { waitUntil: 'load' }); await p2.getByRole('button', { name: /Yola çık/ }).click({ timeout: 45_000 });
        await p2.locator('[data-testid="hikaye"][data-step="0"]').waitFor(); await sleep(1500);
        const sp = await p2.evaluate(() => window.__spoken ?? []);
        check(sp.some((t) => /Tüy Dede/.test(t)), `erkek Türkçe ses varken kaydı olmayan satır onunla okundu (“${(sp[0] ?? '').slice(0, 30)}…”)`);
        await c2.close(); }
    } else {
      // ---- dom: kontrol noktaları (telefon paketi: bot yok)
      { const { page, ctx } = await newPage();
        await page.goto(url(), { waitUntil: 'load' });
        await page.getByRole('button', { name: /Yola çık/ }).click({ timeout: 45_000 });
        for (let i = 0; i < 7; i++) {
          await page.locator(`[data-testid="hikaye"][data-step="${i}"]`).waitFor(); await sleep(450);
          if (i === 0 || i === 3 || i === 6) await shot(page, `hikaye-${i + 1}`);
          await page.locator('[data-testid="anlatici-ileri"]').click(); await sleep(150);
          if (await page.locator(`[data-testid="hikaye"][data-step="${i}"]`).count()) await page.locator('[data-testid="anlatici-ileri"]').click();
        }
        await page.getByRole('button', { name: /Haydi/ }).click({ timeout: 20_000 });
        await page.waitForFunction(() => !!document.querySelector('canvas'), null, { timeout: 30_000 }); await sleep(1200); await shot(page, 'bolum-1');
        const played = await page.evaluate(() => window.__played ?? []); const speakArgs = await page.evaluate(() => window.__speakArgs ?? []);
        const vs = await page.evaluate(() => window.__odiVoice.status());
        check(played.length >= 7 && played[0] === 'hikaye-01.mp3' && speakArgs.length === 0 && vs.source === 'köprü' && vs.decoded >= 7, `köprüden gelen gerçek mp3 baytları WebView'de WebAudio ile çözülüp çalındı: ${played.slice(0, 7).join(', ')} (çözülen ${vs.decoded}; TTS çağrısı ${speakArgs.length}; hata: ${vs.error ?? '-'})`);
        await ctx.close(); }
      { const { page, ctx } = await newPage(undefined, MANIFEST_NO_H1);
        await page.goto(url(), { waitUntil: 'load' }); await page.getByRole('button', { name: /Yola çık/ }).click({ timeout: 45_000 });
        await page.locator('[data-testid="hikaye"][data-step="0"]').waitFor(); await sleep(1200);
        const args = await page.evaluate(() => window.__speakArgs ?? []); const st = await page.evaluate(() => window.__odiVoice.status());
        check(args.length >= 1 && /Tüy Dede/.test(args[0][0]) && args.every((a) => a[3] === true) && st.mode === 'sessiz', `kaydı olmayan satırda kabuğa yalnız-erkek-ses isteği gitti; erkek ses yok → sessiz (durum: ${st.mode})`);
        await ctx.close(); }
      // telefon paketi: sesler Metro varlığı olarak gömülü mü (expo export metadata)
      { const meta = JSON.parse(readFileSync(resolve(mobileDist, 'metadata.json'), 'utf8'));
        const assets = Object.values(meta.fileMetadata ?? {}).flatMap((p) => p.assets ?? []);
        const mp3 = assets.filter((a) => a.ext === 'mp3').length;
        check(mp3 >= VOICED.length, `telefon paketinde gömülü ses dosyası: ${mp3} / ${VOICED.length}`); }
      const points = [
        { cleared: 1, tours: ['result1'], tour: 'map', label: 'harita-turu' },
        { cleared: 2, tours: ['result1', 'map'], tour: 'today', label: 'bugun-turu' },
        { cleared: 3, tours: ['result1', 'map', 'today'], tour: 'camp', label: 'kamp-acilis', then: 'camp-build' },
        { cleared: 5, tours: ['result1', 'map', 'today', 'camp', 'camp-build', 'friends', 'glossary'], tour: 'team', label: 'takim-turu' },
      ];
      for (const pt of points) {
        const { page, ctx } = await newPage(seedFor(pt.cleared, pt.tours));
        await page.goto(url(), { waitUntil: 'load' });
        await page.getByRole('button', { name: /Devam et/ }).click({ timeout: 45_000 });
        await page.locator('nav.tabbar').waitFor({ timeout: 20_000 }); await nickname(page);
        const lk = await lockedTabs(page); ok(`${pt.cleared} bölüm: kilitli ${lk.join(', ') || 'yok'}`);
        await driveTour(page, pt.tour, pt.label);
        if (pt.then) { await page.locator('.camp-base').waitFor({ timeout: 20_000 }); await driveTour(page, pt.then, 'kamp-ogretici'); check(await page.locator('.bp-build').count() === 1, 'kamp: gerçek inşaat başladı'); }
        await ctx.close();
      }
    }
  } catch (e) {
    fail(`akış: ${String(e.message ?? e).split('\n')[0]}`);
  }
  if (errors.length) fail(`konsol: ${errors.slice(0, 3).join(' | ')}`);
  report.push({ run: name, log });
  await browser.close();
}

try {
  for (const t of targets) for (const b of browsers) for (const s of sizes) {
    if (t === 'dom' && s[0] !== sizes[0][0] && b === 'webkit') continue; // telefon paketi: WebKit tek boyut yeter
    console.log(`\n▶ ${t} · ${b} · ${s.join('×')}`); await suite(t, b, s);
  }
} finally { writeFileSync(resolve(outRoot, 'rapor.json'), JSON.stringify(report, null, 2)); cleanup(); }
console.log(`\n${failures ? '✗' : '✓'} ilk deneyim uçtan uca: ${failures} sorun · çıktı: tools/harness/out/onboarding`);
process.exit(failures ? 1 : 0);
