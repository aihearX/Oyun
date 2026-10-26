import { GAME_W, GAME_H } from '@odi/shared';

/**
 * Bölüm görünümü (MK-026): oyun alanı 390×780 tasarım pikselidir; ekran 1:2'den uzunsa görünüm aşağı-yukarı, genişse yana uzar
 * (kamera fazladan payı gösterir, arka plan ve zemin görünümle birlikte uzar). Oynanış alanı, çarpışmalar ve zorluk değişmez:
 * simülasyon (play/**) görünüm boyutunu hiç okumaz. Bu sınırların ötesinde (masaüstü, tablet) FIT kenar bandı kalır.
 */
export const VIEW_MAX_H = 940;
/** genişlik sınırı: boss arenasının zemini (−40…430) yanlarda görünür kalsın (ortalanmış 450 → −30…420) */
export const VIEW_MAX_W = 450;
/** tasarım pikseli başına tuval pikseli (ve doku çözünürlüğü) üst sınırı: 2 (bellek — iPhone WebView; harita çökmesi 74baaf0).
 *  Bölüm sahnesinin dokuları 2'de ~190 MB GPU belleği tutar; 3'te ×2,25 olurdu. */
export const ZOOM_MAX = 2;
/** harness/pazarlama çekimi (renderScale) üst sınırı: 6,9" iPhone karesi (440 CSS px × 3) tam piksel */
export const ZOOM_MAX_SHOT = 4;

export interface ViewSize { w: number; h: number }

/** ebeveynin CSS boyutuna göre görünüm (tasarım px). En az 390×780: oyun alanının tamamı her zaman görünür. */
export function levelView(cssW: number, cssH: number): ViewSize {
  if (!(cssW > 0 && cssH > 0)) return { w: GAME_W, h: GAME_H };
  const a = cssH / cssW;
  if (a >= GAME_H / GAME_W) return { w: GAME_W, h: Math.min(VIEW_MAX_H, Math.max(GAME_H, Math.round(GAME_W * a))) };
  return { w: Math.min(VIEW_MAX_W, Math.max(GAME_W, Math.round(GAME_H / a))), h: GAME_H };
}

/**
 * Tasarım pikseli başına tuval pikseli (kamera yakınlaştırması ve doku çözünürlüğü): tuval ekranda CSS pikseli başına `ratio`
 * piksel taşır (ratio = cihaz piksel oranı) ama tasarım pikseli başına en çok `max` (bellek). Böylece tuval cihaz piksel oranında
 * çizilir, CSS ölçeğiyle büyümez; sınıra takılan cihazda bile eskisinden (sabit 2) fazla bellek tutmaz.
 */
export function levelZoom(cssW: number, cssH: number, view: ViewSize, ratio: number, max = ZOOM_MAX): number {
  const fit = cssW > 0 && cssH > 0 ? Math.min(cssW / view.w, cssH / view.h) : 1;
  return Math.max(1, Math.min(max, fit * ratio));
}
