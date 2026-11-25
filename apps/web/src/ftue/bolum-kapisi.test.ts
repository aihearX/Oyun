// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('./voice', () => ({ speakLine: () => 0, stopVoice: () => undefined, prefetchLines: () => undefined, stopVoiceIf: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined } }));
vi.mock('../net', () => ({ act: async () => null, toast: () => undefined, reconnect: () => undefined, getNet: () => null, useSocial: (f: (s: unknown) => unknown) => f({ enabled: true, tried: true, bonuses: null }) }));

/**
 * 1.1.0 (sahip isteği): bölüm geçilince açılan her yer Tüy Dede'nin sesiyle anlatılır; anlatım bitmeden ya da "Atla"ya basılmadan
 * sonraki bölüme girilmez. Tek kapı App.tsx play() (haritanın "Bölüm N"si, bölüm kartının Oyna'sı, sonucun Sonraki/Tekrar'ı):
 * levelGate true dönerse bölüm başlamaz, kısa not gösterilir, oyuncu haritaya gider ve tanıtım hemen gelir.
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
  const { useCoach } = await import('./Coach'); const { useStore } = await import('../store'); const { bolumNiyeti, acilimIstegi } = await import('./Director');
  await act(async () => { useCoach.setState({ tour: null, step: 0 }); root?.unmount(); });
  useStore.setState({ ftue: { v: 1, story: true, tours: [] }, progress: {} });
  bolumNiyeti.at = -Infinity; acilimIstegi.at = -Infinity;
  root = null; document.body.innerHTML = '';
});
const tick = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const tourId = async () => (await import('./Coach')).useCoach.getState().tour?.id ?? null;
/** n bölümü geçmiş oyuncu; `seen`: görülmüş turlar */
async function player(n: number, seen: string[], extra: { admin?: boolean } = {}) {
  const { useStore } = await import('../store');
  const progress: Record<number, { stars: number }> = {}; for (let i = 1; i <= n; i++) progress[i] = { stars: 2 };
  useStore.setState({ ftue: { v: 1, story: true, tours: seen, ...extra }, progress: progress as never });
}
function screen() {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
}
async function director(route: string) {
  const { FtueDirector } = await import('./Director'); const { CoachHost } = await import('./Coach');
  if (!root) { const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h); }
  await act(async () => { root!.render(createElement('div', null, createElement(FtueDirector, { route }), createElement(CoachHost))); });
}
function map(donus = 'bitti') {
  const m = document.createElement('div'); m.className = 'map-screen'; m.dataset.donus = donus;
  const play = document.createElement('button'); play.className = 'map-play shine'; m.appendChild(play); document.body.appendChild(m);
  return m;
}

describe('bölüm kapısı App.tsx play()', () => {
  it('play() ilk iş kapıya bakar: kapı kapalıysa not, haritaya dönüş, bölüm üretilmez; bölüm düğmeleri hep play()den geçer', () => {
    const app = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
    const body = app.slice(app.indexOf('const play = (number: number'), app.indexOf('const startLevel = '));
    const gate = body.indexOf('levelGate(route.name)');
    expect(gate).toBeGreaterThan(0);
    expect(gate).toBeLessThan(body.indexOf('loadLevelGen'));
    expect(body).toMatch(/levelGate\(route\.name\)\) \{ lockToast\.show\(ONCE_DINLE\); if \(route\.name !== 'map'\) setRoute\(\{ name: 'map' \}\); return; \}/);
    expect(app).toMatch(/<MapScreen onPlay=\{play\}/);
    expect(app).toMatch(/onNext=\{\(\) => play\(route\.spec\.number \+ 1\)\}/);
    expect(app).toMatch(/onRetry=\{\(\) => play\(route\.spec\.number\)\}/);
  });

  it('not kısa ve sade (uzun tire yok)', async () => {
    const { ONCE_DINLE } = await import('./Director');
    expect(ONCE_DINLE).toBe('Önce yeni açılan yeri dinle');
    expect(ONCE_DINLE).not.toMatch(/[—–]/);
  });

  it('haritada temiz ekranda: kapı tanıtımı hemen başlatır; tanıtım sürerken kapı kapalı kalır, tur bozulmaz', async () => {
    screen();
    const { veteranTours } = await import('./features'); const { levelGate, bolumBasliyor } = await import('./Director');
    await player(3, veteranTours(2));
    map();
    await director('map');
    expect(levelGate('map')).toBe(true);
    expect(await tourId()).toBe('camp');
    expect(bolumBasliyor()).toBe(false);
    expect(levelGate('map')).toBe(true);
    expect(await tourId()).toBe('camp');
  });

  it('"Atla" yalnız o tanıtımı geçer; hepsi dinlenince ya da atlanınca kapı açılır', async () => {
    screen();
    const { veteranTours } = await import('./features'); const { levelGate } = await import('./Director'); const { useCoach } = await import('./Coach');
    const { useStore } = await import('../store');
    await player(4, veteranTours(3));
    map();
    await director('map');
    expect(levelGate('map')).toBe(true);
    expect(await tourId()).toBe('friends');
    await act(async () => { useCoach.getState().end(true); }); // Atla
    expect(useStore.getState().ftue.tours).toContain('friends');
    expect(useStore.getState().ftue.tours).not.toContain('glossary');
    expect(levelGate('map')).toBe(true);
    expect(await tourId()).toBe('glossary');
    await act(async () => { useCoach.getState().end(false); }); // dinlendi
    expect(levelGate('map')).toBe(false);
  });

  it('sonuç ekranından (Sonraki/Tekrar): tanıtım orada başlamaz; haritaya gelince "Hedefe ulaştın" kutusu beklenmeden hemen gelir', async () => {
    screen();
    const { veteranTours } = await import('./features'); const { levelGate } = await import('./Director');
    await player(5, veteranTours(4));
    await director('result');
    expect(levelGate('result')).toBe(true);
    expect(await tourId()).toBeNull();
    const m = map('suruyor');
    const goal = document.createElement('div'); goal.className = 'map-goal'; goal.setAttribute('data-ulasildi', '1'); document.body.appendChild(goal);
    await director('map');
    await tick(1100);
    expect(await tourId()).toBeNull(); // dönüş sahnesi sürüyor
    await act(async () => { m.dataset.donus = 'bitti'; });
    await tick(600);
    expect(await tourId()).toBe('team');
  }, 15_000);

  it('kapıyı yalnız haritadaki açılım tanıtımları tutar: harita turu, kamp içi tanıtımlar, yönetici kipi tutmaz', async () => {
    const { veteranTours } = await import('./features'); const { levelGate } = await import('./Director'); const { CAMP_TOURS } = await import('./map-intro');
    await player(1, ['result1']);
    expect(levelGate('map')).toBe(false);
    await player(9, veteranTours(9).filter((id) => !CAMP_TOURS.has(id)));
    expect(levelGate('map')).toBe(false);
    await player(6, veteranTours(5), { admin: true });
    expect(levelGate('map')).toBe(false);
    // her şeyi görmüş ya da atlamış eski oyuncu takılmaz
    await player(20, veteranTours(20));
    expect(levelGate('map')).toBe(false);
    // hiç anlatılmamış açık yer (eski oyuncu) bir kez: kapı onu bekler
    await player(20, veteranTours(20).filter((id) => id !== 'usta'));
    expect(levelGate('result')).toBe(true);
  });
});
