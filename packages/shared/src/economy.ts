import type { LevelSpec, RunResult } from './types';
import { STAR2_NOTE_RATIO, STAR3_NOTE_RATIO, SWIM_STAR2_NOTE_RATIO } from './constants';

/** Hedefin 3. yıldız sayılması için anlamlı olup olmadığı ('reach' zaten bitirmektir) */
export const objectiveCountsForStar = (spec: Pick<LevelSpec, 'objective'>) => spec.objective.id !== 'reach';

/**
 * Bölümün nota eşikleri (oran; tek tanım — `scoreRun` ve sonuç ekranının "sıradaki yıldız" ipucu, meta `nextGoal`):
 * `star2` 2★ · `star3` 3★ tek başına · `star3Objective` 3★ bölüm hedefiyle birlikte (hedef yıldız saymıyorsa null; süreli bölümde
 * süre hedefi notasız 3★ verir → 0). Yüzme bölümünde 2★ %45 notayla gelir; hedefle 3★ yine %60 nota ister (3★ kolaylaşmaz).
 */
export function noteThresholds(spec: Pick<LevelSpec, 'mechanic' | 'objective'>): { star2: number; star3: number; star3Objective: number | null } {
  return {
    star2: spec.mechanic === 'yuzme' ? SWIM_STAR2_NOTE_RATIO : STAR2_NOTE_RATIO,
    star3: STAR3_NOTE_RATIO,
    star3Objective: !objectiveCountsForStar(spec) ? null : spec.objective.id === 'timed' ? 0 : STAR2_NOTE_RATIO,
  };
}

/**
 * Yıldız kuralı (docs/11 §5): 1★ bitir · 2★ notaların %60'ı (yüzme bölümünde %45'i) · 3★ (2★ üstüne) notaların %90'ı YA DA
 * %60 nota ve bölüm hedefi.
 * Notasız bölümlerde (boss) 2★ en çok 1 hasar, 3★ hasarsız. Süreli bölümde yıldız süreyle de gelir (notadan bağımsız; docs/12 §6):
 * 2★ `target2` saniyede, 3★ hedef süresinde (`target`) bitir — eşikler insan modeliyle ölçülür.
 * Skor: mesafe + nota + süre bonusu − hasar + altın koklealar + hedef.
 */
export function scoreRun(spec: LevelSpec, r: Omit<RunResult, 'score' | 'stars'>): Pick<RunResult, 'score' | 'stars'> {
  if (!r.completed) return { score: Math.round(r.coins * 10), stars: 0 };
  const cochleas = typeof r.extra?.cochleas === 'number' ? r.extra.cochleas : r.secretFound ? 1 : 0;
  const timeBonus = Math.max(0, Math.round((spec.parTimeSec - r.timeSec) * 5));
  const score = Math.round(spec.lengthPx / 10 + r.coins * 10 + timeBonus - r.damageTaken * 50 + cochleas * 150 + (r.secretFound ? 300 : 0) + (r.objectiveMet ? 200 : 0));
  let stars: 1 | 2 | 3 = 1;
  if (spec.coinsTotal <= 0) {
    if (r.damageTaken <= 1) stars = 2;
    if (r.damageTaken === 0) stars = 3;
  } else {
    const ratio = r.coins / spec.coinsTotal; const t = noteThresholds(spec); const at = (q: number) => ratio >= q - 1e-9;
    if (at(t.star2)) stars = 2;
    if (stars === 2 && (at(t.star3) || (r.objectiveMet && t.star3Objective !== null && at(t.star3Objective)))) stars = 3;
    const o = spec.objective;
    if (o.id === 'timed') { if (r.objectiveMet) stars = 3; else if (o.target2 && r.timeSec <= o.target2) stars = Math.max(stars, 2) as 2 | 3; }
  }
  return { score: Math.max(0, score), stars };
}

export function xpForRun(r: RunResult): number { return r.completed ? 20 + r.stars * 10 + (r.secretFound ? 15 : 0) : 5; }
export function levelFromXp(xp: number): number { let l = 1; while (xp >= Math.round(100 * Math.pow(l + 1, 1.4))) l++; return l; }
