// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const spoken: (string | undefined)[] = [];
vi.mock('./voice', () => ({ speakLine: (_t: string, id?: string) => { spoken.push(id); return spoken.length; }, stopVoice: () => undefined, prefetchLines: () => undefined, stopVoiceIf: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined } }));
vi.mock('../net', () => ({ act: async () => null, toast: () => undefined }));

/**
 * Oyuncu testi tur 12 (YN-208): Tüy Dede tanıtımları.
 *  - "Kamp'ta yeni" kartı oyuncunun kullandığı özelliği saymaz (görev ödülü alındı, klinik kendisi kuruldu, vaka açıldı, kamp oyunu
 *    oynandı); kart bir kez gelir (gösterildiği an kaydedilir, sonraki girişte aynı şeyler yeniden "yeni" değil).
 *  - Takım Akışı tanıtımı Tebrik et'i olan en yeni kartı parlatır; yoksa en yeni kartın tepkilerini, yön notu yalnız tepkiden söz eder.
 *  - Mağaza turu başlığın saydığı üç yeri sırayla gösterir: Ödül kutusu simgesi, Mağaza girişi, Dolap (onaylı satırlar aynı).
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
  const { useKg } = await import('../camp/gorev/state');
  await act(async () => { useCoach.getState().end(false); hideKampYeni(); root?.unmount(); });
  useStore.setState({ ftue: { v: 1, story: true, tours: [] } }); useKg.setState({ kg: null, vaka: null });
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
/** kamp görevleri özeti (yalnız testin baktığı alanlar) */
const kgOzet = (o: { claimed?: number; daily?: boolean; tier?: boolean } = {}) => ({
  story: { chapter: { claimed: false, steps: [{ claimed: false }] }, next: null, claimed: o.claimed ?? 0, total: 6 },
  daily: { tasks: [{ claimed: !!o.daily }], rerollLeft: 1 }, weekly: { tiers: [{ claimed: false }] },
  achievements: [{ id: 'b-defter', progress: 0, tiers: [{ claimed: !!o.tier }] }], oyun: [], takim: null,
});

describe('"Kamp\'ta yeni" kartı kullanılmış özelliği saymaz', () => {
  it('görev ödülü alınmış + klinik kendisi kurulmuş: yalnız gerçekten yeni olan kalır (tek şey: kart yok)', async () => {
    const { campQueue } = await import('./Director');
    // tur 12'deki oyuncu (Bölüm 29): Görevler kullanılmış, klinik kurulu, Odyometri Odası yok
    expect(campQueue(29, [], 'acik', false, 'kur', false, true)).toEqual(['oyun-kur']);
    // oda da kuruluysa yalnız kamp oyunları; oynadıysa hiç
    expect(campQueue(29, [], 'acik', false, 'acik', false, true)).toEqual(['kampoyun']);
    expect(campQueue(29, [], 'acik', false, 'acik', true, true)).toEqual([]);
    // hiçbiri kullanılmamış: üçü de (klinik "önce kur" yazısından sonra kurulduysa asıl tanıtım gelir)
    expect(campQueue(29, ['vaka-kur'], 'acik', false, 'acik')).toEqual(['gorev', 'kampoyun', 'vaka']);
    expect(campQueue(29, [], 'kur', false, 'kur')).toEqual(['gorev', 'oyun-kur', 'vaka-kur']);
  });
  it('gorevAlindi: hikâye, günlük ya da başarı basamağı ödülü alındıysa', async () => {
    const { gorevAlindi } = await import('./Director'); const { useKg } = await import('../camp/gorev/state');
    expect(gorevAlindi()).toBe(false);
    useKg.setState({ kg: kgOzet() as never }); expect(gorevAlindi()).toBe(false);
    useKg.setState({ kg: kgOzet({ claimed: 1 }) as never }); expect(gorevAlindi()).toBe(true);
    useKg.setState({ kg: kgOzet({ daily: true }) as never }); expect(gorevAlindi()).toBe(true);
    useKg.setState({ kg: kgOzet({ tier: true }) as never }); expect(gorevAlindi()).toBe(true);
  });
  it('vakaCozuldu: açılıp oynanmış (henüz çözülmemiş) vaka da sayılır', async () => {
    const { vakaCozuldu } = await import('./Director'); const { useKg } = await import('../camp/gorev/state');
    useKg.setState({ kg: null, vaka: { book: [{ id: 'v1', stars: 0, plays: 0, solvedAt: null, tests: 0 }] } as never });
    expect(vakaCozuldu()).toBe(false);
    useKg.setState({ vaka: { book: [{ id: 'v1', stars: 0, plays: 1, solvedAt: null, tests: 2 }] } as never });
    expect(vakaCozuldu()).toBe(true);
  });
  it('kart bir kez: göründüğü an kaydedilir, Göster açık kalır; sonraki girişte aynı şeyler yeniden "yeni" değil', async () => {
    screen();
    const { KampYeniKart, showKampYeni, kartta } = await import('./KampYeni'); const { campQueue } = await import('./Director'); const { useStore } = await import('../store');
    await render(createElement(KampYeniKart, { onShow: () => undefined, calm: () => true }));
    await act(async () => { showKampYeni(['gorev', 'kampoyun', 'vaka-kur']); });
    expect(useStore.getState().ftue.tours).toEqual([]);
    await tick(500);
    const card = document.querySelector('[data-testid="kamp-yeni"]');
    expect(card?.querySelectorAll('[data-testid="kamp-yeni-goster"]')).toHaveLength(3);
    const tours = useStore.getState().ftue.tours;
    expect(tours).toEqual(['gorev', 'kampoyun', 'vaka-kur'].map(kartta));
    // turların kendisi görülmüş sayılmadı (Göster bu girişte açık), ama sonraki girişte kuyruk boş
    expect(campQueue(7, tours, 'kur', false, 'kur')).toEqual([]);
    // klinik sonradan kurulunca Hasta Vakaları'nın asıl tanıtımı yine bir kez gelir
    expect(campQueue(7, tours, 'acik', false, 'kur')).toEqual(['vaka']);
  });
});

describe('Takım Akışı tanıtımı Tebrik et\'li en yeni kartı gösterir', () => {
  const kart = (type: string, y: number, tebrik: string | null) => {
    const c = el('div', { 'data-testid': 'akis-karti', 'data-type': type }, [10, y, 370, 120]);
    c.appendChild(el('div', { class: 'react-bar' }, [20, y + 80, 200, 30]));
    if (tebrik) { const b = el('button', { 'data-testid': 'tebrik-et' }, [260, y + 80, 110, 30]); b.textContent = tebrik; c.appendChild(b); }
    return c;
  };
  it('eski "Hoş geldin" kartı değil, Tebrik et\'i olan en yeni kart; yön notu Tebrik et\'ten söz eder', async () => {
    const { tourFor } = await import('./Director');
    const st = tourFor('akis', 'team')!.steps.find((s) => s.id === 'akis-02')!;
    const hosgeldin = kart('uye', 100, 'Hoş geldin de'); const eski = kart('bolum', 240, 'Tebrik et'); const yeni = kart('boss', 380, 'Tebrik et'); const kendi = kart('bolum', 520, null);
    document.body.append(hosgeldin, eski, yeni, kendi);
    expect((st.target as () => Element | null)()).toBe(yeni);
    expect(st.note?.()).toBe('Tepki bırak ya da Tebrik et’e dokun');
  });
  it('Tebrik et\'li kart yoksa yalnız tepki: en yeni kartın tepkileri, yön notu yalnız tepki', async () => {
    const { tourFor } = await import('./Director');
    const st = tourFor('akis', 'team')!.steps.find((s) => s.id === 'akis-02')!;
    const hosgeldin = kart('uye', 100, 'Hoş geldin de'); const kendi = kart('bolum', 240, null);
    document.body.append(hosgeldin, kendi);
    expect((st.target as () => Element | null)()).toBe(kendi.querySelector('.react-bar'));
    expect(st.note?.()).toBe('Karta bir tepki bırak');
  });
});

describe('Mağaza turu üç yeri sırayla gösterir', () => {
  it('Ödül kutusu simgesi, Mağaza girişi, Dolap; onaylı satırlar aynı, yeni yazılar seslendirilmez', async () => {
    screen();
    const { tourFor, ODUL_KUTUSU_YERI, MAGAZA_YERI } = await import('./Director'); const { CoachHost, useCoach } = await import('./Coach'); const { lineText } = await import('./script');
    const t = tourFor('shop', 'profile')!;
    expect(t.steps.map((s) => s.id ?? s.say)).toEqual(['magaza-01', ODUL_KUTUSU_YERI, MAGAZA_YERI, 'magaza-02']);
    expect(t.steps[0]!.say).toBe(lineText('magaza-01')); expect(t.steps[3]!.say).toBe(lineText('magaza-02'));
    const top = el('div', { class: 'topbar2' }, [0, 0, 390, 56]); const kutu = el('button', { class: 'pill tb-pill tap ico env' }, [330, 10, 44, 36]); top.appendChild(kutu);
    const magaza = el('button', { class: 'menu-tile', 'data-tile': 'shop' }, [200, 300, 170, 120]);
    const dolap = el('button', { class: 'menu-tile', 'data-tile': 'wardrobe' }, [200, 440, 170, 120]);
    document.body.append(top, magaza, dolap);
    await render(createElement(CoachHost));
    await act(async () => { useCoach.getState().start(t); });
    const ileri = async () => { await tick(500); await act(async () => { (document.querySelector('[data-testid="anlatici-ileri"]') as HTMLElement).click(); }); await tick(80); };
    const ring = () => { const r = document.querySelector('.coach-ring') as HTMLElement | null; return r ? [r.style.left, r.style.top] : null; };
    await ileri();
    expect(document.querySelector('[data-testid="anlatici"]')?.getAttribute('data-say')).toBe(ODUL_KUTUSU_YERI);
    expect(ring()).toEqual(['322px', '2px']);
    await ileri();
    expect(document.querySelector('[data-testid="anlatici"]')?.getAttribute('data-say')).toBe(MAGAZA_YERI);
    expect(ring()).toEqual(['192px', '292px']);
    await ileri();
    expect(document.querySelector('[data-testid="anlatici"]')?.getAttribute('data-say')).toBe(lineText('magaza-02'));
    expect(ring()).toEqual(['192px', '432px']);
    expect(spoken).toEqual(['magaza-01', 'magaza-02']);
  }, 10_000);
});
