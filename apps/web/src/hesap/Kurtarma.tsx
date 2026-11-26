/**
 * 1.2.0 hesap kurtarma (arayüz). Sunucu: apps/server/src/kurtarma.ts; ortak kurallar @odi/shared KURTARMA_KURALLARI.
 * - KurtarmaSheet: "Hesabın var mı? E-postayla giriş yap". E-posta → kod isteği (genel yanıt; kod en geç 24 saat içinde e-postayla
 *   elle gönderilir) → "Kodum var": e-posta + 6 haneli kod → aynı adrese bağlı birden çok hesap varsa seçim → bu cihaz o hesaba geçer
 *   (hesap/gecis.ts). Oyuncu saatler sonra dönebilir: "Kodum var" doğrudan açılır, e-postayı yeniden yazar.
 * - KurtarmaKart (Ayarlar): kurtarma e-postasını ekle / değiştir / kaldır; e-postayla giriş; oturum başka cihaza taşındıysa seçenekler.
 * Aynı ekran yeni kurulumdaki açılış ekranından da açılır (TitleScreen, App.tsx).
 */
import { useState } from 'react';
import { useNet } from '@odi/net/store';
import { KURTARMA_ISTEK_ALINDI, KURTARMA_KURALLARI, epostaGecerli, normalizeEposta, type KurtarmaHesap } from '@odi/shared';
import { act, useSocial } from '../net';
import { platform } from '../platform';
import { useStore } from '../store';
import { Sheet } from '../ui/social';
import { OdiAvatar } from '../ui/OdiAvatar';
import { hesabaGec } from './gecis';
import { kurtarmaIstegi, kurtarmaUcu } from './istemci';
import './kurtarma.css';

/** son yazılan adres (bu oturumda; sayfa kapanırsa oyuncu yeniden yazar) */
let sonEposta = '';

function ago(t: number): string {
  const d = Date.now() - t;
  if (d < 3_600_000) return 'az önce';
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)} saat önce`;
  return `${Math.round(d / 86_400_000)} gün önce`;
}

type Adim = 'eposta' | 'alindi' | 'kod' | 'sec' | 'aciliyor';

export function KurtarmaSheet({ onClose, kodla = false }: { onClose: () => void; kodla?: boolean }) {
  const [adim, setAdim] = useState<Adim>(kodla ? 'kod' : 'eposta');
  const [eposta, setEposta] = useState(sonEposta);
  const [kod, setKod] = useState('');
  const [hesaplar, setHesaplar] = useState<KurtarmaHesap[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  // bu cihazda ilerlemesi olan bir hesap açıksa: geçince o hesaptan çıkılır (kendi kurtarma e-postası yoksa geri dönülemez)
  const yerelVar = useStore((s) => Object.keys(s.progress).length > 0);
  const me = useNet((s) => s.me);
  const gecerli = epostaGecerli(eposta);
  const kodTamam = kod.replace(/\D/g, '').length === KURTARMA_KURALLARI.kodHane;

  const kodIste = async () => {
    if (!gecerli || busy) return;
    setBusy(true); setErr('');
    sonEposta = normalizeEposta(eposta);
    const r = await kurtarmaIstegi({ istek: 'kod', eposta: sonEposta });
    setBusy(false);
    if (!r.ok) { setErr(r.error); platform().haptic('error'); return; }
    setAdim('alindi');
  };
  const giris = async (id?: string) => {
    if (!gecerli || !kodTamam || busy) return;
    setBusy(true); setErr('');
    sonEposta = normalizeEposta(eposta);
    const r = await kurtarmaIstegi({ istek: 'giris', eposta: sonEposta, kod: kod.replace(/\D/g, ''), ...(id ? { id } : {}) });
    if (!r.ok) { setBusy(false); setErr(r.error); platform().haptic('error'); return; }
    if ('hesaplar' in r) { setBusy(false); setHesaplar(r.hesaplar); setAdim('sec'); return; }
    if (!('token' in r)) { setBusy(false); return; }
    platform().haptic('success');
    setAdim('aciliyor');
    sonEposta = '';
    await hesabaGec(r.token, r.ilerleme);
  };

  const epostaAlani = (
    <input className="input" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
      value={eposta} maxLength={KURTARMA_KURALLARI.epostaMax} placeholder="E-posta adresin" aria-label="E-posta adresin" data-testid="kr-eposta"
      onChange={(e) => { setEposta(e.target.value); setErr(''); }} />
  );
  return (
    <Sheet title="Hesabına geri dön" onClose={() => { if (adim !== 'aciliyor') onClose(); }}>
      <div className="kr-sayfa" data-testid="kurtarma-sayfasi">
        {adim === 'eposta' && (
          <form className="kr-form" onSubmit={(e) => { e.preventDefault(); void kodIste(); }}>
            <div className="muted">Hesabına eklediğin kurtarma e-postasını yaz. Bu adrese bir giriş kodu göndereceğiz.</div>
            {epostaAlani}
            <button className="btn" data-testid="kr-kod-iste" disabled={busy || !gecerli}>{busy ? 'Gönderiliyor…' : 'Giriş kodu iste'}</button>
            <button type="button" className="linkish center" data-testid="kr-kodum-var" onClick={() => { setErr(''); setAdim('kod'); }}>Kodum var</button>
          </form>
        )}
        {adim === 'alindi' && (
          <div className="kr-form">
            <div className="kr-not" role="status" data-testid="kr-alindi">{KURTARMA_ISTEK_ALINDI}</div>
            <div className="muted">Kod yalnız bu adrese bağlı bir hesap varsa gelir. Gelen kutunda yoksa istenmeyen klasörüne de bak.</div>
            <button className="btn" data-testid="kr-kod-gir" onClick={() => setAdim('kod')}>Kodum geldi, yazacağım</button>
            <button type="button" className="btn ghost" onClick={onClose}>Sonra</button>
          </div>
        )}
        {adim === 'kod' && (
          <form className="kr-form" onSubmit={(e) => { e.preventDefault(); void giris(); }}>
            <div className="muted">E-postandaki 6 haneli kodu ve kodu istediğin adresi yaz.</div>
            {epostaAlani}
            <input className="input kr-kod" inputMode="numeric" autoComplete="one-time-code" value={kod} maxLength={12} placeholder="6 haneli kod" aria-label="Giriş kodu" data-testid="kr-kod"
              onChange={(e) => { setKod(e.target.value.replace(/[^\d ]/g, '')); setErr(''); }} />
            {yerelVar && <div className="muted small-note" data-testid="kr-uyari">Bu cihazda açık olan hesaptan{me ? ` (${me.name})` : ''} çıkacaksın. Ona dönmek istersen önce Ayarlar’dan ona da kurtarma e-postası ekle.</div>}
            <button className="btn" data-testid="kr-giris" disabled={busy || !gecerli || !kodTamam}>{busy ? 'Bakılıyor…' : 'Giriş yap'}</button>
            <button type="button" className="linkish center" onClick={() => { setErr(''); setAdim('eposta'); }}>Kodum yok, kod iste</button>
          </form>
        )}
        {adim === 'sec' && (
          <div className="kr-form">
            <div className="muted">Bu adrese bağlı birden çok hesap var. Hangisiyle devam edelim?</div>
            <div className="kr-liste">
              {hesaplar.map((h) => (
                <button key={h.id} type="button" className="kr-hesap" data-testid="kr-hesap" disabled={busy} onClick={() => void giris(h.id)}>
                  <OdiAvatar size={40} color={h.color} />
                  <span className="kr-hesap-metin"><b>{h.name}</b><small className="muted">Sv {h.level} · {h.highest}. bölüm · son görülme {ago(h.lastSeen)}</small></span>
                </button>
              ))}
            </div>
          </div>
        )}
        {adim === 'aciliyor' && <div className="kr-not" role="status" data-testid="kr-aciliyor">Hesabın açılıyor…</div>}
        {err && <div className="chat-err" role="alert" data-testid="kr-hata">{err}</div>}
      </div>
    </Sheet>
  );
}

/** "Hesabın var mı? E-postayla giriş yap" bağlantısı (sunucu adresi yoksa görünmez) */
export function HesapVarMi({ onOpen }: { onOpen: () => void }) {
  if (!kurtarmaUcu()) return null;
  return <button type="button" className="linkish center kr-link" data-testid="hesap-var-mi" onClick={onOpen}>Hesabın var mı? E-postayla giriş yap</button>;
}

/** Ayarlar › Hesap kurtarma: kurtarma e-postası (isteğe bağlı) ve e-postayla giriş */
export function KurtarmaKart() {
  const me = useNet((s) => s.me);
  const online = useNet((s) => s.status) === 'bağlı';
  const tasindi = useSocial((s) => s.tasindi);
  const [duzen, setDuzen] = useState(false); const [deger, setDeger] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [sayfa, setSayfa] = useState(false); const [yeniSor, setYeniSor] = useState(false);
  const kayitli = me?.kurtarmaEposta;
  const kaydet = async (v: string) => {
    if (v && !epostaGecerli(v)) { setErr('E-posta adresi doğru görünmüyor; bir daha bakar mısın?'); return; }
    setBusy(true); setErr('');
    const r = await act('eposta.ayarla', { eposta: v });
    setBusy(false);
    if (!r) return;
    useNet.setState({ me: r.me });
    setDuzen(false);
  };
  return (
    <div className="card kr-kart" data-testid="kurtarma-kart">
      <div><h2>Hesap kurtarma e-postası</h2>
        <div className="muted">İsteğe bağlı: telefonun değişirse ya da oyunu silersen hesabını bu adresle geri alırsın. Adresini doğrulamıyoruz, kimseye göstermiyoruz.</div></div>
      {tasindi && (
        <div className="kr-not" role="status" data-testid="kr-tasindi">
          {tasindi}
          <div className="kr-eylem">
            <button type="button" className="btn small" onClick={() => setSayfa(true)}>E-postayla giriş yap</button>
            {yeniSor
              ? <button type="button" className="btn small coral" data-testid="kr-yeni-evet" onClick={() => void hesabaGec(null, null)}>Evet, yeni hesapla başla</button>
              : <button type="button" className="btn small ghost" data-testid="kr-yeni" onClick={() => setYeniSor(true)}>Bu cihazda yeni hesapla başla</button>}
          </div>
          {yeniSor && <div className="muted small-note">Bu cihazdaki ilerleme silinir; eski hesabın diğer cihazda kalır.</div>}
        </div>
      )}
      {!tasindi && me && (duzen ? (
        <form className="kr-form" onSubmit={(e) => { e.preventDefault(); void kaydet(normalizeEposta(deger)); }}>
          <input className="input" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            value={deger} maxLength={KURTARMA_KURALLARI.epostaMax} placeholder="E-posta adresin" aria-label="Kurtarma e-postası" data-testid="kr-ayar-girdi"
            onChange={(e) => { setDeger(e.target.value); setErr(''); }} autoFocus />
          <div className="kr-eylem">
            <button className="btn small" data-testid="kr-ayar-kaydet" disabled={busy || !online || !epostaGecerli(deger)}>Kaydet</button>
            <button type="button" className="btn small ghost" onClick={() => { setDuzen(false); setErr(''); }}>Vazgeç</button>
          </div>
        </form>
      ) : (
        <div className="kr-eylem">
          <span className="kr-adres" data-testid="kr-adres">{kayitli ? <>Kurtarma adresin: <b>{kayitli}</b></> : 'Henüz eklemedin.'}</span>
          <button type="button" className="btn small" data-testid="kr-ayar-duzenle" disabled={!online} onClick={() => { setDeger(kayitli ?? ''); setDuzen(true); }}>{kayitli ? 'Değiştir' : 'Ekle'}</button>
          {kayitli && <button type="button" className="btn small ghost" data-testid="kr-ayar-kaldir" disabled={busy || !online} onClick={() => void kaydet('')}>Kaldır</button>}
        </div>
      ))}
      {!online && !tasindi && me && <div className="muted small-note">Sunucuya bağlanınca değiştirebilirsin.</div>}
      {err && <div className="chat-err" role="alert">{err}</div>}
      {!tasindi && <HesapVarMi onOpen={() => setSayfa(true)} />}
      {sayfa && <KurtarmaSheet onClose={() => setSayfa(false)} />}
    </div>
  );
}
