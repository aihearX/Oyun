import { useEffect, useRef, type ReactNode } from 'react';
import type { RewardItem } from '@odi/content';
import { cardById, cosmeticById } from '@odi/content';
import { IconButton } from './Button';
import { rich } from './art';
import { useStore } from '../store';

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
/** açık ScreenHead'ler (iç içe çizilirse Escape yalnız en üsttekini kapatır) */
const heads: object[] = [];
/**
 * Alt ekran başlığı: kaydırınca üstte yapışık kalır (Geri her zaman erişilebilir; alt ekranlarda sekme çubuğu yok).
 * onBack varsa Escape (klavye, Android geri) ekranı kapatır; açık bir pencere (Sheet, panel: role=dialog) varsa önce o kapanır.
 */
export function ScreenHead({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  const back = useRef(onBack); back.current = onBack;
  const has = !!onBack;
  useEffect(() => {
    if (!has) return;
    const me = {}; heads.push(me);
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.repeat || e.defaultPrevented || heads[heads.length - 1] !== me) return;
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input:not([type=range]):not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable="true"]')) return;
      back.current?.();
    };
    addEventListener('keydown', k);
    return () => { removeEventListener('keydown', k); heads.splice(heads.indexOf(me), 1); };
  }, [has]);
  return (
    <div className="screen-head">
      {onBack ? <IconButton icon="back" label="Geri" onClick={onBack} /> : <span />}
      <h1>{title}</h1>
      <span className="sh-right">{right}</span>
    </div>
  );
}
const systemReducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
/** hareketi azalt: telefonun sistem tercihi ya da Ayarlar › Hareketi azalt (store.reduceMotion) */
export const prefersReducedMotion = () => systemReducedMotion() || useStore.getState().reduceMotion;
/** yalnız sistem tercihi (Ayarlar'da "telefon ayarından açık" göstermek için) */
export const systemPrefersReducedMotion = systemReducedMotion;
