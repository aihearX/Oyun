/**
 * Bir harita bölgesinin canlı görünümü: parşömen arka plan + canlanma seviyesine göre sis, uyuyan/uyanan yaratıklar,
 * çiçeklenen tüyler, akıntılar, dönen/titreşen yer imleri, altın parıltı. Görünmezken animasyonlar duraklar.
 */
import Phaser from 'phaser';
import type { MapLayout, MapZone, Vitality } from './layout';
import { fiberX, KORTEX_NEURONS, NERVE_FIBERS, paintZone, rng, tono, ZONE_PLACE, zoneAccent, zoneName } from './paint';
import {
  bloomTex, creatureTex, fogTex, gearTex, glowTex, hazeTex, labelTex, lockTex, noteTex, palaceTex, pulseDotTex, ringTex, sparkleTex, spiralTex, zzzTex,
} from './sprites';

/** kilitli bölge: gri tonlu + gece moruna boyanmış (mürekkep henüz yayılmamış harita) */
const g3 = (k: number, o: number) => [0.3 * k, 0.59 * k, 0.11 * k, 0, o];
const NIGHT_MATRIX = [...g3(0.46, 16), ...g3(0.4, 10), ...g3(0.66, 38), 0, 0, 0, 1, 0];
const overlayAlpha = (v: Vitality) => (v === 0 ? 1 : v === 1 ? 0.55 : 0);
const dullTint = (v: Vitality) => (v === 0 ? 0x6f6a90 : v === 1 ? 0xb9b3d6 : 0xffffff);

export interface RegionDeps { L: MapLayout; R: number; S: number; webgl: boolean; reduced: boolean }

export class RegionView {
  readonly zone: MapZone; v: Vitality; active = true;
  readonly label: Phaser.GameObjects.Image; private lock?: Phaser.GameObjects.Image;
  private bg: Phaser.GameObjects.Image; private overlay?: Phaser.GameObjects.Image;
  private dyn: Phaser.GameObjects.Container; private land: Phaser.GameObjects.Container;
  private tw: Phaser.Tweens.Tween[] = []; private timers: Phaser.Time.TimerEvent[] = []; private emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private landObjs: Phaser.GameObjects.Image[] = [];
  private seed: number;

  constructor(private scene: Phaser.Scene, private d: RegionDeps, zone: MapZone, private idx: number, v: Vitality) {
    this.zone = zone; this.v = v; this.seed = Math.round(zone.top) + idx * 97;
    const { L, S } = d; const first = idx === 0;
    const key = `zone-${zone.id}`;
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, paintZone(L, zone, S, first));
    const base = idx * 0.1;
    this.bg = scene.add.image(0, zone.top, key).setOrigin(0, 0).setScale(1 / S).setDepth(base);
    this.land = scene.add.container(0, 0).setDepth(2 + idx * 0.01);
    this.dyn = scene.add.container(0, 0).setDepth(3 + idx * 0.01);
    this.buildLandmark();
    this.applyStatic(v);
    this.buildDynamic(v, false);
    // kavisli şerit etiket (bölge kapısı)
    this.label = scene.add.image(L.width / 2, zone.id === 'finale' ? zone.top + 46 : zone.gateY, this.labelKey(v)).setScale(1 / d.R).setDepth(7);
    this.syncLock();
  }

  private labelKey(v: Vitality) {
    const z = this.zone.id; const k = `lbl-${z}-${v}`;
    return labelTex(this.scene, this.d.R, k, zoneName(z), ZONE_PLACE[z], zoneAccent(z), v, v === 0);
  }
  private syncLock() {
    if (this.v === 0 && !this.lock) this.lock = this.scene.add.image(this.label.x, this.label.y - 30, lockTex(this.scene, this.d.R)).setScale(1 / this.d.R).setDepth(7.1);
    if (this.v > 0 && this.lock) { this.lock.destroy(); this.lock = undefined; }
  }
  /** kilitli görünüm: renkli dokudan düşük çözünürlüklü gece-mürekkebi kopyası (bir kez; FX gerektirmez, mobilde ucuz) */
  private ensureOverlay(): Phaser.GameObjects.Image {
    if (this.overlay) return this.overlay;
    const key = `${this.bg.texture.key}-night`; const k = 0.5;
    if (!this.scene.textures.exists(key)) {
      const src = this.scene.textures.get(this.bg.texture.key).getSourceImage() as HTMLCanvasElement;
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(src.width * k / this.d.S)); c.height = Math.max(1, Math.round(src.height * k / this.d.S));
      const ctx = c.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(src, 0, 0, c.width, c.height);
      const im = ctx.getImageData(0, 0, c.width, c.height); const p = im.data; const m = NIGHT_MATRIX;
      for (let i = 0; i < p.length; i += 4) { const r = p[i]!, g = p[i + 1]!, b = p[i + 2]!; p[i] = r * m[0]! + g * m[1]! + b * m[2]! + m[4]!; p[i + 1] = r * m[5]! + g * m[6]! + b * m[7]! + m[9]!; p[i + 2] = r * m[10]! + g * m[11]! + b * m[12]! + m[14]!; }
      ctx.putImageData(im, 0, 0); this.scene.textures.addCanvas(key, c);
    }
    const o = this.scene.add.image(0, this.zone.top, key).setOrigin(0, 0).setScale(1 / k).setDepth(this.bg.depth + 0.01).setVisible(this.active);
    this.overlay = o; return o;
  }
  private applyStatic(v: Vitality) {
    const a = overlayAlpha(v);
    if (a > 0) this.ensureOverlay().setAlpha(a); else if (this.overlay) { this.overlay.destroy(); this.overlay = undefined; }
    for (const o of this.landObjs) o.setTint(dullTint(v));
  }

  /** görünürlük: kamera dışındayken animasyonlar duraklar, nesneler çizilmez */
  setActive(on: boolean) {
    if (on === this.active) return; this.active = on;
    this.dyn.setVisible(on); this.land.setVisible(on); this.bg.setVisible(on); this.overlay?.setVisible(on); this.label.setVisible(on); this.lock?.setVisible(on);
    for (const t of this.tw) { if (on) t.resume(); else t.pause(); }
    for (const t of this.timers) t.paused = !on;
    for (const e of this.emitters) { if (on) e.start(); else e.stop(); }
  }

  /** canlanma seviyesini değiştir; animate: mürekkep gibi yayılan renk + çekilen sis + uyanış */
  async setLevel(v: Vitality, animate: boolean, origin?: { x: number; y: number }): Promise<void> {
    const from = this.v; if (v === from) return;
    this.v = v;
    if (!animate || this.d.reduced) { this.applyStatic(v); this.buildDynamic(v, false); this.label.setTexture(this.labelKey(v)); this.syncLock(); return; }
    const sc = this.scene; const z = this.zone; const L = this.d.L;
    const ox = origin?.x ?? L.width / 2, oy = origin?.y ?? z.bottom - 40;
    // 1) sis dağılır: dinamik katman savrulur
    const old = this.dyn; this.dyn = sc.add.container(0, 0).setDepth(old.depth);
    this.killAnims();
    old.each((o: Phaser.GameObjects.GameObject) => {
      const g = o as unknown as Phaser.GameObjects.Image;
      sc.tweens.add({ targets: g, x: g.x + (g.x < L.width / 2 ? -260 : 260), alpha: 0, duration: 900, ease: 'Cubic.easeIn' });
    });
    sc.time.delayedCall(950, () => old.destroy(true));
    // 2) renk mürekkep gibi yayılır: eski gri katman, büyüyen lekeli maskeyle silinir
    const oldA = overlayAlpha(from), newA = overlayAlpha(v);
    const prev = this.overlay; this.overlay = undefined;
    if (newA > 0) this.ensureOverlay().setAlpha(newA);
        const maxR = Math.hypot(Math.max(ox, L.width - ox), Math.max(oy - z.top, z.bottom - oy)) + 80;
    let maskG: Phaser.GameObjects.Graphics | null = null;
    if (prev && oldA > 0) {
      maskG = sc.make.graphics({}, false);
      const mask = maskG.createGeometryMask(); mask.setInvertAlpha(true); prev.setMask(mask);
      const blots = Array.from({ length: 9 }, (_, i) => { const r = rng(this.seed + i); return { dx: (r() - 0.5) * 140, dy: (r() - 0.5) * 120, k: 0.45 + r() * 0.4, d: r() * 0.25 }; });
      const prog = { t: 0 };
      sc.tweens.add({
        targets: prog, t: 1, duration: 1500, ease: 'Sine.easeIn',
        onUpdate: () => {
          const g = maskG!; g.clear(); g.fillStyle(0xffffff, 1);
          const t = prog.t; g.fillCircle(ox, oy, maxR * t);
          for (const b of blots) { const tt = Math.max(0, (t - b.d) / (1 - b.d)); g.fillCircle(ox + b.dx * (1 + tt * 3), oy + b.dy * (1 + tt * 3), maxR * b.k * tt); }
        },
        onComplete: () => { prev.clearMask(); prev.destroy(); maskG?.destroy(); },
      });
    } else prev?.destroy();
    // mürekkep halkası (yayılan ışık)
    const ring = sc.add.image(ox, oy, glowTex(sc, this.d.R, 0xffe9a8, 'm-glow-gold')).setDepth(8).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setAlpha(0.9);
    sc.tweens.add({ targets: ring, scale: maxR / 22, alpha: 0, duration: 1500, ease: 'Sine.easeOut', onComplete: () => ring.destroy() });
    for (const o of this.landObjs) { const tint = { t: 0 }; const c0 = Phaser.Display.Color.ValueToColor(dullTint(from)), c1 = Phaser.Display.Color.ValueToColor(dullTint(v)); sc.tweens.add({ targets: tint, t: 100, duration: 1200, onUpdate: () => { const c = Phaser.Display.Color.Interpolate.ColorWithColor(c0, c1, 100, tint.t); o.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b)); } }); }
    await wait(sc, 700);
    // 3) yeni yaşam: nesneler zıplayarak belirir
    this.buildDynamic(v, true);
    this.label.setTexture(this.labelKey(v)); this.syncLock();
    sc.tweens.add({ targets: this.label, scale: { from: 1.25 / this.d.R, to: 1 / this.d.R }, duration: 500, ease: 'Back.Out' });
    await wait(sc, 900);
  }

  private killAnims() {
    for (const t of this.tw) t.remove(); this.tw = [];
    for (const t of this.timers) t.remove(); this.timers = [];
    for (const e of this.emitters) e.destroy(); this.emitters = [];
  }
  private add<T extends Phaser.GameObjects.GameObject>(o: T, pop: boolean): T {
    this.dyn.add(o);
    if (pop) { const g = o as unknown as Phaser.GameObjects.Image; const s = g.scaleX; g.setScale(0); this.scene.tweens.add({ targets: g, scale: s, duration: 500, delay: Math.random() * 500, ease: 'Back.Out' }); }
    return o;
  }
  private loop(cfg: Phaser.Types.Tweens.TweenBuilderConfig) { const t = this.scene.tweens.add({ repeat: -1, ...cfg }); this.tw.push(t); if (!this.active) t.pause(); return t; }

  /** yolun bu yükseklikteki x'i: dekorlar yoldan uzak durur */
  private freeX(y: number, r: () => number): number {
    const p = this.d.L.path; let best = p[0]!; for (const q of p) if (Math.abs(q.y - y) < Math.abs(best.y - y)) best = q;
    const W = this.d.L.width;
    return best.x > W / 2 ? 26 + r() * Math.max(10, best.x - 100) : best.x + 74 + r() * Math.max(10, W - best.x - 100);
  }

  private buildLandmark() {
    const sc = this.scene, R = this.d.R, z = this.zone, L = this.d.L; const W = L.width; const h = z.bottom - z.top;
    const img = (x: number, y: number, key: string, scale = 1, res = R) => { const o = sc.add.image(x, y, key).setScale(scale / res); this.land.add(o); this.landObjs.push(o); return o; };
    switch (z.id) {
      case 'kemikcikler': {
        img(66, z.top + h * 0.8, gearTex(sc, R, 26, 0xd7c08a)); img(W - 64, z.top + h * 0.5, gearTex(sc, R, 30, 0x9fb8d8)); img(85, z.top + h * 0.17, gearTex(sc, R, 20, 0xe0b46a));
        img(W - 40, z.top + h * 0.2, gearTex(sc, R, 18, 0xbac6d6)); img(40, z.top + h * 0.48, gearTex(sc, R, 16, 0xd7c08a));
        break;
      }
      case 'koklea-1': case 'koklea-2': case 'koklea-3': {
        const lo = z.id === 'koklea-1' ? 0 : z.id === 'koklea-2' ? 0.33 : 0.66;
        const cx = z.id === 'koklea-2' ? W * 0.58 : W * 0.45;
        img(cx, z.top + h * 0.5, spiralTex(sc, R, lo, lo + 0.34), Math.min(h * 0.6, 220) / 200, Math.min(R, 2)).setAlpha(0.6);
        break;
      }
      case 'finale': {
        img(L.finale.x, L.finale.y - 40, palaceTex(sc, R), 1, Math.min(R, 2));
        break;
      }
      default: break;
    }
  }

  private buildDynamic(v: Vitality, pop: boolean) {
    const sc = this.scene, R = this.d.R, z = this.zone, L = this.d.L; const W = L.width; const h = z.bottom - z.top;
    const r = rng(this.seed * 13 + 7);
    const accent = zoneAccent(z.id);
    const dark = z.id === 'sinir' || z.id === 'beyin-sapi' || z.id === 'finale';
    // --- savaş sisi
    if (v <= 1) {
      const n = v === 0 ? Math.max(5, Math.round(h / 120)) : Math.max(2, Math.round(h / 300));
      for (let i = 0; i < n; i++) {
        const y = z.top + 40 + (i + r() * 0.6) * ((h - 40) / n) * (v === 1 ? 0.55 : 1);
        const hz = this.add(sc.add.image(r() * W, y, hazeTex(sc)).setScale(3 + r() * 2).setAlpha(v === 0 ? 0.55 : 0.3), pop);
        void hz;
        const f = this.add(sc.add.image(i % 2 ? W - 40 - r() * 120 : 40 + r() * 120, y, fogTex(sc, R, i % 2)).setScale((0.9 + r() * 0.6) / Math.min(R, 1.5)).setAlpha(v === 0 ? 0.92 : 0.6), pop);
        this.loop({ targets: f, x: f.x + (r() < 0.5 ? -24 : 24), duration: 5000 + r() * 3000, yoyo: true, ease: 'Sine.easeInOut' });
      }
      // uyuyan sakinler
      for (let i = 0; i < (v === 0 ? 2 : 1); i++) {
        const y = z.top + h * (0.3 + i * 0.4); const x = this.freeX(y, r);
        const c = this.add(sc.add.image(x, y, creatureTex(sc, R, accent, false)).setScale(1 / R).setTint(v === 0 ? 0x9a94c0 : 0xffffff), pop);
        this.loop({ targets: c, scaleY: c.scaleY * 0.93, duration: 1400, yoyo: true, ease: 'Sine.easeInOut' });
        const zz = this.add(sc.add.image(x + 14, y - 22, zzzTex(sc, R)).setScale(1 / R), false);
        this.loop({ targets: zz, y: y - 40, alpha: { from: 1, to: 0 }, duration: 2200, ease: 'Sine.easeOut' });
      }
      if (z.id === 'finale' && v === 1) this.addGlow(L.finale.x, L.finale.y - 40, 0xffd77a, 4, 0.35);
      return;
    }
    // --- seviye 2: çiçeklenme, akıntı, ses dalgası
    const bloomCol = (t: number) => (z.id.startsWith('koklea') ? tono((z.id === 'koklea-1' ? 0 : z.id === 'koklea-2' ? 0.33 : 0.66) + t * 0.33) : accent);
    const nb = Math.round(h / 90);
    for (let i = 0; i < nb; i++) {
      const y = z.top + 30 + (i + r()) * ((h - 40) / nb); const x = this.freeX(y, r);
      const b = this.add(sc.add.image(x, y, bloomTex(sc, R, bloomCol(r()))).setOrigin(0.5, 1).setScale((0.8 + r() * 0.5) / R), pop);
      this.loop({ targets: b, angle: { from: -6, to: 6 }, duration: 1600 + r() * 900, yoyo: true, ease: 'Sine.easeInOut', delay: r() * 800 });
    }
    // akıntı noktaları (yanlarda yukarı akan küçük ışıklar)
    const dot = pulseDotTex(sc, R, dark ? 0x7ff3ea : 0xffffff);
    for (let i = 0; i < 5; i++) {
      const x = i % 2 ? W - 16 - r() * 30 : 16 + r() * 30; const y0 = z.bottom - 10, y1 = z.top + 20;
      const d = this.add(sc.add.image(x, y0, dot).setScale(0.6 / Math.min(R, 2)).setAlpha(0.8).setBlendMode(Phaser.BlendModes.ADD), false);
      this.loop({ targets: d, y: y1, duration: 5200 + r() * 2000, delay: r() * 3000, onRepeat: () => d.setX(i % 2 ? W - 16 - Math.random() * 30 : 16 + Math.random() * 30) });
    }
    this.landmarkAnim(v, r);
    // uyanık sakinler
    const nc = v >= 3 ? 3 : 2;
    for (let i = 0; i < nc; i++) {
      const y = z.top + h * (0.2 + (i / nc) * 0.7); const x = this.freeX(y, r);
      const c = this.add(sc.add.image(x, y, creatureTex(sc, R, accent, true)).setScale(1 / R), pop);
      if (v >= 3) {
        const dx = (x > W / 2 ? -1 : 1) * (20 + r() * 26);
        this.loop({ targets: c, x: x + dx, duration: 2400 + r() * 1200, yoyo: true, ease: 'Sine.easeInOut', onYoyo: () => c.toggleFlipX(), onRepeat: () => c.toggleFlipX() });
        this.loop({ targets: c, y: y - 6, duration: 260, yoyo: true, ease: 'Quad.easeOut' });
      } else this.loop({ targets: c, y: y - 8, duration: 500, yoyo: true, ease: 'Quad.easeOut', repeatDelay: 1500 + r() * 2000 });
    }
    // --- seviye 4: altın parıltı, nota kelebekleri, gökkuşağı ışıkları
    if (v >= 4) {
      const em = sc.add.particles(0, 0, sparkleTex(sc, R), {
        x: { min: 10, max: W - 10 }, y: { min: z.top + 10, max: z.bottom - 10 }, lifespan: 1600, scale: { start: 0.9 / R, end: 0 }, alpha: { start: 1, end: 0 },
        frequency: 260, quantity: 1, maxAliveParticles: 10, blendMode: Phaser.BlendModes.ADD, speedY: { min: -20, max: -6 },
      });
      em.setDepth(8); this.emitters.push(em); if (!this.active) em.stop();
      for (let i = 0; i < 4; i++) {
        const nt = this.add(sc.add.image(this.freeX(z.top + h * (0.2 + i * 0.2), r), z.top + h * (0.2 + i * 0.2), noteTex(sc, R, tono(i / 3))).setScale(1 / R), pop);
        this.loop({ targets: nt, x: nt.x + (r() - 0.5) * 80, y: nt.y - 30 - r() * 30, angle: { from: -15, to: 15 }, duration: 2000 + r() * 1500, yoyo: true, ease: 'Sine.easeInOut' });
      }
      for (let i = 0; i < 3; i++) {
        const gl = this.add(sc.add.image(r() * W, z.top + h * (0.2 + i * 0.3), glowTex(sc, R)).setScale(3.2).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD), false);
        const c = { t: i / 3 };
        this.loop({ targets: c, t: c.t + 1, duration: 6000, onUpdate: () => gl.setTint(tono(c.t % 1)) });
      }
    }
  }
  private addGlow(x: number, y: number, c: number, s: number, a: number) {
    const g = this.add(this.scene.add.image(x, y, glowTex(this.scene, this.d.R)).setTint(c).setScale(s).setAlpha(a).setBlendMode(Phaser.BlendModes.ADD), false);
    this.loop({ targets: g, alpha: a * 0.4, duration: 1600, yoyo: true, ease: 'Sine.easeInOut' });
    return g;
  }

  /** bölgenin simge yapısı canlanır */
  private landmarkAnim(v: Vitality, r: () => number) {
    const sc = this.scene, R = this.d.R, z = this.zone, L = this.d.L; const W = L.width; const h = z.bottom - z.top;
    const strong = v >= 3;
    const dot = (c: number) => pulseDotTex(sc, R, c);
    switch (z.id) {
      case 'dis-kulak': {
        // denizden kepçeye gelen ses dalgaları
        const ring = ringTex(sc, R, 0xffffff);
        for (let i = 0; i < (strong ? 3 : 1); i++) {
          const o = this.add(sc.add.image(W * 0.55, z.bottom - 120, ring).setScale(0.4).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD), false);
          this.loop({ targets: o, y: z.bottom - 120 - h * 0.45, scale: 1.6, alpha: { from: 0.9, to: 0 }, duration: 3200, delay: i * 1066 });
        }
        if (strong) this.addGlow(W * 0.5, z.top + (h - 270) * 0.58, 0xffd0b8, 4.5, 0.35);
        break;
      }
      case 'kanal': {
        const ring = ringTex(sc, R, 0xffc27a);
        for (let i = 0; i < (strong ? 4 : 2); i++) {
          const o = this.add(sc.add.image(W / 2, z.bottom - 20, ring).setScale(2.1, 0.9).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD), false);
          this.loop({ targets: o, y: z.top + 30, alpha: { from: 0.7, to: 0 }, duration: 4200, delay: i * 1050 });
        }
        break;
      }
      case 'zar': {
        const cx = W / 2 + 10, cy = z.top + h * 0.48 + 6; const ring = ringTex(sc, R, 0xffffff);
        for (let i = 0; i < (strong ? 4 : 1); i++) {
          const o = this.add(sc.add.image(cx, cy, ring).setScale(0.2).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD), false);
          this.loop({ targets: o, scaleX: 3.1, scaleY: 3.6 * (h / 700), alpha: { from: 0.9, to: 0 }, duration: 2400, delay: i * 600, ease: 'Sine.easeOut' });
        }
        if (strong) { const g = this.addGlow(cx, cy, 0xffb8c8, 5, 0.3); this.loop({ targets: g, scale: 5.4, duration: 90, yoyo: true }); }
        break;
      }
      case 'kemikcikler': {
        this.landObjs.forEach((o, i) => this.loop({ targets: o, angle: (i % 2 ? -360 : 360), duration: (strong ? 5000 : 14000) * (0.8 + (i % 3) * 0.2) }));
        break;
      }
      case 'koklea-1': case 'koklea-2': case 'koklea-3': {
        const sp = this.landObjs[0];
        if (sp) { this.loop({ targets: sp, angle: -360, duration: strong ? 16000 : 40000 }); if (strong) this.loop({ targets: sp, alpha: { from: 0.55, to: 0.85 }, duration: 1200, yoyo: true }); }
        if (strong && sp) this.addGlow(sp.x, sp.y, tono(z.id === 'koklea-1' ? 0.15 : z.id === 'koklea-2' ? 0.5 : 0.85), 3.5, 0.35);
        break;
      }
      case 'sinir': {
        const n = strong ? 7 : 3;
        for (let i = 0; i < n; i++) {
          const f = NERVE_FIBERS[(i * 5) % NERVE_FIBERS.length]!;
          const o = this.add(sc.add.image(f.x, z.bottom, dot(f.c)).setScale(0.9 / Math.min(R, 2)).setBlendMode(Phaser.BlendModes.ADD), false);
          const p = { y: h }; this.loop({ targets: p, y: 0, duration: 1800 + r() * 900, delay: r() * 1500, onUpdate: () => o.setPosition(fiberX(f.x, f.amp, f.per, f.ph, p.y), z.top + p.y) });
        }
        break;
      }
      case 'beyin-sapi': {
        const n = strong ? 6 : 2;
        for (let i = 0; i < n; i++) {
          const k = i % 5; const y = 30 + k * (h / 5); const left = i % 2 === 0;
          const o = this.add(sc.add.image(0, 0, dot(left ? 0x6bd7ff : 0xff6b8b)).setScale(0.8 / Math.min(R, 2)).setBlendMode(Phaser.BlendModes.ADD), false);
          const p = { t: 0 }; this.loop({ targets: p, t: 1, duration: 2000 + r() * 800, delay: r() * 1200, onUpdate: () => {
            const t = p.t; const x0 = left ? -10 : W + 10, x3 = left ? W + 10 : -10; const x1 = left ? W * 0.35 : W * 0.65, x2 = left ? W * 0.65 : W * 0.35;
            const bx = (1 - t) ** 3 * x0 + 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3 * x3; const by = (1 - t) ** 3 * y + 3 * (1 - t) ** 2 * t * (y + 10) + 3 * (1 - t) * t * t * (y + h / 5 - 10) + t ** 3 * (y + h / 5);
            o.setPosition(bx, z.top + by);
          } });
        }
        break;
      }
      case 'korteks': {
        const ns = KORTEX_NEURONS(W, h); const n = strong ? 6 : 2;
        for (let i = 0; i < n; i++) {
          const [a, b] = ns.edges[(i * 3) % ns.edges.length]!; const p0 = ns.pts[a]!, p1 = ns.pts[b]!;
          const o = this.add(sc.add.image(p0.x, z.top + p0.y, dot(0xb69bff)).setScale(0.8 / Math.min(R, 2)).setBlendMode(Phaser.BlendModes.ADD), false);
          this.loop({ targets: o, x: p1.x, y: z.top + p1.y, duration: 1400 + r() * 600, delay: r() * 1000, ease: 'Sine.easeInOut' });
        }
        if (strong) for (const p of ns.pts.slice(0, 6)) this.addGlow(p.x, z.top + p.y, 0xc9b6ff, 1.2, 0.5);
        break;
      }
      case 'finale': {
        const g = this.addGlow(L.finale.x, L.finale.y - 40, 0xffd77a, strong ? 7 : 4, strong ? 0.6 : 0.35);
        if (strong) this.loop({ targets: g, scale: 7.6, duration: 1800, yoyo: true, ease: 'Sine.easeInOut' });
        break;
      }
    }
  }

  destroy() { this.killAnims(); this.dyn.destroy(true); this.land.destroy(true); this.bg.destroy(); this.overlay?.destroy(); this.label.destroy(); this.lock?.destroy(); }
}
export const wait = (sc: Phaser.Scene, ms: number) => new Promise<void>((res) => { sc.time.delayedCall(ms, () => res()); });
