// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { NetClient } from '@odi/net';
import type { KgState } from '@odi/shared';

vi.mock('./ftue/voice', () => ({ speakLine: () => 1, stopVoice: () => undefined, stopVoiceIf: () => undefined, prefetchLines: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined, duck: () => undefined } }));
const calls: { op: string; data: unknown }[] = [];
vi.mock('./net', () => ({ act: async (op: string, data: unknown) => { calls.push({ op, data }); return null; }, toast: () => undefined }));

/**
 * Oyuncu testi tur 13 (YN-227): Kamp üç küçük.
 *  - Sesler kapalıyken sesle oynanan günlük görev (Ton Avı) kalmaz: istemci kendiliğinden değiştirir; "Değiştir" hak harcamaz (OT-sessiz-oyuncu-30).
 *  - Kurulmamış binanın onay penceresi "… kur" ve "Kur" der; Sv 2+ "Yükselt" (OT-takim-kaptani-37).
 *  - Büyük yazı: süre ve basamak tek parça (bölünmez boşluk; OT-buyuk-yazi-65).
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
afterEach(async () => { await act(async () => { root?.unmount(); }); root = null; document.body.innerHTML = ''; calls.length = 0; });
async function render(node: ReturnType<typeof createElement>) {
  const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h);
  await act(async () => { root!.render(node); });
}
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const gorev = (id: string, o: Partial<{ done: boolean; claimed: boolean }> = {}) => ({ ref: `gunluk:d:${id}`, id, text: id, art: 'ton', need: 1, progress: 0, done: false, claimed: false, reward: null, locked: null, ...o });
function kgState(tasks: ReturnType<typeof gorev>[], rerollLeft = 1, day = 'd'): KgState {
  return {
    day, dayEndsAt: Date.now() + 19 * 3_600_000 + 9 * 60_000, week: 'w', weekEndsAt: Date.now() + 3 * 86_400_000, open: { gorev: true, oyun: true, vaka: false },
    story: { chapter: null, next: null, claimed: 10, total: 10 }, daily: { tasks, rerollLeft },
    weekly: { id: 'h-gunluk', text: 'Bu hafta günlük kamp görevlerini tamamla', art: 'gorev', progress: 0, tiers: [4, 8, 12].map((need, i) => ({ ref: `hafta:w:${i}`, need, reached: false, claimed: false, reward: { kristal: 5, kampXp: 120, m60: 1 } })) },
    achievements: [], oyun: [], takim: null, vaka: { open: false, waiting: 0, locked: null }, claimable: 0, growth: true, pending: { kampXp: 0, dekor: [] },
  } as unknown as KgState;
}
/** bindKg'ye verilen sahte istemci: kg.reroll yerine sesle oynanmayan görev koyar (sunucu kuralı: hak harcamaz) */
function fakeClient() {
  const c = { status: 'bağlı', rerolls: [] as string[], on: () => () => undefined, onStatus: () => () => undefined,
    call: async (op: string, data: { id: string }) => {
      if (op !== 'kg.reroll') throw new Error(op);
      c.rerolls.push(data.id);
      const { useKg } = await import('./camp/gorev/state'); const s = useKg.getState().kg!;
      return { state: { ...s, daily: { ...s.daily, tasks: s.daily.tasks.map((t) => (t.id === data.id ? gorev('g-timpano') : t)) } } };
    } };
  return c;
}

describe('sesler kapalıyken Ton Avı günlük görevi (OT-sessiz-oyuncu-30)', () => {
  it('ses kapalı: g-ton kendiliğinden değişir (hak harcamadan); ses açıkken, bitmiş görevde ve bir kez denenmişse dokunulmaz', async () => {
    const { useStore } = await import('./store'); const { bindKg, useKg } = await import('./camp/gorev/state');
    const c = fakeClient(); bindKg(c as unknown as NetClient);
    useStore.getState().setSounds(true);
    await act(async () => { useKg.setState({ kg: kgState([gorev('g-depo'), gorev('g-ton'), gorev('g-vaka')]) }); }); await flush();
    expect(c.rerolls).toEqual([]); // ses açık: görev yerinde
    await act(async () => { useStore.getState().setSounds(false); }); await flush();
    expect(c.rerolls).toEqual(['g-ton']);
    expect(useKg.getState().kg!.daily.tasks.map((t) => t.id)).toEqual(['g-depo', 'g-timpano', 'g-vaka']);
    expect(useKg.getState().kg!.daily.rerollLeft).toBe(1);
    // bitmiş (ya da ödülü alınmış) sesli görev değişmez
    await act(async () => { useKg.setState({ kg: kgState([gorev('g-ton-iyi', { done: true }), gorev('g-depo')], 1, 'd2') }); }); await flush();
    expect(c.rerolls).toEqual(['g-ton']);
    // efekt düzeyi duyulmazsa da ses kapalı sayılır (Ton Avı'nın kuralı)
    useStore.getState().setSounds(true); useStore.getState().setVolumes({ sfxVol: 0 });
    await act(async () => { useKg.setState({ kg: kgState([gorev('g-ton'), gorev('g-depo')], 0, 'd3') }); }); await flush();
    expect(c.rerolls).toEqual(['g-ton', 'g-ton']);
    useStore.getState().setVolumes({ sfxVol: 0.9 });
  });

  it('elle "Değiştir": sesle oynanan görevde hak bitmişken de var ve hak harcamadığını söyler; diğer görevde yok', async () => {
    const { useStore } = await import('./store'); useStore.getState().setSounds(true);
    const { GorevPanel } = await import('./camp/gorev/GorevPanel'); const { useKg } = await import('./camp/gorev/state');
    useKg.setState({ kg: kgState([gorev('g-ton'), gorev('g-depo')], 0, 'd4'), panel: { kind: 'gorev', tab: 'gunluk' } });
    await render(createElement(GorevPanel, { tab: 'gunluk' }));
    expect(document.querySelector('[data-gorev="g-depo"] [data-testid="kg-degistir"]')).toBeNull();
    const ton = () => document.querySelector('[data-gorev="g-ton"]')!;
    await act(async () => { (ton().querySelector('[data-testid="kg-degistir"]') as HTMLElement).click(); });
    expect(ton().querySelector('[data-testid="kg-degistir-soru"]')?.textContent).toContain('Ton Avı sesle oynanır: bu görevi değiştirmek hakkından düşmez.');
    await act(async () => { (ton().querySelector('[data-testid="kg-degistir-onay"]') as HTMLElement).click(); });
    expect(calls).toEqual([{ op: 'kg.reroll', data: { id: 'g-ton' } }]);
    expect(document.querySelector('.kg-gunluk > .kg-note')?.textContent).not.toContain('Sesin kapalı');
    await act(async () => { useStore.getState().setSounds(false); });
    expect(document.querySelector('.kg-gunluk > .kg-note')?.textContent).toContain('Sesin kapalı: sesle oynanan Ton Avı görevi verilmez.');
    useStore.getState().setSounds(true);
  });
});

describe('Büyük yazı: süre ve basamak tek parça (OT-buyuk-yazi-65)', () => {
  it('"19 sa 09 dk" ve "· 12" bölünmez boşlukla (dar kutuda "basamak"tan sonra bölünebilir)', async () => {
    const { GorevPanel } = await import('./camp/gorev/GorevPanel'); const { useKg } = await import('./camp/gorev/state');
    useKg.setState({ kg: kgState([gorev('g-depo')], 1, 'd5'), panel: { kind: 'gorev', tab: 'gunluk' } });
    await render(createElement(GorevPanel, { tab: 'gunluk' }));
    const heads = [...document.querySelectorAll('.kg-sec-head small')].map((x) => x.textContent ?? '');
    expect(heads.some((t) => /^Yenilenme: \d+\u00a0sa\u00a0\d+\u00a0dk$/.test(t))).toBe(true);
    expect(heads.some((t) => /^\d+\u00a0gün\u00a0\d+\u00a0sa$/.test(t))).toBe(true);
    expect([...document.querySelectorAll('.kg-tier-ad')].map((x) => x.textContent)).toEqual(['1.\u00a0basamak ·\u00a04', '2.\u00a0basamak ·\u00a08', '3.\u00a0basamak ·\u00a012']);
  });
});

describe('kurulmamış binanın onay penceresi (OT-takim-kaptani-37)', () => {
  it('Sv 0: başlık "… kur", düğme "Kur"; Sv 1+: "→ Sv n" ve "Yükselt"', async () => {
    const { useNet } = await import('@odi/net/store'); useNet.setState({ status: 'bağlı' });
    const { demoCamp } = await import('./camp/demo'); const { CampList } = await import('./camp/CampList');
    const { camp, wallet } = demoCamp({ level: 2, build: null, campLevel: 1 }); // Klinik Sv 0, Kule Sv 1, Merkez Sv 2
    const actions = { upgrade: vi.fn(async () => true), queue: vi.fn(async () => true) } as unknown as import('./camp/model').CampActions;
    await render(createElement(CampList, { camp, wallet, team: false, fast: 0, sNow: Date.now(), actions, bonuses: null }));
    const card = (name: string) => [...document.querySelectorAll('.card.building')].find((c) => c.querySelector('b')?.textContent === name)!;
    const sheet = () => document.querySelector('.sheet')!;
    expect(card('Odyoloji Kliniği').querySelector('.b-up .btn')?.textContent).toBe('Kur');
    await act(async () => { (card('Odyoloji Kliniği').querySelector('.b-up .btn') as HTMLElement).click(); });
    expect(sheet().textContent).toContain('Odyoloji Kliniği’ni kur');
    expect(sheet().textContent).not.toContain('→ Sv 1');
    expect(sheet().querySelector('[data-testid="insaat-onay"]')?.textContent).toBe('Kur');
    await act(async () => { ([...sheet().querySelectorAll('.btn')].find((b) => b.textContent === 'Vazgeç') as HTMLElement).click(); });
    await act(async () => { (card('Timpanometri Kulesi').querySelector('.b-up .btn') as HTMLElement).click(); });
    expect(sheet().textContent).toContain('Timpanometri Kulesi → Sv 2');
    expect(sheet().querySelector('[data-testid="insaat-onay"]')?.textContent).toBe('Yükselt');
    useNet.setState({ status: 'kapalı' });
  });
});
