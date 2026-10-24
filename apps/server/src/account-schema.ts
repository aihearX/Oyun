/** Hesabı silme (account.ts). Yalnızca yeni tablo: mevcut veritabanında tekrar tekrar açılsa da güvenli (IF NOT EXISTS). */
export const ACCOUNT_SCHEMA = `
CREATE TABLE IF NOT EXISTS deleted_players(player_id TEXT PRIMARY KEY, at INTEGER NOT NULL);
`;
