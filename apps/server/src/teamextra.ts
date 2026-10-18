import { TEAM_TECH, techCost, type TeamExtra, type TeamGift, type TeamGoal, type TeamGoalTier, type TechId, type TechState } from '@odi/shared';
import { fail, parseJson, rid, type App, type Grant, type Handlers } from './app';
import { systemMessage, teamRoom } from './chat';
import { requireTeam } from './teams';
import { DAY_MS } from './time';

export const GIFT_TTL_MS = DAY_MS;
const GIFT_LIST_MS = 7 * DAY_MS;

/** Takım seviyesi: eşik(l) = 300 × (l−1)^1.6 (şeffaf formül) */
export const teamXpFor = (level: number) => Math.round(300 * Math.pow(Math.max(0, level - 1), 1.6));
export function teamLevel(xp: number): number { let l = 1; while (xp >= teamXpFor(l + 1)) l++; return l; }

type GoalMetric = 'yildiz' | 'bolum' | 'baskin';
const tier = (need: number, jeton: number, kristal: number): TeamGoalTier => ({
  need, reward: [{ kind: 'jeton', amount: jeton, ref: '' }, ...(kristal ? [{ kind: 'kristal' as const, amount: kristal, ref: '' }] : [])],
});
/** Haftalık takım hedefleri: 3 hedef × 4 kademe; ödüller sabit ve önceden görünür */
export const TEAM_GOALS: { metric: GoalMetric; name: string; tiers: TeamGoalTier[] }[] = [
  { metric: 'yildiz', name: 'Yıldız Avı', tiers: [tier(30, 100, 0), tier(90, 150, 10), tier(180, 250, 20), tier(300, 400, 40)] },
  { metric: 'bolum', name: 'Bölüm Maratonu', tiers: [tier(20, 100, 0), tier(60, 150, 10), tier(120, 250, 20), tier(200, 400, 40)] },
  { metric: 'baskin', name: 'Canavar Avı', tiers: [tier(500, 100, 0), tier(1500, 150, 10), tier(3000, 250, 20), tier(6000, 400, 40)] },
];

export function techLevel(app: App, teamId: string | null, tech: TechId): number {
  if (!teamId) return 0;
  return app.db.get<{ level: number }>('SELECT level FROM team_tech WHERE team_id = ? AND tech = ?', teamId, tech)?.level ?? 0;
}
/** takım teknolojisinin yüzde/adet etkisi (seviye × perLevel) */
export function techBonus(app: App, teamId: string | null, tech: TechId): number {
  return techLevel(app, teamId, tech) * TEAM_TECH.find((t) => t.id === tech)!.perLevel;
}

export function addTeamXp(app: App, teamId: string, n: number): void { if (n > 0) app.db.run('UPDATE teams SET xp = xp + ? WHERE id = ?', Math.floor(n), teamId); }

export function addContrib(app: App, teamId: string, pid: string, d: { donated?: number; helps?: number; stars?: number }): void {
  app.db.run(`INSERT INTO contrib(week, team_id, player_id, donated, helps, stars) VALUES(?, ?, ?, ?, ?, ?)
    ON CONFLICT(week, team_id, player_id) DO UPDATE SET donated = donated + excluded.donated, helps = helps + excluded.helps, stars = stars + excluded.stars`,
  app.week().key, teamId, pid, d.donated ?? 0, d.helps ?? 0, d.stars ?? 0);
}

interface GiftRow { id: string; team_id: string; from_id: string; from_name: string; reason: string; contents: string; at: number; expires_at: number; goal_ref: string | null }
const toGift = (g: GiftRow, claimed: boolean): TeamGift => ({
  id: g.id, from: g.from_id, fromName: g.from_name, reason: g.reason, contents: parseJson(g.contents, []), at: g.at, expiresAt: g.expires_at, claimed,
});

/** takım hediyesi: içerik sabit ve önceden bellidir; alıcılar o anki üyelerdir */
export function createGift(app: App, teamId: string, from: { id: string; name: string }, reason: string, contents: Grant[], recipients: string[], opts: { expiresAt?: number; goalRef?: string } = {}): string {
  const id = rid('g');
  const at = app.now();
  const row: GiftRow = { id, team_id: teamId, from_id: from.id, from_name: from.name, reason, contents: JSON.stringify(contents), at, expires_at: opts.expiresAt ?? at + GIFT_TTL_MS, goal_ref: opts.goalRef ?? null };
  app.db.run('INSERT INTO team_gifts(id, team_id, from_id, from_name, reason, contents, at, expires_at, goal_ref) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)',
    row.id, row.team_id, row.from_id, row.from_name, row.reason, row.contents, row.at, row.expires_at, row.goal_ref);
  const gift = toGift(row, false);
  for (const pid of recipients) {
    app.db.run('INSERT OR IGNORE INTO gift_recipients(gift_id, player_id) VALUES(?, ?)', id, pid);
    app.emit(pid, 'team.gift', { gift });
  }
  return id;
}

function goalProgress(app: App, week: string, teamId: string, metric: string): number {
  return app.db.get<{ progress: number }>('SELECT progress FROM goal_progress WHERE week = ? AND team_id = ? AND metric = ?', week, teamId, metric)?.progress ?? 0;
}

/** hedef ilerlemesi; kademe aşılınca o anki tüm üyelere kademe ödülü hediye olarak düşer (hafta sonuna kadar alınabilir) */
export function addGoalProgress(app: App, teamId: string, metric: GoalMetric, n: number): void {
  if (n <= 0) return;
  const w = app.week();
  const before = goalProgress(app, w.key, teamId, metric);
  const after = before + n;
  app.db.run(`INSERT INTO goal_progress(week, team_id, metric, progress) VALUES(?, ?, ?, ?)
    ON CONFLICT(week, team_id, metric) DO UPDATE SET progress = excluded.progress`, w.key, teamId, metric, after);
  const def = TEAM_GOALS.find((g) => g.metric === metric)!;
  def.tiers.forEach((t, i) => {
    if (before < t.need && after >= t.need) {
      const members = app.teamMemberIds(teamId);
      createGift(app, teamId, { id: 'sistem', name: 'Takım' }, `Takım hedefi: ${def.name} ${i + 1}. kademe`, t.reward as Grant[], members, { expiresAt: w.endsAt, goalRef: `${w.key}:${metric}:${i}` });
      systemMessage(app, teamRoom(teamId), `Takım hedefi tamamlandı: ${def.name} ${i + 1}. kademe! Ödüller herkesin hediye kutusunda.`);
    }
  });
}

export function teamExtra(app: App, teamId: string, viewer: string): TeamExtra {
  const t = app.team(teamId);
  if (!t) return fail('TAKIM_YOK', 'Takım bulunamadı.');
  const w = app.week();
  const now = app.now();
  const techRows = new Map(app.db.all<{ tech: string; level: number; progress: number }>('SELECT tech, level, progress FROM team_tech WHERE team_id = ?', teamId).map((r) => [r.tech, r]));
  const tech: TechState[] = TEAM_TECH.map((d) => {
    const r = techRows.get(d.id);
    const level = r?.level ?? 0;
    return { id: d.id, level, progress: r?.progress ?? 0, cost: level >= d.maxLevel ? 0 : techCost(level) };
  });
  const gifts = app.db.all<GiftRow & { claimed: number }>(
    `SELECT g.*, r.claimed FROM team_gifts g JOIN gift_recipients r ON r.gift_id = g.id AND r.player_id = ? WHERE g.team_id = ? AND g.at > ? ORDER BY g.at DESC LIMIT 50`,
    viewer, teamId, now - GIFT_LIST_MS).map((g) => toGift(g, !!g.claimed));
  const goals: TeamGoal[] = TEAM_GOALS.map((d) => {
    const claimedTiers = app.db.all<{ goal_ref: string }>(
      `SELECT g.goal_ref FROM team_gifts g JOIN gift_recipients r ON r.gift_id = g.id AND r.player_id = ? AND r.claimed = 1 WHERE g.team_id = ? AND g.goal_ref LIKE ?`,
      viewer, teamId, `${w.key}:${d.metric}:%`).map((r) => Number(r.goal_ref.split(':').pop()));
    return { id: `${w.key}:${d.metric}`, name: d.name, metric: d.metric, progress: goalProgress(app, w.key, teamId, d.metric), tiers: d.tiers, claimedTiers: claimedTiers.sort(), endsAt: w.endsAt };
  });
  const contributionWeek = app.db.all<{ id: string; name: string; donated: number | null; helps: number | null; stars: number | null }>(
    `SELECT p.id, p.name, c.donated, c.helps, c.stars FROM players p LEFT JOIN contrib c ON c.player_id = p.id AND c.team_id = p.team_id AND c.week = ? WHERE p.team_id = ?`, w.key, teamId)
    .map((r) => ({ id: r.id, name: r.name, donated: r.donated ?? 0, helps: r.helps ?? 0, stars: r.stars ?? 0 }))
    .sort((a, b) => b.donated - a.donated || b.helps - a.helps || b.stars - a.stars);
  const level = teamLevel(t.xp);
  return { level, xp: t.xp, xpNext: teamXpFor(level + 1), tech, gifts, goals, contributionWeek };
}

export function broadcastExtra(app: App, teamId: string): void {
  if (!app.team(teamId)) return;
  app.emitEach(app.teamMemberIds(teamId), 'team.extra.updated', (pid) => ({ extra: teamExtra(app, teamId, pid) }));
}

function claimGift(app: App, pid: string, giftId: string): void {
  const g = app.db.get<GiftRow & { claimed: number }>('SELECT g.*, r.claimed FROM team_gifts g JOIN gift_recipients r ON r.gift_id = g.id AND r.player_id = ? WHERE g.id = ?', pid, giftId);
  if (!g) return fail('YOK', 'Hediye bulunamadı.');
  if (g.claimed) fail('TEKRAR', 'Bu hediyeyi zaten aldın.');
  if (g.expires_at <= app.now()) fail('SURE', 'Bu hediyenin süresi doldu.');
  app.db.run('UPDATE gift_recipients SET claimed = 1 WHERE gift_id = ? AND player_id = ?', giftId, pid);
  for (const c of parseJson<Grant[]>(g.contents, [])) app.grant(pid, c);
}

export const extraHandlers: Handlers = {
  'team.extra': (app, s) => {
    const { t } = requireTeam(app, s.pid);
    return { extra: teamExtra(app, t.id, s.pid) };
  },
  'team.donate': (app, s, { tech, jeton }) => {
    const { p, t } = requireTeam(app, s.pid);
    const def = TEAM_TECH.find((d) => d.id === tech)!;
    const row = app.db.get<{ level: number; progress: number }>('SELECT level, progress FROM team_tech WHERE team_id = ? AND tech = ?', t.id, tech) ?? { level: 0, progress: 0 };
    if (row.level >= def.maxLevel) fail('MAKS', `${def.name} en yüksek seviyede.`);
    let needed = -row.progress;
    for (let l = row.level; l < def.maxLevel; l++) needed += techCost(l);
    const amount = Math.min(jeton, needed);
    app.spend(p.id, 'jeton', amount);
    let { level, progress } = row;
    progress += amount;
    while (level < def.maxLevel && progress >= techCost(level)) {
      progress -= techCost(level); level++;
      systemMessage(app, teamRoom(t.id), `Takım teknolojisi yükseldi: ${def.emoji} ${def.name} ${level}. seviye!`);
    }
    if (level >= def.maxLevel) progress = 0;
    app.db.run(`INSERT INTO team_tech(team_id, tech, level, progress) VALUES(?, ?, ?, ?)
      ON CONFLICT(team_id, tech) DO UPDATE SET level = excluded.level, progress = excluded.progress`, t.id, tech, level, progress);
    addContrib(app, t.id, p.id, { donated: amount });
    addTeamXp(app, t.id, amount / 10);
    broadcastExtra(app, t.id);
    return { extra: teamExtra(app, t.id, p.id), wallet: app.walletChanged(p.id) };
  },
  'team.gift.claim': (app, s, { giftId }) => {
    const { t } = requireTeam(app, s.pid);
    claimGift(app, s.pid, giftId);
    return { extra: teamExtra(app, t.id, s.pid), wallet: app.walletChanged(s.pid) };
  },
  'team.goal.claim': (app, s, { goalId, tier: tierIdx }) => {
    const { t } = requireTeam(app, s.pid);
    const [week, metric] = goalId.split(':');
    const def = TEAM_GOALS.find((g) => g.metric === metric);
    if (!def || week !== app.week().key || !def.tiers[tierIdx]) return fail('YOK', 'Hedef bulunamadı.');
    if (goalProgress(app, week, t.id, def.metric) < def.tiers[tierIdx]!.need) fail('SART', 'Bu kademe henüz tamamlanmadı.');
    const g = app.db.get<{ id: string }>('SELECT g.id FROM team_gifts g JOIN gift_recipients r ON r.gift_id = g.id AND r.player_id = ? WHERE g.team_id = ? AND g.goal_ref = ?', s.pid, t.id, `${goalId}:${tierIdx}`);
    if (!g) return fail('YOK', 'Bu kademe tamamlandığında takımda değildin.');
    claimGift(app, s.pid, g.id);
    return { extra: teamExtra(app, t.id, s.pid), wallet: app.walletChanged(s.pid) };
  },
};
