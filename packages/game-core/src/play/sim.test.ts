import { describe, expect, it } from 'vitest';
import { GROUND_Y as G } from '@odi/shared';
import * as C from './consts';
import { testSpec, setup, press, run } from './testkit';
import { cloneState, solidAt, step, type SimInput, type SimState } from './sim';
import type { WEnt, World } from './world';

const flat = (extra: Parameters<typeof testSpec>[0] = [], o: Parameters<typeof testSpec>[1] = {}) => setup(testSpec([{ type: 'platform', x: 0, y: G, w: 3000, h: 200 }, ...extra], o));
/** parça x'i → dünya x'i (START_PAD) */
const X = (x: number) => x + C.START_PAD;
/** koşul ilk kez doğru olduğu adımda bir kez tetiklenen olay */
function once() { let fired = false; return (c: boolean) => { if (!fired && c) { fired = true; return true; } return false; }; }
/** tek basış: `hold` adım basılı */
const tap = (hold: number) => (i: number): SimInput => press({ down: i < hold, pressed: i === 0, released: i === hold });
function apex(hold: number, o: Parameters<typeof testSpec>[1] = {}) {
  const { w, s } = flat([], o); run(w, s, 10); let top = s.hero.y;
  run(w, s, 120, (i) => { const r = tap(hold)(i); top = Math.min(top, s.hero.y); return r; });
  return G - top;
}

describe('fizik hissi', () => {
  it('değişken zıplama yüksekliği: dokun < basılı tut', () => {
    const short = apex(1), mid = apex(12), full = apex(40, { number: 5 });
    expect(short).toBeGreaterThan(55); expect(short).toBeLessThan(90);
    expect(mid).toBeGreaterThan(short + 25);
    expect(full).toBeGreaterThan(145); expect(full).toBeLessThan(175);
  });
  it('coyote süresi 0,1 sn: kenardan düştükten hemen sonra zıplanır, geç kalınca zıplanmaz', () => {
    const jumpAfterEdge = (delaySteps: number) => {
      const { w, s } = setup(testSpec([{ type: 'platform', x: 0, y: G, w: 200, h: 200 }]));
      while (s.hero.grounded) step(w, s, press()); // kenardan ayrıldığı ilk adım
      run(w, s, delaySteps);
      const vy0 = s.hero.vy; step(w, s, press({ down: true, pressed: true })); return s.hero.vy < vy0 - 300;
    };
    expect(jumpAfterEdge(3)).toBe(true);   // 0,05 sn
    expect(jumpAfterEdge(8)).toBe(false);  // 0,13 sn
  });
  it('zıplama tamponu 0,12 sn: inişten az önce basılan zıplama inince gerçekleşir', () => {
    const bufferedJump = (earlySteps: number) => {
      const { w, s } = flat(); run(w, s, 5); run(w, s, 1, () => press({ pressed: true, down: true })); run(w, s, 30, () => press({ down: true }));
      // düşüşte: inişe earlySteps kala bas
      let landing = -1; const probe = cloneState(s); for (let i = 0; i < 120; i++) { step(w, probe, press()); if (probe.hero.grounded) { landing = i; break; } }
      run(w, s, landing - earlySteps); step(w, s, press({ pressed: true, released: true }));
      run(w, s, earlySteps + 2); return !s.hero.grounded && s.hero.vy < 0;
    };
    expect(bufferedJump(5)).toBe(true);
    expect(bufferedJump(10)).toBe(false);
  });
  it('deterministik: aynı girdiler aynı durum', () => {
    const a = flat(), b = flat(); const inp = (i: number) => press({ down: i % 50 < 20, pressed: i % 50 === 0, released: i % 50 === 20 });
    run(a.w, a.s, 400, inp); run(b.w, b.s, 400, inp);
    expect(a.s.hero).toEqual(b.s.hero);
  });
});

describe('yetenekler ve açılmaları', () => {
  it('duvar: değince kısa tırmanır, sürtünmeli kayar, dokununca karşıya zıplar ve yön döner', () => {
    const { w, s } = flat([{ type: 'wall', x: 400, y: G - 400, w: 40, h: 400 }], { number: 6 });
    while (s.hero.wallId < 0 && s.t < 3) step(w, s, press());
    step(w, s, press());
    expect(s.hero.wallId).toBeGreaterThanOrEqual(0); expect(s.hero.vy).toBeLessThan(0); // kısa tırmanış
    run(w, s, 40); expect(s.hero.vy).toBeLessThanOrEqual(C.WALL_SLIDE_MAX + 1); expect(s.hero.vy).toBeGreaterThan(0);
    step(w, s, press({ pressed: true, down: true })); expect(s.hero.dir).toBe(-1); expect(s.hero.vy).toBeLessThan(-500);
  });
  it('duvar zıplaması 6. bölümden önce yok (duvar engeldir)', () => {
    const { w, s } = flat([{ type: 'wall', x: 400, y: G - 400, w: 40, h: 400 }], { number: 5 });
    run(w, s, 120); expect(s.hero.wallId).toBe(-1);
  });
  it('süzülme düşüşü yavaşlatır; 9. bölümden önce yok', () => {
    const fall = (n: number) => { const { w, s } = flat([], { number: n }); run(w, s, 5); let maxVy = 0; run(w, s, 70, (i) => { maxVy = Math.max(maxVy, s.hero.vy); return tap(70)(i); }); return maxVy; };
    expect(fall(9)).toBeLessThanOrEqual(C.GLIDE_FALL + 1);
    expect(fall(8)).toBeGreaterThan(C.GLIDE_FALL * 2);
  });
  it('kayma: asılı engelin altından geçer, ayaktayken çarpar', () => {
    const curtain = { type: 'hazard' as const, x: 400, y: G - 170, w: 120, h: 146 };
    const a = flat([curtain], { number: 3 }); run(a.w, a.s, 200); expect(a.s.damageTaken).toBe(1);
    const b = flat([curtain], { number: 3 }); const sb = once(); run(b.w, b.s, 200, () => press({ swipeDown: sb(b.s.hero.x > X(400) - 60) })); expect(b.s.damageTaken).toBe(0);
    const c = flat([curtain], { number: 2 }); const sc = once(); run(c.w, c.s, 200, () => press({ swipeDown: sc(c.s.hero.x > X(400) - 60) })); expect(c.s.damageTaken).toBe(1); // 3'ten önce kayma yok
  });
  it('zar: değme anında dokunmak güçlü, dokunmamak sönük sıçratır', () => {
    const tramp = { type: 'trampoline' as const, x: 400, y: G + 60, w: 200, props: { power: 1 } };
    const mk = () => setup(testSpec([{ type: 'platform', x: 0, y: G, w: 300, h: 200 }, tramp, { type: 'platform', x: 500, y: G + 300, w: 2000, h: 100 }], { number: 9 }));
    const weak = mk(); let top = 9999; run(weak.w, weak.s, 160, () => { top = Math.min(top, weak.s.hero.y); return press(); }); const weakH = G + 40 - top;
    const strong = mk(); top = 9999; run(strong.w, strong.s, 160, () => { top = Math.min(top, strong.s.hero.y); return press({ pressed: strong.s.hero.tramp > 0, down: strong.s.hero.tramp > 0 }); });
    expect(G + 40 - top).toBeGreaterThan(weakH * 2.5);
  });
  it('kanca: basılı tutunca tutunur ve sallanır, bırakınca ileri fırlar', () => {
    const { w, s } = setup(testSpec([{ type: 'platform', x: 0, y: G, w: 320, h: 200 }, { type: 'hook', x: 610, y: G - 290, props: { r: 190 } }, { type: 'platform', x: 930, y: G, w: 800, h: 200 }], { number: 13 }));
    let grabbed = false; let started = false; let released = false; const j = once();
    run(w, s, 230, () => {
      if (s.hero.hookId >= 0) grabbed = true;
      const go = j(s.hero.x > X(300)); if (go) started = true;
      if (grabbed && s.hero.hookId >= 0 && s.hero.hookAng > 0.5) released = true;
      return press({ pressed: go, down: started && !released });
    });
    expect(grabbed).toBe(true); expect(s.damageTaken).toBe(0); expect(s.hero.x).toBeGreaterThan(X(960)); expect(s.hero.grounded).toBe(true);
  });
  it('yere çakılma anahtarı tetikler, kapı açılır; çatlak zemini kırar', () => {
    const { w, s } = flat([{ type: 'switch', x: 300, y: G, props: { id: 'k' } }, { type: 'door', x: 600, y: G - 200, w: 36, h: 200, props: { id: 'k' } }], { number: 15 });
    let jumpAt = -1, k = 0; const pp = once();
    run(w, s, 200, () => { k++; if (jumpAt < 0 && s.hero.x > X(300) - 150) jumpAt = k; return press({ pressed: k === jumpAt, down: jumpAt > 0 && k - jumpAt < 18, swipeDown: pp(!s.hero.grounded && s.hero.x > X(300) - 6) }); });
    expect(s.opened.has('k')).toBe(true); expect(s.hero.x).toBeGreaterThan(X(700));
    const c = setup(testSpec([{ type: 'platform', x: 0, y: G, w: 300, h: 200 }, { type: 'crumble', x: 300, y: G, w: 200, h: 24 }, { type: 'platform', x: 0, y: G + 200, w: 3000, h: 100 }], { number: 15 }));
    run(c.w, c.s, 150); expect(c.s.hero.y).toBeGreaterThan(G + 100); // basınca 0,4 sn sonra düşer
  });
  it('çakılma 15. bölümden önce yok', () => {
    const { w, s } = flat([{ type: 'switch', x: 300, y: G, props: { id: 'k' } }], { number: 14 });
    let jumpAt = -1, k = 0; const pp = once();
    run(w, s, 200, () => { k++; if (jumpAt < 0 && s.hero.x > X(300) - 150) jumpAt = k; return press({ pressed: k === jumpAt, down: jumpAt > 0 && k - jumpAt < 18, swipeDown: pp(!s.hero.grounded && s.hero.x > X(300) - 6) }); });
    expect(s.opened.size).toBe(0);
  });
  it('yüzme: basılı tut yüksel, bırak dal; nefes biter', () => {
    const pool = [{ type: 'platform' as const, x: 0, y: G, w: 300, h: 460 }, { type: 'water' as const, x: 300, y: G - 10, w: 2400, h: 300 }, { type: 'platform' as const, x: 280, y: G + 290, w: 2500, h: 160 }];
    const a = setup(testSpec(pool, { number: 21 })); run(a.w, a.s, 90); const deep = a.s.hero.y; run(a.w, a.s, 40, () => press({ down: true })); expect(a.s.hero.y).toBeLessThan(deep - 60);
    const b = setup(testSpec(pool, { number: 21 })); run(b.w, b.s, 60 * 8); expect(b.s.damageTaken).toBeGreaterThan(0); // nefes
  });
  it('ses darbesi gürültü duvarını kırar ve yankı yolunu açar; 31. bölümden önce yok', () => {
    const ents = [{ type: 'barrier' as const, x: 400, y: G - 170, w: 36, h: 170 }];
    const da = once(), db = once();
    const a = flat(ents, { number: 31 }); run(a.w, a.s, 180, () => press({ dash: da(a.s.hero.x > X(400) - 60) })); expect(a.s.broken.size).toBe(1); expect(a.s.damageTaken).toBe(0); expect(a.s.hero.echoUntil).toBeGreaterThan(0);
    const b = flat(ents, { number: 30 }); run(b.w, b.s, 180, () => press({ dash: db(b.s.hero.x > X(400) - 60) })); expect(b.s.broken.size).toBe(0); expect(b.s.damageTaken).toBeGreaterThan(0);
  });
  it('yerçekimi çevirme: mor bölgede dokununca tavana düşer, bölgeden çıkınca normale döner', () => {
    const { w, s } = flat([{ type: 'platform', x: 200, y: G - 300, w: 600, h: 40 }, { type: 'gravzone', x: 200, y: G - 260, w: 600, h: 260 }], { number: 35 });
    const f = once(); run(w, s, 120, () => press({ pressed: f(s.hero.x > X(260)) }));
    expect(s.hero.g).toBe(-1); expect(s.hero.y).toBeLessThan(G - 200);
    run(w, s, 200); expect(s.hero.g).toBe(1);
  });
  it('frekans kapısı yalnızca aynı renk diyapazonla açılır; yanlış renk can yakar', () => {
    const ents = (c: number) => [{ type: 'fork' as const, x: 200, y: G - 40, props: { color: c } }, { type: 'freqgate' as const, x: 500, y: G - 300, w: 36, h: 300, props: { color: 0.6 } }];
    const ok = flat(ents(0.6), { number: 24 }); run(ok.w, ok.s, 150); expect(ok.s.hero.x).toBeGreaterThan(600); expect(ok.s.damageTaken).toBe(0);
    const bad = flat(ents(0.2), { number: 24 }); run(bad.w, bad.s, 150); expect(bad.s.damageTaken).toBeGreaterThan(0);
  });
  it('takılan kahraman kısa süre sonra geri döner (oyuncu mahsur kalmaz)', () => {
    const { w, s } = flat([{ type: 'platform', x: 400, y: G - 300, w: 100, h: 300 }], { number: 5 });
    run(w, s, 150); expect(s.hero.dir).toBe(-1);
  });
  it('ritim platformu vuruş desenine göre belirir/kaybolur', () => {
    const { w, s } = flat([{ type: 'beat', x: 300, y: G - 100, w: 120, h: 20, props: { pattern: '10', mode: 'belir' } }]);
    const e = w.ents.find((x) => x.type === 'beat')!; const seen = new Set<boolean>();
    for (let i = 0; i < 120; i++) { step(w, s, press()); seen.add(e && solidOn(w, s, e)); }
    expect(seen.size).toBe(2);
  });
});
function solidOn(w: World, s: SimState, e: WEnt) { return solidAt(w, s, e, s.t); }
