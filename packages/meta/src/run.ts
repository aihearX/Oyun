import { xpForRun, type RunResult } from '@odi/shared';
import { LUCKY_NOTE, treasureAt, type RewardItem } from '@odi/content';
import { FEAT, type PlayerCore } from './state';
import { applyGrant } from './rewards';
import { applyQuestDeltas, ensureDaily, questDeltasFromRun, type QuestChange } from './daily';
import { settle, type MetaEvent } from './unlocks';
import { levelProgress, nextGoal, unlockAnnouncements, type Announcement, type NextGoal, type RunSpecLite } from './progress';

/** Sonuç ekranının anlattığı her şey: animasyonlar bu özeti oynatır, durumu değiştirmez. */
export interface RunSummary {
  level: number;
  prevBest: number; prevStars: number;
  newRecord: boolean; firstClear: boolean;
  xpBefore: number; xpAfter: number; levelBefore: number; levelAfter: number;
  coinsBefore: number; coinsAfter: number;
  /** bölümde toplanan jeton (cüzdana uçan) */
  coinsEarned: number; xpEarned: number;
  lucky: RewardItem[] | null; treasure: RewardItem[] | null;
  quests: QuestChange[];
  announcements: Announcement[];
  events: MetaEvent[];
  goal: NextGoal;
  firsts: string[];
  /** bu koşunun ödül defteri kayıtları (bölüm, Şanslı Nota, hazine, başarım…): jetonları toplamı coinsAfter − coinsBefore, XP'leri xpAfter − xpBefore */
  grants: { reason: string; items: RewardItem[] }[];
}

/** Bölüm sonucunu işler: ilerleme, sayaçlar, ödüller (hepsi applyGrant'tan), görevler, açılımlar. Saf. */
export function processRun<T extends PlayerCore>(core: T, spec: RunSpecLite, r: RunResult, today: string, now = Date.now()): { core: T; summary: RunSummary } {
  const n = spec.number; const prev = core.progress[n] ?? { stars: 0, best: 0, plays: 0 };
  const xpBefore = core.xp, coinsBefore = core.coins;
  const maxCombo = typeof r.extra?.maxCombo === 'number' ? r.extra.maxCombo : 0;
  const lucky = r.extra?.luckyNote === true;
  const firsts = typeof r.extra?.firsts === 'string' && r.extra.firsts ? r.extra.firsts.split(',').filter((f) => !core.meta.firsts.includes(f)) : [];

  // ilerleme + sayaçlar
  const progress = { ...core.progress, [n]: { stars: Math.max(prev.stars, r.stars), best: Math.max(prev.best, r.score), plays: prev.plays + 1, lastResult: r } };
  const s = { ...core.meta.stats };
  s.plays++; s.coins += r.coins; s.maxCombo = Math.max(s.maxCombo, maxCombo); if (lucky) s.lucky++;
  let feat = core.meta.feats[n] ?? 0;
  if (r.completed) {
    s.clears++; feat |= FEAT.CLEAR;
    if (r.damageTaken === 0) { s.noDamage++; feat |= FEAT.NO_DAMAGE; }
    if (r.timeSec < spec.parTimeSec) { s.underPar++; feat |= FEAT.UNDER_PAR; }
    if (r.stars === 3) feat |= FEAT.THREE;
    if (r.stars === 3 && r.damageTaken === 0) { s.perfect++; feat |= FEAT.PERFECT; }
    if (r.secretFound) feat |= FEAT.SECRET;
    if (r.objectiveMet) {
      if (spec.objective.id === 'boss') feat |= FEAT.BOSS;
      if (spec.objective.id === 'melody') s.melody++;
      if (spec.objective.id === 'escort') s.escort++;
      if (spec.objective.id === 'timed') s.timed++;
      if (spec.objective.id === 'collect-all') s.collectAll++;
    }
    if (core.failStreak >= 2) s.comebacks++;
  } else s.fails++;

  const daily0 = ensureDaily(core.meta.daily, today);
  const { daily, changes } = applyQuestDeltas(daily0, questDeltasFromRun({ completed: r.completed, stars: r.stars, coins: r.coins, damageTaken: r.damageTaken, timeSec: r.timeSec, parTimeSec: spec.parTimeSec, maxCombo, prevStars: prev.stars }));

  let c: T = {
    ...core, progress, failStreak: r.completed ? 0 : core.failStreak + 1,
    meta: { ...core.meta, stats: s, feats: { ...core.meta.feats, [n]: feat }, daily, firsts: [...core.meta.firsts, ...firsts] },
  };
  // ödüller: tek kapıdan
  const xpEarned = xpForRun(r);
  c = applyGrant(c, [{ kind: 'jeton', amount: r.coins }, { kind: 'xp', amount: xpEarned }], `bolum:${n}`, now).core;
  let luckyApplied: RewardItem[] | null = null;
  if (lucky) { const g = applyGrant(c, LUCKY_NOTE.reward, 'sansli-nota', now); c = g.core; luckyApplied = g.applied; }
  let treasureApplied: RewardItem[] | null = null;
  const firstClear = r.completed && prev.stars === 0;
  const t = treasureAt(n);
  if (r.completed && t && !c.meta.treasures.includes(n)) { c = { ...c, meta: { ...c.meta, treasures: [...c.meta.treasures, n] } }; const g = applyGrant(c, t.reward, `hazine:${n}`, now); c = g.core; treasureApplied = g.applied; }

  const settled = settle(c, now); c = settled.core;
  const oldLedger = new Set(core.meta.ledger);
  const summary: RunSummary = {
    level: n, prevBest: prev.best, prevStars: prev.stars, newRecord: r.completed && prev.best > 0 && r.score > prev.best, firstClear,
    xpBefore, xpAfter: c.xp, levelBefore: levelProgress(xpBefore).level, levelAfter: levelProgress(c.xp).level,
    coinsBefore, coinsAfter: c.coins, coinsEarned: r.coins, xpEarned,
    lucky: luckyApplied, treasure: treasureApplied, quests: changes,
    announcements: firstClear ? unlockAnnouncements(n) : [], events: settled.events,
    goal: nextGoal(spec, r, c.progress), firsts,
    grants: c.meta.ledger.filter((g) => !oldLedger.has(g)).map((g) => ({ reason: g.reason, items: g.items })),
  };
  return { core: c, summary };
}
