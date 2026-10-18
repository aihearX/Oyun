import type { LeagueState, LeagueTier } from '@odi/shared';
import type { App, Handlers } from './app';

export const TIERS: LeagueTier[] = ['bronz', 'gumus', 'altin', 'koklea'];
export const GROUP_SIZE = 30;
export const PROMOTE_TOP = 7;
export const DEMOTE_BOTTOM = 5;

interface LRow { week: string; player_id: string; tier: LeagueTier; group_id: string; points: number; joined_at: number }

/** bu haftanın lig kaydı; yoksa aynı kademedeki ilk boş 30'luk gruba (katılım sırasıyla) yerleştirir */
export function ensureLeague(app: App, pid: string): LRow {
  const week = app.week().key;
  const have = app.db.get<LRow>('SELECT * FROM league WHERE week = ? AND player_id = ?', week, pid);
  if (have) return have;
  const tier = app.player(pid).league_tier;
  let g = app.db.get<{ id: string }>('SELECT id FROM league_groups WHERE week = ? AND tier = ? AND n < ? ORDER BY created_at, id LIMIT 1', week, tier, GROUP_SIZE);
  if (!g) {
    const count = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM league_groups WHERE week = ? AND tier = ?', week, tier)!.n;
    g = { id: `${week}:${tier}:${count + 1}` };
    app.db.run('INSERT INTO league_groups(id, week, tier, n, created_at) VALUES(?, ?, ?, 0, ?)', g.id, week, tier, app.now());
  }
  app.db.run('UPDATE league_groups SET n = n + 1 WHERE id = ?', g.id);
  app.db.run('INSERT INTO league(week, player_id, tier, group_id, points, joined_at) VALUES(?, ?, ?, ?, 0, ?)', week, pid, tier, g.id, app.now());
  return app.db.get<LRow>('SELECT * FROM league WHERE week = ? AND player_id = ?', week, pid)!;
}

export function addLeaguePoints(app: App, pid: string, pts: number): void {
  const r = ensureLeague(app, pid);
  app.db.run('UPDATE league SET points = points + ? WHERE week = ? AND player_id = ?', pts, r.week, pid);
}

const groupRows = (app: App, groupId: string) =>
  app.db.all<LRow & { name: string; color: number }>('SELECT l.*, p.name, p.color FROM league l JOIN players p ON p.id = l.player_id WHERE l.group_id = ? ORDER BY l.points DESC, l.joined_at ASC', groupId);

export function leagueState(app: App, pid: string): LeagueState {
  const me = ensureLeague(app, pid);
  const rows = groupRows(app, me.group_id);
  const w = app.week();
  return {
    tier: me.tier, week: w.key, endsAt: w.endsAt,
    rank: rows.findIndex((r) => r.player_id === pid) + 1,
    points: rows.find((r) => r.player_id === pid)?.points ?? 0,
    group: rows.map((r) => ({ id: r.player_id, name: r.name, color: r.color, points: r.points })),
    promoteTop: PROMOTE_TOP, demoteBottom: DEMOTE_BOTTOM,
  };
}

/** hafta kapanışı: her grupta ilk 7 bir üst kademeye, son 5 (ilk 7'ye girmeyenlerden) bir alta */
export function leagueRollover(app: App, oldWeek: string): void {
  const groups = app.db.all<{ id: string }>('SELECT id FROM league_groups WHERE week = ?', oldWeek);
  for (const g of groups) {
    const rows = groupRows(app, g.id);
    const n = rows.length;
    rows.forEach((r, i) => {
      const ti = TIERS.indexOf(r.tier);
      let next = ti;
      if (i < PROMOTE_TOP) next = Math.min(TIERS.length - 1, ti + 1);
      else if (i >= Math.max(PROMOTE_TOP, n - DEMOTE_BOTTOM)) next = Math.max(0, ti - 1);
      if (next !== ti) app.db.run('UPDATE players SET league_tier = ? WHERE id = ?', TIERS[next]!, r.player_id);
    });
  }
}

export const leagueHandlers: Handlers = {
  'league.state': (app, s) => ({ league: leagueState(app, s.pid) }),
};
