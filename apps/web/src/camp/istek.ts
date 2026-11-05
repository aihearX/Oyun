import { create } from 'zustand';
import type { BuildingId } from '@odi/shared';

/**
 * Kampa dışarıdan gelen istekler: Tüy Dede'nin "önce kur" tanıtımı bina penceresini açar (arsaya dokunuş tuvalde kaydırma sayılmaz,
 * balondaki "Odaya dokun" da aynı pencereyi açar; OT-ogrenci-birinci-48), günlük süs görevinin "Git"i üs görünümüne geçip süsleme
 * kipini açar (liste görünümünde Süsle yok; OT-buyuk-yazi-68), kamp içindeki günlük görevin "Git"i binayı gösterir (`kampGoster`).
 * İsteği üs görünümü (CampBase; binayı göstermeyi liste görünümünde CampList) karşılar ve siler; görünüm geçişini kamp ekranı
 * (CampScreen) yapar.
 */
export const useKampIstek = create<{ bina: BuildingId | null; susle: boolean; goster: BuildingId | null; git: number }>()(() => ({ bina: null, susle: false, goster: null, git: -Infinity }));
/** bina penceresini aç (üs görünümü açıkken) */
export const kampBinaAc = (id: BuildingId) => useKampIstek.setState({ bina: id });
/** üs görünümüne geç ve süsleme kipini aç (kamp büyümesi açık değilse yalnız üs görünümü) */
export const kampSusle = () => useKampIstek.setState({ susle: true, git: performance.now() });

/**
 * Görevler › Git (ör. "Kulak Deposu'ndan jeton topla"; OT-ilk-kez-oyun-74): bina ekrana getirilip parlatılır (üs görünümünde kamera
 * binaya kayar, liste görünümünde kartına kaydırılır). Oyuncu oraya giderken araya bir şey girmez: Tüy Dede tanıtımları (Director quiet)
 * ve yeni anıt kutlaması (CampBase) oyuncu ekrana dokunana ya da GIT_BEKLE_MS geçene dek bekler.
 */
export const GIT_BEKLE_MS = 8000;
export const kampGoster = (id: BuildingId) => useKampIstek.setState({ goster: id, git: performance.now() });
export const kampGitSuruyor = (now = performance.now()) => now - useKampIstek.getState().git < GIT_BEKLE_MS;
if (typeof document !== 'undefined') {
  // oyuncunun Git'ten sonraki ilk dokunuşu (hedefe ya da başka bir yere): bekleyenler sırayla gelebilir
  document.addEventListener('pointerdown', () => { if (kampGitSuruyor()) useKampIstek.setState({ git: -Infinity }); }, { capture: true, passive: true });
}
