import type { EventReward, RankRow, TourneyState } from '@odi/shared';
import { fail, type App, type Handlers } from '../app';
import { weekInfo } from '../time';
import { checkRun, giveRewards, hash32, markDone, notify, rw } from './common';

/** Haftalık Turnuva: haftanın 5 belirli bölümünde en iyi skorların toplamı; 50 kişilik gruplar (katılım sırası). */
export const TOURNEY_SLOTS = 5;
export const TOURNEY_GROUP = 50;
const POOL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
export const TOURNEY_REWARDS: { label: string; from: number; to: number; items: EventReward[] }[] = [
  { label: '1.', from: 1, to: 1, items: rw(500, 80) },
  { label: '2.–3.', from: 2, to: 3, items: rw(300, 50) },
  { label: '4.–10.', from: 4, to: 10, items: rw(150, 25) },
  { label: '11.–25.', from: 11, to: 25, items: rw(80, 10) },
];
export function tourneyLevels(week: string): { level: number; salt: number }[] {
  const pool = [...POOL]; const out: { level: number; salt: number }[] = [];
  let h = hash32(`turnuva:${week}`);
  for (let i = 0; i < TOURNEY_SLOTS; i++) { h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0; out.push({ level: pool.splice(h % pool.length, 1)[0]!, salt: 100 + ((h >>> 9) % 900) }); }
  return out.sort((a, b) => a.level - b.level);
}

interface TRow { week: string; player_id: string; group_id: string; total: number; joined_at: number }
function ensure(app: App, pid: string, week: string): TRow {
  const have = app.db.get<TRow>('SELECT * FROM ev_tourney WHERE week = ? AND player_id = ?', week, pid);
  if (have) return have;
  let g = app.db.get<{ id: string }>('SELECT id FROM ev_tourney_group WHERE week = ? AND n < ? ORDER BY created_at, id LIMIT 1', week, TOURNEY_GROUP);
  if (!g) {
    const count = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM ev_tourney_group WHERE week = ?', week)!.n;
    g = { id: `${week}:${count + 1}` };
    app.db.run('INSERT INTO ev_tourney_group(id, week, n, created_at) VALUES(?, ?, 0, ?)', g.id, week, app.now());
  }
  app.db.run('UPDATE ev_tourney_group SET n = n + 1 WHERE id = ?', g.id);
  app.db.run('INSERT INTO ev_tourney(week, player_id, group_id, joined_at) VALUES(?, ?, ?, ?)', week, pid, g.id, app.now());
  return app.db.get<TRow>('SELECT * FROM ev_tourney WHERE week = ? AND player_id = ?', week, pid)!;
}
const groupRows = (app: App, groupId: string) => app.db.all<TRow & { name: string; color: number }>('SELECT t.*, p.name, p.color FROM ev_tourney t JOIN players p ON p.id = t.player_id WHERE t.group_id = ? ORDER BY t.total DESC, t.joined_at ASC', groupId);

export function tourneyTick(app: App): void {
  const cur = weekInfo(app.now()).key;
  for (const { week } of app.db.all<{ week: string }>('SELECT DISTINCT week FROM ev_tourney_group WHERE week != ?', cur)) {
    if (!markDone(app, 'turnuva', week)) continue;
    for (const g of app.db.all<{ id: string }>('SELECT id FROM ev_tourney_group WHERE week = ?', week)) {
      groupRows(app, g.id).filter((r) => r.total > 0).forEach((r, i) => {
        const tier = TOURNEY_REWARDS.find((t) => i + 1 >= t.from && i + 1 <= t.to);
        if (!tier) return;
        giveRewards(app, r.player_id, tier.items, `Haftalık Turnuva ${week}: ${i + 1}. sıra`);
        notify(app, [r.player_id], { kind: 'turnuva', icon: '🏆', title: `Turnuvada ${i + 1}. oldun!`, text: 'Ödülün ödül kutusunda.', target: 'turnuva' });
      });
    }
  }
}

export function tourneyState(app: App, pid: string): TourneyState {
  tourneyTick(app);
  const w = weekInfo(app.now());
  const me = ensure(app, pid, w.key);
  const best = new Map(app.db.all<{ slot: number; score: number }>('SELECT slot, score FROM ev_tourney_best WHERE week = ? AND player_id = ?', w.key, pid).map((r) => [r.slot, r.score]));
  const rows = groupRows(app, me.group_id);
  const group: RankRow[] = rows.map((r, i) => ({ id: r.player_id, name: r.name, color: r.color, score: r.total, rank: i + 1 }));
  return {
    week: w.key, endsAt: w.endsAt, levels: tourneyLevels(w.key).map((l, slot) => ({ slot, ...l, best: best.get(slot) ?? null })),
    total: me.total, rank: me.total > 0 ? group.findIndex((g) => g.id === pid) + 1 : null, groupSize: TOURNEY_GROUP, group: group.filter((g) => g.score > 0 || g.id === pid),
    rewards: TOURNEY_REWARDS.map((t) => ({ label: t.label, items: t.items })),
  };
}

export const tourneyHandlers: Handlers = {
  'tourney.state': (app, s) => ({ tourney: tourneyState(app, s.pid) }),
  'tourney.submit': (app, s, d) => {
    checkRun(d);
    const w = weekInfo(app.now());
    if (app.db.get('SELECT 1 AS x FROM ev_tourney_run WHERE player_id = ? AND run_id = ?', s.pid, d.runId)) return { tourney: tourneyState(app, s.pid) };
    if (d.slot < 0 || d.slot >= TOURNEY_SLOTS) fail('GECERSIZ', 'Geçersiz turnuva bölümü.');
    ensure(app, s.pid, w.key);
    const score = Math.round(d.score);
    app.db.run('INSERT INTO ev_tourney_run(player_id, run_id, week, slot, score, at) VALUES(?, ?, ?, ?, ?, ?)', s.pid, d.runId, w.key, d.slot, score, app.now());
    app.db.run('INSERT INTO ev_tourney_best(week, player_id, slot, score) VALUES(?, ?, ?, ?) ON CONFLICT(week, player_id, slot) DO UPDATE SET score = MAX(score, excluded.score)', w.key, s.pid, d.slot, score);
    const total = app.db.get<{ t: number }>('SELECT COALESCE(SUM(score), 0) AS t FROM ev_tourney_best WHERE week = ? AND player_id = ?', w.key, s.pid)!.t;
    app.db.run('UPDATE ev_tourney SET total = ? WHERE week = ? AND player_id = ?', total, w.key, s.pid);
    return { tourney: tourneyState(app, s.pid) };
  },
};
