/**
 * Platform köprüsü: aynı React arayüzü hem tarayıcıda (apps/web) hem iPhone/Android'de
 * (apps/mobile, Expo DOM bileşeni içinde) çalışır. Yerel yetenekler buradan geçer.
 * Mobil kabuk `installPlatform(...)` ile kendi uygulamasını kurar; kurulmazsa tarayıcı varsayılanları kullanılır.
 */
import type { StorePrice } from '@odi/shared';
import { isMaleVoice, pickTurkishVoice, ttsChunks, ttsParams } from './ftue/voicePick';

export interface SpeakOpts { rate?: number; pitch?: number; /** yalnız erkek tr-TR ses varsa oku (Tüy Dede kadın sesle konuşmaz) */ maleOnly?: boolean }
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
  /**
   * anlatıcı sesi (cihaz TTS): Türkçe metni cümle cümle okur (mobilde expo-speech, tarayıcıda speechSynthesis); yoksa sessiz.
   * Erkek tr-TR ses varsa o seçilir; opts kadın/varsayılan ses için hız ve perdedir (bkz. ftue/voicePick.ts). Okuma bitince çözülür.
   */
  speak(text: string, opts?: SpeakOpts): Promise<boolean | void> | void;
  /** okumayı hemen kes (ileri/atla) */
  stopSpeaking(): void;
  /** kayıtlı anlatıcı sesleri (yalnız mobil kabuk): uygulamaya gömülü ses listesinin JSON'u (voice/manifest.json) */
  voiceManifest?: () => Promise<string | null>;
  /** gömülü kaydın baytları (base64; yalnız mobil kabuk). WebView içinde WebAudio ile çözülüp çalınır. */
  voiceData?: (file: string) => Promise<string | null>;
  /** cihazdaki bütün kayıtları sil (mobil: AsyncStorage) */
  clearAll?: () => Promise<void>;
  /** arayüzü baştan kur (mobil: WebView yeniden oluşturulur); yoksa sayfa yenilenir */
  restartApp?: () => void;
  purchase?: (productId: string, playerId: string) => Promise<{ ok: true; store: 'app-store' | 'play'; receipt: string } | { ok: false; error: string; cancelled?: boolean }>;
  /**
   * Mağazanın yerel fiyatları (yalnız mağaza derlemesinde, `purchase` ile birlikte): RevenueCat `getProducts` → ürün başına
   * `priceString` (mağazanın biçimi, vergi ve kur dahil). Tarayıcıda ve Expo Go'da tanımsız → arayüz TL liste fiyatını gösterir.
   */
  storePrices?: (productIds: string[], playerId: string) => Promise<StorePrice[]>;
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
    // varsayılan portta (80/443) yayın = Caddy arkasında aynı adres (tools/sunucu/kur.sh): WebSocket aynı kökene bağlanır,
    // sunucu adresi için yeniden derleme gerekmez. Geliştirme sunucuları (vite :5173 vb.) portlu açılır → ayrı oyun sunucusu :8787.
    if (!location.port) return `${proto}://${location.host}`;
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

/**
 * Tarayıcı TTS: en uygun tr-TR ses (erkek/yaşlı erkek önde), cümleler ayrı sözcelerle sıraya alınır (aralarda doğal nefes).
 * Ses ya da API yoksa sessizce geçer (altyazı yeter). Son cümle bitince (ya da güvenlik süresi dolunca) çözülür.
 */
function webSpeak(text: string, opts: SpeakOpts = {}): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ss = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
      if (!ss || typeof SpeechSynthesisUtterance === 'undefined' || !text.trim()) { resolve(false); return; }
      ss.cancel();
      const voice = pickTurkishVoice(ss.getVoices());
      if (opts.maleOnly && !isMaleVoice(voice)) { resolve(false); return; }
      const { rate, pitch } = ttsParams(isMaleVoice(voice), opts);
      const chunks = ttsChunks(text); let left = chunks.length; let done = false;
      const finish = () => { if (done) return; done = true; clearTimeout(guard); resolve(true); };
      const guard = setTimeout(finish, (text.length * 95) / rate + 2500);
      for (const c of chunks) {
        const u = new SpeechSynthesisUtterance(c);
        u.lang = 'tr-TR'; u.rate = rate; u.pitch = pitch; if (voice) u.voice = voice;
        u.onend = u.onerror = () => { if (--left <= 0) finish(); };
        ss.speak(u);
      }
    } catch { resolve(false); }
  });
}

/** Sıfırlama sırasında kalıcı yazmaları durdur (silinen kayıtlar arkadan yeniden yazılmasın) */
let frozen = false;
export function freezeStorage() {
  frozen = true;
  const st = current.storage;
  current = { ...current, storage: { getItem: (k) => st.getItem(k), setItem: async () => undefined, removeItem: (k) => st.removeItem(k) } };
}
export const storageFrozen = () => frozen;

export function installPlatform(p: Partial<Platform>) { current = { ...current, ...p, storage: p.storage ?? current.storage }; }
export function platform(): Platform { return current; }

/** Kalıcı depolama: her çağrıda o anki platforma gider (mobil köprü sonradan kurulsa da doğru yere yazar). */
export const platformStorage: Platform['storage'] = {
  getItem: (k) => current.storage.getItem(k),
  setItem: (k, v) => (frozen ? Promise.resolve() : current.storage.setItem(k, v)),
  removeItem: (k) => current.storage.removeItem(k),
};
