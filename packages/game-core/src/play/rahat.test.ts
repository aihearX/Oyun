import { describe, expect, it } from 'vitest';
import { generateLevel } from '@odi/level-gen';
import { DEFAULT_SKILLS } from '@odi/content';
import { RAHAT, scoreRun } from '@odi/shared';
import { setup } from './testkit';
import { Planner } from './planner';
import { step } from './sim';
import { firstTimerOf, humanSeed, runHuman } from './human';

const prof = { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS };

/** Rahat deneme (sahip kararı 42, YN-110): canavar %20 yavaş, +1 can, en çok 1 yıldız. */
describe('Rahat deneme', () => {
  for (const n of [20, 40]) {
    it(`bölüm ${n}: +1 can; normal denemede can aynı`, () => {
      expect(setup(generateLevel('insan', n, prof)).s.lives).toBe(3);
      expect(setup(generateLevel('insan', n, prof, 0, { rahat: true })).s.lives).toBe(3 + RAHAT.extraLives);
    });
  }
  it('bölüm 20: ilk yumruğun uyarısı daha uzun, saldırılar daha seyrek', () => {
    const measure = (rahat: boolean) => {
      const { w, s } = setup(generateLevel('insan', 20, prof, 0, { rahat })); s.events = []; const p = new Planner(w);
      let warns = 0; let warnLen = -1;
      while (!s.finished && !s.failed && s.t < 30) {
        step(w, s, p.next(s));
        for (const e of s.events) if (e.k === 'bossWarn') { warns++; if (warnLen < 0) { const f = s.boss!.fists[0]!; warnLen = f.until - f.t0; } }
        s.events.length = 0;
      }
      return { warns, warnLen };
    };
    const a = measure(false), r = measure(true);
    expect(r.warnLen).toBeCloseTo(a.warnLen / RAHAT.slow, 2);
    expect(r.warns).toBeLessThanOrEqual(a.warns);
  }, 120_000);
  it('bölüm 20: hasarsız yense de en çok 1 yıldız (scoreRun)', () => {
    const spec = generateLevel('insan', 20, prof, 0, { rahat: true });
    const base = { levelId: spec.id, completed: true, coins: 0, timeSec: 60, deaths: 0, damageTaken: 0, objectiveMet: true, secretFound: false };
    expect(scoreRun(spec, base).stars).toBe(1);
    expect(scoreRun(generateLevel('insan', 20, prof), base).stars).toBe(3);
  });
  // insan modeli (ilk kez oynayan, 6 tohum; 2026-11-02 ölçümü): kalan canavar gücü toplamı 20'de 54 → 44 (/14), 40'ta 93 → 29 (/32);
  // galibiyet 20'de 0 → 0, 40'ta 0 → 2. Modelin ileri bakışı canavarda sabit (BOSS_LOOK_MS): uzayan uyarıyı "okuma süresi" olarak
  // değerlendiremez, yavaşlığın gerçek oyuncuya katkısını eksik ölçer.
  for (const n of [20, 40]) {
    it(`bölüm ${n}: ilk kez oynayan oyuncu modeli Rahat denemede canavarı daha çok yıpratır, daha az değil daha çok yener`, () => {
      const play = (rahat: boolean) => {
        let wins = 0; let left = 0;
        for (let k = 0; k < 6; k++) {
          const { w, s } = setup(generateLevel('insan', n, prof, 0, { rahat }));
          runHuman(w, s, humanSeed(n, k), { maxT: 300, params: firstTimerOf(k) });
          if (s.finished) wins++; left += s.boss!.hp;
        }
        return { wins, left };
      };
      const a = play(false), r = play(true);
      expect(r.wins).toBeGreaterThanOrEqual(a.wins);
      expect(r.left, `kalan güç normal ${a.left}, Rahat ${r.left}`).toBeLessThan(a.left);
    }, 400_000);
  }
});
