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

/**
 * Sahneler: süre (sn), kanca (üst) ve kontrol (alt) yazıları. at/until: ms.
 * fromT: sahne, botun simülasyonu bu saniyeye gelince başlar — bot o anda gerçekten o yeteneği kullanıyor
 * (zamanlar tools/reels/probe.mjs ile ölçüldü: duvar zıplaması, süzülme, trambolin, kanca, çakılma, yüzme, darbe, çevirme, boss vuruşları).
 * boss: true → müzik o sahnede ağırlaşır (compose.py → music.py).
 */
const N = (n) => `<span class="n">${n}</span>`;
/** oyun sahneleri ağır çekimde kaydedilir (yazılım GL ~6 kare/sn çizer), compose.py 1/TS hızlandırır → akıcı ~24 kare/sn */
const TS = Number(process.env.REELS_TS ?? 0.1);
const SCENES = [
  { id: 'kosu', type: 'level', level: 4, fromT: 33.0, dur: 10.5, caps: [
    { pos: 'top', at: 0, until: 3000, text: 'Kulağının içinde koşan<br>bir ses olsaydın? 👂' },
    { pos: 'top', at: 3200, until: 6300, text: 'Bu <em>Odi</em>. Görevi:<br>ninniyi beyne ulaştırmak 🎵' },
    { pos: 'top', at: 6500, text: `${N(1)}Dış Kulak: koş, zıpla, kay`, cls: 'coral' },
    { pos: 'bottom', at: 300, until: 2100, text: '👆 <b>Dokun</b> → zıpla · <b>basılı tut</b> → daha yükseğe' },
    { pos: 'bottom', at: 2200, until: 4700, text: '👇 <b>Aşağı kaydır</b> → altından kay' },
    { pos: 'bottom', at: 4800, until: 8400, text: '🦶 Gürültü yaratığının <b>üstüne zıpla</b> → ez!' },
    { pos: 'bottom', at: 8500, text: 'Notaları topla 🎵 · <i>altın koklealar</i> gizli yerlerde' },
  ] },
  { id: 'duvar', type: 'level', level: 7, fromT: 43.8, dur: 4.6, caps: [
    { pos: 'top', at: 0, text: `${N(2)}Kanal: duvardan duvara`, cls: 'coral' },
    { pos: 'bottom', at: 200, text: 'Duvara değince <b>dokun</b> → karşıya zıpla 🧗' },
  ] },
  { id: 'zar', type: 'level', level: 10, fromT: 4.6, dur: 4.8, caps: [
    { pos: 'top', at: 0, text: `${N(3)}Kulak Zarı: süzül ve sıçra`, cls: 'coral' },
    { pos: 'bottom', at: 200, until: 1900, text: 'Havada <b>basılı tut</b> → ses kanatlarıyla süzül 🪽' },
    { pos: 'bottom', at: 2000, text: '🥁 Zara değdiğin an <b>dokun</b> → <b>Güçlü!</b> sıçra' },
  ] },
  { id: 'kanca', type: 'level', level: 14, fromT: 12.0, dur: 3.8, caps: [
    { pos: 'top', at: 0, text: `${N(4)}Kemikçikler: sallan, çakıl`, cls: 'coral' },
    { pos: 'bottom', at: 200, text: 'Kancanın yanında <b>basılı tut</b> → sallan · bırak → fırla' },
  ] },
  { id: 'cakil', type: 'level', level: 16, fromT: 22.9, dur: 3.6, caps: [
    { pos: 'top', at: 0, text: `${N(4)}Kemikçikler: sallan, çakıl`, cls: 'coral' },
    { pos: 'bottom', at: 100, text: 'Havada <b>aşağı kaydır</b> → yere çakıl, anahtarı kır 💥' },
  ] },
  { id: 'golem', type: 'level', level: 20, fromT: 2.6, dur: 6.2, boss: true, caps: [
    { pos: 'top', at: 0, text: 'Kanalın sonunda: <em>Serumen Golemi</em> 🗿' },
    { pos: 'bottom', at: 200, until: 3400, text: 'Yumruğun gölgesinden kaç · saplanınca <b>üstüne çık</b>' },
    { pos: 'bottom', at: 3500, text: '👇 Yumruğa <b>çakıl</b> → hasar! Her fazda daha öfkeli 😤' },
  ] },
  { id: 'yuzme', type: 'level', level: 22, fromT: 7.2, dur: 4.6, caps: [
    { pos: 'top', at: 0, text: `${N(5)}Koklea: sıvıda yüz 🫧`, cls: 'coral' },
    { pos: 'bottom', at: 200, text: '✋ <b>Basılı tut</b> → yüksel · bırak → dal · nefesine dikkat' },
  ] },
  { id: 'darbe', type: 'level', level: 32, fromT: 14.9, dur: 4.6, caps: [
    { pos: 'top', at: 0, text: `${N(6)}Sinir: ses darbesi ⚡`, cls: 'coral' },
    { pos: 'bottom', at: 200, text: '👉 <b>İleri kaydır</b> → atıl · gürültü duvarını kır' },
  ] },
  { id: 'cevir', type: 'level', level: 36, fromT: 35.0, dur: 4.8, caps: [
    { pos: 'top', at: 0, text: `${N(7)}Beyin sapı: yerçekimi senin elinde 🌀`, cls: 'coral' },
    { pos: 'bottom', at: 200, text: 'Mor bölgede <b>dokun</b> → yerçekimini çevir' },
  ] },
  { id: 'canavar', type: 'level', level: 40, fromT: 9.8, dur: 6.8, boss: true, caps: [
    { pos: 'top', at: 0, text: 'Son kapı: <em>Gürültü Canavarı</em> 👹' },
    { pos: 'bottom', at: 200, until: 3000, text: 'Bağırınca beliren <b>3 notayı topla</b> → kalbi açılır' },
    { pos: 'bottom', at: 3100, text: '👉 <b>Atıl</b> ya da 👇 <b>çakıl</b> → kalbine vur!' },
  ] },
  { id: 'final', type: 'level', level: 40, fromT: 30.4, dur: 3.4, boss: true, caps: [
    { pos: 'top', at: 0, text: '40 bölüm · 2 canavar · <em>1 ninni</em> 🎶' },
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
  const ts = sc.type === 'level' ? (sc.ts ?? TS) : 1;
  const scene = { ...sc, ts, images: sc.images?.map(img) };
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, recordVideo: { dir: raw, size: { width: 1080, height: 1920 } } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/reels/studio.html`, { waitUntil: 'load' });
  await page.evaluate((s) => window.startScene(s), scene);
  await page.waitForFunction(() => window.studio.readyAt > 0, null, { timeout: 180_000, polling: 'raf' });
  const readyWall = Date.now();
  const probe = () => page.evaluate(() => { try { const s = document.getElementById('game').contentWindow.__odiScene; return s ? { t: s.sim.t, f: s.game.loop.frame } : null; } catch { return null; } });
  const p0 = await probe();
  const total = ((sc.skip ?? 0) + sc.dur) / ts + 0.4;
  await page.waitForTimeout(total * 1000);
  const p1 = await probe();
  const video = page.video();
  await ctx.close();
  const file = path.join(raw, `${sc.id}.webm`);
  fs.renameSync(await video.path(), file);
  meta[sc.id] = { file, start: (readyWall - t0) / 1000 + (sc.skip ?? 0) / ts, dur: sc.dur, speed: ts, boss: !!sc.boss, errors };
  // kare/sn: çizilen oyun karesi ÷ video süresi (hızlandırma sonrası)
  const info = p0 && p1 ? `, sim ${p0.t.toFixed(2)}→${p1.t.toFixed(2)} sn, ${((p1.f - p0.f) / (total * ts)).toFixed(0)} kare/sn (sonuç)` : '';
  console.log(`🎬 ${sc.id}: başlangıç ${meta[sc.id].start.toFixed(2)} sn, süre ${sc.dur} sn${info}${errors.length ? ' HATA: ' + errors.join(' | ') : ''}`);
}
fs.writeFileSync(path.join(out, 'scenes.json'), JSON.stringify({ ...meta, order: SCENES.map((s) => s.id) }, null, 2));
await browser.close(); preview.kill();
