/** Mağaza köprüsü (YN-032): fiyatlar RevenueCat getProducts'tan, satın almayla aynı yoldan; hata → boş liste (TL'ye düşülür). */
const mockGetProducts = jest.fn();
const mockConfigure = jest.fn();
const mockLogIn = jest.fn(async () => undefined);
jest.mock('react-native-purchases', () => ({ __esModule: true, default: { configure: mockConfigure, logIn: mockLogIn, getProducts: mockGetProducts, purchaseStoreProduct: jest.fn(), PRODUCT_CATEGORY: { NON_SUBSCRIPTION: 'NON_SUBSCRIPTION' } } }));
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
