#!/usr/bin/env node
// ODİ sosyal katman uçtan uca testi: gerçek sunucu (bellek içi veritabanı) + web derlemesi + iki ayrı tarayıcı bağlamı (iki oyuncu).
// Akış: takma ad → A takım kurar → B kodla katılır → karşılıklı sohbet → B kamp inşaatı + yardım ister → A "Herkese yardım et"
//       → B'nin süresi kısalır → A teknolojiye bağış → A test mağazasından takım hediyeli paket → B hediyeyi alır
//       → savaş hedefi → baskın can barı (üçüncü bir oyuncu sunucuya ilerleme gönderir) düşer. Her adımda 360×740 ekran görüntüsü.
// Kullanım: node tools/harness/social-e2e.mjs [--no-build] [--headed]
// Çıktı: tools/harness/out/sosyal/*.png
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const args = new Set(process.argv.slice(2));
const root = resolve(new URL('../..', import.meta.url).pathname);
const outDir = resolve(root, 'tools/harness/out/sosyal'); mkdirSync(outDir, { recursive: true });
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

// ---- sunucu (bellek içi, baskın sürekli açık, TEST mağazası açık)
const sport = 8800 + Math.floor(Math.random() * 400);
const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'apps/server/dist/server.mjs'], { cwd: root, env: { ...process.env, PORT: String(sport), HOST: '127.0.0.1', ODI_DB: ':memory:', ODI_RAID_ALWAYS: '1', ODI_TEST_STORE: '1', ODI_LOG: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
procs.push(server);
await new Promise((res, rej) => { server.stdout.on('data', (d) => { if (String(d).includes('hazır')) res(); }); server.on('exit', (c) => rej(new Error('sunucu kapandı ' + c))); setTimeout(() => rej(new Error('sunucu başlamadı')), 15_000); });
const wsUrl = `ws://127.0.0.1:${sport}`;

// ---- web önizleme
const wport = 5300 + Math.floor(Math.random() * 400);
const preview = spawn('npx', ['vite', 'preview', '--port', String(wport), '--strictPort', '--outDir', distDir], { cwd: resolve(root, 'apps/web'), stdio: 'ignore', shell: process.platform === 'win32' });
procs.push(preview);
await sleep(1800);
const base = `http://localhost:${wport}/?sunucu=${encodeURIComponent(wsUrl)}`;
const cleanup = () => { for (const p of procs) { try { p.kill(); } catch { /* yok */ } } };

const browser = await chromium.launch({ headless: !args.has('--headed'), executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
async function player(tag) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: Number(process.env.E2E_DSF ?? 2), isMobile: true, hasTouch: true, locale: 'tr-TR' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${wport}` }).catch(() => undefined);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|AudioContext|WebGL|GPU|Autoplay|WebSocket connection/i.test(m.text())) errors.push(`${tag}: ${m.text()}`); });
  return page;
}
let shotN = 0;
async function shot(page, name) {
  await sleep(450);
  const f = resolve(outDir, `${String(++shotN).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: f });
  // yatay taşma denetimi (360 px)
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (over > 0) { errors.push(`${name}: yatay taşma ${over}px`); console.log(`  ⚠ ${name}: yatay taşma ${over}px`); }
  console.log(`  📸 ${f.replace(root + '/', '')}`);
}
const tab = (page, label) => page.locator('nav.tabbar .tab', { hasText: label }).click();
const sub = (page, label) => page.locator('.subtabs .subtab', { hasText: label }).click();
const toastGone = async (page) => { for (let i = 0; i < 8 && await page.locator('.toast-top').count(); i++) { await page.locator('.toast-top').click({ timeout: 500 }).catch(() => undefined); await sleep(150); } };

// ---- üçüncü oyuncu (sunucuya doğrudan ilerleme gönderen gerçek istemci; tarayıcısız)
function rawClient() {
  const ws = new WebSocket(wsUrl); let id = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.t === 'res') { const p = pend.get(m.id); pend.delete(m.id); if (!p) return; if (m.ok) p.res(m.data); else p.rej(new Error(`${m.code}: ${m.error}`)); } };
  const ready = new Promise((r) => { ws.onopen = r; });
  const call = async (op, data) => { await ready; return new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ t: 'req', id: i, op, data })); }); };
  return { call, close: () => ws.close() };
}

try {
  const A = await player('A'); const B = await player('B');

  step('1 · Takma ad (ilk bağlantı)');
  for (const [p, name, color] of [[A, 'Ayşe', 2], [B, 'Bora', 5]]) {
    await p.goto(base, { waitUntil: 'load' });
    await p.getByRole('button', { name: /Yola çık/ }).click();
    await p.locator('.onboard').waitFor({ timeout: 15_000 });
    if (name === 'Ayşe') await shot(p, 'A-takma-ad');
    await p.getByRole('textbox', { name: 'Takma ad' }).fill(name);
    await p.locator('.swatch').nth(color).click();
    await p.getByRole('button', { name: 'Başla' }).click();
    await p.locator('.onboard').waitFor({ state: 'detached' });
    await toastGone(p);
  }
  check(await A.locator('.net-dot.on').count() > 0, 'A bağlı (yeşil nokta)');
  await shot(A, 'A-harita-ust-cubuk');

  step('2 · A takım kurar');
  await tab(A, 'Takım');
  await A.locator('.team-hero').waitFor();
  await shot(A, 'A-takimsiz');
  await A.getByRole('button', { name: '＋ Takım kur' }).first().click();
  await A.locator('.sheet').getByPlaceholder('ör. Koklea Kaşifleri').fill('Koklea Kaşifleri');
  await A.locator('.emoji-opt', { hasText: '🐚' }).click();
  await A.locator('.sheet').getByPlaceholder('ör. Her gün biraz, hep birlikte.').fill('Her gün biraz, hep birlikte.');
  await shot(A, 'A-takim-kur');
  await A.locator('.sheet').getByRole('button', { name: /Takımı kur/ }).click();
  await A.locator('.team-head').waitFor();
  await toastGone(A);
  await shot(A, 'A-takim-sohbet');
  await A.getByLabel('Takım menüsü').click();
  const code = (await A.locator('.big-code').innerText()).trim();
  check(/^[A-Z0-9]{6}$/.test(code), `takım kodu: ${code}`);
  await shot(A, 'A-takim-menusu');
  await A.locator('.sheet-wrap').click({ position: { x: 10, y: 10 } });

  step('3 · B kodla katılır');
  await tab(B, 'Takım');
  await B.getByLabel('Takım davet kodu').fill(code);
  await B.locator('.code-join').getByRole('button', { name: 'Katıl' }).click();
  await B.locator('.team-head').waitFor();
  await toastGone(B);
  check((await B.locator('.team-head h2').innerText()).includes('Koklea Kaşifleri'), 'B takımda');

  step('4 · Takım sohbeti: karşılıklı mesaj');
  await A.getByRole('textbox', { name: 'Mesaj' }).fill('Merhaba takım! Bu hafta kepçeyi alalım mı?');
  await A.getByRole('button', { name: 'Gönder', exact: true }).click();
  await B.locator('.msg .bubble', { hasText: 'kepçeyi alalım' }).waitFor({ timeout: 8000 });
  ok('B, A\'nın mesajını gördü');
  await B.getByRole('textbox', { name: 'Mesaj' }).fill('Selam Ayşe! Ben varım 💪');
  await B.getByRole('button', { name: 'Gönder', exact: true }).click();
  await A.locator('.msg .bubble', { hasText: 'Ben varım' }).waitFor({ timeout: 8000 });
  ok('A, B\'nin cevabını gördü');
  await sleep(1300); // sohbet hız sınırı: mesajlar arası 1,2 sn
  await A.getByRole('button', { name: 'Hızlı tepki 🔥' }).click();
  await B.locator('.msg.emoji .bubble', { hasText: '🔥' }).waitFor({ timeout: 8000 });
  ok('hızlı emoji tepkisi ulaştı');
  await shot(B, 'B-takim-sohbet');
  await shot(A, 'A-takim-sohbet-cevap');
  await sub(A, 'Üyeler');
  await shot(A, 'A-uyeler');

  step('5 · B kamp inşaatı başlatır ve yardım ister');
  await tab(B, 'Kamp');
  await B.locator('.building').first().waitFor();
  await shot(B, 'B-kamp');
  await B.locator('.building', { hasText: 'Ses Laboratuvarı' }).getByRole('button', { name: 'Yükselt' }).click();
  await B.locator('.sheet').getByRole('button', { name: 'Yükselt' }).click();
  await B.locator('.construction').waitFor();
  await toastGone(B);
  await B.getByRole('button', { name: /Takımdan yardım iste/ }).click();
  await B.getByRole('button', { name: /Yardım istendi/ }).waitFor();
  await toastGone(B);
  const leftBefore = (await B.locator('.big-count').innerText()).trim();
  await shot(B, 'B-insaat-yardim-istendi');

  step('6 · A "Herkese yardım et"');
  await tab(A, 'Takım');
  await sub(A, 'Yardım');
  await A.getByRole('button', { name: /Herkese yardım et \(1\)/ }).waitFor({ timeout: 8000 });
  await shot(A, 'A-yardim-listesi');
  await A.getByRole('button', { name: /Herkese yardım et/ }).click({ force: true }); // "nefes alan" animasyon nedeniyle
  await A.locator('.float-burst').waitFor();
  await sleep(250);
  await A.screenshot({ path: resolve(outDir, `${String(++shotN).padStart(2, '0')}-A-herkese-yardim-animasyon.png`) });
  await toastGone(A);

  step('7 · B\'nin süresi kısalır');
  // 60 sn'lik inşaat: bir yardım (en az 60 sn) bitirir → kutlama
  await B.locator('.reward-pop', { hasText: 'İnşaat bitti' }).waitFor({ timeout: 10_000 }).then(() => ok(`süre ${leftBefore} → 0:00, kutlama göründü`)).catch(async () => {
    const after = (await B.locator('.big-count').innerText().catch(() => '')).trim();
    check(after && after !== leftBefore, `süre kısaldı: ${leftBefore} → ${after}`);
  });
  await shot(B, 'B-insaat-bitti');
  await B.locator('.reward-pop .btn').click().catch(() => undefined);
  await toastGone(B);
  await shot(B, 'B-kamp-sonra');

  step('8 · A teknolojiye bağış');
  await sub(A, 'Teknoloji');
  const tech = A.locator('.tech', { hasText: 'Ortak Kazanç' });
  await tech.getByRole('button', { name: '🪙 100' }).click();
  await tech.locator('.qn', { hasText: '100/' }).waitFor({ timeout: 8000 });
  ok('bağış ilerlemeye yazıldı (100/…)');
  await shot(A, 'A-teknoloji-bagis');

  step('9 · A test mağazasından takım hediyeli paket alır');
  await A.getByLabel('Kristal ve mağaza').click();
  await A.locator('.test-banner').first().waitFor();
  check((await A.locator('.test-banner').first().innerText()).includes('TEST MAĞAZASI'), 'TEST MAĞAZASI uyarısı görünür');
  await shot(A, 'A-magaza');
  await A.locator('.product', { hasText: 'Başlangıç Paketi' }).getByRole('button', { name: /TL/ }).click();
  await A.locator('.sheet').waitFor();
  await shot(A, 'A-magaza-onay');
  await A.locator('.sheet').getByRole('button', { name: 'Test satın alması yap' }).click();
  await A.locator('.product', { hasText: 'Başlangıç Paketi' }).getByRole('button', { name: 'Alındı' }).waitFor({ timeout: 8000 });
  ok('satın alma tamam (ürün sınırı: Alındı)');
  await shot(A, 'A-magaza-sonra');

  step('10 · B hediyeyi görür ve alır');
  await tab(B, 'Takım');
  await sub(B, 'Hediyeler');
  await B.locator('.gift', { hasText: 'Ayşe takıma hediye gönderdi' }).waitFor({ timeout: 8000 });
  await shot(B, 'B-hediyeler');
  const crystalsBefore = await B.getByLabel('Kristal ve mağaza').innerText();
  await B.getByRole('button', { name: /Hepsini al/ }).click();
  await B.locator('.gift.done').first().waitFor({ timeout: 8000 });
  await toastGone(B);
  const crystalsAfter = await B.getByLabel('Kristal ve mağaza').innerText();
  check(crystalsBefore !== crystalsAfter, `B kristal: ${crystalsBefore.trim()} → ${crystalsAfter.trim()}`);
  await shot(B, 'B-hediye-alindi');

  step('10b · Bölüm yardımı → kalkan B\'nin ödül kutusuna; zarf sayacı; "Hepsini al"');
  await sub(B, 'Yardım');
  await B.getByRole('button', { name: /Yardım iste/ }).click();
  await toastGone(B);
  await A.locator('.screen-head .btn').first().click(); // mağazadan geri
  await sub(A, 'Yardım');
  await A.getByRole('button', { name: '🛡️ Gönder' }).click();
  await A.getByRole('button', { name: 'Gönderildi' }).waitFor({ timeout: 8000 });
  await toastGone(A);
  await B.locator('.env .dot').waitFor({ timeout: 8000 });
  ok(`B zarf sayacı: ${(await B.locator('.env .dot').innerText()).trim()}`);
  await shot(B, 'B-zarf-sayaci');
  await B.getByLabel(/Ödül kutusu/).click();
  await B.locator('.gift').first().waitFor();
  await shot(B, 'B-odul-kutusu');
  await B.getByRole('button', { name: /Hepsini al/ }).click();
  await B.locator('.empty').waitFor({ timeout: 8000 });
  ok('ödül alındı (kalkan bir sonraki bölümde kullanılacak)');
  await shot(B, 'B-odul-alindi');
  await B.locator('.screen-head .btn').first().click();

  step('11 · Savaş hedefi');
  await sub(A, 'Savaş');
  await A.locator('.war-map').waitFor();
  await A.getByRole('button', { name: /Hedefleri düzenle/ }).click();
  await A.locator('.region', { hasText: 'Kepçesi' }).click();
  await A.locator('.region', { hasText: 'Ninni Merkezi' }).click();
  await A.getByRole('button', { name: 'Kaydet' }).click();
  await A.locator('.region.target', { hasText: 'Kepçesi' }).waitFor();
  ok('hedefler kaydedildi');
  await shot(A, 'A-savas-haritasi');

  step('12 · Baskın: üçüncü oyuncu sunucuya ilerleme gönderir, can barı canlı düşer');
  await sub(A, 'Baskın');
  await A.locator('.raid .qn').waitFor();
  const hpBefore = (await A.locator('.raid .qn').innerText()).trim();
  await shot(A, 'A-baskin-once');
  const C = rawClient();
  await C.call('hello', { version: 1, name: 'Cem' });
  await C.call('team.join', { code });
  const ack = await C.call('progress.submit', { runId: `e2e-${Date.now()}`, level: 1, completed: true, stars: 3, score: 1200, timeSec: 42, coins: 60, biome: 'dis-kulak', mechanic: 'kosu' });
  check(ack.raidDamage > 0 && ack.warPoints > 0, `Cem: −${ack.raidDamage} baskın, +${ack.warPoints} savaş`);
  await A.waitForFunction((b) => document.querySelector('.raid .qn')?.textContent?.trim() !== b, hpBefore, { timeout: 8000 });
  const hpAfter = (await A.locator('.raid .qn').innerText()).trim();
  check(hpAfter !== hpBefore, `can barı canlı düştü: ${hpBefore} → ${hpAfter}`);
  await shot(A, 'A-baskin-sonra');
  await sub(A, 'Savaş');
  await A.locator('.region.ours', { hasText: 'Kepçesi' }).waitFor({ timeout: 8000 });
  ok('Kulak Kepçesi takımın oldu (Cem\'in puanı hedefe yazıldı)');
  await shot(A, 'A-savas-bolge-alindi');
  C.close();

  step('13 · Diğer ekranlar (360 px)');
  await sub(A, 'Hedefler'); await shot(A, 'A-hedefler');
  await sub(A, 'Sohbet'); await shot(A, 'A-sohbet-sistem-mesajlari');
  await tab(A, 'Profil'); await A.locator('.league-card').waitFor({ timeout: 8000 }); await shot(A, 'A-profil-lig');
  await A.locator('.league-card').click(); await shot(A, 'A-lig-listesi'); await A.locator('.screen-head .btn').first().click();
  await A.locator('.menu-tile', { hasText: 'Arkadaşlar' }).click(); await A.locator('.my-code').waitFor();
  const friendCodeB = await (async () => { await tab(B, 'Profil'); return (await B.locator('.profile-hero .mono').innerText()).trim(); })();
  await A.getByRole('textbox', { name: 'Arkadaş kodu' }).fill(friendCodeB); await A.getByRole('button', { name: 'Ekle' }).click();
  await A.locator('.friend', { hasText: 'Bora' }).waitFor({ timeout: 8000 }); await toastGone(A);
  await shot(A, 'A-arkadaslar');
  await A.getByLabel('Bora ile sohbet').click();
  await A.getByRole('textbox', { name: 'Mesaj' }).fill('Yarışa var mısın? 🏁'); await A.getByRole('button', { name: 'Gönder', exact: true }).click();
  await A.locator('.msg .bubble', { hasText: 'Yarışa var mısın' }).waitFor();
  await shot(A, 'A-ozel-sohbet');
  await A.locator('.screen-head .btn').first().click();
  await A.locator('.screen-head .btn').first().click();
  await A.getByLabel(/Ödül kutusu/).click(); await A.locator('.screen-head').waitFor(); await sleep(600); await shot(A, 'A-odul-kutusu');
  await A.locator('.screen-head .btn').first().click();
  await tab(A, 'Kamp'); await A.locator('.building').first().waitFor(); await shot(A, 'A-kamp');
  await tab(A, 'Bugün'); await shot(A, 'A-bugun');

  step('14 · Sonuç ekranı katkı satırları (önizleme: gerçek takım + hedefler, örnek onay)');
  await A.goto(`http://localhost:${wport}/?demo=sonuc&yildiz=3&skor=1840&bolum=2&katki=1&sunucu=${encodeURIComponent(wsUrl)}`, { waitUntil: 'load' });
  await A.locator('.team-contrib .tc-line').first().waitFor({ timeout: 15_000 });
  await sleep(1200);
  const lines = await A.locator('.team-contrib .tc-line').allInnerTexts();
  check(lines.some((l) => l.includes('savaş puanı') && l.includes('→')), `katkı satırı: ${lines[0]?.replace(/\s+/g, ' ')}`);
  await A.locator('.team-contrib').scrollIntoViewIfNeeded();
  await shot(A, 'A-sonuc-takim-katkisi');

  step('15 · Sunucusuz: nazik çevrimdışı kartı');
  const off = await player('Ç');
  await off.goto(`http://localhost:${wport}/?sunucu=${encodeURIComponent('ws://127.0.0.1:9')}`, { waitUntil: 'load' });
  await off.getByRole('button', { name: /Yola çık/ }).click();
  await tab(off, 'Takım');
  await off.locator('.offline-card').waitFor({ timeout: 20_000 });
  check((await off.locator('.offline-card').innerText()).includes('Sunucuya bağlanılamadı'), 'çevrimdışı kartı + Tekrar dene');
  await shot(off, 'cevrimdisi-takim');
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
