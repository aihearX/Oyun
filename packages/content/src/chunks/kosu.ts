import type { Entity } from '@odi/shared';
import { GROUND_Y } from '@odi/shared';
import { chunk, coins, enemy, ground, plat, power, secret, spike, text, checkpoint, hazard, spring, moving } from './helpers';

/**
 * Koşu parçaları. Kahraman 260 px/s koşar; zıplama ~137 px (basılı tut ~180), tek kayma 500 ms = 130 px.
 *
 * Adil tasarım (bot da geçebilmeli):
 * - diken genişliği ≤ 80, boşluk ≤ 150, platform basamağı ≤ 100 px (zincirleme platformlar ≥ 200 px geniş)
 * - düşen inişlerin altına diken/düşman yok; her engelden sonra ≥ 120 px nefes; parça kenarlarında ≥ 130 px boş
 * - asılı engel (hazard y = zemin−140, h 90): ayakta koşana değmez, zıplayana değer → altından kay
 * - yapışkan serumen (hazard y = zemin−60, h 68): yerde durur, üstünden atla (genişlik ≤ 80)
 * - sinek zemin−62'de alçak uçar: altından kay (zıplayana değer); bakteri zemin−24'te devriye gezer (dx ≤ 60)
 * - eskort parçaları: Fısıltı kahramanı 56 px geriden izler; düşmanlar yoldadır ama zıplanarak/ezilerek geçilir
 * - 'hiz' değiştiricisi (×1.3, bölüm 15+) zıplama mesafesini ~350 px yapar: ardışık engel başlangıçları ≥ 320 px,
 *   boşluk/hareketli platform kenarından sonraki ilk engel ≥ 350 px, iniş noktalarından sonra ≥ 200 px boş
 */
const G = GROUND_Y;
const escortee = (x: number, y: number): Entity => ({ type: 'escortee', x, y });
const decor = (x: number, y: number, kind: string, scale = 1): Entity => ({ type: 'decor', x, y, props: { kind, scale } });
/** Asılı engel: ayakta koşan geçer, zıplayan çarpar. */
const hanging = (x: number, w: number, kind = 'gurultu'): Entity => hazard(x, G - 140, w, 90, kind);
/** Yapışkan serumen: zeminde, üstünden atla. */
const sticky = (x: number, w = 64): Entity => hazard(x, G - 60, w, 68, 'serumen');
/** Alçak uçan sinek: altından kay. */
const fly = (x: number, dx = 40): Entity => enemy(x, G - 62, 'sinek', dx);
const bug = (x: number, dx = 40): Entity => enemy(x, G - 24, 'bakteri', dx);

export const KOSU_CHUNKS = [
  // ---------------------------------------------------------------- nefes (rest)
  chunk('kosu-rest-1', 'kosu', 1, 480, [ground(0, 480), ...coins(120, G - 70, 5), decor(60, G, 'ot'), decor(420, G, 'ot')], { rest: true, tags: ['nefes'] }),
  chunk('kosu-checkpoint', 'kosu', 1, 400, [ground(0, 400), checkpoint(200), ...coins(260, G - 60, 3), decor(80, G, 'ot')], { rest: true, tags: ['checkpoint', 'nefes'] }),
  chunk('kosu-rest-meadow', 'kosu', 1, 560, [ground(0, 560), ...coins(120, G - 100, 7, 36, 50), power(420, G - 90, 'magnet'), decor(60, G, 'ot'), decor(300, G, 'ot', 1.3), decor(500, G, 'ot')], { rest: true, tags: ['nefes'] }),

  // ---------------------------------------------------------------- öğretici
  chunk('kosu-intro-jump', 'kosu', 1, 640, [ground(0, 260), ground(360, 280), ...coins(250, G - 110, 3, 40, 30), text(80, G - 160, 'Dokun: zıpla')], { tags: ['ogretici', 'bosluk'] }),
  chunk('kosu-slide', 'kosu', 2, 640, [ground(0, 640), hanging(260, 120), ...coins(270, G - 40, 4), text(60, G - 160, 'Aşağı kaydır: kay')], { tags: ['kayma', 'ogretici'] }),
  chunk('kosu-intro-enemy', 'kosu', 1, 720, [ground(0, 720), text(140, G - 170, 'Düşmanın üstüne atla'), bug(420, 40), ...coins(340, G - 130, 5, 36, 40)], { tags: ['ogretici', 'dusman'] }),

  // ---------------------------------------------------------------- genel: kolay
  chunk('kosu-spike-1', 'kosu', 1, 560, [ground(0, 560), spike(240, 48), ...coins(200, G - 120, 4, 40, 30)], { tags: ['diken'] }),
  chunk('kosu-steps', 'kosu', 2, 760, [ground(0, 760), plat(180, G - 90, 200), plat(420, G - 180, 200), ...coins(200, G - 140, 4), ...coins(440, G - 230, 4), ...coins(660, G - 60, 2)], { tags: ['platform'] }),
  chunk('kosu-enemy-1', 'kosu', 2, 700, [ground(0, 700), bug(360, 60), ...coins(300, G - 120, 5, 36, 40)], { tags: ['dusman'] }),
  chunk('kosu-coin-arcs', 'kosu', 2, 760, [ground(0, 760), spike(260, 48), ...coins(200, G - 130, 6, 36, 50), plat(560, G - 100, 160), ...coins(580, G - 150, 4)], { tags: ['jeton', 'diken'] }),
  chunk('kosu-spring-bonus', 'kosu', 2, 800, [ground(0, 800), plat(240, G - 60, 240, 60), spring(390, G - 60), ...coins(430, G - 300, 6, 40, 60), text(100, G - 170, 'Kıl hücresi yayı: zıplat')], { tags: ['yay', 'jeton'] }),

  // ---------------------------------------------------------------- genel: orta
  chunk('kosu-gap-2', 'kosu', 3, 880, [ground(0, 240), ground(380, 240), ground(760, 120), ...coins(230, G - 120, 4, 40, 40), ...coins(610, G - 120, 4, 40, 40)], { tags: ['bosluk'] }),
  chunk('kosu-tower', 'kosu', 3, 1000, [ground(0, 1000), plat(200, G - 100, 200), plat(430, G - 200, 200), plat(660, G - 300, 200), secret(760, G - 350), ...coins(220, G - 150, 4), ...coins(450, G - 250, 4), ...coins(680, G - 350, 3)], { tags: ['gizli', 'platform'] }),
  chunk('kosu-sinek-low', 'kosu', 3, 800, [ground(0, 800), text(150, G - 180, 'Sinek alçak uçar: altından kay'), fly(400, 50), ...coins(330, G - 40, 6), bug(640, 40)], { tags: ['dusman', 'kayma'] }),
  chunk('kosu-stairs', 'kosu', 3, 1300, [ground(0, 1300), plat(200, G - 90, 180), plat(400, G - 180, 180), plat(600, G - 270, 180), ...coins(210, G - 140, 4), ...coins(410, G - 230, 4), ...coins(610, G - 320, 4), bug(1050, 40), ...coins(980, G - 130, 5, 36, 40)], { tags: ['platform', 'dusman'] }),
  chunk('kosu-ladder', 'kosu', 3, 1100, [ground(0, 1100), plat(160, G - 80, 220), plat(420, G - 160, 220), plat(680, G - 240, 220), ...coins(180, G - 130, 5), ...coins(440, G - 210, 5), ...coins(700, G - 290, 5), text(60, G - 180, 'Merdiven: basamak basamak')], { tags: ['platform', 'merdiven'] }),

  // ---------------------------------------------------------------- genel: zor
  chunk('kosu-double-spike', 'kosu', 4, 900, [ground(0, 900), spike(240, 80), spike(600, 80), ...coins(230, G - 160, 4, 36, 30), ...coins(590, G - 160, 4, 36, 30), power(800, G - 70, 'shield')], { tags: ['diken'] }),
  chunk('kosu-hazard-run', 'kosu', 4, 1300, [ground(0, 1300), hanging(200, 120), spike(460, 48), hanging(820, 120), bug(1160, 30), ...coins(200, G - 40, 3), ...coins(400, G - 150, 4, 36, 30), ...coins(820, G - 40, 3), ...coins(1090, G - 130, 5, 36, 40)], { tags: ['karma'] }),
  chunk('kosu-pit-pillars', 'kosu', 4, 1270, [ground(0, 240), ground(370, 200), ground(700, 200), ground(1030, 240), ...coins(220, G - 120, 4, 40, 40), ...coins(550, G - 120, 4, 40, 40), ...coins(880, G - 120, 4, 40, 40)], { tags: ['bosluk'] }),
  chunk('kosu-bakteri-pair', 'kosu', 4, 1100, [ground(0, 1100), bug(300, 40), bug(620, 40), fly(960, 30), ...coins(240, G - 130, 5, 36, 40), ...coins(560, G - 130, 5, 36, 40), ...coins(900, G - 40, 4)], { tags: ['dusman'] }),
  chunk('kosu-ritim', 'kosu', 5, 1200, [ground(0, 1200), spike(200, 80), spike(560, 80), spike(920, 80), ...coins(190, G - 160, 4, 36, 30), ...coins(550, G - 160, 4, 36, 30), ...coins(910, G - 160, 4, 36, 30), text(60, G - 180, 'Ritim: zıpla, zıpla, zıpla')], { tags: ['diken', 'ritim'] }),
  chunk('kosu-gauntlet', 'kosu', 5, 1600, [ground(0, 1600), spike(200, 64), spike(520, 80), hanging(900, 140), bug(1260, 40), ...coins(190, G - 150, 4, 36, 30), ...coins(510, G - 160, 4, 36, 30), ...coins(900, G - 40, 4), ...coins(1200, G - 130, 5, 36, 40), power(1520, G - 70, 'shield')], { tags: ['karma'] }),
  chunk('kosu-leap-of-faith', 'kosu', 5, 1600, [ground(0, 220), plat(360, G - 40, 200, 60), plat(700, G - 80, 200, 100), ground(1040, 560), spike(1300, 48), ...coins(210, G - 120, 4, 40, 40), ...coins(550, G - 160, 4, 40, 40), ...coins(890, G - 200, 4, 40, 40), ...coins(1240, G - 170, 4, 36, 30), power(1480, G - 110, 'magnet')], { tags: ['bosluk', 'platform'] }),

  // ---------------------------------------------------------------- dış kulak: kıl ormanı (tüyler + asılı engel)
  chunk('kosu-dk-tuyler', 'kosu', 2, 800, [ground(0, 800), decor(140, G, 'tuy'), decor(560, G, 'tuy', 1.2), decor(740, G, 'tuy', 0.8), hanging(360, 140, 'tuy'), text(120, G - 180, 'Tüylerin altından kay'), ...coins(340, G - 40, 5), bug(640, 30)], { tags: ['kil-ormani', 'kayma', 'dusman'], biomes: ['dis-kulak'] }),
  chunk('kosu-dk-kivrim', 'kosu', 3, 1150, [ground(0, 1150), decor(80, G, 'tuy'), decor(1080, G, 'tuy', 1.1), plat(200, G - 80, 220), plat(460, G - 160, 220), ...coins(220, G - 130, 5), ...coins(480, G - 210, 5), spike(900, 48), ...coins(860, G - 150, 4, 36, 30)], { tags: ['platform', 'diken'], biomes: ['dis-kulak'] }),
  chunk('kosu-dk-ruzgar', 'kosu', 4, 1200, [ground(0, 1200), decor(120, G, 'tuy', 0.9), decor(700, G, 'tuy'), hanging(200, 120, 'tuy'), spike(520, 64), hanging(880, 120, 'tuy'), fly(1080, 40), ...coins(200, G - 40, 3), ...coins(470, G - 150, 4, 36, 30), ...coins(880, G - 40, 3), text(60, G - 180, 'Rüzgâr: tüylerin altından geç')], { tags: ['kil-ormani', 'karma'], biomes: ['dis-kulak'] }),
  chunk('kosu-dk-gizli', 'kosu', 3, 900, [ground(0, 900), decor(100, G, 'tuy'), decor(820, G, 'tuy', 1.2), plat(240, G - 100, 200), plat(470, G - 200, 200), secret(560, G - 250), ...coins(260, G - 150, 4), ...coins(490, G - 250, 4)], { tags: ['gizli', 'platform'], biomes: ['dis-kulak'] }),

  // ---------------------------------------------------------------- kanal: serumen damlaları (hareketli platform, yapışkan engel) + eskort
  chunk('kosu-kanal-damla', 'kosu', 3, 1100, [ground(0, 300), moving(300, G, 120, 80, 0, 3000), ground(500, 600), text(120, G - 170, 'Damla platformu: üstüne bin'), ...coins(310, G - 100, 5, 40, 30), sticky(900, 64), ...coins(880, G - 150, 4, 36, 30), decor(700, G, 'damla')], { tags: ['moving', 'yapiskan'], biomes: ['kanal'] }),
  chunk('kosu-kanal-yapiskan', 'kosu', 3, 900, [ground(0, 900), sticky(240, 64), sticky(600, 72), ...coins(220, G - 150, 4, 36, 30), ...coins(580, G - 150, 4, 36, 30), text(80, G - 180, 'Serumen yapışkan: üstünden atla'), decor(140, G, 'damla'), decor(800, G, 'damla', 1.2)], { tags: ['yapiskan', 'diken'], biomes: ['kanal'] }),
  chunk('kosu-kanal-asansor', 'kosu', 3, 900, [ground(0, 900), moving(300, G - 90, 120, 0, -80, 4000), ...coins(300, G - 230, 5, 30), sticky(680, 64), ...coins(660, G - 150, 4, 36, 30), text(90, G - 180, 'Serumen damlası yükselir'), decor(820, G, 'damla')], { tags: ['moving', 'yapiskan'], biomes: ['kanal'] }),
  chunk('kosu-kanal-firtina', 'kosu', 5, 1500, [ground(0, 540), sticky(200, 64), ground(680, 820), sticky(860, 72), bug(1200, 40), ...coins(190, G - 150, 4, 36, 30), ...coins(530, G - 120, 4, 40, 40), ...coins(840, G - 150, 4, 36, 30), ...coins(1140, G - 130, 5, 36, 40), decor(760, G, 'damla', 1.1)], { tags: ['karma', 'yapiskan', 'bosluk'], biomes: ['kanal'] }),
  chunk('kosu-kanal-eskort-1', 'kosu', 2, 900, [escortee(40, G - 40), ground(0, 900), text(150, G - 180, 'Fısıltıyı koru: düşmanın üstünden atla'), bug(460, 40), ...coins(380, G - 130, 5, 36, 40), decor(760, G, 'damla')], { tags: ['eskort', 'dusman'], biomes: ['kanal'] }),
  chunk('kosu-kanal-eskort-2', 'kosu', 3, 1000, [escortee(40, G - 40), ground(0, 1000), bug(360, 40), sticky(700, 64), ...coins(280, G - 130, 5, 36, 40), ...coins(680, G - 150, 4, 36, 30), decor(880, G, 'damla', 1.2)], { tags: ['eskort', 'dusman', 'yapiskan'], biomes: ['kanal'] }),
  chunk('kosu-kanal-eskort-3', 'kosu', 4, 1200, [escortee(40, G - 40), ground(0, 1200), bug(300, 40), bug(620, 40), hanging(980, 120, 'serumen'), ...coins(240, G - 130, 5, 36, 40), ...coins(560, G - 130, 5, 36, 40), ...coins(980, G - 40, 3), power(1150, G - 70, 'shield')], { tags: ['eskort', 'dusman', 'kayma'], biomes: ['kanal'] }),

  // ---------------------------------------------------------------- koklea orta kıvrım: ses dalgası platformları, kıl hücresi yayları
  chunk('kosu-k2-tonotopi', 'kosu', 2, 900, [ground(0, 900), plat(160, G - 70, 140), plat(340, G - 130, 140), plat(520, G - 70, 140), plat(700, G - 130, 140), ...coins(170, G - 110, 3), ...coins(350, G - 170, 3), ...coins(530, G - 110, 3), ...coins(710, G - 170, 3), decor(80, G, 'hucre'), decor(860, G, 'hucre')], { tags: ['dalga', 'platform'], biomes: ['koklea-2'] }),
  chunk('kosu-k2-dalga', 'kosu', 3, 1300, [ground(0, 1300), plat(200, G - 80, 200), plat(430, G - 160, 200), plat(660, G - 80, 200), plat(890, G - 160, 200), ...coins(220, G - 130, 4), ...coins(450, G - 210, 4), ...coins(680, G - 130, 4), ...coins(910, G - 210, 4), decor(100, G, 'hucre'), decor(1200, G, 'hucre', 1.2), text(70, G - 180, 'Ses dalgasını izle')], { tags: ['dalga', 'platform'], biomes: ['koklea-2'] }),
  chunk('kosu-k2-tuylu', 'kosu', 4, 1000, [ground(0, 1000), spike(220, 64), ...coins(200, G - 150, 4, 36, 30), plat(500, G - 60, 240, 60), spring(660, G - 60), ...coins(640, G - 320, 6, 40, 60), spike(880, 64), decor(120, G, 'hucre'), decor(420, G, 'hucre', 0.9)], { tags: ['dalga', 'yay', 'diken'], biomes: ['koklea-2'] }),
  chunk('kosu-k2-rezonans', 'kosu', 5, 1500, [ground(0, 1500), hanging(200, 120, 'dalga'), spike(520, 80), plat(840, G - 100, 200), bug(1280, 40), ...coins(200, G - 40, 3), ...coins(500, G - 160, 4, 36, 30), ...coins(860, G - 150, 4), ...coins(1220, G - 130, 5, 36, 40), decor(100, G, 'hucre'), decor(1440, G, 'hucre')], { tags: ['dalga', 'karma'], biomes: ['koklea-2'] }),
];
