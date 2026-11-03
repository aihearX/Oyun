import { useEffect, useLayoutEffect, useRef } from 'react';
import { useStore } from '../store';
import { platform } from '../platform';
import { audio } from '@odi/audio';
import { Glyph, Rich } from './art';
import { useCoach } from '../ftue/Coach';

/**
 * Üstte kısa kutlama bildirimi (celebrate.banner da buraya düşer): sırayla, tek tek, sesli. Dokununca kapanır.
 * Ekranda `data-toast-under` işaretli bir öğe görünürse bildirim onun altında durur (sonuç ekranı: skor satırı); büyük başlığı ve
 * yıldızları örtmez (OT-buyuk-yazi-37: başarım bildirimi "Harika!" başlığının üst yarısını örtüyordu). Altına sığmazsa ya da öğe
 * kaydırılıp yukarıda kaldıysa üstte.
 */
export function Toasts() {
  const toasts = useStore((s) => s.toasts); const dismiss = useStore((s) => s.dismissToast);
  // anlatıcı konuşurken bildirimler sırada bekler (vurgulanan yerin üstüne binmesin)
  const coaching = useCoach((s) => !!s.tour);
  const t = coaching ? undefined : toasts[0];
  useEffect(() => { if (!t) return; platform().haptic('success'); audio.play(t.tone === 'gold' ? 'unlock' : 'notify', { vol: 0.8 }); const h = setTimeout(() => dismiss(t.id), 2600); return () => clearTimeout(h); }, [t?.id]);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!t) return;
    let raf = 0; let base = -1;
    // skor satırı bildirim açıkken büyüyebilir ("Yeni rekor!") ve ekran kayabilir: her karede yeniden yerleşir (bildirim ~2,6 sn)
    const place = () => {
      const el = ref.current; const r = document.querySelector('[data-toast-under]')?.getBoundingClientRect();
      // üst sınır CSS'teki yer (güvenli alan + 10 px; satır içi stil yokken bir kez okunur); öğe yoksa ya da altına sığmazsa orada kalır.
      // Doğrudan `top` yazılır: WebKit satır içi CSS değişkeni değişince (hareket azaltılmışken) konumu yeniden hesaplamıyordu
      if (el) {
        if (base < 0) base = parseFloat(getComputedStyle(el).top) || 0;
        const top = r && r.height > 0 && r.bottom + 8 > base && r.bottom + 8 + el.offsetHeight <= innerHeight ? `${Math.round(r.bottom + 8)}px` : '';
        if (el.style.top !== top) el.style.top = top;
      }
      raf = requestAnimationFrame(place);
    };
    place(); return () => cancelAnimationFrame(raf);
  }, [t?.id]);
  if (!t) return null;
  return (
    <div className="toast-top" role="status" aria-live="polite" key={t.id} ref={ref} onClick={() => dismiss(t.id)}>
      <div className={`tt-card tone-${t.tone ?? 'accent'}`}>
        <span className="tt-icon"><Glyph e={t.icon} size={32} /></span>
        <span className="tt-body"><b><Rich text={t.title} /></b>{t.text && <small><Rich text={t.text} /></small>}</span>
      </div>
    </div>
  );
}
