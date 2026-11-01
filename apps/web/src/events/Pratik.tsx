import { useEffect, useRef, useState } from 'react';
import { ScreenHead } from '../ui/bits';
import { Art } from '../ui/art';
import { Icon } from '../ui/icons';
import { scrollAppTop } from '../ui/viewport';
import { PRATIK_SORU, pratikBaslat, pratikBitti, pratikCevapla, pratikDogru, pratikSecim, pratikSonraki, pratikSoru, type PratikTur } from './pratik';
import './events.css';

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * Bilgi pratiği (YN-078): tek başına, ödülsüz, süresiz; canlı Kulak Bilgi Yarışması'nın soru havuzu. Her cevaptan sonra doğru cevap ve
 * havuzdaki kısa açıklama. Takımsız ve çevrimdışı da açılır (sorular cihazda). Ödül, takım/lig puanı, başarım ya da görev ilerlemesi yok;
 * sıralama yok. Bu ekran oyuncu kaydına ve sunucuya hiçbir şey yazmaz (pratik.test.ts).
 */
export function PratikScreen({ level, onBack }: { level: 'genel' | 'odyoloji'; onBack: () => void }) {
  const [tur, setTur] = useState<PratikTur | null>(null);
  useEffect(() => { scrollAppTop(); }, [tur?.i, tur === null]);
  const bitti = !!tur && pratikBitti(tur);
  const q = tur ? pratikSoru(tur) : null;
  const sec = tur ? pratikSecim(tur) : null;
  const duzey = level === 'odyoloji' ? 'Odyoloji öğrencisi' : 'Genel';
  // cevaptan sonra açıklama ve "Sonraki soru" küçük ekranda (320 px, Büyük yazı) görünür alana gelsin
  const aciklama = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (sec != null) aciklama.current?.scrollIntoView({ block: 'nearest' }); }, [sec, tur?.i]);
  return (
    <div className="screen fade-in ev-screen pratik" data-testid="pratik" data-faz={!tur ? 'giris' : bitti ? 'bitti' : sec == null ? 'soru' : 'cevap'}>
      <ScreenHead title="Bilgi pratiği" onBack={onBack} />
      <div className="stack ev-quiz">
        {!tur && (
          <div className="ev-quiz-hero" data-tone="lime">
            <span className="ev-art big" aria-hidden><Art name="bulb" size="1.15em" className="art-inline" /></span>
            <b>Tek başına pratik</b>
            <span className="muted">{PRATIK_SORU} soru, süre yok. Kulak Bilgi Yarışması'nın soruları; her cevaptan sonra doğru cevap ve kısa açıklama.</span>
            <span className="muted">Düzey: {duzey} (Ayarlar › Bilgi düzeyi)</span>
            <button className="btn ev-big" data-testid="pratik-basla" onClick={() => setTur(pratikBaslat(level))}><Art name="play" size="1.15em" className="art-inline" /> Başla</button>
          </div>
        )}
        {tur && q && (
          <div className={`ev-question ${sec == null ? 'soru' : 'cevap'}`} data-tone="lime" data-index={tur.i}>
            <div className="row between"><span className="ev-tag">Soru {tur.i + 1}/{tur.qs.length}</span><span className="ev-tag">Pratik</span></div>
            <h2 className="ev-q-text">{q.text}</h2>
            <div className="ev-choices">
              {q.choices.map((c, i) => {
                const cls = sec == null ? '' : i === q.answer ? ' right' : i === sec ? ' wrong' : ' dim';
                return <button key={i} className={`ev-choice${cls}`} data-testid={`pratik-secenek-${i}`} disabled={sec != null} onClick={() => setTur(pratikCevapla(tur, i))}><span className="ev-letter">{LETTERS[i]}</span><span className="grow">{c}</span>{sec != null && i === q.answer && <span><Icon name="check" size="1.1em" className="ic-inline" /></span>}</button>;
              })}
            </div>
            {sec != null && (
              <div className="card cream ev-explain" data-testid="pratik-aciklama" role="status">
                <b>{sec === q.answer ? <><Art name="party" size="1.15em" className="art-inline" /> Doğru!</> : <><Art name="bulb" size="1.15em" className="art-inline" /> Doğru cevap: {LETTERS[q.answer]}) {q.choices[q.answer]}</>}</b>
                <span>{q.explain}</span>
                {q.oneren && <small className="ev-oneren">Öneren: <span data-ugc>{q.oneren}</span></small>}
              </div>
            )}
            {sec != null && <button ref={aciklama} className="btn pratik-sonraki" data-testid="pratik-sonraki" onClick={() => setTur(pratikSonraki(tur))}>{tur.i + 1 < tur.qs.length ? 'Sonraki soru' : 'Sonucu gör'}</button>}
          </div>
        )}
        {tur && bitti && (
          <div className="ev-quiz-hero done" data-tone="lime">
            <span className="ev-art big" aria-hidden><Art name="bulb" size="1.15em" className="art-inline" /></span>
            <b>Pratik bitti</b>
            <span className="ev-big-num" data-testid="pratik-dogru">{pratikDogru(tur)}/{tur.qs.length}</span>
            <span className="muted">doğru cevap</span>
            <div className="row pratik-son">
              <button className="btn" data-testid="pratik-yeniden" onClick={() => setTur(pratikBaslat(level))}>Yeni tur</button>
              <button className="btn ghost" onClick={onBack}>Kapat</button>
            </div>
          </div>
        )}
        <div className="card muted small-note" data-testid="pratik-not">Pratik: ödül yok, takım puanına ve lige sayılmaz. Ödüller canlı Kulak Bilgi Yarışması'nda (takımla, her gün 13:00 ve 20:00).</div>
      </div>
    </div>
  );
}
