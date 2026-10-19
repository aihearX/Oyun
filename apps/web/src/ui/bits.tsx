import type { ReactNode } from 'react';
import type { RewardItem } from '@odi/content';
import { cardById, cosmeticById } from '@odi/content';
import { IconButton } from './Button';
import { rich } from './art';

/** Ödül içeriğini görünür kılan çipler: "🪙 50", "✨ 20 XP", "🛡️ 1", kart/kozmetik adı. */
export function RewardChips({ items, small }: { items: RewardItem[]; small?: boolean }) {
  return (
    <span className={`chips${small ? ' small' : ''}`}>
      {items.map((it, i) => <span className="chip" key={i}>{rich(rewardLabel(it))}</span>)}
    </span>
  );
}
export function rewardLabel(it: RewardItem): string {
  switch (it.kind) {
    case 'jeton': return `🪙 ${it.amount}`;
    case 'xp': return `✨ ${it.amount} XP`;
    case 'koruyucu': return `🛡️ ${it.amount} koruyucu`;
    case 'kozmetik': { const c = cosmeticById(it.ref ?? ''); return `${c?.kind === 'renk' ? '🎨' : '🎩'} ${c?.name ?? 'Kozmetik'}`; }
    case 'kart': { const c = cardById(it.ref ?? ''); return `🃏 ${c ? c.title : 'Kart'}`; }
  }
}
export function rewardIcon(items: RewardItem[]): string {
  const cos = items.find((i) => i.kind === 'kozmetik'); const k = cos ? (cosmeticById(cos.ref ?? '')?.kind === 'renk' ? '🎨' : '🎩') : items.find((i) => i.kind === 'kart') ? '🃏' : items.find((i) => i.kind === 'koruyucu') ? '🛡️' : '🪙';
  return k;
}
/** İnce ilerleme çubuğu (dürüst: gerçek oran) */
export function Bar({ value, tone = 'accent', label }: { value: number; tone?: 'accent' | 'green' | 'amber' | 'coral'; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return <div className={`bar tone-${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}><i style={{ width: `${v * 100}%` }} /></div>;
}
export function ScreenHead({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="screen-head">
      {onBack ? <IconButton icon="back" label="Geri" onClick={onBack} /> : <span />}
      <h1>{title}</h1>
      <span className="sh-right">{right}</span>
    </div>
  );
}
export const prefersReducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
