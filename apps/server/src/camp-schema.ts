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
-- Kamp büyümesi (docs/14-kamp.md §8–12): Kamp XP (geriye dönük tohum ilk okumada), XP günlüğü (ref ile bir kez), süsler, alkışlar
CREATE TABLE IF NOT EXISTS camp_xp(player_id TEXT PRIMARY KEY, xp INTEGER NOT NULL DEFAULT 0, lib_at INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS camp_xp_log(player_id TEXT NOT NULL, ref TEXT NOT NULL, amount INTEGER NOT NULL, reason TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(player_id, ref));
CREATE TABLE IF NOT EXISTS decor_inv(player_id TEXT NOT NULL, id TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY(player_id, id));
CREATE TABLE IF NOT EXISTS decor_placed(uid INTEGER PRIMARY KEY AUTOINCREMENT, player_id TEXT NOT NULL, id TEXT NOT NULL, gx INTEGER NOT NULL, gy INTEGER NOT NULL, flip INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS decor_placed_p ON decor_placed(player_id);
CREATE TABLE IF NOT EXISTS camp_cheers(from_id TEXT NOT NULL, to_id TEXT NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(from_id, to_id, day));
CREATE INDEX IF NOT EXISTS camp_cheers_to ON camp_cheers(to_id);
-- yeni bölge binaları: eski oyuncuların satırı yoksa Sv 0 olarak eklenir
INSERT OR IGNORE INTO buildings(player_id, id, level) SELECT id, 'kabin', 0 FROM players;
INSERT OR IGNORE INTO buildings(player_id, id, level) SELECT id, 'tarama', 0 FROM players;
INSERT OR IGNORE INTO buildings(player_id, id, level) SELECT id, 'park', 0 FROM players;
INSERT OR IGNORE INTO buildings(player_id, id, level) SELECT id, 'denge', 0 FROM players;
INSERT OR IGNORE INTO buildings(player_id, id, level) SELECT id, 'kutuphane', 0 FROM players;
-- inşaat sırası (docs/14-kamp.md "İnşaat sırası"): oyuncu başına tek yer; bedel sıraya alınırken ödenir (jeton = geri verilecek tutar)
CREATE TABLE IF NOT EXISTS camp_queue(player_id TEXT PRIMARY KEY, id TEXT NOT NULL, to_level INTEGER NOT NULL, jeton INTEGER NOT NULL, at INTEGER NOT NULL);
`;
