import { describe, expect, it } from 'vitest';
import { SHOP } from '@odi/shared';
import { BEST_VALUE_LABEL, STORE_PRICE_NOTE, bestValue, crystalsPerTry, fmtPerTry, fmtTry, limitBlock, listPriceNote, loadStorePrices, payLine, priceLabel, storePriceMap } from './shopPrice';

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
    expect(STORE_PRICE_NOTE).toBe('Ödeyeceğin tutarı App Store / Google Play kendi onay penceresinde gösterir');
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

const byId = (id: string) => SHOP.find((p) => p.id === id)!;

describe('ödenecek tutar cümlesi (YN-073, OT-ekonomi-denetci-7)', () => {
  it('TEST: para çekilmez; olmayan mağaza fiyatı vaat edilmez', () => {
    const t = payLine('test', byId('odi.kristal.1'), null);
    expect(t).toBe('Bu bir test alımı: hesabından para çekilmez (liste fiyatı 29,99 TL).');
    expect(t).not.toMatch(/mağaza fiyatı|onay penceresi/i);
    expect(listPriceNote('test')).toBe('Fiyatlar TL liste fiyatıdır. TEST mağazasında para çekilmez.');
  });
  it('gerçek mağaza: priceString varsa o, yoksa mağazanın onay penceresi', () => {
    const m = storePriceMap(IDS, eur());
    expect(payLine('real', SHOP[0]!, m)).toBe('Ödenecek tutar: 1,99 € (mağaza fiyatı).');
    expect(payLine('real', SHOP[0]!, null)).toBe(`${STORE_PRICE_NOTE}; liste fiyatı 49,99 TL.`);
    expect(listPriceNote('real')).toBe(`Fiyatlar TL liste fiyatıdır. ${STORE_PRICE_NOTE}.`);
  });
});

describe('aylık sınır: liste ve pencere aynı kural (OT-ekonomi-denetci-18)', () => {
  const sp = { limitChosen: true, monthTry: 29.99, limitTry: 50 };
  it('29,99 / 50 TL: sınırı aşan paket engelli, sığan alınabilir', () => {
    expect(limitBlock(sp, 29.99)).toBe('Aylık sınırını aşıyor'); // 59,98 > 50
    expect(limitBlock(sp, 49.99)).toBe('Aylık sınırını aşıyor');
    expect(limitBlock(sp, 20.01)).toBeNull(); // tam 50,00
    expect(limitBlock({ ...sp, monthTry: 0 }, 49.99)).toBeNull();
  });
  it('sınır 0 = satın alma kapalı; sınır seçilmediyse engel yok (önce sınır seçilir)', () => {
    expect(limitBlock({ limitChosen: true, monthTry: 0, limitTry: 0 }, 29.99)).toBe('Satın alma kapalı (aylık sınır)');
    expect(limitBlock({ limitChosen: false, monthTry: 0, limitTry: 100 }, 299.99)).toBeNull();
  });
});

describe('"En iyi değer" rozeti gerçek oranlardan (OT-ekonomi-denetci-34)', () => {
  it('kristal paketleri arasında lira başına en çok kristal: Sandık Kristal, 4,7 kristal/TL', () => {
    const b = bestValue(SHOP);
    expect(b?.id).toBe('odi.kristal.3');
    expect(fmtPerTry(b!.perTry)).toBe('4,7');
    expect(BEST_VALUE_LABEL).toBe('Kristal paketlerinde en iyi değer');
    // veri etiketiyle aynı ürün (magaza.test.ts)
    expect(SHOP.find((p) => p.tag === 'en-iyi-deger')?.id).toBe(b?.id);
  });
  it('Sezon Kartı ve Başlangıç karşılaştırmaya girmez (rozet bağlamı bu yüzden "Kristal paketlerinde")', () => {
    // Sezon Kartı 840 kristal / 99,99 TL = 8,4 kristal/TL ama 28 güne yayılı; içerik "pass", kristal değil
    expect(840 / byId('odi.pass').priceTry).toBeGreaterThan(bestValue(SHOP)!.perTry);
    expect(crystalsPerTry(byId('odi.pass'))).toBe(0);
    expect(bestValue(SHOP.filter((p) => p.id !== 'odi.kristal.3'))?.id).toBe('odi.kristal.2');
  });
  it('hesap sabit değil: oranlar değişirse rozet de değişir; eşitlik ya da tek paket → rozet yok', () => {
    const avuc = { ...byId('odi.kristal.1'), priceTry: 10 }; // 12 kristal/TL
    expect(bestValue(SHOP.map((p) => (p.id === avuc.id ? avuc : p)))?.id).toBe('odi.kristal.1');
    const a = { id: 'a', limit: 0, priceTry: 10, contents: [{ kind: 'kristal' as const, amount: 50 }] };
    expect(bestValue([a, { ...a, id: 'b' }])).toBeNull();
    expect(bestValue([a])).toBeNull();
  });
});
