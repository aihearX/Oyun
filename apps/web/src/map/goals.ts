/** Haritanın "Sıradaki hedef" rozeti ve kart metinleri: gerçek ilerlemeden, dürüst sayılar. */
import { BIOME_ORDER, BIOMES, HUMAN_JOURNEY, treasureAt, type RewardItem } from '@odi/content';
import { nextTreasure, type MetaState } from '@odi/meta';
import { nextVitalityNeed, vitalityOf, type StarMap } from '@odi/game-core';
import type { BiomeId } from '@odi/shared';

export interface Goal { icon: string; text: string }

export function mapGoals(stars: StarMap, progress: Record<number, { stars: number; best: number; plays: number }>, unlocked: number, treasures: number[]): Goal[] {
  const out: Goal[] = [];
  const t = nextTreasure(unlocked, progress, treasures);
  if (t) out.push({ icon: '🎁', text: t.remaining <= 1 ? 'Bu bölümün sonunda hazine!' : `${t.remaining} bölüm sonra hazine` });
  const cur = HUMAN_JOURNEY.levels[unlocked - 1]?.biome;
  if (cur) {
    const need = nextVitalityNeed(cur, stars); const name = BIOMES[cur].name;
    if (need?.clears) out.push({ icon: need.to === 3 ? '🌟' : '🌱', text: `${need.clears} bölüm sonra ${name} ${need.to === 3 ? 'canlanır' : 'çiçeklenir'}` });
  }
  // en az yıldızla "ışıl ışıl" olacak bölge
  let best: { b: BiomeId; n: number } | null = null;
  for (const b of BIOME_ORDER) { if (vitalityOf(b, stars) !== 3) continue; const need = nextVitalityNeed(b, stars); if (need?.stars && (!best || need.stars < best.n)) best = { b, n: need.stars }; }
  if (best) out.push({ icon: '✨', text: `${best.n} yıldız daha: ${BIOMES[best.b].name} ışıl ışıl` });
  if (!out.length) out.push({ icon: '👑', text: 'Ninni beyne ulaştı!' });
  return out;
}

/** hazinenin GERÇEK verilen içeriği: defterdeki kayıt (tekrar gelen kozmetik jetona dönmüş olabilir); yoksa tanım */
export function treasureItems(meta: Pick<MetaState, 'ledger'>, n: number): RewardItem[] {
  const rec = [...meta.ledger].reverse().find((g) => g.reason === `hazine:${n}`);
  return rec ? rec.items : treasureAt(n)?.reward ?? [];
}
