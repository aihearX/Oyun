/**
 * Haritada en son GÖSTERİLEN durum (kalıcı, küçük): her düğüm için gösterilen yıldız sayısı ve
 * "canlandı" kutlaması yapılmış bölgeler. Haritaya dönüşte gerçek ilerlemeyle farkı oynatılır.
 * Ödül vermez; yalnız sunum durumudur (hazineler @odi/meta processRun'da bir kez verilir).
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { platformStorage } from '../platform';

interface MapSeen {
  /** en az bir kez kaydedildi mi (ilk açılışta mevcut durum sahnesiz kaydedilir) */
  init: boolean;
  stars: Record<number, number>;
  /** "canlandı" kutlaması gösterilmiş bölgeler */
  restored: string[];
  commit(stars: Record<number, number>): void;
  markRestored(zone: string): void;
}

export const useMapSeen = create<MapSeen>()(persist((set, get) => ({
  init: false, stars: {}, restored: [],
  commit(stars) { set({ init: true, stars: { ...stars } }); },
  markRestored(zone) { if (!get().restored.includes(zone)) set({ restored: [...get().restored, zone] }); },
}), {
  name: 'odi-map-seen', version: 1, storage: createJSONStorage(() => platformStorage), skipHydration: true,
  partialize: (s) => ({ init: s.init, stars: s.stars, restored: s.restored }),
}));

let hydrated: Promise<void> | null = null;
/** kayıt bir kez yüklenir (mobil köprü sonradan kurulsa da doğru depoya gider) */
export function loadMapSeen(): Promise<void> {
  if (!hydrated) hydrated = Promise.resolve(useMapSeen.persist.rehydrate()).then(() => undefined, () => undefined);
  return hydrated;
}

/** ilerlemeden yıldız haritası */
export const starsOf = (progress: Record<number, { stars: number }>): Record<number, number> =>
  Object.fromEntries(Object.entries(progress).filter(([, p]) => p.stars > 0).map(([k, p]) => [Number(k), p.stars]));
