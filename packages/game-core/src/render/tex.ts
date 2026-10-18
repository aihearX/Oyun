/** Paylaşılan küçük dokular (ışık, halka, parıltı, nota, koklea…) — efektler, öğeler ve HUD birlikte kullanır. */
import type Phaser from 'phaser';
import { canvasTex, circle, css, glow, notePath, renderResolution, spiralPath, THEME, type Ctx } from './util';

export const R = () => renderResolution();
/** R ölçekli doku (tasarım w×h) */
export const T = (scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx, w: number, h: number) => void) => canvasTex(scene, `${key}@${R()}`, w, h, R(), draw);
/** R ölçekli dokudan tasarım boyutunda görüntü */
export function I(scene: Phaser.Scene, key: string, x = 0, y = 0): Phaser.GameObjects.Image { return scene.add.image(x, y, key).setScale(1 / R()); }

/** yumuşak beyaz ışık (renklendirilir, toplamsal) */
export const softGlowTex = (scene: Phaser.Scene) => canvasTex(scene, 'rx-glow', 128, 128, 1, (ctx) => { const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(0.6, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); });
export const ringTex = (scene: Phaser.Scene) => canvasTex(scene, 'rx-ring', 128, 128, 1, (ctx) => { ctx.strokeStyle = 'rgba(255,255,255,1)'; ctx.lineWidth = 5; circle(ctx, 64, 64, 58); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 12; circle(ctx, 64, 64, 54); ctx.stroke(); });
export const sparkTex = (scene: Phaser.Scene) => canvasTex(scene, 'rx-spark', 32, 32, 1, (ctx) => {
  glow(ctx, 16, 16, 16, 0xffffff, 0.5); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(16, 1); ctx.quadraticCurveTo(17.5, 14.5, 31, 16); ctx.quadraticCurveTo(17.5, 17.5, 16, 31); ctx.quadraticCurveTo(14.5, 17.5, 1, 16); ctx.quadraticCurveTo(14.5, 14.5, 16, 1); ctx.fill();
});
export const dotTex = (scene: Phaser.Scene) => canvasTex(scene, 'rx-dot', 16, 16, 1, (ctx) => { glow(ctx, 8, 8, 8, 0xffffff, 1); circle(ctx, 8, 8, 3); ctx.fillStyle = '#fff'; ctx.fill(); });
export const puffTex = (scene: Phaser.Scene) => canvasTex(scene, 'rx-puff', 48, 48, 1, (ctx) => { const g = ctx.createRadialGradient(20, 20, 2, 24, 24, 22); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; circle(ctx, 24, 24, 22); ctx.fill(); });

/** altın nota (HUD ve sahne aynı çizimi kullanır) */
export function drawGoldNote(ctx: Ctx, x: number, y: number, s: number, halo = true) {
  if (halo) glow(ctx, x, y, s * 1.05, THEME.gold, 0.55);
  ctx.save(); ctx.translate(1.2, 1.6); notePath(ctx, x, y, s); ctx.fillStyle = 'rgba(80,30,0,0.45)'; ctx.fill(); ctx.restore();
  notePath(ctx, x, y, s);
  const g = ctx.createLinearGradient(0, y - s * 0.55, 0, y + s * 0.5); g.addColorStop(0, '#fff6c4'); g.addColorStop(0.45, css(THEME.gold)); g.addColorStop(1, css(THEME.gold2));
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#8a4500'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(x - s * 0.27, y + s * 0.22, s * 0.08, s * 0.05, -0.5, 0, Math.PI * 2); ctx.fill();
}
/** altın koklea (salyangoz kabuğu spirali) */
export function drawGoldCochlea(ctx: Ctx, x: number, y: number, r: number, lit = true) {
  if (lit) glow(ctx, x, y, r * 1.45, THEME.gold, 0.6);
  const base = lit ? THEME.gold : 0x3a2c78;
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
  g.addColorStop(0, css(lit ? 0xfff6c4 : 0x5a4aa0)); g.addColorStop(0.55, css(base)); g.addColorStop(1, css(lit ? THEME.gold2 : 0x241a52));
  circle(ctx, x, y, r); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = lit ? '#8a4500' : 'rgba(170,150,255,0.55)'; ctx.lineWidth = Math.max(1, r * 0.09); ctx.stroke();
  ctx.save(); ctx.lineCap = 'round';
  spiralPath(ctx, x + r * 0.05, y + r * 0.05, r * 0.82, 2.2, 1, 90); ctx.strokeStyle = lit ? 'rgba(138,69,0,0.85)' : 'rgba(170,150,255,0.5)'; ctx.lineWidth = Math.max(1, r * 0.13); ctx.stroke();
  if (lit) { spiralPath(ctx, x - r * 0.04, y - r * 0.06, r * 0.82, 2.2, 1, 90); ctx.strokeStyle = 'rgba(255,250,220,0.75)'; ctx.lineWidth = Math.max(0.6, r * 0.05); ctx.stroke(); }
  ctx.restore();
  if (lit) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(x - r * 0.45, y - r * 0.5, r * 0.16, r * 0.09, -0.7, 0, Math.PI * 2); ctx.fill(); }
}
/** cam panel (HUD, tabela) */
export function glassPanel(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, rim = THEME.gold, rimA = 0.55) {
  ctx.save(); ctx.shadowColor = 'rgba(5,0,25,0.55)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, css(0x3a2788, 0.88)); g.addColorStop(1, css(0x1a1046, 0.9)); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  const sh = ctx.createLinearGradient(0, y, 0, y + h * 0.55); sh.addColorStop(0, 'rgba(255,255,255,0.16)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sh; ctx.fillRect(x, y, w, h * 0.55);
  ctx.restore();
  ctx.beginPath(); ctx.roundRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5, r - 0.5); ctx.strokeStyle = css(rim, rimA); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(x + 2.5, y + 2.5, w - 5, h - 5, Math.max(1, r - 2.5)); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.stroke();
}
