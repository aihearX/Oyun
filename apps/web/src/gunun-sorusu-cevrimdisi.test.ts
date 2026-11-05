// @vitest-environment jsdom
// Günün Sorusu çevrimdışı (YN-228, OT-eski-telefon-38): internet yokken şıkka dokununca seçilen şık hemen işaretlenir ve
// "Bağlanınca gönderilecek" yazar (Klinik, Kamp Görevleri, Ödül kutusu gibi); pencere kapanıp açılsa da seçim durur, ikinci istek gitmez.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUIZ_QUESTIONS } from '@odi/content';
import { useNet } from '@odi/net/store';
import type { DqState, TeamDetail } from '@odi/shared';

const calls: { op: string; data: unknown }[] = [];
let finish: (v: DqState | null) => void = () => undefined;
vi.mock('./net', () => ({ act: (op: string, data: unknown) => { calls.push({ op, data }); return new Promise((r) => { finish = r; }); }, toast: () => undefined }));

const { DqTodayCard } = await import('./comm/DqToday');
const { useComm } = await import('./comm/state');
const { useStore } = await import('./store');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const q0 = QUIZ_QUESTIONS.find((q) => q.level === 'merakli')!;
const state = (myChoice: number | null = null): DqState => ({
  question: { day: '2026-11-05', msgId: 'm1', text: q0.text, choices: [...q0.choices], level: 'merakli', revealAt: Date.now() + 3_600_000, revealed: false, answer: null, explain: null, answered: 6, myChoice, correct: null },
  week: [], study: false, reward: 10, solo: false, yesterday: null,
});
let el: HTMLDivElement | null = null; let root: ReturnType<typeof createRoot> | null = null;
async function mount() {
  el = document.createElement('div'); document.body.appendChild(el); root = createRoot(el);
  await act(async () => { root!.render(createElement(DqTodayCard)); });
  return el;
}
afterEach(() => { if (root) act(() => root!.unmount()); el?.remove(); root = null; el = null; calls.length = 0; });
beforeEach(() => {
  useStore.setState({ ftue: { ...useStore.getState().ftue, bypass: true } });
  useNet.setState({ status: 'çevrimdışı', team: { id: 't1' } as TeamDetail });
  useComm.setState({ dq: state() });
});

describe('Bugün › Günün Sorusu çevrimdışı', () => {
  it('seçilen şık işaretli + "Bağlanınca gönderilecek"; kapatıp açınca da; tek istek; bağlanınca "Cevabın kaydedildi"', async () => {
    const el = await mount();
    const ac = async () => { await act(async () => { el.querySelector<HTMLButtonElement>('[data-testid="bugun-soru-ac"]')!.click(); }); };
    const sayfa = () => el.querySelector('[data-testid="bugun-soru-sayfa"]');
    const opts = () => [...sayfa()!.querySelectorAll<HTMLButtonElement>('.dq-opt')];
    await ac();
    expect(sayfa()!.textContent).toContain('Bir şık seç.');
    await act(async () => { opts()[2]!.click(); });
    expect(calls).toEqual([{ op: 'dq.answer', data: { choice: 2 } }]);
    expect(opts()[2]!.className).toContain('picked');
    expect(opts().filter((b) => b.className.includes('picked'))).toHaveLength(1);
    expect(opts().every((b) => b.disabled)).toBe(true);
    expect(sayfa()!.textContent).toContain('Bağlanınca gönderilecek');
    expect(sayfa()!.textContent).not.toContain('Bir şık seç.');
    // pencereyi kapat: kartta da bekliyor yazar; yeniden açınca seçim durur, ikinci dokunuş istek göndermez
    await act(async () => { el.querySelector<HTMLButtonElement>('.sheet [aria-label="Kapat"]')!.click(); });
    expect(sayfa()).toBeNull();
    expect(el.querySelector('[data-testid="bugun-soru"]')!.textContent).toContain('Bağlanınca gönderilecek');
    await ac();
    expect(opts()[2]!.className).toContain('picked');
    await act(async () => { opts()[1]!.click(); });
    expect(calls).toHaveLength(1);
    // bağlandı, cevap gitti
    await act(async () => { useNet.setState({ status: 'bağlı' }); finish(state(2)); });
    expect(sayfa()!.textContent).toContain('Cevabın kaydedildi.');
    expect(sayfa()!.textContent).not.toContain('Bağlanınca gönderilecek');
    expect(opts()[2]!.className).toContain('picked');
  });

  it('istek düşerse (uzun kopukluk) seçim kalkar, yeniden seçilebilir', async () => {
    const el = await mount();
    await act(async () => { el.querySelector<HTMLButtonElement>('[data-testid="bugun-soru-ac"]')!.click(); });
    const opts = () => [...el.querySelectorAll<HTMLButtonElement>('[data-testid="bugun-soru-sayfa"] .dq-opt')];
    await act(async () => { opts()[0]!.click(); });
    expect(opts()[0]!.className).toContain('picked');
    await act(async () => { finish(null); });
    expect(opts().some((b) => b.className.includes('picked'))).toBe(false);
    expect(opts().every((b) => !b.disabled)).toBe(true);
  });
});
