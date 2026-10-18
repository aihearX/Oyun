/**
 * İsteğe bağlı React yardımcısı (zustand). Uygulama tek bir istemciyi `bindNet(client)` ile bağlar;
 * bileşenler `useNet((s) => s.wallet)` gibi seçicilerle okur. React ve zustand peer dependency'dir.
 */
import { create } from 'zustand';
import type { CampState, ChatMessage, EvtMap, MyProfile, RaceRoom, RaidState, TeamDetail, TeamExtra, WarState, Wallet } from '@odi/shared';
import type { NetClient, NetStatus } from './client';

export type CampHelpRequest = EvtMap['team.campHelpNeeded']['requests'][number];

export interface NetState {
  status: NetStatus;
  me: MyProfile | null;
  wallet: Wallet | null;
  team: TeamDetail | null;
  extra: TeamExtra | null;
  camp: CampState | null;
  war: WarState | null;
  raid: RaidState | null;
  race: RaceRoom | null;
  /** alınmamış ödül kutusu öğeleri */
  inboxCount: number;
  /** alınmamış takım hediyeleri */
  giftCount: number;
  /** oda → okunmamış mesaj sayısı (açık oda sayılmaz) */
  unread: Record<string, number>;
  activeRoom: string | null;
  /** son gelen mesajlar (oda başına en çok 50) */
  messages: Record<string, ChatMessage[]>;
  campHelp: CampHelpRequest[];
  /** arkadaş/takım arkadaşı çevrimiçi durumu */
  presence: Record<string, boolean>;
  /** son olay olarak gelen davet */
  raceInvite: EvtMap['race.invited'] | null;
  kickedReason: string | null;
  setActiveRoom: (room: string | null) => void;
  markRead: (room: string) => void;
  clearRaceInvite: () => void;
}

const MAX_MSGS = 50;
const giftsOf = (x: TeamExtra | null) => (x ? x.gifts.filter((g) => !g.claimed && g.expiresAt > Date.now()).length : 0);

export const useNet = create<NetState>()((set) => ({
  status: 'kapalı', me: null, wallet: null, team: null, extra: null, camp: null, war: null, raid: null, race: null,
  inboxCount: 0, giftCount: 0, unread: {}, activeRoom: null, messages: {}, campHelp: [], presence: {}, raceInvite: null, kickedReason: null,
  setActiveRoom: (room) => set((s) => ({ activeRoom: room, unread: room ? { ...s.unread, [room]: 0 } : s.unread })),
  markRead: (room) => set((s) => ({ unread: { ...s.unread, [room]: 0 } })),
  clearRaceInvite: () => set({ raceInvite: null }),
}));

/** istemci olaylarını depoya bağlar; dönüş değeri bağı çözer */
export function bindNet(client: NetClient): () => void {
  const set = useNet.setState;
  const get = useNet.getState;
  const offs: (() => void)[] = [];
  const refresh = async () => {
    try {
      const [w, t, inbox] = await Promise.all([client.call('wallet.get', {}), client.call('team.detail', {}), client.call('inbox.list', {})]);
      set({ wallet: w.wallet, team: t.team, inboxCount: inbox.items.length });
      if (t.team) { const x = await client.call('team.extra', {}); set({ extra: x.extra, giftCount: giftsOf(x.extra) }); }
      else set({ extra: null, giftCount: 0 });
    } catch { /* bağlantı koptuysa bir sonraki bağlanışta yenilenir */ }
  };
  set({ status: client.status, me: client.me });
  offs.push(client.onStatus((status) => { set({ status }); if (status === 'bağlı') void refresh(); }));
  offs.push(client.onMe((me) => set({ me })));
  offs.push(client.on('wallet.updated', ({ wallet }) => set({ wallet })));
  offs.push(client.on('team.updated', ({ team }) => set(team ? { team } : { team: null, extra: null, giftCount: 0 })));
  offs.push(client.on('team.extra.updated', ({ extra }) => set({ extra, giftCount: giftsOf(extra) })));
  offs.push(client.on('team.gift', () => set((s) => ({ giftCount: s.giftCount + 1 }))));
  offs.push(client.on('camp.updated', ({ camp }) => set({ camp })));
  offs.push(client.on('team.campHelpNeeded', ({ requests }) => set({ campHelp: requests })));
  offs.push(client.on('war.updated', ({ war }) => set({ war })));
  offs.push(client.on('raid.updated', ({ raid }) => set({ raid })));
  offs.push(client.on('race.updated', ({ room }) => set({ race: room.status === 'bitti' && !room.players.some((p) => p.id === get().me?.id) ? null : room })));
  offs.push(client.on('race.invited', (inv) => set({ raceInvite: inv })));
  offs.push(client.on('inbox.new', () => set((s) => ({ inboxCount: s.inboxCount + 1 }))));
  offs.push(client.on('presence', ({ id, online }) => set((s) => ({ presence: { ...s.presence, [id]: online } }))));
  offs.push(client.on('kicked', ({ reason }) => set({ kickedReason: reason })));
  offs.push(client.on('chat', ({ msg }) => set((s) => {
    const list = [...(s.messages[msg.room] ?? []), msg].slice(-MAX_MSGS);
    const mine = msg.from === s.me?.id;
    const unread = s.activeRoom === msg.room || mine ? s.unread : { ...s.unread, [msg.room]: (s.unread[msg.room] ?? 0) + 1 };
    return { messages: { ...s.messages, [msg.room]: list }, unread };
  })));
  if (client.status === 'bağlı') void refresh();
  return () => { for (const o of offs) o(); };
}

/** ödül kutusundan alınınca sayaç düşsün diye yardımcı */
export async function claimInbox(client: NetClient, id: string) {
  const r = await client.call('inbox.claim', { id });
  useNet.setState((s) => ({ wallet: r.wallet, inboxCount: Math.max(0, s.inboxCount - 1) }));
  return r;
}
