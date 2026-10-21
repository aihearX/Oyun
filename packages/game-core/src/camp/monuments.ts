/**
 * Bölge anıtları (docs/14-kamp.md): haritada bir bölgeye ulaşınca kampın ön kıyısındaki "Kulak Yolu"nda o bölgenin anıtı
 * yükselir. Soldan sağa kulaktan beyne: Dış Kulak → … → Korteks. Henüz ulaşılmayan bölgenin yerinde boş bir kaide durur.
 * Saf Canvas 2D (kamp boyama dili: gün batımı ışığı solda, mor gölge sağda, ince koyu kontur). Orijin = zemin noktası.
 */
import type { BiomeId } from '@odi/shared';
import { P, box, css, earGlyph, mix, roundRect, shade, sparkle, type Ctx } from './paint';
import { KULAK_YOLU } from './ground';

export const MONUMENT_ORDER: BiomeId[] = ['dis-kulak', 'kanal', 'zar', 'kemikcikler', 'koklea-1', 'koklea-2', 'koklea-3', 'sinir', 'beyin-sapi', 'korteks'];
/** her bölgenin anıt rengi (kaide plaketi, ışık) */
export const MONUMENT_TINT: Record<BiomeId, number> = {
  'dis-kulak': 0xff8fa8, kanal: 0xffb36b, zar: 0xd9d4ee, kemikcikler: 0xffd66b, 'koklea-1': 0x2ee6d6,
  'koklea-2': 0x8ef0b0, 'koklea-3': 0x8b6bff, sinir: 0xffe066, 'beyin-sapi': 0x7df3ff, korteks: 0xff6f9f,
};

/** "Kulak Yolu"ndaki yerler (ground.ts boyar; burada yeniden adlandırılır) */
export const MONUMENT_SPOTS: { region: BiomeId; x: number; y: number }[] = KULAK_YOLU;
export const spotOf = (region: string) => MONUMENT_SPOTS.find((s) => s.region === region);

/** doku boyutu (dünya birimi) ve orijin */
export const MONUMENT_BOX = { w: 70, h: 92, ox: 35, oy: 80 };

// ---------------------------------------------------------------- ortak parçalar
const INK = 'rgba(38,20,44,0.6)';
function pedestal(ctx: Ctx, tint: number, empty = false) {
  // yumuşak gölge
  ctx.save(); ctx.fillStyle = 'rgba(28,12,48,0.32)'; ctx.beginPath(); ctx.ellipse(3, 2, 18, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  box(ctx, -11, -11, 0, 22, 22, 3, { color: 0xb8ad98, pattern: 'stone', seed: 5 });
  box(ctx, -8.5, -8.5, 3, 17, 17, empty ? 4 : 7, { color: empty ? 0xa89e8a : 0xe8dfcf, pattern: empty ? 'stone' : 'marble', seed: 9 });
  if (empty) return;
  // renkli plaket (ön-sol yüz)
  const [x, y] = P(0, 8.5, 6.5);
  ctx.save(); ctx.translate(x, y); ctx.transform(1, 0.5, 0, 1, 0, 0);
  ctx.fillStyle = css(shade(tint, -0.15)); roundRect(ctx, -6, -2.6, 12, 4.4, 1.2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-5, -2, 10, 0.8);
  ctx.restore();
}
const topZ = 10; // kaide üstü
const top = (dz = 0): [number, number] => P(0, 0, topZ + dz);
function glowDot(ctx: Ctx, x: number, y: number, r: number, color: number, a = 0.8) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, css(shade(color, 0.5), a)); g.addColorStop(1, css(color, 0));
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore();
}
const skinGrad = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, '#ffe2d2'); g.addColorStop(0.45, '#f6b19c'); g.addColorStop(1, '#c97a86'); return g; };

// ---------------------------------------------------------------- anıtlar
/** Dış Kulak: kulak kepçesi heykeli (heliks, antiheliks, konka, tragus) */
function disKulak(ctx: Ctx) {
  const [x, y] = top();
  ctx.save(); ctx.translate(x, y - 2);
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.bezierCurveTo(-4, 2, -15, -8, -14, -28); ctx.bezierCurveTo(-13, -46, 2, -52, 11, -44); ctx.bezierCurveTo(19, -37, 16, -26, 10, -20); ctx.bezierCurveTo(6, -15, 9, -8, 7, -3); ctx.closePath();
  ctx.fillStyle = skinGrad(ctx, -14, -50, 14, 0); ctx.fill(); ctx.strokeStyle = 'rgba(120,45,60,0.75)'; ctx.lineWidth = 1.1; ctx.stroke();
  // heliks kenarı (iç çizgi)
  ctx.beginPath(); ctx.moveTo(-9, -12); ctx.bezierCurveTo(-12, -30, -4, -46, 8, -42); ctx.strokeStyle = 'rgba(255,240,230,0.7)'; ctx.lineWidth = 1.4; ctx.stroke();
  // antiheliks + konka
  ctx.beginPath(); ctx.moveTo(-4, -8); ctx.bezierCurveTo(-8, -20, -4, -34, 6, -34); ctx.bezierCurveTo(12, -33, 11, -25, 5, -23); ctx.strokeStyle = 'rgba(160,60,75,0.7)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(1, -16, 4.5, 6, -0.2, 0, Math.PI * 2); ctx.fillStyle = 'rgba(140,50,70,0.55)'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(1.6, -15, 2, 3, -0.2, 0, Math.PI * 2); ctx.fillStyle = 'rgba(60,20,40,0.7)'; ctx.fill();
  // tragus
  ctx.beginPath(); ctx.ellipse(7.5, -13, 2.2, 3.4, 0.2, 0, Math.PI * 2); ctx.fillStyle = '#f2a893'; ctx.fill(); ctx.strokeStyle = 'rgba(120,45,60,0.5)'; ctx.lineWidth = 0.6; ctx.stroke();
  // ses dalgaları
  ctx.strokeStyle = 'rgba(255,240,200,0.85)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
  for (const r of [6, 11]) { ctx.beginPath(); ctx.arc(-18, -30, r, -0.7, 0.7); ctx.stroke(); }
  ctx.restore();
}
/** Kanal: S kıvrımlı tünel kemeri, girişte kulak kılları, sonunda inci zar */
function kanal(ctx: Ctx) {
  const [x, y] = top();
  ctx.save(); ctx.translate(x, y);
  // kemer gövdesi
  ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-16, -22); ctx.bezierCurveTo(-16, -44, 16, -44, 16, -22); ctx.lineTo(16, 0); ctx.lineTo(9, 0); ctx.lineTo(9, -22); ctx.bezierCurveTo(9, -34, -9, -34, -9, -22); ctx.lineTo(-9, 0); ctx.closePath();
  ctx.fillStyle = skinGrad(ctx, -16, -44, 16, 0); ctx.fill(); ctx.strokeStyle = 'rgba(120,45,60,0.7)'; ctx.lineWidth = 1; ctx.stroke();
  // tünel içi: derinlik ve sonda zar ışığı
  ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-9, -22); ctx.bezierCurveTo(-9, -34, 9, -34, 9, -22); ctx.lineTo(9, 0); ctx.closePath();
  const g = ctx.createRadialGradient(2, -16, 1, 0, -14, 16); g.addColorStop(0, '#fff6e8'); g.addColorStop(0.25, '#d9d4ee'); g.addColorStop(0.6, '#7a3a5a'); g.addColorStop(1, '#3b1a3a');
  ctx.fillStyle = g; ctx.fill();
  // S kıvrımı izleri
  ctx.strokeStyle = 'rgba(255,220,200,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-6, -2); ctx.bezierCurveTo(-2, -10, 5, -8, 3, -18); ctx.stroke();
  // kulak kılları (girişte)
  ctx.strokeStyle = '#7a4a3a'; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) { const a = Math.PI + (i / 6) * Math.PI; const bx = Math.cos(a) * 13, by = -22 + Math.sin(a) * 15; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx * 0.82, by + 3.5); ctx.stroke(); }
  // kehribar kir damlası
  ctx.fillStyle = '#e0a03a'; ctx.beginPath(); ctx.ellipse(12, -1.5, 2.4, 1.5, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(11.3, -2.1, 0.6, 0, 7); ctx.fill();
  ctx.restore();
}
/** Zar: çerçevede inci grisi zar, çekiç sapı (umbo) ve ışık üçgeni */
function zar(ctx: Ctx) {
  const [x, y] = top();
  ctx.save(); ctx.translate(x, y);
  // ayak
  ctx.fillStyle = '#8a7a6a'; ctx.fillRect(-1.6, -14, 3.2, 14);
  ctx.save(); ctx.translate(0, -30); ctx.rotate(-0.18);
  // çerçeve halkası (timpanik halka)
  ctx.beginPath(); ctx.ellipse(0, 0, 16, 19, 0, 0, Math.PI * 2); const rg = ctx.createLinearGradient(-16, -19, 16, 19); rg.addColorStop(0, '#fff3c4'); rg.addColorStop(0.5, '#e0b040'); rg.addColorStop(1, '#9a6a10'); ctx.fillStyle = rg; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
  // zar
  ctx.beginPath(); ctx.ellipse(0, 0, 13.4, 16.4, 0, 0, Math.PI * 2);
  const mg = ctx.createRadialGradient(-4, -6, 1, 0, 0, 17); mg.addColorStop(0, '#fbf8ff'); mg.addColorStop(0.55, '#d8d3e6'); mg.addColorStop(1, '#a49cc0'); ctx.fillStyle = mg; ctx.fill();
  // çekiç sapı: üst-arkadan merkeze (umbo)
  ctx.strokeStyle = '#f2e6c8'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-1.5, -14); ctx.lineTo(1, 0); ctx.stroke();
  ctx.fillStyle = '#e8dcbc'; ctx.beginPath(); ctx.arc(1, 0, 1.6, 0, 7); ctx.fill();
  // ışık üçgeni (ön-alt kadran)
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); ctx.moveTo(2, 1.5); ctx.lineTo(10, 11); ctx.lineTo(5, 13); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,240,0.85)'; ctx.fill(); ctx.restore();
  // pars flaccida
  ctx.beginPath(); ctx.ellipse(-1.5, -14.5, 3.4, 1.8, 0, Math.PI, 0); ctx.fillStyle = 'rgba(255,190,190,0.6)'; ctx.fill();
  ctx.restore();
  ctx.restore();
}
/** Kemikçikler: çekiç, örs ve üzengi zinciri (fildişi) */
function kemikcikler(ctx: Ctx) {
  const [x, y] = top();
  ctx.save(); ctx.translate(x, y);
  const bone = (path: () => void) => { ctx.beginPath(); path(); const g = ctx.createLinearGradient(-14, -48, 14, 0); g.addColorStop(0, '#fffaf0'); g.addColorStop(0.5, '#f0e2c2'); g.addColorStop(1, '#c8a878'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(110,80,40,0.75)'; ctx.lineWidth = 0.9; ctx.stroke(); };
  // çekiç (malleus): baş + sap (sol)
  bone(() => { ctx.ellipse(-9, -42, 6, 6.5, 0, 0, Math.PI * 2); });
  bone(() => { ctx.moveTo(-11, -37); ctx.quadraticCurveTo(-13, -22, -12, -8); ctx.lineTo(-9, -8); ctx.quadraticCurveTo(-8, -22, -6, -37); ctx.closePath(); });
  // örs (incus): gövde + uzun kol (orta)
  bone(() => { ctx.moveTo(-3, -44); ctx.quadraticCurveTo(6, -47, 9, -40); ctx.quadraticCurveTo(10, -34, 4, -32); ctx.quadraticCurveTo(4, -24, 6, -18); ctx.lineTo(3.4, -17); ctx.quadraticCurveTo(0, -26, -1, -33); ctx.quadraticCurveTo(-5, -37, -3, -44); ctx.closePath(); });
  bone(() => { ctx.moveTo(8, -40); ctx.quadraticCurveTo(14, -38, 15, -33); ctx.lineTo(13, -32); ctx.quadraticCurveTo(12, -36, 8, -37); ctx.closePath(); });
  // üzengi (stapes): üzengi kemeri + taban (sağ alt)
  ctx.save(); ctx.translate(5.5, -16); ctx.rotate(0.15);
  ctx.beginPath(); ctx.moveTo(-1.5, 0); ctx.quadraticCurveTo(-7, 6, -6, 12); ctx.moveTo(1.5, 0); ctx.quadraticCurveTo(7, 6, 6, 12);
  ctx.strokeStyle = '#f0e2c2'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = 'rgba(110,80,40,0.55)'; ctx.lineWidth = 0.6; ctx.stroke();
  bone(() => { roundRect(ctx, -8, 11, 16, 3.4, 1.6); });
  bone(() => { ctx.arc(0, -0.5, 2, 0, Math.PI * 2); });
  ctx.restore();
  ctx.restore();
  sparkle(ctx, x + 14, y - 46, 2.2);
}
/** Koklea 1: iki buçuk tur sarmal kabuk */
function koklea1(ctx: Ctx) {
  const [x, y] = top();
  ctx.save(); ctx.translate(x, y - 22);
  const turns = 2.5, N = 120;
  // dış gövde
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 19, 18, 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(-6, -7, 2, 0, 0, 20); g.addColorStop(0, '#dffffb'); g.addColorStop(0.5, '#4fd9d0'); g.addColorStop(1, '#14808a'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(10,60,70,0.7)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  // sarmal çizgisi
  ctx.beginPath();
  for (let i = 0; i <= N; i++) { const t = i / N; const a = t * turns * Math.PI * 2; const r = 17 * (1 - t * 0.9); const px = Math.cos(a) * r, py = Math.sin(a) * r * 0.92; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.stroke();
  ctx.strokeStyle = 'rgba(10,60,70,0.45)'; ctx.lineWidth = 0.6; ctx.stroke();
  // taban: oval ve yuvarlak pencere
  ctx.fillStyle = '#ffd66b'; ctx.beginPath(); ctx.ellipse(-17, 10, 3, 2, -0.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#ff8fb1'; ctx.beginPath(); ctx.arc(-13, 15, 2, 0, 7); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#8a7a6a'; ctx.fillRect(x - 2, y - 6, 4, 6);
}
/** Koklea 2: tüy hücresi (gövde) ve basamaklı stereosilya demeti */
function koklea2(ctx: Ctx) {
  const [x, y] = top();
  ctx.save(); ctx.translate(x, y);
  // hücre gövdesi (şişe biçimi)
  ctx.beginPath(); ctx.moveTo(-8, -26); ctx.quadraticCurveTo(-12, -12, -7, -3); ctx.quadraticCurveTo(0, 2, 7, -3); ctx.quadraticCurveTo(12, -12, 8, -26); ctx.closePath();
  const g = ctx.createLinearGradient(-12, -26, 12, 0); g.addColorStop(0, '#e6ffef'); g.addColorStop(0.5, '#7fe0a8'); g.addColorStop(1, '#2f9e6a'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(20,80,50,0.7)'; ctx.lineWidth = 0.9; ctx.stroke();
  ctx.fillStyle = 'rgba(40,110,80,0.55)'; ctx.beginPath(); ctx.ellipse(0, -11, 3.6, 3.2, 0, 0, 7); ctx.fill();
  // kütikül tabakası
  ctx.fillStyle = '#c9f5da'; roundRect(ctx, -9, -28.5, 18, 3, 1.4); ctx.fill();
  // stereosilya: üç sıra, kısadan uzuna (basamak)
  const rows: [number, number, string][] = [[-6, 9, '#fff3b0'], [0, 15, '#ffd66b'], [6, 22, '#ffb84a']];
  for (const [dx, h, c] of rows) for (const k of [-1.6, 0, 1.6]) { const bx = dx + k * 0.9; ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx, -28); ctx.lineTo(bx + 0.8, -28 - h); ctx.stroke(); }
  // uç bağlantıları
  ctx.strokeStyle = 'rgba(255,92,138,0.85)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-5.2, -37); ctx.lineTo(0.6, -42); ctx.moveTo(0.8, -43); ctx.lineTo(6.6, -49); ctx.stroke();
  ctx.restore();
}
/** Koklea 3: tonotopi arpı — tabanda kısa/ince teller (yüksek frekans), tepede uzun (alçak) */
function koklea3(ctx: Ctx) {
  const [x, y] = top();
  ctx.save(); ctx.translate(x, y);
  // çerçeve: alt kiriş + kavisli üst kol + ön sütun
  const fg = ctx.createLinearGradient(-16, -50, 16, 0); fg.addColorStop(0, '#e4dcff'); fg.addColorStop(0.5, '#8b6bff'); fg.addColorStop(1, '#4a2fb8');
  ctx.strokeStyle = fg; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-15, -3); ctx.lineTo(15, -3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-15, -3); ctx.lineTo(-15, -18); ctx.bezierCurveTo(-8, -50, 10, -44, 15, -20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(15, -3); ctx.lineTo(15, -20); ctx.stroke();
  // tellerin arkasında yarı saydam zar (baziler membran gibi: tabanda dar, tepede geniş)
  ctx.beginPath(); ctx.moveTo(-13, -4.5); ctx.lineTo(-13, -19); ctx.bezierCurveTo(-7, -46, 9, -41, 13.5, -21); ctx.lineTo(13.5, -4.5); ctx.closePath();
  const mg = ctx.createLinearGradient(-13, 0, 13, 0); mg.addColorStop(0, 'rgba(46,230,214,0.28)'); mg.addColorStop(1, 'rgba(255,92,138,0.28)'); ctx.fillStyle = mg; ctx.fill();
  // teller: soldan sağa uzayan, renk turkuaz → pembe (frekans haritası)
  for (let i = 0; i < 8; i++) {
    const t = i / 7; const sx = -11 + t * 22;
    const topY = sx < -8 ? -19 - (sx + 13) * 2 : -19 - Math.sin(((sx + 13) / 26.5) * Math.PI) * 23 + t * 2;
    ctx.strokeStyle = css(shade(mix(0x2ee6d6, 0xff5c8a, t), 0.25)); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(sx, -4.5); ctx.lineTo(sx, topY + 1.5); ctx.stroke();
  }
  // nota süsü
  ctx.fillStyle = '#ffc93c'; ctx.beginPath(); ctx.ellipse(-12, -40, 2.4, 1.8, -0.4, 0, 7); ctx.fill(); ctx.strokeStyle = '#a35a00'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-9.8, -40.5); ctx.lineTo(-9.8, -47); ctx.stroke();
  ctx.restore();
}
/** Sinir: parlayan nöron feneri (gövde, dendritler, akson kaideye iner) */
function sinir(ctx: Ctx) {
  const [x, y] = top();
  ctx.save(); ctx.translate(x, y);
  // akson (miyelin halkalı)
  ctx.strokeStyle = '#d9a400'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -24); ctx.bezierCurveTo(-3, -16, 3, -8, 0, 0); ctx.stroke();
  for (const t of [0.25, 0.55, 0.82]) { const yy = -24 + t * 24; ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.ellipse(Math.sin(t * 6) * 1.2, yy, 2.6, 1.6, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(140,100,0,0.6)'; ctx.lineWidth = 0.5; ctx.stroke(); }
  // dendritler
  ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 1.3;
  for (const [a, l] of [[-2.4, 13], [-1.9, 15], [-1.2, 14], [-0.6, 12], [-3.0, 11]] as const) { const ex = Math.cos(a) * l, ey = -32 + Math.sin(a) * l; ctx.beginPath(); ctx.moveTo(0, -32); ctx.quadraticCurveTo(ex * 0.6 + 2, ey * 0.5 - 16, ex, ey); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a + 0.5) * 4, ey + Math.sin(a + 0.5) * 4); ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a - 0.5) * 4, ey + Math.sin(a - 0.5) * 4); ctx.lineWidth = 0.8; ctx.stroke(); ctx.lineWidth = 1.3; }
  // gövde (soma) + çekirdek
  glowDot(ctx, 0, -32, 16, 0xffe066, 0.9);
  ctx.beginPath(); ctx.arc(0, -32, 6.5, 0, Math.PI * 2); const g = ctx.createRadialGradient(-2, -34, 1, 0, -32, 7); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.6, '#ffd24a'); g.addColorStop(1, '#d08a00'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(140,90,0,0.8)'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = '#b86a00'; ctx.beginPath(); ctx.arc(0.6, -31.4, 2.2, 0, 7); ctx.fill();
  ctx.restore();
}
/** Beyin sapı: iki kulaktan gelen yollar ortadaki ışıklı düğümde buluşur (superior olive) */
function beyinSapi(ctx: Ctx) {
  const [x, y] = top();
  ctx.save(); ctx.translate(x, y);
  // iki küçük sütun + kulak amblemleri
  for (const s of [-1, 1]) {
    const px = s * 12;
    ctx.fillStyle = s < 0 ? '#d8cfbd' : '#a89e8e'; roundRect(ctx, px - 2.6, -20, 5.2, 20, 1.4); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.save(); ctx.translate(px, -24); ctx.scale(s, 1); earGlyph(ctx, 0, 0, 10, 0xff8fa8, 0xffd0d8, 0.7); ctx.restore();
  }
  // kesişen yollar
  ctx.lineCap = 'round';
  for (const [s, c] of [[-1, '#7df3ff'], [1, '#ff8fb1']] as const) {
    ctx.strokeStyle = c; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(s * 9, -24); ctx.bezierCurveTo(s * 3, -26, -s * 2, -32, 0, -38); ctx.stroke();
  }
  // düğüm
  glowDot(ctx, 0, -40, 12, 0x7df3ff, 0.9);
  ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(4, -40); ctx.lineTo(0, -34); ctx.lineTo(-4, -40); ctx.closePath();
  const g = ctx.createLinearGradient(-4, -46, 4, -34); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#7df3ff'); g.addColorStop(1, '#2a8fbf'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(20,70,100,0.7)'; ctx.lineWidth = 0.7; ctx.stroke();
  ctx.restore();
}
/** Korteks: beyin heykeli, şakak lobunda yanan Heschl girusu */
function korteks(ctx: Ctx) {
  const [x, y] = top();
  ctx.save(); ctx.translate(x, y - 2);
  ctx.fillStyle = '#8a7a6a'; ctx.fillRect(-2, -8, 4, 8);
  ctx.beginPath(); ctx.moveTo(-17, -20); ctx.bezierCurveTo(-20, -36, -6, -46, 4, -44); ctx.bezierCurveTo(16, -43, 20, -32, 17, -22); ctx.bezierCurveTo(15, -14, 6, -10, 0, -12); ctx.bezierCurveTo(-6, -8, -15, -11, -17, -20); ctx.closePath();
  const g = ctx.createLinearGradient(-18, -46, 18, -8); g.addColorStop(0, '#ffe0ea'); g.addColorStop(0.5, '#ff9fbf'); g.addColorStop(1, '#c0507a'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(120,30,60,0.75)'; ctx.lineWidth = 1; ctx.stroke();
  // girus çizgileri
  ctx.strokeStyle = 'rgba(150,40,80,0.55)'; ctx.lineWidth = 1; ctx.lineCap = 'round';
  for (const d of ['M-12 -30 Q-6 -36 -2 -30 T8 -32', 'M-8 -40 Q-2 -42 2 -38', 'M4 -40 Q10 -40 12 -34 T14 -26', 'M-14 -22 Q-8 -26 -4 -21']) ctx.stroke(new Path2D(d));
  // Sylvius yarığı + Heschl ışığı (şakak lobu)
  ctx.strokeStyle = 'rgba(120,30,60,0.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-4, -20); ctx.quadraticCurveTo(4, -24, 12, -22); ctx.stroke();
  glowDot(ctx, 4, -18, 10, 0xffd66b, 0.95);
  ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.ellipse(4, -18, 3.6, 1.8, -0.2, 0, 7); ctx.fill();
  // ses dalgası
  ctx.strokeStyle = 'rgba(255,240,200,0.85)'; ctx.lineWidth = 1; for (const r of [5, 9]) { ctx.beginPath(); ctx.arc(-20, -26, r, Math.PI - 0.7, Math.PI + 0.7); ctx.stroke(); }
  ctx.restore();
}

const PAINT: Record<BiomeId, (ctx: Ctx) => void> = {
  'dis-kulak': disKulak, kanal, zar, kemikcikler, 'koklea-1': koklea1, 'koklea-2': koklea2, 'koklea-3': koklea3, sinir, 'beyin-sapi': beyinSapi, korteks,
};

/** anıtı (ya da boş kaideyi) boyar; orijin zemin noktası */
export function paintMonument(ctx: Ctx, region: BiomeId, built: boolean) {
  ctx.save(); ctx.lineJoin = 'round';
  pedestal(ctx, MONUMENT_TINT[region], !built);
  if (built) PAINT[region](ctx);
  else {
    // boş kaide: kesik çizgili hayalet çerçeve + küçük kilit
    const [x, y] = top(-3);
    ctx.setLineDash([2.5, 2]); ctx.strokeStyle = 'rgba(255,246,229,0.55)'; ctx.lineWidth = 1; roundRect(ctx, x - 8, y - 26, 16, 24, 5); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,246,229,0.65)'; roundRect(ctx, x - 3, y - 13, 6, 5, 1); ctx.fill();
    ctx.strokeStyle = 'rgba(255,246,229,0.65)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(x, y - 13, 2.2, Math.PI, 0); ctx.stroke();
  }
  ctx.restore();
}
/** anıt dokusu üstündeki ışık noktası (dünya birimi, orijine göre): sahne parıltı efekti için */
export const MONUMENT_LIGHT: [number, number] = (() => { const [x, y] = P(0, 0, topZ); return [x, y - 30]; })();
