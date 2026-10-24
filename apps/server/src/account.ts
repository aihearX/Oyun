/**
 * Hesabı silme (KVKK m.7 / GDPR m.17 silme hakkı). İstemci "Her şeyi sıfırla"da, cihazı silmeden önce çağırır.
 * Satırlar fiziksel olarak silinir ya da anonimleşir; oyuncu satırı kalır (eski kayıtlar — savaş, baskın, lig — kimliğe bağlı,
 * kırılmasın), ama adı "Silinmiş Oyuncu" olur, oturum anahtarı hiçbir anahtarla eşleşmez ve rekabet tablolarından çıkar.
 * Yalnızca yeni tablo (deleted_players): mevcut veritabanında güvenle açılır.
 */
import { randomBytes } from 'node:crypto';
import { DELETED_PLAYER_NAME } from '@odi/shared';
import type { App, Handlers } from './app';
import { removeMember } from './teams';
import { rankInvalidate } from './rank';

export const isDeleted = (app: App, pid: string) => !!app.db.get('SELECT 1 AS x FROM deleted_players WHERE player_id = ?', pid);

export function deleteAccount(app: App, pid: string): void {
  const p = app.player(pid);
  if (p.team_id) removeMember(app, pid, 'ayrildi');
  // arkadaşlar: karşı tarafın listesinden düşsün
  for (const r of app.db.all<{ b: string }>('SELECT b FROM friends WHERE a = ?', pid)) app.emit(r.b, 'friend.removed', { id: pid });
  app.db.run('DELETE FROM friends WHERE a = ? OR b = ?', pid, pid);
  app.db.run('DELETE FROM friend_requests WHERE from_id = ? OR to_id = ?', pid, pid);
  app.db.run('DELETE FROM blocks WHERE a = ? OR b = ?', pid, pid);
  // özel mesajlar: oyuncunun dahil olduğu konuşmalar (yazdıkları kişisel veridir), tepkiler ve okundu bilgisi
  app.db.run('DELETE FROM dm_reactions WHERE player_id = ? OR msg_id IN (SELECT id FROM dm WHERE from_id = ? OR to_id = ?)', pid, pid, pid);
  app.db.run('DELETE FROM dm_reads WHERE player_id = ? OR other_id = ?', pid, pid);
  app.db.run('DELETE FROM dm WHERE from_id = ? OR to_id = ?', pid, pid);
  // sohbet (genel/takım) mesajları ve bekleyen takım başvuruları, bölüm yardımı istekleri
  app.db.run('DELETE FROM chat WHERE from_id = ?', pid);
  app.db.run("DELETE FROM team_apps WHERE player_id = ? AND status = 'bekliyor'", pid);
  app.db.run('DELETE FROM help_requests WHERE from_id = ?', pid);
  // bu haftanın lig grubundan çık (geçmiş haftalar kimliğe bağlı kalır, ad anonim)
  app.db.run('DELETE FROM league WHERE player_id = ? AND week = ?', pid, app.week().key);
  // kimlik: ad anonim, anahtar hiçbir zaman eşleşmez (özetler 64 haneli onaltılık), arkadaş kodu yenilenir
  app.db.run(`UPDATE players SET name = ?, token_hash = ?, friend_code = ?, hat = '', muted = '[]' WHERE id = ?`,
    DELETED_PLAYER_NAME, `silindi:${pid}`, `X${randomBytes(8).toString('hex').toUpperCase()}`, pid);
  app.db.run('INSERT OR IGNORE INTO deleted_players(player_id, at) VALUES(?, ?)', pid, app.now());
  app.after(() => rankInvalidate(app)); // Sıralama önbelleği: hesap hemen tablolardan çıkar
}

export const accountHandlers: Handlers = {
  'account.delete': (app, s) => { deleteAccount(app, s.pid); return { deleted: true as const }; },
};
