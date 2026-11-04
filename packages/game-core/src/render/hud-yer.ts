/**
 * Gösterge öğelerinin üst üste binmemesi için yer hesabı (YN-183): seri rozeti melodi hapına değerse onun altına iner, övgü
 * sözü ("Güzel!") yükselişi boyunca hiçbir göstergeye değmez. Kutular merkezli (x, y orta nokta); Phaser'dan bağımsız (birim testi:
 * hud-yer.test.ts).
 */
import type { Box } from './float-lane';

/** iki kutu (aralarında en az `gap` boşluk bırakmadan) kesişiyor mu */
export const touches = (a: Box, b: Box, gap = 0) => Math.abs(a.x - b.x) * 2 < a.w + b.w + gap * 2 && Math.abs(a.y - b.y) * 2 < a.h + b.h + gap * 2;

/** merkez y: kutu engellerden birine değiyorsa onun altına iner (yalnız aşağı; zincirleme, en çok engel sayısı kadar) */
export function dropBelow(box: Box, obstacles: readonly Box[], gap = 6): number {
  let y = box.y;
  for (let i = 0; i <= obstacles.length; i++) {
    const o = obstacles.find((b) => touches({ ...box, y }, b, gap));
    if (!o) return y;
    y = o.y + o.h / 2 + gap + box.h / 2;
  }
  return y;
}

/**
 * Övgü sözünün taban y'si: söz y0'da açılır (Back.Out ile ~%10 taşarak büyür), sonra `rise` px yükselip söner. Yolun tamamı
 * (açılış taşması dahil) engellere değmeyecek kadar aşağı iner.
 */
export function praiseY(x: number, y0: number, w: number, h: number, rise: number, obstacles: readonly Box[], gap = 6): number {
  const ow = w * 1.1, oh = h * 1.1;
  const path: Box = { x, y: y0 - rise / 2, w: ow, h: oh + rise };
  return dropBelow(path, obstacles, gap) + rise / 2;
}
