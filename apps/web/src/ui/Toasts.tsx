import { useEffect } from 'react';
import { useStore } from '../store';
import { platform } from '../platform';
import { audio } from '@odi/audio';
import { Glyph, Rich } from './art';
import { useCoach } from '../ftue/Coach';

/** Üstte kısa kutlama bildirimi (celebrate.banner da buraya düşer): sırayla, tek tek, sesli. Dokununca kapanır. */
export function Toasts() {
  const toasts = useStore((s) => s.toasts); const dismiss = useStore((s) => s.dismissToast);
  // anlatıcı konuşurken bildirimler sırada bekler (vurgulanan yerin üstüne binmesin)
  const coaching = useCoach((s) => !!s.tour);
  const t = coaching ? undefined : toasts[0];
  useEffect(() => { if (!t) return; platform().haptic('success'); audio.play(t.tone === 'gold' ? 'unlock' : 'notify', { vol: 0.8 }); const h = setTimeout(() => dismiss(t.id), 2600); return () => clearTimeout(h); }, [t?.id]);
  if (!t) return null;
  return (
    <div className="toast-top" role="status" aria-live="polite" key={t.id} onClick={() => dismiss(t.id)}>
      <div className={`tt-card tone-${t.tone ?? 'accent'}`}>
        <span className="tt-icon"><Glyph e={t.icon} size={32} /></span>
        <span className="tt-body"><b><Rich text={t.title} /></b>{t.text && <small><Rich text={t.text} /></small>}</span>
      </div>
    </div>
  );
}
