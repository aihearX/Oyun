import { describe, expect, it } from 'vitest';
import type { LevelSpec, ModifierId, ObjectiveSpec, RunResult } from '@odi/shared';
import { ABILITIES, ALL_CHUNKS, HUMAN_JOURNEY, MECHANICS } from '@odi/content';
import { lossView, star3View } from './index';

/** YN-254 (OT-ilk-kez-oyun-73) nefes her kayıpta anlatılır; YN-262 (OT-buyuk-yazi-74) tutmayan "ya da" koşulunda "tamam" yok */
const run = (over: Partial<RunResult> = {}): RunResult => ({ levelId: 'x', completed: true, stars: 2, score: 700, coins: 62, timeSec: 50, deaths: 0, damageTaken: 1, objectiveMet: false, secretFound: false, ...over });
const spec = (n: number, objective: ObjectiveSpec, over: Partial<LevelSpec> = {}) => {
  const l = HUMAN_JOURNEY.levels[n - 1]!;
  return { number: n, name: l.name, biome: l.biome, mechanic: l.mechanic, objective, parTimeSec: 60, coinsTotal: 100, modifiers: [], ...over };
};

describe('nefes kaybı: ipucu her denemede nefes (YN-254)', () => {
  const lost = (reason: string) => run({ completed: false, stars: 0, damageTaken: 3, extra: { reason } });
  const NEFES = /nefes/i;
  it('22-23 (sis/gece değiştiricisi olsa da) 7 kayıbın hepsinde birinci satır nefes; değiştirici/mekanik ipucu yalnız ikinci satır', () => {
    for (const n of [21, 22, 23]) for (const mods of [[], ['sis'], ['gece', 'hiz']] as ModifierId[][]) {
      const sp = spec(n, { id: 'reach', label: 'x' }, { modifiers: mods });
      expect(sp.mechanic).toBe('yuzme');
      const views = [1, 2, 3, 4, 5, 6, 7].map((a) => lossView(lost('nefes'), sp, a));
      for (const v of views) {
        expect(v.detail).toBe('3 kez hasar aldın, en son nefesin tükendi.');
        expect(v.tip).toMatch(NEFES); expect(v.tip).toMatch(/yüzeye çık/);
        expect(v.tip2 ?? '').not.toBe(v.tip);
      }
      expect(new Set(views.map((v) => v.tip)).size).toBe(1);
      // değiştiricinin ipucu kaybolmaz, ikinci satırda sırayla gelir
      if (mods.includes('sis')) expect(views.some((v) => /^Siste/.test(v.tip2 ?? ''))).toBe(true);
    }
  });
  it('diyapazon (freq) kaybında da aynı kural', () => {
    const sp = spec(24, { id: 'reach', label: 'x' }, { modifiers: ['sis'] });
    for (const a of [1, 2, 3, 4]) expect(lossView(lost('freq'), sp, a).tip).toBe('Kapıdan önce diyapazona değ: rengin kapıyla aynı olsun.');
  });
  it('yüzmenin mekanik ipucu, yetenek tanıtımı ve öğretici oda nefesi anlatır', () => {
    expect(MECHANICS.yuzme.hint).toMatch(/nefes/);
    expect(MECHANICS.yuzme.hint.split(' · ')).toContain('Su altında nefesin azalır: yüzeye çık ya da kabarcığa değ');
    expect(ABILITIES.yuz.how).toMatch(/nefesin azalır/);
    const oda = ALL_CHUNKS.find((c) => c.id === 'ogret-yuz')!;
    expect(oda.entities.some((e) => e.type === 'text' && /nefes/.test(String(e.props?.text)))).toBe(true);
  });
});

describe('3. yıldız: tutmayan "ya da" koşulunda tik ve "tamam" yok (YN-262)', () => {
  it('5. bölüm benzeri: 59 nota tuttu, 0/3 altın koklea → "59 nota: var · 0/3 altın koklea: eksik"', () => {
    const sp = spec(5, { id: 'secret', label: '3 altın kokleayı bul' }, { coinsTotal: 98 });
    const row = star3View(sp, run({ coins: 62, extra: { cochleas: 0, cochleasTotal: 3 } })).rows[1]!;
    expect(row.done).toBe(false);
    expect(row.parts).toEqual([{ text: '59 nota: var', done: true }, { text: '0/3 altın koklea: eksik', done: false }]);
  });
  it('hiçbir hedefte kısmi koşulun parçası "tamam" demez', () => {
    const objs: ObjectiveSpec[] = [{ id: 'secret', label: '3 altın kokleayı bul' }, { id: 'melody', target: 7, label: 'Notaları sırayla topla (7)' }, { id: 'no-damage', label: 'Hiç hasar alma' }, { id: 'escort', label: 'Fısıltıyı kapıya taşı' }, { id: 'timed', target: 64, target2: 75, label: '64 saniyede bitir' }];
    for (const o of objs) for (const n of [5, 15, 26]) for (const coins of [40, 62, 70]) for (const objectiveMet of [false, true]) {
      const rows = star3View(spec(n, o), run({ coins, objectiveMet, damageTaken: objectiveMet ? 0 : 1, extra: { cochleas: objectiveMet ? 3 : 1, cochleasTotal: 3, melody: objectiveMet ? 7 : 3, melodyTotal: 7 } })).rows;
      for (const r of rows) if (!r.done) expect(`${r.note} ${(r.parts ?? []).map((p) => p.text).join(' ')}`, `${o.id} ${n} ${coins} ${objectiveMet}`).not.toMatch(/tamam/);
    }
  });
});
