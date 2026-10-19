import { describe, expect, it } from 'vitest';
import { playLevel } from './testkit';

/**
 * Üretilen her bölüm motorun kendi adımı üzerinde planlayıcı botla bitirilebilir (salt 0-3); boşta oyuncu hiçbirini bitiremez
 * ve süre dolmadan düşer. Tempo: bot en çok MAX_GAP sn girdisiz kalır (docs/11 — "ölü yol" yok).
 */
const MAX_GAP = 4;
describe('bölümler 11-20: planlayıcı bitirir, ölü yol yok, boşta bitmez', () => {
  for (let n = 11; n <= 20; n++) {
    it(`bölüm ${n}`, () => {
      for (const salt of [0, 1, 2, 3]) {
        const r = playLevel(n, { salt });
        expect(r.finished, `bölüm ${n} salt ${salt}: ${r.failed ?? 'süre'} t=${r.t.toFixed(1)}`).toBe(true);
        expect(r.maxGap, `bölüm ${n} salt ${salt}: ${r.maxGap.toFixed(2)} sn girdisiz (t=${r.gapAt.toFixed(1)})`).toBeLessThanOrEqual(MAX_GAP);
      }
      const idle = playLevel(n, { idle: true, maxT: 150 });
      expect(idle.finished).toBe(false);
      expect(idle.failed, `bölüm ${n}: boşta oyuncu 150 sn içinde düşmedi`).not.toBeNull();
    }, 240_000);
  }
});
