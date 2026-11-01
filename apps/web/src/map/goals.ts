/** Haritanın "Sıradaki hedef" rozeti ve kart metinleri: gerçek ilerlemeden, dürüst sayılar. */
import { BIOME_ORDER, BIOMES, HUMAN_JOURNEY, TREASURES, treasureAt, type LevelPlan, type RewardItem } from '@odi/content';
import type { MetaState } from '@odi/meta';
import { journeyDone, nextVitalityNeed, unlockedOf, vitalityOf, type StarMap, type Vitality } from '@odi/game-core/lite';
import type { BiomeId } from '@odi/shared';

export interface Goal { icon: string; text: string; /** hedefe ulaşılınca bir kez söylenir */ small?: string }

/** aşama fiilleri: gelecek ("çiçeklenir") ve ulaşıldı ("çiçeklendi"); sıra VITALITY_NAMES ile aynı (uyanır → çiçeklenir → canlanır → ışıl ışıl) */
export const VITALITY_WILL: Record<Vitality, string> = { 0: '', 1: 'uyanır', 2: 'çiçeklenir', 3: 'canlanır', 4: 'ışıl ışıl olur' };
const DID: Record<Vitality, string> = { 0: '', 1: 'uyandı', 2: 'çiçeklendi', 3: 'canlandı', 4: 'ışıl ışıl oldu' };
const STAGE_ICON: Record<Vitality, string> = { 0: '🌱', 1: '🌱', 2: '🌱', 3: '🌟', 4: '✨' };

/** seçilen tek hedef: hangi olay(lar), kaç bölüm/yıldız sonra */
export interface GoalPick {
  /** hedefin kimliği (aynı hedef sürerken değişmez): "t:15", "b:zar:2", "s:dis-kulak", "son" */
  key: string;
  /** bölüm hedefi: kaç bölüm sonra (1 = bu bölümün sonunda); yıldız hedefinde yıldız sayısı */
  left: number;
  treasure?: number;
  biome?: { id: BiomeId; to: Vitality };
  stars?: { id: BiomeId; n: number };
}

/**
 * "Sıradaki hedef" seçimi (OT-ilk-kez-oyun-13): haritada dönen birkaç hedef yerine TEK hedef, ulaşılana kadar aynı kalır.
 * Öncelik kuralı:
 *  1. Bölüm hedefleri: sıradaki hazine ve her bölgenin sıradaki canlanma aşaması (uyanmış bölgeler: çiçeklenir, canlanır).
 *     Her birinin hangi bölümü bitirince gerçekleşeceği bellidir (bölgelerin bölümleri ardışık olmayabilir: Kulak Kanalı
 *     6-8, 17, 20); en YAKIN olan seçilir. Bölümler sırayla açıldığı için her bölüm hepsini bir yaklaştırır, yani seçilen hedef
 *     ulaşılana kadar en yakın kalır. Aynı bölümde hazine de aşama da varsa ikisi birlikte söylenir.
 *  2. Yolculuk bitince yıldız hedefi: "ışıl ışıl" olmasına en az yıldız kalan bölge (eşitlikte harita sırası); önceki
 *     yıldız hedefi (`keep`) hâlâ sürüyorsa o korunur.
 *  3. Hepsi tamamsa taç.
 * Yalnız yıldız haritasından hesaplanır (hazine, bölümü ilk bitirişte açılır); saf ve testlidir.
 */
export function pickGoal(stars: StarMap, levels: LevelPlan[] = HUMAN_JOURNEY.levels, keep?: GoalPick | null): GoalPick | null {
  const total = levels.length; const unlocked = unlockedOf(stars, total);
  const open = (n: number) => !((stars[n] ?? 0) > 0);
  // bölüm hedefleri: gerçekleşeceği bölüm numarası
  const at = new Map<number, { treasure?: number; biome?: { id: BiomeId; to: Vitality } }>();
  const tr = TREASURES.find((t) => t.level >= unlocked && t.level <= total && open(t.level));
  if (tr) at.set(tr.level, { treasure: tr.level });
  for (const b of BIOME_ORDER) {
    const v = vitalityOf(b, stars, levels); if (v !== 1 && v !== 2) continue;
    const ls = levels.filter((l) => l.biome === b); const k = v === 1 ? Math.ceil(ls.length / 2) : ls.length;
    const lv = ls[k - 1]!.number; if (!open(lv)) continue;
    at.set(lv, { ...at.get(lv), biome: { id: b, to: (v + 1) as Vitality } });
  }
  if (at.size) {
    const lv = Math.min(...at.keys()); const g = at.get(lv)!;
    return { key: [g.treasure ? `t:${g.treasure}` : '', g.biome ? `b:${g.biome.id}:${g.biome.to}` : ''].filter(Boolean).join('+'), left: lv - unlocked + 1, ...g };
  }
  let best: { id: BiomeId; n: number } | null = null;
  // önceki yıldız hedefi sürüyorsa o korunur (başka bölgeden gelen yıldız hedefi değiştirmez)
  const kept = keep?.stars && vitalityOf(keep.stars.id, stars, levels) === 3 ? nextVitalityNeed(keep.stars.id, stars, levels)?.stars : undefined;
  if (keep?.stars && kept) best = { id: keep.stars.id, n: kept };
  else for (const b of BIOME_ORDER) { if (vitalityOf(b, stars, levels) !== 3) continue; const need = nextVitalityNeed(b, stars, levels); if (need?.stars && (!best || need.stars < best.n)) best = { id: b, n: need.stars }; }
  if (best) return { key: `s:${best.id}`, left: best.n, stars: best };
  return journeyDone(stars, total) ? { key: 'son', left: 0 } : null;
}

const name = (b: BiomeId) => BIOMES[b].name;
/** "da/de" bağlacı: son ünlüye göre (Kulak Zarı da, Kemikçikler de) */
const daDe = (w: string) => (/[aıou][^aıoueiöü]*$/i.test(w) ? 'da' : 'de');
/** hedef metni; `same` verilirse o bölgenin adı tekrar edilmez ("Sıradaki: 2 bölüm sonra canlanır") */
function goalText(g: GoalPick, same?: BiomeId): string {
  if (g.stars) return `${g.stars.n} yıldız daha: ${name(g.stars.id)} ışıl ışıl olur`;
  if (!g.treasure && !g.biome) return 'Ninni beyne ulaştı!';
  const when = g.left <= 1 ? 'Bu bölümün sonunda' : `${g.left} bölüm sonra`;
  if (g.treasure && g.biome) { const who = g.biome.id === same ? 'Bölge' : name(g.biome.id); return `${when} hazine! ${who} ${daDe(who)} ${VITALITY_WILL[g.biome.to]}.`; }
  if (g.biome) return `${when} ${g.biome.id === same ? '' : `${name(g.biome.id)} `}${VITALITY_WILL[g.biome.to]}`;
  return g.left <= 1 ? 'Bu bölümün sonunda hazine!' : `${g.left} bölüm sonra hazine`;
}
const goalIcon = (g: GoalPick) => (g.treasure ? '🎁' : g.biome ? STAGE_ICON[g.biome.to] : g.stars ? '✨' : '👑');
/** ulaşılan hedefin kutlama cümlesi */
function reachedText(g: GoalPick): string {
  const parts: string[] = [];
  if (g.treasure) parts.push('Hazine açıldı');
  if (g.biome) parts.push(`${name(g.biome.id)} ${DID[g.biome.to]}`);
  if (g.stars) parts.push(`${name(g.stars.id)} ışıl ışıl oldu`);
  return `${parts.join(', ')}!`;
}
/** hedef gerçekten gerçekleşti mi (yalnız gerçekleşen söylenir) */
function reached(g: GoalPick, stars: StarMap): boolean {
  if (g.treasure && !((stars[g.treasure] ?? 0) > 0)) return false;
  if (g.biome && vitalityOf(g.biome.id, stars) < g.biome.to) return false;
  if (g.stars && vitalityOf(g.stars.id, stars) < 4) return false;
  return !!(g.treasure || g.biome || g.stars);
}

/**
 * Haritadaki tek "Sıradaki hedef". `before`: haritanın en son gösterdiği yıldızlar (mapSeen; ilk açılışta null).
 * Önceki hedefe bu dönüşte ulaşıldıysa bir kez söylenir: "Kulak Zarı çiçeklendi! Sıradaki: 2 bölüm sonra canlanır".
 */
export function mapGoal(stars: StarMap, before: StarMap | null): Goal {
  const was = before ? pickGoal(before) : null;
  const now = pickGoal(stars, undefined, was);
  const text = now ? goalText(now) : 'Ninni beyne ulaştı!'; const icon = now ? goalIcon(now) : '👑';
  if (!was || was.key === now?.key || !reached(was, stars)) return { icon, text };
  const same = was.biome && now?.biome?.id === was.biome.id ? was.biome.id : undefined;
  return { icon, small: 'Hedefe ulaştın!', text: now && now.key !== 'son' ? `${reachedText(was)} Sıradaki: ${goalText(now, same)}` : `${reachedText(was)} Ninni beyne ulaştı!` };
}

/** hazinenin GERÇEK verilen içeriği: defterdeki kayıt (tekrar gelen kozmetik jetona dönmüş olabilir); yoksa tanım */
export function treasureItems(meta: Pick<MetaState, 'ledger'>, n: number): RewardItem[] {
  const rec = [...meta.ledger].reverse().find((g) => g.reason === `hazine:${n}`);
  return rec ? rec.items : treasureAt(n)?.reward ?? [];
}
