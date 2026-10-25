/**
 * Phaser sahneleri isteğe bağlı yüklenir: ilk açılış (başlık + hikâye) Phaser'ı hiç ayrıştırmaz.
 * Her sahne (bölüm, harita, kamp) ayrı bir parça; Phaser bunların ortak parçasıdır (Vite). Expo DOM paketinde dışa aktarma
 * tek pakettir (EXPO_NO_BUNDLE_SPLITTING=1): `import()` aynı paketin içinde çözülür, modül yine ilk kullanımda çalışır
 * (bkz. apps/mobile/README.md "Paket bölme").
 * Yükleme bir kez yapılır; hata olursa söz sıfırlanır ve bir sonraki deneme yeniden ister.
 */
function memo<T>(load: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => (p ??= load().catch((e: unknown) => { p = null; throw e; }));
}
/**
 * Gerekli bir parça indirilemedi (web: yeni sürüm yayımlandı, eski parça adları sunucuda yok): çevrimiçiyse sayfa dakikada en
 * çok bir kez yenilenir, yeni sürümün parçalarıyla açılır. Önden yüklemedeki hatalar bunu çağırmaz. DOM paketinde hiç olmaz (tek dosya).
 */
export function chunkFailed(e: unknown): never {
  try {
    const k = 'odi.parcaYenile'; const last = Number(sessionStorage.getItem(k) ?? 0);
    if (navigator.onLine !== false && Date.now() - last > 60_000) { sessionStorage.setItem(k, String(Date.now())); location.reload(); }
  } catch { /* depolama yok */ }
  throw e;
}
export const loadLevel = memo(() => import('@odi/game-core/boot'));
export const loadMap = memo(() => import('@odi/game-core/map/index'));
export const loadCamp = memo(() => import('@odi/game-core/camp/index'));
