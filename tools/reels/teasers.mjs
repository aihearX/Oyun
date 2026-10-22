/**
 * "Yakında yayında" teaser Reels'leri (odyoloji topluluğu için). Her Reels: sahneler (kesme, ~1,5-2,5 sn) + yazı katmanları +
 * Tüy Dede'nin gerçek kayıtları (apps/web/public/voice) + özgün müzik.
 * Bilgiler yalnızca docs/odyoloji-icerik.md'deki maddelerden; tarih, indirme sayısı, mağaza rozeti yok; tıbbi öneri yok.
 *
 * Sahne: { id, dur, bg: 'clip'|'night', clip?: { level, salt?, fromT, dur }, frame?: { top, zoom, x }, shade?, flash?, layers: [...] }
 *   clip: temiz oynanış klibi (tools/reels/capture.mjs, bot gerçekten oynar; fromT: tools/reels/zaman.mjs saniyesi)
 *   frame: oyun kadrajı (oyun pikseli): top = üstten kırpılan, zoom = 1 → 390 piksel genişlik
 * Katman koordinatları 1080×1920; güvenli alan: yazılar y 230–1530, sağdaki platform düğmelerinden uzak.
 * voice: [{ id, scene, at, from?, to?, gain?, subs: [[t0, t1, metin]] }] — at: sahne başından sn; from/to: kaydın içinden kesit;
 *   subs: kesitin başından sn (kayıttaki duraklamalara göre bölündü; işitme engelli izleyici için altyazı her zaman ekranda)
 */

/** Tip A (tepeli) ve Tip B (düz) timpanogram çizimi (şematik; eksen: basınç daPa, admitans) */
const TYMP = `<svg width="860" height="400" viewBox="0 0 860 400" style="background:rgba(16,9,46,.88);border-radius:36px;border:5px solid rgba(201,193,255,.45);box-shadow:0 14px 36px rgba(0,0,0,.5)">
<g font-family="Nunito" font-weight="900">
<line x1="90" y1="320" x2="800" y2="320" stroke="#c9c1ff" stroke-width="4"/><line x1="90" y1="320" x2="90" y2="50" stroke="#c9c1ff" stroke-width="4"/>
<text x="445" y="372" fill="#c9c1ff" font-size="30" text-anchor="middle">basınç (daPa)</text>
<text x="60" y="190" fill="#c9c1ff" font-size="30" text-anchor="middle" transform="rotate(-90 60 190)">admitans</text>
<text x="160" y="352" fill="#c9c1ff" font-size="24" text-anchor="middle">−400</text><text x="620" y="352" fill="#c9c1ff" font-size="24" text-anchor="middle">0</text><text x="770" y="352" fill="#c9c1ff" font-size="24" text-anchor="middle">+200</text>
<path d="M110 300 C 380 296, 540 270, 580 170 C 600 110, 640 110, 660 170 C 700 270, 740 296, 790 300" fill="none" stroke="#2ee6d6" stroke-width="9" stroke-linecap="round" opacity=".55"/>
<text x="560" y="96" fill="#2ee6d6" font-size="34" opacity=".75">Tip A</text>
<path d="M110 290 L 790 288" fill="none" stroke="#ffc93c" stroke-width="12" stroke-linecap="round"/>
<text x="140" y="262" fill="#ffc93c" font-size="42">Tip B: tepe yok</text></g></svg>`;

const R1 = 'Kulağın içinden bir yolculuk';
const LOGO = '<div class="w">OD<span>İ</span></div><div class="tag"><i></i>Sesin Yolu<i></i></div>';
export const CLIP_DUR = 2.4;
const clip = (level, fromT, o = {}) => ({ level, fromT, dur: o.dur ?? CLIP_DUR, ...(o.salt ? { salt: o.salt } : {}) });
const hook = (html, o = {}) => ({ kind: 'html', cls: `hook ${o.cls ?? ''}`, html, y: o.y ?? 300, at: o.at ?? 0, until: o.until, anim: o.anim ?? 'pop' });
const chip = (html, o = {}) => ({ kind: 'html', cls: `chip ${o.cls ?? ''}`, html, y: o.y ?? 360, at: o.at ?? 0, until: o.until, anim: o.anim ?? 'pop' });
const term = (t, s, o = {}) => ({ kind: 'html', cls: 'term', html: `<div class="t ${o.tcls ?? ''}" style="${o.size ? `font-size:${o.size}px` : ''}">${t}</div>${s ? `<div class="s ${o.scls ?? ''}">${s}</div>` : ''}`, y: o.y ?? 450, at: o.at ?? 0.05, until: o.until, anim: o.anim ?? 'zoom' });
const fact = (html, o = {}) => ({ kind: 'html', cls: `fact ${o.cls ?? ''}`, html, y: o.y ?? 1300, at: o.at ?? 0.25, until: o.until, anim: o.anim ?? 'rise' });
const still = (src, crop, o = {}) => ({ kind: 'still', src, crop, w: o.w ?? 880, y: o.y ?? 560, cls: o.cls ?? '', at: o.at ?? 0, until: o.until, anim: o.anim ?? 'rise', kb: o.kb ?? [1.0, 1.06], pan: o.pan });
const journey = (step, from) => ({ kind: 'journey', n: 9, step, from, y: 236, at: 0, anim: 'none' });

/** ortak bitiş kartı */
const endCard = (o = {}) => ({
  id: 'son', dur: o.dur ?? 3.6, bg: 'night', ringY: 520, layers: [
    { kind: 'odi', size: 330, y: 250, at: 0, anim: 'pop', bob: 1.6, bobAmp: 12, dx: o.dede ? -130 : 0 },
    ...(o.dede ? [{ kind: 'dede', size: 300, y: 250, at: 0.1, anim: 'pop', bob: 1.9, bobAmp: 10, phase: 0.5, dx: 160 }] : []),
    { kind: 'html', cls: 'logo', html: LOGO, y: 590, at: 0.15, anim: 'zoom' },
    { kind: 'html', cls: 'soon', html: 'Yakında yayında', y: 1000, at: 0.45, anim: 'pop' },
    { kind: 'html', cls: 'cta', html: `<div class="a">${o.a ?? 'Takip et, ilk duyan sen ol 🔔'}</div><div class="b">${o.b ?? 'Sınıf arkadaşını etiketle 👇'}</div>`, y: 1170, at: 0.8, anim: 'rise' },
    ...(o.note ? [{ kind: 'html', cls: 'note', html: o.note, y: 1430, at: 1.0, anim: 'fade' }] : []),
  ],
});

/* ------------------------------------------------------------------ 1 */
const kulakYolculugu = {
  slug: 'kulak-yolculugu', title: R1, bpm: 120, style: 'merak',
  scenes: [
    { id: 'kanca', dur: 2.5, bg: 'clip', clip: clip(22, 60.0), shade: 'top', layers: [
      hook('Kokleanın içinde <em>koşan</em> bir oyun hiç gördün mü? 👀', { y: 300 }),
      chip('<b>▶</b>Kulaktan beyne', { y: 720, at: 1.0, cls: 'gold' }),
    ] },
    { id: 'aurikula', dur: 2.0, bg: 'clip', clip: clip(4, 29.8), shade: 'top', flash: true, layers: [
      journey(0, 0), chip('<b>1</b>Dış kulak', { y: 350 }), term('Aurikula', 'kulak kepçesi · sesi toplar'),
    ] },
    { id: 'kanal', dur: 2.0, bg: 'clip', clip: clip(7, 12.1), shade: 'top', layers: [
      journey(1), chip('<b>2</b>Dış kulak yolu', { y: 350 }), term('≈2,5 cm', 'bir ucu kapalı tüp · 2,5–3 kHz rezonans'),
    ] },
    { id: 'zar', dur: 2.0, bg: 'clip', clip: clip(10, 39.4), shade: 'top', layers: [
      journey(2), chip('<b>3</b>Orta kulak', { y: 350 }), term('Timpanik membran', 'kulak zarı · ≈0,1 mm · üç katman', { size: 100 }),
    ] },
    { id: 'malleus', dur: 1.5, bg: 'clip', clip: clip(13, 41.0), shade: 'top', layers: [
      journey(3), chip('<b>4</b>Kemikçikler', { y: 350 }), term('Malleus', 'çekiç'),
    ] },
    { id: 'inkus', dur: 1.5, bg: 'clip', clip: clip(14, 27.3), shade: 'top', layers: [
      journey(3, 3), chip('<b>4</b>Kemikçikler', { y: 350, anim: 'none' }), term('İnkus', 'örs'),
    ] },
    { id: 'stapes', dur: 1.5, bg: 'clip', clip: clip(15, 50.5), shade: 'top', layers: [
      journey(3, 3), chip('<b>4</b>Kemikçikler', { y: 350, anim: 'none' }), term('Stapes', 'üzengi · vücudun en küçük kemiği'),
    ] },
    { id: 'baz', dur: 2.0, bg: 'clip', clip: clip(22, 42.9), shade: 'top', flash: true, layers: [
      journey(4), chip('<b>5</b>Koklea · baz', { y: 350 }), term('Yüksek frekans', 'tabanda ince sesler', { size: 112, tcls: 'tlg' }),
    ] },
    { id: 'apeks', dur: 2.0, bg: 'clip', clip: clip(27, 68.5), shade: 'top', layers: [
      journey(5), chip('<b>6</b>Koklea · apeks', { y: 350 }), term('Tonotopi', 'tepede kalın sesler · her frekansa bir adres', { tcls: 'tlg' }),
    ] },
    { id: 'sinir', dur: 2.0, bg: 'clip', clip: clip(31, 22.2), shade: 'top', flash: true, layers: [
      journey(6), chip('<b>7</b>İşitme siniri', { y: 350 }), term('VIII. sinir', '≈30.000 lif · vestibülokoklear'),
    ] },
    { id: 'beyinsapi', dur: 2.0, bg: 'clip', clip: clip(34, 15.4), shade: 'top', layers: [
      journey(7), chip('<b>8</b>Beyin sapı', { y: 350 }), term('Superior oliver', 'iki kulağın sesi ilk burada buluşur', { size: 108 }),
    ] },
    { id: 'korteks', dur: 2.0, bg: 'clip', clip: clip(37, 66.8), shade: 'top', layers: [
      journey(8), chip('<b>9</b>İşitsel korteks', { y: 350 }), term('Heschl girusu', 'ses burada anlama dönüşür', { size: 116 }),
    ] },
    endCard(),
  ],
  voice: [
    { id: 'hikaye-03', scene: 'aurikula', at: 0.15, subs: [[0, 2.25, 'Ninni kulaktan girer, kanalı geçer,'], [2.25, 4.3, 'kulak zarına ve kemikçiklere ulaşır;'], [4.3, 6.9, 'kokleadan işitme siniriyle beyne gider.']] },
    { id: 'anit-koklea-3', scene: 'baz', at: 0.1, from: 1.8, to: 5.38, subs: [[0, 1.62, 'Kokleanın tabanı ince seslere,'], [1.62, 3.58, 'tepesi kalın seslere yanıt verir.']] },
  ],
  cover: { clip: clip(22, 60.0), t: 1.2, layers: [
    { kind: 'html', cls: 'chip gold', html: '<b>▶</b>Kulaktan beyne', y: 520 },
    { kind: 'html', cls: 'hook', html: 'Kokleanın içinde <em>koşan</em> bir oyun', y: 640 },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1120 },
    { kind: 'html', cls: 'soon', html: 'Yakında yayında', y: 1420 },
  ] },
  post: {
    caption: 'Aurikuladan Heschl girusuna: Odi kulağın içinden koşuyor, sen her bölgede gerçek terimi öğreniyorsun. 👂🎮\nODİ: Sesin Yolu yakında yayında. Takip et, ilk duyan sen ol!',
    tags: ['#odyoloji', '#odyolog', '#odyolojiöğrencisi', '#işitme', '#koklea', '#tonotopi', '#kulak', '#anatomi', '#oyun', '#mobiloyun', '#yakında', '#odisesinyolu'],
  },
};

/* ------------------------------------------------------------------ 2 */
const T = (f) => `tanitim/img/${f}`;
const odyolojiOgrencileri = {
  slug: 'odyoloji-ogrencileri', title: 'Odyoloji öğrencileri, bu sizin için', bpm: 120, style: 'merak',
  scenes: [
    { id: 'kanca', dur: 2.5, bg: 'clip', clip: clip(10, 23.9), shade: 'top', layers: [
      hook('Timpanogram <em>Tip B</em> ne anlatır? 🤔', { y: 300 }),
      chip('Cevap videonun sonunda 👇', { y: 640, at: 0.9, cls: 'gold' }),
    ] },
    { id: 'sayi', dur: 2.0, bg: 'night', ringY: 700, flash: true, layers: [
      chip('Odyoloji öğrencileri, bu sizin için', { y: 300, cls: 'coral' }),
      { kind: 'count', from: 0, to: 18, dur: 1.1, y: 470, at: 0.1, anim: 'zoom' },
      { kind: 'html', cls: 'term', html: '<div class="s">gerçek kulak patolojisi, bölümlerin içinde</div>', y: 760, at: 0.4, anim: 'rise' },
      fact('Kaynak: ders kitapları · <i>Katz</i>, <i>Gelfand</i>, <i>Pickles</i>', { y: 1000, at: 0.8, cls: 'gold' }),
    ] },
    { id: 'serumen', dur: 1.4, bg: 'clip', clip: clip(8, 11.45, { dur: 1.9 }), shade: 'top', layers: [term('Serumen tıkacı', 'dış kulak yolu', { tcls: 'crg', size: 112, y: 330 })] },
    { id: 'perforasyon', dur: 1.4, bg: 'clip', clip: clip(12, 0.0, { dur: 1.9 }), shade: 'top', layers: [term('Perforasyon', 'timpanik membranda delik', { tcls: 'crg', size: 116, y: 330 })] },
    { id: 'otoskleroz', dur: 1.4, bg: 'clip', clip: clip(16, 19.0, { dur: 1.9 }), shade: 'top', layers: [term('Otoskleroz', 'üzengi tabanı oval pencerede takılır', { tcls: 'crg', y: 330 })] },
    { id: 'ome', dur: 1.4, bg: 'clip', clip: clip(14, 15.45, { dur: 1.9 }), shade: 'top', layers: [term('Seröz otitis media', 'orta kulakta sıvı', { tcls: 'crg', size: 96, y: 330 })] },
    { id: 'meniere', dur: 1.4, bg: 'clip', clip: clip(30, 57.3, { dur: 1.9 }), shade: 'top', layers: [term('Meniere', 'endolenfatik hidrops', { tcls: 'crg', y: 330 })] },
    { id: 'tinnitus', dur: 1.4, bg: 'clip', clip: clip(37, 17.75, { dur: 1.9 }), shade: 'top', layers: [term('Tinnitus', 'kulak çınlaması', { tcls: 'crg', y: 330 })] },
    { id: 'tedavi', dur: 2.6, bg: 'night', flash: true, layers: [
      chip('Kamp · <span class="tl">Tedavi Odası</span>', { y: 250, cls: 'gold' }),
      still(T('kamp/60-tedavi-paneli.jpg'), [20, 1080, 740, 560], { y: 370, w: 860 }),
      { kind: 'html', cls: 'pills', html: '<span>Ventilasyon tüpü</span><span class="g">Stapes protezi</span><span>Kemikçik protezi</span><span class="c">Koklear implant</span><span>Uzaktan mikrofon</span>', y: 1110, at: 0.35, anim: 'rise' },
    ] },
    { id: 'sozluk', dur: 2.0, bg: 'night', layers: [
      chip('Kulak Sözlüğü · “Daha fazla”', { y: 250 }),
      still(T('ogrenme/02-kulak-sozlugu-daha-fazla.jpg'), [20, 520, 740, 760], { y: 370, w: 860, kb: [1.0, 1.05] }),
    ] },
    { id: 'soru', dur: 2.0, bg: 'night', layers: [
      chip('Günün Sorusu · her gün takımına', { y: 250, cls: 'gold' }),
      still(T('sosyal/01-gunun-sorusu.jpg'), [30, 596, 720, 740], { y: 370, w: 860, cls: 'teal' }),
    ] },
    { id: 'cevap', dur: 4.2, bg: 'night', ringY: 640, flash: true, layers: [
      chip('Cevap', { y: 250, cls: 'gold' }),
      { kind: 'html', cls: 'hook teal', html: 'Tip B = <em>düz</em> timpanogram', y: 360, at: 0.05, anim: 'pop' },
      { kind: 'html', cls: '', html: TYMP, y: 560, at: 0.35, anim: 'rise' },
      fact('Orta kulakta <b>sıvı</b> ya da <b>zar delinmesi</b> düşündürür; <i>kanal hacmi</i> ikisini ayırt ettirir.<span class="src">Jerger sınıflaması · Katz, Handbook of Clinical Audiology</span>', { y: 1000, at: 0.8 }),
    ] },
    endCard({ note: 'Eğitsel içerik; tanı ve tedavi için hekim ve odyolog.' }),
  ],
  voice: [{ id: 'kamp-sv-kule-2', scene: 'cevap', at: 0.3, from: 0, to: 3.95, subs: [[0, 3.95, 'Düz bir timpanogram çoğu zaman orta kulakta sıvıyı düşündürür.']] }],
  cover: { clip: clip(10, 23.9), t: 1.0, layers: [
    { kind: 'html', cls: 'chip coral', html: 'Odyoloji öğrencileri', y: 500 },
    { kind: 'html', cls: 'hook', html: 'Timpanogram <em>Tip B</em> ne anlatır? 🤔', y: 620 },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1120 },
    { kind: 'html', cls: 'soon', html: 'Yakında yayında', y: 1420 },
  ] },
  post: {
    caption: 'Timpanogram Tip B ne anlatır? Cevabı videoda; sen önce yorumlara yaz 👇 Serumenden tinnitusa 18 patoloji, Tedavi Odası ve Kulak Sözlüğü: ODİ: Sesin Yolu yakında yayında.\nSınıf arkadaşını etiketle!',
    tags: ['#odyoloji', '#odyolog', '#odyolojiöğrencisi', '#timpanometri', '#işitme', '#işitmekaybı', '#otoskleroz', '#tinnitus', '#koklearimplant', '#oyun', '#yakında', '#odisesinyolu'],
  },
};

/* ------------------------------------------------------------------ 3 */
const takiminiKur = {
  slug: 'takimini-kur', title: 'Takımını kur, kulağı fethet', bpm: 124, style: 'takim',
  scenes: [
    { id: 'kanca', dur: 2.5, bg: 'clip', clip: clip(37, 4.3), shade: 'top', layers: [
      hook('Sınıfınla <em>takım</em> kurup yarışsanız? 🏁', { y: 300 }),
    ] },
    { id: 'yaris', dur: 2.4, bg: 'night', flash: true, layers: [
      chip('Canlı Takım Yarışı', { y: 250, cls: 'gold' }),
      still(T('takim/01-takim-yarisi.jpg'), [20, 560, 740, 500], { y: 380, w: 860 }),
      fact('<b>3’e 3</b> ya da <b>5’e 5</b> · aynı bölüm, aynı anda', { y: 1000, at: 0.35 }),
    ] },
    { id: 'yarisici', dur: 2.0, bg: 'night', layers: [
      chip('Takımın turkuaz, rakip pembe', { y: 250 }),
      still(T('takim/10-yaris-ici.jpg'), [0, 150, 780, 1000], { y: 370, w: 820, kb: [1.0, 1.06] }),
    ] },
    { id: 'sonuc', dur: 2.0, bg: 'night', layers: [
      chip('Bitiş sırası + yıldız = takım puanı', { y: 250, cls: 'gold' }),
      still(T('takim/20-sonuc.jpg'), [0, 20, 780, 1120], { y: 370, w: 760 }),
    ] },
    { id: 'lig', dur: 2.0, bg: 'night', flash: true, layers: [
      chip('Takım Ligi · 2 haftalık sezon', { y: 250 }),
      still(T('takim/40-takim-ligi.jpg'), [20, 560, 740, 560], { y: 370, w: 860 }),
      fact('Bronz → Gümüş → Altın → Platin → <b>Koklea</b>', { y: 1080, at: 0.3 }),
    ] },
    { id: 'soru', dur: 2.0, bg: 'night', layers: [
      chip('Günün Sorusu · Çalışma Grubu', { y: 250, cls: 'gold' }),
      still(T('sosyal/01-gunun-sorusu.jpg'), [30, 596, 720, 740], { y: 370, w: 860, cls: 'teal' }),
      fact('Çalışma Grubu açıksa sorular <b>odyoloji öğrencisi</b> düzeyinde', { y: 1190, at: 0.3 }),
    ] },
    { id: 'usta', dur: 2.0, bg: 'night', layers: [
      chip('Usta–Çırak', { y: 250, cls: 'coral' }),
      still(T('sosyal/32-usta-donum-noktasi.jpg'), [20, 990, 740, 690], { y: 370, w: 860, cls: 'coral' }),
    ] },
    { id: 'savas', dur: 2.0, bg: 'night', flash: true, layers: [
      chip('Bölge Savaşı', { y: 250, cls: 'gold' }),
      still(T('etkinlik/80-bolge-savasi.jpg'), [20, 520, 740, 960], { y: 370, w: 760 }),
    ] },
    { id: 'canavar', dur: 2.6, bg: 'clip', clip: clip(40, 26.8, { dur: 2.9 }), shade: 'top', layers: [
      hook('Gürültü Canavarı’na <em>hep beraber!</em> 👹', { y: 300, cls: 'coral small' }),
    ] },
    endCard({ a: 'Takımını şimdiden topla 🤝', b: 'Sınıf arkadaşını etiketle 👇' }),
  ],
  voice: [
    { id: 'tyaris-01', scene: 'yaris', at: 0.1, subs: [[0, 2.04, 'Yeni: Canlı Takım Yarışı!'], [2.04, 4.15, 'İki takım aynı bölümü aynı anda koşar;'], [4.15, 6.9, 'bitiş sıran ve yıldızların takımına puan olur.']] },
    { id: 'takim-02', scene: 'savas', at: 0.1, subs: [[0, 2.98, 'Birlikte Bölge Savaşı’nda yer kaparsınız'], [2.98, 5.5, 've Gürültü Canavarı’na hep beraber vurursunuz.']] },
  ],
  cover: { clip: clip(40, 26.8, { dur: 2.9 }), t: 1.0, layers: [
    { kind: 'html', cls: 'chip gold', html: 'Canlı Takım Yarışı · Takım Ligi', y: 500 },
    { kind: 'html', cls: 'hook', html: 'Takımını kur, <em>kulağı fethet</em> 🤝', y: 620 },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1120 },
    { kind: 'html', cls: 'soon', html: 'Yakında yayında', y: 1420 },
  ] },
  post: {
    caption: 'Sınıfınla takım kurup yarışsanız? 🏁 Canlı Takım Yarışı, Takım Ligi, Günün Sorusu ile çalışma grubu ve usta–çırak: ODİ: Sesin Yolu yakında yayında.\nTakımını şimdiden topla, sınıf arkadaşını etiketle 👇',
    tags: ['#odyoloji', '#odyolojiöğrencisi', '#odyolog', '#işitme', '#kulak', '#takım', '#sınıf', '#mobiloyun', '#oyun', '#yakında', '#odisesinyolu'],
  },
};

/* ------------------------------------------------------------------ 4 */
const tuyDede = {
  slug: 'tuy-dede', title: 'Tüy Dede’yle tanışın', bpm: 96, style: 'masal',
  scenes: [
    { id: 'merhaba', dur: 5.8, bg: 'night', ringY: 780, layers: [
      hook('Bu dede bir <em>tüy hücresi!</em> 👀', { y: 250, cls: 'small' }),
      { kind: 'dede', size: 600, y: 440, at: 0.1, anim: 'zoom', bob: 2.2, bobAmp: 12 },
      fact('Başındaki altın tüyler: basamak basamak dizilmiş <b>stereosilya</b>', { y: 1080, at: 2.6 }),
    ] },
    { id: 'odi', dur: 1.9, bg: 'night', ringY: 700, flash: true, layers: [
      chip('Bu <span style="color:var(--gold)">Odi</span>: minik bir ses', { y: 250 }),
      { kind: 'odi', size: 600, y: 420, at: 0, anim: 'zoom', bob: 1.4, bobAmp: 14 },
    ] },
    { id: 'kosu', dur: 2.2, bg: 'clip', clip: clip(4, 16.0), shade: 'top', layers: [
      chip('Görevi: ninniyi beyne taşımak 🎵', { y: 300, cls: 'gold' }),
    ] },
    { id: 'golem', dur: 2.5, bg: 'clip', clip: clip(20, 10.7, { dur: 2.8 }), shade: 'top', flash: true, layers: [
      term('Serumen Golemi', 'kanalın sonunda', { tcls: 'crg', size: 112, y: 300 }),
    ] },
    { id: 'canavar', dur: 2.6, bg: 'clip', clip: clip(40, 10.4, { dur: 2.9 }), shade: 'top', layers: [
      term('Gürültü Canavarı', 'son kapı', { tcls: 'crg', size: 104, y: 300 }),
    ] },
    { id: 'anit', dur: 3.0, bg: 'night', flash: true, layers: [
      chip('Kampında bölge anıtları', { y: 250, cls: 'gold' }),
      still(T('kamp/80-anit-yukseliyor.jpg'), [0, 150, 780, 1150], { y: 370, w: 780, kb: [1.0, 1.07] }),
    ] },
    { id: 'kamp', dur: 3.0, bg: 'night', layers: [
      chip('Kulak kepçesinden Heschl’e 10 anıt', { y: 250 }),
      still(T('kamp/41-kamp-sv15.jpg'), [0, 150, 780, 1050], { y: 370, w: 820, kb: [1.0, 1.08] }),
    ] },
    { id: 'birlikte', dur: 3.7, bg: 'night', ringY: 760, layers: [
      { kind: 'dede', size: 470, y: 470, at: 0, anim: 'pop', bob: 2.2, bobAmp: 10, dx: -200 },
      { kind: 'odi', size: 420, y: 560, at: 0.15, anim: 'pop', bob: 1.5, bobAmp: 14, dx: 220 },
      chip('Yalnız değilsin 🤝', { y: 260, cls: 'gold' }),
    ] },
    endCard({ dede: true, a: 'Takip et, ilk duyan sen ol 🔔', b: 'Tüy Dede’ye selam yaz 👇' }),
  ],
  voice: [
    { id: 'hikaye-01', scene: 'merhaba', at: 0.35, subs: [[0, 1.83, 'Merhaba! Ben Tüy Dede,'], [1.83, 3.86, 'iç kulağın en yaşlı tüy hücresiyim.'], [3.86, 5.4, 'Seni bekliyordum.']] },
    { id: 'hikaye-02', scene: 'odi', at: 0.05, subs: [[0, 1.6, 'Bu Odi: minik bir ses.'], [1.6, 3.6, 'Annesinin ninnisini taşıyor.']] },
    { id: 'hikaye-04', scene: 'golem', at: 0.1, subs: [[0, 1.84, 'Ama Büyük Sessizlik geliyor!'], [1.84, 5.0, 'Gürültü canavarları kulağın ışıklarını söndürüyor.']] },
    { id: 'anit-koklea-2', scene: 'anit', at: 0.1, to: 5.75, subs: [[0, 1.61, 'Tüy hücresi anıtı geldi!'], [1.61, 5.75, 'Benim akrabalarım: sesle eğilir ve elektrik sinyalini başlatırlar.']] },
    { id: 'hikaye-06', scene: 'birlikte', at: 0.1, to: 3.42, subs: [[0, 3.42, 'Yalnız değilsin: arkadaşların ve takımın yardım eder.']] },
  ],
  cover: { bg: 'night', layers: [
    { kind: 'html', cls: 'chip gold', html: 'Tanışın 👋', y: 420 },
    { kind: 'dede', size: 520, y: 500 },
    { kind: 'html', cls: 'hook', html: '<em>Tüy Dede</em>’yle tanışın', y: 1000 },
    { kind: 'html', cls: 'logo sm', html: LOGO, y: 1190 },
    { kind: 'html', cls: 'soon', html: 'Yakında yayında', y: 1470 },
  ] },
  post: {
    caption: 'İç kulağın en yaşlı tüy hücresi Tüy Dede ve minik ses Odi’yle tanışın. 👴🎵 Başındaki altın tüyler stereosilya! ODİ: Sesin Yolu yakında yayında.\nTüy Dede’ye yorumlardan selam yaz 👇',
    tags: ['#odyoloji', '#odyolog', '#odyolojiöğrencisi', '#işitme', '#tüyhücresi', '#stereosilya', '#koklea', '#kulak', '#oyun', '#mobiloyun', '#yakında', '#odisesinyolu'],
  },
};

export const REELS = Object.fromEntries([kulakYolculugu, odyolojiOgrencileri, takiminiKur, tuyDede].map((r) => [r.slug, r]));
