import type { PlayerSkills, RunResult } from '@odi/shared';
import { DEFAULT_COLOR_ID, DEFAULT_HAT_ID, HUMAN_JOURNEY, type RewardItem } from '@odi/content';

/** Bölüm başına "başarı izleri" (bit maskesi): mesafeden bağımsız, bir kez kazanılır. */
export const FEAT = { CLEAR: 1, NO_DAMAGE: 2, SECRET: 4, UNDER_PAR: 8, THREE: 16, BOSS: 32, PERFECT: 64 } as const;

export interface Stats {
  plays: number; clears: number; fails: number; coins: number; noDamage: number; underPar: number; lucky: number; shares: number;
  quests: number; chests: number; calendar: number; maxStreak: number; maxCombo: number; comebacks: number;
  melody: number; escort: number; timed: number; collectAll: number; perfect: number; shieldsEarned: number; days: number;
}
export const EMPTY_STATS: Stats = {
  plays: 0, clears: 0, fails: 0, coins: 0, noDamage: 0, underPar: 0, lucky: 0, shares: 0, quests: 0, chests: 0, calendar: 0, maxStreak: 0, maxCombo: 0,
  comebacks: 0, melody: 0, escort: 0, timed: 0, collectAll: 0, perfect: 0, shieldsEarned: 0, days: 0,
};

export interface DailyQuest { id: string; progress: number; claimed: boolean }
export interface DailyState { day: string; quests: DailyQuest[]; chestOpened: boolean }
export interface GrantRecord { at: number; reason: string; items: RewardItem[] }

export interface MetaState {
  stats: Stats;
  /** bölüm no → FEAT bit maskesi */
  feats: Record<number, number>;
  daily: DailyState | null;
  calendar: { lastClaim: string };
  /** seri koruyucu sayısı */
  shields: number;
  /** başarım id → ulaşılan kademe (1 bronz, 2 gümüş, 3 altın) */
  achievements: Record<string, number>;
  cards: string[];
  cosmetics: { owned: string[]; color: string; hat: string };
  /** sinematik tanıtımı gösterilmiş biyomlar */
  seenBiomes: string[];
  /** oyun içi "ilk kez" kutlamaları yapılmış olanlar */
  firsts: string[];
  /** açılmış harita hazineleri (bölüm no) */
  treasures: number[];
  /** albüm rozeti kutlanmış biyomlar */
  albumBadges: string[];
  /** son ödüller (ileride sunucu cüzdanıyla eşitleme için) */
  ledger: GrantRecord[];
}

export function defaultMeta(): MetaState {
  return {
    stats: { ...EMPTY_STATS }, feats: {}, daily: null, calendar: { lastClaim: '' }, shields: 0, achievements: {}, cards: [],
    cosmetics: { owned: [DEFAULT_COLOR_ID, DEFAULT_HAT_ID], color: DEFAULT_COLOR_ID, hat: DEFAULT_HAT_ID },
    seenBiomes: [], firsts: [], treasures: [], albumBadges: [], ledger: [],
  };
}

export interface LevelProgressLite { stars: number; best: number; plays: number; lastResult?: RunResult }
/** Meta mantığının çalıştığı oyuncu çekirdeği (store bunun üst kümesidir). */
export interface PlayerCore {
  progress: Record<number, LevelProgressLite>;
  coins: number; xp: number; streak: number; lastDay: string; failStreak: number;
  skills: PlayerSkills;
  meta: MetaState;
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});

/** Eski ya da bozuk kayıtları güvenle tamamlar. Bilinmeyen alanlar atılır, eksikler varsayılanla dolar. */
export function migrateMeta(raw: unknown, progress: Record<number, LevelProgressLite> = {}): MetaState {
  const d = defaultMeta(); const r = obj(raw);
  const st = obj(r.stats); const stats = { ...EMPTY_STATS };
  for (const k of Object.keys(stats) as (keyof Stats)[]) stats[k] = num(st[k]);
  const feats: Record<number, number> = {};
  for (const [k, v] of Object.entries(obj(r.feats))) if (Number.isInteger(Number(k))) feats[Number(k)] = num(v);
  const ach: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(r.achievements))) ach[k] = Math.max(0, Math.min(3, num(v)));
  const cos = obj(r.cosmetics); const owned = [...new Set([...d.cosmetics.owned, ...strs(cos.owned)])];
  const dl = obj(r.daily);
  const daily: DailyState | null = typeof dl.day === 'string' && Array.isArray(dl.quests)
    ? { day: dl.day, chestOpened: !!dl.chestOpened, quests: (dl.quests as unknown[]).map((q) => obj(q)).filter((q) => typeof q.id === 'string').map((q) => ({ id: q.id as string, progress: num(q.progress), claimed: !!q.claimed })) }
    : null;
  const m: MetaState = {
    stats, feats, daily, calendar: { lastClaim: typeof obj(r.calendar).lastClaim === 'string' ? obj(r.calendar).lastClaim as string : '' },
    shields: Math.max(0, num(r.shields)), achievements: ach, cards: [...new Set(strs(r.cards))],
    cosmetics: { owned, color: typeof cos.color === 'string' && owned.includes(cos.color) ? cos.color : d.cosmetics.color, hat: typeof cos.hat === 'string' && owned.includes(cos.hat) ? cos.hat : d.cosmetics.hat },
    seenBiomes: strs(r.seenBiomes), firsts: strs(r.firsts), treasures: Array.isArray(r.treasures) ? (r.treasures as unknown[]).filter((x): x is number => typeof x === 'number') : [],
    albumBadges: strs(r.albumBadges), ledger: Array.isArray(r.ledger) ? (r.ledger as GrantRecord[]).slice(-60) : [],
  };
  // ilk kez meta'ya geçen eski kayıt: ilerlemeden dürüstçe çıkarılabilenleri doldur
  if (raw == null) backfillFromProgress(m, progress);
  return m;
}

function backfillFromProgress(m: MetaState, progress: Record<number, LevelProgressLite>) {
  for (const [k, p] of Object.entries(progress)) {
    const n = Number(k); m.stats.plays += num(p.plays);
    const plan = HUMAN_JOURNEY.levels.find((l) => l.number === n);
    if (plan && !m.seenBiomes.includes(plan.biome)) m.seenBiomes.push(plan.biome); // sinematik tanıtım tekrar çıkmasın
    if (p.stars > 0) {
      m.stats.clears++; let f = FEAT.CLEAR; if (p.stars === 3) f |= FEAT.THREE; if (plan?.objective === 'boss' && p.stars >= 2) f |= FEAT.BOSS;
      const lr = p.lastResult; if (lr?.completed) { if (lr.damageTaken === 0) f |= FEAT.NO_DAMAGE; if (lr.secretFound) f |= FEAT.SECRET; }
      m.feats[n] = f;
    }
  }
}
