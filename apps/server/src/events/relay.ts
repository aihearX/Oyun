import type { EventPeriod, RelayLeg, RelayState } from '@odi/shared';
import { DUEL_RULES } from '@odi/shared';
import { fail, type App, type Handlers } from '../app';
import { systemMessage, teamRoom } from '../chat';
import { addTeamXp, broadcastExtra } from '../teamextra';
import { requireTeam } from '../teams';
import { checkRun, giveRewards, hash32, markDone, notify, relayPeriod, rw } from './common';
import { addDuelPoints } from './duel';
import { questProgress } from './quests';

export const RELAY_LEGS = 4;
/** her ayağın bölüm havuzu (farklı mekanikler): 1 koşu, 2 trambolin, 3 makine, 4 yüzme */
const LEG_POOLS = [[2, 3, 4, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [21, 22, 23, 24]];
export const RELAY_REWARDS = { finish: rw(120, 10), podium: [rw(0, 50), rw(0, 30), rw(0, 20)] };
const RELAY_TEAM_XP = 60;
/** bayrağı alan bu süre içinde koşmazsa bayrak serbest kalır */
const leaseMs = (app: App) => (app.cfg.eventsFast ? 5 * 60_000 : 30 * 60_000);

export function relayLegs(period: EventPeriod): { level: number; salt: number }[] {
  return LEG_POOLS.map((pool, i) => { const h = hash32(`bayrak:${period.key}:${i}`); return { level: pool[h % pool.length]!, salt: 100 + ((h >>> 8) % 900) }; });
}

interface RelayRow { period: string; team_id: string; current: number; carrier: string | null; carrier_at: number | null; last_runner: string | null }
interface LegRow { leg: number; best_sec: number | null; best_by: string | null; first_by: string | null; first_at: number | null }

function ensure(app: App, period: string, teamId: string): RelayRow {
  app.db.run('INSERT OR IGNORE INTO ev_relay(period, team_id) VALUES(?, ?)', period, teamId);
  const r = app.db.get<RelayRow>('SELECT * FROM ev_relay WHERE period = ? AND team_id = ?', period, teamId)!;
  if (r.carrier && (r.carrier_at ?? 0) + leaseMs(app) <= app.now()) {
    app.db.run('UPDATE ev_relay SET carrier = NULL, carrier_at = NULL WHERE period = ? AND team_id = ?', period, teamId);
    return { ...r, carrier: null, carrier_at: null };
  }
  return r;
}
const nameOf = (app: App, id: string | null) => (id ? app.playerOrNull(id)?.name ?? '?' : '');

export function relayState(app: App, teamId: string): RelayState {
  relayTick(app);
  const period = relayPeriod(app);
  const r = ensure(app, period.key, teamId);
  const legRows = new Map(app.db.all<LegRow>('SELECT leg, best_sec, best_by, first_by, first_at FROM ev_relay_leg WHERE period = ? AND team_id = ?', period.key, teamId).map((x) => [x.leg, x]));
  const legs: RelayLeg[] = relayLegs(period).map((l, i) => {
    const x = legRows.get(i);
    return { index: i, level: l.level, salt: l.salt, best: x?.best_sec != null ? { id: x.best_by!, name: nameOf(app, x.best_by), timeSec: x.best_sec } : null, firstBy: x?.first_by ? { id: x.first_by, name: nameOf(app, x.first_by) } : null };
  });
  const totalSec = legs.every((l) => l.best) ? Math.round(legs.reduce((a, l) => a + l.best!.timeSec, 0) * 10) / 10 : null;
  const ranking = app.db.all<{ team_id: string; name: string; emblem: string; n: number; total: number }>(
    `SELECT l.team_id, t.name, t.emblem, COUNT(l.best_sec) AS n, SUM(l.best_sec) AS total FROM ev_relay_leg l JOIN teams t ON t.id = l.team_id
     WHERE l.period = ? GROUP BY l.team_id`, period.key)
    .map((x) => ({ teamId: x.team_id, name: x.name, emblem: x.emblem, legs: x.n, totalSec: x.n >= RELAY_LEGS ? Math.round(x.total * 10) / 10 : null }))
    .sort((a, b) => (a.totalSec ?? Infinity) - (b.totalSec ?? Infinity) || b.legs - a.legs).slice(0, 20);
  const history = app.db.all<{ leg: number; player_id: string; name: string; time_sec: number; at: number }>(
    'SELECT r.leg, r.player_id, p.name, r.time_sec, r.at FROM ev_relay_run r JOIN players p ON p.id = r.player_id WHERE r.period = ? AND r.team_id = ? AND r.completed = 1 ORDER BY r.at DESC LIMIT 12', period.key, teamId)
    .map((x) => ({ leg: x.leg, id: x.player_id, name: x.name, timeSec: x.time_sec, at: x.at }));
  return {
    period, legs, current: r.current, totalSec, ranking, history, rewards: RELAY_REWARDS,
    carrier: r.carrier ? { id: r.carrier, name: nameOf(app, r.carrier), since: r.carrier_at!, until: r.carrier_at! + leaseMs(app) } : null,
    lastRunner: r.last_runner ? { id: r.last_runner, name: nameOf(app, r.last_runner) } : null,
  };
}

export function broadcastRelay(app: App, teamId: string): void {
  if (!app.team(teamId)) return;
  const relay = relayState(app, teamId);
  app.emitEach(app.teamMemberIds(teamId), 'relay.updated', () => ({ relay }));
}

/** biten haftaların kapanışı: parkuru bitiren takımların koşucularına ödül, ilk 3'e ek kristal */
export function relayTick(app: App): void {
  const cur = relayPeriod(app).key;
  const open = app.db.all<{ period: string }>('SELECT DISTINCT period FROM ev_relay WHERE period != ?', cur);
  for (const { period } of open) {
    if (!markDone(app, 'bayrak', period)) continue;
    const done = app.db.all<{ team_id: string; n: number; total: number }>('SELECT team_id, COUNT(best_sec) AS n, SUM(best_sec) AS total FROM ev_relay_leg WHERE period = ? GROUP BY team_id HAVING n >= ? ORDER BY total', period, RELAY_LEGS);
    done.forEach((d, i) => {
      if (!app.team(d.team_id)) return;
      const runners = app.db.all<{ player_id: string }>('SELECT DISTINCT player_id FROM ev_relay_run WHERE period = ? AND team_id = ? AND completed = 1', period, d.team_id).map((x) => x.player_id);
      const total = Math.round(d.total * 10) / 10;
      for (const pid of runners) {
        giveRewards(app, pid, RELAY_REWARDS.finish, `Bayrak Yarışı: parkur tamam (${total} sn)`);
        if (i < 3) giveRewards(app, pid, RELAY_REWARDS.podium[i]!, `Bayrak Yarışı: ${i + 1}. sıra`);
      }
      systemMessage(app, teamRoom(d.team_id), `Bayrak Yarışı bitti: toplam ${total} sn, ${i + 1}. sıra! Koşuculara ödüller ödül kutusunda.`, 'system', { event: 'bayrak' });
    });
  }
}

export const relayHandlers: Handlers = {
  'relay.state': (app, s) => { const { t } = requireTeam(app, s.pid); return { relay: relayState(app, t.id) }; },
  'relay.take': (app, s) => {
    const { p, t } = requireTeam(app, s.pid);
    const period = relayPeriod(app);
    const r = ensure(app, period.key, t.id);
    if (r.current >= RELAY_LEGS) fail('BITTI', 'Parkur tamamlandı; artık istediğin ayakta süreyi iyileştirebilirsin.');
    if (r.carrier === p.id) return { relay: relayState(app, t.id) };
    if (r.carrier) fail('MESGUL', `Bayrak şu an ${nameOf(app, r.carrier)} adlı üyede.`);
    if (r.last_runner === p.id && app.teamMemberIds(t.id).length > 1) fail('SART', 'Sıradaki ayağı başka bir takım arkadaşın koşmalı; bayrağı devret!');
    app.db.run('UPDATE ev_relay SET carrier = ?, carrier_at = ? WHERE period = ? AND team_id = ?', p.id, app.now(), period.key, t.id);
    systemMessage(app, teamRoom(t.id), `${p.name} bayrağı aldı: ${r.current + 1}. ayak koşuluyor!`, 'system', { event: 'bayrak' });
    broadcastRelay(app, t.id);
    return { relay: relayState(app, t.id) };
  },
  'relay.pass': (app, s, { to }) => {
    const { p, t } = requireTeam(app, s.pid);
    const period = relayPeriod(app);
    const r = ensure(app, period.key, t.id);
    if (r.current >= RELAY_LEGS) fail('BITTI', 'Parkur tamamlandı.');
    const mayPass = r.carrier === p.id || (!r.carrier && r.last_runner === p.id) || (!r.carrier && p.team_role !== 'uye');
    if (!mayPass) fail('YETKI', r.carrier ? 'Bayrağı yalnızca taşıyan devredebilir.' : 'Bayrağı son koşan ya da lider/yardımcı devredebilir; istersen kendin al.');
    if (to === p.id) fail('GECERSIZ', 'Bayrağı kendine devredemezsin.');
    const target = app.playerOrNull(to);
    if (!target || target.team_id !== t.id) return fail('YOK', 'Bu oyuncu takımında değil.');
    app.db.run('UPDATE ev_relay SET carrier = ?, carrier_at = ? WHERE period = ? AND team_id = ?', to, app.now(), period.key, t.id);
    systemMessage(app, teamRoom(t.id), `${p.name} bayrağı ${target.name} adlı üyeye devretti: ${r.current + 1}. ayak!`, 'system', { event: 'bayrak' });
    notify(app, [to], { kind: 'bayrak', icon: '🚩', title: 'Bayrak sende!', text: `${p.name} sana devretti: ${r.current + 1}. ayağı koş!`, target: 'bayrak' });
    broadcastRelay(app, t.id);
    return { relay: relayState(app, t.id) };
  },
  'relay.submit': (app, s, d) => {
    const { p, t } = requireTeam(app, s.pid);
    checkRun(d);
    const period = relayPeriod(app);
    if (app.db.get('SELECT 1 AS x FROM ev_relay_run WHERE player_id = ? AND run_id = ?', p.id, d.runId)) return { relay: relayState(app, t.id), improved: false };
    const r = ensure(app, period.key, t.id);
    if (d.leg < 0 || d.leg >= RELAY_LEGS) fail('GECERSIZ', 'Geçersiz ayak.');
    const firstPass = r.current < RELAY_LEGS;
    if (firstPass) {
      if (d.leg !== r.current) fail('SART', `Sıradaki ayak ${r.current + 1}. ayak.`);
      if (r.carrier !== p.id) fail('YETKI', 'Bu ayağı koşmak için önce bayrağı almalısın.');
    } else if (d.leg > RELAY_LEGS - 1) fail('GECERSIZ', 'Geçersiz ayak.');
    const now = app.now();
    const time = Math.round(d.timeSec * 10) / 10;
    app.db.run('INSERT INTO ev_relay_run(player_id, run_id, period, team_id, leg, time_sec, completed, at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)', p.id, d.runId, period.key, t.id, d.leg, time, d.completed ? 1 : 0, now);
    if (!d.completed) { broadcastRelay(app, t.id); return { relay: relayState(app, t.id), improved: false }; }
    const leg = app.db.get<LegRow>('SELECT leg, best_sec, best_by, first_by, first_at FROM ev_relay_leg WHERE period = ? AND team_id = ? AND leg = ?', period.key, t.id, d.leg);
    const improved = !leg || leg.best_sec == null || time < leg.best_sec;
    if (improved) app.db.run(`INSERT INTO ev_relay_leg(period, team_id, leg, best_sec, best_by, first_by, first_at) VALUES(?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(period, team_id, leg) DO UPDATE SET best_sec = excluded.best_sec, best_by = excluded.best_by`, period.key, t.id, d.leg, time, p.id, p.id, now);
    questProgress(app, t.id, 'bayrak', 1);
    if (firstPass) {
      const next = r.current + 1;
      app.db.run('UPDATE ev_relay SET current = ?, carrier = NULL, carrier_at = NULL, last_runner = ? WHERE period = ? AND team_id = ?', next, p.id, period.key, t.id);
      addDuelPoints(app, t.id, p.id, DUEL_RULES.relayLeg);
      if (next >= RELAY_LEGS) {
        addTeamXp(app, t.id, RELAY_TEAM_XP);
        broadcastExtra(app, t.id);
        systemMessage(app, teamRoom(t.id), `${p.name} son ayağı ${time} sn'de bitirdi: parkur tamam! Artık her ayakta süreyi iyileştirebilirsiniz.`, 'system', { event: 'bayrak' });
        notify(app, app.teamMemberIds(t.id), { kind: 'bayrak', icon: '🏁', title: 'Bayrak Yarışı parkuru tamam!', text: 'Şimdi en iyi süreleri kovalayın.', target: 'bayrak' });
      } else {
        systemMessage(app, teamRoom(t.id), `${p.name} ${d.leg + 1}. ayağı ${time} sn'de bitirdi! Sıradaki ${next + 1}. ayak: bayrağı kim alacak?`, 'system', { event: 'bayrak' });
        notify(app, app.teamMemberIds(t.id).filter((x) => x !== p.id), { kind: 'bayrak', icon: '🚩', title: `${next + 1}. ayak seni bekliyor!`, text: `${p.name} ${d.leg + 1}. ayağı bitirdi. Bayrağı al!`, target: 'bayrak' });
      }
    } else if (improved) {
      addDuelPoints(app, t.id, p.id, DUEL_RULES.relayImprove);
      systemMessage(app, teamRoom(t.id), `${p.name} ${d.leg + 1}. ayakta yeni en iyi süre: ${time} sn!`, 'system', { event: 'bayrak' });
    }
    broadcastRelay(app, t.id);
    return { relay: relayState(app, t.id), improved };
  },
};
