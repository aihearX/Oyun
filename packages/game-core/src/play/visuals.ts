import Phaser from 'phaser';
import type { Entity } from '@odi/shared';
import { GROUND_Y } from '@odi/shared';
import type { BiomeDef } from '@odi/content';
import * as RD from '../render';
import { luckyNoteTexture } from '../art';

/**
 * ============================================================================================
 *  GÖRSEL SEAM'LER (docs/11 §7) — oynanış motoru TÜM çizimi yalnızca bu dosyadaki işlevlerle yapar.
 *  Uygulama: görsel ekibin `render/**` modülü (biyom ressamı, zemin, öğe/düşman, Odi, efekt, HUD).
 *  LevelScene başka çizim çağırmaz; görünüm değişecekse yalnızca bu dosya (ya da render/**) değişir.
 *
 *  paintBiome(scene, biome, worldW, worldH, quality?, variant?): BiomeBackdrop — her kare backdrop.update(cam); variant: bölümün
 *        biyom içindeki sırası → günün saati / ruh hali paleti + gök motifi (aynı biyomdaki bölümler farklı görünür)
 *  makeTerrain(scene, rects: TerrainRect[], biome): TerrainLayer       — durağan katı zeminler (toptan); cull(L, R) ekran dışını gizler
 *  drawEntity(scene, e: Entity, biome): EntityView | null              — diğer her varlık; motor her kare view.update(v: EntityVisual),
 *        toplanınca view.collect(), kırılınca/ölünce view.shatter()
 *        e: DÜNYA koordinatlı Entity (dikdörtgenler sol-üst; spike sol+taban; ayaklılar alt-orta; noktalar merkez)
 *        v: x,y (anlık bağlantı noktası), visible, alpha, warn 0..1 (telegraf), on (açık/basılı/katı), phase (ritim evresi), t, face
 *  createHeroView(scene, cosmetic, x, y, color): HeroView             — Odi; her kare update(h: HeroVisual), anlar için fx(kind)
 *  createHud(scene, heroColor, top, textScale): LevelHudView           — nota sayacı + uçan nota, altın koklea (n/3), can, ilerleme, süre, seri, övgü, el işareti
 *  createFx(scene, biome): LevelFx                                      — iniş tozu, zıplama pufu, parıltı, vuruş flaşı, halka, koklea, vinyet
 *  createBossView(scene, kind, name, groundY, biome): BossView         — boss ve saldırıları
 *  createProjectileLayer(scene, biome): ProjectileLayer                — atıcı mermileri
 *
 *  Fizik gövdeleri görsellerde değildir (play/sim.ts); görseller yalnızca konum/durum yansıtır.
 * ============================================================================================
 */

// ---------------------------------------------------------------- arka plan
export interface BiomeBackdrop { update(cam: Phaser.Cameras.Scene2D.Camera): void; destroy(): void; setForegroundAlpha(a: number): void; setQuality(q: 'high' | 'low'): void; /** görünüm boyutu değişti (tasarım px) */ resize(w: number, h: number): void }
export function paintBiome(scene: Phaser.Scene, biome: BiomeDef, worldW: number, worldH: number, quality: 'high' | 'low' = 'high', variant?: number): BiomeBackdrop {
  const bd = RD.paintBiome(scene, biome.id, worldW, worldH, { quality, variant });
  return { update: (cam) => bd.update(cam.scrollX, cam.scrollY), destroy: () => bd.destroy(), setForegroundAlpha: (a) => bd.setForegroundAlpha(a), setQuality: (q) => bd.setQuality(q), resize: (w, h) => bd.resize(w, h) };
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
export interface EntityView { obj: Phaser.GameObjects.GameObject; update(v: EntityVisual): void; collect(): void; shatter(): void; destroy(): void; /** anlık tepki (zar: sıçrayışta esneme) */ poke(): void; /** bölge patolojisi: ilk görüş rozeti / malzemeyle etkisiz */ patho(state: 'sighted' | 'cured'): void }

const MOVERS = new Set(['moving', 'lift', 'beat', 'hazard', 'enemy', 'coin', 'note', 'collect']);

/** Her EntityType için görsel (render/entitySprite). e dünya koordinatlarındadır. */
export function drawEntity(s: Phaser.Scene, e: Entity, biome: BiomeDef): EntityView | null {
  if (e.type === 'tutor' || e.type === 'escortee') return null;
  const v = RD.entitySprite(s, { type: e.type, x: e.x, y: e.y, w: e.w, h: e.h, props: e.props }, biome.id);
  const moves = MOVERS.has(e.type);
  // koyu kenarlı biyomda (İşitme Siniri) kapalı evredeki gürültü bulutu daha opak: ışıklı arka planda kaybolmasın (YN-119)
  const ghostMin = RD.artOf(biome.id).edge != null ? 0.55 : 0;
  let lastOn: boolean | null = null; let lastWarn = 0; let signHalf = -1; let lastFace = 0; let lastVis = true; let lastCrack = 0; let lastAlpha = -1; let lx = e.x, ly = e.y;
  return {
    obj: v,
    destroy: () => { if (!v.dead) v.destroy(); },
    collect: () => { if (!v.dead) v.collect(); },
    shatter: () => { if (!v.dead) v.shatter(); },
    poke: () => { if (!v.dead) v.pulse(0); },
    patho: (st) => { if (!v.dead) { if (st === 'sighted') v.h.sighted?.(); else v.h.cured?.(); } },
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
        case 'hazard': if (st.alpha !== lastAlpha) { if (e.props?.kind === 'sivi') v.reveal(st.alpha); else v.setAlpha(Math.max(ghostMin, st.alpha)); lastAlpha = st.alpha; } if (st.warn > 0 && lastWarn === 0) v.telegraph(); lastWarn = st.warn; break;
        case 'coin': case 'note': case 'collect': if (st.alpha !== lastAlpha) { v.setAlpha(st.alpha); lastAlpha = st.alpha; } break;
        case 'fork': if (st.on !== lastOn) { v.setScale(st.on ? 1.25 : 1); lastOn = st.on; } break;
        // vuruşta nabız atan zar: her vuruş başında esner (oyuncu vuruşu görerek okur)
        case 'trampoline': if (e.props?.beat) { if (st.phase < lastAlpha) v.pulse(0); lastAlpha = st.phase; } break;
        case 'text': {
          // dünya tabelası ekran kenarında kesilmesin: görünürken ekran içine yaslanır, uzaklaştıkça söner; öğretici an açıkken geri çekilir
          const cam = s.cameras.main; const L = RD.viewTopLeft(cam).x; const W = cam.width / cam.zoom;
          if (signHalf < 0) signHalf = Math.min(W / 2 - 10, ((v.list[0] as Phaser.GameObjects.Container | undefined)?.getBounds().width ?? 200) / 2);
          const cx = Math.max(L + signHalf + 10, Math.min(L + W - signHalf - 10, e.x)); const d = Math.abs(cx - e.x);
          const a = (d <= signHalf * 0.6 ? 1 : Math.max(0, 1 - (d - signHalf * 0.6) / (signHalf * 0.9))) * (st.on ? 0 : 1);
          if (cx !== lx) { v.setPosition(cx, e.y); lx = cx; }
          if (Math.abs(a - lastAlpha) > 0.01) { v.setAlpha(a); lastAlpha = a; }
          break;
        }
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
  /** basılı tutulan yüksek zıplamanın şarjı 0..1 (0: basılı değil / yükselmiyor) */
  charge?: number;
}
/** yarış katmanı ve araçlar kahramanın x/y'sini okur */
export interface HeroHandle { readonly x: number; readonly y: number; readonly sprite: Phaser.GameObjects.Container }
export interface HeroView { hero: HeroHandle; update(h: HeroVisual): void; land(impact: number): void; destroy(): void }
export function createHeroView(s: Phaser.Scene, cosmetic: { color?: number; hat?: string } | undefined, x: number, y: number, defaultColor = 0x6c4cf1): HeroView {
  const hv = RD.createHeroVisual(s, { color: cosmetic?.color ?? defaultColor, hat: cosmetic?.hat ?? null });
  hv.setPosition(x, y); hv.setDepth(RD.DEPTH.hero);
  const rope = s.add.graphics().setDepth(RD.DEPTH.hero - 1);
  // su altında nefes göstergesi (YN-119): solda çizili hava kabarcığı, koyu yuvalı kalın çubuk; kalkan baloncuğunun üstünde
  // (eskiden baloncuğun tepesine değen 5 px'lik ince çizgiydi, kalkan sanılıyordu). Büyük yazıda büyür.
  const breathBar = s.add.graphics().setDepth(30).setVisible(false);
  const drawBreath = (x: number, y: number, frac: number, low: boolean) => {
    const k = Number(s.registry?.get('textScale')) || 1; const w = 46 * k, bh = 8 * k, r = 7 * k, gap = 5 * k;
    const ix = x - (w + r * 2 + gap) / 2 + r, bx = ix + r + gap;
    breathBar.clear();
    breathBar.fillStyle(0x140c35, 0.88).fillRoundedRect(bx - 2, y - bh / 2 - 2, w + 4, bh + 4, bh / 2 + 2).fillCircle(ix, y, r + 2);
    breathBar.fillStyle(low ? 0xff5c5c : 0x2ee6d6, 1).fillRoundedRect(bx, y - bh / 2, Math.max(bh, w * frac), bh, bh / 2);
    breathBar.lineStyle(1.5, 0xfff6e5, 0.9).strokeRoundedRect(bx - 2, y - bh / 2 - 2, w + 4, bh + 4, bh / 2 + 2);
    // hava kabarcığı (iki kabarcık; açık çizgili, içi saydam turkuaz, parlak yay)
    const sx = ix + r * 0.95, sy = y - r * 0.95, sr = r * 0.42;
    breathBar.fillStyle(0x140c35, 0.88).fillCircle(sx, sy, sr + 2);
    breathBar.fillStyle(0x2ee6d6, 0.35).fillCircle(ix, y, r).fillCircle(sx, sy, sr);
    breathBar.lineStyle(2, 0xe9fffd, 1).strokeCircle(ix, y, r).lineStyle(1.5, 0xe9fffd, 1).strokeCircle(sx, sy, sr);
    breathBar.lineStyle(1.6, 0xffffff, 0.95).beginPath().arc(ix, y, r * 0.6, Math.PI * 1.1, Math.PI * 1.45).strokePath();
  };
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
      hv.setCharge(h.charge ?? 0);
      const cy = h.y - 24 * h.g;
      rope.clear(); if (h.hook) { rope.lineStyle(2.5, 0xfff6e5, 0.9); rope.beginPath(); rope.moveTo(h.hook.x, h.hook.y + 8); rope.lineTo(h.x, cy); rope.strokePath(); }
      const breath = h.water && h.breath < h.breathMax - 0.05; breathBar.setVisible(breath);
      if (breath) drawBreath(h.x, cy - 54, Math.max(0, h.breath / h.breathMax), h.breath < 2);
    },
    land: (impact) => hv.land(impact),
    destroy: () => { hv.destroy(); rope.destroy(); breathBar.destroy(); },
  };
}

/** eskort edilen fısıltı; danger 0..1 (play/escort.ts): yaklaşan düşman yüzü kızartır. Kaybolunca olduğu yerde gri işaretle kalır */
export interface EscortView { update(x: number, y: number, alive: boolean, danger: number): void }
export function createEscortView(s: Phaser.Scene, biome: BiomeDef): EscortView {
  const o = RD.entitySprite(s, { type: 'escortee', x: 0, y: 0 }, biome.id).setDepth(RD.DEPTH.hero - 1);
  return { update: (x, y, alive, danger) => { o.setPosition(x, y + 20); if (alive) o.h.danger?.(danger); else o.h.lost?.(); } };
}

// ---------------------------------------------------------------- HUD
export interface HudSnapshot { notes: number; notesTotal: number; cochleas: number; /** bölümdeki gizli koklea sayısı (0: boss) */ cochleasTotal: number; lives: number; pct: number;
  /** süreli bölümde kalan oyun saniyesi (geri sayım); süresiz bölümde null */
  timeLeft: number | null;
  /** eskort bölümünde fısıltının durumu (yoksa null) */
  escort: RD.EscortHud;
  /** melodi hedefli bölümde sırayla toplanan notalar / hedef ("Nota 3/8"); yoksa null */
  melody?: { n: number; total: number } | null;
  /** kalan kalkan (bölüm başı + güçlendirme); 0 gizler */
  shield?: number }
export type HintKind = RD.HintKind;
export interface LevelHudView {
  update(h: HudSnapshot): void;
  flyNote(x: number, y: number): void;
  setCombo(n: number, mult: number): void;
  praise(text: string): void;
  /** övgü sözünü hemen kaldır (hasar anı) */
  clearPraise(): void;
  showHint(kind: HintKind, text: string): void; hideHint(): void;
  /** alt-orta bilgi şeridi (bölüm girişi, faz uyarıları); boş metin gizler */
  toast(text: string, ms: number): void;
  /** bölümün değiştiricileri: göstergede küçük kalıcı rozet (çizili simge + ad); boş liste gizler */
  setModifiers(list: { id: string; name: string }[]): void;
  /** bölüm başı duyurusu (değiştiriciler; göstergenin altında, ms sonra söner) */
  announce(text: string, ms: number): void;
  /** bölge patolojisinin adı: üst bantta çizili uyarı simgesiyle (Odi'nin ve yolun üstünde değil); aynı anda birden çoksa sırayla */
  pathology(text: string): void;
  setCheckpoints(pcts: number[]): void;
  /** canavar bölümü: kalkan sayacı can çubuğunun (alt kenarı, tasarım px) altında */
  belowBossBar(bottom: number | null): void;
  onPause(cb: () => void): void;
  /** duraklat düğmesi isabeti (tasarım ekran koordinatı) ve basma */
  pauseHit(x: number, y: number): boolean; pressPause(): void; pauseCenter(): { x: number; y: number };
  /** görünüm boyutu / güvenli alan inişi değişti (tasarım px) */
  resize(w: number, h: number, top: number): void;
}
/** textScale: Büyük yazı (LevelOptions.bigText) açıkken gösterge yazıları bu çarpanla büyür */
export function createHud(s: Phaser.Scene, heroColor: number, top = 0, textScale = 1): LevelHudView {
  const hud = new RD.LevelHud(s, top, heroColor, textScale);
  let last: HudSnapshot | null = null;
  return {
    update: (h) => {
      if (!last || last.notes !== h.notes || last.notesTotal !== h.notesTotal) hud.setNotes(h.notes, h.notesTotal);
      if (!last || last.cochleas !== h.cochleas || last.cochleasTotal !== h.cochleasTotal) hud.setCochleas(h.cochleas, h.cochleasTotal);
      hud.setTimer(h.timeLeft); hud.setEscort(h.escort); hud.setMelody(h.melody ? h.melody.n : null, h.melody?.total ?? 0);
      if (!last || last.lives !== h.lives) hud.setLives(h.lives);
      hud.setShield(h.shield ?? 0);
      if (!last || Math.abs(last.pct - h.pct) > 0.002) hud.setProgress(h.pct);
      last = { ...h };
    },
    flyNote: (x, y) => hud.flyNote(x, y),
    setCombo: (n, m) => hud.setCombo(n, m),
    praise: (t) => hud.praise(t), clearPraise: () => hud.clearPraise(),
    showHint: (k, t) => hud.showHint(k, t), hideHint: () => hud.hideHint(),
    toast: (t, ms) => hud.toast(t, ms),
    setModifiers: (l) => hud.setModifiers(l), announce: (t, ms) => hud.announce(t, ms), pathology: (t) => hud.pathology(t),
    setCheckpoints: (p) => hud.setCheckpoints(p),
    belowBossBar: (b) => hud.belowBossBar(b),
    onPause: (cb) => hud.onPause(cb),
    pauseHit: (x, y) => hud.pauseHit(x, y), pressPause: () => hud.pressPause(), pauseCenter: () => hud.pauseCenter(),
    resize: (w, h, top) => hud.resize(w, h, top),
  };
}

// ---------------------------------------------------------------- efektler
export type LevelFx = RD.LevelFx;
export function createFx(s: Phaser.Scene, biome: BiomeDef): LevelFx { return RD.createFx(s, biome.id); }

// ---------------------------------------------------------------- boss
export interface BossVisual {
  kind: 'golem' | 'canavar'; name: string; hp: number; maxHp: number; phase: number; defeated: boolean; mode: string; t: number;
  fists: { x: number; st: string; t0: number; until: number; slot?: number; hit?: boolean }[]; balls: { x: number }[]; drops: { x: number; t0: number }[];
  waves: { x: number; kind: 'low' | 'high'; dir?: number }[]; warnWall: { side: -1 | 1; kind: string } | null; notes: { x: number; y: number; got: boolean }[]; core: { x: number } | null;
  /** gözler kahramanı izler (yalnız görsel) */
  heroX?: number;
  /** ilk canavarın öğretici anı: zayıf nokta (saplı yumruk) parlar */
  focus?: boolean;
}
export interface BossView { update(b: BossVisual, groundY: number): void; destroy(): void; /** ekran-sabit can çubuğu: görünüm genişliği ve gösterge inişi (tasarım px) */ layout?(viewW: number, top: number): void }
/** Boss ve saldırıları: render/boss.ts (boyalı kukla, telegraf, vuruş flaşı, faz dönüşümü, yenilgi patlaması, can çubuğu). */
export function createBossView(s: Phaser.Scene, kind: 'golem' | 'canavar', name: string, groundY: number, biome: BiomeDef): BossView {
  return RD.createBossArt(s, kind, name, groundY, biome.id);
}

/** Şanslı Nota parıltısı (bir notanın üstünde) */
export function luckyGlow(s: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image {
  const o = s.add.image(x, y, luckyNoteTexture(s)).setDepth(16);
  s.tweens.add({ targets: o, scale: 1.18, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.InOut' });
  return o;
}

/** parçacık yoğunluğu (1 = tam; düşük kalitede ~0,45) — efekt ve boss patlamaları bu çarpanla saçılır */
export function setFxQuality(k: number) { RD.setFxQuality(k); }

/** görsel çözünürlük (cihaz piksel oranı): render modülü dokuları bu ölçekte boyar */
export function setVisualResolution(dpr: number) { RD.setRenderResolution(dpr); }
