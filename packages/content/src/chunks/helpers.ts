import type { ChunkSpec, Entity, MechanicId } from '@odi/shared';
import { GROUND_Y } from '@odi/shared';

/** Parça yazımını kısaltan yardımcılar. Koordinatlar px; y dünya yüksekliği (GROUND_Y zemin). */
export const ground = (x: number, w: number, y = GROUND_Y): Entity => ({ type: 'platform', x, y, w, h: 200 });
export const plat = (x: number, y: number, w: number, h = 24): Entity => ({ type: 'platform', x, y, w, h });
export const spike = (x: number, w = 32, y = GROUND_Y): Entity => ({ type: 'spike', x, y, w });
export const coin = (x: number, y: number): Entity => ({ type: 'coin', x, y });
export const coins = (x: number, y: number, n: number, gap = 36, arc = 0): Entity[] => Array.from({ length: n }, (_, i) => coin(x + i * gap, y - Math.sin((i / Math.max(1, n - 1)) * Math.PI) * arc));
export const enemy = (x: number, y: number, kind = 'bakteri', dx = 60): Entity => ({ type: 'enemy', x, y, props: { kind, dx } });
export const power = (x: number, y: number, kind: 'shield' | 'magnet' | 'life' | 'speed'): Entity => ({ type: 'powerup', x, y, props: { kind } });
export const hazard = (x: number, y: number, w: number, h: number, kind = 'gurultu'): Entity => ({ type: 'hazard', x, y, w, h, props: { kind } });
export const text = (x: number, y: number, t: string): Entity => ({ type: 'text', x, y, props: { text: t } });
export const secret = (x: number, y: number): Entity => ({ type: 'secret', x, y });
export const checkpoint = (x: number): Entity => ({ type: 'checkpoint', x, y: GROUND_Y });
export const spring = (x: number, y: number, power = 1): Entity => ({ type: 'spring', x, y, props: { power } });
export const trampoline = (x: number, y: number, w = 128, power = 1): Entity => ({ type: 'trampoline', x, y, w, props: { power } });
export const moving = (x: number, y: number, w: number, dx: number, dy: number, period: number): Entity => ({ type: 'moving', x, y, w, h: 24, props: { dx, dy, period } });

export function chunk(id: string, mechanic: MechanicId, difficulty: ChunkSpec['difficulty'], length: number, entities: Entity[], opts: Partial<Pick<ChunkSpec, 'entryY' | 'exitY' | 'tags' | 'biomes' | 'rest'>> = {}): ChunkSpec {
  return { id, mechanic, difficulty, length, entities, entryY: opts.entryY ?? GROUND_Y, exitY: opts.exitY ?? GROUND_Y, tags: opts.tags ?? [], biomes: opts.biomes, rest: opts.rest };
}
