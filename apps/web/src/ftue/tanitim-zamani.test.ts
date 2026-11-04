// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('./voice', () => ({ speakLine: () => 0, stopVoice: () => undefined, prefetchLines: () => undefined, stopVoiceIf: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined } }));
vi.mock('../net', () => ({ act: async () => null, toast: () => undefined }));

/**
 * Oyuncu testi tur 9 (YN-157): Tüy Dede tanıtımlarının zamanı ve yeri.
 *  - Sonuç ekranı "Tüy Dede haritada anlatacak" dedi, oyuncu "Haritaya dön"e bastı ve dokunmadı: söz verilen tanıtım dönüş sahnesi
 *    biter bitmez gelir (oyuncu okuyup bir yere uzanırken değil); birden çok söz art arda. Oyuncu dokunduysa sakinlik kuralı.
 *  - Genel açılım turları Bugün/Takım'da kendiliğinden başlamaz; oyuncu haritaya dönünce başlar.
 *  - Vaka çözmüş oyuncuya kampta Hasta Vakaları "yeni" denmez.
 *  - Tüy Dede'nin kamp notu (yeni anıt) açıkken "Kamp'ta yeni" kartı görünmez; not kapanınca gelir.
 *  - tlig-02: onaylı satır aynı, balonda Lig'in yolu.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
afterEach(async () => {
  const { useCoach } = await import('./Coach'); const { useStore } = await import('../store'); const { hideKampYeni } = await import('./KampYeni');
  const { unlockTally } = await import('./map-intro'); const { useKg } = await import('../camp/gorev/state');
  await act(async () => { useCoach.setState({ tour: null, step: 0 }); hideKampYeni(); root?.unmount(); });
  useStore.setState({ ftue: { v: 1, story: true, tours: [] }, progress: {} });
  useKg.setState({ kg: null, vaka: null });
  Object.assign(unlockTally, { cleared: -1, genel: 0, kamp: 0 });
  root = null; document.body.innerHTML = '';
});
const tick = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
/** oyuncunun ekrana dokunuşu (basma + bırakma) */
const tap = () => { document.dispatchEvent(new Event('pointerdown')); document.dispatchEvent(new Event('pointerup')); };
const tourId = async () => (await import('./Coach')).useCoach.getState().tour?.id ?? null;

/** 6. bölümü yeni geçmiş oyuncu: sonuç "Yeni: Takım Ligi ve Mağaza" der (ikisi de haritada anlatılacak) */
async function at6() {
  const { useStore } = await import('../store'); const { veteranTours } = await import('./features');
  const progress: Record<number, { stars: number }> = {}; for (let i = 1; i <= 6; i++) progress[i] = { stars: 3 };
  useStore.setState({ ftue: { v: 1, story: true, tours: veteranTours(5) }, progress: progress as never });
}
async function director(route: string) {
  const { FtueDirector } = await import('./Director');
  if (!root) { const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h); }
  await act(async () => { root!.render(createElement(FtueDirector, { route })); });
}
/** haritanın dönüş sahnesi (yıldızlar, bölge canlanması); `bitti` olunca harita sakin */
function mapScreen(donus: string) {
  let m = document.querySelector('.map-screen') as HTMLElement | null;
  if (!m) { m = document.createElement('div'); m.className = 'map-screen'; document.body.appendChild(m); }
  m.dataset.donus = donus;
}

describe('sonuçtan haritaya dönüş: söz verilen tanıtım hemen', () => {
  it('dokunmayan oyuncuda tanıtım dönüş sahnesi biter bitmez (≤ ~1 sn) başlar; ikinci söz art arda', async () => {
    await at6();
    await director('result');
    tap(); // "Haritaya dön"
    mapScreen('oynuyor');
    await director('map');
    await tick(2200);
    expect(await tourId()).toBeNull(); // dönüş sahnesi sürerken tur yok
    await act(async () => { mapScreen('bitti'); });
    await tick(1050);
    expect(await tourId()).toBe('tlig');
    const { useCoach } = await import('./Coach');
    await act(async () => { useCoach.getState().end(false); });
    await tick(1050);
    expect(await tourId()).toBe('shop');
  }, 15_000);

  it('oyuncu haritada dokunmaya başladıysa sakinlik kuralı (son dokunuştan 1,2 sn + sakin yoklamalar)', async () => {
    await at6();
    await director('result');
    tap();
    mapScreen('oynuyor');
    await director('map');
    await tick(1200);
    await act(async () => { mapScreen('bitti'); tap(); });
    await tick(1050);
    expect(await tourId()).toBeNull();
    await tick(2000);
    expect(await tourId()).toBe('tlig');
  }, 15_000);
});

describe('takma ad penceresinden sonra söz verilen harita turu hemen (YN-196, OT-ilk-kez-oyun-59)', () => {
  /** 1. bölümü yeni geçmiş oyuncu: sonuç turu bitti, "Haritaya git" harita turunu söz verdi */
  async function at1() {
    const { useStore } = await import('../store');
    useStore.setState({ ftue: { v: 1, story: true, tours: ['result1'] }, progress: { 1: { stars: 2 } } as never });
  }
  /** haritanın üstünde takma ad penceresi (Onboarding.tsx: .overlay.onboard-wrap > .onboard) */
  function adPenceresi() {
    const w = document.createElement('div'); w.className = 'overlay onboard-wrap';
    w.innerHTML = '<form class="card onboard" role="dialog" aria-modal="true"><input aria-label="Takma ad"><button>Başla</button></form>';
    document.body.appendChild(w); return w;
  }
  /** pencere içindeki dokunuş ve yazı (ad, renk, Başla) */
  const icindeDokun = (el: Element) => { for (const t of ['pointerdown', 'pointerup']) el.dispatchEvent(new Event(t, { bubbles: true })); el.dispatchEvent(new Event('keydown', { bubbles: true })); };
  async function haritaVePencere() {
    await at1();
    await director('result');
    tap(); // "Haritaya git"
    mapScreen('bitti');
    const play = document.createElement('button'); play.className = 'map-play'; document.body.appendChild(play);
    const w = adPenceresi();
    await director('map');
    await tick(2200);
    expect(await tourId()).toBeNull(); // pencere açıkken tur yok
    await act(async () => { icindeDokun(w.querySelector('input')!); });
    await tick(600);
    await act(async () => { icindeDokun(w.querySelector('button')!); });
    return w;
  }
  it('ad yazılıp "Başla"ya basılınca pencere kapanır kapanmaz (≤ ~1 sn) harita turu başlar; araya dokunuş gerekmez', async () => {
    const w = await haritaVePencere();
    await act(async () => { w.remove(); });
    await tick(1050);
    expect(await tourId()).toBe('map');
  }, 15_000);
  it('pencere kapandıktan sonra haritada dokunan oyuncuda yine sakinlik kuralı (dokunuş yutulmaz)', async () => {
    const w = await haritaVePencere();
    await act(async () => { w.remove(); tap(); });
    await tick(1050);
    expect(await tourId()).toBeNull();
  }, 15_000);
});

describe('söz verilen ikinci tur, ilki oyuncuyu başka sekmeye götürdüyse', () => {
  /** sonuçtan haritaya dönüş; Takım Ligi turu başlar, "Takım'a dokun" adımıyla Takım sekmesi açılır, tur biter */
  async function tligToTeam() {
    await at6();
    await director('result');
    tap();
    mapScreen('bitti');
    await director('map');
    await tick(1050);
    expect(await tourId()).toBe('tlig');
    await director('team');
    await tick(600); // tlig-02: Lig sekmesi gösteriliyor
    const { useCoach } = await import('./Coach');
    await act(async () => { useCoach.getState().end(false); });
  }
  it('oyuncu araya dokunmadıysa ikinci tur orada hemen başlar', async () => {
    await tligToTeam();
    await tick(1050);
    expect(await tourId()).toBe('shop');
  }, 15_000);
  it('oyuncu dokunduysa (ör. "Arkadaşlar"a uzandı) Takım ekranında başlamaz; haritaya dönünce başlar', async () => {
    await tligToTeam();
    tap();
    await tick(3200);
    expect(await tourId()).toBeNull();
    await director('map');
    await tick(2200);
    expect(await tourId()).toBe('shop');
  }, 15_000);
});

describe('genel açılım turları yalnız haritada', () => {
  for (const tab of ['today', 'team']) {
    it(`${tab} sekmesinde başlamaz, haritaya dönünce başlar`, async () => {
      await at6();
      await director(tab);
      await tick(3200);
      expect(await tourId()).toBeNull();
      mapScreen('bitti');
      await director('map');
      await tick(2200);
      expect(await tourId()).toBe('tlig');
    }, 15_000);
  }
});

describe('vaka çözmüş oyuncuya Hasta Vakaları "yeni" değil', () => {
  it('campQueue: vaka çözüldüyse vaka (ve "önce kur") yok', async () => {
    const { campQueue } = await import('./Director');
    expect(campQueue(7, [], 'acik', true)).toEqual(['gorev', 'kampoyun']);
    expect(campQueue(7, ['gorev'], 'acik', true)).toEqual(['kampoyun']);
    expect(campQueue(7, ['gorev', 'kampoyun'], 'kur', true)).toEqual([]);
    expect(campQueue(7, ['gorev', 'vaka-kur'], 'acik')).toEqual(['kampoyun', 'vaka']);
    // klinik "önce kur" yazısı gelmeden kurulduysa oyuncu kliniği kendisi kurmuş: "yeni" değil (YN-208)
    expect(campQueue(7, ['gorev'], 'acik')).toEqual(['kampoyun']);
  });
  it('vakaCozuldu: kamp görevleri özetindeki Vaka Defteri başarısı ya da defterdeki çözülmüş vaka', async () => {
    const { vakaCozuldu } = await import('./Director'); const { useKg } = await import('../camp/gorev/state');
    expect(vakaCozuldu()).toBe(false);
    useKg.setState({ kg: { achievements: [{ id: 'b-defter', progress: 0 }] } as never });
    expect(vakaCozuldu()).toBe(false);
    useKg.setState({ kg: { achievements: [{ id: 'b-defter', progress: 2 }] } as never });
    expect(vakaCozuldu()).toBe(true);
    useKg.setState({ kg: null, vaka: { book: [{ id: 'v1', stars: 2, plays: 1, solvedAt: 1, tests: 3 }] } as never });
    expect(vakaCozuldu()).toBe(true);
  });
});

describe('kamp notu ile "Kamp\'ta yeni" kartı sırayla', () => {
  it('yeni anıt notu açıkken kart görünmez; not kapanınca gelir', async () => {
    const { KampYeniKart, showKampYeni } = await import('./KampYeni');
    const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h);
    const note = document.createElement('aside'); note.setAttribute('data-testid', 'kamp-dede'); note.setAttribute('data-line', ''); document.body.appendChild(note);
    await act(async () => { root!.render(createElement(KampYeniKart, { onShow: () => undefined, calm: () => true })); showKampYeni(['kampoyun', 'vaka']); });
    await tick(700);
    expect(document.querySelector('[data-testid="kamp-yeni"]')).toBeNull();
    await act(async () => { note.remove(); });
    await tick(400);
    expect(document.querySelector('[data-testid="kamp-yeni"]')?.getAttribute('data-items')).toBe('kampoyun vaka');
  });
});

describe('Takım Ligi tanıtımı: Lig\'in yolu', () => {
  it('tlig-02 adımında "Takım › Rekabet › Lig" notu; satır metni script.ts ile aynı', async () => {
    const { tourFor } = await import('./Director'); const { lineText } = await import('./script');
    const step = tourFor('tlig', 'team')!.steps.find((s) => s.id === 'tlig-02')!;
    expect(step.say).toBe(lineText('tlig-02'));
    expect(step.note?.()).toBe('Takım › Rekabet › Lig');
  });
});
