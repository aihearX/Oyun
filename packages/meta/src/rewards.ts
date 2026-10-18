import { DUPLICATE_VALUE, MAX_STREAK_SHIELDS, type Reward, type RewardItem } from '@odi/content';
import type { MetaState, PlayerCore } from './state';

/**
 * Ödülü oyuncunun durumuna göre "gerçek" haline çevirir: zaten sahip olunan kozmetik/kart ve
 * sınırı aşan seri koruyucu, önceden yazılı jeton karşılığına döner. Önizleme ve verme aynı fonksiyonu kullanır.
 */
export function resolveReward(meta: Pick<MetaState, 'cosmetics' | 'cards' | 'shields'>, reward: Reward): RewardItem[] {
  const owned = new Set(meta.cosmetics.owned); const cards = new Set(meta.cards); let shields = meta.shields;
  const out: RewardItem[] = []; let extra = 0;
  for (const it of reward) {
    if (it.amount <= 0) continue;
    if (it.kind === 'kozmetik') { if (!it.ref || owned.has(it.ref)) extra += DUPLICATE_VALUE.kozmetik; else { owned.add(it.ref); out.push(it); } }
    else if (it.kind === 'kart') { if (!it.ref || cards.has(it.ref)) extra += DUPLICATE_VALUE.kart; else { cards.add(it.ref); out.push(it); } }
    else if (it.kind === 'koruyucu') { const room = Math.max(0, MAX_STREAK_SHIELDS - shields); const take = Math.min(room, it.amount); if (take > 0) { shields += take; out.push({ kind: 'koruyucu', amount: take }); } extra += (it.amount - take) * DUPLICATE_VALUE.koruyucu; }
    else out.push({ ...it });
  }
  if (extra > 0) { const j = out.find((i) => i.kind === 'jeton'); if (j) j.amount += extra; else out.push({ kind: 'jeton', amount: extra }); }
  return out;
}

/** TEK ödül kapısı: tüm yerel ödüller buradan geçer ve deftere yazılır. Saf: yeni çekirdek döner. */
export function applyGrant<T extends PlayerCore>(core: T, reward: Reward, reason: string, now = Date.now()): { core: T; applied: RewardItem[] } {
  const applied = resolveReward(core.meta, reward);
  if (!applied.length) return { core, applied };
  let { coins, xp } = core; const m = core.meta;
  const meta: MetaState = { ...m, stats: { ...m.stats }, cards: [...m.cards], cosmetics: { ...m.cosmetics, owned: [...m.cosmetics.owned] } };
  for (const it of applied) {
    switch (it.kind) {
      case 'jeton': coins += it.amount; break;
      case 'xp': xp += it.amount; break;
      case 'koruyucu': meta.shields += it.amount; meta.stats.shieldsEarned += it.amount; break;
      case 'kozmetik': meta.cosmetics.owned.push(it.ref!); break;
      case 'kart': meta.cards.push(it.ref!); break;
    }
  }
  meta.ledger = [...m.ledger, { at: now, reason, items: applied }].slice(-60);
  return { core: { ...core, coins, xp, meta }, applied };
}

export function rewardSum(items: RewardItem[], kind: RewardItem['kind']): number { return items.filter((i) => i.kind === kind).reduce((a, i) => a + i.amount, 0); }
