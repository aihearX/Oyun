/**
 * Kulak Kampı süslemeleri (docs/14-kamp.md §10): odyoloji temalı küçük yapılar. Saf Canvas 2D, kamp boyama dili (gün batımı
 * ışığı solda, mor gölge sağda, ince koyu kontur). Orijin = kapladığı hücrelerin zemin merkezi; birim dünya birimi.
 * 1×1 süs bir hücreye (ekranda 32×16), 2×2 süs dört hücreye oturur.
 */
import { P, box, css, cyl, earGlyph, ellipseShadow, roundRect, shade, sparkle, type Ctx } from './paint';

const INK = 'rgba(38,20,44,0.6)';
/** doku kutusu (dünya birimi): genişlik, yükseklik, orijin */
export const DECOR_BOX = { 1: { w: 48, h: 74, ox: 24, oy: 60 }, 2: { w: 86, h: 100, ox: 43, oy: 78 } } as const;

function plinth(ctx: Ctx, r: number, color = 0xd9cdb8) {
  ellipseShadow(ctx, 0, 1, r + 2, (r + 2) / 2, 0.3);
  cyl(ctx, 0, 0, 0, r, 3, color, 'stone', { seed: 3 });
}
function metal(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, color: number) {
  const g = ctx.createLinearGradient(x0 - w, 0, x0 + w, 0); g.addColorStop(0, css(shade(color, 0.45))); g.addColorStop(0.5, css(color)); g.addColorStop(1, css(shade(color, -0.35)));
  ctx.strokeStyle = g; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}
function bulb(ctx: Ctx, x: number, y: number, r: number, color: number) {
  ctx.save(); ctx.shadowColor = css(color, 0.95); ctx.shadowBlur = r * 3;
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, css(color)); g.addColorStop(1, css(shade(color, -0.2)));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore();
}
function flowerDot(ctx: Ctx, x: number, y: number, c: number, r = 1.6) {
  ctx.fillStyle = '#3d8a3a'; ctx.fillRect(x - 0.3, y, 0.6, 3);
  ctx.fillStyle = css(c); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.5, r * 0.6, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, 7); ctx.fill();
}
function soil(ctx: Ctx, rx: number, ry: number, color = 0x7a4a2a) {
  ellipseShadow(ctx, 0, 1, rx + 1, ry + 1, 0.25);
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.fillStyle = css(color); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -0.8, rx - 1.2, ry - 0.8, 0, 0, 7); ctx.fillStyle = css(shade(color, 0.12)); ctx.fill();
}

// ---------------------------------------------------------------- çizimler
function diyapazon(ctx: Ctx, gold = false) {
  plinth(ctx, 9, gold ? 0xf3e2b8 : 0xd9cdb8);
  const c = gold ? 0xf5c542 : 0xb9c3d6;
  metal(ctx, 0, -3, 0, -16, 3.2, c); // sap
  ctx.beginPath(); ctx.moveTo(-6, -38); ctx.lineTo(-6, -22); ctx.quadraticCurveTo(-6, -15, 0, -15); ctx.quadraticCurveTo(6, -15, 6, -22); ctx.lineTo(6, -38);
  const g = ctx.createLinearGradient(-8, 0, 8, 0); g.addColorStop(0, css(shade(c, 0.5))); g.addColorStop(0.5, css(c)); g.addColorStop(1, css(shade(c, -0.35)));
  ctx.strokeStyle = g; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke();
  // titreşim yayları
  ctx.strokeStyle = gold ? 'rgba(255,214,107,0.8)' : 'rgba(125,243,255,0.7)'; ctx.lineWidth = 1;
  for (const s of [-1, 1]) for (const r of [4, 7]) { ctx.beginPath(); ctx.arc(s * 6, -31, r, s < 0 ? Math.PI * 0.75 : -Math.PI * 0.25, s < 0 ? Math.PI * 1.25 : Math.PI * 0.25); ctx.stroke(); }
  ctx.fillStyle = gold ? '#7a5a10' : '#4a5470'; ctx.font = '700 4px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('512', 0, -6.5);
  if (gold) { sparkle(ctx, -8, -40, 2.2); sparkle(ctx, 9, -27, 1.6); }
}
function odyogramTarhi(ctx: Ctx) {
  // ahşap çerçeveli tarh; çiçekler odyogram ızgarasında: kırmızı O (sağ), mavi X (sol)
  ellipseShadow(ctx, 0, 2, 16, 8, 0.25);
  box(ctx, -12, -12, 0, 24, 24, 3, { color: 0x9a6a3e, pattern: 'plank', seed: 4 });
  ctx.save(); ctx.beginPath(); const q = [P(-11, -11, 3), P(11, -11, 3), P(11, 11, 3), P(-11, 11, 3)]; q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = '#6b4226'; ctx.fill(); ctx.clip();
  ctx.strokeStyle = 'rgba(255,240,210,0.35)'; ctx.lineWidth = 0.5;
  for (let k = -8; k <= 8; k += 4) { ctx.beginPath(); ctx.moveTo(...P(k, -11, 3)); ctx.lineTo(...P(k, 11, 3)); ctx.moveTo(...P(-11, k, 3)); ctx.lineTo(...P(11, k, 3)); ctx.stroke(); }
  ctx.restore();
  const pts: [number, number][] = [[-8, -7], [-4, -5], [0, -2], [4, 2], [8, 6]];
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = '#e0413a'; ctx.beginPath(); pts.forEach(([u, v], i) => { const [x, y] = P(u, v - 3, 6); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
  ctx.strokeStyle = '#2f6fe0'; ctx.beginPath(); pts.forEach(([u, v], i) => { const [x, y] = P(u, v + 3, 6); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
  for (const [u, v] of pts) {
    const [x, y] = P(u, v - 3, 6); ctx.strokeStyle = '#3d8a3a'; ctx.beginPath(); ctx.moveTo(x, y + 3); ctx.lineTo(x, y); ctx.stroke();
    ctx.strokeStyle = '#ff5a52'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y - 1, 1.6, 0, 7); ctx.stroke(); ctx.lineWidth = 0.8;
    const [x2, y2] = P(u, v + 3, 6); ctx.strokeStyle = '#3d8a3a'; ctx.beginPath(); ctx.moveTo(x2, y2 + 3); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = '#3b7bff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x2 - 1.5, y2 - 2.5); ctx.lineTo(x2 + 1.5, y2 + 0.5); ctx.moveTo(x2 + 1.5, y2 - 2.5); ctx.lineTo(x2 - 1.5, y2 + 0.5); ctx.stroke(); ctx.lineWidth = 0.8;
  }
}
function stereosilya(ctx: Ctx) {
  soil(ctx, 12, 6, 0x5d8f3e);
  // üç sıra, basamaklı boy (kısa → uzun), uçlarında bağlantı
  for (let row = 0; row < 3; row++) {
    const tops: [number, number][] = [];
    for (let i = 0; i < 5; i++) {
      const x = -8 + i * 4 + row * 1.5, y = -1 + row * 2.2; const h = 6 + i * 3.2;
      const g = ctx.createLinearGradient(x - 1, 0, x + 1, 0); g.addColorStop(0, '#d8ffe8'); g.addColorStop(1, '#4fbf86');
      ctx.strokeStyle = g; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.6, y - h); ctx.stroke();
      tops.push([x + 0.6, y - h]);
    }
    ctx.strokeStyle = 'rgba(255,240,160,0.9)'; ctx.lineWidth = 0.5;
    for (let i = 0; i < tops.length - 1; i++) { const [a, b] = [tops[i]!, tops[i + 1]!]; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0] - 0.4, b[1] + 3); ctx.stroke(); }
  }
}
function kemikcikBanki(ctx: Ctx, dede = false) {
  ellipseShadow(ctx, 0, 2, 17, 7, 0.28);
  const bone = dede ? 0xd9a066 : 0xf3e2b8;
  // ayaklar: çekiç ve üzengi biçimi
  const [l0, l1] = [P(-10, 4, 0), P(10, -4, 0)];
  ctx.fillStyle = css(shade(bone, -0.15)); ctx.strokeStyle = INK; ctx.lineWidth = 0.6;
  for (const [x, y] of [l0, l1]) { ctx.beginPath(); ctx.moveTo(x - 2.5, y); ctx.lineTo(x - 1.6, y - 7); ctx.lineTo(x + 1.6, y - 7); ctx.lineTo(x + 2.5, y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  // oturak (örs gövdesi gibi kavisli)
  const a = P(-13, 5, 7), b = P(13, -5, 7);
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 2, b[0], b[1]); ctx.lineTo(b[0] + 3, b[1] - 3); ctx.quadraticCurveTo((a[0] + b[0]) / 2 + 3, (a[1] + b[1]) / 2 - 1, a[0] + 3, a[1] - 3); ctx.closePath();
  const g = ctx.createLinearGradient(a[0], 0, b[0], 0); g.addColorStop(0, css(shade(bone, 0.25))); g.addColorStop(1, css(shade(bone, -0.2)));
  ctx.fillStyle = g; ctx.fill(); ctx.stroke();
  // sırtlık: üzengi kemeri
  const [sx, sy] = P(4, -9, 9);
  ctx.beginPath(); ctx.moveTo(sx - 12, sy + 6); ctx.quadraticCurveTo(sx - 8, sy - 10, sx, sy - 12); ctx.quadraticCurveTo(sx + 8, sy - 10, sx + 9, sy - 2);
  ctx.strokeStyle = css(bone); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke();
  if (dede) { // Tüy Dede bankı: tüy işareti
    ctx.save(); ctx.translate(sx, sy - 16); ctx.rotate(-0.4); ctx.fillStyle = '#fff6e5'; ctx.beginPath(); ctx.ellipse(0, 0, 2.2, 6, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#c98e55'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -6); ctx.stroke(); ctx.restore();
  }
}
function otoskopLamba(ctx: Ctx) {
  plinth(ctx, 6, 0x9aa6b8);
  metal(ctx, 0, -3, 0, -30, 2.4, 0x5d6d82);
  // otoskop başı: sap üstünde koni (spekulum) ve büyüteç
  ctx.save(); ctx.translate(0, -34); ctx.rotate(-0.35);
  roundRect(ctx, -4, -4, 8, 8, 2); ctx.fillStyle = '#2d3a4e'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, -2.5); ctx.lineTo(12, -1); ctx.lineTo(12, 1); ctx.lineTo(4, 2.5); ctx.closePath(); ctx.fillStyle = '#e8eef6'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(-4.5, 0, 3, 0, 7); ctx.fillStyle = 'rgba(160,220,255,0.75)'; ctx.fill(); ctx.stroke();
  ctx.restore();
  bulb(ctx, 10, -36, 2.4, 0xfff0b0);
}
function dalgaCit(ctx: Ctx) {
  ellipseShadow(ctx, 0, 1, 16, 6, 0.2);
  // sinüs biçimli ahşap çit, iki direk arasında
  const a = P(-14, 6, 0), b = P(14, -6, 0);
  ctx.strokeStyle = '#6b3f22'; ctx.lineWidth = 2;
  for (const [x, y] of [a, b]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 14); ctx.stroke(); ctx.fillStyle = '#ffc93c'; ctx.beginPath(); ctx.arc(x, y - 15, 1.6, 0, 7); ctx.fill(); }
  for (const [off, col] of [[-10, 0xffc93c], [-5, 0xff9f1c]] as const) {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const t = i / 24; const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t + off + Math.sin(t * Math.PI * 4) * 3; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.strokeStyle = css(shade(col, -0.35)); ctx.lineWidth = 2.6; ctx.stroke(); ctx.strokeStyle = css(col); ctx.lineWidth = 1.6; ctx.stroke();
  }
}
function kokleaCesme(ctx: Ctx) {
  ellipseShadow(ctx, 0, 2, 16, 8, 0.28);
  cyl(ctx, 0, 0, 0, 14, 4, 0xcfc4ad, 'stone', { top: null, seed: 8 });
  ctx.beginPath(); ctx.ellipse(0, -4, 12, 6, 0, 0, 7); const w = ctx.createLinearGradient(0, -10, 0, 2); w.addColorStop(0, '#7fe7f2'); w.addColorStop(1, '#2f9fc8'); ctx.fillStyle = w; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
  // 2,5 tur sarmal (koklea)
  ctx.beginPath();
  for (let i = 0; i <= 90; i++) { const t = i / 90; const ang = t * Math.PI * 5; const r = 9 * (1 - t * 0.85); const x = Math.cos(ang) * r, y = -12 - t * 18 + Math.sin(ang) * r * 0.45; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.strokeStyle = '#1b8f9a'; ctx.lineWidth = 4.4; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = '#2ee6d6'; ctx.lineWidth = 2.8; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.8; ctx.stroke();
  metal(ctx, 0, -5, 0, -12, 2.2, 0xcfc4ad);
  // su damlaları
  ctx.fillStyle = 'rgba(200,250,255,0.9)'; for (const [x, y] of [[-3, -33], [2, -36], [5, -30]] as const) { ctx.beginPath(); ctx.arc(x, y, 0.9, 0, 7); ctx.fill(); }
}
function kulaklikSalincak(ctx: Ctx) {
  ellipseShadow(ctx, 0, 2, 16, 7, 0.25);
  // A-çerçeve
  const L = P(-12, 4, 0), R = P(12, -4, 0); const top = -36;
  ctx.strokeStyle = '#6b3f22'; ctx.lineWidth = 2;
  for (const [x, y] of [L, R]) { ctx.beginPath(); ctx.moveTo(x - 4, y + 1); ctx.lineTo(x, top + (y - L[1]) * 0.3); ctx.lineTo(x + 4, y - 1); ctx.stroke(); }
  ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(L[0], top + 0); ctx.lineTo(R[0], top + (R[1] - L[1]) * 0.3); ctx.stroke();
  // kulaklık bandı + iki kulak yastığı oturak gibi asılı
  ctx.beginPath(); ctx.moveTo(-6, top + 1); ctx.quadraticCurveTo(0, top - 5, 6, top - 2); ctx.strokeStyle = '#8b6bff'; ctx.lineWidth = 2.6; ctx.stroke();
  ctx.strokeStyle = '#3b2a6e'; ctx.lineWidth = 0.6; for (const x of [-6, 6]) { ctx.beginPath(); ctx.moveTo(x, top + 1); ctx.lineTo(x, -12); ctx.stroke(); }
  for (const [x, col] of [[-6, 0x2f6fe0], [6, 0xe0413a]] as const) { ctx.beginPath(); ctx.ellipse(x, -10, 4.2, 3, 0, 0, 7); ctx.fillStyle = css(col); ctx.fill(); ctx.strokeStyle = INK; ctx.stroke(); ctx.beginPath(); ctx.ellipse(x, -11, 2.6, 1.6, 0, 0, 7); ctx.fillStyle = css(shade(col, 0.35)); ctx.fill(); }
}
function kepceCardak(ctx: Ctx) {
  ellipseShadow(ctx, 0, 3, 32, 15, 0.3);
  box(ctx, -24, -24, 0, 48, 48, 3, { color: 0xd9c3a0, pattern: 'stone', seed: 6 });
  // dört direk
  for (const [u, v] of [[-20, -20], [20, -20], [-20, 20], [20, 20]] as const) { const [x, y] = P(u, v, 3); metal(ctx, x, y, x, y - 40, 2.2, 0xf6efe4); }
  // kulak kepçesi biçimli çatı (heliks kıvrımı)
  const [cx, cy] = P(0, 0, 40);
  ctx.save(); ctx.translate(cx, cy + 2); ctx.scale(1.9, 1.25);
  ctx.beginPath(); ctx.moveTo(4, 9); ctx.bezierCurveTo(-1, 13, -14, 9, -14, 0); ctx.bezierCurveTo(-14, -9, -4, -13, 3, -12); ctx.bezierCurveTo(12, -10, 13, -2, 9, 3); ctx.bezierCurveTo(6, 6, 7, 9, 4, 9); ctx.closePath();
  const g = ctx.createLinearGradient(-14, -12, 12, 9); g.addColorStop(0, '#ffe0cf'); g.addColorStop(0.5, '#f5b49b'); g.addColorStop(1, '#c97a86');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(110,50,70,0.6)'; ctx.lineWidth = 0.9; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-5, 5); ctx.bezierCurveTo(-8, 0, -6, -7, 1, -7); ctx.bezierCurveTo(7, -7, 7, -1, 3, 0); ctx.strokeStyle = 'rgba(190,100,110,0.8)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  // fenerler
  bulb(ctx, P(-20, 20, 30)[0], P(-20, 20, 30)[1] + 3, 1.6, 0xffd36b); bulb(ctx, P(20, 20, 30)[0], P(20, 20, 30)[1] + 3, 1.6, 0xffd36b);
}
function cihazSaksi(ctx: Ctx) {
  ellipseShadow(ctx, 0, 1, 10, 5, 0.25);
  // kulak arkası cihaz biçimli saksı (muz biçimi) + hortum kulpu
  ctx.beginPath(); ctx.moveTo(-8, -2); ctx.bezierCurveTo(-10, -14, -4, -22, 3, -22); ctx.bezierCurveTo(8, -22, 9, -16, 7, -10); ctx.bezierCurveTo(6, -5, 4, -1, -1, 0); ctx.closePath();
  const g = ctx.createLinearGradient(-9, 0, 9, 0); g.addColorStop(0, '#f1d9ff'); g.addColorStop(1, '#9c6ac8'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3, -22); ctx.quadraticCurveTo(14, -26, 11, -12); ctx.strokeStyle = '#e8e0f0'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(1, -21, 5.5, 2.2, 0, 0, 7); ctx.fillStyle = '#6b4226'; ctx.fill();
  flowerDot(ctx, -1, -27, 0xff8fb1, 2); flowerDot(ctx, 3, -25, 0xffc93c, 1.6); flowerDot(ctx, -4, -24, 0x8b6bff, 1.5);
  ctx.fillStyle = '#5b3a7a'; for (const y of [-14, -10]) { ctx.beginPath(); ctx.arc(-5.5, y, 0.8, 0, 7); ctx.fill(); }
}
function kanalHeykel(ctx: Ctx) {
  plinth(ctx, 9, 0xbfd9e0);
  // üç yarım daire kanalı: birbirine dik üç halka (önden, yandan, yatay)
  const cx = 0, cy = -24; const cols = [0x7df3ff, 0x8b6bff, 0x3ccf7e];
  const ring = (rx: number, ry: number, rot: number, c: number) => { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, rot, 0, 7); ctx.strokeStyle = css(shade(c, -0.35)); ctx.lineWidth = 3.4; ctx.stroke(); ctx.strokeStyle = css(c); ctx.lineWidth = 2.2; ctx.stroke(); };
  ring(12, 5, 0, cols[0]!); ring(5, 12, 0.5, cols[1]!); ring(11, 11, 0, cols[2]!);
  ctx.beginPath(); ctx.arc(cx, cy + 10, 3.4, 0, 7); ctx.fillStyle = '#e8f6ff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
  metal(ctx, 0, -3, 0, -10, 2.2, 0xbfd9e0);
}
function tuyLamba(ctx: Ctx) {
  soil(ctx, 8, 4, 0x6b8f4e);
  // tüy hücresi: gövde (armut) + tepede basamaklı stereosilya + ışık
  ctx.beginPath(); ctx.moveTo(-4, -2); ctx.bezierCurveTo(-6, -12, -5, -22, 0, -24); ctx.bezierCurveTo(5, -22, 6, -12, 4, -2); ctx.closePath();
  const g = ctx.createLinearGradient(-6, 0, 6, 0); g.addColorStop(0, '#fff6d0'); g.addColorStop(1, '#e0b84a'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -10, 2.2, 0, 7); ctx.fillStyle = '#c98e2a'; ctx.fill();
  for (let i = 0; i < 4; i++) { const x = -3 + i * 2; ctx.strokeStyle = '#fff3a0'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(x, -24); ctx.lineTo(x + 0.5, -27 - i * 2.2); ctx.stroke(); bulb(ctx, x + 0.5, -27.5 - i * 2.2, 0.9, 0xfff0a0); }
}
function tikacPuf(ctx: Ctx) {
  ellipseShadow(ctx, 0, 2, 13, 6, 0.25);
  // iki köpük kulak tıkacı pufu (silindir, yuvarlak uçlu)
  for (const [u, v, h, c] of [[-5, 4, 12, 0xff9f1c], [6, -4, 9, 0xffc93c]] as const) {
    cyl(ctx, u, v, 0, 6, h, c, 'plain', { top: null });
    const [x, y] = P(u, v, h); ctx.beginPath(); ctx.ellipse(x, y, 6, 3, 0, 0, 7); ctx.fillStyle = css(shade(c, 0.25)); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x - 3 + (i % 3) * 3, y - 0.5 + Math.floor(i / 3) * 1.4, 0.5, 0, 7); ctx.fill(); }
  }
}
function dalgaHavuz(ctx: Ctx) {
  ellipseShadow(ctx, 0, 3, 34, 17, 0.25);
  ctx.beginPath(); ctx.ellipse(0, 0, 32, 16, 0, 0, 7); ctx.fillStyle = '#9a8a74'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -1, 28, 13.5, 0, 0, 7); const w = ctx.createRadialGradient(-6, -4, 2, 0, 0, 30); w.addColorStop(0, '#9ff3ff'); w.addColorStop(1, '#2f8fc8'); ctx.fillStyle = w; ctx.fill();
  ctx.strokeStyle = 'rgba(230,255,255,0.8)'; ctx.lineWidth = 1; for (const r of [4, 9, 14, 19, 24]) { ctx.globalAlpha = 1 - r / 30; ctx.beginPath(); ctx.ellipse(-2, -1, r, r / 2, 0, 0, 7); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; ctx.fillStyle = css(shade(0xcdb08a, (i % 3) * 0.08)); ctx.beginPath(); ctx.ellipse(Math.cos(a) * 30, Math.sin(a) * 15, 3.4, 2, 0, 0, 7); ctx.fill(); }
  // nilüfer
  ctx.fillStyle = '#5fae4a'; ctx.beginPath(); ctx.ellipse(12, 3, 4, 2, 0, 0.3, 6); ctx.fill(); ctx.fillStyle = '#ff8fb1'; ctx.beginPath(); ctx.arc(12, 2, 1.4, 0, 7); ctx.fill();
}
function desibelSutun(ctx: Ctx) {
  ellipseShadow(ctx, 0, 2, 14, 6, 0.25);
  const cols = [0x3ccf7e, 0x8ef0b0, 0xffc93c, 0xff9f1c, 0xff5c5c];
  cols.forEach((c, i) => { const u = -10 + i * 5, v = 4 - i * 2; box(ctx, u, v, 0, 4, 4, 6 + i * 6, { color: c, pattern: 'plain' }); });
  const [x, y] = P(10, -6, 32); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2d1d6e'; ctx.lineWidth = 2; ctx.font = '900 6px sans-serif'; ctx.textAlign = 'center'; ctx.strokeText('dB', x, y - 2); ctx.fillText('dB', x, y - 2);
}
function implantHeykel(ctx: Ctx) {
  plinth(ctx, 8, 0xcfd6e8);
  metal(ctx, 0, -3, 0, -12, 2.4, 0x9aa6c4);
  // dış bobin (yuvarlak) + mıknatıs + kabloyla işlemci
  ctx.beginPath(); ctx.arc(0, -24, 10, 0, 7); const g = ctx.createRadialGradient(-3, -27, 1, 0, -24, 11); g.addColorStop(0, '#a8b4ff'); g.addColorStop(1, '#3b48b8'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -24, 6.5, 0, 7); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -24, 3, 0, 7); ctx.fillStyle = '#c9cede'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, -18); ctx.quadraticCurveTo(14, -12, 12, -5); ctx.strokeStyle = '#2d3a4e'; ctx.lineWidth = 1.2; ctx.stroke();
  // elektrot sarmalı ışıkları
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 0.9; bulb(ctx, Math.cos(a) * 13, -24 + Math.sin(a) * 13, 0.9, 0x7df3ff); }
}
function notaAgaci(ctx: Ctx) {
  ellipseShadow(ctx, 0, 1, 10, 5, 0.25);
  ctx.strokeStyle = '#6b3f22'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-2, -12, 0, -22); ctx.stroke();
  // tonotopi: alt dallar kalın/pes (koyu, büyük), üst dallar ince/tiz (açık, küçük)
  const layers: [number, number, number][] = [[-14, 13, 0x8b2f5a], [-22, 11, 0xc94a7a], [-29, 9, 0xff6f9f], [-35, 7, 0xff9fc0], [-40, 5, 0xffd0e0]];
  for (const [y, r, c] of layers) { ctx.beginPath(); ctx.ellipse(0, y, r, r * 0.55, 0, 0, 7); const g = ctx.createLinearGradient(-r, y - r, r, y + r); g.addColorStop(0, css(shade(c, 0.25))); g.addColorStop(1, css(shade(c, -0.25))); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke(); }
  ctx.fillStyle = '#2d1d6e'; for (const [x, y] of [[-6, -15], [5, -23], [-3, -30], [2, -36]] as const) { ctx.beginPath(); ctx.ellipse(x, y, 1.2, 0.9, -0.3, 0, 7); ctx.fill(); ctx.fillRect(x + 0.9, y - 4, 0.5, 4); }
}
function ostakiKemer(ctx: Ctx) {
  ellipseShadow(ctx, 0, 2, 16, 7, 0.25);
  // eğik tüp biçimli kemer: bir ucu dar (kemik), bir ucu geniş (kıkırdak)
  const a = P(-12, 5, 0), b = P(12, -5, 0);
  ctx.beginPath(); ctx.moveTo(a[0] - 3, a[1]); ctx.bezierCurveTo(a[0] - 2, a[1] - 34, b[0] + 1, b[1] - 34, b[0] + 6, b[1]); ctx.lineTo(b[0] - 1, b[1]); ctx.bezierCurveTo(b[0] - 4, b[1] - 24, a[0] + 3, a[1] - 26, a[0] + 3, a[1]); ctx.closePath();
  const g = ctx.createLinearGradient(a[0], 0, b[0], 0); g.addColorStop(0, '#e6d4ff'); g.addColorStop(1, '#9a6fe0'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.8; for (let t = 0.2; t < 0.9; t += 0.15) { const x = a[0] + (b[0] - a[0]) * t, y = Math.min(a[1], b[1]) - 26 * Math.sin(Math.PI * t); ctx.beginPath(); ctx.arc(x, y, 1.6 + t * 2, 0, Math.PI); ctx.stroke(); }
}
function isikFeneri(ctx: Ctx) {
  plinth(ctx, 6);
  metal(ctx, 0, -3, 0, -20, 2.4, 0x8a8274);
  // inci grisi zar diski + ön-alt kadranda ışık üçgeni
  ctx.beginPath(); ctx.ellipse(0, -30, 9, 10, 0, 0, 7); const g = ctx.createRadialGradient(-2, -32, 1, 0, -30, 10); g.addColorStop(0, '#f8f6ff'); g.addColorStop(1, '#bdb6d6'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#8a7ea8'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.strokeStyle = 'rgba(120,110,150,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(1, -29); ctx.stroke(); // çekiç sapı
  ctx.save(); ctx.shadowColor = 'rgba(255,250,200,1)'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.moveTo(1, -29); ctx.lineTo(6, -24); ctx.lineTo(2, -22); ctx.closePath(); ctx.fillStyle = '#fffbe0'; ctx.fill(); ctx.restore();
}
function altinKulak(ctx: Ctx) {
  ellipseShadow(ctx, 0, 3, 30, 14, 0.3);
  box(ctx, -18, -18, 0, 36, 36, 6, { color: 0xf6efe4, pattern: 'marble', seed: 2 });
  // iki altın kulak sırt sırta (iki kulakla duymak)
  for (const s of [-1, 1] as const) {
    ctx.save(); ctx.translate(s * 11, -40); ctx.scale(s * 1.4, 1.4);
    earGlyph(ctx, 0, 0, 22, 0xf5c542, 0xb8860b, 1);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(255,214,107,0.8)'; ctx.lineWidth = 1; for (const r of [6, 11]) { ctx.beginPath(); ctx.arc(0, -40, r, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke(); }
  sparkle(ctx, -18, -58, 2.4); sparkle(ctx, 16, -54, 1.8); sparkle(ctx, 0, -64, 1.6);
}
function heschlKemer(ctx: Ctx) {
  ellipseShadow(ctx, 0, 3, 32, 14, 0.3);
  // iki sütunlu kemer; tepede beyin silueti, şakak lobunda parlayan Heschl girusu
  for (const [u, v] of [[-18, 10], [18, -10]] as const) { box(ctx, u - 4, v - 4, 0, 8, 8, 34, { color: 0xf6efe4, pattern: 'marble', seed: 5 }); }
  const [x0, y0] = P(-18, 10, 34), [x1, y1] = P(18, -10, 34);
  ctx.beginPath(); ctx.moveTo(x0 - 4, y0); ctx.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - 18, x1 + 4, y1); ctx.strokeStyle = '#e8dfcf'; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
  const bx = (x0 + x1) / 2, by = Math.min(y0, y1) - 22;
  ctx.beginPath(); ctx.ellipse(bx, by, 13, 9, 0, 0, 7); const g = ctx.createLinearGradient(bx - 13, by - 9, bx + 13, by + 9); g.addColorStop(0, '#ffd0e0'); g.addColorStop(1, '#d9708f'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(120,40,70,0.6)'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.strokeStyle = 'rgba(150,50,90,0.6)'; ctx.lineWidth = 0.8; for (const [dx, dy] of [[-6, -3], [0, -5], [5, -2], [-2, 2]] as const) { ctx.beginPath(); ctx.arc(bx + dx, by + dy, 3, 0.3, Math.PI); ctx.stroke(); }
  ctx.save(); ctx.shadowColor = 'rgba(255,240,140,1)'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.ellipse(bx + 3, by + 3.5, 4, 1.6, -0.3, 0, 7); ctx.fillStyle = '#fff3a0'; ctx.fill(); ctx.restore();
}
function vakaPanosu(ctx: Ctx) {
  ellipseShadow(ctx, 0, 2, 12, 5, 0.25);
  ctx.strokeStyle = '#6b3f22'; ctx.lineWidth = 1.8; for (const x of [-8, 8]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x * 0.9, -30); ctx.stroke(); }
  roundRect(ctx, -11, -36, 22, 18, 1.5); ctx.fillStyle = '#c98e55'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
  roundRect(ctx, -9.5, -34.5, 11, 15, 0.8); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.strokeStyle = '#d9d4ee'; ctx.lineWidth = 0.3; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-9, -34 + i * 3); ctx.lineTo(1, -34 + i * 3); ctx.stroke(); }
  ctx.strokeStyle = '#e0413a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-8, -32); ctx.lineTo(-5, -30); ctx.lineTo(-2, -27); ctx.lineTo(0, -23); ctx.stroke();
  ctx.fillStyle = '#9fd8ff'; roundRect(ctx, 2.5, -34, 7, 6, 0.6); ctx.fill(); ctx.fillStyle = '#ffd36b'; roundRect(ctx, 2.5, -26.5, 7, 6, 0.6); ctx.fill();
  ctx.fillStyle = '#ff5c8a'; for (const [x, y] of [[-4, -35], [6, -34.5]] as const) { ctx.beginPath(); ctx.arc(x, y, 0.9, 0, 7); ctx.fill(); }
}

const PAINT: Record<string, (ctx: Ctx) => void> = {
  diyapazon: (c) => diyapazon(c), 'odyogram-tarhi': odyogramTarhi, stereosilya, 'kemikcik-banki': (c) => kemikcikBanki(c), 'otoskop-lamba': otoskopLamba,
  'dalga-cit': dalgaCit, 'koklea-cesme': kokleaCesme, 'kulaklik-salincak': kulaklikSalincak, 'kepce-cardak': kepceCardak, 'cihaz-saksi': cihazSaksi,
  'kanal-heykel': kanalHeykel, 'tuy-lamba': tuyLamba, 'tikac-puf': tikacPuf, 'dalga-havuz': dalgaHavuz, 'desibel-sutun': desibelSutun,
  'implant-heykel': implantHeykel, 'nota-agaci': notaAgaci, 'ostaki-kemer': ostakiKemer, 'isik-feneri': isikFeneri, 'altin-diyapazon': (c) => diyapazon(c, true),
  'altin-kulak': altinKulak, 'heschl-kemer': heschlKemer, 'vaka-panosu': vakaPanosu, 'dede-banki': (c) => kemikcikBanki(c, true),
};
/** süsü çiz (orijin = zemin merkezi) */
export function paintDecor(ctx: Ctx, id: string): void { ctx.save(); ctx.lineJoin = 'round'; (PAINT[id] ?? diyapazon)(ctx); ctx.restore(); }
export const hasDecorArt = (id: string) => !!PAINT[id];
/** bağımsız tuval (React envanter kartı) */
export function decorCanvas(id: string, size: 1 | 2, scale = 2): HTMLCanvasElement {
  const b = DECOR_BOX[size]; const c = document.createElement('canvas'); c.width = Math.ceil(b.w * scale); c.height = Math.ceil(b.h * scale);
  const ctx = c.getContext('2d')!; ctx.scale(scale, scale); ctx.translate(b.ox, b.oy); paintDecor(ctx, id); return c;
}
