import { beforeAll, describe, expect, it } from 'vitest';
import type { LevelScore } from './human';
import { measureLevels } from './testkit';

/**
 * Zorluk eğrisinin biçimi 4/4 (bkz. zorluk-1.test.ts): bölge finalleri zinciri. Her üst kademenin finali bir öncekinden zor
 * (docs/12 §1: 8 → 12 → 19 → 23 → 26 → 30 → 33 → 36 → 39). Tek tek komşu finaller arasındaki fark ölçüm gürültüsü
 * düzeyinde olduğundan (48 oyuncuda bile z ≈ 0,3-0,9) test, ardışık final GRUPLARININ ortalamalarını karşılaştırır;
 * 16 oyunculuk alt örneklem sabit tohumludur (her çalıştırmada aynı sonuç). 48 oyunculuk ölçümün 16'şarlık her diliminde de
 * denetimler geçer (12'lik dilimlerin birinde Korteks grubu Sinir/Beyin Sapı grubunun altında kalıyordu; docs/12 §8).
 */
const P = Array.from({ length: 16 }, (_, k) => k);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const GROUPS = [[8, 12], [19, 23], [26, 30], [33, 36, 39]];
describe('zorluk eğrisi 4/4: bölge finalleri zinciri', () => {
  let s: Record<number, LevelScore> = {};
  beforeAll(() => { s = measureLevels(GROUPS.flat(), P); }, 1_200_000);
  const g = (i: number) => avg(GROUPS[i]!.map((n) => s[n]!.score));
  it('ardışık final grupları yükselir: (8,12) < (19,23) < (26,30) < (33,36,39)', () => {
    for (let i = 1; i < GROUPS.length; i++) expect(g(i), `${GROUPS[i]} > ${GROUPS[i - 1]}`).toBeGreaterThan(g(i - 1));
  });
  it('üç kademe: (8,12,19) < (23,26,30) < (33,36,39), her adım belirgin', () => {
    const t = (ns: number[]) => avg(ns.map((n) => s[n]!.score));
    expect(t([23, 26, 30])).toBeGreaterThan(t([8, 12, 19]) + 0.25);
    expect(t([33, 36, 39])).toBeGreaterThan(t([23, 26, 30]) + 0.25);
  });
  it('ikinci yarının finalleri ilk yarınınkilerden belirgin zor', () => {
    expect(avg([g(2), g(3)])).toBeGreaterThan(avg([g(0), g(1)]) + 0.5);
  });
});
