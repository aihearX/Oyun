/**
 * Platform köprüsü: aynı React arayüzü hem tarayıcıda (apps/web) hem iPhone/Android'de
 * (apps/mobile, Expo DOM bileşeni içinde) çalışır. Yerel yetenekler buradan geçer.
 * Mobil kabuk `installPlatform(...)` ile kendi uygulamasını kurar; kurulmazsa tarayıcı varsayılanları kullanılır.
 */
export interface SpeakOpts { rate?: number; pitch?: number }
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
  /** anlatıcı sesi: Türkçe metni sesli okur (mobilde yerel TTS / expo-speech, tarayıcıda speechSynthesis); yoksa sessiz */
  speak(text: string, opts?: SpeakOpts): void;
  /** okumayı hemen kes (ileri/atla) */
  stopSpeaking(): void;
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
  speak: webSpeak,
  stopSpeaking() { try { window.speechSynthesis?.cancel(); } catch { /* yok */ } },
};

/** Tarayıcı TTS: tr-TR ses (varsa en doğal olanı); ses yoksa ya da API yoksa sessizce geçer */
function webSpeak(text: string, opts: SpeakOpts = {}) {
  try {
    const ss = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!ss || typeof SpeechSynthesisUtterance === 'undefined' || !text.trim()) return;
    ss.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'tr-TR'; u.rate = opts.rate ?? 0.95; u.pitch = opts.pitch ?? 0.92;
    const voices = ss.getVoices().filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('tr'));
    const best = voices.find((v) => /natural|enhanced|premium|neural/i.test(v.name)) ?? voices.find((v) => v.localService) ?? voices[0];
    if (best) u.voice = best;
    ss.speak(u);
  } catch { /* TTS yok: altyazı yeter */ }
}

export function installPlatform(p: Partial<Platform>) { current = { ...current, ...p, storage: p.storage ?? current.storage }; }
export function platform(): Platform { return current; }

/** Kalıcı depolama: her çağrıda o anki platforma gider (mobil köprü sonradan kurulsa da doğru yere yazar). */
export const platformStorage: Platform['storage'] = {
  getItem: (k) => current.storage.getItem(k),
  setItem: (k, v) => current.storage.setItem(k, v),
  removeItem: (k) => current.storage.removeItem(k),
};
