import type { ChunkSpec } from '@odi/shared';
import { G, barrier, block, chunk, coinCol, coins, collect, decor, echo, enemy, ground, hazard, launcher, moving, plat, power, secret, spike, sw, door, wall } from './helpers';
import { curtain } from './ogretici';

/**
 * İşitme Siniri (31-33) ve Beyin Sapı'nın çevirmesiz bölümü (34): elektrik impulsu. Ses darbesi (31'den): ileri kaydır →
 * kısa atılma; gürültü duvarını kırar, düşmanı dağıtır, yankı yollarını ~3 sn görünür ve katı yapar.
 * Nabız tehlikeleri açılmadan önce titrer (telegraf); dağılabilir gürültü bulutları darbeyle söner.
 */
const S = ['sinir', 'beyin-sapi'] as const;
const lif = (x: number, s = 1) => decor(x, G, 'ot', s);
const pulse = (x: number, y: number, w: number, h: number, on: number, off: number, phase = 0) => hazard(x, y, w, h, 'gurultu', { on, off, phase });
const cloud = (x: number, y: number, w = 90, h = 90) => hazard(x, y, w, h, 'gurultu', { dash: true });
const shooter = (x: number, high = false, period = 2.2, range = 460) => enemy(x, G, 'atici', 0, { period, range, high });

export const SINIR_CHUNKS: ChunkSpec[] = [
  chunk('sn-bariyer', 'impuls', 3, 1300, [ground(0, 1300), barrier(360, G - 170, 170), ...coins(420, G - 60, 4, 40), enemy(700, G, 'devriye', 50), ...coins(660, G - 130, 3, 40, 20), barrier(1000, G - 170, 170), ...coins(1060, G - 60, 4, 40), lif(200), secret(820, G - 260), plat(770, G - 180, 110)], { tags: ['darbe'], biomes: [...S] }),
  chunk('sn-yanki-kopru', 'impuls', 4, 1500, [ground(0, 380), echo(400, G, 130), echo(580, G - 40, 130), echo(760, G, 130), echo(940, G - 40, 130), ground(1100, 400), ...coins(420, G - 60, 3, 40), ...coins(600, G - 100, 3, 40), ...coins(780, G - 60, 3, 40), ...coins(960, G - 100, 3, 40), hazard(380, G - 520, 720, 80), secret(1300, G - 220), plat(1250, G - 150, 110)], { tags: ['yanki', 'darbe', 'bosluk'], biomes: [...S], needs: ['darbe'] }),
  chunk('sn-atici', 'impuls', 4, 1400, [ground(0, 1400), shooter(1280, false, 2.0, 520), ...coins(500, G - 140, 4, 40, 30), spike(880, 48), ...coins(860, G - 130, 3, 36, 20), lif(300), secret(640, G - 250), plat(590, G - 170, 110), power(1200, G - 70, 'shield')], { tags: ['atici', 'dusman'], biomes: [...S] }),
  chunk('sn-atici-yuksek', 'impuls', 4, 1400, [ground(0, 1400), shooter(1300, true, 2.0, 600), ...coins(600, G - 20, 6, 44), curtain(400, 100, 'gurultu'), ...coins(410, G - 20, 2, 40), spike(1000, 48), ...coins(980, G - 130, 3, 36, 20), secret(820, G - 260), plat(770, G - 180, 110)], { tags: ['atici', 'kayma'], biomes: [...S], needs: ['kayma'] }),
  chunk('sn-gurultu', 'impuls', 4, 1400, [ground(0, 1400), pulse(320, G - 130, 110, 140, 1.2, 1.2), cloud(640, G - 110), ...coins(660, G - 60, 3, 36), pulse(960, G - 130, 110, 140, 1.0, 1.4, 0.6), ...coins(330, G - 60, 3, 36), ...coins(970, G - 60, 3, 36), lif(1250), secret(800, G - 260), plat(750, G - 180, 110)], { tags: ['gurultu', 'darbe'], biomes: [...S], needs: ['darbe'] }),
  chunk('sn-lif', 'impuls', 3, 1400, [ground(0, 300), moving(320, G - 20, 140, 280, 0, 2400), moving(800, G - 80, 140, 0, 90, 1800, 0.5), ground(1000, 400), barrier(1200, G - 170, 170), ...coins(340, G - 70, 5, 44), ...coins(810, G - 140, 3, 40), secret(560, G - 260), collect(1300, G - 60)], { tags: ['hareketli', 'darbe'], biomes: [...S], needs: ['darbe'] }),
  chunk('sn-hiz', 'impuls', 4, 1500, [ground(0, 360), launcher(330, G, 520, -760), ground(900, 600), barrier(1050, G - 170, 170), cloud(1300, G - 100), ...coins(400, G - 260, 6, 50, 40), ...coins(1110, G - 60, 4, 40), secret(640, G - 420), echo(560, G - 330, 120)], { tags: ['hiz', 'darbe', 'firlatici'], biomes: [...S], needs: ['darbe'] }),
  chunk('sn-kapali-yol', 'impuls', 4, 1400, [ground(0, 100), ground(200, 1200), block(260, G - 100, 200, 100), sw(640, G, 'sn-k1', 'darbe'), door(900, G - 240, 240, 'sn-k1'), ...coins(560, G - 60, 3, 36), ...coins(980, G - 60, 4, 40), cloud(760, G - 100), secret(1200, G - 230), plat(1150, G - 160, 110)], { tags: ['anahtar', 'darbe'], biomes: [...S], needs: ['darbe'] }),
  chunk('sn-kuyu-bariyer', 'impuls', 4, 1300, [ground(0, 60), ground(170, 1130), wall(300, G - 560, 480), wall(480, G - 330, 330), plat(520, G - 330, 160), barrier(800, G - 170, 170), ...coinCol(390, G - 140, 4, 50), ...coins(540, G - 380, 3, 40), ...coins(860, G - 60, 4, 40), secret(390, G - 480)], { tags: ['duvar', 'darbe'], biomes: [...S], needs: ['duvar', 'darbe'] }),
  // gösteri: Işık Treni Kaçışı — arkadan gelen sinyal dalgası; duvarları darbeyle kır, yankı köprüsünden geç
  chunk('sn-sp-isik-treni', 'impuls', 4, 2600, [
    ground(0, 1300), hazard(0, G - 420, 110, 420, 'isik', { chase: 290, until: 2500, start: 330 }), barrier(420, G - 170, 170), cloud(760, G - 110), barrier(1080, G - 170, 170),
    echo(1320, G, 130), echo(1500, G - 50, 130), echo(1680, G, 130), ground(1840, 760), barrier(2050, G - 170, 170), spike(2300, 48),
    ...coins(480, G - 60, 5, 40), ...coins(1130, G - 60, 4, 40), ...coins(1340, G - 60, 3, 40), ...coins(1520, G - 110, 3, 40), ...coins(1700, G - 60, 3, 40), ...coins(2280, G - 130, 3, 36, 20),
    collect(900, G - 200), secret(1560, G - 260),
  ], { tags: ['gosteri', 'darbe', 'yanki'], biomes: ['sinir'], setPiece: true, needs: ['darbe'] }),
];
