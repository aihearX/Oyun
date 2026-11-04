import { describe, expect, it } from 'vitest';
import { generateLevel } from '@odi/level-gen';
import { DEFAULT_SKILLS } from '@odi/content';
import { setup } from './testkit';
import { Planner } from './planner';
import { NO_INPUT, step } from './sim';
import { ARENA_W, INTRO_S, RUN_L, RUN_R, WALL_W, bossPhaseText, bossStrip, liveWaves } from './boss';
import { BOSS_LOOK_MS, firstTimerOf, humanPrefs, humanSeed, playerOf, runHuman } from './human';

/** Gürültü Canavarı faz 3: "Çift dalga!" gerçekten iki dalga olarak arenada görünür ve bot yine yener. */
describe('boss: Gürültü Canavarı', () => {
  for (const salt of [0, 1]) {
    it(`faz 3 çift dalga arenada doğar, bot yener (salt ${salt})`, () => {
      const spec = generateLevel('insan', 40, { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS }, salt);
      const { w, s } = setup(spec); s.events = [];
      const p = new Planner(w);
      let pairSeen = 0; let phase3 = false;
      while (!s.finished && !s.failed && s.t < 240) {
        step(w, s, p.next(s));
        const b = s.boss!;
        if (b.phase === 3) phase3 = true;
        const live = liveWaves(b, s.t);
        for (const wv of live) { expect(wv.x).toBeGreaterThan(WALL_W - 41); expect(wv.x).toBeLessThan(ARENA_W - WALL_W + 41); }
        if (b.phase === 3 && live.length >= 2 && new Set(live.map((x) => x.kind)).size === 2) pairSeen++;
        s.events!.length = 0;
      }
      expect(phase3).toBe(true);
      expect(pairSeen, 'faz 3 çift dalga hiç görünmedi').toBeGreaterThan(0);
      expect(s.finished, `bitmedi: ${s.failed ?? 'süre'} hp=${s.boss?.hp}`).toBe(true);
      expect(s.boss!.defeated).toBe(true);
    }, 400_000); // MK-020: CPU 15–18,5 sn; yük 15'te duvar 40–62 sn; 120 sn yük 28+'da yetmiyordu (sınır ≈ CPU × 20)
  }
});

/**
 * Arena kapalıdır: insan modelinin kusurlu oyuncuları (saplanan yumruğun altında kalan dahil) hiçbir zaman duvarların dışına çıkmaz.
 * Aynı koşularda faz değişiminde şerit metni (YN-184, OT-sessiz-oyuncu-26): faz değiştiği adımda alt şerit yeni fazın talimatı;
 * hiçbir adımda şerit can çubuğundan (b.phase) farklı faz söylemez.
 */
describe('boss: arena sınırı ve faz şeridi', () => {
  for (const n of [20, 40]) {
    it(`bölüm ${n}: kahraman hep iki duvarın arasında, arenadan düşmez; şerit fazı çubukla aynı`, () => {
      const out: string[] = []; const phases = new Set<number>();
      for (let k = 0; k < 6; k++) {
        const spec = generateLevel('insan', n, { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS });
        const { w, s } = setup(spec); s.events = [];
        const p = new Planner(w, humanPrefs(humanSeed(n, k), { ...playerOf(k), lookMs: BOSS_LOOK_MS }));
        while (!s.finished && !s.failed && s.t < 120) {
          step(w, s, p.next(s));
          if (s.hero.x < RUN_L - 0.5 || s.hero.x > RUN_R + 0.5) out.push(`k${k} t=${s.t.toFixed(2)} x=${s.hero.x.toFixed(0)}`);
          for (const e of s.events!) if (e.k === 'hurt' && e.s === 'fall') out.push(`k${k} t=${s.t.toFixed(2)} düştü`);
          const b = s.boss!; const strip = bossStrip(b, s.t, !!spec.intro);
          if (strip && strip.id !== `boss-faz-${b.phase}`) out.push(`k${k} t=${s.t.toFixed(2)} şerit ${strip.id}, çubuk faz ${b.phase}`);
          for (const e of s.events!) if (e.k === 'bossPhase') {
            phases.add(Number(e.n));
            if (strip?.id !== `boss-faz-${e.n}` || strip.text !== bossPhaseText(b.kind, Number(e.n))) out.push(`k${k} t=${s.t.toFixed(2)} faz ${e.n} başladı, şerit ${strip?.id ?? 'boş'}`);
          }
          s.events!.length = 0;
        }
      }
      expect(out.slice(0, 5)).toEqual([]);
      expect([...phases].sort()).toEqual([2, 3]);
    }, 450_000); // MK-020: bölüm 40 CPU 21,5 sn (yük 15'te duvar 62 sn), bölüm 20 CPU 13 sn; sınır ≈ CPU × 20
  }
});

/**
 * YN-091: giriş yazısı (INTRO_S) ekrandayken canavar saldırmaz — ilk uyarı (telegraf) yazı kapandıktan sonra başlar, kahraman
 * o sürede hasar almaz. İlk canavarın öğretici anı ('bossTutor') yalnız 20'de, ilk saplı yumrukta bir kez.
 */
describe('boss: giriş yazısı ve ilk canavar öğretici anı', () => {
  for (const n of [20, 40]) {
    it(`bölüm ${n}: ilk saldırı uyarısı ≥ giriş yazısı süresi, yazı sırasında hasar yok`, () => {
      const spec = generateLevel('insan', n, { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS });
      expect(spec.intro, 'boss bölümünün giriş yazısı var').toBeTruthy();
      const { w, s } = setup(spec); s.events = [];
      let firstWarn = -1;
      while (s.t < INTRO_S + 3 && firstWarn < 0) {
        step(w, s, NO_INPUT);
        const b = s.boss!;
        if (b.fists.length || b.warnWall || b.waves.length) firstWarn = s.t;
        if (s.t <= INTRO_S) expect(s.damageTaken, `t=${s.t.toFixed(2)}`).toBe(0);
        s.events.length = 0;
      }
      expect(firstWarn).toBeGreaterThanOrEqual(INTRO_S);
    });
    it(`bölüm ${n}: ilk kez oynayan oyuncular yazı sırasında can kaybetmez`, () => {
      for (let k = 0; k < 6; k++) {
        const spec = generateLevel('insan', n, { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS });
        const { w, s } = setup(spec);
        runHuman(w, s, humanSeed(n, k), { maxT: INTRO_S, params: firstTimerOf(k) });
        expect(s.damageTaken, `k${k}`).toBe(0);
      }
    });
  }
  it('öğretici an yalnız 20\'de, ilk saplı yumrukta bir kez', () => {
    const count = (n: number) => {
      const spec = generateLevel('insan', n, { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS });
      const { w, s } = setup(spec); s.events = []; const p = new Planner(w);
      let tutors = 0; let slamAt = -1; let tutorAt = -1;
      while (!s.finished && !s.failed && s.t < 60) {
        step(w, s, p.next(s));
        for (const e of s.events) { if (e.k === 'bossTutor') { tutors++; if (tutorAt < 0) tutorAt = s.t; } if (e.k === 'bossSlam' && slamAt < 0) slamAt = s.t; }
        s.events.length = 0;
      }
      return { tutors, slamAt, tutorAt };
    };
    const g = count(20); expect(g.tutors).toBe(1); expect(g.tutorAt).toBe(g.slamAt);
    expect(count(40).tutors).toBe(0);
  }, 120_000);
});
