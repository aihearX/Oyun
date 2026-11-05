/**
 * Görsel kalite düzeyi: parçacık yoğunluğu çarpanı (1 = tam, düşük kalitede ~0,45).
 * Motor, gerçek cihazda kare hızı uzun süre düşük kalırsa düşürür (LevelScene → setFxQuality). Oynanışı etkilemez.
 */
let FXQ = 1;
export function setFxQuality(k: number): void { FXQ = Math.max(0.2, Math.min(1, k)); }
export function fxQuality(): number { return FXQ; }

/**
 * Yüksek görünürlük (LevelOptions.highVisibility; sahne kurulurken yazılır, YN-225): arka planın ışık süsleri (gökteki hüzme
 * yelpazesi, ana ışığın parlak çekirdeği, toplamsal ışık huzmeleri) ve oyun alanını kesen ışıklı çizgiler soluk ya da yok.
 * Yalnız görsel; zemin, öğeler ve oynanış aynı.
 */
let HIVIS = false;
export function setHighVisibility(on: boolean): void { HIVIS = on; }
export function highVisibility(): boolean { return HIVIS; }
