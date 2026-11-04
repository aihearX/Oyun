import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { useStore } from '../store';
import { Icon } from '../ui/icons';
import { TuyDede } from './Narrator';
import { useCoach } from './Coach';
import { featureById, type FeatureId } from './features';

/**
 * Kampa girişte birden çok yeni şey bekliyorsa art arda tur zinciri yerine tek kart (OT-ogrenci-birinci-14, OT-sessiz-oyuncu-9):
 * "Kamp'ta yeni 2 şey: Kamp Görevleri, Kamp oyunları", her biri için "Göster". Kart hiçbir şeyi engellemez (ekranı karartmaz);
 * belirdiği ilk anda dokunuş almaz, o an yolda olan dokunuş alttaki hedefine (ör. Liste) gider. Tur yalnız oyuncu "Göster"e
 * dokununca başlar; bitince kart kalanlarla geri gelir. Kapatmak (X) listedekileri görülmüş sayar. Yazı seslendirilmez.
 */
export const useKampYeni = create<{ items: string[] }>()(() => ({ items: [] }));
export const showKampYeni = (items: string[]) => useKampYeni.setState({ items });
export const hideKampYeni = () => useKampYeni.setState({ items: [] });
/** kartta hâlâ gösterilecekler (turu görülen düşer) */
export function kampYeniBekleyen(): string[] {
  const done = useStore.getState().ftue.tours;
  return useKampYeni.getState().items.filter((id) => !done.includes(id));
}

/** klinik (kamp oyunlarında Odyometri Odası) kurulmamışken satırın alt notu */
const NOT: Record<string, string> = { 'vaka-kur': 'Önce Odyoloji Kliniği’ni kur', 'oyun-kur': 'Önce Odyometri Odası’nı kur' };
/** "önce kur" yazısının satırı tanıttığı özelliğin adıyla görünür */
const KUR_OF: Record<string, FeatureId> = { 'vaka-kur': 'vaka', 'oyun-kur': 'kampoyun' };
export const kampYeniAd = (id: string) => featureById(KUR_OF[id] ?? (id as FeatureId)).name;
export const kampYeniBaslik = (ids: readonly string[]) => `Kamp’ta yeni ${ids.length} şey: ${ids.map(kampYeniAd).join(', ')}`;
/** belirdikten sonra dokunuş almaya başladığı an (o an yoldaki dokunuş alttakine geçer) */
const ARM_MS = 450;

/** kartın yeri: üs görünümünde üst göstergenin hemen altı (alttaki Liste/Süsle düğmeleri açık kalır); liste görünümünde sekme çubuğunun üstü */
function place(): CSSProperties {
  const top = document.querySelector('.camp-base .camp-top');
  if (top) return { top: Math.round(top.getBoundingClientRect().bottom + 8) };
  const tb = document.querySelector('nav.tabbar');
  return { bottom: Math.round((tb ? innerHeight - tb.getBoundingClientRect().top : 0) + 10) };
}

export function KampYeniKart({ onShow, calm }: { onShow(id: string): void; calm(): boolean }) {
  const items = useKampYeni((s) => s.items); const done = useStore((s) => s.ftue.tours);
  const touring = useCoach((s) => !!s.tour);
  const list = items.filter((id) => !done.includes(id));
  const [ok, setOk] = useState(false); const [pos, setPos] = useState<CSSProperties>({}); const [armed, setArmed] = useState(false);
  const want = list.length > 0 && !touring;
  // alt sayfa, kutlama ya da pencere açıkken kart görünmez (üstüne binmez); kapanınca geri gelir. Tüy Dede'nin kamp notu (yeni anıt,
  // yeni arazi; konuşması bitse de X'e dek ekranda kalır) açıkken de kart bekler: ikisi aynı yerde üst üste açılmaz, sırayla gelir
  // (OT-eski-telefon-27)
  useEffect(() => {
    if (!want) { setOk(false); return; }
    const tick = () => { const c = calm() && !document.querySelector('[data-testid="kamp-dede"]'); setOk(c); if (c) setPos(place()); };
    tick(); const h = setInterval(tick, 300); return () => clearInterval(h);
  }, [want]);
  const show = want && ok;
  useEffect(() => { if (!show) { setArmed(false); return; } const h = setTimeout(() => setArmed(true), ARM_MS); return () => clearTimeout(h); }, [show]);
  if (!show) return null;
  const close = () => { const s = useStore.getState(); for (const id of list) s.ftueTourDone(id); hideKampYeni(); };
  const card = (
    <aside className={`ear-note kamp-yeni${armed ? ' armed' : ''}`} style={pos} data-testid="kamp-yeni" data-items={list.join(' ')} aria-live="polite" aria-label="Tüy Dede: kampta yeni">
      <span className="en-face" aria-hidden><TuyDede size={46} talking={false} mood="wow" /></span>
      <div className="en-body">
        <p className="en-plain">{kampYeniBaslik(list)}</p>
        <ul className="ky-list">
          {list.map((id) => (
            <li key={id} className="ky-row">
              <span className="grow min0"><b>{kampYeniAd(id)}</b>{NOT[id] && <small>{NOT[id]}</small>}</span>
              <button type="button" className="btn small" data-testid="kamp-yeni-goster" data-tour={id} onClick={() => onShow(id)}>Göster</button>
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className="en-x" aria-label="Kapat" onClick={close}><Icon name="close" size="0.95em" /></button>
    </aside>
  );
  return createPortal(card, document.body);
}
