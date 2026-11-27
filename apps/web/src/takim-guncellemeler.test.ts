// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ChatMessage } from '@odi/shared';

vi.mock('./ftue/voice', () => ({ speakLine: () => 1, stopVoice: () => undefined, stopVoiceIf: () => undefined, prefetchLines: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined, duck: () => undefined } }));
vi.mock('./ftue/useFeatures', () => ({ featureOpen: () => true, useFeatures: () => ({ open: () => true }) }));
const net = vi.hoisted(() => ({ history: [] as ChatMessage[], calls: [] as { op: string; data: unknown }[] }));
vi.mock('./net', () => ({
  act: async () => null, toast: () => undefined, errText: () => '',
  callSafe: async (op: string, data: unknown) => { net.calls.push({ op, data }); return { msg: { id: `gonderildi${net.calls.length}`, room: 'takim:t1', from: 'me', name: 'Ayşe', color: 1, text: String((data as { text: string }).text), kind: 'emoji', at: Date.now() } }; },
  getNet: () => ({ serverNow: () => Date.now(), call: async (op: string, data: unknown) => { net.calls.push({ op, data }); return op === 'chat.join' ? { history: net.history } : {}; } }),
}));

/**
 * Takım › Sohbet: Mesajlar | Güncellemeler (1.3.0, sahibin isteği). Takım arkadaşlarının gelişmeleri (sistemin yazdığı kartlar ve
 * duyurular) Mesajlar'a gelmez; Güncellemeler'de akar, kartlar orada da çalışır. Mesajlar rozeti yalnız mesajları sayar.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => undefined;
let root: Root | null = null;
beforeEach(() => { try { localStorage.clear(); } catch { /* yok */ } });
afterEach(async () => { await act(async () => { root?.unmount(); }); root = null; document.body.innerHTML = ''; net.calls.length = 0; net.history = []; });

const ROOM = 'takim:t1';
let seq = 0;
const msg = (o: Partial<ChatMessage>): ChatMessage => ({ id: `m${++seq}`, room: ROOM, from: 'p2', name: 'Bora', color: 0x55aaff, text: 'selam', kind: 'text', at: 1000 + seq, ...o });
const sys = (text: string, o: Partial<ChatMessage> = {}) => msg({ from: 'sistem', name: 'Sistem', text, kind: 'system', ...o });

describe('isTeamUpdate: hangi ileti güncelleme', () => {
  it('sistemin yazdığı her şey güncelleme, Günün Sorusu ve oyuncu iletileri mesaj', async () => {
    const { isTeamUpdate } = await import('@odi/shared');
    for (const kind of ['system', 'feed', 'help', 'war', 'race'] as const) expect(isTeamUpdate({ from: 'sistem', kind })).toBe(true);
    expect(isTeamUpdate({ from: 'sistem', kind: 'soru' })).toBe(false);
    for (const kind of ['text', 'emoji', 'hazir'] as const) expect(isTeamUpdate({ from: 'p1', kind })).toBe(false);
  });
});

describe('splitTeamChat', () => {
  it('oyuncu iletileri ve Günün Sorusu Mesajlar\'da; akış, yardım, savaş ve duyurular Güncellemeler\'de', async () => {
    const { splitTeamChat } = await import('./comm/teamFeed');
    const a = msg({ text: 'Merhaba takım' }); const feed = sys('Bora 3. bölümü geçti.', { kind: 'feed', meta: { type: 'bolum', pid: 'p2' } });
    const help = sys('Bora 4. bölüm için yardım istiyor.', { kind: 'help', meta: { requestId: 'h1', level: 4, pid: 'p2' } });
    const soru = msg({ from: 'sistem', name: 'Tüy Dede', kind: 'soru', text: 'Koklea nerede?' });
    const war = sys('Bölge Savaşı bitti.', { kind: 'war' }); const left = sys('Cem takımdan ayrıldı.');
    const emoji = msg({ from: 'p3', name: 'Cem', kind: 'emoji', text: '👏' }); const hazir = msg({ kind: 'hazir', text: 'Selam!', meta: { p: 'selam' } });
    const s = splitTeamChat([a, feed, help, soru, war, left, emoji, hazir]);
    expect(s.messages.map((m) => m.id)).toEqual([a.id, soru.id, emoji.id, hazir.id]);
    expect(s.updates.map((m) => m.id)).toEqual([feed.id, help.id, war.id, left.id]);
  });

  it('güncelleme kartına oyuncu yanıtı kartın altında kalır ve Mesajlar\'da bağlamıyla görünür; sistem yanıtı yalnız kartın altında', async () => {
    const { splitTeamChat } = await import('./comm/teamFeed');
    const feed = sys('Bora 3. bölümü geçti.', { kind: 'feed', meta: { type: 'bolum', pid: 'p2' } });
    const a = msg({ from: 'p3', name: 'Cem', text: 'İlk mesaj' });
    const tebrik = msg({ from: 'p3', name: 'Cem', kind: 'hazir', text: 'Tebrikler!', replyTo: feed.id });
    const beaten = sys('Cem 2.910 puanla geçti!', { replyTo: feed.id, meta: { event: 'meydan', pid: 'p3' } });
    const b = msg({ text: 'Sağ ol' });
    const re = msg({ from: 'p3', name: 'Cem', text: 'Rica ederim', replyTo: b.id }); // oyuncu mesajına yanıt: yalnız konu
    const s = splitTeamChat([feed, a, tebrik, beaten, b, re]);
    expect(s.messages.map((m) => m.id)).toEqual([a.id, tebrik.id, b.id]);
    expect(s.parentOf.get(tebrik.id)?.id).toBe(feed.id);
    expect(s.updates.map((m) => m.id)).toEqual([feed.id]);
    expect(s.repliesOf.get(feed.id)?.map((m) => m.id)).toEqual([tebrik.id, beaten.id]);
    expect(s.repliesOf.get(b.id)?.map((m) => m.id)).toEqual([re.id]);
  });

  it('geçmişte kartın konu önizlemesiyle gelen oyuncu yanıtları da Mesajlar\'a alınır (bir kez, zamana göre)', async () => {
    const { splitTeamChat } = await import('./comm/teamFeed');
    const r1 = msg({ from: 'p3', name: 'Cem', kind: 'hazir', text: 'Tebrikler!', at: 5000 });
    const r2 = sys('Sistem yanıtı', { at: 5001 });
    const feed = sys('Bora 3. bölümü geçti.', { kind: 'feed', at: 4000, replies: 2, thread: [r1, { ...r2, replyTo: 'x' }] });
    const late = msg({ text: 'sonra', at: 6000 }); const early = msg({ text: 'önce', at: 3000 });
    const s = splitTeamChat([early, feed, late, { ...r1, replyTo: feed.id }]); // canlı da geldi: tekrar etmez
    expect(s.messages.map((m) => m.id)).toEqual([early.id, r1.id, late.id]);
    const s2 = splitTeamChat([early, feed, late]);
    expect(s2.messages.map((m) => m.text)).toEqual(['önce', 'Tebrikler!', 'sonra']);
    expect(s2.parentOf.get(r1.id)?.id).toBe(feed.id);
  });

  it('gizlenen (sessize alınan) oyuncunun iletisi ve yanıtı hiçbir bölmede yok; üst iletisi olmayan yanıt kendi türüne göre', async () => {
    const { splitTeamChat } = await import('./comm/teamFeed');
    const feed = sys('Kart', { kind: 'feed', thread: [msg({ from: 'kotu', text: 'x' })] });
    const bad = msg({ from: 'kotu', text: 'y' }); const orphan = msg({ text: 'yanıt', replyTo: 'eski' }); const sysOrphan = sys('Cem geçti!', { replyTo: 'eski' });
    const s = splitTeamChat([feed, bad, orphan, sysOrphan], (m) => m.from === 'kotu');
    expect(s.messages.map((m) => m.id)).toEqual([orphan.id]);
    expect(s.updates.map((m) => m.id)).toEqual([feed.id, sysOrphan.id]);
  });

  it('newCount: belli andan sonra, benim yazmadığım ve benimle ilgili olmayan', async () => {
    const { newCount } = await import('./comm/teamFeed');
    const list = [msg({ at: 10 }), msg({ at: 20, from: 'me' }), sys('kart', { at: 30, meta: { pid: 'me' } }), sys('kart', { at: 40, meta: { pid: 'p2' } })];
    expect(newCount(list, 0, 'me')).toBe(2);
    expect(newCount(list, 10, 'me')).toBe(1);
  });

  it('markUpdatesSeen geri gitmez ve cihazda kalır', async () => {
    const { markUpdatesSeen, useChatPane } = await import('./comm/teamFeed');
    markUpdatesSeen(ROOM, 500); markUpdatesSeen(ROOM, 300);
    expect(useChatPane.getState().seen[ROOM]).toBe(500);
    expect(JSON.parse(localStorage.getItem('odi.takim.guncelleme')!)[ROOM]).toBe(500);
  });
});

describe('istemci deposu (@odi/net/store)', () => {
  it('trimChat: akış kartları yoğunken oyuncu iletileri listeden düşmez; başka odada son N', async () => {
    const { trimChat } = await import('@odi/net/store');
    const list = [msg({ text: 'eski mesaj' }), ...Array.from({ length: 60 }, (_, i) => sys(`kart ${i}`, { kind: 'feed' })), msg({ text: 'yeni mesaj' })];
    const t = trimChat(list, 50);
    expect(t.filter((m) => m.from !== 'sistem').map((m) => m.text)).toEqual(['eski mesaj', 'yeni mesaj']);
    expect(t.filter((m) => m.from === 'sistem')).toHaveLength(50);
    expect(t.at(-2)!.text).toBe('kart 59');
    const dm = Array.from({ length: 60 }, (_, i) => msg({ room: 'dm:a:b', text: String(i) }));
    expect(trimChat(dm, 50).map((m) => m.text)[0]).toBe('10');
  });

  it('canlı ileti: takım odasında yalnız mesajlar okunmamış sayısını artırır; sunucunun msgs sayısı esas', async () => {
    const { bindNet, useNet } = await import('@odi/net/store');
    const handlers = new Map<string, (d: unknown) => void>();
    const client = {
      status: 'bağlı', me: { id: 'me' },
      onStatus: () => () => undefined, onMe: () => () => undefined,
      on: (e: string, cb: (d: unknown) => void) => { handlers.set(e, cb); return () => undefined; },
      call: async (op: string) => {
        if (op === 'team.detail') return { team: { id: 't1' } };
        if (op === 'team.extra') return { extra: { gifts: [] } };
        if (op === 'chat.unread') return { unread: 7, msgs: 2 };
        if (op === 'inbox.list') return { items: [] };
        return { wallet: null };
      },
    };
    useNet.setState({ me: { id: 'me' } as never, unread: {}, activeRoom: null, messages: {} });
    const off = bindNet(client as never);
    await vi.waitFor(() => expect(useNet.getState().unread[ROOM]).toBe(2));
    const emit = (m: ChatMessage) => handlers.get('chat')!({ msg: m });
    emit(sys('Bora 3. bölümü geçti.', { kind: 'feed' }));
    emit(sys('Bora yardım istiyor.', { kind: 'help' }));
    expect(useNet.getState().unread[ROOM]).toBe(2);
    emit(msg({ text: 'selam' }));
    emit(msg({ from: 'sistem', kind: 'soru', text: 'Soru' }));
    expect(useNet.getState().unread[ROOM]).toBe(4);
    expect(useNet.getState().messages[ROOM]).toHaveLength(4);
    off();
  });
});

describe('ChatRoom (takım): iki bölme', () => {
  async function show(history: ChatMessage[]) {
    net.history = history;
    const { useNet } = await import('@odi/net/store');
    const { useChatPane } = await import('./comm/teamFeed');
    useChatPane.setState({ pane: 'mesaj', seen: {} });
    useNet.setState({ me: { id: 'me', name: 'Ayşe', highest: 20 } as never, team: null, status: 'bağlı', messages: {}, unread: {}, activeRoom: null, presence: {} });
    const { useComm } = await import('./comm/state');
    useComm.setState({ settings: { canFreeText: true, feedShare: true, freeTextLevel: 8 } as never });
    const { ChatRoom } = await import('./ui/Chat');
    const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h);
    await act(async () => { root!.render(createElement(ChatRoom, { room: ROOM, members: [], since: 0, expandable: true })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
  const box = () => document.querySelector('.chat-box')!;

  it('Mesajlar\'da kart yok; Güncellemeler\'de kartlar ve yardım kartı, yazı kutusu gizli; rozetler', async () => {
    const feed = sys('Bora 3. bölümü geçti.', { kind: 'feed', meta: { type: 'bolum', pid: 'p2', pname: 'Bora', pc: 1, ph: '' } });
    const help = sys('Bora 4. bölüm için yardım istiyor.', { kind: 'help', meta: { requestId: 'h1', level: 4, pid: 'p2', pname: 'Bora', pc: 1, ph: '' } });
    const tebrik = msg({ from: 'p3', name: 'Cem', kind: 'hazir', text: 'Tebrikler!', replyTo: feed.id, at: help.at + 1 });
    await show([msg({ text: 'Merhaba takım', at: feed.at - 1 }), feed, sys('Takım teknolojisi yükseldi: Kepçe 2. seviye!', { at: feed.at + 1 }), help, tebrik, msg({ from: 'p3', name: 'Cem', text: 'Akşam oynarım', at: help.at + 2 })]);
    expect([...box().querySelectorAll('[data-testid="mesaj"]')].map((e) => e.querySelector('.bubble')!.textContent)).toEqual([
      expect.stringContaining('Merhaba takım'), expect.stringContaining('Tebrikler!'), expect.stringContaining('Akşam oynarım')]);
    expect(box().querySelector('[data-testid="akis-karti"], [data-testid="yardim-karti"], .msg-sys')).toBeNull();
    // karta yanıt: hangi karta yazıldığı görünür
    expect(box().querySelector('[data-testid="mesaj-karta-yanit"]')!.textContent).toContain('Bora 3. bölümü geçti.');
    // Güncellemeler rozeti: görülmemiş 3 güncelleme (ilk açılışta katılmadan sonrakiler)
    const upd = document.querySelector<HTMLButtonElement>('[data-testid="sohbet-guncellemeler"]')!;
    expect(upd.querySelector('.cp-new')!.textContent).toBe('3');
    expect(document.querySelector('.chat')!.classList.contains('on-updates')).toBe(false);

    await act(async () => { upd.click(); });
    expect(upd.getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('.chat')!.classList.contains('on-updates')).toBe(true);
    expect(box().querySelector('[data-testid="akis-karti"]')).not.toBeNull();
    expect(box().querySelector('[data-testid="yardim-karti"]')).not.toBeNull();
    expect(box().textContent).toContain('Takım teknolojisi yükseldi');
    expect(box().querySelectorAll('[data-testid="mesaj"]')).toHaveLength(0);
    expect(upd.querySelector('.cp-new')).toBeNull();
    const { useChatPane } = await import('./comm/teamFeed');
    expect(useChatPane.getState().seen[ROOM]).toBe(help.at);
    // Güncellemeler açıkken gelen mesaj Mesajlar düğmesinde sayılır; güncelleme sayılmaz
    const { useNet } = await import('@odi/net/store');
    await act(async () => { useNet.setState((s) => ({ messages: { ...s.messages, [ROOM]: [...s.messages[ROOM]!, msg({ text: 'Yeni', at: Date.now() + 10 }), sys('Kart', { kind: 'feed', at: Date.now() + 11 })] } })); });
    expect(document.querySelector('[data-testid="sohbet-mesajlar"] .sbadge')!.textContent).toBe('1');
    // okundu imleci yalnız Mesajlar açıkken
    const reads = net.calls.filter((c) => c.op === 'chat.read').length;
    await act(async () => { document.querySelector<HTMLButtonElement>('[data-testid="sohbet-mesajlar"]')!.click(); });
    expect(document.querySelector('[data-testid="sohbet-mesajlar"] .sbadge')).toBeNull();
    expect(box().textContent).toContain('Yeni');
    expect(net.calls.filter((c) => c.op === 'chat.read').length).toBeGreaterThanOrEqual(reads);
  });

  it('hızlı tepkiler yazı kutusunun solundaki düğmeyle açılan tepside; gönderince kapanır; serbest yazı kapalıyken satır hep açık', async () => {
    await show([msg({ text: 'Merhaba' })]);
    expect(document.querySelector('.quick-line')).toBeNull();
    const open = document.querySelector<HTMLButtonElement>('[data-testid="hizli-tepki-ac"]')!;
    expect(open.getAttribute('aria-expanded')).toBe('false');
    expect(open.closest('.chat-input')).not.toBeNull();
    await act(async () => { open.click(); });
    expect(open.getAttribute('aria-expanded')).toBe('true');
    const fire = document.querySelector<HTMLButtonElement>('[data-testid="hizli-tepsi"] [aria-label="Hızlı tepki: Ateş"]')!;
    expect(fire).not.toBeNull();
    await act(async () => { fire.click(); });
    expect(net.calls.find((c) => c.op === 'chat.send')?.data).toMatchObject({ room: ROOM, text: '🔥', kind: 'emoji' });
    expect(document.querySelector('[data-testid="hizli-tepsi"]')).toBeNull();
    // hazır sözler de tepside
    await act(async () => { open.click(); });
    await act(async () => { document.querySelector<HTMLButtonElement>('[data-testid="hizli-tepsi"] [aria-label="Hazır sözler"]')!.click(); });
    await act(async () => { document.querySelector<HTMLButtonElement>('[data-testid="hizli-tepsi"] .phrase[data-phrase="selam"]')!.click(); });
    expect(net.calls.filter((c) => c.op === 'chat.send').at(-1)?.data).toMatchObject({ text: 'selam', kind: 'hazir' });
    await act(async () => { root?.unmount(); }); root = null; document.body.innerHTML = '';
    // yeni oyuncu (serbest yazı kapalı): hazır söz satırı hep açık, tepsi düğmesi yok
    const { useComm } = await import('./comm/state');
    net.history = [];
    const { ChatRoom } = await import('./ui/Chat');
    useComm.setState({ settings: { canFreeText: false, feedShare: true, freeTextLevel: 8 } as never });
    const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h);
    await act(async () => { root!.render(createElement(ChatRoom, { room: ROOM, members: [], since: 0 })); });
    expect(document.querySelector('.quick-line .phrase-row')).not.toBeNull();
    expect(document.querySelector('[data-testid="hizli-tepki-ac"]')).toBeNull();
  });

  it('boş Güncellemeler dürüst bir boş durum gösterir', async () => {
    await show([msg({ text: 'Merhaba' })]);
    await act(async () => { document.querySelector<HTMLButtonElement>('[data-testid="sohbet-guncellemeler"]')!.click(); });
    expect(box().textContent).toContain('Henüz güncelleme yok');
  });
});
