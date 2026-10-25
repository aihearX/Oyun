export const GAME_W = 390;
export const GAME_H = 780;
/** Zemin çizgisi (dünya y). Parçalar bu referansa göre tasarlanır. */
export const GROUND_Y = 640;
export const TILE = 32;
export const HERO_SIZE = 48;
/** Yıldız eşikleri (docs/11 §5): bitir=1★, notaların %60'ı=2★, %90'ı ya da bölüm hedefi=3★ */
export const STAR2_NOTE_RATIO = 0.6;
export const STAR3_NOTE_RATIO = 0.9;
/**
 * Yüzme bölümlerinde 2★ nota eşiği (docs/12 §6, MK-008): su altındaki notalar zor toplanır, bitirenlerin nota medyanı %46-56;
 * %60 eşiğiyle bitirenlerin yalnız %2-27'si 2★ alıyordu. 3★ eşikleri değişmez (`economy.ts → noteThresholds`).
 */
export const SWIM_STAR2_NOTE_RATIO = 0.45;
/** geriye uyum: 3. yıldızın nota eşiği */
export const STAR_COIN_RATIO = STAR3_NOTE_RATIO;
