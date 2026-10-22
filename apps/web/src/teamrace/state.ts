/**
 * Takım rekabeti durumu (istemci): Takım Yarışı lobisi, eşleşme (oyunu başlatır), sonuçlar, gelen dostluk davetleri, yarış içi tepkiler
 * ve Takım Ligi. `bindTeamRace(client)` net.ts'ten bir kez çağrılır. Tüm sayılar sunucudan (docs/16-takim-rekabeti.md).
 */
import { create } from 'zustand';
import type { NetClient } from '@odi/net';
import { useNet } from '@odi/net/store';
import type { RaceRoom, TeamLeagueState, TeamRaceChallenge, TeamRaceResult, TeamRaceState } from '@odi/shared';
import { toast } from '../net';

export interface TeamRaceStore {
  state: TeamRaceState | null;
  league: TeamLeagueState | null;
  /** eşleşme geldi: App bölüme geçer (bir kez tüketilir) */
  matched: RaceRoom | null;
  /** maç kimliği → sonuç */
  results: Record<string, TeamRaceResult>;
  /** yarış içi tepkiler (son birkaç; HUD gösterir) */
  reactions: { id: number; name: string; emoji: string }[];
  /** okunmamış dostluk daveti */
  challenge: TeamRaceChallenge | null;
}
export const useTeamRace = create<TeamRaceStore>()(() => ({ state: null, league: null, matched: null, results: {}, reactions: [], challenge: null }));
const set = useTeamRace.setState;
let client: NetClient | null = null;
export const trNet = () => client;
let seq = 0;

export async function refreshTeamRace(): Promise<void> {
  const c = client; if (!c || c.status !== 'bağlı' || !useNet.getState().team) return;
  try { set({ state: (await c.call('trace.state', {})).state }); } catch { /* sonra */ }
}
export async function refreshLeague(): Promise<void> {
  const c = client; if (!c || c.status !== 'bağlı' || !useNet.getState().team) return;
  try { set({ league: (await c.call('tlig.state', {})).state }); } catch { /* sonra */ }
}
export const takeMatch = (): RaceRoom | null => { const m = useTeamRace.getState().matched; if (m) set({ matched: null }); return m; };

export function bindTeamRace(c: NetClient): void {
  client = c;
  c.on('trace.updated', ({ lobby }) => set((s) => (s.state ? { state: { ...s.state, lobby } } : {})));
  c.on('trace.matched', ({ room }) => { set((s) => ({ matched: room, state: s.state ? { ...s.state, live: room } : s.state })); });
  c.on('trace.result', ({ result }) => {
    set((s) => ({ results: { ...s.results, [result.matchId]: result } }));
    void refreshTeamRace(); void refreshLeague();
  });
  c.on('trace.challenged', ({ challenge }) => {
    set({ challenge });
    toast('🏁', `${challenge.emblem} ${challenge.name} sizi Takım Yarışına davet ediyor`, `${challenge.size}'e ${challenge.size} · Takım › Takım Yarışı`);
    void refreshTeamRace();
  });
  c.on('trace.reaction', ({ name, emoji }) => {
    const id = ++seq;
    set((s) => ({ reactions: [...s.reactions.slice(-3), { id, name, emoji }] }));
    setTimeout(() => set((s) => ({ reactions: s.reactions.filter((r) => r.id !== id) })), 2600);
  });
  c.onStatus((st) => { if (st === 'bağlı') { void refreshTeamRace(); } });
}
