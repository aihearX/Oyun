/** Takım başvuruları (teamapply.ts). Yalnızca yeni tablo: mevcut veritabanında tekrar tekrar açılsa da güvenli (IF NOT EXISTS). */
export const TEAM_APPLY_SCHEMA = `
CREATE TABLE IF NOT EXISTS team_apps(id TEXT PRIMARY KEY, team_id TEXT NOT NULL, player_id TEXT NOT NULL, team_name TEXT NOT NULL, team_emblem TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '', note_kind TEXT NOT NULL DEFAULT 'yok', status TEXT NOT NULL DEFAULT 'bekliyor', reason TEXT NOT NULL DEFAULT '',
  at INTEGER NOT NULL, expires_at INTEGER NOT NULL, decided_at INTEGER, decided_by TEXT, seen INTEGER NOT NULL DEFAULT 1);
CREATE INDEX IF NOT EXISTS team_apps_team ON team_apps(team_id, status);
CREATE INDEX IF NOT EXISTS team_apps_player ON team_apps(player_id, status);
CREATE INDEX IF NOT EXISTS team_apps_exp ON team_apps(status, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS team_apps_one ON team_apps(team_id, player_id) WHERE status = 'bekliyor';
`;
