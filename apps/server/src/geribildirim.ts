/**
 * Beta geri bildirimi: `POST /geri-bildirim`. Kişisel veri istenmez ve eklenmez, dış servis yok, hız sınırlı.
 *
 * - Gövde en çok 4 KB JSON; şema KATI (fazla alan → 400): oyuncu kimliği, takma ad, anahtar gibi bir alan gelirse reddedilir.
 *   Metin sunucuda bir kez daha temizlenir (packages/shared/src/hata.ts `scrubFreeText`: e-posta, telefon, uzun rakam dizisi …).
 * - Sınır: IP başına saatte 5, günde 20. IP yalnız bellekte, süreç başına tuzlu özet olarak, günlük pencere süresince tutulur
 *   (gün bitince silinir); veritabanına ve günlüğe hiç yazılmaz. Sunucu genelinde günde en çok 1000 kayıt.
 * - Kayıt: `feedback` (göç 4): zaman (dakikaya yuvarlı), konu, metin, ekran, sürüm, derleme, platform. Oyuncu sütunu yok
 *   (account-veri.ts). 90 gün sonra silinir (pruneFeedback, saatlik bakım).
 * - Okuma: `npm run kod -- geribildirim [--gun 7]` (sunucu makinesinde). `GET /geri-bildirim/ozet` yalnız sayı verir (odi-durum);
 *   Caddy yalnız `/geri-bildirim`i geçirir.
 */
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { CRASH_APP_RE, CRASH_BUILD_RE, CRASH_SCREEN_RE, FEEDBACK_LIMITS, FEEDBACK_TOPICS, scrubFreeText, type FeedbackTopic } from '@odi/shared';
import type { App } from './app';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** kayıtların saklanma süresi (gizlilik metni §3) */
export const FEEDBACK_RETAIN_MS = FEEDBACK_LIMITS.retainDays * DAY;

export const FEEDBACK_SCHEMA = `
CREATE TABLE IF NOT EXISTS feedback(
  id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, topic TEXT NOT NULL, text TEXT NOT NULL, screen TEXT NOT NULL,
  app TEXT NOT NULL, build TEXT NOT NULL, platform TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS feedback_at ON feedback(at);
`;

export const feedbackSchema = z.object({
  v: z.literal(1),
  topic: z.enum(FEEDBACK_TOPICS),
  text: z.string().min(1).max(FEEDBACK_LIMITS.textMax),
  screen: z.string().regex(CRASH_SCREEN_RE),
  app: z.string().regex(CRASH_APP_RE),
  build: z.string().regex(CRASH_BUILD_RE),
  platform: z.enum(['web', 'ios', 'android']),
}).strict();

// ------------------------------------------------------------------ hız sınırı (yalnız bellek)
interface Pencere { saat: number; saatN: number; gun: number; gunN: number }
interface Sinir { tuz: Buffer; ip: Map<string, Pencere>; kayitGun: number; kayitN: number; temizGun: number }
const sinirlar = new WeakMap<App, Sinir>();
function sinir(app: App): Sinir {
  let s = sinirlar.get(app);
  if (!s) { s = { tuz: randomBytes(16), ip: new Map(), kayitGun: 0, kayitN: 0, temizGun: 0 }; sinirlar.set(app, s); }
  return s;
}
const BELLEK_EN_COK = 100_000;
/** IP'nin bellekteki anahtarı: süreç başına rastgele tuzla özet (IP'nin kendisi haritada bile durmaz) */
const ipAnahtar = (s: Sinir, ip: string) => createHash('sha256').update(s.tuz).update(ip).digest('base64url').slice(0, 22);

/** bu IP'den bir geri bildirim daha kabul edilir mi (sayar) */
export function feedbackRateOk(app: App, ip: string): boolean {
  const s = sinir(app); const now = app.now();
  const saat = Math.floor(now / HOUR), gun = Math.floor(now / DAY);
  const k = ipAnahtar(s, ip);
  let p = s.ip.get(k);
  if (!p) {
    if (s.ip.size >= BELLEK_EN_COK) { feedbackRatePrune(app); if (s.ip.size >= BELLEK_EN_COK) return false; }
    p = { saat, saatN: 0, gun, gunN: 0 }; s.ip.set(k, p);
  }
  if (p.saat !== saat) { p.saat = saat; p.saatN = 0; }
  if (p.gun !== gun) { p.gun = gun; p.gunN = 0; }
  if (p.saatN >= FEEDBACK_LIMITS.perIpHour || p.gunN >= FEEDBACK_LIMITS.perIpDay) return false;
  p.saatN++; p.gunN++;
  return true;
}
/** bellekteki IP özeti sayısı (test) */
export const feedbackRateEntries = (app: App) => sinir(app).ip.size;
/** günü geçmiş pencereleri bellekten at: zamanlayıcı her turda çağırır, gün değişince çalışır (özet en çok bir gün bellekte) */
export function feedbackRatePrune(app: App): void {
  const s = sinir(app); const gun = Math.floor(app.now() / DAY);
  if (s.temizGun === gun && s.ip.size < BELLEK_EN_COK) return;
  s.temizGun = gun;
  for (const [k, p] of s.ip) if (p.gun !== gun) s.ip.delete(k);
}

// ------------------------------------------------------------------ kayıt
export type FeedbackResult = { status: 204 | 400 | 429; error?: string };

/** ham gövde (en çok 4 KB, HTTP katmanı denetler) → doğrula, temizle, kaydet. Hız sınırı çağırandadır (feedbackRateOk). */
export function receiveFeedback(app: App, raw: string): FeedbackResult {
  if (Buffer.byteLength(raw, 'utf8') > FEEDBACK_LIMITS.maxBytes) return { status: 400, error: 'çok büyük' };
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return { status: 400, error: 'JSON değil' }; }
  const p = feedbackSchema.safeParse(data);
  if (!p.success) return { status: 400, error: 'şema' };
  const r = p.data;
  // sunucuda bir kez daha temizle (istemciye güvenme)
  const text = scrubFreeText(r.text, FEEDBACK_LIMITS.textMax);
  if (!text) return { status: 400, error: 'boş' };
  const now = app.now();
  const s = sinir(app); const gun = Math.floor(now / DAY);
  if (s.kayitGun !== gun) { s.kayitGun = gun; s.kayitN = 0; }
  if (s.kayitN >= FEEDBACK_LIMITS.perDay) return { status: 429, error: 'günlük sınır' };
  s.kayitN++;
  const at = Math.floor(now / 60_000) * 60_000;
  app.run(() => app.db.run('INSERT INTO feedback(at, topic, text, screen, app, build, platform) VALUES(?, ?, ?, ?, ?, ?, ?)',
    at, r.topic, text, r.screen, r.app, r.build, r.platform));
  // günlükte yalnız konu, platform, sürüm, ekran (metin ve IP yok; metin: npm run kod -- geribildirim)
  if (app.cfg.log) console.log(new Date(now).toISOString(), `[geri bildirim] ${r.topic} ${r.platform} ${r.app}${r.build ? `+${r.build}` : ''} ekran=${r.screen || '-'}`);
  return { status: 204 };
}

/** 90 günden eski kayıtlar silinir (saatlik bakım) */
export function pruneFeedback(app: App): void {
  app.db.run('DELETE FROM feedback WHERE at < ?', app.now() - FEEDBACK_RETAIN_MS);
}

/** yalnız sayılar (odi-durum): son 24 saat ve son 7 gün */
export function feedbackSummary(app: App): { son24: number; gun7: number } {
  const now = app.now();
  const say = (from: number) => app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM feedback WHERE at >= ?', from)!.n;
  return { son24: say(now - DAY), gun7: say(now - 7 * DAY) };
}

export interface FeedbackRow { at: number; topic: FeedbackTopic; text: string; screen: string; app: string; build: string; platform: string }
/** yönetici aracı (`npm run kod -- geribildirim`): son `days` günün kayıtları, yeniden eskiye (en çok 500) */
export function feedbackList(app: App, days = 7): FeedbackRow[] {
  return app.db.all<FeedbackRow>('SELECT at, topic, text, screen, app, build, platform FROM feedback WHERE at >= ? ORDER BY at DESC, id DESC LIMIT 500',
    app.now() - days * DAY);
}
