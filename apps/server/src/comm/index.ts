/**
 * İletişim katmanı (docs/13-iletisim.md): Takım Akışı, Hızlı Sohbet, Yardım İste, meydan okuma, Günün Sorusu, İkili Görev,
 * Usta–Çırak, bahsetme. Sohbetin kendisi (tepki, konu, hazır söz, bahsetme, serbest yazı kuralı) chat.ts'tedir.
 */
import type { OpMap, ProgressSubmit } from '@odi/shared';
import type { App, Handler, Handlers } from '../app';
import { teamOfRoom } from '../chat';
import { dqAnswer, dqState, dqTick, ensureQuestion, setStudy } from './dq';
import { duoAddNotes, duoInvite, duoRespond, duoState } from './duo';
import { checkChallenges, feedFromRun, postChallenge, trackPlayDay } from './feed';
import { helpHandlers, recordHelp, resolveHelp } from './help';
import { mentorEnd, mentorOffer, mentorProgress, mentorRespond, mentorState } from './mentor';
import { commSettings, setCommSettings } from './settings';

export { COMM_SCHEMA } from './schema';
export { COMM_SCHEMAS } from './schemas';
export { metricsReport } from './settings';
export { feedEvent, feedBuilding } from './feed';
export { onHelpCard } from './help';

export const commHandlers: Handlers = {
  'comm.state': (app, s) => ({ settings: commSettings(app, s.pid) }),
  'comm.settings': (app, s, d) => ({ settings: setCommSettings(app, s.pid, d) }),
  'feed.challenge': (app, s, { level }) => ({ msg: postChallenge(app, s.pid, level) }),
  ...helpHandlers,
  'dq.state': (app, s) => dqState(app, s.pid),
  'dq.answer': (app, s, { choice }) => dqAnswer(app, s.pid, choice),
  'team.study': (app, s, { on }) => ({ study: setStudy(app, s.pid, on) }),
  'duo.state': (app, s) => ({ duo: duoState(app, s.pid) }),
  'duo.invite': (app, s, { friendId }) => ({ duo: duoInvite(app, s.pid, friendId) }),
  'duo.respond': (app, s, { inviteId, accept }) => ({ duo: duoRespond(app, s.pid, inviteId, accept) }),
  'mentor.state': (app, s) => ({ mentor: mentorState(app, s.pid) }),
  'mentor.offer': (app, s, { id, as }) => ({ mentor: mentorOffer(app, s.pid, id, as) }),
  'mentor.respond': (app, s, { offerId, accept }) => ({ mentor: mentorRespond(app, s.pid, offerId, accept) }),
  'mentor.end': (app, s, { linkId }) => ({ mentor: mentorEnd(app, s.pid, linkId) }),
};

/** bölüm sonucu (aynı işlem içinde, aynı runId ikinci kez sayılmaz) */
function onRun(app: App, pid: string, d: ProgressSubmit, prev: { stars: number } | undefined, prevHighest: number): void {
  trackPlayDay(app, pid);
  feedFromRun(app, pid, d, prev);
  if (d.completed) { resolveHelp(app, pid, d.level); checkChallenges(app, pid, d.level, Math.round(d.score)); }
  duoAddNotes(app, pid, Math.min(400, Math.max(0, Math.round(d.coins))));
  mentorProgress(app, pid, prevHighest);
}

/** progress.submit ve team.help.give işleyicilerini iletişim kancalarıyla sarar */
export function withCommHooks(h: Handlers): Handlers {
  const submit = h['progress.submit'] as Handler<'progress.submit'>;
  const give = h['team.help.give'] as Handler<'team.help.give'>;
  const wrappedSubmit: Handler<'progress.submit'> = (app, s, d) => {
    const dup = !!app.db.get('SELECT 1 AS x FROM progress_runs WHERE player_id = ? AND run_id = ?', s.pid, d.runId);
    const prev = dup ? undefined : app.db.get<{ stars: number }>('SELECT stars FROM level_best WHERE player_id = ? AND level = ?', s.pid, d.level);
    const prevHighest = app.player(s.pid).highest;
    const ack = submit(app, s, d) as OpMap['progress.submit']['res'];
    if (!dup) onRun(app, s.pid, d, prev, prevHighest);
    return ack;
  };
  const wrappedGive: Handler<'team.help.give'> = (app, s, d) => {
    const res = give(app, s, d) as OpMap['team.help.give']['res'];
    recordHelp(app, d.requestId, s.pid, 'kalkan');
    return res;
  };
  return { ...h, 'progress.submit': wrappedSubmit, 'team.help.give': wrappedGive };
}

/** sunucu kurulumunda: takım sohbetine girilince bugünün sorusu (yoksa) açılır */
export function installComm(app: App): void {
  app.chatJoinHooks.push((_pid, room) => { const t = teamOfRoom(room); if (t) ensureQuestion(app, t); });
}
export function commSweep(app: App): void { dqTick(app); }
/** takım silinince iletişim kayıtlarını temizle (sohbet zaten silinir) */
export function commTeamDeleted(app: App, teamId: string): void {
  for (const t of ['dq', 'dq_answers', 'team_comm', 'challenges', 'feed_recent']) app.db.run(`DELETE FROM ${t} WHERE team_id = ?`, teamId);
}
