/**
 * Canlı Takım Yarışı (docs/16-takim-rekabeti.md). Lider/yardımcı takım lobisini açar, üyeler katılıp "Hazırım" der; takım ya benzer güçte
 * arayan bir takımla eşleşir (pencere zamanla genişler) ya da belirli bir takıma dostluk daveti gönderir. Eşleşince iki takımın hazır
 * üyeleri aynı bölümü (aynı tuz) canlı yarış odasında koşar (race.ts: hayaletler, geri sayım, sunucu zamanlaması).
 * Puan şeffaf: genel bitiş sırasına göre 10/8/6/5/4/3/2/1 + yıldız başına 2, bitiremeyen 0; az kişili takımın ham puanı denge çarpanıyla.
 * Sonuç bir kez yazılır (tr_match.finalized), ödül ve lig puanı günlük sınırlı. Sahte takım/rakip yok.
 */
import {
  TEAM_RACE_REACTIONS, TEAM_RACE_RULES as R, type OpMap, type RaceRoom, type TeamRaceChallenge, type TeamRaceInfo, type TeamRaceLobby,
  type TeamRaceResult, type TeamRaceRow, type TeamRaceSideId, type TeamRaceSize, type TeamRaceState,
} from '@odi/shared';
import { fail, parseJson, rid, type App, type Handler, type Handlers } from '../app';
import { postCard, systemMessage, teamRoom } from '../chat';
import { createTeamRaceRoom, raceDisconnect, raceRoomView } from '../race';
import { boardValue } from '../rank';
import { dayKey } from '../time';
import { leagueState, recordRaceLeague, requireTeamId, ensureSeason } from './league';
import { isAdmin } from '../codes';

export { TLIG_SCHEMA, ensureSeason, seasonTable } from './league';

export const TRACE_SCHEMA = `
CREATE TABLE IF NOT EXISTS tr_match(id TEXT PRIMARY KEY, race_id TEXT NOT NULL UNIQUE, size INTEGER NOT NULL, team_a TEXT NOT NULL, team_b TEXT NOT NULL, level INTEGER NOT NULL,
  friendly INTEGER NOT NULL, info TEXT NOT NULL, created_at INTEGER NOT NULL, ended_at INTEGER, room TEXT, finalized INTEGER NOT NULL DEFAULT 0, result TEXT);
CREATE INDEX IF NOT EXISTS tr_match_a ON tr_match(team_a, created_at);
CREATE INDEX IF NOT EXISTS tr_match_b ON tr_match(team_b, created_at);
CREATE TABLE IF NOT EXISTS tr_star(match_id TEXT NOT NULL, player_id TEXT NOT NULL, stars INTEGER NOT NULL, PRIMARY KEY(match_id, player_id));
`;

interface Lobby {
  teamId: string; size: TeamRaceSize; status: TeamRaceLobby['status']; openedBy: string;
  members: Map<string, { ready: boolean }>; searchingSince: number | null; raceId: string | null; matchId: string | null;
  outgoing: { teamId: string; until: number } | null; note: string | null;
}
interface Store { lobbies: Map<string, Lobby>; incoming: Map<string, Map<string, { size: TeamRaceSize; until: number }>>; lastReact: Map<string, number>; timers: Set<ReturnType<typeof setTimeout>> }
const stores = new WeakMap<App, Store>();
function st(app: App): Store {
  let s = stores.get(app);
  if (!s) { s = { lobbies: new Map(), incoming: new Map(), lastReact: new Map(), timers: new Set() }; stores.set(app, s); }
  return s;
}
const canLead = (app: App, pid: string) => { const r = app.player(pid).team_role; return r === 'lider' || r === 'yardimci'; };
function requireLead(app: App, pid: string): string {
  const t = requireTeamId(app, pid);
  if (!canLead(app, pid)) fail('YETKI', 'Bunu yalnızca lider ya da yardımcı yapabilir.');
  return t;
}
const teamPower = (app: App, teamId: string) => boardValue(app, 't-guc', teamId);

// ------------------------------------------------------------------ görünüm
function lobbyView(app: App, l: Lobby): TeamRaceLobby {
  const now = app.now();
  const inc = [...(st(app).incoming.get(l.teamId) ?? new Map()).entries()].filter(([, c]) => c.until > now).flatMap(([teamId, c]): TeamRaceChallenge[] => {
    const t = app.team(teamId); return t ? [{ teamId, name: t.name, emblem: t.emblem, size: c.size, until: c.until }] : [];
  });
  const out = l.outgoing && l.outgoing.until > now ? app.team(l.outgoing.teamId) : null;
  return {
    teamId: l.teamId, size: l.size, status: l.status, openedBy: l.openedBy, searchingSince: l.searchingSince, raceId: l.raceId, note: l.note,
    members: [...l.members.entries()].flatMap(([id, m]) => { const p = app.playerOrNull(id); return p ? [{ id, name: p.name, color: p.color, hat: p.hat, ready: m.ready, online: app.online.has(id) }] : []; }),
    incoming: inc, outgoing: out && l.outgoing ? { teamId: out.id, name: out.name, emblem: out.emblem, size: l.size, until: l.outgoing.until } : null,
  };
}
/** takımın çevrimiçi üyelerine lobi durumunu yolla */
function push(app: App, teamId: string): void {
  const l = st(app).lobbies.get(teamId);
  const v = l ? lobbyView(app, l) : null;
  for (const pid of app.teamMemberIds(teamId)) app.emit(pid, 'trace.updated', { lobby: v });
}
const readyOnline = (app: App, l: Lobby) => [...l.members.entries()].filter(([id, m]) => m.ready && app.online.has(id) && app.playerOrNull(id)?.team_id === l.teamId).map(([id]) => id);
function myLobby(app: App, teamId: string): Lobby {
  const l = st(app).lobbies.get(teamId);
  if (!l) return fail('YOK', 'Takımının açık bir Takım Yarışı lobisi yok.');
  return l;
}
function activeMatch(app: App, teamId: string): { id: string; race_id: string } | null {
  return app.db.get<{ id: string; race_id: string }>('SELECT id, race_id FROM tr_match WHERE (team_a = ? OR team_b = ?) AND ended_at IS NULL ORDER BY created_at DESC LIMIT 1', teamId, teamId) ?? null;
}
function openLobby(app: App, pid: string, teamId: string, size: TeamRaceSize): Lobby {
  const s = st(app);
  const cur = s.lobbies.get(teamId);
  if (cur?.status === 'eslesti') fail('SURUYOR', 'Takımının süren bir yarışı var; bitince yenisini açabilirsin.');
  if (cur) { if (!cur.members.has(pid)) cur.members.set(pid, { ready: false }); return cur; }
  const live = activeMatch(app, teamId);
  if (live && raceRoomView(app, live.race_id)?.status !== 'bitti') fail('SURUYOR', 'Takımının süren bir yarışı var; bitince yenisini açabilirsin.');
  const l: Lobby = { teamId, size, status: 'toplaniyor', openedBy: pid, members: new Map([[pid, { ready: false }]]), searchingSince: null, raceId: null, matchId: null, outgoing: null, note: null };
  s.lobbies.set(teamId, l);
  const p = app.player(pid);
  systemMessage(app, teamRoom(teamId), `${p.name} ${size}'e ${size} Takım Yarışı lobisi açtı. Katılmak için Takım › Takım Yarışı.`, 'system', { event: 'tyaris' });
  return l;
}

// ------------------------------------------------------------------ eşleşme
function windowFor(app: App, a: Lobby, b: Lobby, pa: number, pb: number): boolean {
  const wait = app.now() - Math.min(a.searchingSince ?? app.now(), b.searchingSince ?? app.now());
  const steps = Math.floor(wait / R.widenMs);
  if (steps >= 3) return true;
  const w = Math.max(R.powerWindowMin, (Math.max(pa, pb) * R.powerWindowPct) / 100) * 2 ** steps;
  return Math.abs(pa - pb) <= w;
}
/** arayan takımları eşleştir (aynı boyut, güç penceresi); bulamayanlara dürüst not, süre dolanlar aramayı bırakır */
export function tryMatch(app: App): void {
  const s = st(app); const now = app.now();
  const searching = [...s.lobbies.values()].filter((l) => l.status === 'ariyor').sort((x, y) => (x.searchingSince ?? 0) - (y.searchingSince ?? 0));
  const used = new Set<string>();
  for (const a of searching) {
    if (used.has(a.teamId)) continue;
    if (readyOnline(app, a).length < R.minPlayers) { a.status = 'toplaniyor'; a.searchingSince = null; a.note = `Arama durdu: en az ${R.minPlayers} hazır ve çevrimiçi üye gerekir.`; push(app, a.teamId); continue; }
    const pa = teamPower(app, a.teamId);
    let best: Lobby | null = null; let bestD = Infinity;
    for (const b of searching) {
      if (b === a || used.has(b.teamId) || b.size !== a.size || readyOnline(app, b).length < R.minPlayers) continue;
      const pb = teamPower(app, b.teamId);
      if (!windowFor(app, a, b, pa, pb)) continue;
      const d = Math.abs(pa - pb); if (d < bestD) { best = b; bestD = d; }
    }
    if (best) { used.add(a.teamId); used.add(best.teamId); startMatch(app, a, best, false); continue; }
    if (a.searchingSince != null && now - a.searchingSince >= R.searchMaxMs) {
      a.status = 'toplaniyor'; a.searchingSince = null; a.note = 'Şu an benzer güçte arayan takım bulunamadı. Bir takıma dostluk daveti gönderebilir ya da sonra yeniden arayabilirsiniz.'; push(app, a.teamId);
    } else {
      const others = searching.filter((x) => x !== a && x.size === a.size).length;
      const note = others ? 'Benzer güçte takım aranıyor… (pencere 20 sn’de bir genişler)' : 'Şu an arayan başka takım yok. Aramaya devam ediyoruz; istersen bir takıma dostluk daveti de gönder.';
      if (a.note !== note) { a.note = note; push(app, a.teamId); }
    }
  }
}

function startMatch(app: App, a: Lobby, b: Lobby, friendly: boolean): void {
  const size = a.size;
  const ida = readyOnline(app, a).slice(0, size); const idb = readyOnline(app, b).slice(0, size);
  const ta = app.team(a.teamId)!; const tb = app.team(b.teamId)!;
  const n = Math.max(ida.length, idb.length);
  const mult = (k: number) => Math.round((n / k) * 100) / 100;
  const level = Math.max(1, Math.min(...[...ida, ...idb].map((id) => app.player(id).highest)));
  const matchId = rid('m');
  const info: TeamRaceInfo = { matchId, size, friendly, a: { teamId: ta.id, name: ta.name, emblem: ta.emblem, n: ida.length, mult: mult(ida.length) }, b: { teamId: tb.id, name: tb.name, emblem: tb.emblem, n: idb.length, mult: mult(idb.length) } };
  const room = createTeamRaceRoom(app, { level, players: [...ida.map((id) => ({ id, side: 'a' as const })), ...idb.map((id) => ({ id, side: 'b' as const }))], team: info, onEnd: (r) => onRaceEnd(app, matchId, r) });
  app.db.run('INSERT INTO tr_match(id, race_id, size, team_a, team_b, level, friendly, info, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)', matchId, room.id, size, ta.id, tb.id, level, friendly ? 1 : 0, JSON.stringify(info), app.now());
  for (const l of [a, b]) { l.status = 'eslesti'; l.raceId = room.id; l.matchId = matchId; l.searchingSince = null; l.outgoing = null; l.note = null; }
  st(app).incoming.get(a.teamId)?.delete(b.teamId); st(app).incoming.get(b.teamId)?.delete(a.teamId);
  for (const id of [...ida, ...idb]) app.emit(id, 'trace.matched', { room });
  systemMessage(app, teamRoom(ta.id), `Takım Yarışı başladı: ${ta.emblem} ${ta.name} (${ida.length}) – ${tb.emblem} ${tb.name} (${idb.length}) · ${level}. bölüm${friendly ? ' · dostluk maçı' : ''}`, 'system', { event: 'tyaris', matchId });
  systemMessage(app, teamRoom(tb.id), `Takım Yarışı başladı: ${tb.emblem} ${tb.name} (${idb.length}) – ${ta.emblem} ${ta.name} (${ida.length}) · ${level}. bölüm${friendly ? ' · dostluk maçı' : ''}`, 'system', { event: 'tyaris', matchId });
  push(app, a.teamId); push(app, b.teamId);
}

// ------------------------------------------------------------------ sonuç
function onRaceEnd(app: App, matchId: string, room: RaceRoom): void {
  app.run(() => {
    app.db.run('UPDATE tr_match SET ended_at = ?, room = ? WHERE id = ? AND ended_at IS NULL', app.now(), JSON.stringify(room), matchId);
    // lobiler serbest: aynı takım yeni lobi açabilir (rövanş)
    const m = app.db.get<{ team_a: string; team_b: string }>('SELECT team_a, team_b FROM tr_match WHERE id = ?', matchId);
    if (m) for (const t of [m.team_a, m.team_b]) { const l = st(app).lobbies.get(t); if (l?.matchId === matchId) { st(app).lobbies.delete(t); push(app, t); } }
  });
  if (allStars(app, matchId)) finalize(app, matchId);
  else { const h = setTimeout(() => { st(app).timers.delete(h); try { finalize(app, matchId); } catch (e) { if (app.cfg.log) console.error('[takim-yarisi]', e); } }, R.starWaitMs); st(app).timers.add(h); }
}
/** sunucu takım yarışı sürerken yeniden başladıysa (race.ts restoreRaces): geri yüklenen yarışın sonucu yine bir kez yazılır */
export function teamRaceRestoredEnd(app: App, room: RaceRoom): void { if (room.team) onRaceEnd(app, room.team.matchId, room); }
function allStars(app: App, matchId: string): boolean {
  const m = app.db.get<{ room: string | null }>('SELECT room FROM tr_match WHERE id = ?', matchId);
  const room = m?.room ? parseJson<RaceRoom | null>(m.room, null) : null; if (!room) return false;
  const got = new Set(app.db.all<{ player_id: string }>('SELECT player_id FROM tr_star WHERE match_id = ?', matchId).map((r) => r.player_id));
  return room.players.filter((p) => p.place != null).every((p) => got.has(p.id));
}
export const placePoints = (place: number | null, stars: number) => (place == null ? 0 : (R.placePoints[place - 1] ?? 1) + stars * R.starPoints);

/** sonucu bir kez yaz: puanlar, kazanan, ödül (günlük sınır), lig puanı (günlük sınır), iki takımın akışına kart */
export function finalize(app: App, matchId: string): TeamRaceResult | null {
  return app.run(() => {
    const m = app.db.get<{ id: string; size: TeamRaceSize; team_a: string; team_b: string; level: number; friendly: number; info: string; room: string | null; ended_at: number | null }>('SELECT * FROM tr_match WHERE id = ?', matchId);
    if (!m || m.ended_at == null || !m.room) return null;
    if (!app.db.run('UPDATE tr_match SET finalized = 1 WHERE id = ? AND finalized = 0', matchId)) return null;
    const info = parseJson<TeamRaceInfo>(m.info, null as unknown as TeamRaceInfo); const room = parseJson<RaceRoom>(m.room, null as unknown as RaceRoom);
    const stars = new Map(app.db.all<{ player_id: string; stars: number }>('SELECT player_id, stars FROM tr_star WHERE match_id = ?', matchId).map((r) => [r.player_id, r.stars]));
    const rows: TeamRaceRow[] = room.players.map((p) => {
      const sv = p.place != null ? Math.max(0, Math.min(3, stars.get(p.id) ?? 0)) : 0;
      return { id: p.id, name: p.name, color: p.color, hat: p.hat, side: p.side ?? 'a', place: p.place, timeSec: p.finishedAt != null && room.startsAt != null && p.place != null ? Math.round((p.finishedAt - room.startsAt) / 100) / 10 : null, stars: sv, points: placePoints(p.place, sv), left: p.left };
    }).sort((x, y) => (x.place ?? 99) - (y.place ?? 99) || y.points - x.points);
    const side = (k: TeamRaceSideId) => { const raw = rows.filter((r) => r.side === k).reduce((a, r) => a + r.points, 0); return { ...info[k], raw, score: Math.round(raw * info[k].mult) }; };
    const A = side('a'); const B = side('b');
    const winner: TeamRaceSideId | null = A.score > B.score ? 'a' : B.score > A.score ? 'b' : null;
    const day = dayKey(app.now());
    // sayılma: en az bir bitiren olmalı; aynı iki takım günde en çok 2 kez sayılır
    const finishers = rows.filter((r) => r.place != null).length;
    const pairToday = app.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM tl_race WHERE team_id = ? AND rival_id = ? AND day = ? AND counted = 1`, m.team_a, m.team_b, day)!.n;
    // yönetici hesabı katıldıysa yarış lige sayılmaz (adil rekabet); diğerlerinin ödülü sürer
    const anyAdmin = rows.some((r) => isAdmin(app, r.id));
    const allowed = finishers > 0 && pairToday < 2 && !anyAdmin;
    const rewardable = finishers > 0 && pairToday < 2;
    const outcome = (k: TeamRaceSideId) => (winner == null ? 'draw' : winner === k ? 'win' : 'lose') as 'win' | 'draw' | 'lose';
    const ca = recordRaceLeague(app, matchId, m.team_a, m.team_b, R.league[outcome('a')], day, allowed);
    const cb = recordRaceLeague(app, matchId, m.team_b, m.team_a, R.league[outcome('b')], day, allowed);
    const result: TeamRaceResult = { matchId, size: m.size, level: m.level, friendly: !!m.friendly, a: A, b: B, winner, rows, endedAt: m.ended_at, counted: ca || cb };
    app.db.run('UPDATE tr_match SET result = ? WHERE id = ?', JSON.stringify(result), matchId);
    // ödüller: sayılan yarışlarda; kazanan/berabere: katılan (ayrılmayan) herkes, kaybeden: bitirenler
    if (rewardable) {
      for (const r of rows) {
        const o = outcome(r.side); if (r.left || (o === 'lose' && r.place == null) || isAdmin(app, r.id)) continue;
        if (app.dailyCount(r.id, day, 'tyaris_odul') >= R.rewardRacesPerDay) continue;
        app.dailyInc(r.id, day, 'tyaris_odul');
        const g = R.rewards[o]; const why = `Takım Yarışı ${o === 'win' ? 'kazanıldı' : o === 'draw' ? 'berabere' : 'katılım'}: ${A.emblem} ${A.score} – ${B.score} ${B.emblem}`;
        if (g.jeton) app.addInbox(r.id, { kind: 'jeton', amount: g.jeton, ref: 'takim-yarisi' }, why);
        if (g.kristal) app.addInbox(r.id, { kind: 'kristal', amount: g.kristal, ref: 'takim-yarisi' }, why);
      }
    }
    // iki takımın akışına kart (rövanş düğmesi istemcide)
    for (const k of ['a', 'b'] as const) {
      const us = k === 'a' ? A : B; const them = k === 'a' ? B : A; const o = outcome(k);
      const mvp = rows.find((r) => r.side === k && r.place != null) ?? rows.find((r) => r.side === k);
      const word = o === 'win' ? 'Kazandınız!' : o === 'draw' ? 'Berabere!' : 'Bu sefer olmadı.';
      postCard(app, teamRoom(us.teamId), {
        kind: 'feed', text: `Takım Yarışı: ${us.emblem} ${us.name} ${us.score} – ${them.score} ${them.name} ${them.emblem} · ${word}`,
        meta: { type: 'tyaris', matchId, pid: mvp?.id ?? '', pname: mvp?.name ?? us.name, pc: mvp?.color ?? 0x8b6bff, ph: mvp?.hat ?? '', us: us.score, them: them.score, rival: them.teamId, rivalName: them.name, rivalEmblem: them.emblem, outcome: o, counted: result.counted ? 1 : 0 },
      });
    }
    const ids = new Set([...app.teamMemberIds(m.team_a), ...app.teamMemberIds(m.team_b), ...rows.map((r) => r.id)]);
    for (const id of ids) app.emit(id, 'trace.result', { result });
    return result;
  });
}

/** progress.submit (yarış koşusu): takım yarışında bitirenin yıldızı bir kez kaydedilir; herkesinki geldiyse sonuç hemen yazılır */
export function withTeamRaceHooks(h: Handlers): Handlers {
  const submit = h['progress.submit'] as Handler<'progress.submit'>;
  const wrapped: Handler<'progress.submit'> = (app, s, d) => {
    const ack = submit(app, s, d) as OpMap['progress.submit']['res'];
    if (d.raceId && d.completed) {
      const m = app.db.get<{ id: string; finalized: number }>('SELECT id, finalized FROM tr_match WHERE race_id = ?', d.raceId);
      if (m && !m.finalized) {
        app.db.run('INSERT OR IGNORE INTO tr_star(match_id, player_id, stars) VALUES(?, ?, ?)', m.id, s.pid, Math.max(0, Math.min(3, Math.round(d.stars))));
        if (allStars(app, m.id)) app.after(() => { finalize(app, m.id); });
      }
    }
    return ack;
  };
  return { ...h, 'progress.submit': wrapped };
}

// ------------------------------------------------------------------ zamanlayıcı
export function teamRaceSweep(app: App): void {
  ensureSeason(app);
  const now = app.now(); const s = st(app);
  for (const [t, m] of s.incoming) { for (const [k, c] of m) if (c.until <= now) m.delete(k); if (!m.size) s.incoming.delete(t); }
  app.run(() => tryMatch(app));
  // sonuç bekleyen (yıldız süresi doldu) yarışlar
  for (const m of app.db.all<{ id: string }>('SELECT id FROM tr_match WHERE finalized = 0 AND ended_at IS NOT NULL AND ended_at <= ?', now - R.starWaitMs)) finalize(app, m.id);
}
export function teamRaceShutdown(app: App): void { const s = stores.get(app); if (s) for (const h of s.timers) clearTimeout(h); stores.delete(app); }
export function teamRaceDisconnect(app: App, pid: string): void { raceDisconnect(app, pid, app.cfg.teamRaceGraceMs ?? R.graceMs); }

function recent(app: App, teamId: string): TeamRaceResult[] {
  return app.db.all<{ result: string }>('SELECT result FROM tr_match WHERE (team_a = ? OR team_b = ?) AND result IS NOT NULL ORDER BY ended_at DESC LIMIT 5', teamId, teamId)
    .map((r) => parseJson<TeamRaceResult | null>(r.result, null)).filter((x): x is TeamRaceResult => !!x);
}
function dailyTeam(app: App, teamId: string, kind: string, max: number, msg: string): void {
  const day = dayKey(app.now());
  if (app.dailyCount(`team:${teamId}`, day, kind) >= max) fail('SINIR', msg);
  app.dailyInc(`team:${teamId}`, day, kind);
}
function sendChallenge(app: App, pid: string, from: Lobby, toTeam: string): void {
  if (toTeam === from.teamId) fail('GECERSIZ', 'Kendi takımına davet gönderemezsin.');
  const t = app.team(toTeam); if (!t) fail('YOK', 'Takım bulunamadı.');
  const live = activeMatch(app, toTeam);
  if (live && raceRoomView(app, live.race_id)?.status !== 'bitti') fail('SURUYOR', 'Bu takımın şu an süren bir yarışı var.');
  dailyTeam(app, from.teamId, 'tyaris_davet', R.challengesPerDay, `Takımın bugün en çok ${R.challengesPerDay} dostluk daveti gönderebilir.`);
  const until = app.now() + R.challengeMs;
  let m = st(app).incoming.get(toTeam); if (!m) { m = new Map(); st(app).incoming.set(toTeam, m); }
  m.set(from.teamId, { size: from.size, until });
  from.outgoing = { teamId: toTeam, until };
  const me = app.team(from.teamId)!;
  systemMessage(app, teamRoom(toTeam), `${me.emblem} ${me.name} takımı sizi ${from.size}'e ${from.size} Takım Yarışına davet ediyor (10 dk). Lider ya da yardımcı Takım › Takım Yarışı'ndan kabul edebilir.`, 'system', { event: 'tyaris', from: me.id });
  const ch: TeamRaceChallenge = { teamId: me.id, name: me.name, emblem: me.emblem, size: from.size, until };
  for (const id of app.teamMemberIds(toTeam)) app.emit(id, 'trace.challenged', { challenge: ch });
  push(app, toTeam);
  void pid;
}

export const teamRaceHandlers: Handlers = {
  'trace.state': (app, s): { state: TeamRaceState } => {
    const teamId = requireTeamId(app, s.pid);
    const l = st(app).lobbies.get(teamId);
    const live = activeMatch(app, teamId); const room = live ? raceRoomView(app, live.race_id) : null;
    const searching = [...st(app).lobbies.values()].filter((x) => x.status === 'ariyor' && x.teamId !== teamId).length;
    return { state: { lobby: l ? lobbyView(app, l) : null, live: room && room.status !== 'bitti' ? room : null, recent: recent(app, teamId), searching, canLead: canLead(app, s.pid) } };
  },
  'trace.open': (app, s, { size }) => {
    const teamId = requireLead(app, s.pid);
    if (!R.sizes.includes(size)) fail('GECERSIZ', 'Takım yarışı 3’e 3 ya da 5’e 5 olur.');
    const l = openLobby(app, s.pid, teamId, size);
    push(app, teamId);
    return { lobby: lobbyView(app, l) };
  },
  'trace.join': (app, s) => {
    const teamId = requireTeamId(app, s.pid); const l = myLobby(app, teamId);
    if (l.status === 'eslesti') fail('BASLADI', 'Yarış başladı; bir sonrakine katıl.');
    if (!l.members.has(s.pid)) {
      if (l.members.size >= 10) fail('DOLU', 'Lobi dolu.');
      l.members.set(s.pid, { ready: false });
    }
    push(app, teamId);
    return { lobby: lobbyView(app, l) };
  },
  'trace.leave': (app, s) => {
    const teamId = requireTeamId(app, s.pid); const l = st(app).lobbies.get(teamId);
    if (!l) return { lobby: null };
    l.members.delete(s.pid);
    if (!l.members.size && l.status !== 'eslesti') st(app).lobbies.delete(teamId);
    else if (l.status === 'ariyor') tryMatch(app);
    push(app, teamId);
    const cur = st(app).lobbies.get(teamId);
    return { lobby: cur ? lobbyView(app, cur) : null };
  },
  'trace.ready': (app, s, { ready }) => {
    const teamId = requireTeamId(app, s.pid); const l = myLobby(app, teamId);
    if (l.status === 'eslesti') fail('BASLADI', 'Yarış başladı.');
    l.members.set(s.pid, { ready });
    if (l.status === 'ariyor') tryMatch(app);
    push(app, teamId);
    return { lobby: lobbyView(app, l) };
  },
  'trace.search': (app, s, { on }) => {
    const teamId = requireLead(app, s.pid); const l = myLobby(app, teamId);
    if (l.status === 'eslesti') fail('BASLADI', 'Yarış başladı.');
    if (on) {
      if (readyOnline(app, l).length < R.minPlayers) fail('AZ', `Aramak için en az ${R.minPlayers} hazır ve çevrimiçi üye gerekir.`);
      if (l.status !== 'ariyor') { dailyTeam(app, teamId, 'tyaris_ara', R.searchesPerDay, 'Takımın bugün yeterince arama yaptı; yarın yeniden deneyin.'); l.status = 'ariyor'; l.searchingSince = app.now(); l.note = null; }
      tryMatch(app);
    } else { l.status = 'toplaniyor'; l.searchingSince = null; l.note = null; }
    push(app, teamId);
    const cur = st(app).lobbies.get(teamId)!;
    return { lobby: lobbyView(app, cur) };
  },
  'trace.close': (app, s) => {
    const teamId = requireLead(app, s.pid); const l = st(app).lobbies.get(teamId);
    if (l && l.status !== 'eslesti') { st(app).lobbies.delete(teamId); push(app, teamId); }
    return {};
  },
  'trace.challenge': (app, s, { teamId: to }) => {
    const teamId = requireLead(app, s.pid); const l = myLobby(app, teamId);
    if (l.status === 'eslesti') fail('BASLADI', 'Yarış başladı.');
    sendChallenge(app, s.pid, l, to);
    push(app, teamId);
    return { lobby: lobbyView(app, l) };
  },
  'trace.accept': (app, s, { teamId: from }) => {
    const teamId = requireLead(app, s.pid);
    const c = st(app).incoming.get(teamId)?.get(from);
    if (!c || c.until <= app.now()) fail('YOK', 'Bu davetin süresi doldu.');
    const other = st(app).lobbies.get(from);
    if (!other || other.status === 'eslesti' || other.outgoing?.teamId !== teamId) fail('YOK', 'Davet eden takımın lobisi kapandı.');
    const l = openLobby(app, s.pid, teamId, c.size);
    if (l.status === 'eslesti') fail('BASLADI', 'Yarışınız zaten başladı.');
    if (readyOnline(app, l).length < R.minPlayers) { push(app, teamId); fail('AZ', `Kabul için en az ${R.minPlayers} hazır ve çevrimiçi üye gerekir; önce üyeler lobiye katılıp "Hazırım" desin.`); }
    if (readyOnline(app, other).length < R.minPlayers) fail('AZ', 'Davet eden takımda şu an yeterli hazır üye yok; biraz sonra yeniden deneyin.');
    other.size = c.size; l.size = c.size;
    startMatch(app, other, l, true);
    return { lobby: lobbyView(app, l) };
  },
  'trace.decline': (app, s, { teamId: from }) => {
    const teamId = requireLead(app, s.pid);
    st(app).incoming.get(teamId)?.delete(from);
    const other = st(app).lobbies.get(from);
    if (other?.outgoing?.teamId === teamId) { other.outgoing = null; const me = app.team(teamId); other.note = `${me?.emblem ?? ''} ${me?.name ?? 'Takım'} daveti şimdilik kabul edemedi.`; push(app, from); }
    push(app, teamId);
    const l = st(app).lobbies.get(teamId);
    return { lobby: l ? lobbyView(app, l) : null };
  },
  'trace.rematch': (app, s, { matchId }) => {
    const teamId = requireLead(app, s.pid);
    const m = app.db.get<{ team_a: string; team_b: string; size: TeamRaceSize }>('SELECT team_a, team_b, size FROM tr_match WHERE id = ?', matchId);
    if (!m || (m.team_a !== teamId && m.team_b !== teamId)) fail('YOK', 'Bu yarış bulunamadı.');
    const rival = m.team_a === teamId ? m.team_b : m.team_a;
    const l = openLobby(app, s.pid, teamId, m.size);
    if (l.status === 'eslesti') fail('BASLADI', 'Yarışınız zaten başladı.');
    const inc = st(app).incoming.get(teamId)?.get(rival);
    // karşı takım zaten rövanş istediyse: davet yerine kabul
    if (inc && inc.until > app.now() && st(app).lobbies.get(rival)?.outgoing?.teamId === teamId) {
      if (readyOnline(app, l).length >= R.minPlayers && readyOnline(app, st(app).lobbies.get(rival)!).length >= R.minPlayers) { startMatch(app, st(app).lobbies.get(rival)!, l, true); return { lobby: lobbyView(app, l) }; }
    } else sendChallenge(app, s.pid, l, rival);
    push(app, teamId);
    return { lobby: lobbyView(app, l) };
  },
  'trace.result': (app, _s, { matchId }) => {
    const r = app.db.get<{ result: string | null }>('SELECT result FROM tr_match WHERE id = ?', matchId);
    return { result: r?.result ? parseJson<TeamRaceResult | null>(r.result, null) : null };
  },
  'trace.react': (app, s, { emoji }) => {
    if (!(TEAM_RACE_REACTIONS as readonly string[]).includes(emoji)) fail('GECERSIZ', 'Bu tepki yok.');
    const live = activeMatch(app, requireTeamId(app, s.pid));
    const room = live ? raceRoomView(app, live.race_id) : null;
    const me = room?.players.find((p) => p.id === s.pid && !p.left);
    if (!room || !me || room.status === 'bitti') fail('YOK', 'Süren bir takım yarışında değilsin.');
    const t = Date.now(); if (t - (st(app).lastReact.get(s.pid) ?? 0) < 1500) return {};
    st(app).lastReact.set(s.pid, t);
    const name = app.player(s.pid).name;
    for (const p of room.players) if (p.side === me.side && !p.left && p.id !== s.pid) app.emit(p.id, 'trace.reaction', { from: s.pid, name, emoji, side: me.side ?? 'a' });
    return {};
  },
  'tlig.state': (app, s) => ({ state: leagueState(app, requireTeamId(app, s.pid)) }),
};
