import { z } from 'zod';
import { BUILDINGS, CAMP_CHEERS, RANK_BOARDS, SOCIAL_LIMITS, TEAM_APPLY_RULES, TEAM_RACE_REACTIONS, TEAM_TECH, WAR_REGIONS, type Op } from '@odi/shared';
import { MAX_COINS, MAX_LEVEL, MAX_SCORE, MIN_TIME_SEC } from './progress';
import { SPEND_LIMIT_MAX_TRY } from './shop';
import { EVENT_SCHEMAS } from './events/schemas';
import { FRIEND_SCHEMAS } from './dm-schemas';
import { COMM_SCHEMAS } from './comm/schemas';
import { KG_SCHEMAS } from './camp-quests-schemas';

const id = z.string().min(1).max(40).regex(/^[A-Za-z0-9]+$/);
const empty = z.object({});
const BIOMES = WAR_REGIONS.find((r) => r.id === 'merkez')!.biomes as [string, ...string[]];
const MECHANICS = ['kosu', 'yuzme', 'trambolin', 'makine', 'impuls', 'ruya', 'boss'] as const;
const building = z.enum(BUILDINGS.map((b) => b.id) as [string, ...string[]]);
const level = z.number().int().min(1).max(MAX_LEVEL);
const room = z.string().min(1).max(80);
const remedyId = z.string().min(1).max(40).regex(/^[a-z0-9-]+$/);

/** her op için giriş şeması; bilinmeyen alanlar atılır */
export const SCHEMAS: Record<Op, z.ZodType> = {
  ...FRIEND_SCHEMAS,
  ...KG_SCHEMAS,
  'hello': z.object({ token: z.string().max(200).optional(), name: z.string().max(40).optional(), version: z.number().int(), campV: z.number().int().min(0).max(1000).optional() }),
  'profile.update': z.object({ name: z.string().max(40).optional(), color: z.number().int().min(0).max(0xffffff).optional(), hat: z.string().max(32).regex(/^[a-z0-9-]*$/).optional() }),
  'profile.get': z.object({ id }),
  'progress.submit': z.object({
    runId: z.string().min(1).max(64).regex(/^[A-Za-z0-9_.:-]+$/), level, completed: z.boolean(), stars: z.number().int().min(0).max(3), score: z.number().min(0).max(MAX_SCORE),
    timeSec: z.number().min(MIN_TIME_SEC).max(3600), coins: z.number().int().min(0).max(MAX_COINS),
    biome: z.enum(BIOMES), mechanic: z.enum(MECHANICS), raceId: id.optional(), cochleas: z.number().int().min(0).max(3).optional(),
    remediesUsed: z.array(z.object({ id: remedyId, count: z.number().int().min(1).max(9) })).max(12).optional(),
  }),
  'friends.list': empty,
  'friends.add': z.object({ code: z.string().min(4).max(12) }),
  'friends.remove': z.object({ id }),
  'chat.join': z.object({ room }),
  'chat.leave': z.object({ room }),
  'chat.send': z.object({ room, text: z.string().min(1).max(SOCIAL_LIMITS.chatMax * 4), kind: z.enum(['text', 'emoji', 'hazir']).optional(), replyTo: id.optional() }),
  'chat.report': z.object({ msgId: id }),
  'chat.mute': z.object({ id, on: z.boolean() }),
  'team.list': z.object({ query: z.string().max(40).optional(), filter: z.enum(['hepsi', 'acik', 'basvuru', 'uygun']).optional(), offset: z.number().int().min(0).max(100_000).optional(), limit: z.number().int().min(1).max(TEAM_APPLY_RULES.pageMax).optional() }),
  'team.profile': z.object({ teamId: id }),
  'team.apply': z.object({ teamId: id, noteId: z.string().max(20).regex(/^[a-z0-9-]+$/).optional(), note: z.string().max(TEAM_APPLY_RULES.noteMax * 4).optional() }),
  'team.apply.cancel': z.object({ applicationId: id }),
  'team.apply.mine': z.object({ seen: z.boolean().optional() }),
  'team.applications': empty,
  'team.apply.decide': z.object({ applicationId: id, accept: z.boolean(), reason: z.string().max(20).regex(/^[a-z0-9-]*$/).optional() }),
  'team.settings': z.object({ joinMode: z.enum(['acik', 'basvuru']).optional(), minLevel: level.optional() }),
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
  'camp.remedy.make': z.object({ item: remedyId.nullable() }),
  'camp.remedy.collect': empty,
  // kamp büyümesi (docs/14-kamp.md §8–12)
  'camp.decor.place': z.object({ id: z.string().regex(/^[a-z0-9-]{1,40}$/), gx: z.number().int().min(-200).max(200), gy: z.number().int().min(-200).max(200), flip: z.boolean().optional() }),
  'camp.decor.move': z.object({ uid: z.number().int().min(1), gx: z.number().int().min(-200).max(200), gy: z.number().int().min(-200).max(200), flip: z.boolean().optional() }),
  'camp.decor.store': z.object({ uid: z.number().int().min(1) }),
  'camp.lib.collect': empty,
  'camp.visit': z.object({ playerId: id }),
  'camp.cheer': z.object({ playerId: id, kind: z.enum(CAMP_CHEERS.map((c) => c.id) as [string, ...string[]]) }),
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
  ...EVENT_SCHEMAS,
  ...COMM_SCHEMAS,
  'rank.board': z.object({ board: z.enum(RANK_BOARDS.map((b) => b.id) as [string, ...string[]]), scope: z.enum(['herkes', 'arkadas', 'yakin']) }),
  // takım rekabeti (docs/16-takim-rekabeti.md)
  'trace.state': empty, 'trace.join': empty, 'trace.leave': empty, 'trace.close': empty, 'tlig.state': empty,
  'trace.open': z.object({ size: z.union([z.literal(3), z.literal(5)]) }),
  'trace.ready': z.object({ ready: z.boolean() }),
  'trace.search': z.object({ on: z.boolean() }),
  'trace.challenge': z.object({ teamId: id }), 'trace.accept': z.object({ teamId: id }), 'trace.decline': z.object({ teamId: id }),
  'trace.rematch': z.object({ matchId: id }), 'trace.result': z.object({ matchId: id }),
  'trace.react': z.object({ emoji: z.enum(TEAM_RACE_REACTIONS as unknown as [string, ...string[]]) }),
  // kodlar
  'code.redeem': z.object({ code: z.string().min(1).max(64) }),
  'admin.state': empty, 'admin.set': z.object({ on: z.boolean() }), 'code.list': empty,
  'code.create': z.object({
    code: z.string().min(3).max(64), note: z.string().max(60).optional(),
    rewards: z.object({ jeton: z.number().int().min(0).max(100_000).optional(), kristal: z.number().int().min(0).max(10_000).optional(), kalkan: z.number().int().min(0).max(50).optional(),
      kozmetik: z.array(z.string().max(40)).max(10).optional(), hizlandirici: z.object({ m5: z.number().int().min(0).max(100).optional(), m60: z.number().int().min(0).max(100).optional(), s8: z.number().int().min(0).max(100).optional() }).optional() }),
    maxUses: z.number().int().min(1).max(10_000_000).nullable().optional(), startsAt: z.number().int().nullable().optional(), endsAt: z.number().int().nullable().optional(),
  }),
  'code.close': z.object({ code: z.string().min(1).max(64), active: z.boolean().optional() }),
};

export const firePosSchema = z.object({ x: z.number(), y: z.number(), pct: z.number() });

/** zod hatasını kısa Türkçe mesaja çevir */
export function schemaError(err: z.ZodError): string {
  const i = err.issues[0];
  const where = i?.path.length ? ` (${i.path.join('.')})` : '';
  return `Geçersiz istek verisi${where}.`;
}
