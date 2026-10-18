/**
 * Mekanik öğeler ve özel platformlar: yay, trambolin (kulak zarı), dişli (kemikçik), akıntı, çevirici, fırlatıcı (kulak borusu),
 * kanca, anahtar/kapı, frekans kapısı, sıvı, yerçekimi bölgesi, kontrol noktası, bölüm kapısı, fısıltı, süs, tabela,
 * hareketli/yükselen/tırmanılır/çatlak/ritim/yankı platformları. Etkileşim = altın/turkuaz parıltı.
 */
import Phaser from 'phaser';
import type { BiomeArt } from './palette';
import { EntityView } from './view';
import { I, R, T, glassPanel, softGlowTex, sparkTex, ringTex } from './tex';
import { halo } from './items';
import { terrainPiece, accentTex, LIP_H } from './terrain';
import { circle, css, darken, FONT, glow, hashStr, lighten, mix, roundRectPath, spiralPath, THEME, tono } from './util';

const ADD = Phaser.BlendModes.ADD;
const ID_COLORS = [THEME.gold, THEME.teal, THEME.coral, THEME.violet, THEME.lime];
export const idColor = (id: unknown) => ID_COLORS[hashStr(String(id ?? '0')) % ID_COLORS.length]!;

// ---------------------------------------------------------------- dokular
const springTex = (s: Phaser.Scene) => T(s, 'mc-spring', 44, 52, (ctx) => {
  ctx.fillStyle = 'rgba(10,0,30,0.4)'; ctx.beginPath(); ctx.ellipse(22, 49, 18, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  const bg = ctx.createLinearGradient(0, 40, 0, 50); bg.addColorStop(0, '#5a4aa0'); bg.addColorStop(1, '#241a52');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(6, 40, 32, 9, 4); ctx.fill(); ctx.strokeStyle = css(THEME.gold); ctx.lineWidth = 1.4; ctx.stroke();
  ctx.lineCap = 'round';
  for (const [lw, c] of [[5, '#0a6a66'], [3, css(THEME.teal)], [1, 'rgba(255,255,255,0.8)']] as [number, string][]) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(22, 41); for (let i = 0; i < 5; i++) { ctx.lineTo(i % 2 ? 30 : 14, 37 - i * 5); } ctx.lineTo(22, 14); ctx.stroke(); }
});
const springCapTex = (s: Phaser.Scene) => T(s, 'mc-springcap', 40, 26, (ctx) => {
  glow(ctx, 20, 14, 20, THEME.teal, 0.55);
  const g = ctx.createRadialGradient(15, 8, 1, 20, 14, 14); g.addColorStop(0, '#e9fffd'); g.addColorStop(0.6, css(THEME.teal)); g.addColorStop(1, '#0a8a84');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(20, 14, 14, 9, 0, Math.PI, 0); ctx.quadraticCurveTo(34, 20, 20, 20); ctx.quadraticCurveTo(6, 20, 6, 14); ctx.fill(); ctx.strokeStyle = '#06514e'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(14, 9, 4, 2, -0.4, 0, Math.PI * 2); ctx.fill();
});
const trampTex = (s: Phaser.Scene, w: number) => T(s, `mc-tramp-${w}`, w + 8, 34, (ctx, W) => {
  const cx = W / 2, rx = w / 2, ry = 8;
  ctx.fillStyle = 'rgba(10,0,30,0.45)'; ctx.beginPath(); ctx.ellipse(cx, 31, rx * 0.95, 3, 0, 0, Math.PI * 2); ctx.fill();
  // ayaklar
  ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (const sx of [-0.7, 0.7]) { ctx.beginPath(); ctx.moveTo(cx + sx * rx, 18); ctx.lineTo(cx + sx * rx * 1.05, 30); ctx.stroke(); }
  // ön kalınlık (altın çerçeve)
  const fg = ctx.createLinearGradient(0, 10, 0, 22); fg.addColorStop(0, '#fff1a8'); fg.addColorStop(0.5, css(THEME.gold)); fg.addColorStop(1, '#a35a00');
  ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(cx, 12, rx, ry, 0, 0, Math.PI); ctx.lineTo(cx - rx, 18); ctx.ellipse(cx, 18, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#6a3a00'; ctx.lineWidth = 1.2; ctx.stroke();
  // zar
  const mg = ctx.createRadialGradient(cx - rx * 0.3, 10, 2, cx, 12, rx); mg.addColorStop(0, '#fff0f8'); mg.addColorStop(0.6, '#ff9ec8'); mg.addColorStop(1, '#d0508a');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(cx, 12, rx - 3, ry - 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx, 12, rx - 3, ry - 2, 0, 0, Math.PI * 2); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.8;
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + 3, 13); ctx.lineTo(cx + Math.cos(a) * rx, 12 + Math.sin(a) * ry); ctx.stroke(); }
  for (const k of [0.35, 0.65]) { ctx.beginPath(); ctx.ellipse(cx + 2, 12.5, rx * k, ry * k, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = '#fff6c4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, 12, rx - 1.5, ry - 1, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
});
const gearTex = (s: Phaser.Scene, r: number) => T(s, `mc-gear-${r}`, r * 2 + 8, r * 2 + 8, (ctx, W) => {
  const c = W / 2; const teeth = Math.max(8, Math.round(r / 5));
  ctx.save(); ctx.shadowColor = 'rgba(10,0,30,0.55)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) { const a = (i / (teeth * 2)) * Math.PI * 2; const rr = i % 2 ? r * 0.82 : r; const da = Math.PI / (teeth * 2) * 0.62; ctx.lineTo(c + Math.cos(a - da) * rr, c + Math.sin(a - da) * rr); ctx.lineTo(c + Math.cos(a + da) * rr, c + Math.sin(a + da) * rr); }
  ctx.closePath(); const g = ctx.createRadialGradient(c - r * 0.35, c - r * 0.35, r * 0.1, c, c, r); g.addColorStop(0, '#fffdf4'); g.addColorStop(0.6, '#e8dcc0'); g.addColorStop(1, '#a8987a');
  ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#5a4a30'; ctx.lineWidth = 1.6; ctx.stroke();
  // gözenekli kemik dokusu
  for (let i = 0; i < r * 0.6; i++) { const a = Math.random() * Math.PI * 2, d = r * (0.35 + Math.random() * 0.4); ctx.fillStyle = 'rgba(120,100,70,0.35)'; ctx.beginPath(); ctx.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d, 1 + Math.random() * 2, 0.8 + Math.random(), a, 0, Math.PI * 2); ctx.fill(); }
  // altın göbek ve kollar
  ctx.strokeStyle = '#b07a20'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * r * 0.2, c + Math.sin(a) * r * 0.2); ctx.lineTo(c + Math.cos(a) * r * 0.6, c + Math.sin(a) * r * 0.6); ctx.stroke(); }
  const hg = ctx.createRadialGradient(c - 3, c - 3, 1, c, c, r * 0.22); hg.addColorStop(0, '#fff3b0'); hg.addColorStop(1, css(THEME.gold2)); circle(ctx, c, c, r * 0.22); ctx.fillStyle = hg; ctx.fill(); ctx.strokeStyle = '#8a4500'; ctx.lineWidth = 1.4; ctx.stroke();
  glow(ctx, c, c, r * 0.12, 0xffffff, 0.8);
});
const grabRingTex = (s: Phaser.Scene, r: number) => T(s, `mc-grab-${r}`, r * 2 + 8, r * 2 + 8, (ctx, W) => {
  ctx.strokeStyle = css(THEME.teal, 0.75); ctx.lineWidth = 2.2; ctx.setLineDash([7, 7]); circle(ctx, W / 2, W / 2, r); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = css(THEME.teal, 0.2); ctx.lineWidth = 7; circle(ctx, W / 2, W / 2, r); ctx.stroke();
});
const chevronTex = (s: Phaser.Scene, c: number, key: string) => T(s, `mc-chev-${key}`, 64, 64, (ctx) => {
  ctx.strokeStyle = css(c, 0.9); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const y of [16, 48]) for (const x of [12, 44]) { ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 8); ctx.stroke(); }
});
const chevronUpTex = (s: Phaser.Scene, c: number, key: string) => T(s, `mc-chevup-${key}`, 64, 64, (ctx) => {
  ctx.strokeStyle = css(c, 0.9); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const y of [16, 48]) for (const x of [16, 48]) { ctx.beginPath(); ctx.moveTo(x - 8, y + 4); ctx.lineTo(x, y - 4); ctx.lineTo(x + 8, y + 4); ctx.stroke(); }
});
const flipTex = (s: Phaser.Scene) => T(s, 'mc-flip', 56, 56, (ctx) => {
  glow(ctx, 28, 28, 28, THEME.violet, 0.55);
  const g = ctx.createRadialGradient(22, 20, 2, 28, 28, 20); g.addColorStop(0, '#e6dcff'); g.addColorStop(0.6, css(THEME.violet)); g.addColorStop(1, '#3a2290');
  circle(ctx, 28, 28, 19); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#e6dcff'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.save(); ctx.lineCap = 'round'; spiralPath(ctx, 28, 28, 14, 1.6, 1, 60); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2a1670'; ctx.lineWidth = 1.2;
  for (const sy of [-1, 1]) { ctx.beginPath(); ctx.moveTo(28, 28 + sy * 14); ctx.lineTo(35, 28 + sy * 6); ctx.lineTo(31, 28 + sy * 6); ctx.lineTo(31, 28 + sy * 1); ctx.lineTo(25, 28 + sy * 1); ctx.lineTo(25, 28 + sy * 6); ctx.lineTo(21, 28 + sy * 6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
});
const hornTex = (s: Phaser.Scene) => T(s, 'mc-horn', 70, 48, (ctx) => {
  // kulak borusu: sağa bakan pirinç boru
  const p = () => { ctx.beginPath(); ctx.moveTo(4, 20); ctx.lineTo(30, 18); ctx.bezierCurveTo(46, 16, 56, 6, 64, 2); ctx.quadraticCurveTo(70, 24, 64, 46); ctx.bezierCurveTo(56, 42, 46, 32, 30, 30); ctx.lineTo(4, 28); ctx.closePath(); };
  ctx.save(); ctx.shadowColor = 'rgba(10,0,30,0.5)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2; p(); const g = ctx.createLinearGradient(0, 0, 0, 48); g.addColorStop(0, '#fff1a8'); g.addColorStop(0.45, css(THEME.gold)); g.addColorStop(1, '#a35a00'); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#6a3a00'; ctx.lineWidth = 1.5; p(); ctx.stroke();
  // ağız (içi turkuaz ışık)
  const ig = ctx.createRadialGradient(64, 24, 1, 64, 24, 20); ig.addColorStop(0, '#e9fffd'); ig.addColorStop(0.5, css(THEME.teal)); ig.addColorStop(1, '#06514e');
  ctx.fillStyle = ig; ctx.beginPath(); ctx.ellipse(64, 24, 5.5, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#6a3a00'; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(8, 21.5); ctx.lineTo(30, 20); ctx.bezierCurveTo(44, 18, 52, 10, 60, 6); ctx.stroke();
  for (const x of [14, 24]) { ctx.fillStyle = '#a35a00'; ctx.fillRect(x, 18.5, 3, 10.5); }
});
const hookTex = (s: Phaser.Scene) => T(s, 'mc-hook', 48, 56, (ctx) => {
  glow(ctx, 24, 32, 24, THEME.teal, 0.5);
  ctx.fillStyle = '#3a2c78'; ctx.beginPath(); ctx.roundRect(19, 2, 10, 10, 3); ctx.fill(); ctx.strokeStyle = css(THEME.gold); ctx.lineWidth = 1.2; ctx.stroke();
  ctx.strokeStyle = '#8a4500'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(24, 12); ctx.lineTo(24, 18); ctx.stroke();
  ctx.lineWidth = 7.5; ctx.strokeStyle = '#7a4a00'; circle(ctx, 24, 32, 12.5); ctx.stroke();
  const g = ctx.createLinearGradient(0, 18, 0, 46); g.addColorStop(0, '#fff1a8'); g.addColorStop(0.5, css(THEME.gold)); g.addColorStop(1, css(THEME.gold2));
  ctx.lineWidth = 5; ctx.strokeStyle = g; circle(ctx, 24, 32, 12.5); ctx.stroke();
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(24, 32, 13.5, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  glow(ctx, 24, 32, 9, 0xe9fffd, 0.7);
});
const switchTex = (s: Phaser.Scene, c: number, pressed: boolean) => T(s, `mc-switch-${c.toString(16)}-${pressed ? 1 : 0}`, 52, 30, (ctx) => {
  ctx.fillStyle = 'rgba(10,0,30,0.45)'; ctx.beginPath(); ctx.ellipse(26, 27, 24, 3, 0, 0, Math.PI * 2); ctx.fill();
  const bg = ctx.createLinearGradient(0, 18, 0, 28); bg.addColorStop(0, '#4a3a90'); bg.addColorStop(1, '#1a1046');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(2, 18, 48, 10, 4); ctx.fill(); ctx.strokeStyle = css(THEME.gold, 0.9); ctx.lineWidth = 1.3; ctx.stroke();
  const top = pressed ? 15 : 6;
  if (!pressed) glow(ctx, 26, top + 6, 18, c, 0.4); else glow(ctx, 26, 16, 24, c, 0.65);
  const g = ctx.createLinearGradient(0, top, 0, 19); g.addColorStop(0, css(lighten(c, 0.55))); g.addColorStop(1, css(darken(c, 0.25)));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(9, 19); ctx.quadraticCurveTo(10, top, 26, top); ctx.quadraticCurveTo(42, top, 43, 19); ctx.closePath(); ctx.fill(); ctx.strokeStyle = css(darken(c, 0.55)); ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(19, top + 3, 5, 1.6, -0.2, 0, Math.PI * 2); ctx.fill();
  if (!pressed) { ctx.fillStyle = css(darken(c, 0.6)); ctx.beginPath(); ctx.moveTo(22, top + 4); ctx.lineTo(30, top + 4); ctx.lineTo(26, top + 9); ctx.closePath(); ctx.fill(); }
});
const capTex = (s: Phaser.Scene, w: number, c: number) => T(s, `mc-cap-${w}-${c.toString(16)}`, w + 12, 16, (ctx, W) => {
  const g = ctx.createLinearGradient(0, 0, 0, 16); g.addColorStop(0, '#5a4aa0'); g.addColorStop(1, '#1a1046');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(1, 1, W - 2, 14, 5); ctx.fill(); ctx.strokeStyle = css(THEME.gold); ctx.lineWidth = 1.4; ctx.stroke();
  glow(ctx, W / 2, 8, 6, c, 0.9); ctx.fillStyle = css(lighten(c, 0.5)); circle(ctx, W / 2, 8, 2.5); ctx.fill();
});
const lanternTex = (s: Phaser.Scene, lit: boolean) => T(s, `mc-lantern-${lit ? 1 : 0}`, 48, 92, (ctx) => {
  // sap
  ctx.strokeStyle = '#2a1a5a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(24, 90); ctx.quadraticCurveTo(20, 60, 24, 36); ctx.stroke();
  ctx.strokeStyle = 'rgba(200,180,255,0.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(23, 88); ctx.quadraticCurveTo(19, 60, 23, 38); ctx.stroke();
  ctx.fillStyle = '#2a1a5a'; ctx.beginPath(); ctx.ellipse(24, 89, 10, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  // fener (kulak biçimli tüylü hücre başı)
  if (lit) glow(ctx, 24, 22, 24, THEME.gold, 0.7);
  const g = ctx.createRadialGradient(20, 15, 1, 24, 22, 15);
  if (lit) { g.addColorStop(0, '#fffbe0'); g.addColorStop(0.5, css(THEME.gold)); g.addColorStop(1, css(THEME.gold2)); } else { g.addColorStop(0, '#6a5ab0'); g.addColorStop(1, '#2a1a5a'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(24, 38); ctx.bezierCurveTo(10, 34, 8, 14, 18, 8); ctx.bezierCurveTo(26, 3, 38, 8, 38, 20); ctx.bezierCurveTo(38, 30, 30, 32, 24, 38); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = lit ? '#8a4500' : 'rgba(180,160,255,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = lit ? 'rgba(138,69,0,0.6)' : 'rgba(180,160,255,0.35)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(25, 20, 6, Math.PI * 0.8, Math.PI * 2.1); ctx.stroke();
  // tüyler
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.32; ctx.strokeStyle = lit ? css(THEME.gold) : '#6a5ab0'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(24 + Math.cos(a) * 12, 18 + Math.sin(a) * 12); ctx.lineTo(24 + Math.cos(a) * 18, 18 + Math.sin(a) * 18); ctx.stroke(); if (lit) glow(ctx, 24 + Math.cos(a) * 18, 18 + Math.sin(a) * 18, 3, 0xffffff, 0.9); }
});
const gateTex = (s: Phaser.Scene, A: BiomeArt) => T(s, `mc-gate-${A.id}`, 130, 190, (ctx) => {
  const cx = 65;
  ctx.fillStyle = 'rgba(10,0,30,0.5)'; ctx.beginPath(); ctx.ellipse(cx, 184, 60, 6, 0, 0, Math.PI * 2); ctx.fill();
  // iç portal
  const inner = () => { ctx.beginPath(); ctx.moveTo(cx - 38, 182); ctx.lineTo(cx - 38, 70); ctx.bezierCurveTo(cx - 38, 26, cx + 38, 26, cx + 38, 70); ctx.lineTo(cx + 38, 182); ctx.closePath(); };
  inner(); const pg = ctx.createLinearGradient(0, 30, 0, 182); pg.addColorStop(0, '#fff3c4'); pg.addColorStop(0.35, css(THEME.violet)); pg.addColorStop(0.75, css(A.accent2 === THEME.gold ? THEME.teal : A.accent2)); pg.addColorStop(1, '#1a0a40');
  ctx.fillStyle = pg; ctx.fill();
  ctx.save(); inner(); ctx.clip(); for (let i = 0; i < 6; i++) { ctx.strokeStyle = `rgba(255,255,255,${0.25 - i * 0.03})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, 120, 10 + i * 9, 18 + i * 14, 0, 0, Math.PI * 2); ctx.stroke(); } glow(ctx, cx, 92, 40, 0xffffff, 0.6); ctx.restore();
  // çerçeve
  const frame = () => { ctx.beginPath(); ctx.moveTo(cx - 52, 184); ctx.lineTo(cx - 52, 70); ctx.bezierCurveTo(cx - 52, 8, cx + 52, 8, cx + 52, 70); ctx.lineTo(cx + 52, 184); ctx.lineTo(cx + 38, 184); ctx.lineTo(cx + 38, 70); ctx.bezierCurveTo(cx + 38, 26, cx - 38, 26, cx - 38, 70); ctx.lineTo(cx - 38, 184); ctx.closePath(); };
  ctx.save(); ctx.shadowColor = 'rgba(10,0,30,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  frame(); const fg = ctx.createLinearGradient(cx - 52, 0, cx + 52, 0); fg.addColorStop(0, '#a35a00'); fg.addColorStop(0.3, '#fff1a8'); fg.addColorStop(0.55, css(THEME.gold)); fg.addColorStop(1, '#8a4500');
  ctx.fillStyle = fg; ctx.fill(); ctx.restore(); frame(); ctx.strokeStyle = '#5a2a00'; ctx.lineWidth = 1.8; ctx.stroke();
  // süs taşları + kulak sarmalı kilit taşı
  for (let i = 0; i < 7; i++) { const t = i / 6; const a = Math.PI + t * Math.PI; const x = cx + Math.cos(a) * 45, y = 70 + Math.sin(a) * 50 * 0.95; if (i === 3) continue; circle(ctx, x, y, 3.4); ctx.fillStyle = i % 2 ? css(THEME.coral) : css(THEME.teal); ctx.fill(); ctx.strokeStyle = '#5a2a00'; ctx.lineWidth = 1; ctx.stroke(); glow(ctx, x - 1, y - 1, 2, 0xffffff, 0.9); }
  circle(ctx, cx, 20, 12); const kg = ctx.createRadialGradient(cx - 4, 16, 1, cx, 20, 12); kg.addColorStop(0, '#e6dcff'); kg.addColorStop(1, css(THEME.violet)); ctx.fillStyle = kg; ctx.fill(); ctx.strokeStyle = '#5a2a00'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.save(); spiralPath(ctx, cx, 20, 9, 2, 1, 60); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
  for (const sx of [-1, 1]) { ctx.fillStyle = '#5a2a00'; ctx.beginPath(); ctx.roundRect(cx + sx * 45 - 9, 176, 18, 8, 2); ctx.fill(); }
});
const spiritTex = (s: Phaser.Scene) => T(s, 'mc-spirit', 48, 48, (ctx) => {
  glow(ctx, 24, 24, 24, 0xe6dcff, 0.55);
  const g = ctx.createRadialGradient(19, 16, 2, 24, 24, 17); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c9c1ff');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(10, 30); ctx.bezierCurveTo(8, 12, 40, 10, 38, 28); ctx.quadraticCurveTo(38, 36, 31, 37); ctx.quadraticCurveTo(28, 44, 22, 41); ctx.quadraticCurveTo(15, 41, 13, 36); ctx.quadraticCurveTo(9, 34, 10, 30); ctx.fill();
  ctx.strokeStyle = 'rgba(120,100,220,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.strokeStyle = '#3a2a7a'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; for (const x of [19, 29]) { ctx.beginPath(); ctx.arc(x, 25, 2.8, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(24, 28.5, 2.5, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  ctx.fillStyle = 'rgba(255,140,180,0.55)'; for (const x of [15, 33]) { ctx.beginPath(); ctx.ellipse(x, 29.5, 2.6, 1.5, 0, 0, Math.PI * 2); ctx.fill(); }
});
const beatTex = (s: Phaser.Scene, c: number) => T(s, `mc-beat-${c.toString(16)}`, 96, 40, (ctx, W, H) => {
  roundRectPath(ctx, 2, 2, W - 4, H - 4, 12);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, css(mix(c, 0x2a1b63, 0.35), 0.95)); g.addColorStop(1, css(mix(c, 0x140c35, 0.75), 0.95)); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = css(lighten(c, 0.4)); ctx.lineWidth = 2.5; ctx.stroke();
  roundRectPath(ctx, 5, 5, W - 10, H - 10, 9); ctx.strokeStyle = css(c, 0.5); ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.roundRect(10, 6, W - 20, 3, 2); ctx.fill();
});
const beatGhostTex = (s: Phaser.Scene, c: number) => T(s, `mc-beatg-${c.toString(16)}`, 96, 40, (ctx, W, H) => {
  ctx.setLineDash([6, 5]); roundRectPath(ctx, 2, 2, W - 4, H - 4, 12); ctx.strokeStyle = css(lighten(c, 0.3), 0.9); ctx.lineWidth = 2; ctx.stroke();
});
const echoTex = (s: Phaser.Scene) => T(s, 'mc-echo', 96, 40, (ctx, W, H) => {
  roundRectPath(ctx, 2, 2, W - 4, H - 4, 12); const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(180,255,250,0.55)'); g.addColorStop(1, 'rgba(46,230,214,0.12)'); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(220,255,252,0.95)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); roundRectPath(ctx, 2, 2, W - 4, H - 4, 12); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; for (let y = 6; y < H; y += 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } ctx.restore();
});
const crackTex = (s: Phaser.Scene, w: number, h: number) => T(s, `mc-crack-${w}x${h}`, w, h, (ctx, W, H) => {
  ctx.strokeStyle = 'rgba(20,0,20,0.85)'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const n = Math.max(2, Math.round(W / 40)); let seed = w * 31 + h; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < n; i++) { let x = (i + 0.5) * (W / n) + (r() - 0.5) * 10, y = 2; ctx.beginPath(); ctx.moveTo(x, y); while (y < H - 3) { x += (r() - 0.5) * 12; y += 4 + r() * 6; ctx.lineTo(x, Math.min(H - 2, y)); if (r() < 0.3) { ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 16, y + 5); ctx.moveTo(x, y); } } ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,220,200,0.35)'; ctx.lineWidth = 0.8; ctx.stroke();
});
const waterTex = (s: Phaser.Scene, A: BiomeArt) => T(s, `mc-water-${A.id}`, 8, 128, (ctx) => {
  const c = A.underwater ? lighten(A.accent, 0.1) : THEME.teal; const g = ctx.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, css(c, 0.5)); g.addColorStop(0.2, css(mix(c, 0x1a3a8a, 0.4), 0.45)); g.addColorStop(1, css(0x0a1a50, 0.6)); ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 128);
});
const surfaceTex = (s: Phaser.Scene) => T(s, 'mc-surface', 128, 16, (ctx, W) => {
  ctx.fillStyle = 'rgba(200,255,250,0.35)'; ctx.beginPath(); ctx.moveTo(0, 16); for (let x = 0; x <= W; x += 2) ctx.lineTo(x, 7 + Math.sin((x / W) * Math.PI * 4) * 3); ctx.lineTo(W, 16); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(240,255,255,0.95)'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 0; x <= W; x += 2) { const y = 7 + Math.sin((x / W) * Math.PI * 4) * 3; if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
});
const causticTex = (s: Phaser.Scene) => T(s, 'mc-caustic', 128, 128, (ctx, W, H) => {
  // yumuşak ışık ağı (su altı kostik): dalgalı ince çizgiler, kenarlar döşemeye uyumlu
  ctx.lineCap = 'round';
  for (let k = 0; k < 7; k++) {
    const y0 = (k + 0.5) * (H / 7); const ph = k * 1.7;
    for (const [lw, a] of [[5, 0.06], [1.6, 0.22]] as [number, number][]) { ctx.strokeStyle = `rgba(210,255,250,${a})`; ctx.lineWidth = lw; ctx.beginPath(); for (let x = 0; x <= W; x += 4) { const y = y0 + Math.sin((x / W) * Math.PI * 2 * 2 + ph) * 6 + Math.sin((x / W) * Math.PI * 2 * 3 + ph * 2) * 3; if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); }
  }
});

// ---------------------------------------------------------------- yardımcı
function textPill(scene: Phaser.Scene, text: string, maxW = 260): Phaser.GameObjects.Container {
  const t = scene.add.text(0, 0, text, { fontFamily: FONT, fontSize: '15px', fontStyle: '800', color: '#fff6e5', align: 'center', wordWrap: { width: maxW - 28 }, resolution: R() }).setOrigin(0.5);
  const w = Math.min(maxW, t.width + 30), h = t.height + 16;
  const key = T(scene, `mc-pill-${Math.round(w)}x${Math.round(h)}`, w + 12, h + 12, (ctx) => glassPanel(ctx, 6, 4, w, h, Math.min(16, h / 2)));
  const bg = I(scene, key, 0, 2);
  return scene.add.container(0, 0, [bg, t]);
}

// ---------------------------------------------------------------- kurucular
export function buildSpring(v: EntityView) {
  const base = I(v.scene, springTex(v.scene)).setOrigin(0.5, 1); v.add(base);
  const cap = I(v.scene, springCapTex(v.scene), 0, -38).setOrigin(0.5, 0.75); v.add(cap);
  v.tw({ targets: cap, y: -40, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  v.h.pulse = (p) => { if (p > 0.08) return; v.scene.tweens.add({ targets: base, scaleY: { from: base.scaleY * 0.6, to: base.scaleY }, duration: 320, ease: 'Back.Out' }); v.scene.tweens.add({ targets: cap, y: { from: -20, to: -38 }, duration: 320, ease: 'Back.Out' }); };
}
export function buildTrampoline(v: EntityView, w: number) {
  const ww = Math.max(56, Math.round(w / 8) * 8);
  const g = halo(v, THEME.coral, ww * 1.3, 0.25, 0, -14); g.setDisplaySize(ww * 1.5, 40);
  const t = I(v.scene, trampTex(v.scene, ww)).setOrigin(0.5, 1); v.add(t);
  v.h.pulse = (p) => { if (p > 0.08) return; v.scene.tweens.add({ targets: t, scaleY: { from: t.scaleY * 0.7, to: t.scaleY }, scaleX: { from: t.scaleX * 1.06, to: t.scaleX }, duration: 380, ease: 'Elastic.Out' }); const r = v.scene.add.image(v.x, v.y - 20, ringTex(v.scene)).setBlendMode(ADD).setTint(THEME.coral).setDepth(v.depth).setScale(0.2, 0.06); v.scene.tweens.add({ targets: r, scaleX: 0.9, scaleY: 0.22, alpha: 0, duration: 420, onComplete: () => r.destroy() }); };
  v.tw({ targets: g, alpha: 0.12, duration: 900, yoyo: true, repeat: -1 });
}
export function buildGear(v: EntityView, r: number, speed: number, dir: number) {
  const rr = Math.max(16, Math.round(r));
  const ring = I(v.scene, grabRingTex(v.scene, rr + 16)); v.add(ring);
  halo(v, THEME.gold, rr * 2.4, 0.18);
  const g = I(v.scene, gearTex(v.scene, rr)); v.add(g);
  const per = 4000 / Math.max(0.2, speed);
  v.tw({ targets: g, angle: dir < 0 ? -360 : 360, duration: per, repeat: -1 });
  v.tw({ targets: ring, angle: dir < 0 ? 360 : -360, duration: per * 3, repeat: -1 });
}
export function buildCurrent(v: EntityView, w: number, h: number, vx: number, vy: number) {
  const s = v.scene; const horiz = Math.abs(vx) >= Math.abs(vy);
  const body = s.add.graphics(); v.add(body);
  body.fillStyle(THEME.teal, 0.12); body.fillRoundedRect(0, 0, w, h, 14); body.lineStyle(1.5, THEME.teal, 0.35); body.strokeRoundedRect(0, 0, w, h, 14);
  const key = horiz ? chevronTex(s, 0xbff8f2, 'cur') : chevronUpTex(s, 0xbff8f2, 'cur');
  const ts = s.add.tileSprite(w / 2, h / 2, w - 8, h - 8, key).setBlendMode(ADD).setAlpha(0.45).setTileScale(1 / R(), 1 / R()); v.add(ts);
  if (horiz && vx < 0) ts.setFlipX(true); if (!horiz && vy > 0) ts.setFlipY(true);
  const span = 64 * R();
  if (horiz) v.tw({ targets: ts, tilePositionX: { from: span, to: 0 }, duration: 900, repeat: -1 }); else v.tw({ targets: ts, tilePositionY: { from: 0, to: span }, duration: 900, repeat: -1 });
}
export function buildFlip(v: EntityView) {
  const g = halo(v, THEME.violet, 90, 0.5);
  const f = I(v.scene, flipTex(v.scene)); v.add(f);
  v.tw({ targets: f, angle: { from: -10, to: 10 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  v.tw({ targets: g, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });
}
export function buildLauncher(v: EntityView, vx: number, vy: number) {
  const s = v.scene; const ang = Math.atan2(vy || -1, vx || 0);
  const base = s.add.graphics(); v.add(base);
  base.fillStyle(0x0a0020, 0.4); base.fillEllipse(0, -2, 44, 8);
  base.fillStyle(0x2a1a5a, 1); base.fillRoundedRect(-18, -14, 36, 13, 5); base.lineStyle(1.5, THEME.gold, 1); base.strokeRoundedRect(-18, -14, 36, 13, 5);
  const pivot = s.add.container(0, -18); v.add(pivot);
  const glowI = s.add.image(0, 0, softGlowTex(s)).setBlendMode(ADD).setTint(THEME.teal).setAlpha(0.5).setDisplaySize(60, 60); pivot.add(glowI);
  const horn = I(s, hornTex(s)).setOrigin(0.08, 0.5); pivot.add(horn);
  pivot.setRotation(ang);
  glowI.setPosition(Math.cos(0) * 52, 0);
  v.tw({ targets: glowI, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
  v.h.pulse = (p) => { if (p > 0.08) return; s.tweens.add({ targets: horn, scaleX: { from: horn.scaleX * 0.75, to: horn.scaleX }, scaleY: { from: horn.scaleY * 1.2, to: horn.scaleY }, duration: 360, ease: 'Back.Out' }); const r = s.add.image(v.x + Math.cos(ang) * 64, v.y - 18 + Math.sin(ang) * 64, ringTex(s)).setBlendMode(ADD).setTint(THEME.teal).setDepth(v.depth + 1).setScale(0.1); s.tweens.add({ targets: r, scale: 0.5, alpha: 0, duration: 400, onComplete: () => r.destroy() }); };
}
export function buildHook(v: EntityView, r: number) {
  const s = v.scene;
  if (r > 0) { const rg = I(s, grabRingTex(s, Math.round(r))).setAlpha(0.35); v.add(rg); v.tw({ targets: rg, angle: 360, duration: 20000, repeat: -1 }); }
  const g = halo(v, THEME.teal, 80, 0.5, 0, 6);
  const hk = I(s, hookTex(s), 0, 0); v.add(hk);
  v.tw({ targets: g, alpha: 0.2, scale: g.scale * 0.8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  v.tw({ targets: hk, angle: { from: -4, to: 4 }, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
}
export function buildSwitch(v: EntityView, id: unknown) {
  const c = idColor(id); const s = v.scene;
  const up = I(s, switchTex(s, c, false)).setOrigin(0.5, 1); const dn = I(s, switchTex(s, c, true)).setOrigin(0.5, 1).setVisible(false);
  const g = halo(v, c, 70, 0.35, 0, -10); v.add([up, dn]);
  v.tw({ targets: g, alpha: 0.12, duration: 800, yoyo: true, repeat: -1 });
  v.h.open = (o) => { up.setVisible(!o); dn.setVisible(o); g.setAlpha(o ? 0.7 : 0.35); if (o) { const r = s.add.image(v.x, v.y - 8, ringTex(s)).setBlendMode(ADD).setTint(c).setDepth(v.depth + 1).setScale(0.1, 0.04); s.tweens.add({ targets: r, scaleX: 0.7, scaleY: 0.2, alpha: 0, duration: 420, onComplete: () => r.destroy() }); } };
}
export function buildDoor(v: EntityView, w: number, h: number, id: unknown) {
  const c = idColor(id); const s = v.scene;
  const glowI = s.add.image(w / 2, h / 2, softGlowTex(s)).setBlendMode(ADD).setTint(c).setDisplaySize(w * 3.2, h * 1.1).setAlpha(0.4); v.add(glowI);
  const bars = s.add.container(0, 0); v.add(bars);
  const n = Math.max(2, Math.round(w / 12));
  const bg = s.add.graphics(); bg.fillStyle(mix(c, 0x140c35, 0.7), 0.55); bg.fillRect(2, 0, w - 4, h); bars.add(bg);
  for (let i = 0; i < n; i++) { const x = (i + 0.5) * (w / n); const b = s.add.graphics(); b.fillStyle(lighten(c, 0.3), 0.95); b.fillRoundedRect(x - 2, 0, 4, h, 2); b.fillStyle(0xffffff, 0.8); b.fillRect(x - 0.5, 0, 1, h); bars.add(b); }
  const lock = s.add.graphics(); bars.add(lock);
  lock.fillStyle(0x1a1046, 1); lock.fillCircle(w / 2, h / 2, 11); lock.lineStyle(2, c, 1); lock.strokeCircle(w / 2, h / 2, 11);
  lock.fillStyle(c, 1); lock.fillRoundedRect(w / 2 - 5, h / 2 - 2, 10, 8, 2); lock.lineStyle(2, c, 1); lock.beginPath(); lock.arc(w / 2, h / 2 - 2, 3.5, Math.PI, 0); lock.strokePath();
  const top = I(s, capTex(s, Math.round(w), c), w / 2, -4); const bot = I(s, capTex(s, Math.round(w), c), w / 2, h + 4); v.add([top, bot]);
  v.tw({ targets: glowI, alpha: 0.18, duration: 700, yoyo: true, repeat: -1 });
  let open = false;
  v.h.open = (o) => { if (o === open) return; open = o; s.tweens.killTweensOf(bars); s.tweens.add({ targets: bars, scaleY: o ? 0.02 : 1, alpha: o ? 0 : 1, duration: 360, ease: o ? 'Cubic.In' : 'Back.Out' }); glowI.setVisible(!o); };
}
export function buildFreqGate(v: EntityView, w: number, h: number, t: number) {
  const c = tono(t); const s = v.scene;
  const glowI = s.add.image(w / 2, h / 2, softGlowTex(s)).setBlendMode(ADD).setTint(c).setDisplaySize(w * 3, h * 1.1).setAlpha(0.45); v.add(glowI);
  const wall = s.add.graphics(); v.add(wall);
  wall.fillStyle(c, 0.32); wall.fillRoundedRect(0, 0, w, h, Math.min(12, w / 2)); wall.lineStyle(2.5, lighten(c, 0.45), 1); wall.strokeRoundedRect(0, 0, w, h, Math.min(12, w / 2));
  const waves = s.add.graphics(); v.add(waves);
  for (let k = 0; k < 3; k++) { waves.lineStyle(1.6, lighten(c, 0.6), 0.85 - k * 0.2); waves.beginPath(); for (let y = 4; y <= h - 4; y += 3) { const x = w / 2 + Math.sin(y / (6 + k * 3) + k) * (w * 0.3); if (y === 4) waves.moveTo(x, y); else waves.lineTo(x, y); } waves.strokePath(); }
  const emb = s.add.container(w / 2, h / 2); v.add(emb);
  const disc = s.add.graphics(); disc.fillStyle(0x1a1046, 0.95); disc.fillCircle(0, 0, 14); disc.lineStyle(2, lighten(c, 0.4), 1); disc.strokeCircle(0, 0, 14); emb.add(disc);
  const fk = s.add.graphics(); fk.lineStyle(2.6, lighten(c, 0.3), 1); fk.beginPath(); fk.moveTo(-4, -8); fk.lineTo(-4, 0); fk.arc(0, 0, 4, Math.PI, 0, true); fk.lineTo(4, -8); fk.moveTo(0, 4); fk.lineTo(0, 9); fk.strokePath(); emb.add(fk);
  v.tw({ targets: waves, alpha: 0.4, duration: 300, yoyo: true, repeat: -1 });
  v.tw({ targets: glowI, alpha: 0.2, duration: 800, yoyo: true, repeat: -1 });
  let open = false;
  v.h.open = (o) => { if (o === open) return; open = o; s.tweens.add({ targets: [wall, waves], alpha: o ? 0.12 : 1, duration: 300 }); glowI.setVisible(!o); emb.setScale(o ? 0.8 : 1).setAlpha(o ? 0.5 : 1); };
}
export function buildWater(v: EntityView, A: BiomeArt, w: number, h: number) {
  const s = v.scene;
  const body = I(s, waterTex(s, A), 0, 0).setOrigin(0, 0); body.setDisplaySize(w, h); v.add(body);
  const ca = s.add.tileSprite(w / 2, h / 2 + 6, w, h - 12, causticTex(s)).setBlendMode(ADD).setAlpha(0.3).setTileScale(1 / R(), 1 / R()); v.add(ca);
  const sf = s.add.tileSprite(w / 2, 4, w, 16, surfaceTex(s)).setTileScale(1 / R(), 1 / R()); v.add(sf);
  v.tw({ targets: sf, tilePositionX: { from: 0, to: 128 * R() }, duration: 2600, repeat: -1 });
  v.tw({ targets: ca, tilePositionX: { from: 0, to: 128 * R() }, tilePositionY: { from: 0, to: -128 * R() }, duration: 9000, repeat: -1 });
  const nb = Math.min(8, Math.max(2, Math.round(w * h / 30000)));
  for (let i = 0; i < nb; i++) { const b = s.add.image(8 + Math.random() * (w - 16), h - 6, sparkTex(s)).setScale(0.18 + Math.random() * 0.2).setAlpha(0.8).setTint(0xdffcff); v.add(b); v.tw({ targets: b, y: 10, alpha: 0, duration: 2600 + Math.random() * 2200, delay: Math.random() * 2400, repeat: -1 }); }
}
export function buildGravZone(v: EntityView, w: number, h: number) {
  const s = v.scene;
  const body = s.add.graphics(); v.add(body);
  body.fillStyle(THEME.violet, 0.16); body.fillRect(0, 0, w, h);
  for (const x of [0, w]) { const e = s.add.image(x, h / 2, softGlowTex(s)).setBlendMode(ADD).setTint(THEME.violet).setDisplaySize(26, h * 1.05).setAlpha(0.8); v.add(e); }
  body.lineStyle(2, 0xd6c8ff, 0.8); body.lineBetween(0, 0, 0, h); body.lineBetween(w, 0, w, h);
  const ts = s.add.tileSprite(w / 2, h / 2, w - 6, h, chevronUpTex(s, 0xd6c8ff, 'grav')).setBlendMode(ADD).setAlpha(0.4).setTileScale(1 / R(), 1 / R()); v.add(ts);
  v.tw({ targets: ts, tilePositionY: { from: 64 * R(), to: 0 }, duration: 1100, repeat: -1 });
}
export function buildCheckpoint(v: EntityView) {
  const s = v.scene;
  const g = halo(v, THEME.gold, 120, 0, 0, -70);
  const off = I(s, lanternTex(s, false)).setOrigin(0.5, 1); const on = I(s, lanternTex(s, true)).setOrigin(0.5, 1).setAlpha(0); v.add([off, on]);
  const rays = I(s, T(s, 'mc-rays', 128, 128, (ctx) => { ctx.translate(64, 64); for (let i = 0; i < 10; i++) { ctx.rotate(Math.PI / 5); const gg = ctx.createLinearGradient(0, 0, 0, -62); gg.addColorStop(0, 'rgba(255,230,160,0.5)'); gg.addColorStop(1, 'rgba(255,230,160,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-8, -62); ctx.lineTo(8, -62); ctx.lineTo(3, 0); ctx.closePath(); ctx.fill(); } }), 0, -70).setBlendMode(ADD).setAlpha(0); v.add(rays); v.sendToBack(rays); v.sendToBack(g);
  let lit = false;
  v.h.open = (o) => { if (o === lit) return; lit = o; s.tweens.add({ targets: on, alpha: o ? 1 : 0, duration: 260 }); s.tweens.add({ targets: [g], alpha: o ? 0.6 : 0, duration: 300 }); s.tweens.add({ targets: rays, alpha: o ? 0.9 : 0, duration: 400 }); if (o) { v.tw({ targets: rays, angle: 360, duration: 10000, repeat: -1 }); s.tweens.add({ targets: [on, off], scaleY: { from: on.scaleY * 0.85, to: on.scaleY }, duration: 420, ease: 'Back.Out' }); } };
}
export function buildGate(v: EntityView, A: BiomeArt) {
  const s = v.scene;
  const rays = I(s, T(s, 'mc-gaterays', 220, 220, (ctx) => { ctx.translate(110, 110); for (let i = 0; i < 14; i++) { ctx.rotate(Math.PI / 7); const gg = ctx.createLinearGradient(0, 0, 0, -108); gg.addColorStop(0, 'rgba(255,240,190,0.4)'); gg.addColorStop(1, 'rgba(255,240,190,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-14, -108); ctx.lineTo(14, -108); ctx.lineTo(5, 0); ctx.closePath(); ctx.fill(); } }), 0, -100).setBlendMode(ADD); v.add(rays);
  halo(v, THEME.gold, 260, 0.45, 0, -95);
  const gt = I(s, gateTex(s, A)).setOrigin(0.5, 1); v.add(gt);
  const swirl = s.add.image(0, -70, softGlowTex(s)).setBlendMode(ADD).setTint(0xfff1c4).setDisplaySize(70, 110).setAlpha(0.5); v.add(swirl);
  v.tw({ targets: rays, angle: 360, duration: 16000, repeat: -1 });
  v.tw({ targets: swirl, alpha: 0.2, scaleX: swirl.scaleX * 0.8, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  for (let i = 0; i < 6; i++) { const p = s.add.image((Math.random() - 0.5) * 60, -20, sparkTex(s)).setBlendMode(ADD).setScale(0.3).setTint(i % 2 ? THEME.gold : 0xffffff); v.add(p); v.tw({ targets: p, y: -150 - Math.random() * 30, x: p.x + (Math.random() - 0.5) * 30, alpha: { from: 1, to: 0 }, scale: { from: 0.4, to: 0.1 }, duration: 1800 + Math.random() * 1200, delay: i * 300, repeat: -1 }); }
}
export function buildEscortee(v: EntityView) {
  const g = halo(v, 0xd6c8ff, 70, 0.5);
  const sp = I(v.scene, spiritTex(v.scene)); v.add(sp);
  v.tw({ targets: [sp, g], y: '-=6', duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  v.tw({ targets: sp, angle: { from: -5, to: 5 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  v.h.facing = (d) => { sp.scaleX = Math.abs(sp.scaleX) * d; };
}
export function buildDecor(v: EntityView, A: BiomeArt, kind: string, scale: number) {
  const variant = kind === 'ot' || kind === 'damla' ? 0 : 1;
  const im = I(v.scene, accentTex(v.scene, A, R(), variant)).setOrigin(0.5, 1); im.setScale(im.scale * 1.7 * scale); v.add(im);
  if (kind === 'tuy' || kind === 'ot' || kind === 'hucre') v.tw({ targets: im, angle: { from: -4, to: 4 }, duration: 1600 + Math.random() * 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
}
export function buildText(v: EntityView, text: string) { v.add(textPill(v.scene, text)); }

// ---------------------------------------------------------------- platform türleri
export function buildPlatform(v: EntityView, A: BiomeArt, x: number, y: number, w: number, h: number, variant?: 'ground' | 'slab') {
  const p = terrainPiece(v.scene, { x, y, w, h }, A.id, { variant, accents: !variant || variant === 'ground' }); p.setPosition(0, 0); v.add(p); return p;
}
export function buildMoving(v: EntityView, A: BiomeArt, x: number, y: number, w: number, h: number, lift: boolean) {
  const s = v.scene; const c = lift ? THEME.teal : THEME.gold;
  const under = s.add.image(w / 2, h + 4, softGlowTex(s)).setBlendMode(ADD).setTint(c).setDisplaySize(w * 1.1, 34).setAlpha(0.55); v.add(under);
  buildPlatform(v, A, x, y, w, h, 'slab');
  for (const sx of [0.22, 0.78]) { const d = s.add.image(w * sx, h - 2, softGlowTex(s)).setBlendMode(ADD).setTint(c).setDisplaySize(18, 18); v.add(d); v.tw({ targets: d, alpha: 0.4, duration: 300 + sx * 200, yoyo: true, repeat: -1 }); }
  if (lift) { const ch = s.add.tileSprite(w / 2, h / 2 + 4, Math.min(64, w - 20), Math.max(12, h - 12), chevronUpTex(s, 0xd8fffb, 'lift')).setBlendMode(ADD).setAlpha(0.7).setTileScale(0.55 / R(), 0.55 / R()); v.add(ch); v.tw({ targets: ch, tilePositionY: { from: 64 * R(), to: 0 }, duration: 800, repeat: -1 }); }
  v.tw({ targets: under, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });
}
export function buildWall(v: EntityView, A: BiomeArt, x: number, y: number, w: number, h: number) {
  const s = v.scene; buildPlatform(v, A, x, y, w, h, w < 64 ? 'slab' : 'ground');
  const grips = s.add.graphics(); v.add(grips);
  for (let yy = LIP_H + 14; yy < h - 10; yy += 26) for (const sx of [2, w - 2]) { grips.fillStyle(THEME.teal, 0.25); grips.fillCircle(sx, yy, 6); grips.fillStyle(lighten(THEME.teal, 0.4), 0.9); grips.fillCircle(sx, yy, 2.6); }
  v.tw({ targets: grips, alpha: 0.55, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
}
export function buildCrumble(v: EntityView, A: BiomeArt, x: number, y: number, w: number, h: number) {
  const s = v.scene; const piece = buildPlatform(v, A, x, y, w, h, 'slab');
  const ck = I(s, crackTex(s, Math.round(w), Math.round(Math.max(16, h)))).setOrigin(0, 0).setAlpha(0.45); piece.add(ck);
  let broken = false; let shake: Phaser.Tweens.Tween | null = null;
  v.h.crack = (t) => {
    if (t <= 0) { broken = false; piece.setVisible(true).setPosition(0, 0).setAlpha(1); ck.setAlpha(0.45); shake?.remove(); shake = null; return; }
    if (broken) return;
    ck.setAlpha(0.45 + Math.min(1, t) * 0.55);
    if (!shake) shake = v.tw({ targets: piece, x: { from: -1.2, to: 1.2 }, duration: 50, yoyo: true, repeat: -1 });
    if (t >= 1) {
      broken = true; shake.remove(); shake = null; piece.setVisible(false);
      const n = Math.max(3, Math.round(w / 26));
      for (let i = 0; i < n; i++) {
        const cw = w / n; const ch = s.add.graphics().setDepth(v.depth);
        ch.fillStyle(A.ground.body, 1); ch.fillRoundedRect(-cw / 2, -h / 2, cw - 2, h, 6); ch.fillStyle(A.ground.top, 1); ch.fillRoundedRect(-cw / 2, -h / 2, cw - 2, Math.min(10, h / 2), 5);
        ch.setPosition(v.x + cw * (i + 0.5), v.y + h / 2);
        s.tweens.add({ targets: ch, y: ch.y + 220 + Math.random() * 80, x: ch.x + (Math.random() - 0.5) * 30, angle: (Math.random() - 0.5) * 120, alpha: 0, duration: 700 + Math.random() * 200, ease: 'Quad.In', onComplete: () => ch.destroy() });
      }
    }
  };
}
export function buildBeat(v: EntityView, w: number, h: number, pattern: string, A: BiomeArt) {
  const s = v.scene; const c = A.accent === THEME.gold || A.accent2 === THEME.gold ? THEME.gold : THEME.teal; const RR = R();
  const glowI = s.add.image(w / 2, h / 2, softGlowTex(s)).setBlendMode(ADD).setTint(c).setDisplaySize(w * 1.5, h * 3).setAlpha(0.3); v.add(glowI);
  const hh = Math.max(24, h);
  const body = s.add.nineslice(0, 0, beatTex(s, c), undefined, w * RR, hh * RR, 16 * RR, 16 * RR, 14 * RR, 14 * RR).setOrigin(0, 0).setScale(1 / RR); v.add(body);
  const ghost = s.add.nineslice(0, 0, beatGhostTex(s, c), undefined, w * RR, hh * RR, 16 * RR, 16 * RR, 14 * RR, 14 * RR).setOrigin(0, 0).setScale(1 / RR).setVisible(false); v.add(ghost);
  const pat = (pattern || '1010').slice(0, 8); const dots: Phaser.GameObjects.Arc[] = [];
  for (let i = 0; i < pat.length; i++) { const dx = w / 2 + (i - (pat.length - 1) / 2) * 11; const on = pat[i] === '1'; const d = s.add.circle(dx, hh / 2 + 1, on ? 3.2 : 2.2, on ? lighten(c, 0.5) : 0x6a5ab0, on ? 1 : 0.8); v.add(d); dots.push(d); }
  v.h.pulse = (p) => { const k = Math.pow(1 - Math.max(0, Math.min(1, p)), 2); glowI.setAlpha(0.18 + k * 0.6); body.setScale((1 / RR) * (1 + k * 0.04), (1 / RR) * (1 + k * 0.08)); body.setPosition(-w * k * 0.02, -hh * k * 0.04); };
  v.h.solid = (on) => { body.setVisible(on); ghost.setVisible(!on); glowI.setVisible(on); for (const d of dots) d.setAlpha(on ? 1 : 0.45); };
}
export function buildEcho(v: EntityView, w: number, h: number) {
  const s = v.scene; const RR = R(); const hh = Math.max(24, h);
  const glowI = s.add.image(w / 2, hh / 2, softGlowTex(s)).setBlendMode(ADD).setTint(THEME.teal).setDisplaySize(w * 1.4, hh * 3).setAlpha(0.45); v.add(glowI);
  const body = s.add.nineslice(0, 0, echoTex(s), undefined, w * RR, hh * RR, 16 * RR, 16 * RR, 14 * RR, 14 * RR).setOrigin(0, 0).setScale(1 / RR); v.add(body);
  v.setAlpha(0);
  v.tw({ targets: glowI, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
  v.h.reveal = (a) => { v.setAlpha(Math.max(0, Math.min(1, a))); };
}
