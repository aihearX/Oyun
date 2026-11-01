/**
 * Dünyadaki uçan yazıların yeri (YN-070): "Kontrol noktası", "✚ Kulak kiri tıkacı", "Altın Koklea!" gibi yazılar
 *  - ekranın içinde kalır: kamera kayarken de (kahraman koşarken yazı soldan taşmasın) her karede kenara yaslanır;
 *  - aynı anda çıkan iki yazı üst üste binmez: yenisi, ekrandaki yazılarla kesişmeyene dek yukarı kayar.
 * Hesap Phaser'dan bağımsız (birim testi: float-lane.test.ts); `placeFloat` sahnedeki canlı yazıları izler.
 */
import type Phaser from 'phaser';
import { viewTopLeft } from './util';

export interface Box { x: number; y: number; w: number; h: number }

/** yatay merkez: yazı görünür alanın [left, left + viewW] içinde kalsın (pad: kenar payı); yazı ekrandan genişse ortalanır */
export function clampX(x: number, halfW: number, left: number, viewW: number, pad = 8): number {
  const lo = left + halfW + pad, hi = left + viewW - halfW - pad;
  if (lo > hi) return left + viewW / 2;
  return Math.max(lo, Math.min(hi, x));
}

const hits = (a: Box, b: Box, gap: number) => Math.abs(a.x - b.x) * 2 < a.w + b.w + gap * 2 && Math.abs(a.y - b.y) * 2 < a.h + b.h + gap * 2;

/** merkez y: kutu (merkezli) dolu kutulardan biriyle kesişiyorsa onun üstüne çıkar; en çok `maxSteps` kez */
export function freeY(box: Box, taken: readonly Box[], gap = 4, maxSteps = 4): number {
  let y = box.y;
  for (let i = 0; i < maxSteps; i++) {
    const b = taken.find((o) => hits({ ...box, y }, o, gap));
    if (!b) return y;
    y = b.y - b.h / 2 - gap - box.h / 2;
  }
  return y;
}

type Floating = Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;
/** sahnedeki canlı uçan yazılar ve tam boyları (büyüyerek açılan yazının o anki boyu değil) */
const live = new WeakMap<Phaser.Scene, Map<Floating, { w: number; h: number }>>();

/**
 * Uçan yazıyı yerleştirir: x ekranda kalır (her karede), y başka canlı yazıyla çakışmayacak yere kayar. Dönen y, yazının
 * tween'lerinin taban noktasıdır (çağıran yükselişi bu y'den hesaplar). w/h: yazının tam boyu (büyüyerek açılıyorsa son boyu).
 */
export function placeFloat(s: Phaser.Scene, o: Floating, x: number, y: number, w: number, h: number): number {
  const cam = s.cameras.main; const half = w / 2;
  const vw = () => cam.width / cam.zoom;
  let set = live.get(s); if (!set) { set = new Map(); live.set(s, set); }
  const x0 = clampX(x, half, viewTopLeft(cam).x, vw());
  const taken: Box[] = [...set].filter(([t]) => t.active).map(([t, b]) => ({ x: t.x, y: t.y, ...b }));
  const y0 = freeY({ x: x0, y, w, h }, taken);
  o.setPosition(x0, y0);
  set.set(o, { w, h });
  // sahnenin update'inden SONRA (kamera o karede kaydıktan sonra, çizimden önce): 'update' olayı kamerayı bir kare geriden izler,
  // yavaş karede (büyük adım) yazı kenardan taşıyordu
  const follow = () => { if (o.active) o.x = clampX(x, half, viewTopLeft(cam).x, vw()); };
  s.events.on('postupdate', follow);
  o.once('destroy', () => { s.events.off('postupdate', follow); set.delete(o); });
  return y0;
}
