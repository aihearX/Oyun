/**
 * Kalıcı rozetler ve unvanlar (YN-041 "Kurucu Yolcular"; docs/10-sunucu.md "Rozetler"). Yalnız görünüş: güç, ekonomi ya da
 * sıralama etkisi yok. Kişisel veri yok; "Kurucular" ekranı yalnız takma ad gösterir ve yalnız `listede = 1` seçen oyuncuyu.
 *
 * - `player_badges` (göç 5): oyuncu + rozet birincil anahtar → aynı hesap aynı rozeti iki kez alamaz. `listede` (Kurucular ekranı,
 *   varsayılan 0) ve `cerceve` (profil çerçevesi giyili mi) oyuncunun seçimidir. Hesap silinince satır silinir (account-veri.ts "sil").
 * - Rozet yalnız iki yoldan gelir: tek kullanımlık kod (`npm run kod -- kurucu --adet N`, `avci --adet N`; codes.ts) ya da
 *   sunucu makinesindeki komut (`npm run kod -- unvan ARKADAŞ-KODU hata-avcisi`). Kodlar ve kurucu listesi depoya girmez.
 * - Yönetici hesapları kurucu sayılmaz (kodu kullanamaz, listede görünmez; codes.ts ADMIN_IDS_SQL).
 */
import { ROZET_IDS, type CerceveId, type RozetId } from '@odi/shared';
import type { App } from './app';
import { ADMIN_IDS_SQL } from './codes';

export const ROZET_SCHEMA = `
CREATE TABLE IF NOT EXISTS player_badges(player_id TEXT NOT NULL, badge TEXT NOT NULL, at INTEGER NOT NULL,
  listede INTEGER NOT NULL DEFAULT 0, cerceve INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(player_id, badge));
CREATE INDEX IF NOT EXISTS player_badges_badge ON player_badges(badge, at);
`;

export const isRozetId = (x: string): x is RozetId => (ROZET_IDS as readonly string[]).includes(x);

interface BadgeRow { badge: string; listede: number; cerceve: number }
const rows = (app: App, pid: string) => app.db.all<BadgeRow>('SELECT badge, listede, cerceve FROM player_badges WHERE player_id = ? ORDER BY at', pid);

export const hasBadge = (app: App, pid: string, b: RozetId) => !!app.db.get('SELECT 1 AS x FROM player_badges WHERE player_id = ? AND badge = ?', pid, b);

/** profil alanları: rozetler, giyili çerçeve (yalnız varsa; eski istemciler alanı görmez) ve kendi profili için liste seçimi */
export function badgeFields(app: App, pid: string): { rozetler?: RozetId[]; cerceve?: CerceveId; listede?: boolean } {
  const r = rows(app, pid).filter((x) => isRozetId(x.badge));
  if (!r.length) return {};
  const out: { rozetler?: RozetId[]; cerceve?: CerceveId; listede?: boolean } = { rozetler: r.map((x) => x.badge as RozetId) };
  const k = r.find((x) => x.badge === 'kurucu');
  if (k?.cerceve) out.cerceve = 'kurucu';
  if (k) out.listede = !!k.listede;
  return out;
}

/** rozeti ver (varsa dokunmaz). Dönüş: yeni verildi mi. Kurucu çerçevesi ilk verilişte giyili gelir (Dolap'tan çıkarılabilir). */
export function grantBadge(app: App, pid: string, b: RozetId): boolean {
  return app.db.run('INSERT INTO player_badges(player_id, badge, at, listede, cerceve) VALUES(?, ?, ?, 0, ?) ON CONFLICT(player_id, badge) DO NOTHING',
    pid, b, app.now(), b === 'kurucu' ? 1 : 0) > 0;
}
export function revokeBadge(app: App, pid: string, b: RozetId): boolean {
  return app.db.run('DELETE FROM player_badges WHERE player_id = ? AND badge = ?', pid, b) > 0;
}

/** oyuncunun seçimleri: Kurucular listesinde görünmek, çerçeve giymek. Rozeti yoksa false (değişiklik yok). */
export function setBadgePrefs(app: App, pid: string, o: { listede?: boolean; cerceve?: CerceveId | '' }): boolean {
  if (!hasBadge(app, pid, 'kurucu')) return false;
  if (o.listede !== undefined) app.db.run("UPDATE player_badges SET listede = ? WHERE player_id = ? AND badge = 'kurucu'", o.listede ? 1 : 0, pid);
  if (o.cerceve !== undefined) app.db.run("UPDATE player_badges SET cerceve = ? WHERE player_id = ? AND badge = 'kurucu'", o.cerceve === 'kurucu' ? 1 : 0, pid);
  return true;
}

/** "Kurucular" ekranı: listede görünmeyi seçenlerin takma adları, kod kullanım sırasıyla (yönetici ve silinmiş hesaplar yok) */
export function kurucuListesi(app: App): { names: string[]; gizli: number } {
  const all = app.db.all<{ name: string; listede: number }>(
    `SELECT p.name AS name, b.listede AS listede FROM player_badges b JOIN players p ON p.id = b.player_id
     WHERE b.badge = 'kurucu' AND b.player_id NOT IN (${ADMIN_IDS_SQL}) ORDER BY b.at, b.rowid`);
  return { names: all.filter((r) => r.listede).map((r) => r.name), gizli: all.filter((r) => !r.listede).length };
}

/** sunucu makinesi özeti (`npm run kod -- kurucular`): yalnız sayılar */
export function kurucuSayisi(app: App): { toplam: number; listede: number } {
  const l = kurucuListesi(app);
  return { toplam: l.names.length + l.gizli, listede: l.names.length };
}
