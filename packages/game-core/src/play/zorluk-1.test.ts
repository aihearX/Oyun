import { beforeAll, describe, expect, it } from 'vitest';
import type { LevelScore } from './human';
import { measureLevels } from './testkit';

/**
 * Zorluk eğrisinin biçimi (docs/12-zorluk-egrisi.md), insan benzeri oyuncu modeliyle (play/human.ts) ölçülür: kitlenin dört
 * oyuncusu (usta → acemi, k = 0..3) her bölümü bir kez oynar. Alt örneklem: bölge girişleri, finaller, boss'lar. Dört oyuncuyla
 * tek bölümün puanı gürültülüdür (±0,5–1); bu yüzden tek tek değil, girişlerin ve finallerin ortalamaları karşılaştırılır.
 * Bölüm bölüm eğri (24 oyuncu): `node tools/harness/zorluk.mjs --bolumler --k 24`.
 * 1/3: alıştırma, Dış Kulak, Kanal, Zar, Kemikçikler ve Serumen Golemi (20).
 */
const P = [0, 1, 2, 3];
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
describe('zorluk eğrisi 1/3: alıştırma ve ilk bölgeler', () => {
  let s: Record<number, LevelScore> = {};
  beforeAll(() => { s = measureLevels([1, 2, 3, 5, 6, 8, 9, 12, 13, 19, 20, 21], P); }, 900_000);
  const sc = (n: number) => s[n]!.score;
  it('alıştırma (1-3): herkes bitirir, neredeyse hiç can kaybı yok', () => {
    for (const n of [1, 2, 3]) expect(s[n]!.fin, `bölüm ${n}`).toBe(1);
    expect(s[1]!.dmg + s[2]!.dmg + s[3]!.dmg, 'üç bölümde oyuncu başına toplam can kaybı').toBeLessThanOrEqual(0.5);
  });
  it('bölge finalleri bölge girişlerinden zor', () => {
    expect(avg([5, 8, 12, 19].map(sc))).toBeGreaterThan(avg([1, 6, 9, 13].map(sc)) + 0.5);
  });
  it('Serumen Golemi (20) büyük doruk: finallerden ve her girişten zor ama yenilebilir; ardından nefes', () => {
    expect(sc(20)).toBeGreaterThan(avg([5, 8, 12, 19].map(sc)));
    for (const n of [1, 2, 3, 6, 9, 13]) expect(sc(20), `20 > ${n}`).toBeGreaterThan(sc(n));
    expect(s[20]!.fin).toBeGreaterThanOrEqual(0.5);
    expect(sc(21)).toBeLessThan(sc(20));
  });
});
