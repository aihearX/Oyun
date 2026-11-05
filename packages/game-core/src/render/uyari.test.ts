import { describe, expect, it } from 'vitest';
import { BIOME_ART } from './palette';
import { bossHitLabel, contrast, over, WARN_EDGE, WARN_INK, WARN_MIN_ALPHA, WARN_RING, warnPulse } from './uyari';

/** canavar bölümü okunurluğu (YN-233): uyarı gölgesi ve halkası her biyom zemininde ≥ 3:1 */
describe('canavar uyarı renkleri (render/uyari.ts)', () => {
  const biomes = Object.values(BIOME_ART);

  it('dolu koyu gölge her biyomun açık zemin üstünde ≥ 3:1 (yüksek görünürlükte tam opak; normalde nabzın en düşüğünde de)', () => {
    for (const b of biomes) for (const top of [b.ground.top, b.ground.topHi]) {
      expect(contrast(WARN_INK, top), `${b.id} ${top.toString(16)}`).toBeGreaterThanOrEqual(3);
      expect(contrast(over(top, WARN_INK, WARN_MIN_ALPHA), top), `${b.id} nabız`).toBeGreaterThanOrEqual(3);
    }
  });

  it('açık halka koyu zemin gövdesinde, arka planda ve gölgenin kendi dolgusunda ≥ 3:1', () => {
    for (const ring of Object.values(WARN_RING)) {
      expect(contrast(ring, WARN_INK)).toBeGreaterThanOrEqual(3);
      expect(contrast(ring, WARN_EDGE)).toBeGreaterThanOrEqual(3);
      for (const b of biomes) for (const bg of [b.ground.body, b.ground.deep, b.near, b.fg]) expect(contrast(ring, bg), `${b.id} ${ring.toString(16)}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('zeminin her tonunda (kenarın koyu gölgesi dahil) gölgenin dolgusu ya da halkası ≥ 3:1', () => {
    for (const ring of Object.values(WARN_RING)) for (const b of biomes) for (const bg of Object.values(b.ground)) {
      expect(Math.max(contrast(WARN_INK, bg), contrast(ring, bg)), `${b.id} ${bg.toString(16)}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('nabız: yüksek görünürlükte / azaltılmış harekette sabit 1; normalde en çok ~2,5 Hz ve küçük genlik', () => {
    for (let t = 0; t < 3; t += 1 / 60) expect(warnPulse(t, true)).toBe(1);
    let lo = 1, rises = 0, prev = warnPulse(0, false), up = false;
    for (let i = 1; i < 600; i++) { const a = warnPulse(i / 60, false); lo = Math.min(lo, a); const u = a > prev; if (u && !up) rises++; up = u; prev = a; }
    expect(lo).toBeGreaterThanOrEqual(WARN_MIN_ALPHA - 1e-9);
    expect(rises / 10).toBeLessThan(3);
  });

  it('hasar yazısı kime olduğunu söyler', () => {
    expect(bossHitLabel('canavar', 3)).toBe('Canavar −3');
    expect(bossHitLabel('golem', 2)).toBe('Golem −2');
  });
});
