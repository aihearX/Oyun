/**
 * Kamp bölgeleri (uydu adalar): zemin boyaması — sığ su halesi, uçurum, çim, kıyı kumu, kenarda ağaç çemberi, bölgeye özgü
 * ayrıntılar (Sessiz Koru göleti, Koklea Koyu'nun sarmal lagünü, Denge Tepesi'nin üç patikası, Yerleşke'nin taş döşemesi,
 * Kulak Kılı Ormanı), bina arsası ve köprü. Kilitli bölge: düşük çözünürlükte soluk siluet (bellek dostu), üstünde sis.
 */
import { CAMP_LOTS, bridgeOf, districtShoreK, type District } from '@odi/content';
import { P, css, mix, rng, shade, soft, type Ctx } from './paint';

/** bölge dokusunun dünya kutusu (merkeze göre) */
export function districtBox(d: District): { x0: number; y0: number; x1: number; y1: number } {
  return { x0: d.cx - d.rx * 1.3, y0: d.cy - d.ry * 1.3 - 10, x1: d.cx + d.rx * 1.3, y1: d.cy + d.ry * 1.3 + 60 };
}
function shore(ctx: Ctx, d: District, k = 1, dy = 0) {
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) { const a = (i / 120) * Math.PI * 2; const s = districtShoreK(d, a) * k; const x = d.cx + Math.cos(a) * d.rx * s, y = d.cy + Math.sin(a) * d.ry * s + dy; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.closePath();
}
const GRASS: Record<string, [number, number, number]> = {
  koru: [0x5a9e4a, 0x86c463, 0x3f7a42], koy: [0x79bd55, 0xa6dd78, 0x569a44], tepe: [0x7cb956, 0xaedb7a, 0x5a9446],
  yerleske: [0x6fb34f, 0x9bd26a, 0x4f8f3e], orman: [0x4f8f48, 0x76b35a, 0x386d3c],
};

/** bölge zemini (açık). Kenar ağaçları dokuya boyanır (süs konamayan kıyı şeridinde). */
export function paintDistrict(ctx: Ctx, d: District) {
  const r = rng(d.seed * 97 + 5); const [G, GL, GD] = GRASS[d.id] ?? GRASS.koru!;
  // sığ su halesi + köpük
  for (let i = 4; i >= 1; i--) { shore(ctx, d, 1 + i * 0.06, 22); ctx.fillStyle = `rgba(80,210,230,${0.05 + (4 - i) * 0.03})`; ctx.fill(); }
  shore(ctx, d, 1.02, 30); ctx.strokeStyle = 'rgba(220,250,255,0.55)'; ctx.lineWidth = 2.5; ctx.setLineDash([12, 8]); ctx.stroke(); ctx.setLineDash([]);
  // uçurum
  const cliffH = 36;
  for (let dd = cliffH; dd >= 0; dd -= 2) { shore(ctx, d, 1, dd); const t = dd / cliffH; ctx.fillStyle = css(mix(mix(0xb9744f, 0x6e3f3a, t), 0x3b2a6e, t * 0.35)); ctx.fill(); }
  for (const [dd, c] of [[10, 0xf2b8a2], [22, 0xd9937a]] as const) { shore(ctx, d, 0.998, dd); ctx.strokeStyle = css(c, 0.5); ctx.lineWidth = 2; ctx.stroke(); }
  // çim
  shore(ctx, d); const g = ctx.createRadialGradient(d.cx - d.rx * 0.2, d.cy - d.ry * 0.3, 20, d.cx, d.cy, d.rx * 1.1);
  g.addColorStop(0, css(mix(GL, 0xffd27a, 0.1))); g.addColorStop(0.6, css(G)); g.addColorStop(1, css(mix(GD, 0x3b2a6e, 0.2))); ctx.fillStyle = g; ctx.fill();
  ctx.save(); shore(ctx, d); ctx.clip();
  for (let i = 0; i < 260; i++) { const x = d.cx + (r() - 0.5) * d.rx * 2.2, y = d.cy + (r() - 0.5) * d.ry * 2.2; const rr = 5 + r() * 20; ctx.fillStyle = css(r() < 0.5 ? GL : GD, 0.06 + r() * 0.06); ctx.beginPath(); ctx.ellipse(x, y, rr * 2, rr, 0, 0, Math.PI * 2); ctx.fill(); }
  for (let i = 0; i < 1400; i++) { const x = d.cx + (r() - 0.5) * d.rx * 2.2, y = d.cy + (r() - 0.5) * d.ry * 2.2; ctx.strokeStyle = css(r() < 0.6 ? shade(GL, 0.1) : GD, 0.3 + r() * 0.3); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 2, y - 2 - r() * 3); ctx.stroke(); }
  feature(ctx, d, r);
  // bina arsaları (taş döşeme) + bağlantı yolu (köprü ucundan)
  const b = bridgeOf(d);
  for (const id of d.buildings) {
    const l = CAMP_LOTS[id];
    path(ctx, [[b.x1, b.y1], [(b.x1 + l.x) / 2 + (d.cy > 0 ? -20 : 20), (b.y1 + l.y) / 2 + 30], [l.x, l.y + l.tiles * 16 + 6]]);
  }
  for (const id of d.buildings) lot(ctx, CAMP_LOTS[id], r);
  ctx.restore();
  // kıyı kumu
  shore(ctx, d); ctx.strokeStyle = d.id === 'koy' ? 'rgba(250,224,170,0.95)' : 'rgba(246,214,160,0.75)'; ctx.lineWidth = d.id === 'koy' ? 16 : 9; ctx.stroke();
  // kenar ağaç çemberi (arka yarıda sık, önde seyrek; süs konamayan şeritte)
  rimTrees(ctx, d, r);
}

function path(ctx: Ctx, pts: [number, number][]) {
  const go = () => { ctx.beginPath(); ctx.moveTo(...pts[0]!); ctx.quadraticCurveTo(...pts[1]!, ...pts[2]!); };
  go(); ctx.strokeStyle = 'rgba(70,40,20,0.35)'; ctx.lineWidth = 20; ctx.lineCap = 'round'; ctx.stroke();
  go(); ctx.strokeStyle = '#d8b07a'; ctx.lineWidth = 15; ctx.stroke();
  go(); ctx.strokeStyle = '#e8c690'; ctx.lineWidth = 8; ctx.stroke();
}
function lot(ctx: Ctx, l: { x: number; y: number; tiles: number }, r: () => number) {
  const h = l.tiles * 16 + 4;
  const pts: [number, number][] = [P(-h, -h), P(h, -h), P(h, h), P(-h, h)].map(([x, y]) => [x + l.x, y + l.y]);
  soft(ctx, () => { pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 3) : ctx.moveTo(x, y + 3))); ctx.closePath(); }, 'rgba(40,20,10,0.35)', 6);
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = '#b89a74'; ctx.fill();
  ctx.save(); ctx.clip();
  for (let gx = -h; gx < h; gx += 8) for (let gy = -h; gy < h; gy += 8) { const q = [P(gx + 0.6, gy + 0.6), P(gx + 7.4, gy + 0.6), P(gx + 7.4, gy + 7.4), P(gx + 0.6, gy + 7.4)]; ctx.beginPath(); q.forEach(([x, y], i) => (i ? ctx.lineTo(x + l.x, y + l.y) : ctx.moveTo(x + l.x, y + l.y))); ctx.closePath(); ctx.fillStyle = css(shade(0xcdb08a, (r() - 0.5) * 0.16)); ctx.fill(); }
  ctx.restore();
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.strokeStyle = '#8a6a48'; ctx.lineWidth = 2; ctx.stroke();
}
/** düz (dokuya boyanan) ağaç: yuvarlak, çam ya da kıl ağacı */
function flatTree(ctx: Ctx, x: number, y: number, s: number, kind: 0 | 1 | 2, col: number) {
  ctx.fillStyle = 'rgba(28,12,48,0.25)'; ctx.beginPath(); ctx.ellipse(x + 3 * s, y, 10 * s, 4 * s, 0, 0, 7); ctx.fill();
  if (kind === 1) { // çam
    ctx.fillStyle = '#5a3524'; ctx.fillRect(x - 1.2 * s, y - 6 * s, 2.4 * s, 6 * s);
    for (let i = 0; i < 3; i++) { const yy = y - 6 * s - i * 7 * s; const w = (10 - i * 2.4) * s; ctx.beginPath(); ctx.moveTo(x - w, yy); ctx.lineTo(x, yy - 13 * s); ctx.lineTo(x + w, yy); ctx.closePath(); const g = ctx.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, css(shade(col, 0.2))); g.addColorStop(1, css(mix(shade(col, -0.35), 0x3b2a6e, 0.3))); ctx.fillStyle = g; ctx.fill(); }
    return;
  }
  if (kind === 2) { // kıl ağacı (kulak kılı)
    ctx.strokeStyle = '#c98a8a'; ctx.lineWidth = 2.2 * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 10 * s); ctx.stroke();
    for (let i = 0; i < 7; i++) { const t = (i - 3) / 3; const tx = x + t * 9 * s, ty = y - 10 * s - (18 - Math.abs(t) * 7) * s; ctx.strokeStyle = css(mix(col, 0x3b2a6e, 0.15)); ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(x + t * 2 * s, y - 9 * s); ctx.quadraticCurveTo(tx * 0.5 + x * 0.5, ty + 6 * s, tx, ty); ctx.stroke(); ctx.fillStyle = css(shade(col, 0.45)); ctx.beginPath(); ctx.arc(tx, ty, 1.8 * s, 0, 7); ctx.fill(); }
    return;
  }
  ctx.fillStyle = '#6b3f2a'; ctx.fillRect(x - 1.4 * s, y - 10 * s, 2.8 * s, 10 * s);
  for (const [dx, dy, rr] of [[0, -18, 9], [-6, -13, 7], [6, -14, 7], [0, -24, 6]] as const) { const gg = ctx.createRadialGradient(x + (dx - 3) * s, y + (dy - 3) * s, 1, x + dx * s, y + dy * s, rr * s); gg.addColorStop(0, css(mix(shade(col, 0.35), 0xffc070, 0.2))); gg.addColorStop(1, css(mix(shade(col, -0.2), 0x3b2a6e, 0.15))); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, rr * s, 0, 7); ctx.fill(); }
}
function rimTrees(ctx: Ctx, d: District, r: () => number) {
  const trees: { x: number; y: number; s: number; k: 0 | 1 | 2; c: number }[] = [];
  const n = d.id === 'orman' ? 70 : d.id === 'koru' ? 54 : 34;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2; const back = Math.sin(a) < 0.15;
    if (!back && r() < (d.id === 'orman' ? 0.4 : 0.75)) continue;
    const k0 = districtShoreK(d, a) * (0.9 + r() * 0.08);
    const x = d.cx + Math.cos(a) * d.rx * k0, y = d.cy + Math.sin(a) * d.ry * k0 - 4;
    const kind: 0 | 1 | 2 = d.id === 'orman' ? (r() < 0.75 ? 2 : 1) : d.id === 'koru' ? (r() < 0.6 ? 1 : 0) : r() < 0.25 ? 1 : 0;
    const cols = kind === 2 ? [0xff8fb1, 0xffc93c, 0x8ef0b0, 0xc2a0ff] : [0x5fae4a, 0x4f9a5e, 0x7cc35a, 0x3f8f5a];
    trees.push({ x, y, s: 0.85 + r() * 0.4, k: kind, c: cols[Math.floor(r() * cols.length)]! });
  }
  trees.sort((p, q) => p.y - q.y);
  for (const t of trees) flatTree(ctx, t.x, t.y, t.s, t.k, t.c);
}
/** bölgeye özgü zemin ayrıntısı */
function feature(ctx: Ctx, d: District, r: () => number) {
  if (d.id === 'koru') {
    // sessiz gölet ve basamak taşları
    const [x, y] = [d.cx + 120, d.cy + 30];
    ctx.beginPath(); ctx.ellipse(x, y, 46, 22, 0, 0, 7); ctx.fillStyle = 'rgba(60,40,30,0.3)'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y - 1, 42, 19, 0, 0, 7); const w = ctx.createRadialGradient(x - 10, y - 6, 2, x, y, 44); w.addColorStop(0, '#8fe6f0'); w.addColorStop(1, '#2f8fb0'); ctx.fillStyle = w; ctx.fill();
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#cfc4ad'; ctx.beginPath(); ctx.ellipse(x - 50 + i * 18, y + 26 + Math.sin(i) * 3, 5, 2.6, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#5fae4a'; for (const [dx, dy] of [[-18, 4], [14, -6]] as const) { ctx.beginPath(); ctx.ellipse(x + dx, y + dy, 5, 2.2, 0, 0.3, 6); ctx.fill(); }
  } else if (d.id === 'koy') {
    // sarmal lagün (2,5 tur, koklea gibi)
    const [x, y] = [d.cx - 10, d.cy + 100];
    ctx.lineCap = 'round';
    const spiral = (w: number, style: string) => { ctx.beginPath(); for (let i = 0; i <= 140; i++) { const t = i / 140; const ang = t * Math.PI * 5; const rr = 58 * (1 - t * 0.85); const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr * 0.48; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.strokeStyle = style; ctx.lineWidth = w; ctx.stroke(); };
    spiral(22, 'rgba(250,224,170,0.95)'); spiral(16, '#2f9fc8'); spiral(10, '#5fd2e6'); spiral(2, 'rgba(230,255,255,0.7)');
  } else if (d.id === 'tepe') {
    // tepe basamakları + birbirine dik üç patika (yarım daire kanalları gibi)
    const [x, y] = [CAMP_LOTS.denge.x, CAMP_LOTS.denge.y + 10];
    for (let i = 4; i >= 1; i--) { ctx.beginPath(); ctx.ellipse(x, y, 60 + i * 22, 30 + i * 11, 0, 0, 7); ctx.fillStyle = css(shade(0x7cb956, -0.05 * i), 0.5); ctx.fill(); ctx.strokeStyle = 'rgba(60,90,40,0.35)'; ctx.lineWidth = 1.4; ctx.stroke(); }
    const cols = ['rgba(125,243,255,0.75)', 'rgba(139,107,255,0.7)', 'rgba(60,207,126,0.75)'];
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(x, y + 4, 120 - k * 20, 52 - k * 6, k * 0.5 - 0.5, Math.PI * 0.05, Math.PI * 0.95); ctx.strokeStyle = cols[k]!; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]); }
  } else if (d.id === 'yerleske') {
    // taş döşeli meydan + bilgi tabelaları
    const [x, y] = [d.cx - 40, d.cy + 60];
    ctx.beginPath(); ctx.ellipse(x, y, 110, 50, 0, 0, 7); ctx.fillStyle = '#cdb594'; ctx.fill();
    ctx.save(); ctx.clip(); for (let ring = 0; ring < 12; ring++) { const rx = 110 - ring * 9, ry = rx / 2.2; const n = Math.max(6, Math.round(rx / 4)); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + ring * 0.3; ctx.fillStyle = css(shade(0xd9c3a0, (r() - 0.5) * 0.18)); ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * rx, y + Math.sin(a) * ry, 3.4, 1.8, 0, 0, 7); ctx.fill(); } } ctx.restore();
    ctx.beginPath(); ctx.ellipse(x, y, 110, 50, 0, 0, 7); ctx.strokeStyle = 'rgba(255,240,210,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  } else if (d.id === 'orman') {
    // düşmüş yapraklar + orman patikası
    for (let i = 0; i < 160; i++) { const x = d.cx + (r() - 0.5) * d.rx * 1.6, y = d.cy + (r() - 0.5) * d.ry * 1.6; ctx.fillStyle = css([0xe0a24a, 0xd9705a, 0xffc93c][Math.floor(r() * 3)]!, 0.5); ctx.beginPath(); ctx.ellipse(x, y, 2, 1, r() * 3, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(d.cx - d.rx * 0.8, d.cy); ctx.bezierCurveTo(d.cx - 60, d.cy - 50, d.cx + 60, d.cy + 50, d.cx + d.rx * 0.8, d.cy - 10); ctx.strokeStyle = 'rgba(120,80,40,0.45)'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = 'rgba(232,198,144,0.8)'; ctx.lineWidth = 5; ctx.stroke();
  }
}

/** kilitli bölge: soluk siluet (sisli ada) — düşük çözünürlükte boyanır */
export function paintDistrictLocked(ctx: Ctx, d: District) {
  for (let i = 3; i >= 1; i--) { shore(ctx, d, 1 + i * 0.06, 22); ctx.fillStyle = `rgba(80,210,230,${0.04 + (3 - i) * 0.025})`; ctx.fill(); }
  for (let dd = 30; dd >= 0; dd -= 3) { shore(ctx, d, 1, dd); ctx.fillStyle = css(mix(0x6e5a8a, 0x3b2a6e, dd / 30)); ctx.fill(); }
  shore(ctx, d); const g = ctx.createRadialGradient(d.cx, d.cy - d.ry * 0.3, 10, d.cx, d.cy, d.rx); g.addColorStop(0, '#9d8fc8'); g.addColorStop(1, '#6a5c9a'); ctx.fillStyle = g; ctx.fill();
  ctx.save(); shore(ctx, d); ctx.clip();
  const r = rng(d.seed);
  for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, k = 0.4 + r() * 0.5; const x = d.cx + Math.cos(a) * d.rx * k, y = d.cy + Math.sin(a) * d.ry * k; ctx.fillStyle = 'rgba(60,40,110,0.45)'; ctx.beginPath(); ctx.ellipse(x, y - 8, 9, 12, 0, 0, 7); ctx.fill(); }
  ctx.restore();
}

/** köprü: ana ada kıyısından bölge kıyısına tahta köprü (açık bölgede) */
export function bridgeBox(d: District): { x0: number; y0: number; x1: number; y1: number } {
  const b = bridgeOf(d); return { x0: Math.min(b.x0, b.x1) - 30, y0: Math.min(b.y0, b.y1) - 30, x1: Math.max(b.x0, b.x1) + 30, y1: Math.max(b.y0, b.y1) + 40 };
}
export function paintBridge(ctx: Ctx, d: District) {
  const b = bridgeOf(d); const dx = b.x1 - b.x0, dy = b.y1 - b.y0; const L = Math.hypot(dx, dy); const nx = -dy / L, ny = dx / L; const W = 9;
  // ayaklar
  for (let t = 0.15; t < 0.9; t += 0.22) { const x = b.x0 + dx * t, y = b.y0 + dy * t; ctx.fillStyle = '#5b3a24'; ctx.fillRect(x - 1.4, y, 2.8, 16); ctx.fillStyle = 'rgba(200,250,255,0.5)'; ctx.beginPath(); ctx.ellipse(x, y + 16, 4, 1.6, 0, 0, 7); ctx.fill(); }
  // döşeme
  ctx.beginPath(); ctx.moveTo(b.x0 + nx * W, b.y0 + ny * W); ctx.lineTo(b.x1 + nx * W, b.y1 + ny * W); ctx.lineTo(b.x1 - nx * W, b.y1 - ny * W); ctx.lineTo(b.x0 - nx * W, b.y0 - ny * W); ctx.closePath();
  ctx.fillStyle = '#b07a45'; ctx.fill(); ctx.strokeStyle = 'rgba(60,30,15,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.strokeStyle = 'rgba(70,40,20,0.45)'; ctx.lineWidth = 0.8;
  for (let t = 0.03; t < 1; t += 0.035) { const x = b.x0 + dx * t, y = b.y0 + dy * t; ctx.beginPath(); ctx.moveTo(x + nx * W, y + ny * W); ctx.lineTo(x - nx * W, y - ny * W); ctx.stroke(); }
  // korkuluk ipleri
  for (const s of [1, -1]) { ctx.strokeStyle = '#6b3f22'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(b.x0 + nx * W * s, b.y0 + ny * W * s - 6); ctx.quadraticCurveTo((b.x0 + b.x1) / 2 + nx * W * s, (b.y0 + b.y1) / 2 + ny * W * s - 2, b.x1 + nx * W * s, b.y1 + ny * W * s - 6); ctx.stroke(); for (let t = 0; t <= 1; t += 0.25) { const x = b.x0 + dx * t + nx * W * s, y = b.y0 + dy * t + ny * W * s; ctx.fillStyle = '#5b3a24'; ctx.fillRect(x - 0.8, y - 7, 1.6, 7); } }
}
