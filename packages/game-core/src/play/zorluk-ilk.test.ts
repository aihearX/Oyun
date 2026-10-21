import { beforeAll, describe, expect, it } from 'vitest';
import { firstTimerOf, scoreRuns, type LevelScore } from './human';
import { playHuman } from './testkit';

/**
 * İlk kez oynayan mobil oyuncu (human.ts → firstTimerOf: tepki 320-450 ms, sapma σ 120-160 ms, %10-15 geç, %4-6 kaçan girdi,
 * kazara kaydırma, ~0,9 sn ileri bakış) ilk bölümleri rahatça geçer (docs/12 §2, §4): 1-3'te herkes bitirir ve oyuncu başına
 * en çok 0,1 can kaybeder; 4-6'da en az %90'ı bitirir. 24 oyunculuk sabit tohumlu örneklem.
 */
const K = 24;
describe('ilk kez oynayan oyuncu: ilk bölümler', () => {
  const s: Record<number, LevelScore> = {};
  beforeAll(() => {
    for (let n = 1; n <= 6; n++) {
      const runs = Array.from({ length: K }, (_, k) => { const r = playHuman(n, { k, params: firstTimerOf(k) }); return { fin: r.finished, damage: r.damage, deaths: r.deaths, nearMisses: r.nearMisses, t: r.t }; });
      s[n] = scoreRuns(runs);
    }
  }, 1_200_000);
  it('1-3: herkes bitirir, oyuncu başına en çok 0,1 can', () => {
    for (const n of [1, 2, 3]) { expect(s[n]!.fin, `${n} bitirme`).toBe(1); expect(s[n]!.dmg, `${n} can kaybı`).toBeLessThanOrEqual(0.1); }
  });
  it('4-6: en az %90 bitirir', () => {
    for (const n of [4, 5, 6]) expect(s[n]!.fin, `${n} bitirme`).toBeGreaterThanOrEqual(0.9);
  });
});
