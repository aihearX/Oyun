import { describe, expect, it } from 'vitest';
import { clampX, freeY } from './float-lane';

/** uçan yazılar ekranda kalır ve üst üste binmez (YN-070, OT-ogrenci-birinci-8) */
describe('uçan yazı yeri (render/float-lane.ts)', () => {
  it('ekran kenarındaki yazı içeri kayar; kamera kaydıkça yeniden yaslanır', () => {
    // 390 genişlikte görünüm, yazı 160 genişlik: sol kenarda x=20 → en az 8 + 80
    expect(clampX(20, 80, 0, 390)).toBe(88);
    expect(clampX(380, 80, 0, 390)).toBe(302);
    expect(clampX(200, 80, 0, 390)).toBe(200);
    // kamera 300 px sağa kaydı: aynı dünya noktası artık solda dışarıda → görünür sol kenara yaslanır
    expect(clampX(200, 80, 300, 390)).toBe(388);
    // ekrandan geniş yazı ortalanır
    expect(clampX(0, 300, 0, 390)).toBe(195);
  });
  it('aynı yerde çıkan ikinci yazı birincinin üstüne çıkar, uzaktaki yerinde kalır', () => {
    const first = { x: 100, y: 300, w: 160, h: 30 };
    expect(freeY({ x: 110, y: 305, w: 180, h: 30 }, [first])).toBe(300 - 15 - 4 - 15);
    expect(freeY({ x: 330, y: 300, w: 100, h: 30 }, [first])).toBe(300);
    // üç yazı üst üste: üçüncüsü ikisinin de üstünde
    const second = { x: 110, y: 266, w: 180, h: 30 };
    const y3 = freeY({ x: 100, y: 300, w: 120, h: 30 }, [first, second]);
    expect(y3).toBeLessThanOrEqual(266 - 30 - 4);
  });
});
