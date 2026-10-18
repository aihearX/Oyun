/**
 * Kulak Kampı binaları: her bina kendi mimari kimliğiyle, 5 görsel kademede (ahşap → taş → tuğla+bayrak → metal+ışık → altın süs).
 * Saf Canvas 2D; çizim orijini arsa merkezi (zemin), birim dünya birimi. Arkadan öne doğru boyanır.
 */
import type { BuildingId } from '@odi/shared';
import {
  P, box, coinPile, cone, crate, css, cyl, dome, doorOn, earGlyph, ellipseShadow, flag, gable, gear, groundShadow, hip, lantern, mix, poly3, rng, sack, shade, sparkle,
  windowOn, type Ctx, type FaceRef, type Mat, type Pattern, type RoofPat,
} from './paint';
import { tierOf } from './layout';

/** efekt bağlantı noktaları (arsa merkezine göre, ekran birimi) */
export interface Anchors {
  smoke: [number, number][];
  lights: [number, number, number][];
  gears: [number, number, number][];
  wave?: [number, number];
  heart?: [number, number];
  /** takım bayrağı direğinin dibi */
  flag?: [number, number];
  coins?: [number, number];
  sparkles: [number, number][];
}
const newAnchors = (): Anchors => ({ smoke: [], lights: [], gears: [], sparkles: [] });

interface TierMat { wall: Mat; base: Mat; roof: number; roofPat: RoofPat; trim: number; glow: number; frame: number; flag: number }
const TM: TierMat[] = [
  { wall: { color: 0xc98e55, pattern: 'plank' }, base: { color: 0x9a8a74, pattern: 'stone' }, roof: 0xdcb45c, roofPat: 'thatch', trim: 0x6b3f22, glow: 0xffb84a, frame: 0x4a2a14, flag: 0xff5c8a },
  { wall: { color: 0xcfc4ad, pattern: 'stone' }, base: { color: 0x8f8778, pattern: 'stone' }, roof: 0xc65a38, roofPat: 'tile', trim: 0x6b3f22, glow: 0xffbf4d, frame: 0x50301a, flag: 0xff5c8a },
  { wall: { color: 0xc2603c, pattern: 'brick' }, base: { color: 0xbfb4a0, pattern: 'stone' }, roof: 0x4a6194, roofPat: 'slate', trim: 0xefe3cc, glow: 0xffc65a, frame: 0x3b2a2a, flag: 0xffc93c },
  { wall: { color: 0x93a8be, pattern: 'metal' }, base: { color: 0x5d6d82, pattern: 'metal' }, roof: 0x2d4a6e, roofPat: 'metal', trim: 0x26364b, glow: 0x7df3ff, frame: 0x1f2a3a, flag: 0x2ee6d6 },
  { wall: { color: 0xf6efe4, pattern: 'marble' }, base: { color: 0xe2d8c6, pattern: 'marble' }, roof: 0x7651f0, roofPat: 'tile', trim: 0xf5c542, glow: 0xffd66b, frame: 0xb8860b, flag: 0x8b6bff },
];
export const TIER_ACCENT = [0xb07a45, 0x9d9a92, 0xc2603c, 0x5fb6d6, 0xf5c542];

/** bina kimlik renkleri */
const ID_COLOR: Record<BuildingId, number> = { merkez: 0xff5c8a, laboratuvar: 0x2ee6d6, atolye: 0xff9f1c, depo: 0xffc93c, kule: 0x8b6bff, revir: 0x3ccf7e };

type Kit = ReturnType<typeof kit>;
function kit(ctx: Ctx, t: number, seed: number) {
  const m = TM[t]!; const r = rng(seed);
  const win = (f: FaceRef, xs: number[], y: number, w: number, h: number, o: Parameters<typeof windowOn>[6] = {}) => { for (const x of xs) windowOn(ctx, f, x, y, w, h, { frame: m.frame, glow: m.glow, arch: t === 2 || t === 4, sill: t >= 1, ...o }); };
  /** yüz boyunca eşit aralıklı pencere x'leri */
  const spread = (len: number, n: number, w: number, skip?: [number, number]) => { const out: number[] = []; for (let i = 0; i < n; i++) { const x = ((i + 1) / (n + 1)) * len - w / 2; if (skip && x + w > skip[0] && x < skip[1]) continue; out.push(x); } return out; };
  /** altın / taş süs bandı (yüz uzayında y yüksekliğinde) */
  const band = (f: FaceRef, y: number, hh: number, color: number) => bandOn(ctx, f, y, hh, color);
  const plinth = (u0: number, v0: number, w: number, d: number, h: number) => box(ctx, u0, v0, 0, w, d, h, { ...m.base, seed: seed + 1 });
  const house = (u0: number, v0: number, z0: number, w: number, d: number, h: number, wall: Mat = m.wall) => box(ctx, u0, v0, z0, w, d, h, { ...wall, seed: seed + 2 }, { top: null });
  const tower = (cu: number, cv: number, z0: number, R: number, h: number, roof: 'cone' | 'flat' | 'crenel' | 'dome', o: { pat?: Pattern; color?: number; roofColor?: number; roofH?: number } = {}) => {
    const col = o.color ?? m.wall.color;
    cyl(ctx, cu, cv, z0, R, h, col, o.pat ?? m.wall.pattern, { top: roof === 'cone' ? null : undefined, seed: seed + 5 });
    const [x, y] = P(cu, cv, z0 + h);
    if (roof === 'cone') return cone(ctx, cu, cv, z0 + h - 1, R + 3, o.roofH ?? R * 1.9, o.roofColor ?? m.roof, t === 0 ? shade(o.roofColor ?? m.roof, -0.12) : undefined);
    if (roof === 'crenel') { for (let i = 0; i < 7; i++) { const a = Math.PI * (i / 6); const cx = x - Math.cos(a) * R * 0.86; const cy = y + Math.sin(a) * R * 0.43; ctx.fillStyle = css(shade(col, i % 2 ? -0.1 : 0.05)); ctx.fillRect(cx - 2.2, cy - 5, 4.4, 5); ctx.strokeStyle = 'rgba(38,20,44,0.5)'; ctx.lineWidth = 0.5; ctx.strokeRect(cx - 2.2, cy - 5, 4.4, 5); } return [x, y - 5] as const; }
    if (roof === 'dome') return dome(ctx, cu, cv, z0 + h, R, o.roofColor ?? m.roof, { ribs: 6, ribColor: t === 4 ? 0xf5c542 : undefined });
    return [x, y] as const;
  };
  return { ctx, t, m, r, win, spread, band, plinth, house, tower, seed };
}
/** yüz üzerinde yatay bant (süs, saçak altı) */
function bandOn(ctx: Ctx, f: FaceRef, y: number, hh: number, color: number) {
  const [ox, oy] = P(f.o[0], f.o[1], f.o[2]); const ax = f.a[0] - f.a[1], ay = (f.a[0] + f.a[1]) / 2 - f.a[2];
  ctx.save(); ctx.transform(ax, ay, 0, 1, ox, oy);
  const g = ctx.createLinearGradient(0, -y - hh, 0, -y); g.addColorStop(0, css(shade(color, 0.35))); g.addColorStop(1, css(shade(color, -0.2)));
  ctx.fillStyle = g; ctx.fillRect(0, -y - hh, f.w, hh); ctx.restore();
}

// ---------------------------------------------------------------- Kamp Merkezi: kulak kepçesi çadırı → kale
function merkez(k: Kit, sub: number, a: Anchors) {
  const { ctx, t, m } = k;
  if (t === 0) {
    groundShadow(ctx, -36, -36, 72, 72, 40, 0.3);
    k.plinth(-36, -36, 72, 72, 3);
    if (sub >= 1) { cyl(ctx, -26, -26, 3, 14, 8, 0xe9d7b0, 'canvas'); cone(ctx, -26, -26, 3 + 7, 17, 22, 0xe9d7b0, 0x7fb7c9); }
    if (sub >= 2) { cyl(ctx, 26, -22, 3, 12, 7, 0xe9d7b0, 'canvas'); cone(ctx, 26, -22, 3 + 6, 15, 19, 0xe9d7b0, 0xffc93c); }
    // büyük kulak çadırı: kepçe kıvrımlı yan kanatlar
    const [x, y] = P(0, 4, 3);
    earWing(ctx, x - 34, y - 18, 30, -1); earWing(ctx, x + 34, y - 18, 30, 1);
    cyl(ctx, 0, 4, 3, 38, 16, 0xf3e3c3, 'canvas', { top: null });
    const apex = cone(ctx, 0, 4, 3 + 15, 43, 50, 0xf6e6c6, 0xff7a8f);
    // giriş: sıcak ışık
    ctx.save(); ctx.beginPath(); ctx.moveTo(x - 9, y + 16); ctx.quadraticCurveTo(x, y - 22, x + 9, y + 16); ctx.closePath();
    const g = ctx.createLinearGradient(0, y - 12, 0, y + 16); g.addColorStop(0, '#ffe09a'); g.addColorStop(1, '#ff9f1c'); ctx.fillStyle = g; ctx.shadowColor = 'rgba(255,180,60,0.9)'; ctx.shadowBlur = 10; ctx.fill(); ctx.restore();
    ctx.strokeStyle = '#7a3a2a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 11, y + 16); ctx.quadraticCurveTo(x, y - 25, x + 11, y + 16); ctx.stroke();
    earGlyph(ctx, x, y - 30, 16, 0xff5c8a, 0xffd0d8);
    flag(ctx, apex[0], apex[1] + 2, 16, 0xff5c8a, { w: 13 }); a.flag = [apex[0], apex[1] + 2];
    lantern(ctx, x - 22, y + 18, 14); lantern(ctx, x + 18, y + 20, 14);
    a.lights.push([x - 18.5, y + 6, 0xffc14d], [x + 21.5, y + 8, 0xffc14d]);
    if (sub >= 2) { campfire(ctx, ...P(-34, 30, 0)); a.smoke.push(P(-34, 30, 10)); }
    a.sparkles.push([x, y - 60]);
    return;
  }
  if (t === 1) {
    groundShadow(ctx, -42, -38, 84, 76, 60);
    k.plinth(-42, -38, 84, 76, 5);
    // arka sağ gözetleme kulesi
    const wt = k.house(22, -34, 5, 14, 14, 46, { color: 0xb98450, pattern: 'plank' });
    void wt; hip(ctx, 22, -34, 14, 14, 51, 12, m.roof, m.roofPat, 3);
    const f = k.house(-34, -28, 5, 64, 52, 12, m.wall); const f2 = k.house(-34, -28, 17, 64, 52, 14, { color: 0xb07a46, pattern: 'log' });
    void f;
    gable(ctx, -34, -28, 64, 52, 31, 24, m.roof, m.roofPat, { axis: 'u', oh: 5, wall: { color: 0xb07a46, pattern: 'plank' } });
    k.win(f2.left, k.spread(64, 4, 6, [26, 38]), 3, 6, 8); doorOn(ctx, f.left, 27, 10, 15);
    k.win(f2.right, k.spread(52, 2, 6), 3, 6, 8);
    const [gx, gy] = P(30, 0, 40); earGlyph(ctx, gx, gy, 12, 0xff5c8a, 0xffd0d8);
    if (sub >= 1) { box(ctx, -10, 24, 5, 26, 10, 1.5, { color: 0x8a5a33, pattern: 'plank' }); for (const u of [-9, 15]) box(ctx, u, 32, 5, 1.6, 1.6, 12, { color: 0x6b3f22, pattern: 'plain' }); gable(ctx, -12, 24, 30, 10, 17, 4, m.roof, m.roofPat, { axis: 'u', oh: 1 }); }
    const ft = P(29, -27, 70); flag(ctx, ft[0], ft[1], 14, 0xff5c8a, { w: 12 }); a.flag = [ft[0], ft[1]];
    lantern(ctx, ...P(-12, 40, 0), 16); a.lights.push([P(-12, 40, 0)[0] + 3, P(-12, 40, 0)[1] - 13, 0xffc14d]);
    a.smoke.push(P(-20, -14, 52));
    if (sub >= 2) { crate(ctx, 38, 26, 0, 7); crate(ctx, 38, 34, 0, 6); }
    return;
  }
  if (t === 2) {
    groundShadow(ctx, -46, -42, 92, 84, 80);
    k.plinth(-46, -42, 92, 84, 6);
    if (sub >= 2) { k.tower(-30, -32, 6, 11, 58, 'cone'); }
    k.tower(34, -32, 6, 13, 62, 'cone', { roofH: 26 });
    const f = k.house(-34, -26, 6, 66, 52, 36);
    k.band(f.left, 34, 3, m.trim); k.band(f.right, 34, 3, m.trim);
    gable(ctx, -34, -26, 66, 52, 42, 26, m.roof, m.roofPat, { axis: 'u', oh: 4, wall: m.wall });
    k.win(f.left, k.spread(66, 4, 6, [25, 41]), 15, 6, 11); k.win(f.right, k.spread(52, 3, 6), 15, 6, 11);
    doorOn(ctx, f.left, 26, 14, 22, 0x6b3a1f);
    const [ex, ey] = P(0, 26, 34); shieldEar(ctx, ex, ey, 11, 0xff5c8a, m.trim);
    const lt = k.tower(-38, 30, 6, 13, 58, 'cone', { roofH: 26 });
    flag(ctx, lt[0], lt[1] + 1, 14, m.flag, { w: 12, dir: -1 });
    const rt = P(34, -32, 6 + 62 + 26); flag(ctx, rt[0], rt[1] + 1, 14, 0xff5c8a, { w: 13 }); a.flag = [rt[0], rt[1] + 1];
    if (sub >= 1) for (const [u, v] of [[-14, 26], [14, 26]] as const) { const [bx, by] = P(u, v, 30); banner(ctx, bx, by, 6, 14, 0xff5c8a, m.trim); }
    lantern(ctx, ...P(-20, 44, 0), 18); lantern(ctx, ...P(20, 44, 0), 18);
    return;
  }
  if (t === 3) {
    groundShadow(ctx, -48, -44, 96, 88, 100);
    k.plinth(-48, -44, 96, 88, 7);
    k.tower(30, -36, 7, 12, 74, 'flat'); const bt = P(30, -36, 81); antenna(ctx, bt[0], bt[1], 18); a.lights.push([bt[0], bt[1] - 18, 0xff5c8a]);
    const f = k.house(-36, -30, 7, 70, 58, 42);
    box(ctx, -36, -30, 49, 70, 58, 3, { color: m.trim, pattern: 'plain' });
    k.win(f.left, k.spread(70, 5, 6, [27, 43]), 22, 6, 10, { glow: 0x7df3ff, cross: false }); k.win(f.left, k.spread(70, 5, 6, [27, 43]), 8, 6, 9);
    k.win(f.right, k.spread(58, 4, 6), 22, 6, 10, { glow: 0x7df3ff, cross: false }); k.win(f.right, k.spread(58, 4, 6), 8, 6, 9);
    doorOn(ctx, f.left, 28, 14, 20, 0x2f4a6e, 0x1a2638);
    const c = k.house(-16, -16, 52, 30, 30, 26);
    box(ctx, -16, -16, 78, 30, 30, 2, { color: m.trim, pattern: 'plain' });
    windowOn(ctx, c.left, 2, 10, 26, 8, { glow: 0x7df3ff, frame: 0x1f2a3a, cross: false }); windowOn(ctx, c.right, 2, 10, 26, 8, { glow: 0x7df3ff, frame: 0x1f2a3a, cross: false });
    const dt = P(0, 0, 80); dish(ctx, dt[0], dt[1] - 6, 12); a.lights.push([dt[0] + 8, dt[1] - 16, 0x2ee6d6]);
    const [ex, ey] = P(0, 28, 46); neonEar(ctx, ex, ey, 13);
    const lt = k.tower(-40, 34, 7, 12, 64, 'flat'); a.lights.push([lt[0], lt[1] - 3, 0x2ee6d6]);
    a.flag = [lt[0] - 2, lt[1]]; flag(ctx, lt[0] - 2, lt[1], 16, 0x2ee6d6, { w: 13, dir: -1 });
    for (const u of [-22, 22]) { const [x, y] = P(u, 46, 0); lamppost(ctx, x, y, 20, 0x7df3ff); a.lights.push([x, y - 20, 0x7df3ff]); }
    a.smoke.push(P(-26, -22, 52));
    return;
  }
  // altın saray
  groundShadow(ctx, -50, -46, 100, 92, 120);
  k.plinth(-50, -46, 100, 92, 6); box(ctx, -44, -40, 6, 88, 80, 4, { color: 0xf5c542, pattern: 'plain' });
  k.tower(32, -36, 10, 11, 70, 'cone', { roofH: 30 }); goldTip(ctx, ...P(32, -36, 110));
  if (sub >= 1) { k.tower(-34, -36, 10, 10, 62, 'cone', { roofH: 26 }); goldTip(ctx, ...P(-34, -36, 98)); }
  const f = k.house(-36, -30, 10, 70, 58, 44);
  k.band(f.left, 0, 3, 0xf5c542); k.band(f.right, 0, 3, 0xf5c542); k.band(f.left, 40, 4, 0xf5c542); k.band(f.right, 40, 4, 0xf5c542);
  k.win(f.left, k.spread(70, 4, 7, [27, 43]), 16, 7, 14); k.win(f.right, k.spread(58, 3, 7), 16, 7, 14);
  for (const x of k.spread(70, 6, 2)) colonnade(ctx, f.left, x, 2, 40);
  doorOn(ctx, f.left, 27, 16, 26, 0x5b3fc4, 0xb8860b);
  hip(ctx, -36, -30, 70, 58, 54, 16, m.roof, 'tile', 4);
  const top = dome(ctx, 0, 0, 62, 26, 0x7651f0, { ribs: 7, ribColor: 0xf5c542 });
  earGlyph(ctx, top[0], top[1] - 12, 18, 0xf5c542, 0xfff3b0, 1.4); a.sparkles.push([top[0], top[1] - 12]);
  const lt = k.tower(-40, 34, 10, 12, 66, 'cone', { roofH: 28 }); goldTip(ctx, lt[0], lt[1]);
  const rt = k.tower(36, 30, 10, 10, 54, 'cone', { roofH: 24 }); goldTip(ctx, rt[0], rt[1]);
  flag(ctx, lt[0], lt[1] - 4, 16, 0x8b6bff, { w: 14, dir: -1, emblem: 0xf5c542 }); a.flag = [rt[0], rt[1] - 4]; flag(ctx, rt[0], rt[1] - 4, 16, 0xff5c8a, { w: 13 });
  for (const [u, v] of [[-16, 30], [16, 30]] as const) { const [bx, by] = P(u, v, 42); banner(ctx, bx, by, 7, 18, 0x7651f0, 0xf5c542); }
  for (const u of [-24, 24]) { const [x, y] = P(u, 48, 0); lamppost(ctx, x, y, 22, 0xffd66b, true); a.lights.push([x, y - 22, 0xffd66b]); }
  a.sparkles.push(P(-40, 34, 104), P(36, 30, 90), P(0, 30, 50));
}

// ---------------------------------------------------------------- Ses Laboratuvarı: kubbe + anten + ışıklar
function laboratuvar(k: Kit, sub: number, a: Anchors) {
  const { ctx, t, m } = k;
  const s = [0.78, 0.9, 1, 1.08, 1.16][t]!;
  const W = 40 * s, D = 34 * s, H = [16, 20, 24, 28, 30][t]!;
  groundShadow(ctx, -W / 2 - 4, -D / 2 - 4, W + 8, D + 8, H + 30);
  k.plinth(-W / 2 - 4, -D / 2 - 4, W + 8, D + 8, 3);
  const domeColor = [0xe9dcc0, 0x9aa4b0, 0xc77b3c, 0x5ce1e6, 0x7651f0][t]!;
  // arka anten
  const at = P(W / 2 - 6, -D / 2 + 4, 3 + H + (t >= 2 ? 10 : 0));
  if (t >= 2) box(ctx, W / 2 - 10, -D / 2, 3 + H, 8, 8, 10, { ...m.wall, seed: 3 });
  const ah = [18, 24, 30, 38, 42][t]!;
  antenna(ctx, at[0], at[1], ah, t === 4 ? 0xf5c542 : 0x5b5b6b); a.lights.push([at[0], at[1] - ah, 0xff5c8a]);
  if (t >= 3) a.lights.push([at[0], at[1] - ah * 0.55, 0x2ee6d6]);
  const f = k.house(-W / 2, -D / 2, 3, W, D, H);
  if (t >= 3) { k.band(f.left, H - 3, 3, m.trim); k.band(f.right, H - 3, 3, m.trim); }
  box(ctx, -W / 2 - 1, -D / 2 - 1, 3 + H, W + 2, D + 2, 2, { color: t === 4 ? 0xf5c542 : shade(m.wall.color, -0.2), pattern: 'plain' });
  k.win(f.left, k.spread(W, t >= 2 ? 3 : 2, 5, [W / 2 - 5, W / 2 + 5]), H * 0.35, 5, H * 0.4, t === 3 ? { glow: 0x7df3ff, cross: false } : {});
  k.win(f.right, k.spread(D, 2, 5), H * 0.35, 5, H * 0.4, t === 3 ? { glow: 0x7df3ff, cross: false } : {});
  doorOn(ctx, f.left, W / 2 - 5, 10, Math.min(16, H - 3), t >= 3 ? 0x2f4a6e : 0x6b3a1f);
  // kubbe
  const R = [15, 18, 21, 23, 25][t]!;
  if (t >= 1) cyl(ctx, -2, 0, 5 + H, R * 0.62, 4, shade(m.wall.color, -0.1), 'plain');
  const top = dome(ctx, -2, 0, 5 + H + (t >= 1 ? 4 : 0), R, domeColor, { glass: t === 3, ribs: t >= 2 ? 6 : 0, ribColor: t === 4 ? 0xf5c542 : undefined });
  if (t === 3) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(top[0], top[1] + R * 0.6, 1, top[0], top[1] + R * 0.6, R); g.addColorStop(0, 'rgba(120,255,240,0.5)'); g.addColorStop(1, 'rgba(120,255,240,0)'); ctx.fillStyle = g; ctx.fillRect(top[0] - R, top[1], R * 2, R); ctx.restore(); }
  // gözlem yarığı + teleskop
  if (t <= 2) { ctx.fillStyle = 'rgba(30,20,50,0.75)'; ctx.beginPath(); ctx.ellipse(top[0] - R * 0.2, top[1] + R * 0.45, 2.4, R * 0.42, -0.25, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#4a4a5a'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(top[0] - R * 0.2, top[1] + R * 0.35); ctx.lineTo(top[0] - R * 0.55, top[1] - 4); ctx.stroke(); }
  a.lights.push([top[0], top[1] - 1, t >= 3 ? 0x2ee6d6 : 0xffd36b]);
  if (t === 4) { goldTip(ctx, top[0], top[1]); a.sparkles.push([top[0], top[1] - 6]); }
  // ses dalgası tabelası
  const [sx, sy] = P(W / 2 + 6, D / 2 + 6, 0);
  signPost(ctx, sx, sy, 0x2ee6d6, t);
  if (sub >= 1) { const [bx, by] = P(-W / 2 - 2, D / 2 + 8, 0); beakers(ctx, bx, by); }
  if (sub >= 2 && t >= 1) { const [x, y] = P(-W / 2 - 6, -6, 0); lamppost(ctx, x, y, 16, t >= 3 ? 0x7df3ff : 0xffc14d); a.lights.push([x, y - 16, t >= 3 ? 0x7df3ff : 0xffc14d]); }
}

// ---------------------------------------------------------------- Atölye: baca + dişliler
function atolye(k: Kit, sub: number, a: Anchors) {
  const { ctx, t, m } = k;
  const s = [0.8, 0.9, 1, 1.08, 1.15][t]!;
  const W = 46 * s, D = 36 * s, H = [16, 20, 24, 28, 30][t]!;
  groundShadow(ctx, -W / 2 - 3, -D / 2 - 3, W + 6, D + 6, H + 26);
  k.plinth(-W / 2 - 3, -D / 2 - 3, W + 6, D + 6, 3);
  // baca (arka)
  const chims = t >= 3 ? 2 : 1;
  for (let i = 0; i < chims; i++) {
    const cu = -W / 2 + 6 + i * 12, cv = -D / 2 + 4;
    const ch = H + 22 + t * 4;
    box(ctx, cu, cv, 3, 7, 7, ch, { color: t >= 2 ? 0xa4503a : 0x8a8274, pattern: t >= 2 ? 'brick' : 'stone', seed: 11 + i });
    box(ctx, cu - 1, cv - 1, 3 + ch, 9, 9, 2, { color: t === 4 ? 0xf5c542 : 0x4a3a3a, pattern: 'plain' });
    a.smoke.push(P(cu + 3.5, cv + 3.5, 5 + ch));
  }
  const f = k.house(-W / 2, -D / 2, 3, W, D, H);
  gable(ctx, -W / 2, -D / 2, W, D, 3 + H, 14 + t * 2, m.roof, m.roofPat, { axis: 'v', oh: 4, wall: m.wall });
  // büyük kapı (sol yüz), cephe dişlileri (sağ yüz)
  onFaceDoorBig(ctx, f.left, W * 0.5 - 8, 16, Math.min(H - 2, 15), t);
  k.win(f.left, [3, W - 9], H * 0.45, 5, H * 0.35);
  // dişliler: yüz düzleminde dönen sprite'lar için bağlantı noktası
  const g1 = P(W / 2, D * 0.1, 3 + H * 0.55); a.gears.push([g1[0] + 2, g1[1], 7 + t]);
  if (t >= 1) { const g2 = P(W / 2, -D * 0.28, 3 + H * 0.72); a.gears.push([g2[0] + 2, g2[1], 4.5 + t * 0.6]); }
  if (t >= 3) { const g3 = P(W / 2, D * 0.38, 3 + H * 0.3); a.gears.push([g3[0] + 2, g3[1], 4]); }
  // örs + kütükler
  const [ax2, ay2] = P(-W / 2 + 4, D / 2 + 10, 0); anvil(ctx, ax2, ay2, t === 4 ? 0xf5c542 : 0x4b4f5c);
  if (sub >= 1) { crate(ctx, W / 2 + 2, D / 2 - 2, 0, 7, t >= 3 ? 0x7d8da0 : 0xb7844c); }
  if (sub >= 2) { logs(ctx, ...P(W / 2 + 6, -D / 2 + 2, 0)); }
  if (t >= 3) { const [x, y] = P(-W / 2 - 4, D / 2 + 2, 0); lamppost(ctx, x, y, 18, 0xffb84a, t === 4); a.lights.push([x, y - 18, 0xffb84a]); }
  if (t === 4) a.sparkles.push(P(0, 0, H + 26));
}

// ---------------------------------------------------------------- Kulak Deposu: ambar + sandıklar
function depo(k: Kit, sub: number, a: Anchors) {
  const { ctx, t, m } = k;
  const s = [0.82, 0.92, 1, 1.06, 1.12][t]!;
  const W = 44 * s, D = 34 * s, H = [18, 20, 24, 26, 28][t]!;
  groundShadow(ctx, -W / 2 - 3, -D / 2 - 3, W + 6, D + 14, H + 24);
  k.plinth(-W / 2 - 3, -D / 2 - 3, W + 6, D + 6, 3);
  // silo (arka sağ)
  if (t >= 2) {
    const sc = [0, 0, 0xc2603c, 0xa9b8c8, 0xf6efe4][t]!;
    cyl(ctx, W / 2 - 2, -D / 2 - 4, 3, 10, H + 16, sc, t === 2 ? 'brick' : t === 3 ? 'metal' : 'marble', { top: null });
    dome(ctx, W / 2 - 2, -D / 2 - 4, 3 + H + 16, 10, t === 4 ? 0xf5c542 : t === 3 ? 0x5d6d82 : 0x4a6194, { ribs: 4 });
  }
  const barn = t === 0 ? { color: 0xc0583a, pattern: 'plank' as Pattern } : m.wall;
  const f = k.house(-W / 2, -D / 2, 3, W, D, H, barn);
  gable(ctx, -W / 2, -D / 2, W, D, 3 + H, 16 + t * 2, t === 0 ? 0x8a5a33 : m.roof, t === 0 ? 'shingle' : m.roofPat, { axis: 'u', oh: 4, wall: barn });
  // ambar kapısı (X destekli) + üstte vinç kirişi
  barnDoor(ctx, f.left, W / 2 - 8, 16, Math.min(H - 2, 15), t);
  const [hx, hy] = P(0, D / 2, 3 + H + 10); ctx.fillStyle = '#5b3a24'; ctx.fillRect(hx - 1, hy - 1, 2, 6);
  k.win(f.right, k.spread(D, 2, 5), H * 0.5, 5, H * 0.3);
  // önde sandık, çuval, jeton
  crate(ctx, -W / 2 - 2, D / 2 + 4, 0, 7); crate(ctx, -W / 2 + 6, D / 2 + 6, 0, 6, 0xa87440);
  if (sub >= 1) crate(ctx, -W / 2 - 1, D / 2 + 5, 7, 5.5);
  sack(ctx, W / 2 - 4, D / 2 + 10, 0, 3.6); if (sub >= 2) sack(ctx, W / 2 + 2, D / 2 + 8, 0, 3.4, 0xd8c08a);
  const cp = P(W / 2 + 8, D / 2 + 2, 0); coinPile(ctx, cp[0], cp[1], 6 + t * 3, 2.6); a.coins = [cp[0], cp[1] - 4];
  if (t >= 3) { const [x, y] = P(-W / 2 - 6, -4, 0); lamppost(ctx, x, y, 18, 0xffc93c, t === 4); a.lights.push([x, y - 18, 0xffc93c]); }
  if (t === 4) a.sparkles.push(P(0, 0, H + 30), cp);
}

// ---------------------------------------------------------------- Yankı Kulesi: yüksek kule, tepede ses dalgası
function kule(k: Kit, sub: number, a: Anchors) {
  const { ctx, t, m } = k;
  if (t === 0) {
    ellipseShadow(ctx, 8, 4, 30, 14, 0.32);
    // ahşap gözetleme kulesi: 4 ayak + platform + çatı + boru
    const L = 10, H = 52;
    for (const [u, v] of [[-L, -L], [L, -L], [-L, L], [L, L]] as const) box(ctx, u - 1.5, v - 1.5, 0, 3, 3, H, { color: 0x8a5a33, pattern: 'plank' }, { top: null });
    ctx.strokeStyle = '#6b3f22'; ctx.lineWidth = 1.2; for (const z of [12, 30]) { ctx.beginPath(); ctx.moveTo(...P(-L, L, z)); ctx.lineTo(...P(L, L, z + 14)); ctx.moveTo(...P(L, L, z)); ctx.lineTo(...P(L, -L, z + 14)); ctx.stroke(); }
    box(ctx, -L - 4, -L - 4, H, 2 * L + 8, 2 * L + 8, 3, { color: 0xb98450, pattern: 'plank' });
    for (const [u, v] of [[-L - 3, L + 3], [L + 3, L + 3], [L + 3, -L - 3]] as const) box(ctx, u - 0.8, v - 0.8, H + 3, 1.6, 1.6, 8, { color: 0x6b3f22, pattern: 'plain' });
    hip(ctx, -L - 4, -L - 4, 2 * L + 8, 2 * L + 8, H + 12, 12, m.roof, 'thatch', 2);
    const hp = P(L + 4, L + 4, H + 7); horn(ctx, hp[0], hp[1], 9, 0xd9a13a); a.wave = [hp[0] + 9, hp[1] - 2];
    if (sub >= 1) { flag(ctx, ...P(0, 0, H + 24), 12, 0x8b6bff, { w: 11 }); }
    return;
  }
  const s = [0, 1, 1.08, 1.16, 1.22][t]!;
  const R = 14 * s, H = [0, 78, 96, 112, 126][t]!;
  ellipseShadow(ctx, 10, 4, R * 1.7, R * 0.8, 0.34);
  if (t === 1) {
    k.plinth(-14, -14, 28, 28, 4);
    const f = k.house(-11, -11, 4, 22, 22, H - 16);
    k.win(f.left, [8.5], 20, 5, 9); k.win(f.right, [8.5], 42, 5, 9); k.win(f.left, [8.5], 52, 5, 9);
    box(ctx, -15, -15, H - 12, 30, 30, 4, { color: 0x8a5a33, pattern: 'plank' });
    hip(ctx, -15, -15, 30, 30, H - 8, 16, m.roof, m.roofPat, 2);
    const hp = P(12, 12, H - 12); horn(ctx, hp[0], hp[1] - 2, 10, 0xc9a05a); a.wave = [hp[0] + 10, hp[1] - 4];
    flag(ctx, ...P(0, 0, H + 8), 12, 0x8b6bff, { w: 11 });
    return;
  }
  k.plinth(-18 * s, -18 * s, 36 * s, 36 * s, 5);
  if (t === 2) {
    k.tower(0, 0, 5, R, H - 10, 'crenel', { pat: 'brick' });
    const top = P(0, 0, 5 + H - 10);
    for (const z of [0.3, 0.6]) { const [x, y] = P(0, 0, 5 + (H - 10) * z); ctx.save(); ctx.shadowColor = 'rgba(255,190,80,.9)'; ctx.shadowBlur = 6; ctx.fillStyle = '#ffc65a'; ctx.beginPath(); ctx.moveTo(x - R * 0.3 - 2, y + R * 0.2); ctx.lineTo(x - R * 0.3 - 2, y - 6); ctx.arc(x - R * 0.3, y - 6, 2, Math.PI, 0); ctx.lineTo(x - R * 0.3 + 2, y + R * 0.2); ctx.fill(); ctx.restore(); }
    const hp = top; horn(ctx, hp[0] + 2, hp[1] - 8, 11, 0xd9a13a); a.wave = [hp[0] + 13, hp[1] - 10];
    flag(ctx, top[0] - 4, top[1] - 4, 20, 0x8b6bff, { w: 14, dir: -1 }); if (sub >= 1) flag(ctx, top[0] + 6, top[1] - 2, 14, 0xffc93c, { w: 10 });
    return;
  }
  if (t === 3) {
    // metal kafes kule + yayıcı çanak
    const L = 10 * s;
    for (const [u, v] of [[-L, -L], [L, -L], [-L, L], [L, L]] as const) { ctx.strokeStyle = css(0x5d6d82); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(...P(u * 1.5, v * 1.5, 5)); ctx.lineTo(...P(u * 0.5, v * 0.5, H)); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(93,109,130,0.9)'; ctx.lineWidth = 0.9;
    for (let i = 0; i < 6; i++) { const z0 = 5 + (H - 5) * (i / 6), z1 = 5 + (H - 5) * ((i + 1) / 6); const k0 = 1.5 - (i / 6), k1 = 1.5 - ((i + 1) / 6); ctx.beginPath(); ctx.moveTo(...P(-L * k0, L * k0, z0)); ctx.lineTo(...P(L * k1, L * k1, z1)); ctx.lineTo(...P(L * k0, -L * k0, z0)); ctx.moveTo(...P(-L * k0, L * k0, z0)); ctx.lineTo(...P(L * k0, L * k0, z0)); ctx.lineTo(...P(L * k0, -L * k0, z0)); ctx.stroke(); }
    cyl(ctx, 0, 0, 5, 6, H - 5, 0x93a8be, 'metal', { top: null });
    box(ctx, -L, -L, H, 2 * L, 2 * L, 10, { color: 0x93a8be, pattern: 'metal' });
    const top = P(0, 0, H + 10); dish(ctx, top[0], top[1] - 4, 14); a.wave = [top[0] + 4, top[1] - 16];
    const mid = P(0, 0, H * 0.5);
    a.lights.push([top[0] - 10, top[1] + 4, 0xff5c8a], [top[0] + 10, top[1] + 4, 0x2ee6d6], [mid[0], mid[1], 0x7df3ff]);
    windowOn(ctx, { o: [-L, L, H], a: [1, 0, 0], b: [0, 0, 1], w: 2 * L, h: 10 }, 2, 3, 2 * L - 4, 4, { glow: 0x7df3ff, frame: 0x1f2a3a, cross: false });
    return;
  }
  // altın sivri kule: mermer gövde, altın halkalar, kristal tepe
  k.tower(0, 0, 5, R, H - 24, 'flat', { pat: 'marble' });
  for (const z of [0.25, 0.5, 0.75, 1]) { const [x, y] = P(0, 0, 5 + (H - 24) * z); ctx.beginPath(); ctx.ellipse(x, y, R + 1, (R + 1) / 2, 0, 0, Math.PI); ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 2; ctx.stroke(); }
  for (const z of [0.38, 0.62]) { const [x, y] = P(0, 0, 5 + (H - 24) * z); ctx.save(); ctx.shadowColor = 'rgba(255,214,107,.9)'; ctx.shadowBlur = 6; ctx.fillStyle = '#ffd66b'; ctx.fillRect(x - R * 0.45, y - 4, 3.5, 8); ctx.restore(); }
  const ct = cone(ctx, 0, 0, 5 + H - 24, R + 2, 30, 0x7651f0);
  crystal(ctx, ct[0], ct[1] - 2, 9); a.wave = [ct[0], ct[1] - 10]; a.sparkles.push([ct[0], ct[1] - 12], P(0, 0, H * 0.5));
  flag(ctx, ct[0] - R - 2, ct[1] + 30, 16, 0xf5c542, { w: 12, dir: -1 });
}

// ---------------------------------------------------------------- Revir: yeşil haç, kalp
function revir(k: Kit, sub: number, a: Anchors) {
  const { ctx, t, m } = k;
  if (t === 0) {
    ellipseShadow(ctx, 0, 6, 40, 18, 0.3);
    k.plinth(-24, -18, 48, 36, 2);
    // beyaz bez çadır (beşik biçimli)
    const tent: Mat = { color: 0xf4efe6, pattern: 'canvas', alt: 0xe2ead9 };
    gable(ctx, -22, -16, 44, 32, 2, 24, 0xf4efe6, 'canvas', { axis: 'u', oh: 2, wall: tent });
    const [x, y] = P(0, 16, 14); greenCross(ctx, x, y, 8);
    a.heart = [x + 20, y - 20];
    if (sub >= 1) { const [bx, by] = P(26, 10, 0); stretcher(ctx, bx, by); }
    if (sub >= 2) { lantern(ctx, ...P(-26, 18, 0), 14); a.lights.push([P(-26, 18, 0)[0] + 3, P(-26, 18, 0)[1] - 11, 0xffc14d]); }
    return;
  }
  const s = [0, 0.92, 1, 1.07, 1.14][t]!;
  const W = 44 * s, D = 34 * s, H = [0, 20, 24, 28, 30][t]!;
  const wall: Mat = t === 1 ? { color: 0xeae2cf, pattern: 'stone' } : t === 2 ? { color: 0xf1ebe0, pattern: 'plank' } : m.wall;
  groundShadow(ctx, -W / 2 - 3, -D / 2 - 3, W + 6, D + 6, H + 24);
  k.plinth(-W / 2 - 3, -D / 2 - 3, W + 6, D + 6, 3);
  const f = k.house(-W / 2, -D / 2, 3, W, D, H, wall);
  if (t >= 2) { k.band(f.left, 0, 2.5, t === 2 ? 0xc2603c : t === 4 ? 0xf5c542 : 0x3ccf7e); k.band(f.right, 0, 2.5, t === 2 ? 0xc2603c : t === 4 ? 0xf5c542 : 0x3ccf7e); }
  const roofC = t === 3 ? 0x2a8f62 : t === 4 ? 0x7651f0 : 0x3a9e6a;
  if (t === 3) { box(ctx, -W / 2 - 1, -D / 2 - 1, 3 + H, W + 2, D + 2, 3, { color: roofC, pattern: 'plain' }); }
  else gable(ctx, -W / 2, -D / 2, W, D, 3 + H, 14 + t * 2, roofC, t === 4 ? 'tile' : 'shingle', { axis: 'u', oh: 3, wall });
  k.win(f.left, k.spread(W, 2, 6, [W / 2 - 6, W / 2 + 6]), H * 0.4, 6, H * 0.36, t === 3 ? { glow: 0xb8ffd8, cross: false } : {});
  k.win(f.right, k.spread(D, 2, 5), H * 0.4, 5, H * 0.36, t === 3 ? { glow: 0xb8ffd8, cross: false } : {});
  doorOn(ctx, f.left, W / 2 - 5, 10, Math.min(15, H - 3), 0x2f8f5c, 0x1f5a3a);
  // haç: çatıda/çatı üstünde
  const cz = t === 3 ? 3 + H + 3 : 3 + H + 10 + t * 2;
  const [cx, cy] = P(0, t === 3 ? 0 : D / 2 - 6, cz);
  if (t === 3) { ctx.fillStyle = '#26364b'; ctx.fillRect(cx - 1, cy - 4, 2, 6); }
  greenCross(ctx, cx, cy - (t === 3 ? 12 : 4), t === 4 ? 10 : 8, t >= 3, t === 4);
  a.heart = [cx + 18, cy - 22];
  // önde kalp tabelası
  const [hx, hy] = P(W / 2 + 6, D / 2 + 4, 0); heartSign(ctx, hx, hy, t);
  if (sub >= 1) { const [bx, by] = P(-W / 2 - 4, D / 2 + 6, 0); planter(ctx, bx, by); }
  if (t >= 3) { const [x, y] = P(-W / 2 - 6, -2, 0); lamppost(ctx, x, y, 18, 0xb8ffd8, t === 4); a.lights.push([x, y - 18, 0xb8ffd8]); }
  if (t === 4) a.sparkles.push([cx, cy - 10]);
}

// ---------------------------------------------------------------- küçük çizim parçaları
function earWing(ctx: Ctx, x: number, y: number, s: number, dir: 1 | -1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  ctx.beginPath(); ctx.moveTo(0, 18); ctx.bezierCurveTo(8, 4, 2, -14, -6, -18); ctx.bezierCurveTo(-s * 0.5, -22, -s * 0.62, 0, -s * 0.3, 16); ctx.closePath();
  const g = ctx.createLinearGradient(-s * 0.6, -18, 0, 18); g.addColorStop(0, '#ffd6c4'); g.addColorStop(1, dir === 1 ? '#c98a8a' : '#f2a58f');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(110,40,50,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-3, 12); ctx.bezierCurveTo(0, 0, -4, -10, -10, -11); ctx.strokeStyle = 'rgba(160,60,70,0.55)'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.restore();
}
function shieldEar(ctx: Ctx, x: number, y: number, s: number, color: number, rim: number) {
  ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y - s); ctx.lineTo(x + s, y); ctx.quadraticCurveTo(x + s, y + s, x, y + s * 1.4); ctx.quadraticCurveTo(x - s, y + s, x - s, y); ctx.closePath();
  ctx.fillStyle = css(rim); ctx.fill(); ctx.strokeStyle = 'rgba(38,20,44,0.6)'; ctx.lineWidth = 0.8; ctx.stroke();
  earGlyph(ctx, x, y + 1, s * 1.3, color, 0xffd0d8);
}
function neonEar(ctx: Ctx, x: number, y: number, s: number) {
  ctx.save(); ctx.shadowColor = 'rgba(46,230,214,0.95)'; ctx.shadowBlur = 8; earGlyph(ctx, x, y, s, 0x2ee6d6, 0xd9fffb, 0.8); ctx.restore();
}
function banner(ctx: Ctx, x: number, y: number, w: number, h: number, color: number, trim: number) {
  ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h - 3); ctx.lineTo(x - w / 2, y + h); ctx.closePath();
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, css(shade(color, 0.15))); g.addColorStop(1, css(shade(color, -0.25)));
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = css(trim); ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = css(trim); ctx.fillRect(x - w / 2 - 0.5, y - 0.8, w + 1, 1.2);
  earGlyph(ctx, x, y + h * 0.45, w * 0.8, trim, shade(trim, 0.4), 0.5);
}
function goldTip(ctx: Ctx, x: number, y: number) {
  ctx.strokeStyle = '#d9a400'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 7); ctx.stroke();
  ctx.save(); ctx.shadowColor = 'rgba(255,214,107,0.9)'; ctx.shadowBlur = 5; ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(x, y - 8, 1.8, 0, 7); ctx.fill(); ctx.restore();
}
function colonnade(ctx: Ctx, f: FaceRef, x: number, w: number, h: number) {
  const [ox, oy] = P(f.o[0], f.o[1], f.o[2]); const ax = f.a[0] - f.a[1], ay = (f.a[0] + f.a[1]) / 2 - f.a[2];
  ctx.save(); ctx.transform(ax, ay, 0, 1, ox, oy);
  const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cfc6b8');
  ctx.fillStyle = g; ctx.fillRect(x, -h, w, h); ctx.fillStyle = '#f5c542'; ctx.fillRect(x - 0.6, -h, w + 1.2, 1.4); ctx.fillRect(x - 0.6, -1.4, w + 1.2, 1.4);
  ctx.restore();
}
function antenna(ctx: Ctx, x: number, y: number, h: number, color = 0x5b5b6b) {
  ctx.strokeStyle = css(color); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  ctx.lineWidth = 0.8; for (let i = 1; i <= 3; i++) { const yy = y - h * (0.35 + i * 0.16); const w = 6 - i * 1.4; ctx.beginPath(); ctx.moveTo(x - w, yy + 1); ctx.lineTo(x, yy); ctx.lineTo(x + w, yy + 1); ctx.stroke(); }
  ctx.fillStyle = css(shade(color, -0.3)); ctx.beginPath(); ctx.arc(x, y - h, 1.4, 0, 7); ctx.fill();
}
function dish(ctx: Ctx, x: number, y: number, r: number) {
  ctx.strokeStyle = '#3c4a5e'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y + r * 0.6); ctx.lineTo(x, y); ctx.stroke();
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.5);
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.45, 0, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(-r, 0, r, 0); g.addColorStop(0, '#f0f6ff'); g.addColorStop(1, '#8396ad'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#3c4a5e'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.2, -r * 0.7); ctx.stroke(); ctx.fillStyle = '#ff5c8a'; ctx.beginPath(); ctx.arc(r * 0.2, -r * 0.75, 1.3, 0, 7); ctx.fill();
  ctx.restore();
}
function horn(ctx: Ctx, x: number, y: number, s: number, color: number) {
  ctx.beginPath(); ctx.moveTo(x - s * 0.4, y - 1); ctx.lineTo(x + s * 0.5, y - s * 0.55); ctx.quadraticCurveTo(x + s * 0.75, y, x + s * 0.5, y + s * 0.55); ctx.lineTo(x - s * 0.4, y + 1); ctx.closePath();
  const g = ctx.createLinearGradient(x, y - s * 0.5, x, y + s * 0.5); g.addColorStop(0, css(shade(color, 0.4))); g.addColorStop(1, css(shade(color, -0.3)));
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = css(shade(color, -0.5)); ctx.lineWidth = 0.7; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x + s * 0.5, y, s * 0.18, s * 0.55, 0, 0, Math.PI * 2); ctx.fillStyle = css(shade(color, -0.45)); ctx.fill();
}
function crystal(ctx: Ctx, x: number, y: number, s: number) {
  ctx.save(); ctx.shadowColor = 'rgba(180,140,255,0.95)'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.moveTo(x, y - s * 1.6); ctx.lineTo(x + s * 0.6, y - s * 0.4); ctx.lineTo(x, y + s * 0.3); ctx.lineTo(x - s * 0.6, y - s * 0.4); ctx.closePath();
  const g = ctx.createLinearGradient(x - s, y - s, x + s, y); g.addColorStop(0, '#f2e8ff'); g.addColorStop(0.5, '#b49bff'); g.addColorStop(1, '#6c4cf1'); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x, y - s * 1.6); ctx.lineTo(x, y + s * 0.3); ctx.stroke();
}
function campfire(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = '#6b6b6b'; for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 6, y + Math.sin(a) * 3, 1.8, 1.2, 0, 0, 7); ctx.fill(); }
  ctx.strokeStyle = '#6b3f22'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - 4, y + 1); ctx.lineTo(x + 4, y - 1); ctx.moveTo(x - 4, y - 1); ctx.lineTo(x + 4, y + 1); ctx.stroke();
  ctx.save(); ctx.shadowColor = 'rgba(255,150,40,1)'; ctx.shadowBlur = 10; ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.quadraticCurveTo(x - 2, y - 7, x, y - 10); ctx.quadraticCurveTo(x + 2, y - 6, x + 3, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff1a0'; ctx.beginPath(); ctx.moveTo(x - 1.4, y); ctx.quadraticCurveTo(x, y - 5, x + 1.4, y); ctx.fill(); ctx.restore();
}
function lamppost(ctx: Ctx, x: number, y: number, h: number, glow: number, gold = false) {
  ctx.strokeStyle = gold ? '#c99a1c' : '#2b2f3e'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  ctx.fillStyle = gold ? '#e6b422' : '#2b2f3e'; ctx.fillRect(x - 2, y - 1, 4, 1.4); ctx.fillRect(x - 2.4, y - h - 1, 4.8, 1.2);
  ctx.save(); ctx.shadowColor = css(glow, 0.95); ctx.shadowBlur = 9; ctx.fillStyle = css(shade(glow, 0.3)); ctx.beginPath(); ctx.arc(x, y - h - 3, 2.4, 0, 7); ctx.fill(); ctx.restore();
}
function signPost(ctx: Ctx, x: number, y: number, color: number, t: number) {
  ctx.fillStyle = '#5b3a24'; ctx.fillRect(x - 0.6, y - 14, 1.2, 14);
  ctx.fillStyle = t >= 3 ? '#1f2a3a' : '#8a5a33'; ctx.fillRect(x - 7, y - 19, 14, 7);
  ctx.strokeStyle = css(color); ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i <= 12; i++) { const xx = x - 6 + i; const yy = y - 15.5 + Math.sin(i * 1.1) * 2 * Math.sin((i / 12) * Math.PI); if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); } ctx.stroke();
}
function beakers(ctx: Ctx, x: number, y: number) {
  for (const [dx, c, h] of [[0, 0x2ee6d6, 6], [4, 0xff5c8a, 4], [-4, 0x8ef0b0, 5]] as const) {
    ctx.fillStyle = 'rgba(230,245,255,0.8)'; ctx.fillRect(x + dx - 1.2, y - h - 2, 2.4, h + 2);
    ctx.save(); ctx.shadowColor = css(c, 0.9); ctx.shadowBlur = 4; ctx.fillStyle = css(c); ctx.fillRect(x + dx - 1.2, y - h * 0.6, 2.4, h * 0.6); ctx.restore();
  }
}
function onFaceDoorBig(ctx: Ctx, f: FaceRef, x: number, w: number, h: number, t: number) {
  doorOn(ctx, f, x, w, h, t >= 3 ? 0x4a5a6e : 0x7a4626, t >= 3 ? 0x1f2a3a : 0x3a2010);
}
function barnDoor(ctx: Ctx, f: FaceRef, x: number, w: number, h: number, t: number) {
  const [ox, oy] = P(f.o[0], f.o[1], f.o[2]); const ax = f.a[0] - f.a[1], ay = (f.a[0] + f.a[1]) / 2 - f.a[2];
  ctx.save(); ctx.transform(ax, ay, 0, 1, ox, oy);
  ctx.fillStyle = t >= 3 ? '#4a5a6e' : '#7a3a22'; ctx.fillRect(x, -h, w, h);
  ctx.strokeStyle = t === 4 ? '#f5c542' : '#f1e3c8'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, -h + 0.5, w - 1, h - 1);
  ctx.beginPath(); ctx.moveTo(x, -h); ctx.lineTo(x + w / 2, 0); ctx.moveTo(x + w / 2, -h); ctx.lineTo(x, 0); ctx.moveTo(x + w / 2, -h); ctx.lineTo(x + w, 0); ctx.moveTo(x + w, -h); ctx.lineTo(x + w / 2, 0); ctx.moveTo(x + w / 2, -h); ctx.lineTo(x + w / 2, 0); ctx.stroke();
  ctx.fillStyle = 'rgba(255,190,80,0.8)'; ctx.fillRect(x + w / 2 - 0.4, -h, 0.8, h);
  ctx.restore();
}
function anvil(ctx: Ctx, x: number, y: number, color: number) {
  ctx.fillStyle = '#6b3f22'; ctx.fillRect(x - 3, y - 4, 6, 4);
  ctx.beginPath(); ctx.moveTo(x - 5, y - 4); ctx.lineTo(x + 5, y - 4); ctx.lineTo(x + 7, y - 6.5); ctx.lineTo(x - 4, y - 6.5); ctx.closePath(); ctx.fillStyle = css(color); ctx.fill();
  ctx.fillStyle = css(shade(color, 0.35)); ctx.fillRect(x - 4, y - 7, 10, 0.8);
}
function logs(ctx: Ctx, x: number, y: number) {
  for (const [dx, dy] of [[0, 0], [4, 1], [2, -3]] as const) { ctx.fillStyle = '#8a5a33'; ctx.fillRect(x + dx - 6, y + dy - 2, 10, 3.6); ctx.fillStyle = '#e0b680'; ctx.beginPath(); ctx.ellipse(x + dx + 4, y + dy - 0.2, 1.4, 1.8, 0, 0, 7); ctx.fill(); }
}
function greenCross(ctx: Ctx, x: number, y: number, s: number, glow = false, gold = false) {
  ctx.save(); if (glow) { ctx.shadowColor = 'rgba(80,255,160,0.95)'; ctx.shadowBlur = 10; }
  const a = s * 0.36;
  ctx.fillStyle = gold ? '#f5c542' : '#ffffff'; ctx.beginPath(); ctx.arc(x, y, s * 0.95, 0, 7); ctx.fill();
  ctx.fillStyle = '#28b46a'; ctx.fillRect(x - a, y - s * 0.75, a * 2, s * 1.5); ctx.fillRect(x - s * 0.75, y - a, s * 1.5, a * 2);
  ctx.restore(); ctx.strokeStyle = 'rgba(20,60,40,0.5)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(x, y, s * 0.95, 0, 7); ctx.stroke();
}
function heartShape(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.8); ctx.bezierCurveTo(x - s * 1.2, y, x - s * 0.7, y - s * 0.9, x, y - s * 0.35); ctx.bezierCurveTo(x + s * 0.7, y - s * 0.9, x + s * 1.2, y, x, y + s * 0.8); ctx.closePath();
}
function heartSign(ctx: Ctx, x: number, y: number, t: number) {
  ctx.fillStyle = '#5b3a24'; ctx.fillRect(x - 0.6, y - 12, 1.2, 12);
  ctx.save(); ctx.shadowColor = 'rgba(255,92,138,0.9)'; ctx.shadowBlur = t >= 3 ? 8 : 3; heartShape(ctx, x, y - 16, 4.4); ctx.fillStyle = '#ff5c8a'; ctx.fill(); ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(x - 1.6, y - 17, 1, 0, 7); ctx.fill();
}
function stretcher(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = '#e8e2d4'; ctx.beginPath(); ctx.moveTo(x - 8, y - 3); ctx.lineTo(x + 2, y - 8); ctx.lineTo(x + 8, y - 5); ctx.lineTo(x - 2, y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 0.8; ctx.stroke();
}
function planter(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = '#8a5a33'; ctx.fillRect(x - 4, y - 4, 8, 4);
  for (const [dx, c] of [[-2.5, 0xff5c8a], [0, 0xffc93c], [2.5, 0x8b6bff]] as const) { ctx.fillStyle = '#3d8a3a'; ctx.fillRect(x + dx - 0.3, y - 8, 0.6, 4); ctx.fillStyle = css(c); ctx.beginPath(); ctx.arc(x + dx, y - 8.5, 1.4, 0, 7); ctx.fill(); }
}

// ---------------------------------------------------------------- boş arsa
function emptyLot(ctx: Ctx, half: number) {
  const pts: [number, number, number][] = [[-half, -half, 0], [half, -half, 0], [half, half, 0], [-half, half, 0]];
  poly3(ctx, pts, 'rgba(120,80,40,0.28)');
  ctx.setLineDash([4, 3]); poly3(ctx, pts, undefined, 'rgba(255,240,210,0.85)', 1.2); ctx.setLineDash([]);
  for (const [u, v] of pts) { const [x, y] = P(u, v, 0); ctx.fillStyle = '#7a4a26'; ctx.fillRect(x - 0.8, y - 7, 1.6, 7); ctx.fillStyle = '#ff9f1c'; ctx.fillRect(x - 0.8, y - 7, 1.6, 1.6); }
  // tabela: "+"
  const [sx, sy] = P(0, half * 0.4, 0);
  ctx.fillStyle = '#5b3a24'; ctx.fillRect(sx - 0.7, sy - 16, 1.4, 16);
  ctx.fillStyle = '#c98e55'; ctx.fillRect(sx - 8, sy - 24, 16, 10); ctx.strokeStyle = '#5b3a24'; ctx.lineWidth = 0.8; ctx.strokeRect(sx - 8, sy - 24, 16, 10);
  ctx.fillStyle = '#fff6e5'; ctx.fillRect(sx - 1, sy - 22.5, 2, 7); ctx.fillRect(sx - 3.5, sy - 20, 7, 2);
  crate(ctx, half * 0.2, -half * 0.5, 0, 6); logs(ctx, ...P(-half * 0.5, -half * 0.1, 0));
}

// ---------------------------------------------------------------- dışa açık
const PAINTERS: Record<BuildingId, (k: Kit, sub: number, a: Anchors) => void> = { merkez, laboratuvar, atolye, depo, kule, revir };
/** boyama kutusu (dünya birimi): tuval bu kutuyu kaplar, sonra boş kenarlar kırpılır */
export const PAINT_BOX: Record<BuildingId, { x0: number; y0: number; x1: number; y1: number }> = {
  merkez: { x0: -150, y0: -250, x1: 170, y1: 80 },
  laboratuvar: { x0: -110, y0: -170, x1: 120, y1: 70 },
  kule: { x0: -100, y0: -240, x1: 110, y1: 60 },
  atolye: { x0: -110, y0: -170, x1: 120, y1: 70 },
  depo: { x0: -110, y0: -150, x1: 120, y1: 70 },
  revir: { x0: -110, y0: -150, x1: 120, y1: 70 },
};

/** binayı verilen bağlama boyar (orijin = arsa merkezi). Bağlantı noktalarını döndürür. */
export function paintBuilding(ctx: Ctx, id: BuildingId, level: number, half = 32): Anchors {
  const a = newAnchors();
  if (level <= 0) { emptyLot(ctx, half - 6); return a; }
  const t = tierOf(level); const sub = (level - 1) % 3;
  ctx.save(); ctx.lineJoin = 'round';
  PAINTERS[id](kit(ctx, t, level * 101 + id.length * 7), sub, a);
  ctx.restore();
  return a;
}

/** bağımsız tuval: önizleme (React panel) ve doku üretimi. scale = piksel/dünya birimi. */
export function buildingCanvas(id: BuildingId, level: number, scale = 2): { canvas: HTMLCanvasElement; ox: number; oy: number; anchors: Anchors } {
  const b = PAINT_BOX[id];
  const W = Math.ceil((b.x1 - b.x0) * scale), H = Math.ceil((b.y1 - b.y0) * scale);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.scale(scale, scale); ctx.translate(-b.x0, -b.y0);
  const anchors = paintBuilding(ctx, id, level, id === 'merkez' ? 48 : 32);
  // boş kenarları kırp
  const data = ctx.getImageData(0, 0, W, H).data;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3]! > 6) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  if (maxX < 0) return { canvas: c, ox: -b.x0 * scale, oy: -b.y0 * scale, anchors };
  minX = Math.max(0, minX - 3); minY = Math.max(0, minY - 3); maxX = Math.min(W - 1, maxX + 3); maxY = Math.min(H - 1, maxY + 3);
  const out = document.createElement('canvas'); out.width = maxX - minX + 1; out.height = maxY - minY + 1;
  out.getContext('2d')!.drawImage(c, -minX, -minY);
  c.width = 1; c.height = 1;
  return { canvas: out, ox: -b.x0 * scale - minX, oy: -b.y0 * scale - minY, anchors };
}
export { ID_COLOR, mix as mixColor, sparkle as paintSparkle, gear as paintGear, heartShape };
