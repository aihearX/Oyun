import { beforeAll, describe, expect, it } from 'vitest';
import type { LevelScore } from './human';
import { measureLevels } from './testkit';

/** Zorluk eğrisinin biçimi 2/3 (bkz. zorluk-1.test.ts): Koklea (taban, orta, apeks) ve önceki bölgenin girişi. */
// 8 oyuncu: 4'lük alt örneklemde koklea finallerinin birkaç ölümsüz koşusu ortalamayı girişlerin altına çekebiliyordu
const P = [0, 1, 2, 3, 4, 5, 6, 7];
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
describe('zorluk eğrisi 2/3: koklea', () => {
  let s: Record<number, LevelScore> = {};
  beforeAll(() => { s = measureLevels([13, 21, 23, 24, 26, 27, 30], P); }, 900_000);
  const sc = (n: number) => s[n]!.score;
  it('bölge finalleri bölge girişlerinden zor', () => {
    expect(avg([23, 26, 30].map(sc))).toBeGreaterThan(avg([21, 24, 27].map(sc)) + 0.5);
  });
  it('koklea finalleri hem koklea girişlerinden hem kemikçik girişinden belirgin zor', () => {
    expect(avg([23, 26, 30].map(sc))).toBeGreaterThan(avg([13, 21, 24, 27].map(sc)) + 0.5);
  });
});
