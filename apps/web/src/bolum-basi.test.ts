// @vitest-environment jsdom
// Oyuncu testi tur 11: bölüm başı ve sonuç ekranı (YN-191, YN-192, YN-176, YN-175).
//  - Takım kalkanı bildirim kuyruğuna değil bölüm başı şeridine gider (bildirim bölüm bittikten sonra görünüyordu, OT-ekonomi-denetci-37);
//    sonuç vuruş gelmese de söyler.
//  - Bölüm başı şeridinin 3. yıldız satırı bölüm kartıyla aynı kaynaktan.
//  - 3. yıldız kartı: yıldız alındıysa tutan koşul belirgin, tutmayanın "kaldı"sı soluk (sınıflar; renk styles.css).
//  - Sonuç ekranının "Biliyor muydun?" satırı son gösterilenden farklı kuralıyla seçilir (useBiliyorMuydun → kayıtta bilgiSonlar).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DEFAULT_SKILLS, HUMAN_JOURNEY } from '@odi/content';
import { generateLevel } from '@odi/level-gen';
import { defaultMeta, processRun, xpThreshold, type PlayerCore } from '@odi/meta';
import { scoreRun, type LevelSpec, type RunResult } from '@odi/shared';
import { shieldResultLine, shieldStartLine, type ShieldGift } from './kalkan';
import { nodeGoalLines } from './map/goals';
import { runSkills, startLines } from './screens/bolum-basi';
import { useStore } from './store';

vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined } }));
vi.mock('./ftue/voice', () => ({ speakLine: () => -1, stopVoiceIf: () => undefined }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DAY = '2026-11-04';
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

let root: Root | null = null;
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null; document.body.innerHTML = '';
  useStore.setState({ teamShields: 0, toasts: [], bilgiSonlar: [], skills: { ...DEFAULT_SKILLS } });
});
async function show(spec: LevelSpec, result: RunResult, gift?: ShieldGift) {
  const { ResultScreen } = await import('./screens/ResultScreen');
  const { summary } = processRun(core(spec.number), spec, result, DAY);
  const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h);
  const noop = () => undefined;
  await act(async () => { root!.render(createElement(ResultScreen, { spec, result, summary, demo: true, gift, onRetry: noop, onNext: noop, onMap: noop })); });
}
const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe('takım kalkanı bölüm başında (YN-192)', () => {
  it('runSkills takım kalkanını harcar, bildirim kuyruğuna bir şey koymaz; şerit kaç kalkanla başlandığını söyler', () => {
    useStore.setState({ teamShields: 1, toasts: [] });
    const r = runSkills({ ...DEFAULT_SKILLS, shield: 1 });
    expect(r.gift).toEqual({ from: 'takim', n: 2 });
    expect(r.skills.shield).toBe(2);
    expect(useStore.getState().teamShields).toBe(0);
    expect(useStore.getState().toasts).toEqual([]);
    const spec = generateLevel(HUMAN_JOURNEY.id, 7, prof);
    expect(startLines(spec, r.gift)).toEqual([`3. yıldız: ${nodeGoalLines(spec).star3}`, 'Takım kalkanı devrede: bu bölüme 2 kalkanla başlıyorsun.']);
    // kalkan yoksa yalnız 3. yıldız satırı; takım kalkanı yoksa harcanmaz
    expect(runSkills({ ...DEFAULT_SKILLS, shield: 0 })).toEqual({ skills: { ...DEFAULT_SKILLS, shield: 0 } });
    expect(startLines(spec, undefined)).toEqual([`3. yıldız: ${nodeGoalLines(spec).star3}`]);
    expect(shieldStartLine({ from: 'takim', n: 1 })).toBe('Takım kalkanı devrede: bu bölüme kalkanla başlıyorsun.');
    expect(shieldStartLine({ from: 'atolye', n: 1, pct: 10 })).toBe('Atölye kalkanı devrede (%10 şans): bu bölüme kalkanla başlıyorsun.');
  });

  it('sonuç: vuruş gelmediyse de söyler; karşıladıysa kaç vuruşu (hasar yine sayılır)', () => {
    expect(shieldResultLine({ from: 'takim', n: 2 }, { extra: {} })).toBe('Takım kalkanı bu bölümde seninleydi, vuruş gelmedi. Takım kalkanı bölüm başında harcanır.');
    // karşıladıysa kaç çarpmayı (YN-229; sayılar sonuc-kalkan-seviye.test'te)
    expect(nb(shieldResultLine({ from: 'takim', n: 2 }, { extra: { guarded: 1 } }))).toBe('Kalkan 1 çarpmayı karşıladı.');
    expect(nb(shieldResultLine({ from: 'takim', n: 3 }, { extra: { guarded: 2 } }))).toBe('Kalkan 2 çarpmayı karşıladı.');
    expect(shieldResultLine({ from: 'atolye', n: 1, pct: 10 }, { extra: {} })).toBe('Atölye kalkanı bu bölümde seninleydi, vuruş gelmedi.');
  });
  it('sonuç: karşılanan vuruş yokken hasar varsa nedeni (kalkan düşüşü karşılamaz; YN-202, OT-ilk-kez-oyun-60)', () => {
    expect(nb(shieldResultLine({ from: 'takim', n: 1 }, { extra: {}, damageTaken: 0 }))).toBe('Takım kalkanı bu bölümde seninleydi, vuruş gelmedi. Takım kalkanı bölüm başında harcanır.');
    // hasar sayısı satırda geçmez (kayıpta neden kartının başında; YN-229)
    expect(nb(shieldResultLine({ from: 'takim', n: 1 }, { extra: {}, damageTaken: 1 }))).toBe('Kalkan kullanılmadı: hasarların hepsi düşmeydi (kalkan düşmeyi karşılamaz).');
    expect(nb(shieldResultLine({ from: 'atolye', n: 2 }, { extra: {}, damageTaken: 2 }))).toBe('Kalkan kullanılmadı: hasarların hepsi düşmeydi (kalkan düşmeyi karşılamaz).');
    // karşıladıysa kaç çarpmayı ve kaç kez düşüldüğünü (karar 37: vuruş yine hasar sayılır, neden kartı toplamı söyler)
    expect(nb(shieldResultLine({ from: 'takim', n: 2 }, { extra: { guarded: 1, falls: 2 }, damageTaken: 3 }))).toBe('Kalkan 1 çarpmayı karşıladı; 2 kez düştün.');
  });
  it('sonuç ekranı: kazançta kalkan satırı, kayıpta neden kartının hasar cümlesinde', async () => {
    const spec = generateLevel(HUMAN_JOURNEY.id, 7, prof);
    await show(spec, run(spec), { from: 'takim', n: 2 });
    expect(q('sonuc-kalkan')?.textContent).toBe('Takım kalkanı bu bölümde seninleydi, vuruş gelmedi. Takım kalkanı bölüm başında harcanır.');
    await act(async () => { root!.unmount(); }); document.body.innerHTML = '';
    // kalkanla başlanan kayıpta karşılanan vuruş yoksa hasar düşüştendir (kalkan çarpmayı karşılardı; YN-202)
    await show(spec, run(spec, { completed: false, damageTaken: 3, coins: 4, extra: { reason: 'fall', pct: 0.6 } }), { from: 'takim', n: 2 });
    expect(q('sonuc-kalkan')).toBeNull();
    expect(nb(q('sonuc-neden-hasar')?.textContent)).toBe('3 kez hasar aldın, en son boşluğa düştün. Kalkan kullanılmadı: hasarların hepsi düşmeydi (kalkan düşmeyi karşılamaz).');
    // kalkansız koşuda satır yok
    await act(async () => { root!.unmount(); }); document.body.innerHTML = '';
    await show(spec, run(spec));
    expect(q('sonuc-kalkan')).toBeNull();
  });
});

describe('3. yıldız kartı (YN-191)', () => {
  it('yıldız hedefle alındı: tutan satır işaretli (met), tutmayan nota satırı kart .met altında soluk', async () => {
    const spec = generateLevel(HUMAN_JOURNEY.id, 16, prof); expect(spec.objective.id).toBe('secret');
    const r = run(spec, { objectiveMet: true, extra: { maxCombo: 5, cochleas: 3, cochleasTotal: 3 } });
    expect(r.stars).toBe(3);
    await show(spec, r);
    const card = q('sonuc-yildiz3')!; expect(card.classList.contains('met')).toBe(true);
    const rows = [...card.querySelectorAll('li')];
    expect(rows.map((li) => li.classList.contains('met'))).toEqual([false, true]);
    expect(nb(rows[0]!.querySelector('.rs3-n')?.textContent)).toMatch(/^\d+ nota kaldı$/);
    expect(rows[1]!.querySelector('.rs3-n')?.textContent).toBe('tamam');
    // tutan satırın tiki büyük (20), tutmayanın boş yuvası 16
    expect(rows[1]!.querySelector('svg')?.getAttribute('width')).toBe('20');
    expect(rows[0]!.querySelector('svg')?.getAttribute('width')).toBe('16');
  });
  it('"ya da" koşulunun yalnız nota parçası tuttu: tik ve "tamam" yok, parça nötr "var", eksik parça "eksik" (OT-buyuk-yazi-74, YN-262)', async () => {
    const spec = generateLevel(HUMAN_JOURNEY.id, 16, prof); expect(spec.objective.id).toBe('secret');
    const r = run(spec, { coins: Math.ceil(spec.coinsTotal * 0.62), objectiveMet: false, extra: { maxCombo: 5, cochleas: 0, cochleasTotal: 3 } });
    expect(r.stars).toBe(2);
    await show(spec, r);
    const card = q('sonuc-yildiz3')!; expect(card.classList.contains('met')).toBe(false);
    const li = [...card.querySelectorAll('li')][1]!;
    expect(li.classList.contains('met')).toBe(false);
    expect(li.querySelectorAll('svg.art-check')).toHaveLength(0);
    expect(nb(li.querySelector('.rs3-n')?.textContent)).toMatch(/^\d+ nota: var · 0\/3 altın koklea: eksik$/);
    expect(nb(li.querySelector('.rs3-p.ok')?.textContent)).toMatch(/^\d+ nota: var$/);
    expect(nb(li.querySelector('.rs3-p.eksik')?.textContent)).toMatch(/0\/3 altın koklea: eksik$/);
    expect(card.textContent).not.toMatch(/tamam/);
  });
});

describe('Biliyor muydun? sonuç ekranında son gösterilenden farklı (YN-175)', () => {
  it('ResultScreen useBiliyorMuydun ile seçer: gösterilen satır kayda (bilgiSonlar) yazılır, aynı biyomda art arda tekrar etmez', async () => {
    const spec13 = generateLevel(HUMAN_JOURNEY.id, 13, prof);
    await show(spec13, run(spec13));
    const a = q('biliyor-muydun')?.textContent; expect(a).toBeTruthy();
    expect(useStore.getState().bilgiSonlar.at(-1)).toBe(13);
    await act(async () => { root!.unmount(); }); document.body.innerHTML = '';
    // aynı bölüm yine ilk denemeymiş gibi açılsa da (tekrar 0) az önce gösterilen satır gelmez: Kemikçikler'in öteki satırı
    await show(spec13, run(spec13));
    expect(q('biliyor-muydun')?.textContent).not.toBe(a);
    expect(useStore.getState().bilgiSonlar.at(-1)).not.toBe(13);
  });
});
