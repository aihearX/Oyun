// Üst çubuk ve harita haplarındaki sayı (fmtHud, YN-087): "B" kısaltması yok (Türkçede yerleşik değil, "billion" gibi okunuyor);
// 99.999'a kadar tam, sonra "123 bin" / "1,2 mn" (aşağı yuvarlanır). Profil'deki bölüm sayısı tekrarları saymaz (YN-048).
import { describe, expect, it } from 'vitest';
import { HUMAN_JOURNEY } from '@odi/content';
import { fmtHud } from './ui/social';
import { passedCount } from './ftue/features';

describe('fmtHud', () => {
  it('99.999\'a kadar tam sayı (11.070 görünür, 11.000–11.999 arası ödüller kaybolmaz)', () => {
    expect(fmtHud(0)).toBe('0');
    expect(fmtHud(999)).toBe('999');
    expect(fmtHud(1409)).toBe('1.409');
    expect(fmtHud(11_070)).toBe('11.070');
    expect(fmtHud(11_120)).toBe('11.120');
    expect(fmtHud(99_999)).toBe('99.999');
  });
  it('sonra "bin" / "mn", aşağı yuvarlanarak; eksi ve kesir yok', () => {
    expect(fmtHud(100_000)).toBe('100 bin');
    expect(fmtHud(123_999)).toBe('123 bin');
    expect(fmtHud(1_234_567)).toBe('1,2 mn');
    expect(fmtHud(-5)).toBe('0');
    expect(fmtHud(41.6)).toBe('42');
  });
  it('hiçbir değerde "B" ya da "M" kısaltması yok', () => {
    for (const v of [1000, 4321, 10_000, 98_765, 250_000, 5_000_000]) expect(fmtHud(v)).not.toMatch(/\d\s?[BM]$/);
  });
});

describe('Profil bölüm sayısı (passedCount)', () => {
  const total = HUMAN_JOURNEY.levels.length;
  const all = Object.fromEntries(Array.from({ length: total }, (_, i) => [i + 1, { stars: 3 }]));
  it('bütün bölümler bitince toplamı geçmez (40/40, "41" değil)', () => {
    expect(passedCount(all, total)).toBe(total);
    expect(passedCount({ ...all, [total + 1]: { stars: 1 } }, total)).toBe(total);
  });
  it('yıldızsız (kaybedilmiş) bölüm sayılmaz', () => {
    expect(passedCount({ 1: { stars: 2 }, 2: { stars: 0 }, 3: { stars: 1 } }, total)).toBe(2);
    expect(passedCount({}, total)).toBe(0);
  });
});
