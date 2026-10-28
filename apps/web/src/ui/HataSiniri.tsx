import { Component, type ReactNode } from 'react';
import { reportCrash } from '../hata';
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
 */
export class HataSiniri extends Component<Props, { hata: boolean }> {
  override state = { hata: false };
  static getDerivedStateFromError(): { hata: boolean } { return { hata: true }; }
  override componentDidCatch(e: unknown): void { reportCrash(e, this.props.ekran); }
  override componentDidUpdate(prev: Props): void { if (this.state.hata && prev.sifirla !== this.props.sifirla) this.setState({ hata: false }); }
  override render(): ReactNode {
    if (!this.state.hata) return this.props.children;
    const yeniden = () => { try { const r = platform().restartApp; if (r) r(); else location.reload(); } catch { /* yok */ } };
    return (
      <div className="screen" role="alert" data-testid={this.props.kok ? 'hata-kok' : 'hata-ekran'} style={{ justifyContent: 'center', textAlign: 'center' }}>
        <h2>Bir şeyler ters gitti</h2>
        <p className="muted">{this.props.kok ? 'Oyun bu cihazda bir hatayla karşılaştı. İlerlemen cihazında kayıtlı.' : 'Bu ekran açılamadı. İlerlemen cihazında kayıtlı.'}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {!this.props.kok && <button type="button" className="btn ghost" onClick={() => this.setState({ hata: false })}>Tekrar dene</button>}
          <button type="button" className="btn" onClick={yeniden}>Oyunu yeniden başlat</button>
        </div>
      </div>
    );
  }
}
