// Mağaza etiketleri ve açıklamadaki yüzdeler ölçülebilir olmalı (YN-112, OT-ekonomi-denetci-25): satış verisine dayanmayan
// sosyal kanıt rozeti yok; "En iyi değer" kristal paketleri arasında gerçekten en çok kristal/TL; "+%N" en küçük pakete göre fazla kristal.
import { describe, expect, it } from 'vitest';
import { SHOP } from './social';

/** yalnız kristal içeren, sınırsız alınan paketler (Başlangıç ve Sezon Kartı tek seferlik, karışık içerikli) */
const packs = SHOP.filter((p) => p.limit === 0 && p.contents.every((c) => c.kind === 'kristal'));
const kristal = (p: (typeof SHOP)[number]) => p.contents.reduce((a, c) => a + c.amount, 0);
const perTry = (p: (typeof SHOP)[number]) => kristal(p) / p.priceTry;

describe('mağaza etiketleri', () => {
  it('yalnız ölçülebilir etiketler var', () => {
    for (const p of SHOP) expect([undefined, 'en-iyi-deger', 'baslangic']).toContain(p.tag);
  });
  it('"En iyi değer" tek ürün, kristal paketleri arasında en yüksek kristal/TL', () => {
    const best = SHOP.filter((p) => p.tag === 'en-iyi-deger');
    expect(best).toHaveLength(1);
    expect(packs).toContain(best[0]);
    for (const p of packs) if (p !== best[0]) expect(perTry(best[0]!)).toBeGreaterThan(perTry(p));
  });
  it('açıklamadaki "+%N" en küçük kristal paketine göre fazla kristal (yuvarlanmış)', () => {
    const base = packs.reduce((a, p) => (perTry(p) < perTry(a) ? p : a));
    for (const p of packs) {
      const m = /\+%(\d+)/.exec(p.desc);
      if (p === base) { expect(m).toBeNull(); continue; }
      expect(Number(m?.[1])).toBe(Math.round((perTry(p) / perTry(base) - 1) * 100));
    }
  });
});
