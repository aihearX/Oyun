// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DEFAULT_SKILLS, HUMAN_JOURNEY, treasureAt } from '@odi/content';
import { generateLevel } from '@odi/level-gen';
import { defaultMeta, processRun, settle, xpThreshold, type PlayerCore } from '@odi/meta';
import { useNet } from '@odi/net/store';
import { scoreRun, type LevelSpec, type RunResult } from '@odi/shared';
import { gecenOgeler, hazinePenceresi, hesabaGecen, ledgerKey, odulDurumu, sinirSatiri, type Kredi } from './odul-durum';
import { useSocial } from './net';
import { useStore, toastsFor } from './store';
import { useMapSeen } from './map/mapSeen';
import { returnCelebrations } from './map/goals';

vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined, duck: () => undefined } }));
vi.mock('./ftue/voice', () => ({ speakLine: () => -1, stopVoiceIf: () => undefined }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Oyuncu testi tur 12 (YN-200, OT-rekabetci-44): sonuç kartının, Hazine penceresinin ve başarım bildiriminin yazdığı jeton = sunucunun
 * hesaba geçirdiği. Günlük yerel ödül sınırı kestiyse eksik açıkça yazılır; çevrimdışıyken "bağlanınca". Aynı başarım iki bölümün
 * sonucunda iki kez bildirilmez. YN-201: hazine penceresi açıldığı anda görüldü sayılır.
 */
const DAY = '2026-11-04';
const prof = { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS };
const core = (n: number): PlayerCore => {
  const progress: PlayerCore['progress'] = {}; for (let i = 1; i < n; i++) progress[i] = { stars: 2, best: 600, plays: 1 };
  // önceki bölümlerin başarımları önceden açılmış (settle): bu koşunun kayıtları yalnız bu bölümünkiler
  return settle<PlayerCore>({ progress, coins: 7147, xp: xpThreshold(12) + 40, streak: 1, lastDay: DAY, failStreak: 0, skills: { ...DEFAULT_SKILLS }, meta: defaultMeta() }).core;
};
const run = (spec: LevelSpec, o: Partial<RunResult> = {}): RunResult => {
  const base = { levelId: spec.id, completed: true, coins: Math.ceil(spec.coinsTotal * 0.6), timeSec: spec.parTimeSec - 4, deaths: 0, damageTaken: 0, objectiveMet: true, secretFound: false, extra: { maxCombo: 20 }, ...o };
  return { ...base, ...scoreRun(spec, base) };
};
const jetonOf = (g: { items: { kind: string; amount: number }[] }) => g.items.reduce((a, i) => a + (i.kind === 'jeton' ? i.amount : 0), 0);
const nb = (t: string | null | undefined) => (t ?? '').replace(/\u00a0/g, ' ');
const num = (t: string | null | undefined) => Number(nb(t).replace(/[^\d-]/g, ''));

let root: Root | null = null;
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null; document.body.innerHTML = '';
  useStore.setState({ toasts: [] }); useSocial.setState({ enabled: false, krediler: {}, outbox: [] }); useNet.setState({ status: 'kapalı' } as never);
});
async function show(spec: LevelSpec, summary: ReturnType<typeof processRun>['summary'], result: RunResult) {
  const { ResultScreen } = await import('./screens/ResultScreen');
  const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h);
  const noop = () => undefined;
  await act(async () => { root!.render(createElement(ResultScreen, { spec, result, summary, demo: true, onRetry: noop, onNext: noop, onMap: noop })); });
}
const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
/** Bölüm 40 (hazine + başarımlar) ilk geçiş: hazine, başarımlar ve bölüm jetonu ayrı kayıtlar */
function bolum40() {
  const spec = generateLevel(HUMAN_JOURNEY.id, 40, prof); const result = run(spec);
  const { summary } = processRun(core(40), spec, result, DAY);
  return { spec, result, summary };
}

describe('sonuç kartı = hesaba geçen (YN-200)', () => {
  it('sınır kestiyse satırlar hesaba geçeni, altında eklenmeyeni yazar; toplam = sunucunun credited toplamı + bölüm jetonu', async () => {
    const { spec, result, summary } = bolum40();
    const yerel = summary.grants.filter((g) => !g.reason.startsWith('bolum:') && jetonOf(g) > 0);
    expect(yerel.map((g) => g.reason)).toEqual(expect.arrayContaining(['hazine:40']));
    // sunucu: günde kalan 60 jeton; ilk kayıt 60'ını alır, gerisi 0 (apps/server/src/wallet.ts min(jeton, left))
    let left = 60; const krediler: Record<string, Kredi> = {};
    for (const g of yerel) { const j = jetonOf(g); const credited = Math.min(j, left); left -= credited; krediler[ledgerKey(g.at!, g.reason)] = { jeton: j, credited }; }
    const credited = Object.values(krediler).reduce((a, k) => a + k.credited, 0); const istenen = yerel.reduce((a, g) => a + jetonOf(g), 0);
    useSocial.setState({ enabled: true, krediler });
    await show(spec, summary, result);
    const head = document.querySelector('.result-earn-head b')?.textContent;
    expect(num(head)).toBe(result.coins + credited);
    expect(nb(q('sonuc-sinir')?.textContent)).toContain(`Günlük ödül sınırı doldu: ${(istenen - credited).toLocaleString('tr-TR')} jeton eklenmedi.`);
    expect(nb(q('sonuc-kazanc')?.textContent)).toMatch(/Bölüm 40 hazinesi/);
    // satır toplamı = başlık (döküm ile toplam aynı söz)
    const lines = [...document.querySelectorAll('[data-testid="sonuc-kazanc"] > li > b')].map((b) => num(b.textContent));
    expect(lines.reduce((a, n) => a + n, 0)).toBe(result.coins + credited);
  });
  it('sınır kesmediyse not yok; çevrimdışıyken bekleyen jeton "bağlanınca hesabına eklenecek" der, "eklendi" demez', async () => {
    const { spec, result, summary } = bolum40();
    const yerel = summary.grants.filter((g) => !g.reason.startsWith('bolum:') && jetonOf(g) > 0); const istenen = yerel.reduce((a, g) => a + jetonOf(g), 0);
    useSocial.setState({ enabled: true, krediler: Object.fromEntries(yerel.map((g) => [ledgerKey(g.at!, g.reason), { jeton: jetonOf(g), credited: jetonOf(g) }])) });
    await show(spec, summary, result);
    expect(q('sonuc-sinir')).toBeNull(); expect(q('sonuc-bekleyen')).toBeNull();
    expect(num(document.querySelector('.result-earn-head b')?.textContent)).toBe(result.coins + istenen);
    await act(async () => { root!.unmount(); }); root = null; document.body.innerHTML = '';
    useSocial.setState({ krediler: {}, outbox: yerel.map((g) => ({ k: 'local' as const, ledgerId: ledgerKey(g.at!, g.reason), jeton: jetonOf(g), reason: g.reason })) });
    useNet.setState({ status: 'çevrimdışı' } as never);
    await show(spec, summary, result);
    expect(nb(q('sonuc-bekleyen')?.textContent)).toContain(`${istenen.toLocaleString('tr-TR')} jeton bağlanınca hesabına eklenecek`);
  });
  it('durum: yanıt yoksa ve sunucu yoksa tam; bölüm jetonu her zaman tam (progress.submit)', () => {
    const d = { krediler: { '1:hazine:5': { jeton: 60, credited: 0 } }, bekleyen: new Set(['2:basarim:x:1']), sosyal: true, bagli: true };
    expect(odulDurumu({ at: 1, reason: 'hazine:5' }, d)).toEqual({ k: 'kesik', eksik: 60 });
    expect(odulDurumu({ at: 2, reason: 'basarim:x:1' }, d)).toEqual({ k: 'bekliyor', bagli: true });
    expect(odulDurumu({ at: 3, reason: 'bolum:5' }, d)).toEqual({ k: 'tam' });
    expect(odulDurumu({ at: 2, reason: 'basarim:x:1' }, { ...d, sosyal: false })).toEqual({ k: 'tam' });
    const h = hesabaGecen([{ at: 1, reason: 'hazine:5', items: [{ kind: 'jeton', amount: 60 }] }, { at: 2, reason: 'basarim:x:1', items: [{ kind: 'jeton', amount: 15 }] }], { ...d, bagli: false });
    expect(h.eksik).toBe(60); expect(h.bekleyen).toBe(15); expect(h.grants[0]!.eksik).toBe(60);
  });
});

describe('Hazine penceresi ve başarım bildirimi sınırı söyler (YN-200)', () => {
  it('Hazine penceresi: kart hesaba geçeni gösterir, not eklenmeyeni; çevrimdışı "bağlanınca", "eklenmişti" değil', () => {
    const items = treasureAt(40)!.reward;
    const j = jetonOf({ items });
    const kesik = hazinePenceresi(items, { k: 'kesik', eksik: j }, 'Bölüm sonunda cüzdanına eklenmişti');
    expect(kesik.items.some((i) => i.kind === 'jeton')).toBe(false); expect(kesik.items.length).toBe(items.length - 1);
    expect(nb(kesik.note)).toBe(`Günlük ödül sınırı doldu: ${j} jeton eklenmedi`);
    expect(gecenOgeler([{ kind: 'jeton', amount: 200 }], 40)).toEqual([{ kind: 'jeton', amount: 160 }]);
    expect(hazinePenceresi(items, { k: 'bekliyor', bagli: false }, 'x').note).toBe('Jetonu bağlanınca cüzdanına eklenecek');
    expect(hazinePenceresi(items, { k: 'tam' }, 'Bölüm sonunda cüzdanına eklenmişti').note).toBe('Bölüm sonunda cüzdanına eklenmişti');
  });
  it('başarım bildirimi: sunucu kesince metin hesaba geçeni ve eklenmeyeni yazar; toplu bildirim de', () => {
    useStore.setState({ toasts: toastsFor([{ kind: 'achievement', id: 'biyom-korteks', tier: 1 }]) });
    expect(useStore.getState().toasts[0]!.text).toBe('Başarım açıldı: +15 jeton, +10 XP');
    useStore.getState().odulKesildi('basarim:biyom-korteks:1', 15);
    expect(nb(useStore.getState().toasts[0]!.text)).toBe(`Başarım açıldı: +10 XP · ${nb(sinirSatiri(15))}`);
    const many = toastsFor([{ kind: 'achievement', id: 'kasif', tier: 1 }, { kind: 'achievement', id: 'biyom-korteks', tier: 2 }, { kind: 'achievement', id: 'uzun-yol', tier: 1 }, { kind: 'achievement', id: 'kasif', tier: 2 }]);
    useStore.setState({ toasts: many });
    const top = many[2]!; const j = top.odul!.jeton;
    useStore.getState().odulKesildi(top.odul!.reasons[0]!, 15);
    expect(useStore.getState().toasts[2]!.text).toBe(`Başarımlardan +${j - 15} jeton · Profilde hepsi · Günlük ödül sınırı doldu: 15 jeton eklenmedi`);
  });
});

describe('aynı başarım bir kez bildirilir (YN-200)', () => {
  it('sonuç ekranı kapanınca o bölümün sırada kalan bildirimleri düşer; sonraki bölümün sonucunda yeniden çıkmaz', async () => {
    useStore.setState({ ...core(39), toasts: [] });
    const s39 = generateLevel(HUMAN_JOURNEY.id, 39, prof);
    useStore.getState().completeRun(s39, run(s39));
    const kosu = useStore.getState().toasts.filter((t) => t.kosu);
    expect(kosu.length).toBeGreaterThan(0);
    // genel bildirim (ör. sınır, takım hediyesi) kalır
    useStore.setState((s) => ({ toasts: [...s.toasts, { id: 99, icon: '🪙', title: 'Günlük ödül sınırı doldu', sinir: 15 }] }));
    const { ResultScreen } = await import('./screens/ResultScreen');
    const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h);
    const noop = () => undefined; const { summary } = processRun(core(39), s39, run(s39), DAY);
    await act(async () => { root!.render(createElement(ResultScreen, { spec: s39, result: run(s39), summary, onRetry: noop, onNext: noop, onMap: noop })); });
    await act(async () => { root!.unmount(); }); root = null;
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    expect(useStore.getState().toasts.map((t) => t.id)).toEqual([99]);
  });
});

describe('hazine penceresi açıldığı anda görüldü (YN-201)', () => {
  it('markShown sonrası yenilemede aynı hazine dönüş sahnesinde yeniden açılmaz; öteki düğümler oynar', () => {
    const t = treasureAt(20) ? 20 : 25;
    const seen: Record<number, number> = {}; for (let i = 1; i < t; i++) seen[i] = 2;
    const now = { ...seen, [t]: 2 };
    useMapSeen.setState({ init: true, stars: { ...seen }, restored: [] });
    expect(returnCelebrations(useMapSeen.getState().stars, now, [])).toBeGreaterThanOrEqual(1);
    useMapSeen.getState().markShown(t, 2);
    // uygulama yeniden açıldı: kayıtlı "gösterilen" durumla gerçek ilerlemenin farkında hazine yok
    expect(returnCelebrations(useMapSeen.getState().stars, now, [])).toBe(0);
  });
});
