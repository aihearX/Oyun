/**
 * Arkadaşlar + özel mesaj durumu (zustand). Tek istemciye `bindFriends(client)` ile bağlanır (net.ts).
 * Ekranlar burayı okur; sunucu olayları (istek, kabul, dm.*) buraya yazar.
 */
import { create } from 'zustand';
import type { NetClient } from '@odi/net';
import type { DmMessage, DmThread, FriendRequest, PublicProfile } from '@odi/shared';

export interface Convo { messages: DmMessage[]; hasMore: boolean; peerReadSeq: number; canMessage: boolean; reason: string | null; loaded: boolean }
export interface Banner { id: number; kind: 'dm' | 'istek' | 'kabul' | 'hediye'; from: PublicProfile; title: string; text: string }

interface FriendsState {
  friends: PublicProfile[] | null;
  /** bugün hediye gönderilen arkadaşlar */
  gifted: string[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  threads: DmThread[] | null;
  dmUnread: number;
  convos: Record<string, Convo>;
  /** oyuncu → "yazıyor" bitiş zamanı (yerel saat) */
  typing: Record<string, number>;
  /** şu an açık özel sohbet (bildirim şeridi çıkmaz, gelenler okunur) */
  activeDm: string | null;
  /** açık profil kartı */
  profileId: string | null;
  banner: Banner | null;
  /** son bilinen profiller (sohbet başlığı vb.) */
  people: Record<string, PublicProfile>;
}

export const useFriends = create<FriendsState>()(() => ({
  friends: null, gifted: [], incoming: [], outgoing: [], threads: null, dmUnread: 0, convos: {}, typing: {}, activeDm: null, profileId: null, banner: null, people: {},
}));

let client: NetClient | null = null;
export const friendsNet = () => client;
const set = useFriends.setState;
const get = useFriends.getState;

/** isimlere dokununca: profil kartını aç (takım üyeleri, yarış lobisi, sohbet… herkes çağırabilir) */
export function openProfile(id: string): void { set({ profileId: id }); }
export function closeProfile(): void { set({ profileId: null }); }

export function remember(...ps: PublicProfile[]): void {
  if (!ps.length) return;
  set((s) => { const people = { ...s.people }; for (const p of ps) people[p.id] = p; return { people }; });
}

const upsert = (list: DmMessage[], m: DmMessage): DmMessage[] => {
  const i = list.findIndex((x) => x.id === m.id);
  if (i >= 0) { const c = list.slice(); c[i] = m; return c; }
  // seq sırasını koru
  const c = [...list, m];
  c.sort((a, b) => a.seq - b.seq);
  return c;
};
const emptyConvo = (): Convo => ({ messages: [], hasMore: false, peerReadSeq: 0, canMessage: true, reason: null, loaded: false });
export function patchConvo(id: string, f: (c: Convo) => Partial<Convo>): void {
  set((s) => { const c = s.convos[id] ?? emptyConvo(); return { convos: { ...s.convos, [id]: { ...c, ...f(c) } } }; });
}

let bannerSeq = 1;
export function showBanner(b: Omit<Banner, 'id'>): void { set({ banner: { ...b, id: bannerSeq++ } }); }

/** önizleme metni (sohbet listesi ve bildirim şeridi) */
export function preview(m: DmMessage | null, meId?: string): string {
  if (!m) return '';
  const mine = m.from === meId ? 'Sen: ' : '';
  if (m.deleted) return `${mine}🚫 Mesaj silindi`;
  if (m.kind === 'sticker') return `${mine}🎭 Odi çıkartması`;
  if (m.kind === 'davet') return `${mine}${m.meta?.type === 'yaris' ? '🏁 Yarış daveti' : '📨 Davet'}`;
  return mine + m.text.replace(/\n+/g, ' ');
}

function threadTouch(other: PublicProfile, m: DmMessage, addUnread: boolean): void {
  set((s) => {
    if (!s.threads) return {};
    const cur = s.threads.find((t) => t.other.id === other.id);
    const isLast = !cur?.last || cur.last.seq <= m.seq;
    const t: DmThread = cur
      ? { ...cur, other, last: isLast ? m : cur.last, at: isLast ? m.at : cur.at, unread: cur.unread + (addUnread ? 1 : 0) }
      : { other, last: m, at: m.at, unread: addUnread ? 1 : 0, friend: (s.friends ?? []).some((f) => f.id === other.id), canMessage: true };
    return { threads: [t, ...s.threads.filter((x) => x.other.id !== other.id)].sort((a, b) => b.at - a.at) };
  });
}

export async function refreshFriends(): Promise<void> {
  const c = client; if (!c) return;
  try {
    const [f, r] = await Promise.all([c.call('friends.list', {}), c.call('friends.requests', {})]);
    set({ friends: f.friends, gifted: f.gifted ?? [], incoming: r.incoming, outgoing: r.outgoing });
    remember(...f.friends);
  } catch { /* bağlantı gelince yine */ }
}
export async function refreshThreads(): Promise<void> {
  const c = client; if (!c) return;
  try { const t = await c.call('dm.threads', {}); set({ threads: t.threads, dmUnread: t.unread }); remember(...t.threads.map((x) => x.other)); } catch { /* sonra */ }
}

/** açık sohbette gelenleri okundu say */
export function readActive(id: string): void {
  const c = client; if (!c) return;
  const conv = get().convos[id];
  const lastIn = [...(conv?.messages ?? [])].reverse().find((m) => m.from === id);
  set((s) => ({ threads: s.threads?.map((t) => (t.other.id === id ? { ...t, unread: 0 } : t)) ?? null }));
  if (!lastIn) return;
  void c.call('dm.read', { id, upTo: lastIn.seq }).then((r) => set({ dmUnread: r.unread })).catch(() => undefined);
}

export function bindFriends(c: NetClient): () => void {
  client = c;
  const offs: (() => void)[] = [];
  const me = () => c.me?.id ?? '';
  offs.push(c.onStatus((st) => { if (st === 'bağlı') { void refreshFriends(); void refreshThreads(); } }));
  offs.push(c.on('friend.request', ({ request, removed }) => {
    remember(request.from, request.to);
    if (removed) { set((s) => ({ incoming: s.incoming.filter((r) => r.id !== request.id), outgoing: s.outgoing.filter((r) => r.id !== request.id) })); return; }
    if (request.to.id === me()) {
      set((s) => ({ incoming: [request, ...s.incoming.filter((r) => r.id !== request.id)] }));
      showBanner({ kind: 'istek', from: request.from, title: request.from.name, text: 'sana arkadaşlık isteği gönderdi' });
    } else set((s) => ({ outgoing: [request, ...s.outgoing.filter((r) => r.id !== request.id)] }));
  }));
  offs.push(c.on('friend.accepted', ({ friend }) => {
    remember(friend);
    set((s) => ({ friends: [...(s.friends ?? []).filter((f) => f.id !== friend.id), friend], outgoing: s.outgoing.filter((r) => r.to.id !== friend.id), incoming: s.incoming.filter((r) => r.from.id !== friend.id) }));
    showBanner({ kind: 'kabul', from: friend, title: friend.name, text: 'arkadaşlık isteğini kabul etti' });
  }));
  offs.push(c.on('friend.updated', ({ friend }) => {
    remember(friend);
    set((s) => (s.friends ? { friends: s.friends.some((f) => f.id === friend.id) ? s.friends.map((f) => (f.id === friend.id ? friend : f)) : [...s.friends, friend] } : {}));
  }));
  offs.push(c.on('friend.removed', ({ id }) => set((s) => ({ friends: s.friends?.filter((f) => f.id !== id) ?? null }))));
  offs.push(c.on('friend.gift', ({ from, amount }) => { remember(from); showBanner({ kind: 'hediye', from, title: `${from.name} sana hediye gönderdi`, text: `🎁 ${amount} jeton ödül kutunda seni bekliyor` }); }));
  offs.push(c.on('dm.message', ({ msg, from }) => {
    remember(from);
    const other = msg.from === me() ? msg.to : msg.from;
    const known = (get().convos[other]?.messages ?? []).some((m) => m.id === msg.id);
    patchConvo(other, (cv) => ({ messages: upsert(cv.messages, msg) }));
    const active = get().activeDm === other && typeof document !== 'undefined' && document.visibilityState !== 'hidden';
    const fresh = !known && !msg.deleted && msg.from !== me();
    threadTouch(msg.from === me() ? get().people[other] ?? from : from, msg, fresh && !active);
    if (fresh) set((s) => ({ typing: { ...s.typing, [other]: 0 } }));
    if (active) readActive(other);
    else if (fresh) showBanner({ kind: 'dm', from, title: from.name, text: preview(msg) });
  }));
  offs.push(c.on('dm.read', ({ by, seq }) => patchConvo(by, (cv) => ({ peerReadSeq: Math.max(cv.peerReadSeq, seq) }))));
  offs.push(c.on('dm.typing', ({ from }) => set((s) => ({ typing: { ...s.typing, [from]: Date.now() + 4000 } }))));
  offs.push(c.on('dm.reaction', ({ msg }) => { const other = msg.from === me() ? msg.to : msg.from; patchConvo(other, (cv) => ({ messages: upsert(cv.messages, msg) })); }));
  offs.push(c.on('dm.unread', ({ total }) => set({ dmUnread: total })));
  if (c.status === 'bağlı') { void refreshFriends(); void refreshThreads(); }
  return () => { for (const o of offs) o(); };
}

/** sohbeti (ilk sayfa ya da daha eski) yükle */
export async function loadConvo(id: string, older = false): Promise<void> {
  const c = client; if (!c) return;
  const cur = get().convos[id];
  const before = older ? cur?.messages[0]?.seq : undefined;
  if (older && (!cur?.hasMore || before == null)) return;
  const r = await c.call('dm.open', before ? { id, before } : { id });
  remember(r.other);
  patchConvo(id, (cv) => {
    let messages = older ? [...r.messages, ...cv.messages] : r.messages;
    if (!older) for (const m of cv.messages) if (!messages.some((x) => x.id === m.id) && m.seq > (r.messages.at(-1)?.seq ?? 0)) messages = [...messages, m];
    return { messages, hasMore: r.hasMore, peerReadSeq: Math.max(cv.peerReadSeq, r.peerReadSeq), canMessage: r.canMessage, reason: r.reason, loaded: true };
  });
}

/** mesaj gönder; yerelde hemen listeye eklenir */
export async function sendDm(to: string, text: string, kind: DmMessage['kind'] = 'text', meta?: DmMessage['meta']): Promise<DmMessage> {
  const c = client; if (!c) throw new Error('Sunucuya bağlı değilsin.');
  const r = await c.call('dm.send', meta ? { to, text, kind, meta } : { to, text, kind });
  patchConvo(to, (cv) => ({ messages: upsert(cv.messages, r.msg) }));
  const other = get().people[to] ?? (get().friends ?? []).find((f) => f.id === to);
  if (other) threadTouch(other, r.msg, false);
  else void refreshThreads();
  return r.msg;
}
export function applyMsg(m: DmMessage): void {
  const meId = client?.me?.id;
  const other = m.from === meId ? m.to : m.from;
  patchConvo(other, (cv) => ({ messages: upsert(cv.messages, m) }));
  set((s) => ({ threads: s.threads?.map((t) => (t.last?.id === m.id ? { ...t, last: m } : t)) ?? null }));
}
