/**
 * ODİ "TV reklamı" Reels'leri, 4. dalga: her biri tek bir fikir (birinci ağızdan sinema, mit avı, soygun parodisi, komik başarısızlık,
 * 10 saniyede bilgi). Şema reklamlar.mjs / reklamlar3.mjs ile aynı (record.mjs üçünü de tanır: node tools/reels/record.mjs --reel ben-bir-sesim).
 * Görüntüler oyunun kendi ekranları ve çizimleri: oynanış klipleri (clip.html, bot gerçekten oynar), kamp çekimi (kamp-cekim.mjs) ve
 * arayüz çekimi (cekim4.mjs; bellek içi sunucuda kurgusal, kulak temalı takma adlı örnek oyuncular). Yönetici modu kullanılmaz.
 *
 * Bu dalgada eklenenler:
 *   clip.mode 'zipla' → bot hep zıplar, hiç kaymaz (kıl perdesine gerçekten çarpar; clip.html)
 *   katman kind 'timer' → iki ondalıklı geri sayım (overlay.html); sınıflar: chap, lvltag, poem, claim, stamp2.big/ok, meme, bubble, nc
 *   son işlem grade 'warm' (compose.py) · müzik stilleri sinema · mit · soygun · hizli; efektler bonk · trombone · tapestop (reklam_ses.py)
 * Bilgiler oyunun içeriğinden (docs/odyoloji-icerik.md, packages/content); sahte sayı/yorum/puan/ödül/tarih yok.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { YARDIMCI } from './reklamlar.mjs';

const { grid, LOGO, kt, tsub, lbl, phone, endLayers } = YARDIMCI;
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const clip = (level, fromT, dur, o = {}) => ({ level, fromT, dur, ...o });
/** kamp çekimi (tools/harness/out/reels3/cekim) ve 4. dalga arayüz çekimi (tools/harness/out/reels4/cekim) */
const C3 = (rel) => `reels3/cekim/${rel}`;
const C4 = (rel) => `reels4/cekim/${rel}`;
function dims(rel) {
  try { const b = fs.readFileSync(path.join(ROOT, 'tools/harness/out', rel)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; } catch { return [1170, 2532]; }
}

/* =================================================================== 1. BEN BİR SESİM (birinci ağızdan, sinema) */
const sb = grid(80); // 0,75 sn
const CINE = (o = {}) => ({ bars: 120, grade: 'warm', gradeAmt: 0.85, vignette: 0.45, grain: 0.006, ...o });
/** bölge başlığı: üstte ince sinema etiketi + altında bölüm etiketi (gerçek bölüm adı ve numarası) */
const chap = (name, tag, o = {}) => [
  { kind: 'html', cls: 'chap', html: `<i></i>${name}<i></i>`, y: o.y ?? 285, at: o.at ?? 0.12, until: o.until ?? 2.4, anim: 'fade', fadeT: 0.35 },
  { kind: 'html', cls: 'lvltag', html: tag, y: (o.y ?? 285) + 66, at: (o.at ?? 0.12) + 0.2, until: o.until ?? 2.4, anim: 'fade', fadeT: 0.35 },
];
const sesim = {
  slug: 'ben-bir-sesim', title: 'Ben bir sesim', ad: true, limit: 0.6, bpm: 80, snap: sb(1), style: 'sinema', subY: 1395, subCls: 'poem', voGap: 0.14, tail: 0.8,
  duck: { music: -7, sfx: -4 },
  scenes: [
    // kanca: ilk karede Odi yakın plan + "Ben bir sesim." + kalp atışı
    { id: 'kanca', dur: sb(3), bg: 'clip', clip: clip(2, 0.4, 3.8), speed: 0.5, blend: true, cam: { z: [1.75, 1.9], x: -55, top: [300, 318] }, mus: 'hush',
      fx: CINE({ fadeIn: 0.12, zoom: [[0, 0.5, 0.05]] }), sfx: [[0, 'heartbeat', 0.7], [0.05, 'boom', 0.25], [sb(2), 'heartbeat', 0.5]], layers: [
      kt('Ben bir<br>sesim.', { c: 'poem', y: 330, at: 0.06, anim: 'zoom' }),
    ] },
    { id: 'ninni', dur: sb(3), bg: 'clip', clip: clip(4, 8.3, 3.8), speed: 0.8, blend: true, cam: { z: [1.25, 1.35], x: -30, top: [210, 220] },
      fx: CINE(), sfx: [[0, 'swish', 0.2]], layers: [] },
    { id: 'kepce', dur: sb(3), bg: 'clip', clip: clip(2, 10.0, 3.8), speed: 0.85, blend: true, cam: { z: [1.15, 1.22], top: [170, 180] }, mus: 'grow',
      fx: CINE(), sfx: [[0, 'whoosh', 0.25]], layers: chap('Kulak kepçesi', 'Dış Kulak · 2. bölüm «Kepçenin Kıvrımı»') },
    { id: 'orman', dur: sb(4), bg: 'clip', clip: clip(3, 9.0, 4.6), speed: 0.85, blend: true, cam: { z: [1.15, 1.25], top: [160, 175] },
      fx: CINE(), sfx: [[0, 'whoosh', 0.25]], layers: chap('Kulak Kılı Ormanı', 'Kanalın girişi · 3. bölüm «Kulak Kılı Ormanı»') },
    { id: 'zar', dur: sb(3), bg: 'clip', clip: clip(10, 18.7, 3.8), speed: [[0, 1], [0.45, 1], [0.55, 0.3], [1.5, 0.3], [1.75, 1]], blend: true, cam: { z: [1.12, 1.2], top: [150, 160], punch: [[0.5, 0.06, 0.3]] },
      fx: CINE({ flash: [[0.5, 0.12, [255, 246, 229], 0.35]] }), sfx: [[0, 'whoosh', 0.25], [0.5, 'thud', 0.45]], layers: chap('Kulak zarı', 'Kulak Zarı · 10. bölüm «Titreşim»') },
    { id: 'cekic', dur: sb(2), bg: 'clip', clip: clip(13, 16.1, 3.0), speed: 0.9, blend: true, cam: { z: [1.15, 1.22], top: [140, 150] },
      fx: CINE(), sfx: [[0, 'swish', 0.3]], layers: chap('Kemikçikler', '13. bölüm «Çekiç»') },
    { id: 'ors', dur: sb(2), bg: 'clip', clip: clip(14, 8.0, 3.0), speed: 0.9, blend: true, cam: { z: [1.15, 1.22], top: [140, 150] },
      fx: CINE(), sfx: [[0, 'swish', 0.3]], layers: chap('Kemikçikler', '14. bölüm «Örs»', { at: 0 }) },
    { id: 'uzengi', dur: sb(2), bg: 'clip', clip: clip(15, 34.3, 3.0), speed: 0.9, blend: true, cam: { z: [1.15, 1.22], top: [140, 150], punch: [[0.45, 0.07, 0.25]] },
      fx: CINE({ shake: [[0.45, 0.3, 10]] }), sfx: [[0, 'swish', 0.3], [0.45, 'thud', 0.5]], layers: chap('Kemikçikler', '15. bölüm «Üzengi»', { at: 0 }) },
    { id: 'koklea', dur: sb(4), bg: 'clip', clip: clip(22, 10.7, 4.2), speed: [[0, 1], [0.25, 1], [0.35, 0.35], [1.7, 0.35], [2.0, 1]], blend: true, cam: { z: [1.12, 1.24], top: [160, 175] }, mus: 'swell',
      fx: CINE({ flash: [[0.3, 0.14, [200, 255, 250], 0.3]] }), sfx: [[0.28, 'squish', 0.25], [0, 'whoosh', 0.3]], layers: chap('Koklea', 'Koklea · 22. bölüm «İnce Sesler»', { until: 1.5 }) },
    { id: 'tuy', dur: sb(4), bg: 'clip', clip: clip(25, 32.0, 4.6), speed: 0.85, blend: true, cam: { z: [1.12, 1.2], top: [150, 160] },
      fx: CINE(), sfx: [[0, 'whoosh', 0.25], [0.6, 'sparkle', 0.25]], layers: chap('Tüy hücreleri', 'Corti organı · 25. bölüm «Tüy Hücresi Tarlası»') },
    { id: 'sinir', dur: sb(3), bg: 'clip', clip: clip(31, 17.3, 3.8), speed: 0.9, blend: true, cam: { z: [1.12, 1.2], top: [150, 160], punch: [[0.45, 0.07, 0.25]] }, mus: 'full',
      fx: CINE({ flash: [[0.45, 0.1, [190, 240, 255], 0.35]] }), sfx: [[0, 'whoosh', 0.3], [0.45, 'hit', 0.25]], layers: chap('İşitme siniri', 'İşitme Siniri · 31. bölüm «Elektrik»') },
    { id: 'sap', dur: sb(4), bg: 'clip', clip: clip(34, 15.3, 4.6), speed: 0.9, blend: true, cam: { z: [1.12, 1.2], top: [150, 160] },
      fx: CINE(), sfx: [[0, 'whoosh', 0.3]], layers: chap('Beyin sapı', 'Beyin Sapı · 34. bölüm «Çapraz Yollar»') },
    { id: 'korteks', dur: sb(4), bg: 'clip', clip: clip(37, 14.9, 4.6), speed: [[0, 1], [0.35, 1], [0.45, 0.4], [1.5, 0.4], [1.8, 1]], blend: true, cam: { z: [1.12, 1.24], top: [150, 165] },
      fx: CINE({ flash: [[0.4, 0.16, [255, 236, 190], 0.4]] }), sfx: [[0, 'whoosh', 0.3], [0.4, 'sparkle', 0.35]], layers: chap('İşitme korteksi', 'İşitme Korteksi · 37. bölüm «Anlam Bahçesi»') },
    // nefes: müzik çekilir; kampın Heschl Işığı anıtı (oyunun kendi çizimi) yavaşça yaklaşır
    { id: 'duydu', dur: sb(4), bg: 'void', mus: 'drop', fx: CINE({ grade: null, push: 0.05, pushT: sb(4), fadeIn: 0.2 }), sfx: [[sb(1), 'sparkle', 0.3]], layers: [
      { kind: 'spot', y: 860, at: 0, anim: 'fade', fadeT: 1.0 },
      { kind: 'still', src: C3('anit/anit-korteks.png'), crop: [0, 0, ...dims(C3('anit/anit-korteks.png'))], imgW: dims(C3('anit/anit-korteks.png'))[0], w: 680, y: 530, at: 0, anim: 'fade', fadeT: 0.8, cls: 'bare', kb: [1.0, 1.08], maxBottom: 1440 },
      { kind: 'html', cls: 'lvltag', html: 'Kamp · Kulak Yolu · Heschl Işığı anıtı', y: 1450, at: 0.6, anim: 'fade' },
      kt('…ve beyin,<br>beni duydu.', { c: 'poem', y: 260, at: sb(1.1), anim: 'fade', fadeT: 0.6 }),
    ] },
    { id: 'son', dur: sb(5), bg: 'night', ringY: 700, mus: 'end', fx: { flash: [[0, 0.2]], zoom: [[0, 0.4, 0.05]], bars: 120 }, sfx: [[0, 'boom', 0.5], [0.1, 'sparkle', 0.5]], layers: [
      { kind: 'html', cls: 'logo', html: LOGO, y: 420, at: 0.05, anim: 'zoom' },
      tsub('Kulaktan beyne,<br>bir sesin yolculuğu', { y: 870, at: 0.6, c: 'lo xl' }),
      { kind: 'html', cls: 'soon', html: 'Yakında', y: 1110, at: 0.9, anim: 'stamp', rot: -3 },
    ] },
  ],
  vo: [
    { id: 'b1', scene: 'kanca', at: 0.3, nosub: true }, { id: 'b2', scene: 'ninni', at: 0.15 }, { id: 'b3', scene: 'kepce', at: 0.3 }, { id: 'b4', scene: 'orman', at: 0.3 },
    { id: 'b5', scene: 'zar', at: 0.3 }, { id: 'b6', scene: 'cekic', at: 0.2 }, { id: 'b7', scene: 'koklea', at: 0.35 }, { id: 'b8', scene: 'tuy', at: 0.3 },
    { id: 'b9', scene: 'sinir', at: 0.25 }, { id: 'b10', scene: 'sap', at: 0.3 }, { id: 'b11', scene: 'korteks', at: 0.3 },
    { id: 'b12', scene: 'duydu', at: sb(1.1), nosub: true }, { id: 'b13', scene: 'son', at: 0.6, nosub: true },
  ],
  cover: { clip: clip(2, 0.4, 3.8), t: 0.8, frame: { zoom: 1.75, x: -55, top: 305 }, dim: 0.62, blur: 1.2, bg: 'none', layers: [
    { kind: 'html', cls: 'kt poem', html: 'Ben bir<br>sesim.', y: 300 },
    { kind: 'html', cls: 'tsub lo xl', html: 'Kulaktan beyne,<br>birinci ağızdan', y: 560 },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1260 },
  ] },
  post: {
    caption: 'Ben bir sesim. 🎵 Annemin ninnisini taşıyorum: kulak kepçesi beni topladı, Kulak Kılı Ormanı’ndan geçtim, kulak zarını titrettim; çekiç, örs ve üzengi beni iç kulağa taşıdı. Kokleada bir dalga oldum, tüy hücreleri beni sinir sinyaline çevirdi… ve sonunda beyin beni duydu.\nODİ: Sesin Yolu yakında. Her bölge oyunda gerçek bir bölüm. 👂',
    tags: ['#odyoloji', '#odyolog', '#odyolojiöğrencisi', '#işitme', '#kulak', '#anatomi', '#koklea', '#ses', '#mobiloyun', '#yakında', '#odisesinyolu'],
  },
};

/* =================================================================== 2. BAŞARAMADIN MI? (komik başarısızlık → ipucu → 3 yıldız) */
const fb4 = grid(112); // 0,536 sn
const Z = (fromT, dur) => clip(4, fromT, dur, { mode: 'zipla' }); // hep zıplayan bot (kaymayı zıplamaya çevirir): perdeye gerçekten çarpar
const BOS = (fromT, dur) => clip(4, fromT, dur, { mode: 'bos' }); // hiç dokunmayan oyuncu: boşluğa düşer
const meme = (html, o = {}) => ({ kind: 'html', cls: `meme ${o.c ?? ''}`, html, y: o.y ?? 270, at: o.at ?? 0, anim: o.anim ?? 'slam', slamFrom: 1.6, ...o });
const CAM5 = { z: [1.18, 1.24], top: [175, 185] };
const basaramadin = {
  slug: 'basaramadin-mi', title: 'Başaramadın mı?', ad: true, limit: 0.6, bpm: 112, snap: fb4(1), style: 'komedi', subY: 1400, subCls: 'big', voGap: 0.12, tail: 0.7,
  duck: { music: -9, sfx: -3 },
  scenes: [
    // kanca: perdeye kafa → donma + plak cızırtısı + meme yazısı
    { id: 'kanca', dur: fb4(5), bg: 'clip', clip: Z(15.25, 1.6), speed: [[0, 1], [0.38, 1], [0.41, 0], [9, 0]], cam: { ...CAM5, punch: [[0.4, 0.12, 0.25]] }, mus: 'off',
      fx: { base: { grade: 'bw', gradeFrom: 0.41, gradeAmt: 0.7 }, shake: [[0.4, 0.35, 22]], flash: [[0.4, 0.1, [255, 255, 255], 0.5]] },
      sfx: [[0.4, 'bonk', 1], [0.44, 'scratch', 0.8]], layers: [
      meme('Ben,<br>4. bölüm,<br>14. deneme', { y: 250, at: 0.05 }),
    ] },
    { id: 'ipucu-yok', dur: fb4(6), bg: 'clip', clip: Z(17.25, 2.0), speed: [[0, 1], [0.65, 1], [0.75, 0.25], [1.4, 0.25], [1.55, 1]], blend: true, cam: CAM5, mus: 'bouncy',
      fx: { shake: [[0.78, 0.3, 18]] }, sfx: [[0.7, 'tapestop', 0.4], [0.78, 'bonk', 0.9], [0.85, 'boing', 0.45]], layers: [
      meme('Plan:<br>“Zıplarım, geçerim.”', { c: 'sm', y: 250, at: 0.05, anim: 'pop' }),
    ] },
    { id: 'son-can', dur: fb4(5), bg: 'clip', clip: BOS(6.4, 1.0), speed: [[0, 1], [0.6, 1], [0.7, 0.2], [2.0, 0.2]], blend: true, cam: CAM5, mus: 'off',
      fx: { base: { grade: 'bw', gradeFrom: 0.9, gradeAmt: 0.6 } }, sfx: [[0.65, 'tapestop', 0.5], [0.75, 'downer', 0.5], [0.95, 'trombone', 0.75]], layers: [
      meme('Son can…', { c: 'sm', y: 260, at: 0.05, anim: 'pop' }),
    ] },
    { id: 'olmadi', dur: fb4(5), bg: 'night', ringY: 900, sfx: [[0, 'whoosh', 0.4]], layers: [
      phone(C4('sonuc/L04-basarisiz.png'), [0, 190, 1170, 1790], { imgW: 1170, w: 600, y: 330, maxH: 980, ry: [-10, 4] }),
    ] },
    { id: 'dede', dur: fb4(7), bg: 'night', ringY: 1050, mus: 'tension', fx: { zoom: [[0, 0.3, 0.04]] }, sfx: [[0, 'pop', 0.5], [0.15, 'sparkle', 0.4]], layers: [
      { kind: 'html', cls: 'bubble', html: '<small>Tüy Dede</small>Kıl perdesi alçak.<br>Aşağı kaydır, altından kay!', y: 300, at: 0.15, anim: 'pop' },
      { kind: 'dede', size: 420, y: 760, at: 0, anim: 'drop', bob: 1.8, bobAmp: 10 },
      { kind: 'html', cls: 'lvltag', html: '3–8. bölümler: ilk kıl perdesinden önce Tüy Dede', y: 1230, at: 0.6, anim: 'fade' },
    ] },
    { id: 'tazele', dur: fb4(7), bg: 'clip', clip: clip(4, 13.8, 3.4, { hints: true }), speed: [[0, 1], [0.3, 0.6], [2.4, 0.6], [2.8, 1]], blend: true, cam: CAM5, mus: 'bright',
      sfx: [[0, 'whoosh', 0.3]], layers: [
      meme('Bu sefer…', { c: 'sm', y: 260, at: 0.05, anim: 'pop', until: 2.2 }),
      meme('Kaydım!', { y: 260, at: 2.2, anim: 'stamp' }),
    ] },
    { id: 'akis1', dur: fb4(2), bg: 'clip', clip: clip(4, 15.9, 1.4), cam: CAM5, sfx: [[0, 'swish', 0.45]], layers: [] },
    { id: 'akis2', dur: fb4(2), bg: 'clip', clip: clip(4, 17.6, 1.4), cam: CAM5, sfx: [[0, 'swish', 0.45]], layers: [] },
    { id: 'akis3', dur: fb4(3), bg: 'clip', clip: clip(4, 31.2, 1.9), cam: CAM5, sfx: [[0, 'swish', 0.45]], layers: [
      meme('Akış modu', { c: 'sm', y: 260, at: 0.05, anim: 'pop' }),
    ] },
    { id: 'yildiz', dur: fb4(6), bg: 'night', ringY: 900, fx: { flash: [[0, 0.15]] }, sfx: [[0, 'ding', 0.5], [0.1, 'sparkle', 0.6], [0.15, 'cheer', 0.25, { d: 1.6 }]], layers: [
      phone(C4('sonuc/L04-3yildiz.png'), [0, 190, 1170, 1790], { imgW: 1170, w: 600, y: 330, maxH: 980, ry: [10, -4] }),
    ] },
    { id: 'son', dur: fb4(7), bg: 'night', ringY: 640, mus: 'end', fx: { flash: [[0, 0.15]], zoom: [[0, 0.3, 0.06]] }, sfx: [[0, 'boom', 0.5], [0.1, 'sparkle', 0.6]], layers: [
      kt('Her kulak<br>bir gün duyar.', { c: 'md gold', y: 260, at: 0.05 }),
      { kind: 'odi', size: 230, y: 610, at: 0.2, anim: 'drop', bob: 1.6, bobAmp: 10 },
      { kind: 'html', cls: 'logo sm', html: LOGO, y: 880, at: 0.4, anim: 'zoom' },
      { kind: 'html', cls: 'soon', html: 'Yakında', y: 1220, at: 0.7, anim: 'stamp', rot: -3 },
    ] },
  ],
  vo: [
    { id: 'z1', scene: 'kanca', at: 0.75, nosub: true }, { id: 'z2', scene: 'ipucu-yok', at: 1.3 }, { id: 'z3', scene: 'olmadi', at: 0.3 },
    { id: 'z4', scene: 'dede', at: 0.4 }, { id: 'z5', scene: 'yildiz', at: 0.35 }, { id: 'z6', scene: 'son', at: 0.6, nosub: true },
  ],
  cover: { clip: Z(15.25, 1.6), t: 0.38, frame: { zoom: 1.2, top: 180 }, dim: 0.7, blur: 0.6, bg: 'none', layers: [
    { kind: 'html', cls: 'meme', html: 'Ben,<br>4. bölüm,<br>14. deneme', y: 250 },
    { kind: 'html', cls: 'kt sm gold', html: 'Başaramadın mı?', y: 1050 },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1260 },
  ] },
  post: {
    caption: 'Ben, 4. bölüm, 14. deneme. 😅 Zıplamak işe yaramadı… Tüy Dede “Kıl perdesi alçak. Aşağı kaydır, altından kay!” dedi; bu sefer oldu: üç yıldız! ⭐⭐⭐\nHer kulak bir gün duyar. ODİ: Sesin Yolu yakında. Sen hangi bölümde takıldın? 👇',
    tags: ['#oyun', '#mobiloyun', '#gamer', '#komik', '#pesetme', '#odyoloji', '#işitme', '#kulak', '#yakında', '#odisesinyolu'],
  },
};

/* =================================================================== 3. 10 SANİYEDE 3 KULAK BİLGİSİ */
const qb = grid(140); // 0,4286 sn
const F3 = 10 / 3; const FH = F3 / 2; // her bilgi 3,33 sn (iki kesme); üç bilgi tam 10,00 sn
const KART = (f) => C4(`kart/${f}`);
/** Kulak Kartları penceresi (oyunun kendi kartı): 1170 px genişlikli ekran görüntüsünden kırpılmış */
const kartL = (f, crop, o = {}) => ({ kind: 'still', src: KART(f), crop, imgW: 1170, w: o.w ?? 800, y: o.y ?? 720, at: o.at ?? 0, anim: o.anim ?? 'pop', cls: 'plain', kb: [1.0, 1.05], maxBottom: 1340 });
const anitL = (r, o = {}) => { const src = C3(`anit/anit-${r}.png`); const [w, h] = dims(src); return { kind: 'still', src, crop: o.crop ?? [0, 0, w, h], imgW: w, w: o.w ?? 640, y: o.y ?? 520, at: 0, anim: 'zoom', cls: 'bare', kb: [1.0, 1.1], maxBottom: 1330 }; };
const timerL = (from, o = {}) => ({ kind: 'timer', cls: 'sm', from, y: o.y ?? 255, at: 0, anim: 'none', ...o });
const bilgi = (no, head, a, b, o = {}) => [
  { id: `b${no}a`, dur: FH, bg: 'night', ringY: 900, ...(no === 1 ? { mus: 'go' } : {}), fx: { flash: [[0, 0.1]], push: 0.04, pushT: FH }, sfx: [[0, 'hit', 0.5], [0, 'swish', 0.4]], layers: [
    timerL(10 - (no - 1) * F3), { kind: 'html', cls: 'numtag', html: `${no}/3`, y: 395, at: 0, anim: 'stamp', rot: -3 },
    kt(head, { c: 'sm', y: 485, at: 0.03, slamFrom: 1.6 }), ...a ] },
  { id: `b${no}b`, dur: FH, bg: o.bgB ?? 'night', ringY: 900, ...(o.clipB ? { clip: o.clipB, cam: o.camB, speed: o.speedB ?? 1, shade: 'top' } : {}), fx: { push: 0.04, pushT: FH }, sfx: [[0, 'swish', 0.35]], layers: [
    timerL(10 - (no - 1) * F3 - FH), { kind: 'html', cls: 'numtag', html: `${no}/3`, y: 395, at: 0, anim: 'none', rot: -3 },
    kt(head, { c: 'sm', y: 485, at: 0, anim: 'none' }), ...b ] },
];
const onSaniye = {
  slug: '10-saniyede', title: '10 saniyede 3 kulak bilgisi', ad: true, limit: 0.6, jpegOpaque: true, bpm: 140, snap: qb(1), style: 'hizli', subY: 1395, subCls: 'big', voGap: 0.08, tail: 0.6,
  duck: { music: -8, sfx: -4 },
  scenes: [
    { id: 'kanca', dur: qb(6), bg: 'night', ringY: 760, mus: 'count', fx: { flash: [[0, 0.12]], zoom: [[0, 0.3, 0.06]] }, sfx: [[0, 'hit', 0.7], [0.05, 'beep', 0.4]], layers: [
      { kind: 'timer', from: 10, rate: 0, y: 260, at: 0.02, anim: 'slam', slamFrom: 1.8 },
      kt('10 saniyede<br>3 kulak bilgisi', { c: 'md gold', y: 600, at: 0.12, slamFrom: 2.0 }),
      tsub('Hazır mısın?', { y: 1010, at: 0.8, c: 'lo xl' }),
    ] },
    ...bilgi(1, 'En küçük kemik:<br>üzengi', [anitL('kemikcikler', { y: 700, w: 560 }), lbl('Üç Kemikçik anıtı<small>Kamp · Kulak Yolu</small>', { c: 'teal lo', y: 1250, at: 0.3, rot: -2 })],
      [kartL('kart-kemikcikler-yildiz.png', [66, 800, 1035, 600])]),
    ...bilgi(2, 'En küçük iskelet kası:<br>stapedius', [kartL('kart-kemikcikler-sandik.png', [66, 770, 1035, 690])],
      [lbl('15. bölüm «Üzengi»<small>stapedius üzengiye bağlıdır</small>', { c: 'gold lo', y: 1230, at: 0.15, rot: 2 })],
      { bgB: 'clip', clipB: clip(15, 34.3, 2.0), camB: { z: [1.3, 1.36], top: [215, 225] } }),
    ...bilgi(3, 'Sağlıklı kulak<br>kendi sesini üretir', [kartL('kart-koklea-2-ozel.png', [66, 770, 1035, 690])],
      [anitL('koklea-2', { y: 700, w: 520 }), lbl('Tüy Hücresi Demeti anıtı<small>otoakustik emisyon: dış tüy hücreleri</small>', { c: 'teal lo', y: 1250, at: 0.2, rot: -2 })]),
    { id: 'son', dur: qb(9), bg: 'night', ringY: 900, mus: 'end', fx: { flash: [[0, 0.15]], zoom: [[0, 0.3, 0.06]] }, sfx: [[0, 'buzzer', 0.5], [0.15, 'boom', 0.5], [0.3, 'sparkle', 0.5]], layers: [
      { kind: 'timer', cls: 'sm', from: 0, rate: 0, redZero: true, y: 255, at: 0, anim: 'stamp' },
      kt('Daha fazlası<br>oyunda!', { c: 'md gold', y: 410, at: 0.1 }),
      phone(KART('album-kemikcikler.png'), [0, 300, 1170, 2050], { imgW: 1170, w: 560, y: 720, maxH: 470, ry: [-10, 4] }),
      { kind: 'html', cls: 'soon', html: 'Yakında', y: 1250, at: 0.6, anim: 'stamp', rot: -3 },
    ] },
  ],
  vo: [
    { id: 'q1', scene: 'kanca', at: 0.15, nosub: true }, { id: 'q2', scene: 'b1a', at: 0.08 }, { id: 'q3', scene: 'b2a', at: 0.08 }, { id: 'q4', scene: 'b3a', at: 0.08 },
    { id: 'q5', scene: 'son', at: 0.4, nosub: true },
  ],
  cover: { bg: 'night', layers: [
    { kind: 'timer', from: 10, rate: 0, y: 230 },
    { kind: 'html', cls: 'kt md gold', html: '10 saniyede<br>3 kulak bilgisi', y: 560 },
    anitL('kemikcikler', { y: 830, w: 360 }),
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1340 },
  ] },
  post: {
    caption: '10 saniyede 3 kulak bilgisi ⏱️ 1) Vücudun en küçük kemiği kulakta: üzengi (yaklaşık 3 mm). 2) En küçük iskelet kası da orada: üzengiye bağlı stapedius. 3) Sağlıklı kulak kendi çok hafif sesini üretir; bebeklerin işitmesi bununla taranabilir.\nDaha fazlası oyunda: ODİ: Sesin Yolu, Kulak Kartları. Yakında! Hangisini biliyordun? 👇',
    tags: ['#odyoloji', '#odyolog', '#odyolojiöğrencisi', '#bilgi', '#biliyormuydun', '#kulak', '#işitme', '#anatomi', '#mobiloyun', '#yakında', '#odisesinyolu'],
  },
};

/* =================================================================== 4. MİT Mİ, GERÇEK Mİ? (kulak sağlığı efsaneleri) */
const mb = grid(112); // 0,536 sn
/** iddialar: oyunun içeriğiyle uyumlu (docs/odyoloji-icerik.md); damga + tek cümle açıklama + oyundaki karşılığı */
const IDDIA = [
  { claim: 'Kulak, yüksek sese<br>alışır.', mit: true, vo: ['m2', 'm3'],
    shotA: { bg: 'clip', clip: clip(21, 3.5, 3.2), cam: { z: [1.15, 1.25], top: [150, 165] }, layers: [lbl('Oyunda: Gürültü hasarı<small>21. bölüm · Koklea · gürültü bulutu</small>', { c: 'coral lo', y: 1190, at: 0.2, rot: -1.5 })] },
    shotB: { tedavi: 'tarif-kulak-tikaci-kart.png', crop: [0, 0, 984, 470], label: 'Tedavi Odası: Kulak tıkacı<small>yüksek seste kulağı korur</small>' } },
  { claim: 'İşitme kaybı sadece<br>yaşlılarda olur.', mit: true, vo: ['m4', 'm5'],
    shotA: { phone: C3('vaka/kv19-hasta.png'), crop: [0, 790, 1170, 1240], label: 'Kamp Kliniği · Hasta Vakaları<small>yenidoğan işitme taraması (kurgusal vaka)</small>' } },
  { claim: 'Bebekler, anne karnında<br>duymaya başlar.', mit: false, vo: ['m6', 'm7'],
    shotA: { phone: C4('hikaye/hikaye-2.jpg'), imgW: 780, crop: [0, 330, 780, 1170], label: 'Oyunun hikâyesi<small>Odi, annesinin ninnisini taşıyor</small>' } },
  { claim: 'Kulak çınlaması<br>önemsizdir.', mit: true, vo: ['m8', 'm9'],
    shotA: { bg: 'clip', clip: clip(37, 17.4, 3.2), cam: { z: [1.15, 1.25], top: [150, 165] }, layers: [lbl('Oyunda: Kulak çınlaması<small>37. bölüm · İşitme Korteksi · nabızlı bulut</small>', { c: 'coral lo', y: 1190, at: 0.2, rot: -1.5 })] },
    shotB: { tedavi: 'tarif-ses-ureteci-kart.png', crop: [0, 0, 984, 380], label: 'Tedavi Odası: Ses üreteci<small>çınlamayı daha az fark edilir kılar</small>' } },
];
const claimL = (html, o = {}) => ({ kind: 'html', cls: 'claim', html: `<small>İddia</small>${html}`, y: o.y ?? 520, at: o.at ?? 0.05, anim: o.anim ?? 'pop' });
const stampL = (mit, o = {}) => ({ kind: 'html', cls: `stamp2 big${mit ? '' : ' ok'}`, html: mit ? 'Mit!' : 'Gerçek!', y: o.y ?? 900, at: o.at ?? 0, anim: 'stamp', rot: mit ? -8 : 6, ...o });
function iddiaSahne(d, i) {
  const n = `${i + 1}/${IDDIA.length}`; const out = [];
  out.push({ id: `iddia${i + 1}`, dur: mb(4), bg: 'quiz', mus: 'claim', fx: { push: 0.03, pushT: mb(4) }, sfx: [[0, 'swish', 0.45], [0.05, 'pop', 0.4]], layers: [
    { kind: 'html', cls: 'numtag', html: n, y: 300, at: 0, anim: 'stamp', rot: -3 }, claimL(d.claim),
    { kind: 'ring', from: 2, dur: mb(3.6), y: 1010, at: mb(0.4), anim: 'pop', zero: '?' },
  ] });
  out.push({ id: `damga${i + 1}`, dur: mb(2), bg: 'quiz', mus: 'think', fx: { flash: [[0, 0.1, d.mit ? [255, 71, 102] : [62, 240, 138], 0.35]], shake: [[0, 0.3, 16]] },
    sfx: [[0, 'stamp', 0.9], [0.02, d.mit ? 'buzzer' : 'ding', 0.5]], layers: [
    { kind: 'html', cls: 'numtag', html: n, y: 300, at: 0, anim: 'none', rot: -3 }, claimL(d.claim, { anim: 'none', at: 0 }), stampL(d.mit, { y: 980 }),
  ] });
  const A = d.shotA;
  out.push(A.bg === 'clip'
    ? { id: `oyun${i + 1}`, dur: d.shotB ? mb(3) : mb(6), bg: 'clip', clip: A.clip, cam: A.cam, mus: 'reveal', fx: { flash: [[0, 0.08]] }, sfx: [[0, 'whoosh', 0.35]], layers: [stampL(d.mit, { y: 270, anim: 'pop', className: '', cls: `stamp2${d.mit ? '' : ' ok'}` }), ...A.layers] }
    : { id: `oyun${i + 1}`, dur: mb(6), bg: 'quiz', mus: 'reveal', sfx: [[0, 'whoosh', 0.35]], layers: [
      stampL(d.mit, { y: 250, anim: 'pop', cls: `stamp2${d.mit ? '' : ' ok'}` }),
      phone(A.phone, A.crop, { imgW: A.imgW ?? 1170, w: 600, y: 400, maxH: 760, ry: [i % 2 ? 10 : -10, i % 2 ? -4 : 4] }),
      lbl(A.label, { c: 'gold lo', y: 1210, at: 0.4, rot: i % 2 ? 1.5 : -1.5 }),
    ] });
  if (d.shotB) {
    const [w] = [984]; const B = d.shotB;
    out.push({ id: `tedavi${i + 1}`, dur: mb(3), bg: 'quiz', sfx: [[0, 'swish', 0.4]], layers: [
      stampL(d.mit, { y: 250, anim: 'none', cls: `stamp2${d.mit ? '' : ' ok'}` }),
      { kind: 'still', src: C4(`tedavi/${B.tedavi}`), crop: B.crop, imgW: w, w: 900, y: 520, at: 0, anim: 'pop', cls: 'teal', kb: [1, 1.04], maxBottom: 1180 },
      lbl(B.label, { c: 'teal lo', y: 1210, at: 0.25, rot: 1.5 }),
    ] });
  }
  return out;
}
const mitReel = {
  slug: 'mit-mi-gercek-mi', title: 'Mit mi, gerçek mi?', ad: true, limit: 0.6, jpegOpaque: true, bpm: 112, snap: mb(1), style: 'mit', subY: 1395, subCls: 'big', voGap: 0.1, tail: 0.7,
  duck: { music: -9, sfx: -4 },
  scenes: [
    { id: 'kanca', dur: mb(5), bg: 'quiz', mus: 'intro', fx: { flash: [[0, 0.12]], zoom: [[0, 0.3, 0.07]] }, sfx: [[0, 'stamp', 0.8], [mb(1.5), 'stamp', 0.8]], layers: [
      { kind: 'html', cls: 'stamp2 big', html: 'Mit mi?', y: 330, at: 0.03, anim: 'stamp', rot: -6 },
      { kind: 'html', cls: 'stamp2 big ok', html: 'Gerçek mi?', y: 640, at: mb(1.5), anim: 'stamp', rot: 5 },
      tsub('Kulak sağlığında 4 iddia', { y: 1000, at: mb(2.5), c: 'lo xl' }),
    ] },
    ...IDDIA.flatMap(iddiaSahne),
    { id: 'son', dur: mb(8), bg: 'quiz', mus: 'end', fx: { flash: [[0, 0.15]], zoom: [[0, 0.3, 0.06]] }, sfx: [[0, 'boom', 0.5], [0.1, 'sparkle', 0.5]], layers: [
      kt('Kaçını<br>bildin?', { c: 'md gold', y: 260, at: 0.05 }),
      { kind: 'html', cls: 'ctaBig', html: 'Cevabını <b>yorumlara yaz</b>', y: 600, at: 0.4, anim: 'rise' },
      { kind: 'html', cls: 'logo sm', html: LOGO, y: 780, at: 0.6, anim: 'zoom' },
      { kind: 'html', cls: 'soon', html: 'Yakında', y: 1080, at: 0.9, anim: 'stamp', rot: -3 },
      { kind: 'html', cls: 'note', html: 'Eğitsel içerik; tıbbi öneri değildir.<br>Şikâyetin varsa bir uzmana danış.', y: 1250, at: 1.0, anim: 'fade' },
    ] },
  ],
  vo: [
    { id: 'm1', scene: 'kanca', at: 0.2, nosub: true },
    ...IDDIA.flatMap((d, i) => [{ id: d.vo[0], scene: `iddia${i + 1}`, at: 0.2 }, { id: d.vo[1], scene: `damga${i + 1}`, at: 0.05 }]),
    { id: 'm10', scene: 'son', at: 0.3, nosub: true },
  ],
  cover: { bg: 'quiz', layers: [
    { kind: 'html', cls: 'stamp2 big', html: 'Mit mi?', y: 300, rot: -6 },
    { kind: 'html', cls: 'stamp2 big ok', html: 'Gerçek mi?', y: 580, rot: 5 },
    { kind: 'html', cls: 'claim', html: '<small>İddia</small>Kulak, yüksek sese<br>alışır.', y: 880 },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1330 },
  ] },
  post: {
    caption: 'Mit mi, gerçek mi? 🤔 “Kulak yüksek sese alışır.” Mit: yüksek ses tüy hücrelerine kalıcı zarar verebilir. “İşitme kaybı sadece yaşlılarda olur.” Mit: her yaşta görülebilir; bu yüzden yenidoğanlar bile taranır. “Bebekler anne karnında duymaya başlar.” Gerçek: gebeliğin son aylarında annenin sesini duyabilirler. “Kulak çınlaması önemsizdir.” Mit: çınlama bir belirtidir; sürerse bir uzmana danış.\nKaçını bildin? Yorumlara yaz 👇 ODİ: Sesin Yolu yakında. (Eğitsel içerik; tıbbi öneri değildir.)',
    tags: ['#odyoloji', '#odyolog', '#odyolojiöğrencisi', '#işitme', '#kulaksağlığı', '#mitmigerçekmi', '#tinnitus', '#gürültü', '#mobiloyun', '#yakında', '#odisesinyolu'],
  },
};

/* =================================================================== 5. TAKIMINI TOPLA (soygun filmi parodisi) */
const hb4 = grid(104); // 0,577 sn
const TK = (f) => C4(`takim/${f}`);
const ekran = (f, o = {}) => phone(TK(f), o.crop ?? [0, 0, 1170, 2532], { imgW: 1170, w: o.w ?? 560, y: o.y ?? 400, maxH: o.maxH ?? 860, ry: o.ry ?? [-10, 4], ...o });
const ROLLER = [
  ['lider', 'Lider', 'Örs Kaptan', 'takımı kurdu · taç onda'],
  ['yardimci', 'Yardımcı', 'Zar Ustası', 'liderin sağ kolu · yıldız rozeti'],
  ['hizli', 'Hızlı', 'Hızlı Lif', 'yarışta önde koşar'],
  ['usta', 'Usta', 'Koklea Kâşifi', 'Usta–Çırak’ta yol gösterir'],
  ['caylak', 'Çaylak', 'Minik Nota', 'başvurusu az önce kabul edildi'],
];
const kartSahne = ([slug, rol, ad, not], i) => ({ id: `rol-${slug}`, dur: hb4(2), bg: 'plan', ...(i === 0 ? { mus: 'freeze' } : {}), fx: { flash: [[0, 0.1, [255, 255, 255], 0.55]], zoom: [[0, 0.25, 0.05]] },
  sfx: [[0, 'snap', 0.8], [0.02, 'hit', 0.35]], layers: [
  { kind: 'html', cls: 'nc', html: `<small>${rol}</small><b>${ad}</b><span>${not}</span>`, y: 420, at: 0, anim: 'stamp', rot: i % 2 ? 2 : -2 },
  { kind: 'still', src: TK(`08-uye-${slug}.png`), crop: [0, 0, ...dims(TK(`08-uye-${slug}.png`))], imgW: dims(TK(`08-uye-${slug}.png`))[0], w: 900, y: 860, at: 0.05, anim: 'pop', cls: i % 2 ? 'teal' : '', kb: [1, 1.03] },
  { kind: 'html', cls: 'lvltag', html: 'Takım › Üyeler', y: 1150, at: 0.15, anim: 'fade' },
] });
const takim = {
  slug: 'takimini-topla', title: 'Takımını topla', ad: true, limit: 0.6, jpegOpaque: true, bpm: 104, snap: hb4(1), style: 'soygun', subY: 1400, subCls: 'big', voGap: 0.1, tail: 0.7,
  duck: { music: -8, sfx: -4 },
  scenes: [
    { id: 'kanca', dur: hb4(7), bg: 'clip', clip: clip(40, 7.0, 1.0), speed: [[0, 1], [0.35, 0.15], [9, 0.15]], blend: true, cam: { z: [1.05, 1.15], top: [110, 120] }, mus: 'intro',
      fx: { base: { grade: 'cold', gradeAmt: 0.7, vignette: 0.5 }, flash: [[0, 0.12]], zoom: [[0, 0.3, 0.06]] }, sfx: [[0, 'boom', 0.7], [0.05, 'stamp', 0.8]], layers: [
      { kind: 'html', cls: 'stamp2 big', html: 'Hedef', y: 300, at: 0.03, anim: 'stamp', rot: -7 },
      { kind: 'html', cls: '', html: '<div class="spotring" style="width:340px;height:340px"></div>', y: 600, at: 0.3, anim: 'pop', pulse: 104, pulseAt: 0.3 },
      kt('Gürültü<br>Canavarı', { c: 'md coral', y: 1000, at: hb4(4.5), anim: 'stamp' }),
    ] },
    { id: 'bul', dur: hb4(4), bg: 'plan', mus: 'plan', sfx: [[0, 'whoosh', 0.4]], layers: [ekran('02-kesif-satir.png', { crop: [0, 600, 1170, 1650], y: 450 }), { kind: 'html', cls: 'lvltag', html: 'Takım › Takım bul', y: 1290, at: 0.3, anim: 'fade' }] },
    { id: 'basvur', dur: hb4(3), bg: 'plan', sfx: [[0, 'swish', 0.4], [hb4(1.5), 'pop', 0.4]], layers: [ekran('04-basvuru.png', { crop: [0, 460, 1170, 1650], y: 430, ry: [10, -4] }), { kind: 'html', cls: 'lvltag', html: 'Başvuru · hazır not', y: 1290, at: 0.3, anim: 'fade' }] },
    ...ROLLER.map(kartSahne),
    { id: 'sohbet', dur: hb4(4), bg: 'plan', mus: 'go', sfx: [[0, 'whoosh', 0.4]], layers: [ekran('09-sohbet.png', { crop: [0, 150, 1170, 2050] }), { kind: 'html', cls: 'lvltag', html: 'Takım sohbeti · yalnız hazır sözler', y: 1290, at: 0.3, anim: 'fade' }] },
    { id: 'yaris', dur: hb4(4), bg: 'plan', sfx: [[0, 'whoosh', 0.4]], layers: [ekran('11-yaris-lobi.png', { crop: [0, 150, 1170, 2050], ry: [10, -4] }), { kind: 'html', cls: 'lvltag', html: 'Canlı Takım Yarışı · 3’e 3', y: 1290, at: 0.3, anim: 'fade' }] },
    { id: 'yaris2', dur: hb4(3), bg: 'plan', sfx: [[0, 'swish', 0.4]], layers: [ekran('12-yaris-ici.png', { crop: [0, 0, 1170, 2300] })] },
    { id: 'baskin', dur: hb4(4), bg: 'plan', sfx: [[0, 'whoosh', 0.4]], layers: [ekran('10-baskin-yari.png', { crop: [0, 150, 1170, 2050], ry: [10, -4] }), { kind: 'html', cls: 'lvltag', html: 'Baskın · ortak can çubuğu', y: 1290, at: 0.3, anim: 'fade' }] },
    { id: 'vurgun', dur: hb4(6), bg: 'clip', clip: clip(40, 26.6, 2.6), speed: [[0, 1], [0.5, 1], [0.6, 0.3], [1.6, 0.3], [1.8, 1]], blend: true, cam: { z: [1.05, 1.18], top: [110, 125], punch: [[0.55, 0.1, 0.3]] }, mus: 'boss',
      fx: { shake: [[0.55, 0.6, 26]], flash: [[0.55, 0.12]] }, sfx: [[0.55, 'boom', 0.8], [0.55, 'hit', 0.6]], layers: [] },
    { id: 'son', dur: hb4(7), bg: 'plan', mus: 'end', fx: { flash: [[0, 0.15]], zoom: [[0, 0.3, 0.06]] }, sfx: [[0, 'boom', 0.5], [0.1, 'sparkle', 0.5]], layers: [
      kt('Takımını<br>topla.', { c: 'lg gold', y: 260, at: 0.05 }),
      { kind: 'html', cls: 'logo sm', html: LOGO, y: 760, at: 0.4, anim: 'zoom' },
      { kind: 'html', cls: 'soon', html: 'Yakında', y: 1090, at: 0.7, anim: 'stamp', rot: -3 },
    ] },
  ],
  vo: [
    { id: 'h1', scene: 'kanca', at: 0.2 }, { id: 'h2', scene: 'bul', at: 0.15 }, { id: 'h3', scene: 'rol-lider', at: 0.08 }, { id: 'h4', scene: 'sohbet', at: 0.15 },
    { id: 'h5', scene: 'yaris', at: 0.15 }, { id: 'h6', scene: 'baskin', at: 0.15 }, { id: 'h7', scene: 'vurgun', at: 0.2 }, { id: 'h8', scene: 'son', at: 0.4, nosub: true },
  ],
  cover: { bg: 'plan', layers: [
    { kind: 'html', cls: 'stamp2 big', html: 'Hedef', y: 260, rot: -7 },
    { kind: 'html', cls: 'kt md coral', html: 'Gürültü<br>Canavarı', y: 500 },
    { kind: 'html', cls: 'nc', html: '<small>Bir plan · Beş oyuncu</small><b>Takımını topla</b>', y: 900 },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1290 },
  ] },
  post: {
    caption: 'Bir plan. Beş oyuncu. Tek hedef: Gürültü Canavarı. 🦉 Lider, yardımcı, hızlı olan, usta… ve bir çaylak. Takımını bul, başvur, planı sohbette hazır sözlerle kur, canlı takım yarışında ısın, baskında hep birlikte vur.\nTakımını topla. ODİ: Sesin Yolu yakında. Ekibine kimi alırdın? Etiketle 👇',
    tags: ['#oyun', '#mobiloyun', '#takım', '#arkadaş', '#odyoloji', '#odyolojiöğrencisi', '#işitme', '#kulak', '#yakında', '#odisesinyolu'],
  },
};

// sinema sahnelerinde yazı alttaki görüntüden ayrılsın: altyazı ve bölüm etiketinin arkasında yumuşak koyulaştırma
for (const sc of sesim.scenes) if (sc.bg === 'clip') sc.shade = 'bot';

// durağan kare kalmasın: oynanış dışı sahnelerde yavaş yakınlaşma (zaten itme olanlar korunur)
for (const r of [sesim, basaramadin, onSaniye, mitReel, takim]) for (const sc of r.scenes) if (sc.bg !== 'clip' && !sc.fx?.push) sc.fx = { ...(sc.fx ?? {}), push: 0.035, pushT: sc.dur };

export const REELS = Object.fromEntries([sesim, basaramadin, onSaniye, mitReel, takim].map((r) => [r.slug, r]));
