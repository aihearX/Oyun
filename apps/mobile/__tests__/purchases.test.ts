/** Mağaza köprüsü (YN-032): fiyatlar RevenueCat getProducts'tan, satın almayla aynı yoldan; hata → boş liste (TL'ye düşülür). */
const mockGetProducts = jest.fn();
const mockConfigure = jest.fn();
const mockLogIn = jest.fn(async () => undefined);
const mockPurchase = jest.fn();
const mockRestore = jest.fn();
jest.mock('react-native-purchases', () => ({ __esModule: true, default: { configure: mockConfigure, logIn: mockLogIn, getProducts: mockGetProducts, purchaseStoreProduct: mockPurchase, restorePurchases: mockRestore, PRODUCT_CATEGORY: { NON_SUBSCRIPTION: 'NON_SUBSCRIPTION' } } }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
let mockExecEnv = 'standalone';
jest.mock('expo-constants', () => ({ __esModule: true, default: { get executionEnvironment() { return mockExecEnv; } } }));

const IDS = ['odi.baslangic', 'odi.kristal.1'];
const fake = [
  { identifier: 'odi.baslangic', priceString: '₺49,99', currencyCode: 'TRY', price: 49.99 },
  { identifier: 'odi.kristal.1', priceString: '₺29,99', currencyCode: 'TRY', price: 29.99 },
];

function load() {
  let m!: typeof import('../src/purchases');
  jest.isolateModules(() => { m = jest.requireActual('../src/purchases'); });
  return m;
}

describe('createNativeStore', () => {
  const env = process.env;
  beforeEach(() => { jest.clearAllMocks(); mockExecEnv = 'standalone'; process.env = { ...env, EXPO_PUBLIC_REVENUECAT_IOS: 'appl_sahte', EXPO_PUBLIC_REVENUECAT_ANDROID: 'goog_sahte' }; });
  afterAll(() => { process.env = env; });

  it('fiyatları getProducts ile çeker ve yalnız gösterim alanlarını verir', async () => {
    mockGetProducts.mockResolvedValueOnce(fake);
    const s = load().createNativeStore()!;
    expect(s).toBeTruthy();
    expect(await s.prices(IDS, 'oyuncu-1')).toEqual([
      { id: 'odi.baslangic', priceString: '₺49,99', currencyCode: 'TRY' },
      { id: 'odi.kristal.1', priceString: '₺29,99', currencyCode: 'TRY' },
    ]);
    expect(mockConfigure).toHaveBeenCalledWith({ apiKey: expect.any(String), appUserID: 'oyuncu-1' });
    expect(mockGetProducts).toHaveBeenCalledWith(IDS, 'NON_SUBSCRIPTION');
    // aynı oyuncu: yeniden kurulmaz; başka oyuncu: logIn
    mockGetProducts.mockResolvedValueOnce(fake);
    await s.prices(IDS, 'oyuncu-1');
    expect(mockConfigure).toHaveBeenCalledTimes(1);
    mockGetProducts.mockResolvedValueOnce(fake);
    await s.prices(IDS, 'oyuncu-2');
    expect(mockLogIn).toHaveBeenCalledWith('oyuncu-2');
  });

  it('mağaza hatasında boş liste (arayüz TL liste fiyatına düşer)', async () => {
    mockGetProducts.mockRejectedValueOnce(new Error('çevrimdışı'));
    expect(await load().createNativeStore()!.prices(IDS, 'oyuncu-1')).toEqual([]);
  });

  it('boş priceString süzülür', () => {
    expect(load().toStorePrices([{ identifier: 'a', priceString: ' ', currencyCode: 'TRY' }, { identifier: 'b', priceString: '$1.99', currencyCode: 'USD' }])).toEqual([{ id: 'b', priceString: '$1.99', currencyCode: 'USD' }]);
  });

  it("Expo Go'da ve anahtar yokken kapalı", () => {
    mockExecEnv = 'storeClient';
    expect(load().createNativeStore()).toBeUndefined();
    mockExecEnv = 'standalone';
    process.env = { ...process.env, EXPO_PUBLIC_REVENUECAT_IOS: '', EXPO_PUBLIC_REVENUECAT_ANDROID: '' };
    expect(load().createNativeStore()).toBeUndefined();
  });
});

/** RevenueCat hata nesnesi (PURCHASES_ERROR_CODE dizge değerleri) */
const rcErr = (code: string, userCancelled = false) => Object.assign(new Error('rc'), { code, userCancelled });

describe('satın alma ve geri yükleme (Apple 3.1.1, YN-285)', () => {
  const env = process.env;
  beforeEach(() => { jest.clearAllMocks(); mockExecEnv = 'standalone'; process.env = { ...env, EXPO_PUBLIC_REVENUECAT_IOS: 'appl_sahte', EXPO_PUBLIC_REVENUECAT_ANDROID: 'goog_sahte' }; });
  afterAll(() => { process.env = env; });

  it('ödeme alınınca mağaza işlem kimliği döner; RevenueCat işlemi kendi bitirir (ayrıca consume/finish çağrılmaz)', async () => {
    mockGetProducts.mockResolvedValueOnce([fake[0]]);
    mockPurchase.mockResolvedValueOnce({ transaction: { transactionIdentifier: '2000000001', productIdentifier: 'odi.baslangic' } });
    const s = load().createNativeStore()!;
    expect(await s.purchase('odi.baslangic', 'oyuncu-1')).toEqual({ ok: true, store: 'app-store', receipt: '2000000001' });
    expect(mockGetProducts).toHaveBeenCalledWith(['odi.baslangic'], 'NON_SUBSCRIPTION');
    expect(mockPurchase).toHaveBeenCalledWith(fake[0]);
  });

  it('hata türleri dürüst: iptal, onay bekliyor, zaten alınmış, belirsiz (ödeme alınmış olabilir), ödeme alınmadı', () => {
    const { purchaseError } = load();
    expect(purchaseError(rcErr('1', true))).toMatchObject({ ok: false, cancelled: true });
    expect(purchaseError(rcErr('20'))).toMatchObject({ pending: true, error: expect.stringContaining('onay bekliyor') });
    expect(purchaseError(rcErr('6'))).toMatchObject({ alreadyOwned: true, error: expect.stringContaining('geri yükle') });
    for (const code of ['10', '35', '12', '16', '7', '0']) {
      const r = purchaseError(rcErr(code));
      expect(r).toMatchObject({ uncertain: true });
      expect(r.error).toContain('Ödeme alındıysa bağlantı dönünce hesabına işlenir');
      expect(r.error).not.toContain('para çekilmedi');
    }
    for (const code of ['3', '5', '23']) expect(purchaseError(rcErr(code))).toEqual({ ok: false, error: 'Satın alma tamamlanamadı. Mağaza ödeme almadı.' });
  });

  it('geri yükleme: RevenueCat restorePurchases oyuncu kimliğiyle; sonucu sunucu işler', async () => {
    mockRestore.mockResolvedValueOnce({ nonSubscriptionTransactions: [{ productIdentifier: 'odi.baslangic', transactionIdentifier: '4000000001' }] });
    const s = load().createNativeStore()!;
    expect(await s.restore('oyuncu-7')).toEqual({ ok: true, store: 'app-store' });
    expect(mockConfigure).toHaveBeenCalledWith({ apiKey: 'appl_sahte', appUserID: 'oyuncu-7' });
    expect(mockRestore).toHaveBeenCalledTimes(1);
  });

  it('geri yükleme hataları: başka hesaba bağlı, bağlantı yok, bilinmeyen', async () => {
    const s = load().createNativeStore()!;
    mockRestore.mockRejectedValueOnce(rcErr('7'));
    expect(await s.restore('oyuncu-1')).toEqual({ ok: false, error: expect.stringContaining('başka bir oyun hesabına bağlı') });
    mockRestore.mockRejectedValueOnce(rcErr('10'));
    expect(await s.restore('oyuncu-1')).toEqual({ ok: false, error: expect.stringContaining('İnternet bağlantını') });
    mockRestore.mockRejectedValueOnce(new Error('x'));
    expect(await s.restore('oyuncu-1')).toEqual({ ok: false, error: expect.stringContaining('okunamadı') });
  });
});
