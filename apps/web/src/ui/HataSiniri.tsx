import { Component, type ReactNode } from 'react';
import { reportCrash } from '../hata';
import { chunkOffline } from '../engine';
import { platform } from '../platform';
import { ScreenHead } from './bits';

interface Props {
  children: ReactNode;
  /** rapordaki ekran adı (yoksa o anki rota) */
  ekran?: string;
  /** kök sınır: bütün uygulama; değilse yalnız ekran (sekme çubuğu yerinde kalır) */
  kok?: boolean;
  /** değişince sınır kendini sıfırlar (ör. rota adı: başka ekrana geçilince yeniden dener) */
  sifirla?: unknown;
  /**
   * kartta Geri (YN-205): ekranın kendi Geri'siyle aynı yere, yoksa geldiği sekmeye ya da Harita'ya (App.tsx, nav.ts errorBackTo).
   * ScreenHead ile çizilir: telefonun geri tuşu ve Escape de aynı işi yapar. Yoksa (başlık, hikâye, harita) Geri çizilmez.
   */
  geri?: () => void;
  /** kartın başlığı (ekranın adı; Geri'nin yanında) */
  baslik?: string;
  /** tam ekran rotada kartın altında sekme çubuğu: sekmelere dönüş yolu (YN-205) */
  sekmeler?: ReactNode;
}

/**
 * React hata sınırı (YN-011): çizimde atılan hata beyaz ekran yerine kısa bir kart gösterir ve çökme raporu gönderir
 * (hata.ts; kişisel veri yok). Kök sınır main.tsx ve telefon kabuğunda (WebApp.tsx), ekran sınırları App.tsx'te.
 * Ekran parçası bağlantı yokken yüklenemediyse (YN-047) bu bir çökme değildir: rapor gitmez, kart "İnternet yok" der ve
 * bağlantı dönünce ('online') kendiliğinden yeniden dener. Ekran sınırı kartında (kök hariç) Geri ve sekmeler hep vardır: oyuncu
 * internetsiz çalışan haritaya ve bölümlere dönebilir, kart bir çıkmaz değildir (YN-205, OT-eski-telefon-35).
 */
export class HataSiniri extends Component<Props, { hata: boolean; ag: boolean }> {
  override state = { hata: false, ag: false };
  static getDerivedStateFromError(e: unknown): { hata: boolean; ag: boolean } { return { hata: true, ag: chunkOffline(e) }; }
  override componentDidCatch(e: unknown): void { if (!chunkOffline(e)) reportCrash(e, this.props.ekran); }
  override componentDidMount(): void { window.addEventListener('online', this.cevrimici); }
  override componentWillUnmount(): void { window.removeEventListener('online', this.cevrimici); }
  override componentDidUpdate(prev: Props): void { if (this.state.hata && prev.sifirla !== this.props.sifirla) this.setState({ hata: false, ag: false }); }
  private cevrimici = () => { if (this.state.hata && this.state.ag) this.setState({ hata: false, ag: false }); };
  override render(): ReactNode {
    if (!this.state.hata) return this.props.children;
    const yeniden = () => { try { const r = platform().restartApp; if (r) r(); else location.reload(); } catch { /* yok */ } };
    const ag = this.state.ag;
    const { kok, geri, baslik, sekmeler } = this.props;
    return (
      <>
        <div className={`screen${sekmeler ? ' with-tabs' : ''}`} data-testid={kok ? 'hata-kok' : ag ? 'hata-ag' : 'hata-ekran'}>
          {!kok && geri && <ScreenHead title={baslik ?? ''} onBack={geri} />}
          <div role="alert" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 14, textAlign: 'center' }}>
            <h2>{ag ? 'İnternet yok' : 'Bir şeyler ters gitti'}</h2>
            <p className="muted">{ag ? 'Bu ekran bağlanınca açılır. İlerlemen cihazında kayıtlı.' : kok ? 'Oyun bu cihazda bir hatayla karşılaştı. İlerlemen cihazında kayıtlı.' : 'Bu ekran açılamadı. İlerlemen cihazında kayıtlı.'}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {!kok && <button type="button" className={ag ? 'btn' : 'btn ghost'} onClick={() => this.setState({ hata: false, ag: false })}>Tekrar dene</button>}
              {/* bağlantı yokken yeniden başlatmak işe yaramaz (sayfa da açılmayabilir) */}
              {!ag && <button type="button" className="btn" onClick={yeniden}>Oyunu yeniden başlat</button>}
            </div>
          </div>
        </div>
        {!kok && sekmeler}
      </>
    );
  }
}
