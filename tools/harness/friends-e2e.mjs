#!/usr/bin/env node
// ODİ arkadaşlık + özel mesaj uçtan uca testi: gerçek sunucu (ODI_DB=:memory:) + web derlemesi (vite build + vite preview) + 3 tarayıcı bağlamı.
// Akış: A, B'yi isimle arar → istek → B kabul eder → A mesaj yazar → B'de bildirim şeridi + okunmamış rozeti → B sohbeti açar
//       → A'da "✓✓ Görüldü" → B yazarken A'da "yazıyor…" → tepki → çıkartma → A hediye gönderir → B ödül kutusunda görür
//       → C, A'ya istek atar, A reddeder → A, C'yi engeller → C mesaj/istek atamaz. Her adımda 390×844 ekran görüntüsü.
// Kullanım: node tools/harness/friends-e2e.mjs [--no-build] [--headed]
// Çıktı: tools/harness/out/arkadas/*.png
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const args = new Set(process.argv.slice(2));
const root = resolve(new URL('../..', import.meta.url).pathname);
const outDir = resolve(root, 'tools/harness/out/arkadas'); mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (f.endsWith('.png')) rmSync(resolve(outDir, f));
const distDir = resolve(outDir, 'dist');
const procs = [];
const run = (cmd, a, opts = {}) => new Promise((res, rej) => { const p = spawn(cmd, a, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...opts }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${a.join(' ')} → ${c}`)))); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
const step = (n) => console.log(`\n▶ ${n}`);
const ok = (m) => console.log(`  ✓ ${m}`);
function check(cond, m) { if (!cond) { failed = true; console.log(`  ✗ ${m}`); throw new Error(m); } ok(m); }

if (!args.has('--no-build') || !existsSync(resolve(distDir, 'index.html'))) await run('npx', ['vite', 'build', '--outDir', distDir, '--emptyOutDir', '--logLevel', 'warn'], { cwd: resolve(root, 'apps/web') });
if (!args.has('--no-build') || !existsSync(resolve(root, 'apps/server/dist/server.mjs'))) await run('npm', ['run', 'build:server', '--silent']);

// ---- sunucu (bellek içi)
const { createServer } = await import('node:net');
const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });
const sport = await freePort();
const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'apps/server/dist/server.mjs'], { cwd: root, env: { ...process.env, PORT: String(sport), HOST: '127.0.0.1', ODI_DB: ':memory:', ODI_LOG: '0', ODI_FREE_TEXT_AT: '0' /* yeni hesaplar serbest yazar (güvenli sohbet kuralı comm-e2e'de sınanır) */ }, stdio: ['ignore', 'ignore', 'inherit'] });
procs.push(server);
for (let i = 0; ; i++) {
  try { const r = await fetch(`http://127.0.0.1:${sport}/saglik`); if (r.ok) break; } catch { /* henüz değil */ }
  if (i > 75) throw new Error('sunucu başlamadı');
  await sleep(200);
}
const wsUrl = `ws://127.0.0.1:${sport}`;

// ---- web önizleme
const wport = await freePort();
const preview = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(wport), '--strictPort', '--outDir', distDir], { cwd: resolve(root, 'apps/web'), stdio: 'ignore' }); // npx değil: npx alt süreci kill() ile kapanmıyordu (artık vite preview kalıyordu)
procs.push(preview);
for (let i = 0; ; i++) { try { const r = await fetch(`http://localhost:${wport}/`); if (r.ok) break; } catch { /* henüz değil */ } if (i > 75) throw new Error('önizleme başlamadı'); await sleep(200); }
const base = `http://localhost:${wport}/?sunucu=${encodeURIComponent(wsUrl)}`;
const cleanup = () => { for (const p of procs) { try { p.kill(); } catch { /* yok */ } } };

const browser = await chromium.launch({ headless: !args.has('--headed'), executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
async function player(tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(process.env.E2E_DSF ?? 1), isMobile: true, hasTouch: true, locale: 'tr-TR' });
  // ilk açılış rehberini (hikâye + anlatıcı turları + kilitler) atla: bu test başka bir akışı sınar (bkz. onboarding-e2e.mjs)
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('odi-v1')) localStorage.setItem('odi-v1', JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true } }, version: 3 })); } catch { /* depolama yok */ } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${wport}` }).catch(() => undefined);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|AudioContext|WebGL|GPU|Autoplay|WebSocket connection/i.test(m.text())) errors.push(`${tag}: ${m.text()}`); });
  return page;
}
let shotN = 0;
async function shot(page, name) {
  await sleep(400);
  const f = resolve(outDir, `${String(++shotN).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: f });
  const over = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.getElementById('root')?.scrollWidth ?? 0) - window.innerWidth);
  if (over > 0) { errors.push(`${name}: yatay taşma ${over}px`); console.log(`  ⚠ ${name}: yatay taşma ${over}px`); }
  console.log(`  📸 ${f.replace(root + '/', '')}`);
}
const tab = (page, label) => page.locator('nav.tabbar .tab', { hasText: label }).click();
const sub = (page, label) => page.locator('.subtabs .subtab', { hasText: label }).click();
const toastGone = async (page) => { for (let i = 0; i < 8 && await page.locator('.toast-top').count(); i++) { await page.locator('.toast-top').click({ timeout: 500 }).catch(() => undefined); await sleep(150); } };
const bannerGone = async (page) => { if (await page.locator('.fr-banner').count()) await page.locator('.fr-banner-x').click().catch(() => undefined); };
const back = (page) => page.locator('.screen-head button[aria-label="Geri"], .dm-head button[aria-label="Geri"]').first().click();
async function openFriends(page) { await tab(page, 'Profil'); await page.locator('.menu-tile', { hasText: 'Arkadaşlar' }).click(); await page.locator('.fr-mycode').waitFor(); }
async function longPress(page, loc) {
  const box = await loc.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await sleep(650); await page.mouse.up();
}

// ham istemci (C'nin hesabıyla: engel sonrası sunucu reddini doğrulamak için)
function rawClient() {
  const ws = new WebSocket(wsUrl); let id = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.t === 'res') { const p = pend.get(m.id); pend.delete(m.id); if (!p) return; if (m.ok) p.res(m.data); else p.rej(Object.assign(new Error(m.error), { code: m.code })); } };
  const ready = new Promise((r) => { ws.onopen = r; });
  const call = async (op, data) => { await ready; return new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ t: 'req', id: i, op, data })); }); };
  return { call, close: () => ws.close() };
}

try {
  const A = await player('A'); const B = await player('B'); const C = await player('C');

  step('1 · Üç oyuncu takma ad seçer');
  for (const [p, name, color] of [[A, 'Ayşe', 1], [B, 'Bora', 2], [C, 'Cem', 4]]) {
    await p.goto(base, { waitUntil: 'load' });
    await p.getByRole('button', { name: /Yola çık/ }).click({ timeout: 90_000 });
    await p.locator('.onboard').waitFor({ timeout: 20_000 });
    await p.getByRole('textbox', { name: 'Takma ad' }).fill(name);
    await p.locator('.swatch').nth(color).click();
    await p.getByRole('button', { name: 'Başla' }).click();
    await p.locator('.onboard').waitFor({ state: 'detached' });
    await toastGone(p);
    await tab(p, 'Profil'); // harita (WebGL) yerine hafif ekranda beklesinler
  }
  ok('Ayşe, Bora, Cem bağlı');

  step('2 · A, Bora\'yı isimle arar ve istek gönderir');
  await openFriends(A);
  await shot(A, 'A-arkadaslar-bos');
  await A.getByRole('textbox', { name: 'Oyuncu ara' }).fill('bor');
  await A.locator('[data-testid="arama-sonucu"]', { hasText: 'Bora' }).waitFor({ timeout: 8000 });
  await shot(A, 'A-arama-sonucu');
  await A.getByRole('button', { name: 'Bora ekle' }).click();
  await A.locator('[data-testid="arama-sonucu"] .fr-state', { hasText: 'İstek gitti' }).waitFor({ timeout: 8000 });
  ok('istek gönderildi');
  await toastGone(A);

  step('3 · B\'de istek bildirimi; B kabul eder');
  await B.locator('[data-testid="mesaj-bildirimi"]', { hasText: 'arkadaşlık isteği' }).waitFor({ timeout: 8000 });
  await shot(B, 'B-istek-bildirimi');
  await B.locator('.fr-banner-card').click();
  await B.locator('.fr-mycode').waitFor();
  await B.locator('[data-testid="gelen-istek"]', { hasText: 'Ayşe' }).waitFor({ timeout: 8000 });
  check(((await B.locator('.subtab.on').innerText()).includes('İstekler')), 'İstekler sekmesi rozetli açıldı');
  await shot(B, 'B-istekler');
  await B.locator('[data-testid="gelen-istek"]', { hasText: 'Ayşe' }).getByRole('button', { name: 'Kabul' }).click();
  await A.locator('[data-testid="mesaj-bildirimi"]', { hasText: 'kabul etti' }).waitFor({ timeout: 8000 });
  ok('A\'ya "kabul etti" bildirimi geldi');
  await bannerGone(A);
  await A.getByRole('button', { name: 'Aramayı temizle' }).click();
  await A.locator('[data-testid="arkadas-satiri"]', { hasText: 'Bora' }).waitFor({ timeout: 8000 });
  check(await A.locator('[data-testid="arkadas-satiri"] .fr-dot.on').count() === 1, 'Bora çevrimiçi (yeşil nokta)');
  await toastGone(A);
  await shot(A, 'A-arkadas-listesi');
  // B profil sekmesine döner (rozetleri görmek için)
  await toastGone(B);
  await back(B);
  await bannerGone(B);

  step('4 · A mesaj yazar → B\'de bildirim şeridi + okunmamış rozeti');
  await A.getByRole('button', { name: 'Bora ile mesajlaş' }).click();
  await A.locator('[data-testid="dm-ekrani"]').waitFor();
  await shot(A, 'A-bos-sohbet');
  await A.getByRole('textbox', { name: 'Mesaj' }).fill('Selam Bora! Bu akşam yarışalım mı? 🏁');
  await A.getByRole('button', { name: 'Gönder', exact: true }).click();
  await A.locator('[data-testid="dm-gorundu"]', { hasText: 'Gönderildi' }).waitFor({ timeout: 8000 });
  ok('A: ✓ Gönderildi');
  await B.locator('[data-testid="mesaj-bildirimi"]', { hasText: 'yarışalım' }).waitFor({ timeout: 8000 });
  await B.locator('nav.tabbar .tab', { hasText: 'Profil' }).locator('.dot').waitFor({ timeout: 8000 });
  const badge = (await B.locator('nav.tabbar .tab', { hasText: 'Profil' }).locator('.dot').innerText()).trim();
  check(badge === '1', `B profil sekmesi rozeti: ${badge}`);
  check((await B.locator('[data-testid="mesaj-rozeti"] .dot').innerText()).trim() === '1', 'B üst bar 💬 rozeti: 1');
  await shot(B, 'B-mesaj-bildirimi-rozet');

  step('5 · B sohbeti açar → A\'da "✓✓ Görüldü"');
  await B.locator('.fr-banner-card').click();
  await B.locator('[data-testid="dm-ekrani"]').waitFor();
  await B.locator('[data-testid="dm-mesaj"]', { hasText: 'yarışalım' }).waitFor();
  await A.locator('[data-testid="dm-gorundu"]', { hasText: '✓✓ Görüldü' }).waitFor({ timeout: 8000 });
  ok('A: ✓✓ Görüldü');
  await shot(A, 'A-goruldu');

  step('6 · B yazarken A\'da "yazıyor…"');
  await B.getByRole('textbox', { name: 'Mesaj' }).fill('Olur, ben');
  await A.locator('[data-testid="dm-durum"]', { hasText: 'yazıyor…' }).waitFor({ timeout: 8000 });
  await A.locator('.dm-typing').waitFor();
  ok('A: yazıyor… (başlık + baloncuk)');
  await shot(A, 'A-yaziyor');
  await B.getByRole('textbox', { name: 'Mesaj' }).fill('Olur, ben varım! Hangi bölüm? 😄');
  await B.getByRole('button', { name: 'Gönder', exact: true }).click();
  await A.locator('[data-testid="dm-mesaj"]', { hasText: 'Hangi bölüm' }).waitFor({ timeout: 8000 });
  check(!(await A.locator('.dm-typing').count()), 'yanıt gelince yazıyor… kalktı');

  step('7 · Tepki (uzun bas) ve Odi çıkartması');
  await longPress(B, B.locator('[data-testid="dm-mesaj"]', { hasText: 'yarışalım' }).locator('.dm-bubble'));
  await B.locator('.dm-react-bar').waitFor({ timeout: 4000 });
  await shot(B, 'B-uzun-bas-menu');
  await B.getByRole('button', { name: 'Tepki ❤️' }).click();
  await A.locator('[data-testid="dm-mesaj"]', { hasText: 'yarışalım' }).locator('.dm-reacts', { hasText: '❤️' }).waitFor({ timeout: 8000 });
  ok('A, B\'nin ❤️ tepkisini gördü');
  await A.getByRole('button', { name: 'Emoji ve çıkartmalar' }).click();
  await A.locator('.dm-panel-tabs button', { hasText: 'Odi' }).click();
  await shot(A, 'A-cikartma-paneli');
  await A.getByRole('button', { name: 'Çıkartma gönder: Yarışalım!' }).click();
  await B.locator('[data-testid="dm-mesaj"] .fr-sticker').waitFor({ timeout: 8000 });
  ok('çıkartma ulaştı');
  await shot(B, 'B-sohbet');
  await shot(A, 'A-sohbet');

  step('8 · A hediye gönderir → B ödül kutusunda görür');
  await back(A);
  await A.getByRole('button', { name: 'Bora için hediye gönder' }).click();
  await A.getByRole('button', { name: 'Bora için bugünkü hediye gönderildi' }).waitFor({ timeout: 8000 });
  ok('A: hediye gönderildi (bugün için kilitlendi)');
  await shot(A, 'A-hediye-gonderildi');
  await toastGone(A);
  await B.locator('[data-testid="mesaj-bildirimi"]', { hasText: 'hediye' }).waitFor({ timeout: 8000 });
  await shot(B, 'B-hediye-bildirimi');
  await B.locator('.fr-banner-card').click();
  await B.locator('.gift, .inbox-item, .card', { hasText: 'arkadaş hediyesi' }).first().waitFor({ timeout: 8000 });
  ok('B ödül kutusunda "Ayşe sana arkadaş hediyesi gönderdi"');
  await shot(B, 'B-odul-kutusu');
  await back(B);

  step('9 · B mesaj kutusu');
  for (let i = 0; i < 4 && !(await B.locator('nav.tabbar').count()); i++) { await back(B); await sleep(250); }
  await tab(B, 'Profil'); await B.locator('.menu-tile', { hasText: 'Mesajlar' }).click();
  await B.locator('[data-testid="sohbet-satiri"]', { hasText: 'Ayşe' }).waitFor({ timeout: 8000 });
  // B mesaj kutusundayken A yeni mesaj yazar → listede canlı okunmamış rozeti
  await A.getByRole('button', { name: 'Bora ile mesajlaş' }).click();
  await A.getByRole('textbox', { name: 'Mesaj' }).fill('Ödül kutuna küçük bir hediye bıraktım 🎁');
  await A.getByRole('button', { name: 'Gönder', exact: true }).click();
  await B.locator('[data-testid="sohbet-satiri"]', { hasText: 'hediye bıraktım' }).locator('.fr-unread', { hasText: '1' }).waitFor({ timeout: 8000 });
  ok('B mesaj kutusu: son mesaj önizlemesi + okunmamış 1');
  await bannerGone(B);
  await shot(B, 'B-mesajlar');
  await back(A);
  await back(B);

  step('10 · C, A\'ya istek atar; A reddeder');
  await openFriends(C);
  await C.getByRole('textbox', { name: 'Oyuncu ara' }).fill('Ayşe');
  await C.getByRole('button', { name: 'Ayşe ekle' }).click();
  await C.locator('[data-testid="arama-sonucu"] .fr-state', { hasText: 'İstek gitti' }).waitFor({ timeout: 8000 });
  await A.locator('[data-testid="mesaj-bildirimi"]', { hasText: 'arkadaşlık isteği' }).waitFor({ timeout: 8000 });
  await bannerGone(A);
  await sub(A, 'İstekler');
  await A.locator('[data-testid="gelen-istek"]', { hasText: 'Cem' }).waitFor();
  await shot(A, 'A-cem-istegi');
  await A.locator('[data-testid="gelen-istek"]', { hasText: 'Cem' }).getByRole('button', { name: 'Reddet' }).click();
  await A.locator('[data-testid="gelen-istek"]').waitFor({ state: 'detached', timeout: 8000 });
  ok('A reddetti');
  await C.getByRole('textbox', { name: 'Oyuncu ara' }).fill('');
  await sub(C, 'İstekler');
  await C.locator('.empty', { hasText: 'Bekleyen istek yok' }).waitFor({ timeout: 8000 });
  ok('C\'nin giden isteği listeden düştü');

  step('11 · A, C\'yi engeller (profil kartı)');
  await A.getByRole('textbox', { name: 'Oyuncu ara' }).fill('Cem');
  await A.getByRole('button', { name: 'Cem profili' }).click();
  await A.locator('[data-testid="profil-karti"]').waitFor();
  await shot(A, 'A-profil-karti-cem');
  await A.locator('.fr-card-quiet .linkish', { hasText: 'Engelle' }).click();
  await shot(A, 'A-engelle-onay');
  await A.locator('.fr-card-actions .btn.coral', { hasText: 'Engelle' }).click();
  await A.locator('.fr-rel-tag', { hasText: 'Engelledin' }).waitFor({ timeout: 8000 });
  ok('A: Cem engellendi');
  await A.locator('.sheet-wrap').click({ position: { x: 10, y: 10 } });
  await toastGone(A);

  step('12 · C, A\'ya istek/mesaj atamaz');
  await sub(C, 'Arkadaşlar');
  await C.getByRole('textbox', { name: 'Oyuncu ara' }).fill('Ayşe');
  await C.locator('.empty', { hasText: 'Kimseyi bulamadık' }).waitFor({ timeout: 8000 });
  ok('C aramada Ayşe\'yi göremiyor');
  await shot(C, 'C-arama-engelli');
  const token = await C.evaluate(() => localStorage.getItem('odi.net.token'));
  check(!!token, 'C oturum anahtarı okundu');
  // Ayşe'nin kimliği: engelsiz üçüncü bir istemci arar
  const look = rawClient();
  await look.call('hello', { version: 1, name: 'Deniz' });
  const aId = (await look.call('players.search', { query: 'Ayşe' })).players[0]?.profile.id;
  look.close();
  check(!!aId, 'Ayşe kimliği bulundu');
  const raw = rawClient(); // not: aynı anahtar ikinci bağlantıda C'nin tarayıcı oturumunu kapatır (test sonu)
  await raw.call('hello', { version: 1, token });
  check((await raw.call('players.search', { query: 'Ayşe' })).players.length === 0, 'sunucu: C için arama sonucu boş');
  const e1 = await raw.call('friends.request', { id: aId }).then(() => null, (e) => e);
  check(e1?.code === 'ENGEL', `sunucu: arkadaşlık isteği reddedildi (${e1?.code}: ${e1?.message})`);
  const e2 = await raw.call('dm.send', { to: aId, text: 'neden?' }).then(() => null, (e) => e);
  check(e2?.code === 'ENGEL', `sunucu: özel mesaj reddedildi (${e2?.code}: ${e2?.message})`);
  raw.close();
} catch (e) {
  failed = true;
  console.error('\nHATA:', e.message);
} finally {
  await browser.close().catch(() => undefined);
  cleanup();
}
const realErrors = errors.filter((e) => !/WebSocket/i.test(e));
if (realErrors.length) { console.log('\nKonsol/taşma uyarıları:'); for (const e of [...new Set(realErrors)]) console.log('  · ' + e); }
console.log(`\n${failed ? '✗ Başarısız' : '✓ Tüm adımlar geçti'} · ${shotN} ekran görüntüsü → ${outDir.replace(root + '/', '')}`);
process.exit(failed || realErrors.length ? 1 : 0);
