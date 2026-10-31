import { describe, expect, it } from 'vitest';
import { NOVICE, USTA, firstTimerOf, skillHand, type HumanParams } from './human';

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
