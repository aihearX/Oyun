// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('./voice', () => ({ speakLine: () => 0, stopVoice: () => undefined, prefetchLines: () => undefined, stopVoiceIf: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined } }));
vi.mock('../net', () => ({ act: async () => null, toast: () => undefined, reconnect: () => undefined, getNet: () => null, useSocial: (f: (s: unknown) => unknown) => f({ enabled: true, tried: true, bonuses: null }) }));

/**
 * Oyuncu testi tur 16 (YN-267): Tüy Dede tanıtım sırası ve "Atla".
 *  (a) 1.1.0 (sahip isteği): açılım tanıtımı bekliyorken "Bölüm N"e dokunuş bölümü başlatmaz; tanıtım dönüş sahnesi biter bitmez
 *      gelir, sürerken dokunuş onu bozmaz. Sahneyi geçen dokunuş tanıtımı geciktirmez (OT-ogrenci-birinci-55).
 *  (b) "Atla" yalnız o tanıtımı geçer ve kalıcı kaydedilir: yeni oturumda gelmez; bekleyen öbürleri sırayla gelir.
 *  (c) Kamp'a ilk girişte Kamp tanıtımı atlanınca bekleyen Kamp Görevleri tanıtımı aynı girişte açılmaz; oyuncunun sonraki dokunuşu
 *      (Liste görünümü) yerine gider (OT-uzman-odyolog-50).
 *  (d) Sonuç ekranının sözü haritanın oynatacağı kuyrukla aynı: "Hedefe ulaştın" kutusu okununca söz verilenler sırayla gelir
 *      (OT-sessiz-oyuncu-35); bölüm başına sınır yok (1.1.0).
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

describe('(a) açılım tanıtımı bekliyorken Bölüm dokunuşu bölümü başlatmaz, tanıtım hemen gelir', () => {
  it('Bölüm 9 sahne sürerken: bölüm başlamaz (1.1.0), sahne biter bitmez Canlı yarış gelir; Atla ile geçilince Serbest yazı, sonra bölüm', async () => {
    await at8();
    const { mapIntroQueue } = await import('./map-intro'); const { bolumBasliyor, levelGate } = await import('./Director'); const { useStore } = await import('../store');
    const { useCoach } = await import('./Coach');
    expect(mapIntroQueue(8, useStore.getState().ftue)).toEqual(['race', 'yazi']);
    await director('result');
    dokun(); // "Haritaya dön"
    let played = 0;
    // App.tsx play(): önce bölüm kapısı
    const { play } = map('suruyor', () => { if (!levelGate('map')) played++; });
    await director('map');
    await tick(300);
    await act(async () => { dokun(play); });
    expect(played).toBe(0);
    expect(bolumBasliyor()).toBe(false);
    expect(await tourId()).toBeNull(); // dönüş sahnesi sürüyor
    await act(async () => { document.querySelector('.map-screen')!.setAttribute('data-donus', 'bitti'); });
    await tick(600);
    expect(await tourId()).toBe('race');
    // tanıtım sürerken Bölüm dokunuşu tanıtımı bozmaz
    await act(async () => { dokun(play); });
    expect(played).toBe(0);
    expect(await tourId()).toBe('race');
    // Atla yalnız Canlı yarış'ı geçer; Serbest yazı hemen gelir
    await act(async () => { useCoach.getState().end(true); });
    expect(useStore.getState().ftue.tours).toContain('race');
    expect(useStore.getState().ftue.tours).not.toContain('yazi');
    await tick(1100);
    expect(await tourId()).toBe('yazi');
    await act(async () => { useCoach.getState().end(false); });
    // hepsi dinlendi ya da atlandı: bölüm başlar
    await act(async () => { dokun(play); });
    expect(played).toBe(1);
    expect(bolumBasliyor()).toBe(true);
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

  it('haritada bekleyen açılım tanıtımı dokunuş sakinliği beklemez; yalnız parmak ekrandayken başlamaz', async () => {
    await at8();
    await director('result');
    dokun();
    const { m } = map('bitti');
    await director('map');
    await tick(500);
    await act(async () => { m.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    await tick(1600);
    expect(await tourId()).toBeNull(); // parmak ekranda
    await act(async () => { m.dispatchEvent(new Event('pointerup', { bubbles: true })); m.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await tick(1100);
    expect(await tourId()).toBe('race');
  }, 15_000);

  it('sekme değiştirmeyen tanıtım (Canlı yarış kartı) açılır açılmaz karta düşen dokunuş Bölüm düğmesine geçmez (1.1.0)', async () => {
    screen(); await at8();
    const { startTour, levelGate } = await import('./Director'); const { useStore } = await import('../store');
    let played = 0;
    const { play } = map('bitti', () => { if (!levelGate('map')) played++; });
    await director('map');
    await act(async () => { startTour('race', 'map'); });
    await tick(600);
    const block = document.querySelector('.coach-block') as HTMLElement;
    expect(block).not.toBeNull();
    (document as { elementsFromPoint?: unknown }).elementsFromPoint = () => [block, play];
    await act(async () => { block.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 190, clientY: 730 })); });
    await tick(100);
    expect(played).toBe(0);
    expect(useStore.getState().ftue.tours).not.toContain('yazi');
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
  it('Takım Ligi tanıtımı atlanınca yalnız o geçilir (1.1.0); kayıt yeniden yüklenince de; Mağaza ve Takım Akışı sırayla gelir', async () => {
    screen();
    const { veteranTours } = await import('./features'); const { startTour } = await import('./Director'); const { useCoach } = await import('./Coach');
    const { useStore } = await import('../store'); const { mapIntroQueue } = await import('./map-intro');
    await player(6, veteranTours(5));
    expect(mapIntroQueue(6, useStore.getState().ftue)).toEqual(['tlig', 'shop', 'akis']);
    map('bitti');
    await director('map');
    await act(async () => { startTour('tlig', 'map'); });
    await tick(500);
    await act(async () => { (document.querySelector('.cp-skip') as HTMLElement).click(); });
    expect(useCoach.getState().tour).toBeNull();
    expect(useStore.getState().ftue.tours).toContain('tlig');
    for (const id of ['shop', 'akis']) expect(useStore.getState().ftue.tours).not.toContain(id);
    // yeni oturum: bellek sıfır, kayıt (odi-v1) yeniden yüklenir
    const { platformStorage } = await import('../platform');
    const kayit = await platformStorage.getItem('odi-v1');
    expect(kayit).toContain('"tlig"');
    await act(async () => { root?.unmount(); }); root = null;
    useStore.setState({ ftue: { v: 1, story: true, tours: [] }, progress: {} });
    await platformStorage.setItem('odi-v1', kayit!);
    await useStore.persist.rehydrate();
    const f = useStore.getState().ftue;
    expect(f.tours).toContain('tlig');
    expect(mapIntroQueue(6, f)).toEqual(['shop', 'akis']);
    map('bitti');
    await director('map');
    await tick(1600);
    expect(await tourId()).toBe('shop');
    // sonraki bölümde açılan yer bekleyenlerin arkasında; atlanan gelmez
    expect(mapIntroQueue(7, f)).toEqual(['shop', 'akis', 'events']);
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
    expect(pendingTours('camp', 4, ['result1', 'map', 'today'])).toEqual(['camp-build', 'gorev']); // açılım tanıtımları tek tek (1.1.0)
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

  it('sınır yok (1.1.0): bekleyen eski tanıtım ve bu geçişin hepsi sözde, haritada sırayla gelir', async () => {
    const { veteranTours } = await import('./features'); const { useStore } = await import('../store'); const { useCoach } = await import('./Coach');
    const { mapIntroQueue } = await import('./map-intro');
    // Takım Akışı Bölüm 6'dan beri bekliyor: önce o, sonra Canlı yarış ve Serbest yazı
    await player(8, veteranTours(7).filter((id) => id !== 'akis'));
    const q = mapIntroQueue(8, useStore.getState().ftue);
    expect(q).toEqual(['akis', 'race', 'yazi']);
    await director('result');
    dokun();
    map('bitti');
    await director('map');
    await tick(1100);
    expect(await tourId()).toBe('akis');
    for (const id of ['race', 'yazi']) {
      await act(async () => { useCoach.getState().end(false); });
      await tick(1100);
      expect(await tourId()).toBe(id);
    }
    await act(async () => { useCoach.getState().end(false); });
    await tick(3200);
    expect(await tourId()).toBeNull();
    for (const id of q) expect(useStore.getState().ftue.tours).toContain(id);
  }, 25_000);
});
