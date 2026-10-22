/**
 * Takım Ligi (docs/16-takim-rekabeti.md): 2 haftalık sezonlar, kademeler (Bronz → Gümüş → Altın → Platin → Koklea), kademe başına
 * en çok 15 takımlık gruplar. Lig puanı SUNUCU KAYITLARINDAN hesaplanır (istemci sayı söylemez): Bölge Savaşı (team_week), Baskın
 * (raid_damage), Bilgi (açıklanmış Günün Sorusu doğruları), Düello (ev_duel sonucu) ve Takım Yarışı (tl_race). Haftalık üst sınırlar
 * TEAM_LEAGUE_RULES'ta. Sezon kapanınca (bir kez) yükselme/düşme, geçmiş kaydı, üye başına kristal ödülü (bir kez) ve takım sohbetine duyuru.
 */
import { TEAM_LEAGUE_RULES as R, TEAM_LEAGUE_TIERS, type TeamLeagueBreakdown, type TeamLeagueHistory, type TeamLeagueRow, type TeamLeagueState, type TeamLeagueTier } from '@odi/shared';
import { fail, rid, type App } from '../app';
import { systemMessage, teamRoom } from '../chat';
import { DAY_MS, WEEK_MS, weekInfo } from '../time';

export const TLIG_SCHEMA = `
CREATE TABLE IF NOT EXISTS tl_team(team_id TEXT PRIMARY KEY, tier TEXT NOT NULL DEFAULT 'bronz');
CREATE TABLE IF NOT EXISTS tl_group(id TEXT PRIMARY KEY, season TEXT NOT NULL, tier TEXT NOT NULL, n INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS tl_group_s ON tl_group(season, tier, n);
CREATE TABLE IF NOT EXISTS tl_member(season TEXT NOT NULL, team_id TEXT NOT NULL, group_id TEXT NOT NULL, tier TEXT NOT NULL, joined_at INTEGER NOT NULL, PRIMARY KEY(season, team_id));
CREATE INDEX IF NOT EXISTS tl_member_g ON tl_member(group_id);
CREATE TABLE IF NOT EXISTS tl_history(season TEXT NOT NULL, team_id TEXT NOT NULL, no INTEGER NOT NULL, tier TEXT NOT NULL, rank INTEGER NOT NULL, group_size INTEGER NOT NULL, outcome TEXT NOT NULL, points INTEGER NOT NULL, PRIMARY KEY(season, team_id));
CREATE TABLE IF NOT EXISTS tl_rewards(season TEXT NOT NULL, team_id TEXT NOT NULL, player_id TEXT NOT NULL, amount INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(season, team_id, player_id));
CREATE TABLE IF NOT EXISTS tl_race(match_id TEXT NOT NULL, team_id TEXT NOT NULL, season TEXT NOT NULL, day TEXT NOT NULL, rival_id TEXT NOT NULL, points INTEGER NOT NULL, counted INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(match_id, team_id));
CREATE INDEX IF NOT EXISTS tl_race_t ON tl_race(team_id, season);
`;

/** 1. sezon: 12 Ekim 2026 Pazartesi 00:00 (İstanbul; takım ligi açılışı); her sezon 2 ISO hafta */
const EPOCH = weekInfo(Date.UTC(2026, 9, 12, 12)).startsAt;
const SEASON_MS = R.seasonWeeks * WEEK_MS;
export interface Season { key: string; no: number; startsAt: number; endsAt: number; weeks: string[] }
export function seasonInfo(t: number): Season {
  const ws = weekInfo(t).startsAt;
  const idx = Math.max(0, Math.floor((ws - EPOCH + DAY_MS / 2) / SEASON_MS));
  const no = idx + 1;
  const startsAt = weekInfo(EPOCH + idx * SEASON_MS + DAY_MS / 2).startsAt;
  const weeks = Array.from({ length: R.seasonWeeks }, (_, i) => weekInfo(startsAt + i * WEEK_MS + DAY_MS / 2).key);
  return { key: `S${no}`, no, startsAt, endsAt: weekInfo(startsAt + SEASON_MS + DAY_MS / 2).startsAt, weeks };
}
const seasonByKey = (key: string): Season => seasonInfo(EPOCH + (Number(key.slice(1)) - 1) * SEASON_MS + DAY_MS);

const TIERS = TEAM_LEAGUE_TIERS.map((t) => t.id);
const tierName = (t: TeamLeagueTier) => TEAM_LEAGUE_TIERS.find((x) => x.id === t)!.name;
const tierOf = (app: App, teamId: string): TeamLeagueTier => (app.db.get<{ tier: TeamLeagueTier }>('SELECT tier FROM tl_team WHERE team_id = ?', teamId)?.tier ?? 'bronz');

/** takımın sezon puanı (kaynak kaynak, haftalık sınırlarla) */
export function seasonPoints(app: App, teamId: string, s: Season): TeamLeagueBreakdown {
  let war = 0, raid = 0, quiz = 0;
  for (const w of s.weeks) {
    const wp = app.db.get<{ v: number }>('SELECT points AS v FROM team_week WHERE week = ? AND team_id = ?', w, teamId)?.v ?? 0;
    war += Math.min(R.sources.war.capWeek, Math.floor(wp / R.sources.war.per));
    const rd = app.db.get<{ v: number }>('SELECT COALESCE(SUM(damage), 0) AS v FROM raid_damage WHERE raid_id = ? AND team_id = ?', w, teamId)!.v;
    raid += Math.min(R.sources.raid.capWeek, Math.floor(rd / R.sources.raid.per));
    const q = app.db.get<{ v: number }>(`SELECT COALESCE(SUM(a.correct), 0) AS v FROM dq_answers a JOIN dq d ON d.team_id = a.team_id AND d.day = a.day AND d.revealed = 1
      WHERE d.week = ? AND a.team_id = ?`, w, teamId)!.v;
    quiz += Math.min(R.sources.quiz.capWeek, q);
  }
  let duel = 0;
  for (const d of app.db.all<{ result: string }>("SELECT result FROM ev_duel WHERE team_id = ? AND enrolled_at >= ? AND enrolled_at < ? AND result IN ('kazandi', 'berabere', 'kaybetti')", teamId, s.startsAt, s.endsAt)) {
    duel += d.result === 'kazandi' ? R.sources.duel.win : d.result === 'berabere' ? R.sources.duel.draw : R.sources.duel.lose;
  }
  const race = app.db.get<{ v: number }>('SELECT COALESCE(SUM(points), 0) AS v FROM tl_race WHERE team_id = ? AND season = ? AND counted = 1', teamId, s.key)!.v;
  return { war, raid, quiz, duel, race, total: war + raid + quiz + duel + race };
}

// ------------------------------------------------------------------ gruplar
function joinGroup(app: App, s: Season, teamId: string, tier: TeamLeagueTier): string {
  const g = app.db.get<{ id: string }>('SELECT id FROM tl_group WHERE season = ? AND tier = ? AND n < ? ORDER BY n DESC, created_at LIMIT 1', s.key, tier, R.groupSize);
  const id = g?.id ?? rid('g');
  if (!g) app.db.run('INSERT INTO tl_group(id, season, tier, n, created_at) VALUES(?, ?, ?, 0, ?)', id, s.key, tier, app.now());
  app.db.run('UPDATE tl_group SET n = n + 1 WHERE id = ?', id);
  app.db.run('INSERT INTO tl_member(season, team_id, group_id, tier, joined_at) VALUES(?, ?, ?, ?, ?)', s.key, teamId, id, tier, app.now());
  return id;
}
/** takım bu sezonun bir grubunda (yoksa kademesindeki boş yeri olan gruba girer) */
export function ensureMember(app: App, teamId: string, s = seasonInfo(app.now())): { group: string; tier: TeamLeagueTier } {
  const m = app.db.get<{ group_id: string; tier: TeamLeagueTier }>('SELECT group_id, tier FROM tl_member WHERE season = ? AND team_id = ?', s.key, teamId);
  if (m) return { group: m.group_id, tier: m.tier };
  const tier = tierOf(app, teamId);
  return { group: joinGroup(app, s, teamId, tier), tier };
}

/** sezon değişimi (tembel; sweep ve her lig erişiminde): önceki sezonu bir kez kapat, üyesi olan takımları yeni sezona yerleştir */
export function ensureSeason(app: App): Season {
  const s = seasonInfo(app.now());
  const prev = app.db.metaGet('tl_season');
  if (prev === s.key) return s;
  app.run(() => {
    if (prev) for (const k of app.db.all<{ season: string }>('SELECT DISTINCT season FROM tl_member WHERE season != ?', s.key)) closeSeason(app, k.season);
    // üyesi olan takımlar, kademe içinde güce (toplam yıldız) göre sırayla gruplara
    const teams = app.db.all<{ id: string; tier: TeamLeagueTier | null; st: number }>(`SELECT t.id, l.tier, COALESCE(SUM(p.stars), 0) AS st FROM teams t
      JOIN players p ON p.team_id = t.id LEFT JOIN tl_team l ON l.team_id = t.id GROUP BY t.id ORDER BY st DESC, t.created_at`);
    for (const t of teams) if (!app.db.get('SELECT 1 FROM tl_member WHERE season = ? AND team_id = ?', s.key, t.id)) joinGroup(app, s, t.id, t.tier ?? 'bronz');
    app.db.metaSet('tl_season', s.key);
  });
  return s;
}

function groupRows(app: App, s: Season, groupId: string, myTeam: string | null): TeamLeagueRow[] {
  const list = app.db.all<{ team_id: string; name: string; emblem: string }>('SELECT m.team_id, t.name, t.emblem FROM tl_member m JOIN teams t ON t.id = m.team_id WHERE m.group_id = ?', groupId)
    .map((t) => ({ teamId: t.team_id, name: t.name, emblem: t.emblem, points: seasonPoints(app, t.team_id, s).total }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'tr'));
  let rank = 0, prev = Infinity;
  return list.map((r, i) => { if (r.points !== prev) { rank = i + 1; prev = r.points; } const v: TeamLeagueRow = { rank, ...r }; if (r.teamId === myTeam) v.me = true; return v; });
}
const cut = (n: number, k: number) => (n >= 6 ? k : Math.floor(n / 3));

/** sezon kapanışı (bir kez): sıralama, yükselme/düşme, geçmiş, ödül (bir kez), duyuru */
export function closeSeason(app: App, key: string): void {
  if (app.db.metaGet(`tl_closed:${key}`)) return;
  app.db.metaSet(`tl_closed:${key}`, '1');
  const s = seasonByKey(key);
  for (const g of app.db.all<{ id: string; tier: TeamLeagueTier }>('SELECT id, tier FROM tl_group WHERE season = ?', key)) {
    const rows = groupRows(app, s, g.id, null);
    const n = rows.length; const up = cut(n, R.promote); const down = cut(n, R.demote);
    const ti = TIERS.indexOf(g.tier);
    rows.forEach((r, i) => {
      if (!app.team(r.teamId)) return;
      let outcome: TeamLeagueHistory['outcome'] = 'kaldi'; let tier = g.tier;
      if (i < up && r.points > 0 && ti < TIERS.length - 1) { outcome = 'yukseldi'; tier = TIERS[ti + 1]!; }
      else if (i >= n - down && i >= up && ti > 0) { outcome = 'dustu'; tier = TIERS[ti - 1]!; }
      app.db.run('INSERT INTO tl_team(team_id, tier) VALUES(?, ?) ON CONFLICT(team_id) DO UPDATE SET tier = excluded.tier', r.teamId, tier);
      app.db.run('INSERT OR IGNORE INTO tl_history(season, team_id, no, tier, rank, group_size, outcome, points) VALUES(?, ?, ?, ?, ?, ?, ?, ?)', key, r.teamId, s.no, g.tier, r.rank, n, outcome, r.points);
      // ödül: puanı olan takımın üyelerine, kademe tabanı × sıra çarpanı
      const mul = r.points <= 0 ? 0 : r.rank === 1 ? 3 : r.rank === 2 ? 2 : r.rank === 3 ? 1.5 : 1;
      const amount = Math.round(R.rewardBase[g.tier] * mul);
      if (amount > 0) {
        for (const pid of app.teamMemberIds(r.teamId)) {
          if (!app.db.run('INSERT OR IGNORE INTO tl_rewards(season, team_id, player_id, amount, at) VALUES(?, ?, ?, ?, ?)', key, r.teamId, pid, amount, app.now())) continue;
          app.addInbox(pid, { kind: 'kristal', amount, ref: 'takim-ligi' }, `Takım Ligi ${s.no}. sezon: ${tierName(g.tier)} grubunda ${r.rank}.`);
        }
      }
      const move = outcome === 'yukseldi' ? ` ${tierName(tier)} kademesine yükseldiniz!` : outcome === 'dustu' ? ` Gelecek sezon ${tierName(tier)} kademesindesiniz.` : ' Kademeniz aynı.';
      systemMessage(app, teamRoom(r.teamId), `Takım Ligi ${s.no}. sezon bitti: ${tierName(g.tier)} grubunda ${r.points} puanla ${r.rank}. oldunuz.${move}${amount > 0 ? ` Her üyeye ${amount} kristal ödül kutusunda.` : ''}`, 'system', { event: 'tlig', outcome, rank: r.rank, tier });
    });
  }
}

/** Sıralama "Takım Ligi" tablosu: bu sezon gruplardaki takımların puanı */
export function seasonTable(app: App): { id: string; value: number; name: string; emblem: string }[] {
  const s = ensureSeason(app);
  return app.db.all<{ team_id: string; name: string; emblem: string }>('SELECT m.team_id, t.name, t.emblem FROM tl_member m JOIN teams t ON t.id = m.team_id WHERE m.season = ?', s.key)
    .map((t) => ({ id: t.team_id, value: seasonPoints(app, t.team_id, s).total, name: t.name, emblem: t.emblem }));
}

/** takım yarışı sonucunu lige yaz (günlük sınır: takım başına günde 10 sayılan yarış) */
export function recordRaceLeague(app: App, matchId: string, teamId: string, rivalId: string, points: number, day: string, allowed: boolean): boolean {
  const s = ensureSeason(app); ensureMember(app, teamId, s);
  const used = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM tl_race WHERE team_id = ? AND day = ? AND counted = 1', teamId, day)!.n;
  const counted = allowed && used < 10;
  app.db.run('INSERT OR IGNORE INTO tl_race(match_id, team_id, season, day, rival_id, points, counted, at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)', matchId, teamId, s.key, day, rivalId, points, counted ? 1 : 0, app.now());
  return counted;
}

export function leagueState(app: App, teamId: string): TeamLeagueState {
  const s = ensureSeason(app);
  const m = app.run(() => ensureMember(app, teamId, s));
  const history = app.db.all<{ season: string; no: number; tier: TeamLeagueTier; rank: number; group_size: number; outcome: TeamLeagueHistory['outcome']; points: number }>(
    'SELECT * FROM tl_history WHERE team_id = ? ORDER BY no DESC LIMIT 10', teamId).map((h) => ({ season: h.season, no: h.no, tier: h.tier, rank: h.rank, groupSize: h.group_size, outcome: h.outcome, points: h.points }));
  const last = history[0];
  const rows = groupRows(app, s, m.group, teamId);
  return {
    season: { key: s.key, no: s.no, startsAt: s.startsAt, endsAt: s.endsAt }, tier: m.tier, groupId: m.group, rows, mine: seasonPoints(app, teamId, s),
    promoteTop: m.tier === 'koklea' ? 0 : cut(rows.length, R.promote), demoteBottom: m.tier === 'bronz' ? 0 : cut(rows.length, R.demote), history,
    badge: last && last.no === s.no - 1 && last.rank <= 3 && last.points > 0 ? { tier: last.tier, no: last.no, rank: last.rank } : null,
  };
}

export function requireTeamId(app: App, pid: string): string {
  const t = app.player(pid).team_id;
  if (!t) fail('TAKIMSIZ', 'Önce bir takıma katılmalısın.');
  return t;
}
