import { z } from 'zod';
import { CHAT_REACTIONS, type Op } from '@odi/shared';

/** İletişim işlemlerinin giriş şemaları (schemas.ts'teki SCHEMAS'a yayılır). */
const id = z.string().min(1).max(40).regex(/^[A-Za-z0-9]+$/);
const empty = z.object({});
const phrase = z.string().min(1).max(24).regex(/^[a-z0-9-]+$/);

export const COMM_SCHEMAS = {
  'chat.react': z.object({ msgId: id, reaction: z.union([z.enum(CHAT_REACTIONS), z.literal('')]) }),
  'chat.thread': z.object({ msgId: id }),
  'comm.state': empty,
  'comm.settings': z.object({ feedShare: z.boolean().optional() }),
  'feed.challenge': z.object({ level: z.number().int().min(1).max(40) }),
  'help.tip': z.object({ requestId: id, phrase: phrase.optional(), text: z.string().min(1).max(800).optional() }),
  'help.race': z.object({ requestId: id }),
  'dq.state': empty,
  'dq.answer': z.object({ choice: z.number().int().min(0).max(3) }),
  'team.study': z.object({ on: z.boolean() }),
  'duo.state': empty,
  'duo.invite': z.object({ friendId: id }),
  'duo.respond': z.object({ inviteId: id, accept: z.boolean() }),
  'mentor.state': empty,
  'mentor.offer': z.object({ id, as: z.enum(['usta', 'cirak']) }),
  'mentor.respond': z.object({ offerId: id, accept: z.boolean() }),
  'mentor.end': z.object({ linkId: id }),
} satisfies Partial<Record<Op, z.ZodType>>;
