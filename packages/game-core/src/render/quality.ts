/**
 * Görsel kalite düzeyi: parçacık yoğunluğu çarpanı (1 = tam, düşük kalitede ~0,45).
 * Motor, gerçek cihazda kare hızı uzun süre düşük kalırsa düşürür (LevelScene → setFxQuality). Oynanışı etkilemez.
 */
let FXQ = 1;
export function setFxQuality(k: number): void { FXQ = Math.max(0.2, Math.min(1, k)); }
export function fxQuality(): number { return FXQ; }
