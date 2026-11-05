// @vitest-environment jsdom
// YN-173 (oyuncu testi tur 10): sonuç ekranının küçükleri, gerçek parçalarla (üretici, yıldız kuralı, meta kaydı, ekran).
//  1) sis/gece kaybında "Yüksek görünürlüğü aç" düğmesi store'daki ayarı açar, yerinde söyler (OT-buyuk-yazi-52)
//  2) süre kutusunda "par" yok: "skora +20 süre bonusu" ya da suçlamadan "süre bonusu yok (120 sn altında gelir)"; süreli bölümde "süre"
//     (OT-ilk-kez-oyun-54, OT-rekabetci-2, OT-eski-telefon-34, OT-ilk-kez-oyun-79)
//  3) her başarım satırı koşulunu {n} doldurulmuş yazar (OT-ekonomi-denetci-35)
//  4) melodi bölümünde "Melodi tamam" / "Melodi: 5/7 sırayla" (OT-sinav-adayi-35)
//  5) hazine satırı jeton dışı ödülleri de yazar; toplam cüzdanla birebir (OT-sinav-adayi-36, OT-ekonomi-denetci-1)
//  6) YN-271: hedef tuttu ama 2. yıldız eksikse yıldızların altında sıra cümlesi, eksik nota sayısıyla (OT-ilk-kez-oyun-78)
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ACHIEVEMENTS, COSMETICS, DEFAULT_SKILLS, HUMAN_JOURNEY, TIER_NAMES, type Tier } from '@odi/content';
import { generateLevel } from '@odi/level-gen';
import { defaultMeta, earnLines, processRun, xpThreshold, type PlayerCore, type RunSummary } from '@odi/meta';
import { noteThresholds, scoreRun, type LevelSpec, type RunResult } from '@odi/shared';
import { hazineNotlu, hazineNotu, melodiSatir, sureAlt, yildizSirasi } from './screens/sonuc-satir';
import { itemPrefix } from './celebrate/CelebrationLayer';

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

  it('süre kutusu: "par" yazmaz; süre bonusu alındıysa gerçek değeri ve skora eklendiği, kaçtıysa suçlamadan neyle geldiği (OT-eski-telefon-34, OT-ilk-kez-oyun-79)', async () => {
    const spec = levelOf((s) => s.objective.id !== 'timed' && s.coinsTotal > 0); const par = spec.parTimeSec;
    const nb = (t: string) => t.replace(/\u00a0/g, ' ');
    // 4 sn erken: bonus skorun içinde gerçekten 20 puan (scoreRun'un hesabıyla aynı)
    const r = run(spec, true);
    const { score: parScore } = scoreRun(spec, { ...r, timeSec: par });
    expect(r.score - parScore).toBe(20);
    expect(nb(sureAlt(spec, r))).toBe('skora +20 süre bonusu');
    // OT-eski-telefon-34: 114 sn'de bonusun alınmadığı açık; OT-ilk-kez-oyun-79: "kaçırdın" yok (hedefi süre olmayan bölümde ödül kaybı sanıldı)
    expect(nb(sureAlt(spec, { completed: true, timeSec: par + 1 }))).toBe(`süre bonusu yok (${par} sn altında gelir)`);
    expect(nb(sureAlt(spec, { completed: true, timeSec: par + 11 }))).toBe(`süre bonusu yok (${par} sn altında gelir)`);
    expect(sureAlt(spec, { completed: true, timeSec: par + 0.4 })).not.toMatch(/kaçırdın/);
    expect(nb(sureAlt(spec, { completed: true, timeSec: par }))).toBe(`süre bonusu yok (tam ${par} sn)`);
    // kayıpta bonus yok: yalnız süre
    expect(sureAlt(spec, { completed: false, timeSec: 20 })).toBe('süre');
    expect(sureAlt({ objective: { id: 'timed', label: '', target: 60 }, parTimeSec: 90 } as LevelSpec, r)).toBe('süre');
    const { summary } = processRun(core(spec.number), spec, r, DAY);
    await show(spec, r, summary);
    expect(q('sonuc-sure-alt')?.textContent).toBe('skora +20 süre bonusu');
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

  it('hazine: Bölüm 10 "Ayrıca: ×1 Seri koruyucu", Bölüm 15 "Ayrıca: Kulaklık", Bölüm 35 "Ayrıca: +60 XP"; toplam = cüzdan artışı', async () => {
    // YN-240 (OT-sinav-adayi-44): XP "×60" (60 kat gibi) değil, haritadaki hazine penceresi gibi "+60 XP"
    for (const [n, note] of [[10, 'Ayrıca: ×1 Seri koruyucu'], [15, 'Ayrıca: Kulaklık'], [35, 'Ayrıca: +60 XP']] as const) {
      const spec = generateLevel(HUMAN_JOURNEY.id, n, prof); const c = core(n);
      const r = run(spec, true); const { core: after, summary } = processRun(c, spec, r, DAY);
      const lines = hazineNotlu(earnLines(summary), summary.grants);
      const h = lines.find((l) => l.label === `Bölüm ${n} hazinesi`);
      expect(h?.note).toBe(note);
      expect(lines.reduce((a, l) => a + l.jeton, 0)).toBe(after.coins - c.coins);
      if (n === 10) { await show(spec, r, summary); expect(q('sonuc-kazanc')?.textContent).toContain(note); }
    }
    // hazine penceresinin öneki aynı kuraldan: sayılan birim "+", eşya "×"
    expect([itemPrefix({ kind: 'xp' }), itemPrefix({ kind: 'kristal' }), itemPrefix({ kind: 'jeton' }), itemPrefix({ kind: 'koruyucu' })]).toEqual(['+', '+', '+', '×']);
    expect(hazineNotu([{ kind: 'xp', amount: 20 }, { kind: 'koruyucu', amount: 1 }])).toBe('Ayrıca: +20 XP · ×1 Seri koruyucu');
  });

  it('YN-271: hasarsız bitti ama 2. yıldız eksik: yıldızların altında sıra cümlesi ve eksik nota; 2. yıldızın kartı kutulardan önce (OT-ilk-kez-oyun-78)', async () => {
    const nb = (t: string | null | undefined) => (t ?? '').replace(/\u00a0/g, ' ');
    // Bölüm 25 (Tüy Hücresi Tarlası): 3. yıldız "hiç hasar alma ve N nota"; 2. yıldız N nota
    const spec = generateLevel(HUMAN_JOURNEY.id, 25, prof);
    expect(spec.objective.id).toBe('no-damage');
    const n2 = Math.ceil(spec.coinsTotal * noteThresholds(spec).star2 - 1e-9);
    const mk = (coins: number, damageTaken: number, objectiveMet: boolean): RunResult => {
      const base = { levelId: spec.id, completed: true, coins, timeSec: spec.parTimeSec - 4, deaths: 0, damageTaken, objectiveMet, secretFound: false, extra: { maxCombo: 5 } };
      return { ...base, ...scoreRun(spec, base) };
    };
    // (a) 1 yıldız + hasarsız: cümle var, eksik nota sayısı doğru
    const r1 = mk(n2 - 12, 0, true); expect(r1.stars).toBe(1);
    expect(nb(yildizSirasi(spec, r1))).toBe(`Hasarsız bitirdin: 3. yıldızın hedefi var, ama önce 2. yıldız gerekir (${n2} nota, 12 eksik).`);
    const { summary } = processRun(core(spec.number), spec, r1, DAY);
    await show(spec, r1, summary);
    expect(nb(q('sonuc-yildiz-sirasi')?.textContent)).toContain(`(${n2} nota, 12 eksik)`);
    // 2. yıldızın kartı nota/süre kutularından önce
    const stats = document.querySelector('.result .stats'); expect(stats?.firstElementChild?.getAttribute('data-testid')).toBe('sonuc-yildiz2');
    // (b) hedef tutmadı, 2 yıldız, 3 yıldız, Rahat deneme: cümle yok
    expect(yildizSirasi(spec, mk(n2 - 12, 1, false))).toBeNull();
    const r2 = mk(n2, 0, true); expect(r2.stars).toBe(3); expect(yildizSirasi(spec, r2)).toBeNull();
    expect(yildizSirasi(spec, { ...r1, stars: 2 })).toBeNull();
    expect(yildizSirasi(spec, { ...r1, rahat: true })).toBeNull();
    // hedef 3★'ı kendi başına verenlerde (süreli) ve hedef saymayan bölümde (yalnız kapı) cümle yok
    expect(yildizSirasi({ ...spec, objective: { id: 'timed', label: '', target: 60 } }, r1)).toBeNull();
    expect(yildizSirasi({ ...spec, objective: { id: 'reach', label: '' } }, r1)).toBeNull();
    // cümle yokken 2. yıldızın kartı yerinde (kutulardan sonra)
    const r3 = mk(n2 - 12, 1, false); const s3 = processRun(core(spec.number), spec, r3, DAY).summary;
    await act(async () => { root!.unmount(); }); document.body.innerHTML = '';
    await show(spec, r3, s3);
    expect(q('sonuc-yildiz-sirasi')).toBeNull();
    expect(document.querySelector('.result .stats')?.lastElementChild?.getAttribute('data-testid')).toBe('sonuc-yildiz2');
  });

  it('YN-271: yüzmede 2. yıldız %45, hedefle 3. yıldız %60 nota ister: cümle ikisini de söyler', () => {
    const nb = (t: string | null) => (t ?? '').replace(/\u00a0/g, ' ');
    const spec = levelOf((s) => s.mechanic === 'yuzme' && s.objective.id === 'secret' && s.coinsTotal > 0);
    const th = noteThresholds(spec); const at = (x: number) => Math.ceil(spec.coinsTotal * x - 1e-9);
    const n2 = at(th.star2); const need = at(th.star3Objective!); expect(need).toBeGreaterThan(n2);
    const base = { levelId: spec.id, completed: true, coins: n2 - 1, timeSec: spec.parTimeSec, deaths: 0, damageTaken: 0, objectiveMet: true, secretFound: true, extra: { cochleas: 3, cochleasTotal: 3 } };
    const r = { ...base, ...scoreRun(spec, base) }; expect(r.stars).toBe(1);
    expect(nb(yildizSirasi(spec, r))).toBe(`Altın kokleaların hepsini buldun: 3. yıldızın hedefi var, ama önce 2. yıldız (${n2} nota) ve hedefle ${need} nota gerekir (${need - n2 + 1} eksik).`);
  });
});
