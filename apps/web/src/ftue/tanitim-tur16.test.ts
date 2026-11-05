// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('./voice', () => ({ speakLine: () => 0, stopVoice: () => undefined, prefetchLines: () => undefined, stopVoiceIf: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined } }));
vi.mock('../net', () => ({ act: async () => null, toast: () => undefined, reconnect: () => undefined, getNet: () => null, useSocial: (f: (s: unknown) => unknown) => f({ enabled: true, tried: true, bonuses: null }) }));

/**
 * Oyuncu testi tur 16 (YN-267): Tüy Dede tanıtım sırası ve "Atla".
 *  (a) Harita dönüş sahnesi sürerken "Bölüm N"e dokunan oyuncunun bölümü başlar; söz verilen tanıtım görülmüş sayılmaz, bölümden
 *      sonra (sonuç ekranı aynı sözü yineler) gelir. Sahneyi geçen dokunuş tanıtımı geciktirmez (OT-ogrenci-birinci-55).
 *  (b) "Atla" ile geçilen tanıtımlar kalıcı kaydedilir: yeni oturumda gelmez; sonraki bölümde açılan YENİ yer yine duyurulur.
 *  (c) Kamp'a ilk girişte Kamp tanıtımı atlanınca bekleyen Kamp Görevleri tanıtımı aynı girişte açılmaz; oyuncunun sonraki dokunuşu
 *      (Liste görünümü) yerine gider (OT-uzman-odyolog-50).
 *  (d) Sonuç ekranının sözü haritanın oynatacağı kuyrukla aynı: "Hedefe ulaştın" kutusu kapanınca söz verilenler sırayla gelir,
 *      söz verilmeyen gelmez (OT-sessiz-oyuncu-35).
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
  const { bolumNiyeti } = await import('./Director'); const { unlockTally } = await import('./map-intro'); const { useKg } = await import('../camp/gorev/state');
  await act(async () => { useCoach.setState({ tour: null, step: 0 }); hideKampYeni(); root?.unmount(); });
  useStore.setState({ ftue: { v: 1, story: true, tours: [] }, progress: {} }); useKg.setState({ kg: null, vaka: null });
  Object.assign(unlockTally, { cleared: -1, genel: 0, kamp: 0 });
  bolumNiyeti.at = -Infinity;
  root = null; document.body.innerHTML = '';
  (document as { elementsFromPoint?: unknown }).elementsFromPoint = undefined;
});
const tick = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
/** oyuncunun bir öğeye (ya da boş ekrana) dokunuşu: basma, bırakma, tıklama */
const dokun = (el: EventTarget = document) => {
  for (const t of ['pointerdown', 'pointerup']) el.dispatchEvent(new Event(t, { bubbles: true }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};
const tourId = async () => (await import('./Coach')).useCoach.getState().tour?.id ?? null;
const el = (tag: string, attrs: Record<string, string>, r: [number, number, number, number]) => { const d = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) d.setAttribute(k, v); d.getBoundingClientRect = () => new DOMRect(...r); return d; };
function screen() {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
}
/** yönetmen ve anlatıcı katmanı (App.tsx gibi) */
async function director(route: string) {
  const { FtueDirector } = await import('./Director'); const { CoachHost } = await import('./Coach');
  if (!root) { const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h); }
  await act(async () => { root!.render(createElement('div', null, createElement(FtueDirector, { route }), createElement(CoachHost))); });
}
/** n bölümü geçmiş oyuncu; `seen`: görülmüş turlar */
async function player(n: number, seen: string[]) {
  const { useStore } = await import('../store');
  const progress: Record<number, { stars: number }> = {}; for (let i = 1; i <= n; i++) progress[i] = { stars: 2 };
  useStore.setState({ ftue: { v: 1, story: true, tours: seen }, progress: progress as never });
}
/** 8. bölümü yeni geçmiş, 7'ye kadarki her tanıtımı görmüş oyuncu: Canlı yarış ve Serbest yazı bekliyor */
async function at8() { const { veteranTours } = await import('./features'); await player(8, veteranTours(7)); }
/** harita: dönüş sahnesi (`suruyor` / `bitti`) ve büyük "Bölüm N" düğmesi */
function map(donus: string, onPlay: () => void = () => undefined) {
  document.querySelector('.map-screen')?.remove();
  const m = el('div', { class: 'map-screen', 'data-donus': donus }, [0, 0, 390, 844]);
  const play = el('button', { class: 'map-play shine' }, [80, 700, 230, 64]); play.addEventListener('click', onPlay);
  m.appendChild(play); document.body.appendChild(m);
  return { m, play };
}

describe('(a) dönüş sahnesi sürerken Bölüm dokunuşu bölümü başlatır, tanıtım bölümden sonra', () => {
  it('Bölüm 9 sahne sürerken: bölüm başlar, Canlı yarış görülmüş sayılmaz; Bölüm 9 sonucu aynı sözü verir, haritada gelir', async () => {
    await at8();
    const { mapIntroQueue, mapIntroView } = await import('./map-intro'); const { bolumBasliyor } = await import('./Director'); const { useStore } = await import('../store');
    expect(mapIntroQueue(8, useStore.getState().ftue)).toEqual(['race', 'yazi']);
    await director('result');
    dokun(); // "Haritaya dön"
    let played = 0;
    const { play } = map('suruyor', () => { played++; });
    await director('map');
    await tick(300);
    await act(async () => { dokun(play); });
    expect(played).toBe(1);
    expect(bolumBasliyor()).toBe(true);
    // sahne biter, bölüm yüklenirken de tanıtım açılmaz
    await act(async () => { document.querySelector('.map-screen')!.setAttribute('data-donus', 'bitti'); });
    await tick(1600);
    expect(await tourId()).toBeNull();
    await director('level');
    await tick(1100);
    expect(await tourId()).toBeNull();
    expect(useStore.getState().ftue.tours).not.toContain('race');
    // Bölüm 9 geçildi: yeni açılan Takım Yarışı ve Günün Sorusu bekleyenlerin arkasında; söz değişmez
    await player(9, useStore.getState().ftue.tours);
    const q = mapIntroQueue(9, useStore.getState().ftue);
    expect(q).toEqual(['race', 'yazi']);
    expect(mapIntroView(q)?.title).toBe('Yeni: Canlı yarış ve Serbest yazı');
    await director('result');
    dokun();
    map('bitti');
    await director('map');
    await tick(1100);
    expect(await tourId()).toBe('race');
  }, 20_000);

  it('sahneyi geçen dokunuş ("Dokun: atla") tanıtımı geciktirmez: sahne biter bitmez gelir', async () => {
    await at8();
    await director('result');
    dokun();
    const { m } = map('suruyor');
    await director('map');
    await tick(600);
    // basma sahnede; sahne geçilir, bırakma sahne bittikten sonra gelir
    await act(async () => { m.dispatchEvent(new Event('pointerdown', { bubbles: true })); m.setAttribute('data-donus', 'bitti'); });
    await act(async () => { m.dispatchEvent(new Event('pointerup', { bubbles: true })); });
    await tick(1100);
    expect(await tourId()).toBe('race');
  }, 15_000);

  it('haritada temiz ekranda dokunan oyuncuda yine sakinlik kuralı (sahne dışındaki dokunuş sayılır)', async () => {
    await at8();
    await director('result');
    dokun();
    const { m } = map('bitti');
    await director('map');
    await tick(500);
    await act(async () => { dokun(m); });
    await tick(1100);
    expect(await tourId()).toBeNull();
    await tick(2200);
    expect(await tourId()).toBe('race');
  }, 15_000);

  it('sekme değiştirmeyen tanıtım (Canlı yarış kartı) açılır açılmaz karta düşen dokunuş altındaki Bölüm düğmesine gider', async () => {
    screen(); await at8();
    const { startTour } = await import('./Director'); const { useCoach } = await import('./Coach'); const { useStore } = await import('../store');
    const { genelUnlockQueue } = await import('./map-intro');
    let played = 0;
    const { play } = map('bitti', () => { played++; });
    await director('map');
    await act(async () => { startTour('race', 'map'); });
    await tick(600);
    const block = document.querySelector('.coach-block') as HTMLElement;
    expect(block).not.toBeNull();
    (document as { elementsFromPoint?: unknown }).elementsFromPoint = () => [block, play];
    await act(async () => { block.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 190, clientY: 730 })); });
    expect(useCoach.getState().tour).toBeNull();
    await tick(100);
    expect(played).toBe(1);
    expect(useStore.getState().ftue.tours).not.toContain('race');
    expect(genelUnlockQueue(8, useStore.getState().ftue.tours)).toEqual(['race', 'yazi']);
  }, 15_000);

  it('aynı tanıtımda bir süre sonra karta dokunuş okumadır: tanıtım ilerler (görüldü), bölüm başlamaz', async () => {
    screen(); await at8();
    const { startTour } = await import('./Director'); const { useStore } = await import('../store');
    let played = 0;
    const { play } = map('bitti', () => { played++; });
    await director('map');
    await act(async () => { startTour('race', 'map'); });
    await tick(1200);
    const block = document.querySelector('.coach-block') as HTMLElement;
    (document as { elementsFromPoint?: unknown }).elementsFromPoint = () => [block, play];
    await act(async () => { block.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 190, clientY: 730 })); });
    await tick(100);
    expect(played).toBe(0);
    expect(useStore.getState().ftue.tours).toContain('race');
  }, 15_000);
});

describe('(b) Atla kalıcı: geçilen tanıtım yeni oturumda gelmez', () => {
  it('Takım Ligi tanıtımı atlanınca Mağaza ve Takım Akışı da geçilir; kayıt yeniden yüklenince de; Bölüm 7\'de yalnız yeni Etkinlikler', async () => {
    screen();
    const { veteranTours } = await import('./features'); const { startTour } = await import('./Director'); const { useCoach } = await import('./Coach');
    const { useStore } = await import('../store'); const { mapIntroQueue } = await import('./map-intro');
    await player(6, veteranTours(5));
    expect(mapIntroQueue(6, useStore.getState().ftue)).toEqual(['tlig', 'shop']);
    map('bitti');
    await director('map');
    await act(async () => { startTour('tlig', 'map'); });
    await tick(500);
    await act(async () => { (document.querySelector('.cp-skip') as HTMLElement).click(); });
    expect(useCoach.getState().tour).toBeNull();
    for (const id of ['tlig', 'shop', 'akis']) expect(useStore.getState().ftue.tours).toContain(id);
    // yeni oturum: bellek sıfır, kayıt (odi-v1) yeniden yüklenir
    const { platformStorage } = await import('../platform');
    const kayit = await platformStorage.getItem('odi-v1');
    expect(kayit).toContain('"tlig"');
    await act(async () => { root?.unmount(); }); root = null;
    useStore.setState({ ftue: { v: 1, story: true, tours: [] }, progress: {} });
    await platformStorage.setItem('odi-v1', kayit!);
    await useStore.persist.rehydrate();
    const f = useStore.getState().ftue;
    for (const id of ['tlig', 'shop', 'akis']) expect(f.tours).toContain(id);
    expect(mapIntroQueue(6, f)).toEqual([]);
    map('bitti');
    await director('map');
    await tick(3200);
    expect(await tourId()).toBeNull();
    // sonraki bölümde açılan YENİ yer yine duyurulur, atlananlar değil
    expect(mapIntroQueue(7, f)).toEqual(['events']);
  }, 20_000);
});

describe('(c) Kamp\'ta Kamp tanıtımı atlanınca Kamp Görevleri aynı girişte açılmaz', () => {
  it('Atla\'dan sonra tanıtım ya da "Kamp\'ta yeni" kartı gelmez; Liste görünümü dokunuşu yerine gider', async () => {
    screen();
    const { useStore } = await import('../store'); const { useKg } = await import('../camp/gorev/state'); const { campQueue } = await import('./Director');
    await player(4, ['result1', 'map', 'today']);
    useKg.setState({ kg: { open: { gorev: true, oyun: false, vaka: false }, oyun: [], vaka: { open: false }, achievements: [] } as never });
    expect(campQueue(4, useStore.getState().ftue.tours, null)).toEqual(['gorev']);
    const base = el('div', { class: 'camp-base' }, [0, 0, 390, 844]);
    let liste = 0; const btn = el('button', { 'data-testid': 'kamp-liste' }, [10, 140, 160, 44]); btn.addEventListener('click', () => { liste++; });
    base.appendChild(btn); document.body.appendChild(base);
    await director('camp');
    const { startTour } = await import('./Director');
    await act(async () => { startTour('camp', 'camp'); });
    expect(await tourId()).toBe('camp');
    await tick(500);
    const skip = document.querySelector('.cp-skip') as HTMLElement;
    await act(async () => { dokun(skip); });
    expect(await tourId()).toBeNull();
    const tours = useStore.getState().ftue.tours;
    for (const id of ['camp', 'camp-build', 'gorev']) expect(tours).toContain(id);
    await tick(3600);
    expect(await tourId()).toBeNull();
    expect(document.querySelector('[data-testid="kamp-yeni"]')).toBeNull();
    await act(async () => { dokun(btn); });
    expect(liste).toBe(1);
    await tick(600);
    expect(await tourId()).toBeNull();
  }, 20_000);

  it('Kamp Görevleri atlanınca yalnız kamp dizisi geçilir; harita tanıtımında Atla kamp turlarını geçmez', async () => {
    const { pendingTours } = await import('./Director');
    const seen = ['result1', 'map', 'today', 'camp', 'camp-build'];
    expect(pendingTours('camp', 4, ['result1', 'map', 'today'])).toEqual(expect.arrayContaining(['camp-build', 'friends', 'glossary', 'gorev']));
    expect(pendingTours('camp-build', 7, seen)).toContain('gorev');
    expect(pendingTours('friends', 7, seen)).not.toContain('gorev');
    expect(pendingTours('gorev', 7, seen)).toEqual(['kampoyun', 'vaka']);
  });
});

describe('(d) sonuç ekranının sözü haritada birebir', () => {
  it('Bölüm 8: "Tüy Dede de anlatacak: Canlı yarış ve Serbest yazı"; hedef kutusu kapanınca ikisi sırayla gelir, başka tanıtım gelmez', async () => {
    await at8();
    const { mapIntroQueue, mapIntroView } = await import('./map-intro'); const { useStore } = await import('../store'); const { useCoach } = await import('./Coach');
    const q = mapIntroQueue(8, useStore.getState().ftue);
    expect(q).toEqual(['race', 'yazi']);
    expect(mapIntroView(q, { zones: [], grows: [{ zone: 'kanal', to: 2 }], treasures: [] })?.note).toBe('Tüy Dede de anlatacak: Canlı yarış ve Serbest yazı.');
    await director('result');
    dokun();
    map('bitti');
    const goal = el('button', { class: 'map-goal', 'data-ulasildi': '1' }, [10, 220, 370, 80]); document.body.appendChild(goal);
    await director('map');
    await tick(2200);
    expect(await tourId()).toBeNull(); // "Hedefe ulaştın!" okunuyor
    await act(async () => { goal.removeAttribute('data-ulasildi'); });
    await tick(1100);
    expect(await tourId()).toBe('race');
    await act(async () => { useCoach.getState().end(false); });
    await tick(1100);
    expect(await tourId()).toBe('yazi');
    await act(async () => { useCoach.getState().end(false); });
    await tick(3200);
    expect(await tourId()).toBeNull();
    for (const id of q) expect(useStore.getState().ftue.tours).toContain(id);
  }, 20_000);

  it('söz verilmeyen (bu geçişin sınırını aşan) tanıtım haritada gelmez; bir sonraki sonuç onu söz verir', async () => {
    const { veteranTours } = await import('./features'); const { useStore } = await import('../store'); const { useCoach } = await import('./Coach');
    const { mapIntroQueue } = await import('./map-intro');
    // Takım Akışı Bölüm 6'dan beri bekliyor: önce o, sonra Canlı yarış; Serbest yazı sınırın dışında
    await player(8, veteranTours(7).filter((id) => id !== 'akis'));
    const q = mapIntroQueue(8, useStore.getState().ftue);
    expect(q).toEqual(['akis', 'race']);
    await director('result');
    dokun();
    map('bitti');
    await director('map');
    await tick(1100);
    expect(await tourId()).toBe('akis');
    await act(async () => { useCoach.getState().end(false); });
    await tick(1100);
    expect(await tourId()).toBe('race');
    await act(async () => { useCoach.getState().end(false); });
    await tick(3200);
    expect(await tourId()).toBeNull();
    expect(useStore.getState().ftue.tours).not.toContain('yazi');
    await player(9, useStore.getState().ftue.tours);
    expect(mapIntroQueue(9, useStore.getState().ftue)[0]).toBe('yazi');
  }, 25_000);
});
