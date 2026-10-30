import { createContext, useContext } from 'react';
import type { EventView } from './events/EventsScreen';
import type { EventFlash } from './events/EventLevel';

/** Alt ekranlara geçiş (App sağlar). Sosyal ekranlar birbirine buradan bağlanır. */
export type SocialRoute =
  | { name: 'friends' } | { name: 'shop' } | { name: 'inbox' } | { name: 'league' }
  | { name: 'chat'; room: string; title: string }
  | { name: 'race'; inviteRoomId?: string }
  /** özel mesajlar: gelen kutusu ve birebir sohbet (id = karşı oyuncu) */
  | { name: 'messages' } | { name: 'dm'; id: string }
  /** Birlikte: İkili Görev, Usta–Çırak, sohbet ayarları (comm/Together.tsx) */
  | { name: 'birlikte' }
  /** Sıralama: oyuncu ve takım tabloları (rank/RankScreen.tsx) */
  | { name: 'siralama' }
  /** Profil › Kurucular: kapalı betanın Kurucu Yolcuları (kurucu/Kurucular.tsx, YN-041) */
  | { name: 'kurucular' }
  /** arkadaşın ya da takım arkadaşının kampı (salt okunur, hazır tepki; camp/Ziyaret.tsx) */
  | { name: 'kamp'; id: string }
  /** etkinlik merkezi ya da tek bir etkinlik (flash: etkinlik koşusunun kısa sonucu) */
  | { name: 'events'; view?: EventView; flash?: EventFlash };

export interface Nav {
  open: (r: SocialRoute) => void;
  /** bölüm oyna (haritadaki akışla aynı) */
  play: (level: number) => void;
  tab: (t: 'map' | 'today' | 'camp' | 'team' | 'profile') => void;
}
export const NavContext = createContext<Nav>({ open: () => undefined, play: () => undefined, tab: () => undefined });
export const useNav = () => useContext(NavContext);
