import { levelFromXp, type BiomeId } from '@odi/shared';
import {
  ACHIEVEMENTS, BIOME_ORDER, CARDS, COSMETICS, HUMAN_JOURNEY, SKILL_TREE, TIER_REWARD,
  type AchievementDef, type CardDef, type MetricId, type Tier,
} from '@odi/content';
import { FEAT, type LevelProgressLite, type PlayerCore } from './state';
import { applyGrant } from './rewards';

const LEVELS = HUMAN_JOURNEY.levels;
export const levelsOfBiome = (b: BiomeId) => LEVELS.filter((l) => l.biome === b);
export const biomeHasSecret = (b: BiomeId) => levelsOfBiome(b).some((l) => l.objective === 'secret');

/** İlk kilitli bölüm (önceki bölüm en az 1 yıldız). */
export function highestUnlocked(progress: Record<number, LevelProgressLite>, total = LEVELS.length): number {
  let n = 1; while (progress[n] && progress[n]!.stars > 0) n++; return Math.min(n, total);
}
export function skillsOwned(core: Pick<PlayerCore, 'skills'>): number {
  return SKILL_TREE.filter((n) => { const v = core.skills[n.key]; return typeof v === 'boolean' ? v : v >= (n.level ?? 1); }).length;
}
const countFeat = (feats: Record<number, number>, bit: number) => Object.values(feats).filter((f) => (f & bit) !== 0).length;

/** Tüm başarım ölçütlerinin şu anki değeri. */
export function computeMetrics(core: PlayerCore): Record<MetricId, number> {
  const { progress, meta } = core; const s = meta.stats;
  const ps = Object.entries(progress);
  const stars = ps.reduce((a, [, p]) => a + p.stars, 0);
  const biomesDone = BIOME_ORDER.filter((b) => levelsOfBiome(b).every((l) => (progress[l.number]?.stars ?? 0) > 0)).length;
  const mechanics = new Set(LEVELS.filter((l) => (progress[l.number]?.stars ?? 0) > 0).map((l) => l.mechanic)).size;
  const m: Record<string, number> = {
    clears: s.clears, stars, threeStars: ps.filter(([, p]) => p.stars === 3).length, coins: s.coins, secrets: countFeat(meta.feats, FEAT.SECRET),
    noDamage: s.noDamage, bosses: countFeat(meta.feats, FEAT.BOSS), underPar: s.underPar, lucky: s.lucky, shares: s.shares, quests: s.quests,
    chests: s.chests, calendar: s.calendar, maxStreak: Math.max(s.maxStreak, core.streak), cards: meta.cards.length, cosmetics: meta.cosmetics.owned.length,
    playerLevel: levelFromXp(core.xp), biomesDone, maxCombo: s.maxCombo, comebacks: s.comebacks, plays: s.plays, melody: s.melody, escort: s.escort,
    timed: s.timed, collectAll: s.collectAll, perfect: s.perfect, shieldsEarned: s.shieldsEarned, skills: skillsOwned(core),
    highest: highestUnlocked(progress), days: s.days, xp: core.xp, mechanics,
  };
  for (const b of BIOME_ORDER) m[`biomeStars:${b}`] = levelsOfBiome(b).reduce((a, l) => a + (progress[l.number]?.stars ?? 0), 0);
  return m as Record<MetricId, number>;
}

export function tierFor(a: AchievementDef, value: number): number { let t = 0; a.tiers.forEach((need, i) => { if (value >= need) t = i + 1; }); return t; }

/** Yeni ulaşılan kademeler (henüz kaydedilmemiş). Bir başarımda birden çok kademe aynı anda açılabilir. */
export function evaluateAchievements(core: PlayerCore, metrics = computeMetrics(core)): { id: string; tier: Tier }[] {
  const out: { id: string; tier: Tier }[] = [];
  for (const a of ACHIEVEMENTS) {
    const have = core.meta.achievements[a.id] ?? 0; const t = tierFor(a, metrics[a.metric] ?? 0);
    for (let k = have + 1; k <= t; k++) out.push({ id: a.id, tier: k as Tier });
  }
  return out;
}

/** Bir sonraki kademeye ilerleme (0-1) ve hedef. Tamamlanmışsa null. */
export function achievementNext(a: AchievementDef, value: number, have: number): { target: number; pct: number } | null {
  const target = a.tiers[have]; if (target == null) return null;
  const from = have > 0 ? a.tiers[have - 1]! : 0;
  return { target, pct: Math.max(0, Math.min(1, (value - from) / Math.max(1, target - from))) };
}

/** Oynayarak hak edilen (sandık dışı) kartlar. */
export function earnedCards(core: PlayerCore): CardDef[] {
  const { progress, meta } = core; const owned = new Set(meta.cards);
  return CARDS.filter((c) => {
    if (owned.has(c.id) || c.slot === 'sandik') return false;
    const lv = levelsOfBiome(c.biome); const f = (l: { number: number }) => meta.feats[l.number] ?? 0;
    switch (c.slot) {
      case 'ilk': return lv.some((l) => (progress[l.number]?.stars ?? 0) > 0);
      case 'yildiz': return lv.some((l) => (progress[l.number]?.stars ?? 0) === 3);
      case 'ozel': return biomeHasSecret(c.biome) ? lv.some((l) => (f(l) & FEAT.SECRET) !== 0) : lv.some((l) => (f(l) & FEAT.NO_DAMAGE) !== 0);
      case 'usta': return lv.every((l) => (progress[l.number]?.stars ?? 0) > 0);
      default: return false;
    }
  });
}

/** Günlük sandığın kartı: ulaşılmış biyomlardan sıradaki eksik sandık kartı (yoksa null → sandıkta yazılı jeton). */
export function nextChestCard(core: PlayerCore): CardDef | null {
  const hi = highestUnlocked(core.progress);
  for (const b of BIOME_ORDER) {
    if (!levelsOfBiome(b).some((l) => l.number <= hi)) continue;
    const c = CARDS.find((x) => x.biome === b && x.slot === 'sandik');
    if (c && !core.meta.cards.includes(c.id)) return c;
  }
  return null;
}

export interface AlbumProgress { owned: number; total: number; pct: number; biomes: { biome: BiomeId; owned: number; total: number; complete: boolean }[] }
export function albumProgress(cards: string[]): AlbumProgress {
  const set = new Set(cards);
  const biomes = BIOME_ORDER.map((b) => { const all = CARDS.filter((c) => c.biome === b); const owned = all.filter((c) => set.has(c.id)).length; return { biome: b, owned, total: all.length, complete: owned === all.length }; });
  const owned = CARDS.filter((c) => set.has(c.id)).length;
  return { owned, total: CARDS.length, pct: Math.floor((owned / CARDS.length) * 100), biomes };
}

/** Oynayarak hak edilen kozmetikler (seviye / başarım / albüm koşulları). Takvim, hazine, mağaza kendi yolundan gelir. */
export function earnedCosmetics(core: PlayerCore): string[] {
  const owned = new Set(core.meta.cosmetics.owned); const lvl = levelFromXp(core.xp); const album = albumProgress(core.meta.cards).pct;
  return COSMETICS.filter((c) => {
    if (owned.has(c.id)) return false;
    const u = c.unlock;
    switch (u.by) {
      case 'default': return true;
      case 'level': return lvl >= u.level;
      case 'achievement': return (core.meta.achievements[u.id] ?? 0) >= u.tier;
      case 'album': return album >= u.pct;
      default: return false;
    }
  }).map((c) => c.id);
}

export type MetaEvent =
  | { kind: 'achievement'; id: string; tier: Tier }
  | { kind: 'cosmetic'; id: string }
  | { kind: 'card'; id: string }
  | { kind: 'albumBadge'; biome: BiomeId };

/**
 * Durumu "yerleştirir": yeni başarım kademeleri, oynayarak hak edilen kart ve kozmetikler, albüm rozetleri.
 * Ödüller applyGrant'tan geçer. Zincirleme açılımlar (kart → albüm % → kozmetik → başarım) sabitlenene kadar döner.
 */
export function settle<T extends PlayerCore>(core: T, now = Date.now()): { core: T; events: MetaEvent[] } {
  const events: MetaEvent[] = []; let c = core;
  for (let guard = 0; guard < 6; guard++) {
    let changed = false;
    for (const ev of evaluateAchievements(c)) {
      c = { ...c, meta: { ...c.meta, achievements: { ...c.meta.achievements, [ev.id]: ev.tier } } };
      c = applyGrant(c, TIER_REWARD[ev.tier], `basarim:${ev.id}:${ev.tier}`, now).core; events.push({ kind: 'achievement', ...ev }); changed = true;
    }
    for (const card of earnedCards(c)) { c = applyGrant(c, [{ kind: 'kart', amount: 1, ref: card.id }], `kart:${card.id}`, now).core; events.push({ kind: 'card', id: card.id }); changed = true; }
    for (const id of earnedCosmetics(c)) { c = applyGrant(c, [{ kind: 'kozmetik', amount: 1, ref: id }], `kozmetik:${id}`, now).core; events.push({ kind: 'cosmetic', id }); changed = true; }
    for (const b of albumProgress(c.meta.cards).biomes) if (b.complete && !c.meta.albumBadges.includes(b.biome)) { c = { ...c, meta: { ...c.meta, albumBadges: [...c.meta.albumBadges, b.biome] } }; events.push({ kind: 'albumBadge', biome: b.biome }); changed = true; }
    if (!changed) break;
  }
  return { core: c, events };
}
