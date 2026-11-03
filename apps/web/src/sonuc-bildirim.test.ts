// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DEFAULT_SKILLS, HUMAN_JOURNEY } from '@odi/content';
import { biliyorMuydun } from '@odi/content/biliyor-muydun';
import { generateLevel } from '@odi/level-gen';
import { defaultMeta, processRun, type PlayerCore } from '@odi/meta';
import { scoreRun, type LevelSpec, type RunResult } from '@odi/shared';

vi.mock('@odi/audio', () => ({ audio: { play: () => undefined } }));

/**
 * Oyuncu testi tur 8 (YN-145, YN-127): sonuç ekranı.
 *  - Başarım bildirimi bir pencere (kutlama sahnesi, seviye penceresi, aria-modal) açıkken sırada bekler, kapanınca gelir.
 *  - `data-toast-under` işaretli kutuların altında durur; yapışkan düğmelere (`data-toast-floor`) kadar yer yoksa görünmeden bekler,
 *    kapanma süresi işlemez.
 *  - Aynı bölümün tekrarında "Biliyor muydun?" satırı değişir.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
afterEach(async () => {
  const { useStore } = await import('./store'); const { useCelebrating } = await import('./celebrate');
  await act(async () => { root?.unmount(); useStore.setState({ toasts: [] }); useCelebrating.setState({ on: false }); });
  root = null; document.body.innerHTML = '';
});
const tick = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const rect = (el: HTMLElement, top: number, height: number) => { el.getBoundingClientRect = () => ({ x: 0, y: top, left: 0, top, width: 390, height, right: 390, bottom: top + height, toJSON() {} }) as DOMRect; };
async function host() {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return (this as HTMLElement).classList.contains('toast-top') ? 64 : 0; } });
  const { useStore } = await import('./store'); const { Toasts } = await import('./ui/Toasts');
  await act(async () => { useStore.setState({ toasts: [{ id: 1, icon: 'timer', title: 'Saat Kulesi · Bronz', text: 'Başarım açıldı', tone: 'bronze' }] }); });
  const h = document.createElement('div'); document.body.appendChild(h);
  root = createRoot(h);
  await act(async () => { root!.render(createElement(Toasts)); });
  return useStore;
}
const toast = () => document.querySelector<HTMLElement>('.toast-top');

describe('başarım bildirimi pencere açıkken bekler', () => {
  it('seviye penceresi (.cel-stage) açıkken görünmez; kapanınca gelir', async () => {
    const stage = document.createElement('div'); stage.className = 'cel-stage lvl-stage'; document.body.appendChild(stage);
    const store = await host();
    expect(toast()).toBeNull();
    await tick(3000);
    expect(store.getState().toasts).toHaveLength(1); // süre işlemedi: sırada
    await act(async () => { stage.remove(); }); await tick(50);
    expect(toast()?.textContent).toMatch(/Saat Kulesi/);
  }, 30_000);
  it('aria-modal pencere ve kutlama katmanı (useCelebrating) açıkken de bekler', async () => {
    const { useCelebrating } = await import('./celebrate');
    const store = await host();
    expect(toast()).not.toBeNull();
    const m = document.createElement('div'); m.setAttribute('aria-modal', 'true');
    await act(async () => { document.body.appendChild(m); }); await tick(50);
    expect(toast()).toBeNull();
    await act(async () => { m.remove(); useCelebrating.setState({ on: true }); }); await tick(50);
    expect(toast()).toBeNull();
    await tick(3000);
    expect(store.getState().toasts).toHaveLength(1);
    await act(async () => { useCelebrating.setState({ on: false }); }); await tick(50);
    expect(toast()).not.toBeNull();
  }, 30_000);
});

describe('sonuç ekranında bildirim kutuların altında; yer yoksa bekler', () => {
  it('kutuların altına sığmıyorsa gizli bekler (süre işlemez); yer açılınca kutuların altında görünür', async () => {
    const under = document.createElement('div'); under.dataset.toastUnder = ''; rect(under, 300, 200); document.body.appendChild(under);
    const floor = document.createElement('div'); floor.dataset.toastFloor = ''; rect(floor, 540, 300); document.body.appendChild(floor);
    const store = await host(); await tick(50);
    expect(toast()?.style.visibility).toBe('hidden');
    expect(toast()?.dataset.bekliyor).toBe('yer');
    await tick(3000);
    expect(store.getState().toasts).toHaveLength(1);
    rect(floor, 700, 144); await tick(100);
    expect(toast()?.style.visibility).toBe('');
    expect(toast()?.style.top).toBe('508px');
    await tick(3000);
    expect(store.getState().toasts).toHaveLength(0);
  }, 30_000);
});

describe('"Biliyor muydun?" tekrarda farklı satır (YN-127)', () => {
  it('aynı bölümün ikinci oynayışında (kayıt plays) sıradaki satır gelir', () => {
    const prof = { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS }; const DAY = '2026-11-03';
    const finish = (spec: LevelSpec): RunResult => { const base = { levelId: spec.id, completed: false, coins: 0, timeSec: 40, deaths: 1, damageTaken: 3, objectiveMet: false, secretFound: false }; return { ...base, ...scoreRun(spec, base) }; };
    for (const n of [2, 3, 6, 36]) {
      let c: PlayerCore = { progress: {}, coins: 0, xp: 0, streak: 1, lastDay: DAY, failStreak: 0, skills: { ...DEFAULT_SKILLS }, meta: defaultMeta() };
      const spec = generateLevel(HUMAN_JOURNEY.id, n, prof);
      const goru: (string | null)[] = [];
      for (let i = 0; i < 3; i++) {
        c = processRun(c, spec, finish(spec), DAY).core;
        // sonuç ekranı: deneme sayısı kayıttan (plays, 1'den), satır biliyorMuydun(bölüm, düzey, deneme - 1)
        goru.push(biliyorMuydun(n, 'genel', c.progress[n]!.plays - 1));
      }
      expect(goru[0], `${n}`).toBe(biliyorMuydun(n, 'genel'));
      expect(goru[1], `${n}`).not.toBe(goru[0]);
      expect(goru[2], `${n}`).not.toBe(goru[1]);
    }
  });
});
