import { describe, expect, it } from 'vitest';
import { GROUND_Y as G, type Entity, type LevelSpec } from '@odi/shared';
import { DEFAULT_SKILLS } from '@odi/content';
import { generateLevel } from '@odi/level-gen';
import * as C from './consts';
import { press, run, setup, testSpec } from './testkit';
import { canTurn, step } from './sim';

/**
 * İlk bölümlerin yardımları (docs/12 §4): yavaş koşu, uzun coyote/tampon, can götürmeyen ilk düşüşler, öğretici odasında can
 * kaybı yok, gerektiği yer dışında geri dönüş kilidi; içerik: 1. bölümde diken/düşman yok, 1-3'te küçük çukur ve hareketli
 * basamak yok, 1-5'te her odada kontrol noktası.
 */
const gen = (n: number, salt = 0) => generateLevel('insan', n, { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS }, salt);
const assisted = (entities: Entity[], assist: Partial<NonNullable<LevelSpec['assist']>>, o: Parameters<typeof testSpec>[1] = {}) => {
  const spec = testSpec([{ type: 'platform', x: 0, y: G, w: 3000, h: 200 }, ...entities], o);
  spec.assist = { run: 190, coyote: 0.16, buffer: 0.2, freeFalls: 0, turnOnlyWhenNeeded: true, swipePx: 64, ...assist };
  return setup(spec);
};

describe('ilk bölümler: motor yardımları', () => {
  it('koşu hızı bölüm düğmesidir: 1. bölüm 190, 2. 205, 3. 220 px/sn … 8. bölümde 260; 9. bölümden itibaren yardım yok', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((n) => gen(n).assist?.run)).toEqual([190, 205, 220, 235, 242, 248, 255, 260]);
    for (const n of [9, 12, 30]) expect(gen(n).assist).toBeUndefined();
    const { w, s } = assisted([], {}); run(w, s, 60); const x0 = s.hero.x; run(w, s, 60);
    expect(s.hero.x - x0).toBeCloseTo(190, -1);
  });
  it('1-3: coyote 0,16 sn (kenardan 0,15 sn sonra hâlâ zıplanır), tampon 0,20 sn', () => {
    const a = gen(1).assist!; expect(a.coyote).toBe(0.16); expect(a.buffer).toBe(0.2); expect(gen(4).assist!.coyote).toBe(0.13);
    const spec = testSpec([{ type: 'platform', x: 0, y: G, w: 200, h: 200 }]); spec.assist = { ...a };
    const { w, s } = setup(spec);
    let off = -1; for (let i = 0; i < 300 && off < 0; i++) { step(w, s, press()); if (!s.hero.grounded) off = i; }
    run(w, s, Math.round(0.15 / C.DT) - 1);
    step(w, s, press({ pressed: true, down: true }));
    expect(s.hero.vy).toBeLessThan(-400);
  });
  it('1. bölümün ilk iki düşüşü can götürmez, üçüncüsü götürür', () => {
    const spec = testSpec([{ type: 'platform', x: 0, y: G, w: 300, h: 200 }, { type: 'platform', x: 420, y: G, w: 2000, h: 200 }], { number: 1 });
    spec.assist = { ...gen(1).assist! }; expect(spec.assist.freeFalls).toBe(2);
    const { w, s } = setup(spec);
    const lives: number[] = [];
    for (let i = 0; i < 60 * 40 && lives.length < 3; i++) { const d = s.deaths; step(w, s, press()); if (s.deaths > d) lives.push(s.lives); }
    expect(lives).toEqual([3, 3, 2]);
    expect(s.damageTaken).toBe(1);
  });
  it('öğretici odasında tehlike can götürmez (yardımlı bölüm)', () => {
    const spec = gen(3); const w0 = setup(spec).w;
    expect(w0.assist.grace.length).toBeGreaterThan(0);
    const spike: Entity = { type: 'spike', x: 300, y: G, w: 40 };
    const s1 = testSpec([{ type: 'platform', x: 0, y: G, w: 3000, h: 200 }, spike]); s1.chunks[0]!.tags = ['ogretici']; s1.assist = { ...gen(3).assist! };
    const a = setup(s1); run(a.w, a.s, 120);
    expect(a.s.lives).toBe(3);
    const s2 = testSpec([{ type: 'platform', x: 0, y: G, w: 3000, h: 200 }, spike]); s2.assist = { ...gen(3).assist! };
    const b = setup(s2); run(b.w, b.s, 120);
    expect(b.s.lives).toBe(2);
  });
  it('geri dönüş: yetenek açılmadan hiç; ilk bölümlerde yalnız anahtar/kapı yakınken; ileri yöne dönüş serbest', () => {
    const noDon = assisted([], {}, { abilities: ['zipla'], number: 1 }); run(noDon.w, noDon.s, 10);
    step(noDon.w, noDon.s, press({ turn: true })); expect(noDon.s.hero.dir).toBe(1);
    const free = assisted([], {}, { number: 3 }); run(free.w, free.s, 10);
    expect(canTurn(free.w, free.s)).toBe(false);
    step(free.w, free.s, press({ turn: true })); expect(free.s.hero.dir).toBe(1);
    const sw: Entity = { type: 'switch', x: 300, y: G - 180, props: { id: 'k1', by: 'temas' } };
    const need = assisted([sw, { type: 'door', x: 700, y: G - 240, w: 36, h: 240, props: { id: 'k1' } }], {}, { number: 3 }); run(need.w, need.s, 10);
    expect(canTurn(need.w, need.s)).toBe(true);
    step(need.w, need.s, press({ turn: true })); expect(need.s.hero.dir).toBe(-1);
    run(need.w, need.s, 30); need.s.opened.add('k1');
    step(need.w, need.s, press({ turn: true })); expect(need.s.hero.dir).toBe(1);
    // yardımsız (sonraki bölümler): her yerde
    const late = setup(testSpec([{ type: 'platform', x: 0, y: G, w: 3000, h: 200 }])); run(late.w, late.s, 10);
    step(late.w, late.s, press({ turn: true })); expect(late.s.hero.dir).toBe(-1);
  });
  it('ilk bölümlerde basamağa takılan kahraman geri koşmaz, zıplamayı bekler', () => {
    const { w, s } = assisted([{ type: 'platform', x: 400, y: G - 60, w: 200, h: 60 }], {}, { number: 3 });
    run(w, s, 60 * 6);
    expect(s.hero.dir).toBe(1); expect(s.hero.x).toBeGreaterThan(C.START_PAD + 360);
  });
});

describe('ilk bölümler: içerik', () => {
  const salts = [0, 1, 2, 3];
  it('1. bölümde diken, düşman ve tehlike alanı yok; 1-2. bölümde (öğretici odası dışında) çukurlar en çok 70 px', () => {
    for (const salt of salts) {
      const sp = gen(1, salt);
      for (const c of sp.chunks) expect(c.entities.filter((e) => ['spike', 'enemy', 'hazard'].includes(e.type)).map((e) => `${c.id}:${e.type}`)).toEqual([]);
      for (const n of [1, 2]) for (const c of gen(n, salt).chunks) {
        // öğretici odası (basamaklı "basılı tut" çukuru) can götürmez: ölçüye girmez
        if (c.entities.some((e) => e.type === 'wall') || c.tags.includes('ogretici')) continue;
        const floors = c.entities.filter((e) => e.type === 'platform' && (e.h ?? 24) >= 100 && Math.abs(e.y - G) <= 12).sort((a, b) => a.x - b.x);
        for (let i = 0; i + 1 < floors.length; i++) { const gap = floors[i + 1]!.x - (floors[i]!.x + (floors[i]!.w ?? 0)); if (gap > 0) expect(gap, `${n}/${salt} ${c.id}`).toBeLessThanOrEqual(70); }
      }
    }
  });
  it('1-3. bölümde hareketli, ritim, ufalanan, yankı ve asansör basamağı yok; 1-5. bölümde her odada kontrol noktası', () => {
    for (const salt of salts) for (let n = 1; n <= 5; n++) {
      const sp = gen(n, salt);
      if (n <= 3) for (const c of sp.chunks) expect(c.entities.filter((e) => ['moving', 'beat', 'crumble', 'echo', 'lift'].includes(e.type)).map((e) => `${n}/${salt} ${c.id}:${e.type}`)).toEqual([]);
      sp.chunks.slice(1).forEach((c) => expect(c.entities.some((e) => e.type === 'checkpoint'), `${n}/${salt} ${c.id}`).toBe(true));
    }
  });
});
