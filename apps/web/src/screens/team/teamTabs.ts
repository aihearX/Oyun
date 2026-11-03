import { create } from 'zustand';
import type { HelpRequest } from '@odi/shared';

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

/** Yardım rozeti: yalnız benim kalkan gönderebileceğim istekler (süresi dolmamış, geçilmemiş, dolmamış, başkasının, ben göndermemişim; OT-takim-kaptani-24) */
export const sendableHelpCount = (help: HelpRequest[], meId: string, now: number): number =>
  help.filter((h) => h.from !== meId && !h.passed && !h.helpers.includes(meId) && h.helpers.length < h.max && h.expiresAt > now).length;
