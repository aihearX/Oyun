// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { KgState } from '@odi/shared';

const spoken: (string | undefined)[] = [];
vi.mock('./voice', () => ({ speakLine: (_t: string, id?: string) => { spoken.push(id); return spoken.length; }, stopVoice: () => undefined, prefetchLines: () => undefined, stopVoiceIf: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined } }));
vi.mock('../net', () => ({ act: async () => null, toast: () => undefined, reconnect: () => undefined, getNet: () => null, useSocial: (f: (s: unknown) => unknown) => f({ enabled: true, tried: true, bonuses: null }) }));

/**
 * Oyuncu testi tur 15 (YN-253, YN-263, YN-259): Tüy Dede tanıtımları.
 *  - Harita'da "Bölüm N"e uzanırken açılan tanıtım: açılır açılmaz gelen dokunuş balona ya da "Yeni yer açıldı" kartına düşse de
 *    altındaki bölüm düğmesine sayılır; tanıtım görülmüş sayılmadan çekilir, bölüm başlar, tanıtım sonra yeniden gelir (OT-ogrenci-birinci-53).
 *  - Ekranda içerik yokken ("İnternet yok", bağlanılamadı kartı, yükleniyor) tanıtım başlamaz, süren tur duraklar; içerik gelince sürer
 *    (OT-eski-telefon-44). Kamp öğreticisinde internetsiz Kur: balon dürüst not verir, el gizlenir (OT-eski-telefon-45).
 *  - Görevler › Git (depo): bina gösterilir, oyuncu oraya giderken tanıtım ve anıt kartı bekler (OT-ilk-kez-oyun-74).
 *  - Kamp oyunları: Timpanometri Kulesi kurulmamışken kule anılmaz; seslendirilmiş kg-oyun-01 yalnız ikisi de açıkken (OT-ilk-kez-oyun-75).
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
  const { unlockTally } = await import('./map-intro'); const { useKg } = await import('../camp/gorev/state'); const { useKampIstek } = await import('../camp/istek');
  await act(async () => { useCoach.setState({ tour: null, step: 0 }); root?.unmount(); });
  useStore.setState({ ftue: { v: 1, story: true, tours: [] }, progress: {} }); useKg.setState({ kg: null, panel: null });
  useKampIstek.setState({ bina: null, susle: false, goster: null, git: -Infinity });
  Object.assign(unlockTally, { cleared: -1, genel: 0, kamp: 0 });
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
/** 5. bölümü yeni geçmiş oyuncu (Sıralama tanıtımı sırada, Takım görülmüş) */
async function at5() {
  const { useStore } = await import('../store');
  const progress: Record<number, { stars: number }> = {}; for (let i = 1; i <= 5; i++) progress[i] = { stars: 2 };
  useStore.setState({ ftue: { v: 1, story: true, tours: ['result1', 'map', 'today', 'camp', 'camp-build', 'friends', 'glossary', 'team'] }, progress: progress as never });
}

describe('bölüme uzanırken açılan tanıtım dokunuşu yutmaz (OT-ogrenci-birinci-53)', () => {
  it('tur açılışından 200 ms sonra balona düşen dokunuş altındaki "Bölüm 6"yı başlatır; tanıtım görülmüş sayılmaz, sonra yeniden gelir', async () => {
    screen(); await at5();
    const { startTour } = await import('./Director'); const { CoachHost, useCoach } = await import('./Coach'); const { useStore } = await import('../store');
    const { genelUnlockQueue } = await import('./map-intro');
    let played = 0;
    const play = el('button', { class: 'map-btn shine' }, [60, 420, 200, 64]); play.addEventListener('click', () => { played++; }); document.body.appendChild(play);
    await render(createElement(CoachHost));
    expect(genelUnlockQueue(5, useStore.getState().ftue.tours)).toEqual(['siralama']);
    await act(async () => { startTour('siralama', 'map'); });
    expect(useCoach.getState().tour?.id).toBe('siralama');
    await tick(200);
    const panel = document.querySelector('.coach-panel') as HTMLElement;
    expect(panel).not.toBeNull();
    (document as { elementsFromPoint?: unknown }).elementsFromPoint = () => [panel, panel.parentElement, play];
    await act(async () => { panel.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 160, clientY: 450 })); });
    expect(useCoach.getState().tour).toBeNull();
    expect(useStore.getState().ftue.tours).not.toContain('siralama');
    await tick(100);
    expect(played).toBe(1);
    // bölümden sonra yeniden sırada (anlatıcı yükü sayacı geri alındı)
    expect(genelUnlockQueue(5, useStore.getState().ftue.tours)).toEqual(['siralama']);
  });
  it('tanıtım bir süredir açıkken balona dokunuş bölüm başlatmaz (oyuncu tanıtımı okuyor)', async () => {
    screen(); await at5();
    const { startTour } = await import('./Director'); const { CoachHost, useCoach } = await import('./Coach');
    let played = 0;
    const play = el('button', { class: 'map-btn shine' }, [60, 420, 200, 64]); play.addEventListener('click', () => { played++; }); document.body.appendChild(play);
    await render(createElement(CoachHost));
    await act(async () => { startTour('siralama', 'map'); });
    await tick(1000);
    const panel = document.querySelector('.coach-panel') as HTMLElement;
    (document as { elementsFromPoint?: unknown }).elementsFromPoint = () => [panel, play];
    await act(async () => { panel.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 160, clientY: 450 })); });
    await tick(100);
    expect(useCoach.getState().tour?.id).toBe('siralama');
    expect(played).toBe(0);
  });
});

describe('içerik yokken tanıtım anlatılmaz (OT-eski-telefon-44)', () => {
  it('"İnternet yok" kartı, bağlanılamadı kartı ya da sosyal ekranın iskeleti görünürken quiet() false', async () => {
    const { quiet } = await import('./Director'); const { OfflineCard, Skeleton } = await import('../ui/social');
    expect(quiet()).toBe(true);
    const hata = el('div', { 'data-testid': 'hata-ag', 'data-icerik-yok': '' }, [0, 0, 320, 640]); document.body.appendChild(hata);
    expect(quiet()).toBe(false);
    hata.remove();
    expect(quiet()).toBe(true);
    await render(createElement(OfflineCard, { what: 'Takım' }));
    expect(quiet()).toBe(false);
    await act(async () => { root!.render(createElement(Skeleton, { rows: 2 })); });
    expect(quiet()).toBe(true); // bölüm içi küçük iskelet ekranı boş saymaz
    await act(async () => { root!.render(createElement(Skeleton, { rows: 2, ekran: true })); });
    expect(quiet()).toBe(false);
  });
  it('süren tur (Bugün tanıtımı) içerik yokken duraklar, görülmüş sayılmaz; bağlanınca kaldığı adımdan sürer', async () => {
    screen();
    const { CoachHost, useCoach } = await import('./Coach'); const { useStore } = await import('../store');
    await render(createElement(CoachHost));
    await act(async () => { useCoach.getState().start({ id: 'today', steps: [{ say: 'Bugün’e geçtik' }, { id: 'bugun-04', say: 'Bunlar günlük görevler.' }] }); });
    await act(async () => { useCoach.getState().next(); });
    expect(document.querySelector('[data-testid="anlatici"]')?.getAttribute('data-say')).toBe('Bunlar günlük görevler.');
    const hata = el('div', { 'data-testid': 'hata-ag', 'data-icerik-yok': '' }, [0, 0, 320, 640]); document.body.appendChild(hata);
    await tick(400);
    expect(document.querySelector('[data-testid="anlatici"]')).toBeNull();
    expect(useCoach.getState().tour?.id).toBe('today');
    expect(useStore.getState().ftue.tours).not.toContain('today');
    await act(async () => { hata.remove(); });
    await tick(400);
    expect(document.querySelector('[data-testid="anlatici"]')?.getAttribute('data-say')).toBe('Bunlar günlük görevler.');
  });
  it('kamp öğreticisinde internetsiz Kur: balonda "İnternet gelince inşaat başlayacak", el ve "Düğmeye dokun" gizli; bağlanınca adım ilerler', async () => {
    screen();
    const { useNet } = await import('@odi/net/store'); const { BUILDINGS } = await import('@odi/shared');
    const { tourFor, INSAAT_BEKLIYOR } = await import('./Director'); const { CoachHost, useCoach } = await import('./Coach');
    useNet.setState({ camp: { buildings: BUILDINGS.map((d) => ({ id: d.id, level: d.id === 'merkez' ? 1 : 0 })) } as never, wallet: { jeton: 5000 } as never });
    const t = tourFor('camp-build', 'camp')!;
    const step = t.steps.find((s) => s.id === 'kamp-insa-04')!;
    const bp = document.createElement('div'); bp.className = 'bp-wrap';
    const panel = el('div', { class: 'bp' }, [0, 200, 320, 440]); const up = el('div', { class: 'bp-up' }, [10, 520, 300, 60]); const btn = el('button', { class: 'btn' }, [20, 530, 280, 48]); btn.textContent = 'Kur → Sv 1';
    up.appendChild(btn); panel.appendChild(up); bp.appendChild(panel); document.body.appendChild(bp);
    await render(createElement(CoachHost));
    await act(async () => { useCoach.getState().start({ id: 'camp-build', steps: [step, { id: 'kamp-insa-05', say: 'Harika, inşaat başladı!' }] }); });
    await tick(80);
    expect(document.querySelector('[data-testid="anlatici-ipucu"]')?.textContent).toContain('Düğmeye dokun');
    expect(document.querySelector('.coach-hand')).not.toBeNull();
    // internetsiz basıldı: düğme kilitli, kart "Bağlanınca başlayacak"
    btn.setAttribute('disabled', ''); const not = el('div', { 'data-testid': 'bekleyen-insaat' }, [20, 584, 280, 20]); not.textContent = 'Bağlanınca başlayacak'; up.appendChild(not);
    await tick(350);
    expect(document.querySelector('[data-testid="anlatici-not"]')?.textContent).toBe(INSAAT_BEKLIYOR);
    expect(INSAAT_BEKLIYOR).toBe('İnternet gelince inşaat başlayacak');
    expect(document.querySelector('[data-testid="anlatici-ipucu"]')).toBeNull();
    expect(document.querySelector('.coach-hand')).toBeNull();
    expect(useCoach.getState().step).toBe(0);
    // bağlandı: inşaat başladı, adım bugünkü gibi ilerler
    not.remove(); panel.appendChild(el('div', { class: 'bp-build' }, [10, 300, 300, 80]));
    await tick(700);
    expect(useCoach.getState().step).toBe(1);
    useNet.setState({ camp: null, wallet: null });
  });
});

/** kamp görevleri özeti: yalnız kamp oyunlarının açıklığı önemli */
const kgWith = (ton: boolean, timpano: boolean) => ({ oyun: [{ oyun: 'ton', open: ton, played: 0 }, { oyun: 'timpano', open: timpano, played: 0 }], open: { gorev: true, oyun: true, vaka: false }, vaka: { open: false } }) as unknown as KgState;

describe('Kamp oyunları: kurulmamış kule anılmaz (OT-ilk-kez-oyun-75)', () => {
  it('yalnız Ton Avı açıkken seslendirilmeyen yazı; kg-oyun-01 yalnız ikisi de açıkken', async () => {
    const { tourFor, OYUN_TON, OYUN_TIMPANO } = await import('./Director'); const { useKg } = await import('../camp/gorev/state');
    useKg.setState({ kg: kgWith(true, false) });
    let s = tourFor('kampoyun', 'camp')!.steps[0]!;
    expect(s).toMatchObject({ say: OYUN_TON, silent: true, kicker: 'Yeni yer açıldı!' });
    expect(s.id).toBeUndefined();
    expect(OYUN_TON).toBe('Yeni: Kamp oyunları! Odyometri Odası’nda Ton Avı seni bekliyor; Timpanogram Eşleştir, Timpanometri Kulesi’ni kurunca açılır.');
    useKg.setState({ kg: kgWith(false, true) });
    expect(tourFor('kampoyun', 'camp')!.steps[0]!.say).toBe(OYUN_TIMPANO);
    expect(OYUN_TIMPANO).not.toMatch(/Ton Avı seni bekliyor/);
    useKg.setState({ kg: kgWith(true, true) });
    s = tourFor('kampoyun', 'camp')!.steps[0]!;
    expect(s.id).toBe('kg-oyun-01'); expect(s.silent).toBeFalsy();
  });
  it('yalnız Ton Avı açıkken tanıtım seslendirilmez (kg-oyun-01 çalmaz)', async () => {
    screen();
    const { tourFor } = await import('./Director'); const { CoachHost, useCoach } = await import('./Coach'); const { useKg } = await import('../camp/gorev/state');
    useKg.setState({ kg: kgWith(true, false) });
    await render(createElement(CoachHost));
    await act(async () => { useCoach.getState().start(tourFor('kampoyun', 'camp')!); });
    await tick(50);
    expect(spoken).toEqual([]);
    expect(document.querySelector('[data-testid="anlatici"]')?.getAttribute('data-say')).toMatch(/Timpanometri Kulesi’ni kurunca açılır/);
  });
});

describe('Görevler › Git binayı gösterir, araya kart girmez (OT-ilk-kez-oyun-74)', () => {
  it('"Kulak Deposu’ndan jeton topla" › Git: panel kapanır, depo gösterilir; oyuncu dokunana dek tanıtım bekler', async () => {
    const { gorevGit } = await import('../camp/gorev/GorevPanel'); const { useKg, openPanel } = await import('../camp/gorev/state');
    const { useKampIstek, kampGitSuruyor, GIT_BEKLE_MS } = await import('../camp/istek'); const { quiet } = await import('./Director');
    openPanel({ kind: 'gorev', tab: 'gunluk' });
    const g = gorevGit('g-depo');
    expect(g.label).toBe('Git');
    g.go({ tab: () => undefined, open: () => undefined } as never);
    expect(useKg.getState().panel).toBeNull();
    expect(useKampIstek.getState().goster).toBe('depo');
    expect(kampGitSuruyor()).toBe(true);
    expect(quiet()).toBe(false);
    expect(kampGitSuruyor(performance.now() + GIT_BEKLE_MS + 1)).toBe(false); // kısa süre sonra yine gelir
    document.dispatchEvent(new Event('pointerdown')); // oyuncu depoya (ya da başka yere) dokundu
    expect(kampGitSuruyor()).toBe(false);
    expect(quiet()).toBe(true);
    expect(gorevGit('g-malzeme').label).toBe('Git');
  });
  it('liste görünümünde depo kartına kaydırılır ve kart parlar', async () => {
    const { CampList } = await import('../camp/CampList'); const { demoCamp } = await import('../camp/demo'); const { kampGoster, useKampIstek } = await import('../camp/istek');
    const { camp, wallet } = demoCamp({ level: 3, build: null, campLevel: 3 });
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) { scrolled.push(this.className); };
    const noop = async () => null;
    await render(createElement(CampList, { camp, wallet, team: false, fast: 0, sNow: Date.now(), bonuses: null, actions: { upgrade: noop, queue: noop, unqueue: noop, speed: noop, ask: noop, collect: noop, helpAll: noop, remedyMake: noop, remedyCollect: noop, decorPlace: noop, decorMove: noop, decorStore: noop, libCollect: noop } as never }));
    await act(async () => { kampGoster('depo'); });
    expect(useKampIstek.getState().goster).toBeNull();
    expect(scrolled.some((c) => c.includes('depot'))).toBe(true);
    expect(document.querySelector('.card.depot')?.classList.contains('kamp-hedef')).toBe(true);
    await act(async () => { document.dispatchEvent(new Event('pointerdown')); });
    expect(document.querySelector('.card.depot')?.classList.contains('kamp-hedef')).toBe(false);
    await act(async () => { kampGoster('tedavi'); });
    expect(document.querySelector('.card.building[data-bina="tedavi"]')?.classList.contains('kamp-hedef')).toBe(true);
  });
});
