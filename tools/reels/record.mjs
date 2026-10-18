#!/usr/bin/env node
/**
 * ODİ "Nasıl oynanır?" Reels kaydı.
 * 1) Web uygulamasını derler, stüdyo sayfasını ve slayt görsellerini dist/reels altına koyar, vite preview ile sunar.
 * 2) Her sahneyi ayrı bir Playwright bağlamında 1080×1920 video olarak kaydeder (otomatik oyuncu gerçekten oynar).
 * 3) Sahne başlangıç ofsetlerini scenes.json'a yazar; birleştirme: tools/reels/compose.py
 * Kullanım: PLAYWRIGHT_CHROMIUM=... node tools/reels/record.mjs [--only kosu,yuzme] [--no-build]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../..', import.meta.url));
const out = path.join(root, 'tools/harness/out/reels');
const dist = path.join(out, 'dist');
const raw = path.join(out, 'raw');
const args = process.argv.slice(2);
const only = (args[args.indexOf('--only') + 1] ?? '').split(',').filter((s) => args.includes('--only') && s);
fs.mkdirSync(raw, { recursive: true });

const run = (cmd, a, cwd) => new Promise((res, rej) => { const p = spawn(cmd, a, { cwd, stdio: 'inherit' }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(cmd + ' ' + c)))); });
if (!args.includes('--no-build')) await run('npx', ['vite', 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'error'], path.join(root, 'apps/web'));
fs.mkdirSync(path.join(dist, 'reels/img'), { recursive: true });
fs.copyFileSync(path.join(root, 'tools/reels/studio.html'), path.join(dist, 'reels/studio.html'));
const img = (rel) => { const src = path.join(root, 'tools/harness/out', rel); const name = rel.replace(/[/\\]/g, '-'); fs.copyFileSync(src, path.join(dist, 'reels/img', name)); return `/reels/img/${name}`; };

/** Sahneler: süre (sn), kanca (üst) ve kontrol (alt) yazıları. at/until: ms. */
const SCENES = [
  { id: 'kosu', type: 'level', level: 3, dur: 10.5, caps: [
    { pos: 'top', at: 0, until: 3000, text: 'Kulağının içinde koşan<br>bir ses olsaydın? 👂' },
    { pos: 'top', at: 3200, until: 6200, text: 'Bu <span style="color:#ffd166">Odi</span>. Görevi:<br>ninniyi beyne ulaştırmak 🎵' },
    { pos: 'top', at: 6400, text: '1. Dış kulak: koş! 🏃', cls: 'coral' },
    { pos: 'bottom', at: 6400, until: 8600, text: '👆 <b>Dokun</b> → zıpla · basılı tut → daha yüksek' },
    { pos: 'bottom', at: 8700, text: '👇 <b>Aşağı kaydır</b> → kay' },
  ] },
  { id: 'trambolin', type: 'level', level: 10, skip: 0.3, dur: 5.5, caps: [
    { pos: 'top', at: 0, text: '2. Kulak zarı = trambolin 🥁', cls: 'coral' },
    { pos: 'bottom', at: 250, text: '👆 Zara değdiğin an <b>dokun</b> → <b>MÜKEMMEL!</b>' },
  ] },
  { id: 'makine', type: 'level', level: 14, skip: 0.3, dur: 5.5, caps: [
    { pos: 'top', at: 0, text: '3. Kemikçikler = dev makine ⚙️', cls: 'coral' },
    { pos: 'bottom', at: 250, text: 'Dişliye tutun · 👆 doğru anda <b>dokun</b> → fırla' },
  ] },
  { id: 'yuzme', type: 'level', level: 22, skip: 0.3, dur: 5, caps: [
    { pos: 'top', at: 0, text: '4. Kokleada yüz 🫧', cls: 'coral' },
    { pos: 'bottom', at: 250, text: '✋ <b>Basılı tut</b> → yüksel · kabarcıkla nefes al' },
  ] },
  { id: 'impuls', type: 'level', level: 34, salt: 7, skip: 0.3, dur: 4.5, caps: [
    { pos: 'top', at: 0, text: '5. Sinirde ışık hızı ⚡', cls: 'coral' },
    { pos: 'bottom', at: 250, text: '👈 👉 <b>Sola / sağa dokun</b> → şerit değiştir' },
  ] },
  { id: 'ruya', type: 'level', level: 36, salt: 3, skip: 0.3, dur: 4.5, caps: [
    { pos: 'top', at: 0, text: '6. Beyinde rüya modu 🌀', cls: 'coral' },
    { pos: 'bottom', at: 250, text: '👆 <b>Dokun</b> → yerçekimini çevir' },
  ] },
  { id: 'boss', type: 'level', level: 40, skip: 5.5, dur: 5, caps: [
    { pos: 'top', at: 0, text: '40 bölüm · 2 canavar 👹', cls: 'coral' },
    { pos: 'bottom', at: 250, text: 'Alçak dalga: <b>zıpla</b> · yüksek dalga: <b>kay</b>' },
  ] },
  { id: 'takim', type: 'slides', dur: 7, each: 1700, images: ['sosyal/05-A-takim-sohbet.png', 'sosyal/13-A-herkese-yardim-animasyon.png', 'sosyal/25-A-savas-haritasi.png', 'sosyal/27-A-baskin-sonra.png'], caps: [
    { pos: 'top', at: 0, until: 1650, text: 'Takımını kur, sohbet et 🤝' },
    { pos: 'top', at: 1750, until: 3350, text: 'Tek dokunuşla herkese yardım 💪' },
    { pos: 'top', at: 3450, until: 5050, text: 'Bölge Savaşı: kulağı fethedin ⚔️' },
    { pos: 'top', at: 5150, text: 'Canavarı birlikte eritin 👹' },
  ] },
  { id: 'yaris', type: 'slides', dur: 4.2, each: 2100, images: ['yaris/05-bora-yarista.png', 'yaris/07-ayse-sonuc.png'], caps: [
    { pos: 'top', at: 0, until: 2050, text: 'Arkadaşlarınla canlı yarış 🏁' },
    { pos: 'top', at: 2150, text: 'Kim önce beyne ulaşacak? 🧠' },
  ] },
  { id: 'kapanis', type: 'card', dur: 4.5, html: '{ODI}<h1>OD<span>İ</span></h1><div class="sub">Sesin Yolu</div><div class="line">Takımını kur. Kulağı fethet.</div><div class="small">Kulaktan kulağa 🎧 · çok yakında</div>' },
];

const port = 4700 + Math.floor(Math.random() * 200);
const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort', '--outDir', dist], { cwd: path.join(root, 'apps/web'), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1800));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

const meta = fs.existsSync(path.join(out, 'scenes.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'scenes.json'), 'utf8')) : {};
for (const sc of SCENES) {
  if (only.length && !only.includes(sc.id)) continue;
  const scene = { ...sc, images: sc.images?.map(img) };
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, recordVideo: { dir: raw, size: { width: 1080, height: 1920 } } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/reels/studio.html`, { waitUntil: 'load' });
  await page.evaluate((s) => window.startScene(s), scene);
  await page.waitForFunction(() => window.studio.readyAt > 0, null, { timeout: 60_000 });
  const readyWall = Date.now();
  const total = (sc.skip ?? 0) + sc.dur + 0.4;
  await page.waitForTimeout(total * 1000);
  const video = page.video();
  await ctx.close();
  const file = path.join(raw, `${sc.id}.webm`);
  fs.renameSync(await video.path(), file);
  meta[sc.id] = { file, start: (readyWall - t0) / 1000 + (sc.skip ?? 0), dur: sc.dur, errors };
  console.log(`🎬 ${sc.id}: başlangıç ${meta[sc.id].start.toFixed(2)} sn, süre ${sc.dur} sn${errors.length ? ' HATA: ' + errors.join(' | ') : ''}`);
}
fs.writeFileSync(path.join(out, 'scenes.json'), JSON.stringify({ ...meta, order: SCENES.map((s) => s.id) }, null, 2));
await browser.close(); preview.kill();
