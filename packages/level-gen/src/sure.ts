/**
 * Süreli bölümlerin yıldız süreleri — ÜRETİLMİŞ dosya: `node tools/harness/zorluk.mjs --sure`. Bölüm → [3★, 2★] süre oranı
 * (bölümün `parTimeSec` değerine oranla; yardım kademesi ya da `hiz` bölümü kısaltınca süreler de kısalır).
 * İnsan modeli kitlesinin bitiren oyuncularının süreleri ölçülür; "temiz koşu" = bitirenlerin en hızlı %10'unun süresi: 3★ = temiz
 * koşu × 1,06 (iyi oyun: düşmeden ya da bir takılmayla), 2★ = × 1,2 (birkaç düşüşle) — docs/12 §6. Eski kural (hedef = par × 0,95)
 * her bitirene yetiyordu; asıl kapı nota oranıydı (yüzme bölümlerinde bitirenlerin çoğu %60 notaya ulaşamıyordu).
 */
export const SURE_ORANI: Record<number, [number, number]> = {
  4: [0.67, 0.76],
  11: [0.73, 0.82],
  18: [0.68, 0.77],
  23: [0.7, 0.79],
  30: [0.7, 0.79],
  33: [0.64, 0.73],
  39: [0.7, 0.79],
};
