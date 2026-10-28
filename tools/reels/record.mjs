#!/usr/bin/env node
/**
 * ODİ Reels kaydı.
 *
 * 1) Teaser ve reklam Reels'leri (tools/reels/teasers.mjs, tools/reels/reklamlar.mjs):  node tools/reels/record.mjs --reel <slug|all> [--no-build] [--force-clips] [--no-overlay] [--clips-only]
 *    a. temiz oynanış klipleri: bot gerçekten oynar, sanal saatle kare kare (capture.mjs + clip.html) → out/reels/clips/<id>/
 *    b. yazı/kart katmanı: overlay.html sanal zamanla kare kare saydam PNG → out/reels/<slug>/ovl/
 *    c. plan.json (sahne zamanları, klipler, anlatıcı sesi, kesmeler)
 *    Anlatıcı (erkek VO): tools/reels/vo.py ile önceden üretilir (tools/reels/vo/<reels>/<id>.mp3); sahneler sese göre uzatılır (fitReel). → birleştirme: python3 tools/reels/compose.py --reel <slug>
 *
 *    --zaman: yalnız zaman çizelgesini yazdırır (derleme/çekim yok)
 *    --cover-only: yalnız kapak katmanı (kare katmanına dokunmaz); compose.py --reel <slug> --cover-only ile kapak PNG'si
 *
 * 2) Eski "Nasıl oynanır?" Reels'i (bayraksız, geriye uyumlu): node tools/reels/record.mjs [--only kosu,yuzme] [--no-build]
 *    studio.html'de gerçek zamanlı video kaydı (ağır çekim ts 0.1, compose.py 1/ts hızlandırır), yazılar sayfanın içinde.
 * Ortam: PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { root, outRoot, dist, prepareDist, stageImage, startPreview, launch, captureClip, clipDir } from './capture.mjs';

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);


/* ============================================================ teaser */
async function teasers(which) {
  const REELS = { ...(await import('./teasers.mjs')).REELS, ...(await import('./reklamlar.mjs')).REELS, ...(await import('./reklamlar3.mjs')).REELS, ...(await import('./reklamlar4.mjs')).REELS, ...(await import('./reklamlar5.mjs')).REELS, ...(await import('./reklamlar6b.mjs')).REELS };
  const slugs = which === 'all' ? Object.keys(REELS) : which.split(',');
  for (const s of slugs) if (!REELS[s]) throw new Error(`bilinmeyen Reels: ${s} (${Object.keys(REELS).join(', ')})`);
  if (flag('--zaman')) {  // yalnız zaman çizelgesi: sahneler (anlatıcıya göre uzatılmış) ve anlatıcı satırları
    for (const s of slugs) {
      const r = fitReel(REELS[s]); let t = 0;
      console.log(`\n${s}: ${r.scenes.reduce((a, x) => a + x.dur, 0).toFixed(2)} sn`);
      for (const sc of r.scenes) { console.log(`  ${t.toFixed(2).padStart(6)}–${(t + sc.dur).toFixed(2).padStart(6)} ${sc.id}${sc.clip ? ` (L${sc.clip.level} @${sc.clip.fromT}, klip ${sc.clip.dur})` : ''}${sc.mus ? ` ♪${sc.mus}` : ''}`); t += sc.dur; }
      for (const v of r.vo) console.log(`  🎙 ${v.start.toFixed(2)}–${(v.start + v.dur).toFixed(2)} ${v.id}: ${v.text}`);
    }
    return;
  }
  await prepareDist({ build: !flag('--no-build') });
  const pv = await startPreview();
  const browser = await launch(chromium);
  const progress = path.join(outRoot, 'ilerleme.log');
  const log = (m) => { console.log(m); fs.appendFileSync(progress, `${new Date().toISOString()} ${m}\n`); };
  try {
    // a. klipler (Reels'ler arasında ortak; hazır olan atlanır)
    if (!flag('--no-clips')) {
      const seen = new Set();
      for (const s of slugs) {
        const r = fitReel(REELS[s]);
        const clips = [...r.scenes.filter((x) => x.clip).map((x) => x.clip), ...(r.cover?.clip ? [r.cover.clip] : [])];
        for (const c of clips) { if (c.dir) continue; const id = clipDir(c); if (seen.has(id)) continue; seen.add(id); await captureClip(browser, pv.port, c, { force: flag('--force-clips'), log }); }  // c.dir: hazır kare dizisi (kamp-cekim.mjs + hazirla3.py)
      }
    }
    if (flag('--clips-only')) return;
    for (const s of slugs) await renderReel(fitReel(REELS[s]), browser, pv.port, log);
  } finally { await browser.close(); pv.stop(); }
}

/** Tüy Dede kaydının genliği (0..1), fps karede bir: ağız oynatma için */
function envelope(file, from, to, fps = 30) {
  const a = ['-v', 'error', ...(from ? ['-ss', String(from)] : []), ...(to ? ['-to', String(to)] : []), '-i', file, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'];
  const r = spawnSync('ffmpeg', a, { maxBuffer: 64 << 20 }); if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr);
  const x = new Int16Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 2));
  const w = Math.round(16000 / fps); const out = [];
  for (let i = 0; i + w <= x.length; i += w) { let s = 0; for (let j = i; j < i + w; j++) s += (x[j] / 32768) ** 2; out.push(Math.sqrt(s / w)); }
  const db = out.map((v) => 20 * Math.log10(v + 1e-6));
  return db.map((d) => Math.max(0, Math.min(1, (d + 42) / 30))).map((v, i, arr) => +(0.6 * v + 0.4 * (arr[i - 1] ?? v)).toFixed(3));
}

/** anlatıcı satırının süresi (sn): tools/reels/vo/<reels>/<id>.mp3 (tools/reels/vo.py üretir) */
const VO_DIR = path.join(root, 'tools/reels/vo');
const VO_TEXT = JSON.parse(fs.readFileSync(path.join(VO_DIR, 'metin.json'), 'utf8')).lines;
function voDur(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  if (r.status !== 0) throw new Error(`anlatıcı sesi yok: ${file} (önce: tools/reels/vo.py)`);
  return Number(String(r.stdout).trim());
}
/**
 * Sahneleri anlatıcıya göre zamanlar: her satır (vo: { id, scene, at }) bir sonrakinden önce bitmeli (0,12 sn ara); bitmiyorsa
 * sonraki satırın sahnesinden önceki sahne (aynı sahnedeyse o sahne) uzatılır ve satır kaydırılır. Son satır bitişten 0,25 sn önce
 * biter. Uzayan oynanış sahnesinin klibi yetmezse klip süresi büyütülür (yeni çekim). Sonuç: { ...reel, scenes, vo }.
 */
function fitReel(r0) {
  const r = { ...r0, scenes: r0.scenes.map((s) => ({ ...s })) };
  const vo = (r0.vo ?? []).map((v) => {
    const file = path.join(VO_DIR, r0.slug, `${v.id}.mp3`); const meta = (VO_TEXT[r0.slug] ?? []).find((x) => x.id === v.id);
    if (!meta) throw new Error(`metin.json'da yok: ${r0.slug}/${v.id}`);
    return { ...v, file, dur: voDur(file), text: meta.sub ?? meta.text };
  });
  const idx = (id) => r.scenes.findIndex((s) => s.id === id);
  const starts = () => { let t = 0; return r.scenes.map((s) => { const a = t; t += s.dur; return a; }); };
  for (let i = 0; i < vo.length; i++) {
    for (let guard = 0; guard < 4; guard++) {
      const st = starts(); const v = vo[i]; const si = idx(v.scene); if (si < 0) throw new Error(`sahne yok: ${v.scene}`);
      v.start = st[si] + (v.at ?? 0);
      const prevEnd = i ? vo[i - 1].start + vo[i - 1].dur + (r0.voGap ?? 0.12) : 0;
      if (v.start >= prevEnd - 1e-6) break;
      let delta = +(prevEnd - v.start + 0.001).toFixed(3);
      // reklam: sahneler vuruş ızgarasında kalsın (uzatma tam vuruş katı; kesmeler müziğin vuruşuna düşer)
      if (r0.snap) delta = +(Math.ceil(delta / r0.snap - 1e-6) * r0.snap).toFixed(3);
      const grow = vo[i - 1] && idx(vo[i - 1].scene) === si ? si : Math.max(0, si - 1);
      if (grow === si) v.at = (v.at ?? 0) + delta;
      r.scenes[grow].dur = +(r.scenes[grow].dur + delta).toFixed(3);
    }
  }
  const st = starts(); for (const v of vo) v.start = st[idx(v.scene)] + (v.at ?? 0);
  const total = st.at(-1) + r.scenes.at(-1).dur;
  const last = vo.at(-1); if (last && last.start + last.dur + (r0.tail ?? 0.25) > total) r.scenes.at(-1).dur = +(r.scenes.at(-1).dur + last.start + last.dur + (r0.tail ?? 0.25) - total).toFixed(3);
  for (const sc of r.scenes) if (sc.clip && !sc.clip.dir && clipNeed(sc) + 0.12 > sc.clip.dur) sc.clip = { ...sc.clip, dur: Math.ceil((clipNeed(sc) + 0.25) * 2) / 2 };
  r.vo = vo;
  return r;
}

/** hız rampası: speed bir sayı ya da [[yerel sn, hız], ...] (doğrusal); klipte geçen simülasyon süresi */
function clipTime(speed, lt) {
  if (!Array.isArray(speed)) return lt * (speed ?? 1);
  const at = (x) => { if (x <= speed[0][0]) return speed[0][1]; for (let i = 1; i < speed.length; i++) if (x <= speed[i][0]) { const [a, va] = speed[i - 1], [b, vb] = speed[i]; return va + (vb - va) * (x - a) / (b - a); } return speed.at(-1)[1]; };
  let s = 0; const n = Math.max(1, Math.ceil(lt / 0.01)); const h = lt / n; for (let i = 0; i < n; i++) s += at((i + 0.5) * h) * h; return s;
}
const clipNeed = (sc) => (sc.skip ?? 0) + clipTime(sc.speed, sc.dur);

async function renderReel(r, browser, port, log) {
  const fps = 30;
  const dir = path.join(outRoot, r.slug); const ovl = path.join(dir, 'ovl');
  fs.mkdirSync(dir, { recursive: true });
  // sahne başlangıçları (kesme: sert, ritme göre)
  let t = 0; const scenes = r.scenes.map((sc) => { const o = { ...sc, start: +t.toFixed(3) }; t += sc.dur; return o; }); const total = +t.toFixed(3);
  const byId = Object.fromEntries(scenes.map((s) => [s.id, s]));
  const stage = (L) => (['still', 'phone', 'full', 'lens', 'evid'].includes(L.kind) ? { ...L, src: stageImage(L.src) } : L);
  // Tüy Dede kayıtları: mutlak zaman, altyazılar, ağız zarfı
  const voice = (r.voice ?? []).map((v) => {
    const file = path.join(root, 'apps/web/public/voice', `${v.id}.mp3`);
    const at = +(byId[v.scene].start + (v.at ?? 0)).toFixed(3);
    return { ...v, file, at, env: envelope(file, v.from, v.to, fps) };
  });
  const subs = voice.flatMap((v) => (v.subs ?? []).map(([a, b, text]) => ({ kind: 'html', cls: 'sub', html: `<span class="who">Tüy Dede</span>${text}`, y: 1360, at: +(v.at + a).toFixed(3), until: +(v.at + b + 0.12).toFixed(3), anim: 'fade' })));
  // anlatıcı (erkek VO): satır başına bir altyazı, etiketsiz; bitiş kartında yazı zaten ekranda (nosub). Ağız oynatma yok.
  // dip: [[satır içi sn a, b, müzik dB, orta-tiz oyuğu dB]]: tek bir kelimenin altında müziği ayrıca kısar (compose.py › mix_audio_ad)
  const narr = (r.vo ?? []).map((v) => ({ id: v.id, file: v.file, at: +v.start.toFixed(3), from: 0, to: null, gain: v.gain ?? 1, fx: v.fx ?? r.vofx ?? null, dip: v.dip ?? null }));
  for (const v of r.vo ?? []) if (!v.nosub) subs.push({ kind: 'html', cls: `sub ${r.subCls ?? ''}`, html: v.text, y: v.subY ?? r.subY ?? 1360, at: +v.start.toFixed(3), until: +(v.start + v.dur + 0.15).toFixed(3), anim: 'fade' });
  // reklam: ses efektleri (sahne içi [at, tür, kazanç]) mutlak zamana
  const sfx = scenes.flatMap((sc) => (sc.sfx ?? []).map(([at, k, g, o]) => ({ t: +(sc.start + at).toFixed(3), k, g: g ?? 1, ...(o ?? {}) }))).sort((a, b) => a.t - b.t);
  // Ton Avı tonları (kulakligini-tak): ayrı iz, sabit ve ılımlı düzey (compose.py › mix_audio_ad)
  const tones = scenes.flatMap((sc) => (sc.tones ?? []).map(([at, f, d, g]) => ({ t: +(sc.start + at).toFixed(3), f, d, ...(g != null ? { g } : {}) })));
  const payload = {
    scenes: [...scenes.map((sc) => ({ id: sc.id, start: sc.start, dur: sc.dur, bg: sc.bg, ringY: sc.ringY, shade: sc.shade, flash: sc.flash, layers: (sc.layers ?? []).map(stage) })),
      { id: 'altyazi', start: 0, dur: total, bg: 'none', layers: subs }],
    voice: voice.filter((v) => v.lipsync !== false).map((v) => ({ at: v.at, fps, env: v.env })),
    scripts: r.scripts ?? [],  // ek çizim betikleri (tools/reels/ozel/*.js; katman kind 'ozel')
  };
  const plan = {
    slug: r.slug, title: r.title, fps, total, bpm: r.bpm, style: r.style, post: r.post, ad: !!r.ad, sfx, tones, tonesPost: r.tonesPost ?? null, aac: r.aac ?? null, duck: r.duck ?? null, limit: r.limit ?? 0.75,
    scenes: scenes.map((sc) => ({ id: sc.id, start: sc.start, dur: sc.dur, bg: sc.bg, frame: sc.frame ?? null, speed: sc.speed ?? 1,
      clip: sc.clip ? { ...sc.clip, dir: sc.clip.dir ?? clipDir(sc.clip) } : null, boss: !!sc.boss, flash: !!sc.flash,
      cam: sc.cam ?? null, fx: sc.fx ?? null, blend: !!sc.blend, mus: sc.mus ?? null, skip: sc.skip ?? 0 })),
    voice: [...voice.map((v) => ({ id: v.id, file: v.file, at: v.at, from: v.from ?? 0, to: v.to ?? null, gain: v.gain ?? 1 })), ...narr],
    cover: r.cover ? { clip: r.cover.clip ? { ...r.cover.clip, dir: r.cover.clip.dir ?? clipDir(r.cover.clip) } : null, t: r.cover.t ?? 1, frame: r.cover.frame ?? null, dim: r.cover.dim ?? null, blur: r.cover.blur ?? null, png: path.join(dir, 'kapak-katman.png') } : null,
    overlay: ovl,
  };
  if (flag('--no-overlay')) { fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify(plan, null, 1)); return; }
  const coverOnly = flag('--cover-only');
  if (!coverOnly) { fs.rmSync(ovl, { recursive: true, force: true }); fs.mkdirSync(ovl, { recursive: true }); }
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });
  page.on('response', (res) => { if (res.status() >= 400) errors.push(`${res.status()} ${new URL(res.url()).pathname}`); });  // hangi dosya eksik, adıyla
  await page.goto(`http://localhost:${port}/reels/overlay.html`, { waitUntil: 'load' });
  await page.evaluate((p) => window.setupReel(p), payload);
  const n = coverOnly ? 0 : Math.round(total * fps); let prev = null, prevFile = null, shots = 0; const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const sig = await page.evaluate((tt) => window.seek(tt), i / fps);
    const file = path.join(ovl, `o${String(i + 1).padStart(5, '0')}.png`);
    // opak arka planlı sahnede (gece, stüdyo, pano…) saydamlık gerekmez: JPEG (disk ~5 kat az); compose.py biçimi içerikten tanır
    const scNow = scenes.find((x) => i / fps >= x.start - 1e-6 && i / fps < x.start + x.dur - 1e-6); const opaque = r.jpegOpaque && scNow && scNow.bg && !['clip', 'none'].includes(scNow.bg);
    if (sig === prev && prevFile) fs.linkSync(prevFile, file);
    else { await page.screenshot(opaque ? { path: file, type: 'jpeg', quality: 93 } : { path: file, omitBackground: true }); shots++; }
    prev = sig; prevFile = file;
    if (i % 150 === 0) log(`🖼  ${r.slug}: ${i}/${n} kare`);
  }
  // kapak katmanı
  if (r.cover) {
    await page.evaluate((p) => window.setupReel(p), { scenes: [{ id: 'kapak', start: 0, dur: 9, bg: r.cover.bg ?? 'none', ringY: 760, shade: r.cover.clip ? 'both' : undefined, layers: r.cover.layers.map(stage) }], voice: [], scripts: r.scripts ?? [] });
    await page.evaluate((tt) => window.seek(tt), r.cover.seek ?? 4);
    await page.screenshot({ path: plan.cover.png, omitBackground: true });
  }
  await ctx.close();
  fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify(plan, null, 1));
  log(`✅ ${r.slug}: ${n} katman karesi (${shots} çekim), ${((Date.now() - t0) / 1000).toFixed(0)} sn${errors.length ? ' HATA: ' + errors.join(' | ') : ''}`);
}

/* ============================================================ eski "Nasıl oynanır?" */
async function legacy() {
  const out = outRoot;
  const raw = path.join(out, 'raw');
  const only = (opt('--only') ?? '').split(',').filter(Boolean);
  fs.mkdirSync(raw, { recursive: true });
  await prepareDist({ build: !flag('--no-build') });
  const img = (rel) => stageImage(rel);
  /**
   * Sahneler: süre (sn), kanca (üst) ve kontrol (alt) yazıları. at/until: ms.
   * fromT: sahne, botun simülasyonu bu saniyeye gelince başlar (zamanlar: node tools/reels/zaman.mjs). boss: müzik ağırlaşır.
   */
  const N = (k) => `<span class="n">${k}</span>`;
  /** oyun sahneleri ağır çekimde kaydedilir (yazılım GL birkaç kare/sn çizer), compose.py 1/TS hızlandırır */
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
    { id: 'duvar', type: 'level', level: 7, fromT: 12.1, dur: 4.6, caps: [
      { pos: 'top', at: 0, text: `${N(2)}Kanal: duvardan duvara`, cls: 'coral' },
      { pos: 'bottom', at: 200, text: 'Duvara değince <b>dokun</b> → karşıya zıpla 🧗' },
    ] },
    { id: 'zar', type: 'level', level: 10, fromT: 39.4, dur: 4.8, caps: [
      { pos: 'top', at: 0, text: `${N(3)}Kulak Zarı: süzül ve sıçra`, cls: 'coral' },
      { pos: 'bottom', at: 200, until: 1900, text: 'Havada <b>basılı tut</b> → ses kanatlarıyla süzül 🪽' },
      { pos: 'bottom', at: 2000, text: '🥁 Zara değdiğin an <b>dokun</b> → <b>Güçlü!</b> sıçra' },
    ] },
    { id: 'kanca', type: 'level', level: 13, fromT: 41.0, dur: 3.8, caps: [
      { pos: 'top', at: 0, text: `${N(4)}Kemikçikler: sallan, çakıl`, cls: 'coral' },
      { pos: 'bottom', at: 200, text: 'Kancanın yanında <b>basılı tut</b> → sallan · bırak → fırla' },
    ] },
    { id: 'cakil', type: 'level', level: 15, fromT: 50.5, dur: 3.6, caps: [
      { pos: 'top', at: 0, text: `${N(4)}Kemikçikler: sallan, çakıl`, cls: 'coral' },
      { pos: 'bottom', at: 100, text: 'Havada <b>aşağı kaydır</b> → yere çakıl, anahtarı kır 💥' },
    ] },
    { id: 'golem', type: 'level', level: 20, fromT: 10.7, dur: 6.2, boss: true, caps: [
      { pos: 'top', at: 0, text: 'Kanalın sonunda: <em>Serumen Golemi</em> 🗿' },
      { pos: 'bottom', at: 200, until: 3400, text: 'Yumruğun gölgesinden kaç · saplanınca <b>üstüne çık</b>' },
      { pos: 'bottom', at: 3500, text: '👇 Yumruğa <b>çakıl</b> → hasar! Her fazda daha öfkeli 😤' },
    ] },
    { id: 'yuzme', type: 'level', level: 22, fromT: 60.0, dur: 4.6, caps: [
      { pos: 'top', at: 0, text: `${N(5)}Koklea: sıvıda yüz 🫧`, cls: 'coral' },
      { pos: 'bottom', at: 200, text: '✋ <b>Basılı tut</b> → yüksel · bırak → dal · nefesine dikkat' },
    ] },
    { id: 'darbe', type: 'level', level: 31, fromT: 22.2, dur: 4.6, caps: [
      { pos: 'top', at: 0, text: `${N(6)}Sinir: ses darbesi ⚡`, cls: 'coral' },
      { pos: 'bottom', at: 200, text: '👉 <b>İleri kaydır</b> → atıl · gürültü duvarını kır' },
    ] },
    { id: 'cevir', type: 'level', level: 35, fromT: 6.2, dur: 4.8, caps: [
      { pos: 'top', at: 0, text: `${N(7)}Beyin sapı: yerçekimi senin elinde 🌀`, cls: 'coral' },
      { pos: 'bottom', at: 200, text: 'Mor bölgede <b>dokun</b> → yerçekimini çevir' },
    ] },
    { id: 'canavar', type: 'level', level: 40, fromT: 9.8, dur: 6.8, boss: true, caps: [
      { pos: 'top', at: 0, text: 'Son kapı: <em>Gürültü Canavarı</em> 👹' },
      { pos: 'bottom', at: 200, until: 3000, text: 'Bağırınca beliren <b>3 notayı topla</b> → kalbi açılır' },
      { pos: 'bottom', at: 3100, text: '👉 <b>Atıl</b> ya da 👇 <b>çakıl</b> → kalbine vur!' },
    ] },
    { id: 'takim', type: 'slides', dur: 7, each: 1700, images: ['tanitim/img/sosyal/05-takim-sohbeti.jpg', 'tanitim/img/sosyal/20-yardim-karti.jpg', 'tanitim/img/etkinlik/80-bolge-savasi.jpg', 'tanitim/img/etkinlik/90-baskin.jpg'], caps: [
      { pos: 'top', at: 0, until: 1650, text: 'Takımını kur, sohbet et 🤝' },
      { pos: 'top', at: 1750, until: 3350, text: 'Tek dokunuşla herkese yardım 💪' },
      { pos: 'top', at: 3450, until: 5050, text: 'Bölge Savaşı: kulağı fethedin ⚔️' },
      { pos: 'top', at: 5150, text: 'Canavarı birlikte eritin 👹' },
    ] },
    { id: 'yaris', type: 'slides', dur: 4.2, each: 2100, images: ['tanitim/img/sosyal/64-yaris-hayaletler.jpg', 'tanitim/img/sosyal/65-yaris-sonucu.jpg'], caps: [
      { pos: 'top', at: 0, until: 2050, text: 'Arkadaşlarınla canlı yarış 🏁' },
      { pos: 'top', at: 2150, text: 'Kim önce beyne ulaşacak? 🧠' },
    ] },
    { id: 'kapanis', type: 'card', dur: 4.5, html: '{ODI}<h1>OD<span>İ</span></h1><div class="sub">Sesin Yolu</div><div class="line">Takımını kur. Kulağı fethet.</div><div class="small">Kulaktan kulağa 🎧 · yakında</div>' },
  ];
  const pv = await startPreview();
  const browser = await launch(chromium);
  const metaFile = path.join(out, 'scenes.json');
  const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
  for (const sc of SCENES) {
    if (only.length && !only.includes(sc.id)) continue;
    const ts = sc.type === 'level' ? (sc.ts ?? TS) : 1;
    const scene = { ...sc, ts, images: sc.images?.map(img) };
    const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, recordVideo: { dir: raw, size: { width: 1080, height: 1920 } } });
    const page = await ctx.newPage();
    const t0 = Date.now();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${pv.port}/reels/studio.html`, { waitUntil: 'load' });
    await page.evaluate((s) => window.startScene(s), scene);
    await page.waitForFunction(() => window.studio.readyAt > 0, null, { timeout: 300_000, polling: 'raf' });
    const readyWall = Date.now();
    const total = ((sc.skip ?? 0) + sc.dur) / ts + 0.4;
    await page.waitForTimeout(total * 1000);
    const video = page.video();
    await ctx.close();
    const file = path.join(raw, `${sc.id}.webm`);
    fs.renameSync(await video.path(), file);
    meta[sc.id] = { file, start: (readyWall - t0) / 1000 + (sc.skip ?? 0) / ts, dur: sc.dur, speed: ts, boss: !!sc.boss, errors };
    console.log(`🎬 ${sc.id}: başlangıç ${meta[sc.id].start.toFixed(2)} sn, süre ${sc.dur} sn${errors.length ? ' HATA: ' + errors.join(' | ') : ''}`);
  }
  fs.writeFileSync(metaFile, JSON.stringify({ ...meta, order: SCENES.map((s) => s.id) }, null, 2));
  await browser.close(); pv.stop();
  void spawn; void dist;
}

if (opt('--reel')) await teasers(opt('--reel'));
else await legacy();
