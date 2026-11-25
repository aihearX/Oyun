/**
 * Profil fotoğrafı (1.1.0): isteğe bağlı, herkese görünür. Kurallar: @odi/shared PHOTO_RULES.
 * - Yükleme HTTP ile (WebSocket iletisi 8 KB ile sınırlı): `POST /foto`, başlık `Authorization: Bearer <oturum anahtarı>`, gövde
 *   JPEG baytları ya da `data:image/jpeg;base64,…`. JPEG imzası, boyut ve en/boy denetlenir; oyuncu başına saatte PHOTO_RULES.perHour.
 * - Herkese açık okuma: `GET /foto/<oyuncu>.jpg?v=<sürüm>` (sürüm adreste: uzun önbellek, değişince adres değişir).
 * - Şikâyet (`players.report`, neden 'foto'): PHOTO_RULES.reportsToHide farklı kişi şikâyet edince fotoğraf gizlenir; yönetici ekranı
 *   geri açar ya da siler. Hesap silinince fotoğraf silinir (account-veri.ts).
 */
import type http from 'node:http';
import { PHOTO_RULES } from '@odi/shared';
import { fail, type App, type Handlers } from './app';
import { hashToken } from './players';

export { PHOTO_SCHEMA } from './foto-schema';

/** görünür fotoğrafın sürümü (yoksa ya da gizliyse undefined) */
export function photoVersion(app: App, pid: string): number | undefined {
  return app.db.get<{ version: number }>('SELECT version FROM player_photos WHERE player_id = ? AND hidden = 0', pid)?.version;
}

/** fotoğrafın değiştiğini duyur: çevrimiçi herkes (resim herkese görünür) */
export function announcePhoto(app: App, pid: string): void {
  const v = photoVersion(app, pid) ?? 0;
  for (const id of app.online.keys()) app.emit(id, 'photo.changed', { id: pid, v });
  // arkadaş listesindeki profil de yenilensin (friend.updated: mevcut yol)
  const p = app.playerOrNull(pid);
  if (p) { const pub = app.publicProfile(p); for (const r of app.db.all<{ b: string }>('SELECT b FROM friends WHERE a = ?', pid)) app.emit(r.b, 'friend.updated', { friend: pub }); }
}

export function deletePhoto(app: App, pid: string): boolean {
  const n = app.db.run('DELETE FROM player_photos WHERE player_id = ?', pid);
  if (n) app.after(() => announcePhoto(app, pid));
  return n > 0;
}

/** JPEG mi, en/boy makul mü (SOF işaretinden) */
export function checkJpeg(b: Buffer): { ok: true; w: number; h: number } | { ok: false; error: string } {
  if (b.length < 128 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return { ok: false, error: 'Yalnız JPEG resim yüklenebilir.' };
  if (b.length > PHOTO_RULES.maxBytes) return { ok: false, error: 'Resim çok büyük.' };
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return { ok: false, error: 'Resim okunamadı.' };
    const m = b[i + 1]!;
    if (m === 0xff) { i++; continue; }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    const len = b.readUInt16BE(i + 2);
    // SOF0..SOF15 (C4 DHT, C8 JPG, CC DAC hariç)
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      const h = b.readUInt16BE(i + 5); const w = b.readUInt16BE(i + 7);
      if (w < 16 || h < 16 || w > 1024 || h > 1024) return { ok: false, error: 'Resmin boyu uygun değil.' };
      return { ok: true, w, h };
    }
    if (m === 0xda || len < 2) break;
    i += 2 + len;
  }
  return { ok: false, error: 'Resim okunamadı.' };
}

/** saatlik yükleme sınırı (bellek) */
const uploads = new WeakMap<App, Map<string, number[]>>();
function uploadOk(app: App, pid: string): boolean {
  let m = uploads.get(app); if (!m) { m = new Map(); uploads.set(app, m); }
  const now = app.now();
  const list = (m.get(pid) ?? []).filter((t) => now - t < 3_600_000);
  if (list.length >= PHOTO_RULES.perHour) { m.set(pid, list); return false; }
  list.push(now); m.set(pid, list);
  if (m.size > 10_000) for (const [k, v] of m) if (!v.some((t) => now - t < 3_600_000)) m.delete(k);
  return true;
}

export type PhotoResult = { status: number; error?: string; v?: number };

/** yüklemeyi işle (gövde okunmuş) */
export function receivePhoto(app: App, auth: string | undefined, body: Buffer): PhotoResult {
  const token = /^Bearer\s+([A-Za-z0-9]{16,200})$/.exec(auth ?? '')?.[1];
  if (!token) return { status: 401, error: 'Oturum gerekli.' };
  const p = app.db.get<{ id: string; highest: number; chat_muted_until: number }>('SELECT id, highest, chat_muted_until FROM players WHERE token_hash = ?', hashToken(token));
  if (!p || app.db.get('SELECT 1 AS x FROM deleted_players WHERE player_id = ?', p.id)) return { status: 401, error: 'Oturum tanınmadı.' };
  const isAdmin = !!app.db.get('SELECT 1 AS x FROM player_flags WHERE player_id = ? AND admin = 1', p.id);
  if (!isAdmin && Math.max(0, p.highest - 1) < PHOTO_RULES.minCleared) return { status: 403, error: `Fotoğraf ${PHOTO_RULES.minCleared}. bölümden sonra açılır.` };
  if (p.chat_muted_until > app.now()) return { status: 403, error: 'Şu an fotoğraf yükleyemezsin.' };
  let jpeg = body;
  const head = body.subarray(0, 32).toString('latin1');
  if (head.startsWith('data:')) {
    const m = /^data:image\/jpeg;base64,/i.exec(head);
    if (!m) return { status: 415, error: 'Yalnız JPEG resim yüklenebilir.' };
    jpeg = Buffer.from(body.subarray(m[0].length).toString('latin1'), 'base64');
  }
  const c = checkJpeg(jpeg);
  if (!c.ok) return { status: 415, error: c.error };
  if (!uploadOk(app, p.id)) return { status: 429, error: 'Çok sık değiştirdin; biraz sonra yeniden dene.' };
  return app.run(() => {
    const prev = app.db.get<{ version: number }>('SELECT version FROM player_photos WHERE player_id = ?', p.id)?.version ?? 0;
    const v = Math.max(app.now(), prev + 1);
    app.db.run(`INSERT INTO player_photos(player_id, jpeg, version, bytes, at, hidden) VALUES(?, ?, ?, ?, ?, 0)
      ON CONFLICT(player_id) DO UPDATE SET jpeg = excluded.jpeg, version = excluded.version, bytes = excluded.bytes, at = excluded.at, hidden = 0`,
      p.id, jpeg, v, jpeg.length, app.now());
    // önceki fotoğrafın şikâyetleri yeni fotoğrafa sayılmaz (şikâyet kaydı moderasyon için kalır)
    app.after(() => announcePhoto(app, p.id));
    return { status: 200, v };
  });
}

/** GET /foto/<id>.jpg: görünür fotoğraf ya da 404 */
export function servePhoto(app: App, url: string, res: http.ServerResponse): boolean {
  const m = /^\/foto\/([A-Za-z0-9]{1,40})\.jpg$/.exec(url);
  if (!m) return false;
  const r = app.db.get<{ jpeg: Uint8Array; version: number }>('SELECT jpeg, version FROM player_photos WHERE player_id = ? AND hidden = 0', m[1]!);
  if (!r) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
    res.end('Bulunamadı.\n');
    return true;
  }
  const buf = Buffer.from(r.jpeg);
  // adres sürümlü (?v=): değişince yeni adres; aynı adres bir yıl önbellekte kalabilir
  res.writeHead(200, { 'content-type': 'image/jpeg', 'content-length': buf.length, 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' });
  res.end(buf);
  return true;
}

/** fotoğraf şikâyeti: kayıt player_reports'a (msg_id foto:<sürüm>); eşik aşılınca gizlenir (sohbet susturması yok) */
export function reportPhoto(app: App, reporter: string, target: string): void {
  const v = app.db.get<{ version: number }>('SELECT version FROM player_photos WHERE player_id = ? AND hidden = 0', target)?.version;
  if (!v) fail('YOK', 'Bu oyuncunun fotoğrafı yok.');
  const msgId = `foto:${v}`;
  app.db.run('INSERT OR IGNORE INTO player_reports(target, reporter, msg_id, reason, at) VALUES(?, ?, ?, ?, ?)', target, reporter, msgId, 'foto', app.now());
  const n = app.db.get<{ n: number }>('SELECT COUNT(DISTINCT reporter) AS n FROM player_reports WHERE target = ? AND msg_id = ?', target, msgId)!.n;
  if (n >= PHOTO_RULES.reportsToHide) {
    app.db.run('UPDATE player_photos SET hidden = 1 WHERE player_id = ?', target);
    app.after(() => announcePhoto(app, target));
  }
}

export const photoHandlers: Handlers = {
  'photo.of': (app, _s, { ids }) => {
    const list = [...new Set(ids)].slice(0, 100);
    const photos: Record<string, number> = {};
    if (list.length) {
      const rows = app.db.all<{ player_id: string; version: number }>(
        `SELECT player_id, version FROM player_photos WHERE hidden = 0 AND player_id IN (${list.map(() => '?').join(',')})`, ...list);
      for (const r of rows) photos[r.player_id] = r.version;
    }
    return { photos };
  },
  'photo.remove': (app, s) => {
    deletePhoto(app, s.pid);
    return { me: app.myProfile(app.player(s.pid)) };
  },
};
