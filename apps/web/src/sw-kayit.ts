/**
 * Service worker kaydı (MK-037): ana ekrana eklenen web sürümü bağlantı yokken de açılsın. Kurallar dist/sw.js'te
 * (kalıbı apps/web/sw/sw.js, derlemede yazılır). Yalnız web girişinden (main.tsx) çağrılır; telefon kabuğu (Expo DOM,
 * apps/mobile) App'i doğrudan içe aktarır, bu dosyayı hiç yüklemez.
 * Kaydedilmez: geliştirme sunucusu, test derlemesi (VITE_ODI_E2E=1: harness istek yakalama/sahte yanıtları service worker'dan
 * geçmesin), `?bot=1`, WebView içi (ReactNativeWebView), güvensiz köken (https ya da localhost değilse).
 * Yeni sürüm sayfayı yenilemez: bir sonraki açılışta etkinleşir (sw.js).
 */
declare const __ODI_E2E__: boolean | undefined;

export function registerServiceWorker(): void {
  try {
    if (!import.meta.env.PROD) return;
    if (typeof __ODI_E2E__ !== 'undefined' && __ODI_E2E__) return;
    if (!('serviceWorker' in navigator)) return;
    if ((window as Window & { ReactNativeWebView?: unknown }).ReactNativeWebView) return;
    if (new URLSearchParams(location.search).get('bot') === '1') return;
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '[::1]';
    if (location.protocol !== 'https:' && !(location.protocol === 'http:' && local)) return;
    const go = () => { navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => undefined); };
    // ilk çizim ve önden yüklemelerle yarışmasın: sayfa yüklendikten sonra
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
  } catch { /* desteklenmiyor */ }
}
