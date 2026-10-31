// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { questById } from '@odi/content';

const spoken: (string | undefined)[] = [];
vi.mock('./voice', () => ({ speakLine: (_t: string, id?: string) => { spoken.push(id); return spoken.length; }, stopVoice: () => undefined, prefetchLines: () => undefined, stopVoiceIf: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined } }));

/**
 * Oyuncu testi tur 1 (YN-045): rehber akışı.
 *  - İşaret (halka) görünmeden Tüy Dede "dokun" demez; sandık kapalıyken yalnız sandık "Sandığa dokun" ile gösterilir.
 *  - "Atla" o an sırada bekleyen turların hepsini geçer; oyuncunun kendi girdiği yerin tanıtımı sonradan gösterilmez.
 *  - Günlük "meydan oku" görevi meydan okumanın açıldığı bölümle aynı (Bölüm 8).
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
if (typeof globalThis.DOMRect === 'undefined') {
  (globalThis as { DOMRect?: unknown }).DOMRect = class {
    constructor(public x = 0, public y = 0, public width = 0, public height = 0) {}
    get left() { return this.x; } get top() { return this.y; } get right() { return this.x + this.width; } get bottom() { return this.y + this.height; }
  };
}
let root: Root | null = null;
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ''; spoken.length = 0; });
const tick = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const el = (cls: string, r: [number, number, number, number]) => { const d = document.createElement('div'); d.className = cls; d.getBoundingClientRect = () => new DOMRect(...r); return d; };

describe('rehber: işaret görünmeden dokun yazısı yok', () => {
  it('sandık kapalıyken yalnız sandık gösterilir; Topla belirince Tüy Dede konuşur; toplanınca hemen ilerler', async () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    const { CoachHost, useCoach } = await import('./Coach');
    const host = document.createElement('div'); document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root!.render(createElement(CoachHost)); });
    const stage = el('cel-stage chest-stage', [0, 0, 390, 844]); stage.appendChild(el('cel-chest', [120, 260, 150, 150])); document.body.appendChild(stage);
    let seen = false;
    const until = () => { const b = !!document.querySelector('.chest-stage .cel-cta .btn'); if (b) seen = true; return seen && !b; };
    await act(async () => {
      useCoach.getState().start({ id: 'deneme', steps: [
        { id: 'bugun-03', say: 'İşte ödülün! Topla’ya dokun, jetonlar cebine girsin.', target: '.chest-stage .cel-cta .btn', before: { target: '.chest-stage .cel-chest', hint: 'Sandığa dokun' }, wait: { until }, hint: 'Topla’ya dokun', optional: { el: '.chest-stage' } },
        { id: 'bugun-04', say: 'Bunlar günlük görevler.' },
      ] });
    });
    await tick(1700); // isteğe bağlı adımın 1,5 sn denetimi: sahne var, adım atlanmaz
    expect(document.querySelector('[data-testid="anlatici"]')).toBeNull();
    expect(spoken).toEqual([]);
    expect(document.querySelector('.coach-chip')?.textContent).toContain('Sandığa dokun');
    expect(document.querySelector('.coach-ring')).not.toBeNull();
    // sandık açıldı: Topla düğmesi
    const cta = document.createElement('div'); cta.className = 'cel-cta'; const btn = el('btn', [140, 600, 110, 48]); cta.appendChild(btn); stage.appendChild(cta);
    await tick(300);
    expect(document.querySelector('[data-testid="anlatici"]')?.getAttribute('data-say')).toMatch(/Topla/);
    expect(document.querySelector('.coach-chip')).toBeNull();
    expect(spoken).toEqual(['bugun-03']);
    // toplandı (düğme kayboldu): bir dokunuş daha beklemeden sıradaki adım
    btn.remove();
    await tick(600);
    expect(useCoach.getState().step).toBe(1);
    await act(async () => { useCoach.getState().end(true); });
  }, 30_000);
});

describe('rehber: Atla ve ziyaret edilmiş yerler', () => {
  it('Atla sıradaki bütün turları (aynı dizideki) geçer', async () => {
    const { pendingTours } = await import('./Director');
    // 5 bölüm, yalnız sonuç turu görülmüş: harita, Bugün, Kamp, kamp öğreticisi, Arkadaşlar, Sözlük, Takım, Sıralama hep birlikte
    expect(pendingTours('map', 5, ['result1']).sort()).toEqual(['camp', 'camp-build', 'friends', 'glossary', 'siralama', 'team', 'today'].sort());
    expect(pendingTours('team', 5, ['result1', 'map', 'today', 'camp', 'camp-build', 'friends', 'glossary'])).toEqual(['siralama']);
    // kamp turları ayrı dizi
    const all = ['result1', 'map', 'today', 'camp', 'camp-build', 'friends', 'glossary', 'team', 'siralama'];
    expect(pendingTours('team', 40, all)).not.toContain('gorev');
    expect(pendingTours('gorev', 40, all).every((id) => ['kampoyun', 'vaka'].includes(id))).toBe(true);
  }, 30_000);
  it('oyuncunun kendi girdiği yerin tanıtımı sonradan gösterilmez; şimdi başlayan tur hariç', async () => {
    const { visitedTours } = await import('./Director');
    expect(visitedTours('team', 6, ['result1', 'map', 'today', 'camp'], [null])).toEqual(['team']);
    expect(visitedTours('team', 5, [], ['team'])).toEqual([]);
    expect(visitedTours('team', 4, [], [null])).toEqual([]); // henüz açılmadı
    expect(visitedTours('map', 9, [], [null])).toEqual([]);
  }, 30_000);
  it('günlük "meydan oku" görevi meydan okumanın açıldığı bölümde gelir', async () => {
    const { featureById } = await import('./features');
    expect(questById('meydan-1')?.after).toBe(featureById('race').at);
  });
});
