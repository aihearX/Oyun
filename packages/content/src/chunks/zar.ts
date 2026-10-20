import type { ChunkSpec } from '@odi/shared';
import { G, beat, beatSlide, block, chunk, coin, coins, collect, decor, enemy, flightArc, glideArc, ground, hazard, jumpArc, plat, power, secret, spike, spring, trampArc, trampoline } from './helpers';

/**
 * Kulak Zarı (9-12): titreyen zar. Süzülme ve zar sıçrayışı (9'dan). Ritim platformları müziğin vuruşuna göre
 * belirir/kaybolur (görsel nabız önceden haber verir); bekleyemezsin, zıplama türüyle (kısa/tam/süzülme) iniş anını seçersin.
 * Zar: değme anında dokun → güçlü sıçrayış (geçmek için gerekir); değme anına çok yakın dokunuş → "Mükemmel" (×1,12, yalnız
 * tepedeki ödül notaları ve gizli koklealar için); vuruşta nabız atan zar (beat) vuruşa denk gelen sıçrayışı ×1,1 yükseltir.
 * Zar zincirlerinde her blok bir öncekinden yüksektir: Mükemmel + süzülme bir sonraki zarı atlatamaz (zar biyomun kalbi).
 */
const B = ['zar'] as const;
/** çukurdaki zar (çukurun tabanı zar) */
const zar = (x: number, w = 180, power = 1, extra: Record<string, number | string | boolean> = {}) => trampoline(x, G + 60, w, power, extra);
const hop = (x: number, hop = 100) => enemy(x, G, 'ziplayan', 0, { hop });
const ot = (x: number, s = 1) => decor(x, G, 'ot', s);

export const ZAR_CHUNKS: ChunkSpec[] = [
  chunk('zr-davul', 'trambolin', 1, 1100, [ground(0, 60), ground(170, 130), zar(400, 200), block(500, G - 230, 300, 430), ...trampArc(345, 5), ...coins(540, G - 280, 5, 44), ground(800, 300), spike(950, 40), ...jumpArc(849, 4, 0.6), secret(420, G - 480), ot(100)], { tags: ['zar'], biomes: [...B] }),
  chunk('zr-ritim', 'trambolin', 2, 1150, [ground(0, 300), beat(330, G, 140, '1110'), beat(530, G, 140, '0111'), beat(730, G, 140, '1011'), ground(900, 250), ...coins(340, G - 40, 3, 40), ...coins(540, G - 40, 3, 40), ...coins(740, G - 40, 3, 40), spike(1030, 36), secret(600, G - 240)], { tags: ['ritim'], biomes: [...B] }),
  chunk('zr-suzul-genis', 'trambolin', 2, 1200, [ground(0, 320), ...glideArc(300, 7, 380), ground(700, 140), ...glideArc(820, 5, 240), ground(1060, 140), secret(530, G - 330), hazard(420, G - 470, 200, 60)], { tags: ['suzul', 'bosluk'], biomes: [...B], needs: ['suzul'] }),
  // zincir: iki zar, ikinci blok daha yüksek (ikinci zar daha güçlü)
  chunk('zr-zincir', 'trambolin', 3, 1500, [ground(0, 260), zar(400, 120), block(460, G - 220, 240, 420), zar(800, 200, 1.2), block(900, G - 420, 260, 620), ...trampArc(312, 4), ...trampArc(712, 5, { power: 1.2 }), ...coins(930, G - 470, 5, 44), ground(1160, 340), spike(1300, 40), secret(800, G - 640), plat(1200, G - 130, 80)], { tags: ['zar', 'zincir'], biomes: [...B] }),
  chunk('zr-titresim', 'trambolin', 3, 1150, [ground(0, 300), beatSlide(320, G, 120, 180, '1100'), beatSlide(640, G, 120, 160, '0011'), ground(940, 210), ...coins(340, G - 40, 3, 40), ...coins(660, G - 40, 3, 40), spike(1040, 36), secret(620, G - 250)], { tags: ['ritim', 'hareketli'], biomes: [...B] }),
  chunk('zr-yay-tavan', 'trambolin', 2, 1250, [ground(0, 1250), spike(170, 40), spring(300, G, 1.2), ...flightArc(292, G, 1080, 3, { to: 0.32 }), hazard(400, G - 540, 360, 80), plat(400, G - 300, 340), ...coins(420, G - 340, 7, 44), spike(820, 64), ...coins(800, G - 130, 3, 36, 20), spike(1000, 40), hop(1170, 90), collect(570, G - 400), secret(960, G - 270)], { tags: ['yay', 'suzul'], biomes: [...B] }),
  chunk('zr-ziplayan', 'trambolin', 3, 1250, [ground(0, 1250), hop(360, 100), ...jumpArc(240, 4, 1), hop(700, 120), ...jumpArc(580, 4, 1), spike(950, 48), ...coins(930, G - 130, 3, 36, 20), ot(1150), secret(520, G - 260), plat(470, G - 170, 110)], { tags: ['dusman'], biomes: [...B] }),
  chunk('zr-ritim-koridor', 'trambolin', 3, 1450, [ground(0, 260), beat(290, G - 40, 120, '1110'), beat(470, G - 100, 120, '1011'), beat(650, G - 40, 120, '1110'), beat(830, G - 100, 120, '1011'), beat(1010, G - 40, 120, '1110'), ground(1190, 260), ...coins(300, G - 80, 3, 36), ...coins(480, G - 140, 3, 36), ...coins(660, G - 80, 3, 36), ...coins(840, G - 140, 3, 36), ...coins(1020, G - 80, 3, 36), spike(1330, 36), secret(740, G - 300)], { tags: ['ritim', 'sinav'], biomes: [...B] }),
  chunk('zr-gizli-zar', 'trambolin', 2, 1150, [ground(0, 1150), block(260, G - 40, 200, 40), spike(560, 48), ...coins(540, G - 130, 3, 36, 20), plat(700, G - 120, 120), ...coins(710, G - 160, 3, 36), spring(360, G - 40, 1.3), plat(330, G - 420, 140), secret(400, G - 480), collect(400, G - 300), spike(900, 40), ...jumpArc(799, 4, 0.6), power(1050, G - 70, 'shield')], { tags: ['gizli', 'yay', 'risk'], biomes: [...B] }),
  // ritim merdiveni: alt yol dikenli (kısa zıplamalar), üst yol vuruşla beliren basamaklar → notalı raf (risk yolu)
  chunk('zr-ritim-merdiven', 'trambolin', 2, 1300, [ground(0, 1300), spike(330, 48), spike(560, 56), beat(260, G - 70, 130, '1110'), beat(440, G - 150, 130, '0111'), beat(620, G - 230, 130, '1011'), plat(800, G - 230, 200), ...coins(270, G - 100, 3, 40), ...coins(450, G - 180, 3, 40), ...coins(630, G - 260, 3, 40), ...coins(820, G - 260, 4, 44), secret(900, G - 410), spike(780, 48), spike(1120, 48), ...coins(1100, G - 130, 3, 36, 20)], { tags: ['ritim', 'platform', 'risk', 'sinav'], biomes: [...B] }),
  chunk('zr-yay-zar', 'trambolin', 3, 1400, [ground(0, 660), spring(300, G, 1.2), ...flightArc(292, G, 1080, 3, { to: 0.32 }), plat(380, G - 330, 160), ...coins(390, G - 370, 4, 40), zar(760, 200), block(860, G - 220, 200, 420), ground(1060, 340), ...trampArc(705, 5), hop(1200, 100), ...jumpArc(1080, 4, 1), secret(460, G - 480), collect(950, G - 300)], { tags: ['yay', 'zar'], biomes: [...B] }),
  // ---- yeni: zar zincirleri ve "Mükemmel" merdiveni
  // üçlü zincir: her zar bir öncekinden güçlü, her blok daha yüksek; tepede notalı raf, Mükemmel'e koklea
  chunk('zr-zincir-uclu', 'trambolin', 3, 1500, [
    ground(0, 150), zar(230, 140), block(310, G - 180, 120, 380), zar(510, 140, 1.15), block(590, G - 340, 140, 540), zar(810, 140, 1.3), block(890, G - 500, 260, 700), ground(1150, 350),
    ...trampArc(198, 4), ...trampArc(482, 4, { power: 1.15 }), ...trampArc(780, 4, { power: 1.3 }), ...coins(910, G - 540, 3, 44), spike(1040, 36, G - 500), ...coins(1080, G - 540, 2, 44), spike(1300, 40), ...jumpArc(1199, 3, 0.6),
    // koklea: yalnız üçüncü zarda Mükemmel sıçrayıp tepeden süzülen bu yüksek rafa konar
    plat(1150, G - 700, 80), secret(1190, G - 740),
  ], { tags: ['zar', 'zincir'], biomes: [...B] }),
  // Mükemmel merdiveni: alçak bloklar güçlü sıçrayışla geçilir; tepelerdeki yükselen nota basamakları yalnız Mükemmel sıçrayışa
  chunk('zr-mukemmel-merdiven', 'trambolin', 3, 1400, [
    ground(0, 150), zar(230, 140), block(310, G - 150, 130, 350), zar(520, 140, 1.06), block(600, G - 150, 130, 350), zar(810, 140, 1.12), block(890, G - 150, 260, 350), ground(1150, 250),
    ...trampArc(198, 3), ...trampArc(198, 3, { perfect: true, from: 0.42, to: 0.56 }),
    ...trampArc(488, 3, { power: 1.06 }), ...trampArc(488, 3, { power: 1.06, perfect: true, from: 0.42, to: 0.56 }),
    ...trampArc(778, 3, { power: 1.12 }), ...trampArc(778, 3, { power: 1.12, perfect: true, from: 0.42, to: 0.56 }),
    spike(1270, 40), secret(1010, G - 300),
  ], { tags: ['zar', 'zincir', 'risk'], biomes: [...B] }),
  // vuruş zarları: müziğin vuruşunda esneyen iki zar; vuruşa denk gelen sıçrayış üst nota rafına yetişir
  chunk('zr-vurus-zarlari', 'trambolin', 2, 1250, [
    ground(0, 150), zar(230, 140, 1, { beat: true }), block(310, G - 200, 200, 400), zar(590, 140, 1, { beat: true }), block(670, G - 200, 200, 400), ground(870, 380),
    ...trampArc(198, 4), ...trampArc(198, 2, { power: 1.1, from: 0.46, to: 0.54 }), ...trampArc(558, 4), ...trampArc(558, 2, { power: 1.1, from: 0.46, to: 0.54 }),
    hop(1040, 90), ...jumpArc(920, 4, 1), spike(1190, 40), secret(760, G - 470), ot(1120),
  ], { tags: ['zar', 'ritim'], biomes: [...B] }),
  // gösteri: Titreşim Koridoru — vuruşla açılan yol, üç zar (biri vuruşta), yüksekten süzülüş, zıplayan bekçi
  chunk('zr-sp-koridor', 'trambolin', 3, 2400, [
    ground(0, 260), beat(290, G, 130, '1110'), beat(470, G - 50, 130, '0111'), ground(640, 120),
    zar(840, 140), block(920, G - 220, 160, 420), zar(1160, 140, 1.15, { beat: true }), block(1240, G - 380, 180, 580),
    beatSlide(1560, G - 140, 120, 160, '1100'), ground(1800, 600), hop(1980, 100), spike(2200, 48),
    ...coins(300, G - 40, 3, 40), ...coins(480, G - 90, 3, 40), ...trampArc(808, 4), ...trampArc(1128, 4, { power: 1.15 }), ...coins(1260, G - 420, 4, 40),
    ...glideArc(1420, 7, 380, G - 380), ...jumpArc(1860, 4, 1), ...coins(2180, G - 130, 3, 36, 20),
    secret(1330, G - 610), collect(1600, G - 230),
  ], { tags: ['gosteri', 'ritim', 'zar'], biomes: [...B], setPiece: true, needs: ['suzul'] }),
  // gösteri: Zar Senfonisi — dört zarlık yükselen zincir (ikisi vuruşta), en tepeden süzülerek nota nehrine iniş
  chunk('zr-sp-senfoni', 'trambolin', 3, 2300, [
    ground(0, 150), zar(230, 140), block(310, G - 180, 140, 380), zar(530, 140, 1.1, { beat: true }), block(610, G - 320, 140, 520),
    zar(830, 140, 1.2), block(910, G - 440, 140, 640), zar(1130, 140, 1.3, { beat: true }), block(1210, G - 560, 200, 760), ground(1410, 890),
    ...trampArc(198, 3), ...trampArc(498, 3, { power: 1.1 }), ...trampArc(798, 3, { power: 1.2 }), ...trampArc(1098, 3, { power: 1.3 }),
    ...glideArc(1380, 8, 600, G - 560), hop(1900, 100), ...jumpArc(1780, 4, 1), spike(2140, 48), ...coins(2120, G - 130, 3, 36, 20),
    secret(1300, G - 820), collect(1250, G - 620),
  ], { tags: ['gosteri', 'zar', 'zincir'], biomes: [...B], setPiece: true, needs: ['suzul'] }),
];
void coin;
