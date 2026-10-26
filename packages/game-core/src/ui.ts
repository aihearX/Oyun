import Phaser from 'phaser';

export const FONT = '"SF Pro Rounded","Segoe UI Rounded","Nunito","Helvetica Neue",Arial,sans-serif';
/** tasarım birimiyle görünüm boyutu (kamera cihaz piksel oranında yakınlaşmış olabilir) */
export const viewW = (s: Phaser.Scene) => s.cameras.main.width / s.cameras.main.zoom;
export const viewH = (s: Phaser.Scene) => s.cameras.main.height / s.cameras.main.zoom;
export const COLORS = { text: '#13162a', muted: '#5d6378', accent: '#6c4cf1', accent2: '#0e9c98', coral: '#f0567a', amber: '#d98b00', white: '#ffffff', bg: 0xffffff, bg2: 0xf7f8fb };

export function title(scene: Phaser.Scene, x: number, y: number, text: string, size = 44, color = COLORS.text) {
  return scene.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: '800', color }).setOrigin(0.5);
}
export function label(scene: Phaser.Scene, x: number, y: number, text: string, size = 18, color = COLORS.muted) {
  return scene.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: '600', color, align: 'center', wordWrap: { width: viewW(scene) - 48 } }).setOrigin(0.5);
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
    const w = viewW(scene);
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
  const r = scene.add.rectangle(viewW(scene) / 2, viewH(scene) / 2, viewW(scene), viewH(scene), color, alpha).setScrollFactor(0).setDepth(200);
  scene.tweens.add({ targets: r, alpha: 0, duration: ms, onComplete: () => r.destroy() });
}

/** oyun içi (koyu "Kulak Gecesi" sahnesi) için açık tonlar: açık tema renkleri koyu zeminde okunmaz */
const NIGHT: Record<string, string> = { [COLORS.accent]: '#c9b8ff', [COLORS.accent2]: '#2ee6d6', [COLORS.coral]: '#ff7aa2', [COLORS.amber]: '#ffc93c', [COLORS.muted]: '#e4dcff', [COLORS.text]: '#fff6e5', '#1b8f52': '#8ef0b0' };
const DPR = (s: Phaser.Scene) => Math.max(1, Math.min(3, s.cameras.main.zoom || 1));

/** Uçan "+120" yazısı. */
export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color = COLORS.accent2) {
  const t = scene.add.text(x, y, text, { fontFamily: FONT, fontSize: '21px', fontStyle: '900', color: NIGHT[color] ?? color, stroke: '#140c35', strokeThickness: 5, resolution: DPR(scene) }).setOrigin(0.5).setDepth(150);
  scene.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 700, ease: 'Cubic.Out', onComplete: () => t.destroy() });
}

/** koyu cam kart dokusu (Kulak Gecesi: mor cam, altın kenar) */
function nightCardTex(scene: Phaser.Scene, w: number, h: number, rim = '#ffc93c'): string {
  const r = DPR(scene); const key = `ui-night-${w}x${h}-${rim}@${r}`;
  if (scene.textures.exists(key)) return key;
  const pad = 14; const c = document.createElement('canvas'); c.width = (w + pad * 2) * r; c.height = (h + pad * 2) * r; const g = c.getContext('2d')!; g.scale(r, r);
  g.save(); g.shadowColor = 'rgba(5,0,25,0.65)'; g.shadowBlur = 18; g.shadowOffsetY = 6; g.beginPath(); g.roundRect(pad, pad, w, h, 26);
  const bg = g.createLinearGradient(0, pad, 0, pad + h); bg.addColorStop(0, 'rgba(58,39,136,0.97)'); bg.addColorStop(1, 'rgba(26,16,70,0.97)'); g.fillStyle = bg; g.fill(); g.restore();
  g.save(); g.beginPath(); g.roundRect(pad, pad, w, h, 26); g.clip(); const sh = g.createLinearGradient(0, pad, 0, pad + h * 0.5); sh.addColorStop(0, 'rgba(255,255,255,0.16)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(pad, pad, w, h * 0.5);
  const gl = g.createRadialGradient(pad + w / 2, pad, 4, pad + w / 2, pad, w * 0.6); gl.addColorStop(0, 'rgba(255,201,60,0.22)'); gl.addColorStop(1, 'rgba(255,201,60,0)'); g.fillStyle = gl; g.fillRect(pad, pad, w, h); g.restore();
  g.beginPath(); g.roundRect(pad + 1, pad + 1, w - 2, h - 2, 25); g.strokeStyle = rim; g.globalAlpha = 0.75; g.lineWidth = 2; g.stroke(); g.globalAlpha = 1;
  g.beginPath(); g.roundRect(pad + 4, pad + 4, w - 8, h - 8, 22); g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1; g.stroke();
  scene.textures.addCanvas(key, c); return key;
}
/** altın yıldız (dolu) ya da boş yuva */
function starTex(scene: Phaser.Scene, full: boolean): string {
  const r = DPR(scene); const key = `ui-star-${full ? 1 : 0}@${r}`; if (scene.textures.exists(key)) return key;
  const S = 48; const c = document.createElement('canvas'); c.width = S * r; c.height = S * r; const g = c.getContext('2d')!; g.scale(r, r);
  const path = () => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? 9.5 : 21; g.lineTo(24 + Math.cos(a) * rr, 25 + Math.sin(a) * rr); } g.closePath(); };
  if (full) {
    const gl = g.createRadialGradient(24, 25, 2, 24, 25, 24); gl.addColorStop(0, 'rgba(255,201,60,0.55)'); gl.addColorStop(1, 'rgba(255,201,60,0)'); g.fillStyle = gl; g.fillRect(0, 0, S, S);
    path(); const f = g.createLinearGradient(0, 5, 0, 45); f.addColorStop(0, '#fff6c4'); f.addColorStop(0.45, '#ffc93c'); f.addColorStop(1, '#ff9f1c'); g.fillStyle = f; g.fill(); g.lineJoin = 'round'; g.strokeStyle = '#8a4500'; g.lineWidth = 2; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(19, 17, 3.2, 1.8, -0.6, 0, Math.PI * 2); g.fill();
  } else { path(); g.fillStyle = 'rgba(20,10,60,0.7)'; g.fill(); g.lineJoin = 'round'; g.strokeStyle = 'rgba(201,193,255,0.55)'; g.lineWidth = 2; g.stroke(); }
  scene.textures.addCanvas(key, c); return key;
}

/** Dokunuşta başlat kapısı: ses kilidini açar. */
export function tapToStart(scene: Phaser.Scene, text: string, onStart: () => void) {
  const w = viewW(scene), h = viewH(scene); const r = DPR(scene);
  const veil = scene.add.rectangle(w / 2, h / 2, w, h, 0x140c35, 0.62).setDepth(300).setScrollFactor(0).setInteractive();
  const lines = text.split('\n').filter((l, i, a) => l || (i > 0 && a[i - 1])); const call = lines.pop() ?? '';
  const body = scene.add.text(0, 0, lines.join('\n').trim(), { fontFamily: FONT, fontSize: '21px', fontStyle: '900', color: '#fff6e5', align: 'center', lineSpacing: 6, wordWrap: { width: Math.min(300, w - 72) }, resolution: r }).setOrigin(0.5);
  const cw = Math.min(320, w - 40), ch = Math.round(body.height + 92);
  const bg = scene.add.image(0, 0, nightCardTex(scene, cw, ch)).setScale(1 / r);
  const cta = scene.add.text(0, ch / 2 - 30, call, { fontFamily: FONT, fontSize: '18px', fontStyle: '900', color: '#ffc93c', stroke: '#140c35', strokeThickness: 4, resolution: r }).setOrigin(0.5);
  body.setY(-24);
  const card = scene.add.container(w / 2, h / 2, [bg, body, cta]).setDepth(301).setScrollFactor(0);
  scene.tweens.add({ targets: cta, alpha: 0.45, scale: 0.96, yoyo: true, repeat: -1, duration: 600 });
  veil.once('pointerdown', () => { veil.destroy(); card.destroy(); onStart(); });
}

// ---------------------------------------------------------------- ödül anı / juice (yalnızca görsel)

/** Ekranın ortasında büyüyüp sönen kutlama kelimesi ("Mükemmel!"). Aynı anda tek tane. */
export function cheer(scene: Phaser.Scene, text: string, color = COLORS.accent, size = 34) {
  const prev = scene.data?.get('cheer') as Phaser.GameObjects.Text | undefined; if (prev?.active) prev.destroy();
  const t = scene.add.text(viewW(scene) / 2, 190, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: '800', color, stroke: '#ffffff', strokeThickness: 6, align: 'center' })
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
  const w = viewW(scene); const t = scene.add.text(0, 0, text, { fontFamily: FONT, fontSize: '15px', fontStyle: '800', color: '#ffffff' }).setOrigin(0.5);
  const bw = Math.min(w - 32, t.width + 32), bh = 34;
  const r = scene.add.graphics(); r.fillStyle(bg, 0.96); r.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
  // bölümde oyun içi gösterge güvenli alan kadar iner (LevelScene 'hudTop'); şerit onun altında kalsın
  const top = Number(scene.registry?.get('hudTop')) || 0;
  const c = scene.add.container(w / 2, 96 + top, [r, t]).setScrollFactor(0).setDepth(170).setAlpha(0);
  const y0 = 128 + top;
  scene.tweens.add({ targets: c, y: y0, alpha: 1, duration: 220, ease: 'Back.Out' });
  scene.tweens.add({ targets: c, alpha: 0, y: y0 - 16, delay: ms, duration: 260, onComplete: () => c.destroy() });
  return c;
}

/** Jeton serisi göstergesi: seri büyüdükçe büyüyen, renk değiştiren rozet + kalan süre çizgisi. */
export class ComboMeter {
  private c: Phaser.GameObjects.Container; private bg: Phaser.GameObjects.Graphics; private t: Phaser.GameObjects.Text; private bar: Phaser.GameObjects.Rectangle; private shown = 0;
  /** y: dikey konum (yarışta üst şeridin altına iner) */
  constructor(private scene: Phaser.Scene, y = 116) {
    const w = viewW(scene);
    this.bg = scene.add.graphics(); this.t = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '18px', fontStyle: '800', color: '#ffffff' }).setOrigin(0.5);
    this.bar = scene.add.rectangle(0, 20, 60, 3, 0xffc25c, 1).setOrigin(0.5);
    this.c = scene.add.container(w - 58, y, [this.bg, this.t, this.bar]).setScrollFactor(0).setDepth(103).setAlpha(0);
  }
  /** seri arttı */
  bump(combo: number) {
    if (combo < 2) return;
    this.shown = combo;
    const col = combo >= 20 ? 0xf0567a : combo >= 10 ? 0xd98b00 : 0x6c4cf1;
    this.t.setText(`Seri ×${combo}`).setFontSize(16 + Math.min(10, Math.floor(combo / 3)));
    const bw = this.t.width + 22, bh = this.t.height + 8;
    this.bg.clear(); this.bg.fillStyle(col, 0.95); this.bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
    this.bar.setPosition(0, bh / 2 + 4).setSize(bw - 12, 3); this.c.setX(viewW(this.scene) - 12 - bw / 2);
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

/** Bölüm sonu kartı (oyun içinde, sonuç ekranından önce): koyu cam üstünde altın yıldızlar; satırlar üst üste binmez. */
export function endCard(scene: Phaser.Scene, opts: { stars?: number; title: string; sub?: string; color?: string }) {
  const w = viewW(scene), h = viewH(scene); const cw = Math.min(300, w - 48); const r = DPR(scene);
  const won = opts.stars != null;
  const items: Phaser.GameObjects.GameObject[] = [];
  const parts: { obj: Phaser.GameObjects.Text; h: number }[] = [];
  const starRow: Phaser.GameObjects.Image[] = [];
  let y = 0;
  if (won) { for (let i = 0; i < 3; i++) starRow.push(scene.add.image((i - 1) * 58, 0, starTex(scene, i < (opts.stars ?? 0))).setScale((i === 1 ? 1.2 : 1) / r)); y += 58; }
  const title = scene.add.text(0, 0, opts.title, { fontFamily: FONT, fontSize: won ? '34px' : '30px', fontStyle: '900', color: opts.color ?? (won ? '#ffc93c' : '#fff6e5'), stroke: '#140c35', strokeThickness: 5, align: 'center', wordWrap: { width: cw - 32 }, padding: { x: 0, y: 4 }, resolution: r }).setOrigin(0.5, 0);
  parts.push({ obj: title, h: title.height });
  if (opts.sub) { const sub = scene.add.text(0, 0, opts.sub, { fontFamily: FONT, fontSize: '16px', fontStyle: '800', color: '#c9c1ff', align: 'center', wordWrap: { width: cw - 32 }, lineSpacing: 4, resolution: r }).setOrigin(0.5, 0); parts.push({ obj: sub, h: sub.height }); }
  const contentH = y + parts.reduce((a, p) => a + p.h, 0) + (parts.length - 1) * 6; const ch = Math.round(contentH + 44);
  const bg = scene.add.image(0, 0, nightCardTex(scene, cw, ch, won ? '#ffc93c' : '#ff5c8a')).setScale(1 / r);
  items.push(bg);
  let cy = -ch / 2 + 22;
  if (starRow.length) { for (const s of starRow) { s.setY(cy + 26); items.push(s); } cy += 58; }
  for (const p of parts) { p.obj.setY(cy); items.push(p.obj); cy += p.h + 6; }
  const c = scene.add.container(w / 2, h / 2 - 40, items).setScrollFactor(0).setDepth(250).setScale(0.85).setAlpha(0);
  scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
  starRow.forEach((s, i) => { const k = s.scale; s.setScale(0); scene.tweens.add({ targets: s, scale: k, delay: 120 + i * 140, duration: 280, ease: 'Back.Out' }); });
  return c;
}
