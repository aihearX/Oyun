import { useEffect } from 'react';
import { useNet } from '@odi/net/store';
import { audio } from '@odi/audio';
import { platform } from '../platform';
import { pendingCount, useEvents } from './store';
import type { EventView } from './EventsScreen';
import { Art, Glyph, rich } from '../ui/art';
import { Icon } from '../ui/icons';
import './events.css';

const SHOW_MS = 7000;

/** Gerçek zamanlı etkinlik bildirimi şeridi (ralli başladı, bayrak sende, quiz başlıyor, düello son 2 saat…). Dokununca ilgili ekran. */
export function EventNoticeStrip({ onOpen }: { onOpen: (v: EventView) => void }) {
  const n = useEvents((s) => s.notices[s.notices.length - 1]); const dismiss = useEvents((s) => s.dismiss);
  useEffect(() => {
    if (!n) return;
    platform().haptic('medium'); audio.play('notify', { vol: 0.8 });
    const h = setTimeout(() => dismiss(n.id), SHOW_MS); return () => clearTimeout(h);
  }, [n?.id]);
  if (!n) return null;
  return (
    <div className="ev-notice" role="alert" data-testid="ev-bildirim" data-kind={n.kind} key={n.id}>
      <button className="ev-notice-main" onClick={() => { dismiss(n.id); onOpen(n.target); }}>
        <span className="ev-notice-i" aria-hidden><Glyph e={n.icon} size={28} /></span>
        <span className="min0"><b className="ellipsis">{rich(n.title)}</b><small className="ellipsis">{rich(n.text)}</small></span>
        <span className="ev-notice-go">Git ›</span>
      </button>
      <button className="ev-notice-x" aria-label="Bildirimi kapat" onClick={() => dismiss(n.id)}><Icon name="close" size="1.1em" className="ic-inline" /></button>
    </div>
  );
}

/** Haritanın sağ üst köşesinde yüzen Etkinlikler düğmesi (seni bekleyen etkinlik sayısı rozetiyle) */
export function EventsFab({ onOpen }: { onOpen: () => void }) {
  const s = useEvents(); const me = useNet((x) => x.me); const status = useNet((x) => x.status);
  if (status !== 'bağlı' || !s.loaded) return null;
  const n = pendingCount(s, me?.id ?? null);
  const live = (s.rally?.status === 'acik') || (s.quiz && s.quiz.phase !== 'bitti') || s.duel?.finalPush;
  return (
    <button className={`ev-fab${live ? ' live' : ''}`} data-testid="ev-fab" onClick={onOpen} aria-label={`Etkinlikler${n ? `: ${n} etkinlik seni bekliyor` : ''}`}>
      <span className="ev-fab-i" aria-hidden><Art e="🎪" size="1.15em" className="art-inline" /></span><small>Etkinlik</small>
      {n > 0 && <span className="dot">{n}</span>}
    </button>
  );
}
