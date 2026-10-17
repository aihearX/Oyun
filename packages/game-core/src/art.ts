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

// ---------------------------------------------------------------- biyom sanatı yardımcıları (paralaks + zemin dokuları)

/** Rengi aydınlat (amt>0) ya da karart (amt<0); amt −1..1. */
export function shade(color: number, amt: number): number {
  const c = Phaser.Display.Color.ValueToColor(color);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
}

/** Tüy / kıl silueti: kıvrık sap + iki yana açılan teller. */
export function drawFeather(g: Phaser.GameObjects.Graphics, x: number, y: number, len: number, angle: number, color: number, alpha = 1, barbs = 9) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const px = -sa, py = ca; // sapa dik
  g.lineStyle(Math.max(2, len * 0.04), color, alpha);
  g.beginPath(); g.moveTo(x, y);
  g.lineTo(x + ca * len * 0.5 + px * len * 0.06, y + sa * len * 0.5 + py * len * 0.06);
  g.lineTo(x + ca * len, y + sa * len); g.strokePath();
  g.lineStyle(Math.max(1, len * 0.02), color, alpha * 0.8);
  for (let i = 1; i <= barbs; i++) {
    const t = i / (barbs + 1); const bx = x + ca * len * t + px * len * 0.06 * Math.sin(t * Math.PI); const by = y + sa * len * t + py * len * 0.06 * Math.sin(t * Math.PI);
    const bl = len * 0.22 * Math.sin(t * Math.PI) + len * 0.05;
    for (const s of [1, -1]) { g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + ca * bl * 0.6 + px * bl * s, by + sa * bl * 0.6 + py * bl * s); g.strokePath(); }
  }
}

/** Serumen damlası: gözyaşı şekli + parlaklık. */
export function drawDrop(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillCircle(x, y, r);
  g.fillTriangle(x - r * 0.95, y - r * 0.3, x + r * 0.95, y - r * 0.3, x, y - r * 2.1);
  g.fillStyle(0xffffff, alpha * 0.35); g.fillCircle(x - r * 0.35, y - r * 0.25, r * 0.3);
}

/** Kıl hücresi demeti (stereosilya): tabandan yükselen 3-5 tel, uçları yuvarlak. */
export function drawTuft(g: Phaser.GameObjects.Graphics, x: number, y: number, h: number, color: number, alpha = 1, n = 5) {
  for (let i = 0; i < n; i++) {
    const t = (i - (n - 1) / 2) / Math.max(1, n - 1);
    const hh = h * (1 - Math.abs(t) * 0.45); const tipX = x + t * h * 0.5, tipY = y - hh;
    g.lineStyle(Math.max(2, h * 0.08), color, alpha); g.beginPath(); g.moveTo(x + t * h * 0.18, y); g.lineTo(tipX, tipY); g.strokePath();
    g.fillStyle(color, alpha); g.fillCircle(tipX, tipY, Math.max(2, h * 0.07));
  }
}

/** Sinüs dalgası çizgisi. */
export function drawWave(g: Phaser.GameObjects.Graphics, x0: number, x1: number, y: number, amp: number, period: number, color: number, width: number, alpha = 1, phase = 0) {
  g.lineStyle(width, color, alpha); g.beginPath();
  for (let x = x0; x <= x1; x += 6) { const yy = y + Math.sin((x / period) * Math.PI * 2 + phase) * amp; if (x === x0) g.moveTo(x, yy); else g.lineTo(x, yy); }
  g.strokePath();
}

/** Deterministik küçük rastgele sayı üreteci (dokular her açılışta aynı olsun). */
export function seeded(seed: number): () => number { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
