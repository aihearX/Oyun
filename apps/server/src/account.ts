/**
 * Hesabı silme (KVKK m.7 / GDPR m.17 silme hakkı). İstemci "Her şeyi sıfırla"da, cihazı silmeden önce çağırır.
 * Hangi tablonun silindiği, anonimleştiği ya da gerekçeyle tutulduğu TEK yerde yazılıdır: `account-veri.ts` (VERI_SINIFI).
 * Oyuncu satırı anonim kalır (başkalarının geçmiş kayıtları — düello puanı, yarış yıldızı — bu kimliğe bağlı, kırılmasın): adı
 * "Silinmiş Oyuncu" olur, oturum anahtarı hiçbir anahtarla eşleşmez, ilerleme ve cüzdan sıfırlanır, rekabet tablolarından çıkar.
 */
import { DELETED_PLAYER_NAME } from '@odi/shared';
import type { App, Handlers } from './app';
import { removeMember } from './teams';
import { rankInvalidate } from './rank';
import { anonimOyuncu, PURCHASE_RETAIN_YEARS, REPORT_RETAIN_AFTER_DELETE_MS, REPORT_RETAIN_MS, veriyiTemizle } from './account-veri';

export const isDeleted = (app: App, pid: string) => !!app.db.get('SELECT 1 AS x FROM deleted_players WHERE player_id = ?', pid);

export function deleteAccount(app: App, pid: string): void {
  app.db.tx(() => {
    const p = app.player(pid);
    // önce ad anonim: takımdan ayrılma iletisi ve sonraki kartlar adı taşımasın
    app.db.run('UPDATE players SET name = ? WHERE id = ?', DELETED_PLAYER_NAME, pid);
    if (p.team_id) removeMember(app, pid, 'ayrildi'); // son üyeyse takım silinir (teams.ts deleteTeam → takım verisi)
    // arkadaşlar: karşı tarafın listesinden düşsün
    for (const r of app.db.all<{ b: string }>('SELECT b FROM friends WHERE a = ?', pid)) app.emit(r.b, 'friend.removed', { id: pid });
    // sınıflandırmaya göre: sil / anonimleştir / gerekçeyle tut (account-veri.ts)
    veriyiTemizle(app.db, 'oyuncu', pid, { ad: p.name, createdAt: p.created_at });
    anonimOyuncu(app.db, pid, app.now());
  });
  app.after(() => rankInvalidate(app)); // Sıralama önbelleği: hesap hemen tablolardan çıkar
}

/** Şikâyet kayıtları 90 gün tutulur, sonra silinir (gizlilik metni §3; hesap silinse de silinmese de). */
export function pruneReports(app: App): void {
  const before = app.now() - REPORT_RETAIN_MS;
  app.db.run('DELETE FROM player_reports WHERE at < ?', before);
  app.db.run('DELETE FROM chat_reports WHERE at < ?', before);
}

/** Satın alma kayıtları: işlem yılının sonundan başlayarak 10 yıl (VUK m.253, TTK m.82), sonra silinir (gizlilik metni §3). */
export function prunePurchases(app: App): void {
  const y = Number(new Date(app.now() + 3 * 3_600_000).toISOString().slice(0, 4)); // İstanbul (UTC+3) takvim yılı
  // y - PURCHASE_RETAIN_YEARS yılının başından önceki işlemlerin yılı, en az 10 yıl önce bitti
  const cutoff = Date.UTC(y - PURCHASE_RETAIN_YEARS, 0, 1) - 3 * 3_600_000;
  app.db.run('DELETE FROM purchases WHERE at < ?', cutoff);
}

/** Moderasyon kayıtları (şikâyetler) silinen hesaptan sonra en çok 90 gün tutulur (pruneReports zaten daha önce siler). */
export function pruneDeletedReports(app: App): void {
  const before = app.now() - REPORT_RETAIN_AFTER_DELETE_MS;
  const old = 'SELECT player_id FROM deleted_players WHERE at < ?';
  app.db.run(`DELETE FROM player_reports WHERE target IN (${old}) OR reporter IN (${old})`, before, before);
  app.db.run(`DELETE FROM chat_reports WHERE reporter IN (${old})`, before);
}

export const accountHandlers: Handlers = {
  'account.delete': (app, s) => {
    deleteAccount(app, s.pid);
    // bu bağlantı artık hiçbir hesaba bağlı değil: silinen hesapla işlem yapılamaz (yanıt yine gider)
    const pid = s.pid; const conn = s.conn;
    app.after(() => {
      if (app.online.get(pid) === conn) app.online.delete(pid);
      for (const r of [...conn.rooms]) app.unsubscribe(pid, r);
      conn.pid = null;
    });
    return { deleted: true as const };
  },
};
