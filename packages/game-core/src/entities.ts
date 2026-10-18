/** Biyoma özgü varlık dokuları (bir kez üretilir, `textures.exists`). Çizim seam'i: play/visuals.ts bunları kullanır. */
import Phaser from 'phaser';
import { drawDrop, drawFeather, drawTuft, drawWave, shade, tonotopyColor } from './art';
import type { BiomeDef } from '@odi/content';

// ---------------------------------------------------------------- biyoma özgü dokular (bir kez üretilir)

/** Zemin/platform dokusu: biyom paleti + motif ayrıntısı (kanal: yapışkan damlalar, koklea: dalgalı üst, auricle: ten gözenekleri…). */
export function platformTexture(s: Phaser.Scene, biome: BiomeDef, w: number, h: number): string {
  const key = `plat-${biome.id}-${w}x${h}`;
  if (s.textures.exists(key)) return key;
  const p = biome.palette; const g = s.add.graphics(); const r = Math.min(10, h / 2); const thick = h > 40;
  g.fillStyle(p.ground, 1); g.fillRoundedRect(0, 0, w, h, r);
  switch (biome.motif) {
    case 'auricle':
      // ten: gözenekler + hafif kıl telleri
      g.fillStyle(shade(p.ground, -0.12), 0.6); for (let x = 14; x < w - 8; x += 29) g.fillCircle(x, 11 + (x % 3) * 3, 2);
      if (thick) { g.fillStyle(shade(p.ground, -0.08), 0.5); for (let x = 20; x < w - 10; x += 47) g.fillEllipse(x, 40 + (x % 5) * 12, 18, 10); }
      break;
    case 'tunnel':
      // serumen: sarımsı yapışkan akıntı ve damlalar
      g.fillStyle(p.accent, 0.35); g.fillRoundedRect(4, 2, w - 8, Math.min(h - 4, 10), 5);
      for (let x = 18; x < w - 10; x += 38) { g.fillStyle(p.accent, 0.55); g.fillRoundedRect(x - 5, 4, 10, 10 + (x % 4) * 6, 5); drawDrop(g, x, 14 + (x % 4) * 6 + 6, 5, p.accent, 0.6); }
      if (thick) { g.fillStyle(shade(p.ground, -0.18), 0.5); for (let x = 30; x < w - 10; x += 61) g.fillEllipse(x, 60 + (x % 7) * 9, 26, 12); }
      break;
    case 'drum':
      g.lineStyle(2, shade(p.ground, -0.15), 0.5); for (let yy = 8; yy < h - 4; yy += 14) { g.beginPath(); g.moveTo(6, yy); g.lineTo(w - 6, yy); g.strokePath(); }
      break;
    case 'bones':
      g.lineStyle(2, shade(p.ground, -0.2), 0.5); for (let x = 16; x < w - 10; x += 44) { g.beginPath(); g.moveTo(x, 4); g.lineTo(x + 8, Math.min(h - 4, 18)); g.lineTo(x + 3, Math.min(h - 2, 30)); g.strokePath(); }
      break;
    case 'spiral': {
      // koklea: dalgalı üst çizgi + kıl hücresi demetleri (tonotopi rengi)
      const t = biome.tonotopy ?? [0.3, 0.6];
      drawWave(g, 2, w - 2, 6, 2.5, 48, shade(p.ground, 0.35), 3, 0.9);
      if (thick) { for (let x = 24; x < w - 12; x += 52) drawTuft(g, x, 22 + (x % 3) * 2, 12 + (x % 2) * 4, tonotopyColor(t[0] + (t[1] - t[0]) * ((x / w) % 1)), 0.55, 3); drawWave(g, 2, w - 2, 44, 3, 60, shade(p.ground, -0.15), 2, 0.5, 1); }
      break;
    }
    case 'nerve':
      g.lineStyle(2, p.accent, 0.6); g.beginPath(); g.moveTo(4, 5); g.lineTo(w - 4, 5); g.strokePath();
      g.fillStyle(p.accent, 0.5); for (let x = 20; x < w - 10; x += 60) g.fillCircle(x, 5, 3);
      break;
    case 'stem':
      g.lineStyle(2, shade(p.ground, 0.25), 0.5); for (let x = 10; x < w - 10; x += 34) { g.beginPath(); g.moveTo(x, h - 4); g.lineTo(x + 12, 4); g.strokePath(); }
      break;
    case 'cortex':
      g.fillStyle(shade(p.ground, 0.3), 0.6); for (let x = 12; x < w - 8; x += 26) g.fillCircle(x, 10 + (x % 2) * 4, 3 + (x % 3));
      break;
  }
  g.fillStyle(0xffffff, 0.18); g.fillRect(6, 3, w - 12, 4);
  g.fillStyle(p.groundDark, 1); if (thick) g.fillRect(0, h - 10, w, 10);
  g.generateTexture(key, w, h); g.destroy();
  return key;
}

/** Hareketli platform: kanalda serumen damlası, diğer biyomlarda koyu zemin rengi. */
export function moverTexture(s: Phaser.Scene, biome: BiomeDef, w: number, h: number): string {
  const key = `mover-${biome.id}-${w}x${h}`;
  if (s.textures.exists(key)) return key;
  const p = biome.palette; const g = s.add.graphics();
  g.fillStyle(biome.motif === 'tunnel' ? shade(p.accent, -0.15) : p.groundDark, 1); g.fillRoundedRect(0, 0, w, h, 10);
  g.fillStyle(0xffffff, 0.25); g.fillRoundedRect(6, 3, w - 12, 5, 2);
  if (biome.motif === 'tunnel') { g.fillStyle(p.accent, 0.9); for (let x = 12; x < w - 6; x += 24) g.fillCircle(x, h - 4, 4); }
  else { g.lineStyle(2, 0xffffff, 0.35); for (let x = 10; x < w - 6; x += 20) { g.beginPath(); g.moveTo(x, h - 6); g.lineTo(x + 8, 6); g.strokePath(); } }
  g.generateTexture(key, w, h); g.destroy();
  return key;
}

/** Diken: biyom vurgu rengi + koyu kenar + parlak uç (tehlike okunaklı kalır). */
export function spikeTexture(s: Phaser.Scene, biome: BiomeDef, w: number): string {
  const key = `spike-${biome.id}-${w}`;
  if (s.textures.exists(key)) return key;
  const p = biome.palette; const g = s.add.graphics();
  const base = biome.motif === 'tunnel' ? 0xff8a3d : biome.motif === 'auricle' ? 0xe5484d : shade(p.accent, -0.1);
  for (let i = 0; i < w / 16; i++) {
    g.fillStyle(shade(base, -0.35), 1); g.fillTriangle(i * 16, 28, i * 16 + 8, 0, i * 16 + 16, 28);
    g.fillStyle(base, 1); g.fillTriangle(i * 16 + 2, 28, i * 16 + 8, 4, i * 16 + 14, 28);
    g.fillStyle(0xffffff, 0.45); g.fillTriangle(i * 16 + 5, 14, i * 16 + 8, 5, i * 16 + 8, 16);
  }
  g.generateTexture(key, w, 28); g.destroy();
  return key;
}

/** Ölümcül alan: gürültü bulutu (gri), serumen (yapışkan amber), tüy (kıl ormanı), dalga (ses). */
export function hazardTexture(s: Phaser.Scene, biome: BiomeDef, w: number, h: number, kind: string): string {
  const key = `haz-${biome.id}-${kind}-${w}x${h}`;
  if (s.textures.exists(key)) return key;
  const p = biome.palette; const g = s.add.graphics();
  switch (kind) {
    case 'serumen': {
      const c = biome.motif === 'tunnel' ? p.accent : 0xffb347;
      g.fillStyle(shade(c, -0.1), 0.95); g.fillRoundedRect(0, 0, w, h, h / 2.5);
      g.fillStyle(shade(c, 0.3), 0.8); g.fillEllipse(w * 0.35, h * 0.35, w * 0.4, h * 0.3);
      for (let i = 0; i < Math.max(2, Math.floor(w / 28)); i++) drawDrop(g, 12 + i * 28, h - 10, 6, shade(c, -0.25), 0.9);
      g.lineStyle(3, shade(c, -0.45), 0.9); g.strokeRoundedRect(1.5, 1.5, w - 3, h - 3, h / 2.5);
      break;
    }
    case 'tuy': {
      g.fillStyle(p.accent, 0.22); g.fillRoundedRect(0, 0, w, h, h / 3);
      for (let i = 0; i < Math.max(2, Math.floor(w / 36)); i++) drawFeather(g, 14 + i * 36, 6, h - 12, Math.PI / 2 + ((i % 2) - 0.5) * 0.3, shade(p.accent, -0.2), 0.95, 7);
      break;
    }
    case 'dalga': {
      g.fillStyle(p.accent, 0.2); g.fillRoundedRect(0, 0, w, h, h / 3);
      for (let i = 0; i < 3; i++) drawWave(g, 6, w - 6, h * 0.3 + i * (h * 0.2), 6, 36, shade(p.accent, -0.2), 3, 0.9, i);
      g.lineStyle(2, shade(p.accent, -0.3), 0.8); g.strokeRoundedRect(1, 1, w - 2, h - 2, h / 3);
      break;
    }
    default: {
      g.fillStyle(0x6b7280, 0.85); g.fillRoundedRect(0, 0, w, h, h / 2.5);
      g.fillStyle(0x8b93a3, 0.6); g.fillCircle(w * 0.3, h * 0.4, h * 0.3); g.fillCircle(w * 0.65, h * 0.35, h * 0.26);
      g.lineStyle(3, 0xffffff, 0.6); for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(10 + i * (w / 3), h * 0.7); g.lineTo(18 + i * (w / 3), h * 0.5); g.lineTo(26 + i * (w / 3), h * 0.7); g.strokePath(); }
    }
  }
  g.generateTexture(key, w, h); g.destroy();
  return key;
}

/** Süs dokusu: tuy (tüy/kıl), ot (küçük tutam), damla (serumen damlası), hucre (kıl hücresi demeti). Bilinmeyen tür → null. */
export function decorTexture(s: Phaser.Scene, biome: BiomeDef, kind: string): string | null {
  const key = `decor-${biome.id}-${kind}`;
  if (s.textures.exists(key)) return key;
  const p = biome.palette; const g = s.add.graphics(); let w: number, h: number;
  switch (kind) {
    case 'tuy':
      w = 80; h = 120; drawFeather(g, 30, 118, 110, -Math.PI / 2 + 0.15, shade(p.accent, 0.1), 0.95, 10); drawFeather(g, 52, 118, 80, -Math.PI / 2 - 0.25, p.groundDark, 0.8, 8); break;
    case 'ot':
      w = 48; h = 40; for (let i = 0; i < 5; i++) { g.lineStyle(3, shade(p.groundDark, 0.15), 0.9); g.beginPath(); g.moveTo(24, 40); g.lineTo(8 + i * 8, 6 + Math.abs(i - 2) * 8); g.strokePath(); } break;
    case 'damla':
      w = 56; h = 72; g.fillStyle(p.accent, 0.9); g.fillEllipse(28, 62, 48, 18); drawDrop(g, 28, 40, 14, p.accent, 0.95); drawDrop(g, 46, 56, 6, shade(p.accent, 0.2), 0.9); break;
    case 'hucre': {
      w = 72; h = 80; const t = biome.tonotopy ?? [0.4, 0.6];
      drawTuft(g, 24, 78, 60, tonotopyColor(t[0]), 0.95, 5); drawTuft(g, 52, 78, 44, tonotopyColor(t[1]), 0.9, 4); break;
    }
    default: g.destroy(); return null;
  }
  g.generateTexture(key, w, h); g.destroy();
  return key;
}

export function coinTexture(s: Phaser.Scene, accent: number): string {
  const key = `coin-${accent}`;
  if (!s.textures.exists(key)) { const g = s.add.graphics(); g.fillStyle(0xffc25c, 1); g.fillCircle(16, 16, 15); g.fillStyle(0xffe6a8, 1); g.fillCircle(13, 13, 8); g.lineStyle(2, 0xd98b00, 1); g.strokeCircle(16, 16, 15); g.generateTexture(key, 32, 32); g.destroy(); void accent; }
  return key;
}
export function springTexture(s: Phaser.Scene, accent: number): string {
  const key = `spring-${accent}`;
  if (!s.textures.exists(key)) { const g = s.add.graphics(); g.lineStyle(4, accent, 1); for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(6, 34 - i * 6); g.lineTo(34, 31 - i * 6); g.strokePath(); } g.fillStyle(accent, 1); g.fillCircle(20, 6, 6); g.generateTexture(key, 40, 36); g.destroy(); }
  return key;
}
export function gateTexture(s: Phaser.Scene, accent: number): string {
  const key = `gate-${accent}`;
  if (!s.textures.exists(key)) { const g = s.add.graphics(); g.fillStyle(accent, 0.25); g.fillRoundedRect(0, 0, 90, 150, 40); g.lineStyle(6, accent, 1); g.strokeRoundedRect(3, 3, 84, 144, 38); g.fillStyle(0xffffff, 0.9); g.fillCircle(45, 60, 14); g.generateTexture(key, 90, 150); g.destroy(); }
  return key;
}
export function gearTexture(s: Phaser.Scene, r: number, color: number): string {
  const key = `gear-${r}-${color}`;
  if (!s.textures.exists(key)) { const g = s.add.graphics(); g.fillStyle(color, 1); g.fillCircle(r, r, r * 0.8); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.fillRoundedRect(r + Math.cos(a) * r * 0.78 - 6, r + Math.sin(a) * r * 0.78 - 6, 12, 12, 3); } g.fillStyle(0xffffff, 0.3); g.fillCircle(r, r, r * 0.3); g.generateTexture(key, r * 2, r * 2); g.destroy(); }
  return key;
}
export function bubbleTexture(s: Phaser.Scene): string {
  const key = 'bubble';
  if (!s.textures.exists(key)) { const g = s.add.graphics(); g.lineStyle(3, 0x2ee6d6, 1); g.strokeCircle(14, 14, 12); g.fillStyle(0xffffff, 0.5); g.fillCircle(10, 10, 4); g.generateTexture(key, 28, 28); g.destroy(); }
  return key;
}
