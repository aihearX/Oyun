import { platform, freezeStorage } from './platform';
import { getNet } from './net';
import { resetVoiceManifest, stopVoice } from './ftue/voice';

/**
 * Sıfırla: cihazdaki HER ŞEY silinir ve arayüz baştan kurulur (açılış ekranı → hikâye).
 *  - kalıcı depolar: ana kayıt (ilerleme, jeton, ayarlar, rehber), harita, ağ kimliği (oyuncu jetonu) ve kuyruklar —
 *    mobilde AsyncStorage.clear(), web'de localStorage
 *  - WebView/tarayıcı önbellekleri: localStorage, sessionStorage, IndexedDB, Cache Storage
 *  - bellekteki önbellekler: sayfa / WebView yeniden kurulduğu için kendiliğinden gider
 *  - sunucudaki hesap: bağlantı varsa önce `account.delete` (ad anonim, takım üyeliği, arkadaşlar, özel mesajlar, sohbet
 *    mesajları silinir; KVKK/GDPR silme hakkı). Bağlantı yoksa en çok birkaç saniye beklenir; olmazsa yalnızca cihaz silinir.
 * Oyuncu kimliği silindiği için sunucu bir sonraki bağlantıda yeni bir oyuncu görür.
 */
export async function resetEverything(): Promise<void> {
  try { stopVoice(); } catch { /* yok */ }
  // 0) sunucudaki hesabı sil (bağlanıyorsa çağrı bağlantıyı bekler; en çok 6 sn)
  try {
    const net = getNet();
    if (net && net.status !== 'kapalı') await Promise.race([net.call('account.delete', {}), new Promise((r) => setTimeout(r, 6000))]);
  } catch { /* çevrimdışı: yalnızca cihaz silinir */ }
  // 1) yazmaları durdur, bağlantıyı kapat (silinenler arkadan geri yazılmasın)
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
