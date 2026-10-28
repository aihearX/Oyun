import { Platform } from 'react-native';
import Constants from 'expo-constants';

export type PurchaseResult = { ok: true; store: 'app-store' | 'play'; receipt: string } | { ok: false; error: string; cancelled?: boolean };
export type PurchaseFn = (productId: string, playerId: string) => Promise<PurchaseResult>;

/** mağazanın yerel fiyatı (köprüyle web arayüzüne gider; bkz. packages/shared StorePrice) */
export type StorePrice = { id: string; priceString: string; currencyCode: string };
export type PricesFn = (productIds: string[], playerId: string) => Promise<StorePrice[]>;
export type NativeStore = { purchase: PurchaseFn; prices: PricesFn };

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
  const purchase: PurchaseFn = async (productId, playerId) => {
    try {
      await ensure(playerId);
      const [product] = await Purchases.getProducts([productId], Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION);
      if (!product) return { ok: false, error: 'Ürün mağazada bulunamadı.' };
      const r = await Purchases.purchaseStoreProduct(product);
      return { ok: true, store: Platform.OS === 'ios' ? 'app-store' : 'play', receipt: r.transaction.transactionIdentifier };
    } catch (e) {
      const cancelled = !!(e && typeof e === 'object' && 'userCancelled' in e && (e as { userCancelled?: boolean }).userCancelled);
      return { ok: false, cancelled, error: cancelled ? 'Satın alma iptal edildi.' : 'Satın alma tamamlanamadı. Hesabından para çekilmedi.' };
    }
  };
  // hata (çevrimdışı, mağaza yanıt vermedi): boş liste → arayüz TL liste fiyatına düşer
  const prices: PricesFn = async (productIds, playerId) => {
    try {
      await ensure(playerId);
      return toStorePrices(await Purchases.getProducts(productIds, Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION));
    } catch { return []; }
  };
  return { purchase, prices };
}
