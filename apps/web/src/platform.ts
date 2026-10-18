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
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_ODI_SERVER;
    if (env) return env;
    if (location.protocol === 'file:') return '';
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.hostname}:8787`;
  } catch { return ''; }
}

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
