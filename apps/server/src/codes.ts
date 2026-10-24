/**
 * Kod Gir (docs/10-sunucu.md "Kodlar"): sürpriz ödül kodları ve yönetici kodu.
 * - Ödül kodu: oyuncu başına bir kez (promo_uses birincil anahtarı), toplam kullanım sınırı, başlangıç/bitiş tarihi, açık/kapalı.
 *   Ödüller mevcut yollardan: jeton/kristal/kalkan/kozmetik ödül kutusuna, hızlandırıcılar sunucu cüzdanına.
 * - Yönetici kodu: düz metni hiçbir yerde yok; sunucu yalnızca tuzlu scrypt özetini bilir (ODI_ADMIN_CODE_HASH, varsayılan aşağıda).
 *   Doğru girilince hesap yönetici olarak işaretlenir (player_flags.admin = 1, kalıcı) ve yönetici modu açılır (admin_on; kapatılabilir).
 *   Yönetici hesapları adil rekabetten çıkarılır (Sıralama, Takım Ligi, takım yarışı ödülü, haftalık ödüller, savaş/baskın/lig puanı).
 * - Yanlış denemeler sınırlı (oyuncu 5, IP 20 / 10 dk; sunucu genelinde en çok ADMIN_CHECKS_PER_WINDOW yönetici sınaması / 10 dk) ve her deneme kaydedilir (promo_log; bilinmeyen kodun metni kaydedilmez).
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import {
  CODE_PATTERN, CODE_RULES, normalizeCode, type AdminState, type CodeError, type CodeRedeemResult, type PromoCodeView, type PromoReward,
} from '@odi/shared';
import { COSMETICS } from '@odi/content';
import { fail, parseJson, type App, type Handlers, type Session } from './app';
import { rankInvalidate } from './rank';

export const CODES_SCHEMA = `
CREATE TABLE IF NOT EXISTS promo_codes(code TEXT PRIMARY KEY, rewards TEXT NOT NULL, max_uses INTEGER, uses INTEGER NOT NULL DEFAULT 0, starts_at INTEGER, ends_at INTEGER,
  active INTEGER NOT NULL DEFAULT 1, note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, created_by TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS promo_uses(code TEXT NOT NULL, player_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(code, player_id));
CREATE TABLE IF NOT EXISTS promo_log(at INTEGER NOT NULL, player_id TEXT NOT NULL, ip TEXT NOT NULL DEFAULT '', code TEXT NOT NULL DEFAULT '', result TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS promo_log_at ON promo_log(at);
CREATE TABLE IF NOT EXISTS player_flags(player_id TEXT PRIMARY KEY, admin INTEGER NOT NULL DEFAULT 0, admin_on INTEGER NOT NULL DEFAULT 0, admin_at INTEGER);
`;

/** varsayılan yönetici kodu özeti (scrypt, N=16384 r=8 p=1, 32 bayt). Düz metin depoda yoktur; değiştirmek için ODI_ADMIN_CODE_HASH. */
export const DEFAULT_ADMIN_CODE_HASH = 'scrypt:e672d6129b15b7349e9c4c613e16586e:8b7fc65ba4a7cad2e9d412c9391a01bb8efa6ec3cae2287524561a3dc66452ab';
/** yeni özet üret (CLI: `npm run kod -- ozet`); kodu normalize eder */
export function hashAdminCode(code: string): string {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(normalizeCode(code), salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex')}`;
}
export function checkAdminCode(app: App, code: string): boolean {
  const [alg, salt, hex] = (app.cfg.adminCodeHash || DEFAULT_ADMIN_CODE_HASH).split(':');
  if (alg !== 'scrypt' || !salt || !hex || hex.length !== 64) return false;
  try { return timingSafeEqual(scryptSync(code, salt, 32, { N: 16384, r: 8, p: 1 }), Buffer.from(hex, 'hex')); } catch { return false; }
}

// ------------------------------------------------------------------ yönetici bayrağı
/** yönetici olarak işaretli hesaplar (kalıcı; rekabet tablolarından ve ödüllerden çıkarılır) */
export const ADMIN_IDS_SQL = 'SELECT player_id FROM player_flags WHERE admin = 1';
export const isAdmin = (app: App, pid: string) => !!app.db.get('SELECT 1 AS x FROM player_flags WHERE player_id = ? AND admin = 1', pid);
export const isAdminOn = (app: App, pid: string) => !!app.db.get('SELECT 1 AS x FROM player_flags WHERE player_id = ? AND admin = 1 AND admin_on = 1', pid);
export function adminState(app: App, pid: string): AdminState {
  const r = app.db.get<{ admin: number; admin_on: number }>('SELECT admin, admin_on FROM player_flags WHERE player_id = ?', pid);
  return { isAdmin: !!r?.admin, on: !!r?.admin && !!r.admin_on };
}

// ------------------------------------------------------------------ deneme sınırı (bellek)
const wrong = new WeakMap<App, Map<string, number[]>>();
function recent(app: App, key: string): number[] {
  let m = wrong.get(app); if (!m) { m = new Map(); wrong.set(app, m); }
  const now = app.now(); const list = (m.get(key) ?? []).filter((t) => now - t < CODE_RULES.windowMs);
  m.set(key, list);
  return list;
}
/**
 * Sunucu genelinde yönetici kodu sınama bütçesi: 10 dakikada en çok bu kadar bilinmeyen kod yönetici özetiyle sınanır.
 * Oyuncu/IP sınırı yeni hesap açarak ya da IP değiştirerek aşılsa bile kaba kuvvet denemesi pratikte imkânsız kalır
 * ve pahalı scrypt hesabı sunucuyu meşgul edemez. Bütçe dolunca ödül kodları çalışmaya devam eder; yalnızca yönetici sınaması bekler.
 */
export const ADMIN_CHECKS_PER_WINDOW = 60;
const adminBudget = (app: App): boolean => {
  const list = recent(app, 'yonetici-sinama');
  if (list.length >= ADMIN_CHECKS_PER_WINDOW) return false;
  list.push(app.now());
  return true;
};
const limited = (app: App, pid: string, ip: string) => recent(app, `p:${pid}`).length >= CODE_RULES.wrongPerPlayer || (!!ip && recent(app, `i:${ip}`).length >= CODE_RULES.wrongPerIp);
function countWrong(app: App, pid: string, ip: string): void { recent(app, `p:${pid}`).push(app.now()); if (ip) recent(app, `i:${ip}`).push(app.now()); }

const MESSAGES: Record<CodeError, string> = {
  gecersiz: 'Kod geçersiz.',
  kullanildi: 'Bu kodu zaten kullandın.',
  suresi: 'Bu kodun süresi dolmuş.',
  tukendi: 'Bu kodun kullanım hakkı doldu.',
  baslamadi: 'Bu kod henüz geçerli değil.',
  cok: 'Çok fazla yanlış deneme. 10 dakika sonra yeniden dene.',
};

interface Row { code: string; rewards: string; max_uses: number | null; uses: number; starts_at: number | null; ends_at: number | null; active: number; note: string; created_at: number }
const toView = (r: Row): PromoCodeView => ({ code: r.code, rewards: parseJson<PromoReward>(r.rewards, {}), maxUses: r.max_uses, uses: r.uses, startsAt: r.starts_at, endsAt: r.ends_at, active: !!r.active, note: r.note, createdAt: r.created_at });

/** ödül metni (sohbet/ödül kutusu gerekçesi) */
export function rewardText(r: PromoReward): string {
  const p: string[] = [];
  if (r.jeton) p.push(`${r.jeton} jeton`); if (r.kristal) p.push(`${r.kristal} kristal`); if (r.kalkan) p.push(`${r.kalkan} kalkan`);
  if (r.kozmetik?.length) p.push(`${r.kozmetik.length} kozmetik`);
  const h = r.hizlandirici; const hz = (h?.m5 ?? 0) + (h?.m60 ?? 0) + (h?.s8 ?? 0); if (hz) p.push(`${hz} hızlandırıcı`);
  return p.join(' + ') || 'ödül';
}

function grantRewards(app: App, pid: string, code: string, r: PromoReward): void {
  const why = `Kod: ${code}`;
  if (r.jeton) app.addInbox(pid, { kind: 'jeton', amount: r.jeton, ref: 'kod' }, why);
  if (r.kristal) app.addInbox(pid, { kind: 'kristal', amount: r.kristal, ref: 'kod' }, why);
  if (r.kalkan) app.addInbox(pid, { kind: 'kalkan', amount: r.kalkan, ref: 'kod' }, why);
  for (const k of r.kozmetik ?? []) app.addInbox(pid, { kind: 'kozmetik', amount: 1, ref: k }, why);
  const h = r.hizlandirici;
  if (h && (h.m5 || h.m60 || h.s8)) { app.addCurrency(pid, 'm5', h.m5 ?? 0); app.addCurrency(pid, 'm60', h.m60 ?? 0); app.addCurrency(pid, 's8', h.s8 ?? 0); app.walletChanged(pid); }
}

/** kodu kullan: yönetici kodu ya da ödül kodu; hata da bir sonuçtur (deneme kaydı geri alınmasın diye fırlatılmaz) */
export function redeem(app: App, pid: string, ip: string, raw: string): CodeRedeemResult {
  const now = app.now();
  const log = (code: string, result: string) => app.db.run('INSERT INTO promo_log(at, player_id, ip, code, result) VALUES(?, ?, ?, ?, ?)', now, pid, ip, code, result);
  const bad = (error: CodeError, code = ''): CodeRedeemResult => { log(code, error); return { kind: 'hata', error, message: MESSAGES[error] }; };
  if (limited(app, pid, ip)) return bad('cok');
  const code = normalizeCode(raw);
  if (!CODE_PATTERN.test(code)) { countWrong(app, pid, ip); return bad('gecersiz'); }
  const r = app.db.get<Row>('SELECT * FROM promo_codes WHERE code = ?', code);
  // ödül kodu tablosunda yoksa yönetici kodu olabilir (ödül kodu yönetici koduyla aynı olamaz: createCode); sınama bütçeyle sınırlı
  if (!r && adminBudget(app) && checkAdminCode(app, code)) {
    app.db.run(`INSERT INTO player_flags(player_id, admin, admin_on, admin_at) VALUES(?, 1, 1, ?)
      ON CONFLICT(player_id) DO UPDATE SET admin = 1, admin_on = 1, admin_at = COALESCE(admin_at, excluded.admin_at)`, pid, now);
    log('', 'yonetici');
    app.after(() => rankInvalidate(app)); // Sıralama önbelleği: yönetici hemen tablolardan çıkar
    return { kind: 'yonetici', admin: adminState(app, pid) };
  }
  // bilinmeyen kodun metni kaydedilmez (yanlış yazılmış yönetici kodu da olabilir)
  if (!r) { countWrong(app, pid, ip); return bad('gecersiz'); }
  if (!r.active || (r.ends_at != null && now >= r.ends_at)) return bad('suresi', code);
  if (r.starts_at != null && now < r.starts_at) return bad('baslamadi', code);
  if (app.db.get('SELECT 1 AS x FROM promo_uses WHERE code = ? AND player_id = ?', code, pid)) return bad('kullanildi', code);
  // toplam sınır: koşullu artış (aynı anda iki kullanım sınırı aşamaz)
  if (!app.db.run('UPDATE promo_codes SET uses = uses + 1 WHERE code = ? AND (max_uses IS NULL OR uses < max_uses)', code)) return bad('tukendi', code);
  app.db.run('INSERT INTO promo_uses(code, player_id, at) VALUES(?, ?, ?)', code, pid, now);
  const rewards = parseJson<PromoReward>(r.rewards, {});
  grantRewards(app, pid, code, rewards);
  log(code, 'odul');
  return { kind: 'odul', code, title: r.note || 'Sürpriz ödül!', rewards };
}

// ------------------------------------------------------------------ kod yönetimi (CLI ve yönetici paneli ortak)
const cleanRewards = (r: PromoReward): PromoReward => {
  const n = (v: unknown, max: number) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? Math.min(v, max) : undefined);
  const out: PromoReward = {};
  const j = n(r.jeton, 100_000); if (j) out.jeton = j;
  const k = n(r.kristal, 10_000); if (k) out.kristal = k;
  const s = n(r.kalkan, 50); if (s) out.kalkan = s;
  const known = new Set(COSMETICS.map((c) => c.id));
  const koz = (r.kozmetik ?? []).filter((x) => known.has(x)).slice(0, 10); if (koz.length) out.kozmetik = koz;
  const h = r.hizlandirici; if (h) { const hz = { m5: n(h.m5, 100), m60: n(h.m60, 100), s8: n(h.s8, 100) }; if (hz.m5 || hz.m60 || hz.s8) out.hizlandirici = Object.fromEntries(Object.entries(hz).filter(([, v]) => v)) as PromoReward['hizlandirici']; }
  return out;
};
export function createCode(app: App, o: { code: string; rewards: PromoReward; maxUses?: number | null; startsAt?: number | null; endsAt?: number | null; note?: string; by: string }): PromoCodeView {
  const code = normalizeCode(o.code);
  if (!CODE_PATTERN.test(code)) fail('GECERSIZ', 'Kod 3–32 karakter olmalı: harf, rakam ve tire.');
  if (checkAdminCode(app, code)) fail('GECERSIZ', 'Bu kod kullanılamaz.');
  const rewards = cleanRewards(o.rewards);
  if (!Object.keys(rewards).length) fail('GECERSIZ', 'En az bir ödül gir.');
  if (app.db.get('SELECT 1 AS x FROM promo_codes WHERE code = ?', code)) fail('VAR', 'Bu kod zaten var.');
  const max = o.maxUses != null && o.maxUses > 0 ? Math.floor(o.maxUses) : null;
  app.db.run('INSERT INTO promo_codes(code, rewards, max_uses, starts_at, ends_at, active, note, created_at, created_by) VALUES(?, ?, ?, ?, ?, 1, ?, ?, ?)',
    code, JSON.stringify(rewards), max, o.startsAt ?? null, o.endsAt ?? null, (o.note ?? '').slice(0, 60), app.now(), o.by);
  return toView(app.db.get<Row>('SELECT * FROM promo_codes WHERE code = ?', code)!);
}
export function listCodes(app: App): PromoCodeView[] { return app.db.all<Row>('SELECT * FROM promo_codes ORDER BY created_at DESC LIMIT 200').map(toView); }
export function setCodeActive(app: App, raw: string, active: boolean): PromoCodeView {
  const code = normalizeCode(raw);
  if (!app.db.run('UPDATE promo_codes SET active = ? WHERE code = ?', active ? 1 : 0, code)) fail('YOK', 'Böyle bir kod yok.');
  return toView(app.db.get<Row>('SELECT * FROM promo_codes WHERE code = ?', code)!);
}

const requireAdminOn = (app: App, s: Session) => { if (!isAdminOn(app, s.pid)) fail('YETKI', 'Bu panel yalnızca yönetici modunda açılır.'); };

export const codeHandlers: Handlers = {
  'code.redeem': (app, s, { code }) => ({ result: redeem(app, s.pid, s.conn.ip ?? '', code) }),
  'admin.state': (app, s) => ({ admin: adminState(app, s.pid) }),
  'admin.set': (app, s, { on }) => {
    if (on && !isAdmin(app, s.pid)) fail('YETKI', 'Önce yönetici kodunu gir.');
    app.db.run('UPDATE player_flags SET admin_on = ? WHERE player_id = ?', on ? 1 : 0, s.pid);
    return { admin: adminState(app, s.pid) };
  },
  'code.list': (app, s) => { requireAdminOn(app, s); return { codes: listCodes(app) }; },
  'code.create': (app, s, d) => { requireAdminOn(app, s); return { code: createCode(app, { ...d, by: s.pid }) }; },
  'code.close': (app, s, { code, active }) => { requireAdminOn(app, s); return { code: setCodeActive(app, code, active ?? false) }; },
};
