import type { AbilityId, BiomeId, ChunkSpec, Entity, MechanicId } from '@odi/shared';
import { GROUND_Y } from '@odi/shared';

/**
 * Parça yazımını kısaltan yardımcılar. Koordinatlar px; y dünya yüksekliği (GROUND_Y zemin).
 * Dikdörtgenler sol-üst (x,y); ayaklılar (düşman, yay, zar, fırlatıcı, anahtar) x orta / y taban; noktalar merkez.
 */
export const G = GROUND_Y;
export const ground = (x: number, w: number, y = GROUND_Y): Entity => ({ type: 'platform', x, y, w, h: 200 });
export const plat = (x: number, y: number, w: number, h = 24): Entity => ({ type: 'platform', x, y, w, h });
/** kalın blok (katı, alttan geçilmez) */
export const block = (x: number, y: number, w: number, h: number): Entity => ({ type: 'platform', x, y, w, h: Math.max(40, h) });
export const spike = (x: number, w = 32, y = GROUND_Y): Entity => ({ type: 'spike', x, y, w });
export const coin = (x: number, y: number): Entity => ({ type: 'coin', x, y });
export const coins = (x: number, y: number, n: number, gap = 36, arc = 0): Entity[] => Array.from({ length: n }, (_, i) => coin(x + i * gap, y - Math.sin((i / Math.max(1, n - 1)) * Math.PI) * arc));
/** dikey jeton sütunu */
export const coinCol = (x: number, y: number, n: number, gap = 36): Entity[] => Array.from({ length: n }, (_, i) => coin(x, y - i * gap));
export const enemy = (x: number, y: number, kind = 'devriye', dx = 60, extra: Record<string, number | string | boolean> = {}): Entity => ({ type: 'enemy', x, y, props: { kind, dx, ...extra } });
export const power = (x: number, y: number, kind: 'shield' | 'magnet' | 'life' | 'speed'): Entity => ({ type: 'powerup', x, y, props: { kind } });
export const hazard = (x: number, y: number, w: number, h: number, kind = 'gurultu', extra: Record<string, number | string | boolean> = {}): Entity => ({ type: 'hazard', x, y, w, h, props: { kind, ...extra } });
export const text = (x: number, y: number, t: string): Entity => ({ type: 'text', x, y, props: { text: t } });
/** altın koklea adayı (üretici her bölüm-içi bölümde birini tutar) */
export const secret = (x: number, y: number): Entity => ({ type: 'secret', x, y });
export const checkpoint = (x: number, y = GROUND_Y): Entity => ({ type: 'checkpoint', x, y });
export const spring = (x: number, y: number, power = 1): Entity => ({ type: 'spring', x, y, props: { power } });
export const trampoline = (x: number, y: number, w = 128, power = 1): Entity => ({ type: 'trampoline', x, y, w, props: { power } });
export const moving = (x: number, y: number, w: number, dx: number, dy: number, period: number, phase = 0): Entity => ({ type: 'moving', x, y, w, h: 24, props: { dx, dy, period, phase } });
export const decor = (x: number, y: number, kind: string, scale = 1): Entity => ({ type: 'decor', x, y, props: { kind, scale } });
// ---- v2
export const wall = (x: number, y: number, h: number, w = 40): Entity => ({ type: 'wall', x, y, w, h });
export const hook = (x: number, y: number, r = 150): Entity => ({ type: 'hook', x, y, props: { r } });
export const crumble = (x: number, y: number, w = 120): Entity => ({ type: 'crumble', x, y, w, h: 24 });
export const barrier = (x: number, y: number, h = 160, w = 36): Entity => ({ type: 'barrier', x, y, w, h });
export const sw = (x: number, y: number, id: string, by: 'cakil' | 'darbe' = 'cakil'): Entity => ({ type: 'switch', x, y, props: { id, by } });
export const door = (x: number, y: number, h: number, id: string, w = 36): Entity => ({ type: 'door', x, y, w, h, props: { id } });
export const fork = (x: number, y: number, color: number): Entity => ({ type: 'fork', x, y, props: { color } });
export const fgate = (x: number, y: number, h: number, color: number, w = 36): Entity => ({ type: 'freqgate', x, y, w, h, props: { color } });
export const beat = (x: number, y: number, w: number, pattern: string, extra: Record<string, number | string | boolean> = {}): Entity => ({ type: 'beat', x, y, w, h: 20, props: { pattern, mode: 'belir', ...extra } });
export const beatSlide = (x: number, y: number, w: number, dx: number, pattern: string, offset = 0): Entity => ({ type: 'beat', x, y, w, h: 20, props: { pattern, mode: 'kay', dx, offset } });
export const echo = (x: number, y: number, w = 120): Entity => ({ type: 'echo', x, y, w, h: 20 });
export const launcher = (x: number, y: number, vx: number, vy: number): Entity => ({ type: 'launcher', x, y, props: { vx, vy } });
export const water = (x: number, y: number, w: number, h: number): Entity => ({ type: 'water', x, y, w, h });
export const current = (x: number, y: number, w: number, h: number, vx: number, vy = 0): Entity => ({ type: 'current', x, y, w, h, props: { vx, vy } });
export const bubble = (x: number, y: number): Entity => ({ type: 'bubble', x, y });
export const grav = (x: number, y: number, w: number, h: number): Entity => ({ type: 'gravzone', x, y, w, h });
export const lift = (x: number, y: number, w: number, dy: number): Entity => ({ type: 'lift', x, y, w, h: 20, props: { dy } });
/** havuz: yüzey zeminin 10 px altında, derinlik `depth`; yan duvarları kalın blokla yap (block(x, G, w, depth + 210)) */
export const pool = (x: number, w: number, depth: number): Entity[] => [water(x, G - 10, w, depth + 10), { type: 'platform', x: x - 20, y: G + depth, w: w + 40, h: 160 }];
/** havuz kenarı zemini (havuzun duvarı olur) */
export const bank = (x: number, w: number, depth = 250): Entity => ({ type: 'platform', x, y: G, w, h: depth + 210 });
export const collect = (x: number, y: number): Entity => ({ type: 'collect', x, y });
export const tutor = (x: number, w: number, ability: AbilityId): Entity => ({ type: 'tutor', x, y: GROUND_Y, w, props: { ability } });
export const note = (x: number, y: number): Entity => ({ type: 'note', x, y });
export const escortee = (x: number, y: number): Entity => ({ type: 'escortee', x, y });

export interface ChunkOpts { entryY?: number; exitY?: number; tags?: string[]; biomes?: BiomeId[]; rest?: boolean; needs?: AbilityId[]; setPiece?: boolean }
export function chunk(id: string, mechanic: MechanicId, difficulty: ChunkSpec['difficulty'], length: number, entities: Entity[], opts: ChunkOpts = {}): ChunkSpec {
  const c: ChunkSpec = { id, mechanic, difficulty, length, entities, entryY: opts.entryY ?? GROUND_Y, exitY: opts.exitY ?? GROUND_Y, tags: opts.tags ?? [], biomes: opts.biomes, rest: opts.rest };
  if (opts.needs) c.needs = opts.needs;
  if (opts.setPiece) c.setPiece = true;
  return c;
}
