/**
 * Dünyadaki uçan yazıların yeri (YN-070, YN-119): "Kontrol noktası", "+50 ezme!", "Seri x5", "Altın Koklea!" gibi yazılar
 *  - ekranın içinde kalır: kamera kayarken de (kahraman koşarken yazı soldan taşmasın) her karede kenara yaslanır;
 *  - aynı anda çıkan iki yazı üst üste binmez: yenisi, ekrandaki yazılarla kesişmeyene dek yukarı kayar;
 *  - sonradan da binmez: kenara yaslanan yazı kamerayla kayıp başka yazının üstüne gelirse ya da iki yazının yükselişi
 *    birbirine yetişirse, her karede yeni olan eskisinin üstüne çıkar (`settle`; eski yazı yerinde kalır);
 *  - engelin işaretini örtmez (YN-179): `keepClear` ile kayıtlı işaretler ("KAY ↓") sabit dolu kutu sayılır, yazı onların üstüne çıkar.
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

/**
 * Sonradan binme çözümü: kutular oluşturulma sırasında (eski önce), `lift` her kutunun şimdiki yukarı kaydırması. Eski kutular
 * yerinde kalır; yenisi gösterilen eski kutulardan biriyle kesişiyorsa onun üstüne çıkar. Kaydırma yalnız artar (yazı aşağı
 * zıplamaz, iki yer arasında titremez). Dönüş: yeni kaydırmalar (aynı sıra).
 */
export function settle(items: readonly { box: Box; lift: number }[], gap = 4, fixed: readonly Box[] = []): number[] {
  const shown: Box[] = [...fixed];
  return items.map(({ box, lift }) => {
    const y = freeY({ ...box, y: box.y - lift }, shown, gap);
    shown.push({ ...box, y });
    return box.y - y;
  });
}

type Floating = Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;
/** canlı uçan yazı: tam boyu (büyüyerek açılan yazının o anki boyu değil), istenen x ve şimdiki yukarı kaydırması */
interface Live { w: number; h: number; x: number; lift: number }
/** sahne başına canlı yazılar (oluşturulma sırasıyla) */
const lanes = new WeakMap<Phaser.Scene, Map<Floating, Live>>();
type Marker = Phaser.GameObjects.GameObject & { getBounds(): Phaser.Geom.Rectangle; visible: boolean };
/** sahne başına uçan yazıların örtmeyeceği işaretler (dünyada; görünüm yok edilince kendiliğinden düşer) */
const clears = new WeakMap<Phaser.Scene, Set<Marker>>();

/** engel işaretini (ör. kayma kapısının "KAY ↓" yazısı) uçan yazılardan koru: yazılar ona değerse üstüne çıkar */
export function keepClear(s: Phaser.Scene, o: Marker) {
  let set = clears.get(s); if (!set) { set = new Set(); clears.set(s, set); s.events.once('shutdown', () => clears.delete(s)); }
  set.add(o); o.once('destroy', () => set.delete(o));
}
/** canlı (görünür) işaretlerin dünya kutuları */
function markerBoxes(s: Phaser.Scene): Box[] {
  const set = clears.get(s); if (!set?.size) return [];
  const out: Box[] = [];
  for (const o of set) if (o.active && o.visible) { const r = o.getBounds(); out.push({ x: r.centerX, y: r.centerY, w: r.width, h: r.height }); }
  return out;
}

/**
 * Sahnenin şeridi. Kaydırma tween'lerin y'sine eklenir ama tween'ler onu görmez: kare başında (tween'ler yürümeden) çıkarılır,
 * sahnenin update'inden SONRA (kamera o karede kaydıktan sonra, çizimden önce) yeniden hesaplanıp eklenir. 'update' olayı kamerayı
 * bir kare geriden izler, yavaş karede (büyük adım) yazı kenardan taşıyordu.
 */
function lane(s: Phaser.Scene): Map<Floating, Live> {
  const had = lanes.get(s); if (had) return had;
  const live = new Map<Floating, Live>(); lanes.set(s, live);
  const cam = () => s.cameras.main;
  const pre = () => { for (const [o, l] of live) if (o.active) o.y += l.lift; };
  const post = () => {
    const c = cam(); const left = viewTopLeft(c).x; const vw = c.width / c.zoom;
    const list = [...live].filter(([o]) => o.active);
    for (const [o, l] of list) o.x = clampX(l.x, l.w / 2, left, vw);
    const lifts = settle(list.map(([o, l]) => ({ box: { x: o.x, y: o.y, w: l.w, h: l.h }, lift: l.lift })), 4, markerBoxes(s));
    list.forEach(([o, l], i) => { l.lift = lifts[i]!; o.y -= l.lift; });
  };
  s.events.on('preupdate', pre); s.events.on('postupdate', post);
  s.events.once('shutdown', () => { s.events.off('preupdate', pre); s.events.off('postupdate', post); live.clear(); lanes.delete(s); });
  return live;
}

/**
 * Uçan yazıyı yerleştirir: x ekranda kalır (her karede), y başka canlı yazıyla çakışmayacak yere kayar; sonradan çakışırsa
 * yukarı çıkar (`settle`). Dönen y, yazının tween'lerinin taban noktasıdır (çağıran yükselişi bu y'den hesaplar).
 * w/h: yazının tam boyu (büyüyerek açılıyorsa son boyu).
 */
export function placeFloat(s: Phaser.Scene, o: Floating, x: number, y: number, w: number, h: number): number {
  const cam = s.cameras.main; const live = lane(s);
  const x0 = clampX(x, w / 2, viewTopLeft(cam).x, cam.width / cam.zoom);
  // sahnenin update'i içindeyiz: canlı yazıların y'si kaydırmasız, gösterilen yer y - lift
  const taken: Box[] = [...markerBoxes(s), ...[...live].filter(([t]) => t.active).map(([t, b]) => ({ x: t.x, y: t.y - b.lift, w: b.w, h: b.h }))];
  const y0 = freeY({ x: x0, y, w, h }, taken);
  o.setPosition(x0, y0);
  live.set(o, { w, h, x, lift: 0 });
  o.once('destroy', () => live.delete(o));
  return y0;
}
