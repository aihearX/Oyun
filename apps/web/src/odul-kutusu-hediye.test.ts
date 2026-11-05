// @vitest-environment jsdom
// Ödül kutusu (YN-246, OT-ogrenci-birinci-51): Takım'da alınmayıp kutuya geçen hediye (60 jeton + 5 kristal) tek satır, tek "Al"
// ikisini alır (her kayıt sunucuda bir kez, inbox.claim); "Hepsini al" sayısı ve üst sayaç satır sayısıdır.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNet } from '@odi/net/store';
import { INBOX_TEXT, type InboxItem, type MyProfile } from '@odi/shared';

const hed = INBOX_TEXT.giftMoved('Takım hedefi: Yıldız Avı 4. kademe');
const items: InboxItem[] = [
  { id: 'i1', kind: 'jeton', amount: 60, ref: '', reason: hed, at: 5000 },
  { id: 'i2', kind: 'kristal', amount: 5, ref: '', reason: hed, at: 5000 },
  { id: 'i3', kind: 'jeton', amount: 20, ref: '', reason: 'Arkadaş hediyesi', at: 4000 },
];
const claimed: string[] = [];
vi.mock('./net', async (orig) => ({
  ...(await orig<typeof import('./net')>()),
  getNet: () => ({ call: async () => ({ items }), on: () => () => undefined }),
  claimInboxItem: async (id: string) => { claimed.push(id); return items.find((x) => x.id === id) ?? null; },
  toast: () => undefined,
}));
vi.mock('./celebrate', () => ({ celebrate: { coins: async () => undefined } }));

const { InboxScreen } = await import('./screens/InboxScreen');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let el: HTMLDivElement | null = null; let root: ReturnType<typeof createRoot> | null = null;
afterEach(() => { if (root) act(() => root!.unmount()); el?.remove(); root = null; el = null; claimed.length = 0; });

describe('Ödül kutusu: Takım\'dan geçen hediye tek satır', () => {
  it('iki kayıt bir satır, tek Al ikisini alır', async () => {
    useNet.setState({ status: 'bağlı', me: { id: 'p1' } as MyProfile });
    el = document.createElement('div'); document.body.appendChild(el); root = createRoot(el);
    await act(async () => { root!.render(createElement(InboxScreen, { onBack: () => undefined })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    const rows = () => [...el!.querySelectorAll('[data-testid="kutu-satiri"]')];
    expect(rows()).toHaveLength(2);
    expect(rows()[0]!.getAttribute('data-parca')).toBe('2');
    // Takım › Hediyeler'deki gibi: tek satırda iki ödül çipi (jeton ve kristal simgeli)
    expect([...rows()[0]!.querySelectorAll('.chip')].map((c) => c.textContent!.trim())).toEqual(['60', '5']);
    expect(el.textContent).toContain('Hepsini al (2)');
    expect(useNet.getState().inboxCount).toBe(2);
    await act(async () => { rows()[0]!.querySelector('button')!.click(); });
    expect(claimed).toEqual(['i1', 'i2']);
    expect(rows()).toHaveLength(1);
    expect(useNet.getState().inboxCount).toBe(1);
  });
});
