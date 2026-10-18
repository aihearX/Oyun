/**
 * Odi görseli (yalnızca görünüm; fizik gövdesi motorda): degrade küre + parlaklık + kenar ışığı, göz kırpma ve ileri bakma,
 * koşu zıplayışı, ayaklar, zıplamada uzama / inişte basılma, ışık halesi, hareket izi, atılma ardıl görüntüleri,
 * süzülmede ses dalgası kanatları, kozmetik şapkalar (Canvas 2D, yüksek çözünürlük).
 * Kök kap ayak tabanındadır (motorun Hero sprite'ı origin 0.5,1 ile aynı).
 */
import Phaser from 'phaser';
import type { HeroCosmetic, HeroPose, HeroVisual } from './types';
import { I, R, T, softGlowTex, puffTex, sparkTex, ringTex } from './tex';
import { circle, css, darken, glow, lighten, mix, spiralPath, THEME, type Ctx } from './util';

const ADD = Phaser.BlendModes.ADD;
const RAD = 22;           // gövde yarıçapı (HERO_SIZE 48)
const CY = -24;           // ayaktan gövde merkezine

// ---------------------------------------------------------------- dokular
const bodyTex = (s: Phaser.Scene, c: number) => T(s, `hero-body-${c.toString(16)}`, 60, 60, (ctx) => {
  const x = 30, y = 30, r = RAD;
  // dış ışık kenarı (koyu arka planda okunur)
  circle(ctx, x, y, r + 1.4); ctx.fillStyle = css(lighten(c, 0.65), 0.95); ctx.fill();
  circle(ctx, x, y, r + 0.2); ctx.fillStyle = css(darken(c, 0.55)); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.45, r * 0.08, x + r * 0.1, y + r * 0.1, r * 1.12);
  g.addColorStop(0, css(lighten(c, 0.55))); g.addColorStop(0.35, css(lighten(c, 0.12))); g.addColorStop(0.78, css(c)); g.addColorStop(1, css(darken(c, 0.38)));
  circle(ctx, x, y, r - 0.6); ctx.fillStyle = g; ctx.fill();
  // kenar ışığı (sağ alt, ortamdan yansıyan turkuaz)
  ctx.save(); circle(ctx, x, y, r - 0.6); ctx.clip();
  ctx.strokeStyle = css(mix(lighten(c, 0.45), THEME.teal, 0.35), 0.75); ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(x - 1.2, y - 1.2, r - 1.2, Math.PI * -0.05, Math.PI * 0.62); ctx.stroke();
  // alt gölge (ambient occlusion)
  const ao = ctx.createLinearGradient(0, y + r * 0.2, 0, y + r); ao.addColorStop(0, css(darken(c, 0.5), 0)); ao.addColorStop(1, css(darken(c, 0.5), 0.35)); ctx.fillStyle = ao; ctx.fillRect(x - r, y, r * 2, r);
  ctx.restore();
  // parlaklık
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(x - r * 0.42, y - r * 0.52, r * 0.24, r * 0.14, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; circle(ctx, x - r * 0.18, y - r * 0.66, r * 0.05); ctx.fill();
});
const footTex = (s: Phaser.Scene, c: number) => T(s, `hero-foot-${c.toString(16)}`, 16, 11, (ctx) => {
  const g = ctx.createLinearGradient(0, 0, 0, 11); g.addColorStop(0, css(lighten(c, 0.1))); g.addColorStop(1, css(darken(c, 0.45)));
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(8, 5.5, 7, 4.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = css(darken(c, 0.6)); ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(6, 3.4, 3, 1.3, 0, 0, Math.PI * 2); ctx.fill();
});
const scleraTex = (s: Phaser.Scene) => T(s, 'hero-sclera', 16, 18, (ctx) => {
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(8, 9, 6.4, 7.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(20,10,50,0.55)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(120,110,200,0.18)'; ctx.beginPath(); ctx.ellipse(8, 12, 5.6, 3.6, 0, 0, Math.PI); ctx.fill();
});
const pupilTex = (s: Phaser.Scene) => T(s, 'hero-pupil', 10, 10, (ctx) => {
  const g = ctx.createRadialGradient(4, 4, 0.5, 5, 5, 4.4); g.addColorStop(0, '#3a2a6a'); g.addColorStop(1, '#0e0820'); circle(ctx, 5, 5, 4); ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = '#fff'; circle(ctx, 6.4, 3.4, 1.4); ctx.fill(); circle(ctx, 3.6, 6.6, 0.6); ctx.fill();
});
type Face = 'smile' | 'open' | 'o' | 'grin' | 'hurt' | 'flat';
const mouthTex = (s: Phaser.Scene, m: Face) => T(s, `hero-mouth-${m}`, 20, 14, (ctx) => {
  ctx.strokeStyle = '#1a0e3a'; ctx.fillStyle = '#1a0e3a'; ctx.lineWidth = 1.9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (m) {
    case 'smile': ctx.beginPath(); ctx.arc(10, 3, 5.2, Math.PI * 0.18, Math.PI * 0.82); ctx.stroke(); break;
    case 'open': ctx.beginPath(); ctx.moveTo(4.5, 4); ctx.quadraticCurveTo(10, 4.8, 15.5, 4); ctx.quadraticCurveTo(15, 12, 10, 12); ctx.quadraticCurveTo(5, 12, 4.5, 4); ctx.fill(); ctx.fillStyle = '#ff7a9a'; ctx.beginPath(); ctx.ellipse(10, 10, 3.2, 1.6, 0, 0, Math.PI * 2); ctx.fill(); break;
    case 'grin': ctx.beginPath(); ctx.moveTo(3.5, 3); ctx.quadraticCurveTo(10, 4, 16.5, 3); ctx.quadraticCurveTo(15.5, 12.5, 10, 12.5); ctx.quadraticCurveTo(4.5, 12.5, 3.5, 3); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(5.5, 3.4, 9, 2.2); ctx.fillStyle = '#ff7a9a'; ctx.beginPath(); ctx.ellipse(10, 10.4, 3.6, 1.8, 0, 0, Math.PI * 2); ctx.fill(); break;
    case 'o': ctx.beginPath(); ctx.ellipse(10, 7, 2.8, 3.4, 0, 0, Math.PI * 2); ctx.fill(); break;
    case 'hurt': ctx.beginPath(); ctx.moveTo(4, 8); ctx.quadraticCurveTo(7, 5, 10, 8); ctx.quadraticCurveTo(13, 11, 16, 8); ctx.stroke(); break;
    case 'flat': ctx.beginPath(); ctx.moveTo(6.5, 7); ctx.quadraticCurveTo(10, 8.2, 13.5, 7); ctx.stroke(); break;
  }
});
const happyEyesTex = (s: Phaser.Scene) => T(s, 'hero-eyes-happy', 34, 14, (ctx) => {
  ctx.strokeStyle = '#1a0e3a'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  for (const x of [9.5, 24.5]) { ctx.beginPath(); ctx.arc(x, 9.5, 4.6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
});
const hurtEyesTex = (s: Phaser.Scene) => T(s, 'hero-eyes-hurt', 34, 14, (ctx) => {
  ctx.strokeStyle = '#1a0e3a'; ctx.lineWidth = 2.3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(5.5, 3.5); ctx.lineTo(12.5, 7); ctx.lineTo(5.5, 10.5); ctx.moveTo(28.5, 3.5); ctx.lineTo(21.5, 7); ctx.lineTo(28.5, 10.5); ctx.stroke();
});
const cheekTex = (s: Phaser.Scene) => T(s, 'hero-cheek', 12, 8, (ctx) => { glow(ctx, 6, 4, 5.5, 0xff7aa8, 0.75); });
const browTex = (s: Phaser.Scene) => T(s, 'hero-brow', 10, 5, (ctx) => { ctx.strokeStyle = '#1a0e3a'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(1.5, 1.5); ctx.lineTo(8.5, 3.5); ctx.stroke(); });
const wingTex = (s: Phaser.Scene) => T(s, 'hero-wing', 44, 52, (ctx) => {
  // ses dalgası kanadı: köke (sol) bağlı iç içe yaylar
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const r = 10 + i * 9; const a = 0.95 - i * 0.08;
    ctx.strokeStyle = css(THEME.teal, 0.25 * a); ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(2, 26, r, -1.05 + i * 0.05, 1.05 - i * 0.05); ctx.stroke();
    ctx.strokeStyle = css(i % 2 ? 0xe9fffd : lighten(THEME.teal, 0.3), a); ctx.lineWidth = 2.4 - i * 0.3; ctx.beginPath(); ctx.arc(2, 26, r, -1.05 + i * 0.05, 1.05 - i * 0.05); ctx.stroke();
  }
  glow(ctx, 40, 6, 3, 0xffffff, 0.9); glow(ctx, 40, 46, 3, 0xffffff, 0.9);
});
const shieldTex = (s: Phaser.Scene) => T(s, 'hero-shield', 76, 76, (ctx) => {
  const g = ctx.createRadialGradient(38, 38, 22, 38, 38, 36); g.addColorStop(0, 'rgba(46,230,214,0)'); g.addColorStop(0.8, 'rgba(46,230,214,0.18)'); g.addColorStop(1, 'rgba(200,255,250,0.6)');
  circle(ctx, 38, 38, 35); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(220,255,252,0.85)'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(38, 38, 30, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
});

/** kozmetik şapka: 64×64, merkez kahraman merkezinde (yarıçap 22, başın tepesi y≈10) — arayüz avatarıyla aynı koordinatlar */
export function hatTex(s: Phaser.Scene, hat: string): string | null {
  const known = ['bere', 'kulaklik', 'nota', 'dalgic', 'tac', 'parti', 'kasif', 'koklea', 'yildiz', 'altin'];
  if (!known.includes(hat)) return null;
  return T(s, `hero-hat-${hat}`, 64, 64, (ctx) => paintHat(ctx, hat));
}
function star(ctx: Ctx, cx: number, cy: number, r: number) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.46 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } ctx.closePath(); }
const gold = (ctx: Ctx, y0: number, y1: number) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, css(THEME.gold)); g.addColorStop(1, css(THEME.gold2)); return g; };
function paintHat(ctx: Ctx, hat: string) {
  const ink = '#2a1440'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  switch (hat) {
    case 'bere': {
      const g = ctx.createLinearGradient(0, 2, 0, 20); g.addColorStop(0, '#ff8aa8'); g.addColorStop(1, '#d83a64');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(11, 18); ctx.bezierCurveTo(11, 2, 53, 2, 53, 18); ctx.closePath(); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.strokeStyle = 'rgba(120,10,50,0.35)'; ctx.lineWidth = 1.2; for (let x = 18; x < 50; x += 5) { ctx.beginPath(); ctx.moveTo(x, 17); ctx.quadraticCurveTo(x + 1, 11, x + 3, 7); ctx.stroke(); }
      ctx.fillStyle = '#fff6e5'; ctx.beginPath(); ctx.roundRect(9.5, 15, 45, 7, 3.5); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.fillStyle = '#e8d8c8'; for (let x = 13; x < 52; x += 4) { ctx.fillRect(x, 16.5, 1.6, 4); }
      const pg = ctx.createRadialGradient(30, 1, 1, 32, 3, 6); pg.addColorStop(0, '#fff'); pg.addColorStop(1, '#e8dcd0'); ctx.fillStyle = pg; circle(ctx, 32, 3.5, 5.2); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.stroke();
      break;
    }
    case 'kulaklik': {
      ctx.strokeStyle = '#1a1030'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(32, 32, 26, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.strokeStyle = '#6a5ab0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(32, 32, 26, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      for (const x of [3, 50]) { const g = ctx.createLinearGradient(x, 0, x + 11, 0); g.addColorStop(0, '#ff8aa8'); g.addColorStop(1, '#c02a54'); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, 23, 11, 20, 5); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.3; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.roundRect(x + 2.5, 26, 2.5, 8, 1.2); ctx.fill(); }
      break;
    }
    case 'nota': {
      ctx.strokeStyle = ink; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(32, 11); ctx.quadraticCurveTo(30, 6, 34, 2); ctx.stroke();
      glow(ctx, 33, 2, 8, THEME.gold, 0.6); ctx.fillStyle = gold(ctx, -4, 6); ctx.beginPath(); ctx.ellipse(32, 2.5, 4.4, 3.2, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#8a4500'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = '#8a4500'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(36, 2); ctx.lineTo(36, -6); ctx.stroke();
      break;
    }
    case 'dalgic': {
      ctx.strokeStyle = '#0a4a48'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(9, 29); ctx.lineTo(55, 29); ctx.stroke();
      for (const x of [24.5, 39.5]) { const g = ctx.createRadialGradient(x - 3, 26, 1, x, 29.5, 8.5); g.addColorStop(0, 'rgba(220,255,255,0.75)'); g.addColorStop(1, 'rgba(80,200,220,0.4)'); circle(ctx, x, 29.5, 8); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = css(THEME.teal); ctx.lineWidth = 2.6; ctx.stroke(); ctx.strokeStyle = '#0a4a48'; ctx.lineWidth = 1; circle(ctx, x, 29.5, 9.4); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x - 3.2, 26, 2.2, 1.3, -0.6, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = css(THEME.teal); ctx.fillRect(31, 28, 2, 3);
      break;
    }
    case 'tac': {
      glow(ctx, 32, 8, 18, THEME.gold, 0.35);
      ctx.fillStyle = gold(ctx, 0, 15); ctx.beginPath(); ctx.moveTo(17, 15); ctx.lineTo(17, 3); ctx.lineTo(24, 9); ctx.lineTo(32, 0); ctx.lineTo(40, 9); ctx.lineTo(47, 3); ctx.lineTo(47, 15); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#7a3a00'; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.fillStyle = css(THEME.coral); circle(ctx, 32, 10, 2.6); ctx.fill(); ctx.fillStyle = css(THEME.teal); circle(ctx, 23.5, 12, 1.8); ctx.fill(); circle(ctx, 40.5, 12, 1.8); ctx.fill();
      for (const [x, y] of [[17, 3], [32, 0], [47, 3]] as [number, number][]) { ctx.fillStyle = '#fff6c4'; circle(ctx, x, y, 1.8); ctx.fill(); }
      break;
    }
    case 'parti': {
      const g = ctx.createLinearGradient(22, 0, 44, 0); g.addColorStop(0, '#5af0e0'); g.addColorStop(1, '#0a9a94');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(21, 14); ctx.lineTo(43, 14); ctx.lineTo(33, -6); ctx.closePath(); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.moveTo(21, 14); ctx.lineTo(43, 14); ctx.lineTo(33, -6); ctx.closePath(); ctx.clip(); ctx.strokeStyle = css(THEME.gold); ctx.lineWidth = 3; for (let y = -2; y < 16; y += 6) { ctx.beginPath(); ctx.moveTo(18, y + 4); ctx.lineTo(46, y - 2); ctx.stroke(); } ctx.restore();
      ctx.fillStyle = css(THEME.coral); circle(ctx, 33, -6, 3.6); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.stroke();
      break;
    }
    case 'kasif': {
      ctx.fillStyle = '#7a5226'; ctx.beginPath(); ctx.ellipse(32, 14, 26, 5.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.3; ctx.stroke();
      const g = ctx.createLinearGradient(0, 0, 0, 15); g.addColorStop(0, '#e0b070'); g.addColorStop(1, '#a87638');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(17, 13); ctx.bezierCurveTo(17, -1, 47, -1, 47, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5a3414'; ctx.fillRect(17.5, 8.5, 29, 3.6); ctx.fillStyle = css(THEME.gold); ctx.fillRect(38, 8.5, 3, 3.6);
      break;
    }
    case 'koklea': {
      const g = ctx.createRadialGradient(44, 9, 1, 46, 12, 9); g.addColorStop(0, '#fff'); g.addColorStop(1, '#ffc2d6'); circle(ctx, 46, 12, 8.4); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#8a2a4a'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.save(); spiralPath(ctx, 46, 12, 7.2, 2.3, 1, 70); ctx.strokeStyle = css(THEME.coral); ctx.lineWidth = 1.8; ctx.stroke(); ctx.restore();
      break;
    }
    case 'yildiz': {
      ctx.strokeStyle = '#a35a00'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(32, 32, 23, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); ctx.strokeStyle = css(THEME.gold); ctx.lineWidth = 2.2; ctx.stroke();
      glow(ctx, 32, 7, 13, THEME.gold, 0.55); star(ctx, 32, 7, 8.5); ctx.fillStyle = gold(ctx, -2, 16); ctx.fill(); ctx.strokeStyle = '#8a4500'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; circle(ctx, 30, 5, 1.6); ctx.fill();
      break;
    }
    case 'altin': {
      glow(ctx, 32, 6, 16, THEME.gold, 0.6);
      const g = ctx.createRadialGradient(29, 3, 1, 32, 6, 9); g.addColorStop(0, '#fffbe0'); g.addColorStop(1, css(THEME.gold)); circle(ctx, 32, 6.5, 8.4); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#8a4500'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.save(); spiralPath(ctx, 32, 6.5, 7.6, 2.3, 1, 70); ctx.strokeStyle = '#a35a00'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#fff'; circle(ctx, 43, 1.5, 1.6); ctx.fill(); circle(ctx, 20, 3.5, 1.2); ctx.fill();
      break;
    }
  }
}

// ---------------------------------------------------------------- görsel
class HeroView implements HeroVisual {
  readonly root: Phaser.GameObjects.Container;
  private squash: Phaser.GameObjects.Container; private spin: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Image; private feet: Phaser.GameObjects.Image[]; private sclera: Phaser.GameObjects.Image[]; private pupils: Phaser.GameObjects.Image[];
  private happyEyes: Phaser.GameObjects.Image; private hurtEyes: Phaser.GameObjects.Image; private brows: Phaser.GameObjects.Image[]; private mouths: Record<Face, Phaser.GameObjects.Image>;
  private cheeks: Phaser.GameObjects.Image[]; private halo: Phaser.GameObjects.Image; private wings: Phaser.GameObjects.Image[]; private hat?: Phaser.GameObjects.Image; private shield: Phaser.GameObjects.Image;
  private trail: Phaser.GameObjects.Image[] = []; private hist: { x: number; y: number }[] = [];
  private state: HeroPose = 'run'; private vx = 0; private vy = 0; private flip = false; private gflip = false;
  private sx = 1; private sy = 1; private blinkAt = 0; private blinkT = 0; private lastGhost = 0; private lastPuff = 0;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly onUpdate: (t: number, dt: number) => void;
  constructor(private scene: Phaser.Scene, cosmetic: HeroCosmetic) {
    const c = cosmetic.color ?? 0x6c4cf1; const s = scene; const r = 1 / R();
    this.root = s.add.container(0, 0).setDepth(20);
    // iz (dünyada, kahramanın arkasında)
    for (let i = 0; i < 9; i++) { const t = s.add.image(0, 0, softGlowTex(s)).setBlendMode(ADD).setTint(lighten(c, 0.45)).setAlpha(0).setDepth(19); this.trail.push(t); }
    this.halo = s.add.image(0, CY, softGlowTex(s)).setBlendMode(ADD).setTint(lighten(c, 0.5)).setAlpha(0.42).setDisplaySize(128, 128);
    this.squash = s.add.container(0, 0); this.spin = s.add.container(0, CY); this.squash.add(this.spin);
    this.wings = [-1, 1].map((d) => I(s, wingTex(s), d * 14, -2).setOrigin(0.04, 0.5).setScale(r * d, r).setAlpha(0));
    this.feet = [-1, 1].map((d) => I(s, footTex(s, c), d * 8, 20));
    this.body = I(s, bodyTex(s, c));
    this.cheeks = [-1, 1].map((d) => I(s, cheekTex(s), d * 12.5, 6).setAlpha(0.8));
    this.sclera = [-1, 1].map((d) => I(s, scleraTex(s), d * 7.6, -3.5));
    this.pupils = [-1, 1].map((d) => I(s, pupilTex(s), d * 7.6 + 1.5, -2.5));
    this.happyEyes = I(s, happyEyesTex(s), 0, -3).setVisible(false);
    this.hurtEyes = I(s, hurtEyesTex(s), 0, -3).setVisible(false);
    this.brows = [-1, 1].map((d) => { const b = I(s, browTex(s), d * 7.6, -12).setVisible(false); b.scaleX = r * -d; return b; });
    this.mouths = { smile: I(s, mouthTex(s, 'smile'), 1, 8), open: I(s, mouthTex(s, 'open'), 1, 8), o: I(s, mouthTex(s, 'o'), 1, 8), grin: I(s, mouthTex(s, 'grin'), 1, 8), hurt: I(s, mouthTex(s, 'hurt'), 1, 8), flat: I(s, mouthTex(s, 'flat'), 1, 8) };
    const hk = cosmetic.hat ? hatTex(s, cosmetic.hat) : null;
    this.spin.add([...this.wings, ...this.feet, this.body, ...this.cheeks, ...this.sclera, ...this.pupils, this.happyEyes, this.hurtEyes, ...this.brows, ...Object.values(this.mouths)]);
    if (hk) { this.hat = I(s, hk, 0, 0); this.spin.add(this.hat); }
    this.shield = I(s, shieldTex(s), 0, CY).setBlendMode(ADD).setVisible(false);
    this.root.add([this.halo, this.squash, this.shield]);
    this.dust = s.add.particles(0, 0, puffTex(s), { speed: { min: 20, max: 70 }, angle: { min: 190, max: 350 }, scale: { start: 0.35, end: 0.05 }, alpha: { start: 0.55, end: 0 }, lifespan: 380, gravityY: -40, tint: 0xe8dcff, emitting: false }).setDepth(19);
    this.setFace('smile');
    this.blinkAt = s.time.now + 1500;
    this.onUpdate = (t, dt) => this.tick(t, dt);
    s.events.on('update', this.onUpdate);
    this.tw(this.halo, { alpha: 0.28, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }
  private tw(target: object, cfg: Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>) { this.scene.tweens.add({ targets: target, ...cfg }); }
  private setFace(m: Face) { for (const [k, o] of Object.entries(this.mouths)) o.setVisible(k === m); }
  private eyes(mode: 'open' | 'happy' | 'hurt') { const o = mode === 'open'; for (const e of [...this.sclera, ...this.pupils]) e.setVisible(o); this.happyEyes.setVisible(mode === 'happy'); this.hurtEyes.setVisible(mode === 'hurt'); }
  setPose(state: HeroPose, vx = 0, vy = 0) {
    this.vx = vx; this.vy = vy;
    if (state === this.state) return;
    const prev = this.state; this.state = state;
    if (state === 'jump' && prev !== 'jump') { this.sx = 0.82; this.sy = 1.22; this.puff(0, 0, 4); }
    if (state === 'dash') { this.sx = 1.45; this.sy = 0.7; }
    if (state === 'hurt') { this.body.setTintFill(0xffffff); this.scene.time.delayedCall(90, () => this.body.clearTint().setTint(0xffb0c0)); this.scene.time.delayedCall(600, () => this.body.clearTint()); }
    if (state === 'win') for (let i = 0; i < 6; i++) { const sp = this.scene.add.image(this.root.x, this.root.y + CY, sparkTex(this.scene)).setBlendMode(ADD).setTint(i % 2 ? THEME.gold : 0xffffff).setDepth(21).setScale(0.4); const a = -Math.PI / 2 + (i - 2.5) * 0.45; this.scene.tweens.add({ targets: sp, x: sp.x + Math.cos(a) * 50, y: sp.y + Math.sin(a) * 50, scale: 0, angle: 200, duration: 700, onComplete: () => sp.destroy() }); }
  }
  land(impact = 600) {
    const k = Math.max(0.15, Math.min(1, impact / 900)); this.sx = 1 + 0.38 * k; this.sy = 1 - 0.32 * k;
    this.puff(0, 0, Math.round(3 + k * 6));
    if (this.state === 'pound') { const rg = this.scene.add.image(this.root.x, this.root.y - 4, ringTex(this.scene)).setBlendMode(ADD).setTint(0xe6dcff).setDepth(21).setScale(0.15, 0.05); this.scene.tweens.add({ targets: rg, scaleX: 0.9, scaleY: 0.2, alpha: 0, duration: 380, onComplete: () => rg.destroy() }); }
  }
  private puff(dx: number, dy: number, n: number) { this.dust.explode(n, this.root.x + dx, this.root.y + dy - 2); }
  private tick(time: number, dt: number) {
    if (!this.root.active) return;
    const st = this.state; const t = time / 1000; const k = Math.min(1, dt / 16.7);
    let tx = 1, ty = 1, rot = 0, bodyY = 0, wingA = 0, look = { x: 1.5, y: 0.5 }; let face: Face = 'smile'; let eyes: 'open' | 'happy' | 'hurt' = 'open'; let brows = false; let feetMode: 'run' | 'tuck' | 'dangle' | 'stand' = 'stand';
    const speed = Math.abs(this.vx);
    switch (st) {
      case 'run': case 'idle': {
        const f = st === 'idle' ? 2.2 : 9 + Math.min(4, speed / 120); const ph = Math.abs(Math.sin(t * f));
        bodyY = st === 'idle' ? -Math.sin(t * 2.2) * 1 : -ph * 4; ty = st === 'idle' ? 1 + Math.sin(t * 2.2) * 0.02 : 1 - (1 - ph) * 0.07; tx = 2 - ty;
        rot = st === 'idle' ? 0 : 0.07; feetMode = st === 'idle' ? 'stand' : 'run'; break;
      }
      case 'jump': { const q = Math.min(1, Math.max(0, -this.vy / 900)); ty = 1 + 0.16 * q; tx = 1 - 0.1 * q; look = { x: 1.5, y: -1.6 }; face = 'open'; feetMode = 'tuck'; rot = 0.05; break; }
      case 'fall': { const q = Math.min(1, Math.max(0, this.vy / 900)); ty = 1 + 0.08 * q; tx = 1 - 0.05 * q; look = { x: 1.2, y: 1.8 }; face = 'o'; feetMode = 'dangle'; break; }
      case 'slide': ty = 0.66; tx = 1.3; bodyY = 4; rot = -0.12; face = 'grin'; feetMode = 'tuck'; look = { x: 2, y: 0.5 }; if (time - this.lastPuff > 70) { this.lastPuff = time; this.puff(-14 * (this.flip ? -1 : 1), 0, 1); } break;
      case 'wall': tx = 0.84; ty = 1.08; rot = 0; look = { x: -0.5, y: -1.8 }; face = 'flat'; feetMode = 'stand'; if (time - this.lastPuff > 110) { this.lastPuff = time; this.puff(12 * (this.flip ? -1 : 1), CY + 10, 1); } break;
      case 'glide': { ty = 0.95 + Math.sin(t * 6) * 0.02; tx = 1.03; bodyY = Math.sin(t * 3) * 2; wingA = 1; face = 'smile'; feetMode = 'dangle'; look = { x: 1.6, y: 0.8 }; break; }
      case 'swing': { rot = Math.max(-0.6, Math.min(0.6, this.vx / 900)); ty = 1.06; tx = 0.95; face = 'open'; feetMode = 'dangle'; look = { x: 2, y: -0.5 }; break; }
      case 'swim': { rot = Math.max(-0.35, Math.min(0.35, -this.vy / 900)); bodyY = Math.sin(t * 3) * 2; ty = 1 + Math.sin(t * 5) * 0.04; tx = 2 - ty; face = 'o'; feetMode = 'run'; if (time - this.lastPuff > 600) { this.lastPuff = time; this.bubble(); } break; }
      case 'dash': ty = 0.74; tx = 1.4; face = 'grin'; brows = true; feetMode = 'tuck'; look = { x: 2.4, y: 0 }; wingA = 0; if (time - this.lastGhost > 34) { this.lastGhost = time; this.ghost(); } break;
      case 'pound': ty = this.vy > 0 ? 1.26 : 1; tx = this.vy > 0 ? 0.8 : 1; face = 'flat'; brows = true; eyes = 'hurt'; feetMode = 'tuck'; look = { x: 0, y: 2 }; break;
      case 'hurt': { face = 'hurt'; eyes = 'hurt'; rot = Math.sin(t * 40) * 0.12; feetMode = 'dangle'; ty = 0.96; tx = 1.04; this.root.alpha = Math.sin(t * 30) > 0 ? 1 : 0.45; break; }
      case 'win': { const ph = Math.abs(Math.sin(t * 7)); bodyY = -ph * 10; ty = 1 + (ph - 0.5) * 0.1; tx = 2 - ty; face = 'grin'; eyes = 'happy'; feetMode = 'tuck'; rot = Math.sin(t * 3.5) * 0.12; break; }
    }
    if (st !== 'hurt' && this.root.alpha < 1 && !this.hiddenAlpha) this.root.alpha = this.baseAlpha;
    // yumuşak geçiş (iniş basılması kendi yayıyla söner)
    const ease = 0.22 * k; this.sx += (tx - this.sx) * ease; this.sy += (ty - this.sy) * ease;
    this.squash.setScale(this.sx * (this.flip ? -1 : 1), this.sy * (this.gflip ? -1 : 1));
    this.spin.y = CY + bodyY; this.spin.rotation += (rot - this.spin.rotation) * 0.25 * k;
    // yüz
    this.setFace(face); this.eyes(eyes); for (const b of this.brows) b.setVisible(brows);
    if (eyes === 'open') {
      if (time > this.blinkAt) { this.blinkT = time; this.blinkAt = time + 2200 + Math.random() * 2600; }
      const bl = time - this.blinkT < 120 ? 0.12 : 1;
      const r = 1 / R(); this.sclera.forEach((e) => (e.scaleY = r * bl)); this.pupils.forEach((p, i) => { p.scaleY = r * bl; p.x += ((i ? 7.6 : -7.6) + look.x - p.x) * 0.3; p.y += (-3 + look.y - p.y) * 0.3; });
    }
    // ayaklar
    const fph = t * 14;
    this.feet.forEach((f, i) => {
      const d = i ? 1 : -1; let fx = d * 8, fy = 20;
      if (feetMode === 'run') { const a = fph + (i ? Math.PI : 0); fx += Math.cos(a) * 5; fy += Math.min(0, Math.sin(a)) * 5 - bodyY; }
      else if (feetMode === 'tuck') { fx = d * 9; fy = 15; }
      else if (feetMode === 'dangle') { fx = d * 7; fy = 22 + Math.sin(t * 8 + i) * 1.5; }
      else fy = 20 - bodyY;
      f.x += (fx - f.x) * 0.4; f.y += (fy - f.y) * 0.4;
    });
    // kanatlar
    for (const w of this.wings) { const a = w.alpha + (wingA - w.alpha) * 0.2 * k; w.setAlpha(a); const r = 1 / R(); w.scaleY = r * (0.75 + Math.sin(t * 9) * 0.25); w.rotation = (w.scaleX > 0 ? 1 : -1) * Math.sin(t * 9) * 0.12; }
    // iz
    this.hist.unshift({ x: this.root.x, y: this.root.y + CY }); if (this.hist.length > 24) this.hist.length = 24;
    const fast = st === 'dash' ? 1 : Math.min(1, Math.max(0, (Math.hypot(this.vx, this.vy) - 260) / 500));
    this.trail.forEach((tr, i) => { const p = this.hist[Math.min(this.hist.length - 1, (i + 1) * 2)]; if (!p) return; tr.setPosition(p.x, p.y); const q = 1 - i / this.trail.length; tr.setAlpha(fast * q * 0.45 * this.root.alpha * (this.root.visible ? 1 : 0)); tr.setDisplaySize(44 * q + 8, 44 * q + 8); });
    this.halo.setDisplaySize(128 * (1 + fast * 0.15), 128 * (1 + fast * 0.15));
  }
  private ghost() {
    const s = this.scene; const g = s.add.image(this.root.x, this.root.y + CY * this.sy, this.body.texture.key).setScale(this.sx / R(), this.sy / R()).setTintFill(lighten(THEME.teal, 0.3)).setAlpha(0.5).setDepth(19).setBlendMode(ADD);
    s.tweens.add({ targets: g, alpha: 0, scaleX: g.scaleX * 0.8, duration: 240, onComplete: () => g.destroy() });
  }
  private bubble() {
    const s = this.scene; const b = s.add.image(this.root.x + (this.flip ? -12 : 12), this.root.y + CY - 6, sparkTex(s)).setTint(0xdffcff).setScale(0.22).setDepth(21).setAlpha(0.9);
    s.tweens.add({ targets: b, y: b.y - 50, x: b.x + (Math.random() - 0.5) * 12, alpha: 0, duration: 1200, onComplete: () => b.destroy() });
  }
  private baseAlpha = 1; private hiddenAlpha = false;
  setPosition(x: number, y: number) { this.root.setPosition(x, y); this.shield.setPosition(0, CY); }
  setFlipX(flip: boolean) { this.flip = flip; }
  setGravityFlip(flip: boolean) { this.gflip = flip; }
  setVisible(v: boolean) { this.root.setVisible(v); if (!v) this.trail.forEach((t) => t.setAlpha(0)); }
  setAlpha(a: number) { this.baseAlpha = a; this.root.setAlpha(a); }
  setDepth(d: number) { this.root.setDepth(d); this.trail.forEach((t) => t.setDepth(d - 1)); this.dust.setDepth(d - 1); }
  setShield(on: boolean) { this.shield.setVisible(on); if (on) this.tw(this.shield, { alpha: { from: 1, to: 0.6 }, duration: 700, yoyo: true, repeat: -1 }); }
  destroy() { this.scene.events.off('update', this.onUpdate); this.root.destroy(); this.trail.forEach((t) => t.destroy()); this.dust.destroy(); }
}

export function createHeroVisual(scene: Phaser.Scene, cosmetic: HeroCosmetic = {}): HeroVisual { return new HeroView(scene, cosmetic); }
