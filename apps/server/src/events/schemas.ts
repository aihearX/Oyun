import { z } from 'zod';
import { RALLY_MONSTERS, type Op } from '@odi/shared';
import { MAX_SCORE, MIN_TIME_SEC } from '../progress';

const id = z.string().min(1).max(40).regex(/^[A-Za-z0-9]+$/);
const empty = z.object({});
/** etkinlik koşusu: progress.submit ile aynı makullük sınırları */
const run = {
  runId: z.string().min(1).max(64).regex(/^[A-Za-z0-9_.:-]+$/), completed: z.boolean(), stars: z.number().int().min(0).max(3),
  score: z.number().min(0).max(MAX_SCORE), timeSec: z.number().min(MIN_TIME_SEC).max(3600),
};

export const EVENT_SCHEMAS = {
  'events.overview': empty,
  'rally.state': empty,
  'rally.start': z.object({ monster: z.enum(RALLY_MONSTERS.map((m) => m.id) as [string, ...string[]]) }),
  'rally.join': z.object({ rallyId: id }),
  'rally.hit': z.object({ rallyId: id, ...run }),
  'duel.state': empty,
  'relay.state': empty,
  'relay.take': empty,
  'relay.pass': z.object({ to: id }),
  'relay.submit': z.object({ leg: z.number().int().min(0).max(3), ...run }),
  'hunt.state': empty,
  'quiz.state': empty,
  'quiz.start': empty,
  'quiz.join': z.object({ quizId: id }),
  'quiz.go': z.object({ quizId: id }),
  'quiz.answer': z.object({ quizId: id, index: z.number().int().min(0).max(19), choice: z.number().int().min(0).max(3) }),
  'tquests.state': empty,
  'challenge.state': empty,
  'challenge.submit': z.object(run),
  'tourney.state': empty,
  'tourney.submit': z.object({ slot: z.number().int().min(0).max(4), ...run }),
} satisfies Partial<Record<Op, z.ZodType>>;
