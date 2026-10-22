/**
 * Toplanabilirler ve tehlikeler: nota, jeton, büyük nota, altın koklea, güçlendirme, kabarcık, diyapazon,
 * diken, gürültü bulutu, gürültü duvarı, şerit engeli, ses mermisi.
 * Okunaklılık: tehlike = sıcak kırmızı/mor nabız; etkileşim/ödül = altın/turkuaz parıltı.
 */
import Phaser from 'phaser';
import type { BiomeArt } from './palette';
import { EntityView } from './view';
import { I, R, T, drawGoldCochlea, drawGoldNote, softGlowTex, sparkTex, ringTex } from './tex';
import { circle, css, darken, glow, heartPath, lighten, mix, rng, THEME, tono } from './util';

const ADD = Phaser.BlendModes.ADD;
export const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : d);

/** toplamsal ışık halesi */
export function halo(v: EntityView, color: number, size: number, alpha = 0.6, x = 0, y = 0): Phaser.GameObjects.Image {
  const g = v.scene.add.image(x, y, softGlowTex(v.scene)).setBlendMode(ADD).setTint(color).setAlpha(alpha).setDisplaySize(size, size);
  v.add(g); return g;
}
/** toplama patlaması: büyüyüp söner + parıltılar saçılır */
export function burst(v: EntityView, color: number, n = 8, ringC = color) {
  const s = v.scene; const wx = v.x, wy = v.y; const d = v.depth + 1;
  const ring = s.add.image(wx, wy, ringTex(s)).setBlendMode(ADD).setTint(ringC).setDepth(d).setScale(0.12).setAlpha(0.95);
  s.tweens.add({ targets: ring, scale: 0.6, alpha: 0, duration: 380, ease: 'Cubic.Out', onComplete: () => ring.destroy() });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4; const r = 26 + Math.random() * 22;
    const p = s.add.image(wx, wy, sparkTex(s)).setBlendMode(ADD).setTint(i % 2 ? color : 0xffffff).setDepth(d).setScale(0.35 + Math.random() * 0.3).setRotation(Math.random());
    s.tweens.add({ targets: p, x: wx + Math.cos(a) * r, y: wy + Math.sin(a) * r, scale: 0, angle: 180, duration: 420 + Math.random() * 200, ease: 'Cubic.Out', onComplete: () => p.destroy() });
  }
  v.tw({ targets: v, scale: v.scale * 1.45, alpha: 0, duration: 200, ease: 'Back.In', onComplete: () => v.destroy() });
}
function bob(v: EntityView, amp = 5, ms = 900) { v.tw({ targets: v.list.length ? v.list : v, y: `-=${amp}`, duration: ms + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.InOut' }); }

// ---------------------------------------------------------------- dokular
const coinTex = (s: Phaser.Scene) => T(s, 'it-coin', 34, 34, (ctx) => {
  glow(ctx, 17, 17, 17, THEME.gold, 0.35);
  circle(ctx, 17, 18.5, 12.5); ctx.fillStyle = '#9a4f00'; ctx.fill();
  const g = ctx.createLinearGradient(0, 4, 0, 30); g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, css(THEME.gold)); g.addColorStop(1, css(THEME.gold2));
  circle(ctx, 17, 17, 12.5); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#a35a00'; ctx.lineWidth = 1.4; ctx.stroke();
  circle(ctx, 17, 17, 9); ctx.strokeStyle = 'rgba(163,90,0,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
  // ses dalgası amblemi
  ctx.strokeStyle = '#b86a00'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(13.5, 17, 1.6, 0, Math.PI * 2); ctx.fillStyle = '#b86a00'; ctx.fill();
  for (const r of [4, 7]) { ctx.beginPath(); ctx.arc(13.5, 17, r, -0.75, 0.75); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(12, 10.5, 4, 2, -0.5, 0, Math.PI * 2); ctx.fill();
});
const noteTex = (s: Phaser.Scene) => T(s, 'it-note', 40, 44, (ctx) => drawGoldNote(ctx, 20, 22, 30, false));
const bigNoteTex = (s: Phaser.Scene) => T(s, 'it-bignote', 64, 64, (ctx) => {
  // çift nota (kirişli) — 5 nota değerinde
  const stroke = (p: () => void) => { ctx.save(); ctx.translate(1.5, 2); p(); ctx.fillStyle = 'rgba(80,30,0,0.45)'; ctx.fill(); ctx.restore(); p(); const g = ctx.createLinearGradient(0, 8, 0, 56); g.addColorStop(0, '#fff6c4'); g.addColorStop(0.45, css(THEME.gold)); g.addColorStop(1, css(THEME.gold2)); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#8a4500'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke(); };
  stroke(() => { ctx.beginPath(); ctx.ellipse(19, 46, 8.5, 6.2, -0.4, 0, Math.PI * 2); ctx.ellipse(45, 41, 8.5, 6.2, -0.4, 0, Math.PI * 2); ctx.rect(24.5, 14, 4, 32); ctx.rect(50.5, 9, 4, 32); ctx.moveTo(24.5, 14); ctx.lineTo(54.5, 7); ctx.lineTo(54.5, 15); ctx.lineTo(24.5, 22); ctx.closePath(); });
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(15, 44, 2.6, 1.5, -0.5, 0, Math.PI * 2); ctx.ellipse(41, 39, 2.6, 1.5, -0.5, 0, Math.PI * 2); ctx.fill();
});
const raysTex = (s: Phaser.Scene) => T(s, 'it-rays', 128, 128, (ctx) => {
  ctx.translate(64, 64);
  for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); const g = ctx.createLinearGradient(0, 0, 0, -62); g.addColorStop(0, 'rgba(255,240,180,0.55)'); g.addColorStop(1, 'rgba(255,240,180,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-9, -62); ctx.lineTo(9, -62); ctx.lineTo(4, 0); ctx.closePath(); ctx.fill(); }
});
const cochleaTex = (s: Phaser.Scene) => T(s, 'it-cochlea', 52, 52, (ctx) => drawGoldCochlea(ctx, 26, 26, 17));
const orbTex = (s: Phaser.Scene, kind: string) => T(s, `it-orb-${kind}`, 52, 52, (ctx) => {
  const c = kind === 'life' ? THEME.coral : kind === 'magnet' ? THEME.violet : kind === 'speed' ? THEME.lime : THEME.teal;
  glow(ctx, 26, 26, 26, c, 0.45);
  const g = ctx.createRadialGradient(20, 18, 2, 26, 26, 19); g.addColorStop(0, css(lighten(c, 0.55), 0.95)); g.addColorStop(0.7, css(c, 0.55)); g.addColorStop(1, css(darken(c, 0.35), 0.85));
  circle(ctx, 26, 26, 18); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = css(lighten(c, 0.6), 0.9); ctx.lineWidth = 1.6; ctx.stroke();
  ctx.save(); ctx.translate(26, 27); ctx.fillStyle = '#fff'; ctx.strokeStyle = css(darken(c, 0.55)); ctx.lineWidth = 1.4; ctx.lineJoin = 'round';
  switch (kind) {
    case 'life': heartPath(ctx, 0, 0, 18); ctx.fill(); ctx.stroke(); break;
    case 'magnet': ctx.beginPath(); ctx.arc(0, -1, 7, Math.PI, 0); ctx.lineTo(7, 7); ctx.lineTo(3, 7); ctx.lineTo(3, -1); ctx.arc(0, -1, 3, 0, Math.PI, true); ctx.lineTo(-3, 7); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = css(THEME.coral); ctx.fillRect(-7, 4, 4, 3); ctx.fillRect(3, 4, 4, 3); break;
    case 'speed': for (const dx of [-5, 2]) { ctx.beginPath(); ctx.moveTo(dx - 3, -7); ctx.lineTo(dx + 4, 0); ctx.lineTo(dx - 3, 7); ctx.lineTo(dx, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); } break;
    default: { // kalkan + kulak
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.quadraticCurveTo(7, -7, 8, -5); ctx.quadraticCurveTo(8, 5, 0, 10); ctx.quadraticCurveTo(-8, 5, -8, -5); ctx.quadraticCurveTo(-7, -7, 0, -9); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = css(darken(c, 0.4)); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0.5, -0.5, 3.6, Math.PI * 0.85, Math.PI * 2.2); ctx.quadraticCurveTo(3, 4, 0, 5); ctx.stroke();
    }
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(18, 15, 5, 2.6, -0.7, 0, Math.PI * 2); ctx.fill();
});
const bubbleTex = (s: Phaser.Scene) => T(s, 'it-bubble', 34, 34, (ctx) => {
  const g = ctx.createRadialGradient(13, 12, 2, 17, 17, 15); g.addColorStop(0, 'rgba(220,250,255,0.25)'); g.addColorStop(0.75, 'rgba(120,220,240,0.12)'); g.addColorStop(1, 'rgba(160,240,255,0.55)');
  circle(ctx, 17, 17, 14); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(200,250,255,0.9)'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(11.5, 11, 4, 2.2, -0.7, 0, Math.PI * 2); ctx.fill(); circle(ctx, 23, 24, 1.4); ctx.fill();
});
const forkTex = (s: Phaser.Scene, t: number) => T(s, `it-fork-${Math.round(t * 20)}`, 44, 60, (ctx) => {
  const c = tono(t); glow(ctx, 22, 26, 24, c, 0.5);
  const g = ctx.createLinearGradient(10, 0, 34, 0); g.addColorStop(0, css(lighten(c, 0.5))); g.addColorStop(0.5, css(c)); g.addColorStop(1, css(darken(c, 0.3)));
  ctx.strokeStyle = css(darken(c, 0.55)); ctx.lineWidth = 7.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const p = () => { ctx.beginPath(); ctx.moveTo(14, 6); ctx.lineTo(14, 26); ctx.quadraticCurveTo(14, 36, 22, 36); ctx.quadraticCurveTo(30, 36, 30, 26); ctx.lineTo(30, 6); ctx.moveTo(22, 36); ctx.lineTo(22, 54); };
  p(); ctx.stroke(); ctx.strokeStyle = g; ctx.lineWidth = 4.5; p(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(13, 8); ctx.lineTo(13, 24); ctx.stroke();
  circle(ctx, 22, 55, 3.5); ctx.fillStyle = css(darken(c, 0.2)); ctx.fill();
});
const spikeTex = (s: Phaser.Scene, A: BiomeArt, w: number) => T(s, `it-spike-${A.id}-${w}`, w, 34, (ctx, W) => {
  const n = Math.max(1, Math.round(W / 16)); const sw = W / n; const rnd = rng(w * 7 + 3);
  const base = mix(THEME.hazard, A.id === 'kanal' ? 0xff6a2c : 0xff3d6e, 0.5);
  // taban ışığı
  const bg = ctx.createLinearGradient(0, 18, 0, 34); bg.addColorStop(0, css(base, 0)); bg.addColorStop(1, css(base, 0.45)); ctx.fillStyle = bg; ctx.fillRect(0, 18, W, 16);
  for (let i = 0; i < n; i++) {
    const x0 = i * sw, cx = x0 + sw / 2 + (rnd() - 0.5) * 2, top = 4 + rnd() * 6;
    const p = () => { ctx.beginPath(); ctx.moveTo(x0 + 0.5, 34); ctx.quadraticCurveTo(cx - sw * 0.18, 20, cx, top); ctx.quadraticCurveTo(cx + sw * 0.18, 20, x0 + sw - 0.5, 34); ctx.closePath(); };
    p(); const g = ctx.createLinearGradient(x0, 0, x0 + sw, 0); g.addColorStop(0, css(lighten(base, 0.35))); g.addColorStop(0.55, css(base)); g.addColorStop(1, css(darken(base, 0.45)));
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = css(0x3a0418, 0.95); ctx.lineWidth = 1.4; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,240,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - 1, top + 3); ctx.quadraticCurveTo(cx - sw * 0.14, 22, x0 + 3.5, 32); ctx.stroke();
    glow(ctx, cx, top + 1, 4, 0xffffff, 0.8);
  }
});
const cloudTex = (s: Phaser.Scene, kind: string, w: number, h: number) => T(s, `it-cloud-${kind}-${w}x${h}`, w + 24, h + 24, (ctx, W, H) => {
  const rnd = rng(w * 13 + h); const cx = W / 2, cy = H / 2;
  const hot = kind === 'serumen' ? 0xff6a2c : THEME.hazard;
  const dark = kind === 'serumen' ? [0x7a3410, 0x2a0a04, 0xffa060] : [0x5a2470, 0x1e0a2e, 0xc080ff];
  // üstte kabarık tümsekler, altta düz yuvarlak taban
  const n = Math.max(3, Math.round(w / 30)); const puffs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; const r = (w / n) * (0.62 + rnd() * 0.18) * (1 - Math.abs(t - 0.5) * 0.5); puffs.push([12 + t * w, cy - h * 0.08 - Math.sin(t * Math.PI) * h * 0.12, Math.min(h * 0.5, r)]); }
  const path = () => { ctx.beginPath(); ctx.roundRect(12 + w * 0.04, cy - h * 0.05, w * 0.92, h * 0.5, h * 0.25); for (const [x, y, r] of puffs) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); } };
  glow(ctx, cx, cy, Math.max(w, h) * 0.62, hot, 0.3);
  ctx.save(); ctx.lineJoin = 'round'; path(); ctx.strokeStyle = css(hot, 0.9); ctx.lineWidth = 4; ctx.stroke(); path(); ctx.strokeStyle = css(dark[1]!); ctx.lineWidth = 2.2; ctx.stroke(); ctx.restore();
  path(); const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2); g.addColorStop(0, css(dark[0]!)); g.addColorStop(1, css(dark[1]!)); ctx.fillStyle = g; ctx.fill();
  ctx.save(); path(); ctx.clip();
  for (const [x, y, r] of puffs) { const rg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.45, 1, x, y, r); rg.addColorStop(0, css(dark[2]!, 0.5)); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  glow(ctx, cx, cy + h * 0.12, Math.min(w, h) * 0.6, hot, 0.55);
  // dalga biçimi (keskin gürültü)
  ctx.strokeStyle = css(lighten(hot, 0.5), 0.75); ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.beginPath();
  for (let x = 16; x <= W - 16; x += 5) { const y = cy + h * 0.16 + (rnd() - 0.5) * h * 0.28 * Math.sin(((x - 16) / (W - 32)) * Math.PI); if (x === 16) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke(); ctx.restore();
  // üst kenar parlaklığı
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.translate(0, 2.5); ctx.strokeStyle = css(dark[2]!, 0.55); ctx.lineWidth = 1.4; for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(x, y, r - 2, Math.PI * 1.15, Math.PI * 1.75); ctx.stroke(); } ctx.restore();
});
const zigTex = (s: Phaser.Scene, w: number, h: number) => T(s, `it-zig-${w}x${h}`, w, h, (ctx, W, H) => {
  // gürültü dalga biçimi (keskin, kırmızı-beyaz)
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const [lw, c] of [[6, css(THEME.hazard, 0.45)], [2.2, 'rgba(255,220,235,0.95)']] as [number, string][]) {
    ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); const r2 = rng(w + h * 3);
    for (let x = W * 0.15; x <= W * 0.85; x += 6) { const y = H / 2 + (r2() - 0.5) * H * 0.5 * Math.sin(((x - W * 0.15) / (W * 0.7)) * Math.PI); if (x === W * 0.15) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  }
});
const staticTex = (s: Phaser.Scene) => T(s, 'it-static', 64, 128, (ctx, W, H) => {
  const rnd = rng(77);
  for (let i = 0; i < 90; i++) { ctx.fillStyle = rnd() < 0.5 ? css(THEME.hazard, 0.5 + rnd() * 0.5) : css(0xffd0e0, 0.4 + rnd() * 0.5); ctx.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 6, 1 + rnd() * 1.5); }
  ctx.strokeStyle = 'rgba(255,200,225,0.8)'; ctx.lineWidth = 1.4; ctx.beginPath();
  for (let y = 0; y <= H; y += 8) { const x = W / 2 + (rnd() - 0.5) * W * 0.8; if (!y) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.lineTo(W / 2, H); ctx.stroke();
});
const mineTex = (s: Phaser.Scene) => T(s, 'it-mine', 64, 64, (ctx) => {
  glow(ctx, 32, 32, 32, THEME.hazard, 0.45);
  ctx.beginPath(); for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; const r = i % 2 ? 17 : 25; ctx.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } ctx.closePath();
  const g = ctx.createRadialGradient(26, 24, 2, 32, 32, 25); g.addColorStop(0, '#ff9ab8'); g.addColorStop(0.5, css(THEME.hazard)); g.addColorStop(1, '#5a0424'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#3a0418'; ctx.lineWidth = 1.6; ctx.stroke();
  circle(ctx, 32, 32, 9); ctx.fillStyle = '#2a0212'; ctx.fill(); glow(ctx, 32, 32, 8, 0xffd0e0, 0.9);
});
export const bulletTex = (s: Phaser.Scene) => T(s, 'it-bullet', 40, 40, (ctx) => {
  glow(ctx, 20, 20, 20, THEME.hazard, 0.6);
  ctx.strokeStyle = 'rgba(255,220,235,0.95)'; ctx.lineCap = 'round';
  for (const [r, lw] of [[6, 3], [10, 2.4], [14, 1.8]] as [number, number][]) { ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(14, 20, r, -0.9, 0.9); ctx.stroke(); }
  circle(ctx, 13, 20, 4); ctx.fillStyle = '#fff'; ctx.fill();
});

// ---------------------------------------------------------------- kurucular
export function buildCoin(v: EntityView) {
  halo(v, THEME.gold, 54, 0.35);
  const c = I(v.scene, coinTex(v.scene)); v.add(c); const b = c.scaleY;
  v.tw({ targets: c, scaleX: { from: b, to: b * 0.18 }, duration: 520, yoyo: true, repeat: -1, repeatDelay: 1100, delay: 600 + Math.random() * 1200, ease: 'Sine.InOut' });
  bob(v, 4, 800); v.h.collect = () => burst(v, THEME.gold, 6);
}
export function buildNote(v: EntityView) {
  const hl = halo(v, THEME.gold, 64, 0.45);
  const n = I(v.scene, noteTex(v.scene)); v.add(n);
  v.tw({ targets: hl, alpha: 0.2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  v.tw({ targets: n, angle: { from: -6, to: 6 }, duration: 900 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  bob(v, 5, 850); v.h.collect = () => burst(v, THEME.gold, 8);
}
export function buildBigNote(v: EntityView) {
  const rays = I(v.scene, raysTex(v.scene)).setBlendMode(ADD).setAlpha(0.8); v.add(rays);
  halo(v, THEME.gold, 100, 0.55);
  const n = I(v.scene, bigNoteTex(v.scene)); v.add(n);
  v.tw({ targets: rays, angle: 360, duration: 9000, repeat: -1 });
  v.tw({ targets: n, scale: n.scale * 1.08, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  bob(v, 6, 1000); v.h.collect = () => burst(v, THEME.gold, 14, 0xfff1a8);
}
export function buildCochlea(v: EntityView) {
  const rays = I(v.scene, raysTex(v.scene)).setBlendMode(ADD).setAlpha(0.9).setTint(0xffe6a0); v.add(rays);
  halo(v, THEME.gold, 110, 0.6);
  const c = I(v.scene, cochleaTex(v.scene)); v.add(c);
  const sp = I(v.scene, sparkTex(v.scene), 16, -16).setBlendMode(ADD).setScale(0.5); v.add(sp);
  v.tw({ targets: rays, angle: -360, duration: 12000, repeat: -1 });
  v.tw({ targets: c, angle: { from: -8, to: 8 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  v.tw({ targets: sp, scale: { from: 0.1, to: 0.6 }, alpha: { from: 1, to: 0 }, duration: 1100, repeat: -1, repeatDelay: 400 });
  bob(v, 6, 1100); v.h.collect = () => burst(v, THEME.gold, 16, 0xfff1a8);
}
export function buildPowerup(v: EntityView, kind: string) {
  const c = kind === 'life' ? THEME.coral : kind === 'magnet' ? THEME.violet : kind === 'speed' ? THEME.lime : THEME.teal;
  const hl = halo(v, c, 84, 0.5);
  const o = I(v.scene, orbTex(v.scene, kind)); v.add(o);
  v.tw({ targets: hl, alpha: 0.25, scale: hl.scale * 0.85, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  bob(v, 5, 900); v.h.collect = () => burst(v, c, 10);
}
export function buildBubble(v: EntityView) {
  const b = I(v.scene, bubbleTex(v.scene)); v.add(b);
  v.tw({ targets: b, scaleX: b.scaleX * 1.08, scaleY: b.scaleY * 0.93, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  bob(v, 8, 1100); v.h.collect = () => burst(v, 0xbff6ff, 6);
}
export function buildFork(v: EntityView, t: number) {
  const c = tono(t); const hl = halo(v, c, 86, 0.55);
  const f = I(v.scene, forkTex(v.scene, t)); v.add(f);
  // titreşim çizgileri
  const waves = v.scene.add.graphics(); v.add(waves);
  waves.lineStyle(1.6, lighten(c, 0.4), 0.8); for (const sx of [-1, 1]) for (const r of [6, 11]) { waves.beginPath(); waves.arc(sx * 2, -16, 14 + r, sx > 0 ? -0.5 : Math.PI - 0.5, sx > 0 ? 0.5 : Math.PI + 0.5); waves.strokePath(); }
  v.tw({ targets: waves, alpha: { from: 1, to: 0.15 }, duration: 260, yoyo: true, repeat: -1 });
  v.tw({ targets: f, x: { from: -0.8, to: 0.8 }, duration: 60, yoyo: true, repeat: -1 });
  v.tw({ targets: hl, alpha: 0.3, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  bob(v, 5, 1000); v.h.collect = () => burst(v, c, 12);
}
export function buildSpike(v: EntityView, A: BiomeArt, w: number) {
  const ww = Math.max(16, Math.round(w / 8) * 8);
  const g = v.scene.add.image(ww / 2, -6, softGlowTex(v.scene)).setBlendMode(ADD).setTint(THEME.hazard).setDisplaySize(ww + 40, 46).setAlpha(0.5); v.add(g);
  const sp = I(v.scene, spikeTex(v.scene, A, ww)).setOrigin(0, 1); v.add(sp);
  v.tw({ targets: g, alpha: 0.15, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
}
export function buildHazardCloud(v: EntityView, kind: string, w: number, h: number) {
  const cx = w / 2, cy = h / 2;
  const hot = kind === 'serumen' ? 0xff6a2c : THEME.hazard;
  const g = v.scene.add.image(cx, cy, softGlowTex(v.scene)).setBlendMode(ADD).setTint(hot).setDisplaySize(w * 1.5, h * 1.6).setAlpha(0.45); v.add(g);
  const cl = I(v.scene, cloudTex(v.scene, kind, Math.round(w), Math.round(h)), cx, cy); v.add(cl);
  const z = I(v.scene, zigTex(v.scene, Math.round(w), Math.round(h * 0.7)), cx, cy + h * 0.05).setBlendMode(ADD); v.add(z);
  // kızgın gözler (sevimli ama tehlikeli)
  const eyes = v.scene.add.graphics(); v.add(eyes);
  const ex = Math.min(w * 0.14, 14); eyes.fillStyle(0xffffff, 1); eyes.fillEllipse(cx - ex, cy - h * 0.12, 9, 7); eyes.fillEllipse(cx + ex, cy - h * 0.12, 9, 7);
  eyes.fillStyle(0x2a0212, 1); eyes.fillCircle(cx - ex + 1, cy - h * 0.1, 2.4); eyes.fillCircle(cx + ex + 1, cy - h * 0.1, 2.4);
  eyes.lineStyle(2.2, 0x2a0212, 1); eyes.lineBetween(cx - ex - 6, cy - h * 0.12 - 7, cx - ex + 4, cy - h * 0.12 - 3); eyes.lineBetween(cx + ex + 6, cy - h * 0.12 - 7, cx + ex - 4, cy - h * 0.12 - 3);
  v.tw({ targets: g, alpha: 0.18, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  v.tw({ targets: z, alpha: { from: 1, to: 0.3 }, scaleY: { from: z.scaleY, to: z.scaleY * 0.5 }, duration: 140, yoyo: true, repeat: -1, repeatDelay: 120 });
  v.tw({ targets: [cl, eyes], y: '-=4', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  v.h.shatter = () => { burst(v, hot, 12); };
  // nabız tehlikesi açılmadan önce (0,65 sn): parlama yükselir, bulut titrer (gürleme)
  v.h.telegraph = () => {
    v.tw({ targets: g, alpha: { from: 0.45, to: 0.95 }, duration: 650, ease: 'Quad.In' });
    v.tw({ targets: [cl, z], x: { from: cx - 2.5, to: cx + 2.5 }, duration: 45, yoyo: true, repeat: 6 });
  };
}
/**
 * Kıl perdesi (altından kayılan asılı tehlike): asılı saçak/tül, alt kenarı zeminden belirgin yukarıda; altında aydınlık açıklık
 * ve aşağı oklar ("kay"). Gürültü bulutunun gözleri ve şimşeği yok: okunuşu "alçak geçit — altından kay".
 */
export function buildCurtain(v: EntityView, kind: string, w: number, h: number, gap: number) {
  const s = v.scene;
  const base = kind === 'serumen' ? 0xe0913a : kind === 'gurultu' ? 0xb05ad8 : 0xf2c6dc;
  const deep = darken(base, 0.45), lite = lighten(base, 0.35);
  // açıklık: zemine kadar aydınlık bant (geçilecek yer)
  const lit = s.add.image(w / 2, h + gap / 2, softGlowTex(s)).setBlendMode(ADD).setTint(0xfff3b0).setDisplaySize(w * 1.3, Math.max(26, gap * 2.2)).setAlpha(0.55); v.add(lit);
  const body = s.add.graphics(); v.add(body);
  // tutturma çubuğu ve tül
  body.fillStyle(deep, 0.95); body.fillRoundedRect(-6, -4, w + 12, 10, 5);
  body.fillStyle(base, 0.82); body.fillRect(0, 4, w, h - 14);
  // dalgalı alt kenar (saçak)
  const n = Math.max(3, Math.round(w / 22)); const sw = w / n;
  for (let i = 0; i < n; i++) body.fillTriangle(i * sw, h - 10, (i + 1) * sw, h - 10, (i + 0.5) * sw, h);
  // dikey kıl çizgileri
  const strands = s.add.graphics(); v.add(strands);
  strands.lineStyle(2, lite, 0.75); for (let x = 6; x < w - 2; x += 9) { strands.beginPath(); strands.moveTo(x, 6); strands.lineTo(x + 2, h - 12); strands.strokePath(); }
  // alt kenar vurgusu: perdenin bittiği yer net görünsün
  const edge = s.add.graphics(); v.add(edge); edge.lineStyle(3, 0xffffff, 0.9); edge.lineBetween(2, h - 1, w - 2, h - 1);
  // aşağı oklar + "kay"
  const ar = s.add.graphics(); v.add(ar);
  const cx = w / 2, ay = h + Math.max(6, gap * 0.3);
  ar.lineStyle(3, 0xfff3b0, 1); for (const dy of [0, 7]) { ar.beginPath(); ar.moveTo(cx - 8, ay + dy); ar.lineTo(cx, ay + dy + 6); ar.lineTo(cx + 8, ay + dy); ar.strokePath(); }
  const tx = s.add.text(cx, Math.max(14, h - 26), 'KAY ↓', { fontFamily: 'system-ui, sans-serif', fontSize: '13px', fontStyle: '700', color: '#3a1030' }).setOrigin(0.5).setAlpha(0.85); v.add(tx);
  v.tw({ targets: ar, y: { from: -2, to: 3 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  v.tw({ targets: lit, alpha: { from: 0.35, to: 0.7 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  v.tw({ targets: strands, x: { from: -1.5, to: 1.5 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  v.h.shatter = () => { burst(v, base, 10); };
}
export function buildBarrier(v: EntityView, w: number, h: number) {
  const s = v.scene;
  const g = s.add.image(w / 2, h / 2, softGlowTex(s)).setBlendMode(ADD).setTint(THEME.hazard).setDisplaySize(w * 3, h * 1.15).setAlpha(0.5); v.add(g);
  const body = s.add.graphics(); v.add(body);
  body.fillStyle(0x2a0620, 0.7); body.fillRoundedRect(0, 0, w, h, Math.min(10, w / 2));
  const st = s.add.tileSprite(w / 2, h / 2, Math.max(8, w - 6), h - 6, staticTex(s)).setBlendMode(ADD).setAlpha(0.9); st.setTileScale(1 / R(), 1 / R()); v.add(st);
  const edge = s.add.graphics(); v.add(edge);
  edge.lineStyle(2.5, 0xffb3cc, 0.95); edge.strokeRoundedRect(0, 0, w, h, Math.min(10, w / 2));
  edge.lineStyle(6, THEME.hazard, 0.35); edge.strokeRoundedRect(-2, -2, w + 4, h + 4, Math.min(12, w / 2 + 2));
  // uyarı şeritleri (üst/alt)
  for (const yy of [0, h - 10]) { edge.fillStyle(0x3a0418, 1); edge.fillRoundedRect(-4, yy, w + 8, 10, 4); edge.fillStyle(THEME.hazard, 1); for (let x = -2; x < w + 4; x += 10) edge.fillTriangle(x, yy + 10, x + 5, yy, x + 9, yy + 10); }
  v.tw({ targets: st, tilePositionY: { from: 0, to: 128 * R() }, duration: 900, repeat: -1 });
  v.tw({ targets: g, alpha: 0.2, duration: 380, yoyo: true, repeat: -1 });
  v.h.shatter = () => {
    const sc = v.scene; const n = Math.max(6, Math.round(h / 16));
    for (let i = 0; i < n; i++) {
      const p = sc.add.rectangle(v.x + w / 2 + (Math.random() - 0.5) * w, v.y + Math.random() * h, 4 + Math.random() * 8, 3 + Math.random() * 6, i % 2 ? THEME.hazard : 0xffc0d8).setDepth(v.depth + 1).setBlendMode(ADD);
      sc.tweens.add({ targets: p, x: p.x + 40 + Math.random() * 80, y: p.y + (Math.random() - 0.5) * 80, angle: 360 * (Math.random() - 0.5), alpha: 0, duration: 500 + Math.random() * 300, ease: 'Cubic.Out', onComplete: () => p.destroy() });
    }
    burst(v, THEME.hazard, 10);
  };
}
export function buildMine(v: EntityView) {
  const g = halo(v, THEME.hazard, 90, 0.5);
  const m = I(v.scene, mineTex(v.scene)); v.add(m);
  v.tw({ targets: m, angle: 360, duration: 6000, repeat: -1 });
  v.tw({ targets: g, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });
}
export function buildBullet(v: EntityView) {
  const b = I(v.scene, bulletTex(v.scene)); v.add(b);
  v.tw({ targets: b, scaleY: b.scaleY * 0.8, duration: 120, yoyo: true, repeat: -1 });
}
export const ITEM_TEX = { coinTex, noteTex, bigNoteTex, cochleaTex };
