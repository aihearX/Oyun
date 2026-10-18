import { randomInt } from 'node:crypto';
import { RALLY_MONSTERS, RALLY_RULES, rallyDamageFor, rallyMaxHp, type RallyHit, type RallyParticipant, type RallyState } from '@odi/shared';
import { fail, rid, type App, type Handlers } from '../app';
import { systemMessage, teamRoom } from '../chat';
import { addTeamXp, broadcastExtra } from '../teamextra';
import { requireTeam } from '../teams';
import { dayKey } from '../time';
import { checkRun, giveRewards, memberCount, notify } from './common';
import { addDuelPoints } from './duel';
import { questProgress } from './quests';

interface RallyRow { id: string; team_id: string; monster: string; salt: number; starter: string; starter_name: string; status: string; hp: number; max_hp: number; starts_at: number; ends_at: number; won_at: number | null; day: string }
/** biten ralli bu süre boyunca ekranda (sonuç) kalır */
const SHOW_DONE_MS = 30 * 60_000;
const monsterDef = (id: string) => RALLY_MONSTERS.find((m) => m.id === id)!;
const rowById = (app: App, id: string) => app.db.get<RallyRow>('SELECT * FROM ev_rally WHERE id = ?', id) ?? null;

function view(app: App, r: RallyRow): RallyState {
  const participants: RallyParticipant[] = app.db.all<{ id: string; name: string; color: number; hat: string; damage: number; tries: number; joined_at: number }>(
    'SELECT p.id, p.name, p.color, p.hat, x.damage, x.tries, x.joined_at FROM ev_rally_part x JOIN players p ON p.id = x.player_id WHERE x.rally_id = ? ORDER BY x.joined_at, x.rowid', r.id)
    .map((x) => ({ id: x.id, name: x.name, color: x.color, hat: x.hat, damage: x.damage, tries: x.tries, joinedAt: x.joined_at }));
  const hits: RallyHit[] = app.db.all<{ id: string; name: string; damage: number; stars: number; completed: number; at: number }>(
    'SELECT p.id, p.name, h.damage, h.stars, h.completed, h.at FROM ev_rally_hit h JOIN players p ON p.id = h.player_id WHERE h.rally_id = ? ORDER BY h.at DESC, h.rowid DESC LIMIT 20', r.id)
    .map((h) => ({ id: h.id, name: h.name, damage: h.damage, stars: h.stars, completed: !!h.completed, at: h.at }));
  return { id: r.id, teamId: r.team_id, monster: r.monster as RallyState['monster'], salt: r.salt, starterId: r.starter, starterName: r.starter_name, status: r.status as RallyState['status'],
    hp: r.hp, maxHp: r.max_hp, startsAt: r.starts_at, endsAt: r.ends_at, wonAt: r.won_at, participants, hits };
}

function broadcast(app: App, r: RallyRow): void {
  const rally = view(app, r);
  app.emitEach(app.teamMemberIds(r.team_id), 'rally.updated', () => ({ rally }));
}

/** süresi dolan açık ralliler kaybedilir (tembel + zamanlayıcı) */
export function rallyTick(app: App): void {
  const due = app.db.all<RallyRow>("SELECT * FROM ev_rally WHERE status = 'acik' AND ends_at <= ?", app.now());
  for (const r of due) {
    app.db.run("UPDATE ev_rally SET status = 'kaybedildi' WHERE id = ?", r.id);
    if (!app.team(r.team_id)) continue;
    const m = monsterDef(r.monster);
    const parts = app.db.all<{ player_id: string }>('SELECT player_id FROM ev_rally_part WHERE rally_id = ?', r.id).length;
    systemMessage(app, teamRoom(r.team_id), `${m.emoji} ${m.name} kaçtı! Süre doldu (kalan can ${r.hp}/${r.max_hp}${parts < RALLY_RULES.minPlayers ? `, en az ${RALLY_RULES.minPlayers} katılımcı gerekiyordu` : ''}). Bir dahaki rallide!`, 'system', { event: 'ralli', rallyId: r.id });
    notify(app, app.teamMemberIds(r.team_id), { kind: 'ralli', icon: m.emoji, title: `${m.name} kaçtı`, text: 'Ralli süresi doldu. Yeni bir ralli başlatabilirsiniz.', target: 'ralli', ref: r.id });
    broadcast(app, rowById(app, r.id)!);
  }
}

/** takımın açık rallisi ya da yakın zamanda biten son rallisi */
export function teamRally(app: App, teamId: string): RallyState | null {
  rallyTick(app);
  const r = app.db.get<RallyRow>('SELECT * FROM ev_rally WHERE team_id = ? ORDER BY starts_at DESC LIMIT 1', teamId);
  if (!r) return null;
  if (r.status !== 'acik' && Math.max(r.ends_at, r.won_at ?? 0) < app.now() - SHOW_DONE_MS) return null;
  return view(app, r);
}

export function rallyStartsLeft(app: App, teamId: string): number {
  const n = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM ev_rally WHERE team_id = ? AND day = ?', teamId, dayKey(app.now()))!.n;
  return Math.max(0, RALLY_RULES.startsPerTeamDay - n);
}

function openRally(app: App, rallyId: string, teamId: string): RallyRow {
  rallyTick(app);
  const r = rowById(app, rallyId);
  if (!r || r.team_id !== teamId) return fail('YOK', 'Ralli bulunamadı.');
  if (r.status === 'kazanildi') fail('BITTI', 'Bu ralli zaten kazanıldı!');
  if (r.status !== 'acik') fail('SURE', 'Bu rallinin süresi doldu.');
  return r;
}

function win(app: App, r: RallyRow): void {
  const now = app.now();
  app.db.run("UPDATE ev_rally SET status = 'kazanildi', won_at = ?, hp = 0 WHERE id = ?", now, r.id);
  const m = monsterDef(r.monster);
  const day = dayKey(now);
  const parts = app.db.all<{ player_id: string }>('SELECT player_id FROM ev_rally_part WHERE rally_id = ?', r.id).map((x) => x.player_id);
  const capped: string[] = [];
  for (const pid of parts) {
    const p = app.playerOrNull(pid);
    if (!p || p.team_id !== r.team_id) continue;
    if (app.dailyCount(pid, day, 'ev_ralli_odul') >= RALLY_RULES.rewardsPerPlayerDay) { capped.push(p.name); continue; }
    app.dailyInc(pid, day, 'ev_ralli_odul');
    giveRewards(app, pid, m.reward, `Ralli kazanıldı: ${m.name}`);
    addDuelPoints(app, r.team_id, pid, RALLY_RULES.duelPoints);
  }
  addTeamXp(app, r.team_id, m.teamXp);
  questProgress(app, r.team_id, 'ralli', 1);
  const secs = Math.round((now - r.starts_at) / 1000);
  systemMessage(app, teamRoom(r.team_id), `🏆 ${m.emoji} ${m.name} yenildi! ${parts.length} kahraman ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} sürede bitirdi. Ödüller ödül kutusunda, takıma +${m.teamXp} XP.${capped.length ? ` (${capped.join(', ')}: bugünkü ${RALLY_RULES.rewardsPerPlayerDay} ralli ödülü doldu)` : ''}`, 'system', { event: 'ralli', rallyId: r.id });
  notify(app, app.teamMemberIds(r.team_id), { kind: 'ralli', icon: '🏆', title: `${m.name} yenildi!`, text: 'Ralli kazanıldı. Ödüller ödül kutusunda!', target: 'ralli', ref: r.id });
  broadcastExtra(app, r.team_id);
}

export const rallyHandlers: Handlers = {
  'rally.state': (app, s) => { const { t } = requireTeam(app, s.pid); return { rally: teamRally(app, t.id), startsLeft: rallyStartsLeft(app, t.id) }; },
  'rally.start': (app, s, { monster }) => {
    const { p, t } = requireTeam(app, s.pid);
    rallyTick(app);
    const def = RALLY_MONSTERS.find((m) => m.id === monster);
    if (!def) return fail('GECERSIZ', 'Bilinmeyen canavar.');
    if (app.db.get("SELECT 1 AS x FROM ev_rally WHERE team_id = ? AND status = 'acik'", t.id)) fail('MESGUL', 'Takımında zaten açık bir ralli var; ona katıl!');
    if (rallyStartsLeft(app, t.id) <= 0) fail('LIMIT', `Takım günde en çok ${RALLY_RULES.startsPerTeamDay} ralli başlatabilir. Yarın yeniden!`);
    const now = app.now();
    const hp = rallyMaxHp(def, memberCount(app, t.id));
    const id = rid('y');
    app.db.run('INSERT INTO ev_rally(id, team_id, monster, salt, starter, starter_name, status, hp, max_hp, starts_at, ends_at, day) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, t.id, def.id, randomInt(1, 1000), p.id, p.name, 'acik', hp, hp, now, now + RALLY_RULES.durationMs, dayKey(now));
    app.db.run('INSERT INTO ev_rally_part(rally_id, player_id, joined_at) VALUES(?, ?, ?)', id, p.id, now);
    const mins = Math.round(RALLY_RULES.durationMs / 60_000);
    systemMessage(app, teamRoom(t.id), `🔥 ${p.name} ralli başlattı! ${def.emoji} ${def.name} · ${mins}:00 içinde katıl, birlikte yenelim!`, 'system', { event: 'ralli', rallyId: id });
    notify(app, app.teamMemberIds(t.id).filter((x) => x !== p.id), { kind: 'ralli', icon: '🔥', title: `${p.name} ralli başlattı!`, text: `${def.emoji} ${def.name} · ${mins}:00 — katıl!`, target: 'ralli', ref: id });
    const r = rowById(app, id)!;
    broadcast(app, r);
    return { rally: view(app, r) };
  },
  'rally.join': (app, s, { rallyId }) => {
    const { p, t } = requireTeam(app, s.pid);
    const r = openRally(app, rallyId, t.id);
    const n = app.db.run('INSERT OR IGNORE INTO ev_rally_part(rally_id, player_id, joined_at) VALUES(?, ?, ?)', r.id, p.id, app.now());
    if (n) {
      const count = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM ev_rally_part WHERE rally_id = ?', r.id)!.n;
      if (count === RALLY_RULES.minPlayers) notify(app, app.teamMemberIds(t.id), { kind: 'ralli', icon: '⚔️', title: 'Ralli hazır!', text: `${p.name} katıldı — saldırı başlayabilir!`, target: 'ralli', ref: r.id });
      broadcast(app, r);
    }
    return { rally: view(app, r) };
  },
  'rally.hit': (app, s, d) => {
    const { p, t } = requireTeam(app, s.pid);
    checkRun(d);
    const prev = app.db.get<{ damage: number; rally_id: string }>('SELECT damage, rally_id FROM ev_rally_hit WHERE player_id = ? AND run_id = ?', p.id, d.runId);
    if (prev) { const r = rowById(app, prev.rally_id)!; return { rally: view(app, r), damage: prev.damage }; }
    const r = openRally(app, d.rallyId, t.id);
    const part = app.db.get<{ tries: number }>('SELECT tries FROM ev_rally_part WHERE rally_id = ? AND player_id = ?', r.id, p.id);
    if (!part) return fail('YETKI', 'Önce ralliye katılmalısın.');
    const count = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM ev_rally_part WHERE rally_id = ?', r.id)!.n;
    if (count < RALLY_RULES.minPlayers) fail('SART', `Saldırı için en az ${RALLY_RULES.minPlayers} katılımcı gerekli; takım arkadaşlarını bekle.`);
    if (part.tries >= RALLY_RULES.triesPerPlayer) fail('LIMIT', `Bu ralli için ${RALLY_RULES.triesPerPlayer} deneme hakkını kullandın.`);
    const damage = Math.min(rallyDamageFor(d), r.hp);
    const now = app.now();
    app.db.run('INSERT INTO ev_rally_hit(player_id, run_id, rally_id, damage, stars, completed, at) VALUES(?, ?, ?, ?, ?, ?, ?)', p.id, d.runId, r.id, damage, d.completed ? d.stars : 0, d.completed ? 1 : 0, now);
    app.db.run('UPDATE ev_rally_part SET damage = damage + ?, tries = tries + 1 WHERE rally_id = ? AND player_id = ?', damage, r.id, p.id);
    app.db.run('UPDATE ev_rally SET hp = hp - ? WHERE id = ?', damage, r.id);
    const after = rowById(app, r.id)!;
    if (after.hp <= 0) win(app, after);
    const fin = rowById(app, r.id)!;
    broadcast(app, fin);
    return { rally: view(app, fin), damage };
  },
};
