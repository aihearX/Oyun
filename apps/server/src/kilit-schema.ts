/**
 * 1.2.0 tabloları (göç 20; kilit.ts, kurucu-liste.ts). Ayrı dosya: göçler (db.ts) oyuncu modüllerini içe aktarmasın.
 * - player_unlocks: yöneticinin hediye ettiği, oyuncunun "Al"la kabul ettiği kilit açılımları (oyuncu başına tek satır, birikir).
 *   Gerçek ilerleme (players.highest, yıldızlar) ayrı kalır. granted_by: son açılımı veren yönetici (denetim).
 * - kurucu_liste: yöneticinin düzenlediği Kurucular ekranı (kim, hangi sırayla, hangi adla ve unvanla, fotoğraf gizli mi).
 * - comm_settings.dm_kimden: "Kimler mesaj atabilir" (herkes | takim | arkadas; varsayılan herkes).
 */
export const KILIT_SCHEMA = `
CREATE TABLE IF NOT EXISTS player_unlocks(player_id TEXT PRIMARY KEY, levels_upto INTEGER NOT NULL DEFAULT 0, features TEXT NOT NULL DEFAULT '[]',
  granted_at INTEGER NOT NULL, granted_by TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS kurucu_liste(player_id TEXT PRIMARY KEY, sira INTEGER NOT NULL, gorunen_ad TEXT NOT NULL DEFAULT '', unvan TEXT NOT NULL DEFAULT '',
  foto_gizli INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS kurucu_liste_sira ON kurucu_liste(sira);
`;
