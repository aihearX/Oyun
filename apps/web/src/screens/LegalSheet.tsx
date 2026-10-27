/**
 * Ayarlar › Gizlilik ve hesap (YN-009, YN-017): gizlilik politikası, hesap silme, hakkında ve iletişim.
 * Metin src/yasal/metin.ts'ten (herkese açık /gizlilik, /en/privacy, /hesap-sil sayfalarıyla aynı kaynak); uygulamanın içinde
 * çizilir, bu yüzden telefonda (Expo DOM) ve bağlantısızken de açılır. Web'de ayrıca herkese açık sayfanın bağlantısı görünür.
 */
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useNet } from '@odi/net/store';
import { Sheet } from '../ui/social';
import { platform } from '../platform';
import { APP_VERSION } from '../legal';
import { GIZLILIK_EN, GIZLILIK_TR, HAKKINDA, HESAP_SIL } from '../yasal/metin';
import { belgeDoldur, satirParcala, type Belge, type Blok } from '../yasal/yasal';

export type YasalSayfa = 'gizlilik' | 'privacy' | 'hesap-sil' | 'hakkinda';
const BELGE: Record<YasalSayfa, Belge> = { gizlilik: GIZLILIK_TR, privacy: GIZLILIK_EN, 'hesap-sil': HESAP_SIL, hakkinda: HAKKINDA };
const YOLDAN: Record<string, YasalSayfa> = { '/gizlilik': 'gizlilik', '/en/privacy': 'privacy', '/hesap-sil': 'hesap-sil' };

function Satir({ s, onYol }: { s: string; onYol: (yol: string) => void }) {
  return (
    <>{satirParcala(s).map((p, i) => {
      if (p.t === 'kalin') return <b key={i}>{p.x}</b>;
      if (p.t === 'yazi') return <Fragment key={i}>{p.x}</Fragment>;
      const yol = p.href.split('#')[0]!;
      if (YOLDAN[yol]) return <button key={i} type="button" className="linkish legal-link" onClick={() => onYol(yol)}>{p.x}</button>;
      return <a key={i} href={p.href} target={p.href.startsWith('mailto:') ? undefined : '_blank'} rel="noreferrer">{p.x}</a>;
    })}</>
  );
}

function BlokCiz({ b, onYol }: { b: Blok; onYol: (yol: string) => void }): ReactNode {
  const S = (x: string) => <Satir s={x} onYol={onYol} />;
  switch (b.t) {
    case 'h2': return <h3>{S(b.x)}</h3>;
    case 'h3': return <h4>{S(b.x)}</h4>;
    case 'p': return <p>{S(b.x)}</p>;
    case 'not': return <p className="legal-not">{S(b.x)}</p>;
    case 'ul': return <ul>{b.x.map((x, i) => <li key={i}>{S(x)}</li>)}</ul>;
    case 'ol': return <ol>{b.x.map((x, i) => <li key={i}>{S(x)}</li>)}</ol>;
    // dar ekranda tablo yerine satır başına kart (yatay taşma yok)
    case 'tablo': return (
      <div className="legal-rows">{b.satir.map((r, i) => (
        <div className="legal-row" key={i}>{r.map((c, j) => <div key={j}><span className="legal-k">{satirParcala(b.bas[j] ?? '').map((p) => p.x).join('')}</span>{S(c)}</div>)}</div>
      ))}</div>
    );
  }
}

export function LegalSheet({ sayfa: ilk, onClose, onDelete }: { sayfa: YasalSayfa; onClose: () => void; onDelete?: () => void }) {
  const [sayfa, setSayfa] = useState<YasalSayfa>(ilk);
  const me = useNet((s) => s.me);
  const belge = useMemo(() => belgeDoldur(BELGE[sayfa], undefined, APP_VERSION), [sayfa]);
  const onYol = (yol: string) => { const s = YOLDAN[yol]; if (s) setSayfa(s); };
  // ilk satır sayfanın künyesidir (herkese açık sayfada); uygulamada başlık zaten var
  const bloklar = sayfa === 'hakkinda' ? belge.bloklar : belge.bloklar.slice(1);
  const web = platform().kind === 'web';
  return (
    <Sheet title={belge.baslik} onClose={onClose}>
      <div className="legal-sheet" data-testid={`yasal-${sayfa}`} lang={belge.dil}>
        {sayfa === 'hesap-sil' && (
          <div className="legal-not legal-me" data-testid="hesap-sil-kimlik">
            <span>{me ? <>Arkadaş kodun: <b className="mono">{me.friendCode}</b>. Oyunu açamadığın bir gün e-postayla silme istersen bu kodu yaz.</> : <>Sunucuya bağlı değilsin: hesabını silmek için internete bağlan.</>}</span>
            {onDelete && <button type="button" className="btn coral small" data-testid="hesap-sil-git" onClick={onDelete}>Hesabı sil</button>}
          </div>
        )}
        {bloklar.map((b, i) => <BlokCiz key={i} b={b} onYol={onYol} />)}
        {sayfa === 'hakkinda' && (
          <div className="legal-nav">
            <button type="button" className="btn small ghost" onClick={() => setSayfa('gizlilik')}>Gizlilik</button>
            <button type="button" className="btn small ghost" onClick={() => setSayfa('hesap-sil')}>Hesap silme</button>
          </div>
        )}
        {sayfa === 'gizlilik' && <button type="button" className="linkish legal-link" onClick={() => setSayfa('privacy')}>English version</button>}
        {web && belge.yol && <p className="muted small-note">Herkese açık sayfa: <a href={belge.yol} target="_blank" rel="noreferrer">{location.host}{belge.yol}</a></p>}
      </div>
    </Sheet>
  );
}
