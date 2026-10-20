#!/usr/bin/env node
// ODİ kutlama görsel denetimi: web derlemesini açar; sonuç ekranı, sandık açma (iniş, sallanma, patlama, kartlar, toplama),
// jeton uçuşu, seviye atlama, biyom canlandı ve tema ekranlarının ekran görüntülerini alır; yatay taşmayı denetler.
// Kullanım: node tools/harness/kutlama.mjs [--no-build] [--w 390] [--h 844]
// Çıktı: tools/harness/out/kutlama/*.png
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const W = Number(arg('w', 390)), H = Number(arg('h', 844));
const root = resolve(new URL('../..', import.meta.url).pathname);
const out = resolve(root, 'tools/harness/out/kutlama'); mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) if (f.endsWith('.png')) rmSync(resolve(out, f));
const dist = resolve(out, 'dist');
const run = (cmd, a, opts = {}) => new Promise((res, rej) => { const p = spawn(cmd, a, { cwd: root, stdio: 'inherit', ...opts }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} → ${c}`)))); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!argv.includes('--no-build') || !existsSync(resolve(dist, 'index.html'))) await run('npx', ['vite', 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'warn'], { cwd: resolve(root, 'apps/web') });
const port = 6100 + Math.floor(Math.random() * 400);
const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort', '--outDir', dist], { cwd: resolve(root, 'apps/web'), stdio: 'ignore' });
await sleep(1800);
const base = `http://localhost:${port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = []; const shots = [];

async function page(w = W, h = H) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'tr-TR' });
  // ilk açılış rehberini (hikâye + anlatıcı turları + kilitler) atla: bu test başka bir akışı sınar (bkz. onboarding-e2e.mjs)
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('odi-v1')) localStorage.setItem('odi-v1', JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true } }, version: 3 })); } catch { /* depolama yok */ } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|WebSocket|ws:\/\/|ERR_CONNECTION|AudioContext|vibrate/i.test(m.text())) errors.push(m.text()); });
  return p;
}
async function shot(p, name) {
  const f = resolve(out, `${name}.png`); await p.screenshot({ path: f }); shots.push(f);
  const over = await p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.getElementById('root')?.scrollWidth ?? 0) - window.innerWidth);
  if (over > 0) errors.push(`${name}: yatay taşma ${over}px`);
  console.log(`  📸 ${name}${over > 0 ? `  ⚠ taşma ${over}px` : ''}`);
}
const cel = (p, fn, arg) => p.evaluate(([f, a]) => { void window.__celebrate[f](a); }, [fn, arg]);

try {
  console.log('▶ sonuç ekranı');
  {
    const p = await page();
    await p.goto(`${base}/?demo=sonuc&yildiz=3&skor=2480&rekor=1&acilim=1&kutlama=0`, { waitUntil: 'load' });
    await sleep(1000); await shot(p, '01-sonuc-yildizlar');
    await sleep(2600); await shot(p, '02-sonuc-jetonlar');
    await sleep(2600); await shot(p, '03-sonuc-son');
    await p.close();
    const q = await page();
    await q.goto(`${base}/?demo=sonuc&yildiz=2&skor=1640&seviye=1&acilim=1`, { waitUntil: 'load' });
    await sleep(5200); await shot(q, '04-sonuc-seviye-atlama');
    await q.close();
    const r = await page();
    await r.goto(`${base}/?demo=sonuc&yildiz=0&skor=420`, { waitUntil: 'load' });
    await sleep(2500); await shot(r, '05-sonuc-kaybetti');
    await r.close();
  }

  console.log('▶ sandık, jeton, seviye, biyom (Bugün ekranında)');
  const p = await page();
  await p.goto(`${base}/?kutlama=1`, { waitUntil: 'load' });
  await p.getByRole('button', { name: /Yola çık|Devam et/ }).click();
  await sleep(600);
  await p.locator('nav.tabbar .tab', { hasText: 'Bugün' }).click();
  await sleep(700); await shot(p, '10-bugun');
  await cel(p, 'chest', { title: 'Günlük sandık', tier: 'altin', items: [{ kind: 'jeton', amount: 150 }, { kind: 'xp', amount: 40 }, { kind: 'kart', amount: 1, ref: 'koklea-1:ilk' }] });
  await sleep(350); await shot(p, '11-sandik-inis');
  await sleep(900); await shot(p, '12-sandik-sallanma');
  await sleep(1350); await shot(p, '13-sandik-patlama');
  await sleep(1500); await shot(p, '14-sandik-kartlar');
  await p.getByRole('button', { name: 'Topla' }).click();
  await sleep(450); await shot(p, '15-sandik-topla-jetonlar');
  await sleep(2200);
  await cel(p, 'coins', { amount: 120, from: { x: W / 2, y: H * 0.6 } });
  await sleep(520); await shot(p, '16-jeton-ucusu');
  await sleep(1800);
  await cel(p, 'levelUp', { level: 7, unlocks: ['Yeni hareket: Çift zıplama', 'Kulak Kartı: Örs', 'Kostüm: Kaşif şapkası'] });
  await sleep(450); await shot(p, '17-seviye-patlama');
  await sleep(1900); await shot(p, '18-seviye-liste');
  await p.getByRole('button', { name: 'Harika!' }).click(); await sleep(700);
  await cel(p, 'biomeRestored', { biome: 'koklea-1', name: 'Koklea · Taban', reward: [{ kind: 'jeton', amount: 200 }, { kind: 'kristal', amount: 10 }, { kind: 'kozmetik', amount: 1, ref: 'renk-turkuaz' }] });
  await sleep(700); await shot(p, '19-biyom-yukselis');
  await sleep(2900); await shot(p, '20-biyom-canlandi');
  await p.getByRole('button', { name: 'Topla' }).click(); await sleep(2500);
  await cel(p, 'banner', { icon: '🏗️', title: 'Laboratuvar 3. seviye!', body: 'İnşaat bitti', tone: 'gold' });
  await sleep(500); await shot(p, '21-serit');
  await sleep(2600);
  await p.locator('nav.tabbar .tab', { hasText: 'Profil' }).click(); await sleep(600); await shot(p, '22-profil');
  await p.locator('.menu-tile', { hasText: 'Ayarlar' }).click(); await sleep(600); await shot(p, '23-ayarlar');
  await p.close();

  console.log('▶ 360 px taşma denetimi');
  const n = await page(360, 740);
  await n.goto(`${base}/?demo=sonuc&yildiz=3&skor=12480&rekor=1&acilim=1&kutlama=0`, { waitUntil: 'load' });
  await sleep(6500); await shot(n, '30-dar-sonuc');
  await n.goto(`${base}/?kutlama=1`, { waitUntil: 'load' });
  await n.getByRole('button', { name: /Yola çık|Devam et/ }).click(); await sleep(500);
  await n.locator('nav.tabbar .tab', { hasText: 'Bugün' }).click(); await sleep(600); await shot(n, '31-dar-bugun');
  await cel(n, 'chest', { title: 'Takvim · 7. gün', tier: 'gumus', items: [{ kind: 'jeton', amount: 80 }, { kind: 'koruyucu', amount: 1 }, { kind: 'xp', amount: 30 }, { kind: 'kristal', amount: 5 }, { kind: 'jeton', amount: 20 }] });
  await sleep(4400); await shot(n, '32-dar-sandik-kartlar');
  await n.close();
} catch (e) { errors.push('akış: ' + String(e.message ?? e).split('\n')[0]); }

await browser.close(); preview.kill();
console.log(`\n${shots.length} ekran görüntüsü → tools/harness/out/kutlama/`);
if (errors.length) { console.log('SORUNLAR:\n  ' + [...new Set(errors)].join('\n  ')); process.exit(1); }
