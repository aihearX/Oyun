import { randomInt } from 'node:crypto';
import { DELETED_PLAYER_NAME, SOCIAL_LIMITS, type RacePlayer, type RaceRoom, type TeamRaceInfo, type TeamRaceSideId } from '@odi/shared';
import { fail, parseJson, rid, type App, type Conn, type Handlers } from './app';
import { areFriends } from './chat';
import { isBlocked } from './friends';

/**
 * Canlı yarış odaları bellekte yaşar. Başlamış yarışlar (geri sayım, yarış, bitti) ayrıca `race_room` tablosuna yazılır
 * (MK-031): sunucu yarış sürerken yeniden başlarsa (güncelleme, çökme) oda aynı durumla geri gelir; oyuncular bağlanınca
 * yarışı bitirir, derece ve lig puanı bir kez bağlanır. Lobi (başlamamış oda) yazılmaz: yeniden başlatmada kapanır.
 * Yalnızca gerçek oyuncular; bot ya da sahte rakip yok.
 */
interface Room extends RaceRoom { timers: ReturnType<typeof setTimeout>[]; linked: Set<string>; firstFinishAt: number | null; /** bitti anı (sunucu saati) */ endedAt?: number | null; /** takım yarışı: yarış bitince (bir kez) */ onEnd?: (room: RaceRoom) => void }
/** son biten yarışın rakipleri: rövanş daveti (arkadaş olmasalar da) ve aynı bölümde yeniden oda kurma için */
interface Recent { rivals: Set<string>; level: number; until: number }
interface RaceStore { rooms: Map<string, Room>; byPlayer: Map<string, string>; recent: Map<string, Recent> }

const LOBBY_TTL_MS = 30 * 60_000;
const DONE_TTL_MS = 10 * 60_000;
/** yarış en geç bu süre sonra (başlangıçtan itibaren) 'bitti' olur; bitiremeyenlerin derecesi yok */
export const RACE_MAX_MS = 3 * 60_000;
/** rövanş hakkı süresi */
const RECENT_TTL_MS = 30 * 60_000;
const POS_MIN_INTERVAL_MS = Math.floor(1000 / SOCIAL_LIMITS.racePosHz) - 10;
/**
 * Yarış sürerken bağlantısı kopan oyuncunun dönmesi için bekleme (sunucu yeniden başlayınca da herkes için). İstemci sunucu
 * döndükten sonra ≤ 15 sn'de bağlanır (MK-019); yeniden başlatmanın açılış süresi için pay.
 */
export const RACE_REJOIN_MS = 30_000;

const stores = new WeakMap<App, RaceStore>();
function store(app: App): RaceStore {
  let s = stores.get(app);
  if (!s) { s = { rooms: new Map(), byPlayer: new Map(), recent: new Map() }; stores.set(app, s); }
  return s;
}

const view = (r: Room): RaceRoom => ({ id: r.id, hostId: r.hostId, level: r.level, salt: r.salt, status: r.status, startsAt: r.startsAt, players: r.players.map((p) => ({ ...p })), max: r.max, createdAt: r.createdAt, ...(r.team ? { team: { ...r.team, a: { ...r.team.a }, b: { ...r.team.b } } } : {}) });
const active = (r: Room) => r.players.filter((p) => !p.left);

function broadcast(app: App, r: Room): void {
  save(app, r);
  const v = view(r);
  for (const p of active(r)) app.emit(p.id, 'race.updated', { room: v });
}

// ------------------------------------------------------------------ kalıcılık (MK-031)
/** yazılan biçim: odanın görünümü (players üst düzeyde; hesap silme oda kaydındaki adı account-veri.ts jsonOyuncular ile siler) + iç alanlar */
type Saved = RaceRoom & { linked: string[]; firstFinishAt: number | null; endedAt: number | null }
/** başlamış yarışı yaz (lobi yazılmaz; geri dönen oda siliniyorsa satır da silinir). Her yayında ve derece bağlanınca çağrılır. */
function save(app: App, r: Room): void {
  try {
    if (r.status === 'lobi' || store(app).rooms.get(r.id) !== r) { app.db.run('DELETE FROM race_room WHERE id = ?', r.id); return; }
    // yarış sürerken hesabını silen oyuncunun adı kayda (ve odaya) geri yazılmaz (hesap silme kaydı anonimleştirir: account-veri.ts)
    for (const p of r.players) if (p.name !== DELETED_PLAYER_NAME && app.playerOrNull(p.id)?.name === DELETED_PLAYER_NAME) { p.name = DELETED_PLAYER_NAME; p.hat = ''; }
    const d: Saved = { ...view(r), linked: [...r.linked], firstFinishAt: r.firstFinishAt, endedAt: r.endedAt ?? null };
    app.db.run('INSERT INTO race_room(id, data, at) VALUES(?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, at = excluded.at', r.id, JSON.stringify(d), app.now());
  } catch (e) { if (app.cfg.log) console.error('[yaris kayıt]', e); }
}

/**
 * Açılışta yazılı yarışları geri yükle: zamanlayıcılar sunucu saatine göre yeniden kurulur, süresi geçen geçişler hemen yapılır.
 * Kimse bağlı değil: her yarışçıya RACE_REJOIN_MS bekleme (dönmeyen "ayrıldı" sayılır, yarış sürer).
 */
export function restoreRaces(app: App, o: { /** takım yarışının sonucu (onEnd kapanışı yeniden başlatmada kaybolur; teamrace verir) */ teamEnd?: (app: App, room: RaceRoom) => void } = {}): number {
  const rejoinMs = app.cfg.raceRejoinMs ?? RACE_REJOIN_MS;
  const s = store(app); const now = app.now(); let n = 0;
  // süren yarışlar önce: oyuncu hem bitmiş hem süren bir odadaysa süren odaya bağlanır
  const order = { 'geri-sayim': 0, 'yarista': 0, 'lobi': 1, 'bitti': 1 } as const;
  const rows = app.db.all<{ id: string; data: string }>('SELECT id, data FROM race_room').map((row) => ({ row, d: parseJson<Saved | null>(row.data, null) }))
    .sort((a, b) => (a.d ? order[a.d.status] ?? 2 : 2) - (b.d ? order[b.d.status] ?? 2 : 2));
  for (const { row, d } of rows) {
    const ended = d?.status === 'bitti' ? (d.endedAt ?? now) : null;
    if (!d || !Array.isArray(d.players) || d.status === 'lobi' || d.id !== row.id || s.rooms.has(d.id) || (ended != null && now >= ended + DONE_TTL_MS)) { app.db.run('DELETE FROM race_room WHERE id = ?', row.id); continue; }
    const { linked, firstFinishAt, endedAt, ...room } = d;
    const r: Room = { ...room, players: room.players.map((p) => ({ ...p })), timers: [], linked: new Set(linked ?? []), firstFinishAt: firstFinishAt ?? null, endedAt: endedAt ?? null };
    if (r.team && o.teamEnd && r.status !== 'bitti') { const f = o.teamEnd; r.onEnd = (v) => f(app, v); }
    s.rooms.set(r.id, r); n++;
    for (const p of r.players) if (!p.left && !s.byPlayer.has(p.id)) s.byPlayer.set(p.id, r.id);
    if (r.status === 'bitti') {
      const ids = r.players.map((p) => p.id); const until = (ended ?? now) + RECENT_TTL_MS;
      for (const id of ids) if (!s.recent.has(id)) s.recent.set(id, { rivals: new Set(ids.filter((x) => x !== id)), level: r.level, until });
      setTimer(app, r, (ended ?? now) + DONE_TTL_MS - now, () => deleteRoom(app, r));
      continue;
    }
    const at = r.startsAt ?? now;
    if (r.status === 'geri-sayim') setTimer(app, r, at - now, () => tick(app, r));
    setTimer(app, r, at + RACE_MAX_MS - now, () => tick(app, r));
    if (r.firstFinishAt != null) setTimer(app, r, r.firstFinishAt + app.cfg.raceFinishGraceMs - now, () => tick(app, r));
    for (const p of active(r)) setTimer(app, r, rejoinMs, () => { if (!app.online.has(p.id) && s.byPlayer.get(p.id) === r.id) leaveRace(app, p.id); });
    tick(app, r);
  }
  return n;
}

function clearTimers(r: Room): void { for (const t of r.timers) clearTimeout(t); r.timers = []; }

function setTimer(app: App, r: Room, ms: number, fn: () => void): void {
  r.timers.push(setTimeout(() => { if (store(app).rooms.get(r.id) === r) { try { fn(); } catch (e) { if (app.cfg.log) console.error('[yaris]', e); } } }, Math.max(0, ms)));
}

function deleteRoom(app: App, r: Room): void {
  clearTimers(r);
  const s = store(app);
  s.rooms.delete(r.id);
  for (const p of r.players) if (s.byPlayer.get(p.id) === r.id) s.byPlayer.delete(p.id);
  try { app.db.run('DELETE FROM race_room WHERE id = ?', r.id); } catch { /* kapanışta veritabanı kapalı olabilir */ }
}

function finishRace(app: App, r: Room): void {
  if (r.status === 'bitti') return;
  r.status = 'bitti';
  clearTimers(r);
  const now = app.now(); const recent = store(app).recent;
  r.endedAt = now;
  for (const [k, v] of recent) if (v.until <= now) recent.delete(k);
  const ids = r.players.map((p) => p.id);
  for (const id of ids) recent.set(id, { rivals: new Set(ids.filter((x) => x !== id)), level: r.level, until: now + RECENT_TTL_MS });
  setTimer(app, r, DONE_TTL_MS, () => deleteRoom(app, r));
  broadcast(app, r);
  if (r.onEnd) { const f = r.onEnd; r.onEnd = undefined; try { f(view(r)); } catch (e) { if (app.cfg.log) console.error('[takim-yarisi]', e); } }
}

/** zamana bağlı geçişler (zamanlayıcıdan ya da bir istek sırasında tembel olarak) */
function tick(app: App, r: Room): void {
  const now = app.now();
  if (r.status === 'geri-sayim' && r.startsAt != null && now >= r.startsAt) { r.status = 'yarista'; broadcast(app, r); }
  if (r.status === 'yarista') {
    const act = active(r);
    if (act.length === 0 || act.every((p) => p.finishedAt != null)) finishRace(app, r);
    else if (r.firstFinishAt != null && now >= r.firstFinishAt + app.cfg.raceFinishGraceMs) finishRace(app, r);
    else if (r.startsAt != null && now >= r.startsAt + RACE_MAX_MS) finishRace(app, r);
  }
}

function startCountdown(app: App, r: Room): void {
  r.status = 'geri-sayim';
  r.startsAt = app.now() + app.cfg.raceCountdownMs;
  setTimer(app, r, app.cfg.raceCountdownMs, () => tick(app, r));
  setTimer(app, r, app.cfg.raceCountdownMs + RACE_MAX_MS, () => tick(app, r));
}

function maybeStart(app: App, r: Room): void {
  if (r.team) return; // takım yarışı geri sayımla kurulur; ayrılan olursa iptal olmaz (bitiremedi sayılır)
  const act = active(r);
  if (r.status === 'lobi' && act.length >= 2 && act.every((p) => p.ready)) startCountdown(app, r);
  else if (r.status === 'geri-sayim' && (act.length < 2 || !act.every((p) => p.ready))) {
    clearTimers(r); r.status = 'lobi'; r.startsAt = null;
  }
}

/** oyuncunun bulunduğu odadan çıkar: lobide listeden silinir, yarış başladıysa 'left' işaretlenir */
export function leaveRace(app: App, pid: string): void {
  const s = store(app);
  const roomId = s.byPlayer.get(pid);
  if (!roomId) return;
  s.byPlayer.delete(pid);
  const r = s.rooms.get(roomId);
  if (!r) return;
  if ((r.status === 'lobi' || r.status === 'geri-sayim') && !r.team) r.players = r.players.filter((p) => p.id !== pid);
  else { const p = r.players.find((x) => x.id === pid); if (p) p.left = true; }
  const act = active(r);
  if (!act.length) { if (r.team && r.status !== 'bitti') finishRace(app, r); deleteRoom(app, r); return; }
  if (r.hostId === pid) r.hostId = act[0]!.id;
  maybeStart(app, r);
  tick(app, r);
  broadcast(app, r);
}

function playerEntry(app: App, pid: string): RacePlayer {
  const p = app.player(pid);
  return { id: p.id, name: p.name, color: p.color, hat: p.hat, ready: false, pct: 0, finishedAt: null, place: null, score: null, left: false };
}

function createRoom(app: App, pid: string, level: number): Room {
  leaveRace(app, pid);
  const r: Room = { id: rid('r'), hostId: pid, level, salt: randomInt(1, 1000), status: 'lobi', startsAt: null, players: [playerEntry(app, pid)], max: SOCIAL_LIMITS.raceMax, createdAt: app.now(), timers: [], linked: new Set(), firstFinishAt: null };
  const s = store(app);
  s.rooms.set(r.id, r);
  s.byPlayer.set(pid, r.id);
  // uzun süre başlamayan lobi kapanır (bitti olarak bildirilir)
  setTimer(app, r, LOBBY_TTL_MS, () => { if (r.status === 'lobi') { r.status = 'bitti'; broadcast(app, r); deleteRoom(app, r); } });
  return r;
}

function joinRoom(app: App, pid: string, r: Room): void {
  if (r.players.some((p) => p.id === pid && !p.left)) return;
  if (r.status !== 'lobi') fail('BASLADI', r.status === 'geri-sayim' ? 'Bu yarışta geri sayım başladı; yeni bir yarışa katıl.' : 'Bu yarış başladı; yeni bir yarışa katıl.');
  if (active(r).length >= r.max) fail('DOLU', 'Yarış odası dolu.');
  leaveRace(app, pid);
  r.players.push(playerEntry(app, pid));
  store(app).byPlayer.set(pid, r.id);
  broadcast(app, r);
}

function myRoom(app: App, pid: string): Room {
  const id = store(app).byPlayer.get(pid);
  const r = id ? store(app).rooms.get(id) : undefined;
  if (!r) return fail('YOK', 'Bir yarış odasında değilsin.');
  tick(app, r);
  return r;
}

/**
 * Takım yarışı odası: iki takımın hazır üyeleri doğrudan geri sayımla başlar (lobi yok). Herkes aynı bölümü (aynı tuz) koşar.
 * Bağlantısı kopan oyuncu graceMs içinde dönmezse ayrılmış (bitiremedi) sayılır.
 */
export function createTeamRaceRoom(app: App, o: { level: number; players: { id: string; side: TeamRaceSideId }[]; team: TeamRaceInfo; onEnd: (room: RaceRoom) => void }): RaceRoom {
  for (const p of o.players) leaveRace(app, p.id);
  const r: Room = {
    id: rid('r'), hostId: o.players[0]!.id, level: o.level, salt: randomInt(1, 1000), status: 'lobi', startsAt: null,
    players: o.players.map((x) => ({ ...playerEntry(app, x.id), ready: true, side: x.side })), max: o.players.length, createdAt: app.now(),
    timers: [], linked: new Set(), firstFinishAt: null, team: o.team, onEnd: o.onEnd,
  };
  const s = store(app);
  s.rooms.set(r.id, r);
  for (const p of o.players) s.byPlayer.set(p.id, r.id);
  startCountdown(app, r);
  broadcast(app, r);
  return view(r);
}
export function raceRoomView(app: App, id: string): RaceRoom | null { const r = store(app).rooms.get(id); if (!r) return null; tick(app, r); return view(r); }

/**
 * Bağlantı koptu. Takım yarışında ve süren yarışta kısa bir bekleme: aynı oyuncu dönerse yarışı sürdürür (MK-031: kısa ağ
 * kopması derecesini silmez). Lobide, normal yarışın geri sayımında ve bitmiş yarışta hemen çıkış.
 */
export function raceDisconnect(app: App, pid: string, graceMs: number): void {
  const id = store(app).byPlayer.get(pid);
  const r = id ? store(app).rooms.get(id) : undefined;
  const wait = r && r.status !== 'bitti' && (r.team || r.status === 'yarista');
  if (!r || !wait) { leaveRace(app, pid); return; }
  const ms = r.team ? graceMs : (app.cfg.raceRejoinMs ?? RACE_REJOIN_MS);
  setTimer(app, r, ms, () => { if (!app.online.has(pid) && store(app).byPlayer.get(pid) === r.id) leaveRace(app, pid); });
}

/** progress.submit: yarış derecesini bir kez bağla */
export function racePlaceFor(app: App, pid: string, raceId: string): number | null {
  const r = store(app).rooms.get(raceId);
  if (!r || r.linked.has(pid)) return null;
  const p = r.players.find((x) => x.id === pid);
  if (!p || p.place == null) return null;
  r.linked.add(pid);
  save(app, r);
  return p.place;
}

/** sıralama (yarış galibiyeti): bu yarışı oyuncu birinci bitirdi mi ve en az iki kişi bitirdi mi — bağlantıyı tüketmeden bakar */
export function raceWinFor(app: App, pid: string, raceId: string): boolean {
  const r = store(app).rooms.get(raceId);
  if (!r || r.linked.has(pid)) return false;
  return r.players.find((x) => x.id === pid)?.place === 1 && r.players.filter((x) => x.place != null).length >= 2;
}

/** WireFire race.pos: yarışta değilse sessizce yok sayılır; 8 Hz üstü düşürülür */
export function racePos(app: App, conn: Conn, data: { x: number; y: number; pct: number }): void {
  const pid = conn.pid;
  if (!pid) return;
  const id = store(app).byPlayer.get(pid);
  const r = id ? store(app).rooms.get(id) : undefined;
  if (!r) return;
  tick(app, r);
  if (r.status !== 'yarista') return;
  const me = r.players.find((p) => p.id === pid);
  if (!me || me.left || me.finishedAt != null) return;
  const t = Date.now();
  if (t - conn.lastPosAt < POS_MIN_INTERVAL_MS) return;
  conn.lastPosAt = t;
  const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
  const x = num(data?.x, -1e6, 1e6), y = num(data?.y, -1e6, 1e6), pct = num(data?.pct, 0, 1);
  if (x == null || y == null || pct == null) return;
  me.pct = pct;
  const ev = { id: pid, x, y, pct, at: app.now() };
  for (const p of active(r)) if (p.id !== pid) app.emit(p.id, 'race.pos', ev);
}

/** yarış sohbeti ('race:<oda>') için: odadaki (ayrılmamış) oyuncular; oda yoksa null */
export function raceMemberIds(app: App, roomId: string): string[] | null {
  const r = store(app).rooms.get(roomId);
  return r ? active(r).map((p) => p.id) : null;
}

/** son biten yarıştaki rakipler (arkadaş önerileri: "Seninle yarıştı") */
export function recentRivalIds(app: App, pid: string): string[] {
  const x = store(app).recent.get(pid);
  return x && x.until > app.now() ? [...x.rivals] : [];
}

/** son biten yarışta birlikte yarıştılar mı (rövanş) */
function recentRival(app: App, a: string, b: string): boolean {
  const x = store(app).recent.get(a);
  return !!x && x.until > app.now() && x.rivals.has(b);
}

export function raceShutdown(app: App): void {
  for (const r of store(app).rooms.values()) clearTimers(r);
  stores.delete(app);
}

export function sweepRaces(app: App): void { for (const r of [...store(app).rooms.values()]) tick(app, r); }

export const raceHandlers: Handlers = {
  'race.create': (app, s, { level }) => {
    const p = app.player(s.pid);
    const lv = level ?? p.highest;
    const rematch = store(app).recent.get(s.pid);
    if (lv > p.highest && !(rematch && rematch.until > app.now() && rematch.level === lv)) fail('GECERSIZ', 'Henüz açmadığın bir bölümde yarış kuramazsın.');
    const r = createRoom(app, s.pid, lv);
    return { room: view(r) };
  },
  'race.join': (app, s, { roomId }) => {
    const r = store(app).rooms.get(roomId);
    if (!r) return fail('YOK', 'Yarış odası bulunamadı.');
    tick(app, r);
    joinRoom(app, s.pid, r);
    return { room: view(r) };
  },
  'race.quick': (app, s) => {
    const now = app.now();
    const open = [...store(app).rooms.values()]
      .filter((r) => r.status === 'lobi' && active(r).length < r.max && !r.players.some((p) => p.id === s.pid) && now - r.createdAt < LOBBY_TTL_MS)
      .sort((a, b) => a.createdAt - b.createdAt)[0];
    if (open) { joinRoom(app, s.pid, open); return { room: view(open) }; }
    return { room: view(createRoom(app, s.pid, app.player(s.pid).highest)) };
  },
  'race.invite': (app, s, { friendId }) => {
    const r = myRoom(app, s.pid);
    if (r.status !== 'lobi') fail('BASLADI', 'Yarış başladıktan sonra davet gönderilemez.');
    if (isBlocked(app, s.pid, friendId)) fail('ENGEL', 'Bu oyuncu davet edilemiyor.');
    if (!areFriends(app, s.pid, friendId) && !recentRival(app, s.pid, friendId)) fail('YETKI', 'Yalnızca arkadaşlarını ya da son yarıştaki rakiplerini davet edebilirsin.');
    if (!app.online.has(friendId)) fail('CEVRIMDISI', 'Arkadaşın şu an çevrimiçi değil.');
    app.emit(friendId, 'race.invited', { room: view(r), from: app.publicProfile(app.player(s.pid)) });
    return {};
  },
  'race.ready': (app, s, { ready }) => {
    const r = myRoom(app, s.pid);
    if (r.status !== 'lobi' && r.status !== 'geri-sayim') fail('BASLADI', 'Yarış zaten başladı.');
    const me = r.players.find((p) => p.id === s.pid)!;
    me.ready = ready;
    maybeStart(app, r);
    broadcast(app, r);
    return { room: view(r) };
  },
  'race.leave': (app, s) => { leaveRace(app, s.pid); return {}; },
  /** yeniden bağlanınca odanın güncel hâli (katılmaz; ayrılmış ya da bitmiş yarışçı da okuyabilir) */
  'race.state': (app, s, { roomId }) => {
    const r = store(app).rooms.get(roomId);
    if (!r || !r.players.some((p) => p.id === s.pid)) return fail('YOK', 'Yarış odası kapandı.');
    tick(app, r);
    return { room: view(r) };
  },
  'race.finish': (app, s, { completed, score }) => {
    const r = myRoom(app, s.pid);
    if (r.status !== 'yarista') fail('GECERSIZ', r.status === 'bitti' ? 'Yarış bitti.' : 'Yarış henüz başlamadı.');
    const me = r.players.find((p) => p.id === s.pid)!;
    if (me.left) fail('GECERSIZ', 'Yarıştan ayrıldın.');
    if (me.finishedAt != null) fail('TEKRAR', 'Bitişin zaten kaydedildi.');
    me.finishedAt = app.now();
    me.score = Math.round(score);
    if (completed) { me.pct = 1; me.place = r.players.filter((p) => p.place != null).length + 1; }
    if (r.firstFinishAt == null) {
      r.firstFinishAt = me.finishedAt;
      setTimer(app, r, app.cfg.raceFinishGraceMs, () => tick(app, r));
    }
    tick(app, r);
    broadcast(app, r);
    return { room: view(r) };
  },
};
