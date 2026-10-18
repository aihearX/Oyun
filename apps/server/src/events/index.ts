/**
 * Etkinlikler: Ralli, Takım Düellosu, Bayrak Yarışı, Ses Avı, Kulak Bilgi Yarışması, günlük takım görevleri (grup);
 * Günün Meydan Okuması ve Haftalık Turnuva (bireysel). Hepsi sunucu yetkili; dönemler tembel + zamanlayıcıyla kapanır.
 */
import type { EventsOverview, OpMap, ProgressSubmit } from '@odi/shared';
import { DUEL_RULES } from '@odi/shared';
import type { App, Handler, Handlers } from '../app';
import { challengeHandlers, challengeState, challengeTick } from './challenge';
import { addDuelPoints, duelHandlers, duelState, duelTick } from './duel';
import { addHuntNotes, huntHandlers, huntState } from './hunt';
import { broadcastQuests, questHandlers, questProgress, questsState } from './quests';
import { quizHandlers, quizInfo, quizShutdown, quizTick, teamQuiz } from './quiz';
import { rallyHandlers, rallyStartsLeft, rallyTick, teamRally } from './rally';
import { relayHandlers, relayState, relayTick } from './relay';
import { tourneyHandlers, tourneyState, tourneyTick } from './tourney';

export { EVENT_SCHEMAS } from './schemas';
export { EVENTS_SCHEMA } from './schema';

export function eventsOverview(app: App, pid: string): EventsOverview {
  const teamId = app.player(pid).team_id;
  const base = { serverTime: app.now(), fast: app.cfg.eventsFast, challenge: challengeState(app, pid), tourney: tourneyState(app, pid) };
  if (!teamId) return { ...base, inTeam: false, rally: null, rallyStartsLeft: 0, duel: null, relay: null, hunt: null, quiz: null, quizInfo: null, quests: null };
  return {
    ...base, inTeam: true, rally: teamRally(app, teamId), rallyStartsLeft: rallyStartsLeft(app, teamId), duel: duelState(app, pid), relay: relayState(app, teamId),
    hunt: huntState(app, teamId), quiz: teamQuiz(app, pid, teamId), quizInfo: quizInfo(app, pid, teamId), quests: questsState(app, teamId),
  };
}

export const eventHandlers: Handlers = {
  'events.overview': (app, s) => ({ overview: eventsOverview(app, s.pid) }),
  ...rallyHandlers, ...duelHandlers, ...relayHandlers, ...huntHandlers, ...quizHandlers, ...questHandlers, ...challengeHandlers, ...tourneyHandlers,
};

/** normal bölüm sonucu etkinliklere de sayılır: düello (yıldız), günlük görevler, Ses Avı (jeton = nota) */
function onProgress(app: App, pid: string, d: ProgressSubmit): void {
  const teamId = app.player(pid).team_id;
  if (!teamId) return;
  const stars = d.completed ? d.stars : 0;
  questProgress(app, teamId, 'uye', 0, pid, true);
  if (d.completed) questProgress(app, teamId, 'bolum', 1, pid, true);
  if (stars) questProgress(app, teamId, 'yildiz', stars, pid, true);
  addHuntNotes(app, teamId, pid, Math.min(400, Math.max(0, Math.round(d.coins))));
  addDuelPoints(app, teamId, pid, stars * DUEL_RULES.starPoints);
  broadcastQuests(app, teamId);
}

/** progress.submit işleyicisini etkinlik kancasıyla sarar (aynı işlem içinde; aynı runId ikinci kez sayılmaz) */
export function withEventHooks(h: Handlers): Handlers {
  const orig = h['progress.submit'] as Handler<'progress.submit'>;
  const wrapped: Handler<'progress.submit'> = (app, s, d) => {
    const dup = !!app.db.get('SELECT 1 AS x FROM progress_runs WHERE player_id = ? AND run_id = ?', s.pid, d.runId);
    const ack = orig(app, s, d) as OpMap['progress.submit']['res'];
    if (!dup) onProgress(app, s.pid, d);
    return ack;
  };
  return { ...h, 'progress.submit': wrapped };
}

/** zamanlayıcı (sunucu sweep'i): süresi dolan ralli, düello son hamle/kapanış, haftalık/günlük kapanışlar, quiz fazları */
export function eventsSweep(app: App): void {
  rallyTick(app); duelTick(app); relayTick(app); quizTick(app); challengeTick(app); tourneyTick(app);
}
export function eventsShutdown(app: App): void { quizShutdown(app); }
