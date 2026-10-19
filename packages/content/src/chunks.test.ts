import { describe, expect, it } from 'vitest';
import { GROUND_Y as G } from '@odi/shared';
import { ALL_CHUNKS, validateChunks } from './chunks';

const HELPERS = ['spring', 'trampoline', 'launcher', 'wall', 'hook', 'water'];

describe('parça kütüphanesi', () => {
  it('şemaya uyar', () => { expect(validateChunks(ALL_CHUNKS)).toEqual([]); });
  it('koşu parçaları yeterli', () => { expect(ALL_CHUNKS.filter((c) => c.mechanic === 'kosu').length).toBeGreaterThanOrEqual(12); });
  // Tam basılı zıplama ≈ 163 px. Daha yüksek bir basamak yalnızca hemen önündeki bir yardımcıyla (yay, zar, fırlatıcı, duvar,
  // kanca, sıvı) aşılabilir; asansör sayılmaz (zamanlaması kaçırılınca kahraman duvara çarpıp geri döner — 16. bölüm tuzağı).
  it('tek zıplamayla aşılamayan basamağın önünde yardımcı var (geri dönme tuzağı yok)', () => {
    const bad: string[] = [];
    for (const c of ALL_CHUNKS) for (const e of c.entities) {
      if (e.type !== 'platform' || (e.h ?? 24) <= 32) continue;
      const top = e.y, bot = e.y + (e.h ?? 0); if (!(top < G - 12 && bot >= G - 12)) continue;
      const before = c.entities.filter((f) => f !== e && f.type === 'platform' && (f.h ?? 24) > 32 && f.x < e.x && f.x + (f.w ?? 0) >= e.x - 4);
      const rise = (before.length ? Math.min(...before.map((f) => f.y)) : G) - top;
      const helper = c.entities.some((h) => HELPERS.includes(h.type) && h.x < e.x + 20 && h.x + (h.w ?? 0) > e.x - 420);
      if (rise > 155 && !helper) bad.push(`${c.id}: x=${e.x} yükselti ${rise}`);
    }
    expect(bad).toEqual([]);
  });
});
