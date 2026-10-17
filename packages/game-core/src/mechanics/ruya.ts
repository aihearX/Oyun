import Phaser from 'phaser';
import type { Entity } from '@odi/shared';
import { GROUND_Y } from '@odi/shared';
import { BIOMES } from '@odi/content';
import type { Mechanic, LevelContext } from './types';
import { sfx } from '../audio';
import { spawnEntity } from '../entities';

const RUN_SPEED = 270;
const GRAVITY = 1400;
const FLIP_CD_MS = 120;
const FLIP_PUSH = 160;
const SLIDE_MS = 650;
/** Tavan altı (parçalardaki tavan platformu y=60, h=40). */
const CEIL_BOTTOM = 100;
const MID_Y = (GROUND_Y + CEIL_BOTTOM) / 2;

const custom = (ctx: LevelContext) => ctx.state.custom;
const dirOf = (ctx: LevelContext) => (custom(ctx).ruyaDir as number) === -1 ? -1 : 1;
const grounded = (ctx: LevelContext) => { const b = ctx.hero.body; return dirOf(ctx) === 1 ? b.blocked.down || b.touching.down : b.blocked.up || b.touching.up; };

/** Yerçekimini mekanik yönetir: her kare dünya yerçekimi, state.gravityDir ve sprite yönü kendi değerine yazılır. */
function applyGravity(ctx: LevelContext) {
  const d = dirOf(ctx) as 1 | -1;
  ctx.state.gravityDir = d;
  ctx.scene.physics.world.gravity.y = GRAVITY * d;
  ctx.hero.sprite.setFlipY(d === -1);
}

/** Sprite kökenini yüzeye göre değiştirir: zeminde (0.5,1), tavanda (0.5,0). Görsel yerinde kalır. */
function setOriginFor(ctx: LevelContext, d: 1 | -1) {
  const s = ctx.hero.sprite;
  const top = s.originY === 1 ? s.y - s.displayHeight : s.y;
  if (d === -1) { s.setOrigin(0.5, 0); s.setY(top); } else { s.setOrigin(0.5, 1); s.setY(top + s.displayHeight); }
}

function flip(ctx: LevelContext, forced = false) {
  const c = custom(ctx); const now = ctx.scene.time.now;
  const d = (dirOf(ctx) === 1 ? -1 : 1) as 1 | -1;
  c.ruyaDir = d; c.flipReadyAt = now + FLIP_CD_MS; c.lastFlipAt = now; c.slideUntil = 0;
  resetHitbox(ctx);
  setOriginFor(ctx, d);
  applyGravity(ctx);
  ctx.hero.body.setVelocityY(FLIP_PUSH * d);
  ctx.hero.stretch(); ctx.haptic(forced ? 'medium' : 'light');
  if (forced) sfx.bounce(); else sfx.toneAt(d === -1 ? 660 : 440, 0.09);
}

function resetHitbox(ctx: LevelContext) {
  ctx.hero.body.setSize(34, 44).setOffset(7, 4);
  if (ctx.hero.sprite.scaleY < 1) ctx.hero.sprite.setScale(1, 1);
}

function starTexture(s: Phaser.Scene): string {
  const key = 'ruya-star';
  if (s.textures.exists(key)) return key;
  const g = s.add.graphics(); g.fillStyle(0xffffff, 1);
  g.fillTriangle(8, 0, 10, 6, 16, 8); g.fillTriangle(16, 8, 10, 10, 8, 16); g.fillTriangle(8, 16, 6, 10, 0, 8); g.fillTriangle(0, 8, 6, 6, 8, 0);
  g.fillCircle(8, 8, 3); g.generateTexture(key, 16, 16); g.destroy();
  return key;
}
function flipTexture(s: Phaser.Scene, accent: number): string {
  const key = `ruya-flip-${accent}`;
  if (s.textures.exists(key)) return key;
  const g = s.add.graphics(); g.fillStyle(accent, 0.25); g.fillCircle(22, 22, 21); g.lineStyle(4, accent, 1); g.strokeCircle(22, 22, 20);
  g.lineStyle(4, 0xffffff, 0.95); g.beginPath(); g.arc(22, 22, 11, Math.PI * 0.1, Math.PI * 1.5); g.strokePath();
  g.fillStyle(0xffffff, 1); g.fillTriangle(22, 6, 30, 12, 22, 18);
  g.generateTexture(key, 44, 44); g.destroy();
  return key;
}
function blockTexture(s: Phaser.Scene, w: number, h: number, color: number): string {
  const key = `ruya-blok-${w}x${h}-${color}`;
  if (s.textures.exists(key)) return key;
  const g = s.add.graphics(); g.fillStyle(color, 1); g.fillRoundedRect(0, 0, w, h, 10);
  g.fillStyle(0xffffff, 0.22); g.fillRoundedRect(5, 5, w - 10, Math.max(6, h * 0.22), 5);
  g.lineStyle(2, 0xffffff, 0.35); g.strokeRoundedRect(1, 1, w - 2, h - 2, 10);
  g.generateTexture(key, w, h); g.destroy();
  return key;
}

function addStar(s: Phaser.Scene, x: number, y: number, rng: () => number) {
  const st = s.add.image(x, y, starTexture(s)).setDepth(2).setScale(0.5 + rng() * 0.7).setAlpha(0.35 + rng() * 0.4).setTint(rng() < 0.5 ? 0xffffff : 0xffd6f0);
  s.tweens.add({ targets: st, alpha: 0.1, scale: st.scale * 0.6, angle: 25, duration: 900 + rng() * 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: rng() * 1000 });
}

/** Rüya arka planı: sky ↔ bgMid arasında hafif kayma (önbellekli, 46 adım). */
const dreamCache = new Map<string, number[]>();
function dreamColor(biome: keyof typeof BIOMES, t: number): number {
  let arr = dreamCache.get(biome);
  if (!arr) {
    const p = BIOMES[biome].palette; const a = Phaser.Display.Color.ValueToColor(p.sky), b = Phaser.Display.Color.ValueToColor(p.bgMid);
    arr = Array.from({ length: 46 }, (_, i) => { const m = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, i); return Phaser.Display.Color.GetColor(m.r, m.g, m.b); });
    dreamCache.set(biome, arr);
  }
  return arr[Math.max(0, Math.min(45, Math.round(t * 45)))]!;
}

type Threat = { left: number; right: number; top: number; bottom: number; surface: 1 | -1; clearance: number; solid: boolean };
function threats(ctx: LevelContext): Threat[] {
  const out: Threat[] = [];
  const push = (b: Phaser.Physics.Arcade.Body, solid: boolean) => {
    const surface: 1 | -1 = b.center.y > MID_Y ? 1 : -1;
    const clearance = surface === 1 ? GROUND_Y - b.bottom : b.top - CEIL_BOTTOM;
    out.push({ left: b.left, right: b.right, top: b.top, bottom: b.bottom, surface, clearance, solid });
  };
  for (const g of [ctx.groups.hazards, ctx.groups.enemies]) for (const o of g.getChildren() as Phaser.Physics.Arcade.Sprite[]) { if (o.active && o.body) push(o.body as Phaser.Physics.Arcade.Body, false); }
  for (const o of ctx.groups.platforms.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
    if (!o.active || !o.body) continue; const e = o.getData('e') as Entity | undefined; if (!e) continue;
    const isBlock = e.props?.kind === 'blok' || ((e.h ?? 24) < 100 && (e.w ?? 128) <= 240 && e.props?.kind !== 'tavan');
    if (isBlock) push(o.body as Phaser.Physics.Arcade.Body, true);
  }
  return out;
}

/** Rüya: koşu temelli; dokun = yerçekimini çevir (zemin ↔ tavan). Zıplama yok. Aşağı kaydır: kısa kayma. */
export const ruya: Mechanic = {
  id: 'ruya',
  setup(ctx) {
    const c = custom(ctx); const s = ctx.scene; const biome = BIOMES[ctx.spec.biome];
    c.manualGravity = true; c.ruyaDir = 1; c.flipReadyAt = 0; c.lastFlipAt = -9999; c.slideUntil = 0; c.lastX = ctx.hero.x; c.stuckTicks = 0; c.botNextAt = 0; c.hue = 0;
    // ters-yerçekimi değiştiricisinin eklediği ikinci tavan (y=GROUND_Y-520) rüya tavanıyla çakışır: kaldır
    for (const o of ctx.groups.platforms.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
      const e = o.getData('e') as Entity | undefined;
      if (e && e.type === 'platform' && e.y === GROUND_Y - 520 && e.h === 40 && (e.w ?? 0) > 200) o.destroy();
    }
    // başlangıç ve bitiş dolgularına tavan (parçalarda tavan var, dolgularda yok)
    spawnEntity(ctx, { type: 'platform', x: 0, y: CEIL_BOTTOM - 40, w: 230, h: 40, props: { kind: 'tavan' } }, 0, biome);
    spawnEntity(ctx, { type: 'platform', x: ctx.worldW - 270, y: CEIL_BOTTOM - 40, w: 270, h: 40, props: { kind: 'tavan' } }, 0, biome);
    // kamera: iki yüzey de görünsün (dikey kaydırma sabit)
    s.cameras.main.setBounds(0, -40, ctx.worldW, 780);
    // rüya rengi: arka plan biyom paletinden, hafif kayma update'te
    s.cameras.main.setBackgroundColor(biome.palette.sky);
    // yıldız/sinaps parıltıları
    for (let i = 0; i < Math.min(140, ctx.worldW / 60); i++) addStar(s, 120 + ctx.rng() * (ctx.worldW - 200), 150 + ctx.rng() * 400, ctx.rng);
    applyGravity(ctx); resetHitbox(ctx);
    if (ctx.spec.tutorial) { ctx.hint('Dokun: yerçekimini çevir', 3200); s.time.delayedCall(3400, () => ctx.hint('Aşağı kaydır: kay (tavanda da)', 2800)); }
    else if (ctx.spec.modifiers.includes('ters-yercekimi')) s.time.delayedCall(1200, () => ctx.hint('Rüya: yerçekimi senin elinde — dokun ve çevir', 2600));
  },
  update(ctx, input, dt) {
    const { hero, state } = ctx; const b = hero.body; const c = custom(ctx); const now = ctx.scene.time.now; const s = ctx.scene;
    // yeniden doğma (düşme sonrası LevelScene kahramanı kontrol noktasına, zemine koyar)
    if (hero.x < (c.lastX as number) - 60) { c.ruyaDir = 1; c.slideUntil = 0; resetHitbox(ctx); hero.sprite.setOrigin(0.5, 1); hero.sprite.setY(GROUND_Y - 10); }
    c.lastX = hero.x;
    // ters-yerçekimi değiştiricisi aradaki karede çevirdiyse geri al
    const wasGrounded = c.wasGrounded === true;
    if (state.gravityDir !== dirOf(ctx)) { applyGravity(ctx); if (wasGrounded) b.setVelocityY(0); }
    else applyGravity(ctx);
    const d = dirOf(ctx) as 1 | -1; const g = grounded(ctx);
    c.wasGrounded = g;
    b.setVelocityX(RUN_SPEED * state.speedMult);
    // kayma: hitbox küçülür (her iki yüzeyde); kayarken tekrar kaydırmak süreyi tazeler
    if (input.secondaryPressed && g) { const fresh = (c.slideUntil as number) <= now; c.slideUntil = now + (ctx.skills.longSlide ? 1000 : SLIDE_MS); if (fresh) { sfx.tick(); ctx.haptic('light'); } }
    const sliding = (c.slideUntil as number) > now;
    if (sliding) { b.setSize(34, 22).setOffset(7, d === 1 ? 26 : 0); hero.sprite.setScale(1.1, 0.55); }
    else { b.setSize(34, 44).setOffset(7, 4); if (!(hero.sprite.scaleY < 1) || now > (c.slideUntil as number) + 120) hero.sprite.setScale(1, 1); }
    if (input.primaryPressed && now >= (c.flipReadyAt as number)) flip(ctx);
    // arka plan: hafif renk kayması (sky ↔ bgMid)
    c.hue = ((c.hue as number) + dt) % 1000;
    const t = 0.5 + 0.5 * Math.sin((c.hue as number) * 0.7);
    s.cameras.main.setBackgroundColor(dreamColor(ctx.spec.biome, t));
  },
  spawn(ctx, e, worldX) {
    const s = ctx.scene; const x = worldX + e.x; const p = BIOMES[ctx.spec.biome].palette;
    if (e.type === 'decor') {
      const n = Number(e.props?.n ?? 3);
      for (let i = 0; i < n; i++) addStar(s, x + (ctx.rng() - 0.5) * 120, e.y + (ctx.rng() - 0.5) * 120, ctx.rng);
      return true;
    }
    if (e.type === 'flip') {
      const o = ctx.groups.specials.create(x, e.y, flipTexture(s, p.accent)) as Phaser.Physics.Arcade.Sprite;
      o.setDepth(8); o.setData('e', e); o.setData('wx', x);
      const body = o.body as Phaser.Physics.Arcade.Body; body.setAllowGravity(false); body.setImmovable(true); body.setCircle(20, 2, 2);
      s.tweens.add({ targets: o, angle: 360, duration: 2400, repeat: -1 });
      return true;
    }
    if (e.type === 'platform' && e.props?.kind === 'blok') {
      const w = e.w ?? 60, h = e.h ?? 50;
      const o = ctx.groups.platforms.create(x + w / 2, e.y + h / 2, blockTexture(s, w, h, p.accent)) as Phaser.Physics.Arcade.Sprite;
      o.setDepth(6); o.setData('e', e); o.setData('wx', x); o.refreshBody();
      return true;
    }
    return false;
  },
  onSpecial(ctx, sprite, e) {
    if (e.type !== 'flip') return false;
    const now = ctx.scene.time.now;
    if (now - Number(sprite.getData('usedAt') ?? -9999) < 1200) return true;
    sprite.setData('usedAt', now);
    flip(ctx, true); ctx.float(sprite.x, sprite.y - 30, 'çevrildi!', '#7c5cff'); ctx.flash(0xffffff);
    ctx.scene.tweens.add({ targets: sprite, scale: 1.4, duration: 120, yoyo: true });
    return true;
  },
  botTick(ctx, input) {
    const c = custom(ctx); const now = ctx.scene.time.now; const b = ctx.hero.body;
    if (now < (c.botNextAt as number)) return;
    const d = dirOf(ctx) as 1 | -1; const other = (-d) as 1 | -1; const g = grounded(ctx);
    const speed = RUN_SPEED * ctx.state.speedMult; const front = b.right;
    const list = threats(ctx);
    const nearest = (surface: 1 | -1, from: number, to: number): Threat | null => {
      let best: Threat | null = null; let bd = Infinity;
      for (const t of list) { if (t.surface !== surface) continue; const dist = t.left - front; if (t.right - front < from || dist > to) continue; if (dist < bd) { bd = dist; best = t; } }
      return best;
    };
    const dist = (t: Threat | null) => (t ? t.left - front : Infinity);
    const tap = () => { input.tap(); c.botNextAt = now + 140; };
    const canFlip = now >= (c.flipReadyAt as number);
    // iniş penceresi: çevirince diğer yüzeye ~0.6–0.8 s sonra varılır
    const landLo = speed * 0.55 - 50, landHi = speed * 0.85 + 70;
    if (g) {
      const cur = nearest(d, -10, 600); const cd = dist(cur);
      const reach = 125 + speed * 0.08;
      if (cur) {
        const slideable = !cur.solid && cur.clearance >= 20;
        // tehdit üstümüzde/hemen önümüzde ve altından geçilebilir: çevirme (yükselirken çarparız), kaymaya devam
        if (slideable && cd <= 30) { if ((c.slideUntil as number) - now < 170) { input.swipeDown(); c.botNextAt = now + 70; } return; }
        if (cd <= reach) {
          const otherSafe = !nearest(other, landLo, landHi);
          if (otherSafe && canFlip) tap();
          else if (slideable && cd <= 110) { if ((c.slideUntil as number) - now < 170) { input.swipeDown(); c.botNextAt = now + 70; } }
          else if (!slideable && canFlip && cd <= reach * 0.8) tap();
          return;
        }
      }
      // takıldı (blok): çevir
      if (Math.abs(b.velocity.x) < 40) { c.stuckTicks = (c.stuckTicks as number) + 1; if ((c.stuckTicks as number) >= 2 && canFlip) { c.stuckTicks = 0; tap(); return; } } else c.stuckTicks = 0;
      // jeton eğilimi: diğer yüzey güvenliyse ve orada jeton varsa
      if (now - (c.lastFlipAt as number) > 900 && cd > 520 && !nearest(other, -10, 560)) {
        let here = false, there = false;
        for (const o of ctx.groups.coins.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
          if (!o.active) continue; const dx = o.x - front; if (dx < 40 || dx > 340) continue;
          const surf: 1 | -1 = o.y > MID_Y ? 1 : -1; if (Math.abs(o.y - MID_Y) < 120) continue;
          if (surf === d) here = true; else there = true;
        }
        if (there && !here && canFlip) tap();
      }
      return;
    }
    // havada: iniş yüzeyi tehlikeliyse ve geldiğin yüzey güvenliyse geri çevir
    const rem = d === 1 ? GROUND_Y - b.bottom : b.top - CEIL_BOTTOM; // kalan dikey yol
    if (rem < 60) return;
    const vy = b.velocity.y * d; const tRem = (-vy + Math.sqrt(vy * vy + 2 * GRAVITY * rem)) / GRAVITY; // hedef yüzeye doğru hız
    const adv = speed * tRem;
    const landing = nearest(d, adv - 60, adv + 60);
    if (landing && canFlip && !nearest(other, adv - 60, adv + 160)) tap();
  },
  teardown(ctx) { ctx.scene.physics.world.gravity.y = GRAVITY; ctx.hero.sprite.setOrigin(0.5, 1).setFlipY(false); },
};
