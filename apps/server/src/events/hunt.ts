import type { EventReward, HuntState, HuntTier } from '@odi/shared';
import type { App, Grant, Handlers } from '../app';
import { systemMessage, teamRoom } from '../chat';
import { createGift } from '../teamextra';
import { requireTeam } from '../teams';
import { hash32, huntPeriods, memberCount, notify, rw } from './common';
import { questProgress } from './quests';

/** Ses Avı: üyelerin normal bölümlerde topladığı notalar (bölüm jetonları) ortak melodiye katılır. 8 kademe, her kademe tüm üyelere hediye. */
export const HUNT_TIERS = 8;
export const huntTarget = (members: number) => Math.max(600, 250 * members);
export function huntTierReward(k: number): EventReward[] {
  if (k >= HUNT_TIERS) return rw(150, 30, [{ kind: 'kalkan', amount: 2, ref: 'avi' }]);
  return rw(30 + 10 * k, k === 4 || k === 7 ? 10 : 0);
}
/** takımın kısa özgün şarkısı: pentatonik dizide sabit (takım + dönem) rastgele yürüyüş; yarım ton (C5 = 0) */
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19];
export function huntSong(teamId: string, period: string): number[] {
  let h = hash32(`sarki:${teamId}:${period}`);
  let i = 4; const out: number[] = [];
  for (let n = 0; n < 12; n++) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    i = Math.max(0, Math.min(SCALE.length - 1, i + ((h % 5) - 2)));
    out.push(SCALE[i]!);
  }
  out[out.length - 1] = SCALE[h % 2 ? 0 : 5]!; // kök notada bitsin
  return out;
}

const row = (app: App, period: string, teamId: string) => app.db.get<{ target: number; progress: number }>('SELECT target, progress FROM ev_hunt WHERE period = ? AND team_id = ?', period, teamId);
function ensure(app: App, period: string, teamId: string): { target: number; progress: number } {
  const r = row(app, period, teamId);
  if (r) return r;
  app.db.run('INSERT INTO ev_hunt(period, team_id, target) VALUES(?, ?, ?)', period, teamId, huntTarget(memberCount(app, teamId)));
  return row(app, period, teamId)!;
}
const needFor = (target: number, k: number) => Math.round((target * k) / HUNT_TIERS);

export function huntState(app: App, teamId: string): HuntState {
  const { cur, next } = huntPeriods(app);
  const t = app.team(teamId);
  const songName = `${t?.name ?? 'Takım'} Ezgisi`;
  if (!cur) return { period: null, next, target: huntTarget(memberCount(app, teamId)), progress: 0, tiers: [], song: null, songName, contributors: [] };
  const r = ensure(app, cur.key, teamId);
  const tiers: HuntTier[] = Array.from({ length: HUNT_TIERS }, (_, i) => ({ need: needFor(r.target, i + 1), reward: huntTierReward(i + 1), reached: r.progress >= needFor(r.target, i + 1) }));
  const contributors = app.db.all<{ id: string; name: string; notes: number }>(
    'SELECT p.id, p.name, c.notes FROM ev_hunt_contrib c JOIN players p ON p.id = c.player_id WHERE c.period = ? AND c.team_id = ? ORDER BY c.notes DESC LIMIT 10', cur.key, teamId).map((x) => ({ ...x }));
  return { period: cur, next, target: r.target, progress: Math.min(r.progress, r.target), tiers, song: r.progress >= r.target ? huntSong(teamId, cur.key) : null, songName, contributors };
}

/** progress.submit kancası: bölüm jetonları notaya dönüşür */
export function addHuntNotes(app: App, teamId: string, pid: string, notes: number): void {
  const { cur } = huntPeriods(app);
  if (!cur || notes <= 0) return;
  const r = ensure(app, cur.key, teamId);
  const before = r.progress; const after = before + notes;
  app.db.run('UPDATE ev_hunt SET progress = ? WHERE period = ? AND team_id = ?', after, cur.key, teamId);
  app.db.run('INSERT INTO ev_hunt_contrib(period, team_id, player_id, notes) VALUES(?, ?, ?, ?) ON CONFLICT(period, team_id, player_id) DO UPDATE SET notes = notes + excluded.notes', cur.key, teamId, pid, notes);
  questProgress(app, teamId, 'avi', notes);
  for (let k = 1; k <= HUNT_TIERS; k++) {
    const need = needFor(r.target, k);
    if (before < need && after >= need) {
      const members = app.teamMemberIds(teamId);
      const full = k === HUNT_TIERS;
      createGift(app, teamId, { id: 'sistem', name: 'Ses Avı' }, full ? 'Ses Avı tamam: melodi sandığı' : `Ses Avı ${k}. nota kademesi`, huntTierReward(k) as Grant[], members, { expiresAt: Math.max(cur.endsAt, app.now() + 86_400_000) });
      systemMessage(app, teamRoom(teamId), full ? '🎶 Melodi tamamlandı! Takım şarkınız açıldı, melodi sandığı herkesin hediye kutusunda.' : `🎵 Ses Avı: ${k}/${HUNT_TIERS} nota kademesi doldu! Hediye kutunuza bakın.`, 'system', { event: 'avi' });
      notify(app, members, { kind: 'avi', icon: full ? '🎶' : '🎵', title: full ? 'Takım şarkısı açıldı!' : `Melodi ${k}/${HUNT_TIERS}`, text: full ? 'Melodi sandığı hediye kutusunda. Şarkınızı dinleyin!' : 'Yeni kademe ödülü hediye kutusunda.', target: 'avi' });
    }
  }
  const hunt = huntState(app, teamId);
  app.emitEach(app.teamMemberIds(teamId), 'hunt.updated', () => ({ hunt }));
}

export const huntHandlers: Handlers = {
  'hunt.state': (app, s) => { const { t } = requireTeam(app, s.pid); return { hunt: huntState(app, t.id) }; },
};
