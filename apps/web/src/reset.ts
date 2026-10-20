import { platform, freezeStorage } from './platform';
import { getNet } from './net';
import { resetVoiceManifest, stopVoice } from './ftue/voice';

/**
 * Sıfırla: cihazdaki HER ŞEY silinir ve arayüz baştan kurulur (açılış ekranı → hikâye).
 *  - kalıcı depolar: ana kayıt (ilerleme, jeton, ayarlar, rehber), harita, ağ kimliği (oyuncu jetonu) ve kuyruklar —
 *    mobilde AsyncStorage.clear(), web'de localStorage
 *  - WebView/tarayıcı önbellekleri: localStorage, sessionStorage, IndexedDB, Cache Storage
 *  - bellekteki önbellekler: sayfa / WebView yeniden kurulduğu için kendiliğinden gider
 * Sunucudaki veriye dokunulmaz; oyuncu kimliği silindiği için sunucu bir sonraki bağlantıda yeni bir oyuncu görür.
 */
export async function resetEverything(): Promise<void> {
  // 1) yazmaları ve sesi durdur, bağlantıyı kapat (silinenler arkadan geri yazılmasın)
  try { stopVoice(); } catch { /* yok */ }
  freezeStorage();
  try { getNet()?.close(); } catch { /* yok */ }
  resetVoiceManifest();
  const p = platform();
  // 2) sil (bir kez hemen, bir kez de bekleyen yazmalar bittikten sonra)
  const wipe = async () => {
    try { await p.clearAll?.(); } catch { /* yok */ }
    try { localStorage.clear(); } catch { /* yok */ }
    try { sessionStorage.clear(); } catch { /* yok */ }
    try {
      const idb = indexedDB as IDBFactory & { databases?: () => Promise<{ name?: string }[]> };
      const dbs = (await idb.databases?.()) ?? [];
      await Promise.all(dbs.map((d) => (d.name ? new Promise<void>((r) => { const q = idb.deleteDatabase(d.name!); q.onsuccess = q.onerror = q.onblocked = () => r(); }) : Promise.resolve())));
    } catch { /* yok */ }
    try { if (typeof caches !== 'undefined') for (const k of await caches.keys()) await caches.delete(k); } catch { /* yok */ }
  };
  await wipe();
  await new Promise((r) => setTimeout(r, 250));
  await wipe();
  // 3) baştan kur: mobilde WebView yeniden oluşturulur, web'de sayfa yenilenir
  if (p.restartApp) p.restartApp();
  else location.reload();
}
