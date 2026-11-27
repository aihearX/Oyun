/**
 * Ayarlar › Bildirimler (1.3.0; yalnız telefon kabuğunda). Türler sunucuda saklanır ('push.settings'; apps/server/src/push.ts):
 * Özel mesajlar (açık), Takım sohbeti (kapalı), Arkadaşlar ve hediyeler (açık), Takım başvuruları (açık). Telefonun izni yoksa
 * "İzin ver", reddedildiyse telefon ayarlarına götüren düğme görünür.
 */
import { useState } from 'react';
import { useNet } from '@odi/net/store';
import { PUSH_KATEGORILER, PUSH_KATEGORI_AD, type PushKategori } from '@odi/shared';
import { platform } from '../platform';
import { izinIste, pushDestekli, turAyarla, useBildirim } from './bildirim';

function OnOff({ label, on, onChange, testid, disabled }: { label: string; on: boolean; onChange: (v: boolean) => void; testid?: string; disabled?: boolean }) {
  return (
    <div className="seg onoff" role="radiogroup" aria-label={label} data-testid={testid}>
      <button type="button" role="radio" aria-checked={on} className={on ? 'on' : ''} disabled={disabled} onClick={() => onChange(true)}>Açık</button>
      <button type="button" role="radio" aria-checked={!on} className={on ? '' : 'on'} disabled={disabled} onClick={() => onChange(false)}>Kapalı</button>
    </div>
  );
}

export function BildirimKart() {
  const online = useNet((s) => s.status) === 'bağlı';
  const settings = useBildirim((s) => s.settings);
  const izin = useBildirim((s) => s.izin);
  const [busy, setBusy] = useState<PushKategori | null>(null);
  const [hata, setHata] = useState('');
  if (!pushDestekli()) return null;
  const set = async (k: PushKategori, on: boolean) => {
    if (!settings || settings[k] === on || busy) return;
    setBusy(k); setHata('');
    try { await turAyarla(k, on); } catch { setHata('Kaydedilemedi. Bağlantı gelince bir daha dene.'); } finally { setBusy(null); }
  };
  return (
    <div className="card" data-testid="bildirimler">
      <h2>Bildirimler</h2>
      <div className="muted">Oyun kapalıyken telefonuna haber verir. Oyundayken bildirim gelmez. Gece 23.00 ile sabah 08.00 arasında yalnız özel mesaj bildirimi gelir.</div>
      {izin === 'denied' && (
        <div className="set-note" role="status" data-testid="bildirim-izin-kapali" style={{ marginTop: 8 }}>
          Bildirimler telefonun ayarlarında kapalı. Açmak için telefonunun Ayarlar sayfasında ODİ için bildirimlere izin ver.
          <div style={{ marginTop: 8 }}><button type="button" className="btn small ghost" data-testid="bildirim-ayarlari-ac" onClick={() => platform().push?.openSettings()}>Telefon ayarlarını aç</button></div>
        </div>
      )}
      {izin === 'undetermined' && (
        <div className="row between set-row" style={{ marginTop: 8 }} data-testid="bildirim-izin-sor">
          <div className="set-text muted">Bildirim almak için telefonun izni gerekiyor.</div>
          <button type="button" className="btn small" data-testid="bildirim-izin-ver" onClick={() => void izinIste()}>İzin ver</button>
        </div>
      )}
      {!online || !settings
        ? <div className="muted" style={{ marginTop: 8 }}>Bildirim ayarları sunucuya bağlanınca görünür.</div>
        : PUSH_KATEGORILER.map((k) => (
          <div key={k} className="row between set-row" style={{ marginTop: 10 }}>
            <div className="set-text"><b>{PUSH_KATEGORI_AD[k].ad}</b><div className="muted">{PUSH_KATEGORI_AD[k].aciklama}</div></div>
            <OnOff label={PUSH_KATEGORI_AD[k].ad} on={settings[k]} disabled={busy !== null} onChange={(v) => void set(k, v)} testid={`bildirim-${k}`} />
          </div>
        ))}
      {hata && <div className="set-note" role="alert" style={{ marginTop: 8 }}>{hata}</div>}
    </div>
  );
}
