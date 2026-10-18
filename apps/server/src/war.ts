import { SOCIAL_LIMITS, WAR_REGIONS, type RegionScore, type RegionState, type WarState } from '@odi/shared';
import { fail, parseJson, type App, type Handlers } from './app';
import { systemMessage, teamRoom } from './chat';
import { requireTeam } from './teams';

/** hafta sonunda bölge sahibi takımın her üyesine (bölge başına) sabit ödül */
export const WAR_REWARD = { kristal: 50, jeton: 300 } as const;
const REGION_BY_ID = new Map(WAR_REGIONS.map((r) => [r.id, r]));

export function teamTargets(app: App, teamId: string | null): string[] {
  if (!teamId) return [];
  return parseJson<string[]>(app.team(teamId)?.targets ?? '[]', []);
}

/** biyomu eşleşen hedef bölge; yoksa 'merkez' hedefse merkez; yoksa null (puan bölgeye yazılmaz) */
export function regionFor(targets: string[], biome: string): string | null {
  for (const id of targets) if (id !== 'merkez' && REGION_BY_ID.get(id)?.biomes.includes(biome)) return id;
  return targets.includes('merkez') ? 'merkez' : null;
}

interface OwnerRow { team_id: string; points: number }

function announceOwner(app: App, regionId: string, newTeam: string, oldTeam: string | null): void {
  const r = REGION_BY_ID.get(regionId)!;
  const t = app.team(newTeam)!;
  const text = `${t.emblem} ${t.name} takımı ${r.name} bölgesinin başına geçti!`;
  systemMessage(app, teamRoom(newTeam), text, 'war', { region: regionId, team: newTeam });
  if (oldTeam && app.team(oldTeam)) systemMessage(app, teamRoom(oldTeam), text, 'war', { region: regionId, team: newTeam });
  broadcastWar(app);
}

export function broadcastWar(app: App): void {
  app.emitEach([...app.online.keys()], 'war.updated', (pid) => ({ war: warState(app, pid) }));
}

/** sahibi yeniden hesapla (ör. takım silinince) */
export function recomputeOwner(app: App, week: string, region: string): void {
  const top = app.db.get<OwnerRow>('SELECT wp.team_id, wp.points FROM war_points wp JOIN teams t ON t.id = wp.team_id WHERE wp.week = ? AND wp.region = ? ORDER BY wp.points DESC LIMIT 1', week, region);
  if (top) app.db.run('INSERT INTO war_owner(week, region, team_id, points) VALUES(?, ?, ?, ?) ON CONFLICT(week, region) DO UPDATE SET team_id = excluded.team_id, points = excluded.points', week, region, top.team_id, top.points);
  else app.db.run('DELETE FROM war_owner WHERE week = ? AND region = ?', week, region);
}

/** savaş puanı yaz: kişisel + takım haftalık; hedef bölge eşleşirse bölgeye. Sahip ancak geçilince değişir (eşitlikte mevcut sahip kalır). */
export function addWarPoints(app: App, pid: string, teamId: string | null, biome: string, points: number): string | null {
  if (points <= 0) return null;
  const week = app.week().key;
  app.db.run('INSERT INTO player_week(week, player_id, war_points) VALUES(?, ?, ?) ON CONFLICT(week, player_id) DO UPDATE SET war_points = war_points + excluded.war_points', week, pid, points);
  if (!teamId) return null;
  app.db.run('INSERT INTO team_week(week, team_id, points) VALUES(?, ?, ?) ON CONFLICT(week, team_id) DO UPDATE SET points = points + excluded.points', week, teamId, points);
  const region = regionFor(teamTargets(app, teamId), biome);
  if (!region) return null;
  app.db.run('INSERT INTO war_points(week, team_id, region, points) VALUES(?, ?, ?, ?) ON CONFLICT(week, team_id, region) DO UPDATE SET points = points + excluded.points', week, teamId, region, points);
  const mine = app.db.get<{ points: number }>('SELECT points FROM war_points WHERE week = ? AND team_id = ? AND region = ?', week, teamId, region)!.points;
  const owner = app.db.get<OwnerRow>('SELECT team_id, points FROM war_owner WHERE week = ? AND region = ?', week, region);
  if (owner?.team_id === teamId) app.db.run('UPDATE war_owner SET points = ? WHERE week = ? AND region = ?', mine, week, region);
  else if (!owner || mine > owner.points || !app.team(owner.team_id)) {
    app.db.run('INSERT INTO war_owner(week, region, team_id, points) VALUES(?, ?, ?, ?) ON CONFLICT(week, region) DO UPDATE SET team_id = excluded.team_id, points = excluded.points', week, region, teamId, mine);
    announceOwner(app, region, teamId, owner?.team_id ?? null);
  }
  return region;
}

export function warState(app: App, pid: string): WarState {
  const w = app.week();
  const p = app.player(pid);
  const regions: RegionState[] = WAR_REGIONS.map((r) => {
    const top = app.db.all<RegionScore>('SELECT wp.team_id AS teamId, t.name, t.emblem, wp.points FROM war_points wp JOIN teams t ON t.id = wp.team_id WHERE wp.week = ? AND wp.region = ? ORDER BY wp.points DESC LIMIT 5', w.key, r.id).map((x) => ({ ...x }));
    const o = app.db.get<RegionScore>('SELECT o.team_id AS teamId, t.name, t.emblem, o.points FROM war_owner o JOIN teams t ON t.id = o.team_id WHERE o.week = ? AND o.region = ?', w.key, r.id);
    return { id: r.id, name: r.name, biomes: [...r.biomes], owner: o ? { ...o } : null, top };
  });
  const teamPoints = p.team_id ? app.db.get<{ points: number }>('SELECT points FROM team_week WHERE week = ? AND team_id = ?', w.key, p.team_id)?.points ?? 0 : 0;
  const myPoints = app.db.get<{ war_points: number }>('SELECT war_points FROM player_week WHERE week = ? AND player_id = ?', w.key, pid)?.war_points ?? 0;
  return { week: w.key, startsAt: w.startsAt, endsAt: w.endsAt, regions, targets: teamTargets(app, p.team_id), teamPoints, myPoints };
}

/** hafta kapanışı: bölge sahibi takımların üyelerine ödül kutusu (puanlar hafta anahtarıyla tutulduğundan kendiliğinden sıfırlanır) */
export function warRollover(app: App, oldWeek: string): void {
  const owners = app.db.all<{ region: string; team_id: string }>('SELECT o.region, o.team_id FROM war_owner o JOIN teams t ON t.id = o.team_id WHERE o.week = ?', oldWeek);
  for (const o of owners) {
    const region = REGION_BY_ID.get(o.region)?.name ?? o.region;
    const reason = `Bölge Savaşı ${oldWeek}: ${region} bölgesi sizin`;
    for (const m of app.teamMemberIds(o.team_id)) {
      app.addInbox(m, { kind: 'kristal', amount: WAR_REWARD.kristal, ref: o.region }, reason);
      app.addInbox(m, { kind: 'jeton', amount: WAR_REWARD.jeton, ref: o.region }, reason);
    }
    systemMessage(app, teamRoom(o.team_id), `Bölge Savaşı bitti: ${region} bölgesini kazandınız! Ödüller ödül kutunuzda.`, 'war', { region: o.region, week: oldWeek });
  }
}

export const warHandlers: Handlers = {
  'war.state': (app, s) => ({ war: warState(app, s.pid) }),
  'war.targets': (app, s, { regions }) => {
    const { p, t } = requireTeam(app, s.pid);
    if (p.team_role === 'uye') fail('YETKI', 'Savaş hedeflerini lider ya da yardımcı seçebilir.');
    const uniq = [...new Set(regions)];
    if (uniq.length > SOCIAL_LIMITS.targetsMax) fail('GECERSIZ', `En çok ${SOCIAL_LIMITS.targetsMax} hedef bölge seçilebilir.`);
    for (const r of uniq) if (!REGION_BY_ID.has(r)) fail('GECERSIZ', 'Bilinmeyen bölge.');
    app.db.run('UPDATE teams SET targets = ? WHERE id = ?', JSON.stringify(uniq), t.id);
    const names = uniq.map((r) => REGION_BY_ID.get(r)!.name).join(', ') || 'yok';
    systemMessage(app, teamRoom(t.id), `${p.name} savaş hedeflerini belirledi: ${names}.`, 'war');
    app.emitEach(app.teamMemberIds(t.id), 'war.updated', (pid) => ({ war: warState(app, pid) }));
    return { war: warState(app, s.pid) };
  },
};
