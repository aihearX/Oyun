/**
 * Phaser sahneleri ve bölüm üreticisi isteğe bağlı yüklenir: ilk açılış (başlık + hikâye) Phaser'ı ve level-gen'i
 * (bölüm odaları verisiyle) hiç ayrıştırmaz.
 * Her sahne (bölüm, harita, kamp) ayrı bir parça; Phaser bunların ortak parçasıdır (Vite). Expo DOM paketinde dışa aktarma
 * tek pakettir (EXPO_NO_BUNDLE_SPLITTING=1): `import()` aynı paketin içinde çözülür, modül yine ilk kullanımda çalışır
 * (bkz. apps/mobile/README.md "Paket bölme").
 * Yükleme bir kez yapılır; hata olursa söz sıfırlanır ve bir sonraki deneme yeniden ister. Yüklenen modül `.value`'da
 * durur: yüklüyse çağıran beklemeden (aynı tikte) kullanabilir.
 */
type Memo<T> = (() => Promise<T>) & { value?: T };
function memo<T>(load: () => Promise<T>): Memo<T> {
  let p: Promise<T> | null = null;
  const f: Memo<T> = () => (p ??= load().then((m) => (f.value = m), (e: unknown) => { p = null; throw e; }));
  return f;
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
/**
 * Bölüm üreticisi (`@odi/level-gen` + oda/boss verisi, ~100 KB): bölüm başlarken, yarış/etkinlik bölümü kurulurken gerekir.
 * Phaser'ın önden yüklendiği anlarda o da önden yüklenir (App.tsx preloadFor); harita parçası onu zaten durağan içe aktarır
 * (MapCards hedef satırı). Üretim tohumludur: ne zaman yüklendiği sonucu değiştirmez.
 */
export type LevelGen = typeof import('@odi/level-gen');
export const loadLevelGen: Memo<LevelGen> = memo(() => import('@odi/level-gen'));
