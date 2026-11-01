import { create } from 'zustand';

/** Takım ekranının alt sekmeleri (TeamHome.tsx) */
export type TeamTab = 'sohbet' | 'basvuru' | 'uyeler' | 'yardim' | 'tekno' | 'hediye' | 'hedef' | 'savas' | 'baskin' | 'etkinlik' | 'siralama' | 'tyaris' | 'lig';
/** sekme grupları (OT-takim-kaptani-10): Sohbet ve Etkinlikler tek dokunuş; Takım ve Rekabet ikinci sırada açılır */
export type TeamGroup = 'sohbet' | 'etkinlik' | 'takim' | 'rekabet';
export const GROUP_OF: Record<TeamTab, TeamGroup> = {
  sohbet: 'sohbet', etkinlik: 'etkinlik',
  uyeler: 'takim', basvuru: 'takim', yardim: 'takim', tekno: 'takim', hediye: 'takim', hedef: 'takim',
  savas: 'rekabet', baskin: 'rekabet', tyaris: 'rekabet', lig: 'rekabet', siralama: 'rekabet',
};

/** açık sekme (ekran kapanıp açılınca da kalır) ve her grupta en son açılan sekme (grup düğmesi oraya döner) */
export const useTeamTab = create<{ tab: TeamTab; last: Partial<Record<TeamGroup, TeamTab>> }>(() => ({ tab: 'sohbet', last: {} }));

/** sekmeyi aç: Takım ekranı açıksa hemen, değilse açılınca (anlatıcı turu Takım Yarışı'nı böyle gösterir) */
export function openTeamTab(t: TeamTab): void {
  useTeamTab.setState((s) => ({ tab: t, last: { ...s.last, [GROUP_OF[t]]: t } }));
}
