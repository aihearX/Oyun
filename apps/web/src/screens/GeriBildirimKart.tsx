import { useState } from 'react';
import { FEEDBACK_LIMITS, FEEDBACK_TOPIC_LABEL, FEEDBACK_TOPICS, type FeedbackTopic } from '@odi/shared';
import { Sheet } from '../ui/social';
import { TuyDede } from '../ftue/Narrator';
import { platform } from '../platform';
import { sendFeedback, type FeedbackSendResult } from '../geribildirim';

type Durum = 'form' | 'gonderiliyor' | Exclude<FeedbackSendResult, 'ok' | 'bos'> | 'tesekkur';

/** gönderim sonucu iletileri: sakin, oyunu durdurmayan; yazılan metin yerinde kalır */
const ILETI: Partial<Record<Durum, string>> = {
  hata: 'Şu an gönderilemedi. Bağlantın gelince yeniden dene; yazdığın burada duruyor.',
  cok: 'Kısa sürede çok not geldi. Biraz sonra yeniden dene; yazdığın burada duruyor.',
  kapali: 'Bu test oturumunda gönderim kapalı.',
};

/**
 * Ayarlar › Geri bildirim gönder: konu (Hata / Zorluk / Öneri / Diğer) + en çok 500 karakter. Gönderilen: konu, metin (e-posta,
 * telefon, uzun rakam dizisi çıkarılarak), geldiği ekranın adı, sürüm, platform. Oyuncu kimliği yok (geribildirim.ts).
 */
export function GeriBildirimKart() {
  const [acik, setAcik] = useState(false);
  const [konu, setKonu] = useState<FeedbackTopic>('hata');
  const [metin, setMetin] = useState('');
  const [durum, setDurum] = useState<Durum>('form');
  const kapat = () => { if (durum !== 'gonderiliyor') { setAcik(false); if (durum === 'tesekkur') setDurum('form'); } };
  const gonder = async () => {
    if (durum === 'gonderiliyor' || metin.trim().length < 3) return;
    setDurum('gonderiliyor');
    const r = await sendFeedback(konu, metin);
    if (r === 'ok') { try { platform().haptic('success'); } catch { /* yok */ } setMetin(''); setDurum('tesekkur'); return; }
    setDurum(r === 'bos' ? 'hata' : r);
  };
  const uzunluk = metin.length;
  return (
    <div className="card fb-card" data-testid="geri-bildirim-kart">
      <div className="row between">
        <div className="min0"><h2>Geri bildirim gönder</h2><div className="muted">Bir yerde takıldın mı, bir fikrin mi var? Oyundan çıkmadan yaz.</div></div>
        <button type="button" className="btn small" data-testid="geri-bildirim-ac" onClick={() => setAcik(true)}>Yaz</button>
      </div>
      {acik && (
        <Sheet title="Geri bildirim gönder" onClose={kapat}>
          {durum === 'tesekkur' ? (
            <div className="fb-sheet fb-tesekkur" data-testid="geri-bildirim-tesekkur" role="status">
              <div className="row fb-dede"><TuyDede size={56} /><div className="min0"><b>Teşekkürler!</b><div className="muted">Notun bize ulaştı. Okuyup oyunu daha iyi yapmak için kullanacağız.</div></div></div>
              <div className="fb-actions">
                <button type="button" className="btn ghost small" data-testid="geri-bildirim-yeni" onClick={() => setDurum('form')}>Bir not daha yaz</button>
                <button type="button" className="btn small" onClick={kapat}>Kapat</button>
              </div>
            </div>
          ) : (
            <form className="fb-sheet" data-testid="geri-bildirim-form" onSubmit={(e) => { e.preventDefault(); void gonder(); }}>
              <div className="muted">Hangi ekrandan geldiğini ve oyunun sürümünü de ekleriz; kim olduğunu eklemeyiz.</div>
              <div className="seg fb-topics" role="radiogroup" aria-label="Konu">
                {FEEDBACK_TOPICS.map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={konu === k} className={konu === k ? 'on' : ''} data-testid={`geri-bildirim-konu-${k}`} onClick={() => setKonu(k)}>{FEEDBACK_TOPIC_LABEL[k]}</button>
                ))}
              </div>
              <label className="field">
                <span className="row between"><span>Ne oldu?</span><i className="muted fb-sayac" aria-hidden>{uzunluk}/{FEEDBACK_LIMITS.textMax}</i></span>
                <textarea className="input fb-text" data-testid="geri-bildirim-metin" value={metin} maxLength={FEEDBACK_LIMITS.textMax} rows={4} aria-label="Geri bildirim"
                  placeholder="ör. 3. bölümde Başla’ya basınca ekran donuyor." onChange={(e) => { setMetin(e.target.value.slice(0, FEEDBACK_LIMITS.textMax)); if (durum !== 'gonderiliyor') setDurum('form'); }} />
              </label>
              <div className="fb-uyari" data-testid="geri-bildirim-uyari">Adını, telefonunu ya da e-postanı yazma.</div>
              {ILETI[durum] && <div className="fb-msg" role="status" data-testid="geri-bildirim-sonuc" data-durum={durum}>{ILETI[durum]}</div>}
              <button type="submit" className="btn" data-testid="geri-bildirim-gonder" disabled={durum === 'gonderiliyor' || metin.trim().length < 3}>{durum === 'gonderiliyor' ? 'Gönderiliyor…' : 'Gönder'}</button>
            </form>
          )}
        </Sheet>
      )}
    </div>
  );
}
