import type { ChunkSpec, Entity } from '@odi/shared';
import { GROUND_Y } from '@odi/shared';
import { chunk, coin, ground, hazard, power, secret, text, checkpoint } from './helpers';

/**
 * İmpuls parçaları. Üç şerit (0 alt, 1 orta, 2 üst); kahraman ayak y'si LANE_Y, jeton/engel merkezi LANE_Y-24.
 * Ritim kuralları (hız 380-620 px/s): ardışık şerit engelleri arasında ≥ 160 px; iki bitişik şeridi kapatan "duvar" öncesi ≥ 420 px boş;
 * sinaps boşluğu (yalnızca sprint ile geçilir) çevresinde ±220 px engel yok, sinapslar arası ≥ 1300 px (sprint beklemesi 2 s);
 * parça başı/sonu 120 px engelsiz. Her parçada tam uzunlukta zemin (düşme yok).
 */
export const LANE_Y = [GROUND_Y - 40, GROUND_Y - 170, GROUND_Y - 300] as const;
const cy = (l: number) => LANE_Y[l]! - 24;

const lane = (x: number, l: 0 | 1 | 2): Entity => ({ type: 'lane', x, y: LANE_Y[l], props: { lane: l } });
const lcoins = (x: number, l: 0 | 1 | 2, n: number, gap = 44): Entity[] => Array.from({ length: n }, (_, i) => coin(x + i * gap, cy(l)));
/** şeritler arasında yumuşak jeton yayı (l0 → l1) */
const arc = (x: number, from: 0 | 1 | 2, to: 0 | 1 | 2, n = 4, gap = 44): Entity[] => Array.from({ length: n }, (_, i) => coin(x + i * gap, cy(from) + (cy(to) - cy(from)) * (i / Math.max(1, n - 1))));
const sinaps = (x: number): Entity => ({ type: 'hazard', x, y: GROUND_Y - 360, w: 48, h: 330, props: { kind: 'sinaps' } });
const bulut = (x: number, l: 0 | 1 | 2): Entity => hazard(x, cy(l) - 40, 80, 80, 'gurultu');
const sign = (x: number, t: string): Entity => text(x, GROUND_Y - 430, t);
const I = (id: string, difficulty: ChunkSpec['difficulty'], length: number, entities: Entity[], opts: Parameters<typeof chunk>[5] = {}) =>
  chunk(`impuls-${id}`, 'impuls', difficulty, length, [ground(0, length), ...entities], opts);

export const IMPULS_CHUNKS: ChunkSpec[] = [
  // nefes
  I('rest-1', 1, 700, [...lcoins(180, 1, 5), ...lcoins(420, 0, 3)], { rest: true, tags: ['nefes'] }),
  I('checkpoint', 1, 600, [checkpoint(300), ...lcoins(180, 0, 4)], { rest: true, tags: ['checkpoint'] }),
  I('rest-2', 3, 560, [...arc(120, 1, 2, 4), ...lcoins(340, 0, 4)], { rest: true, tags: ['nefes'] }),
  I('rest-3', 4, 520, [checkpoint(260), ...lcoins(140, 0, 5)], { rest: true, tags: ['nefes', 'checkpoint'] }),
  I('nefes-yay', 1, 900, [...arc(120, 1, 2, 4), ...arc(340, 2, 0, 5), ...arc(600, 0, 1, 4)], { tags: ['nefes', 'jeton'] }),
  // öğretici
  I('ogretici-serit', 1, 1100, [sign(240, 'Sol: aşağı şerit · Sağ: yukarı şerit'), lane(450, 1), ...lcoins(380, 2, 4), ...lcoins(380, 0, 4), lane(760, 2), ...lcoins(700, 1, 4), lane(1000, 0)], { tags: ['ogretici', 'serit'] }),
  I('ogretici-sprint', 1, 1500, [sign(360, 'Aşağı kaydır: sprint'), ...lcoins(380, 1, 5), sinaps(760), ...lcoins(1040, 1, 5)], { tags: ['ogretici', 'sinaps'] }),
  // normal
  I('zigzag', 2, 1000, [lane(160, 1), lane(380, 0), lane(600, 2), lane(820, 1), ...lcoins(330, 2, 3), ...lcoins(560, 0, 3), ...lcoins(780, 2, 3)], { tags: ['serit'] }),
  I('cift-serit', 2, 1100, [lane(200, 0), lane(200, 2), ...lcoins(160, 1, 4), lane(520, 1), ...lcoins(480, 2, 3), lane(760, 1), ...lcoins(720, 0, 3), lane(980, 0)], { tags: ['serit'] }),
  I('jeton-nehri', 2, 1200, [...lcoins(120, 0, 6), ...arc(400, 0, 2, 4), lane(500, 1), ...lcoins(600, 2, 6), ...arc(880, 2, 1, 4), lane(900, 2), ...lcoins(1040, 1, 3)], { tags: ['jeton', 'serit'] }),
  I('bulut', 2, 1100, [bulut(240, 2), ...lcoins(200, 0, 4), bulut(520, 0), ...lcoins(480, 1, 4), lane(800, 1), ...lcoins(760, 2, 4)], { tags: ['bulut', 'serit'] }),
  I('sinaps-kosusu', 3, 1500, [lane(200, 1), lane(400, 0), ...lcoins(300, 2, 4), sinaps(760), ...lcoins(560, 1, 4), lane(1050, 2), lane(1300, 1), ...lcoins(1020, 0, 5)], { tags: ['sinaps', 'serit'] }),
  I('merdiven', 3, 1100, [lane(150, 0), lane(330, 1), lane(510, 2), lane(690, 1), lane(870, 0), ...lcoins(120, 2, 3), ...lcoins(460, 0, 3), ...lcoins(820, 2, 4)], { tags: ['serit'] }),
  I('gizli-lif', 3, 1300, [lane(300, 1), lane(560, 0), ...lcoins(620, 2, 5), secret(900, cy(2)), lane(1100, 0), ...lcoins(1000, 1, 4)], { tags: ['gizli', 'serit'] }),
  I('duvarlar', 4, 1450, [sign(160, 'Sol: aşağı şerit · Sağ: yukarı şerit'), ...lcoins(120, 2, 5), lane(450, 0), lane(450, 1), lane(700, 2), ...lcoins(640, 1, 4), lane(900, 1), ...lcoins(880, 0, 4), lane(1340, 1), lane(1340, 2), ...lcoins(1300, 0, 3)], { tags: ['duvar', 'serit', 'ogretici'] }),
  I('sinaps-duvar', 4, 1600, [sign(420, 'Aşağı kaydır: sprint'), lane(200, 2), ...lcoins(300, 1, 5), sinaps(760), ...lcoins(900, 0, 5), lane(1250, 1), lane(1250, 2), power(1450, cy(1), 'shield')], { tags: ['sinaps', 'duvar', 'ogretici'] }),
  I('firtina', 5, 1600, [lane(150, 1), lane(330, 0), lane(510, 2), lane(690, 1), ...lcoins(280, 2, 3), ...lcoins(640, 0, 3), sinaps(1000), lane(1260, 0), lane(1440, 2), ...lcoins(1220, 1, 5)], { tags: ['sinaps', 'serit'] }),
  I('son-atak', 5, 1500, [lane(450, 0), lane(450, 1), ...lcoins(200, 2, 5), lane(650, 2), lane(850, 1), ...lcoins(620, 0, 4), lane(1050, 0), lane(1050, 2), ...lcoins(1020, 1, 4), lane(1300, 1), power(1420, cy(0), 'shield')], { tags: ['duvar', 'serit'] }),
];
