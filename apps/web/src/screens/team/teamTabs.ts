import { create } from 'zustand';
import { useNet } from '@odi/net/store';
import type { HelpRequest, TeamDetail, TeamGoal } from '@odi/shared';

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

/** Hedefler rozeti: alınabilir kademeler. Katılmadan önce dolan kademe (missedTiers) bu oyuncunun değil, sayılmaz (YN-146). */
export const claimableTierCount = (goals: TeamGoal[]): number =>
  goals.reduce((a, g) => a + g.tiers.filter((t, i) => g.progress >= t.need && !g.claimedTiers.includes(i) && !g.missedTiers?.includes(i)).length, 0);

/**
 * bugün kalan bölüm yardımı isteği hakkı (sunucunun takım ayrıntısından, YN-147). Bilinmiyorsa (eski sunucu) ya da gün döndüyse
 * undefined: "Yardım iste" eski davranışla görünür, sınırı sunucu yine uygular.
 */
export function helpLeftOf(team: Pick<TeamDetail, 'helpLeft' | 'helpResetAt'> | null | undefined, now: number): number | undefined {
  if (team?.helpLeft === undefined || (team.helpResetAt !== undefined && now >= team.helpResetAt)) return undefined;
  return team.helpLeft;
}
/** istek yanıtındaki kalan hak (ya da LIMIT) takım ayrıntısına yazılır: sonuç kartı ve Yardım sekmesi hemen güncellenir */
export const setHelpLeft = (n: number) => useNet.setState((s) => (s.team ? { team: { ...s.team, helpLeft: n } } : {}));

/** takım seviye eşiği (sunucudaki formülün aynısı, teamextra.ts teamXpFor: 300 × (l−1)^1,6) */
export const teamXpFor = (level: number): number => Math.round(300 * Math.pow(Math.max(0, level - 1), 1.6));
/**
 * Takım başlığındaki XP çubuğu ve yanındaki sayı aynı şeyi söyler (OT-ilk-kez-oyun-65): ikisi de seviye içi ilerleme. have / need
 * yazılır, çubuk have / need dolar; left: bir sonraki seviyeye kalan XP (birikmiş toplam "2.902 / 3.940" yazılmaz).
 */
export function teamXpProgress(level: number, xp: number, xpNext: number): { have: number; need: number; left: number; ratio: number } {
  const from = teamXpFor(level);
  const need = Math.max(1, xpNext - from); const have = Math.min(need, Math.max(0, xp - from));
  return { have, need, left: need - have, ratio: have / need };
}
