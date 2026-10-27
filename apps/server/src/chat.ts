import { CHAT_REACTIONS, COMM_RULES, SOCIAL_LIMITS, phraseById, type ChatKind, type ChatMessage } from '@odi/shared';
import { fail, parseJson, rid, type App, type Handlers, type PlayerRow } from './app';
import { commNotice, metric, requireFreeText } from './comm/settings';
import { maskProfanity } from './profanity';
import { raceMemberIds } from './race';
import { DAY_MS } from './time';

const MUTE_MS = 10 * 60_000;
/** susturma iletisi (kısa susturma dakika, işletmenin uzun susturması gün olarak) */
export function susturmaMetni(kalanMs: number): string {
  return kalanMs > DAY_MS ? `Şikâyetler nedeniyle ${Math.ceil(kalanMs / DAY_MS)} gün mesaj gönderemezsin.` : `Şikâyetler nedeniyle ${Math.ceil(kalanMs / 60_000)} dakika mesaj gönderemezsin.`;
}
const REPORTS_TO_HIDE = 3;
export const CHAT_RETAIN_MS = 30 * DAY_MS;

type Meta = Record<string, string | number | boolean>;
interface ChatRow { id: string; room: string; from_id: string; name: string; color: number; text: string; kind: ChatKind; at: number; meta: string | null; hidden: number }

const toMsg = (r: ChatRow): ChatMessage => {
  const m: ChatMessage = { id: r.id, room: r.room, from: r.from_id, name: r.name, color: r.color, text: r.text, kind: r.kind, at: r.at };
  if (r.meta) {
    const meta = parseJson<Meta>(r.meta, {});
    if (typeof meta.re === 'string') { m.replyTo = meta.re; delete meta.re; }
    if (Object.keys(meta).length) m.meta = meta;
  }
  return m;
};

export const teamRoom = (teamId: string) => `takim:${teamId}`;
/** canlı yarış odasının sohbeti: yalnızca o yarış odasındaki (ayrılmamış) oyuncular */
export const raceRoom = (roomId: string) => `race:${roomId}`;
export const dmRoom = (a: string, b: string) => (a < b ? `dm:${a}:${b}` : `dm:${b}:${a}`);
export const teamOfRoom = (room: string) => /^takim:(.+)$/.exec(room)?.[1] ?? null;

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
  const rc = /^race:([A-Za-z0-9]+)$/.exec(room);
  if (rc) {
    if (!raceMemberIds(app, rc[1]!)?.includes(pid)) fail('YETKI', 'Bu yarış sohbetine yalnızca odadaki oyuncular girebilir.');
    return;
  }
  fail('GECERSIZ', 'Böyle bir sohbet odası yok.');
}

/** odadaki mesajı alacak çevrimiçi oyuncular: genel = abone olanlar; takım/özel/yarış = tüm çevrimiçi üyeler */
function recipients(app: App, room: string): string[] {
  if (room === 'genel') return [...(app.rooms.get('genel') ?? [])];
  const t = /^takim:(.+)$/.exec(room);
  if (t) return app.teamMemberIds(t[1]!).filter((id) => app.online.has(id));
  const d = /^dm:([^:]+):([^:]+)$/.exec(room);
  if (d) return [d[1]!, d[2]!].filter((id) => app.online.has(id));
  const rc = /^race:(.+)$/.exec(room);
  if (rc) return (raceMemberIds(app, rc[1]!) ?? []).filter((id) => app.online.has(id));
  return [];
}

export function mutedBy(app: App, pid: string): Set<string> { return new Set(parseJson<string[]>(app.player(pid).muted, [])); }
/** viewer, from'un mesajını/tepkisini görmez mi (sessize aldı; engellemek de sessize alır) */
const hides = (app: App, viewer: string, from: string, muted = mutedBy(app, viewer)) => from !== 'sistem' && from !== viewer && muted.has(from);

/** tepkiler + konu (yanıt sayısı, son yanıtlar) — bakan kişiye göre (sessize aldıkları süzülür) */
function decorate(app: App, viewer: string, m: ChatMessage, muted = mutedBy(app, viewer), preview = true): ChatMessage {
  const out: ChatMessage = { ...m };
  const reacts: Record<string, string[]> = {};
  for (const r of app.db.all<{ player_id: string; reaction: string }>('SELECT player_id, reaction FROM chat_reactions WHERE msg_id = ? ORDER BY at', m.id)) {
    if (hides(app, viewer, r.player_id, muted)) continue;
    (reacts[r.reaction] ??= []).push(r.player_id);
  }
  if (Object.keys(reacts).length) out.reactions = reacts; else delete out.reactions;
  if (!m.replyTo) {
    const rows = app.db.all<ChatRow>('SELECT c.* FROM chat_thread t JOIN chat c ON c.id = t.msg_id WHERE t.parent_id = ? AND c.hidden = 0 ORDER BY c.at DESC, c.rowid DESC LIMIT ?', m.id, COMM_RULES.threadMax)
      .filter((r) => !hides(app, viewer, r.from_id, muted));
    if (rows.length) out.replies = rows.length; else delete out.replies;
    if (preview && rows.length) out.thread = rows.slice(0, COMM_RULES.threadPreview).reverse().map((r) => decorate(app, viewer, toMsg(r), muted, false));
    else delete out.thread;
  }
  return out;
}

function broadcast(app: App, msg: ChatMessage): void {
  for (const pid of recipients(app, msg.room)) {
    if (hides(app, pid, msg.from)) continue;
    app.emit(pid, 'chat', { msg });
  }
}
/** mesaj değişti (tepki, kart birleşmesi, sayaçlar): her alıcıya kendi görünümüyle */
export function broadcastUpdate(app: App, msgId: string): void {
  const r = app.db.get<ChatRow>('SELECT * FROM chat WHERE id = ?', msgId);
  if (!r || r.hidden) return;
  const base = toMsg(r);
  app.emitEach(recipients(app, r.room), 'chat.updated', (pid) => (hides(app, pid, r.from_id) ? null : { msg: decorate(app, pid, base) }));
}

function insert(app: App, msg: ChatMessage, meta: Meta | null): void {
  app.db.run('INSERT INTO chat(id, room, from_id, name, color, text, kind, at, meta) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)',
    msg.id, msg.room, msg.from, msg.name, msg.color, msg.text, msg.kind, msg.at, meta && Object.keys(meta).length ? JSON.stringify(meta) : null);
  if (msg.replyTo) app.db.run('INSERT OR IGNORE INTO chat_thread(parent_id, msg_id, at) VALUES(?, ?, ?)', msg.replyTo, msg.id, msg.at);
}

/** sistem mesajı (takıma katılma, yardım, hediye, baskın, savaş…) */
export function systemMessage(app: App, room: string, text: string, kind: ChatKind = 'system', meta?: Meta): ChatMessage {
  return postCard(app, room, { text, kind, meta });
}

/** sistem kartı / sistem yanıtı: Takım Akışı, Günün Sorusu (Tüy Dede), yardım kartı, konu altı otomatik yanıtlar */
export function postCard(app: App, room: string, o: { text: string; kind: ChatKind; meta?: Meta; name?: string; replyTo?: string }): ChatMessage {
  const msg: ChatMessage = { id: rid('m'), room, from: 'sistem', name: o.name ?? 'Sistem', color: 0x7c5cff, text: o.text, kind: o.kind, at: app.now() };
  if (o.meta && Object.keys(o.meta).length) msg.meta = { ...o.meta };
  if (o.replyTo) msg.replyTo = o.replyTo;
  insert(app, msg, { ...(o.meta ?? {}), ...(o.replyTo ? { re: o.replyTo } : {}) });
  broadcast(app, msg);
  if (o.replyTo) broadcastUpdate(app, o.replyTo);
  return msg;
}
/** kartın metnini/meta'sını güncelle ve yayınla */
export function updateCard(app: App, msgId: string, text: string | null, patch: Meta): void {
  const r = app.db.get<ChatRow>('SELECT * FROM chat WHERE id = ?', msgId);
  if (!r) return;
  const meta = { ...parseJson<Meta>(r.meta ?? '{}', {}), ...patch };
  app.db.run('UPDATE chat SET text = ?, meta = ? WHERE id = ?', text ?? r.text, JSON.stringify(meta), msgId);
  broadcastUpdate(app, msgId);
}
export function cardMeta(app: App, msgId: string): Meta | null {
  const r = app.db.get<{ meta: string | null }>('SELECT meta FROM chat WHERE id = ?', msgId);
  return r ? parseJson<Meta>(r.meta ?? '{}', {}) : null;
}

export function history(app: App, pid: string, room: string): ChatMessage[] {
  const muted = mutedBy(app, pid);
  const rows = app.db.all<ChatRow>('SELECT * FROM chat WHERE room = ? AND hidden = 0 AND id NOT IN (SELECT msg_id FROM chat_thread) ORDER BY at DESC, rowid DESC LIMIT ?', room, SOCIAL_LIMITS.historySize + muted.size * 5);
  return rows.filter((r) => !hides(app, pid, r.from_id, muted)).slice(0, SOCIAL_LIMITS.historySize).reverse().map((r) => decorate(app, pid, toMsg(r), muted));
}

export function pruneChat(app: App): void {
  app.db.run('DELETE FROM chat WHERE at < ?', app.now() - CHAT_RETAIN_MS);
  app.db.run('DELETE FROM chat_reactions WHERE msg_id NOT IN (SELECT id FROM chat)');
  app.db.run('DELETE FROM chat_thread WHERE parent_id NOT IN (SELECT id FROM chat)');
  app.db.run('DELETE FROM chat_cid WHERE at < ?', app.now() - CID_RETAIN_MS);
}
/** gönderim kimliği yalnız yeniden deneme penceresi için tutulur */
const CID_RETAIN_MS = 86_400_000;

/** takım sohbetinde @İsim: mesajda geçen takım üyeleri (en çok 3; sınırda harf/rakam olmamalı) */
function mentionsIn(app: App, p: PlayerRow, teamId: string, text: string): PlayerRow[] {
  if (!text.includes('@')) return [];
  const low = text.toLocaleLowerCase('tr');
  const members = app.db.all<PlayerRow>('SELECT * FROM players WHERE team_id = ? AND id != ?', teamId, p.id).sort((a, b) => b.name.length - a.name.length);
  const out: PlayerRow[] = [];
  for (const m of members) {
    const key = '@' + m.name.toLocaleLowerCase('tr');
    let i = low.indexOf(key);
    while (i >= 0) {
      const next = low.charAt(i + key.length);
      if (!next || !/[\p{L}\p{N}_]/u.test(next)) { out.push(m); break; }
      i = low.indexOf(key, i + 1);
    }
    if (out.length >= COMM_RULES.mentionsMax) break;
  }
  return out;
}

/** tepki hız sınırı (bellekte; oyuncu başına) */
const reactTimes = new WeakMap<App, Map<string, number[]>>();
function reactAllowed(app: App, pid: string): boolean {
  let m = reactTimes.get(app); if (!m) { m = new Map(); reactTimes.set(app, m); }
  const now = app.now(); const list = (m.get(pid) ?? []).filter((t) => now - t < 60_000);
  if (list.length && now - list[list.length - 1]! < COMM_RULES.reactMinMs) return false;
  if (list.length >= COMM_RULES.reactPerMin) return false;
  list.push(now); m.set(pid, list); return true;
}

/** gönderilecek mesajın gövdesi (tür ve güvenli varsayılan kuralları) */
export function chatBody(app: App, p: PlayerRow, text: string, kind: 'text' | 'emoji' | 'hazir'): { text: string; meta: Meta } {
  if (kind === 'hazir') {
    const ph = phraseById(text.trim());
    if (!ph) fail('GECERSIZ', 'Böyle bir hazır söz yok.');
    return { text: ph.text, meta: { p: ph.id } };
  }
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) fail('GECERSIZ', 'Boş mesaj gönderilemez.');
  if ([...clean].length > SOCIAL_LIMITS.chatMax) fail('GECERSIZ', `Mesaj en çok ${SOCIAL_LIMITS.chatMax} karakter olabilir.`);
  if (kind === 'emoji') {
    if (clean.length > 32 || !/^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|⃣| )+$/u.test(clean)) fail('GECERSIZ', 'Emoji mesajı yalnızca emoji içerebilir.');
    return { text: clean, meta: {} };
  }
  requireFreeText(app, p);
  return { text: maskProfanity(clean).text, meta: {} };
}

/** oyuncunun bir odaya mesajı (sohbet, yanıt, ipucu): susturma, hız, tür kuralları, bahsetme */
export function sendAs(app: App, p: PlayerRow, room: string, text: string, kind: 'text' | 'emoji' | 'hazir', replyTo?: string, extra: Meta = {}): ChatMessage {
  const now = app.now();
  if (p.chat_muted_until > now) fail('SUSTURULDU', susturmaMetni(p.chat_muted_until - now));
  const body = chatBody(app, p, text, kind);
  if (now - p.last_chat_at < SOCIAL_LIMITS.chatCooldownMs) fail('HIZ', 'Biraz yavaş: mesajlar arasında kısa bir süre beklemelisin.');
  let parent: ChatRow | undefined;
  if (replyTo) {
    parent = app.db.get<ChatRow>('SELECT * FROM chat WHERE id = ?', replyTo);
    if (!parent || parent.room !== room || parent.hidden) fail('YOK', 'Yanıtlanan mesaj bulunamadı.');
    // yanıta yanıt: konu tek düzey (üst mesaja bağlanır)
    const root = app.db.get<{ parent_id: string }>('SELECT parent_id FROM chat_thread WHERE msg_id = ?', parent.id)?.parent_id;
    if (root) parent = app.db.get<ChatRow>('SELECT * FROM chat WHERE id = ?', root) ?? parent;
  }
  const meta: Meta = { ...body.meta, ...extra };
  const teamId = teamOfRoom(room);
  const mentioned = teamId && kind === 'text' ? mentionsIn(app, p, teamId, body.text) : [];
  if (mentioned.length) meta.at = mentioned.map((m) => m.id).join(',');
  const msg: ChatMessage = { id: rid('m'), room, from: p.id, name: p.name, color: p.color, text: body.text, kind: kind === 'hazir' ? 'hazir' : kind, at: now };
  if (Object.keys(meta).length) msg.meta = { ...meta };
  if (parent) msg.replyTo = parent.id;
  insert(app, msg, { ...meta, ...(parent ? { re: parent.id } : {}) });
  app.db.run('UPDATE players SET last_chat_at = ? WHERE id = ?', now, p.id);
  broadcast(app, msg);
  if (parent) broadcastUpdate(app, parent.id);
  for (const m of mentioned) {
    if (hides(app, m.id, p.id)) continue;
    commNotice(app, m.id, { kind: 'mention', title: `${p.name} senden bahsetti`, text: body.text.slice(0, 90), from: app.publicProfile(p), room, msgId: parent?.id ?? msg.id });
    metric(app, 'mention');
  }
  metric(app, parent ? 'msg.reply' : kind === 'hazir' ? 'msg.hazir' : kind === 'emoji' ? 'msg.emoji' : 'msg.text');
  return msg;
}

export const chatHandlers: Handlers = {
  'chat.join': (app, s, { room }) => {
    checkRoom(app, s.pid, room);
    app.subscribe(s.pid, room);
    for (const h of app.chatJoinHooks) h(s.pid, room);
    return { history: history(app, s.pid, room) };
  },
  'chat.leave': (app, s, { room }) => { app.unsubscribe(s.pid, room); return {}; },
  'chat.send': (app, s, { room, text, kind, replyTo, cid }) => {
    checkRoom(app, s.pid, room);
    // tekrar koruması (MK-019): yanıt gelmeden bağlantı koptuysa istemci aynı cid ile yeniden gönderir; ileti bir kez yazılır
    if (cid) {
      const prev = app.db.get<ChatRow>('SELECT c.* FROM chat_cid k JOIN chat c ON c.id = k.msg_id WHERE k.player_id = ? AND k.cid = ?', s.pid, cid);
      if (prev && prev.room === room) return { msg: decorate(app, s.pid, toMsg(prev)) };
    }
    const msg = sendAs(app, app.player(s.pid), room, text, kind ?? 'text', replyTo);
    if (cid) app.db.run('INSERT OR REPLACE INTO chat_cid(player_id, cid, msg_id, at) VALUES(?, ?, ?, ?)', s.pid, cid, msg.id, app.now());
    return { msg };
  },
  'chat.react': (app, s, { msgId, reaction }) => {
    const r = app.db.get<ChatRow>('SELECT * FROM chat WHERE id = ?', msgId);
    if (!r || r.hidden) return fail('YOK', 'Mesaj bulunamadı.');
    checkRoom(app, s.pid, r.room);
    if (r.room.startsWith('dm:')) fail('GECERSIZ', 'Özel mesajlarda dm.react kullanılır.');
    if (reaction && !(CHAT_REACTIONS as readonly string[]).includes(reaction)) fail('GECERSIZ', 'Bu tepki kullanılamıyor.');
    if (!reactAllowed(app, s.pid)) fail('HIZ', 'Biraz yavaş: tepkiler arasında kısa bir süre bekle.');
    const cur = app.db.get<{ reaction: string }>('SELECT reaction FROM chat_reactions WHERE msg_id = ? AND player_id = ?', msgId, s.pid)?.reaction;
    if (!reaction || cur === reaction) app.db.run('DELETE FROM chat_reactions WHERE msg_id = ? AND player_id = ?', msgId, s.pid);
    else {
      app.db.run('INSERT INTO chat_reactions(msg_id, player_id, reaction, at) VALUES(?, ?, ?, ?) ON CONFLICT(msg_id, player_id) DO UPDATE SET reaction = excluded.reaction, at = excluded.at', msgId, s.pid, reaction, app.now());
      if (!cur) metric(app, 'react');
    }
    broadcastUpdate(app, msgId);
    return { msg: decorate(app, s.pid, toMsg(r)) };
  },
  'chat.thread': (app, s, { msgId }) => {
    const r = app.db.get<ChatRow>('SELECT * FROM chat WHERE id = ?', msgId);
    if (!r || r.hidden) return fail('YOK', 'Mesaj bulunamadı.');
    checkRoom(app, s.pid, r.room);
    const muted = mutedBy(app, s.pid);
    const rows = app.db.all<ChatRow>('SELECT c.* FROM chat_thread t JOIN chat c ON c.id = t.msg_id WHERE t.parent_id = ? AND c.hidden = 0 ORDER BY c.at DESC, c.rowid DESC LIMIT ?', msgId, COMM_RULES.threadMax);
    return { parent: decorate(app, s.pid, toMsg(r), muted, false), replies: rows.filter((x) => !hides(app, s.pid, x.from_id, muted)).reverse().map((x) => decorate(app, s.pid, toMsg(x), muted, false)) };
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
      const parent = app.db.get<{ parent_id: string }>('SELECT parent_id FROM chat_thread WHERE msg_id = ?', msgId)?.parent_id;
      if (parent) broadcastUpdate(app, parent);
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
