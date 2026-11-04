import { describe, expect, it } from 'vitest';
import { clampX, freeY, settle } from './float-lane';

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
  it('kenara yaslanıp kayan eski yazı yenisinin üstüne gelirse yenisi yukarı çıkar; eski yerinde kalır (YN-119, OT-sessiz-oyuncu-15)', () => {
    // "+50 ezme!" solda (ekran sol kenarına yaslı), "Kontrol noktası" sağda; ilk karede kesişmiyorlar
    const ezme = { x: 70, y: 480, w: 130, h: 40 }, kontrol = { x: 260, y: 480, w: 200, h: 40 };
    expect(settle([{ box: ezme, lift: 0 }, { box: kontrol, lift: 0 }])).toEqual([0, 0]);
    // kamera 120 px sağa kaydı: ezme kenara yaslı kaldığı için dünyada 120 px sağa kaydı, kontrol noktası yerinde → kesişir
    const kayan = { ...ezme, x: ezme.x + 120 };
    const [l1, l2] = settle([{ box: kayan, lift: 0 }, { box: kontrol, lift: 0 }]);
    expect(l1).toBe(0);
    expect(l2).toBe(40 + 4);
    // kaydırma kalıcı: ertesi karede ezme uzaklaşsa da kontrol noktası aşağı zıplamaz
    expect(settle([{ box: ezme, lift: 0 }, { box: kontrol, lift: l2! }])).toEqual([0, 44]);
  });
  it('yükselişi yetişen yazı (altta çıkıp hızla yükselen) üsttekine binmez', () => {
    // eski yazı yükselişinin sonunda (yavaş), yenisi altında çıktı ve hızla yükselip ona yetişti
    const eski = { x: 200, y: 400, w: 160, h: 36 }, yeni = { x: 210, y: 420, w: 140, h: 36 };
    const [a, b] = settle([{ box: eski, lift: 0 }, { box: yeni, lift: 0 }]);
    expect(a).toBe(0);
    const y = yeni.y - b!;
    expect(y).toBeLessThanOrEqual(eski.y - 36 - 4);
  });
  it('engel işareti ("KAY ↓") sabit kutu: üstüne gelen uçan yazı onun üstüne çıkar, işaret yerinde kalır (YN-179)', () => {
    const kay = { x: 500, y: 400, w: 44, h: 20 };
    const seri = { x: 510, y: 404, w: 150, h: 34 };
    const [lift] = settle([{ box: seri, lift: 0 }], 4, [kay]);
    const y = seri.y - lift!;
    expect(y + seri.h / 2 + 4).toBeLessThanOrEqual(kay.y - kay.h / 2);
    // uzaktaki yazı etkilenmez
    expect(settle([{ box: { ...seri, x: 800 }, lift: 0 }], 4, [kay])).toEqual([0]);
  });
});

