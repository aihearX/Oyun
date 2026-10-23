/**
 * Kamp Seviyesi, Kamp XP ve süsleme envanteri (docs/14-kamp.md §8, §10, §12). Dışa açık API:
 *
 *   grantCampXp(app, pid, amount, reason, ref?)  → Kamp XP verir (Akustik Kabin bonusu eklenir; ref verilirse bir kez)
 *   grantDecoration(app, pid, id, n?, ref?)      → envantere süs ekler (DECORATIONS kimliği; ref verilirse bir kez)
 *
 * İkisi de çağıranın işleminde (app.run) çalışır, seviye ödüllerini bir kez verir ve işlem bitince `camp.updated` iter
 * (opts.silent ile kapatılır). Görev sistemi gibi başka sistemler yalnız bu iki işlevi çağırır.
 */
import { BUILDINGS, type BuildingId, type CampDecorState, type CampXpState, type DecorPlaced } from '@odi/shared';
import { CAMP_XP, DECOR_INV_CAP, HUMAN_JOURNEY, MONUMENT_DECOR, campLevelRewards, campXpState, decorById, decorSlots, kabinXpPct } from '@odi/content';
import type { App } from './app';

const bLevel = (app: App, pid: string, id: BuildingId) => app.db.get<{ level: number }>('SELECT level FROM buildings WHERE player_id = ? AND id = ?', pid, id)?.level ?? 0;

/** kamp durumu değişti bildirimi (camp.ts kurar: camp.updated itmesi) */
let changed: (app: App, pid: string) => void = () => undefined;
export function onCampChanged(fn: (app: App, pid: string) => void): void { changed = fn; }

/** istemcinin anladığı kamp sürümü (çevrimiçi bağlantısından; çevrimdışıysa 0) */
export const campVOf = (app: App, pid: string): number => app.online.get(pid)?.campV ?? 0;

/**
 * Kamp XP satırı yoksa oluşturur. Geriye dönük: var olan bina seviyeleri kadar XP ile başlar (eski oyuncu emeğini kaybetmez).
 * İnşaat bitişinde seviye yazılmadan ÖNCE çağrılmalı (completeDue bunu yapar), yoksa yeni seviye iki kez sayılır.
 */
export function ensureCampXp(app: App, pid: string): number {
  const r = app.db.get<{ xp: number }>('SELECT xp FROM camp_xp WHERE player_id = ?', pid);
  if (r) return r.xp;
  let xp = 0;
  for (const b of app.db.all<{ id: BuildingId; level: number }>('SELECT id, level FROM buildings WHERE player_id = ?', pid)) {
    if (!BUILDINGS.some((d) => d.id === b.id)) continue;
    for (let l = 1; l <= b.level; l++) xp += CAMP_XP.build(b.id, l);
  }
  // Merkez Sv 1 başlangıçta verilir; onun XP'si sayılmaz (yeni oyuncu Sv 1, 0 XP)
  xp = Math.max(0, xp - CAMP_XP.build('merkez', 1));
  const lib = bLevel(app, pid, 'kutuphane') > 0 ? app.now() : 0;
  app.db.run('INSERT OR IGNORE INTO camp_xp(player_id, xp, lib_at) VALUES(?, ?, ?)', pid, xp, lib);
  return xp;
}
export function campXpOf(app: App, pid: string): CampXpState { return campXpState(ensureCampXp(app, pid)); }
export const campLevelOf = (app: App, pid: string): number => campXpOf(app, pid).level;

export interface CampXpGrant { gained: number; level: number; /** bu verişle ulaşılan yeni seviyeler */ levelsUp: number[] }
/**
 * Kamp XP ver. amount: taban miktar (Akustik Kabin +%3/Sv eklenir). ref: verilirse (ör. `gorev:<id>`) aynı ref ikinci kez XP vermez.
 * reason: kısa açıklama (günlükte). Seviye atlanırsa o seviyelerin süs/kozmetik ödülleri bir kez verilir.
 */
export function grantCampXp(app: App, pid: string, amount: number, reason: string, ref?: string, opts: { silent?: boolean } = {}): CampXpGrant {
  const base = Math.max(0, Math.floor(amount));
  const before = campXpOf(app, pid);
  if (!base) return { gained: 0, level: before.level, levelsUp: [] };
  const gained = Math.round(base * (1 + kabinXpPct(bLevel(app, pid, 'kabin')) / 100));
  if (ref && app.db.run('INSERT OR IGNORE INTO camp_xp_log(player_id, ref, amount, reason, at) VALUES(?, ?, ?, ?, ?)', pid, ref, gained, reason.slice(0, 80), app.now()) === 0) {
    return { gained: 0, level: before.level, levelsUp: [] };
  }
  app.db.run('UPDATE camp_xp SET xp = xp + ? WHERE player_id = ?', gained, pid);
  const after = campXpState(before.total + gained);
  const levelsUp: number[] = [];
  for (let l = before.level + 1; l <= after.level; l++) { levelsUp.push(l); applyLevelRewards(app, pid, l); }
  if (!opts.silent) app.after(() => changed(app, pid));
  return { gained, level: after.level, levelsUp };
}

/** bir seviyenin süs ve kozmetik ödülleri (bir kez; camp_unlocks `kseviye:<L>`) — arazi, bina, çanta, unvan, süs yeri seviyeden hesaplanır */
function applyLevelRewards(app: App, pid: string, level: number): void {
  if (app.db.run('INSERT OR IGNORE INTO camp_unlocks(player_id, ref, at) VALUES(?, ?, ?)', pid, `kseviye:${level}`, app.now()) === 0) return;
  for (const r of campLevelRewards(level)) {
    if (r.kind === 'sus') addDecor(app, pid, r.id, r.n);
    else if (r.kind === 'kozmetik') app.grant(pid, { kind: 'kozmetik', amount: 1, ref: r.id });
  }
}

function addDecor(app: App, pid: string, id: string, n: number): number {
  if (!decorById(id) || n <= 0) return 0;
  const have = app.db.get<{ n: number }>('SELECT n FROM decor_inv WHERE player_id = ? AND id = ?', pid, id)?.n ?? 0;
  const add = Math.max(0, Math.min(Math.floor(n), DECOR_INV_CAP - have));
  if (add > 0) app.db.run('INSERT INTO decor_inv(player_id, id, n) VALUES(?, ?, ?) ON CONFLICT(player_id, id) DO UPDATE SET n = n + excluded.n', pid, id, add);
  return add;
}
/**
 * Envantere süs ekle (DECORATIONS kimliği; bilinmeyen kimlik 0 döner). Envanterde bir süsten en çok DECOR_INV_CAP durur.
 * ref verilirse (ör. `gorev:<id>`) aynı ref ikinci kez süs vermez. Dönüş: eklenen adet.
 */
export function grantDecoration(app: App, pid: string, id: string, n = 1, ref?: string, opts: { silent?: boolean } = {}): number {
  if (!decorById(id)) return 0;
  if (ref && app.db.run('INSERT OR IGNORE INTO camp_unlocks(player_id, ref, at) VALUES(?, ?, ?)', pid, `sus:${ref}`, app.now()) === 0) return 0;
  const add = addDecor(app, pid, id, n);
  if (add > 0 && !opts.silent) app.after(() => changed(app, pid));
  return add;
}

/**
 * Kamp açılınca (camp.state) eşitleme: seviye ödülleri (Sv 1 dahil), ulaşılan bölgelerin anıt XP'si ve anıt süsü — hepsi bir kez.
 */
export function syncCampRewards(app: App, pid: string): void {
  const lv = campXpOf(app, pid).level;
  for (let l = 1; l <= lv; l++) applyLevelRewards(app, pid, l);
  const highest = app.player(pid).highest;
  const regions = [...new Set(HUMAN_JOURNEY.levels.slice(0, Math.max(0, Math.min(HUMAN_JOURNEY.levels.length, highest))).map((l) => l.biome as string))];
  for (const r of regions) {
    grantCampXp(app, pid, CAMP_XP.monument, `Anıt: ${r}`, `anit:${r}`, { silent: true });
    const d = MONUMENT_DECOR[r]; if (d) grantDecoration(app, pid, d.id, d.n, `anit:${r}`, { silent: true });
  }
}

export function placedDecor(app: App, pid: string): DecorPlaced[] {
  return app.db.all<{ uid: number; id: string; gx: number; gy: number; flip: number }>('SELECT uid, id, gx, gy, flip FROM decor_placed WHERE player_id = ? ORDER BY uid', pid)
    .filter((r) => decorById(r.id)).map((r) => ({ uid: r.uid, id: r.id, gx: r.gx, gy: r.gy, flip: !!r.flip }));
}
export function decorCap(app: App, pid: string): number { return decorSlots(campLevelOf(app, pid), bLevel(app, pid, 'park')); }
export function decorState(app: App, pid: string): CampDecorState {
  const inv: Record<string, number> = {};
  for (const r of app.db.all<{ id: string; n: number }>('SELECT id, n FROM decor_inv WHERE player_id = ? AND n > 0', pid)) if (decorById(r.id)) inv[r.id] = r.n;
  return { inv, placed: placedDecor(app, pid), cap: decorCap(app, pid) };
}
export const libAtOf = (app: App, pid: string): number => { ensureCampXp(app, pid); return app.db.get<{ lib_at: number }>('SELECT lib_at FROM camp_xp WHERE player_id = ?', pid)?.lib_at ?? 0; };
export const cheersOf = (app: App, pid: string): number => app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM camp_cheers WHERE to_id = ?', pid)?.n ?? 0;
