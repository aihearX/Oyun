/**
 * Boss görselleri: Serumen Golemi (20, kanal) ve Gürültü Canavarı (40, korteks).
 * Yalnızca görünüm — fizik/isabet kutuları play/boss.ts'te; bu modül her karede gelen durumu (BossArtState) yansıtır.
 *
 * Boyama: Canvas 2D ile bir kez (silüet + source-atop gölgelendirme, kenar ışığı, parlaklık, doku benekleri) → önbellekli doku.
 * Canlandırma: parçalı kukla (gövde, baş, gözler, kaşlar, ağız, boynuzlar…) + toplamsal ışıklar; tüm hareket sim zamanından (b.t).
 * Anlar durum farkından çıkarılır: can azaldı → vuruş flaşı · faz arttı → dönüşüm · yenildi → patlama.
 * Her saldırının ayrı uyarısı (telegraf): yumruk gölgesi/ışın, duvar parlaması + ok, tavan damlası gölgesi, ağız şarjı, çığlık halkaları.
 */
import Phaser from 'phaser';
import { artOf } from './palette';
import { entitySprite } from './entities';
import type { EntityView } from './view';
import { I, R, T, softGlowTex, sparkTex, ringTex, puffTex, drawGoldNote } from './tex';
import { circle, css, FONT, glow, heartPath, makeCanvas, rng, screenOrigin, taperHair, THEME, tono, type Ctx } from './util';
import { fxQuality } from './quality';

const ADD = Phaser.BlendModes.ADD;
type Img = Phaser.GameObjects.Image;

export interface BossArtState {
  kind: 'golem' | 'canavar'; name: string; hp: number; maxHp: number; phase: number; defeated: boolean; mode: string; t: number;
  fists: { x: number; st: string; t0: number; until: number; slot?: number; hit?: boolean }[];
  balls: { x: number }[]; drops: { x: number; t0: number }[];
  waves: { x: number; kind: 'low' | 'high'; dir?: number }[];
  warnWall: { side: -1 | 1; kind: string } | null; notes: { x: number; y: number; got: boolean }[]; core: { x: number } | null;
  heroX?: number;
}
export interface BossArt { update(b: BossArtState, groundY: number): void; destroy(): void; /** can çubuğu: görünüm genişliğinde ortalı, oyun içi göstergenin inişi kadar aşağıda (tasarım px) */ layout(viewW: number, top: number): void }

// ================================================================ boyama yardımcıları
type Sil = (c: Ctx) => void;
/** silüeti (beyaz dolgu) ayrı tuvale çizer; tasarım biriminde, R ölçekli */
function silCanvas(w: number, h: number, sil: Sil) { const r = R(); const { c, ctx } = makeCanvas(w * r, h * r); ctx.scale(r, r); ctx.fillStyle = '#fff'; sil(ctx); return { c, ctx }; }
/** silüeti tek renge boyanmış tuval */
function tintedSil(w: number, h: number, sil: Sil, color: string) { const s = silCanvas(w, h, sil); s.ctx.globalCompositeOperation = 'source-in'; s.ctx.fillStyle = color; s.ctx.fillRect(0, 0, w, h); return s.c; }
/** kenar hilali: silüet eksi kaydırılmış silüet (kenar ışığı / gölge için) */
function crescent(w: number, h: number, sil: Sil, dx: number, dy: number, color: string) {
  const s = silCanvas(w, h, sil); s.ctx.globalCompositeOperation = 'destination-out'; s.ctx.save(); s.ctx.translate(dx, dy); sil(s.ctx); s.ctx.restore();
  s.ctx.globalCompositeOperation = 'source-in'; s.ctx.fillStyle = color; s.ctx.fillRect(0, 0, w, h); return s.c;
}
/**
 * Boyalı gövde: koyu kontur → silüet içinde (source-atop) gölgelendirme → kenar ışığı hilali → iç gölge hilali.
 * `paint` silüete kırpılmış çizer (gradyanlar, benekler, parlaklık).
 */
function painted(ctx: Ctx, w: number, h: number, sil: Sil, outline: string, ow: number, paint: (c: Ctx) => void, rim?: { color: string; dx: number; dy: number }, shade?: { color: string; dx: number; dy: number }) {
  const ol = tintedSil(w, h, sil, outline);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.drawImage(ol, Math.cos(a) * ow, Math.sin(a) * ow, w, h); }
  const s = silCanvas(w, h, sil); s.ctx.globalCompositeOperation = 'source-atop'; paint(s.ctx);
  if (shade) s.ctx.drawImage(crescent(w, h, sil, shade.dx, shade.dy, shade.color), 0, 0, w, h);
  if (rim) { const cr = crescent(w, h, sil, rim.dx, rim.dy, rim.color); s.ctx.drawImage(cr, 0, 0, w, h); s.ctx.globalAlpha = 0.5; s.ctx.drawImage(cr, rim.dx * -0.4, rim.dy * -0.4, w, h); s.ctx.globalAlpha = 1; }
  ctx.drawImage(s.c, 0, 0, w, h);
}
const blobs = (list: [number, number, number, number?, number?][]): Sil => (c) => { for (const [x, y, rx, ry, rot] of list) { c.beginPath(); c.ellipse(x, y, rx, ry ?? rx, rot ?? 0, 0, Math.PI * 2); c.fill(); } };
function radial(c: Ctx, x: number, y: number, r0: number, r1: number, stops: [number, string][], w: number, h: number) {
  const g = c.createRadialGradient(x, y, r0, x, y, r1); for (const [t, s] of stops) g.addColorStop(t, s); c.fillStyle = g; c.fillRect(0, 0, w, h);
}
function specks(c: Ctx, w: number, h: number, seed: number, n: number, cols: string[], size = 2.2) {
  const rnd = rng(seed); for (let i = 0; i < n; i++) { c.fillStyle = cols[Math.floor(rnd() * cols.length)]!; const s = 0.6 + rnd() * size; c.beginPath(); c.ellipse(rnd() * w, rnd() * h, s, s * (0.5 + rnd() * 0.6), rnd() * 3, 0, Math.PI * 2); c.fill(); }
}
function gloss(c: Ctx, x: number, y: number, rx: number, ry: number, rot: number, a = 0.7) {
  const g = c.createRadialGradient(x, y, 0, x, y, rx); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(1, ry / rx); c.translate(-x, -y); c.fillStyle = g; circle(c, x, y, rx); c.fill(); c.restore();
}
/** parlak eriyik damla (balmumu) */
function waxDrip(c: Ctx, x: number, y: number, len: number, wd: number, col: string, hi: string) {
  c.fillStyle = col; c.beginPath(); c.moveTo(x - wd / 2, y); c.lineTo(x - wd * 0.42, y + len - wd * 0.6); c.arc(x, y + len - wd * 0.6, wd * 0.48, Math.PI, 0, true); c.lineTo(x + wd / 2, y); c.closePath(); c.fill();
  c.fillStyle = hi; c.beginPath(); c.ellipse(x - wd * 0.18, y + len - wd * 0.75, wd * 0.12, wd * 0.22, 0, 0, Math.PI * 2); c.fill();
}
/** kırık/çatlak ağı (ışıklı damarlar) */
function cracks(c: Ctx, seed: number, starts: [number, number, number][], len: number, col: string, wd: number) {
  const rnd = rng(seed); c.lineCap = 'round'; c.lineJoin = 'round';
  const branch = (x: number, y: number, a: number, l: number, w: number, d: number) => {
    c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x, y); let px = x, py = y;
    const n = 4 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) { a += (rnd() - 0.5) * 0.7; const nx = px + Math.cos(a) * l / n, ny = py + Math.sin(a) * l / n; c.quadraticCurveTo(px + (nx - px) * 0.5 + (rnd() - 0.5) * 4, py + (ny - py) * 0.5 + (rnd() - 0.5) * 4, nx, ny); px = nx; py = ny; if (d < 1 && rnd() < 0.22) { c.stroke(); branch(px, py, a + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.5), l * 0.45, w * 0.6, d + 1); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(px, py); } }
    c.stroke();
  };
  for (const [x, y, a] of starts) branch(x, y, a, len, wd, 0);
}

// ================================================================ ortak dokular
const targetTex = (s: Phaser.Scene) => T(s, 'bs-target', 124, 36, (c) => {
  const g = c.createRadialGradient(62, 18, 2, 62, 18, 58); g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(0.6, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.save(); c.translate(62, 18); c.scale(1, 0.28); c.translate(-62, -18); c.fillStyle = g; circle(c, 62, 18, 58); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 5; circle(c, 62, 18, 50); c.stroke(); c.lineWidth = 3; c.setLineDash([10, 8]); circle(c, 62, 18, 32); c.stroke(); c.restore();
});
const beamTex = (s: Phaser.Scene) => T(s, 'bs-beam', 40, 160, (c) => {
  const g = c.createLinearGradient(0, 0, 40, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 40, 160);
  c.globalCompositeOperation = 'destination-in'; const v = c.createLinearGradient(0, 0, 0, 160); v.addColorStop(0, 'rgba(0,0,0,0.1)'); v.addColorStop(1, 'rgba(0,0,0,1)'); c.fillStyle = v; c.fillRect(0, 0, 40, 160);
});
/** duvar uyarısı: duvardan içeri sönen ışık (sol duvar için; sağda flipX) */
const wallGlowTex = (s: Phaser.Scene) => T(s, 'bs-wall', 60, 120, (c) => {
  const g = c.createLinearGradient(0, 0, 60, 0); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 60, 120);
  c.globalCompositeOperation = 'destination-in'; const v = c.createLinearGradient(0, 0, 0, 120); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.25, 'rgba(0,0,0,1)'); v.addColorStop(0.75, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = v; c.fillRect(0, 0, 60, 120);
});
const chevTex = (s: Phaser.Scene) => T(s, 'bs-chev', 30, 30, (c) => {
  c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = 'rgba(20,0,30,0.55)'; c.lineWidth = 8; c.beginPath(); c.moveTo(9, 5); c.lineTo(21, 15); c.lineTo(9, 25); c.stroke();
  c.strokeStyle = '#ffffff'; c.lineWidth = 5; c.beginPath(); c.moveTo(9, 5); c.lineTo(21, 15); c.lineTo(9, 25); c.stroke();
});
/** zıpla / kay rozeti (dalga türünü okutur) */
const badgeTex = (s: Phaser.Scene, up: boolean) => T(s, `bs-badge-${up ? 'up' : 'down'}`, 40, 40, (c) => {
  glow(c, 20, 20, 20, up ? THEME.coral : THEME.violet, 0.6);
  circle(c, 20, 20, 13); const g = c.createLinearGradient(0, 7, 0, 33); g.addColorStop(0, '#3a2788'); g.addColorStop(1, '#1a1046'); c.fillStyle = g; c.fill(); c.strokeStyle = css(up ? THEME.coral : 0xb69bff); c.lineWidth = 2; c.stroke();
  c.strokeStyle = '#fff6e5'; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
  if (up) { c.moveTo(20, 27); c.lineTo(20, 13); c.moveTo(14, 18); c.lineTo(20, 12); c.lineTo(26, 18); } else { c.moveTo(20, 13); c.lineTo(20, 27); c.moveTo(14, 22); c.lineTo(20, 28); c.lineTo(26, 22); }
  c.stroke();
});
/** "buraya çakıl" oku (altın, aşağı) */
const downTex = (s: Phaser.Scene) => T(s, 'bs-down', 34, 30, (c) => {
  glow(c, 17, 14, 16, THEME.gold, 0.55); c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [y, a] of [[6, 0.6], [14, 1]] as [number, number][]) { c.strokeStyle = `rgba(90,40,0,${0.6 * a})`; c.lineWidth = 7; c.beginPath(); c.moveTo(7, y); c.lineTo(17, y + 9); c.lineTo(27, y); c.stroke(); c.strokeStyle = `rgba(255,214,90,${a})`; c.lineWidth = 4; c.beginPath(); c.moveTo(7, y); c.lineTo(17, y + 9); c.lineTo(27, y); c.stroke(); }
});
const noteTex = (s: Phaser.Scene) => T(s, 'bs-note', 24, 26, (c) => drawGoldNote(c, 12, 13, 18, false));
const barPanelTex = (s: Phaser.Scene) => T(s, 'bs-bar-panel', 296, 54, (c) => {
  c.save(); c.shadowColor = 'rgba(5,0,25,0.6)'; c.shadowBlur = 10; c.shadowOffsetY = 3; c.beginPath(); c.roundRect(8, 6, 280, 40, 14);
  const g = c.createLinearGradient(0, 6, 0, 46); g.addColorStop(0, css(0x3a2788, 0.92)); g.addColorStop(1, css(0x1a1046, 0.94)); c.fillStyle = g; c.fill(); c.restore();
  c.save(); c.beginPath(); c.roundRect(8, 6, 280, 40, 14); c.clip(); const sh = c.createLinearGradient(0, 6, 0, 26); sh.addColorStop(0, 'rgba(255,255,255,0.16)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = sh; c.fillRect(8, 6, 280, 20); c.restore();
  c.beginPath(); c.roundRect(8.75, 6.75, 278.5, 38.5, 13.5); c.strokeStyle = css(THEME.gold, 0.7); c.lineWidth = 1.5; c.stroke();
  // çubuk yuvası
  c.beginPath(); c.roundRect(46, 29, 232, 10, 5); c.fillStyle = 'rgba(8,2,26,0.85)'; c.fill(); c.strokeStyle = 'rgba(255,201,60,0.35)'; c.lineWidth = 1; c.stroke();
});
const barFillTex = (s: Phaser.Scene) => T(s, 'bs-bar-fill', 230, 8, (c) => {
  c.beginPath(); c.roundRect(0, 0, 230, 8, 4); const g = c.createLinearGradient(0, 0, 230, 0); g.addColorStop(0, '#ff3d6e'); g.addColorStop(0.6, '#ff5c8a'); g.addColorStop(1, '#ffb36b'); c.fillStyle = g; c.fill();
  c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.roundRect(3, 1.2, 224, 2, 1); c.fill();
});
const pipTex = (s: Phaser.Scene, lit: boolean) => T(s, `bs-pip-${lit ? 1 : 0}`, 12, 12, (c) => {
  c.beginPath(); c.moveTo(6, 1); c.lineTo(11, 6); c.lineTo(6, 11); c.lineTo(1, 6); c.closePath(); c.fillStyle = lit ? css(THEME.coral) : css(0x2a1b63); c.fill(); c.strokeStyle = lit ? '#ffe0ea' : 'rgba(201,193,255,0.6)'; c.lineWidth = 1.2; c.stroke();
});

// ================================================================ Serumen Golemi dokuları
const G = { hi: '#fff0b8', light: '#ffd36a', mid: '#f0a030', deep: '#b8661a', dark: '#6a300c', ink: '#2a0c04', rim: 'rgba(255,214,120,0.95)' };
const GT_W = 300, GT_H = 260;
const golemTorsoSil: Sil = blobs([[150, 150, 122, 90], [62, 104, 50], [238, 104, 50], [150, 96, 98, 66], [150, 190, 116, 64], [44, 168, 40], [256, 170, 38], [108, 64, 42], [192, 62, 42], [150, 228, 96, 34]]);
const golemTorsoTex = (s: Phaser.Scene) => T(s, 'bs-g-torso', GT_W, GT_H, (ctx, w, h) => {
  glow(ctx, 150, 140, 150, 0xff9f1c, 0.25);
  painted(ctx, w, h, golemTorsoSil, G.ink, 3, (c) => {
    radial(c, 120, 60, 10, 230, [[0, '#f6c560'], [0.28, '#e09a34'], [0.62, '#a85a18'], [1, '#4a1e06']], w, h);
    // birkaç yumuşak eriyik tabaka (balmumu akıntısı)
    for (let i = 0; i < 3; i++) { const y = 110 + i * 38; c.beginPath(); c.moveTo(10, y); for (let x = 10; x <= 290; x += 28) c.quadraticCurveTo(x + 14, y + 10 + Math.sin(x * 0.05 + i * 2) * 8, x + 28, y + Math.sin((x + 28) * 0.04 + i) * 5); c.lineTo(290, y + 18); c.lineTo(10, y + 18); c.closePath(); c.fillStyle = 'rgba(74,30,6,0.16)'; c.fill();
      c.beginPath(); c.moveTo(10, y - 1); for (let x = 10; x <= 290; x += 28) c.quadraticCurveTo(x + 14, y + 9 + Math.sin(x * 0.05 + i * 2) * 8, x + 28, y - 1 + Math.sin((x + 28) * 0.04 + i) * 5); c.strokeStyle = 'rgba(255,224,150,0.22)'; c.lineWidth = 2; c.stroke(); }
    specks(c, w, h, 41, 140, ['rgba(60,20,4,0.45)', 'rgba(255,240,184,0.35)', 'rgba(140,70,20,0.5)']);
    // gömülü kıllar ve toz
    const rnd = rng(77); for (let i = 0; i < 26; i++) taperHair(c, 30 + rnd() * 240, 60 + rnd() * 170, 10 + rnd() * 16, rnd() * 6.28, (rnd() - 0.5) * 2, 1.6, 0x3a1606, 0.55);
    // alt koyulaşma (derinlikten yükselir)
    const ao = c.createLinearGradient(0, 150, 0, h); ao.addColorStop(0, 'rgba(42,12,4,0)'); ao.addColorStop(1, 'rgba(42,12,4,0.85)'); c.fillStyle = ao; c.fillRect(0, 0, w, h);
    gloss(c, 96, 74, 40, 16, -0.4, 0.55); gloss(c, 60, 90, 18, 9, -0.6, 0.6); gloss(c, 214, 82, 22, 9, 0.3, 0.3); gloss(c, 120, 150, 26, 10, -0.2, 0.25);
  }, { color: G.rim, dx: -7, dy: 5 }, { color: 'rgba(42,12,4,0.45)', dx: 10, dy: -12 });
  // omuzlardan ve göbekten sarkan damlalar
  const rnd = rng(9); for (let i = 0; i < 9; i++) { const x = 60 + i * 23 + rnd() * 8; waxDrip(ctx, x, 236 + rnd() * 6, 10 + rnd() * 18, 7 + rnd() * 5, G.deep, 'rgba(255,240,184,0.55)'); }
  // derinliğe karışan alt kenar
  ctx.globalCompositeOperation = 'destination-out'; const f = ctx.createLinearGradient(0, 200, 0, h); f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(0,0,0,0.9)'); ctx.fillStyle = f; ctx.fillRect(0, 200, w, h - 200); ctx.globalCompositeOperation = 'source-over';
});
const GH_W = 190, GH_H = 160;
const golemHeadSil: Sil = blobs([[95, 88, 80, 62], [64, 40, 32], [124, 38, 34], [95, 32, 28], [24, 98, 26], [166, 98, 26], [95, 128, 54, 24]]);
const golemHeadTex = (s: Phaser.Scene) => T(s, 'bs-g-head', GH_W, GH_H, (ctx, w, h) => {
  // tepe kılları (kulak kılı!)
  const rnd = rng(5); for (let i = 0; i < 9; i++) taperHair(ctx, 60 + i * 9 + rnd() * 6, 22 + rnd() * 6, 22 + rnd() * 16, -Math.PI / 2 + (i - 4) * 0.22, (rnd() - 0.5) * 2.4, 3.2, 0x3a1606, 0.95, i % 3 ? undefined : 0xffc93c);
  painted(ctx, w, h, golemHeadSil, G.ink, 3, (c) => {
    radial(c, 70, 44, 6, 150, [[0, G.hi], [0.25, G.light], [0.6, G.mid], [1, G.deep]], w, h);
    specks(c, w, h, 13, 70, ['rgba(60,20,4,0.4)', 'rgba(255,240,184,0.4)']);
    // göz çukurları
    for (const x of [58, 132]) { const g = c.createRadialGradient(x, 82, 2, x, 82, 30); g.addColorStop(0, 'rgba(40,10,2,0.95)'); g.addColorStop(0.55, 'rgba(60,18,4,0.7)'); g.addColorStop(1, 'rgba(60,18,4,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(x, 82, 30, 24, 0, 0, Math.PI * 2); c.fill(); }
    // burun yumrusu
    c.fillStyle = 'rgba(106,48,12,0.35)'; c.beginPath(); c.ellipse(97, 108, 16, 9, 0, 0, Math.PI * 2); c.fill(); gloss(c, 92, 104, 9, 4, 0, 0.6);
    const ao = c.createLinearGradient(0, 100, 0, h); ao.addColorStop(0, 'rgba(42,12,4,0)'); ao.addColorStop(1, 'rgba(42,12,4,0.6)'); c.fillStyle = ao; c.fillRect(0, 0, w, h);
    gloss(c, 66, 40, 28, 12, -0.5, 0.75); gloss(c, 124, 30, 14, 6, 0.2, 0.5);
  }, { color: G.rim, dx: -6, dy: 4 }, { color: 'rgba(42,12,4,0.4)', dx: 8, dy: -8 });
  for (let i = 0; i < 4; i++) waxDrip(ctx, 64 + i * 20, 146, 6 + (i % 2) * 8, 7, G.mid, 'rgba(255,240,184,0.6)');
});
const golemEyeTex = (s: Phaser.Scene) => T(s, 'bs-g-eye', 44, 36, (c) => {
  glow(c, 22, 18, 22, 0xff9f1c, 0.7);
  c.beginPath(); c.ellipse(22, 18, 15, 12, 0, 0, Math.PI * 2); const g = c.createRadialGradient(19, 15, 1, 22, 18, 15); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#fff3b0'); g.addColorStop(0.75, '#ffb020'); g.addColorStop(1, '#ff5a00'); c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(60,10,0,0.8)'; c.lineWidth = 1.6; c.stroke();
});
const golemPupilTex = (s: Phaser.Scene) => T(s, 'bs-g-pupil', 12, 18, (c) => { c.beginPath(); c.ellipse(6, 9, 4.4, 7.4, 0, 0, Math.PI * 2); c.fillStyle = '#2a0800'; c.fill(); c.fillStyle = 'rgba(255,255,255,0.85)'; circle(c, 4.6, 5.6, 1.3); c.fill(); });
const golemBrowTex = (s: Phaser.Scene) => T(s, 'bs-g-brow', 66, 26, (ctx, w, h) => {
  const sil: Sil = blobs([[33, 13, 28, 9, -0.05], [12, 14, 9], [52, 12, 11]]);
  painted(ctx, w, h, sil, G.ink, 2, (c) => { const g = c.createLinearGradient(0, 2, 0, 24); g.addColorStop(0, G.light); g.addColorStop(0.5, G.mid); g.addColorStop(1, G.dark); c.fillStyle = g; c.fillRect(0, 0, w, h); gloss(c, 26, 8, 14, 3, 0, 0.7); }, { color: G.rim, dx: 0, dy: 3 });
});
const golemMouthTex = (s: Phaser.Scene, open: boolean) => T(s, `bs-g-mouth-${open ? 1 : 0}`, 96, 64, (c) => {
  if (!open) {
    // dişli, kızgın sırıtış: çatlaktan kor ışığı sızar
    glow(c, 48, 32, 40, 0xff7a1c, 0.35);
    c.beginPath(); c.moveTo(12, 28); c.quadraticCurveTo(48, 18, 84, 28); c.quadraticCurveTo(80, 42, 48, 44); c.quadraticCurveTo(16, 42, 12, 28); c.closePath();
    c.fillStyle = '#2a0802'; c.fill(); c.strokeStyle = G.ink; c.lineWidth = 2.4; c.stroke();
    const g = c.createLinearGradient(0, 30, 0, 44); g.addColorStop(0, 'rgba(255,120,20,0)'); g.addColorStop(1, 'rgba(255,140,30,0.85)'); c.fillStyle = g; c.fill();
    c.fillStyle = '#fff1c8'; for (let i = 0; i < 6; i++) { const x = 20 + i * 11.5; c.beginPath(); c.moveTo(x, 25 - Math.sin(i / 5 * Math.PI) * 3); c.lineTo(x + 9, 24 - Math.sin(i / 5 * Math.PI) * 3); c.lineTo(x + 4.5, 32); c.closePath(); c.fill(); }
  } else {
    glow(c, 48, 36, 46, 0xff5a1c, 0.5);
    c.beginPath(); c.ellipse(48, 34, 36, 24, 0, 0, Math.PI * 2); c.fillStyle = '#1a0400'; c.fill(); c.strokeStyle = G.ink; c.lineWidth = 3; c.stroke();
    const g = c.createRadialGradient(48, 44, 2, 48, 40, 28); g.addColorStop(0, 'rgba(255,200,80,1)'); g.addColorStop(0.4, 'rgba(255,110,20,0.8)'); g.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(48, 34, 34, 22, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff1c8'; c.strokeStyle = 'rgba(80,30,0,0.6)'; c.lineWidth = 1;
    for (let i = 0; i < 6; i++) { const x = 20 + i * 10.5; const yy = 12 + Math.abs(i - 2.5) * 2.2; c.beginPath(); c.moveTo(x, yy); c.lineTo(x + 9, yy); c.lineTo(x + 4.5, yy + 11); c.closePath(); c.fill(); c.stroke(); }
    for (let i = 0; i < 5; i++) { const x = 25 + i * 10.5; const yy = 56 - Math.abs(i - 2) * 2.2; c.beginPath(); c.moveTo(x, yy); c.lineTo(x + 9, yy); c.lineTo(x + 4.5, yy - 9); c.closePath(); c.fill(); c.stroke(); }
    waxDrip(c, 30, 14, 14, 4, 'rgba(255,214,106,0.9)', 'rgba(255,255,255,0.6)');
  }
});
/** yumruk: üstü düz el sırtı (kahraman üstünde durur), altta boğum sırası. İsabet kutusu 80×64 → doku 104×88, kutu (12..92, 16..80) */
const golemFistTex = (s: Phaser.Scene) => T(s, 'bs-g-fist', 104, 88, (ctx, w, h) => {
  const sil: Sil = (c) => { c.beginPath(); c.roundRect(12, 16, 80, 52, [18, 18, 10, 10]); c.fill(); for (const [x, r] of [[23, 13], [42, 13.5], [62, 13.5], [81, 13]] as [number, number][]) { c.beginPath(); c.ellipse(x, 66, r, 13, 0, 0, Math.PI * 2); c.fill(); } c.beginPath(); c.ellipse(16, 46, 13, 20, 0.2, 0, Math.PI * 2); c.fill(); };
  painted(ctx, w, h, sil, G.ink, 2.5, (c) => {
    const g = c.createLinearGradient(0, 14, 0, 82); g.addColorStop(0, G.hi); g.addColorStop(0.25, G.light); g.addColorStop(0.7, G.mid); g.addColorStop(1, G.deep); c.fillStyle = g; c.fillRect(0, 0, w, h);
    // parmak araları ve başparmak
    c.strokeStyle = 'rgba(106,48,12,0.75)'; c.lineWidth = 2.2; c.lineCap = 'round';
    for (const x of [32.5, 52, 71.5]) { c.beginPath(); c.moveTo(x, 50); c.lineTo(x, 76); c.stroke(); }
    c.beginPath(); c.moveTo(10, 40); c.quadraticCurveTo(24, 36, 34, 46); c.stroke();
    specks(c, w, h, 3, 40, ['rgba(60,20,4,0.35)', 'rgba(255,240,184,0.45)']);
    for (const x of [23, 42, 62, 81]) gloss(c, x - 3, 62, 6, 3, 0, 0.7);
    gloss(c, 40, 22, 26, 5, 0, 0.8);
  }, { color: G.rim, dx: -4, dy: 4 }, { color: 'rgba(42,12,4,0.45)', dx: 4, dy: -6 });
  // üst kenar: basılacak yer — ince altın çizgi
  ctx.strokeStyle = 'rgba(255,240,184,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(26, 17.5); ctx.lineTo(78, 17.5); ctx.stroke();
});
const golemFistCrackTex = (s: Phaser.Scene) => T(s, 'bs-g-fistcrack', 104, 88, (c) => { cracks(c, 21, [[52, 18, 1.6], [40, 30, 2.4], [66, 30, 0.8]], 44, '#fff3b0', 2.4); });
const golemBallTex = (s: Phaser.Scene) => T(s, 'bs-g-ball', 44, 44, (ctx, w, h) => {
  const sil: Sil = (c) => { circle(c, 22, 22, 17); c.fill(); };
  painted(ctx, w, h, sil, G.ink, 2, (c) => {
    c.fillStyle = G.mid; c.fillRect(0, 0, w, h);
    c.strokeStyle = G.deep; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 3.2; const r = 2 + i * 0.36; const x = 22 + Math.cos(a) * r, y = 22 + Math.sin(a) * r; if (!i) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
    c.strokeStyle = 'rgba(255,240,184,0.55)'; c.lineWidth = 1.6; c.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 3.2; const r = 1 + i * 0.36; const x = 21 + Math.cos(a) * r, y = 21 + Math.sin(a) * r; if (!i) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
    const rnd = rng(31); for (let i = 0; i < 6; i++) taperHair(c, 8 + rnd() * 28, 8 + rnd() * 28, 8 + rnd() * 6, rnd() * 6.28, 1, 1.3, 0x3a1606, 0.7);
  });
});
const golemBallHiTex = (s: Phaser.Scene) => T(s, 'bs-g-ballhi', 44, 44, (c) => {
  c.save(); circle(c, 22, 22, 17); c.clip();
  const ao = c.createRadialGradient(16, 14, 4, 22, 22, 22); ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(0.7, 'rgba(42,12,4,0.1)'); ao.addColorStop(1, 'rgba(42,12,4,0.55)'); c.fillStyle = ao; c.fillRect(0, 0, 44, 44);
  c.strokeStyle = G.rim; c.lineWidth = 2.5; c.beginPath(); c.arc(23, 23, 16, 0.1, 1.6); c.stroke(); c.restore();
  gloss(c, 15, 14, 7, 4, -0.6, 0.85);
});
const golemDripTex = (s: Phaser.Scene) => T(s, 'bs-g-drip', 40, 56, (ctx, w, h) => {
  const sil: Sil = (c) => { c.beginPath(); c.moveTo(20, 2); c.bezierCurveTo(24, 18, 34, 26, 34, 38); c.arc(20, 38, 14, 0, Math.PI); c.bezierCurveTo(6, 26, 16, 18, 20, 2); c.fill(); };
  glow(ctx, 20, 38, 20, 0xff9f1c, 0.4);
  painted(ctx, w, h, sil, G.ink, 2, (c) => { radial(c, 15, 30, 2, 28, [[0, G.hi], [0.35, G.light], [0.8, G.mid], [1, G.deep]], w, h); gloss(c, 14, 34, 5, 8, 0.2, 0.9); }, { color: G.rim, dx: -3, dy: -2 });
});
const golemCrackTex = (s: Phaser.Scene, lvl: 2 | 3, head: boolean) => T(s, `bs-g-crack${lvl}${head ? 'h' : 't'}`, head ? GH_W : GT_W, head ? GH_H : GT_H, (c, w, h) => {
  // yalnızca gövde içine düşen kor damarları (toplamsal)
  const sil = head ? golemHeadSil : golemTorsoSil;
  const m = silCanvas(w, h, sil);
  const { c: cv, ctx: cc } = makeCanvas(w * R(), h * R()); cc.scale(R(), R());
  // dikişler kenarlardan içeri uzanır; yüz (göz/ağız) ve göğüs ortası boş kalır
  const starts: [number, number, number][] = head
    ? (lvl === 2 ? [[30, 60, 0.3]] : [[28, 104, -0.2], [168, 70, 2.9]])
    : (lvl === 2 ? [[34, 150, 0.15], [262, 120, 2.9]] : [[60, 76, 0.7], [244, 196, 3.5], [110, 214, -1.1]]);
  const seed = lvl * 17 + (head ? 3 : 0); const len = head ? 40 : 70;
  cracks(cc, seed, starts, len, 'rgba(255,90,10,0.3)', 9); cracks(cc, seed, starts, len, 'rgba(255,122,20,0.9)', 3.4); cracks(cc, seed, starts, len, '#ffe08a', 1.2);
  cc.globalCompositeOperation = 'destination-in'; cc.drawImage(m.c, 0, 0, w, h);
  c.drawImage(cv, 0, 0, w, h);
});
const chipTex = (s: Phaser.Scene, i: number) => T(s, `bs-g-chip${i}`, 18, 16, (ctx, w, h) => {
  const rnd = rng(100 + i); const pts: [number, number][] = []; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const r = 5 + rnd() * 3; pts.push([9 + Math.cos(a) * r, 8 + Math.sin(a) * r * 0.8]); }
  const sil: Sil = (c) => { c.beginPath(); pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); };
  painted(ctx, w, h, sil, G.ink, 1.2, (c) => { radial(c, 6, 5, 1, 12, [[0, G.light], [1, G.deep]], w, h); }, { color: G.rim, dx: -2, dy: 2 });
});

// ================================================================ Gürültü Canavarı dokuları
const M = { core: '#160622', body: '#3a1052', mid: '#5a1f78', hi: '#8a46b0', mag: '#ff4fd8', pink: '#ff9ad8', cyan: '#4cf0ff', ink: '#0a0212' };
const CF_W = 360, CF_H = 320;
const furTex = (s: Phaser.Scene, layer: 0 | 1) => T(s, `bs-c-fur${layer}`, CF_W, CF_H, (ctx, w, h) => {
  const rnd = rng(layer ? 91 : 57); const n = layer ? 26 : 34; const cx = 180, cy = 160;
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2 + (layer ? 0.09 : 0); const out = i % 2 === 0; const r = out ? (layer ? 128 : 150) + rnd() * (layer ? 22 : 26) : (layer ? 98 : 112) + rnd() * 6; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.86]); }
  const sil: Sil = (c) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); };
  if (!layer) glow(ctx, cx, cy, 175, 0xff4fd8, 0.3);
  painted(ctx, w, h, sil, M.ink, 2.5, (c) => {
    radial(c, cx, cy, 60, layer ? 150 : 172, [[0, M.core], [0.62, layer ? M.mid : M.body], [0.86, layer ? '#a02a9a' : '#6a1a7a'], [1, layer ? M.pink : M.mag]], w, h);
    specks(c, w, h, layer ? 7 : 8, 260, ['rgba(255,255,255,0.18)', 'rgba(76,240,255,0.25)', 'rgba(255,79,216,0.3)'], 1.4);
  }, { color: layer ? 'rgba(255,154,216,0.8)' : 'rgba(76,240,255,0.55)', dx: layer ? -5 : 6, dy: layer ? 5 : -4 });
});
const CB_W = 250, CB_H = 220;
const canBodySil: Sil = blobs([[125, 118, 108, 92], [78, 52, 44, 32], [172, 52, 44, 32], [125, 178, 86, 38]]);
const canBodyTex = (s: Phaser.Scene) => T(s, 'bs-c-body', CB_W, CB_H, (ctx, w, h) => {
  painted(ctx, w, h, canBodySil, M.ink, 3, (c) => {
    radial(c, 96, 64, 8, 190, [[0, M.hi], [0.35, M.mid], [0.75, M.body], [1, M.core]], w, h);
    // televizyon karlanması: tarama çizgileri + parazit
    c.fillStyle = 'rgba(255,255,255,0.045)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1.4);
    specks(c, w, h, 19, 320, ['rgba(255,255,255,0.22)', 'rgba(76,240,255,0.3)', 'rgba(255,79,216,0.35)', 'rgba(0,0,0,0.3)'], 1.2);
    const rnd = rng(4); for (let i = 0; i < 7; i++) { c.fillStyle = `rgba(${rnd() < 0.5 ? '76,240,255' : '255,79,216'},${0.12 + rnd() * 0.12})`; c.fillRect(rnd() * w, rnd() * h, 30 + rnd() * 60, 2 + rnd() * 3); }
    const ao = c.createLinearGradient(0, 120, 0, h); ao.addColorStop(0, 'rgba(10,2,18,0)'); ao.addColorStop(1, 'rgba(10,2,18,0.7)'); c.fillStyle = ao; c.fillRect(0, 0, w, h);
    gloss(c, 80, 48, 34, 12, -0.5, 0.45); gloss(c, 176, 40, 14, 6, 0.4, 0.3);
  }, { color: 'rgba(255,154,216,0.95)', dx: -7, dy: 6 }, { color: 'rgba(76,240,255,0.5)', dx: 8, dy: -7 });
});
const canGhostTex = (s: Phaser.Scene) => T(s, 'bs-c-ghost', CB_W, CB_H, (c, w, h) => { c.drawImage(tintedSil(w, h, canBodySil, '#ffffff'), 0, 0, w, h); });
const canEyeTex = (s: Phaser.Scene) => T(s, 'bs-c-eye', 60, 60, (c) => {
  glow(c, 30, 30, 30, 0xff4fd8, 0.65);
  circle(c, 30, 30, 20); c.fillStyle = '#12021c'; c.fill(); c.strokeStyle = M.ink; c.lineWidth = 2; c.stroke();
  const g = c.createRadialGradient(27, 26, 1, 30, 30, 17); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#ffc4ee'); g.addColorStop(0.7, M.mag); g.addColorStop(1, '#8a0a6a'); circle(c, 30, 30, 16.5); c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(80,0,60,0.45)'; c.lineWidth = 1.2; for (const r of [7, 11, 14.5]) { circle(c, 30, 30, r); c.stroke(); }
});
const canPupilTex = (s: Phaser.Scene) => T(s, 'bs-c-pupil', 14, 24, (c) => { c.beginPath(); c.ellipse(7, 12, 4.6, 10, 0, 0, Math.PI * 2); c.fillStyle = '#0a0010'; c.fill(); c.fillStyle = 'rgba(255,255,255,0.95)'; circle(c, 5.2, 6.4, 1.6); c.fill(); });
const canMouthTex = (s: Phaser.Scene, open: boolean) => T(s, `bs-c-mouth-${open ? 1 : 0}`, 150, 104, (c) => {
  const teethTop = (y: number, x0: number, x1: number, n: number, len: number) => { const st = (x1 - x0) / n; for (let i = 0; i < n; i++) { const x = x0 + i * st; const g = c.createLinearGradient(0, y, 0, y + len); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ffc4ee'); c.fillStyle = g; c.beginPath(); c.moveTo(x, y); c.lineTo(x + st, y); c.lineTo(x + st / 2, y + len * (0.8 + (i % 2) * 0.3)); c.closePath(); c.fill(); c.strokeStyle = 'rgba(60,0,40,0.6)'; c.lineWidth = 1; c.stroke(); } };
  const teethBot = (y: number, x0: number, x1: number, n: number, len: number) => { const st = (x1 - x0) / n; for (let i = 0; i < n; i++) { const x = x0 + i * st; c.fillStyle = '#ffe4f6'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + st, y); c.lineTo(x + st / 2, y - len * (0.7 + ((i + 1) % 2) * 0.3)); c.closePath(); c.fill(); c.strokeStyle = 'rgba(60,0,40,0.6)'; c.lineWidth = 1; c.stroke(); } };
  if (!open) {
    glow(c, 75, 52, 60, 0xff4fd8, 0.35);
    c.beginPath(); c.moveTo(18, 46); for (let i = 0; i <= 12; i++) c.lineTo(18 + i * 9.5, 46 + (i % 2 ? 9 : 0) + Math.sin(i / 12 * Math.PI) * 6); c.lineTo(132, 46); c.quadraticCurveTo(75, 76, 18, 46); c.closePath();
    c.fillStyle = '#12021c'; c.fill(); c.strokeStyle = M.ink; c.lineWidth = 2.5; c.stroke();
    const g = c.createLinearGradient(0, 50, 0, 70); g.addColorStop(0, 'rgba(255,79,216,0)'); g.addColorStop(1, 'rgba(255,79,216,0.7)'); c.fillStyle = g; c.fill();
    teethTop(44, 26, 124, 9, 11); teethBot(66, 36, 114, 7, 9);
  } else {
    glow(c, 75, 52, 74, 0xff4fd8, 0.55);
    c.beginPath(); c.ellipse(75, 52, 60, 40, 0, 0, Math.PI * 2); c.fillStyle = '#0c0014'; c.fill(); c.strokeStyle = M.ink; c.lineWidth = 3; c.stroke();
    // hoparlör konisi: iç içe halkalar
    for (let i = 6; i >= 1; i--) { c.beginPath(); c.ellipse(75, 56, i * 8.5, i * 5.6, 0, 0, Math.PI * 2); c.strokeStyle = `rgba(255,${79 + i * 20},216,${0.25 + (6 - i) * 0.1})`; c.lineWidth = 2.4; c.stroke(); }
    const cg = c.createRadialGradient(75, 56, 1, 75, 56, 16); cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.4, M.mag); cg.addColorStop(1, 'rgba(255,79,216,0)'); c.fillStyle = cg; circle(c, 75, 56, 16); c.fill();
    teethTop(16, 28, 122, 9, 16); teethBot(90, 36, 114, 7, 13);
  }
});
const hornTex = (s: Phaser.Scene) => T(s, 'bs-c-horn', 56, 86, (ctx, w, h) => {
  const sil: Sil = (c) => { c.beginPath(); c.moveTo(8, 84); c.quadraticCurveTo(0, 40, 40, 6); c.quadraticCurveTo(48, 0, 50, 6); c.quadraticCurveTo(26, 40, 34, 84); c.closePath(); c.fill(); };
  painted(ctx, w, h, sil, M.ink, 2, (c) => {
    const g = c.createLinearGradient(0, 86, 0, 0); g.addColorStop(0, M.core); g.addColorStop(0.55, M.mid); g.addColorStop(1, M.pink); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,154,216,0.4)'; c.lineWidth = 2; for (let i = 0; i < 6; i++) { const y = 74 - i * 11; c.beginPath(); c.moveTo(4 + i * 3, y); c.quadraticCurveTo(18 + i * 3, y - 6, 32 + i * 2, y - 2); c.stroke(); }
  }, { color: 'rgba(255,154,216,0.9)', dx: -3, dy: 2 });
  glow(ctx, 46, 7, 9, 0xff4fd8, 1);
});
const waveTex = (s: Phaser.Scene, kind: 'low' | 'high') => T(s, `bs-c-wave-${kind}`, 56, kind === 'low' ? 44 : 72, (c, w, h) => {
  const col = kind === 'low' ? THEME.coral : 0xb069ff; const hot = kind === 'low' ? 0xff3d6e : 0x8b3dff;
  glow(c, w / 2, h / 2, h * 0.6, col, 0.55);
  c.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const x = 14 + i * 12; const r = kind === 'low' ? 14 + i * 4 : 24 + i * 6; const cy = kind === 'low' ? h - 4 : h / 2;
    c.strokeStyle = css(hot, 0.65); c.lineWidth = 8 - i * 1.5; c.beginPath(); c.arc(x - r, cy, r, kind === 'low' ? -Math.PI / 2 : -Math.PI / 2.6, kind === 'low' ? 0 : Math.PI / 2.6); c.stroke();
    c.strokeStyle = i === 2 ? '#ffffff' : css(col); c.lineWidth = 4 - i; c.beginPath(); c.arc(x - r, cy, r, kind === 'low' ? -Math.PI / 2 : -Math.PI / 2.6, kind === 'low' ? 0 : Math.PI / 2.6); c.stroke();
  }
  if (kind === 'low') { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, css(col, 0)); g.addColorStop(1, css(col, 0.9)); c.fillStyle = g; c.fillRect(0, h - 4, w, 3); }
});
const cloudTex = (s: Phaser.Scene) => T(s, 'bs-c-cloud', 80, 70, (ctx, w, h) => {
  const sil: Sil = blobs([[40, 30, 28, 18], [20, 34, 15], [60, 34, 15], [30, 20, 14], [52, 20, 15], [40, 42, 24, 10]]);
  glow(ctx, 40, 34, 40, 0x8b3dff, 0.45);
  // şimşek
  ctx.strokeStyle = '#ffe0ff'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.shadowColor = '#ff4fd8'; ctx.shadowBlur = 6; ctx.beginPath(); ctx.moveTo(36, 48); ctx.lineTo(30, 58); ctx.lineTo(38, 58); ctx.lineTo(32, 68); ctx.stroke(); ctx.shadowBlur = 0;
  painted(ctx, w, h, sil, M.ink, 2, (c) => { radial(c, 32, 18, 2, 44, [[0, '#8a5ab0'], [0.5, '#4a2068'], [1, '#22082e']], w, h); specks(c, w, h, 5, 50, ['rgba(255,255,255,0.25)', 'rgba(255,79,216,0.4)'], 1); }, { color: 'rgba(255,154,216,0.8)', dx: -3, dy: 3 });
  // kızgın gözler
  for (const x of [32, 48]) { glow(ctx, x, 32, 6, 0xff3d6e, 0.9); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, 32, 3.4, 2.4, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = M.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(27, 26); ctx.lineTo(36, 29); ctx.moveTo(53, 26); ctx.lineTo(44, 29); ctx.stroke();
});
const coreTex = (s: Phaser.Scene) => T(s, 'bs-c-core', 84, 84, (c) => {
  glow(c, 42, 42, 42, 0xff4fd8, 0.7);
  heartPath(c, 42, 44, 52); const g = c.createRadialGradient(34, 32, 2, 42, 44, 30); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#ffc4ee'); g.addColorStop(0.75, M.mag); g.addColorStop(1, '#a0106e'); c.fillStyle = g; c.fill();
  c.strokeStyle = '#5a0040'; c.lineWidth = 2; c.stroke();
  c.save(); heartPath(c, 42, 44, 52); c.clip(); c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(42, 30); c.lineTo(30, 44); c.lineTo(42, 66); c.lineTo(54, 44); c.closePath(); c.moveTo(42, 30); c.lineTo(42, 66); c.stroke(); c.restore();
  c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.ellipse(31, 34, 5, 3, -0.6, 0, Math.PI * 2); c.fill();
});
const bracketTex = (s: Phaser.Scene) => T(s, 'bs-bracket', 100, 100, (c) => {
  c.strokeStyle = css(THEME.gold); c.lineWidth = 4; c.lineCap = 'round'; c.shadowColor = css(THEME.gold); c.shadowBlur = 6;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(50, 50, 42, i * Math.PI / 2 + 0.25, i * Math.PI / 2 + Math.PI / 2 - 0.25); c.stroke(); }
});

// ================================================================ ortak kurulum
interface Fx { chips: Phaser.GameObjects.Particles.ParticleEmitter; puffs: Phaser.GameObjects.Particles.ParticleEmitter; sparks: Phaser.GameObjects.Particles.ParticleEmitter; notes: Phaser.GameObjects.Particles.ParticleEmitter; }
const q = (n: number) => Math.max(1, Math.round(n * fxQuality()));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

export function createBossArt(scene: Phaser.Scene, kind: 'golem' | 'canavar', name: string, groundY: number, biomeId: string): BossArt {
  const s = scene; const A = artOf(biomeId); const gy0 = groundY; void A;
  const all: Phaser.GameObjects.GameObject[] = [];
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { all.push(o); return o; };
  const img = (key: string, x = 0, y = 0) => I(s, key, x, y);
  const glowI = (c: number, size: number, a = 0.6) => s.add.image(0, 0, softGlowTex(s)).setBlendMode(ADD).setTint(c).setDisplaySize(size, size).setAlpha(a);

  // ---- parçacıklar
  const em = (key: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, depth: number) => add(s.add.particles(0, 0, key, { emitting: false, ...cfg }).setDepth(depth));
  const chipKeys = [0, 1, 2].map((i) => chipTex(s, i));
  const fx: Fx = {
    chips: em(chipKeys[0]!, { speed: { min: 120, max: 340 }, angle: { min: 200, max: 340 }, gravityY: 900, rotate: { min: 0, max: 360 }, scale: { start: 1 / R() * 1.1, end: 0.4 / R() }, lifespan: { min: 600, max: 1100 }, alpha: { start: 1, end: 0 } }, 17),
    puffs: em(puffTex(s), { speed: { min: 40, max: 160 }, angle: { min: 180, max: 360 }, scale: { start: 0.7, end: 0.1 }, alpha: { start: 0.75, end: 0 }, lifespan: { min: 360, max: 700 }, gravityY: -40 }, 16),
    sparks: em(sparkTex(s), { speed: { min: 80, max: 300 }, angle: { min: 0, max: 360 }, scale: { start: 0.7, end: 0 }, rotate: { min: 0, max: 360 }, alpha: { start: 1, end: 0 }, lifespan: { min: 360, max: 760 }, gravityY: 160, blendMode: ADD }, 18),
    notes: em(noteTex(s), { speed: { min: 120, max: 380 }, angle: { min: 0, max: 360 }, scale: { start: 1.3 / R(), end: 0.3 / R() }, rotate: { min: -60, max: 60 }, alpha: { start: 1, end: 0 }, lifespan: { min: 900, max: 1500 }, gravityY: 140 }, 18),
  };
  const ring = (x: number, y: number, tint: number, from: number, to: number, ms: number, sy = 1, depth = 18) => { const r = s.add.image(x, y, ringTex(s)).setBlendMode(ADD).setTint(tint).setDepth(depth).setScale(from, from * sy); s.tweens.add({ targets: r, scaleX: to, scaleY: to * sy, alpha: 0, duration: ms, ease: 'Cubic.Out', onComplete: () => r.destroy() }); };
  const flare = (x: number, y: number, tint: number, size: number, ms: number, depth = 18) => { const g = s.add.image(x, y, softGlowTex(s)).setBlendMode(ADD).setTint(tint).setDepth(depth).setDisplaySize(size * 0.3, size * 0.3); s.tweens.add({ targets: g, displayWidth: size, displayHeight: size, alpha: 0, duration: ms, ease: 'Cubic.Out', onComplete: () => g.destroy() }); };

  // ---- can çubuğu (ekran-sabit)
  const cam = s.cameras.main; const O = screenOrigin(cam);
  const bar = add(s.add.container(O.x + 195, O.y + 124).setScrollFactor(0).setDepth(102));
  const layout = (viewW: number, top: number) => { const o = screenOrigin(cam); bar.setPosition(o.x + viewW / 2, o.y + 124 + top); };
  const barBg = img(barPanelTex(s)); const fillKey = barFillTex(s);
  const trail = img(fillKey, -102, 7).setOrigin(0, 0.5).setTintFill(0xffffff).setAlpha(0.85);
  const fill = img(fillKey, -102, 7).setOrigin(0, 0.5);
  const icon = img(kind === 'golem' ? golemEyeTex(s) : canEyeTex(s), -122, 1).setScale(0.62 / R());
  const nameT = s.add.text(-102, -6, name, { fontFamily: FONT, fontSize: '13px', fontStyle: '900', color: '#fff6e5', stroke: '#140c35', strokeThickness: 3, resolution: R() }).setOrigin(0, 0.5);
  const phaseT = s.add.text(92, -6, 'Faz 1', { fontFamily: FONT, fontSize: '11px', fontStyle: '900', color: '#ffc93c', resolution: R() }).setOrigin(1, 0.5);
  // faz elmasları: çubuk üzerinde 2/3 ve 1/3 çentikleri
  const notchX = (r: number) => -102 + 230 * r;
  const notches = [2 / 3, 1 / 3].map((r) => img(pipTex(s, false), notchX(r), 7).setScale(0.8 / R()));
  bar.add([barBg, trail, fill, ...notches, icon, nameT, phaseT]);
  const fullW = s.textures.getFrame(fillKey)!.width; const fullH = s.textures.getFrame(fillKey)!.height;
  let shownRatio = 1; let trailRatio = 1; let trailHold = 0;
  const setBar = (b: BossArtState) => {
    const ratio = clamp01(b.hp / b.maxHp);
    if (ratio < shownRatio) trailHold = b.t + 0.35;
    shownRatio = ratio;
    if (b.t > trailHold) trailRatio += (shownRatio - trailRatio) * 0.12; if (trailRatio < shownRatio) trailRatio = shownRatio;
    fill.setCrop(0, 0, Math.max(0, fullW * shownRatio), fullH).setVisible(ratio > 0);
    trail.setCrop(0, 0, Math.max(0, fullW * trailRatio), fullH);
    notches.forEach((n, i) => n.setTexture(pipTex(s, b.phase > i + 1)));
    phaseT.setText(b.defeated ? 'Yenildi!' : `Faz ${b.phase}`).setColor(b.defeated ? '#8ef0b0' : b.phase === 3 ? '#ff5c8a' : b.phase === 2 ? '#ff9f1c' : '#ffc93c');
  };

  // ---- ortak saldırı nesneleri
  const mkTarget = (tint: number) => img(targetTex(s)).setDepth(6).setTint(tint).setVisible(false);
  const target = (tint: number) => add(mkTarget(tint));
  const wallGlow = add(img(wallGlowTex(s)).setOrigin(0, 0.5).setBlendMode(ADD).setDepth(14).setVisible(false));
  const chevs = [0, 1, 2].map(() => add(img(chevTex(s)).setDepth(15).setVisible(false)));
  const badge = add(img(badgeTex(s, true)).setDepth(15).setVisible(false));
  const pools = new Map<string, Img[]>();
  const pool = (id: string, n: number, depth: number, make: () => Img = () => img(id)) => { const arr = pools.get(id) ?? []; while (arr.length < n) arr.push(add(make().setDepth(depth))); pools.set(id, arr); arr.forEach((o, i) => o.setVisible(i < n)); return arr.slice(0, n); };

  const noteViews: EntityView[] = []; const noteGl: Img[] = [];
  const drops = new Map<number, { o: Img; sh: Img; gl: Img; x: number; fell: boolean; seen: number }>();
  const dropFrame = new Set<number>();

  let lastHp = -1; let lastPhase = 1; let hitAt = -9; let phaseAt = -9; let defeatAt = -1; let burstDone = false; let lastMode = ''; let modeAt = 0;
  let lastWarn: string | null = null; let warnAt = 0; let shakeX = 0; let nextEmber = 0;

  // ============================================================ GOLEM
  if (kind === 'golem') {
    const rig = add(s.add.container(195, gy0 - 120).setDepth(3));
    const aura = glowI(0xff9f1c, 420, 0.22); aura.setPosition(0, -170);
    const torso = img(golemTorsoTex(s)).setOrigin(0.5, 1);
    const crT2 = img(golemCrackTex(s, 2, false)).setOrigin(0.5, 1).setBlendMode(ADD).setAlpha(0);
    const crT3 = img(golemCrackTex(s, 3, false)).setOrigin(0.5, 1).setBlendMode(ADD).setAlpha(0);
    const head = s.add.container(0, -228);
    const headI = img(golemHeadTex(s)); const crH2 = img(golemCrackTex(s, 2, true)).setBlendMode(ADD).setAlpha(0); const crH3 = img(golemCrackTex(s, 3, true)).setBlendMode(ADD).setAlpha(0);
    const EX = 37, EY = 7;
    const eyeGl = [-EX, EX].map((x) => glowI(0xff8a1c, 70, 0.6).setPosition(x, EY));
    const eyes = [-EX, EX].map((x) => img(golemEyeTex(s), x, EY));
    const pupils = [-EX, EX].map((x) => img(golemPupilTex(s), x, EY));
    const brows = [-1, 1].map((sx) => img(golemBrowTex(s), sx * 38, -18).setFlipX(sx > 0));
    const mouth0 = img(golemMouthTex(s, false), 0, 50); const mouth1 = img(golemMouthTex(s, true), 0, 54).setVisible(false);
    const flames = [-30, 0, 30].map((x) => glowI(0xff7a1c, 60, 0).setPosition(x, -64));
    head.add([headI, crH2, crH3, ...eyeGl, ...eyes, ...pupils, ...brows, mouth0, mouth1, ...flames]);
    rig.add([aura, torso, crT2, crT3, head]);
    const tintables: Img[] = [torso, headI, ...brows];
    // yumruklar
    const fistKey = golemFistTex(s); const crackKey = golemFistCrackTex(s);
    const fists = [0, 1].map(() => {
      const c = add(s.add.container(0, 0).setDepth(12).setVisible(false));
      const gl = glowI(0xff5a1c, 150, 0); gl.setPosition(0, -34);
      const im = img(fistKey).setOrigin(0.5, 80 / 88); const cr = img(crackKey).setOrigin(0.5, 80 / 88).setBlendMode(ADD).setAlpha(0);
      const down = img(downTex(s), 0, -96).setAlpha(0);
      c.add([gl, im, cr, down]);
      const beam = add(img(beamTex(s)).setOrigin(0.5, 1).setBlendMode(ADD).setTint(THEME.hazard).setDepth(5).setVisible(false));
      return { c, gl, im, cr, down, beam, tg: target(THEME.hazard), st: '', t0: 0, plantedAt: -9, hitShown: false };
    });
    const ballGlowKey = softGlowTex(s);
    const peek = add(img(golemBallTex(s)).setDepth(13).setVisible(false));

    const update = (b: BossArtState, gy: number) => {
      const t = b.t;
      if (lastHp < 0) { lastHp = b.hp; lastPhase = b.phase; }
      if (b.hp < lastHp) { hitAt = t; shakeX = 10; const hx = b.heroX ?? 195; fx.chips.setTexture(chipKeys[Math.floor(Math.random() * 3)]!); fx.chips.explode(q(14), hx, gy - 60); fx.sparks.explode(q(16), hx, gy - 64); ring(hx, gy - 64, THEME.gold, 0.1, 1.1, 420); flare(195, gy - 330, 0xfff0b8, 380, 260, 4); }
      lastHp = b.hp;
      if (b.phase > lastPhase) { phaseAt = t; lastPhase = b.phase; ring(195, gy - 330, 0xff8a1c, 0.2, 3.2, 900, 0.8, 4); ring(195, gy - 330, 0xffffff, 0.1, 2.2, 600, 0.8, 4); fx.sparks.explode(q(30), 195, gy - 230); fx.chips.explode(q(14), 195, gy - 220); flare(195, gy - 280, 0xff9f1c, 520, 700, 4); }
      if (b.defeated && defeatAt < 0) { defeatAt = t; }
      setBar(b);

      // --- odak (gözler) ve telegraf durumu
      const warnFist = b.fists.find((f) => f.st === 'warn');
      const forming = b.drops.some((d) => t - d.t0 < 0.8);
      const tele = !!warnFist || !!b.warnWall || forming;
      const focusX = warnFist ? warnFist.x : b.warnWall ? (b.warnWall.side > 0 ? 360 : 30) : (b.heroX ?? 195);
      const sinceHit = t - hitAt, sincePhase = t - phaseAt;
      const transforming = sincePhase < 1.4;
      // --- gövde
      const pScale = b.phase === 3 ? 1.1 : b.phase === 2 ? 1.05 : 1;
      const bump = transforming ? Math.sin(clamp01(sincePhase / 1.4) * Math.PI) * 0.08 : 0;
      shakeX *= 0.85;
      const quake = transforming ? Math.sin(t * 70) * 4 * (1 - sincePhase / 1.4) : 0;
      let rx = 195 + (shakeX > 0.3 ? Math.sin(t * 90) * shakeX : 0) + quake; const ry = gy - 120 + Math.sin(t * 1.6) * 3; let rAlpha = 1; let rAngle = (focusX - 195) / 195 * (tele ? 5 : 2);
      if (defeatAt >= 0) {
        const u = t - defeatAt; rx = 195 + Math.sin(t * 80) * Math.min(10, u * 20); rAngle = Math.sin(t * 30) * 3;
        if (u > 0.75 && !burstDone) {
          burstDone = true;
          for (let i = 0; i < 3; i++) { fx.chips.setTexture(chipKeys[i]!); fx.chips.explode(q(16), 195 + (i - 1) * 60, gy - 280); }
          fx.puffs.setParticleTint(0xffc25c); fx.puffs.explode(q(18), 195, gy - 260); fx.sparks.explode(q(50), 195, gy - 300);
          ring(195, gy - 300, THEME.gold, 0.2, 4, 1000, 0.8); ring(195, gy - 300, 0xffffff, 0.1, 2.6, 700, 0.8); flare(195, gy - 300, 0xfff0b8, 700, 900);
        }
        if (u > 0.75) rAlpha = Math.max(0, 1 - (u - 0.75) / 0.25);
      }
      rig.setPosition(rx, ry).setAngle(rAngle).setScale(pScale + bump).setAlpha(rAlpha);
      const br = Math.sin(t * 2) * 0.022 * (tele ? 1.6 : 1);
      torso.setScale((1 / R()) * (1 - br * 0.5), (1 / R()) * (1 + br));
      head.y = -228 * (1 + br) + Math.sin(t * 2 + 0.6) * 3 + (tele ? -4 : 0);
      head.angle = (focusX - 195) / 195 * 7 + (sinceHit < 0.4 ? Math.sin(t * 50) * 4 : 0);
      aura.setAlpha((b.phase === 3 ? 0.36 : 0.22) + Math.sin(t * 3) * 0.05 + (tele ? 0.08 : 0)).setTint(b.phase === 3 ? 0xff4a1c : 0xff9f1c);
      // --- yüz
      const blink = (t % 3.3) < 0.12 && !tele;
      const squint = sinceHit < 0.5 || (defeatAt >= 0);
      eyes.forEach((e, i) => { e.setScale(1 / R(), (blink ? 0.12 : squint ? 0.35 : tele ? 1.12 : 1) / R()); e.setTint(b.phase === 3 ? 0xff7060 : b.phase === 2 ? 0xffc090 : 0xffffff); const px = Math.max(-1, Math.min(1, (focusX - (195 + (i ? EX : -EX))) / 150)); pupils[i]!.setPosition((i ? EX : -EX) + px * 6, EY + (tele ? 2 : 0)).setVisible(!blink && !squint).setScale(1 / R(), (b.phase === 3 ? 0.75 : 1) / R()); });
      eyeGl.forEach((g) => g.setAlpha((tele ? 0.95 : 0.55) + Math.sin(t * 8) * 0.08).setTint(b.phase === 3 ? 0xff2a10 : b.phase === 2 ? 0xff6a1c : 0xff9f1c));
      const browAng = sinceHit < 0.5 ? -14 : tele || transforming ? 22 : 10; const browY = sinceHit < 0.5 ? -24 : tele ? -14 : -18;
      brows.forEach((bw, i) => bw.setAngle(i ? -browAng : browAng).setY(browY));
      const open = tele || sinceHit < 0.5 || transforming || defeatAt >= 0;
      mouth0.setVisible(!open); mouth1.setVisible(open).setScale(1 / R(), (1 + (open ? Math.sin(t * 24) * 0.06 : 0)) / R());
      // --- dönüşüm: çatlaklar ve alevler
      const crA = (lvl: number) => b.phase >= lvl ? (lvl === b.phase && transforming ? clamp01(sincePhase / 0.9) * (0.5 + 0.4 * Math.abs(Math.sin(t * 30))) : 0.55 + Math.sin(t * 4 + lvl) * 0.15) : 0;
      const dA = defeatAt >= 0 ? 1 : 0;
      crT2.setAlpha(Math.max(dA, crA(2))); crH2.setAlpha(Math.max(dA, crA(2))); crT3.setAlpha(Math.max(dA, crA(3))); crH3.setAlpha(Math.max(dA, crA(3)));
      flames.forEach((f, i) => f.setAlpha(b.phase >= 3 ? 0.55 + Math.sin(t * 13 + i * 2) * 0.25 : 0).setDisplaySize(50 + Math.sin(t * 9 + i) * 10, 70 + Math.sin(t * 11 + i) * 14));
      if (b.phase >= 2 && t > nextEmber && defeatAt < 0) { nextEmber = t + (b.phase === 3 ? 0.12 : 0.3) / fxQuality(); fx.sparks.setParticleTint(0xff8a1c); fx.sparks.emitParticleAt(rx + (Math.random() - 0.5) * 200, ry - 60 - Math.random() * 200, 1); }
      // --- vuruş flaşı
      const flash = sinceHit < 0.09 || (transforming && sincePhase < 0.1) || (defeatAt >= 0 && Math.sin(t * 40) > 0.6);
      for (const o of tintables) { if (flash) o.setTintFill(0xffffff); else if (b.phase === 3) o.setTint(o === torso ? 0xe0a080 : 0xffc0a8); else if (o === torso) o.setTint(0xeed2b4); else o.clearTint(); }

      // --- yumruklar
      fists.forEach((v, slot) => {
        const f = b.fists.find((x, i) => (x.slot ?? i) === slot);
        if (!f) { v.c.setVisible(false); v.tg.setVisible(false); v.beam.setVisible(false); v.st = ''; return; }
        if (f.st !== v.st) { if (f.st === 'warn') v.t0 = t; if (f.st === 'planted') { v.plantedAt = t; fx.puffs.setParticleTint(0xffd27a); fx.puffs.explode(q(10), f.x, gy - 4); ring(f.x, gy - 4, 0xffd27a, 0.1, 1.1, 420, 0.3); fx.chips.setTexture(chipKeys[1]!); fx.chips.explode(q(6), f.x, gy - 10); } if (f.st === 'up' && f.hit) { v.hitShown = true; fx.chips.setTexture(chipKeys[2]!); fx.chips.explode(q(12), f.x, gy - 50); } v.st = f.st; }
        v.c.setVisible(true);
        let y = gy, sx = 1, sy = 1, a = 1, ang = 0;
        v.tg.setVisible(f.st === 'warn' || f.st === 'slam'); v.beam.setVisible(f.st === 'warn');
        v.down.setAlpha(0); v.cr.setAlpha(0); v.gl.setAlpha(0);
        if (f.st === 'warn') {
          const p = clamp01((t - v.t0) / Math.max(0.1, f.until - v.t0));
          y = gy - 300 - (1 - ease(p * 3)) * 140 - Math.sin(p * Math.PI) * 18 + Math.sin(t * 34) * (2 + p * 4); ang = Math.sin(t * 28) * (2 + p * 5);
          a = clamp01(p * 4);
          v.gl.setAlpha(0.25 + p * 0.6 + Math.sin(t * 30) * 0.1).setTint(p > 0.6 ? 0xff3d1c : 0xff8a1c);
          v.tg.setPosition(f.x, gy - 2).setScale((0.45 + p * 0.55) / R(), (0.45 + p * 0.55) / R()).setAlpha(0.5 + p * 0.5 * Math.abs(Math.sin(t * 16)));
          v.beam.setPosition(f.x, gy).setDisplaySize(36 + p * 30, Math.max(10, gy - y + 40)).setAlpha(0.12 + p * 0.3);
          v.im.setTint(p > 0.55 && Math.sin(t * 40) > 0 ? 0xffb090 : 0xffffff);
        } else if (f.st === 'slam') {
          const p = clamp01(1 - (f.until - t) / 0.12); y = gy - 300 * (1 - p * p); sy = 1.18; sx = 0.88;
          v.tg.setPosition(f.x, gy - 2).setScale(1 / R()).setAlpha(1); v.im.setTint(0xffd0b0);
        } else if (f.st === 'planted') {
          const u = t - v.plantedAt; const sq = Math.max(0, 1 - u / 0.18); sx = 1 + sq * 0.18; sy = 1 - sq * 0.22;
          const left = f.until - t; if (left < 0.45) ang = Math.sin(t * 50) * 3;
          v.im.clearTint();
          // "buraya çakıl" işareti: altın oklar + üst kenar ışığı
          v.down.setAlpha(0.95).setY(-96 + Math.sin(t * 9) * 5);
          v.gl.setTint(THEME.gold).setAlpha(0.28 + Math.sin(t * 9) * 0.1);
        } else if (f.st === 'up') {
          const u = clamp01(1 - (f.until - t) / 0.3); y = gy - ease(u) * 320; a = 1 - u;
          if (f.hit) { v.cr.setAlpha(1 - u * 0.5); v.im.setTintFill(u < 0.25 ? 0xffffff : 0xffe0a0); if (u >= 0.25) v.im.setTint(0xffc090); } else v.im.clearTint();
        }
        v.c.setPosition(f.x, y).setAngle(ang).setAlpha(a); v.im.setScale(sx / R(), sy / R()); v.cr.setScale(sx / R(), sy / R());
      });
      // --- toplar
      const balls = pool(golemBallTex(s), b.balls.length, 12);
      const his = pool(golemBallHiTex(s), b.balls.length, 12.1);
      const bgl = pool('ball-glow', b.balls.length, 11, () => s.add.image(0, 0, ballGlowKey).setBlendMode(ADD).setTint(0xff9f1c).setDisplaySize(70, 40).setAlpha(0.45));
      b.balls.forEach((q2, i) => { balls[i]!.setPosition(q2.x, gy - 18).setAngle(q2.x * 3.4); his[i]!.setPosition(q2.x, gy - 18); bgl[i]!.setPosition(q2.x, gy - 8); if (Math.random() < 0.18 * fxQuality()) { fx.puffs.setParticleTint(0xffd27a); fx.puffs.emitParticleAt(q2.x, gy - 4, 1); } });
      // --- duvar uyarısı (top)
      wallUpdate(b, t, gy, 0xff9f1c, gy - 18, 60, true);
      if (b.warnWall) { const sd = b.warnWall.side; const p = clamp01((t - warnAt) / 0.7); peek.setVisible(true).setPosition(sd > 0 ? 364 - p * 16 : 26 + p * 16, gy - 18).setAngle(t * 200 * -sd).setAlpha(0.4 + p * 0.6); } else peek.setVisible(false);
      // --- tavan damlaları
      dropUpdate(b, t, gy, 0.8, 0.25, 300, golemDripTex(s), 0xff9f1c, (x) => { fx.puffs.setParticleTint(0xffc25c); fx.puffs.explode(q(8), x, gy - 4); fx.chips.setTexture(chipKeys[0]!); fx.chips.explode(q(5), x, gy - 6); ring(x, gy - 4, 0xffc25c, 0.1, 0.8, 360, 0.3); });
      lastMode = b.mode;
    };
    return { update, destroy, layout };
  }

  // ============================================================ CANAVAR
  const rig = add(s.add.container(195, gy0 - 310).setDepth(3));
  const aura = glowI(0xff4fd8, 460, 0.25);
  const fur0 = img(furTex(s, 0)); const fur1 = img(furTex(s, 1));
  const ghosts = [THEME.teal, 0xff3dbb].map((c) => img(canGhostTex(s)).setBlendMode(ADD).setTint(c).setAlpha(0));
  const body = img(canBodyTex(s));
  const horns = [-1, 1].map((sx) => img(hornTex(s), sx * 70, -80).setOrigin(0.375, 0.98).setScale(sx / R(), 1 / R()));
  const hornTip = [-1, 1].map(() => glowI(0xff4fd8, 40, 0.8));
  const EX = 44, EY = -20;
  const eyeDefs: { x: number; y: number; s: number; ph: number }[] = [{ x: -EX, y: EY, s: 1, ph: 1 }, { x: EX, y: EY, s: 1, ph: 1 }, { x: 0, y: -58, s: 0.7, ph: 2 }, { x: -78, y: 16, s: 0.5, ph: 3 }, { x: 78, y: 16, s: 0.5, ph: 3 }];
  const eyes = eyeDefs.map((d) => ({ d, gl: glowI(0xff4fd8, 90 * d.s, 0.5).setPosition(d.x, d.y), e: img(canEyeTex(s), d.x, d.y), p: img(canPupilTex(s), d.x, d.y) }));
  const mouth0 = img(canMouthTex(s, false), 0, 52); const mouth1 = img(canMouthTex(s, true), 0, 56).setVisible(false);
  const lightning = s.add.graphics().setBlendMode(ADD);
  const stars = [0, 1, 2].map(() => img(sparkTex(s)).setBlendMode(ADD).setTint(THEME.gold).setScale(0.8).setVisible(false));
  rig.add([aura, fur0, fur1, ...horns, ...hornTip, ...ghosts, body, ...eyes.flatMap((e) => [e.gl, e.e, e.p]), mouth0, mouth1, lightning, ...stars]);
  const tintables: Img[] = [body, fur0, fur1, ...horns];
  // kalp (çekirdek)
  const tether = add(s.add.graphics().setDepth(4).setBlendMode(ADD));
  const coreC = add(s.add.container(0, 0).setDepth(16).setVisible(false));
  const coreGl = glowI(0xff4fd8, 160, 0.7); const coreI = img(coreTex(s)); const brk = img(bracketTex(s));
  coreC.add([coreGl, coreI, brk]);
  // notalar (çığlık)
  let coreSeen = false; let nextRing = 0; let nextGlitch = 0; let glitchUntil = 0;

  const update = (b: BossArtState, gy: number) => {
    const t = b.t;
    if (lastHp < 0) { lastHp = b.hp; lastPhase = b.phase; }
    if (b.hp < lastHp) { hitAt = t; shakeX = 12; const cx = b.core?.x ?? 195; fx.sparks.setParticleTint(0xff9ad8); fx.sparks.explode(q(24), cx, gy - 40); ring(cx, gy - 40, 0xff4fd8, 0.1, 1.4, 480); ring(cx, gy - 40, 0xffffff, 0.05, 0.9, 320); fx.notes.explode(q(6), cx, gy - 40); glitchUntil = t + 0.35; }
    lastHp = b.hp;
    if (b.phase > lastPhase) { phaseAt = t; lastPhase = b.phase; glitchUntil = t + 1.2; ring(195, gy - 330, 0xff4fd8, 0.2, 3.4, 900, 0.85, 4); ring(195, gy - 330, THEME.teal, 0.1, 2.4, 700, 0.85, 4); fx.sparks.setParticleTint(0xff4fd8); fx.sparks.explode(q(40), 195, gy - 330); flare(195, gy - 330, 0xff4fd8, 560, 700, 4); }
    if (b.defeated && defeatAt < 0) defeatAt = t;
    if (b.mode !== lastMode) { modeAt = t; lastMode = b.mode; if (b.mode === 'scream') nextRing = t; }
    setBar(b);
    const sinceHit = t - hitAt, sincePhase = t - phaseAt; const transforming = sincePhase < 1.4;
    const stun = b.mode === 'stun'; const scream = b.mode === 'scream'; const roar = scream && t - modeAt < 1.3;
    const tele = !!b.warnWall || b.drops.some((d) => t - d.t0 < 0.85);
    const focusX = b.warnWall ? (b.warnWall.side > 0 ? 360 : 30) : (b.heroX ?? 195);
    // --- gövde
    shakeX *= 0.85;
    const pScale = b.phase === 3 ? 1.1 : b.phase === 2 ? 1.05 : 1;
    const bump = transforming ? Math.sin(clamp01(sincePhase / 1.4) * Math.PI) * 0.1 : 0;
    const sink = stun ? ease((t - modeAt) / 0.5) * 70 : 0;
    let rx = 195 + (shakeX > 0.3 ? Math.sin(t * 90) * shakeX : 0) + (roar ? Math.sin(t * 60) * 4 : 0) + (transforming ? Math.sin(t * 70) * 3 : 0);
    const ry = gy - 310 + Math.sin(t * 1.3) * 8 + sink; let rAlpha = 1; let rScale = pScale + bump + (roar ? 0.05 : 0);
    let rAngle = stun ? Math.sin(t * 2) * 6 : (focusX - 195) / 195 * (tele ? 6 : 2);
    if (defeatAt >= 0) {
      const u = t - defeatAt; rx = 195 + Math.sin(t * 80) * Math.min(12, u * 25); rScale = pScale * (1 + u * 0.2); glitchUntil = t + 0.1;
      if (u > 0.85 && !burstDone) {
        burstDone = true;
        fx.notes.explode(q(36), 195, ry); fx.sparks.setParticleTint(0xffc93c); fx.sparks.explode(q(50), 195, ry);
        for (let i = 0; i < 5; i++) ring(195, ry, tono(i / 4), 0.2 + i * 0.05, 3 + i * 0.5, 900 + i * 140, 0.85);
        flare(195, ry, 0xffffff, 760, 900);
      }
      if (u > 0.85) rAlpha = Math.max(0, 1 - (u - 0.85) / 0.25);
      rAngle = Math.sin(t * 30) * 3;
    }
    rig.setPosition(rx, ry).setScale(rScale).setAlpha(rAlpha).setAngle(rAngle);
    const pulse = roar ? Math.sin(t * 30) * 0.06 : Math.sin(t * 3) * 0.025;
    fur0.setScale((1 + pulse + (b.phase - 1) * 0.06) / R()).setAngle(Math.sin(t * 0.7) * 5);
    fur1.setScale((1 - pulse * 0.6 + (b.phase - 1) * 0.04) / R()).setAngle(-Math.sin(t * 0.9) * 6 + t * 4);
    body.setScale((1 + pulse * 0.4) / R(), (1 - pulse * 0.4) / R());
    aura.setAlpha(0.22 + Math.sin(t * 2.4) * 0.06 + (tele || scream ? 0.12 : 0)).setTint(b.phase === 3 ? 0xff2a6a : 0xff4fd8);
    // parazit (glitch): yanlara kaymış renkli hayaletler
    if (t > nextGlitch) { nextGlitch = t + (b.phase === 3 ? 0.7 : b.phase === 2 ? 1.2 : 1.8) + Math.random() * 0.8; glitchUntil = Math.max(glitchUntil, t + 0.12); }
    const gOn = t < glitchUntil;
    ghosts.forEach((g, i) => g.setAlpha(gOn ? 0.45 : 0).setPosition((i ? 1 : -1) * (gOn ? 4 + Math.random() * 5 : 0), gOn ? (Math.random() - 0.5) * 4 : 0).setScale(body.scaleX, body.scaleY));
    body.setX(gOn ? (Math.random() - 0.5) * 6 : 0);
    // boynuzlar + şimşek (faz 3)
    horns.forEach((h, i) => {
      const sx = i ? 1 : -1; h.setAngle(sx * (8 + Math.sin(t * 2 + i) * 4 + (roar ? 10 : 0) + (b.phase - 1) * 5)); const a = Phaser.Math.DegToRad(h.angle);
      const lx = sx * 25, ly = -78; hornTip[i]!.setPosition(h.x + lx * Math.cos(a) - ly * Math.sin(a), h.y + lx * Math.sin(a) + ly * Math.cos(a)).setAlpha(0.6 + Math.sin(t * 9 + i) * 0.3).setTint(b.phase === 3 ? 0xff3d6e : 0xff4fd8);
    });
    lightning.clear();
    if ((b.phase >= 3 || transforming) && Math.sin(t * 17) > 0.2 && defeatAt < 0) {
      lightning.lineStyle(2.5, b.phase === 3 ? 0xff9ad8 : THEME.teal, 0.9);
      for (const ht of hornTip) { let x = ht.x, y = ht.y; lightning.beginPath(); lightning.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 30; y -= 8 + Math.random() * 10; lightning.lineTo(x, y); } lightning.strokePath(); }
    }
    // --- yüz
    const blink = (t % 3.7) < 0.12 && !tele && !stun;
    eyes.forEach(({ d, gl, e, p }, i) => {
      const openK = d.ph <= 1 ? 1 : b.phase >= d.ph ? (d.ph === b.phase && transforming ? ease(sincePhase / 0.8) : 1) : 0;
      const sq = sinceHit < 0.45 ? 0.3 : blink ? 0.1 : 1;
      e.setScale(d.s / R(), d.s * openK * sq * (tele || roar ? 1.12 : 1) / R()).setVisible(openK > 0.01).setTint(b.phase === 3 ? 0xff7a8a : 0xffffff);
      gl.setVisible(openK > 0.01).setAlpha((tele || roar ? 0.9 : 0.5) + Math.sin(t * 7 + i) * 0.1).setTint(b.phase === 3 ? 0xff2a5a : 0xff4fd8);
      let px = Math.max(-1, Math.min(1, (focusX - (195 + d.x)) / 140)) * 7 * d.s, py = (tele ? 2 : 0);
      if (stun) { px = Math.cos(t * 9 + i) * 6 * d.s; py = Math.sin(t * 9 + i) * 6 * d.s; }
      p.setPosition(d.x + px, d.y + py).setVisible(openK > 0.5 && sq > 0.5).setScale(d.s / R(), d.s * (b.phase === 3 ? 0.7 : 1) / R());
    });
    const wp = b.warnWall ? clamp01((t - warnAt) / 0.75) : 0;
    const open = roar || scream || !!b.warnWall || sinceHit < 0.45 || transforming || defeatAt >= 0;
    mouth0.setVisible(!open).setScale(1 / R(), (stun ? 0.8 + Math.sin(t * 6) * 0.1 : 1) / R());
    mouth1.setVisible(open).setScale((roar ? 1.12 : 1) / R(), (roar ? 1.1 + Math.sin(t * 40) * 0.08 : scream && !roar ? 0.7 : b.warnWall ? 0.5 + wp * 0.6 : 1) / R());
    stars.forEach((st, i) => { st.setVisible(stun); if (stun) { const a = t * 4 + i * 2.09; st.setPosition(Math.cos(a) * 70, -120 + Math.sin(a) * 18).setAngle(t * 200); } });
    const flash = sinceHit < 0.09 || (transforming && sincePhase < 0.1);
    for (const o of tintables) { if (flash) o.setTintFill(0xffffff); else if (stun) o.setTint(0xc0b0d8); else if (b.phase === 3) o.setTint(0xffb0c8); else o.clearTint(); }
    // çığlık halkaları + şarj
    if (scream && t >= nextRing && defeatAt < 0) { nextRing = t + (roar ? 0.28 : 1.1); ring(rx, ry + 56 * rScale, 0xff4fd8, 0.2, roar ? 3.2 : 2, roar ? 700 : 900, 0.7, 4); }
    if (b.warnWall && Math.random() < 0.5 * fxQuality()) { fx.sparks.setParticleTint(b.warnWall.kind === 'high' ? 0xb069ff : THEME.coral); fx.sparks.emitParticleAt(rx + (Math.random() - 0.5) * 60, ry + 56 * rScale, 1); }

    // --- kalp
    if (b.core) {
      const cx = b.core.x, cy = gy - 40;
      if (!coreSeen) { coreSeen = true; ring(cx, cy, 0xff4fd8, 0.1, 1.6, 500); fx.sparks.setParticleTint(0xff9ad8); fx.sparks.explode(q(16), cx, cy); }
      coreC.setVisible(true).setPosition(cx, cy + Math.sin(t * 5) * 3);
      coreI.setScale((1 + Math.sin(t * 10) * 0.08) / R()); coreGl.setAlpha(0.55 + Math.sin(t * 10) * 0.2); brk.setAngle(t * 90).setScale((1 + Math.sin(t * 6) * 0.06) / R()).setAlpha(0.95);
      if (sinceHit < 0.09) coreI.setTintFill(0xffffff); else coreI.clearTint();
      tether.clear(); tether.lineStyle(6, 0xff4fd8, 0.25); tether.beginPath(); tether.moveTo(rx, ry + 40); tether.lineTo(cx + Math.sin(t * 7) * 10, (ry + cy) / 2); tether.lineTo(cx, cy - 20); tether.strokePath();
      tether.lineStyle(2, 0xffc4ee, 0.85); tether.beginPath(); tether.moveTo(rx, ry + 40); tether.lineTo(cx + Math.sin(t * 7) * 10, (ry + cy) / 2); tether.lineTo(cx, cy - 20); tether.strokePath();
    } else { if (coreSeen) { coreSeen = false; } coreC.setVisible(false); tether.clear(); }
    // --- notalar (çığlıkta beliren 3 nota)
    const openNotes = b.notes.filter((n) => !n.got);
    while (noteViews.length < openNotes.length) { noteViews.push(entitySprite(s, { type: 'note', x: 0, y: 0 }, biomeId).setDepth(16)); noteGl.push(add(s.add.image(0, 0, ringTex(s)).setBlendMode(ADD).setTint(THEME.gold).setDepth(15))); }
    noteViews.forEach((o, i) => { const n = openNotes[i]; o.setVisible(!!n); noteGl[i]!.setVisible(!!n); if (n) { o.setPosition(n.x, n.y); noteGl[i]!.setPosition(n.x, n.y).setScale(0.32 + Math.sin(t * 6 + i) * 0.05).setAlpha(0.55 + Math.sin(t * 6 + i) * 0.2); } });
    // --- dalgalar
    const lows = b.waves.filter((w) => w.kind === 'low'), highs = b.waves.filter((w) => w.kind === 'high');
    pool(waveTex(s, 'low'), lows.length, 13).forEach((o, i) => { const w = lows[i]!; o.setOrigin(0.5, 1).setPosition(w.x, gy + 2).setFlipX((w.dir ?? 1) < 0).setScale((1 + Math.sin(t * 30) * 0.05) / R()); });
    pool(waveTex(s, 'high'), highs.length, 13).forEach((o, i) => { const w = highs[i]!; o.setPosition(w.x, gy - 52).setFlipX((w.dir ?? 1) < 0).setScale(1 / R(), (1 + Math.sin(t * 30) * 0.06) / R()); });
    for (const w of b.waves) if (Math.random() < 0.35 * fxQuality()) { fx.sparks.setParticleTint(w.kind === 'low' ? THEME.coral : 0xb069ff); fx.sparks.emitParticleAt(w.x - (w.dir ?? 1) * 14, w.kind === 'low' ? gy - 12 : gy - 52, 1); }
    wallUpdate(b, t, gy, b.warnWall?.kind === 'high' ? 0xb069ff : THEME.coral, b.warnWall?.kind === 'high' ? gy - 52 : gy - 18, b.warnWall?.kind === 'high' ? 70 : 52, false);
    // --- gürültü bulutları
    dropUpdate(b, t, gy, 0.85, 0.3, 320, cloudTex(s), 0x8b3dff, (x) => { fx.puffs.setParticleTint(0xb069ff); fx.puffs.explode(q(10), x, gy - 6); ring(x, gy - 4, 0xff4fd8, 0.1, 0.9, 380, 0.3); });
  };
  return { update, destroy, layout };

  // ============================================================ yardımcılar (kapanış)
  function wallUpdate(b: BossArtState, t: number, gy: number, color: number, y: number, hgt: number, ball: boolean) {
    const key = b.warnWall ? `${b.warnWall.side}:${b.warnWall.kind}` : null;
    if (key !== lastWarn) { lastWarn = key; warnAt = t; }
    if (!b.warnWall) { wallGlow.setVisible(false); chevs.forEach((c) => c.setVisible(false)); badge.setVisible(false); return; }
    const sd = b.warnWall.side; const p = clamp01((t - warnAt) / 0.75); const blinkA = 0.55 + 0.45 * Math.abs(Math.sin(t * 14));
    wallGlow.setVisible(true).setFlipX(sd > 0).setOrigin(sd > 0 ? 1 : 0, 0.5).setPosition(sd > 0 ? 364 : 26, y).setTint(color).setDisplaySize(70 + p * 40, hgt * 2.2).setAlpha((0.35 + p * 0.5) * blinkA);
    chevs.forEach((c, i) => { const x = sd > 0 ? 330 - i * 22 - p * 10 : 60 + i * 22 + p * 10; c.setVisible(true).setPosition(x, y).setFlipX(sd > 0).setTint(color).setAlpha(clamp01(p * 3 - i * 0.4) * blinkA).setScale((0.8 + 0.1 * Math.sin(t * 12 - i)) / R()); });
    if (!ball) badge.setVisible(true).setTexture(badgeTex(s, b.warnWall.kind !== 'high')).setPosition(sd > 0 ? 330 : 60, y - (b.warnWall.kind === 'high' ? 54 : 46)).setScale((0.9 + Math.sin(t * 10) * 0.08) / R()).setAlpha(clamp01(p * 4));
    else badge.setVisible(false);
  }
  function dropUpdate(b: BossArtState, t: number, gy: number, wait: number, fall: number, height: number, key: string, color: number, splat: (x: number) => void) {
    dropFrame.clear();
    for (const d of b.drops) {
      dropFrame.add(d.t0);
      let v = drops.get(d.t0);
      if (!v) { v = { o: img(key).setOrigin(0.5, 0.92).setDepth(15), sh: mkTarget(color), gl: glowI(color, 120, 0).setDepth(14), x: d.x, fell: false, seen: t }; drops.set(d.t0, v); }
      const age = t - d.t0; v.x = d.x;
      if (age < wait) { const p = age / wait; v.o.setPosition(d.x, gy - height + 6 + Math.sin(t * 20) * 1.5 * p).setScale((0.35 + p * 0.65) / R(), (0.35 + p * 0.75 + Math.sin(t * 18) * 0.05) / R()).setAlpha(clamp01(p * 3)); v.sh.setVisible(true).setPosition(d.x, gy - 2).setScale((0.25 + p * 0.45) / R()).setAlpha(0.4 + p * 0.5 * Math.abs(Math.sin(t * 14))); v.gl.setPosition(d.x, gy - height).setAlpha(0.3 + p * 0.4); }
      else if (age < wait + fall) { const p = (age - wait) / fall; v.o.setPosition(d.x, gy - height + p * height).setScale(0.9 / R(), 1.2 / R()).setAlpha(1); v.sh.setScale(0.7 / R()).setAlpha(1); v.gl.setPosition(d.x, gy - height + p * height - 20).setAlpha(0.5); v.fell = true; }
      else { if (v.o.visible) { v.o.setVisible(false); v.sh.setVisible(false); v.gl.setAlpha(0); splat(d.x); v.fell = false; } }
    }
    for (const [k, v] of drops) if (!dropFrame.has(k)) { if (v.o.visible && v.fell) splat(v.x); v.o.destroy(); v.sh.destroy(); v.gl.destroy(); drops.delete(k); }
    void b;
  }
  function destroy() { for (const o of all) o.destroy(); noteViews.forEach((o) => o.destroy()); for (const v of drops.values()) { v.o.destroy(); v.sh.destroy(); v.gl.destroy(); } }
}
