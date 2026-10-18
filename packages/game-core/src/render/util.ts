/**
 * Oyun içi çizimin ortak araçları: renk, deterministik rastgele, Canvas 2D ile bir kez boyanan dokular (anahtarlı önbellek),
 * yumuşak ışık/gölge, periyodik (kenarları birleşen) sırt eğrileri. Varlık dosyası yok.
 */
import type Phaser from 'phaser';

export type Ctx = CanvasRenderingContext2D;
export type Rnd = () => number;

// ---------------------------------------------------------------- çözünürlük
/** dokuların netlik ölçeği (tasarım px başına doku px). Motor yüksek DPI kamerası kullanıyorsa 2–3. */
let RES = 2;
export function setRenderResolution(r: number): void { RES = Math.max(1, Math.min(3, r)); }
export function renderResolution(): number { return RES; }

export const FONT = '"SF Pro Rounded","Nunito","Segoe UI Rounded","Helvetica Neue",Inter,Arial,sans-serif';

/** tema renkleri (Kulak Gecesi) */
export const THEME = {
  bg0: 0x140c35, bg1: 0x1f1452, bg2: 0x2d1d6e, panel: 0x2a1b63, panel2: 0x352380,
  gold: 0xffc93c, gold2: 0xff9f1c, coral: 0xff5c8a, teal: 0x2ee6d6, lime: 0x8ef0b0, violet: 0x8b6bff, cream: 0xfff6e5, text2: 0xc9c1ff,
  hazard: 0xff3d6e, hazard2: 0xff6a3d, ink: 0x120a2e,
} as const;

// ---------------------------------------------------------------- renk
export const css = (c: number, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
export const hex = (c: number) => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;
export function mix(a: number, b: number, t: number): number {
  const m = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}
export const lighten = (c: number, t: number) => mix(c, 0xffffff, t);
export const darken = (c: number, t: number) => mix(c, 0x000000, t);
/** tonotopi: taban (ince ses) mor → apeks (kalın ses) turuncu; arada gökkuşağı (harita ile aynı duraklar) */
export function tono(t: number): number {
  const stops = [0x8b6bff, 0x4c8dff, 0x2ee6d6, 0x8ef06a, 0xffd23c, 0xff8a2c];
  const x = Math.max(0, Math.min(0.9999, t)) * (stops.length - 1); const i = Math.floor(x);
  return mix(stops[i]!, stops[i + 1]!, x - i);
}

// ---------------------------------------------------------------- rastgele
export function rng(seed: number): Rnd { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hashStr(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// ---------------------------------------------------------------- tuval
export function makeCanvas(w: number, h: number): { c: HTMLCanvasElement; ctx: Ctx } {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return { c, ctx: c.getContext('2d')! };
}
/** tuval dokusu üret (varsa yeniden üretmez); çizim tasarım biriminde (w×h), R ölçekli tuvale. Dönüş: anahtar. */
export function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, R: number, draw: (ctx: Ctx, w: number, h: number) => void): string {
  if (scene.textures.exists(key)) return key;
  const { c, ctx } = makeCanvas(w * R, h * R); ctx.scale(R, R); draw(ctx, w, h);
  scene.textures.addCanvas(key, c);
  return key;
}
/** dokunun tasarım ölçeği (R) — görüntü nesnesi 1/R ile ölçeklenir */
export function texScale(scene: Phaser.Scene, key: string, designW: number): number {
  const f = scene.textures.getFrame(key); return f ? designW / f.width : 1;
}
/** tasarım biriminde çizilmiş dokudan görüntü */
export function img(scene: Phaser.Scene, x: number, y: number, key: string, R: number): Phaser.GameObjects.Image {
  return scene.add.image(x, y, key).setScale(1 / R);
}

// ---------------------------------------------------------------- çizim yardımcıları
export function circle(ctx: Ctx, x: number, y: number, r: number) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
export function glow(ctx: Ctx, x: number, y: number, r: number, c: number, a = 1, inner = 0) {
  if (r <= 0) return;
  const g = ctx.createRadialGradient(x, y, r * inner, x, y, r); g.addColorStop(0, css(c, a)); g.addColorStop(0.45, css(c, a * 0.45)); g.addColorStop(1, css(c, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
/** eliptik yumuşak ışık */
export function glowEllipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, c: number, a = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); glow(ctx, 0, 0, rx, c, a); ctx.restore();
}
/** yumuşak (bulanık) dolgu: şekli tuval dışına çizip yalnız gölgesini içeri düşürür (Safari'de de çalışır) */
export function softFill(ctx: Ctx, path: () => void, color: string, blur: number) {
  ctx.save();
  const off = 10000; const k = Math.hypot(ctx.getTransform().a, ctx.getTransform().b) || 1;
  // gölge uzaklığı ve bulanıklığı dönüşümden etkilenmez: aygıt pikseline çevir
  ctx.shadowColor = color; ctx.shadowBlur = blur * k; ctx.shadowOffsetX = off * k; ctx.shadowOffsetY = 0;
  ctx.translate(-off, 0); path(); ctx.fillStyle = '#000'; ctx.fill();
  ctx.restore();
}
export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
}
export function vgrad(ctx: Ctx, y0: number, y1: number, stops: [number, number, number?][]): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1); for (const [t, c, a] of stops) g.addColorStop(t, css(c, a ?? 1)); return g;
}
/** periyodik sırt: W genişliğinde kenarları birleşen eğri (tamsayı frekanslar) */
export function ridgeFn(W: number, rnd: Rnd, amp: number, octaves = 4, baseK = 1): (x: number) => number {
  const parts: { k: number; a: number; p: number }[] = [];
  for (let i = 0; i < octaves; i++) { const k = baseK * (i + 1) + Math.floor(rnd() * (i + 1) * 2); parts.push({ k, a: amp / (i * 0.9 + 1) * (0.6 + rnd() * 0.5), p: rnd() * Math.PI * 2 }); }
  return (x) => { let y = 0; for (const q of parts) y += Math.sin((x / W) * Math.PI * 2 * q.k + q.p) * q.a; return y; };
}
/** W genişliğinde sarmalanan çizim: kenara yakın öğe karşı kenarda da çizilir */
export function wrapX(W: number, x: number, r: number, fn: (x: number) => void) {
  fn(x); if (x - r < 0) fn(x + W); if (x + r > W) fn(x - W);
}
/** ince, kıvrık kıl/tel */
export function hairStroke(ctx: Ctx, x: number, y: number, len: number, ang: number, curl: number, w: number, color: string) {
  const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len; const mx = x + Math.cos(ang + curl) * len * 0.55, my = y + Math.sin(ang + curl) * len * 0.55;
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
}
/** incelen kıl: tabanda kalın, uçta ince (üç parça) */
export function taperHair(ctx: Ctx, x: number, y: number, len: number, ang: number, curl: number, w: number, color: number, a = 1, tipGlow?: number) {
  const pts: [number, number][] = []; const n = 8;
  for (let i = 0; i <= n; i++) { const t = i / n; const aa = ang + curl * t * t; pts.push([x + Math.cos(aa) * len * t, y + Math.sin(aa) * len * t]); }
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) { const t = i / n; ctx.strokeStyle = css(color, a * (1 - t * 0.35)); ctx.lineWidth = Math.max(0.5, w * (1 - t * 0.85)); ctx.beginPath(); ctx.moveTo(pts[i]![0], pts[i]![1]); ctx.lineTo(pts[i + 1]![0], pts[i + 1]![1]); ctx.stroke(); }
  if (tipGlow != null) { const p = pts[n]!; glow(ctx, p[0], p[1], w * 3.2, tipGlow, 0.9 * a); ctx.fillStyle = css(lighten(tipGlow, 0.6), a); circle(ctx, p[0], p[1], Math.max(0.8, w * 0.55)); ctx.fill(); }
}
/** dört kollu parıltı yıldızı */
export function sparkle(ctx: Ctx, x: number, y: number, r: number, c: number, a = 1) {
  glow(ctx, x, y, r * 1.6, c, 0.45 * a);
  ctx.fillStyle = css(lighten(c, 0.6), a); ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x + r * 0.12, y - r * 0.12, x + r, y); ctx.quadraticCurveTo(x + r * 0.12, y + r * 0.12, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.12, y + r * 0.12, x - r, y); ctx.quadraticCurveTo(x - r * 0.12, y - r * 0.12, x, y - r); ctx.fill();
}
/** ince boya dokusu: rastgele düşük saydamlı benekler (suluboya/kağıt hissi) */
export function grain(ctx: Ctx, w: number, h: number, rnd: Rnd, n: number, light = 0xffffff, dark = 0x000000, a = 0.05) {
  for (let i = 0; i < n; i++) { ctx.fillStyle = css(rnd() < 0.5 ? light : dark, a * (0.4 + rnd())); const s = 0.6 + rnd() * 1.6; ctx.fillRect(rnd() * w, rnd() * h, s, s); }
}
/** sekizlik nota simgesi (yol) */
export function notePath(ctx: Ctx, x: number, y: number, s: number) {
  // baş (eğik elips) + sap + bayrak
  ctx.beginPath(); ctx.ellipse(x - s * 0.18, y + s * 0.28, s * 0.27, s * 0.2, -0.42, 0, Math.PI * 2);
  ctx.moveTo(x + s * 0.04, y + s * 0.26); ctx.lineTo(x + s * 0.04, y - s * 0.5); ctx.lineTo(x + s * 0.14, y - s * 0.5);
  ctx.bezierCurveTo(x + s * 0.2, y - s * 0.28, x + s * 0.5, y - s * 0.24, x + s * 0.4, y + s * 0.02);
  ctx.bezierCurveTo(x + s * 0.42, y - s * 0.18, x + s * 0.24, y - s * 0.26, x + s * 0.14, y - s * 0.3); ctx.lineTo(x + s * 0.14, y + s * 0.26); ctx.closePath();
}
/** koklea spirali yolu */
export function spiralPath(ctx: Ctx, cx: number, cy: number, r: number, turns: number, squash = 1, steps = 160) {
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) { const t = i / steps; const a = t * turns * Math.PI * 2; const rr = r * (1 - t * 0.88); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * squash; if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
}
/** kalp yolu (merkez x,y; boy s) */
export function heartPath(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.42);
  ctx.bezierCurveTo(x - s * 0.62, y + s * 0.02, x - s * 0.52, y - s * 0.48, x, y - s * 0.2);
  ctx.bezierCurveTo(x + s * 0.52, y - s * 0.48, x + s * 0.62, y + s * 0.02, x, y + s * 0.42); ctx.closePath();
}
/** Kamera yakınlaştırmalı/merkez kökenli olsa da ekran-sabit (scrollFactor 0) nesnelerin tasarım (0,0) noktasının dünya konumu. */
export function screenOrigin(cam: Phaser.Cameras.Scene2D.Camera): { x: number; y: number } {
  return { x: cam.originX * cam.width * (1 - 1 / cam.zoom), y: cam.originY * cam.height * (1 - 1 / cam.zoom) };
}
/** görünen dünyanın sol-üstü (scrollX/scrollY'den; worldView bir sonraki çizime kadar güncellenmez) */
export function viewTopLeft(cam: Phaser.Cameras.Scene2D.Camera, scrollX = cam.scrollX, scrollY = cam.scrollY): { x: number; y: number } {
  const o = screenOrigin(cam); return { x: scrollX + o.x, y: scrollY + o.y };
}
/** WebGL mi? (NineSlice ve karışım kipleri için) */
export const isWebGL = (scene: Phaser.Scene) => scene.sys.game.config.renderType !== 1 /* CANVAS */ && !!(scene.sys.renderer as { gl?: unknown }).gl;
