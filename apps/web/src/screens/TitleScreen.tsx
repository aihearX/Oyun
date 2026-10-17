import { useEffect, useState } from 'react';

/** Açılış: Odi ve hikâye cümlesi. Tek dokunuş: başla. */
export function TitleScreen({ onStart, returning }: { onStart: () => void; returning: boolean }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 250); return () => clearTimeout(t); }, []);
  return (
    <div className="screen fade-in" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 18 }}>
      <svg width="140" height="140" viewBox="0 0 64 64" aria-hidden><circle cx="32" cy="32" r="30" fill="#6c4cf1" /><circle cx="24" cy="28" r="5" fill="#fff" /><circle cx="40" cy="28" r="5" fill="#fff" /><circle cx="25" cy="29" r="2.5" fill="#13162a" /><circle cx="41" cy="29" r="2.5" fill="#13162a" /><path d="M22 40q10 10 20 0" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" /></svg>
      <div><h1 style={{ fontSize: 40 }}>OD<span style={{ color: 'var(--accent)' }}>İ</span></h1><div className="muted" style={{ fontSize: 18 }}>Sesin Yolu</div></div>
      <p className="muted" style={{ maxWidth: 300, lineHeight: 1.4 }}>{returning ? 'Ninni hâlâ yolda. Devam edelim mi?' : 'Odi küçük bir ses. Görevi: annenin ninnisini kulaktan beyne ulaştırmak. Yol uzun, kulak derin.'}</p>
      <button className="btn" style={{ opacity: ready ? 1 : 0, transition: 'opacity .3s' }} onClick={onStart}>{returning ? 'Devam et ▶' : 'Yola çık ▶'}</button>
    </div>
  );
}
