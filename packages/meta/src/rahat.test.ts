import { describe, expect, it } from 'vitest';
import type { RunResult } from '@odi/shared';
import { DEFAULT_SKILLS, HUMAN_JOURNEY } from '@odi/content';
import { RAHAT_TEXT, defaultMeta, nextGoal, processRun, rahatOffer, type PlayerCore } from './index';

/** Rahat deneme (sahip kararı 42, YN-110) */
const core = (over: Partial<PlayerCore> = {}): PlayerCore => ({ progress: {}, coins: 0, xp: 0, streak: 1, lastDay: '2026-11-02', failStreak: 0, skills: { ...DEFAULT_SKILLS }, meta: defaultMeta(), ...over });
const spec = (n: number) => { const l = HUMAN_JOURNEY.levels[n - 1]!; return { number: n, name: l.name, biome: l.biome, mechanic: l.mechanic, objective: { id: l.objective, label: 'Hedef' }, parTimeSec: 120, coinsTotal: l.mechanic === 'boss' ? 0 : 30 }; };
const lose = (o: Partial<RunResult> = {}): RunResult => ({ levelId: 'x', completed: false, stars: 0, score: 0, coins: 0, timeSec: 30, deaths: 0, damageTaken: 3, objectiveMet: false, secretFound: false, ...o });
const win = (stars: 1 | 2 | 3, o: Partial<RunResult> = {}): RunResult => ({ levelId: 'x', completed: true, stars, score: 900 + stars * 100, coins: 0, timeSec: 60, deaths: 0, damageTaken: 3 - stars, objectiveMet: true, secretFound: false, ...o });
const DAY = '2026-11-02';
const play = (c: PlayerCore, n: number, r: RunResult) => processRun(c, spec(n), r, DAY);

describe('Rahat deneme teklifi', () => {
  it('yalnız canavar bölümlerinde (yolculuğun hepsi: 20 ve 40), aynı bölümde 3 kayıptan sonra', () => {
    const bosses = HUMAN_JOURNEY.levels.filter((l) => l.mechanic === 'boss').map((l) => l.number);
    expect(bosses).toEqual([20, 40]);
    for (const n of bosses) {
      let c = core();
      for (let i = 1; i <= 4; i++) { c = play(c, n, lose()).core; expect(c.progress[n]!.fails).toBe(i); expect(rahatOffer(spec(n), c.progress[n])).toBe(i >= 3); }
    }
    // canavar olmayan bölümde hiç (kaç kayıp olursa olsun)
    let c = core(); for (let i = 0; i < 6; i++) c = play(c, 19, lose()).core;
    expect(c.progress[19]!.fails).toBe(6); expect(rahatOffer(spec(19), c.progress[19])).toBe(false);
  });
  it('sayaç bölüme özel: başka bölümdeki kayıp saymaz; normal geçiş sıfırlar', () => {
    let c = core();
    c = play(c, 20, lose()).core; c = play(c, 20, lose()).core; c = play(c, 19, lose()).core;
    expect(rahatOffer(spec(20), c.progress[20])).toBe(false);
    c = play(c, 20, lose()).core; expect(rahatOffer(spec(20), c.progress[20])).toBe(true);
    c = play(c, 20, win(2)).core; expect(c.progress[20]!.fails).toBeUndefined(); expect(rahatOffer(spec(20), c.progress[20])).toBe(false);
  });
});

describe('Rahat denemenin sonucu', () => {
  const stuck = () => { let c = core(); for (let i = 0; i < 3; i++) c = play(c, 20, lose()).core; return c; };
  it('en çok 1 yıldız, rekor yazılmaz, "Rahat denemeyle" işaretlenir; geçiş sayacı sıfırlamaz (teklif kalır)', () => {
    const { core: c, summary } = play(stuck(), 20, win(1, { rahat: true, damageTaken: 0, score: 5000 }));
    // motor zaten 1 yıldız verir (scoreRun); kayıt yine de üstünü kabul etmez
    const p = c.progress[20]!; expect(p.stars).toBe(1); expect(p.rahat).toBe(true); expect(p.best).toBe(0); expect(summary.newRecord).toBe(false);
    expect(p.fails).toBe(3); expect(rahatOffer(spec(20), p)).toBe(true);
    expect(c.meta.stats.noDamage).toBe(0);
    // bir sonraki bölüm açılır (bölüm geçildi)
    expect(summary.firstClear).toBe(true);
    // 3 yıldızlık bir sonuç gelse de kayıt 1'de kalır
    expect(play(stuck(), 20, win(3, { rahat: true })).core.progress[20]!.stars).toBe(1);
  });
  it('sonraki hedef cümlesi normal denemeyi söyler', () => {
    expect(nextGoal(spec(20), win(1, { rahat: true })).text).toBe('Normal denemede 2. yıldız için en çok 1 kez hasar al');
    expect(nextGoal(spec(20), win(1)).text).toBe('2. yıldız için en çok 1 kez hasar al');
  });
  it('sonraki normal deneme yıldızı yükseltir ve işareti kaldırır', () => {
    let c = play(stuck(), 20, win(1, { rahat: true })).core;
    c = play(c, 20, lose()).core; expect(c.progress[20]!.stars).toBe(1); expect(c.progress[20]!.rahat).toBe(true); expect(c.progress[20]!.fails).toBe(4);
    const up = play(c, 20, win(3, { damageTaken: 0 }));
    const p = up.core.progress[20]!; expect(p.stars).toBe(3); expect(p.rahat).toBeUndefined(); expect(p.fails).toBeUndefined(); expect(p.best).toBe(1200);
    // normal 1 yıldızla geçiş de işareti kaldırır (yıldız artık normal denemeyle alınmış)
    const same = play(play(stuck(), 20, win(1, { rahat: true })).core, 20, win(1)).core.progress[20]!;
    expect(same.stars).toBe(1); expect(same.rahat).toBeUndefined();
  });
  it('normal yıldızı olan bölümde Rahat geçiş yıldızı düşürmez, işaret koymaz', () => {
    let c = play(core(), 20, win(2)).core; for (let i = 0; i < 3; i++) c = play(c, 20, lose()).core;
    const p = play(c, 20, win(1, { rahat: true })).core.progress[20]!; expect(p.stars).toBe(2); expect(p.rahat).toBeUndefined();
  });
  it('metinler açık: ne değişir, ne verir, ne vermez', () => {
    expect(RAHAT_TEXT.what).toBe('Canavar %20 yavaş, 1 can fazla.');
    expect(RAHAT_TEXT.rules).toBe('En çok 1 yıldız verir; lig, düello ve takım puanı yazılmaz.');
    expect(RAHAT_TEXT.passed).toBe('Rahat denemeyle geçildi');
    expect(RAHAT_TEXT.short).toBe('%20 yavaş, +1 can, en çok 1 yıldız');
    expect(RAHAT_TEXT.passedNote).toMatch(/normal denemede daha çok yıldız alırsan yıldızın yükselir/i);
  });
});
