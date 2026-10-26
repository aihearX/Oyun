#!/usr/bin/env node
// ODİ mağaza ekran görüntüleri (vitrin, MK-022 / YN-012): App Store ve Google Play listesi için aday kareler. Sahip seçer; yayınlanmaz.
// Gerçek oyun durumu: aynı süreçte gerçek sunucu (bellek içi veritabanı), web test derlemesi (VITE_ODI_E2E=1: bot kancaları), tohumlama
// ui-mobile-check / tanitim ile aynı yol (yerel kayıt odi-v1 + sunucu veritabanına bina/kamp/görev satırları + gerçek ağ çağrıları).
// Yönetici kipi KULLANILMAZ; önizleme (?demo=…) sayfası kullanılmaz. Oyuncu adları oyun temalı kurgusal takma adlardır.
// Her kare üç boyutta, aynı sayfada görünüm yeniden boyutlanarak (deviceScaleFactor 3):
//   ios69   440×956  → 1320×2868 (iPhone 6,9")      güvenli alan üst 62 / alt 34
//   ios65   428×926  → 1284×2778 (iPhone 6,5")      güvenli alan üst 44 / alt 34
//   android 360×640  → 1080×1920 (Android telefon)  güvenli alan üst 24 / alt 0
// Kareye yazı ya da çerçeve eklenmez. Her çekimden önce: yazı tipleri ve resimler yüklü, sonlu CSS animasyonları bitmiş
// (document.getAnimations()), kutlama/bildirim/şerit kapalı; bildirim, yükleniyor, hata, çevrimdışı, yönetici ya da önizleme öğesi
// görünürse kare yeniden denenir, olmazsa araç hata verir (boş/yarım kare yazılmaz).
// Kareler:
//   01-bolum        bölüm oynanışı (Odi, notalar ve engel aynı karede; bot oynar, an seçilince sahne durur)
//   02-harita       Yaşayan Kulak Haritası (24. bölümde, geçilen bölgeler canlanmış)
//   03-kamp         Kulak Kampı (Merkez Sv 16, Kamp Seviyesi 18, süsler, anıtlar)
//   04-hikaye       Kampın Hikâyesi (Görevler paneli)
//   05-sohbet       takım sohbeti (yalnız hazır sözler ve akış kartları)
//   06-yaris        canlı yarış odası (üç gerçek oyuncu, hazır durumları, hazır sözler)
//   07-sonuc        sonuç ekranı 3 yıldız (gerçek koşu: botun oynadığı bölüm)
//   08-tuy-dede     Tüy Dede'nin Notu (yeni bölge tanıtımı)
//   09-vaka         Klinik: hasta vakası (odyogram sonucu)
//   10-defter       Vaka Defteri
// Kullanım: node tools/harness/vitrin.mjs [--only bolum,harita,kamp,hikaye,sohbet,yaris,sonuc,dede,vaka,defter]
//           [--boyut ios69,ios65,android] [--out <klasör>] [--no-build] [--bolum 25] [--sonuc 25,28,33]
// Çıktı: <out>/<boyut-klasörü>/<nn>-<ad>.png (varsayılan out: tools/harness/out/vitrin/png). Derleme: tools/harness/out/vitrin/.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '1'; };
const has = (k) => argv.includes(`--${k}`);
const root = resolve(new URL('../..', import.meta.url).pathname);
const webRoot = resolve(root, 'apps/web');
const WORK = resolve(root, 'tools/harness/out/vitrin'); mkdirSync(WORK, { recursive: true });
const OUT = resolve(opt('out', resolve(WORK, 'png')));
const ONLY = opt('only', '') ? opt('only').split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);
const ALL_SIZES = {
  ios69: { w: 440, h: 956, top: 62, bottom: 34, dir: 'ios-6.9-1320x2868' },
  ios65: { w: 428, h: 926, top: 44, bottom: 34, dir: 'ios-6.5-1284x2778' },
  android: { w: 360, h: 640, top: 24, bottom: 0, dir: 'android-1080x1920' },
};
const SIZES = opt('boyut', 'ios69,ios65,android').split(',').map((k) => { if (!ALL_SIZES[k]) throw new Error(`bilinmeyen boyut: ${k}`); return [k, ALL_SIZES[k]]; });
const DSF = 3;
const PLAY_LEVEL = Number(opt('bolum', 25));
const RESULT_LEVELS = opt('sonuc', '25,28,33,19').split(',').map(Number);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(`[vitrin ${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s]`, ...a);
const shots = []; const problems = [];

// ---------------------------------------------------------------- oyuncu adları (kurgusal, oyun temalı; gerçek kişi adı değil)
const AD = { ben: 'Nota Avcısı', zar: 'Zar Ustası', ors: 'Örs Kaptan', sal: 'Salyangoz', kem: 'Kemikçik', yol: 'Yolcu Odi' };
const TEAM = { name: 'Koklea Kaşifleri', emblem: '🐚', description: 'Kulaktan beyne, hep birlikte.' };

// ---------------------------------------------------------------- içerik verisi (bölümler, kartlar, kamp seviyeleri)
const veriFile = resolve(WORK, 'veri.mjs');
await build({
  stdin: { contents: `
    import { HUMAN_JOURNEY, BIOMES, CARDS, ACHIEVEMENTS, VAKALAR, campXpTotalFor, campXpNeed, campLevelRewards, decorSlots, pointCell } from '@odi/content';
    import { BUILDINGS } from '@odi/shared';
    import { generateLevel } from '@odi/level-gen';
    import { DEFAULT_SKILLS } from '@odi/content';
    const levels = HUMAN_JOURNEY.levels.map((_, i) => { const s = generateLevel(HUMAN_JOURNEY.id, i + 1, { recentStars: 3, failStreak: 0, skills: DEFAULT_SKILLS }); return { n: i + 1, biome: s.biome, mechanic: s.mechanic, name: s.name }; });
    const campLevel = Number(process.argv[2]); const parkLevel = Number(process.argv[3]);
    const rewards = []; for (let l = 1; l <= campLevel; l++) for (const r of campLevelRewards(l)) rewards.push({ l, ...r });
    const spots = [[-120, 110], [120, 118], [-300, 150], [300, 150], [-200, 220], [210, 230], [-380, 40], [380, 30], [-90, 240], [80, 250], [-460, -60], [470, -60]].map(([x, y]) => pointCell(x, y));
    console.log(JSON.stringify({ levels, biomes: Object.keys(BIOMES), cards: CARDS.map((c) => ({ id: c.id, biome: c.biome })), achievements: ACHIEVEMENTS.map((a) => a.id),
      buildings: BUILDINGS.map((b) => ({ id: b.id, maxLevel: b.maxLevel, campLevel: b.campLevel ?? 0 })), campXp: campXpTotalFor(campLevel) + Math.round(campXpNeed(campLevel) * 0.4),
      rewards, slots: decorSlots(campLevel, parkLevel), spots, vakalar: VAKALAR.map((v) => ({ id: v.id, kademe: v.kademe, kat: v.kat })) }));
  `, resolveDir: resolve(root, 'tools/harness'), loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', outfile: veriFile, logLevel: 'warning',
});
const CAMP_LV = 18; const MERKEZ = 16;
const DATA = JSON.parse(spawnSync(process.execPath, [veriFile, String(CAMP_LV), '8'], { encoding: 'utf8', maxBuffer: 64 << 20 }).stdout);
const LV = (n) => DATA.levels[n - 1];

// ---------------------------------------------------------------- web test derlemesi + yarış sayfası, sunucu (aynı süreç), önizleme
const vite = await import('vite');
const distDir = resolve(WORK, 'dist');
if (!has('no-build') || !existsSync(resolve(distDir, 'src/race/dev/yaris.html'))) {
  log('web test derlemesi…');
  process.env.VITE_ODI_E2E = '1';
  await vite.build({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: distDir, emptyOutDir: true, rollupOptions: { input: { main: resolve(webRoot, 'index.html'), yaris: resolve(webRoot, 'src/race/dev/yaris.html') } } } });
  delete process.env.VITE_ODI_E2E;
}
const srvFile = resolve(WORK, 'server-inproc.mjs');
await build({ entryPoints: [resolve(root, 'apps/server/src/server.ts')], outfile: srvFile, bundle: true, platform: 'node', target: 'node22', format: 'esm', external: ['bufferutil', 'utf-8-validate'], banner: { js: "import { createRequire as __r } from 'node:module'; const require = __r(import.meta.url);" }, logLevel: 'warning' });
const { startServer, configFromEnv } = await import(pathToFileURL(srvFile).href);
const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
// test mağazası (para çekmez), baskın hep açık; yönetici kodu özeti verilmez → yönetici kipi açılamaz
const srv = await startServer({ ...configFromEnv({ ODI_DB: ':memory:', ODI_TEST_STORE: '1', ODI_RAID_ALWAYS: '1', NODE_ENV: 'test' }), port: await freePort(), host: '127.0.0.1', log: false, sweepMs: 1000 });
const S = { db: srv.app.db, url: srv.url, pid: (name) => srv.app.db.get('SELECT id FROM players WHERE name = ? ORDER BY created_at DESC LIMIT 1', name)?.id };
const wport = await freePort();
const pv = await vite.preview({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: distDir }, preview: { port: wport, strictPort: true, host: '127.0.0.1' } });
const HOST = `http://127.0.0.1:${wport}/`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
const raws = [];
async function shutdown() { for (const c of raws) { try { c.close(); } catch { /* yok */ } } await browser.close().catch(() => undefined); await pv.close().catch(() => undefined); await srv.close().catch(() => undefined); }
process.on('SIGINT', () => { void shutdown().then(() => process.exit(130)); });
process.on('SIGTERM', () => { void shutdown().then(() => process.exit(143)); });

// ---------------------------------------------------------------- kayıt tohumu
const pad2 = (n) => String(n).padStart(2, '0');
const today = (() => { const d = new Date(Date.now() + 3 * 3600_000); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; })();
const TOURS = ['result1', 'map', 'today', 'camp', 'camp-build', 'friends', 'glossary', 'team', 'shop', 'events', 'race', 'yazi', 'akis', 'soru', 'ikili', 'usta', 'siralama', 'tlig', 'tyaris', 'gorev', 'kampoyun', 'vaka'];
const REGIONS = ['dis-kulak', 'kanal', 'zar', 'kemikcikler', 'koklea-1', 'koklea-2', 'koklea-3', 'sinir', 'beyin-sapi', 'korteks'];
const starOf = (i) => (i % 4 === 3 ? 2 : 3);
function richMeta(cleared, seenBiomes) {
  const biomes = seenBiomes ?? [...new Set(DATA.levels.slice(0, cleared).map((l) => l.biome))];
  const cards = DATA.cards.filter((c) => biomes.includes(c.biome)).filter((_, i) => i % 5 !== 4).map((c) => c.id);
  const ach = Object.fromEntries(DATA.achievements.slice(0, 18).map((a, i) => [a, (i % 3) + 1]));
  const owned = ['renk-mor', 'renk-turkuaz', 'renk-mercan', 'renk-amber', 'sapka-yok', 'sapka-bere', 'sapka-nota', 'sapka-kulaklik'];
  return { stats: { plays: cleared + 14, clears: cleared, fails: 6, coins: cleared * 85, noDamage: 9, underPar: 7, lucky: 2, shares: 1, quests: 21, chests: 6, calendar: 9, maxStreak: 9, maxCombo: 34, comebacks: 3, melody: 3, escort: 2, timed: 4, collectAll: 4, perfect: 30, shieldsEarned: 3, days: 12 },
    feats: {}, daily: null, calendar: { lastClaim: '' }, shields: 1, achievements: ach, cards, cosmetics: { owned, color: 'renk-turkuaz', hat: 'sapka-kulaklik' },
    seenBiomes: biomes, firsts: [], treasures: [5, 10, 15, 20, 25, 30, 35, 40].filter((t) => t <= cleared), albumBadges: biomes.slice(0, 2), ledger: [] };
}
/** yerel kayıt (odi-v1): cleared bölüm geçilmiş, ilk deneyim tamamlanmış (bütün turlar görülmüş) */
function save(cleared, { meta = null, extra = {} } = {}) {
  const progress = {}; for (let i = 1; i <= cleared; i++) progress[i] = { stars: starOf(i), best: 900 + i * 37, plays: 1 + (i % 3) };
  return { state: { journey: 'insan', progress, coins: 640 + cleared * 45, xp: 400 + cleared * 260, streak: 6, lastDay: today, failStreak: 0, recentStars: [3, 3, 3], sounds: false,
    ftue: { v: 1, story: true, tours: TOURS, bypass: true }, meta: meta ?? richMeta(cleared), notesSeen: [], ...extra }, version: 3 };
}
const mapSeen = (cleared, restored) => ({ state: { init: true, stars: Object.fromEntries(Array.from({ length: cleared }, (_, i) => [i + 1, starOf(i + 1)])), restored }, version: 1 });

// ---------------------------------------------------------------- sayfa yardımcıları
const S0 = SIZES[0][1];
async function newPage({ seed = null, ls = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: S0.w, height: S0.h }, deviceScaleFactor: DSF, isMobile: true, hasTouch: true, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  await ctx.addInitScript(([s, extra, top, bottom]) => {
    try {
      if (!sessionStorage.getItem('__tohum')) {
        sessionStorage.setItem('__tohum', '1');
        if (s) localStorage.setItem('odi-v1', JSON.stringify(s));
        for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      }
    } catch { /* depolama yok */ }
    // mobil köprünün yaptığı gibi güvenli alan değişkenleri (web hedefi)
    const set = () => { const de = document.documentElement; if (!de) return false; de.style.setProperty('--safe-top', `${top}px`); de.style.setProperty('--safe-bottom', `${bottom}px`); return true; };
    if (!set()) document.addEventListener('DOMContentLoaded', set);
    if (typeof window.SpeechSynthesisUtterance === 'undefined') window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  }, [seed, ls, S0.top, S0.bottom]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`sayfa hatası: ${String(e.message).slice(0, 160)}`));
  return { ctx, page };
}
const url = (q = '') => `${HOST}?sunucu=${encodeURIComponent(S.url)}${q ? `&${q}` : ''}`;
const tab = (page, id) => page.locator(`nav.tabbar .tab[data-tab="${id}"]`).click();
const toastGone = async (page) => { for (let i = 0; i < 10 && await page.locator('.toast-top').count(); i++) { await page.locator('.toast-top').first().click({ timeout: 500 }).catch(() => undefined); await sleep(200); } };
const closeBanners = async (page) => { for (let i = 0; i < 6 && await page.locator('.fr-banner-x').count(); i++) await page.locator('.fr-banner-x').first().click({ timeout: 800 }).catch(() => undefined); };
/** kutlamalar kuyruk halinde gelir: 1,6 sn boyunca yeni kutlama çıkmayana dek kapat; sonra bildirimleri kapat */
async function settle(page) {
  let quiet = 0;
  for (let i = 0; i < 60 && quiet < 4; i++) {
    if (!(await page.locator('.cel-root.on').count())) { quiet++; await sleep(400); continue; }
    quiet = 0;
    const cta = page.locator('.cel-cta button');
    if (await cta.count() && await cta.first().isVisible()) await cta.first().click().catch(() => undefined); else await page.mouse.click(40, 300).catch(() => undefined);
    await sleep(500);
  }
  await toastGone(page); await closeBanners(page);
}
async function enter(page, name) {
  await page.getByRole('button', { name: /Devam et|Yola çık/ }).click({ timeout: 60_000 });
  await page.locator('nav.tabbar').waitFor({ timeout: 30_000 });
  for (let i = 0; i < 20; i++) {
    if (await page.locator('.onboard').count()) { await page.getByRole('textbox', { name: 'Takma ad' }).fill(name); await page.getByRole('button', { name: 'Başla' }).click(); await page.locator('.onboard').waitFor({ state: 'detached' }).catch(() => undefined); break; }
    await sleep(300);
  }
  let pid = null; for (let i = 0; i < 60 && !(pid = S.pid(name)); i++) await sleep(250);
  if (!pid) throw new Error(`oyuncu sunucuda yok: ${name}`);
  await settle(page);
  return pid;
}
const net = (page, op, data = {}) => page.evaluate(([o, d]) => window.__etkinlik.net().call(o, d), [op, data]);
function rawClient(wsUrl) {
  const ws = new WebSocket(wsUrl); let id = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.t === 'res') { const p = pend.get(m.id); pend.delete(m.id); if (!p) return; if (m.ok) p.res(m.data); else p.rej(new Error(`${m.code}: ${m.error}`)); } };
  const ready = new Promise((r) => { ws.onopen = r; });
  const call = async (op, data = {}) => { await ready; return new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ t: 'req', id: i, op, data })); }); };
  const c = { call, close: () => ws.close() }; raws.push(c); return c;
}
const runOf = (level, over = {}) => ({ runId: `vit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, level, completed: true, stars: starOf(level), score: 1500 + level * 40, timeSec: 60, coins: 80, biome: LV(level).biome, mechanic: LV(level).mechanic, ...over });

// ---------------------------------------------------------------- çekim: temiz kare denetimi + üç boyut
/** karede olmaması gerekenler: bildirim, yükleniyor, hata, çevrimdışı, yönetici, önizleme */
const FORBIDDEN = ['.toast-top', '.fr-banner', '[data-testid="iletisim-bildirimi"]', '[data-testid="mesaj-bildirimi"]', '.net-banner', '.offline-card', '.camp-loading', '.engine-loading', '[aria-busy="true"]',
  '.chat-err', '.ev-err', '.race-error', '.race-error-inline', '.vr-err', '[role="alert"]', '[data-testid="yonetici-rozet"]', '.camp-demo-tag', '.cel-root.on', '.coach-ring', '[data-testid="anlatici"]'];
function dirty(sels) {
  const vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05; };
  const out = [];
  for (const s of sels) for (const el of document.querySelectorAll(s)) if (vis(el)) out.push(`${s} “${(el.textContent || '').trim().slice(0, 40)}”`);
  const txt = document.body.innerText || '';
  for (const w of ['Yükleniyor', 'ÖNİZLEME', 'Yönetici modu', 'Bağlantı koptu', 'Sunucuya bağlanılamadı']) if (txt.includes(w)) out.push(`metin: ${w}`);
  return out;
}
/** sonlu animasyonlar (ekran girişi, kart açılışı…) bitsin, yazı tipleri ve resimler yüklensin; en çok ms */
async function calm(page, ms = 5000) {
  await page.evaluate(async (lim) => {
    const cap = (p) => Promise.race([p, new Promise((r) => setTimeout(r, lim))]);
    await cap(document.fonts ? document.fonts.ready : Promise.resolve());
    await cap(Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))));
    const fin = document.getAnimations().filter((a) => { try { return a.playState === 'running' && Number.isFinite(a.effect.getComputedTiming().endTime); } catch { return false; } });
    await cap(Promise.all(fin.map((a) => a.finished.catch(() => undefined))));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, ms).catch(() => undefined);
  await sleep(450);
}
/** bir kareyi her boyutta çek. prep(page, boyut): yeniden boyutlandırmadan sonra (ör. kaydırma) */
async function shoot(page, nn, slug, meta, { prep = null, clean = FORBIDDEN, settleMs = 900 } = {}) {
  for (const [key, Z] of SIZES) {
    await page.setViewportSize({ width: Z.w, height: Z.h });
    await page.evaluate(([t, b]) => { document.documentElement.style.setProperty('--safe-top', `${t}px`); document.documentElement.style.setProperty('--safe-bottom', `${b}px`); window.dispatchEvent(new Event('resize')); }, [Z.top, Z.bottom]);
    await sleep(settleMs);
    if (prep) await prep(page, Z);
    let bad = [];
    for (let i = 0; i < 4; i++) {
      await calm(page);
      bad = await page.evaluate(dirty, clean);
      if (!bad.length) break;
      await toastGone(page); await closeBanners(page); await sleep(1200);
    }
    if (bad.length) throw new Error(`${nn}-${slug} (${key}): karede istenmeyen öğe: ${bad.slice(0, 3).join(' | ')}`);
    const dir = resolve(OUT, Z.dir); mkdirSync(dir, { recursive: true });
    const file = resolve(dir, `${nn}-${slug}.png`);
    await page.screenshot({ path: file, type: 'png' });
    log(`📸 ${Z.dir}/${nn}-${slug}.png`);
  }
  shots.push({ nn, slug, ...meta });
}
const step = async (name, fn) => {
  if (!want(name)) return;
  log(`▶ ${name}`); const t = Date.now();
  try { await fn(); log(`✓ ${name} (${Math.round((Date.now() - t) / 1000)} sn)`); } catch (e) { problems.push(`${name}: ${String(e?.message ?? e).split('\n')[0]}`); log(`✗ ${name}: ${String(e?.message ?? e).split('\n')[0]}`); }
};

// ================================================================ 01 · bölüm oynanışı
/** sayfada: bot oynarken Odi'nin önünde en az 4 toplanmamış nota/jeton ve en az bir engel (diken, gürültü, dişli, düşman) görününce
 *  sahneyi durdur. Simülasyon sabit adımlı (DT = 1/60) ve bot belirlenimci: 1. geçiş (düşük çözünürlük) anı arar ve adım numarasını
 *  (sim.n) verir; 2. geçiş (hd = 3) aynı adıma kadar koşar ve orada durur. Arama, önünde engel ve nota olan yerlere yaklaşırken kare
 *  başına tek adım koşturur (duvar saati kancası: LevelScene botu duvar saatiyle ilerletir) ve her adımdan sonra koşulu denetler. */
function armMoment([minT, target]) {
  const sc = globalThis.__odiScene; if (!sc || window.__vit) return;
  const V = window.__vit = { paused: null, fine: 0 };
  const scan = (x0, x1, y0, y1) => {
    const s = sc.sim; const h = s.hero; let pick = 0, danger = 0;
    for (const e of sc.world.ents) {
      if (e.l < x0 || e.r > x1 || e.t < y0 || e.b > y1) continue;
      if ((e.type === 'coin' || e.type === 'note' || e.type === 'collect') && !s.collected.has(e.id) && e.x > h.x) pick++;
      if ((e.cls === 'hazard' || e.cls === 'enemy') && e.l > h.x + 30 && !s.killed.has(e.id) && !s.broken.has(e.id)) danger++;
    }
    return { pick, danger };
  };
  // kameranın oturacağı yer (LevelScene.syncCamera hedefi; kamera kare süresine bağlı yumuşak izler, düşük kare hızında geride kalır)
  const ideal = () => { const h = sc.sim.hero; const x = h.x - (h.dir > 0 ? 390 * 0.32 : 390 * 0.68); const y = h.y - 780 * 0.66; return { x, y, right: x + 390, bottom: y + 780 }; };
  const stop = () => {
    const s = sc.sim; sc.scene.pause();
    const cam = sc.cameras.main; try { cam.shakeEffect.reset(); cam.flashEffect.reset(); } catch { /* yok */ }
    // kamerayı hedefine oturt (iki geçişte aynı kadraj), arka plan katmanlarını eşitle
    for (let i = 0; i < 40; i++) sc.syncCamera(0.1);
    sc.backdrop?.update(cam);
    const v = { x: cam.scrollX, y: cam.scrollY, right: cam.scrollX + 390, bottom: cam.scrollY + 780 }; const c = scan(v.x + 8, v.right - 8, v.y + 30, v.bottom - 30);
    V.paused = { n: s.n, t: Math.round(s.t * 100) / 100, pick: c.pick, danger: c.danger, x: Math.round(s.hero.x), cam: [Math.round(cam.scrollX), Math.round(cam.scrollY)], fine: V.fine };
  };
  sc.events.on('preupdate', () => {
    if (V.paused || !sc.sim) return;
    if (target != null) { const r = target - sc.sim.n; if (r >= 0 && r <= 14) { sc.lastWall = performance.now(); sc.acc = (r + 0.5) / 60; } return; }
    if (sc.sim.t < minT - 1) return;
    const h = sc.sim.hero; const a = scan(h.x, h.x + 520, h.y - 420, h.y + 300);
    if (a.pick >= 4 && a.danger >= 1) { sc.lastWall = performance.now() - 1000 / 60; V.fine++; }
  });
  sc.events.on('postupdate', () => {
    if (V.paused || !sc.sim) return;
    const h = sc.sim.hero;
    if (target != null) { if (sc.sim.n >= target) stop(); return; }
    if (sc.sim.t < minT) return;
    const v = ideal();
    const { pick, danger } = scan(v.x + 8, v.right - 8, v.y + 30, v.bottom - 30);
    if (pick >= 4 && danger >= 1 && !(h.invuln > 0)) stop();
  });
}
async function levelRun(n, hd, target, dsf) {
  const ctx = await browser.newContext({ viewport: { width: S0.w, height: S0.h }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, locale: 'tr-TR' });
  const page = await ctx.newPage();
  await page.goto(`${HOST}?bot=1&level=${n}&hd=${hd}`, { waitUntil: 'load' });
  await page.waitForFunction(() => globalThis.__odiScene?.sim && window.__odi?.events?.some((e) => e.type === 'started'), null, { timeout: 120_000 });
  await page.evaluate(armMoment, [10, target]);
  let st = null;
  for (let i = 0; i < 240 && !st; i++) {
    await sleep(5000);
    st = await page.evaluate(() => window.__vit?.paused ?? (window.__odi?.done ? { done: true } : null));
    if (!st && i % 6 === 5) log(`  bölüm ${n} (hd ${hd}): sim ${await page.evaluate(() => globalThis.__odiScene?.sim?.t?.toFixed(1))} sn`);
  }
  if (!st || st.done) { await ctx.close(); throw new Error(`bölüm ${n}: an bulunamadı (${st ? 'bot bitirdi' : 'zaman aşımı'})`); }
  return { ctx, page, st };
}
await step('bolum', async () => {
  const n = PLAY_LEVEL;
  const a = await levelRun(n, 1, null, 1); await a.ctx.close();
  log(`bölüm ${n}: an adım ${a.st.n} (t=${a.st.t} sn, nota ${a.st.pick}, engel ${a.st.danger})`);
  const { ctx, page, st } = await levelRun(n, DSF, a.st.n, DSF);
  if (st.x !== a.st.x || st.n !== a.st.n) problems.push(`bölüm: 2. geçiş farklı yerde durdu (adım ${st.n}/${a.st.n}, x ${st.x}/${a.st.x})`);
  log(`bölüm ${n}: hd ${DSF} adım ${st.n}, nota ${st.pick}, engel ${st.danger}`);
  await sleep(600);
  await shoot(page, '01', 'bolum', { title: 'Bölüm oynanışı', level: n, levelName: LV(n).name, moment: st }, { settleMs: 1500 });
  await ctx.close();
});

// ================================================================ P1: harita, kamp, hikâye, vaka, defter, sohbet, Tüy Dede notu (tek oyuncu)
const P1_CLEARED = 23; // 24. bölüm Koklea'nın orta kıvrımına girer (Tüy Dede notu)
const p1Seen = [...new Set(DATA.levels.slice(0, P1_CLEARED).map((l) => l.biome))];
const needP1 = ['harita', 'kamp', 'hikaye', 'vaka', 'defter', 'sohbet', 'dede'].some(want);
let P1 = null;
if (needP1) {
  log('▶ oyuncu hazırlanıyor');
  const restored = p1Seen.filter((b) => b !== 'koklea-1');
  const { ctx, page } = await newPage({ seed: save(P1_CLEARED, { meta: richMeta(P1_CLEARED, p1Seen) }), ls: { 'odi-map-seen': mapSeen(P1_CLEARED, restored), 'odi.kamp.anitlar': REGIONS.filter((r) => p1Seen.includes(r) || r === 'koklea-2') } });
  await page.goto(url('harita=tam'), { waitUntil: 'load' });
  const pid = await enter(page, AD.ben);
  // sunucu: ilerleme gerçek progress.submit çağrılarıyla; kamp, cüzdan ve görevler doğrudan veritabanına (ui-mobile-check ile aynı yol)
  for (let l = 1; l <= P1_CLEARED; l++) await net(page, 'progress.submit', runOf(l, { coins: 30 })).catch(() => undefined);
  const lvOf = (b) => (b.campLevel ? (CAMP_LV >= b.campLevel ? Math.max(3, Math.min(b.maxLevel, MERKEZ - 2 - Math.round((b.campLevel - 2) / 3))) : 0) : b.id === 'merkez' ? MERKEZ : Math.max(1, MERKEZ - ({ laboratuvar: 0, depo: 1, kule: 2, atolye: 1, revir: 0, tedavi: 2 }[b.id] ?? 1)));
  for (const b of DATA.buildings) S.db.run('UPDATE buildings SET level = ?, upgrading_to = NULL, started_at = NULL, ends_at = NULL WHERE player_id = ? AND id = ?', lvOf(b), pid, b.id);
  S.db.run('INSERT INTO camp_xp(player_id, xp, lib_at) VALUES(?, ?, ?) ON CONFLICT(player_id) DO UPDATE SET xp = excluded.xp, lib_at = excluded.lib_at', pid, DATA.campXp, Date.now() - 5 * 3_600_000);
  const inv = {};
  for (const r of DATA.rewards) { S.db.run('INSERT OR IGNORE INTO camp_unlocks(player_id, ref, at) VALUES(?, ?, ?)', pid, `kseviye:${r.l}`, Date.now()); if (r.kind === 'sus') inv[r.id] = (inv[r.id] ?? 0) + r.n; }
  for (let l = 1; l <= CAMP_LV; l++) S.db.run('INSERT OR IGNORE INTO camp_unlocks(player_id, ref, at) VALUES(?, ?, ?)', pid, `kseviye:${l}`, Date.now());
  let placed = 0;
  for (const [id, n] of Object.entries(inv)) {
    let left = n;
    if (placed < Math.min(DATA.spots.length, DATA.slots - 1)) { const [gx, gy] = DATA.spots[placed]; S.db.run('INSERT INTO decor_placed(player_id, id, gx, gy, flip, at) VALUES(?, ?, ?, ?, ?, ?)', pid, id, gx, gy, placed % 2, Date.now()); placed++; left--; }
    if (left > 0) S.db.run('INSERT INTO decor_inv(player_id, id, n) VALUES(?, ?, ?) ON CONFLICT(player_id, id) DO UPDATE SET n = excluded.n', pid, id, left);
  }
  S.db.run('INSERT INTO remedy_prod(player_id, item, since) VALUES(?, ?, ?) ON CONFLICT(player_id) DO UPDATE SET item = excluded.item, since = excluded.since', pid, 'ventilasyon-tupu', Date.now() - 20 * 60_000);
  for (const [id, n] of [['kulak-tikaci', 3], ['serumen-damlasi', 2]]) S.db.run('INSERT INTO remedy_inv(player_id, id, n) VALUES(?, ?, ?) ON CONFLICT(player_id, id) DO UPDATE SET n = excluded.n', pid, id, n);
  S.db.run('UPDATE players SET jeton = ?, kristal = ? WHERE id = ?', 18_450, 320, pid); srv.app.walletChanged(pid);
  // süren bir inşaat (iskele ve İnşaatçı çipi; "İnşaatçı boşta" ipucu yerine)
  { const b = DATA.buildings.find((x) => x.id === 'kule'); const t = Date.now(); S.db.run('UPDATE buildings SET upgrading_to = ?, started_at = ?, ends_at = ? WHERE player_id = ? AND id = ?', lvOf(b) + 1, t - 40 * 60_000, t + 2 * 3600_000 + 15 * 60_000, pid, 'kule'); }
  // Vaka Defteri: kademe 1–2'den on vaka çözülmüş (kliniğin bekleme salonunda sıradaki hastalar)
  DATA.vakalar.filter((v) => v.kademe <= 2).slice(0, 10).forEach((v, i) => S.db.run('INSERT OR IGNORE INTO kv_book(player_id, case_id, stars, plays, solved_at, tests) VALUES(?, ?, ?, ?, ?, ?)', pid, v.id, i % 3 === 2 ? 2 : 3, 1 + (i % 2), Date.now() - (12 - i) * 3600_000, 4));
  // Kampın Hikâyesi: ilk üç bölüm tamamlanmış (4. bölüm sürüyor)
  for (let i = 1; i <= 3; i++) S.db.run("INSERT OR IGNORE INTO kg_claim(player_id, ref, at, reward) VALUES(?, ?, ?, '{}')", pid, `hikaye:${i}`, Date.now());
  // tohumlanan seviyeler kutlama olarak oynamasın: sayfayı yeniden aç, kuyruğu boşalt
  await page.reload({ waitUntil: 'load' }); await page.getByRole('button', { name: /Devam et|Yola çık/ }).click({ timeout: 60_000 });
  await page.locator('nav.tabbar').waitFor({ timeout: 30_000 }); await sleep(1500); await settle(page);
  P1 = { ctx, page, pid };
}
const openCamp = async (page) => {
  await tab(page, 'map'); await sleep(500); await tab(page, 'camp'); await sleep(800);
  const ub = page.getByRole('button', { name: 'Üs görünümü' }); if (await ub.count()) await ub.click();
  await page.locator('.camp-base').waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => !!window.__kamp && !!window.__kamp.pos('merkez'), null, { timeout: 30_000 });
  await page.locator('.camp-loading').waitFor({ state: 'detached', timeout: 30_000 }).catch(() => undefined);
  await sleep(2500); await settle(page);
};

await step('harita', async () => {
  const { page } = P1;
  await tab(page, 'map'); await page.locator('.map-stage canvas').waitFor({ timeout: 30_000 }); await sleep(3500); await settle(page);
  await shoot(page, '02', 'harita', { title: 'Yaşayan Kulak Haritası', cleared: P1_CLEARED }, { settleMs: 2200 });
});
/** kamp sahnesi ilk yakınlaştırmayı açılıştaki görünüm boyutundan seçer: her boyutta kampı yeniden aç (cihazdaki gibi), sonra oyuncu
 *  hareketiyle çerçevele: tekerlekle yakınlaştır (görünür genişlik ~450 birim), sürükleyerek Odyoloji Merkezi'ni ortaya al
 *  (uzun ekranlarda kampın altı boş deniz kalmasın) */
async function campFrame(page, Z) {
  await openCamp(page);
  await page.locator('[data-testid="kamp-dede"] .en-x, .dede-card .en-x').first().click({ timeout: 800 }).catch(() => undefined);
  const cx = Math.round(Z.w / 2), cy = Math.round(Z.h * 0.5);
  const z0 = (await page.evaluate(() => window.__kamp.view()))?.zoom ?? 1;
  const k = Math.round(Math.log(Z.w / 450 / z0) / Math.log(1.1));
  await page.mouse.move(cx, cy);
  for (let i = 0; i < Math.abs(k); i++) { await page.mouse.wheel(0, k > 0 ? -100 : 100); await sleep(250); }
  for (let pass = 0; pass < 2; pass++) {
    const p = await page.evaluate(() => window.__kamp.pos('merkez')); if (!p) break;
    const dx = Math.round(cx - p.x), dy = Math.round(Z.h * 0.47 - p.y);
    if (Math.abs(dx) + Math.abs(dy) < 12) break;
    const sx = cx - Math.round(dx / 2), sy = Math.round(Z.h * 0.55 - dy / 2);
    await page.mouse.move(sx, sy); await page.mouse.down();
    for (let i = 1; i <= 24; i++) { await page.mouse.move(sx + (dx * i) / 24, sy + (dy * i) / 24); await sleep(30); }
    await sleep(400); await page.mouse.up(); await sleep(1500);
  }
  await settle(page);
}
await step('kamp', async () => {
  const { page } = P1;
  await shoot(page, '03', 'kamp', { title: 'Kulak Kampı', merkez: MERKEZ, campLevel: CAMP_LV }, { prep: campFrame, settleMs: 600 });
});
await step('hikaye', async () => {
  const { page } = P1;
  if (!(await page.locator('.camp-base').count())) await openCamp(page);
  await page.evaluate(() => window.__kg?.refresh()); await page.getByTestId('kg-btn').waitFor({ timeout: 15_000 }); await sleep(800); await settle(page);
  await page.getByTestId('kg-btn').click(); await page.getByTestId('kg-panel').waitFor();
  await page.locator('.kg-tabs [data-tab="hikaye"]').click(); await page.locator('[data-testid="kg-story"]').first().waitFor({ timeout: 10_000 }); await sleep(800);
  await shoot(page, '04', 'hikaye', { title: 'Kampın Hikâyesi' }, { prep: async (p) => { await p.locator('.kg-sheet').evaluate((el) => { for (const s of [el, ...el.querySelectorAll('*')]) if (s.scrollTop) s.scrollTop = 0; }).catch(() => undefined); } });
  await page.locator('.kg-sheet .bp-x').click(); await sleep(400);
});
await step('vaka', async () => {
  const { page } = P1;
  if (!(await page.locator('.camp-base').count())) await openCamp(page);
  await page.getByTestId('klinik-btn').click(); await page.getByTestId('klinik-panel').waitFor(); await sleep(600);
  await page.locator('.kg-hasta-kart').first().click(); await page.getByTestId('hasta-adim').waitFor(); await sleep(600);
  await page.getByTestId('testlere-gec').click();
  for (const tt of ['otoskopi', 'odyometri', 'timpanometri', 'refleks']) await page.locator(`.kg-test[data-test="${tt}"]`).click();
  await sleep(500);
  await shoot(page, '09', 'vaka', { title: 'Hasta vakası: test sonuçları' }, { prep: async (p) => { await p.locator('[data-sonuc="odyometri"]').scrollIntoViewIfNeeded(); await sleep(300); } });
  // vakayı bitir (Vaka Defteri dolsun): karar → tanı ve yönlendirme
  await page.getByTestId('karara-gec').click(); await page.getByTestId('tani-adim').waitFor();
  await page.locator('.kg-opt[data-dx]').first().click(); await page.locator('.kg-opt[data-mg]').first().click();
  await page.getByTestId('karar-gonder').click(); await page.getByTestId('vaka-sonuc').waitFor(); await sleep(900); await settle(page);
  await page.locator('.cel-root.on').waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
  await page.locator('.kg-sheet .bp-x').click(); await sleep(400); await settle(page);
});
await step('defter', async () => {
  const { page } = P1;
  if (!(await page.locator('.camp-base').count())) await openCamp(page);
  await page.getByTestId('klinik-btn').click(); await page.getByTestId('defter-tab').click(); await page.getByTestId('vaka-defteri').waitFor(); await sleep(700);
  await shoot(page, '10', 'defter', { title: 'Vaka Defteri' });
  await page.locator('.kg-sheet .bp-x').click(); await sleep(400);
});
await step('sohbet', async () => {
  const { page } = P1;
  const team = (await net(page, 'team.create', TEAM)).team;
  const mates = [];
  for (const [nm, lv, col] of [[AD.zar, 26, 0x2ec4b6], [AD.ors, 19, 0xffb347], [AD.sal, 12, 0x9b7bff]]) {
    const c = rawClient(S.url); await c.call('hello', { version: 1, name: nm }); await c.call('profile.update', { name: nm, color: col }).catch(() => undefined);
    for (let l = 1; l <= lv - 2; l++) await c.call('progress.submit', runOf(l));
    await c.call('team.join', { code: team.code }); await c.call('chat.join', { room: `takim:${team.id}` }).catch(() => undefined);
    mates.push({ c, nm, lv });
  }
  await page.evaluate(async () => { const e = window.__etkinlik; const t = await e.net().call('team.detail', {}); e.netStore.setState({ team: t.team }); });
  await tab(page, 'team'); await page.locator('.team-head').waitFor({ timeout: 15_000 });
  await page.locator('.subtabs .subtab', { hasText: 'Sohbet' }).first().click(); await page.locator('.chat-box').waitFor({ timeout: 10_000 });
  const room = `takim:${team.id}`;
  const say = async (m, id) => { await m.c.call('chat.send', { room, text: id, kind: 'hazir' }); await sleep(900); };
  // gerçek ilerleme: takım arkadaşları yeni bölümler geçer → akış kartları; aralarda yalnız hazır sözler
  await say(mates[0], 'selam');
  await mates[0].c.call('progress.submit', runOf(mates[0].lv - 1)); await sleep(900);
  await say(mates[1], 'tebrik');
  await say(mates[2], 'birlikte');
  await mates[1].c.call('progress.submit', runOf(mates[1].lv - 1)); await sleep(900);
  await say(mates[0], 'hedef');
  await say(mates[2], 'devam');
  await mates[2].c.call('progress.submit', runOf(mates[2].lv - 1)); await sleep(900);
  // sayfadaki oyuncu da hazır söz şeridinden yazar (serbest yazı hiç gönderilmez); şerit açık kalır
  await page.getByRole('button', { name: 'Hazır sözler' }).click(); await page.locator('.quick-line .phrase[data-phrase="harika"]').click(); await sleep(1500);
  await sleep(1200); await settle(page);
  // kendi mesajı serbest yazı değil: hazır söz şeridinden; serbest yazı hiç gönderilmez
  const free = await page.locator('.chat-box [data-kind="text"]').count().catch(() => 0);
  if (free) problems.push(`sohbet: ${free} serbest yazı mesajı görünüyor`);
  await shoot(page, '05', 'sohbet', { title: 'Takım sohbeti', team: TEAM.name }, { prep: async (p) => { await p.locator('.chat-box').evaluate((el) => { el.scrollTop = el.scrollHeight; }).catch(() => undefined); await sleep(300); } });
  for (const m of mates) m.c.close();
});
await step('dede', async () => {
  const { page } = P1;
  await tab(page, 'map'); await page.waitForFunction(() => !!window.__harita, null, { timeout: 30_000 }); await sleep(1500); await settle(page);
  await page.evaluate((k) => window.__harita.card(k), P1_CLEARED + 1); await page.locator('.map-btn.shine').click({ timeout: 15_000 });
  await page.locator('.biome-intro .note-card, .biome-intro [class*="note"]').first().waitFor({ timeout: 20_000 });
  await page.getByRole('button', { name: /Haydi/ }).waitFor({ timeout: 20_000 }); await sleep(2200);
  await shoot(page, '08', 'tuy-dede', { title: "Tüy Dede'nin Notu", level: P1_CLEARED + 1 });
});
if (P1) await P1.ctx.close();

// ================================================================ 07 · sonuç 3 yıldız (gerçek koşu)
await step('sonuc', async () => {
  for (const n of RESULT_LEVELS) {
    const cleared = n - 1;
    const seen = [...new Set(DATA.levels.slice(0, n).map((l) => l.biome))]; // bölge tanıtımı araya girmesin
    const { ctx, page } = await newPage({ seed: save(cleared, { meta: richMeta(cleared, seen) }), ls: { 'odi-map-seen': mapSeen(cleared, seen) } });
    await page.goto(url('oyun-bot=1&oyun-hiz=2'), { waitUntil: 'load' });
    await enter(page, AD.yol);
    await page.waitForFunction(() => !!window.__harita, null, { timeout: 30_000 }); await sleep(1500);
    await page.evaluate((k) => window.__harita.card(k), n); await page.locator('.map-btn.shine').click({ timeout: 15_000 });
    for (let i = 0; i < 8; i++) { const h = page.getByRole('button', { name: /Haydi/ }); if (await h.count()) { await h.click().catch(() => undefined); break; } await sleep(500); }
    for (let i = 0; i < 600 && !(await page.locator('.result-actions').count()); i++) await sleep(500);
    await page.locator('.result-actions').waitFor({ timeout: 5000 });
    await sleep(5000); await settle(page); await sleep(1000);
    const stars = await page.evaluate(() => window.__odi?.result?.stars ?? null);
    log(`sonuç: bölüm ${n} → ${stars} yıldız`);
    if (stars === 3) {
      await shoot(page, '07', 'sonuc', { title: 'Sonuç: 3 yıldız', level: n, levelName: LV(n).name }, { prep: async (p) => { await p.evaluate(() => { document.scrollingElement?.scrollTo(0, 0); for (const el of document.querySelectorAll('.screen, #root')) el.scrollTop = 0; }); } });
      await ctx.close(); return;
    }
    await ctx.close();
  }
  throw new Error(`bot hiçbir adayda 3 yıldız almadı (${RESULT_LEVELS.join(', ')})`);
});

// ================================================================ 06 · canlı yarış (uygulamadaki RaceLobby/LevelHost; botla oynanması için yarış sayfası)
await step('yaris', async () => {
  const yurl = (name, delay) => `${HOST}src/race/dev/yaris.html?ad=${encodeURIComponent(name)}&yaris-bot=1&bot-gecikme=${delay}&sunucu=${encodeURIComponent(S.url)}`;
  const ps = [];
  try {
    for (const [name, delay, col] of [[AD.ben, 0, 0x2ee6d6], [AD.zar, 500, 0xff4f7a], [AD.ors, 1100, 0xffb347]]) {
      const { ctx, page } = await newPage({ seed: save(14, { extra: { odiColor: col, chosenColor: col } }) });
      await page.goto(yurl(name, delay), { waitUntil: 'load' });
      await page.waitForFunction((nm) => window.__yaris?.net()?.me?.name === nm, name, { timeout: 30_000 });
      await page.evaluate((c) => window.__yaris.net().call('profile.update', { color: c }).catch(() => undefined), col);
      ps.push({ name, ctx, page });
    }
    const [A, B, C] = ps;
    await A.page.getByTestId('yaris-oda-kur').click(); await A.page.locator('[data-testid^="yaris-seviye-"]').first().waitFor();
    if (await A.page.getByTestId('yaris-seviye-12').count()) await A.page.getByTestId('yaris-seviye-12').click(); else await A.page.locator('[data-testid^="yaris-seviye-"]').nth(3).click();
    await A.page.getByTestId('yaris-kod').waitFor(); const code = await A.page.getByTestId('yaris-kod').getAttribute('data-code');
    for (const P of [B, C]) { await P.page.getByTestId('yaris-kod-gir').click(); await P.page.getByTestId('yaris-kod-input').fill(code); await P.page.getByTestId('yaris-kod-katil').click(); }
    for (const P of ps) await P.page.waitForFunction(() => document.querySelectorAll('[data-testid="yaris-oyuncu"]').length === 3, null, { timeout: 15_000 });
    // oda sohbetinde yalnız hazır sözler (sonuç ekranında da görünür)
    await A.page.locator('[data-testid="yaris-sohbet"] .phrase[data-phrase="selam"]').click().catch(() => undefined); await sleep(900);
    await C.page.locator('[data-testid="yaris-sohbet"] .phrase[data-phrase="iyi-sans"]').click().catch(() => undefined); await sleep(900);
    // yarış odası: iki rakip hazır, sayfadaki oyuncu henüz değil (yarış başlamaz). Yarış içi ve sonuç karesi çekilmez: bot kipinde oyun
    // tuvali 1x çizilir (mağaza boyutunda bulanık), yüklü makinede botlar süre sınırında bitiremeyebilir ("Bitiremedi").
    for (const P of [B, C]) await P.page.getByTestId('yaris-hazir').click();
    await A.page.waitForFunction(() => document.querySelectorAll('[data-testid="yaris-oyuncu"]').length === 3 && /2\/3 hazır/.test(document.body.innerText), null, { timeout: 15_000 }).catch(() => undefined);
    await sleep(800); await settle(A.page);
    await shoot(A.page, '06', 'yaris', { title: 'Canlı yarış odası', players: ps.map((p) => p.name) }, { prep: async (p) => { await p.evaluate(() => { document.scrollingElement?.scrollTo(0, 0); for (const el of document.querySelectorAll('.screen, #root')) el.scrollTop = 0; }); } });
  } finally { for (const P of ps) await P.ctx.close().catch(() => undefined); }
});

// ---------------------------------------------------------------- özet
await shutdown();
const man = { olusturma: new Date().toISOString(), boyutlar: Object.fromEntries(SIZES.map(([k, Z]) => [k, `${Z.w * DSF}×${Z.h * DSF}`])), kareler: shots.sort((a, b) => a.nn.localeCompare(b.nn)), sorunlar: problems };
mkdirSync(OUT, { recursive: true }); writeFileSync(resolve(OUT, 'vitrin.json'), JSON.stringify(man, null, 1));
for (const p of problems) log(`⚠ ${p}`);
log(`${shots.length} kare × ${SIZES.length} boyut → ${OUT}`);
process.exit(problems.length ? 1 : 0);
