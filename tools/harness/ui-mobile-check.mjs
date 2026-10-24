#!/usr/bin/env node
// ODİ mobil kabuk denetimi (iPhone / Expo Go koşulları): her sekme ve alt sayfa için
//   · ekran görüntüsü (çentik ve ana çizgi alanı yarı saydam bantla işaretli),
//   · dokunmatik kaydırma (Chromium: CDP dokunma hareketi, WebKit: tekerlek) → kaydırma konumu değişmeli,
//   · yatay taşma: her öğenin sağ kenarı görünüm genişliği içinde (html/body/#root/.screen kırpması sayılmaz),
//   · sohbet giriş kutusu alt sekme çubuğunun üstünde ve görünür,
//   · üst güvenli alan (varsayılan 47 px): üst çubuk / ekran başlığı / sonuç üst satırı / alt sayfa çentiğin altında.
// Hedefler:
//   web — apps/web derlemesi (vite preview); güvenli alan payları köprünün yaptığı gibi --safe-top/--safe-bottom ile verilir.
//   dom — Expo DOM paketi (apps/mobile/dist/www.bundle): gerçek WebApp köprüsü (insetTop/insetBottom prop'ları),
//         Expo'nun kendi sayfa iskeleti (viewport-fit yok, #root flex) ve yerel WebView'in scrollEnabled:false kilidi
//         (belge kaydırılamaz) taklit edilir — telefondaki koşulların aynısı.
// Kullanım: node tools/harness/ui-mobile-check.mjs [--target web|dom|both] [--browsers chromium,webkit]
//           [--sizes 390x844,320x640] [--tag after] [--no-build] [--build-dom] [--inset 47] [--only bugun,profil,kamp,takim,iletisim,etkinlik,sonuc,gorev]
// Çıktı: tools/harness/out/ui-mobile/<tag>/<hedef>-<tarayıcı>-<GxY>/NN-ad.png + rapor.json
import { randomBytes, scryptSync } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, webkit } from 'playwright';
import { measureHudFit } from './hud-fit.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '1'; };
const has = (k) => argv.includes(`--${k}`);
const root = resolve(new URL('../..', import.meta.url).pathname);
const tag = opt('tag', 'after');
const targets = opt('target', 'both') === 'both' ? ['web', 'dom'] : [opt('target')];
const browsers = opt('browsers', 'chromium,webkit').split(',');
const sizes = opt('sizes', '390x844,320x640').split(',').map((s) => s.split('x').map(Number));
const INSET = Number(opt('inset', 47)), INSET_B = 34;
const only = opt('only', '') ? opt('only').split(',') : null;
const want = (k) => !only || only.includes(k);
const outRoot = resolve(root, 'tools/harness/out/ui-mobile', tag); mkdirSync(outRoot, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = [];
const cleanup = () => { for (const p of procs) { try { p.kill(); } catch { /* yok */ } } };
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { cleanup(); process.exit(130); });
const run = (cmd, a, o = {}) => new Promise((res, rej) => { const p = spawn(cmd, a, { cwd: root, stdio: 'inherit', ...o }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${a.join(' ')} → ${c}`)))); });

// ---------------------------------------------------------------- derleme + sunucu
const distDir = resolve(root, 'tools/harness/out/ui-mobile/dist');
if (targets.includes('web') && (!has('no-build') || !existsSync(resolve(distDir, 'index.html')))) await run('npx', ['vite', 'build', '--outDir', distDir, '--emptyOutDir', '--logLevel', 'warn'], { cwd: resolve(root, 'apps/web') });
if (!existsSync(resolve(root, 'apps/server/dist/server.mjs')) || (!has('no-build') && targets.includes('web'))) await run('npm', ['run', 'build:server', '--silent']);
const mobileDist = resolve(root, 'apps/mobile/dist');
if (targets.includes('dom') && (has('build-dom') || !existsSync(resolve(mobileDist, 'www.bundle')))) {
  rmSync(mobileDist, { recursive: true, force: true });
  await run('npx', ['expo', 'export', '--platform', 'ios', '--output-dir', 'dist'], { cwd: resolve(root, 'apps/mobile') });
}
const sport = 8800 + Math.floor(Math.random() * 400);
// sunucu veritabanı geçici bir dosyada: "büyük cüzdan" denetimi oyuncunun cüzdanını doğrudan yazar
const dbFile = resolve(outRoot, 'sunucu.db'); for (const f of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) rmSync(f, { force: true });
// Kod Gir: test yönetici kodu (gerçek yönetici kodu depoda yoktur); sunucu bu özetle doğrular
const TEST_ADMIN_CODE = 'TESTYONETICI';
const TEST_ADMIN_HASH = (() => { const salt = randomBytes(16).toString('hex'); return `scrypt:${salt}:${scryptSync(TEST_ADMIN_CODE, salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex')}`; })();
const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'apps/server/dist/server.mjs'], { cwd: root, env: { ...process.env, PORT: String(sport), HOST: '127.0.0.1', ODI_DB: dbFile, ODI_RAID_ALWAYS: '1', ODI_TEST_STORE: '1', ODI_LOG: '0', ODI_FREE_TEXT_AT: '0' /* yeni hesaplar serbest yazar (güvenli sohbet kuralı comm-e2e'de sınanır) */, ODI_ADMIN_CODE_HASH: TEST_ADMIN_HASH /* test yönetici kodu (gerçeği değil) */ }, stdio: ['ignore', 'pipe', 'inherit'] });
procs.push(server);
await new Promise((res, rej) => { server.stdout.on('data', (d) => { if (String(d).includes('hazır')) res(); }); server.on('exit', (c) => rej(new Error('sunucu kapandı ' + c))); setTimeout(() => rej(new Error('sunucu başlamadı')), 15_000); });
const wsUrl = `ws://127.0.0.1:${sport}`;
let webBase = '';
if (targets.includes('web')) {
  const wport = 5300 + Math.floor(Math.random() * 400);
  // vite doğrudan node ile: kapanışta öksüz önizleme sunucusu kalmasın (npx sarmalayıcısı çocuğunu öldürmez)
  const preview = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(wport), '--strictPort', '--outDir', distDir], { cwd: resolve(root, 'apps/web'), stdio: 'ignore' });
  procs.push(preview);
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://localhost:${wport}/`)).ok) break; } catch { /* henüz değil */ } await sleep(200); }
  webBase = `http://localhost:${wport}/`;
}
let domHtml = '';
if (targets.includes('dom')) {
  const dir = resolve(mobileDist, 'www.bundle'); const h = readdirSync(dir).find((f) => f.endsWith('.html'));
  domHtml = pathToFileURL(resolve(dir, h)).href;
}

// ---------------------------------------------------------------- sayfa içi ölçümler
/** çentik / ana çizgi bantları (yalnızca görsel; html'e eklenir, body ölçümlerine girmez) */
function paintInsets([top, bottom]) {
  const put = () => {
    if (document.getElementById('__inset_top')) return;
    const mk = (id, css) => { const d = document.createElement('div'); d.id = id; d.style.cssText = `position:fixed;left:0;right:0;z-index:2147483647;pointer-events:none;${css}`; document.documentElement.appendChild(d); };
    mk('__inset_top', `top:0;height:${top}px;background:repeating-linear-gradient(135deg,rgba(255,0,80,.22) 0 6px,rgba(255,0,80,.08) 6px 12px);border-bottom:1px dashed rgba(255,0,80,.8)`);
    mk('__inset_bottom', `bottom:0;height:${bottom}px;background:rgba(255,0,80,.12);border-top:1px dashed rgba(255,0,80,.6)`);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', put); else put();
}
/** web hedefi: mobil köprünün yaptığı gibi güvenli alan değişkenlerini yaz */
function webInsets([top, bottom]) {
  const set = () => { const de = document.documentElement; if (!de) return false; de.style.setProperty('--safe-top', `${top}px`); de.style.setProperty('--safe-bottom', `${bottom}px`); return true; };
  if (!set()) document.addEventListener('DOMContentLoaded', set);
}
/** dom hedefi: Expo DOM köprüsü + yerel scrollEnabled:false kilidi (belge kullanıcıyla kaydırılamaz) */
function domBridge([serverUrl, top, bottom, seed]) {
  // ilk açılış rehberi (hikâye + anlatıcı turları + kilitler) bu denetimin konusu değil: atlanmış başlar (bkz. onboarding-e2e.mjs)
  const store = { 'odi-v1': JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true } }, version: 3 }), ...(seed || {}) };
  window.ReactNativeWebView = {
    injectedObjectJson: () => JSON.stringify({ EXPO_DOM_HOST_OS: 'ios', initialProps: { names: ['getItem', 'setItem', 'removeItem', 'haptic', 'share'], props: { serverUrl, canPurchase: false, insetTop: top, insetBottom: bottom } } }),
    postMessage: (s) => {
      try {
        const m = JSON.parse(s);
        if (m.type !== '$$native_action') return;
        const [k, v] = m.data.args ?? []; let result = null;
        if (m.data.actionId === 'getItem') result = store[k] ?? null;
        if (m.data.actionId === 'setItem') store[k] = v;
        if (m.data.actionId === 'removeItem') delete store[k];
        if (m.data.actionId === 'share') result = 'copied';
        setTimeout(() => window.dispatchEvent(new CustomEvent('$$dom_event', { detail: { type: '$$native_action_result', data: { uid: m.data.uid, actionId: m.data.actionId, result } } })), 0);
      } catch { /* yok */ }
    },
  };
  const lock = () => { const st = document.createElement('style'); st.textContent = 'html{overflow:hidden!important}'; document.head.appendChild(st); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lock); else lock();
}

/** yatay taşma: görünümün dışına çıkan (ve meşru bir kaydırma/kırpma kabı içinde olmayan) öğeler */
function measureOverflow() {
  const W = document.documentElement.clientWidth; const out = [];
  const shell = (el) => el === document.documentElement || el === document.body || el.id === 'root' || el.classList.contains('screen');
  const desc = (el) => { const c = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''; const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28); return `${el.tagName.toLowerCase()}${c}${t ? ` “${t}”` : ''}`; };
  const bad = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.cel-root, .map-screen, .camp-canvas, .level-host')) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    if (r.right <= W + 1 && r.left >= -1) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    let hid = false; for (let q = el; q && q !== document.body; q = q.parentElement) if (Number(getComputedStyle(q).opacity) === 0) { hid = true; break; }
    if (hid) continue;
    let p = el.parentElement, clipped = false;
    while (p && !shell(p)) {
      const ps = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(ps.overflowX)) { const pr = p.getBoundingClientRect(); if (pr.right <= W + 1 && pr.left >= -1) { clipped = true; break; } }
      p = p.parentElement;
    }
    if (clipped) continue;
    if (el.parentElement && bad.has(el.parentElement)) { bad.add(el); continue; }
    bad.add(el); out.push(`${desc(el)} [${Math.round(r.left)}…${Math.round(r.right)} / ${W}]`);
  }
  const rootEl = document.getElementById('root');
  return { offenders: out.slice(0, 12), count: out.length, docScrollW: document.documentElement.scrollWidth - W, rootScrollW: rootEl ? rootEl.scrollWidth - rootEl.clientWidth : 0 };
}
/** arayüz metninde emoji: kullanıcı içeriği (sohbet, tepkiler, takma ad, takım amblemi, Kulak Kartı resmi) hariç her metin düğümü,
 *  yer tutucu ve ::before/::after içeriği taranır; emoji yerine ui/art.tsx resimli ikonları kullanılmalı */
function measureEmoji() {
  const re = /(?:\p{Extended_Pictographic}|[▶★])️?/u; const skip = new Set(['©', '®', '™']);
  const ALLOW = '[data-ugc], .ev-emb, .race-quick, .race-msg, [class*="sticker"], .bubble, .msg-name, .quick-row, .dm-list, .dm-bottom, .dm-react, .emoji-grid, .emoji-opt, .th-emblem, .tr-emblem, .cp-emblem, .ear-card, .fact-card, .fc-e, input, textarea, script, style, #__inset_top, #__inset_bottom';
  const vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05; };
  const hits = new Map();
  const add = (el, t) => { const m = t.match(re); if (!m || skip.has(m[0])) return; const key = `${m[0]} ${(el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/)[0] : el.tagName.toLowerCase())}: ${t.trim().replace(/\s+/g, ' ').slice(0, 40)}`; hits.set(key, 1); };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const el = n.parentElement; if (!el || !re.test(n.nodeValue) || el.closest(ALLOW) || !vis(el)) continue;
    add(el, n.nodeValue);
  }
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest(ALLOW)) continue;
    const ph = el.getAttribute('placeholder'); if (ph && re.test(ph) && vis(el)) add(el, ph);
    for (const pe of ['::before', '::after']) { const c = getComputedStyle(el, pe).content; if (c && c !== 'none' && c !== 'normal' && re.test(c) && vis(el)) add(el, c); }
  }
  return [...hits.keys()].slice(0, 20);
}
/** kaydırılabilir mi: ekran içeriği görünümden uzun mu + toplam kaydırma konumu */
function scrollState() {
  const scr = document.querySelector('.screen');
  const tall = scr ? scr.scrollHeight > innerHeight + 8 || scr.getBoundingClientRect().height > innerHeight + 8 : false;
  let total = (document.scrollingElement?.scrollTop ?? 0);
  for (const el of document.querySelectorAll('body, body *')) if (el.scrollTop > 0 && !el.closest('.chat-box, .dm-list, .subtabs')) total += el.scrollTop;
  const r = document.getElementById('root'); const se = document.scrollingElement;
  const room = Math.max(r ? r.scrollHeight - r.clientHeight : 0, se ? se.scrollHeight - se.clientHeight : 0);
  return { tall, total, room };
}
function resetScroll() {
  if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  for (const el of document.querySelectorAll('body, body *')) if (el.scrollTop > 0 && !el.closest('.chat-box, .dm-list')) el.scrollTop = 0;
}
/** üst güvenli alan: başlık öğelerinin en üst noktası çentiğin altında mı */
function measureTop(inset) {
  const sels = ['.topbar2 > *', '.screen-head > *', '.result-top > *', '.dm-head > *', '.map-hud', '.sheet > *:not(.sheet-grip)', '.toast-top', '.fr-banner', '.ev-notice', '.title-screen h1'];
  const hits = [];
  // alt sayfa açıkken altta kalan ekran örtülüdür: yalnızca sayfanın kendisi denetlenir
  const modal = document.querySelector('.sheet-wrap, .bp-wrap, .map-sheet-wrap');
  for (const s of modal ? ['.sheet', '.sheet > *', '.bp', '.map-sheet'] : sels) for (const el of document.querySelectorAll(s)) {
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight * 0.5) continue;
    if (getComputedStyle(el).visibility === 'hidden') continue;
    hits.push({ s, top: Math.round(r.top) });
  }
  const min = hits.length ? Math.min(...hits.map((h) => h.top)) : null;
  return { min, ok: min === null || min >= inset, worst: hits.sort((a, b) => a.top - b.top)[0] ?? null, n: hits.length };
}
/** sohbet giriş kutusu: tamamen görünür, alt sekme çubuğunun ve ana çizginin üstünde */
function measureChat() {
  const f = document.querySelector('.chat-input'); if (!f) return { present: false };
  const r = f.getBoundingClientRect(); const tb = document.querySelector('.tabbar')?.getBoundingClientRect();
  const limit = tb ? tb.top : innerHeight;
  return { present: true, top: Math.round(r.top), bottom: Math.round(r.bottom), tabTop: tb ? Math.round(tb.top) : null, ok: r.bottom <= limit + 0.5 && r.top >= 0 && r.right <= document.documentElement.clientWidth + 1 };
}

/** sayfadaki oyuncunun takma adı (sunucu veritabanında bu oyuncuyu bulmak için; yardımcı istemciler Bora/Komşu/Aday) */
const PAGE_NAME = 'Kulakçı Ayşegül1';
/** tarayıcısız gerçek oyuncu (sunucuya doğrudan WebSocket; social-e2e.mjs ile aynı) */
function rawClient(url) {
  const ws = new WebSocket(url); let id = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.t === 'res') { const p = pend.get(m.id); pend.delete(m.id); if (!p) return; if (m.ok) p.res(m.data); else p.rej(new Error(`${m.code}: ${m.error}`)); } };
  const ready = new Promise((r) => { ws.onopen = r; });
  const call = async (op, data) => { await ready; return new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ t: 'req', id: i, op, data })); }); };
  return { call, close: () => ws.close() };
}

// ---------------------------------------------------------------- akış
const report = []; let failures = 0; let suiteNo = 0;
const fail = (rec, why) => { rec.fails.push(why); failures++; };

async function suite(browserName, target, [W, H]) {
  const name = `${target}-${browserName}-${W}x${H}`; const sno = ++suiteNo;
  const dir = resolve(outRoot, name); mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (f.endsWith('.png')) rmSync(resolve(dir, f));
  const B = browserName === 'webkit' ? webkit : chromium;
  const browser = await B.launch({ headless: true, executablePath: browserName === 'chromium' ? process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined, args: browserName === 'chromium' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] : [] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 3, hasTouch: true, ...(browserName === 'chromium' ? { isMobile: true } : {}), locale: 'tr-TR', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|AudioContext|WebGL|GPU|Autoplay|WebSocket|ERR_CONNECTION|ERR_FILE/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await page.addInitScript(paintInsets, [INSET, INSET_B]);
  if (target === 'dom') await page.addInitScript(domBridge, [wsUrl, INSET, INSET_B]);
  else {
    await page.addInitScript(webInsets, [INSET, INSET_B]);
    await page.addInitScript(() => { try { if (!localStorage.getItem('odi-v1')) localStorage.setItem('odi-v1', JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true } }, version: 3 })); } catch { /* depolama yok */ } });
  }
  const cdp = browserName === 'chromium' ? await ctx.newCDPSession(page) : null;
  const url = (q = '') => target === 'dom' ? domHtml + (q ? `?${q}` : '') : `${webBase}?sunucu=${encodeURIComponent(wsUrl)}${q ? `&${q}` : ''}`;
  let n = 0;
  const recs = [];

  async function swipe() {
    if (cdp) {
      // gerçek dokunma dizisi (parmak aşağıdan yukarı kayar); synthesizeScrollGesture başsız modda kaydırmıyor
      const x = Math.round(W / 2), y0 = Math.round(H * 0.68), dy = Math.round(H * 0.4), steps = 14;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
      for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - Math.round((dy * i) / steps) }] }); await sleep(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else { await page.mouse.move(W / 2, H * 0.5); await page.mouse.wheel(0, Math.round(H * 0.45)); }
    await sleep(500);
  }
  /** bir ekranı denetle: görüntü, taşma, üst pay, (uzunsa) kaydırma; opsiyonel sohbet kontrolü */
  async function check(label, { scroll = true, chat = false, top = true, emoji = true } = {}) {
    await sleep(350);
    const rec = { screen: label, fails: [] };
    const file = resolve(dir, `${String(++n).padStart(2, '0')}-${label}.png`);
    await page.screenshot({ path: file }); rec.shot = file.replace(root + '/', '');
    const ov = await page.evaluate(measureOverflow); rec.overflow = ov;
    if (ov.count > 0 || ov.docScrollW > 0) fail(rec, `yatay taşma: ${ov.offenders.slice(0, 3).join(' | ')}${ov.docScrollW > 0 ? ` (belge +${ov.docScrollW}px)` : ''}`);
    if (top) { const t = await page.evaluate(measureTop, INSET); rec.top = t; if (!t.ok) fail(rec, `üst pay: ${t.worst?.s} top=${t.worst?.top} < ${INSET}`); }
    // ekran başlığı kesilmemeli (üst çubuk hapları başlığı “T…” yapmasın)
    const cut = await page.evaluate(() => [...document.querySelectorAll('.tb-title h1, .screen-head h1')].filter((h) => h.getBoundingClientRect().width > 0 && h.scrollWidth > h.clientWidth + 1).map((h) => h.textContent));
    if (cut.length) fail(rec, `başlık kesildi: ${cut.join(', ')}`);
    // kamp üst bandı: her gösterge çipi ekranın içinde, kırpılmadan (Kamp Seviyesi, İnşaatçı, hızlandırıcılar, Görevler/Klinik, ziyaret)
    const hf = await page.evaluate(measureHudFit); if (hf.present) { rec.hud = hf; if (hf.offenders.length) fail(rec, `kamp üst bandı taşıyor: ${hf.offenders.slice(0, 3).join(' | ')}`); }
    if (emoji) { const em = await page.evaluate(measureEmoji); rec.emoji = em; if (em.length) fail(rec, `arayüzde emoji (${em.length}): ${em.slice(0, 6).join(' | ')}`); }
    if (chat) { const c = await page.evaluate(measureChat); rec.chat = c; if (!c.present || !c.ok) fail(rec, `sohbet girişi görünmüyor: ${JSON.stringify(c)}`); }
    if (scroll) {
      await page.evaluate(resetScroll);
      const s0 = await page.evaluate(scrollState);
      if (s0.tall) {
        await swipe();
        // ivmeli/yumuşak kaydırma birkaç kare sürebilir: hedefe varana ya da 2 sn dolana dek bekle
        const need = s0.total + Math.min(20, Math.max(1, s0.room - 2));
        let s1 = await page.evaluate(scrollState);
        for (let i = 0; i < 14 && s1.total < need; i++) { await sleep(150); s1 = await page.evaluate(scrollState); }
        rec.scroll = { before: s0.total, after: s1.total };
        if (!(s1.total >= need)) fail(rec, `kaydırılamıyor (${s0.total} → ${s1.total})`);
        else await page.screenshot({ path: file.replace(/\.png$/, '-kaydirildi.png') });
        await page.evaluate(resetScroll);
      } else rec.scroll = 'kısa';
    }
    console.log(`  ${rec.fails.length ? '✗' : '✓'} ${name} · ${label}${rec.fails.length ? ' — ' + rec.fails.join(' ; ') : ''}`);
    recs.push(rec);
    return rec;
  }
  const tab = async (label) => { await page.locator('nav.tabbar .tab', { hasText: label }).click(); await sleep(500); };
  const toastGone = async () => { for (let i = 0; i < 8 && await page.locator('.toast-top').count(); i++) { await page.locator('.toast-top').first().click({ timeout: 500 }).catch(() => undefined); await sleep(150); } };
  const back = async () => { const b = page.getByRole('button', { name: 'Geri' }).first(); if (await b.count()) await b.click(); await sleep(400); };

  try {
    // ---- açılış + takma ad
    await page.goto(url(), { waitUntil: 'load' });
    await page.getByRole('button', { name: /Yola çık/ }).waitFor({ timeout: 45_000 }); await sleep(700);
    await check('giris', { scroll: false });
    await page.getByRole('button', { name: /Yola çık/ }).click({ timeout: 45_000 });
    await page.locator('.onboard').waitFor({ timeout: 15_000 });
    await page.getByRole('textbox', { name: 'Takma ad' }).fill(PAGE_NAME);
    await page.getByRole('button', { name: 'Başla' }).click();
    await page.locator('.onboard').waitFor({ state: 'detached' });
    await toastGone();
    await page.locator('.net-dot.on').first().waitFor({ timeout: 10_000 }).catch(() => undefined);
    await check('harita', { scroll: false });

    if (want('bugun')) { await tab('Bugün'); await check('bugun'); }
    if (want('profil')) {
      await tab('Profil'); await check('profil');
      const tiles = await page.locator('.menu-tile').evaluateAll((els) => els.map((e) => e.querySelector('b')?.textContent ?? ''));
      for (const t of tiles) {
        await page.locator('.menu-tile', { hasText: t }).first().click(); await sleep(600);
        await check(`profil-${t.toLocaleLowerCase('tr').replace(/[^a-zçğıöşü]+/g, '-')}`, { chat: t === 'Genel sohbet', scroll: !(await page.locator('.sheet-wrap').count()) });
        // sayfa (alt sayfa) açan karolar: Escape ile kapanır
        if (await page.locator('.sheet-wrap').count()) { await page.keyboard.press('Escape'); await sleep(300); }
        await back();
        if (!(await page.locator('.menu-tile').count())) await tab('Profil');
      }
      // sıralama: bilgi sayfası (formül + ödüller) ve takım tabloları
      { await page.locator('.menu-tile[data-tile="ranking"]').click(); await page.getByTestId('siralama').waitFor(); await sleep(500);
        await page.getByRole('button', { name: 'Nasıl hesaplanır?' }).click(); await page.locator('.sheet').waitFor(); await check('siralama-bilgi', { scroll: false });
        await page.locator('.sheet').getByRole('button', { name: 'Anladım' }).click(); await sleep(300);
        await page.locator('.rank-kind button', { hasText: 'Takımlar' }).click(); await sleep(700); await check('siralama-takimlar');
        await page.locator('.rank-kind button', { hasText: 'Oyuncular' }).click(); await sleep(300);
        await back(); if (!(await page.locator('.menu-tile').count())) await tab('Profil'); }
      const lg = page.locator('.league-card').first();
      if (await lg.count()) { await lg.click(); await sleep(600); await check('profil-lig'); await back(); if (!(await page.locator('.menu-tile').count())) await tab('Profil'); }
      // dolap: avatar düğmesi; takma ad sayfası (alt sayfa)
      const rn = page.getByRole('button', { name: 'Takma adı değiştir' });
      if (await rn.count()) { await rn.click(); await page.locator('.sheet').waitFor(); await check('profil-takma-ad-sayfasi', { scroll: false }); await page.getByRole('button', { name: 'Kapat' }).click(); }
      // Kod Gir: yanlış kod mesajı; test yönetici kodu → Ayarlar'da yönetici kutusu ve kod paneli
      { await page.locator('.menu-tile[data-tile="kod"]').click(); await page.getByTestId('kod-sayfasi').waitFor();
        await page.getByTestId('kod-girdi').fill('yanlis kod'); await page.getByTestId('kod-kullan').click(); await page.getByTestId('kod-sonuc').waitFor();
        await check('kod-sayfasi-hata', { scroll: false });
        await page.getByTestId('kod-girdi').fill(TEST_ADMIN_CODE.toLowerCase()); await page.getByTestId('kod-kullan').click(); await page.locator('[data-testid="kod-sonuc"]', { hasText: 'Yönetici modu' }).waitFor();
        await page.keyboard.press('Escape'); await sleep(300);
        await page.locator('.menu-tile[data-tile="settings"]').click(); await page.getByTestId('yonetici-rozet').waitFor();
        await page.getByTestId('kod-ayar').scrollIntoViewIfNeeded(); await check('ayarlar-yonetici');
        await page.getByTestId('kod-paneli-ac').click(); await page.getByTestId('kod-paneli').waitFor(); await sleep(400); await check('kod-paneli', { scroll: false });
        await page.keyboard.press('Escape'); await sleep(300);
        // yönetici modunu kapat (diğer ekranlar gerçek ilerlemeyle denetlensin)
        await page.getByTestId('yonetici-anahtar').click(); await page.locator('[data-testid="yonetici-rozet"]', { hasText: 'kapalı' }).waitFor();
        // Gizlilik ve hakkında (TASLAK metin alt sayfası)
        await page.getByTestId('gizlilik-ac').scrollIntoViewIfNeeded(); await page.getByTestId('gizlilik-ac').click(); await page.getByTestId('gizlilik-taslak').waitFor(); await sleep(400);
        await check('ayarlar-gizlilik', { scroll: false });
        await page.keyboard.press('Escape'); await sleep(300);
        await back(); if (!(await page.locator('.menu-tile').count())) await tab('Profil'); }
    }
    if (want('kamp')) {
      await tab('Kamp'); await sleep(1200); await check('kamp', { scroll: false });
      // kamp büyümesi: Kamp Seviyesi paneli ve süsleme kipi (gerçek sunucu: Sv 1 ödülü iki süs)
      const ks = page.getByTestId('kamp-seviye');
      if (await ks.count()) { await ks.click(); await page.locator('.ks-panel').waitFor(); await sleep(600); await check('kamp-seviye-paneli', { scroll: false }); await page.locator('.ks-panel .bp-x').click(); await sleep(300); }
      const su = page.getByTestId('susle');
      if (await su.count()) {
        await su.click(); await page.getByTestId('sus-panel').waitFor(); await sleep(500); await page.locator('.dede-card .en-x').click({ timeout: 800 }).catch(() => undefined);
        await check('kamp-susle', { scroll: false });
        const card = page.locator('.sus-card').first();
        if (await card.count()) { await card.click(); await sleep(900); await check('kamp-susle-hayalet', { scroll: false }); }
        await page.locator('.sus-done').click(); await sleep(400);
      }
      const b = page.locator('.sr-only button').first();
      if (await b.count()) { await b.evaluate((el) => el.click()); await sleep(600); await check('kamp-bina', { scroll: false }); await page.getByRole('button', { name: 'Kapat' }).first().click().catch(() => undefined); await sleep(300); }
      const l = page.getByRole('button', { name: 'Liste görünümü' });
      if (await l.count()) { await l.click(); await sleep(600); await check('kamp-liste'); await back(); }
      // büyük cüzdan (5 basamak jeton + 4 basamak kristal): ekran başlığı "K…" diye kesilmemeli (kısa sayı: 98B; ≤360 px'te kristal de 4,3B)
      const { DatabaseSync } = await import('node:sqlite');
      const sq = new DatabaseSync(dbFile); sq.exec('PRAGMA busy_timeout = 3000'); sq.prepare('UPDATE players SET jeton = 98765, kristal = 4321').run(); sq.close();
      await tab('Harita'); await tab('Kamp'); await sleep(1500); await toastGone();
      const ub = page.getByRole('button', { name: 'Üs görünümü' }); if (await ub.count()) { await ub.click(); await sleep(1200); }
      const rec = await check('kamp-buyuk-cuzdan', { scroll: false });
      const hud = await page.evaluate(() => ({ title: document.querySelector('.tb-title h1')?.textContent ?? '', j: document.querySelector('.tb-pill[data-hud="jeton"]')?.innerText ?? '', k: document.querySelector('.tb-pill[data-hud="kristal"]')?.innerText ?? '', w: [...document.querySelectorAll('.topbar2 .tb-title h1, .topbar2 .tb-pills > *')].map((e) => Math.round(e.getBoundingClientRect().width)) }));
      rec.hud = hud;
      if (hud.j.trim() !== '98B' || hud.k.trim() !== (W <= 360 ? '4,3B' : '4.321')) fail(rec, `büyük cüzdan görünmedi: ${JSON.stringify(hud)}`);
      // aynı cüzdanla diğer sekme başlıkları da okunur kalmalı
      for (const t of ['Bugün', 'Profil', 'Harita']) { await tab(t); await sleep(900); await toastGone(); await check(`buyuk-cuzdan-${t.toLocaleLowerCase('tr').replace('ü', 'u')}`, { scroll: false }); }
    }
    if (want('takim')) {
      // takım bulma ve başvuru (docs/16-takim-rekabeti.md §5): gerçek ikinci oyuncu başvuruyla üye alan bir takım kurar
      const komsu = rawClient(wsUrl); await komsu.call('hello', { version: 1, name: `Komşu${sno}` });
      const komsuTeam = (await komsu.call('team.create', { name: `Komşu Kepçe ${sno}`, emblem: '🐚', description: 'Başvuruyla üye alıyoruz; her akşam birlikte koşuyoruz.', open: false })).team;
      await tab('Takım');
      await page.locator('.team-hero').waitFor({ timeout: 10_000 });
      await check('takim-kesif');
      await page.locator('.ta-filters [data-filter="basvuru"]').click(); await page.locator(`[data-testid="takim-satiri"][data-team="${komsuTeam.id}"]`).waitFor({ timeout: 10_000 });
      await page.locator(`[data-testid="takim-satiri"][data-team="${komsuTeam.id}"]`).scrollIntoViewIfNeeded(); await check('takim-kesif-basvuruyla', { scroll: false });
      await page.locator(`[data-testid="takim-satiri"][data-team="${komsuTeam.id}"] .tr-main`).click(); await page.getByTestId('takim-profili').waitFor({ timeout: 10_000 });
      await check('takim-profili', { scroll: false });
      await page.locator('[data-testid="takim-profili"] [data-testid="takim-katil"]').click(); await page.getByTestId('basvuru-sayfasi').waitFor();
      await check('takim-basvuru-sayfasi', { scroll: false });
      await page.keyboard.press('Escape'); await sleep(300); if (await page.locator('.sheet-wrap').count()) { await page.keyboard.press('Escape'); await sleep(300); }
      await page.locator('.ta-filters [data-filter="hepsi"]').click(); await sleep(300);
      komsu.close();
      await page.getByRole('button', { name: '＋ Takım kur' }).first().click();
      await page.locator('.sheet').getByPlaceholder('ör. Koklea Kaşifleri').fill(`Koklea Kaşifleri ${String.fromCharCode(64 + sno)}${sno}`.slice(0, 20));
      await page.locator('.sheet').getByPlaceholder('ör. Her gün biraz, hep birlikte.').fill('Her gün biraz, hep birlikte; kulaktan beyne kadar birlikte koşuyoruz ve hiç durmuyoruz.');
      await check('takim-kur-sayfasi', { scroll: false });
      await page.locator('.sheet').getByRole('button', { name: /Takımı kur/ }).click();
      await page.locator('.team-head').waitFor();
      await toastGone();
      const msgs = ['Merhaba takım! Bu hafta kepçeyi alalım mı? Herkes en az iki bölüm oynasın, savaş hedefini birlikte seçelim.', 'Çokuzunbirkelimeiçerenmesajbölünmedenekranıntaşmamasıgerekiyorçünküsağtarafgörünmüyordu', 'Tamam 👍'];
      for (const m of msgs) { await page.getByRole('textbox', { name: 'Mesaj' }).fill(m); await page.getByRole('button', { name: 'Gönder', exact: true }).click(); await sleep(1300); }
      await check('takim-sohbet', { chat: true });
      // başvuru: lider ekranında rozet + Başvurular sekmesi (aşağıdaki alt sekme turunda denetlenir); katılım başvuruyla
      { const myTeam = `Koklea Kaşifleri ${String.fromCharCode(64 + sno)}${sno}`.slice(0, 20);
        const aday = rawClient(wsUrl); await aday.call('hello', { version: 1, name: `Aday${sno}` });
        const t = (await aday.call('team.list', { query: myTeam })).teams.find((x) => x.name === myTeam);
        if (t?.open) { await page.getByLabel('Takım menüsü').click(); await page.locator('[data-testid="katilim-ayari"] [role="radio"]', { hasText: 'Başvuruyla' }).click(); await sleep(500); await page.getByRole('button', { name: 'Kapat' }).click(); }
        if (!t) throw new Error(`başvuru denetimi: takım listede yok (${myTeam})`);
        await aday.call('team.apply', { teamId: t.id, noteId: 'savas' });
        await page.getByTestId('basvuru-rozeti').waitFor({ timeout: 10_000 }).catch(() => undefined);
        aday.close(); }
      const subs = await page.locator('.subtabs .subtab').evaluateAll((els) => els.map((e) => e.textContent.replace(/\d+$/, '').trim()));
      for (const s of subs.slice(1)) {
        await page.locator('.subtabs .subtab', { hasText: s.replace(/^\S+\s/, '') }).first().click(); await sleep(700);
        await check(`takim-${s.replace(/^\S+\s/, '').toLocaleLowerCase('tr').replace(/[^a-zçğıöşü]+/g, '-')}`);
      }
      await page.getByLabel('Takım menüsü').click(); await page.locator('.sheet').waitFor();
      await check('takim-menu-sayfasi', { scroll: false });
      await page.getByRole('button', { name: 'Kapat' }).click();
      await page.locator('.subtabs .subtab', { hasText: 'Sohbet' }).first().click(); await sleep(500);
      // klavye: giriş odaklanınca kutu yine görünür (görsel görünüm küçülünce)
      await page.getByRole('textbox', { name: 'Mesaj' }).focus();
      await check('takim-sohbet-odak', { chat: true, scroll: false });
      // klavye taklidi: iOS klavyesi (~%40 yükseklik) açıkken ui/viewport.ts'nin yazdığı --kb + html.kb-open → giriş kutusu klavyenin hemen üstünde
      const kb = Math.round(H * 0.4);
      await page.evaluate((k) => { document.documentElement.style.setProperty('--kb', `${k}px`); document.documentElement.classList.add('kb-open'); }, kb);
      { const rec = await check('takim-sohbet-klavye', { scroll: false });
        const r = await page.evaluate(() => { const b = document.querySelector('.chat-input')?.getBoundingClientRect(); const box = document.querySelector('.chat-box')?.getBoundingClientRect(); return b && { top: Math.round(b.top), bottom: Math.round(b.bottom), box: box ? Math.round(box.height) : 0 }; });
        rec.keyboard = { kb, ...r };
        if (!r || r.bottom > H - kb + 0.5 || r.top < INSET || r.box < 60) fail(rec, `klavye açıkken giriş kutusu görünmüyor: ${JSON.stringify(r)} (klavye üstü ${H - kb})`); }
      await page.evaluate(() => { document.documentElement.style.setProperty('--kb', '0px'); document.documentElement.classList.remove('kb-open'); });
      // ---- iletişim (docs/13-iletisim.md): gerçek ikinci oyuncu (tarayıcısız istemci) takıma katılır → akış kartı, yardım kartı,
      //      Günün Sorusu; konu / ipucu / serbest yazı sayfaları; Birlikte ekranı; özel mesajda hazır sözler
      if (want('iletisim')) {
        await page.getByLabel('Takım menüsü').click(); await page.locator('.sheet').waitFor();
        const code = (await page.locator('.big-code').innerText()).trim();
        await page.getByRole('button', { name: 'Kapat' }).click();
        const bora = rawClient(wsUrl);
        await bora.call('hello', { version: 1, name: `Bora${sno}` });
        await bora.call('team.join', { code });
        await bora.call('progress.submit', { runId: `u${sno}a${Date.now()}`, level: 1, completed: true, stars: 3, score: 900, timeSec: 40, coins: 60, biome: 'dis-kulak', mechanic: 'kosu', cochleas: 2 });
        await bora.call('team.help.request', { level: 2 });
        await page.locator('[data-testid="yardim-karti"]').first().waitFor({ timeout: 10_000 });
        await page.locator('.subtabs .subtab', { hasText: 'Üyeler' }).first().click(); await sleep(300);
        await page.locator('.subtabs .subtab', { hasText: 'Sohbet' }).first().click(); await sleep(700);
        await check('takim-sohbet-kartlar', { chat: true });
        await page.locator('[data-testid="akis-karti"]').last().getByRole('button', { name: 'Yanıtla' }).click();
        await page.getByTestId('konu-sayfasi').waitFor(); await check('takim-konu-sayfasi', { scroll: false });
        await page.locator('.sheet').getByRole('button', { name: 'Kapat' }).click(); await sleep(300);
        await page.locator('[data-testid="yardim-karti"]').first().getByTestId('ipucu-ver').click();
        await page.locator('.tip-opt').first().waitFor(); await check('takim-ipucu-sayfasi', { scroll: false });
        await page.locator('.sheet').getByRole('button', { name: 'Kapat' }).click(); await sleep(300);
        const q = page.locator('[data-testid="gunun-sorusu"] .fc-reply', { hasText: 'Haftalık tablo' });
        if (await q.count()) { await q.first().click(); await page.locator('.sheet').waitFor(); await check('takim-haftalik-tablo', { scroll: false }); await page.locator('.sheet').getByRole('button', { name: 'Kapat' }).click(); await sleep(300); }
        // Birlikte (İkili Görev, Usta–Çırak, sohbet ayarları)
        await tab('Profil'); await page.locator('.menu-tile[data-tile="together"]').click();
        await page.getByTestId('birlikte').waitFor(); await sleep(500);
        await check('birlikte');
        await back();
        // özel mesaj: takım arkadaşı hazır söz gönderir; panelde Hazır sözler
        await bora.call('dm.send', { to: (await bora.call('team.detail', {})).team.roster.find((m) => !m.name.startsWith('Bora')).id, text: 'selam', kind: 'hazir' });
        await page.locator('.menu-tile[data-tile="messages"]').click();
        await page.locator('[data-testid="sohbet-satiri"]').first().click({ timeout: 10_000 });
        await page.getByTestId('dm-ekrani').waitFor();
        await page.getByRole('button', { name: 'Emoji ve çıkartmalar' }).click();
        await page.locator('.dm-panel-tabs button', { hasText: 'Hazır sözler' }).click(); await sleep(300);
        await check('dm-hazir-sozler', { scroll: false });
        await back(); await back();
        bora.close();
        await tab('Takım');
      }
    }
    if (want('gorev')) {
      // Kamp Görevleri (docs/17-kamp-gorevleri.md): Görevler paneli (4 sekme), Klinik, vaka akışı (odyogram, timpanogram, otoskopi,
      // sonuç), Vaka Defteri, odyoloji düzeyi, Ton Avı, Timpanogram Eşleştir, takım akışında Konsültasyon kartı
      const { DatabaseSync } = await import('node:sqlite');
      const sq = new DatabaseSync(dbFile); sq.exec('PRAGMA busy_timeout = 3000');
      const pid = sq.prepare('SELECT id FROM players WHERE name = ? ORDER BY created_at DESC LIMIT 1').get(PAGE_NAME).id; // sayfadaki oyuncu (Bora/Komşu/Aday değil)
      sq.prepare('UPDATE players SET highest = 11 WHERE id = ?').run(pid);
      for (const [b, l] of [['merkez', 4], ['depo', 2], ['revir', 4], ['laboratuvar', 2], ['kule', 2], ['tedavi', 1]]) sq.prepare('UPDATE buildings SET level = ? WHERE player_id = ? AND id = ?').run(l, pid, b);
      sq.close();
      await tab('Harita'); await tab('Kamp'); await sleep(1200); await toastGone();
      const ub = page.getByRole('button', { name: 'Üs görünümü' }); if (await ub.count()) { await ub.click(); await sleep(1200); }
      await page.evaluate(() => window.__kg?.refresh()); await page.getByTestId('kg-btn').waitFor({ timeout: 10_000 }); await sleep(800); await toastGone();
      // kamp büyümesi kutlaması (Kamp Seviyesi atladıysa) düğmeleri örtmesin
      for (let i = 0; i < 6; i++) {
        const ok = page.locator('.cel-cta .btn'); if (await ok.count()) { await ok.first().click().catch(() => undefined); await sleep(600); continue; }
        if (!(await page.locator('.cel-title').count())) break; await page.mouse.click(10, 300); await sleep(700);
      }
      await check('gorev-kamp-dugmeleri', { scroll: false });
      // görev çipleri + süren inşaat aynı bantta (en kalabalık üst bant)
      { const sq2 = new DatabaseSync(dbFile); sq2.exec('PRAGMA busy_timeout = 3000'); const t0 = Date.now();
        sq2.prepare('UPDATE buildings SET upgrading_to = 5, started_at = ?, ends_at = ? WHERE player_id = ? AND id = ?').run(t0, t0 + 3 * 3600_000 + 25 * 60_000, pid, 'merkez'); sq2.close();
        await tab('Harita'); await tab('Kamp'); await sleep(1200); await toastGone();
        const u = page.getByRole('button', { name: 'Üs görünümü' }); if (await u.count()) { await u.click(); await sleep(1200); }
        await page.getByTestId('kg-btn').waitFor({ timeout: 10_000 }); await page.locator('.hud-chip.builder.on').waitFor({ timeout: 10_000 }); await sleep(600);
        await check('gorev-kamp-insaat', { scroll: false });
        const sq3 = new DatabaseSync(dbFile); sq3.exec('PRAGMA busy_timeout = 3000');
        sq3.prepare('UPDATE buildings SET upgrading_to = NULL, started_at = NULL, ends_at = NULL WHERE player_id = ? AND id = ?').run(pid, 'merkez'); sq3.close();
        await tab('Harita'); await tab('Kamp'); await sleep(1200); await toastGone();
        const u2 = page.getByRole('button', { name: 'Üs görünümü' }); if (await u2.count()) { await u2.click(); await sleep(1200); }
        await page.getByTestId('kg-btn').waitFor({ timeout: 10_000 }); }
      await page.getByTestId('kg-btn').click(); await page.getByTestId('kg-panel').waitFor();
      for (const t of ['hikaye', 'gunluk', 'etkinlik', 'basari']) { await page.locator(`.kg-tabs [data-tab="${t}"]`).click(); await sleep(500); await check(`gorev-${t}`, { scroll: false }); }
      await page.locator('.kg-sheet .bp-x').click(); await sleep(300);
      await page.getByTestId('klinik-btn').click(); await page.getByTestId('klinik-panel').waitFor(); await sleep(400);
      await check('gorev-klinik-salon', { scroll: false });
      const vaka = async (label) => {
        await page.locator('.kg-hasta-kart').first().click(); await page.getByTestId('hasta-adim').waitFor(); await check(`${label}-hasta`, { scroll: false });
        await page.getByTestId('testlere-gec').click();
        for (const tt of ['otoskopi', 'odyometri', 'timpanometri', 'refleks']) await page.locator(`.kg-test[data-test="${tt}"]`).click();
        await sleep(300); await check(`${label}-testler`, { scroll: false });
        for (const tt of ['odyometri', 'timpanometri', 'otoskopi']) { await page.locator(`[data-sonuc="${tt}"]`).scrollIntoViewIfNeeded(); await sleep(250); await check(`${label}-${tt}`, { scroll: false }); }
      };
      await vaka('gorev-vaka');
      if (await page.getByTestId('konsult-iste').count()) { await page.getByTestId('konsult-iste').click(); await page.getByTestId('konsult-durum').waitFor({ timeout: 8000 }); }
      await page.getByTestId('karara-gec').click(); await page.getByTestId('tani-adim').waitFor();
      await check('gorev-vaka-karar', { scroll: false });
      await page.locator('.kg-opt[data-dx]').first().click(); await page.locator('.kg-opt[data-mg]').first().click();
      await page.getByTestId('karar-gonder').click(); await page.getByTestId('vaka-sonuc').waitFor(); await sleep(900); await toastGone();
      await check('gorev-vaka-sonuc', { scroll: false });
      await page.locator('.cel-root.on').waitFor({ state: 'detached', timeout: 3000 }).catch(() => undefined);
      await page.locator('.kg-sheet .bp-x').click(); await sleep(300);
      await page.getByTestId('klinik-btn').click(); await page.getByTestId('defter-tab').click(); await page.getByTestId('vaka-defteri').waitFor();
      await check('gorev-vaka-defteri', { scroll: false });
      await page.locator('.kg-sheet .bp-x').click(); await sleep(300);
      // oyunlar
      // Timpanogram Eşleştir: her soru biçimi görünsün diye destenin başı belirlenir (sunucu destesi: ko_deck)
      const deste = (duzey, ids) => { const d = new DatabaseSync(dbFile); d.exec('PRAGMA busy_timeout = 3000'); const p = d.prepare('SELECT id FROM players WHERE name = ? ORDER BY created_at DESC LIMIT 1').get(PAGE_NAME).id; d.prepare('INSERT INTO ko_deck(player_id, duzey, deck, pos) VALUES(?, ?, ?, 0) ON CONFLICT(player_id, duzey) DO UPDATE SET deck = excluded.deck, pos = 0').run(p, duzey, JSON.stringify(ids)); d.close(); };
      const timpanoTuru = async (label) => {
        for (let k = 0; k < 5; k++) {
          await page.locator(`[data-testid="timpano-tur"][data-bulmaca="${k}"] .kg-opt:not([disabled])`).first().waitFor({ timeout: 10_000 }); await sleep(300);
          const bicim = await page.getByTestId('timpano-tur').getAttribute('data-bicim');
          await check(`${label}-${k + 1}-${bicim}`);
          await page.locator('[data-testid="timpano-tur"] .kg-opt').first().click(); await page.getByTestId('timp-aciklama').waitFor(); await sleep(250);
          if (k === 0) await check(`${label}-aciklama`);
          await page.getByTestId('timp-ileri').click();
        }
        await page.getByTestId('oyun-sonuc').waitFor({ timeout: 10_000 });
      };
      for (const g of ['ton', 'timpano']) {
        await page.getByTestId('kg-btn').click(); await page.locator('.kg-tabs [data-tab="etkinlik"]').click(); await page.getByTestId(`etk-${g}`).click();
        await page.getByTestId(`oyun-${g}`).waitFor(); await check(`gorev-${g}-giris`, { scroll: false });
        if (g === 'ton') {
          await page.evaluate(() => window.__kg.ses(false)); await page.getByTestId('ton-ses-kapali').waitFor(); await check('gorev-ton-ses-kapali', { scroll: false });
          await page.getByTestId('ton-sesi-ac').click(); await page.getByTestId('oyun-basla').waitFor();
        }
        if (g === 'timpano') deste('genel', ['te04', 'tb04', 'tv01', 'ts02', 'tk03']);
        await page.getByTestId('oyun-basla').click(); await page.getByTestId(`${g}-tur`).waitFor(); await sleep(g === 'ton' ? 2600 : 600);
        if (g === 'ton') await check('gorev-ton-tur', { scroll: false }); else await timpanoTuru('gorev-timpano');
        await page.locator('.kg-sheet .bp-x').click(); await sleep(400);
      }
      // odyoloji düzeyi (Ayarlar › Bilgi düzeyi): sayılar ve dört seçenek
      await tab('Profil'); await page.locator('.menu-tile[data-tile="settings"]').click(); await sleep(500);
      await page.getByRole('radio', { name: 'Odyoloji öğrencisi' }).click(); await back();
      await tab('Kamp'); await sleep(1200); await toastGone();
      await page.getByTestId('klinik-btn').click(); await page.getByTestId('klinik-panel').waitFor();
      await vaka('gorev-odyoloji');
      await page.locator('.kg-sheet .bp-x').click(); await sleep(300);
      deste('odyoloji', ['tn04', 'tb07', 'tv07', 'ts06', 'te16']);
      await page.getByTestId('kg-btn').click(); await page.locator('.kg-tabs [data-tab="etkinlik"]').click(); await page.getByTestId('etk-timpano').click();
      await page.getByTestId('oyun-basla').click(); await page.getByTestId('timpano-tur').waitFor(); await timpanoTuru('gorev-odyoloji-timpano');
      await page.locator('.kg-sheet .bp-x').click(); await sleep(300);
      await tab('Profil'); await page.locator('.menu-tile[data-tile="settings"]').click(); await sleep(500);
      await page.getByRole('radio', { name: 'Genel' }).click(); await back();
      // takım akışındaki Konsültasyon kartı (takım varsa)
      if (want('takim')) {
        await tab('Takım'); await sleep(900);
        const kc = page.getByTestId('konsult-karti').last();
        if (await kc.count()) { await kc.scrollIntoViewIfNeeded(); await sleep(300); await check('gorev-konsult-karti', { chat: true, scroll: false }); }
      }
    }
    if (want('etkinlik')) {
      await tab('Harita'); await sleep(800);
      await page.getByTestId('ev-fab').click(); await page.getByTestId('etkinlikler').waitFor({ timeout: 10_000 });
      await check('etkinlikler');
      const kinds = await page.locator('[data-testid^="ev-kart-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid').slice(8)));
      for (const k of kinds) {
        const c = page.getByTestId(`ev-kart-${k}`); const btn = c.locator('button').first();
        if (!(await btn.count())) continue;
        await c.locator('.ev-band').first().click().catch(() => undefined); await sleep(500);
        if (await page.locator('[data-testid="etkinlikler"][data-view="merkez"]').count()) continue;
        await check(`etkinlik-${k}`);
        await page.locator('.ev-head button[aria-label="Geri"]').first().click().catch(() => undefined); await sleep(400);
      }
      await back();
    }
    if (want('giris')) {
      // geri dönen oyuncu: kayıtlı ilerleme → “Devam et”
      const seed = { 'odi-v1': JSON.stringify({ state: { progress: { 1: { stars: 3, best: 900, plays: 1 }, 2: { stars: 2, best: 700, plays: 1 } }, coins: 240, ftue: { v: 1, story: true, tours: [], bypass: true } }, version: 3 }) };
      if (target === 'dom') { await page.addInitScript(domBridge, [wsUrl, INSET, INSET_B, seed]); }
      else await page.evaluate((sd) => { for (const [k, v] of Object.entries(sd)) localStorage.setItem(k, v); }, seed);
      await page.goto(url(), { waitUntil: 'load' });
      await page.getByRole('button', { name: /Devam et/ }).waitFor({ timeout: 45_000 }); await sleep(700);
      await check('giris-devam', { scroll: false });
    }
    if (want('sonuc')) {
      for (const [q, label] of [['demo=sonuc&yildiz=3&skor=2480&rekor=1&acilim=1&sans=1&kutlama=0', 'sonuc-kazandi'], ['demo=sonuc&yildiz=0&skor=310&kutlama=0', 'sonuc-kaybetti']]) {
        await page.goto(url(q), { waitUntil: 'load' });
        await page.locator('.result-actions').waitFor({ timeout: 30_000 });
        await page.locator('.result-title').click().catch(() => undefined); await sleep(900);
        const rec = await check(label);
        const btn = await page.evaluate(() => [...document.querySelectorAll('.result-actions button')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim(), l: Math.round(r.left), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; }));
        rec.buttons = btn;
        const bad = btn.filter((b) => b.l < 0 || b.r > W || b.b > H);
        if (bad.length) fail(rec, `sonuç düğmeleri görünüm dışında: ${JSON.stringify(bad)}`);
      }
    }
    if (want('kamp') && target === 'web') {
      // Kulak Kampı önizlemesi (yalnız yerel): Tedavi Odası paneli (tarifler, çanta) ve liste görünümündeki üretim kartı
      await page.goto(url('demo=kamp&seviye=10'), { waitUntil: 'load' });
      await page.getByRole('button', { name: /Yola çık|Devam/ }).first().click({ timeout: 45_000 });
      await page.locator('nav.tabbar .tab', { hasText: 'Kamp' }).click(); await sleep(800);
      const ub = page.getByRole('button', { name: 'Üs görünümü' }); if (await ub.count()) await ub.click(); // son görünüm hatırlanır
      await page.locator('.camp-base').waitFor({ timeout: 20_000 }); await sleep(1500); await toastGone();
      await page.locator('.sr-only button', { hasText: 'Tedavi Odası' }).evaluate((el) => el.click()); await page.locator('.bp').waitFor(); await sleep(700);
      await check('kamp-tedavi-paneli', { scroll: false });
      await page.locator('.tp-info').scrollIntoViewIfNeeded(); await sleep(300);
      await check('kamp-tedavi-tarif', { scroll: false });
      await page.getByRole('button', { name: 'Kapat' }).first().click().catch(() => undefined); await sleep(300);
      await page.getByRole('button', { name: 'Liste görünümü' }).click(); await sleep(600);
      await page.locator('[data-testid="tedavi-panel"]').scrollIntoViewIfNeeded(); await check('kamp-liste-tedavi');
      // kamp büyümesi (önizleme, Kamp Sv 22): üst gösterge, seviye paneli, süsleme kipi (seçili süs), bölge binası paneli
      await page.goto(url('demo=kamp&seviye=20&kampsv=22'), { waitUntil: 'load' });
      await page.getByRole('button', { name: /Yola çık|Devam/ }).first().click({ timeout: 45_000 });
      await page.locator('nav.tabbar .tab', { hasText: 'Kamp' }).click(); await sleep(800);
      const ub2 = page.getByRole('button', { name: 'Üs görünümü' }); if (await ub2.count()) await ub2.click();
      await page.locator('.camp-base').waitFor({ timeout: 20_000 }); await sleep(1800); await toastGone();
      await check('kamp-sv22', { scroll: false });
      // inşaat sürerken üst bant (İnşaatçı çipi uzun: "Merkez 2sa 10dk")
      await page.goto(url('demo=kamp&seviye=20&kampsv=22&insaat=merkez'), { waitUntil: 'load' });
      await page.getByRole('button', { name: /Yola çık|Devam/ }).first().click({ timeout: 45_000 });
      await page.locator('nav.tabbar .tab', { hasText: 'Kamp' }).click(); await sleep(800);
      { const u = page.getByRole('button', { name: 'Üs görünümü' }); if (await u.count()) await u.click(); }
      await page.locator('.hud-chip.builder.on').waitFor({ timeout: 20_000 }); await sleep(1200); await toastGone();
      await check('kamp-sv22-insaat', { scroll: false });
      await page.goto(url('demo=kamp&seviye=20&kampsv=22'), { waitUntil: 'load' });
      await page.getByRole('button', { name: /Yola çık|Devam/ }).first().click({ timeout: 45_000 });
      await page.locator('nav.tabbar .tab', { hasText: 'Kamp' }).click(); await sleep(800);
      { const u = page.getByRole('button', { name: 'Üs görünümü' }); if (await u.count()) await u.click(); }
      await page.locator('.camp-base').waitFor({ timeout: 20_000 }); await sleep(1500); await toastGone();
      await page.getByTestId('kamp-seviye').click(); await page.locator('.ks-panel').waitFor(); await sleep(600); await check('kamp-sv22-seviye-paneli', { scroll: false });
      await page.locator('.ks-panel .bp-x').click(); await sleep(300);
      await page.getByTestId('susle').click(); await page.getByTestId('sus-panel').waitFor(); await sleep(400); await page.locator('.dede-card .en-x').click({ timeout: 800 }).catch(() => undefined);
      await check('kamp-sv22-susle', { scroll: false });
      const dp = await page.evaluate(() => window.__kamp?.decor(1));
      if (dp) { await page.mouse.click(dp.x, dp.y); await sleep(600); await check('kamp-sv22-susle-secili', { scroll: false }); }
      await page.locator('.sus-done').click(); await sleep(400);
      await page.locator('.sr-only button', { hasText: 'Odyoloji Kütüphanesi' }).evaluate((el) => el.click()); await page.locator('.bp').waitFor(); await sleep(700);
      await check('kamp-kutuphane-paneli', { scroll: false });
      await page.getByRole('button', { name: 'Kapat' }).first().click().catch(() => undefined); await sleep(300);
    }
  } catch (e) {
    const rec = { screen: 'akış', fails: [] }; fail(rec, String(e.message ?? e).split('\n')[0]); recs.push(rec);
    await page.screenshot({ path: resolve(dir, `${String(++n).padStart(2, '0')}-HATA.png`) }).catch(() => undefined);
    console.log(`  ✗ ${name} · akış — ${rec.fails[0]}`);
  }
  if (errors.length) { const rec = { screen: 'konsol', fails: [] }; fail(rec, errors.slice(0, 4).join(' | ')); recs.push(rec); console.log(`  ✗ ${name} · konsol — ${errors.slice(0, 2).join(' | ')}`); }
  report.push({ run: name, screens: recs });
  await browser.close();
}

try {
  for (const target of targets) for (const b of browsers) for (const s of sizes) { console.log(`\n▶ ${target} · ${b} · ${s.join('×')}`); await suite(b, target, s); }
} finally {
  writeFileSync(resolve(outRoot, 'rapor.json'), JSON.stringify(report, null, 2));
  cleanup();
}
const total = report.reduce((a, r) => a + r.screens.length, 0);
console.log(`\n${failures ? '✗' : '✓'} ${total} ekran denetlendi, ${failures} sorun · çıktı: ${outRoot.replace(root + '/', '')}`);
process.exit(failures ? 1 : 0);
