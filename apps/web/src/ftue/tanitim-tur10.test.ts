// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { EventNotice } from '@odi/shared';

const spoken: (string | undefined)[] = [];
vi.mock('./voice', () => ({ speakLine: (_t: string, id?: string) => { spoken.push(id); return spoken.length; }, stopVoice: () => undefined, prefetchLines: () => undefined, stopVoiceIf: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined } }));
vi.mock('../net', () => ({ act: async () => null, toast: () => undefined }));

/**
 * Oyuncu testi tur 10 (YN-169, YN-170): Tüy Dede tanıtımları.
 *  - Kamp oyunları yalnız en az biri açıkken tanıtılır (seslendirilmiş "…seni bekliyor"); hiçbiri açık değilse bir kez seslendirilmeyen
 *    "önce Odyometri Odası'nı kur" yazısı, çerçeve odanın kartında; oda kurulunca asıl tanıtım bir kez.
 *  - "Önce kur" yazısı bina penceresi açılınca kapanır (çerçeve ve balon pencerenin Kur düğmesini örtmez).
 *  - Görevler › Etkinlik'in ortak hak notu tek sade cümle (karar 44).
 *  - Bölüme dokunan oyuncu: tanıtım bölüm yüklenirken başlamaz; açık tanıtımın üstünden "Bölüm N"e dokunuş tanıtımı erteler ve
 *    bölümü başlatır; bölüm açılınca sürmekte olan açılım tanıtımı ertelenir.
 *  - Zamanlı takım bildirimi (ralli, yarış daveti) görünürken tanıtım başlamaz; tanıtım sürerken gelen ralli bildirimi beklenir.
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
  const { useCoach } = await import('./Coach'); const { useStore } = await import('../store'); const { bolumNiyeti } = await import('./Director');
  const { useEvents } = await import('../events/store');
  await act(async () => { useCoach.getState().end(false); root?.unmount(); });
  useStore.setState({ ftue: { v: 1, story: true, tours: [] } }); useEvents.setState({ notices: [] });
  bolumNiyeti.at = -Infinity;
  root = null; document.body.innerHTML = ''; spoken.length = 0;
  (document as { elementsFromPoint?: unknown }).elementsFromPoint = undefined;
});
const tick = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const el = (tag: string, attrs: Record<string, string>, r: [number, number, number, number]) => { const d = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) d.setAttribute(k, v); d.getBoundingClientRect = () => new DOMRect(...r); return d; };
function screen() {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
}
async function render(node: ReturnType<typeof createElement>) {
  const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h);
  await act(async () => { root!.render(node); });
}

describe('Kamp oyunları yalnız biri açıkken tanıtılır (OT-ilk-kez-oyun-52)', () => {
  it('campQueue: oyun kilitliyse "önce kur" (bir kez); oda kurulunca asıl tanıtım bir kez; görülen ya da oynanan bir daha gelmez', async () => {
    const { campQueue } = await import('./Director');
    expect(campQueue(6, ['gorev'], null, false, 'kur')).toEqual(['oyun-kur']);
    expect(campQueue(6, ['gorev', 'oyun-kur'], null, false, 'kur')).toEqual([]);
    expect(campQueue(6, ['gorev', 'oyun-kur'], null, false, 'acik')).toEqual(['kampoyun']);
    expect(campQueue(6, ['gorev'], null, false, 'yapiliyor')).toEqual([]);
    expect(campQueue(6, ['gorev', 'kampoyun'], null, false, 'kur')).toEqual([]);
    expect(campQueue(6, ['gorev', 'kampoyun'], null, false, 'acik')).toEqual([]);
    expect(campQueue(6, ['gorev'], null, false, 'acik', true)).toEqual([]);
    expect(campQueue(6, ['gorev'], null, false, null)).toEqual([]);
    expect(campQueue(7, [], 'kur', false, 'kur')).toEqual(['gorev', 'oyun-kur', 'vaka-kur']);
    expect(campQueue(5, [], null, false, 'kur')).toEqual(['gorev']);
  });
  it('kampta tek kart: "önce kur" satırı özelliğin adıyla ve "Odyometri Odası’nı kur" notuyla', async () => {
    const { kampYeniAd, kampYeniBaslik } = await import('./KampYeni');
    expect(kampYeniAd('oyun-kur')).toBe('Kamp oyunları');
    expect(kampYeniBaslik(['oyun-kur', 'vaka-kur'])).toBe('Kamp’ta yeni 2 şey: Kamp oyunları, Hasta Vakaları');
  });
  it('"önce kur" yazısı seslendirilmez (kg-oyun-01 çalmaz), çerçeve Odyometri Odası kartında', async () => {
    screen();
    const { tourFor, OYUN_KUR } = await import('./Director'); const { CoachHost, useCoach } = await import('./Coach');
    const { CAMP_TOURS } = await import('./map-intro');
    expect(CAMP_TOURS.has('oyun-kur')).toBe(true);
    document.body.appendChild(el('div', { class: 'camp-list-screen' }, [0, 0, 320, 640]));
    const kule = el('div', { class: 'card building' }, [10, 100, 300, 120]); kule.appendChild(el('div', { 'data-testid': 'giris-timpano-kilit' }, [20, 190, 280, 20]));
    const oda = el('div', { class: 'card building' }, [10, 300, 300, 140]); oda.appendChild(el('div', { 'data-testid': 'giris-ton-kilit' }, [20, 410, 280, 20]));
    document.body.append(kule, oda);
    await render(createElement(CoachHost));
    const t = tourFor('oyun-kur', 'camp')!;
    expect(t.steps).toHaveLength(1);
    expect(t.steps[0]).toMatchObject({ silent: true, hint: 'Kur’a dokun' });
    expect(t.steps.some((s) => s.id === 'kg-oyun-01')).toBe(false);
    await act(async () => { useCoach.getState().start(t); });
    await tick(50);
    expect(document.querySelector('[data-testid="anlatici"]')?.getAttribute('data-say')).toBe(OYUN_KUR);
    expect(OYUN_KUR).toBe('Önce Odyometri Odası’nı kur; Ton Avı oradan açılır.');
    expect((document.querySelector('.coach-ring') as HTMLElement | null)?.style.top).toBe('292px'); // odanın kartı (300) − pay (8)
    expect(spoken).toEqual([]);
  });
});

describe('"Önce kur" yazısı bina penceresinin Kur düğmesini örtmez (OT-eski-telefon-29)', () => {
  it('üs görünümünde arsaya dokunuş bina penceresini açınca yazı kapanır ve görülmüş sayılır', async () => {
    screen();
    const { tourFor } = await import('./Director'); const { CoachHost, useCoach } = await import('./Coach'); const { useStore } = await import('../store');
    const arsa = el('div', { class: 'card building' }, [20, 300, 280, 100]); arsa.appendChild(el('div', { 'data-testid': 'klinik-vaka-not' }, [30, 360, 260, 30]));
    document.body.appendChild(arsa);
    await render(createElement(CoachHost));
    const t = tourFor('vaka-kur', 'camp')!;
    expect(t.steps[0]!.hint).toBe('Kliniğe dokun');
    await act(async () => { useCoach.getState().start(t); });
    await tick(50);
    expect(document.querySelector('[data-testid="anlatici"]')).not.toBeNull();
    // dokunuş pencereyi açtı (tuval dokunuşu "click" olarak gelmeyebilir)
    const bp = document.createElement('div'); bp.className = 'bp-wrap'; bp.innerHTML = '<div class="bp"><div class="bp-up"><button class="btn">Kur → Sv 1</button></div></div>';
    document.body.appendChild(bp);
    await tick(700);
    expect(useCoach.getState().tour).toBeNull();
    expect(document.querySelector('[data-testid="anlatici"]')).toBeNull();
    expect(useStore.getState().ftue.tours).toContain('vaka-kur');
  });
});

describe('Görevler › Etkinlik: ortak hak notu (karar 44, OT-ilk-kez-oyun-53)', () => {
  it('tek sade cümle; "günde toplam 5" demez, toplamın değişmediğini söyler', async () => {
    const { ORTAK_HAK_NOTU } = await import('../camp/gorev/state');
    expect(ORTAK_HAK_NOTU.split(/[.!?](\s|$)/).filter((x) => x && x.trim()).length).toBe(1);
    expect(ORTAK_HAK_NOTU).not.toMatch(/\(/);
    expect(ORTAK_HAK_NOTU).not.toMatch(/toplam 5/);
    expect(ORTAK_HAK_NOTU).toMatch(/Ton Avı/); expect(ORTAK_HAK_NOTU).toMatch(/Timpanogram Eşleştir/);
    expect(ORTAK_HAK_NOTU).toMatch(/kendi turları bitince/);
    expect(ORTAK_HAK_NOTU).toMatch(/toplam ödülü değişmez/);
  });
});

describe('Bölüme dokunan oyuncu tanıtıma takılmaz (OT-uzman-odyolog-34)', () => {
  it('"Bölüm N"e dokunuştan sonra bölüm yüklenirken tanıtım başlamaz', async () => {
    const { quiet, bolumNiyeti } = await import('./Director');
    const b = document.createElement('button'); b.className = 'map-play'; b.textContent = 'Bölüm 10'; document.body.appendChild(b);
    expect(quiet()).toBe(true);
    b.click();
    expect(quiet()).toBe(false);
    bolumNiyeti.at = performance.now() - 16000; // bölüm açılamadıysa tanıtımlar yine gelir
    expect(quiet()).toBe(true);
    const s = document.createElement('div'); s.className = 'result-actions'; s.innerHTML = '<button data-act="sonraki">Sonraki</button>'; document.body.appendChild(s);
    (s.querySelector('button') as HTMLButtonElement).click();
    expect(quiet()).toBe(false);
  });
  it('sekme değiştiren tanıtımın üstünden "Bölüm N"e dokunuş: tanıtım görülmüş sayılmadan çekilir, bölüm başlar', async () => {
    const { watchBolum, sekmeDegistirir, tourFor, bolumBasliyor } = await import('./Director'); const { useCoach } = await import('./Coach'); const { useStore } = await import('../store');
    expect(sekmeDegistirir(tourFor('soru', 'map')!)).toBe(true);
    expect(sekmeDegistirir(tourFor('soru', 'team')!)).toBe(false);
    expect(sekmeDegistirir(tourFor('ikili', 'map')!)).toBe(true);
    let played = 0; let deferred = 0;
    const play = document.createElement('button'); play.className = 'map-play'; play.addEventListener('click', () => { played++; }); document.body.appendChild(play);
    const coach = document.createElement('div'); coach.className = 'coach'; const block = document.createElement('div'); block.className = 'coach-block'; coach.appendChild(block); document.body.appendChild(coach);
    (document as { elementsFromPoint?: unknown }).elementsFromPoint = () => [block, play];
    let advanced = 0; block.addEventListener('click', () => { advanced++; });
    await act(async () => { useCoach.getState().start({ id: 'soru', steps: [{ say: 'Yeni: Günün Sorusu' }], onDefer: () => { deferred++; } }); });
    const w = watchBolum();
    block.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 160, clientY: 560 }));
    w.stop();
    expect(advanced).toBe(0); // tanıtım ilerlemez
    expect(useCoach.getState().tour).toBeNull();
    expect(deferred).toBe(1);
    expect(useStore.getState().ftue.tours).not.toContain('soru');
    expect(bolumBasliyor()).toBe(true);
    await tick(100);
    expect(played).toBe(1);
  });
  it('başka bir yere düşen ilk dokunuş tanıtımı ertelemez', async () => {
    const { watchBolum } = await import('./Director'); const { useCoach } = await import('./Coach');
    const coach = document.createElement('div'); coach.className = 'coach'; const block = document.createElement('div'); block.className = 'coach-block'; coach.appendChild(block); document.body.appendChild(coach);
    const other = document.createElement('div'); document.body.appendChild(other);
    (document as { elementsFromPoint?: unknown }).elementsFromPoint = () => [block, other];
    await act(async () => { useCoach.getState().start({ id: 'soru', steps: [{ say: 'Yeni: Günün Sorusu' }] }); });
    const w = watchBolum();
    block.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    w.stop();
    expect(useCoach.getState().tour?.id).toBe('soru');
  });
  it('bölüm açılınca sürmekte olan açılım tanıtımı ertelenir (bölümden sonra yeniden gelir)', async () => {
    const { FtueDirector } = await import('./Director'); const { useCoach } = await import('./Coach'); const { useStore } = await import('../store');
    let deferred = 0;
    await render(createElement(FtueDirector, { route: 'map' }));
    await act(async () => { useCoach.getState().start({ id: 'ikili', steps: [{ say: 'Yeni: İkili Görev' }, { say: 'Profil’e dokun', target: 'nav.tabbar .tab[data-tab="profile"]', wait: 'tap' }], onDefer: () => { deferred++; } }); });
    await act(async () => { root!.render(createElement(FtueDirector, { route: 'level' })); });
    expect(useCoach.getState().tour).toBeNull();
    expect(deferred).toBe(1);
    expect(useStore.getState().ftue.tours).not.toContain('ikili');
  });
});

describe('Zamanlı takım bildirimi tanıtım yüzünden kaybolmaz (OT-takim-kaptani-32)', () => {
  it('ralli bildirimi ya da yarış daveti görünürken tanıtım başlamaz', async () => {
    const { quiet } = await import('./Director');
    expect(quiet()).toBe(true);
    const n = document.createElement('div'); n.setAttribute('data-testid', 'ev-bildirim'); document.body.appendChild(n);
    expect(quiet()).toBe(false);
    n.remove();
    const d = document.createElement('div'); d.setAttribute('data-testid', 'yaris-davet-karti'); document.body.appendChild(d);
    expect(quiet()).toBe(false);
  });
  it('tanıtım sürerken gelen ralli bildirimi bekler, süresi işlemez; tanıtım kapanınca görünür', async () => {
    const { EventNoticeStrip } = await import('../events/Notices'); const { useEvents } = await import('../events/store'); const { useCoach } = await import('./Coach');
    const notice: EventNotice = { id: 'n1', kind: 'ralli', icon: '🏆', title: 'Hesapli ralline katıldı', text: 'Saldırı açıldı · Saldır!', at: Date.now(), target: 'ralli' };
    await act(async () => { useCoach.getState().start({ id: 'ikili', steps: [{ say: 'Yeni: İkili Görev' }] }); });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      await render(createElement(EventNoticeStrip, { onOpen: () => undefined }));
      await act(async () => { useEvents.setState({ notices: [notice] }); });
      expect(document.querySelector('[data-testid="ev-bildirim"]')).toBeNull();
      await act(async () => { vi.advanceTimersByTime(20000); });
      await act(async () => { useCoach.getState().end(true); });
      expect(document.querySelector('[data-testid="ev-bildirim"]')?.textContent).toContain('Hesapli ralline katıldı');
      await act(async () => { vi.advanceTimersByTime(7100); });
      expect(document.querySelector('[data-testid="ev-bildirim"]')).toBeNull();
    } finally { vi.useRealTimers(); }
  });
});
