import type { BiomeId, ChunkSpec } from '@odi/shared';
import { G, chunk, checkpoint, coins, decor, ground, plat, power, secret } from './helpers';

/**
 * Nefes ve kontrol noktası parçaları: her bölüm-içi bölüm bunlardan biriyle başlar.
 * Biyoma özgü süs (decor) çizimi oyunda biyom paletiyle yapılır.
 */
const DECOR: Record<BiomeId, string> = { 'dis-kulak': 'tuy', kanal: 'damla', zar: 'ot', kemikcikler: 'ot', 'koklea-1': 'hucre', 'koklea-2': 'hucre', 'koklea-3': 'hucre', sinir: 'ot', 'beyin-sapi': 'ot', korteks: 'ot' };
const BIOMES = Object.keys(DECOR) as BiomeId[];

export const GENEL_CHUNKS: ChunkSpec[] = [
  ...BIOMES.map((b) => chunk(`cp-${b}`, 'kosu', 1, 460, [ground(0, 460), checkpoint(150), ...coins(230, G - 60, 4), decor(60, G, DECOR[b]), decor(400, G, DECOR[b], 0.8)], { rest: true, tags: ['checkpoint', 'nefes'], biomes: [b] })),
  chunk('cp-yukari', 'kosu', 1, 620, [ground(0, 620), checkpoint(120), plat(260, G - 110, 160), ...coins(270, G - 160, 4, 40), secret(340, G - 250), ...coins(470, G - 60, 3)], { rest: true, tags: ['checkpoint', 'nefes'] }),
  chunk('cp-guc', 'kosu', 1, 520, [ground(0, 520), checkpoint(140), power(330, G - 80, 'shield'), ...coins(220, G - 60, 3, 40)], { rest: true, tags: ['checkpoint', 'nefes'] }),
  chunk('nefes-cayir', 'kosu', 1, 560, [ground(0, 560), ...coins(120, G - 100, 7, 36, 50), power(430, G - 90, 'magnet'), decor(60, G, 'ot'), decor(500, G, 'ot')], { rest: true, tags: ['nefes'] }),
];
