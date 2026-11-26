import type { CommNotice, CommSettings } from '@odi/shared';
import { fail, rid, type App, type PlayerRow } from '../app';
import { DM_KIMDEN, type DmKimden } from '@odi/shared';
import { hasUnlock } from '../kilit';
import { dayKey } from '../time';

/**
 * Kişisel iletişim ayarları: akışta paylaşım (varsayılan açık). Serbest yazı bir ayar DEĞİLDİR: güvenli sohbet zorunludur —
 * cfg.freeTextCleared (8) bölüm geçilene kadar yalnızca hazır sözler ve tepkiler; geçilince kendiliğinden açılır (açma/kapama yok).
 * (comm_settings.free_text sütunu eski sürümden kalır, artık okunmaz.)
 */
interface SetRow { feed_share: number }
const row = (app: App, pid: string): SetRow => app.db.get<SetRow>('SELECT feed_share FROM comm_settings WHERE player_id = ?', pid) ?? { feed_share: 1 };
/** geçilen bölüm sayısı: en yüksek açık bölüm − 1 (sunucu bölümleri sırayla açar) */
const cleared = (p: PlayerRow) => Math.max(0, p.highest - 1);
/** yönetici modu ("her şey açık") ve kilit hediyesi (yazi ya da hepsi) serbest yazıyı da açar (1.2.0, kilit.ts) */
export const canFreeText = (app: App, p: PlayerRow) => cleared(p) >= app.cfg.freeTextCleared || hasUnlock(app, p.id, 'yazi');
/** 1.2.0: bana kimler özel mesaj atabilir (varsayılan herkes; satır yoksa da herkes) */
export function dmKimden(app: App, pid: string): DmKimden {
  const v = app.db.get<{ dm_kimden: string }>('SELECT dm_kimden FROM comm_settings WHERE player_id = ?', pid)?.dm_kimden;
  return (DM_KIMDEN as readonly string[]).includes(v ?? '') ? v as DmKimden : 'herkes';
}

export function commSettings(app: App, pid: string): CommSettings {
  const p = app.player(pid);
  return { feedShare: !!row(app, pid).feed_share, canFreeText: canFreeText(app, p), freeTextLevel: app.cfg.freeTextCleared, dmKimden: dmKimden(app, pid) };
}
export function setCommSettings(app: App, pid: string, d: { feedShare?: boolean; dmKimden?: DmKimden }): CommSettings {
  const share = d.feedShare === undefined ? row(app, pid).feed_share : d.feedShare ? 1 : 0;
  const kimden = d.dmKimden ?? dmKimden(app, pid);
  app.db.run('INSERT INTO comm_settings(player_id, feed_share, dm_kimden) VALUES(?, ?, ?) ON CONFLICT(player_id) DO UPDATE SET feed_share = excluded.feed_share, dm_kimden = excluded.dm_kimden', pid, share, kimden);
  return commSettings(app, pid);
}
export const feedShareOn = (app: App, pid: string) => !!row(app, pid).feed_share;

/** güvenli sohbet: yeterince bölüm geçilmediyse Türkçe hata (açma seçeneği yok) */
export function requireFreeText(app: App, p: PlayerRow): void {
  if (canFreeText(app, p)) return;
  fail('SERBEST_KAPALI', `Serbest yazı ${app.cfg.freeTextCleared}. bölümden sonra açılır; o zamana kadar hazır sözler ve tepkiler kullanılır.`);
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
