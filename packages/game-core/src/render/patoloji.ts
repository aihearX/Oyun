/**
 * Bölge patolojilerinin ayrı görsel dili (content/src/patolojiler.ts): işaretli engel "iltihaplı" görünür — kızarık, soluk bir
 * örtü ve kırmızımsı kesik kenar; ilk görüşte üstünde tıbbi artı rozeti belirir (sighted). Tedavi Odası malzemesi etkisiz
 * kılınca örtü yeşile döner, engel sönükleşir (cured). Düşme bölgesi (decor 'patoloji') yalnız kenarlarında yırtık/iltihaplı
 * dokuyla çizilir (zarın deliği, kopuk zincir, seyrek basamak).
 */
import Phaser from 'phaser';
import { softGlowTex } from './tex';
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
  const follow = () => { const v = cam.worldView; if (v.width > 2 * half) t.x = Math.max(v.x + half, Math.min(v.right - half, x)); };
  follow(); s.events.on('update', follow); t.once('destroy', () => s.events.off('update', follow));
  s.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
  s.tweens.add({ targets: t, y: y - 40, alpha: 0, delay: 1900, duration: 600, ease: 'Cubic.In', onComplete: () => t.destroy() });
}
