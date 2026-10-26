// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('./voice', () => ({ speakLine: () => null, stopVoice: () => undefined, prefetchLines: () => undefined, stopVoiceIf: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined } }));

/**
 * Sıralama turu (sira-03) hata kaydı: React #185 (en fazla güncelleme derinliği). Takımsız / henüz puanı olmayan oyuncuda "benim satırım"
 * ekranın ortasında kalır; anlatıcı paneli altta açılır ve hedefe yaklaştığı için portresini içeri alır (tuck). Portre küçülünce panel
 * yüksekliği değişir → tuck kararı yine değişirdi → sonsuz düzen-etkisi döngüsü. Kararın, panelin tuck'sız yüksekliğiyle verilmesi gerekir.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom'da DOMRect yok (Coach dikdörtgeni instanceof ile tanır)
if (typeof globalThis.DOMRect === 'undefined') {
  (globalThis as { DOMRect?: unknown }).DOMRect = class {
    constructor(public x = 0, public y = 0, public width = 0, public height = 0) {}
    get left() { return this.x; } get top() { return this.y; } get right() { return this.x + this.width; } get bottom() { return this.y + this.height; }
  };
}
let root: Root | null = null;
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('anlatıcı paneli (Coach)', () => {
  it('hedef panel eşiğindeyken portreyi içeri alma kararı döngüye girmez (React #185)', async () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    // panel: portre içerdeyken (tuck) metin daha geniş yer bulur → daha kısa
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('coach-panel') ? (this.classList.contains('tuck') ? 300 : 360) : 0;
    });
    // hedef: ekranın ortasında "benim satırım" (takımsız, puansız oyuncu)
    const target = document.createElement('div'); target.setAttribute('data-testid', 'benim-siram'); document.body.appendChild(target);
    target.getBoundingClientRect = () => new DOMRect(16, 380, 358, 60);

    const { CoachHost, useCoach } = await import('./Coach');
    const errors: unknown[] = [];
    const host = document.createElement('div'); document.body.appendChild(host);
    const spy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => { errors.push(a[0]); });
    root = createRoot(host, { onUncaughtError: (e) => errors.push(e), onCaughtError: (e) => errors.push(e) });
    await act(async () => { root!.render(createElement(CoachHost)); });
    await act(async () => { useCoach.getState().start({ id: 'siralama', steps: [{ id: 'sira-03', say: 'Senin satırın hep en altta durur.', target: '[data-testid="benim-siram"]', optional: true }] }); });
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
    spy.mockRestore();
    expect(errors.map(String).filter((e) => /Maximum update depth|#185/.test(e))).toEqual([]);
    expect(document.querySelector('[data-testid="anlatici-tur"]')).not.toBeNull();
    expect(document.querySelector('.coach-ring')).not.toBeNull();
    // karar kararlı: art arda iki ölçüm aynı sınıfı verir
    const cls = document.querySelector('.coach-panel')!.className;
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    expect(document.querySelector('.coach-panel')!.className).toBe(cls);
    await act(async () => { useCoach.getState().end(true); });
  }, 30_000); // MK-020: süreyi Coach ağacının test içindeki ilk içe aktarımı (vite dönüşümü, ana süreçte) belirler: işçide CPU 0,36 sn,
  // yük 15'te duvar 3,5 sn (oran ≈ 10); yük 28+'da 5 sn'lik varsayılan aşıldı. Döngü denetimi (React #185) aynı kalır.
});
