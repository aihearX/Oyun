import { describe, expect, it } from 'vitest';
import { GROUND_Y } from '@odi/shared';
import { setup, testSpec } from './testkit';
import { escortDanger } from './escort';

/** duran (dx 0) düşman: fısıltının yakınına konunca tehlike artar, değince 1; fısıltı yoksa ya da kaybolduysa 0 */
describe('escortDanger', () => {
  /** gap: düşmanın fısıltıdan yatay uzaklığı (px; dünya kurulurken bölüm başı kaydırılır, fısıltı düşmana göre konur) */
  const at = (gap: number) => {
    const { w, s } = setup(testSpec([{ type: 'enemy', x: 600, y: GROUND_Y, props: { dx: 0 } }]));
    const e = w.ents.find((o) => o.cls === 'enemy')!;
    s.escort = { x: e.x - gap, y: GROUND_Y - 40, alive: true };
    return { w, s };
  };
  it('uzak düşman tehlike değil', () => { const { w, s } = at(400); expect(escortDanger(w, s)).toBe(0); });
  it('yaklaştıkça artar, değince 1', () => {
    const far = at(26 + 80), mid = at(26 + 30), hit = at(10);
    const a = escortDanger(far.w, far.s), b = escortDanger(mid.w, mid.s), c = escortDanger(hit.w, hit.s);
    expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(a); expect(c).toBe(1);
  });
  it('yenilen düşman, kaybolan ya da olmayan fısıltı: 0', () => {
    const k = at(10); k.s.killed.set(k.w.ents.find((e) => e.cls === 'enemy')!.id, 0); expect(escortDanger(k.w, k.s)).toBe(0);
    const l = at(10); l.s.escort!.alive = false; expect(escortDanger(l.w, l.s)).toBe(0);
    const n = at(10); n.s.escort = null; expect(escortDanger(n.w, n.s)).toBe(0);
  });
});
