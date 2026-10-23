/**
 * ODİ "TV reklamı" Reels'leri (2. dalga): her biri bir fikir (fragman parodisi, komik kanca, skeç, spor reklamı), tanıtım turu değil.
 * record.mjs bunları teasers.mjs'teki Reels'lerle birlikte tanır: node tools/reels/record.mjs --reel fragman
 *
 * Teaser şemasına ekler (record.mjs, overlay.html, compose.py, reklam_ses.py):
 *   ad: true            → compose.py reklam yolu (kamera, hız rampası, son işlem, bölümlü müzik + efekt izi)
 *   bpm + snap          → sahne süreleri vuruş katı (b(n)); anlatıcı için uzatma da vuruş katı olur, kesmeler ritme düşer
 *   sahne.mus           → müzik bölümü (reklam_ses.py: fragman | komedi | panik | spor stillerinin bölüm türleri)
 *   sahne.sfx           → [[sn, tür, kazanç, {d, pan, ...}]] (whoosh/riser/reverse/swish olayda BİTER: vuruşa doğru kabarır)
 *   sahne.cam           → oyun kamerası { z: [z0, z1], x, top, ease, punch: [[sn, miktar, sönüm]] } (alt-piksel)
 *   sahne.speed         → hız ya da rampa [[sn, hız], ...] (ağır çekim / dondurma), blend: iki kare harmanı, skip: klipte ileri sar
 *   sahne.fx            → son işlem { bars, grade, gradeFrom, vignette, grain, shake, zoom, rgb, glitch, flash, black, push, fadeIn }
 *   katman anim         → slam · stamp · whipL/whipR · drop · flicker · type · fly · grow (+ out: whip/zoom/drop, jitter, pulse, sway, spin)
 *   katman kind         → phone (eğik telefon kartı), clock, speed (hız çizgileri), spot, goo (kehribar sızıntı)
 * Bilgiler docs/odyoloji-icerik.md'den; oyunda olmayan hiçbir şey, sahte sayı/yorum/puan/ödül/tarih yok. Emoji yok (yazı tipi güvencesi).
 */

const grid = (bpm) => (n) => +((n * 60) / bpm).toFixed(4);
const T = (f) => `tanitim/img/${f}`;
const clip = (level, fromT, dur, o = {}) => ({ level, fromT, dur, ...o });
const LOGO = '<div class="w">OD<span>İ</span></div><div class="tag"><i></i>Sesin Yolu<i></i></div>';

// katman yardımcıları (y: üst kenar, 1080×1920; güvenli: 250–1570, sağ sütundan uzak)
const kt = (html, o = {}) => ({ kind: 'html', anim: 'slam', at: 0, y: 700, ...o, cls: `kt ${o.c ?? ''}`, html });
const tt = (html, o = {}) => ({ kind: 'html', anim: 'flicker', at: 0, y: 820, ...o, cls: `tt ${o.c ?? ''}`, html });
/** görüntü üstünde okunur fragman başlığı: koyu şerit içinde */
const ttb = (html, o = {}) => ({ kind: 'html', anim: 'flicker', at: 0, y: 1110, ...o, cls: 'band', html: `<div class="tt ${o.c ?? ''}">${html}</div>` });
const tsub = (html, o = {}) => ({ kind: 'html', anim: 'fade', at: 0, y: 1000, ...o, cls: `tsub ${o.c ?? ''}`, html });
const lbl = (html, o = {}) => ({ kind: 'html', anim: 'stamp', at: 0, y: 400, ...o, cls: `lbl ${o.c ?? ''}`, html });
const fact = (html, o = {}) => ({ kind: 'html', anim: 'rise', at: 0.3, y: 1150, ...o, cls: `fact ${o.c ?? ''}`, html });
const phone = (src, crop, o = {}) => ({ kind: 'phone', src, crop, w: 560, y: 470, at: 0, anim: 'grow', growFrom: 0.6, growT: 0.35, ry: [-14, 4], rx: [6, 2], kb: [1.0, 1.05], ...o });
const odi = (o = {}) => ({ kind: 'odi', size: 260, y: 800, at: 0, anim: 'pop', bob: 1.4, bobAmp: 10, ...o });
const endLayers = (o = {}) => [
  { kind: 'speed', y: 760, at: 0, anim: 'fade', spinSpeed: 14 },
  odi({ size: 300, y: 320, at: 0, anim: 'drop', bob: 1.6, bobAmp: 12 }),
  { kind: 'html', cls: 'logo', html: LOGO, y: 630, at: 0.1, anim: 'slam', slamFrom: 2.0 },
  { kind: 'html', cls: 'soon', html: 'Yakında', y: 1030, at: 0.45, anim: 'stamp', rot: -3 },
  { kind: 'html', cls: 'ctaBig', html: o.cta ?? 'Takip et, <b>ilk duyan</b> sen ol', y: 1220, at: 0.8, anim: 'rise' },
];
const SWAB = `<svg width="760" height="260" viewBox="0 0 760 260"><defs><radialGradient id="cot" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#f1eefc"/><stop offset="1" stop-color="#cfc8ee"/></radialGradient></defs><g transform="rotate(-14 380 130)">
<rect x="140" y="123" width="480" height="14" rx="7" fill="#e9e4ff" stroke="#b9b0e6" stroke-width="2"/>
${[120, 640].map((cx) => `<g fill="url(#cot)" stroke="#d3ccf2" stroke-width="2">${[[-34, -8, 30], [-10, -20, 30], [16, -14, 30], [30, 6, 28], [6, 18, 30], [-22, 14, 28], [0, 0, 34]].map(([dx, dy, r]) => `<circle cx="${cx + dx}" cy="${130 + dy}" r="${r}"/>`).join('')}</g>`).join('')}</g></svg>`;
const XMARK = `<svg width="520" height="520" viewBox="0 0 520 520"><g stroke-linecap="round"><path d="M80 80L440 440M440 80L80 440" stroke="#5a0016" stroke-width="92"/><path d="M80 80L440 440M440 80L80 440" stroke="#ff2d55" stroke-width="64"/></g></svg>`;

/* =================================================================== 1. FRAGMAN (sinema fragmanı parodisi) */
const fb = grid(100);
const FX = (o = {}) => ({ bars: 150, grade: 'teal', vignette: 0.55, grain: 0.012, ...o });
const fragman = {
  slug: 'fragman', title: 'ODİ: Sesin Yolu — Fragman', ad: true, bpm: 100, snap: fb(1), style: 'fragman', subY: 1390, subCls: 'tr', vofx: 'trailer', voGap: 0.25, tail: 0.9,
  duck: { music: -10, sfx: -6, musicGain: 1.0 },
  scenes: [
    // kanca: tek kare canavar gözü + bıraam → karanlık
    { id: 'kanca', dur: fb(1.5), bg: 'clip', clip: clip(40, 26.8, 2.9), skip: 0.35, cam: { z: [2.1, 2.4], top: 205 }, mus: 'off',
      fx: FX({ flash: [[0, 0.16]], shake: [[0, 0.9, 40]], rgb: [[0, 0.5, 16]], zoom: [[0, 0.35, 0.14]] }), sfx: [[0, 'braam', 1], [0, 'boom', 0.8]], layers: [] },
    { id: 'giris', dur: fb(4), bg: 'clip', clip: clip(4, 29.8, 2.4), speed: 0.6, blend: true, cam: { z: [1.14, 1.4], top: 165 }, mus: 'drone',
      fx: FX({ fadeIn: 0.35, grade: 'teal' }), sfx: [[0.05, 'heartbeat', 0.9], [0.95, 'heartbeat', 0.9], [1.85, 'heartbeat', 0.9]], layers: [] },
    { id: 'donmedi', dur: fb(4), bg: 'clip', clip: clip(7, 12.1, 2.4), speed: 0.7, blend: true, cam: { z: [1.15, 1.45], top: 200 },
      fx: FX({ grade: 'dark', gradeAmt: 0.5 }), sfx: [[0.1, 'heartbeat', 0.8], [fb(4), 'reverse', 0.7]], layers: [] },
    { id: 'kart1', dur: fb(3), bg: 'black', fx: FX({ zoom: [[0, 0.5, 0.05]] }), sfx: [[0, 'boom', 1]], layers: [
      tt('Bir kulak.', { c: 'lg', y: 860 }),
    ] },
    { id: 'sessizlik', dur: fb(5), bg: 'clip', clip: clip(40, 10.4, 3.5), cam: { z: [1.0, 1.18], top: 120 }, mus: 'pulse',
      fx: FX({ glitch: [[1.5, 0.25, 1], [2.6, 0.2, 1.4]], rgb: [[1.5, 0.25, 12], [2.6, 0.2, 14]] }), sfx: [[1.5, 'glitch', 0.6], [2.6, 'glitch', 0.6]], layers: [] },
    { id: 'golem', dur: fb(7), bg: 'clip', clip: clip(20, 10.7, 3.5), speed: [[0, 1], [0.2, 1], [0.28, 0.25], [1.5, 0.25], [1.7, 1]], blend: true,
      cam: { z: [1.05, 1.25], top: 150, punch: [[0.48, 0.12, 0.25]] },
      fx: FX({ shake: [[0.48, 0.9, 38]], flash: [[0.48, 0.12]], rgb: [[0.48, 0.3, 14]] }), sfx: [[0.48, 'boom', 1], [0.48, 'hit', 0.8], [0.48, 'whoosh', 0.5]], layers: [
      ttb('Serumen Golemi', { c: 'gold', at: 1.3 }),
    ] },
    // 18 patolojiden altısı: vuruş başına bir kesme
    ...[[8, 11.45, 'Kulak kiri tıkacı'], [12, 0.0, 'Kulak zarı deliği'], [16, 19.0, 'Üzengi takılması'], [14, 15.45, 'Orta kulakta sıvı'], [30, 57.3, 'Meniere'], [37, 17.75, 'Kulak çınlaması']]
      .map(([lv, t0, name], i) => ({ id: `p${i + 1}`, dur: fb(1), bg: 'clip', clip: clip(lv, t0, 1.9), skip: i === 5 ? 0.7 : 0.35, cam: { z: [1.0, 1.06], top: 90 }, ...(i === 0 ? { mus: 'build' } : {}),
        fx: FX({ flash: [[0, 0.1, [255, 255, 255], 0.6]], rgb: [[0, 0.2, 10]] }), sfx: [[0, 'hit', 0.45], [0, 'swish', 0.5]], layers: [
          ttb(`<span style="font-size:44px;letter-spacing:10px">${String(i + 1).padStart(2, '0')} / 18</span><br>${name}`, { c: i % 2 ? '' : 'gold', y: 1060, anim: 'none' }),
        ] })),
    { id: 'sus', dur: fb(1), bg: 'black', mus: 'off', fx: FX(), layers: [] },
    { id: 'canavar', dur: fb(7), bg: 'clip', clip: clip(40, 21.0, 3.5), cam: { z: [1.0, 1.2], top: 110, punch: [[0.3, 0.1, 0.3]] }, mus: 'full',
      fx: FX({ shake: [[0.3, 1.2, 30]], rgb: [[0.3, 0.6, 18]], flash: [[0, 0.12]] }), sfx: [[0, 'braam', 1], [0, 'boom', 0.9]], layers: [
      ttb('Gürültü Canavarı', { c: 'gold', at: 1.6 }),
    ] },
    { id: 'umut', dur: fb(4), bg: 'void', mus: 'hit', fx: FX({ grade: null }), sfx: [[0, 'boom', 0.6], [fb(4), 'reverse', 0.5]], layers: [
      { kind: 'spot', y: 820, at: 0.3, anim: 'fade', fadeT: 1.2 },
    ] },
    // parodi kırılması: kahraman... minicik
    { id: 'odi', dur: fb(4), bg: 'void', mus: 'cute', fx: FX({ grade: null, vignette: 0.45 }), sfx: [[0.25, 'boing', 0.8], [1.25, 'pop', 0.5]], layers: [
      { kind: 'spot', y: 820, at: 0, anim: 'none' },
      odi({ size: 150, y: 745, at: 0.25, anim: 'pop', bob: 0.9, bobAmp: 6 }),
      tsub('(evet, biraz küçük)', { y: 1020, at: 1.2, anim: 'type', cps: 22, c: 'lo xl' }),
    ] },
    { id: 'hizli', dur: fb(2), bg: 'clip', clip: clip(31, 22.2, 2.4), skip: 1.0, cam: { z: 1.25, top: 170, punch: [[0.15, 0.12, 0.2]] }, mus: 'full',
      fx: FX({ flash: [[0, 0.1]], shake: [[0.15, 0.4, 20]] }), sfx: [[0, 'braam', 0.8], [0, 'hit', 0.7], [0.15, 'whoosh', 0.4]], layers: [
      kt('Hızlı.', { c: 'lg', y: 300 }),
    ] },
    { id: 'cevik', dur: fb(2), bg: 'clip', clip: clip(22, 60, 3.5), skip: 0.3, cam: { z: 1.2, top: 190, punch: [[0.2, 0.14, 0.2]] },
      fx: FX({ flash: [[0, 0.1]], shake: [[0.2, 0.5, 28]] }), sfx: [[0, 'hit', 0.8]], layers: [
      kt('Çevik.', { c: 'lg gold', y: 300 }),
    ] },
    { id: 'durmaz', dur: fb(3), bg: 'clip', clip: clip(40, 26.8, 2.9), skip: 0.2, cam: { z: 1.15, top: 160, punch: [[0.2, 0.15, 0.25]] },
      fx: FX({ flash: [[0, 0.1]], shake: [[0.2, 0.7, 30]], rgb: [[0.2, 0.3, 12]] }), sfx: [[0, 'hit', 0.9], [0.2, 'boom', 0.7]], layers: [
      kt('Durdurulamaz.', { c: 'md coral', y: 300 }),
    ] },
    { id: 'sus2', dur: fb(1), bg: 'black', mus: 'off', fx: FX(), layers: [] },
    { id: 'baslik', dur: fb(6), bg: 'void', ringY: 760, mus: 'end', fx: FX({ grade: null, flash: [[0, 0.2]], shake: [[0, 0.6, 26]], zoom: [[0, 0.4, 0.1]], push: 0.04, pushT: 3.6 }),
      sfx: [[0, 'braam', 0.8], [0, 'boom', 0.7], [0.4, 'sparkle', 0.4]], layers: [
      { kind: 'spot', y: 760, at: 0, anim: 'none' },
      odi({ size: 320, y: 470, at: 0, anim: 'slam', slamFrom: 2.6 }),
      { kind: 'html', cls: 'logo', html: LOGO, y: 800, at: 0.05, anim: 'slam', slamFrom: 2.2 },
      tsub('Kulaktan beyne<br>bir sesin yolculuğu', { y: 1190, at: 1.0, anim: 'fade' }),
    ] },
    { id: 'yakinda', dur: fb(6), bg: 'black', fx: FX({ grade: null }), sfx: [[0, 'boom', 0.7], [2.9, 'pop', 0.6], [2.9, 'sparkle', 0.4]], layers: [
      tt('Yakında', { c: 'lg gold', y: 760, at: 0.15 }),
      odi({ size: 140, y: 1130, at: 2.9, anim: 'drop', bob: 1.0, bobAmp: 6 }),
    ] },
  ],
  vo: [
    { id: 'f1', scene: 'giris', at: 0.35 }, { id: 'f2', scene: 'donmedi', at: 0.25 }, { id: 'f3', scene: 'sessizlik', at: 0.2 },
    { id: 'f4', scene: 'golem', at: 1.0 }, { id: 'f5', scene: 'p1', at: 0.1 }, { id: 'f6', scene: 'canavar', at: 0.35 },
    { id: 'f7', scene: 'umut', at: 0.25 }, { id: 'f8', scene: 'baslik', at: 1.25, nosub: true, fx: 'plain', gain: 1.15 }, { id: 'f9', scene: 'yakinda', at: 0.25 },
  ],
  cover: { clip: clip(40, 26.8, 2.9), t: 1.3, frame: { zoom: 2.2, top: 205 }, dim: 0.55, blur: 1.5, bg: 'none', layers: [
    { kind: 'html', cls: 'band', html: '<div class="tt">Bir ses<br>kulağa girdi.</div>', y: 290 },
    { kind: 'html', cls: 'band', html: '<div class="tt gold lg">Ve geri<br>dönmedi.</div>', y: 520 },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1150 },
    { kind: 'html', cls: 'soon', html: 'Yakında', y: 1430 },
  ] },
  post: {
    caption: 'Bir ses kulağa girdi. Ve geri dönmedi. 🎬\nSerumen Golemi, 18 patoloji, Gürültü Canavarı… ve minicik bir kahraman. ODİ: Sesin Yolu yakında. Kulağına çok yakın bir yerde.\nTakip et, ilk duyan sen ol!',
    tags: ['#odyoloji', '#odyolog', '#odyolojiöğrencisi', '#işitme', '#kulak', '#fragman', '#oyun', '#mobiloyun', '#indieoyun', '#yakında', '#odisesinyolu'],
  },
};

/* =================================================================== 2. SERUMEN (komik kanca) */
const sb = grid(112);
const serumen = {
  slug: 'serumen', title: 'Serumen: herkeste var, kimse konuşmuyor', ad: true, bpm: 112, snap: sb(1), style: 'komedi', subY: 1400, subCls: 'big', voGap: 0.12, tail: 0.6,
  duck: { music: -10, sfx: -3 },
  scenes: [
    { id: 'kanca', dur: sb(3), bg: 'goo', mus: 'off', fx: { shake: [[0.05, 0.45, 24]], zoom: [[0.05, 0.3, 0.08]], vignette: 0.35 }, sfx: [[0.05, 'squish', 1], [0.05, 'thud', 0.8]], layers: [
      { kind: 'goo', y: 0, at: 0, anim: 'none', n: 9 },
      kt('Serumen.', { c: 'lg', y: 720, at: 0.05 }),
      kt('(kulak kiri)', { c: 'sm ink', y: 930, at: 0.5, anim: 'fade' }),
    ] },
    { id: 'herkes', dur: sb(4), bg: 'night', ringY: 1000, mus: 'bouncy', sfx: [[0.05, 'swish', 0.5], [sb(2), 'swish', 0.5]], layers: [
      kt('Herkeste<br>var.', { c: 'lg', y: 300, anim: 'whipL' }),
      kt('Kimse<br>konuşmuyor.', { c: 'md coral', y: 720, at: sb(2), anim: 'whipR' }),
      odi({ size: 200, y: 1060, at: 0.2, sway: 6 }),
    ] },
    { id: 'circir', dur: sb(2), bg: 'night', ringY: 1000, mus: 'off', sfx: [[0.05, 'cricket', 0.7, { d: 1.1 }]], layers: [
      kt('. . .', { c: 'lg', y: 560, anim: 'type', cps: 6 }),
      odi({ size: 220, y: 960, at: 0, anim: 'none', sway: 4, swayT: 2.4 }),
    ] },
    { id: 'konusalim', dur: sb(2), bg: 'goo', mus: 'bouncy', fx: { zoom: [[0, 0.3, 0.08]] }, sfx: [[0, 'stamp', 0.9], [0, 'scratch', 0.35, { d: 0.3 }]], layers: [
      kt('Konuşalım.', { c: 'md box white', y: 760, anim: 'stamp', rot: -4 }),
    ] },
    { id: 'kahraman', dur: sb(5), bg: 'goo', sfx: [[0, 'sparkle', 0.7], [sb(1.5), 'pop', 0.6], [sb(2.5), 'pop', 0.6], [sb(3.5), 'pop', 0.6]], layers: [
      { kind: 'speed', y: 820, at: 0, anim: 'fade', spinSpeed: 22 },
      kt('Aslında bir<br>kahraman', { c: 'md', y: 280, anim: 'slam' }),
      lbl('Kanalı korur', { c: 'teal', y: 640, at: sb(1.5), rot: -3 }),
      lbl('Nemli tutar', { c: 'gold', y: 790, at: sb(2.5), rot: 2 }),
      lbl('Toza, mikroba kalkan', { y: 940, at: sb(3.5), rot: -2 }),
      tsub('Oyundaki kart: "Kulak Kiri Kahramandır"', { y: 1140, at: sb(4), c: 'lo' }),
    ] },
    { id: 'bant', dur: sb(5), bg: 'night', ringY: 900, sfx: [[0, 'whoosh', 0.4]], layers: [
      kt('Kulak kendini<br>temizler', { c: 'md teal', y: 260 }),
      phone(T('ogrenme/10-kulak-kartlari.jpg'), [0, 630, 780, 290], { w: 880, y: 620, ry: [-10, 4], rx: [10, 4] }),
      fact('<b>Yürüyen Bant:</b> kanal derisi kiri içten dışa taşır <i>(epitel göçü)</i>', { y: 1080, at: 0.6 }),
    ] },
    { id: 'birikirse', dur: sb(4), bg: 'clip', clip: clip(8, 11.45, 1.9), skip: 0.55, speed: [[0, 1], [0.3, 1], [0.42, 0]], cam: { z: [1.0, 1.5], x: [0, 45], top: [87, 250], T: 0.45, ease: 'out' }, mus: 'tension',
      fx: { grade: 'bw', gradeFrom: 0.42, gradeAmt: 0.7, flash: [[0.42, 0.12]], vignette: 0.45 }, sfx: [[0.42, 'snap', 0.9]], layers: [
      lbl('Kulak kiri tıkacı<small>birikirse sesin yolunu kapatır</small><i class="arr u"></i>', { c: 'coral', y: 1110, at: 0.45 }),
    ] },
    { id: 'golem', dur: sb(5), bg: 'clip', clip: clip(20, 10.7, 3.5), speed: [[0, 1], [0.2, 1], [0.28, 0.25], [1.4, 0.25], [1.6, 1]], blend: true,
      cam: { z: [1.05, 1.2], top: 150, punch: [[0.48, 0.12, 0.25]] }, mus: 'boss',
      fx: { shake: [[0.48, 0.8, 34]], flash: [[0.48, 0.12]], vignette: 0.4 }, sfx: [[0.48, 'boom', 1], [0.48, 'squish', 0.6]], layers: [
      kt('Serumen<br>Golemi', { c: 'lg', y: 290, at: 0.48 }),
    ] },
    { id: 'cubuk', dur: sb(6), bg: 'red', mus: 'off', fx: { shake: [[sb(1), 0.35, 20]] }, sfx: [[0.05, 'swish', 0.5], [sb(1), 'buzzer', 0.8], [sb(1), 'stamp', 0.8]], layers: [
      kt('Pamuklu<br>çubuk?', { c: 'md', y: 270, anim: 'whipL' }),
      { kind: 'html', cls: 'swab', html: SWAB, y: 640, at: 0.05, anim: 'whipR', rot: -4 },
      { kind: 'html', cls: 'swab', html: XMARK, y: 510, at: sb(1), anim: 'stamp' },
      kt('Asla!', { c: 'lg box white', y: 1000, at: sb(1), anim: 'stamp', rot: -4 }),
      tsub('Kulağın dışını silmek yeterli.', { y: 1230, at: sb(2.5), c: 'lo' }),
    ] },
    { id: 'damla', dur: sb(5), bg: 'night', ringY: 900, mus: 'bouncy', sfx: [[0, 'whoosh', 0.4], [sb(2), 'pop', 0.6]], layers: [
      kt('Oyunda', { c: 'sm box teal', y: 250, anim: 'stamp', rot: -3 }),
      phone(T('kamp/60-tedavi-paneli.jpg'), [40, 1178, 700, 205], { w: 940, y: 520, ry: [12, -4], rx: [8, 3], kb: [1.0, 1.0] }),
      lbl('Kulak kiri yumuşatıcı damla<small>Kamp · Tedavi Odası</small><i class="arr u"></i>', { c: 'gold', y: 1010, at: sb(2) }),
    ] },
    { id: 'hekim', dur: sb(4), bg: 'night', ringY: 900, mus: 'bright', sfx: [[0, 'stamp', 0.8], [sb(1), 'ding', 0.5]], layers: [
      kt('Gerçekte', { c: 'sm box white', y: 300, anim: 'stamp', rot: 3 }),
      kt('Temizliği<br>hekim yapar', { c: 'lg teal', y: 520, at: sb(1) }),
    ] },
    { id: 'rahat', dur: sb(6), bg: 'clip', clip: clip(20, 18.0, 3.5), cam: { z: [1.16, 1.26], top: 195 }, fx: { vignette: 0.4, flash: [[1.5, 0.15]], shake: [[1.5, 0.5, 18]] },
      sfx: [[0.05, 'swish', 0.5], [1.5, 'boom', 0.6], [1.5, 'sparkle', 0.7]], layers: [
      kt('Kulağını<br>rahat bırak.', { c: 'md teal', y: 270, anim: 'whipL', until: 1.45, out: 'whip' }),
      kt('Golemi<br>bize bırak.', { c: 'lg', y: 270, at: 1.5, anim: 'slam' }),
    ] },
    { id: 'son', dur: sb(5), bg: 'night', ringY: 640, mus: 'end', fx: { flash: [[0, 0.15]], zoom: [[0, 0.3, 0.06]] }, sfx: [[0, 'boom', 0.7], [0.1, 'sparkle', 0.6]], layers: endLayers({ cta: 'Kulak kiri mi, golem mi?<br><b>Yorumlara yaz</b>' }) },
  ],
  vo: [
    { id: 's1', scene: 'kanca', at: 0.45, nosub: true }, { id: 's2', scene: 'herkes', at: 0.1, nosub: true }, { id: 's3', scene: 'konusalim', at: 0.05, nosub: true },
    { id: 's4', scene: 'kahraman', at: 0.15 }, { id: 's5', scene: 'bant', at: 0.1 }, { id: 's6', scene: 'birikirse', at: 0.15 },
    { id: 's7', scene: 'golem', at: 0.6 }, { id: 's8', scene: 'cubuk', at: 0.1 }, { id: 's9', scene: 'damla', at: 0.1 },
    { id: 's10', scene: 'hekim', at: 0.1 }, { id: 's11', scene: 'rahat', at: 0.1, nosub: true }, { id: 's12', scene: 'son', at: 0.35, nosub: true },
  ],
  cover: { bg: 'goo', layers: [
    { kind: 'goo', y: 0, n: 9 },
    { kind: 'html', cls: 'kt lg', html: 'Serumen.', y: 540 },
    { kind: 'html', cls: 'kt sm box white', html: 'Herkeste var.<br>Kimse konuşmuyor.', y: 800, rot: -3 },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1130 },
    { kind: 'html', cls: 'soon', html: 'Yakında', y: 1440 },
  ] },
  post: {
    caption: 'Serumen. Herkeste var, kimse konuşmuyor. 🤫 Konuşalım: kulak kiri aslında kanalı koruyan bir kahraman ve kulak onu kendisi dışarı taşır. Pamuklu çubuk mu? Kiri daha derine iter. Temizlik gerekiyorsa hekim yapar.\nBirikirse mi? Oyunda Serumen Golemi’ne dönüşür. ODİ: Sesin Yolu yakında!\nKulak kiri mi, golem mi? Yorumlara yaz 👇',
    tags: ['#odyoloji', '#odyolog', '#odyolojiöğrencisi', '#kulakkiri', '#serumen', '#kulaksağlığı', '#işitme', '#kulak', '#oyun', '#mobiloyun', '#yakında', '#odisesinyolu'],
  },
};

/* =================================================================== 3. SINAV GECESİ (öğrenci skeci) */
const nb = grid(128);
const NOTES = [['Örs', '', -1], ['Çekiç', 'p', 1], ['Üzengi', 'b', -1], ['Koklea', 'g', 1], ['Corti', 'l', -1], ['Tonotopi', '', 1], ['Stria vaskülaris', 'p', -1],
  ['Heschl', 'b', 1], ['Tip B?', 'g', -1], ['Oval pencere', 'l', 1], ['Baziler membran', '', -1], ['Stereosilya', 'p', 1], ['dB HL', 'b', -1], ['OAE', 'g', 1]];
const NOTE_POS = [[300, 555], [760, 631], [420, 783], [790, 885], [260, 995], [640, 1088], [520, 588], [330, 1189], [800, 1206], [560, 935], [470, 470], [720, 732], [250, 698], [600, 1240]];
const sinav = {
  slug: 'sinav-gecesi', title: 'Sınav gecesi', ad: true, bpm: 128, snap: nb(1), style: 'panik', subY: 1400, subCls: 'big', voGap: 0.12, tail: 0.6,
  duck: { music: -10, sfx: -3 },
  scenes: [
    { id: 'kanca', dur: nb(4), bg: 'desk', mus: 'tick', fx: { zoom: [[0, 0.3, 0.08]], vignette: 0.5 }, sfx: [[0, 'thud', 0.8]], layers: [
      { kind: 'clock', y: 470, at: 0, anim: 'slam', from: [3, 0], blink: true, jitter: 2 },
      kt('Sınav: 09.00', { c: 'sm box coral', y: 880, at: nb(1.5), anim: 'stamp', rot: -3 }),
    ] },
    { id: 'kaos', dur: nb(10), bg: 'desk', mus: 'panic', fx: { grade: 'cold', gradeAmt: 0.45, vignette: 0.55, shake: [[nb(7), nb(3), 12]], push: 0.06, pushT: nb(10) },
      sfx: NOTES.map((_, i) => [nb(0.5 * i + 0.25), 'paper', 0.45, { pan: i % 2 ? 0.4 : -0.4 }]), layers: [
      { kind: 'clock', cls: 'sm', y: 250, at: 0, anim: 'none', from: [3, 0], rate: 52, jitter: 3 },
      ...NOTES.map(([w, c, side], i) => ({ kind: 'html', cls: `note-card ${c}`, html: w, x: NOTE_POS[i][0], y: NOTE_POS[i][1], at: nb(0.5 * i + 0.25), anim: 'fly',
        from: [side * 1100, -300 + (i % 3) * 200, side * 60], flyDur: 0.28, rot: ((i * 37) % 24) - 12, jitter: 2 + i * 0.3 })),
    ] },
    { id: 'dur', dur: nb(2), bg: 'black', mus: 'off', fx: { flash: [[0, 0.12]] }, sfx: [[0, 'scratch', 1, { d: 0.6 }]], layers: [
      kt('Dur.', { c: 'xl box white', y: 720, at: 0.05, anim: 'stamp', rot: -4 }),
    ] },
    { id: 'ya', dur: nb(5), bg: 'night', ringY: 1000, sfx: [[nb(0.2), 'pop', 0.4], [nb(1.2), 'pop', 0.4], [nb(2.2), 'pop', 0.4], [nb(2.6), 'boing', 0.6]], layers: [
      kt('Ya', { c: 'lg', y: 300, at: nb(0.2) }),
      kt('oynayarak', { c: 'md gold', y: 480, at: nb(1.2) }),
      kt('öğrenseydin?', { c: 'md teal', y: 630, at: nb(2.2) }),
      odi({ size: 240, y: 950, at: nb(2.6), anim: 'drop' }),
    ] },
    { id: 'cekic', dur: nb(2), bg: 'clip', clip: clip(13, 41.0, 2.4), cam: { z: 1.2, top: 170, punch: [[0, 0.1, 0.2]] }, mus: 'groove', fx: { flash: [[0, 0.1]] },
      sfx: [[0, 'riser', 0.6, { d: 1.6 }], [0, 'hit', 0.7]], layers: [kt('Çekiç', { c: 'lg', y: 280 }), tsub('malleus', { y: 470, anim: 'fade' })] },
    { id: 'ors', dur: nb(2), bg: 'clip', clip: clip(14, 27.3, 2.4), cam: { z: 1.0, top: 87, punch: [[0, 0.1, 0.2]] }, fx: { flash: [[0, 0.1]] }, sfx: [[0, 'hit', 0.6]],
      layers: [kt('Örs', { c: 'lg gold', y: 280 }), tsub('inkus', { y: 470, anim: 'fade' })] },
    { id: 'uzengi', dur: nb(2), bg: 'clip', clip: clip(15, 50.5, 2.4), cam: { z: 1.0, top: 87, punch: [[0.2, 0.12, 0.2]] }, fx: { flash: [[0, 0.1]], shake: [[0.2, 0.4, 22]] },
      sfx: [[0, 'hit', 0.6], [0.2, 'thud', 0.6]], layers: [kt('Üzengi', { c: 'lg teal', y: 280 }), tsub('stapes', { y: 470, anim: 'fade' })] },
    { id: 'sozluk', dur: nb(5), bg: 'night', ringY: 900, sfx: [[0, 'whoosh', 0.4]], layers: [
      kt('Kulak Sözlüğü', { c: 'sm box teal', y: 250, anim: 'stamp', rot: -2 }),
      phone(T('ogrenme/02-kulak-sozlugu-daha-fazla.jpg'), [0, 440, 780, 940], { w: 580, y: 420 }),
      lbl('Önce sade · sonra “Daha fazla”', { c: 'gold', y: 1170, at: nb(2) }),
    ] },
    { id: 'kart', dur: nb(4), bg: 'night', ringY: 900, sfx: [[0, 'whoosh', 0.4], [nb(1), 'sparkle', 0.5]], layers: [
      kt('50 kart', { c: 'lg gold', y: 240 }),
      phone(T('ogrenme/10-kulak-kartlari.jpg'), [0, 140, 780, 1000], { w: 560, y: 470, ry: [14, -4] }),
    ] },
    { id: 'quiz', dur: nb(5), bg: 'night', ringY: 900, sfx: [[0, 'whoosh', 0.4], [nb(2.5), 'ding', 0.6]], layers: [
      kt('128 soru', { c: 'lg coral', y: 240 }),
      phone(T('etkinlik/32-bilgi-yarismasi-soru.jpg'), [0, 40, 780, 1000], { w: 560, y: 470, ry: [-12, 4] }),
    ] },
    { id: 'sabah', dur: nb(6), bg: 'desk', fx: { flash: [[0, 0.15, [190, 255, 250], 0.6]] }, sfx: [[0, 'ding', 0.6], [nb(2.5), 'sparkle', 0.6]], layers: [
      { kind: 'clock', cls: 'calm md', y: 250, at: 0, anim: 'stamp', from: [9, 0] },
      { kind: 'dede', size: 400, y: 520, at: nb(2.5), anim: 'drop', bob: 1.8, bobAmp: 10 },
      kt('Eski dost.', { c: 'md teal', y: 950, at: nb(4) }),
      tsub('Tüy Dede: Corti organında bir tüy hücresi', { y: 1150, at: nb(4.2), c: 'lo' }),
    ] },
    { id: 'son', dur: nb(6), bg: 'night', ringY: 640, mus: 'end', fx: { flash: [[0, 0.15]], zoom: [[0, 0.3, 0.06]] }, sfx: [[0, 'boom', 0.7], [0.1, 'sparkle', 0.6]], layers: endLayers({ cta: 'Sınav arkadaşını <b>etiketle</b>' }) },
  ],
  vo: [
    { id: 'n1', scene: 'kanca', at: 0.15 }, { id: 'n2', scene: 'kaos', at: 0.3 }, { id: 'n3', scene: 'kaos', at: 2.9 },
    { id: 'n4', scene: 'ya', at: 0.1, nosub: true }, { id: 'n5', scene: 'cekic', at: 0.05 }, { id: 'n6', scene: 'sozluk', at: 0.15 },
    { id: 'n7', scene: 'kart', at: 0.1 }, { id: 'n8', scene: 'quiz', at: 0.1 }, { id: 'n9', scene: 'sabah', at: 0.2 }, { id: 'n10', scene: 'son', at: 0.35, nosub: true },
  ],
  cover: { bg: 'desk', layers: [
    { kind: 'clock', y: 330, from: [3, 0] },
    { kind: 'html', cls: 'kt sm box coral', html: 'Sınav: 09.00', y: 700, rot: -3 },
    ...NOTES.slice(0, 6).map(([w, c], i) => ({ kind: 'html', cls: `note-card ${c}`, html: w, x: [250, 830, 300, 800, 520, 560][i], y: [870, 850, 990, 1010, 930, 1060][i], rot: [-10, 8, 6, -7, 3, -4][i] })),
    { kind: 'html', cls: 'kt sm', html: 'Ya oynayarak<br>öğrenseydin?', y: 1200 },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1390 },
  ] },
  post: {
    caption: 'Gece üç. Sınav sabah dokuzda. Örs mü çekiç mi, Corti nerede? 😵‍💫\nYa oynayarak öğrenseydin? Kemikçikleri zıplayarak, terimleri Kulak Sözlüğü’nde, 50 Kulak Kartı ve 128 soruyla. ODİ: Sesin Yolu yakında!\nSınav arkadaşını etiketle 👇',
    tags: ['#odyoloji', '#odyolojiöğrencisi', '#odyolog', '#sınavhaftası', '#vize', '#final', '#işitme', '#anatomi', '#koklea', '#oyun', '#yakında', '#odisesinyolu'],
  },
};

/* =================================================================== 4. TAKIM MACERA (spor reklamı) */
const mb = grid(128);
const takim = {
  slug: 'takim-macera', title: 'Kim daha hızlı duyar?', ad: true, bpm: 128, snap: mb(1), style: 'spor', subY: 1400, subCls: 'big', voGap: 0.1, tail: 0.6,
  duck: { music: -8, sfx: -3 },
  scenes: [
    { id: 'say', dur: mb(4), bg: 'stadium', mus: 'count', fx: { zoom: [[0, 0.3, 0.1], [mb(1), 0.3, 0.1], [mb(2), 0.3, 0.1]], shake: [[0, 0.3, 14], [mb(1), 0.3, 14], [mb(2), 0.3, 18]] },
      sfx: [[0, 'crowd', 0.55, { d: 4.5, rise: 3 }], [0, 'beep', 0.6], [mb(1), 'beep', 0.6], [mb(2), 'beep', 0.6, { f: 1320 }], [mb(4), 'riser', 0.5, { d: 1.2 }]], layers: [
      kt('3', { c: 'xxl gold', y: 560, at: 0, until: mb(1), out: 'zoom' }),
      kt('2', { c: 'xxl teal', y: 560, at: mb(1), until: mb(2), out: 'zoom' }),
      kt('1', { c: 'xxl coral', y: 560, at: mb(2), until: mb(3.6), out: 'zoom' }),
    ] },
    { id: 'basla', dur: mb(2), bg: 'stadium', mus: 'drop', fx: { flash: [[0, 0.15]], shake: [[0, 0.5, 26]], zoom: [[0, 0.3, 0.1]] },
      sfx: [[0, 'whistle', 0.8], [0, 'horn', 0.6], [0, 'cheer', 0.7], [0, 'boom', 0.6]], layers: [
      { kind: 'speed', y: 820, at: 0, anim: 'none', spinSpeed: 60 },
      kt('Başla!', { c: 'xl box teal', y: 700, anim: 'stamp', rot: -4 }),
    ] },
    { id: 'kosu', dur: mb(5), bg: 'clip', clip: clip(4, 16, 3.5), speed: 1.2, cam: { z: [1.25, 1.4], top: 215, punch: [[0, 0.08, 0.2], [mb(2), 0.08, 0.2], [mb(4), 0.08, 0.2]] }, fx: { vignette: 0.35 },
      sfx: [[0.05, 'swish', 0.6], [mb(1.5), 'swish', 0.6], [mb(3), 'swish', 0.6]], layers: [
      { kind: 'speed', y: 820, at: 0, anim: 'none', spinSpeed: 30 },
      kt('Aynı bölüm', { c: 'sm box gold', y: 280, anim: 'whipL', rot: -2 }),
      kt('aynı anda', { c: 'sm box teal', y: 430, at: mb(1.5), anim: 'whipR', rot: 2 }),
      kt('takımınla!', { c: 'sm box coral', y: 580, at: mb(3), anim: 'whipL', rot: -2 }),
    ] },
    { id: 'yaris', dur: mb(4), bg: 'stadium', sfx: [[0, 'whoosh', 0.5]], layers: [
      kt('Canlı Takım Yarışı', { c: 'sm', y: 250 }),
      phone(T('takim/10-yaris-ici.jpg'), [0, 0, 780, 1300], { w: 620, y: 390, maxH: 940, ry: [-18, 6] }),
    ] },
    { id: 'sonuc', dur: mb(4), bg: 'stadium', sfx: [[0, 'whoosh', 0.5], [mb(1), 'cheer', 0.6, { d: 2 }]], layers: [
      phone(T('sosyal/65-yaris-sonucu.jpg'), [0, 0, 780, 900], { w: 700, y: 450, maxH: 900, ry: [16, -4] }),
      kt('Birinci!', { c: 'lg gold', y: 260, at: mb(1) }),
    ] },
    { id: 'lig', dur: mb(6), bg: 'stadium', fx: { shake: [[mb(4), 0.4, 18]], flash: [[mb(4), 0.12]] },
      sfx: [[0, 'hit', 0.5], [mb(1), 'hit', 0.5], [mb(2), 'hit', 0.5], [mb(3), 'hit', 0.6], [mb(4), 'boom', 0.8], [mb(4), 'sparkle', 0.6]], layers: [
      kt('Takım Ligi', { c: 'sm', y: 250, anim: 'fade' }),
      ...[['br', 'Bronz'], ['sv', 'Gümüş'], ['au', 'Altın'], ['pt', 'Platin'], ['kk', 'Koklea']].map(([c, w], i) =>
        ({ kind: 'html', cls: 'tier ' + c, html: w, y: 1060 - i * 150, at: mb(i), anim: i === 4 ? 'slam' : 'drop', rot: i % 2 ? 2 : -2, ...(i === 4 ? { pulse: 128, pulseAt: mb(4) } : {}) })),
    ] },
    { id: 'siralama', dur: mb(4), bg: 'stadium', sfx: [[0, 'whoosh', 0.5]], layers: [
      kt('Sıralama', { c: 'sm box gold', y: 250, anim: 'stamp', rot: -2 }),
      phone(T('sosyal/50-siralama-podyum.jpg'), [0, 80, 780, 1000], { w: 660, y: 400, maxH: 940, ry: [14, -4] }),
    ] },
    { id: 'canavar', dur: mb(6), bg: 'clip', clip: clip(40, 26.8, 2.9), speed: [[0, 1], [0.35, 1], [0.42, 0.25], [1.4, 0.25], [1.6, 1]], blend: true,
      cam: { z: [1.05, 1.2], top: 150, punch: [[0.48, 0.12, 0.25]] }, mus: 'drop',
      fx: { shake: [[0.48, 0.8, 30]], flash: [[0.48, 0.12]], rgb: [[0.48, 0.3, 12]], vignette: 0.4 }, sfx: [[0.48, 'boom', 1], [0.48, 'hit', 0.7], [1.0, 'cheer', 0.6, { d: 2.4 }]], layers: [
      kt('Hep<br>beraber!', { c: 'lg coral', y: 270, at: 0.48 }),
    ] },
    { id: 'logo', dur: mb(5), bg: 'stadium', mus: 'break', fx: { flash: [[0, 0.15]], zoom: [[0, 0.3, 0.06]] }, sfx: [[0, 'boom', 0.7], [0.1, 'sparkle', 0.6]], layers: endLayers({ cta: 'Takımın <b>seni bekliyor</b>' }) },
    { id: 'meydan', dur: mb(6), bg: 'stadium', mus: 'end', fx: { shake: [[0, 0.4, 18]] }, sfx: [[0, 'horn', 0.6], [0, 'cheer', 0.6, { d: 2.5 }]], layers: [
      { kind: 'speed', y: 820, at: 0, anim: 'none', spinSpeed: 20 },
      kt('Kim daha<br>hızlı duyar?', { c: 'md gold', y: 380 }),
      { kind: 'html', cls: 'ctaBig', html: 'Arkadaşını <b>etiketle</b>, meydan oku!', y: 860, at: 0.5, anim: 'rise' },
      { kind: 'html', cls: 'logo sm', html: LOGO, y: 1080, at: 0.8, anim: 'zoom' },
    ] },
  ],
  vo: [
    { id: 'm1', scene: 'say', at: 0.02, nosub: true }, { id: 'm2', scene: 'kosu', at: 0.05, nosub: true }, { id: 'm3', scene: 'sonuc', at: 0.1 },
    { id: 'm4', scene: 'lig', at: 0.1 }, { id: 'm5', scene: 'siralama', at: 0.1 }, { id: 'm6', scene: 'canavar', at: 0.1 },
    { id: 'm7', scene: 'logo', at: 0.3, nosub: true }, { id: 'm8', scene: 'meydan', at: 0.1, nosub: true },
  ],
  cover: { bg: 'stadium', layers: [
    { kind: 'speed', y: 820, spinSpeed: 0 },
    { kind: 'html', cls: 'kt xl gold', html: '3·2·1', y: 330 },
    { kind: 'html', cls: 'kt md', html: 'Kim daha<br>hızlı duyar?', y: 660 },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1080 },
    { kind: 'html', cls: 'soon', html: 'Yakında', y: 1420 },
  ] },
  post: {
    caption: 'Üç, iki, bir… kim daha hızlı duyar? 🏁 Takımınla aynı bölümü aynı anda koş, Bronz’dan Koklea ligine tırman, canavarı hep beraber devir. ODİ: Sesin Yolu yakında. Takımın seni bekliyor!\nArkadaşını etiketle, meydan oku 👇',
    tags: ['#odyoloji', '#odyolojiöğrencisi', '#odyolog', '#işitme', '#kulak', '#takım', '#yarış', '#mobiloyun', '#oyun', '#yakında', '#odisesinyolu'],
  },
};

export const REELS = Object.fromEntries([fragman, serumen, sinav, takim].map((r) => [r.slug, r]));
