import type { PlayerRow } from './app';
import { fail, type Handlers } from './app';

const FRIENDS_MAX = 200;

export const friendHandlers: Handlers = {
  'friends.list': (app, s) => {
    const rows = app.db.all<PlayerRow>('SELECT p.* FROM friends f JOIN players p ON p.id = f.b WHERE f.a = ? ORDER BY f.at', s.pid);
    const friends = rows.map((r) => app.publicProfile(r));
    friends.sort((a, b) => Number(b.online) - Number(a.online));
    return { friends };
  },
  'friends.add': (app, s, { code }) => {
    const c = code.trim().toUpperCase();
    const other = app.db.get<PlayerRow>('SELECT * FROM players WHERE friend_code = ?', c);
    if (!other) return fail('YOK', 'Bu arkadaş koduyla bir oyuncu bulunamadı.');
    if (other.id === s.pid) fail('GECERSIZ', 'Kendi kodunu ekleyemezsin.');
    const already = app.db.get('SELECT 1 AS x FROM friends WHERE a = ? AND b = ?', s.pid, other.id);
    if (!already) {
      const n = (id: string) => app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM friends WHERE a = ?', id)!.n;
      if (n(s.pid) >= FRIENDS_MAX) fail('LIMIT', `En çok ${FRIENDS_MAX} arkadaş ekleyebilirsin.`);
      if (n(other.id) >= FRIENDS_MAX) fail('LIMIT', 'Bu oyuncunun arkadaş listesi dolu.');
      const now = app.now();
      app.db.run('INSERT OR IGNORE INTO friends(a, b, at) VALUES(?, ?, ?)', s.pid, other.id, now);
      app.db.run('INSERT OR IGNORE INTO friends(a, b, at) VALUES(?, ?, ?)', other.id, s.pid, now);
      app.emit(other.id, 'friend.updated', { friend: app.publicProfile(app.player(s.pid)) });
    }
    return { friend: app.publicProfile(other) };
  },
  'friends.remove': (app, s, { id }) => {
    app.db.run('DELETE FROM friends WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', s.pid, id, id, s.pid);
    return {};
  },
};
