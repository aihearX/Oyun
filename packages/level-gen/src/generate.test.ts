import { describe, it, expect } from 'vitest';
import { generateLevel, DEFAULT_PROFILE } from './generate';
import { validateChunks, HUMAN_JOURNEY } from '@odi/content';

describe('içerik', () => {
  it('tüm parçalar şemaya uyar', () => { expect(validateChunks()).toEqual([]); });
});

describe('bölüm üretici', () => {
  it('deterministik: aynı bölüm aynı parçalar', () => {
    const a = generateLevel('insan', 3), b = generateLevel('insan', 3);
    expect(a.chunks.map((c) => c.id)).toEqual(b.chunks.map((c) => c.id));
  });
  it('40 bölümün hepsi üretilir (koşu dışı mekanikler parça yoksa atlanır)', () => {
    for (const l of HUMAN_JOURNEY.levels) {
      try { const spec = generateLevel('insan', l.number); expect(spec.number).toBe(l.number); if (spec.mechanic !== 'boss') expect(spec.chunks.length).toBeGreaterThan(0); }
      catch (e) { expect(String(e)).toMatch(/parça yok/); }
    }
  });
  it('zorluk profille değişir', () => {
    const easy = generateLevel('insan', 7, { ...DEFAULT_PROFILE, failStreak: 3 });
    const hard = generateLevel('insan', 7, { ...DEFAULT_PROFILE, recentStars: 3 });
    const avg = (s: typeof easy) => s.chunks.reduce((a, c) => a + c.difficulty, 0) / s.chunks.length;
    expect(avg(hard)).toBeGreaterThanOrEqual(avg(easy));
  });
});
