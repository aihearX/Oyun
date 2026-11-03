// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { MyProfile } from '@odi/shared';

vi.mock('./voice', () => ({ speakLine: () => 0, stopVoice: () => undefined, prefetchLines: () => undefined, stopVoiceIf: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined } }));

/**
 * Oyuncu testi tur 8 (YN-150): Tüy Dede'nin tanıtımı haberlerin üstüne binmez.
 *  - Haritanın "Hedefe ulaştın!" kutusu görünürken yönetmen tur başlatmaz (quiet false); kutu sıradaki hedefe dönünce başlar
 *    (OT-sessiz-oyuncu-20: "Yeni yer açıldı" kartı kutunun tam üstüne açılıyordu).
 *  - Arkadaşlar tanıtımında ("Arkadaş kodunu paylaş") kod balonda da yazar; onaylı satırın metni aynı (OT-sessiz-oyuncu-21).
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
  const { useCoach } = await import('./Coach');
  await act(async () => { useCoach.getState().end(true); root?.unmount(); });
  root = null; document.body.innerHTML = '';
});

describe('hedef kutusu: ulaşılan hedef görünürken tur yok', () => {
  it('"Hedefe ulaştın!" kutusu varken quiet() false, sıradaki hedefe dönünce true', async () => {
    const { quiet } = await import('./Director');
    const map = document.createElement('div'); map.className = 'map-screen'; map.dataset.donus = 'bitti'; document.body.appendChild(map);
    const goal = document.createElement('button'); goal.className = 'map-goal'; goal.dataset.ulasildi = '1'; map.appendChild(goal);
    expect(quiet()).toBe(false);
    delete goal.dataset.ulasildi;
    expect(quiet()).toBe(true);
    // dönüş sahnesi sürerken de yok (önceki kural)
    map.dataset.donus = 'suruyor';
    expect(quiet()).toBe(false);
  });
});

describe('Arkadaşlar tanıtımı: kod balonda', () => {
  it('arkadas-02 adımında arkadaş kodu panelde yazar; satır metni script.ts ile aynı', async () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    const { useNet } = await import('@odi/net/store');
    useNet.setState({ me: { friendCode: 'QEEXFH' } as MyProfile });
    const { tourFor } = await import('./Director'); const { lineText } = await import('./script');
    const step = tourFor('friends', 'profile')!.steps.find((s) => s.id === 'arkadas-02')!;
    expect(step.say).toBe(lineText('arkadas-02'));
    const { CoachHost, useCoach } = await import('./Coach');
    const tile = document.createElement('button'); tile.className = 'menu-tile'; tile.dataset.tile = 'friends';
    tile.getBoundingClientRect = () => new DOMRect(16, 430, 170, 150); document.body.appendChild(tile);
    const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h);
    await act(async () => { root!.render(createElement(CoachHost)); });
    await act(async () => { useCoach.getState().start({ id: 'friends', steps: [step] }); });
    expect(document.querySelector('[data-testid="anlatici"]')?.getAttribute('data-say')).toBe(lineText('arkadas-02'));
    expect(document.querySelector('[data-testid="anlatici-not"]')?.textContent).toBe('Arkadaş kodun: QEEXFH');
    // sunucuya bağlı değilken (kod yok) satır da yok
    await act(async () => { useNet.setState({ me: null }); useCoach.getState().end(true); useCoach.getState().start({ id: 'friends', steps: [step] }); });
    expect(document.querySelector('[data-testid="anlatici-not"]')).toBeNull();
  }, 30_000);
});
