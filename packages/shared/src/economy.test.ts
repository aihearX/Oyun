import { describe, expect, it } from 'vitest';
import { scoreRun } from './economy';
import type { LevelSpec, ObjectiveId, RunResult } from './types';

const spec = (obj: ObjectiveId, coinsTotal = 100): LevelSpec => ({ id: 'x', number: 5, journey: 'insan', name: 'x', biome: 'dis-kulak', mechanic: 'kosu', objective: { id: obj, label: 'Hedef' }, modifiers: [], seed: 1, chunks: [], lengthPx: 5000, parTimeSec: 60, coinsTotal });
const run = (o: Partial<RunResult> = {}): Omit<RunResult, 'score' | 'stars'> => ({ levelId: 'x', completed: true, coins: 0, timeSec: 50, deaths: 0, damageTaken: 0, objectiveMet: false, secretFound: false, ...o });

describe('yıldız kuralı (docs/11 §5)', () => {
  it('bitirmemek 0 yıldız', () => { expect(scoreRun(spec('reach'), run({ completed: false, coins: 99 })).stars).toBe(0); });
  it('1★ bitir, 2★ %60 nota, 3★ %90 nota', () => {
    expect(scoreRun(spec('reach'), run({ coins: 59, objectiveMet: true })).stars).toBe(1);
    expect(scoreRun(spec('reach'), run({ coins: 60, objectiveMet: true })).stars).toBe(2);
    expect(scoreRun(spec('reach'), run({ coins: 89, objectiveMet: true })).stars).toBe(2);
    expect(scoreRun(spec('reach'), run({ coins: 90 })).stars).toBe(3);
  });
  it('3★ bölüm hedefiyle de gelir (2★ üstüne); "kapıya ulaş" hedef sayılmaz', () => {
    expect(scoreRun(spec('no-damage'), run({ coins: 60, objectiveMet: true })).stars).toBe(3);
    expect(scoreRun(spec('no-damage'), run({ coins: 40, objectiveMet: true })).stars).toBe(1);
    expect(scoreRun(spec('reach'), run({ coins: 70, objectiveMet: true })).stars).toBe(2);
  });
  it('notasız boss: hasarsız 3★, 1 hasar 2★', () => {
    expect(scoreRun(spec('boss', 0), run({ objectiveMet: true })).stars).toBe(3);
    expect(scoreRun(spec('boss', 0), run({ objectiveMet: true, damageTaken: 1 })).stars).toBe(2);
    expect(scoreRun(spec('boss', 0), run({ objectiveMet: true, damageTaken: 2 })).stars).toBe(1);
  });
  it('altın koklealar skoru artırır', () => {
    expect(scoreRun(spec('reach'), run({ coins: 50, extra: { cochleas: 3 }, secretFound: true })).score).toBeGreaterThan(scoreRun(spec('reach'), run({ coins: 50 })).score);
  });
});
