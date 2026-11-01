// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const spoken: (string | undefined)[] = [];
vi.mock('./voice', () => ({ speakLine: (_t: string, id?: string) => { spoken.push(id); return spoken.length; }, stopVoice: () => undefined, prefetchLines: () => undefined, stopVoiceIf: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined } }));

/**
 * Oyuncu testi tur 2 (YN-067): haritaya dönüşte pencere sırası.
 *  - Bir anda tek etkileşimli katman: kutlama (sandık, bölge canlandı) açılınca tur duraklar, kapanınca aynı adımdan sürer;
 *    kutlamanın içini gösteren adım (bugünün sandığı) duraklamaz.
 *  - "Profil'e dokun" ancak Profil gerçekten açılınca ilerler; üstü örtülü hedefe giden dokunuş adımı ilerletmez.
 *  - Gösterdiği yer ekranda yoksa panel üste çıkar ve ekranı kilitlemez (alt menü erişilebilir).
 *  - Kapanmış Günün Sorusu'na "Bir şık seç" denmez; oyuncunun kendi açtığı Sözlük/Arkadaşlar turu sonradan gelmez.
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
  const { useCoach } = await import('./Coach'); const { useCelebrating } = await import('../celebrate');
  await act(async () => { useCoach.getState().end(true); useCelebrating.setState({ on: false }); root?.unmount(); });
  root = null; document.body.innerHTML = ''; spoken.length = 0;
});
const tick = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const el = (tag: string, cls: string, r: [number, number, number, number]) => { const d = document.createElement(tag); d.className = cls; d.getBoundingClientRect = () => new DOMRect(...r); return d; };
async function host() {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  const { CoachHost } = await import('./Coach');
  const h = document.createElement('div'); document.body.appendChild(h);
  root = createRoot(h);
  await act(async () => { root!.render(createElement(CoachHost)); });
}
const panel = () => document.querySelector('[data-testid="anlatici"]');

describe('tek etkileşimli katman: kutlama sürerken tur duraklar', () => {
  it('kutlama açılınca anlatıcı kaybolur, kapanınca aynı adım yeniden görünür', async () => {
    await host();
    const { useCoach } = await import('./Coach'); const { useCelebrating } = await import('../celebrate');
    await act(async () => { useCoach.getState().start({ id: 'deneme', steps: [{ id: 'harita-01', say: 'Bir' }, { id: 'harita-02', say: 'İki' }] }); });
    expect(panel()?.getAttribute('data-say')).toBe('Bir');
    await act(async () => { useCelebrating.setState({ on: true }); });
    expect(document.querySelector('[data-testid="anlatici-tur"]')).toBeNull(); // arkadaki pencerenin düğmesi soluk kalmaz
    expect(useCoach.getState().step).toBe(0);
    await act(async () => { useCelebrating.setState({ on: false }); });
    expect(panel()?.getAttribute('data-say')).toBe('Bir');
    expect(spoken).toEqual(['harita-01', 'harita-01']);
  }, 30_000);
  it('kutlamanın içini gösteren adım (bugünün sandığı) duraklamaz', async () => {
    await host();
    const { useCoach } = await import('./Coach'); const { useCelebrating } = await import('../celebrate'); const { tourFor } = await import('./Director');
    const st = tourFor('today', 'today')!.steps.find((s) => s.id === 'bugun-03')!;
    expect(st.cel).toBe(true);
    await act(async () => { useCelebrating.setState({ on: true }); useCoach.getState().start({ id: 'deneme', steps: [{ id: 'bugun-03', say: 'Topla', cel: true }] }); });
    expect(panel()?.getAttribute('data-say')).toBe('Topla');
  }, 30_000);
});

describe('"Profil’e dokun" Profil açılmadan ilerlemez', () => {
  it('sekme adımı ancak sekme açılınca (aria-current) ilerler', async () => {
    await host();
    const { useCoach } = await import('./Coach'); const { tourFor } = await import('./Director');
    const nav = el('nav', 'tabbar', [0, 780, 390, 64]); const btn = el('button', 'tab', [300, 784, 70, 56]); btn.dataset.tab = 'profile'; nav.appendChild(btn); document.body.appendChild(nav);
    const t = tourFor('friends', 'map')!;
    expect(t.steps.map((s) => s.id)).toEqual(['arkadas-01', 'sekme-profil', 'arkadas-02']);
    await act(async () => { useCoach.getState().start({ ...t, steps: t.steps.slice(1) }); });
    await tick(300);
    expect(panel()?.getAttribute('data-say')).toMatch(/Profil/);
    // dokunuş yutuldu (sekme açılmadı): adım yerinde
    await act(async () => { btn.click(); });
    await tick(800);
    expect(useCoach.getState().step).toBe(0);
    // Profil açıldı: ilerler
    btn.setAttribute('aria-current', 'page');
    await tick(800);
    expect(useCoach.getState().step).toBe(1);
  }, 30_000);
  it('"dokun" adımında hedefi örten katmana giden dokunuş adımı ilerletmez', async () => {
    await host();
    const { useCoach } = await import('./Coach');
    const target = el('button', 'map-play', [100, 700, 190, 56]); document.body.appendChild(target);
    const cover = el('div', 'cel-stage', [0, 0, 390, 844]); document.body.appendChild(cover);
    await act(async () => { useCoach.getState().start({ id: 'deneme', steps: [{ id: 'harita-04', say: 'Bölüme dokun', target: '.map-play', wait: 'tap' }, { id: 'harita-01', say: 'Son' }] }); });
    await tick(300);
    await act(async () => { cover.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 190, clientY: 720 })); });
    await tick(200);
    expect(useCoach.getState().step).toBe(0);
    await act(async () => { target.click(); });
    await tick(200);
    expect(useCoach.getState().step).toBe(1);
  }, 30_000);
  it('gösterdiği yer ekranda yoksa panel üste çıkar, ekran kilitlenmez', async () => {
    await host();
    const { useCoach } = await import('./Coach');
    await act(async () => { useCoach.getState().start({ id: 'deneme', steps: [{ id: 'sozluk-02', say: 'Sözlük burada', target: '.menu-tile[data-tile="glossary"]', wait: { el: '[data-testid="sozluk"]' }, hint: 'Sözlüğe dokun' }] }); });
    await tick(6300); // halka gelmedi: yazı yine de çıkar
    expect(panel()?.className).toMatch(/\btop\b/);
    expect(document.querySelector('.coach-block')).toBeNull();
  }, 30_000);
});

describe('Günün Sorusu ve görülmüş yerler', () => {
  it('kapanmış soruda soru-02 konuşmadan geçilir; açık soruda söylenir', async () => {
    await host();
    const { useCoach } = await import('./Coach'); const { tourFor } = await import('./Director');
    const card = (open: boolean) => { const c = el('div', 'fcard t-soru', [10, 200, 370, 300]); c.dataset.testid = 'gunun-sorusu'; const b = el('button', 'dq-opt', [20, 260, 340, 44]); (b as HTMLButtonElement).disabled = !open; c.appendChild(b); document.body.appendChild(c); return c; };
    const soru = tourFor('soru', 'team')!.steps.find((s) => s.id === 'soru-02')!;
    card(false);
    await act(async () => { useCoach.getState().start({ id: 'deneme', steps: [soru] }); });
    await tick(1800);
    expect(spoken).not.toContain('soru-02');
    expect(useCoach.getState().tour).toBeNull();
    document.body.querySelectorAll('.fcard').forEach((c) => c.remove());
    card(true);
    await act(async () => { useCoach.getState().start({ id: 'deneme2', steps: [soru] }); });
    await tick(400);
    expect(spoken).toContain('soru-02');
  }, 30_000);
  it('oyuncu Sözlük’ü ya da Arkadaşlar’ı kendi açtıysa turu sonradan gelmez', async () => {
    const { visitedTours } = await import('./Director');
    expect(visitedTours('glossary', 4, ['result1', 'map'], [null])).toEqual(['glossary']);
    expect(visitedTours('friends', 4, ['result1', 'map'], [null])).toEqual(['friends']);
    expect(visitedTours('glossary', 3, [], [null])).toEqual([]); // henüz açılmadı
    expect(visitedTours('glossary', 4, [], ['glossary'])).toEqual([]); // şimdi başlayan tur
  }, 30_000);
});
