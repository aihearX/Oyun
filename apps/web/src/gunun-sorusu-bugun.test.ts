// @vitest-environment jsdom
// Günün Sorusu Bugün'de (YN-074, karar 35; OT-sinav-adayi-40): kalıcı kart durum, açıklama saati ve dünkü cevabı söyler; dokununca
// alt sayfada soru ve şıklar; takımsız oyuncuya aynı soru (ödülsüz); çevrimdışıyken "bağlanınca gelir".
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QUIZ_QUESTIONS, quizChoiceLabels } from '@odi/content';
import { useNet } from '@odi/net/store';
import type { DqState, TeamDetail } from '@odi/shared';
import { DqTodayCard, dqStatusLine } from './comm/DqToday';
import { useComm } from './comm/state';
import { useStore } from './store';

const src = (p: string) => readFileSync(resolve(__dirname, p), 'utf8');
const AT20 = new Date(2026, 10, 4, 20, 0).getTime();
const q0 = QUIZ_QUESTIONS.find((q) => q.level === 'merakli')!;
const tip = QUIZ_QUESTIONS.find((q) => q.text.startsWith('Negatif orta kulak basıncını'))!;
const dun = QUIZ_QUESTIONS.find((q) => q !== q0 && q !== tip)!;
const state = (o: Partial<DqState> = {}, q: Partial<NonNullable<DqState['question']>> = {}): DqState => ({
  question: { day: '2026-11-04', msgId: 'm1', text: q0.text, choices: [...q0.choices], level: 'merakli', revealAt: AT20, revealed: false, answer: null, explain: null, answered: 2, myChoice: null, correct: null, ...q },
  week: [], study: false, reward: 10, solo: false,
  yesterday: { day: '2026-11-03', text: dun.text, choices: [...dun.choices], answer: dun.answer, explain: dun.explain, myChoice: null },
  ...o,
});
// istemci çizimi: sunucu çiziminde zustand ilk durumu okur (bu testin durumunu değil)
let el: HTMLDivElement | null = null; let root: ReturnType<typeof createRoot> | null = null;
async function mount() {
  if (!root) { el = document.createElement('div'); document.body.appendChild(el); root = createRoot(el); }
  await act(async () => { root!.render(createElement(DqTodayCard)); });
  return el!;
}
const html = async () => (await mount()).innerHTML;
afterEach(() => { if (root) act(() => root!.unmount()); el?.remove(); root = null; el = null; });
const team = { id: 't1' } as TeamDetail;

beforeEach(() => {
  useStore.setState({ ftue: { ...useStore.getState().ftue, bypass: true } });
  useNet.setState({ status: 'bağlı', team });
  useComm.setState({ dq: state() });
});

describe('Bugün › Günün Sorusu kartı', () => {
  it('Bugün ekranında, takvimden önce', () => {
    const s = src('screens/TodayScreen.tsx');
    expect(s.indexOf('<DqTodayCard />')).toBeGreaterThan(0);
    expect(s.indexOf('<DqTodayCard />')).toBeLessThan(s.indexOf('Giriş takvimi'));
  });

  it('takımlı, cevaplanmamış: durum + açıklama saati, soru, "Cevapla", sohbet kartıyla aynı kural; dünkü doğru cevap ve açıklama', async () => {
    const h = await html();
    expect(h).toContain('data-durum="bekliyor"');
    expect(h).toContain('Cevaplamadın · açıklama saati 20:00');
    expect(h).toContain(q0.text);
    expect(h).toMatch(/data-testid="bugun-soru-ac"[^>]*>Cevapla</);
    expect(h).toContain('Takım sohbetindeki soruyla aynı · doğru bilene 10 jeton');
    expect(h).toContain(`Doğru cevap: ${quizChoiceLabels(dun.choices)[dun.answer]}) ${dun.choices[dun.answer]}`);
    expect(h).toContain(dun.explain);
  });

  it('durum satırı: cevapladın / açıklandı (doğru, yanlış, cevapsız)', () => {
    const q = state().question!;
    expect(dqStatusLine({ ...q, myChoice: 1 })).toBe('Cevapladın · açıklama saati 20:00');
    expect(dqStatusLine({ ...q, revealed: true, answer: 1, myChoice: 1 })).toBe('Cevap açıklandı · doğru bildin');
    expect(dqStatusLine({ ...q, revealed: true, answer: 1, myChoice: 2 })).toBe('Cevap açıklandı · bu kez olmadı');
    expect(dqStatusLine({ ...q, revealed: true, answer: 1, myChoice: null })).toBe('Cevap açıklandı · bu soruyu cevaplamadın');
  });

  it('takımsız (karar 35): aynı kart, ödül/takım puanı/lig yok yazar; takımlıya ait eski durum gösterilmez', async () => {
    useNet.setState({ team: null });
    expect(await html()).toContain('data-durum="yukleniyor"'); // depoda hâlâ takım sorusu var: gösterilmez
    useComm.setState({ dq: state({ solo: true, reward: 0 }, { msgId: '', myChoice: 2 }) });
    const h = await html();
    expect(h).toContain('data-durum="cevapladin"');
    expect(h).toContain('Ödül, takım puanı ve lig yalnız takım cevaplarından.');
    expect(h).not.toContain('jeton');
    expect(h).toMatch(/data-testid="bugun-soru-ac"[^>]*>Soruyu gör</);
  });

  it('çevrimdışı: "bağlanınca gelir"; kilitliyken açılış bölümü', async () => {
    useNet.setState({ status: 'çevrimdışı' });
    expect(await html()).toContain('Bağlanınca gelir');
    useStore.setState({ progress: {}, ftue: { ...useStore.getState().ftue, bypass: false } });
    expect(await html()).toContain('data-durum="kilitli"');
  });

  it('dokununca alt sayfa: soru, dört şık (tip sorusunda 1–4), takım sohbetine geçiş; açıklanınca doğru cevap ve açıklama', async () => {
    useComm.setState({ dq: state({}, { text: tip.text, choices: [...tip.choices] }) });
    const el = await mount();
    await act(async () => { el.querySelector<HTMLButtonElement>('[data-testid="bugun-soru-ac"]')!.click(); });
    const sheet = el.querySelector('[data-testid="bugun-soru-sayfa"]')!;
    expect(sheet.textContent).toContain(tip.text);
    const opts = [...sheet.querySelectorAll<HTMLButtonElement>('.dq-opt')];
    expect(opts.map((b) => b.querySelector('.dq-l')!.textContent)).toEqual(['1', '2', '3', '4']);
    expect(opts.every((b) => !b.disabled)).toBe(true);
    expect(sheet.querySelector('[data-testid="bugun-soru-sohbet"]')).not.toBeNull();
    await act(async () => { useComm.setState({ dq: state({}, { text: tip.text, choices: [...tip.choices], revealed: true, answer: tip.answer, explain: tip.explain, myChoice: tip.answer }) }); });
    const s2 = el.querySelector('[data-testid="bugun-soru-sayfa"]')!;
    expect(s2.querySelector('[data-testid="bugun-soru-aciklama"]')!.textContent).toContain(tip.explain);
    expect([...s2.querySelectorAll<HTMLButtonElement>('.dq-opt')].every((b) => b.disabled)).toBe(true);
  });
});
