/**
 * Platform köprüsü: aynı React arayüzü hem tarayıcıda (apps/web) hem iPhone/Android'de
 * (apps/mobile, Expo DOM bileşeni içinde) çalışır. Yerel yetenekler buradan geçer.
 * Mobil kabuk `installPlatform(...)` ile kendi uygulamasını kurar; kurulmazsa tarayıcı varsayılanları kullanılır.
 */
export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'error';
export interface Platform {
  kind: 'web' | 'native';
  storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
  haptic(kind: HapticKind): void;
  share(text: string): Promise<'shared' | 'copied' | 'cancelled'>;
  /** sosyal sunucu adresi (ws:// veya wss://); boşsa sosyal özellikler kapalı */
  serverUrl(): string;
  /** güvenli alan (çentik) payları, px */
  insets: { top: number; bottom: number };
  /**
   * Gerçek mağaza satın alması (App Store / Google Play, RevenueCat üzerinden). Yalnızca mağaza derlemesinde vardır;
   * tarayıcıda ve Expo Go'da tanımsızdır → arayüz sunucunun açıkça TEST etiketli test mağazasını kullanır.
   * playerId: sosyal sunucudaki oyuncu kimliği (RevenueCat kullanıcı kimliği olarak kullanılır; sunucu bu kimlikle doğrular).
   * Dönen makbuz (işlem kimliği) sunucuya 'shop.purchase' ile gönderilir; sunucu doğrular.
   */
  purchase?: (productId: string, playerId: string) => Promise<{ ok: true; store: 'app-store' | 'play'; receipt: string } | { ok: false; error: string; cancelled?: boolean }>;
}

const webStorage: Platform['storage'] = {
  async getItem(k) { try { return localStorage.getItem(k); } catch { return null; } },
  async setItem(k, v) { try { localStorage.setItem(k, v); } catch { /* gizli mod */ } },
  async removeItem(k) { try { localStorage.removeItem(k); } catch { /* yok */ } },
};

function defaultServerUrl(): string {
  try {
    const q = new URLSearchParams(location.search).get('sunucu');
    if (q) return q;
    // derleme zamanı sabiti (vite.config define); Metro/DOM paketinde tanımsız olabilir
    if (typeof __ODI_SERVER__ !== 'undefined' && __ODI_SERVER__) return __ODI_SERVER__;
    if (location.protocol === 'file:') return '';
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.hostname}:8787`;
  } catch { return ''; }
}

declare const __ODI_SERVER__: string | undefined;

let current: Platform = {
  kind: 'web',
  storage: webStorage,
  haptic(kind) { try { if ('vibrate' in navigator) navigator.vibrate(kind === 'heavy' ? 40 : kind === 'medium' || kind === 'error' ? 20 : 8); } catch { /* yok */ } },
  async share(text) {
    try { if (navigator.share) { await navigator.share({ text }); return 'shared'; } await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'cancelled'; }
  },
  serverUrl: defaultServerUrl,
  insets: { top: 0, bottom: 0 },
};

export function installPlatform(p: Partial<Platform>) { current = { ...current, ...p, storage: p.storage ?? current.storage }; }
export function platform(): Platform { return current; }

/** Kalıcı depolama: her çağrıda o anki platforma gider (mobil köprü sonradan kurulsa da doğru yere yazar). */
export const platformStorage: Platform['storage'] = {
  getItem: (k) => current.storage.getItem(k),
  setItem: (k, v) => current.storage.setItem(k, v),
  removeItem: (k) => current.storage.removeItem(k),
};
