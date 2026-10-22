/**
 * Bölüm kalibrasyonu — ÜRETİLMİŞ dosya: `node tools/harness/zorluk.mjs --kalibre`. Bölüm → üretici varyantı (0 = varsayılan).
 * Her bölüm için hedef eğriye tahminen en yakın birkaç varyant insan modeliyle ölçülür, ölçülen can kaybı hedefe en yakın olan seçilir.
 * 4-8 (ilk kez oynayan kademe ve kitle; 4 ve 8 imza odalarıyla), 11-13, 18, 19, 22-27, 30, 32-34, 36, 37 ve 39 sonradan 48 oyunculuk varyant taramasıyla
 * elle seçildi (docs/12 §8); `--kalibre` yalnız `--levels` ile verilen bölümleri yazar.
 */
export const KALIBRASYON: Record<number, number> = {
  1: 1,
  3: 1,
  4: 3,
  5: 7,
  6: 7,
  7: 3,
  8: 1,
  10: 3,
  11: 6,
  12: 6,
  13: 1,
  14: 1,
  15: 3,
  16: 4,
  17: 8,
  18: 3,
  19: 6,
  21: 9,
  22: 7,
  23: 4,
  24: 2,
  25: 7,
  26: 5,
  27: 4,
  28: 9,
  29: 8,
  32: 2,
  33: 22,
  34: 6,
  36: 2,
  39: 23,
};
