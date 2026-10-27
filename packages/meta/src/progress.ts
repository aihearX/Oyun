import { levelFromXp, noteThresholds, type BiomeId, type LevelSpec, type RunResult } from '@odi/shared';
import { BIOMES, COSMETICS, HUMAN_JOURNEY, MECHANICS, TREASURES, cosmeticById, type HatId, type Reward } from '@odi/content';
import type { LevelProgressLite, MetaState } from './state';

/** XP çubuğu: bu seviyenin başı/sonu ve doluluk. levelFromXp ile aynı formül. */
export function xpThreshold(level: number): number { return level <= 1 ? 0 : Math.round(100 * Math.pow(level, 1.4)); }
export function levelProgress(xp: number): { level: number; from: number; to: number; pct: number } {
  const level = levelFromXp(xp); const from = xpThreshold(level); const to = xpThreshold(level + 1);
  return { level, from, to, pct: Math.max(0, Math.min(1, (xp - from) / Math.max(1, to - from))) };
}

export type RunSpecLite = Pick<LevelSpec, 'number' | 'name' | 'biome' | 'mechanic' | 'objective' | 'parTimeSec' | 'coinsTotal'>;
export interface NextGoal { text: string; kind: 'yakin' | 'yildiz' | 'hazine' | 'sirada' | 'son' }

/** "yüzde N"nin iyelik + belirtme eki, sayının okunuşuna göre: %1'ini %2'sini %3'ünü %6'sını %9'unu %40'ını %100'ünü */
export function yuzdeEki(n: number): string {
  const birler = ['ını', 'ini', 'sini', 'ünü', 'ünü', 'ini', 'sını', 'sini', 'ini', 'unu'];
  const onlar = ['', 'unu', 'sini', 'unu', 'ını', 'sini', 'ını', 'ini', 'ini', 'ını'];
  const k = Math.abs(Math.round(n));
  if (k === 0) return 'ını';
  if (k % 100 === 0) return 'ünü';
  return k % 10 ? birler[k % 10]! : onlar[(k % 100) / 10]!;
}

/** Dürüst "neredeyse" geri bildirimi: gerçekte ne eksikse onu söyler. */
export function nextGoal(spec: RunSpecLite, r: RunResult, progress: Record<number, LevelProgressLite> = {}): NextGoal {
  if (!r.completed) {
    const pct = typeof r.extra?.pct === 'number' ? r.extra.pct : null;
    if (pct != null && pct >= 0.5) return { kind: 'yakin', text: `Kapıya %${Math.max(1, 100 - Math.round(pct * 100))} kaldı!` };
    if (pct != null) return { kind: 'yakin', text: `Yolun %${Math.round(pct * 100)}'${yuzdeEki(Math.round(pct * 100))} geçtin. Bir dahakine daha ileri!` };
    return { kind: 'yakin', text: 'Bir daha dene: her denemede yol biraz daha tanıdık.' };
  }
  if (spec.coinsTotal <= 0) {
    if (r.stars < 3) return { kind: 'yildiz', text: r.stars === 1 ? '2. yıldız için en çok 1 kez hasar al' : '3. yıldız için hiç hasar almadan yen' };
  } else if (r.stars < 3) {
    // eşikler yıldız kuralıyla aynı yerden (shared economy.ts → noteThresholds; yüzmede 2★ %45 nota)
    const th = noteThresholds(spec); const needAt = (q: number) => Math.ceil(spec.coinsTotal * q - 1e-9) - r.coins;
    if (r.stars === 1) {
      const need = Math.max(1, needAt(th.star2));
      const t2 = spec.objective.id === 'timed' ? spec.objective.target2 : undefined;
      return { kind: 'yildiz', text: t2 ? `2. yıldız için ${need} nota daha ya da ${t2} saniyede bitir` : `2. yıldız için ${need} nota daha` };
    }
    // yüzmede 2★ %60'tan az notayla gelebilir; hedefle 3★ için yine %60 nota gerekir → eksik notayı da söyle (tümünü toplama hariç)
    const needObj = th.star3Objective ? needAt(th.star3Objective) : 0;
    if (needObj > 0 && spec.objective.id !== 'collect-all') return { kind: 'yildiz', text: `3. yıldız için ${needObj} nota daha ve: ${spec.objective.label}` };
    const need = Math.max(1, needAt(th.star3));
    return { kind: 'yildiz', text: spec.objective.id === 'reach' ? `3. yıldız için ${need} nota daha` : `3. yıldız için ${need} nota daha ya da: ${spec.objective.label}` };
  }
  const t = nextTreasure(spec.number + 1, progress);
  if (t && t.remaining <= 3) return { kind: 'hazine', text: t.remaining === 1 ? 'Sıradaki bölümün sonunda hazine var!' : `${t.remaining} bölüm sonra hazine!` };
  const next = HUMAN_JOURNEY.levels[spec.number];
  return next ? { kind: 'sirada', text: `Sırada: ${next.number}. ${next.name}` } : { kind: 'son', text: 'Yolculuğun sonuna ulaştın. Ninni beyne ulaştı!' };
}

/** Haritada görünür sıradaki hazine: "N bölüm sonra hazine". */
export function nextTreasure(fromLevel: number, progress: Record<number, LevelProgressLite>, claimed: number[] = []): { level: number; remaining: number; reward: Reward } | null {
  const t = TREASURES.find((x) => x.level >= fromLevel && !claimed.includes(x.level) && !((progress[x.level]?.stars ?? 0) > 0));
  if (!t) return null;
  return { level: t.level, reward: t.reward, remaining: t.level - fromLevel + 1 };
}

export function biomeStats(levels: { number: number }[], progress: Record<number, LevelProgressLite>) {
  const stars = levels.reduce((a, l) => a + (progress[l.number]?.stars ?? 0), 0); const cleared = levels.filter((l) => (progress[l.number]?.stars ?? 0) > 0).length;
  return { stars, maxStars: levels.length * 3, cleared, total: levels.length, pct: levels.length ? stars / (levels.length * 3) : 0 };
}

export interface Announcement { kind: 'biyom' | 'mekanik'; id: string; title: string; text: string }
/** Bölümü ilk kez bitirince kapısı aralanan yenilikler (bir sonraki bölümün yeni biyomu/mekaniği). */
export function unlockAnnouncements(levelNumber: number): Announcement[] {
  const levels = HUMAN_JOURNEY.levels; const next = levels[levelNumber]; if (!next) return [];
  const before = levels.slice(0, levelNumber); const out: Announcement[] = [];
  if (!before.some((l) => l.biome === next.biome)) out.push({ kind: 'biyom', id: next.biome, title: `Yeni biyom: ${BIOMES[next.biome].name}`, text: BIOMES[next.biome].blurb });
  if (!before.some((l) => l.mechanic === next.mechanic)) { const m = MECHANICS[next.mechanic]; out.push({ kind: 'mekanik', id: next.mechanic, title: `Yeni mekanik: ${m.icon} ${m.name}`, text: m.hint }); }
  return out;
}
/** Bölümden önce gösterilecek biyom sinematiği gerekli mi? */
export function needsBiomeIntro(meta: Pick<MetaState, 'seenBiomes'>, biome: BiomeId): boolean { return !meta.seenBiomes.includes(biome); }

// ---------------------------------------------------------------- kozmetik görünüm

export interface Look { color: number; hat?: HatId; colorId: string; hatId: string }
export function resolveLook(meta: Pick<MetaState, 'cosmetics'>): Look {
  const c = cosmeticById(meta.cosmetics.color); const h = cosmeticById(meta.cosmetics.hat);
  return { color: c?.color ?? 0x6c4cf1, hat: h?.hat ?? c?.hat, colorId: c?.id ?? 'renk-mor', hatId: h?.id ?? 'sapka-yok' };
}
export function equipCosmetic(meta: MetaState, id: string): MetaState {
  const def = cosmeticById(id); if (!def || !meta.cosmetics.owned.includes(id)) return meta;
  return { ...meta, cosmetics: { ...meta.cosmetics, ...(def.kind === 'renk' ? { color: id } : { hat: id }) } };
}
export const COSMETIC_COUNT = COSMETICS.length;
