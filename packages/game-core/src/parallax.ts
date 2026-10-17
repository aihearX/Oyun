import Phaser from 'phaser';
import type { BiomeDef } from '@odi/content';
import { drawDrop, drawFeather, drawTuft, drawWave, seeded, shade, tonotopyColor } from './art';

type G = Phaser.GameObjects.Graphics;

/**
 * Biyom motifine göre 2 katman paralaks (uzak 0.12, orta 0.35). Dokular Graphics ile bir kez üretilir
 * (`textures.exists`), varlık dosyası yok; her biyom kendi paletini ve motifini taşır:
 * auricle kepçe kıvrımları + tüyler · tunnel halkalar + serumen damlaları · drum zar halkaları + dalgalanma ·
 * bones kemik siluetleri · spiral koklea spirali + kıl hücreleri · nerve lifler + düğümler · stem çapraz yollar · cortex kıvrımlar + nöron ağı.
 */
export function buildParallax(scene: Phaser.Scene, biome: BiomeDef, worldW: number) {
  const W = scene.scale.width, H = scene.scale.height;
  scene.cameras.main.setBackgroundColor(biome.palette.sky);
  const layers: Phaser.GameObjects.TileSprite[] = [];
  const mk = (key: string, draw: (g: G, w: number, h: number) => void, w: number, h: number, factor: number, depth: number) => {
    if (!scene.textures.exists(key)) { const g = scene.add.graphics(); draw(g, w, h); g.generateTexture(key, w, h); g.destroy(); }
    const ts = scene.add.tileSprite(0, 0, W + 4, H, key).setOrigin(0, 0).setScrollFactor(0).setDepth(depth);
    (ts as unknown as { __factor: number }).__factor = factor;
    layers.push(ts);
  };
  const p = biome.palette;
  const rnd = seeded(0x51a7 ^ (biome.id.length * 977));
  const tono = biome.tonotopy ?? [0.3, 0.6];

  // ---- uzak katman: büyük anatomik şekil
  const far = (g: G, w: number, h: number) => {
    g.fillStyle(p.bgFar, 1); g.fillRect(0, 0, w, h);
    switch (biome.motif) {
      case 'auricle': {
        // kepçe kıvrımları: iç içe yaylar (heliks / antiheliks), alt kısımda yumuşak gölge
        for (let i = 0; i < 5; i++) { g.lineStyle(14 - i * 2, i % 2 ? p.bgMid : shade(p.bgMid, -0.08), 0.55 - i * 0.06); g.beginPath(); g.arc(w * 0.55 + i * 30, h * 0.62, 130 + i * 70, Math.PI * 1.02, Math.PI * 1.98); g.strokePath(); }
        g.lineStyle(10, shade(p.bgMid, -0.12), 0.35); g.beginPath(); g.arc(w * 0.2, h * 0.3, 90, Math.PI * 0.2, Math.PI * 1.3); g.strokePath();
        g.fillStyle(p.bgMid, 0.25); g.fillEllipse(w * 0.55, h * 0.78, 300, 120);
        for (let i = 0; i < 6; i++) drawFeather(g, 40 + i * (w / 6), h * 0.15 + (i % 3) * 60, 70 + (i % 2) * 30, -Math.PI / 2 + (i - 2.5) * 0.12, p.bgMid, 0.5, 7);
        break;
      }
      case 'tunnel': {
        // tünel halkaları: merkeze doğru koyulaşan elipsler, aralarda doku çizgileri
        for (let i = 7; i >= 0; i--) { g.fillStyle(shade(p.bgFar, i * 0.05), 1); g.fillEllipse(w / 2, h * 0.5, 90 + i * 80, 220 + i * 90); }
        g.lineStyle(6, p.bgMid, 0.5); for (let i = 0; i < 8; i++) g.strokeEllipse(w / 2, h * 0.5, 90 + i * 80, 220 + i * 90);
        g.fillStyle(shade(p.bgFar, -0.25), 1); g.fillEllipse(w / 2, h * 0.5, 80, 200);
        for (let i = 0; i < 7; i++) drawDrop(g, (i * 97 + 30) % w, (i * 131 + 40) % (h * 0.5), 9 + (i % 3) * 4, p.accent, 0.35);
        break;
      }
      case 'drum': {
        for (let i = 1; i < 7; i++) { g.lineStyle(8 - i, p.bgMid, 0.6 - i * 0.05); g.strokeCircle(w / 2, h * 0.45, i * 58); }
        g.lineStyle(2, p.bgMid, 0.4); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 60, h * 0.45 + Math.sin(a) * 60); g.lineTo(w / 2 + Math.cos(a) * 340, h * 0.45 + Math.sin(a) * 340); g.strokePath(); }
        g.fillStyle(p.accent, 0.12); g.fillCircle(w / 2, h * 0.45, 56);
        break;
      }
      case 'bones': {
        const bone = (x: number, y: number, len: number, wd: number, ang: number) => { g.fillStyle(p.bgMid, 0.7); const c = Math.cos(ang), s = Math.sin(ang); g.fillRoundedRect(x - wd / 2, y, wd, len, wd / 2); g.fillCircle(x - wd * 0.6 * c, y + wd * 0.2 * s, wd * 0.75); g.fillCircle(x + wd * 0.6 * c, y + wd * 0.2 * s, wd * 0.75); g.fillCircle(x - wd * 0.6 * c, y + len - wd * 0.2 * s, wd * 0.75); g.fillCircle(x + wd * 0.6 * c, y + len - wd * 0.2 * s, wd * 0.75); };
        bone(90, 110, 260, 44, 0); bone(250, 210, 200, 36, 0.2); bone(400, 80, 220, 50, -0.1); bone(560, 300, 180, 34, 0);
        g.lineStyle(3, shade(p.bgMid, -0.2), 0.35); for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(60 + i * 120, h * 0.9); g.lineTo(90 + i * 120, h * 0.75); g.lineTo(70 + i * 120, h * 0.6); g.strokePath(); }
        break;
      }
      case 'spiral': {
        // koklea spirali: tonotopi renk geçişi; her segment kendi frekans rengini taşır
        for (let i = 0; i < 150; i++) {
          const t0 = (i / 150) * Math.PI * 4, t1 = ((i + 1) / 150) * Math.PI * 4;
          const r0 = 12 * Math.exp(0.22 * t0), r1 = 12 * Math.exp(0.22 * t1);
          g.lineStyle(10, tonotopyColor(tono[0] + (tono[1] - tono[0]) * (i / 150)), 0.45);
          g.beginPath(); g.moveTo(w / 2 + r0 * Math.cos(t0), h * 0.45 + r0 * Math.sin(t0)); g.lineTo(w / 2 + r1 * Math.cos(t1), h * 0.45 + r1 * Math.sin(t1)); g.strokePath();
        }
        g.lineStyle(4, p.bgMid, 0.5); g.beginPath(); for (let i = 0; i <= 150; i++) { const t = (i / 150) * Math.PI * 4; const r = 12 * Math.exp(0.22 * t) + 18; const x = w / 2 + r * Math.cos(t), y = h * 0.45 + r * Math.sin(t); if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.strokePath();
        for (let i = 0; i < 9; i++) drawTuft(g, 30 + i * (w / 9), h - 40 - (i % 2) * 30, 50 + (i % 3) * 14, p.bgMid, 0.6);
        break;
      }
      case 'nerve': {
        for (let i = 0; i < 9; i++) { g.lineStyle(3 + (i % 3), i % 2 ? p.bgNear : p.bgMid, 0.6); g.beginPath(); g.moveTo(i * 72, 0); g.lineTo(i * 72 + 40, h / 3); g.lineTo(i * 72 - 20, (h * 2) / 3); g.lineTo(i * 72 + 30, h); g.strokePath(); }
        for (let i = 0; i < 12; i++) { const x = (i * 149 + 20) % w, y = (i * 211 + 60) % h; g.fillStyle(p.accent, 0.1); g.fillCircle(x, y, 22); g.fillStyle(p.accent, 0.5); g.fillCircle(x, y, 5); }
        break;
      }
      case 'stem': {
        for (let i = 0; i < 6; i++) { g.lineStyle(7, p.bgNear, 0.45); g.beginPath(); g.moveTo(0, i * 140); g.lineTo(w, i * 140 + 90); g.strokePath(); g.lineStyle(5, p.bgMid, 0.4); g.beginPath(); g.moveTo(w, i * 140 - 40); g.lineTo(0, i * 140 + 60); g.strokePath(); }
        for (let i = 0; i < 6; i++) { const x = (i * 173 + 50) % w, y = (i * 127 + 70) % h; g.fillStyle(p.accent, 0.35); g.fillCircle(x, y, 7); g.lineStyle(2, p.accent, 0.3); g.strokeCircle(x, y, 16); }
        break;
      }
      case 'cortex': {
        // girus/sulkus kıvrımları: kalın dalgalar
        for (let i = 0; i < 7; i++) { g.lineStyle(14, i % 2 ? p.bgMid : shade(p.bgMid, 0.3), 0.6); g.beginPath(); for (let x = 0; x <= w; x += 8) { const y = i * 120 + Math.sin(x / 42 + i) * 26 + Math.sin(x / 13) * 6; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.strokePath(); }
        break;
      }
    }
  };

  // ---- orta katman: biyoma özgü ayrıntı (şeffaf arka plan)
  const mid = (g: G, w: number, h: number) => {
    switch (biome.motif) {
      case 'auricle':
        // kıl/tüy ormanı: zeminden yükselen tüy siluetleri + ten dokusu lekeleri
        for (let i = 0; i < 10; i++) { const x = (i * 53 + 20) % w; const len = 90 + (i % 4) * 35; drawFeather(g, x, h - 20, len, -Math.PI / 2 + (rnd() - 0.5) * 0.5, i % 3 ? p.bgNear : p.accent, 0.5 + (i % 2) * 0.2, 8); }
        for (let i = 0; i < 8; i++) { g.fillStyle(p.bgNear, 0.3); g.fillCircle((i * 97) % w, (i * 173) % (h * 0.6), 8 + (i % 4) * 7); }
        break;
      case 'tunnel':
        // serumen damlaları ve sarkıtlar
        for (let i = 0; i < 7; i++) { const x = (i * 71 + 25) % w; const len = 40 + (i % 3) * 30; g.fillStyle(p.accent, 0.45); g.fillRoundedRect(x - 6, 0, 12, len, 6); drawDrop(g, x, len + 8, 9 + (i % 2) * 4, p.accent, 0.6); }
        for (let i = 0; i < 6; i++) drawDrop(g, (i * 83 + 40) % w, h * 0.45 + ((i * 61) % (h * 0.45)), 7 + (i % 3) * 5, shade(p.accent, 0.2), 0.4);
        g.lineStyle(3, p.bgNear, 0.4); for (let i = 0; i < 3; i++) g.strokeEllipse(w / 2, h / 2, 360 + i * 120, 620 + i * 120);
        break;
      case 'drum':
        for (let i = 0; i < 5; i++) drawWave(g, 0, w, h * 0.25 + i * 100, 10 + i * 2, 120 + i * 20, p.bgNear, 3, 0.4, i);
        for (let i = 0; i < 6; i++) { g.fillStyle(p.accent, 0.18); g.fillCircle((i * 101 + 30) % w, (i * 157 + 50) % h, 10 + (i % 3) * 6); }
        break;
      case 'bones':
        for (let i = 0; i < 6; i++) { g.fillStyle(p.bgNear, 0.5); g.fillRoundedRect((i * 97 + 10) % w, (i * 131 + 30) % h, 18, 70 + (i % 3) * 30, 9); }
        for (let i = 0; i < 9; i++) { g.fillStyle(p.bgNear, 0.35); g.fillCircle((i * 97) % w, (i * 173) % h, 8 + (i % 4) * 7); }
        break;
      case 'spiral':
        // tüylü (kıl) hücreleri: tonotopi renginde demetler + kabarcıklar
        for (let i = 0; i < 9; i++) { const x = (i * 59 + 15) % w; drawTuft(g, x, h - 10 - (i % 3) * 25, 40 + (i % 3) * 16, tonotopyColor(tono[0] + (tono[1] - tono[0]) * ((i * 0.37) % 1)), 0.7, 4 + (i % 2)); }
        for (let i = 0; i < 7; i++) { g.lineStyle(2, p.accent, 0.35); g.strokeCircle((i * 83 + 20) % w, (i * 141 + 40) % (h * 0.7), 8 + (i % 4) * 6); g.fillStyle(0xffffff, 0.25); g.fillCircle((i * 83 + 16) % w, (i * 141 + 36) % (h * 0.7), 3); }
        drawWave(g, 0, w, h * 0.3, 14, 140, p.accent, 2, 0.25);
        break;
      case 'nerve':
        for (let i = 0; i < 7; i++) { g.lineStyle(2, p.accent, 0.45); g.beginPath(); g.moveTo((i * 79) % w, 0); g.lineTo((i * 79 + 30) % w, h * 0.4); g.lineTo((i * 79 - 10 + w) % w, h); g.strokePath(); }
        for (let i = 0; i < 8; i++) { g.fillStyle(p.accent, 0.6); g.fillCircle((i * 67 + 25) % w, (i * 113 + 30) % h, 3); }
        break;
      case 'stem':
        for (let i = 0; i < 8; i++) { const x = (i * 67 + 20) % w, y = (i * 151 + 40) % h; g.lineStyle(2, p.bgNear, 0.6); for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + (k - 1) * 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 36, y + Math.sin(a) * 36); g.strokePath(); } g.fillStyle(p.accent, 0.5); g.fillCircle(x, y, 4); }
        break;
      case 'cortex': {
        // nöron ağı: düğümler + bağlantılar + dendritler
        const nodes = Array.from({ length: 10 }, (_, i) => ({ x: (i * 97 + 30) % w, y: (i * 151 + 40) % h }));
        g.lineStyle(2, p.bgNear, 0.6);
        for (let i = 0; i < nodes.length; i++) { const a = nodes[i]!, b = nodes[(i + 3) % nodes.length]!; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo((a.x + b.x) / 2 + 20, (a.y + b.y) / 2 - 15); g.lineTo(b.x, b.y); g.strokePath(); }
        for (const n of nodes) { g.fillStyle(p.accent, 0.25); g.fillCircle(n.x, n.y, 12); g.fillStyle(p.accent, 0.7); g.fillCircle(n.x, n.y, 5); g.lineStyle(1.5, p.accent, 0.4); for (let k = 0; k < 4; k++) { const a = k * 1.57 + 0.4; g.beginPath(); g.moveTo(n.x, n.y); g.lineTo(n.x + Math.cos(a) * 18, n.y + Math.sin(a) * 18); g.strokePath(); } }
        break;
      }
    }
  };
  mk(`bg-far-${biome.id}`, far, 640, H, 0.12, -30);
  mk(`bg-mid-${biome.id}`, mid, 520, H, 0.35, -20);
  void worldW;
  return {
    update(scrollX: number) { for (const l of layers) l.tilePositionX = scrollX * (l as unknown as { __factor: number }).__factor; },
  };
}
