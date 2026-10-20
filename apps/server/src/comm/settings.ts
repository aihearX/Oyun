import { COMM_RULES, type CommNotice, type CommSettings } from '@odi/shared';
import { fail, rid, type App, type PlayerRow } from '../app';
import { dayKey } from '../time';

/** Kişisel iletişim ayarları: serbest yazı (yeni oyuncuda kapalı) ve akışta paylaşım (varsayılan açık). */
interface SetRow { free_text: number; feed_share: number }
const row = (app: App, pid: string): SetRow => app.db.get<SetRow>('SELECT free_text, feed_share FROM comm_settings WHERE player_id = ?', pid) ?? { free_text: 0, feed_share: 1 };

export function commSettings(app: App, pid: string): CommSettings {
  const r = row(app, pid); const p = app.player(pid);
  return { freeText: !!r.free_text, feedShare: !!r.feed_share, canFreeText: !!r.free_text || p.highest >= COMM_RULES.freeTextLevel, freeTextLevel: COMM_RULES.freeTextLevel };
}
export function setCommSettings(app: App, pid: string, d: { freeText?: boolean; feedShare?: boolean }): CommSettings {
  const cur = row(app, pid);
  const free = d.freeText === undefined ? cur.free_text : d.freeText ? 1 : 0;
  const share = d.feedShare === undefined ? cur.feed_share : d.feedShare ? 1 : 0;
  if (free && !cur.free_text) metric(app, 'freetext.optin');
  app.db.run('INSERT INTO comm_settings(player_id, free_text, feed_share) VALUES(?, ?, ?) ON CONFLICT(player_id) DO UPDATE SET free_text = excluded.free_text, feed_share = excluded.feed_share', pid, free, share);
  return commSettings(app, pid);
}
export const feedShareOn = (app: App, pid: string) => !!row(app, pid).feed_share;

/** serbest yazı kapalıysa (yeni oyuncu ve kendisi açmadı) Türkçe hata */
export function requireFreeText(app: App, p: PlayerRow): void {
  if (p.highest >= COMM_RULES.freeTextLevel || row(app, p.id).free_text) return;
  fail('SERBEST_KAPALI', `Serbest yazı ${COMM_RULES.freeTextLevel}. bölüme kadar kapalı; hazır sözleri kullanabilir ya da sohbetin altından serbest yazıyı açabilirsin.`);
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
