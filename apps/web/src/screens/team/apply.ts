/**
 * Takım başvurusu durumu (istemci): liderin bekleyen başvuruları (Takım sekmesi rozeti + "Başvurular"), kendi başvurularım
 * (keşifteki "Başvurularım", karar bildirimi) ve her ekrandan açılan salt okunur takım profili. Kurallar sunucuda (teamapply.ts).
 */
import { create } from 'zustand';
import { useNet } from '@odi/net/store';
import { canApprove, rejectReasonText, type TeamApplication } from '@odi/shared';
import type { NetClient } from '@odi/net';
import { getNet, toast } from '../../net';
import { platform } from '../../platform';

interface ApplyState {
  /** lider: takımın bekleyen başvuruları (null = yüklenmedi) */
  pending: TeamApplication[] | null;
  /** ben: bekleyen + son 7 günün kararları */
  mine: TeamApplication[];
  /** açık takım profili */
  profileId: string | null;
  /** keşif listesini yenile (başvuru/karar sonrası düğme durumları) */
  stamp: number;
}
export const useTeamApply = create<ApplyState>()(() => ({ pending: null, mine: [], profileId: null, stamp: 0 }));
const set = useTeamApply.setState;

export function openTeamProfile(id: string): void { platform().haptic('light'); set({ profileId: id }); }
export function closeTeamProfile(): void { set({ profileId: null }); }
export const bumpBrowse = () => set((s) => ({ stamp: s.stamp + 1 }));


const myRole = () => { const n = useNet.getState(); return n.team?.roster.find((m) => m.id === n.me?.id)?.role ?? null; };

export async function refreshPending(): Promise<void> {
  const c = getNet(); if (!c || c.status !== 'bağlı') return;
  if (!canApprove(myRole())) { set({ pending: null }); return; }
  try { set({ pending: (await c.call('team.applications', {})).applications }); } catch { /* sonra */ }
}
export async function refreshMine(seen = false): Promise<void> {
  const c = getNet(); if (!c || c.status !== 'bağlı') return;
  try { set({ mine: (await c.call('team.apply.mine', seen ? { seen } : {})).applications }); } catch { /* sonra */ }
}

/** karar bildirimi (gerçek zamanlı ya da bağlanınca görülmemiş kararlar) */
function announce(a: TeamApplication): void {
  if (a.status === 'kabul') { platform().haptic('success'); toast('🎉', `${a.teamName} takımına kabul edildin!`, 'Takım sohbetinde bir merhaba de.', 'green'); }
  else if (a.status === 'red') toast('✉️', `${a.teamName} başvurunu kabul etmedi`, a.reason ? rejectReasonText(a.reason) : 'Başka bir takıma başvurabilirsin.', 'bronze');
  else if (a.status === 'sure') toast('⏳', `${a.teamName} başvurunun süresi doldu`, '7 gün içinde yanıt gelmedi; yeniden başvurabilirsin.', 'bronze');
}

export function bindTeamApply(c: NetClient): void {
  c.on('team.applications', ({ teamId, applications }) => {
    if (useNet.getState().team?.id !== teamId) return;
    const before = new Set((useTeamApply.getState().pending ?? []).map((a) => a.id));
    set({ pending: applications });
    const fresh = applications.filter((a) => !before.has(a.id));
    if (fresh.length === 1) toast('✉️', `Yeni başvuru: ${fresh[0]!.player.name}`, 'Takım › Başvurular’dan onaylayabilirsin.', 'accent');
    else if (fresh.length > 1) toast('✉️', `${fresh.length} yeni başvuru`, 'Takım › Başvurular’dan onaylayabilirsin.', 'accent');
  });
  c.on('team.apply.updated', ({ application }) => {
    set((s) => ({ mine: [application, ...s.mine.filter((a) => a.id !== application.id)], stamp: s.stamp + 1 }));
    if (application.status === 'kabul' || application.status === 'red' || application.status === 'sure') {
      announce(application);
      // gördü: rozet kalkar, tekrar bağlanınca yeniden bildirilmez (red/süre "Başvurularım"da görünmeye devam eder)
      void refreshMine(true);
    }
  });
  c.onStatus((st) => {
    if (st !== 'bağlı') return;
    void (async () => {
      await refreshMine();
      const unseen = useTeamApply.getState().mine.filter((a) => !a.seen && a.status !== 'bekliyor' && a.status !== 'iptal' && a.status !== 'otomatik');
      for (const a of unseen.slice(0, 2)) announce(a);
      if (unseen.length) await refreshMine(true);
    })();
  });
  // takım ya da rol değişince liderin listesi
  let key = '';
  useNet.subscribe((n) => {
    const k = `${n.status}:${n.team?.id ?? ''}:${n.team?.roster.find((m) => m.id === n.me?.id)?.role ?? ''}`;
    if (k === key) return; key = k;
    if (n.status === 'bağlı' && n.team) void refreshPending(); else if (!n.team) set({ pending: null });
  });
}
