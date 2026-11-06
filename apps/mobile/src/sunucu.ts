import Constants from 'expo-constants';

/**
 * Sosyal sunucu adresi: EXPO_PUBLIC_ODI_SERVER (EAS ortam değişkeni; derlemeye gömülür) > yalnız geliştirmede (__DEV__) Metro'nun
 * çalıştığı bilgisayar (aynı Wi-Fi). Yayın derlemesinde değişken yoksa boş döner: yerel/test adresine düşülmez, oyun çevrimdışı
 * oynanır ve sosyal ekranlar "Çevrimiçi özellikler kapalı" der (apps/web/src/ui/social.tsx OfflineCard). Gerçek adres depoya yazılmaz.
 */
export function serverUrl(env = process.env.EXPO_PUBLIC_ODI_SERVER, dev = __DEV__): string {
  if (env) return env;
  if (!dev) return '';
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `ws://${host}:8787` : '';
}
