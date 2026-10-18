import { describe, expect, it } from 'vitest';
import { ALL_CHUNKS } from '@odi/content';
import { playRoom } from './testkit';

/**
 * Her oda tek başına geçilebilir ve "otomatik geri dönme döngüsü" kurmaz: bot odayı, engele dayanıp kendiliğinden geri dönmeden
 * (kapılı anahtar ve frekans odalarında — kapıya ve arka duvara çarpma tasarım gereği — en çok iki kez) bitirir. 16. bölümdeki asansör tuzağı türünden bir oda bu testi geçemez.
 */
describe('odalar: geçilebilir, kaçınılmaz geri dönme döngüsü yok', () => {
  const rooms = ALL_CHUNKS.filter((c) => !c.tags.includes('ogretici') || c.entities.length > 0);
  const parts = 4;
  for (let k = 0; k < parts; k++) {
    it(`odalar ${k + 1}/${parts}`, () => {
      const bad: string[] = [];
      for (const c of rooms.filter((_, i) => i % parts === k)) {
        const r = playRoom(c);
        const allowed = c.entities.some((e) => e.type === 'door' || e.type === 'freqgate') ? 2 : 0;
        if (!r.finished) bad.push(`${c.id} (L${r.level}): bitmedi (${r.failed ?? 'süre'})`);
        else if (r.autoTurns > allowed) bad.push(`${c.id} (L${r.level}): ${r.autoTurns} kez engele dayanıp geri döndü`);
      }
      expect(bad).toEqual([]);
    }, 300_000);
  }
});
