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

// ---------------------------------------------------------------- kozmetik: şapkalar
/**
 * Şapka dokusu: 64×64 tuval, merkezi kahramanın merkezine hizalanır (kahraman 48 px, yarıçap ~22; başın tepesi y≈10).
 * Arayüzdeki SVG avatar (apps/web OdiAvatar) aynı koordinatları kullanır.
 */
export function hatTexture(scene: Phaser.Scene, hat: string): string | null {
  const key = `hat-${hat}`; if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics({ x: 0, y: 0 });
  const star = (cx: number, cy: number, r: number, color: number) => { const pts: Phaser.Types.Math.Vector2Like[] = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.45 : r; pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr }); } g.fillStyle(color, 1); g.fillPoints(pts, true); };
  const spiral = (cx: number, cy: number, r: number, color: number, w: number) => { g.lineStyle(w, color, 1); g.beginPath(); for (let i = 0; i <= 60; i++) { const t = i / 60; const a = t * Math.PI * 5; const rr = r * (1 - t * 0.85); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.strokePath(); };
  switch (hat) {
    case 'bere': g.fillStyle(0xf0567a, 1); g.fillEllipse(32, 15, 40, 20); g.fillRect(12, 13, 40, 4); g.fillStyle(0xffffff, 0.9); g.fillRect(12, 14, 40, 5); g.fillStyle(0xf0567a, 1); for (let x = 14; x < 52; x += 6) g.fillRect(x, 15, 3, 3); g.fillStyle(0xffffff, 1); g.fillCircle(32, 4, 4.5); break;
    case 'kulaklik': g.lineStyle(4, 0x13162a, 1); g.beginPath(); g.arc(32, 32, 26, Math.PI * 1.12, Math.PI * 1.88); g.strokePath(); g.fillStyle(0xf0567a, 1); g.fillRoundedRect(3, 24, 10, 18, 4); g.fillRoundedRect(51, 24, 10, 18, 4); g.fillStyle(0x13162a, 1); g.fillRect(11, 27, 3, 12); g.fillRect(50, 27, 3, 12); break;
    case 'nota': g.lineStyle(2.5, 0x13162a, 1); g.lineBetween(32, 11, 34, 1); g.fillStyle(0x13162a, 1); g.fillEllipse(31, 4, 8, 6); g.lineBetween(35, 4, 35, -1); g.fillStyle(0xffc25c, 1); g.fillCircle(31, 4, 1.6); break;
    case 'dalgic': g.lineStyle(3, 0x13162a, 1); g.lineBetween(8, 29, 56, 29); g.fillStyle(0x8fe3ff, 0.55); g.fillCircle(24, 29.5, 8); g.fillCircle(40, 29.5, 8); g.lineStyle(2.5, 0x0e9c98, 1); g.strokeCircle(24, 29.5, 8); g.strokeCircle(40, 29.5, 8); g.fillStyle(0xffffff, 0.8); g.fillCircle(21, 26, 2); g.fillCircle(37, 26, 2); break;
    case 'tac': g.fillStyle(0xf5b700, 1); g.fillPoints([{ x: 18, y: 14 }, { x: 18, y: 3 }, { x: 24, y: 9 }, { x: 32, y: 0 }, { x: 40, y: 9 }, { x: 46, y: 3 }, { x: 46, y: 14 }], true); g.fillStyle(0xf0567a, 1); g.fillCircle(32, 9, 2.5); g.fillStyle(0x6c4cf1, 1); g.fillCircle(24, 12, 1.8); g.fillCircle(40, 12, 1.8); break;
    case 'parti': g.fillStyle(0x0e9c98, 1); g.fillTriangle(22, 13, 42, 13, 33, -6 + 6); g.fillStyle(0xffc25c, 1); g.fillTriangle(26, 9, 38, 9, 37, 13); g.fillTriangle(29, 5, 36, 5, 35, 8); g.fillStyle(0xf0567a, 1); g.fillCircle(33, 1, 3.5); break;
    case 'kasif': g.fillStyle(0xb88a4a, 1); g.fillEllipse(32, 14, 50, 9); g.fillStyle(0xc9a063, 1); g.fillEllipse(32, 9, 28, 14); g.fillRect(18, 9, 28, 5); g.fillStyle(0x6b4a24, 1); g.fillRect(18, 10, 28, 3); break;
    case 'koklea': g.fillStyle(0xffe1ea, 1); g.fillCircle(46, 12, 8); spiral(46, 12, 7, 0xf0567a, 2); break;
    case 'yildiz': g.lineStyle(3, 0xf5b700, 1); g.beginPath(); g.arc(32, 32, 23, Math.PI * 1.2, Math.PI * 1.8); g.strokePath(); star(32, 7, 8, 0xf5b700); g.fillStyle(0xffffff, 0.9); g.fillCircle(30, 5, 1.6); break;
    case 'altin': g.fillStyle(0xfff3c4, 1); g.fillCircle(32, 7, 8); spiral(32, 7, 7.5, 0xd9a400, 2.4); g.fillStyle(0xffffff, 1); g.fillCircle(42, 2, 1.8); g.fillCircle(21, 4, 1.4); break;
    default: g.destroy(); return null;
  }
  g.generateTexture(key, 64, 64); g.destroy();
  return key;
}

/** Şanslı Nota: yeşil hâleli altın nota. */
export function luckyNoteTexture(scene: Phaser.Scene): string {
  const key = 'lucky-note'; if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics();
  g.fillStyle(0x2fbf71, 0.22); g.fillCircle(24, 24, 23); g.fillStyle(0x2fbf71, 0.35); g.fillCircle(24, 24, 16);
  g.fillStyle(0xf5b700, 1); g.fillEllipse(19, 32, 14, 10); g.fillRect(24, 10, 4, 22); g.fillTriangle(28, 10, 36, 16, 28, 19);
  g.fillStyle(0xffffff, 0.8); g.fillCircle(16, 30, 2.4);
  g.generateTexture(key, 48, 48); g.destroy();
  return key;
}
