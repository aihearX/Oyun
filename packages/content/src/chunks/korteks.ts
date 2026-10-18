import type { ChunkSpec } from '@odi/shared';
import { G, barrier, beat, beatSlide, block, chunk, coinCol, coins, collect, crumble, decor, echo, enemy, grav, ground, hazard, hook, plat, power, secret, spike, spring, trampoline, wall } from './helpers';

/**
 * İşitme Korteksi (37-39, boss 40): sesin anlama dönüştüğü rüya. Tüm yetenekler bir arada; ritim, yankı ve çevirme.
 */
const B = ['korteks'] as const;
const ruya = (x: number, s = 1) => decor(x, G, 'ot', s);
const pulse = (x: number, y: number, w: number, h: number, on: number, off: number, phase = 0) => hazard(x, y, w, h, 'gurultu', { on, off, phase });

export const KORTEKS_CHUNKS: ChunkSpec[] = [
  chunk('kx-ruya-ritim', 'ruya', 4, 1500, [ground(0, 280), beat(300, G, 130, '1100'), beatSlide(500, G - 80, 120, 200, '0011'), beat(860, G - 40, 130, '0110'), ground(1040, 460), plat(1040, G - 300, 300, 40), grav(1040, G - 260, 300, 260), spike(1140, 100), ...coins(310, G - 60, 3, 40), ...coins(520, G - 140, 3, 40), ...coins(870, G - 100, 3, 40), ...coins(1150, G - 230, 3, 40), secret(700, G - 320), collect(1400, G - 80), ruya(1450)], { tags: ['ritim', 'cevir'], biomes: [...B], needs: ['cevir'] }),
  chunk('kx-anlam', 'ruya', 5, 1700, [ground(0, 300), hook(560, G - 300, 190), hazard(320, G - 490, 520, 70), ground(860, 240), echo(1120, G - 20, 130), echo(1300, G - 60, 130), ground(1460, 240), barrier(1560, G - 170, 170), ...coins(460, G - 170, 3, 50, 20), ...coins(1130, G - 80, 3, 40), ...coins(1310, G - 120, 3, 40), secret(940, G - 260), plat(890, G - 180, 110)], { tags: ['kanca', 'yanki'], biomes: [...B], needs: ['darbe'] }),
  chunk('kx-bahce', 'ruya', 4, 1500, [ground(0, 420), crumble(420, G, 50), block(470, G, 450, 60), plat(400, G + 180, 600, 40), spring(960, G + 180, 1.1), ground(1000, 500), secret(700, G + 130), ...coins(560, G + 140, 5, 40), plat(200, G - 150, 140), ...coins(210, G - 200, 3, 40), ...coins(1100, G - 160, 5, 44, 40), spike(1180, 64), ruya(80)], { tags: ['gizli', 'cakil'], biomes: [...B], needs: ['cakil'] }),
  chunk('kx-son-kosu', 'ruya', 5, 1700, [ground(0, 1700), barrier(300, G - 170, 170), spike(560, 48), enemy(800, G, 'kalkanli', 50), pulse(1050, G - 140, 120, 150, 1.0, 1.2, 0.4), enemy(1400, G, 'ziplayan', 0, { hop: 120 }), ...coins(360, G - 60, 3, 40), ...coins(540, G - 130, 3, 36, 20), ...coins(760, G - 150, 3, 40, 20), ...coins(1060, G - 60, 3, 40), ...coins(1360, G - 180, 3, 40, 20), secret(950, G - 260), plat(900, G - 180, 110), power(1600, G - 70, 'life')], { tags: ['karma', 'hiz'], biomes: [...B], needs: ['darbe', 'cakil'] }),
  chunk('kx-zar-kanca', 'ruya', 4, 1600, [ground(0, 280), trampoline(380, G + 60, 200), block(480, G - 260, 220, 460), hook(900, G - 420, 190), ground(1200, 400), hazard(760, G - 640, 360, 60), ...coinCol(380, G - 80, 4, 55), ...coins(500, G - 320, 4, 44), ...coins(860, G - 270, 3, 50, 20), secret(900, G - 520), collect(1350, G - 80)], { tags: ['zar', 'kanca'], biomes: [...B] }),
  chunk('kx-kuyu-cevir', 'ruya', 5, 1500, [ground(0, 60), ground(170, 1330), wall(300, G - 560, 480), wall(480, G - 330, 330), plat(520, G - 330, 160), ...coinCol(390, G - 140, 4, 50), plat(840, G - 300, 460, 40), grav(840, G - 260, 460, 260), spike(920, 100), spike(1140, 80), ...coins(930, G - 230, 3, 40), ...coins(1150, G - 230, 2, 40), secret(390, G - 480)], { tags: ['duvar', 'cevir'], biomes: [...B], needs: ['duvar', 'cevir'] }),
  // gösteri: Ninni Hatırlanıyor — ritimle açılan yol, yankı köprüsü, çevirme ve kancayla son uçuş
  chunk('kx-sp-ninni', 'ruya', 5, 2700, [
    ground(0, 260), beat(290, G, 130, '1100'), beat(480, G - 60, 130, '0110'), beat(670, G, 130, '0011'), ground(840, 300),
    barrier(980, G - 170, 170), echo(1160, G - 20, 130), echo(1340, G - 70, 130), ground(1500, 520), plat(1500, G - 300, 520, 40), grav(1500, G - 260, 520, 260), spike(1600, 100), spike(1840, 100),
    hook(2250, G - 300, 190), hazard(2040, G - 490, 460, 70), ground(2530, 170),
    ...coins(300, G - 60, 3, 40), ...coins(490, G - 120, 3, 40), ...coins(680, G - 60, 3, 40), ...coins(1170, G - 80, 3, 40), ...coins(1350, G - 130, 3, 40), ...coins(1610, G - 230, 3, 40), ...coins(1850, G - 230, 3, 40), ...coins(2160, G - 170, 3, 50, 20),
    collect(940, G - 200), secret(2250, G - 400),
  ], { tags: ['gosteri', 'ritim', 'cevir'], biomes: [...B], setPiece: true, needs: ['darbe', 'cevir'] }),
];
