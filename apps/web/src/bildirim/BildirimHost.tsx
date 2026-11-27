/**
 * Anlık bildirim yardımcısı (1.3.0; App banner'ında, sekme ve alt ekranlarda çizilir): bildirime dokununca ilgili yere götürür
 * (özel mesaj konuşması, Takım, Arkadaşlar, Ödül kutusu) ve oyun içi izin ön sorusunu gösterir. Başlık ekranında ve bölüm sırasında
 * çizilmez: dokunma o arada bekler, oyuncu haritaya ya da bir ekrana gelince uygulanır (bölüm yarıda kesilmez).
 */
import { useEffect, useRef } from 'react';
import type { PushVeri } from '@odi/shared';
import { useNav, type Nav } from '../nav';
import { Sheet } from '../ui/social';
import { onIzinYanit, pushDokunusDinle, useBildirim } from './bildirim';

export function bildirimHedefi(nav: Nav, d: PushVeri): void {
  switch (d.kind) {
    case 'dm': if (d.id) nav.open({ name: 'dm', id: d.id }); else nav.open({ name: 'messages' }); break;
    case 'takim': case 'basvuru': nav.tab('team'); break;
    case 'arkadas': nav.open({ name: 'friends' }); break;
    case 'odul': nav.open({ name: 'inbox' }); break;
  }
}

export function BildirimHost() {
  const nav = useNav();
  const navRef = useRef(nav);
  navRef.current = nav;
  const onIzin = useBildirim((s) => s.onIzin);
  useEffect(() => pushDokunusDinle((d) => bildirimHedefi(navRef.current, d)), []);
  if (!onIzin) return null;
  return (
    <Sheet title="Cevap gelince haber verelim mi?" onClose={() => void onIzinYanit(false)}>
      <div className="reset-sheet" data-testid="bildirim-on-izin">
        <p>Arkadaşın sana yazınca telefonuna bildirim gelsin. Oyundayken bildirim gelmez.</p>
        <p className="muted">İstediğin zaman Ayarlar › Bildirimler bölümünden değiştirebilirsin.</p>
        <div className="rs-actions">
          <button type="button" className="btn ghost" data-testid="bildirim-hayir" onClick={() => void onIzinYanit(false)}>Şimdi değil</button>
          <button type="button" className="btn" data-testid="bildirim-evet" onClick={() => void onIzinYanit(true)}>Evet, haber ver</button>
        </div>
      </div>
    </Sheet>
  );
}
