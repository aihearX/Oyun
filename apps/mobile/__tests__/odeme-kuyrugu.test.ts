/**
 * Bekleyen mağaza ödemeleri telefonda (YN-285): kuyruk AsyncStorage'da kalıcıdır; uygulama kapanıp açılınca (yeni kuyruk, aynı depo)
 * bağlanınca yeniden gönderilir. Geri yükleme akışı: RevenueCat restorePurchases → sunucu shop.restore.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createOdemeKuyrugu, ODEME_KUYRUGU_ANAHTARI } from '../../web/src/odeme-kuyrugu';

const storage = { getItem: (k: string) => AsyncStorage.getItem(k), setItem: (k: string, v: string) => AsyncStorage.setItem(k, v) };
const res = (kristal: number, already?: boolean) => ({ wallet: { kristal }, spend: {}, teamGiftSent: false, ...(already ? { already } : {}) }) as never;
const hata = (code: string) => Object.assign(new Error(code), { code });

describe('bekleyen ödeme kuyruğu (AsyncStorage)', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('ödeme alındı, sunucu yok → kayıt AsyncStorage’da; yeniden açılışta bir kez işlenir', async () => {
    const q1 = createOdemeKuyrugu({ storage, purchase: async () => { throw hata('CEVRIMDISI'); }, restore: jest.fn() });
    const r = await q1.odemeAlindi({ playerId: 'p1', productId: 'odi.pass', store: 'play', receipt: 'GPA.1' });
    expect(r).toMatchObject({ k: 'bekle', kalici: true });
    expect(JSON.parse((await AsyncStorage.getItem(ODEME_KUYRUGU_ANAHTARI))!).odemeler).toHaveLength(1);
    const purchase = jest.fn(async () => res(30));
    const q2 = createOdemeKuyrugu({ storage, purchase, restore: jest.fn() });
    expect((await q2.bosalt('p1')).sonuclar.map((x) => x.k)).toEqual(['islendi']);
    expect(purchase).toHaveBeenCalledWith({ productId: 'odi.pass', store: 'play', receipt: 'GPA.1' });
    expect(await q2.bekleyenler('p1')).toEqual([]);
  });

  it('yanıtı kaybolan istek yeniden gider; sunucunun "zaten işlendi" yanıtı başarıdır, kayıt silinir', async () => {
    let n = 0;
    const q = createOdemeKuyrugu({ storage, purchase: async () => { if (n++ === 0) throw hata('ZAMAN_ASIMI'); return res(300, true); }, restore: jest.fn() });
    expect((await q.odemeAlindi({ playerId: 'p1', productId: 'odi.baslangic', store: 'app-store', receipt: '1' })).k).toBe('bekle');
    expect((await q.bosalt('p1')).sonuclar[0]).toMatchObject({ k: 'zaten' });
    expect(await q.bekleyenler('p1')).toEqual([]);
  });

  it('yarım kalan mağaza işlemi (makbuz yok): bağlanınca sunucu taraması; bulunursa istek biter', async () => {
    const restore = jest.fn(async () => ({ restored: [{ productId: 'odi.kristal.1', store: 'app-store' as const }], alreadyHere: [], elsewhere: [], wallet: { kristal: 120 }, spend: {}, teamGiftSent: false }) as never);
    const q = createOdemeKuyrugu({ storage, purchase: jest.fn(), restore });
    await q.taramaIste('p1');
    const { tarama } = await q.bosalt('p1');
    expect(restore).toHaveBeenCalledTimes(1);
    expect(tarama).toMatchObject({ restored: [{ productId: 'odi.kristal.1' }] });
    expect(JSON.parse((await AsyncStorage.getItem(ODEME_KUYRUGU_ANAHTARI))!).tarama).toEqual([]);
  });
});
