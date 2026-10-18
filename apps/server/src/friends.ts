import {
  FRIEND_LIMITS, type FriendRequest, type FriendSuggestion, type ProfileCard, type Relation, type SearchHit, type SuggestReason,
} from '@odi/shared';
import { fail, parseJson, rid, type App, type Handlers, type PlayerRow } from './app';
import { recentRivalIds } from './race';
import { dayKey, DAY_MS } from './time';

/**
 * Arkadaşlık: istek → kabul. Eski 'friends.add' {code} istek gönderir; iki taraf da birbirine istek attıysa anında arkadaş olurlar.
 * Engelleme her iki yönde isteği, özel mesajı, yarış davetini ve hediyeyi keser; arkadaşlığı ve bekleyen istekleri siler.
 */

const MUTE_MS = 10 * 60_000;

interface ReqRow { id: string; from_id: string; to_id: string; at: number }

// ------------------------------------------------------------------ yardımcılar (dm.ts ve race.ts de kullanır)
export function areFriends(app: App, a: string, b: string): boolean {
  return !!app.db.get('SELECT 1 AS x FROM friends WHERE a = ? AND b = ?', a, b);
}
/** a, b'yi engelledi mi */
export function hasBlocked(app: App, a: string, b: string): boolean {
  return !!app.db.get('SELECT 1 AS x FROM blocks WHERE a = ? AND b = ?', a, b);
}
/** iki yönden biri engellediyse true */
export function isBlocked(app: App, a: string, b: string): boolean {
  return !!app.db.get('SELECT 1 AS x FROM blocks WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', a, b, b, a);
}
export function sameTeam(app: App, a: PlayerRow, b: PlayerRow): boolean { return !!a.team_id && a.team_id === b.team_id; }

/** Özel mesaj izni: arkadaş ya da aynı takım; engel yok. Dönüş: null = izinli, aksi halde Türkçe neden. */
export function dmBlockReason(app: App, from: string, to: string): string | null {
  if (from === to) return 'Kendine mesaj gönderemezsin.';
  const a = app.playerOrNull(from); const b = app.playerOrNull(to);
  if (!a || !b) return 'Oyuncu bulunamadı.';
  if (hasBlocked(app, from, to)) return 'Bu oyuncuyu engelledin. Mesaj göndermek için önce engeli kaldır.';
  if (hasBlocked(app, to, from)) return 'Bu oyuncuya mesaj gönderilemiyor.';
  if (areFriends(app, from, to) || sameTeam(app, a, b)) return null;
  return 'Özel mesaj yalnızca arkadaşlar ve takım arkadaşları arasında. Önce arkadaşlık isteği gönder.';
}

const friendCount = (app: App, id: string) => app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM friends WHERE a = ?', id)!.n;

function toRequest(app: App, r: ReqRow): FriendRequest {
  return { id: r.id, from: app.publicProfile(app.player(r.from_id)), to: app.publicProfile(app.player(r.to_id)), at: r.at };
}

export function relationOf(app: App, me: string, other: string): { relation: Relation; requestId: string | null } {
  if (me === other) return { relation: 'ben', requestId: null };
  if (hasBlocked(app, me, other)) return { relation: 'engelledin', requestId: null };
  if (areFriends(app, me, other)) return { relation: 'arkadas', requestId: null };
  const out = app.db.get<ReqRow>('SELECT * FROM friend_requests WHERE from_id = ? AND to_id = ?', me, other);
  if (out) return { relation: 'istek-giden', requestId: out.id };
  const inc = app.db.get<ReqRow>('SELECT * FROM friend_requests WHERE from_id = ? AND to_id = ?', other, me);
  if (inc) return { relation: 'istek-gelen', requestId: inc.id };
  return { relation: 'yok', requestId: null };
}

function makeFriends(app: App, a: string, b: string): void {
  if (friendCount(app, a) >= FRIEND_LIMITS.friendsMax) fail('LIMIT', `En çok ${FRIEND_LIMITS.friendsMax} arkadaşın olabilir.`);
  if (friendCount(app, b) >= FRIEND_LIMITS.friendsMax) fail('LIMIT', 'Bu oyuncunun arkadaş listesi dolu.');
  const now = app.now();
  app.db.run('INSERT OR IGNORE INTO friends(a, b, at) VALUES(?, ?, ?)', a, b, now);
  app.db.run('INSERT OR IGNORE INTO friends(a, b, at) VALUES(?, ?, ?)', b, a, now);
  app.db.run('DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)', a, b, b, a);
}

function unfriend(app: App, a: string, b: string): void {
  app.db.run('DELETE FROM friends WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', a, b, b, a);
}

/** isteği gönder (ya da karşı taraftan bekleyen istek varsa kabul et) */
export function requestFriend(app: App, pid: string, other: PlayerRow): { status: 'istek' | 'arkadas'; request: FriendRequest | null } {
  if (other.id === pid) fail('GECERSIZ', 'Kendine arkadaşlık isteği gönderemezsin.');
  if (hasBlocked(app, pid, other.id)) fail('ENGEL', 'Bu oyuncuyu engelledin. İstek göndermek için önce engeli kaldır.');
  if (hasBlocked(app, other.id, pid)) fail('ENGEL', 'Bu oyuncuya istek gönderilemiyor.');
  if (areFriends(app, pid, other.id)) return { status: 'arkadas', request: null };
  const reverse = app.db.get<ReqRow>('SELECT * FROM friend_requests WHERE from_id = ? AND to_id = ?', other.id, pid);
  if (reverse) {
    makeFriends(app, pid, other.id);
    const mine = app.publicProfile(app.player(pid));
    app.emit(other.id, 'friend.accepted', { friend: mine });
    app.emit(other.id, 'friend.updated', { friend: mine });
    return { status: 'arkadas', request: null };
  }
  const have = app.db.get<ReqRow>('SELECT * FROM friend_requests WHERE from_id = ? AND to_id = ?', pid, other.id);
  if (have) return { status: 'istek', request: toRequest(app, have) };
  if (friendCount(app, pid) >= FRIEND_LIMITS.friendsMax) fail('LIMIT', `En çok ${FRIEND_LIMITS.friendsMax} arkadaşın olabilir.`);
  if (friendCount(app, other.id) >= FRIEND_LIMITS.friendsMax) fail('LIMIT', 'Bu oyuncunun arkadaş listesi dolu.');
  const outgoing = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM friend_requests WHERE from_id = ?', pid)!.n;
  if (outgoing >= FRIEND_LIMITS.outgoingMax) fail('LIMIT', 'Çok fazla bekleyen isteğin var; bazılarını iptal et.');
  const day = dayKey(app.now());
  if (app.dailyCount(pid, day, 'friend_req') >= FRIEND_LIMITS.requestsPerDay) fail('LIMIT', `Bugün en çok ${FRIEND_LIMITS.requestsPerDay} arkadaşlık isteği gönderebilirsin. Yarın yine dene!`);
  app.dailyInc(pid, day, 'friend_req');
  const id = rid('q');
  app.db.run('INSERT INTO friend_requests(id, from_id, to_id, at) VALUES(?, ?, ?, ?)', id, pid, other.id, app.now());
  const request = toRequest(app, app.db.get<ReqRow>('SELECT * FROM friend_requests WHERE id = ?', id)!);
  app.emit(other.id, 'friend.request', { request });
  return { status: 'istek', request };
}

function findTarget(app: App, pid: string, q: { code?: string; name?: string; id?: string }): PlayerRow {
  if (q.id) { const p = app.playerOrNull(q.id); if (!p) return fail('YOK', 'Oyuncu bulunamadı.'); return p; }
  if (q.code) {
    const p = app.db.get<PlayerRow>('SELECT * FROM players WHERE friend_code = ?', q.code.trim().toUpperCase());
    if (!p) return fail('YOK', 'Bu arkadaş koduyla bir oyuncu bulunamadı.');
    return p;
  }
  if (q.name) {
    ensureKeyFn(app);
    const key = foldKey(q.name);
    const rows = app.db.all<PlayerRow>('SELECT * FROM players WHERE odi_key(name) = ? AND id != ? LIMIT 3', key, pid);
    if (!rows.length) return fail('YOK', 'Bu isimde bir oyuncu bulunamadı.');
    if (rows.length > 1) return fail('BELIRSIZ', 'Bu isimde birden çok oyuncu var; aramadan seç ya da arkadaş kodunu kullan.');
    return rows[0]!;
  }
  return fail('GECERSIZ', 'Arkadaş kodu, isim ya da oyuncu gerekli.');
}

// ------------------------------------------------------------------ arama anahtarı (Türkçe harf katlama: "ayse" → "Ayşe")
const FOLD: Record<string, string> = { 'ı': 'i', 'i̇': 'i', 'ş': 's', 'ğ': 'g', 'ü': 'u', 'ö': 'o', 'ç': 'c', 'â': 'a', 'î': 'i', 'û': 'u' };
export function foldKey(s: string): string {
  let out = '';
  for (const ch of s.replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr')) out += FOLD[ch] ?? ch;
  return out;
}
const keyReady = new WeakSet<App>();
function ensureKeyFn(app: App): void {
  if (keyReady.has(app)) return;
  app.db.raw.function('odi_key', { deterministic: true }, (v) => foldKey(String(v ?? '')));
  keyReady.add(app);
}
const likeEsc = (s: string) => s.replace(/[%_\\]/g, (c) => '\\' + c);
/** varsayılan isimli ve hiç oynamamış hesaplar aramada/öneride çıkmaz (gerçek, etkin oyuncular) */
const isGhost = (p: PlayerRow) => /^Odi\d{4}$/.test(p.name) && p.stars === 0 && p.xp === 0;

// ------------------------------------------------------------------ şikâyet birikimi (sohbet şikâyetiyle aynı eşik ve süre)
export function addReport(app: App, target: string, reporter: string, msgId: string, reason: string): void {
  const now = app.now();
  app.db.run('INSERT OR IGNORE INTO player_reports(target, reporter, msg_id, reason, at) VALUES(?, ?, ?, ?, ?)', target, reporter, msgId, reason, now);
  const n = app.db.get<{ n: number }>('SELECT COUNT(DISTINCT reporter) AS n FROM player_reports WHERE target = ? AND at > ?', target, now - DAY_MS)!.n;
  if (n >= FRIEND_LIMITS.reportsToMute) app.db.run('UPDATE players SET chat_muted_until = MAX(chat_muted_until, ?) WHERE id = ?', now + MUTE_MS, target);
}

function setMuted(app: App, pid: string, other: string, on: boolean): void {
  const list = new Set(parseJson<string[]>(app.player(pid).muted, []));
  if (on) list.add(other); else list.delete(other);
  app.db.run('UPDATE players SET muted = ? WHERE id = ?', JSON.stringify([...list].slice(-500)), pid);
}

const blockedIds = (app: App, pid: string) => app.db.all<{ b: string }>('SELECT b FROM blocks WHERE a = ? ORDER BY at', pid).map((r) => r.b);
/** pid'in görmemesi gerekenler: engelledikleri + onu engelleyenler */
function hiddenFor(app: App, pid: string): Set<string> {
  return new Set(app.db.all<{ id: string }>('SELECT b AS id FROM blocks WHERE a = ? UNION SELECT a AS id FROM blocks WHERE b = ?', pid, pid).map((r) => r.id));
}

export const friendHandlers: Handlers = {
  'friends.list': (app, s) => {
    const rows = app.db.all<PlayerRow>('SELECT p.* FROM friends f JOIN players p ON p.id = f.b WHERE f.a = ? ORDER BY f.at', s.pid);
    const friends = rows.map((r) => app.publicProfile(r));
    friends.sort((a, b) => Number(b.online) - Number(a.online));
    const gifted = app.db.all<{ to_id: string }>('SELECT to_id FROM friend_gifts WHERE day = ? AND from_id = ?', dayKey(app.now()), s.pid).map((r) => r.to_id);
    return { friends, gifted };
  },
  'friends.add': (app, s, { code }) => {
    const other = findTarget(app, s.pid, { code });
    const r = requestFriend(app, s.pid, other);
    return { friend: app.publicProfile(app.player(other.id)), status: r.status };
  },
  'friends.request': (app, s, q) => {
    const other = findTarget(app, s.pid, q);
    const r = requestFriend(app, s.pid, other);
    return { ...r, friend: app.publicProfile(app.player(other.id)) };
  },
  'friends.respond': (app, s, { requestId, accept }) => {
    const r = app.db.get<ReqRow>('SELECT * FROM friend_requests WHERE id = ?', requestId);
    if (!r || r.to_id !== s.pid) return fail('YOK', 'Arkadaşlık isteği bulunamadı.');
    if (!accept) {
      const request = toRequest(app, r);
      app.db.run('DELETE FROM friend_requests WHERE id = ?', r.id);
      app.emit(r.from_id, 'friend.request', { request, removed: true });
      return { friend: null };
    }
    makeFriends(app, s.pid, r.from_id);
    const mine = app.publicProfile(app.player(s.pid));
    app.emit(r.from_id, 'friend.accepted', { friend: mine });
    app.emit(r.from_id, 'friend.updated', { friend: mine });
    return { friend: app.publicProfile(app.player(r.from_id)) };
  },
  'friends.requests': (app, s) => {
    const inc = app.db.all<ReqRow>('SELECT * FROM friend_requests WHERE to_id = ? ORDER BY at DESC LIMIT 200', s.pid);
    const out = app.db.all<ReqRow>('SELECT * FROM friend_requests WHERE from_id = ? ORDER BY at DESC LIMIT 200', s.pid);
    return { incoming: inc.map((r) => toRequest(app, r)), outgoing: out.map((r) => toRequest(app, r)) };
  },
  'friends.cancel': (app, s, { requestId }) => {
    const r = app.db.get<ReqRow>('SELECT * FROM friend_requests WHERE id = ?', requestId);
    if (!r || r.from_id !== s.pid) return fail('YOK', 'Arkadaşlık isteği bulunamadı.');
    const request = toRequest(app, r);
    app.db.run('DELETE FROM friend_requests WHERE id = ?', r.id);
    app.emit(r.to_id, 'friend.request', { request, removed: true });
    return {};
  },
  'friends.remove': (app, s, { id }) => {
    const was = areFriends(app, s.pid, id);
    unfriend(app, s.pid, id);
    if (was) app.emit(id, 'friend.removed', { id: s.pid });
    return {};
  },
  'friends.gift': (app, s, { id }) => {
    if (!areFriends(app, s.pid, id)) fail('YETKI', 'Hediye yalnızca arkadaşlara gönderilebilir.');
    if (isBlocked(app, s.pid, id)) fail('ENGEL', 'Bu oyuncuya hediye gönderilemiyor.');
    const now = app.now(); const day = dayKey(now);
    if (app.db.get('SELECT 1 AS x FROM friend_gifts WHERE day = ? AND from_id = ? AND to_id = ?', day, s.pid, id)) fail('TEKRAR', 'Bugün bu arkadaşına zaten hediye gönderdin. Yarın yine gönderebilirsin.');
    const sent = app.dailyCount(s.pid, day, 'friend_gift');
    if (sent >= FRIEND_LIMITS.giftsPerDay) fail('LIMIT', `Günde en çok ${FRIEND_LIMITS.giftsPerDay} arkadaş hediyesi gönderebilirsin.`);
    app.db.run('INSERT INTO friend_gifts(day, from_id, to_id, at) VALUES(?, ?, ?, ?)', day, s.pid, id, now);
    app.dailyInc(s.pid, day, 'friend_gift');
    const me = app.player(s.pid);
    app.addInbox(id, { kind: 'jeton', amount: FRIEND_LIMITS.giftJeton, ref: 'arkadas' }, `🎁 ${me.name} sana arkadaş hediyesi gönderdi`);
    app.emit(id, 'friend.gift', { from: app.publicProfile(me), amount: FRIEND_LIMITS.giftJeton });
    app.addCurrency(s.pid, 'jeton', FRIEND_LIMITS.giftThanksJeton);
    return { wallet: app.walletChanged(s.pid), thanks: FRIEND_LIMITS.giftThanksJeton, left: FRIEND_LIMITS.giftsPerDay - sent - 1 };
  },
  'friends.suggest': (app, s) => {
    const me = app.player(s.pid);
    const skip = hiddenFor(app, s.pid);
    skip.add(s.pid);
    for (const r of app.db.all<{ b: string }>('SELECT b FROM friends WHERE a = ?', s.pid)) skip.add(r.b);
    for (const r of app.db.all<{ id: string }>('SELECT to_id AS id FROM friend_requests WHERE from_id = ? UNION SELECT from_id AS id FROM friend_requests WHERE to_id = ?', s.pid, s.pid)) skip.add(r.id);
    const out: FriendSuggestion[] = [];
    const push = (id: string, kind: SuggestReason, reason: string) => {
      if (skip.has(id) || out.length >= FRIEND_LIMITS.suggestMax) return;
      const p = app.playerOrNull(id); if (!p || isGhost(p)) return;
      skip.add(id); out.push({ profile: app.publicProfile(p), kind, reason });
    };
    if (me.team_id) for (const id of app.teamMemberIds(me.team_id)) push(id, 'takim', 'Takım arkadaşın');
    for (const id of recentRivalIds(app, s.pid)) push(id, 'yaris', 'Seninle yarıştı');
    const mutual = app.db.all<{ id: string; n: number }>(
      'SELECT f2.b AS id, COUNT(*) AS n FROM friends f1 JOIN friends f2 ON f2.a = f1.b WHERE f1.a = ? AND f2.b != ? GROUP BY f2.b ORDER BY n DESC LIMIT 30', s.pid, s.pid);
    for (const m of mutual.slice(0, 8)) push(m.id, 'ortak', m.n === 1 ? '1 ortak arkadaşınız var' : `${m.n} ortak arkadaşınız var`);
    const lg = app.db.get<{ group_id: string }>('SELECT group_id FROM league WHERE week = ? AND player_id = ?', app.week().key, s.pid);
    if (lg) {
      const rows = app.db.all<{ player_id: string }>('SELECT player_id FROM league WHERE group_id = ? AND player_id != ? ORDER BY points DESC LIMIT 30', lg.group_id, s.pid);
      let n = 0;
      for (const r of rows) { if (n >= 6) break; const before = out.length; push(r.player_id, 'lig', 'Aynı ligdesiniz'); if (out.length > before) n++; }
    }
    // çevrimiçi olanlar kendi sebep grubunda öne
    const order: Record<SuggestReason, number> = { takim: 0, yaris: 1, ortak: 2, lig: 3 };
    out.sort((a, b) => order[a.kind] - order[b.kind] || Number(b.profile.online) - Number(a.profile.online));
    return { suggestions: out };
  },
  'players.search': (app, s, { query, page }) => {
    const raw = query.replace(/\s+/g, ' ').trim();
    if ([...raw].length < FRIEND_LIMITS.searchMin) fail('KISA', `Aramak için en az ${FRIEND_LIMITS.searchMin} harf yaz.`);
    ensureKeyFn(app);
    const key = foldKey(raw);
    const pg = Math.max(0, page ?? 0);
    const per = FRIEND_LIMITS.searchPage;
    const code = /^[A-Za-z0-9]{6}$/.test(raw) ? raw.toUpperCase() : '';
    const rows = app.db.all<PlayerRow>(
      `SELECT * FROM players WHERE id != ? AND (odi_key(name) LIKE ? ESCAPE '\\' OR friend_code = ?)
         AND id NOT IN (SELECT b FROM blocks WHERE a = ?) AND id NOT IN (SELECT a FROM blocks WHERE b = ?)
         AND NOT (name GLOB 'Odi[0-9][0-9][0-9][0-9]' AND stars = 0 AND xp = 0)
       ORDER BY (friend_code = ?) DESC, (odi_key(name) = ?) DESC, (odi_key(name) LIKE ? ESCAPE '\\') DESC, stars DESC, last_seen DESC
       LIMIT ? OFFSET ?`,
      s.pid, `%${likeEsc(key)}%`, code, s.pid, s.pid, code, key, `${likeEsc(key)}%`, per + 1, pg * per);
    const hasMore = rows.length > per;
    const players: SearchHit[] = rows.slice(0, per).map((p) => ({ profile: app.publicProfile(p), relation: relationOf(app, s.pid, p.id).relation }));
    return { players, hasMore };
  },
  'players.block': (app, s, { id }) => {
    if (id === s.pid) fail('GECERSIZ', 'Kendini engelleyemezsin.');
    if (!app.playerOrNull(id)) fail('YOK', 'Oyuncu bulunamadı.');
    if (blockedIds(app, s.pid).length >= 500) fail('LIMIT', 'Engel listesi dolu.');
    const wasFriend = areFriends(app, s.pid, id);
    app.db.run('INSERT OR IGNORE INTO blocks(a, b, at) VALUES(?, ?, ?)', s.pid, id, app.now());
    unfriend(app, s.pid, id);
    const reqs = app.db.all<ReqRow>('SELECT * FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)', s.pid, id, id, s.pid);
    for (const r of reqs) { const request = toRequest(app, r); app.db.run('DELETE FROM friend_requests WHERE id = ?', r.id); app.emit(r.from_id === s.pid ? id : s.pid, 'friend.request', { request, removed: true }); }
    setMuted(app, s.pid, id, true);
    if (wasFriend) app.emit(id, 'friend.removed', { id: s.pid });
    return { blocked: blockedIds(app, s.pid) };
  },
  'players.unblock': (app, s, { id }) => {
    app.db.run('DELETE FROM blocks WHERE a = ? AND b = ?', s.pid, id);
    setMuted(app, s.pid, id, false);
    return { blocked: blockedIds(app, s.pid) };
  },
  'players.blocked': (app, s) => {
    const rows = app.db.all<PlayerRow>('SELECT p.* FROM blocks k JOIN players p ON p.id = k.b WHERE k.a = ? ORDER BY k.at DESC', s.pid);
    return { players: rows.map((p) => app.publicProfile(p)) };
  },
  'players.report': (app, s, { id, reason }) => {
    if (id === s.pid) fail('GECERSIZ', 'Kendini şikâyet edemezsin.');
    if (!app.playerOrNull(id)) fail('YOK', 'Oyuncu bulunamadı.');
    addReport(app, id, s.pid, '', reason);
    return {};
  },
  'profile.card': (app, s, { id }) => {
    const p = app.playerOrNull(id);
    if (!p) return fail('YOK', 'Oyuncu bulunamadı.');
    if (id !== s.pid && hasBlocked(app, id, s.pid)) {
      // seni engelleyen kişinin kartı: yalnızca herkese açık profil, hiçbir eylem yok
      const card: ProfileCard = { profile: app.publicProfile(p), relation: 'yok', requestId: null, friendCount: 0, mutualFriends: 0, sameTeam: false, canMessage: false, giftedToday: false };
      return { card };
    }
    const me = app.player(s.pid);
    const rel = relationOf(app, s.pid, id);
    const mutual = id === s.pid ? 0 : app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM friends f1 JOIN friends f2 ON f2.b = f1.b WHERE f1.a = ? AND f2.a = ?', s.pid, id)!.n;
    const card: ProfileCard = {
      profile: app.publicProfile(p), relation: rel.relation, requestId: rel.requestId, friendCount: friendCount(app, id), mutualFriends: mutual,
      sameTeam: id !== s.pid && sameTeam(app, me, p), canMessage: id !== s.pid && dmBlockReason(app, s.pid, id) === null,
      giftedToday: !!app.db.get('SELECT 1 AS x FROM friend_gifts WHERE day = ? AND from_id = ? AND to_id = ?', dayKey(app.now()), s.pid, id),
    };
    return { card };
  },
};

