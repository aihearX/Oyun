/**
 * Takım bulma ve başvuru (docs/16-takim-rekabeti.md "Takım bulma ve başvuru"). Sunucu yetkili:
 *  - Her takım keşif listesinde (team.list) ve Sıralama'da görünür; liste "Takım gücü" sırasıyla, arama, filtre ve sayfalama.
 *  - Katılım modu: 'acik' (teams.open = 1, doğrudan katıl) ya da 'basvuru' (teams.open = 0, lider ya da yardımcı onaylar). Eski "yalnızca kodla"
 *    takımlar (open = 0) veri değişmeden başvuruya geçer; davet kodu iki modda da doğrudan katılım kısayolu olarak kalır.
 *  - Onaylayanlar TEAM_APPLY_RULES.approvers (lider + yardımcı); karar veren kaydedilir (decided_by) ve takım sohbetinde yazılır.
 *    Karar koşullu yazımla (status = 'bekliyor') tek kez geçer: iki onaylayan aynı anda basarsa ikincisi "zaten karara bağlandı" alır.
 *  - Başvuru kuralları TEAM_APPLY_RULES'ta: en çok 3 bekleyen, takım başına bir bekleyen (kısmi benzersiz dizin), red sonrası 24 saat,
 *    7 günde düşme, günlük sınır, bölüm şartı; kabul anında takım doluysa ya da oyuncu başka takımdaysa engellenir. Kabul tek işlemde
 *    (BEGIN IMMEDIATE) yapılır ve üye sayısı joinTeam içinde yeniden sayılır: iki kabul takımı taşıramaz.
 *  - Oyuncu herhangi bir takıma girince (kurma, katılma, kod, kabul) diğer bekleyen başvuruları kendiliğinden düşer.
 *  - Not: hazır notlar herkese; serbest yazı yalnızca güvenli sohbet kuralı açılınca (8 bölüm, chat ile aynı kural) ve küfür süzgecinden geçerse.
 *  - Red gerekçesi yalnızca hazır listeden.
 */
import {
  SOCIAL_LIMITS, TEAM_APPLY_NOTES, TEAM_APPLY_RULES as R, TEAM_REJECT_REASONS, canApprove,
  type TeamApplication, type TeamApplyStatus, type TeamBrowseRow, type TeamJoinState, type TeamListFilter, type TeamProfile, type TeamRole,
} from '@odi/shared';
import { fail, rid, type App, type Handlers, type PlayerRow, type TeamRow } from './app';
import { systemMessage, teamRoom } from './chat';
import { feedEvent } from './comm';
import { canFreeText } from './comm/settings';
import { hasProfanity } from './profanity';
import { announcePresence } from './players';
import { teamPowerRanks } from './rank';
import { currentTier } from './teamrace/league';
import { broadcastTeam, joinTeam, requireTeam, teamDetail, teamNameKey } from './teams';
import { dayKey } from './time';

export { TEAM_APPLY_SCHEMA } from './teamapply-schema';

interface AppRow {
  id: string; team_id: string; player_id: string; team_name: string; team_emblem: string; note: string; note_kind: TeamApplication['noteKind'];
  status: TeamApplyStatus; reason: string; at: number; expires_at: number; decided_at: number | null; decided_by: string | null; seen: number;
}

const NOTE_IDS = new Set(TEAM_APPLY_NOTES.map((n) => n.id));
const REASON_IDS = new Set(TEAM_REJECT_REASONS.map((n) => n.id));
const HOUR = 3_600_000;

function toView(app: App, r: AppRow): TeamApplication {
  const p = app.playerOrNull(r.player_id);
  const player = p ? app.publicProfile(p) : { id: r.player_id, name: '?', color: 0x7c5cff, hat: '', level: 1, highest: 1, stars: 0, teamId: null, teamName: null, teamEmblem: null, league: 'bronz' as const, online: false, lastSeen: 0 };
  return {
    id: r.id, teamId: r.team_id, teamName: r.team_name, teamEmblem: r.team_emblem, player, note: r.note, noteKind: r.note_kind,
    status: r.status, reason: r.reason, at: r.at, expiresAt: r.expires_at, decidedAt: r.decided_at, seen: !!r.seen,
    decidedBy: r.decided_by && (r.status === 'kabul' || r.status === 'red') ? { id: r.decided_by, name: app.playerOrNull(r.decided_by)?.name ?? '?' } : null,
  };
}
const row = (app: App, id: string) => app.db.get<AppRow>('SELECT * FROM team_apps WHERE id = ?', id) ?? null;
const memberCount = (app: App, teamId: string) => app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM players WHERE team_id = ?', teamId)!.n;
const approverIds = (app: App, teamId: string) =>
  app.db.all<{ id: string; team_role: TeamRole | null }>('SELECT id, team_role FROM players WHERE team_id = ?', teamId).filter((r) => canApprove(r.team_role)).map((r) => r.id);

/** takımın bekleyen başvuruları (en eski önce) */
export function pendingFor(app: App, teamId: string): TeamApplication[] {
  return app.db.all<AppRow>("SELECT * FROM team_apps WHERE team_id = ? AND status = 'bekliyor' AND expires_at > ? ORDER BY at", teamId, app.now()).map((r) => toView(app, r));
}
/** onaylayanlara (çevrimiçi) güncel bekleyen listesi */
function notifyApprovers(app: App, teamId: string): void {
  if (!app.team(teamId)) return;
  const list = pendingFor(app, teamId);
  for (const id of approverIds(app, teamId)) app.emit(id, 'team.applications', { teamId, applications: list });
}
/** başvuru durumunu değiştir (yalnızca hâlâ bekliyorsa); başvurana bildir */
function settle(app: App, r: AppRow, status: TeamApplyStatus, by: string | null, reason = '', seen = false): AppRow | null {
  const n = app.db.run("UPDATE team_apps SET status = ?, reason = ?, decided_at = ?, decided_by = ?, seen = ? WHERE id = ? AND status = 'bekliyor'",
    status, reason, app.now(), by, seen ? 1 : 0, r.id);
  if (!n) return null;
  const now = row(app, r.id)!;
  app.emit(r.player_id, 'team.apply.updated', { application: toView(app, now) });
  return now;
}

/** süresi dolan başvurular (sweep ve her başvuru işleminde tembel) */
export function expireApplications(app: App): void {
  const due = app.db.all<AppRow>("SELECT * FROM team_apps WHERE status = 'bekliyor' AND expires_at <= ? LIMIT 200", app.now());
  const teams = new Set<string>();
  for (const r of due) if (settle(app, r, 'sure', null)) teams.add(r.team_id);
  for (const t of teams) notifyApprovers(app, t);
}

/** oyuncu bir takıma girdi: diğer bekleyen başvuruları düşer (görüldü sayılır; kendisi zaten takıma girdi) */
function onJoined(app: App, pid: string, teamId: string): void {
  const rows = app.db.all<AppRow>("SELECT * FROM team_apps WHERE player_id = ? AND status = 'bekliyor'", pid);
  for (const r of rows) if (r.team_id !== teamId && settle(app, r, 'otomatik', null, '', true)) notifyApprovers(app, r.team_id);
  // girdiği takıma bekleyen başvurusu varsa (ör. kodla katıldı) o da kabul sayılır
  for (const r of rows) if (r.team_id === teamId && settle(app, r, 'kabul', null, '', true)) notifyApprovers(app, r.team_id);
}
function onTeamDeleted(app: App, teamId: string): void {
  for (const r of app.db.all<AppRow>("SELECT * FROM team_apps WHERE team_id = ? AND status = 'bekliyor'", teamId)) settle(app, r, 'iptal', null);
}
export function installTeamApply(app: App): void {
  app.teamJoinHooks.push((pid, teamId) => onJoined(app, pid, teamId));
  app.teamDeleteHooks.push((teamId) => onTeamDeleted(app, teamId));
}

// ------------------------------------------------------------------ keşif listesi ve profil
interface ListRow extends TeamRow { n: number; st: number }
interface Viewer { p: PlayerRow; pending: Map<string, string>; pendingN: number; until: Map<string, number> }

function viewerOf(app: App, pid: string): Viewer {
  const p = app.player(pid);
  const now = app.now();
  const pend = app.db.all<{ id: string; team_id: string }>("SELECT id, team_id FROM team_apps WHERE player_id = ? AND status = 'bekliyor' AND expires_at > ?", pid, now);
  const until = new Map<string, number>();
  // red sonrası 24 saat, geri çekme sonrası 10 dakika
  for (const r of app.db.all<{ team_id: string; status: string; decided_at: number }>("SELECT team_id, status, decided_at FROM team_apps WHERE player_id = ? AND status IN ('red', 'iptal') AND decided_by IS NOT NULL AND decided_at > ?", pid, now - R.cooldownMs)) {
    const end = r.decided_at + (r.status === 'red' ? R.cooldownMs : R.recancelMs);
    if (end > now) until.set(r.team_id, Math.max(until.get(r.team_id) ?? 0, end));
  }
  return { p, pending: new Map(pend.map((r) => [r.team_id, r.id])), pendingN: pend.length, until };
}

function stateFor(v: Viewer, t: TeamRow, members: number): { state: TeamJoinState; until?: number; applicationId?: string } {
  if (v.p.team_id === t.id) return { state: 'uye' };
  if (v.p.team_id) return { state: 'takimda' };
  const appId = v.pending.get(t.id);
  if (appId) return { state: 'gonderildi', applicationId: appId };
  if (members >= SOCIAL_LIMITS.teamMax) return { state: 'dolu' };
  if (v.p.highest < t.min_level) return { state: 'seviye' };
  if (t.open) return { state: 'katil' };
  const until = v.until.get(t.id);
  if (until) return { state: 'bekle', until };
  if (v.pendingN >= R.maxPending) return { state: 'sinir' };
  return { state: 'basvur' };
}

function browseRow(app: App, v: Viewer, t: TeamRow, members: number, stars: number, ranks: Map<string, { rank: number; value: number }>): TeamBrowseRow {
  const r = ranks.get(t.id);
  return {
    id: t.id, name: t.name, emblem: t.emblem, description: t.description, members, max: SOCIAL_LIMITS.teamMax, power: stars,
    open: !!t.open, code: v.p.team_id === t.id ? t.code : '', minLevel: t.min_level,
    joinMode: t.open ? 'acik' : 'basvuru', rank: r?.rank ?? null, rankPower: r?.value ?? 0, leagueTier: currentTier(app, t.id),
    ...stateFor(v, t, members),
  };
}

export function browseTeams(app: App, pid: string, o: { query?: string; filter?: TeamListFilter; offset?: number; limit?: number }): { teams: TeamBrowseRow[]; next: number | null; total: number } {
  const v = viewerOf(app, pid);
  const q = o.query?.trim() ? teamNameKey(o.query).replace(/[%_\\]/g, (c) => '\\' + c) : '';
  const f = o.filter ?? 'hepsi';
  const where = [q ? "t.name_key LIKE ? ESCAPE '\\'" : '', f === 'acik' ? 't.open = 1' : f === 'basvuru' ? 't.open = 0' : f === 'uygun' ? 't.min_level <= ?' : ''].filter(Boolean);
  const args: (string | number)[] = [...(q ? [`%${q}%`] : []), ...(f === 'uygun' ? [v.p.highest] : [])];
  let rows = app.db.all<ListRow>(`SELECT t.*, COUNT(p.id) AS n, COALESCE(SUM(p.stars), 0) AS st FROM teams t LEFT JOIN players p ON p.team_id = t.id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''} GROUP BY t.id`, ...args);
  if (f === 'uygun') rows = rows.filter((t) => t.n < SOCIAL_LIMITS.teamMax && t.id !== v.p.team_id);
  const ranks = teamPowerRanks(app);
  // Sıralama'daki "Takım gücü" sırası; tabloda olmayanlar (güç 0) sonra: kalabalık önce, sonra eski önce
  rows.sort((a, b) => (ranks.get(a.id)?.pos ?? Infinity) - (ranks.get(b.id)?.pos ?? Infinity) || b.n - a.n || a.created_at - b.created_at || (a.id < b.id ? -1 : 1));
  const offset = Math.max(0, o.offset ?? 0); const limit = Math.min(R.pageMax, Math.max(1, o.limit ?? R.pageSize));
  const page = rows.slice(offset, offset + limit);
  return { teams: page.map((t) => browseRow(app, v, t, t.n, t.st, ranks)), next: offset + limit < rows.length ? offset + limit : null, total: rows.length };
}

export function teamProfile(app: App, pid: string, teamId: string): TeamProfile {
  const t = app.team(teamId);
  if (!t) return fail('YOK', 'Takım bulunamadı.');
  const d = teamDetail(app, teamId)!;
  const v = viewerOf(app, pid);
  const base = browseRow(app, v, t, d.members, d.power, teamPowerRanks(app));
  return { ...base, roster: d.roster, weekPoints: d.weekPoints, createdAt: t.created_at };
}

// ------------------------------------------------------------------ başvuru
function cleanNote(app: App, p: PlayerRow, noteId?: string, note?: string): { note: string; kind: TeamApplication['noteKind'] } {
  if (noteId) {
    if (!NOTE_IDS.has(noteId)) fail('GECERSIZ', 'Böyle bir hazır not yok.');
    return { note: noteId, kind: 'hazir' };
  }
  const text = (note ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return { note: '', kind: 'yok' };
  // güvenli sohbet kuralı (chat ile aynı): yeterince bölüm geçilmeden serbest yazı yok
  if (!canFreeText(app, p)) fail('SERBEST_KAPALI', `Kendi notunu yazmak ${app.cfg.freeTextCleared}. bölümden sonra açılır; o zamana kadar hazır notlardan birini seç.`);
  if ([...text].length > R.noteMax) fail('GECERSIZ', `Not en çok ${R.noteMax} karakter olabilir.`);
  if (hasProfanity(text)) fail('UYGUNSUZ', 'Notunda uygun olmayan bir ifade var; lütfen değiştir.');
  return { note: text, kind: 'serbest' };
}

function apply(app: App, pid: string, teamId: string, noteId?: string, note?: string): TeamApplication {
  expireApplications(app);
  const p = app.player(pid);
  if (p.team_id) fail('TAKIMDA', 'Zaten bir takımdasın; önce ayrılmalısın.');
  const t = app.team(teamId);
  if (!t) return fail('YOK', 'Takım bulunamadı.');
  if (t.open) fail('ACIK', 'Bu takım herkese açık; başvurmadan doğrudan katılabilirsin.');
  if (memberCount(app, t.id) >= SOCIAL_LIMITS.teamMax) fail('DOLU', 'Takım dolu.');
  if (p.highest < t.min_level) fail('SART', `Bu takıma başvurmak için en az ${t.min_level}. bölüme ulaşmalısın.`);
  const v = viewerOf(app, pid);
  if (v.pending.has(t.id)) fail('TEKRAR', 'Bu takıma zaten başvurdun; takımın kararını bekle.');
  const until = v.until.get(t.id);
  if (until) {
    const h = Math.ceil((until - app.now()) / HOUR);
    fail('BEKLE', until - app.now() > HOUR ? `Bu takıma yeniden başvurmak için ${h} saat beklemelisin.` : 'Bu takıma biraz sonra yeniden başvurabilirsin.');
  }
  if (v.pendingN >= R.maxPending) fail('LIMIT', `Aynı anda en çok ${R.maxPending} takıma başvurabilirsin; birini geri çek ya da yanıt bekle.`);
  const day = dayKey(app.now());
  if (app.dailyCount(pid, day, 'team_apply') >= R.perDay) fail('LIMIT', `Bugün en çok ${R.perDay} başvuru yapabilirsin; yarın yeniden dene.`);
  const n = cleanNote(app, p, noteId, note);
  app.dailyInc(pid, day, 'team_apply');
  const id = rid('a');
  app.db.run('INSERT INTO team_apps(id, team_id, player_id, team_name, team_emblem, note, note_kind, status, at, expires_at, seen) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
    id, t.id, pid, t.name, t.emblem, n.note, n.kind, 'bekliyor', app.now(), app.now() + R.ttlMs);
  notifyApprovers(app, t.id);
  return toView(app, row(app, id)!);
}

function cancel(app: App, pid: string, applicationId: string): TeamApplication {
  const r = row(app, applicationId);
  if (!r || r.player_id !== pid) return fail('YOK', 'Başvuru bulunamadı.');
  if (r.status !== 'bekliyor') fail('KARAR', 'Bu başvuru artık bekleyen bir başvuru değil.');
  const done = settle(app, r, 'iptal', pid, '', true)!;
  notifyApprovers(app, r.team_id);
  return toView(app, done);
}

function mine(app: App, pid: string, seen: boolean): TeamApplication[] {
  expireApplications(app);
  if (seen) app.db.run("UPDATE team_apps SET seen = 1 WHERE player_id = ? AND seen = 0 AND status != 'bekliyor'", pid);
  return app.db.all<AppRow>("SELECT * FROM team_apps WHERE player_id = ? AND (status = 'bekliyor' OR (decided_at > ? AND status IN ('kabul', 'red', 'sure'))) ORDER BY at DESC LIMIT 20",
    pid, app.now() - R.ttlMs).map((r) => toView(app, r));
}

function requireApprover(app: App, pid: string) {
  const x = requireTeam(app, pid);
  if (!canApprove(x.p.team_role)) fail('YETKI', 'Başvuruları yalnızca takım lideri ve yardımcılar onaylayabilir.');
  return x;
}

function decide(app: App, pid: string, applicationId: string, accept: boolean, reason?: string) {
  expireApplications(app);
  const { p, t } = requireApprover(app, pid);
  const r = row(app, applicationId);
  if (!r || r.team_id !== t.id) return fail('YOK', 'Başvuru bulunamadı.');
  if (r.status === 'sure') fail('SURE', 'Bu başvurunun süresi doldu.');
  if (r.status === 'kabul' || r.status === 'red') fail('KARAR', `Bu başvuru zaten karara bağlandı (${r.decided_by ? app.playerOrNull(r.decided_by)?.name ?? '?' : 'otomatik'}: ${r.status === 'kabul' ? 'kabul' : 'ret'}).`);
  if (r.status !== 'bekliyor') fail('KARAR', 'Bu başvuru artık bekleyen bir başvuru değil (geri çekildi ya da oyuncu başka takıma girdi).');
  const target = app.player(r.player_id);
  let done: AppRow;
  if (accept) {
    if (target.team_id) fail('TAKIMDA', `${target.name} artık başka bir takımda.`);
    if (memberCount(app, t.id) >= SOCIAL_LIMITS.teamMax) fail('DOLU', 'Takım dolu; kabul etmek için önce yer açılmalı.');
    if (target.highest < t.min_level) fail('SART', `${target.name} takımın bölüm şartını (${t.min_level}. bölüm) henüz karşılamıyor.`);
    // önce başvuru kapanır (görüldü: oyuncu kabul anını bildirimle ve takım ekranıyla görür), sonra katılım: hata olursa ikisi de geri alınır
    done = settle(app, r, 'kabul', p.id)!;
    joinTeam(app, target, t, 'uye');
    systemMessage(app, teamRoom(t.id), `${p.name}, ${target.name} adlı oyuncunun başvurusunu kabul etti.`);
    feedEvent(app, target.id, 'uye', {}); // Takım Akışı: "X takıma katıldı."
    broadcastTeam(app, t.id);
    announcePresence(app, target.id, true);
  } else {
    const why = reason ?? '';
    if (why && !REASON_IDS.has(why)) fail('GECERSIZ', 'Red gerekçesi listeden seçilmeli.');
    done = settle(app, r, 'red', p.id, why)!;
    systemMessage(app, teamRoom(t.id), `${p.name}, ${target.name} adlı oyuncunun başvurusunu kabul etmedi.`);
  }
  notifyApprovers(app, t.id);
  return { application: toView(app, done), applications: pendingFor(app, t.id), team: teamDetail(app, t.id)! };
}

function settings(app: App, pid: string, d: { joinMode?: 'acik' | 'basvuru'; minLevel?: number }) {
  const { p, t } = requireTeam(app, pid);
  if (p.team_role !== 'lider') fail('YETKI', 'Takım ayarlarını yalnızca lider değiştirebilir.');
  const notes: string[] = [];
  if (d.joinMode && (d.joinMode === 'acik') !== !!t.open) {
    app.db.run('UPDATE teams SET open = ? WHERE id = ?', d.joinMode === 'acik' ? 1 : 0, t.id);
    notes.push(d.joinMode === 'acik' ? 'Takım artık herkese açık: oyuncular doğrudan katılabilir.' : 'Takım artık başvuruyla üye alıyor: başvuruları lider ve yardımcılar onaylar.');
  }
  if (d.minLevel !== undefined && d.minLevel !== t.min_level) {
    if (d.minLevel > p.highest) fail('SART', 'En az bölüm şartı kendi bölümünden yüksek olamaz.');
    app.db.run('UPDATE teams SET min_level = ? WHERE id = ?', d.minLevel, t.id);
    notes.push(d.minLevel > 1 ? `Katılım şartı: en az ${d.minLevel}. bölüm.` : 'Katılım için bölüm şartı yok.');
  }
  for (const n of notes) systemMessage(app, teamRoom(t.id), n);
  if (notes.length) broadcastTeam(app, t.id);
  return { team: teamDetail(app, t.id)! };
}

export const teamApplyHandlers: Handlers = {
  'team.list': (app, s, d) => browseTeams(app, s.pid, d),
  'team.profile': (app, s, { teamId }) => ({ team: teamProfile(app, s.pid, teamId) }),
  'team.apply': (app, s, { teamId, noteId, note }) => ({ application: apply(app, s.pid, teamId, noteId, note) }),
  'team.apply.cancel': (app, s, { applicationId }) => ({ application: cancel(app, s.pid, applicationId) }),
  'team.apply.mine': (app, s, { seen }) => ({ applications: mine(app, s.pid, !!seen) }),
  'team.applications': (app, s) => { expireApplications(app); const { t } = requireApprover(app, s.pid); return { applications: pendingFor(app, t.id) }; },
  'team.apply.decide': (app, s, { applicationId, accept, reason }) => decide(app, s.pid, applicationId, accept, reason),
  'team.settings': (app, s, d) => settings(app, s.pid, d),
};
