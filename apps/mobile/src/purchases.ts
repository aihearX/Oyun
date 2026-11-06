import { Platform } from 'react-native';
import Constants from 'expo-constants';

export type PurchaseResult = { ok: true; store: 'app-store' | 'play'; receipt: string }
  | { ok: false; error: string; cancelled?: boolean; pending?: boolean; uncertain?: boolean; alreadyOwned?: boolean };
export type PurchaseFn = (productId: string, playerId: string) => Promise<PurchaseResult>;
export type RestoreResult = { ok: true; store: 'app-store' | 'play' } | { ok: false; error: string };
export type RestoreFn = (playerId: string) => Promise<RestoreResult>;

/**
 * RevenueCat hata kodu → dürüst sonuç (PURCHASES_ERROR_CODE değerleri; @revenuecat/purchases-typescript-internal).
 * - 1 iptal; 20 ödeme onay bekliyor (Ask to Buy, Play bekleyen ödeme): onaylanınca RevenueCat SDK'sı işlemi iletir.
 * - 6 tüketilmeyen ürün bu mağaza hesabında zaten var (Play ITEM_ALREADY_OWNED).
 * - Belirsiz: mağaza ödemeyi almış olabilir ama işlem RevenueCat'e iletilemedi ya da reddedildi (ağ, sunucu, makbuz). RevenueCat SDK'sı
 *   bitmemiş işlemi bitirmez, uygulama açılınca yeniden iletir; arayüz sunucuya tarama ister.
 * - Öteki kodlar ödeme başlamadan çıkar (ürün yok, izin yok, yapılandırma): para alınmadı.
 */
const RC_UNCERTAIN = new Set(['0', '2', '7', '8', '10', '12', '13', '16', '35']);
export function purchaseError(e: unknown): Extract<PurchaseResult, { ok: false }> {
  const x = (e && typeof e === 'object' ? e : {}) as { code?: unknown; userCancelled?: boolean | null };
  const code = x.code == null ? '' : String(x.code);
  if (x.userCancelled || code === '1') return { ok: false, cancelled: true, error: 'Satın alma iptal edildi.' };
  if (code === '20') return { ok: false, pending: true, error: 'Ödeme onay bekliyor. Onaylanınca ürün hesabına kendiliğinden işlenir.' };
  if (code === '6') return { ok: false, alreadyOwned: true, error: 'Bu ürün mağaza hesabında zaten alınmış. Bu oyun hesabına işlenmediyse Mağaza › Satın alımları geri yükle.' };
  if (RC_UNCERTAIN.has(code)) return { ok: false, uncertain: true, error: 'Mağaza işlemi tamamlanamadı. Ödeme alındıysa bağlantı dönünce hesabına işlenir; gelmezse Mağaza › Satın alımları geri yükle.' };
  return { ok: false, error: 'Satın alma tamamlanamadı. Mağaza ödeme almadı.' };
}

/** mağazanın yerel fiyatı (köprüyle web arayüzüne gider; bkz. packages/shared StorePrice) */
export type StorePrice = { id: string; priceString: string; currencyCode: string };
export type PricesFn = (productIds: string[], playerId: string) => Promise<StorePrice[]>;
export type NativeStore = { purchase: PurchaseFn; prices: PricesFn; restore: RestoreFn };

/** RevenueCat ürününden yalnız gösterim için gerekenler (mağazanın kendi biçimi: vergi, kur ve ülke dahil) */
export function toStorePrices(products: readonly { identifier: string; priceString: string; currencyCode: string }[]): StorePrice[] {
  return products.filter((p) => p && typeof p.priceString === 'string' && p.priceString.trim())
    .map((p) => ({ id: p.identifier, priceString: p.priceString, currencyCode: p.currencyCode }));
}

/**
 * Gerçek mağaza satın alması ve mağaza fiyatları (RevenueCat → App Store / Google Play).
 * Yalnızca mağaza/geliştirme derlemesinde ve anahtar tanımlıysa açılır. Expo Go'da HİÇBİR ZAMAN açılmaz
 * (Expo Go'da gerçek ödeme yoktur; arayüz sunucunun açıkça TEST etiketli test mağazasına düşer ve TL liste fiyatını gösterir).
 * Anahtarlar: EXPO_PUBLIC_REVENUECAT_IOS, EXPO_PUBLIC_REVENUECAT_ANDROID (RevenueCat "public SDK key"; EAS ortamından gelir).
 * Fiyat ve satın alma aynı yoldan çekilir: `getProducts([...], NON_SUBSCRIPTION)` (Offering kullanılmaz).
 */
export function createNativeStore(): NativeStore | undefined {
  if (Constants.executionEnvironment === 'storeClient') return undefined; // Expo Go
  const key = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID;
  if (!key) return undefined;
  type RC = typeof import('react-native-purchases').default;
  let Purchases: RC;
  try { Purchases = (require('react-native-purchases') as { default: RC }).default; } catch { return undefined; }
  let configuredFor: string | null = null;
  const ensure = async (playerId: string) => {
    if (configuredFor == null) { Purchases.configure({ apiKey: key, appUserID: playerId }); configuredFor = playerId; }
    else if (configuredFor !== playerId) { await Purchases.logIn(playerId); configuredFor = playerId; }
  };
  const store = (): 'app-store' | 'play' => (Platform.OS === 'ios' ? 'app-store' : 'play');
  // RevenueCat işlemi kendi bitirir (finish): App Store'da tüketilebilir ürün tüketilir, tüketilmeyen ürün ve yenilenmeyen abonelik
  // makbuzda kalır (geri yüklenebilir). Play'de RevenueCat panosunda "Non-consumable" işaretli ürünü (odi.baslangic) hiç tüketmez,
  // öteki tek seferlik ürünleri tüketir (iap-urunler.md). Bu yüzden burada consume/finish çağrısı yok.
  const purchase: PurchaseFn = async (productId, playerId) => {
    try {
      await ensure(playerId);
      const [product] = await Purchases.getProducts([productId], Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION);
      if (!product) return { ok: false, error: 'Ürün mağazada bulunamadı. Mağaza ödeme almadı.' };
      const r = await Purchases.purchaseStoreProduct(product);
      return { ok: true, store: store(), receipt: r.transaction.transactionIdentifier };
    } catch (e) {
      return purchaseError(e);
    }
  };
  // Satın alımları geri yükle: mağaza hesabındaki işlemler RevenueCat'e iletilir (Apple tüketilmeyen ürün ve yenilenmeyen aboneliği
  // makbuzda tutar; Play'de RevenueCat'in kaydı). Hangi işlemin bu oyun hesabına işleneceğine sunucu karar verir (shop.restore).
  const restore: RestoreFn = async (playerId) => {
    try {
      await ensure(playerId);
      await Purchases.restorePurchases();
      return { ok: true, store: store() };
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: unknown }).code) : '';
      // 7/13: mağaza hesabının işlemleri başka bir RevenueCat kullanıcısında kalıyor (RevenueCat "Keep with original App User ID")
      if (code === '7' || code === '13') return { ok: false, error: 'Bu mağaza hesabının satın alımları başka bir oyun hesabına bağlı; bu hesaba aktarılmaz.' };
      if (code === '10' || code === '35') return { ok: false, error: 'Mağazaya ulaşılamadı. İnternet bağlantını kontrol edip yeniden dene.' };
      return { ok: false, error: 'Mağaza satın alımları okunamadı; biraz sonra yeniden dene.' };
    }
  };
  // hata (çevrimdışı, mağaza yanıt vermedi): boş liste → arayüz TL liste fiyatına düşer
  const prices: PricesFn = async (productIds, playerId) => {
    try {
      await ensure(playerId);
      return toStorePrices(await Purchases.getProducts(productIds, Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION));
    } catch { return []; }
  };
  return { purchase, prices, restore };
}
