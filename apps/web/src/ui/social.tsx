import { DmTopPill } from '../friends/Banner';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useNet } from '@odi/net/store';
import { BUILDINGS, type InboxKind } from '@odi/shared';
import { cardById, cosmeticById } from '@odi/content';
import { useStore } from '../store';
import { reconnect, usePending, useSocial } from '../net';
import { useBackLayer, useNav } from '../nav';
import { useHudCount } from '../celebrate/hud';
import { IconButton } from './Button';
import { Icon } from './icons';
import { Art, Glyph, Rich, rich, type ArtName } from './art';
import { CosmeticChip } from './bits';
import { useFeatures } from '../ftue/useFeatures';
import { prefersReducedMotion } from './bits';

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
/**
 * üst çubuk ve harita hapları için sayı: 99.999'a kadar tam (11.070), sonra "123 bin" (aşağı yuvarlanır), "1,2 mn".
 * "B" kısaltması yok: Türkçede yerleşik değil, İngilizce "billion" gibi okunuyor (YN-087). Tam değer title/aria'da.
 */
export const fmtHud = (n: number) => {
  const v = Math.max(0, Math.round(n));
  if (v < 100_000) return v.toLocaleString('tr-TR');
  if (v < 1_000_000) return `${Math.floor(v / 1000)} bin`;
  return `${(Math.floor(v / 100_000) / 10).toLocaleString('tr-TR')} mn`;
};
/** hap sayısı (üst çubuk ve harita): her genişlikte aynı biçim; dar ekranda sayı değil hap aralıkları daralır */
export function HudNum({ v }: { v: number }) {
  return <>{fmtHud(v)}</>;
}
export { fmtTry } from '../shopPrice';
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
    case 'kart': { const c = cardById(ref ?? ''); return `🃏 ${c?.title ?? 'Kulak Kartı'}`; }
    case 'm5': return `⏩ ${amount} × 5 dk`;
    case 'm60': return `⏩ ${amount} × 60 dk`;
    case 's8': return `⏩ ${amount} × 8 sa`;
    case 'pass': return `🎫 ${amount} gün Sezon Kartı`;
  }
}
export function ItemChips({ items, small }: { items: { kind: InboxKind | 'm5' | 'm60' | 's8' | 'pass'; amount: number; ref?: string }[]; small?: boolean }) {
  return <span className={`chips${small ? ' small' : ''}`}>{items.map((it, i) => <span className="chip" key={i}>{it.kind === 'kozmetik' ? <CosmeticChip id={it.ref} fallback={itemLabel(it.kind, it.amount, it.ref)} /> : rich(itemLabel(it.kind, it.amount, it.ref))}</span>)}</span>;
}

/** bağlantı noktası: yeşil bağlı, sarı bağlanıyor, gri çevrimdışı */
export function StatusDot() {
  const st = useNet((s) => s.status); const enabled = useSocial((s) => s.enabled);
  const cls = !enabled ? 'off' : st === 'bağlı' ? 'on' : st === 'bağlanıyor' ? 'wait' : 'off';
  const label = !enabled ? 'Çevrimdışı oyun' : st === 'bağlı' ? 'Sunucuya bağlı' : st === 'bağlanıyor' ? 'Bağlanıyor' : 'Çevrimdışı';
  return <span className={`net-dot ${cls}`} role="img" aria-label={label} title={label} />;
}

/** `on` en az `ms` sürdüyse true (kısa beklemede gösterge yanıp sönmesin) */
function useLasting(on: boolean, ms: number): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => { if (!on) { setLate(false); return; } const h = setTimeout(() => setLate(true), ms); return () => clearTimeout(h); }, [on, ms]);
  return on && late;
}

/** Sekme ekranlarının üst çubuğu: başlık + bağlantı noktası + jeton/kristal/ödül kutusu */
export function TopBar({ title, brand, extra }: { title?: string; brand?: boolean; extra?: ReactNode }) {
  const coins = useStore((s) => s.coins);
  const wallet = useNet((s) => s.wallet); const inbox = useNet((s) => s.inboxCount); const st = useNet((s) => s.status);
  const pending = usePending(); const nav = useNav();
  const feat = useFeatures();
  const linked = !!wallet; const shopOpen = linked && feat.open('shop');
  // bağlıyken yanıtı beklenen ödül/harcama (bölüm sonu, görev jetonu): jeton tahmindir, sunucu onaylayınca kum saati kalkar (MK-038)
  const waiting = useSocial((s) => s.queued > 0 || s.outbox.length > 0);
  const saving = useLasting(linked && st === 'bağlı' && waiting, 400);
  const offPend = pending > 0 && st !== 'bağlı';
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
        {linked && feat.open('friends') && <DmTopPill />}
        <span className={`pill tb-pill${jc.bump ? ' hud-pop' : ''}`} key={`j${jc.bump}`} data-hud="jeton" data-value={Math.round(jc.value)} aria-label={`Jeton: ${fmtNum(jc.value)}${saving ? ', kaydediliyor' : ''}`} title={offPend ? `${fmtNum(jc.value)} jeton · ${pending} jeton bağlanınca hesaba geçecek` : saving ? `${fmtNum(jc.value)} jeton · Kaydediliyor…` : `${fmtNum(jc.value)} jeton`}><Art name="coin" size={19} /><HudNum v={jc.value} />{(offPend || saving) && <i className={`pend${saving ? ' kayit' : ''}`} data-testid={saving ? 'jeton-kaydediliyor' : undefined}><Art name="hourglass" size={13} /></i>}</span>
        {shopOpen && <button className={`pill tb-pill tap${kc.bump ? ' hud-pop' : ''}`} key={`k${kc.bump}`} data-hud="kristal" data-value={Math.round(kc.value)} title={`${fmtNum(kc.value)} kristal`} onClick={() => nav.open({ name: 'shop' })} aria-label={`Kristal ve mağaza: ${fmtNum(kc.value)} kristal`}><Art name="crystal" size={19} /><HudNum v={kc.value} /></button>}
        {shopOpen && <button className="pill tb-pill tap ico env" onClick={() => nav.open({ name: 'inbox' })} aria-label={`Ödül kutusu: ${inbox} ödül`}><Icon name="inbox" size={20} />{inbox > 0 && <span className="dot">{inbox > 99 ? '99+' : inbox}</span>}</button>}
      </div>
    </div>
  );
}

/** sunucu yoksa/bağlanamadıysa nazik kart */
export function OfflineCard({ what = 'Takım, sohbet ve savaş' }: { what?: string }) {
  const enabled = useSocial((s) => s.enabled); const st = useNet((s) => s.status);
  return (
    <div className="card offline-card fade-in">
      <div className="ph-icon" aria-hidden><Art name="signal" size={48} /></div>
      <h2>{enabled ? 'Sunucuya bağlanılamadı' : 'Sosyal sunucu ayarlı değil'}</h2>
      <div className="muted">{enabled ? <>Aynı Wi-Fi'da <code>npm run server</code> açık mı? {what} bağlanınca gelir; bu arada oyuna devam edebilirsin, ilerlemen kaybolmaz.</> : `${what} için bir sunucu adresi gerekiyor. Oyunun geri kalanı çevrimdışı tamamen oynanır.`}</div>
      {enabled && <button className="btn" onClick={reconnect} disabled={st === 'bağlanıyor'}>{st === 'bağlanıyor' ? 'Bağlanıyor…' : 'Tekrar dene'}</button>}
    </div>
  );
}

/** sosyal ekranların ortak kapısı: bağlıysa içerik, bağlanıyorsa iskelet, değilse çevrimdışı kartı */
export function Online({ children, what, skeleton = 4 }: { children: ReactNode; what?: string; skeleton?: number }) {
  const st = useNet((s) => s.status); const me = useNet((s) => s.me); const tried = useSocial((s) => s.tried); const enabled = useSocial((s) => s.enabled);
  // bağlıyken de kopukken de aynı ağaç (şerit yuvası sabit): kopup gelince ekran baştan kurulmaz, yazılan metin ve bekleyen işlem kaybolmaz
  if (me) return <>{st !== 'bağlı' && <div className="net-banner"><Art name="signal" size={18} /> Bağlantı koptu — yeniden bağlanıyor… <button className="linkish" onClick={reconnect}>Tekrar dene</button></div>}{children}</>;
  if (enabled && (!tried || st === 'bağlanıyor')) return <Skeleton rows={skeleton} />;
  return <OfflineCard what={what} />;
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="skel-list" aria-busy="true" aria-label="Yükleniyor">{Array.from({ length: rows }, (_, i) => <div className="skel card" key={i}><i className="sk-a" /><span><i className="sk-b" /><i className="sk-c" /></span></div>)}</div>;
}

export function Empty({ icon, title, text, children }: { icon: string; title: string; text?: string; children?: ReactNode }) {
  return <div className="card empty"><div className="ph-icon" aria-hidden><Glyph e={icon} size={46} /></div><b><Rich text={title} /></b>{text && <div className="muted">{text}</div>}{children}</div>;
}

/** alttan açılan sayfa (onay, menü, form) */
/** alt sayfa: geri tuşu / Escape yalnız en üstteki sayfayı kapatır (nav.ts geri katmanları). closeX: başlıksız sayfada da yapışık
 *  Kapat düğmesi (profil kartı, OT-rekabetci-49) */
export function Sheet({ title, onClose, children, closeX }: { title?: string; onClose: () => void; children: ReactNode; closeX?: boolean }) {
  useBackLayer(onClose);
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden />
        {!title && closeX && <IconButton icon="close" label="Kapat" onClick={onClose} className="sheet-x" />}
        {title && <div className="row between"><h2><Rich text={title} /></h2><IconButton icon="close" label="Kapat" onClick={onClose} /></div>}
        {children}
      </div>
    </div>
  );
}

/**
 * Jeton harcama onayı (YN-073, OT-ekonomi-denetci-13): geri alınamayan her jeton harcaması (takım teknolojisi bağışı, yetenek)
 * önce "N jeton harcansın mı?" diye sorar; ne için olduğu ve cüzdanın önce → sonra hali yazılı.
 */
export function SpendConfirm({ jeton, have, what, note, yes, busy, onYes, onClose }: { jeton: number; have: number; what: ReactNode; note?: ReactNode; yes: string; busy?: boolean; onYes: () => void; onClose: () => void }) {
  return (
    <Sheet title={`${fmtNum(jeton)} jeton harcansın mı?`} onClose={onClose}>
      <div className="stack" data-testid="jeton-onay">
        <div>{what}</div>
        <div className="muted">Cüzdan: {fmtNum(have)} → <b>{fmtNum(have - jeton)}</b> jeton. Geri alınamaz.</div>
        {note && <div className="muted small-note">{note}</div>}
        <button className="btn" data-testid="jeton-onay-evet" disabled={busy} onClick={onYes}>{busy ? 'İşleniyor…' : yes}</button>
        <button className="btn ghost" onClick={onClose}>Vazgeç</button>
      </div>
    </Sheet>
  );
}

/** yatay kaydırılan alt sekmeler (rozetli). Taşarsa parmakla (fareyle de) sürüklenir; kesik kenarda solma ve ok görünür, ok
 *  dokunuşla kaydırır (OT-buyuk-yazi-14). `name`: şeridin adı (data-subtabs; iki düzeyli Takım sekmelerinde grup/alt). */
export function SubTabs<T extends string>({ tabs, active, onChange, name }: { tabs: { id: T; label: string; icon?: string; art?: ArtName; badge?: number }[]; active: T; onChange: (t: T) => void; name?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ l: false, r: false });
  const measure = useCallback(() => {
    const el = ref.current; if (!el) return;
    const l = el.scrollLeft > 2; const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdge((e) => (e.l === l && e.r === r ? e : { l, r }));
  }, []);
  useEffect(() => { ref.current?.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }); measure(); }, [active, measure]);
  // genişlik, yazı boyu (Büyük yazı) ya da sekme sayısı değişince kenarları yeniden ölç
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure); ro.observe(el); for (const c of el.children) ro.observe(c);
    return () => ro.disconnect();
  }, [tabs.length, measure]);
  // fareyle sürükleme (dokunmatikte tarayıcının kendi kaydırması çalışır); sürüklemeden sonraki tıklama sekme değiştirmez
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el || e.pointerType !== 'mouse' || e.button !== 0 || el.scrollWidth <= el.clientWidth) return;
    const x0 = e.clientX; const s0 = el.scrollLeft; let moved = false;
    const move = (ev: PointerEvent) => { const dx = ev.clientX - x0; if (!moved && Math.abs(dx) < 6) return; moved = true; el.scrollLeft = s0 - dx; };
    const up = () => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      if (moved) { const stop = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); }; el.addEventListener('click', stop, { capture: true, once: true }); setTimeout(() => el.removeEventListener('click', stop, true), 0); }
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  };
  const nudge = (dir: 1 | -1) => { const el = ref.current; if (el) el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.6), behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); };
  return (
    <div className="subtabs-wrap" data-subtabs={name} data-sol={edge.l || undefined} data-sag={edge.r || undefined}>
      <div className="subtabs" ref={ref} role="tablist" onScroll={measure} onPointerDown={onPointerDown}>
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={active === t.id} className={`subtab${active === t.id ? ' on' : ''}`} data-sekme={t.id} onClick={() => onChange(t.id)}>
            <span aria-hidden className="st-ic">{t.art ? <Art name={t.art} size={18} /> : <Glyph e={t.icon} size={18} />}</span> {t.label}{(t.badge ?? 0) > 0 && <span className="sbadge">{t.badge}</span>}
          </button>
        ))}
      </div>
      {/* kesik kenar okları: görme ve dokunma kolaylığı; sekmeler zaten listede olduğundan sekme sırasında değil, ama adlı (OT-buyuk-yazi-22).
          Büyük yazıda ikinci sıra sarar (styles.css), ok çıkmaz. */}
      {edge.l && <button type="button" className="st-ok sol" aria-label="Önceki sekmeler" tabIndex={-1} onClick={() => nudge(-1)}><Icon name="back" size={16} /></button>}
      {edge.r && <button type="button" className="st-ok sag" aria-label="Sonraki sekmeler" tabIndex={-1} onClick={() => nudge(1)}><Icon name="chevron" size={16} /></button>}
    </div>
  );
}

/** "+12 yardım" gibi yükselip sönen geri bildirim */
export function FloatBurst({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => { const h = setTimeout(onDone, 1400); return () => clearTimeout(h); }, [onDone]);
  return <div className="float-burst" aria-live="polite">{rich(text)}</div>;
}

export const ROLE_LABEL = { lider: '👑 Lider', yardimci: '⭐ Yardımcı', uye: 'Üye' } as const;
export const TIER = { bronz: { name: 'Bronz', icon: '🥉' }, gumus: { name: 'Gümüş', icon: '🥈' }, altin: { name: 'Altın', icon: '🥇' }, koklea: { name: 'Koklea', icon: '🐚' } } as const;
export const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
