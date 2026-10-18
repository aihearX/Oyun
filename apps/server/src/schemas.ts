import { z } from 'zod';
import { BUILDINGS, SOCIAL_LIMITS, TEAM_TECH, WAR_REGIONS, type Op } from '@odi/shared';
import { MAX_COINS, MAX_LEVEL, MAX_SCORE, MIN_TIME_SEC } from './progress';
import { SPEND_LIMIT_MAX_TRY } from './shop';

const id = z.string().min(1).max(40).regex(/^[A-Za-z0-9]+$/);
const empty = z.object({});
const BIOMES = WAR_REGIONS.find((r) => r.id === 'merkez')!.biomes as [string, ...string[]];
const MECHANICS = ['kosu', 'yuzme', 'trambolin', 'makine', 'impuls', 'ruya', 'boss'] as const;
const building = z.enum(BUILDINGS.map((b) => b.id) as [string, ...string[]]);
const level = z.number().int().min(1).max(MAX_LEVEL);
const room = z.string().min(1).max(80);

/** her op için giriş şeması; bilinmeyen alanlar atılır */
export const SCHEMAS: Record<Op, z.ZodType> = {
  'hello': z.object({ token: z.string().max(200).optional(), name: z.string().max(40).optional(), version: z.number().int() }),
  'profile.update': z.object({ name: z.string().max(40).optional(), color: z.number().int().min(0).max(0xffffff).optional(), hat: z.string().max(32).regex(/^[a-z0-9-]*$/).optional() }),
  'profile.get': z.object({ id }),
  'progress.submit': z.object({
    runId: z.string().min(1).max(64).regex(/^[A-Za-z0-9_.:-]+$/), level, completed: z.boolean(), stars: z.number().int().min(0).max(3), score: z.number().min(0).max(MAX_SCORE),
    timeSec: z.number().min(MIN_TIME_SEC).max(3600), coins: z.number().int().min(0).max(MAX_COINS),
    biome: z.enum(BIOMES), mechanic: z.enum(MECHANICS), raceId: id.optional(),
  }),
  'friends.list': empty,
  'friends.add': z.object({ code: z.string().min(4).max(12) }),
  'friends.remove': z.object({ id }),
  'chat.join': z.object({ room }),
  'chat.leave': z.object({ room }),
  'chat.send': z.object({ room, text: z.string().min(1).max(SOCIAL_LIMITS.chatMax * 4), kind: z.enum(['text', 'emoji']).optional() }),
  'chat.report': z.object({ msgId: id }),
  'chat.mute': z.object({ id, on: z.boolean() }),
  'team.list': z.object({ query: z.string().max(40).optional() }),
  'team.create': z.object({ name: z.string().max(60), emblem: z.string().min(1).max(16), description: z.string().max(140).optional(), open: z.boolean().optional(), minLevel: level.optional() }),
  'team.join': z.object({ teamId: id.optional(), code: z.string().max(12).optional() }),
  'team.leave': empty,
  'team.detail': z.object({ teamId: id.optional() }),
  'team.kick': z.object({ id }),
  'team.role': z.object({ id, role: z.enum(['lider', 'yardimci', 'uye']) }),
  'team.help.request': z.object({ level }),
  'team.help.give': z.object({ requestId: id }),
  'war.state': empty,
  'war.targets': z.object({ regions: z.array(z.string().max(20)).max(SOCIAL_LIMITS.targetsMax) }),
  'raid.state': empty,
  'race.create': z.object({ level: level.optional() }),
  'race.join': z.object({ roomId: id }),
  'race.quick': empty,
  'race.invite': z.object({ friendId: id }),
  'race.ready': z.object({ ready: z.boolean() }),
  'race.leave': empty,
  'race.finish': z.object({ completed: z.boolean(), score: z.number().min(0).max(MAX_SCORE), timeSec: z.number().min(0).max(3600) }),
  'league.state': empty,
  'inbox.list': empty,
  'inbox.claim': z.object({ id }),
  'wallet.get': empty,
  'camp.state': empty,
  'camp.upgrade': z.object({ id: building }),
  'camp.speedup': z.object({ id: building, item: z.enum(['m5', 'm60', 's8', 'kristal']), count: z.number().int().min(1).max(1000).optional() }),
  'camp.collect': empty,
  'camp.help.request': z.object({ id: building }),
  'team.camp.help': z.object({ playerId: id, building }),
  'team.camp.helpAll': empty,
  'team.extra': empty,
  'team.donate': z.object({ tech: z.enum(TEAM_TECH.map((t) => t.id) as [string, ...string[]]), jeton: z.number().int().min(1).max(1_000_000) }),
  'team.gift.claim': z.object({ giftId: id }),
  'team.goal.claim': z.object({ goalId: z.string().max(40), tier: z.number().int().min(0).max(10) }),
  'shop.list': empty,
  'shop.purchase': z.object({ productId: z.string().max(60), store: z.enum(['test', 'app-store', 'play']), receipt: z.string().max(4096).optional() }),
  'shop.limit': z.object({ limitTry: z.number().int().min(0).max(SPEND_LIMIT_MAX_TRY) }),
  'me.bonuses': empty,
  'wallet.local': z.object({ ledgerId: z.string().min(1).max(80).regex(/^[A-Za-z0-9_.:-]+$/), jeton: z.number().int().min(1).max(10_000), reason: z.string().min(1).max(60) }),
  'wallet.spend': z.object({ jeton: z.number().int().min(1).max(100_000), reason: z.string().min(1).max(60) }),
  'skills.list': empty,
  'progress.sync': z.object({ best: z.array(z.object({ level, stars: z.number().int().min(0).max(3), score: z.number().min(0).max(MAX_SCORE) })).max(MAX_LEVEL) }),
};

export const firePosSchema = z.object({ x: z.number(), y: z.number(), pct: z.number() });

/** zod hatasını kısa Türkçe mesaja çevir */
export function schemaError(err: z.ZodError): string {
  const i = err.issues[0];
  const where = i?.path.length ? ` (${i.path.join('.')})` : '';
  return `Geçersiz istek verisi${where}.`;
}
