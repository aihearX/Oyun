import { DM_REACTIONS, DM_STICKERS, FRIEND_LIMITS, phraseById, type DmKind, type DmMessage, type DmThread } from '@odi/shared';
import { fail, parseJson, rid, type App, type Conn, type Handlers } from './app';
import { addReport, areFriends, dmBlockReason, hasBlocked } from './friends';
import { maskProfanity } from './profanity';
import { metric, requireFreeText } from './comm/settings';
import { raceMemberIds } from './race';

/**
 * Özel mesaj kutusu (kalıcı, sqlite). Konuşma = iki oyuncu (pair "a:b", a < b). Her konuşmada son 500 mesaj tutulur.
 * İzin: arkadaşlar ve aynı takımdakiler; engel her iki yönde keser (bkz. friends.ts dmBlockReason).
 * Okundu bilgisi konuşma başına "şu sıraya kadar okudum" işaretidir (dm_reads); okunmamış = karşıdan gelen, silinmemiş, işaretten sonraki.
 */

interface DmRow { seq: number; id: string; pair: string; from_id: string; to_id: string; text: string; kind: DmKind; meta: string | null; at: number; deleted: number }

const pairOf = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);
const STICKER_IDS = new Set(DM_STICKERS.map((x) => x.id));
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\ufe0f|\u20e3| )+$/u;
const META_TYPE = /^[a-z]{2,16}$/;
const ROOM_ID = /^[A-Za-z0-9]{1,40}$/;

/** son DM zamanı (hız sınırı) ve son "yazıyor" iletimi — yalnızca bellekte */
const lastSend = new WeakMap<App, Map<string, number>>();
const lastTyping = new WeakMap<Conn, number>();

function toMsg(r: DmRow, reactions?: Record<string, string>): DmMessage {
  const m: DmMessage = { id: r.id, seq: r.seq, from: r.from_id, to: r.to_id, text: r.deleted ? '' : r.text, kind: r.kind, at: r.at };
  if (r.deleted) m.deleted = true;
  else if (r.meta) m.meta = parseJson(r.meta, {});
  if (reactions && Object.keys(reactions).length) m.reactions = reactions;
  return m;
}
function reactionsOf(app: App, msgId: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of app.db.all<{ player_id: string; emoji: string }>('SELECT player_id, emoji FROM dm_reactions WHERE msg_id = ?', msgId)) out[r.player_id] = r.emoji;
  return out;
}
const msgById = (app: App, id: string) => app.db.get<DmRow>('SELECT * FROM dm WHERE id = ?', id);
const fullMsg = (app: App, r: DmRow) => toMsg(r, reactionsOf(app, r.id));

export function readSeq(app: App, pid: string, other: string): number {
  return app.db.get<{ seq: number }>('SELECT seq FROM dm_reads WHERE player_id = ? AND other_id = ?', pid, other)?.seq ?? 0;
}
/** toplam okunmamış (engellediklerimden gelenler sayılmaz) */
export function unreadTotal(app: App, pid: string): number {
  return app.db.get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM dm d LEFT JOIN dm_reads r ON r.player_id = ? AND r.other_id = d.from_id
     WHERE d.to_id = ? AND d.deleted = 0 AND d.seq > COALESCE(r.seq, 0) AND d.from_id NOT IN (SELECT b FROM blocks WHERE a = ?)`, pid, pid, pid)!.n;
}
function unreadWith(app: App, pid: string, other: string): number {
  return app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM dm WHERE pair = ? AND to_id = ? AND deleted = 0 AND seq > ?', pairOf(pid, other), pid, readSeq(app, pid, other))!.n;
}
const pushUnread = (app: App, pid: string) => app.emit(pid, 'dm.unread', { total: unreadTotal(app, pid) });

/** pid, other'dan gelenleri seq'e kadar okudu; karşı tarafa "görüldü" gider */
function markRead(app: App, pid: string, other: string, seq: number): void {
  const cur = readSeq(app, pid, other);
  if (seq <= cur) return;
  app.db.run('INSERT INTO dm_reads(player_id, other_id, seq) VALUES(?, ?, ?) ON CONFLICT(player_id, other_id) DO UPDATE SET seq = excluded.seq', pid, other, seq);
  if (!hasBlocked(app, pid, other)) app.emit(other, 'dm.read', { by: pid, seq });
}

function cleanText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/[ \t\u00a0]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function prune(app: App, pair: string): void {
  const cut = app.db.get<{ seq: number }>('SELECT seq FROM dm WHERE pair = ? ORDER BY seq DESC LIMIT 1 OFFSET ?', pair, FRIEND_LIMITS.dmKeep);
  if (!cut) return;
  app.db.run('DELETE FROM dm_reactions WHERE msg_id IN (SELECT id FROM dm WHERE pair = ? AND seq <= ?)', pair, cut.seq);
  app.db.run('DELETE FROM dm WHERE pair = ? AND seq <= ?', pair, cut.seq);
}

/** konuşmanın bir tarafı mıyım; değilse hata */
function myMsg(app: App, pid: string, msgId: string): DmRow {
  const r = msgById(app, msgId);
  if (!r || (r.from_id !== pid && r.to_id !== pid)) return fail('YOK', 'Mesaj bulunamadı.');
  return r;
}

/** WireFire 'dm.typing': izinli ve karşı taraf çevrimiçiyse 4 sn'lik "yazıyor…" iletilir (bağlantı başına en çok 1/sn) */
export function dmTyping(app: App, conn: Conn, data: unknown): void {
  const pid = conn.pid;
  const to = (data as { to?: unknown } | null)?.to;
  if (!pid || typeof to !== 'string' || !ROOM_ID.test(to) || !app.online.has(to)) return;
  const t = Date.now();
  if (t - (lastTyping.get(conn) ?? 0) < 1000) return;
  lastTyping.set(conn, t);
  try { if (dmBlockReason(app, pid, to)) return; } catch { return; }
  app.emit(to, 'dm.typing', { from: pid, until: app.now() + FRIEND_LIMITS.typingMs });
}

export const dmHandlers: Handlers = {
  'dm.threads': (app, s) => {
    const rows = app.db.all<{ pair: string; seq: number }>(
      'SELECT pair, MAX(seq) AS seq FROM dm WHERE from_id = ? OR to_id = ? GROUP BY pair ORDER BY seq DESC LIMIT 100', s.pid, s.pid);
    const threads: DmThread[] = [];
    for (const r of rows) {
      const [a, b] = r.pair.split(':') as [string, string];
      const otherId = a === s.pid ? b : a;
      if (hasBlocked(app, s.pid, otherId)) continue;
      const other = app.playerOrNull(otherId); if (!other) continue;
      const last = app.db.get<DmRow>('SELECT * FROM dm WHERE seq = ?', r.seq)!;
      threads.push({
        other: app.publicProfile(other), last: toMsg(last), unread: unreadWith(app, s.pid, otherId), at: last.at,
        friend: areFriends(app, s.pid, otherId), canMessage: dmBlockReason(app, s.pid, otherId) === null,
      });
    }
    return { threads, unread: unreadTotal(app, s.pid) };
  },
  'dm.open': (app, s, { id, before }) => {
    const other = app.playerOrNull(id);
    if (!other || id === s.pid) return fail('YOK', 'Oyuncu bulunamadı.');
    const pair = pairOf(s.pid, id);
    const per = FRIEND_LIMITS.dmPage;
    const rows = app.db.all<DmRow>('SELECT * FROM dm WHERE pair = ? AND seq < ? ORDER BY seq DESC LIMIT ?', pair, before ?? Number.MAX_SAFE_INTEGER, per + 1);
    const hasMore = rows.length > per;
    const page = rows.slice(0, per).reverse();
    const reported = new Set(app.db.all<{ msg_id: string }>("SELECT msg_id FROM player_reports WHERE reporter = ? AND target = ? AND msg_id != ''", s.pid, id).map((r) => r.msg_id));
    const reacts = new Map<string, Record<string, string>>();
    if (page.length) {
      for (const r of app.db.all<{ msg_id: string; player_id: string; emoji: string }>(
        'SELECT x.msg_id, x.player_id, x.emoji FROM dm_reactions x JOIN dm d ON d.id = x.msg_id WHERE d.pair = ? AND d.seq BETWEEN ? AND ?', pair, page[0]!.seq, page[page.length - 1]!.seq)) {
        const o = reacts.get(r.msg_id) ?? {}; o[r.player_id] = r.emoji; reacts.set(r.msg_id, o);
      }
    }
    const reason = dmBlockReason(app, s.pid, id);
    return {
      other: app.publicProfile(other), messages: page.filter((r) => !reported.has(r.id)).map((r) => toMsg(r, reacts.get(r.id))), hasMore,
      peerReadSeq: readSeq(app, id, s.pid), myReadSeq: readSeq(app, s.pid, id), canMessage: reason === null, reason,
    };
  },
  'dm.send': (app, s, { to, text, kind = 'text', meta }) => {
    const why = dmBlockReason(app, s.pid, to);
    if (why) fail(why.startsWith('Oyuncu') ? 'YOK' : hasBlocked(app, to, s.pid) || hasBlocked(app, s.pid, to) ? 'ENGEL' : 'YETKI', why);
    const p = app.player(s.pid);
    const now = app.now();
    if (p.chat_muted_until > now) fail('SUSTURULDU', `Şikâyetler nedeniyle ${Math.ceil((p.chat_muted_until - now) / 60_000)} dakika mesaj gönderemezsin.`);
    let times = lastSend.get(app); if (!times) { times = new Map(); lastSend.set(app, times); }
    if (now - (times.get(s.pid) ?? -Infinity) < FRIEND_LIMITS.dmCooldownMs) fail('HIZ', 'Biraz yavaş: mesajlar arasında kısa bir süre beklemelisin.');
    let body = cleanText(text);
    let saveMeta: Record<string, string | number | boolean> | null = null;
    if (!body) fail('GECERSIZ', 'Boş mesaj gönderilemez.');
    if (kind === 'text') {
      if ([...body].length > FRIEND_LIMITS.dmMax) fail('GECERSIZ', `Mesaj en çok ${FRIEND_LIMITS.dmMax} karakter olabilir.`);
      requireFreeText(app, p);
      body = maskProfanity(body).text;
    } else if (kind === 'hazir') {
      // Hızlı Sohbet: kimlikle gelir, metni sunucu yazar (yeni oyuncu için de her zaman açık)
      const ph = phraseById(body);
      if (!ph) fail('GECERSIZ', 'Böyle bir hazır söz yok.');
      saveMeta = { p: ph.id };
      body = ph.text;
    } else if (kind === 'emoji') {
      if (body.length > 32 || !EMOJI_ONLY.test(body)) fail('GECERSIZ', 'Emoji mesajı yalnızca emoji içerebilir.');
    } else if (kind === 'sticker') {
      if (!STICKER_IDS.has(body)) fail('GECERSIZ', 'Böyle bir çıkartma yok.');
    } else if (kind === 'davet') {
      const type = meta?.type; const roomId = meta?.roomId;
      if (typeof type !== 'string' || !META_TYPE.test(type) || typeof roomId !== 'string' || !ROOM_ID.test(roomId)) fail('GECERSIZ', 'Davet bilgisi eksik.');
      if (type === 'yaris' && !raceMemberIds(app, roomId)?.includes(s.pid)) fail('YOK', 'Bu yarış odası artık yok; yeni bir oda kur.');
      if ([...body].length > 120) fail('GECERSIZ', 'Davet metni en çok 120 karakter olabilir.');
      body = maskProfanity(body).text;
      saveMeta = { type, roomId };
      if (typeof meta?.level === 'number' && Number.isInteger(meta.level) && meta.level > 0 && meta.level < 10_000) saveMeta.level = meta.level;
      if (typeof meta?.title === 'string') saveMeta.title = maskProfanity(cleanText(meta.title).slice(0, 40)).text;
    }
    times.set(s.pid, now);
    metric(app, kind === 'hazir' ? 'dm.hazir' : `dm.${kind}`);
    const id = rid('d'); const pair = pairOf(s.pid, to);
    app.db.run('INSERT INTO dm(id, pair, from_id, to_id, text, kind, meta, at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)', id, pair, s.pid, to, body, kind, saveMeta ? JSON.stringify(saveMeta) : null, now);
    const row = msgById(app, id)!;
    prune(app, pair);
    const msg = toMsg(row);
    app.emit(to, 'dm.message', { msg, from: app.publicProfile(p) });
    pushUnread(app, to);
    // yanıt vermek, karşıdan gelenleri okumak demektir
    const lastIn = app.db.get<{ seq: number }>('SELECT MAX(seq) AS seq FROM dm WHERE pair = ? AND to_id = ?', pair, s.pid)?.seq;
    if (lastIn) { markRead(app, s.pid, to, lastIn); pushUnread(app, s.pid); }
    return { msg };
  },
  'dm.read': (app, s, { id, upTo }) => {
    const pair = pairOf(s.pid, id);
    const max = app.db.get<{ seq: number | null }>('SELECT MAX(seq) AS seq FROM dm WHERE pair = ? AND to_id = ?', pair, s.pid)?.seq ?? 0;
    const seq = Math.min(max, upTo ?? max);
    if (seq > 0) markRead(app, s.pid, id, seq);
    const unread = unreadTotal(app, s.pid);
    app.emit(s.pid, 'dm.unread', { total: unread });
    return { unread };
  },
  'dm.react': (app, s, { msgId, emoji }) => {
    const r = myMsg(app, s.pid, msgId);
    if (r.deleted) fail('GECERSIZ', 'Silinmiş mesaja tepki verilemez.');
    const other = r.from_id === s.pid ? r.to_id : r.from_id;
    if (hasBlocked(app, s.pid, other) || hasBlocked(app, other, s.pid)) fail('ENGEL', 'Bu konuşmada tepki verilemiyor.');
    if (emoji && !(DM_REACTIONS as readonly string[]).includes(emoji)) fail('GECERSIZ', 'Bu tepki kullanılamıyor.');
    const cur = app.db.get<{ emoji: string }>('SELECT emoji FROM dm_reactions WHERE msg_id = ? AND player_id = ?', msgId, s.pid)?.emoji;
    if (!emoji || cur === emoji) app.db.run('DELETE FROM dm_reactions WHERE msg_id = ? AND player_id = ?', msgId, s.pid);
    else app.db.run('INSERT INTO dm_reactions(msg_id, player_id, emoji) VALUES(?, ?, ?) ON CONFLICT(msg_id, player_id) DO UPDATE SET emoji = excluded.emoji', msgId, s.pid, emoji);
    const msg = fullMsg(app, r);
    app.emit(other, 'dm.reaction', { msg });
    return { msg };
  },
  'dm.delete': (app, s, { msgId }) => {
    const r = myMsg(app, s.pid, msgId);
    if (r.from_id !== s.pid) fail('YETKI', 'Yalnızca kendi mesajını silebilirsin.');
    if (!r.deleted) {
      app.db.run("UPDATE dm SET deleted = 1, text = '', meta = NULL WHERE id = ?", msgId);
      app.db.run('DELETE FROM dm_reactions WHERE msg_id = ?', msgId);
    }
    const msg = toMsg(msgById(app, msgId)!);
    if (!hasBlocked(app, r.to_id, s.pid)) app.emit(r.to_id, 'dm.message', { msg, from: app.publicProfile(app.player(s.pid)) });
    pushUnread(app, r.to_id);
    return { msg };
  },
  'dm.report': (app, s, { msgId }) => {
    const r = myMsg(app, s.pid, msgId);
    if (r.from_id === s.pid) fail('GECERSIZ', 'Kendi mesajını şikâyet edemezsin.');
    addReport(app, r.from_id, s.pid, r.id, 'dm');
    return {};
  },
};

