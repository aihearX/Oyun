/**
 * Bölge patolojilerinin ayrı görsel dili (content/src/patolojiler.ts): işaretli engel "iltihaplı" görünür — kızarık, soluk bir
 * örtü ve kırmızımsı kesik kenar; ilk görüşte üstünde tıbbi artı rozeti belirir (sighted). Tedavi Odası malzemesi etkisiz
 * kılınca örtü yeşile döner, engel sönükleşir (cured). Düşme bölgesi (decor 'patoloji') yalnız kenarlarında yırtık/iltihaplı
 * dokuyla çizilir (zarın deliği, kopuk zincir, seyrek basamak).
 */
import Phaser from 'phaser';
import { softGlowTex } from './tex';
import { viewTopLeft } from './util';
import type { EntityView } from './view';

const ADD = Phaser.BlendModes.ADD;
export const INFLAMED = 0xd8436e;
const CURED = 0x5fe39a;

/** öğenin yerel sınırları (kap kökenine göre): diken zeminden yukarı, ötekiler sol üstten */
function bounds(type: string, w: number, h: number): { x: number; y: number; w: number; h: number } {
  if (type === 'spike') return { x: 0, y: -18, w, h: 18 };
  if (type === 'decor') return { x: 0, y: -14, w, h: 14 };
  return { x: 0, y: 0, w, h: Math.max(16, h) };
}

function crossBadge(s: Phaser.Scene, x: number, y: number, color: number): Phaser.GameObjects.Container {
  const c = s.add.container(x, y);
  const halo = s.add.image(0, 0, softGlowTex(s)).setBlendMode(ADD).setTint(color).setDisplaySize(46, 46).setAlpha(0.6);
  const g = s.add.graphics();
  g.fillStyle(0xffffff, 1).fillCircle(0, 0, 11).lineStyle(2, color, 1).strokeCircle(0, 0, 11);
  g.fillStyle(color, 1).fillRect(-2.5, -7, 5, 14).fillRect(-7, -2.5, 14, 5);
  c.add([halo, g]);
  return c;
}

/** patoloji işaretli öğeye iltihap örtüsü + gizli rozet (ilk görüşte `sighted`, etkisiz kalınca `cured`) */
export function markPathology(v: EntityView, type: string, w: number, h: number) {
  const s = v.scene; const b = bounds(type, Math.max(16, w), h);
  const glowI = s.add.image(b.x + b.w / 2, b.y + b.h / 2, softGlowTex(s)).setBlendMode(ADD).setTint(INFLAMED).setDisplaySize(b.w * 1.25 + 30, b.h * 1.25 + 30).setAlpha(0.32);
  const veil = s.add.graphics();
  const drawVeil = (color: number, a: number) => {
    veil.clear();
    if (type === 'decor') {
      // yırtık, kızarık kenarlar (çukurun iki yanı)
      veil.fillStyle(color, a + 0.35);
      for (const [x0, dir] of [[b.x, 1], [b.x + b.w, -1]] as [number, number][]) {
        veil.beginPath(); veil.moveTo(x0, 0);
        for (let k = 0; k <= 4; k++) veil.lineTo(x0 + dir * (k % 2 ? 12 : 4), -4 - k * 4);
        veil.lineTo(x0, -22); veil.closePath(); veil.fillPath();
      }
      return;
    }
    veil.fillStyle(color, a).fillRoundedRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4, 8);
    veil.lineStyle(2, color, Math.min(1, a + 0.45));
    for (let x = b.x; x < b.x + b.w; x += 14) veil.lineBetween(x, b.y - 2, Math.min(b.x + b.w, x + 7), b.y - 2);
  };
  drawVeil(INFLAMED, 0.2);
  v.add([glowI, veil]);
  v.tw({ targets: glowI, alpha: 0.12, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  const badge = crossBadge(s, b.x + b.w / 2, b.y - 26, INFLAMED).setScale(0).setAlpha(0); v.add(badge);
  let shown = false;
  v.h.sighted = () => {
    if (shown) return; shown = true;
    v.tw({ targets: badge, scale: 1, alpha: 1, duration: 260, ease: 'Back.Out' });
    v.tw({ targets: badge, y: badge.y - 5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: 260 });
  };
  v.h.cured = () => {
    drawVeil(CURED, 0.22); glowI.setTint(CURED);
    const nb = crossBadge(s, badge.x, badge.y, CURED).setScale(0); v.add(nb); badge.setVisible(false);
    v.tw({ targets: nb, scale: 1.2, duration: 220, ease: 'Back.Out' });
    v.tw({ targets: v, alpha: 0.45, duration: 400 });
  };
}

/** ilk görüşte engelin üstünde patolojinin adı (tıbbi artıyla); kısa süre durur, sonra süzülüp söner */
export function pathologyLabel(s: Phaser.Scene, x: number, y: number, text: string, font: string) {
  const res = Math.max(1, Math.min(3, s.cameras.main.zoom || 1));
  const t = s.add.text(x, y, `✚ ${text}`, { fontFamily: font, fontSize: '20px', fontStyle: '900', color: '#ffd1de', stroke: '#5a0f2c', strokeThickness: 6, resolution: res })
    .setOrigin(0.5).setDepth(150).setScale(0.6).setAlpha(0);
  // ekranın içinde kalsın (öğe ekranın kenarındayken yazı kesilmesin)
  const cam = s.cameras.main; const half = t.width / 2 + 10;
  const follow = () => { const L = viewTopLeft(cam).x; const W = cam.width / cam.zoom; if (W > 2 * half) t.x = Math.max(L + half, Math.min(L + W - half, x)); };
  follow(); s.events.on('update', follow); t.once('destroy', () => s.events.off('update', follow));
  s.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
  s.tweens.add({ targets: t, y: y - 40, alpha: 0, delay: 1900, duration: 600, ease: 'Cubic.In', onComplete: () => t.destroy() });
}

/** zar sertleşmesi: zarın üstünde beyaz, tebeşirimsi plaklar (kap kökeni zarın ortası, y zar tabanı) */
export function markPlaque(v: EntityView, w: number) {
  const s = v.scene; const g = s.add.graphics();
  const spots = [-0.32, -0.08, 0.18, 0.36];
  spots.forEach((f, i) => {
    const x = f * w, rw = 16 + (i % 2) * 8;
    g.fillStyle(0xf6f1e4, 0.92).fillEllipse(x, -15, rw, 7);
    g.fillStyle(0xd9d2c0, 0.9).fillEllipse(x + 3, -14, rw * 0.5, 3);
  });
  v.add(g);
}

/** orta kulakta sıvı: saman renkli seröz sıvı çanağı; düzeyi yükselip çekilir (reveal: 1 kabarık, <1 çekilmiş), kabarmadan önce kaynar */
export function buildFluid(v: EntityView, w: number, h: number) {
  const s = v.scene;
  const glowI = s.add.image(w / 2, h, softGlowTex(s)).setBlendMode(ADD).setTint(0xffd27a).setDisplaySize(w * 1.2, h * 0.9).setAlpha(0.35);
  const body = s.add.container(0, h); const g = s.add.graphics(); body.add(g);
  // yarı saydam saman sarısı sıvı: aşağı doğru koyulaşan katmanlar, yüzeyde dalga, içinde ışık çizgileri (katı blok gibi okunmasın)
  for (let k = 0; k < 4; k++) g.fillStyle(0xf2c25a, 0.16 + k * 0.07).fillRect(0, -h + (k * h) / 4, w, h / 4 + 1);
  g.fillStyle(0xfff1b8, 0.7);
  for (let x = 0; x < w; x += 22) g.fillEllipse(x + 11, -h, 24, 7);
  g.lineStyle(2, 0xfff6d5, 0.95).lineBetween(0, -h + 1, w, -h + 1);
  g.lineStyle(2, 0xffffff, 0.22);
  for (let k = 1; k < 4; k++) for (let x = 10 + (k * 37) % 50; x < w - 30; x += 90) g.lineBetween(x, -h + k * (h / 4), x + 34, -h + k * (h / 4));
  const bubbles: Phaser.GameObjects.Arc[] = [];
  for (let i = 0; i < Math.max(3, Math.round(w / 60)); i++) { const b = s.add.circle(20 + ((i * 53) % Math.max(30, w - 40)), -10 - ((i * 29) % Math.max(20, h - 20)), 4 + (i % 3), 0xfff6d5, 0.7); bubbles.push(b); body.add(b); }
  v.add([glowI, body]);
  v.tw({ targets: g, x: 6, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  bubbles.forEach((b, i) => v.tw({ targets: b, y: b.y - 18, alpha: 0.15, duration: 900 + i * 130, repeat: -1, ease: 'Sine.In' }));
  body.scaleY = 0.25; let level = 0.25;
  v.h.reveal = (a: number) => { const to = a >= 1 ? 1 : 0.25; if (to === level) return; level = to; v.tw({ targets: body, scaleY: to, duration: to > 0.5 ? 380 : 700, ease: to > 0.5 ? 'Back.Out' : 'Sine.InOut' }); };
  v.h.telegraph = () => { v.tw({ targets: body, scaleY: 0.55, duration: 600, ease: 'Sine.InOut' }); v.tw({ targets: glowI, alpha: 0.85, duration: 300, yoyo: true, repeat: 1 }); };
}

/** zar çekilmesi: gevşek cep — pembe zar dokusu ve aşağı oklar (asansörün yukarı oklarının tersi: "seni aşağı çeker") */
export function markSag(v: EntityView, w: number) {
  const s = v.scene; const g = s.add.graphics();
  g.fillStyle(0xffb3c7, 0.55).fillRoundedRect(0, 0, w, 18, 8);
  g.lineStyle(3, 0x8a2a4a, 0.9);
  for (let x = w / 2 - 36; x <= w / 2 + 36; x += 24) { g.beginPath(); g.moveTo(x - 7, 26); g.lineTo(x, 33); g.lineTo(x + 7, 26); g.strokePath(); }
  v.add(g);
}
