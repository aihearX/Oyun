import type Phaser from 'phaser';
import type { Entity } from '@odi/shared';
import { GROUND_Y } from '@odi/shared';
import { BIOMES } from '@odi/content';
import { spawnEntity } from '../entities';
import type { LevelContext } from './types';

/**
 * Trambolin ve makine mekaniklerinin ortak yardımcıları: dünya geometrisi, balistik yörünge
 * simülasyonu (bot kararları için) ve melodi notalarının bölüm genelinde sıralı numaralanması.
 */

export const GRAVITY = 1400;
/** kahraman gövdesi (hero.ts: 48×0.7, 48×0.9) */
export const HERO_HW = 17; export const HERO_H = 43;

export interface Box { l: number; t: number; r: number; b: number; sprite: Phaser.Physics.Arcade.Sprite; e: Entity; /** hareketli platform hızı (px/s) */ vx?: number; vy?: number }
export interface Circle { x: number; y: number; r: number; sprite: Phaser.Physics.Arcade.Sprite; e: Entity }
export interface Geometry { supports: Box[]; hazards: Box[]; bouncers: Box[]; gears: Circle[]; coins: { x: number; y: number }[] }

type ASprite = Phaser.Physics.Arcade.Sprite;
const alive = (g: Phaser.Physics.Arcade.Group | Phaser.Physics.Arcade.StaticGroup) => (g.getChildren() as ASprite[]).filter((o) => o.active && o.body);
const box = (o: ASprite, pad = 0): Box => { const b = o.body as Phaser.Physics.Arcade.Body; return { l: b.left - pad, t: b.top, r: b.right + pad, b: b.bottom, sprite: o, e: o.getData('e') as Entity }; };

/** kahramanın çevresindeki (geride 240, ileride `range` px) gövdeleri toplar */
export function geometry(ctx: LevelContext, range = 1000): Geometry {
  const hx = ctx.hero.x; const lo = hx - 240, hi = hx + range;
  const within = (o: ASprite) => { const b = o.body as Phaser.Physics.Arcade.Body; return b.right >= lo && b.left <= hi; };
  const g: Geometry = { supports: [], hazards: [], bouncers: [], gears: [], coins: [] };
  for (const o of alive(ctx.groups.platforms)) if (within(o)) g.supports.push(box(o));
  const now = ctx.scene.time.now;
  for (const o of alive(ctx.groups.movers)) {
    // tween ile taşınan platform: son konumdan hız kestir (bot yörüngesi için)
    const pv = o.getData('mv') as { x: number; y: number; t: number } | undefined; const bx = box(o);
    if (pv && now - pv.t > 8 && now - pv.t < 600) { const k = 1000 / (now - pv.t); bx.vx = (o.x - pv.x) * k; bx.vy = (o.y - pv.y) * k; }
    o.setData('mv', { x: o.x, y: o.y, t: now });
    if (within(o)) g.supports.push(bx);
  }
  for (const o of alive(ctx.groups.hazards)) if (within(o)) g.hazards.push(box(o));
  for (const o of alive(ctx.groups.enemies)) if (within(o)) { const dx = Math.abs(Number((o.getData('e') as Entity).props?.dx ?? 60)); g.hazards.push(box(o, dx)); }
  for (const o of alive(ctx.groups.specials)) {
    if (!within(o)) continue; const e = o.getData('e') as Entity;
    if (e.type === 'trampoline' || e.type === 'spring') g.bouncers.push(box(o));
    else if (e.type === 'gear') g.gears.push({ x: o.x, y: o.y, r: Number(e.props?.r ?? 40), sprite: o, e });
  }
  for (const o of alive(ctx.groups.coins)) if (within(o)) g.coins.push({ x: o.x, y: o.y });
  return g;
}

export interface SimStart {
  x: number; /** ayak */ y: number; vx: number; vy: number;
  /** basılı tutma: ilk 0.22 s düşük yerçekimi (koşu/makine zıplaması) */
  lowGravUntil?: number;
  /** bırakma anı (s): o anda hâlâ yükseliyorsa hız ×0.55 */
  releaseAt?: number;
  /** süzülme: düşüş hızı sınırı */
  floatCap?: number;
  /** ilk `ignoreUntil` saniye bu dişli yok sayılır (fırlatıldığı dişli) */
  ignoreGear?: Circle | null; ignoreUntil?: number;
  /** kayma: gövde alçak (ilk 0.5 s) */
  slideUntil?: number;
  maxT?: number;
  /** inişten sonra koşmaya devam süresi (s); varsayılan 0.3 — sonrası yeni karar */
  postLand?: number;
  /** yerdeyken yatay hız (fırlatma sonrası iniş: koşu hızına döner); yoksa vx */
  runVx?: number;
}
export type SimKind = 'ok' | 'hazard' | 'fall' | 'stuck' | 'gear' | 'bounce';
export interface SimResult { kind: SimKind; x: number; y: number; t: number; coins: number; landX: number | null; landT: number | null; gear: Circle | null; bouncer: Box | null; vy: number }

/** Sabit yatay hızla balistik/koşu yörüngesi. Zeminde koşar, boşlukta düşer; ilk olayda durur (tehlike, düşüş, duvar, dişli, trambolin). */
export function simulate(geo: Geometry, s: SimStart): SimResult {
  const dt = 1 / 60; const maxT = s.maxT ?? 3;
  let x = s.x, y = s.y, vy = s.vy, t = 0; let landX: number | null = null, landT: number | null = null;
  const seen = new Set<number>(); let coins = 0;
  const done = (kind: SimKind, extra: Partial<SimResult> = {}): SimResult => ({ kind, x, y, t, coins, landX, landT, gear: null, bouncer: null, vy, ...extra });
  type R = { l: number; t: number; r: number; b: number };
  const at = (b: Box, tt: number): R => (b.vx || b.vy) ? { l: b.l + (b.vx ?? 0) * tt, r: b.r + (b.vx ?? 0) * tt, t: b.t + (b.vy ?? 0) * tt, b: b.b + (b.vy ?? 0) * tt } : b;
  const supportAt = (px: number, feet: number, tt: number): R | null => { let best: R | null = null; for (const b0 of geo.supports) { const b = at(b0, tt); if (px < b.l - 12 || px > b.r + 12) continue; if (Math.abs(b.t - feet) <= 4 && (!best || b.t < best.t)) best = b; } return best; };
  let grounded = !!supportAt(x, y, 0) && vy >= 0;
  while (t < maxT) {
    if (landT != null && t - landT >= (s.postLand ?? 0.3)) return done('ok');
    const prevY = y; const hh = s.slideUntil != null && t < s.slideUntil ? 22 : HERO_H;
    if (grounded) { vy = 0; const sup = supportAt(x, y, t); if (!sup) grounded = false; else y = sup.t; }
    if (!grounded) {
      const low = s.lowGravUntil != null && t < s.lowGravUntil && vy < 0;
      vy += (low ? GRAVITY * 0.55 : GRAVITY) * dt;
      if (s.floatCap != null && vy > s.floatCap) vy = s.floatCap;
      y += vy * dt;
    }
    x += (grounded && s.runVx != null ? s.runVx : s.vx) * dt; t += dt;
    if (s.releaseAt != null && t >= s.releaseAt && t - dt < s.releaseAt && vy < 0) vy *= 0.55;
    const hl = x - HERO_HW, hr = x + HERO_HW, ht = y - hh;
    // jetonlar
    geo.coins.forEach((c, i) => { if (!seen.has(i) && Math.abs(c.x - x) < 30 && c.y > ht - 14 && c.y < y + 14) { seen.add(i); coins++; } });
    // tehlike
    for (const h of geo.hazards) if (hr > h.l && hl < h.r && y > h.t && ht < h.b) return done('hazard');
    // dişli
    for (const g of geo.gears) {
      if (s.ignoreGear && g.sprite === s.ignoreGear.sprite && t < (s.ignoreUntil ?? 0.45)) continue;
      const cx = x, cy = y - HERO_H / 2; const d = Math.hypot(cx - g.x, cy - g.y);
      if (d <= g.r + 18) return done('gear', { gear: g });
    }
    // trambolin / yay (yalnızca düşerken veya yerde yürürken temas)
    for (const b of geo.bouncers) {
      if (hr <= b.l || hl >= b.r) continue;
      const fromAbove = vy > 0 && prevY <= b.t + 10 && y >= b.t - 2;
      const walkIn = grounded && Math.abs(y - b.b) <= 6;
      if (fromAbove || walkIn) return done('bounce', { bouncer: b, x, y: b.t });
    }
    if (!grounded) {
      // iniş
      if (vy >= 0) {
        let land: R | null = null;
        for (const b0 of geo.supports) { const b = at(b0, t); if (x < b.l - 12 || x > b.r + 12) continue; if (prevY <= b.t + 1 && y >= b.t - 1) { if (!land || b.t < land.t) land = b; } }
        if (land) { y = land.t; vy = 0; grounded = true; if (landX == null) { landX = x; landT = t; } continue; }
      }
      // duvar / tavan
      for (const b0 of geo.supports) { const b = at(b0, t); if (hr > b.l + 2 && hl < b.r - 2 && y > b.t + 6 && ht < b.b - 2) return done('stuck'); }
      if (y > GROUND_Y + 400) return done('fall');
    } else {
      for (const b0 of geo.supports) { const b = at(b0, t); if (hr > b.l + 2 && hl < b.r - 2 && b.t < y - 6 && b.b > y - hh + 4) return done('stuck'); }
    }
  }
  return done('ok');
}

/** Melodi notaları: parça içi idx'i, bölüm genelinde sıralı numaraya çevirir (otomatik koşuda toplama sırası = x sırası). */
export function spawnNoteSequenced(ctx: LevelContext, e: Entity, worldX: number): boolean {
  if (e.type !== 'note') return false;
  const seq = Number(ctx.state.custom.noteSeq ?? 0); ctx.state.custom.noteSeq = seq + 1;
  const t = e.props?.t ?? (ctx.state.notesNeeded > 1 ? seq / (ctx.state.notesNeeded - 1) : 0.5);
  spawnEntity(ctx, { ...e, props: { ...(e.props ?? {}), idx: seq, t } }, worldX, BIOMES[ctx.spec.biome]);
  return true;
}

/** kahraman yerde mi */
export function grounded(ctx: LevelContext): boolean { const b = ctx.hero.body; return b.blocked.down || b.touching.down; }
