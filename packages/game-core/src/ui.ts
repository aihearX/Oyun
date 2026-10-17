import Phaser from 'phaser';

export const FONT = '"SF Pro Rounded","Segoe UI Rounded","Nunito","Helvetica Neue",Arial,sans-serif';
export const COLORS = { text: '#13162a', muted: '#5d6378', accent: '#6c4cf1', accent2: '#0e9c98', coral: '#f0567a', amber: '#d98b00', white: '#ffffff', bg: 0xffffff, bg2: 0xf7f8fb };

export function title(scene: Phaser.Scene, x: number, y: number, text: string, size = 44, color = COLORS.text) {
  return scene.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: '800', color }).setOrigin(0.5);
}
export function label(scene: Phaser.Scene, x: number, y: number, text: string, size = 18, color = COLORS.muted) {
  return scene.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: '600', color, align: 'center', wordWrap: { width: scene.scale.width - 48 } }).setOrigin(0.5);
}
export function pill(scene: Phaser.Scene, x: number, y: number, text: string, bg = 0x6c4cf1, fg = '#ffffff', w = 220, h = 56) {
  const c = scene.add.container(x, y);
  const r = scene.add.graphics(); r.fillStyle(bg, 1); r.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  const t = scene.add.text(0, 0, text, { fontFamily: FONT, fontSize: '20px', fontStyle: '700', color: fg }).setOrigin(0.5);
  c.add([r, t]); c.setSize(w, h); c.setInteractive({ useHandCursor: true });
  return c;
}

/** Üst HUD: skor, can, seviye. Kamera sabit. */
export class Hud {
  score: Phaser.GameObjects.Text; lives: Phaser.GameObjects.Text; level: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene) {
    const w = scene.scale.width;
    const bg = scene.add.rectangle(w / 2, 36, w, 72, 0xffffff, 0.85).setScrollFactor(0).setDepth(100);
    bg.setStrokeStyle(1, 0xe6e8f0);
    this.score = scene.add.text(16, 24, '0', { fontFamily: FONT, fontSize: '26px', fontStyle: '800', color: COLORS.text }).setScrollFactor(0).setDepth(101);
    this.level = scene.add.text(w / 2, 36, '', { fontFamily: FONT, fontSize: '14px', fontStyle: '700', color: COLORS.muted }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    this.lives = scene.add.text(w - 16, 36, '', { fontFamily: FONT, fontSize: '22px' }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(101);
  }
  set(score: number, lives: number, level?: string) {
    this.score.setText(score.toLocaleString('tr-TR'));
    this.lives.setText('❤️'.repeat(Math.max(0, lives)) + '🤍'.repeat(Math.max(0, 3 - lives)));
    if (level != null) this.level.setText(level);
  }
}

/** Kısa tam ekran flaş (vuruş/ödül). */
export function flash(scene: Phaser.Scene, color = 0xff5c5c, alpha = 0.35, ms = 180) {
  const r = scene.add.rectangle(scene.scale.width / 2, scene.scale.height / 2, scene.scale.width, scene.scale.height, color, alpha).setScrollFactor(0).setDepth(200);
  scene.tweens.add({ targets: r, alpha: 0, duration: ms, onComplete: () => r.destroy() });
}

/** Uçan "+120" yazısı. */
export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color = COLORS.accent2) {
  const t = scene.add.text(x, y, text, { fontFamily: FONT, fontSize: '22px', fontStyle: '800', color }).setOrigin(0.5).setDepth(150);
  scene.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 700, ease: 'Cubic.Out', onComplete: () => t.destroy() });
}

/** Dokunuşta başlat kapısı: ses kilidini açar. */
export function tapToStart(scene: Phaser.Scene, text: string, onStart: () => void) {
  const w = scene.scale.width, h = scene.scale.height;
  const veil = scene.add.rectangle(w / 2, h / 2, w, h, 0xffffff, 0.75).setDepth(300).setInteractive();
  const t = label(scene, w / 2, h / 2, text, 22, COLORS.text).setDepth(301);
  scene.tweens.add({ targets: t, alpha: 0.4, yoyo: true, repeat: -1, duration: 600 });
  veil.once('pointerdown', () => { veil.destroy(); t.destroy(); onStart(); });
}
