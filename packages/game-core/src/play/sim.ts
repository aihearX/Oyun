import { GROUND_Y } from '@odi/shared';
import type { AbilityId } from '@odi/shared';
import * as C from './consts';
import { near, type WEnt, type World } from './world';
import { bossInit, bossSolid, bossStep, cloneBoss, type BossState } from './boss';

/**
 * Deterministik oynanış adımı (Phaser'sız). `step(world, state, input)` durumu 1/60 sn ilerletir.
 * Aynı adım hem oyunda hem bot planlayıcısında (ileriye simülasyon) hem de birim testlerinde kullanılır.
 *
 * Kahraman: ayak noktası (x, y), yerçekimi yönü g (+1 aşağı, −1 yukarı). Otomatik koşu: yerde vx = dir·RUN.
 * Girdi tek elle: dokun/basılı tut (down/pressed/released), aşağı kaydır (swipeDown), ileri kaydır (dash).
 */

/** turn: koşunun tersine yatay kaydırma → geri dön (1. bölümden beri; havada da, duvarda/kancada değil) */
export interface SimInput { down: boolean; pressed: boolean; released: boolean; swipeDown: boolean; dash: boolean; turn?: boolean }
export const NO_INPUT: SimInput = Object.freeze({ down: false, pressed: false, released: false, swipeDown: false, dash: false, turn: false });

export interface HeroS {
  x: number; y: number; vx: number; vy: number; dir: 1 | -1; g: 1 | -1;
  grounded: boolean; groundId: number; coyote: number; buffer: number; held: boolean;
  /** zıplamanın yükselişi (bırakınca kesilir) */ jumpRise: boolean; cut: boolean;
  slide: number; pound: boolean; dash: number; dashCd: number; airDash: boolean;
  wallId: number; wallClimb: number; wallLockId: number; wallLock: number; stall: number; blockedT: number;
  hookId: number; hookAng: number; hookW: number; hookL: number; hookLockId: number; hookLock: number;
  water: number; breath: number; grav: boolean;
  color: number; echoUntil: number; invuln: number; airJumps: number;
  tramp: number; trampId: number; launched: boolean; launchId: number; launchLock: number;
  glideT: number; odo: number; knock: number; poundLandT: number;
  /** geri dönüş bekleme süresi (titreşen çift kaydırma tek dönüş sayılsın) */ turnCd: number;
}

export interface SimEvent { k: string; x: number; y: number; id?: number; s?: string; n?: number }

export interface SafeSpot { x: number; y: number; dir: 1 | -1; odo: number }

export interface SimState {
  t: number; n: number; hero: HeroS;
  lives: number; shield: number; revir: boolean; deaths: number; damageTaken: number;
  coins: number; cochleas: number; notes: number; nextNote: number; stomps: number;
  finished: boolean; failed: string | null;
  cp: SafeSpot; cpX: number; safe: SafeSpot[]; lastGroundOdo: number;
  collected: Set<number>; killed: Map<number, number>; broken: Set<number>; opened: Set<string>;
  crumble: Map<number, number>; timers: Map<number, number>; lifts: Map<number, { off: number; lastOn: number; prev: number }>;
  escort: { x: number; y: number; alive: boolean } | null;
  magnetUntil: number; speedUntil: number;
  modInverted: boolean; modNext: number;
  delayQ: { at: number; inp: SimInput }[]; lastDown: boolean;
  beatOff: number;
  boss: BossState | null;
  /** null: olay kaydı yok (planlayıcı kopyaları) */
  events: SimEvent[] | null;
}

export function newHero(x: number, y: number): HeroS {
  return {
    x, y, vx: 0, vy: 0, dir: 1, g: 1, grounded: true, groundId: -1, coyote: 0, buffer: 0, held: false, jumpRise: false, cut: false,
    slide: 0, pound: false, dash: 0, dashCd: 0, airDash: false,
    wallId: -1, wallClimb: 0, wallLockId: -1, wallLock: 0, stall: 0, blockedT: 0,
    hookId: -1, hookAng: 0, hookW: 0, hookL: 0, hookLockId: -1, hookLock: 0,
    water: -1, breath: C.BREATH, grav: false, color: -1, echoUntil: -1, invuln: 0, airJumps: 0,
    tramp: 0, trampId: -1, launched: false, launchId: -1, launchLock: 0, glideT: 0, odo: 0, knock: 0, poundLandT: -1, turnCd: 0,
  };
}

export interface InitOpts { lives?: number; shield?: number; revir?: boolean }

export function initState(w: World, o: InitOpts = {}): SimState {
  const h = newHero(w.startX, w.startY);
  const spot: SafeSpot = { x: w.startX, y: w.startY, dir: 1, odo: 0 };
  const s: SimState = {
    t: 0, n: 0, hero: h, lives: w.mods.tekCan ? 1 : (o.lives ?? 3), shield: o.shield ?? (w.skills.shield > 0 ? 1 : 0), revir: !!o.revir, deaths: 0, damageTaken: 0,
    coins: 0, cochleas: 0, notes: 0, nextNote: 0, stomps: 0, finished: false, failed: null,
    cp: spot, cpX: w.startX, safe: [spot], lastGroundOdo: 0,
    collected: new Set(), killed: new Map(), broken: new Set(), opened: new Set(), crumble: new Map(), timers: new Map(), lifts: new Map(),
    escort: null, magnetUntil: 0, speedUntil: 0, modInverted: false, modNext: C.MOD_FLIP_EVERY,
    delayQ: [], lastDown: false, beatOff: 0, boss: null, events: [],
  };
  h.breath = breathMax(w);
  if (w.boss) bossInit(w, s);
  return s;
}

/** planlayıcı için ucuz kopya (olay kaydı kapalı) */
export function cloneState(s: SimState): SimState {
  return {
    ...s, hero: { ...s.hero }, cp: s.cp, safe: s.safe.slice(-8),
    collected: new Set(s.collected), killed: new Map(s.killed), broken: new Set(s.broken), opened: new Set(s.opened),
    crumble: new Map(s.crumble), timers: new Map(s.timers), lifts: new Map([...s.lifts].map(([k, v]) => [k, { ...v }])),
    escort: s.escort ? { ...s.escort } : null, delayQ: s.delayQ.slice(), boss: s.boss ? cloneBoss(s.boss) : null, events: null,
  };
}

export const has = (w: World, a: AbilityId) => w.abilities.has(a);
/** yerçekimi yönünü değiştir: gövde yerinde kalsın diye ayak noktası başın olduğu yere taşınır */
function setG(h: HeroS, g: 1 | -1) { if (h.g === g) return; h.y += -h.g * (h.slide > 0 ? C.HERO_SLIDE_H : C.HERO_H); h.g = g; h.grounded = false; h.groundId = -1; }
const breathMax = (w: World) => C.BREATH + 2 * (w.skills.breath ?? 0);
const speedOf = (w: World, s: SimState) => (w.mods.hiz ? 1.3 : 1) * (s.speedUntil > s.t ? 1.25 : 1);
const ev = (s: SimState, k: string, x: number, y: number, extra?: Partial<SimEvent>) => { if (s.events) s.events.push({ k, x, y, ...extra }); };

// ------------------------------------------------------------------ dinamik geometri

export interface R { l: number; t: number; r: number; b: number; dx: number; dy: number }
const TMP: R = { l: 0, t: 0, r: 0, b: 0, dx: 0, dy: 0 };
/** solidAt/hazardAt'in son yazdığı dikdörtgen (görsel eşitleme okur) */
export const lastRect = (): R => TMP;

const wave = (t: number, period: number) => (1 - Math.cos((2 * Math.PI * t) / period)) / 2;
/** üçgen dalga 0..1..0 */
const tri = (u: number) => { const f = u - Math.floor(u); return f < 0.5 ? f * 2 : 2 - f * 2; };

/** ritim platformu: vuruş desenine göre açık mı / kay modunda konum (0..1) */
export function beatState(w: World, s: SimState, e: WEnt, t: number): { on: boolean; pos: number; warn: number } {
  const pat = String(e.p.pattern ?? '10'); const n = Math.max(1, pat.length);
  const bt = (t + s.beatOff) / w.beatDur + Number(e.p.offset ?? 0);
  const k = Math.floor(bt); const frac = bt - k;
  const at = (i: number) => pat[((i % n) + n) % n] === '1';
  const cur = at(k), nxt = at(k + 1), prev = at(k - 1);
  if (e.p.mode === 'kay') {
    const a = prev ? 1 : 0, b = cur ? 1 : 0; const u = Math.min(1, frac / 0.3); const sm = u * u * (3 - 2 * u);
    return { on: true, pos: a + (b - a) * sm, warn: 0 };
  }
  // belirmeden/kaybolmadan önceki son üçte bir vuruş: uyarı (görsel nabız)
  return { on: cur, pos: 0, warn: cur !== nxt && frac > 0.55 ? (frac - 0.55) / 0.45 : 0 };
}

/** katı/tek yönlü varlığın t anındaki dikdörtgeni; katı değilse false */
export function solidAt(w: World, s: SimState, e: WEnt, t: number, out: R = TMP): boolean {
  out.l = e.l; out.t = e.t; out.r = e.r; out.b = e.b; out.dx = 0; out.dy = 0;
  if (e.p.boss) return bossSolid(s, e, t, out);
  switch (e.type) {
    case 'platform': case 'wall': case 'trampoline': return true;
    case 'moving': {
      const per = Number(e.p.period ?? 2000) / 1000; const ph = Number(e.p.phase ?? 0);
      const dx = Number(e.p.dx ?? 0), dy = Number(e.p.dy ?? 0);
      const k = wave(t + ph, per), k0 = wave(t + ph - C.DT, per);
      out.l += dx * k; out.r += dx * k; out.t += dy * k; out.b += dy * k; out.dx = dx * (k - k0); out.dy = dy * (k - k0);
      return true;
    }
    case 'crumble': { const trig = s.crumble.get(e.id); return !(trig !== undefined && t >= trig + 0.4 && t < trig + 3.4); }
    case 'barrier': return !s.broken.has(e.id);
    case 'door': return !(s.opened.has(e.key) !== (e.p.open === true));
    case 'freqgate': return !colorMatch(s.hero.color, Number(e.p.color ?? 0));
    case 'echo': return t < s.hero.echoUntil;
    case 'beat': {
      const b = beatState(w, s, e, t);
      if (e.p.mode === 'kay') {
        const dx = Number(e.p.dx ?? 120); const b0 = beatState(w, s, e, t - C.DT);
        out.l += dx * b.pos; out.r += dx * b.pos; out.dx = dx * (b.pos - b0.pos); return true;
      }
      return b.on;
    }
    case 'lift': { const L = s.lifts.get(e.id); if (L) { out.t -= L.off; out.b -= L.off; out.dy = -(L.off - L.prev); } return true; }
    default: return false;
  }
}
export const colorMatch = (a: number, b: number) => a >= 0 && Math.abs(a - b) < 0.08;

/** hareketli tehlike / düşmanın t anındaki kutusu; yoksa false */
export function hazardAt(w: World, s: SimState, e: WEnt, t: number, out: R = TMP): boolean {
  out.l = e.l; out.t = e.t; out.r = e.r; out.b = e.b; out.dx = 0; out.dy = 0;
  if (s.broken.has(e.id)) return false;
  if (e.type === 'hazard') {
    if (e.p.chase) { const t0 = s.timers.get(e.id); if (t0 === undefined) return false; const d = Math.min(Number(e.p.until ?? 2000), Number(e.p.chase) * (t - t0)); out.l += d; out.r += d; return true; }
    const per = Number(e.p.period ?? 0);
    if (per > 0) { const k = wave(t + Number(e.p.phase ?? 0), per / 1000); const dx = Number(e.p.dx ?? 0) * k, dy = Number(e.p.dy ?? 0) * k; out.l += dx; out.r += dx; out.t += dy; out.b += dy; }
    const on = Number(e.p.on ?? 0), off = Number(e.p.off ?? 0);
    if (on > 0 && off > 0) { const u = (t + Number(e.p.phase ?? 0)) % (on + off); if (u >= on) return false; }
    // bağışlayıcı: görselin içinde 8 px pay
    out.l += 8; out.r -= 8; out.t += 8; out.b -= 8;
    return out.r > out.l && out.b > out.t;
  }
  return true;
}

/** nabız tehlikesi uyarısı (0..1): açılmadan önceki 0,45 sn */
export function hazardWarn(e: WEnt, t: number): number {
  const on = Number(e.p.on ?? 0), off = Number(e.p.off ?? 0); if (!(on > 0 && off > 0)) return 0;
  const u = (t + Number(e.p.phase ?? 0)) % (on + off); const left = on + off - u;
  return u >= on && left < 0.45 ? 1 - left / 0.45 : 0;
}

export type EnemyKind = 'devriye' | 'ucan' | 'atici' | 'ziplayan' | 'kalkanli';
export function enemyKind(e: WEnt): EnemyKind {
  const k = String(e.p.kind ?? 'devriye');
  if (k === 'bakteri') return 'devriye'; if (k === 'sinek') return 'ucan';
  return (['devriye', 'ucan', 'atici', 'ziplayan', 'kalkanli'] as const).includes(k as EnemyKind) ? k as EnemyKind : 'devriye';
}
/** düşmanın t anındaki ayak konumu ve uyarı durumu (telegraf) */
export function enemyAt(e: WEnt, t: number): { x: number; y: number; face: -1 | 1; warn: number } {
  const k = enemyKind(e); const dx = Number(e.p.dx ?? (k === 'ucan' ? 0 : 50)); const ph = Number(e.p.phase ?? 0);
  switch (k) {
    case 'ucan': {
      const x = e.x + dx * Math.sin((t + ph) * 0.9); const y = e.y + Number(e.p.amp ?? 14) * Math.sin((t + ph) * 2.4);
      return { x, y, face: Math.cos((t + ph) * 0.9) * dx >= 0 ? 1 : -1, warn: 0 };
    }
    case 'atici': {
      const per = Number(e.p.period ?? 2.4); const u = ((t - Number(e.p.phase ?? 1)) % per + per) % per;
      return { x: e.x, y: e.y, face: Number(e.p.dir ?? -1) >= 0 ? 1 : -1, warn: u > per - 0.55 ? (u - (per - 0.55)) / 0.55 : 0 };
    }
    case 'ziplayan': {
      const P = Number(e.p.period ?? 1.8); const u = ((t + ph) % P + P) % P; const H = Number(e.p.hop ?? 110);
      if (u < 0.35) return { x: e.x, y: e.y, face: -1, warn: u / 0.35 };
      const v = (u - 0.35) / (P - 0.35); return { x: e.x, y: e.y - H * 4 * v * (1 - v), face: -1, warn: 0 };
    }
    default: {
      if (!dx) return { x: e.x, y: e.y, face: -1, warn: 0 };
      const speed = Number(e.p.speed ?? 70); const per = (2 * Math.abs(dx)) / speed; const u = (t + ph) / per;
      const f = u - Math.floor(u);
      return { x: e.x + dx * tri(u), y: e.y, face: (f < 0.5) === dx > 0 ? 1 : -1, warn: 0 };
    }
  }
}
/** atıcının mermileri (t anında); kill: öldürüldüğü an */
export function projectiles(e: WEnt, t: number, killedAt: number | undefined, out: { x: number; y: number }[]): void {
  out.length = 0;
  const per = Number(e.p.period ?? 2.4), ph = Number(e.p.phase ?? 1), sp = Number(e.p.speed ?? 230), range = Number(e.p.range ?? 520);
  const dir = Number(e.p.dir ?? -1) >= 0 ? 1 : -1; const py = e.y - (e.p.high ? 52 : 20);
  const kmax = Math.floor((t - ph) / per);
  for (let k = kmax; k >= 0; k--) {
    const fire = ph + k * per; const age = t - fire; if (age > range / sp) break;
    if (killedAt !== undefined && fire >= killedAt) continue;
    out.push({ x: e.x + dir * (22 + sp * age), y: py });
  }
}
const PROJ: { x: number; y: number }[] = [];

// ------------------------------------------------------------------ yardımcılar

function heroBox(h: HeroS, hh: number) {
  return h.g > 0 ? { l: h.x - C.HERO_HW, r: h.x + C.HERO_HW, t: h.y - hh, b: h.y } : { l: h.x - C.HERO_HW, r: h.x + C.HERO_HW, t: h.y, b: h.y + hh };
}
const heroH = (h: HeroS) => (h.slide > 0 ? C.HERO_SLIDE_H : C.HERO_H);
const overlap = (a: { l: number; r: number; t: number; b: number }, b: { l: number; r: number; t: number; b: number }) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

/** girdi gecikmesi (yankı değiştiricisi) */
function effectiveInput(w: World, s: SimState, raw: SimInput): SimInput {
  if (!w.mods.yanki) return raw;
  s.delayQ.push({ at: s.t + 0.14, inp: { ...raw } });
  const out: SimInput = { down: s.lastDown, pressed: false, released: false, swipeDown: false, dash: false, turn: false };
  while (s.delayQ.length && s.delayQ[0]!.at <= s.t + 1e-9) {
    const q = s.delayQ.shift()!.inp; out.down = q.down; out.pressed ||= q.pressed; out.released ||= q.released; out.swipeDown ||= q.swipeDown; out.dash ||= q.dash; out.turn ||= !!q.turn;
  }
  s.lastDown = out.down;
  return out;
}

// ------------------------------------------------------------------ hasar / yeniden doğma

export function hurt(w: World, s: SimState, reason: string, fromX?: number): boolean {
  const h = s.hero;
  if (s.finished || s.failed || h.invuln > 0) return false;
  if (reason !== 'fall' && s.shield > 0) { s.shield--; h.invuln = C.INVULN_SHIELD; ev(s, 'hurt', h.x, h.y, { s: 'shield' }); return false; }
  if (reason !== 'fall' && s.revir) { s.revir = false; h.invuln = C.INVULN_SHIELD; ev(s, 'hurt', h.x, h.y, { s: 'revir' }); return false; }
  s.lives--; s.damageTaken++; h.invuln = reason === 'fall' ? C.INVULN_FALL : C.INVULN_HIT;
  ev(s, 'hurt', h.x, h.y, { s: reason, n: s.lives });
  if (s.lives <= 0) { s.failed = reason; return true; }
  if (reason === 'fall' || reason === 'freq' || reason === 'nefes-yok') respawn(w, s, reason === 'freq');
  else if (fromX !== undefined && h.hookId < 0) { h.knock = 0.18; h.vy = -320 * h.g; h.grounded = false; h.jumpRise = false; }
  return true;
}

function respawn(w: World, s: SimState, toCp: boolean) {
  const h = s.hero;
  let spot: SafeSpot = s.cp;
  if (!toCp) for (let i = s.safe.length - 1; i >= 0; i--) { const sp = s.safe[i]!; if (sp.odo <= s.lastGroundOdo - 180 && sp.odo >= s.cp.odo) { spot = sp; break; } }
  if (h.g < 0 || s.modInverted) { s.modInverted = false; s.modNext = s.t + C.MOD_FLIP_EVERY; }
  const keep = { color: toCp ? -1 : h.color, odo: spot.odo };
  Object.assign(h, newHero(spot.x, spot.y - 1), { dir: spot.dir, invuln: h.invuln, breath: breathMax(w), color: keep.color, odo: keep.odo, grounded: false });
  s.lastGroundOdo = spot.odo;
  if (s.escort) { s.escort.x = h.x - 50; s.escort.y = h.y - 40; }
  if (s.boss) s.boss.respawned = true;
  s.deaths += 1;
  ev(s, 'respawn', h.x, h.y);
}

// ------------------------------------------------------------------ çarpışmalı hareket

const IDS: number[] = [];
function collectNear(w: World, x0: number, x1: number) { IDS.length = 0; for (const id of near(w, x0, x1)) IDS.push(id); return IDS; }

interface MoveInfo { landed: number; bumped: boolean; wallHit: number; blocked: number }
const MI: MoveInfo = { landed: -1, bumped: false, wallHit: -1, blocked: -1 };

/** iki eksenli taşıma: önce x (duvar), sonra y (iniş/tavan). Tek yönlü platformlar yalnızca yerçekimi yönünde iner. */
function moveHero(w: World, s: SimState, ids: number[], dx: number, dy: number): MoveInfo {
  const h = s.hero; MI.landed = -1; MI.bumped = false; MI.wallHit = -1; MI.blocked = -1;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 10));
  const sx = dx / steps, sy = dy / steps; const hh = heroH(h); const t = s.t;
  for (let i = 0; i < steps; i++) {
    // x
    if (sx !== 0) {
      h.x += sx;
      for (const id of ids) {
        const e = w.ents[id]!; if (e.cls !== 'solid') continue;
        if (e.type === 'barrier' && h.dash > 0) { if (!s.broken.has(id) && overlap(heroBox(h, hh), e)) { s.broken.add(id); ev(s, 'break', (e.l + e.r) / 2, (e.t + e.b) / 2, { id }); } continue; }
        if (!solidAt(w, s, e, t)) continue;
        if (e.p.tavan && !(h.g < 0)) continue;
        const b = heroBox(h, hh);
        if (!overlap(b, TMP)) continue;
        if (sx > 0) h.x = TMP.l - C.HERO_HW; else h.x = TMP.r + C.HERO_HW;
        MI.blocked = id; if (e.type === 'wall') MI.wallHit = id;
      }
    }
    // y
    if (sy !== 0) {
      const prevY = h.y; h.y += sy;
      for (const id of ids) {
        const e = w.ents[id]!; if (e.cls !== 'solid' && e.cls !== 'oneway') continue;
        if (!solidAt(w, s, e, t)) continue;
        if (e.p.tavan && !(h.g < 0)) continue;
        const b = heroBox(h, hh);
        if (b.r <= TMP.l || b.l >= TMP.r) continue;
        const down = sy * h.g > 0;
        if (e.cls === 'oneway') {
          if (!down) continue;
          if (h.g > 0) { if (prevY - TMP.dy <= TMP.t + 0.5 && h.y >= TMP.t) { h.y = TMP.t; MI.landed = id; } }
          else if (prevY - TMP.dy >= TMP.b - 0.5 && h.y <= TMP.b) { h.y = TMP.b; MI.landed = id; }
          continue;
        }
        if (!overlap(b, TMP)) continue;
        if (down) { h.y = h.g > 0 ? TMP.t : TMP.b; MI.landed = id; }
        else { h.y = h.g > 0 ? TMP.b + hh : TMP.t - hh; MI.bumped = true; }
      }
    }
  }
  return MI;
}

/** yerdeyse ayağın altında destek var mı (2 px yoklama) */
function supportUnder(w: World, s: SimState, ids: number[]): number {
  const h = s.hero; const hh = heroH(h); let best = -1; let bestD = 3;
  for (const id of ids) {
    const e = w.ents[id]!; if (e.cls !== 'solid' && e.cls !== 'oneway') continue;
    if (!solidAt(w, s, e, s.t)) continue;
    if (e.p.tavan && !(h.g < 0)) continue;
    const b = heroBox(h, hh); if (b.r <= TMP.l + 1 || b.l >= TMP.r - 1) continue;
    const face = h.g > 0 ? TMP.t : TMP.b; const d = (face - h.y) * h.g;
    if (d >= -2.5 && d < bestD) { bestD = d; best = id; }
  }
  if (best >= 0) { solidAt(w, s, w.ents[best]!, s.t); h.y = h.g > 0 ? TMP.t : TMP.b; }
  return best;
}

/** baş üstünde (tam boy için) engel var mı: kayma bitiminde sıkışmayı önler */
function headBlocked(w: World, s: SimState, ids: number[]): boolean {
  const h = s.hero; const b = heroBox(h, C.HERO_H);
  for (const id of ids) {
    const e = w.ents[id]!; if (e.cls !== 'solid') continue; if (!solidAt(w, s, e, s.t)) continue;
    if (overlap({ l: b.l + 2, r: b.r - 2, t: b.t, b: b.b - 2 }, TMP)) return true;
  }
  for (const id of ids) { const e = w.ents[id]!; if (e.cls === 'hazard' && hazardAt(w, s, e, s.t) && overlap({ l: b.l + 4, r: b.r - 4, t: b.t, b: b.b - C.HERO_SLIDE_H - 2 }, TMP)) return true; }
  return false;
}

// ------------------------------------------------------------------ ana adım

export function step(w: World, s: SimState, raw: SimInput): void {
  if (s.finished || s.failed) return;
  const dt = C.DT; s.t += dt; s.n++;
  const h = s.hero; const inp = effectiveInput(w, s, raw);
  const sp = speedOf(w, s);
  const ids = collectNear(w, h.x - 320, h.x + 320);
  // zamanlayıcılar
  h.coyote = Math.max(0, h.coyote - dt); h.buffer = Math.max(0, h.buffer - dt); h.invuln = Math.max(0, h.invuln - dt);
  h.dashCd = Math.max(0, h.dashCd - dt); h.wallLock = Math.max(0, h.wallLock - dt); h.hookLock = Math.max(0, h.hookLock - dt); h.launchLock = Math.max(0, h.launchLock - dt);
  h.knock = Math.max(0, h.knock - dt); h.turnCd = Math.max(0, h.turnCd - dt);
  if (inp.pressed) h.buffer = C.JUMP_BUFFER;
  if (inp.released && h.jumpRise && h.vy * h.g < 0) h.cut = true;
  h.held = inp.down;

  // bölgeler (su, yerçekimi)
  let waterId = -1, gravId = -1, curVx = 0, curVy = 0;
  const cy = h.y - (h.g > 0 ? 20 : -20);
  for (const id of ids) {
    const e = w.ents[id]!; if (e.cls !== 'zone') continue;
    if (h.x < e.l || h.x > e.r || cy < e.t || cy > e.b) continue;
    if (e.type === 'water') waterId = id; else if (e.type === 'gravzone') gravId = id; else if (e.type === 'current') { curVx += Number(e.p.vx ?? 0); curVy += Number(e.p.vy ?? 0); }
  }
  if (!has(w, 'yuz')) waterId = -1;
  const wasGrav = h.grav; h.grav = gravId >= 0 && has(w, 'cevir');
  if (wasGrav && !h.grav) { const base: 1 | -1 = s.modInverted ? -1 : 1; if (h.g !== base) { setG(h, base); ev(s, 'flip', h.x, h.y, { n: h.g }); } }

  // ters yerçekimi değiştiricisi (tavan güvenliyse)
  if (w.mods.tersYercekimi && !h.grav && h.hookId < 0 && waterId < 0) modFlip(w, s);

  // ---- kanca
  if (h.hookId >= 0) {
    hookStep(w, s, inp, ids);
  } else if (waterId >= 0) {
    swimStep(w, s, inp, ids, waterId, curVx, curVy, sp);
  } else {
    if (h.water >= 0) h.water = -1;
    h.breath = Math.min(breathMax(w), h.breath + dt * 3);
    groundStep(w, s, inp, ids, sp);
  }
  // nefes
  if (waterId >= 0) {
    const wt = w.ents[waterId]!.t; const head = h.y - C.HERO_H;
    if (head > wt + 4) { h.breath -= dt; if (h.breath <= 0) { h.breath = breathMax(w); ev(s, 'nefes', h.x, h.y); hurt(w, s, 'nefes'); } }
    else h.breath = Math.min(breathMax(w), h.breath + dt * 4);
  }

  if (s.failed) return;
  interact(w, s, ids, inp);
  if (s.failed || s.finished) return;
  // düşme
  if ((h.g > 0 && h.y > GROUND_Y + C.FALL_Y) || (h.g < 0 && h.y < -1300) || (w.boss && h.y > GROUND_Y + 200)) { hurt(w, s, 'fall'); }
  // güvenli nokta
  if (h.grounded && s.n % 8 === 0) recordSafe(w, s, ids);
  // asansörler / ufalanan zemin
  dynamics(w, s, ids);
  // eskort
  if (s.escort && s.escort.alive) { s.escort.x += (h.x - 56 * h.dir - s.escort.x) * 0.08; s.escort.y += (h.y - 40 - s.escort.y) * 0.08; }
  if (w.boss && s.boss) bossStep(w, s);
}

function modFlip(w: World, s: SimState) {
  const h = s.hero;
  const ceilAhead = (dist: number) => { const x0 = h.x, x1 = h.x + h.dir * dist; const lo = Math.min(x0, x1), hi = Math.max(x0, x1); return w.ceilings.some((c) => c.l <= lo && c.r >= hi); };
  if (!s.modInverted) {
    if (s.t >= s.modNext && h.grounded && h.g > 0 && ceilAhead(420)) { s.modInverted = true; setG(h, -1); h.vy = -60; s.modNext = s.t + C.MOD_INV_T; ev(s, 'flip', h.x, h.y, { n: -1, s: 'mod' }); }
    else if (s.t >= s.modNext) s.modNext = s.t + 0.5;
  } else if (s.t >= s.modNext || !ceilAhead(280)) {
    s.modInverted = false; if (h.g < 0) { setG(h, 1); h.vy = 60; } s.modNext = s.t + C.MOD_FLIP_EVERY; ev(s, 'flip', h.x, h.y, { n: 1, s: 'mod' });
  }
}

function groundStep(w: World, s: SimState, inp: SimInput, ids: number[], sp: number) {
  const h = s.hero; const dt = C.DT; const g = h.g;
  const run = C.RUN * sp;
  // trambolin penceresi: zara değdikten sonra kısa süre dokunuş beklenir (dokunmazsan sönük sıçrama)
  if (h.tramp > 0) {
    h.tramp -= dt; const e = w.ents[h.trampId]!;
    if (h.buffer > 0) { h.buffer = 0; trampStrong(w, s, e, h.tramp >= C.TRAMP_WINDOW - C.TRAMP_PERFECT); }
    else if (h.tramp <= 0) bounce(s, -C.TRAMP_WEAK, e.id, 'tramp-weak');
    else return;
  }
  // taşıyıcı platform
  if (h.grounded && h.groundId >= 0) { const e = w.ents[h.groundId]!; if (solidAt(w, s, e, s.t)) { h.x += TMP.dx; h.y += TMP.dy; } }

  // ---- duvar tutunma
  if (h.wallId >= 0) {
    const e = w.ents[h.wallId]!;
    if (h.buffer > 0) { // duvardan zıpla: koşu yönü döner
      h.buffer = 0; h.dir = (h.dir === 1 ? -1 : 1); h.vx = h.dir * run; h.vy = -C.WALL_JUMP_V * g;
      h.wallLockId = h.wallId; h.wallLock = C.WALL_LOCK_T; h.wallId = -1; h.jumpRise = false; h.cut = false; h.airDash = false; h.airJumps = 0;
      ev(s, 'walljump', h.x, h.y, { id: e.id });
    } else {
      if (h.wallClimb > 0) { h.wallClimb -= dt; h.vy = -C.WALL_CLIMB_V * g; }
      else { h.vy += C.G_FALL * g * dt; if (h.vy * g > C.WALL_SLIDE_MAX) h.vy = C.WALL_SLIDE_MAX * g; }
      h.vx = h.dir * 30; // duvara yaslı kal
    }
  }
  // ---- geri dön (koşunun tersine kaydırma): yerde ve havada; duvarda, atılırken, çakılırken ve fırlatılmışken değil
  if (inp.turn && h.wallId < 0 && h.dash <= 0 && !h.pound && !h.launched && h.turnCd <= 0 && h.tramp <= 0) {
    h.dir = (h.dir === 1 ? -1 : 1); h.turnCd = 0.2; h.blockedT = 0; h.stall = 0; if (h.knock <= 0) h.vx = h.dir * run;
    ev(s, 'uturn', h.x, h.y);
  }
  // ---- girdiler (yerde/havada)
  const hasDash = has(w, 'darbe');
  if (inp.dash && hasDash && h.dashCd <= 0 && (h.grounded || !h.airDash) && h.wallId < 0) {
    h.dash = C.DASH_T; h.dashCd = C.DASH_CD; if (!h.grounded) h.airDash = true; h.pound = false; h.slide = 0; h.vy = 0; h.jumpRise = false;
    h.echoUntil = s.t + C.ECHO_T; ev(s, 'dash', h.x, h.y);
  }
  if (inp.swipeDown && !h.grounded && h.wallId < 0 && h.dash <= 0 && has(w, 'cakil') && !h.pound) {
    h.pound = true; h.vx = 0; h.vy = C.POUND_V * g; h.jumpRise = false; ev(s, 'pound', h.x, h.y);
  }
  if (inp.swipeDown && h.grounded && has(w, 'kayma') && h.slide <= 0) { h.slide = w.skills.longSlide ? C.SLIDE_LONG_T : C.SLIDE_T; ev(s, 'slide', h.x, h.y); }
  // zıplama / çevirme
  if (h.buffer > 0 && h.wallId < 0 && h.tramp <= 0) {
    if (h.grav) { h.buffer = 0; setG(h, h.g === 1 ? -1 : 1); h.vy = 120 * h.g; h.jumpRise = false; h.slide = 0; ev(s, 'flip', h.x, h.y, { n: h.g }); }
    else if (h.grounded || h.coyote > 0) {
      h.buffer = 0; h.slide = 0; h.grounded = false; h.coyote = 0; h.vy = -C.JUMP_V * h.g; h.jumpRise = true; h.cut = !inp.down; h.pound = false;
      ev(s, 'jump', h.x, h.y);
    } else if (inp.pressed && w.skills.doubleJump && h.airJumps < 1 && h.dash <= 0) {
      h.buffer = 0; h.airJumps++; h.vy = -C.JUMP_V * 0.85 * h.g; h.jumpRise = true; h.cut = !inp.down; h.pound = false; ev(s, 'airjump', h.x, h.y);
    }
  }
  const gg = h.g;
  // ---- hız
  if (h.dash > 0) { h.dash -= dt; h.vx = h.dir * run * C.DASH_MULT; h.vy = 0; if (h.dash <= 0) h.vx = h.dir * run; }
  else if (h.pound) { h.vx = 0; h.vy = C.POUND_V * gg; }
  else if (h.wallId < 0) {
    if (h.grounded) { h.vx = h.knock > 0 ? h.vx : h.dir * run; h.launched = false; }
    else if (!h.launched && h.knock <= 0) h.vx = h.dir * run;
    if (!h.grounded) {
      const up = h.vy * gg < 0;
      const grav = up ? (h.jumpRise && h.cut ? C.G_CUT : C.G_HOLD) : C.G_FALL;
      h.vy += grav * gg * dt;
      if (!up) h.jumpRise = false;
      const glide = !up && h.held && has(w, 'suzul') && h.knock <= 0;
      if (glide) { if (h.vy * gg > C.GLIDE_FALL) h.vy = C.GLIDE_FALL * gg; h.glideT += dt; if (h.glideT > 0.08 && h.glideT - dt <= 0.08) ev(s, 'glide', h.x, h.y); }
      else h.glideT = 0;
      if (h.vy * gg > C.MAX_FALL) h.vy = C.MAX_FALL * gg;
    } else h.vy = 0;
  }
  if (h.slide > 0) { h.slide -= dt; if (h.slide <= 0 && h.grounded && headBlocked(w, s, ids)) h.slide = dt; }

  // ---- taşı
  const wasGrounded = h.grounded; const vyBefore = h.vy;
  const m = moveHero(w, s, ids, h.vx * dt, h.grounded ? 0 : h.vy * dt);
  h.odo += Math.abs(h.vx * dt);
  if (h.grounded) {
    const sup = supportUnder(w, s, ids);
    if (sup < 0) { h.grounded = false; h.groundId = -1; h.coyote = h.jumpRise ? 0 : C.COYOTE; }
    else { h.groundId = sup; const ge = w.ents[sup]!; if (ge.type === 'crumble' && !s.crumble.has(sup)) { s.crumble.set(sup, s.t); ev(s, 'crumble', h.x, h.y, { id: sup }); } }
  }
  if (m.landed >= 0 && !wasGrounded) land(w, s, m.landed, vyBefore, inp);
  else if (m.bumped) { h.vy = 0; h.jumpRise = false; }
  // ---- duvar teması
  const blockedAhead = m.blocked >= 0 && Math.sign(h.vx) === h.dir;
  if (h.wallId >= 0) {
    const e = w.ents[h.wallId]!; const face = h.dir > 0 ? e.l : e.r;
    const touching = Math.abs((h.x + h.dir * C.HERO_HW) - face) < 3 && (h.g > 0 ? h.y > e.t + 6 && h.y - C.HERO_H < e.b : h.y < e.b - 6 && h.y + C.HERO_H > e.t);
    if (h.grounded) { h.wallId = -1; h.stall = 1; }
    else if (!touching) { h.wallId = -1; h.vy = Math.min(h.vy * gg, 0) * gg; }
  } else if (m.wallHit >= 0 && has(w, 'duvar') && h.dash <= 0 && !h.pound && !(h.wallLock > 0 && h.wallLockId === m.wallHit) && Math.sign(h.vx) === h.dir) {
    if (!h.grounded || h.stall === 0) {
      h.wallId = m.wallHit; h.wallClimb = C.WALL_CLIMB_T; h.grounded = false; h.groundId = -1; h.jumpRise = false; h.slide = 0; h.airDash = false;
      ev(s, 'cling', h.x, h.y, { id: m.wallHit });
    }
  }
  // takılma: koşu yönünde engele dayanmışsa kısa süre sonra geri döner (oyuncu asla mahsur kalmaz)
  if (blockedAhead && h.wallId < 0) {
    if (h.grounded) { h.stall += dt; h.blockedT += dt; } else h.blockedT += dt * 0.5;
    const e = w.ents[m.blocked]!;
    if (e.type === 'barrier' && h.dash <= 0) hurt(w, s, 'gurultu', h.x + h.dir * 20);
    if (e.type === 'freqgate' && !colorMatch(h.color, Number(e.p.color ?? 0))) { ev(s, 'freqwrong', h.x, h.y, { id: e.id }); hurt(w, s, 'freq', h.x + h.dir * 20); }
    if (h.blockedT > 0.3 && h.grounded) { h.dir = (h.dir === 1 ? -1 : 1); h.blockedT = 0; h.stall = 0; ev(s, 'turn', h.x, h.y); }
  } else { h.blockedT = 0; if (h.grounded && m.blocked < 0) h.stall = 0; }
  if (h.grounded) { h.airDash = false; h.airJumps = 0; s.lastGroundOdo = h.odo; }
}

/** iniş: trambolin, yay, çakılma darbesi, ufalanan zemin, asansör */
function land(w: World, s: SimState, id: number, vyBefore: number, inp: SimInput) {
  const h = s.hero; const e = w.ents[id]!;
  h.grounded = true; h.groundId = id; h.vy = 0; h.jumpRise = false; h.cut = false; h.launched = false; h.glideT = 0;
  if (h.pound) {
    h.pound = false; h.poundLandT = s.t; ev(s, 'poundland', h.x, h.y, { id });
    poundImpact(w, s);
  } else if (Math.abs(vyBefore) > 300) ev(s, 'land', h.x, h.y, { n: Math.abs(vyBefore) });
  if (e.type === 'trampoline') {
    if (h.buffer > 0 || inp.pressed) { const perfect = inp.pressed || h.buffer >= C.JUMP_BUFFER - C.TRAMP_PERFECT; h.buffer = 0; trampStrong(w, s, e, perfect); }
    else { h.tramp = C.TRAMP_WINDOW; h.trampId = id; }
    return;
  }
  if (e.type === 'crumble' && !s.crumble.has(id)) { s.crumble.set(id, s.t); ev(s, 'crumble', h.x, h.y, { id }); }
}

/** zarın vuruş evresinde mi (props.beat): vuruş anının çevresi */
export function trampOnBeat(w: World, s: SimState, t: number): boolean { const bt = (t + s.beatOff) / w.beatDur; const f = bt - Math.floor(bt); return f < 0.2 || f > 0.85; }
/** güçlü zar sıçrayışı: "Mükemmel" (değme anına çok yakın dokunuş) ve vuruşa denk gelme dürüst bir yükseklik ödülü verir */
function trampStrong(w: World, s: SimState, e: WEnt, perfect: boolean) {
  const beatHit = !!e.p.beat && trampOnBeat(w, s, s.t);
  const k = Number(e.p.power ?? 1) * (perfect ? C.TRAMP_PERFECT_MULT : 1) * (beatHit ? C.TRAMP_BEAT_MULT : 1);
  bounce(s, -k * C.TRAMP_STRONG, e.id, 'tramp-strong', perfect ? (beatHit ? 'perfect-beat' : 'perfect') : beatHit ? 'beat' : undefined);
}
function bounce(s: SimState, v: number, id: number, kind: string, tag?: string) {
  const h = s.hero; h.grounded = false; h.groundId = -1; h.vy = v * h.g; h.jumpRise = false; h.cut = false; h.tramp = 0; h.slide = 0; h.pound = false; h.dash = 0;
  ev(s, kind, h.x, h.y, tag ? { id, s: tag } : { id });
}

function poundImpact(w: World, s: SimState) {
  const h = s.hero; const ids = near(w, h.x - 100, h.x + 100).slice();
  for (const id of ids) {
    const e = w.ents[id]!;
    if (e.type === 'crumble' && h.x + C.HERO_HW > e.l && h.x - C.HERO_HW < e.r && Math.abs(e.t - h.y) < 8) { s.crumble.set(id, s.t - 0.4); ev(s, 'crumble', h.x, h.y, { id, s: 'kir' }); }
    if (e.type === 'switch' && e.p.by !== 'darbe' && Math.abs(e.x - h.x) < 36 && Math.abs(e.y - h.y) < 24) triggerSwitch(s, e);
    if (e.cls === 'enemy' && !s.killed.has(id)) { const p = enemyAt(e, s.t); if (Math.abs(p.x - h.x) < C.POUND_RADIUS && Math.abs(p.y - h.y) < 40) kill(s, e, 'pound'); }
  }
}

function triggerSwitch(s: SimState, e: WEnt) {
  if (s.opened.has(e.key)) return;
  s.opened.add(e.key); ev(s, 'switch', e.x, e.y, { id: e.id, s: e.key });
}
function kill(s: SimState, e: WEnt, by: string) { s.killed.set(e.id, s.t); ev(s, 'kill', e.x, e.y, { id: e.id, s: by }); }

function hookStep(w: World, s: SimState, inp: SimInput, ids: number[]) {
  const h = s.hero; const dt = C.DT; const e = w.ents[h.hookId]!;
  if (!inp.down) { // bırak: teğet hızla fırla (v = Lω·(cos θ, −sin θ))
    const L = h.hookL; h.vx = h.hookW * L * Math.cos(h.hookAng); h.vy = -h.hookW * L * Math.sin(h.hookAng);
    if (h.vy > -200 && Math.abs(h.hookAng) < 0.25) h.vy = -260; // tabanda bırakışa küçük destek
    h.hookLockId = h.hookId; h.hookLock = 0.35; h.hookId = -1; h.launched = true; h.jumpRise = false; h.airDash = false;
    ev(s, 'unhook', h.x, h.y, { id: e.id });
    return;
  }
  // sarkaç: θ'' = −(g/L)·sin θ ; küçük pompa genliği HOOK_MAX_ANGLE'a taşır
  const L = h.hookL; const g = C.G_FALL;
  h.hookW += (-(g / L) * Math.sin(h.hookAng)) * dt;
  const energyAng = Math.acos(Math.max(-1, Math.min(1, Math.cos(h.hookAng) - (h.hookW * h.hookW * L) / (2 * g))));
  if (energyAng < C.HOOK_MAX_ANGLE) h.hookW *= 1.012;
  h.hookAng += h.hookW * dt;
  const nx = e.x + Math.sin(h.hookAng) * L, ny = e.y + Math.cos(h.hookAng) * L + C.HERO_H / 2;
  h.vx = (nx - h.x) / dt; h.vy = (ny - h.y) / dt; h.x = nx; h.y = ny; h.odo += Math.abs(h.vx * dt);
  h.grounded = false; void ids;
}

function swimStep(w: World, s: SimState, inp: SimInput, ids: number[], waterId: number, cvx: number, cvy: number, sp: number) {
  const h = s.hero; const dt = C.DT; const wz = w.ents[waterId]!;
  if (h.water < 0) { h.water = waterId; h.pound = false; h.dash = 0; h.wallId = -1; h.jumpRise = false; setG(h, 1); ev(s, 'splash', h.x, wz.t); }
  h.vx = h.dir * C.RUN * C.SWIM_SPEED * sp + cvx;
  const target = h.held ? -C.SWIM_UP : C.SWIM_SINK;
  h.vy += (target - h.vy) * Math.min(1, dt * 6); h.vy += cvy * dt * 4;
  if (inp.pressed) ev(s, 'swim', h.x, h.y);
  if (inp.turn && h.turnCd <= 0) { h.dir = (h.dir === 1 ? -1 : 1); h.turnCd = 0.2; h.blockedT = 0; ev(s, 'uturn', h.x, h.y); }
  // yüzeyden çık: basılıyken baş yüzeye ulaştıysa sıçra
  if (h.held && h.y - C.HERO_H * 0.7 < wz.t && h.vy < 0) { h.vy = -C.SWIM_EXIT_V; h.water = -1; h.jumpRise = true; h.cut = false; ev(s, 'jump', h.x, h.y, { s: 'su' }); }
  const m = moveHero(w, s, ids, h.vx * dt, h.vy * dt);
  h.odo += Math.abs(h.vx * dt);
  if (m.landed >= 0) { h.vy = 0; h.groundId = m.landed; } else h.groundId = -1;
  h.grounded = m.landed >= 0;
  // sıvıda duvara dayanırken basılı tutan (yükselen) oyuncu dönmez, duvar boyunca yüzeye çıkar
  if (m.blocked >= 0 && Math.sign(h.vx) === h.dir && !h.held) { h.blockedT += dt; if (h.blockedT > 0.6) { h.dir = (h.dir === 1 ? -1 : 1); h.blockedT = 0; ev(s, 'turn', h.x, h.y); } } else h.blockedT = 0;
  if (m.bumped) h.vy = 0;
  s.lastGroundOdo = h.odo;
}

function tryHook(w: World, s: SimState, ids: number[]) {
  const h = s.hero; if (!has(w, 'kanca') || !h.held || h.grounded || h.hookId >= 0 || h.wallId >= 0 || h.pound) return;
  const cx = h.x, cy = h.y - C.HERO_H / 2;
  for (const id of ids) {
    const e = w.ents[id]!; if (e.cls !== 'hook') continue;
    if (h.hookLock > 0 && h.hookLockId === id) continue;
    const r = Number(e.p.r ?? 140); const dx = cx - e.x, dy = cy - e.y; const d = Math.hypot(dx, dy);
    if (d > r + C.HOOK_GRAB || dy < -10) continue;
    const L = Math.max(60, Math.min(r, d));
    h.hookId = id; h.hookL = L; h.hookAng = Math.atan2(dx, dy);
    // açısal hız: mevcut teğet hız; yetersizse koşu yönünde minimum salınım
    const tw = (h.vx * Math.cos(h.hookAng) - h.vy * Math.sin(h.hookAng)) / L;
    const minW = Math.sqrt((2 * C.G_FALL / L) * Math.max(0.05, Math.cos(h.hookAng) - Math.cos(C.HOOK_MAX_ANGLE)));
    h.hookW = h.dir * Math.max(Math.abs(tw) * Math.sign(tw) * h.dir, minW);
    h.jumpRise = false; h.glideT = 0; h.airDash = false; setG(h, 1);
    ev(s, 'hook', e.x, e.y, { id });
    return;
  }
}

const HB = { l: 0, r: 0, t: 0, b: 0 };
function interact(w: World, s: SimState, ids: number[], _inp: SimInput) {
  const h = s.hero; const hh = heroH(h); const t = s.t;
  const b0 = heroBox(h, hh);
  HB.l = b0.l + 4; HB.r = b0.r - 4; HB.t = b0.t + 4; HB.b = b0.b - 2;
  const magnet = s.magnetUntil > t ? 110 : (w.skills.magnet ?? 0) > 0 ? 40 + w.skills.magnet * 30 : 0;
  tryHook(w, s, ids);
  for (const id of ids) {
    const e = w.ents[id]!;
    switch (e.cls) {
      case 'pickup': {
        if (s.collected.has(id) && e.type !== 'fork') break;
        // nota alma yarıçapı: kafanın hemen üstündeki (zemin −60) notalar koşarken alınır — görünen ile alınan aynı
        const r = (e.type === 'secret' ? 22 : e.type === 'collect' ? 26 : 24) + (e.type === 'coin' ? magnet : 0);
        if (e.x < HB.l - r || e.x > HB.r + r || e.y < HB.t - r || e.y > HB.b + r) break;
        pickup(w, s, e);
        break;
      }
      case 'hazard': {
        if (e.p.chase && !s.timers.has(id) && h.x > e.l + Number(e.p.start ?? 300)) { s.timers.set(id, t); ev(s, 'chase', e.x, e.y, { id }); }
        if (h.invuln > 0) break;
        if (!hazardAt(w, s, e, t)) break;
        if (!overlap(HB, TMP)) break;
        if (h.dash > 0 && e.p.dash) { s.broken.add(id); ev(s, 'break', e.x, e.y, { id, s: 'dagit' }); break; }
        hurt(w, s, e.type === 'spike' ? 'diken' : 'gurultu', (TMP.l + TMP.r) / 2);
        break;
      }
      case 'enemy': {
        if (s.killed.has(id)) break;
        const kind = enemyKind(e); const p = enemyAt(e, t);
        if (kind === 'atici') {
          projectiles(e, t, s.killed.get(id), PROJ);
          if (h.invuln <= 0) for (const q of PROJ) if (q.x + 8 > HB.l && q.x - 8 < HB.r && q.y + 8 > HB.t && q.y - 8 < HB.b) { hurt(w, s, 'mermi', q.x); break; }
        }
        const eb = { l: p.x - 15, r: p.x + 15, t: p.y - 28, b: p.y - 2 };
        if (!overlap(HB, eb)) break;
        if (h.dash > 0 || h.pound) { kill(s, e, h.dash > 0 ? 'darbe' : 'pound'); if (h.pound) { h.vy = -200 * h.g; } break; }
        const stomp = h.g > 0 && h.vy > 40 && h.y <= eb.t + 18;
        if (stomp) {
          const v = h.held ? C.STOMP_V_HELD : C.STOMP_V; h.vy = -v; h.jumpRise = false; h.grounded = false; h.cut = false;
          if (kind === 'kalkanli') { ev(s, 'shieldbounce', p.x, p.y, { id }); break; }
          s.stomps++; kill(s, e, 'stomp'); break;
        }
        if (s.escort && s.escort.alive && Math.abs(s.escort.x - p.x) < 30 && Math.abs(s.escort.y - (p.y - 15)) < 40) { s.escort.alive = false; ev(s, 'escortLost', p.x, p.y); }
        if (h.invuln <= 0) hurt(w, s, 'dusman', p.x);
        break;
      }
      case 'trigger': trigger(w, s, e); break;
      default: break;
    }
    if (s.failed || s.finished) return;
  }
  // eskort: düşmana değerse kaybolur
  if (s.escort && s.escort.alive) {
    for (const id of ids) { const e = w.ents[id]!; if (e.cls !== 'enemy' || s.killed.has(id)) continue; const p = enemyAt(e, t); if (Math.abs(s.escort.x - p.x) < 26 && Math.abs(s.escort.y - (p.y - 15)) < 30) { s.escort.alive = false; ev(s, 'escortLost', p.x, p.y); break; } }
  }
  // kapı (üstünden geçse de)
  if (!w.boss && h.x >= w.gateX + 20) finish(s);
}

function pickup(w: World, s: SimState, e: WEnt) {
  const h = s.hero;
  switch (e.type) {
    case 'coin': s.collected.add(e.id); s.coins++; ev(s, 'coin', e.x, e.y, { id: e.id }); break;
    case 'collect': s.collected.add(e.id); s.coins += 5; ev(s, 'collect', e.x, e.y, { id: e.id }); break;
    case 'note': {
      s.collected.add(e.id);
      if (e.ord === s.nextNote) { s.nextNote++; s.notes++; ev(s, 'note', e.x, e.y, { id: e.id, n: s.notes }); }
      else ev(s, 'noteWrong', e.x, e.y, { id: e.id });
      break;
    }
    case 'secret': s.collected.add(e.id); s.cochleas++; ev(s, 'cochlea', e.x, e.y, { id: e.id, n: s.cochleas }); break;
    case 'powerup': {
      s.collected.add(e.id); const k = String(e.p.kind ?? 'shield');
      if (k === 'shield') s.shield = Math.min(2, s.shield + 1); else if (k === 'magnet') s.magnetUntil = s.t + 8; else if (k === 'life') s.lives = Math.min(5, s.lives + 1); else if (k === 'speed') s.speedUntil = s.t + 6;
      ev(s, 'power', e.x, e.y, { id: e.id, s: k }); break;
    }
    case 'fork': { const c = Number(e.p.color ?? 0); if (!colorMatch(h.color, c)) { h.color = c; s.collected.add(e.id); ev(s, 'fork', e.x, e.y, { id: e.id, n: c }); } break; }
    case 'bubble': s.collected.add(e.id); h.breath = breathMax(w); ev(s, 'bubble', e.x, e.y, { id: e.id }); break;
  }
}

function trigger(w: World, s: SimState, e: WEnt) {
  const h = s.hero;
  if (h.x + C.HERO_HW < e.l || h.x - C.HERO_HW > e.r) return;
  const top = h.y - C.HERO_H, bot = h.y; if (bot < e.t || top > e.b) return;
  switch (e.type) {
    case 'checkpoint':
      if (s.cpX < e.x - 1) { s.cpX = e.x; s.cp = { x: e.x, y: e.y, dir: 1, odo: h.odo }; s.safe.push(s.cp); ev(s, 'checkpoint', e.x, e.y, { id: e.id }); }
      break;
    case 'gate': finish(s); break;
    case 'launcher': {
      if (h.launchLock > 0 && h.launchId === e.id) break;
      const vx = Number(e.p.vx ?? 0), vy = Number(e.p.vy ?? -900);
      if (vx) { h.vx = vx; h.dir = vx > 0 ? 1 : -1; h.launched = true; }
      h.vy = vy; h.grounded = false; h.groundId = -1; h.jumpRise = false; h.pound = false; h.slide = 0; h.launchId = e.id; h.launchLock = 0.4;
      ev(s, 'launch', e.x, e.y, { id: e.id }); break;
    }
    case 'switch': if ((e.p.by === 'darbe' && h.dash > 0) || (e.p.by === 'temas' && h.grounded && Math.abs(h.y - e.y) < 4)) triggerSwitch(s, e); break;
    case 'spring': if (h.vy * h.g >= -1 && h.g > 0 && h.hookId < 0) { h.y = Math.min(h.y, e.b); bounce(s, -C.SPRING_V * Number(e.p.power ?? 1), e.id, 'spring'); } break;
    case 'tutor': if (!s.collected.has(e.id)) { s.collected.add(e.id); ev(s, 'tutor', e.x, e.y, { id: e.id, s: String(e.p.ability ?? 'zipla') }); } break;
    case 'escortee': if (!s.escort && !s.collected.has(e.id)) { s.collected.add(e.id); s.escort = { x: e.x, y: e.y, alive: true }; ev(s, 'escort', e.x, e.y); } break;
    default: break;
  }
}

function finish(s: SimState) { if (!s.finished) { s.finished = true; ev(s, 'gate', s.hero.x, s.hero.y); } }

function recordSafe(w: World, s: SimState, ids: number[]) {
  const h = s.hero; if (h.g < 0 || h.groundId < 0 || h.water >= 0) return;
  const g = w.ents[h.groundId]!; if (g.type !== 'platform' && g.type !== 'wall') return;
  if (h.x < g.l + 22 || h.x > g.r - 22) return;
  for (const id of ids) {
    const e = w.ents[id]!; if (e.cls !== 'hazard' && e.cls !== 'enemy' && e.type !== 'barrier' && e.type !== 'freqgate') continue;
    if (e.sr > h.x - 90 && e.sl < h.x + 90 && e.b > h.y - 260 && e.t < h.y + 40) return;
  }
  const last = s.safe[s.safe.length - 1];
  if (!last || Math.abs(last.odo - h.odo) > 40) { s.safe.push({ x: h.x, y: h.y, dir: h.dir, odo: h.odo }); if (s.safe.length > 40) s.safe.shift(); }
}

function dynamics(w: World, s: SimState, ids: number[]) {
  const h = s.hero;
  for (const id of ids) {
    const e = w.ents[id]!;
    if (e.type === 'lift') {
      let L = s.lifts.get(id); const on = h.grounded && h.groundId === id;
      if (!L) { if (!on) continue; L = { off: 0, lastOn: s.t, prev: 0 }; s.lifts.set(id, L); }
      L.prev = L.off; const max = Number(e.p.dy ?? 200);
      if (on) { L.lastOn = s.t; L.off = Math.min(max, L.off + 260 * C.DT); }
      else if (s.t - L.lastOn > 0.8) L.off = Math.max(0, L.off - 140 * C.DT);
      if (L.off === 0 && !on && s.t - L.lastOn > 1) s.lifts.delete(id);
    }
  }
  for (const [id, trig] of s.crumble) if (s.t >= trig + 3.4) { const e = w.ents[id]!; const hb = heroBox(h, C.HERO_H); if (!overlap(hb, e)) s.crumble.delete(id); }
}
