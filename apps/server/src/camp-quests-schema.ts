/**
 * Kamp Görevleri ve kamp etkinlikleri tabloları (docs/17-kamp-gorevleri.md). db.ts her açılışta çalıştırır: yalnız ekleyen
 * (CREATE TABLE IF NOT EXISTS) — var olan veritabanına güvenle uygulanır, iki kez çalışması bir şey değiştirmez.
 */
export const KG_SCHEMA = `
-- sayaçlar: kapsam 'all' (toplam), 'd:<gün>' (İstanbul günü), 'w:<hafta>' (ISO hafta)
CREATE TABLE IF NOT EXISTS kg_count(player_id TEXT NOT NULL, scope TEXT NOT NULL, metric TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY(player_id, scope, metric));
-- bir olay bir kez sayılır (koşu kimliği, oyun turu, vaka denemesi …)
CREATE TABLE IF NOT EXISTS kg_seen(player_id TEXT NOT NULL, key TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(player_id, key));
-- alınan ödüller: her ref bir kez (hikâye bölümü, günlük görev, haftalık basamak, başarı basamağı, takım kliniği)
CREATE TABLE IF NOT EXISTS kg_claim(player_id TEXT NOT NULL, ref TEXT NOT NULL, at INTEGER NOT NULL, reward TEXT NOT NULL, PRIMARY KEY(player_id, ref));
-- günün görevleri (gün başında seçilir, gün içinde değişmez) ve haftanın hedefi
CREATE TABLE IF NOT EXISTS kg_daily(player_id TEXT NOT NULL, day TEXT NOT NULL, tasks TEXT NOT NULL, rerolls INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(player_id, day));
-- hikâyenin "ya da" adımları: bölüm açıldığında sayacın değeri (bir kez yazılır; adım bundan sonra yapılanı sayar)
CREATE TABLE IF NOT EXISTS kg_story_base(player_id TEXT NOT NULL, chapter INTEGER NOT NULL, metric TEXT NOT NULL, n INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(player_id, chapter, metric));
CREATE TABLE IF NOT EXISTS kg_week(player_id TEXT NOT NULL, week TEXT NOT NULL, goal TEXT NOT NULL, PRIMARY KEY(player_id, week));
-- kamp büyümesi sistemine (Kamp XP, dekor) gidecek ödüller: sistem yokken bekler, gelince bir kez uygulanır
CREATE TABLE IF NOT EXISTS kg_pending(player_id TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL, amount INTEGER NOT NULL, item TEXT, at INTEGER NOT NULL, applied INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(player_id, kind, ref));
-- Hasta Vakaları: Vaka Defteri, bekleme salonu, denemeler (deneme kimliği bir kez), konsültasyon ve oylar, takım kliniği haftası
CREATE TABLE IF NOT EXISTS kv_book(player_id TEXT NOT NULL, case_id TEXT NOT NULL, stars INTEGER NOT NULL DEFAULT 0, plays INTEGER NOT NULL DEFAULT 0, solved_at INTEGER, tests INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(player_id, case_id));
CREATE TABLE IF NOT EXISTS kv_queue(player_id TEXT NOT NULL, case_id TEXT NOT NULL, arrived_at INTEGER NOT NULL, day TEXT NOT NULL, PRIMARY KEY(player_id, case_id));
CREATE TABLE IF NOT EXISTS kv_attempt(player_id TEXT NOT NULL, attempt TEXT NOT NULL, case_id TEXT NOT NULL, result TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(player_id, attempt));
CREATE TABLE IF NOT EXISTS kv_konsult(msg_id TEXT PRIMARY KEY, team_id TEXT NOT NULL, player_id TEXT NOT NULL, case_id TEXT NOT NULL, day TEXT NOT NULL, at INTEGER NOT NULL, done INTEGER NOT NULL DEFAULT 0, rewarded INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS kv_konsult_player ON kv_konsult(player_id, case_id);
CREATE TABLE IF NOT EXISTS kv_oy(msg_id TEXT NOT NULL, player_id TEXT NOT NULL, choice INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(msg_id, player_id));
CREATE TABLE IF NOT EXISTS kv_team_week(team_id TEXT NOT NULL, week TEXT NOT NULL, player_id TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY(team_id, week, player_id));
-- kamp oyunları (Ton Avı, Timpanogram Eşleştir): tur başı tohum sunucuda; sonuç bir kez
CREATE TABLE IF NOT EXISTS ko_round(id TEXT PRIMARY KEY, player_id TEXT NOT NULL, game TEXT NOT NULL, seed INTEGER NOT NULL, duzey TEXT NOT NULL, started_at INTEGER NOT NULL, done INTEGER NOT NULL DEFAULT 0, score INTEGER);
CREATE INDEX IF NOT EXISTS ko_round_player ON ko_round(player_id, started_at);
-- Timpanogram Eşleştir: turun soruları ve oyuncunun kişisel destesi (karıştırılmış havuz + imleç; deste bitince yeni deste)
CREATE TABLE IF NOT EXISTS ko_items(round_id TEXT PRIMARY KEY, items TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ko_deck(player_id TEXT NOT NULL, duzey TEXT NOT NULL, deck TEXT NOT NULL, pos INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(player_id, duzey));
`;
