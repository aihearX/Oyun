#!/usr/bin/env node
// ODİ oturum ortasında sunucu yeniden başlatma testi (MK-019): her güncelleme (odi-guncelle) ve yeniden açılış sunucuyu yeniden başlatır.
// O anda oynayan kişi hiçbir şey kaybetmemeli, ödülü iki kez almamalı ve kendiliğinden geri bağlanmalı.
//
// Düzen: gerçek sunucu ayrı süreçte (apps/server/dist/server.mjs, AYNI SQLite dosyası her açılışta) + web test derlemesi (VITE_ODI_E2E=1)
// + her oyuncunun önünde küçük bir TCP aracısı (Caddy yerine): sunucu kapalıyken bağlantıyı hemen düşürür (502 gibi); istenirse
// istemcinin belli bir isteğini (ör. progress.submit) gördüğü anda sunucunun yanıtlarını tutar → "sunucu işledi ama yanıt gelmeden
// kapandı" anı belirlenimli olarak sınanır. Sunucu SIGTERM (systemctl restart) ya da SIGKILL (çökme) ile kapatılır.
//
// Bölümler (her tarayıcıda: Chromium + WebKit; A ve B aynı takımda):
//   odul    (b) bölüm sonu ödülü gönderilirken: sunucu ödülü yazar, yanıt gelmeden SIGKILL → sonuç ekranında şerit → bağlanınca aynı
//               runId ile yeniden gönderilir → ödül tek (progress_runs 1, jeton bir kez), sonuç ekranı katkı satırlarını gösterir.
//   kamp    (a) inşaat sürerken + sıraya alınırken (yanıt kaybolur) SIGTERM; sunucu kapalıyken inşaat biter → sıradaki inşaat bitiş
//               anında başlar; sonra kopukken "kristalle bitir" → bağlanınca bir kez işlenir.
//   sohbet  (c) takım sohbetine kopukken yazılan ileti bağlanınca bir kez gider; yanıtı kaybolan ileti aynı cid ile yeniden
//               denenir (tek kayıt); kopukken başkasının yazdığı ileti yeniden katılımda gelir; uzun kopuklukta açık hata, metin kutuda kalır.
//   etkinlik    etkinlik merkezi açıkken yeniden başlatma: şerit, bağlanınca içerik yeniden yüklenir.
//   yaris   (d) yarış odasında: sunucu yeniden başlarsa oda silinir → açık ileti + menü, yeni oda kurulur; yalnız ağ kopması
//               (sunucu açık) → oda yeniden katılımla geri gelir.
// Her kopmada: "Bağlantı koptu" şeridi görünür; sunucu döndükten sonra ≤ 15 sn'de kendiliğinden bağlanır; cüzdan, kamp, ilerleme
// sunucu (SQLite) ve istemcide aynı; bekleyen kuyruk/outbox boş.
// Kullanım: node tools/harness/kopma-e2e.mjs [--browsers chromium,webkit] [--only odul,kamp,sohbet,etkinlik,yaris] [--no-build] [--headed]
// Çıktı: tools/harness/out/kopma/<tarayıcı>/*.png, sonuc.json
import { spawn } from 'node:child_process';
import net from 'node:net';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { chromium, webkit } from 'playwright';

const argv = process.argv.slice(2); const args = new Set(argv);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1]; };
const browsers = opt('browsers', 'chromium,webkit').split(',').filter(Boolean);
const only = opt('only', null)?.split(',');
const want = (s) => !only || only.includes(s);
const root = resolve(new URL('../..', import.meta.url).pathname);
const webRoot = resolve(root, 'apps/web');
const outRoot = resolve(root, 'tools/harness/out/kopma'); mkdirSync(outRoot, { recursive: true });
const distDir = resolve(outRoot, 'dist');
const RACE_PAGE = 'src/race/dev/yaris.html';
/** sunucu döndükten sonra istemcinin kendiliğinden bağlanması için üst sınır (MK-019) */
const RECONNECT_MAX_MS = 15_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd, a, o = {}) => new Promise((res, rej) => { const p = spawn(cmd, a, { cwd: root, stdio: 'inherit', ...o }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${a.join(' ')} → ${c}`)))); });
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });

// ---------------------------------------------------------------- denetim kaydı
const results = []; // { bt, bolum, ok, msg }
let cur = { bt: '-', bolum: '-' };
let failed = 0;
function check(cond, msg) { results.push({ ...cur, ok: !!cond, msg }); console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) { failed++; throw new Error(msg); } }
const ok = (msg) => check(true, msg);
const step = (m) => console.log(`\n▶ [${cur.bt}] ${m}`);

// ---------------------------------------------------------------- derlemeler
if (!args.has('--no-build') || !existsSync(resolve(root, 'apps/server/dist/server.mjs'))) await run('npm', ['run', 'build', '-w', '@odi/server', '--silent']);
const vite = await import('vite');
if (!args.has('--no-build') || !existsSync(resolve(distDir, 'index.html')) || !existsSync(resolve(distDir, RACE_PAGE))) {
  process.env.VITE_ODI_E2E = '1';
  await vite.build({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn',
    build: { outDir: distDir, emptyOutDir: true, rollupOptions: { input: { main: resolve(webRoot, 'index.html'), yaris: resolve(webRoot, RACE_PAGE) } } } });
  delete process.env.VITE_ODI_E2E;
}
const wport = await freePort();
const pv = await vite.preview({ root: webRoot, configFile: resolve(webRoot, 'vite.config.ts'), logLevel: 'warn', build: { outDir: distDir }, preview: { port: wport, strictPort: true, host: '127.0.0.1' } });
const host = `http://127.0.0.1:${wport}`;

// ---------------------------------------------------------------- sunucu süreci (aynı veritabanı dosyası)
const SRV_PORT = await freePort();
let dbFile = '';
let srv = null;
let db = null;
async function startSrv() {
  const p = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', resolve(root, 'apps/server/dist/server.mjs')], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
    // ODI_FREE_TEXT_AT=0: yeni hesaplar serbest yazar (güvenli sohbet kuralı comm-e2e'de sınanır)
    // üretim kipi (systemd birimindeki gibi); yalnız serbest yazı eşiği test için 0
    env: { ...process.env, NODE_ENV: 'production', PORT: String(SRV_PORT), HOST: '127.0.0.1', ODI_DB: dbFile, ODI_LOG: '0', ODI_FREE_TEXT_AT: '0' },
  });
  p.stderr.on('data', (d) => { const t = String(d); if (!/ExperimentalWarning|trace-warnings|ODI_ADMIN_CODE_HASH/.test(t)) process.stderr.write(`[sunucu] ${t}`); });
  p.stdout.on('data', () => undefined);
  srv = p;
  for (let i = 0; ; i++) {
    try { const r = await fetch(`http://127.0.0.1:${SRV_PORT}/saglik`); if (r.ok) break; } catch { /* henüz değil */ }
    if (p.exitCode != null) throw new Error(`sunucu açılmadı (çıkış ${p.exitCode})`);
    if (i > 300) throw new Error('sunucu 30 sn içinde açılmadı');
    await sleep(100);
  }
  return Date.now();
}
async function stopSrv(sig = 'SIGTERM') {
  const p = srv; srv = null;
  if (!p || p.exitCode != null || p.signalCode != null) return;
  const done = new Promise((r) => p.once('exit', r));
  p.kill(sig);
  if (await Promise.race([done.then(() => true), sleep(10_000).then(() => false)])) return;
  p.kill('SIGKILL'); await done;
}
const q1 = (sql, ...a) => db.prepare(sql).get(...a);
const qa = (sql, ...a) => db.prepare(sql).all(...a);
const dbRun = (sql, ...a) => db.prepare(sql).run(...a);

// ---------------------------------------------------------------- aracı (Caddy yerine): geçir / reddet / yanıtları tut
/** istemci → sunucu WebSocket çerçevelerinden metin iletilerini çıkarır (ws sunucusu sıkıştırma açmaz) */
function frames(pair, chunk) {
  let b = pair.buf.length ? Buffer.concat([pair.buf, chunk]) : chunk;
  if (!pair.hdrDone) { const i = b.indexOf('\r\n\r\n'); if (i < 0) { pair.buf = Buffer.from(b); return []; } pair.hdrDone = true; b = b.subarray(i + 4); }
  const out = [];
  for (;;) {
    if (b.length < 2) break;
    const op = b[0] & 0x0f; const masked = (b[1] & 0x80) !== 0; let len = b[1] & 0x7f; let off = 2;
    if (len === 126) { if (b.length < 4) break; len = b.readUInt16BE(2); off = 4; } else if (len === 127) { if (b.length < 10) break; len = Number(b.readBigUInt64BE(2)); off = 10; }
    const mk = masked ? 4 : 0; if (b.length < off + mk + len) break;
    const payload = Buffer.from(b.subarray(off + mk, off + mk + len));
    if (masked) { const m = b.subarray(off, off + 4); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3]; }
    if (op === 1) out.push(payload.toString('utf8'));
    b = b.subarray(off + mk + len);
  }
  pair.buf = Buffer.from(b);
  return out;
}
async function makeProxy(name) {
  const px = { name, mode: 'pass', holdOp: null, held: null, pairs: new Set(), port: 0 };
  const server = net.createServer((down) => {
    if (px.mode === 'refuse') { down.destroy(); return; }
    const up = net.connect(SRV_PORT, '127.0.0.1');
    down.setNoDelay(true); up.setNoDelay(true);
    const pair = { down, up, hold: false, buf: Buffer.alloc(0), hdrDone: false };
    px.pairs.add(pair);
    const end = () => { px.pairs.delete(pair); down.destroy(); up.destroy(); };
    for (const s of [up, down]) { s.on('error', end); s.on('close', end); }
    up.on('data', (d) => { if (!pair.hold) down.write(d); }); // tutulan yanıt hiç iletilmez (sunucu kapanınca atılır)
    down.on('data', (d) => {
      for (const t of frames(pair, d)) {
        if (px.holdOp && t.includes(`"op":"${px.holdOp}"`)) { pair.hold = true; px.holdOp = null; px.held?.(t); }
      }
      up.write(d);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  px.port = server.address().port;
  px.url = `ws://127.0.0.1:${px.port}`;
  /** bu istek görülünce sunucunun yanıtlarını tut; dönen söz istek görülünce çözülür */
  px.holdOn = (op) => new Promise((r) => { px.holdOp = op; px.held = (t) => { px.held = null; r(t); }; });
  px.drop = () => { for (const p of [...px.pairs]) { p.down.destroy(); p.up.destroy(); } };
  px.close = () => new Promise((r) => { px.drop(); server.close(() => r()); });
  return px;
}

// ---------------------------------------------------------------- oyuncular
const launch = (bt) => (bt === 'webkit' ? webkit : chromium).launch({ headless: !args.has('--headed'), executablePath: bt === 'chromium' ? process.env.PLAYWRIGHT_CHROMIUM || undefined : undefined,
  args: bt === 'chromium' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] : [] });
/** görünen bildirimler ve bağlantı şeritleri (kısa görünenler de) */
const KAYIT = () => {
  const o = { toasts: [], banners: [] }; window.__kopma = o;
  const scan = (n) => {
    if (!(n instanceof Element)) return;
    for (const t of [n, ...n.querySelectorAll('.toast-top')]) if (t.matches('.toast-top')) o.toasts.push({ at: Date.now(), text: t.textContent ?? '' });
    for (const t of [n, ...n.querySelectorAll('.net-banner')]) if (t.matches('.net-banner')) o.banners.push({ at: Date.now(), text: t.textContent ?? '' });
  };
  const start = () => new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) scan(n); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);
};
async function newPlayer(browser, bt, tag, name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, ...(bt === 'chromium' ? { isMobile: true } : {}), locale: 'tr-TR', reducedMotion: 'reduce' });
  // ilk açılış rehberi atlanır (bkz. onboarding-e2e); kamp liste görünümünde açılır (erişilebilir düğmeler, kanvas dokunuşu yok)
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('odi-v1')) { localStorage.setItem('odi-v1', JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true } }, version: 3 })); localStorage.setItem('odi.kamp.gorunum', 'liste'); } } catch { /* yok */ } });
  await ctx.addInitScript(KAYIT);
  const page = await ctx.newPage();
  const P = { tag, name, ctx, page, errors: [], proxy: await makeProxy(tag), pid: null, dir: resolve(outRoot, bt), n: 0 };
  mkdirSync(P.dir, { recursive: true });
  page.on('pageerror', (e) => P.errors.push(String(e.message ?? e)));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/favicon|AudioContext|WebGL|GPU|Autoplay|manifest|WebSocket|ERR_CONNECTION|Failed to load resource|net::/i.test(t)) P.errors.push(t); });
  return P;
}
const appUrl = (P) => `${host}/?sunucu=${encodeURIComponent(P.proxy.url)}&oyun-bot=1&oyun-hiz=4`;
const shot = async (P, label) => { const f = resolve(P.dir, `${String(++P.n).padStart(2, '0')}-${P.tag}-${label}.png`); await P.page.screenshot({ path: f }).catch(() => undefined); };
const tab = (P, label) => P.page.locator('nav.tabbar .tab', { hasText: label }).click();
/** sekmelere dön (önceki bölüm sonuç ekranında ya da alt ekranda bıraktıysa) */
async function home(P) {
  for (let i = 0; i < 4 && !(await P.page.locator('nav.tabbar').isVisible().catch(() => false)); i++) {
    const map = P.page.locator('.result-actions [data-act="harita"]');
    if (await map.count()) await map.click().catch(() => undefined); else await P.page.getByRole('button', { name: 'Geri' }).first().click({ timeout: 3000 }).catch(() => undefined);
    await sleep(600);
  }
}
const toastGone = async (P) => { for (let i = 0; i < 8 && await P.page.locator('.toast-top').count(); i++) { await P.page.locator('.toast-top').first().evaluate((el) => el.click(), undefined, { timeout: 500 }).catch(() => undefined); await sleep(150); } };
const status = (P) => P.page.evaluate(() => window.__etkinlik?.netStore?.getState().status ?? window.__ag?.net()?.status ?? null).catch(() => null);
const call = (P, op, data) => P.page.evaluate(([o, d]) => window.__ag.net().call(o, d), [op, data]);
async function waitOnline(P, ms = 25_000) {
  await P.page.waitForFunction(() => (window.__etkinlik?.netStore?.getState().status ?? window.__ag?.net()?.status) === 'bağlı', null, { timeout: ms, polling: 100 });
  return Date.now();
}
const banner = (P) => P.page.locator('.net-banner', { hasText: 'Bağlantı koptu' }).first();

/**
 * Sunucuyu kapat → (şeritler görünür) → whileDown → downMs dolunca aynı veritabanıyla yeniden aç → herkes kendiliğinden bağlanır.
 * Dönüş: oyuncu başına sunucu açıldıktan sonra bağlanma süresi (ms).
 */
async function outage(label, { sig = 'SIGTERM', downMs = 3000, players, whileDown, bannerOf = banner } = {}) {
  const tKill = Date.now();
  await stopSrv(sig);
  for (const P of players) {
    const seen = await bannerOf(P).waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false);
    if (!seen) await shot(P, `${label}-serit-yok`);
    check(seen, `${P.tag}: "Bağlantı koptu" şeridi görünüyor (${label}, ${sig})`);
  }
  for (const P of players) await shot(P, `${label}-kopuk`);
  if (whileDown) await whileDown();
  const rest = downMs - (Date.now() - tKill); if (rest > 0) await sleep(rest);
  const tUp = await startSrv();
  const out = {};
  for (const P of players) {
    const t = await waitOnline(P, RECONNECT_MAX_MS + 10_000).catch(() => null);
    const after = t ? t - tUp : null;
    check(t != null && after <= RECONNECT_MAX_MS, `${P.tag}: sunucu döndükten ${after != null ? (after / 1000).toFixed(1) : '—'} sn sonra kendiliğinden bağlandı (≤ 15 sn; kopukluk ${((tUp - tKill) / 1000).toFixed(1)} sn)`);
    out[P.tag] = after;
  }
  return out;
}

// ---------------------------------------------------------------- sunucu ↔ istemci tutarlılığı
async function clientState(P) {
  return P.page.evaluate(() => {
    const n = window.__etkinlik?.netStore?.getState(); const a = window.__ag; if (!n || !a) return null;
    const so = a.social.getState(); const st = a.store.getState();
    return {
      status: n.status, wallet: n.wallet && { jeton: n.wallet.jeton, kristal: n.wallet.kristal }, coins: st.coins,
      camp: n.camp && { buildings: n.camp.buildings.map((b) => ({ id: b.id, level: b.level, upgradingTo: b.upgradingTo ?? null, endsAt: b.endsAt ?? null })), queued: n.camp.queued ? { id: n.camp.queued.id, toLevel: n.camp.queued.toLevel } : null },
      progress: Object.fromEntries(Object.entries(st.progress).map(([k, v]) => [k, v.stars])),
      queued: so.queued, outbox: so.outbox.length, lastRun: so.lastRun && { state: so.lastRun.state, runId: so.lastRun.runId },
    };
  }).catch(() => null);
}
function serverState(pid) {
  const p = q1('SELECT jeton, kristal, highest, stars FROM players WHERE id = ?', pid);
  return {
    ...p, buildings: qa('SELECT id, level, upgrading_to AS upgradingTo, ends_at AS endsAt FROM buildings WHERE player_id = ?', pid),
    queue: q1('SELECT id, to_level AS toLevel, jeton FROM camp_queue WHERE player_id = ?', pid) ?? null,
    best: qa('SELECT level, stars FROM level_best WHERE player_id = ?', pid), runs: q1('SELECT COUNT(*) AS n FROM progress_runs WHERE player_id = ?', pid).n,
  };
}
function diffs(c, s) {
  if (!c) return ['istemci durumu okunamadı'];
  const d = [];
  if (c.status !== 'bağlı') d.push(`durum ${c.status}`);
  if (c.wallet?.jeton !== s.jeton) d.push(`cüzdan jeton: istemci ${c.wallet?.jeton} ≠ sunucu ${s.jeton}`);
  if (c.wallet?.kristal !== s.kristal) d.push(`kristal: istemci ${c.wallet?.kristal} ≠ sunucu ${s.kristal}`);
  if (c.coins !== s.jeton) d.push(`üst çubuk jeton: ${c.coins} ≠ ${s.jeton}`);
  if (c.queued || c.outbox) d.push(`bekleyen: kuyruk ${c.queued}, outbox ${c.outbox}`);
  if (!c.camp) d.push('istemcide kamp yok');
  else {
    for (const b of c.camp.buildings) {
      const x = s.buildings.find((y) => y.id === b.id);
      if (!x || x.level !== b.level || (x.upgradingTo ?? null) !== b.upgradingTo || (x.endsAt ?? null) !== b.endsAt) d.push(`kamp ${b.id}: istemci Sv${b.level}→${b.upgradingTo ?? '-'} @${b.endsAt ?? '-'} ≠ sunucu Sv${x?.level}→${x?.upgradingTo ?? '-'} @${x?.endsAt ?? '-'}`);
    }
    if ((c.camp.queued?.id ?? null) !== (s.queue?.id ?? null)) d.push(`sıra: istemci ${c.camp.queued?.id ?? '-'} ≠ sunucu ${s.queue?.id ?? '-'}`);
  }
  for (const r of s.best) if (r.stars > 0 && (c.progress[r.level] ?? 0) !== r.stars) d.push(`ilerleme ${r.level}. bölüm: istemci ${c.progress[r.level] ?? 0}★ ≠ sunucu ${r.stars}★`);
  const top = Object.entries(c.progress).filter(([, v]) => v > 0).reduce((a, [k]) => Math.max(a, Number(k)), 0);
  if (Math.min(40, top + 1) !== s.highest) d.push(`açık bölüm: istemci ${top + 1} ≠ sunucu ${s.highest}`);
  return d;
}
async function consistent(P, label, ms = 15_000) {
  let d;
  for (const until = Date.now() + ms; ;) {
    d = diffs(await clientState(P), serverState(P.pid));
    if (!d.length || Date.now() > until) break;
    await sleep(300);
  }
  if (d.length) await shot(P, `${label}-tutarsiz`);
  check(!d.length, `${P.tag}: cüzdan, kamp ve ilerleme sunucu ile aynı (${label})${d.length ? ` — ${d.join('; ')}` : ''}`);
}
const toastsSince = (P, t) => P.page.evaluate((s) => window.__kopma.toasts.filter((x) => x.at >= s).map((x) => x.text), t);

// ======================================================================== akış
async function onboard(P) {
  await P.page.goto(appUrl(P), { waitUntil: 'load' });
  await P.page.getByRole('button', { name: /Yola çık/ }).click({ timeout: 30_000 });
  await P.page.locator('.onboard').waitFor({ timeout: 30_000 });
  await P.page.getByRole('textbox', { name: 'Takma ad' }).fill(P.name);
  await P.page.getByRole('button', { name: 'Başla' }).click();
  await P.page.locator('.onboard').waitFor({ state: 'detached', timeout: 15_000 });
  await waitOnline(P);
  for (let i = 0; i < 50 && !P.pid; i++) { P.pid = q1('SELECT id FROM players WHERE name = ?', P.name)?.id ?? null; if (!P.pid) await sleep(200); }
  check(!!P.pid, `${P.tag} sunucuda (${P.name})`);
  await toastGone(P);
}

async function suiteOdul(A) {
  step('(b) Bölüm sonu ödülü gönderilirken sunucu kapanır (yanıt kaybolur, SIGKILL)');
  await tab(A, 'Harita');
  await A.page.locator('.map-play').click({ timeout: 20_000 });
  const held = A.proxy.holdOn('progress.submit');
  for (let i = 0; i < 20 && !(await A.page.evaluate(() => !!window.__odi?.spec)); i++) { const h = A.page.getByRole('button', { name: /Haydi/ }); if (await h.count()) await h.click().catch(() => undefined); await sleep(400); }
  const raw = await Promise.race([held, sleep(300_000).then(() => null)]);
  check(!!raw, 'bölüm bitti, progress.submit sunucuya gitti (yanıt tutuluyor)');
  const runId = JSON.parse(raw).data.runId;
  // sunucu ödülü yazdı (işlem kaydı), istemci yanıtı alamadan sunucu çöker
  let row = null; for (let i = 0; i < 100 && !row; i++) { row = q1('SELECT ack FROM progress_runs WHERE player_id = ? AND run_id = ?', A.pid, runId); if (!row) await sleep(100); }
  check(!!row, `sunucu ödülü yazdı (runId ${runId.slice(0, 8)}…)`);
  const j1 = q1('SELECT jeton FROM players WHERE id = ?', A.pid).jeton; const ack = JSON.parse(row.ack);
  const g1 = q1('SELECT COALESCE(SUM(credited), 0) AS s FROM local_grants WHERE player_id = ?', A.pid).s;
  await A.page.locator('.result-actions').waitFor({ timeout: 20_000 });
  const t = await outage('odul', { sig: 'SIGKILL', players: [A], bannerOf: (P) => P.page.locator('[data-testid="sonuc-kopuk"]'),
    whileDown: async () => {
      const c = await clientState(A);
      check(c.queued === 1 && c.lastRun?.runId === runId && c.lastRun.state !== 'tamam', `sonuç kayıtlı kuyrukta bekliyor (kuyruk ${c.queued}, durum ${c.lastRun?.state})`);
    } });
  await A.page.waitForFunction((id) => window.__ag.social.getState().lastRun?.runId === id && window.__ag.social.getState().lastRun.state === 'tamam', runId, { timeout: 15_000 })
    .then(() => ok('bağlanınca sonuç aynı runId ile yeniden gönderildi, onay geldi'), () => check(false, 'sonuç onayı gelmedi'));
  check(q1('SELECT COUNT(*) AS n FROM progress_runs WHERE player_id = ?', A.pid).n === 1, 'ödül tek: progress_runs 1 kayıt');
  // sonradan gelen jeton yalnız yerel ödül defterinden (görev/başarım, ledgerId ile tek) olabilir; bölüm jetonu ikinci kez yazılmaz
  await consistent(A, 'ödül (ön)');
  const j2 = q1('SELECT jeton FROM players WHERE id = ?', A.pid).jeton; const g2 = q1('SELECT COALESCE(SUM(credited), 0) AS s FROM local_grants WHERE player_id = ?', A.pid).s;
  check(j2 - j1 === g2 - g1, `bölüm jetonu bir kez yazıldı (${ack.jeton} jeton; sonra +${j2 - j1} = yerel ödül defteri +${g2 - g1})`);
  await A.page.locator('.team-contrib .tc-line').first().waitFor({ timeout: 8000 }).then(() => ok('sonuç ekranı takım/lig/jeton katkısını gösteriyor'), () => check(false, 'sonuç ekranında katkı satırı yok'));
  await shot(A, 'odul-sonra');
  await consistent(A, 'ödül');
  await A.page.locator('.result-actions [data-act="harita"]').click();
  return t;
}

async function suiteKamp(A) {
  step('(a) Kamp inşaatı sürerken ve sıraya alınırken (yanıt kaybolur) sunucu kapanır (SIGTERM)');
  dbRun('UPDATE players SET jeton = jeton + 20000, kristal = kristal + 400 WHERE id = ?', A.pid);
  await tab(A, 'Kamp');
  const card = (name) => A.page.locator('.card.building', { hasText: name });
  await card('Kulak Deposu').waitFor({ timeout: 25_000 });
  await consistent(A, 'kamp açılışı');
  const j0 = q1('SELECT jeton FROM players WHERE id = ?', A.pid).jeton;
  await card('Kulak Deposu').getByRole('button', { name: 'Kur' }).click();
  await A.page.locator('.sheet').getByRole('button', { name: 'Yükselt' }).click();
  await A.page.locator('.card.construction', { hasText: 'Kulak Deposu' }).waitFor({ timeout: 10_000 });
  check(q1("SELECT upgrading_to FROM buildings WHERE player_id = ? AND id = 'depo'", A.pid).upgrading_to === 1, 'Kulak Deposu inşaatı sürüyor');
  // sıraya alma: sunucu yazar, yanıt gelmeden sunucu kapanır
  await card('Odyometri Odası').getByRole('button', { name: 'Sıraya al' }).click();
  const held = A.proxy.holdOn('camp.queue');
  const tq = Date.now();
  await A.page.locator('.sheet').getByRole('button', { name: 'Sıraya al' }).click();
  await held;
  let q = null; for (let i = 0; i < 100 && !q; i++) { q = q1('SELECT id FROM camp_queue WHERE player_id = ?', A.pid); if (!q) await sleep(100); }
  check(q?.id === 'laboratuvar', 'sunucu Odyometri Odası’nı sıraya yazdı (yanıt tutuluyor)');
  const jq = q1('SELECT jeton FROM players WHERE id = ?', A.pid).jeton;
  const depoCost = j0 - jq - q1('SELECT jeton FROM camp_queue WHERE player_id = ?', A.pid).jeton;
  let depoEnds = 0;
  const t1 = await outage('kamp', { sig: 'SIGTERM', players: [A], bannerOf: (P) => P.page.locator('.net-banner.camp-net'),
    whileDown: async () => {
      // sunucu kapalıyken inşaat biter: açılınca tamamlanır, sıradaki bitiş anında başlar
      depoEnds = Date.now() + 500;
      dbRun("UPDATE buildings SET ends_at = ? WHERE player_id = ? AND id = 'depo'", depoEnds, A.pid);
    } });
  const tt = await toastsSince(A, tq);
  check(tt.some((x) => /Bağlantı koptu/.test(x)), `yanıtı kaybolan işlem için açık ileti: "${tt.find((x) => /koptu|bağlı/i.test(x)) ?? tt.join(' | ')}"`);
  await A.page.locator('.card.construction', { hasText: 'Odyometri Odası' }).waitFor({ timeout: 15_000 }).then(() => ok('bağlanınca: Depo bitti, sıradaki Odyometri Odası inşaatı ekranda'), () => check(false, 'Odyometri Odası inşaatı ekranda değil'));
  const dep = q1("SELECT level FROM buildings WHERE player_id = ? AND id = 'depo'", A.pid).level;
  const lab = q1("SELECT upgrading_to, started_at FROM buildings WHERE player_id = ? AND id = 'laboratuvar'", A.pid);
  check(dep === 1 && lab.upgrading_to === 1 && !q1('SELECT 1 AS x FROM camp_queue WHERE player_id = ?', A.pid), 'sunucu: Depo Sv 1, sıradaki inşaat başladı, sıra boş');
  check(lab.started_at === depoEnds, 'sıradaki inşaat, öncekinin sunucu kapalıyken bittiği anda başladı (süre kaybı yok)');
  check(q1('SELECT jeton FROM players WHERE id = ?', A.pid).jeton === jq && depoCost > 0, `jeton bir kez düştü (Depo ${depoCost} + sıra; yeniden bağlanınca değişmedi)`);
  await consistent(A, 'kamp/sıra');
  await toastGone(A);

  step('(a2) Kopukken "kristalle bitir" (SIGKILL): bağlanınca bir kez işlenir');
  const k0 = q1('SELECT kristal FROM players WHERE id = ?', A.pid).kristal;
  const t2 = await outage('kamp-kristal', { sig: 'SIGKILL', players: [A], bannerOf: (P) => P.page.locator('.net-banner.camp-net'),
    whileDown: async () => { await A.page.locator('.card.construction').getByRole('button', { name: /kristalle hemen bitir/ }).click(); } });
  let lv = 0; for (let i = 0; i < 60 && lv !== 1; i++) { lv = q1("SELECT level FROM buildings WHERE player_id = ? AND id = 'laboratuvar'", A.pid).level; if (lv !== 1) await sleep(250); }
  const k1 = q1('SELECT kristal FROM players WHERE id = ?', A.pid).kristal;
  check(lv === 1 && k1 < k0, `kopukken basılan işlem bağlanınca yapıldı: Odyometri Odası Sv 1, ${k0 - k1} kristal`);
  await sleep(1500);
  check(q1('SELECT kristal FROM players WHERE id = ?', A.pid).kristal === k1, 'kristal bir kez düştü');
  await consistent(A, 'kamp/kristal');
  await shot(A, 'kamp-sonra');
  return { ...t1, kristal: t2[A.tag] };
}

async function suiteSohbet(A, B) {
  step('(c) Takım sohbeti: kopukken yazılan ileti, yanıtı kaybolan ileti, kopukken gelen ileti, uzun kopukluk');
  for (const P of [A, B]) { await tab(P, 'Takım'); await P.page.getByRole('textbox', { name: 'Mesaj' }).waitFor({ timeout: 20_000 }); await toastGone(P); }
  const say = async (P, text) => { await P.page.getByRole('textbox', { name: 'Mesaj' }).fill(text); await P.page.getByRole('button', { name: 'Gönder', exact: true }).click(); };
  const bubbles = (P, text) => P.page.locator('.msg .bubble', { hasText: text }).count();
  const rows = (text) => q1('SELECT COUNT(*) AS n FROM chat WHERE text = ?', text).n;
  const seenOnce = async (text, label) => {
    for (const P of [A, B]) await P.page.locator('.msg .bubble', { hasText: text }).first().waitFor({ timeout: 15_000 }).catch(() => undefined);
    await sleep(800);
    const [a, b, n] = [await bubbles(A, text), await bubbles(B, text), rows(text)];
    check(a === 1 && b === 1 && n === 1, `${label}: A'da ${a}, B'de ${b}, sunucuda ${n} kayıt (hepsi 1 olmalı)`);
  };
  await say(A, 'Merhaba takım'); await seenOnce('Merhaba takım', 'bağlıyken ileti');

  // c1: sunucu kapalıyken yazılır → bağlanınca bir kez gider
  const m1 = `Kopukken yazdım ${cur.bt}`;
  const t1 = await outage('sohbet-kopuk', { sig: 'SIGTERM', players: [A, B], whileDown: async () => {
    await sleep(1300); await say(A, m1);
    await A.page.getByTestId('sohbet-bekliyor').waitFor({ timeout: 5000 }).then(() => ok('kopukken: "iletin bağlanınca gönderilecek" görünüyor'), () => check(false, 'kopukken bekleme iletisi yok'));
  } });
  await seenOnce(m1, 'kopukken yazılan ileti bağlanınca');
  check(await A.page.getByRole('textbox', { name: 'Mesaj' }).inputValue() === '', 'gönderilince kutu boşaldı');

  // c2: ileti sunucuya yazıldı, yanıt gelmeden sunucu çöktü → aynı cid ile yeniden denenir, tek kayıt
  const m2 = `Yanıtı kaybolan ileti ${cur.bt}`;
  await sleep(1300);
  const held = A.proxy.holdOn('chat.send');
  await say(A, m2); await held;
  let n2 = 0; for (let i = 0; i < 100 && !n2; i++) { n2 = rows(m2); if (!n2) await sleep(100); }
  check(n2 === 1, 'sunucu iletiyi yazdı (yanıt tutuluyor)');
  const t2 = await outage('sohbet-yanit', { sig: 'SIGKILL', players: [A, B] });
  await seenOnce(m2, 'yanıtı kaybolan ileti yeniden denendi');
  check(!(await A.page.locator('.chat-err[role="alert"]').count()), 'hata gösterilmedi (güvenle yeniden denendi)');

  // c3: A'nın ağı daha gelmeden B yazar → A bağlanınca yeniden katılımla görür
  const m3 = `Sen yokken yazdım ${cur.bt}`;
  A.proxy.mode = 'refuse';
  const t3 = await outage('sohbet-aradaki', { sig: 'SIGTERM', players: [B] });
  await sleep(1300); await say(B, m3);
  await B.page.locator('.msg .bubble', { hasText: m3 }).first().waitFor({ timeout: 10_000 });
  check(await status(A) !== 'bağlı', 'A hâlâ kopuk (ağı yok)');
  const tPass = Date.now(); A.proxy.mode = 'pass';
  const ta = await waitOnline(A, RECONNECT_MAX_MS + 10_000).catch(() => null);
  check(ta != null && ta - tPass <= RECONNECT_MAX_MS, `A ağ gelince ${ta ? ((ta - tPass) / 1000).toFixed(1) : '—'} sn'de bağlandı`);
  await seenOnce(m3, 'A kopukken yazılan ileti');

  // c4: uzun kopukluk (istemcinin 20 sn bekleme süresinden uzun): açık hata, metin kutuda kalır; bağlanınca yeniden gönderilir, tek kayıt
  const m4 = `Uzun kopuklukta yazdım ${cur.bt}`;
  const t4 = await outage('sohbet-uzun', { sig: 'SIGTERM', downMs: 27_000, players: [A, B], whileDown: async () => {
    await say(A, m4);
    const err = await A.page.locator('.chat-err[role="alert"]').waitFor({ timeout: 24_000 }).then(() => A.page.locator('.chat-err[role="alert"]').innerText(), () => '');
    check(/bağlı değilsin|bağlanılamadı/i.test(err), `uzun kopuklukta açık hata: "${err}"`);
    check(await A.page.getByRole('textbox', { name: 'Mesaj' }).inputValue() === m4, 'metin kaybolmadı, kutuda duruyor');
    check(rows(m4) === 0, 'iletiden sunucuda kayıt yok (sessizce gitmiş gibi görünmüyor)');
  } });
  await A.page.getByRole('button', { name: 'Gönder', exact: true }).click();
  await seenOnce(m4, 'uzun kopukluktan sonra yeniden gönderilen ileti');
  await shot(A, 'sohbet-sonra'); await shot(B, 'sohbet-sonra');
  await consistent(A, 'sohbet'); await consistent(B, 'sohbet');
  return { kopuk: t1, yanit: t2, aradaki: t3, uzun: t4 };
}

async function suiteEtkinlik(A) {
  step('(d) Etkinlik merkezi açıkken sunucu yeniden başlar');
  await tab(A, 'Harita');
  await A.page.getByTestId('ev-fab').click({ timeout: 20_000 });
  await A.page.locator('[data-testid^="ev-kart-"]').first().waitFor({ timeout: 20_000 });
  const before = await A.page.locator('[data-testid^="ev-kart-"]').count();
  const t = await outage('etkinlik', { sig: 'SIGTERM', players: [A] });
  await A.page.locator('[data-testid^="ev-kart-"]').first().waitFor({ timeout: 15_000 });
  await banner(A).waitFor({ state: 'detached', timeout: 10_000 }).catch(() => undefined);
  check(!(await banner(A).count()), 'bağlanınca şerit kalktı');
  const after = await A.page.locator('[data-testid^="ev-kart-"]').count();
  check(after > 0, `etkinlik kartları yerinde (${before} → ${after})`);
  await A.page.waitForFunction(() => window.__etkinlik.events.getState().loaded, null, { timeout: 10_000 });
  await shot(A, 'etkinlik-sonra');
  await consistent(A, 'etkinlik');
  await A.page.getByRole('button', { name: 'Geri' }).first().click().catch(() => undefined);
  return t;
}

async function suiteYaris(A, B) {
  step('(d) Yarış odasında: sunucu yeniden başlar → oda kapandı iletisi; ağ kopması → odaya yeniden katılım');
  for (const P of [A, B]) {
    await P.page.goto(`${host}/${RACE_PAGE}?sunucu=${encodeURIComponent(P.proxy.url)}`, { waitUntil: 'load' });
    await P.page.waitForFunction(() => window.__yaris?.net()?.status === 'bağlı', null, { timeout: 25_000 });
  }
  const tid = (P, id) => P.page.getByTestId(id);
  const openRoom = async () => {
    await tid(A, 'yaris-oda-kur').click(); await tid(A, 'yaris-seviye-1').click();
    await tid(A, 'yaris-kod').waitFor({ timeout: 10_000 });
    const code = await tid(A, 'yaris-kod').getAttribute('data-code');
    await tid(B, 'yaris-kod-gir').click(); await tid(B, 'yaris-kod-input').fill(code); await tid(B, 'yaris-kod-katil').click();
    for (const P of [A, B]) await P.page.waitForFunction(() => document.querySelectorAll('[data-testid="yaris-oyuncu"]').length === 2, null, { timeout: 10_000 });
    return code;
  };
  const r1 = await openRoom();
  await tid(B, 'yaris-hazir').click();
  await B.page.locator('[data-testid="yaris-oyuncu"].ready').waitFor({ timeout: 8000 });
  ok(`oda ${r1}: A + B, B hazır`);
  const t1 = await outage('yaris', { sig: 'SIGTERM', players: [A, B] });
  for (const P of [A, B]) {
    const msg = await P.page.locator('.race-error[role="alert"]').waitFor({ timeout: 10_000 }).then(() => P.page.locator('.race-error[role="alert"]').innerText(), () => '');
    check(/oda(sı)? kapandı/i.test(msg) && await tid(P, 'yaris-oda-kur').isVisible(), `${P.tag}: açık ileti ("${msg}") + yarış menüsü (ölü odada kalmadı)`);
  }
  await shot(A, 'yaris-oda-kapandi');
  const r2 = await openRoom();
  check(r2 !== r1, `yeni oda kuruldu ve katılındı (${r2})`);

  // yalnız A'nın ağı kopar (sunucu açık): sunucu A'yı odadan çıkarır; A geri gelince odaya yeniden katılır
  A.proxy.mode = 'refuse'; A.proxy.drop();
  await banner(A).waitFor({ timeout: 8000 }).then(() => ok('A: "Bağlantı koptu" şeridi (ağ kopması)'), () => check(false, 'A: ağ kopmasında şerit yok'));
  await B.page.waitForFunction(() => document.querySelectorAll('[data-testid="yaris-oyuncu"]').length === 1, null, { timeout: 10_000 }).then(() => ok('B: A odadan düştü'), () => check(false, 'B: A odadan düşmedi'));
  await sleep(2000);
  const tPass = Date.now(); A.proxy.mode = 'pass';
  const ta = await waitOnline(A, RECONNECT_MAX_MS + 10_000).catch(() => null);
  check(ta != null && ta - tPass <= RECONNECT_MAX_MS, `A ağ gelince ${ta ? ((ta - tPass) / 1000).toFixed(1) : '—'} sn'de bağlandı`);
  for (const P of [A, B]) await P.page.waitForFunction(() => document.querySelectorAll('[data-testid="yaris-oyuncu"]').length === 2, null, { timeout: 10_000 })
    .then(() => ok(`${P.tag}: A odaya kendiliğinden yeniden katıldı (2 oyuncu)`), () => check(false, `${P.tag}: A odaya geri dönmedi`));
  await shot(A, 'yaris-yeniden-katildi'); await shot(B, 'yaris-yeniden-katildi');
  return { yeniden: t1, ag: ta ? ta - tPass : null };
}

// ======================================================================== koşu
const sure = {};
// yarıda kesilirse (kabul zaman sınırı, Ctrl+C) sunucu süreci kalmasın
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { srv?.kill('SIGKILL'); } catch { /* yok */ } process.exit(130); });
try {
  for (const bt of browsers) {
    cur = { bt, bolum: 'kurulum' };
    console.log(`\n================ ${bt} ================`);
    dbFile = resolve(outRoot, `odi-${bt}.sqlite`);
    for (const f of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) rmSync(f, { force: true });
    rmSync(resolve(outRoot, bt), { recursive: true, force: true });
    await startSrv();
    db = new DatabaseSync(dbFile); db.exec('PRAGMA busy_timeout = 5000;');
    const browser = await launch(bt);
    const A = await newPlayer(browser, bt, 'A', `Ayşe${bt[0]}`); const B = await newPlayer(browser, bt, 'B', `Bora${bt[0]}`);
    const S = sure[bt] = {};
    const section = async (name, fn) => {
      if (!want(name)) return;
      cur = { bt, bolum: name };
      try {
        if (!srv) await startSrv(); A.proxy.mode = 'pass'; B.proxy.mode = 'pass';
        if (name !== 'yaris') for (const P of [A, B]) { await waitOnline(P).catch(() => undefined); await home(P); }
        S[name] = await fn();
      }
      catch (e) {
        if (!results.some((r) => r.bt === bt && r.bolum === name && !r.ok)) { failed++; results.push({ ...cur, ok: false, msg: String(e.message ?? e).split('\n')[0] }); }
        console.log(`  ✗ ${name}: ${String(e.message ?? e).split('\n')[0]}`);
        await shot(A, `${name}-HATA`); await shot(B, `${name}-HATA`);
      }
    };
    step('Kurulum: A ve B takma ad, aynı takım');
    for (const P of [A, B]) await onboard(P);
    const team = await call(A, 'team.create', { name: `Kopma ${bt}`, emblem: '🐚' }).then((r) => r.team);
    const code = q1('SELECT code FROM teams WHERE id = ?', team.id).code;
    await call(B, 'team.join', { code });
    check(q1('SELECT team_id FROM players WHERE id = ?', B.pid).team_id === team.id, 'A ve B aynı takımda');

    await section('odul', () => suiteOdul(A));
    await section('kamp', () => suiteKamp(A));
    await section('sohbet', () => suiteSohbet(A, B));
    await section('etkinlik', () => suiteEtkinlik(A));
    await section('yaris', () => suiteYaris(A, B));
    cur = { bt, bolum: 'sayfa' };
    for (const P of [A, B]) { const e = [...new Set(P.errors)]; try { check(!e.length, `${P.tag}: sayfa hatası yok${e.length ? ` — ${e.slice(0, 3).join(' | ')}` : ''}`); } catch { /* kayıtlı */ } }
    await browser.close();
    for (const P of [A, B]) await P.proxy.close();
    await stopSrv('SIGTERM');
    db.close(); db = null;
  }
} catch (e) {
  failed++; results.push({ ...cur, ok: false, msg: `beklenmeyen: ${String(e.message ?? e).split('\n')[0]}` });
  console.error(`\n✗ beklenmeyen hata: ${e.stack ?? e}`);
} finally {
  await stopSrv('SIGKILL').catch(() => undefined);
  await pv.close().catch(() => undefined);
  try { db?.close(); } catch { /* yok */ }
}
writeFileSync(resolve(outRoot, 'sonuc.json'), JSON.stringify({ sure, results }, null, 2));
console.log('\n— kopma özeti —');
console.log('| Tarayıcı | Bölüm | Denetim | Geçen | Düşen |\n|---|---|---|---|---|');
for (const bt of browsers) for (const b of [...new Set(results.filter((r) => r.bt === bt).map((r) => r.bolum))]) {
  const rs = results.filter((r) => r.bt === bt && r.bolum === b);
  console.log(`| ${bt} | ${b} | ${rs.length} | ${rs.filter((r) => r.ok).length} | ${rs.filter((r) => !r.ok).map((r) => r.msg).join('; ') || '-'} |`);
}
console.log(`\nyeniden bağlanma (sunucu döndükten sonra, ms): ${JSON.stringify(sure)}`);
if (failed) { console.log(`\n✗ kopma-e2e: ${failed} denetim düştü`); process.exit(1); }
console.log(`\n✓ kopma-e2e: ${results.length} denetim geçti (${browsers.join(' + ')}) · ${outRoot.replace(root + '/', '')}`);
process.exit(0);
