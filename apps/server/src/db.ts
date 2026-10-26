import { DatabaseSync, type StatementSync, type SQLInputValue } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { EVENTS_SCHEMA } from './events/schema';
import { COMM_SCHEMA } from './comm/schema';
import { CAMP_SCHEMA } from './camp-schema';
import { RANK_SCHEMA } from './rank';
import { TLIG_SCHEMA, TRACE_SCHEMA } from './teamrace';
import { CODES_SCHEMA } from './codes';
import { TEAM_APPLY_SCHEMA } from './teamapply-schema';
import { KG_SCHEMA } from './camp-quests-schema';
import { ACCOUNT_SCHEMA } from './account-schema';
import { runMigrations } from './migrations';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS players(
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  color INTEGER NOT NULL,
  hat TEXT NOT NULL DEFAULT '',
  friend_code TEXT NOT NULL UNIQUE,
  xp INTEGER NOT NULL DEFAULT 0,
  highest INTEGER NOT NULL DEFAULT 1,
  stars INTEGER NOT NULL DEFAULT 0,
  team_id TEXT,
  team_role TEXT,
  team_joined_at INTEGER,
  league_tier TEXT NOT NULL DEFAULT 'bronz',
  jeton INTEGER NOT NULL DEFAULT 0,
  kristal INTEGER NOT NULL DEFAULT 0,
  m5 INTEGER NOT NULL DEFAULT 0,
  m60 INTEGER NOT NULL DEFAULT 0,
  s8 INTEGER NOT NULL DEFAULT 0,
  shields INTEGER NOT NULL DEFAULT 0,
  cosmetics TEXT NOT NULL DEFAULT '[]',
  cards TEXT NOT NULL DEFAULT '{}',
  muted TEXT NOT NULL DEFAULT '[]',
  chat_muted_until INTEGER NOT NULL DEFAULT 0,
  last_chat_at INTEGER NOT NULL DEFAULT 0,
  depot_at INTEGER NOT NULL,
  pass_until INTEGER NOT NULL DEFAULT 0,
  pass_day TEXT NOT NULL DEFAULT '',
  spend_limit INTEGER NOT NULL DEFAULT 1000,
  spend_pending INTEGER,
  spend_pending_at INTEGER,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS players_team ON players(team_id);
CREATE TABLE IF NOT EXISTS level_best(player_id TEXT NOT NULL, level INTEGER NOT NULL, stars INTEGER NOT NULL, score INTEGER NOT NULL, PRIMARY KEY(player_id, level));
CREATE TABLE IF NOT EXISTS friends(a TEXT NOT NULL, b TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(a, b));
CREATE TABLE IF NOT EXISTS chat(id TEXT PRIMARY KEY, room TEXT NOT NULL, from_id TEXT NOT NULL, name TEXT NOT NULL, color INTEGER NOT NULL, text TEXT NOT NULL, kind TEXT NOT NULL, at INTEGER NOT NULL, meta TEXT, hidden INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS chat_room ON chat(room, at);
CREATE TABLE IF NOT EXISTS chat_cid(player_id TEXT NOT NULL, cid TEXT NOT NULL, msg_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(player_id, cid));
CREATE TABLE IF NOT EXISTS chat_reports(msg_id TEXT NOT NULL, reporter TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(msg_id, reporter));
CREATE TABLE IF NOT EXISTS teams(id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, emblem TEXT NOT NULL, description TEXT NOT NULL, open INTEGER NOT NULL, code TEXT NOT NULL UNIQUE, min_level INTEGER NOT NULL, xp INTEGER NOT NULL DEFAULT 0, targets TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS help_requests(id TEXT PRIMARY KEY, team_id TEXT NOT NULL, from_id TEXT NOT NULL, level INTEGER NOT NULL, helpers TEXT NOT NULL DEFAULT '[]', max INTEGER NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS help_team ON help_requests(team_id, at);
CREATE TABLE IF NOT EXISTS daily(player_id TEXT NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY(player_id, day, kind));
CREATE TABLE IF NOT EXISTS buildings(player_id TEXT NOT NULL, id TEXT NOT NULL, level INTEGER NOT NULL, upgrading_to INTEGER, started_at INTEGER, ends_at INTEGER, helps INTEGER NOT NULL DEFAULT 0, help_req INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(player_id, id));
CREATE INDEX IF NOT EXISTS buildings_end ON buildings(ends_at);
CREATE TABLE IF NOT EXISTS camp_helps(player_id TEXT NOT NULL, building TEXT NOT NULL, to_level INTEGER NOT NULL, helper_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(player_id, building, to_level, helper_id));
CREATE TABLE IF NOT EXISTS team_tech(team_id TEXT NOT NULL, tech TEXT NOT NULL, level INTEGER NOT NULL, progress INTEGER NOT NULL, PRIMARY KEY(team_id, tech));
CREATE TABLE IF NOT EXISTS contrib(week TEXT NOT NULL, team_id TEXT NOT NULL, player_id TEXT NOT NULL, donated INTEGER NOT NULL DEFAULT 0, helps INTEGER NOT NULL DEFAULT 0, stars INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(week, team_id, player_id));
CREATE TABLE IF NOT EXISTS team_gifts(id TEXT PRIMARY KEY, team_id TEXT NOT NULL, from_id TEXT NOT NULL, from_name TEXT NOT NULL, reason TEXT NOT NULL, contents TEXT NOT NULL, at INTEGER NOT NULL, expires_at INTEGER NOT NULL, goal_ref TEXT);
CREATE INDEX IF NOT EXISTS gifts_team ON team_gifts(team_id, at);
CREATE TABLE IF NOT EXISTS gift_recipients(gift_id TEXT NOT NULL, player_id TEXT NOT NULL, claimed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(gift_id, player_id));
CREATE TABLE IF NOT EXISTS goal_progress(week TEXT NOT NULL, team_id TEXT NOT NULL, metric TEXT NOT NULL, progress INTEGER NOT NULL, PRIMARY KEY(week, team_id, metric));
CREATE TABLE IF NOT EXISTS war_points(week TEXT NOT NULL, team_id TEXT NOT NULL, region TEXT NOT NULL, points INTEGER NOT NULL, PRIMARY KEY(week, team_id, region));
CREATE TABLE IF NOT EXISTS war_owner(week TEXT NOT NULL, region TEXT NOT NULL, team_id TEXT NOT NULL, points INTEGER NOT NULL, PRIMARY KEY(week, region));
CREATE TABLE IF NOT EXISTS team_week(week TEXT NOT NULL, team_id TEXT NOT NULL, points INTEGER NOT NULL, PRIMARY KEY(week, team_id));
CREATE TABLE IF NOT EXISTS player_week(week TEXT NOT NULL, player_id TEXT NOT NULL, war_points INTEGER NOT NULL, PRIMARY KEY(week, player_id));
CREATE TABLE IF NOT EXISTS raids(raid_id TEXT NOT NULL, team_id TEXT NOT NULL, max_hp INTEGER NOT NULL, hp INTEGER NOT NULL, opened_at INTEGER NOT NULL, defeated_at INTEGER, PRIMARY KEY(raid_id, team_id));
CREATE TABLE IF NOT EXISTS raid_damage(raid_id TEXT NOT NULL, team_id TEXT NOT NULL, player_id TEXT NOT NULL, damage INTEGER NOT NULL, PRIMARY KEY(raid_id, team_id, player_id));
CREATE TABLE IF NOT EXISTS league_groups(id TEXT PRIMARY KEY, week TEXT NOT NULL, tier TEXT NOT NULL, n INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS league_groups_week ON league_groups(week, tier);
CREATE TABLE IF NOT EXISTS league(week TEXT NOT NULL, player_id TEXT NOT NULL, tier TEXT NOT NULL, group_id TEXT NOT NULL, points INTEGER NOT NULL, joined_at INTEGER NOT NULL, PRIMARY KEY(week, player_id));
CREATE INDEX IF NOT EXISTS league_group ON league(group_id);
CREATE TABLE IF NOT EXISTS inbox(id TEXT PRIMARY KEY, player_id TEXT NOT NULL, kind TEXT NOT NULL, amount INTEGER NOT NULL, ref TEXT NOT NULL, reason TEXT NOT NULL, at INTEGER NOT NULL, claimed INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS inbox_player ON inbox(player_id, claimed);
CREATE TABLE IF NOT EXISTS purchases(id TEXT PRIMARY KEY, player_id TEXT NOT NULL, product_id TEXT NOT NULL, at INTEGER NOT NULL, store TEXT NOT NULL, amount_try REAL NOT NULL, receipt TEXT UNIQUE);
CREATE INDEX IF NOT EXISTS purchases_player ON purchases(player_id, at);
CREATE TABLE IF NOT EXISTS progress_runs(player_id TEXT NOT NULL, run_id TEXT NOT NULL, ack TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(player_id, run_id));
CREATE INDEX IF NOT EXISTS progress_runs_at ON progress_runs(at);
CREATE TABLE IF NOT EXISTS local_grants(player_id TEXT NOT NULL, ledger_id TEXT NOT NULL, jeton INTEGER NOT NULL, credited INTEGER NOT NULL, reason TEXT NOT NULL, day TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(player_id, ledger_id));
CREATE INDEX IF NOT EXISTS local_grants_day ON local_grants(player_id, day);
CREATE TABLE IF NOT EXISTS player_skills(player_id TEXT NOT NULL, skill_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(player_id, skill_id));
-- arkadaşlık istekleri, engeller, arkadaş hediyeleri, şikâyetler, özel mesajlar (dm)
CREATE TABLE IF NOT EXISTS friend_requests(id TEXT PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL, at INTEGER NOT NULL, UNIQUE(from_id, to_id));
CREATE INDEX IF NOT EXISTS friend_requests_to ON friend_requests(to_id, at);
CREATE TABLE IF NOT EXISTS blocks(a TEXT NOT NULL, b TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(a, b));
CREATE INDEX IF NOT EXISTS blocks_b ON blocks(b);
CREATE TABLE IF NOT EXISTS friend_gifts(day TEXT NOT NULL, from_id TEXT NOT NULL, to_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(day, from_id, to_id));
CREATE TABLE IF NOT EXISTS player_reports(target TEXT NOT NULL, reporter TEXT NOT NULL, msg_id TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(target, reporter, msg_id));
CREATE TABLE IF NOT EXISTS dm(seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, pair TEXT NOT NULL, from_id TEXT NOT NULL, to_id TEXT NOT NULL, text TEXT NOT NULL, kind TEXT NOT NULL, meta TEXT, at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS dm_pair ON dm(pair, seq);
CREATE INDEX IF NOT EXISTS dm_to ON dm(to_id, seq);
CREATE INDEX IF NOT EXISTS dm_from ON dm(from_id, seq);
CREATE TABLE IF NOT EXISTS dm_reactions(msg_id TEXT NOT NULL, player_id TEXT NOT NULL, emoji TEXT NOT NULL, PRIMARY KEY(msg_id, player_id));
CREATE TABLE IF NOT EXISTS dm_reads(player_id TEXT NOT NULL, other_id TEXT NOT NULL, seq INTEGER NOT NULL, PRIMARY KEY(player_id, other_id));
`;

export type Row = Record<string, SQLInputValue>;

/** node:sqlite üstünde ince katman: hazırlanmış ifade önbelleği + işlem (transaction) yardımcıları. */
export class Db {
  readonly raw: DatabaseSync;
  private cache = new Map<string, StatementSync>();
  private depth = 0;

  constructor(file: string) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    this.raw = new DatabaseSync(file);
    if (file !== ':memory:') this.raw.exec('PRAGMA journal_mode = WAL;');
    this.raw.exec('PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = OFF; PRAGMA busy_timeout = 2000;');
    this.raw.exec(SCHEMA);
    this.raw.exec(EVENTS_SCHEMA);
    this.raw.exec(COMM_SCHEMA);
    this.raw.exec(CAMP_SCHEMA);
    this.raw.exec(RANK_SCHEMA);
    this.raw.exec(TRACE_SCHEMA);
    this.raw.exec(TLIG_SCHEMA);
    this.raw.exec(CODES_SCHEMA);
    this.raw.exec(TEAM_APPLY_SCHEMA); // takım başvuruları (yalnızca yeni tablo; eski open = 0 takımlar veri değişmeden 'basvuru' sayılır)
    this.raw.exec(KG_SCHEMA);
    this.raw.exec(ACCOUNT_SCHEMA); // silinen hesaplar (yalnızca yeni tablo)
    // var olan tablolara sütun ekleme / veri dönüştürme: sıralı göçler (migrations.ts, PRAGMA user_version)
    const m = runMigrations(this.raw);
    if (m.warning) console.warn(`[şema] ${m.warning}`);
  }

  private stmt(sql: string): StatementSync {
    let s = this.cache.get(sql);
    if (!s) { s = this.raw.prepare(sql); this.cache.set(sql, s); }
    return s;
  }
  get<T = Row>(sql: string, ...p: SQLInputValue[]): T | undefined { return this.stmt(sql).get(...p) as T | undefined; }
  all<T = Row>(sql: string, ...p: SQLInputValue[]): T[] { return this.stmt(sql).all(...p) as T[]; }
  run(sql: string, ...p: SQLInputValue[]): number { return Number(this.stmt(sql).run(...p).changes); }

  /** iç içe çağrılabilir; en dıştaki çağrı BEGIN/COMMIT yapar, hata olursa ROLLBACK */
  tx<T>(fn: () => T): T {
    if (this.depth > 0) { this.depth++; try { return fn(); } finally { this.depth--; } }
    this.raw.exec('BEGIN IMMEDIATE');
    this.depth = 1;
    try {
      const r = fn();
      this.raw.exec('COMMIT');
      return r;
    } catch (e) {
      try { this.raw.exec('ROLLBACK'); } catch {}
      throw e;
    } finally { this.depth = 0; }
  }
  get inTx(): boolean { return this.depth > 0; }

  metaGet(k: string): string | undefined { return this.get<{ v: string }>('SELECT v FROM meta WHERE k = ?', k)?.v; }
  metaSet(k: string, v: string): void { this.run('INSERT INTO meta(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, v); }
  close(): void { this.cache.clear(); this.raw.close(); }
}
