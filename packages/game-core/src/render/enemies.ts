/**
 * Düşmanlar: "gürültü yaratıkları" — sevimli ama okunaklı tehlike (sıcak kırmızı/mor), her birinin açık bir "uyarı" animasyonu var.
 * devriye (yürür) · ucan (kanat çırpar) · atici (hoparlör ağızlı, ses mermisi) · ziplayan (yaylı) · kalkanli (kalkanlı; yalnız darbe/çakılma).
 */
import Phaser from 'phaser';
import { EntityView } from './view';
import { I, R, T, softGlowTex, sparkTex, ringTex, puffTex } from './tex';
import { circle, css, darken, glow, lighten, rng, THEME, type Ctx } from './util';

const ADD = Phaser.BlendModes.ADD;
type Kind = 'devriye' | 'ucan' | 'atici' | 'ziplayan' | 'kalkanli';
export function enemyKind(k: unknown): Kind {
  const s = String(k ?? 'devriye');
  if (s === 'ucan' || s === 'sinek') return 'ucan';
  if (s === 'atici' || s === 'ziplayan' || s === 'kalkanli') return s;
  return 'devriye';
}
const COL: Record<Kind, [number, number, number]> = {
  devriye: [0xff5c8a, 0xd0205a, 0x4a0420],
  ucan: [0xc070ff, 0x8a2ad0, 0x2a0850],
  atici: [0xff7a4a, 0xd83a2a, 0x4a0a08],
  ziplayan: [0xff5cc8, 0xc0208a, 0x46043a],
  kalkanli: [0xb04a7a, 0x6a1a4a, 0x22041a],
};

// ---------------------------------------------------------------- dokular
function fuzzBody(ctx: Ctx, cx: number, cy: number, r: number, c: [number, number, number], spikes: number, seed: number) {
  const rnd = rng(seed);
  glow(ctx, cx, cy, r * 1.7, c[0], 0.35);
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) { const a = (i / (spikes * 2)) * Math.PI * 2; const rr = i % 2 ? r : r * (1.16 + rnd() * 0.1); ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.95); }
  ctx.closePath();
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.1, cx, cy, r * 1.15); g.addColorStop(0, css(lighten(c[0], 0.45))); g.addColorStop(0.55, css(c[0])); g.addColorStop(1, css(c[1]));
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = css(c[2]); ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();
  // statik benekleri
  ctx.save(); circle(ctx, cx, cy, r * 0.95); ctx.clip();
  for (let i = 0; i < 16; i++) { ctx.fillStyle = css(rnd() < 0.5 ? 0xffffff : c[2], 0.18 + rnd() * 0.2); ctx.fillRect(cx + (rnd() - 0.5) * r * 1.8, cy + (rnd() - 0.2) * r * 1.4, 1 + rnd() * 3, 1); }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(cx - r * 0.42, cy - r * 0.5, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
}
const bodyTex = (s: Phaser.Scene, k: Kind) => T(s, `en-body-${k}`, 64, 64, (ctx) => {
  const c = COL[k];
  switch (k) {
    case 'devriye': fuzzBody(ctx, 32, 34, 18, c, 14, 11); break;
    case 'ucan': fuzzBody(ctx, 32, 32, 14, c, 12, 23);
      ctx.strokeStyle = css(c[2]); ctx.lineWidth = 1.6; ctx.lineCap = 'round'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(32 + sx * 4, 19); ctx.quadraticCurveTo(32 + sx * 7, 10, 32 + sx * 11, 9); ctx.stroke(); glow(ctx, 32 + sx * 11, 9, 4, 0xffe0f0, 0.9); }
      break;
    case 'atici': {
      fuzzBody(ctx, 28, 36, 17, c, 12, 37);
      break;
    }
    case 'ziplayan': fuzzBody(ctx, 32, 30, 16, c, 10, 51); break;
    case 'kalkanli': {
      glow(ctx, 32, 34, 30, c[0], 0.3);
      const g = ctx.createRadialGradient(26, 24, 2, 32, 34, 21); g.addColorStop(0, css(lighten(c[0], 0.35))); g.addColorStop(1, css(c[1]));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(32, 35, 19, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = css(c[2]); ctx.lineWidth = 1.8; ctx.stroke();
      // miğfer plakaları
      ctx.fillStyle = css(0x3a2a5a); ctx.beginPath(); ctx.ellipse(32, 26, 19, 11, 0, Math.PI, 0); ctx.lineTo(51, 28); ctx.lineTo(13, 28); ctx.closePath(); ctx.fill(); ctx.strokeStyle = css(THEME.gold, 0.9); ctx.lineWidth = 1.4; ctx.stroke();
      for (const x of [20, 32, 44]) { circle(ctx, x, 22, 1.5); ctx.fillStyle = css(THEME.gold); ctx.fill(); }
      ctx.fillStyle = css(THEME.hazard); ctx.beginPath(); ctx.moveTo(32, 10); ctx.lineTo(36, 18); ctx.lineTo(28, 18); ctx.closePath(); ctx.fill();
      break;
    }
  }
});
const eyeTex = (s: Phaser.Scene) => T(s, 'en-eye', 14, 14, (ctx) => {
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(7, 7, 5.6, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(40,0,20,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#1a0010'; circle(ctx, 8.4, 7.6, 3); ctx.fill(); ctx.fillStyle = '#fff'; circle(ctx, 9.4, 6.2, 1.1); ctx.fill();
});
const footTex = (s: Phaser.Scene, c: number) => T(s, `en-foot-${c.toString(16)}`, 14, 9, (ctx) => { const g = ctx.createLinearGradient(0, 0, 0, 9); g.addColorStop(0, css(lighten(c, 0.2))); g.addColorStop(1, css(darken(c, 0.4))); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(7, 4.5, 6.2, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(40,0,20,0.8)'; ctx.lineWidth = 1; ctx.stroke(); });
const wingTex = (s: Phaser.Scene) => T(s, 'en-wing', 34, 26, (ctx) => {
  // sağa açılan zar kanat (kökü solda)
  const p = () => { ctx.beginPath(); ctx.moveTo(2, 14); ctx.quadraticCurveTo(12, 0, 32, 3); ctx.quadraticCurveTo(28, 9, 31, 13); ctx.quadraticCurveTo(24, 14, 26, 21); ctx.quadraticCurveTo(16, 17, 2, 18); ctx.closePath(); };
  p(); const g = ctx.createLinearGradient(2, 0, 32, 0); g.addColorStop(0, 'rgba(160,60,220,0.95)'); g.addColorStop(1, 'rgba(255,140,220,0.75)'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#2a0850'; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,250,0.7)'; ctx.lineWidth = 1; for (const r of [8, 14, 20]) { ctx.beginPath(); ctx.arc(2, 16, r, -0.9, -0.1); ctx.stroke(); }
});
const hornTex = (s: Phaser.Scene) => T(s, 'en-horn', 30, 30, (ctx) => {
  ctx.beginPath(); ctx.moveTo(2, 11); ctx.lineTo(16, 7); ctx.quadraticCurveTo(24, 2, 28, 1); ctx.lineTo(28, 29); ctx.quadraticCurveTo(24, 28, 16, 23); ctx.lineTo(2, 19); ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, 30); g.addColorStop(0, '#6a5a9a'); g.addColorStop(1, '#1a1040'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#0a0020'; ctx.lineWidth = 1.4; ctx.stroke();
  const ig = ctx.createRadialGradient(27, 15, 1, 27, 15, 12); ig.addColorStop(0, '#ffe0e8'); ig.addColorStop(0.4, css(THEME.hazard)); ig.addColorStop(1, '#3a0418'); ctx.fillStyle = ig; ctx.beginPath(); ctx.ellipse(27, 15, 3.5, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(5, 12); ctx.lineTo(16, 9); ctx.stroke();
});
const springLegTex = (s: Phaser.Scene) => T(s, 'en-spring', 40, 18, (ctx) => {
  ctx.lineCap = 'round';
  for (const sx of [12, 28]) { for (const [lw, c] of [[3.6, '#3a0a30'], [2, '#ffb3e0']] as [number, string][]) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(sx, 1); for (let i = 0; i < 4; i++) ctx.lineTo(sx + (i % 2 ? -4 : 4), 3 + i * 3.4); ctx.lineTo(sx, 15); ctx.stroke(); } ctx.fillStyle = '#3a0a30'; ctx.beginPath(); ctx.ellipse(sx, 16, 5, 2.2, 0, 0, Math.PI * 2); ctx.fill(); }
});
const shieldTex = (s: Phaser.Scene) => T(s, 'en-shield', 26, 44, (ctx) => {
  glow(ctx, 13, 22, 16, THEME.gold, 0.4);
  const p = () => { ctx.beginPath(); ctx.moveTo(6, 3); ctx.quadraticCurveTo(22, 4, 23, 10); ctx.lineTo(23, 30); ctx.quadraticCurveTo(21, 40, 8, 42); ctx.quadraticCurveTo(4, 30, 4, 22); ctx.quadraticCurveTo(4, 8, 6, 3); ctx.closePath(); };
  p(); const g = ctx.createLinearGradient(4, 0, 24, 0); g.addColorStop(0, '#a35a00'); g.addColorStop(0.4, '#fff1a8'); g.addColorStop(1, css(THEME.gold2)); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#4a1a00'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.save(); p(); ctx.clip(); ctx.fillStyle = css(THEME.hazard, 0.9); ctx.fillRect(4, 18, 20, 7); ctx.restore();
  for (const y of [8, 36]) { circle(ctx, 14, y, 1.6); ctx.fillStyle = '#4a1a00'; ctx.fill(); }
  // sessiz simgesi
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(10, 18.5); ctx.lineTo(17, 24.5); ctx.moveTo(17, 18.5); ctx.lineTo(10, 24.5); ctx.stroke();
});
const alertTex = (s: Phaser.Scene) => T(s, 'en-alert', 28, 32, (ctx) => {
  glow(ctx, 14, 14, 14, THEME.hazard, 0.6);
  ctx.fillStyle = '#fff6e5'; ctx.beginPath(); ctx.arc(14, 13, 10, 0, Math.PI * 2); ctx.moveTo(10, 21); ctx.lineTo(14, 29); ctx.lineTo(17, 21); ctx.fill(); ctx.strokeStyle = css(THEME.hazard); ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = css(THEME.hazard); ctx.beginPath(); ctx.roundRect(12.2, 6, 3.6, 9, 1.8); ctx.fill(); circle(ctx, 14, 18, 2); ctx.fill();
});

// ---------------------------------------------------------------- kurulum
export function buildEnemy(v: EntityView, kindRaw: unknown) {
  const s = v.scene; const k = enemyKind(kindRaw); const c = COL[k]; const r = 1 / R();
  const rig = s.add.container(0, 0); v.add(rig);
  const glowI = s.add.image(0, -22, softGlowTex(s)).setBlendMode(ADD).setTint(c[0]).setDisplaySize(84, 84).setAlpha(0.35); rig.add(glowI);
  const feet: Phaser.GameObjects.Image[] = [];
  let bodyY = -24;
  if (k === 'devriye' || k === 'atici' || k === 'kalkanli') for (const sx of [-8, 8]) { const f = I(s, footTex(s, c[1]), sx, -4); rig.add(f); feet.push(f); }
  let legs: Phaser.GameObjects.Image | null = null;
  if (k === 'ziplayan') { legs = I(s, springLegTex(s), 0, -9); rig.add(legs); bodyY = -30; }
  const wings: Phaser.GameObjects.Image[] = [];
  if (k === 'ucan') { bodyY = -26; for (const sx of [-1, 1]) { const w = I(s, wingTex(s), sx * 8, bodyY - 4).setOrigin(0.06, 0.6); w.scaleX = r * sx; rig.add(w); wings.push(w); } }
  const body = I(s, bodyTex(s, k), 0, bodyY + (k === 'atici' ? -6 : 0)).setOrigin(0.5, 0.5); rig.add(body);
  let horn: Phaser.GameObjects.Image | null = null;
  if (k === 'atici') { horn = I(s, hornTex(s), 12, bodyY - 2).setOrigin(0.05, 0.5); rig.add(horn); }
  // gözler + kaşlar
  const eyeY = bodyY - (k === 'kalkanli' ? -2 : 3); const ex = k === 'ucan' ? 5 : 6.5; const eo = k === 'atici' ? -4 : 0;
  const eyes = [I(s, eyeTex(s), eo - ex, eyeY), I(s, eyeTex(s), eo + ex, eyeY)]; rig.add(eyes);
  if (k === 'ucan') eyes.forEach((e) => e.setScale(r * 0.85));
  const brows = s.add.graphics(); rig.add(brows);
  const drawBrows = (angry: number) => { brows.clear(); brows.lineStyle(2.4, 0x1a0010, 1); for (const sx of [-1, 1]) brows.lineBetween(eo + sx * (ex + 4.5), eyeY - 7 - angry, eo + sx * (ex - 3.5), eyeY - 4.5 + angry * 0.6); };
  drawBrows(0);
  let shield: Phaser.GameObjects.Image | null = null;
  if (k === 'kalkanli') { shield = I(s, shieldTex(s), 17, bodyY + 2); rig.add(shield); }

  // boşta animasyonları
  const base = { y: body.y, sx: body.scaleX, sy: body.scaleY };
  v.tw({ targets: body, scaleY: base.sy * 0.94, scaleX: base.sx * 1.04, duration: k === 'ziplayan' ? 380 : 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  if (feet.length) { v.tw({ targets: feet[0], y: -7, duration: 220, yoyo: true, repeat: -1, ease: 'Sine.InOut' }); v.tw({ targets: feet[1], y: -7, duration: 220, delay: 220, yoyo: true, repeat: -1, ease: 'Sine.InOut' }); }
  for (const w of wings) v.tw({ targets: w, scaleY: { from: r, to: r * 0.45 }, duration: 110, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  if (k === 'ucan') v.tw({ targets: rig, y: -5, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  if (legs) v.tw({ targets: legs, scaleY: { from: r, to: r * 0.7 }, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  if (shield) v.tw({ targets: shield, alpha: 0.75, duration: 700, yoyo: true, repeat: -1 });
  v.tw({ targets: glowI, alpha: 0.15, duration: 600, yoyo: true, repeat: -1 });
  v.every(2600, () => { for (const e of eyes) s.tweens.add({ targets: e, scaleY: { from: e.scaleY, to: e.scaleY * 0.1 }, duration: 70, yoyo: true }); }, 1800);

  v.h.facing = (d) => { rig.scaleX = d; };
  let tele = false;
  v.h.telegraph = () => {
    if (tele || v.dead) return; tele = true;
    const al = I(s, alertTex(s), 0, bodyY - 34); v.add(al); al.setScale(0);
    s.tweens.add({ targets: al, scale: r, duration: 180, ease: 'Back.Out' });
    s.tweens.add({ targets: al, alpha: 0, y: al.y - 10, delay: 520, duration: 200, onComplete: () => { al.destroy(); tele = false; drawBrows(0); body.clearTint(); } });
    drawBrows(2.5); body.setTintFill(0xffffff);
    s.time.delayedCall(70, () => { if (!v.dead) body.clearTint().setTint(0xffc0d0); });
    glowI.setAlpha(0.9);
    switch (k) {
      case 'atici': s.tweens.add({ targets: body, scaleX: base.sx * 1.25, scaleY: base.sy * 1.2, duration: 320, yoyo: true, ease: 'Sine.InOut' }); if (horn) { s.tweens.add({ targets: horn, scaleY: horn.scaleY * 1.3, duration: 320, yoyo: true }); const rg = s.add.image(v.x + 40 * rig.scaleX, v.y + bodyY, ringTex(s)).setBlendMode(ADD).setTint(THEME.hazard).setDepth(v.depth + 1).setScale(0.45); s.tweens.add({ targets: rg, scale: 0.08, alpha: { from: 0, to: 1 }, duration: 420, onComplete: () => rg.destroy() }); } break;
      case 'ziplayan': s.tweens.add({ targets: rig, scaleY: 0.7, duration: 260, yoyo: true, ease: 'Sine.InOut' }); break;
      case 'ucan': for (const w of wings) s.tweens.add({ targets: w, angle: -25, duration: 120, yoyo: true, repeat: 2 }); break;
      case 'kalkanli': if (shield) s.tweens.add({ targets: shield, x: 22, duration: 200, yoyo: true, ease: 'Back.Out' }); break;
      default: s.tweens.add({ targets: body, y: base.y - 6, duration: 160, yoyo: true, repeat: 1, ease: 'Sine.Out' });
    }
  };
  v.h.shatter = () => {
    const wx = v.x, wy = v.y + bodyY;
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const p = s.add.image(wx, wy, puffTex(s)).setTint(i % 2 ? c[0] : 0xffffff).setDepth(v.depth + 1).setScale(0.4).setAlpha(0.9); s.tweens.add({ targets: p, x: wx + Math.cos(a) * 34, y: wy + Math.sin(a) * 30, scale: 0.05, alpha: 0, duration: 420, ease: 'Cubic.Out', onComplete: () => p.destroy() }); }
    for (let i = 0; i < 4; i++) { const st = s.add.image(wx, wy, sparkTex(s)).setBlendMode(ADD).setTint(THEME.gold).setDepth(v.depth + 2).setScale(0.5); s.tweens.add({ targets: st, x: wx + (Math.random() - 0.5) * 60, y: wy - 20 - Math.random() * 30, angle: 180, scale: 0, duration: 560, onComplete: () => st.destroy() }); }
    v.tw({ targets: v, scaleX: 1.4, scaleY: 0.4, alpha: 0, duration: 160, onComplete: () => v.destroy() });
  };
}
