import { COMM_RULES, type MentorLink, type MentorOffer, type MentorState, type PublicProfile } from '@odi/shared';
import { fail, rid, type App, type PlayerRow } from '../app';
import { areFriends } from '../chat';
import { isBlocked } from '../friends';
import { dayKey } from '../time';
import { commNotice, metric } from './settings';

/**
 * Usta–Çırak: en az 10 bölüm geçmiş usta (en yüksek ≥ 11), yeni bir arkadaşına ya da takım arkadaşına (en yüksek ≤ 9) çırak teklif eder
 * (ya da çırak ustaya sorar). Çırağın dönüm noktaları (5, 10, 15, 20 — en yüksek açık bölüm) yalnızca BAĞDAN SONRA ulaşılınca sayılır;
 * çırak başına her dönüm noktası bir kez (başka ustayla yeniden kazanılmaz). 20'de çırak "mezun" olur, bağ kapanır.
 */
interface LinkRow { id: string; mentor: string; apprentice: string; since: number; start_highest: number; ended_at: number | null; reason: string | null }
interface OfferRow { id: string; mentor: string; apprentice: string; by_id: string; at: number }
const MS = COMM_RULES.mentorMilestones as readonly number[];
const GRAD = MS[MS.length - 1]!;

const canMentor = (p: PlayerRow) => p.highest >= COMM_RULES.mentorMinHighest;
const canApprentice = (p: PlayerRow) => p.highest <= COMM_RULES.apprenticeMaxHighest;
const pub = (app: App, id: string): PublicProfile | null => { const p = app.playerOrNull(id); return p ? app.publicProfile(p) : null; };
const linkOfApprentice = (app: App, pid: string) => app.db.get<LinkRow>('SELECT * FROM mentor_links WHERE apprentice = ? AND ended_at IS NULL', pid) ?? null;
const linksOfMentor = (app: App, pid: string) => app.db.all<LinkRow>('SELECT * FROM mentor_links WHERE mentor = ? AND ended_at IS NULL ORDER BY since', pid);
const related = (app: App, a: PlayerRow, b: PlayerRow) => areFriends(app, a.id, b.id) || (!!a.team_id && a.team_id === b.team_id);

function toLink(app: App, r: LinkRow): MentorLink | null {
  const mentor = pub(app, r.mentor); const apprentice = pub(app, r.apprentice);
  if (!mentor || !apprentice) return null;
  const reached = app.db.all<{ milestone: number }>('SELECT milestone FROM mentor_milestones WHERE link_id = ? ORDER BY milestone', r.id).map((x) => x.milestone);
  const next = MS.find((m) => m > Math.max(r.start_highest, apprentice.highest)) ?? null;
  return { id: r.id, mentor, apprentice, since: r.since, startHighest: r.start_highest, next, reached };
}
function toOffer(app: App, r: OfferRow): MentorOffer | null {
  const mentor = pub(app, r.mentor); const apprentice = pub(app, r.apprentice);
  return mentor && apprentice ? { id: r.id, mentor, apprentice, by: r.by_id, at: r.at } : null;
}

export function mentorState(app: App, pid: string): MentorState {
  const p = app.player(pid);
  const mine = linkOfApprentice(app, pid);
  const apprentices = linksOfMentor(app, pid).map((r) => toLink(app, r)).filter(Boolean) as MentorLink[];
  const offers = app.db.all<OfferRow>('SELECT * FROM mentor_offers WHERE mentor = ? OR apprentice = ? ORDER BY at DESC', pid, pid).map((r) => toOffer(app, r)).filter(Boolean) as MentorOffer[];
  const incoming = offers.filter((o) => o.by !== pid); const outgoing = offers.filter((o) => o.by === pid);
  // aday: arkadaş + takım arkadaşı; usta isem çırak olabilecekler, çırak isem usta olabilecekler
  const ids = new Set(app.db.all<{ b: string }>('SELECT b FROM friends WHERE a = ?', pid).map((r) => r.b));
  if (p.team_id) for (const id of app.teamMemberIds(p.team_id)) if (id !== pid) ids.add(id);
  const busy = new Set([...offers.map((o) => (o.mentor.id === pid ? o.apprentice.id : o.mentor.id)), ...apprentices.map((l) => l.apprentice.id)]);
  const candidates: PublicProfile[] = [];
  const meM = canMentor(p) && apprentices.length < COMM_RULES.mentorMaxApprentices; const meA = canApprentice(p) && !mine;
  for (const id of ids) {
    if (busy.has(id) || isBlocked(app, pid, id)) continue;
    const o = app.playerOrNull(id); if (!o) continue;
    const ok = (meM && canApprentice(o) && !linkOfApprentice(app, o.id)) || (meA && canMentor(o) && linksOfMentor(app, o.id).length < COMM_RULES.mentorMaxApprentices);
    if (ok) candidates.push(app.publicProfile(o));
    if (candidates.length >= 30) break;
  }
  candidates.sort((a, b) => Number(b.online) - Number(a.online));
  return {
    canMentor: canMentor(p), canBeApprentice: canApprentice(p), mentor: mine ? toLink(app, mine) : null, apprentices, incoming, outgoing, candidates,
    milestones: [...MS], rewards: { apprentice: [...COMM_RULES.mentorReward.apprentice], mentor: [...COMM_RULES.mentorReward.mentor] },
  };
}
const push = (app: App, ...ids: string[]) => { for (const id of ids) app.emitEach([id], 'mentor.updated', (p) => ({ mentor: mentorState(app, p) })); };

function checkPair(app: App, mentor: PlayerRow, apprentice: PlayerRow): void {
  if (mentor.id === apprentice.id) fail('GECERSIZ', 'Kendine usta olamazsın.');
  if (isBlocked(app, mentor.id, apprentice.id)) fail('ENGEL', 'Bu oyuncuyla bağ kurulamıyor.');
  if (!related(app, mentor, apprentice)) fail('YETKI', 'Usta–Çırak yalnızca arkadaşlar ya da takım arkadaşları arasında kurulur.');
  if (!canMentor(mentor)) fail('SART', `Usta olmak için en az ${COMM_RULES.mentorMinHighest - 1} bölüm geçmiş olmak gerekir.`);
  if (!canApprentice(apprentice)) fail('SART', `Çırak en çok ${COMM_RULES.apprenticeMaxHighest}. bölümde olmalı (yeni başlayan).`);
  if (linkOfApprentice(app, apprentice.id)) fail('DOLU', `${apprentice.name} zaten bir ustayla çalışıyor.`);
  if (linksOfMentor(app, mentor.id).length >= COMM_RULES.mentorMaxApprentices) fail('DOLU', `Bir ustanın en çok ${COMM_RULES.mentorMaxApprentices} çırağı olabilir.`);
}

export function mentorOffer(app: App, pid: string, otherId: string, as: 'usta' | 'cirak'): MentorState {
  const me = app.player(pid); const other = app.playerOrNull(otherId);
  if (!other) return fail('YOK', 'Oyuncu bulunamadı.');
  const [mentor, apprentice] = as === 'usta' ? [me, other] : [other, me];
  checkPair(app, mentor, apprentice);
  const day = dayKey(app.now());
  if (app.dailyCount(pid, day, 'mentor_offer') >= COMM_RULES.mentorOffersPerDay) fail('LIMIT', `Günde en çok ${COMM_RULES.mentorOffersPerDay} teklif gönderebilirsin.`);
  const ex = app.db.get<OfferRow>('SELECT * FROM mentor_offers WHERE mentor = ? AND apprentice = ?', mentor.id, apprentice.id);
  if (ex && ex.by_id !== pid) return mentorRespond(app, pid, ex.id, true); // karşı taraf zaten teklif etmiş: kabul
  if (ex) fail('TEKRAR', 'Bu teklifi zaten gönderdin.');
  app.db.run('INSERT INTO mentor_offers(id, mentor, apprentice, by_id, at) VALUES(?, ?, ?, ?, ?)', rid('o'), mentor.id, apprentice.id, pid, app.now());
  app.dailyInc(pid, day, 'mentor_offer');
  commNotice(app, other.id, as === 'usta'
    ? { kind: 'mentor', title: `${me.name} sana usta olmak istiyor`, text: 'Kabul edersen ilerledikçe ikiniz de ödül alırsınız.', from: app.publicProfile(me) }
    : { kind: 'mentor', title: `${me.name} senden ustası olmanı istiyor`, text: 'Kabul edersen o ilerledikçe ikiniz de ödül alırsınız.', from: app.publicProfile(me) });
  push(app, other.id);
  return mentorState(app, pid);
}

export function mentorRespond(app: App, pid: string, offerId: string, accept: boolean): MentorState {
  const o = app.db.get<OfferRow>('SELECT * FROM mentor_offers WHERE id = ?', offerId);
  if (!o || (o.mentor !== pid && o.apprentice !== pid)) return fail('YOK', 'Teklif bulunamadı.');
  app.db.run('DELETE FROM mentor_offers WHERE id = ?', o.id);
  const other = o.mentor === pid ? o.apprentice : o.mentor;
  if (!accept || o.by_id === pid) { push(app, other); return mentorState(app, pid); } // ret ya da iptal: sessiz
  const mentor = app.player(o.mentor); const apprentice = app.player(o.apprentice);
  checkPair(app, mentor, apprentice);
  const id = rid('l');
  app.db.run('INSERT INTO mentor_links(id, mentor, apprentice, since, start_highest) VALUES(?, ?, ?, ?, ?)', id, mentor.id, apprentice.id, app.now(), apprentice.highest);
  app.db.run('DELETE FROM mentor_offers WHERE apprentice = ?', apprentice.id);
  metric(app, 'mentor.link');
  const me = app.player(pid);
  commNotice(app, other, { kind: 'mentor', title: `${me.name} teklifi kabul etti`, text: other === mentor.id ? `Artık ${apprentice.name} adlı çırağın var. Dönüm noktalarında sana haber vereceğim.` : `Artık ustan ${mentor.name}.`, from: app.publicProfile(me) });
  push(app, other);
  return mentorState(app, pid);
}

export function mentorEnd(app: App, pid: string, linkId: string): MentorState {
  const l = app.db.get<LinkRow>('SELECT * FROM mentor_links WHERE id = ? AND ended_at IS NULL', linkId);
  if (!l || (l.mentor !== pid && l.apprentice !== pid)) return fail('YOK', 'Bağ bulunamadı.');
  app.db.run("UPDATE mentor_links SET ended_at = ?, reason = 'birakti' WHERE id = ?", app.now(), l.id);
  push(app, l.mentor === pid ? l.apprentice : l.mentor);
  return mentorState(app, pid);
}

/** bölüm sonucu: çırağın en yüksek açık bölümü bir dönüm noktasını geçtiyse ikisine de bir kez ödül; ustaya "tebrik et" dürtmesi */
export function mentorProgress(app: App, pid: string, prevHighest: number): void {
  const l = linkOfApprentice(app, pid); if (!l) return;
  const p = app.player(pid);
  if (p.highest <= prevHighest) return;
  for (const m of MS) {
    if (!(m > prevHighest && m <= p.highest && m > l.start_highest)) continue;
    if (!app.db.run('INSERT OR IGNORE INTO mentor_milestones(apprentice, milestone, mentor, link_id, at) VALUES(?, ?, ?, ?, ?)', pid, m, l.mentor, l.id, app.now())) continue;
    metric(app, 'mentor.milestone');
    const mentor = app.playerOrNull(l.mentor);
    for (const g of COMM_RULES.mentorReward.apprentice) app.addInbox(pid, { kind: g.kind, amount: g.amount, ref: g.ref }, `Usta–Çırak: ${m}. bölüme ulaştın`);
    if (mentor) {
      for (const g of COMM_RULES.mentorReward.mentor) app.addInbox(mentor.id, { kind: g.kind, amount: g.amount, ref: g.ref }, `Usta–Çırak: ${p.name} ${m}. bölüme ulaştı`);
      commNotice(app, mentor.id, { kind: 'mentor', title: `Çırağın ${p.name} ${m}. bölüme ulaştı!`, text: 'Bir tebrik gönder; ikinizin de ödülü ödül kutusunda.', from: app.publicProfile(p) });
    }
    commNotice(app, pid, { kind: 'mentor', title: `${m}. bölüme ulaştın!`, text: `Ustan ${mentor?.name ?? ''} ile birlikte ödül kazandınız.`, ...(mentor ? { from: app.publicProfile(mentor) } : {}) });
    if (m >= GRAD) app.db.run("UPDATE mentor_links SET ended_at = ?, reason = 'mezun' WHERE id = ?", app.now(), l.id);
  }
  push(app, pid, l.mentor);
}
