import type Phaser from 'phaser';
import type { Entity } from '@odi/shared';
import type { LevelContext, Scan } from './mechanics/types';

/** Kahramanın önünü tarar: engel, boşluk, basamak, jeton. Mekanik botları ve ipucu sistemi kullanır. */
export function scanAhead(ctx: LevelContext, range = 420): Scan {
  const hx = ctx.hero.x, feet = ctx.hero.y;
  const out: Scan = { hazard: null, gap: null, step: null, drop: null, coin: null };
  const near = (g: Phaser.Physics.Arcade.Group | Phaser.Physics.Arcade.StaticGroup) => (g.getChildren() as Phaser.Physics.Arcade.Sprite[]).filter((o) => o.active && o.body);
  // ölümcül
  for (const o of [...near(ctx.groups.hazards), ...near(ctx.groups.enemies)]) {
    const b = o.body as Phaser.Physics.Arcade.Body; const d = b.left - hx; if (d < -20 || d > range) continue;
    if (b.bottom < feet - 220) continue; // çok yukarıda (zıplayarak bile ulaşılmaz)
    if (!out.hazard || d < out.hazard.dist) out.hazard = { dist: d, type: (o.getData('e') as Entity).type, y: b.top, h: b.height };
  }
  // zemin desteği örneklemesi
  const plats = [...near(ctx.groups.platforms), ...near(ctx.groups.movers)].map((o) => o.body as Phaser.Physics.Arcade.Body);
  const support = (x: number): number | null => { let best: number | null = null; for (const b of plats) { if (x < b.left || x > b.right) continue; if (b.top < feet - 60) continue; if (best == null || b.top < best) best = b.top; } return best; };
  let gapStart = -1; const here = support(hx);
  for (let x = hx; x <= hx + range; x += 12) {
    const s = support(x);
    if (s == null) { if (gapStart < 0) gapStart = x; }
    else if (gapStart >= 0) { out.gap = { dist: gapStart - hx, width: x - gapStart }; break; }
    if (s != null && here != null && !out.drop && s > here + 40 && gapStart < 0) out.drop = { dist: x - hx, depth: s - here };
  }
  if (gapStart >= 0 && !out.gap) out.gap = { dist: gapStart - hx, width: range };
  for (const b of plats) { const d = b.left - hx; if (d <= 0 || d > range) continue; if (b.top < feet - 40 && b.top > feet - 260) { if (!out.step || d < out.step.dist) out.step = { dist: d, y: b.top }; } }
  for (const o of near(ctx.groups.coins)) { const d = o.x - hx; if (d <= 0 || d > range) continue; if (!out.coin || d < out.coin.dist) out.coin = { dist: d, y: o.y }; }
  return out;
}
