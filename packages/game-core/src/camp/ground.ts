/**
 * Kulak Adası zemini: kulak kepçesi kıvrımlı tepelerle çevrili vadi, iz. karo deseni, çim/toprak dokusu,
 * yollar, ses dalgası deresi, arsalar, uçurum kenarı ve sığ su halesi. Tek seferlik Canvas 2D boyaması.
 */
import { P, css, mix, rng, shade, soft, type Ctx } from './paint';
import { LOTS, BUILDING_ORDER } from './layout';

/** zemin dokusunun kapsadığı dünya kutusu */
export const GROUND_BOX = { x0: -760, y0: -500, x1: 760, y1: 470 };
export const ISLAND = { cx: 0, cy: 6, rx: 610, ry: 330 };

/** ada kıyısı yarıçap çarpanı (açıya göre organik) */
export function shoreK(a: number): number { return 1 + 0.05 * Math.sin(a * 3 + 0.6) + 0.035 * Math.sin(a * 5 + 2.1) + 0.02 * Math.sin(a * 9 + 1.3); }
export function shorePoint(a: number, k = 1): [number, number] { const s = shoreK(a) * k; return [ISLAND.cx + Math.cos(a) * ISLAND.rx * s, ISLAND.cy + Math.sin(a) * ISLAND.ry * s]; }
/** nokta adanın içinde mi (pay: 0..1, kıyıdan içeri oran) */
export function onIsland(x: number, y: number, margin = 0.9): boolean {
  const dx = (x - ISLAND.cx) / ISLAND.rx, dy = (y - ISLAND.cy) / ISLAND.ry; const a = Math.atan2(dy, dx);
  return Math.hypot(dx, dy) < shoreK(a) * margin;
}
function shorePath(ctx: Ctx, k = 1, dy = 0) {
  ctx.beginPath();
  for (let i = 0; i <= 160; i++) { const a = (i / 160) * Math.PI * 2; const [x, y] = shorePoint(a, k); if (i) ctx.lineTo(x, y + dy); else ctx.moveTo(x, y + dy); }
  ctx.closePath();
}

/** yollar: merkez meydanından her binaya ve iskeleye (bezier) */
export const ROADS: [number, number][][] = [
  ...BUILDING_ORDER.filter((id) => id !== 'merkez').map((id) => { const l = LOTS[id]; return [[0, 30], [l.x * 0.45, l.y * 0.45 + 34], [l.x, l.y + (l.tiles * 16) + 6]] as [number, number][]; }),
  [[0, 60], [10, 230], [-40, 300]],
];
/** dere: arka sol tepelerden çıkıp sol ön kıyıya akan ses dalgası */
export const STREAM: [number, number][] = [[-330, -250], [-300, -170], [-370, -90], [-330, -10], [-400, 60], [-360, 140], [-430, 210], [-470, 270]];
function streamPoints(): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < STREAM.length - 1; i++) { const [x0, y0] = STREAM[i]!, [x1, y1] = STREAM[i + 1]!; for (let t = 0; t < 1; t += 0.05) out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); }
  out.push(STREAM[STREAM.length - 1]!);
  // yumuşat
  for (let k = 0; k < 4; k++) for (let i = 1; i < out.length - 1; i++) out[i] = [(out[i - 1]![0] + out[i]![0] * 2 + out[i + 1]![0]) / 4, (out[i - 1]![1] + out[i]![1] * 2 + out[i + 1]![1]) / 4];
  return out;
}
export const STREAM_PTS = streamPoints();
/** yolun dereyi kestiği yer (köprü) */
export const BRIDGE: [number, number] = (() => { const p = STREAM_PTS[Math.round(STREAM_PTS.length * 0.42)]!; return [p[0], p[1]]; })();

const GRASS = 0x6fb34f, GRASS_L = 0x9bd26a, GRASS_D = 0x4f8f3e;

export function paintGround(ctx: Ctx) {
  const r = rng(4242);
  // ---- sığ su halesi + köpük
  for (let i = 4; i >= 1; i--) { shorePath(ctx, 1 + i * 0.055, 26); ctx.fillStyle = `rgba(80,210,230,${0.05 + (4 - i) * 0.03})`; ctx.fill(); }
  shorePath(ctx, 1.018, 34); ctx.strokeStyle = 'rgba(220,250,255,0.55)'; ctx.lineWidth = 2.5; ctx.setLineDash([14, 9]); ctx.stroke(); ctx.setLineDash([]);
  // ---- uçurum (ön yarı kalınlık): katmanlı toprak + kulak teni damarları
  const cliffH = 46;
  for (let d = cliffH; d >= 0; d -= 2) {
    shorePath(ctx, 1, d);
    const t = d / cliffH;
    ctx.fillStyle = css(mix(mix(0xb9744f, 0x6e3f3a, t), 0x3b2a6e, t * 0.35)); ctx.fill();
  }
  for (const [d, c] of [[12, 0xf2b8a2], [24, 0xd9937a], [36, 0x8a5240]] as const) { shorePath(ctx, 0.998, d); ctx.strokeStyle = css(c, 0.55); ctx.lineWidth = 2; ctx.stroke(); }
  // ---- üst yüzey: çim
  shorePath(ctx, 1, 0);
  const g = ctx.createRadialGradient(-60, -40, 40, 0, 0, 700); g.addColorStop(0, css(mix(GRASS_L, 0xffd27a, 0.12))); g.addColorStop(0.55, css(GRASS)); g.addColorStop(1, css(mix(GRASS_D, 0x3b2a6e, 0.25)));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); shorePath(ctx, 1, 0); ctx.clip();
  // çim lekeleri
  for (let i = 0; i < 900; i++) { const x = (r() - 0.5) * 1300, y = (r() - 0.5) * 720; const rr = 6 + r() * 26; ctx.fillStyle = css(r() < 0.5 ? GRASS_L : GRASS_D, 0.06 + r() * 0.06); ctx.beginPath(); ctx.ellipse(x, y, rr * 2, rr, 0, 0, Math.PI * 2); ctx.fill(); }
  // izometrik karo deseni (hafif dama)
  for (let gx = -22; gx <= 22; gx++) for (let gy = -22; gy <= 22; gy++) {
    if ((gx + gy) % 2) continue;
    const [x, y] = P(gx * 32, gy * 32); if (Math.abs(x) > 760 || Math.abs(y) > 470) continue;
    ctx.beginPath(); ctx.moveTo(...P(gx * 32, gy * 32)); ctx.lineTo(...P(gx * 32 + 32, gy * 32)); ctx.lineTo(...P(gx * 32 + 32, gy * 32 + 32)); ctx.lineTo(...P(gx * 32, gy * 32 + 32)); ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,220,0.035)'; ctx.fill();
  }
  ctx.strokeStyle = 'rgba(30,60,20,0.07)'; ctx.lineWidth = 0.6;
  for (let k = -22; k <= 22; k++) { ctx.beginPath(); ctx.moveTo(...P(k * 32, -22 * 32)); ctx.lineTo(...P(k * 32, 22 * 32)); ctx.moveTo(...P(-22 * 32, k * 32)); ctx.lineTo(...P(22 * 32, k * 32)); ctx.stroke(); }
  // çim telleri
  for (let i = 0; i < 5200; i++) { const x = (r() - 0.5) * 1300, y = (r() - 0.5) * 720; const h = 2 + r() * 3; ctx.strokeStyle = css(r() < 0.6 ? shade(GRASS_L, 0.1) : GRASS_D, 0.35 + r() * 0.3); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 2, y - h); ctx.stroke(); }
  // kıyı kumu
  shorePath(ctx, 1, 0); ctx.strokeStyle = 'rgba(246,214,160,0.75)'; ctx.lineWidth = 10; ctx.stroke();
  shorePath(ctx, 0.985, 0); ctx.strokeStyle = 'rgba(246,214,160,0.3)'; ctx.lineWidth = 8; ctx.stroke();
  // ---- ses dalgası deresi
  const sp = STREAM_PTS;
  const strokeStream = (w: number, style: string) => { ctx.beginPath(); sp.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.strokeStyle = style; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); };
  strokeStream(30, 'rgba(90,60,40,0.55)'); strokeStream(24, '#c9a26e'); strokeStream(19, '#2f9fc8'); strokeStream(12, '#4fc6e0');
  // dalga çizgisi (ses dalgası)
  ctx.beginPath(); for (let i = 0; i < sp.length - 1; i++) { const [x0, y0] = sp[i]!, [x1, y1] = sp[i + 1]!; const nx = -(y1 - y0), ny = x1 - x0; const L = Math.hypot(nx, ny) || 1; const o = Math.sin(i * 0.9) * 4; const px = x0 + (nx / L) * o, py = y0 + (ny / L) * o; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
  ctx.strokeStyle = 'rgba(230,255,255,0.75)'; ctx.lineWidth = 1.6; ctx.stroke();
  // ---- yollar
  const roadPath = (pts: [number, number][]) => { ctx.beginPath(); ctx.moveTo(...pts[0]!); ctx.quadraticCurveTo(...pts[1]!, ...pts[2]!); };
  for (const pts of ROADS) { roadPath(pts); ctx.strokeStyle = 'rgba(70,40,20,0.35)'; ctx.lineWidth = 24; ctx.lineCap = 'round'; ctx.stroke(); }
  for (const pts of ROADS) { roadPath(pts); ctx.strokeStyle = '#d8b07a'; ctx.lineWidth = 19; ctx.stroke(); }
  for (const pts of ROADS) { roadPath(pts); ctx.strokeStyle = '#e8c690'; ctx.lineWidth = 11; ctx.stroke(); }
  // yol taşları
  for (const pts of ROADS) for (let t = 0; t <= 1; t += 0.02) {
    const [a, b, c] = pts as [[number, number], [number, number], [number, number]];
    const x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1];
    for (let k = 0; k < 2; k++) { ctx.fillStyle = css(r() < 0.5 ? 0xc9a36c : 0xf3dcae, 0.8); ctx.beginPath(); ctx.ellipse(x + (r() - 0.5) * 14, y + (r() - 0.5) * 7, 1.8 + r() * 1.6, 1 + r(), 0, 0, 7); ctx.fill(); }
  }
  // ---- merkez meydanı (arnavut kaldırımı)
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 6, 170, 86, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(70,40,20,0.3)'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 4, 164, 82, 0, 0, Math.PI * 2); ctx.fillStyle = '#cdb594'; ctx.fill(); ctx.clip();
  for (let ring = 0; ring < 18; ring++) { const rx = 164 - ring * 9, ry = rx / 2; const n = Math.max(6, Math.round(rx / 4)); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + ring * 0.3; ctx.fillStyle = css(shade(0xd9c3a0, (r() - 0.5) * 0.18)); ctx.beginPath(); ctx.ellipse(Math.cos(a) * rx, 4 + Math.sin(a) * ry, 3.6, 1.9, 0, 0, 7); ctx.fill(); } }
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(0, 4, 164, 82, 0, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,240,210,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  // ---- arsalar (taş döşeme)
  for (const id of BUILDING_ORDER) {
    if (id === 'merkez') continue;
    const l = LOTS[id]; const h = l.tiles * 16 + 6;
    const pts: [number, number][] = [P(-h, -h), P(h, -h), P(h, h), P(-h, h)].map(([x, y]) => [x + l.x, y + l.y]);
    soft(ctx, () => { pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 3) : ctx.moveTo(x, y + 3))); ctx.closePath(); }, 'rgba(40,20,10,0.35)', 6);
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = '#b89a74'; ctx.fill();
    ctx.save(); ctx.clip();
    for (let gx = -h; gx < h; gx += 8) for (let gy = -h; gy < h; gy += 8) { const q = [P(gx + 0.6, gy + 0.6), P(gx + 7.4, gy + 0.6), P(gx + 7.4, gy + 7.4), P(gx + 0.6, gy + 7.4)]; ctx.beginPath(); q.forEach(([x, y], i) => (i ? ctx.lineTo(x + l.x, y + l.y) : ctx.moveTo(x + l.x, y + l.y))); ctx.closePath(); ctx.fillStyle = css(shade(0xcdb08a, (r() - 0.5) * 0.16)); ctx.fill(); }
    ctx.restore();
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.strokeStyle = '#8a6a48'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore(); // ada klibi
  // ---- arka kulak kepçesi tepeleri (heliks + antiheliks)
  helixHill(ctx, -1); helixHill(ctx, 1);
}

/** arka kenarda kulak kepçesi kıvrımlı tepe sırtı: s=-1 sol (büyük heliks), s=1 sağ (antiheliks). Yumuşak tümsek zinciri. */
function helixHill(ctx: Ctx, s: -1 | 1) {
  const big = s === -1; const r = rng(big ? 91 : 37);
  // sırt yolu: arka kıyı yayı + valiye doğru içe kıvrılan uç (kepçe kıvrımı)
  const path: [number, number, number][] = []; // x, y, yükseklik
  const a0 = big ? Math.PI * 0.9 : Math.PI * 2.08, a1 = big ? Math.PI * 1.47 : Math.PI * 1.58;
  const N = big ? 26 : 20;
  for (let i = 0; i <= N; i++) { const t = i / N; const a = a0 + (a1 - a0) * t; const [x, y] = shorePoint(a, 0.9); path.push([x, y, (big ? 64 : 50) * (0.45 + 0.55 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5)) + 10 * Math.sin(t * 9)]); }
  const [ex, ey] = path[path.length - 1]!.slice(0, 2) as [number, number];
  // kıvrım: uçtan valiye doğru dönen yay
  for (let i = 1; i <= 10; i++) { const t = i / 10; const ang = -Math.PI / 2 + t * Math.PI * 0.95; const rr = 60 * (1 - t * 0.35); path.push([ex - s * (Math.cos(ang) * 0 + Math.sin(t * Math.PI * 0.9) * rr * 1.2) + s * t * 10, ey + (1 - Math.cos(t * Math.PI * 0.9)) * rr * 0.55, (big ? 56 : 44) * (1 - t * 0.6)]); }
  // arkadan öne boya (y küçük önce)
  const mounds = path.map(([x, y, h], i) => ({ x: x + (r() - 0.5) * 10, y, h: Math.max(18, h + (r() - 0.5) * 10), w: 44 + r() * 18 + (i % 3) * 4 })).sort((p, q) => p.y - q.y);
  for (const m of mounds) {
    const { x, y, h, w } = m;
    // gölge tabanı
    ctx.fillStyle = 'rgba(40,20,60,0.28)'; ctx.beginPath(); ctx.ellipse(x + 8, y + 4, w * 0.62, w * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    // tümsek gövdesi (kulak teni)
    ctx.beginPath(); ctx.moveTo(x - w * 0.6, y); ctx.bezierCurveTo(x - w * 0.55, y - h * 0.9, x - w * 0.2, y - h * 1.08, x + w * 0.05, y - h); ctx.bezierCurveTo(x + w * 0.35, y - h * 0.95, x + w * 0.6, y - h * 0.5, x + w * 0.62, y); ctx.ellipse(x, y, w * 0.62, w * 0.2, 0, 0, Math.PI, false); ctx.closePath();
    const g = ctx.createLinearGradient(x - w * 0.6, y - h, x + w * 0.6, y);
    g.addColorStop(0, '#ffe0cf'); g.addColorStop(0.35, '#f5b49b'); g.addColorStop(0.75, '#d0848a'); g.addColorStop(1, '#8e5672');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(110,50,70,0.35)'; ctx.lineWidth = 1.2; ctx.stroke();
    // kıvrım çizgisi
    ctx.beginPath(); ctx.moveTo(x - w * 0.35, y - h * 0.15); ctx.quadraticCurveTo(x - w * 0.25, y - h * 0.7, x + w * 0.05, y - h * 0.78); ctx.strokeStyle = 'rgba(190,100,110,0.45)'; ctx.lineWidth = 2; ctx.stroke();
    // çim örtüsü (üst)
    ctx.save(); ctx.beginPath(); ctx.moveTo(x - w * 0.52, y - h * 0.5); ctx.bezierCurveTo(x - w * 0.5, y - h * 0.95, x - w * 0.2, y - h * 1.1, x + w * 0.05, y - h * 1.02); ctx.bezierCurveTo(x + w * 0.32, y - h * 0.97, x + w * 0.5, y - h * 0.7, x + w * 0.52, y - h * 0.45);
    ctx.bezierCurveTo(x + w * 0.3, y - h * 0.62, x + w * 0.1, y - h * 0.5, x - w * 0.05, y - h * 0.62); ctx.bezierCurveTo(x - w * 0.22, y - h * 0.5, x - w * 0.38, y - h * 0.6, x - w * 0.52, y - h * 0.5); ctx.closePath();
    const gg = ctx.createLinearGradient(x - w * 0.5, y - h, x + w * 0.5, y - h * 0.5); gg.addColorStop(0, '#a6dd78'); gg.addColorStop(0.6, '#6fb34f'); gg.addColorStop(1, '#3f7a4e');
    ctx.fillStyle = gg; ctx.fill(); ctx.restore();
    for (let k = 0; k < 6; k++) { ctx.fillStyle = `rgba(255,255,220,${0.25 + r() * 0.2})`; ctx.beginPath(); ctx.arc(x - w * 0.35 + r() * w * 0.5, y - h * (0.75 + r() * 0.25), 1.2, 0, 7); ctx.fill(); }
  }
}

/** arka plan: alacakaranlık gökyüzü + deniz (ekrana sabit) */
export function paintSky(ctx: Ctx, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#140c35'); g.addColorStop(0.09, '#2d1d6e'); g.addColorStop(0.17, '#7a3b8f'); g.addColorStop(0.23, '#ff7a6a'); g.addColorStop(0.265, '#ffb36b'); g.addColorStop(0.29, '#5a4aa8'); g.addColorStop(0.55, '#2c3584'); g.addColorStop(1, '#171552');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r = rng(77);
  // yıldızlar
  for (let i = 0; i < 70; i++) { const x = r() * w, y = r() * h * 0.17; ctx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`; ctx.beginPath(); ctx.arc(x, y, r() * 1.3 + 0.3, 0, 7); ctx.fill(); }
  // ufukta gün batımı parıltısı + deniz yansımaları
  const sun = ctx.createRadialGradient(w * 0.3, h * 0.265, 4, w * 0.3, h * 0.265, w * 0.55); sun.addColorStop(0, 'rgba(255,214,140,0.9)'); sun.addColorStop(0.2, 'rgba(255,140,90,0.45)'); sun.addColorStop(1, 'rgba(255,92,138,0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { const y = h * 0.29 + r() * h * 0.7; const x = r() * w; const len = 10 + r() * 40; ctx.strokeStyle = `rgba(${r() < 0.5 ? '255,180,120' : '140,200,255'},${0.08 + r() * 0.16})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke(); }
}
