import type { ReactNode } from 'react';
import { ScreenHead } from './bits';

/**
 * İsteğe bağlı yüklenen ekranların bekleme görünümü. Ekranın adı ve Geri (`title`/`onBack`, ScreenHead ile aynı: yapışık, Escape)
 * ya da sekmenin üst çubuğu (`top`) ilk karede çizilir; az gören oyuncu dokunuşunun tuttuğunu görür, ikinci kez dokunmaz (YN-072).
 * İçerik alanındaki iri "Yükleniyor…" ~180 ms gecikmeyle belirir (CSS; hareket azaltmada doğrudan), kısa geçişlerde yanıp sönmez.
 * Zemin uygulamanın koyu gökyüzü (beyaz parlama yok); emoji yok.
 */
export function ScreenLoading({ tabs, title, onBack, top }: { tabs?: boolean; title?: string; onBack?: () => void; top?: ReactNode }) {
  const head = top ?? (title != null || onBack ? <ScreenHead title={title ?? ''} onBack={onBack} /> : <div className="lazy-head" aria-hidden><i /><i /><i /></div>);
  return (
    <div className={`screen lazy-screen${tabs ? ' with-tabs' : ''}`} data-icerik-yok>
      {head}
      <ContentLoading />
    </div>
  );
}

/**
 * Ekranın içerik alanı yüklenirken (veri bekleniyor; başlık ve Geri zaten çizili): iri, okunur "Yükleniyor…" + iskelet (YN-072, YN-085).
 * `data-icerik-yok`: ekranda anlatılacak içerik yok, Tüy Dede tanıtımı başlamaz ya da duraklar (ftue/Coach.tsx ICERIK_YOK)
 */
export function ContentLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="lazy-body" role="status" aria-busy="true" data-icerik-yok>
      <p className="lazy-text">Yükleniyor…</p>
      <div className="skel-list" aria-hidden>
        {Array.from({ length: rows }, (_, i) => <div className="skel card" key={i}><i className="sk-a" /><span><i className="sk-b" /><i className="sk-c" /></span></div>)}
      </div>
    </div>
  );
}

/** Phaser sahnesi için halka: koyu zeminin üstünde, gecikmeli belirir. inStage: ekranın kendi katmanlarının (HUD) altında kalır */
export function EngineLoading({ inStage }: { inStage?: boolean }) {
  return <div className={`engine-loading${inStage ? ' in-stage' : ''}`} aria-busy="true" aria-label="Yükleniyor"><span className="ring" /></div>;
}
