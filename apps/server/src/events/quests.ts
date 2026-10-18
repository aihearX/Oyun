import type { EventReward, TeamQuest, TeamQuestKind, TeamQuestsState } from '@odi/shared';
import { parseJson, type App, type Grant, type Handlers } from '../app';
import { systemMessage, teamRoom } from '../chat';
import { createGift } from '../teamextra';
import { requireTeam } from '../teams';
import { dayKey } from '../time';
import { dayBounds, hash32, huntPeriods, memberCount, notify, rw } from './common';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Günlük takım görevleri: hedefler takım boyutuna göre günün ilk erişiminde sabitlenir; ödüller sabit ve görünür. */
export const QUEST_DEFS: Record<TeamQuestKind, { text: (n: number) => string; need: (members: number) => number }> = {
  bolum: { text: (n) => `Takım olarak ${n} bölüm bitirin`, need: (m) => clamp(3 * m, 6, 25) },
  yildiz: { text: (n) => `Takım olarak ${n} yıldız toplayın`, need: (m) => clamp(6 * m, 12, 60) },
  uye: { text: (n) => `${n} farklı üye bölüm oynasın`, need: (m) => clamp(m, 1, 10) },
  ralli: { text: (n) => (n === 1 ? 'Bir ralli kazanın' : `${n} ralli kazanın`), need: (m) => (m >= 15 ? 3 : m >= 6 ? 2 : 1) },
  quiz: { text: () => 'Bir Kulak Bilgi Yarışmasını bitirin', need: () => 1 },
  bayrak: { text: (n) => `Bayrak Yarışında ${n} ayak koşun`, need: () => 2 },
  avi: { text: (n) => `Ses Avında ${n} nota toplayın`, need: (m) => clamp(60 * m, 100, 1000) },
};
export const QUEST_REWARD: EventReward[] = rw(60, 5);
export const QUEST_BONUS: EventReward[] = rw(100, 15, [{ kind: 'kalkan', amount: 1, ref: 'gorev' }]);

interface Stored { kind: TeamQuestKind; need: number }

function ensure(app: App, teamId: string, day: string): Stored[] {
  const row = app.db.get<{ quests: string }>('SELECT quests FROM ev_tquest WHERE day = ? AND team_id = ?', day, teamId);
  if (row) return parseJson<Stored[]>(row.quests, []);
  const m = memberCount(app, teamId);
  const pool: TeamQuestKind[] = ['yildiz', 'uye', 'ralli', 'quiz', 'bayrak', ...(huntPeriods(app).cur ? ['avi' as const] : [])];
  const h = hash32(`gorev:${day}`);
  const a = h % pool.length;
  const b = (a + 1 + ((h >>> 8) % (pool.length - 1))) % pool.length;
  const kinds: TeamQuestKind[] = ['bolum', pool[a]!, pool[b]!];
  const quests = kinds.map((kind) => ({ kind, need: QUEST_DEFS[kind].need(m) }));
  app.db.run('INSERT INTO ev_tquest(day, team_id, quests) VALUES(?, ?, ?)', day, teamId, JSON.stringify(quests));
  return quests;
}

const prog = (app: App, day: string, teamId: string, kind: string) =>
  app.db.get<{ progress: number }>('SELECT progress FROM ev_tquest_prog WHERE day = ? AND team_id = ? AND kind = ?', day, teamId, kind)?.progress ?? 0;

export function questsState(app: App, teamId: string): TeamQuestsState {
  const day = dayKey(app.now());
  const quests: TeamQuest[] = ensure(app, teamId, day).map((q) => {
    const progress = prog(app, day, teamId, q.kind);
    return { kind: q.kind, text: QUEST_DEFS[q.kind].text(q.need), need: q.need, progress: Math.min(progress, q.need), done: progress >= q.need, reward: QUEST_REWARD };
  });
  return { day, endsAt: dayBounds(app.now()).endsAt, quests, bonus: QUEST_BONUS, allDone: quests.every((q) => q.done) };
}

export function broadcastQuests(app: App, teamId: string): void {
  if (!app.team(teamId)) return;
  const quests = questsState(app, teamId);
  app.emitEach(app.teamMemberIds(teamId), 'tquests.updated', () => ({ quests }));
}

/** görev ilerlemesi; 'uye' için pid ile farklı üye sayılır. Görev tamamlanınca o anki üyelere takım hediyesi. */
export function questProgress(app: App, teamId: string, kind: TeamQuestKind, n: number, pid?: string, quiet = false): void {
  if (n <= 0 && kind !== 'uye') return;
  const day = dayKey(app.now());
  const quests = ensure(app, teamId, day);
  const q = quests.find((x) => x.kind === kind);
  if (!q) return;
  if (kind === 'uye') {
    if (!pid || app.db.run('INSERT OR IGNORE INTO ev_tquest_member(day, team_id, player_id) VALUES(?, ?, ?)', day, teamId, pid) === 0) return;
    n = 1;
  }
  const before = prog(app, day, teamId, kind);
  const afterN = before + n;
  app.db.run(`INSERT INTO ev_tquest_prog(day, team_id, kind, progress) VALUES(?, ?, ?, ?)
    ON CONFLICT(day, team_id, kind) DO UPDATE SET progress = excluded.progress`, day, teamId, kind, afterN);
  if (before < q.need && afterN >= q.need) {
    const members = app.teamMemberIds(teamId);
    const text = QUEST_DEFS[kind].text(q.need);
    createGift(app, teamId, { id: 'sistem', name: 'Takım görevi' }, `Günlük görev: ${text}`, QUEST_REWARD as Grant[], members);
    const all = quests.every((x) => (x.kind === kind ? afterN : prog(app, day, teamId, x.kind)) >= x.need);
    if (all) createGift(app, teamId, { id: 'sistem', name: 'Takım görevi' }, 'Günlük görevlerin hepsi tamam: ortak sandık', QUEST_BONUS as Grant[], members);
    systemMessage(app, teamRoom(teamId), all ? `🎯 Günlük görevlerin hepsi tamam! Ortak sandık herkesin hediye kutusunda.` : `🎯 Günlük görev tamam: ${text}. Ödül hediye kutusunda!`);
    notify(app, members, { kind: 'gorev', icon: '🎯', title: all ? 'Ortak sandık açıldı!' : 'Takım görevi tamam!', text: all ? 'Bugünün 3 görevi de bitti. Hediyeni al!' : text, target: 'gorev' });
  }
  if (!quiet) broadcastQuests(app, teamId);
}

export const questHandlers: Handlers = {
  'tquests.state': (app, s) => { const { t } = requireTeam(app, s.pid); return { quests: questsState(app, t.id) }; },
};
