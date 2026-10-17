import Phaser from 'phaser';

/** Emoji'yi doku olarak üretir; sprite ve parçacıklar için. */
export function emojiTexture(scene: Phaser.Scene, key: string, emoji: string, size = 64): string {
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const c = canvas.getContext('2d')!;
  c.font = `${Math.floor(size * 0.8)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(emoji, size / 2, size / 2 + size * 0.04);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** Sevimli yuvarlak kahraman: gövde + gözler + gülümseme. Oyunlar arası tutarlı. */
export function heroTexture(scene: Phaser.Scene, key: string, color = 0x6c4cf1, size = 56, mood: 'happy' | 'hurt' | 'wow' = 'happy'): string {
  const k = `${key}-${mood}`;
  if (scene.textures.exists(k)) return k;
  const g = scene.add.graphics({ x: 0, y: 0 });
  const r = size / 2;
  g.fillStyle(color, 1); g.fillCircle(r, r, r - 2);
  g.fillStyle(0xffffff, 0.22); g.fillCircle(r - r * 0.3, r - r * 0.35, r * 0.35);
  // gözler
  g.fillStyle(0xffffff, 1); g.fillCircle(r - r * 0.32, r - r * 0.1, r * 0.22); g.fillCircle(r + r * 0.32, r - r * 0.1, r * 0.22);
  g.fillStyle(0x13162a, 1);
  if (mood === 'hurt') { g.fillRect(r - r * 0.45, r - r * 0.14, r * 0.26, r * 0.08); g.fillRect(r + r * 0.19, r - r * 0.14, r * 0.26, r * 0.08); }
  else { g.fillCircle(r - r * 0.28, r - r * 0.08, r * 0.1); g.fillCircle(r + r * 0.36, r - r * 0.08, r * 0.1); }
  // ağız
  g.lineStyle(Math.max(2, size * 0.05), 0x13162a, 1);
  if (mood === 'wow') { g.strokeCircle(r, r + r * 0.35, r * 0.14); }
  else if (mood === 'hurt') { g.beginPath(); g.arc(r, r + r * 0.5, r * 0.22, Math.PI * 1.15, Math.PI * 1.85); g.strokePath(); }
  else { g.beginPath(); g.arc(r, r + r * 0.22, r * 0.26, Math.PI * 0.15, Math.PI * 0.85); g.strokePath(); }
  g.generateTexture(k, size, size); g.destroy();
  return k;
}

/** Yumuşak yuvarlak dikdörtgen doku (platform, buton). */
export function roundRectTexture(scene: Phaser.Scene, key: string, w: number, h: number, color: number, radius = 12, alpha = 1): string {
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics(); g.fillStyle(color, alpha); g.fillRoundedRect(0, 0, w, h, radius); g.generateTexture(key, w, h); g.destroy();
  return key;
}

/** Tonotopi rengi: 0 (taban, ince ses, mor) → 1 (apeks, kalın ses, turuncu). */
export function tonotopyColor(t: number): number {
  const a = Phaser.Display.Color.ValueToColor(0x6c4cf1);
  const b = Phaser.Display.Color.ValueToColor(0xf59e0b);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, Math.round(Math.max(0, Math.min(1, t)) * 100));
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}
/** Tonotopi frekansı: taban 8000 Hz → apeks 125 Hz (logaritmik). */
export function tonotopyFreq(t: number): number { return 8000 * Math.pow(125 / 8000, Math.max(0, Math.min(1, t))); }
