import { useEffect, useRef, type ReactNode } from 'react';
import type { RewardItem } from '@odi/content';
import { MAX_STREAK_SHIELDS, cardById, cosmeticById } from '@odi/content';
import type { RewardSwap } from '@odi/meta';
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
    // sandık önizlemesinde kart adı tek başına kart olduğunu söylemiyordu (OT-ekonomi-denetci-24)
    case 'kart': { const c = cardById(it.ref ?? ''); return c ? `🃏 +1 Kulak Kartı: ${c.title}` : '🃏 +1 Kulak Kartı'; }
  }
}
/**
 * Zaten sahip olunan şeyin jetona dönüşmesi (önceden yazılı karşılık). Önizlemede: "Kulaklı Bere zaten sende: yerine +50 jeton"
 * (çiplerde bu jeton yok: `ownItems`); açılış penceresinde ayrı satır: "Kulaklı Bere zaten dolabında" ×50 (OT-ekonomi-denetci-20).
 * Alındıktan sonra (done): "seri koruyucun zaten doluydu (2/2), yerine 30 jeton" — `claimedText` cümlesinin parçası.
 */
export function swapText(w: RewardSwap, done = false): string {
  if (done) return `${swapWas(w)}, yerine ${w.jeton} jeton`;
  if (w.from.kind === 'koruyucu') return `Seri koruyucun dolu: yerine +${w.jeton} jeton`;
  return `${swapName(w)} zaten sende: yerine +${w.jeton} jeton`;
}
/** alınmış ödülde dönüşen kalemin geçmiş zamanlı adı: "seri koruyucun zaten doluydu (2/2)", "Kulaklı Bere zaten dolabındaydı" */
function swapWas(w: RewardSwap): string {
  if (w.from.kind === 'koruyucu') return `seri koruyucun zaten doluydu (${MAX_STREAK_SHIELDS}/${MAX_STREAK_SHIELDS})`;
  return `${swapName(w)} zaten ${w.from.kind === 'kart' ? 'albümündeydi' : 'dolabındaydı'}`;
}
/**
 * alınmış ödülün jeton cümlesi, toplam ve parçalarıyla (YN-138): "Bugün +50 jeton alındı (20 + seri koruyucun zaten doluydu (2/2),
 * yerine 30)". Toplam verilen kalemlerden (dönüşen jeton içinde), parçalar dönüşümlerden; dönüşüm yoksa null.
 */
export function claimedText(when: string, items: RewardItem[], swaps: RewardSwap[]): string | null {
  if (!swaps.length) return null;
  const total = items.filter((i) => i.kind === 'jeton').reduce((a, i) => a + i.amount, 0);
  const base = total - swaps.reduce((a, w) => a + w.jeton, 0);
  const parts = [...(base > 0 ? [String(base)] : []), ...swaps.map((w) => `${swapWas(w)}, yerine ${w.jeton}`)];
  return `${when} +${total} jeton alındı (${parts.join(' + ')})`;
}
/** ödül kaleminin düz yazısı (ekran okuyucu): "20 jeton", "Kulaklı Bere" */
export function rewardPlain(it: RewardItem): string {
  if (it.kind === 'jeton') return `${it.amount} jeton`;
  return rewardLabel(it).replace(/^\S+ /, '');
}
function swapName(w: RewardSwap): string {
  if (w.from.kind === 'kozmetik') return cosmeticById(w.from.ref ?? '')?.name ?? 'Bu kozmetik';
  if (w.from.kind === 'kart') return `${cardById(w.from.ref ?? '')?.title ?? 'Bu'} kartı`;
  return 'Seri koruyucu';
}
/** açılış penceresi: dönüşen jeton ayrı, adıyla bir satır (toplam aynı; dönüşüm son jeton kaleminin içindedir) */
export function withSwapRows(items: RewardItem[], swaps: RewardSwap[]): (RewardItem & { label?: string })[] {
  const total = swaps.reduce((a, w) => a + w.jeton, 0); if (!total) return items;
  const at = items.map((i) => i.kind).lastIndexOf('jeton');
  const j = items[at];
  if (!j || j.amount < total) return items;
  const rest = items.flatMap((it, i) => (i !== at ? [it] : it.amount > total ? [{ ...it, amount: it.amount - total }] : []));
  const where = (w: RewardSwap) => (w.from.kind === 'kozmetik' ? 'dolabında' : w.from.kind === 'kart' ? 'albümünde' : null);
  return [...rest, ...swaps.map((w) => ({ kind: 'jeton' as const, amount: w.jeton, label: where(w) ? `${swapName(w)} zaten ${where(w)}` : 'Seri koruyucun dolu' }))];
}
/**
 * Önizleme çipleri: ödülün kendi kalemleri; dönüşen jeton çiplere katılmaz, `swapText` satırında ayrı yazılır. Çipler + satırlar =
 * açılış penceresindeki kutular (`withSwapRows`). "80 jeton" + "yerine 30 jeton" 110 gibi okunuyordu (OT-eski-telefon-21).
 */
export function ownItems(items: RewardItem[], swaps: RewardSwap[]): RewardItem[] {
  return withSwapRows(items, swaps).filter((r) => !r.label);
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
