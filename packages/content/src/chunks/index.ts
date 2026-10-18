import type { ChunkSpec, MechanicId } from '@odi/shared';
import { ChunkSchema } from '../schema';
import { GENEL_CHUNKS } from './genel';
import { GENEL_ODA_CHUNKS } from './genel-oda';
import { OGRETICI_CHUNKS } from './ogretici';
import { DIS_KULAK_CHUNKS } from './dis-kulak';
import { KANAL_CHUNKS } from './kanal';
import { ZAR_CHUNKS } from './zar';
import { KEMIKCIKLER_CHUNKS } from './kemikcikler';
import { KOKLEA_CHUNKS } from './koklea';
import { SINIR_CHUNKS } from './sinir';
import { BEYIN_SAPI_CHUNKS } from './beyin-sapi';
import { KORTEKS_CHUNKS } from './korteks';
export { GENEL_CHUNKS, GENEL_ODA_CHUNKS, OGRETICI_CHUNKS, DIS_KULAK_CHUNKS, KANAL_CHUNKS, ZAR_CHUNKS, KEMIKCIKLER_CHUNKS, KOKLEA_CHUNKS, SINIR_CHUNKS, BEYIN_SAPI_CHUNKS, KORTEKS_CHUNKS };

/** Tüm el yapımı odalar: genel (nefes/kontrol), öğretici, biyomdan bağımsız odalar, biyom odaları ve gösteri parçaları. */
export const ALL_CHUNKS: ChunkSpec[] = [
  ...GENEL_CHUNKS, ...OGRETICI_CHUNKS, ...GENEL_ODA_CHUNKS, ...DIS_KULAK_CHUNKS, ...KANAL_CHUNKS, ...ZAR_CHUNKS,
  ...KEMIKCIKLER_CHUNKS, ...KOKLEA_CHUNKS, ...SINIR_CHUNKS, ...BEYIN_SAPI_CHUNKS, ...KORTEKS_CHUNKS,
];

/** Mekaniğin parçaları (geriye uyum); yoksa tümü. */
export function chunksFor(mechanic: MechanicId): ChunkSpec[] { const own = ALL_CHUNKS.filter((c) => c.mechanic === mechanic); return own.length ? own : ALL_CHUNKS; }

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
    if (c.entities.filter((e) => e.type === 'tutor').length > 1) errors.push(`${c.id}: birden çok öğretici an`);
  }
  return errors;
}
