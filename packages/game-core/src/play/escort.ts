/**
 * Fısıltıyı Taşı: fısıltının tehlike derecesi (yalnız çizim ve gösterge için; kayıp kuralı sim.ts'de, buna dokunmaz).
 * Sesi kapalı oyuncu da düşmanın fısıltıya yaklaştığını görsün (OT-sessiz-oyuncu-7): 0 güvende, 1 değmek üzere.
 */
import { near, type World } from './world';
import { enemyAt, type SimState } from './sim';

/** tehlike bu uzaklıkta (px, isabet kutusunun kenarından) başlar ve kutuya değince 1 olur */
export const ESCORT_DANGER_PX = 90;
/** sim.ts'deki kayıp kutusu: |dx| < 26, |dy - 15| < 30 */
const HIT_X = 26, HIT_Y = 30;

export function escortDanger(w: World, s: SimState): number {
  const esc = s.escort; if (!esc || !esc.alive) return 0;
  let best = Infinity;
  for (const id of near(w, esc.x - HIT_X - ESCORT_DANGER_PX - 60, esc.x + HIT_X + ESCORT_DANGER_PX + 60)) {
    const e = w.ents[id]!; if (e.cls !== 'enemy' || s.killed.has(id)) continue;
    const p = enemyAt(e, s.t);
    const d = Math.max(0, Math.abs(esc.x - p.x) - HIT_X, Math.abs(esc.y - (p.y - 15)) - HIT_Y);
    if (d < best) best = d;
  }
  return best >= ESCORT_DANGER_PX ? 0 : 1 - best / ESCORT_DANGER_PX;
}
