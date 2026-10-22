import type { CommNotice, CommSettings } from '@odi/shared';
import { fail, rid, type App, type PlayerRow } from '../app';
import { isAdminOn } from '../codes';
import { dayKey } from '../time';

/**
 * Kişisel iletişim ayarları: akışta paylaşım (varsayılan açık). Serbest yazı bir ayar DEĞİLDİR: güvenli sohbet zorunludur —
 * cfg.freeTextCleared (8) bölüm geçilene kadar yalnızca hazır sözler ve emoji; geçilince kendiliğinden açılır (açma/kapama yok).
 * (comm_settings.free_text sütunu eski sürümden kalır, artık okunmaz.)
 */
interface SetRow { feed_share: number }
const row = (app: App, pid: string): SetRow => app.db.get<SetRow>('SELECT feed_share FROM comm_settings WHERE player_id = ?', pid) ?? { feed_share: 1 };
/** geçilen bölüm sayısı: en yüksek açık bölüm − 1 (sunucu bölümleri sırayla açar) */
const cleared = (p: PlayerRow) => Math.max(0, p.highest - 1);
/** yönetici modu (Kod Gir) her özelliği açar; serbest yazı da */
export const canFreeText = (app: App, p: PlayerRow) => cleared(p) >= app.cfg.freeTextCleared || isAdminOn(app, p.id);

export function commSettings(app: App, pid: string): CommSettings {
  const p = app.player(pid);
  return { feedShare: !!row(app, pid).feed_share, canFreeText: canFreeText(app, p), freeTextLevel: app.cfg.freeTextCleared };
}
export function setCommSettings(app: App, pid: string, d: { feedShare?: boolean }): CommSettings {
  const share = d.feedShare === undefined ? row(app, pid).feed_share : d.feedShare ? 1 : 0;
  app.db.run('INSERT INTO comm_settings(player_id, feed_share) VALUES(?, ?) ON CONFLICT(player_id) DO UPDATE SET feed_share = excluded.feed_share', pid, share);
  return commSettings(app, pid);
}
export const feedShareOn = (app: App, pid: string) => !!row(app, pid).feed_share;

/** güvenli sohbet: yeterince bölüm geçilmediyse Türkçe hata (açma seçeneği yok) */
export function requireFreeText(app: App, p: PlayerRow): void {
  if (canFreeText(app, p)) return;
  fail('SERBEST_KAPALI', `Serbest yazı ${app.cfg.freeTextCleared}. bölümden sonra açılır; o zamana kadar hazır sözler ve emoji kullanılır.`);
}

/** gizlilik dostu günlük sayaç (kişisel veri yok) */
export function metric(app: App, k: string, n = 1): void {
  app.db.run('INSERT INTO comm_metrics(day, k, n) VALUES(?, ?, ?) ON CONFLICT(day, k) DO UPDATE SET n = n + excluded.n', dayKey(app.now()), k, n);
}
export function metricsReport(app: App, days = 7): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const r of app.db.all<{ day: string; k: string; n: number }>('SELECT day, k, n FROM comm_metrics ORDER BY day DESC, k LIMIT ?', days * 40)) {
    (out[r.day] ??= {})[r.k] = r.n;
  }
  return Object.fromEntries(Object.entries(out).slice(0, days));
}

/** iletişim bildirimi (yalnızca çevrimiçi alıcıya; kalıcı iz sohbette/ödül kutusundadır) */
export function commNotice(app: App, pid: string, n: Omit<CommNotice, 'id' | 'at'>): void {
  app.emit(pid, 'comm.notice', { notice: { id: rid('c'), at: app.now(), ...n } });
}
