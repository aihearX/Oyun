/**
 * Çökme raporu, web tarafı (YN-011): window.onerror, unhandledrejection ve React hata sınırları (ui/HataSiniri.tsx) kendi
 * sunucumuza (`POST <sunucu>/hata`) kişisel veri içermeyen bir rapor gönderir. Kurallar ve alanlar: packages/shared/src/hata.ts.
 * Telefonda arayüz Expo DOM bileşeninde çalışır: aynı kod orada da çalışır, platform/derleme bilgisini kabuk verir (platform().appInfo).
 *
 * Kapalı: geliştirme sunucusu (derleme kimliği yok), test derlemesi (VITE_ODI_E2E=1), `?bot=1`, otomasyonla açılan tarayıcı
 * (navigator.webdriver: uçtan uca testler). Tek istisna gizli kanca `?e2e=hata`: raporlamayı açar ve kasıtlı bir hata atar
 * (social-e2e bir raporun sunucuya ulaştığını ve oyuncu kimliği taşımadığını denetler).
 * Gönderim hatası yutulur; raporlama oyunu asla bozmaz. Çerez, oyuncu kimliği, referans adresi gönderilmez.
 */
import { CrashReporter, crashEndpoint, osFromUserAgent, type CrashContext } from '@odi/shared';
import { APP_VERSION } from './legal';
import { platform } from './platform';

declare const __ODI_E2E__: boolean | undefined;
declare const __ODI_BUILD__: string | undefined;

const KUYRUK = 'odi.hata.kuyruk';
let ekran = 'acilis';
/** o anki ekran/rota adı (App.tsx her rota değişiminde yazar) */
export function setCrashScreen(name: string): void { ekran = name; }

const sorgu = (): URLSearchParams => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); } };
/** gizli test kancası: `?e2e=hata` */
export const crashHook = (): boolean => sorgu().get('e2e') === 'hata';
const webBuild = (): string => (typeof __ODI_BUILD__ !== 'undefined' && __ODI_BUILD__ ? __ODI_BUILD__ : '');

/** raporlama bu oturumda açık mı */
export function crashReportingEnabled(): boolean {
  try {
    if (crashHook()) return true;
    if (typeof __ODI_E2E__ !== 'undefined' && __ODI_E2E__) return false;
    if (sorgu().get('bot') === '1') return false;
    if (typeof navigator !== 'undefined' && navigator.webdriver) return false;
    // telefon kabuğu bilgiyi yalnız mağaza/yayın derlemesinde verir; web'de yalnız `vite build` çıktısında derleme kimliği var
    return !!platform().appInfo || !!webBuild();
  } catch { return false; }
}

function context(): CrashContext {
  const info = platform().appInfo;
  if (info) return { app: info.app, build: info.build, platform: info.platform, os: info.os, screen: ekran };
  let os = 'other'; try { os = osFromUserAgent(navigator.userAgent); } catch { /* yok */ }
  return { app: APP_VERSION, build: webBuild(), platform: 'web', os, screen: ekran };
}

async function post(body: string): Promise<boolean> {
  const url = crashEndpoint(platform().serverUrl());
  if (!url) return false;
  try {
    const r = await fetch(url, {
      method: 'POST', body, keepalive: true, credentials: 'omit', mode: 'cors', referrerPolicy: 'no-referrer', cache: 'no-store',
      // text/plain: tarayıcı ön istek (CORS preflight) yapmaz; sunucu gövdeyi JSON olarak okur
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
    });
    // 2xx ya da kalıcı ret (400/405/413): kuyruktan çıkar; 429 ve 5xx: sonra yeniden dene
    return r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429);
  } catch { return false; }
}

let reporter: CrashReporter | null = null;

/** hatayı raporla (açıksa). Hata sınırları ve kabuk çağırır; hiçbir zaman fırlatmaz. */
export function reportCrash(e: unknown, screen?: string): void {
  try { if (reporter) reporter.report(e, screen); } catch { /* yut */ }
}

/** bir kez kurulur (web: main.tsx; telefon: WebApp.tsx köprü kurulduktan sonra) */
export function installCrashReporting(): void {
  try {
    if (reporter || typeof window === 'undefined' || !crashReportingEnabled()) return;
    reporter = new CrashReporter({
      context, post,
      store: { get: () => platform().storage.getItem(KUYRUK), set: (v) => platform().storage.setItem(KUYRUK, v) },
    });
    window.addEventListener('error', (ev: ErrorEvent) => {
      // başka kökenden betik hatası ("Script error.") bilgi taşımaz
      if (ev.error) reportCrash(ev.error);
      else if (ev.message && !/^Script error\.?$/.test(ev.message)) reportCrash({ name: 'Error', message: ev.message, stack: ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : '' });
    });
    window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
      const r: unknown = ev.reason;
      reportCrash(r instanceof Error ? r : { name: 'UnhandledRejection', message: r === undefined ? 'undefined' : typeof r, stack: '' });
    });
    const flush = () => { void reporter?.flush().catch(() => undefined); };
    window.addEventListener('online', flush);
    // açılışta önceki oturumlardan kalanlar (ilk çizimle yarışmasın)
    setTimeout(flush, 4000);
    if (crashHook()) setTimeout(() => { throw new Error('ODİ kasıtlı test hatası'); }, 1500);
  } catch { /* yut */ }
}
