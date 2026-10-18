import type { ChunkSpec } from '@odi/shared';
import { G, block, chunk, coins, collect, decor, enemy, flightArc, ground, hazard, jumpArc, launchArc, launcher, moving, plat, power, secret, spike, spring } from './helpers';
import { curtain } from './ogretici';

/**
 * Dış Kulak (bölüm 1-5): ten, kıvrımlar, kıllar. Yetenekler: zıpla (+ kayma 3'ten). Rüzgâr esintisi (fırlatıcı), kıl yayları.
 * Zıplama: dokun ≈ 69 px yüksek / 117 px ileri, tam basılı ≈ 158 px / 221 px. Boşluk ≤ 150, engel sonrası ≥ 150 px nefes.
 */
const B = ['dis-kulak'] as const;
const bug = (x: number, dx = 40) => enemy(x, G, 'devriye', dx);
const fly = (x: number, dx = 40) => enemy(x, G - 30, 'ucan', dx, { amp: 6 });
const tuy = (x: number, s = 1) => decor(x, G, 'tuy', s);

export const DIS_KULAK_CHUNKS: ChunkSpec[] = [
  // basamak: alt yolda kıl dikenleri (kısa zıplama), üst yolda notalı basamaklar (risk yolu)
  chunk('dk-basamak', 'kosu', 1, 900, [ground(0, 900), plat(200, G - 95, 170), plat(420, G - 175, 170), spike(260, 40), spike(490, 48), ...coins(215, G - 135, 4, 40), ...coins(435, G - 215, 4, 40), ...coins(640, G - 40, 3, 40), spike(780, 36), ...jumpArc(677, 4, 1), secret(510, G - 340), tuy(80)], { tags: ['platform', 'jeton', 'risk'], biomes: [...B] }),
  chunk('dk-ilk-bosluk', 'kosu', 1, 960, [ground(0, 300), ground(410, 250), ground(780, 180), ...jumpArc(244, 5, 1), ...jumpArc(615, 5, 1), tuy(140, 1.1), secret(560, G - 230), power(880, G - 60, 'magnet')], { tags: ['bosluk', 'yay-odul'], biomes: [...B] }),
  chunk('dk-bakteri', 'kosu', 1, 980, [ground(0, 980), bug(380, 40), bug(700, 40), ...jumpArc(259, 5, 1), ...jumpArc(579, 5, 1), spike(900, 36), tuy(120)], { tags: ['dusman', 'yay-odul'], biomes: [...B] }),
  chunk('dk-yay', 'kosu', 2, 1000, [ground(0, 1000), block(260, G - 60, 220, 60), spring(420, G - 60, 1.15), ...flightArc(412, G - 60, 1035, 4, { to: 0.4 }), plat(560, G - 330, 200), ...coins(580, G - 370, 5, 40), secret(740, G - 450), spike(820, 40), ...coins(800, G - 120, 3, 36, 20)], { tags: ['yay', 'jeton', 'risk'], biomes: [...B] }),
  chunk('dk-ruzgar', 'kosu', 2, 1150, [ground(0, 340), spike(160, 36), launcher(300, G, 520, -900), ...launchArc(300, 520, -900, 7), ground(820, 330), spike(960, 40), ...coins(940, G - 120, 3, 36, 20), decor(80, G, 'tuy', 1.3), secret(560, G - 440)], { tags: ['firlatici', 'hiz', 'bosluk'], biomes: [...B] }),
  chunk('dk-tepe', 'kosu', 2, 1100, [ground(0, 160), ground(230, 870), block(330, G - 80, 260, 80), block(450, G - 150, 140, 70), ...coins(340, G - 130, 3, 40), ...coins(460, G - 200, 3, 40), spike(640, 48), ...coins(620, G - 130, 3, 36, 20), bug(900, 40), tuy(1040)], { tags: ['platform', 'diken'], biomes: [...B] }),
  chunk('dk-kil-ormani', 'kosu', 2, 1200, [ground(0, 1200), tuy(100, 1.2), curtain(260, 130), ...coins(270, G - 20, 3, 40), bug(560, 40), ...coins(520, G - 130, 3, 36, 30), curtain(820, 160), ...coins(840, G - 20, 4, 36), tuy(1120), secret(470, G - 250), plat(400, G - 170, 140)], { tags: ['kil-ormani', 'kayma', 'dusman'], biomes: [...B], needs: ['kayma'] }),
  chunk('dk-sinek', 'kosu', 3, 1100, [ground(0, 1100), fly(380, 30), ...coins(340, G - 20, 3, 40), spike(620, 48), ...coins(600, G - 130, 3, 36, 20), fly(900, 20), ...coins(880, G - 20, 3, 40), tuy(200, 0.9)], { tags: ['dusman', 'kayma'], biomes: [...B], needs: ['kayma'] }),
  chunk('dk-damla-kopru', 'kosu', 3, 1150, [ground(0, 300), moving(320, G - 40, 140, 120, 0, 3000), ground(640, 510), ...coins(340, G - 90, 6, 40), spike(960, 40), ...coins(940, G - 120, 3, 36, 20), secret(560, G - 230)], { tags: ['hareketli', 'bosluk'], biomes: [...B] }),
  chunk('dk-karma', 'kosu', 3, 1450, [ground(0, 400), ground(530, 920), ...coins(390, G - 120, 3, 40, 30), curtain(700, 120), ...coins(710, G - 20, 3, 40), spike(1000, 48), ...coins(980, G - 130, 3, 36, 20), bug(1250, 40), tuy(80), power(1380, G - 60, 'shield')], { tags: ['karma', 'kayma'], biomes: [...B], needs: ['kayma'] }),
  chunk('dk-gizli-kivrim', 'kosu', 2, 1100, [ground(0, 1100), plat(240, G - 110, 160), plat(450, G - 220, 160), plat(660, G - 330, 140), spike(300, 40), spike(520, 56), secret(730, G - 410), ...coins(255, G - 150, 3, 40), ...coins(465, G - 260, 3, 40), collect(700, G - 380), spike(880, 40), ...coins(860, G - 120, 3, 36, 20)], { tags: ['gizli', 'platform', 'risk'], biomes: [...B] }),
  // gösteri: Kepçe Kıvrımı — yaylar, rüzgâr, kıl perdeleri ve nota nehri boyunca kıvrılan uzun koşu
  chunk('dk-sp-kepce', 'kosu', 2, 2300, [
    ground(0, 500), block(200, G - 70, 300, 70), spring(450, G - 70, 1.1), ...flightArc(442, G - 70, 990, 3, { to: 0.4 }), plat(540, G - 300, 110), ...coins(550, G - 340, 3, 42),
    ground(500, 0 + 400), spike(790, 30), launcher(872, G, 500, -820), ...launchArc(872, 500, -820, 7), ground(1240, 1060), tuy(1300, 1.4), tuy(1700, 1.1),
    hazard(1420, G - 170, 120, 146, 'tuy'), ...coins(1430, G - 20, 3, 40), bug(1760, 40), ...jumpArc(1640, 5, 1), collect(2050, G - 90), spike(2180, 40), secret(700, G - 480),
  ], { tags: ['gosteri', 'yay', 'firlatici'], biomes: [...B], setPiece: true, needs: ['kayma'] }),
  // gösteri: Heliks Tırmanışı — kepçenin kıvrımı boyunca yükselen raflar; her rafın altı dikenli, tam basılı yaylar nota taşır,
  // yaylar seni üst kıvrıma atar; 1. bölümden itibaren (yalnız zıplama)
  chunk('dk-sp-heliks', 'kosu', 2, 2200, [
    ground(0, 2200), spike(200, 40), ...jumpArc(99, 5, 1), plat(320, G - 110, 150), plat(520, G - 200, 150), plat(720, G - 290, 150), spike(380, 48), spike(600, 56), spike(820, 56),
    ...coins(335, G - 150, 3, 40), ...coins(535, G - 240, 3, 40), ...coins(735, G - 330, 3, 40), collect(900, G - 400),
    spring(1000, G, 1.25), ...flightArc(992, G, 1125, 4, { to: 0.4 }), plat(1080, G - 420, 220), ...coins(1100, G - 460, 5, 40), spike(1180, 72),
    spike(1420, 56), ...jumpArc(1327, 5, 1), bug(1650, 40), ...jumpArc(1530, 5, 1), spike(1880, 48), ...jumpArc(1783, 5, 1), tuy(2100, 1.3),
    secret(1190, G - 560),
  ], { tags: ['gosteri', 'platform', 'yay', 'risk'], biomes: [...B], setPiece: true }),
];
