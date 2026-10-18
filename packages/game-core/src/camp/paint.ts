/**
 * Kulak Kampı çizim çekirdeği: saf Canvas 2D ile izometrik hacimler (Phaser'a bağlı değil; React önizlemesi de kullanır).
 * Koordinatlar dünya birimi: u (sağ-aşağı ekseni), v (sol-aşağı ekseni), z (yukarı). Bir karo 32 birim = ekranda 64×32.
 * Işık: alacakaranlık — sol üstten sıcak gün batımı, sağ yüzler mor gölgede; pencereler sıcak sarı yanar.
 */
export type Ctx = CanvasRenderingContext2D;
export type V3 = readonly [number, number, number];

/** izometrik izdüşüm (2:1) */
export const P = (u: number, v: number, z = 0): [number, number] => [u - v, (u + v) / 2 - z];
const lin = (a: V3): [number, number] => [a[0] - a[1], (a[0] + a[1]) / 2 - a[2]];

// ---------------------------------------------------------------- renk
export const css = (c: number, a = 1) => (a >= 1 ? `#${(c & 0xffffff).toString(16).padStart(6, '0')}` : `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`);
/** amt>0 aydınlat, amt<0 karart (−1..1) */
export function shade(c: number, amt: number): number {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
}
/** iki rengi karıştır (t: b'nin payı) */
export function mix(a: number, b: number, t: number): number {
  const m = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}
const SUN = 0xffb36b; const DUSK = 0x3b2a7a;
/** yüz tonları: sol yüz gün batımına bakar, sağ yüz mor gölgede, üst yüz en açık */
export const tone = {
  left: (c: number) => mix(c, SUN, 0.1),
  right: (c: number) => mix(shade(c, -0.3), DUSK, 0.18),
  top: (c: number) => mix(shade(c, 0.12), SUN, 0.05),
};
export const LINE = 'rgba(38,20,44,0.55)';

// ---------------------------------------------------------------- deterministik rastgele
export function rng(seed: number): () => number { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- yol yardımcıları
export function poly(ctx: Ctx, pts: [number, number][], fill?: string | CanvasGradient, stroke?: string, lw = 1) {
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
}
export const poly3 = (ctx: Ctx, pts: V3[], fill?: string | CanvasGradient, stroke?: string, lw = 1) => poly(ctx, pts.map((p) => P(p[0], p[1], p[2])), fill, stroke, lw);

/** yumuşak gölge: şekli tuval dışına çizip yalnız gölgesini içeri düşürür (Safari'de de çalışır) */
export function soft(ctx: Ctx, path: () => void, color: string, blur: number) {
  ctx.save();
  const off = 4000;
  ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.shadowOffsetX = off; ctx.shadowOffsetY = 0;
  ctx.translate(-off, 0); ctx.beginPath(); path(); ctx.fillStyle = '#000'; ctx.fill();
  ctx.restore();
}
/** zemin gölgesi: taban dikdörtgeninin sağ-arkaya (ışığın tersine) uzayan yumuşak izi */
export function groundShadow(ctx: Ctx, u0: number, v0: number, w: number, d: number, h: number, alpha = 0.38) {
  const k = Math.min(1.1, h / 60) * 0.55 + 0.25;
  const du = w * 0.1 + h * 0.35 * k, dv = -h * 0.12 * k;
  const pts: [number, number][] = [P(u0, v0 + d), P(u0 + w, v0 + d), P(u0 + w + du, v0 + d + dv), P(u0 + w + du, v0 + dv), P(u0 + du, v0 + dv), P(u0, v0)];
  soft(ctx, () => { pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }, `rgba(28,12,48,${alpha})`, 10);
  // temas gölgesi (AO)
  soft(ctx, () => { const q = [P(u0 - 2, v0 - 2), P(u0 + w + 3, v0 - 2), P(u0 + w + 3, v0 + d + 3), P(u0 - 2, v0 + d + 3)]; q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }, `rgba(28,12,48,${alpha * 0.9})`, 5);
}
export function ellipseShadow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, alpha = 0.35) {
  soft(ctx, () => ctx.ellipse(cx + rx * 0.18, cy + ry * 0.12, rx, ry, 0, 0, Math.PI * 2), `rgba(28,12,48,${alpha})`, 9);
}

// ---------------------------------------------------------------- yüz (affine) çizimi
/** o noktasından a (genişlik) ve b (yükseklik) yönlerinde gerilen düzlemde, (0..w)×(0..h) yüz uzayında çiz. y yukarı doğru artar. */
export function onFace(ctx: Ctx, o: V3, a: V3, b: V3, fn: () => void) {
  const [ox, oy] = P(o[0], o[1], o[2]); const [ax, ay] = lin(a); const [bx, by] = lin(b);
  // tuvalde −y = b yönü (yüz uzayında yukarı); çizimler (0, −h)..(w, 0) dikdörtgenini kullanır
  ctx.save(); ctx.transform(ax, ay, -bx, -by, ox, oy); fn(); ctx.restore();
}
export type Pattern = 'plank' | 'log' | 'stone' | 'brick' | 'metal' | 'marble' | 'canvas' | 'plain';
export interface Mat { color: number; pattern: Pattern; alt?: number; seed?: number }

/** yüz dokusu (yüz uzayında: x 0..w, y 0..h, y yukarı) */
export function pattern(ctx: Ctx, w: number, h: number, base: number, p: Pattern, seed = 1, alt?: number) {
  const r = rng(seed);
  const flip = (y: number) => -y; // yüz uzayında y yukarı; tuvalde aşağı → işaret
  ctx.save(); ctx.beginPath(); ctx.rect(0, -h, w, h); ctx.clip();
  switch (p) {
    case 'plank': {
      for (let y = 0; y < h; y += 5) {
        ctx.fillStyle = css(shade(base, (r() - 0.5) * 0.12)); ctx.fillRect(0, flip(y + 5), w, 5);
        ctx.fillStyle = 'rgba(60,30,10,0.35)'; ctx.fillRect(0, flip(y) - 0.7, w, 0.7);
        ctx.fillStyle = 'rgba(255,230,190,0.18)'; ctx.fillRect(0, flip(y + 5), w, 0.6);
        for (let x = r() * 14; x < w; x += 10 + r() * 14) { ctx.fillStyle = 'rgba(60,30,10,0.3)'; ctx.fillRect(x, flip(y + 5), 0.6, 5); }
      }
      break;
    }
    case 'log': {
      for (let y = 0; y < h; y += 6) {
        const g = ctx.createLinearGradient(0, flip(y + 6), 0, flip(y)); g.addColorStop(0, css(shade(base, -0.15))); g.addColorStop(0.35, css(shade(base, 0.12))); g.addColorStop(1, css(shade(base, -0.3)));
        ctx.fillStyle = g; ctx.fillRect(0, flip(y + 6), w, 6);
        ctx.fillStyle = css(shade(base, 0.25)); ctx.beginPath(); ctx.ellipse(1.5, flip(y + 3), 1.6, 2.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(60,30,10,0.4)'; ctx.lineWidth = 0.4; ctx.stroke();
      }
      break;
    }
    case 'stone': {
      for (let y = 0; y < h; y += 7) {
        let x = -r() * 8;
        while (x < w) { const bw = 7 + r() * 9; ctx.fillStyle = css(shade(base, (r() - 0.5) * 0.22)); roundRect(ctx, x + 0.6, flip(y + 6.6), bw - 1.2, 6, 1.6); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(x + 1.2, flip(y + 6.4), bw - 2.4, 0.9); x += bw; }
      }
      ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = css(shade(base, -0.38)); ctx.fillRect(0, -h, w, h);
      break;
    }
    case 'brick': {
      ctx.fillStyle = css(mix(base, 0xe8d8c0, 0.55)); ctx.fillRect(0, -h, w, h);
      for (let y = 0, row = 0; y < h; y += 3.6, row++) {
        for (let x = row % 2 ? -4 : 0; x < w; x += 8) { ctx.fillStyle = css(shade(base, (r() - 0.5) * 0.2)); ctx.fillRect(x + 0.45, flip(y + 3.2), 7.1, 2.8); }
      }
      break;
    }
    case 'metal': {
      const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, css(shade(base, 0.08))); g.addColorStop(0.5, css(shade(base, -0.05))); g.addColorStop(1, css(shade(base, 0.1)));
      ctx.fillStyle = g; ctx.fillRect(0, -h, w, h);
      ctx.strokeStyle = 'rgba(20,30,50,0.45)'; ctx.lineWidth = 0.6;
      for (let x = 12; x < w; x += 12) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, -h); ctx.stroke(); }
      for (let y = 14; y < h; y += 14) { ctx.beginPath(); ctx.moveTo(0, -y); ctx.lineTo(w, -y); ctx.stroke(); }
      ctx.fillStyle = 'rgba(230,240,255,0.55)';
      for (let x = 2; x < w; x += 6) for (let y = 2; y < h; y += 14) { ctx.beginPath(); ctx.arc(x, -y, 0.45, 0, 7); ctx.fill(); }
      break;
    }
    case 'marble': {
      ctx.fillStyle = css(base); ctx.fillRect(0, -h, w, h);
      ctx.strokeStyle = 'rgba(150,140,170,0.25)'; ctx.lineWidth = 0.4;
      for (let i = 0; i < w / 8; i++) { ctx.beginPath(); let x = r() * w, y = 0; ctx.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 8; y -= h / 6; ctx.lineTo(x, y); } ctx.stroke(); }
      for (let x = 0; x < w; x += 9) { ctx.fillStyle = 'rgba(120,100,150,0.12)'; ctx.fillRect(x, -h, 0.6, h); }
      break;
    }
    case 'canvas': {
      const a2 = alt ?? shade(base, -0.15);
      for (let x = 0, i = 0; x < w; x += 6, i++) { ctx.fillStyle = css(i % 2 ? a2 : base); ctx.fillRect(x, -h, 6, h); }
      break;
    }
    case 'plain': ctx.fillStyle = css(base); ctx.fillRect(0, -h, w, h); break;
  }
  // derinlik: tabana doğru koyulaşan geçiş + üst kenar parlaklığı
  const ao = ctx.createLinearGradient(0, 0, 0, -Math.min(h, 18)); ao.addColorStop(0, 'rgba(20,8,40,0.35)'); ao.addColorStop(1, 'rgba(20,8,40,0)');
  ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = ao; ctx.fillRect(0, -h, w, h);
  ctx.restore();
}
export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
}

// ---------------------------------------------------------------- hacimler
export interface FaceRef { o: V3; a: V3; b: V3; w: number; h: number }
/** kutu: taban köşesi (u0,v0,z0), genişlik w (u), derinlik d (v), yükseklik h. Görünen yüzleri döndürür (pencere vb. için). */
export function box(ctx: Ctx, u0: number, v0: number, z0: number, w: number, d: number, h: number, mat: Mat, opts: { top?: number | null; topPattern?: Pattern; noLine?: boolean } = {}) {
  const u1 = u0 + w, v1 = v0 + d, z1 = z0 + h;
  const left: FaceRef = { o: [u0, v1, z0], a: [1, 0, 0], b: [0, 0, 1], w, h };
  const right: FaceRef = { o: [u1, v1, z0], a: [0, -1, 0], b: [0, 0, 1], w: d, h };
  const seed = mat.seed ?? 7;
  onFace(ctx, left.o, left.a, left.b, () => pattern(ctx, w, h, tone.left(mat.color), mat.pattern, seed, mat.alt && tone.left(mat.alt)));
  onFace(ctx, right.o, right.a, right.b, () => pattern(ctx, d, h, tone.right(mat.color), mat.pattern, seed + 3, mat.alt && tone.right(mat.alt)));
  if (opts.top !== null) {
    const tc = opts.top ?? mat.color;
    poly3(ctx, [[u0, v0, z1], [u1, v0, z1], [u1, v1, z1], [u0, v1, z1]], css(tone.top(tc)));
  }
  if (!opts.noLine) {
    poly3(ctx, [[u0, v1, z0], [u1, v1, z0], [u1, v0, z0], [u1, v0, z1], [u0, v0, z1], [u0, v1, z1]], undefined, LINE, 0.9);
    ctx.beginPath(); ctx.moveTo(...P(u0, v1, z1)); ctx.lineTo(...P(u1, v1, z1)); ctx.lineTo(...P(u1, v0, z1)); ctx.moveTo(...P(u1, v1, z1)); ctx.lineTo(...P(u1, v1, z0));
    ctx.strokeStyle = 'rgba(255,236,200,0.45)'; ctx.lineWidth = 0.7; ctx.stroke();
  }
  return { left, right };
}

/** çatı dokusu (eğim uzayında: x boyunca sırt, y saçaktan sırta) */
export type RoofPat = 'thatch' | 'tile' | 'slate' | 'metal' | 'shingle' | 'canvas';
function roofPattern(ctx: Ctx, w: number, h: number, base: number, p: RoofPat, seed: number) {
  const r = rng(seed);
  ctx.save(); ctx.beginPath(); ctx.rect(-1, -h - 1, w + 2, h + 2); ctx.clip();
  ctx.fillStyle = css(base); ctx.fillRect(-1, -h - 1, w + 2, h + 2);
  if (p === 'thatch') {
    for (let y = 0; y < h; y += 4) { ctx.fillStyle = css(shade(base, -0.18)); ctx.fillRect(0, -y - 0.8, w, 0.8);
      for (let x = 0; x < w; x += 1.6) { ctx.strokeStyle = css(shade(base, (r() - 0.4) * 0.35), 0.8); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(x, -y); ctx.lineTo(x + (r() - 0.5), -y - 4.2); ctx.stroke(); } }
  } else if (p === 'tile' || p === 'shingle') {
    const tw = p === 'tile' ? 5 : 6, th = p === 'tile' ? 4 : 4.5;
    for (let y = 0, row = 0; y < h; y += th, row++) for (let x = row % 2 ? -tw / 2 : 0; x < w; x += tw) {
      ctx.fillStyle = css(shade(base, (r() - 0.5) * 0.18)); ctx.beginPath();
      if (p === 'tile') { ctx.moveTo(x, -y); ctx.lineTo(x, -y - th); ctx.lineTo(x + tw, -y - th); ctx.lineTo(x + tw, -y); ctx.quadraticCurveTo(x + tw / 2, -y + 1.6, x, -y); }
      else { ctx.rect(x + 0.3, -y - th, tw - 0.6, th); }
      ctx.fill(); ctx.strokeStyle = 'rgba(40,10,10,0.35)'; ctx.lineWidth = 0.4; ctx.stroke();
      ctx.fillStyle = 'rgba(255,220,180,0.18)'; ctx.fillRect(x + 0.6, -y - th + 0.2, tw - 1.2, 0.6);
    }
  } else if (p === 'slate') {
    for (let y = 0, row = 0; y < h; y += 3.5, row++) for (let x = row % 2 ? -3 : 0; x < w; x += 6) { ctx.fillStyle = css(shade(base, (r() - 0.5) * 0.25)); ctx.fillRect(x + 0.3, -y - 3.5, 5.4, 3.3); }
  } else if (p === 'metal') {
    for (let x = 0; x < w; x += 4) { ctx.fillStyle = css(shade(base, 0.12)); ctx.fillRect(x, -h, 1.1, h); ctx.fillStyle = css(shade(base, -0.15)); ctx.fillRect(x + 1.1, -h, 0.5, h); }
  } else if (p === 'canvas') {
    for (let x = 0, i = 0; x < w; x += 6, i++) if (i % 2) { ctx.fillStyle = css(shade(base, -0.12)); ctx.fillRect(x, -h, 6, h); }
  }
  const g = ctx.createLinearGradient(0, 0, 0, -h); g.addColorStop(0, 'rgba(20,8,40,0.18)'); g.addColorStop(1, 'rgba(255,240,210,0.12)');
  ctx.fillStyle = g; ctx.fillRect(-1, -h - 1, w + 2, h + 2);
  ctx.restore();
}

/** beşik çatı: axis 'u' → sırt u boyunca; 'v' → sırt v boyunca. z: saçak yüksekliği, rise: sırt yüksekliği. */
export function gable(ctx: Ctx, u0: number, v0: number, w: number, d: number, z: number, rise: number, color: number, pat: RoofPat, opts: { axis?: 'u' | 'v'; oh?: number; wall?: Mat; seed?: number } = {}) {
  const axis = opts.axis ?? 'u'; const oh = opts.oh ?? 4; const seed = opts.seed ?? 3;
  // (a: sırt boyu, b: sırt dikine) → (u,v)
  const M = (a: number, b: number, zz: number): V3 => (axis === 'u' ? [a, b, zz] : [b, a, zz]);
  const a0 = axis === 'u' ? u0 : v0, A = axis === 'u' ? w : d, b0 = axis === 'u' ? v0 : u0, B = axis === 'u' ? d : w;
  const a1 = a0 + A, b1 = b0 + B, bm = b0 + B / 2;
  const zR = z + rise, zE = z - (oh * rise) / (B / 2);
  const slopeLen = Math.hypot(B / 2 + oh, rise + (z - zE));
  const lightFront = axis === 'u'; // u-sırtında ön eğim (+v) güneşe bakar
  const cFront = lightFront ? tone.left(color) : tone.right(color), cBack = lightFront ? mix(tone.right(color), 0xffffff, 0.05) : tone.left(shade(color, 0.05));
  // arka eğim
  poly3(ctx, [M(a0 - oh, b0 - oh, zE), M(a1 + oh, b0 - oh, zE), M(a1 + oh, bm, zR), M(a0 - oh, bm, zR)], css(cBack), LINE, 0.8);
  // alın üçgeni (görünen uç: a1)
  const wall = opts.wall;
  if (wall) {
    const tri: V3[] = [M(a1, b0, z), M(a1, b1, z), M(a1, bm, zR)];
    ctx.save(); poly3(ctx, tri); ctx.clip();
    const face: FaceRef = axis === 'u' ? { o: [a1, b1, z], a: [0, -1, 0], b: [0, 0, 1], w: B, h: rise } : { o: [b0, a1, z], a: [1, 0, 0], b: [0, 0, 1], w: B, h: rise };
    onFace(ctx, face.o, face.a, face.b, () => pattern(ctx, B, rise, axis === 'u' ? tone.right(wall.color) : tone.left(wall.color), wall.pattern, seed));
    ctx.restore(); poly3(ctx, tri, undefined, LINE, 0.8);
  }
  // ön eğim (dokulu)
  const o = M(a0 - oh, b1 + oh, zE); const ea = M(1, 0, 0); const dir = M(0, -(B / 2 + oh) / slopeLen, (zR - zE) / slopeLen);
  ctx.save(); poly3(ctx, [M(a0 - oh, bm, zR), M(a1 + oh, bm, zR), M(a1 + oh, b1 + oh, zE), M(a0 - oh, b1 + oh, zE)]); ctx.clip();
  onFace(ctx, o, [ea[0], ea[1], 0], [dir[0], dir[1], dir[2]], () => roofPattern(ctx, A + oh * 2, slopeLen, cFront, pat, seed));
  ctx.restore();
  poly3(ctx, [M(a0 - oh, bm, zR), M(a1 + oh, bm, zR), M(a1 + oh, b1 + oh, zE), M(a0 - oh, b1 + oh, zE)], undefined, LINE, 0.9);
  // uç kalınlığı (saçak tahtası) ve sırt
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(...P(...M(a1 + oh, b0 - oh, zE))); ctx.lineTo(...P(...M(a1 + oh, bm, zR))); ctx.lineTo(...P(...M(a1 + oh, b1 + oh, zE)));
  ctx.strokeStyle = css(shade(color, -0.45)); ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(...P(...M(a0 - oh, bm, zR))); ctx.lineTo(...P(...M(a1 + oh, bm, zR)));
  ctx.strokeStyle = css(shade(color, 0.25)); ctx.lineWidth = 1.6; ctx.stroke();
  return { ridge: [M(a0, bm, zR), M(a1, bm, zR)] as const, zR };
}

/** kırma (piramit) çatı */
export function hip(ctx: Ctx, u0: number, v0: number, w: number, d: number, z: number, rise: number, color: number, pat: RoofPat, oh = 3, seed = 5) {
  const ua = u0 - oh, ub = u0 + w + oh, va = v0 - oh, vb = v0 + d + oh; const cu = u0 + w / 2, cv = v0 + d / 2;
  const ridgeHalf = Math.max(0, (w - d) / 2);
  const t1: V3 = [cu - ridgeHalf, cv, z + rise], t2: V3 = [cu + ridgeHalf, cv, z + rise];
  poly3(ctx, [[ua, va, z], [ub, va, z], t2, t1], css(mix(tone.right(color), 0xffffff, 0.06)), LINE, 0.8); // arka (-v)
  poly3(ctx, [[ua, va, z], [ua, vb, z], t1], css(tone.left(shade(color, 0.04))), LINE, 0.8); // sol arka (-u)
  // sağ (+u) ve ön (+v)
  const front: V3[] = [[ua, vb, z], [ub, vb, z], t2, t1]; const right: V3[] = [[ub, va, z], [ub, vb, z], t2];
  for (const [pts, c, sd] of [[right, tone.right(color), seed + 1], [front, tone.left(color), seed]] as const) {
    ctx.save(); poly3(ctx, pts); ctx.clip();
    const [x0, y0] = P(ua, vb, z);
    ctx.translate(x0 - 80, y0 + 10); roofPattern(ctx, 220, 120, c, pat, sd); ctx.restore();
    poly3(ctx, pts, undefined, LINE, 0.9);
  }
  ctx.beginPath(); ctx.moveTo(...P(...t1)); ctx.lineTo(...P(...t2)); ctx.lineTo(...P(ub, vb, z)); ctx.moveTo(...P(...t2)); ctx.lineTo(...P(ub, va, z)); ctx.moveTo(...P(...t1)); ctx.lineTo(...P(ua, vb, z));
  ctx.strokeStyle = css(shade(color, 0.28)); ctx.lineWidth = 1.1; ctx.stroke();
  return t2;
}

/** silindir: taban merkezi (cu,cv,z0), ekranda yarıçap R (elips R × R/2) */
export function cyl(ctx: Ctx, cu: number, cv: number, z0: number, R: number, h: number, color: number, pat: Pattern = 'plain', opts: { top?: number | null; seed?: number } = {}) {
  const [x, y] = P(cu, cv, z0);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(x - R, y - h); ctx.lineTo(x - R, y); ctx.ellipse(x, y, R, R / 2, 0, Math.PI, 0, true); ctx.lineTo(x + R, y - h); ctx.ellipse(x, y - h, R, R / 2, 0, 0, Math.PI, false); ctx.closePath();
  ctx.clip();
  if (pat !== 'plain') { ctx.save(); ctx.translate(x - R, y + R / 2); pattern(ctx, R * 2, h + R, color, pat, opts.seed ?? 9); ctx.restore(); }
  else { ctx.fillStyle = css(color); ctx.fillRect(x - R, y - h - R, R * 2, h + R * 2); }
  const g = ctx.createLinearGradient(x - R, 0, x + R, 0);
  g.addColorStop(0, 'rgba(255,190,120,0.18)'); g.addColorStop(0.3, 'rgba(255,230,200,0.22)'); g.addColorStop(0.62, 'rgba(40,20,80,0.08)'); g.addColorStop(1, 'rgba(40,20,90,0.5)');
  ctx.fillStyle = g; ctx.fillRect(x - R, y - h - R, R * 2, h + R * 2);
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(x - R, y - h); ctx.lineTo(x - R, y); ctx.ellipse(x, y, R, R / 2, 0, Math.PI, 0, true); ctx.lineTo(x + R, y - h); ctx.strokeStyle = LINE; ctx.lineWidth = 0.9; ctx.stroke();
  if (opts.top !== null) { ctx.beginPath(); ctx.ellipse(x, y - h, R, R / 2, 0, 0, Math.PI * 2); ctx.fillStyle = css(tone.top(opts.top ?? color)); ctx.fill(); ctx.strokeStyle = LINE; ctx.stroke(); }
}
/** koni (çadır, kule külahı): taban merkezi ve ekranda yarıçap R */
export function cone(ctx: Ctx, cu: number, cv: number, z0: number, R: number, h: number, color: number, stripes?: number) {
  const [x, y] = P(cu, cv, z0); const ax = x, ay = y - h;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(x - R, y); ctx.ellipse(x, y, R, R / 2, 0, Math.PI, 0, true); ctx.closePath(); ctx.clip();
  ctx.fillStyle = css(color); ctx.fillRect(x - R, ay, R * 2, h + R);
  if (stripes) for (let i = 0; i < 8; i++) if (i % 2) { const t0 = Math.PI - (i / 8) * Math.PI, t1 = Math.PI - ((i + 1) / 8) * Math.PI; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(x + Math.cos(t0) * R, y + Math.sin(t0) * R / 2); ctx.lineTo(x + Math.cos(t1) * R, y + Math.sin(t1) * R / 2); ctx.closePath(); ctx.fillStyle = css(stripes); ctx.fill(); }
  const g = ctx.createLinearGradient(x - R, 0, x + R, 0);
  g.addColorStop(0, 'rgba(255,190,120,0.2)'); g.addColorStop(0.32, 'rgba(255,235,210,0.25)'); g.addColorStop(0.65, 'rgba(40,20,80,0.1)'); g.addColorStop(1, 'rgba(40,20,90,0.5)');
  ctx.fillStyle = g; ctx.fillRect(x - R, ay, R * 2, h + R);
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(x - R, y); ctx.ellipse(x, y, R, R / 2, 0, Math.PI, 0, true); ctx.closePath(); ctx.strokeStyle = LINE; ctx.lineWidth = 0.9; ctx.stroke();
  return [ax, ay] as const;
}
/** kubbe (yarım küre): taban merkezi, ekranda yarıçap R */
export function dome(ctx: Ctx, cu: number, cv: number, z0: number, R: number, color: number, opts: { glass?: boolean; ribs?: number; ribColor?: number } = {}) {
  const [x, y] = P(cu, cv, z0);
  ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, R, R / 2, 0, 0, Math.PI, false); ctx.arc(x, y, R, Math.PI, 0, false); ctx.closePath();
  const g = ctx.createRadialGradient(x - R * 0.4, y - R * 0.55, R * 0.08, x, y - R * 0.2, R * 1.25);
  g.addColorStop(0, css(shade(color, 0.55), opts.glass ? 0.85 : 1)); g.addColorStop(0.45, css(color, opts.glass ? 0.7 : 1)); g.addColorStop(1, css(mix(shade(color, -0.45), DUSK, 0.25), opts.glass ? 0.85 : 1));
  ctx.fillStyle = g; ctx.fill(); ctx.clip();
  if (opts.ribs) { ctx.strokeStyle = css(opts.ribColor ?? shade(color, -0.3)); ctx.lineWidth = 1.1; for (let i = 1; i < opts.ribs; i++) { const t = i / opts.ribs; const ex = R * Math.cos(Math.PI * (1 - t)); ctx.beginPath(); ctx.ellipse(x, y, Math.abs(ex), R, 0, ex < 0 ? Math.PI : 0, ex < 0 ? Math.PI * 1.5 : -Math.PI * 0.5, ex >= 0); ctx.stroke(); } }
  if (opts.glass) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(x - R * 0.38, y - R * 0.55, R * 0.18, R * 0.32, -0.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(x, y, R, R / 2, 0, 0, Math.PI, false); ctx.arc(x, y, R, Math.PI, 0, false); ctx.closePath(); ctx.strokeStyle = LINE; ctx.lineWidth = 0.9; ctx.stroke();
  return [x, y - R] as const;
}

// ---------------------------------------------------------------- ayrıntılar
/** pencere (yüz uzayında x,y = sol alt köşe). warm: içeriden sıcak ışık. */
export function windowOn(ctx: Ctx, f: FaceRef, x: number, y: number, w: number, h: number, o: { arch?: boolean; frame?: number; glow?: number; cross?: boolean; sill?: boolean } = {}) {
  const frame = o.frame ?? 0x4a2a1a; const glow = o.glow ?? 0xffc14d;
  onFace(ctx, f.o, f.a, f.b, () => {
    const path = () => { ctx.beginPath(); if (o.arch) { ctx.moveTo(x, -y); ctx.lineTo(x, -(y + h - w / 2)); ctx.arc(x + w / 2, -(y + h - w / 2), w / 2, Math.PI, 0); ctx.lineTo(x + w, -y); ctx.closePath(); } else ctx.rect(x, -(y + h), w, h); };
    path(); ctx.fillStyle = css(frame); ctx.fill();
    ctx.save(); ctx.translate(x + w / 2, -(y + h / 2)); ctx.scale((w - 1.6) / w, (h - 1.6) / h); ctx.translate(-(x + w / 2), y + h / 2); path(); ctx.restore();
    const g = ctx.createLinearGradient(0, -(y + h), 0, -y); g.addColorStop(0, css(shade(glow, 0.45))); g.addColorStop(1, css(shade(glow, -0.12)));
    ctx.save(); ctx.shadowColor = css(glow, 0.9); ctx.shadowBlur = 6; ctx.fillStyle = g; ctx.fill(); ctx.restore();
    if (o.cross !== false && w > 3.5) { ctx.fillStyle = css(frame); ctx.fillRect(x + w / 2 - 0.35, -(y + h), 0.7, h); ctx.fillRect(x, -(y + h * 0.55) - 0.35, w, 0.7); }
    if (o.sill) { ctx.fillStyle = 'rgba(255,240,220,0.7)'; ctx.fillRect(x - 0.8, -y, w + 1.6, 0.9); }
  });
}
/** kapı (kemerli, ahşap; aralıktan sıcak ışık) */
export function doorOn(ctx: Ctx, f: FaceRef, x: number, w: number, h: number, wood = 0x7a4626, frame = 0x3a2010) {
  onFace(ctx, f.o, f.a, f.b, () => {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, -(h - w / 2)); ctx.arc(x + w / 2, -(h - w / 2), w / 2, Math.PI, 0); ctx.lineTo(x + w, 0); ctx.closePath();
    ctx.fillStyle = css(frame); ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = css(wood); ctx.fillRect(x + 0.8, -h, w - 1.6, h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 1; i < 4; i++) ctx.fillRect(x + (w * i) / 4, -h, 0.5, h);
    ctx.fillStyle = 'rgba(255,200,90,0.85)'; ctx.fillRect(x + w / 2 - 0.4, -h, 0.8, h);
    ctx.restore();
    ctx.fillStyle = '#f6c344'; ctx.beginPath(); ctx.arc(x + w * 0.72, -h * 0.42, 0.7, 0, 7); ctx.fill();
  });
}
/** bayrak direği + dalgalı bayrak (statik) */
export function flag(ctx: Ctx, x: number, y: number, h: number, color: number, o: { w?: number; dir?: 1 | -1; emblem?: number } = {}) {
  const w = o.w ?? 12, dir = o.dir ?? 1;
  ctx.strokeStyle = '#5b3a24'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(x, y - h - 0.8, 1.2, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y - h + 0.5); ctx.bezierCurveTo(x + dir * w * 0.35, y - h - 2, x + dir * w * 0.65, y - h + 2.5, x + dir * w, y - h + 1);
  ctx.lineTo(x + dir * w, y - h + 7); ctx.bezierCurveTo(x + dir * w * 0.65, y - h + 8.5, x + dir * w * 0.35, y - h + 4.5, x, y - h + 7); ctx.closePath();
  const g = ctx.createLinearGradient(x, 0, x + dir * w, 0); g.addColorStop(0, css(color)); g.addColorStop(0.5, css(shade(color, 0.2))); g.addColorStop(1, css(shade(color, -0.2)));
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = 0.5; ctx.stroke();
  if (o.emblem != null) { ctx.fillStyle = css(o.emblem); ctx.beginPath(); ctx.arc(x + dir * w * 0.5, y - h + 4, 1.8, 0, 7); ctx.fill(); }
}
/** kulak kepçesi amblemi (heliks + iç kıvrım), merkez (x,y), boy s */
export function earGlyph(ctx: Ctx, x: number, y: number, s: number, color: number, inner?: number, lw?: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 20, s / 20);
  ctx.beginPath();
  ctx.moveTo(4, 9); ctx.bezierCurveTo(-1, 13, -8, 9, -8, 0); ctx.bezierCurveTo(-8, -8, -2, -11, 3, -10); ctx.bezierCurveTo(9, -9, 10, -2, 7, 2); ctx.bezierCurveTo(5, 5, 6, 8, 4, 9); ctx.closePath();
  ctx.fillStyle = css(color); ctx.fill(); ctx.strokeStyle = css(shade(color, -0.45)); ctx.lineWidth = lw ?? 1.2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-3, 5); ctx.bezierCurveTo(-5, 0, -4, -6, 1, -6); ctx.bezierCurveTo(5, -6, 5, -1, 2, 0); ctx.bezierCurveTo(0, 1, 1, 4, 0, 5);
  ctx.strokeStyle = css(inner ?? shade(color, -0.35)); ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.stroke();
  ctx.restore();
}
/** küçük parıltı yıldızı */
export function sparkle(ctx: Ctx, x: number, y: number, r: number, color = 0xfff3b0) {
  ctx.save(); ctx.fillStyle = css(color); ctx.shadowColor = css(color, 0.9); ctx.shadowBlur = r * 2;
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill(); ctx.restore();
}
/** sandık (izometrik küçük kutu) */
export function crate(ctx: Ctx, u: number, v: number, z: number, s: number, color = 0xb7844c) {
  box(ctx, u, v, z, s, s, s, { color, pattern: 'plank', seed: Math.round(u * 13 + v) });
  ctx.strokeStyle = 'rgba(70,35,15,0.6)'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(...P(u, v + s, z)); ctx.lineTo(...P(u + s, v + s, z + s)); ctx.moveTo(...P(u + s, v + s, z)); ctx.lineTo(...P(u + s, v, z + s)); ctx.stroke();
}
/** çuval */
export function sack(ctx: Ctx, u: number, v: number, z: number, s: number, color = 0xe2cfa0) {
  const [x, y] = P(u, v, z);
  ctx.beginPath(); ctx.moveTo(x - s * 0.8, y); ctx.quadraticCurveTo(x - s, y - s * 1.2, x - s * 0.3, y - s * 1.4); ctx.lineTo(x + s * 0.3, y - s * 1.4); ctx.quadraticCurveTo(x + s, y - s * 1.2, x + s * 0.8, y); ctx.quadraticCurveTo(x, y + s * 0.4, x - s * 0.8, y);
  const g = ctx.createLinearGradient(x - s, 0, x + s, 0); g.addColorStop(0, css(shade(color, 0.1))); g.addColorStop(1, css(mix(shade(color, -0.3), DUSK, 0.2)));
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.strokeStyle = '#8a5a2b'; ctx.beginPath(); ctx.moveTo(x - s * 0.35, y - s * 1.3); ctx.lineTo(x + s * 0.35, y - s * 1.3); ctx.stroke();
}
/** jeton yığını */
export function coinPile(ctx: Ctx, x: number, y: number, n: number, s = 3) {
  const r = rng(n * 31 + 5);
  for (let i = 0; i < n; i++) {
    const cx = x + (r() - 0.5) * s * 4, cy = y - i * 0.9 * (i % 3 === 0 ? 1 : 0.4) + (r() - 0.5) * s;
    ctx.beginPath(); ctx.ellipse(cx, cy, s, s / 2, 0, 0, Math.PI * 2); ctx.fillStyle = '#d99a14'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy - 0.6, s, s / 2, 0, 0, Math.PI * 2); ctx.fillStyle = '#ffd24a'; ctx.fill(); ctx.strokeStyle = '#a8700c'; ctx.lineWidth = 0.4; ctx.stroke();
  }
}
/** dişli (2D, ön görünüş) — doku üretimi ve bina cephesi için */
export function gear(ctx: Ctx, x: number, y: number, r: number, teeth: number, color: number) {
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) { const a = (i / (teeth * 2)) * Math.PI * 2; const rr = i % 2 ? r : r * 0.78; const a2 = a + Math.PI / (teeth * 2); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); ctx.lineTo(x + Math.cos(a2) * rr, y + Math.sin(a2) * rr); }
  ctx.closePath();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, css(shade(color, 0.4))); g.addColorStop(1, css(shade(color, -0.25)));
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = css(shade(color, -0.55)); ctx.lineWidth = Math.max(0.6, r * 0.08); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, 7); ctx.fillStyle = css(shade(color, -0.4)); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r * 0.13, 0, 7); ctx.fillStyle = css(shade(color, 0.3)); ctx.fill();
}
/** fener (direkli, sıcak ışık) */
export function lantern(ctx: Ctx, x: number, y: number, h: number, gold = false) {
  ctx.strokeStyle = gold ? '#c99a1c' : '#3b2a33'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.lineTo(x + 3, y - h); ctx.stroke();
  ctx.save(); ctx.shadowColor = 'rgba(255,190,80,0.95)'; ctx.shadowBlur = 8; ctx.fillStyle = '#ffd36b'; roundRect(ctx, x + 1.4, y - h + 0.5, 3.4, 4.4, 1); ctx.fill(); ctx.restore();
  ctx.fillStyle = gold ? '#e6b422' : '#3b2a33'; ctx.fillRect(x + 1, y - h - 0.6, 4.2, 1.2);
}
