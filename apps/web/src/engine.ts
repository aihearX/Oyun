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
export const loadLevel = memo(() => import('@odi/game-core/boot'));
export const loadMap = memo(() => import('@odi/game-core/map/index'));
export const loadCamp = memo(() => import('@odi/game-core/camp/index'));
