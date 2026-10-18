import type { DuelSide, DuelState, EventPeriod } from '@odi/shared';
import type { App, Handlers } from '../app';
import { systemMessage, teamRoom } from '../chat';
import { requireTeam } from '../teams';
import { duelFinalMs, duelPeriods, giveRewards, markDone, notify, rw } from './common';

/** Kazanan/kaybeden/beraberlik ödülleri: her üyeye, sabit ve önceden görünür (kaybedene küçük teselli) */
export const DUEL_REWARDS = { win: rw(400, 80), lose: rw(100, 15), tie: rw(250, 40) };

interface DuelRow { period: string; team_id: string; rival_id: string | null; power: number; enrolled_at: number; matched_at: number | null; push_sent: number; result: string | null }

const teamPower = (app: App, teamId: string) => app.db.get<{ p: number }>('SELECT COALESCE(SUM(stars), 0) AS p FROM players WHERE team_id = ?', teamId)!.p;
const points = (app: App, period: string, teamId: string) => app.db.get<{ p: number }>('SELECT COALESCE(SUM(points), 0) AS p FROM ev_duel_pts WHERE period = ? AND team_id = ?', period, teamId)!.p;
const rowOf = (app: App, period: string, teamId: string) => app.db.get<DuelRow>('SELECT * FROM ev_duel WHERE period = ? AND team_id = ?', period, teamId) ?? null;

/** takımı dönem düellosuna yazar; bekleyen takımlar arasında güce en yakın olanla eşleştirir (yoksa "rakip aranıyor") */
function enroll(app: App, cur: EventPeriod, teamId: string): DuelRow {
  let row = rowOf(app, cur.key, teamId);
  if (!row) {
    app.db.run('INSERT INTO ev_duel(period, team_id, power, enrolled_at) VALUES(?, ?, ?, ?)', cur.key, teamId, teamPower(app, teamId), app.now());
    row = rowOf(app, cur.key, teamId)!;
  }
  if (row.rival_id) return row;
  const waiting = app.db.all<DuelRow>('SELECT d.* FROM ev_duel d JOIN teams t ON t.id = d.team_id WHERE d.period = ? AND d.rival_id IS NULL AND d.team_id != ? ORDER BY d.enrolled_at', cur.key, teamId);
  if (!waiting.length) return row;
  const gap = (p: number) => Math.abs(Math.log(p + 10) - Math.log(row!.power + 10));
  const rival = waiting.reduce((best, x) => (gap(x.power) < gap(best.power) ? x : best));
  const now = app.now();
  app.db.run('UPDATE ev_duel SET rival_id = ?, matched_at = ? WHERE period = ? AND team_id = ?', rival.team_id, now, cur.key, teamId);
  app.db.run('UPDATE ev_duel SET rival_id = ?, matched_at = ? WHERE period = ? AND team_id = ?', teamId, now, cur.key, rival.team_id);
  for (const [a, b] of [[teamId, rival.team_id], [rival.team_id, teamId]] as const) {
    const other = app.team(b)!;
    systemMessage(app, teamRoom(a), `Takım Düellosu başladı! Rakibiniz: ${other.emblem} ${other.name}. Her yıldız, ralli ve bayrak ayağı puan getirir.`, 'war', { event: 'duello' });
    notify(app, app.teamMemberIds(a), { kind: 'duello', icon: '⚔️', title: 'Düello rakibiniz belli oldu!', text: `${other.emblem} ${other.name} ile 48 saatlik düello`, target: 'duello' });
  }
  broadcastDuel(app, rival.team_id); broadcastDuel(app, teamId);
  return rowOf(app, cur.key, teamId)!;
}

function side(app: App, period: string, teamId: string, power: number): DuelSide | null {
  const t = app.team(teamId);
  if (!t) return null;
  const top = app.db.all<{ id: string; name: string; points: number }>(
    'SELECT p.id, p.name, d.points FROM ev_duel_pts d JOIN players p ON p.id = d.player_id WHERE d.period = ? AND d.team_id = ? ORDER BY d.points DESC LIMIT 5', period, teamId).map((r) => ({ ...r }));
  return { teamId, name: t.name, emblem: t.emblem, power, points: points(app, period, teamId), top };
}

/** zamana bağlı işler: son 2 saat bildirimi ve biten dönemlerin kapanışı (tembel + zamanlayıcı) */
export function duelTick(app: App): void {
  const { cur } = duelPeriods(app);
  const now = app.now();
  if (cur && now >= cur.endsAt - duelFinalMs(app)) {
    const due = app.db.all<DuelRow>('SELECT * FROM ev_duel WHERE period = ? AND rival_id IS NOT NULL AND push_sent = 0', cur.key);
    for (const r of due) {
      app.db.run('UPDATE ev_duel SET push_sent = 1 WHERE period = ? AND team_id = ?', r.period, r.team_id);
      if (!app.team(r.team_id)) continue;
      const mine = points(app, r.period, r.team_id); const theirs = points(app, r.period, r.rival_id!);
      const lead = mine > theirs ? `${mine - theirs} puan öndesiniz` : mine < theirs ? `${theirs - mine} puan gerideyiz` : 'skor eşit';
      systemMessage(app, teamRoom(r.team_id), `Düellonun son 2 saati! ${lead}. Son hamle zamanı!`, 'war', { event: 'duello' });
      notify(app, app.teamMemberIds(r.team_id), { kind: 'duello', icon: '⏰', title: 'Düello: son 2 saat!', text: `${lead}. Her yıldız sayılır!`, target: 'duello' });
    }
  }
  const open = app.db.all<{ period: string }>('SELECT DISTINCT period FROM ev_duel WHERE result IS NULL AND period != ?', cur?.key ?? '');
  for (const { period } of open) {
    if (!markDone(app, 'duello', period)) { app.db.run("UPDATE ev_duel SET result = COALESCE(result, 'kapandi') WHERE period = ?", period); continue; }
    for (const r of app.db.all<DuelRow>('SELECT * FROM ev_duel WHERE period = ?', period)) {
      if (!r.rival_id) { app.db.run("UPDATE ev_duel SET result = 'eslesmedi' WHERE period = ? AND team_id = ?", period, r.team_id); continue; }
      const mine = points(app, period, r.team_id); const theirs = points(app, period, r.rival_id);
      const result = mine > theirs ? 'kazandi' : mine < theirs ? 'kaybetti' : 'berabere';
      app.db.run('UPDATE ev_duel SET result = ? WHERE period = ? AND team_id = ?', result, period, r.team_id);
      if (!app.team(r.team_id)) continue;
      const items = result === 'kazandi' ? DUEL_REWARDS.win : result === 'kaybetti' ? DUEL_REWARDS.lose : DUEL_REWARDS.tie;
      const label = result === 'kazandi' ? 'kazandınız' : result === 'kaybetti' ? 'kaybettiniz (teselli ödülü)' : 'berabere';
      for (const m of app.teamMemberIds(r.team_id)) giveRewards(app, m, items, `Takım Düellosu ${label}: ${mine}–${theirs}`);
      systemMessage(app, teamRoom(r.team_id), result === 'kazandi' ? `Düelloyu ${mine}–${theirs} kazandınız! Ödüller ödül kutusunda.` : result === 'kaybetti' ? `Düello bitti: ${mine}–${theirs}. Bu sefer olmadı; teselli ödülü ödül kutusunda. Sıradaki düelloda!` : `Düello berabere bitti: ${mine}–${theirs}. Ödüller ödül kutusunda.`, 'war', { event: 'duello' });
      notify(app, app.teamMemberIds(r.team_id), { kind: 'duello', icon: result === 'kazandi' ? '🏆' : '⚔️', title: result === 'kazandi' ? 'Düelloyu kazandınız!' : result === 'kaybetti' ? 'Düello bitti' : 'Düello berabere', text: `${mine}–${theirs} · ödüller ödül kutusunda`, target: 'duello' });
    }
  }
}

export function duelState(app: App, pid: string): DuelState | null {
  const teamId = app.player(pid).team_id;
  if (!teamId) return null;
  duelTick(app);
  const { cur, next } = duelPeriods(app);
  const now = app.now();
  let me: DuelSide | null = null; let rival: DuelSide | null = null; let status: DuelState['status'] = 'kapali'; let myPoints = 0;
  if (cur) {
    const row = enroll(app, cur, teamId);
    me = side(app, cur.key, teamId, row.power);
    if (row.rival_id) { const rr = rowOf(app, cur.key, row.rival_id); rival = side(app, cur.key, row.rival_id, rr?.power ?? 0); }
    status = rival ? 'eslesti' : 'araniyor';
    myPoints = app.db.get<{ points: number }>('SELECT points FROM ev_duel_pts WHERE period = ? AND team_id = ? AND player_id = ?', cur.key, teamId, pid)?.points ?? 0;
  }
  const lastRow = app.db.get<DuelRow>("SELECT * FROM ev_duel WHERE team_id = ? AND result IN ('kazandi', 'kaybetti', 'berabere') ORDER BY enrolled_at DESC LIMIT 1", teamId);
  let last: DuelState['last'] = null;
  if (lastRow?.rival_id) {
    const rt = app.team(lastRow.rival_id);
    last = { key: lastRow.period, result: lastRow.result as 'kazandi', mine: points(app, lastRow.period, teamId), theirs: points(app, lastRow.period, lastRow.rival_id), rivalName: rt?.name ?? 'Dağılmış takım', rivalEmblem: rt?.emblem ?? '🏳️' };
  }
  return { period: cur, next, status, me, rival, myPoints, finalPush: !!cur && status === 'eslesti' && now >= cur.endsAt - duelFinalMs(app), finalPushMs: duelFinalMs(app), rewards: DUEL_REWARDS, last };
}

export function broadcastDuel(app: App, teamId: string): void {
  if (!app.team(teamId)) return;
  app.emitEach(app.teamMemberIds(teamId), 'duel.updated', (pid) => { const duel = duelState(app, pid); return duel ? { duel } : null; });
}

/** düello puanı (yalnızca oynayarak): aktif dönem yoksa yazılmaz */
export function addDuelPoints(app: App, teamId: string, pid: string, pts: number): void {
  if (pts <= 0) return;
  const { cur } = duelPeriods(app);
  if (!cur) return;
  const row = enroll(app, cur, teamId);
  app.db.run(`INSERT INTO ev_duel_pts(period, team_id, player_id, points) VALUES(?, ?, ?, ?)
    ON CONFLICT(period, team_id, player_id) DO UPDATE SET points = points + excluded.points`, cur.key, teamId, pid, pts);
  broadcastDuel(app, teamId);
  if (row.rival_id) broadcastDuel(app, row.rival_id);
}

export const duelHandlers: Handlers = {
  'duel.state': (app, s) => { requireTeam(app, s.pid); return { duel: duelState(app, s.pid)! }; },
};
