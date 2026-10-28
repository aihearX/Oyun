/**
 * Çökme raporları (YN-011): `POST /hata`. Kişisel veri yok, dış servis yok, hız sınırlı.
 *
 * - Gövde en çok 8 KB JSON; şema KATI (fazla alan → 400): oyuncu kimliği, takma ad, anahtar, sohbet gibi bir alan gelirse
 *   rapor reddedilir. İleti sunucuda bir kez daha temizlenir (packages/shared/src/hata.ts `scrubText`).
 * - Sınır: IP başına dakikada 10, günde 100. IP yalnız bellekte, tuzlu özet olarak, günlük pencere süresince (gün bitince silinir) tutulur;
 *   veritabanına, günlüğe hiç yazılmaz. Sunucu genelinde günde en çok 2000 yeni satır.
 * - Kayıt: `crash_reports` (göç 3) saat + imza (+ platform, sürüm, ekran) başına bir satır ve sayaç. 30 gün sonra silinir
 *   (pruneCrashes, saatlik bakım). Oyuncu sütunu yok (account-veri.ts).
 * - Özet: `GET /hata/ozet` (yalnız sunucunun kendisinden; Caddy yalnız /hata'yı geçirir) son 7 gün imza başına toplam.
 */
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import {
  CRASH_APP_RE, CRASH_BUILD_RE, CRASH_KIND_RE, CRASH_LIMITS, CRASH_OS_RE, CRASH_SCREEN_RE, CRASH_STACK_RE, scrubText, type CrashReport,
} from '@odi/shared';
import type { App } from './app';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** kayıtların saklanma süresi (gizlilik metni §3) */
export const CRASH_RETAIN_MS = CRASH_LIMITS.retainDays * DAY;

export const CRASH_SCHEMA = `
CREATE TABLE IF NOT EXISTS crash_reports(
  hour INTEGER NOT NULL, sig TEXT NOT NULL, platform TEXT NOT NULL, os TEXT NOT NULL, app TEXT NOT NULL, build TEXT NOT NULL, screen TEXT NOT NULL,
  n INTEGER NOT NULL, kind TEXT NOT NULL, message TEXT NOT NULL, stack TEXT NOT NULL, first_at INTEGER NOT NULL, last_at INTEGER NOT NULL,
  PRIMARY KEY(hour, sig, platform, os, app, build, screen));
CREATE INDEX IF NOT EXISTS crash_reports_sig ON crash_reports(sig, hour);
`;

export const crashReportSchema = z.object({
  v: z.literal(1),
  kind: z.string().regex(CRASH_KIND_RE),
  message: z.string().max(CRASH_LIMITS.messageMax),
  stack: z.array(z.string().max(160).regex(CRASH_STACK_RE)).max(CRASH_LIMITS.stackLines),
  app: z.string().regex(CRASH_APP_RE),
  build: z.string().regex(CRASH_BUILD_RE),
  platform: z.enum(['web', 'ios', 'android']),
  os: z.string().regex(CRASH_OS_RE),
  screen: z.string().regex(CRASH_SCREEN_RE),
  at: z.number().int().nonnegative().multipleOf(60_000),
}).strict();

// ------------------------------------------------------------------ hız sınırı (yalnız bellek)
interface Pencere { dk: number; dkN: number; gun: number; gunN: number }
interface Sinir { tuz: Buffer; ip: Map<string, Pencere>; yeniGun: number; yeniN: number; temizGun: number }
const sinirlar = new WeakMap<App, Sinir>();
function sinir(app: App): Sinir {
  let s = sinirlar.get(app);
  if (!s) { s = { tuz: randomBytes(16), ip: new Map(), yeniGun: 0, yeniN: 0, temizGun: 0 }; sinirlar.set(app, s); }
  return s;
}
/** IP'nin bellekteki anahtarı: süreç başına rastgele tuzla özet (IP'nin kendisi haritada bile durmaz) */
const ipAnahtar = (s: Sinir, ip: string) => createHash('sha256').update(s.tuz).update(ip).digest('base64url').slice(0, 22);

/** bu IP'den bir istek daha kabul edilir mi (sayar) */
export function crashRateOk(app: App, ip: string): boolean {
  const s = sinir(app); const now = app.now();
  const dk = Math.floor(now / 60_000), gun = Math.floor(now / DAY);
  const k = ipAnahtar(s, ip);
  let p = s.ip.get(k);
  if (!p) {
    // bellek sınırı: çok sayıda adresten gelen selde yeni adres kabul edilmez (eski günler önce atılır)
    if (s.ip.size >= 100_000) { crashRatePrune(app); if (s.ip.size >= 100_000) return false; }
    p = { dk, dkN: 0, gun, gunN: 0 }; s.ip.set(k, p);
  }
  if (p.dk !== dk) { p.dk = dk; p.dkN = 0; }
  if (p.gun !== gun) { p.gun = gun; p.gunN = 0; }
  if (p.dkN >= CRASH_LIMITS.perIpMinute || p.gunN >= CRASH_LIMITS.perIpDay) return false;
  p.dkN++; p.gunN++;
  return true;
}
/** bellekteki IP özeti sayısı (test) */
export const crashRateEntries = (app: App) => sinir(app).ip.size;
/** günü geçmiş pencereleri bellekten at: zamanlayıcı her turda çağırır, gün değişince çalışır (özet en çok bir gün bellekte) */
export function crashRatePrune(app: App): void {
  const s = sinir(app); const gun = Math.floor(app.now() / DAY);
  if (s.temizGun === gun && s.ip.size < 100_000) return;
  s.temizGun = gun;
  for (const [k, p] of s.ip) if (p.gun !== gun) s.ip.delete(k);
}

// ------------------------------------------------------------------ kayıt
export const crashSig = (r: Pick<CrashReport, 'kind' | 'message' | 'stack'>) =>
  createHash('sha256').update(`${r.kind}|${r.message}|${r.stack.slice(0, 5).join('|')}`).digest('hex').slice(0, 16);

export type CrashResult = { status: 204 | 400 | 429; error?: string; sig?: string };

/** ham gövde (en çok 8 KB, HTTP katmanı denetler) → doğrula, temizle, kaydet. Hız sınırı çağırandadır (crashRateOk). */
export function receiveCrash(app: App, raw: string): CrashResult {
  if (Buffer.byteLength(raw, 'utf8') > CRASH_LIMITS.maxBytes) return { status: 400, error: 'çok büyük' };
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return { status: 400, error: 'JSON değil' }; }
  const p = crashReportSchema.safeParse(data);
  if (!p.success) return { status: 400, error: 'şema' };
  const r = p.data;
  const now = app.now();
  if (r.at > now + 5 * 60_000) return { status: 400, error: 'zaman' };
  const at = Math.min(r.at, now);
  if (at < now - CRASH_RETAIN_MS) return { status: 204 }; // saklama süresinden eski (uzun süre bağlantısız kalmış): kaydedilmez
  // sunucuda bir kez daha temizle (istemciye güvenme)
  const message = scrubText(r.message);
  const sig = crashSig({ kind: r.kind, message, stack: r.stack });
  const hour = Math.floor(at / HOUR) * HOUR;
  const key = [hour, sig, r.platform, r.os, r.app, r.build, r.screen] as const;
  return app.run(() => {
    const var_ = app.db.get('SELECT 1 AS x FROM crash_reports WHERE hour = ? AND sig = ? AND platform = ? AND os = ? AND app = ? AND build = ? AND screen = ?', ...key);
    if (var_) {
      app.db.run('UPDATE crash_reports SET n = n + 1, first_at = MIN(first_at, ?), last_at = MAX(last_at, ?) WHERE hour = ? AND sig = ? AND platform = ? AND os = ? AND app = ? AND build = ? AND screen = ?', at, at, ...key);
      return { status: 204, sig } as CrashResult;
    }
    const s = sinir(app); const gun = Math.floor(now / DAY);
    if (s.yeniGun !== gun) { s.yeniGun = gun; s.yeniN = 0; }
    if (s.yeniN >= CRASH_LIMITS.newRowsPerDay) return { status: 429, error: 'günlük sınır' } as CrashResult;
    s.yeniN++;
    const ilk = !app.db.get('SELECT 1 AS x FROM crash_reports WHERE sig = ? AND hour = ?', sig, hour);
    app.db.run('INSERT INTO crash_reports(hour, sig, platform, os, app, build, screen, n, kind, message, stack, first_at, last_at) VALUES(?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)',
      ...key, r.kind, message, JSON.stringify(r.stack), at, at);
    // günlükte imza başına saatte bir satır (IP ve kimlik yok)
    if (ilk && app.cfg.log) console.log(new Date(now).toISOString(), `[çökme] ${sig} ${r.platform} ${r.os} ${r.app}${r.build ? `+${r.build}` : ''} ekran=${r.screen || '-'} ${r.kind}: ${message} @ ${r.stack[0] ?? '-'}`);
    return { status: 204, sig } as CrashResult;
  });
}

/** 30 günden eski satırlar silinir (saatlik bakım) */
export function pruneCrashes(app: App): void {
  app.db.run('DELETE FROM crash_reports WHERE hour < ?', app.now() - CRASH_RETAIN_MS);
}

export interface CrashSummary { gun: number; toplam: number; son24: number; imzalar: { imza: string; n: number; son24: number }[] }
/** yalnız toplamlar: son `days` gün imza başına sayı, son 24 saat (ileti, yığın, sürüm yok; ayrıntı: `npm run kod -- cokme`) */
export function crashSummary(app: App, days = 7): CrashSummary {
  const now = app.now(); const from = now - days * DAY; const d24 = now - DAY;
  const rows = app.db.all<{ sig: string; n: number; s24: number }>(
    'SELECT sig, SUM(n) AS n, SUM(CASE WHEN hour >= ? THEN n ELSE 0 END) AS s24 FROM crash_reports WHERE hour >= ? GROUP BY sig ORDER BY n DESC, sig LIMIT 50',
    Math.floor(d24 / HOUR) * HOUR, Math.floor(from / HOUR) * HOUR);
  const toplam = app.db.get<{ n: number | null }>('SELECT SUM(n) AS n FROM crash_reports WHERE hour >= ?', Math.floor(from / HOUR) * HOUR)!.n ?? 0;
  const son24 = app.db.get<{ n: number | null }>('SELECT SUM(n) AS n FROM crash_reports WHERE hour >= ?', Math.floor(d24 / HOUR) * HOUR)!.n ?? 0;
  return { gun: days, toplam, son24, imzalar: rows.map((r) => ({ imza: r.sig, n: r.n, son24: r.s24 })) };
}

export interface CrashDetail { imza: string; n: number; kind: string; message: string; stack: string[]; platformlar: string; surumler: string; ekranlar: string; ilk: number; son: number }
/** yönetici aracı (`npm run kod -- cokme`): imza başına ayrıntı (sunucu makinesinde, veritabanından) */
export function crashDetails(app: App, days = 7): CrashDetail[] {
  const from = Math.floor((app.now() - days * DAY) / HOUR) * HOUR;
  return app.db.all<{ sig: string; n: number; kind: string; message: string; stack: string; pl: string; sv: string; ek: string; ilk: number; son: number }>(
    `SELECT sig, SUM(n) AS n, MIN(kind) AS kind, MIN(message) AS message, MIN(stack) AS stack, GROUP_CONCAT(DISTINCT platform || ' ' || os) AS pl,
       GROUP_CONCAT(DISTINCT app || CASE WHEN build = '' THEN '' ELSE '+' || build END) AS sv, GROUP_CONCAT(DISTINCT screen) AS ek, MIN(first_at) AS ilk, MAX(last_at) AS son
     FROM crash_reports WHERE hour >= ? GROUP BY sig ORDER BY n DESC LIMIT 30`, from)
    .map((r) => ({ imza: r.sig, n: r.n, kind: r.kind, message: r.message, stack: JSON.parse(r.stack) as string[], platformlar: r.pl ?? '', surumler: r.sv ?? '', ekranlar: r.ek ?? '', ilk: r.ilk, son: r.son }));
}
