import type { BiomeId, ChunkSpec } from '@odi/shared';
import { G, chunk, checkpoint, coins, decor, ground, jumpArc, plat, power, secret, spike } from './helpers';

/**
 * Nefes ve kontrol noktası parçaları: her bölüm-içi bölüm bunlardan biriyle başlar.
 * Biyoma özgü süs (decor) çizimi oyunda biyom paletiyle yapılır.
 */
const DECOR: Record<BiomeId, string> = { 'dis-kulak': 'tuy', kanal: 'damla', zar: 'ot', kemikcikler: 'ot', 'koklea-1': 'hucre', 'koklea-2': 'hucre', 'koklea-3': 'hucre', sinir: 'ot', 'beyin-sapi': 'ot', korteks: 'ot' };
const BIOMES = Object.keys(DECOR) as BiomeId[];

export const GENEL_CHUNKS: ChunkSpec[] = [
  // kontrol noktası: nefes alınır ama yol ölü kalmaz — kısa bir diken ve üstünde orta yükseklikte nota yayı
  ...BIOMES.map((b) => chunk(`cp-${b}`, 'kosu', 1, 480, [ground(0, 480), checkpoint(110), ...coins(170, G - 40, 2, 40), spike(330, 36), ...jumpArc(227, 4, 0.55), decor(40, G, DECOR[b]), decor(440, G, DECOR[b], 0.8)], { rest: true, tags: ['checkpoint', 'nefes'], biomes: [b] })),
  chunk('cp-yukari', 'kosu', 1, 640, [ground(0, 640), checkpoint(110), plat(250, G - 110, 160), ...coins(260, G - 160, 4, 40), secret(330, G - 250), spike(480, 36), ...coins(450, G - 120, 3, 36, 20)], { rest: true, tags: ['checkpoint', 'nefes'] }),
  chunk('cp-guc', 'kosu', 1, 540, [ground(0, 540), checkpoint(120), power(270, G - 80, 'shield'), ...coins(180, G - 40, 2, 40), spike(400, 36), ...jumpArc(297, 4, 0.55)], { rest: true, tags: ['checkpoint', 'nefes'] }),
  chunk('nefes-cayir', 'kosu', 1, 560, [ground(0, 560), ...coins(120, G - 100, 7, 36, 50), power(430, G - 90, 'magnet'), decor(60, G, 'ot'), decor(500, G, 'ot')], { rest: true, tags: ['nefes'] }),
];
