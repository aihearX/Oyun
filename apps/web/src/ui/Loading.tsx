/**
 * İsteğe bağlı yüklenen ekranların ve Phaser sahnelerinin bekleme görünümü. Hızlı yüklemede hiç görünmez:
 * içerik ~180 ms gecikmeyle belirir (CSS), böylece kısa geçişlerde yanıp sönme olmaz. Zemin uygulamanın koyu
 * gökyüzü (beyaz parlama yok); emoji yok.
 */
export function ScreenLoading({ tabs }: { tabs?: boolean }) {
  return (
    <div className={`screen lazy-screen${tabs ? ' with-tabs' : ''}`} aria-busy="true" aria-label="Yükleniyor">
      <div className="lazy-head"><i /><i /><i /></div>
      <div className="skel-list">
        {[0, 1, 2, 3].map((i) => <div className="skel card" key={i}><i className="sk-a" /><span><i className="sk-b" /><i className="sk-c" /></span></div>)}
      </div>
    </div>
  );
}

/** Phaser sahnesi için halka: koyu zeminin üstünde, gecikmeli belirir. inStage: ekranın kendi katmanlarının (HUD) altında kalır */
export function EngineLoading({ inStage }: { inStage?: boolean }) {
  return <div className={`engine-loading${inStage ? ' in-stage' : ''}`} aria-busy="true" aria-label="Yükleniyor"><span className="ring" /></div>;
}
