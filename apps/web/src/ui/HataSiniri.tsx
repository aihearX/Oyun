import { Component, type ReactNode } from 'react';
import { reportCrash } from '../hata';
import { chunkOffline } from '../engine';
import { platform } from '../platform';

interface Props {
  children: ReactNode;
  /** rapordaki ekran adı (yoksa o anki rota) */
  ekran?: string;
  /** kök sınır: bütün uygulama; değilse yalnız ekran (sekme çubuğu yerinde kalır) */
  kok?: boolean;
  /** değişince sınır kendini sıfırlar (ör. rota adı: başka ekrana geçilince yeniden dener) */
  sifirla?: unknown;
}

/**
 * React hata sınırı (YN-011): çizimde atılan hata beyaz ekran yerine kısa bir kart gösterir ve çökme raporu gönderir
 * (hata.ts; kişisel veri yok). Kök sınır main.tsx ve telefon kabuğunda (WebApp.tsx), ekran sınırları App.tsx'te.
 * Ekran parçası bağlantı yokken yüklenemediyse (YN-047) bu bir çökme değildir: rapor gitmez, kart "İnternet yok" der ve
 * bağlantı dönünce ('online') kendiliğinden yeniden dener.
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
    return (
      <div className="screen" role="alert" data-testid={this.props.kok ? 'hata-kok' : ag ? 'hata-ag' : 'hata-ekran'} style={{ justifyContent: 'center', textAlign: 'center' }}>
        <h2>{ag ? 'İnternet yok' : 'Bir şeyler ters gitti'}</h2>
        <p className="muted">{ag ? 'Bu ekran bağlanınca açılır. İlerlemen cihazında kayıtlı.' : this.props.kok ? 'Oyun bu cihazda bir hatayla karşılaştı. İlerlemen cihazında kayıtlı.' : 'Bu ekran açılamadı. İlerlemen cihazında kayıtlı.'}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {!this.props.kok && <button type="button" className={ag ? 'btn' : 'btn ghost'} onClick={() => this.setState({ hata: false, ag: false })}>Tekrar dene</button>}
          {/* bağlantı yokken yeniden başlatmak işe yaramaz (sayfa da açılmayabilir) */}
          {!ag && <button type="button" className="btn" onClick={yeniden}>Oyunu yeniden başlat</button>}
        </div>
      </div>
    );
  }
}
