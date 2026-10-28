/**
 * Çökme raporu, telefon kabuğu (YN-011): React Native tarafındaki hatalar (ErrorBoundary, global ErrorUtils işleyicisi) kendi
 * sunucumuza (`POST <sunucu>/hata`) kişisel veri içermeyen bir rapor olarak gider. Oyunun arayüzü (DOM bileşeni) kendi
 * hatalarını web tarafındaki aynı kurallarla raporlar (apps/web/src/hata.ts); platform bilgisi oraya `appInfo` ile geçer.
 * Kurallar ve alanlar: packages/shared/src/hata.ts. Yalnız yayın derlemesinde (`__DEV__` değil) ve sunucu adresi varken açık.
 * Gönderim hatası yutulur: raporlama uygulamayı asla bozmaz; çökmede rapor önce kuyruğa yazılır, sonraki açılışta gider.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { CRASH_BUILD_RE, CrashReporter, crashEndpoint } from '@odi/shared/hata';

export type AppInfo = { platform: 'ios' | 'android'; os: string; app: string; build: string };
const KUYRUK = 'odi.hata.kuyruk.yerel';

/** platform, işletim sistemi ANA sürümü, uygulama sürümü ve mağaza derleme numarası (kimlik yok); geliştirmede null */
export function nativeAppInfo(dev: boolean = typeof __DEV__ !== 'undefined' && __DEV__): AppInfo | null {
  try {
    if (dev) return null;
    const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : null;
    if (!platform) return null;
    // Android'de Platform.Version API düzeyidir (34); sürüm numarası constants.Release'tedir ("14")
    const raw = platform === 'android' ? String((Platform.constants as { Release?: unknown }).Release ?? '') : String(Platform.Version ?? '');
    const major = /^\d{1,3}/.exec(raw)?.[0];
    const app = Constants.expoConfig?.version ?? '0.0.0';
    const b = platform === 'ios' ? Constants.platform?.ios?.buildNumber : Constants.platform?.android?.versionCode;
    const build = b == null ? '' : String(b);
    return { platform, os: major ? `${platform} ${major}` : platform, app, build: CRASH_BUILD_RE.test(build) ? build : '' };
  } catch { return null; }
}

type Handler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsT = { getGlobalHandler(): Handler; setGlobalHandler(h: Handler): void };

let reporter: CrashReporter | null = null;

/** hatayı raporla (kuruluysa); hiçbir zaman fırlatmaz */
export function reportNativeCrash(e: unknown, screen = 'kabuk'): void {
  try { reporter?.report(e, screen); } catch { /* yut */ }
}

/** bir kez kurulur (uygulama girişinde). serverUrl: ws(s)://… oyun sunucusu */
export function installNativeCrashReporting(serverUrl: string, info: AppInfo | null = nativeAppInfo()): boolean {
  try {
    if (reporter || !info) return false;
    const url = crashEndpoint(serverUrl);
    if (!url) return false;
    reporter = new CrashReporter({
      context: () => ({ app: info.app, build: info.build, platform: info.platform, os: info.os, screen: 'kabuk' }),
      store: { get: () => AsyncStorage.getItem(KUYRUK), set: (v) => AsyncStorage.setItem(KUYRUK, v) },
      post: async (body) => {
        try {
          const r = await fetch(url, { method: 'POST', body, headers: { 'content-type': 'text/plain;charset=UTF-8' }, credentials: 'omit' });
          return r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429);
        } catch { return false; }
      },
    });
    const eu = (globalThis as { ErrorUtils?: ErrorUtilsT }).ErrorUtils;
    if (eu) {
      const prev = eu.getGlobalHandler();
      eu.setGlobalHandler((error, isFatal) => {
        reportNativeCrash(error, isFatal ? 'kabuk-olumcul' : 'kabuk');
        prev(error, isFatal);
      });
    }
    // önceki oturumdan (çökmeden) kalanlar
    const t = setTimeout(() => { void reporter?.flush().catch(() => undefined); }, 4000) as unknown as { unref?: () => void };
    t.unref?.();
    return true;
  } catch { return false; }
}
