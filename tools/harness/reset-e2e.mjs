#!/usr/bin/env node
// Sıfırla uçtan uca: birkaç bölüm oyna, takma ad al, takım kur → Ayarlar › Sıfırla (uygulama içi onay) → her şey silinir,
// arayüz baştan kurulur → yepyeni oyuncu: açılış "Yola çık", hikâye baştan, ilerleme/jeton/rehber/ayar yok, oyuncu kimliği yeni.
// Hedefler: web (tarayıcı: localStorage + location.reload) ve dom (Expo DOM köprüsü: kabukta AsyncStorage.clear + WebView'i
// baştan kurma; kabuk deposu Node tarafında tutulur ki "yeniden kurma" sonrası da yaşasın).
// Kullanım: node tools/harness/reset-e2e.mjs [--target web|dom|both] [--browser chromium|webkit] [--no-build] [--build-dom]
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, webkit } from 'playwright';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '1'; };
const has = (k) => argv.includes(`--${k}`);
const root = resolve(new URL('../..', import.meta.url).pathname);
const targets = opt('target', 'both') === 'both' ? ['web', 'dom'] : [opt('target')];
const browserName = opt('browser', 'chromium');
const outDir = resolve(root, 'tools/harness/out/sifirla'); mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (f.endsWith('.png')) rmSync(resolve(outDir, f));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = [];
const cleanup = () => { for (const p of procs) { try { p.kill(); } catch { /* yok */ } } };
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { cleanup(); process.exit(130); });
const run = (cmd, a, o = {}) => new Promise((res, rej) => { const p = spawn(cmd, a, { cwd: root, stdio: 'inherit', ...o }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${a.join(' ')} → ${c}`)))); });
let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { failures++; console.log(`  ✗ ${m}`); };
const check = (c, m) => (c ? ok(m) : fail(m));

// ---------------------------------------------------------------- derleme + sunucu
const distDir = resolve(outDir, 'dist');
if (targets.includes('web') && (!has('no-build') || !existsSync(resolve(distDir, 'index.html')))) {
  await run('npx', ['vite', 'build', '--outDir', distDir, '--emptyOutDir', '--logLevel', 'warn'], { cwd: resolve(root, 'apps/web'), env: { ...process.env, VITE_ODI_E2E: '1' } });
}
if (!existsSync(resolve(root, 'apps/server/dist/server.mjs')) || !has('no-build')) await run('npm', ['run', 'build:server', '--silent']);
const mobileDist = resolve(root, 'apps/mobile/dist');
if (targets.includes('dom') && (has('build-dom') || !existsSync(resolve(mobileDist, 'www.bundle')))) {
  rmSync(mobileDist, { recursive: true, force: true });
  await run('npx', ['expo', 'export', '--platform', 'ios', '--output-dir', 'dist'], { cwd: resolve(root, 'apps/mobile') });
}
const sport = 9600 + Math.floor(Math.random() * 300);
const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'apps/server/dist/server.mjs'], { cwd: root, env: { ...process.env, PORT: String(sport), HOST: '127.0.0.1', ODI_DB: ':memory:', ODI_TEST_STORE: '1', ODI_LOG: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
procs.push(server);
await new Promise((res, rej) => { server.stdout.on('data', (d) => { if (String(d).includes('hazır')) res(); }); server.on('exit', (c) => rej(new Error('sunucu kapandı ' + c))); setTimeout(() => rej(new Error('sunucu başlamadı')), 15_000); });
const wsUrl = `ws://127.0.0.1:${sport}`;
/** sunucuya ayrı bir oyuncu olarak bağlan ve takım listesini al (sunucu tarafı doğrulama; Node 22 yerleşik WebSocket) */
async function serverTeams(query) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map(); let id = 0;
  ws.addEventListener('message', (m) => { const d = JSON.parse(String(m.data)); if (d.t === 'res') pending.get(d.id)?.(d); });
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  const call = (op, data) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ t: 'req', id: n, op, data })); });
  await call('hello', { version: 1, name: 'Denetçi' });
  const res = await call('team.list', { query });
  ws.close();
  return res.ok ? res.data.teams.map((t) => t.name) : null;
}
let webBase = '';
if (targets.includes('web')) {
  const wport = 6300 + Math.floor(Math.random() * 300);
  procs.push(spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(wport), '--strictPort', '--outDir', distDir], { cwd: resolve(root, 'apps/web'), stdio: 'ignore' }));
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://localhost:${wport}/`)).ok) break; } catch { /* henüz */ } await sleep(200); }
  webBase = `http://localhost:${wport}/?sunucu=${encodeURIComponent(wsUrl)}&oyun-bot=1`;
}
let domHtml = '';
if (targets.includes('dom')) { const dir = resolve(mobileDist, 'www.bundle'); domHtml = pathToFileURL(resolve(dir, readdirSync(dir).find((f) => f.endsWith('.html')))).href; }

// rehber atlanmış başlangıç (takım hemen açılsın); sıfırlamadan SONRA bu kayıt olmamalı
const BYPASS = JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true }, knowledge: 'odyoloji', narratorVoice: false }, version: 3 });

/** dom: kabuk köprüsü; depo Node'da (window yenilense de yaşar), clearAll/restartApp Node'a gider */
function domBridge([serverUrl]) {
  window.ReactNativeWebView = {
    injectedObjectJson: () => JSON.stringify({ EXPO_DOM_HOST_OS: 'ios', initialProps: { names: ['getItem', 'setItem', 'removeItem', 'haptic', 'share', 'speak', 'stopSpeaking', 'voiceManifest', 'voiceData', 'clearAll', 'restartApp'], props: { serverUrl, canPurchase: false, insetTop: 47, insetBottom: 34 } } }),
    postMessage: (s) => {
      try {
        const m = JSON.parse(s); if (m.type !== '$$native_action') return;
        const [k, v] = m.data.args ?? [];
        const reply = (r) => setTimeout(() => window.dispatchEvent(new CustomEvent('$$dom_event', { detail: { type: '$$native_action_result', data: { uid: m.data.uid, actionId: m.data.actionId, result: r ?? null } } })), 0);
        const a = m.data.actionId;
        const p = a === 'getItem' ? window.__nGet(k) : a === 'setItem' ? window.__nSet(k, v) : a === 'removeItem' ? window.__nDel(k) : a === 'clearAll' ? window.__nClear() : a === 'restartApp' ? window.__nRestart() : Promise.resolve(a === 'share' ? 'copied' : a === 'speak' ? false : null);
        void Promise.resolve(p).then(reply, () => reply(null));
      } catch { /* yok */ }
    },
  };
  const lock = () => { const st = document.createElement('style'); st.textContent = 'html{overflow:hidden!important}'; document.head.appendChild(st); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lock); else lock();
}

async function suite(target) {
  console.log(`\n▶ ${target} · ${browserName}`);
  const B = browserName === 'webkit' ? webkit : chromium;
  const browser = await B.launch({ headless: true, executablePath: browserName === 'chromium' ? process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined, args: browserName === 'chromium' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] : [] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, ...(browserName === 'chromium' ? { isMobile: true } : {}), locale: 'tr-TR', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let n = 0; const shot = async (label) => { await sleep(300); await page.screenshot({ path: resolve(outDir, `${target}-${String(++n).padStart(2, '0')}-${label}.png`) }); };
  // kabuk deposu (yalnız dom)
  const native = new Map(); let restarts = 0; let clears = 0;
  if (target === 'dom') {
    await ctx.exposeFunction('__nGet', (k) => native.get(k) ?? null);
    await ctx.exposeFunction('__nSet', (k, v) => { native.set(k, v); return null; });
    await ctx.exposeFunction('__nDel', (k) => { native.delete(k); return null; });
    await ctx.exposeFunction('__nClear', () => { clears++; native.clear(); return null; });
    await ctx.exposeFunction('__nRestart', () => { restarts++; setTimeout(() => { void page.reload({ waitUntil: 'load' }).catch(() => undefined); }, 30); return null; });
    await page.addInitScript(domBridge, [wsUrl]);
    native.set('odi-v1', BYPASS);
  }
  const url = target === 'dom' ? domHtml : webBase;
  const toastGone = async () => { for (let i = 0; i < 12 && await page.locator('.toast-top').count(); i++) { await page.locator('.toast-top').first().click({ timeout: 600 }).catch(() => undefined); await sleep(200); } };
  const nickname = async (name) => {
    for (let i = 0; i < 40; i++) {
      if (await page.locator('.onboard').count()) { await page.getByRole('textbox', { name: 'Takma ad' }).fill(name); await page.getByRole('button', { name: 'Başla' }).click(); await page.locator('.onboard').waitFor({ state: 'detached' }); return true; }
      await sleep(300);
    }
    return false;
  };
  const storage = async () => (target === 'dom' ? Object.fromEntries(native) : await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]))));
  try {
    // web: rehber atlanmış kayıt uygulama açılmadan yazılır. (Önceden yüklemeden SONRA yazılıp sayfa yenileniyordu: uygulamanın
    // açılıştaki kendi kalıcı yazması — ör. bağlanınca kuyruk/jeton aynası — araya girip kaydı ezebiliyor, sayfa hikâyeyle açılıyordu.)
    // window.name yalnız ilk açılışta tohumlar; Sıfırla'dan sonraki yeniden yükleme tohumlanmaz.
    if (target === 'web') await page.addInitScript((sd) => { if (window.name !== 'odi-tohum') { window.name = 'odi-tohum'; localStorage.setItem('odi-v1', sd); } }, BYPASS);
    await page.goto(url, { waitUntil: 'load' });
    // WebView/tarayıcının kendi önbellekleri de (kamp görünümü vb.) silinmeli
    await page.evaluate(() => { localStorage.setItem('odi.kamp.gorunum', 'liste'); sessionStorage.setItem('odi-test', '1'); });
    await page.getByRole('button', { name: /Yola çık|Devam et/ }).first().click({ timeout: 45_000 });
    await page.locator('nav.tabbar').waitFor({ timeout: 20_000 });
    check(await nickname('Sıfırcı'), 'takma ad alındı');
    if (target === 'web') {
      // iki bölüm oyna (bot)
      for (const lv of [1, 2]) {
        await page.locator('.map-play').click();
        for (let i = 0; i < 400 && !(await page.locator('.result-actions').count()); i++) { const h = page.getByRole('button', { name: /Haydi/ }); if (await h.count()) await h.click().catch(() => undefined); await sleep(500); }
        await page.locator('.result-actions').waitFor({ timeout: 5000 });
        ok(`${lv}. bölüm oynandı`);
        await page.locator('.result-actions [data-act="harita"]').click();
        await page.locator('.map-play').waitFor({ timeout: 20_000 });
      }
    }
    await toastGone();
    // takım kur
    await page.locator('nav.tabbar .tab[data-tab="team"]').click();
    await page.locator('.team-hero').waitFor({ timeout: 20_000 });
    await page.getByRole('button', { name: '＋ Takım kur' }).first().click();
    await page.locator('.sheet').getByPlaceholder('ör. Koklea Kaşifleri').fill(`Sıfır ${target === 'dom' ? 'Telefon' : 'Web'}`);
    await page.locator('.sheet').getByRole('button', { name: /Takımı kur/ }).click();
    await page.locator('.team-head').waitFor({ timeout: 20_000 });
    ok('takım kuruldu');
    const teamName = `Sıfır ${target === 'dom' ? 'Telefon' : 'Web'}`;
    check((await serverTeams(teamName))?.includes(teamName), 'sunucuda takım listede');
    await toastGone(); await shot('takim');
    const before = await storage();
    const tokenBefore = before['odi.net.token'];
    const st0 = JSON.parse(before['odi-v1'] ?? '{}').state ?? {};
    check(!!tokenBefore && Object.keys(before).length >= 3 && (target === 'dom' || Object.keys(st0.progress ?? {}).length >= 2), `sıfırlamadan önce kayıt dolu (${Object.keys(before).join(', ')})`);
    // Ayarlar › Sıfırla (uygulama içi onay; window.confirm WebView'de çalışmaz)
    await page.locator('nav.tabbar .tab[data-tab="profile"]').click();
    await page.locator('.menu-tile[data-tile="settings"]').click();
    await page.locator('[data-testid="sifirla"]').click();
    await page.locator('[data-testid="sifirla-onay"]').waitFor();
    await shot('onay');
    const reloaded = page.waitForEvent('load', { timeout: 30_000 });
    await page.locator('[data-testid="sifirla-evet"]').click();
    await reloaded; ok(target === 'dom' ? 'WebView baştan kuruldu (restartApp)' : 'sayfa baştan yüklendi');
    // ---- yepyeni oyuncu
    await page.getByRole('button', { name: /Yola çık/ }).waitFor({ timeout: 30_000 });
    check(!(await page.getByRole('button', { name: /Devam et/ }).count()), 'açılış: “Yola çık” (kayıtlı ilerleme yok)');
    await shot('acilis');
    await sleep(1500);
    const after = await storage();
    const st = JSON.parse(after['odi-v1'] ?? '{}').state ?? {};
    // jeton: yeni hesabın sunucudaki başlangıç cüzdanı (100) yansıyabilir; eski ilerlemeden gelen jeton olmamalı
    check(!Object.keys(st.progress ?? {}).length && !((st.coins ?? 0) > 100) && !st.ftue?.story && !st.ftue?.bypass && (st.knowledge ?? 'genel') === 'genel' && st.narratorVoice !== false, `ana kayıt sıfır: ilerleme, jeton, rehber, ayarlar (${JSON.stringify({ p: Object.keys(st.progress ?? {}).length, c: st.coins ?? 0, f: st.ftue ?? null, k: st.knowledge ?? null })})`);
    const emptyList = (v) => !v || (Array.isArray(JSON.parse(v)) && !JSON.parse(v).length);
    check(!after['odi-map-seen'] && emptyList(after['odi.net.queue']) && emptyList(after['odi.net.outbox']), `harita kaydı silindi, ağ kuyrukları boş (${['odi-map-seen', 'odi.net.queue', 'odi.net.outbox'].map((k) => `${k}=${after[k] ?? '-'}`).join(' ')})`);
    // sunucudaki hesap da silindi (account.delete): tek üyeli takım kalmadı
    check(Array.isArray(await serverTeams(teamName)) && !(await serverTeams(teamName)).includes(teamName), 'sunucudaki hesap silindi: eski takım listede yok');
    check(after['odi.net.token'] !== tokenBefore, `oyuncu kimliği silindi (önceki jeton ${after['odi.net.token'] ? 'yerine yenisi geldi' : 'yok'})`);
    const webStores = await page.evaluate(() => ({ ls: Object.keys(localStorage).filter((k) => k !== 'odi-v1'), ss: sessionStorage.length }));
    check(target === 'web' ? !webStores.ls.includes('odi.kamp.gorunum') && webStores.ss === 0 : webStores.ls.length === 0 && webStores.ss === 0, `${target === 'dom' ? 'WebView' : 'tarayıcı'} depoları temiz (${JSON.stringify(webStores)})`);
    if (target === 'dom') check(clears >= 1 && restarts === 1, `kabukta AsyncStorage.clear (${clears}) ve WebView yeniden kurma (${restarts})`);
    // hikâye baştan
    await page.getByRole('button', { name: /Yola çık/ }).click();
    await page.locator('[data-testid="hikaye"][data-step="0"]').waitFor({ timeout: 20_000 });
    ok('hikâye baştan başladı'); await shot('hikaye');
    // takım yok (yeni oyuncu): takma ad yeniden istenir
    await page.getByRole('button', { name: 'Atla' }).first().click();
    await sleep(1200);
  } catch (e) { fail(`akış: ${String(e.message ?? e).split('\n')[0]}`); await page.screenshot({ path: resolve(outDir, `${target}-hata.png`) }).catch(() => undefined); }
  const errs = errors.filter((e) => !/WebSocket|AudioContext/i.test(e));
  if (errs.length) fail(`sayfa hatası: ${errs.slice(0, 2).join(' | ')}`);
  await browser.close();
}

try { for (const t of targets) await suite(t); } finally { cleanup(); }
console.log(`\n${failures ? '✗' : '✓'} sıfırla uçtan uca: ${failures} sorun · çıktı: tools/harness/out/sifirla`);
process.exit(failures ? 1 : 0);
