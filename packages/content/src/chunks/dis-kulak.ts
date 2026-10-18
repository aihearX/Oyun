import type { ChunkSpec } from '@odi/shared';
import { G, block, chunk, coinCol, coins, collect, decor, enemy, ground, hazard, launcher, moving, plat, power, secret, spike, spring } from './helpers';
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
  chunk('dk-basamak', 'kosu', 1, 900, [ground(0, 900), plat(200, G - 90, 180), plat(420, G - 170, 180), ...coins(210, G - 140, 4, 40), ...coins(430, G - 220, 4, 40), ...coins(660, G - 60, 4, 40), secret(510, G - 330), tuy(80), tuy(820, 0.8)], { tags: ['platform', 'jeton'], biomes: [...B] }),
  chunk('dk-ilk-bosluk', 'kosu', 1, 960, [ground(0, 300), ground(410, 250), ground(780, 180), ...coins(290, G - 110, 3, 40, 30), ...coins(650, G - 110, 3, 40, 30), tuy(140, 1.1), secret(560, G - 200), power(860, G - 60, 'magnet')], { tags: ['bosluk'], biomes: [...B] }),
  chunk('dk-bakteri', 'kosu', 1, 980, [ground(0, 980), bug(380, 40), bug(700, 40), ...coins(330, G - 130, 4, 36, 30), ...coins(650, G - 130, 4, 36, 30), tuy(120), tuy(880, 1.2)], { tags: ['dusman'], biomes: [...B] }),
  chunk('dk-yay', 'kosu', 2, 1000, [ground(0, 1000), block(260, G - 60, 220, 60), spring(420, G - 60), ...coinCol(450, G - 160, 4, 45), plat(560, G - 330, 200), ...coins(580, G - 380, 5, 40), secret(740, G - 420), spike(820, 40), ...coins(800, G - 120, 3, 36, 20)], { tags: ['yay', 'jeton'], biomes: [...B] }),
  chunk('dk-ruzgar', 'kosu', 2, 1150, [ground(0, 340), launcher(300, G, 520, -900), ...coins(380, G - 260, 6, 50, 40), ground(820, 330), spike(960, 40), ...coins(940, G - 120, 3, 36, 20), decor(180, G, 'tuy', 1.3), secret(560, G - 420)], { tags: ['firlatici', 'hiz', 'bosluk'], biomes: [...B] }),
  chunk('dk-tepe', 'kosu', 2, 1100, [ground(0, 160), ground(230, 870), block(330, G - 80, 260, 80), block(450, G - 150, 140, 70), ...coins(340, G - 130, 3, 40), ...coins(460, G - 200, 3, 40), spike(640, 48), ...coins(620, G - 130, 3, 36, 20), bug(900, 40), tuy(1040)], { tags: ['platform', 'diken'], biomes: [...B] }),
  chunk('dk-kil-ormani', 'kosu', 2, 1200, [ground(0, 1200), tuy(100, 1.2), curtain(260, 130), ...coins(270, G - 20, 3, 40), bug(560, 40), ...coins(520, G - 130, 3, 36, 30), curtain(820, 160), ...coins(840, G - 20, 4, 36), tuy(1120), secret(470, G - 250), plat(400, G - 170, 140)], { tags: ['kil-ormani', 'kayma', 'dusman'], biomes: [...B], needs: ['kayma'] }),
  chunk('dk-sinek', 'kosu', 3, 1100, [ground(0, 1100), fly(380, 30), ...coins(340, G - 20, 3, 40), spike(620, 48), ...coins(600, G - 130, 3, 36, 20), fly(900, 20), ...coins(880, G - 20, 3, 40), tuy(200, 0.9)], { tags: ['dusman', 'kayma'], biomes: [...B], needs: ['kayma'] }),
  chunk('dk-damla-kopru', 'kosu', 3, 1150, [ground(0, 300), moving(320, G - 40, 140, 120, 0, 3000), ground(640, 510), ...coins(340, G - 90, 6, 40), spike(960, 40), ...coins(940, G - 120, 3, 36, 20), secret(560, G - 230)], { tags: ['hareketli', 'bosluk'], biomes: [...B] }),
  chunk('dk-karma', 'kosu', 3, 1450, [ground(0, 400), ground(530, 920), ...coins(390, G - 120, 3, 40, 30), curtain(700, 120), ...coins(710, G - 20, 3, 40), spike(1000, 48), ...coins(980, G - 130, 3, 36, 20), bug(1250, 40), tuy(80), power(1380, G - 60, 'shield')], { tags: ['karma', 'kayma'], biomes: [...B], needs: ['kayma'] }),
  chunk('dk-gizli-kivrim', 'kosu', 2, 1100, [ground(0, 1100), plat(240, G - 110, 160), plat(450, G - 220, 160), plat(660, G - 330, 140), secret(730, G - 400), ...coins(250, G - 160, 3, 40), ...coins(460, G - 270, 3, 40), collect(700, G - 380), spike(880, 40), ...coins(860, G - 120, 3, 36, 20)], { tags: ['gizli', 'platform'], biomes: [...B] }),
  // gösteri: Kepçe Kıvrımı — yaylar, rüzgâr, kıl perdeleri ve nota nehri boyunca kıvrılan uzun koşu
  chunk('dk-sp-kepce', 'kosu', 2, 2300, [
    ground(0, 500), block(200, G - 70, 300, 70), spring(450, G - 70), ...coinCol(470, G - 170, 3, 45), plat(560, G - 300, 260), ...coins(570, G - 350, 6, 42),
    ground(500, 0 + 400), launcher(860, G, 500, -820), ...coins(920, G - 300, 6, 50, 50), ground(1240, 1060), tuy(1300, 1.4), tuy(1700, 1.1),
    hazard(1460, G - 170, 120, 146, 'tuy'), ...coins(1470, G - 20, 3, 40), bug(1760, 40), ...coins(1720, G - 130, 4, 36, 30), collect(2050, G - 90), secret(700, G - 470),
  ], { tags: ['gosteri', 'yay', 'firlatici'], biomes: [...B], setPiece: true, needs: ['kayma'] }),
];
