import { BUILDINGS, CAMP_V, LEGACY_BUILDINGS, buildCost, crystalsToFinish, helpReductionSec, SOCIAL_LIMITS, type BuildingId, type BuildingState, type CampState, type EvtMap, type RemedyState } from '@odi/shared';
import { CAMP_COSMETICS, CAMP_XP, buildingOpen, depotCapHours, remedyById, remedyInvCap, remedyShelf, taramaFactor } from '@odi/content';
import { campLevelOf, campVOf, campXpOf, cheersOf, decorState, ensureCampXp, grantCampXp, libAtOf, onCampChanged, syncCampRewards } from './camp-xp';
import { fail, type App, type Handlers } from './app';
import { feedBuilding } from './comm/feed';
import { addContrib, techBonus } from './teamextra';
import { requireTeam } from './teams';
import { dayKey, HOUR_MS } from './time';

export const SPEEDUP_SEC = { m5: 300, m60: 3600, s8: 28_800 } as const;
export const CAMP_HELP_REWARD = 2;
export const CAMP_HELP_REWARD_DAILY = 30;
export const DEPOT_PER_LEVEL_HOUR = 20;
export const DEPOT_CAP_HOURS = 8;
/** depo dolma süresi: 8 sa + Vestibüler Laboratuvar 0,5 sa/Sv */
const depotCapH = (app: App, pid: string) => depotCapHours(levelOf(app, pid, 'denge'));

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
  // eski istemciler (campV < 2) yeni bina kimliklerini tanımaz: onlara yalnız eski binalar gider
  const full = campVOf(app, pid) >= CAMP_V;
  const buildings: BuildingState[] = BUILDINGS.filter((b) => full || LEGACY_BUILDINGS.includes(b.id)).map((b) => {
    const r = map.get(b.id);
    return { id: b.id, level: r?.level ?? 0, upgradingTo: r?.upgrading_to ?? null, startedAt: r?.started_at ?? null, endsAt: r?.ends_at ?? null, helpsReceived: r?.helps ?? 0 };
  });
  return { buildings, depotStoredAt: p.depot_at, serverTime: app.now(), remedy: remedyState(app, pid),
    xp: campXpOf(app, pid), decor: decorState(app, pid), libAt: libAtOf(app, pid), cheers: cheersOf(app, pid) };
}
onCampChanged((app, pid) => app.emit(pid, 'camp.updated', { camp: campState(app, pid) }));

// ------------------------------------------------------------------ Tedavi Odası (docs/14-kamp.md)
const levelOf = (app: App, pid: string, id: BuildingId) => app.db.get<{ level: number }>('SELECT level FROM buildings WHERE player_id = ? AND id = ?', pid, id)?.level ?? 0;
export function remedyState(app: App, pid: string): RemedyState {
  const prod = app.db.get<{ item: string | null; since: number }>('SELECT item, since FROM remedy_prod WHERE player_id = ?', pid);
  const inv: Record<string, number> = {};
  for (const r of app.db.all<{ id: string; n: number }>('SELECT id, n FROM remedy_inv WHERE player_id = ? AND n > 0', pid)) inv[r.id] = r.n;
  return { item: prod?.item ?? null, since: prod?.since ?? 0, inv };
}
const invOf = (app: App, pid: string, id: string) => app.db.get<{ n: number }>('SELECT n FROM remedy_inv WHERE player_id = ? AND id = ?', pid, id)?.n ?? 0;
function addInv(app: App, pid: string, id: string, n: number): void {
  app.db.run('INSERT INTO remedy_inv(player_id, id, n) VALUES(?, ?, ?) ON CONFLICT(player_id, id) DO UPDATE SET n = MAX(0, n + excluded.n)', pid, id, n);
}
/**
 * raftaki hazır malzemeleri çantaya al (çantaya sığdığı kadar; sığmayan rafta kalır). Zamana bağlıdır: hemen ikinci çağrı 0 alır.
 * Dönüş: alınan adet ve rafta kalan adet.
 */
export function collectRemedies(app: App, pid: string): { collected: number; left: number } {
  const prod = app.db.get<{ item: string | null; since: number }>('SELECT item, since FROM remedy_prod WHERE player_id = ?', pid);
  const def = prod?.item ? remedyById(prod.item) : undefined;
  if (!prod || !def) return { collected: 0, left: 0 };
  const now = app.now(); const lv = levelOf(app, pid, 'tedavi');
  const sh = remedyShelf(def, lv, prod.since, now, taramaFactor(levelOf(app, pid, 'tarama')));
  if (sh.ready <= 0) return { collected: 0, left: 0 };
  const take = Math.max(0, Math.min(sh.ready, remedyInvCap(campLevelOf(app, pid)) - invOf(app, pid, def.id)));
  const left = sh.ready - take;
  if (take > 0) addInv(app, pid, def.id, take);
  // kalan adetler rafta durur: sayaç, onları hâlâ "hazır" sayacak şekilde geri alınır
  app.db.run('UPDATE remedy_prod SET since = ? WHERE player_id = ?', sh.nextSince - left * sh.periodMs, pid);
  if (take > 0) grantCampXp(app, pid, take * CAMP_XP.remedy, 'Tedavi Odası', undefined, { silent: true });
  return { collected: take, left };
}
/** bölümde kullanılan malzemeler envanterden düşer (koşu kimliğiyle bir kez; fazlası sıfırda durur) */
export function useRemedies(app: App, pid: string, runId: string, used: { id: string; count: number }[] | undefined): void {
  if (!used?.length) return;
  if (app.db.get('SELECT 1 AS x FROM remedy_use WHERE player_id = ? AND run_id = ?', pid, runId)) return;
  const clean = used.filter((u) => remedyById(u.id) && u.count > 0).map((u) => ({ id: u.id, count: Math.min(9, Math.floor(u.count)) }));
  for (const u of clean) app.db.run('UPDATE remedy_inv SET n = MAX(0, n - ?) WHERE player_id = ? AND id = ?', u.count, pid, u.id);
  app.db.run('INSERT INTO remedy_use(player_id, run_id, used, at) VALUES(?, ?, ?, ?)', pid, runId, JSON.stringify(clean), app.now());
  if (clean.length) app.emit(pid, 'camp.updated', { camp: campState(app, pid) });
}
/** bina seviyesiyle açılan kamp kozmetikleri: bir kez verilir (camp_unlocks), oyuncu profiline (me.cosmetics) yazılır */
export function grantCampUnlocks(app: App, pid: string): string[] {
  const lv = new Map(rows(app, pid).map((r) => [r.id, r.level]));
  const given: string[] = [];
  for (const c of CAMP_COSMETICS) {
    if ((lv.get(c.building) ?? 0) < c.level) continue;
    const ref = `kozmetik:${c.id}`;
    if (app.db.run('INSERT OR IGNORE INTO camp_unlocks(player_id, ref, at) VALUES(?, ?, ?)', pid, ref, app.now()) === 0) continue;
    app.grant(pid, { kind: 'kozmetik', amount: 1, ref: c.id }); given.push(c.id);
  }
  return given;
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
    ensureCampXp(app, r.player_id); // geriye dönük tohum yeni seviyeden önce (iki kez sayılmasın)
    app.db.run('UPDATE buildings SET level = ?, upgrading_to = NULL, started_at = NULL, ends_at = NULL, helps = 0, help_req = 0 WHERE player_id = ? AND id = ?', r.upgrading_to!, r.player_id, r.id);
    if (r.id === 'depo' && r.level === 0) app.db.run('UPDATE players SET depot_at = ? WHERE id = ?', r.ends_at!, r.player_id);
    if (r.id === 'kutuphane' && r.level === 0) app.db.run('UPDATE camp_xp SET lib_at = ? WHERE player_id = ?', r.ends_at!, r.player_id);
    grantCampXp(app, r.player_id, CAMP_XP.build(r.id, r.upgrading_to!), `İnşaat: ${r.id} Sv ${r.upgrading_to}`, `bina:${r.id}:${r.upgrading_to}`, { silent: true });
    owners.add(r.player_id);
    feedBuilding(app, r.player_id, r.id, r.upgrading_to!);
    if (r.help_req) { const t = app.playerOrNull(r.player_id)?.team_id; if (t) teams.add(t); }
  }
  for (const o of owners) { grantCampUnlocks(app, o); app.emit(o, 'camp.updated', { camp: campState(app, o) }); }
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
  // eski istemciler yeni bina kimliklerini tanımaz: onlara yalnız eski binaların istekleri gider
  app.emitEach(app.teamMemberIds(teamId), 'team.campHelpNeeded', (pid) => ({ requests: campHelpList(app, teamId, pid).filter((r) => campVOf(app, pid) >= CAMP_V || LEGACY_BUILDINGS.includes(r.building)) }));
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
  if (campVOf(app, targetId) >= CAMP_V || LEGACY_BUILDINGS.includes(building)) app.emit(targetId, 'camp.helped', { from: helperId, name: h.name, building, seconds });
  completeDue(app, targetId);
  app.emit(targetId, 'camp.updated', { camp: campState(app, targetId) });
}

export const campHandlers: Handlers = {
  'camp.state': (app, s) => { completeDue(app, s.pid); grantCampUnlocks(app, s.pid); syncCampRewards(app, s.pid); return { camp: campState(app, s.pid), wallet: app.wallet(s.pid) }; },
  'camp.remedy.make': (app, s, { item }) => {
    completeDue(app, s.pid);
    const lv = levelOf(app, s.pid, 'tedavi');
    if (lv <= 0) fail('SART', 'Önce Tedavi Odası’nı kur.');
    const def = item ? remedyById(item) : null;
    if (item && !def) fail('YOK', 'Bu malzeme bilinmiyor.');
    if (def && def.level > lv) fail('SART', `${def.name} için Tedavi Odası Sv ${def.level} gerekli.`);
    const cur = app.db.get<{ item: string | null }>('SELECT item FROM remedy_prod WHERE player_id = ?', s.pid);
    if ((cur?.item ?? null) === (item ?? null)) return { camp: campState(app, s.pid), collected: 0 };
    const { collected, left } = collectRemedies(app, s.pid);
    if (left > 0) fail('DOLU', 'Raftaki malzemeler çantana sığmıyor; önce birkaçını bölümde kullan.');
    app.db.run('INSERT INTO remedy_prod(player_id, item, since) VALUES(?, ?, ?) ON CONFLICT(player_id) DO UPDATE SET item = excluded.item, since = excluded.since', s.pid, item ?? null, app.now());
    return { camp: campState(app, s.pid), collected };
  },
  'camp.remedy.collect': (app, s) => {
    completeDue(app, s.pid);
    const { collected } = collectRemedies(app, s.pid);
    return { camp: campState(app, s.pid), collected };
  },
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
    if (def.campLevel && !buildingOpen(id, campLevelOf(app, s.pid))) fail('SART', `${def.name} için Kamp Seviyesi ${def.campLevel} gerekli.`);
    if (id !== 'merkez' && to > merkez) fail('SART', `Önce Odyoloji Merkezi'ni ${to}. seviyeye yükseltmelisin.`);
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
      const capMs = depotCapH(app, s.pid) * HOUR_MS;
      const elapsed = Math.max(0, now - p.depot_at);
      collected = Math.floor((Math.min(elapsed, capMs) / HOUR_MS) * rate);
      const nextAt = elapsed >= capMs ? now : p.depot_at + Math.round((collected / rate) * HOUR_MS);
      app.db.run('UPDATE players SET depot_at = ?, jeton = jeton + ? WHERE id = ?', nextAt, collected, s.pid);
      const xp = Math.min(CAMP_XP.depotMax, Math.floor(collected / CAMP_XP.depotPer));
      if (xp > 0) grantCampXp(app, s.pid, xp, 'Kulak Deposu', undefined, { silent: true });
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
