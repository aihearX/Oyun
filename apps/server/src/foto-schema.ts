/** profil fotoğrafı tablosu (göç 18; foto.ts). Ayrı dosya: göçler (db.ts) oyuncu modüllerini içe aktarmasın. */
export const PHOTO_SCHEMA = `
CREATE TABLE IF NOT EXISTS player_photos(player_id TEXT PRIMARY KEY, jpeg BLOB NOT NULL, version INTEGER NOT NULL, bytes INTEGER NOT NULL,
  at INTEGER NOT NULL, hidden INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS player_photos_at ON player_photos(at);
`;
