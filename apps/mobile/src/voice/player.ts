import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { VOICE_FILES } from './files';

/**
 * Tüy Dede'nin kayıtlı sesleri: dosyalar uygulama paketinde (Metro varlığı). Yerel oynatıcı KULLANILMAZ:
 * kabuk yalnızca dosyanın baytlarını base64 olarak köprüden verir; WebView içindeki ses motoru (WebAudio) çözer ve çalar —
 * müzik ve efektlerin cihazda zaten çalıştığı yol. Web arayüzü sıradaki satırları önceden ister.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MANIFEST = require('../../../web/public/voice/manifest.json') as { lines?: Record<string, unknown> };

export async function voiceManifest(): Promise<string | null> {
  try { return JSON.stringify(MANIFEST); } catch { return null; }
}

const cache = new Map<string, Promise<string | null>>();

/** dosyanın baytları (base64); paket dışı ya da okunamazsa null */
export function voiceData(file: string): Promise<string | null> {
  const hit = cache.get(file); if (hit) return hit;
  const p = readAsset(file).catch(() => null);
  cache.set(file, p);
  void p.then((v) => { if (!v) cache.delete(file); });
  // önbellek küçük kalsın (base64 metinleri ~30-80 KB)
  while (cache.size > 24) cache.delete(cache.keys().next().value!);
  return p;
}

async function readAsset(file: string): Promise<string | null> {
  const mod = VOICE_FILES[file];
  if (mod == null) return null;
  const asset = Asset.fromModule(mod);
  if (!asset.localUri) await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) return null;
  try { return await new File(uri).base64(); } catch { /* yerel dosya okunamadı: indirerek dene */ }
  const r = await fetch(uri);
  if (!r.ok) return null;
  return bytesToBase64(new Uint8Array(await r.arrayBuffer()));
}

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** btoa'ya güvenmeden base64 (Hermes sürümlerinden bağımsız) */
export function bytesToBase64(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i]! << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += ABC[(n >> 18) & 63]! + ABC[(n >> 12) & 63]! + (i + 1 < b.length ? ABC[(n >> 6) & 63]! : '=') + (i + 2 < b.length ? ABC[n & 63]! : '=');
  }
  return out;
}
