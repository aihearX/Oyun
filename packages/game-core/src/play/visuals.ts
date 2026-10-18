import Phaser from 'phaser';
import type { Entity } from '@odi/shared';
import { GAME_W, GROUND_Y } from '@odi/shared';
import type { BiomeDef } from '@odi/content';
import * as RD from '../render';
import { luckyNoteTexture } from '../art';
import { FONT } from '../ui';

/**
 * ============================================================================================
 *  GÖRSEL SEAM'LER (docs/11 §7) — oynanış motoru TÜM çizimi yalnızca bu dosyadaki işlevlerle yapar.
 *  Uygulama: görsel ekibin `render/**` modülü (biyom ressamı, zemin, öğe/düşman, Odi, efekt, HUD).
 *  LevelScene başka çizim çağırmaz; görünüm değişecekse yalnızca bu dosya (ya da render/**) değişir.
 *
 *  paintBiome(scene, biome, worldW, worldH, quality?): BiomeBackdrop   — her kare backdrop.update(cam)
 *  makeTerrain(scene, rects: TerrainRect[], biome): TerrainLayer       — durağan katı zeminler (toptan); cull(L, R) ekran dışını gizler
 *  drawEntity(scene, e: Entity, biome): EntityView | null              — diğer her varlık; motor her kare view.update(v: EntityVisual),
 *        toplanınca view.collect(), kırılınca/ölünce view.shatter()
 *        e: DÜNYA koordinatlı Entity (dikdörtgenler sol-üst; spike sol+taban; ayaklılar alt-orta; noktalar merkez)
 *        v: x,y (anlık bağlantı noktası), visible, alpha, warn 0..1 (telegraf), on (açık/basılı/katı), phase (ritim evresi), t, face
 *  createHeroView(scene, cosmetic, x, y, color): HeroView             — Odi; her kare update(h: HeroVisual), anlar için fx(kind)
 *  createHud(scene, heroColor, top): LevelHudView                      — nota sayacı + uçan nota, 3 altın koklea, can, ilerleme, seri, övgü, el işareti
 *  createFx(scene, biome): LevelFx                                      — iniş tozu, zıplama pufu, parıltı, vuruş flaşı, halka, koklea, vinyet
 *  createBossView(scene, kind, name, groundY, biome): BossView         — boss ve saldırıları
 *  createProjectileLayer(scene, biome): ProjectileLayer                — atıcı mermileri
 *
 *  Fizik gövdeleri görsellerde değildir (play/sim.ts); görseller yalnızca konum/durum yansıtır.
 * ============================================================================================
 */

// ---------------------------------------------------------------- arka plan
export interface BiomeBackdrop { update(cam: Phaser.Cameras.Scene2D.Camera): void; destroy(): void; setForegroundAlpha(a: number): void }
export function paintBiome(scene: Phaser.Scene, biome: BiomeDef, worldW: number, worldH: number, quality: 'high' | 'low' = 'high'): BiomeBackdrop {
  const bd = RD.paintBiome(scene, biome.id, worldW, worldH, { quality });
  return { update: (cam) => bd.update(cam.scrollX, cam.scrollY), destroy: () => bd.destroy(), setForegroundAlpha: (a) => bd.setForegroundAlpha(a) };
}

// ---------------------------------------------------------------- zemin
export interface TerrainRect { l: number; t: number; r: number; b: number; kind: 'platform' | 'wall' | 'ceiling' }
export interface TerrainLayer { cull(left: number, right: number): void }
export function makeTerrain(scene: Phaser.Scene, rects: TerrainRect[], biome: BiomeDef): TerrainLayer {
  // zemin gövdesi görselde aşağı doğru uzar: kamera inince (havuz dibi, çukur kenarı) altında boşluk görünmesin
  const merged = RD.mergeRects(rects.map((r) => ({ x: r.l, y: r.t, w: r.r - r.l, h: r.b >= GROUND_Y + 150 && r.kind !== 'ceiling' ? Math.max(r.b - r.t, GROUND_Y + 760 - r.t) : r.b - r.t })));
  const pieces = merged.map((r) => ({ r, c: RD.terrainPiece(scene, r, biome.id), vis: true }));
  return {
    // her parça birkaç nesne taşır; ekran dışındakiler çizilmesin
    cull: (L, R) => { for (const p of pieces) { const v = p.r.x + p.r.w + 60 > L && p.r.x - 60 < R; if (v !== p.vis) { p.vis = v; p.c.setVisible(v); } } },
  };
}

// ---------------------------------------------------------------- varlıklar
export interface EntityVisual { x: number; y: number; visible: boolean; alpha: number; warn: number; on: boolean; phase: number; t: number; color: number; face: 1 | -1 }
export interface EntityView { obj: Phaser.GameObjects.GameObject; update(v: EntityVisual): void; collect(): void; shatter(): void; destroy(): void }

const MOVERS = new Set(['moving', 'lift', 'beat', 'hazard', 'enemy', 'coin', 'note', 'collect']);

/** Her EntityType için görsel (render/entitySprite). e dünya koordinatlarındadır. */
export function drawEntity(s: Phaser.Scene, e: Entity, biome: BiomeDef): EntityView | null {
  if (e.type === 'tutor' || e.type === 'escortee') return null;
  const v = RD.entitySprite(s, { type: e.type, x: e.x, y: e.y, w: e.w, h: e.h, props: e.props }, biome.id);
  const moves = MOVERS.has(e.type);
  let lastOn: boolean | null = null; let lastWarn = 0; let lastFace = 0; let lastVis = true; let lastCrack = 0; let lastAlpha = -1; let lx = e.x, ly = e.y;
  return {
    obj: v,
    destroy: () => { if (!v.dead) v.destroy(); },
    collect: () => { if (!v.dead) v.collect(); },
    shatter: () => { if (!v.dead) v.shatter(); },
    update: (st) => {
      if (v.dead) return;
      // yalnızca yeri değişenler taşınır (notaların süzülme tween'i render'da)
      if (moves && (st.x !== lx || st.y !== ly)) { v.setPosition(st.x, st.y); lx = st.x; ly = st.y; }
      if (st.visible !== lastVis && e.type !== 'crumble') { v.setVisible(st.visible); lastVis = st.visible; }
      switch (e.type) {
        case 'beat': v.pulse(st.phase); if (st.on !== lastOn) { v.setSolid(st.on); lastOn = st.on; } break;
        case 'echo': { const a = st.on ? 1 : 0.14; if (a !== lastAlpha) { v.reveal(a); lastAlpha = a; } break; }
        case 'crumble': { const c = !st.visible ? 1 : st.warn; if (c !== lastCrack) { if (c === 0) v.crack(0); else v.crack(c); lastCrack = c; } break; }
        case 'door': case 'freqgate': case 'switch': case 'checkpoint': if (st.on !== lastOn) { v.setOpen(st.on); lastOn = st.on; } break;
        case 'enemy': if (st.face !== lastFace) { v.setFacing(st.face); lastFace = st.face; } if (st.warn > 0 && lastWarn === 0) v.telegraph(); lastWarn = st.warn; break;
        case 'hazard': if (st.alpha !== lastAlpha) { v.setAlpha(st.alpha); lastAlpha = st.alpha; } if (st.warn > 0 && lastWarn === 0) v.telegraph(); lastWarn = st.warn; break;
        case 'coin': case 'note': case 'collect': if (st.alpha !== lastAlpha) { v.setAlpha(st.alpha); lastAlpha = st.alpha; } break;
        case 'fork': if (st.on !== lastOn) { v.setScale(st.on ? 1.25 : 1); lastOn = st.on; } break;
        default: break;
      }
    },
  };
}

// ---------------------------------------------------------------- mermiler
export interface ProjectileLayer { update(list: { x: number; y: number }[]): void; destroy(): void }
export function createProjectileLayer(s: Phaser.Scene, biome: BiomeDef): ProjectileLayer {
  const pool: RD.EntityView[] = [];
  return {
    update: (list) => {
      while (pool.length < list.length) pool.push(RD.entitySprite(s, { type: 'projectile', x: 0, y: 0 }, biome.id));
      pool.forEach((o, i) => { const q = list[i]; o.setVisible(!!q); if (q) o.setPosition(q.x, q.y); });
    },
    destroy: () => pool.forEach((o) => o.destroy()),
  };
}

// ---------------------------------------------------------------- kahraman
export interface HeroVisual {
  x: number; y: number; vx: number; vy: number; dir: 1 | -1; g: 1 | -1; t: number; grounded: boolean; sliding: boolean; gliding: boolean; dashing: boolean; pounding: boolean;
  hook: { x: number; y: number } | null; wall: boolean; water: boolean; invuln: boolean; hurt: boolean; win: boolean; shield: number; breath: number; breathMax: number; echo: boolean;
}
/** yarış katmanı ve araçlar kahramanın x/y'sini okur */
export interface HeroHandle { readonly x: number; readonly y: number; readonly sprite: Phaser.GameObjects.Container }
export interface HeroView { hero: HeroHandle; update(h: HeroVisual): void; land(impact: number): void; destroy(): void }
export function createHeroView(s: Phaser.Scene, cosmetic: { color?: number; hat?: string } | undefined, x: number, y: number, defaultColor = 0x6c4cf1): HeroView {
  const hv = RD.createHeroVisual(s, { color: cosmetic?.color ?? defaultColor, hat: cosmetic?.hat ?? null });
  hv.setPosition(x, y); hv.setDepth(RD.DEPTH.hero);
  const rope = s.add.graphics().setDepth(RD.DEPTH.hero - 1);
  const breathBar = s.add.rectangle(x, y, 40, 5, 0x2ee6d6, 1).setDepth(30).setOrigin(0.5);
  let shield = -1; let pose: RD.HeroPose | '' = '';
  const handle: HeroHandle = { get x() { return hv.root.x; }, get y() { return hv.root.y; }, get sprite() { return hv.root; } };
  return {
    hero: handle,
    update: (h) => {
      hv.setPosition(h.x, h.y); hv.setFlipX(h.dir < 0); hv.setGravityFlip(h.g < 0);
      const p: RD.HeroPose = h.win ? 'win' : h.hurt ? 'hurt' : h.hook ? 'swing' : h.water ? 'swim' : h.dashing ? 'dash' : h.pounding ? 'pound' : h.wall ? 'wall'
        : h.sliding ? 'slide' : h.gliding ? 'glide' : !h.grounded ? (h.vy * h.g < 0 ? 'jump' : 'fall') : 'run';
      if (p !== pose || p === 'jump' || p === 'fall' || p === 'swing' || p === 'swim') { hv.setPose(p, h.vx, h.vy); pose = p; }
      hv.setAlpha(h.invuln ? (Math.floor(h.t * 12) % 2 ? 0.4 : 1) : 1);
      if ((h.shield > 0 ? 1 : 0) !== shield) { shield = h.shield > 0 ? 1 : 0; hv.setShield(shield === 1); }
      const cy = h.y - 24 * h.g;
      rope.clear(); if (h.hook) { rope.lineStyle(2.5, 0xfff6e5, 0.9); rope.beginPath(); rope.moveTo(h.hook.x, h.hook.y + 8); rope.lineTo(h.x, cy); rope.strokePath(); }
      breathBar.setVisible(h.water && h.breath < h.breathMax - 0.05).setPosition(h.x, cy - 40).setSize(40 * Math.max(0, h.breath / h.breathMax), 5).setFillStyle(h.breath < 2 ? 0xff5c5c : 0x2ee6d6);
    },
    land: (impact) => hv.land(impact),
    destroy: () => { hv.destroy(); rope.destroy(); breathBar.destroy(); },
  };
}

/** eskort edilen fısıltı */
export function createEscortView(s: Phaser.Scene, biome: BiomeDef): { update(x: number, y: number, alive: boolean): void } {
  const o = RD.entitySprite(s, { type: 'escortee', x: 0, y: 0 }, biome.id).setDepth(RD.DEPTH.hero - 1);
  return { update: (x, y, alive) => { o.setPosition(x, y + 20); o.setAlpha(alive ? 1 : 0.4); } };
}

// ---------------------------------------------------------------- HUD
export interface HudSnapshot { notes: number; notesTotal: number; cochleas: number; lives: number; pct: number }
export type HintKind = RD.HintKind;
export interface LevelHudView {
  update(h: HudSnapshot): void;
  flyNote(x: number, y: number): void;
  setCombo(n: number, mult: number): void;
  praise(text: string): void;
  showHint(kind: HintKind, text: string): void; hideHint(): void;
  setCheckpoints(pcts: number[]): void;
  onPause(cb: () => void): void;
}
export function createHud(s: Phaser.Scene, heroColor: number, top = 0): LevelHudView {
  const hud = new RD.LevelHud(s, top, heroColor);
  let last: HudSnapshot | null = null;
  return {
    update: (h) => {
      if (!last || last.notes !== h.notes || last.notesTotal !== h.notesTotal) hud.setNotes(h.notes, h.notesTotal);
      if (!last || last.cochleas !== h.cochleas) hud.setCochleas(h.cochleas);
      if (!last || last.lives !== h.lives) hud.setLives(h.lives);
      if (!last || Math.abs(last.pct - h.pct) > 0.002) hud.setProgress(h.pct);
      last = { ...h };
    },
    flyNote: (x, y) => hud.flyNote(x, y),
    setCombo: (n, m) => hud.setCombo(n, m),
    praise: (t) => hud.praise(t),
    showHint: (k, t) => hud.showHint(k, t), hideHint: () => hud.hideHint(),
    setCheckpoints: (p) => hud.setCheckpoints(p),
    onPause: (cb) => hud.onPause(cb),
  };
}

// ---------------------------------------------------------------- efektler
export type LevelFx = RD.LevelFx;
export function createFx(s: Phaser.Scene, biome: BiomeDef): LevelFx { return RD.createFx(s, biome.id); }

// ---------------------------------------------------------------- boss
export interface BossVisual {
  kind: 'golem' | 'canavar'; name: string; hp: number; maxHp: number; phase: number; defeated: boolean; mode: string; t: number;
  fists: { x: number; st: string; t0: number; until: number }[]; balls: { x: number }[]; drops: { x: number; t0: number }[];
  waves: { x: number; kind: 'low' | 'high' }[]; warnWall: { side: -1 | 1; kind: string } | null; notes: { x: number; y: number; got: boolean }[]; core: { x: number } | null;
}
export interface BossView { update(b: BossVisual, groundY: number): void; destroy(): void }
const tex = (s: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
  if (!s.textures.exists(key)) { const g = s.add.graphics(); draw(g); g.generateTexture(key, w, h); g.destroy(); }
  return key;
};
export function createBossView(s: Phaser.Scene, kind: 'golem' | 'canavar', name: string, groundY: number, biome: BiomeDef): BossView {
  const bodyKey = kind === 'golem' ? tex(s, 'boss-golem2', 200, 210, (g) => {
    g.fillStyle(0xb8903d, 1); g.fillEllipse(100, 130, 180, 150); g.fillStyle(0xd4b25a, 1); g.fillCircle(100, 64, 58);
    g.fillStyle(0xffffff, 1); g.fillCircle(78, 60, 13); g.fillCircle(122, 60, 13); g.fillStyle(0x13162a, 1); g.fillCircle(80, 62, 6); g.fillCircle(120, 62, 6);
    g.lineStyle(6, 0x6b3a1a, 1); g.beginPath(); g.moveTo(60, 40); g.lineTo(90, 50); g.moveTo(140, 40); g.lineTo(110, 50); g.strokePath();
    g.fillStyle(0x9c6b2f, 1); g.fillCircle(60, 150, 12); g.fillCircle(140, 160, 10); g.fillCircle(100, 175, 8);
  }) : tex(s, 'boss-canavar2', 220, 190, (g) => {
    g.fillStyle(0x2a163a, 1); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.fillTriangle(110 + Math.cos(a - 0.15) * 70, 95 + Math.sin(a - 0.15) * 62, 110 + Math.cos(a + 0.15) * 70, 95 + Math.sin(a + 0.15) * 62, 110 + Math.cos(a) * 100, 95 + Math.sin(a) * 88); }
    g.fillStyle(0x4a2a6a, 1); g.fillCircle(110, 95, 70); g.fillStyle(0xff4fd8, 1); g.fillCircle(84, 80, 14); g.fillCircle(136, 80, 14); g.fillStyle(0x000000, 1); g.fillCircle(86, 82, 6); g.fillCircle(134, 82, 6);
    g.fillStyle(0x1a0208, 1); g.fillEllipse(110, 125, 80, 34); g.fillStyle(0xffffff, 1); for (let i = 0; i < 5; i++) g.fillTriangle(78 + i * 15, 110, 90 + i * 15, 110, 84 + i * 15, 122);
  });
  const body = s.add.image(195, kind === 'golem' ? groundY - 330 : groundY - 360, bodyKey).setDepth(3);
  const fistKey = tex(s, 'boss-fist2', 80, 64, (g) => { g.fillStyle(0xb8903d, 1); g.fillRoundedRect(0, 0, 80, 64, 20); g.fillStyle(0xd4b25a, 1); for (let i = 0; i < 4; i++) g.fillCircle(12 + i * 19, 10, 9); g.fillStyle(0xffe066, 1); g.fillCircle(40, 30, 9); });
  const shadowKey = tex(s, 'boss-shadow2', 100, 24, (g) => { g.fillStyle(0x000000, 0.35); g.fillEllipse(50, 12, 96, 22); g.fillStyle(0xe5484d, 0.7); g.fillEllipse(50, 12, 60, 12); });
  const ballKey = tex(s, 'boss-ball2', 36, 36, (g) => { g.fillStyle(0xc9a24a, 1); g.fillCircle(18, 18, 17); g.lineStyle(4, 0x8a5a28, 1); g.beginPath(); g.arc(18, 18, 9, 0, Math.PI * 1.5); g.strokePath(); });
  const dropKey = tex(s, `boss-drop2-${kind}`, 44, 36, (g) => { g.fillStyle(kind === 'golem' ? 0xc9a24a : 0x6b7280, 1); g.fillEllipse(22, 18, 44, 34); });
  const waveKey = (k: string) => tex(s, `boss-wave2-${k}`, 26, k === 'low' ? 30 : 52, (g) => { g.fillStyle(k === 'low' ? 0xff5c5c : 0xc44dff, 0.9); g.fillRoundedRect(0, 0, 26, k === 'low' ? 30 : 52, 6); g.lineStyle(3, 0xffffff, 0.85); g.beginPath(); g.moveTo(13, 2); g.lineTo(5, 10); g.lineTo(20, 18); g.lineTo(6, 26); g.strokePath(); });
  const coreKey = tex(s, 'boss-core', 70, 70, (g) => { g.fillStyle(0xff4fd8, 0.35); g.fillCircle(35, 35, 35); g.fillStyle(0xff4fd8, 1); g.fillCircle(35, 35, 22); g.fillStyle(0xffffff, 0.8); g.fillCircle(28, 28, 6); });
  const pool = new Map<string, Phaser.GameObjects.Image[]>();
  const use = (key: string, n: number, depth = 12) => { const arr = pool.get(key) ?? []; while (arr.length < n) arr.push(s.add.image(0, 0, key).setDepth(depth)); pool.set(key, arr); arr.forEach((o, i) => o.setVisible(i < n)); return arr.slice(0, n); };
  const notes: RD.EntityView[] = [];
  const wallGlow = s.add.rectangle(0, groundY - 150, 30, 300, 0xff3b3b, 0).setDepth(14);
  const bar = s.add.graphics().setScrollFactor(0).setDepth(102);
  const nameText = s.add.text(GAME_W / 2, 132, '', { fontFamily: FONT, fontSize: '12px', fontStyle: '800', color: '#ffffff', backgroundColor: 'rgba(13,16,36,0.6)', padding: { x: 8, y: 2 } }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
  let shownHp = -1;
  return {
    update: (b, gy) => {
      body.setScale(1 + 0.03 * Math.sin(b.t * 2), 1 - 0.03 * Math.sin(b.t * 2)).setTint(b.mode === 'stun' ? 0x9ad0ff : b.phase === 3 ? 0xff9a8a : b.phase === 2 ? 0xffc8a8 : 0xffffff);
      if (b.defeated) body.setAlpha(Math.max(0, body.alpha - 0.02)).setAngle(body.angle + 3);
      const fists = use(fistKey, b.fists.length); const shadows = use(shadowKey, b.fists.filter((f) => f.st === 'warn').length, 6);
      let si = 0;
      b.fists.forEach((f, i) => {
        const o = fists[i]!; o.setOrigin(0.5, 1);
        const y = f.st === 'warn' ? gy - 320 + Math.sin(b.t * 20) * 4 : f.st === 'slam' ? gy - 160 : f.st === 'up' ? gy - 40 - (b.t - (f.until - 0.3)) * 400 : gy;
        o.setPosition(f.x, y); o.setTint(f.st === 'planted' ? 0xffffff : 0xdddddd);
        if (f.st === 'warn') shadows[si++]!.setPosition(f.x, gy - 2).setScale(1 + 0.15 * Math.sin(b.t * 25), 1);
      });
      use(ballKey, b.balls.length).forEach((o, i) => { const q = b.balls[i]!; o.setPosition(q.x, gy - 17).setAngle(q.x * 3); });
      use(dropKey, b.drops.length, 15).forEach((o, i) => { const d = b.drops[i]!; const age = b.t - d.t0; o.setPosition(d.x, age < 0.8 ? gy - 330 : gy - 330 + (age - 0.8) / 0.3 * 330); });
      const lows = b.waves.filter((w) => w.kind === 'low'), highs = b.waves.filter((w) => w.kind === 'high');
      use(waveKey('low'), lows.length).forEach((o, i) => o.setPosition(lows[i]!.x, gy - 15));
      use(waveKey('high'), highs.length).forEach((o, i) => o.setPosition(highs[i]!.x, gy - 52));
      const open = b.notes.filter((n) => !n.got);
      while (notes.length < open.length) notes.push(RD.entitySprite(s, { type: 'note', x: 0, y: 0 }, biome.id).setDepth(16));
      notes.forEach((o, i) => { const n = open[i]; o.setVisible(!!n); if (n) o.setPosition(n.x, n.y); });
      use(coreKey, b.core ? 1 : 0, 16).forEach((o) => o.setPosition(b.core!.x, gy - 40).setScale(1 + 0.12 * Math.sin(b.t * 10)));
      if (b.warnWall) wallGlow.setPosition(b.warnWall.side > 0 ? 375 : 15, gy - 150).setFillStyle(b.warnWall.kind === 'high' ? 0xc44dff : 0xff3b3b, 0.25 + 0.25 * Math.abs(Math.sin(b.t * 16)));
      else wallGlow.setFillStyle(0xff3b3b, 0);
      if (shownHp !== b.hp) {
        shownHp = b.hp; const x0 = GAME_W / 2 - 120, y0 = 112, w = 240, h = 12; bar.clear();
        bar.fillStyle(0x0d1024, 0.6); bar.fillRoundedRect(x0, y0, w, h, 6);
        const ratio = Math.max(0, b.hp / b.maxHp); if (ratio > 0) { bar.fillStyle(b.phase === 3 ? 0xb3122e : b.phase === 2 ? 0xe5484d : 0xf0567a, 1); bar.fillRoundedRect(x0 + 2, y0 + 2, Math.max(8, (w - 4) * ratio), h - 4, 4); }
        bar.lineStyle(1.5, 0xffd27a, 0.8); bar.strokeRoundedRect(x0, y0, w, h, 6);
        nameText.setText(b.defeated ? `${name} · Yenildi!` : `${name} · Faz ${b.phase}`);
      }
    },
    destroy: () => { body.destroy(); for (const a of pool.values()) a.forEach((o) => o.destroy()); notes.forEach((o) => o.destroy()); bar.destroy(); nameText.destroy(); wallGlow.destroy(); },
  };
}

/** Şanslı Nota parıltısı (bir notanın üstünde) */
export function luckyGlow(s: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image {
  const o = s.add.image(x, y, luckyNoteTexture(s)).setDepth(16);
  s.tweens.add({ targets: o, scale: 1.18, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.InOut' });
  return o;
}

/** görsel çözünürlük (cihaz piksel oranı): render modülü dokuları bu ölçekte boyar */
export function setVisualResolution(dpr: number) { RD.setRenderResolution(dpr); }
