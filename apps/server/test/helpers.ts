import { createClient, newRunId, type NetClient } from '@odi/net';
import type { Evt, EvtMap, ProgressSubmit } from '@odi/shared';
import { startServer, type OdiServer, type ServerOptions } from '../src/server';

/** Çarşamba 14 Ekim 2026 12:00 (İstanbul) — 2026-W42 içinde, baskın penceresi dışında */
export const T0 = Date.UTC(2026, 9, 14, 9, 0, 0);

export class Clock {
  constructor(public t = T0) {}
  now = () => this.t;
  advance(ms: number) { this.t += ms; }
}

const ALL_EVENTS: Evt[] = ['presence', 'chat', 'friend.updated', 'team.updated', 'team.help', 'war.updated', 'raid.updated', 'race.updated', 'race.pos', 'race.invited',
  'inbox.new', 'kicked', 'wallet.updated', 'camp.updated', 'camp.helped', 'team.extra.updated', 'team.gift', 'team.campHelpNeeded',
  // arkadaşlık + özel mesaj
  'friend.request', 'friend.accepted', 'friend.removed', 'friend.gift', 'dm.message', 'dm.read', 'dm.typing', 'dm.reaction', 'dm.unread',
  // iletişim
  'chat.updated', 'comm.notice', 'duo.updated', 'mentor.updated', 'events.notice',
  // takım rekabeti
  'trace.updated', 'trace.matched', 'trace.result', 'trace.reaction', 'trace.challenged'];

export interface TC extends NetClient {
  token: string;
  /** olay gelene kadar bekle (önceden gelmiş ve tüketilmemiş olayları da sayar) */
  waitFor<E extends Evt>(ev: E, pred?: (d: EvtMap[E]) => boolean, ms?: number): Promise<EvtMap[E]>;
  /** şu ana kadar gelen (tüketilmemiş) olayları at */
  drain(): void;
  log: { ev: Evt; data: unknown; used: boolean }[];
}

export function wrap(c: NetClient, tokenRef: { token: string }): TC {
  const log: TC['log'] = [];
  const waiters = new Set<() => void>();
  for (const ev of ALL_EVENTS) c.on(ev, (data) => { log.push({ ev, data, used: false }); for (const w of [...waiters]) w(); });
  const tc = c as TC;
  Object.defineProperty(tc, 'token', { get: () => tokenRef.token });
  tc.log = log;
  tc.drain = () => { for (const e of log) e.used = true; };
  tc.waitFor = (ev, pred = () => true, ms = 3000) => new Promise((resolve, reject) => {
    const check = () => {
      const hit = log.find((e) => !e.used && e.ev === ev && pred(e.data as never));
      if (hit) { hit.used = true; waiters.delete(check); clearTimeout(timer); resolve(hit.data as never); return true; }
      return false;
    };
    const timer = setTimeout(() => { waiters.delete(check); reject(new Error(`olay gelmedi: ${ev}`)); }, ms);
    if (!check()) waiters.add(check);
  });
  return tc;
}

export function waitStatus(c: NetClient, s: NetClient['status'], ms = 5000): Promise<void> {
  if (c.status === s) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { off(); reject(new Error(`durum gelmedi: ${s} (şu an ${c.status})`)); }, ms);
    const off = c.onStatus((x) => { if (x === s) { clearTimeout(timer); off(); resolve(); } });
  });
}

export interface Env {
  srv: OdiServer;
  clock: Clock;
  clients: TC[];
  connect(name?: string, token?: string): Promise<TC>;
  close(): Promise<void>;
}

export async function setup(opts: ServerOptions = {}): Promise<Env> {
  const clock = new Clock();
  const srv = await startServer({ port: 0, host: '127.0.0.1', dbFile: ':memory:', now: clock.now, testStore: true, msgPerSec: 1000, sweepMs: 60_000,
    // güvenli sohbet (8 bölüm) kendi testlerinde (comm.test.ts) sınanır; diğer testler yeni oyuncuyla serbest yazar
    freeTextCleared: 0, ...opts });
  const clients: TC[] = [];
  return {
    srv, clock, clients,
    async connect(name, token = '') {
      const ref = { token };
      let queue: ProgressSubmit[] = [];
      const c = wrap(createClient({
        url: srv.url, name, getToken: () => ref.token, saveToken: (t) => { ref.token = t; },
        getQueue: () => queue, saveQueue: (q) => { queue = q; }, maxBackoffMs: 300,
      }), ref);
      clients.push(c);
      c.connect();
      await waitStatus(c, 'bağlı');
      return c;
    },
    async close() {
      for (const c of clients) c.close();
      await srv.close();
    },
  };
}

/** geçerli bir bölüm sonucu */
export const run = (level: number, over: Partial<ProgressSubmit> = {}): ProgressSubmit => ({
  runId: newRunId(), level, completed: true, stars: 3, score: 1000, timeSec: 60, coins: 100, biome: 'dis-kulak', mechanic: 'kosu', ...over,
});

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
