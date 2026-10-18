import type { RaidState } from '@odi/shared';
import { type App, type Grant, type Handlers } from './app';
import { systemMessage, teamRoom } from './chat';
import { createGift } from './teamextra';
import { raidWindow } from './time';

/** ortak can: 400 + 120 × üye sayısı (pencere içinde takımın ilk erişiminde sabitlenir) */
export const raidMaxHp = (members: number) => 400 + 120 * members;
/** canavar yenilince takımın tüm üyelerine düşen sabit hediye */
export const RAID_GIFT: Grant[] = [{ kind: 'kristal', amount: 30, ref: 'baskin' }, { kind: 'jeton', amount: 200, ref: 'baskin' }];

interface RaidRow { raid_id: string; team_id: string; max_hp: number; hp: number; opened_at: number; defeated_at: number | null }

const win = (app: App) => raidWindow(app.now(), app.cfg.raidAlways);
const memberCount = (app: App, teamId: string) => app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM players WHERE team_id = ?', teamId)!.n;

function ensureRaid(app: App, teamId: string): RaidRow {
  const w = win(app);
  let r = app.db.get<RaidRow>('SELECT * FROM raids WHERE raid_id = ? AND team_id = ?', w.id, teamId);
  if (!r) {
    const hp = raidMaxHp(memberCount(app, teamId));
    app.db.run('INSERT INTO raids(raid_id, team_id, max_hp, hp, opened_at) VALUES(?, ?, ?, ?, ?)', w.id, teamId, hp, hp, w.opensAt);
    r = app.db.get<RaidRow>('SELECT * FROM raids WHERE raid_id = ? AND team_id = ?', w.id, teamId)!;
  }
  return r;
}

export function raidState(app: App, pid: string): RaidState {
  const w = win(app);
  const teamId = app.player(pid).team_id;
  let row: RaidRow | null = null;
  if (teamId) row = w.open ? ensureRaid(app, teamId) : app.db.get<RaidRow>('SELECT * FROM raids WHERE raid_id = ? AND team_id = ?', w.id, teamId) ?? null;
  const projected = teamId ? raidMaxHp(memberCount(app, teamId)) : 0;
  const contributors = teamId
    ? app.db.all<{ id: string; name: string; damage: number }>('SELECT d.player_id AS id, p.name, d.damage FROM raid_damage d JOIN players p ON p.id = d.player_id WHERE d.raid_id = ? AND d.team_id = ? ORDER BY d.damage DESC LIMIT 30', w.id, teamId).map((x) => ({ ...x }))
    : [];
  const ranking = app.db.all<{ teamId: string; name: string; emblem: string; opened_at: number; defeated_at: number | null; damage: number }>(
    `SELECT r.team_id AS teamId, t.name, t.emblem, r.opened_at, r.defeated_at, r.max_hp - r.hp AS damage FROM raids r JOIN teams t ON t.id = r.team_id WHERE r.raid_id = ?`, w.id)
    .map((x) => ({ teamId: x.teamId, name: x.name, emblem: x.emblem, timeMs: x.defeated_at == null ? null : x.defeated_at - x.opened_at, damage: x.damage }))
    .filter((x) => x.damage > 0)
    .sort((a, b) => (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity) || b.damage - a.damage)
    .slice(0, 20);
  return { open: w.open, opensAt: w.opensAt, closesAt: w.closesAt, hp: row?.hp ?? projected, maxHp: row?.max_hp ?? projected, defeatedAt: row?.defeated_at ?? null, contributors, ranking };
}

/** baskın hasarı uygula; uygulanan hasarı döndürür (pencere kapalıysa, takım yoksa ya da canavar yenildiyse 0) */
export function raidHit(app: App, pid: string, teamId: string | null, damage: number): number {
  if (!teamId || damage <= 0) return 0;
  const w = win(app);
  if (!w.open) return 0;
  const r = ensureRaid(app, teamId);
  if (r.defeated_at != null || r.hp <= 0) return 0;
  const applied = Math.min(damage, r.hp);
  const now = app.now();
  app.db.run('UPDATE raids SET hp = hp - ? WHERE raid_id = ? AND team_id = ?', applied, w.id, teamId);
  app.db.run('INSERT INTO raid_damage(raid_id, team_id, player_id, damage) VALUES(?, ?, ?, ?) ON CONFLICT(raid_id, team_id, player_id) DO UPDATE SET damage = damage + excluded.damage', w.id, teamId, pid, applied);
  if (r.hp - applied <= 0) {
    app.db.run('UPDATE raids SET defeated_at = ? WHERE raid_id = ? AND team_id = ?', now, w.id, teamId);
    const minutes = Math.max(1, Math.round((now - r.opened_at) / 60_000));
    const members = app.teamMemberIds(teamId);
    createGift(app, teamId, { id: 'sistem', name: 'Baskın' }, 'Gürültü Canavarı yenildi', RAID_GIFT, members);
    systemMessage(app, teamRoom(teamId), `Gürültü Canavarı yenildi! Süre: ${minutes} dakika. Herkese takım hediyesi düştü.`, 'system', { raid: w.id, timeMs: now - r.opened_at });
  }
  app.emitEach(app.teamMemberIds(teamId), 'raid.updated', (id) => ({ raid: raidState(app, id) }));
  return applied;
}

export const raidHandlers: Handlers = {
  'raid.state': (app, s) => ({ raid: raidState(app, s.pid) }),
};
