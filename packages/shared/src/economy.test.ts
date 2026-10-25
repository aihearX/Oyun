import { describe, expect, it } from 'vitest';
import { noteThresholds, scoreRun } from './economy';
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
  it('süreli bölüm: 2★ target2 saniyede, 3★ hedef süresinde — notadan bağımsız; yavaş ama biten 1★', () => {
    const t = (): LevelSpec => ({ ...spec('timed'), objective: { id: 'timed', target: 80, target2: 95, label: '80 saniyede bitir' } });
    expect(scoreRun(t(), run({ coins: 40, timeSec: 120 })).stars).toBe(1);
    expect(scoreRun(t(), run({ coins: 40, timeSec: 94.9 })).stars).toBe(2);
    expect(scoreRun(t(), run({ coins: 40, timeSec: 79.5, objectiveMet: true })).stars).toBe(3);
    expect(scoreRun(t(), run({ coins: 60, timeSec: 120 })).stars).toBe(2);
    expect(scoreRun(t(), run({ coins: 90, timeSec: 120 })).stars).toBe(3);
    // eski kayıt (target2 yok): 2★ yalnız notayla
    expect(scoreRun({ ...t(), objective: { id: 'timed', target: 80, label: '' } }, run({ coins: 40, timeSec: 90 })).stars).toBe(1);
  });
  it('yüzme bölümü (MK-008): 2★ %45 notayla; 3★ eşikleri değişmez (%90 nota ya da %60 nota + hedef)', () => {
    const sw = (obj: ObjectiveId): LevelSpec => ({ ...spec(obj), mechanic: 'yuzme' });
    expect(noteThresholds(sw('reach')).star2).toBe(0.45); expect(noteThresholds(spec('reach')).star2).toBe(0.6);
    expect(scoreRun(sw('reach'), run({ coins: 44 })).stars).toBe(1);
    expect(scoreRun(sw('reach'), run({ coins: 45 })).stars).toBe(2);
    expect(scoreRun(sw('reach'), run({ coins: 89 })).stars).toBe(2);
    expect(scoreRun(sw('reach'), run({ coins: 90 })).stars).toBe(3);
    // hedefle 3★ yine %60 nota ister: eskortu kurtaran ama %50 nota toplayan 2★ kalır
    expect(scoreRun(sw('escort'), run({ coins: 50, objectiveMet: true })).stars).toBe(2);
    expect(scoreRun(sw('escort'), run({ coins: 60, objectiveMet: true })).stars).toBe(3);
    // süreli yüzme: süre kuralı aynen; nota yolu %45
    const t: LevelSpec = { ...sw('timed'), objective: { id: 'timed', target: 80, target2: 95, label: '' } };
    expect(scoreRun(t, run({ coins: 45, timeSec: 120 })).stars).toBe(2);
    expect(scoreRun(t, run({ coins: 30, timeSec: 79, objectiveMet: true })).stars).toBe(3);
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
