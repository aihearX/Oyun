import { z } from 'zod';

/**
 * Oda şeması yalnız doğrulamada (testler, validateChunks) kullanılır. Şemalar ilk kullanımda kurulur: modülün üst düzeyinde
 * zod çağrısı olmadığı için oyun paketi (apps/web) zod'u hiç içermez (ağaç sallama).
 */
function build() {
  const MechanicIdSchema = z.enum(['kosu', 'yuzme', 'trambolin', 'makine', 'impuls', 'ruya', 'boss']);
  const BiomeIdSchema = z.enum(['dis-kulak', 'kanal', 'zar', 'kemikcikler', 'koklea-1', 'koklea-2', 'koklea-3', 'sinir', 'beyin-sapi', 'korteks']);
  const EntitySchema = z.object({
    type: z.enum(['platform', 'moving', 'spike', 'hazard', 'coin', 'note', 'enemy', 'powerup', 'spring', 'trampoline', 'gear', 'current', 'bubble', 'lane', 'flip', 'checkpoint', 'secret', 'escortee', 'gate', 'decor', 'text',
      'wall', 'hook', 'crumble', 'barrier', 'switch', 'door', 'fork', 'freqgate', 'beat', 'echo', 'launcher', 'water', 'gravzone', 'lift', 'collect', 'tutor']),
    x: z.number(), y: z.number(), w: z.number().optional(), h: z.number().optional(),
    props: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional(),
  });
  const ChunkSchema = z.object({
    id: z.string().min(1),
    mechanic: MechanicIdSchema,
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    length: z.number().min(160).max(3200),
    entities: z.array(EntitySchema),
    entryY: z.number(), exitY: z.number(),
    tags: z.array(z.string()),
    biomes: z.array(BiomeIdSchema).optional(),
    rest: z.boolean().optional(),
    needs: z.array(z.enum(['zipla', 'don', 'kayma', 'duvar', 'suzul', 'trambolin', 'kanca', 'cakil', 'yuz', 'darbe', 'cevir'])).optional(),
    setPiece: z.boolean().optional(),
  });
  return { MechanicIdSchema, BiomeIdSchema, EntitySchema, ChunkSchema };
}
let built: ReturnType<typeof build> | null = null;
export const schemas = () => (built ??= build());
export const ChunkSchema = { safeParse: (v: unknown) => schemas().ChunkSchema.safeParse(v) };
export type ChunkInput = z.infer<ReturnType<typeof schemas>['ChunkSchema']>;
