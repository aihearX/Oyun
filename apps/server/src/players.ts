import { createHash, randomBytes, randomInt } from 'node:crypto';
import { BUILDINGS, PROTOCOL_VERSION, SOCIAL_LIMITS, type InboxItem } from '@odi/shared';
import { fail, randomCode, rid, sendJson, type App, type Conn, type Handlers, type PlayerRow } from './app';
import { hasProfanity } from './profanity';
import { dayKey } from './time';

export const START_JETON = 100;
export const PASS_DAILY_KRISTAL = 30;
const COLORS = [0xff7a59, 0x7c5cff, 0x2ee6d6, 0xffc25c, 0xff4f7a, 0x5b8def, 0x4cd97b, 0xf28fe0];

export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

const NAME_RE = /^[A-Za-z0-9ÇĞİÖŞÜçğıöşüÂâÎîÛû _]+$/;
/** isim doğrulama: 3-16 karakter, harf/rakam/boşluk/_ (Türkçe harfler dahil), küfürsüz */
export function validateName(raw: string): string {
  const name = raw.replace(/\s+/g, ' ').trim();
  const len = [...name].length;
  if (len < SOCIAL_LIMITS.nameMin || len > SOCIAL_LIMITS.nameMax) fail('ISIM', `İsim ${SOCIAL_LIMITS.nameMin}-${SOCIAL_LIMITS.nameMax} karakter olmalı.`);
  if (!NAME_RE.test(name)) fail('ISIM', 'İsimde yalnızca harf, rakam, boşluk ve _ kullanılabilir.');
  if (hasProfanity(name)) fail('ISIM', 'Bu isim uygun değil; lütfen başka bir isim seç.');
  return name;
}

function uniqueFriendCode(app: App): string {
  for (let i = 0; i < 50; i++) {
    const c = randomCode(6);
    if (!app.db.get('SELECT 1 AS x FROM players WHERE friend_code = ?', c)) return c;
  }
  return fail('SUNUCU', 'Arkadaş kodu üretilemedi.');
}

function createPlayer(app: App, wantName: string | undefined): { row: PlayerRow; token: string } {
  let name = `Odi${String(randomInt(0, 10000)).padStart(4, '0')}`;
  if (wantName) { try { name = validateName(wantName); } catch { /* geçersizse varsayılan isim */ } }
  const token = randomBytes(32).toString('hex');
  const id = rid('p');
  const now = app.now();
  app.db.run(`INSERT INTO players(id, token_hash, name, color, friend_code, jeton, depot_at, created_at, last_seen) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, hashToken(token), name, COLORS[randomInt(0, COLORS.length)]!, uniqueFriendCode(app), START_JETON, now, now, now);
  for (const b of BUILDINGS) app.db.run('INSERT INTO buildings(player_id, id, level) VALUES(?, ?, ?)', id, b.id, b.id === 'merkez' ? 1 : 0);
  return { row: app.player(id), token };
}

/** arkadaşlar + takım arkadaşları (presence alıcıları) */
export function circleOf(app: App, pid: string): string[] {
  const ids = new Set(app.db.all<{ b: string }>('SELECT b FROM friends WHERE a = ?', pid).map((r) => r.b));
  const p = app.playerOrNull(pid);
  if (p?.team_id) for (const id of app.teamMemberIds(p.team_id)) if (id !== pid) ids.add(id);
  return [...ids];
}

export function announcePresence(app: App, pid: string, online: boolean): void {
  for (const id of circleOf(app, pid)) app.emit(id, 'presence', { id: pid, online });
}

/** Sezon kartı: 28 gün boyunca her günün ilk girişinde 30 kristal ödül kutusuna */
export function passDaily(app: App, pid: string): void {
  const p = app.player(pid);
  const now = app.now();
  const today = dayKey(now);
  if (p.pass_until > now && p.pass_day !== today) {
    app.db.run('UPDATE players SET pass_day = ? WHERE id = ?', today, pid);
    app.addInbox(pid, { kind: 'kristal', amount: PASS_DAILY_KRISTAL, ref: 'odi.pass' }, 'Sezon Kartı günlük ödülü');
  }
}

export function attach(app: App, conn: Conn, pid: string): void {
  const old = app.online.get(pid);
  if (old && old !== conn) {
    sendJson(old, { t: 'evt', ev: 'kicked', data: { reason: 'Hesabın başka bir cihazda açıldı.' } });
    old.pid = null;
    for (const r of old.rooms) app.unsubscribe(pid, r);
    old.ws.close(4000, 'kicked');
  }
  const wasOnline = !!old;
  conn.pid = pid;
  app.online.set(pid, conn);
  app.db.run('UPDATE players SET last_seen = ? WHERE id = ?', app.now(), pid);
  if (!wasOnline) announcePresence(app, pid, true);
}

export const playerHandlers: Handlers = {
  'hello': (app, s, { token, name, version, campV }) => {
    if (version !== PROTOCOL_VERSION) fail('SURUM', 'Uygulama sürümü sunucuyla uyumsuz; lütfen uygulamayı güncelle.');
    if (s.conn.pid) fail('GECERSIZ', 'Bu bağlantıda oturum zaten açık.');
    let row: PlayerRow; let newToken: string | undefined;
    if (token) {
      const r = app.db.get<PlayerRow>('SELECT * FROM players WHERE token_hash = ?', hashToken(token));
      if (!r) return fail('TOKEN', 'Oturum anahtarı tanınmadı; yeni hesapla devam etmek için anahtarsız bağlan.');
      row = r;
    } else {
      const c = createPlayer(app, name); row = c.row; newToken = c.token;
    }
    s.conn.campV = campV ?? 0;
    attach(app, s.conn, row.id);
    passDaily(app, row.id);
    const me = app.myProfile(app.player(row.id));
    if (newToken) me.token = newToken;
    return { me, serverTime: app.now() };
  },
  'profile.update': (app, s, { name, color, hat }) => {
    if (name !== undefined) app.db.run('UPDATE players SET name = ? WHERE id = ?', validateName(name), s.pid);
    if (color !== undefined) app.db.run('UPDATE players SET color = ? WHERE id = ?', color, s.pid);
    if (hat !== undefined) app.db.run('UPDATE players SET hat = ? WHERE id = ?', hat, s.pid);
    const p = app.player(s.pid);
    const pub = app.publicProfile(p);
    for (const r of app.db.all<{ b: string }>('SELECT b FROM friends WHERE a = ?', s.pid)) app.emit(r.b, 'friend.updated', { friend: pub });
    return { me: app.myProfile(p) };
  },
  'profile.get': (app, _s, { id }) => {
    const p = app.playerOrNull(id);
    if (!p) return fail('YOK', 'Oyuncu bulunamadı.');
    return { profile: app.publicProfile(p) };
  },
  'wallet.get': (app, s) => ({ wallet: app.wallet(s.pid) }),
  'inbox.list': (app, s) => {
    passDaily(app, s.pid);
    const items = app.db.all<InboxItem>('SELECT id, kind, amount, ref, reason, at FROM inbox WHERE player_id = ? AND claimed = 0 ORDER BY at DESC LIMIT 100', s.pid);
    return { items: items.map((r) => ({ ...r })) };
  },
  'inbox.claim': (app, s, { id }) => {
    const item = app.db.get<InboxItem>('SELECT id, kind, amount, ref, reason, at FROM inbox WHERE id = ? AND player_id = ? AND claimed = 0', id, s.pid);
    if (!item) return fail('YOK', 'Ödül bulunamadı ya da zaten alındı.');
    app.db.run('UPDATE inbox SET claimed = 1 WHERE id = ?', id);
    app.grant(s.pid, { kind: item.kind, amount: item.amount, ref: item.ref });
    return { item: { ...item }, wallet: app.walletChanged(s.pid) };
  },
};
