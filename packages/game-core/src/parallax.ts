import Phaser from 'phaser';
import type { BiomeDef } from '@odi/content';

/** Biyom motifine göre 3 katman paralaks. Dokular Graphics ile üretilir; varlık dosyası yok. */
export function buildParallax(scene: Phaser.Scene, biome: BiomeDef, worldW: number) {
  const W = scene.scale.width, H = scene.scale.height;
  scene.cameras.main.setBackgroundColor(biome.palette.sky);
  const layers: Phaser.GameObjects.TileSprite[] = [];
  const mk = (key: string, draw: (g: Phaser.GameObjects.Graphics, w: number, h: number) => void, w: number, h: number, factor: number, depth: number) => {
    if (!scene.textures.exists(key)) { const g = scene.add.graphics(); draw(g, w, h); g.generateTexture(key, w, h); g.destroy(); }
    const ts = scene.add.tileSprite(0, 0, W + 4, H, key).setOrigin(0, 0).setScrollFactor(0).setDepth(depth);
    (ts as unknown as { __factor: number }).__factor = factor;
    layers.push(ts);
  };
  const p = biome.palette;
  const far = (g: Phaser.GameObjects.Graphics, w: number, h: number) => {
    g.fillStyle(p.bgFar, 1); g.fillRect(0, 0, w, h);
    g.lineStyle(10, p.bgMid, 0.5);
    switch (biome.motif) {
      case 'auricle': for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(w / 2 + i * 60, h * 0.6, 160 + i * 90, Math.PI, Math.PI * 2); g.strokePath(); } break;
      case 'tunnel': for (let i = 0; i < 6; i++) { g.strokeEllipse(w / 2, h / 2, 120 + i * 90, 300 + i * 70); } break;
      case 'drum': for (let i = 1; i < 6; i++) g.strokeCircle(w / 2, h * 0.45, i * 60); break;
      case 'bones': g.fillStyle(p.bgMid, 0.6); g.fillRoundedRect(60, 120, 60, 260, 30); g.fillRoundedRect(220, 200, 50, 220, 25); g.fillRoundedRect(360, 90, 70, 200, 35); break;
      case 'spiral': { g.beginPath(); for (let i = 0; i <= 140; i++) { const t = (i / 140) * Math.PI * 4; const r = 12 * Math.exp(0.22 * t); const x = w / 2 + r * Math.cos(t), y = h * 0.45 + r * Math.sin(t); if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.strokePath(); break; }
      case 'nerve': g.lineStyle(4, p.bgNear, 0.6); for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(i * 70, 0); g.lineTo(i * 70 + 40, h / 3); g.lineTo(i * 70 - 20, (h * 2) / 3); g.lineTo(i * 70 + 30, h); g.strokePath(); } break;
      case 'stem': g.lineStyle(6, p.bgNear, 0.5); for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(0, i * 150); g.lineTo(w, i * 150 + 80); g.strokePath(); } break;
      case 'cortex': g.lineStyle(8, p.bgMid, 0.6); for (let i = 0; i < 6; i++) { g.beginPath(); for (let x = 0; x <= w; x += 10) { const y = i * 130 + Math.sin(x / 40 + i) * 25; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.strokePath(); } break;
    }
  };
  const mid = (g: Phaser.GameObjects.Graphics, w: number, h: number) => {
    g.fillStyle(p.bgNear, 0.35);
    for (let i = 0; i < 9; i++) { const x = (i * 97) % w, y = (i * 173) % h, r = 8 + (i % 4) * 7; g.fillCircle(x, y, r); }
    if (biome.motif === 'spiral') { g.lineStyle(3, p.accent, 0.25); for (let i = 0; i < 4; i++) g.strokeCircle((i * 150) % w, (i * 220) % h, 40 + i * 10); }
  };
  mk(`bg-far-${biome.id}`, far, 520, H, 0.12, -30);
  mk(`bg-mid-${biome.id}`, mid, 420, H, 0.35, -20);
  void worldW;
  return {
    update(scrollX: number) { for (const l of layers) l.tilePositionX = scrollX * (l as unknown as { __factor: number }).__factor; },
  };
}
