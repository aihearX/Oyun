import { Platform } from 'react-native';
import Constants from 'expo-constants';

export type PurchaseResult = { ok: true; store: 'app-store' | 'play'; receipt: string } | { ok: false; error: string; cancelled?: boolean };
export type PurchaseFn = (productId: string, playerId: string) => Promise<PurchaseResult>;

/**
 * Gerçek mağaza satın alması (RevenueCat → App Store / Google Play).
 * Yalnızca mağaza/geliştirme derlemesinde ve anahtar tanımlıysa açılır. Expo Go'da HİÇBİR ZAMAN açılmaz
 * (Expo Go'da gerçek ödeme yoktur; arayüz sunucunun açıkça TEST etiketli test mağazasına düşer).
 * Anahtarlar: EXPO_PUBLIC_REVENUECAT_IOS, EXPO_PUBLIC_REVENUECAT_ANDROID (RevenueCat "public SDK key").
 */
export function createNativePurchase(): PurchaseFn | undefined {
  if (Constants.executionEnvironment === 'storeClient') return undefined; // Expo Go
  const key = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID;
  if (!key) return undefined;
  type RC = typeof import('react-native-purchases').default;
  let Purchases: RC;
  try { Purchases = (require('react-native-purchases') as { default: RC }).default; } catch { return undefined; }
  let configuredFor: string | null = null;
  return async (productId, playerId) => {
    try {
      if (configuredFor == null) { Purchases.configure({ apiKey: key, appUserID: playerId }); configuredFor = playerId; }
      else if (configuredFor !== playerId) { await Purchases.logIn(playerId); configuredFor = playerId; }
      const [product] = await Purchases.getProducts([productId], Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION);
      if (!product) return { ok: false, error: 'Ürün mağazada bulunamadı.' };
      const r = await Purchases.purchaseStoreProduct(product);
      return { ok: true, store: Platform.OS === 'ios' ? 'app-store' : 'play', receipt: r.transaction.transactionIdentifier };
    } catch (e) {
      const cancelled = !!(e && typeof e === 'object' && 'userCancelled' in e && (e as { userCancelled?: boolean }).userCancelled);
      return { ok: false, cancelled, error: cancelled ? 'Satın alma iptal edildi.' : 'Satın alma tamamlanamadı. Hesabından para çekilmedi.' };
    }
  };
}
