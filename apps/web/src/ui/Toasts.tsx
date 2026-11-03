import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useStore } from '../store';
import { platform } from '../platform';
import { audio } from '@odi/audio';
import { Glyph, Rich } from './art';
import { useCoach } from '../ftue/Coach';
import { useCelebrating } from '../celebrate';

/** açıkken bildirimin beklediği pencereler: kutlama sahnesi (seviye, sandık, bölge), kipli pencereler (YN-145) */
const PENCERE = '.cel-stage, [aria-modal="true"]';

/**
 * Ekran başlık çubuğunun (Geri düğmesi, sekme başlığı) alt kenarı: üstten inen bildirim kartları (bu dosya, comm/CommBanner) onun altında
 * durur, Geri her zaman dokunulabilir kalır (OT-buyuk-yazi-49: Büyük yazıda iki satırlık kart başlığı ve Geri'yi örtüyordu). Görünür
 * başlık yoksa (harita, kaydırılıp yukarıda kalmış sekme başlığı) 0.
 */
export function baslikAlti(): number {
  let alt = 0;
  for (const e of document.querySelectorAll('.screen > .screen-head, .topbar2, .dm-head')) {
    const r = e.getBoundingClientRect();
    if (r.height > 0 && r.bottom > 0 && r.top < innerHeight / 3) alt = Math.max(alt, r.bottom);
  }
  return alt;
}

/** üstten inen şerit (comm/CommBanner, friends/Banner) başlık çubuğunun altında: her karede yerleşir (başlık yapışkan, sayfa kayar) */
export function useBaslikAltinda(ref: RefObject<HTMLElement | null>, key: unknown) {
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    let raf = 0; el.style.top = ''; const base = parseFloat(getComputedStyle(el).top) || 0;
    const yer = () => { const b = baslikAlti(); const top = b > 0 && b + 6 > base ? `${Math.round(b + 6)}px` : ''; if (el.style.top !== top) el.style.top = top; raf = requestAnimationFrame(yer); };
    yer(); return () => cancelAnimationFrame(raf);
  }, [key]);
}

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
 * Ekranda `data-toast-under` işaretli öğeler varsa bildirim en alttakinin altında durur (sonuç ekranı: nota/süre kutuları ve "Biliyor
 * muydun?" satırı); başlığı, yıldızları, skoru, jeton özetini, kutuları ve bilgi satırını örtmez (OT-buyuk-yazi-37, OT-sessiz-oyuncu-24).
 * Altında `data-toast-floor` işaretli öğeye (yapışkan düğmeler) kadar yer yoksa ya da öğeler kaydırılıp yukarıda kaldıysa (üstte
 * dursa ekranın o anki yazısını örterdi; OT-buyuk-yazi-49) görünmeden bekler, süresi işlemez. Öteki ekranlarda başlık çubuğunun altında.
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
      const el = ref.current;
      // görünen (çizilen) işaretli öğelerin en alt kenarı; kısa hâldeki bilgi satırı çizilmez (yükseklik 0)
      let under = -Infinity;
      for (const u of document.querySelectorAll('[data-toast-under]')) { const b = u.getBoundingClientRect(); if (b.height > 0) under = Math.max(under, b.bottom); }
      // üst sınır CSS'teki yer (güvenli alan + 10 px; satır içi stil yokken bir kez okunur); işaretli öğe yoksa başlık çubuğunun altı.
      // Doğrudan `top` yazılır: WebKit satır içi CSS değişkeni değişince (hareket azaltılmışken) konumu yeniden hesaplamıyordu
      if (el) {
        if (base < 0) base = parseFloat(getComputedStyle(el).top) || 0;
        const isaret = under > -Infinity;
        const floor = document.querySelector('[data-toast-floor]')?.getBoundingClientRect().top ?? innerHeight;
        const bas = isaret ? 0 : baslikAlti(); const y = isaret ? under + 8 : bas > 0 ? Math.max(base, bas + 6) : base;
        const sigar = !isaret || (y > base && y + el.offsetHeight <= Math.min(floor, innerHeight));
        const top = y > base && sigar ? `${Math.round(y)}px` : '';
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
