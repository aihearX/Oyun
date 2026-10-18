import { describe, expect, it } from 'vitest';
import { ALL_CHUNKS } from './chunks';

/** Dişli dönüşü kahramanı dikenin içinden geçirmemeli: dönüş halkası (ayak) diken kutusunun üstünde kalmalı. */
describe('dişli adaleti', () => {
  it('dişliye tutunan kahraman dikenlerin içinden geçmez', () => {
    const bad: string[] = [];
    for (const c of ALL_CHUNKS) {
      const gears = c.entities.filter((e) => e.type === 'gear');
      const spikes = c.entities.filter((e) => e.type === 'spike');
      for (const g of gears) {
        const r = Number(g.props?.r ?? 40); const reach = r + 4 + 17; const lowestFeet = g.y + r + 4;
        for (const s of spikes) {
          const sl = s.x, sr = s.x + (s.w ?? 32); const top = s.y - 16;
          if (sr > g.x - reach && sl < g.x + reach && lowestFeet > top) bad.push(`${c.id}: dişli x=${g.x} y=${g.y} r=${r} ↔ diken x=${s.x}-${sr}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
