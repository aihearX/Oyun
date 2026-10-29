/**
 * Beta geri bildirimi, web tarafı: Ayarlar › Geri bildirim gönder (screens/GeriBildirimKart.tsx) kendi sunucumuza
 * (`POST <sunucu>/geri-bildirim`) kısa bir not gönderir. Alanlar ve temizleyici: packages/shared/src/geribildirim.ts.
 * Telefonda arayüz Expo DOM bileşeninde çalışır: aynı kod orada da çalışır, platform/sürüm bilgisini kabuk verir (platform().appInfo).
 *
 * Kapalı (istek hiç gitmez, kart "bu oturumda kapalı" der): test derlemesi (VITE_ODI_E2E=1), `?bot=1`, otomasyonla açılan tarayıcı
 * (navigator.webdriver: uçtan uca testler). Tek istisna gizli kanca `?e2e=geribildirim` (social-e2e ve ui-mobile-check gönderimi sınar).
 * Gönderim hatası yutulur; oyun asla bozulmaz. Çerez, oyuncu kimliği, referans adresi gönderilmez.
 */
import { buildFeedback, feedbackEndpoint, osFromUserAgent, type CrashPlatform, type FeedbackContext, type FeedbackTopic } from '@odi/shared';
import { APP_VERSION } from './legal';
import { platform } from './platform';

declare const __ODI_E2E__: boolean | undefined;
declare const __ODI_BUILD__: string | undefined;

const sorgu = (): URLSearchParams => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); } };
/** gizli test kancası: `?e2e=geribildirim` */
export const feedbackHook = (): boolean => sorgu().get('e2e') === 'geribildirim';

/** gönderim bu oturumda açık mı */
export function feedbackEnabled(): boolean {
  try {
    if (feedbackHook()) return true;
    if (typeof __ODI_E2E__ !== 'undefined' && __ODI_E2E__) return false;
    if (sorgu().get('bot') === '1') return false;
    if (typeof navigator !== 'undefined' && navigator.webdriver) return false;
    return true;
  } catch { return false; }
}

// ------------------------------------------------------------------ hangi ekrandan geldi
/** menü ekranları: oyuncu buradan Ayarlar'a gelir; asıl ilgilendiğimiz ondan önceki ekran */
const MENU = new Set(['settings', 'profile']);
let sonEkran = '';
let oncekiEkran = '';
/** App.tsx her rota değişiminde yazar (yalnız rota adı) */
export function noteFeedbackScreen(name: string): void {
  if (name === 'settings') return;
  sonEkran = name;
  if (!MENU.has(name)) oncekiEkran = name;
}
/** gönderilecek ekran adı: Ayarlar'a gelmeden önceki oyun ekranı (yoksa son ekran) */
export const feedbackScreen = (): string => oncekiEkran || sonEkran || 'settings';

function context(): FeedbackContext {
  const info = platform().appInfo;
  const build = typeof __ODI_BUILD__ !== 'undefined' && __ODI_BUILD__ ? __ODI_BUILD__ : '';
  if (info) return { screen: feedbackScreen(), app: info.app, build: info.build, platform: info.platform };
  let pl: CrashPlatform = 'web';
  if (platform().kind === 'native') {
    // telefon kabuğunun geliştirme derlemesi (appInfo yok): yalnız ailesi
    let os = 'other'; try { os = osFromUserAgent(navigator.userAgent); } catch { /* yok */ }
    pl = os.startsWith('android') ? 'android' : os.startsWith('ios') ? 'ios' : 'web';
  }
  return { screen: feedbackScreen(), app: APP_VERSION, build, platform: pl };
}

export type FeedbackSendResult = 'ok' | 'kapali' | 'bos' | 'cok' | 'hata';

/** geri bildirimi gönder; hiçbir zaman fırlatmaz */
export async function sendFeedback(topic: FeedbackTopic, text: string): Promise<FeedbackSendResult> {
  try {
    if (!feedbackEnabled()) return 'kapali';
    const r = buildFeedback(topic, text, context());
    if (!r) return 'bos';
    const url = feedbackEndpoint(platform().serverUrl());
    if (!url) return 'hata';
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), 12_000) : null;
    try {
      const res = await fetch(url, {
        method: 'POST', body: JSON.stringify(r), credentials: 'omit', mode: 'cors', referrerPolicy: 'no-referrer', cache: 'no-store',
        // text/plain: tarayıcı ön istek (CORS preflight) yapmaz; sunucu gövdeyi JSON olarak okur
        headers: { 'content-type': 'text/plain;charset=UTF-8' }, ...(ctl ? { signal: ctl.signal } : {}),
      });
      if (res.ok) return 'ok';
      return res.status === 429 ? 'cok' : 'hata';
    } finally { if (t) clearTimeout(t); }
  } catch { return 'hata'; }
}
