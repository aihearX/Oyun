import { z } from 'zod';
import type { Op } from '@odi/shared';

/** Kamp Görevleri işlemlerinin giriş şemaları (schemas.ts'teki SCHEMAS'a yayılır). */
const id = z.string().min(1).max(40).regex(/^[A-Za-z0-9]+$/);
const slug = z.string().min(1).max(40).regex(/^[a-z0-9-]+$/);
const empty = z.object({});
const duzey = z.enum(['genel', 'odyoloji']);

export const KG_SCHEMAS = {
  'kg.state': empty,
  'kg.claim': z.object({ ref: z.string().min(3).max(80).regex(/^[a-z]+:[A-Za-z0-9:-]+$/) }),
  'kg.reroll': z.object({ id: slug }),
  'vaka.state': empty,
  'vaka.answer': z.object({ caseId: slug, attempt: z.string().min(4).max(64).regex(/^[A-Za-z0-9_.:-]+$/), tests: z.array(slug).min(1).max(8), dx: slug, mg: slug }),
  'vaka.konsult': z.object({ caseId: slug }),
  'vaka.oy': z.object({ msgId: id, choice: z.number().int().min(0).max(2) }),
  'koyun.start': z.object({ oyun: z.enum(['ton', 'timpano']), duzey }),
  'koyun.finish': z.object({ id, answers: z.array(z.number().int().min(0).max(3)).max(12) }),
} satisfies Partial<Record<Op, z.ZodType>>;
