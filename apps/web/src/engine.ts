/**
 * Phaser sahneleri ve bölüm üreticisi isteğe bağlı yüklenir: ilk açılış (başlık + hikâye) Phaser'ı ve level-gen'i
 * (bölüm odaları verisiyle) hiç ayrıştırmaz.
 * Her sahne (bölüm, harita, kamp) ayrı bir parça; Phaser bunların ortak parçasıdır (Vite). Expo DOM paketinde dışa aktarma
 * tek pakettir (EXPO_NO_BUNDLE_SPLITTING=1): `import()` aynı paketin içinde çözülür, modül yine ilk kullanımda çalışır
 * (bkz. apps/mobile/README.md "Paket bölme").
 * Yükleme bir kez yapılır; hata olursa söz sıfırlanır ve bir sonraki deneme yeniden ister. Yüklenen modül `.value`'da
 * durur: yüklüyse çağıran beklemeden (aynı tikte) kullanabilir.
 */
import { platform } from './platform';

type Memo<T> = (() => Promise<T>) & { value?: T };
function memo<T>(load: () => Promise<T>): Memo<T> {
  let p: Promise<T> | null = null;
  const f: Memo<T> = () => (p ??= chunkImport(load).then((m) => (f.value = m), (e: unknown) => { p = null; throw e; }));
  return f;
}

/** parça bağlantı yok diye hiç istenmedi (chunkImport); bağlanınca yeniden denenir (ui/HataSiniri.tsx 'online' olayında kendiliğinden) */
export class ChunkOffline extends Error {
  constructor() { super('Bağlantı yok: parça istenmedi.'); this.name = 'ChunkOffline'; }
}
/**
 * Bağlantı yokken parça hiç istenmez (YN-047): Chromium başarısız bir modül isteğini sayfa açık kaldıkça hatırlar; o parça (ve onu
 * içe aktaran her parça) bağlantı dönünce de açılmaz, tek çıkış sayfayı yenilemekti (chunkFailed → açılış ekranı). Service worker'ın
 * yönettiği sayfada parçalar önbellekten gelir, telefon kabuğunda (DOM paketi) ağ hiç yoktur: ikisinde de istek yapılır.
 */
export function chunkImport<T>(load: () => Promise<T>): Promise<T> {
  let off = false;
  try { off = navigator.onLine === false && !navigator.serviceWorker?.controller && platform().kind === 'web' && !(window as Window & { ReactNativeWebView?: unknown }).ReactNativeWebView; } catch { /* yok */ }
  return off ? Promise.reject(new ChunkOffline()) : load();
}
/** hata, bağlantı yokken parçanın yüklenememesi mi (istenmedi ya da istek ağda düştü) */
export function chunkOffline(e: unknown): boolean {
  if (e instanceof ChunkOffline) return true;
  try { return navigator.onLine === false && e instanceof Error && /dynamically imported module|module script|preload/i.test(e.message); } catch { return false; }
}
/**
 * Gerekli bir parça indirilemedi (web: yeni sürüm yayımlandı, eski parça adları sunucuda yok): çevrimiçiyse sayfa dakikada en
 * çok bir kez yenilenir, yeni sürümün parçalarıyla açılır. Önden yüklemedeki hatalar bunu çağırmaz. DOM paketinde hiç olmaz (tek dosya).
 * Bağlantı yokken yenilenmez (sayfa açılmazdı): ekran "İnternet yok" der, bağlanınca yeniden dener.
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
