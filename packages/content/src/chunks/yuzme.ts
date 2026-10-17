import type { Entity } from '@odi/shared';
import { GROUND_Y } from '@odi/shared';
import { chunk, coin, coins, enemy, ground, plat, power, secret, spike, text, checkpoint, hazard } from './helpers';

/**
 * Yüzme parçaları: koklea sıvısı. Zemin (koklea tabanı) her parçada tam boy; kahraman y 80..620 bandında yüzer
 * (su yüzeyi 60). Üst duvarlar `plat(x, 80, w, h)`, alt çıkıntılar `plat(x, y, w, GROUND_Y - y)`.
 * Adil: koridor ≥ 140 px, kabarcık aralığı ≤ 700 px, engel sonrası nefes payı.
 */
const bubble = (x: number, y: number): Entity => ({ type: 'bubble', x, y });
const current = (x: number, y: number, w: number, h: number, dx: number, dy: number): Entity => ({ type: 'current', x, y, w, h, props: { dx, dy } });
const note = (x: number, y: number, idx: number, t: number): Entity => ({ type: 'note', x, y, props: { idx, t } });
const escortee = (x: number, y: number): Entity => ({ type: 'escortee', x, y });
/** alt çıkıntı: y'den tabana kadar dolu */
const bump = (x: number, y: number, w: number): Entity => plat(x, y, w, GROUND_Y - y);
/** üst duvar: su yüzeyinden y'ye kadar dolu */
const roof = (x: number, w: number, bottom: number): Entity => plat(x, 80, w, bottom - 80);
/** tavan dikeni: duvarın altına asılı (üçgenler yukarı baksa da tüylü hücre gibi durur) */
const ceilSpike = (x: number, w: number, roofBottom: number): Entity => spike(x, w, roofBottom + 28);

export const YUZME_CHUNKS = [
  // --- nefes (rest)
  chunk('yuzme-rest-1', 'yuzme', 1, 520, [ground(0, 520), bubble(260, 400), ...coins(120, 440, 5, 36, 30)], { rest: true, tags: ['nefes'] }),
  chunk('yuzme-rest-checkpoint', 'yuzme', 1, 480, [ground(0, 480), checkpoint(240), bubble(320, 380), ...coins(90, 500, 4)], { rest: true, tags: ['checkpoint', 'nefes'] }),

  // --- öğretici
  chunk('yuzme-intro-hold', 'yuzme', 1, 760, [
    ground(0, 760), text(130, 300, 'Basılı tut: yüksel'), text(560, 220, 'Bırak: alçal'),
    coin(200, 580), coin(260, 520), coin(320, 460), coin(380, 400), coin(440, 360), bubble(500, 330), coin(580, 400), coin(640, 470), coin(700, 540),
  ], { tags: ['ogretici'] }),
  chunk('yuzme-intro-bubble', 'yuzme', 1, 780, [
    ground(0, 780), text(150, 240, 'Kabarcık: nefes dolar'), bubble(330, 330), ...coins(200, 520, 5, 36),
    spike(520, 64), bubble(660, 470), ...coins(560, 380, 4, 36, 30),
  ], { tags: ['ogretici', 'diken'] }),

  // --- normal
  chunk('yuzme-escort-start', 'yuzme', 1, 620, [ground(0, 620), ...coins(40, 500, 3, 36), escortee(140, 500), ...coins(220, 460, 5, 36, 40), bubble(420, 340)], { tags: ['eskort'] }),
  chunk('yuzme-floor-spikes', 'yuzme', 2, 740, [
    ground(0, 740), spike(200, 64), spike(440, 96), ...coins(220, 470, 6, 40, 30), bubble(600, 340), ...coins(560, 540, 3, 36),
  ], { tags: ['diken'] }),
  chunk('yuzme-ceiling', 'yuzme', 2, 820, [
    ground(0, 820), roof(200, 240, 160), ceilSpike(220, 64, 160), bump(500, 560, 140), spike(520, 64, 560),
    ...coins(230, 360, 5, 36), bubble(720, 300), ...coins(540, 420, 3, 36, 20),
  ], { tags: ['duvar', 'diken'] }),
  chunk('yuzme-bakteri', 'yuzme', 2, 780, [
    ground(0, 780), enemy(360, 420, 'bakteri', 80), enemy(640, 580, 'bakteri', 60), ...coins(260, 300, 5, 36, 30), bubble(520, 240), ...coins(600, 400, 3, 36),
  ], { tags: ['dusman'] }),
  chunk('yuzme-bubble-chain', 'yuzme', 2, 820, [
    ground(0, 820), bubble(160, 500), bubble(340, 380), bubble(520, 260), bubble(700, 400),
    hazard(600, 90, 120, 160), spike(400, 64), ...coins(200, 540, 4, 36), ...coins(560, 500, 4, 36, 20),
  ], { tags: ['nefes', 'diken'] }),
  chunk('yuzme-melody', 'yuzme', 2, 1000, [
    ground(0, 1000), note(200, 500, 0, 0.1), note(360, 400, 1, 0.3), note(520, 300, 2, 0.5), note(680, 400, 3, 0.7), note(840, 500, 4, 0.9),
    bubble(520, 520), spike(600, 64), bubble(940, 360),
  ], { tags: ['melodi'] }),
  chunk('yuzme-corridor', 'yuzme', 3, 920, [
    ground(0, 920), roof(150, 300, 260), bump(150, 480, 300), ...coins(180, 370, 6, 40),
    roof(560, 280, 380), ...coins(600, 520, 4, 36), bubble(720, 500), spike(600, 64),
  ], { tags: ['duvar', 'koridor'] }),
  chunk('yuzme-current-up', 'yuzme', 3, 860, [
    ground(0, 860), current(200, 300, 200, 300, 120, -220), ...coins(260, 180, 5, 36, 20), hazard(440, 540, 160, 90),
    bubble(720, 240), text(120, 200, 'Akıntı: ek hız'), ...coins(660, 400, 3, 36),
  ], { tags: ['akinti'] }),
  chunk('yuzme-current-down', 'yuzme', 3, 860, [
    ground(0, 860), current(200, 100, 220, 320, 60, 240), spike(300, 96), ...coins(220, 420, 5, 36), bubble(620, 300), enemy(720, 580, 'virus', 50), ...coins(680, 440, 3, 36, 20),
  ], { tags: ['akinti', 'diken', 'dusman'] }),
  chunk('yuzme-secret-nook', 'yuzme', 3, 920, [
    ground(0, 920), roof(300, 140, 280), roof(580, 120, 280), secret(510, 200), spike(420, 96), ...coins(320, 400, 6, 40, 30), bubble(780, 420),
  ], { tags: ['gizli', 'duvar'] }),
  chunk('yuzme-virus-swarm', 'yuzme', 4, 980, [
    ground(0, 980), enemy(240, 300, 'virus', 70), enemy(430, 500, 'virus', 70), enemy(620, 260, 'bakteri', 90), enemy(800, 580, 'virus', 60),
    bubble(340, 430), bubble(880, 400), ...coins(500, 220, 3, 36), ...coins(700, 460, 3, 36), power(930, 300, 'shield'),
  ], { tags: ['dusman'] }),
  chunk('yuzme-hazard-clouds', 'yuzme', 4, 940, [
    ground(0, 940), hazard(200, 80, 140, 150), hazard(420, 440, 160, 180), hazard(760, 260, 140, 180),
    bubble(520, 300), ...coins(220, 420, 4, 36), ...coins(760, 540, 4, 36), bubble(900, 520),
  ], { tags: ['tehlike'] }),
  chunk('yuzme-narrow-pass', 'yuzme', 4, 1020, [
    ground(0, 1020), bubble(120, 420), roof(200, 600, 340), bump(200, 500, 600), ...coins(240, 420, 10, 50), bubble(900, 440), ...coins(860, 540, 3, 36),
  ], { tags: ['duvar', 'koridor'] }),
  chunk('yuzme-secret-deep', 'yuzme', 4, 980, [
    ground(0, 980), bubble(220, 300), plat(300, 300, 320, 50), secret(460, 560), hazard(360, 90, 120, 160), enemy(780, 580, 'bakteri', 60),
    ...coins(320, 220, 4, 36), ...coins(680, 380, 4, 36, 30), bubble(900, 300),
  ], { tags: ['gizli', 'tehlike', 'dusman'] }),
  chunk('yuzme-wave-spikes', 'yuzme', 3, 900, [
    ground(0, 900), spike(180, 64), roof(320, 160, 200), ceilSpike(330, 64, 200), spike(520, 96), roof(700, 160, 220), ceilSpike(710, 64, 220),
    bubble(440, 400), bubble(860, 420), ...coins(200, 440, 4, 36, -30), ...coins(540, 380, 4, 36, 30),
  ], { tags: ['diken', 'duvar'] }),
  chunk('yuzme-bakteri-lane', 'yuzme', 3, 900, [
    ground(0, 900), enemy(300, 250, 'bakteri', 80), bump(450, 520, 160), enemy(660, 420, 'virus', 70), bubble(520, 300), ...coins(200, 440, 4, 36), ...coins(700, 560, 4, 36), bubble(860, 480),
  ], { tags: ['dusman', 'duvar'] }),
  chunk('yuzme-current-rapids', 'yuzme', 4, 1000, [
    ground(0, 1000), current(150, 80, 250, 560, 160, 0), text(120, 180, 'Hızlı akıntı!'), hazard(560, 300, 120, 120), spike(700, 96),
    bubble(460, 180), ...coins(200, 220, 5, 36, 20), ...coins(560, 520, 4, 36), bubble(900, 450),
  ], { tags: ['akinti', 'tehlike', 'diken'] }),
  chunk('yuzme-dark-tunnel', 'yuzme', 4, 1000, [
    ground(0, 1000), roof(100, 800, 300), spike(300, 96), enemy(560, 600, 'bakteri', 70), spike(760, 64),
    bubble(450, 450), bubble(950, 450), ...coins(150, 450, 4, 36), ...coins(620, 420, 4, 36, 20),
  ], { tags: ['duvar', 'diken', 'dusman'] }),
  chunk('yuzme-pillars', 'yuzme', 5, 1160, [
    ground(0, 1160), bump(200, 440, 120), spike(210, 64, 440), roof(380, 140, 260), ceilSpike(390, 64, 260), bump(580, 440, 120), spike(590, 64, 440),
    roof(760, 140, 280), ceilSpike(770, 64, 280), enemy(960, 580, 'virus', 60), bubble(320, 350), bubble(690, 350), bubble(1060, 300),
    ...coins(220, 300, 3, 36), ...coins(600, 280, 3, 36), ...coins(900, 460, 4, 36),
  ], { tags: ['duvar', 'diken', 'karma'] }),
  chunk('yuzme-gauntlet', 'yuzme', 5, 1120, [
    ground(0, 1120), spike(150, 96), hazard(300, 90, 120, 160), enemy(480, 380, 'virus', 80), spike(600, 96), roof(700, 200, 280), ceilSpike(710, 96, 280),
    enemy(960, 580, 'bakteri', 60), bubble(420, 540), bubble(850, 500), ...coins(200, 440, 4, 36), ...coins(720, 420, 4, 36), power(1060, 300, 'life'),
  ], { tags: ['karma', 'diken', 'dusman'] }),
  chunk('yuzme-zigzag', 'yuzme', 5, 1220, [
    ground(0, 1220), roof(150, 200, 380), bump(520, 400, 220), spike(540, 64, 400), roof(960, 180, 300),
    bubble(430, 300), bubble(830, 330), ...coins(170, 500, 4, 36), ...coins(540, 300, 4, 36), ...coins(980, 480, 4, 36), hazard(1150, 90, 70, 150),
  ], { tags: ['duvar', 'diken', 'karma'] }),
];
