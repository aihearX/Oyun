/**
 * Kamp büyümesi sistemiyle (Kamp Seviyesi, Kamp XP, dekor yerleştirme, kamp ziyareti — ayrı ekip) bağlantı noktası.
 * Görev ödüllerindeki Kamp XP ve dekorlar önce kg_pending tablosuna yazılır (bir kez, ref ile); büyüme sistemi bağlıysa hemen
 * uygulanır, değilse bekler ve sistem gelince `applyPending` ile bir kez uygulanır. Böylece hiçbir ödül kaybolmaz ve iki kez verilmez.
 */
import { decorById } from '@odi/content';
import type { App } from './app';
import { campLevelOf, grantCampXp, grantDecoration, placedDecor } from './camp-xp';

export interface GrowthApi {
  /** Kamp XP ver (büyüme sistemi) */
  grantCampXp(app: App, pid: string, amount: number, reason: string): void;
  /** dekor ver; katalogda yoksa false (bekler) */
  grantDecoration(app: App, pid: string, id: string): boolean;
  /** Kamp Seviyesi */
  campLevel(app: App, pid: string): number;
  /** yerleştirilmiş dekor sayısı */
  decorCount(app: App, pid: string): number;
}
/** kamp büyümesi işlemleri → görev sayaçları (işlem adı → sayaç); işlem sunucuda varsa camp-quests.ts sarar */
export const GROWTH_OP_METRICS: Record<string, 'dekor-yerlestir' | 'ziyaret'> = { 'camp.decor.place': 'dekor-yerlestir', 'camp.visit': 'ziyaret' };

/** kamp büyümesi sistemi (apps/server/src/camp-xp.ts): ref ile bir kez; ödüller görevin işleminde, kampa itme işlem sonunda */
export const CAMP_GROWTH: GrowthApi = {
  grantCampXp: (app, pid, amount, reason) => { grantCampXp(app, pid, amount, reason.slice(0, 80), reason); },
  // katalogda olan süs her zaman "verildi" sayılır (envanter sınırı doluysa eklenmez; bekleyen ödül sonsuza dek kalmasın)
  grantDecoration: (app, pid, id) => { if (!decorById(id)) return false; grantDecoration(app, pid, id, 1); return true; },
  campLevel: (app, pid) => campLevelOf(app, pid),
  decorCount: (app, pid) => placedDecor(app, pid).length,
};
let growth: GrowthApi | null = CAMP_GROWTH;
/** büyüme sistemini değiştir (testler: null = sistem yokmuş gibi, ödüller bekler) */
export function setGrowth(api: GrowthApi | null): void { growth = api; }
export const growthOn = () => !!growth;
export const growthApi = () => growth;

export function campLevel(app: App, pid: string): number { try { return growth?.campLevel(app, pid) ?? 0; } catch { return 0; } }
export function decorCount(app: App, pid: string): number { try { return growth?.decorCount(app, pid) ?? 0; } catch { return 0; } }

/** Kamp XP: bir kez yazılır (ref), büyüme sistemi varsa hemen uygulanır */
export function giveCampXp(app: App, pid: string, amount: number, ref: string): void {
  if (amount <= 0) return;
  if (!app.db.run('INSERT OR IGNORE INTO kg_pending(player_id, kind, ref, amount, item, at) VALUES(?, ?, ?, ?, NULL, ?)', pid, 'xp', ref, Math.round(amount), app.now())) return;
  applyPending(app, pid);
}
/** dekor: bir kez yazılır (ref), büyüme sistemi kataloğunda varsa hemen verilir */
export function giveDecoration(app: App, pid: string, id: string, ref: string): void {
  if (!app.db.run('INSERT OR IGNORE INTO kg_pending(player_id, kind, ref, amount, item, at) VALUES(?, ?, ?, 1, ?, ?)', pid, 'dekor', ref, id, app.now())) return;
  applyPending(app, pid);
}
/** bekleyen ödülleri uygula (büyüme sistemi bağlıyken; her satır bir kez) */
export function applyPending(app: App, pid: string): void {
  const g = growth; if (!g) return;
  for (const r of app.db.all<{ kind: string; ref: string; amount: number; item: string | null }>('SELECT kind, ref, amount, item FROM kg_pending WHERE player_id = ? AND applied = 0', pid)) {
    try {
      if (r.kind === 'xp') g.grantCampXp(app, pid, r.amount, `gorev:${r.ref}`);
      else if (r.kind === 'dekor' && r.item && !g.grantDecoration(app, pid, r.item)) continue;
      app.db.run('UPDATE kg_pending SET applied = 1 WHERE player_id = ? AND kind = ? AND ref = ?', pid, r.kind, r.ref);
    } catch (e) { if (app.cfg.log) console.error('[kamp görevi ödülü]', e); }
  }
}
export function pendingOf(app: App, pid: string): { kampXp: number; dekor: string[] } {
  const rows = app.db.all<{ kind: string; amount: number; item: string | null }>('SELECT kind, amount, item FROM kg_pending WHERE player_id = ? AND applied = 0', pid);
  return { kampXp: rows.filter((r) => r.kind === 'xp').reduce((a, r) => a + r.amount, 0), dekor: rows.filter((r) => r.kind === 'dekor' && r.item).map((r) => r.item!) };
}
