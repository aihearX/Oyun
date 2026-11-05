// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Timp } from '@odi/content';

const spoken: (string | undefined)[] = [];
vi.mock('./voice', () => ({ speakLine: (_t: string, id?: string) => { spoken.push(id); return spoken.length; }, stopVoice: () => undefined, prefetchLines: () => undefined, stopVoiceIf: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined } }));
vi.mock('../net', () => ({ act: async () => null, toast: () => undefined }));

/**
 * Oyuncu testi tur 14 (YN-234, YN-235):
 *  - "önce Odyometri Odası'nı kur" tanıtımı üs görünümünde: kenarda yarım kalan arsa ortalanır; çerçevenin içine dokunuş tuvale
 *    geçmez (kaydırma sayılmaz), bina penceresini açar; balondaki "Odaya dokun" düğmesi de aynı pencereyi açar (OT-ogrenci-birinci-48).
 *  - Yeni anıt notu ile tanıtım/"Kamp'ta yeni" kartı tek kuyrukta: anıt sıradayken ya da notu yeni kapanmışken tanıtım başlamaz;
 *    rehber turu sürerken Tüy Dede'nin kamp notu görünmez, tur bitince gelir (OT-ilk-kez-oyun-71).
 *  - Günlük süs görevinin "Git"i süsleme kipini ister (liste görünümünde Süsle yok; OT-buyuk-yazi-68).
 *  - Timpanogram: düz (Tip B) eğri kutu kenarına yapışmaz, koyu kenar çizgisi var; Büyük yazıda eksen yazıları büyür (OT-buyuk-yazi-72).
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
if (typeof globalThis.DOMRect === 'undefined') {
  (globalThis as { DOMRect?: unknown }).DOMRect = class {
    constructor(public x = 0, public y = 0, public width = 0, public height = 0) {}
    get left() { return this.x; } get top() { return this.y; } get right() { return this.x + this.width; } get bottom() { return this.y + this.height; }
  };
}
type KampHook = { pos(id: string): { x: number; y: number } | null; box(id: string): { x: number; y: number; w: number; h: number } | null; focus(id: string): void };
let root: Root | null = null;
afterEach(async () => {
  const { useCoach } = await import('./Coach'); const { useStore } = await import('../store'); const { hushDede } = await import('../camp/dede');
  const { useKampIstek } = await import('../camp/istek');
  await act(async () => { useCoach.getState().end(false); hushDede(); root?.unmount(); });
  useStore.setState({ ftue: { v: 1, story: true, tours: [] } }); useKampIstek.setState({ bina: null, susle: false });
  delete (window as unknown as { __kamp?: KampHook }).__kamp;
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
/** üs görünümü: üst gösterge 0–130, alt kartlar 700'den; Odyometri Odası'nın arsası verilen çerçevede (kamera odaklanınca ortaya gelir) */
function campBase(box: { x: number; y: number; w: number; h: number }) {
  const base = el('div', { class: 'camp-base' }, [0, 0, 390, 844]);
  base.appendChild(el('div', { class: 'camp-top' }, [0, 0, 390, 130])); base.appendChild(el('div', { class: 'camp-bottom' }, [0, 700, 390, 144]));
  document.body.appendChild(base);
  const focused: string[] = []; let b = { ...box };
  const hook: KampHook = { pos: () => ({ x: b.x + b.w / 2, y: b.y + 58 }), box: () => b, focus: (id) => { focused.push(id); b = { x: 149, y: 360, w: 92, h: 92 }; } };
  (window as unknown as { __kamp?: KampHook }).__kamp = hook;
  return { base, focused };
}

describe('"önce Odyometri Odası’nı kur" üs görünümünde (OT-ogrenci-birinci-48)', () => {
  it('ekranın sol kenarında yarım kalan arsa ortalanır; ekranda tam görünen arsada kamera kaymaz', async () => {
    screen();
    const { tourFor } = await import('./Director');
    const a = campBase({ x: -34, y: 218, w: 92, h: 92 });
    tourFor('oyun-kur', 'camp')!.steps[0]!.enter!();
    expect(a.focused).toEqual(['laboratuvar']);
    document.body.innerHTML = '';
    const b = campBase({ x: 150, y: 300, w: 92, h: 92 });
    tourFor('oyun-kur', 'camp')!.steps[0]!.enter!();
    expect(b.focused).toEqual([]);
  });
  it('çerçevenin içine dokunuş tuvale geçmez, bina penceresini ister; "Odaya dokun" düğmesi de aynı isteği yapar', async () => {
    screen();
    const { tourFor } = await import('./Director'); const { CoachHost, useCoach } = await import('./Coach'); const { useKampIstek } = await import('../camp/istek');
    const { base } = campBase({ x: 149, y: 360, w: 92, h: 92 });
    let tuval = 0; const canvas = el('canvas', {}, [0, 0, 390, 844]); canvas.addEventListener('click', () => { tuval++; }); base.appendChild(canvas);
    await render(createElement(CoachHost));
    const t = tourFor('oyun-kur', 'camp')!;
    expect(t.steps[0]).toMatchObject({ hint: 'Odaya dokun', wait: 'tap' });
    expect(typeof t.steps[0]!.act).toBe('function');
    await act(async () => { useCoach.getState().start(t); });
    await tick(600); // halka yerine oturur (kamera durdu), açılış anı geçer
    const hint = document.querySelector('[data-testid="anlatici-ipucu"]')!;
    expect(hint.tagName).toBe('BUTTON');
    expect(hint.textContent).toContain('Odaya dokun');
    await act(async () => { (hint as HTMLButtonElement).click(); });
    expect(useKampIstek.getState().bina).toBe('laboratuvar');
    useKampIstek.setState({ bina: null });
    const hedef = document.querySelector('[data-testid="anlatici-hedef"]') as HTMLButtonElement;
    expect(hedef).not.toBeNull();
    await act(async () => { hedef.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 195, clientY: 400 })); });
    expect(useKampIstek.getState().bina).toBe('laboratuvar');
    expect(tuval).toBe(0);
  });
  it('liste görünümünde dokunuş karta geçer (Kur), yönerge yazı olarak kalır', async () => {
    screen();
    const { tourFor } = await import('./Director');
    document.body.appendChild(el('div', { class: 'camp-list-screen' }, [0, 0, 390, 844]));
    const st = tourFor('oyun-kur', 'camp')!.steps[0]!;
    expect(st.act).toBeUndefined();
    expect(st.hint).toBe('Kur’a dokun');
  });
});

describe('anıt notu ile tanıtım tek kuyrukta (OT-ilk-kez-oyun-71)', () => {
  it('anıt kutlaması sıradayken ya da notu yeni kapanmışken (oyuncu kampa dokunmadı) tanıtım başlamaz', async () => {
    const { quiet } = await import('./Director');
    const base = el('div', { class: 'camp-base' }, [0, 0, 390, 844]); document.body.appendChild(base);
    expect(quiet()).toBe(true);
    base.setAttribute('data-anit', 'bekliyor'); expect(quiet()).toBe(false);
    base.setAttribute('data-anit', 'goruldu'); expect(quiet()).toBe(false);
    base.removeAttribute('data-anit'); expect(quiet()).toBe(true);
  });
  it('rehber turu sürerken Tüy Dede’nin kamp notu görünmez ve konuşmaz; tur bitince bir kez konuşarak gelir', async () => {
    const { DedeCard, sayDede } = await import('../camp/dede'); const { useCoach } = await import('./Coach');
    await render(createElement(DedeCard));
    await act(async () => { useCoach.getState().start({ id: 'oyun-kur', steps: [{ say: 'Önce kur' }] }); });
    await act(async () => { sayDede('anit-zar', 'Yeni anıt · Üç Kemikçik Anıtı', 'Çekiç, örs ve üzengi.'); });
    expect(document.querySelector('[data-testid="kamp-dede"]')).toBeNull();
    expect(spoken).toEqual([]);
    await act(async () => { useCoach.getState().end(false); });
    expect(document.querySelector('[data-testid="kamp-dede"]')?.textContent).toContain('Yeni anıt');
    expect(spoken).toEqual(['anit-zar']);
  });
});

describe('günlük süs görevi: Git süsleme kipini açar (OT-buyuk-yazi-68)', () => {
  it('"Kampına bir süs yerleştir" › Git paneli kapatır ve süsleme kipini ister', async () => {
    const { gorevGit } = await import('../camp/gorev/GorevPanel'); const { useKg } = await import('../camp/gorev/state'); const { useKampIstek } = await import('../camp/istek');
    useKg.setState({ panel: { kind: 'gorev', tab: 'gunluk' } as never });
    const nav = { tab: vi.fn(), open: vi.fn() };
    const g = gorevGit('g-dekor');
    expect(g.label).toBe('Git');
    g.go(nav as never);
    expect(useKg.getState().panel).toBeNull();
    expect(useKampIstek.getState().susle).toBe(true);
    expect(nav.tab).not.toHaveBeenCalled();
  });
});

describe('timpanogram Büyük yazıda okunur (OT-buyuk-yazi-72)', () => {
  it('düz (Tip B) eğri kutunun alt kenarına yapışmaz; her eğrinin altında koyu kenar çizgisi', async () => {
    const { TimpanogramSvg } = await import('../camp/gorev/charts');
    const B: Timp = { tip: 'B', uyum: 0.1, basinc: null, hacim: 0.9 } as unknown as Timp;
    const svg = renderToStaticMarkup(createElement(TimpanogramSvg, { R: B, L: B }));
    const egri = [...svg.matchAll(/<path class="kg-egri" d="([^"]+)"/gu)].map((m) => m[1]!);
    expect(egri.length).toBe(2);
    expect([...svg.matchAll(/class="kg-egri-kenar"/gu)].length).toBe(2);
    const ys = egri[0]!.split(/[ML]/u).filter(Boolean).map((p) => Number(p.trim().split(' ')[1]));
    // kutunun alt kenarı y=168; düz eğri en az 8 birim yukarıda
    expect(Math.max(...ys)).toBeLessThan(160);
  });
  it('Büyük yazıda eksen yazıları kök ölçeğin ötesinde büyür, eğri kalınlaşır; seçili test tikle ve kalın çerçeveyle belli', () => {
    const css = readFileSync(resolve(__dirname, '../camp/gorev/gorev.css'), 'utf8');
    expect(css).toMatch(/html\.buyuk-yazi \.kg-ax \{ font-size:0\.8125rem; \}/u);
    expect(css).toMatch(/html\.buyuk-yazi \.kg-timp:not\(\.mini\) \.kg-egri \{ stroke-width:3\.8; \}/u);
    expect(css).toMatch(/\.kg-test\.on \{ border:3px solid/u);
    const src = readFileSync(resolve(__dirname, '../camp/gorev/Klinik.tsx'), 'utf8');
    expect(src).toContain('aria-pressed={on}');
    expect(src).toContain('<Icon name="check"');
    expect(src).toContain(', seçildi');
  });
});
