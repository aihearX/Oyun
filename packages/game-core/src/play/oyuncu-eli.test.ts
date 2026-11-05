import { describe, expect, it } from 'vitest';
import { NOVICE, USTA, firstTimerOf, skillHand, type HumanParams } from './human';
import { playHand } from './testkit';

// oyuncu ajanlarının beceri ölçeği (tools/harness/oyuncu.mjs, `&oyun-beceri=`): 1 kusursuz … 0 hiç oynamamış
const close = (a: HumanParams | null, b: HumanParams) => { for (const k of Object.keys(b) as (keyof HumanParams)[]) expect(a![k] as number).toBeCloseTo(b[k] as number, 9); };
describe('skillHand', () => {
  it('0,99 ve üstü ya da sayı değil: kusursuz planlayıcı (el yok)', () => {
    expect(skillHand(1, 0)).toBeNull();
    expect(skillHand(0.99, 3)).toBeNull();
    expect(skillHand(Number.NaN, 0)).toBeNull();
  });
  it('0,25 altı: ilk kez oynayan kademe; her deneme başka el', () => {
    expect(skillHand(0.1, 7)).toEqual(firstTimerOf(7));
    expect(skillHand(0.1, 1)).not.toEqual(skillHand(0.1, 2));
  });
  it('kitle: 0,95 usta, 0,4 ve altı acemi, arası doğrusal ve tekdüze', () => {
    close(skillHand(0.95, 0), USTA);
    close(skillHand(0.4, 0), NOVICE);
    close(skillHand(0.3, 0), NOVICE);
    const r = [0.95, 0.7, 0.6, 0.5, 0.4].map((s) => skillHand(s, 0)!.reactMs);
    for (let i = 1; i < r.length; i++) expect(r[i]!).toBeGreaterThan(r[i - 1]!);
  });
});

// YN-219: eski-telefon (beceri 0,5, kitle) Bölüm 36'nın 2. denemesinde (deneme 797284489) Gürültü bulutunun altındaki kancada
// sonsuz asılı kaldı (49/98 nota, hasarsız; tarayıcıda 20 dk). El kancada 15 sn oyun saati ilerlemezse planner.ts takılmayı çözer.
describe('el modeli kancada takılmaz (YN-219)', () => {
  it('Bölüm 36, beceri 0,5, deneme 797284489: koşu oyun saatiyle 300 sn içinde biter', () => {
    const r = playHand(36, 0.5, 797284489, { maxT: 300 });
    expect(r.unsticks).toBeGreaterThan(0);
    expect(r.finished || !!r.failed).toBe(true);
    expect(r.t).toBeLessThanOrEqual(300);
  }, 300_000);
  it('takılmayan denemeler aynı (takılma çözülmez; el yalnız durumu okur)', () => {
    // tarayıcıdaki kayıtla aynı: 35 → geçti, 61 nota, 1 hasar; 36'nın 1. denemesi → düşerek kaybetti, 47 nota
    const a = playHand(35, 0.5, 797284487); expect([a.finished, a.coins, a.damage, a.unsticks]).toEqual([true, 61, 1, 0]);
    const b = playHand(36, 0.5, 797284488); expect([b.finished, b.failed, b.coins, b.unsticks]).toEqual([false, 'fall', 47, 0]);
    for (const [n, k] of [[34, 101], [37, 202], [36, 303]] as const) expect(playHand(n, 0.5, k).unsticks, `${n}/${k}`).toBe(0);
  }, 600_000);
});
