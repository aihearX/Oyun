import { describe, expect, it } from 'vitest';
import { playLevel } from './testkit';

/** Üretilen her bölüm motorun kendi adımı üzerinde planlayıcı botla bitirilebilir; boşta oyuncu hiçbirini bitiremez. */
describe('bölümler 1-10: planlayıcı bitirir, boşta bitmez', () => {
  for (let n = 1; n <= 10; n++) {
    it(`bölüm ${n}`, () => {
      const r = playLevel(n);
      expect(r.finished, `bölüm ${n}: ${r.failed ?? 'süre'} t=${r.t.toFixed(1)}`).toBe(true);
      const idle = playLevel(n, { idle: true, maxT: 240 });
      expect(idle.finished).toBe(false);
    }, 120_000);
  }
});
