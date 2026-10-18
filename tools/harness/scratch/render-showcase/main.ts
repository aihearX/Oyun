/* Vitrin sahnesi: render modülünü motor olmadan gösterir (biyom başına 390×844 oyun içi taslak + galeri). */
import Phaser from 'phaser';
import * as R from '../../../../packages/game-core/src/render';

type Params = { mode: 'level' | 'gallery' | 'heroes' | 'hud'; biome: string; page?: number; t?: number };
const P = ((window as unknown as { __params?: Params }).__params) ?? { mode: 'level', biome: 'dis-kulak' };
const W = 390, H = 844, DPR = 2;
let SCENE: Phaser.Scene | null = null;
// belirleyici zaman: yazılım GL'de kareler yavaş; sahne kurulduktan sonra oyunu çizimsiz, sabit adımlarla P.t ms ilerletip donduruyoruz
const realNow = Date.now.bind(Date); let fake = 0; let useFake = false;
Date.now = () => (useFake ? fake : realNow());
const done = (info?: unknown) => { const w = window as unknown as { __ready?: boolean; __info?: unknown }; w.__info = info; requestAnimationFrame(() => requestAnimationFrame(() => { w.__ready = true; })); };
function advance(game: Phaser.Game, ms: number, info: () => unknown) {
  game.loop.sleep(); fake = realNow(); useFake = true; let t = game.loop.time; const dt = 1000 / 60;
  for (let i = 0; i < Math.ceil(ms / dt); i++) { fake += dt; t += dt; game.headlessStep(t, dt); }
  SCENE?.scene.pause(); game.loop.wake(); done(info());
}

/** görünen dünyanın sol-üstünü (x,y) yap (merkez kökenli, yakınlaştırmalı kamera) */
function viewAt(cam: Phaser.Cameras.Scene2D.Camera, x: number, y: number) { cam.scrollX = x - cam.width * 0.5 * (1 - 1 / cam.zoom); cam.scrollY = y - cam.height * 0.5 * (1 - 1 / cam.zoom); }

class Show extends Phaser.Scene {
  constructor() { super('show'); }
  create() {
    SCENE = this; const cam = this.cameras.main; cam.setZoom(DPR);
    R.setRenderResolution(DPR);
    const t0 = performance.now();
    if (P.mode === 'level') this.level();
    if (P.mode === 'gallery') this.gallery(P.page ?? 0);
    if (P.mode === 'heroes') this.heroes();
    if (P.mode === 'smoke') this.smoke();
    if (P.mode === 'backdrop') { const cam = this.cameras.main; viewAt(cam, 1000, 900 - H); const bd = R.paintBiome(this, P.biome, 8000, 900); this.events.on('update', () => bd.update(cam.scrollX, cam.scrollY)); }
    if (P.mode === 'hud') this.hudStates();
    const ms = Math.round(performance.now() - t0);
    setTimeout(() => advance(this.game, P.t ?? 1600, () => ({ buildMs: ms, objs: this.children.list.map((o) => { const g = o as unknown as { type: string; y: number; displayHeight: number; depth: number; visible: boolean; alpha: number }; return `${g.type}:${Math.round(g.y)}:${Math.round(g.displayHeight)}:${g.depth}:${g.alpha.toFixed(2)}`; }).length })), 50);
  }
  gallery(page: number) {
    const cam = this.cameras.main; viewAt(cam, 0, 0);
    const bd = R.paintBiome(this, P.biome, 2000, 844); bd.update(cam.scrollX, cam.scrollY); bd.setForegroundAlpha(0);
    const veil = this.add.rectangle(0, 0, W, H, 0x0a0620, 0.5).setOrigin(0, 0).setScrollFactor(0).setDepth(-50); veil.setPosition(R.screenOriginOf(cam).x, R.screenOriginOf(cam).y);
    const cells = GALLERY[page] ?? []; const cw = 130, ch = page === 0 ? 105 : 105;
    cells.forEach((c, i) => {
      const cx = (i % 3) * cw + cw / 2, cy = Math.floor(i / 3) * ch + 46 + 10;
      const v = R.entitySprite(this, { ...c.e, x: c.e.x + cx, y: c.e.y + cy }, P.biome);
      c.after?.(v);
      this.add.text(cx, cy + 44, c.label, { fontFamily: R.FONT, fontSize: '11px', fontStyle: '800', color: '#c9c1ff', resolution: 2 }).setOrigin(0.5).setDepth(200);
    });
    const shot = this.add.text(W / 2, H - 14, page === 0 ? 'Öğe galerisi · toplanabilir, tehlike, düşman' : 'Öğe galerisi · platform ve mekanikler', { fontFamily: R.FONT, fontSize: '12px', fontStyle: '900', color: '#ffc93c', resolution: 2 }).setOrigin(0.5).setDepth(200);
    void shot;
  }
  smoke() {
    const log: string[] = []; const w = window as unknown as { __smoke?: string[] }; w.__smoke = log;
    const types = ['platform', 'moving', 'lift', 'wall', 'crumble', 'beat', 'echo', 'spike', 'hazard', 'barrier', 'lane', 'projectile', 'coin', 'note', 'collect', 'secret', 'powerup', 'bubble', 'fork', 'enemy', 'spring', 'trampoline', 'gear', 'current', 'flip', 'launcher', 'hook', 'switch', 'door', 'freqgate', 'water', 'gravzone', 'checkpoint', 'gate', 'escortee', 'decor', 'text', 'bilinmeyen'];
    for (const b of ['dis-kulak', 'sinir', 'koklea-2']) {
      const bd = R.paintBiome(this, b, 4000, 900); bd.update(10, 20); bd.resize(360, 700); bd.setForegroundAlpha(0.5);
      const tr = R.makeTerrain(this, [{ x: 0, y: 640, w: 30, h: 400 }, { x: 30, y: 640, w: 200, h: 400 }, { x: 300, y: 500, w: 20, h: 12 }], b);
      for (const t of types) for (const kind of t === 'enemy' ? ['devriye', 'ucan', 'atici', 'ziplayan', 'kalkanli', 'bakteri'] : t === 'powerup' ? ['shield', 'magnet', 'life', 'speed'] : t === 'hazard' ? ['gurultu', 'serumen'] : [undefined]) {
        try {
          const v = R.entitySprite(this, { type: t, x: 100, y: 300, w: 80, h: 40, props: { kind, id: 'a', color: 0.3, pattern: '1001', r: 30, vx: -1, vy: 1, text: 'Merhaba' } }, b);
          v.setOpen(true); v.setOpen(false); v.pulse(0); v.pulse(0.5); v.setSolid(false); v.setSolid(true); v.reveal(0.5); v.crack(0.5); v.crack(1); v.crack(0); v.telegraph(); v.setFacing(-1);
          if (['coin', 'note', 'collect', 'secret', 'fork'].includes(t)) v.collect(); else if (['barrier', 'enemy'].includes(t)) v.shatter(); else v.destroy();
        } catch (e) { log.push(`${b}/${t}/${kind}: ${(e as Error).message}`); }
      }
      try {
        const hv = R.createHeroVisual(this, { color: 0x22a565, hat: 'tac' });
        for (const p of ['run', 'jump', 'fall', 'slide', 'wall', 'glide', 'swing', 'swim', 'dash', 'pound', 'hurt', 'win', 'idle'] as R.HeroPose[]) { hv.setPose(p, 300, -200); hv.setPosition(100, 200); }
        hv.land(900); hv.setFlipX(true); hv.setGravityFlip(true); hv.setShield(true); hv.setAlpha(0.5); hv.setVisible(false); hv.setDepth(22);
        this.time.delayedCall(300, () => hv.destroy());
        const fx = R.createFx(this, b); fx.landDust(1, 2); fx.jumpPuff(1, 2); fx.noteSparkle(1, 2); fx.hitFlash(1, 2); fx.hitFlash(); fx.perfectRing(1, 2); fx.comboBurst(1, 2, 30); fx.checkpointLight(1, 2); fx.cochleaPickup(1, 2); fx.softGlow(1, 2, 0xffffff, 40).destroy(); fx.setVignette(0.8, 0xff0000); fx.resize(360, 700);
        this.time.delayedCall(500, () => fx.destroy());
        const hud = new R.LevelHud(this, 30); hud.setNotes(3, 10); hud.setNotes(4, 10); hud.flyNote(100, 100); hud.setCochleas(3); hud.setCochleas(1); hud.setLives(5); hud.setLives(1); hud.setLives(0);
        hud.setCheckpoints([0.2, 0.5]); hud.setProgress(0.6); hud.setGhosts([{ id: 'x', pct: 0.3, color: 0xff0000 }]); hud.setGhosts([]); hud.setCombo(10, 3); hud.setCombo(0, 1); hud.praise('Güzel!'); hud.praise('Mükemmel!');
        for (const k of ['tap', 'hold', 'swipeDown', 'swipeRight'] as R.HintKind[]) hud.showHint(k, 'Deneme'); hud.hideHint(); hud.onPause(() => log.push('pause')); hud.resize(320, 600); hud.resize(390, 844);
        this.time.delayedCall(700, () => { hud.destroy(); bd.destroy(); for (const o of tr) o.destroy(); });
      } catch (e) { log.push(`${b}/hero-fx-hud: ${(e as Error).message} ${(e as Error).stack?.split('\n')[1]}`); }
    }
  }
  heroes() {
    const cam = this.cameras.main; viewAt(cam, 0, 0);
    const bd = R.paintBiome(this, P.biome, 2000, 844); bd.update(cam.scrollX, cam.scrollY); bd.setForegroundAlpha(0);
    const O = R.screenOriginOf(cam); this.add.rectangle(O.x, O.y, W, H, 0x0a0620, 0.45).setOrigin(0, 0).setScrollFactor(0).setDepth(-50);
    const poses: [R.HeroPose, string, number, string | undefined, number, number][] = [
      ['run', 'koşu', 0x6c4cf1, undefined, 300, 0], ['jump', 'zıplama', 0x6c4cf1, 'bere', 250, -800], ['fall', 'düşüş', 0x0e9c98, 'nota', 200, 700],
      ['slide', 'kayma', 0xf0567a, 'kulaklik', 300, 0], ['wall', 'duvar', 0xd98b00, 'kasif', 0, 60], ['glide', 'süzülme', 0x9b7bff, 'parti', 220, 80],
      ['swing', 'sallanma', 0x22a565, 'koklea', 500, -100], ['swim', 'yüzme', 0x0e9c98, 'dalgic', 200, -80], ['dash', 'ses darbesi', 0x2b3a8c, 'yildiz', 700, 0],
      ['pound', 'yere çakılma', 0x6c4cf1, 'tac', 0, 900], ['hurt', 'hasar', 0xff6f9f, undefined, 0, 0], ['win', 'zafer', 0xd9a400, 'altin', 0, 0],
    ];
    poses.forEach(([pose, label, color, hat, vx, vy], i) => {
      const cx = (i % 3) * 130 + 65, cy = Math.floor(i / 3) * 196 + 150;
      const pad = this.add.ellipse(cx, cy + 2, 70, 12, 0x000000, 0.35);
      void pad;
      const hv = R.createHeroVisual(this, { color, hat });
      if (pose === 'dash') { const o = { x: cx - 90 }; hv.setPosition(o.x, cy); this.tweens.add({ targets: o, x: cx, delay: 1270, duration: 300, onUpdate: () => hv.setPosition(o.x, cy) }); } else hv.setPosition(cx, cy);
      hv.setPose(pose, vx, vy);
      if (pose === 'jump') hv.setShield(true);
      this.add.text(cx, cy + 22, label, { fontFamily: R.FONT, fontSize: '13px', fontStyle: '900', color: '#fff6e5', resolution: 2 }).setOrigin(0.5).setDepth(200);
      this.add.text(cx, cy + 38, hat ? `şapka: ${hat}` : 'şapkasız', { fontFamily: R.FONT, fontSize: '10px', fontStyle: '800', color: '#c9c1ff', resolution: 2 }).setOrigin(0.5).setDepth(200);
    });
    this.add.text(W / 2, H - 22, 'Odi · pozlar ve kozmetik şapkalar', { fontFamily: R.FONT, fontSize: '13px', fontStyle: '900', color: '#ffc93c', resolution: 2 }).setOrigin(0.5).setDepth(200);
  }
  hudStates() {
    const cam = this.cameras.main; viewAt(cam, 1000, 900 - H);
    const bd = R.paintBiome(this, P.biome, 8000, 900); bd.update(cam.scrollX, cam.scrollY);
    R.makeTerrain(this, [{ x: 800, y: 640, w: 800, h: 260 }], P.biome);
    const hud = new R.LevelHud(this, 44); (window as unknown as { __hud: unknown }).__hud = hud;
    hud.setNotes(12, 100); hud.setCochleas(2); hud.setLives(2); hud.setCheckpoints([0.25, 0.5, 0.75]); hud.setProgress(0.56);
    hud.setGhosts([{ id: 'a', pct: 0.62, color: 0x2ee6d6, label: 'Ece' }, { id: 'b', pct: 0.4, color: 0xff9f1c, label: 'Mert' }]);
    hud.setCombo(14, 3);
    const hv = R.createHeroVisual(this, { color: 0x6c4cf1, hat: 'bere' }); hv.setPosition(1110, 640); hv.setPose('run', 300, 0);
    hud.showHint('hold', 'Basılı tut: yüksek zıpla');
    const fx = R.createFx(this, P.biome);
    const T0 = (P.t ?? 1600);
    this.time.delayedCall(T0 - 300, () => { hud.praise('Mükemmel!'); (window as unknown as { __dbg: unknown }).__dbg = () => hud.root.list.map((o) => `${o.type}:${(o as unknown as { name: string }).name}:${(o as unknown as { alpha: number }).alpha?.toFixed(2)}:${(o as unknown as { visible: boolean }).visible}`); });
    this.time.delayedCall(T0 - 260, () => { hud.flyNote(1290, 420); fx.noteSparkle(1290, 420); });
    this.time.delayedCall(T0 - 200, () => fx.perfectRing(1300, 600));
    this.time.delayedCall(T0 - 180, () => fx.landDust(1110, 640, 1));
    this.time.delayedCall(T0 - 300, () => fx.checkpointLight(1060, 640));
    this.time.delayedCall(T0 - 200, () => fx.comboBurst(1200, 360, 20));
    for (const n of [[1160, 520], [1200, 500], [1240, 500]]) R.entitySprite(this, { type: 'note', x: n[0]!, y: n[1]! }, P.biome);
  }
  level() {
    const G = 640; const worldH = G + 260; const X = 1000; const b = P.biome;
    const cam = this.cameras.main; cam.setBounds(0, -1200, 8000, worldH + 1200);
    viewAt(cam, X, worldH - H);
    const bd = R.paintBiome(this, b, 8000, worldH);
    this.events.on('update', () => bd.update(cam.scrollX, cam.scrollY));
    const L = LEVELS[b] ?? LEVELS['dis-kulak']!;
    R.makeTerrain(this, L.ground.map((r) => ({ x: X + r[0], y: G + r[1], w: r[2], h: r[3] ?? 260 })), b);
    const views: R.EntityView[] = [];
    for (const e of L.ents) { const v = R.entitySprite(this, { ...e, x: X + e.x, y: G + e.y }, b); views.push(v); }
    L.after?.(views, this);
    const fx = R.createFx(this, b);
    for (const h of L.heroes) {
      const hv = R.createHeroVisual(this, { color: h.color ?? 0x6c4cf1, hat: h.hat });
      hv.setPosition(X + h.x - (h.move ?? 0), G + h.y); hv.setPose(h.pose, h.vx ?? 260, h.vy ?? 0); if (h.flip) hv.setFlipX(true); if (h.shield) hv.setShield(true); if (h.gflip) hv.setGravityFlip(true);
      if (h.move) { const o = { x: X + h.x - h.move }; const fast = h.pose === 'dash'; this.tweens.add({ targets: o, x: X + h.x, delay: fast ? (P.t ?? 1600) - 300 : 0, duration: fast ? 300 : 1800, onUpdate: () => hv.setPosition(o.x, G + h.y) }); }
    }
    const hud = new R.LevelHud(this, 44);
    hud.setNotes(L.hud.notes, 100); hud.setCochleas(L.hud.coch); hud.setLives(L.hud.lives); hud.setCheckpoints([0.33, 0.66]); hud.setProgress(L.hud.pct);
    if (L.hud.ghosts) hud.setGhosts([{ id: 'a', pct: L.hud.pct + 0.08, color: 0x2ee6d6, label: 'Ece' }, { id: 'b', pct: L.hud.pct - 0.12, color: 0xff5c8a, label: 'Can' }]);
    if (L.hud.combo) hud.setCombo(L.hud.combo, Math.min(4, 1 + Math.floor(L.hud.combo / 5)));
    if (L.hud.praise) this.time.delayedCall(Math.max(0, (P.t ?? 1600) - 450), () => hud.praise(L.hud.praise!));
    if (L.hud.hint) hud.showHint(L.hud.hint[0], L.hud.hint[1]);
    if (L.fx) this.time.delayedCall(Math.max(0, (P.t ?? 1600) - 250), () => L.fx!(fx, X, G));
    if (L.hud.fly) this.time.delayedCall(Math.max(0, (P.t ?? 1600) - 300), () => hud.flyNote(X + 200, G - 200));
  }
}

type HeroSpec = { x: number; y: number; pose: R.HeroPose; vx?: number; vy?: number; color?: number; hat?: string; flip?: boolean; move?: number; shield?: boolean; gflip?: boolean };
type LevelSpec = { ground: [number, number, number, number?][]; ents: R.RenderEntity[]; heroes: HeroSpec[]; hud: { notes: number; coch: number; lives: number; pct: number; combo?: number; praise?: string; hint?: [R.HintKind, string]; ghosts?: boolean; fly?: boolean }; after?: (v: R.EntityView[], s: Phaser.Scene) => void; fx?: (fx: R.LevelFx, X: number, G: number) => void };
const notesArc = (x0: number, y0: number, n: number, dx = 34, h = 50): R.RenderEntity[] => Array.from({ length: n }, (_, i) => ({ type: 'note', x: x0 + i * dx, y: y0 - Math.sin((i / Math.max(1, n - 1)) * Math.PI) * h }));
const LEVELS: Record<string, LevelSpec> = {
  'dis-kulak': {
    ground: [[-200, 0, 400], [250, 0, 400]], ents: [...notesArc(150, -110, 5), { type: 'spike', x: 300, y: 0, w: 64 }, { type: 'enemy', x: 330, y: -150, props: { kind: 'devriye' } }, { type: 'platform', x: 250, y: -150, w: 130, h: 30 }, { type: 'checkpoint', x: 40, y: 0 }, { type: 'coin', x: 300, y: -200 }, { type: 'coin', x: 334, y: -200 }],
    heroes: [{ x: 110, y: 0, pose: 'run', move: 60 }], hud: { notes: 37, coch: 1, lives: 3, pct: 0.42, combo: 6, hint: ['tap', 'Zıplamak için dokun'] },
    after: (v) => v.find((e) => e.kind === 'checkpoint')?.setOpen(true),
  },
  'kanal': {
    ground: [[-200, 0, 330], [210, 30, 400, 230]], ents: [{ type: 'wall', x: 150, y: -260, w: 44, h: 260 }, { type: 'crumble', x: 250, y: -170, w: 110, h: 28 }, ...notesArc(250, -230, 4, 30, 30), { type: 'hazard', x: 245, y: -50, w: 120, h: 70, props: { kind: 'serumen' } }, { type: 'enemy', x: 60, y: 0, props: { kind: 'ziplayan' } }, { type: 'collect', x: 90, y: -300 }],
    heroes: [{ x: 134, y: -120, pose: 'wall', vy: 60, flip: true }], hud: { notes: 58, coch: 2, lives: 2, pct: 0.55, combo: 11, praise: 'Güzel!' },
    after: (v) => { v.find((e) => e.kind === 'crumble')?.crack(0.5); v.find((e) => e.kind === 'enemy')?.setFacing(1); },
  },
  'zar': {
    ground: [[-200, 0, 300], [300, 20, 300, 240]], ents: [{ type: 'trampoline', x: 60, y: 0, w: 100 }, { type: 'beat', x: 150, y: -210, w: 100, h: 26, props: { pattern: '1010' } }, { type: 'beat', x: 270, y: -290, w: 100, h: 26, props: { pattern: '0101' } }, ...notesArc(130, -330, 5, 30, 40), { type: 'enemy', x: 310, y: -110, props: { kind: 'ucan' } }],
    heroes: [{ x: 200, y: -360, pose: 'glide', vx: 220, vy: 80 }], hud: { notes: 64, coch: 1, lives: 3, pct: 0.38, combo: 15, praise: 'Mükemmel!' },
    after: (v) => { const bs = v.filter((e) => e.kind === 'beat'); bs[0]?.pulse(0.05); bs[1]?.setSolid(false); },
  },
  'kemikcikler': {
    ground: [[-200, 0, 280], [290, 0, 300]], ents: [{ type: 'gear', x: 140, y: -250, props: { r: 46, speed: 0.6 } }, { type: 'hook', x: 270, y: -330, props: { r: 0 } }, { type: 'switch', x: 310, y: 0, props: { id: 'k1' } }, { type: 'door', x: 345, y: -150, w: 26, h: 150, props: { id: 'k1' } }, { type: 'crumble', x: 120, y: -90, w: 100, h: 26 }, { type: 'enemy', x: 40, y: 0, props: { kind: 'kalkanli' } }, ...notesArc(200, -150, 3, 32, 20)],
    heroes: [{ x: 250, y: -230, pose: 'swing', vx: 520, vy: -60, hat: 'kasif' }], hud: { notes: 21, coch: 0, lives: 3, pct: 0.24, ghosts: true },
    after: (v, s) => { const hk = v.find((e) => e.kind === 'hook'); if (hk) { const g = s.add.graphics().setDepth(19); g.lineStyle(2.5, 0xfff6e5, 0.85); g.lineBetween(hk.x, hk.y + 8, 1000 + 250, 640 - 255); } },
  },
  'koklea-1': {
    ground: [[-200, 0, 600]], ents: [{ type: 'water', x: -10, y: -380, w: 420, h: 380 }, { type: 'bubble', x: 300, y: -260 }, { type: 'bubble', x: 60, y: -120 }, { type: 'fork', x: 90, y: -300, props: { color: 0.12 } }, { type: 'freqgate', x: 320, y: -190, w: 30, h: 190, props: { color: 0.12 } }, { type: 'current', x: 150, y: -120, w: 150, h: 70, props: { vx: 1 } }, ...notesArc(150, -270, 4, 30, 24)],
    heroes: [{ x: 220, y: -190, pose: 'swim', vx: 200, vy: -100, hat: 'dalgic', color: 0x0e9c98 }], hud: { notes: 45, coch: 2, lives: 3, pct: 0.61 },
  },
  'koklea-2': {
    ground: [[-200, 0, 330], [220, -60, 300, 320]], ents: [{ type: 'fork', x: 70, y: -140, props: { color: 0.45 } }, { type: 'freqgate', x: 230, y: -260, w: 30, h: 200, props: { color: 0.45 } }, { type: 'beat', x: 40, y: -260, w: 100, h: 26, props: { pattern: '1100' } }, { type: 'secret', x: 330, y: -330 }, { type: 'enemy', x: 330, y: -60, props: { kind: 'atici' } }, { type: 'projectile', x: 280, y: -84 }, ...notesArc(90, -200, 3, 30, 10)],
    heroes: [{ x: 140, y: 0, pose: 'run', move: 50 }], hud: { notes: 72, coch: 1, lives: 3, pct: 0.7, combo: 9, ghosts: true },
    after: (v) => { v.find((e) => e.kind === 'freqgate')?.setOpen(true); v.find((e) => e.kind === 'enemy')?.setFacing(-1); v.find((e) => e.kind === 'enemy')?.telegraph(); },
  },
  'koklea-3': {
    ground: [[-200, 0, 300], [220, 0, 400]], ents: [{ type: 'launcher', x: 60, y: 0, props: { vx: 1, vy: -1.6 } }, { type: 'water', x: 220, y: -150, w: 200, h: 150 }, { type: 'collect', x: 230, y: -330 }, { type: 'enemy', x: 320, y: -230, props: { kind: 'ucan' } }, { type: 'powerup', x: 330, y: -360, props: { kind: 'magnet' } }, ...notesArc(130, -280, 4, 30, 40)],
    heroes: [{ x: 150, y: -230, pose: 'jump', vx: 300, vy: -700, hat: 'tac' }], hud: { notes: 83, coch: 3, lives: 1, pct: 0.84, combo: 21 },
    fx: (fx, X, G) => fx.perfectRing(X + 60, G - 30),
  },
  'sinir': {
    ground: [[-200, 0, 320], [260, 0, 400]], ents: [{ type: 'barrier', x: 300, y: -170, w: 30, h: 170 }, { type: 'echo', x: 150, y: -190, w: 110, h: 26 }, { type: 'echo', x: 260, y: -300, w: 100, h: 26 }, { type: 'enemy', x: 50, y: 0, props: { kind: 'devriye' } }, { type: 'lane', x: 380, y: -260 }, ...notesArc(150, -260, 4, 30, 20)],
    heroes: [{ x: 230, y: -60, pose: 'dash', vx: 700, move: 200, color: 0x2b3a8c, hat: 'kulaklik' }], hud: { notes: 51, coch: 1, lives: 2, pct: 0.47, combo: 4, hint: ['swipeRight', 'Ses darbesi: sağa kaydır'] },
    after: (v) => v.filter((e) => e.kind === 'echo').forEach((e, i) => e.reveal(i ? 0.5 : 1)),
  },
  'beyin-sapi': {
    ground: [[-200, 0, 360], [290, 0, 300]], ents: [{ type: 'gravzone', x: 180, y: -400, w: 120, h: 400 }, { type: 'flip', x: 120, y: -120 }, { type: 'lift', x: 290, y: -200, w: 100, h: 26 }, { type: 'platform', x: 150, y: -440, w: 180, h: 30 }, { type: 'enemy', x: 60, y: 0, props: { kind: 'devriye' } }, ...notesArc(190, -300, 3, 30, 20), { type: 'powerup', x: 330, y: -300, props: { kind: 'shield' } }],
    heroes: [{ x: 240, y: -410, pose: 'run', gflip: true, color: 0xf0567a, hat: 'yildiz' }], hud: { notes: 66, coch: 2, lives: 3, pct: 0.73, ghosts: true, praise: 'Harika!' },
  },
  'korteks': {
    ground: [[-200, 0, 700]], ents: [{ type: 'gate', x: 290, y: 0 }, { type: 'escortee', x: 150, y: -80 }, { type: 'text', x: 120, y: -330, props: { text: 'Ninni beyne ulaştı!' } }, ...notesArc(40, -200, 4, 30, 30), { type: 'powerup', x: 40, y: -300, props: { kind: 'life' } }, { type: 'decor', x: 30, y: 0, props: { kind: 'tuy' } }],
    heroes: [{ x: 210, y: 0, pose: 'win', hat: 'altin', color: 0xd9a400 }], hud: { notes: 97, coch: 3, lives: 3, pct: 0.98, combo: 30, praise: 'Mükemmel!' },
    fx: (fx, X, G) => fx.cochleaPickup(X + 330, G - 300),
  },
};

type Cell = { label: string; e: R.RenderEntity; dx?: number; dy?: number; after?: (v: R.EntityView) => void };
const GALLERY: Cell[][] = [
  [
    { label: 'nota', e: { type: 'note', x: 0, y: 0 } }, { label: 'jeton', e: { type: 'coin', x: 0, y: 0 } }, { label: 'büyük nota (collect)', e: { type: 'collect', x: 0, y: 0 } },
    { label: 'altın koklea', e: { type: 'secret', x: 0, y: 0 } }, { label: 'kalkan', e: { type: 'powerup', x: 0, y: 0, props: { kind: 'shield' } } }, { label: 'mıknatıs', e: { type: 'powerup', x: 0, y: 0, props: { kind: 'magnet' } } },
    { label: 'can', e: { type: 'powerup', x: 0, y: 0, props: { kind: 'life' } } }, { label: 'hız', e: { type: 'powerup', x: 0, y: 0, props: { kind: 'speed' } } }, { label: 'kabarcık', e: { type: 'bubble', x: 0, y: 0 } },
    { label: 'diyapazon 0.1', e: { type: 'fork', x: 0, y: 0, props: { color: 0.1 } } }, { label: 'diyapazon 0.5', e: { type: 'fork', x: 0, y: 0, props: { color: 0.5 } } }, { label: 'diyapazon 0.9', e: { type: 'fork', x: 0, y: 0, props: { color: 0.9 } } },
    { label: 'diken', e: { type: 'spike', x: -48, y: 20, w: 96 } }, { label: 'gürültü bulutu', e: { type: 'hazard', x: -50, y: -34, w: 100, h: 64 } }, { label: 'serumen tehlikesi', e: { type: 'hazard', x: -50, y: -30, w: 100, h: 56, props: { kind: 'serumen' } } },
    { label: 'gürültü duvarı', e: { type: 'barrier', x: -16, y: -44, w: 32, h: 84 } }, { label: 'şerit engeli', e: { type: 'lane', x: 0, y: 0 } }, { label: 'ses mermisi', e: { type: 'projectile', x: 0, y: 0 } },
    { label: 'devriye', e: { type: 'enemy', x: 0, y: 26, props: { kind: 'devriye' } } }, { label: 'uçan', e: { type: 'enemy', x: 0, y: 26, props: { kind: 'ucan' } } }, { label: 'atıcı', e: { type: 'enemy', x: 0, y: 26, props: { kind: 'atici' } } },
    { label: 'zıplayan', e: { type: 'enemy', x: 0, y: 26, props: { kind: 'ziplayan' } } }, { label: 'kalkanlı', e: { type: 'enemy', x: 0, y: 26, props: { kind: 'kalkanli' } } }, { label: 'uyarı (devriye)', e: { type: 'enemy', x: 0, y: 26, props: { kind: 'devriye' } }, after: (v) => v.scene.time.delayedCall(1300, () => v.telegraph()) },
  ],
  [
    { label: 'platform', e: { type: 'platform', x: -55, y: -8, w: 110, h: 28 } }, { label: 'hareketli', e: { type: 'moving', x: -55, y: -8, w: 110, h: 26 } }, { label: 'yükselen (lift)', e: { type: 'lift', x: -50, y: -8, w: 100, h: 26 } },
    { label: 'duvar (tırmanılır)', e: { type: 'wall', x: -20, y: -40, w: 40, h: 80 } }, { label: 'çatlak zemin', e: { type: 'crumble', x: -55, y: -8, w: 110, h: 26 }, after: (v) => v.crack(0.6) }, { label: 'ritim (katı)', e: { type: 'beat', x: -55, y: -10, w: 110, h: 26, props: { pattern: '1010' } }, after: (v) => v.pulse(0.05) },
    { label: 'ritim (boş)', e: { type: 'beat', x: -55, y: -10, w: 110, h: 26, props: { pattern: '1100' } }, after: (v) => { v.setSolid(false); v.pulse(0.8); } }, { label: 'yankı (görünür)', e: { type: 'echo', x: -55, y: -10, w: 110, h: 26 }, after: (v) => v.reveal(1) }, { label: 'yay', e: { type: 'spring', x: 0, y: 30 } },
    { label: 'trambolin (zar)', e: { type: 'trampoline', x: 0, y: 24, w: 96 } }, { label: 'dişli (kemikçik)', e: { type: 'gear', x: 0, y: 0, props: { r: 26 } } }, { label: 'akıntı', e: { type: 'current', x: -55, y: -30, w: 110, h: 60, props: { vx: 1 } } },
    { label: 'yerçekimi çevirici', e: { type: 'flip', x: 0, y: 0 } }, { label: 'fırlatıcı', e: { type: 'launcher', x: 0, y: 30, props: { vx: 1, vy: -1.4 } } }, { label: 'kanca', e: { type: 'hook', x: 0, y: -6, props: { r: 40 } } },
    { label: 'anahtar', e: { type: 'switch', x: -22, y: 20, props: { id: 'a' } }, dx: 0, after: (v) => { v.x += 22; } }, { label: 'anahtar (basılı)', e: { type: 'switch', x: 0, y: 20, props: { id: 'a' } }, after: (v) => v.setOpen(true) }, { label: 'kapı (kapalı / açık)', e: { type: 'door', x: -40, y: -44, w: 28, h: 84, props: { id: 'a' } }, after: (v) => { const o = R.entitySprite(v.scene, { type: 'door', x: v.x + 52, y: v.y, w: 28, h: 84, props: { id: 'a' } }, P.biome); o.setOpen(true); } },
    { label: 'frekans kapısı', e: { type: 'freqgate', x: -40, y: -44, w: 28, h: 84, props: { color: 0.15 } }, after: (v) => { const o = R.entitySprite(v.scene, { type: 'freqgate', x: v.x + 52, y: v.y, w: 28, h: 84, props: { color: 0.15 } }, P.biome); o.setOpen(true); } }, { label: 'sıvı bölgesi', e: { type: 'water', x: -58, y: -34, w: 116, h: 64 } }, { label: 'yerçekimi bölgesi', e: { type: 'gravzone', x: -40, y: -44, w: 80, h: 84 } },
    { label: 'kontrol noktası', e: { type: 'checkpoint', x: -24, y: 42 }, after: (v) => { const o = R.entitySprite(v.scene, { type: 'checkpoint', x: v.x + 48, y: v.y }, P.biome); o.setOpen(true); } }, { label: 'fısıltı', e: { type: 'escortee', x: 0, y: 0 } }, { label: 'süs (tüy)', e: { type: 'decor', x: 0, y: 40, props: { kind: 'tuy' } } },
  ],
];

new Phaser.Game({
  type: Phaser.WEBGL, parent: 'game', width: W * DPR, height: H * DPR, backgroundColor: '#140c35',
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / DPR }, render: { antialias: true, pixelArt: false, roundPixels: false },
  banner: false, audio: { noAudio: true }, scene: [Show],
});
