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
    <div className={`screen lazy-screen${tabs ? ' with-tabs' : ''}`}>
      {head}
      <div className="lazy-body" role="status" aria-busy="true">
        <p className="lazy-text">Yükleniyor…</p>
        <div className="skel-list" aria-hidden>
          {[0, 1, 2, 3].map((i) => <div className="skel card" key={i}><i className="sk-a" /><span><i className="sk-b" /><i className="sk-c" /></span></div>)}
        </div>
      </div>
    </div>
  );
}

/** Phaser sahnesi için halka: koyu zeminin üstünde, gecikmeli belirir. inStage: ekranın kendi katmanlarının (HUD) altında kalır */
export function EngineLoading({ inStage }: { inStage?: boolean }) {
  return <div className={`engine-loading${inStage ? ' in-stage' : ''}`} aria-busy="true" aria-label="Yükleniyor"><span className="ring" /></div>;
}
