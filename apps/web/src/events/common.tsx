import { useEffect, useState, type ReactNode } from 'react';
import type { EventKind, EventReward, LevelSpec } from '@odi/shared';
import { generateLevel, DEFAULT_PROFILE } from '@odi/level-gen';
import { HUMAN_JOURNEY } from '@odi/content';
import { NetError } from '@odi/net';
import { ItemChips, fmtLeft } from '../ui/social';
import { srvNow } from './store';
import { IconButton } from '../ui/Button';
import { Art, rich, Glyph } from '../ui/art';

/** Etkinlik kimlikleri ve vurgu renkleri (tema tokenları; events.css'te --ev olarak kullanılır) */
export const EVENT_META: Record<EventKind, { name: string; icon: string; tone: string; blurb: string }> = {
  ralli: { name: 'Ralli', icon: '🔥', tone: 'coral', blurb: 'Takımca mini canavara saldırın!' },
  duello: { name: 'Takım Düellosu', icon: '⚔️', tone: 'violet', blurb: '48 saat, iki takım, tek kazanan.' },
  bayrak: { name: 'Bayrak Yarışı', icon: '🚩', tone: 'teal', blurb: '4 ayaklı parkur, bayrağı devret!' },
  avi: { name: 'Ses Avı', icon: '🎵', tone: 'gold', blurb: 'Notaları topla, takım şarkısını aç.' },
  quiz: { name: 'Kulak Bilgi Yarışması', icon: '🧠', tone: 'lime', blurb: 'Canlı takım quizi: 10 soru, 15 sn.' },
  gorev: { name: 'Günlük Takım Görevleri', icon: '🎯', tone: 'gold', blurb: 'Her gün 3 ortak görev, ortak sandık.' },
  meydan: { name: 'Günün Meydan Okuması', icon: '🏅', tone: 'coral', blurb: 'Herkese aynı zorlu bölüm, 3 deneme.' },
  turnuva: { name: 'Haftalık Turnuva', icon: '🏆', tone: 'teal', blurb: '5 bölüm, toplam skor, 50 kişilik grup.' },
};

/** etkinlik bölümü: herkes için aynı (yolculuk + bölüm + varsayılan profil + tuz) */
export function eventSpec(level: number, salt: number): LevelSpec { return generateLevel('insan', level, DEFAULT_PROFILE, salt); }
export const levelName = (n: number) => HUMAN_JOURNEY.levels.find((l) => l.number === n)?.name ?? `${n}. bölüm`;
export const errText = (e: unknown) => (e instanceof NetError ? (['CEVRIMDISI', 'KOPTU', 'KAPALI'].includes(e.code) ? 'Sunucuya bağlı değilsin.' : e.message) : 'Bir şeyler ters gitti; bir daha dener misin?');

/** sunucu saatine göre saniyelik şimdi */
export function useSrvNow(ms = 1000): number {
  const [now, setNow] = useState(srvNow);
  useEffect(() => { const h = setInterval(() => setNow(srvNow()), ms); return () => clearInterval(h); }, [ms]);
  return now;
}

export function Countdown({ to, label, urgentMs = 0 }: { to: number; label?: string; urgentMs?: number }) {
  const now = useSrvNow();
  const left = to - now;
  return <span className={`ev-clock${urgentMs && left < urgentMs ? ' urgent' : ''}`} aria-label={`${label ?? 'Kalan'} ${fmtLeft(left)}`}><Art e="⏳" size="1.15em" className="art-inline" /> {label ? `${label} ` : ''}{fmtLeft(left)}</span>;
}

export function Rewards({ items, label }: { items: EventReward[]; label?: string }) {
  return <div className="ev-rewards">{label && <small>{rich(label)}</small>}<ItemChips items={items} small /></div>;
}

export function EvHead({ kind, title, onBack, right }: { kind: EventKind; title?: string; onBack: () => void; right?: ReactNode }) {
  const m = EVENT_META[kind];
  return (
    <div className="ev-head" data-tone={m.tone}>
      <IconButton icon="back" label="Geri" onClick={onBack} />
      <h1><span aria-hidden className="ev-h-ic"><Glyph e={m.icon} size={26} /></span> {title ?? m.name}</h1>
      <span className="ev-head-r">{right}</span>
    </div>
  );
}

export const fmtSecs = (s: number) => `${s.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} sn`;
export const hexColor = (n: number) => `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;
