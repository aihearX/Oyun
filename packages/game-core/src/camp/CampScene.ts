import Phaser from 'phaser';
import type { BuildingId, BuildingState, CampState } from '@odi/shared';
import { buildingCanvas, type Anchors } from './buildings';
import { BRIDGE, GROUND_BOX, ISLAND, ROADS, STREAM_PTS, onIsland, paintGround, paintSky, shoreK } from './ground';
import { BUILDING_ORDER, LOTS, depotStored, tierOf, zonesOpen } from './layout';
import { ATLAS, TEX, WORKER_COLORS, buildAtlas, makeTex, scaffold } from './props';

export interface CampTeam { emblem: string; name: string }
export interface CampSceneOpts {
  camp: CampState;
  /** sunucu saatine eşitlenmiş şimdi (ms) */
  now(): number;
  team: CampTeam | null;
  /** süren inşaat için takımdan yardım istenebilir mi (takım var ve henüz istenmedi) */
  canAskHelp: boolean;
  reducedMotion?: boolean;
  onTap(id: BuildingId): void;
  onAskHelp(id: BuildingId): void;
  onSpeedup(id: BuildingId): void;
  onCollect(): void;
  /** inşaat bitti (sahnede bitiş animasyonu oynadıktan hemen sonra) */
  onBuilt(id: BuildingId, level: number, tierUp: boolean): void;
  onReady?(): void;
}

const FONT = '"SF Pro Rounded","Segoe UI Rounded",Nunito,"Helvetica Neue",Arial,sans-serif';
const GTEX = 1.25; // zemin dokusu çözünürlüğü
/** bina ölçeği (arsayı dolduracak kadar) */
const BS: Record<BuildingId, number> = { merkez: 1.25, laboratuvar: 1.15, kule: 1.12, atolye: 1.15, depo: 1.15, revir: 1.15 };
const DEPTH = { sky: -2000, waves: -1500, ground: -1000, fog: 4000, fx: 4500, ui: 6000 };
const fmtLeft = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return h > 0 ? `${h} sa ${String(m).padStart(2, '0')} dk` : `${m}:${String(sec).padStart(2, '0')}`; };
const bez = (p: [number, number][], t: number): [number, number] => { const [a, b, c] = p as [[number, number], [number, number], [number, number]]; return [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]]; };

interface BView {
  id: BuildingId; level: number; key: string; sprite: Phaser.GameObjects.Image; anchors: Anchors;
  fx: Phaser.GameObjects.GameObject[]; tweens: Phaser.Tweens.Tween[]; timers: Phaser.Time.TimerEvent[];
  badge: Phaser.GameObjects.Container; badgeText: Phaser.GameObjects.Text; badgeImg: Phaser.GameObjects.Image;
  build?: { scaffold: Phaser.GameObjects.Image; crane?: Phaser.GameObjects.Image; dust: Phaser.GameObjects.Particles.ParticleEmitter; bubble: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Graphics; help: Phaser.GameObjects.Image; fast: Phaser.GameObjects.Image; to: number; tw: Phaser.Tweens.Tween[] };
}
interface Worker { sprite: Phaser.GameObjects.Image; hammer: Phaser.GameObjects.Image; color: number; busy: boolean; site: boolean; tw?: Phaser.Tweens.Tween; frameT: number; walking: boolean }
interface Hot { owner: string; x: () => number; y: () => number; r: number; act: () => void; visible: () => boolean }

export class CampScene extends Phaser.Scene {
  opts: CampSceneOpts;
  dpr = 1;
  userZoom = 1;
  ready = false;
  private views = new Map<BuildingId, BView>();
  private texMeta = new Map<string, { anchors: Anchors; ox: number; oy: number }>();
  private workers: Worker[] = [];
  private hots: Hot[] = [];
  private sky!: Phaser.GameObjects.Image;
  private waves!: Phaser.GameObjects.Graphics;
  private fog: { zone: number; img: Phaser.GameObjects.Image }[] = [];
  private decor: { zone: number; obj: Phaser.GameObjects.Image; shown: boolean; minMerkez?: number; maxMerkez?: number }[] = [];
  private depot?: { bubble: Phaser.GameObjects.Container; glow: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; full: boolean };
  private teamFlag?: Phaser.GameObjects.Container;
  private pointers = new Map<number, { x: number; y: number; x0: number; y0: number; t0: number }>();
  private pinch: { d: number; z: number } | null = null;
  private vel = { x: 0, y: 0 };
  private moved = 0;
  private lastTick = 0;
  private merkezLevel = 1;

  constructor(opts: CampSceneOpts) { super({ key: 'camp' }); this.opts = opts; }

  create() {
    this.dpr = (this.registry.get('dpr') as number) ?? 1;
    const cam = this.cameras.main; cam.setBackgroundColor('#1b1446'); cam.roundPixels = false;
    buildAtlas(this.textures);
    // gökyüzü (ekrana sabit)
    makeTex(this.textures, 'c-sky', 256, 512, 0, 0, (c) => paintSky(c, 256, 512), 1);
    this.sky = this.add.image(0, 0, 'c-sky').setScrollFactor(0).setDepth(DEPTH.sky);
    this.waves = this.add.graphics().setDepth(DEPTH.waves);
    // zemin
    const gb = GROUND_BOX;
    makeTex(this.textures, 'c-ground', gb.x1 - gb.x0, gb.y1 - gb.y0, -gb.x0, -gb.y0, paintGround, GTEX);
    this.add.image(gb.x0, gb.y0, 'c-ground').setOrigin(0, 0).setScale(1 / GTEX).setDepth(DEPTH.ground);
    this.placeDecor();
    this.placeFog();
    for (const id of BUILDING_ORDER) this.makeView(id, 0);
    this.ambient();
    this.applyState(this.opts.camp, true);
    this.setupInput();
    this.scale.on('resize', () => this.layout());
    this.userZoom = Phaser.Math.Clamp(Math.min(this.scale.width / this.dpr / 540, this.scale.height / this.dpr / 600), 0.5, 1.1);
    this.layout();
    cam.centerOn(0, -24);
    this.ready = true;
    this.opts.onReady?.();
  }

  // ------------------------------------------------------------------ kamera
  private layout() {
    const cam = this.cameras.main; cam.setSize(this.scale.width, this.scale.height);
    this.applyZoom();
  }
  private applyZoom() {
    const cam = this.cameras.main; cam.setZoom(this.dpr * this.userZoom);
    this.sky.setPosition(cam.width / 2, cam.height / 2).setDisplaySize(cam.width / cam.zoom + 4, cam.height / cam.zoom + 4);
    this.clampCam();
  }
  private clampCam() {
    const cam = this.cameras.main; const cx = cam.scrollX + cam.width / 2, cy = cam.scrollY + cam.height / 2;
    const nx = Phaser.Math.Clamp(cx, -ISLAND.rx * 0.8, ISLAND.rx * 0.8), ny = Phaser.Math.Clamp(cy, -ISLAND.ry * 0.85, ISLAND.ry * 0.85);
    if (nx !== cx || ny !== cy) { cam.scrollX += nx - cx; cam.scrollY += ny - cy; this.vel.x = 0; this.vel.y = 0; }
  }
  /** ekran noktası (oyun pikseli) sabit kalacak şekilde yakınlaştır */
  private zoomAt(z: number, sx: number, sy: number) {
    // dünya noktasını analitik hesapla (getWorldPoint önceki karenin matrisini kullanır; bir karede çok hareket gelebilir)
    const cam = this.cameras.main; const before = { x: cam.scrollX + cam.width / 2 + (sx - cam.width / 2) / cam.zoom, y: cam.scrollY + cam.height / 2 + (sy - cam.height / 2) / cam.zoom };
    this.userZoom = Phaser.Math.Clamp(z, 0.42, 1.8);
    cam.setZoom(this.dpr * this.userZoom);
    cam.scrollX = before.x - cam.width / 2 - (sx - cam.width / 2) / cam.zoom;
    cam.scrollY = before.y - cam.height / 2 - (sy - cam.height / 2) / cam.zoom;
    this.applyZoom();
  }
  get uiScale() { return Phaser.Math.Clamp(1 / this.userZoom, 0.8, 1.9); }

  private setupInput() {
    const inp = this.input;
    inp.addPointer(1);
    inp.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pointers.set(p.id, { x: p.x, y: p.y, x0: p.x, y0: p.y, t0: this.time.now });
      this.vel.x = 0; this.vel.y = 0;
      if (this.pointers.size === 1) this.moved = 0;
      if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()] as unknown as [{ x: number; y: number }, { x: number; y: number }]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.userZoom }; this.moved = 99; }
    });
    inp.on('pointermove', (p: Phaser.Input.Pointer) => {
      const s = this.pointers.get(p.id); if (!s) return;
      const dx = p.x - s.x, dy = p.y - s.y; s.x = p.x; s.y = p.y;
      const cam = this.cameras.main;
      if (this.pointers.size >= 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()] as unknown as [{ x: number; y: number }, { x: number; y: number }];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoomAt(this.pinch.z * (d / Math.max(1, this.pinch.d)), (a.x + b.x) / 2, (a.y + b.y) / 2);
        cam.scrollX -= dx / 2 / cam.zoom; cam.scrollY -= dy / 2 / cam.zoom;
        return;
      }
      this.moved = Math.max(this.moved, Math.hypot(p.x - s.x0, p.y - s.y0));
      if (this.moved > 6 * this.dpr) { this.restoreCam = null; cam.scrollX -= dx / cam.zoom; cam.scrollY -= dy / cam.zoom; this.vel.x = dx / cam.zoom; this.vel.y = dy / cam.zoom; this.clampCam(); }
    });
    const up = (p: Phaser.Input.Pointer) => {
      const s = this.pointers.get(p.id); this.pointers.delete(p.id);
      if (this.pointers.size < 2) this.pinch = null;
      if (this.pointers.size === 1) { const o = [...this.pointers.values()][0]!; o.x0 = o.x; o.y0 = o.y; }
      if (s && this.pointers.size === 0 && this.moved <= 8 * this.dpr && this.time.now - s.t0 < 600) { this.vel.x = 0; this.vel.y = 0; this.tap(p.x, p.y); }
    };
    inp.on('pointerup', up); inp.on('pointerupoutside', up);
    inp.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.zoomAt(this.userZoom * (dy > 0 ? 0.9 : 1.1), p.x, p.y));
  }

  private tap(sx: number, sy: number) {
    const w = this.cameras.main.getWorldPoint(sx, sy);
    for (const h of [...this.hots].reverse()) if (h.visible() && Math.hypot(w.x - h.x(), w.y - h.y()) < h.r * this.uiScale) { h.act(); return; }
    const hit = this.hitBuilding(w.x, w.y);
    if (hit) { this.bounce(hit); this.opts.onTap(hit); }
  }
  hitBuilding(wx: number, wy: number): BuildingId | null {
    const order = [...this.views.values()].sort((a, b) => b.sprite.depth - a.sprite.depth);
    for (const v of order) {
      const s = v.sprite; const tex = s.texture.getSourceImage() as HTMLCanvasElement;
      const lx = (wx - s.x) / s.scaleX + s.originX * tex.width, ly = (wy - s.y) / s.scaleY + s.originY * tex.height;
      if (lx >= 0 && ly >= 0 && lx < tex.width && ly < tex.height) { const a = this.textures.getPixelAlpha(Math.floor(lx), Math.floor(ly), v.key); if ((a ?? 0) > 20) return v.id; }
    }
    // arsa elmasına dokunuş
    for (const id of BUILDING_ORDER) { const l = LOTS[id]; const h = l.tiles * 16 + 4; if (Math.abs(wx - l.x) / (h * 2) + Math.abs(wy - l.y) / h <= 1) return id; }
    return null;
  }

  override update(time: number, delta: number) {
    const cam = this.cameras.main;
    if (this.pointers.size === 0 && (Math.abs(this.vel.x) > 0.05 || Math.abs(this.vel.y) > 0.05)) {
      cam.scrollX -= this.vel.x; cam.scrollY -= this.vel.y; const k = Math.pow(0.86, delta / 16.7); this.vel.x *= k; this.vel.y *= k; this.clampCam();
    }
    // ses dalgası halkaları adanın etrafında yayılır
    const g = this.waves; g.clear();
    for (let i = 0; i < 3; i++) {
      const t = ((time / 5200) + i / 3) % 1; const k = 1.04 + t * 0.32;
      g.lineStyle(3 - t * 2, 0x9fe8ff, (1 - t) * 0.28);
      g.beginPath(); for (let j = 0; j <= 72; j++) { const a = (j / 72) * Math.PI * 2; const s = shoreK(a) * k; const x = ISLAND.cx + Math.cos(a) * ISLAND.rx * s, y = ISLAND.cy + 30 + Math.sin(a) * ISLAND.ry * s; if (j) g.lineTo(x, y); else g.moveTo(x, y); } g.strokePath();
    }
    // arayüz ölçeği (ekranda sabit boy)
    const us = this.uiScale;
    for (const v of this.views.values()) { v.badge.setScale(us); if (v.build) { v.build.bubble.setScale(us); } }
    if (this.depot) this.depot.bubble.setScale(us);
    // işçi yürüme kareleri
    for (const w of this.workers) { if (!w.walking) continue; w.frameT += delta; if (w.frameT > 170) { w.frameT = 0; const f = w.sprite.frame.name.endsWith('-0') ? 1 : 0; w.sprite.setFrame(`c-odi-${w.color}-${f}`, false, false); } }
    if (time - this.lastTick > 250) { this.lastTick = time; this.tick(); }
  }

  /** geri sayım, ilerleme çubuğu, depo baloncuğu */
  private tick() {
    const now = this.opts.now();
    for (const v of this.views.values()) {
      const b = v.build; if (!b) continue;
      const st = this.opts.camp.buildings.find((x) => x.id === v.id);
      if (!st?.endsAt || !st.startedAt) continue;
      const left = st.endsAt - now; const total = Math.max(1, st.endsAt - st.startedAt);
      b.text.setText(left > 0 ? fmtLeft(left) : 'Bitiyor…');
      b.bar.clear(); b.bar.fillStyle(0x2d1d6e, 0.18); b.bar.fillRoundedRect(-30, -9, 60, 5, 2.5);
      b.bar.fillStyle(0x3ccf7e, 1); b.bar.fillRoundedRect(-30, -9, Math.max(5, 60 * Phaser.Math.Clamp(1 - left / total, 0, 1)), 5, 2.5);
      b.help.setVisible(this.opts.canAskHelp && left > 0);
    }
    this.updateDepot(now);
  }

  // ------------------------------------------------------------------ durum
  applyState(camp: CampState, initial = false) {
    this.opts.camp = camp;
    const merkez = camp.buildings.find((b) => b.id === 'merkez')?.level ?? 1;
    const zonesBefore = zonesOpen(this.merkezLevel); this.merkezLevel = merkez;
    for (const st of camp.buildings) {
      const v = this.views.get(st.id); if (!v) continue;
      if (st.level !== v.level) {
        const up = !initial && st.level > v.level; const from = v.level;
        if (up) this.celebrateBuilt(v, st, from); else this.setLevel(v, st.level);
      }
      this.syncBuild(v, st);
    }
    this.updateZones(zonesBefore, initial);
    this.syncWorkers();
    this.tick();
  }
  setTeam(team: CampTeam | null) { this.opts.team = team; this.refreshTeamFlag(); }
  setCanAskHelp(v: boolean) { this.opts.canAskHelp = v; this.tick(); }

  private texFor(id: BuildingId, level: number): { key: string; anchors: Anchors; ox: number; oy: number } {
    const key = `cb-${id}-${level}`;
    if (!this.textures.exists(key)) {
      const { canvas, ox, oy, anchors } = buildingCanvas(id, level, TEX);
      this.textures.addCanvas(key, canvas); this.texMeta.set(key, { anchors, ox, oy });
    }
    const m = this.texMeta.get(key)!;
    return { key, anchors: m.anchors, ox: m.ox, oy: m.oy };
  }

  private makeView(id: BuildingId, level: number) {
    const l = LOTS[id]; const t = this.texFor(id, level);
    const img = this.add.image(l.x, l.y, t.key).setScale(BS[id] / TEX).setDepth(l.y);
    const src = img.texture.getSourceImage() as HTMLCanvasElement; img.setOrigin(t.ox / src.width, t.oy / src.height);
    const badgeImg = this.add.image(0, 0, ATLAS, 'c-badge-0').setScale(1 / TEX);
    const badgeText = this.add.text(0, -1, '', { fontFamily: FONT, fontSize: '11px', fontStyle: '900', color: '#ffffff', stroke: '#2d1d6e', strokeThickness: 2.5 }).setOrigin(0.5).setResolution(this.dpr * 1.5);
    const badge = this.add.container(l.x, l.y + l.tiles * 16 + 2, [badgeImg, badgeText]).setDepth(DEPTH.ui - 10);
    const v: BView = { id, level, key: t.key, sprite: img, anchors: t.anchors, fx: [], tweens: [], timers: [], badge, badgeText, badgeImg };
    this.views.set(id, v);
    this.setLevel(v, level);
  }

  private setLevel(v: BView, level: number) {
    const t = this.texFor(v.id, level);
    v.level = level; v.key = t.key; v.anchors = t.anchors;
    v.sprite.setTexture(t.key); const src = v.sprite.texture.getSourceImage() as HTMLCanvasElement; v.sprite.setOrigin(t.ox / src.width, t.oy / src.height);
    const tier = tierOf(level);
    v.badge.setVisible(level > 0); v.badgeImg.setFrame(`c-badge-${Math.max(0, tier)}`); v.badgeText.setText(String(level));
    this.rebuildFx(v);
    if (v.id === 'merkez') this.refreshTeamFlag();
    if (v.id === 'depo') this.ensureDepot();
  }

  /** bina efektleri: dişliler, ışıklar, duman, ses dalgası, kalp, parıltı */
  private rebuildFx(v: BView) {
    for (const o of v.fx) o.destroy(); for (const t of v.tweens) t.remove(); for (const t of v.timers) t.remove();
    v.fx = []; v.tweens = []; v.timers = [];
    if (v.level <= 0) return;
    const l = LOTS[v.id]; const a = v.anchors; const tier = tierOf(v.level); const calm = !!this.opts.reducedMotion;
    const k = BS[v.id]; const at = (p: [number, number]) => [l.x + p[0] * k, l.y + p[1] * k] as const;
    for (const [gx, gy, r] of a.gears) {
      const [x, y] = at([gx, gy]);
      const g = this.add.image(x, y, ATLAS, `c-gear-${tier}`).setScale((r * k / 11) / TEX, (r * k / 11) / TEX * 0.82).setDepth(l.y + 0.5);
      v.fx.push(g); if (!calm) v.tweens.push(this.tweens.add({ targets: g, angle: 360 * (r > 6 ? 1 : -1), duration: 2600 + r * 300, repeat: -1 }));
    }
    for (const [lx, ly, c] of a.lights) {
      const [x, y] = at([lx, ly]);
      const gl = this.add.image(x, y, ATLAS, 'c-glow').setTint(c).setBlendMode(Phaser.BlendModes.ADD).setScale(0.32 / TEX * 2).setAlpha(0.75).setDepth(l.y + 0.6);
      v.fx.push(gl); if (!calm) v.tweens.push(this.tweens.add({ targets: gl, alpha: { from: 0.35, to: 0.95 }, duration: 600 + Math.random() * 900, yoyo: true, repeat: -1, delay: Math.random() * 800, ease: 'Sine.InOut' }));
    }
    for (const s of a.smoke) {
      const [x, y] = at(s);
      const em = this.add.particles(x, y, ATLAS, { frame: 'c-puff',  lifespan: 2800, speedY: { min: -20, max: -12 }, speedX: { min: 3, max: 9 }, scale: { start: 0.18, end: 0.65 }, alpha: { start: 0.55, end: 0 }, frequency: calm ? 1400 : 520, tint: [0xe8e0ff, 0xd8cff0, 0xfff0e0] }).setDepth(l.y + 0.7);
      v.fx.push(em);
    }
    if (a.wave && !calm) {
      const [x, y] = at(a.wave);
      const ev = this.time.addEvent({ delay: 1100, loop: true, callback: () => {
        const arc = this.add.image(x, y, ATLAS, 'c-arc').setTint(tier >= 3 ? 0x7df3ff : 0xfff0c0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.4 / TEX * 2).setDepth(DEPTH.fx);
        this.tweens.add({ targets: arc, scale: 2.2 / TEX * 2, x: x + 26, alpha: { from: 0.95, to: 0 }, duration: 1700, ease: 'Sine.Out', onComplete: () => arc.destroy() });
        const arc2 = this.add.image(x, y, ATLAS, 'c-arc').setFlipX(true).setTint(0xff8fb1).setBlendMode(Phaser.BlendModes.ADD).setScale(0.4 / TEX * 2).setDepth(DEPTH.fx);
        this.tweens.add({ targets: arc2, scale: 1.8 / TEX * 2, x: x - 22, alpha: { from: 0.7, to: 0 }, duration: 1600, ease: 'Sine.Out', onComplete: () => arc2.destroy() });
      } });
      v.timers.push(ev);
    }
    if (a.heart) {
      const [x, y] = at(a.heart);
      const h = this.add.image(x, y, ATLAS, 'c-heart').setScale(0.8).setDepth(l.y + 0.8);
      v.fx.push(h); if (!calm) v.tweens.push(this.tweens.add({ targets: h, y: y - 5, scale: 0.95, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
    }
    if (!calm) for (const s of a.sparkles) {
      const [x, y] = at(s);
      const sp = this.add.image(x, y, ATLAS, 'c-sparkle').setScale(0.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(l.y + 0.9).setAlpha(0);
      v.fx.push(sp); v.tweens.push(this.tweens.add({ targets: sp, alpha: { from: 0, to: 1 }, scale: { from: 0.2, to: 0.6 }, angle: 90, duration: 700, yoyo: true, repeat: -1, repeatDelay: 600 + Math.random() * 1600, delay: Math.random() * 1500 }));
    }
  }

  // ------------------------------------------------------------------ inşaat
  private syncBuild(v: BView, st: BuildingState) {
    const active = !!(st.upgradingTo && st.endsAt);
    if (!active) { if (v.build) this.removeBuild(v, false); return; }
    if (v.build && v.build.to === st.upgradingTo) return;
    if (v.build) this.removeBuild(v, false);
    const l = LOTS[v.id]; const s = v.sprite;
    const bw = v.level > 0 ? Math.min(150, s.displayWidth * 0.72) : l.tiles * 30; const bh = v.level > 0 ? Math.min(150, s.displayHeight * 0.62) : 34;
    const key = `c-scaf-${Math.round(bw / 8)}-${Math.round(bh / 8)}`;
    makeTex(this.textures, key, Math.round(bw / 8) * 8 + 8, Math.round(bh / 8) * 8 + 8, Math.round(bw / 8) * 4 + 4, Math.round(bh / 8) * 8 + 6, (c) => scaffold(c, Math.round(bw / 8) * 8, Math.round(bh / 8) * 8));
    const sc = this.add.image(l.x, l.y + l.tiles * 8, key).setOrigin(0.5, 1).setScale(1 / TEX).setDepth(l.y + 1).setAlpha(0);
    this.tweens.add({ targets: sc, alpha: 0.96, y: { from: sc.y + 10, to: sc.y }, duration: 400, ease: 'Back.Out' });
    let crane: Phaser.GameObjects.Image | undefined;
    if (v.id === 'merkez' || v.id === 'kule' || v.level >= 7) {
      crane = this.add.image(l.x + l.tiles * 18, l.y - l.tiles * 10, ATLAS, 'c-crane').setOrigin(34 / 100, 122 / 126).setScale(1 / TEX * (v.id === 'merkez' ? 1.1 : 0.85)).setDepth(l.y - l.tiles * 10);
    }
    const dust = this.add.particles(l.x, l.y + l.tiles * 6, ATLAS, { frame: 'c-puff',  lifespan: 1200, speed: { min: 8, max: 26 }, angle: { min: 190, max: 350 }, scale: { start: 0.25, end: 0.8 }, alpha: { start: 0.55, end: 0 }, tint: [0xe9d3b0, 0xd9c09a], frequency: this.opts.reducedMotion ? 1800 : 520, emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-bw / 2, -6, bw, 8), quantity: 1 } as never }).setDepth(l.y + 2);
    // geri sayım baloncuğu + yardım + hızlandırıcı
    const topY = s.y - s.originY * s.displayHeight;
    const bg = this.add.image(0, 0, ATLAS, 'c-bubble').setScale(1 / TEX).setOrigin(0.5, 1);
    const text = this.add.text(0, -24, '', { fontFamily: FONT, fontSize: '14px', fontStyle: '900', color: '#2d1d6e' }).setOrigin(0.5, 0.5).setResolution(this.dpr * 1.5);
    const bar = this.add.graphics();
    const help = this.add.image(-50, -16, ATLAS, 'c-btn-help').setScale(1 / TEX);
    const fast = this.add.image(50, -16, ATLAS, 'c-btn-fast').setScale(1 / TEX);
    const bubble = this.add.container(l.x, Math.min(topY, l.y - 40) - 6, [bg, bar, text, help, fast]).setDepth(DEPTH.ui);
    const tw = [
      this.tweens.add({ targets: help, scale: { from: 1 / TEX, to: 1.15 / TEX }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' }),
      this.tweens.add({ targets: crane ?? sc, angle: crane ? { from: -4, to: 5 } : 0, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.InOut' }),
    ];
    bubble.setScale(0.2); this.tweens.add({ targets: bubble, scale: this.uiScale, duration: 350, ease: 'Back.Out' });
    v.build = { scaffold: sc, crane, dust, bubble, text, bar, help, fast, to: st.upgradingTo!, tw };
    const id = v.id;
    const owner = `build:${id}`;
    this.hots.push({ owner, x: () => bubble.x - 50 * this.uiScale, y: () => bubble.y - 16 * this.uiScale, r: 18, act: () => this.opts.onAskHelp(id), visible: () => help.visible });
    this.hots.push({ owner, x: () => bubble.x + 50 * this.uiScale, y: () => bubble.y - 16 * this.uiScale, r: 18, act: () => this.opts.onSpeedup(id), visible: () => true });
    this.hots.push({ owner, x: () => bubble.x, y: () => bubble.y - 18 * this.uiScale, r: 30, act: () => { this.bounce(id); this.opts.onTap(id); }, visible: () => true });
    this.syncWorkers();
  }
  private removeBuild(v: BView, animate: boolean) {
    const b = v.build; if (!b) return; v.build = undefined;
    this.hots = this.hots.filter((h) => h.owner !== `build:${v.id}`);
    for (const t of b.tw) t.remove();
    b.dust.stop(); this.time.delayedCall(1300, () => b.dust.destroy());
    if (animate) {
      this.tweens.add({ targets: b.scaffold, y: b.scaffold.y + 28, alpha: 0, angle: 6, duration: 520, ease: 'Quad.In', onComplete: () => b.scaffold.destroy() });
      if (b.crane) this.tweens.add({ targets: b.crane, alpha: 0, y: b.crane.y + 20, duration: 600, onComplete: () => b.crane?.destroy() });
      this.tweens.add({ targets: b.bubble, scale: 0, alpha: 0, duration: 250, onComplete: () => b.bubble.destroy() });
    } else { b.scaffold.destroy(); b.crane?.destroy(); b.bubble.destroy(); }
    this.syncWorkers();
  }

  /** inşaat bitti: iskele düşer, bina "pop" ile büyür, ışık patlaması, konfeti */
  private celebrateBuilt(v: BView, st: BuildingState, from: number) {
    const tierUp = tierOf(from) !== tierOf(st.level);
    this.removeBuild(v, true);
    const l = LOTS[v.id];
    this.time.delayedCall(380, () => {
      this.setLevel(v, st.level);
      const s = v.sprite; const sx = BS[v.id] / TEX;
      s.setScale(sx * 0.55, sx * 0.4);
      this.tweens.add({ targets: s, scaleX: sx, scaleY: sx, duration: 700, ease: 'Elastic.Out', easeParams: [1.1, 0.5] });
      const cy = s.y - s.originY * s.displayHeight * 0.5;
      const glow = this.add.image(l.x, cy, ATLAS, 'c-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0b0).setScale(0.5).setDepth(DEPTH.fx);
      this.tweens.add({ targets: glow, scale: tierUp ? 6 : 4, alpha: { from: 1, to: 0 }, duration: 900, ease: 'Cubic.Out', onComplete: () => glow.destroy() });
      const rays = this.add.image(l.x, cy, ATLAS, 'c-rays').setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setDepth(DEPTH.fx);
      this.tweens.add({ targets: rays, scale: tierUp ? 1.6 : 1.1, angle: 60, alpha: { from: 1, to: 0 }, duration: 1300, ease: 'Cubic.Out', onComplete: () => rays.destroy() });
      const conf = this.add.particles(l.x, cy, ATLAS, { frame: 'c-confetti',  speed: { min: 80, max: tierUp ? 260 : 180 }, angle: { min: 200, max: 340 }, gravityY: 260, lifespan: 1600, rotate: { min: 0, max: 360 }, scale: { start: 1.2, end: 0.6 }, alpha: { start: 1, end: 0 }, tint: [0xffc93c, 0xff5c8a, 0x2ee6d6, 0x8ef0b0, 0x8b6bff], emitting: false }).setDepth(DEPTH.fx);
      conf.explode(tierUp ? 90 : 45); this.time.delayedCall(1800, () => conf.destroy());
      v.badge.setScale(0); this.tweens.add({ targets: v.badge, scale: this.uiScale * 1.4, duration: 300, yoyo: true, hold: 300, ease: 'Back.Out', onComplete: () => v.badge.setScale(this.uiScale) });
      this.floatText(l.x, cy - 30, `Sv ${st.level}!`, '#ffc93c', tierUp ? 26 : 20);
      if (tierUp) { const cam = this.cameras.main; cam.shake(220, 0.004); for (let i = 0; i < 3; i++) this.time.delayedCall(250 + i * 260, () => this.firework(l.x + (i - 1) * 60, cy - 70 - i * 10)); }
      this.opts.onBuilt(v.id, st.level, tierUp);
    });
  }
  private firework(x: number, y: number) {
    const p = this.add.particles(x, y, ATLAS, { frame: 'c-sparkle',  speed: { min: 60, max: 150 }, lifespan: 900, scale: { start: 0.5, end: 0 }, gravityY: 90, blendMode: 'ADD', tint: [0xffc93c, 0xff5c8a, 0x2ee6d6, 0xffffff][Math.floor(Math.random() * 4)], emitting: false }).setDepth(DEPTH.fx);
    p.explode(28); this.time.delayedCall(1000, () => p.destroy());
  }
  private floatText(x: number, y: number, s: string, color: string, size = 18) {
    const t = this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: '900', color, stroke: '#2d1d6e', strokeThickness: 5 }).setOrigin(0.5).setResolution(this.dpr * 1.5).setDepth(DEPTH.ui + 5).setScale(this.uiScale * 0.4);
    this.tweens.add({ targets: t, scale: this.uiScale, duration: 300, ease: 'Back.Out' });
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, delay: 900, duration: 800, onComplete: () => t.destroy() });
  }

  /** takım arkadaşı yardım etti: kalpler/eller uçar, süre kısalır */
  helped(id: BuildingId, seconds: number) {
    const v = this.views.get(id); if (!v) return;
    const b = v.build; const tx = b ? b.bubble.x : LOTS[id].x, ty = b ? b.bubble.y - 18 * this.uiScale : LOTS[id].y - 60;
    const cam = this.cameras.main; const wv = cam.worldView;
    for (let i = 0; i < 7; i++) {
      const sx = Phaser.Math.Between(0, 1) ? wv.x - 10 : wv.right + 10, sy = wv.y + wv.height * (0.3 + Math.random() * 0.5);
      const img = this.add.image(sx, sy, ATLAS, i % 2 ? 'c-hand' : 'c-heart').setDepth(DEPTH.ui + 3).setScale(this.uiScale * 0.9);
      this.tweens.add({ targets: img, x: tx + (Math.random() - 0.5) * 30, y: ty, duration: 700 + i * 90, ease: 'Cubic.In', onComplete: () => { img.destroy(); if (b?.bubble.active) { this.tweens.add({ targets: b.bubble, scale: this.uiScale * 1.15, duration: 90, yoyo: true }); } } });
      this.tweens.add({ targets: img, angle: { from: -20, to: 20 }, duration: 200, yoyo: true, repeat: 3 });
    }
    this.time.delayedCall(900, () => this.floatText(tx, ty - 26 * this.uiScale, `−${seconds >= 60 ? `${Math.round(seconds / 60)} dk` : `${seconds} sn`}`, '#8ef0b0', 18));
  }

  // ------------------------------------------------------------------ depo
  private ensureDepot() {
    const v = this.views.get('depo'); if (!v) return;
    if (this.depot) { this.depot.bubble.destroy(); this.depot.glow.destroy(); this.depot = undefined; }
    this.hots = this.hots.filter((h) => h.owner !== 'depot');
    if (v.level <= 0) return;
    const l = LOTS.depo; const s = v.sprite; const topY = s.y - s.originY * s.displayHeight;
    const bg = this.add.image(0, 0, ATLAS, 'c-bubble-s').setScale(1 / TEX).setOrigin(0.5, 1);
    const coin = this.add.image(0, -18, ATLAS, 'c-coin').setScale(1 / TEX * 1.1);
    const label = this.add.text(0, -40, 'DOLU', { fontFamily: FONT, fontSize: '11px', fontStyle: '900', color: '#ffffff', backgroundColor: '#ff5c8a', padding: { x: 4, y: 1 } }).setOrigin(0.5).setResolution(this.dpr * 1.5).setVisible(false);
    const bubble = this.add.container(l.x + 6, topY - 4, [bg, coin, label]).setDepth(DEPTH.ui).setVisible(false);
    if (!this.opts.reducedMotion) this.tweens.add({ targets: bubble, y: topY - 10, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const cp = v.anchors.coins ?? [20, 10];
    const glow = this.add.image(l.x + cp[0] * BS.depo, l.y + cp[1] * BS.depo, ATLAS, 'c-glow').setTint(0xffc93c).setBlendMode(Phaser.BlendModes.ADD).setScale(0.7).setDepth(l.y + 0.9).setVisible(false);
    this.tweens.add({ targets: glow, alpha: { from: 0.4, to: 1 }, scale: { from: 0.6, to: 0.85 }, duration: 800, yoyo: true, repeat: -1 });
    this.depot = { bubble, glow, label, full: false };
    this.hots.push({ owner: 'depot', x: () => bubble.x, y: () => bubble.y - 16 * this.uiScale, r: 22, act: () => this.opts.onCollect(), visible: () => bubble.visible });
    this.updateDepot(this.opts.now());
  }
  private updateDepot(now: number) {
    const d = this.depot; if (!d) return;
    const v = this.views.get('depo')!; const st = depotStored(v.level, this.opts.camp.depotStoredAt, now);
    const show = st.stored >= Math.max(1, st.max * 0.1) && !v.build;
    d.bubble.setVisible(show); d.glow.setVisible(st.ratio >= 0.5); d.full = st.ratio >= 1; d.label.setVisible(d.full);
  }
  /** toplandı: jetonlar depodan fışkırır */
  collected(amount: number) {
    const v = this.views.get('depo'); if (!v || amount <= 0) return;
    const l = LOTS.depo; const x = l.x, y = l.y - 30;
    const n = Math.min(18, 6 + Math.round(amount / 40));
    for (let i = 0; i < n; i++) {
      const c = this.add.image(x + (Math.random() - 0.5) * 30, y, ATLAS, 'c-coin').setScale(1 / TEX * 1.2).setDepth(DEPTH.fx);
      this.tweens.add({ targets: c, y: y - 50 - Math.random() * 40, x: c.x + (Math.random() - 0.5) * 60, duration: 420, ease: 'Quad.Out', delay: i * 25, onComplete: () => this.tweens.add({ targets: c, alpha: 0, y: c.y - 30, duration: 380, onComplete: () => c.destroy() }) });
    }
    this.floatText(x, y - 40, `+${amount}`, '#ffc93c', 20);
    this.updateDepot(this.opts.now());
  }

  // ------------------------------------------------------------------ takım bayrağı
  private refreshTeamFlag() {
    this.teamFlag?.destroy(); this.teamFlag = undefined;
    const v = this.views.get('merkez'); const team = this.opts.team;
    if (!v || !team || v.level <= 0) return;
    const l = LOTS.merkez;
    const pole = this.add.graphics();
    pole.fillStyle(0x2d1d6e, 0.35); pole.fillEllipse(3, 0, 16, 6);
    pole.fillStyle(0x8a8274, 1); pole.fillRect(-4, -4, 8, 4); pole.fillStyle(0x5b3a24, 1); pole.fillRect(-1.3, -78, 2.6, 75); pole.fillStyle(0xffc93c, 1); pole.fillCircle(0, -79, 3);
    const cloth = this.add.graphics();
    cloth.fillStyle(0x6c4cf1, 1); cloth.beginPath(); cloth.moveTo(1, -76); cloth.lineTo(38, -73); cloth.lineTo(34, -61); cloth.lineTo(38, -49); cloth.lineTo(1, -52); cloth.closePath(); cloth.fillPath();
    cloth.fillStyle(0x8b6bff, 1); cloth.fillRect(1, -76, 34, 4); cloth.lineStyle(1.4, 0xffc93c, 1); cloth.strokePath();
    const em = this.add.text(17, -63, team.emblem, { fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif', fontSize: '15px' }).setOrigin(0.5).setResolution(this.dpr * 1.5);
    const c = this.add.container(l.x - 128, l.y + 40, [pole, cloth, em]).setDepth(l.y + 40);
    if (!this.opts.reducedMotion) this.tweens.add({ targets: [cloth, em], scaleX: { from: 1, to: 0.82 }, scaleY: { from: 1, to: 1.04 }, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.teamFlag = c;
  }

  // ------------------------------------------------------------------ süsler ve sis
  private placeDecor() {
    const r = Phaser.Math.RND; r.sow(['kulak-kampi']);
    const busy = (x: number, y: number, pad = 0) => {
      if ((x / 180) ** 2 + ((y - 4) / 92) ** 2 < 1) return true;
      for (const id of BUILDING_ORDER) { const l = LOTS[id]; const h = l.tiles * 16 + 14 + pad; if (Math.abs(x - l.x) / (h * 2) + Math.abs(y - (l.y - 10)) / (h * 1.2) <= 1) return true; }
      for (const road of ROADS) for (let t = 0; t <= 1; t += 0.05) { const [px, py] = bez(road, t); if (Math.hypot(x - px, (y - py) * 2) < 26) return true; }
      for (let i = 0; i < STREAM_PTS.length; i += 2) { const [px, py] = STREAM_PTS[i]!; if (Math.hypot(x - px, (y - py) * 1.6) < 22) return true; }
      return false;
    };
    const zoneOf = (x: number, y: number) => { const dx = x / ISLAND.rx, dy = (y - ISLAND.cy) / ISLAND.ry; const rr = Math.hypot(dx, dy); if (rr < 0.6) return 0; const a = Math.atan2(dy, dx); if (a > Math.PI * 0.28 && a < Math.PI * 0.72) return 0; if (Math.abs(a) >= Math.PI * 0.72) return 1; if (a >= -Math.PI * 0.4 && a <= Math.PI * 0.28) return 2; if (a < -Math.PI * 0.4 && a > -Math.PI * 0.72) return 4; return 3; };
    const add = (key: string, x: number, y: number, zone: number, scale = 1, minMerkez?: number, maxMerkez?: number) => {
      const img = this.add.image(x, y, ATLAS, key).setScale(scale / TEX).setDepth(y);
      this.decor.push({ zone, obj: img, shown: true, minMerkez, maxMerkez });
    };
    const keys = { tree: [0, 1, 2, 3, 4].map((i) => `c-tree-${i}`), hair: [0, 1, 2, 3].map((i) => `c-hair-${i}`), pine: ['c-pine-0', 'c-pine-1'], flower: [0, 1, 2, 3].map((i) => `c-flower-${i}`), rock: ['c-rock-0', 'c-rock-1'], bush: ['c-bush-0', 'c-bush-1'] };
    const pick = <T,>(a: T[]) => a[Math.floor(r.frac() * a.length)]!;
    // ağaç ve çiçek saçılımı
    for (let i = 0; i < 520; i++) {
      const x = (r.frac() - 0.5) * 2 * ISLAND.rx, y = ISLAND.cy + (r.frac() - 0.5) * 2 * ISLAND.ry;
      if (!onIsland(x, y, 0.94) || busy(x, y)) continue;
      const dx = x / ISLAND.rx, dy = (y - ISLAND.cy) / ISLAND.ry; const rr = Math.hypot(dx, dy);
      const z = zoneOf(x, y);
      const roll = r.frac();
      let key: string;
      if (rr > 0.72 && roll < 0.55) key = pick(roll < 0.2 ? keys.pine : roll < 0.38 ? keys.hair : keys.tree);
      else if (rr > 0.55 && roll < 0.3) key = pick(r.frac() < 0.4 ? keys.hair : keys.tree);
      else if (roll < 0.62) key = pick(keys.flower);
      else if (roll < 0.74) key = pick(keys.bush);
      else if (roll < 0.8) key = pick(keys.rock);
      else continue;
      if (dy < -0.62 && Math.abs(dx) > 0.15 && key.startsWith('c-flower')) continue;
      add(key, x, y, z, key.startsWith('c-tree') || key.startsWith('c-hair') ? 0.9 + r.frac() * 0.35 : 1);
    }
    // merkez seviyesine bağlı süsler: yol fenerleri (4+), meydan çiti (7+), heykel (7+), çeşme (10+), altın (13+)
    const pool = (x: number, y: number, minMerkez: number) => { const g = this.add.image(x, y, ATLAS, 'c-glow').setTint(0xffb84a).setBlendMode(Phaser.BlendModes.ADD).setScale(1.1, 0.55).setAlpha(0.35).setDepth(DEPTH.ground + 1); this.decor.push({ zone: 0, obj: g, shown: true, minMerkez }); };
    ROADS.forEach((road) => { for (const t of [0.42, 0.8]) { const [px, py] = bez(road, t); add('c-lamp', px + 15, py - 2, 0, 1, 4, 12); add('c-lamp-g', px + 15, py - 2, 0, 1, 13); pool(px + 17, py, 4); } });
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; if (Math.sin(a) > 0.55 && Math.abs(Math.cos(a)) < 0.45) continue; const x = Math.cos(a) * 176, y = 4 + Math.sin(a) * 90; if (ROADS.some((rd) => Math.hypot(rd[1]![0] * 0.6 - x, rd[1]![1] * 0.6 - y) < 34)) continue; const axis = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) * 1.6 ? 'v' : 'u'; add(`c-fence-${axis}`, x, y, 0, 0.9, 7, 12); add(`c-fence-${axis}-g`, x, y, 0, 0.9, 13); }
    add('c-statue', 128, 120, 0, 1, 7, 12); add('c-statue-g', 128, 120, 0, 1, 13);
    add('c-fountain', -128, 116, 0, 1, 10, 12); add('c-fountain-g', -128, 116, 0, 1, 13);
    // bölge süsleri (sis kalkınca görünür)
    add('c-statue', -360, -200, 3, 1.1); add('c-fountain-g', 360, -210, 4, 1.1); add('c-statue-g', 440, -150, 4, 1);
    add('c-bridge', BRIDGE[0], BRIDGE[1] + 6, zoneOf(BRIDGE[0], BRIDGE[1]), 1);
    add('c-pier', -40, 300, 0, 1);
  }
  private placeFog() {
    const r = Phaser.Math.RND; r.sow(['sis']);
    const zones: [number, number, number][] = [[1, Math.PI * 0.78, Math.PI * 1.22], [2, -Math.PI * 0.36, Math.PI * 0.26], [3, Math.PI * 1.28, Math.PI * 1.6], [4, Math.PI * 1.6, Math.PI * 1.86]];
    for (const [zone, a0, a1] of zones) {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = a0 + (a1 - a0) * (i / (n - 1)) + (r.frac() - 0.5) * 0.08;
        for (const k of [0.78, 0.93]) {
          const s = shoreK(a) * k; const x = Math.cos(a) * ISLAND.rx * s, y = ISLAND.cy + Math.sin(a) * ISLAND.ry * s + 8;
          const img = this.add.image(x, y, ATLAS, `c-cloud-${Math.floor(r.frac() * 4)}`).setScale((0.8 + r.frac() * 0.35) / TEX).setDepth(y + 30).setAlpha(0.86);
          if (!this.opts.reducedMotion) this.tweens.add({ targets: img, x: x + 14, duration: 4000 + r.frac() * 3000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
          this.fog.push({ zone, img });
        }
      }
    }
  }
  private updateZones(before: number, initial: boolean) {
    const open = zonesOpen(this.merkezLevel);
    for (const f of this.fog) {
      const should = f.zone >= open;
      if (f.img.visible && !should) { if (initial) f.img.setVisible(false); else this.tweens.add({ targets: f.img, alpha: 0, scale: f.img.scale * 1.6, y: f.img.y - 30, duration: 1400 + Math.random() * 600, ease: 'Sine.In', onComplete: () => f.img.setVisible(false) }); }
      else if (!f.img.visible && should) f.img.setVisible(true).setAlpha(0.86);
    }
    for (const d of this.decor) {
      const show = d.zone < Math.max(1, open) && (d.minMerkez == null || this.merkezLevel >= d.minMerkez) && (d.maxMerkez == null || this.merkezLevel <= d.maxMerkez);
      if (show === d.shown) continue;
      d.shown = show;
      if (show && !initial && open > before && d.obj.blendMode !== Phaser.BlendModes.ADD) { const sc = d.obj.scaleX; d.obj.setVisible(true).setScale(0); this.tweens.add({ targets: d.obj, scale: sc, duration: 500, delay: 600 + Math.random() * 900, ease: 'Back.Out' }); }
      else d.obj.setVisible(show);
    }
  }

  // ------------------------------------------------------------------ yaşam: işçiler, notalar, ateşböcekleri
  private ambient() {
    const calm = !!this.opts.reducedMotion;
    if (!calm) {
      this.time.addEvent({ delay: 2300, loop: true, callback: () => {
        const v = this.views.get(Math.random() < 0.5 ? 'kule' : 'merkez'); if (!v || v.level <= 0) return;
        const s = v.sprite; const x = s.x + (Math.random() - 0.5) * 30, y = s.y - s.originY * s.displayHeight * 0.8;
        const n = this.add.image(x, y, ATLAS, `c-note-${Math.floor(Math.random() * 4)}`).setScale(0.55).setDepth(DEPTH.fx).setAlpha(0);
        this.tweens.add({ targets: n, y: y - 70, alpha: { from: 1, to: 0 }, duration: 3200, ease: 'Sine.Out', onComplete: () => n.destroy() });
        this.tweens.add({ targets: n, x: x + 16, duration: 800, yoyo: true, repeat: 2, ease: 'Sine.InOut' });
      } });
      for (let i = 0; i < 16; i++) {
        let x = 0, y = 0; for (let k = 0; k < 20; k++) { x = (Math.random() - 0.5) * ISLAND.rx * 1.6; y = (Math.random() - 0.5) * ISLAND.ry * 1.6; if (onIsland(x, y, 0.85)) break; }
        const f = this.add.image(x, y, ATLAS, 'c-firefly').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fx - 1).setScale(0.9);
        this.tweens.add({ targets: f, x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 40 - 10, duration: 3000 + Math.random() * 3000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        this.tweens.add({ targets: f, alpha: { from: 0.1, to: 1 }, duration: 700 + Math.random() * 900, yoyo: true, repeat: -1, delay: Math.random() * 1000 });
      }
    }
  }
  private syncWorkers() {
    const want = Math.min(6, 2 + Math.floor(this.merkezLevel / 4));
    while (this.workers.length < want) {
      const i = this.workers.length; const color = i % WORKER_COLORS.length;
      const [x, y] = bez(ROADS[i % ROADS.length]!, 0.3 + Math.random() * 0.4);
      const sprite = this.add.image(x, y, ATLAS, `c-odi-${color}-0`).setOrigin(0.5, 0.9).setScale(1 / TEX * 1.25).setDepth(y);
      const hammer = this.add.image(x, y, ATLAS, 'c-hammer').setOrigin(0.5, 0.9).setScale(1 / TEX * 1.25).setVisible(false);
      const w: Worker = { sprite, hammer, color, busy: false, site: false, frameT: 0, walking: false };
      this.workers.push(w);
      this.time.delayedCall(300 + i * 500, () => this.nextWalk(w));
    }
    const site = [...this.views.values()].find((v) => v.build);
    this.workers.forEach((w, i) => { const should = !!site && i < 2; if (should !== w.site) { w.site = should; w.tw?.stop(); this.nextWalk(w); } });
  }
  private walkTo(w: Worker, x: number, y: number, then: () => void) {
    const s = w.sprite; const d = Math.hypot(x - s.x, (y - s.y) * 2);
    s.setFlipX(x < s.x); w.walking = true; w.hammer.setVisible(false);
    w.tw = this.tweens.add({ targets: s, x, y, duration: Math.max(200, d * 45), ease: 'Linear', onUpdate: () => s.setDepth(s.y), onComplete: () => { w.walking = false; s.setFrame(`c-odi-${w.color}-0`, false, false); then(); } });
  }
  private nextWalk(w: Worker) {
    if (!w.sprite.active) return;
    const site = [...this.views.values()].find((v) => v.build);
    if (w.site && site) {
      const l = LOTS[site.id]; const side = this.workers.indexOf(w) === 0 ? -1 : 1;
      const x = l.x + side * (l.tiles * 20), y = l.y + l.tiles * 11;
      this.walkTo(w, x, y, () => this.hammerLoop(w, side));
      return;
    }
    const road = ROADS[Math.floor(Math.random() * ROADS.length)]!;
    const [x, y] = bez(road, 0.2 + Math.random() * 0.75);
    this.walkTo(w, x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 4, () => { w.tw = this.tweens.add({ targets: w.sprite, scaleY: w.sprite.scaleY * 0.94, duration: 300, yoyo: true, repeat: 2, onComplete: () => this.nextWalk(w) }); });
  }
  private hammerLoop(w: Worker, side: number) {
    const s = w.sprite; s.setFlipX(side > 0);
    w.hammer.setVisible(true).setPosition(s.x + (side > 0 ? -6 : 6), s.y - 6).setDepth(s.depth + 0.1).setFlipX(side > 0).setAngle(side > 0 ? 30 : -30);
    w.tw = this.tweens.add({ targets: w.hammer, angle: side > 0 ? -50 : 50, duration: 180, yoyo: true, repeat: -1, repeatDelay: 220,
      onRepeat: () => { if (Math.random() < 0.5 && !this.opts.reducedMotion) { const p = this.add.image(w.hammer.x + (side > 0 ? -6 : 6), s.y - 2, ATLAS, 'c-puff').setScale(0.2).setDepth(s.depth + 0.2).setAlpha(0.7); this.tweens.add({ targets: p, scale: 0.5, alpha: 0, y: p.y - 6, duration: 500, onComplete: () => p.destroy() }); } } });
    this.tweens.add({ targets: s, scaleY: { from: s.scaleY, to: s.scaleY * 0.92 }, duration: 180, yoyo: true, repeat: -1, repeatDelay: 220 });
  }

  // ------------------------------------------------------------------ dış yardımcılar
  bounce(id: BuildingId) {
    const v = this.views.get(id); if (!v) return; const s = v.sprite; const sx = BS[id] / TEX;
    this.tweens.killTweensOf(s); s.setScale(sx);
    this.tweens.add({ targets: s, scaleX: sx * 1.06, scaleY: sx * 0.93, duration: 90, yoyo: true, ease: 'Quad.Out', onComplete: () => this.tweens.add({ targets: s, scaleY: sx * 1.04, duration: 110, yoyo: true }) });
    const gl = this.add.image(s.x, s.y - 4, ATLAS, 'c-ring').setScale(0.3 * (LOTS[id].tiles / 2)).setTint(0xffc93c).setBlendMode(Phaser.BlendModes.ADD).setDepth(s.depth - 0.5);
    this.tweens.add({ targets: gl, scale: 0.9 * (LOTS[id].tiles / 2), alpha: { from: 1, to: 0 }, duration: 500, onComplete: () => gl.destroy() });
  }
  /** binanın tepe noktası: oyun pikseli (kanvas içi) */
  screenPoint(id: BuildingId): { x: number; y: number } | null {
    const v = this.views.get(id); if (!v) return null; const cam = this.cameras.main; const s = v.sprite;
    const wy = s.y - s.originY * s.displayHeight * 0.6;
    return { x: (s.x - cam.worldView.x) * cam.zoom, y: (wy - cam.worldView.y) * cam.zoom };
  }
  /** binaya kaydır; above: alttan açılan panel için binayı ekranın üst kısmına al */
  private restoreCam: { x: number; y: number } | null = null;
  focus(id: BuildingId, above = false) {
    const l = LOTS[id]; const cam = this.cameras.main; const v = this.views.get(id);
    if (above && !this.restoreCam) this.restoreCam = { x: cam.midPoint.x, y: cam.midPoint.y };
    const midY = v ? v.sprite.y - v.sprite.originY * v.sprite.displayHeight * 0.5 : l.y - 30;
    const viewH = cam.height / cam.zoom;
    cam.pan(l.x, above ? midY + viewH * 0.2 : midY, 450, 'Sine.easeInOut');
  }
  unfocus() {
    const r = this.restoreCam; this.restoreCam = null; if (!r) return;
    this.cameras.main.pan(r.x, r.y, 400, 'Sine.easeInOut');
  }
}
