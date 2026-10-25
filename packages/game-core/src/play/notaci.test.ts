import { describe, expect, it } from 'vitest';
import { GROUND_Y } from '@odi/shared';
import { ALL_CHUNKS } from '@odi/content';
import { HUMAN, NOTACI_HI, NOTACI_LO, humanPrefs, notaciOf, playerOf } from './human';
import { noteWeights } from './planner';
import { playRoomHuman, setup, testSpec } from './testkit';

/**
 * Notaya dalan kademe (MK-015; docs/12 §2, §6). Ana yol kitlesi notayı ancak yolu üstündeyse alır; bu kademe görünen güvenli
 * notaya yönelir, tehlikeye yakın notadan vazgeçer. Var olan kademeler değişmez (tercihlerinde nota niyeti yok).
 */
describe('notaya dalan oyuncu (notaciOf)', () => {
  it('deterministik, parametreleri belgelenen aralıkta; var olan kademelerin tercihleri değişmez', () => {
    expect(notaciOf(5)).toEqual(notaciOf(5));
    for (let k = 0; k < 24; k++) {
      const p = notaciOf(k);
      expect(p.notes!.value).toBeGreaterThanOrEqual(NOTACI_LO.value); expect(p.notes!.value).toBeLessThanOrEqual(NOTACI_HI.value);
      expect(p.notes!.riskPx).toBeGreaterThanOrEqual(NOTACI_LO.riskPx); expect(p.notes!.riskPx).toBeLessThanOrEqual(NOTACI_HI.riskPx);
      // orta beceri: ne usta ucu ne acemi ucu
      expect(p.reactMs).toBeGreaterThan(205); expect(p.reactMs).toBeLessThan(255);
    }
    expect('notes' in humanPrefs(1, HUMAN)).toBe(false);
    for (let k = 0; k < 4; k++) expect(playerOf(k).notes).toBeUndefined();
  });

  it('riski tartar: tehlikeye yakın notanın ek değeri yok, uzaktakinin tam', () => {
    const G = GROUND_Y;
    const spec = testSpec([{ type: 'platform', x: 0, y: G, w: 3000, h: 200 }, { type: 'hazard', x: 1000, y: G - 120, w: 60, h: 60, props: { kind: 'gurultu' } }, { type: 'coin', x: 1030, y: G - 40 }, { type: 'coin', x: 1600, y: G - 40 }]);
    const { w } = setup(spec); const ns = { value: 200, riskPx: 70, viewPx: 300 };
    const m = noteWeights(w, ns); const coins = w.ents.filter((e) => e.type === 'coin');
    expect(m.has(coins[0]!.id)).toBe(false);
    expect(m.get(coins[1]!.id)).toBe(200);
  });

  it('su altındaki notalara dalar: üç düşük odada ana yol kitlesinden çok daha fazla toplar ve bitirir (8 oyuncu)', () => {
    for (const id of ['k1-havuz', 'k3-derin', 'k1-kabarcik']) {
      const c = ALL_CHUNKS.find((x) => x.id === id)!;
      const total = c.entities.reduce((a, e) => a + (e.type === 'coin' ? 1 : e.type === 'collect' ? 5 : 0), 0);
      let kit = 0, nota = 0, fin = 0;
      for (let k = 0; k < 8; k++) {
        kit += playRoomHuman(c, k).coins / total;
        const r = playRoomHuman(c, k, { params: notaciOf(k) }); nota += r.coins / total; fin += r.finished ? 1 : 0;
      }
      expect(nota / 8, `${id}: notacı toplama`).toBeGreaterThanOrEqual(0.3);
      expect(nota, `${id}: notacı > kitle`).toBeGreaterThan(kit + 0.8);
      expect(fin, `${id}: bitirme`).toBe(8);
    }
  }, 600_000);
});
