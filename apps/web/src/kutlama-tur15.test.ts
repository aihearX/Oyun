// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined, duck: () => undefined } }));

/**
 * Oyuncu testi tur 15:
 *  - YN-261 / YN-216: "yeniden canlandı" sahnesinde bölge adı koyu plakada, tek öğe (tek satır); Yüksek görünürlük ya da hareketi
 *    azalt açıkken parlama koyu (OT-buyuk-yazi-73).
 *  - YN-260 (3): hazine penceresi açıkken jeton hesaba geçerse not güncellenir; pencere kapanınca dinleme biter (OT-eski-telefon-46).
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
afterEach(async () => { await act(async () => { root?.unmount(); }); root = null; document.body.innerHTML = ''; });
const tick = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
async function mount() {
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext; // jsdom: tuval yok
  const { CelebrationLayer } = await import('./celebrate/CelebrationLayer'); const { celebrate } = await import('./celebrate');
  const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h);
  await act(async () => { root!.render(createElement(CelebrationLayer, { toasts: false })); });
  return celebrate;
}

describe('bölge canlandı sahnesi (YN-261, YN-216)', () => {
  it('uzun ad tek plakada (kırılmaz), "yeniden canlandı!" ayrı; hareketi azaltta parlama koyu', async () => {
    const celebrate = await mount();
    let done = false;
    await act(async () => { void celebrate.biomeRestored({ biome: 'koklea-2', name: 'Koklea · Orta Kıvrım' }).then(() => { done = true; }); });
    await tick(400);
    const name = document.querySelector('[data-testid="kutlama-bolge"]');
    expect(name?.children).toHaveLength(1);
    expect(name?.textContent).toBe('Koklea · Orta Kıvrım');
    expect(document.querySelector('.bm-sub')?.textContent).toBe('yeniden canlandı!');
    expect(document.querySelector('.cel-back.biome')?.classList.contains('dim')).toBe(true);
    await act(async () => { (document.querySelector('.cel-cta .btn') as HTMLElement).click(); });
    await tick(50);
    expect(done).toBe(true);
  });
});

describe('hazine penceresi: not bağlantıdan sonra güncellenir (YN-260 (3))', () => {
  it('live ile gelen not pencerede yazar; pencere kapanınca dinleme biter', async () => {
    const celebrate = await mount();
    let push: ((v: { note: string }) => void) | null = null; let stopped = 0;
    const live = (set: (v: { note: string }) => void) => { push = set; return () => { stopped++; }; };
    let done = false;
    await act(async () => { void celebrate.chest({ title: 'Hazine · Bölüm 5', granted: true, note: 'Jetonu bağlanınca cüzdanına eklenecek', items: [{ kind: 'jeton', amount: 50 }, { kind: 'xp', amount: 20 }], live }).then(() => { done = true; }); });
    await tick(1200); // sandık evreleri (hareketi azaltta kısa) → toplama evresi
    expect(document.querySelector('.cel-note')?.textContent).toBe('Jetonu bağlanınca cüzdanına eklenecek');
    await act(async () => { push!({ note: 'Cüzdanına eklendi' }); });
    expect(document.querySelector('.cel-note')?.textContent).toBe('Cüzdanına eklendi');
    expect(document.querySelector('.cel-stage')?.textContent).not.toMatch(/bağlanınca/);
    await act(async () => { (document.querySelector('.cel-cta .btn') as HTMLElement).click(); });
    await tick(50);
    expect(done).toBe(true); expect(stopped).toBe(1);
  });
  it('birikmiş pencerenin notu da güncellenir', async () => {
    const celebrate = await mount();
    let push: ((v: string) => void) | null = null; let stopped = 0;
    let done = false;
    await act(async () => { void celebrate.recap({ title: 'Yolda kazandıkların', sub: '3 hazine', rows: [{ icon: '🎁', text: 'Hazine · Bölüm 5' }], note: 'Hazine jetonu bağlanınca cüzdanına eklenecek', live: (set) => { push = set; return () => { stopped++; }; } }).then(() => { done = true; }); });
    await tick(300);
    await act(async () => { push!('Hazine jetonu cüzdanına eklendi'); });
    expect(document.querySelector('.cel-note')?.textContent).toBe('Hazine jetonu cüzdanına eklendi');
    await act(async () => { (document.querySelector('.cel-cta .btn') as HTMLElement).click(); });
    await tick(50);
    expect(done).toBe(true); expect(stopped).toBe(1);
  });
});
