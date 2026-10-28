/**
 * ODİ "TV reklamı" Reels'leri, 5. dalga: LANSMAN ("ODİ yayında!"). Beş fikir: sinema fragmanı (bekleyiş bitti), beş hareketle geri sayım,
 * ilk gün kontrol listesi, sınav haftası programı (odyoloji öğrencisi), arkadaş grubu tipleri (takımını kur). Şema reklamlar.mjs ile aynı
 * (record.mjs tanır: node tools/reels/record.mjs --reel simdi-yayinda).
 *
 * YALNIZ UYGULAMA MAĞAZADA YAYINLANDIĞI GÜN PAYLAŞILIR. Bitiş kartındaki mağaza satırı tek bir değerdir (MAGAZA): bir mağaza önce
 * açılırsa yalnız onu değiştirip yeniden üret (`record.mjs --reel <slug> --no-clips` + `compose.py --reel <slug>`). Uygulama simgesi de tek
 * bir dosyadır (IKON: apps/mobile/assets/icon.png); simge değişince aynı iki komut yeter. Mağaza rozeti/marka taklidi yok: düz yazı.
 *
 * Görüntüler oyunun kendisi: oynanış klipleri (clip.html, bot gerçekten oynar), arayüz (cekim4.mjs: takım, Kulak Kartları), kamp
 * (kamp-cekim.mjs + hazirla3.py: büyüyen kamp, Hasta Vakaları, Timpanogram Eşleştir). Sahte kullanıcı, yorum, puan, indirme sayısı,
 * sıralama, sahte süre/kıtlık yok. Geri sayım yalnız bir açılış süslemesidir (beş gerçek hareket), son tarih değildir.
 *
 * Bu dalgada eklenenler: zemin 'launch' (dönen altın ışınlar), sınıflar appicon · live · store · dl · chk · week · day · bignum · move,
 * html katmanında `.draw` çizgileri (L.draw / L.drawAt), müzik stilleri yayin · lofi, efektler check · scribble.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { YARDIMCI } from './reklamlar.mjs';

const { grid, LOGO, kt, tsub, lbl, phone } = YARDIMCI;
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Bitiş kartının mağaza satırı: TEK DEĞER. Bir mağaza önce açılırsa ör. "App Store'da" ya da "Google Play'de" yap. */
export const MAGAZA = "App Store ve Google Play'de";
/** Bitiş kartındaki uygulama simgesi (değiştirilebilir tek dosya) */
export const IKON = path.join(ROOT, 'apps/mobile/assets/icon.png');

const clip = (level, fromT, dur, o = {}) => ({ level, fromT, dur, ...o });
const C3 = (rel) => `reels3/cekim/${rel}`;
const C4 = (rel) => `reels4/cekim/${rel}`;
const TK = (f) => C4(`takim/${f}`);
const seq = (n, o = {}) => ({ dir: path.join(ROOT, 'tools/harness/out/reels3/seq', n), level: 0, fromT: 0, dur: 999, ...o });
function pngDims(abs) {
  try { const b = fs.readFileSync(abs); return [b.readUInt32BE(16), b.readUInt32BE(20)]; } catch { return [1170, 2532]; }
}
const dims = (rel) => pngDims(path.join(ROOT, 'tools/harness/out', rel));

/** bitiş kartı: simge, logo, "Şimdi yayında", mağaza satırı (MAGAZA), indir düğmesi (+ isteğe bağlı satır) */
function sonKart(o = {}) {
  const [iw, ih] = pngDims(IKON); const y = o.y0 ?? 300;
  return [
    { kind: 'still', src: IKON, crop: [0, 0, iw, ih], imgW: iw, w: 340, y, at: 0.04, anim: 'drop', cls: 'appicon', kb: [1, 1], maxBottom: 1900 },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: y + 350, at: 0.22, anim: 'zoom' },
    { kind: 'html', cls: 'live', html: '<b></b>Şimdi yayında', y: y + 660, at: 0.45, anim: 'stamp', rot: -3 },
    { kind: 'html', cls: 'store', html: MAGAZA, y: y + 800, at: 0.7, anim: 'rise' },
    { kind: 'html', cls: 'dl', html: `${o.cta ?? 'Hemen indir'}<i></i>`, y: y + 900, at: 0.9, anim: 'pop', pulse: o.bpm ?? 0, pulseAt: 0.9, pulseAmt: 0.04 },
    ...(o.extra ? [{ kind: 'html', cls: 'note', html: o.extra, y: y + 1050, at: 1.1, anim: 'fade' }] : []),
  ];
}
const cover = (layers, o = {}) => ({ bg: o.bg ?? 'launch', ...o, layers });

/* =================================================================== 1. ŞİMDİ YAYINDA (sinema fragmanı: bekleyiş bitti) */
const fb = grid(100); // 0,6 sn
const FX = (o = {}) => ({ bars: 140, grade: 'teal', vignette: 0.55, grain: 0.01, ...o });
const ttb = (html, o = {}) => ({ kind: 'html', anim: 'flicker', at: 0, y: 1080, ...o, cls: 'band', html: `<div class="tt ${o.c ?? ''}">${html}</div>` });
const bolge = (id, lv, t0, name, tag, dur, o = {}) => ({ id, dur, bg: 'clip', clip: clip(lv, t0, o.cd ?? 2.4), cam: o.cam ?? { z: [1.14, 1.24], top: [150, 162] }, ...(o.mus ? { mus: o.mus } : {}),
  fx: FX({ flash: [[0, 0.1, [255, 255, 255], 0.45]] }), sfx: [[0, 'swish', 0.45], [0, 'hit', 0.3]], layers: [
    ttb(name, { c: 'sm', y: 270, anim: 'none' }), { kind: 'html', cls: 'lvltag', html: tag, y: 370, at: 0.08, anim: 'fade' }] });
const yayinda = {
  slug: 'simdi-yayinda', title: 'ODİ: Sesin Yolu — Şimdi yayında', ad: true, bpm: 100, snap: fb(1), style: 'fragman', subY: 1390, subCls: 'tr', vofx: 'trailer', voGap: 0.2, tail: 0.8, limit: 0.6,
  duck: { music: -10, sfx: -6 },
  scenes: [
    // kanca: Gürültü Canavarı'nın gözü + bıraam + "Bekleyiş bitti."
    { id: 'kanca', dur: fb(3), bg: 'clip', clip: clip(40, 26.8, 2.9), skip: 0.35, cam: { z: [2.1, 2.4], top: 205 }, mus: 'off',
      fx: FX({ flash: [[0, 0.16]], shake: [[0, 0.9, 40]], rgb: [[0, 0.5, 16]], zoom: [[0, 0.35, 0.14]] }), sfx: [[0, 'braam', 1], [0, 'boom', 0.8]], layers: [
      ttb('Bekleyiş<br>bitti.', { c: 'lg gold', y: 980, at: 0.04 }),
    ] },
    { id: 'giris', dur: fb(5), bg: 'clip', clip: clip(2, 0.4, 3.8), speed: 0.35, blend: true, cam: { z: [1.75, 1.95], x: -55, top: [300, 320] }, mus: 'drone',
      fx: FX({ fadeIn: 0.2 }), sfx: [[0.05, 'heartbeat', 0.8], [fb(2.5), 'heartbeat', 0.7]], layers: [] },
    bolge('orman', 3, 9.0, 'Kulak Kılı Ormanı', '3. bölüm · Dış Kulak', fb(2), { mus: 'pulse', cam: { z: [1.15, 1.25], top: [160, 175] } }),
    bolge('zar', 10, 18.7, 'Kulak Zarı', '10. bölüm «Titreşim»', fb(2)),
    bolge('kemik', 15, 34.3, 'Kemikçikler', '15. bölüm «Üzengi»', fb(2), { cam: { z: [1.15, 1.22], top: [140, 150] } }),
    bolge('koklea', 22, 10.7, 'Koklea', '22. bölüm «İnce Sesler»', fb(2), { cd: 3.5, cam: { z: [1.12, 1.24], top: [160, 175] } }),
    bolge('sinir', 31, 17.3, 'İşitme Siniri', '31. bölüm «Elektrik»', fb(1), { mus: 'build', cd: 3.0 }),
    bolge('korteks', 37, 14.9, 'İşitme Korteksi', '37. bölüm «Anlam Bahçesi»', fb(1)),
    { id: 'golem', dur: fb(5), bg: 'clip', clip: clip(20, 10.7, 3.5), speed: [[0, 1], [0.2, 1], [0.28, 0.25], [1.5, 0.25], [1.7, 1]], blend: true,
      cam: { z: [1.05, 1.25], top: 150, punch: [[0.48, 0.12, 0.25]] },
      fx: FX({ shake: [[0.48, 0.9, 38]], flash: [[0.48, 0.12]], rgb: [[0.48, 0.3, 14]] }), sfx: [[0.48, 'boom', 1], [0.48, 'hit', 0.8], [0.48, 'whoosh', 0.5]], layers: [
      ttb('Serumen Golemi', { c: 'gold', at: 1.2 }),
    ] },
    { id: 'sus', dur: fb(1), bg: 'black', mus: 'off', fx: FX(), layers: [] },
    { id: 'canavar', dur: fb(6), bg: 'clip', clip: clip(40, 21.0, 4), cam: { z: [1.0, 1.2], top: 110, punch: [[0.3, 0.1, 0.3]] }, mus: 'full',
      fx: FX({ shake: [[0.3, 1.2, 30]], rgb: [[0.3, 0.6, 18]], flash: [[0, 0.12]] }), sfx: [[0, 'braam', 1], [0, 'boom', 0.9]], layers: [
      ttb('Gürültü Canavarı', { c: 'gold', at: 1.5 }),
    ] },
    // açılış: siyahtan altın ışınlara, "Şimdi yayında" çarpar
    { id: 'acilis', dur: fb(5), bg: 'launch', mus: 'hit', fx: { flash: [[0, 0.22]], shake: [[0, 0.5, 26]], zoom: [[0, 0.4, 0.1]] },
      sfx: [[0, 'boom', 1], [0, 'braam', 0.55], [0.1, 'sparkle', 0.6]], layers: [
      { kind: 'odi', size: 360, y: 330, at: 0.05, anim: 'drop', bob: 1.6, bobAmp: 12 },
      kt('Şimdi<br>yayında', { c: 'lg gold', y: 760, at: 0.02, slamFrom: 2.6 }),
      tsub('ODİ: Sesin Yolu', { y: 1200, at: 0.5, c: 'lo xl' }),
    ] },
    { id: 'son', dur: fb(6), bg: 'launch', mus: 'end', fx: { flash: [[0, 0.12]] }, sfx: [[0, 'boom', 0.5], [0.1, 'sparkle', 0.5], [0.9, 'pop', 0.4]], layers: sonKart({ bpm: 100 }) },
  ],
  vo: [
    { id: 'y1', scene: 'kanca', at: 0.3, nosub: true }, { id: 'y2', scene: 'giris', at: 0.3 }, { id: 'y3', scene: 'orman', at: 0.15 },
    { id: 'y4', scene: 'canavar', at: 0.25, nosub: true }, { id: 'y5', scene: 'acilis', at: 0.35, nosub: true }, { id: 'y6', scene: 'son', at: 0.9, nosub: true },
  ],
  cover: { clip: clip(40, 26.8, 2.9), t: 1.3, frame: { zoom: 2.2, top: 205 }, dim: 0.42, blur: 2.5, bg: 'none', layers: [
    { kind: 'html', cls: 'band', html: '<div class="tt lg gold">Bekleyiş<br>bitti.</div>', y: 300 },
    { kind: 'html', cls: 'live', html: '<b></b>Şimdi yayında', y: 680 },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1260 },
  ] },
  post: {
    caption: 'Bekleyiş bitti. Bir ses, beyne ulaşmak için yola çıkıyor: Kulak Kılı Ormanı, kulak zarı, kemikçikler, Koklea, işitme siniri… ve yolun sonunda Gürültü Canavarı.\nODİ: Sesin Yolu şimdi yayında. 40 bölüm, kulaktan beyne. Hemen indir!',
    tags: ['#odisesinyolu', '#yayında', '#yenioyun', '#mobiloyun', '#oyun', '#odyoloji', '#işitme', '#kulak', '#koklea'],
  },
};

/* =================================================================== 2. GERİ SAYIM (beş gerçek hareket: 5-4-3-2-1 → yayında) */
const sp = grid(120); // 0,5 sn
const CAMR = { z: [1.2, 1.27], top: [175, 185] };
const sayi = (n, id, c, word, hint, o = {}) => ({ id, dur: sp(4), bg: 'clip', clip: c, cam: o.cam ?? CAMR, shade: 'top', ...(o.skip ? { skip: o.skip } : {}), ...(o.speed ? { speed: o.speed } : {}), ...(o.mus ? { mus: o.mus } : {}),
  fx: { flash: [[0, 0.12, [255, 246, 229], 0.7]], zoom: [[0, 0.3, 0.08]], shake: [[0, 0.3, 18]] }, sfx: [[0, 'taiko', 0.9], [0, 'hit', 0.6], [0.02, 'stamp', 0.35], ...(o.sfx ?? [])], layers: [
    { kind: 'html', cls: 'bignum', html: String(n), y: 230, at: 0, anim: 'slam', slamFrom: 2.4 },
    { kind: 'html', cls: 'move', html: `<b>${word}</b><span>${hint}</span>`, y: 735, at: 0.1, anim: 'whipL' },
  ] });
const geri = {
  slug: 'geri-sayim', title: 'Geri sayım: ODİ yayında', ad: true, bpm: 120, snap: sp(1), style: 'spor', subY: 1400, subCls: 'big', voGap: 0.1, tail: 0.7, limit: 0.6,
  duck: { music: -8, sfx: -4 },
  scenes: [
    sayi(5, 'bes', clip(4, 16, 2.4), 'Zıpla', 'Dokun', { mus: 'count' }),
    sayi(4, 'dort', clip(4, 15.9, 2.4), 'Kay', 'Aşağı kaydır'),
    sayi(3, 'uc', clip(10, 39.4, 2.4), 'Süzül', 'Havada basılı tut', { cam: { z: [1.12, 1.2], top: [150, 160] } }),
    sayi(2, 'iki', clip(15, 50.5, 2.4), 'Çakıl', 'Havada aşağı kaydır', { cam: { z: [1.1, 1.16], top: [130, 140], punch: [[0.2, 0.12, 0.2]] }, sfx: [[0.2, 'thud', 0.6]] }),
    sayi(1, 'bir', clip(31, 22.2, 3.4), 'Atıl', 'Koşu yönüne kaydır', { skip: 1.0, cam: { z: [1.2, 1.26], top: [165, 175], punch: [[0.15, 0.12, 0.2]] } }),
    { id: 'sifir', dur: sp(2), bg: 'black', mus: 'off', sfx: [[sp(2), 'reverse', 0.7]], layers: [] },
    { id: 'yayinda', dur: sp(4), bg: 'launch', mus: 'drop', fx: { flash: [[0, 0.2]], shake: [[0, 0.45, 26]], zoom: [[0, 0.35, 0.1]] }, sfx: [[0, 'boom', 1], [0, 'horn', 0.5], [0.1, 'sparkle', 0.6]], layers: [
      kt('Yayında!', { c: 'lg gold', y: 520, at: 0.02, slamFrom: 2.8 }),
      { kind: 'odi', size: 380, y: 820, at: 0.15, anim: 'drop', bob: 1.0, bobAmp: 14 },
      tsub('ODİ: Sesin Yolu', { y: 1270, at: 0.4, c: 'lo xl' }),
    ] },
    ...[[20, 10.7, 'Serumen Golemi', { skip: 0.2, cam: { z: 1.15, top: 150, punch: [[0.28, 0.12, 0.25]] }, fx: { shake: [[0.28, 0.4, 24]] } }],
      [22, 60, 'Koklea', { skip: 0.3, cam: { z: 1.2, top: 190 } }],
      [35, 6.2, 'Ters Dünya', { skip: 0.35, cam: { z: 1.15, top: 160 } }],
      [40, 21.0, 'Gürültü Canavarı', { cam: { z: 1.1, top: 120, punch: [[0.3, 0.1, 0.3]] }, fx: { shake: [[0.3, 0.5, 22]] } }]]
      .map(([lv, t0, name, o], i) => ({ id: `m${i + 1}`, dur: sp(2), bg: 'clip', clip: clip(lv, t0, { 20: 3.5, 22: 3.5, 35: 2.4, 40: 4 }[lv]), ...o, fx: { flash: [[0, 0.08, [255, 255, 255], 0.5]], ...(o.fx ?? {}) },
        sfx: [[0, 'swish', 0.45], [0, 'hit', 0.4]], layers: [lbl(name, { c: i % 2 ? 'teal' : 'gold', y: 1180, at: 0.05, rot: i % 2 ? 2 : -2 })] })),
    { id: 'son', dur: sp(8), bg: 'launch', mus: 'end', fx: { flash: [[0, 0.12]] }, sfx: [[0, 'boom', 0.5], [0.1, 'sparkle', 0.5]], layers: sonKart({ cta: 'Hemen oyna', bpm: 120 }) },
  ],
  vo: [
    { id: 'g1', scene: 'bes', at: 0.12, nosub: true }, { id: 'g2', scene: 'dort', at: 0.12, nosub: true }, { id: 'g3', scene: 'uc', at: 0.12, nosub: true },
    { id: 'g4', scene: 'iki', at: 0.12, nosub: true }, { id: 'g5', scene: 'bir', at: 0.12, nosub: true }, { id: 'g6', scene: 'yayinda', at: 0.3, nosub: true },
  ],
  cover: cover([
    { kind: 'html', cls: 'bignum', html: '5', y: 220 },
    { kind: 'html', cls: 'kt md gold', html: '5 hareket<br>1 yol', y: 760 },
    { kind: 'html', cls: 'live', html: '<b></b>Şimdi yayında', y: 1060 },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1230 },
  ]),
  post: {
    caption: 'Beş: zıpla! Dört: altından kay! Üç: süzül, havada kal! İki: yere çakıl! Bir: ileri atıl!\nODİ: Sesin Yolu yayında. Beş hareket, kırk bölüm, kulaktan beyne tek yol. Hemen oyna!',
    tags: ['#odisesinyolu', '#yayında', '#yenioyun', '#mobiloyun', '#platformoyunu', '#oyun', '#kulak', '#işitme'],
  },
};

/* =================================================================== 3. İLK GÜN (ilk gün seni neler bekliyor? kontrol listesi) */
const ib = grid(124); // ≈0,484 sn
const CHECK = '<svg width="60" height="60" viewBox="0 0 64 64"><path class="draw" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1" d="M13 34 L27 47 L52 17" fill="none" stroke="#062a28" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const OZ = ['40 bölüm', 'Koklea’da yüz', 'Kampını büyüt', 'Takım yarışı', 'Timpanogram Eşleştir', 'Hasta vakaları'];
const chkL = (text, o = {}) => ({ kind: 'html', cls: `chk ${o.c ?? ''}`, html: `<span class="bx">${CHECK}</span>${text}`, y: o.y ?? 265, at: o.at ?? 0, anim: o.anim ?? 'whipL', draw: 0.24, drawAt: o.drawAt ?? 0.14, ...(o.dx ? { dx: o.dx } : {}) });
const madde = (i, extra = {}) => chkL(OZ[i], { c: OZ[i].length > 14 ? 'sm' : '', ...extra });
const ozSfx = [[0, 'whoosh', 0.35], [0.14, 'check', 0.7]];
const CAMI = { z: [1.14, 1.2], top: [150, 160] };
const ilkGun = {
  slug: 'ilk-gun', title: 'İlk gün seni neler bekliyor?', ad: true, bpm: 124, snap: ib(1), style: 'yayin', subY: 1400, subCls: 'big', voGap: 0.08, tail: 0.7, limit: 0.6, jpegOpaque: true,
  duck: { music: -8, sfx: -4 },
  scenes: [
    { id: 'kanca', dur: ib(4), bg: 'launch', mus: 'intro', fx: { flash: [[0, 0.14]], zoom: [[0, 0.3, 0.08]] }, sfx: [[0, 'boom', 0.8], [0, 'hit', 0.5]], layers: [
      kt('İlk gün', { c: 'xl gold', y: 250, at: 0.0, slamFrom: 2.6 }),
      tsub('seni neler bekliyor?', { y: 540, at: 0.25, c: 'lo xl' }),
      ...OZ.map((t, i) => chkL(t, { c: 'sm w off', y: 690 + i * 104, at: 0.35 + i * 0.09, drawAt: 99 })),
    ] },
    { id: 'f1a', dur: ib(2), bg: 'clip', clip: clip(7, 12.1, 2.0), cam: CAMI, mus: 'drop', shade: 'top', fx: { flash: [[0, 0.1]] }, sfx: ozSfx, layers: [
      madde(0), { kind: 'html', cls: 'lvltag', html: '7. bölüm · Kulak Kanalı', y: 1250, at: 0.1, anim: 'fade' }] },
    { id: 'f1b', dur: ib(2), bg: 'clip', clip: clip(13, 41.0, 2.0), cam: CAMI, shade: 'top', sfx: [[0, 'swish', 0.4]], layers: [
      madde(0, { anim: 'none', drawAt: -1 }), { kind: 'html', cls: 'lvltag', html: '13. bölüm · Kemikçikler', y: 1250, at: 0, anim: 'none' }] },
    { id: 'f1c', dur: ib(2), bg: 'clip', clip: clip(35, 6.2, 2.4), skip: 0.35, cam: CAMI, shade: 'top', sfx: [[0, 'swish', 0.4]], layers: [
      madde(0, { anim: 'none', drawAt: -1 }), { kind: 'html', cls: 'lvltag', html: '35. bölüm · Beyin Sapı', y: 1250, at: 0, anim: 'none' }] },
    { id: 'f2', dur: ib(4), bg: 'clip', clip: clip(22, 60, 3.5), skip: 0.3, cam: { z: [1.2, 1.28], top: [185, 195] }, shade: 'top', fx: { flash: [[0, 0.08]] }, sfx: ozSfx, layers: [
      madde(1), { kind: 'html', cls: 'lvltag', html: '21–30. bölüm · Koklea · sıvıda yüz', y: 1250, at: 0.2, anim: 'fade' }] },
    { id: 'f3', dur: ib(4), bg: 'clip', clip: seq('zaman'), skip: 0, speed: 24 / ib(4), cam: { z: [1.0, 1.06], top: [0, 20] }, shade: 'top', sfx: [...ozSfx, ...[0.6, 1.0, 1.4].map((t) => [t, 'chime', 0.25, { n: 84 + Math.round(t * 5) }])], layers: [
      madde(2), { kind: 'html', cls: 'lvltag', html: 'Kulak Kampı · Odyoloji Merkezi büyür', y: 1250, at: 0.2, anim: 'fade' }] },
    { id: 'f4', dur: ib(4), bg: 'plan', sfx: ozSfx, layers: [
      madde(3), phone(TK('12-yaris-ici.png'), [0, 150, 1170, 1380], { imgW: 1170, w: 700, y: 420, maxH: 780, ry: [-10, 4] }),
      { kind: 'html', cls: 'lvltag', html: 'Canlı Takım Yarışı · aynı bölüm, aynı anda', y: 1290, at: 0.3, anim: 'fade' }] },
    { id: 'f5', dur: ib(4), bg: 'board', sfx: ozSfx, layers: [
      madde(4), phone(C3('oyun/timpano-1.png'), [0, 520, 1170, 1500], { imgW: 1170, w: 680, y: 420, maxH: 760, ry: [10, -4] }),
      { kind: 'html', cls: 'note', html: 'Eğri bir bulgudur; tanıyı bütün testler birlikte koyar.', y: 1270, at: 0.3, anim: 'fade' }] },
    { id: 'f6', dur: ib(4), bg: 'night', ringY: 900, sfx: ozSfx, layers: [
      madde(5), phone(C3('vaka/kv19-hasta.png'), [0, 760, 1170, 1250], { imgW: 1170, w: 680, y: 420, maxH: 760, ry: [-10, 4] }),
      { kind: 'html', cls: 'lvltag', html: 'Kamp Kliniği · 32 kurgusal vaka', y: 1290, at: 0.3, anim: 'fade' }] },
    { id: 'ozet', dur: ib(4), bg: 'launch', mus: 'rise', fx: { flash: [[0, 0.1]] }, sfx: [[0, 'whoosh', 0.4], ...OZ.map((_, i) => [0.05 + i * 0.08, 'pop', 0.25])], layers: [
      ...OZ.map((t, i) => chkL(t, { c: 'sm w', y: 280 + i * 104, at: 0.04 + i * 0.08, anim: 'whipL', drawAt: 0.12 })),
      kt('Hepsi<br>ilk günden', { c: 'md gold', y: 960, at: 0.55 }),
    ] },
    { id: 'son', dur: ib(8), bg: 'launch', mus: 'end', fx: { flash: [[0, 0.12]] }, sfx: [[0, 'boom', 0.5], [0.1, 'sparkle', 0.5]], layers: sonKart({ bpm: 124 }) },
  ],
  vo: [
    // i2 "Kırk bölüm." (0,7 sn) drop başlangıcı, savrulma ve tik sesinin altında kalmasın: yalnız bu kısa satırda müzik/efekt −8 dB, 1–5 kHz −6 dB
    { id: 'i1', scene: 'kanca', at: 0.15, nosub: true },
    { id: 'i2', scene: 'f1a', at: 0.1, dip: [[-0.05, 0.75, -8, -6]] }, { id: 'i3', scene: 'f2', at: 0.1 }, { id: 'i4', scene: 'f3', at: 0.1 },
    { id: 'i5', scene: 'f4', at: 0.1 }, { id: 'i6', scene: 'f5', at: 0.1 }, { id: 'i7', scene: 'f6', at: 0.1 }, { id: 'i8', scene: 'ozet', at: 0.15, nosub: true },
  ],
  cover: cover([
    { kind: 'html', cls: 'kt xl gold', html: 'İlk gün', y: 230 },
    { kind: 'html', cls: 'tsub lo xl', html: 'seni neler bekliyor?', y: 520 },
    ...OZ.map((t, i) => ({ kind: 'html', cls: 'chk sm w', html: `<span class="bx">${CHECK.replace('stroke-dashoffset="1"', 'stroke-dashoffset="0"')}</span>${t}`, y: 640 + i * 100 })),
    { kind: 'html', cls: 'live', html: '<b></b>Şimdi yayında', y: 1270 },
  ]),
  post: {
    caption: 'İlk gün seni neler bekliyor?\n✔ 40 bölüm: kulaktan beyne\n✔ Sıvı dolu bir Koklea: içinde yüz\n✔ Büyüyen bir Kulak Kampı\n✔ Takımınla canlı yarış\n✔ Timpanogram Eşleştir (eğri bir bulgudur; tanıyı bütün testler birlikte koyar)\n✔ Kamp Kliniği: 32 kurgusal hasta vakası\nHepsi ilk günden. ODİ: Sesin Yolu yayında, hemen indir!',
    tags: ['#odisesinyolu', '#yayında', '#yenioyun', '#mobiloyun', '#odyoloji', '#odyolojiöğrencisi', '#işitme', '#kulak', '#koklea'],
  },
};

/* =================================================================== 4. SINAV HAFTASI (odyoloji öğrencisi: beş günlük program) */
const lb = grid(84); // ≈0,714 sn
const GUN = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'];
const weekL = (i, o = {}) => ({ kind: 'html', cls: 'week', html: GUN.map((g, k) => `<span class="${k < i ? 'done' : k === i ? 'on' : ''}">${g}</span>`).join(''), y: o.y ?? 255, at: o.at ?? 0, anim: o.anim ?? 'none' });
const dayL = (gun, ders, o = {}) => ({ kind: 'html', cls: 'day', html: `<b>${gun}</b><span>${ders}</span>`, y: o.y ?? 370, at: o.at ?? 0.05, anim: o.anim ?? 'stamp', rot: o.rot ?? -2 });
const daySfx = [[0, 'swish', 0.4], [0.08, 'scribble', 0.5], [0.12, 'paper', 0.25]];
const ekranL = (src, crop, o = {}) => phone(src, crop, { imgW: o.imgW ?? 1170, w: o.w ?? 760, y: o.y ?? 625, maxH: o.maxH ?? 720, ry: o.ry ?? [-7, 3], ...o });
const sinav = {
  slug: 'sinav-haftasi', title: 'Sınav haftası: ODİ yanında', ad: true, bpm: 84, snap: lb(1), style: 'lofi', subY: 1400, subCls: 'big', voGap: 0.1, tail: 0.8, limit: 0.6,
  duck: { music: -7, sfx: -4 },
  scenes: [
    { id: 'kanca', dur: lb(3), bg: 'desk', mus: 'dusty', fx: { flash: [[0, 0.1]], shake: [[0, 0.3, 16]] }, sfx: [[0, 'stamp', 0.9], [0.02, 'hit', 0.4], [0.45, 'pop', 0.4], [0.75, 'boing', 0.3]], layers: [
      { kind: 'html', cls: 'stamp2 big', html: 'Sınav<br>haftası', y: 290, at: 0.02, anim: 'stamp', rot: -6, z: 3 },
      weekL(-1, { y: 720, at: 0.4, anim: 'pop' }),
      { kind: 'dede', size: 440, y: 830, at: 0.7, anim: 'drop', bob: 1.8, bobAmp: 10, z: 1 },
    ] },
    { id: 'pzt', dur: lb(2), bg: 'clip', clip: clip(13, 41.0, 2.0), cam: { z: [1.16, 1.22], top: [170, 178] }, shade: 'top', sfx: daySfx, layers: [
      weekL(0), dayL('Pazartesi', 'Anatomi'), { kind: 'html', cls: 'lvltag', html: '13. bölüm «Çekiç» · Kemikçikler', y: 1260, at: 0.2, anim: 'fade' }] },
    { id: 'pzt2', dur: lb(2), bg: 'clip', clip: clip(15, 50.5, 2.4), cam: { z: [1.1, 1.16], top: [130, 140], punch: [[0.2, 0.1, 0.2]] }, shade: 'top', sfx: [[0, 'swish', 0.35], [0.2, 'thud', 0.4]], layers: [
      weekL(0), dayL('Pazartesi', 'Anatomi', { anim: 'none' }), { kind: 'html', cls: 'lvltag', html: '15. bölüm «Üzengi» · vücudun en küçük kemiği', y: 1260, at: 0, anim: 'none' }] },
    { id: 'sal', dur: lb(4), bg: 'clip', clip: clip(22, 10.7, 3.5), cam: { z: [1.12, 1.22], top: [160, 172] }, shade: 'top', sfx: daySfx, layers: [
      weekL(1), dayL('Salı', 'Fizyoloji', { rot: 2 }), { kind: 'html', cls: 'lvltag', html: '22. bölüm «İnce Sesler» · Koklea tabanı', y: 1260, at: 0.2, anim: 'fade' }] },
    { id: 'car', dur: lb(4), bg: 'desk', sfx: daySfx, layers: [
      weekL(2), dayL('Çarşamba', 'Timpanometri'), ekranL(C3('oyun/timpano-1-cevap.png'), [0, 250, 1170, 1720]),
      { kind: 'html', cls: 'note', html: 'Timpanogram tek başına tanı koydurmaz.', y: 565, at: 0.4, anim: 'fade' }] },
    { id: 'per', dur: lb(4), bg: 'desk', sfx: daySfx, layers: [
      weekL(3), dayL('Perşembe', 'Klinik', { rot: 2 }), ekranL(C3('vaka/kv11-test-grid.png'), [0, 280, 1170, 1500], { ry: [10, -4] }),
      { kind: 'html', cls: 'lvltag', html: 'Kamp Kliniği · Hasta Vakaları (kurgusal)', y: 570, at: 0.4, anim: 'fade' }] },
    { id: 'cum', dur: lb(4), bg: 'desk', sfx: daySfx, layers: [
      weekL(4), dayL('Cuma', 'Tekrar'), ekranL(C4('kart/album-kemikcikler.png'), [0, 300, 1170, 1500]),
      { kind: 'html', cls: 'lvltag', html: 'Kulak Kartları · 50 kart', y: 570, at: 0.4, anim: 'fade' }] },
    { id: 'son', dur: lb(6), bg: 'launch', mus: 'end', fx: { flash: [[0, 0.1]] }, sfx: [[0, 'boom', 0.4], [0.1, 'sparkle', 0.5]], layers: sonKart({ cta: 'Bir tur at', extra: 'Ders notlarının yerine değil, yanında: oynayarak tekrar.' }) },
  ],
  vo: [
    { id: 's1', scene: 'kanca', at: 0.3 }, { id: 's2', scene: 'pzt', at: 0.15 }, { id: 's3', scene: 'sal', at: 0.15 }, { id: 's4', scene: 'car', at: 0.15 },
    { id: 's5', scene: 'per', at: 0.15 }, { id: 's6', scene: 'cum', at: 0.15 }, { id: 's7', scene: 'son', at: 0.5, nosub: true },
  ],
  cover: cover([
    { kind: 'html', cls: 'stamp2 big', html: 'Sınav<br>haftası', y: 260, rot: -6 },
    { kind: 'html', cls: 'week', html: GUN.map((g) => `<span>${g}</span>`).join(''), y: 690 },
    { kind: 'html', cls: 'kt md gold', html: 'ODİ<br>yanında', y: 820 },
    { kind: 'html', cls: 'live', html: '<b></b>Şimdi yayında', y: 1090 },
    { kind: 'dede', size: 320, y: 1230 },
  ], { bg: 'desk' }),
  post: {
    caption: 'Sınav haftası mı? ODİ yanında.\nPazartesi anatomi: çekiç, örs, üzengi. Salı fizyoloji: koklea tabanı ince sesleri algılar. Çarşamba timpanometri: eğriyi oku, bulguyu söyle (timpanogram tek başına tanı koydurmaz). Perşembe klinik: 32 kurgusal hasta vakası. Cuma tekrar: 50 Kulak Kartı.\nDers notlarının yerine değil, yanında. ODİ: Sesin Yolu yayında; sınavdan önce bir tur at! Sınav arkadaşını etiketle.',
    tags: ['#odyoloji', '#odyolojiöğrencisi', '#odyolog', '#sınavhaftası', '#vize', '#final', '#anatomi', '#koklea', '#timpanometri', '#odisesinyolu'],
  },
};

/* =================================================================== 5. İLK TAKIM (her arkadaş grubunda bir tane vardır → takımını kur, ilk sen ol) */
const tb = grid(112); // ≈0,536 sn
const meme = (html, o = {}) => ({ kind: 'html', cls: `meme ${o.c ?? ''}`, html, y: o.y ?? 260, at: o.at ?? 0.03, anim: o.anim ?? 'pop', ...o });
const tip = (n) => ({ kind: 'html', cls: 'numtag', html: `${n}/4`, y: 1240, at: 0.05, anim: 'stamp', rot: -3 });
const CAMT = { z: [1.18, 1.24], top: [175, 185] };
const ilkTakim = {
  slug: 'ilk-takim', title: 'Takımını kur, ilk sen ol', ad: true, bpm: 112, snap: tb(1), style: 'komedi', subY: 1400, subCls: 'big', voGap: 0.08, tail: 0.7, limit: 0.6,
  duck: { music: -9, sfx: -3 },
  scenes: [
    { id: 'kanca', dur: tb(4), bg: 'clip', clip: clip(2, 0.4, 3.8), speed: [[0, 1], [0.25, 0], [9, 0]], cam: { z: [2.0, 2.2], x: -55, top: [312, 318], punch: [[0.25, 0.1, 0.3]] }, mus: 'off',
      fx: { flash: [[0.25, 0.1, [255, 255, 255], 0.5]] }, sfx: [[0, 'hit', 0.5], [0.25, 'scratch', 0.8]], layers: [
      meme('Her arkadaş<br>grubunda<br>bir tane vardır:', { c: 'lg', y: 260, anim: 'slam', slamFrom: 1.6, at: 0.02 }),
    ] },
    { id: 'a1', dur: tb(3), bg: 'clip', clip: clip(31, 17.3, 3.0), speed: 1.4, cam: CAMT, mus: 'bouncy', fx: { flash: [[0, 0.08]] }, sfx: [[0, 'whoosh', 0.4], [0.05, 'pop', 0.4]], layers: [
      meme('Hep önden<br>koşan', { c: 'sm' }), tip(1)] },
    { id: 'a2', dur: tb(3), bg: 'clip', clip: clip(2, 10.0, 2.4), cam: CAMT, sfx: [[0, 'swish', 0.4], [0.3, 'sparkle', 0.4]], layers: [
      meme('Her notayı<br>toplayan', { c: 'sm' }), tip(2)] },
    { id: 'a3', dur: tb(4), bg: 'clip', clip: clip(4, 15.25, 1.6, { mode: 'zipla' }), speed: [[0, 1], [0.38, 1], [0.41, 0], [9, 0]], cam: { ...CAMT, punch: [[0.4, 0.12, 0.25]] }, mus: 'off',
      fx: { base: { grade: 'bw', gradeFrom: 0.41, gradeAmt: 0.7 }, shake: [[0.4, 0.35, 22]], flash: [[0.4, 0.1, [255, 255, 255], 0.5]] }, sfx: [[0.4, 'bonk', 1], [0.45, 'trombone', 0.5]], layers: [
      meme('Aynı yerde<br>takılıp kalan', { c: 'sm' }), tip(3)] },
    { id: 'a4', dur: tb(4), bg: 'plan', mus: 'bright', sfx: [[0, 'whoosh', 0.4], [0.3, 'ding', 0.35]], layers: [
      meme('Ve herkesi<br>toplayan', { c: 'sm', y: 250 }),
      phone(TK('08-uyeler.png'), [0, 520, 1170, 1250], { imgW: 1170, w: 840, y: 470, maxH: 720, ry: [-8, 3] }), tip(4)] },
    { id: 'hepsi', dur: tb(3), bg: 'launch', fx: { flash: [[0, 0.14]], zoom: [[0, 0.3, 0.08]] }, sfx: [[0, 'boom', 0.6], [0.05, 'sparkle', 0.4]], layers: [
      kt('Hepsi<br>lazım.', { c: 'lg gold', y: 320, at: 0.02 }),
      { kind: 'odi', size: 300, y: 820, at: 0.1, anim: 'drop', bob: 1.0, bobAmp: 12 },
    ] },
    { id: 'yaris', dur: tb(3), bg: 'plan', sfx: [[0, 'whoosh', 0.4]], layers: [
      phone(TK('12-yaris-ici.png'), [0, 150, 1170, 1380], { imgW: 1170, w: 800, y: 280, maxH: 920, ry: [8, -3] }),
      { kind: 'html', cls: 'lvltag', html: 'Canlı Takım Yarışı', y: 1270, at: 0.2, anim: 'fade' }] },
    { id: 'baskin', dur: tb(3), bg: 'plan', sfx: [[0, 'whoosh', 0.4]], layers: [
      phone(TK('10-baskin-yari.png'), [0, 600, 1170, 1250], { imgW: 1170, w: 840, y: 280, maxH: 920, ry: [-8, 3] }),
      { kind: 'html', cls: 'lvltag', html: 'Baskın · ortak can çubuğu', y: 1270, at: 0.2, anim: 'fade' }] },
    { id: 'son', dur: tb(7), bg: 'launch', mus: 'end', fx: { flash: [[0, 0.12]] }, sfx: [[0, 'boom', 0.5], [0.1, 'sparkle', 0.5]], layers: sonKart({ cta: 'Takımını kur', extra: 'Arkadaşını etiketle. İlk takımı siz kurun.', bpm: 112 }) },
  ],
  vo: [
    { id: 't1', scene: 'kanca', at: 0.3, nosub: true }, { id: 't2', scene: 'a1', at: 0.1, nosub: true }, { id: 't3', scene: 'a2', at: 0.1, nosub: true },
    { id: 't4', scene: 'a3', at: 0.1, nosub: true }, { id: 't5', scene: 'a4', at: 0.1, nosub: true }, { id: 't6', scene: 'hepsi', at: 0.35 }, { id: 't7', scene: 'son', at: 0.6, nosub: true },
  ],
  cover: { clip: clip(4, 15.25, 1.6, { mode: 'zipla' }), t: 0.38, frame: { zoom: 1.2, top: 180 }, dim: 0.6, blur: 0.8, bg: 'none', layers: [
    { kind: 'html', cls: 'meme', html: 'Her arkadaş<br>grubunda<br>bir tane vardır', y: 240 },
    { kind: 'html', cls: 'kt md gold', html: 'Takımını<br>kur', y: 760 },
    { kind: 'html', cls: 'live', html: '<b></b>Şimdi yayında', y: 1060 },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1220 },
  ] },
  post: {
    caption: 'Her arkadaş grubunda bir tane vardır: hep önden koşan, her notayı toplayan, aynı yerde takılıp kalan… ve herkesi toplayan.\nHepsini takımına al: canlı takım yarışı, baskın, hep birlikte. ODİ: Sesin Yolu yayında. Takımını kur, ilk sen ol! Grubundaki “herkesi toplayan”ı etiketle.',
    tags: ['#odisesinyolu', '#yayında', '#arkadaş', '#takım', '#mobiloyun', '#oyun', '#komik', '#kulak'],
  },
};

// durağan kare kalmasın: oynanış dışı sahnelerde yavaş yakınlaşma (zaten itme olanlar korunur)
for (const r of [yayinda, geri, ilkGun, sinav, ilkTakim]) for (const sc of r.scenes) if (sc.bg !== 'clip' && !sc.fx?.push) sc.fx = { ...(sc.fx ?? {}), push: 0.035, pushT: sc.dur };

export const REELS = Object.fromEntries([yayinda, geri, ilkGun, sinav, ilkTakim].map((r) => [r.slug, r]));
void dims; void seq;
