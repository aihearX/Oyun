// @vitest-environment jsdom
// Takım akışında "Tebrik et" çevrimdışı (YN-243, OT-eski-telefon-41): basınca kart "Bağlanınca gönderilecek" der, düğme kilitlenir;
// ikinci basış ikinci istek açmaz; bağlanınca tebrik bir kez gider ve satır kalkar.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNet } from '@odi/net/store';
import type { ChatMessage, MyProfile } from '@odi/shared';

const calls: { op: string; data: unknown }[] = [];
let finish: () => void = () => undefined;
vi.mock('./net', () => ({
  act: async () => null, toast: () => undefined, errText: () => '', getNet: () => ({}),
  callSafe: (op: string, data: unknown) => { calls.push({ op, data }); return new Promise<void>((r) => { finish = r; }); },
}));

const { FeedCard } = await import('./comm/Cards');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const msg: ChatMessage = { id: 'f1', room: 'team:t1', from: 'sys', name: '', kind: 'feed', text: 'Ece 12. bölümü geçti', at: Date.now(), meta: { type: 'bolum', pid: 'p2', pname: 'Ece', levels: '12', stars: 3 } } as unknown as ChatMessage;
let el: HTMLDivElement | null = null; let root: ReturnType<typeof createRoot> | null = null;
afterEach(() => { if (root) act(() => root!.unmount()); el?.remove(); root = null; el = null; calls.length = 0; });
beforeEach(() => { useNet.setState({ status: 'çevrimdışı', me: { id: 'p1' } as MyProfile }); });

describe('Takım akışı › Tebrik et çevrimdışı', () => {
  it('bekliyor durumu, tek istek, bağlanınca bir kez gider', async () => {
    el = document.createElement('div'); document.body.appendChild(el); root = createRoot(el);
    await act(async () => { root!.render(createElement(FeedCard, { m: msg, live: [] })); });
    const btn = () => el!.querySelector<HTMLButtonElement>('[data-testid="tebrik-et"]')!;
    expect(el.querySelector('[data-testid="bekleyen-istek"]')).toBeNull();
    await act(async () => { btn().click(); });
    expect(calls).toHaveLength(1);
    expect(btn().disabled).toBe(true);
    expect(el.querySelector('[data-testid="bekleyen-istek"]')!.textContent).toContain('Bağlanınca gönderilecek');
    await act(async () => { btn().click(); });
    expect(calls).toHaveLength(1);
    // bağlandı, istek yanıtlandı
    await act(async () => { useNet.setState({ status: 'bağlı' }); finish(); });
    expect(calls).toHaveLength(1);
    expect(el.querySelector('[data-testid="bekleyen-istek"]')).toBeNull();
    expect(btn().disabled).toBe(false);
  });
});
