/**
 * Dolap › Profil fotoğrafı (1.1.0): ekle, değiştir, kaldır. İsteğe bağlı; fotoğraf herkese görünür, yoksa renkli Odi görünür.
 * Seçme / küçültme / gönderme foto.ts'te.
 */
import { useState } from 'react';
import { useNet } from '@odi/net/store';
import { toast } from '../net';
import { platform } from '../platform';
import { OdiAvatar } from '../ui/OdiAvatar';
import { chooseAndUpload, removePhoto, usePhoto } from './foto';

export function FotoKart({ color, hat }: { color: number; hat?: string }) {
  const me = useNet((s) => s.me);
  const online = useNet((s) => s.status) === 'bağlı' && !!me;
  const url = usePhoto(me?.id, me?.photo);
  const [stage, setStage] = useState<'' | 'sec' | 'kucult' | 'gonder' | 'kaldir'>('');
  const busy = stage !== '';
  const pick = async () => {
    setStage('sec');
    const r = await chooseAndUpload((s) => setStage(s));
    setStage('');
    if (!r) return;
    if (r.ok) { platform().haptic('success'); toast('📸', 'Fotoğrafın hazır', 'Artık oyunda herkes görüyor.', 'green'); }
    else { platform().haptic('error'); toast('🙈', 'Fotoğraf eklenemedi', r.error, 'bronze'); }
  };
  const remove = async () => {
    setStage('kaldir');
    const ok = await removePhoto();
    setStage('');
    if (ok) toast('🫥', 'Fotoğraf kaldırıldı', 'Yerine Odi’n görünüyor.');
    else toast('🙈', 'Olmadı', 'Bağlantı gelince yeniden dene.', 'bronze');
  };
  const label = stage === 'kucult' ? 'Hazırlanıyor…' : stage === 'gonder' ? 'Gönderiliyor…' : stage === 'kaldir' ? 'Kaldırılıyor…' : url ? 'Değiştir' : 'Fotoğraf ekle';
  return (
    <div className="card foto-kart" data-testid="foto-kart" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <OdiAvatar size={72} color={color} hat={hat} pid={me?.id} photo={me?.photo} />
      <div className="min0 grow" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <b>Profil fotoğrafı</b>
        <div className="muted small-note">İstersen Odi yerine fotoğrafın görünsün. Fotoğrafın oyunda herkese görünür; adres, okul gibi bilgiler içeren fotoğraf koyma.</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button className="btn small" data-testid="foto-ekle" disabled={!online || busy} onClick={() => void pick()}>{label}</button>
          {url && <button className="btn small ghost" data-testid="foto-kaldir" disabled={!online || busy} onClick={() => void remove()}>Kaldır</button>}
        </div>
        {!online && <div className="muted small-note">Fotoğraf sunucuya gider; bağlanınca ekleyebilirsin.</div>}
      </div>
    </div>
  );
}
