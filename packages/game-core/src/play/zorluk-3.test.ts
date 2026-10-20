import { beforeAll, describe, expect, it } from 'vitest';
import type { LevelScore } from './human';
import { measureLevels } from './testkit';

/** Zorluk eğrisinin biçimi 3/3 (bkz. zorluk-1.test.ts): Sinir, Beyin Sapı, Korteks ve Gürültü Canavarı (40). */
const P = [0, 1, 2, 3];
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
describe('zorluk eğrisi 3/3: son bölgeler ve son boss', () => {
  let s: Record<number, LevelScore> = {};
  beforeAll(() => { s = measureLevels([27, 30, 31, 33, 34, 36, 37, 39, 40], P); }, 900_000);
  const sc = (n: number) => s[n]!.score;
  it('bölge finalleri bölge girişlerinden zor', () => {
    expect(avg([33, 36, 39].map(sc))).toBeGreaterThan(avg([31, 34, 37].map(sc)) + 0.5);
  });
  it('kademe atlayınca zorluk artar: son finaller koklea apeks finalinden zor', () => {
    expect(avg([33, 36, 39].map(sc))).toBeGreaterThan(sc(30));
  });
  it('Gürültü Canavarı (40) son doruk: son finallerden ve her girişten zor, yine de oyuncuların en az yarısı 3 canla yener', () => {
    expect(sc(40)).toBeGreaterThan(avg([33, 36, 39].map(sc)));
    for (const n of [27, 31, 34, 37]) expect(sc(40), `40 > ${n}`).toBeGreaterThan(sc(n));
    expect(s[40]!.fin).toBeGreaterThanOrEqual(0.5);
  });
});
