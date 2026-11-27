import { describe, expect, it } from 'vitest';
import { SHOP } from '@odi/shared';
import { magazaKumesi } from './screens/ShopScreen';
import { magazaDurumunuYukle, magazaGizli, sunucuMagazaGizliAyarla, yanittanGizli } from './magaza-gorunum';

describe('1.3.0 mağaza vitrini', () => {
  it('kümeler: paketler üstte, kristal paketleri, hızlandırıcılar; her küme ardışık (başlık bir kez)', () => {
    const k = SHOP.map(magazaKumesi);
    expect(k).toEqual(['paket', 'paket', 'paket', 'kristal', 'kristal', 'kristal', 'kristal', 'kristal', 'hiz', 'hiz']);
    expect(SHOP.filter((p) => magazaKumesi(p) === 'kristal').map((p) => p.contents[0]!.amount)).toEqual([60, 120, 650, 1400, 2600]);
  });
  it('kristal paketlerinde lira başına kristal büyük pakette artar', () => {
    const oran = SHOP.filter((p) => magazaKumesi(p) === 'kristal').map((p) => p.contents[0]!.amount / p.priceTry);
    for (let i = 2; i < oran.length; i++) expect(oran[i]!).toBeGreaterThan(oran[i - 1]!);
  });
  it('sunucu "magaza":"gizli" derse gizli; alan yoksa açık; ağ hatasında son değer kalır', async () => {
    expect(yanittanGizli({ ios: '1.2.0', magaza: 'gizli' })).toBe(true);
    expect(yanittanGizli({ ios: '1.2.0' })).toBe(false);
    expect(yanittanGizli(null)).toBe(false);
    const ok = (body: unknown) => (async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch;
    await magazaDurumunuYukle('wss://ornek.test', ok({ magaza: 'gizli' }));
    expect(magazaGizli()).toBe(true);
    await magazaDurumunuYukle('wss://ornek.test', (async () => { throw new Error('ağ yok'); }) as unknown as typeof fetch);
    expect(magazaGizli()).toBe(true);
    await magazaDurumunuYukle('wss://ornek.test', ok({}));
    expect(magazaGizli()).toBe(false);
    sunucuMagazaGizliAyarla(false);
  });
});
