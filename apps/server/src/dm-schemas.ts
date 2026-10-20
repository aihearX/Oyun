import { z } from 'zod';
import type { Op } from '@odi/shared';

/** Arkadaşlık + özel mesaj işlemlerinin giriş şemaları (schemas.ts'teki SCHEMAS'a yayılır). */
const id = z.string().min(1).max(40).regex(/^[A-Za-z0-9]+$/);
const empty = z.object({});
const metaVal = z.union([z.string().max(60), z.number().finite(), z.boolean()]);

type FriendOp =
  | 'friends.request' | 'friends.respond' | 'friends.requests' | 'friends.cancel' | 'friends.suggest' | 'friends.gift'
  | 'players.search' | 'players.block' | 'players.unblock' | 'players.blocked' | 'players.report' | 'profile.card'
  | 'dm.threads' | 'dm.open' | 'dm.send' | 'dm.read' | 'dm.react' | 'dm.delete' | 'dm.report';

export const FRIEND_SCHEMAS: Record<FriendOp & Op, z.ZodType> = {
  'friends.request': z.object({ code: z.string().min(4).max(12).optional(), name: z.string().min(1).max(40).optional(), id: id.optional() }),
  'friends.respond': z.object({ requestId: id, accept: z.boolean() }),
  'friends.requests': empty,
  'friends.cancel': z.object({ requestId: id }),
  'friends.suggest': empty,
  'friends.gift': z.object({ id }),
  'players.search': z.object({ query: z.string().max(40), page: z.number().int().min(0).max(50).optional() }),
  'players.block': z.object({ id }),
  'players.unblock': z.object({ id }),
  'players.blocked': empty,
  'players.report': z.object({ id, reason: z.enum(['isim', 'taciz', 'diger']) }),
  'profile.card': z.object({ id }),
  'dm.threads': empty,
  'dm.open': z.object({ id, before: z.number().int().min(1).optional() }),
  'dm.send': z.object({
    to: id, text: z.string().min(1).max(2000), kind: z.enum(['text', 'emoji', 'sticker', 'davet', 'hazir']).optional(),
    meta: z.record(z.string().max(20), metaVal).refine((m) => Object.keys(m).length <= 8).optional(),
  }),
  'dm.read': z.object({ id, upTo: z.number().int().min(0).optional() }),
  'dm.react': z.object({ msgId: id, emoji: z.string().max(16) }),
  'dm.delete': z.object({ msgId: id }),
  'dm.report': z.object({ msgId: id }),
};
