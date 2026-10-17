import type { Entity } from '@odi/shared';
import { GROUND_Y as G } from '@odi/shared';
import { chunk, coins, enemy, ground, plat, secret, spike, text, checkpoint, hazard, trampoline, spring } from './helpers';

/**
 * Trambolin parçaları (biyom: zar; 18. ve 29. bölümlerde kemikçikler/koklea-3).
 * Fizik: yatay 260 px/s, sıçrama 900×power (mükemmel ×1.45), yerçekimi 1400.
 *   Aynı yüksekliğe menzil: normal 334·p px, mükemmel 485·p px; tepe 289·p² / 608·p².
 *   Yürüyerek temas: zar merkezinin 81 px solunda (zar w=128). Örnek (p=1): normal iniş tx+253, mükemmel tx+404.
 * Kurallar: her dalın (normal VE mükemmel) inişi güvenli; parçanın ilk 200 px'i düz zemin;
 *   son zar merkezi ≤ uzunluk−380 (mükemmel iniş parça içinde ya da bir sonrakinin düz girişinde).
 */
const note = (x: number, y: number, idx: number, t: number): Entity => ({ type: 'note', x, y, props: { idx, t } });
const T = (x: number, p: number, y = G) => trampoline(x, y, 128, p);

export const TRAMBOLIN_CHUNKS = [
  // ---- nefes
  chunk('tram-rest-1', 'trambolin', 1, 520, [ground(0, 520), ...coins(160, G - 70, 5)], { rest: true, tags: ['nefes'] }),
  chunk('tram-rest-2', 'trambolin', 1, 640, [ground(0, 640), T(240, 0.8), ...coins(250, G - 150, 3, 36, 30)], { rest: true, tags: ['nefes'] }),
  chunk('tram-checkpoint', 'trambolin', 2, 480, [ground(0, 480), checkpoint(240), ...coins(300, G - 70, 3)], { rest: true, tags: ['checkpoint'] }),

  // ---- öğretici
  chunk('tram-intro', 'trambolin', 1, 1300, [
    ground(0, 1300), text(170, G - 170, 'Zara değince dokun'), T(320, 1.0),
    ...coins(340, G - 235, 4, 36, 50), text(640, G - 170, 'Tam anında: Mükemmel!'), T(880, 1.0), ...coins(900, G - 235, 4, 36, 50),
  ], { tags: ['ogretici'] }),
  chunk('tram-intro-2', 'trambolin', 2, 1200, [
    ground(0, 400), text(200, G - 170, 'Basılı tut: süzül · Aşağı kaydır: dal'),
    ground(400, 300, G + 120), T(636, 1.1, G + 120), ...coins(500, G + 60, 3),
    ground(700, 500), ...coins(786, G - 600, 3, 36, 20), ...coins(880, G - 120, 3),
    note(560, G + 70, 0, 0.2), note(960, G - 60, 1, 0.5), note(1060, G - 60, 2, 0.8),
  ], { tags: ['ogretici', 'cukur'] }),

  // ---- normal
  chunk('tram-spikes-1', 'trambolin', 2, 1200, [
    ground(0, 1200), T(300, 1.0), spike(400, 96), ...coins(380, G - 250, 4, 36, 40),
    T(760, 1.0), spike(860, 96), ...coins(840, G - 250, 4, 36, 40),
  ], { tags: ['diken'] }),
  chunk('tram-pit-1', 'trambolin', 2, 1450, [
    ground(0, 300), ground(300, 260, G + 100), T(496, 1.0, G + 100), ...coins(440, G + 40, 3),
    ground(560, 300), ...coins(600, G - 80, 4), ground(860, 260, G + 100), T(1056, 1.0, G + 100), ...coins(1000, G + 40, 3),
    ground(1120, 330), ...coins(1200, G - 80, 3),
  ], { tags: ['cukur'] }),
  chunk('tram-ridge', 'trambolin', 3, 1500, [
    ground(0, 1500), T(300, 1.2), plat(560, G - 120, 200), spike(600, 128), ...coins(580, G - 170, 4),
    ...coins(380, G - 320, 3, 36, 40), T(1000, 1.0), spike(1080, 96), ...coins(1060, G - 250, 4, 36, 40),
  ], { tags: ['platform', 'diken'] }),
  chunk('tram-double', 'trambolin', 3, 1500, [
    ground(0, 1500), T(300, 0.9), spike(380, 96), T(560, 1.2), T(700, 1.0), spike(780, 96),
    ...coins(360, G - 200, 3, 36, 30), ...coins(640, G - 360, 4, 36, 40), ...coins(1000, G - 80, 4),
  ], { tags: ['zincir', 'diken'] }),
  chunk('tram-melody', 'trambolin', 3, 1700, [
    ground(0, 1700), T(260, 1.0), spike(400, 64), T(560, 1.0), T(900, 1.0), T(1230, 1.0),
    note(346, G - 305, 0, 0.1), note(680, G - 305, 1, 0.3), note(1014, G - 305, 2, 0.5), note(1348, G - 305, 3, 0.7), note(1600, G - 60, 4, 0.9),
  ], { tags: ['melodi', 'zincir'] }),
  chunk('tram-gizli-1', 'trambolin', 3, 1500, [
    ground(0, 1500), T(400, 1.2), spike(480, 96), secret(610, G - 870), ...coins(560, G - 400, 4, 36, 40),
    T(1000, 1.0), spike(1080, 128), ...coins(1060, G - 250, 4, 36, 40),
  ], { tags: ['gizli', 'diken'] }),
  chunk('tram-enemy', 'trambolin', 3, 1400, [
    ground(0, 1400), T(260, 1.0), enemy(420, G, 'bakteri', 40), ...coins(340, G - 250, 4, 36, 40),
    T(760, 1.0), enemy(900, G, 'sinek', 40), ...coins(840, G - 250, 4, 36, 40),
  ], { tags: ['dusman'] }),
  chunk('tram-stairs', 'trambolin', 4, 1800, [
    ground(0, 1800), T(220, 1.1), plat(400, G - 160, 300), spike(420, 128), note(500, G - 200, 0, 0.2), note(650, G - 200, 1, 0.4),
    ...coins(760, G - 80, 3), T(1000, 1.3), plat(1200, G - 240, 400), spike(1250, 160), note(1350, G - 280, 2, 0.6), note(1500, G - 280, 3, 0.8),
  ], { tags: ['platform', 'diken'] }),
  chunk('tram-gauntlet', 'trambolin', 4, 1500, [
    ground(0, 1500), T(300, 1.0), hazard(356, G - 430, 60, 50), spike(380, 96), ...coins(340, G - 250, 4, 36, 40),
    T(760, 1.0), spike(860, 96), hazard(816, G - 430, 60, 50), ...coins(800, G - 250, 4, 36, 40), ...coins(1200, G - 80, 4),
  ], { tags: ['karma', 'diken'] }),
  chunk('tram-choice', 'trambolin', 4, 1700, [
    ground(0, 540), T(300, 1.1), ...coins(380, G - 320, 4, 36, 40), ground(540, 160, G + 100), T(636, 1.0, G + 100),
    ground(700, 1000), T(1000, 1.2), spike(1100, 160), ...coins(1080, G - 380, 4, 36, 40),
  ], { tags: ['cukur', 'diken'] }),
  chunk('tram-long-pit', 'trambolin', 5, 1800, [
    ground(0, 300), ground(300, 1020, G + 140), T(460, 1.0, G + 140), spike(540, 176, G + 140), T(790, 1.0, G + 140), T(930, 1.0, G + 140),
    spike(1004, 48, G + 140), T(1120, 1.0, G + 140), T(1256, 1.0, G + 140), ground(1320, 480),
    ...coins(560, G - 120, 4, 36, 40), ...coins(900, G - 140, 4, 36, 40), ...coins(1240, G - 140, 4, 36, 40), ...coins(1500, G - 80, 4),
  ], { tags: ['cukur', 'zincir', 'diken'] }),
  chunk('tram-towers', 'trambolin', 5, 1800, [
    ground(0, 1800), T(260, 1.3), spike(340, 128), plat(520, G - 200, 180), ...coins(540, G - 250, 4),
    ...coins(340, G - 420, 4, 36, 40), spring(900, G, 1.2), spike(960, 160), ...coins(960, G - 380, 4, 36, 40),
    T(1300, 1.0), ...coins(1360, G - 250, 4, 36, 40),
  ], { tags: ['platform', 'yay', 'diken'] }),
];
