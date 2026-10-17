import type { LevelSpec, RunResult } from './types';
import { STAR_COIN_RATIO } from './constants';

/** Skor: mesafe + jeton + süre bonusu − hasar. Yıldız: tamamla / hedef / jeton. */
export function scoreRun(spec: LevelSpec, r: Omit<RunResult, 'score' | 'stars'>): Pick<RunResult, 'score' | 'stars'> {
  if (!r.completed) return { score: Math.round(r.coins * 10), stars: 0 };
  const timeBonus = Math.max(0, Math.round((spec.parTimeSec - r.timeSec) * 5));
  const score = Math.round(spec.lengthPx / 10 + r.coins * 10 + timeBonus - r.damageTaken * 50 + (r.secretFound ? 500 : 0) + (r.objectiveMet ? 200 : 0));
  let stars: 1 | 2 | 3 = 1;
  if (r.objectiveMet) stars = 2;
  if (r.objectiveMet && spec.coinsTotal > 0 && r.coins >= spec.coinsTotal * STAR_COIN_RATIO) stars = 3;
  return { score: Math.max(0, score), stars };
}

export function xpForRun(r: RunResult): number { return r.completed ? 20 + r.stars * 10 + (r.secretFound ? 15 : 0) : 5; }
export function levelFromXp(xp: number): number { let l = 1; while (xp >= Math.round(100 * Math.pow(l + 1, 1.4))) l++; return l; }
