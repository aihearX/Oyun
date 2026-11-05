// @vitest-environment jsdom
// Oyuncu testi tur 13: sonuç ekranının kalkan satırı ve oyuncu Seviye penceresi (YN-229).
//  - Kalkan satırı: karşılanan vuruş yoksa "Kalkan kullanılmadı: hasarların hepsi düşmeydi"; varsa "Kalkan N çarpmayı karşıladı;
//    M kez düştün" (düşme sayısı koşunun sonucundan, extra.falls). Hasar sayısı kayıp kartında bir kez (OT-sessiz-oyuncu-31).
//  - Seviye penceresi yalnız oyuncu seviyesiyle açılanları listeler; bölümün hazinesi ve öteki başarımlar seviyeyle açılmış gibi
//    görünmez (OT-ogrenci-birinci-46).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DEFAULT_SKILLS, HUMAN_JOURNEY } from '@odi/content';
import { generateLevel } from '@odi/level-gen';
import { defaultMeta, processRun, xpThreshold, type PlayerCore, type RunSummary } from '@odi/meta';
import { scoreRun, type LevelSpec, type RunResult } from '@odi/shared';
import { shieldResultLine, type ShieldGift } from './kalkan';
import { seviyeAcilanlar } from './screens/sonuc-satir';
import { celebrate } from './celebrate';
import { useStore } from './store';

vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined, duck: () => undefined } }));
vi.mock('./ftue/voice', () => ({ speakLine: () => -1, stopVoiceIf: () => undefined }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DAY = '2026-11-05';
const prof = { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS };
const nb = (t: string | null | undefined) => (t ?? '').replace(/\u00a0/g, ' ');
const core = (n: number): PlayerCore => {
  const progress: PlayerCore['progress'] = {}; for (let i = 1; i < n; i++) progress[i] = { stars: 2, best: 600, plays: 1 };
  return { progress, coins: 500, xp: xpThreshold(3) + 40, streak: 1, lastDay: DAY, failStreak: 0, skills: { ...DEFAULT_SKILLS }, meta: defaultMeta() };
};
const run = (spec: LevelSpec, o: Partial<RunResult> = {}): RunResult => {
  const base = { levelId: spec.id, completed: true, coins: Math.ceil(spec.coinsTotal * 0.6), timeSec: spec.parTimeSec - 4, deaths: 0, damageTaken: 0, objectiveMet: false, secretFound: false, extra: { maxCombo: 5 }, ...o };
  return { ...base, ...scoreRun(spec, base) };
};
/** bir sayının metinde kaç kez geçtiği (sayı olarak; "13" içindeki "3" sayılmaz) */
const kez = (t: string, n: number) => (t.match(new RegExp(`(?<![0-9])${n}(?![0-9])`, 'g')) ?? []).length;

let root: Root | null = null;
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null; document.body.innerHTML = ''; vi.restoreAllMocks();
  useStore.setState({ teamShields: 0, toasts: [], bilgiSonlar: [], reduceMotion: false, skills: { ...DEFAULT_SKILLS } });
});
async function show(spec: LevelSpec, result: RunResult, gift?: ShieldGift, sum?: (s: RunSummary) => RunSummary) {
  const { ResultScreen } = await import('./screens/ResultScreen');
  const { summary } = processRun(core(spec.number), spec, result, DAY);
  const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h);
  const noop = () => undefined;
  await act(async () => { root!.render(createElement(ResultScreen, { spec, result, summary: sum ? sum(summary) : summary, demo: true, gift, onRetry: noop, onNext: noop, onMap: noop })); });
}
const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe('kalkan satırı: karşılanan vuruş × düşme (YN-229, OT-sessiz-oyuncu-31)', () => {
  const takim: ShieldGift = { from: 'takim', n: 3 };
  it('karşılanan 0/1/2 vuruş ve 0-3 düşme: ne karşılandığı, kaç kez düşüldüğü; hasar sayısı satırda yok', () => {
    for (const guarded of [0, 1, 2]) for (const falls of [0, 1, 2, 3]) {
      const dmg = guarded + falls;
      const line = nb(shieldResultLine(takim, { extra: { ...(guarded ? { guarded } : {}), ...(falls ? { falls } : {}) }, damageTaken: dmg }));
      const ad = `${guarded}/${falls}`;
      if (guarded === 0 && falls === 0) expect(line, ad).toBe('Takım kalkanı bu bölümde seninleydi, vuruş gelmedi. Takım kalkanı bölüm başında harcanır.');
      else if (guarded === 0) expect(line, ad).toBe('Kalkan kullanılmadı: hasarların hepsi düşmeydi (kalkan düşmeyi karşılamaz).');
      else expect(line, ad).toBe(`Kalkan ${guarded} çarpmayı karşıladı${falls ? `; ${falls} kez düştün` : ''}.`);
      expect(line, ad).not.toMatch(/hasar aldın/);
    }
    // Atölye kalkanında da aynı; Klinik de vuruş karşıladıysa adı geçer (damageNote ile aynı)
    expect(nb(shieldResultLine({ from: 'atolye', n: 1, pct: 10 }, { extra: { falls: 2 }, damageTaken: 2 }))).toBe('Kalkan kullanılmadı: hasarların hepsi düşmeydi (kalkan düşmeyi karşılamaz).');
    expect(nb(shieldResultLine(takim, { extra: { guarded: 2, klinik: true, falls: 1 }, damageTaken: 3 }))).toBe('Kalkan ve Klinik 2 çarpmayı karşıladı; 1 kez düştün.');
    // kalkan bittikten sonra gelen çarpma düşüş sayılmaz: düşme sayısı sonuçtan (1 karşılanan + 1 düşüş + 1 dikene değiş)
    expect(nb(shieldResultLine({ from: 'takim', n: 1 }, { extra: { guarded: 1, falls: 1 }, damageTaken: 3 }))).toBe('Kalkan 1 çarpmayı karşıladı; 1 kez düştün.');
  });

  it('kayıp kartı: hasar sayısı bir kez, kalkan satırı ardından (karşılanan 0/1/2 × düşme)', async () => {
    const spec = generateLevel(HUMAN_JOURNEY.id, 7, prof);
    for (const guarded of [0, 1, 2]) for (const falls of [1, 2]) {
      const dmg = guarded + falls;
      await show(spec, run(spec, { completed: false, damageTaken: dmg, coins: 4, extra: { reason: 'fall', pct: 0.6, ...(guarded ? { guarded } : {}), falls } }), takim);
      const t = nb(q('sonuc-neden-hasar')?.textContent);
      expect(t, `${guarded}/${falls}`).toMatch(new RegExp(`^${dmg} kez hasar aldın, en son boşluğa düştün\\. `));
      expect(kez(t, dmg), `${guarded}/${falls}: ${t}`).toBe(1);
      expect(t).toContain(guarded ? `Kalkan ${guarded} çarpmayı karşıladı; ${falls} kez düştün.` : 'Kalkan kullanılmadı: hasarların hepsi düşmeydi');
      expect(q('sonuc-kalkan')).toBeNull();
      await act(async () => { root!.unmount(); }); root = null; document.body.innerHTML = '';
    }
    // oyuncu testi: Bölüm 36, takım kalkanı, 3 düşüş
    const b36 = generateLevel(HUMAN_JOURNEY.id, 36, prof);
    await show(b36, run(b36, { completed: false, damageTaken: 3, coins: 4, extra: { reason: 'fall', pct: 0.6, falls: 3 } }), { from: 'takim', n: 1 });
    expect(nb(q('sonuc-neden-hasar')?.textContent)).toBe('3 kez hasar aldın, en son boşluğa düştün. Kalkan kullanılmadı: hasarların hepsi düşmeydi (kalkan düşmeyi karşılamaz).');
  });

  it('kazanç: kalkan satırı karşılananı ve düşüşü söyler', async () => {
    const spec = generateLevel(HUMAN_JOURNEY.id, 7, prof);
    await show(spec, run(spec, { damageTaken: 2, extra: { maxCombo: 5, guarded: 1, falls: 1 } }), takim);
    expect(nb(q('sonuc-kalkan')?.textContent)).toBe('Kalkan 1 çarpmayı karşıladı; 1 kez düştün.');
  });
});

describe('oyuncu Seviye penceresi yalnız seviyeyle açılanları listeler (YN-229, OT-ogrenci-birinci-46)', () => {
  it('seviyeAcilanlar: hazine, kart, öteki başarımlar listede yok; seviye koşullu kozmetik ve "Seviye N ol" başarımı var', () => {
    const ev: RunSummary['events'] = [
      { kind: 'achievement', id: 'cok-yonlu', tier: 1 }, { kind: 'card', id: 'sinir:ilk' }, { kind: 'albumBadge', biome: 'sinir' },
      { kind: 'cosmetic', id: 'renk-gece' }, // hazineden (seviyeyle değil)
      { kind: 'cosmetic', id: 'renk-amber' }, { kind: 'achievement', id: 'usta-dinleyici', tier: 2 },
    ];
    const l = seviyeAcilanlar({ events: ev });
    expect(l).toHaveLength(2);
    expect(l[0]).toBe('Dolaba yeni: Bal Kehribarı');
    expect(l[1]).toMatch(/^Başarım: Usta Dinleyici/);
    expect(seviyeAcilanlar({ events: ev.slice(0, 4) })).toEqual([]);
  });

  it('sonuç ekranı: Bölüm 35 hazinesi ve "Çok Yönlü" seviye penceresine gitmez', async () => {
    useStore.setState({ reduceMotion: true });
    const spy = vi.spyOn(celebrate, 'levelUp').mockResolvedValue(undefined);
    const spec = generateLevel(HUMAN_JOURNEY.id, 35, prof);
    const leveled = (s: RunSummary, events: RunSummary['events']): RunSummary => ({
      ...s, xpBefore: xpThreshold(10) - 5, xpAfter: xpThreshold(10) + 20, levelBefore: 9, levelAfter: 10,
      treasure: [{ kind: 'jeton', amount: 60 }], events,
    });
    await show(spec, run(spec), undefined, (s) => leveled(s, [{ kind: 'achievement', id: 'cok-yonlu', tier: 1 }]));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toMatchObject({ level: 10, unlocks: [] });
    // sonuç kartında yine yazar (bu bölümün kazancı)
    expect(document.body.textContent).toContain('Bölüm 35 hazinesi');
    await act(async () => { root!.unmount(); }); root = null; document.body.innerHTML = ''; spy.mockClear();
    // seviyeyle açılan varsa yalnız o, başlıklı
    await show(spec, run(spec), undefined, (s) => leveled(s, [{ kind: 'achievement', id: 'cok-yonlu', tier: 1 }, { kind: 'achievement', id: 'usta-dinleyici', tier: 2 }]));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    const o = spy.mock.calls[0]![0];
    expect(o.unlocks).toHaveLength(1); expect(o.unlocks![0]).toMatch(/Usta Dinleyici/); expect(o.listTitle).toBe('Seviyeyle açılanlar');
    expect(o.unlocks!.join(' ')).not.toMatch(/hazine|Çok Yönlü/);
  });

  it('pencere listenin başlığını gösterir; liste yoksa başlık da yok', async () => {
    window.matchMedia = ((m: string) => ({ matches: m.includes('reduce'), media: m, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    const { CelebrationLayer } = await import('./celebrate/CelebrationLayer');
    const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h);
    await act(async () => { root!.render(createElement(CelebrationLayer, { toasts: false })); });
    const ac = async (o: Parameters<typeof celebrate.levelUp>[0]) => {
      let done = false;
      await act(async () => { void celebrate.levelUp(o).then(() => { done = true; }); });
      await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
      const k = document.querySelector('[data-testid="seviye-listesi"] .lvl-list-k')?.textContent ?? null; const list = !!document.querySelector('[data-testid="seviye-listesi"]');
      await act(async () => { (document.querySelector('.cel-cta .btn') as HTMLElement).click(); });
      await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
      expect(done).toBe(true);
      return { k, list };
    };
    expect(await ac({ level: 6, unlocks: ['Dolaba yeni: Bal Kehribarı'], listTitle: 'Seviyeyle açılanlar' })).toEqual({ k: 'Seviyeyle açılanlar', list: true });
    expect(await ac({ level: 7, unlocks: [], listTitle: 'Seviyeyle açılanlar' })).toEqual({ k: null, list: false });
  });
});
