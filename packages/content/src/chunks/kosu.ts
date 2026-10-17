import { chunk, coins, enemy, ground, plat, power, secret, spike, text, checkpoint, hazard } from './helpers';
import { GROUND_Y } from '@odi/shared';

/** Koşu parçaları (referans seti; içerik ekibi genişletir). */
export const KOSU_CHUNKS = [
  chunk('kosu-rest-1', 'kosu', 1, 480, [ground(0, 480), ...coins(120, GROUND_Y - 70, 5)], { rest: true, tags: ['nefes'] }),
  chunk('kosu-intro-jump', 'kosu', 1, 640, [ground(0, 260), ground(360, 280), ...coins(250, GROUND_Y - 110, 3, 40, 30), text(80, GROUND_Y - 160, 'Dokun: zıpla')], { tags: ['ogretici', 'bosluk'] }),
  chunk('kosu-spike-1', 'kosu', 1, 560, [ground(0, 560), spike(240, 48), ...coins(200, GROUND_Y - 120, 4, 40, 30)], { tags: ['diken'] }),
  chunk('kosu-steps', 'kosu', 2, 760, [ground(0, 760), plat(220, GROUND_Y - 90, 120), plat(420, GROUND_Y - 170, 120), ...coins(230, GROUND_Y - 140, 3), ...coins(430, GROUND_Y - 220, 3), spike(600, 64)], { tags: ['platform'] }),
  chunk('kosu-slide', 'kosu', 2, 640, [ground(0, 640), hazard(260, GROUND_Y - 150, 160, 90, 'gurultu'), ...coins(270, GROUND_Y - 40, 4), text(60, GROUND_Y - 160, 'Aşağı kaydır: kay')], { tags: ['kayma', 'ogretici'] }),
  chunk('kosu-enemy-1', 'kosu', 2, 700, [ground(0, 700), enemy(360, GROUND_Y - 24, 'bakteri', 70), ...coins(300, GROUND_Y - 120, 5, 36, 40)], { tags: ['dusman'] }),
  chunk('kosu-gap-2', 'kosu', 3, 820, [ground(0, 220), ground(340, 160), ground(620, 200), ...coins(240, GROUND_Y - 130, 3), ...coins(520, GROUND_Y - 130, 3), spike(360, 32)], { tags: ['bosluk'] }),
  chunk('kosu-tower', 'kosu', 3, 900, [ground(0, 900), plat(200, GROUND_Y - 100, 100), plat(360, GROUND_Y - 200, 100), plat(520, GROUND_Y - 300, 100), secret(560, GROUND_Y - 360), spike(300, 160), spike(560, 160)], { tags: ['gizli', 'platform'] }),
  chunk('kosu-double-spike', 'kosu', 4, 760, [ground(0, 760), spike(240, 96), spike(500, 96), ...coins(330, GROUND_Y - 160, 3, 36, 20), power(620, GROUND_Y - 120, 'shield')], { tags: ['diken'] }),
  chunk('kosu-checkpoint', 'kosu', 1, 400, [ground(0, 400), checkpoint(200)], { rest: true, tags: ['checkpoint'] }),
  chunk('kosu-hazard-run', 'kosu', 4, 900, [ground(0, 900), hazard(200, GROUND_Y - 150, 120, 90), spike(420, 48), hazard(560, GROUND_Y - 150, 140, 90), enemy(800, GROUND_Y - 24, 'bakteri', 90), ...coins(200, GROUND_Y - 40, 3), ...coins(560, GROUND_Y - 40, 4)], { tags: ['karma'] }),
  chunk('kosu-leap-of-faith', 'kosu', 5, 980, [ground(0, 200), plat(300, GROUND_Y - 120, 90), plat(480, GROUND_Y - 220, 90), ground(700, 280), ...coins(310, GROUND_Y - 170, 2), ...coins(490, GROUND_Y - 270, 2), spike(700, 64), power(880, GROUND_Y - 100, 'magnet')], { tags: ['bosluk', 'platform'] }),
];
