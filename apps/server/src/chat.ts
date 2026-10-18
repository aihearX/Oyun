import { SOCIAL_LIMITS, type ChatKind, type ChatMessage } from '@odi/shared';
import { fail, parseJson, rid, type App, type Handlers } from './app';
import { maskProfanity } from './profanity';
import { DAY_MS } from './time';

const MUTE_MS = 10 * 60_000;
const REPORTS_TO_HIDE = 3;
const RETAIN_MS = 30 * DAY_MS;

interface ChatRow { id: string; room: string; from_id: string; name: string; color: number; text: string; kind: ChatKind; at: number; meta: string | null; hidden: number }

const toMsg = (r: ChatRow): ChatMessage => {
  const m: ChatMessage = { id: r.id, room: r.room, from: r.from_id, name: r.name, color: r.color, text: r.text, kind: r.kind, at: r.at };
  if (r.meta) m.meta = parseJson(r.meta, {});
  return m;
};

export const teamRoom = (teamId: string) => `takim:${teamId}`;
export const dmRoom = (a: string, b: string) => (a < b ? `dm:${a}:${b}` : `dm:${b}:${a}`);

export function areFriends(app: App, a: string, b: string): boolean {
  return !!app.db.get('SELECT 1 AS x FROM friends WHERE a = ? AND b = ?', a, b);
}

/** odaya erişim yetkisi yoksa hata fırlatır */
export function checkRoom(app: App, pid: string, room: string): void {
  if (room === 'genel') return;
  const t = /^takim:([A-Za-z0-9]+)$/.exec(room);
  if (t) {
    if (app.player(pid).team_id !== t[1]) fail('YETKI', 'Bu takım sohbetine yalnızca takım üyeleri girebilir.');
    return;
  }
  const d = /^dm:([A-Za-z0-9]+):([A-Za-z0-9]+)$/.exec(room);
  if (d) {
    const [, a, b] = d as unknown as [string, string, string];
    if (!(a < b)) fail('GECERSIZ', 'Özel sohbet odası adı geçersiz.');
    if (pid !== a && pid !== b) fail('YETKI', 'Bu özel sohbete erişimin yok.');
    if (!areFriends(app, a, b)) fail('YETKI', 'Özel mesaj yalnızca arkadaşlar arasında gönderilebilir.');
    return;
  }
  fail('GECERSIZ', 'Böyle bir sohbet odası yok.');
}

/** odadaki mesajı alacak çevrimiçi oyuncular: genel = abone olanlar; takım/özel = tüm çevrimiçi üyeler */
function recipients(app: App, room: string): string[] {
  if (room === 'genel') return [...(app.rooms.get('genel') ?? [])];
  const t = /^takim:(.+)$/.exec(room);
  if (t) return app.teamMemberIds(t[1]!).filter((id) => app.online.has(id));
  const d = /^dm:([^:]+):([^:]+)$/.exec(room);
  if (d) return [d[1]!, d[2]!].filter((id) => app.online.has(id));
  return [];
}

function mutedBy(app: App, pid: string): Set<string> { return new Set(parseJson<string[]>(app.player(pid).muted, [])); }

function broadcast(app: App, msg: ChatMessage): void {
  for (const pid of recipients(app, msg.room)) {
    if (msg.from !== 'sistem' && msg.from !== pid && mutedBy(app, pid).has(msg.from)) continue;
    app.emit(pid, 'chat', { msg });
  }
}

/** sistem mesajı (takıma katılma, yardım, hediye, baskın, savaş…) */
export function systemMessage(app: App, room: string, text: string, kind: ChatKind = 'system', meta?: Record<string, string | number | boolean>): ChatMessage {
  const msg: ChatMessage = { id: rid('m'), room, from: 'sistem', name: 'Sistem', color: 0x7c5cff, text, kind, at: app.now() };
  if (meta) msg.meta = meta;
  app.db.run('INSERT INTO chat(id, room, from_id, name, color, text, kind, at, meta) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)',
    msg.id, room, 'sistem', msg.name, msg.color, text, kind, msg.at, meta ? JSON.stringify(meta) : null);
  broadcast(app, msg);
  return msg;
}

export function history(app: App, pid: string, room: string): ChatMessage[] {
  const muted = mutedBy(app, pid);
  const rows = app.db.all<ChatRow>('SELECT * FROM chat WHERE room = ? AND hidden = 0 ORDER BY at DESC, rowid DESC LIMIT ?', room, SOCIAL_LIMITS.historySize + muted.size * 5);
  return rows.filter((r) => !muted.has(r.from_id)).slice(0, SOCIAL_LIMITS.historySize).reverse().map(toMsg);
}

export function pruneChat(app: App): void { app.db.run('DELETE FROM chat WHERE at < ?', app.now() - RETAIN_MS); }

export const chatHandlers: Handlers = {
  'chat.join': (app, s, { room }) => {
    checkRoom(app, s.pid, room);
    app.subscribe(s.pid, room);
    return { history: history(app, s.pid, room) };
  },
  'chat.leave': (app, s, { room }) => { app.unsubscribe(s.pid, room); return {}; },
  'chat.send': (app, s, { room, text, kind }) => {
    checkRoom(app, s.pid, room);
    const p = app.player(s.pid);
    const now = app.now();
    if (p.chat_muted_until > now) fail('SUSTURULDU', `Şikâyetler nedeniyle ${Math.ceil((p.chat_muted_until - now) / 60_000)} dakika mesaj gönderemezsin.`);
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) fail('GECERSIZ', 'Boş mesaj gönderilemez.');
    if ([...clean].length > SOCIAL_LIMITS.chatMax) fail('GECERSIZ', `Mesaj en çok ${SOCIAL_LIMITS.chatMax} karakter olabilir.`);
    if (now - p.last_chat_at < SOCIAL_LIMITS.chatCooldownMs) fail('HIZ', 'Biraz yavaş: mesajlar arasında kısa bir süre beklemelisin.');
    const masked = maskProfanity(clean).text;
    const msg: ChatMessage = { id: rid('m'), room, from: p.id, name: p.name, color: p.color, text: masked, kind: kind ?? 'text', at: now };
    app.db.run('INSERT INTO chat(id, room, from_id, name, color, text, kind, at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)', msg.id, room, p.id, p.name, p.color, masked, msg.kind, now);
    app.db.run('UPDATE players SET last_chat_at = ? WHERE id = ?', now, p.id);
    broadcast(app, msg);
    return { msg };
  },
  'chat.report': (app, s, { msgId }) => {
    const m = app.db.get<ChatRow>('SELECT * FROM chat WHERE id = ?', msgId);
    if (!m) return fail('YOK', 'Mesaj bulunamadı.');
    if (m.from_id === 'sistem') fail('GECERSIZ', 'Sistem mesajları şikâyet edilemez.');
    if (m.from_id === s.pid) fail('GECERSIZ', 'Kendi mesajını şikâyet edemezsin.');
    checkRoom(app, s.pid, m.room);
    app.db.run('INSERT OR IGNORE INTO chat_reports(msg_id, reporter, at) VALUES(?, ?, ?)', msgId, s.pid, app.now());
    const n = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM chat_reports WHERE msg_id = ?', msgId)!.n;
    if (n >= REPORTS_TO_HIDE && !m.hidden) {
      app.db.run('UPDATE chat SET hidden = 1 WHERE id = ?', msgId);
      app.db.run('UPDATE players SET chat_muted_until = ? WHERE id = ?', app.now() + MUTE_MS, m.from_id);
    }
    return {};
  },
  'chat.mute': (app, s, { id, on }) => {
    if (id === s.pid) fail('GECERSIZ', 'Kendini engelleyemezsin.');
    if (on && !app.playerOrNull(id)) fail('YOK', 'Oyuncu bulunamadı.');
    const list = mutedBy(app, s.pid);
    if (on) list.add(id); else list.delete(id);
    if (list.size > 500) fail('LIMIT', 'Engel listesi dolu.');
    app.db.run('UPDATE players SET muted = ? WHERE id = ?', JSON.stringify([...list]), s.pid);
    return { muted: [...list] };
  },
};
