import { BUILDINGS, buildCost, crystalsToFinish, helpReductionSec, SOCIAL_LIMITS, type BuildingId, type BuildingState, type CampState, type EvtMap } from '@odi/shared';
import { fail, type App, type Handlers } from './app';
import { addContrib, techBonus } from './teamextra';
import { requireTeam } from './teams';
import { dayKey, HOUR_MS } from './time';

export const SPEEDUP_SEC = { m5: 300, m60: 3600, s8: 28_800 } as const;
export const CAMP_HELP_REWARD = 2;
export const CAMP_HELP_REWARD_DAILY = 30;
export const DEPOT_PER_LEVEL_HOUR = 20;
export const DEPOT_CAP_HOURS = 8;

interface BRow { player_id: string; id: BuildingId; level: number; upgrading_to: number | null; started_at: number | null; ends_at: number | null; helps: number; help_req: number }

const rows = (app: App, pid: string) => app.db.all<BRow>('SELECT * FROM buildings WHERE player_id = ?', pid);
function row(app: App, pid: string, id: BuildingId): BRow {
  const r = app.db.get<BRow>('SELECT * FROM buildings WHERE player_id = ? AND id = ?', pid, id);
  if (!r) return fail('YOK', 'Bina bulunamadı.');
  return r;
}

/** inşaat başına alınabilecek en çok yardım: 5 + Dayanışma teknolojisi */
export const helpsMax = (app: App, teamId: string | null) => SOCIAL_LIMITS.helpMax + techBonus(app, teamId, 'yardim');

export function campState(app: App, pid: string): CampState {
  const p = app.player(pid);
  const map = new Map(rows(app, pid).map((r) => [r.id, r]));
  const buildings: BuildingState[] = BUILDINGS.map((b) => {
    const r = map.get(b.id);
    return { id: b.id, level: r?.level ?? 0, upgradingTo: r?.upgrading_to ?? null, startedAt: r?.started_at ?? null, endsAt: r?.ends_at ?? null, helpsReceived: r?.helps ?? 0 };
  });
  return { buildings, depotStoredAt: p.depot_at, serverTime: app.now() };
}

/** süresi dolan inşaatları tamamla (sorgu anında ve zamanlayıcıyla). pid verilmezse herkes için. */
export function completeDue(app: App, pid?: string): void {
  const now = app.now();
  const due = pid
    ? app.db.all<BRow>('SELECT * FROM buildings WHERE player_id = ? AND ends_at IS NOT NULL AND ends_at <= ?', pid, now)
    : app.db.all<BRow>('SELECT * FROM buildings WHERE ends_at IS NOT NULL AND ends_at <= ? LIMIT 500', now);
  const teams = new Set<string>();
  const owners = new Set<string>();
  for (const r of due) {
    app.db.run('UPDATE buildings SET level = ?, upgrading_to = NULL, started_at = NULL, ends_at = NULL, helps = 0, help_req = 0 WHERE player_id = ? AND id = ?', r.upgrading_to!, r.player_id, r.id);
    if (r.id === 'depo' && r.level === 0) app.db.run('UPDATE players SET depot_at = ? WHERE id = ?', r.ends_at!, r.player_id);
    owners.add(r.player_id);
    if (r.help_req) { const t = app.playerOrNull(r.player_id)?.team_id; if (t) teams.add(t); }
  }
  for (const o of owners) app.emit(o, 'camp.updated', { camp: campState(app, o) });
  for (const t of teams) broadcastHelpNeeded(app, t);
}

type HelpNeeded = EvtMap['team.campHelpNeeded']['requests'];
/** takımdaki açık inşaat yardım istekleri; viewer verilirse kendi isteği ve zaten yardım ettikleri çıkarılır */
export function campHelpList(app: App, teamId: string, viewer?: string): HelpNeeded {
  const max = helpsMax(app, teamId);
  const list = app.db.all<BRow & { name: string }>(
    `SELECT b.*, p.name FROM buildings b JOIN players p ON p.id = b.player_id WHERE p.team_id = ? AND b.help_req = 1 AND b.ends_at > ? AND b.helps < ? ORDER BY b.ends_at`,
    teamId, app.now(), max);
  return list
    .filter((r) => !viewer || (r.player_id !== viewer && !app.db.get('SELECT 1 AS x FROM camp_helps WHERE player_id = ? AND building = ? AND to_level = ? AND helper_id = ?', r.player_id, r.id, r.upgrading_to!, viewer)))
    .map((r) => ({ playerId: r.player_id, name: r.name, building: r.id, endsAt: r.ends_at!, helpsReceived: r.helps, helpsMax: max }));
}
export function broadcastHelpNeeded(app: App, teamId: string): void {
  app.emitEach(app.teamMemberIds(teamId), 'team.campHelpNeeded', (pid) => ({ requests: campHelpList(app, teamId, pid) }));
}

/** tek bir yardım; uygun değilse hata fırlatır */
function helpOnce(app: App, helperId: string, targetId: string, building: BuildingId): void {
  const h = app.player(helperId);
  const t = app.playerOrNull(targetId);
  if (!t || !h.team_id || t.team_id !== h.team_id) fail('YOK', 'Bu oyuncu takımında değil.');
  if (targetId === helperId) fail('GECERSIZ', 'Kendi inşaatına yardım edemezsin.');
  const now = app.now();
  const r = row(app, targetId, building);
  if (!r.upgrading_to || !r.ends_at || r.ends_at <= now) fail('YOK', 'Bu binada süren bir inşaat yok.');
  if (!r.help_req) fail('GECERSIZ', 'Bu inşaat için yardım istenmedi.');
  const max = helpsMax(app, h.team_id);
  if (r.helps >= max) fail('DOLU', 'Bu inşaat en çok yardımı aldı.');
  if (app.db.get('SELECT 1 AS x FROM camp_helps WHERE player_id = ? AND building = ? AND to_level = ? AND helper_id = ?', targetId, building, r.upgrading_to, helperId)) fail('TEKRAR', 'Bu inşaata zaten yardım ettin.');
  const remainingSec = Math.ceil((r.ends_at - now) / 1000);
  const seconds = Math.min(remainingSec, helpReductionSec(remainingSec));
  app.db.run('INSERT INTO camp_helps(player_id, building, to_level, helper_id, at) VALUES(?, ?, ?, ?, ?)', targetId, building, r.upgrading_to, helperId, now);
  app.db.run('UPDATE buildings SET ends_at = ends_at - ?, helps = helps + 1 WHERE player_id = ? AND id = ?', seconds * 1000, targetId, building);
  const day = dayKey(now);
  if (app.dailyInc(helperId, day, 'camp_help') <= CAMP_HELP_REWARD_DAILY) { app.addCurrency(helperId, 'jeton', CAMP_HELP_REWARD); app.walletChanged(helperId); }
  addContrib(app, h.team_id!, helperId, { helps: 1 });
  app.emit(targetId, 'camp.helped', { from: helperId, name: h.name, building, seconds });
  completeDue(app, targetId);
  app.emit(targetId, 'camp.updated', { camp: campState(app, targetId) });
}

export const campHandlers: Handlers = {
  'camp.state': (app, s) => { completeDue(app, s.pid); return { camp: campState(app, s.pid), wallet: app.wallet(s.pid) }; },
  'camp.upgrade': (app, s, { id }) => {
    completeDue(app, s.pid);
    const all = rows(app, s.pid);
    if (all.some((r) => r.upgrading_to)) fail('MESGUL', 'Aynı anda yalnızca bir inşaat yapılabilir.');
    const r = all.find((x) => x.id === id);
    const def = BUILDINGS.find((b) => b.id === id)!;
    if (!r) return fail('YOK', 'Bina bulunamadı.');
    const to = r.level + 1;
    if (to > def.maxLevel) fail('MAKS', `${def.name} en yüksek seviyede.`);
    const merkez = all.find((x) => x.id === 'merkez')?.level ?? 1;
    if (id !== 'merkez' && to > merkez) fail('SART', `Önce Kamp Merkezi'ni ${to}. seviyeye yükseltmelisin.`);
    const cost = buildCost(id, to);
    app.spend(s.pid, 'jeton', cost.jeton);
    const p = app.player(s.pid);
    const seconds = Math.max(1, Math.round(cost.seconds * (1 - techBonus(app, p.team_id, 'insaat') / 100)));
    const now = app.now();
    app.db.run('UPDATE buildings SET upgrading_to = ?, started_at = ?, ends_at = ?, helps = 0, help_req = 0 WHERE player_id = ? AND id = ?', to, now, now + seconds * 1000, s.pid, id);
    return { camp: campState(app, s.pid), wallet: app.walletChanged(s.pid) };
  },
  'camp.speedup': (app, s, { id, item, count }) => {
    completeDue(app, s.pid);
    const r = row(app, s.pid, id);
    const now = app.now();
    if (!r.upgrading_to || !r.ends_at) fail('YOK', 'Bu binada süren bir inşaat yok.');
    if (item === 'kristal') {
      const remaining = Math.ceil((r.ends_at! - now) / 1000);
      app.spend(s.pid, 'kristal', crystalsToFinish(remaining));
      app.db.run('UPDATE buildings SET ends_at = ? WHERE player_id = ? AND id = ?', now, s.pid, id);
    } else {
      const n = count ?? 1;
      const remaining = Math.ceil((r.ends_at! - now) / 1000);
      const useful = Math.min(n, Math.ceil(remaining / SPEEDUP_SEC[item]));
      app.spend(s.pid, item, useful);
      app.db.run('UPDATE buildings SET ends_at = ends_at - ? WHERE player_id = ? AND id = ?', useful * SPEEDUP_SEC[item] * 1000, s.pid, id);
    }
    completeDue(app, s.pid);
    if (r.help_req) { const t = app.player(s.pid).team_id; if (t) broadcastHelpNeeded(app, t); }
    return { camp: campState(app, s.pid), wallet: app.walletChanged(s.pid) };
  },
  'camp.collect': (app, s) => {
    completeDue(app, s.pid);
    const p = app.player(s.pid);
    const level = row(app, s.pid, 'depo').level;
    const now = app.now();
    let collected = 0;
    if (level <= 0) app.db.run('UPDATE players SET depot_at = ? WHERE id = ?', now, s.pid);
    else {
      const rate = level * DEPOT_PER_LEVEL_HOUR; // jeton/saat
      const capMs = DEPOT_CAP_HOURS * HOUR_MS;
      const elapsed = Math.max(0, now - p.depot_at);
      collected = Math.floor((Math.min(elapsed, capMs) / HOUR_MS) * rate);
      const nextAt = elapsed >= capMs ? now : p.depot_at + Math.round((collected / rate) * HOUR_MS);
      app.db.run('UPDATE players SET depot_at = ?, jeton = jeton + ? WHERE id = ?', nextAt, collected, s.pid);
    }
    return { camp: campState(app, s.pid), wallet: app.walletChanged(s.pid), collected };
  },
  'camp.help.request': (app, s, { id }) => {
    completeDue(app, s.pid);
    const { t } = requireTeam(app, s.pid);
    const r = row(app, s.pid, id);
    if (!r.upgrading_to) fail('YOK', 'Bu binada süren bir inşaat yok.');
    app.db.run('UPDATE buildings SET help_req = 1 WHERE player_id = ? AND id = ?', s.pid, id);
    broadcastHelpNeeded(app, t.id);
    return { camp: campState(app, s.pid) };
  },
  'team.camp.help': (app, s, { playerId, building }) => {
    const { t } = requireTeam(app, s.pid);
    completeDue(app, playerId);
    helpOnce(app, s.pid, playerId, building);
    broadcastHelpNeeded(app, t.id);
    return { given: 1 };
  },
  'team.camp.helpAll': (app, s) => {
    const { t } = requireTeam(app, s.pid);
    completeDue(app);
    let given = 0;
    for (const req of campHelpList(app, t.id, s.pid)) { helpOnce(app, s.pid, req.playerId, req.building); given++; }
    if (given) broadcastHelpNeeded(app, t.id);
    return { given };
  },
};
