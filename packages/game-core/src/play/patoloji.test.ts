import { describe, expect, it } from 'vitest';
import { GROUND_Y as G, type Entity, type LevelSpec } from '@odi/shared';
import { DEFAULT_SKILLS } from '@odi/content';
import { generateLevel, PATOLOJI_ZONE } from '@odi/level-gen';
import { buildWorld } from './world';
import { cloneState, initState, step, NO_INPUT, type SimState } from './sim';
import { REMEDY_MAX_USES, type RemedyIn } from './remedy';
import { runHuman, humanSeed, playerOf } from './human';
import { testSpec } from './testkit';
import type { World } from './world';

/**
 * Tedavi Odası malzemesinin bölümdeki etkisi (docs/14-kamp.md §4; play/remedy.ts): patoloji engelinin ilk karşılaşması bir kez
 * etkisiz, en ucuz malzeme önce, bölüm başına en çok 4; malzemesiz koşu (ölçümler, boşta oyuncu) işaretlemeden etkilenmez.
 */
const floor: Entity = { type: 'platform', x: 0, y: G, w: 3000, h: 200 };
const cloud = (x: number, pat: string): Entity => ({ type: 'hazard', x, y: G - 70, w: 70, h: 70, props: { kind: 'gurultu', patoloji: pat } });
function world(ents: Entity[], remedies?: RemedyIn[]): { w: World; s: SimState } {
  const spec = testSpec(ents, { number: 30 });
  const w = buildWorld(spec, { skills: DEFAULT_SKILLS, bpm: 100 }); const s = initState(w, { shield: 0, remedies }); return { w, s };
}
const runFor = (w: World, s: SimState, n: number) => { for (let i = 0; i < n && !s.failed; i++) step(w, s, NO_INPUT); };
/** ilk can kaybı ya da malzeme kullanımı olana dek koş */
function firstHit(w: World, s: SimState): 'remedy' | 'hurt' | null {
  s.events = [];
  for (let i = 0; i < 900 && !s.failed; i++) {
    step(w, s, NO_INPUT);
    for (const e of s.events!) { if (e.k === 'remedy') return 'remedy'; if (e.k === 'hurt' && e.s !== 'shield') return 'hurt'; }
    s.events!.length = 0;
  }
  return null;
}

describe('patoloji engeli ve Tedavi Odası malzemesi', () => {
  it('uygun malzeme gürültü bulutunun ilk çarpmasını etkisiz kılar; malzemesiz can gider', () => {
    const a = world([floor, cloud(500, 'gurultu-hasari')], [{ id: 'kulak-tikaci', count: 1 }]);
    expect(firstHit(a.w, a.s)).toBe('remedy');
    runFor(a.w, a.s, 120);
    expect(a.s.damageTaken).toBe(0); expect(a.s.remUsed).toEqual({ 'kulak-tikaci': 1 }); expect(a.s.rem['kulak-tikaci']).toBe(0);
    expect(a.s.cured.size).toBe(1);
    const b = world([floor, cloud(500, 'gurultu-hasari')]);
    expect(firstHit(b.w, b.s)).toBe('hurt');
  });
  it('uygun olmayan malzeme, bilinmeyen kimlik ve malzemesi olmayan patoloji (Meniere) korumaz', () => {
    const hit = (ents: Entity[], rem: RemedyIn[]) => { const a = world(ents, rem); return firstHit(a.w, a.s); };
    expect(hit([floor, cloud(500, 'gurultu-hasari')], [{ id: 'zar-yamasi', count: 3 }, { id: 'yok-boyle', count: 2 }])).toBe('hurt');
    expect(hit([floor, cloud(500, 'meniere')], [{ id: 'kulak-tikaci', count: 3 }])).toBe('hurt');
  });
  it('birden çok uygun malzemeden en ucuzu (en düşük seviye) harcanır', () => {
    const a = world([floor, cloud(500, 'presbiakuzi')], [{ id: 'koklear-implant', count: 1 }, { id: 'isitme-cihazi', count: 1 }]);
    expect(firstHit(a.w, a.s)).toBe('remedy');
    expect(a.s.remUsed).toEqual({ 'isitme-cihazi': 1 }); expect(a.s.rem['koklear-implant']).toBe(1);
  });
  it(`bölüm başına en çok ${REMEDY_MAX_USES} adet kullanılır`, () => {
    const ents = [floor, ...[400, 800, 1200, 1600, 2000, 2400].map((x) => cloud(x, 'gurultu-hasari'))];
    const a = world(ents, [{ id: 'kulak-tikaci', count: 9 }]);
    runFor(a.w, a.s, 60 * 14);
    expect(Object.values(a.s.remUsed).reduce((x, y) => x + y, 0)).toBe(REMEDY_MAX_USES);
    expect(a.s.rem['kulak-tikaci']).toBe(9 - REMEDY_MAX_USES);
  });
  it('patoloji çukuruna (zarın deliği) ilk düşüş malzemeyle can götürmez', () => {
    const ents: Entity[] = [{ type: 'platform', x: 0, y: G, w: 400, h: 200 }, { type: 'platform', x: 520, y: G, w: 2400, h: 200 }, { type: 'decor', x: 400, y: G, w: 120, props: { kind: PATOLOJI_ZONE, patoloji: 'perforasyon' } }];
    const a = world(ents, [{ id: 'zar-yamasi', count: 1 }]);
    expect(a.w.patZones.length).toBe(1);
    expect(firstHit(a.w, a.s)).toBe('remedy'); expect(a.s.damageTaken).toBe(0);
    // ikinci düşüş sayılır (yalnız ilk karşılaşma)
    expect(firstHit(a.w, a.s)).toBe('hurt');
    const b = world(ents);
    expect(firstHit(b.w, b.s)).toBe('hurt');
  });
  it('Östaki kapısı malzemeyle anahtarsız açılır; malzemesiz kahraman kapıda kalır', () => {
    const ents: Entity[] = [floor, { type: 'door', x: 600, y: G - 150, w: 36, h: 150, props: { id: 'k', patoloji: 'ostaki' } }, { type: 'switch', x: 2600, y: G, props: { id: 'k', by: 'temas' } }];
    const a = world(ents, [{ id: 'ventilasyon-tupu', count: 1 }]);
    runFor(a.w, a.s, 240);
    expect(a.s.opened.has('k')).toBe(true); expect(a.s.remUsed).toEqual({ 'ventilasyon-tupu': 1 });
    const b = world(ents);
    runFor(b.w, b.s, 240);
    expect(b.s.opened.has('k')).toBe(false); expect(b.s.hero.x).toBeLessThan(700);
  });
  it('planlayıcı kopyası malzemeyi kendi sayar (asıl durumu değiştirmez)', () => {
    const a = world([floor, cloud(500, 'gurultu-hasari')], [{ id: 'kulak-tikaci', count: 1 }]);
    const c = cloneState(a.s); firstHit(a.w, c);
    expect(c.remUsed).toEqual({ 'kulak-tikaci': 1 }); expect(a.s.remUsed).toEqual({}); expect(a.s.rem['kulak-tikaci']).toBe(1); expect(a.s.cured.size).toBe(0);
  });
  it('malzemesiz koşu işaretlemeden etkilenmez (ölçümler ve boşta oyuncu aynı)', () => {
    const strip = (sp: LevelSpec): LevelSpec => ({ ...sp, chunks: sp.chunks.map((c) => ({ ...c, entities: c.entities.filter((e) => e.props?.kind !== PATOLOJI_ZONE).map((e) => ({ ...e, props: e.props ? Object.fromEntries(Object.entries(e.props).filter(([k]) => k !== 'patoloji')) : e.props })) })) });
    for (const n of [9, 21]) {
      const sp = generateLevel('insan', n);
      const play = (spec: LevelSpec) => { const w = buildWorld(spec, { skills: DEFAULT_SKILLS, bpm: 100 }); const s = initState(w); s.events = null; return runHuman(w, s, humanSeed(n, 0), { maxT: 60, params: playerOf(0) }); };
      const x = play(sp), y = play(strip(sp));
      expect([x.t, x.damage, x.finished], `${n}`).toEqual([y.t, y.damage, y.finished]);
    }
  }, 120_000);
});
