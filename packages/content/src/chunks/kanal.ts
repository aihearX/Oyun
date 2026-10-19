import type { ChunkSpec } from '@odi/shared';
import { G, block, chunk, coinCol, coins, collect, decor, enemy, flightArc, ground, hazard, launchArc, launcher, moving, plat, power, secret, wall } from './helpers';
import { curtain } from './ogretici';

/**
 * Kulak Kanalı (6-8, 17, boss 20): serumen tüneli. Duvar zıplaması (6'dan), yapışkan serumen, damla platformları.
 * Duvar kuyusu: sol duvar B havada asılı (altından geçilir), sağ duvar A zemine iner; A'ya değ → dokun → B → dokun → A'nın üstü.
 */
const B = ['kanal'] as const;
const sticky = (x: number, w = 60) => hazard(x, G - 64, w, 72, 'serumen');
const bug = (x: number, dx = 40) => enemy(x, G, 'devriye', dx);
const damla = (x: number, s = 1) => decor(x, G, 'damla', s);
/** iki adımlı duvar kuyusu: x0'dan başlar, ~520 px; çıkış A'nın üstündeki çıkıntıdan zemine iniş */
const shaft = (x0: number, topA = 330) => [wall(x0 + 100, G - topA - 230, topA + 150), wall(x0 + 280, G - topA, topA), plat(x0 + 320, G - topA, 150), ...coinCol(x0 + 200, G - 130, 4, 50)];

export const KANAL_CHUNKS: ChunkSpec[] = [
  chunk('kn-yapiskan', 'kosu', 1, 1000, [ground(0, 1000), sticky(300), sticky(640, 70), ...coins(280, G - 140, 3, 36, 20), ...coins(620, G - 140, 3, 36, 20), damla(120), damla(860, 1.2), secret(470, G - 220), plat(420, G - 150, 120)], { tags: ['yapiskan', 'diken'], biomes: [...B] }),
  chunk('kn-damla-asansor', 'kosu', 2, 1000, [ground(0, 320), moving(340, G - 20, 120, 0, -80, 3000), plat(500, G - 160, 160), ground(700, 300), ...coins(340, G - 100, 3, 40), ...coins(510, G - 220, 4, 40), sticky(820, 56), ...coins(800, G - 140, 3, 36, 20), secret(580, G - 330)], { tags: ['hareketli', 'yapiskan'], biomes: [...B] }),
  chunk('kn-kuyu', 'kosu', 2, 1000, [ground(0, 60), ground(170, 830), ...coins(70, G - 110, 3, 36, 20), ...shaft(160), ...coins(500, G - 370, 3, 40), secret(370, G - 600), ...coins(700, G - 40, 3, 40), sticky(860, 56), damla(80)], { tags: ['duvar'], biomes: [...B], needs: ['duvar'] }),
  chunk('kn-kuyu-yuksek', 'kosu', 3, 1100, [ground(0, 70), ground(190, 910), ...coins(80, G - 110, 3, 36, 20), wall(260, G - 700, 610), wall(440, G - 480, 480), plat(480, G - 480, 160), ...coinCol(350, G - 140, 7, 60), ...coins(500, G - 530, 3, 40), secret(350, G - 620), sticky(850, 56), ...coins(830, G - 140, 3, 36, 20)], { tags: ['duvar'], biomes: [...B], needs: ['duvar'] }),
  chunk('kn-firlatici', 'kosu', 2, 1100, [ground(0, 360), launcher(320, G, 360, -1000), block(560, G - 260, 200, 460), ...coins(380, G - 330, 5, 45, 40), ground(760, 340), sticky(900, 56), ...coins(880, G - 140, 3, 36, 20), secret(660, G - 330), damla(150)], { tags: ['firlatici'], biomes: [...B] }),
  chunk('kn-damla-kopru', 'kosu', 2, 1100, [ground(0, 300), moving(320, G - 30, 110, 0, 50, 1800), moving(520, G - 30, 110, 0, 50, 1800, 0.9), ground(720, 380), ...coins(330, G - 90, 3, 36), ...coins(530, G - 90, 3, 36), bug(900, 40), damla(780, 1.2), secret(500, G - 230)], { tags: ['hareketli', 'bosluk'], biomes: [...B] }),
  chunk('kn-perde', 'kosu', 3, 1200, [ground(0, 1200), curtain(260, 120, 'serumen'), ...coins(270, G - 20, 3, 40), sticky(560, 60), ...coins(540, G - 140, 3, 36, 20), curtain(820, 140, 'serumen'), ...coins(830, G - 20, 4, 36), damla(1120), power(1100, G - 80, 'shield')], { tags: ['yapiskan', 'kayma'], biomes: [...B], needs: ['kayma'] }),
  chunk('kn-kuyu-dusman', 'kosu', 3, 1250, [ground(0, 1250), bug(200, 30), ...shaft(320, 300), plat(620, G - 300, 160), ...coins(640, G - 350, 3, 40), secret(530, G - 580), ...coins(950, G - 140, 3, 36, 20), sticky(970, 56)], { tags: ['duvar', 'dusman'], biomes: [...B], needs: ['duvar'] }),
  chunk('kn-firtina', 'kosu', 3, 1400, [ground(0, 460), sticky(200, 64), ground(600, 800), sticky(860, 64), bug(1160, 40), ...coins(180, G - 140, 3, 36, 20), ...coins(450, G - 120, 3, 40, 30), ...coins(840, G - 140, 3, 36, 20), ...coins(1110, G - 130, 4, 36, 30), damla(700, 1.1), secret(1300, G - 200), plat(1240, G - 130, 120)], { tags: ['karma', 'yapiskan', 'bosluk'], biomes: [...B] }),
  chunk('kn-tunel-gizli', 'kosu', 2, 1100, [ground(0, 1100), block(300, G - 260, 400, 120), sticky(380, 50), sticky(560, 50), ...coins(320, G - 40, 2, 44), ...coins(460, G - 40, 2, 44), ...coins(640, G - 40, 2, 44), secret(650, G - 300), plat(180, G - 150, 100), plat(230, G - 300, 70), sticky(830, 56), ...coins(810, G - 140, 3, 36, 20), collect(500, G - 105)], { tags: ['gizli', 'platform'], biomes: [...B] }),
  chunk('kn-serumen-tepe', 'kosu', 1, 1000, [ground(0, 1000), block(260, G - 50, 120, 50), block(520, G - 90, 140, 90), sticky(780, 56), ...coins(270, G - 100, 3, 40), ...coins(530, G - 140, 3, 40), ...coins(760, G - 140, 3, 36, 20), damla(120), secret(590, G - 260), plat(540, G - 190, 100)], { tags: ['platform', 'yapiskan'], biomes: [...B] }),
  chunk('kn-akinti', 'kosu', 2, 1200, [ground(0, 280), moving(300, G - 20, 120, 200, 0, 3000), ground(640, 140), moving(800, G - 60, 110, 0, -120, 2600, 0.6), ground(960, 240), sticky(1080, 56), ...coins(320, G - 70, 4, 44), ...coins(660, G - 60, 3, 40), ...coins(810, G - 180, 3, 36), secret(860, G - 300), damla(700)], { tags: ['hareketli', 'yapiskan'], biomes: [...B] }),
  chunk('kn-cift-kuyu', 'kosu', 3, 1500, [ground(0, 60), ground(170, 1330), ...shaft(160, 280), ...shaft(700, 330), ...coins(500, G - 330, 3, 40), ...coins(1040, G - 380, 3, 40), secret(900, G - 640), sticky(1300, 56)], { tags: ['duvar'], biomes: [...B], needs: ['duvar'] }),
  // gösteri: Serumen Bacası — üç katlı duvar bacası, damlalar, tepede nota yağmuru ve rüzgârla iniş
  chunk('kn-sp-baca', 'kosu', 3, 1700, [
    ground(0, 1700), wall(240, G - 820, 730), wall(420, G - 640, 640), plat(460, G - 640, 220), ...coinCol(330, G - 140, 9, 60),
    hazard(560, G - 760, 70, 60, 'serumen', { dx: 0, dy: 40, period: 1600 }), ...coins(480, G - 690, 5, 40), collect(640, G - 700), secret(330, G - 760),
    sticky(820, 56), launcher(1050, G, 300, -700), ...launchArc(1050, 300, -700, 6), damla(900, 1.3), sticky(1250, 56), sticky(1450, 56), ...coins(1430, G - 140, 3, 36, 20),
  ], { tags: ['gosteri', 'duvar'], biomes: [...B], setPiece: true, needs: ['duvar'] }),
  // ---- tırmanış odaları (6-10 duvar zıplaması): uzun baca, baca boyunca nota sütunu, sol duvarın tepesinde koklea rafı
  // (sağ duvarın tepesinden çıkmadan önce bir kez daha sola sıçrayan görür), çıkışta nota yağmurlu iniş
  chunk('kn-tirmanis', 'kosu', 3, 1260, [
    ground(0, 60), ground(170, 1090), ...coins(70, G - 110, 3, 36, 20),
    wall(260, G - 1700, 1620), wall(440, G - 1500, 1500), plat(480, G - 1500, 170), plat(160, G - 1700, 100), wall(120, G - 1820, 160),
    ...coinCol(370, G - 200, 13, 105), ...coins(500, G - 1540, 3, 40), ...flightArc(645, G - 1500, 0, 6, { landY: G, from: 0.1, to: 0.85 }), secret(200, G - 1740), sticky(1200, 30),
  ], { tags: ['duvar', 'tirmanis'], biomes: [...B], needs: ['duvar'] }),
  // gösteri: Büyük Baca — dokuz-on zıplamalık serumen bacası, baca boyunca nota sütunu, tepede büyük nota, sol duvarın
  // tepesinde koklea rafı; tepeden notalı serbest düşüş, rüzgârla son sıçrayış
  chunk('kn-sp-buyuk-baca', 'kosu', 3, 1700, [
    ground(0, 60), ground(170, 1530), ...coins(70, G - 110, 3, 36, 20),
    wall(260, G - 1800, 1720), wall(440, G - 1600, 1600), plat(480, G - 1600, 220), collect(600, G - 1650),
    ...coinCol(370, G - 200, 14, 100), ...coins(500, G - 1640, 3, 40), ...flightArc(695, G - 1600, 0, 8, { landY: G, from: 0.08, to: 0.85 }),
    plat(160, G - 1800, 100), wall(120, G - 1920, 160), secret(200, G - 1840),
    sticky(1290, 56), ...coins(1270, G - 140, 3, 36, 20), launcher(1450, G, 300, -760), ...launchArc(1450, 300, -760, 5), damla(1000, 1.3),
  ], { tags: ['gosteri', 'duvar', 'tirmanis'], biomes: [...B], setPiece: true, needs: ['duvar'] }),
];

