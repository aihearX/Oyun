import { COMM_RULES, type DuoInvite, type DuoMember, type DuoState, type PublicProfile } from '@odi/shared';
import { fail, rid, type App } from '../app';
import { areFriends } from '../chat';
import { isBlocked } from '../friends';
import { dayKey } from '../time';
import { commNotice, metric } from './settings';

/**
 * İkili Görev: bir arkadaşla haftalık (ISO hafta, İstanbul) ortak nota hedefi. Notalar = sunucuya giden bölüm jetonu
 * (Ses Avı ile aynı ölçü). Kademe dolunca ikisine de sabit ödül (ödül kutusu), her kademe bir kez.
 */
interface DuoRow { id: string; week: string; a: string; b: string; created_at: number }
interface InvRow { id: string; week: string; from_id: string; to_id: string; at: number }

const activeOf = (app: App, pid: string, week = app.week().key) => app.db.get<DuoRow>('SELECT * FROM duo WHERE week = ? AND (a = ? OR b = ?)', week, pid, pid) ?? null;
const pub = (app: App, id: string): PublicProfile | null => { const p = app.playerOrNull(id); return p ? app.publicProfile(p) : null; };

export function duoState(app: App, pid: string): DuoState {
  const w = app.week();
  const d = activeOf(app, pid, w.key);
  let active: DuoState['active'] = null;
  if (d) {
    const notes = new Map(app.db.all<{ player_id: string; notes: number }>('SELECT player_id, notes FROM duo_notes WHERE duo_id = ?', d.id).map((r) => [r.player_id, r.notes]));
    const members: DuoMember[] = [d.a, d.b].map((id) => { const p = app.playerOrNull(id); return { id, name: p?.name ?? '?', color: p?.color ?? 0x7c5cff, hat: p?.hat ?? '', notes: notes.get(id) ?? 0, online: app.online.has(id) }; });
    const progress = members.reduce((a, m) => a + m.notes, 0);
    active = { id: d.id, members, progress, tiers: COMM_RULES.duoTiers.map((t) => ({ need: t.need, reward: [...t.reward], reached: progress >= t.need })) };
  }
  const inv = (r: InvRow): DuoInvite | null => { const from = pub(app, r.from_id); const to = pub(app, r.to_id); return from && to ? { id: r.id, from, to, at: r.at } : null; };
  const incoming = app.db.all<InvRow>('SELECT * FROM duo_invites WHERE week = ? AND to_id = ? ORDER BY at DESC', w.key, pid).map(inv).filter(Boolean) as DuoInvite[];
  const outgoing = app.db.all<InvRow>('SELECT * FROM duo_invites WHERE week = ? AND from_id = ? ORDER BY at DESC', w.key, pid).map(inv).filter(Boolean) as DuoInvite[];
  const candidates = d ? [] : app.db.all<{ b: string }>('SELECT b FROM friends WHERE a = ?', pid).map((r) => r.b)
    .filter((id) => !activeOf(app, id, w.key) && !outgoing.some((o) => o.to.id === id)).map((id) => pub(app, id)).filter(Boolean)
    .sort((x, y) => Number(y!.online) - Number(x!.online)).slice(0, 30) as PublicProfile[];
  return { week: w.key, endsAt: w.endsAt, active, incoming, outgoing, candidates, tiers: COMM_RULES.duoTiers.map((t) => ({ need: t.need, reward: [...t.reward] })) };
}
const push = (app: App, ...ids: string[]) => { for (const id of ids) app.emitEach([id], 'duo.updated', (p) => ({ duo: duoState(app, p) })); };

export function duoInvite(app: App, pid: string, friendId: string): DuoState {
  if (friendId === pid) fail('GECERSIZ', 'Kendini davet edemezsin.');
  const other = app.playerOrNull(friendId);
  if (!other) return fail('YOK', 'Oyuncu bulunamadı.');
  if (isBlocked(app, pid, friendId)) fail('ENGEL', 'Bu oyuncu davet edilemiyor.');
  if (!areFriends(app, pid, friendId)) fail('YETKI', 'İkili Görev yalnızca arkadaşla yapılır; önce arkadaş ol.');
  const week = app.week().key;
  if (activeOf(app, pid, week)) fail('TEKRAR', 'Bu hafta zaten bir İkili Görevin var.');
  if (activeOf(app, friendId, week)) fail('DOLU', `${other.name} bu hafta başka biriyle görevde.`);
  // karşı taraf beni zaten davet ettiyse: kabul say
  const back = app.db.get<InvRow>('SELECT * FROM duo_invites WHERE week = ? AND from_id = ? AND to_id = ?', week, friendId, pid);
  if (back) return duoRespond(app, pid, back.id, true);
  const day = dayKey(app.now());
  if (app.dailyCount(pid, day, 'duo_inv') >= COMM_RULES.duoInvitesPerDay) fail('LIMIT', `Günde en çok ${COMM_RULES.duoInvitesPerDay} İkili Görev daveti gönderebilirsin.`);
  if (!app.db.run('INSERT OR IGNORE INTO duo_invites(id, week, from_id, to_id, at) VALUES(?, ?, ?, ?, ?)', rid('u'), week, pid, friendId, app.now())) fail('TEKRAR', 'Bu arkadaşını zaten davet ettin.');
  app.dailyInc(pid, day, 'duo_inv');
  metric(app, 'duo.invite');
  const me = app.player(pid);
  commNotice(app, friendId, { kind: 'duo', title: `${me.name} seni İkili Göreve çağırıyor`, text: `Bu hafta birlikte ${COMM_RULES.duoTiers[0].need} nota toplayın, sandığı birlikte açın.`, from: app.publicProfile(me) });
  push(app, friendId);
  return duoState(app, pid);
}

export function duoRespond(app: App, pid: string, inviteId: string, accept: boolean): DuoState {
  const r = app.db.get<InvRow>('SELECT * FROM duo_invites WHERE id = ?', inviteId);
  if (!r || (r.to_id !== pid && r.from_id !== pid)) return fail('YOK', 'Davet bulunamadı.');
  app.db.run('DELETE FROM duo_invites WHERE id = ?', r.id);
  if (!accept || r.from_id === pid) { push(app, r.from_id === pid ? r.to_id : r.from_id); return duoState(app, pid); } // ret ya da iptal: sessiz
  if (r.week !== app.week().key) fail('SURE', 'Bu davet geçen haftadan kaldı.');
  if (activeOf(app, r.from_id) || activeOf(app, r.to_id)) fail('DOLU', 'İkinizden biri bu hafta başka bir görevde.');
  if (isBlocked(app, r.from_id, r.to_id)) fail('ENGEL', 'Bu davet artık geçerli değil.');
  const id = rid('w');
  app.db.run('INSERT INTO duo(id, week, a, b, created_at) VALUES(?, ?, ?, ?, ?)', id, r.week, r.from_id, r.to_id, app.now());
  // ikisinin de bu haftaki diğer davetleri düşer
  app.db.run('DELETE FROM duo_invites WHERE week = ? AND (from_id IN (?, ?) OR to_id IN (?, ?))', r.week, r.from_id, r.to_id, r.from_id, r.to_id);
  const me = app.player(pid);
  commNotice(app, r.from_id, { kind: 'duo', title: `${me.name} İkili Görevi kabul etti`, text: 'Bu hafta notalarınız birlikte sayılıyor.', from: app.publicProfile(me) });
  push(app, r.from_id);
  return duoState(app, pid);
}

/** bölüm sonucu: notalar ortak hedefe; dolan kademe ikisine de bir kez */
export function duoAddNotes(app: App, pid: string, notes: number): void {
  if (notes <= 0) return;
  const d = activeOf(app, pid); if (!d) return;
  app.db.run('INSERT INTO duo_notes(duo_id, player_id, notes) VALUES(?, ?, ?) ON CONFLICT(duo_id, player_id) DO UPDATE SET notes = notes + excluded.notes', d.id, pid, Math.round(notes));
  const total = app.db.get<{ n: number }>('SELECT COALESCE(SUM(notes), 0) AS n FROM duo_notes WHERE duo_id = ?', d.id)!.n;
  COMM_RULES.duoTiers.forEach((t, i) => {
    if (total < t.need || !app.db.run('INSERT OR IGNORE INTO duo_tiers(duo_id, tier, at) VALUES(?, ?, ?)', d.id, i, app.now())) return;
    metric(app, 'duo.tier');
    const names = [d.a, d.b].map((x) => app.playerOrNull(x)?.name ?? '?');
    for (const m of [d.a, d.b]) {
      for (const g of t.reward) app.addInbox(m, { kind: g.kind, amount: g.amount, ref: g.ref }, `İkili Görev: ${t.need} nota (${names.join(' + ')})`);
      commNotice(app, m, { kind: 'duo', title: 'İkili Görev sandığı açıldı!', text: `${names.join(' ve ')} birlikte ${t.need} notaya ulaştı. Ödül kutuna bak.` });
    }
  });
  push(app, d.a, d.b);
}
