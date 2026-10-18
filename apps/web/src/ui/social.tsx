import { DmTopPill } from '../friends/Banner';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNet } from '@odi/net/store';
import { BUILDINGS, type InboxKind } from '@odi/shared';
import { cardById, cosmeticById } from '@odi/content';
import { useStore } from '../store';
import { reconnect, usePending, useSocial } from '../net';
import { useNav } from '../nav';
import { useHudCount } from '../celebrate/hud';
import { IconButton } from './Button';
import { Icon } from './icons';

/** saniyelik (ya da verilen aralıkta) yeniden çizim için şimdiki zaman */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const h = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(h); }, [ms]);
  return now;
}
const pad = (n: number) => String(n).padStart(2, '0');
/** kalan süre: "2 gün 4 sa", "3 sa 05 dk", "4:05", "0:09" */
export function fmtLeft(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d} gün ${h} sa`;
  if (h > 0) return `${h} sa ${pad(m)} dk`;
  return `${m}:${pad(sec)}`;
}
export function fmtDur(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} gün${h ? ` ${h} sa` : ''}`;
  if (h > 0) return `${h} sa${m ? ` ${m} dk` : ''}`;
  if (m > 0) return `${m} dk`;
  return `${s} sn`;
}
export const fmtNum = (n: number) => Math.round(n).toLocaleString('tr-TR');
export const fmtTry = (n: number) => `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
export const fmtTime = (t: number) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
export const fmtDate = (t: number) => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + ' ' + fmtTime(t);
export const buildingDef = (id: string) => BUILDINGS.find((b) => b.id === id);

/** sunucu ödül/ürün içerik etiketi */
export function itemLabel(kind: InboxKind | 'm5' | 'm60' | 's8' | 'pass', amount: number, ref?: string): string {
  switch (kind) {
    case 'jeton': return `🪙 ${fmtNum(amount)}`;
    case 'kristal': return `💎 ${fmtNum(amount)}`;
    case 'kalkan': return `🛡️ ${amount} kalkan`;
    case 'kozmetik': { const c = cosmeticById(ref ?? ''); return `${c?.kind === 'renk' ? '🎨' : '🎩'} ${c?.name ?? 'Kozmetik'}`; }
    case 'kart': { const c = cardById(ref ?? ''); return `${c?.emoji ?? '🃏'} ${c?.title ?? 'Kulak Kartı'}`; }
    case 'm5': return `⏩ ${amount} × 5 dk`;
    case 'm60': return `⏩ ${amount} × 60 dk`;
    case 's8': return `⏩ ${amount} × 8 sa`;
    case 'pass': return `🎫 ${amount} gün Sezon Kartı`;
  }
}
export function ItemChips({ items, small }: { items: { kind: InboxKind | 'm5' | 'm60' | 's8' | 'pass'; amount: number; ref?: string }[]; small?: boolean }) {
  return <span className={`chips${small ? ' small' : ''}`}>{items.map((it, i) => <span className="chip" key={i}>{itemLabel(it.kind, it.amount, it.ref)}</span>)}</span>;
}

/** bağlantı noktası: yeşil bağlı, sarı bağlanıyor, gri çevrimdışı */
export function StatusDot() {
  const st = useNet((s) => s.status); const enabled = useSocial((s) => s.enabled);
  const cls = !enabled ? 'off' : st === 'bağlı' ? 'on' : st === 'bağlanıyor' ? 'wait' : 'off';
  const label = !enabled ? 'Çevrimdışı oyun' : st === 'bağlı' ? 'Sunucuya bağlı' : st === 'bağlanıyor' ? 'Bağlanıyor' : 'Çevrimdışı';
  return <span className={`net-dot ${cls}`} role="img" aria-label={label} title={label} />;
}

/** Sekme ekranlarının üst çubuğu: başlık + bağlantı noktası + jeton/kristal/ödül kutusu */
export function TopBar({ title, brand, extra }: { title?: string; brand?: boolean; extra?: ReactNode }) {
  const coins = useStore((s) => s.coins);
  const wallet = useNet((s) => s.wallet); const inbox = useNet((s) => s.inboxCount); const st = useNet((s) => s.status);
  const pending = usePending(); const nav = useNav();
  const linked = !!wallet;
  // jeton uçuşu sırasında sayaç gerçek değerin yoldaki kadar altında görünür ve varışta sayarak artar
  const jc = useHudCount('jeton', coins); const kc = useHudCount('kristal', wallet?.kristal ?? 0);
  return (
    <div className="topbar2">
      <div className="tb-title min0">
        {brand ? <div className="brand">OD<span>İ</span> <span className="muted brand-sub">Sesin Yolu</span></div> : <h1>{title}</h1>}
        <StatusDot />
      </div>
      <div className="tb-pills">
        {extra}
        {linked && <DmTopPill />}
        <span className={`pill tb-pill${jc.bump ? ' hud-pop' : ''}`} key={`j${jc.bump}`} data-hud="jeton" title={pending > 0 && st !== 'bağlı' ? `${pending} jeton bağlanınca hesaba geçecek` : 'Jeton'}>🪙 {fmtNum(jc.value)}{pending > 0 && st !== 'bağlı' && <i className="pend">⏳</i>}</span>
        {linked && <button className={`pill tb-pill tap${kc.bump ? ' hud-pop' : ''}`} key={`k${kc.bump}`} data-hud="kristal" onClick={() => nav.open({ name: 'shop' })} aria-label="Kristal ve mağaza">💎 {fmtNum(kc.value)}</button>}
        {linked && <button className="pill tb-pill tap ico env" onClick={() => nav.open({ name: 'inbox' })} aria-label={`Ödül kutusu: ${inbox} ödül`}><Icon name="inbox" size={20} />{inbox > 0 && <span className="dot">{inbox > 99 ? '99+' : inbox}</span>}</button>}
      </div>
    </div>
  );
}

/** sunucu yoksa/bağlanamadıysa nazik kart */
export function OfflineCard({ what = 'Takım, sohbet ve savaş' }: { what?: string }) {
  const enabled = useSocial((s) => s.enabled); const st = useNet((s) => s.status);
  return (
    <div className="card offline-card fade-in">
      <div className="ph-icon" aria-hidden>📡</div>
      <h2>{enabled ? 'Sunucuya bağlanılamadı' : 'Sosyal sunucu ayarlı değil'}</h2>
      <div className="muted">{enabled ? <>Aynı Wi-Fi'da <code>npm run server</code> açık mı? {what} bağlanınca gelir; bu arada oyuna devam edebilirsin, ilerlemen kaybolmaz.</> : `${what} için bir sunucu adresi gerekiyor. Oyunun geri kalanı çevrimdışı tamamen oynanır.`}</div>
      {enabled && <button className="btn" onClick={reconnect} disabled={st === 'bağlanıyor'}>{st === 'bağlanıyor' ? 'Bağlanıyor…' : 'Tekrar dene'}</button>}
    </div>
  );
}

/** sosyal ekranların ortak kapısı: bağlıysa içerik, bağlanıyorsa iskelet, değilse çevrimdışı kartı */
export function Online({ children, what, skeleton = 4 }: { children: ReactNode; what?: string; skeleton?: number }) {
  const st = useNet((s) => s.status); const me = useNet((s) => s.me); const tried = useSocial((s) => s.tried); const enabled = useSocial((s) => s.enabled);
  if (st === 'bağlı' && me) return <>{children}</>;
  if (enabled && (!tried || st === 'bağlanıyor') && !me) return <Skeleton rows={skeleton} />;
  if (me && st !== 'bağlı') return <><div className="net-banner">📡 Bağlantı koptu — yeniden bağlanıyor… <button className="linkish" onClick={reconnect}>Tekrar dene</button></div>{children}</>;
  return <OfflineCard what={what} />;
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="skel-list" aria-busy="true" aria-label="Yükleniyor">{Array.from({ length: rows }, (_, i) => <div className="skel card" key={i}><i className="sk-a" /><span><i className="sk-b" /><i className="sk-c" /></span></div>)}</div>;
}

export function Empty({ icon, title, text, children }: { icon: string; title: string; text?: string; children?: ReactNode }) {
  return <div className="card empty"><div className="ph-icon" aria-hidden>{icon}</div><b>{title}</b>{text && <div className="muted">{text}</div>}{children}</div>;
}

/** alttan açılan sayfa (onay, menü, form) */
export function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden />
        {title && <div className="row between"><h2>{title}</h2><IconButton icon="close" label="Kapat" onClick={onClose} /></div>}
        {children}
      </div>
    </div>
  );
}

/** yatay kaydırılan alt sekmeler (rozetli) */
export function SubTabs<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: string; icon: string; badge?: number }[]; active: T; onChange: (t: T) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }); }, [active]);
  return (
    <div className="subtabs" ref={ref} role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={active === t.id} className={`subtab${active === t.id ? ' on' : ''}`} onClick={() => onChange(t.id)}>
          <span aria-hidden>{t.icon}</span> {t.label}{(t.badge ?? 0) > 0 && <span className="sbadge">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

/** "+12 yardım" gibi yükselip sönen geri bildirim */
export function FloatBurst({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => { const h = setTimeout(onDone, 1400); return () => clearTimeout(h); }, [onDone]);
  return <div className="float-burst" aria-live="polite">{text}</div>;
}

export const ROLE_LABEL = { lider: '👑 Lider', yardimci: '⭐ Yardımcı', uye: 'Üye' } as const;
export const TIER = { bronz: { name: 'Bronz', icon: '🥉' }, gumus: { name: 'Gümüş', icon: '🥈' }, altin: { name: 'Altın', icon: '🥇' }, koklea: { name: 'Koklea', icon: '🐚' } } as const;
export const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
