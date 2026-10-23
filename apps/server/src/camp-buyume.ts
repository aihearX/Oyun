/**
 * Kamp büyümesi işlemleri (docs/14-kamp.md §10–12): süs yerleştirme / taşıma / kaldırma, Kütüphane okuma köşesi, kamp ziyareti
 * ve hazır tepki (alkış). Ziyaret yalnız arkadaşlar ve takım arkadaşları arasındadır; engel varsa görünmez.
 */
import { BUILDINGS, type CampVisit, type CheerKind } from '@odi/shared';
import { CAMP_XP, LIB_XP_PER_LEVEL_HOUR, cellFree, decorById, footprint, libStored } from '@odi/content';
import { fail, type App, type Handlers } from './app';
import { campState, completeDue } from './camp';
import { campLevelOf, campXpOf, cheersOf, decorCap, grantCampXp, libAtOf, placedDecor } from './camp-xp';
import { areFriends, isBlocked, sameTeam } from './friends';
import { dayKey, HOUR_MS } from './time';

/** süsün kapladığı hücreler boş mu (arazi açık, arsa/anıt dışında, başka süs yok) */
function spotOk(app: App, pid: string, id: string, gx: number, gy: number, except?: number): boolean {
  const def = decorById(id); if (!def) return false;
  const lv = campLevelOf(app, pid);
  const taken = new Set<string>();
  for (const p of placedDecor(app, pid)) { if (p.uid === except) continue; for (const [x, y] of footprint(p.gx, p.gy, decorById(p.id)?.size ?? 1)) taken.add(`${x},${y}`); }
  return footprint(gx, gy, def.size).every(([x, y]) => cellFree(x, y, lv) && !taken.has(`${x},${y}`));
}

function visitOf(app: App, viewer: string, target: string): CampVisit {
  if (viewer === target) fail('GECERSIZ', 'Kendi kampını Kamp sekmesinde görürsün.');
  const a = app.player(viewer); const b = app.playerOrNull(target);
  if (!b) return fail('YOK', 'Oyuncu bulunamadı.');
  if (isBlocked(app, viewer, target)) fail('YETKI', 'Bu kampı göremezsin.');
  const relation = areFriends(app, viewer, target) ? 'arkadas' : sameTeam(app, a, b) ? 'takim' : null;
  if (!relation) fail('YETKI', 'Yalnız arkadaşlarının ve takım arkadaşlarının kampını gezebilirsin.');
  completeDue(app, target);
  const lv = new Map(app.db.all<{ id: string; level: number }>('SELECT id, level FROM buildings WHERE player_id = ?', target).map((r) => [r.id, r.level]));
  const today = app.db.get<{ kind: CheerKind }>('SELECT kind FROM camp_cheers WHERE from_id = ? AND to_id = ? AND day = ?', viewer, target, dayKey(app.now()));
  const team = b.team_id ? app.db.get<{ name: string; emblem: string }>('SELECT name, emblem FROM teams WHERE id = ?', b.team_id) ?? null : null;
  return {
    id: b.id, name: b.name, color: b.color, hat: b.hat, relation: relation!,
    xp: campXpOf(app, target),
    buildings: BUILDINGS.map((d) => ({ id: d.id, level: lv.get(d.id) ?? 0 })),
    decor: placedDecor(app, target), highest: b.highest, cheers: cheersOf(app, target),
    cheeredToday: today?.kind ?? null, team: team ? { name: team.name, emblem: team.emblem } : null,
  };
}

export const campGrowthHandlers: Handlers = {
  'camp.decor.place': (app, s, { id, gx, gy, flip }) => {
    completeDue(app, s.pid);
    const def = decorById(id); if (!def) fail('YOK', 'Bu süs bilinmiyor.');
    const have = app.db.get<{ n: number }>('SELECT n FROM decor_inv WHERE player_id = ? AND id = ?', s.pid, id)?.n ?? 0;
    if (have <= 0) fail('YOK', 'Bu süs envanterinde yok.');
    const placed = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM decor_placed WHERE player_id = ?', s.pid)!.n;
    if (placed >= decorCap(app, s.pid)) fail('DOLU', 'Süs yerin doldu. Kamp Seviyesi ve Rehabilitasyon Parkı yeni yer açar; birini depoya kaldırabilirsin.');
    if (!spotOk(app, s.pid, id, gx, gy)) fail('YER', 'Buraya konamaz: boş ve açık bir araziye yerleştir.');
    app.db.run('UPDATE decor_inv SET n = n - 1 WHERE player_id = ? AND id = ?', s.pid, id);
    app.db.run('INSERT INTO decor_placed(player_id, id, gx, gy, flip, at) VALUES(?, ?, ?, ?, ?, ?)', s.pid, id, gx, gy, flip ? 1 : 0, app.now());
    grantCampXp(app, s.pid, CAMP_XP.decorFirst, `İlk kez: ${def!.name}`, `sus-ilk:${id}`, { silent: true });
    return { camp: campState(app, s.pid) };
  },
  'camp.decor.move': (app, s, { uid, gx, gy, flip }) => {
    const r = app.db.get<{ id: string; flip: number }>('SELECT id, flip FROM decor_placed WHERE uid = ? AND player_id = ?', uid, s.pid);
    if (!r) return fail('YOK', 'Süs bulunamadı.');
    if (!spotOk(app, s.pid, r.id, gx, gy, uid)) fail('YER', 'Buraya konamaz: boş ve açık bir araziye yerleştir.');
    app.db.run('UPDATE decor_placed SET gx = ?, gy = ?, flip = ? WHERE uid = ?', gx, gy, flip === undefined ? r.flip : flip ? 1 : 0, uid);
    return { camp: campState(app, s.pid) };
  },
  'camp.decor.store': (app, s, { uid }) => {
    const r = app.db.get<{ id: string }>('SELECT id FROM decor_placed WHERE uid = ? AND player_id = ?', uid, s.pid);
    if (!r) return fail('YOK', 'Süs bulunamadı.');
    app.db.run('DELETE FROM decor_placed WHERE uid = ?', uid);
    // depoya geri: envanter sınırı yerleştirilmiş süsü kaybettirmez
    app.db.run('INSERT INTO decor_inv(player_id, id, n) VALUES(?, ?, 1) ON CONFLICT(player_id, id) DO UPDATE SET n = n + 1', s.pid, r.id);
    return { camp: campState(app, s.pid) };
  },
  'camp.lib.collect': (app, s) => {
    completeDue(app, s.pid);
    const level = app.db.get<{ level: number }>('SELECT level FROM buildings WHERE player_id = ? AND id = ?', s.pid, 'kutuphane')?.level ?? 0;
    if (level <= 0) fail('SART', 'Önce Odyoloji Kütüphanesi’ni kur.');
    const now = app.now(); const since = libAtOf(app, s.pid) || now;
    const st = libStored(level, since, now);
    if (st.stored <= 0) return { camp: campState(app, s.pid), xp: 0 };
    const rate = level * LIB_XP_PER_LEVEL_HOUR;
    const next = st.ratio >= 1 ? now : since + Math.round((st.stored / rate) * HOUR_MS);
    app.db.run('UPDATE camp_xp SET lib_at = ? WHERE player_id = ?', next, s.pid);
    const g = grantCampXp(app, s.pid, st.stored, 'Kütüphane', undefined, { silent: true });
    return { camp: campState(app, s.pid), xp: g.gained };
  },
  'camp.visit': (app, s, { playerId }) => ({ visit: visitOf(app, s.pid, playerId) }),
  'camp.cheer': (app, s, { playerId, kind }) => {
    visitOf(app, s.pid, playerId); // izin denetimi
    const day = dayKey(app.now());
    if (app.db.run('INSERT OR IGNORE INTO camp_cheers(from_id, to_id, day, kind, at) VALUES(?, ?, ?, ?, ?)', s.pid, playerId, day, kind, app.now()) === 0) fail('TEKRAR', 'Bugün bu kampa zaten tepki bıraktın. Yarın yine gelebilirsin.');
    let xp = 0;
    if (app.dailyInc(s.pid, day, 'kamp_alkis_ver') <= CAMP_XP.cheerGiveDaily) xp = grantCampXp(app, s.pid, CAMP_XP.cheerGive, 'Kamp ziyareti').gained;
    if (app.dailyInc(playerId, day, 'kamp_alkis_al') <= CAMP_XP.cheerGotDaily) grantCampXp(app, playerId, CAMP_XP.cheerGot, 'Alkış aldın');
    app.emit(playerId, 'camp.cheered', { from: s.pid, name: app.player(s.pid).name, kind: kind as CheerKind });
    return { visit: visitOf(app, s.pid, playerId), xp };
  },
};
