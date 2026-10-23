import type Phaser from 'phaser';
/**
 * Kamp süsleri ve efekt dokuları (Canvas 2D → Phaser dokusu, bir kez üretilir).
 * Ağaçlar (yuvarlak, kıl hücresi "kıl ağacı", çam), nota çiçekleri, kaya, çit, fener, heykel, çeşme, köprü, iskele,
 * sis bulutu, duman, ışık hâlesi, dalga halkası, nota, jeton, kalp, el, parıltı, dişli, iskele/vinç, işçi Odi, rozet.
 */
import { P, box, css, earGlyph, gear, lantern, mix, rng, roundRect, shade, sparkle, type Ctx } from './paint';
import { heartShape } from './buildings';

export const TEX = 2; // piksel / dünya birimi

/** dünya biriminde (w×h) ve orijin (ox,oy) ile tuval çizip doku olarak kaydet */
export function makeTex(textures: { exists(k: string): boolean; addCanvas(k: string, c: HTMLCanvasElement): unknown }, key: string, w: number, h: number, ox: number, oy: number, draw: (ctx: Ctx) => void, scale = TEX): string {
  if (textures.exists(key)) return key;
  const c = document.createElement('canvas'); c.width = Math.ceil(w * scale); c.height = Math.ceil(h * scale);
  const ctx = c.getContext('2d')!; ctx.scale(scale, scale); ctx.translate(ox, oy); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  draw(ctx); textures.addCanvas(key, c);
  return key;
}

export interface PropDef { key: string; w: number; h: number; ox: number; oy: number; draw: (ctx: Ctx) => void }
const def = (key: string, w: number, h: number, ox: number, oy: number, draw: (ctx: Ctx) => void): PropDef => ({ key, w, h, ox, oy, draw });

function blobShadow(ctx: Ctx, rx: number, ry: number, a = 0.3) { ctx.save(); ctx.fillStyle = `rgba(28,12,48,${a})`; ctx.beginPath(); ctx.ellipse(rx * 0.25, 0, rx, ry, 0, 0, 7); ctx.fill(); ctx.restore(); }

/** yuvarlak taçlı ağaç (sıcak alacakaranlık ışığı) */
function roundTree(ctx: Ctx, s: number, col: number, seed: number) {
  const r = rng(seed);
  blobShadow(ctx, 14 * s, 6 * s);
  ctx.fillStyle = '#6b3f2a'; ctx.beginPath(); ctx.moveTo(-2 * s, 0); ctx.lineTo(-1.4 * s, -16 * s); ctx.lineTo(1.4 * s, -16 * s); ctx.lineTo(2 * s, 0); ctx.closePath(); ctx.fill();
  const blobs: [number, number, number][] = [[0, -26, 12], [-8, -20, 9], [8, -21, 9], [-4, -32, 8], [5, -31, 8], [0, -18, 9]];
  for (const [x, y, rr] of blobs) { ctx.beginPath(); ctx.arc(x * s, y * s, rr * s, 0, 7); ctx.fillStyle = css(mix(shade(col, -0.3), 0x3b2a6e, 0.3)); ctx.fill(); }
  for (const [x, y, rr] of blobs) { const g = ctx.createRadialGradient((x - rr * 0.4) * s, (y - rr * 0.5) * s, 1, x * s, y * s, rr * s); g.addColorStop(0, css(mix(shade(col, 0.35), 0xffc070, 0.2))); g.addColorStop(1, css(col)); ctx.beginPath(); ctx.arc((x - 0.6) * s, (y - 0.8) * s, rr * 0.9 * s, 0, 7); ctx.fillStyle = g; ctx.fill(); }
  for (let i = 0; i < 10; i++) { ctx.fillStyle = css(shade(col, 0.4), 0.5); ctx.beginPath(); ctx.arc((r() - 0.6) * 18 * s, (-20 - r() * 16) * s, 1.4 * s, 0, 7); ctx.fill(); }
}
/** kıl hücresi ağacı: gövdeden çıkan, uçları yuvarlak stereosilya demetleri */
function hairTree(ctx: Ctx, s: number, col: number) {
  blobShadow(ctx, 12 * s, 5 * s);
  const g = ctx.createLinearGradient(-3 * s, 0, 3 * s, 0); g.addColorStop(0, '#ffd2c2'); g.addColorStop(1, '#c98a8a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-3 * s, 0); ctx.quadraticCurveTo(-2 * s, -10 * s, -4 * s, -18 * s); ctx.lineTo(4 * s, -18 * s); ctx.quadraticCurveTo(2 * s, -10 * s, 3 * s, 0); ctx.closePath(); ctx.fill();
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t = (i - (n - 1) / 2) / ((n - 1) / 2); const h = (26 - Math.abs(t) * 10) * s; const tx = t * 14 * s, ty = -18 * s - h;
    ctx.strokeStyle = css(mix(col, 0x3b2a6e, 0.2)); ctx.lineWidth = 3.2 * s; ctx.beginPath(); ctx.moveTo(t * 3 * s, -17 * s); ctx.quadraticCurveTo(tx * 0.5, -18 * s - h * 0.6, tx, ty); ctx.stroke();
    ctx.strokeStyle = css(shade(col, 0.25)); ctx.lineWidth = 1.3 * s; ctx.beginPath(); ctx.moveTo(t * 3 * s - 0.6 * s, -17 * s); ctx.quadraticCurveTo(tx * 0.5 - 0.6 * s, -18 * s - h * 0.6, tx - 0.6 * s, ty); ctx.stroke();
    ctx.save(); ctx.shadowColor = css(shade(col, 0.5), 0.9); ctx.shadowBlur = 5 * s; ctx.fillStyle = css(shade(col, 0.55)); ctx.beginPath(); ctx.arc(tx, ty, 2.6 * s, 0, 7); ctx.fill(); ctx.restore();
  }
}
function pine(ctx: Ctx, s: number, col: number) {
  blobShadow(ctx, 11 * s, 5 * s);
  ctx.fillStyle = '#5a3524'; ctx.fillRect(-1.6 * s, -8 * s, 3.2 * s, 8 * s);
  for (let i = 0; i < 4; i++) { const y = -8 * s - i * 9 * s; const w = (13 - i * 2.6) * s; ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(0, y - 16 * s); ctx.lineTo(w, y); ctx.quadraticCurveTo(0, y + 4 * s, -w, y); const g = ctx.createLinearGradient(-w, 0, w, 0); g.addColorStop(0, css(mix(shade(col, 0.2), 0xffb070, 0.12))); g.addColorStop(1, css(mix(shade(col, -0.35), 0x3b2a6e, 0.3))); ctx.fillStyle = g; ctx.fill(); }
}
function noteFlower(ctx: Ctx, col: number) {
  ctx.strokeStyle = '#3d8a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-2, -5, 0, -10); ctx.stroke();
  ctx.fillStyle = '#4f9f42'; ctx.beginPath(); ctx.ellipse(-2.5, -4, 2.4, 1, -0.5, 0, 7); ctx.fill();
  // nota başı + bayrak
  ctx.save(); ctx.shadowColor = css(col, 0.8); ctx.shadowBlur = 4; ctx.fillStyle = css(col); ctx.beginPath(); ctx.ellipse(-1.6, -10, 2.6, 2, -0.4, 0, 7); ctx.fill(); ctx.restore();
  ctx.strokeStyle = css(shade(col, -0.3)); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(0.8, -10.5); ctx.lineTo(0.8, -17); ctx.quadraticCurveTo(4, -15, 3.6, -12); ctx.stroke();
}
function rock(ctx: Ctx, s: number) {
  blobShadow(ctx, 9 * s, 4 * s, 0.25);
  ctx.beginPath(); ctx.moveTo(-8 * s, 0); ctx.lineTo(-7 * s, -5 * s); ctx.lineTo(-2 * s, -8 * s); ctx.lineTo(5 * s, -7 * s); ctx.lineTo(8 * s, -2 * s); ctx.lineTo(6 * s, 1 * s); ctx.closePath();
  const g = ctx.createLinearGradient(-8 * s, -8 * s, 8 * s, 2 * s); g.addColorStop(0, '#d8cfc6'); g.addColorStop(1, '#6e6480'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(38,20,44,0.45)'; ctx.lineWidth = 0.7; ctx.stroke();
}
function bush(ctx: Ctx, col: number) {
  blobShadow(ctx, 9, 3.5, 0.25);
  for (const [x, y, rr] of [[-4, -4, 5], [4, -4, 5], [0, -7, 5.5]] as const) { const g = ctx.createRadialGradient(x - 2, y - 2, 0.5, x, y, rr); g.addColorStop(0, css(shade(col, 0.35))); g.addColorStop(1, css(mix(col, 0x3b2a6e, 0.25))); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill(); }
  for (const [x, y] of [[-3, -7], [3, -9], [5, -4]] as const) { ctx.fillStyle = '#ff9fb8'; ctx.beginPath(); ctx.arc(x, y, 1, 0, 7); ctx.fill(); }
}
/** çit parçası: u ekseni boyunca 32 birim (axis 'v' için ayna) */
function fence(ctx: Ctx, axis: 'u' | 'v', gold: boolean) {
  const len = 32; const col = gold ? 0xf5c542 : 0xf1e3c8;
  const at = (t: number, z: number) => (axis === 'u' ? P(t - len / 2, 0, z) : P(0, t - len / 2, z));
  ctx.strokeStyle = css(shade(col, -0.3)); ctx.lineWidth = 1.6;
  for (const z of [3, 6]) { ctx.beginPath(); ctx.moveTo(...at(0, z)); ctx.lineTo(...at(len, z)); ctx.stroke(); }
  for (let t = 0; t <= len; t += 8) { const [x, y] = at(t, 0); ctx.fillStyle = css(col); ctx.fillRect(x - 1, y - 8, 2, 8); ctx.fillStyle = css(shade(col, -0.35)); ctx.fillRect(x + 0.4, y - 8, 0.6, 8); ctx.beginPath(); ctx.moveTo(x - 1, y - 8); ctx.lineTo(x, y - 9.6); ctx.lineTo(x + 1, y - 8); ctx.fillStyle = css(col); ctx.fill(); }
}
/** Odi heykeli (kaide + kulaklıklı Odi) */
function statue(ctx: Ctx, gold: boolean) {
  blobShadow(ctx, 18, 8);
  box(ctx, -10, -10, 0, 20, 20, 12, { color: gold ? 0xf6efe4 : 0xbfb6a3, pattern: gold ? 'marble' : 'stone' });
  const col = gold ? 0xf5c542 : 0x9aa0b4;
  const [x, y] = P(0, 0, 12);
  const g = ctx.createRadialGradient(x - 5, y - 18, 2, x, y - 12, 14); g.addColorStop(0, css(shade(col, 0.5))); g.addColorStop(1, css(shade(col, -0.35)));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 12, 11, 0, 7); ctx.fill(); ctx.strokeStyle = css(shade(col, -0.5)); ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = css(shade(col, -0.45)); ctx.beginPath(); ctx.arc(x - 3.5, y - 13, 1.6, 0, 7); ctx.arc(x + 3.5, y - 13, 1.6, 0, 7); ctx.fill();
  ctx.strokeStyle = css(shade(col, -0.45)); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y - 10, 3.2, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 12, 12.5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.fillStyle = css(shade(col, -0.2)); roundRect(ctx, x - 14, y - 16, 4, 8, 1.5); ctx.fill(); roundRect(ctx, x + 10, y - 16, 4, 8, 1.5); ctx.fill();
  if (gold) { sparkle(ctx, x + 8, y - 24, 3); sparkle(ctx, x - 10, y - 4, 2); }
}
function fountain(ctx: Ctx, gold: boolean) {
  blobShadow(ctx, 26, 11);
  const [x, y] = P(0, 0, 0);
  for (const [rx, h, c] of [[24, 6, gold ? 0xf6efe4 : 0xbfb6a3]] as const) {
    ctx.fillStyle = css(shade(c, -0.25)); ctx.beginPath(); ctx.ellipse(x, y, rx, rx / 2, 0, 0, Math.PI); ctx.lineTo(x - rx, y - h); ctx.ellipse(x, y - h, rx, rx / 2, 0, Math.PI, 0, true); ctx.fill();
    ctx.fillStyle = css(c); ctx.beginPath(); ctx.ellipse(x, y - h, rx, rx / 2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#4fc6e0'; ctx.beginPath(); ctx.ellipse(x, y - h + 0.5, rx - 3, rx / 2 - 2, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(230,255,255,0.7)'; ctx.lineWidth = 0.8; for (const k of [0.4, 0.7]) { ctx.beginPath(); ctx.ellipse(x, y - h + 0.5, (rx - 3) * k, (rx / 2 - 2) * k, 0, 0, 7); ctx.stroke(); }
  }
  ctx.fillStyle = gold ? '#f5c542' : '#a59c8a'; ctx.fillRect(x - 2, y - 22, 4, 16);
  earGlyph(ctx, x, y - 27, 12, gold ? 0xf5c542 : 0xd9cfbf, gold ? 0xfff3b0 : 0x8a8274, 0.8);
  ctx.strokeStyle = 'rgba(160,230,255,0.8)'; ctx.lineWidth = 1.2; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + d * 2, y - 24); ctx.quadraticCurveTo(x + d * 12, y - 30, x + d * 15, y - 8); ctx.stroke(); }
}
function bridge(ctx: Ctx) {
  // köprü: dere üstünde ahşap kemer (u ekseni boyunca)
  const w = 30, d = 14;
  for (let i = 0; i < 7; i++) { const t = i / 6; const u = -w / 2 + t * w; const z = Math.sin(t * Math.PI) * 6; box(ctx, u - 2.2, -d / 2, z, 4.4, d, 2, { color: 0xb07a46, pattern: 'plank', seed: i }); }
  ctx.strokeStyle = '#6b3f22'; ctx.lineWidth = 1.2;
  for (const v of [-d / 2, d / 2]) { ctx.beginPath(); for (let i = 0; i <= 12; i++) { const t = i / 12; const [x, y] = P(-w / 2 + t * w, v, Math.sin(t * Math.PI) * 6 + 8); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke(); for (let i = 0; i <= 4; i++) { const t = i / 4; const z = Math.sin(t * Math.PI) * 6; const [x, y] = P(-w / 2 + t * w, v, z + 2); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 6); ctx.stroke(); } }
}
function pier(ctx: Ctx) {
  for (let i = 0; i < 6; i++) box(ctx, -8, i * 9, -6, 16, 8.4, 2, { color: 0xb07a46, pattern: 'plank', seed: i * 3 });
  for (const u of [-8, 7]) for (let i = 0; i < 3; i++) box(ctx, u, i * 20 + 4, -16, 2, 2, 12, { color: 0x6b3f22, pattern: 'plain' }, { top: 0x8a5a33 });
  const [x, y] = P(0, 50, -4); lantern(ctx, x + 8, y, 14);
  // kayık
  const [bx, by] = P(16, 40, -14); ctx.fillStyle = '#8a4a2a'; ctx.beginPath(); ctx.moveTo(bx - 14, by - 4); ctx.quadraticCurveTo(bx, by + 6, bx + 14, by - 4); ctx.lineTo(bx + 10, by - 6); ctx.lineTo(bx - 10, by - 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff5c8a'; ctx.fillRect(bx - 10, by - 6.5, 20, 1.2);
}

/** sis bulutu (gece moru) */
function cloud(ctx: Ctx, seed: number) {
  const r = rng(seed);
  const puffs: [number, number, number][] = [];
  for (let i = 0; i < 9; i++) puffs.push([(r() - 0.5) * 80, (r() - 0.5) * 22, 16 + r() * 18]);
  for (const [x, y, rr] of puffs) { const g = ctx.createRadialGradient(x, y + rr * 0.3, rr * 0.2, x, y, rr); g.addColorStop(0, 'rgba(70,52,140,0.92)'); g.addColorStop(1, 'rgba(70,52,140,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill(); }
  for (const [x, y, rr] of puffs) { const g = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.45, 1, x, y - rr * 0.2, rr * 0.85); g.addColorStop(0, 'rgba(196,176,255,0.75)'); g.addColorStop(0.5, 'rgba(130,108,210,0.5)'); g.addColorStop(1, 'rgba(130,108,210,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - rr * 0.15, rr * 0.85, 0, 7); ctx.fill(); }
}

/** işçi Odi: yuvarlak gövde, sarı baret, minik ayaklar */
/** kamp Odi'si (yürüyen işçi); kahraman işçi oyuncunun kendi rengiyle de çizilir */
export function worker(ctx: Ctx, col: number, step: number) {
  blobShadow(ctx, 6, 2.4, 0.3);
  ctx.fillStyle = css(shade(col, -0.4)); ctx.beginPath(); ctx.ellipse(-2.5 + step, -1, 2, 1.3, 0, 0, 7); ctx.ellipse(2.5 - step, -1, 2, 1.3, 0, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(-2.5, -10, 1, 0, -7, 8); g.addColorStop(0, css(shade(col, 0.45))); g.addColorStop(1, css(mix(col, 0x2d1d6e, 0.25)));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -7, 6.5, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(38,20,44,0.5)'; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-2, -7.5, 1.6, 0, 7); ctx.arc(2.2, -7.5, 1.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#13162a'; ctx.beginPath(); ctx.arc(-1.7, -7.3, 0.8, 0, 7); ctx.arc(2.5, -7.3, 0.8, 0, 7); ctx.fill();
  ctx.strokeStyle = '#13162a'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(0.3, -5.4, 1.6, 0.3, Math.PI - 0.3); ctx.stroke();
  // baret
  ctx.fillStyle = '#ffc93c'; ctx.beginPath(); ctx.arc(0, -11, 5.4, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.fillRect(-6.6, -11.4, 13.2, 1.4);
  ctx.fillStyle = '#ffe9a0'; ctx.fillRect(-0.7, -16, 1.4, 4.6); ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(0, -11, 5.4, Math.PI, 0); ctx.stroke();
}
function hammer(ctx: Ctx) {
  ctx.fillStyle = '#8a5a33'; ctx.fillRect(-0.7, -10, 1.4, 10);
  ctx.fillStyle = '#5d6d82'; ctx.fillRect(-3, -12, 6, 3); ctx.fillStyle = '#9fb0c4'; ctx.fillRect(-3, -12, 6, 1);
}

/** inşaat iskelesi: genişlik w, yükseklik h (ekran birimi), alt orta orijin */
export function scaffold(ctx: Ctx, w: number, h: number) {
  const cols = Math.max(3, Math.round(w / 18)); const rows = Math.max(2, Math.round(h / 18));
  const wood = '#c98e55', dark = '#7a4a26';
  const X = (i: number) => -w / 2 + (i / (cols - 1)) * w; const Y = (j: number) => -(j / rows) * h;
  ctx.lineCap = 'butt';
  // çapraz destekler
  ctx.strokeStyle = dark; ctx.lineWidth = 1.2;
  for (let i = 0; i < cols - 1; i++) for (let j = 0; j < rows; j++) { ctx.beginPath(); if ((i + j) % 2) { ctx.moveTo(X(i), Y(j)); ctx.lineTo(X(i + 1), Y(j + 1)); } else { ctx.moveTo(X(i + 1), Y(j)); ctx.lineTo(X(i), Y(j + 1)); } ctx.stroke(); }
  // direkler
  for (let i = 0; i < cols; i++) { ctx.fillStyle = wood; ctx.fillRect(X(i) - 1.4, -h - 4, 2.8, h + 4); ctx.fillStyle = dark; ctx.fillRect(X(i) + 0.6, -h - 4, 0.8, h + 4); }
  // kalaslar (yürüme)
  for (let j = 1; j <= rows; j++) { const y = Y(j); ctx.fillStyle = '#e0b070'; ctx.fillRect(-w / 2 - 3, y - 1, w + 6, 3.2); ctx.fillStyle = 'rgba(80,40,10,0.5)'; ctx.fillRect(-w / 2 - 3, y + 1.6, w + 6, 0.8); }
  // uyarı bandı
  ctx.fillStyle = '#ffc93c'; ctx.fillRect(-w / 2 - 3, -6, w + 6, 3); ctx.fillStyle = '#26364b'; for (let x = -w / 2 - 3; x < w / 2 + 3; x += 6) { ctx.beginPath(); ctx.moveTo(x, -3); ctx.lineTo(x + 3, -6); ctx.lineTo(x + 5, -6); ctx.lineTo(x + 2, -3); ctx.closePath(); ctx.fill(); }
}
function crane(ctx: Ctx) {
  // kule vinç: dikey kafes + yatay kol (kol ayrı sprite değil; tüm vinç yavaşça döner gibi sallanır)
  ctx.strokeStyle = '#ffb000'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-3, -110); ctx.moveTo(3, 0); ctx.lineTo(3, -110); ctx.stroke();
  ctx.lineWidth = 0.8; for (let y = 0; y > -110; y -= 8) { ctx.beginPath(); ctx.moveTo(-3, y); ctx.lineTo(3, y - 8); ctx.moveTo(-3, y - 8); ctx.lineTo(3, y - 8); ctx.stroke(); }
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-26, -110); ctx.lineTo(60, -110); ctx.moveTo(-26, -104); ctx.lineTo(60, -104); ctx.stroke();
  ctx.lineWidth = 0.8; for (let x = -26; x < 60; x += 6) { ctx.beginPath(); ctx.moveTo(x, -104); ctx.lineTo(x + 6, -110); ctx.stroke(); }
  ctx.fillStyle = '#5d6d82'; ctx.fillRect(-30, -112, 10, 9); ctx.fillStyle = '#ffd36b'; ctx.fillRect(-5, -118, 10, 8);
  ctx.strokeStyle = '#26364b'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(48, -104); ctx.lineTo(48, -62); ctx.stroke();
  ctx.fillStyle = '#b07a46'; ctx.fillRect(43, -62, 10, 6);
  ctx.fillStyle = '#ff5c8a'; ctx.beginPath(); ctx.arc(0, -120, 1.6, 0, 7); ctx.fill();
}
function badge(ctx: Ctx, col: number) {
  ctx.save(); ctx.shadowColor = 'rgba(20,8,40,0.5)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
  ctx.beginPath(); ctx.moveTo(-9, -10); ctx.lineTo(9, -10); ctx.lineTo(9, 2); ctx.quadraticCurveTo(9, 8, 0, 11); ctx.quadraticCurveTo(-9, 8, -9, 2); ctx.closePath();
  const g = ctx.createLinearGradient(0, -10, 0, 11); g.addColorStop(0, css(shade(col, 0.35))); g.addColorStop(1, css(shade(col, -0.25)));
  ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#fff6e5'; ctx.lineWidth = 1.4; ctx.stroke();
}
function bubble(ctx: Ctx, w: number, h: number) {
  ctx.save(); ctx.shadowColor = 'rgba(20,8,40,0.45)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
  roundRect(ctx, -w / 2, -h, w, h - 5, 10); ctx.fillStyle = '#fff6e5'; ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.moveTo(-5, -5.5); ctx.lineTo(0, 0); ctx.lineTo(5, -5.5); ctx.fillStyle = '#fff6e5'; ctx.fill();
  roundRect(ctx, -w / 2, -h, w, h - 5, 10); ctx.strokeStyle = 'rgba(45,29,110,0.35)'; ctx.lineWidth = 1; ctx.stroke();
}
function roundBtn(ctx: Ctx, col: number) {
  ctx.save(); ctx.shadowColor = 'rgba(20,8,40,0.5)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
  const g = ctx.createLinearGradient(0, -13, 0, 13); g.addColorStop(0, css(shade(col, 0.3))); g.addColorStop(1, css(shade(col, -0.2)));
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.lineWidth = 1.8; ctx.strokeStyle = '#fff6e5'; ctx.stroke();
}
function hand(ctx: Ctx) {
  ctx.fillStyle = '#ffe0c2'; ctx.strokeStyle = '#7a3a2a'; ctx.lineWidth = 0.9;
  ctx.beginPath(); roundRect(ctx, -5, -2, 10, 9, 3); ctx.fill(); ctx.stroke();
  for (const [x, h] of [[-4.2, 6], [-1.4, 8], [1.4, 8], [4.2, 6]] as const) { ctx.beginPath(); roundRect(ctx, x - 1.3, -2 - h, 2.6, h + 2, 1.3); ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); roundRect(ctx, -9, 0, 6, 2.6, 1.3); ctx.fill(); ctx.stroke();
}
function ffwd(ctx: Ctx) {
  ctx.fillStyle = '#fff6e5'; for (const dx of [-4, 3]) { ctx.beginPath(); ctx.moveTo(dx - 4, -6); ctx.lineTo(dx + 4, 0); ctx.lineTo(dx - 4, 6); ctx.closePath(); ctx.fill(); }
}
function coin(ctx: Ctx, r: number) {
  ctx.beginPath(); ctx.arc(0, 0.8, r, 0, 7); ctx.fillStyle = '#b8780c'; ctx.fill();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 0.5, 0, 0, r); g.addColorStop(0, '#fff2a8'); g.addColorStop(1, '#f2a80c');
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#a8700c'; ctx.lineWidth = r * 0.12; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, 7); ctx.strokeStyle = 'rgba(168,112,12,0.6)'; ctx.lineWidth = r * 0.1; ctx.stroke();
  earGlyph(ctx, 0, 0, r * 0.95, 0xe89a0c, 0xb8780c, 0.4);
}
function note(ctx: Ctx, col: number) {
  ctx.save(); ctx.shadowColor = css(col, 0.9); ctx.shadowBlur = 5;
  ctx.fillStyle = css(col); ctx.beginPath(); ctx.ellipse(-3, 5, 4, 3, -0.4, 0, 7); ctx.fill();
  ctx.fillRect(0.2, -9, 1.6, 14); ctx.beginPath(); ctx.moveTo(1.8, -9); ctx.quadraticCurveTo(8, -6, 6, -1); ctx.quadraticCurveTo(6, -5, 1.8, -5); ctx.fill(); ctx.restore();
}
function glow(ctx: Ctx, r: number) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
}
function ring(ctx: Ctx, r: number) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.ellipse(0, 0, r, r / 2, 0, 0, 7); ctx.stroke(); }
function arcWave(ctx: Ctx) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, 0, 14, -0.8, 0.8); ctx.stroke(); }
function puff(ctx: Ctx) { const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 10); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, 'rgba(235,225,255,0.6)'); g.addColorStop(1, 'rgba(235,225,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fill(); }
function rays(ctx: Ctx) {
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const g = ctx.createLinearGradient(0, 0, Math.cos(a) * 90, Math.sin(a) * 90); g.addColorStop(0, 'rgba(255,240,180,0.9)'); g.addColorStop(1, 'rgba(255,240,180,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - 0.09) * 90, Math.sin(a - 0.09) * 90); ctx.lineTo(Math.cos(a + 0.09) * 90, Math.sin(a + 0.09) * 90); ctx.closePath(); ctx.fill(); }
}
function heartTex(ctx: Ctx) { ctx.save(); ctx.shadowColor = 'rgba(255,92,138,0.9)'; ctx.shadowBlur = 4; heartShape(ctx, 0, 0, 6); ctx.fillStyle = '#ff5c8a'; ctx.fill(); ctx.restore(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(-2.4, -1.6, 1.3, 0, 7); ctx.fill(); }
/** Tedavi Odası damlası (raf baloncuğu, uçan damlalar) */
function dropTex(ctx: Ctx) {
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.bezierCurveTo(5.5, -1, 5, 6, 0, 6.5); ctx.bezierCurveTo(-5, 6, -5.5, -1, 0, -8); ctx.closePath();
  const g = ctx.createLinearGradient(-5, -8, 5, 6); g.addColorStop(0, '#dffffb'); g.addColorStop(0.5, '#2ee6d6'); g.addColorStop(1, '#127f8c');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#0d5a63'; ctx.lineWidth = 0.9; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(-1.8, 0.5, 1.1, 2.3, -0.4, 0, 7); ctx.fill();
}
/** "tüy hücresi" yardımcısı: armut gövde, tepede basamaklı stereosilya, iki göz; iki adım karesi */
export function hairHelper(ctx: Ctx, col: number, step: number) {
  blobShadow(ctx, 5, 2, 0.3);
  ctx.fillStyle = css(shade(col, -0.45)); ctx.beginPath(); ctx.ellipse(-2 + step, -0.8, 1.6, 1, 0, 0, 7); ctx.ellipse(2 - step, -0.8, 1.6, 1, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-4.2, -1.5); ctx.bezierCurveTo(-5.6, -8, -4.6, -13, 0, -14); ctx.bezierCurveTo(4.6, -13, 5.6, -8, 4.2, -1.5); ctx.closePath();
  const g = ctx.createLinearGradient(-5, 0, 5, 0); g.addColorStop(0, css(shade(col, 0.45))); g.addColorStop(1, css(mix(col, 0x2d1d6e, 0.2))); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(38,20,44,0.5)'; ctx.lineWidth = 0.5; ctx.stroke();
  for (let i = 0; i < 4; i++) { ctx.strokeStyle = css(shade(col, 0.6)); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-2.4 + i * 1.6, -13.6); ctx.lineTo(-2.2 + i * 1.6 + (step ? 0.4 : -0.2), -16 - i * 1.3); ctx.stroke(); }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-1.6, -8.5, 1.3, 0, 7); ctx.arc(1.8, -8.5, 1.3, 0, 7); ctx.fill();
  ctx.fillStyle = '#13162a'; ctx.beginPath(); ctx.arc(-1.4, -8.3, 0.65, 0, 7); ctx.arc(2, -8.3, 0.65, 0, 7); ctx.fill();
}
/** kilit tabelası (kilitli bölge) */
function lockSign(ctx: Ctx) {
  ctx.fillStyle = '#5b3a24'; ctx.fillRect(-1, -18, 2, 18);
  roundRect(ctx, -12, -32, 24, 16, 3); ctx.fillStyle = '#c98e55'; ctx.fill(); ctx.strokeStyle = '#5b3a24'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = '#fff6e5'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, -26.5, 3, Math.PI, 0); ctx.stroke(); ctx.fillStyle = '#fff6e5'; roundRect(ctx, -4, -26.5, 8, 6.5, 1); ctx.fill();
}
/** Kütüphane baloncuğu simgesi: açık kitap */
function bookIcon(ctx: Ctx) {
  ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(-4, 2, -8, 3); ctx.lineTo(-8, -5); ctx.quadraticCurveTo(-4, -6, 0, -4); ctx.closePath(); ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.strokeStyle = '#8a5a33'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(4, 2, 8, 3); ctx.lineTo(8, -5); ctx.quadraticCurveTo(4, -6, 0, -4); ctx.closePath(); ctx.fillStyle = '#f3ead8'; ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8b6bff'; ctx.font = '900 6px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('XP', -4, 1.5);
}
function confetti(ctx: Ctx) { ctx.fillStyle = '#ffffff'; ctx.fillRect(-2, -1, 4, 2); }
function firefly(ctx: Ctx) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 4); g.addColorStop(0, 'rgba(230,255,170,1)'); g.addColorStop(1, 'rgba(180,255,120,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill(); }

export const WORKER_COLORS = [0x8b6bff, 0x2ee6d6, 0xff5c8a, 0xff9f1c, 0x6c4cf1];
/** tüy hücresi yardımcılarının renkleri */
export const HELPER_COLORS = [0xfff0a0, 0xffd0e0, 0xc8f5ff, 0xd8ffc0];
export const TREE_COLORS = [0x5fae4a, 0x7cc35a, 0x4f9a5e, 0xe0a24a, 0xd9705a];
export const TIER_GEAR = [0x8a8274, 0x9a9a9a, 0xb87333, 0x9fb0c4, 0xf5c542];

/** bütün statik dokular (anahtar → çizim) */
export function propDefs(): PropDef[] {
  const out: PropDef[] = [];
  TREE_COLORS.forEach((c, i) => out.push(def(`c-tree-${i}`, 52, 56, 26, 50, (x) => roundTree(x, 1.1, c, i + 3))));
  [0xff8fb1, 0x8ef0b0, 0xffc93c, 0x8b6bff].forEach((c, i) => out.push(def(`c-hair-${i}`, 44, 58, 22, 52, (x) => hairTree(x, 1, c))));
  [0x3f8f5a, 0x4f9a5e].forEach((c, i) => out.push(def(`c-pine-${i}`, 34, 66, 17, 60, (x) => pine(x, 1, c))));
  [0xff5c8a, 0xffc93c, 0x8b6bff, 0x2ee6d6].forEach((c, i) => out.push(def(`c-flower-${i}`, 14, 22, 7, 20, (x) => noteFlower(x, c))));
  out.push(def('c-rock-0', 22, 14, 11, 10, (x) => rock(x, 1)), def('c-rock-1', 34, 20, 17, 14, (x) => rock(x, 1.6)));
  [0x5fae4a, 0x4f9a5e].forEach((c, i) => out.push(def(`c-bush-${i}`, 26, 18, 13, 14, (x) => bush(x, c))));
  for (const g of [false, true]) { out.push(def(`c-fence-u${g ? '-g' : ''}`, 40, 34, 20, 22, (x) => fence(x, 'u', g)), def(`c-fence-v${g ? '-g' : ''}`, 40, 34, 20, 22, (x) => fence(x, 'v', g))); }
  out.push(def('c-lamp', 12, 26, 3, 24, (x) => lantern(x, 0, 0, 20)), def('c-lamp-g', 12, 26, 3, 24, (x) => lantern(x, 0, 0, 20, true)));
  out.push(def('c-statue', 44, 64, 22, 52, (x) => statue(x, false)), def('c-statue-g', 44, 64, 22, 52, (x) => statue(x, true)));
  out.push(def('c-fountain', 60, 56, 30, 30, (x) => fountain(x, false)), def('c-fountain-g', 60, 56, 30, 30, (x) => fountain(x, true)));
  out.push(def('c-bridge', 56, 40, 28, 24, bridge), def('c-pier', 70, 76, 30, 14, pier));
  for (let i = 0; i < 4; i++) out.push(def(`c-cloud-${i}`, 150, 90, 75, 50, (x) => cloud(x, i * 17 + 3)));
  WORKER_COLORS.forEach((c, i) => { out.push(def(`c-odi-${i}-0`, 16, 20, 8, 18, (x) => worker(x, c, 0)), def(`c-odi-${i}-1`, 16, 20, 8, 18, (x) => worker(x, c, 1))); });
  out.push(def('c-hammer', 8, 14, 4, 12, hammer), def('c-crane', 100, 126, 34, 122, crane));
  [0xb07a45, 0x9d9a92, 0xc2603c, 0x3a9fc4, 0xe0a81a, 0x8b6bff, 0xff5c8a].forEach((c, i) => out.push(def(`c-badge-${i}`, 22, 24, 11, 11.5, (x) => badge(x, c))));
  HELPER_COLORS.forEach((c, i) => { out.push(def(`c-tuy-${i}-0`, 14, 22, 7, 20, (x) => hairHelper(x, c, 0)), def(`c-tuy-${i}-1`, 14, 22, 7, 20, (x) => hairHelper(x, c, 1))); });
  out.push(def('c-lock', 30, 36, 15, 34, lockSign), def('c-book', 20, 14, 10, 7, bookIcon));
  out.push(def('c-bubble', 76, 32, 38, 31, (x) => bubble(x, 74, 30)), def('c-bubble-s', 40, 32, 20, 31, (x) => bubble(x, 38, 30)));
  out.push(def('c-btn-help', 30, 30, 15, 15, (x) => { roundBtn(x, 0x3ccf7e); hand(x); }), def('c-btn-fast', 30, 30, 15, 15, (x) => { roundBtn(x, 0x8b6bff); ffwd(x); }));
  out.push(def('c-coin', 20, 20, 10, 10, (x) => coin(x, 8)), def('c-coin-s', 12, 12, 6, 6, (x) => coin(x, 5)));
  [0xffffff, 0xffc93c, 0x2ee6d6, 0xff8fb1].forEach((c, i) => out.push(def(`c-note-${i}`, 18, 22, 7, 12, (x) => note(x, c))));
  out.push(def('c-glow', 64, 64, 32, 32, (x) => glow(x, 32)), def('c-ring', 100, 52, 50, 26, (x) => ring(x, 48)), def('c-arc', 24, 30, 6, 15, arcWave));
  out.push(def('c-puff', 22, 22, 11, 11, puff), def('c-rays', 184, 184, 92, 92, rays), def('c-heart', 16, 16, 8, 8, heartTex), def('c-hand', 22, 22, 11, 13, hand));
  out.push(def('c-drop', 14, 18, 7, 9, dropTex));
  out.push(def('c-confetti', 6, 4, 3, 2, confetti), def('c-firefly', 8, 8, 4, 4, firefly), def('c-sparkle', 16, 16, 8, 8, (x) => sparkle(x, 0, 0, 6)));
  TIER_GEAR.forEach((c, i) => out.push(def(`c-gear-${i}`, 24, 24, 12, 12, (x) => gear(x, 0, 0, 11, 9, c))));
  return out;
}

export const ATLAS = 'camp-atlas';
/** tüm süs/efekt dokularını tek atlasa diz (raf paketleme); her karenin pivotu çizim orijinidir */
export function buildAtlas(textures: Phaser.Textures.TextureManager): void {
  if (textures.exists(ATLAS)) return;
  const defs = propDefs(); const PAD = 2; const MAXW = 2048;
  const items = defs.map((d) => ({ d, w: Math.ceil(d.w * TEX), h: Math.ceil(d.h * TEX) })).sort((a, b) => b.h - a.h);
  let x = 0, y = 0, rowH = 0; const pos: { x: number; y: number }[] = [];
  for (const it of items) { if (x + it.w > MAXW) { x = 0; y += rowH + PAD; rowH = 0; } pos.push({ x, y }); x += it.w + PAD; rowH = Math.max(rowH, it.h); }
  const c = document.createElement('canvas'); c.width = MAXW; c.height = y + rowH + PAD;
  const ctx = c.getContext('2d')!; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  items.forEach((it, i) => { const p = pos[i]!; ctx.save(); ctx.beginPath(); ctx.rect(p.x, p.y, it.w, it.h); ctx.clip(); ctx.translate(p.x, p.y); ctx.scale(TEX, TEX); ctx.translate(it.d.ox, it.d.oy); it.d.draw(ctx); ctx.restore(); });
  const tex = textures.addCanvas(ATLAS, c)!;
  items.forEach((it, i) => { const p = pos[i]!; const f = tex.add(it.d.key, 0, p.x, p.y, it.w, it.h)!; f.customPivot = true; f.pivotX = (it.d.ox * TEX) / it.w; f.pivotY = (it.d.oy * TEX) / it.h; });
}
