/**
 * Haritanın büyük bölge resimleri: Canvas 2D ile prosedürel (varlık dosyası yok). Her bölge bir kez çizilir, doku olur.
 * Koordinatlar tasarım birimidir (genişlik 390); tuval S ölçeğiyle (netlik) çizilir.
 * Kilitli (gri) görünüm burada çizilmez: oyunda renk matrisiyle elde edilir, böylece bellek iki katına çıkmaz.
 */
import type { MapLayout, MapZone, ZoneId } from './layout';

type Ctx = CanvasRenderingContext2D;
type Rnd = () => number;
export const ZONE_OVERLAP = 70;

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
  const stops = [0x7c5cff, 0x4c8dff, 0x2ee6d6, 0x7be86a, 0xffd45c, 0xff8a3c];
  const x = Math.max(0, Math.min(0.9999, t)) * (stops.length - 1); const i = Math.floor(x);
  return mix(stops[i]!, stops[i + 1]!, x - i);
}

export function makeCanvas(w: number, h: number): { c: HTMLCanvasElement; ctx: Ctx } {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return { c, ctx: c.getContext('2d')! };
}

// ------------------------------------------------------------------ çizim yardımcıları
function vgrad(ctx: Ctx, x: number, y0: number, w: number, y1: number, stops: [number, number, number?][]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1); for (const [t, c, a] of stops) g.addColorStop(t, css(c, a ?? 1));
  ctx.fillStyle = g; ctx.fillRect(x, y0, w, y1 - y0);
}
export function glow(ctx: Ctx, x: number, y: number, r: number, c: number, a = 1, inner = 0) {
  const g = ctx.createRadialGradient(x, y, r * inner, x, y, r); g.addColorStop(0, css(c, a)); g.addColorStop(1, css(c, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
function blob(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rnd: Rnd, wob = 0.18, n = 9) {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const k = 1 + (rnd() - 0.5) * 2 * wob; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n]!, q = pts[(i + 1) % n]!; const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(p[0], p[1], mx, my);
  }
  ctx.closePath();
}
function hair(ctx: Ctx, x: number, y: number, len: number, ang: number, curl: number, w: number, c: string) {
  const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
  const mx = x + Math.cos(ang + curl) * len * 0.55, my = y + Math.sin(ang + curl) * len * 0.55;
  ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
}
function drop(ctx: Ctx, x: number, y: number, r: number, c: number, a = 1) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.2, r * 0.1, x, y, r * 1.3);
  g.addColorStop(0, css(lighten(c, 0.55), a)); g.addColorStop(0.5, css(c, a)); g.addColorStop(1, css(darken(c, 0.35), a));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y - r * 2); ctx.bezierCurveTo(x + r * 0.4, y - r * 1.2, x + r, y - r * 0.6, x + r, y); ctx.arc(x, y, r, 0, Math.PI); ctx.bezierCurveTo(x - r, y - r * 0.6, x - r * 0.4, y - r * 1.2, x, y - r * 2); ctx.fill();
  ctx.fillStyle = css(0xffffff, 0.55 * a); ctx.beginPath(); ctx.ellipse(x - r * 0.38, y - r * 0.3, r * 0.22, r * 0.36, -0.4, 0, Math.PI * 2); ctx.fill();
}
export function tuft(ctx: Ctx, x: number, y: number, h: number, c: number, n = 5, a = 1) {
  for (let i = 0; i < n; i++) {
    const t = (i - (n - 1) / 2) / Math.max(1, n - 1); const hh = h * (1 - Math.abs(t) * 0.4);
    const tx = x + t * h * 0.55, ty = y - hh;
    ctx.strokeStyle = css(darken(c, 0.15), a); ctx.lineWidth = Math.max(1.5, h * 0.08); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + t * h * 0.15, y); ctx.quadraticCurveTo(x + t * h * 0.2, y - hh * 0.6, tx, ty); ctx.stroke();
    glow(ctx, tx, ty, h * 0.2, lighten(c, 0.3), 0.5 * a);
    ctx.fillStyle = css(lighten(c, 0.15), a); ctx.beginPath(); ctx.arc(tx, ty, Math.max(1.6, h * 0.085), 0, Math.PI * 2); ctx.fill();
  }
}
function gear(ctx: Ctx, x: number, y: number, r: number, teeth: number, c: number, a = 1) {
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) { const ang = (i / (teeth * 2)) * Math.PI * 2; const rr = i % 2 ? r * 0.8 : r; const da = Math.PI / (teeth * 2) * 0.55; ctx.lineTo(Math.cos(ang - da) * rr, Math.sin(ang - da) * rr); ctx.lineTo(Math.cos(ang + da) * rr, Math.sin(ang + da) * rr); }
  ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r); g.addColorStop(0, css(lighten(c, 0.35), a)); g.addColorStop(1, css(darken(c, 0.2), a));
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = css(darken(c, 0.4), a * 0.8); ctx.lineWidth = Math.max(1.5, r * 0.06); ctx.stroke();
  ctx.fillStyle = css(darken(c, 0.35), a); ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = css(lighten(c, 0.5), a * 0.6); ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function spiral(ctx: Ctx, cx: number, cy: number, r: number, turns: number, w: number, color: (t: number) => string) {
  const N = 220; let px = cx + r, py = cy;
  for (let i = 1; i <= N; i++) {
    const t = i / N; const a = t * turns * Math.PI * 2; const rr = r * (1 - t * 0.88);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    ctx.strokeStyle = color(t); ctx.lineWidth = w * (1 - t * 0.7); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke(); px = x; py = y;
  }
}
function stars(ctx: Ctx, rnd: Rnd, w: number, y0: number, y1: number, n: number, c = 0xffffff) {
  for (let i = 0; i < n; i++) { const x = rnd() * w, y = y0 + rnd() * (y1 - y0), r = 0.6 + rnd() * 1.6; glow(ctx, x, y, r * 3, c, 0.35); ctx.fillStyle = css(c, 0.9); ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.fill(); }
}
function note(ctx: Ctx, x: number, y: number, s: number, c: string) {
  ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = s * 0.12;
  ctx.beginPath(); ctx.ellipse(x, y, s * 0.32, s * 0.24, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + s * 0.28, y - s * 0.05); ctx.lineTo(x + s * 0.28, y - s); ctx.quadraticCurveTo(x + s * 0.7, y - s * 0.8, x + s * 0.6, y - s * 0.45); ctx.stroke();
}
function soundArcs(ctx: Ctx, x: number, y: number, r0: number, n: number, ang: number, spread: number, c: number, a: number) {
  for (let i = 0; i < n; i++) { ctx.strokeStyle = css(c, a * (1 - i / (n + 1))); ctx.lineWidth = 3 - i * 0.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, r0 + i * 14, ang - spread, ang + spread); ctx.stroke(); }
}
/** ışıklı lif: dikey sinüs eğrisi */
export const fiberX = (x0: number, amp: number, per: number, ph: number, y: number) => x0 + Math.sin(y / per + ph) * amp;

// ------------------------------------------------------------------ yol yatağı
const ROAD: Record<ZoneId, { edge: number; body: number; dots: number; dash: number }> = {
  'dis-kulak': { edge: 0xc9826a, body: 0xffe6d8, dots: 0xf4c3ad, dash: 0xffffff },
  kanal: { edge: 0x2a1a14, body: 0xb27a5c, dots: 0x8a5a43, dash: 0xffd9a0 },
  zar: { edge: 0xc96a7f, body: 0xffeef2, dots: 0xf6c3cf, dash: 0xffffff },
  kemikcikler: { edge: 0x8f8a7a, body: 0xf3eedf, dots: 0xd8d0b8, dash: 0xffffff },
  'koklea-1': { edge: 0x5a3fd6, body: 0xeee8ff, dots: 0xc9bcff, dash: 0xffffff },
  'koklea-2': { edge: 0x7c3fb0, body: 0xf7ecff, dots: 0xe0c4f7, dash: 0xffffff },
  'koklea-3': { edge: 0xb86a24, body: 0xfff1e1, dots: 0xffd2a3, dash: 0xffffff },
  sinir: { edge: 0x05081c, body: 0x24357a, dots: 0x3a56b0, dash: 0x8ff6ff },
  'beyin-sapi': { edge: 0x0d0a1d, body: 0x473a85, dots: 0x5d4fa3, dash: 0xffb3c4 },
  korteks: { edge: 0xd86a8e, body: 0xfff1f6, dots: 0xffc9dc, dash: 0xffffff },
  finale: { edge: 0x2a1d5c, body: 0xfff4d6, dots: 0xffdf8a, dash: 0xffffff },
};
function road(ctx: Ctx, L: MapLayout, y0: number, y1: number, oy: number, z: ZoneId) {
  const st = ROAD[z];
  const pts = L.path.filter((p) => p.y >= y0 - 60 && p.y <= y1 + 60).map((p) => ({ x: p.x, y: p.y - oy }));
  if (pts.length < 2) return;
  const line = (w: number, c: string, dash?: number[]) => { ctx.setLineDash(dash ?? []); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); };
  ctx.save();
  ctx.translate(0, 7); line(46, 'rgba(20,10,40,0.22)'); ctx.translate(0, -7);
  line(44, css(st.edge)); line(36, css(darken(st.body, 0.1))); line(30, css(st.body)); ctx.translate(0, -3); line(18, css(lighten(st.body, 0.35), 0.7)); ctx.translate(0, 3);
  // taş/doku benekleri
  const r = rng(Math.round(y0));
  for (let i = 0; i < pts.length - 1; i += 1) { const p = pts[i]!; if (r() < 0.5) { ctx.fillStyle = css(st.dots, 0.7); ctx.beginPath(); ctx.ellipse(p.x + (r() - 0.5) * 22, p.y + (r() - 0.5) * 6, 2 + r() * 3, 1.5 + r() * 2, r() * 3, 0, Math.PI * 2); ctx.fill(); } }
  line(5, css(st.dash, 0.85), [2, 13]);
  ctx.restore(); ctx.setLineDash([]);
}

// ------------------------------------------------------------------ bölgeler
type Painter = (ctx: Ctx, w: number, h: number, rnd: Rnd, z: MapZone, L: MapLayout) => void;
const nodesIn = (L: MapLayout, z: MapZone) => L.nodes.filter((n) => n.zone === z.id).map((n) => ({ ...n, y: n.y - z.top }));

const disKulak: Painter = (ctx, w, h, rnd, z, L) => {
  vgrad(ctx, 0, 0, w, h, [[0, 0xf3a98f], [0.22, 0xf9c4ad], [0.62, 0xfde0d1], [0.8, 0xffe8dc], [0.9, 0xd9c8ff], [1, 0xa996ff]]);
  // dış dünya: alacakaranlık, ay ve ninni notaları
  const sky = h - 260;
  stars(ctx, rnd, w, sky + 60, h, 26);
  glow(ctx, 318, h - 150, 70, 0xfff6c8, 0.55); ctx.fillStyle = '#fff6d6'; ctx.beginPath(); ctx.arc(318, h - 150, 26, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = css(0xb7a4ff); ctx.beginPath(); ctx.arc(330, h - 158, 22, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 7; i++) note(ctx, 40 + rnd() * 120 + i * 18, h - 40 - i * 34, 12 + rnd() * 6, css(0xffffff, 0.55 - i * 0.05));
  soundArcs(ctx, w / 2, h + 40, 120, 4, -Math.PI / 2, 0.7, 0xffffff, 0.35);
  // kulak kepçesi: dev kıvrımlar (heliks, antiheliks, konka)
  const ridge = (pts: [number, number][], wd: number, base: number) => {
    const p = () => { ctx.beginPath(); ctx.moveTo(pts[0]![0], pts[0]![1]); for (let i = 1; i < pts.length - 1; i++) { const a = pts[i]!, b = pts[i + 1]!; ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); } const l = pts[pts.length - 1]!; ctx.lineTo(l[0], l[1]); };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.save(); ctx.translate(6, 10); p(); ctx.strokeStyle = css(darken(base, 0.35), 0.35); ctx.lineWidth = wd + 8; ctx.stroke(); ctx.restore();
    p(); ctx.strokeStyle = css(darken(base, 0.12)); ctx.lineWidth = wd; ctx.stroke();
    p(); ctx.strokeStyle = css(base); ctx.lineWidth = wd * 0.72; ctx.stroke();
    ctx.save(); ctx.translate(-wd * 0.12, -wd * 0.16); p(); ctx.strokeStyle = css(lighten(base, 0.45), 0.85); ctx.lineWidth = wd * 0.22; ctx.stroke(); ctx.restore();
  };
  const H0 = sky; // kepçe bölgesinin altı
  // konka (çanak) gölgesi
  glow(ctx, w * 0.5, H0 * 0.55, 230, 0xd9876d, 0.35);
  ridge([[w + 30, H0 * 0.98], [w - 10, H0 * 0.55], [w - 30, H0 * 0.18], [w * 0.55, -30], [w * 0.1, H0 * 0.08], [-20, H0 * 0.3]], 74, 0xf2a88f);
  ridge([[-30, H0 * 0.92], [26, H0 * 0.66], [18, H0 * 0.42], [70, H0 * 0.2], [150, H0 * 0.12]], 56, 0xf5b49c);
  ridge([[w + 20, H0 * 0.42], [w - 46, H0 * 0.5], [w - 60, H0 * 0.74], [w + 10, H0 * 0.86]], 42, 0xf7bca5);
  // kulak memesi (alt)
  blob(ctx, 58, H0 * 1.0, 72, 54, rnd, 0.08); { const g = ctx.createRadialGradient(40, H0 - 10, 8, 58, H0, 80); g.addColorStop(0, '#ffd2c0'); g.addColorStop(1, '#f2a48a'); ctx.fillStyle = g; ctx.fill(); }
  // kıl ormanı: kanal girişine yakın, iki yanda
  for (let side = 0; side < 2; side++) for (let i = 0; i < 46; i++) {
    const x = side ? w - 8 - rnd() * 70 : 8 + rnd() * 70; const y = 40 + rnd() * H0 * 0.42;
    const ang = -Math.PI / 2 + (side ? -0.5 : 0.5) * (0.4 + rnd() * 0.8);
    hair(ctx, x, y, 28 + rnd() * 34, ang, (rnd() - 0.5) * 0.8, 1.6 + rnd() * 1.4, css(0x8a4a3a, 0.35 + rnd() * 0.35));
  }
  // gözenek ve benekler
  for (let i = 0; i < 90; i++) { ctx.fillStyle = css(0xd98a72, 0.12 + rnd() * 0.15); ctx.beginPath(); ctx.arc(rnd() * w, rnd() * H0, 1 + rnd() * 3, 0, Math.PI * 2); ctx.fill(); }
  // gelen ses dalgaları (yanlardan kanala)
  soundArcs(ctx, -20, H0 * 0.55, 60, 3, 0, 0.45, 0xffffff, 0.28); soundArcs(ctx, w + 20, H0 * 0.35, 60, 3, Math.PI, 0.45, 0xffffff, 0.28);
  void z; void L;
};

const kanal: Painter = (ctx, w, h, rnd) => {
  vgrad(ctx, 0, 0, w, h, [[0, 0x2b1b16], [0.5, 0x4a2f27], [1, 0x6a4636]]);
  // tünel duvarları: kenarlar koyu, orta sıcak ışık
  const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(10,4,2,0.75)'); g.addColorStop(0.22, 'rgba(10,4,2,0)'); g.addColorStop(0.78, 'rgba(10,4,2,0)'); g.addColorStop(1, 'rgba(10,4,2,0.75)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let y = 40; y < h; y += 130) glow(ctx, w / 2 + (rnd() - 0.5) * 80, y, 150, 0xffa766, 0.16);
  // perspektif halkalar
  for (let y = 30; y < h + 40; y += 118) {
    for (const [lw, c, a] of [[16, 0x1a0d09, 0.5], [9, 0x9a6650, 0.55], [3, 0xe2a582, 0.5]] as [number, number, number][]) {
      ctx.strokeStyle = css(c, a); ctx.lineWidth = lw; ctx.beginPath(); ctx.ellipse(w / 2, y, w * 0.62, 46, 0, Math.PI * 0.06, Math.PI * 0.94); ctx.stroke();
    }
  }
  // serumen damlaları duvarlarda
  for (let i = 0; i < 26; i++) { const side = rnd() < 0.5; const x = side ? 12 + rnd() * 62 : w - 12 - rnd() * 62; const y = 20 + rnd() * (h - 40); drop(ctx, x, y, 5 + rnd() * 10, rnd() < 0.5 ? 0xffb347 : 0xe8902c, 0.92); }
  // ince kıllar (kanalın dış kısmı)
  for (let i = 0; i < 40; i++) { const side = rnd() < 0.5; const x = side ? rnd() * 50 : w - rnd() * 50; hair(ctx, x, h * 0.55 + rnd() * h * 0.45, 20 + rnd() * 26, -Math.PI / 2 + (side ? 0.6 : -0.6), (rnd() - 0.5), 1.4, css(0x2a140c, 0.6)); }
};

const zar: Painter = (ctx, w, h, rnd, z, L) => {
  vgrad(ctx, 0, 0, w, h, [[0, 0xf0b3bd], [0.5, 0xf8d6dc], [1, 0xfbe9ec]]);
  for (let i = 0; i < 14; i++) glow(ctx, rnd() * w, rnd() * h, 40 + rnd() * 80, 0xffffff, 0.18);
  // zarın çerçevesi (annulus): dev halka
  const cy = h * 0.47, rx = w * 0.56, ry = h * 0.4;
  ctx.save(); ctx.shadowColor = 'rgba(120,30,60,0.35)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
  ctx.strokeStyle = css(0xc9707f); ctx.lineWidth = 34; ctx.beginPath(); ctx.ellipse(w / 2, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = css(0xe99aa6); ctx.lineWidth = 22; ctx.beginPath(); ctx.ellipse(w / 2, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = css(0xffd5dd, 0.8); ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(w / 2 - 3, cy - 5, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();
  // gerdirme ipleri
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; const x = w / 2 + Math.cos(a) * (rx + 22), y = cy + Math.sin(a) * (ry + 22); ctx.fillStyle = css(0xb85d6f); ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = css(0xffe1e7, 0.8); ctx.beginPath(); ctx.arc(x - 1, y - 1, 1.5, 0, Math.PI * 2); ctx.fill(); }
  // Östaki borusu: altta karanlık bir tünel ağzı
  ctx.fillStyle = 'rgba(90,20,40,0.25)'; ctx.beginPath(); ctx.ellipse(w * 0.15, h * 0.92, 44, 18, -0.2, 0, Math.PI * 2); ctx.fill();
  void z; void L;
};

const kemik: Painter = (ctx, w, h, rnd, z, L) => {
  vgrad(ctx, 0, 0, w, h, [[0, 0xc4d6ea], [0.5, 0xdbe7f3], [1, 0xedf4fa]]);
  // hava kabarcıkları (orta kulak hava doludur)
  for (let i = 0; i < 36; i++) { const x = rnd() * w, y = rnd() * h, r = 4 + rnd() * 16; ctx.strokeStyle = css(0xffffff, 0.55); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = css(0xffffff, 0.22); ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill(); }
  // dev arka plan dişlileri (silik)
  gear(ctx, -20, h * 0.18, 110, 14, 0xaec2d8, 0.45); gear(ctx, w + 30, h * 0.52, 130, 16, 0xaec2d8, 0.45); gear(ctx, -10, h * 0.86, 90, 12, 0xaec2d8, 0.45);
  // kemikler: fildişi, gölgeli
  const bone = (draw: () => void) => {
    ctx.save(); ctx.shadowColor = 'rgba(40,60,90,0.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 10;
    draw(); const g = ctx.createLinearGradient(0, 0, w, h * 0.1); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#e3d7bc'); ctx.fillStyle = g; ctx.fill(); ctx.restore();
    draw(); ctx.strokeStyle = 'rgba(150,130,100,0.7)'; ctx.lineWidth = 3; ctx.stroke();
  };
  // çekiç (malleus): baş + sap (altta sol)
  bone(() => { ctx.beginPath(); ctx.ellipse(70, h * 0.8, 44, 36, -0.3, 0, Math.PI * 2); ctx.moveTo(96, h * 0.82); ctx.lineTo(150, h * 0.98); ctx.lineTo(132, h * 1.0); ctx.lineTo(80, h * 0.86); });
  // örs (incus): gövde + iki kol (ortada sağ)
  bone(() => { ctx.beginPath(); ctx.ellipse(w - 70, h * 0.5, 50, 40, 0.2, 0, Math.PI * 2); ctx.moveTo(w - 100, h * 0.53); ctx.quadraticCurveTo(w - 160, h * 0.6, w - 150, h * 0.66); ctx.lineTo(w - 136, h * 0.66); ctx.quadraticCurveTo(w - 130, h * 0.6, w - 88, h * 0.56); });
  // üzengi (stapes): kemer + taban (üstte sol)
  bone(() => { ctx.beginPath(); ctx.moveTo(30, h * 0.08); ctx.lineTo(140, h * 0.08); ctx.lineTo(140, h * 0.11); ctx.lineTo(126, h * 0.11); ctx.quadraticCurveTo(110, h * 0.27, 85, h * 0.28); ctx.quadraticCurveTo(60, h * 0.27, 44, h * 0.11); ctx.lineTo(30, h * 0.11); ctx.closePath(); ctx.moveTo(62, h * 0.11); ctx.quadraticCurveTo(70, h * 0.22, 85, h * 0.23); ctx.quadraticCurveTo(100, h * 0.22, 108, h * 0.11); ctx.closePath(); });
  // kanala dönüş portalları (17 ve 20. bölüm kanal bölümüdür)
  for (const n of nodesIn(L, z).filter((x) => x.biome === 'kanal')) {
    ctx.save(); ctx.shadowColor = 'rgba(40,20,10,0.5)'; ctx.shadowBlur = 24;
    const g = ctx.createRadialGradient(n.x, n.y, 10, n.x, n.y, n.boss ? 120 : 84); g.addColorStop(0, '#5a3b31'); g.addColorStop(0.7, '#3e2a24'); g.addColorStop(1, 'rgba(62,42,36,0)');
    ctx.fillStyle = g; blob(ctx, n.x, n.y, n.boss ? 120 : 84, n.boss ? 104 : 70, rnd, 0.12); ctx.fill(); ctx.restore();
    for (let i = 0; i < 8; i++) { const a = rnd() * Math.PI * 2; drop(ctx, n.x + Math.cos(a) * (n.boss ? 92 : 62), n.y + Math.sin(a) * (n.boss ? 76 : 50), 5 + rnd() * 5, 0xffb347, 0.9); }
  }
};

function koklea(lo: number, hi: number, bg: [number, number, number]): Painter {
  return (ctx, w, h, rnd, z) => {
    vgrad(ctx, 0, 0, w, h, [[0, bg[0]], [0.5, bg[1]], [1, bg[2]]]);
    // sıvı dalga bantları
    for (let k = 0; k < Math.ceil(h / 90); k++) {
      const y = 40 + k * 90; ctx.strokeStyle = css(0xffffff, 0.28); ctx.lineWidth = 10; ctx.beginPath();
      for (let x = -10; x <= w + 10; x += 8) { const yy = y + Math.sin(x / 46 + k) * 12; if (x === -10) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); } ctx.stroke();
      ctx.strokeStyle = css(darken(bg[1], 0.12), 0.25); ctx.lineWidth = 3; ctx.beginPath();
      for (let x = -10; x <= w + 10; x += 8) { const yy = y + 14 + Math.sin(x / 46 + k) * 12; if (x === -10) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); } ctx.stroke();
    }
    // salyangoz kabuğu kıvrımı (silik büyük spiral)
    ctx.globalAlpha = 0.35; spiral(ctx, w * (z.id === 'koklea-2' ? 0.85 : 0.15), h * 0.5, Math.min(h * 0.55, 260), 2.6, 26, (t) => css(lighten(tono(lo + (hi - lo) * t), 0.2), 0.7)); ctx.globalAlpha = 1;
    // baziler zar + tüylü hücre bahçeleri (tonotopi renkleri)
    for (const side of [0, 1]) {
      for (let y = 30; y < h - 10; y += 26) {
        const t = lo + (hi - lo) * (1 - y / h); const x = side ? w - 22 - rnd() * 26 : 22 + rnd() * 26;
        ctx.fillStyle = css(darken(bg[2], 0.2), 0.5); ctx.beginPath(); ctx.ellipse(x, y + 2, 16, 4, 0, 0, Math.PI * 2); ctx.fill();
        tuft(ctx, x, y, 18 + rnd() * 10, tono(t), 5, 0.9);
      }
    }
    if (z.id === 'koklea-1') {
      // oval pencere: alttan üzengi tabanı burada vurur
      ctx.save(); ctx.shadowColor = 'rgba(60,30,140,0.4)'; ctx.shadowBlur = 20;
      const g = ctx.createRadialGradient(w / 2, h - 46, 6, w / 2, h - 46, 70); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#b9a8ff'); ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(w / 2 + 70, h - 40, 60, 26, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.strokeStyle = css(0x5a3fd6, 0.6); ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(w / 2 + 70, h - 40, 60, 26, 0, 0, Math.PI * 2); ctx.stroke();
    }
    for (let i = 0; i < 26; i++) { const x = rnd() * w, y = rnd() * h, r = 2 + rnd() * 6; ctx.fillStyle = css(0xffffff, 0.45); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  };
}

const sinir: Painter = (ctx, w, h, rnd) => {
  vgrad(ctx, 0, 0, w, h, [[0, 0x070b22], [0.5, 0x0d1640], [1, 0x14214f]]);
  stars(ctx, rnd, w, 0, h, 50, 0x8fe8ff);
  ctx.globalCompositeOperation = 'lighter';
  for (const f of NERVE_FIBERS) {
    for (const [lw, a] of [[14, 0.06], [6, 0.18], [2.2, 0.75]] as [number, number][]) {
      ctx.strokeStyle = css(f.c, a); ctx.lineWidth = lw; ctx.beginPath();
      for (let y = -10; y <= h + 10; y += 10) { const x = fiberX(f.x, f.amp, f.per, f.ph, y); if (y === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
    }
    // miyelin boncukları ve Ranvier düğümleri
    for (let y = (f.ph * 40) % 60; y < h; y += 60) { const x = fiberX(f.x, f.amp, f.per, f.ph, y); glow(ctx, x, y, 9, f.c, 0.5); }
  }
  ctx.globalCompositeOperation = 'source-over';
};
export const NERVE_FIBERS = Array.from({ length: 16 }, (_, i) => { const r = rng(900 + i); return { x: 12 + i * 24.5 + (r() - 0.5) * 10, amp: 8 + r() * 18, per: 60 + r() * 60, ph: r() * 6, c: [0x4cf0ff, 0x7aa8ff, 0x9d7bff, 0x4cf0ff][i % 4]! }; });

const beyinSapi: Painter = (ctx, w, h, rnd) => {
  vgrad(ctx, 0, 0, w, h, [[0, 0x15112c], [0.5, 0x221b44], [1, 0x2f2660]]);
  stars(ctx, rnd, w, 0, h, 30, 0xffb3c4);
  // çapraz yollar (iki kulağın sesi burada buluşur)
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 6; k++) {
    const y = 40 + k * (h / 6); const c = k % 2 ? 0xff6b8b : 0x6bd7ff;
    for (const [lw, a] of [[10, 0.08], [3, 0.4]] as [number, number][]) {
      ctx.strokeStyle = css(c, a); ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(-10, y); ctx.bezierCurveTo(w * 0.35, y + 10, w * 0.65, y + h / 6 - 10, w + 10, y + h / 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w + 10, y); ctx.bezierCurveTo(w * 0.65, y + 10, w * 0.35, y + h / 6 - 10, -10, y + h / 6); ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  // köprüler (pons): taş kemerler
  for (let k = 0; k < 3; k++) {
    const y = h * (0.2 + k * 0.3);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
    ctx.strokeStyle = '#5b4a9e'; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(-20, y + 40); ctx.quadraticCurveTo(w / 2, y - 50, w + 20, y + 40); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = '#7c6bc4'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(-20, y + 36); ctx.quadraticCurveTo(w / 2, y - 54, w + 20, y + 36); ctx.stroke();
    for (let i = 0; i <= 10; i++) { const t = i / 10; const x = (1 - t) * (1 - t) * -20 + 2 * (1 - t) * t * (w / 2) + t * t * (w + 20); const yy = (1 - t) * (1 - t) * (y + 40) + 2 * (1 - t) * t * (y - 50) + t * t * (y + 40); ctx.strokeStyle = 'rgba(30,20,60,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, yy - 10); ctx.lineTo(x, yy + 10); ctx.stroke(); }
  }
  // çekirdekler (olivar kompleks): parlayan küreler
  for (let i = 0; i < 8; i++) { const x = rnd() < 0.5 ? 30 + rnd() * 60 : w - 30 - rnd() * 60; const y = rnd() * h; glow(ctx, x, y, 30, 0xff8fb1, 0.35); glow(ctx, x, y, 10, 0xffffff, 0.6); }
};

const korteks: Painter = (ctx, w, h, rnd) => {
  vgrad(ctx, 0, 0, w, h, [[0, 0xffc3d8], [0.5, 0xffd9e7], [1, 0xffeef5]]);
  // girus kıvrımları: kalın, gölgeli kıvrımlı şeritler
  for (let k = 0; k < Math.ceil(h / 120) + 1; k++) {
    const y0 = k * 120 + rnd() * 30;
    const p = () => { ctx.beginPath(); for (let x = -20; x <= w + 20; x += 6) { const y = y0 + Math.sin(x / 38 + k * 1.7) * 26 + Math.sin(x / 13 + k) * 6; if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y); } };
    ctx.lineCap = 'round';
    ctx.save(); ctx.translate(0, 8); p(); ctx.strokeStyle = 'rgba(190,80,120,0.25)'; ctx.lineWidth = 34; ctx.stroke(); ctx.restore();
    p(); ctx.strokeStyle = css(0xffb0c9, 0.9); ctx.lineWidth = 30; ctx.stroke();
    ctx.save(); ctx.translate(0, -7); p(); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 7; ctx.stroke(); ctx.restore();
  }
  // nöron ağı
  const ns = KORTEX_NEURONS(w, h);
  ctx.strokeStyle = 'rgba(124,92,255,0.35)'; ctx.lineWidth = 2;
  for (const [a, b] of ns.edges) { const p = ns.pts[a]!, q = ns.pts[b]!; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo((p.x + q.x) / 2 + 20, (p.y + q.y) / 2 - 10, q.x, q.y); ctx.stroke(); }
  for (const p of ns.pts) {
    for (let i = 0; i < 5; i++) { const a = rnd() * Math.PI * 2; hair(ctx, p.x, p.y, 14 + rnd() * 14, a, (rnd() - 0.5) * 0.9, 2, 'rgba(124,92,255,0.55)'); }
    glow(ctx, p.x, p.y, 22, 0xb69bff, 0.5); ctx.fillStyle = '#7c5cff'; ctx.beginPath(); ctx.moveTo(p.x, p.y - 9); ctx.lineTo(p.x + 8, p.y + 6); ctx.lineTo(p.x - 8, p.y + 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(p.x - 1, p.y, 2, 0, Math.PI * 2); ctx.fill();
  }
};
export function KORTEX_NEURONS(w: number, h: number) {
  const r = rng(4242); const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 16; i++) pts.push({ x: (i % 2 ? w - 30 - r() * 80 : 30 + r() * 80), y: 30 + (i / 16) * (h - 60) + r() * 30 });
  const edges: [number, number][] = []; for (let i = 0; i < pts.length - 1; i++) { edges.push([i, i + 1]); if (i + 2 < pts.length && r() < 0.5) edges.push([i, i + 2]); }
  return { pts, edges };
}

const finale: Painter = (ctx, w, h, rnd) => {
  vgrad(ctx, 0, 0, w, h, [[0, 0x150f3a], [0.45, 0x3a2470], [0.8, 0xc76aa8], [1, 0xffc3d8]]);
  stars(ctx, rnd, w, 0, h * 0.75, 70, 0xfff3c4);
  // ışık hüzmeleri
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.22; ctx.fillStyle = css(0xffd77a, 0.06); ctx.beginPath(); ctx.moveTo(w / 2, 250); ctx.lineTo(w / 2 + Math.cos(a - 0.06) * 600, 250 + Math.sin(a - 0.06) * 600); ctx.lineTo(w / 2 + Math.cos(a + 0.06) * 600, 250 + Math.sin(a + 0.06) * 600); ctx.closePath(); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
  // bulut tabanı
  for (let i = 0; i < 12; i++) { blob(ctx, (i / 11) * w, h - 60 + rnd() * 30, 60 + rnd() * 30, 34 + rnd() * 14, rnd, 0.15); ctx.fillStyle = css(0xffe6f0, 0.85); ctx.fill(); }
  for (let i = 0; i < 8; i++) note(ctx, 30 + rnd() * (w - 60), 80 + rnd() * (h - 240), 12 + rnd() * 8, css(0xfff3c4, 0.5));
};

const PAINTERS: Record<ZoneId, Painter> = {
  'dis-kulak': disKulak, kanal, zar, kemikcikler: kemik,
  'koklea-1': koklea(0, 0.33, [0xcfc3ff, 0xded6ff, 0xeee9ff]), 'koklea-2': koklea(0.33, 0.66, [0xdcbcf9, 0xead2fc, 0xf5e9ff]), 'koklea-3': koklea(0.66, 1, [0xffcfa0, 0xffe0c2, 0xfff1e3]),
  sinir, 'beyin-sapi': beyinSapi, korteks, finale,
};
/** bölge kenarının dalgalı alt çizgisi (alttaki bölgenin üstüne biner) */
const RIM: Record<ZoneId, number> = { 'dis-kulak': 0xd98a72, kanal: 0x1a0d09, zar: 0xc96a7f, kemikcikler: 0x9fb2c8, 'koklea-1': 0x8f78f0, 'koklea-2': 0xa86ad8, 'koklea-3': 0xe0954c, sinir: 0x2c4aa8, 'beyin-sapi': 0x6a55c0, korteks: 0xe27fa3, finale: 0xffd77a };

/** Bir bölgenin arka plan tuvali: [top, bottom + taşma] aralığı, S ölçeğinde. */
export function paintZone(L: MapLayout, z: MapZone, S: number, isFirst: boolean): HTMLCanvasElement {
  const w = L.width; const ov = isFirst ? 0 : ZONE_OVERLAP; const zh = z.bottom - z.top; const h = zh + ov;
  const { c, ctx } = makeCanvas(w * S, h * S); ctx.scale(S, S);
  const rnd = rng(z.top * 7 + z.id.length * 131);
  const edge = (x: number) => zh + ov * 0.45 + Math.sin(x / 42 + z.top) * ov * 0.22 + Math.sin(x / 17) * ov * 0.08;
  const shape = () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); if (!ov) { ctx.lineTo(w, h); ctx.lineTo(0, h); } else for (let x = w; x >= 0; x -= 6) ctx.lineTo(x, edge(x)); ctx.closePath(); };
  ctx.save(); shape(); ctx.clip();
  PAINTERS[z.id](ctx, w, h, rnd, z, L);
  road(ctx, L, z.top, z.bottom + ov, z.top, z.id);
  ctx.restore();
  if (ov) {
    // zar gibi bir kenar: gölge + koyu çizgi + ışıltı
    const line = (dy: number, lw: number, col: string) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); for (let x = -6; x <= w + 6; x += 6) { const y = edge(x) + dy; if (x === -6) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); };
    line(6, 10, 'rgba(20,10,40,0.18)'); line(0, 6, css(RIM[z.id], 0.9)); line(-3, 2, 'rgba(255,255,255,0.35)');
  }
  return c;
}
