import type { ChunkSpec } from '@odi/shared';
import { G, beat, beatSlide, block, chunk, coinCol, coins, collect, decor, enemy, ground, hazard, plat, power, secret, spike, spring, trampoline } from './helpers';

/**
 * Kulak Zarı (9-12): titreyen zar. Süzülme ve zar sıçrayışı (9'dan). Ritim platformları müziğin vuruşuna göre
 * belirir/kaybolur (görsel nabız önceden haber verir); bekleyemezsin, zıplama türüyle (kısa/tam/süzülme) iniş anını seçersin.
 */
const B = ['zar'] as const;
const zar = (x: number, w = 180, power = 1) => trampoline(x, G + 60, w, power);
const hop = (x: number, hop = 100) => enemy(x, G, 'ziplayan', 0, { hop });
const ot = (x: number, s = 1) => decor(x, G, 'ot', s);

export const ZAR_CHUNKS: ChunkSpec[] = [
  chunk('zr-davul', 'trambolin', 1, 1100, [ground(0, 60), ground(170, 130), zar(400, 200), block(500, G - 230, 300, 430), ...coinCol(400, G - 80, 5, 55), ...coins(540, G - 290, 5, 44), ground(800, 300), secret(400, G - 420), ot(100)], { tags: ['zar'], biomes: [...B] }),
  chunk('zr-ritim', 'trambolin', 2, 1150, [ground(0, 300), beat(330, G, 140, '1100'), beat(530, G, 140, '0110'), beat(730, G, 140, '0011'), ground(900, 250), ...coins(340, G - 60, 3, 40), ...coins(540, G - 60, 3, 40), ...coins(740, G - 60, 3, 40), secret(600, G - 240)], { tags: ['ritim'], biomes: [...B] }),
  chunk('zr-suzul-genis', 'trambolin', 2, 1200, [ground(0, 320), ...coins(360, G - 170, 7, 44, 40), ground(700, 140), ...coins(860, G - 150, 5, 44, 30), ground(1060, 140), secret(530, G - 320), hazard(420, G - 470, 200, 60)], { tags: ['suzul', 'bosluk'], biomes: [...B], needs: ['suzul'] }),
  chunk('zr-zincir', 'trambolin', 3, 1500, [ground(0, 260), zar(360, 200), block(460, G - 220, 240, 420), zar(800, 200, 1.15), block(900, G - 400, 260, 600), ...coinCol(360, G - 80, 4, 55), ...coinCol(800, G - 260, 4, 55), ...coins(930, G - 460, 5, 44), ground(1160, 340), secret(1260, G - 200), plat(1200, G - 130, 120)], { tags: ['zar'], biomes: [...B] }),
  chunk('zr-titresim', 'trambolin', 3, 1150, [ground(0, 300), beatSlide(320, G, 120, 180, '1100'), beatSlide(640, G, 120, 160, '0011'), ground(940, 210), ...coins(340, G - 60, 3, 40), ...coins(660, G - 60, 3, 40), secret(620, G - 250)], { tags: ['ritim', 'hareketli'], biomes: [...B] }),
  chunk('zr-yay-tavan', 'trambolin', 2, 1250, [ground(0, 1250), spring(300, G), ...coinCol(320, G - 120, 3, 50), hazard(400, G - 520, 360, 80), plat(400, G - 300, 340), ...coins(420, G - 350, 7, 44), spike(820, 64), ...coins(800, G - 130, 3, 36, 20), hop(1050, 90), collect(570, G - 380), secret(980, G - 260)], { tags: ['yay', 'suzul'], biomes: [...B] }),
  chunk('zr-ziplayan', 'trambolin', 3, 1250, [ground(0, 1250), hop(360, 100), ...coins(320, G - 160, 3, 40, 20), hop(700, 120), ...coins(660, G - 170, 3, 40, 20), spike(950, 48), ...coins(930, G - 130, 3, 36, 20), ot(1150), secret(520, G - 250), plat(470, G - 170, 110)], { tags: ['dusman'], biomes: [...B] }),
  chunk('zr-ritim-koridor', 'trambolin', 3, 1450, [ground(0, 260), beat(290, G - 40, 120, '1010'), beat(470, G - 100, 120, '0101'), beat(650, G - 40, 120, '1010'), beat(830, G - 100, 120, '0101'), beat(1010, G - 40, 120, '1010'), ground(1190, 260), ...coins(300, G - 90, 3, 36), ...coins(480, G - 150, 3, 36), ...coins(660, G - 90, 3, 36), ...coins(840, G - 150, 3, 36), ...coins(1020, G - 90, 3, 36), secret(740, G - 300)], { tags: ['ritim'], biomes: [...B] }),
  chunk('zr-gizli-zar', 'trambolin', 2, 1150, [ground(0, 1150), block(260, G - 40, 200, 40), spike(560, 48), ...coins(540, G - 130, 3, 36, 20), plat(700, G - 120, 120), ...coins(710, G - 170, 3, 36), spring(360, G - 40, 1.3), plat(330, G - 420, 140), secret(400, G - 480), collect(400, G - 300), power(1000, G - 70, 'shield')], { tags: ['gizli', 'yay'], biomes: [...B] }),
  // gösteri: Titreşim Koridoru — vuruşla açılan zarlar, zar sıçrayışı, süzülerek iniş
  chunk('zr-sp-koridor', 'trambolin', 3, 2200, [
    ground(0, 260), beat(290, G, 130, '1100'), beat(480, G - 60, 130, '0110'), zar(720, 200), block(820, G - 260, 220, 460),
    ...coins(300, G - 60, 3, 40), ...coins(490, G - 120, 3, 40), ...coinCol(720, G - 100, 4, 55), ...coins(840, G - 320, 5, 40),
    ...coins(1080, G - 260, 8, 44, 30), beatSlide(1100, G - 120, 120, 200, '1100'), ground(1520, 680), hop(1800, 100), ...coins(1760, G - 170, 3, 40, 20),
    secret(930, G - 470), collect(1300, G - 300),
  ], { tags: ['gosteri', 'ritim', 'zar'], biomes: [...B], setPiece: true, needs: ['suzul'] }),
];
