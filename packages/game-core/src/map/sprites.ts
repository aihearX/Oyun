/**
 * Haritanın küçük dokuları (düğüm madalyonları, yıldızlar, sandık, canavar yüzleri, sis, yaratıklar, şerit etiketler...).
 * Hepsi Canvas 2D ile bir kez üretilir (R: netlik ölçeği), sahnede 1/R ölçekle gösterilir. Varlık dosyası yok.
 */
import type Phaser from 'phaser';
import { css, darken, gear, glow, INK, lighten, makeCanvas, MAP_FONT, mix, tono } from './paint';

type Ctx = CanvasRenderingContext2D;
export type NodeState = 'done' | 'current' | 'locked';

/** tuval dokusu üret (varsa yeniden üretmez); çizim tasarım biriminde, R ölçekli */
export function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, R: number, draw: (ctx: Ctx) => void): string {
  if (scene.textures.exists(key)) return key;
  const { c, ctx } = makeCanvas(w * R, h * R); ctx.scale(R, R); draw(ctx);
  scene.textures.addCanvas(key, c);
  return key;
}
const circ = (ctx: Ctx, x: number, y: number, r: number) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); };
function starPath(ctx: Ctx, cx: number, cy: number, r: number, inner = 0.48) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * inner : r; const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.closePath();
}

// ------------------------------------------------------------------ düğüm madalyonu
export const NODE_D = 66;
/** madalyon: dış halka (altın / parlak turkuaz / soluk taş), içte biyom renkli bombeli disk, üstte parlama */
export function nodeTex(scene: Phaser.Scene, R: number, state: NodeState, color: number, boss = false): string {
  const D = boss ? 96 : NODE_D; const key = `mn-${state}-${color.toString(16)}-${boss ? 'b' : 'n'}`;
  return canvasTex(scene, key, D + 16, D + 22, R, (ctx) => {
    const cx = (D + 16) / 2, cy = D / 2 + 6, r = D / 2;
    // yer gölgesi
    ctx.fillStyle = 'rgba(15,8,40,0.35)'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.78, r * 0.95, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    // kalınlık (3B kenar)
    const rim = state === 'done' ? [0xfff1a8, 0xffc93c, 0xc9790e] : state === 'current' ? [0xe9fffd, 0x7ff3ea, 0x1fa6a0] : [0xd8d4e8, 0x9d97b8, 0x5f5a7e];
    circ(ctx, cx, cy + 5, r); ctx.fillStyle = css(darken(rim[2]!, 0.35)); ctx.fill();
    const g = ctx.createLinearGradient(0, cy - r, 0, cy + r); g.addColorStop(0, css(rim[0]!)); g.addColorStop(0.5, css(rim[1]!)); g.addColorStop(1, css(rim[2]!));
    circ(ctx, cx, cy, r); ctx.fillStyle = g; ctx.fill();
    // iç disk
    const inner = state === 'locked' ? 0x4a4470 : color; const ir = r * 0.76;
    const g2 = ctx.createRadialGradient(cx - ir * 0.3, cy - ir * 0.45, ir * 0.1, cx, cy, ir * 1.05);
    g2.addColorStop(0, css(lighten(inner, 0.45))); g2.addColorStop(0.6, css(inner)); g2.addColorStop(1, css(darken(inner, 0.35)));
    circ(ctx, cx, cy, ir); ctx.fillStyle = g2; ctx.fill();
    ctx.strokeStyle = css(darken(rim[2]!, 0.3), 0.8); ctx.lineWidth = 1.5; ctx.stroke();
    // halka çentikleri (madalyon süsü)
    ctx.fillStyle = css(lighten(rim[1]!, 0.5), 0.8);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; circ(ctx, cx + Math.cos(a) * r * 0.88, cy + Math.sin(a) * r * 0.88, 1.3); ctx.fill(); }
    // parlama
    ctx.save(); circ(ctx, cx, cy, ir); ctx.clip();
    const sh = ctx.createLinearGradient(0, cy - ir, 0, cy); sh.addColorStop(0, 'rgba(255,255,255,0.55)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(cx, cy - ir * 0.45, ir * 0.85, ir * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(cx - r * 0.45, cy - r * 0.5, r * 0.12, r * 0.07, -0.7, 0, Math.PI * 2); ctx.fill();
    if (boss) bossFace(ctx, cx, cy + 2, ir, state === 'done', color);
  });
}
/** canavar yüzü: boynuzlar, kaşlar, dişler; yenilince uykulu ve sevimli */
function bossFace(ctx: Ctx, cx: number, cy: number, r: number, tamed: boolean, color: number) {
  const dark = darken(color, 0.6);
  // boynuzlar
  for (const s of [-1, 1]) { ctx.fillStyle = css(0xfff1d6); ctx.beginPath(); ctx.moveTo(cx + s * r * 0.45, cy - r * 0.55); ctx.quadraticCurveTo(cx + s * r * 0.95, cy - r * 0.9, cx + s * r * 0.85, cy - r * 1.25); ctx.quadraticCurveTo(cx + s * r * 0.7, cy - r * 0.8, cx + s * r * 0.2, cy - r * 0.68); ctx.closePath(); ctx.fill(); ctx.strokeStyle = css(dark); ctx.lineWidth = 1.5; ctx.stroke(); }
  if (tamed) {
    ctx.strokeStyle = css(dark); ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * r * 0.32, cy - r * 0.1, r * 0.14, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.2, r * 0.22, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,150,0.5)'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * r * 0.55, cy + r * 0.12, r * 0.13, r * 0.08, 0, 0, Math.PI * 2); ctx.fill(); }
    return;
  }
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(cx + s * r * 0.32, cy - r * 0.1, r * 0.2, r * 0.17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff3b3b'; circ(ctx, cx + s * r * 0.28, cy - r * 0.06, r * 0.09); ctx.fill(); ctx.fillStyle = '#1a0a10'; circ(ctx, cx + s * r * 0.28, cy - r * 0.06, r * 0.045); ctx.fill();
    ctx.strokeStyle = css(dark); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx + s * r * 0.55, cy - r * 0.38); ctx.lineTo(cx + s * r * 0.12, cy - r * 0.22); ctx.stroke();
  }
  ctx.fillStyle = css(darken(color, 0.7)); ctx.beginPath(); ctx.moveTo(cx - r * 0.5, cy + r * 0.25); ctx.quadraticCurveTo(cx, cy + r * 0.75, cx + r * 0.5, cy + r * 0.25); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 5; i++) { const x = cx - r * 0.4 + i * r * 0.2; ctx.beginPath(); ctx.moveTo(x - r * 0.07, cy + r * 0.27); ctx.lineTo(x + r * 0.07, cy + r * 0.27); ctx.lineTo(x, cy + r * 0.4); ctx.closePath(); ctx.fill(); }
}

/** yıldız: altın (kazanılan) ya da koyu yuva */
export function starTex(scene: Phaser.Scene, R: number, earned: boolean): string {
  return canvasTex(scene, earned ? 'm-star' : 'm-star-off', 30, 30, R, (ctx) => {
    if (earned) { glow(ctx, 15, 15, 15, 0xffd84a, 0.5); }
    starPath(ctx, 15, 16, 12); ctx.fillStyle = earned ? '#8a4b00' : 'rgba(20,12,50,0.55)'; ctx.fill();
    starPath(ctx, 15, 14.5, 12);
    if (earned) { const g = ctx.createLinearGradient(0, 3, 0, 26); g.addColorStop(0, '#fff6b0'); g.addColorStop(0.5, '#ffc93c'); g.addColorStop(1, '#ff9f1c'); ctx.fillStyle = g; } else ctx.fillStyle = 'rgba(60,50,110,0.75)';
    ctx.fill(); ctx.strokeStyle = earned ? '#a35a00' : 'rgba(180,170,230,0.5)'; ctx.lineWidth = 1.4; ctx.stroke();
    if (earned) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(11, 10, 2.5, 1.5, -0.6, 0, Math.PI * 2); ctx.fill(); }
  });
}

/** hazine sandığı: kapalı (parıltılı) ya da açık (boş) */
export function chestTex(scene: Phaser.Scene, R: number, open: boolean): string {
  return canvasTex(scene, open ? 'm-chest-open' : 'm-chest', 56, 52, R, (ctx) => {
    const x = 6, y = 20, w = 44, h = 26;
    ctx.fillStyle = 'rgba(15,8,40,0.35)'; ctx.beginPath(); ctx.ellipse(28, 47, 24, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (!open) glow(ctx, 28, 28, 28, 0xffd84a, 0.45);
    // gövde
    const wood = ctx.createLinearGradient(0, y, 0, y + h); wood.addColorStop(0, '#c9762f'); wood.addColorStop(1, '#7a3d12');
    ctx.fillStyle = wood; ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill(); ctx.strokeStyle = '#4a2208'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = '#ffc93c'; ctx.fillRect(x + 4, y, 5, h); ctx.fillRect(x + w - 9, y, 5, h);
    if (open) {
      ctx.fillStyle = '#3a1a06'; ctx.beginPath(); ctx.roundRect(x + 2, y - 3, w - 4, 7, 3); ctx.fill();
      const lid = ctx.createLinearGradient(0, 0, 0, 18); lid.addColorStop(0, '#e08a3a'); lid.addColorStop(1, '#9c4f1a');
      ctx.fillStyle = lid; ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(x + 4, 2); ctx.lineTo(x + w - 4, 2); ctx.lineTo(x + w, y - 2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#4a2208'; ctx.stroke();
    } else {
      const lid = ctx.createLinearGradient(0, 6, 0, y + 4); lid.addColorStop(0, '#f0a04b'); lid.addColorStop(1, '#a0521a');
      ctx.fillStyle = lid; ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, y - 4); ctx.quadraticCurveTo(28, 2, x + w, y - 4); ctx.lineTo(x + w, y + 4); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#4a2208'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = '#ffc93c'; ctx.fillRect(x + 4, y - 5, 5, 9); ctx.fillRect(x + w - 9, y - 5, 5, 9);
      ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.roundRect(24, y - 1, 8, 10, 2); ctx.fill(); ctx.strokeStyle = '#8a4b00'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#fff'; for (const [sx, sy] of [[12, 8], [46, 12], [40, 4]]) { starPath(ctx, sx!, sy!, 3, 0.4); ctx.fill(); }
    }
  });
}

export function pulseRingTex(scene: Phaser.Scene, R: number): string {
  return canvasTex(scene, 'm-pulse', 100, 100, R, (ctx) => { circ(ctx, 50, 50, 44); ctx.strokeStyle = 'rgba(255,240,170,0.95)'; ctx.lineWidth = 5; ctx.stroke(); circ(ctx, 50, 50, 44); ctx.strokeStyle = 'rgba(255,201,60,0.5)'; ctx.lineWidth = 10; ctx.stroke(); });
}
export function glowTex(scene: Phaser.Scene, R: number, color = 0xffffff, key = 'm-glow'): string {
  void R; return canvasTex(scene, key, 64, 64, 1, (ctx) => glow(ctx, 32, 32, 32, color, 1));
}
export function sparkleTex(scene: Phaser.Scene, R: number): string {
  return canvasTex(scene, 'm-sparkle', 24, 24, R, (ctx) => { glow(ctx, 12, 12, 12, 0xffe27a, 0.6); ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.moveTo(12, 1); ctx.quadraticCurveTo(13, 11, 23, 12); ctx.quadraticCurveTo(13, 13, 12, 23); ctx.quadraticCurveTo(11, 13, 1, 12); ctx.quadraticCurveTo(11, 11, 12, 1); ctx.fill(); });
}
export function noteTex(scene: Phaser.Scene, R: number, color: number): string {
  return canvasTex(scene, `m-note-${color.toString(16)}`, 26, 30, R, (ctx) => {
    glow(ctx, 12, 18, 13, color, 0.45);
    ctx.fillStyle = css(color); ctx.strokeStyle = css(darken(color, 0.4)); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(10, 22, 6, 4.5, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2.4; ctx.strokeStyle = css(color); ctx.beginPath(); ctx.moveTo(15.5, 21); ctx.lineTo(15.5, 4); ctx.quadraticCurveTo(23, 7, 21, 13); ctx.stroke();
  });
}
/** harita bulutu (savaş sisi): gece moru, mürekkep konturlu kabarık bulut */
export function fogTex(scene: Phaser.Scene, R: number, v: number): string {
  return canvasTex(scene, `m-fog-${v}`, 200, 110, Math.min(R, 1.5), (ctx) => {
    const puffs: [number, number, number][] = v ? [[50, 66, 34], [92, 52, 42], [140, 64, 36], [70, 80, 30], [120, 82, 32]] : [[46, 70, 30], [84, 54, 38], [130, 50, 34], [160, 70, 28], [104, 80, 34], [64, 84, 26]];
    const path = () => { ctx.beginPath(); for (const [x, y, r] of puffs) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); } };
    ctx.save(); ctx.filter = 'blur(6px)'; path(); ctx.fillStyle = 'rgba(30,18,80,0.55)'; ctx.fill(); ctx.restore();
    path(); const g = ctx.createLinearGradient(0, 15, 0, 110); g.addColorStop(0, '#4f3f96'); g.addColorStop(1, '#22175a'); ctx.fillStyle = g; ctx.fill();
    // her kabarcık: sol üstten ay ışığı alan yumuşak hacim
    ctx.save(); path(); ctx.clip();
    for (const [x, y, r] of puffs) { const rg = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r); rg.addColorStop(0, 'rgba(170,150,255,0.55)'); rg.addColorStop(0.6, 'rgba(110,90,200,0.15)'); rg.addColorStop(1, 'rgba(40,25,100,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    for (const [x, y, r] of puffs) { ctx.strokeStyle = 'rgba(205,190,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r - 3, Math.PI * 1.12, Math.PI * 1.62); ctx.stroke(); }
    // gizem yıldızcıkları
    for (const [x, y] of [[70, 50], [128, 40], [150, 74], [96, 78]] as [number, number][]) { ctx.fillStyle = 'rgba(255,240,190,0.85)'; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 1, y - 1); ctx.lineTo(x + 4, y); ctx.lineTo(x + 1, y + 1); ctx.lineTo(x, y + 4); ctx.lineTo(x - 1, y + 1); ctx.lineTo(x - 4, y); ctx.lineTo(x - 1, y - 1); ctx.closePath(); ctx.fill(); }
  });
}
export function hazeTex(scene: Phaser.Scene): string {
  return canvasTex(scene, 'm-haze', 128, 128, 1, (ctx) => glow(ctx, 64, 64, 64, 0x241657, 1, 0.35));
}
/** küçük yaratık (kulak sakini): uyuyan ya da uyanık */
export function creatureTex(scene: Phaser.Scene, R: number, color: number, awake: boolean): string {
  return canvasTex(scene, `m-cr-${color.toString(16)}-${awake ? 'a' : 's'}`, 40, 40, R, (ctx) => {
    ctx.fillStyle = 'rgba(15,8,40,0.3)'; ctx.beginPath(); ctx.ellipse(20, 36, 13, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(15, 16, 2, 20, 22, 16); g.addColorStop(0, css(lighten(color, 0.5))); g.addColorStop(1, css(color));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(6, 34); ctx.quadraticCurveTo(4, 10, 20, 8); ctx.quadraticCurveTo(36, 10, 34, 34); ctx.closePath(); ctx.fill(); ctx.strokeStyle = css(darken(color, 0.45)); ctx.lineWidth = 1.5; ctx.stroke();
    // kulak gibi iki tüy
    ctx.strokeStyle = css(darken(color, 0.3)); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(15, 9); ctx.quadraticCurveTo(12, 2, 9, 3); ctx.moveTo(25, 9); ctx.quadraticCurveTo(28, 2, 31, 3); ctx.stroke();
    ctx.strokeStyle = '#1a1030'; ctx.fillStyle = '#1a1030'; ctx.lineWidth = 1.8;
    if (awake) { for (const x of [15, 25]) { ctx.fillStyle = '#fff'; circ(ctx, x, 20, 3.6); ctx.fill(); ctx.fillStyle = '#1a1030'; circ(ctx, x + 0.6, 20.5, 1.8); ctx.fill(); } ctx.beginPath(); ctx.arc(20, 25, 3.5, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
    else { for (const x of [15, 25]) { ctx.beginPath(); ctx.arc(x, 20, 3, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); } ctx.beginPath(); ctx.ellipse(20, 27, 2, 1.4, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,120,160,0.45)'; ctx.beginPath(); ctx.ellipse(11, 25, 3, 1.8, 0, 0, Math.PI * 2); ctx.ellipse(29, 25, 3, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  });
}
export function zzzTex(scene: Phaser.Scene, R: number): string {
  return canvasTex(scene, 'm-zzz', 30, 30, R, (ctx) => { ctx.font = `italic 800 13px ${MAP_FONT}`; ctx.fillStyle = 'rgba(220,210,255,0.95)'; ctx.strokeStyle = 'rgba(30,18,80,0.8)'; ctx.lineWidth = 3; for (const [t, x, y, s] of [['z', 4, 26, 11], ['z', 12, 17, 13], ['Z', 20, 9, 15]] as [string, number, number, number][]) { ctx.font = `italic 800 ${s}px ${MAP_FONT}`; ctx.strokeText(t, x, y); ctx.fillText(t, x, y); } });
}
export function gearTex(scene: Phaser.Scene, R: number, r: number, color: number): string {
  return canvasTex(scene, `m-gear-${r}-${color.toString(16)}`, r * 2 + 4, r * 2 + 4, R, (ctx) => gear(ctx, r + 2, r + 2, r, Math.max(8, Math.round(r / 4)), color));
}
export function ringTex(scene: Phaser.Scene, R: number, color: number): string {
  void R; return canvasTex(scene, `m-ring-${color.toString(16)}`, 120, 70, 1, (ctx) => { ctx.strokeStyle = css(color, 0.9); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(60, 35, 56, 31, 0, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = css(color, 0.3); ctx.lineWidth = 8; ctx.stroke(); });
}
/** koklea spirali (dönen, parlayan yer imi) */
export function spiralTex(scene: Phaser.Scene, R: number, lo: number, hi: number): string {
  return canvasTex(scene, `m-spiral-${lo}`, 200, 200, Math.min(R, 2), (ctx) => {
    for (let i = 1; i <= 260; i++) {
      const t0 = (i - 1) / 260, t = i / 260; const a0 = t0 * 2.4 * Math.PI * 2, a = t * 2.4 * Math.PI * 2; const r0 = 92 * (1 - t0 * 0.9), r = 92 * (1 - t * 0.9);
      const c = tono(lo + (hi - lo) * t);
      ctx.strokeStyle = css(c, 0.35); ctx.lineWidth = 12 * (1 - t * 0.6); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(100 + Math.cos(a0) * r0, 100 + Math.sin(a0) * r0); ctx.lineTo(100 + Math.cos(a) * r, 100 + Math.sin(a) * r); ctx.stroke();
      ctx.strokeStyle = css(lighten(c, 0.4), 0.9); ctx.lineWidth = 3.5 * (1 - t * 0.5); ctx.stroke();
    }
  });
}
/** ışık nabzı (lif boyunca akan) */
export function pulseDotTex(scene: Phaser.Scene, R: number, color: number): string {
  return canvasTex(scene, `m-pd-${color.toString(16)}`, 28, 28, Math.min(R, 2), (ctx) => { glow(ctx, 14, 14, 14, color, 0.9); glow(ctx, 14, 14, 5, 0xffffff, 1); });
}
/** çiçeklenen tüy demeti (seviye 2) */
export function bloomTex(scene: Phaser.Scene, R: number, color: number): string {
  return canvasTex(scene, `m-bloom-${color.toString(16)}`, 34, 40, R, (ctx) => {
    for (let i = 0; i < 5; i++) {
      const t = (i - 2) / 2; const tx = 17 + t * 11, ty = 12 - (1 - Math.abs(t)) * 6;
      ctx.strokeStyle = css(darken(color, 0.35)); ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(17 + t * 3, 38); ctx.quadraticCurveTo(17 + t * 5, 24, tx, ty + 4); ctx.stroke();
      glow(ctx, tx, ty, 7, lighten(color, 0.3), 0.55);
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; ctx.fillStyle = css(lighten(color, 0.25)); ctx.beginPath(); ctx.ellipse(tx + Math.cos(a) * 2.6, ty + Math.sin(a) * 2.6, 2.4, 1.6, a, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#fff6c8'; circ(ctx, tx, ty, 1.5); ctx.fill();
    }
  });
}
/** Odi'nin ayak gölgesi */
export function shadowTex(scene: Phaser.Scene): string {
  return canvasTex(scene, 'm-shadow', 60, 20, 2, (ctx) => { ctx.fillStyle = 'rgba(10,5,30,0.4)'; ctx.beginPath(); ctx.ellipse(30, 10, 26, 7, 0, 0, Math.PI * 2); ctx.fill(); });
}
/** arkadaş balonu: renkli daire + baş harf + iğne */
export function avatarTex(scene: Phaser.Scene, R: number, color: number, letter: string): string {
  return canvasTex(scene, `m-av-${color.toString(16)}-${letter}`, 40, 48, R, (ctx) => {
    ctx.fillStyle = 'rgba(10,5,30,0.35)'; ctx.beginPath(); ctx.ellipse(20, 46, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6e5'; ctx.beginPath(); ctx.moveTo(14, 34); ctx.lineTo(20, 45); ctx.lineTo(26, 34); ctx.closePath(); ctx.fill();
    circ(ctx, 20, 19, 17); ctx.fillStyle = '#fff6e5'; ctx.fill();
    const g = ctx.createRadialGradient(15, 13, 2, 20, 19, 15); g.addColorStop(0, css(lighten(color, 0.4))); g.addColorStop(1, css(color));
    circ(ctx, 20, 19, 14); ctx.fillStyle = g; ctx.fill();
    ctx.font = `900 15px "SF Pro Rounded","Nunito",system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3; ctx.strokeText(letter, 20, 20); ctx.fillText(letter, 20, 20);
  });
}
/** takım bayrağı (sahip olunan bölge) — amblem ayrıca üstüne yazılır */
export function flagTex(scene: Phaser.Scene, R: number, color: number): string {
  return canvasTex(scene, `m-flag-${color.toString(16)}`, 46, 60, R, (ctx) => {
    ctx.fillStyle = 'rgba(10,5,30,0.35)'; ctx.beginPath(); ctx.ellipse(8, 58, 7, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(8, 58); ctx.lineTo(8, 4); ctx.stroke(); ctx.fillStyle = '#ffc93c'; circ(ctx, 8, 4, 3.4); ctx.fill();
    const g = ctx.createLinearGradient(8, 0, 44, 0); g.addColorStop(0, css(color)); g.addColorStop(1, css(darken(color, 0.25)));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(9, 7); ctx.quadraticCurveTo(26, 3, 44, 9); ctx.lineTo(38, 20); ctx.lineTo(44, 31); ctx.quadraticCurveTo(26, 27, 9, 33); ctx.closePath(); ctx.fill(); ctx.strokeStyle = css(darken(color, 0.5)); ctx.lineWidth = 1.3; ctx.stroke();
  });
}
/** hedef işareti (dalgalanan, kesikli halka + nişan) */
export function targetTex(scene: Phaser.Scene, R: number): string {
  return canvasTex(scene, 'm-target', 56, 56, R, (ctx) => {
    for (const [r, c] of [[24, '#ff5c8a'], [16, '#fff6e5'], [8, '#ff5c8a']] as [number, string][]) { circ(ctx, 28, 28, r); ctx.fillStyle = c; ctx.fill(); }
    ctx.strokeStyle = '#7a1838'; ctx.lineWidth = 1.5; circ(ctx, 28, 28, 24); ctx.stroke();
    ctx.strokeStyle = '#fff6e5'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); circ(ctx, 28, 28, 27); ctx.stroke();
  });
}
/** kilit simgesi (kapalı bölge kapısı) */
export function lockTex(scene: Phaser.Scene, R: number): string {
  return canvasTex(scene, 'm-lock', 28, 32, R, (ctx) => {
    ctx.strokeStyle = '#cfc6ef'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(14, 13, 7, Math.PI, 0); ctx.lineTo(21, 16); ctx.moveTo(7, 16); ctx.lineTo(7, 13); ctx.stroke();
    const g = ctx.createLinearGradient(0, 14, 0, 30); g.addColorStop(0, '#ffe27a'); g.addColorStop(1, '#d9930e'); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(3, 14, 22, 15, 4); ctx.fill(); ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#7a4a00'; circ(ctx, 14, 20, 2.4); ctx.fill(); ctx.fillRect(13, 21, 2, 5);
  });
}

/**
 * Harita yazısı gibi kavisli şerit etiket: parşömen şerit, kıvrık uçlar, kavis boyunca harf harf biyom adı,
 * altında italik yer adı ve canlanma noktaları (dolu = kazanılmış seviye).
 */
export function labelTex(scene: Phaser.Scene, R: number, key: string, title: string, place: string, accent: number, vitality: number, locked: boolean): string {
  const W = 300, H = 92;
  return canvasTex(scene, key, W, H, R, (ctx) => {
    const cx = W / 2, arcR = 520, cy = 30 + arcR; // kavis merkezi aşağıda → yukarı doğru bombeli şerit
    const half = 112, band = 30;
    const ang = (x: number) => Math.asin((x - cx) / arcR);
    const ribbon = (r0: number, r1: number, a0: number, a1: number) => { ctx.beginPath(); ctx.arc(cx, cy, r1, -Math.PI / 2 + a0, -Math.PI / 2 + a1); ctx.arc(cx, cy, r0, -Math.PI / 2 + a1, -Math.PI / 2 + a0, true); ctx.closePath(); };
    const a0 = ang(cx - half), a1 = ang(cx + half);
    const base = locked ? 0x6a5f99 : accent; const paper = locked ? 0xd9d2f0 : 0xfff6e5;
    // kıvrık uçlar (arkada)
    for (const s of [-1, 1]) {
      const ex = cx + s * half, ey = cy - Math.sqrt(arcR * arcR - (ex - cx) ** 2);
      ctx.fillStyle = css(darken(base, 0.35)); ctx.beginPath(); ctx.moveTo(ex - s * 4, ey - 4); ctx.lineTo(ex + s * 30, ey + 6); ctx.lineTo(ex + s * 22, ey + band / 2 + 6); ctx.lineTo(ex + s * 32, ey + band + 8); ctx.lineTo(ex - s * 4, ey + band + 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = css(INK, 0.6); ctx.lineWidth = 1.2; ctx.stroke();
    }
    ctx.save(); ctx.shadowColor = 'rgba(10,5,30,0.45)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
    ribbon(arcR - band, arcR, a0, a1); const g = ctx.createLinearGradient(0, 14, 0, 14 + band); g.addColorStop(0, css(lighten(base, 0.25))); g.addColorStop(1, css(darken(base, 0.15))); ctx.fillStyle = g; ctx.fill(); ctx.restore();
    ribbon(arcR - band + 3, arcR - 3, a0 + 0.004, a1 - 0.004); ctx.strokeStyle = css(lighten(base, 0.6), 0.7); ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
    ribbon(arcR - band, arcR, a0, a1); ctx.strokeStyle = css(INK, 0.7); ctx.lineWidth = 1.5; ctx.stroke();
    // kavisli harfler
    const fs = title.length > 16 ? 15 : 17; ctx.font = `800 ${fs}px ${MAP_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const text = title.toLocaleUpperCase('tr-TR'); const spacing = 1.6;
    const widths = [...text].map((ch) => ctx.measureText(ch).width + spacing); const total = widths.reduce((a, b) => a + b, 0);
    const r = arcR - band / 2; let a = -total / 2 / r;
    for (const [i, ch] of [...text].entries()) {
      const wch = widths[i]!; const am = a + wch / 2 / r;
      ctx.save(); ctx.translate(cx + Math.sin(am) * r, cy - Math.cos(am) * r); ctx.rotate(am);
      ctx.lineWidth = 3; ctx.strokeStyle = css(darken(base, 0.55), 0.9); ctx.strokeText(ch, 0, 1); ctx.fillStyle = css(paper); ctx.fillText(ch, 0, 1); ctx.restore();
      a += wch / r;
    }
    // yer adı + canlanma noktaları
    ctx.font = `italic 600 12px ${MAP_FONT}`; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,12,50,0.75)'; ctx.strokeText(place, cx, 60); ctx.fillStyle = locked ? '#cfc6ef' : '#fff1c2'; ctx.fillText(place, cx, 60);
    if (!locked) for (let i = 0; i < 4; i++) {
      const x = cx - 27 + i * 18, y = 79; const on = i < vitality;
      if (on) glow(ctx, x, y, 9, 0xffd84a, 0.6);
      starPath(ctx, x, y, 6.5); ctx.fillStyle = on ? '#ffc93c' : 'rgba(40,28,90,0.85)'; ctx.fill(); ctx.strokeStyle = on ? '#8a4b00' : 'rgba(200,190,255,0.6)'; ctx.lineWidth = 1.1; ctx.stroke();
    }
    void mix;
  });
}

/** Ninni Merkezi: altın hilal beşik + kubbe (finalin yer imi) */
export function palaceTex(scene: Phaser.Scene, R: number): string {
  return canvasTex(scene, 'm-palace', 240, 220, Math.min(R, 2), (ctx) => {
    glow(ctx, 120, 110, 110, 0xffd77a, 0.5);
    // kule ve kubbe
    const body = ctx.createLinearGradient(0, 80, 0, 200); body.addColorStop(0, '#fff3d6'); body.addColorStop(1, '#e6b86a');
    ctx.fillStyle = body; ctx.strokeStyle = css(INK, 0.8); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(70, 110, 100, 90, 6); ctx.fill(); ctx.stroke();
    for (const x of [52, 168]) { ctx.beginPath(); ctx.roundRect(x, 130, 22, 70, 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ff5c8a'; ctx.beginPath(); ctx.moveTo(x - 4, 132); ctx.lineTo(x + 11, 108); ctx.lineTo(x + 26, 132); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = body; }
    const dome = ctx.createLinearGradient(0, 50, 0, 112); dome.addColorStop(0, '#b69bff'); dome.addColorStop(1, '#6c4cf1');
    ctx.fillStyle = dome; ctx.beginPath(); ctx.moveTo(66, 112); ctx.quadraticCurveTo(70, 50, 120, 44); ctx.quadraticCurveTo(170, 50, 174, 112); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(100, 76, 10, 22, 0.3, 0, Math.PI * 2); ctx.fill();
    // kapı ve pencereler
    ctx.fillStyle = '#4a2f86'; ctx.beginPath(); ctx.moveTo(106, 200); ctx.lineTo(106, 168); ctx.arc(120, 168, 14, Math.PI, 0); ctx.lineTo(134, 200); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe27a'; for (const x of [84, 146]) { ctx.beginPath(); ctx.arc(x, 140, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    // hilal (beşik) ve yıldız
    ctx.fillStyle = '#ffc93c'; ctx.beginPath(); ctx.arc(120, 26, 20, 0.3 * Math.PI, 1.7 * Math.PI, false); ctx.arc(128, 22, 16, 1.62 * Math.PI, 0.38 * Math.PI, true); ctx.closePath(); ctx.fill(); ctx.stroke();
    starPath(ctx, 150, 16, 8); ctx.fillStyle = '#fff6b0'; ctx.fill();
  });
}
