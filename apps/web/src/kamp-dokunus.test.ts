// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildCost, crystalsToFinish, type KgState } from '@odi/shared';

vi.mock('./ftue/voice', () => ({ speakLine: () => 1, stopVoice: () => undefined, stopVoiceIf: () => undefined, prefetchLines: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined } }));
const calls: { op: string; data: unknown }[] = [];
vi.mock('./net', () => ({ act: async (op: string, data: unknown) => { calls.push({ op, data }); return null; }, toast: () => undefined }));

/**
 * Oyuncu testi tur 5 (YN-104): kamp ziyareti bildirimi dürüst ("gördü" yok), anıt notu yalnız X ile kapanır, günlük görevde Git/Oyna ve
 * onaylı Değiştir, inşaat penceresi süresi sayaç ve kristal bedeliyle aynı.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
afterEach(async () => { await act(async () => { root?.unmount(); }); root = null; document.body.innerHTML = ''; calls.length = 0; vi.useRealTimers(); });
async function render(node: ReturnType<typeof createElement>) {
  const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h);
  await act(async () => { root!.render(node); });
}

describe('kamp ziyareti: alkış bildirimi (OT-takim-kaptani-14)', () => {
  it('"iletildi" der, "gördü" demez (sunucu görülme bilgisi tutmaz)', async () => {
    const { alkisIletildi } = await import('./camp/Ziyaret');
    expect(alkisIletildi('Deniz')).toBe('Alkışın Deniz’e iletildi');
    expect(alkisIletildi('Ozan')).toBe('Alkışın Ozan’a iletildi');
    expect(alkisIletildi('Hesapli')).toBe('Alkışın Hesapli’ye iletildi');
    expect(alkisIletildi('Duru')).toBe('Alkışın Duru’ya iletildi');
    expect(alkisIletildi('Kaptan42')).toBe('Alkışın iletildi: Kaptan42');
    const src = readFileSync(resolve(__dirname, 'camp/Ziyaret.tsx'), 'utf8');
    expect(src.replace(/\/\/.*$/gm, '')).not.toMatch(/gördü|baktı|okudu/);
  });
});

describe('anıt notu: Daha fazla genişletir, yalnız X kapatır (OT-uzman-odyolog-20)', () => {
  it('"Daha fazla"lı not süre dolunca kaybolmaz (konuşan satır olmaktan çıkar); X kapatır; anıta dokunuş notu yeniden açar', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { DedeCard, sayDede, showDede } = await import('./camp/dede');
    await render(createElement(DedeCard));
    await act(async () => { sayDede('anit-beyin-sapi', 'Yeni anıt · İki Kulak Kavşağı', 'İki kulağın sesi beyin sapında buluşur; sesin yönü böyle bulunur.'); });
    const card = () => document.querySelector('[data-testid="kamp-dede"]');
    expect(card()?.getAttribute('data-line')).toBe('anit-beyin-sapi');
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(card()).not.toBeNull();
    expect(card()?.getAttribute('data-line')).toBe(''); // rehber turu beklemez
    await act(async () => { (card()!.querySelector('.ml-btn') as HTMLElement).click(); });
    expect(card()?.querySelector('.ml-tech')?.textContent).toContain('beyin sapında');
    await act(async () => { (card()!.querySelector('.en-x') as HTMLElement).click(); });
    expect(card()).toBeNull();
    await act(async () => { showDede('İki kulağın sesi beyin sapında buluşur.', 'İki Kulak Kavşağı · Beyin Sapı', undefined, true); });
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(card()?.textContent).toContain('İki Kulak Kavşağı');
    // kısa bina satırı eskisi gibi kendiliğinden kaybolur
    await act(async () => { showDede('Bilgi', 'Süs'); });
    await act(async () => { vi.advanceTimersByTime(12_000); });
    expect(card()).toBeNull();
  });
});

describe('inşaat penceresi süresi (OT-ekonomi-denetci-21)', () => {
  it('pencere saniyesiyle yazar; sayaç ve kristal bedeli aynı süreden', async () => {
    const { sureTam } = await import('./camp/model');
    const sec = buildCost('merkez', 2).seconds; // sunucu: startBuild aynı formül (takım teknolojisi yokken)
    expect(sec).toBe(386);
    expect(sureTam(sec)).toBe('6 dk 26 sn');
    expect(crystalsToFinish(sec)).toBe(7); // 6 dk 26 sn → başlamış 7. dakika
    expect(sureTam(60)).toBe('1 dk');
    expect(sureTam(45)).toBe('45 sn');
    expect(sureTam(3725)).toBe('1 sa 2 dk 5 sn');
  });
});

const gorev = (id: string, text: string, o: Partial<{ done: boolean; locked: string | null }> = {}) => ({ ref: `gunluk:d:${id}`, id, text, art: 'timpano', need: 1, progress: 0, done: false, claimed: false, reward: null, locked: null, ...o });
function kgState(tasks: ReturnType<typeof gorev>[], rerollLeft = 1): KgState {
  return {
    day: 'd', dayEndsAt: Date.now() + 3_600_000, week: 'w', weekEndsAt: Date.now() + 86_400_000, open: { gorev: true, oyun: true, vaka: false },
    story: { chapter: null, next: null, claimed: 10, total: 10 }, daily: { tasks, rerollLeft }, weekly: null, achievements: [], oyun: [], takim: null,
    vaka: { open: false, waiting: 0, locked: null }, claimable: 0, growth: true, pending: { kampXp: 0, dekor: [] },
  } as KgState;
}

describe('günlük kamp görevi: Git/Oyna ve onaylı Değiştir (OT-uzman-odyolog-22)', () => {
  it('her görevin yeri: oyun paneli, klinik, harita, Arkadaşlar ya da kamp', async () => {
    const { gorevGit } = await import('./camp/gorev/GorevPanel'); const { useKg } = await import('./camp/gorev/state');
    const nav = { open: vi.fn(), play: vi.fn(), tab: vi.fn() };
    expect(gorevGit('g-timpano').label).toBe('Oyna');
    gorevGit('g-timpano').go(nav); expect(useKg.getState().panel).toEqual({ kind: 'oyun', oyun: 'timpano' });
    gorevGit('g-vaka').go(nav); expect(useKg.getState().panel).toEqual({ kind: 'klinik', tab: 'salon' });
    expect(gorevGit('g-bolum').label).toBe('Git');
    gorevGit('g-bolum').go(nav); expect(nav.tab).toHaveBeenCalledWith('map'); expect(useKg.getState().panel).toBeNull();
    gorevGit('g-ziyaret').go(nav); expect(nav.open).toHaveBeenCalledWith({ name: 'friends' });
    useKg.setState({ panel: { kind: 'gorev', tab: 'gunluk' } });
    gorevGit('g-depo').go(nav); expect(useKg.getState().panel).toBeNull(); // kampın içindeki iş: panel kapanır, kamp görünür
  });
  it('Değiştir ayrı ve onay ister; Vazgeç hakkı korur; görev adına benzeyen tek düğme yok', async () => {
    const { GorevPanel } = await import('./camp/gorev/GorevPanel'); const { useKg } = await import('./camp/gorev/state');
    useKg.setState({ kg: kgState([gorev('g-timpano', 'Bir tur Timpanogram Eşleştir oyna'), gorev('g-ton', 'Bir tur Ton Avı oyna', { locked: 'Odyometri Odası’nı kur' })]), panel: { kind: 'gorev', tab: 'gunluk' } });
    await render(createElement(GorevPanel, { tab: 'gunluk' }));
    const row = () => document.querySelector('[data-gorev="g-timpano"]')!;
    expect(row().querySelector('[data-testid="kg-git"]')?.textContent).toBe('Oyna');
    expect(document.querySelector('[data-gorev="g-ton"] [data-testid="kg-git"]')).toBeNull(); // kilitli: ne gerektiği yazar
    expect([...document.querySelectorAll('button')].some((b) => (b.getAttribute('aria-label') ?? '').includes('Timpanogram'))).toBe(false);
    await act(async () => { (row().querySelector('[data-testid="kg-degistir"]') as HTMLElement).click(); });
    expect(calls).toEqual([]);
    expect(row().querySelector('[data-testid="kg-degistir-soru"]')?.textContent).toContain('Bugün 1 değiştirme hakkın var. Değiştirilsin mi?');
    const vazgec = [...row().querySelectorAll('button')].find((b) => b.textContent === 'Vazgeç')!;
    await act(async () => { vazgec.click(); });
    expect(row().querySelector('[data-testid="kg-degistir-soru"]')).toBeNull();
    expect(calls).toEqual([]);
    await act(async () => { (row().querySelector('[data-testid="kg-degistir"]') as HTMLElement).click(); });
    await act(async () => { (row().querySelector('[data-testid="kg-degistir-onay"]') as HTMLElement).click(); });
    expect(calls).toEqual([{ op: 'kg.reroll', data: { id: 'g-timpano' } }]);
  });
});
