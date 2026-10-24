import http from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { COMM_RULES, SOCIAL_LIMITS, type Op } from '@odi/shared';
import { App, OdiError, sendJson, type Conn, type Handler, type Handlers, type ServerConfig } from './app';
import { campHandlers, completeDue } from './camp';
import { campGrowthHandlers } from './camp-buyume';
import { chatHandlers, pruneChat } from './chat';
import { friendHandlers } from './friends';
import { dmHandlers, dmTyping } from './dm';
import { leagueHandlers, leagueRollover } from './league';
import { announcePresence, playerHandlers } from './players';
import { progressHandlers, pruneRuns } from './progress';
import { raceHandlers, racePos, raceShutdown, sweepRaces } from './race';
import { raidHandlers } from './raid';
import { firePosSchema, schemaError, SCHEMAS } from './schemas';
import { shopHandlers } from './shop';
import { extraHandlers } from './teamextra';
import { teamHandlers } from './teams';
import { expireApplications, installTeamApply, teamApplyHandlers } from './teamapply';
import { walletHandlers } from './wallet';
import { warHandlers, warRollover } from './war';
import { eventHandlers, eventsShutdown, eventsSweep, withEventHooks } from './events';
import { commHandlers, commSweep, installComm, metricsReport, withCommHooks } from './comm';
import { installRank, rankDayTick, rankHandlers } from './rank';
import { codeHandlers } from './codes';
import { backupNow } from './backup';
import { accountHandlers } from './account';
import { teamRaceDisconnect, teamRaceHandlers, teamRaceShutdown, teamRaceSweep, withTeamRaceHooks } from './teamrace';
import { kgHandlers, withKgHooks } from './camp-quests';
import { vakaHandlers } from './camp-quests-vaka';
import { oyunHandlers } from './camp-quests-oyun';

export const SERVER_VERSION = '0.1.0';
export const MAX_MESSAGE_BYTES = 8 * 1024;
/** geçersiz özet biçimi: hiçbir kod yönetici yapmaz (üretimde ODI_ADMIN_CODE_HASH verilmediyse) */
export const ADMIN_DISABLED = 'kapali';

/**
 * İstemci IP'si. trustProxy = sunucunun önündeki güvenilir vekil sayısı (ODI_TRUST_PROXY; Render gibi tek vekil: 1).
 * X-Forwarded-For'un soldaki girdileri istemcinin kendisi yazabilir; yalnızca güvenilir vekillerin sağdan eklediği girdi kullanılır.
 * 0 (varsayılan): başlık yok sayılır, soket adresi kullanılır (doğrudan açık sunucu; başlık sahte olabilir).
 */
export function clientIp(xff: string | string[] | undefined, socketAddr: string | undefined, trustProxy: number): string {
  const raw = Array.isArray(xff) ? xff.join(',') : (xff ?? '');
  if (trustProxy > 0 && raw) {
    const hops = raw.split(',').map((x) => x.trim()).filter(Boolean);
    const ip = hops[hops.length - trustProxy] ?? hops[0];
    if (ip) return ip;
  }
  return socketAddr ?? '';
}

const HANDLERS: Handlers = withKgHooks(withTeamRaceHooks(withCommHooks(withEventHooks({
  ...dmHandlers,
  ...playerHandlers, ...friendHandlers, ...chatHandlers, ...teamHandlers, ...teamApplyHandlers, ...extraHandlers, ...campHandlers, ...campGrowthHandlers,
  ...warHandlers, ...raidHandlers, ...raceHandlers, ...leagueHandlers, ...shopHandlers, ...progressHandlers, ...walletHandlers,
  ...eventHandlers, ...commHandlers, ...rankHandlers, ...teamRaceHandlers, ...codeHandlers,
  ...kgHandlers, ...vakaHandlers, ...oyunHandlers, ...accountHandlers,
}))));
/** kendi işlemlerini kendisi yöneten (async) işlemler */
const ASYNC_OPS = new Set<Op>(['shop.purchase']);

for (const op of Object.keys(SCHEMAS) as Op[]) if (!HANDLERS[op]) throw new Error(`İşleyici eksik: ${op}`);

export type ServerOptions = Partial<ServerConfig>;

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): ServerOptions {
  const o: ServerOptions = {};
  if (env.PORT) o.port = Number(env.PORT);
  if (env.HOST) o.host = env.HOST;
  if (env.ODI_DB) o.dbFile = env.ODI_DB;
  if (env.ODI_RAID_ALWAYS) o.raidAlways = env.ODI_RAID_ALWAYS === '1';
  o.testStore = env.ODI_TEST_STORE === '1' || env.NODE_ENV !== 'production';
  o.revenueCatKey = env.REVENUECAT_API_KEY || null;
  if (env.ODI_EVENTS_FAST) o.eventsFast = env.ODI_EVENTS_FAST === '1';
  if (env.ODI_FREE_TEXT_AT && /^\d+$/.test(env.ODI_FREE_TEXT_AT)) o.freeTextCleared = Number(env.ODI_FREE_TEXT_AT);
  if (env.ODI_ADMIN_CODE_HASH) o.adminCodeHash = env.ODI_ADMIN_CODE_HASH;
  // üretimde depodaki (herkese açık) varsayılan özet kullanılmaz: yönetici kodu yalnızca ODI_ADMIN_CODE_HASH ile açılır
  else if (env.NODE_ENV === 'production') o.adminCodeHash = ADMIN_DISABLED;
  if (env.ODI_TRUST_PROXY && /^\d+$/.test(env.ODI_TRUST_PROXY)) o.trustProxy = Number(env.ODI_TRUST_PROXY);
  if (env.ODI_NEW_PER_IP_HOUR && /^\d+$/.test(env.ODI_NEW_PER_IP_HOUR)) o.newAccountsPerIpHour = Number(env.ODI_NEW_PER_IP_HOUR);
  if (env.ODI_BACKUP_DIR) o.backupDir = env.ODI_BACKUP_DIR;
  if (env.ODI_BACKUP_HOURS && Number(env.ODI_BACKUP_HOURS) > 0) o.backupHours = Number(env.ODI_BACKUP_HOURS);
  if (env.ODI_BACKUP_KEEP && /^\d+$/.test(env.ODI_BACKUP_KEEP)) o.backupKeep = Number(env.ODI_BACKUP_KEEP);
  return o;
}

export interface OdiServer {
  app: App;
  port: number;
  /** ws://127.0.0.1:port */
  url: string;
  httpUrl: string;
  /** zamanlayıcı işlerini hemen çalıştır (testler için) */
  sweep(): void;
  close(): Promise<void>;
}

export async function startServer(opts: ServerOptions = {}): Promise<OdiServer> {
  const cfg: ServerConfig = {
    port: 8787, host: '0.0.0.0', dbFile: ':memory:', now: () => Date.now(), raidAlways: false, testStore: false, revenueCatKey: null,
    raceCountdownMs: SOCIAL_LIMITS.raceCountdownMs, raceFinishGraceMs: 60_000, sweepMs: 5_000, pingMs: 25_000, msgPerSec: 30, log: false, version: SERVER_VERSION, eventsFast: false, eventsEpoch: 0, freeTextCleared: COMM_RULES.freeTextLevel,
    ...Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined)),
  };
  if (!cfg.eventsEpoch) cfg.eventsEpoch = cfg.now();
  const app = new App(cfg);
  app.weekHooks.push((oldWeek) => warRollover(app, oldWeek), (oldWeek) => leagueRollover(app, oldWeek));
  installComm(app);
  installRank(app);
  installTeamApply(app);
  const log = (...a: unknown[]) => { if (cfg.log) console.log(new Date().toISOString(), ...a); };

  const httpServer = http.createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0];
    if (req.method === 'GET' && url === '/saglik') {
      const players = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM players')!.n;
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, version: cfg.version, players, online: app.online.size }));
      return;
    }
    if (req.method === 'GET' && url === '/olcum') {
      // iletişim ölçümü: yalnızca günlük toplam sayaçlar (kişisel veri yok), son 7 gün
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, days: metricsReport(app, 7) }));
      return;
    }
    if (req.method === 'GET' && url === '/') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('ODİ: Sesin Yolu sosyal sunucusu çalışıyor.\nOyun bu adrese WebSocket ile bağlanır (ws:// ya da wss://).\nSağlık kontrolü: /saglik\n');
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Bulunamadı.\n');
  });

  const wss = new WebSocketServer({ server: httpServer, maxPayload: MAX_MESSAGE_BYTES });
  let nextConnId = 1;
  const conns = new Set<Conn>();

  const reply = (c: Conn, id: number, r: { ok: true; data: unknown } | { ok: false; code: string; error: string }) =>
    sendJson(c, r.ok ? { t: 'res', id, ok: true, data: r.data } : { t: 'res', id, ok: false, code: r.code, error: r.error });

  /** bağlantı başına mesaj hız sınırı (jeton kovası; gerçek saat) */
  const allow = (c: Conn): boolean => {
    const t = Date.now();
    c.tokens = Math.min(cfg.msgPerSec, c.tokens + ((t - c.refillAt) / 1000) * cfg.msgPerSec);
    c.refillAt = t;
    if (c.tokens < 1) return false;
    c.tokens -= 1;
    return true;
  };

  async function onMessage(c: Conn, raw: string): Promise<void> {
    let msg: { t?: unknown; id?: unknown; op?: unknown; data?: unknown };
    try { msg = JSON.parse(raw); } catch { reply(c, 0, { ok: false, code: 'GECERSIZ', error: 'Geçersiz JSON.' }); return; }
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'fire') {
      if (!allow(c)) return;
      if (msg.op === 'race.pos') {
        const d = firePosSchema.safeParse(msg.data);
        if (d.success) racePos(app, c, d.data);
      } else if (msg.op === 'dm.typing') dmTyping(app, c, msg.data);
      return;
    }
    const id = typeof msg.id === 'number' ? msg.id : 0;
    if (msg.t !== 'req' || typeof msg.op !== 'string') { reply(c, id, { ok: false, code: 'GECERSIZ', error: 'Geçersiz mesaj biçimi.' }); return; }
    if (!allow(c)) { reply(c, id, { ok: false, code: 'HIZ', error: 'Çok hızlı istek gönderiyorsun; biraz yavaşla.' }); return; }
    const op = msg.op as Op;
    const handler = HANDLERS[op] as Handler<Op> | undefined;
    const schema = SCHEMAS[op];
    if (!handler || !schema) { reply(c, id, { ok: false, code: 'BILINMEYEN', error: 'Bilinmeyen işlem.' }); return; }
    if (op !== 'hello' && !c.pid) { reply(c, id, { ok: false, code: 'OTURUM', error: 'Önce oturum açmalısın.' }); return; }
    const parsed = schema.safeParse(msg.data ?? {});
    if (!parsed.success) { reply(c, id, { ok: false, code: 'GECERSIZ', error: schemaError(parsed.error) }); return; }
    const session = { conn: c, pid: c.pid ?? '' };
    try {
      const data = ASYNC_OPS.has(op)
        ? await handler(app, session, parsed.data as never)
        : app.run(() => handler(app, session, parsed.data as never));
      reply(c, id, { ok: true, data });
    } catch (e) {
      if (e instanceof OdiError) reply(c, id, { ok: false, code: e.code, error: e.message });
      else { console.error('[sunucu hatası]', op, e); reply(c, id, { ok: false, code: 'SUNUCU', error: 'Sunucuda beklenmeyen bir hata oluştu.' }); }
    }
  }

  function onClose(c: Conn): void {
    conns.delete(c);
    const pid = c.pid;
    if (!pid || app.online.get(pid) !== c) return;
    try {
      app.run(() => {
        app.online.delete(pid);
        for (const r of [...c.rooms]) app.unsubscribe(pid, r);
        app.db.run('UPDATE players SET last_seen = ? WHERE id = ?', app.now(), pid);
        announcePresence(app, pid, false);
        teamRaceDisconnect(app, pid); // takım yarışında kısa bekleme; diğer yarışlarda hemen çıkış
        for (const h of app.disconnectHooks) h(pid);
      });
    } catch (e) { console.error('[bağlantı kapanışı]', e); }
    log('ayrıldı', pid);
  }

  wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    const ip = clientIp(req.headers['x-forwarded-for'], req.socket.remoteAddress, cfg.trustProxy ?? 0);
    const c: Conn = { id: nextConnId++, ws, pid: null, rooms: new Set(), tokens: cfg.msgPerSec, refillAt: Date.now(), alive: true, lastPosAt: 0, ip };
    conns.add(c);
    ws.on('pong', () => { c.alive = true; });
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      const raw = Array.isArray(data) ? Buffer.concat(data).toString('utf8') : data.toString();
      void onMessage(c, raw);
    });
    ws.on('close', () => onClose(c));
    ws.on('error', () => { /* kapanış olayı ayrıca gelir */ });
  });

  const pinger = setInterval(() => {
    for (const c of conns) {
      if (!c.alive) { c.ws.terminate(); continue; }
      c.alive = false;
      try { c.ws.ping(); } catch {}
    }
  }, cfg.pingMs);
  let lastPrune = 0;
  const sweep = () => {
    try {
      app.run(() => {
        completeDue(app);
        eventsSweep(app);
        commSweep(app);
        rankDayTick(app);
        expireApplications(app);
        if (Date.now() - lastPrune > 3_600_000) { lastPrune = Date.now(); pruneChat(app); pruneRuns(app); }
      });
      sweepRaces(app);
      teamRaceSweep(app);
    } catch (e) { console.error('[zamanlayıcı]', e); }
  };
  const sweeper = setInterval(sweep, cfg.sweepMs);
  // veritabanı yedeği: açılışta bir kez, sonra her backupHours saatte
  const backup = () => {
    if (!cfg.backupDir || cfg.dbFile === ':memory:') return;
    try { const f = backupNow(app, cfg.backupDir, cfg.backupKeep ?? 28); log('yedek alındı', f); } catch (e) { console.error('[yedek]', e); }
  };
  backup();
  const backuper = cfg.backupDir ? setInterval(backup, (cfg.backupHours ?? 6) * 3_600_000) : null;

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(cfg.port, cfg.host, () => { httpServer.off('error', reject); resolve(); });
  });
  const addr = httpServer.address();
  const port = typeof addr === 'object' && addr ? addr.port : cfg.port;
  log(`ODİ sunucusu dinliyor: ${cfg.host}:${port}`);

  return {
    app, port, url: `ws://127.0.0.1:${port}`, httpUrl: `http://127.0.0.1:${port}`, sweep,
    close: async () => {
      clearInterval(pinger); clearInterval(sweeper); if (backuper) clearInterval(backuper);
      raceShutdown(app);
      teamRaceShutdown(app);
      eventsShutdown(app);
      for (const c of conns) { c.pid = null; c.ws.terminate(); }
      await new Promise<void>((r) => wss.close(() => r()));
      await new Promise<void>((r) => httpServer.close(() => r()));
      app.close();
    },
  };
}
