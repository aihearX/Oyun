/**
 * Oyun içi gösterge (HUD): koyu cam paneller + altın. Nota sayacı (uçan nota), 3 altın koklea yuvası, canlar,
 * ilerleme çubuğu (kontrol noktası çentikleri, yarış hayaletleri), seri/çarpan rozeti ve övgü sözleri, duraklat düğmesi,
 * öğretici el işareti. Ekran-sabit (scrollFactor 0); kamera yakınlaştırması/kökeni ne olursa olsun tasarım biriminde konumlanır.
 */
import Phaser from 'phaser';
import { I, R, T, glassPanel, drawGoldNote, drawGoldCochlea, softGlowTex, sparkTex, ringTex } from './tex';
import { css, FONT, heartPath, screenOrigin, THEME, type Ctx } from './util';

const ADD = Phaser.BlendModes.ADD;
export type HintKind = 'tap' | 'hold' | 'swipeDown' | 'swipeRight' | 'swipeLeft';
export interface GhostMark { id: string; pct: number; color: number; label?: string }

// ---------------------------------------------------------------- dokular
const panelTex = (s: Phaser.Scene, w: number, h: number, r: number) => T(s, `hud-panel-${w}x${h}-${r}`, w + 16, h + 16, (ctx) => glassPanel(ctx, 8, 6, w, h, r));
const noteIcon = (s: Phaser.Scene) => T(s, 'hud-note', 30, 32, (ctx) => drawGoldNote(ctx, 15, 16, 24, false));
const cochleaIcon = (s: Phaser.Scene, lit: boolean) => T(s, `hud-coch-${lit ? 1 : 0}`, 34, 34, (ctx) => drawGoldCochlea(ctx, 17, 17, 10, lit));
const heartIcon = (s: Phaser.Scene, full: boolean) => T(s, `hud-heart-${full ? 1 : 0}`, 26, 24, (ctx) => {
  if (full) {
    ctx.save(); ctx.translate(0.8, 1.4); heartPath(ctx, 13, 12, 20); ctx.fillStyle = 'rgba(60,0,20,0.5)'; ctx.fill(); ctx.restore();
    heartPath(ctx, 13, 12, 20); const g = ctx.createLinearGradient(0, 2, 0, 22); g.addColorStop(0, '#ffb3c8'); g.addColorStop(0.45, css(THEME.coral)); g.addColorStop(1, '#c0204e'); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#6a0a28'; ctx.lineWidth = 1.3; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(8.4, 7.6, 2.6, 1.6, -0.6, 0, Math.PI * 2); ctx.fill();
  } else { heartPath(ctx, 13, 12, 20); ctx.fillStyle = 'rgba(20,10,60,0.6)'; ctx.fill(); ctx.strokeStyle = 'rgba(201,193,255,0.45)'; ctx.lineWidth = 1.4; ctx.stroke(); }
});
const pauseTex = (s: Phaser.Scene) => T(s, 'hud-pause', 56, 56, (ctx) => {
  ctx.save(); ctx.shadowColor = 'rgba(5,0,25,0.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; ctx.beginPath(); ctx.arc(28, 27, 20, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(0, 7, 0, 47); g.addColorStop(0, css(0x3a2788, 0.92)); g.addColorStop(1, css(0x1a1046, 0.94)); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.arc(28, 27, 19.2, 0, Math.PI * 2); ctx.strokeStyle = css(THEME.gold, 0.75); ctx.lineWidth = 1.6; ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.arc(28, 27, 19, 0, Math.PI * 2); ctx.clip(); const sh = ctx.createLinearGradient(0, 7, 0, 27); sh.addColorStop(0, 'rgba(255,255,255,0.18)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sh; ctx.fillRect(0, 0, 56, 27); ctx.restore();
  for (const x of [21.5, 30.5]) { ctx.beginPath(); ctx.roundRect(x, 18, 4.5, 18, 2.2); const b = ctx.createLinearGradient(0, 18, 0, 36); b.addColorStop(0, '#fff3b0'); b.addColorStop(1, css(THEME.gold)); ctx.fillStyle = b; ctx.fill(); }
});
const barTrackTex = (s: Phaser.Scene) => T(s, 'hud-track', 64, 16, (ctx) => {
  ctx.beginPath(); ctx.roundRect(1, 2, 62, 12, 6); ctx.fillStyle = css(0x120a36, 0.82); ctx.fill(); ctx.strokeStyle = css(THEME.gold, 0.45); ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(3, 4, 58, 3, 1.5); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
});
const barFillTex = (s: Phaser.Scene) => T(s, 'hud-fill', 64, 12, (ctx) => {
  ctx.beginPath(); ctx.roundRect(1, 1, 62, 10, 5); const g = ctx.createLinearGradient(0, 1, 0, 11); g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, css(THEME.gold)); g.addColorStop(1, css(THEME.gold2)); ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.roundRect(4, 2.5, 56, 2.2, 1.1); ctx.fill();
});
const tickTex = (s: Phaser.Scene, lit: boolean) => T(s, `hud-tick-${lit ? 1 : 0}`, 14, 14, (ctx) => {
  ctx.beginPath(); ctx.moveTo(7, 1.5); ctx.lineTo(12.5, 7); ctx.lineTo(7, 12.5); ctx.lineTo(1.5, 7); ctx.closePath();
  ctx.fillStyle = lit ? css(THEME.gold) : css(0x2a1b63); ctx.fill(); ctx.strokeStyle = lit ? '#fff3b0' : 'rgba(201,193,255,0.7)'; ctx.lineWidth = 1.3; ctx.stroke();
});
const flagTex = (s: Phaser.Scene) => T(s, 'hud-flag', 18, 22, (ctx) => {
  ctx.strokeStyle = '#fff6e5'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(4, 21); ctx.lineTo(4, 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(5, 2.5); ctx.lineTo(16, 5.5); ctx.lineTo(5, 10); ctx.closePath(); ctx.fillStyle = css(THEME.coral); ctx.fill();
});
const markerTex = (s: Phaser.Scene, c: number) => T(s, `hud-mark-${c.toString(16)}`, 22, 22, (ctx) => {
  ctx.beginPath(); ctx.arc(11, 11, 7.5, 0, Math.PI * 2); const g = ctx.createRadialGradient(9, 8, 1, 11, 11, 8); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, css(c)); g.addColorStop(1, css(c)); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#fff6e5'; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = 'rgba(10,0,30,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(11, 11, 9, 0, Math.PI * 2); ctx.stroke();
});
const handTex = (s: Phaser.Scene) => T(s, 'hud-hand', 70, 92, (ctx) => paintHand(ctx));
function paintHand(ctx: Ctx) {
  // işaret parmağı yukarıda, sevimli eldiven el
  const p = () => {
    ctx.beginPath();
    ctx.moveTo(27, 8); ctx.quadraticCurveTo(27, 2, 33, 2); ctx.quadraticCurveTo(39, 2, 39, 8); ctx.lineTo(39, 38);
    ctx.quadraticCurveTo(40, 32, 46, 33); ctx.quadraticCurveTo(51, 34, 50.5, 41);
    ctx.quadraticCurveTo(52, 36, 57, 38); ctx.quadraticCurveTo(61, 40, 60.5, 46);
    ctx.quadraticCurveTo(62, 43, 65, 45.5); ctx.quadraticCurveTo(68, 48, 67, 56);
    ctx.lineTo(65, 70); ctx.quadraticCurveTo(62, 84, 48, 86); ctx.lineTo(34, 86); ctx.quadraticCurveTo(22, 85, 16, 74);
    ctx.lineTo(6, 56); ctx.quadraticCurveTo(3, 50, 8, 47); ctx.quadraticCurveTo(13, 45, 17, 51); ctx.lineTo(27, 62); ctx.closePath();
  };
  ctx.save(); ctx.shadowColor = 'rgba(5,0,25,0.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4; p(); ctx.fillStyle = '#fff6e5'; ctx.fill(); ctx.restore();
  p(); const g = ctx.createLinearGradient(10, 0, 66, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e8dcf8'); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#2a1b63'; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.strokeStyle = 'rgba(42,27,99,0.55)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (const [x0, y0, y1] of [[39, 40, 52], [50.5, 43, 55], [60.5, 48, 58]] as [number, number, number][]) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(31, 12, 2, 5, 0, 0, Math.PI * 2); ctx.fill();
  // bileklik (altın)
  ctx.beginPath(); ctx.roundRect(22, 80, 40, 10, 4); const b = ctx.createLinearGradient(0, 80, 0, 90); b.addColorStop(0, '#fff3b0'); b.addColorStop(1, css(THEME.gold2)); ctx.fillStyle = b; ctx.fill(); ctx.strokeStyle = '#8a4500'; ctx.lineWidth = 1.4; ctx.stroke();
}
const chevTex = (s: Phaser.Scene) => T(s, 'hud-chev', 24, 24, (ctx) => { ctx.strokeStyle = '#fff6e5'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(6, 4); ctx.lineTo(16, 12); ctx.lineTo(6, 20); ctx.stroke(); });
const arcTex = (s: Phaser.Scene) => T(s, 'hud-arc', 64, 64, (ctx) => { ctx.strokeStyle = css(THEME.gold); ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(32, 32, 26, -Math.PI / 2, Math.PI * 1.5); ctx.stroke(); });

// ---------------------------------------------------------------- HUD
export class LevelHud {
  readonly root: Phaser.GameObjects.Container;
  private w: number; private h: number;
  private notesPanel: Phaser.GameObjects.Image; private noteIco: Phaser.GameObjects.Image; private notesText: Phaser.GameObjects.Text; private notesTotal: Phaser.GameObjects.Text;
  private cochPanel: Phaser.GameObjects.Image; private coch: Phaser.GameObjects.Image[] = []; private cochOn: Phaser.GameObjects.Image[] = [];
  private livesPanel: Phaser.GameObjects.Image; private hearts: Phaser.GameObjects.Image[] = []; private heartsOff: Phaser.GameObjects.Image[] = []; private lives = 3;
  private pause: Phaser.GameObjects.Image; private pauseCb: (() => void) | null = null;
  private bar: Phaser.GameObjects.Container; private track: Phaser.GameObjects.NineSlice | Phaser.GameObjects.Image; private fill: Phaser.GameObjects.NineSlice | Phaser.GameObjects.Image; private head: Phaser.GameObjects.Image; private headDot: Phaser.GameObjects.Arc; private flag: Phaser.GameObjects.Image;
  private ticks: { pct: number; off: Phaser.GameObjects.Image; on: Phaser.GameObjects.Image }[] = []; private ghosts = new Map<string, Phaser.GameObjects.Container>();
  private combo: Phaser.GameObjects.Container; private comboBg: Phaser.GameObjects.Image; private comboMult: Phaser.GameObjects.Text; private comboCount: Phaser.GameObjects.Text; private comboShown = false;
  private hint?: Phaser.GameObjects.Container; private hintTweens: Phaser.Tweens.Tween[] = []; private hintTimer?: Phaser.Time.TimerEvent;
  private toastC?: Phaser.GameObjects.Container; private toastTimer?: Phaser.Time.TimerEvent;
  private pct = 0; private notes = 0;
  private barX = 16; private barY = 0; private barW = 0; private k = 1;

  constructor(private scene: Phaser.Scene, private top = 0, heroColor = 0x6c4cf1) {
    const s = scene; const cam = s.cameras.main; this.w = cam.width / cam.zoom; this.h = cam.height / cam.zoom;
    const O = screenOrigin(cam);
    this.root = s.add.container(O.x, O.y).setDepth(100).setScrollFactor(0);
    const txt = (size: number, color: string, weight = '900') => s.add.text(0, 0, '', { fontFamily: FONT, fontSize: `${size}px`, fontStyle: weight, color, resolution: R() }).setOrigin(0, 0.5);
    // nota sayacı
    this.notesPanel = I(s, panelTex(s, 112, 40, 20)).setOrigin(0, 0);
    this.noteIco = I(s, noteIcon(s)).setOrigin(0.5);
    this.notesText = txt(20, '#fff6e5'); this.notesText.setStroke('#140c35', 4);
    this.notesTotal = txt(13, '#c9c1ff', '800');
    // koklea yuvaları
    this.cochPanel = I(s, panelTex(s, 92, 40, 20)).setOrigin(0, 0);
    for (let i = 0; i < 3; i++) { this.coch.push(I(s, cochleaIcon(s, false))); const on = I(s, cochleaIcon(s, true)).setVisible(false); this.cochOn.push(on); }
    // canlar
    this.livesPanel = I(s, panelTex(s, 86, 40, 20)).setOrigin(0, 0);
    for (let i = 0; i < 5; i++) { this.heartsOff.push(I(s, heartIcon(s, false))); this.hearts.push(I(s, heartIcon(s, true))); }
    // duraklat
    // duraklat: isabet testi oyunun girdi katmanında yapılır (pauseHit) — Phaser'ın kaydırma-çarpanı 0 + yakınlaştırılmış kamera
    // altındaki etkileşim eşlemesine güvenilmez (telefonda DPR > 1); dokunuş asla zıplama olarak da sayılmaz
    this.pause = I(s, pauseTex(s));
    // ilerleme çubuğu
    this.bar = s.add.container(0, 0);
    const RR = R(); const gl = !!(s.sys.renderer as { gl?: unknown }).gl;
    this.track = gl ? s.add.nineslice(0, 0, barTrackTex(s), undefined, 64 * RR, 16 * RR, 8 * RR, 8 * RR, 0, 0).setOrigin(0, 0.5).setScale(1 / RR) : I(s, barTrackTex(s)).setOrigin(0, 0.5);
    this.fill = gl ? s.add.nineslice(0, 0, barFillTex(s), undefined, 64 * RR, 12 * RR, 6 * RR, 6 * RR, 0, 0).setOrigin(0, 0.5).setScale(1 / RR) : I(s, barFillTex(s)).setOrigin(0, 0.5);
    this.head = s.add.image(0, 0, softGlowTex(s)).setBlendMode(ADD).setTint(THEME.gold).setDisplaySize(34, 34).setAlpha(0.85);
    this.headDot = s.add.circle(0, 0, 6.5, heroColor).setStrokeStyle(2, 0xfff6e5);
    this.flag = I(s, flagTex(s)).setOrigin(0.2, 0.95);
    this.bar.add([this.track, this.fill, this.flag, this.head, this.headDot]);
    // seri rozeti
    this.comboBg = I(s, panelTex(s, 96, 46, 16)).setOrigin(0.5);
    this.comboMult = s.add.text(-18, -1, '×2', { fontFamily: FONT, fontSize: '26px', fontStyle: '900', color: '#ffc93c', stroke: '#140c35', strokeThickness: 5, resolution: R() }).setOrigin(0.5);
    this.comboCount = s.add.text(20, 0, 'Seri\n12', { fontFamily: FONT, fontSize: '11px', fontStyle: '900', color: '#c9c1ff', align: 'center', lineSpacing: -2, resolution: R() }).setOrigin(0.5);
    this.combo = s.add.container(0, 0, [this.comboBg, this.comboMult, this.comboCount]).setAlpha(0);
    this.root.add([this.notesPanel, this.noteIco, this.notesText, this.notesTotal, this.cochPanel, ...this.coch, ...this.cochOn, this.livesPanel, ...this.heartsOff, ...this.hearts, this.pause, this.bar, this.combo]);
    this.root.setScrollFactor(0, 0, true);
    this.layout(); this.setNotes(0, 0); this.setCochleas(0); this.setLives(3); this.setProgress(0);
  }

  /** dar ekranda (tasarım genişliği < 390) tüm gösterge orantılı küçülür */
  private get iw() { return this.w / this.k; }
  private get ih() { return this.h / this.k; }
  private layout() {
    this.k = Math.min(1, this.w / 390); this.root.setScale(this.k);
    const t = this.top / this.k + 10; const W = this.iw;
    this.notesPanel.setPosition(4, t - 6); this.noteIco.setPosition(30, t + 20); this.notesText.setPosition(46, t + 19); this.positionTotal();
    this.cochPanel.setPosition(122, t - 6); this.coch.forEach((c, i) => { c.setPosition(146 + i * 28, t + 20); this.cochOn[i]!.setPosition(146 + i * 28, t + 20); });
    this.pause.setPosition(W - 32, t + 19);
    this.livesPanel.setPosition(W - 154, t - 6); this.placeHearts();
    this.barX = 18; this.barW = W - 36; this.barY = t + 58;
    this.bar.setPosition(this.barX, this.barY);
    this.setW(this.track, this.barW, 16); this.flag.setPosition(this.barW - 2, -3);
    for (const k of this.ticks) { k.off.setPosition(k.pct * this.barW, 0); k.on.setPosition(k.pct * this.barW, 0); }
    for (const [, g] of this.ghosts) g.x = (g.getData('pct') as number) * this.barW;
    this.combo.setPosition(W - 64, t + 100);
    this.setProgress(this.pct);
  }
  private setW(o: Phaser.GameObjects.NineSlice | Phaser.GameObjects.Image, w: number, h: number) {
    if (o instanceof Phaser.GameObjects.NineSlice) { const RR = R(); o.setSize(Math.max(12, w) * RR, h * RR); } else o.setDisplaySize(Math.max(12, w), h);
  }
  private positionTotal() { this.notesTotal.setPosition(this.notesText.x + this.notesText.width + 2, this.notesText.y + 2); }
  private placeHearts() {
    const n = Math.max(3, Math.min(5, this.lives)); const x0 = this.livesPanel.x + 8 + 43 - ((n - 1) * 25) / 2;
    for (let i = 0; i < 5; i++) { const vis = i < n; const x = x0 + i * 25, y = this.livesPanel.y + 26; this.heartsOff[i]!.setPosition(x, y).setVisible(vis); this.hearts[i]!.setPosition(x, y).setVisible(vis && i < this.lives); }
  }
  /** kısa zıplama; taban ölçek bir kez saklanır (üst üste çağrılar büyümez) */
  private bump(o: Phaser.GameObjects.Image, k = 1.25) {
    let base = o.getData('base') as number | undefined; if (base == null) { base = o.scale; o.setData('base', base); }
    this.scene.tweens.killTweensOf(o); o.setScale(base); this.scene.tweens.add({ targets: o, scale: base * k, duration: 90, yoyo: true, ease: 'Sine.Out' });
  }

  setNotes(n: number, total: number) {
    const up = n > this.notes; this.notes = n;
    this.notesText.setText(String(n)); this.notesTotal.setText(total > 0 ? `/${total}` : ''); this.positionTotal();
    if (up) { this.bump(this.noteIco, 1.35); }
  }
  /** dünyadaki noktadan sayaca uçan nota; varınca sayaç zıplar */
  flyNote(worldX: number, worldY: number, onArrive?: () => void) {
    const s = this.scene; const cam = s.cameras.main; const v = { x: (worldX - cam.worldView.x) / this.k, y: (worldY - cam.worldView.y) / this.k };
    const n = I(s, noteIcon(s), v.x, v.y).setScrollFactor(0); this.root.add(n);
    const tx = this.noteIco.x, ty = this.noteIco.y; const mx = (v.x + tx) / 2 + 40, my = Math.min(v.y, ty) - 40;
    const path = { t: 0 };
    s.tweens.add({ targets: path, t: 1, duration: 520, ease: 'Cubic.In', onUpdate: () => { const t = path.t, u = 1 - t; n.setPosition(u * u * v.x + 2 * u * t * mx + t * t * tx, u * u * v.y + 2 * u * t * my + t * t * ty); n.setScale((1 - t * 0.35) / R()); },
      onComplete: () => { n.destroy(); this.bump(this.noteIco, 1.45); const g = s.add.image(tx, ty, softGlowTex(s)).setBlendMode(ADD).setTint(THEME.gold).setDisplaySize(60, 60).setScrollFactor(0); this.root.add(g); s.tweens.add({ targets: g, alpha: 0, duration: 300, onComplete: () => g.destroy() }); onArrive?.(); } });
  }
  setCochleas(n: number) {
    for (let i = 0; i < 3; i++) { const on = i < n; const was = this.cochOn[i]!.visible; this.cochOn[i]!.setVisible(on); this.coch[i]!.setVisible(!on);
      if (on && !was) { const c = this.cochOn[i]!; const b = 1 / R(); this.scene.tweens.killTweensOf(c); c.setScale(b * 2.2); this.scene.tweens.add({ targets: c, scale: b, duration: 420, ease: 'Back.Out' }); const r = this.scene.add.image(c.x, c.y, ringTex(this.scene)).setBlendMode(ADD).setTint(THEME.gold).setScale(0.1).setScrollFactor(0); this.root.add(r); this.scene.tweens.add({ targets: r, scale: 0.45, alpha: 0, duration: 500, onComplete: () => r.destroy() }); }
    }
  }
  setLives(n: number) {
    const lost = n < this.lives; this.lives = Math.max(0, n); this.placeHearts();
    if (lost) { const h = this.heartsOff[this.lives]; if (h) { const b = 1 / R(); this.scene.tweens.killTweensOf(h); h.setScale(b * 1.5); this.scene.tweens.add({ targets: h, scale: b, duration: 300, ease: 'Back.Out' }); } this.scene.tweens.add({ targets: this.livesPanel, x: this.livesPanel.x + 4, duration: 50, yoyo: true, repeat: 2 }); }
  }
  setProgress(pct: number) {
    this.pct = Math.max(0, Math.min(1, pct)); const x = this.pct * this.barW;
    this.setW(this.fill, Math.max(12, x + 4), 12); this.fill.setVisible(x > 2);
    this.head.setPosition(x, 0); this.headDot.setPosition(x, 0);
    for (const k of this.ticks) { const lit = this.pct >= k.pct; if (lit !== k.on.visible) { k.on.setVisible(lit); k.off.setVisible(!lit); if (lit) this.bump(k.on, 1.6); } }
  }
  setCheckpoints(pcts: number[]) {
    for (const k of this.ticks) { k.off.destroy(); k.on.destroy(); } this.ticks = [];
    for (const p of pcts) { const off = I(this.scene, tickTex(this.scene, false), p * this.barW, 0).setScrollFactor(0); const on = I(this.scene, tickTex(this.scene, true), p * this.barW, 0).setScrollFactor(0).setVisible(false); this.bar.addAt(off, 2); this.bar.addAt(on, 2); this.ticks.push({ pct: p, off, on }); }
    this.setProgress(this.pct);
  }
  setGhosts(list: GhostMark[]) {
    const keep = new Set(list.map((g) => g.id));
    for (const [id, c] of this.ghosts) if (!keep.has(id)) { c.destroy(); this.ghosts.delete(id); }
    for (const g of list) {
      let c = this.ghosts.get(g.id);
      if (!c) {
        c = this.scene.add.container(0, -12).setScrollFactor(0);
        const m = I(this.scene, markerTex(this.scene, g.color)); c.add(m);
        if (g.label) { const t = this.scene.add.text(0, -12, g.label, { fontFamily: FONT, fontSize: '9px', fontStyle: '900', color: '#fff6e5', stroke: '#140c35', strokeThickness: 3, resolution: R() }).setOrigin(0.5); c.add(t); }
        this.bar.addAt(c, 3); this.ghosts.set(g.id, c);
      }
      const p = Math.max(0, Math.min(1, g.pct)); c.setData('pct', p); c.x = p * this.barW;
    }
    this.bar.bringToTop(this.head); this.bar.bringToTop(this.headDot);
  }
  setCombo(n: number, mult: number) {
    if (n < 2 || mult < 2) { if (this.comboShown) { this.comboShown = false; this.scene.tweens.add({ targets: this.combo, alpha: 0, scale: 0.8, duration: 200 }); } return; }
    this.comboMult.setText(`×${mult}`); this.comboCount.setText(`Seri\n${n}`);
    const hot = mult >= 4 ? '#ff5c8a' : mult >= 3 ? '#ff9f1c' : '#ffc93c'; this.comboMult.setColor(hot);
    this.scene.tweens.killTweensOf(this.combo);
    if (!this.comboShown) { this.comboShown = true; this.combo.setAlpha(1).setScale(0.4); this.scene.tweens.add({ targets: this.combo, scale: 1, duration: 260, ease: 'Back.Out' }); }
    else { this.combo.setAlpha(1).setScale(1.18); this.scene.tweens.add({ targets: this.combo, scale: 1, duration: 180, ease: 'Back.Out' }); }
  }
  /** övgü sözü: "Güzel!", "Mükemmel!" — ekranın üst-ortasında altın, büyüyüp süzülür */
  praise(text: string) {
    const s = this.scene; const y0 = this.top / this.k + 168;
    const prev = this.root.getByName('praise') as Phaser.GameObjects.Container | null; prev?.destroy();
    const t = s.add.text(0, 0, text, { fontFamily: FONT, fontSize: '38px', fontStyle: '900', color: '#ffc93c', stroke: '#2a0f4a', strokeThickness: 8, resolution: R(), padding: { x: 6, y: 6 } }).setOrigin(0.5);
    const grd = t.context.createLinearGradient(0, 0, 0, t.height); grd.addColorStop(0.2, '#fff6c4'); grd.addColorStop(0.55, '#ffc93c'); grd.addColorStop(0.9, '#ff8a1c'); t.setFill(grd);
    t.setShadow(0, 4, 'rgba(20,0,40,0.6)', 6, true, true);
    const g = s.add.image(0, 0, softGlowTex(s)).setBlendMode(ADD).setTint(THEME.gold).setDisplaySize(t.width * 1.4, 90).setAlpha(0.5);
    const sp = [-1, 1].map((d) => s.add.image(d * (t.width / 2 + 8), -10, sparkTex(s)).setBlendMode(ADD).setScale(0.6).setTint(0xfff1a8));
    const c = s.add.container(this.iw / 2, y0, [g, t, ...sp]).setName('praise').setScrollFactor(0, 0, true).setScale(0.3).setAlpha(0);
    this.root.add(c);
    s.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
    s.tweens.add({ targets: sp, angle: 180, scale: 0, duration: 700 });
    s.tweens.add({ targets: c, y: y0 - 26, alpha: 0, delay: 700, duration: 380, ease: 'Cubic.In', onComplete: () => c.destroy() });
  }
  /** ekrandaki övgü sözünü hemen kaldır (oyuncu hasar aldı: eski "Güzel!" ekranda kalmasın) */
  clearPraise() {
    const prev = this.root.getByName('praise') as Phaser.GameObjects.Container | null; if (!prev) return;
    this.scene.tweens.killTweensOf(prev); this.scene.tweens.killTweensOf(prev.list); prev.destroy();
  }
  onPause(cb: () => void) { this.pauseCb = cb; }
  /** duraklat düğmesi isabeti (tasarım ekran koordinatı; parmak için cömert 34 px yarıçap) */
  pauseCenter(): { x: number; y: number } { return { x: this.pause.x * this.k, y: this.pause.y * this.k }; }
  pauseHit(x: number, y: number): boolean { const px = this.pause.x * this.k, py = this.pause.y * this.k; return Math.hypot(x - px, y - py) <= 34 * this.k; }
  /** duraklat düğmesine basıldı: küçük basılma animasyonu + geri çağrı */
  pressPause() { this.scene.tweens.killTweensOf(this.pause); this.pause.setScale(1 / R()); this.scene.tweens.add({ targets: this.pause, scale: 0.88 / R(), duration: 70, yoyo: true }); this.pauseCb?.(); }

  /** alt-orta bilgi şeridi: koyu cam üstünde krem yazı (bölüm girişi, faz uyarıları). Boş metin gizler. */
  toast(text: string, ms = 2500) {
    const s = this.scene; this.toastTimer?.remove(false);
    const prev = this.toastC; this.toastC = undefined;
    if (prev) s.tweens.add({ targets: prev, alpha: 0, duration: 140, onComplete: () => prev.destroy() });
    if (!text) return;
    const label = s.add.text(0, 0, text, { fontFamily: FONT, fontSize: '15px', fontStyle: '800', color: '#fff6e5', align: 'center', lineSpacing: 2, wordWrap: { width: this.iw - 64 }, resolution: R() }).setOrigin(0.5);
    const pw = Math.round(Math.min(this.iw - 32, label.width + 40)), ph = Math.round(label.height + 20);
    const bg = I(s, panelTex(s, pw, ph, Math.min(18, Math.round(ph / 2)))).setPosition(0, 2);
    const c = s.add.container(this.iw / 2, this.ih - 74, [bg, label]).setScrollFactor(0, 0, true).setAlpha(0);
    this.root.add(c); this.toastC = c;
    s.tweens.add({ targets: c, alpha: 1, y: c.y - 6, duration: 220, ease: 'Cubic.Out' });
    this.toastTimer = s.time.delayedCall(ms, () => { if (this.toastC !== c) return; this.toastC = undefined; s.tweens.add({ targets: c, alpha: 0, duration: 300, onComplete: () => c.destroy() }); });
  }

  /** öğretici el işareti + açıklama (ekranın alt-ortası) */
  showHint(kind: HintKind, text: string) {
    this.hideHint(); const s = this.scene; const cx = this.iw / 2, cy = this.ih * 0.62;
    const c = s.add.container(0, 0).setScrollFactor(0); this.root.add(c); this.hint = c;
    const tw = (cfg: Phaser.Types.Tweens.TweenBuilderConfig) => { const t = s.tweens.add(cfg); this.hintTweens.push(t); return t; };
    // açıklama
    const label = s.add.text(0, 0, text, { fontFamily: FONT, fontSize: '17px', fontStyle: '900', color: '#fff6e5', align: 'center', wordWrap: { width: this.iw - 80 }, resolution: R() }).setOrigin(0.5);
    const pw = Math.min(this.iw - 40, label.width + 40), ph = label.height + 20;
    const bg = I(s, panelTex(s, Math.round(pw), Math.round(ph), Math.min(20, Math.round(ph / 2)))); const lab = s.add.container(cx, cy - 120, [bg, label]); c.add(lab);
    bg.setPosition(0, 2);
    const hand = I(s, handTex(s)).setOrigin(0.47, 0.03); const hx = cx, hy = cy;
    const ring = s.add.image(hx, hy, ringTex(s)).setBlendMode(ADD).setTint(THEME.gold).setScale(0.1).setAlpha(0);
    const glowI = s.add.image(hx, hy, softGlowTex(s)).setBlendMode(ADD).setTint(THEME.gold).setDisplaySize(90, 90).setAlpha(0.5);
    c.add([glowI, ring]);
    if (kind === 'swipeDown' || kind === 'swipeRight' || kind === 'swipeLeft') {
      const d = kind === 'swipeDown' ? { x: 0, y: 1 } : kind === 'swipeLeft' ? { x: -1, y: 0 } : { x: 1, y: 0 };
      for (let i = 0; i < 3; i++) { const ch = I(s, chevTex(s), hx + d.x * (30 + i * 22), hy + d.y * (30 + i * 22)).setAngle(kind === 'swipeDown' ? 90 : kind === 'swipeLeft' ? 180 : 0).setAlpha(0); c.add(ch); tw({ targets: ch, alpha: { from: 0, to: 1 }, duration: 300, delay: i * 120, yoyo: true, repeat: -1, repeatDelay: 600 }); }
      hand.setPosition(hx - d.x * 40, hy - d.y * 40); c.add(hand);
      tw({ targets: hand, x: hx + d.x * 70, y: hy + d.y * 70, duration: 750, ease: 'Cubic.InOut', repeat: -1, repeatDelay: 450, onRepeat: () => hand.setPosition(hx - d.x * 40, hy - d.y * 40) });
      tw({ targets: glowI, x: { from: hx - d.x * 40, to: hx + d.x * 70 }, y: { from: hy - d.y * 40, to: hy + d.y * 70 }, duration: 750, ease: 'Cubic.InOut', repeat: -1, repeatDelay: 450 });
    } else {
      hand.setPosition(hx, hy + 6); c.add(hand);
      if (kind === 'tap') {
        tw({ targets: hand, y: hy - 2, scale: hand.scale * 0.92, duration: 160, yoyo: true, repeat: -1, repeatDelay: 700, ease: 'Sine.InOut' });
        tw({ targets: ring, scale: { from: 0.08, to: 0.6 }, alpha: { from: 1, to: 0 }, duration: 600, repeat: -1, repeatDelay: 260, delay: 140 });
      } else {
        const arc = I(s, arcTex(s), hx, hy).setAlpha(0.95); c.addAt(arc, 1);
        const mask = { p: 0 }; const gfx = s.add.graphics().setScrollFactor(0); c.addAt(gfx, 1); arc.setVisible(false);
        tw({ targets: hand, y: hy - 2, scale: hand.scale * 0.92, duration: 180, ease: 'Sine.Out', yoyo: true, hold: 1100, repeat: -1, repeatDelay: 300 });
        tw({ targets: mask, p: 1, duration: 1200, delay: 180, repeat: -1, repeatDelay: 380, onUpdate: () => { gfx.clear(); gfx.lineStyle(5, THEME.gold, 1); gfx.beginPath(); gfx.arc(hx, hy, 26, -Math.PI / 2, -Math.PI / 2 + mask.p * Math.PI * 2); gfx.strokePath(); gfx.lineStyle(10, THEME.gold, 0.25); gfx.beginPath(); gfx.arc(hx, hy, 26, -Math.PI / 2, -Math.PI / 2 + mask.p * Math.PI * 2); gfx.strokePath(); } });
      }
    }
    tw({ targets: glowI, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
    c.setAlpha(0); tw({ targets: c, alpha: 1, duration: 220 });
    lab.setScale(0.8); tw({ targets: lab, scale: 1, duration: 260, ease: 'Back.Out' });
    c.setScrollFactor(0, 0, true);
  }
  hideHint() {
    for (const t of this.hintTweens) t.remove(); this.hintTweens = []; this.hintTimer?.remove(false);
    const c = this.hint; this.hint = undefined; if (!c) return;
    this.scene.tweens.add({ targets: c, alpha: 0, duration: 180, onComplete: () => c.destroy() });
  }
  resize(w: number, h: number, top = this.top) {
    const ow = this.iw, oh = this.ih;
    this.w = w; this.h = h; this.top = top; const O = screenOrigin(this.scene.cameras.main); this.root.setPosition(O.x, O.y); this.layout();
    // açık bilgi şeridi alt-ortada, el işareti ekranın alt-ortasında kalsın (oluşturulduğu boyuta göre konumlanmışlardı)
    if (this.toastC) this.toastC.setPosition(this.toastC.x + (this.iw - ow) / 2, this.toastC.y + (this.ih - oh));
    if (this.hint) this.hint.setPosition(this.hint.x + (this.iw - ow) / 2, this.hint.y + (this.ih - oh) * 0.62);
  }
  destroy() { this.hideHint(); this.root.destroy(); }
}
