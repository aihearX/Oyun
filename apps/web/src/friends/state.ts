/**
 * Arkadaşlar + özel mesaj durumu (zustand). Tek istemciye `bindFriends(client)` ile bağlanır (net.ts).
 * Ekranlar burayı okur; sunucu olayları (istek, kabul, dm.*) buraya yazar.
 */
import { create } from 'zustand';
import { NetError, newRunId, type NetClient } from '@odi/net';
import { FRIEND_LIMITS, type DmMessage, type DmThread, type FriendRequest, type PublicProfile } from '@odi/shared';

export interface Convo { messages: DmMessage[]; hasMore: boolean; peerReadSeq: number; canMessage: boolean; reason: string | null; loaded: boolean }
/**
 * Gönderilmeyi bekleyen özel mesaj (YN-085): yazılan mesaj kutudan hemen çıkar, konuşmada gri "bağlanınca gidecek" balonu olur;
 * bağlıyken hemen, değilse bağlanınca sırayla gider. Gönderim kimliği (cid) sunucuda tekildir: yanıt kaybolup yeniden gönderilse de
 * mesaj bir kez yazılır ve hız sınırına sayılmaz. `error`: sunucu kalıcı olarak reddetti (balonda neden + Tekrar dene / Sil).
 */
export interface PendingDm { cid: string; to: string; text: string; kind: DmMessage['kind']; at: number; error?: string }
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
  /** gönderilmeyi bekleyen özel mesajlar (yazılış sırasıyla) */
  outbox: PendingDm[];
}

export const useFriends = create<FriendsState>()(() => ({
  friends: null, gifted: [], incoming: [], outgoing: [], threads: null, dmUnread: 0, convos: {}, typing: {}, activeDm: null, profileId: null, banner: null, people: {}, outbox: [],
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
  if (m.deleted) return `${mine}Mesaj silindi`;
  if (m.kind === 'sticker') return `${mine}Odi çıkartması`;
  if (m.kind === 'davet') return `${mine}${m.meta?.type === 'yaris' ? 'Yarış daveti' : 'Davet'}`;
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
  offs.push(c.onStatus((st) => { if (st === 'bağlı') { void refreshFriends(); void refreshThreads(); void flushDm(); } }));
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

/** gönderilen mesajı konuşmaya ve sohbet listesine yaz */
function delivered(to: string, msg: DmMessage, cid?: string): void {
  set((s) => {
    const c = s.convos[to] ?? emptyConvo();
    return { convos: { ...s.convos, [to]: { ...c, messages: upsert(c.messages, msg) } }, outbox: cid ? s.outbox.filter((x) => x.cid !== cid) : s.outbox };
  });
  const other = get().people[to] ?? (get().friends ?? []).find((f) => f.id === to);
  if (other) threadTouch(other, msg, false);
  else void refreshThreads();
}

/** mesaj gönder (davet kartı vb.: yanıtı bekleyen çağıranlar); gönderim kimliğiyle, yanıt gelmeden koparsa bir kez yeniden denenir */
export async function sendDm(to: string, text: string, kind: DmMessage['kind'] = 'text', meta?: DmMessage['meta']): Promise<DmMessage> {
  const c = client; if (!c) throw new Error('Sunucuya bağlı değilsin.');
  const req = { to, text, kind, cid: newRunId(), ...(meta ? { meta } : {}) };
  const r = await c.call('dm.send', req).catch((e: unknown) => { if (e instanceof NetError && e.code === 'KOPTU') return c.call('dm.send', req); throw e; });
  delivered(to, r.msg);
  return r.msg;
}

/** konuşma ekranından mesaj: hemen bekleyen balon olur, bağlıysa şimdi, değilse bağlanınca gider (YN-085) */
export function queueDm(to: string, text: string, kind: DmMessage['kind'] = 'text'): void {
  set((s) => ({ outbox: [...s.outbox, { cid: newRunId(), to, text, kind, at: Date.now() }] }));
  void flushDm();
}
/** reddedilen bekleyen mesaj: yeniden dene ya da sil */
export function retryDm(cid: string): void { set((s) => ({ outbox: s.outbox.map((x) => (x.cid === cid ? { ...x, error: undefined } : x)) })); void flushDm(); }
export function dropDm(cid: string): void { set((s) => ({ outbox: s.outbox.filter((x) => x.cid !== cid) })); }

/** geçici hata (bağlantı yok/koptu, geç yanıt): mesaj kuyrukta kalır, bağlanınca (onStatus) ya da kısa süre sonra yine denenir */
const TRANSIENT = new Set(['CEVRIMDISI', 'KOPTU', 'ZAMAN_ASIMI', 'KAPALI']);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let flushing = false;
let lastSentAt = 0;
/** bekleyen mesajları sırayla gönder (tek akış); aralarında sunucunun bekleme süresi kadar durur, hız uyarısı çıkmaz */
export async function flushDm(): Promise<void> {
  if (flushing) return;
  flushing = true;
  let retryLater = false;
  try {
    let hiz = 0;
    for (;;) {
      const c = client;
      const item = get().outbox.find((x) => !x.error);
      if (!c || !item || c.status !== 'bağlı') break;
      const gap = lastSentAt + FRIEND_LIMITS.dmCooldownMs + 50 - Date.now();
      if (gap > 0) await wait(gap);
      if (!get().outbox.some((x) => x.cid === item.cid)) continue; // beklerken silindi
      try {
        const r = await c.call('dm.send', { to: item.to, text: item.text, kind: item.kind, cid: item.cid });
        lastSentAt = Date.now(); hiz = 0;
        delivered(item.to, r.msg, item.cid);
      } catch (e) {
        const code = e instanceof NetError ? e.code : '';
        // sunucunun bekleme süresi (saat farkı): aynı kimlikle biraz sonra yine; oyuncuya uyarı gösterilmez
        if (code === 'HIZ' && hiz++ < 5) { lastSentAt = Date.now(); continue; }
        if (TRANSIENT.has(code)) { retryLater = code === 'ZAMAN_ASIMI'; break; }
        const error = e instanceof Error ? e.message : 'Gönderilemedi.';
        set((s) => ({ outbox: s.outbox.map((x) => (x.cid === item.cid ? { ...x, error } : x)) }));
      }
    }
  } finally { flushing = false; }
  if (retryLater) setTimeout(() => void flushDm(), 1500);
}
export function applyMsg(m: DmMessage): void {
  const meId = client?.me?.id;
  const other = m.from === meId ? m.to : m.from;
  patchConvo(other, (cv) => ({ messages: upsert(cv.messages, m) }));
  set((s) => ({ threads: s.threads?.map((t) => (t.last?.id === m.id ? { ...t, last: m } : t)) ?? null }));
}
