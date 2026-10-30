import { COMM_RULES, type DailyQuestion, type DqBoardRow, type DqState } from '@odi/shared';
import { QUIZ_QUESTIONS } from '@odi/content';
import { fail, type App } from '../app';
import { postCard, systemMessage, teamRoom, updateCard } from '../chat';
import { hash32, dayBounds } from '../events/common';
import { requireTeam } from '../teams';
import { dayKey, DAY_MS, HOUR_MS } from '../time';
import { metric } from './settings';

/**
 * Günün Sorusu: her İstanbul günü takım sohbetine Tüy Dede bir soru bırakır (ilk erişimde ya da zamanlayıcıda).
 * Seçim gün + takım anahtarından sabit (herkese aynı, tekrar etmeden döner). Çalışma Grubu modunda öğrenci düzeyi.
 * Açıklama 20:00 (gece 20:00'den sonra açılan soru 23:59'da); hızlı test modunda açıldıktan 45 sn sonra.
 * Doğru bilene 10 jeton (günde bir). Açıklanmadan önce yalnızca KAÇ kişinin cevapladığı görünür.
 */
export const DQ_NAME = 'Tüy Dede';
interface DqRow { team_id: string; day: string; week: string; qidx: number; msg_id: string; level: 'merakli' | 'odyoloji'; created_at: number; reveal_at: number; revealed: number }
const POOL = { merakli: [] as number[], odyoloji: [] as number[] };
QUIZ_QUESTIONS.forEach((q, i) => POOL[q.level].push(i));

export const isStudy = (app: App, teamId: string) => !!app.db.get<{ study: number }>('SELECT study FROM team_comm WHERE team_id = ?', teamId)?.study;
const dayNum = (day: string) => { const [y, m, d] = day.split('-').map(Number); return Math.floor(Date.UTC(y!, m! - 1, d!) / DAY_MS); };
function revealTime(app: App, now: number): number {
  if (app.cfg.eventsFast) return now + 45_000;
  const b = dayBounds(now); const at = b.startsAt + COMM_RULES.dqRevealHour * HOUR_MS;
  return now < at ? at : b.endsAt - 60_000;
}
const rowOf = (app: App, teamId: string, day: string) => app.db.get<DqRow>('SELECT * FROM dq WHERE team_id = ? AND day = ?', teamId, day) ?? null;

/** bugünün sorusu yoksa aç (takım sohbetine kart) */
export function ensureQuestion(app: App, teamId: string): DqRow | null {
  if (!app.team(teamId)) return null;
  const now = app.now(); const day = dayKey(now);
  const cur = rowOf(app, teamId, day); if (cur) return cur;
  const level = isStudy(app, teamId) ? 'odyoloji' : 'merakli';
  const pool = POOL[level];
  const qidx = pool[(dayNum(day) + hash32(teamId)) % pool.length]!;
  const q = QUIZ_QUESTIONS[qidx]!;
  const revealAt = revealTime(app, now);
  const meta: Record<string, string | number | boolean> = { day, lvl: level, n: 0, rev: 0, revealAt };
  q.choices.forEach((c, i) => { meta[`c${i}`] = c; });
  const msg = postCard(app, teamRoom(teamId), { kind: 'soru', name: DQ_NAME, text: q.text, meta });
  app.db.run('INSERT INTO dq(team_id, day, week, qidx, msg_id, level, created_at, reveal_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)', teamId, day, app.week().key, qidx, msg.id, level, now, revealAt);
  return rowOf(app, teamId, day);
}

function reveal(app: App, r: DqRow): void {
  if (!app.db.run('UPDATE dq SET revealed = 1 WHERE team_id = ? AND day = ? AND revealed = 0', r.team_id, r.day)) return;
  const q = QUIZ_QUESTIONS[r.qidx]!;
  const ok = app.db.all<{ player_id: string }>('SELECT player_id FROM dq_answers WHERE team_id = ? AND day = ? AND correct = 1 ORDER BY at', r.team_id, r.day);
  const names: string[] = [];
  for (const a of ok) {
    const p = app.playerOrNull(a.player_id); if (!p) continue;
    names.push(p.name);
    if (p.team_id === r.team_id && app.db.run('INSERT OR IGNORE INTO dq_rewards(player_id, day) VALUES(?, ?)', p.id, r.day)) {
      app.addInbox(p.id, { kind: 'jeton', amount: COMM_RULES.dqCorrectJeton, ref: 'gunun-sorusu' }, 'Günün Sorusu: doğru cevap');
      metric(app, 'dq.correct');
    }
  }
  updateCard(app, r.msg_id, null, { rev: 1, ans: q.answer, exp: q.explain, ok: names.slice(0, 12).join(', '), okn: names.length, ...(q.oneren ? { on: q.oneren } : {}) });
}

/** zamanlayıcı: vakti gelen soruları açıkla; çevrimiçi üyesi olan takımlara bugünün sorusunu aç (dakikada bir) */
const lastEnsure = new WeakMap<App, number>();
export function dqTick(app: App): void {
  for (const r of app.db.all<DqRow>('SELECT * FROM dq WHERE revealed = 0 AND reveal_at <= ? LIMIT 200', app.now())) reveal(app, r);
  const t = Date.now();
  if (t - (lastEnsure.get(app) ?? 0) < 60_000) return;
  lastEnsure.set(app, t);
  const teams = new Set<string>();
  for (const pid of app.online.keys()) { const tid = app.playerOrNull(pid)?.team_id; if (tid) teams.add(tid); }
  for (const tid of teams) ensureQuestion(app, tid);
}

function view(app: App, r: DqRow, pid: string): DailyQuestion {
  if (!r.revealed && r.reveal_at <= app.now()) { reveal(app, r); r = rowOf(app, r.team_id, r.day)!; }
  const q = QUIZ_QUESTIONS[r.qidx]!;
  const answered = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM dq_answers WHERE team_id = ? AND day = ?', r.team_id, r.day)!.n;
  const mine = app.db.get<{ choice: number }>('SELECT choice FROM dq_answers WHERE team_id = ? AND day = ? AND player_id = ?', r.team_id, r.day, pid)?.choice ?? null;
  const rev = !!r.revealed;
  const correct = rev ? app.db.all<{ id: string; name: string }>('SELECT p.id, p.name FROM dq_answers a JOIN players p ON p.id = a.player_id WHERE a.team_id = ? AND a.day = ? AND a.correct = 1 ORDER BY a.at', r.team_id, r.day) : null;
  return { day: r.day, msgId: r.msg_id, text: q.text, choices: [...q.choices], level: r.level, revealAt: r.reveal_at, revealed: rev, answer: rev ? q.answer : null, explain: rev ? q.explain : null, answered, myChoice: mine, correct, ...(rev && q.oneren ? { oneren: q.oneren } : {}) };
}

export function dqState(app: App, pid: string): DqState {
  const { t } = requireTeam(app, pid);
  const r = ensureQuestion(app, t.id);
  const week = app.db.all<{ player_id: string; correct: number; answered: number }>(
    'SELECT a.player_id, SUM(a.correct) AS correct, COUNT(*) AS answered FROM dq_answers a JOIN dq d ON d.team_id = a.team_id AND d.day = a.day AND d.revealed = 1 WHERE a.team_id = ? AND d.week = ? GROUP BY a.player_id ORDER BY correct DESC, answered DESC LIMIT 30', t.id, app.week().key);
  const board: DqBoardRow[] = [];
  for (const w of week) { const p = app.playerOrNull(w.player_id); if (p && p.team_id === t.id) board.push({ id: p.id, name: p.name, color: p.color, correct: w.correct, answered: w.answered }); }
  return { question: r ? view(app, r, pid) : null, week: board, study: isStudy(app, t.id), reward: COMM_RULES.dqCorrectJeton };
}

export function dqAnswer(app: App, pid: string, choice: number): DqState {
  const { t } = requireTeam(app, pid);
  const r = ensureQuestion(app, t.id);
  if (!r) return fail('YOK', 'Bugün soru yok.');
  if (r.revealed || r.reveal_at <= app.now()) fail('SURE', 'Bugünün sorusunun cevabı açıklandı; yarın yeni soru gelir.');
  const q = QUIZ_QUESTIONS[r.qidx]!;
  if (choice < 0 || choice >= q.choices.length) fail('GECERSIZ', 'Geçersiz şık.');
  if (!app.db.run('INSERT OR IGNORE INTO dq_answers(team_id, day, player_id, choice, correct, at) VALUES(?, ?, ?, ?, ?, ?)', t.id, r.day, pid, choice, choice === q.answer ? 1 : 0, app.now())) fail('TEKRAR', 'Bugünün sorusunu zaten cevapladın.');
  const n = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM dq_answers WHERE team_id = ? AND day = ?', t.id, r.day)!.n;
  updateCard(app, r.msg_id, null, { n });
  metric(app, 'dq.answer');
  return dqState(app, pid);
}

export function setStudy(app: App, pid: string, on: boolean): boolean {
  const { p, t } = requireTeam(app, pid);
  if (p.team_role === 'uye') fail('YETKI', 'Çalışma Grubu modunu lider ya da yardımcı açar.');
  const cur = isStudy(app, t.id);
  if (cur === on) return on;
  app.db.run('INSERT INTO team_comm(team_id, study) VALUES(?, ?) ON CONFLICT(team_id) DO UPDATE SET study = excluded.study', t.id, on ? 1 : 0);
  systemMessage(app, teamRoom(t.id), on ? `${p.name} takımı Çalışma Grubu yaptı: Günün Sorusu bir sonraki sorudan itibaren odyoloji öğrencisi düzeyinden.` : `${p.name} Çalışma Grubu modunu kapattı: Günün Sorusu bir sonraki sorudan itibaren genel düzeyden.`, 'system', { event: 'calisma' });
  return on;
}
