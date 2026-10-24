/**
 * ODİ "TV reklamı" Reels'leri, 3. dalga: büyüyen kamp ve oyunun ince ayrıntıları. Şema reklamlar.mjs ile aynı (record.mjs ikisini de
 * tanır: node tools/reels/record.mjs --reel cadirdan-kaleye). Görüntüler oyunun kendi ekranları ve çizimleri:
 * tools/reels/kamp-cekim.mjs çeker, tools/reels/hazirla3.py kare dizisine çevirir (clip.dir).
 *
 * Bu dalgada eklenenler (overlay.html, compose.py, reklam_ses.py):
 *   clip.dir           → hazır kare dizisi (zaman atlamalı kamp, geri çekilen kamera, tek ekran görüntüsü); kamera/hız aynı
 *   sahne.fx.base      → son işlem yalnız alttaki görüntüye (donup griye dönme; büyüteç renkli kalır)
 *   sahne.tones        → [[sn, Hz, süre]] Ton Avı tonları: ayrı iz, ılımlı sabit düzey, yumuşak giriş/çıkış (müzik o anda 'off')
 *   katman kind        → lens (büyüteç), timp (oyunun timpanogram çizimi), ring (geri sayım), pulse (nabız halkası), evid (delil fotoğrafı)
 *   müzik stilleri     → kur · detay · gizem · yarisma · sessiz
 * Bilgiler oyunun içeriğinden (docs/14-kamp.md, docs/17-kamp-gorevleri.md, packages/content); sahte sayı/yorum/puan/ödül/tarih yok.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { YARDIMCI } from './reklamlar.mjs';

const { grid, LOGO, kt, tsub, lbl, phone, endLayers } = YARDIMCI;
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT3 = path.join(ROOT, 'tools/harness/out/reels3');
const SEQ = (n) => path.join(OUT3, 'seq', n);
/** hazır kare dizisi "klibi" (record.mjs çekmez; compose.py index.json'dan okur) */
const seq = (n, o = {}) => ({ dir: SEQ(n), level: 0, fromT: 0, dur: 999, ...o });
const still = (rel) => seq(`s-${rel.replace(/\.png$/, '').replace(/\//g, '-')}`);
/** çekim görüntüsü (tools/harness/out'a göre yol) */
const C = (rel) => `reels3/cekim/${rel}`;
/** PNG boyutu (başlıktan) */
function dims(rel) {
  try { const b = fs.readFileSync(path.join(ROOT, 'tools/harness/out', rel)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; } catch { return [1080, 1920]; }
}
const json = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const warn = (html, o = {}) => ({ kind: 'html', cls: 'warn', html, y: 268, at: 0, anim: 'none', ...o });

/* =================================================================== 1. ÇADIRDAN KALEYE (zaman atlamalı kamp) */
const kb = grid(120); // 0,5 sn
const TIERS = [[1, 'wd', 'Ahşap'], [4, 'st', 'Taş'], [7, 'bk', 'Tuğla'], [10, 'mt', 'Metal'], [13, 'au', 'Altın'], [16, 'cr', 'Kristal'], [21, 'ef', 'Efsane']];
const tierOf = (L) => [...TIERS].reverse().find(([l]) => L >= l);
const DMAJ = [74, 76, 78, 79, 81, 83, 85, 86];
/** zaman atlaması sahnesi: L0..L1 seviyeleri, vuruş başına bir seviye (kare dizisinde Sv L = indeks L−1) */
function buyu(id, L0, L1, extraBeats, o = {}) {
  const n = L1 - L0 + 1; const beats = n + extraBeats;
  const layers = [{ kind: 'html', cls: 'tsub', html: 'Odyoloji Merkezi', y: 264, at: 0, anim: 'none' }];
  const sfx = []; const punch = []; const flash = [];
  for (let k = 0; k < n; k++) {
    const L = L0 + k; const t = kb(k); const last = k === n - 1;
    layers.push({ kind: 'html', cls: 'lvl', html: `Sv <b>${L}</b>`, y: 324, at: t, until: last ? undefined : kb(k + 1), anim: 'pop', out: 'cut' });
    const tr = tierOf(L);
    if (tr[0] === L) { layers.push({ kind: 'html', cls: `tier ${tr[1]}`, html: tr[2], y: 484, at: t, anim: 'stamp', rot: k % 2 ? 3 : -3, ...(L === 21 ? { pulse: 120, pulseAt: t } : {}) }); sfx.push([t, 'whoosh', 0.35], [t, 'stamp', 0.45]); flash.push([t, 0.12, [255, 246, 229], 0.45]); }
    else if (k === 0) layers.push({ kind: 'html', cls: `tier ${tr[1]}`, html: tr[2], y: 484, at: 0, anim: 'none', rot: -3 });
    sfx.push([t, 'chime', 0.5, { n: DMAJ[(L - 1) % 8] + (L > 16 ? 12 : 0) }]); punch.push([t, 0.045, 0.12]);
  }
  return { id, dur: kb(beats), bg: 'clip', clip: seq('zaman'), skip: L0 - 1, speed: 1 / kb(1), cam: { z: 1.0, top: 0, punch, anchor: [195, 420], ...(o.camZ ? { z: o.camZ, top: [0, 420 * (1 - 1 / o.camZ[1])], T: kb(beats), ease: 'in' } : {}) }, fx: { flash, vignette: 0.25 }, sfx, layers, ...o };
}
const ADA = json(path.join(OUT3, 'seq/ada/bolgeler.json'), { bolgeler: {} }).bolgeler;
const DNAME = { koru: 'Sessiz Koru', koy: 'Koklea Koyu', tepe: 'Denge Tepesi', yerleske: 'Araştırma Yerleşkesi', orman: 'Kulak Kılı Ormanı' };
const ADA_SN = 4.0;
const cadir = {
  slug: 'cadirdan-kaleye', title: 'Çadırdan kaleye', ad: true, limit: 0.6, jpegOpaque: true, bpm: 120, snap: kb(1), style: 'kur', subY: 1400, subCls: 'big', voGap: 0.1, tail: 0.6,
  duck: { music: -9, sfx: -4 },
  scenes: [
    { id: 'kanca', dur: kb(3), bg: 'clip', clip: seq('zaman'), speed: 0, cam: { z: [1.0, 1.07], top: [0, 29] }, mus: 'intro',
      fx: { flash: [[0, 0.12]], zoom: [[0, 0.3, 0.06]], vignette: 0.3 }, sfx: [[0, 'boom', 0.5], [0.05, 'chime', 0.6, { n: 74 }]], layers: [
      kt('Bir çadırla<br>başladı.', { c: 'md', y: 300, at: 0.04, slamFrom: 2.0 }),
    ] },
    buyu('buyu1', 2, 9, 0, { mus: 'grow' }),
    buyu('buyu2', 10, 20, 0, { mus: 'lift' }),
    buyu('buyu3', 21, 25, 3, { camZ: [1.0, 1.12], fx: { flash: [[0, 0.12, [255, 246, 229], 0.45], [kb(4), 0.2]], shake: [[kb(4), 0.5, 16]], vignette: 0.25 } }),
    { id: 'ada', dur: kb(12), bg: 'clip', clip: seq('ada'), speed: 1, cam: { z: [1.0, 1.035], top: [0, 6] }, mus: 'wide', fx: { vignette: 0.2 },
      sfx: [[0.05, 'whoosh', 0.5, { d: 1.6 }], ...Object.keys(DNAME).map((k, i) => [ADA_SN + 0.15 + i * 0.25, 'pop', 0.5]), [ADA_SN + 1.5, 'sparkle', 0.5]], layers: [
      ...Object.entries(DNAME).filter(([k]) => ADA[k]).map(([k, name], i) => ({ kind: 'html', cls: 'dname', html: name, x: Math.max(200, Math.min(760, ADA[k][0])), y: Math.max(560, Math.min(1300, ADA[k][1] - 40)), at: ADA_SN + 0.15 + i * 0.25, anim: 'pop' })),
      { kind: 'html', cls: 'lbl gold', html: 'Kamp Seviyesi 30<small>5 bölge · köprüler · yeni binalar</small>', y: 300, at: ADA_SN + 0.1, anim: 'stamp', rot: -2 },
    ] },
    { id: 'susle', dur: kb(7), bg: 'night', ringY: 900, mus: 'grow', sfx: [[0, 'whoosh', 0.4], [kb(3), 'pop', 0.5]], layers: [
      kt('Süsle', { c: 'sm box teal', y: 250, anim: 'stamp', rot: -3 }),
      phone(C('susle/susle-panel.png'), [0, 330, 780, 1220], { w: 600, y: 400, maxH: 800, ry: [-12, 4] }),
      lbl('Kampını gez · Alkış!<small>arkadaşların ve takım arkadaşların</small>', { c: 'coral', y: 1235, at: kb(3), rot: 2 }),
    ] },
    { id: 'son', dur: kb(8), bg: 'night', ringY: 640, mus: 'end', fx: { flash: [[0, 0.15]], zoom: [[0, 0.3, 0.06]] }, sfx: [[0, 'boom', 0.6], [0.1, 'sparkle', 0.6]], layers: endLayers({ cta: 'Çadırdan kaleye:<br><b>kampını büyüt</b>' }) },
  ],
  vo: [
    { id: 'c1', scene: 'kanca', at: 0.15, nosub: true }, { id: 'c2', scene: 'buyu1', at: kb(5) + 0.05 }, { id: 'c3', scene: 'buyu2', at: kb(3) + 0.05 },
    { id: 'c4', scene: 'buyu3', at: 0.05 }, { id: 'c5', scene: 'ada', at: 0.3 }, { id: 'c6', scene: 'susle', at: 0.15 }, { id: 'c7', scene: 'son', at: 0.35, nosub: true },
  ],
  cover: { clip: seq('zaman', { fromT: 24.5 }), t: 0, frame: { zoom: 1.0, top: 0 }, dim: 0.62, blur: 0.8, bg: 'none', layers: [
    { kind: 'html', cls: 'kt md', html: 'Bir çadırla<br>başladı…', y: 240 },
    { kind: 'html', cls: 'tier wd', html: 'Sv 1 → Sv 25', y: 540, rot: -3 },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1280 },
  ] },
  post: {
    caption: 'Bir çadırla başladı. 🏕️ Sonra bir kale oldu, sonra bir kampüs… ve sonunda bir efsane. Odyoloji Merkezi her seviyede gözle görülür biçimde büyür; köprüleri kur, beş bölgeyi aç, kampını süsle, arkadaşına gezdir.\nODİ: Sesin Yolu yakında. Kampın hangi seviyede olurdu? 👇',
    tags: ['#odyoloji', '#odyolog', '#odyolojiöğrencisi', '#işitme', '#kulak', '#kamp', '#şehirkurma', '#mobiloyun', '#oyun', '#yakında', '#odisesinyolu'],
  },
};

/* =================================================================== 2. FARK ETTİN Mİ? (yalnız odyologların fark edeceği ayrıntılar) */
const fb3 = grid(100); // 0,6 sn
const GRASS = 'radial-gradient(circle at 50% 40%, #a6dc7c 0%, #79bd55 55%, #5f9e44 100%)';
const ANIT = (r) => C(`anit/anit-${r}.png`);
const SCR = 2.25; // kamp çekimi CSS px → görüntü px
const ANIT_POS = json(path.join(OUT3, 'cekim/anit/index.json'), { shots: [] }).shots;
const anitXY = (shot, r) => { const s = ANIT_POS.find((x) => x.name === shot); const m = s?.monuments?.[r]; return m ? [Math.round(m.x * SCR), Math.round(m.y * SCR * 1920 / 1919)] : [540, 1000]; };
const ring = (x, y, d = 150, at = 0.25) => ({ kind: 'html', cls: '', html: `<div class="spotring" style="width:${d}px;height:${d}px"></div>`, x, y: y - d / 2, at, anim: 'pop' });
const num = (n) => ({ kind: 'html', cls: 'numtag', html: `${String(n).padStart(2, '0')} / 07`, y: 255, at: 0, anim: 'stamp', rot: -3 });
/** kart (klinik ekranından kırpılmış) + büyüteç: c kart px, kart ekranda x0=60, y0, genişlik 960 */
const KART_W = 960, KART_Y = 330;
const kartXY = (img, px, py) => { const [w] = dims(C(`vaka/${img}`)); const s = KART_W / w; return [Math.round(60 + 6 + px * s), Math.round(KART_Y + 6 + py * s)]; };
function kartDetay(id, n, img, crop, c, mag, lensAt, label, o = {}) {
  const [w, h] = dims(C(`vaka/${img}`)); const [rx, ry] = kartXY(img, c[0], c[1]);
  return { id, dur: fb3(5), bg: 'void', mus: o.mus, fx: { flash: [[0, 0.1, [255, 246, 229], 0.4]] }, sfx: [[0, 'swish', 0.4], [0.3, 'lens', 0.7], [0.3, 'snap', 0.4]], layers: [
    num(n),
    { kind: 'still', src: C(`vaka/${img}`), crop, imgW: w, w: KART_W, y: KART_Y, at: 0, anim: 'fade', cls: 'plain', kb: [1, 1], maxBottom: 1330 },
    ring(rx, ry, o.ring ?? 170, 0.2),
    { kind: 'lens', src: C(`vaka/${img}`), imgW: w, imgH: h, c, c1: o.c1, mag, r: o.r ?? 230, cx: lensAt[0], cy: lensAt[1], hAng: o.hAng ?? 40, at: 0.3, anim: 'pop', bg: '#2a1d63' },
    lbl(label, { c: `${o.lc ?? 'gold'} lo`, y: o.ly ?? 1215, at: 0.55, rot: o.rot ?? -1.5 }),
  ] };
}
function anitDetay(id, n, shot, region, c, mag, label, o = {}) {
  const [mx, my] = anitXY(shot, region); const [w, h] = dims(ANIT(region));
  return { id, dur: fb3(5), bg: 'clip', clip: still(`anit/sahne-${shot}.png`), cam: { z: [1.0, 1.04], top: [0, 10] }, mus: o.mus,
    fx: { base: { grade: 'bw', gradeFrom: 0.25, gradeAmt: 0.75, vignette: 0.5 }, flash: [[0.25, 0.1, [255, 246, 229], 0.5]] }, sfx: [[0, 'swish', 0.4], [0.25, 'snap', 0.7], [0.35, 'lens', 0.7]], layers: [
    num(n), ring(mx, my - 20, 180, 0.25),
    { kind: 'lens', src: ANIT(region), imgW: w, imgH: h, c, mag, magGrow: 0.06, r: 290, cx: 540, cy: 640, hAng: my > 1000 ? 50 : 130, at: 0.35, anim: 'pop', bg: GRASS },
    lbl(label, { c: `${o.lc ?? 'teal'} lo`, y: 1200, at: 0.6, rot: o.rot ?? 1.5 }),
  ] };
}
const [YOL_W, YOL_H] = dims(C('anit/sahne-yol.png'));
const fark = {
  slug: 'fark-ettin-mi', title: 'Fark ettin mi?', ad: true, limit: 0.6, jpegOpaque: true, bpm: 100, snap: fb3(1), style: 'detay', subY: 1400, subCls: 'big', voGap: 0.12, tail: 0.6,
  duck: { music: -10, sfx: -4 },
  scenes: [
    // kanca: büyüteç Kulak Yolu'nda (10 anıt) gezinir
    { id: 'kanca', dur: fb3(4), bg: 'clip', clip: still('anit/sahne-yol.png'), cam: { z: [1.08, 1.0], top: [40, 0] }, mus: 'soft',
      fx: { base: { vignette: 0.55 }, zoom: [[0, 0.3, 0.05]] }, sfx: [[0, 'lens', 0.8], [0.05, 'thud', 0.4]], layers: [
      kt('Bunu sadece<br>odyologlar<br>fark eder.', { c: 'sm', y: 250, at: 0.03, slamFrom: 1.8 }),
      { kind: 'lens', src: C('anit/sahne-yol.png'), imgW: YOL_W, imgH: YOL_H, c: [150, 1000], c1: [880, 960], mag: 2.2, r: 230, cx: 540, cy: 1060, hAng: 45, at: 0.05, anim: 'pop', panT: fb3(4) },
    ] },
    kartDetay('d1', 1, 'kv11-kart-odyometri.png', [0, 0, 1062, 1060], [240, 432], 2.3, [720, 930], 'Sağ kulak: kırmızı O<small>sol kulak: mavi X (ASHA sembolleri)</small>'),
    kartDetay('d2', 2, 'kv11-kart-odyometri.png', [0, 0, 1062, 1060], [322, 277], 2.6, [720, 930], 'Kemik yolu: sağ <  ·  sol ><small>her kulağın kendi rengi ve yönü</small>', { lc: 'teal', rot: 1.5 }),
    anitDetay('d3', 3, 'dis', 'kanal', [420, 620], 0.95, 'Kanal Kemeri<small>kıllar ve kir girişte · S kıvrımı · sonda inci zar</small>', { mus: 'full' }),
    anitDetay('d4', 4, 'koklea', 'koklea-1', [420, 640], 0.95, 'Koklea: 2,5 tur<small>Kulak Yolu · Koklea Sarmalı anıtı</small>', { lc: 'gold', rot: -1.5 }),
    anitDetay('d5', 5, 'koklea', 'koklea-2', [420, 470], 0.85, 'Basamaklı stereosilya<small>kısadan uzuna üç sıra · pembe uç bağlantıları</small>'),
    kartDetay('d6', 6, 'kv19-kart-timpanometri.png', [0, 0, 1062, 1113], [330, 1050], 1.25, [540, 760], 'Bebekte 1000 Hz prob<small>Hasta Vakaları · taramada kalan bebek</small>', { r: 270, ring: 200, hAng: 60, lc: 'coral', ly: 1180 }),
    anitDetay('d7', 7, 'beyin', 'korteks', [380, 640], 1.0, 'Heschl girusu<small>şakak lobunda yanan ışık: işitme korteksi</small>', { lc: 'gold', rot: -1.5 }),
    { id: 'son', dur: fb3(7), bg: 'night', ringY: 640, mus: 'end', fx: { flash: [[0, 0.15]], zoom: [[0, 0.3, 0.06]] }, sfx: [[0, 'boom', 0.5], [0.1, 'sparkle', 0.6]], layers: [
      kt('Detaylar<br>bizden.', { c: 'md gold', y: 260, at: 0.05 }),
      kt('Merak<br>senden.', { c: 'md teal', y: 560, at: 1.0 }),
      { kind: 'html', cls: 'logo sm', html: LOGO, y: 930, at: 1.4, anim: 'zoom' },
      { kind: 'html', cls: 'soon', html: 'Yakında', y: 1210, at: 1.7, anim: 'stamp', rot: -3 },
    ] },
  ],
  vo: [
    { id: 'd1', scene: 'kanca', at: 0.15, nosub: true }, { id: 'd2', scene: 'd1', at: 0.35 }, { id: 'd3', scene: 'd2', at: 0.3 }, { id: 'd6', scene: 'd3', at: 0.35 },
    { id: 'd4', scene: 'd4', at: 0.35 }, { id: 'd5', scene: 'd5', at: 0.35 }, { id: 'd7', scene: 'd6', at: 0.35 }, { id: 'd8', scene: 'd7', at: 0.35 }, { id: 'd9', scene: 'son', at: 0.1, nosub: true },
  ],
  cover: { clip: still('anit/sahne-koklea.png'), t: 0, frame: { zoom: 1.0, top: 0 }, dim: 0.5, blur: 2, bg: 'none', layers: [
    { kind: 'html', cls: 'kt sm', html: 'Bunu sadece<br>odyologlar<br>fark eder.', y: 240 },
    { kind: 'lens', src: ANIT('koklea-2'), imgW: 840, imgH: 1104, c: [420, 500], mag: 0.95, r: 290, cx: 540, cy: 960, hAng: 45, bg: GRASS },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1300 },
  ] },
  post: {
    caption: 'Bunu sadece odyologlar fark eder 🔍 Sağ kulak kırmızı O, sol kulak mavi X; kemik yolu < ve >; kılları ve kiri girişte olan S kıvrımlı kanal; tam 2,5 tur dönen koklea; basamaklı stereosilya ve uç bağlantıları; bebekte 1000 Hz prob; ve yolun sonunda Heschl girusu.\nDetaylar bizden, merak senden. ODİ: Sesin Yolu yakında. Sen hangisini fark ettin? 👇',
    tags: ['#odyoloji', '#odyolog', '#odyolojiöğrencisi', '#odyogram', '#koklea', '#işitme', '#kulak', '#anatomi', '#mobiloyun', '#yakında', '#odisesinyolu'],
  },
};

/* =================================================================== 3. VAKA SAATİ (dedektif gerilimi; cevap verilmez) */
const vb = grid(90); // 0,667 sn
const VK = (f) => C(`vaka/${f}`);
const delil = (img, crop, w, x, y, cap, o = {}) => { const [iw] = dims(VK(img)); return { kind: 'evid', src: VK(img), imgW: iw, crop, w, x, y, cap, at: o.at ?? 0, anim: o.anim ?? 'drop', rot: o.rot ?? -2, ...o }; };
const vaka = {
  slug: 'vaka-saati', title: 'Vaka saati', ad: true, limit: 0.6, jpegOpaque: true, bpm: 90, snap: vb(1), style: 'gizem', subY: 1400, subCls: 'big', voGap: 0.15, tail: 0.6,
  duck: { music: -9, sfx: -4 },
  scenes: [
    { id: 'kanca', dur: vb(4), bg: 'board', mus: 'tick', fx: { flash: [[0, 0.12]], zoom: [[0, 0.3, 0.07]], vignette: 0.5, push: 0.04, pushT: vb(4) }, sfx: [[0, 'hit', 0.6], [0.05, 'stamp', 0.6]], layers: [
      { kind: 'html', cls: 'stamp2', html: 'Vaka dosyası', y: 290, at: 0.02, anim: 'stamp', rot: -4 },
      kt('Tanı<br>ne?', { c: 'xl coral', y: 520, at: 0.15, slamFrom: 2.2 }),
      { kind: 'html', cls: 'tsub lo', html: '1 hasta · 4 ipucu', y: 1110, at: 0.5, anim: 'fade' },
    ] },
    { id: 'hasta', dur: vb(6), bg: 'board', mus: 'pulse', fx: { vignette: 0.5, push: 0.04, pushT: vb(6) }, sfx: [[0.1, 'flash', 0.5], [0.15, 'paper', 0.4]], layers: [
      delil('kv11-hasta.png', [40, 1095, 780, 290], 760, 540, 300, 'Elif · 33 yaş · kurgusal hasta', { rot: -2.5 }),
      { kind: 'html', cls: 'tsub lo xl', html: 'Doğumdan sonra iki kulağında işitme yavaş yavaş azalmış.', y: 900, at: 0.4, anim: 'type', cps: 24 },
    ] },
    { id: 'garip', dur: vb(4), bg: 'board', fx: { vignette: 0.5, zoom: [[0, 0.25, 0.04]], push: 0.035, pushT: vb(4) }, sfx: [[0, 'stamp', 0.6]], layers: [
      delil('kv11-hasta.png', [40, 1095, 620, 290], 400, 300, 310, 'Elif · 33', { anim: 'none', rot: -5 }),
      kt('Gürültüde<br>daha iyi<br>duyuyor?!', { c: 'md gold', y: 700, anim: 'stamp', rot: -3 }),
    ] },
    { id: 'anne', dur: vb(4), bg: 'board', fx: { vignette: 0.5, zoom: [[0, 0.25, 0.04]], push: 0.035, pushT: vb(4) }, sfx: [[0, 'stamp', 0.6]], layers: [
      delil('kv11-hasta.png', [40, 1095, 620, 290], 400, 300, 310, 'Elif · 33', { anim: 'none', rot: -5 }),
      kt('Annesinde de<br>işitme kaybı', { c: 'md coral', y: 760, anim: 'stamp', rot: 2.5 }),
    ] },
    { id: 'ipucu1', dur: vb(5), bg: 'board', mus: 'rise', fx: { flash: [[0, 0.1, [255, 246, 229], 0.6]], vignette: 0.5, push: 0.035, pushT: vb(5) }, sfx: [[0, 'flash', 0.7], [0.1, 'thud', 0.4]], layers: [
      { kind: 'html', cls: 'numtag', html: 'İpucu 1', y: 262, at: 0, anim: 'stamp', rot: -3 },
      kt('Zar<br>normal', { c: 'lg teal', y: 400, at: 0.1, slamFrom: 1.8 }),
      delil('kv11-kart-otoskopi.png', [0, 450, 1062, 120], 900, 540, 860, 'Otoskopi', { rot: 2, at: 0.35 }),
    ] },
    { id: 'ipucu2', dur: vb(6), bg: 'board', fx: { flash: [[0, 0.1, [255, 246, 229], 0.6]], vignette: 0.5, push: 0.035, pushT: vb(6) }, sfx: [[0, 'flash', 0.7], [vb(2.5), 'flash', 0.6], [vb(2.5), 'stamp', 0.5]], layers: [
      { kind: 'html', cls: 'numtag', html: 'İpucu 2', y: 262, at: 0, anim: 'stamp', rot: -3 },
      delil('kv11-kart-timpanometri.png', [0, 100, 1062, 620], 820, 540, 380, 'Timpanometri: sığ eğri', { rot: -2 }),
      delil('kv11-kart-refleks.png', [0, 0, 1062, 249], 720, 560, 1010, 'Akustik refleks', { rot: 2.5, at: vb(2.5) }),
    ] },
    { id: 'ipucu3', dur: vb(5), bg: 'board', fx: { flash: [[0, 0.1, [255, 246, 229], 0.6]], vignette: 0.5, push: 0.035, pushT: vb(5) }, sfx: [[0, 'flash', 0.7], [vb(2), 'stamp', 0.5]], layers: [
      { kind: 'html', cls: 'numtag', html: 'İpucu 3', y: 260, at: 0, anim: 'stamp', rot: -3 },
      delil('kv11-kart-odyometri.png', [0, 90, 1062, 760], 860, 540, 380, 'Saf ses odyometrisi', { rot: 1.5 }),
      lbl('Kemik yolu iyi<small>hava yolu düşük: hava–kemik aralığı</small>', { c: 'gold lo', y: 1150, at: vb(2), rot: -2 }),
    ] },
    { id: 'ipucu4', dur: vb(5), bg: 'board', fx: { flash: [[0, 0.1, [255, 246, 229], 0.6]], vignette: 0.5, push: 0.04, pushT: vb(5) }, sfx: [[0, 'lens', 0.7], [0.1, 'snap', 0.5]], layers: [
      { kind: 'html', cls: 'numtag', html: 'İpucu 4', y: 260, at: 0, anim: 'stamp', rot: -3 },
      delil('kv11-kart-odyometri.png', [0, 90, 1062, 760], 860, 540, 380, 'Saf ses odyometrisi', { rot: 1.5, anim: 'none' }),
      ring(640, 592, 150, 0.1),
      { kind: 'lens', src: VK('kv11-kart-odyometri.png'), imgW: 1062, imgH: 1269, c: [645, 318], mag: 1.55, r: 250, cx: 700, cy: 1010, hAng: 40, at: 0.15, anim: 'pop', bg: '#2a1d63' },
    ] },
    { id: 'soru', dur: vb(6), bg: 'board', mus: 'hit', fx: { flash: [[0, 0.12]], shake: [[0, 0.4, 14]], vignette: 0.55, push: 0.035, pushT: vb(6) }, sfx: [[0, 'boom', 0.7], [0, 'hit', 0.5]], layers: [
      kt('Tanı<br>ne?', { c: 'xl coral', y: 300, slamFrom: 2.4 }),
      { kind: 'ring', from: 5, dur: vb(5.5), y: 860, at: 0.2, anim: 'pop', zero: '?' },
      { kind: 'html', cls: 'ctaBig', html: 'Cevabını <b>yorumlara yaz</b>', y: 1210, at: 0.4, anim: 'rise' },
    ] },
    { id: 'son', dur: vb(6), bg: 'board', mus: 'end', fx: { flash: [[0, 0.15]], zoom: [[0, 0.3, 0.06]], vignette: 0.45 }, sfx: [[0, 'boom', 0.5], [0.1, 'sparkle', 0.5]], layers: [
      { kind: 'html', cls: 'stamp2', html: 'Cevap oyunda', y: 280, at: 0.05, anim: 'stamp', rot: -3 },
      { kind: 'html', cls: 'tsub lo', html: 'Kamp · Odyoloji Kliniği · Hasta Vakaları', y: 440, at: 0.3, anim: 'fade' },
      { kind: 'html', cls: 'logo sm', html: LOGO, y: 600, at: 0.5, anim: 'zoom' },
      { kind: 'html', cls: 'soon', html: 'Yakında', y: 960, at: 0.8, anim: 'stamp', rot: -3 },
      { kind: 'html', cls: 'tsub lo', html: 'Vakalar kurgusaldır; tıbbi öneri değildir.', y: 1130, at: 0.9, anim: 'fade' },
    ] },
  ],
  vo: [
    { id: 'v1', scene: 'kanca', at: 0.2, nosub: true }, { id: 'v2', scene: 'hasta', at: 0.2, nosub: true }, { id: 'v3', scene: 'garip', at: 0.1, nosub: true },
    { id: 'v4', scene: 'anne', at: 0.1, nosub: true }, { id: 'v5', scene: 'ipucu1', at: 0.2 }, { id: 'v6', scene: 'ipucu2', at: 0.2 },
    { id: 'v7', scene: 'ipucu3', at: 0.2 }, { id: 'v8', scene: 'ipucu4', at: 0.2 }, { id: 'v9', scene: 'soru', at: 0.3, nosub: true }, { id: 'v10', scene: 'son', at: 0.3, nosub: true },
  ],
  cover: { bg: 'board', layers: [
    { kind: 'html', cls: 'stamp2', html: 'Vaka dosyası', y: 250, rot: -4 },
    delil('kv11-kart-odyometri.png', [0, 90, 1062, 760], 760, 540, 420, 'Saf ses odyometrisi', { anim: 'none', rot: 2 }),
    { kind: 'html', cls: 'kt lg coral', html: 'Tanı ne?', y: 1060 },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1300 },
  ] },
  post: {
    caption: 'Vaka saati 🕵️ 33 yaşında. Doğumdan sonra iki kulağında işitme yavaş yavaş azalmış; gürültüde daha iyi duyuyor, annesinde de işitme kaybı var. Zar normal görünüyor, timpanogram sığ, akustik refleks alınamadı; kemik yolu iyi, hava yolu düşük… ve 2 kHz’te kemik yolunda bir çentik.\nTanı ne? Cevabını yorumlara yaz 👇 Cevap oyunda: ODİ: Sesin Yolu, Hasta Vakaları. (Vaka kurgusaldır; tıbbi öneri değildir.)',
    tags: ['#odyoloji', '#odyolog', '#odyolojiöğrencisi', '#vaka', '#odyogram', '#timpanometri', '#işitme', '#kulak', '#mobiloyun', '#yakında', '#odisesinyolu'],
  },
};

/* =================================================================== 4. EĞRİ YARIŞMASI (Timpanogram Eşleştir, yarışma programı) */
const yb = grid(128);
/** eğriler oyunun üretim kurallarıyla (packages/content/src/kamp-gorev.ts › egriUret) aynı aralıklarda; cevaplar BULGU olarak yazılır */
const EGRI = [
  { t: { tip: 'A', basinc: 0, uyum: 0.9, hacim: 1.2 }, tip: 'Tip A', bulgu: 'Tepe 0 daPa civarında<small>zar rahat hareket ediyor</small>', vo: 'e2' },
  { t: { tip: 'B', basinc: null, uyum: 0.1, hacim: 1.1 }, tip: 'Tip B', bulgu: 'Düz eğri · kanal hacmi normal<small>zar hareket etmiyor</small>', vo: 'e3' },
  { t: { tip: 'C', basinc: -200, uyum: 0.7, hacim: 1.2 }, tip: 'Tip C', bulgu: 'Tepe −200 daPa<small>orta kulak basıncı negatif</small>', vo: 'e4' },
  { t: { tip: 'B', basinc: null, uyum: 0.1, hacim: 3.2 }, tip: 'Tip B', bulgu: 'Düz eğri · kanal hacmi büyük<small>3,2 ml: normalin çok üstünde</small>', vo: 'e5' },
];
const timpL = (t, o = {}) => ({ kind: 'timp', t, w: 860, y: 560, at: 0, anim: 'none', draw: 0.9, ...o });
const egriSahne = (e, i) => [
  { id: `s${i + 1}`, dur: yb(7), bg: 'studio', mus: 'think', fx: { flash: [[0, 0.1]] }, sfx: [[0, 'swish', 0.5], [0.05, 'beep', 0.4], [yb(7) - 0.05, 'buzzer', 0.55]], layers: [
    { kind: 'html', cls: 'numtag', html: `${i + 1}/4`, y: 290, at: 0, anim: 'stamp', rot: -3 },
    timpL(e.t, { anim: i ? 'pop' : 'none', draw: i ? 0.9 : 0.01 }),
    { kind: 'ring', from: 3, dur: yb(6.4), y: 1190, at: yb(0.5), anim: 'pop', zero: '!' },
  ] },
  { id: `c${i + 1}`, dur: yb(6), bg: 'studio', mus: 'reveal', fx: { flash: [[0, 0.12, [255, 214, 90], 0.5]], zoom: [[0, 0.25, 0.04]], push: 0.05, pushT: yb(6) }, sfx: [[0, 'ding', 0.6], [0, 'hit', 0.35], [0.05, 'cheer', 0.25, { d: 1.6 }]], layers: [
    { kind: 'html', cls: 'numtag', html: `${i + 1}/4`, y: 290, at: 0, anim: 'none', rot: -3 },
    timpL(e.t, { draw: 0.01 }),
    { kind: 'html', cls: 'tier au', html: e.tip, y: 1175, at: 0, anim: 'stamp', rot: -3 },
    lbl(e.bulgu, { c: 'teal lo xl', y: 1310, at: 0.25, rot: 1.5 }),
  ] },
];
const egri = {
  slug: 'egri-yarismasi', title: 'Eğri yarışması', ad: true, limit: 0.6, jpegOpaque: true, bpm: 128, snap: yb(1), style: 'yarisma', subY: 1420, subCls: 'big', voGap: 0.1, tail: 0.6,
  duck: { music: -9, sfx: -4 },
  scenes: [
    { id: 'kanca', dur: yb(5), bg: 'studio', mus: 'fanfar', fx: { flash: [[0, 0.14]], shake: [[0, 0.35, 16]], zoom: [[0, 0.3, 0.08]] }, sfx: [[0, 'hit', 0.8], [0, 'horn', 0.4], [0.3, 'drumroll', 0.4, { d: 1.4 }]], layers: [
      kt('3 saniyede<br>söyle!', { c: 'md gold', y: 250, at: 0.03, slamFrom: 2.2 }),
      timpL(EGRI[0].t, { at: 0.25, anim: 'pop' }),
      { kind: 'html', cls: 'tsub lo xl', html: 'Bu eğri ne anlatıyor?', y: 1170, at: 0.6, anim: 'rise' },
    ] },
    ...EGRI.flatMap(egriSahne),
    { id: 'not', dur: yb(8), bg: 'studio', mus: 'think', sfx: [[0, 'whoosh', 0.4], [yb(3), 'ding', 0.4]], layers: [
      kt('Eğri<br>ipucu verir.', { c: 'md teal', y: 260, anim: 'whipL' }),
      phone(C('oyun/timpano-2.png'), [0, 640, 1170, 1180], { imgW: 1170, w: 680, y: 540, maxH: 640, ry: [-8, 3] }),
      lbl('Tanıyı bütün testler<small>birlikte koyar: öykü, otoskopi, odyogram…</small>', { c: 'gold', y: 1235, at: yb(3), rot: -2 }),
    ] },
    { id: 'son', dur: yb(8), bg: 'studio', mus: 'end', fx: { flash: [[0, 0.15]], zoom: [[0, 0.3, 0.06]] }, sfx: [[0, 'boom', 0.6], [0.1, 'sparkle', 0.6]], layers: endLayers({ cta: 'Timpanogram Eşleştir<br><b>88 soru seni bekliyor</b>' }) },
  ],
  vo: [
    { id: 'e1', scene: 'kanca', at: 0.1, nosub: true },
    ...EGRI.map((e, i) => ({ id: e.vo, scene: `c${i + 1}`, at: 0.2, nosub: true })),
    { id: 'e6', scene: 'not', at: 0.15 }, { id: 'e7', scene: 'son', at: 0.35, nosub: true },
  ],
  cover: { bg: 'studio', layers: [
    { kind: 'html', cls: 'kt md gold', html: '3 saniyede<br>söyle!', y: 250 },
    timpL(EGRI[2].t, { y: 640, draw: 0.01 }),
    { kind: 'html', cls: 'tsub lo xl', html: 'Bu eğri ne anlatıyor?', y: 1250 },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1370 },
  ] },
  post: {
    caption: '3 saniyede söyle: bu eğri ne anlatıyor? ⏱️ Tepe nerede, eğri düz mü, kanal hacmi kaç ml? Eğri ipucu verir; tanıyı bütün testler birlikte koyar.\nTimpanogram Eşleştir, ODİ: Sesin Yolu’nda Timpanometri Kulesi’nde. Kaçını bildin? Yorumlara yaz 👇',
    tags: ['#odyoloji', '#odyolog', '#odyolojiöğrencisi', '#timpanometri', '#timpanogram', '#işitme', '#kulak', '#quiz', '#mobiloyun', '#yakında', '#odisesinyolu'],
  },
};

/* =================================================================== 5. KULAKLIĞINI TAK (Ton Avı) */
const hb = grid(90);
const HEADPHONES = `<svg width="420" height="380" viewBox="0 0 420 380"><defs><linearGradient id="hp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9b8ff"/><stop offset=".5" stop-color="#8b6bff"/><stop offset="1" stop-color="#3b1fae"/></linearGradient></defs>
<path d="M60 230C60 110 130 40 210 40S360 110 360 230" fill="none" stroke="#14082e" stroke-width="44" stroke-linecap="round"/><path d="M60 230C60 110 130 40 210 40S360 110 360 230" fill="none" stroke="url(#hp)" stroke-width="30" stroke-linecap="round"/>
<rect x="22" y="200" width="96" height="150" rx="40" fill="url(#hp)" stroke="#14082e" stroke-width="8"/><rect x="302" y="200" width="96" height="150" rx="40" fill="url(#hp)" stroke="#14082e" stroke-width="8"/>
<rect x="92" y="222" width="30" height="106" rx="14" fill="#2ee6d6"/><rect x="298" y="222" width="30" height="106" rx="14" fill="#ffc93c"/></svg>`;
const EAR = '<svg width="230" height="230" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="rgba(16,9,46,.9)" stroke="#2ee6d6" stroke-width="4"/><path d="M58 76c-6 0-8-6-12-9s-10-8-10-20c0-11 8-20 19-20s19 8 19 18c0 7-4 10-7 13s-2 7-4 10-3 8-5 8z" fill="none" stroke="#fff6e5" stroke-width="5" stroke-linecap="round"/><path d="M47 47c0-5 3-8 8-8s8 3 8 7-3 5-5 6" fill="none" stroke="#fff6e5" stroke-width="4.5" stroke-linecap="round"/></svg>';
const UYARI = warn('Bu bir oyundur, <b style="color:#2ee6d6">işitme testi değildir.</b>');
const dinle = (o = {}) => [UYARI, { kind: 'pulse', html: EAR, y: 640, at: 0, anim: 'none', pulses: [], bob: 2.2, bobAmp: 8, ...o }];
const soru = (no, q) => [
  { kind: 'html', cls: 'numtag', html: `${no}/4`, y: 360, at: 0, anim: 'stamp', rot: -3 },
  kt(q, { c: 'sm', y: 1000, at: 0.05, anim: 'slam', slamFrom: 1.6 }),
];
const perde = (no, t1, t2) => [UYARI,
  { kind: 'html', cls: 'numtag', html: `${no}/4`, y: 345, at: 0, anim: 'stamp', rot: -3 },
  kt('Hangisi<br>daha ince?', { c: 'sm', y: 450, at: 0.05, anim: 'slam', slamFrom: 1.6 }),
  ...[[1, t1, 330], [2, t2, 750]].flatMap(([k, t, x]) => [
    { kind: 'html', cls: 'tonebig', html: String(k), x, y: 760, at: 0, anim: 'none', z: 1, bob: 2.4, bobAmp: 6, phase: k * 0.6 },
    { kind: 'pulse', html: '', x, y: 910, at: 0, anim: 'none', pulses: [[t, 0.9]] },
  ]),
];
const kulaklik = {
  slug: 'kulakligini-tak', title: 'Kulaklığını tak', ad: true, limit: 0.6, jpegOpaque: true, bpm: 90, snap: hb(1), style: 'sessiz', subY: 1400, subCls: 'big', voGap: 0.15, tail: 0.6,
  duck: { music: -8, sfx: -4 },
  scenes: [
    { id: 'kanca', dur: hb(4), bg: 'calm', mus: 'amb', fx: { zoom: [[0, 0.3, 0.05]] }, sfx: [[0, 'thud', 0.5]], layers: [
      UYARI,
      { kind: 'html', cls: 'art', html: HEADPHONES, y: 470, at: 0, anim: 'pop', bob: 2.4, bobAmp: 8 },
      kt('Kulaklığını<br>tak.', { c: 'md teal', y: 900, at: 0.05, slamFrom: 1.8 }),
    ] },
    // 1: ses var mı? (1000 Hz)
    { id: 'q1', dur: hb(6), bg: 'calm', mus: 'off', layers: [...dinle(), ...soru(1, 'Ses var mı?'), tsub('Dinle…', { y: 1200, at: 2.4, anim: 'fade', c: 'lo xl' })], tones: [[3.0, 1000, 0.45]] },
    { id: 'a1', dur: hb(3), bg: 'calm', mus: 'pulse', sfx: [[0, 'ding', 0.4]], layers: [...dinle({ pulses: [[0.05, 1.0]] }), kt('Vardı!', { c: 'lg gold', y: 960, anim: 'stamp', rot: -3 }), tsub('1000 Hz', { y: 1190, at: 0.3 })] },
    // 2: hangisi daha ince? (genel düzey: büyük perde farkı)
    { id: 'q2', dur: hb(7), bg: 'calm', mus: 'off', layers: perde(2, 2.9, 3.9), tones: [[2.9, 1000, 0.45], [3.9, 1500, 0.45]] },
    { id: 'a2', dur: hb(3), bg: 'calm', mus: 'pulse', sfx: [[0, 'ding', 0.4]], layers: [UYARI, kt('2.', { c: 'xl gold', y: 560, anim: 'stamp' }), tsub('1000 Hz → <b style="color:#ffc93c">1500 Hz</b>', { y: 940, at: 0.25, c: 'lo xl' })] },
    // 3: ses var mı? (ses YOK)
    { id: 'q3', dur: hb(6), bg: 'calm', mus: 'off', layers: [...dinle(), ...soru(3, 'Ses var mı?'), tsub('Dinle…', { y: 1200, at: 2.0, anim: 'fade', c: 'lo xl' })] },
    { id: 'a3', dur: hb(5), bg: 'calm', mus: 'pulse', sfx: [[0, 'pop', 0.4]], layers: [...dinle(), kt('Yoktu!', { c: 'lg coral', y: 960, anim: 'stamp', rot: 3 })] },
    // 4: hangisi daha ince? (odyoloji düzeyi: küçük perde farkı, ×1,15)
    { id: 'q4', dur: hb(8), bg: 'calm', mus: 'off', layers: perde(4, 3.6, 4.6), tones: [[3.6, 2000, 0.45], [4.6, 1740, 0.45]] },
    { id: 'a4', dur: hb(3), bg: 'calm', mus: 'pulse', sfx: [[0, 'ding', 0.4]], layers: [UYARI, kt('1.', { c: 'xl gold', y: 560, anim: 'stamp' }), tsub('<b style="color:#ffc93c">2000 Hz</b> → 1740 Hz', { y: 940, at: 0.25, c: 'lo xl' })] },
    { id: 'oyun', dur: hb(7), bg: 'night', ringY: 900, mus: 'pulse', sfx: [[0, 'whoosh', 0.4]], layers: [UYARI,
      phone(C('oyun/ton-1-cevap.png'), [0, 770, 1170, 860], { imgW: 1170, w: 640, y: 470, maxH: 600, ry: [12, -4] }),
      lbl('Ton Avı<small>Kamp · Odyometri Odası</small>', { c: 'teal', y: 1180, at: hb(1.5), rot: -2 }),
    ] },
    { id: 'son', dur: hb(5), bg: 'calm', mus: 'end', fx: { flash: [[0, 0.12]] }, sfx: [[0, 'sparkle', 0.5]], layers: [...endLayers({ cta: 'Kaçını bildin?<br><b>Yorumlara yaz</b>' }), UYARI] },
  ],
  vo: [
    { id: 'k1', scene: 'kanca', at: 0.2, nosub: true }, { id: 'k2', scene: 'q1', at: 0.2 }, { id: 'k3', scene: 'a1', at: 0.15 },
    { id: 'k4', scene: 'q2', at: 0.2 }, { id: 'k5', scene: 'a2', at: 0.15 }, { id: 'k6', scene: 'q3', at: 0.2 }, { id: 'k7', scene: 'a3', at: 0.15 },
    { id: 'k8', scene: 'q4', at: 0.2 }, { id: 'k9', scene: 'a4', at: 0.15 }, { id: 'k11', scene: 'oyun', at: 0.2 }, { id: 'k10', scene: 'son', at: 0.3, nosub: true },
  ],
  cover: { bg: 'calm', layers: [
    { kind: 'html', cls: 'art', html: HEADPHONES, y: 300 },
    { kind: 'html', cls: 'kt md teal', html: 'Kulaklığını<br>tak.', y: 720 },
    { kind: 'html', cls: 'kt sm', html: 'Hangisi<br>daha ince?', y: 1010 },
    { kind: 'html', cls: 'warn', html: 'Bu bir oyundur, <b style="color:#2ee6d6">işitme testi değildir.</b>', y: 1330 },
  ] },
  post: {
    caption: 'Kulaklığını tak 🎧 Ses var mı? Hangisi daha ince? Dört soru, sessizlik dahil. Kaçını bildin? Yorumlara yaz 👇\nTon Avı, ODİ: Sesin Yolu’nda kampın Odyometri Odası’nda. Bu bir oyundur, işitme testi değildir; işitmenle ilgili bir kaygın varsa bir odyoloğa ya da hekime danış.',
    tags: ['#odyoloji', '#odyolog', '#odyolojiöğrencisi', '#işitme', '#kulak', '#kulaklık', '#challenge', '#mobiloyun', '#oyun', '#yakında', '#odisesinyolu'],
  },
};

// sakin sahnelerde de durağan kare kalmasın: yavaş yakınlaşma
for (const sc of kulaklik.scenes) sc.fx = { ...(sc.fx ?? {}), push: sc.fx?.push ?? 0.03, pushT: sc.dur };

export const REELS = Object.fromEntries([cadir, fark, vaka, egri, kulaklik].map((r) => [r.slug, r]));
