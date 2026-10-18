/**
 * Etkinlik durumu (istemci): sunucudaki etkinliklerin son görünümü + gerçek zamanlı bildirim kuyruğu.
 * bindEvents(client) net.ts'ten bir kez çağrılır; olaylar depoya yazılır, bileşenler useEvents ile okur.
 */
import { create } from 'zustand';
import type { NetClient } from '@odi/net';
import { useNet } from '@odi/net/store';
import type { ChallengeState, DuelState, EventNotice, EventsOverview, HuntState, QuizInfo, QuizState, RallyState, RelayState, TeamQuestsState, TourneyState } from '@odi/shared';

export interface EventsStore {
  loaded: boolean; fast: boolean; inTeam: boolean;
  rally: RallyState | null; rallyStartsLeft: number;
  duel: DuelState | null; relay: RelayState | null; hunt: HuntState | null;
  quiz: QuizState | null; quizInfo: QuizInfo | null; quests: TeamQuestsState | null;
  challenge: ChallengeState | null; tourney: TourneyState | null;
  notices: EventNotice[];
  /** sunucu saat farkı (ms) */
  offset: number;
  dismiss(id: string): void;
}

export const useEvents = create<EventsStore>()((set) => ({
  loaded: false, fast: false, inTeam: false, rally: null, rallyStartsLeft: 0, duel: null, relay: null, hunt: null, quiz: null, quizInfo: null, quests: null,
  challenge: null, tourney: null, notices: [], offset: 0,
  dismiss: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
}));

let client: NetClient | null = null;
export const evNet = () => client;

export function applyOverview(o: EventsOverview): void {
  useEvents.setState({
    loaded: true, fast: o.fast, inTeam: o.inTeam, rally: o.rally, rallyStartsLeft: o.rallyStartsLeft, duel: o.duel, relay: o.relay, hunt: o.hunt,
    quiz: o.quiz, quizInfo: o.quizInfo, quests: o.quests, challenge: o.challenge, tourney: o.tourney, offset: o.serverTime - Date.now(),
  });
}

let inflight: Promise<void> | null = null;
/** tüm etkinlikleri sunucudan tazele (bağlanınca, takım değişince, ekran açılınca) */
export function refreshEvents(): Promise<void> {
  const c = client;
  if (!c || c.status !== 'bağlı') return Promise.resolve();
  if (!inflight) inflight = c.call('events.overview', {}).then((r) => applyOverview(r.overview), () => undefined).finally(() => { inflight = null; });
  return inflight;
}

const NOTICE_MAX = 3;
export function bindEvents(c: NetClient): () => void {
  client = c;
  // yalnızca uçtan uca test derlemesi (VITE_ODI_E2E=1): harness istemciye erişir; normal derlemede bu satır yok
  if (import.meta.env.VITE_ODI_E2E === '1') (window as unknown as { __etkinlik?: unknown }).__etkinlik = { net: () => client, events: useEvents, netStore: useNet };
  const set = useEvents.setState;
  const offs = [
    c.onStatus((s) => { if (s === 'bağlı') void refreshEvents(); }),
    c.on('rally.updated', ({ rally }) => set((s) => ({ rally: !s.rally || s.rally.id === rally.id || rally.startsAt >= s.rally.startsAt ? rally : s.rally }))),
    c.on('duel.updated', ({ duel }) => set({ duel })),
    c.on('relay.updated', ({ relay }) => set({ relay })),
    c.on('hunt.updated', ({ hunt }) => set({ hunt })),
    c.on('quiz.updated', ({ quiz }) => set((s) => ({ quiz: !s.quiz || s.quiz.id === quiz.id || quiz.phase !== 'bitti' ? quiz : s.quiz }))),
    c.on('tquests.updated', ({ quests }) => set({ quests })),
    c.on('events.notice', ({ notice }) => set((s) => ({ notices: [...s.notices.filter((n) => n.id !== notice.id), notice].slice(-NOTICE_MAX) }))),
    c.on('team.updated', ({ team }) => { const was = useEvents.getState().inTeam; if (!!team !== was) void refreshEvents(); }),
  ];
  if (c.status === 'bağlı') void refreshEvents();
  return () => { for (const o of offs) o(); };
}

/** sunucu saatine göre şimdi */
export const srvNow = () => Date.now() + useEvents.getState().offset;

/** etkinlik ekranları ve yüzen düğme için "seni bekleyen" sayısı (gerçek durumlardan) */
export function pendingCount(s: EventsStore, meId: string | null): number {
  if (!meId) return 0;
  const now = srvNow();
  let n = 0;
  if (s.rally?.status === 'acik' && s.rally.endsAt > now) { const me = s.rally.participants.find((p) => p.id === meId); if (!me || (me.tries < 3 && s.rally.participants.length >= 2)) n++; }
  if (s.relay && s.relay.current < 4 && (s.relay.carrier?.id === meId || (!s.relay.carrier && s.relay.lastRunner?.id !== meId))) n++;
  if (s.quiz && s.quiz.phase !== 'bitti' && !s.quiz.players.some((p) => p.id === meId)) n++;
  if (s.challenge && s.challenge.tries < s.challenge.maxTries && s.challenge.tries === 0) n++;
  if (s.duel?.finalPush) n++;
  return n;
}

