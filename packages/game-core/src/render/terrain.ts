/**
 * Zemin ve platform görselleri: düz dikdörtgen yerine yuvarlatılmış, gölgeli, üstü biyoma özgü katı kütleler.
 * Her dikdörtgen biyom "zemin takımından" (bir kez boyanan birkaç doku) parça parça kurulur:
 *   gölge (NineSlice) · gövde (NineSlice: gradyan + kenar ışığı) · iç doku (TileSprite, derinde söner) ·
 *   üst kat / dudak (3 dilim NineSlice) · saçak (TileSprite: kıl, serumen damlası, zar lifi, kemik topuzu, tüylü hücre…) · süs aksesuarları.
 * Dikdörtgen başına yeni tuval boyanmaz; bellek ve açılış maliyeti sabittir. Yalnızca görsel; fizik motorda.
 */
import Phaser from 'phaser';
import type { Rect } from './types';
import { artOf, type BiomeArt } from './palette';
import { canvasTex, circle, css, darken, glow, hashStr, isWebGL, lighten, mix, renderResolution, rng, roundRectPath, sparkle, taperHair, tono, type Ctx, type Rnd } from './util';

export const LIP_H = 20;        // üst katın kalınlığı (tasarım px)
const FT = 20;                  // saçak dokusunda üst kat üst çizgisinin y'si
const FH = 58;                  // saçak dokusu yüksekliği
const TILE = 256;

// ---------------------------------------------------------------- takım dokuları
function bodyTex(scene: Phaser.Scene, A: BiomeArt, R: number, slab: boolean): string {
  const w = 128, h = slab ? 48 : 160, r = slab ? 14 : 24;
  return canvasTex(scene, `tr-body-${A.id}-${slab ? 's' : 'b'}-${R}`, w, h, R, (ctx) => {
    const G = A.ground;
    roundRectPath(ctx, 1, 1, w - 2, h - 2, r);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (slab) { g.addColorStop(0, css(G.body)); g.addColorStop(1, css(mix(G.body, G.deep, 0.65))); }
    else { g.addColorStop(0, css(G.body)); g.addColorStop(0.3, css(mix(G.body, G.deep, 0.45))); g.addColorStop(1, css(G.deep)); }
    ctx.fillStyle = g; ctx.fill();
    // kenar ışığı (yanlarda, aşağı doğru söner)
    ctx.save(); roundRectPath(ctx, 1, 1, w - 2, h - 2, r); ctx.clip();
    const rim = ctx.createLinearGradient(0, 0, 0, h); rim.addColorStop(0, css(G.rim, 0.55)); rim.addColorStop(slab ? 1 : 0.5, css(G.rim, 0.08)); rim.addColorStop(1, css(G.rim, 0));
    ctx.strokeStyle = rim; ctx.lineWidth = 3; roundRectPath(ctx, 2.5, 2.5, w - 5, h - 5, r - 1.5); ctx.stroke();
    // üst katın altındaki temas gölgesi
    const ao = ctx.createLinearGradient(0, 0, 0, 34); ao.addColorStop(0, css(G.line, 0.0)); ao.addColorStop(0.45, css(G.line, 0.45)); ao.addColorStop(1, css(G.line, 0));
    ctx.fillStyle = ao; ctx.fillRect(0, 6, w, 30);
    ctx.restore();
    roundRectPath(ctx, 1, 1, w - 2, h - 2, r); ctx.strokeStyle = css(G.line, 0.9); ctx.lineWidth = 2; ctx.stroke();
  });
}
function shadowTex(scene: Phaser.Scene): string {
  return canvasTex(scene, 'tr-shadow', 96, 96, 1, (ctx) => {
    ctx.save(); ctx.shadowColor = 'rgba(5,0,20,0.75)'; ctx.shadowBlur = 14; ctx.shadowOffsetX = 2000; ctx.translate(-2000, 0);
    roundRectPath(ctx, 22, 22, 52, 52, 14); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
  });
}
function lipTex(scene: Phaser.Scene, A: BiomeArt, R: number): string {
  const w = 96, h = LIP_H + 12; // altında yumuşak gölge
  return canvasTex(scene, `tr-lip-${A.id}-${R}`, w, h, R, (ctx) => {
    const G = A.ground; const r = LIP_H / 2;
    // alt gölge
    const sg = ctx.createLinearGradient(0, LIP_H - 4, 0, h); sg.addColorStop(0, css(G.line, 0.55)); sg.addColorStop(1, css(G.line, 0));
    ctx.fillStyle = sg; roundRectPath(ctx, 4, LIP_H - 6, w - 8, h - LIP_H + 6, 8); ctx.fill();
    roundRectPath(ctx, 1, 1, w - 2, LIP_H - 2, r);
    const g = ctx.createLinearGradient(0, 0, 0, LIP_H); g.addColorStop(0, css(G.topHi)); g.addColorStop(0.28, css(G.top)); g.addColorStop(1, css(G.topLo));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = css(darken(G.topLo, 0.45), 0.9); ctx.lineWidth = 1.6; ctx.stroke();
    // parlak üst çizgi
    ctx.strokeStyle = css(0xffffff, 0.55); ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(r * 0.7, 4.2); ctx.lineTo(w - r * 0.7, 4.2); ctx.stroke();
    // uç parlamaları
    ctx.fillStyle = css(0xffffff, 0.35); ctx.beginPath(); ctx.ellipse(r * 0.8, 7, 3, 2, -0.5, 0, Math.PI * 2); ctx.fill();
  });
}
type FringePainter = (ctx: Ctx, W: number, rnd: Rnd, A: BiomeArt) => void;
const LIPB = FT + LIP_H; // üst katın alt çizgisi (saçak dokusunda)
const FRINGE: Record<string, FringePainter> = {
  auricle: (ctx, W, rnd, A) => {
    for (let i = 0; i < 18; i++) { const x = rnd() * W; ctx.fillStyle = css(A.ground.topLo, 0.55); circle(ctx, x, FT + 8 + rnd() * 8, 1 + rnd() * 1.3); ctx.fill(); }
    for (let i = 0; i < 46; i++) { const x = 4 + rnd() * (W - 8); taperHair(ctx, x, FT + 4, 7 + rnd() * 14, -Math.PI / 2 + (rnd() - 0.5) * 0.9, (rnd() - 0.5) * 1.4, 1.5, lighten(A.ground.topHi, 0.2), 0.85, rnd() < 0.12 ? A.accent : undefined); }
  },
  tunnel: (ctx, W, rnd, A) => {
    for (let i = 0; i < 9; i++) { const r = 2.6 + rnd() * 2.2, len = 5 + rnd() * Math.min(13, FH - LIPB - r - 2); drip(ctx, 10 + rnd() * (W - 20), LIPB - 3, len, r, A.ground.top); }
    for (let i = 0; i < 10; i++) { const x = rnd() * W; ctx.fillStyle = css(0xffffff, 0.5); ctx.beginPath(); ctx.ellipse(x, FT + 6 + rnd() * 4, 3 + rnd() * 5, 1.2, 0, 0, Math.PI * 2); ctx.fill(); }
    for (let i = 0; i < 7; i++) { const x = 6 + rnd() * (W - 12); taperHair(ctx, x, FT + 5, 10 + rnd() * 12, -Math.PI / 2 + (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.6, 2, darken(A.ground.body, 0.3), 0.95); }
  },
  drum: (ctx, W, rnd, A) => {
    ctx.save(); ctx.beginPath(); ctx.rect(0, FT + 2, W, LIP_H - 5); ctx.clip();
    ctx.strokeStyle = css(0xffffff, 0.35); ctx.lineWidth = 0.8; for (let x = -20; x < W + 20; x += 7) { ctx.beginPath(); ctx.moveTo(x, FT); ctx.lineTo(x + 14, LIPB); ctx.stroke(); }
    ctx.strokeStyle = css(A.ground.topLo, 0.4); for (let x = -20; x < W + 20; x += 11) { ctx.beginPath(); ctx.moveTo(x + 14, FT); ctx.lineTo(x, LIPB); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = css(0xffffff, 0.75); for (let x = 4; x < W; x += 8) { circle(ctx, x, LIPB - 4, 1); ctx.fill(); }
    for (let i = 0; i < 6; i++) sparkle(ctx, rnd() * W, FT - 2 - rnd() * 8, 2 + rnd() * 2, A.motes[0]!, 0.8);
  },
  bones: (ctx, W, rnd, A) => {
    let x = 2; while (x < W - 2) { const r = 4 + rnd() * 6; const cx = x + r; if (cx + r > W - 2) break; const g = ctx.createRadialGradient(cx - r * 0.3, FT + 2 - r * 0.4, 1, cx, FT + 2, r); g.addColorStop(0, css(A.ground.topHi)); g.addColorStop(1, css(A.ground.top)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, FT + 3, r, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = css(darken(A.ground.topLo, 0.4), 0.7); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(cx, FT + 3, r, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke(); x += r * 2 + 2 + rnd() * 18; }
    for (let i = 0; i < 16; i++) { ctx.fillStyle = css(A.ground.topLo, 0.6); ctx.beginPath(); ctx.ellipse(rnd() * W, FT + 7 + rnd() * 9, 1.2 + rnd() * 1.6, 0.9 + rnd(), 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = css(A.accent, 0.55); ctx.lineWidth = 1.2; ctx.beginPath(); for (let xx = 0; xx <= W; xx += 4) { const y = LIPB + 2 + Math.sin((xx / W) * Math.PI * 6) * 2; if (!xx) ctx.moveTo(xx, y); else ctx.lineTo(xx, y); } ctx.stroke();
  },
  spiral: (ctx, W, rnd, A) => {
    const [lo, hi] = A.tono ?? [0, 1];
    for (let x = 8; x < W - 6; x += 15 + rnd() * 6) {
      const c = tono(lo + (hi - lo) * ((x / W + rnd() * 0.2) % 1)); const n = 3; const h = 9 + rnd() * 9;
      for (let k = 0; k < n; k++) { const t = (k - 1); taperHair(ctx, x + t * 2.2, FT + 4, h * (1 - Math.abs(t) * 0.25), -Math.PI / 2 + t * 0.22, t * 0.1, 1.8, lighten(A.ground.top, 0.3), 1, c); }
    }
    for (let i = 0; i < 14; i++) { ctx.fillStyle = css(A.ground.topHi, 0.45); circle(ctx, rnd() * W, FT + 9 + rnd() * 6, 1 + rnd()); ctx.fill(); }
  },
  nerve: (ctx, W, rnd, A) => {
    for (let x = 0; x < W; x += 64) {
      ctx.fillStyle = css(A.ground.line, 0.9); ctx.fillRect(x - 1.5, FT + 1, 3, LIP_H - 2);
      glow(ctx, x, FT + LIP_H / 2, 12, A.accent, 0.8); ctx.fillStyle = css(lighten(A.accent, 0.7)); circle(ctx, x, FT + LIP_H / 2, 2.2); ctx.fill();
    }
    for (let i = 0; i < 10; i++) { const x = rnd() * W; const y = FT - 2 - rnd() * 10; ctx.strokeStyle = css(A.accent, 0.7); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, FT + 2); ctx.lineTo(x + (rnd() - 0.5) * 6, y + 4); ctx.lineTo(x + (rnd() - 0.5) * 6, y); ctx.stroke(); }
  },
  stem: (ctx, W, rnd, A) => {
    ctx.save(); ctx.beginPath(); ctx.rect(0, FT + 3, W, LIP_H - 7); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
    for (let x = -32; x < W + 32; x += 32) { ctx.strokeStyle = css(A.accent, 0.5); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, FT); ctx.lineTo(x + 32, LIPB); ctx.stroke(); ctx.strokeStyle = css(A.accent2, 0.5); ctx.beginPath(); ctx.moveTo(x + 32, FT); ctx.lineTo(x, LIPB); ctx.stroke(); }
    ctx.restore();
    for (let x = 16; x < W; x += 32) { glow(ctx, x, FT + LIP_H / 2, 6, (x / 32) % 2 ? A.accent : A.accent2, 0.7); }
    for (let i = 0; i < 5; i++) crystal(ctx, 10 + rnd() * (W - 20), FT + 4, 6 + rnd() * 8, rnd() < 0.5 ? A.accent : A.accent2);
  },
  cortex: (ctx, W, rnd, A) => {
    let x = 0; while (x < W) { const r = 7 + rnd() * 8; ctx.fillStyle = css(A.ground.top); ctx.beginPath(); ctx.ellipse(x + r, FT + 4, r, r * 0.6, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = css(A.ground.topHi, 0.8); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x + r, FT + 4, r * 0.7, r * 0.35, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); x += r * 2 - 1; }
    ctx.strokeStyle = css(A.ground.topLo, 0.7); ctx.lineWidth = 1.2; ctx.beginPath(); for (let xx = 0; xx <= W; xx += 3) { const y = FT + 12 + Math.sin((xx / W) * Math.PI * 10) * 2.5; if (!xx) ctx.moveTo(xx, y); else ctx.lineTo(xx, y); } ctx.stroke();
    for (let i = 0; i < 4; i++) { const sx = 10 + rnd() * (W - 20); taperHair(ctx, sx, FT, 10 + rnd() * 8, -Math.PI / 2 + (rnd() - 0.5) * 0.8, (rnd() - 0.5), 1.4, A.ground.topLo, 1, A.accent); }
  },
};
function drip(ctx: Ctx, x: number, y: number, len: number, r: number, c: number) {
  const g = ctx.createLinearGradient(0, y, 0, y + len + r); g.addColorStop(0, css(c)); g.addColorStop(1, css(darken(c, 0.15)));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - r * 1.4, y); ctx.quadraticCurveTo(x - r * 0.7, y + len * 0.5, x - r, y + len); ctx.arc(x, y + len, r, Math.PI, 0, true); ctx.quadraticCurveTo(x + r * 0.7, y + len * 0.5, x + r * 1.4, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = css(darken(c, 0.45), 0.6); ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = css(0xffffff, 0.75); ctx.beginPath(); ctx.ellipse(x - r * 0.35, y + len - r * 0.1, r * 0.25, r * 0.4, -0.3, 0, Math.PI * 2); ctx.fill();
}
function crystal(ctx: Ctx, x: number, y: number, h: number, c: number) {
  glow(ctx, x, y - h * 0.5, h, c, 0.35);
  ctx.fillStyle = css(lighten(c, 0.3), 0.95); ctx.beginPath(); ctx.moveTo(x - h * 0.25, y); ctx.lineTo(x - h * 0.15, y - h * 0.7); ctx.lineTo(x, y - h); ctx.lineTo(x + h * 0.18, y - h * 0.65); ctx.lineTo(x + h * 0.25, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = css(0xffffff, 0.6); ctx.beginPath(); ctx.moveTo(x - h * 0.1, y - h * 0.1); ctx.lineTo(x - h * 0.08, y - h * 0.65); ctx.lineTo(x, y - h * 0.9); ctx.closePath(); ctx.fill();
}
function fringeTex(scene: Phaser.Scene, A: BiomeArt, R: number): string {
  return canvasTex(scene, `tr-fringe-${A.id}-${R}`, TILE, FH, R, (ctx, W) => FRINGE[A.motif]!(ctx, W, rng(hashStr(A.id) ^ 0xf1), A));
}
type PatternPainter = (ctx: Ctx, W: number, H: number, rnd: Rnd, A: BiomeArt) => void;
const PATTERN: Record<string, PatternPainter> = {
  auricle: (ctx, W, H, rnd, A) => { for (let i = 0; i < 60; i++) { ctx.fillStyle = css(darken(A.ground.body, 0.4), 0.55); circle(ctx, rnd() * W, rnd() * H, 0.8 + rnd() * 1.6); ctx.fill(); } for (let i = 0; i < 10; i++) { ctx.fillStyle = css(lighten(A.ground.body, 0.15), 0.16); ctx.beginPath(); ctx.ellipse(20 + rnd() * (W - 40), rnd() * H, 8 + rnd() * 12, 4 + rnd() * 6, 0, 0, Math.PI * 2); ctx.fill(); } },
  tunnel: (ctx, W, H, rnd, A) => { for (let k = 0; k < 7; k++) { const y0 = 16 + k * 32 + rnd() * 8; const x0 = rnd() * W * 0.5, x1 = x0 + 40 + rnd() * 90; ctx.strokeStyle = css(k % 2 ? lighten(A.ground.body, 0.15) : darken(A.ground.body, 0.35), 0.45); ctx.lineWidth = 2 + rnd() * 2; ctx.lineCap = 'round'; ctx.beginPath(); for (let x = x0; x <= x1; x += 4) { const y = y0 + Math.sin(x / 18 + k) * 2.5; if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); } for (let i = 0; i < 8; i++) { const x = 10 + rnd() * (W - 20), y = 16 + rnd() * (H - 40); glow(ctx, x, y, 7, A.accent, 0.4); ctx.fillStyle = css(A.ground.top, 0.9); ctx.beginPath(); ctx.ellipse(x, y, 2.5 + rnd() * 2.5, 1.6 + rnd() * 1.6, rnd() * 3, 0, Math.PI * 2); ctx.fill(); } },
  drum: (ctx, W, H, rnd, A) => { ctx.strokeStyle = css(lighten(A.ground.body, 0.3), 0.22); ctx.lineWidth = 1.2; for (let i = 0; i < 9; i++) { const cx = 20 + rnd() * (W - 40), cy = rnd() * H; for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.ellipse(cx, cy, k * 7, k * 4, 0, 0, Math.PI * 2); ctx.stroke(); } } },
  bones: (ctx, W, H, rnd, A) => { for (let i = 0; i < 40; i++) { const x = 8 + rnd() * (W - 16), y = rnd() * H, rx = 2 + rnd() * 6, ry = 1.5 + rnd() * 4; ctx.fillStyle = css(darken(A.ground.body, 0.45), 0.6); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rnd() * 3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = css(lighten(A.ground.body, 0.35), 0.3); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y + 0.8, rx, ry, 0, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); } },
  spiral: (ctx, W, H, rnd, A) => { const [lo, hi] = A.tono ?? [0, 1]; for (let i = 0; i < 26; i++) { const x = 12 + rnd() * (W - 24), y = rnd() * H, r = 4 + rnd() * 6; ctx.strokeStyle = css(lighten(A.ground.body, 0.25), 0.3); ctx.lineWidth = 1.2; circle(ctx, x, y, r); ctx.stroke(); if (rnd() < 0.5) { const c = tono(lo + (hi - lo) * rnd()); glow(ctx, x, y, r * 0.9, c, 0.55); } } },
  nerve: (ctx, W, H, rnd, A) => { for (let k = 0; k < 10; k++) { const y0 = rnd() * H, x0 = rnd() * W * 0.6, len = 50 + rnd() * 90; ctx.strokeStyle = css(lighten(A.ground.body, 0.25), 0.28); ctx.lineWidth = 1 + rnd() * 1.5; ctx.lineCap = 'round'; ctx.beginPath(); for (let x = x0; x <= x0 + len; x += 4) { const y = y0 + Math.sin(x / 20 + k) * 3; if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); } for (let i = 0; i < 10; i++) glow(ctx, 10 + rnd() * (W - 20), rnd() * H, 5, A.accent, 0.45); },
  stem: (ctx, W, H, rnd, A) => { ctx.lineWidth = 1.2; ctx.lineCap = 'round'; for (let i = 0; i < 12; i++) { const x = 10 + rnd() * (W - 30), y = rnd() * H, l = 10 + rnd() * 14; ctx.strokeStyle = css(lighten(A.ground.body, 0.25), 0.28); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y + l); ctx.moveTo(x + l, y); ctx.lineTo(x, y + l); ctx.stroke(); } for (let i = 0; i < 8; i++) glow(ctx, 10 + rnd() * (W - 20), rnd() * H, 5, i % 2 ? A.accent : A.accent2, 0.4); },
  cortex: (ctx, W, H, rnd, A) => { ctx.strokeStyle = css(darken(A.ground.body, 0.4), 0.5); ctx.lineWidth = 2; ctx.lineCap = 'round'; for (let i = 0; i < 14; i++) { const x = 16 + rnd() * (W - 32), y = rnd() * H, r = 6 + rnd() * 9; ctx.beginPath(); ctx.arc(x, y, r, Math.PI * (0.9 + rnd() * 0.2), Math.PI * (1.9 + rnd() * 0.2)); ctx.stroke(); } },
};
function patternTex(scene: Phaser.Scene, A: BiomeArt, R: number): string {
  return canvasTex(scene, `tr-pat-${A.id}-${R}`, TILE, TILE, R, (ctx, W, H) => {
    PATTERN[A.motif]!(ctx, W, H, rng(hashStr(A.id) ^ 0x9a7), A);
    // derinlik sönümü dokuya gömülü (döşeme dikeyde tekrarlanmaz: yükseklik ≤ TILE)
    ctx.save(); ctx.globalCompositeOperation = 'destination-in';
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  });
}
/** süs aksesuarları (zeminin üstünde, ara ara) */
type AccentPainter = (ctx: Ctx, w: number, h: number, rnd: Rnd, A: BiomeArt, v: number) => void;
const ACCENT: Record<string, AccentPainter> = {
  auricle: (ctx, w, h, rnd, A, v) => { for (let i = 0; i < 7; i++) taperHair(ctx, w / 2 + (i - 3) * 2.4, h - 2, (v ? 26 : 34) + rnd() * 16, -Math.PI / 2 + (i - 3) * 0.16, (rnd() - 0.5) * 0.8, 2.2, lighten(A.ground.topHi, 0.1), 1, i % 2 ? A.accent : A.accent2); },
  tunnel: (ctx, w, h, rnd, A) => { const r = 9; glow(ctx, w / 2, h - r, r * 3, A.accent, 0.5); drip(ctx, w / 2, h - r * 2.6, 2, r, A.ground.top); for (let i = 0; i < 3; i++) { const bx = w / 2 + (rnd() - 0.5) * 22, by = h - 26 - rnd() * 20; ctx.strokeStyle = css(A.ground.topHi, 0.7); ctx.lineWidth = 1; circle(ctx, bx, by, 2 + rnd() * 2.5); ctx.stroke(); } },
  drum: (ctx, w, h, _rnd, A) => { for (let k = 0; k < 3; k++) { ctx.strokeStyle = css(A.ground.topHi, 0.55 - k * 0.15); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(w / 2, h - 4, 8 + k * 7, 3 + k * 2.2, 0, Math.PI, 0); ctx.stroke(); } crystal(ctx, w / 2, h - 3, 18, A.accent); },
  bones: (ctx, w, h, _rnd, A, v) => { if (v) { ctx.strokeStyle = css(darken(A.ground.body, 0.3)); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w / 2, h); ctx.lineTo(w / 2, h - 30); ctx.stroke(); glow(ctx, w / 2, h - 34, 16, A.accent, 0.7); ctx.fillStyle = css(lighten(A.accent, 0.4)); ctx.beginPath(); ctx.roundRect(w / 2 - 5, h - 42, 10, 13, 3); ctx.fill(); ctx.strokeStyle = css(darken(A.accent, 0.5)); ctx.lineWidth = 1; ctx.stroke(); } else { ctx.save(); ctx.translate(w / 2, h - 7); ctx.rotate(-0.25); const L = 24, r = 3.6; ctx.fillStyle = css(A.ground.top); ctx.fillRect(-L / 2, -2.6, L, 5.2); for (const s of [-1, 1]) for (const t of [-1, 1]) { circle(ctx, s * L / 2, t * 2.6, r); ctx.fill(); } ctx.restore(); } },
  spiral: (ctx, w, h, rnd, A) => { const [lo, hi] = A.tono ?? [0, 1]; const c = tono(lo + (hi - lo) * rnd()); for (let k = 0; k < 5; k++) { const t = (k - 2) / 2; taperHair(ctx, w / 2 + t * 5, h - 2, 30 * (1 - Math.abs(t) * 0.3) + rnd() * 6, -Math.PI / 2 + t * 0.3, t * 0.1, 2.6, lighten(A.ground.top, 0.2), 1, c); } },
  nerve: (ctx, w, h, _rnd, A) => { ctx.strokeStyle = css(lighten(A.ground.body, 0.3)); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w / 2, h); ctx.quadraticCurveTo(w / 2 + 6, h - 14, w / 2, h - 26); ctx.stroke(); glow(ctx, w / 2, h - 30, 16, A.accent, 0.8); ctx.fillStyle = css(lighten(A.accent, 0.7)); circle(ctx, w / 2, h - 30, 4); ctx.fill(); },
  stem: (ctx, w, h, rnd, A) => { crystal(ctx, w / 2 - 6, h - 1, 22 + rnd() * 6, A.accent); crystal(ctx, w / 2 + 7, h - 1, 14 + rnd() * 6, A.accent2); },
  cortex: (ctx, w, h, rnd, A) => { const branch = (x: number, y: number, len: number, ang: number, d: number) => { const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len; ctx.strokeStyle = css(A.ground.topLo); ctx.lineWidth = Math.max(1, d * 1.1); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke(); if (d <= 0) { glow(ctx, ex, ey, 5, A.accent, 0.8); return; } branch(ex, ey, len * 0.7, ang - 0.45, d - 1); branch(ex, ey, len * 0.7, ang + 0.45, d - 1); }; branch(w / 2, h - 1, 14, -Math.PI / 2 + (rnd() - 0.5) * 0.3, 2); },
};
export function accentTex(scene: Phaser.Scene, A: BiomeArt, R: number, v: number): string {
  return canvasTex(scene, `tr-acc-${A.id}-${v}-${R}`, 48, 64, R, (ctx, w, h) => ACCENT[A.motif]!(ctx, w, h, rng(hashStr(A.id) ^ (v * 31 + 7)), A, v));
}

// ---------------------------------------------------------------- kurulum
export interface TerrainOptions { variant?: 'ground' | 'slab'; accents?: boolean; depth?: number; fringe?: boolean }

/** tek dikdörtgenin görsel parçalarını içeren kap (kök: dikdörtgenin sol-üstü) */
export function terrainPiece(scene: Phaser.Scene, r: Rect, biomeId: string, o: TerrainOptions = {}): Phaser.GameObjects.Container {
  const A = artOf(biomeId); const R = renderResolution(); const gl = isWebGL(scene);
  const slab = (o.variant ?? (r.h < 90 ? 'slab' : 'ground')) === 'slab';
  const c = scene.add.container(r.x, r.y).setDepth(o.depth ?? 5);
  const w = Math.max(24, r.w), h = Math.max(slab ? 22 : 40, r.h);
  // gölge
  if (gl) { const s = scene.add.nineslice(-12, -4, shadowTex(scene), undefined, w + 24, h + 26, 34, 34, 34, 34).setOrigin(0, 0).setAlpha(slab ? 0.75 : 0.6); s.y += 10; c.add(s); }
  // gövde
  const bk = bodyTex(scene, A, R, slab);
  // dilimler dikdörtgenden büyük olamaz (dar sütun / alçak şerit)
  const s0 = slab ? { l: 18, r: 18, t: 16, b: 16 } : { l: 28, r: 28, t: 48, b: 40 };
  const lr = Math.min(s0.l, Math.floor(w / 2) - 1), tb = Math.min(1, (h - 2) / (s0.t + s0.b));
  const sl = { l: lr, r: lr, t: Math.floor(s0.t * tb), b: Math.floor(s0.b * tb) };
  if (gl) c.add(scene.add.nineslice(0, 0, bk, undefined, w * R, h * R, sl.l * R, sl.r * R, sl.t * R, sl.b * R).setOrigin(0, 0).setScale(1 / R));
  else c.add(scene.add.image(0, 0, bk).setOrigin(0, 0).setDisplaySize(w, h));
  // iç doku (yanlardan içeride; derinde söner)
  const inset = slab ? 10 : 14; const ph = slab ? Math.max(0, h - LIP_H - 8) : Math.min(h - LIP_H - 18, TILE - 4);
  if (ph > 6 && w > inset * 2 + 8) {
    const pk = patternTex(scene, A, R);
    const pt = scene.add.tileSprite(inset, LIP_H, (w - inset * 2) * R, ph * R, pk).setOrigin(0, 0).setScale(1 / R).setAlpha(slab ? 0.55 : 0.7);
    pt.tilePositionX = ((r.x + inset) * R) % (TILE * R);
    c.add(pt);
  }
  // üst kat (dudak): yanlardan 5 px taşar
  const lk = lipTex(scene, A, R); const over = 5; const lw = w + over * 2;
  const ls = Math.min(22, Math.floor(lw / 2) - 1);
  if (gl) c.add(scene.add.nineslice(-over, -3, lk, undefined, lw * R, (LIP_H + 12) * R, ls * R, ls * R, 0, 0).setOrigin(0, 0).setScale(1 / R));
  else c.add(scene.add.image(-over, -3, lk).setOrigin(0, 0).setDisplaySize(lw, LIP_H + 12));
  // saçak
  if (o.fringe !== false && lw > 28) {
    const fk = fringeTex(scene, A, R); const fx = 6, fw = lw - 12;
    const fr = scene.add.tileSprite(-over + fx, -3 - FT, fw * R, FH * R, fk).setOrigin(0, 0).setScale(1 / R);
    fr.tilePositionX = ((r.x - over + fx) * R) % (TILE * R);
    c.add(fr);
  }
  // süs aksesuarları
  if (o.accents !== false && w > 90) {
    const rnd = rng(hashStr(`${biomeId}:${Math.round(r.x)}:${Math.round(r.y)}`));
    const n = Math.floor(w / 170) + (rnd() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const ax = 26 + rnd() * (w - 52); const v = rnd() < 0.5 ? 0 : 1;
      const im = scene.add.image(ax, -1, accentTex(scene, A, R, v)).setOrigin(0.5, 1).setScale((0.8 + rnd() * 0.45) / R);
      if (rnd() < 0.5) im.setFlipX(true);
      c.add(im);
    }
  }
  return c;
}

/** yatayda bitişik, aynı üst çizgili ve aynı yükseklikteki dikdörtgenleri birleştirir (ek yerinde çentik olmasın) */
export function mergeRects(rects: Rect[]): Rect[] {
  const s = [...rects].sort((a, b) => a.y - b.y || a.x - b.x); const out: Rect[] = [];
  for (const r of s) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.y - r.y) < 0.5 && Math.abs(last.h - r.h) < 0.5 && r.x <= last.x + last.w + 1) { last.w = Math.max(last.w, r.x + r.w - last.x); continue; }
    out.push({ ...r });
  }
  return out;
}

/** Katı zeminlerin görselini toptan kurar. Dönüş: dikdörtgen başına bir kap (motor yok ederken kullanır). */
export function makeTerrain(scene: Phaser.Scene, rects: Rect[], biomeId: string): Phaser.GameObjects.GameObject[] {
  return mergeRects(rects).map((r) => terrainPiece(scene, r, biomeId));
}
