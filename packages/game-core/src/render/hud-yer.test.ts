import { describe, expect, it } from 'vitest';
import { dropBelow, praiseY, touches } from './hud-yer';

/**
 * Melodi hapı örtülmez (YN-183, OT-buyuk-yazi-55): Büyük yazıda 390 tasarım genişliğinde (320 ekran da 390'a ölçeklenir) seri
 * rozeti ("×2 Seri 7") ve "Güzel!" hapın ("Nota 2/8") sağ yarısına biniyordu. Ölçüler oyundaki panellerden (hud.ts).
 */
describe('gösterge yerleşimi (render/hud-yer.ts): melodi hapı ve seri rozeti örtüşmez', () => {
  const t = 10; const W = 390;
  // ikinci satır: melodi hapı ortada (görünür merkez y - 2), Büyük yazıda ~132 px; seri rozeti sağda, ilk yeri t + 100
  const mel = { x: W / 2, y: t + 86, w: 132, h: 32 };
  const comboW = 128; const combo = { x: W - 18 - comboW / 2, y: t + 98, w: comboW, h: 40 };
  it('rozet hapa değiyorsa bir satır aşağı iner; değmiyorsa yerinde kalır', () => {
    expect(touches(combo, mel)).toBe(true);
    const y = dropBelow(combo, [mel]);
    expect(touches({ ...combo, y }, mel, 5.9)).toBe(false);
    expect(y).toBe(mel.y + 16 + 6 + 20);
    // normal yazıda dar hap ve rozet yan yana sığar
    const small = { ...mel, w: 104 }; const c2 = { ...combo, w: 100, x: W - 18 - 50 };
    expect(dropBelow(c2, [small])).toBe(c2.y);
  });
  it('"Sıra bozuldu · 2/8" (geniş hap) ve kalkan + süre birlikteyken zincirleme iner, hiçbirine değmez', () => {
    const timer = { x: W / 2, y: t + 86, w: 140, h: 32 };
    const wide = { x: W / 2, y: t + 122, w: 228, h: 32 };
    const shieldBox = { x: W - 18 - 38, y: t + 86, w: 76, h: 32 };
    const sy = dropBelow(shieldBox, [timer, wide]);
    const shield = { ...shieldBox, y: sy };
    for (const o of [timer, wide]) expect(touches(shield, o)).toBe(false);
    const cy = dropBelow(combo, [timer, wide, shield]);
    for (const o of [timer, wide, shield]) expect(touches({ ...combo, y: cy }, o)).toBe(false);
  });
  it('övgü sözü açılışı ve yükselişi boyunca hapa ve rozete değmez', () => {
    const shown = { ...combo, y: dropBelow(combo, [mel]) };
    for (const [w, h] of [[140, 58], [330, 58]] as const) {
      const y0 = praiseY(W / 2, t + 168, w, h, 26, [mel, shown]);
      // yolun tamamı: y0'dan y0 - 26'ya, ~%10 taşarak
      for (const y of [y0, y0 - 13, y0 - 26]) for (const o of [mel, shown]) expect(touches({ x: W / 2, y, w: w * 1.1, h: h * 1.1 }, o)).toBe(false);
      expect(y0).toBeGreaterThanOrEqual(t + 168);
    }
  });
});
