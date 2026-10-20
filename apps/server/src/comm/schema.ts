/** İletişim tabloları (db.ts kurulumda çalıştırır). Ödül tablolarının birincil anahtarları "bir kez" kuralını garanti eder. */
export const COMM_SCHEMA = `
CREATE TABLE IF NOT EXISTS comm_settings(player_id TEXT PRIMARY KEY, free_text INTEGER NOT NULL DEFAULT 0, feed_share INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS comm_metrics(day TEXT NOT NULL, k TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY(day, k));
-- sohbet tepkileri ve konular (yanıtlar)
CREATE TABLE IF NOT EXISTS chat_reactions(msg_id TEXT NOT NULL, player_id TEXT NOT NULL, reaction TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(msg_id, player_id));
CREATE TABLE IF NOT EXISTS chat_thread(parent_id TEXT NOT NULL, msg_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(parent_id, msg_id));
CREATE INDEX IF NOT EXISTS chat_thread_msg ON chat_thread(msg_id);
-- Takım Akışı: birleştirme penceresi (oyuncu + tür başına son kart)
CREATE TABLE IF NOT EXISTS feed_recent(team_id TEXT NOT NULL, player_id TEXT NOT NULL, type TEXT NOT NULL, msg_id TEXT NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(team_id, player_id, type));
CREATE TABLE IF NOT EXISTS play_days(player_id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY(player_id, day));
CREATE TABLE IF NOT EXISTS level_koklea(player_id TEXT NOT NULL, level INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY(player_id, level));
-- meydan okuma kartları
CREATE TABLE IF NOT EXISTS challenges(msg_id TEXT PRIMARY KEY, team_id TEXT NOT NULL, player_id TEXT NOT NULL, level INTEGER NOT NULL, score INTEGER NOT NULL, until INTEGER NOT NULL, day TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS challenges_team ON challenges(team_id, level, until);
CREATE TABLE IF NOT EXISTS challenge_beats(msg_id TEXT NOT NULL, player_id TEXT NOT NULL, score INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(msg_id, player_id));
-- yardım: kart eşlemesi, yardım eylemleri, çözülme
CREATE TABLE IF NOT EXISTS help_cards(request_id TEXT PRIMARY KEY, msg_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS help_actions(request_id TEXT NOT NULL, helper_id TEXT NOT NULL, kind TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(request_id, helper_id, kind));
CREATE TABLE IF NOT EXISTS help_resolved(request_id TEXT PRIMARY KEY, at INTEGER NOT NULL);
-- Günün Sorusu
CREATE TABLE IF NOT EXISTS dq(team_id TEXT NOT NULL, day TEXT NOT NULL, week TEXT NOT NULL, qidx INTEGER NOT NULL, msg_id TEXT NOT NULL, level TEXT NOT NULL, created_at INTEGER NOT NULL, reveal_at INTEGER NOT NULL, revealed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(team_id, day));
CREATE INDEX IF NOT EXISTS dq_reveal ON dq(revealed, reveal_at);
CREATE TABLE IF NOT EXISTS dq_answers(team_id TEXT NOT NULL, day TEXT NOT NULL, player_id TEXT NOT NULL, choice INTEGER NOT NULL, correct INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL, PRIMARY KEY(team_id, day, player_id));
CREATE TABLE IF NOT EXISTS dq_rewards(player_id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY(player_id, day));
CREATE TABLE IF NOT EXISTS team_comm(team_id TEXT PRIMARY KEY, study INTEGER NOT NULL DEFAULT 0);
-- İkili Görev
CREATE TABLE IF NOT EXISTS duo(id TEXT PRIMARY KEY, week TEXT NOT NULL, a TEXT NOT NULL, b TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS duo_a ON duo(week, a);
CREATE INDEX IF NOT EXISTS duo_b ON duo(week, b);
CREATE TABLE IF NOT EXISTS duo_invites(id TEXT PRIMARY KEY, week TEXT NOT NULL, from_id TEXT NOT NULL, to_id TEXT NOT NULL, at INTEGER NOT NULL, UNIQUE(week, from_id, to_id));
CREATE TABLE IF NOT EXISTS duo_notes(duo_id TEXT NOT NULL, player_id TEXT NOT NULL, notes INTEGER NOT NULL, PRIMARY KEY(duo_id, player_id));
CREATE TABLE IF NOT EXISTS duo_tiers(duo_id TEXT NOT NULL, tier INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(duo_id, tier));
-- Usta–Çırak
CREATE TABLE IF NOT EXISTS mentor_links(id TEXT PRIMARY KEY, mentor TEXT NOT NULL, apprentice TEXT NOT NULL, since INTEGER NOT NULL, start_highest INTEGER NOT NULL, ended_at INTEGER, reason TEXT);
CREATE INDEX IF NOT EXISTS mentor_links_m ON mentor_links(mentor, ended_at);
CREATE INDEX IF NOT EXISTS mentor_links_a ON mentor_links(apprentice, ended_at);
CREATE TABLE IF NOT EXISTS mentor_offers(id TEXT PRIMARY KEY, mentor TEXT NOT NULL, apprentice TEXT NOT NULL, by_id TEXT NOT NULL, at INTEGER NOT NULL, UNIQUE(mentor, apprentice));
CREATE TABLE IF NOT EXISTS mentor_milestones(apprentice TEXT NOT NULL, milestone INTEGER NOT NULL, mentor TEXT NOT NULL, link_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(apprentice, milestone));
`;
