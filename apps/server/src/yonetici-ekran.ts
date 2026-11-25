/**
 * Yönetici ekranı (1.1.0): Profil › Admin. Yalnız yönetici olarak işaretli hesap (player_flags.admin; Kod Gir'e yönetici kodu)
 * kullanır; "her şey açık" oynama modu (admin_on) gerekmez. Oyunculara görünmez.
 * - Oyuncular: tüm (silinmemiş) hesaplar son bağlantıya göre; ad / arkadaş koduyla arama; ayrıntı.
 * - Mesajlar: bir oyuncunun özel mesajları (iki yön) ve sohbet / takım sohbeti iletileri ya da herkesin son iletileri; şikâyetler.
 * - Fotoğraflar: yeni ve şikâyet edilen profil fotoğrafları; sil, geri aç. Susturma (sohbet + özel mesaj, gün).
 * - Hediye: tek oyuncuya (arkadaş koduyla) ya da herkese ödül kutusuna jeton / kristal / kalkan.
 * Yanıtlar sayfalıdır (ADMIN_PAGE); her yönetim eylemi promo_log'a (ip 'panel') yazılır.
 */
import { ADMIN_PAGE, levelFromXp, type AdminMessage, type AdminPhoto, type AdminPlayerDetail, type AdminPlayerRow, type AdminReport, type LeagueTier, type TeamRole } from '@odi/shared';
import { fail, type App, type Handlers, type Session } from './app';
import { requireAdmin } from './codes';
import { deletePhoto, announcePhoto } from './foto';
import { badgeFields } from './rozet';
import { DAY_MS } from './time';

const NOT_DELETED = 'p.id NOT IN (SELECT player_id FROM deleted_players)';
const likeEsc = (s: string) => s.replace(/[%_\\]/g, (c) => '\\' + c);

interface PRow {
  id: string; name: string; color: number; friend_code: string; highest: number; stars: number; xp: number; jeton: number; kristal: number; shields: number;
  tname: string | null; created_at: number; last_seen: number; chat_muted_until: number; photo: number | null; admin: number | null;
}
const P_SELECT = `SELECT p.id, p.name, p.color, p.friend_code, p.highest, p.stars, p.xp, p.jeton, p.kristal, p.shields, t.name AS tname, p.created_at, p.last_seen,
  p.chat_muted_until, ph.version AS photo, f.admin
  FROM players p LEFT JOIN teams t ON t.id = p.team_id LEFT JOIN player_photos ph ON ph.player_id = p.id LEFT JOIN player_flags f ON f.player_id = p.id`;

function toRow(app: App, r: PRow): AdminPlayerRow {
  const online = app.online.has(r.id);
  return {
    id: r.id, name: r.name, color: r.color, friendCode: r.friend_code, highest: r.highest, stars: r.stars, level: levelFromXp(r.xp),
    jeton: r.jeton, kristal: r.kristal, kalkan: r.shields, teamName: r.tname, createdAt: r.created_at,
    lastSeen: online ? app.now() : r.last_seen, online, mutedUntil: r.chat_muted_until,
    ...(r.photo ? { photo: r.photo } : {}), ...(r.admin ? { admin: true } : {}),
  };
}

const logAdmin = (app: App, s: Session, what: string) =>
  app.db.run('INSERT INTO promo_log(at, player_id, ip, code, result) VALUES(?, ?, ?, ?, ?)', app.now(), s.pid, 'panel', '', what.slice(0, 200));

const nameOf = (app: App, id: string) => (id === 'sistem' ? 'Sistem' : app.db.get<{ name: string }>('SELECT name FROM players WHERE id = ?', id)?.name ?? '?');

/** şikâyet satırını oku: türü ve (varsa) iletinin metni */
function reportView(app: App, r: { target: string; reporter: string; msg_id: string; reason: string; at: number }): AdminReport {
  const t = app.db.get<{ name: string; friend_code: string }>('SELECT name, friend_code FROM players WHERE id = ?', r.target);
  let kind: AdminReport['kind'] = 'oyuncu'; let text: string | undefined;
  if (r.msg_id.startsWith('foto:')) kind = 'foto';
  else if (r.msg_id) {
    const dm = app.db.get<{ text: string }>('SELECT text FROM dm WHERE id = ?', r.msg_id);
    if (dm) { kind = 'dm'; text = dm.text; } else {
      const c = app.db.get<{ text: string }>('SELECT text FROM chat WHERE id = ?', r.msg_id);
      kind = 'sohbet'; text = c?.text;
    }
  }
  return {
    targetId: r.target, targetName: t?.name ?? '?', targetCode: t?.friend_code ?? '?', reporterName: nameOf(app, r.reporter), reason: r.reason, at: r.at,
    kind, msgId: r.msg_id, ...(text !== undefined ? { text } : {}),
  };
}

/** player_reports + chat_reports birlikte, yeniden eskiye */
const REPORTS_SQL = `SELECT target, reporter, msg_id, reason, at FROM player_reports
  UNION ALL SELECT c.from_id AS target, r.reporter, r.msg_id, 'sohbet' AS reason, r.at FROM chat_reports r JOIN chat c ON c.id = r.msg_id`;

function roomName(app: App, room: string): string {
  if (room.startsWith('takim:')) return `Takım: ${app.db.get<{ name: string }>('SELECT name FROM teams WHERE id = ?', room.slice(6))?.name ?? 'silinmiş takım'}`;
  return room === 'genel' ? 'Genel sohbet' : room;
}

interface DmRow { id: string; from_id: string; to_id: string; text: string; kind: string; at: number; deleted: number }
interface ChatRow { id: string; room: string; from_id: string; name: string; text: string; kind: string; at: number; hidden: number }

function messagesOf(app: App, id: string | undefined, kind: 'hepsi' | 'dm' | 'sohbet', before: number): { messages: AdminMessage[]; hasMore: boolean } {
  const lim = ADMIN_PAGE + 1;
  const dms = kind === 'sohbet' ? [] : id
    ? app.db.all<DmRow>('SELECT id, from_id, to_id, text, kind, at, deleted FROM dm WHERE (from_id = ? OR to_id = ?) AND at < ? ORDER BY at DESC, seq DESC LIMIT ?', id, id, before, lim)
    : app.db.all<DmRow>('SELECT id, from_id, to_id, text, kind, at, deleted FROM dm WHERE at < ? ORDER BY at DESC, seq DESC LIMIT ?', before, lim);
  // sohbet: oyuncunun yazdıkları (sistem kartları ve akış kartları hariç)
  const chats = kind === 'dm' ? [] : id
    ? app.db.all<ChatRow>("SELECT id, room, from_id, name, text, kind, at, hidden FROM chat WHERE from_id = ? AND at < ? ORDER BY at DESC LIMIT ?", id, before, lim)
    : app.db.all<ChatRow>("SELECT id, room, from_id, name, text, kind, at, hidden FROM chat WHERE from_id <> 'sistem' AND at < ? ORDER BY at DESC LIMIT ?", before, lim);
  const names = new Map<string, string>();
  const nm = (pid: string) => { let n = names.get(pid); if (n === undefined) { n = nameOf(app, pid); names.set(pid, n); } return n; };
  const all: AdminMessage[] = [
    ...dms.map((d): AdminMessage => ({ id: d.id, kind: 'dm', at: d.at, text: d.kind === 'text' || d.kind === 'hazir' || d.kind === 'emoji' ? d.text : `[${d.kind}] ${d.text}`,
      fromId: d.from_id, fromName: nm(d.from_id), toId: d.to_id, toName: nm(d.to_id), ...(d.deleted ? { deleted: true } : {}) })),
    ...chats.map((c): AdminMessage => ({ id: c.id, kind: c.room.startsWith('takim:') ? 'takim' : 'sohbet', at: c.at, text: c.text, fromId: c.from_id, fromName: nm(c.from_id),
      room: roomName(app, c.room), ...(c.hidden ? { hidden: true } : {}) })),
  ].sort((a, b) => b.at - a.at);
  return { messages: all.slice(0, ADMIN_PAGE), hasMore: all.length > ADMIN_PAGE };
}

function playerDetail(app: App, id: string): AdminPlayerDetail {
  const r = app.db.get<PRow>(`${P_SELECT} WHERE p.id = ? AND ${NOT_DELETED}`, id);
  if (!r) fail('YOK', 'Oyuncu bulunamadı.');
  const p = app.player(id);
  const lv = app.db.get<{ n: number; three: number }>('SELECT COUNT(*) AS n, SUM(CASE WHEN stars >= 3 THEN 1 ELSE 0 END) AS three FROM level_best WHERE player_id = ? AND stars > 0', id)!;
  const recent = app.db.all<{ level: number; stars: number; score: number }>('SELECT level, stars, score FROM level_best WHERE player_id = ? ORDER BY level DESC LIMIT 10', id);
  const flags = app.db.get<{ admin: number; admin_on: number }>('SELECT admin, admin_on FROM player_flags WHERE player_id = ?', id);
  const cnt = (sql: string, ...a: string[]) => app.db.get<{ n: number }>(sql, ...a)!.n;
  const against = app.db.all<{ target: string; reporter: string; msg_id: string; reason: string; at: number }>(
    `SELECT * FROM (${REPORTS_SQL}) WHERE target = ? ORDER BY at DESC LIMIT 20`, id);
  const photo = app.db.get<{ hidden: number }>('SELECT hidden FROM player_photos WHERE player_id = ?', id);
  let cosmetics = 0; let cards = 0;
  try { cosmetics = (JSON.parse(p.cosmetics) as unknown[]).length; } catch { /* boş */ }
  try { cards = Object.keys(JSON.parse(p.cards) as object).length; } catch { /* boş */ }
  return {
    ...toRow(app, r), xp: p.xp, hat: p.hat, league: p.league_tier as LeagueTier, teamRole: (p.team_role ?? null) as TeamRole | null,
    hizlandirici: { m5: p.m5, m60: p.m60, s8: p.s8 }, cosmetics, cards,
    levels: { cleared: lv.n, threeStars: lv.three ?? 0, recent },
    badges: badgeFields(app, id).rozetler ?? [], adminOn: !!flags?.admin && !!flags.admin_on,
    friends: cnt('SELECT COUNT(*) AS n FROM friends WHERE a = ?', id),
    dmCount: cnt('SELECT COUNT(*) AS n FROM dm WHERE from_id = ?', id),
    chatCount: cnt('SELECT COUNT(*) AS n FROM chat WHERE from_id = ?', id),
    purchases: cnt('SELECT COUNT(*) AS n FROM purchases WHERE player_id = ?', id),
    reportsAgainst: against.map((x) => reportView(app, x)),
    reportsBy: cnt('SELECT COUNT(*) AS n FROM player_reports WHERE reporter = ?', id) + cnt('SELECT COUNT(*) AS n FROM chat_reports WHERE reporter = ?', id),
    ...(photo?.hidden ? { photoHidden: true } : {}),
  };
}

/** hediye: tek oyuncu ya da herkes (tek INSERT … SELECT); çevrimiçi olanlara ödül kutusu bildirimi */
function gift(app: App, s: Session, d: { code?: string; all?: boolean; jeton?: number; kristal?: number; kalkan?: number; note?: string }): number {
  const parts = ([['jeton', d.jeton], ['kristal', d.kristal], ['kalkan', d.kalkan]] as const).filter(([, n]) => (n ?? 0) > 0) as [string, number][];
  if (!parts.length) fail('GECERSIZ', 'En az bir ödül gir.');
  const reason = (d.note?.trim() || "ODİ'den hediye").slice(0, 60);
  const at = app.now();
  if (!d.all) {
    const code = (d.code ?? '').trim().toUpperCase();
    const p = app.db.get<{ id: string }>(`SELECT p.id FROM players p WHERE p.friend_code = ? AND ${NOT_DELETED}`, code);
    if (!p) fail('YOK', 'Bu arkadaş koduyla oyuncu yok.');
    for (const [kind, amount] of parts) app.addInbox(p.id, { kind: kind as 'jeton', amount, ref: 'hediye' }, reason, at);
    logAdmin(app, s, `hediye:${code}:${parts.map(([k, n]) => `${k}=${n}`).join(',')}`);
    return 1;
  }
  let count = 0;
  for (const [kind, amount] of parts) {
    count = app.db.run(`INSERT INTO inbox(id, player_id, kind, amount, ref, reason, at)
      SELECT 'i' || lower(hex(randomblob(8))), p.id, ?, ?, 'hediye', ?, ? FROM players p WHERE ${NOT_DELETED}`, kind, amount, reason, at);
  }
  // çevrimiçi olanlar ödül kutusu rozetini hemen görsün
  for (const pid of app.online.keys()) {
    for (const it of app.db.all<{ id: string; kind: 'jeton'; amount: number; ref: string; reason: string; at: number }>(
      "SELECT id, kind, amount, ref, reason, at FROM inbox WHERE player_id = ? AND ref = 'hediye' AND at = ? AND claimed = 0", pid, at)) app.emit(pid, 'inbox.new', { item: { ...it } });
  }
  logAdmin(app, s, `hediye:hepsi:${count}:${parts.map(([k, n]) => `${k}=${n}`).join(',')}`);
  return count;
}

export const adminScreenHandlers: Handlers = {
  'admin.players': (app, s, { query, offset = 0 }) => {
    requireAdmin(app, s);
    const q = (query ?? '').trim();
    const where = q ? `${NOT_DELETED} AND (p.name LIKE ? ESCAPE '\\' OR p.friend_code = ?)` : NOT_DELETED;
    const args = q ? [`%${likeEsc(q)}%`, q.toUpperCase()] : [];
    const total = app.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM players p WHERE ${where}`, ...args)!.n;
    // çevrimiçi olanlar önce (son bağlantı çevrimiçiyken eski kalır), sonra son bağlantı
    const online = [...app.online.keys()];
    const onl = online.length ? `CASE WHEN p.id IN (${online.map(() => '?').join(',')}) THEN 1 ELSE 0 END DESC, ` : '';
    const rows = app.db.all<PRow>(`${P_SELECT} WHERE ${where} ORDER BY ${onl}p.last_seen DESC LIMIT ? OFFSET ?`, ...args, ...online, ADMIN_PAGE, offset);
    return { players: rows.map((r) => toRow(app, r)), total, hasMore: offset + rows.length < total };
  },
  'admin.player': (app, s, { id }) => { requireAdmin(app, s); return { player: playerDetail(app, id) }; },
  'admin.messages': (app, s, { id, kind = 'hepsi', before }) => {
    requireAdmin(app, s);
    return messagesOf(app, id, kind, before ?? Number.MAX_SAFE_INTEGER);
  },
  'admin.reports': (app, s, { before }) => {
    requireAdmin(app, s);
    const rows = app.db.all<{ target: string; reporter: string; msg_id: string; reason: string; at: number }>(
      `SELECT * FROM (${REPORTS_SQL}) WHERE at < ? ORDER BY at DESC LIMIT ?`, before ?? Number.MAX_SAFE_INTEGER, ADMIN_PAGE + 1);
    return { reports: rows.slice(0, ADMIN_PAGE).map((r) => reportView(app, r)), hasMore: rows.length > ADMIN_PAGE };
  },
  'admin.photos': (app, s, { filter = 'yeni', before }) => {
    requireAdmin(app, s);
    const reports = "(SELECT COUNT(DISTINCT reporter) FROM player_reports r WHERE r.target = ph.player_id AND r.msg_id = 'foto:' || ph.version)";
    const rows = app.db.all<{ player_id: string; name: string; friend_code: string; version: number; at: number; bytes: number; hidden: number; reports: number }>(
      `SELECT ph.player_id, p.name, p.friend_code, ph.version, ph.at, ph.bytes, ph.hidden, ${reports} AS reports
       FROM player_photos ph JOIN players p ON p.id = ph.player_id WHERE ph.at < ? ${filter === 'sikayet' ? `AND (ph.hidden = 1 OR ${reports} > 0)` : ''}
       ORDER BY ph.at DESC LIMIT ?`, before ?? Number.MAX_SAFE_INTEGER, ADMIN_PAGE + 1);
    const photos = rows.slice(0, ADMIN_PAGE).map((r): AdminPhoto => ({ id: r.player_id, name: r.name, friendCode: r.friend_code, v: r.version, at: r.at, bytes: r.bytes, hidden: !!r.hidden, reports: r.reports }));
    return { photos, hasMore: rows.length > ADMIN_PAGE };
  },
  'admin.photo.delete': (app, s, { id }) => {
    requireAdmin(app, s);
    if (!deletePhoto(app, id)) fail('YOK', 'Fotoğraf yok.');
    logAdmin(app, s, `foto-sil:${id}`);
    return {};
  },
  'admin.photo.show': (app, s, { id }) => {
    requireAdmin(app, s);
    if (!app.db.run('UPDATE player_photos SET hidden = 0 WHERE player_id = ?', id)) fail('YOK', 'Fotoğraf yok.');
    // şikâyetler bu sürüm için yeniden sayılmasın: kayıtlar silinir (yönetici baktı)
    const v = app.db.get<{ version: number }>('SELECT version FROM player_photos WHERE player_id = ?', id)!.version;
    app.db.run('DELETE FROM player_reports WHERE target = ? AND msg_id = ?', id, `foto:${v}`);
    logAdmin(app, s, `foto-ac:${id}`);
    app.after(() => announcePhoto(app, id));
    return {};
  },
  'admin.photo.data': (app, s, { id }) => {
    requireAdmin(app, s);
    const r = app.db.get<{ jpeg: Uint8Array }>('SELECT jpeg FROM player_photos WHERE player_id = ?', id);
    if (!r) fail('YOK', 'Fotoğraf yok.');
    return { data: `data:image/jpeg;base64,${Buffer.from(r.jpeg).toString('base64')}` };
  },
  'admin.mute': (app, s, { id, days }) => {
    requireAdmin(app, s);
    if (!app.db.get(`SELECT 1 AS x FROM players p WHERE p.id = ? AND ${NOT_DELETED}`, id)) fail('YOK', 'Oyuncu bulunamadı.');
    const until = days > 0 ? app.now() + days * DAY_MS : 0;
    app.db.run('UPDATE players SET chat_muted_until = ? WHERE id = ?', until, id);
    logAdmin(app, s, `sustur:${id}:${days}`);
    return { mutedUntil: until };
  },
  'admin.gift': (app, s, d) => { requireAdmin(app, s); return { count: gift(app, s, d) }; },
};
