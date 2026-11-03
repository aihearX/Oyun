import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { platform } from '../platform';
import { audio } from '@odi/audio';
import { Glyph, Rich } from './art';
import { useCoach } from '../ftue/Coach';
import { useCelebrating } from '../celebrate';

/** açıkken bildirimin beklediği pencereler: kutlama sahnesi (seviye, sandık, bölge), kipli pencereler (YN-145) */
const PENCERE = '.cel-stage, [aria-modal="true"]';

/** ekranda bir pencere açık mı (DOM'a eklenip çıkarılan pencereler; kutlama katmanı ayrıca useCelebrating ile söyler) */
function usePencereAcik() {
  const [acik, setAcik] = useState(false);
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const bak = () => setAcik(!!document.querySelector(PENCERE));
    bak();
    const mo = new MutationObserver(bak);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-modal'] });
    return () => mo.disconnect();
  }, []);
  return acik;
}

/**
 * Üstte kısa kutlama bildirimi (celebrate.banner da buraya düşer): sırayla, tek tek, sesli. Dokununca kapanır.
 * Bir pencere (kutlama sahnesi, seviye penceresi, `aria-modal`) ya da anlatıcı açıkken sırada bekler, kapanınca gelir: pencerenin
 * başlığına binmez (OT-buyuk-yazi-42: "Seviye 2!" başlığının yerine biniyordu).
 * Ekranda `data-toast-under` işaretli bir öğe görünürse bildirim onun altında durur (sonuç ekranı: nota/süre kutuları); başlığı,
 * yıldızları, skoru ve kutuları örtmez (OT-buyuk-yazi-37). Altında `data-toast-floor` işaretli öğeye (yapışkan düğmeler) kadar yer
 * yoksa görünmeden bekler, süresi işlemez; öğe kaydırılıp yukarıda kaldıysa üstte.
 */
export function Toasts() {
  const toasts = useStore((s) => s.toasts); const dismiss = useStore((s) => s.dismissToast);
  // anlatıcı konuşurken bildirimler sırada bekler (vurgulanan yerin üstüne binmesin)
  const coaching = useCoach((s) => !!s.tour);
  const celebrating = useCelebrating((s) => s.on);
  const pencere = usePencereAcik();
  const t = coaching || celebrating || pencere ? undefined : toasts[0];
  // yer var mı (data-toast-under altında); yokken bildirim gizli bekler, kapanma süresi işlemez
  const [yer, setYer] = useState(true);
  const sesli = useRef<number | null>(null); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!t || !yer || ref.current?.style.visibility === 'hidden') return;
    // ses ve titreşim bildirim ilk göründüğünde bir kez (pencere kapanıp yeniden gelince tekrar çalmaz)
    if (sesli.current !== t.id) { sesli.current = t.id; platform().haptic('success'); audio.play(t.tone === 'gold' ? 'unlock' : 'notify', { vol: 0.8 }); }
    const h = setTimeout(() => dismiss(t.id), 2600); return () => clearTimeout(h);
  }, [t?.id, yer]);
  useLayoutEffect(() => {
    if (!t) return;
    let raf = 0; let base = -1;
    // kutuların yeri bildirim açıkken değişebilir ("Yeni rekor!", ekran kayar): her karede yeniden yerleşir (bildirim ~2,6 sn)
    const place = () => {
      const el = ref.current; const r = document.querySelector('[data-toast-under]')?.getBoundingClientRect();
      // üst sınır CSS'teki yer (güvenli alan + 10 px; satır içi stil yokken bir kez okunur); öğe yoksa ya da kaydırılıp yukarıda kaldıysa
      // orada kalır. Doğrudan `top` yazılır: WebKit satır içi CSS değişkeni değişince (hareket azaltılmışken) konumu yeniden hesaplamıyordu
      if (el) {
        if (base < 0) base = parseFloat(getComputedStyle(el).top) || 0;
        const alt = r && r.height > 0 && r.bottom + 8 > base;
        const floor = document.querySelector('[data-toast-floor]')?.getBoundingClientRect().top ?? innerHeight;
        const sigar = !alt || r.bottom + 8 + el.offsetHeight <= Math.min(floor, innerHeight);
        const top = alt && sigar ? `${Math.round(r.bottom + 8)}px` : '';
        if (el.style.top !== top) el.style.top = top;
        const vis = sigar ? '' : 'hidden';
        if (el.style.visibility !== vis) { el.style.visibility = vis; if (sigar) delete el.dataset.bekliyor; else el.dataset.bekliyor = 'yer'; }
        setYer(sigar);
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
