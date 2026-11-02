// Rahat deneme (sahip kararı 42, YN-110): kayıt → teklif → Rahat koşu → gönderim zinciri, gerçek parçalarla (üretici, yıldız kuralı,
// meta kaydı, sunucu gövdesi). Sunucunun puan kuralı apps/server/test/rahat.test.ts'te.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SKILLS, HUMAN_JOURNEY } from '@odi/content';
import { generateLevel } from '@odi/level-gen';
import { defaultMeta, processRun, rahatOffer, type PlayerCore } from '@odi/meta';
import { scoreRun, type LevelSpec, type RunResult } from '@odi/shared';
import { runPayload } from './net';

const prof = { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS };
const DAY = '2026-11-02';
const finish = (spec: LevelSpec, completed: boolean, damageTaken: number, rahat = !!spec.rahat): RunResult => {
  const base = { levelId: spec.id, completed, coins: 0, timeSec: 70, deaths: 0, damageTaken, objectiveMet: completed, secretFound: false };
  return { ...base, ...scoreRun(spec, base), ...(rahat ? { rahat: true } : {}) };
};

describe('Rahat deneme zinciri', () => {
  it('teklif yalnız canavar bölümünde 3 kayıptan sonra; Rahat koşu 1 yıldız, rekabetsiz gönderilir; normal koşu yıldızı yükseltir', () => {
    let c: PlayerCore = { progress: {}, coins: 0, xp: 0, streak: 1, lastDay: DAY, failStreak: 0, skills: { ...DEFAULT_SKILLS }, meta: defaultMeta() };
    const normal = generateLevel(HUMAN_JOURNEY.id, 20, prof);
    for (let i = 1; i <= 3; i++) {
      expect(rahatOffer(normal, c.progress[20])).toBe(false);
      c = processRun(c, normal, finish(normal, false, 3), DAY).core;
    }
    expect(rahatOffer(normal, c.progress[20])).toBe(true);
    // canavar olmayan bölümde aynı sayı teklif getirmez
    const n19 = generateLevel(HUMAN_JOURNEY.id, 19, prof);
    let d = c; for (let i = 0; i < 4; i++) d = processRun(d, n19, finish(n19, false, 3), DAY).core;
    expect(rahatOffer(n19, d.progress[19])).toBe(false);

    // oyuncu seçti: hasarsız yense de 1 yıldız
    const rahat = generateLevel(HUMAN_JOURNEY.id, 20, prof, 0, { rahat: true });
    const r = finish(rahat, true, 0);
    expect(r.stars).toBe(1); expect(r.rahat).toBe(true);
    c = processRun(c, rahat, r, DAY).core;
    expect(c.progress[20]).toMatchObject({ stars: 1, rahat: true });
    const body = runPayload('r1', rahat, r);
    expect(body).toMatchObject({ level: 20, completed: true, stars: 1, rahat: true, mechanic: 'boss' });
    // yarışta Rahat yok (bayrak gitmez)
    expect(runPayload('r2', rahat, r, 'yaris1').rahat).toBeUndefined();

    // sonraki normal deneme: 2 yıldız → kayıt yükselir, işaret kalkar, gönderim bayraksız
    const n = finish(normal, true, 1);
    expect(n.stars).toBe(2);
    c = processRun(c, normal, n, DAY).core;
    expect(c.progress[20]!.stars).toBe(2); expect(c.progress[20]!.rahat).toBeUndefined();
    expect(runPayload('r3', normal, n).rahat).toBeUndefined();
  });
});
