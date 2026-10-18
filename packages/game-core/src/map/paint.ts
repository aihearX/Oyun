/**
 * Haritanın büyük bölge resimleri: el çizimi bir hazine/dünya haritası estetiği — parşömen, mürekkep çizgiler,
 * suluboya dolgular, tarama gölgeler, eş yükselti çizgileri. Kulak anatomisi araziye uyarlanır:
 * kepçe kıyıları, kanal geçidi, zar gölü, kemik dağları, koklea spiral gölü ve tarlaları, ışık nehirleri, köprüler, korteks tepeleri.
 * Canvas 2D ile prosedürel (varlık dosyası yok); her bölge bir kez çizilir, doku olur. Koordinatlar tasarım birimidir (genişlik 390).
 * Kilitli (soluk, mürekkepsiz) görünüm burada çizilmez: oyunda renk matrisiyle elde edilir, bellek iki katına çıkmaz.
 */
import { BIOMES } from '@odi/content';
import type { MapLayout, MapZone, ZoneId } from './layout';

type Ctx = CanvasRenderingContext2D;
type Rnd = () => number;
export const ZONE_OVERLAP = 64;

export function rng(seed: number): Rnd { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const css = (c: number, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
export function mix(a: number, b: number, t: number): number {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t), g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t), bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | bl;
}
export const lighten = (c: number, t: number) => mix(c, 0xffffff, t);
export const darken = (c: number, t: number) => mix(c, 0x000000, t);
/** tonotopi: taban (ince ses) mor → apeks (kalın ses) turuncu, arada gökkuşağı */
export function tono(t: number): number {
  const stops = [0x7c5cff, 0x4c8dff, 0x2ec9c0, 0x6cc85a, 0xf2c240, 0xf07f32];
  const x = Math.max(0, Math.min(0.9999, t)) * (stops.length - 1); const i = Math.floor(x);
  return mix(stops[i]!, stops[i + 1]!, x - i);
}
export function makeCanvas(w: number, h: number): { c: HTMLCanvasElement; ctx: Ctx } {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return { c, ctx: c.getContext('2d')! };
}

/** mürekkep ve parşömen renkleri */
export const INK = 0x4a3222;
export const PAPER = 0xf3e4c4;
export const MAP_FONT = '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Liberation Serif","DejaVu Serif",serif';

// ------------------------------------------------------------------ harita çizim araçları
type PathFn = () => void;
export function glow(ctx: Ctx, x: number, y: number, r: number, c: number, a = 1, inner = 0) {
  const g = ctx.createRadialGradient(x, y, r * inner, x, y, r); g.addColorStop(0, css(c, a)); g.addColorStop(1, css(c, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
/** organik kapalı şekil (kıyı, göl, ada) */
function blobPath(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rnd: Rnd, wob = 0.18, n = 11, rot = 0) {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rot; const k = 1 + (rnd() - 0.5) * 2 * wob; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  return () => {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const p = pts[i % n]!, q = pts[(i + 1) % n]!; const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(p[0], p[1], mx, my); }
    ctx.closePath();
  };
}
/** suluboya dolgu: hafif kaymış katmanlar + kenarda toplanan pigment */
function wash(ctx: Ctx, p: PathFn, c: number, a = 0.5, edge = 0.5) {
  ctx.save();
  for (const [dx, dy, k] of [[0, 0, 1], [1.5, -1, 0.5], [-1.2, 1.3, 0.4]] as [number, number, number][]) { ctx.translate(dx, dy); p(); ctx.fillStyle = css(c, a * k); ctx.fill(); ctx.translate(-dx, -dy); }
  p(); ctx.clip(); p(); ctx.strokeStyle = css(darken(c, 0.25), a * edge); ctx.lineWidth = 9; ctx.filter = 'blur(3px)'; ctx.stroke(); ctx.filter = 'none';
  ctx.restore();
}
/** mürekkep kontur: iki kez, hafif titrek */
function ink(ctx: Ctx, p: PathFn, w = 2, a = 0.85, c = INK) {
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  p(); ctx.strokeStyle = css(c, a); ctx.lineWidth = w; ctx.stroke();
  ctx.translate(0.8, 0.6); p(); ctx.strokeStyle = css(c, a * 0.35); ctx.lineWidth = w * 0.6; ctx.stroke();
  ctx.restore();
}
/** kıyı şeridi: dışa doğru incelen çizgiler (eski haritalardaki su çizgileri) */
function shoreLines(ctx: Ctx, p: PathFn, c: number, n = 3) {
  ctx.save(); for (let i = 1; i <= n; i++) { p(); ctx.strokeStyle = css(c, 0.35 / i); ctx.lineWidth = 1.4; ctx.setLineDash([]); ctx.translate(0, 0); ctx.lineWidth = 1.2 + i * 5; ctx.globalCompositeOperation = 'source-over'; ctx.stroke(); } ctx.restore();
}
/** tarama: kırpılmış alanda eğik paralel çizgiler */
function hatch(ctx: Ctx, p: PathFn, w: number, h: number, ang: number, gap: number, c = INK, a = 0.25) {
  ctx.save(); p(); ctx.clip(); ctx.strokeStyle = css(c, a); ctx.lineWidth = 1;
  const d = Math.hypot(w, h); ctx.translate(w / 2, h / 2); ctx.rotate(ang);
  for (let x = -d; x < d; x += gap) { ctx.beginPath(); ctx.moveTo(x, -d); ctx.lineTo(x, d); ctx.stroke(); }
  ctx.restore();
}
/** dağ simgesi: üçgen tepe, gölgeli yamaç taraması, kar/ışık */
function mountain(ctx: Ctx, x: number, y: number, s: number, fill: number, rnd: Rnd) {
  const peak = () => { ctx.beginPath(); ctx.moveTo(x - s, y); ctx.quadraticCurveTo(x - s * 0.45, y - s * 0.7, x - s * 0.05, y - s * 1.25); ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.6, x + s, y); ctx.closePath(); };
  wash(ctx, peak, fill, 0.75, 0.3);
  ctx.save(); peak(); ctx.clip(); ctx.strokeStyle = css(INK, 0.35); ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) { const t = i / 9; ctx.beginPath(); ctx.moveTo(x + s * 0.05 + t * s * 0.9, y); ctx.lineTo(x - s * 0.02 + t * s * 0.35, y - s * (1.15 - t * 0.9)); ctx.stroke(); }
  ctx.restore();
  ink(ctx, peak, 1.6);
  void rnd;
}
/** ağaç simgesi (kıl ağacı): gövde + yuvarlak tepe */
function tree(ctx: Ctx, x: number, y: number, s: number, c: number) {
  ctx.strokeStyle = css(INK, 0.8); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - s * 0.9); ctx.stroke();
  const top = () => { ctx.beginPath(); ctx.ellipse(x, y - s * 1.05, s * 0.45, s * 0.6, 0, 0, Math.PI * 2); };
  top(); ctx.fillStyle = css(c, 0.9); ctx.fill(); ink(ctx, top, 1.2, 0.8);
  ctx.fillStyle = css(0xffffff, 0.35); ctx.beginPath(); ctx.ellipse(x - s * 0.15, y - s * 1.25, s * 0.12, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
}
/** kıl (ince, kıvrık tel) */
function hair(ctx: Ctx, x: number, y: number, len: number, ang: number, curl: number, w: number, c: string) {
  const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len; const mx = x + Math.cos(ang + curl) * len * 0.55, my = y + Math.sin(ang + curl) * len * 0.55;
  ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
}
/** dalga simgesi (~) */
function waveGlyph(ctx: Ctx, x: number, y: number, s: number, a = 0.5, c = 0x2f6f9a) {
  ctx.strokeStyle = css(c, a); ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - s, y); ctx.quadraticCurveTo(x - s / 2, y - s * 0.45, x, y); ctx.quadraticCurveTo(x + s / 2, y + s * 0.45, x + s, y); ctx.stroke();
}
function drop(ctx: Ctx, x: number, y: number, r: number, c: number, a = 1) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.2, r * 0.1, x, y, r * 1.3);
  g.addColorStop(0, css(lighten(c, 0.55), a)); g.addColorStop(0.5, css(c, a)); g.addColorStop(1, css(darken(c, 0.35), a));
  const p = () => { ctx.beginPath(); ctx.moveTo(x, y - r * 2); ctx.bezierCurveTo(x + r * 0.4, y - r * 1.2, x + r, y - r * 0.6, x + r, y); ctx.arc(x, y, r, 0, Math.PI); ctx.bezierCurveTo(x - r, y - r * 0.6, x - r * 0.4, y - r * 1.2, x, y - r * 2); };
  p(); ctx.fillStyle = g; ctx.fill(); ink(ctx, p, 1, 0.6);
  ctx.fillStyle = css(0xffffff, 0.6 * a); ctx.beginPath(); ctx.ellipse(x - r * 0.38, y - r * 0.3, r * 0.2, r * 0.32, -0.4, 0, Math.PI * 2); ctx.fill();
}
export function tuft(ctx: Ctx, x: number, y: number, h: number, c: number, n = 5, a = 1) {
  for (let i = 0; i < n; i++) {
    const t = (i - (n - 1) / 2) / Math.max(1, n - 1); const hh = h * (1 - Math.abs(t) * 0.4); const tx = x + t * h * 0.55, ty = y - hh;
    ctx.strokeStyle = css(darken(c, 0.3), a); ctx.lineWidth = Math.max(1.3, h * 0.07); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + t * h * 0.15, y); ctx.quadraticCurveTo(x + t * h * 0.2, y - hh * 0.6, tx, ty); ctx.stroke();
    ctx.fillStyle = css(c, a); ctx.beginPath(); ctx.arc(tx, ty, Math.max(1.6, h * 0.1), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = css(INK, 0.5 * a); ctx.lineWidth = 0.8; ctx.stroke();
  }
}
function gearPath(ctx: Ctx, x: number, y: number, r: number, teeth: number): PathFn {
  return () => { ctx.beginPath(); for (let i = 0; i < teeth * 2; i++) { const ang = (i / (teeth * 2)) * Math.PI * 2; const rr = i % 2 ? r * 0.8 : r; const da = Math.PI / (teeth * 2) * 0.55; ctx.lineTo(x + Math.cos(ang - da) * rr, y + Math.sin(ang - da) * rr); ctx.lineTo(x + Math.cos(ang + da) * rr, y + Math.sin(ang + da) * rr); } ctx.closePath(); ctx.moveTo(x + r * 0.3, y); ctx.arc(x, y, r * 0.3, 0, Math.PI * 2, true); };
}
export function gear(ctx: Ctx, x: number, y: number, r: number, teeth: number, c: number, a = 1) {
  const p = gearPath(ctx, x, y, r, teeth);
  ctx.save(); p(); const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, css(lighten(c, 0.35), a)); g.addColorStop(1, css(darken(c, 0.15), a)); ctx.fillStyle = g; ctx.fill('evenodd'); ctx.restore();
  ink(ctx, p, Math.max(1.2, r * 0.05), 0.8 * a);
}
function spiralPath(ctx: Ctx, cx: number, cy: number, r: number, turns: number): PathFn {
  return () => { ctx.beginPath(); for (let i = 0; i <= 240; i++) { const t = i / 240; const a = t * turns * Math.PI * 2; const rr = r * (1 - t * 0.9); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.86; if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); } };
}
function note(ctx: Ctx, x: number, y: number, s: number, c: string) {
  ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = s * 0.12;
  ctx.beginPath(); ctx.ellipse(x, y, s * 0.32, s * 0.24, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + s * 0.28, y - s * 0.05); ctx.lineTo(x + s * 0.28, y - s); ctx.quadraticCurveTo(x + s * 0.7, y - s * 0.8, x + s * 0.6, y - s * 0.45); ctx.stroke();
}
function starDots(ctx: Ctx, rnd: Rnd, w: number, y0: number, y1: number, n: number, c = 0xffffff) {
  for (let i = 0; i < n; i++) { const x = rnd() * w, y = y0 + rnd() * (y1 - y0), r = 0.6 + rnd() * 1.4; glow(ctx, x, y, r * 3.5, c, 0.3); ctx.fillStyle = css(c, 0.9); ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, Math.PI * 2); ctx.fill(); }
}
/** el yazısı yer adı (italik, mürekkep) */
function placeName(ctx: Ctx, text: string, x: number, y: number, size: number, rot = 0, a = 0.75, c = INK) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.font = `italic 600 ${size}px ${MAP_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = css(PAPER, 0.6); ctx.strokeStyle = css(PAPER, 0.7); ctx.lineWidth = 4; ctx.strokeText(text, 0, 0); ctx.fillStyle = css(c, a); ctx.fillText(text, 0, 0); ctx.restore();
}
/** parşömen: taban rengi, lekeler, lifler, ince enlem/boylam ızgarası */
function parchment(ctx: Ctx, w: number, h: number, rnd: Rnd, tint: number, tintA: number, oy: number) {
  ctx.fillStyle = css(PAPER); ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = css(tint, tintA); ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < Math.ceil(h / 140); i++) glow(ctx, rnd() * w, rnd() * h, 60 + rnd() * 120, 0xc89a5a, 0.08 + rnd() * 0.06);
  for (let i = 0; i < h / 3; i++) { ctx.fillStyle = css(rnd() < 0.5 ? 0x8a6a40 : 0xffffff, 0.06 + rnd() * 0.08); ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
  ctx.strokeStyle = css(0x8a6a40, 0.07); ctx.lineWidth = 1;
  for (let i = 0; i < h / 30; i++) { const x = rnd() * w, y = rnd() * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 8, y + rnd() * 6, x + 16 + rnd() * 20, y + rnd() * 4); ctx.stroke(); }
  // enlem/boylam (dünya koordinatına hizalı; bölgeler arasında kesintisiz)
  ctx.strokeStyle = css(INK, 0.09); ctx.lineWidth = 1; ctx.setLineDash([6, 6]);
  for (let gx = 65; gx < w; gx += 130) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
  for (let gy = 130 - (oy % 130); gy < h; gy += 130) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
  ctx.setLineDash([]);
}

// ------------------------------------------------------------------ yol yatağı (haritada iz)
function road(ctx: Ctx, L: MapLayout, y0: number, y1: number, oy: number, dark: boolean) {
  const pts = L.path.filter((p) => p.y >= y0 - 60 && p.y <= y1 + 60).map((p) => ({ x: p.x, y: p.y - oy }));
  if (pts.length < 2) return;
  const line = (w: number, c: string, dash?: number[]) => { ctx.setLineDash(dash ?? []); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); };
  ctx.save();
  ctx.translate(0, 5); line(40, 'rgba(60,35,10,0.18)'); ctx.translate(0, -5);
  line(36, css(dark ? 0x1d1530 : INK, 0.85)); line(31, css(dark ? 0x3a3166 : 0xe7cfa0)); line(26, css(dark ? 0x4b4280 : 0xf6e8c8));
  const r = rng(Math.round(y0));
  for (let i = 0; i < pts.length; i++) { const p = pts[i]!; if (r() < 0.6) { ctx.fillStyle = css(dark ? 0x6b62a8 : 0xc9a874, 0.55); ctx.beginPath(); ctx.ellipse(p.x + (r() - 0.5) * 18, p.y + (r() - 0.5) * 6, 1.5 + r() * 2.5, 1 + r() * 1.5, r() * 3, 0, Math.PI * 2); ctx.fill(); } }
  // gelecek: kesikli kırmızı-kahve hazine izi
  line(4, css(dark ? 0xffb3c4 : 0xa0412d, 0.75), [9, 9]);
  ctx.restore(); ctx.setLineDash([]);
}

// ------------------------------------------------------------------ bölgeler
type Painter = (ctx: Ctx, w: number, h: number, rnd: Rnd, z: MapZone, L: MapLayout) => void;
const nodesIn = (L: MapLayout, z: MapZone) => L.nodes.filter((n) => n.zone === z.id).map((n) => ({ ...n, y: n.y - z.top }));
const SEA = 0x6fb6d6;

const disKulak: Painter = (ctx, w, h, rnd) => {
  const sea = h - 270;
  // Ses Denizi (dış dünya) + Kepçe kıyısı
  const coast = () => { ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(w + 10, -10); ctx.lineTo(w + 10, sea + 30); for (let x = w + 10; x >= -10; x -= 10) ctx.lineTo(x, sea + Math.sin(x / 37) * 16 + Math.sin(x / 13) * 5 + (x < 120 ? 30 : 0)); ctx.closePath(); };
  ctx.fillStyle = css(0x3f9fd6, 0.75); ctx.fillRect(0, sea - 40, w, h - sea + 40);
  for (let i = 0; i < 40; i++) waveGlyph(ctx, rnd() * w, sea + 50 + rnd() * (h - sea - 60), 7 + rnd() * 6, 0.45);
  shoreLines(ctx, coast, 0x2f6f9a, 3);
  wash(ctx, coast, 0xf7a184, 0.8, 0.6); ink(ctx, coast, 2.2);
  // kepçe sırtları: heliks ve antiheliks dağ sıraları (taramalı sırt)
  const ridge = (pts: [number, number][], wd: number, c: number) => {
    const p = () => { ctx.beginPath(); ctx.moveTo(pts[0]![0], pts[0]![1]); for (let i = 1; i < pts.length - 1; i++) { const a = pts[i]!, b = pts[i + 1]!; ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); } const l = pts[pts.length - 1]!; ctx.lineTo(l[0], l[1]); };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    p(); ctx.strokeStyle = css(darken(c, 0.25), 0.35); ctx.lineWidth = wd + 10; ctx.stroke();
    p(); ctx.strokeStyle = css(c, 0.85); ctx.lineWidth = wd; ctx.stroke();
    p(); ctx.strokeStyle = css(lighten(c, 0.5), 0.7); ctx.lineWidth = wd * 0.25; ctx.stroke();
    ctx.setLineDash([2, 5]); p(); ctx.strokeStyle = css(INK, 0.5); ctx.lineWidth = wd * 0.75; ctx.stroke(); ctx.setLineDash([]);
  };
  ridge([[w + 30, sea * 0.95], [w - 14, sea * 0.55], [w - 30, sea * 0.15], [w * 0.55, -40], [w * 0.1, sea * 0.06], [-20, sea * 0.3]], 42, 0xe28f74);
  ridge([[-30, sea * 0.92], [30, sea * 0.64], [22, sea * 0.4], [80, sea * 0.2], [160, sea * 0.1]], 32, 0xeaa186);
  for (let i = 0; i < 7; i++) mountain(ctx, w - 30 - rnd() * 40, 60 + i * (sea / 8), 14 + rnd() * 6, 0xe7a088, rnd);
  for (let i = 0; i < 5; i++) mountain(ctx, 26 + rnd() * 30, sea * 0.45 + i * 40, 12 + rnd() * 6, 0xe7a088, rnd);
  // konka çanağı: sığ bir koy
  const bay = blobPath(ctx, w * 0.5, sea * 0.58, 120, 90, rnd, 0.12); wash(ctx, bay, 0xf7c9b4, 0.5, 0.6);
  ctx.save(); ctx.setLineDash([3, 6]); ink(ctx, bay, 1.2, 0.5); ctx.restore();
  // kıl ormanı: harita ağaçları
  for (let i = 0; i < 26; i++) { const side = i % 2; tree(ctx, side ? w - 50 - rnd() * 40 : 46 + rnd() * 40, 30 + rnd() * sea * 0.35, 9 + rnd() * 5, mix(0x9c6b4e, 0x6f8f4e, rnd() * 0.5)); }
  // ses dalgaları (rüzgâr gülü gibi) denizden kepçeye
  ctx.strokeStyle = css(0x2f6f9a, 0.55); ctx.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(w * 0.55, sea + 140, 50 + i * 26, -Math.PI * 0.85, -Math.PI * 0.15); ctx.stroke(); }
  // ay ve ninni notaları (denizin üstünde)
  glow(ctx, 330, h - 90, 46, 0xfff6c8, 0.6); ctx.fillStyle = '#fff1c2'; ctx.beginPath(); ctx.arc(330, h - 90, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = css(mix(SEA, PAPER, 0.4)); ctx.beginPath(); ctx.arc(338, h - 96, 15, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 6; i++) note(ctx, 70 + i * 26 + rnd() * 10, h - 40 - i * 26, 11, css(INK, 0.45 - i * 0.05));
  // küçük gemi: ninni gemisi
  ctx.save(); ctx.translate(90, h - 110); ctx.fillStyle = css(0x8a5a3a); ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(22, 0); ctx.lineTo(14, 10); ctx.lineTo(-14, 10); ctx.closePath(); ctx.fill(); ctx.strokeStyle = css(INK); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -30); ctx.stroke(); ctx.fillStyle = '#fff8e8'; ctx.beginPath(); ctx.moveTo(2, -28); ctx.lineTo(20, -6); ctx.lineTo(2, -6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  placeName(ctx, 'Ses Denizi', w * 0.62, h - 30, 15, -0.04);
  placeName(ctx, 'Kıl Ormanı', 92, 40, 12, -0.1, 0.65);
  placeName(ctx, 'Konka Koyu', w * 0.52, sea * 0.58 + 70, 11, 0.05, 0.55);
};

const kanal: Painter = (ctx, w, h, rnd) => {
  // geçidin tabanı: sıcak toprak; iki yanda sarp kayalık duvarlar
  ctx.fillStyle = css(0xd98f62, 0.6); ctx.fillRect(0, 0, w, h);
  for (const side of [0, 1]) {
    const wall = () => { ctx.beginPath(); const x0 = side ? w + 10 : -10; ctx.moveTo(x0, -10); for (let y = -10; y <= h + 10; y += 12) { const x = side ? w - 70 - Math.sin(y / 60 + 1) * 18 - Math.sin(y / 23) * 6 : 70 + Math.sin(y / 55) * 18 + Math.sin(y / 21) * 6; ctx.lineTo(x, y); } ctx.lineTo(x0, h + 10); ctx.closePath(); };
    wash(ctx, wall, 0x8a5a43, 0.7, 0.6); hatch(ctx, wall, w, h, side ? -0.6 : 0.6, 5, INK, 0.28); ink(ctx, wall, 2);
    for (let y = 20; y < h; y += 38) mountain(ctx, side ? w - 30 - rnd() * 20 : 30 + rnd() * 20, y, 11 + rnd() * 5, 0x9e6a50, rnd);
  }
  // perspektif kemerler: tünel halkaları (haritada köprü kemerleri gibi)
  for (let y = 60; y < h; y += 150) { ctx.strokeStyle = css(INK, 0.35); ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.ellipse(w / 2, y, w * 0.33, 26, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); ctx.setLineDash([]); }
  // serumen gölcükleri (amber) ve damlalar
  for (let i = 0; i < 5; i++) { const x = rnd() < 0.5 ? 92 + rnd() * 20 : w - 92 - rnd() * 20; const y = 40 + rnd() * (h - 80); const p = blobPath(ctx, x, y, 18 + rnd() * 8, 10 + rnd() * 5, rnd, 0.2); wash(ctx, p, 0xffb347, 0.75, 0.6); ink(ctx, p, 1.2, 0.6); }
  for (let i = 0; i < 14; i++) { const side = rnd() < 0.5; drop(ctx, side ? 18 + rnd() * 44 : w - 18 - rnd() * 44, 20 + rnd() * (h - 40), 4 + rnd() * 5, rnd() < 0.5 ? 0xffb347 : 0xe8902c, 0.95); }
  for (let i = 0; i < 18; i++) { const side = rnd() < 0.5; hair(ctx, side ? 80 + rnd() * 20 : w - 80 - rnd() * 20, h * 0.5 + rnd() * h * 0.5, 14 + rnd() * 12, -Math.PI / 2 + (side ? 0.5 : -0.5), (rnd() - 0.5), 1.3, css(INK, 0.6)); }
  placeName(ctx, 'Serumen Geçidi', w / 2, h * 0.5, 13, -Math.PI / 2 * 0, 0.5);
};

const zar: Painter = (ctx, w, h, rnd) => {
  ctx.fillStyle = css(0xf7b3c4, 0.5); ctx.fillRect(0, 0, w, h);
  // Titreşen Göl: kulak zarı dev, oval bir göl
  const cy = h * 0.48, rx = w * 0.47, ry = h * 0.36;
  const lake = blobPath(ctx, w / 2, cy, rx, ry, rnd, 0.05, 16);
  // kıyı tepeleri
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; mountain(ctx, w / 2 + Math.cos(a) * (rx + 26), cy + Math.sin(a) * (ry + 22) + 8, 10 + rnd() * 5, 0xe08a9b, rnd); }
  shoreLines(ctx, lake, 0xb2506a, 3);
  wash(ctx, lake, 0xff7fa3, 0.7, 0.8);
  // eş yükselti halkaları (titreşim)
  for (let i = 1; i < 6; i++) { ctx.strokeStyle = css(0xb2506a, 0.32 - i * 0.04); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(w / 2 + 10, cy + 6, rx * (1 - i * 0.15), ry * (1 - i * 0.15), 0, 0, Math.PI * 2); ctx.stroke(); }
  // çekiç sapı: göle uzanan ince yarımada (umbo)
  const pen = () => { ctx.beginPath(); ctx.moveTo(w / 2 - 6, cy - ry - 6); ctx.quadraticCurveTo(w / 2 + 2, cy - ry * 0.5, w / 2 + 12, cy + 4); ctx.quadraticCurveTo(w / 2 + 20, cy - ry * 0.5, w / 2 + 12, cy - ry - 6); ctx.closePath(); };
  wash(ctx, pen, 0xf3e7d0, 0.9, 0.3); ink(ctx, pen, 1.4);
  ink(ctx, lake, 2.2);
  for (let i = 0; i < 10; i++) waveGlyph(ctx, w / 2 + (rnd() - 0.5) * rx * 1.2, cy + (rnd() - 0.5) * ry * 1.1, 6, 0.4, 0x9a3a55);
  // Östaki borusu: aşağı inen ırmak
  ctx.strokeStyle = css(0x5aa3c8, 0.7); ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(w * 0.18, cy + ry * 0.7); ctx.bezierCurveTo(w * 0.05, h * 0.9, w * 0.2, h, w * 0.08, h + 30); ctx.stroke();
  ctx.strokeStyle = css(INK, 0.5); ctx.lineWidth = 1; ctx.stroke();
  placeName(ctx, 'Titreşen Göl', w / 2 - 70, cy + ry * 0.55, 13, -0.08, 0.6);
  placeName(ctx, 'Östaki Irmağı', 66, h - 34, 10, -0.5, 0.55);
};

const kemik: Painter = (ctx, w, h, rnd, z, L) => {
  { const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, css(0x6fa3e6, 0.62)); g.addColorStop(1, css(0x9fd0f0, 0.55)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  // hava boşluğu: bulutlu açık gökyüzü platoları
  for (let i = 0; i < 9; i++) { const p = blobPath(ctx, rnd() * w, rnd() * h, 50 + rnd() * 40, 20 + rnd() * 12, rnd, 0.25); wash(ctx, p, 0xffffff, 0.35, 0.2); }
  // Üç Kemik Dağları: kemik biçimli platolar (fildişi, taramalı)
  const plateau = (p: PathFn) => { ctx.save(); ctx.translate(4, 7); p(); ctx.fillStyle = 'rgba(60,70,90,0.18)'; ctx.fill(); ctx.restore(); wash(ctx, p, 0xf1e6c9, 0.95, 0.45); hatch(ctx, p, w, h, 0.9, 6, INK, 0.16); ink(ctx, p, 2); };
  plateau(() => { ctx.beginPath(); ctx.ellipse(66, h * 0.8, 46, 36, -0.3, 0, Math.PI * 2); ctx.moveTo(96, h * 0.82); ctx.lineTo(152, h * 0.97); ctx.lineTo(134, h * 1.0); ctx.lineTo(80, h * 0.87); ctx.closePath(); });
  plateau(() => { ctx.beginPath(); ctx.ellipse(w - 64, h * 0.5, 50, 40, 0.2, 0, Math.PI * 2); ctx.moveTo(w - 96, h * 0.53); ctx.quadraticCurveTo(w - 160, h * 0.6, w - 150, h * 0.66); ctx.lineTo(w - 134, h * 0.66); ctx.quadraticCurveTo(w - 128, h * 0.6, w - 86, h * 0.56); ctx.closePath(); });
  plateau(() => { ctx.beginPath(); ctx.moveTo(26, h * 0.08); ctx.lineTo(144, h * 0.08); ctx.lineTo(144, h * 0.11); ctx.lineTo(128, h * 0.11); ctx.quadraticCurveTo(112, h * 0.27, 85, h * 0.28); ctx.quadraticCurveTo(58, h * 0.27, 42, h * 0.11); ctx.lineTo(26, h * 0.11); ctx.closePath(); ctx.moveTo(62, h * 0.11); ctx.quadraticCurveTo(70, h * 0.22, 85, h * 0.23); ctx.quadraticCurveTo(100, h * 0.22, 108, h * 0.11); ctx.closePath(); });
  placeName(ctx, 'Çekiç Tepesi', 70, h * 0.8 + 52, 11, 0, 0.6); placeName(ctx, 'Örs Platosu', w - 70, h * 0.5 - 52, 11, 0, 0.6); placeName(ctx, 'Üzengi Kemeri', 85, h * 0.08 - 12, 11, 0, 0.6);
  for (let i = 0; i < 6; i++) mountain(ctx, rnd() < 0.5 ? 20 + rnd() * 40 : w - 20 - rnd() * 40, 40 + rnd() * (h - 80), 10 + rnd() * 5, 0xa8b8cc, rnd);
  // kanala dönüş: serumen mağaraları (17 ve 20. bölümler kanal bölümüdür)
  for (const n of nodesIn(L, z).filter((x) => x.biome === 'kanal')) {
    const R = n.boss ? 92 : 62; const cave = blobPath(ctx, n.x, n.y, R, R * 0.8, rnd, 0.14);
    wash(ctx, cave, 0x8a5a43, 0.7, 0.7); hatch(ctx, cave, w, h, 0.7, 5, INK, 0.25); ink(ctx, cave, 2);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + rnd(); drop(ctx, n.x + Math.cos(a) * R * 0.78, n.y + Math.sin(a) * R * 0.64, 4 + rnd() * 3, 0xffb347, 0.95); }
  }
};

function koklea(lo: number, hi: number, tint: number, name: string): Painter {
  return (ctx, w, h, rnd, z) => {
    ctx.fillStyle = css(tint, 0.48); ctx.fillRect(0, 0, w, h);
    // tüylü hücre tarlaları: tonotopi renginde yamalı tarla mozaiği
    const fields = (x0: number, x1: number) => {
      for (let y = 10 + rnd() * 30; y < h - 10; y += 40 + rnd() * 60) {
        const t = lo + (hi - lo) * (1 - y / h); const fw = (x1 - x0) * (0.6 + rnd() * 0.4); const fx = x0 + rnd() * (x1 - x0 - fw + 6);
        const p = () => { ctx.beginPath(); ctx.moveTo(fx, y); ctx.lineTo(fx + fw, y + 4); ctx.lineTo(fx + fw - 4, y + 30); ctx.lineTo(fx + 2, y + 28); ctx.closePath(); };
        wash(ctx, p, tono(t), 0.62, 0.5); ink(ctx, p, 1, 0.5);
        ctx.save(); p(); ctx.clip(); for (let k = 0; k < 5; k++) tuft(ctx, fx + 8 + k * (fw - 12) / 5, y + 26, 12, tono(t), 3, 0.85); ctx.restore();
      }
    };
    fields(6, 74); fields(w - 78, w - 8);
    // spiral göl / vadi (koklea): suluboya spiral su yolu, eş yükselti
    const cx = z.id === 'koklea-2' ? w * 0.58 : w * 0.45, cy = h * 0.5, R = Math.min(h * 0.46, 175);
    const sp = spiralPath(ctx, cx, cy, R, 2.3);
    ctx.save(); ctx.lineCap = 'round';
    sp(); ctx.strokeStyle = css(darken(SEA, 0.2), 0.25); ctx.lineWidth = 40; ctx.stroke();
    sp(); ctx.strokeStyle = css(mix(0x3f9fd6, tono((lo + hi) / 2), 0.3), 0.85); ctx.lineWidth = 30; ctx.stroke();
    sp(); ctx.strokeStyle = css(0xffffff, 0.35); ctx.lineWidth = 8; ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.translate(-15, 0); ink(ctx, sp, 1.2, 0.45); ctx.translate(30, 0); ink(ctx, sp, 1.2, 0.45); ctx.restore();
    for (let i = 0; i < 12; i++) waveGlyph(ctx, cx + (rnd() - 0.5) * R * 1.6, cy + (rnd() - 0.5) * R * 1.4, 5, 0.35);
    if (z.id === 'koklea-1') {
      // oval pencere: koklea'nın kapısı
      const ow = blobPath(ctx, w / 2 + 82, h - 36, 46, 20, rnd, 0.05, 12); wash(ctx, ow, 0xbfe3f2, 0.8, 0.6); ink(ctx, ow, 2);
      placeName(ctx, 'Oval Pencere', w / 2 + 82, h - 66, 10, 0, 0.6);
    }
    placeName(ctx, name, cx, cy + 4, 12, -0.05, 0.6);
  };
}

const sinir: Painter = (ctx, w, h, rnd) => {
  // gece mavisi mürekkep yıkaması: ışık nehirleri deltası
  ctx.fillStyle = css(0x14214f, 0.85); ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) glow(ctx, rnd() * w, rnd() * h, 80 + rnd() * 80, 0x2b4aa8, 0.25);
  starDots(ctx, rnd, w, 0, h, 40, 0x8fe8ff);
  ctx.globalCompositeOperation = 'lighter';
  for (const f of NERVE_FIBERS) {
    for (const [lw, a] of [[12, 0.06], [5, 0.16], [2, 0.7]] as [number, number][]) {
      ctx.strokeStyle = css(f.c, a); ctx.lineWidth = lw; ctx.beginPath();
      for (let y = -10; y <= h + 10; y += 10) { const x = fiberX(f.x, f.amp, f.per, f.ph, y); if (y === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
    }
    for (let y = (f.ph * 40) % 64; y < h; y += 64) glow(ctx, fiberX(f.x, f.amp, f.per, f.ph, y), y, 8, f.c, 0.5);
  }
  ctx.globalCompositeOperation = 'source-over';
  placeName(ctx, 'Işık Nehirleri', w / 2, h * 0.5, 13, 0, 0.85, 0xd9f6ff);
};
/** sinir lifleri: dikey sinüs ırmaklar (oyun içi nabızlar da bunları izler) */
export const fiberX = (x0: number, amp: number, per: number, ph: number, y: number) => x0 + Math.sin(y / per + ph) * amp;
export const NERVE_FIBERS = Array.from({ length: 14 }, (_, i) => { const r = rng(900 + i); return { x: 14 + i * 28 + (r() - 0.5) * 10, amp: 8 + r() * 16, per: 60 + r() * 60, ph: r() * 6, c: [0x4cf0ff, 0x7aa8ff, 0x9d7bff, 0x4cf0ff][i % 4]! }; });

const beyinSapi: Painter = (ctx, w, h, rnd) => {
  ctx.fillStyle = css(0x2a2250, 0.82); ctx.fillRect(0, 0, w, h);
  starDots(ctx, rnd, w, 0, h, 26, 0xffb3c4);
  // ortadan akan derin vadi (orta hat) ve iki yakayı bağlayan köprüler
  const river = () => { ctx.beginPath(); for (let y = -10; y <= h + 10; y += 10) { const x = w / 2 + Math.sin(y / 70) * 30; if (y === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y); } };
  ctx.save(); ctx.lineCap = 'round'; river(); ctx.strokeStyle = css(0x0d0a1d, 0.8); ctx.lineWidth = 46; ctx.stroke(); river(); ctx.strokeStyle = css(0x6bd7ff, 0.25); ctx.lineWidth = 10; ctx.stroke(); ctx.restore();
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 5; k++) {
    const y = 30 + k * (h / 5); const c = k % 2 ? 0xff6b8b : 0x6bd7ff;
    ctx.strokeStyle = css(c, 0.28); ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(-10, y); ctx.bezierCurveTo(w * 0.35, y + 10, w * 0.65, y + h / 5 - 10, w + 10, y + h / 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w + 10, y); ctx.bezierCurveTo(w * 0.65, y + 10, w * 0.35, y + h / 5 - 10, -10, y + h / 5); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let k = 0; k < 3; k++) {
    const y = h * (0.18 + k * 0.32);
    const arch = () => { ctx.beginPath(); ctx.moveTo(w / 2 - 80, y + 26); ctx.quadraticCurveTo(w / 2, y - 30, w / 2 + 80, y + 26); };
    ctx.save(); ctx.lineCap = 'round'; ctx.translate(0, 6); arch(); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 18; ctx.stroke(); ctx.restore();
    ctx.lineCap = 'round'; arch(); ctx.strokeStyle = '#8b7bd0'; ctx.lineWidth = 15; ctx.stroke(); arch(); ctx.strokeStyle = '#b3a6ef'; ctx.lineWidth = 5; ctx.stroke();
    ctx.save(); ctx.setLineDash([2, 8]); arch(); ctx.strokeStyle = '#1d1640'; ctx.lineWidth = 15; ctx.stroke(); ctx.restore();
  }
  for (let i = 0; i < 8; i++) { const x = rnd() < 0.5 ? 30 + rnd() * 60 : w - 30 - rnd() * 60; const y = rnd() * h; glow(ctx, x, y, 26, 0xff8fb1, 0.35); glow(ctx, x, y, 8, 0xffffff, 0.6); }
  placeName(ctx, 'Köprüler Diyarı', w / 2, h * 0.5, 13, 0, 0.85, 0xffd6e2);
};

const korteks: Painter = (ctx, w, h, rnd) => {
  ctx.fillStyle = css(0xffa9c8, 0.5); ctx.fillRect(0, 0, w, h);
  // Anlam Tepeleri: girus kıvrımları eş yükselti çizgili tepeler
  for (let k = 0; k < Math.ceil(h / 130) + 1; k++) {
    const y0 = k * 130 + rnd() * 30;
    const hill = () => { ctx.beginPath(); for (let x = -20; x <= w + 20; x += 6) { const y = y0 + Math.sin(x / 40 + k * 1.7) * 24 + Math.sin(x / 13 + k) * 5; if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.lineTo(w + 20, y0 + 70); ctx.lineTo(-20, y0 + 70); ctx.closePath(); };
    wash(ctx, hill, 0xf58ab3, 0.45, 0.6);
    for (let c = 0; c < 3; c++) { ctx.beginPath(); for (let x = -20; x <= w + 20; x += 6) { const y = y0 + 12 + c * 14 + Math.sin(x / 40 + k * 1.7) * (20 - c * 5) + Math.sin(x / 13 + k) * 4; if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.strokeStyle = css(INK, 0.22 - c * 0.05); ctx.lineWidth = 1; ctx.stroke(); }
  }
  // nöron köyleri ve aralarındaki yollar
  const ns = KORTEX_NEURONS(w, h);
  ctx.strokeStyle = css(0x7c5cff, 0.5); ctx.lineWidth = 1.6; ctx.setLineDash([3, 4]);
  for (const [a, b] of ns.edges) { const p = ns.pts[a]!, q = ns.pts[b]!; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo((p.x + q.x) / 2 + 20, (p.y + q.y) / 2 - 10, q.x, q.y); ctx.stroke(); }
  ctx.setLineDash([]);
  for (const p of ns.pts) {
    for (let i = 0; i < 5; i++) hair(ctx, p.x, p.y, 12 + rnd() * 10, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.9, 1.6, css(0x7c5cff, 0.55));
    glow(ctx, p.x, p.y, 18, 0xb69bff, 0.45);
    const tri = () => { ctx.beginPath(); ctx.moveTo(p.x, p.y - 9); ctx.lineTo(p.x + 8, p.y + 6); ctx.lineTo(p.x - 8, p.y + 6); ctx.closePath(); };
    tri(); ctx.fillStyle = '#8b6cff'; ctx.fill(); ink(ctx, tri, 1.2);
  }
  placeName(ctx, 'Anlam Tepeleri', w / 2 + 40, h * 0.62, 13, -0.06, 0.6);
};
export function KORTEX_NEURONS(w: number, h: number) {
  const r = rng(4242); const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 14; i++) pts.push({ x: (i % 2 ? w - 28 - r() * 60 : 28 + r() * 60), y: 30 + (i / 14) * (h - 60) + r() * 30 });
  const edges: [number, number][] = []; for (let i = 0; i < pts.length - 1; i++) { edges.push([i, i + 1]); if (i + 2 < pts.length && r() < 0.5) edges.push([i, i + 2]); }
  return { pts, edges };
}

const finale: Painter = (ctx, w, h, rnd) => {
  // gece göğü (haritanın kuzeyi) — altın ışık
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, css(0x1d1650, 0.92)); g.addColorStop(0.5, css(0x4a2f86, 0.75)); g.addColorStop(0.85, css(0xd77fb0, 0.35)); g.addColorStop(1, css(0xffc3d8, 0.1));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  starDots(ctx, rnd, w, 0, h * 0.7, 60, 0xfff3c4);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.22; ctx.fillStyle = css(0xffd77a, 0.05); ctx.beginPath(); ctx.moveTo(w / 2, 250); ctx.lineTo(w / 2 + Math.cos(a - 0.06) * 600, 250 + Math.sin(a - 0.06) * 600); ctx.lineTo(w / 2 + Math.cos(a + 0.06) * 600, 250 + Math.sin(a + 0.06) * 600); ctx.closePath(); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
  // bulut kıyısı (harita bulutları)
  for (let i = 0; i < 9; i++) { const p = blobPath(ctx, (i / 8) * w, h - 70 + rnd() * 30, 46 + rnd() * 20, 26 + rnd() * 10, rnd, 0.15); wash(ctx, p, 0xfff1f6, 0.9, 0.2); ink(ctx, p, 1.2, 0.4); }
  for (let i = 0; i < 8; i++) note(ctx, 30 + rnd() * (w - 60), 80 + rnd() * (h - 260), 12 + rnd() * 8, css(0xfff3c4, 0.5));
};

const PAINTERS: Record<ZoneId, Painter> = {
  'dis-kulak': disKulak, kanal, zar, kemikcikler: kemik,
  'koklea-1': koklea(0, 0.33, 0xcfc3ff, 'Spiral Göl'), 'koklea-2': koklea(0.33, 0.66, 0xe2c4fb, 'Konuşma Vadisi'), 'koklea-3': koklea(0.66, 1, 0xffcfa0, 'Bas Gölü'),
  sinir, 'beyin-sapi': beyinSapi, korteks, finale,
};
const DARK: Partial<Record<ZoneId, true>> = { sinir: true, 'beyin-sapi': true, finale: true };
/** bölge sınırı rengi (sınır çizgisi) */
const BORDER: Record<ZoneId, number> = { 'dis-kulak': 0xb4553f, kanal: 0x5a3020, zar: 0xb2506a, kemikcikler: 0x4f6f96, 'koklea-1': 0x5a3fd6, 'koklea-2': 0x7c3fb0, 'koklea-3': 0xb86a24, sinir: 0x2c4aa8, 'beyin-sapi': 0x6a55c0, korteks: 0xc14f7a, finale: 0xc79a2a };
/** haritadaki yer adı (bölge kapısındaki şeritte biyom adının altında) */
export const ZONE_PLACE: Record<ZoneId, string> = {
  'dis-kulak': 'Kepçe Kıyıları', kanal: 'Serumen Geçidi', zar: 'Titreşen Göl', kemikcikler: 'Üç Kemik Dağları', 'koklea-1': 'Spiral Göl', 'koklea-2': 'Konuşma Vadisi',
  'koklea-3': 'Bas Gölü', sinir: 'Işık Nehirleri', 'beyin-sapi': 'Köprüler Diyarı', korteks: 'Anlam Tepeleri', finale: 'Yolculuğun Sonu',
};
export const zoneName = (z: ZoneId) => (z === 'finale' ? 'Ninni Merkezi' : BIOMES[z].name);
export const zoneAccent = (z: ZoneId) => (z === 'finale' ? 0xf5b700 : BIOMES[z].palette.accent);

/** Bir bölgenin arka plan tuvali: [top, bottom + taşma] aralığı, S ölçeğinde. */
export function paintZone(L: MapLayout, z: MapZone, S: number, isFirst: boolean): HTMLCanvasElement {
  const w = L.width; const ov = isFirst ? 0 : ZONE_OVERLAP; const zh = z.bottom - z.top; const h = zh + ov;
  const { c, ctx } = makeCanvas(w * S, h * S); ctx.scale(S, S);
  const rnd = rng(Math.round(z.top) * 7 + z.id.length * 131);
  const edge = (x: number) => zh + ov * 0.5 + Math.sin(x / 42 + z.top) * ov * 0.2 + Math.sin(x / 17) * ov * 0.06;
  const shape = () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); if (!ov) { ctx.lineTo(w, h); ctx.lineTo(0, h); } else for (let x = w; x >= 0; x -= 6) ctx.lineTo(x, edge(x)); ctx.closePath(); };
  ctx.save(); shape(); ctx.clip();
  parchment(ctx, w, h, rnd, zoneAccent(z.id), 0.04, z.top);
  PAINTERS[z.id](ctx, w, h, rnd, z, L);
  ctx.restore();
  // suluboya canlılığı (destekleyen tarayıcıda): doygunluk + kontrast; desteklemezse olduğu gibi kalır
  try { const { c: c2, ctx: x2 } = makeCanvas(c.width, c.height); x2.filter = 'saturate(1.35) contrast(1.06)'; x2.drawImage(c, 0, 0); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(c2, 0, 0); ctx.restore(); } catch { /* yok */ }
  ctx.save(); shape(); ctx.clip(); road(ctx, L, z.top, z.bottom + ov, z.top, !!DARK[z.id]); ctx.restore();
  if (ov) {
    // bölge sınırı: eski haritalardaki noktalı-çizgili sınır + gölge
    const line = (dy: number, lw: number, col: string, dash: number[] = []) => { ctx.setLineDash(dash); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); for (let x = -6; x <= w + 6; x += 6) { const y = edge(x) + dy; if (x === -6) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); ctx.setLineDash([]); };
    line(4, 12, 'rgba(60,35,10,0.12)'); line(0, 7, css(BORDER[z.id], 0.22)); line(0, 2.2, css(BORDER[z.id], 0.85), [12, 5, 2, 5]);
  }
  return c;
}
