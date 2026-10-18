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

// ---------------------------------------------------------------- ödül anı / juice (yalnızca görsel)

/** Ekranın ortasında büyüyüp sönen kutlama kelimesi ("Mükemmel!"). Aynı anda tek tane. */
export function cheer(scene: Phaser.Scene, text: string, color = COLORS.accent, size = 34) {
  const prev = scene.data?.get('cheer') as Phaser.GameObjects.Text | undefined; if (prev?.active) prev.destroy();
  const t = scene.add.text(scene.scale.width / 2, 190, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: '800', color, stroke: '#ffffff', strokeThickness: 6, align: 'center' })
    .setOrigin(0.5).setScrollFactor(0).setDepth(155).setScale(0.4).setAlpha(0);
  scene.data?.set('cheer', t);
  scene.tweens.add({ targets: t, scale: 1.08, alpha: 1, duration: 160, ease: 'Back.Out', onComplete: () => {
    scene.tweens.add({ targets: t, scale: 1, duration: 120 });
    scene.tweens.add({ targets: t, y: 160, alpha: 0, delay: 520, duration: 380, ease: 'Cubic.In', onComplete: () => t.destroy() });
  } });
  return t;
}

/** Üstten kayan küçük şerit: "İlk ezme! 🎉", "Şanslı Nota bu bölümde!" */
export function banner(scene: Phaser.Scene, text: string, bg = 0x6c4cf1, ms = 1800) {
  const w = scene.scale.width; const t = scene.add.text(0, 0, text, { fontFamily: FONT, fontSize: '15px', fontStyle: '800', color: '#ffffff' }).setOrigin(0.5);
  const bw = Math.min(w - 32, t.width + 32), bh = 34;
  const r = scene.add.graphics(); r.fillStyle(bg, 0.96); r.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
  const c = scene.add.container(w / 2, 96, [r, t]).setScrollFactor(0).setDepth(170).setAlpha(0);
  const y0 = 128;
  scene.tweens.add({ targets: c, y: y0, alpha: 1, duration: 220, ease: 'Back.Out' });
  scene.tweens.add({ targets: c, alpha: 0, y: y0 - 16, delay: ms, duration: 260, onComplete: () => c.destroy() });
  return c;
}

/** Jeton serisi göstergesi: seri büyüdükçe büyüyen, renk değiştiren rozet + kalan süre çizgisi. */
export class ComboMeter {
  private c: Phaser.GameObjects.Container; private bg: Phaser.GameObjects.Graphics; private t: Phaser.GameObjects.Text; private bar: Phaser.GameObjects.Rectangle; private shown = 0;
  constructor(private scene: Phaser.Scene) {
    const w = scene.scale.width;
    this.bg = scene.add.graphics(); this.t = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '18px', fontStyle: '800', color: '#ffffff' }).setOrigin(0.5);
    this.bar = scene.add.rectangle(0, 20, 60, 3, 0xffc25c, 1).setOrigin(0.5);
    this.c = scene.add.container(w - 58, 116, [this.bg, this.t, this.bar]).setScrollFactor(0).setDepth(103).setAlpha(0);
  }
  /** seri arttı */
  bump(combo: number) {
    if (combo < 2) return;
    this.shown = combo;
    const col = combo >= 20 ? 0xf0567a : combo >= 10 ? 0xd98b00 : 0x6c4cf1;
    this.t.setText(`Seri ×${combo}`).setFontSize(16 + Math.min(10, Math.floor(combo / 3)));
    const bw = this.t.width + 22, bh = this.t.height + 8;
    this.bg.clear(); this.bg.fillStyle(col, 0.95); this.bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
    this.bar.setPosition(0, bh / 2 + 4).setSize(bw - 12, 3); this.c.setX(this.scene.scale.width - 12 - bw / 2);
    this.scene.tweens.killTweensOf(this.c); this.c.setAlpha(1).setScale(1.35);
    this.scene.tweens.add({ targets: this.c, scale: 1, duration: 180, ease: 'Back.Out' });
  }
  /** her kare: serinin kalan süresi (0-1); 0 olunca söner */
  tick(remaining: number) {
    if (!this.shown) return;
    this.bar.scaleX = Math.max(0, remaining);
    if (remaining <= 0) { this.shown = 0; this.scene.tweens.add({ targets: this.c, alpha: 0, scale: 0.8, duration: 220 }); }
  }
}

/** Bölüm sonu kartı (oyun içinde, sonuç ekranından önce): okunur zemin, satırlar üst üste binmez. */
export function endCard(scene: Phaser.Scene, opts: { stars?: number; title: string; sub?: string; color?: string }) {
  const w = scene.scale.width, h = scene.scale.height; const cw = Math.min(300, w - 48);
  const items: Phaser.GameObjects.GameObject[] = [];
  let y = 0; const parts: { obj: Phaser.GameObjects.Text; h: number }[] = [];
  const starRow: Phaser.GameObjects.Text[] = [];
  if (opts.stars != null) {
    for (let i = 0; i < 3; i++) { const s = scene.add.text((i - 1) * 54, 0, i < opts.stars ? '⭐' : '☆', { fontFamily: FONT, fontSize: '40px', color: '#d0d4e2', padding: { x: 2, y: 6 } }).setOrigin(0.5); starRow.push(s); }
    y += 56;
  }
  const title = scene.add.text(0, 0, opts.title, { fontFamily: FONT, fontSize: '30px', fontStyle: '800', color: opts.color ?? COLORS.text, align: 'center', wordWrap: { width: cw - 32 }, padding: { x: 0, y: 4 } }).setOrigin(0.5, 0);
  parts.push({ obj: title, h: title.height });
  if (opts.sub) { const sub = scene.add.text(0, 0, opts.sub, { fontFamily: FONT, fontSize: '16px', fontStyle: '700', color: COLORS.muted, align: 'center', wordWrap: { width: cw - 32 }, lineSpacing: 4 }).setOrigin(0.5, 0); parts.push({ obj: sub, h: sub.height }); }
  const contentH = y + parts.reduce((a, p) => a + p.h, 0) + (parts.length - 1) * 6; const ch = contentH + 40;
  const bg = scene.add.graphics(); bg.fillStyle(0x13162a, 0.12); bg.fillRoundedRect(-cw / 2 + 2, -ch / 2 + 6, cw, ch, 24); bg.fillStyle(0xffffff, 0.96); bg.fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 24);
  items.push(bg);
  let cy = -ch / 2 + 20;
  if (starRow.length) { for (const s of starRow) { s.setY(cy + 26); items.push(s); } cy += 56; }
  for (const p of parts) { p.obj.setY(cy); items.push(p.obj); cy += p.h + 6; }
  const c = scene.add.container(w / 2, h / 2 - 40, items).setScrollFactor(0).setDepth(250).setScale(0.85).setAlpha(0);
  scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
  starRow.forEach((s, i) => { s.setScale(0); scene.tweens.add({ targets: s, scale: 1, delay: 120 + i * 140, duration: 260, ease: 'Back.Out' }); });
  return c;
}
