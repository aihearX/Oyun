import { beforeAll, describe, expect, it } from 'vitest';
import { firstTimerOf, playerOf } from './human';
import { playHumanStars } from './testkit';

/**
 * Süreli yüzme bölümlerinin (23 Akıntı, 30 Son Kıvrım) yıldızları (docs/12 §6; MK-004). Yıldız süreleri ölçülür
 * (`level-gen/src/sure.ts`, `zorluk.mjs --sure`): 1★ bitirmek (süre şartı yok), 2★ temiz koşu × 1,2, 3★ temiz koşu × 1,06.
 * Eskiden süre hedefi (par × 0,95) her bitirene yetiyor ama 3★ için önce %60 nota gerekiyordu; yüzmede bitirenlerin ancak
 * %2-8'i 2★ alabiliyordu. Kitle: 8 oyuncu (usta → acemi, iki tur); ilk kez oynayan: 12 oyuncu (sabit tohumlar).
 */
const SWIM = [23, 30];
type Run = ReturnType<typeof playHumanStars>;
describe('süreli yüzme bölümleri: yıldız süreleri', () => {
  const kitle: Record<number, Run[]> = {}; const ilk: Record<number, Run[]> = {};
  beforeAll(() => {
    for (const n of SWIM) {
      kitle[n] = Array.from({ length: 8 }, (_, k) => playHumanStars(n, { k, params: playerOf(k) }));
      ilk[n] = Array.from({ length: 12 }, (_, k) => playHumanStars(n, { k, params: firstTimerOf(k) }));
    }
  }, 1_200_000);
  it('eşikler: 2★ süresi 3★ süresinden uzun, ikisi de eski hedefin (par × 0,95) altında', () => {
    for (const n of SWIM) {
      const sp = kitle[n]![0]!.spec; const o = sp.objective;
      expect(o.id).toBe('timed'); expect(o.target2!, `${n}`).toBeGreaterThan(o.target!);
      expect(o.target2!, `${n}`).toBeLessThan(Math.round(sp.parTimeSec * 0.95));
    }
  });
  it('1★: bölümü bitiren her oyuncu (ilk kez oynayan dahil) en az 1 yıldız alır; ilk kez oynayan da yüzme finalini bitirebilir', () => {
    for (const n of SWIM) for (const r of [...kitle[n]!, ...ilk[n]!]) if (r.finished) expect(r.stars, `${n}`).toBeGreaterThanOrEqual(1);
    expect(SWIM.flatMap((n) => ilk[n]!).filter((r) => r.finished).length, 'ilk kez oynayan bitiren').toBeGreaterThan(0);
  });
  it('3★ iyi oyun ister ama ulaşılır: kitlede bitirenlerin bir kısmı alır (ustalar dahil), hepsi değil; 2★ bitirenlerin çoğuna', () => {
    const fin = SWIM.flatMap((n) => kitle[n]!).filter((r) => r.finished);
    const three = fin.filter((r) => r.stars === 3).length;
    expect(three, '3★ alan').toBeGreaterThan(0); expect(three, '3★ herkese değil').toBeLessThan(fin.length);
    expect(SWIM.flatMap((n) => [kitle[n]![0]!, kitle[n]![4]!]).some((r) => r.stars === 3), 'usta 3★').toBe(true);
    expect(fin.filter((r) => r.stars >= 2).length / fin.length, '2★ oranı').toBeGreaterThanOrEqual(0.7);
  });
});
