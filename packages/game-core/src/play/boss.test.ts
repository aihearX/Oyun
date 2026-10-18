import { describe, expect, it } from 'vitest';
import { generateLevel } from '@odi/level-gen';
import { DEFAULT_SKILLS } from '@odi/content';
import { setup } from './testkit';
import { Planner } from './planner';
import { step } from './sim';
import { ARENA_W, WALL_W, liveWaves } from './boss';

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
    }, 120_000);
  }
});
