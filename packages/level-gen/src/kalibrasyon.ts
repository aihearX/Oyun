/**
 * Bölüm kalibrasyonu — ÜRETİLMİŞ dosya: `node tools/harness/zorluk.mjs --kalibre`. Bölüm → üretici varyantı (0 = varsayılan).
 * Her bölüm için hedef eğriye tahminen en yakın birkaç varyant insan modeliyle ölçülür, ölçülen can kaybı hedefe en yakın olan seçilir.
 * 4-8 (ilk kez oynayan kademe ve kitle), 11, 12, 18, 19, 23-26, 30, 32, 33, 36 ve 39 sonradan 48 oyunculuk varyant taramasıyla
 * elle seçildi (docs/12 §8); `--kalibre` yalnız `--levels` ile verilen bölümleri yazar.
 */
export const KALIBRASYON: Record<number, number> = {
  1: 1,
  3: 1,
  4: 4,
  5: 5,
  6: 7,
  7: 3,
  8: 23,
  10: 1,
  12: 6,
  13: 7,
  14: 1,
  15: 3,
  16: 4,
  17: 8,
  18: 3,
  19: 2,
  21: 9,
  22: 7,
  23: 14,
  24: 2,
  25: 7,
  26: 7,
  27: 8,
  28: 9,
  29: 8,
  30: 3,
  32: 2,
  33: 22,
  34: 6,
  36: 2,
  37: 9,
  39: 2,
};
