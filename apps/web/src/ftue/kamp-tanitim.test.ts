// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { CommNotice } from '@odi/shared';

const spoken: (string | undefined)[] = [];
vi.mock('./voice', () => ({ speakLine: (_t: string, id?: string) => { spoken.push(id); return spoken.length; }, stopVoice: () => undefined, prefetchLines: () => undefined, stopVoiceIf: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined } }));
vi.mock('../net', () => ({ act: async () => null, toast: () => undefined }));

/**
 * Oyuncu testi tur 4 (YN-092): Kamp'ta Tüy Dede tanıtımları.
 *  - Aynı girişte birden çok yeni şey: art arda tur yerine tek kart ("Kamp'ta yeni 2 şey: …", her biri için Göster); kart engellemez,
 *    belirdiği ilk anda dokunuş almaz (yoldaki dokunuş alttaki hedefe gider).
 *  - Turun ilk adımı açılırken düşen dokunuş turu ilerletmez/atlatmaz.
 *  - Hasta Vakaları yalnız Odyoloji Kliniği kuruluyken tanıtılır, çerçeve Klinik girişinde (Görevler değil); klinik yoksa yerine
 *    seslendirilmeyen "önce kur" yazısı, çerçeve klinik kartında.
 *  - Rehber sürerken bildirim/teşekkür kartı sırada bekler; görülmeden süresi dolmaz.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
if (typeof globalThis.DOMRect === 'undefined') {
  (globalThis as { DOMRect?: unknown }).DOMRect = class {
    constructor(public x = 0, public y = 0, public width = 0, public height = 0) {}
    get left() { return this.x; } get top() { return this.y; } get right() { return this.x + this.width; } get bottom() { return this.y + this.height; }
  };
}
let root: Root | null = null;
afterEach(async () => {
  const { useCoach } = await import('./Coach'); const { useStore } = await import('../store'); const { hideKampYeni } = await import('./KampYeni');
  await act(async () => { useCoach.getState().end(false); hideKampYeni(); root?.unmount(); });
  useStore.setState({ ftue: { v: 1, story: true, tours: [] } });
  root = null; document.body.innerHTML = ''; spoken.length = 0;
});
const tick = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const el = (tag: string, attrs: Record<string, string>, r: [number, number, number, number]) => { const d = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) d.setAttribute(k, v); d.getBoundingClientRect = () => new DOMRect(...r); return d; };
function screen() {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
}
async function render(node: ReturnType<typeof createElement>) {
  const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h);
  await act(async () => { root!.render(node); });
}

describe('Hasta Vakaları yalnız klinik kuruluyken', () => {
  it('kuyruk: klinik yoksa tanıtım yerine "önce kur" (bir kez); kurulunca asıl tanıtım', async () => {
    const { campQueue } = await import('./Director');
    expect(campQueue(7, ['gorev', 'kampoyun'], 'kur')).toEqual(['vaka-kur']);
    expect(campQueue(7, ['gorev', 'kampoyun', 'vaka-kur'], 'kur')).toEqual([]);
    expect(campQueue(7, ['gorev', 'kampoyun', 'vaka-kur'], 'acik')).toEqual(['vaka']);
    expect(campQueue(7, ['gorev', 'kampoyun'], 'yapiliyor')).toEqual([]);
    expect(campQueue(7, [], null)).toEqual(['gorev', 'kampoyun']);
    expect(campQueue(6, [], 'acik')).toEqual(['gorev', 'kampoyun']);
  });
  it('vaka turunun çerçevesi Klinik düğmesinde; Klinik yoksa Görevler gösterilmez', async () => {
    screen();
    const { tourFor } = await import('./Director');
    const st = tourFor('vaka', 'camp')!.steps.find((s) => s.id === 'kg-vaka-02')!;
    const target = st.target as () => Element | null;
    document.body.appendChild(el('button', { 'data-testid': 'kg-btn' }, [10, 70, 120, 40]));
    expect(target()).toBeNull();
    const k = el('button', { 'data-testid': 'klinik-btn' }, [140, 70, 100, 40]); document.body.appendChild(k);
    expect(target()).toBe(k);
  });
  it('klinik kurulu değilse yazı (seslendirilmez), çerçeve klinik kartında', async () => {
    screen();
    const { tourFor, VAKA_KUR } = await import('./Director'); const { CoachHost, useCoach } = await import('./Coach');
    const card = el('div', { class: 'card building' }, [10, 300, 370, 160]); card.appendChild(el('div', { 'data-testid': 'klinik-vaka-not' }, [20, 420, 340, 30])); document.body.appendChild(card);
    await render(createElement(CoachHost));
    const t = tourFor('vaka-kur', 'camp')!;
    expect(t.steps).toHaveLength(1);
    await act(async () => { useCoach.getState().start(t); });
    await tick(50);
    expect(document.querySelector('[data-testid="anlatici"]')?.getAttribute('data-say')).toBe(VAKA_KUR);
    const ring = document.querySelector('.coach-ring') as HTMLElement | null;
    expect(ring?.style.top).toBe('292px'); // kartın üstü (300) − pay (8)
    expect(spoken).toEqual([]);
  });
});

describe('turun ilk anı: yoldaki dokunuş turu ilerletmez', () => {
  it('ilk 450 ms içindeki İleri/ekran dokunuşu yok sayılır, sonra ilerler', async () => {
    screen();
    const { CoachHost, useCoach } = await import('./Coach');
    await render(createElement(CoachHost));
    await act(async () => { useCoach.getState().start({ id: 'deneme', steps: [{ id: 'kg-tur-01', say: 'Bir' }, { id: 'kg-tur-02', say: 'İki' }] }); });
    await act(async () => { (document.querySelector('[data-testid="anlatici-ileri"]') as HTMLElement).click(); (document.querySelector('.coach-block') as HTMLElement).click(); (document.querySelector('.cp-skip') as HTMLElement).click(); });
    expect(useCoach.getState().tour?.id).toBe('deneme');
    expect(useCoach.getState().step).toBe(0);
    await tick(500);
    await act(async () => { (document.querySelector('[data-testid="anlatici-ileri"]') as HTMLElement).click(); });
    expect(useCoach.getState().step).toBe(1);
  });
});

describe('kampta birden çok yeni şey: tek kart', () => {
  it('başlık ve her biri için Göster; ilk anda dokunuş almaz; tur sürerken gizli; kapatınca görülmüş sayılır', async () => {
    screen();
    const { KampYeniKart, showKampYeni } = await import('./KampYeni'); const { useCoach } = await import('./Coach'); const { useStore } = await import('../store');
    const shown: string[] = [];
    await render(createElement(KampYeniKart, { onShow: (id: string) => shown.push(id), calm: () => true }));
    await act(async () => { showKampYeni(['gorev', 'kampoyun']); });
    const card = () => document.querySelector('[data-testid="kamp-yeni"]');
    expect(card()?.querySelector('.en-plain')?.textContent).toBe('Kamp’ta yeni 2 şey: Kamp Görevleri, Kamp oyunları');
    expect(card()?.querySelectorAll('[data-testid="kamp-yeni-goster"]')).toHaveLength(2);
    expect(card()?.classList.contains('armed')).toBe(false); // pointer-events:none: o an yoldaki dokunuş alttakine (Liste) gider
    await tick(500);
    expect(card()?.classList.contains('armed')).toBe(true);
    await act(async () => { (card()!.querySelector('[data-tour="kampoyun"]') as HTMLElement).click(); });
    expect(shown).toEqual(['kampoyun']);
    await act(async () => { useCoach.getState().start({ id: 'kampoyun', steps: [{ id: 'kg-oyun-01', say: 'Bir' }] }); });
    expect(card()).toBeNull();
    await act(async () => { useCoach.getState().end(false); });
    expect(card()?.querySelector('.en-plain')?.textContent).toBe('Kamp’ta yeni 1 şey: Kamp Görevleri');
    await act(async () => { (card()!.querySelector('.en-x') as HTMLElement).click(); });
    expect(card()).toBeNull();
    expect(useStore.getState().ftue.tours).toEqual(expect.arrayContaining(['kampoyun', 'gorev']));
  });
  it('alt sayfa/kutlama açıkken görünmez', async () => {
    screen();
    const { KampYeniKart, showKampYeni } = await import('./KampYeni');
    let calm = false;
    await render(createElement(KampYeniKart, { onShow: () => undefined, calm: () => calm }));
    await act(async () => { showKampYeni(['gorev', 'kampoyun']); });
    expect(document.querySelector('[data-testid="kamp-yeni"]')).toBeNull();
    calm = true; await tick(400);
    expect(document.querySelector('[data-testid="kamp-yeni"]')).not.toBeNull();
  });
});

describe('rehber sürerken bildirim/teşekkür kartı sırada bekler', () => {
  it('tur açıkken kart çizilmez ve süresi işlemez; tur bitince görünür', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const { CommBanner } = await import('../comm/CommBanner'); const { useComm } = await import('../comm/state'); const { useCoach } = await import('./Coach');
      await render(createElement(CommBanner));
      await act(async () => { useCoach.getState().start({ id: 'deneme', steps: [{ id: 'kg-vaka-02', say: 'Bir' }] }); });
      const n = { id: 'n1', kind: 'thanks', title: 'AyseTeyze 19. bölümü geçti!', text: 'Yardımın için teşekkür ediyor.', msgId: 'm1', room: 'takim:t1' } as unknown as CommNotice;
      await act(async () => { useComm.setState({ notices: [n] }); });
      expect(document.querySelector('[data-testid="iletisim-bildirimi"]')).toBeNull();
      await act(async () => { vi.advanceTimersByTime(20_000); });
      expect(useComm.getState().notices).toHaveLength(1); // görülmeden kaybolmadı
      await act(async () => { useCoach.getState().end(false); });
      expect(document.querySelector('[data-testid="iletisim-bildirimi"]')?.textContent).toContain('Rica ederim');
      await act(async () => { vi.advanceTimersByTime(7_100); });
      expect(useComm.getState().notices).toHaveLength(0);
    } finally { vi.useRealTimers(); }
  });
});

/**
 * Oyuncu testi tur 5 (YN-104, OT-ogrenci-birinci-17): tanıtım açılırken ekrana basan oyuncunun dokunuşu yutulmaz; tanıtım çekilir
 * (görülmüş sayılmaz) ve dokunuş alttaki öğeye gider. "Önce kur" yazısında parlayan Kur'a ilk dokunuş hem Kur'un işini yapar hem
 * yazıyı kapatır; sayfa kendiliğinden kaymaz.
 */
const press = (target: Element, x: number, y: number) => target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
const tapAt = (target: Element, x: number, y: number) => target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));

describe('kampa girişte ilk dokunuş tanıtım tarafından yutulmaz', () => {
  it('açılış anında katman dokunuş almaz; başka yere basınca tur görülmüş sayılmadan çekilir, dokunuş alttakine gider', async () => {
    screen();
    const { CoachHost, useCoach } = await import('./Coach'); const { useStore } = await import('../store');
    let gorevler = 0;
    const btn = el('button', { 'data-testid': 'kg-btn' }, [10, 70, 120, 40]); btn.addEventListener('click', () => { gorevler++; }); document.body.appendChild(btn);
    await render(createElement(CoachHost));
    let deferred = 0;
    await act(async () => { useCoach.getState().start({ id: 'vaka-kur', steps: [{ say: 'Önce kur' }], onDefer: () => { deferred++; } }); });
    expect(document.querySelector('[data-testid="anlatici-tur"]')?.classList.contains('acilis')).toBe(true); // pointer-events:none
    await act(async () => { press(btn, 40, 90); tapAt(btn, 40, 90); });
    expect(gorevler).toBe(1);
    expect(useCoach.getState().tour).toBeNull();
    expect(deferred).toBe(1);
    expect(useStore.getState().ftue.tours).not.toContain('vaka-kur');
  });
  it('açılış anı geçince katman olağan: dokunuş turu çekmez', async () => {
    screen();
    const { CoachHost, useCoach } = await import('./Coach');
    await render(createElement(CoachHost));
    await act(async () => { useCoach.getState().start({ id: 'deneme', steps: [{ say: 'Bir' }] }); });
    await tick(500);
    expect(document.querySelector('[data-testid="anlatici-tur"]')?.classList.contains('acilis')).toBe(false);
    await act(async () => { press(document.body, 5, 5); });
    expect(useCoach.getState().tour?.id).toBe('deneme');
  });
  it('"önce kur": parlayan Kur’a ilk dokunuş (açılış anında bile) Kur’un işini yapar ve yazıyı kapatır; sayfa kaymaz', async () => {
    screen();
    const { tourFor } = await import('./Director'); const { CoachHost, useCoach } = await import('./Coach'); const { useStore } = await import('../store');
    const list = el('div', { class: 'camp-list-screen' }, [0, 0, 390, 844]); document.body.appendChild(list);
    const card = el('div', { class: 'card building' }, [10, 300, 370, 160]); card.appendChild(el('div', { 'data-testid': 'klinik-vaka-not' }, [20, 420, 340, 30]));
    let kur = 0; const kurBtn = el('button', { class: 'btn small' }, [290, 330, 80, 44]); kurBtn.addEventListener('click', () => { kur++; }); card.appendChild(kurBtn);
    list.appendChild(card);
    await render(createElement(CoachHost));
    const t = tourFor('vaka-kur', 'camp')!;
    expect(t.steps[0]).toMatchObject({ wait: 'tap', noScroll: true, hint: 'Kur’a dokun' });
    await act(async () => { useCoach.getState().start(t); });
    await tick(30);
    await act(async () => { press(kurBtn, 320, 350); tapAt(kurBtn, 320, 350); });
    await tick(120);
    expect(kur).toBe(1);
    expect(useCoach.getState().tour).toBeNull();
    expect(useStore.getState().ftue.tours).toContain('vaka-kur');
  });
});

/**
 * Oyuncu testi tur 6 (YN-120, OT-ogrenci-birinci-22, OT-ilk-kez-oyun-33): kendiliğinden açılan kamp tanıtımında oyuncunun ilk dokunuşu
 * karartılmış zemine, altta kalan bir düğmenin ("Görevler") üstüne düşerse düğme hatırlanır ve tanıtım bitince işi yapılır (sessizce
 * yutulmaz). Kamp kartındaki "Göster"le istenen "önce kur" yazısı klinik kartını ekrana getirir (sayfa kayar).
 */
describe('kamp tanıtımı ilk dokunuşu yutmaz (tur 6)', () => {
  async function setup() {
    screen();
    const { startTour } = await import('./Director'); const { CoachHost, useCoach } = await import('./Coach');
    let gorevler = 0;
    const btn = el('button', { 'data-testid': 'kg-btn' }, [10, 70, 120, 40]); btn.addEventListener('click', () => { gorevler++; }); document.body.appendChild(btn);
    await render(createElement(CoachHost));
    return { startTour, useCoach, btn, count: () => gorevler };
  }
  const zemin = async (btn: Element) => {
    const block = document.querySelector('.coach-block')!;
    (document as { elementsFromPoint?: unknown }).elementsFromPoint = () => [block, btn];
    await act(async () => { tapAt(block, 40, 90); });
  };
  const ileri = () => act(async () => { (document.querySelector('[data-testid="anlatici-ileri"]') as HTMLElement).click(); });
  afterEach(() => { delete (document as { elementsFromPoint?: unknown }).elementsFromPoint; });

  it('zemine düşen dokunuş Görevler’in üstündeydi: tanıtım biter bitmez Görevler açılır (bir kez)', async () => {
    const { startTour, useCoach, btn, count } = await setup();
    await act(async () => { startTour('kampoyun', 'camp'); });
    await tick(500);
    await zemin(btn);
    expect(count()).toBe(0); // dokunuş tanıtımı ilerletti; düğmenin işi tanıtım bitince
    expect(useCoach.getState().step).toBe(1);
    await tick(50); await ileri();
    expect(useCoach.getState().tour).toBeNull();
    await tick(200);
    expect(count()).toBe(1);
  });
  it('atlanınca da düğmenin işi yapılır; o an bir pencere açıksa yapılmaz', async () => {
    const { startTour, btn, count } = await setup();
    await act(async () => { startTour('kampoyun', 'camp'); });
    await tick(500); await zemin(btn);
    await act(async () => { (document.querySelector('.cp-skip') as HTMLElement).click(); });
    await tick(200);
    expect(count()).toBe(1);
    const { useStore } = await import('../store'); useStore.setState({ ftue: { v: 1, story: true, tours: [] } });
    await act(async () => { startTour('kampoyun', 'camp'); });
    await tick(500); await zemin(btn);
    const sheet = el('div', { class: 'sheet-wrap' }, [0, 0, 390, 844]); document.body.appendChild(sheet);
    await act(async () => { (document.querySelector('.cp-skip') as HTMLElement).click(); });
    await tick(200);
    expect(count()).toBe(1);
  });
  it('İleri’ye basan oyuncu tanıtımı görmüştür: sonradan bir şey açılmaz', async () => {
    const { startTour, btn, count } = await setup();
    await act(async () => { startTour('kampoyun', 'camp'); });
    await tick(500); await ileri(); await tick(50);
    await zemin(btn); await tick(50);
    if (document.querySelector('[data-testid="anlatici-ileri"]')) await ileri();
    await tick(200);
    expect(count()).toBe(0);
  });
  it('"Göster"le istenen "önce kur" yazısı sayfayı klinik kartına kaydırır; kendiliğinden gelen kaydırmaz', async () => {
    const { tourFor } = await import('./Director');
    expect(tourFor('vaka-kur', 'camp', true)!.steps[0]).toMatchObject({ noScroll: false });
    expect(tourFor('vaka-kur', 'camp')!.steps[0]).toMatchObject({ noScroll: true });
  });
});
