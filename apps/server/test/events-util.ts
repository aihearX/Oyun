import type { Evt, EvtMap } from '@odi/shared';
import type { NetError } from '@odi/net';
import type { Env, TC } from './helpers';

/** etkinlik olayları (helpers.ts'teki genel kaydın dışında) */
const EVENT_EVTS: Evt[] = ['events.notice', 'rally.updated', 'duel.updated', 'relay.updated', 'hunt.updated', 'quiz.updated', 'tquests.updated', 'team.gift', 'inbox.new', 'chat'];

export interface EC { c: TC; seen: { ev: Evt; data: unknown; used: boolean }[]; wait<E extends Evt>(ev: E, pred?: (d: EvtMap[E]) => boolean, ms?: number): Promise<EvtMap[E]>; drain(): void }

export function watch(c: TC): EC {
  const seen: EC['seen'] = [];
  const waiters = new Set<() => void>();
  for (const ev of EVENT_EVTS) c.on(ev, (data) => { seen.push({ ev, data, used: false }); for (const w of [...waiters]) w(); });
  return {
    c, seen,
    drain: () => { for (const e of seen) e.used = true; },
    wait: (ev, pred = () => true, ms = 3000) => new Promise((resolve, reject) => {
      const check = () => {
        const hit = seen.find((e) => !e.used && e.ev === ev && pred(e.data as never));
        if (hit) { hit.used = true; waiters.delete(check); clearTimeout(timer); resolve(hit.data as never); return true; }
        return false;
      };
      const timer = setTimeout(() => { waiters.delete(check); reject(new Error(`olay gelmedi: ${ev}`)); }, ms);
      if (!check()) waiters.add(check);
    }),
  };
}

export async function connectW(env: Env, name: string): Promise<EC> { return watch(await env.connect(name)); }

export const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };

let seq = 0;
export const erun = (over: Partial<{ completed: boolean; stars: number; score: number; timeSec: number }> = {}) => ({ runId: `ev-${Date.now().toString(36)}-${++seq}`, completed: true, stars: 2, score: 1500, timeSec: 30, ...over });

/** iki kişilik takım */
export async function team2(env: Env, names: [string, string], teamName: string): Promise<[EC, EC, string]> {
  const a = await connectW(env, names[0]); const b = await connectW(env, names[1]);
  const t = (await a.c.call('team.create', { name: teamName, emblem: '🦉' })).team;
  await b.c.call('team.join', { teamId: t.id });
  return [a, b, t.id];
}
