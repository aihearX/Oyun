import type { AbilityId, Entity, EntityType, LevelSpec, PlayerSkills } from '@odi/shared';
import { GROUND_Y } from '@odi/shared';
import { abilitiesAt } from '@odi/content';
import { BUCKET, CEIL_GAP, END_PAD, START_PAD } from './consts';

/**
 * Dünya: LevelSpec → değişmez varlık listesi (dünya koordinatlarında AABB) + x kovaları (hızlı yakın sorgu).
 * Değişen her şey (toplananlar, kırılanlar, kapılar, asansörler…) SimState'te tutulur; dünya paylaşılır.
 *
 * Yazım kuralları (parça içi koordinatlar, `chunks/helpers.ts`):
 *  dikdörtgenler (platform, moving, wall, crumble, barrier, door, freqgate, beat, echo, lift, water, gravzone, hazard, current): x,y sol-üst
 *  ayak noktalı (enemy, spring, trampoline, launcher, switch, checkpoint, gate): x orta, y taban
 *  noktalar (coin, note, collect, secret, powerup, fork, bubble, hook, escortee, text): x,y merkez
 *  spike: x sol, y taban · tutor: [x, x+w] tetik aralığı
 */

export type Cls = 'solid' | 'oneway' | 'hazard' | 'enemy' | 'pickup' | 'trigger' | 'zone' | 'hook' | 'none';

export interface WEnt {
  id: number; type: EntityType; cls: Cls;
  /** dinlenme AABB'si */
  l: number; t: number; r: number; b: number;
  /** yazılan nokta (dünya) */
  x: number; y: number; w: number; h: number;
  p: Record<string, number | string | boolean>;
  /** kova için yatay kapsam (hareket dahil) */
  sl: number; sr: number;
  /** melodi notası sırası / kapı-anahtar kimliği vb. */
  ord: number; key: string;
  /** bulunduğu bölüm-içi bölüm (0-2) */
  sec: number;
}

export interface WorldMods { yanki: boolean; tersYercekimi: boolean; hiz: boolean; tekCan: boolean; ayna: boolean; sis: boolean; gece: boolean; cihazKapali: boolean }

export interface World {
  spec: LevelSpec;
  ents: WEnt[];
  buckets: number[][];
  worldW: number;
  startX: number; startY: number;
  gateX: number; gateY: number;
  abilities: Set<AbilityId>;
  skills: PlayerSkills;
  mods: WorldMods;
  /** vuruş süresi (sn): biyom müziğinin BPM'i */
  beatDur: number;
  /** bölüm-içi bölüm başlangıç x'leri */
  sectionX: number[];
  notesTotal: number;
  coinsTotal: number;
  cochleasTotal: number;
  boss: boolean;
  /** sorgu damgası (yinelenenleri ele) */
  stamp: Int32Array; stampN: number;
  /** ters yerçekimi tavanlarının x aralıkları */
  ceilings: { l: number; r: number }[];
}

const RECT_TYPES = new Set<EntityType>(['platform', 'moving', 'wall', 'crumble', 'barrier', 'door', 'freqgate', 'beat', 'echo', 'lift', 'water', 'gravzone', 'hazard', 'current']);

function classify(e: Entity): Cls {
  switch (e.type) {
    case 'platform': return (e.h ?? 24) <= 32 ? 'oneway' : 'solid';
    case 'wall': case 'barrier': case 'door': case 'freqgate': return 'solid';
    case 'moving': case 'crumble': case 'beat': case 'echo': case 'lift': case 'trampoline': return 'oneway';
    case 'spike': case 'hazard': case 'lane': case 'gear': return 'hazard';
    case 'enemy': return 'enemy';
    case 'coin': case 'note': case 'collect': case 'secret': case 'powerup': case 'fork': case 'bubble': return 'pickup';
    case 'spring': case 'launcher': case 'switch': case 'checkpoint': case 'gate': case 'tutor': case 'escortee': case 'flip': return 'trigger';
    case 'water': case 'gravzone': case 'current': return 'zone';
    case 'hook': return 'hook';
    default: return 'none';
  }
}

function rect(e: Entity, x: number): { l: number; t: number; r: number; b: number } {
  const y = e.y; const p = e.props ?? {};
  if (RECT_TYPES.has(e.type)) {
    const w = e.w ?? (e.type === 'wall' ? 40 : e.type === 'door' || e.type === 'freqgate' || e.type === 'barrier' ? 36 : 120);
    const h = e.h ?? (e.type === 'wall' ? 300 : e.type === 'door' || e.type === 'freqgate' || e.type === 'barrier' ? 160 : e.type === 'beat' || e.type === 'echo' || e.type === 'lift' ? 20 : 24);
    return { l: x, t: y, r: x + w, b: y + h };
  }
  switch (e.type) {
    case 'spike': { const w = e.w ?? 32; return { l: x + 5, t: y - 16, r: x + w - 5, b: y }; }
    case 'trampoline': { const w = e.w ?? 128; return { l: x - w / 2, t: y - 20, r: x + w / 2, b: y }; }
    case 'spring': return { l: x - 18, t: y - 30, r: x + 18, b: y };
    case 'launcher': return { l: x - 26, t: y - 26, r: x + 26, b: y };
    case 'switch': return p.by === 'darbe' ? { l: x - 14, t: y - 64, r: x + 14, b: y } : { l: x - 24, t: y - 12, r: x + 24, b: y };
    case 'checkpoint': return { l: x - 10, t: y - 400, r: x + 10, b: y + 60 };
    case 'gate': return { l: x - 45, t: y - 150, r: x + 45, b: y };
    case 'tutor': { const w = e.w ?? 200; return { l: x, t: y - 600, r: x + w, b: y + 300 }; }
    case 'enemy': return { l: x - 17, t: y - 30, r: x + 17, b: y };
    case 'lane': return { l: x - 26, t: y - 26, r: x + 26, b: y + 26 };
    case 'gear': { const r = Number(p.r ?? 40) * 0.8; return { l: x - r, t: y - r, r: x + r, b: y + r }; }
    case 'escortee': return { l: x - 16, t: y - 16, r: x + 16, b: y + 16 };
    default: return { l: x - 14, t: y - 14, r: x + 14, b: y + 14 };
  }
}

/** varlığın hareket kapsamı (kova kaydı için) */
function sweep(e: Entity, rr: { l: number; r: number }): { sl: number; sr: number } {
  const p = e.props ?? {}; let dx = Math.abs(Number(p.dx ?? 0));
  if (e.type === 'enemy') { const k = String(p.kind ?? 'devriye'); if (k === 'atici') dx = Number(p.range ?? 520); else dx = Math.max(dx, 60); }
  if (e.type === 'hook') dx = Number(p.r ?? 140) + 60;
  if (p.chase) dx = Number(p.until ?? 2000) + 40;
  if (e.type === 'beat' && p.mode === 'kay') dx = Math.abs(Number(p.dx ?? 120));
  return { sl: rr.l - dx - 4, sr: rr.r + dx + 4 };
}

export function worldMods(spec: LevelSpec): WorldMods {
  const m = spec.modifiers;
  return { yanki: m.includes('yanki'), tersYercekimi: m.includes('ters-yercekimi'), hiz: m.includes('hiz'), tekCan: m.includes('tek-can'), ayna: m.includes('ayna'), sis: m.includes('sis'), gece: m.includes('gece'), cihazKapali: m.includes('cihaz-kapali') };
}

export interface BuildOpts { skills: PlayerSkills; bpm?: number }

/** LevelSpec → World (deterministik, Phaser'sız) */
export function buildWorld(spec: LevelSpec, o: BuildOpts): World {
  const ents: WEnt[] = [];
  const add = (e: Entity, wx: number, sec: number) => {
    const x = wx + e.x; const rr = rect(e, x); const sw = sweep(e, rr);
    const id = ents.length;
    ents.push({ id, type: e.type, cls: classify(e), ...rr, x, y: e.y, w: e.w ?? rr.r - rr.l, h: e.h ?? rr.b - rr.t, p: { ...(e.props ?? {}) }, sl: sw.sl, sr: sw.sr, ord: -1, key: String(e.props?.id ?? ''), sec });
    return id;
  };
  const isBoss = spec.mechanic === 'boss' || !!spec.boss;
  let x = START_PAD;
  const firstY = spec.chunks[0]?.entryY ?? GROUND_Y;
  const sectionX: number[] = [];
  const starts = spec.sectionStarts ?? [0];
  let sec = 0;
  if (isBoss) {
    // arena: kahraman duvarlar arasında koşar (boss.ts kurar); burada yalnızca zemin
    x = 390;
  } else {
    spec.chunks.forEach((c, i) => {
      while (sec + 1 < starts.length && i >= (starts[sec + 1] ?? Infinity)) sec++;
      if (starts.includes(i)) sectionX.push(x);
      for (const e of c.entities) add(e, x, sec);
      x += c.length;
    });
  }
  if (!sectionX.length) sectionX.push(START_PAD);
  const worldW = isBoss ? 390 : x + END_PAD;
  const lastY = spec.chunks[spec.chunks.length - 1]?.exitY ?? GROUND_Y;
  // başlangıç ve bitiş zemini + kapı
  if (!isBoss) {
    add({ type: 'platform', x: -80, y: -1400, w: 80, h: GROUND_Y + 1800 }, 0, 0); // dünyanın sol sınırı
    add({ type: 'platform', x: 0, y: firstY, w: START_PAD + 10, h: 200 }, 0, 0);
    add({ type: 'platform', x: x - 10, y: lastY, w: END_PAD + 10, h: 200 }, 0, 2);
    add({ type: 'gate', x: worldW - 150, y: lastY }, 0, 2);
  }
  const mods = worldMods(spec);
  // ters yerçekimi: kalın zeminlerin üstüne tavan
  const ceilings: { l: number; r: number }[] = [];
  if (mods.tersYercekimi && !isBoss) {
    for (const e of [...ents]) if (e.type === 'platform' && e.h >= 100 && e.t >= GROUND_Y - 10) { add({ type: 'platform', x: e.l, y: e.t - CEIL_GAP, w: e.r - e.l, h: 40, props: { tavan: true } }, 0, e.sec); ceilings.push({ l: e.l, r: e.r }); }
    ceilings.sort((a, b) => a.l - b.l);
  }
  // melodi notaları: x sırası
  const notes = ents.filter((e) => e.type === 'note').sort((a, b) => a.x - b.x);
  notes.forEach((n, i) => { n.ord = i; });
  // kovalar
  const nb = Math.ceil(Math.max(worldW, 400) / BUCKET) + 2;
  const buckets: number[][] = Array.from({ length: nb }, () => []);
  for (const e of ents) {
    if (e.cls === 'none') continue;
    const b0 = Math.max(0, Math.floor(e.sl / BUCKET)), b1 = Math.min(nb - 1, Math.floor(e.sr / BUCKET));
    for (let b = b0; b <= b1; b++) buckets[b]!.push(e.id);
  }
  const gate = ents.find((e) => e.type === 'gate');
  const coinsTotal = ents.reduce((a, e) => a + (e.type === 'coin' ? 1 : e.type === 'collect' ? 5 : 0), 0);
  return {
    spec, ents, buckets, worldW,
    startX: isBoss ? 120 : 100, startY: isBoss ? GROUND_Y : firstY,
    gateX: gate ? gate.x : worldW - 150, gateY: gate ? gate.y : GROUND_Y,
    abilities: new Set(spec.abilities ?? abilitiesAt(spec.number)), skills: o.skills, mods,
    beatDur: 60 / (o.bpm ?? 100), sectionX,
    notesTotal: notes.length, coinsTotal, cochleasTotal: ents.filter((e) => e.type === 'secret').length,
    boss: isBoss, stamp: new Int32Array(ents.length + 64), stampN: 1, ceilings,
  };
}

/** [x0,x1] aralığına değen varlık kimlikleri (yinelenmesiz). Dönen dizi bir sonraki çağrıya kadar geçerlidir. */
const NEAR: number[] = [];
export function near(w: World, x0: number, x1: number): number[] {
  NEAR.length = 0;
  const n = ++w.stampN; if (n > 2e9) { w.stamp.fill(0); w.stampN = 1; }
  const b0 = Math.max(0, Math.floor(x0 / BUCKET)), b1 = Math.min(w.buckets.length - 1, Math.floor(x1 / BUCKET));
  for (let b = b0; b <= b1; b++) for (const id of w.buckets[b]!) { if (w.stamp[id] !== w.stampN) { w.stamp[id] = w.stampN; NEAR.push(id); } }
  return NEAR;
}

/** dünyaya sonradan varlık ekle (boss arenası) */
export function addEntity(w: World, e: Entity): number {
  const x = e.x; const rr = rect(e, x); const sw = sweep(e, rr); const id = w.ents.length;
  w.ents.push({ id, type: e.type, cls: classify(e), ...rr, x, y: e.y, w: e.w ?? rr.r - rr.l, h: e.h ?? rr.b - rr.t, p: { ...(e.props ?? {}) }, sl: sw.sl, sr: sw.sr, ord: -1, key: String(e.props?.id ?? ''), sec: 0 });
  const b0 = Math.max(0, Math.floor(sw.sl / BUCKET)), b1 = Math.min(w.buckets.length - 1, Math.floor(sw.sr / BUCKET));
  for (let b = b0; b <= b1; b++) w.buckets[b]!.push(id);
  if (w.stamp.length <= id) { const s = new Int32Array(id + 64); s.set(w.stamp); w.stamp = s; }
  return id;
}
