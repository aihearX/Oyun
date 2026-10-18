/**
 * Yaşayan Kulak Haritası sahnesi: dikey kaydırmalı, el çizimi harita görünümlü saga yolu.
 * Kamera atalet ile kayar; yalnız görünen bölgelerin animasyonları çalışır. Dönüşte yeni yıldızlar uçar,
 * yol parlayarak çizilir, Odi zıplaya zıplaya ilerler, bölgeler mürekkep gibi renklenerek canlanır.
 */
import Phaser from 'phaser';
import { BIOMES } from '@odi/content';
import { emojiTexture, hatTexture, heroTexture } from '../art';
import { buildLayout, journeyDone, planReturn, pointAt, unlockedOf, zoneVitality, type MapLayout, type MapNode, type ReturnStep, type StarMap, type ZoneId } from './layout';
import { darken } from './paint';
import { RegionView, wait } from './region';
import { avatarTex, chestTex, flagTex, glowTex, NODE_D, nodeTex, pulseRingTex, shadowTex, sparkleTex, starTex, targetTex, type NodeState } from './sprites';
import type { MapOptions, MapSocial } from './types';

const FONT = '"SF Pro Rounded","Segoe UI Rounded","Nunito","Helvetica Neue",Arial,sans-serif';
const ODI = 46;

interface NodeView { n: MapNode; med: Phaser.GameObjects.Image; num: Phaser.GameObjects.Text; stars: Phaser.GameObjects.Image[]; chest?: Phaser.GameObjects.Image; state: NodeState; shown: number; r: number }

export class MapScene extends Phaser.Scene {
  opts!: MapOptions; L!: MapLayout; R = 2; S = 1.5; dpr = 1;
  private regions: RegionView[] = [];
  private nodes: NodeView[] = [];
  private prog: Phaser.GameObjects.Graphics[] = [];
  private shown: StarMap = {}; private treasures = new Set<number>();
  private odi!: Phaser.GameObjects.Container; private odiBody!: Phaser.GameObjects.Image; private odiIdle?: Phaser.Tweens.Tween;
  private pulse: Phaser.GameObjects.Image[] = []; private shine?: Phaser.GameObjects.Image; private shineT?: Phaser.Tweens.Tween;
  private social: Phaser.GameObjects.GameObject[] = []; private socialTw: Phaser.Tweens.Tween[] = [];
  private viewTop = 0; private vel = 0; private drag: { y: number; t: number; moved: number; startTop: number } | null = null;
  private follow: (() => number) | null = null; private autoTarget: number | null = null;
  private busy = false; private queue: StarMap | null = null; private speed = 1; private curVisible = true;
  private progS = 0;

  constructor() { super('map'); }

  create() {
    this.opts = this.registry.get('mapOpts') as MapOptions;
    this.dpr = (this.registry.get('dpr') as number) || 1;
    this.L = buildLayout();
    this.cameras.main.setBackgroundColor('#140c35');
    this.fitCamera();
    const sh = this.opts.seen ?? this.opts.stars;
    this.shown = { ...sh };
    this.treasures = new Set(this.opts.treasuresOpen.filter((n) => (sh[n] ?? 0) > 0));
    const webgl = this.game.renderer.type === Phaser.WEBGL;
    this.L.zones.forEach((z, i) => this.regions.push(new RegionView(this, { L: this.L, R: this.R, S: this.S, webgl, reduced: !!this.opts.reducedMotion }, z, i, zoneVitality(z.id, this.shown))));
    // ilerleme yolu (bölge parçaları: görünmeyen parça çizilmez)
    for (const z of this.L.zones) { const g = this.add.graphics().setDepth(5); g.setData('y0', z.top - 80).setData('y1', z.bottom + 80); this.prog.push(g); }
    this.shine = this.add.image(0, 0, glowTex(this, this.R, 0xfff3b0, 'm-glow-shine')).setScale(0.55).setBlendMode(Phaser.BlendModes.ADD).setDepth(5.1);
    for (const n of this.L.nodes) this.nodes.push(this.makeNode(n));
    this.makeOdi();
    this.syncNodes(); this.drawProgress(this.progressS(this.shown)); this.placeOdi(false);
    this.focusY(this.currentY(), false);
    this.setupInput();
    this.scale.on('resize', () => { this.fitCamera(); this.applyView(); });
    if (this.opts.social) this.setSocial(this.opts.social);
    this.events.once('shutdown', () => this.cleanup());
    if (this.opts.seen) this.time.delayedCall(450, () => this.play(this.opts.stars));
  }

  // ---------------------------------------------------------------- kamera
  private fitCamera() {
    const cam = this.cameras.main; const w = this.scale.width, h = this.scale.height;
    cam.setSize(w, h); cam.setZoom(w / this.L.width);
    const z = w / this.L.width; this.R = Math.max(1, Math.min(3, Math.round(z * 2) / 2)); this.S = Math.min(1.5, this.R);
  }
  private get viewH() { return this.scale.height / this.cameras.main.zoom; }
  /** CSS px → dünya birimi */
  private get cssToWorld() { return this.dpr / this.cameras.main.zoom; }
  private get bounds() { const top = -this.opts.insets.top * this.cssToWorld; return { min: top - 40, max: this.L.height - this.viewH + this.opts.insets.bottom * this.cssToWorld }; }
  private applyView() { const cam = this.cameras.main; cam.centerOn(this.L.width / 2, this.viewTop + this.viewH / 2); }
  private focusTop(y: number) { const t = this.opts.insets.top * this.cssToWorld, b = this.opts.insets.bottom * this.cssToWorld; return y - (t + (this.viewH - b)) / 2; }
  private clampTop(v: number) { const b = this.bounds; return Math.max(b.min, Math.min(b.max, v)); }
  focusY(y: number, animate = true) { const t = this.clampTop(this.focusTop(y)); if (!animate) { this.viewTop = t; this.autoTarget = null; this.applyView(); } else { this.autoTarget = t; this.vel = 0; } }
  focusCurrent(animate = true) { this.follow = null; this.focusY(this.currentY(), animate); }
  private currentY() { return journeyDone(this.shown) ? this.L.finale.y : this.L.nodes[unlockedOf(this.shown) - 1]!.y; }

  private setupInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.drag = { y: p.y, t: p.event.timeStamp || performance.now(), moved: 0, startTop: this.viewTop }; this.vel = 0; this.autoTarget = null; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const d = this.drag; if (!d || !p.isDown) return;
      const dy = (p.y - d.y) / this.cameras.main.zoom; const now = p.event.timeStamp || performance.now(); const dt = Math.max(1, now - d.t);
      d.moved += Math.abs(p.y - d.y); d.y = p.y; d.t = now;
      if (this.busy) return;
      let next = this.viewTop - dy; const b = this.bounds; if (next < b.min || next > b.max) next = this.viewTop - dy * 0.35; // lastik
      this.viewTop = next; this.vel = 0.8 * (-dy / dt) + 0.2 * this.vel; this.follow = null;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const d = this.drag; this.drag = null; if (!d) return;
      if (d.moved < 10 * this.dpr) { this.vel = 0; this.tap(p); }
    });
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => { if (this.busy) return; this.autoTarget = null; this.viewTop = this.clampTop(this.viewTop + dy / this.cameras.main.zoom * this.dpr * 0.6); });
  }
  private tap(p: Phaser.Input.Pointer) {
    if (this.busy) { this.speedUp(); return; }
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    for (const nv of this.nodes) if (nv.chest && Phaser.Math.Distance.Between(w.x, w.y, nv.chest.x, nv.chest.y) < 26) { this.opts.sfx?.('tap'); this.wiggle(nv.chest); this.opts.onTreasureTap?.(nv.n.n); return; }
    let best: NodeView | null = null; let bd = 1e9;
    for (const nv of this.nodes) { const d = Phaser.Math.Distance.Between(w.x, w.y, nv.n.x, nv.n.y); if (d < nv.r + 12 && d < bd) { bd = d; best = nv; } }
    if (best) { this.opts.sfx?.('tap'); this.tweens.add({ targets: best.med, scale: best.med.scale * 1.12, duration: 90, yoyo: true }); this.opts.onNodeTap?.(best.n.n); return; }
    for (const rv of this.regions) if (rv.label.getBounds().contains(w.x, w.y)) { this.opts.sfx?.('tap'); this.wiggle(rv.label); this.opts.onZoneTap?.(rv.zone.id); return; }
  }
  private wiggle(o: Phaser.GameObjects.Image) { this.tweens.add({ targets: o, angle: { from: -4, to: 4 }, duration: 70, yoyo: true, repeat: 2, onComplete: () => o.setAngle(0) }); }

  override update(_t: number, dtRaw: number) {
    const dt = Math.min(50, dtRaw);
    if (this.follow) { const t = this.clampTop(this.focusTop(this.follow())); this.viewTop += (t - this.viewTop) * Math.min(1, dt * 0.008); }
    else if (this.autoTarget != null) { this.viewTop += (this.autoTarget - this.viewTop) * Math.min(1, dt * 0.009); if (Math.abs(this.autoTarget - this.viewTop) < 0.5) { this.viewTop = this.autoTarget; this.autoTarget = null; } }
    else if (!this.drag) {
      if (Math.abs(this.vel) > 0.002) { this.viewTop += this.vel * dt; this.vel *= Math.pow(0.95, dt / 16.7); }
      const b = this.bounds; if (this.viewTop < b.min) { this.viewTop += (b.min - this.viewTop) * Math.min(1, dt * 0.015); this.vel = 0; } if (this.viewTop > b.max) { this.viewTop += (b.max - this.viewTop) * Math.min(1, dt * 0.015); this.vel = 0; }
    }
    this.applyView();
    // görünür bölgeler etkin, diğerleri duraklar
    const top = this.viewTop - 120, bot = this.viewTop + this.viewH + 120;
    for (const rv of this.regions) rv.setActive(rv.zone.bottom + 80 > top && rv.zone.top < bot);
    for (const g of this.prog) g.setVisible((g.getData('y1') as number) > top && (g.getData('y0') as number) < bot);
    const cy = this.currentY(); const vis = cy > this.viewTop + 20 && cy < this.viewTop + this.viewH - 20;
    if (vis !== this.curVisible) { this.curVisible = vis; this.opts.onCurrentVisible?.(vis, cy < this.viewTop ? 'up' : 'down'); }
  }

  // ---------------------------------------------------------------- düğümler
  private makeNode(n: MapNode): NodeView {
    const D = n.boss ? 96 : NODE_D;
    const med = this.add.image(n.x, n.y, nodeTex(this, this.R, 'locked', 0, n.boss)).setDepth(6).setScale(1 / this.R).setOrigin(0.5, (D / 2 + 6) / (D + 22));
    const num = this.add.text(n.x, n.y + (n.boss ? 30 : 0), String(n.n), { fontFamily: FONT, fontSize: n.boss ? '17px' : '24px', fontStyle: '900', color: '#ffffff', stroke: '#2a1660', strokeThickness: 5, resolution: this.R }).setOrigin(0.5).setDepth(6.2);
    const r = D / 2;
    const off = n.boss ? [[-28, r + 2], [0, r + 9], [28, r + 2]] : [[-22, r - 2], [0, r + 5], [22, r - 2]];
    const stars = off.map(([dx, dy]) => this.add.image(n.x + dx!, n.y + dy!, starTex(this, this.R, false)).setScale(0.9 / this.R).setDepth(6.3).setVisible(false));
    let chest: Phaser.GameObjects.Image | undefined;
    if (n.treasure) { const cx = n.x < this.L.width / 2 ? n.x + r + 26 : n.x - r - 26; chest = this.add.image(cx, n.y - 6, chestTex(this, this.R, false)).setScale(1 / this.R).setDepth(6.4); }
    return { n, med, num, stars, chest, state: 'locked', shown: 0, r };
  }
  private nodeState(n: number): NodeState { const s = this.shown[n] ?? 0; if (s > 0) return 'done'; return n === unlockedOf(this.shown) ? 'current' : 'locked'; }
  private setNodeVisual(nv: NodeView) {
    const st = this.nodeState(nv.n.n); const stars = this.shown[nv.n.n] ?? 0;
    const color = BIOMES[nv.n.biome].palette.accent;
    nv.med.setTexture(nodeTex(this, this.R, st, color, nv.n.boss)); nv.state = st;
    nv.num.setColor(st === 'locked' ? '#d9d2f5' : '#ffffff').setStroke(st === 'locked' ? '#3a3166' : `#${darken(st === 'current' ? 0x1fa6a0 : color, 0.55).toString(16).padStart(6, '0')}`, 5);
    nv.stars.forEach((s, i) => s.setVisible(st !== 'locked').setTexture(starTex(this, this.R, i < stars)));
    nv.shown = stars;
    if (nv.chest) { const open = this.treasures.has(nv.n.n); nv.chest.setTexture(chestTex(this, this.R, open)).setAlpha(open ? 0.75 : 1); }
  }
  private syncNodes() {
    for (const nv of this.nodes) this.setNodeVisual(nv);
    for (const p of this.pulse) p.destroy(); this.pulse = [];
    if (journeyDone(this.shown)) return;
    const cur = this.nodes[unlockedOf(this.shown) - 1]!;
    for (let i = 0; i < 2; i++) {
      const k = (cur.r * 2.1) / 100 / this.R;
      const ring = this.add.image(cur.n.x, cur.n.y, pulseRingTex(this, this.R)).setDepth(5.9).setScale(k).setAlpha(0);
      this.tweens.add({ targets: ring, scale: { from: k, to: k * 1.75 }, alpha: { from: 0.9, to: 0 }, duration: 1500, delay: i * 750, repeat: -1, ease: 'Sine.easeOut' });
      this.pulse.push(ring);
    }
    const halo = this.add.image(cur.n.x, cur.n.y, glowTex(this, this.R, 0xffe9a8, 'm-glow-gold')).setDepth(5.8).setScale(cur.r / 14).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: halo, alpha: 0.25, duration: 900, yoyo: true, repeat: -1 });
    this.pulse.push(halo);
  }

  // ---------------------------------------------------------------- yol
  private progressS(st: StarMap) { if (journeyDone(st)) return this.L.finale.s; return this.L.nodes[unlockedOf(st) - 1]!.s; }
  private drawProgress(s: number) {
    this.progS = s; const L = this.L;
    for (const g of this.prog) {
      g.clear(); const y0 = g.getData('y0') as number, y1 = g.getData('y1') as number;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < L.path.length; i++) { if (L.cum[i]! > s) break; const p = L.path[i]!; if (p.y >= y0 && p.y <= y1) pts.push(p); }
      if (pts.length && pts[pts.length - 1]!.y >= y0) { const e = pointAt(L, s); if (e.y >= y0 && e.y <= y1) pts.push(e); }
      if (pts.length < 2) continue;
      for (const [w, c, a] of [[22, 0x8b6bff, 0.28], [13, 0xff9f1c, 0.9], [8, 0xffc93c, 1], [3, 0xfff3b0, 0.95]] as [number, number, number][]) {
        g.lineStyle(w, c, a); g.beginPath(); g.moveTo(pts[0]!.x, pts[0]!.y); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]!.x, pts[i]!.y); g.strokePath();
      }
    }
    // akan ışıltı: tamamlanan yol boyunca dolaşır
    this.shineT?.remove();
    if (this.shine && s > this.L.start.s + 20) {
      const o = { s: this.L.start.s }; const sh = this.shine; sh.setVisible(true);
      this.shineT = this.tweens.add({ targets: o, s, duration: Math.max(1500, s * 0.9), repeat: -1, repeatDelay: 600, onUpdate: () => { const p = pointAt(this.L, o.s); sh.setPosition(p.x, p.y); } });
    } else this.shine?.setVisible(false);
  }

  // ---------------------------------------------------------------- Odi
  private makeOdi() {
    const { color, hat } = this.opts.hero; const size = Math.round(ODI * this.R);
    heroTexture(this, 'map-odi', color, size, 'happy'); heroTexture(this, 'map-odi', color, size, 'wow');
    const shadow = this.add.image(0, ODI / 2 - 2, shadowTex(this)).setScale(0.5);
    this.odiBody = this.add.image(0, 0, 'map-odi-happy').setScale(1 / this.R);
    const parts: Phaser.GameObjects.GameObject[] = [shadow, this.odiBody];
    const hk = hat ? hatTexture(this, hat) : null; if (hk) parts.push(this.add.image(0, 0, hk).setScale(ODI / 48));
    this.odi = this.add.container(0, 0, parts).setDepth(9);
  }
  private odiAt(): { x: number; y: number } {
    if (journeyDone(this.shown)) return { x: this.L.finale.x, y: this.L.finale.y + 40 };
    const nv = this.nodes[unlockedOf(this.shown) - 1]!; return { x: nv.n.x, y: nv.n.y - nv.r * 0.55 - ODI / 2 };
  }
  private placeOdi(_animate: boolean) {
    const p = this.odiAt(); this.odi.setPosition(p.x, p.y); this.startIdle();
  }
  private startIdle() {
    this.odiIdle?.remove(); const y = this.odi.y;
    this.odiIdle = this.tweens.add({ targets: this.odi, y: y - 7, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ---------------------------------------------------------------- dönüş sahnesi
  speedUp() { if (!this.busy) return; this.speed = Math.min(6, this.speed * 2.5); this.tweens.timeScale = this.speed; this.time.timeScale = this.speed; }
  updateProgress(stars: StarMap, treasures: number[]) {
    this.opts.treasuresOpen = treasures;
    if (this.busy) { this.queue = stars; return; }
    void this.play(stars);
  }
  async play(target: StarMap) {
    const steps = planReturn(this.shown, target);
    if (!steps.length) { this.shown = { ...target }; this.opts.onSequence?.('done'); return; }
    this.busy = true; this.speed = 1; this.opts.onSequence?.('start');
    try { for (const st of steps) { if (!this.sys.isActive()) return; await this.step(st, target); } }
    finally {
      if (this.sys.isActive()) {
        this.shown = { ...target }; this.syncNodes(); this.drawProgress(this.progressS(this.shown)); this.placeOdi(false);
        this.busy = false; this.follow = null; this.tweens.timeScale = 1; this.time.timeScale = 1;
        this.opts.onSequence?.('done');
        const q = this.queue; this.queue = null; if (q) void this.play(q);
      }
    }
  }
  private async step(st: ReturnStep, target: StarMap) {
    switch (st.kind) {
      case 'stars': await this.flyStars(st.n, st.from, st.to); break;
      case 'treasure': await this.openChest(st.n); break;
      case 'walk': await this.walk(st.from, st.to, target); break;
      case 'zone': await this.riseZone(st.zone, st.from, st.to); break;
    }
  }
  private async flyStars(n: number, from: number, to: number) {
    const nv = this.nodes[n - 1]!; this.follow = null; this.focusY(nv.n.y); await wait(this, 550);
    nv.stars.forEach((s) => s.setVisible(true));
    for (let i = from; i < to; i++) {
      const slot = nv.stars[i]!; const startX = this.L.width / 2 + (i - 1) * 40, startY = this.viewTop + 40;
      const s = this.add.image(startX, startY, starTex(this, this.R, true)).setDepth(20).setScale(2.4 / this.R);
      const trail = this.add.particles(0, 0, sparkleTex(this, this.R), { follow: s, lifespan: 380, scale: { start: 0.7 / this.R, end: 0 }, frequency: 30, blendMode: Phaser.BlendModes.ADD, maxAliveParticles: 14 }).setDepth(19);
      const c = { t: 0 }; const cx = (startX + slot.x) / 2 + (i - 1) * 60, cyy = (startY + slot.y) / 2 - 40;
      this.opts.sfx?.(`star${Math.min(3, i + 1)}` as 'star1', { semitones: i * 2 });
      await new Promise<void>((res) => this.tweens.add({ targets: c, t: 1, duration: 620, ease: 'Sine.easeIn', onUpdate: () => {
        const t = c.t; s.setPosition((1 - t) ** 2 * startX + 2 * (1 - t) * t * cx + t * t * slot.x, (1 - t) ** 2 * startY + 2 * (1 - t) * t * cyy + t * t * slot.y).setScale((2.4 - 1.5 * t) / this.R).setAngle(t * 360);
      }, onComplete: () => res() }));
      trail.stop(); this.time.delayedCall(400, () => trail.destroy());
      s.destroy(); slot.setTexture(starTex(this, this.R, true)); this.tweens.add({ targets: slot, scale: { from: 1.8 / this.R, to: 0.9 / this.R }, duration: 320, ease: 'Back.Out' });
      this.burst(slot.x, slot.y, 6, 30); this.opts.haptic?.('light');
    }
    this.shown = { ...this.shown, [n]: to };
    this.setNodeVisual(nv); this.opts.sfx?.('nodePop'); this.opts.haptic?.('medium');
    this.tweens.add({ targets: nv.med, scale: { from: 1.35 / this.R, to: 1 / this.R }, duration: 420, ease: 'Back.Out' });
    this.burst(nv.n.x, nv.n.y, 12, nv.r + 30);
    // geçilen düğüm artık "mevcut" değil: nabız halkaları güncellensin (Odi henüz yürümedi)
    for (const p of this.pulse) p.destroy(); this.pulse = [];
    await wait(this, 380);
  }
  private burst(x: number, y: number, n: number, dist: number) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4; const sp = this.add.image(x, y, sparkleTex(this, this.R)).setDepth(21).setScale(0.9 / this.R).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: sp, x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist, scale: 0, alpha: 0, duration: 520 + Math.random() * 200, ease: 'Quad.easeOut', onComplete: () => sp.destroy() });
    }
  }
  private async openChest(n: number) {
    const nv = this.nodes[n - 1]!; const ch = nv.chest; if (!ch) return;
    this.focusY(nv.n.y); await wait(this, 300);
    this.opts.sfx?.('chestShake'); this.opts.haptic?.('medium');
    await new Promise<void>((res) => this.tweens.add({ targets: ch, angle: { from: -12, to: 12 }, scale: 1.25 / this.R, duration: 90, yoyo: true, repeat: 5, onComplete: () => { ch.setAngle(0); res(); } }));
    this.burst(ch.x, ch.y, 14, 50);
    this.treasures.add(n); ch.setTexture(chestTex(this, this.R, true)).setScale(1 / this.R).setAlpha(0.8);
    if (this.opts.onTreasure) { const prevT = this.tweens.timeScale; await this.opts.onTreasure(n); this.tweens.timeScale = prevT; }
  }
  private async walk(from: number, to: number | 'finale', target: StarMap) {
    const a = this.nodes[from - 1]!; const sA = a.n.s; const sB = to === 'finale' ? this.L.finale.s : this.nodes[to - 1]!.n.s;
    this.odiIdle?.remove();
    // yol parlayarak çizilir
    this.opts.sfx?.('pathDraw');
    const drawn = { s: this.progS };
    const lead = this.add.image(0, 0, glowTex(this, this.R, 0xfff3b0, 'm-glow-shine')).setScale(1.1).setBlendMode(Phaser.BlendModes.ADD).setDepth(5.2);
    this.follow = () => pointAt(this.L, drawn.s).y;
    await new Promise<void>((res) => this.tweens.add({ targets: drawn, s: sB, duration: Math.min(2600, 500 + (sB - drawn.s) * 2.2), ease: 'Sine.easeInOut', onUpdate: () => { this.drawProgress(drawn.s); const p = pointAt(this.L, drawn.s); lead.setPosition(p.x, p.y); }, onComplete: () => res() }));
    lead.destroy();
    // Odi zıplayarak yürür
    const hop = 52; const total = sB - sA; const hops = Math.max(2, Math.round(total / hop));
    const lift = (s: number) => (to === 'finale' && s >= sB - 1 ? 40 : 0);
    this.follow = () => this.odi.y;
    for (let i = 1; i <= hops; i++) {
      const s0 = sA + (total * (i - 1)) / hops, s1 = sA + (total * i) / hops; const c = { t: 0 };
      this.opts.sfx?.('odiStep', { semitones: (i % 4) });
      await new Promise<void>((res) => this.tweens.add({ targets: c, t: 1, duration: 230, onUpdate: () => {
        const p = pointAt(this.L, s0 + (s1 - s0) * c.t); const arc = Math.sin(c.t * Math.PI) * 16;
        this.odi.setPosition(p.x, p.y - ODI / 2 - 10 - arc + lift(s1) * c.t * 0);
        this.odiBody.setScale((1 + Math.sin(c.t * Math.PI) * 0.06) / this.R, (1 - Math.sin(c.t * Math.PI) * 0.04) / this.R);
      }, onComplete: () => res() }));
    }
    this.shown = { ...this.shown };
    // varış: yeni düğüm "mevcut" olur
    for (const [k, v] of Object.entries(target)) if (Number(k) < (to === 'finale' ? 99 : to)) this.shown[Number(k)] = Math.max(this.shown[Number(k)] ?? 0, v);
    this.syncNodes();
    const p = this.odiAt();
    this.odiBody.setTexture('map-odi-wow');
    await new Promise<void>((res) => this.tweens.add({ targets: this.odi, x: p.x, y: p.y, duration: 260, ease: 'Back.Out', onComplete: () => res() }));
    this.tweens.add({ targets: this.odiBody, scaleX: 1.2 / this.R, scaleY: 0.85 / this.R, duration: 90, yoyo: true });
    this.time.delayedCall(600, () => this.odiBody.setTexture('map-odi-happy'));
    this.opts.sfx?.('nodePop', { semitones: 5 }); this.opts.haptic?.('success');
    const nvTo = to === 'finale' ? null : this.nodes[to - 1]!;
    if (nvTo) { this.tweens.add({ targets: nvTo.med, scale: { from: 1.3 / this.R, to: 1 / this.R }, duration: 420, ease: 'Back.Out' }); this.burst(nvTo.n.x, nvTo.n.y, 10, nvTo.r + 26); }
    this.startIdle(); this.follow = null;
    await wait(this, 300);
  }
  private async riseZone(z: ZoneId, from: number, to: number) {
    const rv = this.regions.find((r) => r.zone.id === z); if (!rv) return;
    const zone = rv.zone; const L = this.L;
    // mürekkep, bölgenin Odi'ye en yakın noktasından yayılır
    const odiY = this.odi.y; const oy = Math.max(zone.top + 40, Math.min(zone.bottom - 40, odiY)); const ox = odiY >= zone.top && odiY <= zone.bottom ? this.odi.x : L.width / 2;
    this.follow = null; this.focusY(Math.max(zone.top + this.viewH * 0.35, Math.min(zone.bottom - this.viewH * 0.35, (zone.top + zone.bottom) / 2 * 0.5 + oy * 0.5)));
    await wait(this, 500);
    this.opts.sfx?.(from === 0 ? 'restore' : 'biomeAwaken'); this.opts.haptic?.('heavy');
    await rv.setLevel(to as 0, true, { x: ox, y: oy });
    if (this.opts.onZoneRise) { const prevT = this.tweens.timeScale; await this.opts.onZoneRise(z, from as 0, to as 0); this.tweens.timeScale = prevT; }
  }

  // ---------------------------------------------------------------- sosyal katman
  setSocial(s: MapSocial | null) {
    for (const t of this.socialTw) t.remove(); this.socialTw = [];
    for (const o of this.social) o.destroy(); this.social = [];
    if (!s) return;
    const W = this.L.width;
    // arkadaşlar: en yüksek açık bölümlerinde baş harfli balon
    const byNode = new Map<number, typeof s.friends>();
    for (const f of s.friends) { const n = Math.max(1, Math.min(this.L.nodes.length, f.highest)); byNode.set(n, [...(byNode.get(n) ?? []), f]); }
    for (const [n, fs] of byNode) {
      const nv = this.nodes[n - 1]!; const side = nv.n.x < W / 2 ? 1 : -1; const hasChest = !!nv.chest;
      fs.slice(0, 3).forEach((f, i) => {
        const x = nv.n.x - side * (nv.r + 20 + i * 18) * (hasChest ? 1 : 1) , y = nv.n.y - 30 - i * 6;
        const letter = (f.name.trim()[0] ?? '?').toLocaleUpperCase('tr-TR');
        const av = this.add.image(x, y, avatarTex(this, this.R, f.color, letter)).setScale(0.85 / this.R).setDepth(8.5 - i * 0.01).setOrigin(0.5, 0.95);
        this.social.push(av);
        this.socialTw.push(this.tweens.add({ targets: av, y: y - 5, duration: 1300 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
      });
      if (fs.length > 3) { const t = this.add.text(nv.n.x - side * (nv.r + 20 + 3 * 18), nv.n.y - 44, `+${fs.length - 3}`, { fontFamily: FONT, fontSize: '13px', fontStyle: '900', color: '#fff6e5', stroke: '#2a1660', strokeThickness: 4, resolution: this.R }).setOrigin(0.5).setDepth(8.5); this.social.push(t); }
    }
    // Bölge Savaşı: sahip olunan bölgede amblemli bayrak, hedefte dalgalanan işaret
    const perZone = new Map<ZoneId, number>();
    for (const m of s.war) {
      const rv = this.regions.find((r) => r.zone.id === m.zone); if (!rv) continue;
      const k = perZone.get(m.zone) ?? 0; perZone.set(m.zone, k + 1);
      const side = k % 2 ? -1 : 1; const x = W / 2 + side * 150, y = rv.label.y - 4 + Math.floor(k / 2) * 36;
      if (m.owned) {
        const fl = this.add.image(x, y, flagTex(this, this.R, s.teamColor ?? 0xff5c8a)).setScale(1 / this.R).setOrigin(0.18, 0.95).setDepth(8.6);
        const em = this.add.image(x + 12, y - 40, emojiTexture(this, `emj-${m.emblem}`, m.emblem, 48)).setScale(0.36).setDepth(8.7);
        this.social.push(fl, em);
        this.socialTw.push(this.tweens.add({ targets: fl, scaleX: 0.9 / this.R, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
      }
      if (m.target) {
        const tg = this.add.image(x + (m.owned ? -side * 34 : 0), y - 20, targetTex(this, this.R)).setScale(0.7 / this.R).setDepth(8.6);
        this.social.push(tg);
        this.socialTw.push(this.tweens.add({ targets: tg, angle: { from: -10, to: 10 }, scale: 0.8 / this.R, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
      }
    }
  }

  private cleanup() { for (const rv of this.regions) rv.destroy(); this.regions = []; }
}
