/**
 * ODİ Reels, 6. dalga (B): odyoloji öğrencileri için paylaşılabilir İÇERİK (içerik önce, reklam sonra). İzleyici sayfayı tanımıyor:
 * her video kendi başına değer verir (sınav kartı, meydan okuma, mizah, quiz) ve paylaşma tetikleyicisini açıkça söyler.
 * ODİ markası hafif: köşede küçük imza + son 1,8 sn'lik kapanış ("Odyoloji camiası için yapıldı · Çok yakında").
 * record.mjs tanır: node tools/reels/record.mjs --reel rinne-weber-30sn
 *
 * Ek çizimler tools/reels/ozel/6b.js'te (katman kind 'ozel'; reel.scripts): diyapazon, önden/yandan baş (Weber/Rinne), süre çubukları,
 * sıralama kartları, dB cetveli, gündelik ses simgeleri, frekans merdiveni, kulaklık, odyometre paneli, yanıt düğmesi, kabin.
 * Bilgiler docs/odyoloji-icerik.md'den (kaynakları her videonun .md dosyasında); sahte kullanıcı/yorum/istatistik yok, emoji yok.
 */
import { YARDIMCI } from './reklamlar.mjs';

const { grid, LOGO, kt, tsub, lbl, phone } = YARDIMCI;
const SCR = ['ozel/6b.js'];
const H = (cls, html, o = {}) => ({ kind: 'html', cls, html, y: 300, at: 0, anim: 'pop', ...o });
const Z = (fn, o = {}) => ({ kind: 'ozel', fn, y: 300, at: 0, anim: 'none', ...o });
/** köşe imzası (üst güvenli çizginin hemen altı, solda): küçük, sessiz */
const KOSE = { kind: 'html', cls: 'kose6', html: '<b>OD<span>İ</span></b>Sesin Yolu', y: 262, dx: -330, at: 0, anim: 'none' };
/** kayıt simgesi (yer imi) */
const KAYDET = '<svg width="54" height="66" viewBox="0 0 54 66"><path d="M6 6h42v54L27 46 6 60z" fill="#062a28" stroke="#062a28" stroke-width="6" stroke-linejoin="round"/></svg>';
const GONDER = '<svg width="62" height="56" viewBox="0 0 62 56"><path d="M4 26 L58 4 L40 52 L30 32 Z" fill="#062a28" stroke="#062a28" stroke-width="5" stroke-linejoin="round"/><path d="M30 32 L58 4" stroke="#7ff3e8" stroke-width="4"/></svg>';
const YORUM = '<svg width="60" height="58" viewBox="0 0 60 58"><path d="M30 4C14 4 4 14 4 26c0 7 3 12 8 16l-3 12 13-7c3 1 5 1 8 1 16 0 26-10 26-22S46 4 30 4z" fill="#062a28"/></svg>';
/** kapanış (≈1,8 sn): Odi + logo + "Odyoloji camiası için yapıldı · Çok yakında App Store ve Google Play'de · Takip et" */
const kapanis = () => [
  { kind: 'odi', size: 250, y: 330, at: 0, anim: 'drop', bob: 1.4, bobAmp: 10 },
  { kind: 'html', cls: 'logo sm', html: LOGO, y: 590, at: 0.05, anim: 'zoom' },
  H('son6', '<div class="a">Odyoloji camiası için yapıldı</div><div class="b">Çok yakında App Store ve Google Play\'de</div><div class="c">Takip et</div>', { y: 900, at: 0.15, anim: 'rise' }),
];
const son = (b, o = {}) => ({ id: 'son', dur: b, bg: 'launch', mus: 'end', fx: { flash: [[0, 0.1]] }, sfx: [[0, 'sparkle', 0.5], [0.05, 'boom', 0.3]], layers: kapanis(), ...o });

/* =================================================================== 6. RINNE VE WEBER, 30 SANİYEDE (sınav için kaydet) */
const rb = grid(100); // 0,6 sn
const FORK = (o = {}) => Z('diyapazon', { size: 0.9, strikes: [0.12], ...o });
const weberBas = (o) => Z('basOn', { size: 0.92, y: 505, strikes: [0.1], heardAt: 0.55, ...o });
const kulakEt = (sol, sag) => [
  H(`tag6 ${sol[1]}`, sol[0], { y: 1150, dx: -270, at: 0.15, anim: 'pop' }),
  H(`tag6 ${sag[1]}`, sag[0], { y: 1150, dx: 270, at: 0.25, anim: 'pop' }),
];
const OZET = `<h3>Weber <small>diyapazon başın ortasında</small></h3>
  <div class="r"><b class="c">İletim tipi kayıp</b><span class="ar">→</span><span>ses <b>kötü</b> kulakta</span></div>
  <div class="r"><b class="c">Sensörinöral kayıp</b><span class="ar">→</span><span>ses <b>iyi</b> kulakta</span></div>
  <h3 style="margin-top:22px">Rinne <small>kemik yolu ↔ hava yolu</small></h3>
  <div class="r"><b class="t">Hava &gt; Kemik</b><span class="ar">→</span><span><b>Pozitif:</b> normal ya da sensörinöral</span></div>
  <div class="r"><b class="c">Kemik &gt; Hava</b><span class="ar">→</span><span><b>Negatif:</b> iletim bileşeni</span></div>
  <div class="ft">Tarama testidir; tanı için odyogram gerekir.</div>
  <div class="src">Kaynak: Katz, Handbook of Clinical Audiology (diyapazon testleri)</div>`;
const rinneWeber = {
  slug: 'rinne-weber-30sn', title: 'Rinne ve Weber, 30 saniyede', ad: true, bpm: 100, snap: rb(1), style: 'detay', scripts: SCR,
  subY: 1440, subCls: 'big', voGap: 0.12, tail: 0.5, limit: 0.6, jpegOpaque: true, duck: { music: -9, sfx: -4 },
  scenes: [
    { id: 'kanca', dur: rb(4), bg: 'board', mus: 'soft', fx: { flash: [[0, 0.12]] }, sfx: [[0, 'hit', 0.5], [0.12, 'fork', 0.8]], layers: [
      kt('Rinne<br>ve Weber', { c: 'lg gold', y: 300, at: 0, slamFrom: 2.2 }),
      lbl('30 saniyede', { c: 'coral', y: 700, at: 0.25, rot: -3 }),
      FORK({ y: 850, at: 0.05, size: 0.95 }),
      H('lead6', '2 test · 4 kural', { y: 1330, at: 0.7, anim: 'rise' }),
    ] },
    { id: 'weber1', dur: rb(5), bg: 'board', mus: 'full', sfx: [[0, 'swish', 0.4], [0.1, 'fork', 0.6]], layers: [
      lbl('Weber', { c: 'teal', y: 275, at: 0, rot: -2 }),
      H('lead6', 'Diyapazon başın ortasında:<br><b>ses hangi kulakta?</b>', { y: 372, at: 0.1, anim: 'rise' }),
      weberBas({ heard: 'both', heardAt: 1.3 }),
      H('big6 sm', 'Normal: <i>ortada</i>', { y: 1330, at: 1.4, anim: 'pop' }),
    ] },
    { id: 'weber2', dur: rb(5), bg: 'board', sfx: [[0, 'swish', 0.4], [0.1, 'fork', 0.6], [0.6, 'pop', 0.4]], layers: [
      lbl('Weber', { c: 'teal', y: 275, at: 0, anim: 'none', rot: -2 }),
      weberBas({ kotu: 'L', tip: 'iletim', heard: 'L' }),
      H('lead6', 'Tek taraflı <b>iletim tipi</b> kayıp:', { y: 380, at: 0.05, anim: 'rise' }),
      ...kulakEt(['İletim tipi<br>kayıp', ''], ['Sağlam', 'ok']),
      H('big6 sm lo', 'Ses <u>KÖTÜ</u> kulakta', { y: 1330, at: 0.7, anim: 'slam', slamFrom: 1.8 }),
    ] },
    { id: 'weber3', dur: rb(5), bg: 'board', sfx: [[0, 'swish', 0.4], [0.1, 'fork', 0.6], [0.6, 'pop', 0.4]], layers: [
      lbl('Weber', { c: 'teal', y: 275, at: 0, anim: 'none', rot: -2 }),
      weberBas({ kotu: 'L', tip: 'sn', heard: 'R' }),
      H('lead6', 'Tek taraflı <b>sensörinöral</b> kayıp:', { y: 380, at: 0.05, anim: 'rise' }),
      ...kulakEt(['Sensörinöral<br>kayıp', ''], ['Sağlam', 'ok']),
      H('big6 sm lo', 'Ses <i>İYİ</i> kulakta', { y: 1330, at: 0.7, anim: 'slam', slamFrom: 1.8 }),
    ] },
    { id: 'rinne1', dur: rb(6), bg: 'board', sfx: [[0, 'swish', 0.4], [0.1, 'fork', 0.6], [rb(3), 'whoosh', 0.3]], layers: [
      lbl('Rinne', { c: 'gold', y: 275, at: 0, rot: 2 }),
      Z('basYan', { size: 1.08, y: 470, strikes: [0.1], moveAt: rb(3) - 0.2 }),
      H('tag6 gold', '1 · Kemik yolu: mastoid', { y: 1330, at: 0.3, until: rb(3) - 0.1 }),
      H('tag6 ok', '2 · Hava yolu: kulağın önü', { y: 1330, at: rb(3) }),
    ] },
    { id: 'rinne2', dur: rb(5), bg: 'board', sfx: [[0, 'swish', 0.4], [1.9, 'ding', 0.35]], layers: [
      lbl('Rinne', { c: 'gold', y: 275, at: 0, anim: 'none', rot: 2 }),
      Z('sureler', { y: 470, bars: [{ label: 'Kemik yolu', color: '#ffc93c', from: 0.15, to: 0.95, len: 0.5, show: 0 }, { label: 'Hava yolu', sub: 'daha uzun', color: '#2ee6d6', from: 0.15, to: 1.8, len: 1, show: 0 }] }),
      H('big6', 'Hava &gt; Kemik', { y: 860, at: 1.9, anim: 'slam', slamFrom: 1.8 }),
      H('tag6 ok', 'POZİTİF', { y: 1000, at: 2.05, anim: 'stamp', rot: -3 }),
      H('lead6', 'normal ya da <i>sensörinöral</i>', { y: 1150, at: 2.2, anim: 'rise' }),
    ] },
    { id: 'rinne3', dur: rb(5), bg: 'board', sfx: [[0, 'swish', 0.4], [1.9, 'buzzer', 0.25]], layers: [
      lbl('Rinne', { c: 'gold', y: 275, at: 0, anim: 'none', rot: 2 }),
      Z('sureler', { y: 470, bars: [{ label: 'Kemik yolu', sub: 'daha uzun', color: '#ffc93c', from: 0.15, to: 1.8, len: 1, show: 0 }, { label: 'Hava yolu', color: '#2ee6d6', from: 0.15, to: 0.95, len: 0.5, show: 0 }] }),
      H('big6', 'Kemik &gt; Hava', { y: 860, at: 1.9, anim: 'slam', slamFrom: 1.8 }),
      H('tag6', 'NEGATİF', { y: 1000, at: 2.05, anim: 'stamp', rot: 3 }),
      H('lead6', 'iletim bileşeni var', { y: 1150, at: 2.2, anim: 'rise' }),
    ] },
    { id: 'ozet', dur: rb(5), bg: 'board', mus: 'soft', fx: { flash: [[0, 0.1]] }, sfx: [[0, 'whoosh', 0.4], [0.1, 'paper', 0.5]], layers: [
      H('kart6', OZET, { y: 330, at: 0, anim: 'grow', growFrom: 0.85, growT: 0.3 }),
    ] },
    { id: 'cta', dur: rb(5), bg: 'board', sfx: [[0, 'pop', 0.5]], layers: [
      H('kart6', OZET, { y: 330, at: 0, anim: 'none' }),
      H('cta6', `${KAYDET}<span>Sınavdan önce kaydet.<br>Arkadaşına gönder.</span>`, { y: 1240, at: 0.05, anim: 'pop', pulse: 100, pulseAt: 0.3, pulseAmt: 0.03 }),
    ] },
    son(rb(3)),
  ],
  vo: [
    { id: 'rw1', scene: 'kanca', at: 0.3, nosub: true }, { id: 'rw2', scene: 'weber1', at: 0.15, nosub: true }, { id: 'rw3', scene: 'weber2', at: 0.2, nosub: true },
    { id: 'rw4', scene: 'weber3', at: 0.2, nosub: true }, { id: 'rw5', scene: 'rinne1', at: 0.15 }, { id: 'rw6', scene: 'rinne2', at: 0.15 },
    { id: 'rw7', scene: 'rinne3', at: 0.15 }, { id: 'rw8', scene: 'ozet', at: 0.3, nosub: true }, { id: 'rw9', scene: 'cta', at: 0.1, nosub: true },
  ],
  cover: { bg: 'board', seek: 2, layers: [
    kt('Rinne<br>ve Weber', { c: 'lg gold', y: 290 }),
    lbl('30 saniyede', { c: 'coral', y: 690, rot: -3 }),
    FORK({ y: 820, size: 0.95, strikes: [1.9] }),
    H('cta6', `${KAYDET}<span>Sınavdan önce kaydet</span>`, { y: 1330 }),
  ] },
  post: {
    caption: 'Rinne ve Weber, 30 saniyede.\nWeber (diyapazon başın ortasında): iletim tipi kayıpta ses kötü kulakta, sensörinöral kayıpta iyi kulakta duyulur.\nRinne: hava yolu kemik yolundan uzunsa pozitif (normal ya da sensörinöral); kemik yolu daha uzunsa negatif (iletim bileşeni).\nBunlar tarama testidir; tanı için odyogram gerekir. (Kaynak: Katz, Handbook of Clinical Audiology)\nSınavdan önce kaydet, sınav arkadaşına gönder.',
    tags: ['#odyoloji', '#odyolojiöğrencisi', '#odyolog', '#rinne', '#weber', '#diyapazon', '#sınav', '#odisesinyolu'],
  },
};

/* =================================================================== 7. KULAKTAN BEYNE: 15 SANİYEDE SIRALA (meydan okuma) */
const kb = grid(140); // ≈0,4286 sn; 15 sn = 35 vuruş
const BOLGE = { dis: ['#ffd1e0', 'Dış kulak'], orta: ['#fff3b0', 'Orta kulak'], ic: ['#c9f3ff', 'İç kulak'], sinir: ['#e3dcff', 'Sinir'], sap: ['#d6ffc9', 'Beyin sapı'], tal: ['#ffe2b8', 'Talamus'], kor: ['#ffc9a8', 'Korteks'] };
const YOL = [['Kulak kepçesi', 'dis'], ['Dış kulak yolu', 'dis'], ['Kulak zarı', 'orta'], ['Çekiç · örs · üzengi', 'orta'], ['Oval pencere', 'orta'], ['Koklea', 'ic'], ['İşitme siniri', 'sinir'],
  ['Koklear çekirdek', 'sap'], ['Superior oliver kompleks', 'sap'], ['Lateral lemniskus', 'sap'], ['İnferior kollikulus', 'sap'], ['Medial genikulat cisim', 'tal'], ['İşitme korteksi', 'kor']]
  .map(([t, b]) => ({ t, c: BOLGE[b][0], g: BOLGE[b][1] }));
const KARISIK = [8, 3, 11, 0, 6, 12, 2, 9, 5, 1, 10, 4, 7];
const K_KANCA = kb(7), K_S1 = kb(23), K_S2 = kb(12), K_SURE = kb(2), K_CEVAP = kb(13);
const tiles = (t0, o = {}) => Z('sirala', { y: 0, items: YOL, shuffle: KARISIK, gridY: 520, listY: 330, listH: 78, step: 0.3, t0, ...o });
const REVEAL = K_KANCA + K_S1 + K_S2 + K_SURE + 0.15;  // sıralama başlangıcı (sirala zamanında)
const sirala = {
  slug: 'kulaktan-beyne-sirala', title: 'Kulaktan beyne: 15 saniyede sırala!', ad: true, bpm: 140, snap: kb(1), style: 'hizli', scripts: SCR,
  subY: 1440, subCls: 'big', voGap: 0.1, tail: 0.5, limit: 0.6, jpegOpaque: true, duck: { music: -9, sfx: -4 },
  scenes: [
    { id: 'kanca', dur: K_KANCA, bg: 'quiz', mus: 'count', fx: { flash: [[0, 0.12]], zoom: [[0, 0.3, 0.06]] }, sfx: [[0, 'hit', 0.6], [0.05, 'whoosh', 0.4], ...Array.from({ length: 13 }, (_, i) => [0.3 + i * 0.05, 'pop', 0.12])], layers: [
      kt('Kulaktan beyne', { c: 'md gold', y: 300, at: 0, slamFrom: 2.2 }),
      H('lead6', '<b>15 saniyede</b> sırala!', { y: 430, at: 0.2, anim: 'pop' }),
      tiles(0, { revealAt: REVEAL }),
    ] },
    { id: 'sayac1', dur: K_S1, bg: 'quiz', sfx: [[0, 'beep', 0.5]], layers: [
      { kind: 'timer', cls: 'sm', y: 300, at: 0, anim: 'none', from: 15, redAt: 3 },
      H('lead6', 'Kulaktan beyne: <b>doğru sıra?</b>', { y: 440, at: 0, anim: 'none' }),
      tiles(K_KANCA, { revealAt: REVEAL }),
    ] },
    { id: 'sayac2', dur: K_S2, bg: 'quiz', mus: 'go', sfx: [0, 1, 2, 3, 4].map((k) => [K_S2 - 5 + k, 'tick2', 0.6]), layers: [
      { kind: 'timer', cls: 'sm', y: 300, at: 0, anim: 'none', from: 15 - K_S1, redAt: 3 },
      H('lead6', 'Kulaktan beyne: <b>doğru sıra?</b>', { y: 440, at: 0, anim: 'none' }),
      tiles(K_KANCA + K_S1, { revealAt: REVEAL }),
    ] },
    { id: 'sure', dur: K_SURE, bg: 'quiz', mus: 'off', fx: { flash: [[0, 0.12, [255, 71, 102], 0.5]], shake: [[0, 0.3, 14]] }, sfx: [[0, 'buzzer', 0.6]], layers: [
      { kind: 'timer', cls: 'sm', y: 300, at: 0, anim: 'none', from: 0, redZero: true },
      tiles(K_KANCA + K_S1 + K_S2, { revealAt: REVEAL }),
      H('stamp2 big', 'Süre!', { y: 760, at: 0, anim: 'stamp', rot: -6, z: 9 }),
    ] },
    { id: 'cevap', dur: K_CEVAP, bg: 'quiz', mus: 'go', sfx: YOL.map((_, i) => [0.15 + i * 0.3 + 0.36, 'chime', 0.32, { n: 72 + [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21][i] }]), layers: [
      tiles(K_KANCA + K_S1 + K_S2 + K_SURE, { revealAt: REVEAL }),
    ] },
    { id: 'cta', dur: kb(9), bg: 'quiz', sfx: [[0, 'pop', 0.5], [0.05, 'sparkle', 0.4]], layers: [
      tiles(K_KANCA + K_S1 + K_S2 + K_SURE + K_CEVAP, { revealAt: REVEAL }),
      H('src6', 'Basitleştirilmiş yükselen yol; lifler beyin sapında iki tarafa da geçer.', { y: 1352, at: 0, anim: 'fade' }),
      H('cta6', `${YORUM}<span>Kaçıncı saniyede bildin?<br>Yorumlara yaz.</span>`, { y: 1410, at: 0.1, anim: 'pop', pulse: 140, pulseAt: 0.3, pulseAmt: 0.03 }),
    ] },
    son(kb(4)),
  ],
  vo: [{ id: 'ks1', scene: 'kanca', at: 0.15, nosub: true }, { id: 'ks2', scene: 'sure', at: 0.15, nosub: true }, { id: 'ks3', scene: 'cta', at: 0.15, nosub: true }],
  cover: { bg: 'quiz', seek: 3.2, layers: [
    kt('Kulaktan beyne', { c: 'md gold', y: 290 }),
    H('lead6', '<b>15 saniyede</b> sırala!', { y: 420 }),
    tiles(0, { revealAt: 99 }),
  ] },
  post: {
    caption: 'Kulaktan beyne: 15 saniyede sırala! ⏱\nDoğru sıra: kulak kepçesi → dış kulak yolu → kulak zarı → çekiç, örs, üzengi → oval pencere → koklea → işitme siniri → koklear çekirdek → superior oliver kompleks → lateral lemniskus → inferior kollikulus → medial genikulat cisim → işitme korteksi.\n(Basitleştirilmiş yükselen yol; lifler beyin sapında iki tarafa da geçer.)\nKaçıncı saniyede bildin? Yorumlara yaz, sınıf arkadaşını etiketle.',
    tags: ['#odyoloji', '#odyolojiöğrencisi', '#anatomi', '#işitmeyolu', '#nöroanatomi', '#challenge', '#odisesinyolu'],
  },
};

/* =================================================================== 8. POV: İLK HASTAN, İLK ODYOMETRİ (mizah → sıcak son) */
const pb = grid(112); // ≈0,536 sn
const V3 = (f) => `reels3/cekim/vaka/${f}`;
const meme6 = (html, o = {}) => H(`meme ${o.c ?? ''}`, html, { y: 330, at: 0.02, anim: 'slam', slamFrom: 1.5, ...o });
const BAS = [0.35, 0.75, 1.05, 1.45, 1.8, 2.4, 2.7, 3.05];
const KAFA = [['Çapraz işitme?', -230, 720, -6], ['Hangi kulağa?', 250, 820, 5], ['Kaç dB gürültü?', -240, 1150, 4], ['Hava yolu: IA ≈ 40 dB', 170, 1280, -4], ['Kemik yolu: IA ≈ 0 dB', -110, 1410, 3]];
const ilkHastan = {
  slug: 'ilk-hastan', title: 'POV: İlk hastan, ilk odyometri', ad: true, bpm: 112, snap: pb(1), style: 'komedi', scripts: SCR,
  subY: 1440, subCls: 'big', voGap: 0.12, tail: 0.5, limit: 0.6, jpegOpaque: true, duck: { music: -9, sfx: -3 },
  scenes: [
    { id: 'kanca', dur: pb(5), bg: 'desk', mus: 'off', fx: { flash: [[0, 0.1]] }, sfx: [[0, 'hit', 0.4], [0.15, 'heartbeat', 0.9], [1.05, 'heartbeat', 0.9], [1.95, 'heartbeat', 1.0]], layers: [
      meme6('POV:<br>İlk hastan.<br>İlk odyometri.', { c: 'lg', y: 330 }),
      Z('kabin', { y: 900, at: 0.1, anim: 'pop', w: 820 }),
    ] },
    { id: 'kulaklik', dur: pb(6), bg: 'desk', mus: 'bouncy', sfx: [[0, 'swish', 0.4], [0.3, 'swish', 0.3], [0.65, 'swish', 0.3], [1.0, 'swish', 0.3], [1.35, 'swish', 0.3], [1.85, 'ding', 0.45]], layers: [
      meme6('Kırmızı sağ mıydı,<br>mavi sol mu?', { c: 'sm' }),
      Z('kulaklik', { y: 600, flipUntil: 1.75 }),
      H('tag6 gold', 'Kırmızı = SAĞ · Mavi = SOL', { y: 1220, at: 1.85, anim: 'stamp', rot: -3 }),
      H('src6', 'Odyogram ve kulaklık renkleri: sağ kırmızı, sol mavi (ASHA)', { y: 1340, at: 2.0, anim: 'fade' }),
    ] },
    { id: 'talimat', dur: pb(7), bg: 'desk', sfx: [[0, 'scratch', 0.7], [0.3, 'boing', 0.3], [1.6, 'pop', 0.4]], layers: [
      meme6('Talimat vermeyi<br>unuttun.', { c: 'sm' }),
      Z('kabin', { y: 590, w: 700, qAt: 0.3 }),
      H('bubble', '<small>sen, mikrofondan</small>Sesi duyar duymaz düğmeye basın. Ne kadar hafif olursa olsun!', { y: 1190, at: 1.6, anim: 'pop' }),
    ] },
    { id: 'hersese', dur: pb(7), bg: 'desk', sfx: [...BAS.map((t) => [t, 'clickx', 0.7]), [2.3, 'beep', 0.25]], layers: [
      meme6('Hasta her sese<br>basıyor.', { c: 'sm' }),
      Z('odyometre', { y: 590, tones: [[2.3, 0.5]], presses: BAS }),
      Z('dugme', { y: 1030, presses: BAS }),
      H('meme sm', '…sen daha ton<br>vermedin.', { y: 1380, at: 1.2, until: 2.25, anim: 'pop' }),
    ] },
    { id: 'maske', dur: pb(8), bg: 'void', mus: 'tension', fx: { jitter: 0 }, sfx: [[0, 'whoosh', 0.4], ...KAFA.map((_, i) => [0.5 + i * 0.4, 'swish', 0.35]), [pb(8) - 0.3, 'bonk', 0.5]], layers: [
      Z('kabin', { y: 800, w: 560, qAt: 0.2 }),
      meme6('İç ses:', { c: 'sm', y: 330 }),
      H('bubble', '<span style="font-size:76px;line-height:1.02">Maskeleme<br>gerekiyor mu?</span>', { y: 440, at: 0.1, anim: 'pop', jitter: 3 }),
      ...KAFA.map(([t, dx, y, r], i) => H('tag6 ink', t, { y, dx, rot: r, at: 0.5 + i * 0.4, anim: 'fly', from: [dx > 0 ? 900 : -900, 0, r * 4], sway: 3, swayT: 1.3 + i * 0.2 })),
    ] },
    { id: 'ilki', dur: pb(6), bg: 'night', mus: 'off', ringY: 1000, fx: { flash: [[0, 0.1]] }, sfx: [[0, 'sparkle', 0.5], [0.05, 'reverse', 0.2]], layers: [
      kt('Herkesin<br>bir ilki var.', { c: 'md gold', y: 330, anim: 'fade' }),
      { kind: 'odi', size: 280, y: 820, at: 0.2, anim: 'pop', bob: 1.6, bobAmp: 10, dx: -150 },
      { kind: 'dede', size: 280, y: 820, at: 0.4, anim: 'pop', bob: 1.8, bobAmp: 10, dx: 160, phase: 0.5 },
    ] },
    { id: 'pratik', dur: pb(8), bg: 'plan', mus: 'bright', sfx: [[0, 'whoosh', 0.4], [0.9, 'swish', 0.35]], layers: [
      H('big6 sm lo', '<em>32 kurgusal vaka</em><br>ile pratik', { y: 330, at: 0, anim: 'pop' }),
      phone(V3('salon.png'), [0, 390, 1170, 1650], { imgW: 1170, w: 560, y: 560, dx: -170, maxH: 820, ry: [-12, -4], at: 0.05 }),
      phone(V3('kv11-kart-odyometri.png'), [0, 0, 1062, 1269], { imgW: 1062, w: 540, y: 800, dx: 200, maxH: 660, ry: [12, 4], at: 0.6 }),
      H('lvltag', 'ODİ · Kamp Kliniği › Hasta Vakaları (kurgusal)', { y: 1515, at: 0.3, anim: 'fade' }),
    ] },
    { id: 'cta', dur: pb(6), bg: 'desk', sfx: [[0, 'pop', 0.5]], layers: [
      meme6('İlk hastanı<br>hatırlıyor<br>musun?', { c: 'lg', y: 340 }),
      Z('kabin', { y: 800, w: 600 }),
      H('cta6', `${YORUM}<span>Yorumlara yaz.</span>`, { y: 1330, at: 0.2, anim: 'pop', pulse: 112, pulseAt: 0.4, pulseAmt: 0.03 }),
    ] },
    son(pb(4)),
  ],
  vo: [{ id: 'ih1', scene: 'ilki', at: 0.5, nosub: true }, { id: 'ih2', scene: 'pratik', at: 0.3, nosub: true }, { id: 'ih3', scene: 'cta', at: 0.2, nosub: true }],
  cover: { bg: 'desk', seek: 1, layers: [
    H('meme lg', 'POV:<br>İlk hastan.<br>İlk odyometri.', { y: 270 }),
    Z('kabin', { y: 860, w: 820, qAt: 0 }),
  ] },
  post: {
    caption: 'POV: İlk hastan, ilk odyometri. Kırmızı sağ mıydı, mavi sol mu? Talimatı unuttun, hasta her sese basıyor, kafanda tek soru: maskeleme gerekiyor mu?\nHerkesin bir ilki var. ODİ: Sesin Yolu\'nda Kamp Kliniği\'nin 32 kurgusal vakasıyla pratik yap (çok yakında).\nİlk hastanı hatırlıyor musun? Yorumlara yaz, stajdaki arkadaşını etiketle.',
    tags: ['#odyoloji', '#odyolojiöğrencisi', '#odyolog', '#staj', '#odyometri', '#pov', '#klinik', '#odisesinyolu'],
  },
};

/* =================================================================== 9. BU SES KAÇ dB? (tahmin et; NIOSH güvenli süre kartı) */
const db = grid(128); // ≈0,469 sn
const SESLER = [
  { id: 'fisilti', ad: 'Fısıltı', v: 30, cevap: '30 dB', lvl: 0.15, q: 'd2', r: 'd3' },
  { id: 'konusma', ad: 'Konuşma', v: 60, cevap: '60 dB', lvl: 0.45, q: 'd4', r: 'd5' },
  { id: 'trafik', ad: 'Yoğun trafik', v: 80, v2: 85, cevap: '80–85 dB', lvl: 0.75, q: 'd6', r: 'd7' },
  { id: 'konser', ad: 'Konser', v: 100, v2: 110, cevap: '100–110 dB', lvl: 1, q: 'd8', r: 'd9' },
];
const D_REV = 1.95;  // cevap anı (tur içinde)
const cetvel = (k) => Z('dbCetvel', { y: 430, dx: -205, h: 960, marks: SESLER.map((x, i) => ({ v: x.v, v2: x.v2, label: x.ad, w: x.ad.length > 8 ? 270 : 200, c: ['#3ef08a', '#ffc93c', '#ff9f1c', '#ff3b5c'][i], at: i < k ? -1 : i === k ? D_REV : 99 })) });
const NIOSH = `<h3>Güvenli süre <small>günde, NIOSH 1998</small></h3>
  ${[['85 dBA', '8 saat'], ['88 dBA', '4 saat'], ['91 dBA', '2 saat'], ['94 dBA', '1 saat'], ['97 dBA', '30 dakika'], ['100 dBA', '15 dakika'], ['110 dBA', '≈ 1,5 dakika']].map(([a, b], i) => `<div class="r"><b class="${i > 4 ? 'c' : i > 2 ? 'g' : 't'}">${a}</b><span class="ar">→</span><span>${b}</span></div>`).join('')}
  <div class="ft">Her +3 dB'de güvenli süre yarıya iner.</div>
  <div class="src">NIOSH, Occupational Noise Exposure (1998): 85 dBA'da 8 saat, 3 dB değiş tokuş oranı · eğitsel içerik</div>`;
const dbQuiz = {
  slug: 'bu-ses-kac-db', title: 'Bu ses kaç dB?', ad: true, bpm: 128, snap: db(1), style: 'yarisma', scripts: SCR,
  subY: 1440, subCls: 'big', voGap: 0.1, tail: 0.5, limit: 0.6, jpegOpaque: true, duck: { music: -9, sfx: -4 },
  scenes: [
    { id: 'kanca', dur: db(5), bg: 'quiz', mus: 'fanfar', fx: { flash: [[0, 0.12]], zoom: [[0, 0.3, 0.06]] }, sfx: [[0, 'hit', 0.6], ...[0.35, 0.5, 0.65, 0.8].map((t) => [t, 'pop', 0.3])], layers: [
      kt('Bu ses<br>kaç <span class="lo">dB</span>?', { c: 'lg gold', y: 330, slamFrom: 2.2 }),
      ...SESLER.map((x, i) => Z('sesIkon', { ikon: x.id, lvl: x.lvl, size: 0.5, y: 780 + Math.floor(i / 2) * 290, dx: i % 2 ? 200 : -200, at: 0.35 + i * 0.15, anim: 'pop' })),
      H('lead6', 'Tahmin et: <b>4 ses</b>', { y: 1380, at: 0.9, anim: 'rise' }),
      H('src6', 'Videoda yüksek ses yok: sesler görsel.', { y: 1470, at: 1.0, anim: 'fade' }),
    ] },
    ...SESLER.map((x, k) => ({ id: x.id, dur: db(8), bg: 'quiz', mus: 'think', sfx: [[0, 'whoosh', 0.35], [0.05, 'pop', 0.4], [D_REV, 'ding', 0.5], [D_REV, 'hit', 0.3]], layers: [
      H('lead6', `${k + 1}/4 · <b>Bu ses kaç dB?</b>`, { y: 330, at: 0, anim: 'none' }),
      cetvel(k),
      Z('sesIkon', { ikon: x.id, lvl: x.lvl, size: 0.8, y: 440, dx: 250, at: 0, anim: 'pop', shake: x.lvl > 0.7 ? 6 : 0 }),
      H('tag6 ink', x.id === 'konusma' ? 'Normal konuşma' : x.ad, { y: 830, dx: 250, at: 0.1, anim: 'pop' }),
      { kind: 'ring', y: 960, dx: 250, at: 0.35, until: D_REV, from: 3, dur: D_REV - 0.35, anim: 'pop' },
      H('big6 lo', `<span style="font-size:44px;letter-spacing:2px">yaklaşık</span><br><span style="font-size:${x.cevap.length > 6 ? 88 : 110}px">${x.cevap}</span>`, { y: 990, dx: 250, at: D_REV, anim: 'slam', slamFrom: 1.8 }),
    ] })),
    { id: 'niosh', dur: db(10), bg: 'quiz', mus: 'reveal', fx: { flash: [[0, 0.1]] }, sfx: [[0, 'whoosh', 0.4], [0.1, 'paper', 0.5]], layers: [
      H('kart6', NIOSH, { y: 330, at: 0, anim: 'grow', growFrom: 0.85, growT: 0.3 }),
    ] },
    { id: 'konser', dur: db(6), bg: 'quiz', sfx: [[0, 'stamp', 0.5]], layers: [
      H('kart6', NIOSH, { y: 330, at: 0, anim: 'none' }),
      H('tag6', 'Konser (≈100–110 dB): güvenli süre dakikalarla ölçülür', { y: 1340, at: 0.05, anim: 'stamp', rot: -2 }),
    ] },
    { id: 'cta', dur: db(6), bg: 'quiz', sfx: [[0, 'pop', 0.5]], layers: [
      H('kart6', NIOSH, { y: 330, at: 0, anim: 'none' }),
      H('cta6 gold', `<svg width="58" height="58" viewBox="0 0 58 58"><circle cx="29" cy="29" r="25" fill="none" stroke="#14082e" stroke-width="7"/><circle cx="29" cy="29" r="9" fill="#14082e"/><path d="M38 29v6a6 6 0 0 0 12 0v-6" fill="none" stroke="#14082e" stroke-width="7"/></svg><span>Konser arkadaşını etiketle.</span>`, { y: 1340, at: 0.05, anim: 'pop', pulse: 128, pulseAt: 0.3, pulseAmt: 0.03 }),
    ] },
    son(db(4)),
  ],
  vo: [
    { id: 'd1', scene: 'kanca', at: 0.2, nosub: true },
    ...SESLER.flatMap((x) => [{ id: x.q, scene: x.id, at: 0.15, nosub: true }, { id: x.r, scene: x.id, at: D_REV + 0.05, nosub: true }]),
    { id: 'd10', scene: 'niosh', at: 0.3 }, { id: 'd11', scene: 'niosh', at: 0.3 }, { id: 'd12', scene: 'konser', at: 0.1, nosub: true }, { id: 'd13', scene: 'cta', at: 0.1, nosub: true },
  ],
  cover: { bg: 'quiz', seek: 2, layers: [
    kt('Bu ses<br>kaç <span class="lo">dB</span>?', { c: 'lg gold', y: 330 }),
    ...SESLER.map((x, i) => Z('sesIkon', { ikon: x.id, lvl: x.lvl, size: 0.5, y: 780 + Math.floor(i / 2) * 290, dx: i % 2 ? 200 : -200 })),
    H('lead6', 'Tahmin et: <b>4 ses</b>', { y: 1380 }),
  ] },
  post: {
    caption: 'Bu ses kaç dB? Tahmin et!\nFısıltı ≈ 30 dB · normal konuşma ≈ 60 dB · yoğun trafik ≈ 80–85 dB · konser ≈ 100–110 dB (yaklaşık değerler).\nGüvenli süre (NIOSH 1998, günlük): 85 dBA 8 saat, 88 dBA 4 saat, 91 dBA 2 saat, 94 dBA 1 saat, 97 dBA 30 dk, 100 dBA 15 dk; her +3 dB süreyi yarıya indirir. 110 dBA\'da ≈1,5 dakika.\nKonserde kulak tıkacı tak, hoparlörden uzak dur, sessiz yerde mola ver. Konser arkadaşını etiketle!',
    tags: ['#odyoloji', '#odyolojiöğrencisi', '#desibel', '#gürültü', '#konser', '#kulaksağlığı', '#işitmekoruma', '#odisesinyolu'],
  },
};

/* =================================================================== 10. KAÇ HZ'E KADAR DUYUYORSUN? (ton merdiveni; işitme testi değildir) */
const hb = grid(90); // ≈0,667 sn
const FREK = [8000, 10000, 12000, 14000, 15000, 16000, 17000];
const T_ON = 1.25, T_ARA = 0.5, T_ILK = 1.0;  // ton süresi, ara, ilk ton
const STEPS = FREK.map((f, i) => ({ f, at: T_ILK + i * (T_ON + T_ARA), d: T_ON }));
const UYARI = '<b>Bu bir işitme testi değildir.</b><br>Telefon hoparlörü ve kulaklık yüksek frekansları veremeyebilir; uygulamanın ses sıkıştırması da kesebilir. <b>Sesi düşük tut.</b>';
const kacHz = {
  slug: 'kac-hz-duyuyorsun', title: "Kaç Hz'e kadar duyuyorsun?", ad: true, bpm: 90, snap: hb(1), style: 'sessiz', scripts: SCR,
  subY: 1440, subCls: 'big', voGap: 0.12, tail: 0.5, limit: 0.6, jpegOpaque: true, duck: { music: -8, sfx: -4 },
  tonesPost: { dbfs: -27, fade: 0.08 }, aac: { b: '256k', cutoff: 20000 },
  scenes: [
    { id: 'kanca', dur: hb(4), bg: 'calm', mus: 'amb', fx: { flash: [[0, 0.1]] }, sfx: [[0, 'hit', 0.4]], layers: [
      kt("Kaç <span class=\"lo\">Hz'e</span><br>kadar<br>duyuyorsun?", { c: 'md gold', y: 340, slamFrom: 2.0 }),
      H('big6 lo', '8 kHz <em>→</em> 17 kHz', { y: 860, at: 0.35, anim: 'pop' }),
      H('lead6', '7 ton, alçaktan inceye', { y: 1000, at: 0.5, anim: 'rise' }),
      H('warn', 'Bu bir işitme testi değildir · Sesi düşük tut', { y: 1300, at: 0.3, anim: 'fade' }),
    ] },
    { id: 'uyari', dur: hb(5), bg: 'calm', sfx: [[0, 'pop', 0.3]], layers: [
      H('lead6', '<b>Başlamadan önce:</b>', { y: 360, anim: 'pop' }),
      H('kart6', `<div style="font:900 46px/1.25 Nunito,sans-serif;text-align:center">${UYARI}</div>`, { y: 500, at: 0.05, anim: 'grow', growFrom: 0.85, growT: 0.3 }),
      H('lead6', 'Hazır mısın? <b>7 ton</b>, alçaktan inceye.', { y: 1100, at: 0.6, anim: 'rise' }),
    ] },
    { id: 'merdiven', dur: T_ILK + FREK.length * (T_ON + T_ARA) + 0.2, bg: 'calm', mus: 'off', tones: STEPS.map((x) => [x.at, x.f, x.d]), layers: [
      H('lead6', 'Duyduğun <b>son frekansı</b><br>yorumlara yaz', { y: 320, at: 0, anim: 'none' }),
      Z('merdiven', { y: 0, steps: STEPS, waveY: 450, y0: 1340, gap: 108 }),
      H('src6', 'Bu bir işitme testi değildir · Sesi düşük tut', { y: 1480, at: 0, anim: 'none' }),
    ] },
    { id: 'yaz', dur: hb(4), bg: 'calm', mus: 'pulse', fx: { flash: [[0, 0.08]] }, sfx: [[0, 'ding', 0.4]], layers: [
      H('lead6', 'Duyduğun <b>son frekansı</b><br>yorumlara yaz', { y: 320, at: 0, anim: 'none' }),
      Z('merdiven', { y: 0, steps: STEPS.map((x) => ({ ...x, at: x.at - 99 })), waveY: 450, y0: 1340, gap: 108 }),
      H('cta6', `${YORUM}<span>Kaç kHz? Yorumlara yaz.</span>`, { y: 1440, at: 0.1, anim: 'pop' }),
    ] },
    { id: 'bilgi', dur: hb(5), bg: 'calm', sfx: [[0, 'whoosh', 0.3]], layers: [
      H('kart6', `<h3>Neden herkes farklı? <small>bilgi</small></h3>
        <div class="r" style="display:block;border:none">Genç ve sağlıklı kulak yaklaşık <b class="t">20 Hz – 20 kHz</b> arasını duyar.</div>
        <div class="r" style="display:block">Yaşla birlikte genellikle önce <b class="c">ince (yüksek frekanslı)</b> sesleri duymak zorlaşır.</div>
        <div class="ft" style="background:#e3f9f6;color:#0b5f5a">İşitmenle ilgili bir kaygın varsa bir odyoloğa danış.</div>
        <div class="src">Kaynak: Gelfand, Hearing (mutlak eşikler); Katz, Handbook of Clinical Audiology (presbiakuzi)</div>`, { y: 420, at: 0, anim: 'grow', growFrom: 0.85, growT: 0.3 }),
    ] },
    { id: 'cta', dur: hb(4), bg: 'calm', sfx: [[0, 'pop', 0.4]], layers: [
      H('kt md gold', 'Kim daha<br>yükseği<br>duyacak?', { y: 380, anim: 'slam', slamFrom: 1.8 }),
      H('cta6', `${GONDER}<span>Arkadaşına gönder.</span>`, { y: 1050, at: 0.15, anim: 'pop', pulse: 90, pulseAt: 0.4, pulseAmt: 0.03 }),
    ] },
    son(hb(3)),
  ],
  vo: [
    { id: 'h1', scene: 'kanca', at: 0.2, nosub: true }, { id: 'h2', scene: 'uyari', at: 0.2, nosub: true }, { id: 'h3', scene: 'yaz', at: 0.15, nosub: true },
    { id: 'h4', scene: 'bilgi', at: 0.2 }, { id: 'h5', scene: 'cta', at: 0.1, nosub: true },
  ],
  cover: { bg: 'calm', seek: 6.3, layers: [
    kt("Kaç <span class=\"lo\">Hz'e</span><br>kadar duyuyorsun?", { c: 'md gold', y: 300 }),
    Z('merdiven', { y: 0, steps: STEPS.map((x, i) => ({ ...x, at: i < 4 ? 0 : 99 })), waveY: 640, y0: 1380, gap: 100 }),
  ] },
  post: {
    caption: "Kaç Hz'e kadar duyuyorsun? 8 kHz'den 17 kHz'e 7 ton. Duyduğun son frekansı yorumlara yaz!\nBu bir işitme testi değildir: telefon hoparlörü ve kulaklık yüksek frekansları veremeyebilir, uygulamanın ses sıkıştırması da kesebilir. Sesi düşük tut.\nGenç ve sağlıklı kulak yaklaşık 20 Hz–20 kHz arasını duyar; yaşla birlikte genellikle önce ince sesleri duymak zorlaşır (presbiakuzi). İşitmenle ilgili bir kaygın varsa bir odyoloğa danış.\nArkadaşına gönder: kim daha yükseği duyacak?",
    tags: ['#odyoloji', '#odyolojiöğrencisi', '#işitme', '#frekans', '#hertz', '#challenge', '#kulak', '#odisesinyolu'],
  },
};

const ALL = [rinneWeber, sirala, ilkHastan, dbQuiz, kacHz];
// köşe imzası her sahnede (kapanış hariç); durağan sahnelerde yavaş yakınlaşma
for (const r of ALL) for (const sc of r.scenes) {
  if (sc.id !== 'son') sc.layers = [...(sc.layers ?? []), KOSE];
  if (sc.bg !== 'clip' && !sc.fx?.push) sc.fx = { ...(sc.fx ?? {}), push: 0.025, pushT: sc.dur };
}
export const REELS = Object.fromEntries(ALL.map((r) => [r.slug, r]));
void tsub;
