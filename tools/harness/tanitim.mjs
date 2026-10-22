#!/usr/bin/env node
// ODİ tanıtım dosyası çekimi: oyunun her yerinden gerçek ekran görüntüleri (uygulama + oyun, sahte ekran yok) ve düzenli bir manifest.
//   A acilis   açılış, hikâye (7 panel, Tüy Dede), ilk sonuç turu, harita turu, her özelliğin açılış anı, Ayarlar
//   B bolumler 40 bölüm: isim kartı, imza an(lar)ı (öğretici an, patoloji ilk görüş, set parçası), boss evreleri, seçili sonuç ekranları, final
//   C harita   erken / orta (bölgeler canlanmış) / tam (40 bölüm) + final dönüşü
//   D kamp     ilerleme kademeleri (yeni, Sv 3, 7, 10, 15) ve anıtlar, 7 binanın paneli (düşük/yüksek), Tedavi Odası, açılımlar
//   E etkinlik Ralli, Düello, Bayrak, Ses Avı, Bilgi Yarışması, Görevler, Meydan Okuma, Turnuva, Bölge Savaşı, Baskın
//   F sosyal   takım akışı, tepkiler, yardım, Günün Sorusu, İkili Görev, Usta–Çırak, özel mesaj, canlı yarış, lig, Sıralama
//   G ogrenme  Kulak Sözlüğü, Kulak Kartları, Tüy Dede'nin Notu, açıklamalı bilgi yarışması, Bilgi düzeyi
//   H magaza   Mağaza, Dolap, Ödül kutusu, Profil
// Gerçek sunucu aynı süreçte (bellek içi veritabanı; tohumlama doğrudan veritabanına yazar — camp-e2e.mjs ile aynı yol), web test
// derlemesi (VITE_ODI_E2E=1: ?oyun-bot=1 / ?etkinlik-bot=1 bölümleri harness botu oynar; ?bot=1&hd=2 yüksek çözünürlüklü oyun içi çekim).
// Görüntüler 390×844 (deviceScaleFactor 2) → 780 px genişlikte JPEG (≤ ~150 KB), tools/harness/out/tanitim/img/<bölüm>/<nn>-<ad>.jpg.
// Kaldığı yerden devam eder: biten gruplar (out/tanitim/gruplar/<grup>.json) atlanır; --force grubun eski görüntülerini silip yeniden çeker.
// Kullanım: node tools/harness/tanitim.mjs [--only acilis,bolumler,harita,kamp,etkinlik,sosyal,ogrenme,magaza] [--levels 1-40]
//           [--parallel 2] [--force] [--no-build] [--no-sonuc] [--manifest] (yalnız manifesti yeniden yaz)
//           [--group grup1,grup2,önek-*] (yalnız bu gruplar; ör. --group 'bolum-0*,kamp-tedavi' --force)
// Tüm çekim ≈ 2–2,5 saat (4 çekirdek, yazılımsal GL); 40 bölüm en uzun kısım (bölüm başına ~4 dk, --parallel 2).
// Tohumlama: yerel kayıt (odi-v1: geçilen bölümler, görülen turlar, meta), harita "görüldü" durumu (odi-map-seen), kamp anıtları
// (odi.kamp.anitlar); sunucuda bina seviyeleri/cüzdan doğrudan veritabanına, ilerleme gerçek progress.submit çağrılarıyla.
// Oyun içi tetikler: sahnenin olay akışı dinlenir (öğretici an, patoloji ilk görüş, kanca, yüzme, darbe, boss evreleri…), tetikte sahne
// duraklatılır; yarım kalmış kamera sarsıntısı/flaş temizlenir. Bot modunda çanta verilmediğinden 7. ve 22. bölümde Tedavi Odası
// malzemesi simülasyon durumuna konur (oyun kodu değişmez).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '1'; };
const has = (k) => argv.includes(`--${k}`);
const root = resolve(new URL('../..', import.meta.url).pathname);
const webRoot = resolve(root, 'apps/web');
const OUT = resolve(root, 'tools/harness/out/tanitim'); const IMG = resolve(OUT, 'img'); const GROUPS = resolve(OUT, 'gruplar');
for (const d of [OUT, IMG, GROUPS]) mkdirSync(d, { recursive: true });
const FORCE = has('force');
const ONLY = opt('only', '') ? opt('only').split(',') : null;
const ONLY_GROUP = opt('group', '') ? opt('group').split(',') : null;
const PAR = Number(opt('parallel', 2));
const [LO, HI] = opt('levels', '1-40').split('-').map(Number);
const W = 390, H = 844, DSF = 2, MAX_KB = 150;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(`[tanıtım ${String(Math.round((Date.now() - t0) / 1000)).padStart(5)}s]`, ...a);
const warnings = [];
let lastPage = null;
const warn = (m) => { warnings.push(m); log(`⚠ ${m}`); };

// ---------------------------------------------------------------- bölümler (manifest sırası)
const SECTIONS = [
  { id: 'acilis', title: 'Açılış ve ilk deneyim', intro: 'Yeni bir oyuncunun ilk dakikaları: başlık ekranı, Tüy Dede\'nin anlattığı hikâye, ilk bölümden sonra adım adım açılan özellikler ve ayarlar.' },
  { id: 'bolumler', title: '40 bölüm: kulaktan beyne', intro: 'Dış kulaktan işitme korteksine on bölgede kırk bölüm. Her bölümün isim kartı, yeni yeteneği öğreten an, bölgenin kulak hastalığıyla ilk karşılaşma ve imza mekanikleri; iki boss savaşı ve final.' },
  { id: 'harita', title: 'Yaşayan Kulak Haritası', intro: 'Yolculuk haritası ilerledikçe canlanır: geçilen bölgeler renklenir, hazineler açılır, sonunda Ninni Merkezi ışıl ışıl yanar.' },
  { id: 'kamp', title: 'Kulak Kampı', intro: 'Odyoloji temalı yedi binalık kamp: her bina gerçek bir odyolojik işlevi temsil eder, Tedavi Odası bölümlere götürülen malzemeler üretir, haritada ulaşılan her bölge kampa bir anıt getirir.' },
  { id: 'etkinlik', title: 'Etkinlikler', intro: 'Takımla ve tek başına oynanan, sunucunun yönettiği dürüst etkinlikler: canlı ralli, düello, bayrak yarışı, ortak melodi, bilgi yarışması, günlük görevler, meydan okuma, turnuva, bölge savaşı ve baskın.' },
  { id: 'sosyal', title: 'Birlikte oynamak', intro: 'Gerçek olaylardan oluşan takım akışı, yardımlaşma, Günün Sorusu, ikili görev, usta–çırak, güvenli özel mesajlar, canlı yarış, lig ve sıralama.' },
  { id: 'ogrenme', title: 'Oynarken öğrenmek', intro: 'Kulak Sözlüğü, Kulak Kartları, Tüy Dede\'nin notları ve açıklamalı sorular: odyoloji öğrencisi düzeyine kadar inen, kaynaklı içerik.' },
  { id: 'magaza', title: 'Mağaza, Dolap, Ödül kutusu ve Profil', intro: 'Dürüst mağaza (test modunda para çekmez), Odi\'nin renkleri ve şapkaları, ödül kutusu ve oyuncu profili.' },
];
const want = (s) => !ONLY || ONLY.includes(s);

// ---------------------------------------------------------------- görüntü: PNG → 780 px JPEG (≤ 150 KB)
function encode(png, file) {
  mkdirSync(dirname(file), { recursive: true });
  for (const q of [82, 78, 74, 70, 66, 62, 58, 54]) {
    const r = spawnSync('convert', ['png:-', '-resize', `${W * DSF}x>`, '-strip', '-sampling-factor', '4:2:0', '-interlace', 'Plane', '-quality', String(q), `jpg:${file}`], { input: png });
    if (r.status !== 0) throw new Error(`convert: ${String(r.stderr).slice(0, 200)}`);
    if (statSync(file).size <= MAX_KB * 1024) return q;
  }
  return 54;
}
/** grup: bir arada çekilen görüntüler; biten grup kaydı (gruplar/<id>.json) varsa atlanır */
const groupFile = (id) => resolve(GROUPS, `${id}.json`);
async function group(id, section, fn) {
  if (ONLY_GROUP && !ONLY_GROUP.some((g) => (g.endsWith('*') ? id.startsWith(g.slice(0, -1)) : id === g))) return;
  if (!FORCE && existsSync(groupFile(id))) { log(`↷ ${id} (hazır)`); return; }
  if (existsSync(groupFile(id))) { for (const it of JSON.parse(readFileSync(groupFile(id), 'utf8')).items ?? []) rmSync(resolve(OUT, it.file), { force: true }); rmSync(groupFile(id)); }
  const items = []; const t = Date.now();
  const G = {
    id, section, items,
    /** ekran görüntüsü → JPEG; meta: { title, caption, kind, level?, zone? } */
    async shot(page, nn, slug, meta, o = {}) {
      const rel = `img/${section}/${String(nn).padStart(2, '0')}-${slug}.jpg`;
      const file = resolve(OUT, rel);
      if (!o.keepToasts) await toastGone(page).catch(() => undefined);
      if (o.wait !== 0) await sleep(o.wait ?? 450);
      const png = await page.screenshot({ type: 'png', ...(o.clip ? { clip: o.clip } : {}), ...(o.fullPage ? { fullPage: true } : {}) });
      const q = encode(png, file);
      items.push({ file: rel, ...meta, ...(o.order != null ? { order: o.order } : {}) });
      log(`📸 ${rel} (q${q}, ${Math.round(statSync(file).size / 1024)} KB)`);
      return rel;
    },
  };
  log(`▶ ${id}`);
  try { await fn(G); } catch (e) { warn(`${id}: ${String(e?.message ?? e).split('\n')[0]}`); await lastPage?.screenshot({ path: resolve(OUT, `hata-${id}.png`) }).catch(() => undefined); writeFileSync(resolve(GROUPS, `${id}.yarim.json`), JSON.stringify({ items, error: String(e?.message ?? e) }, null, 1)); return; }
  writeFileSync(groupFile(id), JSON.stringify({ id, section, items, sec: Math.round((Date.now() - t) / 1000) }, null, 1));
  rmSync(resolve(GROUPS, `${id}.yarim.json`), { force: true });
  log(`✓ ${id}: ${items.length} görüntü (${Math.round((Date.now() - t) / 1000)} sn)`);
}
/** sıralama anahtarı: "310a-…" (bölge tanıtımı) aynı bölümün isim kartından önce gelir */
const sortKey = (f) => f.replace(/\/(\d+)a-/, (_, n) => `/${String(Number(n) - 1).padStart(n.length, '0')}z-`);
function writeManifest() {
  const all = readdirSync(GROUPS).filter((f) => f.endsWith('.json') && !f.endsWith('.yarim.json')).map((f) => JSON.parse(readFileSync(resolve(GROUPS, f), 'utf8')));
  const sections = SECTIONS.map((s) => {
    const items = all.filter((g) => g.section === s.id).flatMap((g) => g.items)
      .filter((it) => existsSync(resolve(OUT, it.file)))
      .sort((a, b) => sortKey(a.file).localeCompare(sortKey(b.file), 'tr', { numeric: true }))
      .map(({ order: _o, ...it }) => it);
    return { id: s.id, title: s.title, intro: s.intro, items };
  }).filter((s) => s.items.length);
  let bytes = 0; let n = 0;
  for (const s of sections) for (const it of s.items) { bytes += statSync(resolve(OUT, it.file)).size; n++; }
  const man = { title: 'ODİ: Sesin Yolu — Tanıtım Dosyası', generated: new Date().toISOString(), viewport: `${W}×${H} @${DSF}x`, imageWidth: W * DSF, count: n, totalKB: Math.round(bytes / 1024), sections };
  writeFileSync(resolve(OUT, 'manifest.json'), JSON.stringify(man, null, 1));
  log(`manifest: ${n} görüntü, ${(bytes / 1048576).toFixed(1)} MB → ${resolve(OUT, 'manifest.json').replace(root + '/', '')}`);
  for (const s of sections) log(`   ${s.id}: ${s.items.length}`);
}
if (has('manifest')) { writeManifest(); process.exit(0); }

// ---------------------------------------------------------------- içerik verisi (bölümler, patolojiler, kartlar…)
const veriFile = resolve(OUT, 'veri.mjs');
await build({ entryPoints: [resolve(root, 'tools/harness/tanitim-veri.ts')], bundle: true, platform: 'node', format: 'esm', outfile: veriFile, logLevel: 'warning' });
const DATA = JSON.parse(spawnSync(process.execPath, [veriFile], { encoding: 'utf8', maxBuffer: 64 << 20 }).stdout);
const LV = (n) => DATA.levels[n - 1];
const PAT = (id) => DATA.pathologies[id] ?? { ad: id, sade: '' };

// ---------------------------------------------------------------- web test derlemesi + sunucu (aynı süreç) + önizleme
const vite = await import('vite');
const distDir = resolve(OUT, 'dist');
if (!has('no-build') || !existsSync(resolve(distDir, 'index.html'))) {
  process.env.VITE_ODI_E2E = '1';
  await vite.build({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: distDir, emptyOutDir: true } });
  delete process.env.VITE_ODI_E2E;
}
const srvFile = resolve(OUT, 'server-inproc.mjs');
await build({ entryPoints: [resolve(root, 'apps/server/src/server.ts')], outfile: srvFile, bundle: true, platform: 'node', target: 'node22', format: 'esm', external: ['bufferutil', 'utf-8-validate'], banner: { js: "import { createRequire as __r } from 'node:module'; const require = __r(import.meta.url);" }, logLevel: 'warning' });
const { startServer, configFromEnv } = await import(pathToFileURL(srvFile).href);
const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const servers = {};
/** kind: 'normal' (test mağazası, baskın hep açık) · 'hizli' (+ ODI_EVENTS_FAST: etkinlik süreleri dakikada, Günün Sorusu 45 sn'de açıklanır) */
async function server(kind = 'normal') {
  if (servers[kind]) return servers[kind];
  const env = { ODI_DB: ':memory:', ODI_TEST_STORE: '1', ODI_RAID_ALWAYS: '1', NODE_ENV: 'test', ...(kind === 'hizli' ? { ODI_EVENTS_FAST: '1' } : {}) };
  const srv = await startServer({ ...configFromEnv(env), port: await freePort(), host: '127.0.0.1', log: false, sweepMs: 1000 });
  const db = srv.app.db;
  servers[kind] = { srv, db, url: srv.url, pid: (name) => db.get('SELECT id FROM players WHERE name = ?', name)?.id };
  return servers[kind];
}
const wport = await freePort();
const pv = await vite.preview({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: distDir }, preview: { port: wport, strictPort: true, host: '127.0.0.1' } });
const HOST = `http://127.0.0.1:${wport}/`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
async function shutdown() { await browser.close().catch(() => undefined); await pv.close().catch(() => undefined); for (const s of Object.values(servers)) await s.srv.close().catch(() => undefined); }
process.on('SIGINT', () => { void shutdown().then(() => process.exit(130)); });

// ---------------------------------------------------------------- sayfa yardımcıları
const pad2 = (n) => String(n).padStart(2, '0');
const today = (() => { const d = new Date(Date.now() + 3 * 3600_000); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; })();
/** yerel kayıt (odi-v1): cleared bölüm geçilmiş, turlar görülmüş ya da atlanmış */
function save({ cleared = 0, stars = 3, tours = null, bypass = false, story = true, extra = {}, meta = null } = {}) {
  const progress = {}; for (let i = 1; i <= cleared; i++) progress[i] = { stars: typeof stars === 'function' ? stars(i) : stars, best: 900 + i * 37, plays: 1 + (i % 3) };
  const ftue = { v: 1, story, tours: tours ?? [], ...(bypass ? { bypass: true } : {}) };
  return { state: { journey: 'insan', progress, coins: 180 + cleared * 45, xp: 400 + cleared * 260, streak: Math.min(12, 1 + cleared), lastDay: today, failStreak: 0, recentStars: [3, 2, 3], sounds: false, ftue, ...(meta ? { meta } : {}), ...extra }, version: 3 };
}
/** yeni tarayıcı oyuncusu (390×844 @2x). seed: odi-v1 kaydı; ls: diğer localStorage anahtarları */
async function newPage({ seed = null, ls = {}, reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, isMobile: true, hasTouch: true, locale: 'tr-TR', timezoneId: 'Europe/Istanbul', ...(reduced ? { reducedMotion: 'reduce' } : {}) });
  await ctx.addInitScript(([s, extra]) => {
    try {
      if (sessionStorage.getItem('__tohum')) return; sessionStorage.setItem('__tohum', '1');
      if (s) localStorage.setItem('odi-v1', JSON.stringify(s));
      for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    } catch { /* yok */ }
    // konuşma sentezi yoksa sessiz geç (başsız tarayıcı)
    if (typeof window.SpeechSynthesisUtterance === 'undefined') window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  }, [seed, ls]);
  const page = await ctx.newPage(); lastPage = page;
  page.on('pageerror', (e) => warn(`sayfa hatası: ${String(e.message).slice(0, 160)}`));
  return { ctx, page };
}
const url = (srvUrl, q = '') => `${HOST}?sunucu=${encodeURIComponent(srvUrl ?? 'ws://127.0.0.1:5')}${q ? `&${q}` : ''}`;
const toastGone = async (page) => { for (let i = 0; i < 8 && await page.locator('.toast-top').count(); i++) { await page.locator('.toast-top').first().click({ timeout: 500 }).catch(() => undefined); await sleep(150); } };
async function settle(page) {
  // kutlamalar kuyruk halinde gelir: 1,5 sn boyunca yeni kutlama çıkmayana dek kapat
  let quiet = 0;
  for (let i = 0; i < 60 && quiet < 4; i++) {
    if (!(await page.locator('.cel-root.on').count())) { quiet++; await sleep(400); continue; }
    quiet = 0;
    const cta = page.locator('.cel-cta button');
    if (await cta.count() && await cta.first().isVisible()) await cta.first().click().catch(() => undefined); else await page.mouse.click(195, 420).catch(() => undefined);
    await sleep(400);
  }
  await toastGone(page);
}
const closeBanners = async (page) => { for (const sel of ['[data-testid="iletisim-bildirimi"] .fr-banner-x', '[data-testid="mesaj-bildirimi"] .fr-banner-x', '.fr-banner-x']) for (let i = 0; i < 4 && await page.locator(sel).count(); i++) await page.locator(sel).first().click({ timeout: 800 }).catch(() => undefined); };
async function nickname(page, name) {
  for (let i = 0; i < 16; i++) {
    if (await page.locator('.onboard').count()) { await page.getByRole('textbox', { name: 'Takma ad' }).fill(name); await page.getByRole('button', { name: 'Başla' }).click(); await page.locator('.onboard').waitFor({ state: 'detached' }).catch(() => undefined); return true; }
    if (await page.locator('nav.tabbar').count() && i > 4) return false;
    await sleep(300);
  }
  return false;
}
const tab = (page, id) => page.locator(`nav.tabbar .tab[data-tab="${id}"]`).click();
const scrollTop = (page) => page.evaluate(() => { if (document.scrollingElement) document.scrollingElement.scrollTop = 0; const r = document.getElementById('root'); if (r) r.scrollTop = 0; for (const el of document.querySelectorAll('.screen, .sheet')) el.scrollTop = 0; });

// ================================================================ B · bölümler
/** oyun tuvalinin ekrandaki kutusu (390×780 tasarım; 390×844 görünümde üst/alt siyah bant kırpılır) */
const canvasClip = (page) => page.evaluate(() => { const c = document.querySelector('canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(innerWidth, r.width), height: Math.min(innerHeight - Math.max(0, r.y), r.height) }; });

/** bölüm içi tetikleyiciler (sahnenin olay akışından): k olay türü; s ön ek; n sayı; after en erken sim saniyesi; d gecikme (sim sn) */
function rulesFor(n) {
  const L = LV(n); const R = [];
  for (const a of L.newAbilities) R.push({ id: `tutor-${a.id}`, k: 'tutor', s: a.id, d: 0.8, slow: 0.0001, kind: 'ogretici', ability: a });
  R.push({ id: 'patoloji', k: '@pathology', d: 1.0, kind: 'patoloji' });
  if (REMEDY_FOR[n]) R.push({ id: 'tedavi', k: 'remedy', d: 1.1, kind: 'tedavi' });
  if (L.boss) {
    R.push({ id: 'arena', k: '@time', at: 2.2, d: 0, kind: 'boss' });
    if (n === 40) R.push({ id: 'ciglik', k: 'bossScream', d: 0.9, slow: 0.5, kind: 'boss' });
    R.push({ id: 'vurus', k: 'bossHit', d: 0.6, kind: 'boss' });
    R.push({ id: 'faz2', k: 'bossPhase', n: 2, d: 1.0, slow: 0.5, kind: 'boss' });
    R.push({ id: 'faz3', k: 'bossPhase', n: 3, d: 1.0, slow: 0.5, kind: 'boss' });
    R.push({ id: 'yenildi', k: 'bossDown', d: 1.5, slow: 0.5, kind: 'boss' });
    return { rules: R, cap: 9, gap: 1.2 };
  }
  // bölgeye/mekaniğe özgü imza anları (ilk uygun olan); d: sahne saatiyle bekleme (sn), slow: beklerken simülasyon hızı
  const sig = {
    'dis-kulak': [{ k: 'slide', d: 0.5, after: 6 }, { k: 'cochlea', d: 0.9 }, { k: 'tramp-strong', d: 0.5, after: 6 }],
    kanal: [{ k: 'walljump', d: 0.4, after: 4 }, { k: 'escort', d: 1.0, slow: 1 }, { k: 'slide', d: 0.5, after: 6 }],
    zar: [{ k: 'tramp-strong', s: 'perfect', d: 0.5, after: 9 }, { k: 'glide', d: 0.8, slow: 0.5, after: 9 }],
    kemikcikler: [{ k: 'hook', d: 0.8, slow: 0.5 }, { k: 'poundland', d: 0.3 }, { k: 'switch', d: 0.8 }, { k: 'tramp-strong', s: 'perfect', d: 0.5, after: 6 }],
    'koklea-1': [{ k: 'swim', d: 1.2, slow: 0.6, after: 6 }, { k: 'fork', d: 0.8 }, { k: 'bubble', d: 0.5 }],
    'koklea-2': [{ k: 'fork', d: 0.8 }, { k: 'swim', d: 1.2, slow: 0.6, after: 6 }, { k: 'note', d: 0.6 }],
    'koklea-3': [{ k: 'swim', d: 1.2, slow: 0.6, after: 6 }, { k: 'tramp-strong', s: 'perfect', d: 0.5, after: 6 }, { k: 'escort', d: 1.0, slow: 1 }],
    sinir: [{ k: 'dash', d: 0.3, after: 5 }, { k: 'break', d: 0.3 }, { k: 'chase', d: 1.0, slow: 0.6 }],
    'beyin-sapi': [{ k: 'flip', d: 0.6, slow: 0.4, after: 5 }, { k: 'dash', d: 0.3, after: 5 }],
    korteks: [{ k: 'flip', d: 0.6, slow: 0.4, after: 5 }, { k: 'note', d: 0.6 }, { k: 'dash', d: 0.3, after: 5 }],
  }[L.biome] ?? [];
  // hedefe özgü: sıralı notalar, fısıltı (eskort), altın koklea
  if (/sırayla/.test(L.objective)) sig.unshift({ k: 'note', d: 0.6, after: 3 });
  if (/Fısıltı/.test(L.objective)) sig.unshift({ k: 'escort', d: 1.0, slow: 1 });
  if (/altın koklea/.test(L.objective)) sig.unshift({ k: 'cochlea', d: 0.9 });
  sig.forEach((r, i) => R.push({ id: `imza-${r.k}${i}`, group: 'imza', kind: 'imza', ...r }));
  R.push({ id: 'kontrol', k: 'checkpoint', after: 25, d: 0.8, kind: 'manzara', optional: true });
  return { rules: R, cap: 6, gap: 2.4 };
}

/** sayfada: sahnenin olaylarına tetikleyici kur (bölüm botla oynarken tetikte sahne duraklar). d: olaydan sonra beklenen süre (sn) —
 *  yazılar/halkalar sahnenin tween saatiyle canlandığından gecikme sahne saatiyle (scene.time.now) ölçülür; birden çok tetik sıraya girer */
function installCapture([rules, cap, gap, remedies]) {
  const sc = globalThis.__odiScene; if (!sc || window.__tan) return;
  const T = window.__tan = { tl: [], fired: {}, queue: [], paused: null, shots: 0, lastAt: -99, base: sc.opts.timeScale ?? 1, seenPat: 0, groupsDone: {} };
  if (remedies) { for (const [k, v] of Object.entries(remedies)) sc.sim.rem[k] = v; }
  const ok = (r) => !T.fired[r.id] && !T.queue.some((q) => q.r.id === r.id) && !(r.group && (T.groupsDone[r.group] || T.queue.some((q) => q.r.group === r.group))) && (r.after == null || sc.sim.t >= r.after);
  const strong = (r) => r.k.startsWith('boss') || r.k === 'tutor' || r.k === '@pathology' || r.k === '@time' || r.k === 'remedy';
  const intro = (r) => r.kind === 'ogretici' || r.kind === 'patoloji';
  const arm = (r, info) => {
    if (T.shots + T.queue.length >= cap) return;
    // aynı anda görünen öğretici an + patoloji etiketi tek görüntüde birleşir
    const near = intro(r) && T.queue.find((q) => intro(q.r) && !q.also);
    if (near) { near.also = { id: r.id, kind: r.kind, info }; near.at = Math.max(near.at, sc.time.now + (r.d ?? 0) * 1000); T.fired[r.id] = 1; return; }
    if (r.kind === 'manzara' && T.shots + T.queue.length >= 3) return;
    if (!strong(r) && (sc.sim.t - T.lastAt < gap || T.queue.length)) return;
    T.queue.push({ r, at: sc.time.now + (r.d ?? 0) * 1000, info });
    // beklerken simülasyon ağır çekimde (yazılar/halkalar sahne saatiyle normal hızda canlanır, Odi olay yerinden pek uzaklaşmaz)
    sc.opts = { ...sc.opts, timeScale: T.base * (r.slow ?? 0.25) };
  };
  const orig = sc.onEvent.bind(sc);
  sc.onEvent = (e) => {
    orig(e);
    if (!['coin', 'land', 'jump'].includes(e.k)) T.tl.push([Math.round(sc.sim.t * 100) / 100, e.k, e.s ?? '', e.n ?? '']);
    for (const r of rules) {
      if (r.k !== e.k || !ok(r)) continue;
      if (r.s && !String(e.s ?? '').startsWith(r.s)) continue;
      if (r.n != null && Number(e.n) !== r.n) continue;
      arm(r, { k: e.k, s: e.s ?? null, n: e.n ?? null }); break;
    }
  };
  sc.events.on('postupdate', () => {
    if (T.paused) return;
    const evs = window.__odi?.events ?? [];
    for (; T.seenPat < evs.length; T.seenPat++) {
      const e = evs[T.seenPat]; if (e.type !== 'pathology' || !e.first) continue;
      const r = rules.find((x) => x.k === '@pathology'); if (r && ok(r)) arm(r, { pathology: e.id });
    }
    for (const r of rules) if (r.k === '@time' && ok(r) && sc.sim.t >= r.at) arm(r, {});
    const now = sc.time.now; const i = T.queue.findIndex((q) => q.at <= now);
    if (i < 0) return;
    const { r, info, also } = T.queue.splice(i, 1)[0];
    T.fired[r.id] = 1; if (r.group) T.groupsDone[r.group] = 1; T.shots++; T.lastAt = sc.sim.t;
    T.paused = { id: r.id, t: Math.round(sc.sim.t * 100) / 100, info, kind: r.kind, also: also ?? null }; T.pausedAt = performance.now();
    sc.scene.pause();
    // yarım kalmış anlık efektler (kamera sarsıntısı, tam ekran flaş) donmuş karede bulanık durur: temizle (oyun durumu değişmez)
    const cam = sc.cameras.main; try { cam.shakeEffect.reset(); cam.flashEffect.reset(); } catch { /* yok */ }
    for (const o of [...sc.children.list]) if (o.type === 'Rectangle' && o.depth === 200 && o.width >= 380) o.setVisible(false);
  });
}
async function resumeCapture(page) { await page.evaluate(() => { const sc = globalThis.__odiScene; const T = window.__tan; if (!sc || !T) return; T.paused = null; sc.lastWall = 0; if (!T.queue.length) sc.opts = { ...sc.opts, timeScale: T.base }; sc.scene.resume(); }); }

function levelCaption(n, p) {
  if (p.also) {
    const a = levelCaption(n, { ...p, also: null }); const b = levelCaption(n, { ...p, ...p.also, also: null });
    return { title: `${a.title} · ${b.title.replace(/^İlk karşılaşma: /, '')}`, caption: `${a.caption} Aynı anda ${b.caption.replace(/^[^:]+: /, '').replace(/^bölgenin/, 'bölgenin')}` };
  }
  const L = LV(n); const head = `${n}. bölüm «${L.name}» (${L.zone})`;
  const k = p.info?.k;
  if (p.kind === 'ogretici') {
    const a = L.newAbilities.find((x) => `tutor-${x.id}` === p.id) ?? L.newAbilities[0];
    return { title: `Yeni yetenek: ${a.name}`, caption: `${head}: ${a.name} ilk kez açılıyor. Oyun zamanı yavaşlatır, büyük el işareti hareketi gösterir ("${a.how}"); oyuncu hareketi yapınca akış normale döner.` };
  }
  if (p.kind === 'patoloji') {
    const P = PAT(p.info?.pathology);
    return { title: `İlk karşılaşma: ${P.ad}`, caption: `${head}: bölgenin kulak hastalığı ilk görüldüğünde adıyla etiketlenir ve Tüy Dede tek cümleyle anlatır: "${P.sade}"` };
  }
  if (p.kind === 'tedavi') {
    const [rid = '', pid = ''] = String(p.info?.s ?? '').split('|'); const R = DATA.remedies.find((x) => x.id === rid);
    return { title: `${R?.name ?? 'Malzeme'} korudu!`, caption: `${head}: Tedavi Odası'nda üretilip çantayla bölüme götürülen ${R?.name?.toLocaleLowerCase('tr') ?? 'malzeme'}, ${PAT(pid).ad.toLocaleLowerCase('tr')} engelinin ilk karşılaşmasını bir kez etkisiz kılar; engel söner, can gitmez.` };
  }
  if (p.kind === 'boss') {
    const golem = n === 20;
    const t = { arena: golem ? ['Serumen Golemi: arena', 'Kanalın sonunda serumenden bir dev yolu kapatıyor. Tek ekranlık arenada iki yanda tırmanılabilir duvarlar var; gölgeli yumruklardan zıplayarak kaçılır.'] : ['Gürültü Canavarı: arena', 'Büyük Sessizlik\'in bekçisi ninniyi susturmak istiyor. Duvarlardan gelen gürültü dalgalarından alçakta zıplayarak, yüksekte kayarak kaçılır.'],
      'ciglik': ['Gürültü Canavarı bağırıyor', 'Canavar bağırınca arenaya üç nota düşer; Odi üç notayı toplayınca canavarın kalbi açığa çıkar.'],
      kalp: ['Kalbi açıkta!', 'Üç nota toplandı: canavarın kalbi iner. Ses darbesiyle atılmak ya da üstüne çakılmak büyük hasar verir.'],
      vurus: golem ? ['Golem\'e çakılma', 'Golem\'in yere saplanan yumruğuna yukarıdan çakılmak ona hasar verir; can çubuğu ve evre üstte görünür.'] : ['Kalbi açıkta: darbe!', 'Üç nota toplanınca canavarın kalbi iner; ses darbesiyle atılmak ya da üstüne çakılmak -3 hasar verir.'],
      faz2: golem ? ['Golem · 2. evre', 'İkinci evrede Golem serumen topları yuvarlar: üstlerinden zıplanır. Tüy Dede her evrenin kuralını kısa bir yazıyla hatırlatır.'] : ['Canavar · 2. evre', 'İkinci evrede dalgalar sıklaşır; oyuncu alçak dalgada zıplar, yüksek dalgada kayar.'],
      faz3: golem ? ['Golem · 3. evre', 'Son evrede çift yumruk ve tavandan damlalar gelir; doğru anı yakalayıp çakılmak gerekir.'] : ['Canavar · son evre', 'Son evrede canavar en hızlı haliyle saldırır; notalar, kalp ve darbe döngüsü sürer.'],
      yenildi: golem ? ['Kanal açıldı!', 'Serumen Golemi dağıldı: kanal açılır ve yolculuk orta kulağa doğru devam eder.'] : ['Ninni beyne ulaştı', 'Gürültü Canavarı yenildi: annenin ninnisi beyne ulaşır, ninni melodisi çalar. Yolculuğun finali.'] }[p.id] ?? ['Boss', ''];
    return { title: t[0], caption: `${head}: ${t[1]}` };
  }
  const sig = {
    slide: ['Altından kay', 'aşağı kaydırınca Odi alçak engellerin (kulak kılı perdesi) altından kayar.'],
    cochlea: ['Altın koklea bulundu', 'her bölümde üç altın koklea gizli yerlerde saklıdır; yaklaşınca hafif çan ve kıvılcımlar yönü fısıldar.'],
    walljump: ['Duvar zıplaması', 'kanal bacasında Odi duvardan duvara zıplayarak tırmanır; her zıplamada koşu yönü döner.'],
    escort: ['Fısıltıyı taşı', 'bu bölümde hedef, minik "Fısıltı"yı düşmanlardan koruyarak kapıya sağ salim götürmek.'],
    'tramp-strong': ['Zar sıçrayışı: Mükemmel!', 'zara değdiği an dokunan oyuncu güçlü sıçrar; tam zamanında dokunuş "Mükemmel!" halkasıyla ödüllenir.'],
    glide: ['Ses kanatlarıyla süzülme', 'havada basılı tutunca Odi ses dalgası kanatlarıyla süzülür ve uzun boşlukları aşar.'],
    hook: ['Kancada sallanma', 'kemikçik makinesinde kancanın yanında basılı tutunca Odi sallanır, bırakınca fırlar.'],
    poundland: ['Yere çakılma', 'havada aşağı kaydırınca Odi yere çakılır; çatlak zemini kırar, anahtarlara basar.'],
    switch: ['Anahtar ve kapı', 'çakılarak basılan anahtar kapıyı açar; gizli odalara yol açılır.'],
    swim: ['Kokleada yüzme', 'perilenf sıvısında basılı tutunca Odi yükselir, bırakınca dalar; nefes göstergesine dikkat.'],
    fork: ['Frekans kapısı', 'tonotopi renginde diyapazon toplanınca aynı renkteki frekans kapıları açılır: kokleanın frekans haritası oyunlaşır.'],
    bubble: ['Hava kabarcığı', 'kokleada kabarcıklar nefesi tazeler.'],
    note: ['Notaları sırayla topla', 'notalar melodi sırasıyla toplanır; her nota kendi frekansında çalar ve sıra sayacı ilerler.'],
    dash: ['Ses darbesi', 'koşu yönüne kaydırınca Odi ses darbesiyle atılır: gürültü duvarlarını kırar, düşmanları dağıtır, yankı yollarını görünür kılar.'],
    break: ['Gürültü duvarını kır', 'ses darbesiyle atılan Odi gürültü duvarını parçalar.'],
    chase: ['Işık treni kaçışı', 'arkadan gelen ışık treninden kaçış: durmadan atılmak gerekir.'],
    flip: ['Yerçekimi çevirme', 'mor bölgelerde dokununca yerçekimi döner; Odi tavanda koşar.'],
    checkpoint: ['Kontrol noktası', 'bölüm içi bölümler arasında kontrol noktaları ışıkla yanar; düşünce oradan devam edilir.'],
  }[k] ?? ['Bölümden bir an', 'otomatik koşu, tek dokunuşla derin hareket.'];
  return { title: sig[0], caption: `${head}: ${sig[1]}` };
}

/** bir bölümün oyun içi çekimleri: isim kartı (dokun ve başla) + botun oynadığı koşudaki tetik anları */
async function captureLevel(n) {
  const L = LV(n); const nn = (k) => String(n * 10 + k).padStart(3, '0'); const sec = 'bolumler';
  await group(`bolum-${pad2(n)}`, sec, async (G) => {
    const base = { level: n, zone: L.zone };
    // 1) isim kartı: dokunuş girdili mod (bot yok) → "Dokun ve başla" kartı
    { const { ctx, page } = await newPage();
      await page.goto(`${HOST}?bot=1&human=1&level=${n}&hd=2`);
      await page.waitForFunction(() => window.__odi?.events?.some((e) => e.type === 'ready') && document.querySelector('canvas'), null, { timeout: 60_000 });
      await sleep(1600);
      await G.shot(page, nn(0), `${slugify(L.name)}-isim`, { ...base, kind: 'isim-karti', title: `${n}. ${L.name}`, caption: `${L.zone} bölgesi, ${n}. bölüm. Bölüm adı ve hedefi ("${L.objective}") ekrana dokununca başlar${L.modifiers.length ? `; bu bölümde ${L.modifiers.map(modName).join(', ')} değiştiricisi var` : ''}.` }, { clip: await canvasClip(page), wait: 0 });
      await ctx.close(); }
    // 2) bot koşusu + tetik anları
    const { rules, cap, gap } = rulesFor(n);
    const remedies = REMEDY_FOR[n] ?? null;
    const { ctx, page } = await newPage();
    await page.goto(`${HOST}?bot=1&level=${n}&hd=2`);
    await page.waitForFunction(() => globalThis.__odiScene && window.__odi?.events?.some((e) => e.type === 'started'), null, { timeout: 60_000 });
    await page.evaluate(installCapture, [rules, cap, gap, remedies]);
    let k = 1; const deadline = Date.now() + 9 * 60_000;
    while (Date.now() < deadline) {
      const st = await page.waitForFunction(() => (window.__tan?.paused ? { p: window.__tan.paused } : window.__odi?.done ? { done: true } : null), null, { timeout: 8 * 60_000, polling: 120 }).then((h) => h.jsonValue());
      if (st.done) break;
      await sleep(350);
      const cap2 = levelCaption(n, st.p);
      await G.shot(page, nn(k), `${slugify(L.name)}-${slugify(st.p.id)}`, { ...base, kind: st.p.kind, ...cap2, simT: st.p.t }, { clip: await canvasClip(page), wait: 0 });
      k++;
      await resumeCapture(page);
    }
    const res = await page.evaluate(() => ({ r: window.__odi?.result && { completed: window.__odi.result.completed, stars: window.__odi.result.stars, timeSec: window.__odi.result.timeSec }, tl: window.__tan?.tl ?? [] }));
    writeFileSync(resolve(OUT, `zaman-L${pad2(n)}.json`), JSON.stringify(res));
    if (!res.r?.completed) warn(`L${n}: bot bölümü bitiremedi (${JSON.stringify(res.r)})`);
    await ctx.close();
  });
}
const slugify = (s) => String(s).toLocaleLowerCase('tr').replace(/[âà]/g, 'a').replace(/[îì]/g, 'i').replace(/[ûù]/g, 'u').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const modName = (m) => ({ sis: 'sis', gece: 'gece', hiz: 'hız', yanki: 'yankı', ayna: 'ayna', 'tek-can': 'tek can', 'ters-yercekimi': 'ters yerçekimi', 'cihaz-kapali': 'cihaz kapalı' })[m] ?? m;
/** Tedavi Odası malzemesinin bölümdeki etkisi: botun koşusunda (bot modunda çanta verilmez) sim durumuna malzeme konur */
const REMEDY_FOR = { 7: { 'kulak-tikaci': 2, 'serumen-damlasi': 2, 'dis-kulak-damlasi': 2 }, 22: { 'kulak-tikaci': 2, 'isitme-cihazi': 2 } };

// ================================================================ A · açılış ve ilk deneyim
const stepLog = {};
/** anlatıcı turunu yürüt; shots: { [adım sırası]: { slug, title, caption? } } — caption yoksa Tüy Dede'nin cümlesi yazılır */
async function driveTour(G, page, tourId, nnBase, shots, ctxNote = '') {
  const sel = `[data-testid="anlatici-tur"][data-tour="${tourId}"]`;
  await page.locator(sel).waitFor({ timeout: 45_000 });
  let last = null; let guard = 0; const log = stepLog[tourId] = [];
  while (await page.locator(sel).count() && guard++ < 60) {
    const step = await page.locator('[data-testid="anlatici-tur"]').getAttribute('data-step').catch(() => null);
    if (step !== last && step != null) {
      last = step;
      // daktilo bitsin (düğme "Devam" → "İleri") ya da dokunma halkası yerine otursun
      for (let i = 0; i < 30; i++) { const lbl = await page.locator('[data-testid="anlatici-ileri"] .lbl').innerText().catch(() => ''); if (lbl === 'İleri' || await page.locator('[data-testid="anlatici-ipucu"]').count()) break; await sleep(250); }
      if (await page.locator('[data-testid="anlatici-ipucu"]').count()) await page.locator('.coach-ring').waitFor({ timeout: 4000 }).catch(() => undefined);
      await sleep(700);
      const say = await page.locator('[data-testid="anlatici"]').first().getAttribute('data-say').catch(() => '');
      log.push({ step: Number(step), say });
      const want = shots[Number(step)];
      if (want) await G.shot(page, nnBase + Number(step), want.slug, { kind: 'tur', title: want.title, caption: want.caption ?? `${ctxNote}Tüy Dede: "${say}"` }, { wait: 100 });
    }
    const next = page.locator('[data-testid="anlatici-ileri"]');
    if (await next.count()) { await next.click().catch(() => undefined); await sleep(450); continue; }
    if (await page.locator('[data-testid="anlatici-ipucu"]').count()) {
      let r = null;
      for (let k = 0; k < 14; k++) { const a = await page.locator('.coach-ring').boundingBox().catch(() => null); await sleep(150); const b = await page.locator('.coach-ring').boundingBox().catch(() => null); if (a && b && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1) { r = b; break; } }
      if (r) { await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2 + 6); await sleep(1000); continue; }
    }
    await sleep(400);
  }
  writeFileSync(resolve(OUT, 'tur-adimlari.json'), JSON.stringify(stepLog, null, 1));
}
async function waitResult(page) {
  for (let i = 0; i < 400 && !(await page.locator('.result-actions').count()); i++) { const h = page.getByRole('button', { name: /Haydi/ }); if (await h.count()) await h.click().catch(() => undefined); await sleep(500); }
  await page.locator('.result-actions').waitFor({ timeout: 5000 });
}
const TOURS_BEFORE = (id) => { const order = ['result1', 'map', 'today', 'camp', 'camp-build', 'friends', 'glossary', 'team', 'siralama', 'shop', 'akis', 'events', 'race', 'yazi', 'soru', 'ikili', 'usta']; return order.slice(0, order.indexOf(id)); };

async function sectionAcilis() {
  const S = await server('normal');
  // ---- 1) gerçek ilk açılış: başlık → hikâye → biyom tanıtımı → 1. bölüm (bot) → sonuç turu → takma ad → harita turu
  await group('acilis-ilk', 'acilis', async (G) => {
    const { ctx, page } = await newPage();
    await page.goto(url(S.url, 'oyun-bot=1'), { waitUntil: 'load' });
    await page.getByRole('button', { name: /Yola çık/ }).waitFor({ timeout: 45_000 }); await sleep(1800);
    await G.shot(page, 1, 'baslik', { kind: 'ekran', title: 'Başlık ekranı', caption: 'ODİ: Sesin Yolu açılışı. Yeni oyuncu tek düğmeyle ("Yola çık") hikâyeye başlar; geri dönen oyuncu kaldığı yerden devam eder.' });
    await page.getByRole('button', { name: /Yola çık/ }).click();
    await page.locator('[data-testid="hikaye"]').waitFor();
    for (let i = 0; i < 7; i++) {
      await page.locator(`[data-testid="hikaye"][data-step="${i}"]`).waitFor();
      for (let k = 0; k < 30; k++) { const lbl = await page.locator('[data-testid="anlatici-ileri"] .lbl').innerText().catch(() => ''); if (lbl === 'İleri' || lbl === 'Başla' || !lbl) break; await sleep(250); }
      await sleep(900);
      const say = await page.locator('[data-testid="anlatici"]').first().getAttribute('data-say').catch(() => '');
      await G.shot(page, 2 + i, `hikaye-${i + 1}`, { kind: 'hikaye', title: `Hikâye ${i + 1}/7`, caption: `Tüy Dede anlatıyor: "${say}"` }, { wait: 100 });
      await page.locator('[data-testid="anlatici-ileri"]').click(); await sleep(250);
      if (await page.locator(`[data-testid="hikaye"][data-step="${i}"]`).count()) await page.locator('[data-testid="anlatici-ileri"]').click().catch(() => undefined);
    }
    await page.getByRole('button', { name: /Haydi/ }).waitFor({ timeout: 20_000 }); await sleep(1200);
    const note = await page.locator('[data-testid="tuy-notu"]').first().innerText().catch(() => '');
    await G.shot(page, 9, 'biyom-tanitimi', { kind: 'ekran', title: 'Bölge tanıtımı: Dış Kulak', caption: `Her yeni bölgeye girerken kısa bir tanıtım ve Tüy Dede'nin Notu çıkar${note ? `: "${note.split('\n').map((l) => l.trim()).filter((l) => l && !/TÜY DEDE|Daha fazla/i.test(l)).join(' ').slice(0, 160)}"` : ''}. "Haydi!" ile bölüm başlar.` });
    await page.getByRole('button', { name: /Haydi/ }).click();
    await waitResult(page); await sleep(2500);
    await driveTour(G, page, 'result1', 10, { 0: { slug: 'ilk-sonuc-yildizlar', title: 'İlk sonuç ekranı' }, 2: { slug: 'ilk-sonuc-notalar', title: 'Sonuç turu: notalar ve süre' } }, '1. bölümden sonra sonuç ekranını Tüy Dede tanıtır. ');
    // takma ad + renk (ilk bağlantı)
    for (let i = 0; i < 30 && !(await page.locator('.onboard').count()); i++) await sleep(300);
    if (await page.locator('.onboard').count()) {
      await page.getByRole('textbox', { name: 'Takma ad' }).fill('Kulakçı Ayşe'); await page.locator('.swatch').nth(4).click(); await sleep(500);
      await G.shot(page, 14, 'takma-ad', { kind: 'ekran', title: 'Takma ad ve Odi\'nin rengi', caption: 'İlk bağlantıda oyuncu takma adını ve Odi\'nin rengini seçer. Seçilen renk her yerde aynıdır: bölümde, haritada, kampta, profilde ve arkadaşların gördüğü yarış hayaletinde.' });
      await page.getByRole('button', { name: 'Başla' }).click(); await page.locator('.onboard').waitFor({ state: 'detached' }).catch(() => undefined);
    }
    await driveTour(G, page, 'map', 15, { 0: { slug: 'harita-turu', title: 'Harita turu' }, 1: { slug: 'harita-turu-ust-cubuk', title: 'Harita turu: üst çubuk' }, 2: { slug: 'harita-turu-kilitli-sekmeler', title: 'Kilitli sekmeler dürüstçe bekler' } }, 'İlk bölümden sonra harita açılır. ');
    await ctx.close();
  });
  // ---- 2) özelliklerin açılış anları: kayıt tohumlanmış kontrol noktaları (o kadar bölüm geçilmiş, önceki turlar görülmüş)
  const points = [
    ['today', 2, 30, { 0: ['bugun-acildi', 'Yeni yer: Bugün'], 2: ['bugun-takvim-odulu', 'Bugün: takvim ödülü'], 3: ['bugun-gorevler', 'Bugün: üç günlük görev'] }],
    ['camp', 3, 40, { 0: ['kamp-acildi', 'Yeni yer: Kulak Kampı'] }, 'camp-build', { 1: ['kamp-ogretici-binaya-dokun', 'Kamp öğreticisi: binaya dokun'], 2: ['kamp-ogretici-panel', 'Kamp öğreticisi: bina paneli'], 4: ['kamp-ogretici-insaat', 'Kamp öğreticisi: ilk inşaat başladı'] }],
    ['friends', 4, 50, { 0: ['arkadaslar-acildi', 'Yeni yer: Arkadaşlar ve mesajlar'], 2: ['arkadaslar-kutucugu', 'Profil: Arkadaşlar kutucuğu'] }],
    ['glossary', 4, 55, { 0: ['sozluk-acildi', 'Yeni yer: Kulak Sözlüğü'], 3: ['sozluk-ilk-terim', 'Kulak Sözlüğü: ilk terimler'] }],
    ['team', 5, 60, { 0: ['takim-acildi', 'Yeni yer: Takım'], 2: ['takim-turu', 'Takım turu'] }],
    ['siralama', 5, 65, { 0: ['siralama-acildi', 'Yeni yer: Sıralama'], 3: ['siralama-turu-benim-siram', 'Sıralama turu: benim sıram'] }],
    ['shop', 6, 70, { 0: ['magaza-acildi', 'Yeni yer: Mağaza, Dolap ve Ödül kutusu'], 2: ['magaza-turu-dolap', 'Mağaza turu: Dolap'] }],
    ['akis', 6, 75, { 0: ['akis-acildi', 'Yeni: Takım Akışı ve tepkiler'] }],
    ['events', 7, 80, { 0: ['etkinlikler-acildi', 'Yeni yer: Etkinlikler'], 2: ['etkinlik-cadiri', 'Etkinlik çadırı'] }],
    ['race', 8, 85, { 0: ['yaris-acildi', 'Yeni: Canlı yarış ve meydan okuma'] }],
    ['yazi', 8, 87, { 0: ['serbest-yazi-acildi', 'Yeni: Serbest yazı'], 1: ['serbest-yazi-kurallar', 'Serbest yazı: güvenlik kuralları'] }],
    ['soru', 9, 90, { 0: ['gunun-sorusu-acildi', 'Yeni: Günün Sorusu'] }],
    ['ikili', 10, 93, { 0: ['ikili-gorev-acildi', 'Yeni: İkili Görev'] }],
    ['usta', 11, 96, { 0: ['usta-cirak-acildi', 'Yeni: Usta–Çırak'] }],
  ];
  for (const [tourId, cleared, nn, shots, then, thenShots] of points) {
    await group(`acilis-tur-${tourId}`, 'acilis', async (G) => {
      const { ctx, page } = await newPage({ seed: save({ cleared, stars: 2, tours: TOURS_BEFORE(tourId) }) });
      await page.goto(url(S.url), { waitUntil: 'load' });
      await page.getByRole('button', { name: /Devam et/ }).click({ timeout: 45_000 });
      await page.locator('nav.tabbar').waitFor({ timeout: 20_000 }); await nickname(page, `Kaşif${cleared}${tourId.slice(0, 3)}`);
      const sh = Object.fromEntries(Object.entries(shots).map(([k, [slug, title]]) => [k, { slug, title }]));
      await driveTour(G, page, tourId, nn, sh, `${cleared}. bölüm geçilince açılır. `);
      if (then) { await page.locator('.camp-base').waitFor({ timeout: 25_000 }); await sleep(1500);
        await driveTour(G, page, then, nn + 5, Object.fromEntries(Object.entries(thenShots).map(([k, [slug, title]]) => [k, { slug, title }])), 'Kamp açılınca Tüy Dede ilk binayı birlikte kurdurur. '); await sleep(1500);
        await page.getByRole('button', { name: 'Kapat' }).first().click().catch(() => undefined); await sleep(1500);
        await G.shot(page, `${nn + 9}b`, 'kamp-ilk-insaat-iskele', { kind: 'kamp', title: 'İlk inşaat: iskele ve sayaç', caption: 'Öğretici bitince gerçek inşaat sürer: binanın etrafında iskele kurulur, üst göstergede kalan süre sayar; takımdan yardım istenebilir.' });
      }
      await ctx.close();
    });
  }
  // ---- 3) Ayarlar: Anlatıcı sesi, Bilgi düzeyi, Sıfırla
  await group('acilis-ayarlar', 'acilis', async (G) => {
    const { ctx, page } = await newPage({ seed: save({ cleared: 12, tours: TOURS_BEFORE('usta').concat('usta') }) });
    await page.goto(url(S.url), { waitUntil: 'load' });
    await page.getByRole('button', { name: /Devam et/ }).click({ timeout: 45_000 });
    await page.locator('nav.tabbar').waitFor({ timeout: 20_000 }); await nickname(page, 'Ayarcı'); await settle(page);
    await tab(page, 'profile'); await page.locator('.menu-tile[data-tile="settings"]').click(); await sleep(900);
    await G.shot(page, 98, 'ayarlar', { kind: 'ekran', title: 'Ayarlar', caption: 'Ses ve müzik düzeyleri, Tüy Dede\'nin anlatıcı sesi (yazı her zaman ekranda), Bilgi düzeyi (Meraklı ya da Odyoloji öğrencisi) ve hikâyeyi yeniden izleme tek ekranda.' });
    await page.locator('.seg[aria-label="Bilgi düzeyi"] button').last().click().catch(() => undefined); await sleep(500);
    await page.getByRole('heading', { name: 'Bilgi düzeyi' }).scrollIntoViewIfNeeded().catch(() => undefined); await sleep(400);
    await G.shot(page, 99, 'ayarlar-bilgi-duzeyi', { kind: 'ekran', title: 'Bilgi düzeyi: Odyoloji öğrencisi', caption: 'Odyoloji öğrencisi düzeyi seçilince Tüy Dede\'nin notları teknik ayrıntıyla açılır, bilgi yarışması öğrenci düzeyindeki soruları öne çıkarır.' });
    await page.getByTestId('sifirla').scrollIntoViewIfNeeded(); await page.getByTestId('sifirla').click(); await sleep(900);
    await G.shot(page, 100, 'ayarlar-sifirla', { kind: 'ekran', title: 'Her şeyi sıfırla', caption: 'Sıfırlama dürüstçe neyin silineceğini sayar ve onay ister; onaylanırsa oyun hikâyeyle baştan başlar.' });
    await ctx.close();
  });
}

// ================================================================ C · harita
const ADAY = resolve(OUT, 'aday'); mkdirSync(ADAY, { recursive: true });
/** inceleme için ara kareler (manifest dışı) */
async function frames(page, prefix, n, every) { for (let i = 0; i < n; i++) { await sleep(every); await page.screenshot({ path: resolve(ADAY, `${prefix}-${pad2(i)}.png`) }); } }
const starsMap = (n, f) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, f(i + 1)]));
const mapSeen = (stars, restored = []) => ({ state: { init: true, stars, restored }, version: 1 });
async function swipeMap(page, dy) {
  // dokunmatik sürükleme (CDP): harita dokunma olaylarını dinler. dy < 0 → aşağıya (geçmiş bölgelere) bak
  const cdp = await page.context().newCDPSession(page);
  const steps = Math.max(1, Math.ceil(Math.abs(dy) / 380));
  for (let k = 0; k < steps; k++) {
    const d = dy / steps; const x = 200, y0 = d > 0 ? 260 : 620;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let i = 1; i <= 14; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y0 + (d * i) / 14) }] }); await sleep(24); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(k === steps - 1 ? 1600 : 500);
  }
  await cdp.detach().catch(() => undefined);
}
async function openMap(S, seedOpts, seen, q = 'harita=tam') {
  const s0 = save(seedOpts); const ls = seen ? { 'odi-map-seen': seen } : {};
  const { ctx, page } = await newPage({ seed: s0, ls });
  await page.goto(url(S.url, q), { waitUntil: 'load' });
  await page.getByRole('button', { name: /Devam et|Yola çık/ }).click({ timeout: 45_000 });
  await page.locator('.map-stage canvas').waitFor({ timeout: 25_000 });
  await nickname(page, `Gezgin${seedOpts.cleared}`);
  return { ctx, page };
}
const ALL_TOURS = ['result1', 'map', 'today', 'camp', 'camp-build', 'friends', 'glossary', 'team', 'siralama', 'shop', 'akis', 'events', 'race', 'yazi', 'soru', 'ikili', 'usta'];
async function sectionHarita() {
  const S = await server('normal');
  await group('harita-erken', 'harita', async (G) => {
    const st = starsMap(3, (n) => (n === 2 ? 2 : 3));
    const { ctx, page } = await openMap(S, { cleared: 3, stars: (n) => st[n], tours: ALL_TOURS }, mapSeen(st));
    await sleep(3500); await settle(page);
    await G.shot(page, 1, 'erken', { kind: 'harita', title: 'Harita: yolculuğun başı', caption: 'Dış Kulak\'ta ilk bölümler: geçilen bölümler yıldızlarıyla parlar, Odi sıradaki bölümün başında bekler; üst çubukta seviye, yıldızlar, jeton ve kristal, ortada sıradaki hedef yazar.' });
    await page.waitForFunction(() => !!window.__harita, null, { timeout: 15_000 }); await page.evaluate(() => window.__harita.card(4)); await sleep(1200);
    await G.shot(page, 2, 'bolum-karti', { kind: 'harita', title: 'Bölüm kartı', caption: 'Haritada bir bölüme dokununca kartı açılır: bölüm adı, hedefi, en iyi skor ve yıldızlar, bölgede karşılaşılabilecek kulak hastalığı ipucu ve Oyna düğmesi.' });
    await ctx.close();
  });
  await group('harita-donus', 'harita', async (G) => {
    const before = starsMap(4, () => 3);
    const { ctx, page } = await openMap(S, { cleared: 5, stars: 3, tours: ALL_TOURS, meta: { treasures: [5] } }, mapSeen(before));
    await sleep(2600);
    await G.shot(page, 3, 'bolge-canlaniyor', { kind: 'harita', title: 'Dönüş sahnesi', caption: 'Haritaya dönüşte son ilerleme canlandırılır: yeni kazanılan yıldızlar düğüme uçar, yol ışıkla dolar.' }, { wait: 0 });
    for (let i = 0; i < 40 && !(await page.locator('.cel-root.on').count()); i++) await sleep(500);
    await sleep(2200);
    await G.shot(page, 4, 'hazine-acilis', { kind: 'harita', title: 'Hazine · Bölüm 5', caption: 'Her beş bölümde bir haritada hazine sandığı açılır; içerik önceden görünür, şans yoktur. Burada 50 jeton ve 20 XP.' }, { wait: 0 });
    await page.locator('.cel-cta button').first().click().catch(() => undefined);
    for (let i = 0; i < 40 && !(await page.locator('.cel-root.on', { hasText: 'canland' }).count()); i++) await sleep(500);
    if (await page.locator('.cel-root.on', { hasText: 'canland' }).count()) {
      await sleep(1800);
      await G.shot(page, 5, 'bolge-canlandi-kutlama', { kind: 'harita', title: 'Dış Kulak yeniden canlandı!', caption: 'Bir bölgenin bütün bölümleri üç yıldızla geçilince bölge canlanır: solgun manzara renklenir ve kutlama kartı çıkar.' }, { wait: 0 });
      await page.locator('.cel-cta button').first().click().catch(() => undefined);
    }
    await sleep(3500); await toastGone(page);
    await G.shot(page, '05b', 'bolge-canlandi-harita', { kind: 'harita', title: 'Canlanan Dış Kulak', caption: 'Canlanan bölge haritada kalıcı olarak renkli ve hareketli görünür; sıradaki hedef Kulak Kanalı\'dır.' });
    await ctx.close();
  });
  await group('harita-orta', 'harita', async (G) => {
    const st = starsMap(20, (n) => (n % 3 ? 3 : 2));
    const { ctx, page } = await openMap(S, { cleared: 20, stars: (n) => st[n], tours: ALL_TOURS, meta: { treasures: [5, 10, 15, 20], seenBiomes: ['dis-kulak', 'kanal', 'zar', 'kemikcikler'] } }, mapSeen(st, ['dis-kulak', 'kanal', 'zar', 'kemikcikler']));
    await sleep(3500); await settle(page);
    await G.shot(page, 6, 'orta-koklea-kapisi', { kind: 'harita', title: 'Harita: orta kulaktan kokleaya', caption: '20 bölüm sonra: Serumen Golemi yenilmiş, dış kulak, kanal, kulak zarı ve kemikçikler canlanmış; Odi kokleanın kapısında.' });
    await swipeMap(page, -520);
    await G.shot(page, 7, 'orta-canlanan-bolgeler', { kind: 'harita', title: 'Canlanan bölgeler', caption: 'Geride kalan bölgeler renkli ve hareketli: açılmış hazineler, üç yıldızlı bölümler ve bölgelerin el boyaması manzarası.' });
    await swipeMap(page, -1100);
    await G.shot(page, 8, 'orta-baslangic', { kind: 'harita', title: 'Kulak kepçesinden başlayan yol', caption: 'Haritanın en altı: yolculuğun başladığı Dış Kulak, her bölüm düğümünde kazanılan yıldızlar.' });
    await ctx.close();
  });
  await group('harita-tam', 'harita', async (G) => {
    const st = starsMap(40, () => 3);
    const all = ['dis-kulak', 'kanal', 'zar', 'kemikcikler', 'koklea-1', 'koklea-2', 'koklea-3', 'sinir', 'beyin-sapi', 'korteks', 'finale'];
    const { ctx, page } = await openMap(S, { cleared: 40, stars: 3, tours: ALL_TOURS, meta: { treasures: [5, 10, 15, 20, 25, 30, 35, 40] } }, mapSeen(st, all));
    await sleep(3500); await settle(page);
    await G.shot(page, 9, 'tam-ninni-merkezi', { kind: 'harita', title: 'Tamamlanan harita: Ninni Merkezi', caption: '40 bölümün hepsi üç yıldızla geçildiğinde haritanın tepesi: işitme korteksi ve ışıl ışıl yanan Ninni Merkezi.' });
    for (const [i, dy, t, c] of [[10, -700, 'Beyin sapı ve işitme siniri', 'Tamamlanmış yolculuk: işitme sinirinden beyin sapına uzanan bölümler, hepsi üç yıldızla.'], [11, -1100, 'Kokleanın üç kıvrımı', 'Koklea\'nın tabanı, orta kıvrımı ve apeksi: tonotopi renkleriyle boyanmış bölgeler.'], [12, -1100, 'Kemikçikler ve kulak zarı', 'Orta kulak: kemikçik makinesi ve titreyen kulak zarı bölgeleri.']]) {
      await swipeMap(page, dy);
      await G.shot(page, i, `tam-${slugify(t)}`, { kind: 'harita', title: t, caption: c });
    }
    await ctx.close();
  });
  await group('harita-final', 'harita', async (G) => {
    const before = starsMap(39, () => 3);
    const all = ['dis-kulak', 'kanal', 'zar', 'kemikcikler', 'koklea-1', 'koklea-2', 'koklea-3', 'sinir', 'beyin-sapi'];
    const tr = [5, 10, 15, 20, 25, 30, 35];
    const { ctx, page } = await openMap(S, { cleared: 40, stars: 3, tours: ALL_TOURS, meta: { treasures: tr } }, mapSeen(before, all));
    await sleep(2500);
    await G.shot(page, 13, 'final-son-dugum', { kind: 'final', title: 'Son bölüm geçildi', caption: '40. bölüm «Gürültü Canavarı» yenildikten sonra haritaya dönüş: son düğüm üç yıldızla parlar.' }, { wait: 0 });
    for (let i = 0; i < 40 && !(await page.locator('.cel-cta button').count()); i++) await sleep(500);
    await sleep(1800);
    await G.shot(page, 14, 'final-hazine', { kind: 'final', title: 'Son hazine: Ninni Tacı', caption: 'Bölüm 40 hazinesi açılır: içinden Ninni Tacı şapkası ve jeton çıkar. Hazinelerin içeriği haritada önceden görünür, şans yoktur.' }, { wait: 0 });
    await page.locator('.cel-cta button').first().click().catch(() => undefined);
    for (let i = 0; i < 40 && !(await page.locator('.cel-cta button').count()); i++) await sleep(500);
    await sleep(2000);
    await G.shot(page, 15, 'final-korteks-canlandi', { kind: 'final', title: 'İşitme Korteksi yeniden canlandı!', caption: 'Son bölge de canlanır: haritanın bütün bölgeleri artık renkli.' }, { wait: 0 });
    await page.locator('.cel-cta button').first().click().catch(() => undefined);
    for (let i = 0; i < 60 && !(await page.locator('.toast-top', { hasText: 'Ninni beyne' }).count()); i++) { await sleep(400); if (i % 3 === 0) await page.screenshot({ path: resolve(ADAY, `final-bekle-${pad2(i)}.png`) }); }
    await sleep(900);
    await G.shot(page, 16, 'final-ninni-beyne-ulasti', { kind: 'final', title: 'Final: Ninni Merkezi\'ne yükseliş', caption: 'Yolculuğun sonu: harita Ninni Merkezi\'ne yükselir, merkez ışıl ışıl yanar; sıradaki hedef satırı "Ninni beyne ulaştı!" der.' }, { wait: 0, keepToasts: true });
    await sleep(2500);
    await G.shot(page, 17, 'final-ninni-merkezi', { kind: 'final', title: 'Ninni Merkezi ışıl ışıl', caption: 'Final sonrası harita: Odi Ninni Merkezi\'nde, sıradaki hedef satırında "Ninni beyne ulaştı!" yazar.' });
    await ctx.close();
  });
}

// ================================================================ D · kamp
const REGIONS = ['dis-kulak', 'kanal', 'zar', 'kemikcikler', 'koklea-1', 'koklea-2', 'koklea-3', 'sinir', 'beyin-sapi', 'korteks'];
/** haritada ulaşılan bölgeler (Kulak Sözlüğü ile aynı kural: geçilen bölümler + sıradaki bölümün bölgesi) */
const regionsAt = (cleared) => { const b = new Set(DATA.levels.slice(0, Math.min(40, cleared + 1)).map((l) => l.biome)); return REGIONS.filter((r) => b.has(r)); };
const BNAME = { merkez: 'Odyoloji Merkezi', laboratuvar: 'Odyometri Odası', atolye: 'İşitme Cihazı Atölyesi', depo: 'Kulak Deposu', kule: 'Timpanometri Kulesi', revir: 'Odyoloji Kliniği', tedavi: 'Tedavi Odası' };
const BIDS = Object.keys(BNAME);
let campN = 0;
/** kamplı oyuncu: kayıt (cleared), anıtlar görülmüş, sunucuda bina seviyeleri ve cüzdan tohumlanır */
async function campPlayer(S, { cleared, levels = null, seenRegions = null, jeton = 6000, kristal = 400, name = null }) {
  const nm = name ?? `Kampçı${++campN}`;
  const { ctx, page } = await newPage({ seed: save({ cleared, tours: ALL_TOURS }), ls: { 'odi.kamp.anitlar': seenRegions ?? regionsAt(cleared) } });
  await page.goto(url(S.url), { waitUntil: 'load' });
  await page.getByRole('button', { name: /Devam et|Yola çık/ }).click({ timeout: 45_000 });
  await page.locator('nav.tabbar').waitFor({ timeout: 20_000 }); await nickname(page, nm); await settle(page);
  let pid = null; for (let i = 0; i < 40 && !(pid = S.pid(nm)); i++) await sleep(250);
  if (!pid) throw new Error(`oyuncu yok: ${nm}`);
  if (levels) for (const [b, l] of Object.entries(levels)) S.db.run('UPDATE buildings SET level = ?, upgrading_to = NULL, started_at = NULL, ends_at = NULL WHERE player_id = ? AND id = ?', l, pid, b);
  S.db.run('UPDATE players SET jeton = ?, kristal = ? WHERE id = ?', jeton, kristal, pid); S.srv.app.walletChanged(pid);
  // tohumlanan seviyeler "yükseltme kutlaması" olarak oynamasın: sayfayı yeniden aç, kuyruğu boşalt
  await page.reload({ waitUntil: 'load' }); await page.getByRole('button', { name: /Devam et|Yola çık/ }).click({ timeout: 45_000 });
  await page.locator('nav.tabbar').waitFor({ timeout: 20_000 }); await sleep(1500); await settle(page);
  return { ctx, page, pid, name: nm };
}
const campReady = async (page) => { await page.locator('.camp-base').waitFor({ timeout: 25_000 }); await page.waitForFunction(() => !!window.__kamp && !!window.__kamp.pos('merkez'), null, { timeout: 25_000 }); await page.locator('.camp-loading').waitFor({ state: 'detached', timeout: 25_000 }).catch(() => undefined); };
async function openCamp(page) {
  await tab(page, 'map'); await sleep(400); await tab(page, 'camp'); await sleep(600);
  const ub = page.getByRole('button', { name: 'Üs görünümü' }); if (await ub.count()) await ub.click();
  await campReady(page); await sleep(2500); await settle(page);
}
async function openPanel(page, id) {
  for (let i = 0; i < 4; i++) {
    await page.evaluate((b) => window.__kamp.focus?.(b), id); await sleep(1200);
    const sr = page.locator('.sr-only button', { hasText: BNAME[id] });
    if (i % 2 === 0 && await sr.count()) await sr.first().evaluate((el) => el.click());
    else { const p = await page.evaluate((b) => window.__kamp.pos(b), id); if (p) await page.touchscreen.tap(p.x, p.y + 10); }
    if (await page.locator('.bp').waitFor({ timeout: 4000 }).then(() => true, () => false)) { await sleep(900); return; }
  }
  throw new Error(`panel açılmadı: ${id}`);
}
const closePanel = async (page) => { if (await page.locator('.bp-x').count()) await page.locator('.bp-x').click().catch(() => undefined); await page.locator('.bp').waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined); await sleep(400); };
const lv = (m, o = {}) => Object.fromEntries(BIDS.map((b) => [b, o[b] ?? Math.min(15, m)]));
const CAMP_STEPS = [
  ['yeni', 3, null, 'Yeni kamp', 'Kamp ilk açıldığında: yalnız Odyoloji Merkezi kurulu, diğer altı binanın yeri hazır. Ön kıyıda Dış Kulak anıtı yükselmiş, diğer bölgelerin kaideleri kesik çizgili hayalet çerçeveyle bekliyor.'],
  ['sv3', 8, lv(3, { atolye: 2, kule: 2, revir: 2, tedavi: 2 }), 'Kamp · Sv 3', 'Merkez Sv 3: yedi binanın hepsi kurulmuş, kamp büyümeye başlamış. Haritada ulaşılan Dış Kulak, Kanal ve Kulak Zarı\'nın anıtları kıyıda.'],
  ['sv7', 16, lv(7, { atolye: 5, kule: 6, revir: 5 }), 'Kamp · Sv 7', 'Merkez Sv 7: binalar büyüyüp ayrıntılanır; Kulak Yolu\'nda kemikçiklere kadar anıtlar yükselmiş.'],
  ['sv10', 26, lv(10, { atolye: 9, kule: 8 }), 'Kamp · Sv 10', 'Merkez Sv 10: kokleanın üç kıvrımına ait anıtlar (Koklea Sarmalı, Tüy Hücresi Demeti) kıyıda yerini almış.'],
  ['sv15', 40, lv(15), 'Kamp · Sv 15 (en üst)', 'Bütün binalar en üst seviyede ve on bölgenin on anıtı Kulak Yolu boyunca dizili: kulak kepçesinden Heschl Işığı\'na kadar.'],
];
async function sectionKamp() {
  const S = await server('normal');
  let nn = 1;
  for (const [id, cleared, levels, title, caption] of CAMP_STEPS) {
    const n0 = nn; nn += 10;
    await group(`kamp-${id}`, 'kamp', async (G) => {
      const { ctx, page } = await campPlayer(S, { cleared, levels });
      await openCamp(page);
      await G.shot(page, n0, `kamp-${id}`, { kind: 'kamp', title, caption });
      if (id === 'sv3' || id === 'sv15') {
        let k = 1;
        for (const b of BIDS) {
          await openPanel(page, b);
          const lvl = levels[b];
          await G.shot(page, n0 + k++, `panel-${b}-${id}`, { kind: 'kamp-panel', title: `${BNAME[b]} · Sv ${lvl}`, caption: id === 'sv3'
            ? `${BNAME[b]} paneli (düşük seviye): oyun etkisi, "Odyolojide" kutusunda binanın gerçek odyolojik karşılığı ve kaynağı, bu seviyede ve sonraki seviyelerde açılanlar.`
            : `${BNAME[b]} en üst seviyede (Sv 15): etkisi en yüksek, açılımların hepsi alınmış.` });
          await closePanel(page);
        }
      }
      if (id === 'sv7') {
        await page.getByRole('button', { name: 'Liste görünümü' }).evaluate((el) => el.click()); await sleep(1200);
        await G.shot(page, n0 + 1, 'liste-gorunumu', { kind: 'kamp', title: 'Kamp: liste görünümü', caption: 'Erişilebilir liste görünümü: yedi bina, seviyeleri, etkileri, yükseltme maliyeti ve süresi, depo ve Tedavi Odası üretimi tek listede.' });
        await page.getByRole('button', { name: 'Üs görünümü' }).click().catch(() => undefined);
      }
      await ctx.close();
    });
  }
  // ---- Tedavi Odası: tarif seç → hazırla → raf dolar → topla → çanta → bölüm kartında çanta
  await group('kamp-tedavi', 'kamp', async (G) => {
    const { ctx, page, pid } = await campPlayer(S, { cleared: 26, levels: lv(10, { atolye: 9, kule: 8 }) });
    await openCamp(page);
    await openPanel(page, 'tedavi');
    await G.shot(page, 60, 'tedavi-paneli', { kind: 'tedavi', title: 'Tedavi Odası: tarifler', caption: 'Tedavi Odası Sv 10: kulak tıkacından ses üretecine kadar açık tarifler; her malzemenin hangi kulak hastalığı engelini bir kez etkisiz kıldığı ve hazırlama süresi yazar. Kilitli tarifler hangi seviyede açılacağını söyler.' });
    await page.locator('[data-recipe="ventilasyon-tupu"]').click(); await sleep(600);
    await page.locator('.tp-info').scrollIntoViewIfNeeded().catch(() => undefined); await sleep(400);
    await G.shot(page, 61, 'tedavi-tarif-bilgi', { kind: 'tedavi', title: 'Tarif: Ventilasyon tüpü', caption: 'Tarife dokununca sade açıklama, "Daha fazla" ile teknik bilgi ve kaynak açılır; kartlarda "tıbbi öneri değildir" dürüstlük notu durur.' });
    await page.locator('.tp-info').getByRole('button', { name: 'Bunu hazırla' }).click().catch(() => undefined);
    await page.locator('[data-making="ventilasyon-tupu"]').waitFor({ timeout: 8000 }).catch(() => undefined); await sleep(700);
    await page.locator('.bp').evaluate((el) => el.scrollTo?.(0, 0)).catch(() => undefined); await sleep(300);
    await G.shot(page, 62, 'tedavi-hazirlaniyor', { kind: 'tedavi', title: 'Hazırlanıyor', caption: 'Seçilen tarif sürekli hazırlanır: bir adetin süresi seviyeyle kısalır, raf dolunca üretim durur ve "Topla" ister.' });
    await closePanel(page);
    S.db.run('UPDATE remedy_prod SET since = since - ? WHERE player_id = ?', 6 * 3_600_000, pid);
    await openCamp(page);
    await G.shot(page, 63, 'tedavi-raf-dolu', { kind: 'tedavi', title: 'Raf doldu', caption: 'Raf dolunca Tedavi Odası\'nın üstünde baloncuk belirir: hazır malzemeler toplanmayı bekliyor.' });
    await openPanel(page, 'tedavi');
    await page.locator('.tp-shelf').getByRole('button', { name: 'Topla' }).click().catch(() => undefined); await sleep(1500);
    await G.shot(page, 64, 'tedavi-canta', { kind: 'tedavi', title: 'Çanta', caption: 'Toplanan malzemeler çantaya girer (her malzemeden en çok 9). Çanta yeri 2\'den başlar; Tedavi Odası Sv 6 ve Merkez Sv 12 birer yer ekler.' });
    await closePanel(page);
    await tab(page, 'map'); await page.waitForFunction(() => !!window.__harita, null, { timeout: 20_000 }); await sleep(1500);
    await page.evaluate(() => window.__harita.card(21)); await page.locator('[data-testid="canta"]').waitFor({ timeout: 8000 });
    await page.locator('[data-testid="canta"] .bag-row').click().catch(() => undefined); await sleep(600);
    for (let i = 0; i < 2; i++) { await page.getByRole('button', { name: 'Ventilasyon tüpü ekle' }).click().catch(() => undefined); await sleep(400); }
    await sleep(700); await page.locator('[data-testid="canta"]').scrollIntoViewIfNeeded().catch(() => undefined);
    await G.shot(page, 65, 'bolum-karti-canta', { kind: 'tedavi', title: 'Bölüm kartında çanta', caption: 'Bölüm kartında "Bu bölgede işe yarayabilir" ipucu ve çanta: oyuncu malzemeyi bölüme götürür; yalnız kullanılan adet düşer.' });
    await ctx.close();
  });
  // ---- açılım anı: Odyometri Odası Sv 2 → 3 (Sözlük terimi, Dolap: Sol Kulak Mavisi) + Tüy Dede
  await group('kamp-acilim', 'kamp', async (G) => {
    const { ctx, page } = await campPlayer(S, { cleared: 9, levels: { merkez: 3, laboratuvar: 2, depo: 1, tedavi: 1 }, kristal: 2000, jeton: 50000 });
    await openCamp(page);
    await openPanel(page, 'laboratuvar');
    await G.shot(page, 70, 'odyometri-sv3-acar', { kind: 'kamp-panel', title: 'Odyometri Odası: "Sv 3 açar"', caption: 'Panel bir sonraki seviyenin ne açacağını önceden söyler: Odyometri Odası Sv 3 → Dolap\'a Sol Kulak Mavisi (odyogramda sol kulak mavi çarpıyla işaretlenir).' });
    await page.locator('.bp').getByRole('button', { name: /^(Kur|Yükselt)/ }).click(); await page.locator('.bp-build').waitFor({ timeout: 8000 }); await sleep(700);
    await G.shot(page, 71, 'insaat-basladi', { kind: 'kamp-panel', title: 'Yükseltme sürüyor', caption: 'İnşaat başlar: kalan süre, takımdan yardım isteme, hızlandırıcılar ve kristalle bitirme seçenekleri.' });
    await page.locator('.bp').getByRole('button', { name: /ile bitir/ }).click(); await closePanel(page);
    let cel = false; for (let i = 0; i < 30 && !(cel = !!(await page.locator('.cel-root.on').count())); i++) await sleep(300);
    if (cel) { await sleep(1800); await G.shot(page, 72, 'yukseltme-kutlamasi', { kind: 'kamp', title: 'Yükseltme kutlaması', caption: 'Bina seviye atlayınca kutlama afişinde o seviyenin açtıkları yazar: Odyometri Odası Sv 3 → bölüm jetonu +%9 ve Dolap\'a Sol Kulak Mavisi.' }, { wait: 0 }); }
    await settle(page);
    const dede = page.locator('[data-testid="kamp-dede"]');
    if (await dede.waitFor({ timeout: 8000 }).then(() => true, () => false)) { await sleep(1200); await G.shot(page, 73, 'tuy-dede-kamp-satiri', { kind: 'kamp', title: 'Tüy Dede kampta', caption: 'Kamp ekranının altındaki kartta Tüy Dede, yükseltilen binanın gerçek odyolojik işlevini bir cümleyle anlatır.' }); }
    await tab(page, 'profile'); await page.locator('[data-tile="wardrobe"]').click();
    const tile = page.getByRole('button', { name: 'Sol Kulak Mavisi', exact: true }); await tile.waitFor({ timeout: 10_000 }).catch(() => undefined);
    await tile.scrollIntoViewIfNeeded().catch(() => undefined); await sleep(700);
    await G.shot(page, 74, 'dolap-sol-kulak-mavisi', { kind: 'acilim', title: 'Dolap: Sol Kulak Mavisi', caption: 'Kamp açılımı Dolap\'ta: Odyometri Odası Sv 3 ile gelen Sol Kulak Mavisi rengi. Kilitli kozmetiklerde hangi binanın hangi seviyesinde açılacağı yazar.' });
    await page.getByRole('button', { name: 'Geri' }).first().click(); await page.locator('[data-tile="glossary"]').click();
    const term = page.locator('[data-region="kamp"] [data-term="saf-ses-odyometrisi"]'); await term.waitFor({ timeout: 10_000 }).catch(() => undefined);
    await term.scrollIntoViewIfNeeded().catch(() => undefined); await sleep(700);
    await G.shot(page, 75, 'sozluk-kamp-terimi', { kind: 'acilim', title: 'Sözlük: Kulak Kampı terimleri', caption: 'Kamp binaları Kulak Sözlüğü\'ne terim açar: Odyometri Odası Sv 2 ile "Saf ses odyometrisi". Kilitli terimler hangi binanın kaçıncı seviyesinde açılacağını gösterir.' });
    await ctx.close();
  });
  // ---- anıt yükselişi: 12 bölüm geçilmiş, Kemikçikler anıtı ilk kez
  await group('kamp-anit', 'kamp', async (G) => {
    const { ctx, page } = await campPlayer(S, { cleared: 12, levels: lv(4), seenRegions: ['dis-kulak', 'kanal', 'zar'] });
    await tab(page, 'camp'); await campReady(page);
    await frames(page, 'anit', 8, 700);
    await page.locator('[data-testid="kamp-dede"][data-line="anit-kemikcikler"]').waitFor({ timeout: 30_000 }).catch(() => undefined);
    await sleep(600);
    await G.shot(page, 80, 'anit-yukseliyor', { kind: 'anit', title: 'Anıt yükseliyor: Üç Kemikçik', caption: 'Haritada yeni bir bölgeye ulaşınca kampın Kulak Yolu\'nda o bölgenin anıtı topraktan yükselir: toz, ışık, konfeti; Tüy Dede anıtı tanıtır.' }, { wait: 0 });
    await sleep(2500); await toastGone(page);
    const zp = await page.evaluate(() => window.__kamp.monument('zar'));
    if (zp) { await page.touchscreen.tap(zp.x, zp.y); await sleep(1500); }
    await G.shot(page, 81, 'anit-bilgi', { kind: 'anit', title: 'Anıta dokun: Kulak Zarı Davulu', caption: 'Anıta dokununca sessiz bir bilgi kartı açılır: anıtın adı, bölgesi ve kısa bilgi.' });
    await ctx.close();
  });
}

// ================================================================ E · etkinlikler (+ ortak oyuncu yardımcıları)
const net = (p, op, data = {}) => p.page.evaluate(([o, d]) => window.__etkinlik.net().call(o, d), [op, data]);
const tid = (p, id) => p.page.getByTestId(id);
const runOf = (level, over = {}) => ({ runId: `tan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, level, completed: true, stars: 3, score: 1500 + level * 40, timeSec: 60, coins: 80, biome: LV(level).biome, mechanic: LV(level).mechanic, ...over });
async function climb(p, from, to, over = {}) { for (let l = from; l <= to; l++) await net(p, 'progress.submit', runOf(l, over)); }
const syncTeam = (p) => p.page.evaluate(async () => { const e = window.__etkinlik; const t = await e.net().call('team.detail', {}); e.netStore.setState({ team: t.team }); });
/** sunucuya bağlı tarayıcı oyuncusu (kayıt: cleared bölüm, bütün turlar görülmüş); q: ek adres parametreleri */
async function netPlayer(S, name, { cleared = 12, q = '', color = null, knowledge = null } = {}) {
  const { ctx, page } = await newPage({ seed: save({ cleared, tours: ALL_TOURS, extra: { ...(color ? { odiColor: color, chosenColor: color } : {}), ...(knowledge ? { knowledge } : {}) } }) });
  const p = { name, ctx, page };
  await page.goto(url(S.url, q), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__etkinlik?.net()?.status === 'bağlı', null, { timeout: 25_000 });
  await net(p, 'profile.update', { name, ...(color ? { color } : {}) }).catch(() => undefined);
  await page.getByRole('button', { name: /Yola çık|Devam et/ }).click();
  await page.locator('nav.tabbar').waitFor({ timeout: 20_000 }); await settle(page);
  if (await page.locator('.onboard').count()) { await page.getByRole('textbox', { name: 'Takma ad' }).fill(name).catch(() => undefined); await page.getByRole('button', { name: 'Başla' }).click().catch(() => undefined); }
  await tab(page, 'profile');
  return p;
}
async function toTab(p, id) { for (let i = 0; i < 8 && !(await p.page.locator('nav.tabbar').count()); i++) { await p.page.locator('button[aria-label="Geri"]').first().click().catch(() => undefined); await sleep(350); } await closeBanners(p.page); await tab(p.page, id); await sleep(500); }
async function openEvents(p, view) {
  await p.page.evaluate(() => document.getElementById('root')?.scrollTo(0, 0));
  if (await tid(p, 'etkinlikler').count()) { if (view) { const back = p.page.locator('.ev-head button[aria-label="Geri"]'); if (await back.count()) await back.click(); } }
  else { await toTab(p, 'map'); await tid(p, 'ev-fab').click({ timeout: 20_000 }); }
  await tid(p, 'etkinlikler').waitFor();
  if (view) { await tid(p, `ev-kart-${view}`).locator('.ev-band').click(); await p.page.locator(`[data-testid="etkinlikler"][data-view="${view}"]`).waitFor(); }
  await sleep(700);
}
async function waitEventLevel(p, ms = 200_000) {
  await p.page.waitForFunction(() => window.__odi?.events?.some((e) => e.type === 'started'), null, { timeout: 40_000 });
  await p.page.waitForFunction(() => !!document.querySelector('[data-testid="ev-flash"]') || !!document.querySelector('[data-testid="etkinlikler"]'), null, { timeout: ms });
}
async function teamSub(p, label) { await toTab(p, 'team'); await p.page.locator('.team-head').waitFor({ timeout: 15_000 }); await p.page.locator('.subtabs .subtab', { hasText: label }).first().click(); await sleep(900); }
const step = async (name, fn) => { try { await fn(); } catch (e) { warn(`${name}: ${String(e?.message ?? e).split('\n')[0]}`); await lastPage?.screenshot({ path: resolve(OUT, `hata-${name}.png`) }).catch(() => undefined); } };

async function sectionEtkinlik() {
  const S = await server('normal');
  await group('etkinlik', 'etkinlik', async (G) => {
    const q = 'etkinlik-bot=1';
    const A = await netPlayer(S, 'Ayşe', { cleared: 14, q, color: 0xff4f7a }); const B = await netPlayer(S, 'Bora', { cleared: 12, q, color: 0x2ec4b6 }); const C = await netPlayer(S, 'Cem', { cleared: 10, q, color: 0xffb347 });
    const tA = (await net(A, 'team.create', { name: 'Koklea Kartalları', emblem: '🦅', description: 'Her gün biraz, hep birlikte.' })).team;
    await net(B, 'team.join', { teamId: tA.id }); await net(C, 'team.create', { name: 'Bas Baykuşları', emblem: '🦉', description: 'Alçak frekansların ustaları.' });
    for (const p of [A, B, C]) await syncTeam(p);
    await step('baskin-once', async () => {
      await net(A, 'progress.submit', runOf(1, { coins: 60 }));
      await teamSub(A, 'Baskın'); await A.page.locator('.raid .qn').waitFor({ timeout: 10_000 }); await sleep(800);
      await G.shot(A.page, 90, 'baskin', { kind: 'etkinlik', title: 'Baskın: Gürültü Canavarı', caption: 'Cuma 20:00 – Cumartesi 20:00 arası takım baskını: ortak can çubuğu (400 + 120 × üye), üyelerin bölüm hasarlarıyla canlı düşer.' });
    });
    await climb(A, 2, 14, { coins: 60 }); await climb(B, 1, 12, { coins: 60 }); await climb(C, 1, 10, { coins: 40 });
    for (const p of [A, B, C]) await p.page.evaluate(() => window.__etkinlik.net().call('events.overview', {}).then((r) => window.__etkinlik.events.setState({ ...r.overview, loaded: true, offset: r.overview.serverTime - Date.now() })));
    await step('merkez', async () => {
      await openEvents(A);
      await G.shot(A.page, 1, 'etkinlik-merkezi', { kind: 'etkinlik', title: 'Etkinlik merkezi', caption: 'Haritadaki çadırdan açılan etkinlik merkezi: o an süren takım ve bireysel etkinlikler, kalan süreleri ve ödülleriyle tek listede. Süreler ve ödüller sunucudan gelir.' });
      await A.page.evaluate(() => { const r = document.getElementById('root'); r?.scrollTo(0, r.scrollHeight); document.scrollingElement?.scrollTo(0, 99999); }); await sleep(700);
      await G.shot(A.page, 2, 'etkinlik-merkezi-alt', { kind: 'etkinlik', title: 'Etkinlik merkezi: bireysel etkinlikler', caption: 'Listenin devamı: Günün Meydan Okuması, Haftalık Turnuva ve diğer kartlar; her kartta durum ve kalan süre.' });
    });
    await step('duello', async () => {
      await openEvents(C, 'duello');
      await C.page.locator('[data-testid="duello"][data-status="eslesti"]').waitFor({ timeout: 15_000 });
      await net(A, 'progress.submit', runOf(14, { stars: 3 })); await net(C, 'progress.submit', runOf(10, { stars: 2 }));
      await sleep(1500);
      await G.shot(C.page, 10, 'duello-eslesme', { kind: 'etkinlik', title: 'Takım Düellosu: eşleşme', caption: 'Takım Düellosu güce en yakın gerçek takımla eşleştirir; yıldız, ralli ve bayrak puanları canlı skor çubuğuna yazılır.' });
    });
    await step('ralli', async () => {
      await openEvents(A, 'ralli'); await tid(A, 'ralli-secim').waitFor();
      await G.shot(A.page, 20, 'ralli-canavar-secimi', { kind: 'etkinlik', title: 'Ralli: canavar seçimi', caption: 'Bir üye mini canavara ralli başlatır; 10 dakika içinde en az iki üye katılıp ralli bölümünü oynamalı.' });
      await A.page.locator('[data-testid^="ralli-baslat-"]').first().click(); await tid(A, 'ralli-oda').waitFor();
      await tid(B, 'ev-bildirim').waitFor({ timeout: 12_000 });
      await G.shot(B.page, 21, 'ralli-bildirimi', { kind: 'etkinlik', title: 'Ralli bildirimi', caption: 'Takım arkadaşlarına "Ayşe ralli başlattı!" bildirimi düşer; tek dokunuşla ralliye katılınır.' });
      await openEvents(B, 'ralli'); await tid(B, 'ralli-katil').click(); await tid(B, 'ralli-saldir').waitFor(); await tid(A, 'ralli-saldir').waitFor(); await sleep(800);
      await G.shot(A.page, 22, 'ralli-odasi', { kind: 'etkinlik', title: 'Ralli odası', caption: 'Ralli odası: canavarın canı, katılan üyeler ve saldırı düğmesi. Her üyenin bölüm sonucu canavarın canını düşürür.' });
      for (let round = 0; round < 3; round++) {
        if (await A.page.evaluate(() => window.__etkinlik.events.getState().rally?.status) === 'kazanildi') break;
        const act = []; for (const p of [A, B]) if (await tid(p, 'ralli-saldir').isEnabled().catch(() => false)) { await tid(p, 'ralli-saldir').click(); act.push(p); }
        if (round === 0) { await sleep(7000); await G.shot(B.page, 23, 'ralli-bolumu', { kind: 'etkinlik', title: 'Ralli bölümü', caption: 'Ralli bölümü gerçek bir bölümdür: canavarın canı üstte, Odi koşarken topladığı her nota hasara dönüşür.' }, { wait: 0 }); }
        for (const p of act) await waitEventLevel(p);
        await sleep(1500);
      }
      await A.page.locator('[data-testid="ralli-oda"][data-status="kazanildi"]').waitFor({ timeout: 20_000 }); await sleep(1500);
      await G.shot(A.page, 24, 'ralli-kazanildi', { kind: 'etkinlik', title: 'Ralli kazanıldı', caption: 'Can sıfırlanınca ralli kazanılır: katılan herkese ödül kutusuna ödül, takıma XP ve düello puanı.' }, { wait: 0 });
      await settle(A.page); await settle(B.page);
    });
    await step('quiz', async () => {
      await openEvents(A, 'quiz'); await sleep(500);
      await G.shot(A.page, 30, 'bilgi-yarismasi', { kind: 'etkinlik', title: 'Kulak Bilgi Yarışması', caption: 'Her gün 13:00 ve 20:00\'de (lider/yardımcı da başlatabilir) canlı bilgi yarışması: 10 soru, her biri 15 saniye, takım ortalaması günlük sıralamaya yazılır.' });
      await tid(A, 'quiz-baslat').click(); await A.page.locator('[data-testid="quiz"][data-phase="lobi"]').waitFor();
      await tid(B, 'ev-bildirim').filter({ hasText: 'Bilgi yarışması' }).waitFor({ timeout: 12_000 }); await tid(B, 'ev-bildirim').filter({ hasText: 'Bilgi yarışması' }).locator('.ev-notice-main').click();
      await tid(B, 'quiz-katil').click(); await sleep(800);
      await G.shot(B.page, 31, 'bilgi-yarismasi-lobi', { kind: 'etkinlik', title: 'Bilgi yarışması: lobi', caption: 'Takım üyeleri lobide toplanır; yarışma herkese aynı anda başlar.' });
      await tid(A, 'quiz-hemen').click();
      for (let i = 0; i < 2; i++) {
        for (const p of [A, B]) await p.page.locator(`[data-testid="quiz"][data-phase="soru"][data-index="${i}"]`).waitFor({ timeout: 40_000 });
        if (i === 0) { await sleep(1200); await G.shot(A.page, 32, 'bilgi-yarismasi-soru', { kind: 'etkinlik', title: 'Bilgi yarışması: soru', caption: 'Soru ve dört şık, geri sayım çubuğuyla. Şık seçildikten sonra kilitlenir; kaç kişinin cevapladığı canlı görünür.' }); }
        await Promise.all([tid(A, 'quiz-secenek-0').click(), tid(B, 'quiz-secenek-1').click()]);
        await B.page.locator(`[data-testid="quiz"][data-phase="cevap"][data-index="${i}"]`).waitFor({ timeout: 30_000 });
        if (i === 0) { await sleep(900); await G.shot(B.page, 33, 'bilgi-yarismasi-aciklama', { kind: 'etkinlik', title: 'Cevap ve açıklama', caption: 'Süre dolunca doğru şık ve kısa bir açıklama herkese aynı anda gösterilir: yarışma oynarken öğretir.' }); }
      }
    });
    await step('bayrak', async () => {
      await openEvents(A, 'bayrak'); await sleep(400);
      await G.shot(A.page, 40, 'bayrak-yarisi', { kind: 'etkinlik', title: 'Bayrak Yarışı', caption: 'Haftalık Bayrak Yarışı: dört ayaklı parkur. Bayrağı alan üye kendi ayağını koşar, sonra bir takım arkadaşına devreder.' });
      await tid(A, 'bayrak-al').click(); await tid(A, 'bayrak-kos').click(); await waitEventLevel(A);
      await A.page.locator('[data-testid="bayrak"][data-current="1"]').waitFor({ timeout: 15_000 }); await sleep(800);
      await G.shot(A.page, 41, 'bayrak-ayak-bitti', { kind: 'etkinlik', title: 'Bayrak: ilk ayak bitti', caption: 'İlk ayak bitti: ayak süresi parkura yazılır, en iyi ayak sürelerinin toplamı takım sıralamasına girer.' });
      await tid(A, 'bayrak-devret').click(); await tid(A, 'bayrak-devret-Bora').click();
      await tid(B, 'ev-bildirim').filter({ hasText: 'Bayrak sende' }).waitFor({ timeout: 12_000 }); await sleep(500);
      await G.shot(B.page, 42, 'bayrak-sende', { kind: 'etkinlik', title: '"Bayrak sende!"', caption: 'Bayrak devredilen üyeye bildirim gelir; bir dokunuşla kendi ayağını koşmaya başlar.' });
      await tid(B, 'ev-bildirim').filter({ hasText: 'Bayrak sende' }).locator('.ev-notice-main').click(); await sleep(300);
    });
    await step('duello-skor', async () => {
      await openEvents(A, 'duello'); await sleep(800);
      await G.shot(A.page, 11, 'duello-skor', { kind: 'etkinlik', title: 'Düello: canlı skor', caption: 'Düello skor çubuğu canlı: yıldızlar, kazanılan ralli ve koşulan bayrak ayakları takım puanına eklenir. Son 2 saatte bildirim gelir.' });
    });
    await step('meydan', async () => {
      for (const p of [A, C]) { await openEvents(p, 'meydan'); if (p === A) await G.shot(A.page, 50, 'gunun-meydan-okumasi', { kind: 'etkinlik', title: 'Günün Meydan Okuması', caption: 'Herkese aynı bölüm, eşit şartlar ve üç deneme hakkı; genel ve arkadaş sıralaması.' }); await tid(p, 'meydan-oyna').click(); await waitEventLevel(p); }
      await openEvents(A, 'meydan'); await A.page.locator('[data-testid="siralama"] li').nth(1).waitFor({ timeout: 15_000 }).catch(() => undefined); await settle(A.page); await sleep(500);
      await G.shot(A.page, 51, 'meydan-okumasi-siralama', { kind: 'etkinlik', title: 'Meydan okuma sıralaması', caption: 'Oynayan gerçek oyuncuların skor sıralaması; kalan deneme hakkı ve kendi sırası.' });
    });
    await step('gorev-avi-turnuva', async () => {
      await net(B, 'progress.submit', runOf(12, { coins: 180 }));
      await openEvents(A, 'gorev'); await tid(A, 'takim-gorevleri').waitFor();
      await G.shot(A.page, 60, 'gunluk-takim-gorevleri', { kind: 'etkinlik', title: 'Günlük Takım Görevleri', caption: 'Her gün üç ortak görev: her biri tamamlanınca bütün üyelere hediye, üçü birden ortak sandığı açar.' });
    });
    await step('turnuva', async () => {
      await openEvents(C, 'turnuva'); await tid(C, 'turnuva').waitFor();
      await G.shot(C.page, 70, 'haftalik-turnuva', { kind: 'etkinlik', title: 'Haftalık Turnuva', caption: 'Beş bölümde en iyi skorların toplamı; 50 kişilik gruplarda haftalık sıralama.' });
    });
    await step('takim-sekmesi', async () => {
      await teamSub(B, 'Etkinlikler'); await tid(B, 'takim-etkinlikler').waitFor({ timeout: 8000 }).catch(() => undefined);
      await G.shot(B.page, 3, 'takim-etkinlik-sekmesi', { kind: 'etkinlik', title: 'Takım › Etkinlikler', caption: 'Takım sekmesindeki etkinlik özeti: süren ralli, düello durumu, bayrak ve takım görevleri bir bakışta.' });
    });
    await step('savas', async () => {
      await teamSub(A, 'Savaş'); await A.page.locator('.war-map').waitFor({ timeout: 10_000 });
      await A.page.getByRole('button', { name: /Hedefleri düzenle/ }).click(); await A.page.locator('.region', { hasText: 'Kepçesi' }).first().click(); await A.page.locator('.region', { hasText: 'Ninni Merkezi' }).first().click();
      await A.page.getByRole('button', { name: 'Kaydet' }).click(); await sleep(800);
      for (let i = 0; i < 4; i++) await net(B, 'progress.submit', runOf(1 + i, { coins: 60 }));
      await sleep(1500);
      await G.shot(A.page, 80, 'bolge-savasi', { kind: 'etkinlik', title: 'Bölge Savaşı haritası', caption: 'Haftalık Bölge Savaşı: lider en çok üç hedef bölge seçer; üyelerin bölüm puanı biyomu eşleşen hedefe yazılır, en yüksek puanlı takım bölgeyi alır.' });
    });
    await step('baskin', async () => {
      await teamSub(A, 'Baskın'); await A.page.locator('.raid .qn').waitFor({ timeout: 10_000 });
      for (let i = 0; i < 70 && !(await A.page.locator('.raid').filter({ hasText: /Yenildi/ }).count()); i++) await net([A, B][i % 2], 'progress.submit', runOf(1 + (i % 12), { coins: 80 })).catch(() => null);
      await sleep(2000); await settle(A.page);
      await G.shot(A.page, 91, 'baskin-sonu', { kind: 'etkinlik', title: 'Baskın: canavar yenildi', caption: 'Ortak can sıfırlanınca canavar yenilir: bütün üyelere hediye (30 kristal + 200 jeton); takımlar yenme süresine göre sıralanır.' });
    });
    await step('quiz-sonuc', async () => {
      await openEvents(B, 'quiz'); await B.page.locator('[data-testid="quiz"][data-phase="bitti"]').waitFor({ timeout: 300_000 }); await sleep(800);
      await G.shot(B.page, 34, 'bilgi-yarismasi-sonuc', { kind: 'etkinlik', title: 'Bilgi yarışması sonucu', caption: 'Yarışma bitince takım ortalaması ve günün takım sıralaması.' });
    });
    for (const p of [A, B, C]) await p.ctx.close();
  });
  // Ses Avı 3 günlük dönemlerle açılır (Pzt–Per, Cum–Pzt): dönem dışında kalmamak için hızlı test sunucusunda (ODI_EVENTS_FAST)
  await group('etkinlik-avi', 'etkinlik', async (G) => {
    const H = await server('hizli');
    const A = await netPlayer(H, 'Ayşe', { cleared: 14, q: 'etkinlik-bot=1', color: 0xff4f7a }); const B = await netPlayer(H, 'Bora', { cleared: 12, q: 'etkinlik-bot=1', color: 0x2ec4b6 });
    const t = (await net(A, 'team.create', { name: 'Koklea Kartalları', emblem: '🦅' })).team; await net(B, 'team.join', { teamId: t.id }); for (const p of [A, B]) await syncTeam(p);
    await climb(A, 1, 9, { coins: 90 }); await climb(B, 1, 7, { coins: 90 });
    for (const p of [A, B]) await p.page.evaluate(() => window.__etkinlik.net().call('events.overview', {}).then((r) => window.__etkinlik.events.setState({ ...r.overview, loaded: true, offset: r.overview.serverTime - Date.now() })));
    await openEvents(A, 'avi'); await tid(A, 'ses-avi').waitFor(); await sleep(800);
    await G.shot(A.page, 61, 'ses-avi', { kind: 'etkinlik', title: 'Ses Avı', caption: 'Üç günlük Ses Avı: bölümlerde toplanan notalar ortak melodiye eklenir; 8 kademe hediyesi, %100\'de takım şarkısı ve sandık.' });
    for (const p of [A, B]) await p.ctx.close();
  });
}


// ================================================================ F · birlikte oynamak
/** tarayıcısız gerçek oyuncu (sunucuya doğrudan WebSocket) */
function rawClient(wsUrl) {
  const ws = new WebSocket(wsUrl); let id = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.t === 'res') { const p = pend.get(m.id); pend.delete(m.id); if (!p) return; if (m.ok) p.res(m.data); else p.rej(new Error(`${m.code}: ${m.error}`)); } };
  const ready = new Promise((r) => { ws.onopen = r; });
  const call = async (op, data = {}) => { await ready; return new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ t: 'req', id: i, op, data })); }); };
  return { call, close: () => ws.close() };
}
async function rawPlayer(wsUrl, name, levels, color) {
  const c = rawClient(wsUrl); await c.call('hello', { version: 1, name }); if (color) await c.call('profile.update', { name, color }).catch(() => undefined);
  for (let l = 1; l <= levels; l++) await c.call('progress.submit', runOf(l, { stars: l % 4 ? 3 : 2, coins: 90 }));
  return c;
}
async function teamChat(p) { await teamSub(p, 'Sohbet'); await p.page.locator('.chat-box').waitFor({ timeout: 10_000 }); await sleep(700); }
const scrollTo = async (p, sel) => { await p.page.locator(sel).last().scrollIntoViewIfNeeded().catch(() => undefined); await sleep(350); };

async function sectionSosyal() {
  const S = await server('hizli');
  await group('sosyal', 'sosyal', async (G) => {
    const A = await netPlayer(S, 'Ayşe', { cleared: 14, color: 0xff4f7a }); const B = await netPlayer(S, 'Bora', { cleared: 10, color: 0x2ec4b6 }); const C = await netPlayer(S, 'Cem', { cleared: 5, color: 0xffb347 });
    log('sosyal: oyuncular hazır');
    const team = (await net(A, 'team.create', { name: 'Koklea Kaşifleri', emblem: '🐚', description: 'Kulaktan beyne, hep birlikte.' })).team;
    await net(B, 'team.join', { code: team.code }); await net(C, 'team.join', { code: team.code });
    for (const p of [A, B, C]) await syncTeam(p);
    const code = (p) => p.page.evaluate(() => window.__etkinlik.net().me.friendCode);
    await net(A, 'friends.add', { code: await code(B) }); await net(B, 'friends.add', { code: await code(A) });
    await climb(A, 1, 14, { coins: 40 }); await climb(B, 1, 10, { coins: 30 }); await climb(C, 1, 5, { coins: 10 });
    // kayıttan eşitlenen bölümler akış kartı üretmez (yalnız ilk kez geçilenler): Ayşe yeni bölümler geçer
    log('sosyal: tırmanış');
    for (let l = 15; l <= 17; l++) { const r = await Promise.race([net(A, 'progress.submit', runOf(l, { coins: 40 })).then(() => 'tamam', (e) => `hata ${e.message}`), sleep(12_000).then(() => 'zaman aşımı')]); log(`sosyal: A bölüm ${l}: ${r}`); }
    await step('gunun-sorusu', async () => {
      await teamChat(A); const q0 = A.page.locator('[data-testid="gunun-sorusu"]').first(); await q0.waitFor({ timeout: 12_000 }); await scrollTo(A, '[data-testid="gunun-sorusu"]');
      await G.shot(A.page, 1, 'gunun-sorusu', { kind: 'sosyal', title: 'Günün Sorusu', caption: 'Tüy Dede her gün takım sohbetine bir kulak sorusu bırakır; herkese aynı soru. Açıklanana kadar yalnızca kaç kişinin cevapladığı görünür.' });
      await q0.locator('.dq-opt[data-choice="0"]').click(); await q0.locator('.dq-opt.picked').waitFor({ timeout: 8000 });
      await teamChat(B); await B.page.locator('[data-testid="gunun-sorusu"] .dq-opt[data-choice="1"]').first().click().catch(() => undefined);
    });
    await step('akis', async () => {
      await teamChat(B); log('akış kartları: ' + JSON.stringify(await B.page.locator('[data-testid="akis-karti"]').evaluateAll((els) => els.map((e) => `${e.className}|${e.textContent.slice(0, 50)}`))));
      const card = B.page.locator('[data-testid="akis-karti"]:not(.own)').filter({ hasText: 'Ayşe' }).last(); await card.waitFor({ state: 'attached', timeout: 15_000 });
      await card.scrollIntoViewIfNeeded().catch(() => undefined); await sleep(400);
      await G.shot(B.page, 10, 'takim-akisi-karti', { kind: 'sosyal', title: 'Takım Akışı kartı', caption: 'Gerçek olaylar takım sohbetine kart olarak düşer (ilk kez geçilen bölüm, boss, altın koklea, bina yükseltme, yeni üye…). Aynı oyuncunun 30 dakikadaki kartları birleşir; tek dokunuşla tepki ve "Tebrik et".' });
      await card.locator('[data-reaction="alkis"]').click(); await card.getByTestId('tebrik-et').click(); await sleep(1400);
      await teamChat(C); await C.page.locator('[data-testid="akis-karti"]:not(.own)').filter({ hasText: 'Ayşe' }).last().locator('[data-reaction="kalp"]').click({ timeout: 5000 }).catch(() => undefined);
      await teamChat(A); const aCard = A.page.locator('[data-testid="akis-karti"].own').last();
      await aCard.locator('.thread .th-text', { hasText: 'Tebrik' }).waitFor({ timeout: 8000 }).catch(() => undefined); await aCard.scrollIntoViewIfNeeded().catch(() => undefined); await sleep(400);
      await G.shot(A.page, 11, 'tepkiler-ve-tebrik', { kind: 'sosyal', title: 'Tepkiler ve tebrik', caption: 'Takım arkadaşlarının alkış ve kalp tepkileri kartın altında sayılır; "Tebrik et" hazır sözü kartın konusuna yanıt olarak yazılır.' });
      await aCard.getByRole('button', { name: 'Yanıtla' }).click(); await A.page.getByTestId('konu-sayfasi').waitFor(); await sleep(600);
      await G.shot(A.page, 12, 'konu-sayfasi', { kind: 'sosyal', title: 'Konu (yanıtlar)', caption: 'Karta verilen yanıtlar ayrı bir konu sayfasında toplanır; sohbet akışı kalabalıklaşmaz.' });
      await A.page.locator('.sheet').getByRole('button', { name: 'Kapat' }).click();
    });
    await step('bahsetme', async () => {
      await tab(A.page, 'profile'); await B.page.getByRole('textbox', { name: 'Mesaj' }).fill('@Ay'); await B.page.locator('.at-suggest button', { hasText: '@Ayşe' }).waitFor({ timeout: 5000 });
      await G.shot(B.page, 13, 'bahsetme-onerisi', { kind: 'sosyal', title: '@bahsetme', caption: 'Takım sohbetinde "@" yazınca üye önerileri çıkar; bahsedilen oyuncuya bildirim gider, mesaj onun ekranında altın çerçeveyle vurgulanır.' });
      await B.page.locator('.at-suggest button', { hasText: '@Ayşe' }).click(); await B.page.getByRole('textbox', { name: 'Mesaj' }).type('bu akşam baskına var mısın?'); await B.page.getByRole('button', { name: 'Gönder', exact: true }).click();
      await A.page.locator('[data-testid="iletisim-bildirimi"][data-kind="mention"]').waitFor({ timeout: 8000 }); await sleep(500);
      await G.shot(A.page, 14, 'bahsetme-bildirimi', { kind: 'sosyal', title: 'Bahsetme bildirimi', caption: '"Bora senden bahsetti" şeridi ve Takım sekmesinde rozet; tek dokunuşla sohbete gidilir.' });
      await closeBanners(A.page);
    });
    await step('guvenli-sohbet', async () => {
      await teamChat(C); await C.page.locator('.quick-line').waitFor({ timeout: 8000 }).catch(() => undefined);
      await G.shot(C.page, 15, 'guvenli-sohbet-hazir-sozler', { kind: 'sosyal', title: 'Güvenli sohbet: hazır sözler', caption: 'Yeni oyuncu 8 bölümü geçene kadar serbest yazamaz; hazır sözler, emoji ve çıkartma her zaman açık. Giriş kutusu bunu dürüstçe söyler.' });
      await C.page.locator('.quick-line .phrase[data-phrase="selam"]').click().catch(() => undefined); await sleep(1300);
    });
    await step('yardim', async () => {
      await net(C, 'team.help.request', { level: 6 });
      await teamChat(B); const help = B.page.locator('[data-testid="yardim-karti"]').last(); await help.waitFor({ timeout: 10_000 }); await scrollTo(B, '[data-testid="yardim-karti"]');
      await G.shot(B.page, 20, 'yardim-karti', { kind: 'sosyal', title: 'Yardım isteği kartı', caption: 'Takılan oyuncu takımından yardım ister; kartta üç gerçek eylem: ipucu ver, kalkan gönder, birlikte yarış.' });
      await help.getByTestId('ipucu-ver').click(); await B.page.locator('.tip-opt').first().waitFor(); await sleep(500);
      await G.shot(B.page, 21, 'ipucu-sec', { kind: 'sosyal', title: 'İpucu seç', caption: 'İpucu hazır sözlerden seçilir (serbest yazı açıksa kısa metin de olur); kartın altına yanıt olarak yazılır.' });
      await B.page.locator('.tip-opt').first().click(); await sleep(1300);
      await teamChat(A); await A.page.locator('[data-testid="yardim-karti"]').last().getByTestId('kalkan-gonder').click().catch(() => undefined); await sleep(1200);
      await teamChat(B); await net(C, 'progress.submit', runOf(6, { coins: 30 }));
      const thanks = B.page.locator('[data-testid="iletisim-bildirimi"][data-kind="thanks"]'); await thanks.waitFor({ timeout: 10_000 }); await sleep(500);
      await G.shot(B.page, 22, 'yardim-tesekkur', { kind: 'sosyal', title: 'Teşekkür', caption: 'Yardım isteyen bölümü geçince yardım edenlere teşekkür şeridi ve ödül gelir; "Rica ederim" tek dokunuşla yazılır.' });
      await thanks.locator('[data-act="rica"]').click().catch(() => undefined); await sleep(1500);
      await scrollTo(B, '[data-testid="yardim-karti"]');
      await G.shot(B.page, 23, 'yardim-cozuldu', { kind: 'sosyal', title: 'Yardım çözüldü', caption: 'Kart "geçildi" olarak kapanır: ipucu, kalkan ve "Rica ederim" konuda görünür; akışa "yardımla geçti" kartı düşer.' });
    });
    await step('usta-cirak', async () => {
      await closeBanners(A.page); await toTab(A, 'profile'); await A.page.locator('.menu-tile[data-tile="together"]').click(); await A.page.getByTestId('usta-cirak').waitFor({ timeout: 10_000 }); await sleep(600);
      await G.shot(A.page, 30, 'birlikte-ekrani', { kind: 'sosyal', title: 'Birlikte: İkili Görev ve Usta–Çırak', caption: 'Profil › Birlikte: arkadaşla haftalık İkili Görev, Usta–Çırak bağı ve sohbet ayarları.' });
      await A.page.locator('[data-testid="usta-aday"]', { hasText: 'Cem' }).getByTestId('usta-teklif-et').click();
      const offer = C.page.locator('[data-testid="iletisim-bildirimi"][data-kind="mentor"]'); await offer.waitFor({ timeout: 8000 }); await offer.locator('[data-act="bak"]').click();
      await C.page.getByTestId('usta-teklif').waitFor({ timeout: 8000 }); await sleep(500);
      await G.shot(C.page, 31, 'usta-teklifi', { kind: 'sosyal', title: 'Usta teklifi', caption: 'Deneyimli oyuncu yeni başlayan takım arkadaşına ustalık teklif eder; çırak kabul edince bağ kurulur.' });
      await C.page.getByTestId('usta-kabul').click(); await C.page.getByTestId('ustam').waitFor({ timeout: 8000 });
      await climb(C, 7, 10);
      const ms = A.page.locator('[data-testid="iletisim-bildirimi"][data-kind="mentor"]'); await ms.waitFor({ timeout: 8000 }); await sleep(400);
      await G.shot(A.page, 32, 'usta-donum-noktasi', { kind: 'sosyal', title: 'Çırak dönüm noktasında', caption: '"Çırağın Cem 10. bölüme ulaştı": ustaya tek dokunuşla tebrik gönderme dürtmesi; ikisine de ödül.' });
      await ms.locator('[data-act="tebrik"]').click().catch(() => undefined); await sleep(1200); await closeBanners(A.page);
      await A.page.locator('[data-testid="cirak"]').scrollIntoViewIfNeeded().catch(() => undefined); await sleep(500);
      await G.shot(A.page, 33, 'usta-cirak-ilerleme', { kind: 'sosyal', title: 'Usta–Çırak ilerlemesi', caption: 'Çırağın dönüm noktaları (5, 10, 15, 20. bölüm) ustanın ekranında; 20. bölümde çırak mezun olur.' });
    });
    await step('ikili-gorev', async () => {
      await closeBanners(B.page); await toTab(B, 'profile'); await B.page.locator('.menu-tile[data-tile="together"]').click(); await B.page.getByTestId('ikili-gorev').waitFor({ timeout: 10_000 });
      await B.page.locator('[data-testid="ikili-aday"]', { hasText: 'Ayşe' }).getByTestId('ikili-davet-et').click();
      await A.page.locator('[data-testid="iletisim-bildirimi"][data-kind="duo"]').waitFor({ timeout: 8000 }); await closeBanners(A.page);
      await A.page.getByRole('button', { name: 'Geri' }).first().click().catch(() => undefined); await A.page.locator('.menu-tile[data-tile="together"]').click();
      await A.page.getByTestId('ikili-davet').getByRole('button', { name: 'Kabul' }).click(); await B.page.locator('[data-testid="ikili-gorev"] .duo-pair').waitFor({ timeout: 8000 });
      await net(A, 'progress.submit', runOf(14, { coins: 190 })); await net(B, 'progress.submit', runOf(10, { coins: 170 }));
      await B.page.locator('[data-testid="ikili-kademe-0"][data-reached="1"]').waitFor({ timeout: 8000 }); await toastGone(B.page); await closeBanners(B.page); await settle(B.page);
      await B.page.getByTestId('ikili-gorev').scrollIntoViewIfNeeded(); await sleep(500);
      await G.shot(B.page, 34, 'ikili-gorev', { kind: 'sosyal', title: 'İkili Görev', caption: 'İki arkadaş haftalık ortak nota hedefi için birlikte oynar: 300 notada ilk sandık, 800\'de ikincisi; ikisinin katkısı ayrı ayrı görünür.' });
    });
    await step('dm', async () => {
      const bId = await B.page.evaluate(() => window.__etkinlik.net().me.id);
      await net(A, 'dm.send', { to: bId, text: 'selam', kind: 'hazir' }); await sleep(700);
      await net(A, 'dm.send', { to: bId, text: 'Bu akşam 20:00\'de bilgi yarışmasına katılalım mı? Koklea sorularına çalıştım 🙂', kind: 'text' });
      await closeBanners(B.page); await toTab(B, 'profile'); await B.page.locator('.menu-tile[data-tile="messages"]').click();
      await B.page.locator('[data-testid="sohbet-satiri"]', { hasText: 'Ayşe' }).first().click({ timeout: 10_000 }); await B.page.getByTestId('dm-ekrani').waitFor();
      await B.page.getByRole('button', { name: 'Emoji ve çıkartmalar' }).click(); await B.page.locator('.dm-panel-tabs button', { hasText: 'Hazır sözler' }).click(); await sleep(600);
      await G.shot(B.page, 40, 'ozel-mesaj-hazir-sozler', { kind: 'sosyal', title: 'Özel mesaj: hazır sözler', caption: 'Arkadaşlar ve takım arkadaşları birbirine yazabilir; hazır sözler, emoji ve Odi çıkartmaları tek dokunuşla. Görüldü, yazıyor ve tepki göstergeleri var.' });
      await B.page.locator('.dm-phrases .phrase[data-phrase="birlikte"]').click().catch(() => undefined); await sleep(1200);
      await B.page.getByRole('button', { name: 'Emoji ve çıkartmalar' }).click().catch(() => undefined); await sleep(800);
      await G.shot(B.page, 41, 'ozel-mesaj', { kind: 'sosyal', title: 'Özel mesajlaşma', caption: 'Özel sohbet: hazır söz ve serbest yazı mesajları; küfür filtresi, şikâyet ve engelleme her mesajda.' });
      await B.page.getByRole('button', { name: 'Geri' }).first().click().catch(() => undefined); await sleep(600);
      await G.shot(B.page, 42, 'mesaj-kutusu', { kind: 'sosyal', title: 'Mesajlar', caption: 'Mesaj kutusu: konuşmalar en yeni üstte, okunmamış sayılarıyla.' });
    });
    await step('dq-aciklama', async () => {
      await teamChat(A); await A.page.locator('[data-testid="gunun-sorusu"][data-rev="1"]').first().waitFor({ timeout: 80_000 }); await scrollTo(A, '[data-testid="gunun-sorusu"]');
      await G.shot(A.page, 2, 'gunun-sorusu-aciklandi', { kind: 'sosyal', title: 'Günün Sorusu açıklandı', caption: 'Akşam 20:00\'de doğru şık, kısa açıklama ve doğru bilenler açıklanır; doğru bilene 10 jeton. Kartın konusu tartışma alanıdır.' });
      await A.page.locator('[data-testid="gunun-sorusu"] .fc-reply', { hasText: 'Haftalık tablo' }).first().click(); await A.page.locator('.dq-board li').first().waitFor({ timeout: 8000 }); await sleep(500);
      await G.shot(A.page, 3, 'gunun-sorusu-haftalik-tablo', { kind: 'sosyal', title: 'Günün Sorusu: haftalık tablo', caption: 'Takımın haftalık doğru cevap tablosu; Çalışma Grubu açıksa sorular odyoloji öğrencisi düzeyinden seçilir.' });
      await A.page.locator('.sheet').getByRole('button', { name: 'Kapat' }).click();
    });
    await step('takim-genel', async () => {
      await teamChat(B); await sleep(600);
      await G.shot(B.page, 5, 'takim-sohbeti', { kind: 'sosyal', title: 'Takım sohbeti', caption: 'Takım sohbeti: üstte "Kim çevrimiçi", altta hazır söz şeridi; akış kartları, yardım kartları ve Günün Sorusu sohbetin içinde.' });
      await teamSub(B, 'Üyeler'); await G.shot(B.page, 6, 'takim-uyeler', { kind: 'sosyal', title: 'Takım üyeleri', caption: 'Üyeler, rolleri (lider, yardımcı, üye), haftalık katkıları ve çevrimiçi durumları.' });
      await teamSub(B, 'Hedefler'); await G.shot(B.page, 7, 'takim-hedefleri', { kind: 'sosyal', title: 'Haftalık takım hedefleri', caption: 'Üç haftalık hedef × dört kademe (Yıldız Avı, Bölüm Maratonu, Canavar Avı); ödüller önceden görünür.' });
      await teamSub(B, 'Teknoloji'); await G.shot(B.page, 8, 'takim-teknolojisi', { kind: 'sosyal', title: 'Takım teknolojisi', caption: 'Üyelerin jeton bağışlarıyla güçlenen ortak teknolojiler: ortak kazanç, kalkan, savaş borusu, baskın gücü.' });
    });
    // ---- Sıralama: ek gerçek oyuncular (tarayıcısız) tabloyu doldurur
    const extra = [];
    await step('siralama', async () => {
      for (const [nm, lv, col] of [['Deniz', 22, 0x5b8def], ['Elif', 18, 0x9b7bff], ['Kerem', 16, 0x22a565], ['Zeynep', 9, 0xf0567a], ['Mert', 6, 0xd98b00]]) extra.push(await rawPlayer(S.url, nm, lv, col));
      await closeBanners(A.page); await toTab(A, 'profile'); await A.page.locator('.menu-tile[data-tile="ranking"]').click(); await A.page.getByTestId('siralama').waitFor(); await sleep(1500);
      await G.shot(A.page, 50, 'siralama-podyum', { kind: 'sosyal', title: 'Sıralama: en güçlü oyuncular', caption: 'İlk üç podyumda, her oyuncunun kendi Odi rengi ve şapkasıyla. Güç puanı yalnızca sunucunun doğruladığı olaylardan hesaplanır.' });
      await A.page.getByRole('button', { name: 'Nasıl hesaplanır?' }).click(); await sleep(700);
      await G.shot(A.page, 51, 'siralama-bilgi', { kind: 'sosyal', title: 'Nasıl hesaplanır?', caption: 'Bilgi sayfası formülü ve haftalık ödülleri aynen gösterir: yıldız × 10 + geçilen bölüm × 20 + kamp seviyeleri × 15 + Günün Sorusu doğruları × 5.' });
      await A.page.getByRole('button', { name: 'Anladım' }).click(); await sleep(400);
      await A.page.locator('.rank-kind button', { hasText: 'Takımlar' }).click(); await sleep(1200);
      await G.shot(A.page, 52, 'siralama-takimlar', { kind: 'sosyal', title: 'Sıralama: takımlar', caption: 'Takım tabloları: takım gücü, Bölge Savaşı, Baskın ve Bilgi; kendi takımın vurgulu.' });
      await A.page.locator('.rank-kind button', { hasText: 'Oyuncular' }).click(); await sleep(800);
      const row = A.page.locator('[data-testid="sira-satiri"]').filter({ hasText: 'Bora' }).first();
      if (!(await row.count())) { await A.page.locator('.rank-scope button[data-scope="arkadas"]').click(); await sleep(900); }
      await A.page.locator('[data-testid="sira-satiri"]').filter({ hasText: 'Bora' }).first().locator('button').first().click(); await A.page.getByTestId('profil-karti').waitFor(); await sleep(700);
      await G.shot(A.page, 53, 'profil-karti', { kind: 'sosyal', title: 'Profil kartı', caption: 'Satıra dokununca profil kartı: yıldız, en yüksek bölüm, lig ve takım; arkadaş ekle, mesaj, takıma davet, hediye ve yarış.' });
      await A.page.keyboard.press('Escape').catch(() => undefined); await sleep(400);
    });
    await step('lig-arkadaslar', async () => {
      await closeBanners(B.page); await toTab(B, 'profile'); await B.page.locator('.league-card').first().click(); await sleep(1200);
      await G.shot(B.page, 55, 'lig', { kind: 'sosyal', title: 'Haftalık lig', caption: 'Haftalık lig: 30 kişilik grup, ilk 7 bir üst kademeye çıkar; puanlar bölüm sonuçlarından ve yarış derecelerinden.' });
      await B.page.getByRole('button', { name: 'Geri' }).first().click(); await B.page.locator('.menu-tile[data-tile="friends"]').click(); await sleep(1000); await B.page.locator('.subtabs .subtab').first().click().catch(() => undefined); await sleep(800);
      await G.shot(B.page, 56, 'arkadaslar', { kind: 'sosyal', title: 'Arkadaşlar', caption: 'Arkadaş listesi (çevrimiçi önce), arkadaş kodu, arama ve öneriler ("Takım arkadaşın", "Aynı ligdesiniz"); günde bir arkadaş hediyesi.' });
    });
    for (const c of extra) c.close();
    for (const p of [A, B, C]) await p.ctx.close();
  });
  await groupYaris(S);
}

// ---- canlı yarış: uygulamadaki RaceLobby / LevelHost / RaceResult bileşenleri; botla oynanması için harness yarış sayfası (yaris.html)
async function groupYaris(S) {
  await group('sosyal-yaris', 'sosyal', async (G) => {
    const yDist = resolve(OUT, 'dist-yaris');
    if (!existsSync(resolve(yDist, 'src/race/dev/yaris.html'))) {
      process.env.VITE_ODI_E2E = '1';
      await vite.build({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: yDist, emptyOutDir: true, rollupOptions: { input: { main: resolve(webRoot, 'index.html'), yaris: resolve(webRoot, 'src/race/dev/yaris.html') } } } });
      delete process.env.VITE_ODI_E2E;
    }
    const yp = await freePort();
    const ypv = await vite.preview({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: yDist }, preview: { port: yp, strictPort: true, host: '127.0.0.1' } });
    const ps = [];
    try {
      for (const [name, delay, col] of [['Ayşe', 0, 0xff4f7a], ['Bora', 400, 0x2ec4b6], ['Cem', 900, 0xffb347]]) {
        const { ctx, page } = await newPage({ seed: save({ cleared: 12, tours: ALL_TOURS, extra: { odiColor: col, chosenColor: col } }) });
        await page.goto(`http://127.0.0.1:${yp}/src/race/dev/yaris.html?ad=${encodeURIComponent(name)}&yaris-bot=1&bot-gecikme=${delay}&sunucu=${encodeURIComponent(S.url)}`, { waitUntil: 'load' });
        await page.waitForFunction((n) => window.__yaris?.net()?.me?.name === n, name, { timeout: 25_000 });
        await page.evaluate((c) => window.__yaris.net().call('profile.update', { color: c }).catch(() => undefined), col);
        ps.push({ name, ctx, page });
      }
      const [A, B, C] = ps;
      const code = await A.page.evaluate(() => window.__yaris.net().me.friendCode); await B.page.evaluate((c) => window.__yaris.net().call('friends.add', { code: c }), code);
      const codeB = await B.page.evaluate(() => window.__yaris.net().me.friendCode); await A.page.evaluate((c) => window.__yaris.net().call('friends.add', { code: c }), codeB);
      await sleep(800);
      await G.shot(A.page, 60, 'yaris-lobisi', { kind: 'yaris', title: 'Canlı yarış', caption: 'Canlı yarış lobisi: oda kur, kodla katıl ya da hızlı eşleş. Yalnızca gerçek oyuncular yarışır; sahte rakip yok.' });
      await A.page.getByTestId('yaris-oda-kur').click(); await A.page.getByTestId('yaris-seviye-9').click().catch(async () => { await A.page.locator('[data-testid^="yaris-seviye-"]').first().click(); });
      await A.page.getByTestId('yaris-kod').waitFor(); const roomId = await A.page.getByTestId('yaris-kod').getAttribute('data-code');
      await A.page.getByTestId('yaris-bekleme-davet').click(); await A.page.getByTestId('yaris-davet-Bora').click();
      await B.page.getByTestId('yaris-davet-karti').waitFor({ timeout: 10_000 }); await sleep(600);
      await G.shot(B.page, 61, 'yaris-daveti', { kind: 'yaris', title: 'Yarış daveti', caption: 'Arkadaşın yarış davetini kabul et: aynı bölüm, aynı tohum, aynı anda başlangıç.' });
      await B.page.getByTestId('yaris-davet-kabul').click();
      await C.page.getByTestId('yaris-kod-gir').click(); await C.page.getByTestId('yaris-kod-input').fill(roomId); await C.page.getByTestId('yaris-kod-katil').click();
      for (const p of ps) await p.page.waitForFunction(() => document.querySelectorAll('[data-testid="yaris-oyuncu"]').length === 3, null, { timeout: 12_000 });
      await A.page.locator('[data-testid="yaris-sohbet"] .phrase').first().click().catch(() => undefined); await sleep(1300);
      await C.page.locator('[data-testid="yaris-sohbet"] .phrase').nth(1).click().catch(() => undefined); await sleep(800);
      await B.page.getByTestId('yaris-hazir').click(); await sleep(800);
      await G.shot(A.page, 62, 'yaris-oda', { kind: 'yaris', title: 'Yarış odası', caption: 'Dört kişiye kadar oda: oyuncular Odi renkleriyle, hazır durumları ve oda sohbetinde hazır sözler. Herkes hazır olunca geri sayım başlar.' });
      await C.page.getByTestId('yaris-hazir').click(); await A.page.getByTestId('yaris-hazir').click();
      for (const p of ps) await p.page.waitForFunction(() => window.__odi?.events?.some((e) => e.type === 'ready'), null, { timeout: 25_000 });
      await sleep(900); await G.shot(B.page, 63, 'yaris-hayaletler', { kind: 'yaris', title: 'Rakip hayaletleri', caption: 'Yarışta rakipler kendi Odi renklerinde, isimleriyle yarı saydam hayaletler olarak koşar; başlangıç sunucu saatine göre eşitlenir, herkesin "Başla!"sı aynı ana denk gelir.' }, { clip: await canvasClip(B.page), wait: 0 });
      await A.page.waitForFunction(() => window.__odi?.events?.some((e) => e.type === 'started'), null, { timeout: 20_000 });
      await A.page.waitForFunction(() => { const r = globalThis.__odiScene?.race; if (!r) return false; const g = [...r.ghosts.values()]; return g.length === 2 && g.every((x) => x.seen); }, null, { timeout: 30_000 }).catch(() => undefined);
      await sleep(3500);
      await G.shot(A.page, 64, 'yaris-sira-cubugu', { kind: 'yaris', title: 'Yarış sürerken', caption: 'Yarış sürerken üstteki şerit herkesin anlık konumunu ve sırasını gösterir (burada Ayşe 1.).' }, { clip: await canvasClip(A.page), wait: 0 });
      for (const p of ps) await p.page.waitForFunction(() => window.__yaris?.route === 'result', null, { timeout: 240_000 });
      await A.page.getByTestId('yaris-sonuc').waitFor({ timeout: 10_000 }); await A.page.waitForFunction(() => window.__yaris?.result?.status === 'bitti', null, { timeout: 90_000 }).catch(() => undefined);
      await sleep(1500);
      await G.shot(A.page, 65, 'yaris-sonucu', { kind: 'yaris', title: 'Yarış sonucu', caption: 'Bitiş sırası ve süreler; rövanş ya da lobiye dönüş. Yarış birincilikleri haftalık "Yarış galibiyeti" sıralamasına yazılır.' });
    } finally { for (const p of ps) await p.ctx.close(); await ypv.close().catch(() => undefined); }
  });
}

// ================================================================ G · öğrenme ve H · mağaza/dolap/ödül kutusu/profil
/** zengin oyuncu kaydı: 26 bölüm, kartlar, başarımlar, kozmetikler */
function richMeta(cleared) {
  const biomes = [...new Set(DATA.levels.slice(0, cleared).map((l) => l.biome))];
  const cards = DATA.cards.filter((c) => biomes.includes(c.biome)).filter((_, i) => i % 5 !== 4).map((c) => c.id);
  const ach = Object.fromEntries(DATA.achievements.slice(0, 22).map((a, i) => [a.id, (i % 3) + 1]));
  const owned = ['renk-mor', 'renk-turkuaz', 'renk-mercan', 'renk-amber', 'renk-lavanta', 'renk-nane', 'renk-sol-kulak', 'kostum-koruyucu', 'sapka-yok', 'sapka-bere', 'sapka-nota', 'sapka-koklea', 'sapka-kulaklik', 'sapka-parti', 'sapka-yildiz'];
  return { stats: { plays: cleared + 14, clears: cleared, fails: 6, coins: cleared * 85, noDamage: 9, underPar: 7, lucky: 2, shares: 1, quests: 21, chests: 6, calendar: 9, maxStreak: 9, maxCombo: 34, comebacks: 3, melody: 3, escort: 2, timed: 4, collectAll: 4, perfect: 30, shieldsEarned: 3, days: 12 },
    feats: {}, daily: null, calendar: { lastClaim: '' }, shields: 1, achievements: ach, cards, cosmetics: { owned, color: 'renk-turkuaz', hat: 'sapka-kulaklik' },
    seenBiomes: biomes, firsts: [], treasures: [5, 10, 15, 20, 25].filter((t) => t <= cleared), albumBadges: biomes.slice(0, 2), ledger: [] };
}
async function richPlayer(S, name, { cleared = 26, knowledge = 'genel', extraSave = {}, meta = null } = {}) {
  const { ctx, page } = await newPage({ seed: save({ cleared, tours: ALL_TOURS, meta: meta ?? richMeta(cleared), extra: { knowledge, ...extraSave } }) });
  await page.goto(url(S.url), { waitUntil: 'load' });
  await page.getByRole('button', { name: /Devam et|Yola çık/ }).click({ timeout: 45_000 });
  await page.locator('nav.tabbar').waitFor({ timeout: 20_000 }); await nickname(page, name); await sleep(1200); await settle(page);
  return { ctx, page, name };
}
async function profileTile(page, tile) { for (let i = 0; i < 5 && !(await page.locator('nav.tabbar').count()); i++) await back(page); await tab(page, 'profile'); await sleep(500); await page.locator(`.menu-tile[data-tile="${tile}"]`).click(); await sleep(1100); await toastGone(page); }
const back = async (page) => { const h = page.locator('.screen-head button[aria-label="Geri"]'); const b = (await h.count()) ? h.first() : page.getByRole('button', { name: 'Geri' }).first(); await b.evaluate((el) => el.click(), null, { timeout: 5000 }).catch(() => undefined); await sleep(500); };

async function sectionOgrenme() {
  const S = await server('normal');
  await group('ogrenme', 'ogrenme', async (G) => {
    const { ctx, page } = await richPlayer(S, 'Öğrenci Ece', { cleared: 26, knowledge: 'odyoloji' });
    await profileTile(page, 'glossary');
    await G.shot(page, 1, 'kulak-sozlugu', { kind: 'ogrenme', title: 'Kulak Sözlüğü', caption: 'Yolculukta ulaşılan her bölgenin terimleri açılır: önce sade anlatım, "Daha fazla" ile odyoloji ayrıntısı. Arama kutusuyla terim bulunur.' });
    await page.locator('[data-testid="sozluk"] .gl-term .ml-btn').first().click().catch(() => undefined); await sleep(600);
    await G.shot(page, 2, 'kulak-sozlugu-daha-fazla', { kind: 'ogrenme', title: 'Sözlük: "Daha fazla"', caption: '"Daha fazla" teknik tanımı ve kaynağı açar; odyoloji öğrencisi düzeyinde ayrıntı.' });
    const kok = page.locator('[data-testid="sozluk"] .gl-region', { hasText: 'Koklea' }).first(); await kok.scrollIntoViewIfNeeded().catch(() => undefined); await sleep(600);
    await G.shot(page, 3, 'kulak-sozlugu-koklea', { kind: 'ogrenme', title: 'Sözlük: koklea terimleri', caption: 'İç kulak bölgelerinin terimleri; ulaşılmamış bölgeler kilitli ve "bölgeye ulaşınca açılır" der.' });
    await back(page); await profileTile(page, 'album');
    await G.shot(page, 10, 'kulak-kartlari', { kind: 'ogrenme', title: 'Kulak Kartları albümü', caption: 'Her bölgenin beş Kulak Kartı: ilk bölüm, üç yıldız, özel hedef, altın koklea gibi gerçek başarılarla kazanılır; bölge albümü tamamlanınca rozet.' });
    await page.locator('.ear-card.has').nth(2).click().catch(() => undefined); await sleep(900);
    await G.shot(page, 11, 'kulak-karti-detay', { kind: 'ogrenme', title: 'Kulak Kartı', caption: 'Kartın ön yüzünde bir kulak bilgisi, "Daha fazla" ile teknik açıklaması.' });
    await page.getByRole('button', { name: 'Tamam' }).click().catch(() => undefined); await back(page);
    await profileTile(page, 'achievements');
    await G.shot(page, 12, 'basarimlar', { kind: 'ogrenme', title: 'Başarımlar', caption: 'Bronz, gümüş ve altın kademeli başarımlar; her birinin koşulu açıkça yazar.' });
    await ctx.close();
    // Tüy Dede'nin Notu: yeni bölgeye girerken (genel ve odyoloji öğrencisi düzeyi)
    for (const [nn, know, title, cap] of [[20, 'genel', 'Tüy Dede\'nin Notu', 'Yeni bölgeye girerken Tüy Dede bir "Biliyor muydun?" notu bırakır; sade anlatım herkes için.'], [21, 'odyoloji', 'Tüy Dede\'nin Notu: odyoloji düzeyi', 'Bilgi düzeyi "Odyoloji öğrencisi" iken not teknik ayrıntısıyla açık gelir.']]) {
      const m = richMeta(20); m.seenBiomes = m.seenBiomes.filter((b) => b !== 'koklea-1');
      const { ctx: c2, page: p2 } = await richPlayer(S, `Not${nn}`, { cleared: 20, knowledge: know, meta: m, extraSave: { notesSeen: [] } });
      await tab(p2, 'map'); await p2.waitForFunction(() => !!window.__harita, null, { timeout: 20_000 }); await sleep(1200);
      await p2.evaluate(() => window.__harita.card(21)); await p2.locator('.map-btn.shine').click({ timeout: 10_000 }); await p2.getByRole('button', { name: /Haydi/ }).waitFor({ timeout: 15_000 }); await sleep(1500);
      await G.shot(p2, nn, `tuy-dede-notu-${know}`, { kind: 'ogrenme', title, caption: cap });
      await c2.close();
    }
  });
}

async function sectionMagaza() {
  const S = await server('normal');
  await group('magaza', 'magaza', async (G) => {
    const { ctx, page } = await richPlayer(S, 'Kulakçı Ayşe', { cleared: 26 });
    let pid = null; for (let i = 0; i < 40 && !(pid = S.pid('Kulakçı Ayşe')); i++) await sleep(250);
    if (pid) { S.db.run('UPDATE players SET jeton = ?, kristal = ? WHERE id = ?', 2480, 160, pid); S.srv.app.walletChanged(pid); }
    // ödül kutusu: gerçek bir arkadaş hediyesi
    const fr = await rawPlayer(S.url, 'Bora', 8, 0x2ec4b6);
    const myCode = await page.evaluate(() => window.__etkinlik?.net()?.me?.friendCode ?? null);
    await tab(page, 'profile'); await sleep(1500);
    await G.shot(page, 1, 'profil', { kind: 'profil', title: 'Profil', caption: 'Profil: Odi\'nin rengi ve şapkası, seviye, yıldızlar, lig kartı ve bütün yerlere açılan kutucuklar (Arkadaşlar, Mesajlar, Ödül kutusu, Mağaza, Birlikte, Sıralama, Kartlar, Sözlük, Dolap…).' });
    await page.evaluate(() => { document.scrollingElement?.scrollTo(0, 99999); document.getElementById('root')?.scrollTo(0, 99999); }); await sleep(700);
    await G.shot(page, 2, 'profil-alt', { kind: 'profil', title: 'Profil: kutucuklar', caption: 'Profilin devamı: Başarımlar, Kulak Kartları, Kulak Sözlüğü, Dolap, Yetenekler, Ayarlar ve "Nasıl çalışır?" sayfası.' });
    await scrollTop(page);
    await profileTile(page, 'shop');
    await G.shot(page, 10, 'magaza', { kind: 'magaza', title: 'Mağaza', caption: 'Mağaza: kristal paketleri, Sezon Kartı ve takım hediyeli ürünler. Web\'de açıkça TEST mağazasıdır, para çekmez; gerçek satın alma yalnızca App Store / Google Play üzerinden.' });
    await page.evaluate(() => { document.scrollingElement?.scrollTo(0, 99999); document.getElementById('root')?.scrollTo(0, 99999); }); await sleep(700);
    await G.shot(page, 11, 'magaza-alt', { kind: 'magaza', title: 'Mağaza: aylık harcama sınırı', caption: 'Ürünlerin içeriği ve takım hediyesi açıkça yazar; aylık harcama sınırı oyuncu tarafından düşürülebilir (yükseltme 24 saat sonra geçerli).' });
    await scrollTop(page);
    const buy = page.locator('.product').first().getByRole('button').first();
    if (await buy.count()) { await buy.click(); await page.locator('.sheet').waitFor({ timeout: 5000 }).catch(() => undefined); await sleep(700);
      await G.shot(page, 12, 'magaza-onay', { kind: 'magaza', title: 'Satın alma onayı', caption: 'Satın almadan önce içerik, fiyat ve kalan aylık sınır gösterilir; TEST modunda düğme "Test satın alması yap" der.' });
      await page.locator('.sheet').getByRole('button', { name: /Test satın alması yap/ }).click().catch(() => undefined); await sleep(2500); await settle(page); }
    await back(page);
    if (myCode) { await fr.call('friends.add', { code: myCode }).catch(() => undefined); }
    const req = await page.evaluate(() => window.__etkinlik?.net()?.call('friends.requests', {}).catch(() => null));
    for (const r of req?.incoming ?? []) await page.evaluate((id) => window.__etkinlik.net().call('friends.respond', { requestId: id, accept: true }), r.id).catch(() => undefined);
    const me = await page.evaluate(() => window.__etkinlik?.net()?.me?.id ?? null);
    if (me) await fr.call('friends.gift', { id: me }).catch(() => undefined);
    await sleep(1200);
    await profileTile(page, 'inbox');
    await G.shot(page, 20, 'odul-kutusu', { kind: 'magaza', title: 'Ödül kutusu', caption: 'Ödül kutusu: arkadaş hediyeleri, etkinlik ve sıralama ödülleri, takım hediyeleri. "Hepsini al" tek dokunuşla toplar.' });
    await back(page);
    await profileTile(page, 'wardrobe');
    await G.shot(page, 30, 'dolap', { kind: 'magaza', title: 'Dolap', caption: 'Dolap: Odi\'nin renkleri, kostümleri ve şapkaları. Kozmetikler yalnızca görünüştür, oyun gücü vermez; kilitlilerde nasıl açılacağı yazar.' });
    const hats = page.getByRole('heading', { name: /Şapkalar/ }); await hats.scrollIntoViewIfNeeded().catch(() => undefined); await sleep(500);
    await G.shot(page, 31, 'dolap-sapkalar', { kind: 'magaza', title: 'Dolap: şapkalar', caption: 'Şapkalar bölümler, hazineler ve başarımlarla açılır; giyilen şapka bölümde, haritada, kampta ve yarış hayaletinde görünür.' });
    await back(page);
    await profileTile(page, 'skills');
    await G.shot(page, 40, 'yetenekler', { kind: 'profil', title: 'Yetenekler', caption: 'Jetonla alınan kalıcı yetenekler (çift zıplama, uzun kayma, mıknatıs, kalkan…); ön koşullar ve fiyatlar açık.' });
    await back(page);
    await profileTile(page, 'info');
    await G.shot(page, 50, 'nasil-calisir', { kind: 'profil', title: 'Nasıl çalışır?', caption: 'Ödüllerin ve olasılıkların açıkça anlatıldığı bilgi sayfası: gizli şans yok, sahte baskı yok.' });
    fr.close(); await ctx.close();
  });
}

// ================================================================ B2 · bölge tanıtımları ve seçili sonuç ekranları (gerçek akış: harita → tanıtım → bot → sonuç)
const INTRO_LEVELS = [6, 9, 13, 21, 24, 27, 31, 34, 37];
const RESULT_LEVELS = [9, 20, 31, 40];
async function sectionSonuclar() {
  const S = await server('normal');
  for (const n of [...new Set([...INTRO_LEVELS, ...RESULT_LEVELS])].sort((a, b) => a - b)) {
    if (n < LO || n > HI) continue;
    const L = LV(n); const intro = INTRO_LEVELS.includes(n); const result = RESULT_LEVELS.includes(n);
    await group(`bolum-akis-${pad2(n)}`, 'bolumler', async (G) => {
      const seen = [...new Set(DATA.levels.slice(0, n - 1).map((l) => l.biome))];
      const m = richMeta(n - 1); m.seenBiomes = seen;
      const { ctx, page } = await newPage({ seed: save({ cleared: n - 1, tours: ALL_TOURS, meta: m }) });
      await page.goto(url(S.url, 'oyun-bot=1'), { waitUntil: 'load' });
      await page.getByRole('button', { name: /Devam et/ }).click({ timeout: 45_000 });
      await page.locator('nav.tabbar').waitFor({ timeout: 20_000 }); await nickname(page, `Yolcu${n}`); await sleep(1500); await settle(page);
      await page.waitForFunction(() => !!window.__harita, null, { timeout: 20_000 }); await sleep(1500);
      await page.evaluate((k) => window.__harita.card(k), n); await page.locator('.map-btn.shine').click({ timeout: 10_000 });
      if (intro) {
        await page.getByRole('button', { name: /Haydi/ }).waitFor({ timeout: 15_000 }); await sleep(1600);
        await G.shot(page, `${String(n * 10).padStart(3, '0')}a`, `${slugify(L.zone)}-tanitim`, { level: n, zone: L.zone, kind: 'bolge-tanitimi', title: `Yeni bölge: ${L.zone}`, caption: `${n}. bölümle ${L.zone} bölgesine girilir: kısa tanıtım ("${DATA.biomes[L.biome].blurb}"), Tüy Dede'nin Notu ve bölgenin hareketleri.` });
      }
      if (!result) { await ctx.close(); return; }
      for (let i = 0; i < 6; i++) { const h = page.getByRole('button', { name: /Haydi/ }); if (await h.count()) { await h.click().catch(() => undefined); break; } await sleep(500); }
      await waitResult(page); await sleep(4500); await settle(page); await sleep(1200);
      const won = await page.locator('.result-screen:not(.lost)').count();
      if (!won) warn(`L${n}: sonuç ekranı kayıp gösteriyor`);
      const fin = n === 40;
      await G.shot(page, `${String(n * 10 + 9).padStart(3, '0')}`, `${slugify(L.name)}-sonuc`, { level: n, zone: L.zone, kind: fin ? 'final' : 'sonuc', title: fin ? 'Final: Gürültü Canavarı yenildi' : `Sonuç ekranı: ${n}. bölüm`, caption: fin ? 'Son bölümün sonuç ekranı: yıldızlar, skor, notalar ve süre; yolculuk tamamlandı, ninni beyne ulaştı.' : `${n}. bölüm «${L.name}» sonrası: yıldızlar, skor, toplanan notalar, süre ve hedef; seviye çubuğu, açılan ödüller ve sıradaki bölüm.` }, { wait: 0 });
      await page.evaluate(() => { document.scrollingElement?.scrollTo(0, 99999); document.getElementById('root')?.scrollTo(0, 99999); for (const el of document.querySelectorAll('.screen')) el.scrollTo(0, 99999); }); await sleep(900);
      if (n === 20 || fin) await G.shot(page, `${String(n * 10 + 9).padStart(3, '0')}b`, `${slugify(L.name)}-sonuc-alt`, { level: n, zone: L.zone, kind: fin ? 'final' : 'sonuc', title: fin ? 'Final sonucu: ödüller' : `Sonuç ekranı: ödüller`, caption: 'Sonuç ekranının devamı: kazanılan jeton ve XP, açılan kartlar/kozmetikler, günlük görev ilerlemesi ve haftalık lig puanı.' });
      await ctx.close();
    });
  }
}

// ================================================================ çalıştır
try {
  if (want('acilis')) await sectionAcilis();
  if (want('harita')) await sectionHarita();
  if (want('kamp')) await sectionKamp();
  if (want('etkinlik')) await sectionEtkinlik();
  if (want('sosyal')) await sectionSosyal();
  if (want('ogrenme')) await sectionOgrenme();
  if (want('magaza')) await sectionMagaza();
  if (want('bolumler') && !has('no-sonuc')) await sectionSonuclar();
  if (want('bolumler')) {
    const q = []; for (let n = LO; n <= HI; n++) q.push(n);
    await Promise.all(Array.from({ length: Math.min(PAR, q.length) }, async () => { while (q.length) await captureLevel(q.shift()); }));
  }
} finally {
  await shutdown();
  writeManifest();
  if (warnings.length) { console.log('\nUyarılar:'); for (const w of [...new Set(warnings)]) console.log('  · ' + w); }
}
