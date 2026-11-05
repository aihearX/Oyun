import { create } from 'zustand';
import type { BuildingId } from '@odi/shared';

/**
 * Kampa dışarıdan gelen istekler: Tüy Dede'nin "önce kur" tanıtımı bina penceresini açar (arsaya dokunuş tuvalde kaydırma sayılmaz,
 * balondaki "Odaya dokun" da aynı pencereyi açar; OT-ogrenci-birinci-48), günlük süs görevinin "Git"i üs görünümüne geçip süsleme
 * kipini açar (liste görünümünde Süsle yok; OT-buyuk-yazi-68). İsteği üs görünümü (CampBase) karşılar ve siler; görünüm geçişini
 * kamp ekranı (CampScreen) yapar.
 */
export const useKampIstek = create<{ bina: BuildingId | null; susle: boolean }>()(() => ({ bina: null, susle: false }));
/** bina penceresini aç (üs görünümü açıkken) */
export const kampBinaAc = (id: BuildingId) => useKampIstek.setState({ bina: id });
/** üs görünümüne geç ve süsleme kipini aç (kamp büyümesi açık değilse yalnız üs görünümü) */
export const kampSusle = () => useKampIstek.setState({ susle: true });
