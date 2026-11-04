#!/usr/bin/env node
// ODİ mobil kabuk denetimi (iPhone / Expo Go koşulları): her sekme ve alt sayfa için
//   · ekran görüntüsü (çentik ve ana çizgi alanı yarı saydam bantla işaretli),
//   · dokunmatik kaydırma (Chromium: CDP dokunma hareketi, WebKit: tekerlek) → kaydırma konumu değişmeli,
//   · yatay taşma: her öğenin sağ kenarı görünüm genişliği içinde (html/body/#root/.screen kırpması sayılmaz),
//   · sohbet giriş kutusu alt sekme çubuğunun üstünde ve görünür,
//   · üst güvenli alan (varsayılan 47 px): üst çubuk / ekran başlığı / sonuç üst satırı / alt sayfa çentiğin altında,
//   · metin kontrastı (WCAG AA: normal 4,5:1, büyük 3:1; measureContrast, MK-017).
// Hedefler:
//   web — apps/web derlemesi (vite preview); güvenli alan payları köprünün yaptığı gibi --safe-top/--safe-bottom ile verilir.
//   dom — Expo DOM paketi (apps/mobile/dist/www.bundle): gerçek WebApp köprüsü (insetTop/insetBottom prop'ları),
//         Expo'nun kendi sayfa iskeleti (viewport-fit yok, #root flex) ve yerel WebView'in scrollEnabled:false kilidi
//         (belge kaydırılamaz) taklit edilir — telefondaki koşulların aynısı.
// Kullanım: node tools/harness/ui-mobile-check.mjs [--target web|dom|both] [--browsers chromium,webkit]
//           [--sizes 390x844,320x640] [--tag after] [--no-build] [--build-dom] [--inset 47] [--only takma-ad,bugun,pratik,profil,kamp,takim,iletisim,etkinlik,sonuc,gorev]
//           [--sonuc rahat,kolay] (yalnız adında bu parçalar geçen sonuç ekranları)
//           [--buyuk-yazi]  (Ayarlar → Büyük yazı açık başlar: kayıt tohumu bigText; kök yazı 18,4 px olmalı)
//           [--kontrast-yok] (metin kontrastı ölçümünü kapatır; varsayılan: her ekranda WCAG AA, özet kontrast.json)
//           [--ek-css oneri.css] (her sayfaya ek stil: görsel önerinin önce/sonra görüntüleri için)
//           [--dist-ek ad] (web ve dom derlemesi dist-<ad> klasörlerinde: aynı ağaçta iki koşu ayrı derlemeyle)
//           [--magaza-fiyat] (yalnız dom: köprü gerçek satın alma + mağaza fiyatı verir (sahte EUR priceString, YN-032);
//                             yoksa köprüde fiyat yok → TL liste fiyatı ve "Mağaza fiyatı satın alırken gösterilir" notu)
// Çıktı: tools/harness/out/ui-mobile/<tag>/<hedef>-<tarayıcı>-<GxY>/NN-ad.png + rapor.json
import { randomBytes, scryptSync } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';
import { createServer } from 'node:net';
import { chromium, webkit } from 'playwright';
import { measureHudFit } from './hud-fit.mjs';
import { takimSekme } from './takim-sekme.mjs';
import { ekranOzeti } from './oyuncu/sayfa.mjs';

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
// --sonuc rahat,kolay: sonuç ekranlarından yalnız adında bu parçalardan biri geçenler (uzun listede tek değişikliği hızlı denetlemek için)
const SONUC = opt('sonuc', '') ? opt('sonuc').split(',') : null;
// Büyük yazı kipi: oyuncu kaydı bigText:true ile tohumlanır; her ekranda kök yazı ölçeği de denetlenir
const BIG = has('buyuk-yazi');
// metin kontrastı (MK-017, WCAG AA) her ekranda ölçülür; --kontrast-yok ile kapanır
const KONTRAST = !has('kontrast-yok');
// --ek-css <dosya>: her sayfaya ek stil (sahibe görsel öneri: aynı ekranların önce/sonra görüntüsü; ör. kontrast önerileri)
const EK_CSS = opt('ek-css', '') ? readFileSync(resolve(process.cwd(), opt('ek-css')), 'utf8') : '';
// --magaza-fiyat: sahte mağaza fiyatları (RevenueCat priceString yerine; en uzun "299,99 €" 320 px'te sığmalı)
const STORE_PRICES = has('magaza-fiyat') ? [['odi.baslangic', '5,49 €'], ['odi.kristal.1', '2,99 €'], ['odi.kristal.2', '14,99 €'], ['odi.kristal.3', '299,99 €'], ['odi.hiz.1', '7,99 €'], ['odi.hiz.2', '19,99 €'], ['odi.pass', '9,99 €']].map(([id, priceString]) => ({ id, priceString, currencyCode: 'EUR' })) : null;
if (STORE_PRICES && !targets.includes('dom')) console.warn('--magaza-fiyat yalnız dom hedefinde (mobil köprü) etkili; web hedefi köprüsüz koşar.');
const BASE_STATE = { ftue: { v: 1, story: true, tours: [], bypass: true }, ...(BIG ? { bigText: true } : {}) };
const outRoot = resolve(root, 'tools/harness/out/ui-mobile', tag); mkdirSync(outRoot, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = [];
const cleanup = () => { for (const p of procs) { try { p.kill(); } catch { /* yok */ } } };
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { cleanup(); process.exit(130); });
const run = (cmd, a, o = {}) => new Promise((res, rej) => { const p = spawn(cmd, a, { cwd: root, stdio: 'inherit', ...o }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${a.join(' ')} → ${c}`)))); });

// ---------------------------------------------------------------- derleme + sunucu
// --dist-ek <ad>: derleme klasörlerine ek (ör. aynı ağaçta "önce" koşusu sürerken "sonra" derlemesi ayrı klasörde)
const DIST_EK = opt('dist-ek', '') ? `-${opt('dist-ek')}` : '';
const distDir = resolve(root, `tools/harness/out/ui-mobile/dist${DIST_EK}`);
if (targets.includes('web') && (!has('no-build') || !existsSync(resolve(distDir, 'index.html')))) await run('npx', ['vite', 'build', '--outDir', distDir, '--emptyOutDir', '--logLevel', 'warn'], { cwd: resolve(root, 'apps/web') });
if (!existsSync(resolve(root, 'apps/server/dist/server.mjs')) || (!has('no-build') && targets.includes('web'))) await run('npm', ['run', 'build:server', '--silent']);
const mobileDist = resolve(root, `apps/mobile/dist${DIST_EK}`);
if (targets.includes('dom') && (has('build-dom') || !existsSync(resolve(mobileDist, 'www.bundle')))) {
  rmSync(mobileDist, { recursive: true, force: true });
  await run('npx', ['expo', 'export', '--platform', 'ios', '--output-dir', `dist${DIST_EK}`], { cwd: resolve(root, 'apps/mobile') });
}
/** işletim sisteminin verdiği boş port (rastgele aralık, aynı anda koşan başka ağaçların sunucu/önizlemesiyle çakışabiliyordu) */
const freePort = () => new Promise((res, rej) => { const s = createServer(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sport = await freePort();
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
  const wport = await freePort();
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
function domBridge([serverUrl, top, bottom, seed, base, prices]) {
  // ilk açılış rehberi (hikâye + anlatıcı turları + kilitler) bu denetimin konusu değil: atlanmış başlar (bkz. onboarding-e2e.mjs)
  const store = { 'odi-v1': JSON.stringify({ state: base, version: 3 }), ...(seed || {}) };
  window.ReactNativeWebView = {
    injectedObjectJson: () => JSON.stringify({ EXPO_DOM_HOST_OS: 'ios', initialProps: { names: ['getItem', 'setItem', 'removeItem', 'haptic', 'share', ...(prices ? ['purchase', 'storePrices'] : [])], props: { serverUrl, canPurchase: !!prices, insetTop: top, insetBottom: bottom } } }),
    postMessage: (s) => {
      try {
        const m = JSON.parse(s);
        if (m.type !== '$$native_action') return;
        const [k, v] = m.data.args ?? []; let result = null;
        if (m.data.actionId === 'getItem') result = store[k] ?? null;
        if (m.data.actionId === 'setItem') store[k] = v;
        if (m.data.actionId === 'removeItem') delete store[k];
        if (m.data.actionId === 'share') result = 'copied';
        // mağaza köprüsü (--magaza-fiyat): istenen ürünlerin sahte fiyatları; satın alma denetimde yapılmaz (iptal)
        if (m.data.actionId === 'storePrices') result = (prices || []).filter((x) => (k || []).includes(x.id));
        if (m.data.actionId === 'purchase') result = { ok: false, cancelled: true, error: 'denetim' };
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
/** arayüz metninde emoji: yalnız oyuncunun kendi yazdığı serbest metin (sohbet/özel mesaj balonu, takma ad, `data-ugc`) muaf;
 *  takım amblemi ve Kulak Kartı resmi (YN-044), hızlı tepki, çıkartma, özel mesaj tepkisi ve simge paneli, etkinlik simgesi (YN-071)
 *  oyunun sunduğu sabit seçeneklerdir, çizimdir, muaf değil;
 *  yer tutucu ve ::before/::after içeriği taranır; emoji yerine ui/art.tsx resimli ikonları kullanılmalı */
function measureEmoji() {
  const re = /(?:\p{Extended_Pictographic}|[▶★])️?/u; const skip = new Set(['©', '®', '™']);
  const ALLOW = '[data-ugc], .bubble, .msg-name, .dm-bubble, .dm-quote, .dm-inv-text, input, textarea, script, style, #__inset_top, #__inset_bottom';
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
/** kırpılan yazı: düğme, sekme, hap ve başlıklarda metin kutusundan taşıp gizleniyor mu (ellipsis/line-clamp bilinçli kısaltmadır, sayılmaz) */
function measureClip() {
  const out = [];
  for (const el of document.querySelectorAll('button, .btn, .tab, .pill, h1, h2, h3, label')) {
    if (el.closest('.cel-root, .map-stage, .camp-canvas, .level-host, .sr-only, #__inset_top, #__inset_bottom')) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) continue;
    if (cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none')) continue;
    const hx = /(hidden|clip)/.test(cs.overflowX), hy = /(hidden|clip)/.test(cs.overflowY);
    if (!((hx && el.scrollWidth > el.clientWidth + 1) || (hy && el.scrollHeight > el.clientHeight + 2))) continue;
    if (!(el.textContent || '').trim()) continue;
    out.push(`${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} “${(el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)}” ${el.scrollWidth}×${el.scrollHeight} > ${el.clientWidth}×${el.clientHeight}`);
  }
  return out.slice(0, 10);
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

/** metin kontrastı (WCAG 2.x AA, 1.4.3; MK-017): görünen her metin düğümü (ve dolu yazı kutusu) için yazı rengi ile arkasındaki zemin.
 *  Zemin ata zincirinden hesaplanır: her öğenin zemin rengi (saydamlığıyla) ve opacity grubu iç içe birleştirilir. Zincirde resim /
 *  gradyan zemin varsa (gövdenin gece gradyanı, cam paneller, tuval üstü göstergeler) zemin ekran görüntüsünden örneklenir (sample:true;
 *  Node tarafı yazılar gizlenmiş bir görüntüde metin kutusunun piksellerini okur). Eşik: normal 4,5:1; büyük (≥ 24 px ya da ≥ 18,66 px
 *  ve kalın) 3:1. WCAG'nin saydığı istisnalar (etkisiz/devre dışı denetim, salt süs, logo) ayrı listelenir; görünmeyenler (opacity ~0,
 *  sr-only, açık alt sayfanın örttüğü ekran) sayılmaz. Phaser tuvalindeki yazılar DOM'da olmadığı için ölçülmez. */
/** süren sonlu animasyonlar bitsin (en çok `max` ms); `name` verilirse yalnız o CSS animasyonu (ör. ekran girişi `screenIn`).
 *  Sonsuz döngüler (nabız, parıltı) beklenmez. Bitince bir kare daha beklenir ki son hâl boyansın. */
function animasyonBekle(page, { name = null, max = 2500 } = {}) {
  return page.evaluate(([name, max]) => Promise.race([
    Promise.all(document.getAnimations().filter((a) => { const t = a.effect?.getComputedTiming?.(); return a.playState === 'running' && t && Number.isFinite(t.endTime) && (!name || a.animationName === name); }).map((a) => a.finished.catch(() => undefined))),
    new Promise((r) => setTimeout(r, max))]).then(() => new Promise((r) => { requestAnimationFrame(() => requestAnimationFrame(r)); setTimeout(r, 1000); })), [name, max]);
}

function measureContrast([ISTISNA, BEKLEYEN]) {
  const parse = (s) => {
    if (!s || s === 'transparent') return [0, 0, 0, 0];
    let m = s.match(/^rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map((x) => (x.endsWith('%') ? parseFloat(x) / 100 : Number(x))); return [p[0] / 255, p[1] / 255, p[2] / 255, p.length > 3 ? p[3] : 1]; }
    m = s.match(/^color\(srgb\s+([^)]+)\)/);
    if (m) { const p = m[1].split(/[\s/]+/).filter(Boolean).map((x) => (x.endsWith('%') ? parseFloat(x) / 100 : Number(x))); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    return null;
  };
  const cache = new Map();
  const st = (el) => { let c = cache.get(el); if (!c) { const cs = getComputedStyle(el); c = { cs, bg: parse(cs.backgroundColor) ?? [0, 0, 0, 0], img: cs.backgroundImage !== 'none', op: Number(cs.opacity), filter: cs.filter !== 'none' ? cs.filter : '' }; cache.set(el, c); } return c; };
  const pm = (c) => [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]];
  const over = (t, b) => [t[0] + b[0] * (1 - t[3]), t[1] + b[1] * (1 - t[3]), t[2] + b[2] * (1 - t[3]), t[3] + b[3] * (1 - t[3])];
  const scale = (c, k) => c.map((v) => v * k);
  const un = (c) => (c[3] > 0 ? [c[0] / c[3], c[1] / c[3], c[2] / c[3]] : [0, 0, 0]);
  // opacity grupları iç içe: grup(i) = opacity_i × (grup(i+1) ⊕ zemin_i); en içte yazı katmanı (ya da boş)
  const composite = (chain, text) => {
    let g = text ? pm(text) : [0, 0, 0, 0];
    for (let i = chain.length - 1; i >= 0; i--) { const s = st(chain[i]); g = scale(over(g, pm(s.bg)), s.op); }
    return un(over(g, [1, 1, 1, 1]));
  };
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
  const desc = (el) => { const parts = []; for (let q = el, k = 0; q && q !== document.body && k < 3; q = q.parentElement, k++) { const c = typeof q.className === 'string' && q.className.trim() ? '.' + q.className.trim().split(/\s+/).slice(0, 2).join('.') : ''; parts.unshift(q.tagName.toLowerCase() + c); } return parts.join(' > '); };
  const W = innerWidth, H = innerHeight;
  const items = []; const nodes = []; const seen = new Set();
  const add = (el, textNode, text, colorStr) => {
    if (seen.has(textNode)) return; seen.add(textNode);
    if (el.closest('#__inset_top, #__inset_bottom, script, style, noscript, .sr-only')) return;
    const s = st(el); const cs = s.cs;
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    let r;
    if (textNode.nodeType === 3) { const rg = document.createRange(); rg.selectNodeContents(textNode); r = rg.getBoundingClientRect(); } else r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const chain = []; for (let q = el; q; q = q.parentElement) chain.unshift(q);
    let opAll = 1; for (const q of chain) opAll *= st(q).op;
    if (opAll < 0.1) return; // görünmez (solma ya da gizli öğe)
    // gizli kırpma: overflow kabının dışında kalan metin (ör. kapalı akordeon); kaydırma kabının görünmeyen kısmı sayılır (kaydırılınca görünür)
    for (const q of chain) { if (q === el) break; const qs = st(q).cs; if (/(hidden|clip)/.test(qs.overflow) && (q.clientHeight === 0 || q.clientWidth === 0)) return; }
    // SVG yazısı (grafik eksenleri): rengi fill (+ fill-opacity), boyutu çizim ölçeğiyle; arkası SVG şekilleri olabilir → hep örneklenir
    const svg = el instanceof SVGElement;
    let fg = parse(colorStr ?? (svg ? cs.fill : cs.color)) ?? (svg ? null : [1, 1, 1, 1]);
    if (!fg) return; // fill:none / url(...) dolgu
    if (svg) fg = [fg[0], fg[1], fg[2], fg[3] * Number(cs.fillOpacity || 1)];
    const fill = !svg && cs.webkitTextFillColor ? parse(cs.webkitTextFillColor) : null;
    let fs = parseFloat(cs.fontSize); const fw = Number(cs.fontWeight) || 400;
    if (svg) { const m = el.getScreenCTM?.(); if (m) fs *= Math.hypot(m.a, m.b); }
    const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
    const need = large ? 3 : 4.5;
    // örnekleme gerekir mi: zemin rengi tamamen örten en içteki katmanın üstünde resim/gradyan zemin var mı (ya da örten katmanı opacity delerse)
    let k = -1; for (let i = chain.length - 1; i >= 0; i--) { const z = st(chain[i]); if (z.bg[3] >= 0.999 && !z.img) { k = i; break; } }
    let opBelow = 1; for (let i = 0; i <= k; i++) opBelow *= st(chain[i]).op;
    let sample = svg || k < 0 || opBelow < 0.999; for (let i = Math.max(0, k + 1); i < chain.length && !sample; i++) if (st(chain[i]).img) sample = true;
    const filt = chain.map((q) => st(q).filter).filter(Boolean)[0] || '';
    const bg = composite(chain, null); const tx = composite(chain, fg);
    const item = { id: nodes.length, text: text.trim().replace(/\s+/g, ' ').slice(0, 40), sel: desc(el), fs: Math.round(fs * 10) / 10, fw, large, need,
      fg: hex(fg), fgA: Math.round(fg[3] * opAll * 100) / 100, tx: hex(tx), bg: hex(bg), ratio: Math.round(ratio(tx, bg) * 100) / 100, sample, filter: filt || undefined,
      fgRaw: fg, opAll };
    for (const [sel, why, min] of ISTISNA) if (el.closest(sel)) { item.istisna = why; if (min) { item.need = min; item.istisnaMin = min; } break; }
    if (!item.istisna && fill && fill[3] < 0.05 && cs.backgroundClip === 'text') item.istisna = 'gradyan metin (background-clip:text) — elle bakılmalı';
    // WCAG 1.4.3 istisnaları: etkisiz (devre dışı) denetimin parçası; salt süs ve logo yalnız KONTRAST_ISTISNA'daki gerekçeli seçicilerle
    // (aria-hidden kendiliğinden istisna sayılmaz: gören oyuncu o yazıyı okur)
    const dis = el.closest('button:disabled, input:disabled, select:disabled, textarea:disabled, fieldset:disabled, [aria-disabled="true"]');
    if (!item.istisna && dis) item.istisna = 'devre dışı denetim (WCAG 1.4.3: etkisiz arayüz öğesi)';
    if (!item.istisna) for (const [sel, why] of BEKLEYEN) if (el.closest(sel)) { item.bekleyen = why; break; }
    item.inView = r.top >= -1 && r.left >= -1 && r.bottom <= H + 1 && r.right <= W + 1;
    item.rect = [r.left, r.top, r.width, r.height];
    nodes.push(textNode); items.push(item);
  };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.nodeValue.trim()) continue; const el = n.parentElement; if (el) add(el, n, n.nodeValue); }
  // yazı kutuları: girilen değer (yer tutucu değil: boşsa ::placeholder rengi)
  for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]), textarea')) {
    const v = el.value || ''; const ph = el.getAttribute('placeholder') || '';
    if (v.trim()) add(el, el, v);
    else if (ph.trim()) { let c = null; try { c = getComputedStyle(el, '::placeholder').color; } catch { /* yok */ } add(el, el, ph, c && c !== getComputedStyle(el).color ? c : undefined); }
  }
  window.__kNodes = nodes;
  return items;
}
/** örneklenecek metinlerin güncel konumu ve üstünün açık olup olmadığı (kaydırmadan sonra yeniden okunur) */
function contrastRects(ids) {
  const W = innerWidth, H = innerHeight; const out = {};
  let ov = null;
  // boyalı sabit/yapışkan şeritler (ekranın %60'ından küçük; tam ekran katmanlar ve test bantları sayılmaz)
  const overlays = () => ov ??= [...document.querySelectorAll('body *')].filter((e) => {
    if (e.id === '__inset_top' || e.id === '__inset_bottom') return false;
    const cs = getComputedStyle(e); if (cs.position !== 'fixed' && cs.position !== 'sticky') return false;
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) return false;
    const paints = (x) => { const s = getComputedStyle(x); return s.backgroundImage !== 'none' || !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor) || (s.backdropFilter && s.backdropFilter !== 'none'); };
    // kabın kendisi boyasızsa (bildirim kabı) boyalı ilk çocuğu sayılır
    const painted = paints(e) || [...e.children].some(paints);
    const r = e.getBoundingClientRect(); return painted && r.width * r.height > 0 && r.width * r.height < W * H * 0.6;
  }).map((e) => ({ el: e, r: e.getBoundingClientRect(), z: Number(getComputedStyle(e).zIndex) || 0, sticky: getComputedStyle(e).position === 'sticky', root: fixedRoot(e.parentElement) }));
  function paintsVisibly(e) {
    if (e.id === '__inset_top' || e.id === '__inset_bottom') return false;
    const s = getComputedStyle(e); const a = (s.backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
    const paints = s.backgroundImage !== 'none' || (a.length === 4 ? a[3] > 0.05 : a.length === 3) || (s.backdropFilter && s.backdropFilter !== 'none');
    if (!paints) return false;
    let op = 1; for (let q = e; q; q = q.parentElement) op *= Number(getComputedStyle(q).opacity);
    return op > 0.1;
  }
  /** en dıştaki position:fixed ata (yoksa null): aynı sabit kabın içindeki yapışkan başlık, kabın içeriğini örter */
  function fixedRoot(e) { let f = null; for (let q = e; q && q !== document.body; q = q.parentElement) if (getComputedStyle(q).position === 'fixed') f = q; return f; }
  for (const id of ids) {
    const n = window.__kNodes?.[id]; if (!n || !n.isConnected) { out[id] = null; continue; }
    const el = n.nodeType === 3 ? n.parentElement : n;
    let rects;
    if (n.nodeType === 3) { const rg = document.createRange(); rg.selectNodeContents(n); rects = [...rg.getClientRects()].filter((q) => q.width >= 1 && q.height >= 1); }
    else {
      // yazı kutusu: kenarlık ve iç boşluk dışındaki içerik alanı (odak çerçevesi zemin sayılmasın)
      const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); const px = (k) => parseFloat(cs[k]) || 0;
      const l = b.left + px('borderLeftWidth') + px('paddingLeft'), t = b.top + px('borderTopWidth') + Math.max(px('paddingTop'), 2), r = b.right - px('borderRightWidth') - px('paddingRight'), bt = b.bottom - px('borderBottomWidth') - Math.max(px('paddingBottom'), 2);
      rects = [{ left: l, top: t, right: r, bottom: bt, width: r - l, height: bt - t }];
    }
    if (!rects.length) { out[id] = null; continue; }
    // görünür alan: görünüm ∩ kırpan/kaydıran ataların kutusu (alt sayfanın kaydırılmış dışı, yatay şeritlerin gizli kısmı)
    let cl = [0, 0, W, H];
    // position:fixed öğe (alt sayfa, Tüy Dede kartı) görünüme göre konumlanır: üstündeki kaydırma kapları onu kırpmaz
    for (let c = el, q = el.parentElement; q && q !== document.documentElement; c = q, q = q.parentElement) {
      if (getComputedStyle(c).position === 'fixed') break;
      const qs = getComputedStyle(q); if (qs.overflowX === 'visible' && qs.overflowY === 'visible') continue;
      const b = q.getBoundingClientRect(); cl = [Math.max(cl[0], b.left), Math.max(cl[1], b.top), Math.min(cl[2], b.right), Math.min(cl[3], b.bottom)];
    }
    // görünen parça: kırpılmış dikdörtgenler; üç noktayla kısaltılan (kabından taşan) yazıda taşan kısım hiç görünmez → en az %40'ı görünüyorsa ölçülür
    let all = 0, vis = 0; const parts = [];
    for (const q of rects) {
      const l = Math.max(q.left, cl[0]), t = Math.max(q.top, cl[1]), r = Math.min(q.right, cl[2]), b = Math.min(q.bottom, cl[3]);
      // satırın çoğu kırpılmışsa (kabın kenarında kalan ince şerit) o satır okunmaz: örneğe girmez
      all += q.width * q.height; if (r - l >= 1 && b - t >= 1 && (r - l) * (b - t) >= q.width * q.height * 0.4) { vis += (r - l) * (b - t); parts.push({ left: l, top: t, width: r - l, height: b - t, right: r, bottom: b }); }
    }
    const inView = parts.length > 0 && vis >= all * 0.4;
    rects = parts.length ? parts : rects;
    // üstü açık mı: metin kutusunun ortasında en üstteki öğe metnin kendisi (ya da atası/çocuğu) olmalı; açık alt sayfanın örttüğü ekran sayılmaz
    // sabit bir şerit / açılır pencere metnin bir kısmını örtüyorsa (kaydırınca metin altına girer) bu konumda ölçülmez
    let covered = false;
    // isabet yığını (yukarıdan aşağı): metnin kendisine/atasına varmadan boyalı ve görünür bir öğe gelirse örtülü. Ölçüm sırasında
    // bütün öğeler pointer-events:auto (contrastHide): pointer-events:none üst katmanlar (kamp üst bandı) da yakalanır
    if (inView) for (const q of rects.slice(0, 3)) for (const fx of [0.1, 0.5, 0.9]) for (const fy of [0.2, 0.5, 0.85]) {
      for (const hit of document.elementsFromPoint(q.left + q.width * fx, q.top + q.height * fy)) {
        if (hit === el || el.contains(hit) || hit.contains(el)) break;
        if (paintsVisibly(hit)) { covered = true; break; }
      }
      if (covered) break;
    }
    // yapışkan (sticky) öğe kaydırınca yer değiştirir: yalnız ilk konumunda ölçülür
    let sticky = false, pinned = false;
    for (let q = el; q && q !== document.body; q = q.parentElement) { const ps = getComputedStyle(q).position; if (ps === 'sticky') sticky = true; if (ps === 'fixed' || ps === 'sticky') pinned = true; }
    // akıştaki metin, sabit/yapışkan bir şeridin (sekme çubuğu, üst çubuk) altına girdiyse örtülüdür; şeridin boşlukları
    // pointer-events:none olabildiğinden isabet testi yetmez → kutu kesişimi
    // sabit/yapışkan bir kabın içindeki metin (alt sayfa) için yalnız daha üstteki katman (z-index büyük: ör. bildirim) örter
    const zOf = (e) => { let z = 0; for (let q = e; q && q !== document.body; q = q.parentElement) { const cs = getComputedStyle(q); if (cs.position === 'fixed' || cs.position === 'sticky') { z = Number(cs.zIndex) || 0; } } return z; };
    const zEl = pinned ? zOf(el) : -Infinity; const rootEl = fixedRoot(el);
    if (inView && !covered) for (const b of overlays()) if (!b.el.contains(el) && !el.contains(b.el) && ((b.sticky && b.root === rootEl) || b.z > zEl) && rects.some((q) => q.left < b.r.right && q.right > b.r.left && q.top < b.r.bottom && q.bottom > b.r.top)) { covered = pinned ? true : 'serit'; break; }
    let op = 1; for (let q = el; q; q = q.parentElement) op *= Number(getComputedStyle(q).opacity);
    out[id] = { inView, covered, sticky, op: Math.round(op * 100) / 100, rects: rects.slice(0, 4).map((q) => [q.left, q.top, q.width, q.height]) };
  }
  return out;
}
function contrastHide(on) {
  let s = document.getElementById('__kontrast');
  if (!on) { s?.remove(); return; }
  if (!s) { s = document.createElement('style'); s.id = '__kontrast'; document.head.appendChild(s); }
  s.textContent = '*,*::before,*::after,::placeholder{-webkit-text-fill-color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important;caret-color:transparent!important;transition:none!important}svg text,svg tspan{fill:transparent!important;stroke:transparent!important}input,textarea{color:transparent!important}*{pointer-events:auto!important}#__inset_top,#__inset_bottom{display:none!important}';
}
function scrollSave(restore) {
  if (restore) {
    const saved = new Map((window.__kScroll ?? []).map(([el, t, l]) => [el, [t, l]]));
    for (const el of document.querySelectorAll('html, body, body *')) if (el.scrollTop || el.scrollLeft || saved.has(el)) { const [t, l] = saved.get(el) ?? [0, 0]; el.scrollTop = t; el.scrollLeft = l; }
    window.__kScroll = null; return;
  }
  window.__kScroll = [...document.querySelectorAll('html, body, body *')].filter((el) => el.scrollTop || el.scrollLeft).map((el) => [el, el.scrollTop, el.scrollLeft]);
}

/** PNG çözücü (dış paket yok): 8 bit RGB/RGBA, taramasız (Playwright ekran görüntüleri) → { w, h, ch, px } */
function decodePng(buf) {
  let p = 8; const idat = []; let w = 0, h = 0, ct = 0;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8); const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; if (data[8] !== 8 || data[12] !== 0 || (ct !== 2 && ct !== 6)) throw new Error(`PNG biçimi desteklenmiyor (bit ${data[8]}, renk ${ct})`); }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)); const ch = ct === 6 ? 4 : 3; const stride = w * ch; const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; const src = y * (stride + 1) + 1; const o = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[o + x - ch] : 0, b = y ? px[o - stride + x] : 0, c = x >= ch && y ? px[o - stride + x - ch] : 0; let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[o + x] = v & 255;
    }
  }
  return { w, h, ch, px };
}
const kLin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const kLum = (c) => 0.2126 * kLin(c[0]) + 0.7152 * kLin(c[1]) + 0.0722 * kLin(c[2]);
const kRatio = (a, b) => { const x = kLum(a), y = kLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const kHex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
/** örneklenen zemin: metin kutularının pikselleri (yazılar gizli); yazı rengi (saydamlığıyla) her piksele bindirilir.
 *  Sonuç oranı: piksellerin %10'luk alt dilimi (tek tük yıldız ya da kenar çizgisi sonucu bozmasın, gradyanın kötü yarısı sayılsın) */
function sampleContrast(img, rects, fg, alpha) {
  const rs = [];
  let area = 0; for (const [, , w, h] of rects) area += w * h;
  const step = Math.max(1, Math.sqrt(area / 1200));
  let worstBg = null, worst = Infinity;
  // satır kutusunun üst/alt boşluğu (yarım satır aralığı) harf değildir: kutunun dikeyde ortadaki %70'i örneklenir
  for (const [l, t0, w, h0] of rects) { const t = t0 + h0 * 0.15, h = h0 * 0.7; for (let y = t + step / 2; y < t + h; y += step) for (let x = l + step / 2; x < l + w; x += step) {
    const xi = Math.min(img.w - 1, Math.max(0, Math.floor(x))), yi = Math.min(img.h - 1, Math.max(0, Math.floor(y))); const o = (yi * img.w + xi) * img.ch;
    const bg = [img.px[o] / 255, img.px[o + 1] / 255, img.px[o + 2] / 255];
    const tx = [0, 1, 2].map((i) => fg[i] * alpha + bg[i] * (1 - alpha));
    const r = kRatio(tx, bg); rs.push([r, bg, tx]); if (r < worst) { worst = r; worstBg = bg; }
  } }
  if (!rs.length) return null;
  rs.sort((a, b) => a[0] - b[0]);
  const [r, bg, tx] = rs[Math.floor(rs.length * 0.1)];
  return { ratio: Math.round(r * 100) / 100, bg: kHex(bg), tx: kHex(tx), min: Math.round(worst * 100) / 100, minBg: kHex(worstBg), n: rs.length };
}
/** sahip kararı bekleyen kontrast açıkları (MK-017): düzeltmesi dolgu rengini (marka/vurgu rengi) ya da görünümü değiştirdiği için
 *  uygulanmadı; öneri ve önce/sonra görüntüleri tools/harness/out/kontrast-oneri/ (oneri.css, Ö1–Ö7). Koşuyu düşürmez, ayrı sayılır
 *  ve listelenir. Sahip bir öneriyi kabul edince satırı silinir (ölçüm o zaman gerçekten 4,5:1'i arar). */
const KONTRAST_BEKLEYEN = [
  ['.dot, .sbadge, .kg-badge:not(.teal), .cnt-badge', 'Ö1 bildirim rozeti: beyaz sayı mercan dolguda (2,94:1)'],
  ['.btn.ghost, .seg button.on, .msg.mine .bubble, .race-msg.mine, .ribbon', 'Ö2 mor dolgu: beyaz yazı açık mor degradede'],
  ['.btn.coral, .ev-mon-card .btn, .fc-actions .btn, .badge-record', 'Ö3 mercan dolgu: beyaz yazı açık mercan degradede'],
  ['.ks-badge, .mh-lvl', 'Ö4 seviye rozeti: küçük etiket açık mor degradede'],
  ['.camp-susle', 'Ö5 Süsle düğmesi: koyu yazı açık mor degradede'],
  ['.bp-tier, .kg-tier, .kg-badge.teal', 'Ö6 kademe çipi: beyaz yazı malzeme renginde'],
  ['.ev-band, .map-goal', 'Ö7 etkinlik şeridi / hedef bayrağı: açık degrade'],
];
/** WCAG'nin izin verdiği, gerekçeli kontrast istisnaları (seçici → gerekçe); rapor bunları ayrıca listeler */
const KONTRAST_ISTISNA = [
  ['.ts-logo', 'logo (WCAG 1.4.3: logotip) — açılış ekranındaki ODİ yazı markası, gradyan dolgulu'],
  ['.kg-legend b.r, .kg-legend b.l', 'odyogram işareti (“<”, “[”: grafikteki maskeleme simgesinin glifi, sözcük değil) — WCAG 1.4.11 grafik nesne, eşik 3:1; renk grafikteki sağ/sol kulak rengiyle aynı kalmalı', 3],
];

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
function writeReports() {
  writeFileSync(resolve(outRoot, 'rapor.json'), JSON.stringify(report, null, 2));
  if (KONTRAST) writeFileSync(resolve(outRoot, 'kontrast.json'), JSON.stringify(contrastSummary(), null, 2));
}
/** bütün koşuların kontrast bulguları, aynı seçici + renk çiftine göre gruplanmış (belirteç düzeltmesi için) */
function contrastSummary() {
  const groups = new Map(), exc = new Map(), pen = new Map(); let measured = 0, unmeasured = 0, violations = 0, exceptions = 0, pending = 0;
  const put = (m, x, where) => {
    const key = `${x.sel}|${x.tx}|${x.sampled ? 'örnek' : x.bg}|${x.need}`;
    const g = m.get(key) ?? { sel: x.sel, text: x.text, tx: x.tx, bg: x.bg, fs: x.fs, fw: x.fw, need: x.need, ratio: x.ratio, sampled: !!x.sampled, istisna: x.istisna, bekleyen: x.bekleyen, count: 0, screens: [] };
    g.count++; if (x.ratio < g.ratio) { g.ratio = x.ratio; g.bg = x.bg; g.text = x.text; } if (!g.screens.includes(where)) g.screens.push(where); m.set(key, g);
  };
  for (const r of report) for (const sc of r.screens) {
    const c = sc.contrast; if (!c) continue; measured += c.n; unmeasured += c.unmeasured;
    for (const v of c.violations) { violations++; put(groups, v, `${r.run}/${sc.screen}`); }
    for (const v of c.exceptions) { exceptions++; put(exc, v, `${r.run}/${sc.screen}`); }
    for (const v of c.pending ?? []) { pending++; put(pen, v, `${r.run}/${sc.screen}`); }
  }
  const sort = (m) => [...m.values()].sort((a, b) => b.count - a.count || a.ratio - b.ratio);
  const byNote = {}; for (const g of pen.values()) byNote[g.bekleyen] = (byNote[g.bekleyen] ?? 0) + g.count;
  return { measured, unmeasured, violations, exceptions, pending, pendingByProposal: byNote, groups: sort(groups), exceptionGroups: sort(exc), pendingGroups: sort(pen) };
}
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
  // KARE_OLC=1: kare aralığı (rAF) ve uzun görevler (ana iş parçacığı > 50 ms) ölçülür, her ekranda yazılır (MK-020 tanı: donma mı, yük mü)
  if (process.env.KARE_OLC) await page.addInitScript(() => {
    const k = window.__kare = { n: 0, max: 0, uzun: 0, last: 0, lt: 0, ltMax: 0, ltSum: 0 };
    const f = (t) => { if (k.last) { const d = t - k.last; if (d > k.max) k.max = d; if (d > 1000) k.uzun++; } k.last = t; k.n++; requestAnimationFrame(f); };
    requestAnimationFrame(f);
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { k.lt++; k.ltSum += e.duration; if (e.duration > k.ltMax) k.ltMax = e.duration; } }).observe({ type: 'longtask', buffered: true }); } catch { /* WebKit: longtask yok */ }
  });
  if (EK_CSS) await page.addInitScript((css) => { const put = () => { const st = document.createElement('style'); st.id = '__ek_css'; st.textContent = css; document.head.appendChild(st); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', put); else put(); }, EK_CSS);
  if (target === 'dom') await page.addInitScript(domBridge, [wsUrl, INSET, INSET_B, null, BASE_STATE, STORE_PRICES]);
  else {
    await page.addInitScript(webInsets, [INSET, INSET_B]);
    await page.addInitScript((base) => { try { if (!localStorage.getItem('odi-v1')) localStorage.setItem('odi-v1', JSON.stringify({ state: base, version: 3 })); } catch { /* depolama yok */ } }, BASE_STATE);
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
  /** metin kontrastı (measureContrast): animasyonlar biter, metinler ölçülür; resim/gradyan zeminliler yazılar gizlenmiş ekran
   *  görüntüsünden örneklenir (görünüm dışındakiler sırayla görünüme kaydırılır, sonra kaydırma konumları geri yüklenir) */
  let kIlerleme = 0; // kontrast ölçümünün son ilerlediği an (bekçi: aşağıda)
  async function contrast(rec, file, label = '') {
    // solma/kayma animasyonu sürerken ölçülen yarı saydam metin yanlış ihlal olur (WebKit 320'de boş görüntü notu): sonlu animasyonlar bitsin
    await animasyonBekle(page, { max: 2500 });
    await sleep(150); // animasyon bitişinden sonraki kare (WebKit yükte geç boyar)
    // kaydırma dursun (scrollIntoViewIfNeeded WebKit'te yumuşak kayabilir; animasyon listesinde görünmez): 3 kare aynı konum, en çok 1,5 sn
    await page.evaluate(() => new Promise((res) => {
      const snap = () => [...document.querySelectorAll('html, body, body *')].filter((e) => e.scrollTop || e.scrollLeft).map((e) => `${e.scrollTop},${e.scrollLeft}`).join(';');
      let last = snap(), same = 0; const t0 = performance.now();
      const tick = () => { const now = snap(); same = now === last ? same + 1 : 0; last = now; if (same >= 3 || performance.now() - t0 > 1500) res(); else requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }));
    const items = await page.evaluate(measureContrast, [KONTRAST_ISTISNA, KONTRAST_BEKLEYEN]); kIlerleme = Date.now();
    const ids = items.map((i) => i.id);
    await page.evaluate(scrollSave, false); await page.evaluate(contrastHide, true);
    try {
      let pos = await page.evaluate(contrastRects, ids); let img = null, imgBuf = null; const done = new Set();
      for (let round = 0; round < 30; round++) {
        kIlerleme = Date.now();
        // ilk turdan sonra yapışkan öğeler ölçülmez (kaydırma onları başka öğelerin üstüne/altına taşır)
        if (round > 0) for (const i of items) if (!done.has(i.id) && pos[i.id]?.sticky) { done.add(i.id); if (i.sample) i.unmeasured = true; }
        const now = items.filter((i) => !done.has(i.id) && pos[i.id]?.inView);
        let moved = new Set();
        if (now.some((i) => i.sample && !pos[i.id].covered)) {
          const buf = await page.screenshot({ scale: 'css' }); img = decodePng(buf); imgBuf = buf;
          if (process.env.KONTRAST_DEBUG) writeFileSync(file.replace(/\.png$/, `-kontrast${round}.png`), buf);
          // görüntü alınırken kapanan / kayan / solan öğe (Tüy Dede kartı, bildirim): bu turdaki örnek geçersiz, bir kez daha denenir
          const sIds = now.filter((i) => i.sample && !pos[i.id].covered).map((i) => i.id);
          const after = await page.evaluate(contrastRects, sIds);
          for (const id of sIds) { const a = after[id], b = pos[id]; if (!a || JSON.stringify(a.rects) !== JSON.stringify(b.rects) || Math.abs(a.op - b.op) > 0.02) moved.add(id); }
        }
        let bad = false;
        for (const i of now) {
          // örtülü: bir kez başka konumda (metin üstte) yeniden denenir, yine örtülüyse sayılmaz
          // hesapla ölçülen (örneklenmeyen) metin şerit altında kalsa da ölçülmüş sayılır: zinciri konumdan bağımsız
          if (pos[i.id].covered === 'serit' && !i.sample) { done.add(i.id); continue; }
          if (pos[i.id].covered) { if (i.sample && !i.retried) { i.retried = true; continue; } done.add(i.id); i.covered = true; continue; }
          if (moved.has(i.id)) { if (i.moves = (i.moves ?? 0) + 1, i.moves < 2) continue; done.add(i.id); i.unmeasured = true; i.why = 'görüntü alınırken kayboldu/kaydı'; continue; }
          done.add(i.id);
          if (!i.sample) continue;
          const sm = sampleContrast(img, pos[i.id].rects, i.fgRaw, i.fgRaw[3] * i.opAll);
          if (sm) Object.assign(i, { ratio: sm.ratio, bg: sm.bg, tx: sm.tx, min: sm.min, minBg: sm.minBg, sampled: true });
          if (sm && sm.ratio < i.need && !i.istisna && !i.bekleyen) {
            // doğrulama: yükte (özellikle WebKit) stil değişikliğinden sonraki ilk kare eksik boyanabiliyor → bir kare sonra yeniden örnekle
            await sleep(300);
            const buf2 = await page.screenshot({ scale: 'css' }); const pos2 = (await page.evaluate(contrastRects, [i.id]))[i.id];
            const sm2 = pos2?.inView && !pos2.covered ? sampleContrast(decodePng(buf2), pos2.rects, i.fgRaw, i.fgRaw[3] * i.opAll) : null;
            if (sm2 && sm2.ratio >= i.need) { Object.assign(i, { ratio: sm2.ratio, bg: sm2.bg, tx: sm2.tx, min: sm2.min, minBg: sm2.minBg, resampled: sm.ratio }); continue; }
            imgBuf = buf2;
            if (process.env.KONTRAST_IZ) { const im = decodePng(buf2); const [l, t, w, h] = pos[i.id].rects[pos[i.id].rects.length - 1]; const x = Math.floor(l + w / 2), y = Math.floor(t + h / 2), o = (y * im.w + x) * im.ch; console.error(`    [kontrast] ihlal ${i.text.slice(0, 20)} img ${im.w}x${im.h}/${im.ch} (${x},${y}) = ${im.px[o]},${im.px[o + 1]},${im.px[o + 2]} rects=${JSON.stringify(pos[i.id].rects)} sm=${JSON.stringify(sm)} sm2=${JSON.stringify(sm2)} pos2=${JSON.stringify(pos2)}`); }
            bad = true;
            // tanı: metin kutusunun ortasındaki isabet yığını (örtme algılanamadıysa nedenini görmek için)
            const [l, t, w, h] = pos[i.id].rects[0];
            i.stack = await page.evaluate(([x, y]) => document.elementsFromPoint(x, y).slice(0, 6).map((e) => `${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`).join(' › '), [l + w / 2, t + h / 2]);
            i.sampleRect = pos[i.id].rects.map((q) => q.map(Math.round));
          }
        }
        // örneklenen bir ihlal varsa yazıları gizlenmiş görüntü kanıt olarak kalır (…-kontrastN.png)
        if (bad && imgBuf && !process.env.KONTRAST_DEBUG) writeFileSync(file.replace(/\.png$/, `-kontrast${round}.png`), imgBuf);
        for (const i of items) if (!done.has(i.id) && !pos[i.id]) done.add(i.id); // kayboldu
        const next = items.find((i) => !done.has(i.id) && i.sample);
        if (process.env.KONTRAST_IZ) console.error(`    [kontrast] ${label} tur ${round}: ${done.size}/${items.length} bitti, sıradaki ${next ? next.sel.split(' > ').pop() + ' “' + next.text.slice(0, 16) + '”' : '-'}`);
        if (!next) break;
        const block = next.retried ? 'start' : 'center';
        const dbg = await page.evaluate(([id, block]) => {
          const n = window.__kNodes[id]; const el = n.nodeType === 3 ? n.parentElement : n; const sc = [];
          for (let q = el.parentElement; q; q = q.parentElement) if (q.scrollHeight > q.clientHeight + 1 || q.scrollWidth > q.clientWidth + 1) sc.push([q, q.scrollTop, q.scrollLeft]);
          el.scrollIntoView({ block, inline: 'center', behavior: 'instant' });
          return sc.map(([q, t, l]) => `${q.tagName.toLowerCase()}.${String(q.className).split(' ')[0]} ${t},${l}→${q.scrollTop},${q.scrollLeft} (${q.scrollHeight}/${q.clientHeight})`).join(' ; ');
        }, [next.id, block]);
        await sleep(120);
        pos = await page.evaluate(contrastRects, ids.filter((id) => !done.has(id)));
        if (!pos[next.id]?.inView) { done.add(next.id); next.unmeasured = true; next.why = `${JSON.stringify(pos[next.id]?.rects?.[0]?.map(Math.round))} ${dbg}`; }
      }
      for (const i of items) if (i.sample && !i.sampled && !i.covered && !i.unmeasured) i.unmeasured = true;
    } finally { await page.evaluate(contrastHide, false); await page.evaluate(scrollSave, true); }
    const unmeasured = items.filter((i) => i.unmeasured).length;
    const live = items.filter((i) => !i.covered && !i.unmeasured);
    const low = live.filter((i) => i.ratio < i.need);
    const strip = ({ fgRaw: _f, opAll: _o, inView: _v, id: _i, ...x }) => ({ ...x, rect: x.rect?.map(Math.round) });
    // istisnanın kendi alt eşiği varsa (ör. grafik simgesi 3:1) ona göre: low zaten i.need'e göre süzüldü
    const viol = low.filter((i) => (!i.istisna || i.istisnaMin) && !i.bekleyen).map(strip); const exc = low.filter((i) => i.istisna && !i.istisnaMin).map(strip); const pend = low.filter((i) => i.bekleyen).map(strip);
    rec.contrast = { n: live.length, sampled: live.filter((i) => i.sampled).length, covered: items.filter((i) => i.covered).length, unmeasured, violations: viol, exceptions: exc, pending: pend,
      unmeasuredItems: items.filter((i) => i.unmeasured).slice(0, 12).map((i) => `${i.sel} “${i.text}” ${i.rect?.map(Math.round).join(',')}${i.why ? ' · ' + i.why : ''}`) };
    if (viol.length) fail(rec, `kontrast (${viol.length}): ${viol.slice(0, 3).map((x) => `${x.sel.split(' > ').pop()} “${x.text.slice(0, 18)}” ${x.ratio}<${x.need}`).join(' | ')}`);
  }
  /** bir ekranı denetle: görüntü, taşma, üst pay, (uzunsa) kaydırma; opsiyonel sohbet kontrolü */
  async function check(label, { scroll = true, chat = false, top = true, emoji = true } = {}) {
    await sleep(350);
    const rec = { screen: label, fails: [] };
    const file = resolve(dir, `${String(++n).padStart(2, '0')}-${label}.png`);
    // ekran girişi (screenIn: saydamdan belirir) bitmeden çekilen görüntü boş kalıyordu (WebKit'te yükte 12 alt sayfa); en çok 3 sn
    await animasyonBekle(page, { name: 'screenIn', max: 3000 });
    if (process.env.KARE_OLC) { const k = await page.evaluate(() => { const k = window.__kare; if (!k) return null; const r = { ...k }; Object.assign(k, { n: 0, max: 0, uzun: 0, lt: 0, ltMax: 0, ltSum: 0 }); return r; }); if (k) console.log(`  ⏱ ${label}: ${k.n} kare, en uzun kare aralığı ${Math.round(k.max)} ms, >1 sn: ${k.uzun}; uzun görev ${k.lt} (en uzun ${Math.round(k.ltMax)} ms, toplam ${Math.round(k.ltSum)} ms)`); }
    await page.screenshot({ path: file }); rec.shot = file.replace(root + '/', '');
    const ov = await page.evaluate(measureOverflow); rec.overflow = ov;
    if (ov.count > 0 || ov.docScrollW > 0) fail(rec, `yatay taşma: ${ov.offenders.slice(0, 3).join(' | ')}${ov.docScrollW > 0 ? ` (belge +${ov.docScrollW}px)` : ''}`);
    if (top) { const t = await page.evaluate(measureTop, INSET); rec.top = t; if (!t.ok) fail(rec, `üst pay: ${t.worst?.s} top=${t.worst?.top} < ${INSET}`); }
    // ekran başlığı kesilmemeli (üst çubuk hapları başlığı “T…” yapmasın)
    const cut = await page.evaluate(() => [...document.querySelectorAll('.tb-title h1, .screen-head h1')].filter((h) => h.getBoundingClientRect().width > 0 && h.scrollWidth > h.clientWidth + 1).map((h) => h.textContent));
    if (cut.length) fail(rec, `başlık kesildi: ${cut.join(', ')}`);
    // kamp üst bandı: her gösterge çipi ekranın içinde, kırpılmadan (Kamp Seviyesi, İnşaatçı, hızlandırıcılar, Görevler/Klinik, ziyaret)
    const hf = await page.evaluate(measureHudFit); if (hf.present) { rec.hud = hf; if (hf.offenders.length) fail(rec, `kamp üst bandı taşıyor: ${hf.offenders.slice(0, 3).join(' | ')}`); }
    // kırpılan yazı: düğme/sekme/başlık metni kutusuna sığmıyor (taşan kısım gizli; üç nokta ya da satır sınırı bilinçli değilse)
    const clip = await page.evaluate(measureClip); rec.clip = clip; if (clip.length) fail(rec, `yazı kırpıldı: ${clip.slice(0, 3).join(' | ')}`);
    if (BIG) { const fs = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize); rec.rootFont = fs; if (fs !== '18.4px') fail(rec, `büyük yazı uygulanmadı: kök ${fs}`); }
    if (emoji) { const em = await page.evaluate(measureEmoji); rec.emoji = em; if (em.length) fail(rec, `arayüzde emoji (${em.length}): ${em.slice(0, 6).join(' | ')}`); }
    if (KONTRAST) {
      // takılan ölçüm koşuyu durdurmasın: ölçüm 120 sn hiç ilerlemezse (ne öğe listesi ne bir tur biter) ekran düşer. Toplam süre sınırı
      // değil: yükte (≈20–46) bir ekranın 30 turluk ölçümü ilerlerken 120 sn'yi aşıp düşüyordu (MK-034, dom-chromium-320 sonuc-kaybetti)
      kIlerleme = Date.now();
      let to; const limit = new Promise((_, rej) => { to = setInterval(() => { if (Date.now() - kIlerleme > 120_000) rej(new Error('kontrast ölçümü 120 sn ilerlemedi')); }, 1000); });
      try { await Promise.race([contrast(rec, file, label), limit]); } catch (e) { fail(rec, String(e.message ?? e).split('\n')[0]); await page.evaluate(contrastHide, false).catch(() => undefined); } finally { clearInterval(to); }
    }
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
  // yer bekleyen (gizli, YN-145) bildirim de kapatılır: tıklama DOM'dan (görünmeyen öğeye fare tıklaması gitmez)
  const toastGone = async () => { for (let i = 0; i < 8 && await page.locator('.toast-top').count(); i++) { await page.evaluate(() => document.querySelector('.toast-top')?.click()).catch(() => undefined); await sleep(150); } };
  const back = async () => { const b = page.getByRole('button', { name: 'Geri' }).first(); if (await b.count()) await b.click(); await sleep(400); };

  try {
    // ---- açılış + takma ad
    await page.goto(url(), { waitUntil: 'load' });
    await page.getByRole('button', { name: /Yola çık/ }).waitFor({ timeout: 45_000 }); await sleep(700);
    await check('giris', { scroll: false });
    await page.getByRole('button', { name: /Yola çık/ }).click({ timeout: 45_000 });
    await page.locator('.onboard').waitFor({ timeout: 15_000 });
    if (want('takma-ad')) {
      // takma ad kartı + Bilgi düzeyi sorusu (karar 31): Ayarlar'daki iki seçenek, geçilebilir (varsayılan Genel)
      await sleep(600); const rec = await check('takma-ad', { scroll: false });
      const secenek = await page.locator('[data-testid="onboard-bilgi"] [role="radio"]').allTextContents();
      if (secenek.join('|') !== 'Genel|Odyoloji öğrencisi') fail(rec, `takma ad kartında Bilgi düzeyi seçenekleri yok/yanlış: ${JSON.stringify(secenek)}`);
    }
    await page.getByRole('textbox', { name: 'Takma ad' }).fill(PAGE_NAME);
    await page.getByRole('button', { name: 'Başla' }).click();
    await page.locator('.onboard').waitFor({ state: 'detached' });
    await toastGone();
    await page.locator('.net-dot.on').first().waitFor({ timeout: 10_000 }).catch(() => undefined);
    await check('harita', { scroll: false });

    if (want('bugun')) { await tab('Bugün'); await check('bugun'); }
    if (want('pratik')) {
      // Bilgi pratiği (YN-078): Bugün'den açılır (takımsız oyuncu); giriş, soru, cevap + açıklama, sonuç. Ödülsüz: kayıttaki jeton/XP/meta değişmez (web)
      await tab('Bugün'); const ac = page.getByTestId('bugun-pratik-ac'); await ac.scrollIntoViewIfNeeded(); await sleep(200);
      const kayit = () => (target === 'web' ? page.evaluate(() => { const st = JSON.parse(localStorage.getItem('odi-v1') ?? '{}').state ?? {}; return JSON.stringify({ c: st.coins, x: st.xp, m: st.meta }); }) : Promise.resolve(''));
      const once = await kayit();
      await check('bugun-pratik-karti', { scroll: false });
      await ac.click(); await page.getByTestId('pratik').waitFor({ timeout: 10_000 });
      await check('pratik-giris');
      await page.getByTestId('pratik-basla').click(); await page.getByTestId('pratik-secenek-0').waitFor();
      await check('pratik-soru');
      for (let k = 0; k < 10; k++) {
        await page.getByTestId('pratik-secenek-0').click(); await page.getByTestId('pratik-aciklama').waitFor();
        if (k === 0) await check('pratik-cevap');
        await page.getByTestId('pratik-sonraki').click(); await sleep(80);
      }
      await page.getByTestId('pratik-dogru').waitFor();
      const rec = await check('pratik-sonuc');
      if (!/^\d+\/10$/.test((await page.getByTestId('pratik-dogru').textContent()) ?? '')) fail(rec, 'pratik sonucu "N/10" değil');
      if ((await kayit()) !== once) fail(rec, 'pratik oyuncu kaydını değiştirdi (ödül/ilerleme yazılmamalı)');
      await back();
    }
    if (want('profil')) {
      // Kurucu Yolcu (YN-041): bu yapılandırmaya özel tek kullanımlık test kodu (gerçek kodlar depoda yoktur) → rozet, çerçeve,
      // Dolap'ta çerçeve, Ayarlar'da liste seçimi ve Kurucular ekranı aşağıdaki karolarla birlikte denetlenir
      { const { DatabaseSync } = await import('node:sqlite');
        const kod = `KURUCU-TEST-${randomBytes(3).toString('hex').toUpperCase().replace(/[^A-Z0-9]/g, 'X')}`;
        const sq = new DatabaseSync(dbFile); sq.exec('PRAGMA busy_timeout = 3000');
        sq.prepare("INSERT INTO promo_codes(code, rewards, max_uses, active, note, created_at, created_by) VALUES(?, '{\"rozet\":[\"kurucu\"]}', 1, 1, 'Kurucu Yolcu', ?, 'test')").run(kod, Date.now()); sq.close();
        await tab('Profil');
        await page.locator('.menu-tile[data-tile="kod"]').click(); await page.getByTestId('kod-sayfasi').waitFor();
        await page.getByTestId('kod-girdi').fill(kod.toLowerCase()); await page.getByTestId('kod-kullan').click();
        await page.locator('[data-testid="kod-sonuc"]', { hasText: 'Kurucu Yolcu' }).waitFor();
        await check('kod-kurucu', { scroll: false });
        await page.keyboard.press('Escape'); await sleep(300);
        await page.locator('.profile-hero [data-rozet="kurucu"]').waitFor(); await page.locator('.profile-hero [data-testid="kurucu-cerceve"]').waitFor();
        await page.evaluate(resetScroll); await sleep(200); }
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
      // Kurucular: "Adım listede görünsün" açılınca takma ad listede (varsayılan kapalı)
      { await page.locator('.menu-tile[data-tile="kurucular"]').click(); await page.getByTestId('kurucular').waitFor();
        await page.getByTestId('kurucu-listede').click(); await page.locator('[data-testid="kurucu-listede"][aria-pressed="true"]').waitFor();
        await page.locator('[data-testid="kurucu-listesi"] li', { hasText: PAGE_NAME }).first().waitFor({ timeout: 10_000 });
        await check('kurucular-liste');
        await back(); if (!(await page.locator('.menu-tile').count())) await tab('Profil'); }
      // mağaza onay sayfası + fiyat kaynağı (YN-032): köprü fiyat verdiyse mağazanın biçimi (notsuz), vermediyse TL liste fiyatı + not
      { await page.locator('.menu-tile[data-tile="shop"]').click(); await page.locator('.card.product .btn.small').first().waitFor({ timeout: 20_000 });
        const storeOn = !!STORE_PRICES && target === 'dom';
        const beklenen = storeOn ? STORE_PRICES[0].priceString : '49,99 TL';
        const kart = (await page.locator('.card.product .btn.small').first().textContent())?.trim();
        const not = await page.getByTestId('fiyat-notu').count();
        await page.locator('.card.product .btn.small').first().click(); await page.locator('.sheet').waitFor(); await sleep(400);
        // ilk satın almadan önce aylık sınır seçimi (karar 28): önerilen 100 TL seçili; kaydedince onay sayfası
        if (await page.getByTestId('ilk-sinir').count()) {
          await check('magaza-ilk-sinir', { scroll: false });
          await page.getByTestId('ilk-sinir-kaydet').click(); await page.getByTestId('onay-fiyat').waitFor({ timeout: 10_000 }); await sleep(400);
        }
        const r = await check('magaza-onay', { scroll: false });
        const onay = (await page.getByTestId('onay-fiyat').textContent())?.trim();
        const yanlis = [kart !== beklenen && `kart fiyatı “${kart}” ≠ “${beklenen}”`, onay !== beklenen && `onay fiyatı “${onay}” ≠ “${beklenen}”`, storeOn === !!not && `TL notu ${not ? 'var' : 'yok'}`].filter(Boolean);
        if (yanlis.length) { fail(r, `mağaza fiyatı: ${yanlis.join(', ')}`); console.log(`  ✗ ${name} · magaza-onay — mağaza fiyatı: ${yanlis.join(', ')}`); }
        await page.locator('.sheet').getByRole('button', { name: 'Vazgeç' }).click(); await sleep(300);
        // sınırı yükseltmek ayrı onay adımı ister (karar 28): onay sayfasını denetle, vazgeç
        await page.getByRole('button', { name: 'Sınırı ayarla' }).click(); await page.locator('.sheet .limit-grid').waitFor();
        await page.locator('.sheet .limit-grid .chip-btn', { hasText: /^1000 TL$/ }).click(); await page.getByTestId('sinir-kaydet').click();
        await page.getByTestId('sinir-yukselt-onay').waitFor(); await sleep(300);
        await check('magaza-sinir-yukselt', { scroll: false });
        await page.keyboard.press('Escape'); await sleep(300);
        if (await page.locator('.sheet-wrap').count()) { await page.keyboard.press('Escape'); await sleep(300); }
        // üstte tek kısa cümle; ayrıntı "Neler satılmaz?" açılınca (OT-ilk-kez-oyun-28)
        await page.locator('[data-testid="magaza-ilke"] summary').click(); await sleep(200);
        await check('magaza-ilke-acik', { scroll: false });
        await back(); if (!(await page.locator('.menu-tile').count())) await tab('Profil'); }
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
      if (await rn.count()) { await rn.click(); await page.locator('.sheet').waitFor(); await check('profil-takma-ad-sayfasi', { scroll: false }); await page.locator('.sheet').getByRole('button', { name: 'Kapat' }).click(); }
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
        // Gizlilik ve hesap (YN-009, YN-017): kart (üç bağlantı + sürüm) ve üç alt sayfa
        await page.getByTestId('gizlilik-hesap').scrollIntoViewIfNeeded(); await page.getByTestId('surum').scrollIntoViewIfNeeded(); await sleep(300);
        await check('ayarlar-gizlilik-hesap');
        for (const [ac, sayfa, ad] of [['gizlilik-ac', 'yasal-gizlilik', 'ayarlar-gizlilik'], ['hesap-sil-ac', 'yasal-hesap-sil', 'ayarlar-hesap-silme'], ['hakkinda-ac', 'yasal-hakkinda', 'ayarlar-hakkinda']]) {
          await page.getByTestId(ac).scrollIntoViewIfNeeded(); await page.getByTestId(ac).click(); await page.getByTestId(sayfa).waitFor(); await sleep(400);
          await check(ad, { scroll: false });
          await page.keyboard.press('Escape'); await sleep(300);
        }
        // Geri bildirim gönder: kart, form, otomasyonda "kapalı" iletisi; gizli ?e2e=geribildirim kancasıyla gönderim hatası ve teşekkür
        // (sunucu yanıtını sayfadaki fetch taklidi verir: 8 yapılandırma aynı sunucuya gönderse IP başına saatte 5 sınırına takılırdı;
        //  page.route WebKit'te hizmet çalışanından geçen isteği yakalamıyor)
        const fbForm = async () => {
          await page.getByTestId('geri-bildirim-kart').scrollIntoViewIfNeeded(); await sleep(300);
          await page.getByTestId('geri-bildirim-ac').click(); await page.getByTestId('geri-bildirim-form').waitFor(); await sleep(400);
          await page.getByTestId('geri-bildirim-konu-zorluk').click();
          await page.getByTestId('geri-bildirim-metin').fill('3. bölümde Başla’ya basınca ekran donuyor, harita yeniden açılınca düzeliyor.');
        };
        await page.getByTestId('geri-bildirim-kart').scrollIntoViewIfNeeded(); await sleep(300);
        await check('ayarlar-geri-bildirim');
        await fbForm(); await check('geri-bildirim-form', { scroll: false });
        await page.getByTestId('geri-bildirim-gonder').click(); await page.locator('[data-testid="geri-bildirim-sonuc"][data-durum="kapali"]').waitFor();
        await check('geri-bildirim-kapali', { scroll: false });
        await page.keyboard.press('Escape'); await sleep(300);
        // kanca adres çubuğuna yeniden yüklemeden eklenir (gönderim anında okunur; DOM hedefinde yeniden yükleme köprü deposunu sıfırlardı)
        const fbKanca = (on) => page.evaluate((k) => { const u = new URL(location.href); if (k) u.searchParams.set('e2e', 'geribildirim'); else u.searchParams.delete('e2e'); history.replaceState(history.state, '', u); }, on);
        await fbKanca(true);
        await fbForm();
        const fbCevap = (status) => page.evaluate((st) => {
          const asil = (window.__fbFetch ??= window.fetch);
          window.fetch = st ? (u, o) => (String(u).endsWith('/geri-bildirim') ? Promise.resolve(new Response(null, { status: st })) : asil(u, o)) : asil;
        }, status);
        await fbCevap(503);
        await page.getByTestId('geri-bildirim-gonder').click(); await page.locator('[data-testid="geri-bildirim-sonuc"][data-durum="hata"]').waitFor();
        await check('geri-bildirim-hata', { scroll: false });
        await fbCevap(204);
        await page.getByTestId('geri-bildirim-gonder').click(); await page.getByTestId('geri-bildirim-tesekkur').waitFor();
        await check('geri-bildirim-tesekkur', { scroll: false });
        await fbCevap(0); await fbKanca(false);
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
      // büyük cüzdan (5 basamak jeton + 4 basamak kristal): ekran başlığı "K…" diye kesilmemeli; sayılar her genişlikte tam
      // (98.765, 4.321; "B" kısaltması yok, YN-087): sığmazsa haplar başlığın altına iner
      const { DatabaseSync } = await import('node:sqlite');
      const sq = new DatabaseSync(dbFile); sq.exec('PRAGMA busy_timeout = 3000'); sq.prepare('UPDATE players SET jeton = 98765, kristal = 4321').run(); sq.close();
      await tab('Harita'); await tab('Kamp'); await sleep(1500); await toastGone();
      const ub = page.getByRole('button', { name: 'Üs görünümü' }); if (await ub.count()) { await ub.click(); await sleep(1200); }
      const rec = await check('kamp-buyuk-cuzdan', { scroll: false });
      const hud = await page.evaluate(() => ({ title: document.querySelector('.tb-title h1')?.textContent ?? '', j: document.querySelector('.tb-pill[data-hud="jeton"]')?.innerText ?? '', k: document.querySelector('.tb-pill[data-hud="kristal"]')?.innerText ?? '', w: [...document.querySelectorAll('.topbar2 .tb-title h1, .topbar2 .tb-pills > *')].map((e) => Math.round(e.getBoundingClientRect().width)) }));
      rec.hud = hud;
      if (hud.j.trim() !== '98.765' || hud.k.trim() !== '4.321') fail(rec, `büyük cüzdan tam görünmedi: ${JSON.stringify(hud)}`);
      // boş deniz (MK-028): kamp yeni açıldı (açılış yakınlaştırması); zemin dışı (deniz / gök) pay hem bütün tuvalde hem üst çubuk
      // ile sekme çubuğu arasındaki açık bantta ≤ %15
      await page.waitForFunction(() => window.__kamp?.still?.(), null, { timeout: 5000 }).catch(() => undefined);
      rec.bosDeniz = await page.evaluate(() => {
        const k = window.__kamp; if (!k?.empty) return null;
        const top = document.querySelector('.topbar2')?.getBoundingClientRect().bottom ?? 0, bottom = document.querySelector('nav.tabbar')?.getBoundingClientRect().top ?? innerHeight;
        const r = (x) => (x == null ? null : Math.round(x * 1000) / 10);
        // karşılaştırma: eski kural (yalnız genişlik: min(w/540, h/600)) aynı merkezde
        const c = document.querySelector('.camp-canvas canvas')?.getBoundingClientRect(); const eskiZ = c ? Math.min(1.1, Math.max(0.5, Math.min(c.width / 540, c.height / 600))) : 0;
        return { acik: r(k.empty(top, bottom)), tum: r(k.empty()), zoom: Math.round((k.view()?.zoom ?? 0) * 1000) / 1000, dokuMB: k.mem?.().mb ?? null, dpr: devicePixelRatio,
          eski: eskiZ ? { acik: r(k.empty(top, bottom, eskiZ)), tum: r(k.empty(undefined, undefined, eskiZ)), zoom: Math.round(eskiZ * 1000) / 1000 } : null };
      });
      if (!rec.bosDeniz || rec.bosDeniz.acik == null) fail(rec, 'boş deniz ölçülemedi (__kamp.empty yok)');
      else if (rec.bosDeniz.acik > 15 || rec.bosDeniz.tum > 15) fail(rec, `kampta boş deniz: açık bant %${rec.bosDeniz.acik}, tüm tuval %${rec.bosDeniz.tum} (en çok %15; yakınlaştırma ${rec.bosDeniz.zoom})`);
      { const b = rec.bosDeniz; console.log(`    boş deniz ${W}x${H}: açık bant %${b?.acik} · tüm tuval %${b?.tum} · yakınlaştırma ${b?.zoom} · doku ${b?.dokuMB} MB (eski kural: %${b?.eski?.acik} · %${b?.eski?.tum} · ${b?.eski?.zoom})`); }
      // aynı cüzdanla diğer sekme başlıkları da okunur kalmalı
      for (const t of ['Bugün', 'Profil', 'Harita']) {
        await tab(t); await sleep(900); await toastGone(); const r = await check(`buyuk-cuzdan-${t.toLocaleLowerCase('tr').replace('ü', 'u')}`, { scroll: false });
        // üst çubuk ve harita hapları aynı sayıyı tam yazar (YN-087: "98B" yok)
        const hap = await page.evaluate(() => [...document.querySelectorAll('.tb-pill[data-hud], .mh-pill[data-hud]')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => `${e.dataset.hud}:${e.innerText.trim()}`));
        r.hap = hap;
        if (hap.join('|') !== 'jeton:98.765|kristal:4.321') fail(r, `büyük cüzdan hapları tam değil: ${JSON.stringify(hap)}`);
        // harita camı kırpar (taşma denetimi görmez): her hap camın içinde kalmalı
        const tasan = await page.evaluate(() => { const h = document.querySelector('.map-hud'); if (!h || !h.getBoundingClientRect().width) return []; const hr = h.getBoundingClientRect();
          return [...h.children].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < hr.left - 0.5 || r.right > hr.right + 0.5); }).map((e) => (e.getAttribute('aria-label') || e.className).slice(0, 30)); });
        if (tasan.length) fail(r, `harita camından taşan hap: ${tasan.join(', ')}`);
      }
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
      { const rec = await check('takim-sohbet', { chat: true });
        // sohbet alanı (MK-029): en az üç mesaj balonu görünür (kutunun içinde en az 24 px'i ya da tamamı)
        const vis = await page.evaluate(() => { const box = document.querySelector('.chat-box')?.getBoundingClientRect(); if (!box) return null;
          const n = [...document.querySelectorAll('.chat-box .bubble')].filter((b) => { const r = b.getBoundingClientRect(); const v = Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top); return v >= Math.min(24, r.height - 1); }).length;
          return { balon: n, kutu: Math.round(box.height) }; });
        rec.sohbetAlani = vis;
        if (!vis || vis.balon < 3) fail(rec, `sohbette yalnız ${vis?.balon ?? 0} balon görünüyor (kutu ${vis?.kutu ?? 0} px; en az 3)`); }
      // başvuru: lider ekranında rozet + Başvurular sekmesi (aşağıdaki alt sekme turunda denetlenir); katılım başvuruyla
      { const myTeam = `Koklea Kaşifleri ${String.fromCharCode(64 + sno)}${sno}`.slice(0, 20);
        const aday = rawClient(wsUrl); await aday.call('hello', { version: 1, name: `Aday${sno}` });
        const t = (await aday.call('team.list', { query: myTeam })).teams.find((x) => x.name === myTeam);
        if (t?.open) { await page.getByLabel('Takım menüsü').click(); await page.locator('[data-testid="katilim-ayari"] [role="radio"]', { hasText: 'Başvuruyla' }).click(); await sleep(500); await page.locator('.sheet').getByRole('button', { name: 'Kapat' }).click(); }
        if (!t) throw new Error(`başvuru denetimi: takım listede yok (${myTeam})`);
        await aday.call('team.apply', { teamId: t.id, noteId: 'savas' });
        await page.getByTestId('basvuru-rozeti').waitFor({ timeout: 10_000 }).catch(() => undefined);
        aday.close(); }
      // iki düzeyli sekmeler (YN-083): üst sıradaki her grup (Sohbet dışında) ve grubun alt sırasındaki her sekme
      const sekmeAdi = (e) => e.textContent.replace(/\d+$/, '').trim();
      const gruplar = await page.locator('[data-subtabs="takim-grup"] .subtab').evaluateAll((els) => els.map((e) => e.dataset.sekme));
      for (const g of gruplar.slice(1)) {
        await page.locator(`[data-subtabs="takim-grup"] .subtab[data-sekme="${g}"]`).click(); await sleep(700);
        const alt = await page.locator('[data-subtabs="takim-alt"] .subtab').evaluateAll((els) => els.map((e) => e.dataset.sekme));
        const adlar = alt.length ? alt : [g];
        for (const id of adlar) {
          const t = page.locator(`.subtabs .subtab[data-sekme="${id}"]`).first();
          await t.click(); await sleep(700);
          await check(`takim-${(await t.evaluate(sekmeAdi)).toLocaleLowerCase('tr').replace(/[^a-zçğıöşü]+/g, '-')}`);
        }
      }
      await page.getByLabel('Takım menüsü').click(); await page.locator('.sheet').waitFor();
      await check('takim-menu-sayfasi', { scroll: false });
      await page.locator('.sheet').getByRole('button', { name: 'Kapat' }).click();
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
        await page.locator('.sheet').getByRole('button', { name: 'Kapat' }).click();
        const bora = rawClient(wsUrl);
        await bora.call('hello', { version: 1, name: `Bora${sno}` });
        await bora.call('team.join', { code });
        await bora.call('progress.submit', { runId: `u${sno}a${Date.now()}`, level: 1, completed: true, stars: 3, score: 900, timeSec: 40, coins: 60, biome: 'dis-kulak', mechanic: 'kosu', cochleas: 2 });
        await bora.call('team.help.request', { level: 2 });
        await page.locator('[data-testid="yardim-karti"]').first().waitFor({ timeout: 10_000 });
        // Yardım listesinde istek satırı: bölüm/yardım ve süre ayrı satır, süre bölünmez (Büyük yazıda da, YN-115)
        await takimSekme(page, 'Yardım'); await page.locator('[data-testid="yardim-satiri"]').first().waitFor({ timeout: 10_000 });
        await check('takim-yardim-istek');
        await takimSekme(page, 'Üyeler'); await sleep(300);
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
        const meId = (await bora.call('team.detail', {})).team.roster.find((m) => !m.name.startsWith('Bora')).id;
        await bora.call('dm.send', { to: meId, text: 'selam', kind: 'hazir' }); await sleep(700); // DM aralığı (dmCooldownMs)
        // ralli daveti: kartın rallisi yok/bitti → gri "Bu ralli artık açık değil", düğme devre dışı (YN-116)
        await bora.call('dm.send', { to: meId, text: 'Ralliye katıl! Serumen Yavrusu seni bekliyor', kind: 'davet', meta: { type: 'ralli', roomId: `yok${sno}`, title: 'Serumen Yavrusu' } });
        await page.locator('.menu-tile[data-tile="messages"]').click();
        await page.locator('[data-testid="sohbet-satiri"]').first().click({ timeout: 10_000 });
        await page.getByTestId('dm-ekrani').waitFor();
        await page.locator('[data-testid="davet-karti"][data-durum="yok"]').waitFor({ timeout: 10_000 });
        await check('dm-ralli-daveti-bitti', { scroll: false });
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
      // Kampın Hikâyesi 6. bölüm: takıma bağlı adımların altında takımsız "ya da" satırları (Ö2; dar ekranda taşma yok)
      { const sq4 = new DatabaseSync(dbFile); sq4.exec('PRAGMA busy_timeout = 3000');
        for (let i = 1; i <= 5; i++) sq4.prepare("INSERT OR IGNORE INTO kg_claim(player_id, ref, at, reward) VALUES(?, ?, ?, '{}')").run(pid, `hikaye:${i}`, Date.now());
        sq4.close();
        await page.evaluate(() => window.__kg?.refresh()); await page.locator('.kg-tabs [data-tab="hikaye"]').click();
        await page.locator('[data-testid="kg-story"][data-bolum="6"] .kg-ya').first().waitFor({ timeout: 10_000 }); await sleep(500);
        await check('gorev-hikaye-ya-da', { scroll: false });
        await page.locator('[data-adim="konsult-1"]').scrollIntoViewIfNeeded(); await sleep(300);
        await check('gorev-hikaye-ya-da-alt', { scroll: false }); }
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
      const seed = { 'odi-v1': JSON.stringify({ state: { progress: { 1: { stars: 3, best: 900, plays: 1 }, 2: { stars: 2, best: 700, plays: 1 } }, coins: 240, ...BASE_STATE }, version: 3 }) };
      if (target === 'dom') { await page.addInitScript(domBridge, [wsUrl, INSET, INSET_B, seed, BASE_STATE, STORE_PRICES]); }
      else await page.evaluate((sd) => { for (const [k, v] of Object.entries(sd)) localStorage.setItem(k, v); }, seed);
      await page.goto(url(), { waitUntil: 'load' });
      await page.getByRole('button', { name: /Devam et/ }).waitFor({ timeout: 45_000 }); await sleep(700);
      await check('giris-devam', { scroll: false });
      // YN-162 (OT-rekabetci-35): haritada 16'nın bölüm kartı (önizleme bağlantısıyla açılır; düğüm tuvalde): geçme koşulu ayrı
      // ("Kapıya ulaş"), altın koklea yalnız 3. yıldızın ikinci yolu, sonuç kartıyla aynı metin; 320 px ve Büyük yazıda taşmaz
      await page.goto(url('harita-kart=16'), { waitUntil: 'load' });
      await page.getByRole('button', { name: /Devam et/ }).click({ timeout: 45_000 });
      await page.locator('.map-sheet [data-testid="bolum-yildiz3"]').waitFor({ timeout: 20_000 }); await sleep(600);
      const rec = await check('harita-bolum-karti', { scroll: false });
      const kart = await page.evaluate(() => ({ gec: document.querySelector('[data-testid="bolum-gecme"]')?.textContent ?? '', y3: document.querySelector('[data-testid="bolum-yildiz3"]')?.textContent ?? '' }));
      rec.kart = kart;
      if (!/Kapıya ulaş$/.test(kart.gec)) fail(rec, `geçme satırı "Kapıya ulaş" değil: ${JSON.stringify(kart.gec)}`);
      if (!/^3\. yıldız · biri yeter\d+ nota ya da 3 altın kokleayı bul ve \d+ nota$/.test(kart.y3)) fail(rec, `3. yıldız satırı sonuç kartıyla aynı değil: ${JSON.stringify(kart.y3)}`);
      await page.keyboard.press('Escape'); await sleep(300);
    }
    if (want('sonuc')) {
      // olmayan öğenin yazısı: boş (locator.textContent öğeyi 30 sn bekliyordu; ekran başına dakikalar)
      const yazi = async (sel) => ((await page.locator(sel).count()) ? (await page.locator(sel).first().textContent()) ?? '' : '');
      // YN-066: haritada bekleyen tanıtım (Kamp; iki açılım en uzun satır) → Sonraki yerine "Haritaya dön"
      for (const [q, label] of [['demo=sonuc&yildiz=3&skor=2480&rekor=1&acilim=1&sans=1&kutlama=0', 'sonuc-kazandi'], ['demo=sonuc&yildiz=0&skor=310&kutlama=0', 'sonuc-kaybetti'], ['demo=sonuc&bolum=7&yildiz=0&skor=660&neden=diken&kutlama=0', 'sonuc-kaybetti-diken'], ['demo=sonuc&bolum=7&yildiz=2&skor=1720&kutlama=0', 'sonuc-yildiz-ya-da'], ['demo=sonuc&bolum=8&yildiz=2&skor=2705&kutlama=0', 'sonuc-yildiz-hepsi'], ['demo=sonuc&bolum=12&yildiz=2&skor=1900&kutlama=0', 'sonuc-melodi'], ['demo=sonuc&bolum=3&yildiz=2&skor=1480&acilim=1&anlatim=camp&kutlama=0', 'sonuc-anlatim-kamp'], ['demo=sonuc&bolum=4&yildiz=3&skor=2210&acilim=1&anlatim=friends,glossary&kutlama=0', 'sonuc-anlatim-iki'],
        // YN-081: 1★ (2. yıldızın koşulu ilk ekranda), süreli hedef 0,4 sn kaçtı, kanca bölümünde kayıp (mekaniğin ipucu), boss kaybı
        ['demo=sonuc&bolum=7&yildiz=1&skor=980&kutlama=0', 'sonuc-yildiz1'], ['demo=sonuc&bolum=18&yildiz=2&skor=1650&sure=gec&kutlama=0', 'sonuc-sure-gec'],
        ['demo=sonuc&bolum=13&yildiz=0&skor=450&kutlama=0', 'sonuc-kaybetti-kanca'], ['demo=sonuc&bolum=20&yildiz=0&skor=0&neden=yumruk&kutlama=0', 'sonuc-kaybetti-boss'],
        // YN-093: sisli + melodili bölümde kayıp (ipucu bölüme göre; neden kartı kutuların altında, hiçbir şeyi örtmez)
        ['demo=sonuc&bolum=19&yildiz=0&skor=130&kutlama=0', 'sonuc-kaybetti-sis'],
        // YN-173 (OT-sinav-adayi-36): hazine satırı jeton dışını da yazar ("Ayrıca: ×1 Seri koruyucu", haritadaki pencereyle aynı)
        ['demo=sonuc&bolum=10&yildiz=2&skor=1500&acilim=1&kutlama=0', 'sonuc-hazine'],
        // YN-102: ilk canavarda 4. kayıp, takımdan yardım kartı ("Yardım iste" düğmesi yapışkan çubuğun arkasında kalmaz); değiştiricili bölüm sonucu
        ['demo=sonuc&bolum=20&yildiz=0&skor=0&neden=yumruk&yardim=4&kutlama=0', 'sonuc-kaybetti-yardim'], ['demo=sonuc&bolum=30&yildiz=2&skor=1500&kutlama=0', 'sonuc-degistirici'],
        // YN-113: 3 kayıptan sonra kolaylaşmış bölümün sonucu (kalkan değiştiriciler adıyla); kayıpta sonraki denemenin kolaylaşacağı
        // YN-114: bölge sonu (Golem) ilk geçişte "Haritaya dön" + "Kulak Kanalı haritada canlanacak."
        ['demo=sonuc&bolum=33&yildiz=2&skor=1700&kolay=3&kutlama=0', 'sonuc-kolay'], ['demo=sonuc&bolum=33&yildiz=0&skor=420&kolay=2&kutlama=0', 'sonuc-kaybetti-kolay-sonraki'],
        ['demo=sonuc&bolum=20&yildiz=3&skor=3100&acilim=1&harita=1&kutlama=0', 'sonuc-harita-canlanma'],
        // YN-136: hedef kutusunun söz verdiği çiçeklenme (28) de "Haritaya dön"; kalkanla kayıpta hasar cümlesi kalkanı söyler;
        // sonuç açılırken gelen başarım bildirimi başlığı örtmez (Büyük yazıda iki satır)
        ['demo=sonuc&bolum=28&yildiz=2&skor=1700&acilim=1&harita=1&kutlama=0', 'sonuc-harita-cicek'], ['demo=sonuc&bolum=7&yildiz=0&skor=660&neden=diken&kalkan=1&kutlama=0', 'sonuc-kaybetti-kalkan'],
        ['demo=sonuc&bolum=40&yildiz=2&skor=1500&bildirim=1&kutlama=0', 'sonuc-bildirim'],
        // YN-145 (OT-buyuk-yazi-42): seviye atlanan sonuçta başarım bildirimi Seviye penceresi açıkken bekler, kapanınca kutuların altında
        ['demo=sonuc&bolum=4&yildiz=3&skor=2210&seviye=1&bildirim=1', 'sonuc-bildirim-seviye'],
        // YN-145 (OT-sinav-adayi-28): ilk geçişte "Haritaya dön" + Biliyor muydun? (Bölüm 6: yeni yer, iki satırlık anlatım şeridi)
        ['demo=sonuc&bolum=6&yildiz=2&skor=2115&acilim=1&anlatim=team,shop&kutlama=0', 'sonuc-bilgi-anlatim'],
        // YN-110 (karar 42): canavarda 3 kayıptan sonra Rahat deneme teklifi; Rahat denemeyle geçişin sonucu (1 yıldız, rekabet yok)
        ['demo=sonuc&bolum=20&yildiz=0&skor=0&neden=yumruk&rahat=teklif&kutlama=0', 'sonuc-kaybetti-rahat-teklif'], ['demo=sonuc&bolum=20&yildiz=1&skor=1800&rahat=1&kutlama=0', 'sonuc-rahat']]) {
        if (SONUC && !SONUC.some((x) => label.includes(x))) continue;
        await page.goto(url(q), { waitUntil: 'load' });
        await page.locator('.result-actions').waitFor({ timeout: 30_000 });
        // YN-136 (OT-buyuk-yazi-37), YN-145 (OT-buyuk-yazi-42): başarım bildirimi başlığı, yıldızları, skoru, nota/süre kutularını (ve
        // sıradaki yıldızın kartını) ve yapışkan düğmeleri örtmez; yer yoksa görünmeden bekler (data-bekliyor). Seviye penceresi açıkken
        // hiç görünmez, pencere kapanınca gelir
        const ortme = () => page.evaluate(() => {
          const r = (el) => { const b = el?.getBoundingClientRect(); return b ? { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right) } : null; };
          const el = document.querySelector('.toast-top'); if (!el) return { toast: null, ort: [] };
          if (el.dataset.bekliyor) return { toast: null, bekliyor: el.dataset.bekliyor, gizli: el.style.visibility === 'hidden', ort: [] };
          const t = r(el.querySelector('.tt-card')); const out = [];
          for (const sel of ['.result-title', '.star-row', '.score-line', '[data-testid="sonuc-jeton-ozet"]', '.result .stats .card', '[data-testid="biliyor-muydun"]', '.result-actions > *']) for (const e of document.querySelectorAll(sel)) { const x = r(e); if (t && x && t.t < x.b - 1 && t.b > x.t + 1 && t.l < x.r - 1 && t.r > x.l + 1) out.push(`${sel} ${JSON.stringify(x)}`); }
          return { toast: t, ort: out };
        });
        const seviye = label !== 'sonuc-bildirim-seviye' ? null : await (async () => {
          const out = { pencere: false, ustunde: 0, sonra: null };
          await page.locator('.cel-stage.lvl-stage').waitFor({ timeout: 8000 }).then(() => { out.pencere = true; }, () => undefined);
          if (!out.pencere) return out;
          for (let i = 0; i < 12; i++) { if (await page.evaluate(() => !!document.querySelector('.cel-stage') && [...document.querySelectorAll('.toast-top')].some((e) => getComputedStyle(e).visibility !== 'hidden'))) out.ustunde++; await sleep(100); }
          await page.screenshot({ path: resolve(dir, `${label}-pencere.png`) });
          await page.locator('.cel-stage .cel-cta .btn').click({ timeout: 5000 }).catch(() => undefined);
          await page.locator('.cel-stage').waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
          await page.locator('.toast-top').waitFor({ state: 'attached', timeout: 3000 }).then(() => sleep(400), () => undefined);
          out.sonra = await ortme();
          if (out.sonra.toast) await page.screenshot({ path: resolve(dir, `${label}-sonra.png`) });
          await toastGone(); return out;
        })();
        const bildirim = label !== 'sonuc-bildirim' ? null : await page.locator('.toast-top').waitFor({ state: 'attached', timeout: 5000 }).then(() => sleep(500)).then(ortme, () => ({ toast: null, ort: [] }));
        // açılış anının görüntüsü bildirimle; sonra bildirimler kapatılır (örtme ölçümü bildirimsiz ekranda)
        if (bildirim && (bildirim.toast || bildirim.bekliyor)) { await page.screenshot({ path: resolve(dir, `${label}-acilis.png`) }); await toastGone(); }
        await page.locator('.result-title').click().catch(() => undefined); await sleep(900);
        // YN-081: kaydırmadan görünmesi gerekenler (yapışkan düğmelerin altında kalmadan): sıradaki yıldızın kartı, kayıpta neden kartı
        const ilk = await page.evaluate(() => {
          // yapışkan bölgenin üst dolgusu saydam degrade: sınır ilk düğmenin (ya da kartın) üstü
          const act = document.querySelector('.result-actions'); const aTop = act?.firstElementChild ? act.firstElementChild.getBoundingClientRect().top : innerHeight;
          return ['[data-testid="sonuc-yildiz2"]', '[data-testid="sonuc-yildiz3"]', '[data-testid="sonuc-neden"]', '[data-testid="yardim-iste"]', '[data-testid="yardim-iste-dugme"]', '[data-testid="rahat-teklif"]', '[data-testid="rahat-dene"]', '[data-testid="sonuc-rahat"]'].map((sel) => {
            const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); const inAct = !!act?.contains(el);
            // Rahat deneme kartı (YN-110): başlığı ve ilk satırı ilk ekranda yeter; düğmesi yapışkan alanda, ne değiştiği üstünde yazılı
            if (sel === '[data-testid="rahat-teklif"]') return { sel, ok: r.top >= 0 && r.top + 60 <= aTop + 1, top: Math.round(r.top), bottom: Math.round(r.bottom), limit: Math.round(aTop) };
            return { sel, ok: r.top >= 0 && r.bottom <= (inAct ? innerHeight : aTop) + 1, top: Math.round(r.top), bottom: Math.round(r.bottom), limit: Math.round(inAct ? innerHeight : aTop) };
          }).filter(Boolean);
        });
        // YN-145 (OT-sinav-adayi-28): "Biliyor muydun?" ilk ekranda: sıradaki yıldızın kartının (kayıpta kutuların) hemen altında ve
        // yapışkan düğmelerin üstünde; yer yoksa düğme alanının en üstünde tek satırlık kısa hâli (görünür, ekranın içinde)
        const bilgiYer = await page.evaluate(() => {
          const act = document.querySelector('.result-actions'); const aTop = act?.firstElementChild ? act.firstElementChild.getBoundingClientRect().top : innerHeight;
          const full = document.querySelector('[data-testid="biliyor-muydun"]'); const kisa = document.querySelector('[data-testid="biliyor-muydun-kisa"]');
          if (!full) return { sorun: 'satır yok' };
          const f = full.getBoundingClientRect(); const out = { tam: { top: Math.round(f.top), bottom: Math.round(f.bottom), limit: Math.round(aTop) } };
          if (!full.previousElementSibling?.matches('.stats')) out.sorun = `satır kutuların hemen altında değil (önceki: ${full.previousElementSibling?.className})`;
          else if (!full.dataset.kisa && f.top >= 0 && f.bottom <= aTop + 1) out.yer = 'tam';
          else if (kisa) {
            const k = kisa.getBoundingClientRect(); out.kisa = { top: Math.round(k.top), bottom: Math.round(k.bottom), h: Math.round(k.height) };
            if (!act?.contains(kisa) || act.firstElementChild !== kisa) out.sorun = 'kısa satır düğme alanının en üstünde değil';
            else if (k.top < 0 || k.bottom > innerHeight || k.height > 48 || getComputedStyle(kisa).visibility === 'hidden') out.sorun = 'kısa satır ekranda görünmüyor ya da tek satır değil';
            else out.yer = 'kisa';
          } else out.sorun = 'satır ilk ekranda değil ve kısa hâli yok';
          return out;
        });
        // YN-158 (OT-buyuk-yazi-47): Büyük yazıda yapışkan alanda yalnız ana düğme (Rahat teklifinde "Rahat dene" de); Tekrar, Meydan oku
        // ve Tüy Dede'nin kartı sayfa akışında. Kazançta yıldızların altındaki jeton özeti ilk ekranda (yapışkan alanın üstünde)
        const buyuk = !BIG ? null : await page.evaluate(() => {
          const act = document.querySelector('.result-actions'); const aTop = act?.firstElementChild ? act.firstElementChild.getBoundingClientRect().top : innerHeight;
          const fazla = [...(act?.querySelectorAll('[data-act="tekrar"], [data-act="meydan"], [data-act="harita"]:not([data-anlatim]), [data-testid="anlatim-bekliyor"]') ?? [])].map((e) => e.getAttribute('data-act') ?? e.getAttribute('data-testid'));
          const oz = document.querySelector('[data-testid="sonuc-jeton-ozet"]'); const r = oz?.getBoundingClientRect();
          return { fazla, ozet: r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), limit: Math.round(aTop), ok: r.top >= 0 && r.bottom <= aTop + 1, yazi: oz.textContent } : null };
        });
        // YN-158 (OT-ogrenci-birinci-32): kısa "Biliyor muydun?" şeridine dokunmak yalnız notu açar (tamamı okunur, ekranın içinde) ve kapatır;
        // harita açılmaz. Oyuncu ajanının ekran özeti (oyuncu/sayfa.mjs) "Biliyor muydun" yazısıyla şeridi bulur, düğme alanının kabını değil
        const serit = !(await page.locator('[data-testid="biliyor-muydun-kisa"]').count()) ? null : await (async () => {
          const out = {};
          const ozet = await page.evaluate(ekranOzeti, { maxMetin: 0 }).catch((e) => ({ dok: [], hata: e.message }));
          const ilkEs = ozet.dok.find((d) => d.ad.toLocaleLowerCase('tr').startsWith('biliyor muydun'));
          out.ozetHedef = ilkEs ? await page.locator(`[data-oyuncu-no="${ilkEs.no}"]`).evaluate((e) => e.getAttribute('data-testid') ?? e.className) : null;
          const kisa = page.locator('[data-testid="biliyor-muydun-kisa"]');
          await kisa.tap({ timeout: 5000 }).catch(() => kisa.click({ timeout: 5000 })); await sleep(500);
          out.acik = await page.evaluate(() => {
            const k = document.querySelector('[data-testid="biliyor-muydun-kisa"]'); const t = k?.querySelector('.rbk-t'); const r = k?.getBoundingClientRect();
            return { ekran: !!document.querySelector('.result-screen'), harita: !!document.querySelector('.map-screen, .map-host'), aria: k?.getAttribute('aria-expanded'), tam: !!t && t.scrollWidth <= t.clientWidth + 1 && t.scrollHeight <= t.clientHeight + 1, ici: !!r && r.top >= 0 && r.bottom <= innerHeight };
          });
          if (out.acik.ekran) await page.screenshot({ path: resolve(dir, `${label}-serit-acik.png`) });
          await kisa.tap({ timeout: 5000 }).catch(() => kisa.click({ timeout: 5000 }).catch(() => undefined)); await sleep(300);
          out.kapali = await page.evaluate(() => ({ ekran: !!document.querySelector('.result-screen'), aria: document.querySelector('[data-testid="biliyor-muydun-kisa"]')?.getAttribute('aria-expanded') }));
          return out;
        })();
        // YN-093 (OT-ilk-kez-oyun-20): neden kartı sayfa akışında; kutularla ve yapışkan düğme alanıyla örtüşmez
        const ort = !label.startsWith('sonuc-kaybetti') ? [] : await page.evaluate(() => {
          const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
          const hit = (a, b) => a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1;
          const why = document.querySelector('[data-testid="sonuc-neden"]'); const act = document.querySelector('.result-actions');
          if (!why || !act) return ['kart ya da düğme alanı yok'];
          const out = []; const w = box(why);
          if (act.contains(why)) out.push('neden kartı yapışkan düğme alanında');
          for (const c of document.querySelectorAll('.result .stats .card, .result-earn, .goal-card')) if (hit(w, box(c))) out.push(`neden kartı ${c.className} ile örtüşüyor`);
          const first = act.firstElementChild; if (first && hit(w, box(first))) out.push('neden kartı düğmelerin altında kalıyor');
          const help = document.querySelector('[data-testid="yardim-iste"]'); if (help && act.contains(help)) out.push('yardım kartı yapışkan düğme alanında');
          const rh = document.querySelector('[data-testid="rahat-teklif"]'); if (rh && act.contains(rh)) out.push('Rahat deneme kartı yapışkan düğme alanında');
          if (rh) for (const c of document.querySelectorAll('.result .stats .card, .result-earn, .goal-card')) if (hit(box(rh), box(c))) out.push(`Rahat deneme kartı ${c.className} ile örtüşüyor`);
          return out;
        });
        const rec = await check(label);
        rec.bilgi = bilgiYer;
        if (serit) {
          rec.serit = serit;
          if (!serit.acik.ekran || serit.acik.harita || !serit.kapali.ekran) fail(rec, `"Biliyor muydun?" şeridine dokununca sonuç ekranı kapandı: ${JSON.stringify(serit)}`);
          else if (serit.acik.aria !== 'true' || serit.kapali.aria !== 'false') fail(rec, `"Biliyor muydun?" şeridi açılıp kapanmadı: ${JSON.stringify(serit)}`);
          else if (!serit.acik.tam || !serit.acik.ici) fail(rec, `açılan "Biliyor muydun?" notunun tamamı okunmuyor: ${JSON.stringify(serit.acik)}`);
          if (serit.ozetHedef !== 'biliyor-muydun-kisa') fail(rec, `oyuncu ekran özetinde "Biliyor muydun" ilk eşleşmesi şerit değil: ${serit.ozetHedef}`);
        }
        // YN-158 (OT-rekabetci-39): kaybedilen koşuya meydan okunmaz
        if (label.startsWith('sonuc-kaybetti') && await page.locator('[data-act="meydan"]').count()) fail(rec, 'kayıp ekranında Meydan oku düğmesi var');
        if (buyuk) {
          rec.buyuk = buyuk;
          if (buyuk.fazla.length) fail(rec, `Büyük yazıda yapışkan alanda ana düğmeden başkası: ${buyuk.fazla.join(', ')}`);
          const kazanc = !label.startsWith('sonuc-kaybetti') && label !== 'sonuc-rahat';
          if (kazanc && !buyuk.ozet) fail(rec, 'Büyük yazıda jeton özeti yok');
          else if (kazanc && !buyuk.ozet.ok) fail(rec, `Büyük yazıda jeton özeti ilk ekranda değil: ${JSON.stringify(buyuk.ozet)}`);
        }
        if (bilgiYer.sorun) fail(rec, `"Biliyor muydun?" ilk ekranda değil: ${bilgiYer.sorun} ${JSON.stringify(bilgiYer)}`);
        if (bildirim) rec.bildirim = bildirim;
        if (bildirim && !bildirim.toast && !bildirim.bekliyor) fail(rec, 'başarım bildirimi görünmedi');
        if (bildirim?.bekliyor && !bildirim.gizli) fail(rec, 'yer bekleyen başarım bildirimi görünür');
        if (seviye) {
          rec.seviye = seviye;
          if (!seviye.pencere) fail(rec, 'Seviye penceresi açılmadı');
          if (seviye.ustunde) fail(rec, `Seviye penceresi açıkken başarım bildirimi görünür (${seviye.ustunde}/12 örnek)`);
          if (seviye.sonra && !seviye.sonra.toast && !seviye.sonra.bekliyor) fail(rec, 'Seviye penceresi kapanınca başarım bildirimi gelmedi');
          if (seviye.sonra?.bekliyor && !seviye.sonra.gizli) fail(rec, 'yer bekleyen başarım bildirimi görünür');
          if (seviye.sonra?.ort.length) fail(rec, `pencere kapanınca başarım bildirimi ${JSON.stringify(seviye.sonra.toast)} örtüyor: ${seviye.sonra.ort.join('; ')}`);
        }
        if (bildirim?.ort.length) fail(rec, `başarım bildirimi ${JSON.stringify(bildirim.toast)} örtüyor: ${bildirim.ort.join('; ')}`);
        // YN-136 (OT-buyuk-yazi-41): notasız (canavar) bölümde hasar kalp simgesiyle gösterilmez (kalp "can" demek)
        if (await page.locator('[data-testid="sonuc-hasar"] .art-heart').count()) fail(rec, 'hasar kartında kalp simgesi');
        const gizli = ilk.filter((x) => !x.ok && (x.sel !== '[data-testid="sonuc-yildiz3"]' || /yildiz-ya-da|sure-gec/.test(label)));
        if (gizli.length) fail(rec, `ilk ekranda görünmüyor: ${JSON.stringify(gizli)}`);
        // YN-102: değiştiricili bölümde "Değiştirici: …" satırı; sis/gece kaybında Yüksek görünürlük yönlendirmesi; yardım kartı çıktı mı
        const degis = await yazi('[data-testid="sonuc-degistirici"]');
        if (label === 'sonuc-degistirici' && !/^Değiştirici: Hız, Gecikme$/.test(degis)) fail(rec, `değiştirici satırı: "${degis}"`);
        if (label === 'sonuc-kaybetti-sis' && (!/Sis/.test(degis) || !(await page.locator('[data-testid="sonuc-gorunurluk"]').count()))) fail(rec, `sis kaybında değiştirici satırı ya da Yüksek görünürlük yönlendirmesi yok: "${degis}"`);
        if (label === 'sonuc-kaybetti-yardim' && !(await page.locator('[data-testid="yardim-iste-dugme"]').count())) fail(rec, 'yardım kartı/düğmesi yok');
        // YN-173 (OT-buyuk-yazi-52): sis/gece kaybında satır gerçek düğme ("Yüksek görünürlüğü aç"), en az 44 px, ekrana sığar; dokununca
        // Ayarlar'daki ayar açılır ve kart yerinde söyler. Sonra ayar geri kapatılır (sonraki ekranlar etkilenmesin)
        if (label === 'sonuc-kaybetti-sis') {
          const ac = page.getByTestId('sonuc-gorunurluk-ac'); const b = (await ac.count()) ? await ac.boundingBox() : null; const vw = page.viewportSize()?.width ?? 0;
          if (!b || (await ac.textContent())?.trim() !== 'Yüksek görünürlüğü aç') fail(rec, 'sis kaybında "Yüksek görünürlüğü aç" düğmesi yok');
          else {
            if (b.height < 44) fail(rec, `Yüksek görünürlük düğmesi ${Math.round(b.height)} px (en az 44)`);
            if (b.x < 0 || b.x + b.width > vw + 0.5) fail(rec, `Yüksek görünürlük düğmesi ekrandan taşıyor: ${JSON.stringify(b)}`);
            await ac.click(); await sleep(150);
            const durum = await yazi('[data-testid="sonuc-gorunurluk-durum"]');
            const acik = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('odi-v1') ?? '{}')?.state?.highVis === true; } catch { return false; } });
            if (!/^Yüksek görünürlük açıldı/.test(durum) || !acik || (await ac.count())) fail(rec, `düğme ayarı açmadı ya da söylemedi: "${durum}" (kayıtta ${acik ? 'açık' : 'kapalı'})`);
            await check(`${label}-acildi`, { scroll: false });
            await page.evaluate(() => { try { const v = JSON.parse(localStorage.getItem('odi-v1') ?? '{}'); if (v.state) { v.state.highVis = false; localStorage.setItem('odi-v1', JSON.stringify(v)); } } catch { /* yok */ } });
          }
        }
        // YN-173: süre kutusunda "par" yok (OT-ilk-kez-oyun-54); melodi bölümünde melodi satırı (OT-sinav-adayi-35); hazine satırı jeton
        // dışını da yazar (OT-sinav-adayi-36)
        if (/\bpar\b/.test(await yazi('.result .stats'))) fail(rec, `süre kutusunda "par": "${await yazi('.result .stats')}"`);
        if ((label === 'sonuc-melodi' || label === 'sonuc-kaybetti-sis') && !/^Melodi(: \d+\/\d+\s?sırayla| tamam)$/.test(await yazi('[data-testid="sonuc-melodi"]'))) fail(rec, `melodi satırı: "${await yazi('[data-testid="sonuc-melodi"]')}"`);
        const hazine = await page.locator('[data-testid="sonuc-kazanc"] li', { hasText: 'hazinesi' }).allTextContents();
        if (label === 'sonuc-hazine' && !hazine.some((t) => /Bölüm 10 hazinesi/.test(t) && /Ayrıca: ×1 Seri koruyucu/.test(t))) fail(rec, `Bölüm 10 hazine satırı: ${JSON.stringify(hazine)}`);
        if (hazine.some((t) => !/Ayrıca: /.test(t))) fail(rec, `hazine satırında jeton dışı ödül yazmıyor: ${JSON.stringify(hazine)}`);
        // YN-113: kolaylaştırma satırı yalnız yardım devredeyken (kalkan değiştiriciler adıyla); kayıpta sonraki denemenin satırı
        const kolay = await yazi('[data-testid="sonuc-kolay"]');
        const kolaySonra = await yazi('[data-testid="sonuc-kolay-sonraki"]');
        if (label === 'sonuc-kolay' && (kolay !== 'Üst üste 3 kayıptan sonra bölüm biraz kolaylaştı: Hız ve Gecikme kaldırıldı, engeller biraz seyreldi.' || degis)) fail(rec, `kolaylaştırma satırı: "${kolay}" · değiştirici: "${degis}"`);
        if (label === 'sonuc-kaybetti-kolay-sonraki' && (kolay || !/^Sonraki denemede bölüm biraz kolaylaşacak: Hız ve Gecikme kalkacak\.$/.test(kolaySonra))) fail(rec, `sonraki deneme satırı: "${kolaySonra}" · bu deneme: "${kolay}"`);
        if (!/kolay/.test(label) && (kolay || kolaySonra)) fail(rec, `yardım yokken kolaylaştırma satırı: "${kolay}${kolaySonra}"`);
        // YN-110 (karar 42): Rahat deneme teklifi yalnız istenen ekranda, açıkça (ne değişir, ne verir); Rahat geçişte kart ve Meydan oku yok
        const teklif = await yazi('[data-testid="rahat-teklif"]');
        if (label === 'sonuc-kaybetti-rahat-teklif' && (!/Canavar %20 yavaş, 1 can fazla\./.test(teklif) || !/En çok 1 yıldız verir; lig, düello ve takım puanı yazılmaz\./.test(teklif) || !/%20 yavaş, \+1 can, en çok 1 yıldız/.test(await yazi('.result-actions [data-testid="rahat-dene"]')))) fail(rec, `Rahat deneme teklifi eksik: "${teklif}"`);
        if (label !== 'sonuc-kaybetti-rahat-teklif' && teklif) fail(rec, `Rahat deneme teklifi istenmeyen ekranda: "${teklif}"`);
        if (label === 'sonuc-kaybetti-rahat-teklif' && !(await page.locator('.result-actions button').allTextContents()).map((t) => t.trim()).includes('Tekrar dene')) fail(rec, '"Tekrar dene" (normal deneme) düğmesi yok');
        const rahatKart = await yazi('[data-testid="sonuc-rahat"]');
        if (label === 'sonuc-rahat') {
          if (!/Rahat denemeyle geçildi/.test(rahatKart) || !/Normal denemede daha çok yıldız alırsan yıldızın yükselir/.test(rahatKart)) fail(rec, `Rahat sonuç kartı: "${rahatKart}"`);
          if (await page.locator('.star-slot.on').count() !== 1) fail(rec, `Rahat geçişte ${await page.locator('.star-slot.on').count()} yıldız yanıyor (en çok 1)`);
          if (await page.locator('[data-act="meydan"]').count()) fail(rec, 'Rahat geçişte Meydan oku düğmesi var');
        } else if (rahatKart) fail(rec, `Rahat kartı istenmeyen ekranda: "${rahatKart}"`);
        // "Biliyor muydun?" (karar 31): her bölüm sonucunda tek satır görünür
        // (YN-145: ilk ekrana sığmayınca düğme alanında kısa hâli; tam satır o zaman sayfa akışında çizilmez)
        const bilgiTam = page.locator('[data-testid="biliyor-muydun"][data-show="yes"]'); const bilgiKisa = page.locator('[data-testid="biliyor-muydun-kisa"]');
        if (!((await bilgiTam.count()) && (await bilgiTam.isVisible())) && !((await bilgiKisa.count()) && (await bilgiKisa.isVisible()))) fail(rec, '"Biliyor muydun?" satırı görünmüyor');
        // YN-070: kayıpta neden kartı (3. yıldız kartı yok); kazançta 3. yıldız kartı, tutmayan her satırın ilerlemesi yazıyla
        if (label.startsWith('sonuc-kaybetti')) {
          const why = await yazi('[data-testid="sonuc-neden"]');
          if (!/Canların bitti/.test(why)) fail(rec, `kayıp nedeni yazmıyor: "${why}"`);
          if (label === 'sonuc-kaybetti-diken' && !/en son dikene değdin/.test(why)) fail(rec, `son hasar yazmıyor: "${why}"`);
          // YN-136 (OT-sessiz-oyuncu-18): kalkan bir vuruşu karşıladıysa kayıp kartı da söyler (damageNote, karar 37)
          if (label === 'sonuc-kaybetti-kalkan' && !/3\s?hasar aldın \(kalkan bir vuruşu karşıladı; o da sayılır\), en son dikene değdin\./.test(why)) fail(rec, `kalkan yazmıyor: "${why}"`);
          if (label !== 'sonuc-kaybetti-kalkan' && /kalkan bir vuruşu/.test(why)) fail(rec, `kalkansız kayıpta kalkan satırı: "${why}"`);
          if (await page.locator('[data-testid="sonuc-yildiz3"]').count()) fail(rec, 'kayıpta 3. yıldız kartı görünüyor');
          if (label === 'sonuc-kaybetti-kanca' && !/Kancanın yanında basılı tut/.test(why)) fail(rec, `kanca bölümünde kanca ipucu yok: "${why}"`);
          if (ort.length) fail(rec, `kayıp kartları örtüşüyor: ${ort.join('; ')}`);
          const hedef = await yazi('.goal-card');
          if (label === 'sonuc-kaybetti-boss' && (/Kapıya/.test(hedef) || !/gücünün %\d+'(ı|i|u|ü|sı|si|su|sü) kaldı/.test(hedef))) fail(rec, `boss kaybında hedef cümlesi: "${hedef}"`);
        } else if (label === 'sonuc-rahat') {
          // Rahat geçiş: sıradaki yıldızın kartı yok (yıldız 1'de kalır; Rahat kartı yerinde)
          if (await page.locator('[data-testid="sonuc-yildiz2"], [data-testid="sonuc-yildiz3"]').count()) fail(rec, 'Rahat geçişte sıradaki yıldız kartı görünüyor');
        } else if (label === 'sonuc-yildiz1') {
          // 1★: 3. yıldız kartı yerine 2. yıldızın koşulu
          const rows = await page.locator('[data-testid="sonuc-yildiz2"] li').allTextContents().catch(() => []);
          if (!rows.length || !/nota kaldı/.test(rows[0] ?? '')) fail(rec, `2. yıldız kartı yok ya da ilerlemesiz: ${JSON.stringify(rows)}`);
          if (await page.locator('[data-testid="sonuc-yildiz3"]').count()) fail(rec, '1★ sonuçta 3. yıldız kartı görünüyor');
        } else {
          const rows = await page.locator('[data-testid="sonuc-yildiz3"] li').allTextContents().catch(() => []);
          if (!rows.length) fail(rec, '3. yıldız kartı yok');
          if (label === 'sonuc-sure-gec') {
            // süre kartı ve hedef satırı aynı sayıyı söyler, süre hedeften uzun: "64,4 sn sürdü, 0,4 sn geç"
            const sure = (await page.locator('.stats .card', { has: page.locator('.art-timer') }).locator('.v').textContent().catch(() => '')) ?? '';
            const m = /(\d+) saniyede bitir.*?(\d+(?:,\d)?)\s?sn sürdü, 0,4\s?sn geç/.exec(rows[1] ?? '');
            if (!m || Number(m[2].replace(',', '.')) <= Number(m[1]) || !sure.includes(m[2])) fail(rec, `süreli hedef satırı/süre kartı tutarsız: ${JSON.stringify(rows)} · kart "${sure}"`);
          }
          const want3 = { 'sonuc-yildiz-ya-da': [/nota kaldı/, /hasar aldın/], 'sonuc-yildiz-hepsi': [/nota topla.*nota kaldı/], 'sonuc-melodi': [/nota kaldı/, /sırayla/] }[label];
          if (want3 && (rows.length !== want3.length || want3.some((re, i) => !re.test(rows[i] ?? '')))) fail(rec, `3. yıldız satırları beklenen gibi değil: ${JSON.stringify(rows)}`);
        }
        const btn = await page.evaluate(() => [...document.querySelectorAll('.result-actions button')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim(), l: Math.round(r.left), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; }));
        rec.buttons = btn;
        const bad = btn.filter((b) => b.l < 0 || b.r > W || b.b > H);
        if (bad.length) fail(rec, `sonuç düğmeleri görünüm dışında: ${JSON.stringify(bad)}`);
        if (label.startsWith('sonuc-anlatim') || label.startsWith('sonuc-harita')) {
          // Büyük yazıda tanıtım kartı sayfa akışında (ana düğmenin üstünde; YN-158): kaydırınca görünür
          if (BIG) await page.locator('[data-testid="anlatim-bekliyor"]').scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => undefined);
          const strip = await page.locator(`${BIG ? '.result-ek' : '.result-actions'} [data-testid="anlatim-bekliyor"]`).boundingBox().catch(() => null);
          if (!strip || strip.x < 0 || strip.x + strip.width > W || strip.y + strip.height > H) fail(rec, `bekleyen tanıtım satırı görünmüyor ya da taşıyor: ${JSON.stringify(strip)}`);
          if (await page.locator('.result-actions [data-act="sonraki"]').count()) fail(rec, 'bekleyen tanıtım varken Sonraki düğmesi var');
          if (!btn.some((b) => b.t === 'Haritaya dön')) fail(rec, `"Haritaya dön" düğmesi yok: ${btn.map((b) => b.t).join(', ')}`);
          const anlatimYazi = await yazi(`${BIG ? '.result-ek' : '.result-actions'} [data-testid="anlatim-bekliyor"]`);
          const bek = label === 'sonuc-anlatim-iki' ? 'Yeni: Arkadaşlar ve Kulak Sözlüğü' : label === 'sonuc-harita-canlanma' ? 'Kulak Kanalı haritada canlanacak.Hazine sandığını da orada göreceksin.' : label === 'sonuc-harita-cicek' ? 'Koklea · Apeks haritada çiçeklenecek.' : 'Yeni: Kamp';
          if (!anlatimYazi.includes(bek)) fail(rec, `bekleyen tanıtım satırı "${bek}" demiyor: "${anlatimYazi}"`);
        }
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
      // inşaat sürerken üst bant (İnşaatçı çipi uzun: "Merkez 2sa 10dk") + inşaat sırası çipi (en uzun kısa ad: "Sırada: Kütüphane")
      await page.goto(url('demo=kamp&seviye=20&kampsv=22&insaat=merkez&sira=kutuphane'), { waitUntil: 'load' });
      await page.getByRole('button', { name: /Yola çık|Devam/ }).first().click({ timeout: 45_000 });
      await page.locator('nav.tabbar .tab', { hasText: 'Kamp' }).click(); await sleep(800);
      { const u = page.getByRole('button', { name: 'Üs görünümü' }); if (await u.count()) await u.click(); }
      await page.locator('.hud-chip.builder.on').waitFor({ timeout: 20_000 }); await page.getByTestId('sirada-cip').waitFor({ timeout: 10_000 }); await sleep(1200); await toastGone();
      await check('kamp-sv22-insaat', { scroll: false });
      // inşaat sırası (docs/14-kamp.md §14): sıradaki binanın paneli → Sıradan çıkar → aynı panelde "Sıraya al"; süren inşaatın paneli
      await page.getByTestId('sirada-cip').click(); await page.getByTestId('sirada').waitFor(); await sleep(700);
      await page.getByTestId('sirada').scrollIntoViewIfNeeded(); await check('kamp-sira-paneli', { scroll: false });
      await page.getByTestId('sirada').getByRole('button', { name: /Sıradan çıkar/ }).click(); await page.getByTestId('siraya-al').waitFor(); await sleep(500);
      await check('kamp-siraya-al', { scroll: false });
      await page.getByTestId('siraya-al').click(); await page.getByTestId('sirada').waitFor(); await sleep(300);
      await page.getByRole('button', { name: 'Kapat' }).first().click().catch(() => undefined); await sleep(300);
      await page.locator('.sr-only button', { hasText: 'Odyoloji Merkezi' }).evaluate((el) => el.click()); await page.getByTestId('sirada-sonraki').waitFor(); await sleep(600);
      await page.getByTestId('sirada-sonraki').scrollIntoViewIfNeeded(); await check('kamp-sira-suren', { scroll: false });
      await page.getByRole('button', { name: 'Kapat' }).first().click().catch(() => undefined); await sleep(300);
      await page.getByRole('button', { name: 'Liste görünümü' }).click(); await sleep(600);
      await page.getByTestId('sirada-sonraki').waitFor(); await check('kamp-liste-sira'); // kaydırılmış görüntüde sıra satırı görünür
      await page.getByRole('button', { name: 'Üs görünümü' }).click(); await sleep(600);
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
  writeReports(); // her koşudan sonra: uzun bir çalışma yarıda kesilse de biten koşuların raporu kalır
  await browser.close();
}

try {
  for (const target of targets) for (const b of browsers) for (const s of sizes) { console.log(`\n▶ ${target} · ${b} · ${s.join('×')}`); await suite(b, target, s); }
} finally {
  writeReports();
  cleanup();
}
const total = report.reduce((a, r) => a + r.screens.length, 0);
if (KONTRAST) {
  const k = contrastSummary();
  console.log(`\nKontrast (WCAG AA): ${k.violations} ihlal (${k.groups.length} kural), ${k.exceptions} istisna (${k.exceptionGroups.length} kural), ${k.pending} sahip kararı bekliyor, ${k.unmeasured} ölçülemedi · ${k.measured} metin ölçüldü`);
  for (const [note, nn] of Object.entries(k.pendingByProposal)) console.log(`  … bekliyor ${nn}× ${note}`);
  for (const g of k.groups.slice(0, 30)) console.log(`  ✗ ${g.ratio}<${g.need} ${g.sel} · ${g.tx} / ${g.bg}${g.sampled ? ' (örnek)' : ''} “${g.text}” — ${g.count}× (${g.screens.slice(0, 4).join(', ')}${g.screens.length > 4 ? '…' : ''})`);
  for (const g of k.exceptionGroups.slice(0, 15)) console.log(`  · istisna ${g.ratio}<${g.need} ${g.sel} “${g.text}” — ${g.istisna}`);
}
console.log(`\n${failures ? '✗' : '✓'} ${total} ekran denetlendi, ${failures} sorun · çıktı: ${outRoot.replace(root + '/', '')}`);
process.exit(failures ? 1 : 0);
