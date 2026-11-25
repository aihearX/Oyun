/**
 * Açılış kontrolleri (1.1.0), yalnız telefon kabuğunda, soğuk açılışta bir kez (platform().onceThisLaunch):
 * - "Daha iyi bir deneyim için sesi açın": oyunun ses ayarı kapalıysa ya da telefonun medya sesi okunabiliyor ve ~0 ise.
 * - Güncelleme sorusu: sunucunun `GET /surum` yanıtındaki mağaza sürümü ({"ios":"1.1.0","android":"1.1.0"}) yüklü sürümden
 *   yeniyse "Güncellemek ister misiniz?" (Evet mağaza sayfasını açar). Ağ hatası, eksik alan, geliştirme derlemesi: sessizce geçilir.
 */
import { serverHttpEndpoint } from '@odi/shared';
import { audio } from '@odi/audio';
import { platform } from './platform';
import { useStore } from './store';

export const STORE_URL = {
  ios: 'https://apps.apple.com/tr/app/id6836512265',
  android: 'https://play.google.com/store/apps/details?id=com.aiheartech.odi',
} as const;
export type StorePlatform = keyof typeof STORE_URL;

/** "1.2.10" → [1, 2, 10] (eksik alt sürüm 0); sayı dışı / ön sürüm ("1.1.0-beta") → null */
export function parseVersion(v: unknown): [number, number, number] | null {
  if (typeof v !== 'string') return null;
  const m = /^\s*v?(\d{1,6})(?:\.(\d{1,6}))?(?:\.(\d{1,6}))?\s*$/.exec(v);
  if (!m) return null;
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

/** mağazadaki sürüm yüklü olandan yeni mi (ikisi de geçerli sürümse) */
export function isNewerVersion(store: unknown, installed: unknown): boolean {
  const a = parseVersion(store), b = parseVersion(installed);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i]! !== b[i]!) return a[i]! > b[i]!;
  return false;
}

/** `GET /surum` yanıtından bu platformun sürümü; alan yoksa / geçersizse null */
export function storeVersionFor(body: unknown, p: StorePlatform): string | null {
  if (!body || typeof body !== 'object') return null;
  const v = (body as Record<string, unknown>)[p];
  return typeof v === 'string' && parseVersion(v) ? v.trim() : null;
}

/** sunucu adresinden (ws(s)://kök) sürüm ucu: http(s)://kök/surum; adres yoksa boş */
export const versionEndpoint = (serverUrl: string): string => serverHttpEndpoint(serverUrl, 'surum');

/**
 * Yeni sürüm var mı? Varsa { version, url }. Hiçbir durumda fırlatmaz (ağ hatası, zaman aşımı, bozuk yanıt → null).
 */
export async function checkForUpdate(o: {
  serverUrl: string; installed: string | null | undefined; platform: StorePlatform | null | undefined;
  fetch?: typeof fetch; timeoutMs?: number;
}): Promise<{ version: string; url: string } | null> {
  try {
    if (!o.platform || !o.installed || !parseVersion(o.installed)) return null;
    const url = versionEndpoint(o.serverUrl); if (!url) return null;
    const f = o.fetch ?? (typeof fetch === 'function' ? fetch : null); if (!f) return null;
    const ac = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => ac?.abort(), o.timeoutMs ?? 8000);
    try {
      const r = await f(url, { method: 'GET', cache: 'no-store', ...(ac ? { signal: ac.signal } : {}) });
      if (!r.ok) return null;
      const v = storeVersionFor(await r.json(), o.platform);
      return v && isNewerVersion(v, o.installed) ? { version: v, url: STORE_URL[o.platform] } : null;
    } finally { clearTimeout(t); }
  } catch { return null; }
}

/** medya sesi bu düzeyin altındaysa "kapalı" sayılır (0..1) */
export const MUTED_VOLUME = 0.04;
/** "sesi açın" uyarısı gerekli mi: 'oyun' = oyunun ses ayarı kapalı (düğme açar), 'cihaz' = telefonun sesi kısık, null = gerek yok */
export function soundWarning(soundsOn: boolean, mediaVolume: number | null | undefined): 'oyun' | 'cihaz' | null {
  if (!soundsOn) return 'oyun';
  if (typeof mediaVolume === 'number' && Number.isFinite(mediaVolume) && mediaVolume < MUTED_VOLUME) return 'cihaz';
  return null;
}

/** tarayıcıda yerel bayrak yok: sayfa yenilenince sıfırlanır (orada yenileme zaten soğuk açılış) */
const seen = new Set<string>();
/** bu açılışta ilk kez mi (anahtar başına); telefon kabuğunda yerel tarafta tutulur */
export async function onceThisLaunch(key: string): Promise<boolean> {
  const p = platform().onceThisLaunch;
  if (p) { try { return await p(key); } catch { return false; } }
  if (seen.has(key)) return false;
  seen.add(key); return true;
}

/** oyuncunun genel ses ayarını çevir; açarken ses bağlamını da aç (dokunuşun içinde çağrılır) */
export function toggleSounds(): boolean {
  const st = useStore.getState(); const on = !st.sounds; st.setSounds(on);
  if (on) { try { audio.unlock(); } catch { /* yok */ } }
  return on;
}
