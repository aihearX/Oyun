/**
 * Sıralama (docs/15-siralama.md): oyuncu ve takım tabloları. Puanların HEPSİ sunucunun doğruladığı olaylardan gelir:
 *  - bölüm/yıldız yalnızca progress.submit doğrulamasından geçen koşulardan (rank_level; çevrimdışı eşitleme progress.sync SAYILMAZ),
 *  - haftalık yıldız = o hafta kazanılan YENİ yıldız (tekrar oynamak saymaz), nota günlük üst sınırlı, yarış galibiyeti en az iki
 *    kişinin bitirdiği yarışlarda ve günlük üst sınırlı, Günün Sorusu günde bir.
 * Haftalık tablolar Pazartesi 00:00 (İstanbul) kapanır: son sıralama saklanır (rank_final), ilk sıralara sabit ödül BİR KEZ
 * (rank_rewards birincil anahtarı), takım sohbetine duyuru. Gün başında sıralar kaydedilir (rank_snap) → ▲▼ değişim.
 */
import {
  RANK_BOARDS, RANK_RULES, rankBoardById, type RankBoardId, type RankBoardView, type RankRowView, type RankScope,
} from '@odi/shared';
import { fail, type App, type Handlers } from '../app';
import { postCard, systemMessage, teamRoom } from '../chat';
import { dayKey, weekInfo, DAY_MS, WEEK_MS } from '../time';
import { feedShareOn, metric } from '../comm/settings';
import { seasonTable } from '../teamrace/league';
import { ADMIN_IDS_SQL, isAdmin } from '../codes';

export const RANK_SCHEMA = `
CREATE TABLE IF NOT EXISTS rank_level(player_id TEXT NOT NULL, level INTEGER NOT NULL, stars INTEGER NOT NULL, PRIMARY KEY(player_id, level));
CREATE TABLE IF NOT EXISTS rank_week(week TEXT NOT NULL, player_id TEXT NOT NULL, stars INTEGER NOT NULL DEFAULT 0, notes INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(week, player_id));
CREATE TABLE IF NOT EXISTS rank_day(day TEXT NOT NULL, player_id TEXT NOT NULL, notes INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day, player_id));
CREATE TABLE IF NOT EXISTS rank_snap(day TEXT NOT NULL, board TEXT NOT NULL, id TEXT NOT NULL, rank INTEGER NOT NULL, PRIMARY KEY(day, board, id));
CREATE TABLE IF NOT EXISTS rank_final(week TEXT NOT NULL, board TEXT NOT NULL, id TEXT NOT NULL, rank INTEGER NOT NULL, value INTEGER NOT NULL, name TEXT NOT NULL, color INTEGER, hat TEXT, emblem TEXT, PRIMARY KEY(week, board, id));
CREATE TABLE IF NOT EXISTS rank_rewards(week TEXT NOT NULL, board TEXT NOT NULL, player_id TEXT NOT NULL, rank INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(week, board, player_id));
`;

interface Entry { id: string; value: number; name: string; color?: number; hat?: string; emblem?: string; teamId?: string | null; teamName?: string | null }
interface Ranked extends Entry { rank: number; /** kapsam içi sıralamada genel sıra */ global?: number }

/** standart yarışma sırası: eşit puan eşit sıra (1, 2, 2, 4) */
function rankList(list: Entry[]): Ranked[] {
  const sorted = [...list].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'tr') || (a.id < b.id ? -1 : 1));
  const out: Ranked[] = [];
  sorted.forEach((e, i) => out.push({ ...e, rank: i > 0 && sorted[i - 1]!.value === e.value ? out[i - 1]!.rank : i + 1 }));
  return out;
}

// ------------------------------------------------------------------ tablo hesapları
const P = RANK_RULES.power;
interface PRow { id: string; name: string; color: number; hat: string; team_id: string | null; tname: string | null; v: number }
const playerRows = (app: App, sql: string, ...args: (string | number)[]) =>
  app.db.all<PRow>(`SELECT p.id, p.name, p.color, p.hat, p.team_id, t.name AS tname, x.v FROM (${sql}) x JOIN players p ON p.id = x.id LEFT JOIN teams t ON t.id = p.team_id WHERE x.v > 0 AND p.id NOT IN (${ADMIN_IDS_SQL})`, ...args)
    .map((r): Entry => ({ id: r.id, value: r.v, name: r.name, color: r.color, hat: r.hat, teamId: r.team_id, teamName: r.tname }));

/** oyuncu gücü (şeffaf formül): doğrulanmış yıldız/bölüm + kamp seviyeleri + açıklanmış Günün Sorusu doğruları */
const POWER_SQL = `SELECT p.id, (COALESCE(l.st, 0) * ${P.star} + COALESCE(l.n, 0) * ${P.level} + COALESCE(b.camp, 0) * ${P.camp} + COALESCE(q.dq, 0) * ${P.dq}) AS v
  FROM players p
  JOIN (SELECT player_id, SUM(stars) AS st, COUNT(*) AS n FROM rank_level GROUP BY player_id) l ON l.player_id = p.id
  LEFT JOIN (SELECT player_id, SUM(level) AS camp FROM buildings GROUP BY player_id) b ON b.player_id = p.id
  LEFT JOIN (SELECT a.player_id, SUM(a.correct) AS dq FROM dq_answers a JOIN dq d ON d.team_id = a.team_id AND d.day = a.day AND d.revealed = 1 GROUP BY a.player_id) q ON q.player_id = p.id`;
const DQ_WEEK_SQL = `SELECT a.player_id AS id, SUM(a.correct) AS v FROM dq_answers a JOIN dq d ON d.team_id = a.team_id AND d.day = a.day AND d.revealed = 1 WHERE d.week = ? AND a.player_id NOT IN (${ADMIN_IDS_SQL}) GROUP BY a.player_id`;

function compute(app: App, board: RankBoardId, week: string): Entry[] {
  switch (board) {
    case 'guc': return playerRows(app, POWER_SQL);
    case 'yildiz': return playerRows(app, 'SELECT player_id AS id, stars AS v FROM rank_week WHERE week = ?', week);
    case 'nota': return playerRows(app, 'SELECT player_id AS id, notes AS v FROM rank_week WHERE week = ?', week);
    case 'yaris': return playerRows(app, 'SELECT player_id AS id, wins AS v FROM rank_week WHERE week = ?', week);
    case 'soru': return playerRows(app, DQ_WEEK_SQL, week);
    default: return teamEntries(app, board, week);
  }
}
interface TRow { id: string; name: string; emblem: string; v: number }
function teamEntries(app: App, board: RankBoardId, week: string): Entry[] {
  let sql = '';
  const args: (string | number)[] = [];
  if (board === 't-guc') sql = `SELECT t.id, COALESCE(m.v, 0) + COALESCE(k.lv, 0) * ${RANK_RULES.teamTech} AS v FROM teams t
      LEFT JOIN (SELECT p.team_id, SUM(x.v) AS v FROM (${POWER_SQL}) x JOIN players p ON p.id = x.id WHERE p.team_id IS NOT NULL AND p.id NOT IN (${ADMIN_IDS_SQL}) GROUP BY p.team_id) m ON m.team_id = t.id
      LEFT JOIN (SELECT team_id, SUM(level) AS lv FROM team_tech GROUP BY team_id) k ON k.team_id = t.id`;
  else if (board === 't-savas') { sql = 'SELECT team_id AS id, points AS v FROM team_week WHERE week = ?'; args.push(week); }
  else if (board === 't-baskin') { sql = `SELECT team_id AS id, SUM(damage) AS v FROM raid_damage WHERE raid_id = ? AND player_id NOT IN (${ADMIN_IDS_SQL}) GROUP BY team_id`; args.push(week); }
  else if (board === 't-lig') return seasonTable(app).filter((x) => x.value > 0);
  else if (board === 't-soru') { sql = `SELECT a.team_id AS id, SUM(a.correct) AS v FROM dq_answers a JOIN dq d ON d.team_id = a.team_id AND d.day = a.day AND d.revealed = 1 WHERE d.week = ? AND a.player_id NOT IN (${ADMIN_IDS_SQL}) GROUP BY a.team_id`; args.push(week); }
  return app.db.all<TRow>(`SELECT t.id, t.name, t.emblem, x.v FROM (${sql}) x JOIN teams t ON t.id = x.id WHERE x.v > 0`, ...args)
    .map((r) => ({ id: r.id, value: r.v, name: r.name, emblem: r.emblem }));
}

/** önbellek (tablo + hafta başına 15 sn); yazımlar da önbelleği siler */
const cache = new WeakMap<App, Map<string, { at: number; list: Ranked[] }>>();
function ranked(app: App, board: RankBoardId, week = app.week().key): Ranked[] {
  let m = cache.get(app); if (!m) { m = new Map(); cache.set(app, m); }
  const key = `${board}:${week}`; const hit = m.get(key); const t = Date.now();
  if (hit && t - hit.at < 15_000) return hit.list;
  const list = rankList(compute(app, board, week));
  m.set(key, { at: t, list });
  return list;
}
export const rankInvalidate = (app: App) => cache.get(app)?.clear();
/** "Takım gücü" tablosu: takım → sıra ve güç (puanı olmayan takım yok; yönetici dışlamaları tablodaki gibi) */
export function teamPowerRanks(app: App): Map<string, { rank: number; value: number; pos: number }> {
  return new Map(ranked(app, 't-guc').map((r, pos) => [r.id, { rank: r.rank, value: r.value, pos }]));
}
/** tek bir oyuncu/takımın tablodaki değeri (önbellekten; takım yarışı eşleşmesi gücü bununla kıyaslar) */
export const boardValue = (app: App, board: RankBoardId, id: string): number => ranked(app, board).find((r) => r.id === id)?.value ?? 0;

// ------------------------------------------------------------------ olaylar (yalnızca doğrulanmış)
/** progress.submit (aynı runId ikinci kez gelmez): doğrulanmış bölüm/yıldız, haftalık yeni yıldız, nota (günlük sınır), yarış birinciliği */
export function rankOnRun(app: App, pid: string, d: { level: number; completed: boolean; stars: number; coins: number }, raceWin: boolean): void {
  if (isAdmin(app, pid)) return; // yönetici hesabı rekabet tablolarına girmez
  const week = app.week().key; const day = dayKey(app.now());
  let starGain = 0;
  if (d.completed && d.stars > 0) {
    const prev = app.db.get<{ stars: number }>('SELECT stars FROM rank_level WHERE player_id = ? AND level = ?', pid, d.level)?.stars ?? 0;
    starGain = Math.max(0, d.stars - prev);
    app.db.run('INSERT INTO rank_level(player_id, level, stars) VALUES(?, ?, ?) ON CONFLICT(player_id, level) DO UPDATE SET stars = MAX(stars, excluded.stars)', pid, d.level, d.stars);
  } else if (d.completed) app.db.run('INSERT OR IGNORE INTO rank_level(player_id, level, stars) VALUES(?, ?, 0)', pid, d.level);
  const today = app.db.get<{ notes: number; wins: number }>('SELECT notes, wins FROM rank_day WHERE day = ? AND player_id = ?', day, pid) ?? { notes: 0, wins: 0 };
  const notes = Math.max(0, Math.min(Math.round(d.coins), RANK_RULES.notesPerDay - today.notes));
  const win = raceWin && today.wins < RANK_RULES.raceWinsPerDay ? 1 : 0;
  if (notes || win) app.db.run('INSERT INTO rank_day(day, player_id, notes, wins) VALUES(?, ?, ?, ?) ON CONFLICT(day, player_id) DO UPDATE SET notes = notes + excluded.notes, wins = wins + excluded.wins', day, pid, notes, win);
  if (starGain || notes || win) app.db.run('INSERT INTO rank_week(week, player_id, stars, notes, wins) VALUES(?, ?, ?, ?, ?) ON CONFLICT(week, player_id) DO UPDATE SET stars = stars + excluded.stars, notes = notes + excluded.notes, wins = wins + excluded.wins', week, pid, starGain, notes, win);
  rankInvalidate(app);
}

// ------------------------------------------------------------------ gün başı: ▲▼ için sıra kaydı
export function rankDayTick(app: App): void {
  const today = dayKey(app.now());
  if (app.db.metaGet('rank_day') === today) return;
  app.db.metaSet('rank_day', today);
  rankInvalidate(app);
  for (const b of RANK_BOARDS) for (const r of ranked(app, b.id).slice(0, 1000)) app.db.run('INSERT OR IGNORE INTO rank_snap(day, board, id, rank) VALUES(?, ?, ?, ?)', today, b.id, r.id, r.rank);
  app.db.run('DELETE FROM rank_snap WHERE day < ?', dayKey(app.now() - 3 * DAY_MS));
  app.db.run('DELETE FROM rank_day WHERE day < ?', dayKey(app.now() - 3 * DAY_MS));
}

// ------------------------------------------------------------------ hafta kapanışı: son sıralama + ödül (bir kez) + duyuru
const rewardFor = (team: boolean, rank: number) => (team ? RANK_RULES.teamRewards : RANK_RULES.playerRewards).find((t) => rank <= t.upTo)?.reward ?? null;
export function rankWeekClose(app: App, oldWeek: string): void {
  if (app.db.metaGet(`rank_closed:${oldWeek}`)) return;
  app.db.metaSet(`rank_closed:${oldWeek}`, '1');
  rankInvalidate(app);
  for (const b of RANK_BOARDS.filter((x) => x.weekly)) {
    const list = ranked(app, b.id, oldWeek).slice(0, 10);
    for (const r of list) {
      app.db.run('INSERT OR IGNORE INTO rank_final(week, board, id, rank, value, name, color, hat, emblem) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)', oldWeek, b.id, r.id, r.rank, r.value, r.name, r.color ?? null, r.hat ?? null, r.emblem ?? null);
      const reward = rewardFor(b.team, r.rank); if (!reward) continue;
      const why = `Sıralama: ${b.name} · geçen hafta ${r.rank}.`;
      const pids = b.team ? app.teamMemberIds(r.id) : [r.id];
      for (const pid of pids) {
        if (isAdmin(app, pid)) continue; // yönetici hesabı haftalık ödül almaz
        if (!app.db.run('INSERT OR IGNORE INTO rank_rewards(week, board, player_id, rank, at) VALUES(?, ?, ?, ?, ?)', oldWeek, b.id, pid, r.rank, app.now())) continue;
        for (const g of reward) app.addInbox(pid, { kind: g.kind, amount: g.amount, ref: g.ref }, why);
        metric(app, 'rank.reward');
      }
      if (r.rank > 3) continue;
      // duyuru (yalnızca ilk 3): takım tablosu → o takımın sohbetine; oyuncu tablosu → oyuncunun takımına (akışta paylaşımı açıksa)
      if (b.team) systemMessage(app, teamRoom(r.id), `Takımımız geçen haftanın ${b.name} sıralamasında ${r.rank}. oldu! Her üyenin ödül kutusunda ${reward.map((g) => `${g.amount} ${g.kind}`).join(' + ')}.`, 'system', { event: 'sira', board: b.id, rank: r.rank });
      else {
        const p = app.playerOrNull(r.id);
        if (p?.team_id && feedShareOn(app, p.id)) postCard(app, teamRoom(p.team_id), { kind: 'feed', text: `${p.name} geçen haftanın ${b.name} sıralamasında ${r.rank}. oldu!`, meta: { type: 'sira', pid: p.id, pname: p.name, pc: p.color, ph: p.hat, board: b.id, rank: r.rank, value: r.value } });
      }
    }
  }
}

// ------------------------------------------------------------------ görünüm
function view(app: App, pid: string, board: RankBoardId, scope: RankScope): RankBoardView {
  const def = rankBoardById(board)!;
  const w = app.week();
  const list = ranked(app, board, w.key);
  const me = app.player(pid);
  const myId = def.team ? me.team_id : pid;
  const snapDay = app.db.metaGet('rank_day') ?? dayKey(app.now());
  const snap = new Map(app.db.all<{ id: string; rank: number }>('SELECT id, rank FROM rank_snap WHERE day = ? AND board = ?', snapDay, board).map((r) => [r.id, r.rank]));
  const lastWeek = weekInfo(w.startsAt - WEEK_MS + DAY_MS).key;
  const badges = new Map(app.db.all<{ id: string; rank: number }>('SELECT id, rank FROM rank_final WHERE week = ? AND board = ? AND rank <= 3', lastWeek, board).map((r) => [r.id, r.rank]));
  const toView = (r: Ranked): RankRowView => {
    const was = snap.get(r.id);
    const v: RankRowView = { rank: r.rank, id: r.id, name: r.name, value: r.value, delta: was == null ? null : was - r.rank };
    if (r.color != null) v.color = r.color;
    if (r.hat) v.hat = r.hat;
    if (r.emblem) v.emblem = r.emblem;
    if (!def.team) v.teamName = r.teamName ?? null;
    if (r.id === myId) v.me = true;
    if (r.global != null) v.global = r.global;
    const bd = badges.get(r.id); if (bd) v.badge = bd;
    return v;
  };
  let rows: Ranked[];
  const mine = myId ? list.findIndex((r) => r.id === myId) : -1;
  if (scope === 'arkadas') {
    const ids = new Set(app.db.all<{ b: string }>('SELECT b FROM friends WHERE a = ?', pid).map((r) => r.b));
    if (def.team) {
      const teams = new Set<string>(); if (me.team_id) teams.add(me.team_id);
      for (const id of ids) { const t = app.playerOrNull(id)?.team_id; if (t) teams.add(t); }
      rows = list.filter((r) => teams.has(r.id));
    } else { ids.add(pid); rows = list.filter((r) => ids.has(r.id)); }
    // kapsam içi sıra (1, 2, …; eşit puan eşit sıra); genel sıra ayrıca gösterilir
    rows = rows.slice(0, RANK_RULES.top).map((r, i, a) => ({ ...r, rank: i > 0 && a[i - 1]!.value === r.value ? 0 : i + 1, global: r.rank }));
    rows.forEach((r, i) => { if (r.rank === 0) r.rank = rows[i - 1]!.rank; });
  } else if (scope === 'yakin') rows = mine < 0 ? list.slice(-RANK_RULES.near) : list.slice(Math.max(0, mine - RANK_RULES.near), mine + RANK_RULES.near + 1);
  else rows = list.slice(0, RANK_RULES.top);
  const lastRows = def.weekly ? app.db.all<{ id: string; rank: number; value: number; name: string; color: number | null; hat: string | null; emblem: string | null }>(
    'SELECT * FROM rank_final WHERE week = ? AND board = ? AND rank <= 3 ORDER BY rank, name', lastWeek, board) : [];
  return {
    board, scope, rows: rows.map(toView),
    // arkadaşlar kapsamında benim satırım ve toplam da kapsam içinden (gösterilen satırlarla tutarlı)
    me: scope === 'arkadas' ? (() => { const x = rows.find((r) => r.id === myId); return x ? toView(x) : null; })() : mine >= 0 ? toView(list[mine]!) : null,
    total: scope === 'arkadas' ? rows.length : list.length,
    week: w.key, endsAt: def.weekly ? w.endsAt : null,
    last: lastRows.length ? { week: lastWeek, rows: lastRows.map((r) => ({ rank: r.rank, id: r.id, name: r.name, value: r.value, delta: null, ...(r.color != null ? { color: r.color } : {}), ...(r.hat ? { hat: r.hat } : {}), ...(r.emblem ? { emblem: r.emblem } : {}) })) } : null,
    updatedAt: app.now(),
  };
}

export const rankHandlers: Handlers = {
  'rank.board': (app, s, { board, scope }) => {
    if (!rankBoardById(board)) fail('GECERSIZ', 'Böyle bir sıralama yok.');
    rankDayTick(app);
    return { view: view(app, s.pid, board, scope) };
  },
};

export function installRank(app: App): void {
  app.weekHooks.push((oldWeek) => rankWeekClose(app, oldWeek));
}
