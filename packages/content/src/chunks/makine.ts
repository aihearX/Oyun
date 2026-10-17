import type { Entity } from '@odi/shared';
import { GROUND_Y as G } from '@odi/shared';
import { chunk, coins, enemy, ground, plat, secret, spike, text, checkpoint, hazard, spring, moving } from './helpers';

/**
 * Makine parçaları (biyom: kemikçikler). Dişli: props.r yarıçap, speed (1 = 4 s'de tur), dir 1 saat yönü / -1 tersi.
 * Kahraman dişlinin çevresinde (r+4) taşınır; dokununca teğet yönde 520 px/s (+140 yukarı) fırlar.
 *   Saat yönü dişli: fırlatma penceresi sol-üst çeyrek (sağa-yukarı). Ters yön: sağ-alt çeyrek.
 *   Menzil: 45° yukarı ≈ 267 px (aynı yükseklik); en yüksek tepe ≈ 155 px (dik yukarı).
 * Zemin: koşu 260 px/s, tek zıplama (tam basılı ≈ 190 px yükseklik, 276 px menzil).
 * Çukurlar: tabanda diken + sağ uçta yay (düşen kahraman kurtulur; ceza: zaman ve can).
 */
const note = (x: number, y: number, idx: number, t: number): Entity => ({ type: 'note', x, y, props: { idx, t } });
const gear = (x: number, y: number, r: number, speed = 1, dir: 1 | -1 = 1): Entity => ({ type: 'gear', x, y, props: { r, speed, dir } });

export const MAKINE_CHUNKS = [
  // ---- nefes
  chunk('mak-rest-1', 'makine', 1, 520, [ground(0, 520), ...coins(160, G - 70, 5)], { rest: true, tags: ['nefes'] }),
  chunk('mak-rest-gear', 'makine', 1, 700, [ground(0, 700), gear(350, G - 300, 40, 0.8, 1), ...coins(280, G - 370, 5, 36, 20), ...coins(300, G - 70, 4)], { rest: true, tags: ['nefes'] }),
  chunk('mak-checkpoint', 'makine', 2, 480, [ground(0, 480), checkpoint(240), ...coins(300, G - 70, 3)], { rest: true, tags: ['checkpoint'] }),

  // ---- öğretici
  chunk('mak-intro', 'makine', 1, 1300, [
    ground(0, 400), text(200, G - 170, 'Dişliye tutun · Dokun: fırla'),
    ground(400, 300, G + 130), spring(676, G + 130, 1.1), gear(480, G - 40, 52, 1, 1),
    ground(700, 600), ...coins(760, G - 80, 4), ...coins(560, G - 180, 3, 36, 20),
  ], { tags: ['ogretici', 'disli'] }),
  chunk('mak-intro-2', 'makine', 2, 1500, [
    ground(0, 300), text(150, G - 170, 'Dişliye tutun · Dokun: fırla'),
    ground(300, 580, G + 140), spike(500, 200, G + 140), spring(856, G + 140, 1.2),
    gear(380, G - 40, 48, 1, 1), gear(620, G - 60, 48, 1, -1), text(700, G - 260, 'Aşağı kaydır: bırak'),
    ground(880, 620), ...coins(940, G - 80, 4), ...coins(500, G - 150, 3, 36, 20),
  ], { tags: ['ogretici', 'disli'] }),

  // ---- normal
  chunk('mak-spring-gap', 'makine', 2, 1500, [
    ground(0, 400), spring(360, G, 1.2), ground(640, 860), ...coins(460, G - 300, 4, 36, 40),
    moving(900, G - 120, 120, 0, -60, 2400), ...coins(900, G - 200, 4), spike(1100, 96), ...coins(1250, G - 80, 3),
  ], { tags: ['yay', 'hareketli'] }),
  chunk('mak-enemy-run', 'makine', 2, 1200, [
    ground(0, 1200), enemy(400, G, 'bakteri', 50), gear(700, G - 50, 44, 1, 1), enemy(1150, G, 'bakteri', 50), ...coins(500, G - 120, 4), ...coins(820, G - 80, 3),
  ], { tags: ['dusman', 'disli'] }),
  chunk('mak-chain-3', 'makine', 3, 1500, [
    ground(0, 300), ground(300, 700, G + 150), spike(450, 450, G + 150), spring(976, G + 150, 1.3),
    gear(380, G - 40, 48, 1.2, 1), gear(600, G - 120, 44, 1.2, -1), gear(820, G - 60, 48, 1, 1),
    ground(1000, 500), ...coins(1060, G - 80, 4), ...coins(480, G - 190, 3, 36, 20), ...coins(700, G - 200, 3, 36, 20),
  ], { tags: ['disli', 'zincir'] }),
  chunk('mak-gear-over-spikes', 'makine', 3, 1400, [
    ground(0, 1400), gear(460, G - 70, 50, 1, 1), spike(500, 120), gear(900, G - 60, 50, 1, -1), spike(1000, 96),
    ...coins(560, G - 200, 4, 36, 30), ...coins(1200, G - 80, 4),
  ], { tags: ['disli', 'diken'] }),
  chunk('mak-movers', 'makine', 3, 1200, [
    ground(0, 300), ground(300, 440, G + 150), spike(400, 200, G + 150), spring(716, G + 150, 1.3),
    moving(380, G - 20, 120, 100, 0, 3000), ...coins(400, G - 120, 5), ground(740, 460), ...coins(820, G - 80, 4),
  ], { tags: ['hareketli'] }),
  chunk('mak-gizli', 'makine', 3, 1400, [
    ground(0, 1400), spike(420, 200), gear(520, G - 140, 56, 1, 1), secret(460, G - 290), ...coins(700, G - 90, 4), ...coins(1000, G - 80, 3),
  ], { tags: ['gizli', 'disli', 'diken'] }),
  chunk('mak-melody', 'makine', 3, 1400, [
    ground(0, 300), ground(300, 520, G + 160), spike(450, 110, G + 160), spring(796, G + 160, 1.3),
    gear(400, G - 30, 50, 1, 1), gear(620, G - 70, 44, 1, -1), ground(820, 580),
    note(200, G - 50, 0, 0.05), note(454, G - 30, 1, 0.2), note(400, G + 24, 2, 0.35), note(572, G - 70, 3, 0.5), note(620, G - 22, 4, 0.65), note(900, G - 50, 5, 0.8), note(1000, G - 50, 6, 0.95),
  ], { tags: ['melodi', 'disli'] }),
  chunk('mak-double-chain', 'makine', 4, 1600, [
    ground(0, 300), ground(300, 900, G + 160), spike(420, 680, G + 160), spring(1176, G + 160, 1.3),
    gear(380, G - 40, 48, 1.3, 1), gear(600, G - 100, 40, 1.3, -1), gear(800, G - 40, 48, 1.3, 1), gear(1020, G - 100, 40, 1.3, -1),
    ground(1200, 400), ...coins(1260, G - 80, 4), ...coins(480, G - 170, 3, 36, 20), ...coins(900, G - 170, 3, 36, 20),
  ], { tags: ['disli', 'zincir'] }),
  chunk('mak-spike-timing', 'makine', 4, 1500, [
    ground(0, 1500), gear(400, G - 60, 50, 1, 1), spike(470, 160), hazard(540, G - 260, 100, 60), gear(900, G - 60, 50, 1, -1), spike(790, 64), spike(980, 128),
    ...coins(560, G - 160, 4, 36, 20), ...coins(1250, G - 80, 4),
  ], { tags: ['disli', 'diken'] }),
  chunk('mak-pit-spikes', 'makine', 4, 1600, [
    ground(0, 300), ground(300, 340, G + 150), spike(340, 200, G + 150), spring(616, G + 150, 1.2), gear(380, G - 30, 48, 1, 1),
    ground(640, 160), ...coins(660, G - 80, 3), ground(800, 300, G + 150), spike(820, 180, G + 150), spring(1076, G + 150, 1.2), gear(880, G, 48, 1, -1),
    ground(1100, 500), ...coins(1180, G - 80, 4),
  ], { tags: ['disli', 'cukur', 'diken'] }),
  chunk('mak-tower-launch', 'makine', 5, 1600, [
    ground(0, 300), ground(300, 600, G + 170), spike(340, 520, G + 170), spring(876, G + 170, 1.4),
    gear(380, G - 40, 48, 1.4, 1), gear(560, G - 150, 40, 1.4, -1), gear(760, G - 150, 40, 1.4, 1), hazard(450, G - 280, 80, 50),
    plat(900, G - 120, 300), ...coins(960, G - 170, 4), ground(1200, 400), ...coins(1300, G - 80, 3),
  ], { tags: ['disli', 'zincir', 'platform'] }),
  chunk('mak-gear-stairs', 'makine', 5, 1700, [
    ground(0, 300), ground(300, 780, G + 180), spike(340, 700, G + 180), spring(1056, G + 180, 1.0),
    gear(380, G - 30, 44, 1.5, 1), gear(560, G - 110, 40, 1.5, -1), gear(740, G - 170, 40, 1.5, 1), gear(920, G - 250, 40, 1.5, -1),
    ground(1080, 620), plat(1080, G - 200, 300), ...coins(1120, G - 250, 4), ...coins(1450, G - 80, 4),
  ], { tags: ['disli', 'zincir', 'platform'] }),
];
