import { describe, expect, it } from 'vitest';
import { SHOP } from '@odi/shared';
import { STORE_PRICE_NOTE, fmtTry, loadStorePrices, priceLabel, storePriceMap } from './shopPrice';

const IDS = SHOP.map((p) => p.id);
/** sahte mağaza ürünleri: ör. Almanya mağazası (EUR, mağazanın kendi biçimi) */
const eur = (over: Record<string, Partial<{ priceString: string; currencyCode: string }>> = {}) =>
  SHOP.map((p, i) => ({ id: p.id, priceString: `${i + 1},99 €`, currencyCode: 'EUR', ...over[p.id] }));

describe('mağaza fiyatı (YN-032)', () => {
  it('TL liste fiyatı biçimi', () => {
    expect(fmtTry(49.99)).toBe('49,99 TL');
    expect(fmtTry(1000)).toBe('1.000,00 TL');
    expect(fmtTry(0)).toBe('0,00 TL');
  });

  it('her ürünün mağaza fiyatı varsa mağazanın biçimi aynen gösterilir', () => {
    const m = storePriceMap(IDS, eur());
    expect(m).not.toBeNull();
    expect(priceLabel(SHOP[0]!, m)).toEqual({ text: '1,99 €', store: true });
    expect(priceLabel(SHOP[6]!, m)).toEqual({ text: '7,99 €', store: true });
    // Türkiye mağazası: tutar SHOP'tan farklı olsa da (vergi/kur) mağazanınki gösterilir
    const tr = storePriceMap(['odi.baslangic'], [{ id: 'odi.baslangic', priceString: '₺54,99', currencyCode: 'try' }]);
    expect(priceLabel(SHOP[0]!, tr)).toEqual({ text: '₺54,99', store: true });
  });

  it('fiyat yoksa TL liste fiyatı (not gösterilir)', () => {
    expect(priceLabel(SHOP[0]!, null)).toEqual({ text: '49,99 TL', store: false });
    expect(STORE_PRICE_NOTE).toBe('Mağaza fiyatı satın alırken gösterilir');
  });

  it('yanlış para birimi gösterilmez: eksik ürün, karışık para birimi ya da bozuk veri → hepsi TL', () => {
    expect(storePriceMap(IDS, eur().slice(1))).toBeNull(); // bir ürün mağazada yok
    expect(storePriceMap(IDS, eur({ 'odi.pass': { currencyCode: 'USD', priceString: '$7.99' } }))).toBeNull();
    expect(storePriceMap(IDS, eur({ 'odi.hiz.1': { priceString: '   ' } }))).toBeNull();
    expect(storePriceMap(IDS, eur({ 'odi.hiz.1': { currencyCode: 'euro' } }))).toBeNull();
    for (const bad of [null, undefined, {}, 'x', [null, 1, 'a']]) expect(storePriceMap(IDS, bad)).toBeNull();
    expect(storePriceMap([], eur())).toBeNull();
  });

  it('fazla ürün ve boşluklar zararsız', () => {
    const m = storePriceMap(['odi.kristal.1'], [...eur({ 'odi.kristal.1': { priceString: ' 2,99 € ', currencyCode: ' eur ' } }), { id: 'baska', priceString: '$1', currencyCode: 'USD' }]);
    expect(m?.get('odi.kristal.1')).toEqual({ id: 'odi.kristal.1', priceString: '2,99 €', currencyCode: 'EUR' });
    expect(m?.size).toBe(1);
  });

  it('köprü: yok, hata, zaman aşımı → null; başarı → harita', async () => {
    expect(await loadStorePrices(undefined, IDS, 'p')).toBeNull();
    expect(await loadStorePrices(async () => { throw new Error('çevrimdışı'); }, IDS, 'p')).toBeNull();
    expect(await loadStorePrices(() => new Promise(() => undefined), IDS, 'p', 20)).toBeNull();
    expect(await loadStorePrices(async () => [], IDS, 'p')).toBeNull();
    let got: [string[], string] | null = null;
    const m = await loadStorePrices(async (ids, pid) => { got = [ids, pid]; return eur(); }, IDS, 'oyuncu-1');
    expect(got).toEqual([IDS, 'oyuncu-1']);
    expect(m?.size).toBe(IDS.length);
  });
});
