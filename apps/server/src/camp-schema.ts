/**
 * Kulak Kampı ek tabloları (docs/14-kamp.md). db.ts kurulumda her açılışta çalıştırır: yalnızca ekleyen (CREATE TABLE IF NOT
 * EXISTS / INSERT OR IGNORE) — var olan veritabanına güvenle uygulanır, iki kez çalışması bir şey değiştirmez.
 */
export const CAMP_SCHEMA = `
-- Tedavi Odası: çanta (envanter), üretim, koşu başına kullanım, kamp açılımları (kozmetik bir kez verilir)
CREATE TABLE IF NOT EXISTS remedy_inv(player_id TEXT NOT NULL, id TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY(player_id, id));
CREATE TABLE IF NOT EXISTS remedy_prod(player_id TEXT PRIMARY KEY, item TEXT, since INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS remedy_use(player_id TEXT NOT NULL, run_id TEXT NOT NULL, used TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(player_id, run_id));
CREATE TABLE IF NOT EXISTS camp_unlocks(player_id TEXT NOT NULL, ref TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(player_id, ref));
-- yeni bina (tedavi): eski oyuncuların satırı yoksa Sv 0 olarak eklenir
INSERT OR IGNORE INTO buildings(player_id, id, level) SELECT id, 'tedavi', 0 FROM players;
`;
