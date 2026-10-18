import type { ChunkSpec } from '@odi/shared';
import { G, barrier, beat, chunk, wall, coinCol, coins, collect, decor, echo, enemy, grav, ground, hazard, hook, hookArc, moving, plat, secret, spike } from './helpers';

/**
 * Beyin Sapı (34-36): sağ ve sol ses burada buluşur. Yerçekimi çevirme (35'ten): mor bölgede dokununca tavana/zemine düşersin;
 * bölgede zıplama yoktur, dokunuş çevirir. Bölgeden çıkınca yerçekimi normale döner.
 */
const B = ['beyin-sapi'] as const;
const yon = (x: number, s = 1) => decor(x, G, 'ot', s);
/** tavan dikeni (mor bölgede tavana düşünce tehlike) */
const ceilSpike = (x: number, w: number, ceilBottom: number) => hazard(x, ceilBottom - 4, w, 26, 'diken');
/** çevirme koridoru: zemin + tavan (kalınlık 40), bölge aralarında */
const corridor = (x: number, w: number, top = G - 300) => [plat(x, top, w, 40), grav(x, top + 40, w, G - top - 40)];
const pulse = (x: number, y: number, w: number, h: number, on: number, off: number, phase = 0) => hazard(x, y, w, h, 'gurultu', { on, off, phase });

export const BEYIN_SAPI_CHUNKS: ChunkSpec[] = [
  chunk('bs-capraz', 'ruya', 4, 1400, [ground(0, 300), moving(320, G - 20, 130, 240, -60, 2600), moving(560, G - 120, 130, -200, 80, 2600, 1.3), ground(720, 680), pulse(1050, G - 150, 100, 160, 1.0, 1.2), ...coins(340, G - 80, 4, 44), ...coins(600, G - 180, 3, 44), ...coins(1060, G - 40, 3, 36), spike(1260, 40), yon(1350), secret(700, G - 320)], { tags: ['hareketli', 'gurultu'], biomes: [...B] }),
  chunk('bs-cevir', 'ruya', 3, 1300, [ground(0, 1300), ...corridor(260, 820), spike(420, 120), ceilSpike(680, 140, G - 260), spike(940, 100), ...coins(430, G - 230, 4, 40), ...coins(690, G - 40, 4, 40), ...coins(950, G - 230, 3, 40), spike(1220, 40), secret(800, G - 200), yon(1150)], { tags: ['cevir', 'diken'], biomes: [...B], needs: ['cevir'] }),
  chunk('bs-cevir-bosluk', 'ruya', 4, 1500, [ground(0, 400), plat(260, G - 300, 980, 40), grav(260, G - 260, 980, 260), ground(560, 260), ground(1000, 500), ceilSpike(620, 120, G - 260), ...coins(430, G - 230, 4, 40), ...coins(640, G - 40, 3, 40), ...coins(860, G - 230, 4, 40), spike(1330, 40), secret(1100, G - 200), collect(780, G - 130)], { tags: ['cevir', 'bosluk'], biomes: [...B], needs: ['cevir'] }),
  chunk('bs-cevir-dusman', 'ruya', 4, 1400, [ground(0, 1400), ...corridor(280, 900), enemy(520, G, 'devriye', 60), hazard(820, G - 256, 80, 40, 'gurultu', { dx: 120, period: 2400 }), spike(1040, 80), ...coins(500, G - 230, 4, 40), ...coins(830, G - 40, 4, 40), ...coins(1040, G - 230, 3, 40), secret(700, G - 140)], { tags: ['cevir', 'dusman'], biomes: [...B], needs: ['cevir'] }),
  chunk('bs-gurultu', 'ruya', 4, 1400, [ground(0, 1400), pulse(300, G - 140, 120, 150, 1.1, 1.1), enemy(640, G, 'atici', 0, { period: 2.3, range: 300, dir: -1 }), spike(820, 48), pulse(1050, G - 140, 120, 150, 1.0, 1.3, 0.8), ...coins(310, G - 40, 3, 40), ...coins(800, G - 130, 3, 36, 20), ...coins(1060, G - 40, 3, 40), enemy(1290, G, 'devriye', 30), secret(560, G - 260), plat(510, G - 180, 110)], { tags: ['gurultu', 'atici'], biomes: [...B] }),
  chunk('bs-kanca-darbe', 'ruya', 4, 1600, [ground(0, 300), hook(560, G - 300, 190), hazard(320, G - 490, 520, 70), ground(860, 740), barrier(1060, G - 170, 170), enemy(1350, G, 'kalkanli', 40), ...coins(460, G - 170, 3, 50, 20), ...coins(1120, G - 60, 3, 40), ...coins(1320, G - 150, 3, 40, 20), secret(560, G - 400), collect(960, G - 160)], { tags: ['kanca', 'darbe'], biomes: [...B], needs: ['darbe', 'cakil'] }),
  chunk('bs-ritim', 'ruya', 4, 1400, [ground(0, 280), beat(300, G - 30, 120, '1110'), beat(480, G - 90, 120, '0111'), beat(660, G - 150, 120, '1011'), beat(840, G - 90, 120, '1101'), ground(1020, 380), spike(1200, 40), ...coins(310, G - 80, 3, 36), ...coins(490, G - 140, 3, 36), ...coins(670, G - 200, 3, 36), ...coins(850, G - 140, 3, 36), secret(700, G - 360), echo(640, G - 280, 120)], { tags: ['ritim'], biomes: [...B], needs: ['darbe'] }),
  chunk('bs-yon-kuyu', 'ruya', 4, 1300, [ground(0, 60), ground(170, 1130), wall(300, G - 560, 480), wall(480, G - 330, 330), plat(520, G - 330, 160), barrier(700, G - 500, 170), ...coinCol(390, G - 140, 4, 50), ...coins(540, G - 380, 3, 40), enemy(1000, G, 'devriye', 50), ...coins(960, G - 140, 3, 40, 20), plat(220, G - 560, 80), wall(180, G - 680, 120), secret(255, G - 600)], { tags: ['duvar', 'darbe'], biomes: [...B], needs: ['duvar', 'darbe'] }),
  chunk('bs-sinyal', 'ruya', 3, 1400, [ground(0, 1400), spike(180, 40), spike(940, 40), hazard(300, G - 200, 80, 80, 'gurultu', { dx: 0, dy: 140, period: 1800 }), hazard(620, G - 200, 80, 80, 'gurultu', { dx: 0, dy: 140, period: 1800, phase: 0.6 }), enemy(1200, G, 'atici', 0, { period: 2.4, range: 300 }), ...coins(310, G - 260, 2, 40), ...coins(630, G - 260, 2, 40), ...coins(800, G - 60, 5, 40), secret(470, G - 280), plat(420, G - 200, 100), yon(1350)], { tags: ['gurultu', 'atici'], biomes: [...B] }),
  // gösteri: Çapraz Yollar — tavan ve zemin dönüşümlü kesilir; çevir, atıl, çevir
  chunk('bs-sp-capraz-yollar', 'ruya', 5, 2400, [
    ground(0, 480), plat(300, G - 300, 1700, 40), grav(300, G - 260, 1700, 260),
    ground(620, 380), ground(1140, 380), ground(1660, 740),
    ceilSpike(760, 120, G - 260), ceilSpike(1240, 120, G - 260), ceilSpike(1760, 120, G - 260), barrier(2100, G - 170, 170),
    ...coins(400, G - 230, 3, 40), ...coins(660, G - 40, 3, 40), ...coins(920, G - 230, 3, 40), ...coins(1180, G - 40, 3, 40), ...coins(1440, G - 230, 3, 40), ...coins(1700, G - 40, 3, 40), ...coins(2160, G - 60, 5, 40),
    secret(1550, G - 130), collect(1060, G - 130),
  ], { tags: ['gosteri', 'cevir'], biomes: [...B], setPiece: true, needs: ['cevir', 'darbe'] }),
  // gösteri: Ters Köprü — tavan ve zemin dönüşümlü kopuk; kancayla tavan boşluğunu geç, gürültü duvarını kır, çevirerek in
  chunk('bs-sp-ters-kopru', 'ruya', 5, 2300, [
    ground(0, 420), plat(300, G - 300, 720, 40), grav(300, G - 260, 720, 260), ground(560, 200), ground(900, 240), ceilSpike(600, 80, G - 260), ceilSpike(940, 80, G - 260),
    ...coins(440, G - 236, 3, 40), ...coins(610, G - 40, 3, 40), ...coins(780, G - 236, 3, 40), ...coins(950, G - 40, 3, 40),
    hook(1320, G - 300, 190), hazard(1160, G - 500, 320, 70), ...hookArc(1320, G - 300, 190, 5),
    ground(1500, 800), barrier(1640, G - 170, 170), plat(1800, G - 300, 380, 40), grav(1800, G - 260, 380, 260), spike(1880, 120), ceilSpike(2060, 80, G - 260), ...coins(1890, G - 236, 3, 40), ...coins(2070, G - 40, 2, 40),
    collect(1300, G - 420), secret(980, G - 180),
  ], { tags: ['gosteri', 'cevir', 'kanca'], biomes: [...B], setPiece: true, needs: ['cevir', 'darbe'] }),
];
