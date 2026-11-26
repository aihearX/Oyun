/**
 * Kilitler (1.2.0): "her şey açık" modu (player_flags.admin_on) ve yöneticinin kilit hediyesi (player_unlocks) aynı kapılardan geçer.
 * - Bölümler: `levelCap` (gerçek ilerleme `players.highest`, hediye sınırı ya da her şey açık). Gerçek ilerleme ileri atlamaz:
 *   sıradaki bölüm yalnız art arda geçilince açılır (progress.ts), yıldız ve sıralama yalnız oynayarak gelir.
 * - Yerler: `hasUnlock` (hediye edilen yer ya da "hepsi", ya da her şey açık). İlerlemeyle açılma kuralını çağıran ayrıca sınar.
 * - Kilit hediyesi ödül kutusuna `kilit` türünde tek kart olarak düşer (yonetici-ekran.ts); oyuncu "Al" deyince `applyUnlock` (app.grant).
 * Bu dosya bilerek yalnız @odi/shared'a bağlıdır (app.ts de içe aktarır; döngü olmasın).
 */
import { FRIENDS_OPEN_AFTER, KILIT_SON_BOLUM, isKilitOzellik, kilitRefOku, type KilitOzellik, type PlayerUnlocks } from '@odi/shared';
import type { App, PlayerRow } from './app';

const adminOn = (app: App, pid: string) => !!app.db.get('SELECT 1 AS x FROM player_flags WHERE player_id = ? AND admin = 1 AND admin_on = 1', pid);

/** kabul edilmiş hediye açılımları (yoksa null) */
export function unlocksOf(app: App, pid: string): PlayerUnlocks | null {
  const r = app.db.get<{ levels_upto: number; features: string }>('SELECT levels_upto, features FROM player_unlocks WHERE player_id = ?', pid);
  if (!r) return null;
  let raw: unknown = [];
  try { raw = JSON.parse(r.features); } catch { /* boş */ }
  const features = Array.isArray(raw) ? raw.filter((x): x is KilitOzellik => typeof x === 'string' && isKilitOzellik(x)) : [];
  if (r.levels_upto <= 0 && !features.length) return null;
  return { levels: Math.max(0, r.levels_upto), features };
}

/** yer hediyeyle ya da "her şey açık" moduyla açık mı (ilerlemeyle açılma ayrı) */
export function hasUnlock(app: App, pid: string, f: KilitOzellik): boolean {
  if (adminOn(app, pid)) return true;
  const u = unlocksOf(app, pid);
  return !!u && (u.features.includes('hepsi') || u.features.includes(f));
}

/** oynanabilir en yüksek bölüm: gerçek ilerleme, hediye sınırı ya da her şey açık (40) */
export function levelCap(app: App, p: Pick<PlayerRow, 'id' | 'highest'>): number {
  if (adminOn(app, p.id)) return KILIT_SON_BOLUM;
  return Math.max(p.highest, Math.min(KILIT_SON_BOLUM, unlocksOf(app, p.id)?.levels ?? 0));
}

/** gerçek ilerlemeden ayrı açık bölüm var mı (çevrimdışı ilerleme taşıma yalnız art arda geçilenleri sayar; wallet.ts) */
export const hasLevelGift = (app: App, p: Pick<PlayerRow, 'id' | 'highest'>) => levelCap(app, p) > p.highest;

/** Arkadaşlar ve özel mesaj kilidi: FRIENDS_OPEN_AFTER bölüm geçildi, hediye ya da her şey açık */
export const dmLockOpen = (app: App, p: Pick<PlayerRow, 'id' | 'highest'>) => Math.max(0, p.highest - 1) >= FRIENDS_OPEN_AFTER || hasUnlock(app, p.id, 'friends');

/** kilit hediyesi kartını alınca: açılımlar birikir (bölüm sınırı büyüğü, yerler birleşir). Dönüş: güncel açılımlar */
export function applyUnlock(app: App, pid: string, levels: number, ref: string, itemId?: string): PlayerUnlocks {
  const cur = unlocksOf(app, pid) ?? { levels: 0, features: [] };
  const next: PlayerUnlocks = { levels: Math.max(cur.levels, Math.min(KILIT_SON_BOLUM, Math.max(0, Math.floor(levels)))), features: [...new Set([...cur.features, ...kilitRefOku(ref)])] };
  // veren yönetici: kartın kimliği yönetim kaydında (promo_log, 90 gün); kartta yönetici kimliği oyuncuya gitmez
  const by = itemId ? app.db.get<{ player_id: string }>("SELECT player_id FROM promo_log WHERE ip = 'panel' AND result LIKE ? ORDER BY at DESC LIMIT 1", `kilit:%:${itemId}:%`)?.player_id ?? '' : '';
  app.db.run(`INSERT INTO player_unlocks(player_id, levels_upto, features, granted_at, granted_by) VALUES(?, ?, ?, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET levels_upto = excluded.levels_upto, features = excluded.features, granted_at = excluded.granted_at, granted_by = excluded.granted_by`,
  pid, next.levels, JSON.stringify(next.features), app.now(), by);
  return next;
}
