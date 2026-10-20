import { COMM_RULES, phraseById, type OpMap } from '@odi/shared';
import { fail, parseJson, type App, type Handler, type Session } from '../app';
import { postCard, sendAs, teamRoom, updateCard } from '../chat';
import { raceHandlers } from '../race';
import { DAY_MS } from '../time';
import { feedEvent } from './feed';
import { commNotice, metric } from './settings';

/**
 * Yardım İste (genişletilmiş): takım sohbetindeki yardım kartı (kind 'help') üç gerçek eylem taşır —
 * ipucu (kartın konusuna yanıt), kalkan (team.help.give: ödül kutusuna gerçek kalkan), birlikte yarış (help.race).
 * İsteyen o bölümü 24 saat içinde geçerse istek BİR KEZ çözülür: isteyene 15, her yardım edene 20 jeton + teşekkür bildirimi.
 */
const TTL = DAY_MS;
interface HelpRow { id: string; team_id: string; from_id: string; level: number; helpers: string; max: number; at: number }
const reqById = (app: App, id: string) => app.db.get<HelpRow>('SELECT * FROM help_requests WHERE id = ?', id);
export const helpCardId = (app: App, requestId: string) => app.db.get<{ msg_id: string }>('SELECT msg_id FROM help_cards WHERE request_id = ?', requestId)?.msg_id ?? null;

/** teams.ts: yardım kartı sohbete düşünce eşle */
export function onHelpCard(app: App, requestId: string, msgId: string): void {
  app.db.run('INSERT OR IGNORE INTO help_cards(request_id, msg_id) VALUES(?, ?)', requestId, msgId);
  metric(app, 'help.request');
}

function refreshCard(app: App, requestId: string): void {
  const card = helpCardId(app, requestId); if (!card) return;
  const n = (k: string) => app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM help_actions WHERE request_id = ? AND kind = ?', requestId, k)!.n;
  const done = !!app.db.get('SELECT 1 AS x FROM help_resolved WHERE request_id = ?', requestId);
  updateCard(app, card, null, { ipucu: n('ipucu'), kalkan: n('kalkan'), yaris: n('yaris'), done });
}

export function recordHelp(app: App, requestId: string, helperId: string, kind: 'ipucu' | 'kalkan' | 'yaris'): boolean {
  const added = app.db.run('INSERT OR IGNORE INTO help_actions(request_id, helper_id, kind, at) VALUES(?, ?, ?, ?)', requestId, helperId, kind, app.now()) === 1;
  if (added) { metric(app, `help.${kind === 'ipucu' ? 'tip' : kind === 'kalkan' ? 'shield' : 'race'}`); refreshCard(app, requestId); }
  return added;
}

/** açık (süresi dolmamış, çözülmemiş) ve benim takımımdaki, başkasına ait istek */
function openRequestFor(app: App, pid: string, requestId: string): HelpRow {
  const p = app.player(pid);
  const r = reqById(app, requestId);
  if (!r || r.team_id !== p.team_id) return fail('YOK', 'Yardım isteği bulunamadı.');
  if (r.at <= app.now() - TTL) fail('SURE', 'Bu yardım isteğinin süresi doldu.');
  if (app.db.get('SELECT 1 AS x FROM help_resolved WHERE request_id = ?', r.id)) fail('BITTI', 'Bu bölüm geçildi; yardım isteği kapandı.');
  if (r.from_id === pid) fail('GECERSIZ', 'Kendi isteğine yardım edemezsin.');
  return r;
}

/** isteyen o bölümü geçti: istek bir kez çözülür, ödüller ve teşekkür */
export function resolveHelp(app: App, pid: string, level: number): void {
  const reqs = app.db.all<HelpRow>('SELECT * FROM help_requests WHERE from_id = ? AND level = ? AND at > ?', pid, level, app.now() - TTL);
  for (const r of reqs) {
    if (!app.db.run('INSERT OR IGNORE INTO help_resolved(request_id, at) VALUES(?, ?)', r.id, app.now())) continue;
    // yardım edenler ilk yardım sırasıyla (ipucu/kalkan/yarış kayıtları + eski kalkan listesi)
    const helpers = new Set<string>([...app.db.all<{ helper_id: string }>('SELECT helper_id, MIN(at) AS t, MIN(rowid) AS o FROM help_actions WHERE request_id = ? GROUP BY helper_id ORDER BY t, o', r.id).map((x) => x.helper_id), ...parseJson<string[]>(r.helpers, [])]);
    helpers.delete(pid);
    refreshCard(app, r.id);
    if (!helpers.size) continue;
    metric(app, 'help.resolved');
    const p = app.player(pid);
    const names = [...helpers].map((h) => app.playerOrNull(h)?.name).filter(Boolean) as string[];
    app.addInbox(pid, { kind: 'jeton', amount: COMM_RULES.helpAskerJeton, ref: 'yardim' }, `${level}. bölümü takımınla geçtin`);
    const card = helpCardId(app, r.id);
    for (const h of helpers) {
      if (!app.playerOrNull(h)) continue;
      app.addInbox(h, { kind: 'jeton', amount: COMM_RULES.helpHelperJeton, ref: 'yardim' }, `Teşekkür: ${p.name} ${level}. bölümü geçti`);
      commNotice(app, h, { kind: 'thanks', title: `${p.name} ${level}. bölümü geçti!`, text: `Yardımın için teşekkür ediyor. Ödül kutuna ${COMM_RULES.helpHelperJeton} jeton düştü.`, from: app.publicProfile(p), room: teamRoom(r.team_id), ...(card ? { msgId: card } : {}) });
    }
    feedEvent(app, pid, 'yardim', { level, helpers: names.slice(0, 5).join(', ') });
  }
}

export const helpHandlers: { 'help.tip': Handler<'help.tip'>; 'help.race': Handler<'help.race'> } = {
  'help.tip': (app, s, { requestId, phrase, text }) => {
    const r = openRequestFor(app, s.pid, requestId);
    if (!phrase && !text) fail('GECERSIZ', 'Bir ipucu seç ya da yaz.');
    if (phrase && !phraseById(phrase)?.ctx.includes('ipucu')) fail('GECERSIZ', 'Böyle bir ipucu yok.');
    if (app.db.get("SELECT 1 AS x FROM help_actions WHERE request_id = ? AND helper_id = ? AND kind = 'ipucu'", r.id, s.pid)) fail('TEKRAR', 'Bu isteğe zaten ipucu verdin.');
    const card = helpCardId(app, r.id);
    if (!card) return fail('YOK', 'Yardım kartı bulunamadı.');
    const p = app.player(s.pid);
    const msg = sendAs(app, p, teamRoom(r.team_id), phrase ?? text!, phrase ? 'hazir' : 'text', card, { tip: 1 });
    recordHelp(app, r.id, s.pid, 'ipucu');
    commNotice(app, r.from_id, { kind: 'thanks', title: `${p.name} sana ipucu verdi`, text: msg.text.slice(0, 90), from: app.publicProfile(p), room: teamRoom(r.team_id), msgId: card });
    return { msg };
  },
  'help.race': (app, s, { requestId }) => {
    const r = openRequestFor(app, s.pid, requestId);
    const p = app.player(s.pid);
    if (p.highest < r.level) fail('SART', 'Bu bölümü henüz açmadın; ipucu ya da kalkan gönderebilirsin.');
    if (!app.online.has(r.from_id)) fail('CEVRIMDISI', 'Arkadaşın şu an çevrimiçi değil; ipucu ya da kalkan gönderebilirsin.');
    const res = raceHandlers['race.create']!(app, s as Session, { level: r.level }) as OpMap['race.create']['res'];
    app.emit(r.from_id, 'race.invited', { room: res.room, from: app.publicProfile(p) });
    recordHelp(app, r.id, s.pid, 'yaris');
    const card = helpCardId(app, r.id);
    if (card) postCard(app, teamRoom(r.team_id), { kind: 'system', text: `${p.name}, ${r.level}. bölümde birlikte yarışmak için oda kurdu.`, replyTo: card, meta: { event: 'yaris', pid: p.id } });
    return { room: res.room };
  },
};
