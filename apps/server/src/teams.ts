import { SOCIAL_LIMITS, WAR_REGIONS, type HelpRequest, type TeamDetail, type TeamMember, type TeamRole, type TeamSummary } from '@odi/shared';
import { fail, parseJson, randomCode, rid, type App, type Handlers, type PlayerRow, type TeamRow } from './app';
import { systemMessage, teamRoom } from './chat';
import { feedEvent, onHelpCard } from './comm';
import { hasProfanity } from './profanity';
import { announcePresence } from './players';
import { addContrib, broadcastExtra } from './teamextra';
import { dayKey, DAY_MS } from './time';
import { recomputeOwner } from './war';

export const HELP_PER_DAY = 3;
export const HELP_GIVE_JETON = 5;
const HELP_TTL_MS = DAY_MS;
const TEAM_NAME_MIN = 3;

const ROLE_ORDER: Record<TeamRole, number> = { lider: 0, yardimci: 1, uye: 2 };
export const teamNameKey = (s: string) => s.replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr');

let segmenter: Intl.Segmenter | null = null;
try { segmenter = new Intl.Segmenter('tr', { granularity: 'grapheme' }); } catch { segmenter = null; }
export function isSingleEmoji(s: string): boolean {
  if (!s || s.length > 16) return false;
  const count = segmenter ? [...segmenter.segment(s)].length : [...s].length;
  return count === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(s);
}

interface HelpRow { id: string; team_id: string; from_id: string; level: number; helpers: string; max: number; at: number }
function toHelp(app: App, r: HelpRow): HelpRequest {
  return { id: r.id, from: r.from_id, name: app.playerOrNull(r.from_id)?.name ?? '?', level: r.level, helpers: parseJson<string[]>(r.helpers, []), max: r.max, at: r.at, expiresAt: r.at + HELP_TTL_MS };
}

export function teamSummary(app: App, t: TeamRow): TeamSummary {
  const agg = app.db.get<{ n: number; power: number }>('SELECT COUNT(*) AS n, COALESCE(SUM(stars), 0) AS power FROM players WHERE team_id = ?', t.id)!;
  return { id: t.id, name: t.name, emblem: t.emblem, description: t.description, members: agg.n, max: SOCIAL_LIMITS.teamMax, power: agg.power, open: !!t.open, code: t.code, minLevel: t.min_level };
}

export function teamDetail(app: App, teamId: string): TeamDetail | null {
  const t = app.team(teamId);
  if (!t) return null;
  const week = app.week().key;
  const rows = app.db.all<PlayerRow & { wp: number | null }>(
    'SELECT p.*, w.war_points AS wp FROM players p LEFT JOIN player_week w ON w.player_id = p.id AND w.week = ? WHERE p.team_id = ?', week, teamId);
  const roster: TeamMember[] = rows.map((r) => ({ ...app.publicProfile(r), role: r.team_role ?? 'uye', weekPoints: r.wp ?? 0, joinedAt: r.team_joined_at ?? 0 }));
  roster.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || b.weekPoints - a.weekPoints || a.joinedAt - b.joinedAt);
  const help = app.db.all<HelpRow>('SELECT * FROM help_requests WHERE team_id = ? AND at > ? ORDER BY at DESC LIMIT 30', teamId, app.now() - HELP_TTL_MS).map((r) => toHelp(app, r));
  const weekPoints = app.db.get<{ points: number }>('SELECT points FROM team_week WHERE week = ? AND team_id = ?', week, teamId)?.points ?? 0;
  return { ...teamSummary(app, t), roster, help, weekPoints };
}

/** her çevrimiçi üyeye güncel takım ayrıntısı */
export function broadcastTeam(app: App, teamId: string): void {
  const d = teamDetail(app, teamId);
  app.emitEach(app.teamMemberIds(teamId), 'team.updated', () => ({ team: d }));
}

export function requireTeam(app: App, pid: string): { p: PlayerRow; t: TeamRow } {
  const p = app.player(pid);
  const t = p.team_id ? app.team(p.team_id) : null;
  if (!t) return fail('TAKIM_YOK', 'Bir takımda değilsin.');
  return { p, t };
}

function joinTeam(app: App, p: PlayerRow, t: TeamRow, role: TeamRole): void {
  if (p.team_id) fail('TAKIMDA', 'Zaten bir takımdasın; önce ayrılmalısın.');
  const n = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM players WHERE team_id = ?', t.id)!.n;
  if (n >= SOCIAL_LIMITS.teamMax) fail('DOLU', 'Takım dolu.');
  if (p.highest < t.min_level) fail('SART', `Bu takıma katılmak için en az ${t.min_level}. bölüme ulaşmalısın.`);
  app.db.run('UPDATE players SET team_id = ?, team_role = ?, team_joined_at = ? WHERE id = ?', t.id, role, app.now(), p.id);
}

/** üyeyi takımdan çıkar: lider ayrılırsa en kıdemli yardımcıya, yoksa en kıdemli üyeye devreder; son kişi çıkarsa takım silinir */
function removeMember(app: App, pid: string, how: 'ayrildi' | 'atildi'): void {
  const p = app.player(pid);
  const teamId = p.team_id;
  if (!teamId) return;
  app.db.run('UPDATE players SET team_id = NULL, team_role = NULL, team_joined_at = NULL WHERE id = ?', pid);
  app.unsubscribe(pid, teamRoom(teamId));
  const rest = app.db.all<PlayerRow>('SELECT * FROM players WHERE team_id = ? ORDER BY team_joined_at', teamId);
  if (!rest.length) { deleteTeam(app, teamId); return; }
  systemMessage(app, teamRoom(teamId), how === 'atildi' ? `${p.name} takımdan çıkarıldı.` : `${p.name} takımdan ayrıldı.`);
  if (p.team_role === 'lider') {
    const heir = rest.find((r) => r.team_role === 'yardimci') ?? rest[0]!;
    app.db.run("UPDATE players SET team_role = 'lider' WHERE id = ?", heir.id);
    systemMessage(app, teamRoom(teamId), `Yeni lider: ${heir.name}.`);
  }
  broadcastTeam(app, teamId);
}

function deleteTeam(app: App, teamId: string): void {
  const week = app.week().key;
  app.db.run('DELETE FROM teams WHERE id = ?', teamId);
  app.db.run('DELETE FROM help_requests WHERE team_id = ?', teamId);
  app.db.run('DELETE FROM team_tech WHERE team_id = ?', teamId);
  app.db.run('DELETE FROM chat WHERE room = ?', teamRoom(teamId));
  app.db.run('DELETE FROM war_points WHERE team_id = ? AND week = ?', teamId, week);
  const owned = app.db.all<{ region: string }>('SELECT region FROM war_owner WHERE team_id = ? AND week = ?', teamId, week);
  app.db.run('DELETE FROM war_owner WHERE team_id = ? AND week = ?', teamId, week);
  for (const o of owned) recomputeOwner(app, week, o.region);
}

export const teamHandlers: Handlers = {
  'team.list': (app, _s, { query }) => {
    const q = query ? teamNameKey(query).replace(/[%_\\]/g, (c) => '\\' + c) : '';
    const rows = app.db.all<TeamRow>(
      `SELECT t.* FROM teams t LEFT JOIN players p ON p.team_id = t.id WHERE t.open = 1 ${q ? "AND t.name_key LIKE ? ESCAPE '\\'" : ''}
       GROUP BY t.id ORDER BY COALESCE(SUM(p.stars), 0) DESC, t.created_at LIMIT 50`, ...(q ? [`%${q}%`] : []));
    return { teams: rows.map((t) => teamSummary(app, t)) };
  },
  'team.create': (app, s, { name, emblem, description, open, minLevel }) => {
    const p = app.player(s.pid);
    if (p.team_id) fail('TAKIMDA', 'Zaten bir takımdasın; önce ayrılmalısın.');
    const clean = name.replace(/\s+/g, ' ').trim();
    const len = [...clean].length;
    if (len < TEAM_NAME_MIN || len > SOCIAL_LIMITS.teamNameMax) fail('ISIM', `Takım adı ${TEAM_NAME_MIN}-${SOCIAL_LIMITS.teamNameMax} karakter olmalı.`);
    if (!/^[\p{L}\p{N} _.'-]+$/u.test(clean)) fail('ISIM', 'Takım adında yalnızca harf, rakam, boşluk ve - _ . kullanılabilir.');
    if (hasProfanity(clean)) fail('ISIM', 'Bu takım adı uygun değil.');
    if (!isSingleEmoji(emblem)) fail('GECERSIZ', 'Amblem tek bir emoji olmalı.');
    const desc = (description ?? '').replace(/\s+/g, ' ').trim();
    if (hasProfanity(desc)) fail('GECERSIZ', 'Açıklamada uygun olmayan ifade var.');
    const min = minLevel ?? 1;
    if (p.highest < min) fail('SART', 'En az bölüm şartı kendi bölümünden yüksek olamaz.');
    const key = teamNameKey(clean);
    if (app.db.get('SELECT 1 AS x FROM teams WHERE name_key = ?', key)) fail('ISIM', 'Bu takım adı alınmış.');
    let code = randomCode(6);
    while (app.db.get('SELECT 1 AS x FROM teams WHERE code = ?', code)) code = randomCode(6);
    const id = rid('t');
    app.db.run('INSERT INTO teams(id, name, name_key, emblem, description, open, code, min_level, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, clean, key, emblem, desc, open === false ? 0 : 1, code, min, app.now());
    joinTeam(app, p, app.team(id)!, 'lider');
    systemMessage(app, teamRoom(id), `${p.name} takımı kurdu. Hoş geldiniz!`);
    return { team: teamDetail(app, id)! };
  },
  'team.join': (app, s, { teamId, code }) => {
    const p = app.player(s.pid);
    let t: TeamRow | null = null;
    if (code) t = app.db.get<TeamRow>('SELECT * FROM teams WHERE code = ?', code.trim().toUpperCase()) ?? null;
    else if (teamId) {
      t = app.team(teamId);
      if (t && !t.open) fail('KAPALI', 'Bu takım yalnızca davet koduyla katılım kabul ediyor.');
    } else fail('GECERSIZ', 'Takım kimliği ya da davet kodu gerekli.');
    if (!t) return fail('YOK', 'Takım bulunamadı.');
    joinTeam(app, p, t, 'uye');
    feedEvent(app, p.id, 'uye', {}); // Takım Akışı kartı: "X takıma katıldı." (+ Hoş geldin)
    broadcastTeam(app, t.id);
    announcePresence(app, p.id, true);
    return { team: teamDetail(app, t.id)! };
  },
  'team.leave': (app, s) => {
    requireTeam(app, s.pid);
    removeMember(app, s.pid, 'ayrildi');
    return {};
  },
  'team.detail': (app, s, { teamId }) => {
    const id = teamId ?? app.player(s.pid).team_id;
    return { team: id ? teamDetail(app, id) : null };
  },
  'team.kick': (app, s, { id }) => {
    const { p, t } = requireTeam(app, s.pid);
    const target = app.playerOrNull(id);
    if (!target || target.team_id !== t.id) return fail('YOK', 'Bu oyuncu takımında değil.');
    if (target.id === p.id) fail('GECERSIZ', 'Kendini atamazsın; takımdan ayrılmayı kullan.');
    if (p.team_role === 'uye') fail('YETKI', 'Üye atma yetkin yok.');
    if (p.team_role === 'yardimci' && target.team_role !== 'uye') fail('YETKI', 'Yardımcılar yalnızca üyeleri atabilir.');
    removeMember(app, target.id, 'atildi');
    app.emit(target.id, 'team.updated', { team: null });
    return { team: teamDetail(app, t.id)! };
  },
  'team.role': (app, s, { id, role }) => {
    const { p, t } = requireTeam(app, s.pid);
    if (p.team_role !== 'lider') fail('YETKI', 'Rolleri yalnızca lider değiştirebilir.');
    const target = app.playerOrNull(id);
    if (!target || target.team_id !== t.id) return fail('YOK', 'Bu oyuncu takımında değil.');
    if (target.id === p.id) fail('GECERSIZ', 'Kendi rolünü değiştiremezsin; liderliği başka birine devret.');
    if (role === 'lider') {
      app.db.run("UPDATE players SET team_role = 'yardimci' WHERE id = ?", p.id);
      app.db.run("UPDATE players SET team_role = 'lider' WHERE id = ?", target.id);
      systemMessage(app, teamRoom(t.id), `${p.name} liderliği ${target.name} adlı üyeye devretti.`);
    } else {
      app.db.run('UPDATE players SET team_role = ? WHERE id = ?', role, target.id);
      systemMessage(app, teamRoom(t.id), role === 'yardimci' ? `${target.name} artık yardımcı.` : `${target.name} artık üye.`);
    }
    broadcastTeam(app, t.id);
    return { team: teamDetail(app, t.id)! };
  },
  'team.help.request': (app, s, { level }) => {
    const { p, t } = requireTeam(app, s.pid);
    if (level > p.highest) fail('GECERSIZ', 'Henüz açılmamış bir bölüm için yardım istenemez.');
    const day = dayKey(app.now());
    if (app.dailyCount(p.id, day, 'help_req') >= HELP_PER_DAY) fail('LIMIT', `Günde en çok ${HELP_PER_DAY} kez yardım isteyebilirsin.`);
    app.dailyInc(p.id, day, 'help_req');
    const id = rid('h');
    app.db.run('INSERT INTO help_requests(id, team_id, from_id, level, max, at) VALUES(?, ?, ?, ?, ?, ?)', id, t.id, p.id, level, SOCIAL_LIMITS.helpMax, app.now());
    const request = toHelp(app, app.db.get<HelpRow>('SELECT * FROM help_requests WHERE id = ?', id)!);
    for (const m of app.teamMemberIds(t.id)) app.emit(m, 'team.help', { request });
    const card = systemMessage(app, teamRoom(t.id), `${p.name} ${level}. bölüm için yardım istiyor.`, 'help', { requestId: id, level, pid: p.id, pname: p.name, pc: p.color, ph: p.hat });
    onHelpCard(app, id, card.id);
    return { request };
  },
  'team.help.give': (app, s, { requestId }) => {
    const { p, t } = requireTeam(app, s.pid);
    const r = app.db.get<HelpRow>('SELECT * FROM help_requests WHERE id = ?', requestId);
    if (!r || r.team_id !== t.id) return fail('YOK', 'Yardım isteği bulunamadı.');
    if (r.at <= app.now() - HELP_TTL_MS) fail('SURE', 'Bu yardım isteğinin süresi doldu.');
    if (r.from_id === p.id) fail('GECERSIZ', 'Kendi isteğine yardım edemezsin.');
    const helpers = parseJson<string[]>(r.helpers, []);
    if (helpers.includes(p.id)) fail('TEKRAR', 'Bu isteğe zaten yardım ettin.');
    if (helpers.length >= r.max) fail('DOLU', 'Bu istek için yeterince yardım toplandı.');
    helpers.push(p.id);
    app.db.run('UPDATE help_requests SET helpers = ? WHERE id = ?', JSON.stringify(helpers), r.id);
    app.addInbox(r.from_id, { kind: 'kalkan', amount: 1, ref: '' }, `${p.name} ${r.level}. bölüm için sana kalkan gönderdi.`);
    app.addCurrency(p.id, 'jeton', HELP_GIVE_JETON);
    app.walletChanged(p.id);
    addContrib(app, t.id, p.id, { helps: 1 });
    broadcastExtra(app, t.id);
    const request = toHelp(app, app.db.get<HelpRow>('SELECT * FROM help_requests WHERE id = ?', r.id)!);
    for (const m of app.teamMemberIds(t.id)) app.emit(m, 'team.help', { request });
    return { request };
  },
};

export const regionIds = new Set(WAR_REGIONS.map((r) => r.id));
