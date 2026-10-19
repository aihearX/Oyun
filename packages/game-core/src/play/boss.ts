import { GROUND_Y } from '@odi/shared';
import * as C from './consts';
import { addEntity, type WEnt, type World } from './world';
import { cloneState, hurt, step, NO_INPUT, type R, type SimState } from './sim';

/**
 * Boss savaşları (saf mantık; görsel play/visuals.ts). Arena tek ekran: iki yanda tırmanılabilir duvar,
 * kahraman otomatik koşar, duvarda döner (duvar zıplaması ya da kısa takılma). Tüm saldırılar önceden okunur (telegraf).
 *
 * - Serumen Golemi (20, kanal): gölge → yumruk iner ve 2 sn saplı kalır; saplı yumruğun üstüne YERE ÇAKIL (−2).
 *   Faz 2: duvardan yuvarlanan serumen topları (üstünden zıpla). Faz 3: çift yumruk + tavandan damlalar.
 * - Gürültü Canavarı (40, korteks): duvardan gelen ses dalgaları (alçak: zıpla · yüksek: kay), faz 2'de düşen gürültü
 *   bulutları; bağırınca beliren 3 notayı topla → kalbi yere iner → SES DARBESİ ya da çakılma ile vur (−3).
 */

export const ARENA_W = 390;
export const WALL_W = 26;
export const RUN_L = WALL_W + C.HERO_HW;
export const RUN_R = ARENA_W - WALL_W - C.HERO_HW;

export interface Fist { x: number; t0: number; st: 'warn' | 'slam' | 'planted' | 'up'; until: number; slot: number; hit: boolean }
export interface Ball { x: number; vx: number; t0: number }
export interface Drop { x: number; t0: number }
export interface Wave { x: number; dir: 1 | -1; kind: 'low' | 'high'; t0: number }
export interface BossState {
  kind: 'golem' | 'canavar'; name: string; hp: number; maxHp: number; phase: number; defeated: boolean; defeatAt: number;
  mode: 'idle' | 'attack' | 'scream' | 'stun' | 'dead'; until: number; nextAttack: number; nextBall: number; nextDrop: number; nextScream: number;
  fists: Fist[]; balls: Ball[]; drops: Drop[]; waves: Wave[]; warnWall: { side: -1 | 1; at: number; kind: 'low' | 'high' | 'ball'; pair: boolean } | null;
  notes: { x: number; y: number; got: boolean }[]; core: { x: number; until: number; immune: number } | null;
  seed: number; lastHit: number; respawned: boolean; fistIds: number[]; hits: number;
}

export function cloneBoss(b: BossState): BossState {
  return { ...b, fists: b.fists.map((f) => ({ ...f })), balls: b.balls.map((x) => ({ ...x })), drops: b.drops.map((x) => ({ ...x })), waves: b.waves.map((x) => ({ ...x })), notes: b.notes.map((n) => ({ ...n })), core: b.core ? { ...b.core } : null, warnWall: b.warnWall ? { ...b.warnWall } : null };
}

const rnd = (b: BossState) => { b.seed = (Math.imul(b.seed, 1664525) + 1013904223) >>> 0; return b.seed / 4294967296; };

export function bossInit(w: World, s: SimState): void {
  const spec = w.spec.boss; const kind: BossState['kind'] = spec?.id === 'gurultu-canavari' ? 'canavar' : 'golem';
  addEntity(w, { type: 'platform', x: -40, y: GROUND_Y, w: ARENA_W + 80, h: 200 });
  addEntity(w, { type: 'wall', x: 0, y: GROUND_Y - 640, w: WALL_W, h: 640 });
  addEntity(w, { type: 'wall', x: ARENA_W - WALL_W, y: GROUND_Y - 640, w: WALL_W, h: 640 });
  const fistIds = [0, 1].map((i) => addEntity(w, { type: 'platform', x: 0, y: GROUND_Y - 64, w: 80, h: 64, props: { boss: 'fist', slot: i } }));
  const hp = spec?.hp ?? (kind === 'golem' ? 12 : 18);
  s.boss = {
    kind, name: spec?.name ?? (kind === 'golem' ? 'Serumen Golemi' : 'Gürültü Canavarı'), hp, maxHp: hp, phase: 1, defeated: false, defeatAt: 0,
    mode: 'idle', until: 2.4, nextAttack: kind === 'canavar' ? 1.6 : 2.4, nextBall: 6, nextDrop: 4, nextScream: kind === 'canavar' ? 7 : 1e9,
    fists: [], balls: [], drops: [], waves: [], warnWall: null, notes: [], core: null, seed: (w.spec.seed ^ 0x5bd1e995) >>> 0, lastHit: -9, respawned: false, fistIds, hits: 0,
  };
  s.hero.x = 120; s.hero.y = GROUND_Y; s.hero.dir = 1;
  s.cp = { x: 195, y: GROUND_Y, dir: 1, odo: 0 }; s.safe = [s.cp];
}

/** saplı yumruk platformu */
export function bossSolid(s: SimState, e: WEnt, _t: number, out: R): boolean {
  const b = s.boss; if (!b || e.p.boss !== 'fist') return false;
  const f = b.fists.find((x) => x.slot === Number(e.p.slot) && x.st === 'planted'); if (!f) return false;
  out.l = f.x - 40; out.r = f.x + 40; out.t = GROUND_Y - 64; out.b = GROUND_Y; out.dx = 0; out.dy = 0;
  return true;
}

let forecasting = false;
/** golemin nişanı: kahraman hiçbir şey yapmazsa `dt` sn sonra nerede olur (motorun kendi adımıyla) */
function forecastX(w: World, s: SimState, dt: number): number {
  if (forecasting) return predictX(s.hero.x, s.hero.dir, dt);
  forecasting = true;
  try { const c = cloneState(s); const n = Math.round(dt * 60); for (let i = 0; i < n && !c.failed; i++) step(w, c, NO_INPUT); return c.hero.x; }
  finally { forecasting = false; }
}
/** kahramanın t saniye sonraki x'i (duvarlar arası gidip gelme varsayımı) */
function predictX(x: number, dir: number, dt: number): number {
  const L = RUN_L, Rr = RUN_R, span = Rr - L; let u = x - L + dir * C.RUN * dt;
  u = ((u % (2 * span)) + 2 * span) % (2 * span); return L + (u <= span ? u : 2 * span - u);
}

function heroBox(s: SimState) { const h = s.hero; const hh = h.slide > 0 ? C.HERO_SLIDE_H : C.HERO_H; return { l: h.x - C.HERO_HW + 4, r: h.x + C.HERO_HW - 4, t: h.y - hh + 4, b: h.y - 2 }; }
const hit = (a: { l: number; r: number; t: number; b: number }, l: number, t: number, r: number, bb: number) => a.l < r && a.r > l && a.t < bb && a.b > t;

function damageBoss(w: World, s: SimState, n: number, by: string) {
  const b = s.boss!; if (b.defeated) return;
  b.hp = Math.max(0, b.hp - n); b.lastHit = s.t; b.hits++;
  if (s.events) s.events.push({ k: 'bossHit', x: s.hero.x, y: s.hero.y, n, s: by });
  const t2 = Math.round(b.maxHp * 2 / 3), t3 = Math.round(b.maxHp / 3);
  const np = b.hp <= t3 ? 3 : b.hp <= t2 ? 2 : 1;
  if (np > b.phase) { b.phase = np; b.mode = 'idle'; b.until = s.t + 1.4; b.nextAttack = s.t + 1.4; b.core = null; b.fists = []; b.balls = []; b.waves = []; b.drops = []; b.warnWall = null; if (s.events) s.events.push({ k: 'bossPhase', x: 195, y: GROUND_Y - 300, n: np }); }
  if (b.hp <= 0) { b.defeated = true; b.defeatAt = s.t; b.mode = 'dead'; b.fists = []; b.balls = []; b.drops = []; b.waves = []; b.notes = []; b.core = null; b.warnWall = null; if (s.events) s.events.push({ k: 'bossDown', x: 195, y: GROUND_Y - 200 }); }
  void w;
}

export function bossStep(w: World, s: SimState): void {
  const b = s.boss!; const h = s.hero; const t = s.t;
  if (b.defeated) { if (t - b.defeatAt > 1.6) { s.finished = true; if (s.events) s.events.push({ k: 'gate', x: h.x, y: h.y }); } return; }
  if (b.respawned) { b.respawned = false; b.balls = []; b.waves = []; b.drops = []; }
  const hb = heroBox(s);
  if (b.kind === 'golem') golem(w, s, b, hb); else canavar(w, s, b, hb);
}

// ---------------------------------------------------------------- Serumen Golemi
function golem(w: World, s: SimState, b: BossState, hb: ReturnType<typeof heroBox>) {
  const t = s.t; const h = s.hero;
  // yumruk döngüsü
  if (b.mode === 'idle' && t >= b.nextAttack && !b.fists.length) {
    b.mode = 'attack';
    const lead = 0.95; const tx = Math.max(78, Math.min(ARENA_W - 78, forecastX(w, s, lead)));
    const targets = [tx];
    if (b.phase === 3) { let t2 = tx + (tx < ARENA_W / 2 ? 150 : -150); t2 = Math.max(78, Math.min(ARENA_W - 78, t2)); targets.push(t2); }
    b.fists = targets.map((x, i) => ({ x, t0: t, st: 'warn', until: t + (b.phase === 3 ? 0.75 : 0.85), slot: i, hit: false }));
    if (s.events) s.events.push({ k: 'bossWarn', x: tx, y: GROUND_Y });
  }
  for (const f of b.fists) {
    if (f.st === 'warn' && t >= f.until) { f.st = 'slam'; f.until = t + 0.12; }
    else if (f.st === 'slam') {
      // yumruk yere iner: yalnızca yerdekine (ayağı yumruk boyundan alçakta) değer — zamanında zıplayan kurtulur
      if (hit(hb, f.x - 38, GROUND_Y - 60, f.x + 38, GROUND_Y + 4)) hurt(w, s, 'yumruk', f.x);
      if (t >= f.until) { f.st = 'planted'; f.until = t + (b.phase === 3 ? 1.8 : 2.1); if (s.events) s.events.push({ k: 'bossSlam', x: f.x, y: GROUND_Y }); }
    } else if (f.st === 'planted') {
      // saplı yumruğun üstüne çakıl → hasar
      if (h.grounded && h.groundId === b.fistIds[f.slot] && h.poundLandT === t && !f.hit) { f.hit = true; damageBoss(w, s, 2, 'cakil'); f.st = 'up'; f.until = t + 0.3; h.vy = -520; h.grounded = false; }
      else if (t >= f.until) { f.st = 'up'; f.until = t + 0.3; }
    } else if (f.st === 'up' && t >= f.until) f.until = -1;
    if (b.defeated) return;
  }
  b.fists = b.fists.filter((f) => f.until >= 0);
  if (b.mode === 'attack' && !b.fists.length) { b.mode = 'idle'; b.nextAttack = t + (b.phase === 1 ? 1.1 : b.phase === 2 ? 0.9 : 0.7); }
  // faz 2+: yuvarlanan toplar (kahramanın koştuğu duvardan, ona doğru)
  if (b.phase >= 2) {
    if (!b.warnWall && t >= b.nextBall) { b.warnWall = { side: h.dir, at: t + 0.7, kind: 'ball', pair: false }; }
    if (b.warnWall && t >= b.warnWall.at) { const side = b.warnWall.side; b.balls.push({ x: side > 0 ? ARENA_W - WALL_W - 20 : WALL_W + 20, vx: -side * (190 + b.phase * 20), t0: t }); b.warnWall = null; b.nextBall = t + (b.phase === 3 ? 3.4 : 3.8); }
    for (const ball of b.balls) { ball.x += ball.vx * C.DT; if (hit(hb, ball.x - 15, GROUND_Y - 34, ball.x + 15, GROUND_Y)) { hurt(w, s, 'top', ball.x); ball.t0 = -1; } }
    b.balls = b.balls.filter((x) => x.t0 >= 0 && x.x > WALL_W && x.x < ARENA_W - WALL_W);
  }
  // faz 3: tavandan serumen damlası (gölge 0,8 sn)
  if (b.phase >= 3) {
    if (t >= b.nextDrop) { b.drops.push({ x: Math.max(60, Math.min(ARENA_W - 60, predictX(h.x, h.dir, 1.1) + (rnd(b) - 0.5) * 80)), t0: t }); b.nextDrop = t + 2.6; }
    for (const d of b.drops) { const age = t - d.t0; if (age > 0.8 && age < 1.05) { const y = GROUND_Y - 300 + (age - 0.8) / 0.25 * 300; if (hit(hb, d.x - 14, y - 26, d.x + 14, y)) { hurt(w, s, 'damla', d.x); d.t0 = -9; } } }
    b.drops = b.drops.filter((d) => t - d.t0 < 1.1);
  }
}

// ---------------------------------------------------------------- Gürültü Canavarı
/** faz 3 çift dalgası: ikinci dalganın (karşı duvardan) gecikmesi (sn) */
export const PAIR_DELAY = 0.35;
const waveSpeed = (b: BossState) => 250 + b.phase * 15;
/** çizilecek (doğmuş) dalgalar */
export const liveWaves = (b: BossState, t: number) => b.waves.filter((w) => w.t0 <= t);

function canavar(w: World, s: SimState, b: BossState, hb: ReturnType<typeof heroBox>) {
  const t = s.t; const h = s.hero;
  // çığlık: 3 nota
  if (b.mode !== 'stun' && b.mode !== 'scream' && t >= b.nextScream) {
    b.mode = 'scream'; b.until = t + 7;
    const xs = [96, 195, 294]; b.notes = xs.map((x, i) => ({ x: x + (rnd(b) - 0.5) * 30, y: GROUND_Y - (i === 1 ? 120 : 70), got: false }));
    if (s.events) s.events.push({ k: 'bossScream', x: 195, y: GROUND_Y - 300 });
  }
  if (b.mode === 'scream') {
    for (const n of b.notes) if (!n.got && hit(hb, n.x - 22, n.y - 22, n.x + 22, n.y + 22)) { n.got = true; if (s.events) s.events.push({ k: 'bossNote', x: n.x, y: n.y, n: b.notes.filter((q) => q.got).length }); }
    if (b.notes.every((n) => n.got)) { b.mode = 'stun'; b.until = t + 3.2; b.core = { x: 195, until: t + 3.2, immune: 0 }; b.notes = []; b.waves = []; b.warnWall = null; if (s.events) s.events.push({ k: 'bossStun', x: 195, y: GROUND_Y - 40 }); }
    else if (t >= b.until) { b.mode = 'idle'; b.notes = []; b.nextScream = t + 3; }
  }
  if (b.mode === 'stun' && b.core) {
    const c = b.core; const cy = GROUND_Y - 40;
    if (t >= c.until) { b.core = null; b.mode = 'idle'; b.nextScream = t + 7.5; b.nextAttack = t + 1.2; }
    else if (t >= c.immune && hit(hb, c.x - 34, cy - 34, c.x + 34, cy + 34) && (h.dash > 0 || h.pound)) { c.immune = t + 0.6; damageBoss(w, s, 3, h.dash > 0 ? 'darbe' : 'cakil'); if (h.pound) { h.pound = false; h.vy = -480; } }
    return;
  }
  // dalgalar
  if (!b.warnWall && t >= b.nextAttack) {
    const kind: Wave['kind'] = b.phase === 1 ? 'low' : rnd(b) < 0.5 ? 'low' : 'high';
    b.warnWall = { side: h.dir, at: t + 0.75, kind, pair: b.phase === 3 };
  }
  if (b.warnWall && t >= b.warnWall.at) {
    const side = b.warnWall.side; const x0 = side > 0 ? ARENA_W - WALL_W - 12 : WALL_W + 12;
    b.waves.push({ x: x0, dir: (side > 0 ? -1 : 1), kind: b.warnWall.kind as Wave['kind'], t0: t });
    // çift dalga: ikincisi KARŞI duvardan, ters türde ve PAIR_DELAY sn sonra doğar (doğmadan önce ne hareket eder ne vurur).
    // Kahramanın arkasından gelir ve onu yavaşça (dalga 295 − koşu 260 px/sn) yakalar; öndekini aştıktan sonra duvarda dönünce
    // karşısına çıkar → iki karşılaşma arası rahat. Eskiden arenanın dışında (x0 + side·330) doğup aynı karede ayıklanıyordu.
    if (b.warnWall.pair) { const xb = side > 0 ? WALL_W + 12 : ARENA_W - WALL_W - 12; b.waves.push({ x: xb, dir: (side > 0 ? 1 : -1), kind: b.warnWall.kind === 'low' ? 'high' : 'low', t0: t + PAIR_DELAY }); }
    b.warnWall = null; b.nextAttack = t + (b.phase === 1 ? 2.1 : b.phase === 2 ? 2.2 : 2.9) * (b.mode === 'scream' ? 1.4 : 1);
  }
  const sp = waveSpeed(b);
  for (const wv of b.waves) {
    if (wv.t0 > t) continue; // henüz doğmadı (çift dalganın ikincisi)
    wv.x += wv.dir * sp * C.DT;
    const box = wv.kind === 'low' ? [wv.x - 12, GROUND_Y - 30, wv.x + 12, GROUND_Y] : [wv.x - 12, GROUND_Y - 78, wv.x + 12, GROUND_Y - 26];
    if (hit(hb, box[0]!, box[1]!, box[2]!, box[3]!)) { hurt(w, s, 'dalga', wv.x); wv.t0 = -1; }
  }
  b.waves = b.waves.filter((wv) => wv.t0 >= 0 && wv.x > WALL_W - 40 && wv.x < ARENA_W - WALL_W + 40);
  // faz 2+: düşen gürültü bulutları
  if (b.phase >= 2) {
    if (t >= b.nextDrop) { b.drops.push({ x: Math.max(60, Math.min(ARENA_W - 60, predictX(h.x, h.dir, 1.1))), t0: t }); b.nextDrop = t + (b.phase === 3 ? 2.6 : 3.4); }
    for (const d of b.drops) { const age = t - d.t0; if (age > 0.85 && age < 1.15) { const y = GROUND_Y - 320 + (age - 0.85) / 0.3 * 320; if (hit(hb, d.x - 22, y - 30, d.x + 22, y)) { hurt(w, s, 'bulut', d.x); d.t0 = -9; } } }
    b.drops = b.drops.filter((d) => t - d.t0 < 1.2);
  }
}
