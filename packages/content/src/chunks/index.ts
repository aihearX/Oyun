import type { ChunkSpec, MechanicId } from '@odi/shared';
import { ChunkSchema } from '../schema';
import { KOSU_CHUNKS } from './kosu';
import { YUZME_CHUNKS } from './yuzme';
import { TRAMBOLIN_CHUNKS } from './trambolin';
import { MAKINE_CHUNKS } from './makine';
import { IMPULS_CHUNKS } from './impuls';
import { RUYA_CHUNKS } from './ruya';
export { KOSU_CHUNKS, YUZME_CHUNKS, TRAMBOLIN_CHUNKS, MAKINE_CHUNKS, IMPULS_CHUNKS, RUYA_CHUNKS };

export const ALL_CHUNKS: ChunkSpec[] = [...KOSU_CHUNKS, ...YUZME_CHUNKS, ...TRAMBOLIN_CHUNKS, ...MAKINE_CHUNKS, ...IMPULS_CHUNKS, ...RUYA_CHUNKS];

/** Mekaniğin parçaları; henüz yoksa koşu parçalarına düşer (geliştirme sırasında bölümler açılabilsin). */
export function chunksFor(mechanic: MechanicId): ChunkSpec[] { const own = ALL_CHUNKS.filter((c) => c.mechanic === mechanic); return own.length ? own : KOSU_CHUNKS; }

/** Şema doğrulaması; testte ve geliştirme başlangıcında çağrılır. */
export function validateChunks(list: ChunkSpec[] = ALL_CHUNKS): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const c of list) {
    const r = ChunkSchema.safeParse(c);
    if (!r.success) errors.push(`${c.id}: ${r.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`);
    if (ids.has(c.id)) errors.push(`çift id: ${c.id}`);
    ids.add(c.id);
    for (const e of c.entities) if (e.x < 0 || e.x > c.length) errors.push(`${c.id}: ${e.type} x=${e.x} parça dışında`);
  }
  return errors;
}
