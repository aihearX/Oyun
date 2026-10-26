import { describe, expect, it } from 'vitest';
import { GAME_W, GAME_H } from '@odi/shared';
import { levelView, levelZoom, VIEW_MAX_H, VIEW_MAX_W, ZOOM_MAX } from './view';

/** MK-026 / MK-025: bölüm görünümü ekranı kaplar, oyun alanı (390×780) hep içinde kalır; tuval çözünürlüğü sınırlı */
describe('bölüm görünümü (view.ts)', () => {
  const ekranlar: [string, number, number][] = [
    ['iPhone 6,9"', 440, 956], ['iPhone 6,5"', 428, 926], ['iPhone 6,1"', 390, 844], ['iPhone SE', 375, 667], ['Android 16:9', 360, 640],
    ['Android 20:9', 412, 915], ['Android 21:9', 360, 840], ['tam 1:2', 390, 780], ['tablet', 820, 1180], ['masaüstü', 1440, 900],
  ];
  it.each(ekranlar)('%s: oyun alanı görünümün içinde, sınırlar aşılmaz', (_ad, w, h) => {
    const v = levelView(w, h);
    expect(v.w).toBeGreaterThanOrEqual(GAME_W); expect(v.h).toBeGreaterThanOrEqual(GAME_H);
    expect(v.w).toBeLessThanOrEqual(VIEW_MAX_W); expect(v.h).toBeLessThanOrEqual(VIEW_MAX_H);
    // uzun ekranda yalnız yükseklik, geniş ekranda yalnız genişlik uzar
    expect(v.w === GAME_W || v.h === GAME_H).toBe(true);
  });
  it.each(ekranlar.filter(([, w, h]) => h / w >= 1.75 && h / w <= VIEW_MAX_H / GAME_W))('%s: telefon oranında bant kalmaz (görünüm oranı = ekran oranı)', (_ad, w, h) => {
    const v = levelView(w, h);
    expect(Math.abs(v.h / v.w - h / w)).toBeLessThan(0.006);
  });
  it('1:2 ekranda eski 390×780 görünüm; ölçü yoksa da', () => {
    expect(levelView(390, 780)).toEqual({ w: 390, h: 780 });
    expect(levelView(0, 0)).toEqual({ w: 390, h: 780 });
  });
  it('tuval: cihaz piksel oranını izler, tasarım pikseli başına en çok 2 (bellek); bot 1', () => {
    const v = levelView(440, 956);
    expect(levelZoom(440, 956, v, 3)).toBe(ZOOM_MAX);
    expect(ZOOM_MAX).toBe(2);
    expect(levelZoom(390, 780, levelView(390, 780), 1)).toBe(1);
    const a = levelView(360, 640); // 16:9: görünüm 439 geniş → 360 CSS px × 2 = 720 px tuval
    expect(Math.round(a.w * levelZoom(360, 640, a, 2))).toBe(720);
    // çekim (renderScale 3, sınır 4): 6,9" iPhone karesi tam piksel (440 × 3 = 1320)
    expect(Math.round(v.w * levelZoom(440, 956, v, 3, 4))).toBe(1320);
  });
});
