/**
 * Kulak Kampı: bölge binaları (Akustik Kabin, Yenidoğan Tarama Birimi, İşitsel Rehabilitasyon Parkı, Vestibüler Laboratuvar,
 * Odyoloji Kütüphanesi), her seviyede görünen küçük eklemeler ("süsleme": saksı, fener, bank, bayrak…) ve Sv 16–25 kademeleri
 * (Kristal, Efsane). Kamp boyama dili: buildings.ts ile aynı (sol yüz gün batımı, sağ yüz mor gölge, ince kontur).
 */
import type { Anchors, Kit } from './buildings';
import { antenna, banner, colonnade, crystal, dish, goldTip, lamppost, planter, signPost } from './buildings';
import { P, box, cone, css, cyl, doorOn, dome, earGlyph, ellipseShadow, flag, gable, groundShadow, hip, lantern, onFace, roundRect, shade, type Ctx, type FaceRef } from './paint';

const INK = 'rgba(38,20,44,0.6)';

// ---------------------------------------------------------------- Akustik Kabin: çift duvarlı, köpük kaplı sessiz oda
function foamFace(ctx: Ctx, f: FaceRef, x: number, y: number, w: number, h: number, color: number) {
  onFace(ctx, f.o, f.a, f.b, () => {
    ctx.fillStyle = css(shade(color, -0.25)); ctx.fillRect(x, -y - h, w, h);
    const n = Math.max(2, Math.round(w / 4)), m = Math.max(2, Math.round(h / 4));
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const cx = x + (i + 0.5) * (w / n), cy = -y - (j + 0.5) * (h / m); const s = Math.min(w / n, h / m) * 0.48;
      ctx.beginPath(); ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s, cy); ctx.lineTo(cx, cy + s); ctx.lineTo(cx - s, cy); ctx.closePath();
      ctx.fillStyle = css((i + j) % 2 ? shade(color, 0.15) : color); ctx.fill();
    }
  });
}
export function kabin(k: Kit, sub: number, a: Anchors) {
  const { ctx, t, m } = k;
  const s = [0.82, 0.92, 1, 1.07, 1.13][t]!;
  const W = 40 * s, D = 34 * s, H = [18, 22, 25, 28, 30][t]!;
  groundShadow(ctx, -W / 2 - 4, -D / 2 - 4, W + 8, D + 8, H + 22);
  k.plinth(-W / 2 - 4, -D / 2 - 4, W + 8, D + 8, 3);
  // ikinci kabin (arka sağ, Sv 7+)
  if (t >= 2) { const f2 = k.house(W / 2 - 14, -D / 2 - 14, 3, 16, 14, H * 0.7); foamFace(ctx, f2.left, 2, 3, 12, H * 0.7 - 6, t >= 3 ? 0x5b6bd8 : 0x8a6ac8); box(ctx, W / 2 - 15, -D / 2 - 15, 3 + H * 0.7, 18, 16, 2, { color: m.trim, pattern: 'plain' }); }
  const wall = t === 0 ? { color: 0xc9b48e, pattern: 'plank' as const } : m.wall;
  const f = k.house(-W / 2, -D / 2, 3, W, D, H, wall);
  // dış kabuk + iç kabuk: kalın kapı, ses yalıtım contası
  const foam = t >= 3 ? 0x5b6bd8 : t >= 1 ? 0x8a6ac8 : 0x7a6a9a;
  foamFace(ctx, f.right, 3, 4, D - 6, H - 8, foam);
  doorOn(ctx, f.left, W * 0.18, 11, Math.min(17, H - 4), t >= 3 ? 0x3a4a6e : 0x6b4a3a, 0x1f1a2a);
  onFace(ctx, f.left.o, f.left.a, f.left.b, () => { ctx.strokeStyle = '#1f1a2a'; ctx.lineWidth = 1.4; ctx.strokeRect(W * 0.18 - 1, -Math.min(17, H - 4) - 1, 13, Math.min(17, H - 4) + 1); });
  // gözlem penceresi (çift cam)
  k.win(f.left, [W * 0.58], H * 0.45, W * 0.28, H * 0.32, { glow: 0xbfe8ff, cross: false });
  // düz çatı + havalandırma susturucusu
  box(ctx, -W / 2 - 1.5, -D / 2 - 1.5, 3 + H, W + 3, D + 3, 3, { color: t === 4 ? 0xf5c542 : shade(m.wall.color, -0.18), pattern: 'plain' });
  box(ctx, -6, -8, 6 + H, 12, 10, 6, { color: t >= 3 ? 0x93a8be : 0xa89e8a, pattern: t >= 3 ? 'metal' : 'stone' });
  for (let i = 0; i < 3; i++) { const [x, y] = P(-4 + i * 4, 2, 9 + H); ctx.fillStyle = 'rgba(30,20,50,0.6)'; ctx.fillRect(x - 1, y - 2, 2, 3); }
  // "test sürüyor" ışığı (kapı üstünde) — kırmızı lamba
  const [lx, ly] = P(-W / 2 + W * 0.18 + 5.5, D / 2, 3 + Math.min(17, H - 4) + 4);
  ctx.save(); ctx.shadowColor = 'rgba(255,80,80,1)'; ctx.shadowBlur = 6; ctx.fillStyle = '#ff5a5a'; roundRect(ctx, lx - 3, ly - 2, 6, 3, 1); ctx.fill(); ctx.restore();
  a.lights.push([lx, ly - 1, 0xff5a5a]);
  // çatıda kulaklık amblemi
  const [hx, hy] = P(0, 0, 14 + H);
  ctx.beginPath(); ctx.arc(hx, hy, 7, Math.PI * 1.05, Math.PI * 1.95); ctx.strokeStyle = t === 4 ? '#f5c542' : '#4a4a6a'; ctx.lineWidth = 2.2; ctx.stroke();
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + sx * 7, hy + 1, 2.6, 3.4, 0, 0, 7); ctx.fillStyle = sx < 0 ? '#2f6fe0' : '#e0413a'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke(); }
  a.wave = [hx, hy - 4];
  // sessiz koru çitleri (sesi yutan çalılar)
  for (const [u, v] of [[-W / 2 - 6, D / 2 + 2], [-W / 2 - 6, -4]] as const) { const [x, y] = P(u, v, 0); ctx.fillStyle = '#3f7a4e'; ctx.beginPath(); ctx.ellipse(x, y - 4, 5.5, 4.5, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#5fae4a'; ctx.beginPath(); ctx.ellipse(x - 1, y - 5.5, 4, 3, 0, 0, 7); ctx.fill(); }
  // önde odyometre masası (Sv 2+), kulaklık askısı (Sv 3+)
  if (sub >= 1) { box(ctx, W / 2 + 2, D / 2 - 6, 0, 8, 6, 5, { color: 0x8a5a33, pattern: 'plank' }); const [x, y] = P(W / 2 + 6, D / 2 - 3, 6); ctx.fillStyle = '#e8eef6'; roundRect(ctx, x - 3, y - 3, 6, 3, 0.6); ctx.fill(); ctx.fillStyle = '#2ee6d6'; ctx.fillRect(x - 2, y - 2.4, 2, 1); }
  if (sub >= 2) { const [x, y] = P(W / 2 + 4, -D / 2 + 4, 0); lamppost(ctx, x, y, 15, 0xbfe8ff, t === 4); a.lights.push([x, y - 18, 0xbfe8ff]); }
  if (t >= 3) a.lights.push([...P(-W / 2, 0, H * 0.6), 0x7df3ff]);
  if (t === 4) { goldTip(ctx, hx, hy - 8); a.sparkles.push([hx, hy - 14]); }
}

// ---------------------------------------------------------------- Yenidoğan İşitme Tarama Birimi: sıcak pastel klinik + beşik tabelası
function cradleSign(ctx: Ctx, x: number, y: number, s: number, glow: boolean) {
  ctx.save(); if (glow) { ctx.shadowColor = 'rgba(255,180,210,0.95)'; ctx.shadowBlur = 8; }
  ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fillStyle = '#fff6fa'; ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#ff8fb1'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.stroke();
  // ay + küçük kulak
  ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.arc(x - s * 0.25, y - s * 0.1, s * 0.5, 0, 7); ctx.fill(); ctx.fillStyle = '#fff6fa'; ctx.beginPath(); ctx.arc(x - s * 0.05, y - s * 0.25, s * 0.45, 0, 7); ctx.fill();
  earGlyph(ctx, x + s * 0.35, y + s * 0.2, s * 0.8, 0xffb3c6, 0xd9708f, 0.5);
}
function pram(ctx: Ctx, x: number, y: number) {
  ctx.strokeStyle = '#4a3a5a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(x - 3, y - 1.4, 1.4, 0, 7); ctx.arc(x + 4, y - 1.4, 1.4, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 6, y - 7); ctx.quadraticCurveTo(x, y - 1, x + 6, y - 6); ctx.lineTo(x + 6, y - 4); ctx.lineTo(x - 5, y - 4); ctx.closePath(); ctx.fillStyle = '#9fd8ff'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x - 3, y - 7, 4, Math.PI, Math.PI * 1.9); ctx.fillStyle = '#ffb3c6'; ctx.fill(); ctx.stroke();
}
export function tarama(k: Kit, sub: number, a: Anchors) {
  const { ctx, t } = k;
  const s = [0.82, 0.92, 1, 1.07, 1.13][t]!;
  const W = 44 * s, D = 34 * s, H = [16, 20, 23, 26, 28][t]!;
  groundShadow(ctx, -W / 2 - 4, -D / 2 - 4, W + 8, D + 8, H + 24);
  k.plinth(-W / 2 - 4, -D / 2 - 4, W + 8, D + 8, 3);
  const pastel = [0xf6d9c4, 0xf3e6ee, 0xf7e9f0, 0xdfe9f6, 0xfbf3ea][t]!;
  // yan kanat (Sv 7+)
  if (t >= 2) { const fw = k.house(-W / 2 - 12, -D / 2 + 4, 3, 14, D - 10, H * 0.72, { color: pastel, pattern: t >= 3 ? 'plain' : 'brick', alt: shade(pastel, -0.06) }); k.win(fw.left, [4], H * 0.25, 6, H * 0.3, { glow: 0xffe0ec }); hip(ctx, -W / 2 - 13, -D / 2 + 3, 16, D - 8, 3 + H * 0.72, 7, t === 4 ? 0x7651f0 : 0xff9fc2, 'tile', 2); }
  const f = k.house(-W / 2, -D / 2, 3, W, D, H, { color: pastel, pattern: t === 0 ? 'plank' : t === 2 ? 'brick' : 'plain', alt: shade(pastel, -0.06) });
  const trim = t === 4 ? 0xf5c542 : 0xff9fc2;
  k.band(f.left, H - 3, 3, trim); k.band(f.right, H - 3, 3, trim);
  // yuvarlak hatlı sıcak pencereler + kapı
  k.win(f.left, k.spread(W, t >= 2 ? 3 : 2, 6, [W * 0.42, W * 0.62]), H * 0.4, 6, H * 0.36, { glow: 0xffe0ec, arch: true });
  doorOn(ctx, f.left, W * 0.45, 9, Math.min(14, H - 3), 0xd9708f, 0x7a2f4a);
  k.win(f.right, k.spread(D, 2, 5), H * 0.42, 5, H * 0.32, { glow: 0xffe0ec, arch: true });
  // çatı: yumuşak pembe kiremit; Sv 10+ cam ışıklık
  if (t === 3) { box(ctx, -W / 2 - 1, -D / 2 - 1, 3 + H, W + 2, D + 2, 3, { color: 0xdfe9f6, pattern: 'plain' }); const top = dome(ctx, 0, -2, 6 + H, 10, 0x9fd8ff, { glass: true }); a.lights.push([top[0], top[1] + 4, 0xffe0ec]); }
  else gable(ctx, -W / 2, -D / 2, W, D, 3 + H, 13 + t * 2, t === 4 ? 0x7651f0 : 0xff9fc2, t === 0 ? 'thatch' : 'tile', { axis: 'u', oh: 3, wall: { color: pastel, pattern: 'plain' } });
  // beşik/ay tabelası
  const [cx, cy] = P(0, D / 2 - 4, 3 + H + (t === 3 ? 6 : 14 + t * 2));
  cradleSign(ctx, cx, cy - 4, t >= 3 ? 7 : 6, t >= 3);
  a.lights.push([cx, cy - 4, 0xffc4d8]); a.heart = [cx + 12, cy - 6];
  // önde bebek arabası (Sv 2+), çiçek saksısı (Sv 3+)
  if (sub >= 1) { const [x, y] = P(W / 2 + 6, D / 2 + 2, 0); pram(ctx, x, y); }
  if (sub >= 2) { const [x, y] = P(-W / 2 - 4, D / 2 + 6, 0); planter(ctx, x, y); }
  if (t >= 3) { const [x, y] = P(W / 2 + 4, -D / 2 + 4, 0); lamppost(ctx, x, y, 16, 0xffc4d8, t === 4); a.lights.push([x, y - 19, 0xffc4d8]); }
  if (t === 4) { goldTip(ctx, cx, cy - 12); a.sparkles.push([cx, cy - 18]); }
}

// ---------------------------------------------------------------- İşitsel Rehabilitasyon Parkı: çardak, dinleme direkleri, yürüyüş yolu
function chimePost(ctx: Ctx, x: number, y: number, h: number, color: number) {
  ctx.strokeStyle = '#6b3f22'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.lineTo(x + 5, y - h); ctx.stroke();
  for (let i = 0; i < 3; i++) { const cx = x + 1.5 + i * 1.6; const len = 3 + i * 1.5; ctx.strokeStyle = '#4a3a3a'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(cx, y - h); ctx.lineTo(cx, y - h + 1.5); ctx.stroke(); ctx.strokeStyle = css(shade(color, i * 0.15)); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, y - h + 1.5); ctx.lineTo(cx, y - h + 1.5 + len); ctx.stroke(); }
}
function tree(ctx: Ctx, x: number, y: number, s: number, c = 0x5fae4a) {
  ctx.fillStyle = '#6b3f22'; ctx.fillRect(x - 0.8, y - s * 0.9, 1.6, s * 0.9);
  for (const [dx, dy, r, cc] of [[0, -s * 1.4, s * 0.75, c], [-s * 0.35, -s * 1.15, s * 0.5, shade(c, -0.15)], [s * 0.35, -s * 1.2, s * 0.5, shade(c, 0.12)]] as const) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, 7); ctx.fillStyle = css(cc); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.arc(x, y - s * 1.4, s * 0.75, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
}
function bench(ctx: Ctx, x: number, y: number, gold = false) {
  ctx.fillStyle = gold ? '#e6b422' : '#8a5a33'; ctx.beginPath(); ctx.moveTo(x - 6, y - 3); ctx.lineTo(x + 2, y - 7); ctx.lineTo(x + 6, y - 5); ctx.lineTo(x - 2, y - 1); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.fillStyle = gold ? '#c99a1c' : '#6b3f22'; ctx.fillRect(x - 5, y - 3, 1, 3); ctx.fillRect(x + 4.6, y - 5, 1, 3);
  ctx.beginPath(); ctx.moveTo(x - 6, y - 3); ctx.lineTo(x - 6, y - 7); ctx.lineTo(x + 2, y - 11); ctx.lineTo(x + 2, y - 7); ctx.closePath(); ctx.fillStyle = gold ? '#f5c542' : '#a06a3a'; ctx.fill(); ctx.stroke();
}
export function park(k: Kit, sub: number, a: Anchors) {
  const { ctx, t } = k;
  const R = 34;
  ellipseShadow(ctx, 2, 4, R + 6, (R + 6) / 2, 0.22);
  // çim zemin + taş kenar
  ctx.beginPath(); ctx.ellipse(0, 0, R + 2, (R + 2) / 2, 0, 0, 7); ctx.fillStyle = css(t >= 2 ? 0xbfb4a0 : 0x9a8a74); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -1, R, R / 2, 0, 0, 7); const g = ctx.createRadialGradient(-8, -6, 2, 0, 0, R); g.addColorStop(0, '#a6dd78'); g.addColorStop(1, '#5f9f45'); ctx.fillStyle = g; ctx.fill();
  // dinleme yolu: sarmal patika (içe kıvrılan, koklea gibi)
  ctx.beginPath(); for (let i = 0; i <= 80; i++) { const tt = i / 80; const ang = tt * Math.PI * 3.2 + 0.4; const r = R * 0.9 * (1 - tt * 0.75); const x = Math.cos(ang) * r, y = -1 + Math.sin(ang) * r * 0.5; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.strokeStyle = 'rgba(90,60,30,0.35)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = '#e8c690'; ctx.lineWidth = 3.4; ctx.stroke();
  // ağaçlar (arka)
  tree(ctx, -24, -8, 8, 0x4f9a5e); tree(ctx, 22, -10, 7, 0x5fae4a); if (t >= 1) tree(ctx, 2, -16, 9, 0x7cc35a);
  // çardak (Sv 4+): kubbeli, Sv 13 altın
  if (t >= 1) {
    const roofC = [0, 0xc65a38, 0x4a6194, 0x5ce1e6, 0x7651f0][t]!;
    for (const [u, v] of [[-8, -8], [8, -8], [-8, 8], [8, 8]] as const) { const [x, y] = P(u, v, 2); ctx.strokeStyle = t === 4 ? '#e6b422' : '#f4efe6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 16); ctx.stroke(); }
    cyl(ctx, 0, 0, 0, 13, 2, 0xd9c3a0, 'stone', { seed: 2 });
    const top = t >= 3 ? dome(ctx, 0, 0, 18, 13, roofC, { glass: t === 3, ribs: 6, ribColor: t === 4 ? 0xf5c542 : undefined }) : cone(ctx, 0, 0, 17, 15, 12, roofC, shade(roofC, 0.25));
    if (t === 4) goldTip(ctx, top[0], top[1]);
    a.lights.push([P(0, 0, 12)[0], P(0, 0, 12)[1], t >= 3 ? 0x9ff6ff : 0xffd36b]);
    // çardak altında kulak amblemi
    const [ex, ey] = P(0, 0, 8); earGlyph(ctx, ex, ey, 8, 0xffb3a7, 0xd9708f, 0.6);
  } else {
    // ahşap tabela: kulak + nota
    const [x, y] = P(6, 6, 0); signPost(ctx, x, y, 0x5fc46a, t);
  }
  // dinleme direkleri (rüzgâr çanları): Sv 7+
  if (t >= 2) for (const [u, v, c] of [[-22, 14, 0x2ee6d6], [20, 18, 0xff8fb1], [-28, -4, 0xffc93c]] as const) { const [x, y] = P(u, v, 0); chimePost(ctx, x, y, 18, c); }
  // banklar ve çiçekler
  bench(ctx, ...P(-14, 22, 0), t === 4); if (sub >= 1) bench(ctx, ...P(24, 4, 0), t === 4);
  if (sub >= 2) { const [x, y] = P(14, 24, 0); planter(ctx, x, y); }
  if (t >= 3) for (const [u, v] of [[-30, 10], [30, -2]] as const) { const [x, y] = P(u, v, 0); lamppost(ctx, x, y, 16, 0xffd36b, t === 4); a.lights.push([x, y - 19, 0xffd36b]); }
  // nota tabelası: kampın "yardımcıları" burada dinlemeyi çalışır
  a.wave = [P(0, 0, 26)[0], P(0, 0, 26)[1]];
  if (t === 4) a.sparkles.push(P(0, 0, 36), P(-20, 10, 18));
}

// ---------------------------------------------------------------- Vestibüler Laboratuvar: üç yarım daire kanalı heykeli + döner sandalye odası
function canalRings(ctx: Ctx, x: number, y: number, r: number, t: number) {
  const cols = t === 4 ? [0xf5c542, 0xffd66b, 0xe6b422] : t === 3 ? [0x7df3ff, 0x9ff6ff, 0x5ce1e6] : [0x7df3ff, 0x8b6bff, 0x3ccf7e];
  const ring = (rx: number, ry: number, rot: number, c: number) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, 7); ctx.strokeStyle = css(shade(c, -0.35)); ctx.lineWidth = 3.4; ctx.stroke(); ctx.strokeStyle = css(c); ctx.lineWidth = 2.2; ctx.stroke(); };
  ctx.save(); if (t >= 3) { ctx.shadowColor = css(cols[0]!, 0.9); ctx.shadowBlur = 8; }
  ring(r, r * 0.42, 0, cols[0]!); ring(r * 0.42, r, 0.45, cols[1]!); ring(r * 0.95, r * 0.95, 0, cols[2]!);
  ctx.restore();
  ctx.beginPath(); ctx.arc(x, y + r * 0.9, r * 0.3, 0, 7); ctx.fillStyle = '#e8f6ff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
}
export function denge(k: Kit, sub: number, a: Anchors) {
  const { ctx, t, m } = k;
  const s = [0.82, 0.92, 1, 1.07, 1.13][t]!;
  const W = 42 * s, D = 36 * s, H = [16, 20, 24, 27, 29][t]!;
  groundShadow(ctx, -W / 2 - 4, -D / 2 - 4, W + 8, D + 8, H + 34);
  k.plinth(-W / 2 - 4, -D / 2 - 4, W + 8, D + 8, 3);
  // yuvarlak döner sandalye odası (arka sol)
  const rc = t === 0 ? 0xc9b48e : m.wall.color;
  cyl(ctx, -W / 2 + 6, -D / 2 + 6, 3, 11, H + 6, rc, t === 0 ? 'plank' : m.wall.pattern, { top: null, seed: 4 });
  const rt = dome(ctx, -W / 2 + 6, -D / 2 + 6, 9 + H, 11, t === 4 ? 0x7651f0 : t >= 3 ? 0x5ce1e6 : m.roof, { glass: t === 3, ribs: t >= 2 ? 5 : 0, ribColor: t === 4 ? 0xf5c542 : undefined });
  a.gears.push([rt[0], rt[1] + 13, 5]);
  const f = k.house(-W / 2 + 6, -D / 2 + 8, 3, W - 6, D - 8, H);
  if (t >= 2) { k.band(f.left, H - 3, 3, m.trim); k.band(f.right, H - 3, 3, m.trim); }
  k.win(f.left, k.spread(W - 6, 2, 6, [(W - 6) * 0.42, (W - 6) * 0.62]), H * 0.38, 6, H * 0.36, t === 3 ? { glow: 0x7df3ff, cross: false } : {});
  doorOn(ctx, f.left, (W - 6) * 0.44, 9, Math.min(15, H - 3), t >= 3 ? 0x2f4a6e : 0x6b3a1f);
  // kızılötesi göz kamerası ekranı (yan yüz): nistagmus izi
  onFace(ctx, f.right.o, f.right.a, f.right.b, () => {
    const w = (D - 8) * 0.55, h = H * 0.34, x = (D - 8) * 0.22, y = -H * 0.38 - h;
    ctx.fillStyle = '#1f2a3a'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#7df3ff'; ctx.lineWidth = 0.8; ctx.beginPath();
    for (let i = 0; i <= 12; i++) { const xx = x + 1 + (i / 12) * (w - 2); const yy = y + h * 0.5 + (i % 3 === 2 ? -h * 0.32 : h * 0.12 * (i % 3)); if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); } ctx.stroke();
  });
  box(ctx, -W / 2 + 5, -D / 2 + 7, 3 + H, W - 4, D - 6, 2, { color: t === 4 ? 0xf5c542 : shade(m.wall.color, -0.2), pattern: 'plain' });
  // çatıda üç kanal heykeli
  const [rx, ry] = P(4, 4, 5 + H);
  ctx.fillStyle = t === 4 ? '#e6b422' : '#5b5b6b'; ctx.fillRect(rx - 1, ry - 10, 2, 10);
  canalRings(ctx, rx, ry - 22, 10 + t * 1.2, t);
  a.lights.push([rx, ry - 22, t === 4 ? 0xffd66b : 0x7df3ff]);
  // denge çizgisi (önde): çizgi üzerinde yürüme testi
  const [b0, b1] = [P(-W / 2 - 2, D / 2 + 8, 0), P(W / 2 + 2, D / 2 + 8, 0)];
  ctx.strokeStyle = 'rgba(255,240,210,0.9)'; ctx.lineWidth = 1.4; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.moveTo(...b0); ctx.lineTo(...b1); ctx.stroke(); ctx.setLineDash([]);
  if (sub >= 1) { const [x, y] = P(W / 2 + 6, -2, 0); crystal(ctx, x, y - 4, 2.6); a.sparkles.push([x, y - 8]); } // otokonya kristali
  if (sub >= 2) { const [x, y] = P(W / 2 + 4, -D / 2 + 2, 0); lamppost(ctx, x, y, 16, 0x7df3ff, t === 4); a.lights.push([x, y - 19, 0x7df3ff]); }
  if (t === 4) { goldTip(ctx, rx, ry - 36); a.sparkles.push([rx, ry - 40]); }
}

// ---------------------------------------------------------------- Odyoloji Kütüphanesi: sütunlu cephe, kubbe, kitap yığınları
function books(ctx: Ctx, x: number, y: number, n: number) {
  const cols = [0xff5c8a, 0x2ee6d6, 0xffc93c, 0x8b6bff, 0x3ccf7e];
  for (let i = 0; i < n; i++) { ctx.fillStyle = css(cols[i % cols.length]!); ctx.fillRect(x - 4 + (i % 2) * 0.6, y - 2 - i * 1.8, 8, 1.6); ctx.strokeStyle = INK; ctx.lineWidth = 0.3; ctx.strokeRect(x - 4 + (i % 2) * 0.6, y - 2 - i * 1.8, 8, 1.6); }
}
function openBook(ctx: Ctx, x: number, y: number, s: number, glow: boolean) {
  ctx.save(); if (glow) { ctx.shadowColor = 'rgba(255,230,150,1)'; ctx.shadowBlur = 8; }
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.3, x - s, y - s * 0.1); ctx.lineTo(x - s, y - s * 0.8); ctx.quadraticCurveTo(x - s * 0.5, y - s, x, y - s * 0.7); ctx.closePath(); ctx.fillStyle = '#fffaf0'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.3, x + s, y - s * 0.1); ctx.lineTo(x + s, y - s * 0.8); ctx.quadraticCurveTo(x + s * 0.5, y - s, x, y - s * 0.7); ctx.closePath(); ctx.fillStyle = '#f3ead8'; ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#8a5a33'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - s * 0.7); ctx.stroke();
  ctx.strokeStyle = 'rgba(90,70,60,0.5)'; ctx.lineWidth = 0.4; for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(x - s * 0.85, y - s * 0.2 - i * s * 0.14); ctx.lineTo(x - s * 0.15, y - s * 0.12 - i * s * 0.14); ctx.moveTo(x + s * 0.15, y - s * 0.12 - i * s * 0.14); ctx.lineTo(x + s * 0.85, y - s * 0.2 - i * s * 0.14); ctx.stroke(); }
}
export function kutuphane(k: Kit, sub: number, a: Anchors) {
  const { ctx, t, m } = k;
  const s = [0.82, 0.92, 1, 1.07, 1.14][t]!;
  const W = 46 * s, D = 36 * s, H = [16, 21, 25, 28, 31][t]!;
  groundShadow(ctx, -W / 2 - 4, -D / 2 - 4, W + 8, D + 8, H + 30);
  k.plinth(-W / 2 - 5, -D / 2 - 5, W + 10, D + 10, 4);
  const wall = t === 0 ? { color: 0xc98e55, pattern: 'log' as const } : t === 4 ? { color: 0xf6efe4, pattern: 'marble' as const } : m.wall;
  const f = k.house(-W / 2, -D / 2, 4, W, D, H, wall);
  k.win(f.right, k.spread(D, 3, 4), H * 0.35, 4, H * 0.45, { arch: true, glow: 0xffe0a0 });
  if (t >= 2) {
    // sütunlu giriş + alınlık
    for (let i = 0; i < 4; i++) colonnade(ctx, f.left, 3 + i * (W - 8) / 3, 3, H - 2);
    const [x0, y0] = P(-W / 2, D / 2, 4 + H), [x1, y1] = P(W / 2, D / 2, 4 + H);
    ctx.beginPath(); ctx.moveTo(x0 - 2, y0); ctx.lineTo((x0 + x1) / 2, (y0 + y1) / 2 - 10); ctx.lineTo(x1 + 2, y1); ctx.closePath(); ctx.fillStyle = css(t === 4 ? 0xfaf3e6 : shade(m.wall.color, 0.1)); ctx.fill(); ctx.strokeStyle = t === 4 ? '#f5c542' : INK; ctx.lineWidth = 0.9; ctx.stroke();
    openBook(ctx, (x0 + x1) / 2, (y0 + y1) / 2 - 2, 4, t >= 3);
    doorOn(ctx, f.left, W * 0.42, 9, Math.min(15, H - 3), 0x6b3a1f, 0x3a2010);
  } else {
    k.win(f.left, k.spread(W, 2, 6, [W * 0.4, W * 0.62]), H * 0.4, 6, H * 0.36, { glow: 0xffe0a0 });
    doorOn(ctx, f.left, W * 0.44, 9, Math.min(14, H - 3), 0x6b3a1f, 0x3a2010);
  }
  // çatı: Sv 1-6 beşik; Sv 7+ kubbe (okuma salonu)
  if (t <= 1) gable(ctx, -W / 2, -D / 2, W, D, 4 + H, 14 + t * 2, m.roof, m.roofPat, { axis: 'v', oh: 3, wall });
  else {
    box(ctx, -W / 2 - 1, -D / 2 - 1, 4 + H, W + 2, D + 2, 3, { color: t === 4 ? 0xf5c542 : shade(m.wall.color, -0.15), pattern: 'plain' });
    cyl(ctx, 0, -4, 7 + H, 12, 5, t === 4 ? 0xf6efe4 : m.wall.color, t === 4 ? 'marble' : m.wall.pattern, { seed: 3 });
    const top = dome(ctx, 0, -4, 12 + H, 12, t === 4 ? 0x7651f0 : t === 3 ? 0x5ce1e6 : 0x4a6194, { glass: t === 3, ribs: 8, ribColor: t === 4 ? 0xf5c542 : undefined });
    a.lights.push([top[0], top[1] + 6, 0xffe0a0]);
    if (t === 4) { goldTip(ctx, top[0], top[1]); a.sparkles.push([top[0], top[1] - 8]); }
  }
  // okuma köşesi: kitap yığınları, kitap arabası, fener
  const [bx, by] = P(W / 2 + 6, D / 2 - 2, 0); books(ctx, bx, by, 3 + Math.min(3, t));
  if (sub >= 1) { const [x, y] = P(-W / 2 - 6, D / 2 + 4, 0); books(ctx, x, y, 4); lantern(ctx, x - 6, y + 2, 12); a.lights.push([x - 3, y - 8, 0xffc14d]); }
  if (sub >= 2) { const [x, y] = P(W / 2 + 4, -D / 2 + 4, 0); lamppost(ctx, x, y, 16, 0xffe0a0, t === 4); a.lights.push([x, y - 19, 0xffe0a0]); }
  if (t >= 3) { const [x, y] = P(-W / 2 - 2, -D / 2 + 8, 0); banner(ctx, x, y - 24, 7, 12, 0x8b6bff, t === 4 ? 0xf5c542 : 0xfff6e5); ctx.fillStyle = '#5b3a24'; ctx.fillRect(x - 0.5, y - 25, 1, 25); }
}

// ---------------------------------------------------------------- her seviyede bir ekleme (Sv 2–25) — binanın çevresine, arsanın kenarına
type G = (ctx: Ctx, x: number, y: number, a: Anchors, gold: boolean) => void;
const potG: G = (ctx, x, y) => planter(ctx, x, y);
const lanternG: G = (ctx, x, y, a, gold) => { lantern(ctx, x, y, 13, gold); a.lights.push([x + 3, y - 10, 0xffc14d]); };
const benchG: G = (ctx, x, y, _a, gold) => bench(ctx, x, y, gold);
const bedG: G = (ctx, x, y) => { ctx.fillStyle = '#6b4226'; ctx.beginPath(); ctx.ellipse(x, y - 1, 7, 3, 0, 0, 7); ctx.fill(); for (const [dx, c] of [[-4, 0xff8fb1], [-1.5, 0xffc93c], [1.5, 0x8b6bff], [4, 0x2ee6d6]] as const) { ctx.fillStyle = css(c); ctx.beginPath(); ctx.arc(x + dx, y - 2.5, 1.5, 0, 7); ctx.fill(); } };
const flagG: G = (ctx, x, y, _a, gold) => flag(ctx, x, y, 22, gold ? 0xf5c542 : 0xff5c8a, { w: 10 });
const bushG: G = (ctx, x, y) => { for (const dx of [-3, 3]) { ctx.fillStyle = '#3f7a4e'; ctx.beginPath(); ctx.ellipse(x + dx, y - 3, 4, 3.4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#6fb34f'; ctx.beginPath(); ctx.ellipse(x + dx - 0.8, y - 4.2, 2.6, 2, 0, 0, 7); ctx.fill(); } };
const signG: G = (ctx, x, y, _a, gold) => signPost(ctx, x, y, gold ? 0xf5c542 : 0x2ee6d6, gold ? 4 : 1);
const lampG: G = (ctx, x, y, a, gold) => { lamppost(ctx, x, y, 17, 0xffd36b, gold); a.lights.push([x, y - 20, 0xffd36b]); };
const statueG: G = (ctx, x, y, _a, gold) => { ctx.fillStyle = '#d9cdb8'; ctx.fillRect(x - 3, y - 6, 6, 6); ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.strokeRect(x - 3, y - 6, 6, 6); earGlyph(ctx, x, y - 12, 9, gold ? 0xf5c542 : 0xe8dfcf, gold ? 0xb8860b : 0xa89e8a, 0.6); };
const bannerG: G = (ctx, x, y, _a, gold) => { ctx.fillStyle = '#5b3a24'; ctx.fillRect(x - 0.5, y - 24, 1, 24); banner(ctx, x, y - 23, 6, 11, gold ? 0x7651f0 : 0x2ee6d6, gold ? 0xf5c542 : 0xfff6e5); };
const lanternsG: G = (ctx, x, y, a, gold) => { for (const dx of [-3, 3]) { lantern(ctx, x + dx, y, 11, gold); a.lights.push([x + dx + 3, y - 8, 0xffc14d]); } };
const fountainG: G = (ctx, x, y) => { ctx.fillStyle = '#9a8a74'; ctx.beginPath(); ctx.ellipse(x, y - 1, 7, 3.4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#4fc6e0'; ctx.beginPath(); ctx.ellipse(x, y - 1.6, 5.6, 2.6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#d9cdb8'; ctx.fillRect(x - 0.8, y - 7, 1.6, 5); ctx.fillStyle = 'rgba(200,250,255,0.9)'; ctx.beginPath(); ctx.arc(x, y - 8, 1.6, 0, 7); ctx.fill(); };
const archG: G = (ctx, x, y) => { ctx.strokeStyle = '#3f7a4e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 6, 6, Math.PI, 0); ctx.stroke(); ctx.fillStyle = '#ff8fb1'; for (const a2 of [Math.PI * 1.2, Math.PI * 1.5, Math.PI * 1.8]) { ctx.beginPath(); ctx.arc(x + Math.cos(a2) * 6, y - 6 + Math.sin(a2) * 6, 1.2, 0, 7); ctx.fill(); } };
const goldFlagG: G = (ctx, x, y) => flag(ctx, x, y, 28, 0xf5c542, { w: 12, emblem: 0xffffff });
/** Sv 2..15: her seviyenin eklemesi ve yeri (arsa birimi): binanın önündeki iki kenarda ve yan köşelerde — hep görünür */
const GARNISH: { g: G; u: number; v: number }[] = [
  { g: potG, u: -1.0, v: 1.2 }, { g: lanternG, u: 1.2, v: -1.0 }, { g: benchG, u: -0.62, v: 1.24 }, { g: bedG, u: 1.24, v: -0.62 },
  { g: flagG, u: -1.25, v: 0.72 }, { g: bushG, u: 0.72, v: -1.25 }, { g: signG, u: -0.25, v: 1.24 }, { g: lampG, u: 1.24, v: -0.25 },
  { g: statueG, u: -1.3, v: 0.3 }, { g: bannerG, u: 0.3, v: -1.3 }, { g: lanternsG, u: 0.12, v: 1.26 }, { g: fountainG, u: 1.28, v: 0.14 },
  { g: archG, u: -1.38, v: 1.05 }, { g: goldFlagG, u: 1.05, v: -1.38 },
];
/** her seviyede küçük bir ekleme (Sv 2–15). Hepsi ön kenarlarda: binanın önünde kalır, sonra boyanır. */
export function garnish(ctx: Ctx, level: number, half: number, a: Anchors, front: boolean) {
  if (!front) return;
  const items = GARNISH.map((it, i) => ({ ...it, l: i + 2 })).filter((it) => it.l <= Math.min(15, level)).sort((p, q) => (p.u + p.v) - (q.u + q.v));
  for (const it of items) { const [x, y] = P(it.u * half, it.v * half, 0); it.g(ctx, x, y, a, level >= 13); }
}

// ---------------------------------------------------------------- Sv 16–25: Kristal ve Efsane kademeleri
/** zemindeki ışık halkası (binanın altına, ilk) */
export function prestigeGround(ctx: Ctx, level: number, half: number) {
  if (level < 16) return;
  const epic = level >= 21; const r = half * 1.25;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r); g.addColorStop(0, epic ? 'rgba(255,214,107,0.32)' : 'rgba(150,120,255,0.3)'); g.addColorStop(1, 'rgba(120,255,240,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.2, r * 0.6, 0, 0, 7); ctx.fill(); ctx.restore();
  ctx.strokeStyle = epic ? 'rgba(255,214,107,0.8)' : 'rgba(180,150,255,0.75)'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * 0.52, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
}
/** binanın üstüne: Sv 16–19 köşelerde birer kristal sütun daha, Sv 20 süzülen kristal; Efsane (21–25): flamalar, altın kulak, kanatlar, notalar, taç */
export function prestigeTop(ctx: Ctx, level: number, half: number, a: Anchors, topZ = 78) {
  if (level < 16) return;
  const epic = level >= 21;
  const n = Math.min(4, level - 15);
  const spots: [number, number][] = [[-1.1, 1.1], [1.1, -1.1], [1.25, 1.25], [-1.25, -1.25]];
  for (let i = 0; i < n; i++) { const [u, v] = spots[i]!; const [x, y] = P(u * half, v * half, 0); crystal(ctx, x, y, 6 + (level - 16) * 0.5); crystal(ctx, x - 5, y + 2, 3); a.lights.push([x, y - 8, epic ? 0xffd66b : 0xb49bff]); }
  const [tx, ty] = P(0, 0, topZ);
  if (level >= 20) { // süzülen kristal + halkası
    ctx.save(); ctx.shadowColor = 'rgba(180,140,255,0.95)'; ctx.shadowBlur = 12; crystal(ctx, tx, ty, 9); ctx.restore();
    ctx.strokeStyle = 'rgba(216,200,255,0.9)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(tx, ty - 4, 16, 5, 0, 0, 7); ctx.stroke(); a.lights.push([tx, ty - 6, 0xb49bff]);
  }
  if (level >= 21) { // flamalar
    const [x0, y0] = P(-half * 1.2, half * 1.2, 22), [x1, y1] = P(half * 1.2, -half * 1.2, 22);
    ctx.strokeStyle = 'rgba(80,50,30,0.7)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 30, x1, y1); ctx.stroke();
    const cols = [0xff5c8a, 0xff9f1c, 0xffc93c, 0x3ccf7e, 0x2ee6d6, 0x8b6bff];
    for (let i = 1; i < 14; i++) { const tt = i / 14; const x = (1 - tt) ** 2 * x0 + 2 * (1 - tt) * tt * ((x0 + x1) / 2) + tt * tt * x1, y = (1 - tt) ** 2 * y0 + 2 * (1 - tt) * tt * ((y0 + y1) / 2 + 30) + tt * tt * y1; ctx.fillStyle = css(cols[i % cols.length]!); ctx.beginPath(); ctx.moveTo(x - 2.4, y); ctx.lineTo(x + 2.4, y); ctx.lineTo(x, y + 5); ctx.closePath(); ctx.fill(); }
  }
  if (level >= 22) { ctx.save(); ctx.shadowColor = 'rgba(255,214,107,0.95)'; ctx.shadowBlur = 10; earGlyph(ctx, tx, ty - 26, 22, 0xf5c542, 0xb8860b, 0.8); ctx.restore(); a.sparkles.push([tx + 12, ty - 36]); }
  if (level >= 23) for (const s of [-1, 1] as const) { const [x, y] = P(s < 0 ? -half * 1.3 : half * 0.2, s < 0 ? half * 0.2 : -half * 1.3, 30); ctx.save(); ctx.translate(x, y); ctx.scale(s * 1.2, 1.2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(10, -8, 22, -22, 30, -36); ctx.bezierCurveTo(20, -30, 14, -28, 6, -24); ctx.bezierCurveTo(14, -20, 18, -14, 20, -8); ctx.bezierCurveTo(12, -8, 6, -4, 0, 0); const g = ctx.createLinearGradient(0, 0, 30, -36); g.addColorStop(0, '#fff3b0'); g.addColorStop(1, '#d9a400'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(120,80,0,0.6)'; ctx.lineWidth = 0.6; ctx.stroke(); ctx.restore(); }
  if (level >= 24) for (let i = 0; i < 6; i++) { const t = (i / 6) * Math.PI * 2; const nx = tx + Math.cos(t) * 34, ny = ty - 24 + Math.sin(t) * 10; ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.ellipse(nx, ny, 3.4, 2.6, -0.4, 0, 7); ctx.fill(); ctx.fillRect(nx + 2.6, ny - 10, 1.4, 10); }
  if (level >= 25) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(tx, ty - 50, 2, tx, ty - 50, 40); g.addColorStop(0, 'rgba(255,240,170,0.8)'); g.addColorStop(1, 'rgba(255,200,100,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tx, ty - 50, 40, 0, 7); ctx.fill(); ctx.restore(); ctx.fillStyle = '#f5c542'; ctx.beginPath(); ctx.moveTo(tx - 9, ty - 46); ctx.lineTo(tx - 9, ty - 54); ctx.lineTo(tx - 4, ty - 50); ctx.lineTo(tx, ty - 57); ctx.lineTo(tx + 4, ty - 50); ctx.lineTo(tx + 9, ty - 54); ctx.lineTo(tx + 9, ty - 46); ctx.closePath(); ctx.fill(); a.lights.push([tx, ty - 50, 0xffe680]); }
  if (epic) for (let i = 0; i < level - 20; i++) a.sparkles.push(P((i % 2 ? 1 : -1) * half * 0.5, (i % 3 - 1) * half * 0.4, 30 + i * 4));
}


// ---------------------------------------------------------------- Odyoloji Merkezi: HER seviyede yeni bir büyük parça (Sv 2–25)
/**
 * Merkez her seviyede tanınır biçimde değişir: kademe değişimi (Sv 4/7/10/13/16/21) mimariyi değiştirir, aradaki her seviye
 * meydana büyük, uzaktan seçilen bir parça ekler (diyapazon kulesi, odyogram panosu, saat kulesi, kanatlar, çeşme, kapı…).
 * Parçalar birikir ve o anki kademenin malzemesiyle çizilir (kanatlar Sv 10'da metale, Sv 13'te altına döner).
 */
type MX = (k: Kit, a: Anchors, level: number) => void;
const gold = (k: Kit) => k.t >= 4;
const at = (u: number, v: number, z = 0) => P(u, v, z);
/** diyapazon kulesi (arka sol): ince taş kule, tepesinde dev diyapazon */
const mxSpire: MX = (k, a) => {
  const { ctx } = k; const top = k.tower(-58, -10, 0, 7, 64, 'flat', { color: k.t >= 3 ? 0x93a8be : 0xcfc4ad, pat: k.t >= 3 ? 'metal' : 'stone' });
  const c = gold(k) ? 0xf5c542 : 0xb9c3d6; const [x, y] = [top[0], top[1] - 2];
  ctx.strokeStyle = css(c); ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 10); ctx.moveTo(x - 7, y - 34); ctx.lineTo(x - 7, y - 16); ctx.quadraticCurveTo(x - 7, y - 10, x, y - 10); ctx.quadraticCurveTo(x + 7, y - 10, x + 7, y - 16); ctx.lineTo(x + 7, y - 34); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke();
  a.wave = [x, y - 26]; a.lights.push([x, y - 36, gold(k) ? 0xffd66b : 0x9ff6ff]);
};
/** odyogram panosu (ön sol): büyük tabela, kırmızı O ve mavi X eğrileri */
const mxBoard: MX = (k, a) => {
  const { ctx } = k; const [x, y] = at(-8, 82);
  ctx.fillStyle = '#5b3a24'; ctx.fillRect(x - 13, y - 26, 2, 26); ctx.fillRect(x + 11, y - 26, 2, 26);
  roundRect(ctx, x - 16, y - 46, 32, 22, 2); ctx.fillStyle = k.t >= 3 ? '#1f2a3a' : '#fffaf0'; ctx.fill(); ctx.strokeStyle = gold(k) ? '#f5c542' : '#5b3a24'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.strokeStyle = k.t >= 3 ? 'rgba(125,243,255,0.35)' : 'rgba(80,60,40,0.25)'; ctx.lineWidth = 0.4; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x - 14, y - 46 + i * 4.4); ctx.lineTo(x + 14, y - 46 + i * 4.4); ctx.stroke(); }
  const pts = [[-12, -42], [-6, -40], [0, -37], [6, -33], [12, -30]];
  ctx.lineWidth = 1; ctx.strokeStyle = '#e0413a'; ctx.beginPath(); pts.forEach(([dx, dy], i) => (i ? ctx.lineTo(x + dx!, y + dy!) : ctx.moveTo(x + dx!, y + dy!))); ctx.stroke();
  ctx.strokeStyle = '#3b7bff'; ctx.beginPath(); pts.forEach(([dx, dy], i) => (i ? ctx.lineTo(x + dx!, y + dy! + 5) : ctx.moveTo(x + dx!, y + dy! + 5))); ctx.stroke();
  for (const [dx, dy] of pts) { ctx.strokeStyle = '#e0413a'; ctx.beginPath(); ctx.arc(x + dx!, y + dy!, 1.3, 0, 7); ctx.stroke(); ctx.strokeStyle = '#3b7bff'; ctx.beginPath(); ctx.moveTo(x + dx! - 1.2, y + dy! + 3.8); ctx.lineTo(x + dx! + 1.2, y + dy! + 6.2); ctx.moveTo(x + dx! + 1.2, y + dy! + 3.8); ctx.lineTo(x + dx! - 1.2, y + dy! + 6.2); ctx.stroke(); }
  if (k.t >= 3) a.lights.push([x, y - 35, 0x7df3ff]);
};
/** kulak çeşmesi (ön sağ) */
const mxFountain: MX = (k, a) => {
  const { ctx } = k; const [x, y] = at(84, 18);
  ellipseShadow(ctx, x, y + 2, 20, 9, 0.25);
  ctx.beginPath(); ctx.ellipse(x, y, 19, 9.5, 0, 0, 7); ctx.fillStyle = gold(k) ? '#f3e2b8' : '#cfc4ad'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x, y - 1.5, 16, 7.5, 0, 0, 7); const w = ctx.createRadialGradient(x - 4, y - 4, 1, x, y, 16); w.addColorStop(0, '#9ff3ff'); w.addColorStop(1, '#2f8fc8'); ctx.fillStyle = w; ctx.fill();
  ctx.fillStyle = gold(k) ? '#f5c542' : '#d9cdb8'; ctx.fillRect(x - 2, y - 16, 4, 14);
  earGlyph(ctx, x, y - 22, 14, gold(k) ? 0xf5c542 : 0xffb3a7, gold(k) ? 0xb8860b : 0xd9708f, 0.7);
  ctx.strokeStyle = 'rgba(200,250,255,0.85)'; ctx.lineWidth = 1.2; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * 3, y - 26); ctx.quadraticCurveTo(x + s * 12, y - 30, x + s * 13, y - 4); ctx.stroke(); }
  a.sparkles.push([x, y - 30]);
};
/** yan kanat (sol ya da sağ): kademenin malzemesiyle iki katlı ek bina */
function wing(k: Kit, a: Anchors, u: number, v: number, axis: 'u' | 'v') {
  const { ctx, m } = k; const w = axis === 'u' ? 26 : 20, d = axis === 'u' ? 20 : 26, h = 18 + k.t * 3;
  const f = k.house(u - w / 2, v - d / 2, 0, w, d, h);
  if (k.t >= 2) { k.band(f.left, h - 3, 3, m.trim); k.band(f.right, h - 3, 3, m.trim); }
  k.win(f.left, k.spread(w, 2, 5), h * 0.45, 5, h * 0.3, k.t === 3 ? { glow: 0x7df3ff, cross: false } : {}); k.win(f.right, k.spread(d, 2, 5), h * 0.45, 5, h * 0.3, k.t === 3 ? { glow: 0x7df3ff, cross: false } : {});
  if (k.t === 3) box(ctx, u - w / 2 - 1, v - d / 2 - 1, h, w + 2, d + 2, 3, { color: m.trim, pattern: 'plain' });
  else gable(ctx, u - w / 2, v - d / 2, w, d, h, 10 + k.t * 2, m.roof, m.roofPat, { axis, oh: 2, wall: m.wall });
  const [lx, ly] = P(u, v + d / 2, h * 0.5); a.lights.push([lx, ly, k.t >= 3 ? 0x7df3ff : 0xffc14d]);
}
const mxWingL: MX = (k, a) => wing(k, a, -26, 70, 'u');
const mxWingR: MX = (k, a) => wing(k, a, 70, -26, 'v');
/** saat kulesi (arka sağ): kadranı bir odyogram */
const mxClock: MX = (k, a) => {
  const { ctx } = k; const top = k.tower(-10, -60, 0, 9, 80, k.t >= 3 ? 'flat' : 'cone', { roofH: 22 });
  const [x, y] = P(-10, -60, 62);
  ctx.beginPath(); ctx.arc(x + 2, y, 7, 0, 7); ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.strokeStyle = gold(k) ? '#f5c542' : '#5b3a24'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.strokeStyle = '#e0413a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x - 3, y - 2); ctx.lineTo(x + 1, y); ctx.lineTo(x + 6, y + 3); ctx.stroke();
  ctx.strokeStyle = '#2d1d6e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + 2, y - 5); ctx.moveTo(x + 2, y); ctx.lineTo(x + 5, y); ctx.stroke();
  if (k.t >= 3) { antenna(ctx, top[0], top[1], 14, 0x5b5b6b); a.lights.push([top[0], top[1] - 14, 0xff5c8a]); }
  else a.flag = a.flag ?? [top[0], top[1]];
  a.lights.push([x + 2, y, 0xfff0c0]);
};
/** giriş kapısı (ön orta): iki direk + kemer + flamalar */
const mxGate: MX = (k, a) => {
  const { ctx } = k; const [x0, y0] = at(54, 76), [x1, y1] = at(76, 54);
  for (const [x, y] of [[x0, y0], [x1, y1]] as const) { ctx.fillStyle = gold(k) ? '#f5c542' : k.t >= 3 ? '#93a8be' : '#cfc4ad'; ctx.fillRect(x - 2.5, y - 30, 5, 30); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.strokeRect(x - 2.5, y - 30, 5, 30); }
  ctx.beginPath(); ctx.moveTo(x0, y0 - 30); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - 46, x1, y1 - 30); ctx.strokeStyle = css(gold(k) ? 0xf5c542 : 0xff5c8a); ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
  earGlyph(ctx, (x0 + x1) / 2, (y0 + y1) / 2 - 40, 10, 0xffd0d8, 0xff5c8a, 0.6);
  for (const [x, y] of [[x0, y0], [x1, y1]] as const) banner(ctx, x, y - 26, 6, 12, k.m.flag, gold(k) ? 0xf5c542 : 0xfff6e5);
  a.lights.push([(x0 + x1) / 2, (y0 + y1) / 2 - 40, 0xffd36b]);
};
/** çanak anten dizisi (arka orta): ABR/kayıt merkezi */
const mxDish: MX = (k, a) => {
  const { ctx } = k; const [x, y] = at(-84, -24, 0);
  ctx.fillStyle = '#5d6d82'; ctx.fillRect(x - 2.5, y - 84, 5, 84); for (let i = 1; i < 6; i++) { ctx.strokeStyle = '#4a5870'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x - 6, y - i * 14); ctx.lineTo(x + 6, y - i * 14 - 7); ctx.stroke(); }
  dish(ctx, x, y - 92, 26); a.lights.push([x + 6, y - 116, 0xff5c8a]);
};
/** gözlem kubbesi (en sol) */
const mxObservatory: MX = (k, a) => {
  const { ctx } = k; cyl(ctx, -54, 54, 0, 13, 16, k.t >= 3 ? 0x93a8be : k.m.wall.color, k.t >= 3 ? 'metal' : k.m.wall.pattern, { seed: 6 });
  const top = dome(ctx, -54, 54, 16, 13, gold(k) ? 0x7651f0 : 0x5ce1e6, { glass: true, ribs: 5, ribColor: gold(k) ? 0xf5c542 : undefined });
  ctx.strokeStyle = '#3b3b4b'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(top[0], top[1] + 6); ctx.lineTo(top[0] - 9, top[1] - 4); ctx.stroke();
  a.lights.push([top[0], top[1] + 6, 0x9ff6ff]);
};
/** tüy hücresi ekibi heykelleri (en sağ): üç tüy hücresi, basamaklı tüyleriyle */
const mxStaff: MX = (k, a) => {
  const { ctx } = k;
  for (let i = 0; i < 3; i++) {
    const [x0, y0] = at(30 + i * 9, 88 - i * 3);
    ctx.save(); ctx.translate(x0, y0); ctx.scale(1.7, 1.7); const x = 0, y = 0;
    ctx.fillStyle = 'rgba(28,12,48,0.25)'; ctx.beginPath(); ctx.ellipse(x + 2, y, 6, 2.6, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.bezierCurveTo(x - 6, y - 10, x - 5, y - 18, x, y - 20); ctx.bezierCurveTo(x + 5, y - 18, x + 6, y - 10, x + 4, y); ctx.closePath();
    const g = ctx.createLinearGradient(x - 5, 0, x + 5, 0); g.addColorStop(0, gold(k) ? '#ffe9a0' : '#fff6d0'); g.addColorStop(1, gold(k) ? '#d9a400' : '#e0b84a'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.fillStyle = '#2d1d6e'; ctx.beginPath(); ctx.arc(x - 1.6, y - 12, 0.8, 0, 7); ctx.arc(x + 1.6, y - 12, 0.8, 0, 7); ctx.fill();
    for (let j = 0; j < 4; j++) { ctx.strokeStyle = '#fff3a0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 3 + j * 2, y - 19); ctx.lineTo(x - 2.6 + j * 2, y - 22 - j * 1.6); ctx.stroke(); }
    ctx.restore();
  }
  a.sparkles.push(at(64, -46, 24));
};
/** Kristal: ön köşelerde kristal dikilitaşlar */
const mxObelisk: MX = (k, a) => { const { ctx } = k; for (const [u, v] of [[16, 98], [98, 16]] as const) { const [x, y] = at(u, v); crystal(ctx, x, y - 4, 14); crystal(ctx, x - 8, y + 1, 7); crystal(ctx, x + 8, y + 1, 6); a.lights.push([x, y - 12, 0xb49bff]); } };
/** Kristal: çatının üstünde süzülen kristal halka */
const mxRing: MX = (k, a) => { const { ctx } = k; const [x, y] = at(0, 0, 150); ctx.save(); ctx.shadowColor = 'rgba(180,140,255,0.95)'; ctx.shadowBlur = 12; ctx.strokeStyle = '#d8c8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, 30, 9, 0, 0, 7); ctx.stroke(); ctx.restore(); for (let i = 0; i < 6; i++) { const t = (i / 6) * Math.PI * 2; crystal(ctx, x + Math.cos(t) * 30, y + Math.sin(t) * 9 + 3, 2.2); } a.lights.push([x, y, 0xb49bff]); };
/** Kristal: iki kulenin tepesinden göğe ışık sütunları */
const mxBeams: MX = (k, a) => { const { ctx } = k; ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [u, v, z] of [[-58, -10, 100], [-10, -60, 112]] as const) { const [x, y] = at(u, v, z); const g = ctx.createLinearGradient(0, y, 0, y - 90); g.addColorStop(0, 'rgba(125,243,255,0.55)'); g.addColorStop(1, 'rgba(125,243,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - 4, y - 90, 8, 90); a.lights.push([x, y - 6, 0x7df3ff]); } ctx.restore(); };
/** Kristal: çanak antenin yerinde kristal küre */
const mxOrb: MX = (k, a) => { const { ctx } = k; const [x, y] = at(-84, -24, 150); ctx.save(); ctx.shadowColor = 'rgba(180,140,255,1)'; ctx.shadowBlur = 16; const g = ctx.createRadialGradient(x - 6, y - 6, 1, x, y, 20); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#b49bff'); g.addColorStop(1, '#6c4cf1'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 18, 0, 7); ctx.fill(); ctx.restore(); ctx.strokeStyle = 'rgba(216,200,255,0.9)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(x, y, 28, 8, -0.3, 0, 7); ctx.stroke(); a.lights.push([x, y, 0xb49bff]); a.sparkles.push([x + 8, y - 10]); };
/** Kristal: arkada dev kristal sivri kule */
const mxCrystalSpire: MX = (k, a) => { const { ctx } = k; const [x, y] = at(-24, -100, 0); crystal(ctx, x, y - 40, 34); crystal(ctx, x - 22, y - 10, 16); crystal(ctx, x + 20, y - 8, 14); a.lights.push([x, y - 50, 0xb49bff]); a.sparkles.push([x, y - 66]); };
/** Efsane: en arkada altın kulak kolossu */
const mxColossus: MX = (k, a) => { const { ctx } = k; const [x, y] = at(-112, -36, 0); ctx.save(); ctx.shadowColor = 'rgba(255,214,107,0.9)'; ctx.shadowBlur = 14; ctx.translate(x, y - 70); ctx.scale(3.2, 3.2); earGlyph(ctx, 0, 0, 20, 0xf5c542, 0xb8860b, 0.5); ctx.restore(); a.sparkles.push([x - 20, y - 110], [x + 18, y - 90]); a.lights.push([x, y - 74, 0xffd66b]); };
/** Efsane: kapının üstünde gökkuşağı kemeri */
const mxRainbow: MX = (k) => { const { ctx } = k; const [x0, y0] = at(54, 76), [x1, y1] = at(76, 54); const cols = ['#ff5c8a', '#ff9f1c', '#ffc93c', '#3ccf7e', '#2ee6d6', '#8b6bff']; cols.forEach((c, i) => { ctx.beginPath(); ctx.moveTo(x0 - 40 + i * 4, y0 + 4); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - 120 + i * 4.5, x1 + 40 - i * 4, y1 + 4); ctx.strokeStyle = c; ctx.lineWidth = 4.4; ctx.stroke(); }); };
/** Efsane: iki kanadın üstünde altın kanatlar (kulak kepçesi kıvrımlı) */
const mxGoldWings: MX = (k, a) => { const { ctx } = k; for (const [u, v, s] of [[-26, 70, -1], [70, -26, 1]] as const) { const [x, y] = at(u, v, 44); ctx.save(); ctx.translate(x, y); ctx.scale(s * 2, 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(10, -8, 22, -22, 30, -36); ctx.bezierCurveTo(20, -30, 14, -28, 6, -24); ctx.bezierCurveTo(14, -20, 18, -14, 20, -8); ctx.bezierCurveTo(12, -8, 6, -4, 0, 0); const g = ctx.createLinearGradient(0, 0, 30, -36); g.addColorStop(0, '#fff3b0'); g.addColorStop(1, '#d9a400'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(120,80,0,0.6)'; ctx.lineWidth = 0.7; ctx.stroke(); ctx.restore(); a.sparkles.push([x + s * 48, y - 60]); } };
/** Efsane: tepede dönen altın notalar çemberi */
const mxNotes: MX = (k, a) => { const { ctx } = k; const [x, y] = at(0, 0, 120); for (let i = 0; i < 8; i++) { const t = (i / 8) * Math.PI * 2; const nx = x + Math.cos(t) * 78, ny = y + Math.sin(t) * 24; ctx.save(); ctx.shadowColor = 'rgba(255,214,107,0.9)'; ctx.shadowBlur = 8; ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.ellipse(nx, ny, 5.2, 4, -0.4, 0, 7); ctx.fill(); ctx.fillRect(nx + 4, ny - 16, 2, 16); ctx.beginPath(); ctx.moveTo(nx + 6, ny - 16); ctx.quadraticCurveTo(nx + 13, ny - 12, nx + 11, ny - 6); ctx.lineWidth = 1.6; ctx.strokeStyle = '#ffd24a'; ctx.stroke(); ctx.restore(); } a.lights.push([x, y, 0xffd66b]); };
/** Efsane: işitme feneri — dev ışık hüzmesi ve taç */
const mxBeacon: MX = (k, a) => { const { ctx } = k; const [x, y] = at(0, 0, 168); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 2, x, y, 48); g.addColorStop(0, 'rgba(255,240,170,0.8)'); g.addColorStop(1, 'rgba(255,200,100,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 48, 0, 7); ctx.fill(); ctx.restore(); ctx.fillStyle = '#f5c542'; ctx.beginPath(); ctx.moveTo(x - 12, y + 6); ctx.lineTo(x - 12, y - 4); ctx.lineTo(x - 6, y); ctx.lineTo(x, y - 8); ctx.lineTo(x + 6, y); ctx.lineTo(x + 12, y - 4); ctx.lineTo(x + 12, y + 6); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#a87a00'; ctx.lineWidth = 0.8; ctx.stroke(); a.lights.push([x, y, 0xffe680]); a.sparkles.push([x, y - 14]); };
/** Sv → parça ve katman (arka: binanın arkasında kalan, önce boyanır) */
const MERKEZ_EXTRAS: Record<number, { f: MX; back: boolean }> = {
  2: { f: mxBoard, back: false }, 3: { f: mxSpire, back: true }, 5: { f: mxFountain, back: false }, 6: { f: mxWingL, back: false },
  8: { f: mxClock, back: true }, 9: { f: mxGate, back: false }, 11: { f: mxWingR, back: false }, 12: { f: mxDish, back: true },
  14: { f: mxObservatory, back: false }, 15: { f: mxStaff, back: false }, 16: { f: mxObelisk, back: false }, 17: { f: mxRing, back: false },
  18: { f: mxBeams, back: true }, 19: { f: mxOrb, back: true }, 20: { f: mxCrystalSpire, back: true }, 21: { f: mxColossus, back: true },
  22: { f: mxRainbow, back: false }, 23: { f: mxGoldWings, back: false }, 24: { f: mxNotes, back: false }, 25: { f: mxBeacon, back: false },
};
/** Merkez'in seviye parçaları (birikir). Kademe değişen seviyeler (4, 7, 10, 13) mimariyi değiştirir. */
export function merkezExtras(k: Kit, level: number, a: Anchors, back: boolean) {
  const ls = Object.keys(MERKEZ_EXTRAS).map(Number).filter((l) => l <= level && MERKEZ_EXTRAS[l]!.back === back);
  // arka parçalar uzaktan yakına (derinlik), ön parçalar soldan sağa
  for (const l of ls.sort((p, q) => (back ? q - p : p - q))) MERKEZ_EXTRAS[l]!.f(k, a, level);
}
