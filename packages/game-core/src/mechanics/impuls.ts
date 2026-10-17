import Phaser from 'phaser';
import type { Entity } from '@odi/shared';
import { GROUND_Y } from '@odi/shared';
import type { Mechanic, LevelContext } from './types';
import { sfx } from '../audio';
import { tonotopyColor } from '../art';

/** Üç şerit: 0 alt, 1 orta, 2 üst (kahraman ayak y'si). */
export const LANE_Y = [GROUND_Y - 40, GROUND_Y - 170, GROUND_Y - 300] as const;
const BASE_SPEED = 380;
const SPRINT_MS = 600;
const SPRINT_CD_MS = 2000;
const SPRINT_MULT = 1.5;
const LANE_SMOOTH = 14; // şerit geçişi: üstel yumuşatma (1/s)
const OBST_W = 56, OBST_H = 48;
const LANE_T = [0.9, 0.5, 0.1]; // tonotopi: alt şerit kalın (turuncu), üst ince (mor)

type SceneExtra = { __impulsTrail?: Phaser.GameObjects.Particles.ParticleEmitter };
const custom = (ctx: LevelContext) => ctx.state.custom;
/** Fizikle aynı saatte geçen süre (ms): düşük fps'te sahne dt'si kırpılır, zamanlayıcılar ise gerçek zamanla koşar; sprint/şerit geçişi mesafeye bağlı kalsın. */
const physMs = (ctx: LevelContext) => ctx.scene.game.loop.delta * (ctx.scene.opts?.timeScale ?? 1);
const laneCenter = (l: number) => LANE_Y[l]! - 24;
const laneOf = (y: number) => { let best = 0; for (let i = 1; i < 3; i++) if (Math.abs(y - laneCenter(i)) < Math.abs(y - laneCenter(best))) best = i; return best; };

function speedOf(ctx: LevelContext): number {
  const lvl = ctx.spec.number;
  const grow = 1 + Math.min(0.2, Math.max(0, lvl - 31) * 0.025); // bölüm ilerledikçe hafifçe hızlan
  const now = ctx.scene.time.now; const c = custom(ctx);
  const sprint = (c.sprintLeft as number) > 0 ? SPRINT_MULT : 1;
  const slow = now < (c.slowUntil as number) ? 0.6 : 1;
  return BASE_SPEED * grow * ctx.state.speedMult * sprint * slow;
}

function obstacleTexture(s: Phaser.Scene, lane: number): string {
  const key = `impuls-obst-${lane}`;
  if (s.textures.exists(key)) return key;
  const g = s.add.graphics(); const col = tonotopyColor(LANE_T[lane]!);
  g.fillStyle(col, 1); g.fillRoundedRect(0, 0, OBST_W, OBST_H, 12);
  g.fillStyle(0xffffff, 0.18); g.fillRoundedRect(4, 4, OBST_W - 8, 10, 5);
  g.lineStyle(3, 0xffffff, 0.9);
  g.beginPath(); g.moveTo(OBST_W * 0.55, 8); g.lineTo(OBST_W * 0.35, OBST_H * 0.52); g.lineTo(OBST_W * 0.6, OBST_H * 0.5); g.lineTo(OBST_W * 0.42, OBST_H - 8); g.strokePath();
  g.generateTexture(key, OBST_W, OBST_H); g.destroy();
  return key;
}
function sinapsTexture(s: Phaser.Scene, w: number, h: number, accent: number): string {
  const key = `impuls-sinaps-${w}x${h}`;
  if (s.textures.exists(key)) return key;
  const g = s.add.graphics();
  g.fillStyle(accent, 0.22); g.fillRoundedRect(0, 0, w, h, 14);
  g.lineStyle(3, 0xffffff, 0.75);
  for (let k = 0; k < 2; k++) { g.beginPath(); const x0 = w * (0.3 + k * 0.4); g.moveTo(x0, 0); for (let y = 24; y <= h; y += 24) g.lineTo(x0 + ((y / 24) % 2 === 0 ? 8 : -8), y); g.strokePath(); }
  g.lineStyle(3, accent, 1); g.strokeRoundedRect(1, 1, w - 2, h - 2, 14);
  g.generateTexture(key, w, h); g.destroy();
  return key;
}
function laneLineTexture(s: Phaser.Scene, lane: number): string {
  const key = `impuls-lane-${lane}`;
  if (s.textures.exists(key)) return key;
  const g = s.add.graphics(); const col = tonotopyColor(LANE_T[lane]!);
  g.fillStyle(col, 0.55); g.fillRoundedRect(0, 2, 56, 4, 2); g.fillStyle(col, 0.2); g.fillRoundedRect(60, 3, 28, 2, 1);
  g.generateTexture(key, 96, 8); g.destroy();
  return key;
}
function dotTexture(s: Phaser.Scene): string {
  const key = 'impuls-dot';
  if (s.textures.exists(key)) return key;
  const g = s.add.graphics(); g.fillStyle(0xffffff, 1); g.fillCircle(6, 6, 6); g.generateTexture(key, 12, 12); g.destroy();
  return key;
}

function isSprinting(ctx: LevelContext, grace = 0) { return (custom(ctx).sprintLeft as number) > -grace; }

/** Yön: dir varsa o; yakın zamanda basılı tutulan yön varsa o (yankı gecikmesi); yoksa dokunulan yarı. */
function chooseDir(ctx: LevelContext, input: { dir: -1 | 0 | 1; pointerX: number }): -1 | 1 {
  const c = custom(ctx); const now = ctx.scene.time.now;
  if (input.dir !== 0) return input.dir;
  if (now - (c.lastDirAt as number) < 400 && (c.lastDir as number) !== 0) return (c.lastDir as number) as -1 | 1;
  const px = ctx.spec.modifiers.includes('ayna') ? 1 - input.pointerX : input.pointerX;
  return px < 0.5 ? -1 : 1;
}

/** İmpuls: üç şerit, çok hızlı, yerçekimi yok. Sol = aşağı şerit, sağ = yukarı şerit, aşağı kaydır = sprint. */
export const impuls: Mechanic = {
  id: 'impuls',
  setup(ctx) {
    const c = custom(ctx); const s = ctx.scene; const b = ctx.hero.body;
    c.lane = 1; c.sprintLeft = -9999; c.sprintCd = 0; c.slowUntil = 0; c.lastDir = 0; c.lastDirAt = -9999; c.lastSwitchAt = -9999;
    c.botNextAt = 0; c.botLastTapAt = -9999; c.sprintVisual = false;
    b.setAllowGravity(false); b.setVelocity(0, 0);
    ctx.hero.sprite.setPosition(ctx.hero.x, LANE_Y[1]);
    // şerit çizgileri (dünya içinde, tonotopi renkleri)
    for (let l = 0; l < 3; l++) s.add.tileSprite(0, laneCenter(l), ctx.worldW, 8, laneLineTexture(s, l)).setOrigin(0, 0.5).setDepth(3);
    // ışık izi
    const trail = s.add.particles(0, 0, dotTexture(s), {
      follow: ctx.hero.sprite, followOffset: { x: -14, y: -24 }, frequency: 28, lifespan: 380, quantity: 1,
      speedX: { min: -70, max: -30 }, speedY: { min: -12, max: 12 }, scale: { start: 1.1, end: 0.15 }, alpha: { start: 0.85, end: 0 },
      tint: [0x4cf0ff, 0x9ad8ff, 0xffffff],
    }).setDepth(19);
    (s as unknown as SceneExtra).__impulsTrail = trail;
    if (ctx.spec.tutorial) { ctx.hint('Sol: aşağı şerit · Sağ: yukarı şerit', 3200); s.time.delayedCall(3400, () => ctx.hint('Aşağı kaydır: sprint (sinaps boşluğunu geç)', 3200)); }
  },
  update(ctx, input, dt) {
    const { hero, state } = ctx; const b = hero.body; const c = custom(ctx); const now = ctx.scene.time.now;
    const pd = physMs(ctx); c.sprintLeft = (c.sprintLeft as number) - pd; c.sprintCd = (c.sprintCd as number) - pd;
    hero.sprite.setFlipY(false); // ters yerçekimi değiştiricisi görseli çevirmesin
    if (input.dir !== 0) { c.lastDir = input.dir; c.lastDirAt = now; }
    // şerit değiştir
    if (input.primaryPressed) {
      const d = chooseDir(ctx, input); const lane = c.lane as number; const next = Math.max(0, Math.min(2, lane + d));
      if (next !== lane) { c.lane = next; c.lastSwitchAt = now; sfx.tick(); ctx.haptic('light'); hero.sprite.setScale(1, 1.12); }
      else sfx.toneAt(220, 0.05);
    }
    // sprint
    if (input.secondaryPressed && (c.sprintCd as number) <= 0) {
      c.sprintLeft = SPRINT_MS; c.sprintCd = SPRINT_CD_MS; sfx.power(); ctx.haptic('medium'); hero.mood('wow', SPRINT_MS);
    }
    const sprinting = isSprinting(ctx);
    if (sprinting !== c.sprintVisual) { c.sprintVisual = sprinting; hero.sprite.setScale(sprinting ? 1.22 : 1, sprinting ? 0.86 : 1); if (sprinting) hero.sprite.setTint(0xbfffff); else if (state.shield === 0) hero.sprite.clearTint(); }
    const trail = (ctx.scene as unknown as SceneExtra).__impulsTrail;
    if (trail) trail.frequency = sprinting ? 12 : 28;
    // hareket: x sabit hız, y şeride yumuşak geçiş (yerçekimi kapalı)
    b.setVelocityX(speedOf(ctx)); b.setVelocityY(0);
    const target = LANE_Y[c.lane as number]!;
    // şerit geçişi fizikle aynı saatte (sahne dt'si 50 ms'e kırpılır)
    const k = 1 - Math.exp(-LANE_SMOOTH * Math.max(dt, pd / 1000));
    const ny = hero.y + (target - hero.y) * k;
    hero.sprite.setY(Math.abs(target - ny) < 0.5 ? target : ny);
    if (!sprinting && hero.sprite.scaleY > 1 && now - (c.lastSwitchAt as number) > 150) hero.sprite.setScale(1, 1);
  },
  spawn(ctx, e, worldX) {
    const s = ctx.scene; const x = worldX + e.x;
    if (e.type === 'lane') {
      const lane = Math.max(0, Math.min(2, Number(e.props?.lane ?? 1)));
      const o = ctx.groups.specials.create(x, laneCenter(lane), obstacleTexture(s, lane)) as Phaser.Physics.Arcade.Sprite;
      o.setDepth(7); o.setData('e', e); o.setData('wx', x); o.setData('lane', lane);
      const body = o.body as Phaser.Physics.Arcade.Body; body.setAllowGravity(false); body.setImmovable(true); body.setSize(OBST_W - 10, OBST_H - 8).setOffset(5, 4);
      s.tweens.add({ targets: o, scaleX: 1.06, scaleY: 0.94, duration: 420 + (x % 200), yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      return true;
    }
    if (e.type === 'hazard' && e.props?.kind === 'sinaps') {
      const w = e.w ?? 48, h = e.h ?? 330; const accent = 0x4cf0ff;
      const o = ctx.groups.specials.create(x + w / 2, e.y + h / 2, sinapsTexture(s, w, h, accent)) as Phaser.Physics.Arcade.Sprite;
      o.setDepth(6); o.setData('e', e); o.setData('wx', x); o.setData('sinaps', true);
      const body = o.body as Phaser.Physics.Arcade.Body; body.setAllowGravity(false); body.setImmovable(true); body.setSize(w - 8, h).setOffset(4, 0);
      s.tweens.add({ targets: o, alpha: 0.55, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      s.add.text(x + w / 2, e.y - 18, 'sinaps', { fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: '700', color: '#bffaff' }).setOrigin(0.5).setDepth(6).setAlpha(0.85);
      return true;
    }
    return false;
  },
  onSpecial(ctx, sprite, e) {
    const now = ctx.scene.time.now;
    if (e.type === 'lane') {
      if (!sprite.active) return true;
      if (now >= ctx.state.invulnUntil) {
        ctx.damage('lane'); ctx.float(sprite.x, sprite.y - 30, 'zap!', '#ff5c5c');
      }
      sprite.destroy(); // temas edilen engel dağılır (hasar alınsa da alınmasa da tekrar vurmaz)
      return true;
    }
    if (e.type === 'hazard' && e.props?.kind === 'sinaps') {
      if (isSprinting(ctx, 90)) {
        if (!sprite.getData('passed')) { sprite.setData('passed', true); ctx.state.score += 30; ctx.float(ctx.hero.x, ctx.hero.y - 70, 'Sinaps! +30', '#4cf0ff'); sfx.toneAt(1760, 0.08); }
      } else if (now >= ctx.state.invulnUntil) {
        ctx.damage('sinaps');
      }
      return true;
    }
    return false;
  },
  onDamage(ctx) { custom(ctx).slowUntil = ctx.scene.time.now + 700; },
  botTick(ctx, input) {
    const c = custom(ctx); const now = ctx.scene.time.now; const hx = ctx.hero.x;
    input.virtual = null;
    if (now < (c.botNextAt as number)) return;
    const speed = speedOf(ctx); const lane = c.lane as number;
    type Ob = { lane: number; d: number };
    const obs: Ob[] = []; let sinapsD = Infinity;
    for (const o of ctx.groups.specials.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
      if (!o.active || !o.body) continue; const e = o.getData('e') as Entity | undefined; if (!e) continue;
      if (e.type === 'lane') { const d = o.x - hx; if (d > -50 && d < 700) obs.push({ lane: Number(o.getData('lane')), d }); }
      else if (o.getData('sinaps')) { const d = (o.body as Phaser.Physics.Arcade.Body).left - hx; if (d > -30 && d < sinapsD) sinapsD = d; }
    }
    for (const g of [ctx.groups.hazards, ctx.groups.enemies]) {
      for (const o of g.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
        if (!o.active || !o.body) continue; const b = o.body as Phaser.Physics.Arcade.Body; const d = b.left - hx;
        if (d > -50 && d < 700) obs.push({ lane: laneOf(b.center.y), d });
      }
    }
    // sinaps boşluğu: sprint
    if (sinapsD <= 240 && (c.sprintCd as number) <= 0) { input.swipeDown(); c.botNextAt = now + 100; return; }
    const firstObs = (l: number, from = -45) => { let m = Infinity; for (const o of obs) if (o.lane === l && o.d >= from && o.d < m) m = o.d; return m; };
    const coinAhead = (l: number, range: number) => { for (const o of ctx.groups.coins.getChildren() as Phaser.Physics.Arcade.Sprite[]) { if (!o.active) continue; const d = o.x - hx; if (d > 10 && d < range && laneOf(o.y) === l) return true; } return false; };
    const tapTo = (l: number) => { input.virtual = { dir: l > lane ? 1 : -1 }; input.tap(); c.botNextAt = now + 130; c.botLastTapAt = now; };
    const look = 300 + Math.max(0, speed - 380) * 0.4;
    const minFree = 70 + speed * 0.12; // yanındaki şeride geçiş süresi kadar boşluk gerekir
    const cur = firstObs(lane);
    if (cur < look) {
      let best = -1, bestScore = -Infinity, bestF = 0;
      for (const l of [lane - 1, lane + 1]) {
        if (l < 0 || l > 2) continue; const f = firstObs(l);
        if (f < minFree) continue; // engelin içine geçme
        // iki şeridi kapatan duvar: yandaki şerit de kapalıysa ama onun ötesi açıksa iki adımlı yol (önce yana, sonra öteye)
        let eff = f; const beyond = l + (l - lane);
        if (f <= cur + 40 && beyond >= 0 && beyond <= 2) { const fb = firstObs(beyond); if (fb > cur + 40) eff = fb; }
        const score = Math.min(eff, 700) + (coinAhead(l, 300) ? 60 : 0) + (l === 1 ? 5 : 0);
        if (score > bestScore) { bestScore = score; best = l; bestF = eff; }
      }
      // yalnızca durumu iyileştiriyorsa (ya da engel çok yakınsa) geç; aksi halde yandaki engel geçene dek bekle
      if (best >= 0 && (bestF > cur + 40 || cur < 150)) tapTo(best);
      return;
    }
    // jeton eğilimi
    if (now - (c.botLastTapAt as number) > 450 && !coinAhead(lane, 320)) {
      for (const l of [lane - 1, lane + 1]) {
        if (l < 0 || l > 2) continue;
        if (coinAhead(l, 260) && firstObs(l) > 450) { tapTo(l); return; }
      }
    }
  },
  teardown(ctx) { (ctx.scene as unknown as SceneExtra).__impulsTrail = undefined; },
};
