/**
 * Biyom arka planı: gök + 5 paralaks katman (uzak siluet, orta-uzak, orta, yakın, ön plan örtücüleri).
 * Her katman Canvas 2D ile BİR KEZ boyanır (biyom başına önbellek anahtarı), yatayda kesintisiz döşenir (TileSprite).
 * Kare başına iş: birkaç tilePosition/y ataması + birkaç ışık/sis/parçacık nesnesinin alfası. Ağır shader yok.
 */
import Phaser from 'phaser';
import type { BiomeBackdrop } from './types';
import { artOf, type BiomeArt } from './palette';
import { screenOrigin, viewTopLeft, canvasTex, circle, css, darken, glow, glowEllipse, grain, hashStr, lighten, mix, renderResolution, ridgeFn, rng, softFill, sparkle, taperHair, tono, wrapX, type Ctx, type Rnd } from './util';

const TW = 1024;          // katman döşeme genişliği (tasarım px)
const OVER = 180;         // katmanın ekran altının altına taşan kısmı (kamera aşağı inerse)

type Painter = (ctx: Ctx, W: number, H: number, rnd: Rnd, A: BiomeArt) => void;
interface LayerDef { name: string; f: number; h: number; R: number; paint: Painter; depth: number; blend?: 'add' }

// ---------------------------------------------------------------- ortak siluet araçları
/** yol: y = base + fn(x), altı H'ye kadar dolu */
function ridgePath(ctx: Ctx, W: number, H: number, base: number, fn: (x: number) => number, step = 4) {
  ctx.beginPath(); ctx.moveTo(-2, H + 2);
  for (let x = -2; x <= W + 2; x += step) ctx.lineTo(x, base + fn(x));
  ctx.lineTo(W + 2, H + 2); ctx.closePath();
}
/** siluet dolgusu: üstte puslu → altta koyu gradyan + üst kenarda ışık şeridi (rim light) */
function silhouette(ctx: Ctx, path: () => void, top: number, color: number, H: number, rimC: number, rimA = 0.55, rimW = 2.5, haze?: number, hazeA = 0.35) {
  ctx.save();
  path(); ctx.fillStyle = css(rimC, rimA); ctx.fill();
  path(); ctx.clip();
  ctx.translate(0, rimW);
  const g = ctx.createLinearGradient(0, top, 0, H);
  g.addColorStop(0, css(haze != null ? mix(color, haze, hazeA) : color)); g.addColorStop(0.35, css(color)); g.addColorStop(1, css(darken(color, 0.45)));
  path(); ctx.fillStyle = g; ctx.fill();
  ctx.restore();
}
/** atmosfer: katmanın tamamına alttan yukarı hafif sis (yalnız boyalı piksellere) */
function hazeOver(ctx: Ctx, W: number, H: number, c: number, y0: number, y1: number, a: number) {
  ctx.save(); ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, css(c, a)); g.addColorStop(1, css(c, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}
/** boyalı piksellere ince doku (suluboya/kağıt) */
function grainOver(ctx: Ctx, W: number, H: number, rnd: Rnd, density = 0.02) {
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; grain(ctx, W, H, rnd, Math.round(W * H * density / 10), 0xffffff, 0x000000, 0.06); ctx.restore();
}
/** odak dışı çizim: ayrı tuvale çizilir, tek seferde bulanıklaştırılıp birleştirilir (filtre desteklenmezse keskin kalır) */
function blurred(ctx: Ctx, px: number, draw: (c: Ctx) => void) {
  const off = document.createElement('canvas'); off.width = ctx.canvas.width; off.height = ctx.canvas.height;
  const o = off.getContext('2d')!; o.setTransform(ctx.getTransform()); draw(o);
  const k = Math.hypot(ctx.getTransform().a, ctx.getTransform().b) || 1;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); try { ctx.filter = `blur(${px * k}px)`; } catch { /* yok */ } ctx.drawImage(off, 0, 0); ctx.restore();
}
/** yumuşak (odak dışı) siluet: ön plan derinlik bulanıklığı */
function blurShape(ctx: Ctx, path: () => void, c: number, a: number, blur: number) { softFill(ctx, path, css(c, a), blur); }

// ---------------------------------------------------------------- gök (sabit, ekran boyutunda)
function paintSky(ctx: Ctx, W: number, H: number, rnd: Rnd, A: BiomeArt) {
  const [t, m, hz] = A.sky;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, css(t)); g.addColorStop(0.5, css(m)); g.addColorStop(0.86, css(mix(m, hz, 0.75))); g.addColorStop(1, css(hz));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // ana ışık
  const L = A.light; const lx = L.x * W, ly = L.y * H;
  glow(ctx, lx, ly, L.r * H, L.c, 0.42);
  glow(ctx, lx, ly, L.r * H * 0.4, lighten(L.c, 0.3), 0.35);
  // yıldızlar (üst yarı yoğun)
  const nStars = A.underwater ? 40 : 120;
  for (let i = 0; i < nStars; i++) {
    const x = rnd() * W, y = Math.pow(rnd(), 1.6) * H * 0.75, r = 0.4 + rnd() * 1.2;
    const c = rnd() < 0.2 ? A.motes[0]! : 0xffffff;
    glow(ctx, x, y, r * 4, c, 0.18 + rnd() * 0.2); ctx.fillStyle = css(c, 0.5 + rnd() * 0.5); circle(ctx, x, y, r * 0.6); ctx.fill();
  }
  for (let i = 0; i < 6; i++) sparkle(ctx, rnd() * W, rnd() * H * 0.45, 2 + rnd() * 2.5, A.motes[i % A.motes.length]!, 0.8);
  switch (A.motif) {
    case 'cortex': {
      // aurora şeritleri
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        const c = [0xff6fd0, 0x8b6bff, 0xffc93c][k]!; const y0 = H * (0.16 + k * 0.08);
        for (let x = -20; x < W + 20; x += 3) { const y = y0 + Math.sin(x / 70 + k * 2) * 30 + Math.sin(x / 23 + k) * 8; const gg = ctx.createLinearGradient(0, y - 70, 0, y + 10); gg.addColorStop(0, css(c, 0)); gg.addColorStop(0.8, css(c, 0.07)); gg.addColorStop(1, css(c, 0)); ctx.fillStyle = gg; ctx.fillRect(x, y - 70, 3, 80); }
      }
      ctx.restore();
      // nöron takımyıldızları
      for (let n = 0; n < 4; n++) {
        const cx = rnd() * W, cy = 40 + rnd() * H * 0.35; const pts: [number, number][] = [];
        for (let i = 0; i < 5; i++) pts.push([cx + (rnd() - 0.5) * 120, cy + (rnd() - 0.5) * 70]);
        ctx.strokeStyle = css(0xffe6a8, 0.25); ctx.lineWidth = 0.8; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        for (const [x, y] of pts) { glow(ctx, x, y, 7, 0xfff1a8, 0.5); ctx.fillStyle = '#fffbe8'; circle(ctx, x, y, 1.2); ctx.fill(); }
      }
      break;
    }
    case 'nerve': {
      // uzak galaksi bulutu
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) glowEllipse(ctx, W * (0.1 + rnd() * 0.8), H * (0.15 + rnd() * 0.5), 60 + rnd() * 120, 20 + rnd() * 40, i % 2 ? 0x2a5ad8 : 0x6a3ad8, 0.12);
      ctx.restore(); break;
    }
    case 'spiral': {
      // yukarıdan süzülen ışık (su yüzeyi)
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const sg = ctx.createLinearGradient(0, 0, 0, H * 0.3); sg.addColorStop(0, css(lighten(A.light.c, 0.2), 0.35)); sg.addColorStop(1, css(A.light.c, 0)); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H * 0.3);
      ctx.restore(); break;
    }
    default: break;
  }
}

// ---------------------------------------------------------------- AURICLE · Dış Kulak (gün batımı, kepçe kıvrımları, kıl ormanı)
const auricle: Record<string, Painter> = {
  far: (ctx, W, H, rnd, A) => {
    const top = H - OVER - 470;
    // dev kulak kepçesi tepeleri: heliks kıvrımı, konka çukuru, antiheliks sırtı, lob
    const ears: [number, number, number, boolean][] = [[W * 0.2, H - OVER - 150, 300, false], [W * 0.68, H - OVER - 130, 380, true]];
    for (const [ex, ey, sz, flip] of ears) wrapX(W, ex, sz * 0.7, (x) => earHill(ctx, x, ey, sz, flip, mix(A.far, A.sky[1], 0.2), A));
    const f = ridgeFn(W, rnd, 40, 4, 2);
    silhouette(ctx, () => ridgePath(ctx, W, H, H - OVER - 170, f), top, A.far, H, A.light.c, 0.5, 2.5, A.fog, 0.5);
    hazeOver(ctx, W, H, A.fog, top, H - OVER, 0.25); grainOver(ctx, W, H, rnd);
  },
  midFar: (ctx, W, H, rnd, A) => {
    const base = H - OVER - 150; const f = ridgeFn(W, rnd, 34, 4, 3);
    // uzak kıl ağaçları (tüysü)
    for (let i = 0; i < 14; i++) {
      const x = rnd() * W, y = base + f(x) + 10, len = 120 + rnd() * 140;
      wrapX(W, x, 80, (xx) => featherTree(ctx, xx, y, len, -Math.PI / 2 + (rnd() - 0.5) * 0.3, mix(A.midFar, A.fog, 0.18), 0.85, rnd));
    }
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 60, A.midFar, H, A.light.c, 0.45, 2.5, A.fog, 0.35);
    hazeOver(ctx, W, H, A.fog, base - 260, H - OVER, 0.3); grainOver(ctx, W, H, rnd);
  },
  mid: (ctx, W, H, rnd, A) => {
    const base = H - OVER - 110; const f = ridgeFn(W, rnd, 26, 3, 3);
    for (let i = 0; i < 11; i++) {
      const x = (i + rnd() * 0.6) * (W / 11), y = base + f(x) + 6, len = 170 + rnd() * 150;
      wrapX(W, x, 100, (xx) => featherTree(ctx, xx, y, len, -Math.PI / 2 + (rnd() - 0.5) * 0.35, A.mid, 1, rnd, A.accent2, A.light.c));
    }
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 40, A.mid, H, A.light.c, 0.5, 2, A.fog, 0.2);
    // gözenek ışıkları (sevimli küçük parıltılar)
    for (let i = 0; i < 26; i++) { const x = rnd() * W, y = base + f(x) + 14 + rnd() * 60; glow(ctx, x, y, 6 + rnd() * 6, A.motes[i % 3]!, 0.45); }
    grainOver(ctx, W, H, rnd);
  },
  near: (ctx, W, H, rnd, A) => {
    const base = H - OVER - 70; const f = ridgeFn(W, rnd, 22, 4, 4);
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 30, A.near, H, A.accent2, 0.5, 2.5);
    // kalın kıvrık kıllar
    for (let i = 0; i < 40; i++) { const x = rnd() * W; const y = base + f(x) + 4; wrapX(W, x, 40, (xx) => taperHair(ctx, xx, y, 26 + rnd() * 40, -Math.PI / 2 + (rnd() - 0.5) * 1.1, (rnd() - 0.5) * 1.4, 3.2, darken(A.near, 0.1), 1)); }
    for (let i = 0; i < 12; i++) { const x = rnd() * W, y = base + f(x) + 20 + rnd() * 50; glow(ctx, x, y, 3 + rnd() * 3, A.motes[0]!, 0.7); }
  },
  fg: (ctx, W, H, rnd, A) => {
    // odak dışı dev kıllar ve kenar tümsekleri
    const base = H - OVER - 10;
    for (let i = 0; i < 5; i++) { const cx = rnd() * W; wrapX(W, cx, 160, (x) => blurShape(ctx, () => { ctx.beginPath(); ctx.ellipse(x, base + 30, 120 + rnd() * 80, 70 + rnd() * 30, 0, 0, Math.PI * 2); }, A.fg, 0.95, 10)); }
    blurred(ctx, 3, (c) => { for (let i = 0; i < 7; i++) { const x = rnd() * W; wrapX(W, x, 120, (xx) => taperHair(c, xx, H, 120 + rnd() * 120, -Math.PI / 2 + (rnd() - 0.5) * 0.9, (rnd() - 0.5) * 1.2, 9, A.fg, 0.95)); } });
  },
};
/** kulak biçimli tepe (yan görünüş): dış kıvrım (heliks), iç çukur (konka), antiheliks sırtı ve lob */
function earHill(ctx: Ctx, x: number, base: number, sz: number, flip: boolean, c: number, A: BiomeArt) {
  ctx.save(); ctx.translate(x, base); if (flip) ctx.scale(-1, 1);
  const k = sz / 300;
  const outer = () => { ctx.beginPath(); ctx.moveTo(-120 * k, 40 * k); ctx.bezierCurveTo(-170 * k, -120 * k, -110 * k, -300 * k, 10 * k, -300 * k); ctx.bezierCurveTo(130 * k, -300 * k, 170 * k, -190 * k, 140 * k, -100 * k); ctx.bezierCurveTo(120 * k, -40 * k, 80 * k, -10 * k, 90 * k, 40 * k); ctx.bezierCurveTo(95 * k, 80 * k, 60 * k, 100 * k, 30 * k, 100 * k); ctx.lineTo(-120 * k, 100 * k); ctx.closePath(); };
  silhouette(ctx, outer, -300 * k, c, 100 * k, A.light.c, 0.6, 3, A.fog, 0.35);
  // konka: içe doğru gölgeli çukur
  ctx.save(); outer(); ctx.clip();
  const conch = () => { ctx.beginPath(); ctx.ellipse(10 * k, -110 * k, 62 * k, 80 * k, 0.25, 0, Math.PI * 2); };
  conch(); const g = ctx.createRadialGradient(20 * k, -90 * k, 5 * k, 10 * k, -110 * k, 85 * k); g.addColorStop(0, css(darken(c, 0.45), 0.9)); g.addColorStop(1, css(darken(c, 0.15), 0.5)); ctx.fillStyle = g; ctx.fill();
  // antiheliks sırtı ve heliks kenarı (ışıklı)
  ctx.lineCap = 'round';
  ctx.strokeStyle = css(lighten(c, 0.18), 0.9); ctx.lineWidth = 16 * k; ctx.beginPath(); ctx.moveTo(-70 * k, -40 * k); ctx.bezierCurveTo(-90 * k, -150 * k, -40 * k, -220 * k, 40 * k, -230 * k); ctx.stroke();
  ctx.strokeStyle = css(A.light.c, 0.35); ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.moveTo(-74 * k, -50 * k); ctx.bezierCurveTo(-94 * k, -155 * k, -44 * k, -226 * k, 38 * k, -238 * k); ctx.stroke();
  ctx.strokeStyle = css(darken(c, 0.3), 0.6); ctx.lineWidth = 7 * k; ctx.beginPath(); ctx.moveTo(-118 * k, 0); ctx.bezierCurveTo(-150 * k, -120 * k, -100 * k, -272 * k, 10 * k, -276 * k); ctx.bezierCurveTo(115 * k, -276 * k, 150 * k, -190 * k, 120 * k, -110 * k); ctx.stroke();
  // tragus
  ctx.fillStyle = css(lighten(c, 0.1)); ctx.beginPath(); ctx.ellipse(-30 * k, -40 * k, 22 * k, 30 * k, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();
}
/** tüy/kıl ağacı: kıvrık gövde + iki yana incelen teller; uçlarda polen ışığı */
function featherTree(ctx: Ctx, x: number, y: number, len: number, ang: number, c: number, a: number, rnd: Rnd, tip?: number, rim?: number) {
  const curl = (rnd() - 0.5) * 0.5; const n = 14;
  const pt = (t: number): [number, number] => { const aa = ang + curl * t * t; return [x + Math.cos(aa) * len * t, y + Math.sin(aa) * len * t]; };
  ctx.lineCap = 'round';
  for (let i = 1; i < n; i++) {
    const t = i / n; const [bx, by] = pt(t); const bl = len * 0.28 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 4;
    for (const s of [-1, 1]) {
      const aa = ang + curl * t * t + s * (0.9 - t * 0.3);
      ctx.strokeStyle = css(c, a * 0.9); ctx.lineWidth = Math.max(1, 2.2 * (1 - t * 0.6));
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + Math.cos(aa) * bl * 0.6, by + Math.sin(aa) * bl * 0.6 - 3, bx + Math.cos(aa + s * 0.25) * bl, by + Math.sin(aa + s * 0.25) * bl + 2); ctx.stroke();
      if (tip != null && rnd() < 0.35) glow(ctx, bx + Math.cos(aa + s * 0.25) * bl, by + Math.sin(aa + s * 0.25) * bl + 2, 4, tip, 0.55);
    }
  }
  taperHair(ctx, x, y, len, ang, curl, 6, c, a);
  if (rim != null) { const [tx, ty] = pt(1); glow(ctx, tx, ty, 10, rim, 0.35); }
}

// ---------------------------------------------------------------- TUNNEL · Kulak Kanalı (sıcak tünel, serumen ışığı)
const tunnel: Record<string, Painter> = {
  far: (ctx, W, H, rnd, A) => {
    // tünel halkaları: ufuktaki ışığın çevresinde perspektif kemerler
    const vx = W * 0.5, vy = H - OVER - 300;
    for (let i = 6; i >= 0; i--) {
      const rx = 90 + i * 100, ry = 120 + i * 88; const c = mix(darken(A.far, 0.25), A.sky[1], 0.3 + (6 - i) * 0.07);
      wrapX(W, vx, rx + 30, (x) => {
        const p = () => { ctx.beginPath(); ctx.ellipse(x, vy, rx + 26, ry + 22, 0, Math.PI, 0); ctx.lineTo(x + rx + 26, H); ctx.lineTo(x + rx, H); ctx.lineTo(x + rx, vy); ctx.ellipse(x, vy, rx, ry, 0, 0, Math.PI, true); ctx.lineTo(x - rx, H); ctx.lineTo(x - rx - 26, H); ctx.closePath(); };
        silhouette(ctx, p, vy - ry, c, H, A.light.c, 0.18 + (6 - i) * 0.04, 1.5, A.fog, 0.25);
      });
    }
    for (let x = 0; x < W; x += 3) { const y = H - OVER - 120 + Math.sin(x / W * Math.PI * 6) * 10; ctx.fillStyle = css(darken(A.far, 0.2), 1); ctx.fillRect(x, y, 3, H - y); }
    hazeOver(ctx, W, H, A.fog, vy - 300, H - OVER, 0.25); grainOver(ctx, W, H, rnd);
  },
  midFar: (ctx, W, H, rnd, A) => {
    // tavan sarkıtları (serumen) + taban tümsekleri
    const ceil = ridgeFn(W, rnd, 24, 3, 3);
    ctx.save(); ctx.translate(0, 0);
    silhouette(ctx, () => { ctx.beginPath(); ctx.moveTo(-2, -2); for (let x = -2; x <= W + 2; x += 4) ctx.lineTo(x, 70 + ceil(x)); ctx.lineTo(W + 2, -2); ctx.closePath(); }, 0, A.midFar, 120, A.light.c, 0.3, 2);
    ctx.restore();
    for (let i = 0; i < 16; i++) { const x = rnd() * W, len = 60 + rnd() * 160; wrapX(W, x, 30, (xx) => stalactite(ctx, xx, 60 + ceil(xx), len, 10 + rnd() * 12, mix(A.midFar, A.accent2, 0.25), A.light.c)); }
    const f = ridgeFn(W, rnd, 30, 4, 2); const base = H - OVER - 150;
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 40, A.midFar, H, A.light.c, 0.45, 2.5, A.fog, 0.3);
    hazeOver(ctx, W, H, A.fog, 0, H, 0.12); grainOver(ctx, W, H, rnd);
  },
  mid: (ctx, W, H, rnd, A) => {
    // parlayan serumen damlaları ve bal gölcükleri
    const ceil = ridgeFn(W, rnd, 18, 3, 4);
    silhouette(ctx, () => { ctx.beginPath(); ctx.moveTo(-2, -2); for (let x = -2; x <= W + 2; x += 4) ctx.lineTo(x, 30 + ceil(x)); ctx.lineTo(W + 2, -2); ctx.closePath(); }, 0, A.mid, 60, A.accent2, 0.35, 2);
    for (let i = 0; i < 12; i++) { const x = rnd() * W, len = 40 + rnd() * 120; wrapX(W, x, 30, (xx) => stalactite(ctx, xx, 24 + ceil(xx), len, 8 + rnd() * 10, mix(A.mid, A.accent2, 0.2), A.accent)); }
    const f = ridgeFn(W, rnd, 24, 3, 3); const base = H - OVER - 100;
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 30, A.mid, H, A.accent2, 0.5, 2.5);
    for (let i = 0; i < 9; i++) { const x = rnd() * W, y = base + f(x) + 6; wrapX(W, x, 40, (xx) => honeyPool(ctx, xx, y, 24 + rnd() * 26, A)); }
    for (let i = 0; i < 30; i++) { const x = rnd() * W; taperHair(ctx, x, base + f(x) + 4, 18 + rnd() * 26, -Math.PI / 2 + (rnd() - 0.5) * 1.2, (rnd() - 0.5), 2.2, darken(A.mid, 0.2), 1); }
    grainOver(ctx, W, H, rnd);
  },
  near: (ctx, W, H, rnd, A) => {
    const f = ridgeFn(W, rnd, 26, 4, 4); const base = H - OVER - 60;
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 30, A.near, H, A.accent, 0.4, 2);
    for (let i = 0; i < 24; i++) { const x = rnd() * W; taperHair(ctx, x, base + f(x) + 3, 30 + rnd() * 40, -Math.PI / 2 + (rnd() - 0.5) * 1.3, (rnd() - 0.5) * 1.4, 3.4, darken(A.near, 0.15), 1); }
    for (let i = 0; i < 10; i++) { const x = rnd() * W, y = base + f(x) + 22 + rnd() * 40; drop(ctx, x, y, 3 + rnd() * 3, A.accent, 0.8); }
  },
  fg: (ctx, W, H, rnd, A) => {
    const base = H - OVER;
    for (let i = 0; i < 6; i++) { const cx = rnd() * W; wrapX(W, cx, 160, (x) => blurShape(ctx, () => { ctx.beginPath(); ctx.ellipse(x, base + 30, 110 + rnd() * 90, 60 + rnd() * 30, 0, 0, Math.PI * 2); }, A.fg, 0.95, 12)); }
    blurred(ctx, 2, (c) => { for (let i = 0; i < 4; i++) { const x = rnd() * W; wrapX(W, x, 40, (xx) => drop(c, xx, base - 10 - rnd() * 30, 6 + rnd() * 5, A.accent, 0.5)); } });
  },
  fgTop: (ctx, W, _H, rnd, A) => {
    // odak dışı tavan sarkıtları (ekranın üst kenarı)
    for (let i = 0; i < 5; i++) { const x = rnd() * W; wrapX(W, x, 80, (xx) => blurShape(ctx, () => { ctx.beginPath(); ctx.moveTo(xx - 40 - rnd() * 30, -5); ctx.quadraticCurveTo(xx - 10, 60 + rnd() * 60, xx, 90 + rnd() * 80); ctx.quadraticCurveTo(xx + 12, 60, xx + 46 + rnd() * 30, -5); ctx.closePath(); }, A.fg, 0.95, 8)); }
    for (let i = 0; i < 5; i++) { const x = rnd() * W; glow(ctx, x, 40 + rnd() * 60, 8, A.accent, 0.35); }
  },
};
function stalactite(ctx: Ctx, x: number, y: number, len: number, w: number, c: number, light: number) {
  const p = () => { ctx.beginPath(); ctx.moveTo(x - w, y - 4); ctx.bezierCurveTo(x - w * 0.8, y + len * 0.5, x - w * 0.25, y + len * 0.75, x, y + len); ctx.bezierCurveTo(x + w * 0.25, y + len * 0.75, x + w * 0.8, y + len * 0.5, x + w, y - 4); ctx.closePath(); };
  const g = ctx.createLinearGradient(0, y, 0, y + len); g.addColorStop(0, css(darken(c, 0.2))); g.addColorStop(1, css(lighten(c, 0.15)));
  p(); ctx.fillStyle = g; ctx.fill();
  ctx.save(); p(); ctx.clip(); ctx.strokeStyle = css(light, 0.35); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - w * 0.5, y); ctx.quadraticCurveTo(x - w * 0.3, y + len * 0.6, x - 1, y + len - 2); ctx.stroke(); ctx.restore();
  drop(ctx, x, y + len + w * 0.9, w * 0.42, light, 0.85);
}
function drop(ctx: Ctx, x: number, y: number, r: number, c: number, a = 1) {
  glow(ctx, x, y, r * 3.2, c, 0.35 * a);
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.2, r * 0.1, x, y, r * 1.3);
  g.addColorStop(0, css(lighten(c, 0.6), a)); g.addColorStop(0.5, css(c, a)); g.addColorStop(1, css(darken(c, 0.3), a));
  ctx.beginPath(); ctx.moveTo(x, y - r * 2); ctx.bezierCurveTo(x + r * 0.4, y - r * 1.2, x + r, y - r * 0.6, x + r, y); ctx.arc(x, y, r, 0, Math.PI); ctx.bezierCurveTo(x - r, y - r * 0.6, x - r * 0.4, y - r * 1.2, x, y - r * 2); ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = css(0xffffff, 0.7 * a); ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.25, r * 0.18, r * 0.3, -0.4, 0, Math.PI * 2); ctx.fill();
}
function honeyPool(ctx: Ctx, x: number, y: number, r: number, A: BiomeArt) {
  glowEllipse(ctx, x, y, r * 1.8, r * 0.7, A.accent, 0.35);
  const g = ctx.createLinearGradient(0, y - r * 0.3, 0, y + r * 0.3); g.addColorStop(0, css(lighten(A.ground.top, 0.3))); g.addColorStop(1, css(A.ground.topLo));
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = css(0xffffff, 0.55); ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.08, r * 0.3, r * 0.06, 0, 0, Math.PI * 2); ctx.fill();
}

// ---------------------------------------------------------------- DRUM · Kulak Zarı (dev zar diski, dalgalar)
const drum: Record<string, Painter> = {
  far: (ctx, W, H, rnd, A) => {
    // gökte dev, yarı saydam zar: radyal lifler, eşmerkezli halkalar, çekiç sapı (umbo)
    const cx = W * 0.3, cy = H - OVER - 390, R = 240;
    wrapX(W, cx, R + 60, (x) => {
      glow(ctx, x, cy, R * 1.5, A.light.c, 0.25);
      const g = ctx.createRadialGradient(x - R * 0.3, cy - R * 0.35, R * 0.1, x, cy, R);
      g.addColorStop(0, css(lighten(A.light.c, 0.5), 0.55)); g.addColorStop(0.7, css(A.light.c, 0.28)); g.addColorStop(1, css(A.far, 0.45));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, cy, R, R * 0.92, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.ellipse(x, cy, R, R * 0.92, -0.2, 0, Math.PI * 2); ctx.clip();
      ctx.strokeStyle = css(0xffffff, 0.12); ctx.lineWidth = 1.2;
      for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(x + 18, cy + 30); ctx.lineTo(x + Math.cos(a) * R * 1.1, cy + Math.sin(a) * R * 1.1); ctx.stroke(); }
      for (let i = 1; i < 7; i++) { ctx.strokeStyle = css(0xffffff, 0.16 - i * 0.015); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x + 18, cy + 30, R * i * 0.15, R * i * 0.14, -0.2, 0, Math.PI * 2); ctx.stroke(); }
      // çekiç sapı
      ctx.strokeStyle = css(0xfff0f8, 0.55); ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 30, cy - R * 0.85); ctx.quadraticCurveTo(x - 4, cy - 40, x + 18, cy + 30); ctx.stroke();
      ctx.strokeStyle = css(0xffffff, 0.35); ctx.lineWidth = 3; ctx.stroke();
      glow(ctx, x + 18, cy + 30, 30, 0xffffff, 0.45);
      ctx.restore();
      ctx.strokeStyle = css(lighten(A.light.c, 0.4), 0.55); ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x, cy, R, R * 0.92, -0.2, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = css(A.far, 0.6); ctx.lineWidth = 14; ctx.beginPath(); ctx.ellipse(x, cy, R + 10, R * 0.92 + 10, -0.2, 0, Math.PI * 2); ctx.stroke();
    });
    const f = ridgeFn(W, rnd, 30, 4, 3); const base = H - OVER - 180;
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 40, A.far, H, A.light.c, 0.55, 2.5, A.fog, 0.45);
    hazeOver(ctx, W, H, A.fog, base - 60, H - OVER, 0.25); grainOver(ctx, W, H, rnd);
  },
  midFar: (ctx, W, H, rnd, A) => {
    // titreşen tepeler: parlak dalga çizgileri
    const base = H - OVER - 140; const f = (x: number) => Math.sin((x / W) * Math.PI * 2 * 5) * 26 + Math.sin((x / W) * Math.PI * 2 * 11 + 1) * 8;
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 40, A.midFar, H, A.light.c, 0.5, 2.5, A.fog, 0.3);
    ctx.save(); ridgePath(ctx, W, H, base, f); ctx.clip();
    for (let k = 1; k < 7; k++) { ctx.strokeStyle = css(lighten(A.midFar, 0.3), 0.22 - k * 0.025); ctx.lineWidth = 2; ctx.beginPath(); for (let x = 0; x <= W; x += 4) { const y = base + f(x) * (1 - k * 0.08) + k * 16; if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); }
    ctx.restore();
    hazeOver(ctx, W, H, A.fog, base - 60, H - OVER, 0.25); grainOver(ctx, W, H, rnd);
  },
  mid: (ctx, W, H, rnd, A) => {
    // gergin zar yayları (yarım kubbeler) + süzülen dalga halkaları
    const base = H - OVER - 100;
    for (let i = 0; i < 6; i++) {
      const x = (i + 0.3 + rnd() * 0.4) * (W / 6), r = 70 + rnd() * 50;
      wrapX(W, x, r + 10, (xx) => {
        const p = () => { ctx.beginPath(); ctx.ellipse(xx, base + 30, r, r * 0.8, 0, Math.PI, 0); ctx.closePath(); };
        silhouette(ctx, p, base - r, mix(A.mid, A.accent, 0.12), base + 30, lighten(A.light.c, 0.2), 0.6, 2.5);
        ctx.save(); p(); ctx.clip(); ctx.strokeStyle = css(0xffffff, 0.12); ctx.lineWidth = 1.2; for (let k = 0; k < 9; k++) { const a = Math.PI + (k / 8) * Math.PI; ctx.beginPath(); ctx.moveTo(xx, base + 30); ctx.lineTo(xx + Math.cos(a) * r, base + 30 + Math.sin(a) * r * 0.8); ctx.stroke(); } ctx.restore();
      });
    }
    const f = ridgeFn(W, rnd, 18, 3, 4);
    silhouette(ctx, () => ridgePath(ctx, W, H, base + 20, f), base, A.mid, H, A.accent, 0.4, 2);
    for (let i = 0; i < 14; i++) { const x = rnd() * W, y = base - 60 - rnd() * 200; ctx.strokeStyle = css(A.motes[0]!, 0.25); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, 10 + rnd() * 16, 4 + rnd() * 5, 0, 0, Math.PI * 2); ctx.stroke(); }
    grainOver(ctx, W, H, rnd);
  },
  near: (ctx, W, H, rnd, A) => {
    const base = H - OVER - 60; const f = ridgeFn(W, rnd, 24, 3, 4);
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 30, A.near, H, A.accent, 0.45, 2.5);
    for (let i = 0; i < 18; i++) { const x = rnd() * W, y = base + f(x) + 18 + rnd() * 50; sparkle(ctx, x, y, 2 + rnd() * 2, A.motes[i % 3]!, 0.7); }
  },
  fg: (ctx, W, H, rnd, A) => {
    const base = H - OVER;
    for (let i = 0; i < 6; i++) { const cx = rnd() * W; wrapX(W, cx, 170, (x) => blurShape(ctx, () => { ctx.beginPath(); ctx.ellipse(x, base + 36, 130 + rnd() * 70, 60 + rnd() * 30, 0, 0, Math.PI * 2); }, A.fg, 0.95, 12)); }
  },
};

// ---------------------------------------------------------------- BONES · Kemikçikler (ay ışığı, kemik kemerler)
const bones: Record<string, Painter> = {
  far: (ctx, W, H, rnd, A) => {
    const base = H - OVER - 160;
    // dev üzengi kemeri (stapes) + örs (incus) + çekiç (malleus) siluetleri
    const c = mix(A.far, A.sky[1], 0.3);
    wrapX(W, W * 0.25, 200, (x) => stapes(ctx, x, base + 30, 330, c, A.light.c));
    wrapX(W, W * 0.72, 220, (x) => incus(ctx, x, base + 10, 260, mix(A.far, A.sky[1], 0.2), A.light.c));
    const f = ridgeFn(W, rnd, 30, 4, 2);
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 40, A.far, H, A.light.c, 0.5, 2.5, A.fog, 0.4);
    hazeOver(ctx, W, H, A.fog, base - 360, H - OVER, 0.3); grainOver(ctx, W, H, rnd);
  },
  midFar: (ctx, W, H, rnd, A) => {
    const base = H - OVER - 120;
    // kemik kemerler, aralarda altın bağ telleri ve fenerler
    for (let i = 0; i < 4; i++) {
      const x = (i + 0.2 + rnd() * 0.5) * (W / 4), w = 150 + rnd() * 80, h = 140 + rnd() * 90;
      wrapX(W, x, w, (xx) => boneArch(ctx, xx, base + 20, w, h, 22, A.midFar, A.light.c));
    }
    const f = ridgeFn(W, rnd, 22, 3, 3);
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 30, A.midFar, H, A.light.c, 0.45, 2.5, A.fog, 0.3);
    hazeOver(ctx, W, H, A.fog, base - 260, H - OVER, 0.22); grainOver(ctx, W, H, rnd);
  },
  mid: (ctx, W, H, rnd, A) => {
    const base = H - OVER - 90;
    for (let i = 0; i < 7; i++) {
      const x = (i + rnd() * 0.6) * (W / 7), h = 120 + rnd() * 140, w = 22 + rnd() * 14;
      wrapX(W, x, w * 2, (xx) => bonePillar(ctx, xx, base + 20, w, h, (rnd() - 0.5) * 0.25, A.mid, A.light.c));
    }
    // altın bağ telleri + fenerler
    for (let i = 0; i < 5; i++) {
      const x0 = rnd() * W, x1 = x0 + 120 + rnd() * 140, y = base - 60 - rnd() * 100;
      ctx.strokeStyle = css(A.accent, 0.4); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y + 40, x1, y); ctx.stroke();
      for (let k = 1; k < 4; k++) { const t = k / 4; const lx = x0 + (x1 - x0) * t, ly = y + 40 * 2 * t * (1 - t) * 1; glow(ctx, lx, ly + 6, 12, A.accent, 0.5); ctx.fillStyle = css(lighten(A.accent, 0.5)); circle(ctx, lx, ly + 6, 2.2); ctx.fill(); }
    }
    const f = ridgeFn(W, rnd, 18, 3, 4);
    silhouette(ctx, () => ridgePath(ctx, W, H, base + 10, f), base, A.mid, H, A.light.c, 0.45, 2);
    grainOver(ctx, W, H, rnd);
  },
  near: (ctx, W, H, rnd, A) => {
    const base = H - OVER - 60; const f = ridgeFn(W, rnd, 20, 4, 4);
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 30, A.near, H, A.light.c, 0.4, 2);
    for (let i = 0; i < 10; i++) { const x = rnd() * W; wrapX(W, x, 40, (xx) => { ctx.save(); ctx.translate(xx, base + f(xx) + 6); ctx.rotate((rnd() - 0.5) * 1.2); boneShape(ctx, 0, 0, 40 + rnd() * 30, 7 + rnd() * 3, darken(A.near, 0.05), A.light.c, 0.25); ctx.restore(); }); }
  },
  fg: (ctx, W, H, rnd, A) => {
    const base = H - OVER;
    for (let i = 0; i < 5; i++) { const cx = rnd() * W; wrapX(W, cx, 170, (x) => blurShape(ctx, () => { ctx.beginPath(); ctx.ellipse(x, base + 36, 130 + rnd() * 70, 56 + rnd() * 30, 0, 0, Math.PI * 2); }, A.fg, 0.95, 12)); }
    blurred(ctx, 4, (c) => { for (let i = 0; i < 2; i++) { const x = rnd() * W; wrapX(W, x, 120, (xx) => { c.save(); c.translate(xx, base - 20); c.rotate(-0.5 + rnd()); boneShape(c, 0, 0, 160, 22, A.fg, A.fg, 0); c.restore(); }); } });
  },
};
/** kemik: iki ucu topuzlu çubuk (yatay, merkez x,y) */
function boneShape(ctx: Ctx, x: number, y: number, len: number, w: number, c: number, rim: number, rimA: number) {
  const p = () => {
    ctx.beginPath(); const hl = len / 2;
    ctx.moveTo(x - hl, y - w * 0.5); ctx.lineTo(x + hl, y - w * 0.5); ctx.lineTo(x + hl, y + w * 0.5); ctx.lineTo(x - hl, y + w * 0.5); ctx.closePath();
    for (const s of [-1, 1]) for (const t of [-1, 1]) { ctx.moveTo(x + s * hl + w * 0.9, y + t * w * 0.55); ctx.arc(x + s * hl, y + t * w * 0.55, w * 0.9, 0, Math.PI * 2); }
  };
  p(); ctx.fillStyle = css(c); ctx.fill('nonzero');
  if (rimA > 0) { ctx.strokeStyle = css(rim, rimA); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - len / 2, y - w * 0.5); ctx.lineTo(x + len / 2, y - w * 0.5); ctx.stroke(); }
}
function bonePillar(ctx: Ctx, x: number, base: number, w: number, h: number, tilt: number, c: number, light: number) {
  ctx.save(); ctx.translate(x, base); ctx.rotate(tilt);
  const p = () => { ctx.beginPath(); ctx.moveTo(-w * 0.5, 0); ctx.bezierCurveTo(-w * 0.35, -h * 0.4, -w * 0.35, -h * 0.6, -w * 0.5, -h + w * 0.6); ctx.arc(-w * 0.45, -h + w * 0.2, w * 0.65, Math.PI * 0.6, Math.PI * 1.75); ctx.arc(w * 0.45, -h + w * 0.2, w * 0.65, Math.PI * 1.25, Math.PI * 0.4); ctx.bezierCurveTo(w * 0.35, -h * 0.6, w * 0.35, -h * 0.4, w * 0.5, 0); ctx.closePath(); };
  silhouette(ctx, p, -h - w, c, 0, light, 0.55, 2.5);
  ctx.restore();
}
function boneArch(ctx: Ctx, x: number, base: number, w: number, h: number, t: number, c: number, light: number) {
  const p = () => { ctx.beginPath(); ctx.moveTo(x - w / 2 - t, base); ctx.bezierCurveTo(x - w / 2 - t, base - h * 1.3, x + w / 2 + t, base - h * 1.3, x + w / 2 + t, base); ctx.lineTo(x + w / 2, base); ctx.bezierCurveTo(x + w / 2, base - h * 1.3 + t * 2.2, x - w / 2, base - h * 1.3 + t * 2.2, x - w / 2, base); ctx.closePath(); };
  silhouette(ctx, p, base - h, c, base, light, 0.55, 2.5);
  for (const s of [-1, 1]) { ctx.fillStyle = css(c); circle(ctx, x + s * (w / 2 + t / 2), base - 4, t * 0.9); ctx.fill(); }
}
function stapes(ctx: Ctx, x: number, base: number, h: number, c: number, light: number) {
  // üzengi: oval taban plağı, iki kavisli bacak (krus), boyun ve yuvarlak baş
  const w = h * 0.72; const lw = h * 0.085;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const legs = () => { ctx.beginPath(); ctx.moveTo(x - w * 0.42, base - h * 0.08); ctx.bezierCurveTo(x - w * 0.5, base - h * 0.6, x - w * 0.12, base - h * 0.8, x, base - h * 0.8); ctx.moveTo(x + w * 0.42, base - h * 0.08); ctx.bezierCurveTo(x + w * 0.5, base - h * 0.6, x + w * 0.12, base - h * 0.8, x, base - h * 0.8); };
  ctx.strokeStyle = css(light, 0.45); ctx.lineWidth = lw + 4; ctx.save(); ctx.translate(0, -1.5); legs(); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = css(c); ctx.lineWidth = lw; legs(); ctx.stroke();
  // boyun + baş
  ctx.fillStyle = css(c); ctx.beginPath(); ctx.roundRect(x - lw * 0.55, base - h * 0.95, lw * 1.1, h * 0.18, lw * 0.4); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, base - h * 0.98, lw * 1.1, lw * 0.85, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = css(light, 0.5); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, base - h * 0.98, lw * 1.1, lw * 0.85, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  // taban plağı
  ctx.fillStyle = css(c); ctx.beginPath(); ctx.ellipse(x, base - h * 0.06, w * 0.56, h * 0.07, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = css(light, 0.5); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, base - h * 0.06, w * 0.56, h * 0.07, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  // iç boşluk gölgesi
  ctx.fillStyle = css(darken(c, 0.25), 0.35); ctx.beginPath(); ctx.moveTo(x - w * 0.3, base - h * 0.1); ctx.bezierCurveTo(x - w * 0.34, base - h * 0.55, x + w * 0.34, base - h * 0.55, x + w * 0.3, base - h * 0.1); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function incus(ctx: Ctx, x: number, base: number, h: number, c: number, light: number) {
  const p = () => { ctx.beginPath(); ctx.moveTo(x - 60, base); ctx.bezierCurveTo(x - 80, base - h * 0.5, x - 120, base - h * 0.9, x - 40, base - h); ctx.bezierCurveTo(x + 30, base - h * 1.05, x + 90, base - h * 0.8, x + 70, base - h * 0.55); ctx.bezierCurveTo(x + 120, base - h * 0.4, x + 150, base - h * 0.2, x + 130, base); ctx.lineTo(x + 100, base); ctx.bezierCurveTo(x + 90, base - h * 0.25, x + 40, base - h * 0.35, x + 10, base - h * 0.35); ctx.bezierCurveTo(x - 20, base - h * 0.3, x - 30, base - h * 0.1, x - 20, base); ctx.closePath(); };
  silhouette(ctx, p, base - h, c, base, light, 0.5, 3);
}

// ---------------------------------------------------------------- SPIRAL · Koklea (su altı, tonotopi gökkuşağı, tüylü hücreler)
const spiral: Record<string, Painter> = {
  far: (ctx, W, H, rnd, A) => {
    const [lo, hi] = A.tono ?? [0, 1];
    const cx = W * 0.32, cy = H - OVER - 360, R = 230;
    wrapX(W, cx, R + 40, (x) => {
      glow(ctx, x, cy, R * 1.4, A.light.c, 0.18);
      ctx.save(); ctx.lineCap = 'round';
      for (let i = 0; i < 260; i++) {
        const t0 = i / 260, t1 = (i + 1) / 260; const a0 = t0 * 2.6 * Math.PI * 2, a1 = t1 * 2.6 * Math.PI * 2; const r0 = R * (1 - t0 * 0.88), r1 = R * (1 - t1 * 0.88);
        const col = tono(lo + (hi - lo) * t0);
        ctx.strokeStyle = css(mix(col, A.far, 0.55), 0.85); ctx.lineWidth = 40 * (1 - t0 * 0.75);
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a0) * r0, cy + Math.sin(a0) * r0 * 0.9); ctx.lineTo(x + Math.cos(a1) * r1, cy + Math.sin(a1) * r1 * 0.9); ctx.stroke();
      }
      for (let i = 0; i < 260; i++) {
        const t0 = i / 260, t1 = (i + 1) / 260; const a0 = t0 * 2.6 * Math.PI * 2 - 0.05, a1 = t1 * 2.6 * Math.PI * 2 - 0.05; const r0 = R * (1 - t0 * 0.88) - 10 * (1 - t0), r1 = R * (1 - t1 * 0.88) - 10 * (1 - t1);
        ctx.strokeStyle = css(lighten(tono(lo + (hi - lo) * t0), 0.4), 0.5); ctx.lineWidth = 4 * (1 - t0 * 0.6);
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a0) * r0, cy + Math.sin(a0) * r0 * 0.9); ctx.lineTo(x + Math.cos(a1) * r1, cy + Math.sin(a1) * r1 * 0.9); ctx.stroke();
      }
      ctx.restore();
    });
    const f = ridgeFn(W, rnd, 34, 4, 2); const base = H - OVER - 170;
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 40, A.far, H, A.light.c, 0.5, 2.5, A.fog, 0.4);
    hazeOver(ctx, W, H, A.fog, 0, H - OVER, 0.18); grainOver(ctx, W, H, rnd);
  },
  midFar: (ctx, W, H, rnd, A) => {
    const [lo, hi] = A.tono ?? [0, 1];
    const base = H - OVER - 130; const f = ridgeFn(W, rnd, 26, 4, 3);
    for (let i = 0; i < 26; i++) { const x = rnd() * W, y = base + f(x) + 8; wrapX(W, x, 40, (xx) => hairCell(ctx, xx, y, 50 + rnd() * 60, mix(A.midFar, A.fog, 0.15), tono(lo + (hi - lo) * (xx / W)), 0.55)); }
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 40, A.midFar, H, A.light.c, 0.45, 2.5, A.fog, 0.3);
    hazeOver(ctx, W, H, A.fog, base - 200, H - OVER, 0.25); grainOver(ctx, W, H, rnd);
  },
  mid: (ctx, W, H, rnd, A) => {
    const [lo, hi] = A.tono ?? [0, 1];
    const base = H - OVER - 90; const f = ridgeFn(W, rnd, 20, 3, 4);
    for (let i = 0; i < 16; i++) { const x = (i + rnd() * 0.7) * (W / 16), y = base + f(x) + 8; wrapX(W, x, 50, (xx) => hairCell(ctx, xx, y, 90 + rnd() * 110, A.mid, tono(lo + (hi - lo) * ((i * 0.37 + rnd() * 0.3) % 1)), 1)); }
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 30, A.mid, H, A.accent, 0.45, 2.5);
    // denizanası gibi süzülen hücreler
    for (let i = 0; i < 7; i++) { const x = rnd() * W, y = base - 140 - rnd() * 220, r = 8 + rnd() * 12; const c = tono(lo + (hi - lo) * rnd()); glow(ctx, x, y, r * 2.5, c, 0.3); ctx.strokeStyle = css(lighten(c, 0.4), 0.6); ctx.lineWidth = 1.5; circle(ctx, x, y, r); ctx.stroke(); ctx.fillStyle = css(0xffffff, 0.5); circle(ctx, x - r * 0.35, y - r * 0.35, r * 0.25); ctx.fill(); }
    grainOver(ctx, W, H, rnd);
  },
  near: (ctx, W, H, rnd, A) => {
    const [lo, hi] = A.tono ?? [0, 1];
    const base = H - OVER - 60; const f = ridgeFn(W, rnd, 22, 4, 4);
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 30, A.near, H, A.accent, 0.4, 2);
    for (let i = 0; i < 14; i++) { const x = rnd() * W; wrapX(W, x, 40, (xx) => hairCell(ctx, xx, base + f(xx) + 6, 40 + rnd() * 50, darken(A.near, 0.1), tono(lo + (hi - lo) * rnd()), 0.9)); }
  },
  fg: (ctx, W, H, rnd, A) => {
    const base = H - OVER;
    for (let i = 0; i < 5; i++) { const cx = rnd() * W; wrapX(W, cx, 170, (x) => blurShape(ctx, () => { ctx.beginPath(); ctx.ellipse(x, base + 36, 120 + rnd() * 80, 60 + rnd() * 30, 0, 0, Math.PI * 2); }, A.fg, 0.95, 12)); }
    blurred(ctx, 3, (c) => { for (let i = 0; i < 6; i++) { const x = rnd() * W; wrapX(W, x, 100, (xx) => taperHair(c, xx, H, 140 + rnd() * 120, -Math.PI / 2 + (rnd() - 0.5) * 0.6, (rnd() - 0.5) * 1.6, 12, A.fg, 0.95)); } });
  },
};
/** tüylü hücre demeti: V biçimli sıra sıra çubuklar, uçta tonotopi renginde ışık */
function hairCell(ctx: Ctx, x: number, y: number, h: number, c: number, tip: number, a: number) {
  const n = 5;
  ctx.fillStyle = css(c, a); ctx.beginPath(); ctx.ellipse(x, y, h * 0.16, h * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < n; i++) {
    const t = (i - (n - 1) / 2) / ((n - 1) / 2); const hh = h * (0.55 + 0.45 * (1 - Math.abs(t))); const ang = -Math.PI / 2 + t * 0.35;
    taperHair(ctx, x + t * h * 0.08, y, hh, ang, t * 0.15, Math.max(2, h * 0.05), c, a, tip);
  }
}

// ---------------------------------------------------------------- NERVE · İşitme Siniri (ışık lifleri, miyelin)
const nerve: Record<string, Painter> = {
  far: (ctx, W, H, rnd, A) => {
    // yatay lif demetleri (ışıklı kablolar)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const y0 = H - OVER - 120 - rnd() * 420; const amp = 20 + rnd() * 50; const k = 1 + Math.floor(rnd() * 3); const ph = rnd() * 6; const c = [0x4cf0ff, 0x6a8bff, 0x8b6bff][i % 3]!;
      for (const [lw, a] of [[22, 0.04], [9, 0.08], [3, 0.35], [1.2, 0.8]] as [number, number][]) {
        ctx.strokeStyle = css(c, a); ctx.lineWidth = lw; ctx.beginPath();
        for (let x = 0; x <= W; x += 6) { const y = y0 + Math.sin((x / W) * Math.PI * 2 * k + ph) * amp; if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
      }
    }
    ctx.restore();
    const f = ridgeFn(W, rnd, 30, 4, 2); const base = H - OVER - 160;
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 40, A.far, H, A.light.c, 0.5, 2, A.fog, 0.35);
    grainOver(ctx, W, H, rnd);
  },
  midFar: (ctx, W, H, rnd, A) => {
    // miyelinli akson kabloları: segmentli tüpler + Ranvier düğümleri
    for (let i = 0; i < 3; i++) {
      const y0 = H - OVER - 160 - i * 120 - rnd() * 40; const k = 1 + i; const ph = rnd() * 6; const amp = 30 + rnd() * 30;
      const yAt = (x: number) => y0 + Math.sin((x / W) * Math.PI * 2 * k + ph) * amp;
      axon(ctx, W, yAt, 9 - i * 2, mix(A.midFar, A.fog, 0.2), A.accent, 60 + i * 10);
    }
    const f = ridgeFn(W, rnd, 24, 4, 3); const base = H - OVER - 120;
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 40, A.midFar, H, A.accent, 0.4, 2, A.fog, 0.25);
    grainOver(ctx, W, H, rnd);
  },
  mid: (ctx, W, H, rnd, A) => {
    const base = H - OVER - 90; const f = ridgeFn(W, rnd, 18, 3, 4);
    for (let i = 0; i < 2; i++) { const y0 = base - 120 - i * 150; const ph = rnd() * 6; axon(ctx, W, (x) => y0 + Math.sin((x / W) * Math.PI * 2 * (2 + i) + ph) * 40, 11, A.mid, A.accent, 70); }
    // nöron gövdeleri (dalcıklı yıldızlar)
    for (let i = 0; i < 5; i++) { const x = rnd() * W, y = base + f(x) - 10; wrapX(W, x, 80, (xx) => neuron(ctx, xx, y, 16 + rnd() * 10, A.mid, A.accent, rnd)); }
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 30, A.mid, H, A.accent, 0.45, 2.5);
    grainOver(ctx, W, H, rnd);
  },
  near: (ctx, W, H, rnd, A) => {
    const base = H - OVER - 60; const f = ridgeFn(W, rnd, 20, 4, 4);
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 30, A.near, H, A.accent, 0.5, 2);
    for (let i = 0; i < 20; i++) { const x = rnd() * W, y = base + f(x) + 14 + rnd() * 60; glow(ctx, x, y, 3 + rnd() * 4, A.accent, 0.6); }
    for (let i = 0; i < 16; i++) { const x = rnd() * W; taperHair(ctx, x, base + f(x) + 3, 20 + rnd() * 30, -Math.PI / 2 + (rnd() - 0.5) * 1.4, (rnd() - 0.5) * 2, 2.4, darken(A.near, 0.1), 1, rnd() < 0.5 ? A.accent : undefined); }
  },
  fg: (ctx, W, H, rnd, A) => {
    const base = H - OVER;
    for (let i = 0; i < 5; i++) { const cx = rnd() * W; wrapX(W, cx, 170, (x) => blurShape(ctx, () => { ctx.beginPath(); ctx.ellipse(x, base + 36, 120 + rnd() * 80, 60 + rnd() * 30, 0, 0, Math.PI * 2); }, A.fg, 0.95, 12)); }
    blurred(ctx, 4, (c) => axon(c, W, (x) => base - 40 + Math.sin((x / W) * Math.PI * 4) * 30, 26, A.fg, A.accent, 120));
  },
};
/** akson: W boyunca segmentli miyelin tüpü; düğümlerde parıltı */
function axon(ctx: Ctx, W: number, yAt: (x: number) => number, r: number, c: number, glowC: number, seg: number) {
  ctx.save(); ctx.lineCap = 'round';
  // akson çekirdeği: ince ışıklı lif
  ctx.strokeStyle = css(glowC, 0.35); ctx.lineWidth = Math.max(1.5, r * 0.25); ctx.beginPath(); for (let x = 0; x <= W; x += 4) { const y = yAt(x); if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
  for (let x0 = 0; x0 < W; x0 += seg) {
    const x1 = Math.min(W + 2, x0 + seg - 10);
    const line = () => { ctx.beginPath(); for (let x = x0 + 5; x <= x1; x += 4) { const y = yAt(x); if (x === x0 + 5) ctx.moveTo(x, y); else ctx.lineTo(x, y); } };
    // miyelin kını: yarı saydam, kenarı ışıklı tüp
    line(); ctx.strokeStyle = css(mix(c, glowC, 0.25), 0.75); ctx.lineWidth = r * 2; ctx.stroke();
    line(); ctx.strokeStyle = css(mix(c, glowC, 0.55), 0.35); ctx.lineWidth = r * 1.2; ctx.stroke();
    ctx.save(); ctx.translate(0, -r * 0.5); line(); ctx.strokeStyle = css(lighten(c, 0.5), 0.45); ctx.lineWidth = r * 0.35; ctx.stroke(); ctx.restore();
    const nx = x0 + seg - 5; glow(ctx, nx, yAt(nx), r * 2.4, glowC, 0.6); ctx.fillStyle = css(lighten(glowC, 0.6)); circle(ctx, nx, yAt(nx), r * 0.32); ctx.fill();
  }
  ctx.restore();
}
function neuron(ctx: Ctx, x: number, y: number, r: number, c: number, g: number, rnd: Rnd) {
  for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6; taperHair(ctx, x, y, r * (2.5 + rnd() * 2), a, (rnd() - 0.5) * 1.5, r * 0.35, c, 1, rnd() < 0.5 ? g : undefined); }
  glow(ctx, x, y, r * 2.4, g, 0.4);
  const gg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r); gg.addColorStop(0, css(lighten(g, 0.5))); gg.addColorStop(1, css(mix(c, g, 0.4)));
  ctx.fillStyle = gg; circle(ctx, x, y, r); ctx.fill();
}

// ---------------------------------------------------------------- STEM · Beyin Sapı (kesişen yollar, köprüler, çekirdekler)
const stem: Record<string, Painter> = {
  far: (ctx, W, H, rnd, A) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 7; k++) {
      const y0 = H - OVER - 160 - rnd() * 380; const c = k % 2 ? A.accent : A.accent2; const span = 260 + rnd() * 200; const x0 = rnd() * W;
      for (const s of [1, -1]) {
        for (const [lw, a] of [[10, 0.05], [3, 0.2], [1.2, 0.6]] as [number, number][]) {
          ctx.strokeStyle = css(c, a); ctx.lineWidth = lw; ctx.setLineDash(lw < 2 ? [6, 6] : []);
          wrapX(W, x0, span, (x) => { ctx.beginPath(); ctx.moveTo(x - span, y0 - s * 60); ctx.bezierCurveTo(x - span * 0.3, y0 - s * 60, x + span * 0.3, y0 + s * 60, x + span, y0 + s * 60); ctx.stroke(); });
        }
      }
    }
    ctx.setLineDash([]); ctx.restore();
    for (let i = 0; i < 3; i++) { const x = rnd() * W, y = H - OVER - 260 - rnd() * 200; wrapX(W, x, 80, (xx) => { glow(ctx, xx, y, 70, A.accent, 0.25); glow(ctx, xx, y, 26, lighten(A.accent, 0.5), 0.5); }); }
    const f = ridgeFn(W, rnd, 30, 4, 2); const base = H - OVER - 160;
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 40, A.far, H, A.light.c, 0.5, 2, A.fog, 0.35);
    grainOver(ctx, W, H, rnd);
  },
  midFar: (ctx, W, H, rnd, A) => {
    // köprü kemerleri (pons): ışık noktalı
    const base = H - OVER - 120;
    for (let i = 0; i < 3; i++) {
      const x = (i + 0.5) * (W / 3) + (rnd() - 0.5) * 60, span = 300 + rnd() * 60, top = base - 140 - rnd() * 60;
      wrapX(W, x, span / 2 + 20, (xx) => {
        const p = () => { ctx.beginPath(); ctx.moveTo(xx - span / 2, base + 30); ctx.quadraticCurveTo(xx, top - 60, xx + span / 2, base + 30); ctx.lineTo(xx + span / 2 - 22, base + 30); ctx.quadraticCurveTo(xx, top - 18, xx - span / 2 + 22, base + 30); ctx.closePath(); };
        silhouette(ctx, p, top, mix(A.midFar, A.fog, 0.15), base + 30, A.accent, 0.5, 2.5);
        for (let k = 1; k < 12; k++) { const t = k / 12; const px = (1 - t) * (1 - t) * (xx - span / 2) + 2 * t * (1 - t) * xx + t * t * (xx + span / 2); const py = (1 - t) * (1 - t) * (base + 30) + 2 * t * (1 - t) * (top - 60) + t * t * (base + 30); glow(ctx, px, py - 2, 6, k % 2 ? A.accent : A.accent2, 0.7); }
      });
    }
    const f = ridgeFn(W, rnd, 22, 4, 3);
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 40, A.midFar, H, A.accent, 0.4, 2, A.fog, 0.25);
    grainOver(ctx, W, H, rnd);
  },
  mid: (ctx, W, H, rnd, A) => {
    const base = H - OVER - 90; const f = ridgeFn(W, rnd, 16, 3, 4);
    // çekirdek sütunları: içinde ışık küreleri
    for (let i = 0; i < 6; i++) {
      const x = (i + rnd() * 0.6) * (W / 6), h = 110 + rnd() * 130, w = 30 + rnd() * 20;
      wrapX(W, x, w, (xx) => {
        const p = () => { ctx.beginPath(); ctx.moveTo(xx - w / 2, base + 20); ctx.lineTo(xx - w / 2 + 6, base - h + 14); ctx.quadraticCurveTo(xx, base - h - 14, xx + w / 2 - 6, base - h + 14); ctx.lineTo(xx + w / 2, base + 20); ctx.closePath(); };
        silhouette(ctx, p, base - h, A.mid, base, A.accent2, 0.45, 2.5);
        const c = rnd() < 0.5 ? A.accent : A.accent2; glow(ctx, xx, base - h + 6, 26, c, 0.55); ctx.fillStyle = css(lighten(c, 0.6)); circle(ctx, xx, base - h + 6, 5); ctx.fill();
      });
    }
    silhouette(ctx, () => ridgePath(ctx, W, H, base + 10, f), base, A.mid, H, A.accent, 0.4, 2);
    grainOver(ctx, W, H, rnd);
  },
  near: (ctx, W, H, rnd, A) => {
    const base = H - OVER - 60; const f = ridgeFn(W, rnd, 22, 4, 4);
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 30, A.near, H, A.accent, 0.45, 2);
    for (let i = 0; i < 14; i++) { const x = rnd() * W, y = base + f(x) + 16 + rnd() * 50; glow(ctx, x, y, 4 + rnd() * 3, i % 2 ? A.accent : A.accent2, 0.6); }
  },
  fg: (ctx, W, H, rnd, A) => {
    const base = H - OVER;
    for (let i = 0; i < 6; i++) { const cx = rnd() * W; wrapX(W, cx, 170, (x) => blurShape(ctx, () => { ctx.beginPath(); ctx.ellipse(x, base + 36, 120 + rnd() * 80, 60 + rnd() * 30, 0, 0, Math.PI * 2); }, A.fg, 0.95, 12)); }
  },
};

// ---------------------------------------------------------------- CORTEX · İşitme Korteksi (girus tepeleri, nöron ağaçları, aurora)
const cortex: Record<string, Painter> = {
  far: (ctx, W, H, rnd, A) => {
    // girus kıvrımları: kabarık beyin bulut-tepeleri, sulkus çizgileri
    const base = H - OVER - 200;
    for (let i = 0; i < 9; i++) {
      const x = rnd() * W, y = base + 30 - rnd() * 120, r = 70 + rnd() * 60;
      wrapX(W, x, r * 1.4, (xx) => gyrus(ctx, xx, y, r, mix(A.far, A.sky[1], 0.2), A.light.c, rnd));
    }
    const f = ridgeFn(W, rnd, 30, 4, 2);
    silhouette(ctx, () => ridgePath(ctx, W, H, base + 40, f), base, A.far, H, A.light.c, 0.5, 2.5, A.fog, 0.4);
    hazeOver(ctx, W, H, A.fog, base - 200, H - OVER, 0.3); grainOver(ctx, W, H, rnd);
  },
  midFar: (ctx, W, H, rnd, A) => {
    const base = H - OVER - 130;
    for (let i = 0; i < 8; i++) { const x = rnd() * W, y = base + 20 - rnd() * 60, r = 50 + rnd() * 40; wrapX(W, x, r * 1.4, (xx) => gyrus(ctx, xx, y, r, A.midFar, A.light.c, rnd)); }
    const f = ridgeFn(W, rnd, 20, 4, 3);
    silhouette(ctx, () => ridgePath(ctx, W, H, base + 20, f), base, A.midFar, H, A.light.c, 0.4, 2, A.fog, 0.25);
    hazeOver(ctx, W, H, A.fog, base - 150, H - OVER, 0.22); grainOver(ctx, W, H, rnd);
  },
  mid: (ctx, W, H, rnd, A) => {
    const base = H - OVER - 90; const f = ridgeFn(W, rnd, 18, 3, 4);
    for (let i = 0; i < 6; i++) { const x = (i + 0.2 + rnd() * 0.6) * (W / 6), y = base + f(x) + 10; wrapX(W, x, 120, (xx) => dendriteTree(ctx, xx, y, 150 + rnd() * 110, A.mid, i % 2 ? A.accent : A.accent2, rnd)); }
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 30, A.mid, H, A.accent, 0.45, 2.5);
    grainOver(ctx, W, H, rnd);
  },
  near: (ctx, W, H, rnd, A) => {
    const base = H - OVER - 60; const f = ridgeFn(W, rnd, 22, 4, 4);
    silhouette(ctx, () => ridgePath(ctx, W, H, base, f), base - 30, A.near, H, A.accent2, 0.45, 2.5);
    for (let i = 0; i < 16; i++) { const x = rnd() * W, y = base + f(x) + 16 + rnd() * 50; sparkle(ctx, x, y, 2 + rnd() * 2.5, A.motes[i % 3]!, 0.8); }
  },
  fg: (ctx, W, H, rnd, A) => {
    const base = H - OVER;
    for (let i = 0; i < 6; i++) { const cx = rnd() * W; wrapX(W, cx, 170, (x) => blurShape(ctx, () => { ctx.beginPath(); ctx.ellipse(x, base + 36, 120 + rnd() * 80, 60 + rnd() * 30, 0, 0, Math.PI * 2); }, A.fg, 0.95, 12)); }
    blurred(ctx, 4, (c) => { for (let i = 0; i < 2; i++) { const x = rnd() * W; wrapX(W, x, 160, (xx) => dendriteTree(c, xx, H - OVER + 20, 200, A.fg, A.fg, rnd)); } });
  },
};
function gyrus(ctx: Ctx, x: number, y: number, r: number, c: number, light: number, rnd: Rnd) {
  const lobes: [number, number, number][] = []; for (let i = 0; i < 4; i++) lobes.push([x + (i - 1.5) * r * 0.55, y - Math.sin((i + 0.5) / 4 * Math.PI) * r * 0.35, r * (0.45 + rnd() * 0.15)]);
  const p = () => { ctx.beginPath(); for (const [lx, ly, lr] of lobes) { ctx.moveTo(lx + lr, ly); ctx.arc(lx, ly, lr, 0, Math.PI * 2); } ctx.rect(x - r * 1.1, y - 4, r * 2.2, r); };
  silhouette(ctx, p, y - r, c, y + r, light, 0.55, 3);
  ctx.save(); p(); ctx.clip(); ctx.strokeStyle = css(darken(c, 0.35), 0.5); ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  for (const [lx, ly, lr] of lobes) { ctx.beginPath(); ctx.arc(lx + lr * 0.1, ly + lr * 0.25, lr * 0.55, Math.PI * 1.1, Math.PI * 1.85); ctx.stroke(); }
  ctx.restore();
}
function dendriteTree(ctx: Ctx, x: number, y: number, h: number, c: number, g: number, rnd: Rnd) {
  const branch = (bx: number, by: number, len: number, ang: number, w: number, depth: number) => {
    const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
    ctx.strokeStyle = css(c); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + Math.cos(ang + 0.3) * len * 0.5, by + Math.sin(ang + 0.3) * len * 0.5, ex, ey); ctx.stroke();
    if (depth <= 0) { if (rnd() < 0.6) { glow(ctx, ex, ey, 7, g, 0.6); ctx.fillStyle = css(lighten(g, 0.6)); circle(ctx, ex, ey, 1.6); ctx.fill(); } return; }
    const n = 2 + (rnd() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) branch(ex, ey, len * (0.62 + rnd() * 0.15), ang + (i - (n - 1) / 2) * (0.5 + rnd() * 0.3), w * 0.62, depth - 1);
  };
  branch(x, y, h * 0.42, -Math.PI / 2 + (rnd() - 0.5) * 0.2, 10, 4);
  glow(ctx, x, y - h * 0.42, 22, g, 0.35);
}

const PAINTERS: Record<string, Record<string, Painter>> = { auricle, tunnel, drum, bones, spiral, nerve, stem, cortex };

// ---------------------------------------------------------------- ışık huzmesi / sis / parçacık dokuları (paylaşılan)
function shaftsTex(scene: Phaser.Scene, A: BiomeArt): string {
  return canvasTex(scene, `bd-shafts-${A.id}`, 512, 700, 1, (ctx, W, H) => {
    const r = rng(hashStr(A.id) ^ 77); const sk = A.underwater ? 0.12 : 0.42; const a0 = A.underwater ? 0.2 : 0.11;
    for (let i = 0; i < 7; i++) {
      const x = r() * W, w = 24 + r() * 80, a = a0 * (0.5 + r() * 0.7);
      for (const dx of [-W, 0, W]) {
        ctx.save(); ctx.translate(x + dx, 0); ctx.transform(1, 0, sk, 1, 0, 0);
        const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, css(A.light.c, 0)); g.addColorStop(0.5, css(lighten(A.light.c, 0.2), a)); g.addColorStop(1, css(A.light.c, 0));
        ctx.fillStyle = g; ctx.fillRect(-w / 2, 0, w, H); ctx.restore();
      }
    }
    ctx.save(); ctx.globalCompositeOperation = 'destination-in';
    const v = ctx.createLinearGradient(0, 0, 0, H); v.addColorStop(0, 'rgba(0,0,0,0.2)'); v.addColorStop(0.15, 'rgba(0,0,0,1)'); v.addColorStop(0.6, 'rgba(0,0,0,0.5)'); v.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H); ctx.restore();
  });
}
function fogTex(scene: Phaser.Scene, A: BiomeArt): string {
  return canvasTex(scene, `bd-fog-${A.id}`, 512, 160, 1, (ctx, W, H) => {
    const r = rng(hashStr(A.id) ^ 91);
    for (let i = 0; i < 26; i++) { const x = r() * W, y = H * 0.45 + r() * H * 0.4, rx = 50 + r() * 80; for (const dx of [-W, 0, W]) glowEllipse(ctx, x + dx, y, rx, rx * 0.35, A.fog, 0.22); }
  });
}
export function moteTex(scene: Phaser.Scene, c: number, key = `bd-mote-${c.toString(16)}`): string {
  return canvasTex(scene, key, 24, 24, 1, (ctx) => { glow(ctx, 12, 12, 12, c, 0.9); glow(ctx, 12, 12, 3.5, 0xffffff, 1); });
}
function bubbleTex(scene: Phaser.Scene): string {
  return canvasTex(scene, 'bd-bubble', 24, 24, 2, (ctx) => { ctx.strokeStyle = 'rgba(220,240,255,0.75)'; ctx.lineWidth = 1.4; circle(ctx, 12, 12, 9); ctx.stroke(); ctx.fillStyle = 'rgba(200,230,255,0.12)'; ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(8.5, 8.5, 2.6, 1.6, -0.7, 0, Math.PI * 2); ctx.fill(); });
}

// ---------------------------------------------------------------- arka plan
/**
 * Biyom arka planını kurar. worldW: dünya genişliği (bilgi); worldH: kameranın en alt konumundaki görünümün alt kenarı (dünya y) —
 * katmanlar bu konumda ekranın altına hizalanır, kamera yükseldikçe paralaksla aşağı kayar. Kare başına `update(cam.scrollX, cam.scrollY)`.
 * opts.quality 'low': ışık huzmesi, sis bandı ve parçacıklar kapalı, doku ölçeği 1 (zayıf cihazlar için).
 */
export function paintBiome(scene: Phaser.Scene, biomeId: string, worldW: number, worldH: number, opts: { quality?: 'high' | 'low' } = {}): BiomeBackdrop {
  const A = artOf(biomeId); const set = PAINTERS[A.motif]!; const low = opts.quality === 'low';
  const R = low ? 1 : renderResolution(); const cam = scene.cameras.main;
  let vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
  const seed = hashStr(A.id);
  const objects: Phaser.GameObjects.GameObject[] = [];
  cam.setBackgroundColor(A.sky[0]);

  // gök: tasarım boyutunda bir kez (görünüme gerilir)
  const skyKey = canvasTex(scene, `bd-sky-${A.id}`, 390, 844, 1, (ctx, W, H) => paintSky(ctx, W, H, rng(seed ^ 1), A));
  const sky = scene.add.image(0, 0, skyKey).setOrigin(0, 0).setScrollFactor(0).setDepth(-100);
  objects.push(sky);

  const tall = A.motif === 'tunnel' ? 1100 : 0;
  const defs: LayerDef[] = [
    { name: 'far', f: 0.07, h: tall || 860, R: 1, paint: set.far!, depth: -90 },
    { name: 'midFar', f: 0.18, h: tall || 700, R: 1, paint: set.midFar!, depth: -80 },
    { name: 'mid', f: 0.36, h: tall || 620, R: Math.min(R, 1.5), paint: set.mid!, depth: -70 },
    { name: 'near', f: 0.62, h: 460, R: Math.min(R, 1.5), paint: set.near!, depth: -60 },
  ];
  const fgDefs: LayerDef[] = [{ name: 'fg', f: 1.25, h: 340, R: 1, paint: set.fg!, depth: 60 }];
  if (set.fgTop) fgDefs.push({ name: 'fgTop', f: 1.15, h: 260, R: 1, paint: set.fgTop, depth: 60 });

  interface L { def: LayerDef; ts: Phaser.GameObjects.TileSprite; top: boolean }
  const layers: L[] = [];
  const mk = (def: LayerDef) => {
    const key = canvasTex(scene, `bd-${A.id}-${def.name}-${def.R}`, TW, def.h, def.R, (ctx, W, H) => {
      def.paint(ctx, W, H, rng(seed ^ hashStr(def.name)), A);
      // üst kenar yumuşak sönüm + alt kenarda iki boş satır: döşeme sarmasında çizgi oluşmaz
      ctx.save(); ctx.globalCompositeOperation = 'destination-in';
      const g = ctx.createLinearGradient(0, 0, 0, 70); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.restore(); ctx.clearRect(0, H - 2, W, 2);
    });
    const ts = scene.add.tileSprite(0, 0, Math.ceil(vw * def.R) + 4, Math.round(def.h * def.R), key).setOrigin(0, 0).setScrollFactor(0).setDepth(def.depth).setScale(1 / def.R);
    layers.push({ def, ts, top: def.name === 'fgTop' }); objects.push(ts);
  };
  defs.forEach(mk);

  // ışık huzmeleri (toplamsal), sis bandı
  const shafts = scene.add.tileSprite(0, 0, vw, 700, shaftsTex(scene, A)).setOrigin(0, 0).setScrollFactor(0).setDepth(-65).setBlendMode(Phaser.BlendModes.ADD).setAlpha(1).setVisible(!low);
  const fog = scene.add.tileSprite(0, 0, vw, 160, fogTex(scene, A)).setOrigin(0, 1).setScrollFactor(0).setDepth(-55).setAlpha(0.55).setVisible(!low);
  objects.push(shafts, fog);
  fgDefs.forEach(mk);

  // sürüklenen parçacıklar (ekran uzayında; ucuz)
  const moteKeys = A.motes.map((c) => moteTex(scene, c));
  const motes: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  const mkMotes = () => {
    const O0 = screenOrigin(cam);
    for (const m of motes) m.destroy(); motes.length = 0;
    if (low) return;
    const e = scene.add.particles(0, 0, moteKeys[0]!, {
      x: { min: O0.x, max: O0.x + vw }, y: { min: O0.y, max: O0.y + vh }, lifespan: { min: 5000, max: 9000 }, speedX: { min: -14, max: 6 }, speedY: A.underwater ? { min: -26, max: -10 } : { min: -10, max: 6 },
      scale: { min: 0.12, max: 0.42 }, alpha: { onEmit: () => 0, onUpdate: (_p: unknown, _k: string, t: number) => Math.sin(t * Math.PI) * 0.85 }, frequency: 260, quantity: 1, blendMode: 'ADD', maxAliveParticles: 34,
    }).setScrollFactor(0).setDepth(55);
    motes.push(e);
    if (A.underwater) {
      const b = scene.add.particles(0, 0, bubbleTex(scene), {
        x: { min: O0.x, max: O0.x + vw }, y: O0.y + vh + 10, lifespan: 7000, speedY: { min: -70, max: -30 }, speedX: { min: -6, max: 6 }, scale: { min: 0.25, max: 0.7 }, alpha: { start: 0.8, end: 0 }, frequency: 420, maxAliveParticles: 18,
      }).setScrollFactor(0).setDepth(56);
      motes.push(b);
    }
    // ilk karede boş görünmesin
    for (const m of motes) m.fastForward(6000);
  };
  mkMotes();

  let camY0 = worldH - vh;
  const t0 = scene.time.now;
  let O = screenOrigin(cam);
  const layout = () => {
    O = screenOrigin(cam);
    sky.setDisplaySize(vw, vh).setPosition(O.x, O.y);
    for (const l of layers) l.ts.setSize(Math.ceil(vw * l.def.R) + 4, Math.round(l.def.h * l.def.R));
    shafts.setSize(vw, 700); fog.setSize(vw, 160);
    camY0 = worldH - vh;
  };
  layout();
  let fgA = 1;
  const api: BiomeBackdrop = {
    objects,
    update(scrollX, scrollY) {
      const v = viewTopLeft(cam, scrollX, scrollY); const camX = v.x;
      const dy = camY0 - v.y; // + : kamera yukarıda
      for (const l of layers) {
        const f = l.def.f;
        l.ts.x = O.x;
        l.ts.tilePositionX = (camX * f * l.def.R) % (TW * l.def.R);
        if (l.top) l.ts.y = O.y - 20 + Math.max(-l.def.h, dy * f * 0.6);
        else l.ts.y = O.y + vh + OVER - l.def.h + dy * f;
      }
      if (low) return;
      shafts.x = O.x; shafts.tilePositionX = camX * 0.25 % 512; shafts.y = O.y + Math.min(0, dy * 0.2 - 40);
      fog.x = O.x; fog.tilePositionX = (camX * 0.8 + (scene.time.now - t0) * 0.012) % 512; fog.y = O.y + vh + 40 + dy * 0.85;
      const tt = (scene.time.now - t0) / 1000; shafts.setAlpha(0.8 + Math.sin(tt * 0.6) * 0.14 + Math.sin(tt * 1.7) * 0.06);
    },
    resize(w, h) { vw = w; vh = h; layout(); mkMotes(); },
    setForegroundAlpha(a) { fgA = a; for (const l of layers) if (l.def.depth > 0) l.ts.setAlpha(fgA); },
    destroy() { for (const o of objects) o.destroy(); for (const m of motes) m.destroy(); },
  };
  void worldW;
  api.update(cam.scrollX, cam.scrollY);
  return api;
}
