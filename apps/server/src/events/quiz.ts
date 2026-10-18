import { randomInt } from 'node:crypto';
import type { QuizInfo, QuizPhase, QuizPlayer, QuizQuestionView, QuizState } from '@odi/shared';
import { QUIZ_QUESTIONS } from '@odi/content';
import { fail, parseJson, rid, type App, type Handlers } from '../app';
import { systemMessage, teamRoom } from '../chat';
import { requireTeam } from '../teams';
import { dayKey } from '../time';
import { giveRewards, notify, quizSlot, rw } from './common';
import { questProgress } from './quests';

export const QUIZ_COUNT = 10;
export const QUESTION_MS = 15_000;
export const REVEAL_MS = 6_000;
const lobbyMs = (app: App) => (app.cfg.eventsFast ? 20_000 : 60_000);
/** takım başına günde en çok elle başlatılan quiz (sabit saatlerdekiler hariç) */
export const QUIZ_STARTS_PER_DAY = 5;
/** oyuncu başına günde ödül alınan quiz sayısı */
export const QUIZ_REWARDED_PER_DAY = 3;
export const QUIZ_REWARDS = { perCorrect: 10, bonusAvg: 700, bonus: rw(0, 10) };
const SHOW_DONE_MS = 10 * 60_000;

interface QuizRow { id: string; team_id: string; day: string; slot: string | null; started_by: string; created_at: number; lobby_ends: number; questions: string; finished_at: number | null; avg: number | null }
interface PRow { player_id: string; joined_at: number; score: number; correct: number; answers: string }
/** g: bu sorudan kazanılan puan (soru açıkken puan tablosunda gizlenir; böylece cevap erken sızmaz) */
type Answers = Record<string, { c: number; ms: number; g: number }>;

interface Timers { timers: Map<string, ReturnType<typeof setTimeout>>; last: Map<string, string> }
const stores = new WeakMap<App, Timers>();
const store = (app: App) => { let s = stores.get(app); if (!s) { s = { timers: new Map(), last: new Map() }; stores.set(app, s); } return s; };
export function quizShutdown(app: App): void { const s = stores.get(app); if (s) for (const t of s.timers.values()) clearTimeout(t); stores.delete(app); }

function phaseAt(q: QuizRow, t: number): { phase: QuizPhase; index: number; qStart: number } {
  if (t < q.lobby_ends) return { phase: 'lobi', index: -1, qStart: q.lobby_ends };
  const k = Math.floor((t - q.lobby_ends) / (QUESTION_MS + REVEAL_MS));
  if (k >= QUIZ_COUNT) return { phase: 'bitti', index: QUIZ_COUNT, qStart: 0 };
  const qStart = q.lobby_ends + k * (QUESTION_MS + REVEAL_MS);
  return { phase: t - qStart < QUESTION_MS ? 'soru' : 'cevap', index: k, qStart };
}
const endsAtOf = (q: QuizRow) => q.lobby_ends + QUIZ_COUNT * (QUESTION_MS + REVEAL_MS);
const rowById = (app: App, id: string) => app.db.get<QuizRow>('SELECT * FROM ev_quiz WHERE id = ?', id) ?? null;
const playersOf = (app: App, id: string) => app.db.all<PRow>('SELECT * FROM ev_quiz_player WHERE quiz_id = ? ORDER BY joined_at', id);

function view(app: App, q: QuizRow, viewer: string): QuizState {
  const { phase, index, qStart } = phaseAt(q, app.now());
  const qs = parseJson<number[]>(q.questions, []);
  const rows = playersOf(app, q.id);
  const def = index >= 0 && index < QUIZ_COUNT ? QUIZ_QUESTIONS[qs[index]!] : undefined;
  const players: QuizPlayer[] = rows.map((r) => {
    const p = app.playerOrNull(r.player_id);
    const a = parseJson<Answers>(r.answers, {})[String(index)];
    const hide = phase === 'soru' && a ? a.g : 0;
    return { id: r.player_id, name: p?.name ?? '?', color: p?.color ?? 0x7c5cff, score: r.score - hide, correct: r.correct - (hide > 0 ? 1 : 0), answered: !!a, lastCorrect: phase === 'cevap' && def ? (a ? a.c === def.answer : false) : null };
  }).sort((a, b) => b.score - a.score);
  let question: QuizQuestionView | null = null;
  if (def && (phase === 'soru' || phase === 'cevap')) {
    const mine = rows.find((r) => r.player_id === viewer);
    const myA = mine ? parseJson<Answers>(mine.answers, {})[String(index)] : undefined;
    question = { index, total: QUIZ_COUNT, text: def.text, choices: [...def.choices], startsAt: qStart, endsAt: qStart + QUESTION_MS,
      answer: phase === 'cevap' ? def.answer : null, explain: phase === 'cevap' ? def.explain : null, myChoice: myA ? myA.c : null, answered: players.filter((p) => p.answered).length };
  }
  const teamAvg = players.length ? Math.round(players.reduce((a, r) => a + r.score, 0) / players.length) : 0;
  return { id: q.id, teamId: q.team_id, phase, startedBy: q.started_by, lobbyEndsAt: q.lobby_ends, endsAt: endsAtOf(q), players, question, teamAvg, questionMs: QUESTION_MS, revealMs: REVEAL_MS };
}

function broadcast(app: App, q: QuizRow): void {
  app.emitEach(app.teamMemberIds(q.team_id), 'quiz.updated', (pid) => ({ quiz: view(app, q, pid) }));
}

function finalize(app: App, q: QuizRow): void {
  const rows = playersOf(app, q.id);
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : 0;
  app.db.run('UPDATE ev_quiz SET finished_at = ?, avg = ? WHERE id = ? AND finished_at IS NULL', app.now(), avg, q.id);
  if (!app.team(q.team_id)) return;
  for (const r of rows) {
    if (r.correct <= 0 || app.dailyCount(r.player_id, q.day, 'ev_quiz_odul') >= QUIZ_REWARDED_PER_DAY) continue;
    app.dailyInc(r.player_id, q.day, 'ev_quiz_odul');
    giveRewards(app, r.player_id, rw(QUIZ_REWARDS.perCorrect * r.correct), `Kulak Bilgi Yarışması: ${r.correct}/${QUIZ_COUNT} doğru`);
    if (avg >= QUIZ_REWARDS.bonusAvg) giveRewards(app, r.player_id, QUIZ_REWARDS.bonus, `Kulak Bilgi Yarışması: takım ortalaması ${avg}`);
  }
  if (rows.length) questProgress(app, q.team_id, 'quiz', 1);
  const best = [...rows].sort((a, b) => b.score - a.score)[0];
  systemMessage(app, teamRoom(q.team_id), `🧠 Bilgi yarışması bitti! Takım ortalaması: ${avg} puan${best ? ` · en iyi: ${app.playerOrNull(best.player_id)?.name ?? '?'} (${best.correct}/${QUIZ_COUNT})` : ''}.`, 'system', { event: 'quiz', quizId: q.id });
}

/** faz geçişlerini işle ve değişince yayınla (zamanlayıcı + sweep + istek anında) */
export function quizTick(app: App): void {
  const s = store(app);
  for (const q of app.db.all<QuizRow>('SELECT * FROM ev_quiz WHERE finished_at IS NULL')) {
    const ph = phaseAt(q, app.now());
    const key = `${ph.phase}:${ph.index}`;
    if (ph.phase === 'bitti') { finalize(app, q); s.last.delete(q.id); broadcast(app, rowById(app, q.id)!); continue; }
    if (s.last.get(q.id) !== key) { s.last.set(q.id, key); broadcast(app, q); }
  }
}

function schedule(app: App, id: string): void {
  const s = store(app);
  const q = rowById(app, id);
  if (!q || q.finished_at) return;
  const t = app.now();
  const ph = phaseAt(q, t);
  const nextAt = ph.phase === 'lobi' ? q.lobby_ends : ph.phase === 'soru' ? ph.qStart + QUESTION_MS : ph.qStart + QUESTION_MS + REVEAL_MS;
  const old = s.timers.get(id); if (old) clearTimeout(old);
  s.timers.set(id, setTimeout(() => {
    s.timers.delete(id);
    if (stores.get(app) !== s) return;
    try { app.run(() => quizTick(app)); schedule(app, id); } catch (e) { if (app.cfg.log) console.error('[quiz]', e); }
  }, Math.max(50, nextAt - t + 30)));
}

function activeRow(app: App, teamId: string): QuizRow | null {
  quizTick(app);
  const q = app.db.get<QuizRow>('SELECT * FROM ev_quiz WHERE team_id = ? ORDER BY created_at DESC LIMIT 1', teamId);
  if (!q || (q.finished_at && q.finished_at < app.now() - SHOW_DONE_MS)) return null;
  return q;
}

function create(app: App, teamId: string, by: string, slot: string | null): QuizRow {
  const now = app.now();
  const pool = QUIZ_QUESTIONS.map((_, i) => i);
  const pickd: number[] = [];
  while (pickd.length < QUIZ_COUNT) pickd.push(pool.splice(randomInt(0, pool.length), 1)[0]!);
  const id = rid('q');
  app.db.run('INSERT INTO ev_quiz(id, team_id, day, slot, started_by, created_at, lobby_ends, questions) VALUES(?, ?, ?, ?, ?, ?, ?, ?)', id, teamId, dayKey(now), slot, by, now, now + lobbyMs(app), JSON.stringify(pickd));
  const who = by === 'sistem' ? 'Sabit saat geldi' : `${app.playerOrNull(by)?.name ?? '?'} başlattı`;
  systemMessage(app, teamRoom(teamId), `🧠 Kulak Bilgi Yarışması başlıyor! ${who}. 10 soru, her biri 15 sn. Katıl!`, 'system', { event: 'quiz', quizId: id });
  notify(app, app.teamMemberIds(teamId).filter((x) => x !== by), { kind: 'quiz', icon: '🧠', title: 'Bilgi yarışması başlıyor!', text: `${who} · ${Math.round(lobbyMs(app) / 1000)} sn içinde katıl`, target: 'quiz', ref: id });
  if (by !== 'sistem') app.db.run('INSERT INTO ev_quiz_player(quiz_id, player_id, joined_at) VALUES(?, ?, ?)', id, by, now);
  app.after(() => schedule(app, id));
  return rowById(app, id)!;
}

function startsLeft(app: App, teamId: string): number {
  const n = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM ev_quiz WHERE team_id = ? AND day = ? AND slot IS NULL', teamId, dayKey(app.now()))!.n;
  return Math.max(0, QUIZ_STARTS_PER_DAY - n);
}

export function quizInfo(app: App, pid: string, teamId: string): QuizInfo {
  const slot = quizSlot(app);
  const role = app.player(pid).team_role;
  const left = startsLeft(app, teamId);
  const ranking = app.db.all<{ team_id: string; name: string; emblem: string; avg: number }>(
    'SELECT q.team_id, t.name, t.emblem, MAX(q.avg) AS avg FROM ev_quiz q JOIN teams t ON t.id = q.team_id WHERE q.day = ? AND q.finished_at IS NOT NULL GROUP BY q.team_id ORDER BY avg DESC LIMIT 10', dayKey(app.now()))
    .map((x) => ({ teamId: x.team_id, name: x.name, emblem: x.emblem, avg: Math.round(x.avg) }));
  return { nextSlotAt: slot.nextAt, slotOpen: slot.open, canStart: left > 0 && (slot.open || role === 'lider' || role === 'yardimci'), startsLeft: left, ranking, rewards: QUIZ_REWARDS };
}

/** takımın görünür quiz'i; sabit saat penceresindeyse ve bu saatte hiç açılmadıysa kendiliğinden açar (hızlı modda elle başlatılır) */
export function teamQuiz(app: App, pid: string, teamId: string): QuizState | null {
  let q = activeRow(app, teamId);
  const slot = quizSlot(app);
  if (!app.cfg.eventsFast && slot.open && slot.key && (!q || q.finished_at) && !app.db.get('SELECT 1 AS x FROM ev_quiz WHERE team_id = ? AND slot = ?', teamId, slot.key)) q = create(app, teamId, 'sistem', slot.key);
  return q ? view(app, q, pid) : null;
}

function myQuiz(app: App, quizId: string, teamId: string): QuizRow {
  quizTick(app);
  const q = rowById(app, quizId);
  if (!q || q.team_id !== teamId) return fail('YOK', 'Bilgi yarışması bulunamadı.');
  if (q.finished_at) fail('BITTI', 'Bu bilgi yarışması bitti.');
  return q;
}

export const quizHandlers: Handlers = {
  'quiz.state': (app, s) => { const { t } = requireTeam(app, s.pid); return { quiz: teamQuiz(app, s.pid, t.id), info: quizInfo(app, s.pid, t.id) }; },
  'quiz.start': (app, s) => {
    const { p, t } = requireTeam(app, s.pid);
    const cur = activeRow(app, t.id);
    if (cur && !cur.finished_at) return { quiz: view(app, cur, p.id) };
    const info = quizInfo(app, p.id, t.id);
    if (info.startsLeft <= 0) fail('LIMIT', `Takım günde en çok ${QUIZ_STARTS_PER_DAY} bilgi yarışması başlatabilir.`);
    if (!info.canStart) fail('YETKI', 'Bilgi yarışmasını lider ya da yardımcı başlatabilir; ayrıca her gün 13:00 ve 20:00\'de kendiliğinden açılır.');
    const q = create(app, t.id, p.id, null);
    broadcast(app, q);
    return { quiz: view(app, q, p.id) };
  },
  'quiz.join': (app, s, { quizId }) => {
    const { p, t } = requireTeam(app, s.pid);
    const q = myQuiz(app, quizId, t.id);
    if (app.db.run('INSERT OR IGNORE INTO ev_quiz_player(quiz_id, player_id, joined_at) VALUES(?, ?, ?)', q.id, p.id, app.now())) broadcast(app, q);
    return { quiz: view(app, q, p.id) };
  },
  'quiz.go': (app, s, { quizId }) => {
    const { p, t } = requireTeam(app, s.pid);
    const q = myQuiz(app, quizId, t.id);
    if (phaseAt(q, app.now()).phase !== 'lobi') return { quiz: view(app, q, p.id) };
    if (q.started_by !== p.id && q.started_by !== 'sistem' && p.team_role === 'uye') fail('YETKI', 'Yarışmayı başlatan ya da lider/yardımcı hemen başlatabilir.');
    if (!playersOf(app, q.id).length) fail('SART', 'Önce en az bir kişi katılmalı.');
    app.db.run('UPDATE ev_quiz SET lobby_ends = ? WHERE id = ?', app.now(), q.id);
    const nq = rowById(app, q.id)!;
    store(app).last.delete(q.id);
    quizTick(app);
    app.after(() => schedule(app, q.id));
    return { quiz: view(app, nq, p.id) };
  },
  'quiz.answer': (app, s, { quizId, index, choice }) => {
    const { p, t } = requireTeam(app, s.pid);
    const q = myQuiz(app, quizId, t.id);
    const now = app.now();
    const ph = phaseAt(q, now);
    if (ph.phase !== 'soru' || ph.index !== index) fail('SURE', 'Bu sorunun süresi doldu.');
    const r = app.db.get<PRow>('SELECT * FROM ev_quiz_player WHERE quiz_id = ? AND player_id = ?', q.id, p.id);
    if (!r) return fail('YETKI', 'Önce yarışmaya katılmalısın.');
    const answers = parseJson<Answers>(r.answers, {});
    if (answers[String(index)]) fail('TEKRAR', 'Bu soruyu zaten cevapladın.');
    const def = QUIZ_QUESTIONS[parseJson<number[]>(q.questions, [])[index]!]!;
    const ms = now - ph.qStart;
    const correct = choice === def.answer;
    const gain = correct ? 100 + Math.round((50 * Math.max(0, QUESTION_MS - ms)) / QUESTION_MS) : 0;
    answers[String(index)] = { c: choice, ms, g: gain };
    app.db.run('UPDATE ev_quiz_player SET answers = ?, score = score + ?, correct = correct + ? WHERE quiz_id = ? AND player_id = ?', JSON.stringify(answers), gain, correct ? 1 : 0, q.id, p.id);
    broadcast(app, q);
    return { quiz: view(app, q, p.id) };
  },
};
