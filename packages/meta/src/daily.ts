import { hashString, mulberry32 } from '@odi/shared';
import { CALENDAR, DAILY_CHEST_BASE, QUESTS, R, questById, type QuestDef, type QuestMetric, type Reward, type RewardItem } from '@odi/content';
import type { DailyState, PlayerCore } from './state';
import { applyGrant, resolveReward } from './rewards';
import { nextChestCard } from './unlocks';
import { daysBetween } from './time';

// ---------------------------------------------------------------- günlük görevler

/**
 * Günün 3 görevi: her yuvadan (a kolay, b beceri, c çeşitlilik) bir tane; tarih tohumuyla, herkes için aynı.
 * `cleared` (art arda geçilen bölüm) verilirse özelliği henüz açılmamış görev (QuestDef.after) verilmez: o yuva için
 * aynı günün ayrı tohumuyla açık havuzdan biri seçilir (öteki yuvalar ve açılımı tam oyuncunun görevleri değişmez).
 */
export function rollDailyQuests(day: string, cleared = Infinity): QuestDef[] {
  const rng = mulberry32(hashString(`odi-gunluk:${day}`));
  return (['a', 'b', 'c'] as const).map((slot) => {
    const pool = QUESTS.filter((q) => q.slot === slot); const pick = pool[Math.floor(rng() * pool.length)]!;
    if ((pick.after ?? 0) <= cleared) return pick;
    const open = pool.filter((q) => (q.after ?? 0) <= cleared);
    return open[Math.floor(mulberry32(hashString(`odi-gunluk:${day}:${slot}`))() * open.length)] ?? pick;
  });
}
/**
 * Günün görev durumu. Kayıtlı gün bugünse korunur; yalnız özelliği açılmamış, hiç ilerlemeyen ve alınmamış görev
 * aynı yuvanın o günkü yapılabilir göreviyle değişir (deterministik; ilerleme olan görev ve açılmış sandık dokunulmaz).
 * Görev eklenmez: gün içinde özellik açılsa da o günün görevleri değişmez.
 */
export function ensureDaily(daily: DailyState | null, day: string, cleared = Infinity): DailyState {
  if (!daily || daily.day !== day) return { day, chestOpened: false, quests: rollDailyQuests(day, cleared).map((q) => ({ id: q.id, progress: 0, claimed: false })) };
  if (daily.chestOpened) return daily;
  let alt: QuestDef[] | null = null; let changed = false;
  const quests = daily.quests.map((q) => {
    const def = questById(q.id);
    if (!def || (def.after ?? 0) <= cleared || q.progress > 0 || q.claimed) return q;
    alt ??= rollDailyQuests(day, cleared);
    const sub = alt.find((x) => x.slot === def.slot);
    if (!sub || daily.quests.some((x) => x.id === sub.id)) return q;
    changed = true; return { id: sub.id, progress: 0, claimed: false };
  });
  return changed ? { ...daily, quests } : daily;
}
/** art arda geçilen bölüm sayısı (görev açılımları bununla; apps/web ftue clearedCount ile aynı kural) */
export function clearedInRow(progress: Record<number, { stars: number } | undefined>): number {
  let n = 0; while (progress[n + 1] && progress[n + 1]!.stars > 0) n++; return n;
}
/** oyuncunun bugünkü görevleri: açılımına göre (ekranlar ve bütün görev işlemleri bunu kullanır) */
export const dailyFor = (core: Pick<PlayerCore, 'meta' | 'progress'>, day: string): DailyState => ensureDaily(core.meta.daily, day, clearedInRow(core.progress));

export type QuestDeltas = Partial<Record<QuestMetric, number>>;
export interface RunFacts { completed: boolean; stars: number; coins: number; damageTaken: number; timeSec: number; parTimeSec: number; maxCombo: number; prevStars: number }
export function questDeltasFromRun(f: RunFacts): QuestDeltas {
  return {
    plays: 1, clears: f.completed ? 1 : 0, clears2: f.completed && f.stars >= 2 ? 1 : 0, threeStar: f.stars === 3 ? 1 : 0, coins: f.coins,
    noDamage: f.completed && f.damageTaken === 0 ? 1 : 0, underPar: f.completed && f.timeSec < f.parTimeSec ? 1 : 0,
    combo10: f.maxCombo >= 10 ? 1 : 0, replay: f.prevStars > 0 ? 1 : 0,
  };
}
export interface QuestChange { id: string; text: string; emoji: string; before: number; after: number; target: number; justDone: boolean }
export function applyQuestDeltas(daily: DailyState, deltas: QuestDeltas): { daily: DailyState; changes: QuestChange[] } {
  const changes: QuestChange[] = [];
  const quests = daily.quests.map((q) => {
    const def = questById(q.id); const d = def ? deltas[def.metric] ?? 0 : 0;
    if (!def || d <= 0 || q.progress >= def.target) return q;
    const after = Math.min(def.target, q.progress + d);
    changes.push({ id: q.id, text: def.text, emoji: def.emoji, before: q.progress, after, target: def.target, justDone: after >= def.target });
    return { ...q, progress: after };
  });
  return { daily: { ...daily, quests }, changes };
}
export const questDone = (q: { id: string; progress: number }) => q.progress >= (questById(q.id)?.target ?? Infinity);

export function claimQuest<T extends PlayerCore>(core: T, id: string, day: string, now = Date.now()): { core: T; applied: RewardItem[] } | null {
  const daily = dailyFor(core, day); const q = daily.quests.find((x) => x.id === id); const def = questById(id);
  if (!q || !def || q.claimed || !questDone(q)) return null;
  const next = { ...core, meta: { ...core.meta, daily: { ...daily, quests: daily.quests.map((x) => (x.id === id ? { ...x, claimed: true } : x)) }, stats: { ...core.meta.stats, quests: core.meta.stats.quests + 1 } } };
  return applyGrant(next, def.reward, `gorev:${id}`, now);
}

/** Sandık içeriği (önceden görünür): taban + sıradaki sandık kartı (yoksa +30 jeton). */
export function dailyChestReward(core: PlayerCore): Reward {
  const card = nextChestCard(core);
  return [...DAILY_CHEST_BASE, card ? R.kart(card.id) : R.jeton(30)];
}
export function chestReady(daily: DailyState): boolean { return !daily.chestOpened && daily.quests.length > 0 && daily.quests.every(questDone); }
/** Sandığı aç: henüz alınmamış görev ödülleri de verilir. */
export function openDailyChest<T extends PlayerCore>(core: T, day: string, now = Date.now()): { core: T; applied: RewardItem[] } | null {
  const daily = dailyFor(core, day); if (!chestReady(daily)) return null;
  let c: T = { ...core, meta: { ...core.meta, daily } }; const applied: RewardItem[] = [];
  for (const q of daily.quests) if (!q.claimed) { const r = claimQuest(c, q.id, day, now); if (r) { c = r.core; applied.push(...r.applied); } }
  const reward = dailyChestReward(c);
  c = { ...c, meta: { ...c.meta, daily: { ...c.meta.daily!, chestOpened: true }, stats: { ...c.meta.stats, chests: c.meta.stats.chests + 1 } } };
  const g = applyGrant(c, reward, 'gunluk-sandik', now);
  return { core: g.core, applied: [...applied, ...g.applied] };
}

// ---------------------------------------------------------------- seri (gün sayacı) + seri koruyucu

export type StreakEvent = { kind: 'same' } | { kind: 'first' } | { kind: 'continued'; streak: number } | { kind: 'saved'; streak: number; used: number } | { kind: 'reset'; previous: number };
/**
 * Yeni güne geçiş. Kaçırılan her gün için bir seri koruyucu varsa seri korunur (dürüst: koruyucu harcanır, gün sayılmaz).
 * Koruyucu yetmezse seri 1'den başlar; dil suçlamasız.
 */
export function advanceStreak<T extends PlayerCore>(core: T, today: string): { core: T; event: StreakEvent } {
  if (core.lastDay === today) return { core, event: { kind: 'same' } };
  const gap = core.lastDay ? daysBetween(core.lastDay, today) : null;
  let streak = 1; let shields = core.meta.shields; let event: StreakEvent;
  if (gap == null || gap < 1) event = { kind: 'first' };
  else if (gap === 1) { streak = core.streak + 1; event = { kind: 'continued', streak }; }
  else if (gap - 1 <= shields && core.streak > 0) { shields -= gap - 1; streak = core.streak + 1; event = { kind: 'saved', streak, used: gap - 1 }; }
  else event = { kind: 'reset', previous: core.streak };
  const stats = { ...core.meta.stats, days: core.meta.stats.days + 1, maxStreak: Math.max(core.meta.stats.maxStreak, streak) };
  return { core: { ...core, streak, lastDay: today, meta: { ...core.meta, shields, stats } }, event };
}

// ---------------------------------------------------------------- 7 günlük giriş takvimi

export interface CalendarView { dayIndex: number; claimedToday: boolean; cycle: number; days: { day: number; reward: RewardItem[]; state: 'alindi' | 'bugun' | 'sirada'; big: boolean }[] }
/** Takvim günü seri sayacından gelir: seri 1 → 1. gün … seri 8 → yeni döngünün 1. günü. */
export function calendarView(core: PlayerCore, today: string): CalendarView {
  const s = Math.max(1, core.streak); const dayIndex = (s - 1) % 7; const claimedToday = core.meta.calendar.lastClaim === today;
  return {
    dayIndex, claimedToday, cycle: Math.floor((s - 1) / 7) + 1,
    days: CALENDAR.map((c, i) => ({ day: c.day, big: !!c.big, reward: i >= dayIndex ? resolveReward(core.meta, c.reward) : c.reward, state: i < dayIndex || (i === dayIndex && claimedToday) ? 'alindi' : i === dayIndex ? 'bugun' : 'sirada' })),
  };
}
export function claimCalendar<T extends PlayerCore>(core: T, today: string, now = Date.now()): { core: T; applied: RewardItem[]; day: number } | null {
  if (core.lastDay !== today) return null; // önce gün işlenmeli (advanceStreak)
  const v = calendarView(core, today); if (v.claimedToday) return null;
  const entry = CALENDAR[v.dayIndex]!;
  const next = { ...core, meta: { ...core.meta, calendar: { lastClaim: today }, stats: { ...core.meta.stats, calendar: core.meta.stats.calendar + 1 } } };
  const g = applyGrant(next, entry.reward, `takvim:${entry.day}`, now);
  return { ...g, day: entry.day };
}

/** Meydan okuma paylaşıldı (iptal edilmediyse): sayaç + "meydan oku" görevi. */
export function recordShare<T extends PlayerCore>(core: T, today: string): { core: T; changes: QuestChange[] } {
  const { daily, changes } = applyQuestDeltas(dailyFor(core, today), { share: 1 });
  return { core: { ...core, meta: { ...core.meta, daily, stats: { ...core.meta.stats, shares: core.meta.stats.shares + 1 } } }, changes };
}
