import { useEffect, useRef, type ReactNode } from 'react';
import type { RewardItem } from '@odi/content';
import { cardById, cosmeticById } from '@odi/content';
import { IconButton } from './Button';
import { Glyph, rich } from './art';
import { useStore } from '../store';
import { odiLook } from '../look';
import { OdiAvatar } from './OdiAvatar';

/** Ödül içeriğini görünür kılan çipler: "🪙 50", "✨ 20 XP", "🛡️ 1", kart/kozmetik adı. */
export function RewardChips({ items, small }: { items: RewardItem[]; small?: boolean }) {
  return (
    <span className={`chips${small ? ' small' : ''}`}>
      {items.map((it, i) => <span className="chip" key={i}>{it.kind === 'kozmetik' ? <CosmeticChip id={it.ref} fallback={rewardLabel(it)} /> : rich(rewardLabel(it))}</span>)}
    </span>
  );
}
/**
 * Kozmetiğin kendi küçük resmi: Dolap'taki önizlemeyle aynı çizim (şapka oyuncunun Odi'sinin başında, renk Odi'nin gövdesinde).
 * Her şapkalı ödül aynı genel şapka simgesiyle görünmesin (OT-ogrenci-birinci-12). Tanınmayan kimlikte null.
 */
export function CosmeticThumb({ id, size = '1.7em' }: { id: string | undefined; size?: number | string }) {
  const base = useStore((s) => odiLook(s).color); const c = cosmeticById(id ?? '');
  if (!c) return null;
  return <span className="cos-thumb" aria-hidden><OdiAvatar size={size} color={c.kind === 'renk' && c.color != null ? c.color : base} hat={c.hat} /></span>;
}
/** çip içeriği: kozmetiğin resmi + adı; tanınmayan kimlikte türüne uygun genel simgeli etiket */
export function CosmeticChip({ id, fallback }: { id: string | undefined; fallback: string }) {
  const c = cosmeticById(id ?? '');
  return c ? <><CosmeticThumb id={id} />{c.name}</> : <>{rich(fallback)}</>;
}
/** ödül paketinin tek simgesi (takvim günü): kozmetik varsa onun resmi, yoksa türünün simgesi */
export function RewardGlyph({ items, size = 22 }: { items: RewardItem[]; size?: number | string }) {
  const cos = items.find((i) => i.kind === 'kozmetik');
  return cos && cosmeticById(cos.ref ?? '') ? <CosmeticThumb id={cos.ref} size={typeof size === 'number' ? size + 6 : size} /> : <Glyph e={rewardIcon(items)} size={size} />;
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
