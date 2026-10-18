import { useEffect } from 'react';
import { useStore } from '../store';
import { platform } from '../platform';

/** Üstte kısa kutlama bildirimi: sırayla, tek tek. Dokununca kapanır. */
export function Toasts() {
  const toasts = useStore((s) => s.toasts); const dismiss = useStore((s) => s.dismissToast);
  const t = toasts[0];
  useEffect(() => { if (!t) return; platform().haptic('success'); const h = setTimeout(() => dismiss(t.id), 2600); return () => clearTimeout(h); }, [t?.id]);
  if (!t) return null;
  return (
    <div className="toast-top" role="status" aria-live="polite" key={t.id} onClick={() => dismiss(t.id)}>
      <div className={`tt-card tone-${t.tone ?? 'accent'}`}>
        <span className="tt-icon">{t.icon}</span>
        <span className="tt-body"><b>{t.title}</b>{t.text && <small>{t.text}</small>}</span>
      </div>
    </div>
  );
}
