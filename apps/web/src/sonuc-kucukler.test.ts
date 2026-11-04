// @vitest-environment jsdom
// YN-173 (oyuncu testi tur 10): sonuç ekranının küçükleri, gerçek parçalarla (üretici, yıldız kuralı, meta kaydı, ekran).
//  1) sis/gece kaybında "Yüksek görünürlüğü aç" düğmesi store'daki ayarı açar, yerinde söyler (OT-buyuk-yazi-52)
//  2) süre kutusunda "par" yok: "120 sn altı bonus"; süreli bölümde "süre" (OT-ilk-kez-oyun-54, OT-rekabetci-2)
//  3) her başarım satırı koşulunu {n} doldurulmuş yazar (OT-ekonomi-denetci-35)
//  4) melodi bölümünde "Melodi tamam" / "Melodi: 5/7 sırayla" (OT-sinav-adayi-35)
//  5) hazine satırı jeton dışı ödülleri de yazar; toplam cüzdanla birebir (OT-sinav-adayi-36, OT-ekonomi-denetci-1)
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ACHIEVEMENTS, COSMETICS, DEFAULT_SKILLS, HUMAN_JOURNEY, TIER_NAMES, type Tier } from '@odi/content';
import { generateLevel } from '@odi/level-gen';
import { defaultMeta, earnLines, processRun, xpThreshold, type PlayerCore, type RunSummary } from '@odi/meta';
import { scoreRun, type LevelSpec, type RunResult } from '@odi/shared';
import { hazineNotlu, melodiSatir, sureAlt } from './screens/sonuc-satir';

vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined } }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const DAY = '2026-11-04';
const prof = { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS };
const core = (n: number, meta = defaultMeta()): PlayerCore => {
  const progress: PlayerCore['progress'] = {}; for (let i = 1; i < n; i++) progress[i] = { stars: 2, best: 600, plays: 1 };
  return { progress, coins: 500, xp: xpThreshold(3) + 40, streak: 1, lastDay: DAY, failStreak: 0, skills: { ...DEFAULT_SKILLS }, meta };
};
const run = (spec: LevelSpec, completed: boolean, extra: RunResult['extra'] = {}, objectiveMet = false): RunResult => {
  const base = { levelId: spec.id, completed, coins: completed ? Math.ceil(spec.coinsTotal * 0.5) : 4, timeSec: spec.parTimeSec - 4, deaths: 0, damageTaken: completed ? 1 : 3, objectiveMet, secretFound: false, extra: { maxCombo: 5, ...(completed ? {} : { reason: 'fall', pct: 0.8 }), ...extra } };
  return { ...base, ...scoreRun(spec, base) };
};
const levelOf = (pred: (spec: LevelSpec) => boolean) => { for (const l of HUMAN_JOURNEY.levels) { const s = generateLevel(HUMAN_JOURNEY.id, l.number, prof); if (pred(s)) return s; } throw new Error('bölüm yok'); };

let root: Root | null = null;
afterEach(async () => {
  const { useStore } = await import('./store');
  await act(async () => { root?.unmount(); useStore.setState({ highVis: false, toasts: [] }); });
  root = null; document.body.innerHTML = '';
});
async function show(spec: LevelSpec, result: RunResult, summary: RunSummary) {
  const { ResultScreen } = await import('./screens/ResultScreen');
  const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h);
  const noop = () => undefined;
  await act(async () => { root!.render(createElement(ResultScreen, { spec, result, summary, demo: true, onRetry: noop, onNext: noop, onMap: noop })); });
}
const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe('sonuç ekranı küçükleri (YN-173)', () => {
  it('sis kaybı: "Yüksek görünürlüğü aç" düğmesi ayarı açar ve açıldığını yerinde söyler; ayar açıksa yalnız "açık"', async () => {
    const { useStore } = await import('./store');
    const spec = levelOf((s) => (s.modifiers ?? []).includes('sis'));
    const r = run(spec, false); const { summary } = processRun(core(spec.number), spec, r, DAY);
    useStore.setState({ highVis: false });
    await show(spec, r, summary);
    const btn = q('sonuc-gorunurluk-ac');
    expect(btn?.tagName).toBe('BUTTON'); expect(btn?.textContent).toBe('Yüksek görünürlüğü aç');
    expect(q('sonuc-gorunurluk-durum')?.getAttribute('role')).toBe('status'); expect(q('sonuc-gorunurluk-durum')?.textContent).toBe('');
    await act(async () => { btn!.click(); });
    expect(useStore.getState().highVis).toBe(true);
    expect(q('sonuc-gorunurluk-ac')).toBeNull();
    expect(q('sonuc-gorunurluk-durum')?.textContent).toMatch(/^Yüksek görünürlük açıldı/);
    // ayar zaten açıkken açılan ekran
    await act(async () => { root!.unmount(); }); document.body.innerHTML = '';
    await show(spec, r, summary);
    expect(q('sonuc-gorunurluk-ac')).toBeNull();
    expect(q('sonuc-gorunurluk-durum')?.textContent).toBe('Yüksek görünürlük açık');
  });

  it('süre kutusu: "par" yazmaz; süre bonusunun ölçüsü oyuncu diliyle, süreli bölümde "süre"', async () => {
    const spec = levelOf((s) => s.objective.id !== 'timed' && s.coinsTotal > 0);
    expect(sureAlt(spec)).toBe(`${spec.parTimeSec} sn altı bonus`);
    expect(sureAlt({ objective: { id: 'timed', label: '', target: 60 }, parTimeSec: 90 } as LevelSpec)).toBe('süre');
    const r = run(spec, true); const { summary } = processRun(core(spec.number), spec, r, DAY);
    await show(spec, r, summary);
    expect(q('sonuc-sure-alt')?.textContent).toBe(`${spec.parTimeSec} sn altı bonus`);
    expect(document.querySelector('.result .stats')?.textContent).not.toMatch(/\bpar\b/);
  });

  it('her başarımın her kademesi dökümde koşulunu {n} doldurulmuş yazar (tek satırda da, toplu satırda da)', () => {
    for (const a of ACHIEVEMENTS) for (const t of [1, 2, 3] as Tier[]) {
      if (t > a.tiers.length) continue;
      const one = earnLines({ grants: [{ reason: `basarim:${a.id}:${t}`, items: [{ kind: 'jeton', amount: 40 }] }] });
      expect(one[0]!.label).toContain(TIER_NAMES[t]);
      expect(one[0]!.note, `${a.id}:${t}`).toBeTruthy(); expect(one[0]!.note).not.toContain('{n}');
    }
  });

  it('Moda Kulağı seviye ödülü kozmetikle gelince: "Başarım: Moda Kulağı · Gümüş" satırının altında "7 kozmetiğe sahip ol", ekranda da', async () => {
    const spec = generateLevel(HUMAN_JOURNEY.id, 16, prof);
    const meta = defaultMeta();
    // 6. seviyenin kozmetiği (Bal Kehribarı) 7. kozmetik olur: seviye ödülü ve takvim dışındakilerden 6'ya tamamla
    const own = COSMETICS.filter((c) => c.id !== 'renk-amber' && c.unlock.by !== 'level' && c.unlock.by !== 'achievement').map((c) => c.id);
    meta.cosmetics.owned = [...new Set([...meta.cosmetics.owned, ...own])].slice(0, 6); meta.achievements = { 'moda-kulagi': 1 };
    const c = { ...core(16, meta), xp: xpThreshold(6) - 5 };
    expect(c.meta.cosmetics.owned).toHaveLength(6);
    const r = run(spec, true); const { core: after, summary } = processRun(c, spec, r, DAY);
    const lines = earnLines(summary);
    const ach = lines.find((l) => l.label.includes('Moda Kulağı') || l.items?.some((x) => x.label.includes('Moda Kulağı')));
    const line = ach?.items?.find((x) => x.label.includes('Moda Kulağı')) ?? ach;
    expect(line?.label).toMatch(/Moda Kulağı · Gümüş$/); expect(line?.note).toBe('7 kozmetiğe sahip ol');
    expect(lines.reduce((a, l) => a + l.jeton, 0)).toBe(after.coins - c.coins);
    await show(spec, r, summary);
    expect(q('sonuc-kazanc')?.textContent).toContain('7 kozmetiğe sahip ol');
  });

  it('melodi: koşunun kendi sayısıyla "Melodi: 5/7 sırayla" ya da "Melodi tamam"; sayı yoksa sahte sayı yok', async () => {
    const spec = levelOf((s) => s.objective.id === 'melody');
    const total = spec.objective.target ?? 7;
    expect(melodiSatir(spec, run(spec, true, { melody: 5, melodyTotal: total }))).toBe(`Melodi: 5/${total}\u00a0sırayla`);
    expect(melodiSatir(spec, run(spec, true, { melody: total, melodyTotal: total }, true))).toBe('Melodi tamam');
    expect(melodiSatir(spec, run(spec, false, { melody: 2, melodyTotal: total }))).toBe(`Melodi: 2/${total}\u00a0sırayla`);
    // sayı yoksa yalnız tamam / tamamlanmadı; kayıpta bilinmiyorsa satır yok
    expect(melodiSatir(spec, run(spec, true, {}, true))).toBe('Melodi tamam');
    expect(melodiSatir(spec, run(spec, true, {}, false))).toBe('Melodi tamamlanmadı');
    expect(melodiSatir(spec, run(spec, false, {}))).toBeNull();
    expect(melodiSatir(levelOf((s) => s.objective.id !== 'melody'), run(spec, true, { melody: 3, melodyTotal: 7 }))).toBeNull();
    const r = run(spec, true, { melody: 5, melodyTotal: total }); const { summary } = processRun(core(spec.number), spec, r, DAY);
    await show(spec, r, summary);
    expect(q('sonuc-melodi')?.textContent).toBe(`Melodi: 5/${total}\u00a0sırayla`);
  });

  it('hazine: Bölüm 10 "Ayrıca: ×1 Seri koruyucu", Bölüm 15 "Ayrıca: Kulaklık"; toplam = cüzdan artışı', async () => {
    for (const [n, note] of [[10, 'Ayrıca: ×1 Seri koruyucu'], [15, 'Ayrıca: Kulaklık']] as const) {
      const spec = generateLevel(HUMAN_JOURNEY.id, n, prof); const c = core(n);
      const r = run(spec, true); const { core: after, summary } = processRun(c, spec, r, DAY);
      const lines = hazineNotlu(earnLines(summary), summary.grants);
      const h = lines.find((l) => l.label === `Bölüm ${n} hazinesi`);
      expect(h?.note).toBe(note);
      expect(lines.reduce((a, l) => a + l.jeton, 0)).toBe(after.coins - c.coins);
      if (n === 10) { await show(spec, r, summary); expect(q('sonuc-kazanc')?.textContent).toContain(note); }
    }
  });
});
