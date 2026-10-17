import type { ChunkSpec, Entity } from '@odi/shared';
import { GROUND_Y } from '@odi/shared';
import { chunk, coins, enemy, ground, hazard, secret, spike, text, checkpoint } from './helpers';

/**
 * Rüya parçaları. Her parçada tam uzunlukta zemin (GROUND_Y) ve tavan (y=60, h=40 → tavan altı 100). Zıplama yok; dokun = yerçekimini çevir.
 * Tavan engelleri: 'hazard' (bulut) veya tavana asılı 'platform' blokları (props.kind 'blok'); dikenler yalnızca zeminde.
 * Adil ritim (çevirme + iniş ≈ 0.75 s ≈ 200-300 px): ardışık tehditler arasında ≥ 340 px (yüzey fark etmez);
 * aynı x'te iki yüzeyi de kapatan çift yalnızca kaydırılabilir bulutlarla (yüzeyden ≥ 40 px yukarıda); parça başı/sonu 180 px tehditsiz.
 * 'flip' varlığı (zorunlu çevirme) sonrası iki yüzeyde de ≥ 400 px tehdit yok.
 */
const CEIL_B = 100;
const tavan = (x: number, w: number): Entity => ({ type: 'platform', x, y: CEIL_B - 40, w, h: 40, props: { kind: 'tavan' } });
const blokZ = (x: number, w = 60, h = 50): Entity => ({ type: 'platform', x, y: GROUND_Y - h, w, h, props: { kind: 'blok' } });
const blokT = (x: number, w = 60, h = 50): Entity => ({ type: 'platform', x, y: CEIL_B, w, h, props: { kind: 'blok' } });
/** zemin bulutu; lift ≥ 40 → altından kayarak geçilir */
const bulutZ = (x: number, lift = 0, w = 90, h = 70): Entity => hazard(x, GROUND_Y - h - lift, w, h, 'bulut');
const bulutT = (x: number, lift = 0, w = 90, h = 70): Entity => hazard(x, CEIL_B + lift, w, h, 'bulut');
const flipZ = (x: number): Entity => ({ type: 'flip', x, y: GROUND_Y - 30 });
const flipT = (x: number): Entity => ({ type: 'flip', x, y: CEIL_B + 30 });
const zc = (x: number, n: number, gap = 40): Entity[] => coins(x, GROUND_Y - 40, n, gap);
const tc = (x: number, n: number, gap = 40): Entity[] => coins(x, CEIL_B + 40, n, gap);
/** orta boşlukta yay: geçiş sırasında toplanır */
const mc = (x: number, n = 5, gap = 44, y = 370): Entity[] => coins(x, y, n, gap, 30);
const yildiz = (x: number, y: number, n = 4): Entity => ({ type: 'decor', x, y, props: { kind: 'yildiz', n } });
const note = (x: number, y: number, idx: number, total: number): Entity => ({ type: 'note', x, y, props: { idx, t: idx / Math.max(1, total - 1) } });
const R = (id: string, difficulty: ChunkSpec['difficulty'], length: number, entities: Entity[], opts: Parameters<typeof chunk>[5] = {}) =>
  chunk(`ruya-${id}`, 'ruya', difficulty, length, [ground(0, length), tavan(0, length), ...entities], opts);

export const RUYA_CHUNKS: ChunkSpec[] = [
  // nefes
  R('rest-1', 1, 600, [...zc(160, 5), ...tc(160, 5), yildiz(300, 370)], { rest: true, tags: ['nefes'] }),
  R('checkpoint', 1, 560, [checkpoint(280), ...zc(180, 4), yildiz(420, 330, 3)], { rest: true, tags: ['checkpoint'] }),
  R('rest-2', 3, 560, [...mc(140, 5), ...zc(380, 3), yildiz(260, 420, 3)], { rest: true, tags: ['nefes'] }),
  R('rest-3', 4, 520, [checkpoint(260), ...tc(160, 4), yildiz(380, 360, 3)], { rest: true, tags: ['nefes', 'checkpoint'] }),
  R('nefes-yildiz', 1, 800, [...mc(140, 5), ...tc(420, 4), ...zc(420, 4), yildiz(200, 420), yildiz(640, 320)], { tags: ['nefes', 'jeton'] }),
  // öğretici
  R('ogretici-cevir', 1, 1000, [text(220, 370, 'Dokun: yerçekimini çevir'), spike(480, 48), ...tc(420, 5), bulutT(880), ...zc(860, 4), yildiz(700, 400, 3)], { tags: ['ogretici'] }),
  R('ogretici-kay', 1, 900, [text(180, 370, 'Aşağı kaydır: kay'), bulutZ(440, 50), ...coins(400, GROUND_Y - 16, 4, 36), ...tc(440, 4), yildiz(700, 350, 3)], { tags: ['ogretici', 'kayma'] }),
  // normal
  R('dalga', 2, 1100, [spike(200, 32), ...mc(260, 4), bulutT(560), ...mc(640, 4), spike(920, 48), ...tc(880, 4)], { tags: ['dalga'] }),
  R('tavan-bloklari', 2, 1200, [blokT(300), ...zc(260, 4), blokZ(660), ...tc(620, 4), blokT(1020), ...zc(980, 4), yildiz(500, 380)], { tags: ['blok'] }),
  R('yildiz-bahcesi', 2, 1000, [yildiz(180, 380, 6), flipZ(300), flipT(300), ...mc(360, 5), spike(760, 32), ...tc(740, 4), yildiz(880, 400, 4)], { tags: ['cevirici'] }),
  R('ritim', 3, 1300, [spike(180, 32), bulutT(540), ...mc(300, 4), spike(900, 64), ...tc(860, 4), blokT(1240, 60, 50), ...zc(1200, 2)], { tags: ['dalga', 'blok'] }),
  R('dusman', 3, 1100, [enemy(300, GROUND_Y - 24, 'bakteri', 70), ...tc(260, 5), bulutT(700), ...zc(660, 4), spike(1040, 32)], { tags: ['dusman'] }),
  R('gizli-ruya', 3, 1200, [blokZ(260), ...mc(340, 4, 44, 360), secret(600, 370), ...mc(640, 4, 44, 380), blokT(960), yildiz(600, 300, 5)], { tags: ['gizli', 'blok'] }),
  R('melodi', 3, 1200, [note(160, GROUND_Y - 40, 0, 5), note(400, CEIL_B + 40, 1, 5), note(640, GROUND_Y - 40, 2, 5), note(880, CEIL_B + 40, 3, 5), note(1120, GROUND_Y - 40, 4, 5), yildiz(520, 380, 4)], { tags: ['melodi'] }),
  R('cift-bulut', 4, 1300, [text(140, 370, 'Aşağı kaydır: kay'), bulutZ(300, 50), bulutT(300, 50), ...coins(280, GROUND_Y - 16, 4, 36), blokZ(700), ...tc(660, 4), bulutT(1060), ...zc(1020, 4)], { tags: ['kayma', 'blok', 'ogretici'] }),
  R('labirent', 4, 1400, [text(120, 370, 'Dokun: yerçekimini çevir'), blokT(200), ...zc(180, 4), spike(540, 48), ...tc(520, 4), blokZ(880, 80, 60), ...tc(860, 4), bulutT(1220), ...zc(1200, 3), yildiz(720, 370, 5)], { tags: ['blok', 'dalga', 'ogretici'] }),
  R('firtina', 5, 1700, [spike(200, 32), ...tc(180, 4), blokT(540), ...zc(520, 4), bulutZ(880, 50), bulutT(880, 50), ...coins(860, GROUND_Y - 16, 4, 36), spike(1200, 32), ...tc(1180, 4), bulutT(1520), ...zc(1500, 3), yildiz(1000, 380, 5)], { tags: ['kayma', 'blok', 'dalga'] }),
  R('son-ruya', 5, 1600, [blokZ(200), ...tc(180, 4), blokT(560), ...zc(540, 4), spike(920, 64), ...tc(900, 4), bulutZ(1300, 50), bulutT(1300, 50), ...coins(1280, GROUND_Y - 16, 4, 36), yildiz(1100, 370, 6)], { tags: ['blok', 'kayma'] }),
];
