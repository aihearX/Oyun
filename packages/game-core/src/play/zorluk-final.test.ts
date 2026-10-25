import { beforeAll, describe, expect, it } from 'vitest';
import type { LevelScore } from './human';
import { measureLevels } from './testkit';

/**
 * Bölge finalleri ve boss'lar bölgelerinin doruğudur (docs/12 §1, §6; MK-003). Her bölgenin finali, bölgenin (48 oyunculuk
 * ölçümde) en zor diğer bölümünden puanda (3 × can kaybı + yakın kaçış) zor ve bitirmede kolay değil; boss'lar kendi bölgelerinin
 * finalinden zor. Kademe adımı: Koklea Taban finali (23) Kemikçikler finalinden (19) hem puanda hem bitirmede zor (sekizinci
 * geçişte 23 bitirmede 19'dan kolaydı); diğer final adımları tek tek gürültü düzeyindedir (48 oyuncu gerekir), grup zinciri
 * `zorluk-4.test.ts`; 1-12 ilk kez oynayanla `zorluk-ilk.test.ts`. 12 oyunculuk sabit tohumlu alt örneklem (her beceri kademesinden
 * üç oyuncu; 8 oyuncuda 26/25 bitirme oranı tek oyuncuyla dönüyordu). Süre bir zorluk ölçüsü değildir (süreli finaller hız
 * bölümüdür, boss tek ekran); docs/12 §6 tablosunda raporlanır.
 */
const P = Array.from({ length: 12 }, (_, k) => k);
/** [final ya da boss, bölgenin en zor diğer bölümü] */
const PEAKS: [number, number][] = [[5, 4], [8, 7], [12, 11], [19, 17], [19, 18], [20, 19], [23, 22], [26, 25], [30, 29], [33, 32], [36, 35], [39, 38], [40, 39]];
describe('zorluk eğrisi: bölge finalleri ve boss\'lar doruk', () => {
  let s: Record<number, LevelScore> = {};
  beforeAll(() => { s = measureLevels([...new Set(PEAKS.flat())].sort((a, b) => a - b), P); }, 1_500_000);
  it('her final ve boss bölgesinin en zor diğer bölümünden zor: puan yüksek, bitirme oranı yüksek değil', () => {
    for (const [f, o] of PEAKS) {
      expect(s[f]!.score, `${f} puanı > ${o}`).toBeGreaterThan(s[o]!.score);
      expect(s[f]!.fin, `${f} bitirme ≤ ${o}`).toBeLessThanOrEqual(s[o]!.fin);
    }
  });
  it('kademe adımı: Koklea Taban finali (23) Kemikçikler finalinden (19) puanda ve bitirmede zor', () => {
    expect(s[23]!.score, '23 > 19').toBeGreaterThan(s[19]!.score);
    expect(s[23]!.fin, '23 bitirme ≤ 19').toBeLessThanOrEqual(s[19]!.fin);
  });
});
