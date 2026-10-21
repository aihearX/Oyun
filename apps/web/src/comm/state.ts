/**
 * İletişim durumu (istemci): ayarlar (serbest yazı / akışta paylaşım), bildirim şeridi, bahsetmeler, Günün Sorusu,
 * İkili Görev ve Usta–Çırak. `bindComm(client)` net.ts'ten bir kez çağrılır. Sohbet mesajları @odi/net/store'dadır;
 * `chat.updated` (tepki, kart birleşmesi, soru açıklaması) oradaki listeyi yerinde günceller.
 */
import { create } from 'zustand';
import type { NetClient } from '@odi/net';
import { useNet } from '@odi/net/store';
import { COMM_RULES, type ChatMessage, type CommNotice, type CommSettings, type DqState, type DuoState, type MentorState } from '@odi/shared';

export interface CommStore {
  settings: CommSettings | null;
  /** bildirim şeridi (en yenisi önde, en çok 3) */
  notices: CommNotice[];
  /** oda → beni bahseden ve henüz görmediğim mesajlar */
  mentions: Record<string, string[]>;
  dq: DqState | null;
  duo: DuoState | null;
  mentor: MentorState | null;
  /** bölüm → bu oturumda art arda başarısız deneme (Yardım İste) */
  fails: Record<number, number>;
  /** bu oturumda yardım istenen bölümler */
  asked: number[];
}
export const useComm = create<CommStore>()(() => ({ settings: null, notices: [], mentions: {}, dq: null, duo: null, mentor: null, fails: {}, asked: [] }));

let client: NetClient | null = null;
export const commNet = () => client;
const set = useComm.setState;

/** serbest yazı açık mı (ayar gelmediyse: 10. bölüm kuralı yerelde) */
export function useCanFreeText(): boolean {
  const s = useComm((x) => x.settings); const me = useNet((x) => x.me);
  if (s) return s.canFreeText;
  return Math.max(0, (me?.highest ?? 1) - 1) >= COMM_RULES.freeTextLevel;
}

/** mesajı listede yerinde değiştir (yoksa dokunma) — konu yanıtıysa üst mesajın önizlemesini de tazele */
export function patchMessage(msg: ChatMessage): void {
  useNet.setState((s) => {
    const list = s.messages[msg.room]; if (!list) return {};
    const i = list.findIndex((m) => m.id === msg.id);
    if (i < 0) return {};
    const next = list.slice(); next[i] = msg;
    return { messages: { ...s.messages, [msg.room]: next } };
  });
}

export function dismissNotice(id: string): void { set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })); }
export function clearMentions(room: string): void { set((s) => (s.mentions[room]?.length ? { mentions: { ...s.mentions, [room]: [] } } : {})); }
export const mentionCount = (s: CommStore, room: string | null | undefined) => (room ? s.mentions[room]?.length ?? 0 : 0);

export async function refreshDq(): Promise<void> {
  const c = client; if (!c || c.status !== 'bağlı' || !useNet.getState().team) return;
  try { set({ dq: await c.call('dq.state', {}) }); } catch { /* sonra */ }
}
export async function refreshDuo(): Promise<void> { const c = client; if (!c || c.status !== 'bağlı') return; try { set({ duo: (await c.call('duo.state', {})).duo }); } catch { /* sonra */ } }
export async function refreshMentor(): Promise<void> { const c = client; if (!c || c.status !== 'bağlı') return; try { set({ mentor: (await c.call('mentor.state', {})).mentor }); } catch { /* sonra */ } }

/** bölüm sonucu: art arda başarısızlığı say (Yardım İste kartı için) */
export function noteRun(level: number, completed: boolean): void {
  set((s) => ({ fails: { ...s.fails, [level]: completed ? 0 : (s.fails[level] ?? 0) + 1 } }));
}

export function bindComm(c: NetClient): () => void {
  client = c;
  const offs = [
    c.onStatus((st) => {
      if (st !== 'bağlı') return;
      void (async () => {
        try {
          const { settings } = await c.call('comm.state', {});
          set({ settings });
        } catch { /* sonra */ }
        void refreshDq(); void refreshDuo(); void refreshMentor();
      })();
    }),
    c.onMe(() => { void c.call('comm.state', {}).then((r) => set({ settings: r.settings })).catch(() => undefined); }),
    c.on('chat.updated', ({ msg }) => {
      patchMessage(msg);
      if (msg.kind === 'soru') void refreshDq();
    }),
    c.on('chat', ({ msg }) => {
      const me = c.me?.id; if (!me) return;
      const at = typeof msg.meta?.at === 'string' ? msg.meta.at.split(',') : [];
      if (at.includes(me) && useNet.getState().activeRoom !== msg.room) set((s) => ({ mentions: { ...s.mentions, [msg.room]: [...(s.mentions[msg.room] ?? []), msg.id] } }));
      if (msg.kind === 'soru') void refreshDq();
    }),
    c.on('comm.notice', ({ notice }) => {
      // açık sohbetteki bahsetme için şerit çıkmaz
      if (notice.kind === 'mention' && notice.room && useNet.getState().activeRoom === notice.room) return;
      set((s) => ({ notices: [notice, ...s.notices.filter((n) => n.id !== notice.id)].slice(0, 3) }));
      if (notice.kind === 'mentor') void refreshMentor();
    }),
    // güvenli sohbet: 8. bölüm geçilince serbest yazı kendiliğinden açılır — kapalıyken her bölüm sonucunda (cüzdan değişir) yeniden sor
    c.on('wallet.updated', () => { if (useComm.getState().settings?.canFreeText === false) void c.call('comm.state', {}).then((r) => set({ settings: r.settings })).catch(() => undefined); }),
    c.on('duo.updated', ({ duo }) => set({ duo })),
    c.on('mentor.updated', ({ mentor }) => set({ mentor })),
    c.on('team.updated', ({ team }) => { if (!team) set({ dq: null }); else if (!useComm.getState().dq) void refreshDq(); }),
  ];
  return () => { for (const o of offs) o(); };
}
