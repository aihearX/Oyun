import type { AbilityId, ChunkSpec, Entity, LevelSpec, PlayerSkills } from '@odi/shared';
import { GROUND_Y } from '@odi/shared';
import { ABILITIES, abilitiesAt, chunkNeeds, DEFAULT_SKILLS } from '@odi/content';
import { resolveTrack } from '@odi/audio';
import { generateLevel } from '@odi/level-gen';
import { buildWorld, type World } from './world';
import { initState, step, NO_INPUT, type SimInput, type SimState } from './sim';
import { Planner, type PlanPrefs } from './planner';

/** Testler ve araçlar için: Phaser'sız bölüm kurulumu ve oynatma. */
export function testSpec(entities: Entity[], o: { number?: number; abilities?: AbilityId[]; length?: number; modifiers?: LevelSpec['modifiers'] } = {}): LevelSpec {
  const length = o.length ?? 3000;
  const c: ChunkSpec = { id: 't', mechanic: 'kosu', difficulty: 1, length, entryY: GROUND_Y, exitY: GROUND_Y, tags: [], entities };
  const number = o.number ?? 40;
  return { id: 't', number, journey: 'insan', name: 't', biome: 'dis-kulak', mechanic: 'kosu', objective: { id: 'reach', label: '' }, modifiers: o.modifiers ?? [], seed: 1, chunks: [c], lengthPx: length, parTimeSec: 60, coinsTotal: 0, abilities: o.abilities ?? abilitiesAt(number) };
}
export function setup(spec: LevelSpec, skills: PlayerSkills = DEFAULT_SKILLS): { w: World; s: SimState } {
  const bpm = resolveTrack(spec.mechanic === 'boss' ? 'boss' : `biyom:${spec.biome}`)?.bpm ?? 100;
  const w = buildWorld(spec, { skills, bpm }); const s = initState(w); return { w, s };
}
export const press = (o: Partial<SimInput> = {}): SimInput => ({ ...NO_INPUT, ...o });
export function run(w: World, s: SimState, steps: number, input: (i: number) => SimInput = () => NO_INPUT) { for (let i = 0; i < steps; i++) step(w, s, input(i)); }

export interface PlayOutcome {
  finished: boolean; failed: string | null; t: number; coins: number; damage: number; searches: number;
  /** en uzun girdisiz süre (sn): ne dokunuş/basılı tutma ne kaydırma — "ölü yol" ölçüsü */
  maxGap: number; gapAt: number;
  /** zar sıçrayışları (güçlü + sönük), en uzun kesintisiz duvar zıplaması zinciri, toplanan altın koklea */
  tramps: number; wallChain: number; cochleas: number;
}
/** bölümü planlayıcı bot (ya da boşta) ile oynat; `prefs`: planlayıcı tercihleri (ör. gizli koklealara sapmayan "ana yol" oyuncusu) */
export function playLevel(n: number, o: { idle?: boolean; salt?: number; maxT?: number; prefs?: PlanPrefs } = {}): PlayOutcome {
  const spec = generateLevel('insan', n, { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS }, o.salt ?? 0);
  const { w, s } = setup(spec); s.events = [];
  const p = o.idle ? null : new Planner(w, o.prefs ?? false); const maxT = o.maxT ?? 300;
  let lastAct = 0, maxGap = 0, gapAt = 0, tramps = 0, chain = 0, wallChain = 0, lastWall = -9;
  while (!s.finished && !s.failed && s.t < maxT) {
    const inp = p ? p.next(s) : NO_INPUT;
    if (inp.down || inp.pressed || inp.swipeDown || inp.dash) lastAct = s.t;
    step(w, s, inp);
    if (s.t - lastAct > maxGap) { maxGap = s.t - lastAct; gapAt = lastAct; }
    for (const e of s.events!) {
      if (e.k === 'tramp-strong' || e.k === 'tramp-weak') tramps++;
      else if (e.k === 'walljump') { chain = s.t - lastWall < 1.6 ? chain + 1 : 1; lastWall = s.t; wallChain = Math.max(wallChain, chain); }
    }
    s.events!.length = 0;
  }
  return { finished: s.finished, failed: s.failed, t: s.t, coins: s.coins, damage: s.damageTaken, searches: p?.stats.searches ?? 0, maxGap, gapAt, tramps, wallChain, cochleas: s.cochleas };
}

/** biyomun son normal bölümü (oda testleri o bölümün yetenekleriyle oynar) */
const BIOME_LEVEL: Record<string, number> = { 'dis-kulak': 5, kanal: 8, zar: 12, kemikcikler: 19, 'koklea-1': 23, 'koklea-2': 26, 'koklea-3': 30, sinir: 33, 'beyin-sapi': 36, korteks: 39 };
export interface RoomOutcome { finished: boolean; failed: string | null; t: number; autoTurns: number; damage: number; level: number }
/** tek odayı (önünde ve arkasında 200 px düz zemin) uygun bölümün yetenekleriyle planlayıcı botla oyna */
export function playRoom(c: ChunkSpec, maxT = 40): RoomOutcome {
  const needLv = Math.max(1, ...chunkNeeds(c).map((a) => ABILITIES[a].level));
  const biome = (c.biomes?.[0] ?? 'dis-kulak') as LevelSpec['biome'];
  const level = Math.max(needLv, c.biomes ? BIOME_LEVEL[biome] ?? needLv : needLv);
  const pad: ChunkSpec = { id: 'pad', mechanic: 'kosu', difficulty: 1, length: 200, entities: [{ type: 'platform', x: 0, y: GROUND_Y, w: 200, h: 200 }], entryY: GROUND_Y, exitY: GROUND_Y, tags: [] };
  const spec: LevelSpec = { id: 't', number: level, journey: 'insan', name: 't', biome, mechanic: 'kosu', objective: { id: 'reach', label: '' }, modifiers: [], seed: 1, chunks: [pad, c, pad], lengthPx: c.length + 400, parTimeSec: 60, coinsTotal: 0, abilities: abilitiesAt(level), sectionStarts: [0] };
  const { w, s } = setup(spec); s.events = [];
  const p = new Planner(w); let autoTurns = 0;
  while (!s.finished && !s.failed && s.t < maxT) { step(w, s, p.next(s)); for (const e of s.events!) if (e.k === 'turn') autoTurns++; s.events!.length = 0; }
  return { finished: s.finished, failed: s.failed, t: s.t, autoTurns, damage: s.damageTaken, level };
}
