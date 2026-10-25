import { beforeAll, describe, expect, it } from 'vitest';
import { firstTimerOf, scoreRuns, type LevelScore } from './human';
import { playHuman } from './testkit';

/**
 * İlk kez oynayan mobil oyuncu (human.ts → firstTimerOf: tepki 320-450 ms, sapma σ 120-160 ms, %10-15 geç, %4-6 kaçan girdi,
 * kazara kaydırma, ~0,9 sn ileri bakış) ilk bölümleri rahatça geçer (docs/12 §2, §4): 1-3'te herkes bitirir ve oyuncu başına
 * en çok 0,1 can kaybeder; 4-6'da en az %90'ı, 7'de %80'i, 8'de (Kanal finali) %70'i, 9-12'de (Zar) %65'i bitirir.
 * 24 oyunculuk sabit tohumlu örneklem.
 */
const K = 24;
describe('ilk kez oynayan oyuncu: ilk bölümler', () => {
  const s: Record<number, LevelScore> = {};
  beforeAll(() => {
    for (let n = 1; n <= 12; n++) {
      const runs = Array.from({ length: K }, (_, k) => { const r = playHuman(n, { k, params: firstTimerOf(k) }); return { fin: r.finished, damage: r.damage, deaths: r.deaths, nearMisses: r.nearMisses, t: r.t }; });
      s[n] = scoreRuns(runs);
    }
  }, 2_400_000);
  it('1-3: herkes bitirir, oyuncu başına en çok 0,1 can', () => {
    for (const n of [1, 2, 3]) { expect(s[n]!.fin, `${n} bitirme`).toBe(1); expect(s[n]!.dmg, `${n} can kaybı`).toBeLessThanOrEqual(0.1); }
  });
  it('4-6: en az %90 bitirir', () => {
    for (const n of [4, 5, 6]) expect(s[n]!.fin, `${n} bitirme`).toBeGreaterThanOrEqual(0.9);
  });
  it('7: en az %80, 8 (Kanal finali): en az %70, 9-12 (Zar): en az %65 bitirir', () => {
    expect(s[7]!.fin, '7 bitirme').toBeGreaterThanOrEqual(0.8);
    expect(s[8]!.fin, '8 bitirme').toBeGreaterThanOrEqual(0.7);
    for (const n of [9, 10, 11, 12]) expect(s[n]!.fin, `${n} bitirme`).toBeGreaterThanOrEqual(0.65);
  });
  // kademe adımı ve bölge doruğu ilk bölgelerde bu kademeyle ölçülür (docs/12 §6; MK-003): kitlede 8 ile 12'nin can kaybı
  // gürültü düzeyinde. 4 (Rüzgâr Bayrak Yarışı) bu kademede can kaybında 5'e eşit (0,67 / 0,58 ± 0,15): 5 bitirmede doruk.
  it('bölge finalleri 5 → 8 → 12 kademe kademe zor; her final bölgesinde en düşük bitirme, girişlerden yüksek puan', () => {
    expect(s[8]!.fin, '8 < 5').toBeLessThan(s[5]!.fin); expect(s[12]!.fin, '12 < 8').toBeLessThan(s[8]!.fin);
    expect(s[8]!.score, '8 > 5').toBeGreaterThan(s[5]!.score); expect(s[12]!.score, '12 > 8').toBeGreaterThan(s[8]!.score);
    for (const [f, zone, easier] of [[5, [1, 2, 3, 4], [1, 2, 3]], [8, [6, 7], [6, 7]], [12, [9, 10, 11], [9, 10, 11]]] as const) {
      for (const n of zone) expect(s[f]!.fin, `${f} bitirme ≤ ${n}`).toBeLessThanOrEqual(s[n]!.fin);
      for (const n of easier) expect(s[f]!.score, `${f} > ${n}`).toBeGreaterThan(s[n]!.score);
    }
  });
});
