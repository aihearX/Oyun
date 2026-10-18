import { createContext, useContext } from 'react';

/** Alt ekranlara geçiş (App sağlar). Sosyal ekranlar birbirine buradan bağlanır. */
export type SocialRoute =
  | { name: 'friends' } | { name: 'shop' } | { name: 'inbox' } | { name: 'league' }
  | { name: 'chat'; room: string; title: string }
  | { name: 'race'; inviteRoomId?: string };

export interface Nav {
  open: (r: SocialRoute) => void;
  /** bölüm oyna (haritadaki akışla aynı) */
  play: (level: number) => void;
  tab: (t: 'map' | 'today' | 'camp' | 'team' | 'profile') => void;
}
export const NavContext = createContext<Nav>({ open: () => undefined, play: () => undefined, tab: () => undefined });
export const useNav = () => useContext(NavContext);
