import { beforeAll, describe, expect, it } from 'vitest';
import { noteThresholds } from '@odi/shared';
import { playHumanStars } from './testkit';

/**
 * Süresiz yüzme bölümlerinin yıldızları (docs/12 §6; MK-008). Yüzmede bitirenler notaların ~%50'sini topluyor (su altındaki
 * notalar zor); %60 nota eşiğiyle bitirenlerin yalnız %2-27'si 2★ alıyordu. Yüzme bölümünde 2★ %45 nota; 3★ değişmez (%90 nota
 * ya da %60 nota + hedef). Kitle: 8 oyuncu (usta → acemi, iki tur), sabit tohumlar; 48 oyuncuyla `zorluk.mjs --yildiz`.
 */
const SWIM = [21, 22, 27, 28];
type Run = ReturnType<typeof playHumanStars>;
describe('süresiz yüzme bölümleri: 2★ ulaşılır, 3★ zor kalır', () => {
  const kitle: Record<number, Run[]> = {};
  beforeAll(() => { for (const n of SWIM) kitle[n] = Array.from({ length: 8 }, (_, k) => playHumanStars(n, { k })); }, 1_200_000);
  it('yüzme bölümleri yüzme eşiğini kullanır (2★ %45 nota), hedefle 3★ yine %60 nota ister', () => {
    for (const n of SWIM) {
      const sp = kitle[n]![0]!.spec; const t = noteThresholds(sp);
      expect(sp.mechanic, `${n}`).toBe('yuzme'); expect(sp.objective.id, `${n}`).not.toBe('timed');
      expect(t.star2, `${n}`).toBeLessThan(0.5); expect(t.star3, `${n}`).toBe(0.9);
      if (t.star3Objective !== null) expect(t.star3Objective, `${n}`).toBe(0.6);
    }
  });
  it('bitirenlerin en az %40\'ı 2★ alır (her bölümde), ama herkes değil', () => {
    let fin = 0, two = 0;
    for (const n of SWIM) {
      const f = kitle[n]!.filter((r) => r.finished); fin += f.length; const s2 = f.filter((r) => r.stars >= 2).length; two += s2;
      expect(f.length, `${n} bitiren`).toBeGreaterThan(0);
      expect(s2 / f.length, `${n}: 2★ oranı`).toBeGreaterThanOrEqual(0.4);
    }
    expect(two, '2★ herkese değil').toBeLessThan(fin);
  });
  it('3★ zor kalır: bitirenlerin en çok %25\'i; 3★ alan herkes %90 notaya ya da %60 nota + hedefe ulaşmıştır', () => {
    for (const n of SWIM) {
      const f = kitle[n]!.filter((r) => r.finished);
      expect(f.filter((r) => r.stars === 3).length / f.length, `${n}: 3★ oranı`).toBeLessThanOrEqual(0.25);
      for (const r of f) if (r.stars === 3) expect(r.coins / r.spec.coinsTotal, `${n}`).toBeGreaterThanOrEqual(0.6);
    }
  });
});
