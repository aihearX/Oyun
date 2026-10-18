import type { AbilityId, ChunkSpec, Entity, LevelSpec, PlayerSkills } from '@odi/shared';
import { GROUND_Y } from '@odi/shared';
import { abilitiesAt, DEFAULT_SKILLS } from '@odi/content';
import { resolveTrack } from '@odi/audio';
import { generateLevel } from '@odi/level-gen';
import { buildWorld, type World } from './world';
import { initState, step, NO_INPUT, type SimInput, type SimState } from './sim';
import { Planner } from './planner';

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

export interface PlayOutcome { finished: boolean; failed: string | null; t: number; coins: number; damage: number; searches: number }
/** bölümü planlayıcı bot (ya da boşta) ile oynat */
export function playLevel(n: number, o: { idle?: boolean; salt?: number; maxT?: number } = {}): PlayOutcome {
  const spec = generateLevel('insan', n, { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS }, o.salt ?? 0);
  const { w, s } = setup(spec); s.events = null;
  const p = o.idle ? null : new Planner(w); const maxT = o.maxT ?? 300;
  while (!s.finished && !s.failed && s.t < maxT) step(w, s, p ? p.next(s) : NO_INPUT);
  return { finished: s.finished, failed: s.failed, t: s.t, coins: s.coins, damage: s.damageTaken, searches: p?.stats.searches ?? 0 };
}
