#!/usr/bin/env node
/**
 * Reels (4. dalga) için oyunun gerçek arayüz ekranları: sonuç ekranları (gerçek koşu), Kulak Kartları, Tedavi Odası tarifleri, takım
 * akışı (keşif listesi, başvuru, kabul, üyeler, hazır sözlerle sohbet, takım yarışı lobisi ve yarış, baskın). Sahte ekran yok.
 * Yol vitrin.mjs ile aynı: web test derlemesi (VITE_ODI_E2E=1) + aynı süreçte gerçek sunucu (bellek içi veritabanı) + yerel kayıt tohumu.
 * Oyuncular kurgusal, kulak temalı takma adlardır (gerçek kişi adı değil). Yönetici kipi KULLANILMAZ; ?demo önizlemesi kullanılmaz.
 * Her kare öncesi: yazı tipleri ve resimler yüklü, sonlu animasyonlar bitmiş; bildirim, yükleniyor, hata, yönetici öğesi görünürse
 * kare yeniden denenir, olmazsa bölüm hata verir.
 *
 * Kullanım: PLAYWRIGHT_CHROMIUM=… node tools/reels/cekim4.mjs [--only sonuc,kart,tedavi,takim] [--no-build]
 * Çıktı: tools/harness/out/reels4/cekim/<bölüm>/<ad>.png (390×844 görünüm, ×3 = 1170×2532)
 *   sonuc   --bolum N (varsayılan 4), --mod zipla|bos: önce başarısız koşu → "Bu sefer olmadı" (üstten ve teşvik satırına kaydırılmış: -alt), sonra bot → 3 yıldız
 *   kart    Kulak Kartları albümü (Kemikçikler) ve üç kart: En Küçük Kemik, Minik Koruyucu Kas, Kulağın Yankısı
 *   tedavi  Tedavi Odası: Kulak tıkacı ve Ses üreteci tarif kartları
 *   takim   "Sessiz Operasyon" takımı: keşif, başvuru, kabul, üyeler (Lider/Yardımcı), sohbet (hazır sözler), takım yarışı, baskın
 */
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
const WORK = resolve(root, 'tools/harness/out/reels4'); mkdirSync(WORK, { recursive: true });
const OUT = resolve(WORK, 'cekim');
const ONLY = opt('only', '') ? opt('only').split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);
const VW = 390, VH = 844, DSF = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(`[çekim4 ${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s]`, ...a);
const problems = []; const shots = [];

// kurgusal, kulak temalı takma adlar (gerçek kişi adı değil)
const AD = { lider: 'Örs Kaptan', yardimci: 'Zar Ustası', hizli: 'Hızlı Lif', usta: 'Koklea Kâşifi', caylak: 'Minik Nota', solo: 'Nota Avcısı' };
const TEAM = { name: 'Sessiz Operasyon', emblem: '🦉', description: 'Hedef: Gürültü Canavarı. Her akşam birlikte.' };
const OTHERS = [
  { lead: 'Davulcu Zar', name: 'Zar Davulcuları', emblem: '🎵', description: 'Titreşimi seven herkese açık.', open: true, lv: 22 },
  { lead: 'Bas Baykuşu', name: 'Bas Baykuşları', emblem: '🦉', description: 'Alçak frekansların ustaları.', open: false, lv: 30 },
  { lead: 'Kıvrım Kuşu', name: 'Koklea Kaşifleri', emblem: '🐚', description: 'Kulaktan beyne, hep birlikte.', open: true, lv: 18 },
];

// ---------------------------------------------------------------- içerik verisi
const veriFile = resolve(WORK, 'veri.mjs');
await build({
  stdin: { contents: `
    import { HUMAN_JOURNEY, CARDS, ACHIEVEMENTS } from '@odi/content';
    import { generateLevel } from '@odi/level-gen';
    import { DEFAULT_SKILLS } from '@odi/content';
    const levels = HUMAN_JOURNEY.levels.map((_, i) => { const s = generateLevel(HUMAN_JOURNEY.id, i + 1, { recentStars: 3, failStreak: 0, skills: DEFAULT_SKILLS }); return { n: i + 1, biome: s.biome, mechanic: s.mechanic, name: s.name }; });
    console.log(JSON.stringify({ levels, cards: CARDS.map((c) => ({ id: c.id, biome: c.biome, title: c.title })), achievements: ACHIEVEMENTS.map((a) => a.id) }));
  `, resolveDir: resolve(root, 'tools/harness'), loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', outfile: veriFile, logLevel: 'warning',
});
const { spawnSync } = await import('node:child_process');
const DATA = JSON.parse(spawnSync(process.execPath, [veriFile], { encoding: 'utf8', maxBuffer: 64 << 20 }).stdout);
const LV = (n) => DATA.levels[n - 1];

// ---------------------------------------------------------------- derleme, sunucu, önizleme
const vite = await import('vite');
const distDir = resolve(WORK, 'dist');
if (!has('no-build') || !existsSync(resolve(distDir, 'index.html'))) {
  log('web test derlemesi…');
  process.env.VITE_ODI_E2E = '1';
  await vite.build({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: distDir, emptyOutDir: true } });
  delete process.env.VITE_ODI_E2E;
}
const srvFile = resolve(WORK, 'server-inproc.mjs');
await build({ entryPoints: [resolve(root, 'apps/server/src/server.ts')], outfile: srvFile, bundle: true, platform: 'node', target: 'node22', format: 'esm', external: ['bufferutil', 'utf-8-validate'], banner: { js: "import { createRequire as __r } from 'node:module'; const require = __r(import.meta.url);" }, logLevel: 'warning' });
const { startServer, configFromEnv } = await import(pathToFileURL(srvFile).href);
const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
// test mağazası (para çekmez), baskın hep açık; yönetici kodu özeti verilmez → yönetici kipi açılamaz
const srv = await startServer({ ...configFromEnv({ ODI_DB: ':memory:', ODI_TEST_STORE: '1', ODI_RAID_ALWAYS: '1', NODE_ENV: 'test' }), port: await freePort(), host: '127.0.0.1', log: false, sweepMs: 1000, msgPerSec: 400 });
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
const starOf = (i) => (i % 4 === 3 ? 2 : 3);
function richMeta(cleared, { cards = null } = {}) {
  const biomes = [...new Set(DATA.levels.slice(0, cleared).map((l) => l.biome))];
  const own = cards ?? DATA.cards.filter((c) => biomes.includes(c.biome)).filter((_, i) => i % 5 !== 4).map((c) => c.id);
  const ach = Object.fromEntries(DATA.achievements.slice(0, 18).map((a, i) => [a, (i % 3) + 1]));
  const owned = ['renk-mor', 'renk-turkuaz', 'renk-mercan', 'renk-amber', 'sapka-yok', 'sapka-bere', 'sapka-nota', 'sapka-kulaklik'];
  return { stats: { plays: cleared + 14, clears: cleared, fails: 6, coins: cleared * 85, noDamage: 9, underPar: 7, lucky: 2, shares: 1, quests: 21, chests: 6, calendar: 9, maxStreak: 9, maxCombo: 34, comebacks: 3, melody: 3, escort: 2, timed: 4, collectAll: 4, perfect: 30, shieldsEarned: 3, days: 12 },
    feats: {}, daily: null, calendar: { lastClaim: '' }, shields: 1, achievements: ach, cards: own, cosmetics: { owned, color: 'renk-turkuaz', hat: 'sapka-kulaklik' },
    seenBiomes: biomes, firsts: [], treasures: [5, 10, 15, 20, 25, 30, 35, 40].filter((t) => t <= cleared), albumBadges: biomes.slice(0, 2), ledger: [] };
}
function save(cleared, { meta = null, extra = {} } = {}) {
  const progress = {}; for (let i = 1; i <= cleared; i++) progress[i] = { stars: starOf(i), best: 900 + i * 37, plays: 1 + (i % 3) };
  return { state: { journey: 'insan', progress, coins: 640 + cleared * 45, xp: 400 + cleared * 260, streak: 6, lastDay: today, failStreak: 0, recentStars: [3, 3, 3], sounds: false,
    ftue: { v: 1, story: true, tours: TOURS, bypass: true }, meta: meta ?? richMeta(cleared), notesSeen: [], ...extra }, version: 3 };
}
const mapSeen = (cleared, restored) => ({ state: { init: true, stars: Object.fromEntries(Array.from({ length: cleared }, (_, i) => [i + 1, starOf(i + 1)])), restored }, version: 1 });

// ---------------------------------------------------------------- sayfa yardımcıları (vitrin.mjs ile aynı denetimler)
async function newPage({ seed = null, ls = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DSF, isMobile: true, hasTouch: true, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  await ctx.addInitScript(([s, extra]) => {
    try {
      if (!sessionStorage.getItem('__tohum')) {
        sessionStorage.setItem('__tohum', '1');
        if (s) localStorage.setItem('odi-v1', JSON.stringify(s));
        for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      }
    } catch { /* depolama yok */ }
    const set = () => { const de = document.documentElement; if (!de) return false; de.style.setProperty('--safe-top', '47px'); de.style.setProperty('--safe-bottom', '34px'); return true; };
    if (!set()) document.addEventListener('DOMContentLoaded', set);
    if (typeof window.SpeechSynthesisUtterance === 'undefined') window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  }, [seed, ls]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`sayfa hatası: ${String(e.message).slice(0, 160)}`));
  return { ctx, page };
}
const url = (q = '') => `${HOST}?sunucu=${encodeURIComponent(S.url)}${q ? `&${q}` : ''}`;
const tab = (page, id) => page.locator(`nav.tabbar .tab[data-tab="${id}"]`).click();
const toastGone = async (page) => { for (let i = 0; i < 10 && await page.locator('.toast-top').count(); i++) { await page.locator('.toast-top').first().click({ timeout: 500 }).catch(() => undefined); await sleep(200); } };
const closeBanners = async (page) => { for (const sel of ['.fr-banner-x', '.ev-notice-x']) for (let i = 0; i < 6 && await page.locator(sel).count(); i++) await page.locator(sel).first().click({ timeout: 800 }).catch(() => undefined); };
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
const syncTeam = (page) => page.evaluate(async () => { const e = window.__etkinlik; const t = await e.net().call('team.detail', {}); e.netStore.setState({ team: t.team }); });
function rawClient(wsUrl) {
  const ws = new WebSocket(wsUrl); let id = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.t === 'res') { const p = pend.get(m.id); pend.delete(m.id); if (!p) return; if (m.ok) p.res(m.data); else p.rej(new Error(`${m.code}: ${m.error}`)); } };
  const ready = new Promise((r) => { ws.onopen = r; });
  const call = async (op, data = {}) => { await ready; return new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ t: 'req', id: i, op, data })); }); };
  const c = { call, close: () => ws.close() }; raws.push(c); return c;
}
async function rawPlayer(name, lv, color) {
  const c = rawClient(S.url); await c.call('hello', { version: 1, name }); await c.call('profile.update', { name, color }).catch(() => undefined);
  for (let l = 1; l <= lv; l++) await c.call('progress.submit', runOf(l));
  return c;
}
const runOf = (level, over = {}) => ({ runId: `r4-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, level, completed: true, stars: starOf(level), score: 1500 + level * 40, timeSec: 60, coins: 80, biome: LV(level).biome, mechanic: LV(level).mechanic, ...over });

const FORBIDDEN = ['.toast-top', '.fr-banner', '[data-testid="iletisim-bildirimi"]', '[data-testid="mesaj-bildirimi"]', '.net-banner', '.offline-card', '.camp-loading', '.engine-loading', '[aria-busy="true"]',
  '.chat-err', '.ev-err', '.race-error', '.race-error-inline', '.vr-err', '[role="alert"]', '[data-testid="yonetici-rozet"]', '.camp-demo-tag', '.cel-root.on', '.coach-ring', '[data-testid="anlatici"]', '.ev-notice'];
function dirty(sels) {
  const vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05; };
  const out = [];
  for (const s of sels) for (const el of document.querySelectorAll(s)) if (vis(el)) out.push(`${s} “${(el.textContent || '').trim().slice(0, 40)}”`);
  const txt = document.body.innerText || '';
  for (const w of ['Yükleniyor', 'ÖNİZLEME', 'Yönetici', 'Bağlantı koptu', 'Sunucuya bağlanılamadı']) if (txt.includes(w)) out.push(`metin: ${w}`);
  return out;
}
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
/** temiz kare: yasak öğe görünürse bekle/kapat/yeniden dene; el verilirse yalnız o öğe */
async function shoot(page, sec, name, { el = null, clean = FORBIDDEN, wait = true } = {}) {
  let bad = [];
  for (let i = 0; i < 5; i++) {
    if (wait) await calm(page);
    bad = await page.evaluate(dirty, clean);
    if (!bad.length) break;
    await toastGone(page); await closeBanners(page); await sleep(1200);
  }
  if (bad.length) throw new Error(`${sec}/${name}: karede istenmeyen öğe: ${bad.slice(0, 3).join(' | ')}`);
  const dir = resolve(OUT, sec); mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${name}.png`);
  if (el) await el.screenshot({ path: file }); else await page.screenshot({ path: file, type: 'png' });
  shots.push(`${sec}/${name}.png`); log(`📸 ${sec}/${name}.png`);
}
const step = async (name, fn) => {
  if (!want(name)) return;
  log(`▶ ${name}`); const t = Date.now();
  try { await fn(); log(`✓ ${name} (${Math.round((Date.now() - t) / 1000)} sn)`); } catch (e) { problems.push(`${name}: ${String(e?.message ?? e).split('\n')[0]}`); log(`✗ ${name}: ${String(e?.message ?? e).split('\n')[0]}`); }
};
const top0 = (p) => p.evaluate(() => { document.scrollingElement?.scrollTo(0, 0); for (const el of document.querySelectorAll('.screen, #root')) el.scrollTop = 0; });
/** sonuç ekranını teşvik satırı ("Yolun %N'… geçtin") yapışkan düğmelerin hemen üstünde tam görünecek kadar kaydırır (en az kaydırma) */
const tesvikGoster = (p) => p.evaluate(() => {
  const els = [...document.querySelectorAll('div, p, section')].filter((e) => /^Yolun %\d/.test(e.textContent.trim()));
  const card = els.at(-1)?.closest('[class]'); const bar = document.querySelector('.result-actions'); if (!card || !bar) return false;
  const sc = [document.scrollingElement, ...document.querySelectorAll('.screen, #root')].find((e) => e && e.scrollHeight > e.clientHeight + 4 && getComputedStyle(e).overflowY !== 'hidden') ?? document.scrollingElement;
  const d = card.getBoundingClientRect().bottom - (bar.getBoundingClientRect().top + 18);
  if (d > 0) sc.scrollTop += d; return d;
});

// ================================================================ sonuç: 5. bölüm, önce başarısız (hep zıplayan), sonra 3 yıldız
/** sayfada: bölüm sahnesi kurulunca planlayıcının kaymalarını zıplamaya çevir (yeniden kurulursa yeniden sarar) */
const ZIPLA = (mode) => { if (window.__zipla) return; window.__zipla = setInterval(() => { const sc = globalThis.__odiScene; const p = sc?.planner; if (!p || p.__z) return; const nx = p.next.bind(p); p.next = mode === 'bos' ? () => ({ down: false, pressed: false, released: false, swipeDown: false, dash: false }) : (st) => { const i = nx(st); return i.swipeDown ? { ...i, swipeDown: false, pressed: true, down: true } : i; }; p.__z = true; }, 20); };
async function playLevel(page, n, { zipla = null } = {}) {
  await page.waitForFunction(() => !!window.__harita, null, { timeout: 30_000 }); await sleep(1500); await settle(page);
  await page.evaluate((k) => window.__harita.card(k), n); await page.locator('.map-btn.shine').click({ timeout: 15_000 });
  if (zipla) await page.evaluate(ZIPLA, zipla);
  for (let i = 0; i < 8; i++) { const h = page.getByRole('button', { name: /Haydi/ }); if (await h.count()) { await h.click().catch(() => undefined); break; } await sleep(500); }
}
async function waitResult(page) {
  for (let i = 0; i < 900 && !(await page.locator('.result-actions').count()); i++) await sleep(500);
  await page.locator('.result-actions').waitFor({ timeout: 5000 });
  await sleep(6000); await settle(page); await sleep(800);
  return page.evaluate(() => window.__odi?.result ?? null);
}
await step('sonuc', async () => {
  const n = Number(opt('bolum', 4)); const cleared = n - 1; const mod = opt('mod', 'bos');
  const seen = [...new Set(DATA.levels.slice(0, n).map((l) => l.biome))];
  // --fs N: kayıttaki üst üste başarısızlık (oyunun uyarlanabilir yardımı 3'te bir kademe kolaylaştırır; docs/12-zorluk-egrisi.md §4)
  const fs0 = Number(opt('fs', 0));
  const { ctx, page } = await newPage({ seed: save(cleared, { meta: richMeta(cleared), extra: { failStreak: fs0 } }), ls: { 'odi-map-seen': mapSeen(cleared, seen) } });
  await page.goto(url('oyun-bot=1&oyun-hiz=2'), { waitUntil: 'load' });
  await enter(page, AD.solo);
  await playLevel(page, n, { zipla: mod });
  const r1 = await waitResult(page); log(`başarısız koşu: ${JSON.stringify({ completed: r1?.completed, stars: r1?.stars, reason: r1?.extra?.reason, pct: r1?.extra?.pct })}`);
  if (r1?.completed) throw new Error(`${mod} koşusu bitirdi (beklenmedi)`);
  await top0(page); await shoot(page, 'sonuc', `L${pad2(n)}-basarisiz${fs0 ? `-fs${fs0}` : ''}`);
  // aynı ekran, oyunun teşvik satırı ("Yolun %N'… geçtin") yapışkan düğmelerin üstünde tam görünecek kadar kaydırılmış
  log(`teşvik satırı için kaydırma: ${await tesvikGoster(page)} px`); await shoot(page, 'sonuc', `L${pad2(n)}-basarisiz-alt${fs0 ? `-fs${fs0}` : ''}`); await top0(page);
  // ikinci koşu: bot (kayar)
  await page.evaluate(() => { clearInterval(window.__zipla); window.__zipla = null; });
  await page.getByRole('button', { name: /Tekrar dene/ }).click();
  for (let i = 0; i < 8; i++) { const h = page.getByRole('button', { name: /Haydi/ }); if (await h.count()) { await h.click().catch(() => undefined); break; } await sleep(500); }
  const r2 = await waitResult(page); log(`bot koşusu: ${JSON.stringify({ completed: r2?.completed, stars: r2?.stars, score: r2?.score })}`);
  await top0(page); await shoot(page, 'sonuc', `L${pad2(n)}-${r2?.stars ?? 0}yildiz${fs0 ? `-fs${fs0}` : ''}`);
  writeFileSync(resolve(OUT, 'sonuc', `sonuc-L${pad2(n)}-${mod}.json`), JSON.stringify({ failStreak: fs0, basarisiz: r1, bot: r2 }, null, 1));
  await ctx.close();
});

// ================================================================ Kulak Kartları
await step('kart', async () => {
  const cleared = 40; const want3 = ['kemikcikler:yildiz', 'kemikcikler:sandik', 'koklea-2:ozel'];
  const meta = richMeta(cleared); meta.cards = [...new Set([...meta.cards, ...want3])];
  const { ctx, page } = await newPage({ seed: save(cleared, { meta }) });
  await page.goto(url(), { waitUntil: 'load' });
  await enter(page, AD.solo);
  await tab(page, 'profile'); await sleep(800);
  await page.locator('[data-tile="album"]').click(); await page.locator('.album-biome').first().waitFor({ timeout: 15_000 }); await sleep(800);
  const sec = page.locator('.album-biome').filter({ hasText: 'Kemikçikler' }).first();
  await sec.scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -120)); await sleep(500);
  await shoot(page, 'kart', 'album-kemikcikler');
  for (const id of want3) {
    const c = DATA.cards.find((x) => x.id === id);
    await page.locator(`.ear-card[aria-label="${c.title}"]`).first().click(); await page.locator('.fact-card').waitFor(); await sleep(700);
    await shoot(page, 'kart', `kart-${id.replace(':', '-')}`);
    await page.locator('.fact-card').getByRole('button', { name: 'Tamam' }).click(); await sleep(400);
  }
  await ctx.close();
});

// ================================================================ Tedavi Odası tarifleri
const BNAME = { merkez: 'Odyoloji Merkezi', laboratuvar: 'Odyometri Odası', atolye: 'İşitme Cihazı Atölyesi', depo: 'Kulak Deposu', kule: 'Timpanometri Kulesi', revir: 'Odyoloji Kliniği', tedavi: 'Tedavi Odası' };
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
await step('tedavi', async () => {
  const cleared = 26; const nm = 'Kampçı Odyolog';
  const { ctx, page } = await newPage({ seed: save(cleared), ls: { 'odi.kamp.anitlar': ['dis-kulak', 'kanal', 'zar', 'kemikcikler', 'koklea-1', 'koklea-2'] } });
  await page.goto(url(), { waitUntil: 'load' });
  const pid = await enter(page, nm);
  for (const b of Object.keys(BNAME)) S.db.run('UPDATE buildings SET level = ?, upgrading_to = NULL, started_at = NULL, ends_at = NULL WHERE player_id = ? AND id = ?', b === 'merkez' ? 10 : 10, pid, b);
  S.db.run('UPDATE players SET jeton = ?, kristal = ? WHERE id = ?', 6000, 400, pid); srv.app.walletChanged?.(pid);
  await page.reload({ waitUntil: 'load' }); await page.getByRole('button', { name: /Devam et|Yola çık/ }).click({ timeout: 45_000 });
  await page.locator('nav.tabbar').waitFor({ timeout: 20_000 }); await sleep(1500); await settle(page);
  await tab(page, 'map'); await sleep(400); await tab(page, 'camp'); await sleep(600);
  const ub = page.getByRole('button', { name: 'Üs görünümü' }); if (await ub.count()) await ub.click();
  await page.locator('.camp-base').waitFor({ timeout: 25_000 }); await page.waitForFunction(() => !!window.__kamp && !!window.__kamp.pos('merkez'), null, { timeout: 25_000 });
  await page.locator('.camp-loading').waitFor({ state: 'detached', timeout: 25_000 }).catch(() => undefined); await sleep(2500); await settle(page);
  await openPanel(page, 'tedavi');
  for (const r of ['kulak-tikaci', 'ses-ureteci']) {
    await page.locator(`[data-recipe="${r}"]`).click(); await sleep(600);
    await page.locator('.tp-info').scrollIntoViewIfNeeded().catch(() => undefined); await sleep(400);
    await shoot(page, 'tedavi', `tarif-${r}`);
    await shoot(page, 'tedavi', `tarif-${r}-kart`, { el: page.locator('.tp-info'), wait: false });
  }
  await ctx.close();
});

// ================================================================ takım: keşif → başvuru → kabul → üyeler → sohbet → takım yarışı → baskın
async function teamSub(page, label) { await closeBanners(page); await tab(page, 'team'); await page.locator('.team-head').waitFor({ timeout: 15_000 }); await page.locator('.subtabs .subtab', { hasText: label }).first().click(); await sleep(900); }
await step('takim', async () => {
  // lider (tarayıcı)
  const A = await newPage({ seed: save(30, { extra: { odiColor: 0xffb347, chosenColor: 0xffb347 } }) });
  await A.page.goto(url('oyun-bot=1&oyun-hiz=2'), { waitUntil: 'load' });
  await enter(A.page, AD.lider);
  await net(A.page, 'profile.update', { color: 0xffb347 }).catch(() => undefined);
  for (let l = 1; l <= 30; l++) await net(A.page, 'progress.submit', runOf(l));
  const team = (await net(A.page, 'team.create', { ...TEAM, open: false })).team;
  await syncTeam(A.page);
  const code = (await net(A.page, 'team.detail', {})).team.code;
  // ekip (tarayıcısız gerçek istemciler, kodla katılır)
  const Y = await rawPlayer(AD.yardimci, 26, 0x2ec4b6); await Y.call('team.join', { code });
  const H = await rawPlayer(AD.hizli, 24, 0xff4f7a); await H.call('team.join', { code });
  const U = await rawPlayer(AD.usta, 33, 0x9b7bff); await U.call('team.join', { code });
  const det = (await net(A.page, 'team.detail', {})).team;
  const yId = det.roster.find((m) => m.name === AD.yardimci).id;
  await net(A.page, 'team.role', { id: yId, role: 'yardimci' });
  // diğer takımlar (keşif listesi dolu görünsün)
  const others = [];
  for (const o of OTHERS) { const c = await rawPlayer(o.lead, o.lv, 0x6aa9ff); await c.call('team.create', { name: o.name, emblem: o.emblem, description: o.description, open: o.open }); others.push(c); }
  // çaylak (tarayıcı): keşif → profil → başvuru
  const B = await newPage({ seed: save(8, { extra: { odiColor: 0x2ee6d6, chosenColor: 0x2ee6d6 } }) });
  await B.page.goto(url('oyun-bot=1&oyun-hiz=2'), { waitUntil: 'load' });
  await enter(B.page, AD.caylak);
  await net(B.page, 'profile.update', { color: 0x2ee6d6 }).catch(() => undefined);
  for (let l = 1; l <= 8; l++) await net(B.page, 'progress.submit', runOf(l));
  await closeBanners(B.page); await tab(B.page, 'team'); await B.page.locator('.team-hero').waitFor({ timeout: 15_000 }); await sleep(800);
  await shoot(B.page, 'takim', '01-kesif');
  const row = B.page.locator(`[data-testid="takim-satiri"][data-name="${TEAM.name}"]`); await row.waitFor({ timeout: 10_000 });
  await row.scrollIntoViewIfNeeded(); await sleep(400);
  await shoot(B.page, 'takim', '02-kesif-satir');
  await shoot(B.page, 'takim', '02-kesif-satir-kart', { el: row, wait: false });
  await row.click(); await B.page.getByTestId('takim-profili').waitFor({ timeout: 10_000 }); await sleep(800);
  await shoot(B.page, 'takim', '03-profil');
  await B.page.locator('[data-testid="takim-profili"] [data-testid="takim-katil"]').click(); await B.page.getByTestId('basvuru-sayfasi').waitFor();
  const notes = B.page.locator('.ta-note'); if (await notes.count()) await notes.first().click();
  await sleep(500); await shoot(B.page, 'takim', '04-basvuru');
  await B.page.getByTestId('basvuru-gonder').click();
  await B.page.locator('[data-testid="takim-profili"] [data-testid="takim-katil"][data-state="gonderildi"]').waitFor({ timeout: 10_000 }).catch(() => undefined); await sleep(600);
  await shoot(B.page, 'takim', '05-gonderildi');
  await B.page.keyboard.press('Escape'); await sleep(300);
  // lider: başvurular → kabul
  await closeBanners(A.page); await tab(A.page, 'team'); await A.page.locator('.team-head').waitFor({ timeout: 15_000 });
  await A.page.locator('[data-testid="basvuru-rozeti"]').waitFor({ timeout: 15_000 }); await sleep(500);
  await shoot(A.page, 'takim', '06-rozet');
  await A.page.getByTestId('basvuru-rozeti').click();
  const card = A.page.locator(`[data-testid="basvuru"][data-player="${AD.caylak}"]`); await card.waitFor({ timeout: 10_000 }); await sleep(500);
  await shoot(A.page, 'takim', '07-basvurular');
  await card.getByTestId('basvuru-kabul').click(); await card.waitFor({ state: 'detached', timeout: 10_000 }); await sleep(800);
  await A.page.keyboard.press('Escape').catch(() => undefined); await sleep(400);
  for (const p of [A.page, B.page]) await syncTeam(p);
  // üyeler (roller)
  await teamSub(A.page, 'Üyeler'); await sleep(800); await top0(A.page);
  await shoot(A.page, 'takim', '08-uyeler');
  const members = A.page.locator('.card.member');
  for (let i = 0; i < await members.count(); i++) { const m = members.nth(i); const nm = (await m.getAttribute('aria-label') ?? '').split(',')[0]; const slug = Object.entries(AD).find(([, v]) => v === nm)?.[0] ?? `uye${i}`; await shoot(A.page, 'takim', `08-uye-${slug}`, { el: m, wait: false }); }
  // sohbet: yalnız hazır sözler (serbest yazı yok)
  await teamSub(A.page, 'Sohbet'); await A.page.locator('.chat-box').waitFor({ timeout: 10_000 });
  const room = `takim:${team.id}`;
  for (const c of [Y, H, U]) await c.call('chat.join', { room }).catch(() => undefined);
  const say = async (c, id) => { await c.call('chat.send', { room, text: id, kind: 'hazir' }); await sleep(900); };
  await say(Y, 'hosgeldin'); await say(U, 'selam'); await say(H, 'birlikte'); await say(Y, 'hedef');
  await B.page.evaluate(() => undefined); await teamSub(B.page, 'Sohbet'); await B.page.locator('.chat-box').waitFor({ timeout: 10_000 });
  await B.page.getByRole('button', { name: 'Hazır sözler' }).click().catch(() => undefined); await B.page.locator('.quick-line .phrase[data-phrase="tesekkur"]').click().catch(() => undefined); await sleep(1200);
  await A.page.getByRole('button', { name: 'Hazır sözler' }).click().catch(() => undefined); await sleep(900);
  await settle(A.page);
  const free = await A.page.locator('.chat-box [data-kind="text"]').count().catch(() => 0); if (free) problems.push(`sohbet: ${free} serbest yazı`);
  await A.page.locator('.chat-box').evaluate((el) => { el.scrollTop = el.scrollHeight; }).catch(() => undefined);
  await shoot(A.page, 'takim', '09-sohbet');
  // baskın: dolu can → ekip bölümleri canavarı eritir (gerçek progress.submit) → yarı → yenildi
  await teamSub(A.page, 'Baskın'); await A.page.locator('.raid .qn').waitFor({ timeout: 10_000 }).catch(() => undefined); await sleep(800);
  await shoot(A.page, 'takim', '10-baskin');
  let half = false;
  for (let i = 0; i < 120; i++) {
    const st = (await Y.call('raid.state', {}).catch(() => null))?.raid;
    if (st && (st.hp <= 0 || st.defeatedAt)) break;
    if (st && !half && st.hp <= st.maxHp * 0.5) { half = true; await sleep(800); await teamSub(A.page, 'Sohbet'); await teamSub(A.page, 'Baskın'); await sleep(1200); await shoot(A.page, 'takim', '10-baskin-yari'); }
    await [Y, H, U][i % 3].call('progress.submit', runOf(1 + (i % 20), { coins: 80 })).catch(() => null);
  }
  await sleep(2000); await settle(A.page); await teamSub(A.page, 'Sohbet'); await teamSub(A.page, 'Baskın'); await sleep(1500); await settle(A.page);
  await shoot(A.page, 'takim', '10-baskin-yenildi');
  // takım yarışı: 3'e 3 lobi (lider + çaylak arayüzden, yardımcı istemciden), hazır, rakip ara, eşleşme
  await teamSub(A.page, 'Takım Yarışı'); await A.page.getByTestId('takim-yarisi').waitFor({ timeout: 10_000 });
  await A.page.getByTestId('tr-ac-3').click(); await A.page.getByTestId('tr-lobi').waitFor();
  await teamSub(B.page, 'Takım Yarışı'); await B.page.getByTestId('tr-katil').click(); await B.page.getByTestId('tr-hazir').click();
  await Y.call('trace.join', {}); await Y.call('trace.ready', { ready: true });
  await A.page.getByTestId('tr-hazir').click();
  await A.page.locator('[data-testid="tr-uye"][data-ready="1"]').nth(2).waitFor({ timeout: 15_000 }).catch(() => undefined); await sleep(800);
  await shoot(A.page, 'takim', '11-yaris-lobi');
  // rakip takım (istemciler): lobi + hazır + ara
  const R1 = others[1]; const R2 = await rawPlayer('Bas Davulu', 20, 0x6aa9ff);
  const rteam = (await R1.call('team.list', { query: OTHERS[1].name })).teams[0]; await R2.call('team.join', { code: (await R1.call('team.detail', {})).team.code });
  await R1.call('trace.open', { size: 3 }); await R2.call('trace.join', {}); await R1.call('trace.ready', { ready: true }); await R2.call('trace.ready', { ready: true });
  await A.page.getByTestId('tr-ara').click(); await sleep(400);
  await R1.call('trace.search', { on: true });
  await A.page.waitForFunction(() => !!window.__odi?.race?.team, null, { timeout: 60_000 });
  await A.page.waitForFunction(() => (window.__odi?.events ?? []).some((e) => e.type === 'started'), null, { timeout: 60_000 }).catch(() => undefined);
  await sleep(2500);
  await shoot(A.page, 'takim', '12-yaris-ici', { wait: false, clean: ['[data-testid="yonetici-rozet"]', '.toast-top'] });
  await sleep(4000);
  await shoot(A.page, 'takim', '13-yaris-ici-2', { wait: false, clean: ['[data-testid="yonetici-rozet"]', '.toast-top'] });
  void rteam;
  await B.ctx.close().catch(() => undefined);
  await A.ctx.close();
});

await shutdown();
mkdirSync(OUT, { recursive: true }); writeFileSync(resolve(OUT, 'cekim4.json'), JSON.stringify({ olusturma: new Date().toISOString(), kareler: shots, sorunlar: problems }, null, 1));
for (const p of problems) log(`⚠ ${p}`);
log(`${shots.length} kare → ${OUT}`);
process.exit(problems.length ? 1 : 0);
