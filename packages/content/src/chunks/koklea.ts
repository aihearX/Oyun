import type { ChunkSpec } from '@odi/shared';
import { G, bank, beat, beatSlide, moving, block, bubble, checkpoint, chunk, coin, coins, collect, crumble, current, decor, enemy, fgate, flightArc, fork, ground, hazard, jumpArc, launchArc, launcher, plat, pool, power, secret, spike, spring } from './helpers';
import { curtain } from './ogretici';

/**
 * Koklea (21-30): sıvı dolu sarmal. Yüzme (21'den): sıvıda basılı tut → yüksel, bırak → dal; yüzeye çıkınca basılıysa sıçrar.
 * Taban (koklea-1) ince sesler: havuzlar, kabarcıklar. Orta (koklea-2) konuşma: diyapazon (fork) rengine göre açılan
 * frekans kapıları — yanlış renkle kapıya değmek can yakar ve bulmacanın başındaki kontrol noktasına döndürür.
 * Apeks (koklea-3) kalın sesler: derin sular, ufalanan sarmal basamaklar, ağır zıplayanlar.
 * Tonotopi rengi: 0 (taban, ince) … 1 (apeks, kalın).
 */
const K1 = ['koklea-1'] as const, K2 = ['koklea-2'] as const, K3 = ['koklea-3'] as const, KALL = ['koklea-1', 'koklea-2', 'koklea-3'] as const;
const hucre = (x: number, s = 1) => decor(x, G, 'hucre', s);
const hop = (x: number, hop = 110) => enemy(x, G, 'ziplayan', 0, { hop });
const fish = (x: number, y: number, dx = 60) => enemy(x, y, 'ucan', dx, { amp: 20 });
/** dalış izi: her notada `dy` px aşağı inen nota dizisi (oyuncuyu derindeki ödüle götürür) */
const diveTrail = (x: number, y: number, n: number, gap: number, dy: number) => Array.from({ length: n }, (_, i) => coin(x + i * gap, y + i * dy));
const crumbles = (x: number, n: number, y = G, gap = 92) => Array.from({ length: n }, (_, i) => crumble(x + i * gap, y, 88));

export const KOKLEA_CHUNKS: ChunkSpec[] = [
  // ---------------------------------------------------------------- taban
  chunk('k1-havuz', 'yuzme', 2, 1200, [bank(0, 300), ...pool(300, 600, 240), spike(480, 60, G + 240), spike(700, 60, G + 240), hazard(580, G - 20, 70, 110), ...coins(340, G + 120, 4, 40), ...coins(760, G + 60, 3, 40), bank(900, 300), spike(1050, 40), secret(600, G + 200), hucre(100)], { tags: ['su'], biomes: [...KALL] }),
  chunk('k1-adalar', 'yuzme', 2, 1300, [bank(0, 260), ...pool(260, 900, 220), block(420, G - 20, 120, 260), block(700, G - 40, 120, 280), ...coins(430, G - 70, 3, 40), ...coins(710, G - 90, 3, 40), fish(600, G + 120, 50), ...coins(900, G + 140, 3, 40), bank(1160, 140), secret(1010, G + 170), hucre(1220)], { tags: ['su', 'bosluk'], biomes: [...KALL] }),
  chunk('k1-kabarcik', 'yuzme', 3, 1600, [bank(0, 240), ...pool(240, 1160, 260), bubble(560, G + 150), bubble(900, G + 190), bubble(1200, G + 120), hazard(420, G + 40, 80, 120), hazard(760, G + 120, 80, 140), hazard(1060, G - 10, 80, 120), ...coins(300, G + 200, 3, 40), ...coins(860, G + 60, 4, 40), bank(1400, 200), secret(1260, G + 220), collect(640, G + 80)], { tags: ['su'], biomes: [...K1] }),
  chunk('k1-akinti', 'yuzme', 3, 1300, [bank(0, 260), ...pool(260, 820, 260), current(300, G - 10, 360, 270, 140, -40), current(700, G + 60, 300, 200, -60, 80), spike(760, 80, G + 260), hazard(560, G + 160, 100, 100), ...coins(320, G + 60, 5, 44), ...coins(760, G + 40, 3, 40), bank(1080, 220), secret(980, G + 220), bubble(880, G + 200)], { tags: ['su', 'akinti'], biomes: [...KALL] }),
  chunk('k1-zar-havuz', 'yuzme', 3, 1300, [ground(0, 300), beat(330, G, 140, '1100'), beat(530, G, 140, '0011'), ...pool(300, 540, 200), bank(840, 0 + 460), ...coins(340, G - 40, 3, 40), ...coins(540, G - 40, 3, 40), ...coins(400, G + 120, 6, 44), secret(820, G - 230), plat(780, G - 150, 100), spike(1020, 40), ...jumpArc(919, 4, 0.6), spike(1200, 40), hucre(1260)], { tags: ['ritim', 'su'], biomes: [...KALL] }),
  chunk('k1-ince-ses', 'yuzme', 2, 1200, [ground(0, 1200), curtain(260, 120, 'dalga'), ...coins(270, G - 20, 3, 40), hop(560, 100), ...coins(520, G - 170, 3, 40, 20), spike(820, 48), ...coins(800, G - 130, 3, 36, 20), hucre(1050), secret(680, G - 260), plat(630, G - 180, 110), power(1100, G - 70, 'magnet')], { tags: ['dusman', 'kayma'], biomes: [...KALL], needs: ['kayma'] }),
  // ---------------------------------------------------------------- orta kıvrım: frekans
  chunk('k2-frekans', 'yuzme', 3, 1500, [ground(0, 1500), checkpoint(80), fork(330, G - 40, 0.15), plat(330, G - 140, 300), fork(500, G - 190, 0.55), ...coins(350, G - 200, 3, 40), ...coins(560, G - 200, 2, 40), fgate(900, G - 300, 300, 0.55), ...coins(960, G - 40, 3, 40), spike(1110, 40), ...jumpArc(1009, 4, 0.6), hucre(1400), secret(1260, G - 240), plat(1210, G - 170, 110)], { tags: ['frekans'], biomes: [...K2, ...K3] }),
  chunk('k2-frekans-su', 'yuzme', 4, 1700, [bank(0, 300), checkpoint(100), fork(220, G - 60, 0.55), ...pool(300, 700, 240), spike(600, 300, G + 240), fork(500, G + 105, 0.25), fork(760, G + 40, 0.25), bank(1000, 700), fgate(1260, G - 300, 300, 0.25), ...coins(330, G + 120, 5, 44), ...coins(1300, G - 40, 3, 40), spike(1460, 40), ...jumpArc(1359, 4, 0.6), bubble(700, G + 150), secret(820, G + 200)], { tags: ['frekans', 'su'], biomes: [...K2] }),
  chunk('k2-tuylu-hucre', 'yuzme', 3, 1300, [ground(0, 280), beatSlide(300, G, 120, 170, '1100'), beatSlide(620, G - 60, 120, 160, '0110', 0.5), ground(940, 360), ...coins(320, G - 60, 3, 40), ...coins(640, G - 120, 3, 40), hucre(1000), hucre(1200, 1.2), secret(700, G - 300)], { tags: ['ritim', 'hareketli'], biomes: [...K2] }),
  chunk('k2-hucre-tarlasi', 'kosu', 3, 1400, [ground(0, 1400), hucre(100), hop(380, 110), ...jumpArc(260, 4, 1), curtain(640, 120, 'dalga'), ...coins(650, G - 20, 3, 40), hop(940, 90), ...jumpArc(820, 4, 1), spike(1260, 40), hucre(1350, 1.2), secret(1150, G - 250), plat(1100, G - 170, 100), collect(800, G - 200)], { tags: ['dusman', 'ritim'], biomes: [...K2], needs: ['kayma'] }),
  chunk('k2-konusma', 'yuzme', 4, 1500, [ground(0, 300), ...coins(310, G - 160, 6, 44, 40), ground(640, 860), enemy(1350, G, 'atici', 0, { period: 2.4, range: 420 }), spike(1000, 48), ...coins(980, G - 130, 3, 36, 20), beat(700, G - 140, 120, '1100'), ...coins(710, G - 190, 3, 40), secret(760, G - 300)], { tags: ['suzul', 'atici'], biomes: [...K2, ...K3], needs: ['suzul'] }),
  // ---------------------------------------------------------------- apeks
  // sarmal: fırlatıcıyla rafa, aralıklı ufalanan basamaklardan (her aralıkta kısa zıplama) aşağı
  chunk('k3-spiral', 'yuzme', 3, 1400, [ground(0, 300), spike(140, 36), launcher(270, G, 280, -1150), plat(560, G - 320, 140), crumble(740, G - 250, 80), crumble(864, G - 250, 80), crumble(1010, G - 170, 80), crumble(1134, G - 170, 80), ground(1240, 160), ...launchArc(270, 280, -1150, 4, { landY: G - 320, to: 0.5 }), ...coins(570, G - 360, 3, 40), ...jumpArc(800, 3, 0.15, G - 250), ...jumpArc(1070, 3, 0.15, G - 170), ...coins(750, G - 290, 2, 40), ...coins(1020, G - 210, 2, 40), secret(630, G - 470)], { tags: ['ufalanan', 'firlatici'], biomes: [...K3] }),
  // derin havuz: balığın ardındaki nota dizisi aşağı inen bir dalış izidir, büyük notaya (derinde, akıntının içinde) götürür —
  // eskiden düz dizi ile büyük nota ayrı yollardı, oyuncu ikisinden birini seçmek zorundaydı (MK-021)
  chunk('k3-derin', 'yuzme', 4, 1600, [bank(0, 260, 380), ...pool(260, 1080, 380), current(300, G + 100, 1000, 280, 60, 30), bubble(620, G + 300), bubble(1000, G + 260), spike(500, 100, G + 380), spike(860, 100, G + 380), hazard(700, G + 20, 90, 140), fish(940, G + 200, 60), ...coins(400, G + 300, 4, 44), ...diveTrail(1000, G + 120, 4, 44, 35), bank(1340, 260, 380), secret(760, G + 330), collect(1176, G + 270)], { tags: ['su', 'akinti'], biomes: [...K3] }),
  chunk('k3-bas', 'yuzme', 4, 1400, [ground(0, 1400), hop(360, 150), ...coins(320, G - 220, 3, 40, 20), enemy(640, G, 'kalkanli', 50), ...coins(600, G - 150, 3, 40, 20), hop(980, 140), ...coins(940, G - 210, 3, 40, 20), spike(1200, 48), ...coins(1180, G - 130, 3, 36, 20), secret(800, G - 260), plat(750, G - 180, 110)], { tags: ['dusman'], biomes: [...K3] }),
  // havuz üstü ufalanan basamaklar (aralıklı): kaçıran suya düşer ve yüzerek devam eder (bağışlayıcı ama yavaş)
  chunk('k3-ufalanan-su', 'yuzme', 4, 1400, [bank(0, 280), ...pool(280, 840, 240), ...crumbles(320, 6, G - 20, 130), bubble(700, G + 160), spike(470, 230, G + 240), hazard(860, G + 60, 70, 180), ...coins(330, G - 60, 6, 130), ...coins(500, G + 140, 4, 44), bank(1120, 280), spike(1260, 40), secret(840, G + 200)], { tags: ['ufalanan', 'su'], biomes: [...KALL] }),
  chunk('k3-yay-kule', 'yuzme', 3, 1300, [ground(0, 1300), spike(150, 40), spring(300, G, 1.2), plat(360, G - 340, 220), ...coins(380, G - 380, 5, 40), ...flightArc(292, G, 1080, 3, { to: 0.32 }), spike(700, 64), spike(960, 64), ...coins(940, G - 130, 3, 36, 20), secret(470, G - 520), collect(680, G - 520)], { tags: ['yay'], biomes: [...KALL] }),
  // ---------------------------------------------------------------- gösteriler
  // Oval Pencereden Dalış: yüksekten derin havuza atla, akıntılar ve kabarcıklarla geç, fırlatıcıyla çık
  chunk('k1-sp-oval-pencere', 'yuzme', 3, 2300, [
    ground(0, 260), spike(110, 36), launcher(230, G, 200, -900), bank(260, 0 + 40, 380), ...pool(300, 1500, 380), bank(1800, 500, 380),
    current(320, G + 40, 600, 330, 110, 40), current(1100, G - 10, 500, 300, 40, -60), bubble(700, G + 260), bubble(1150, G + 300), bubble(1500, G + 200),
    hazard(860, G + 140, 100, 160), hazard(1090, G + 270, 80, 110), spike(1250, 120, G + 380), fish(1400, G + 180, 70), spike(2130, 40),
    ...launchArc(230, 200, -900, 5), ...coins(520, G + 260, 6, 44), ...coins(1300, G + 120, 6, 44), collect(1000, G + 330), secret(1690, G + 200),
  ], { tags: ['gosteri', 'su', 'akinti'], biomes: [...K1], setPiece: true }),
  // Frekans Labirenti: üç kapı, üç renk; doğru diyapazonu doğru katta al
  chunk('k2-sp-labirent', 'yuzme', 4, 2400, [
    ground(0, 2400), checkpoint(80), fork(260, G - 40, 0.2), plat(300, G - 140, 260), fork(430, G - 190, 0.6), fgate(700, G - 300, 300, 0.6),
    checkpoint(800), plat(900, G - 140, 240), fork(1020, G - 190, 0.2), fork(1100, G - 40, 0.9), fgate(1300, G - 300, 300, 0.2),
    checkpoint(1400), fork(1520, G - 40, 0.6), plat(1560, G - 140, 260), fork(1690, G - 190, 0.2), fgate(1950, G - 300, 300, 0.2),
    ...coins(310, G - 210, 3, 40), ...coins(910, G - 210, 3, 40), ...coins(1570, G - 220, 3, 40), ...coins(2050, G - 60, 6, 40), secret(1200, G - 300), collect(2200, G - 100), hucre(2300),
  ], { tags: ['gosteri', 'frekans'], biomes: [...K2], setPiece: true }),
  // Spiral İniş: fırlatıcıyla tepeye, ufalanan sarmal basamaklardan derin suya
  chunk('k3-sp-spiral-inis', 'yuzme', 4, 2400, [
    ground(0, 280), spike(130, 36), launcher(250, G, 240, -1300), plat(420, G - 460, 200), crumble(660, G - 400, 80), crumble(784, G - 400, 80), crumble(950, G - 320, 80), crumble(1074, G - 320, 80), crumble(1240, G - 240, 80), crumble(1364, G - 240, 80),
    bank(1460, 0 + 30, 300), ...pool(1490, 600, 300), bank(2090, 310, 300), bubble(1800, G + 220), hazard(1700, G + 60, 80, 140),
    ...coins(440, G - 500, 4, 40), ...jumpArc(720, 3, 0.15, G - 400), ...jumpArc(1010, 3, 0.15, G - 320), ...jumpArc(1300, 3, 0.15, G - 240), ...coins(1560, G + 180, 6, 44), spike(2230, 40), secret(1960, G + 250), collect(760, G - 560),
  ], { tags: ['gosteri', 'ufalanan', 'su'], biomes: [...K3], setPiece: true }),
  // ---------------------------------------------------------------- sınav odaları (bölge finalleri, docs/12): öğrenilen her şey bir arada,
  // daha sıkı zamanlama; her tehlike görünür ve okunur, gizli koklea ana yolda değil
  // Taban sınavı: vuruşla beliren basamaklar havuzun üstünde; düşen yüzerek devam eder ama sıvıda balıklar ve gürültü var
  chunk('k1-sinav-havuz', 'yuzme', 5, 1800, [
    // geniş çukurun üstünde gidip gelen hücre köprüsü, yolunda sürüklenen gürültü; sonra balıklı havuz ve zıplayan bekçi
    ground(0, 280), moving(300, G - 30, 120, 220, 0, 3000), hazard(500, G - 190, 60, 60, 'gurultu', { dx: 0, dy: 90, period: 1800, phase: 0.5 }), ground(760, 300),
    ...pool(1060, 360, 200), fish(1240, G + 110, 70), bubble(1120, G + 150), bank(1420, 380, 200), hop(1600, 110), spike(1720, 40),
    ...coins(320, G - 80, 5, 44), ...coins(1100, G + 90, 4, 44), ...jumpArc(1480, 4, 1),
    plat(820, G - 260, 70), secret(855, G - 310),
  ], { tags: ['su', 'hareketli', 'dusman', 'sinav'], biomes: [...KALL] }),
  // Apeks sınavı: ufalanan aralıklı basamaklar, ağır zıplayanlar, kalkanlı bekçi ve hareketli köprü
  chunk('k3-sinav-bas', 'yuzme', 5, 1800, [
    // geniş çukurun üstünde gidip gelen köprü, köprünün yolunda sürüklenen gürültü; ardından ufalanan basamaklar ve ağır zıplayan
    ground(0, 300), moving(320, G - 30, 120, 230, 0, 3200), hazard(520, G - 200, 60, 60, 'gurultu', { dx: 0, dy: 90, period: 1900 }), ground(800, 200),
    ...crumbles(1040, 3, G, 130), ground(1430, 370), hop(1600, 140), spike(1740, 40),
    ...coins(340, G - 80, 5, 44), ...jumpArc(975, 3, 0.15), ...jumpArc(1105, 3, 0.15), ...jumpArc(1235, 3, 0.15),
    plat(850, G - 260, 80), secret(890, G - 310),
  ], { tags: ['hareketli', 'ufalanan', 'dusman', 'sinav'], biomes: [...K2, ...K3] }),
];
