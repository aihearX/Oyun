/**
 * Hesap kurtarma (1.2.0). Hesaplar anonimdir: oyuncu cihazdaki oturum anahtarıyla girer. Anahtar kaybolursa (uygulama silindi,
 * telefon sıfırlandı) iki yol var:
 * 1) Kurtarma e-postası (isteğe bağlı, doğrulanmaz, kimseye gösterilmez): `eposta.ayarla` ile eklenir. Yeni cihazda
 *    "Hesabın var mı? E-postayla giriş yap" → `POST /kurtarma {istek:'kod'}`: sunucu 6 haneli kod üretir. Bu sürümde e-posta otomatik
 *    GÖNDERİLMEZ: kod yönetici ekranında (Kurtarma) görünür, ekip elle yollar (en geç 24 saat; kod 24 saat geçerli). Yanıt adresin
 *    kayıtlı olup olmadığını söylemez. Aynı adrese yeni istek eskisini geçersiz kılar (adres başına tek geçerli kod).
 *    `{istek:'giris', eposta, kod, id?}`: kod doğruysa adrese bağlı hesaplar (birden çoksa seçim listesi), seçilen hesaba yeni oturum
 *    anahtarı ve sunucudaki ilerlemesi döner. Kod tek kullanımlık; kod başına en çok 5 yanlış deneme, sonra kilitlenir.
 * 2) Geri alma kodu (e-postası olmayan hesap için): yönetici oyuncu ayrıntısında üretir (GERI-XXXX-XXXX, 24 saat, yalnız özeti
 *    tutulur); oyuncu yeni cihazda Kod Gir'e yazar (codes.ts redeem). Sonuç aynı: yeni anahtar + ilerleme.
 *
 * Anahtar döndürülür (tek anahtar: players.token_hash): kurtarılan hesabın eski cihazdaki oturumu kapanır (çevrimiçiyse "kicked").
 * Güvenli seçenek budur: kodu ele geçiren biri sahibin bilgisi dışında ikinci bir oturum tutamaz; sahip aynı yolla hesabı geri alır.
 * Eski anahtarın özeti `tasinan_anahtar`a yazılır: eski cihaz bağlanınca sessizce yeni hesap açmaz, "TASINDI" hatası alır.
 *
 * Hız sınırları (bellekte; IP'ler en çok bir gün): kod isteği IP başına saatte 5, cihaz başına günde 5, adres başına günde 3;
 * yanlış kod IP başına 10 dakikada 20. Kurtarma e-postası değişikliği oyuncu başına günde 5. Denemeler `kurtarma_log`a yazılır
 * (IP, sonuç; e-posta ve kod yazılmaz), 90 gün sonra silinir.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import {
  ADMIN_PAGE, GERI_KOD_ONEKI, KURTARMA_KURALLARI, epostaGecerli, levelFromXp, normalizeCode, normalizeEposta,
  type AdminKurtarma, type AdminKurtarmaDurum, type CodeRedeemResult, type KurtarmaHesap, type KurtarmaIlerleme, type KurtarmaYanit,
} from '@odi/shared';
import { fail, randomCode, sendJson, type App, type Handlers } from './app';
import { announcePresence } from './players';
import { DAY_MS } from './time';

export { KURTARMA_SCHEMA } from './kurtarma-schema';

const NOT_DELETED = 'id NOT IN (SELECT player_id FROM deleted_players)';
const HOUR = 3_600_000;
/** sınırlar (bellek) */
export const KURTARMA_SINIR = { ipSaatlik: 5, cihazGunluk: 5, epostaGunluk: 3, yanlisIp: 20, yanlisPencereMs: 600_000 } as const;
/** istek satırları süresi dolduktan 7 gün sonra, deneme kaydı 90 gün sonra, taşınan anahtar özeti 1 yıl sonra silinir */
export const KURTARMA_ISTEK_TUT_MS = 7 * DAY_MS;
export const KURTARMA_LOG_TUT_MS = 90 * DAY_MS;
export const TASINAN_TUT_MS = 365 * DAY_MS;

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

// ------------------------------------------------------------------ hız sınırı (bellek)
const izler = new WeakMap<App, Map<string, number[]>>();
function iz(app: App, key: string, pencere: number): number[] {
  let m = izler.get(app); if (!m) { m = new Map(); izler.set(app, m); }
  const now = app.now(); const list = (m.get(key) ?? []).filter((t) => now - t < pencere);
  if (list.length) m.set(key, list); else m.delete(key);
  return list;
}
function izEkle(app: App, key: string, pencere: number): void {
  const list = iz(app, key, pencere); list.push(app.now());
  izler.get(app)!.set(key, list);
}
/** süresi geçmiş izleri bellekten at (saatlik bakım) */
function izBudama(app: App): void {
  const m = izler.get(app); if (!m) return;
  const now = app.now();
  for (const [k, v] of m) if (!v.some((t) => now - t < DAY_MS)) m.delete(k);
}

const log = (app: App, ip: string, pid: string, result: string) =>
  app.db.run('INSERT INTO kurtarma_log(at, ip, player_id, result) VALUES(?, ?, ?, ?)', app.now(), ip, pid, result);

// ------------------------------------------------------------------ hesap, ilerleme, anahtar
/** sunucudaki ilerleme: yıldızlı bölümler ve XP (cihaz yerel ilerlemesini bundan kurar) */
export function ilerlemeOf(app: App, pid: string): KurtarmaIlerleme {
  const best = app.db.all<{ level: number; stars: number; score: number }>('SELECT level, stars, score FROM level_best WHERE player_id = ? AND stars > 0 ORDER BY level', pid)
    .map((r) => ({ level: r.level, stars: r.stars, score: r.score }));
  return { best, xp: app.player(pid).xp };
}

/** bu adrese bağlı (silinmemiş) hesaplar, son görülen önce */
export function hesaplarOf(app: App, eposta: string): KurtarmaHesap[] {
  return app.db.all<{ id: string; name: string; color: number; xp: number; highest: number; last_seen: number }>(
    `SELECT id, name, color, xp, highest, last_seen FROM players WHERE recovery_email = ? AND ${NOT_DELETED} ORDER BY last_seen DESC LIMIT 10`, eposta)
    .map((r) => ({ id: r.id, name: r.name, color: r.color, level: levelFromXp(r.xp), highest: r.highest, lastSeen: app.online.has(r.id) ? app.now() : r.last_seen }));
}

/**
 * Hesaba yeni oturum anahtarı ver: eski anahtar geçersizleşir (özeti tasinan_anahtar'a), hesap çevrimiçiyse o bağlantı kapanır.
 * Çağıran işlem (app.run) içinde çağırır; bağlantı işlem bitince kapanır.
 */
export function hesabiDevret(app: App, pid: string): string {
  const eski = app.player(pid).token_hash;
  const token = randomBytes(32).toString('hex');
  if (!eski.startsWith('silindi:')) app.db.run('INSERT OR REPLACE INTO tasinan_anahtar(token_hash, player_id, at) VALUES(?, ?, ?)', eski, pid, app.now());
  app.db.run('UPDATE players SET token_hash = ? WHERE id = ?', sha(token), pid);
  const c = app.online.get(pid);
  if (c) {
    app.after(() => {
      if (app.online.get(pid) !== c) return;
      sendJson(c, { t: 'evt', ev: 'kicked', data: { reason: 'Hesabın başka bir cihazda açıldı.' } });
      app.online.delete(pid);
      for (const r of [...c.rooms]) app.unsubscribe(pid, r);
      c.pid = null;
      try { c.ws.close(4000, 'kicked'); } catch { /* kapalı */ }
      try { app.run(() => announcePresence(app, pid, false)); } catch { /* yok */ }
    });
  }
  return token;
}

// ------------------------------------------------------------------ kurtarma e-postası (oyuncu)
/** ekle / değiştir / kaldır (boş). Biçim denetimi yalnız; doğrulanmaz. Günde en çok KURTARMA_KURALLARI.degisimGunluk değişiklik. */
export function epostaAyarla(app: App, pid: string, raw: string): void {
  const eposta = normalizeEposta(raw);
  if (eposta && !epostaGecerli(eposta)) fail('GECERSIZ', 'E-posta adresi doğru görünmüyor; bir daha bakar mısın? (ör. ad@ornek.com)');
  if ((app.player(pid).recovery_email ?? '') === eposta) return;
  const day = new Date(app.now() + 3 * HOUR).toISOString().slice(0, 10);
  if (app.dailyCount(pid, day, 'eposta') >= KURTARMA_KURALLARI.degisimGunluk) fail('HIZ', 'Kurtarma e-postasını bugün çok kez değiştirdin; yarın yeniden dene.');
  app.dailyInc(pid, day, 'eposta');
  app.db.run('UPDATE players SET recovery_email = ? WHERE id = ?', eposta || null, pid);
}

// ------------------------------------------------------------------ POST /kurtarma
type Cevap = { status: number; body: KurtarmaYanit };
const hata = (status: number, error: string): Cevap => ({ status, body: { ok: false, error } });
const COK_SIK = 'Çok sık istek gönderildi. Biraz sonra yeniden dene.';
const KOD_YANLIS = 'Kod yanlış ya da süresi dolmuş. E-postandaki kodu ve adresi kontrol et; gerekirse yeni kod iste.';

interface IstekRow { id: string; eposta: string; kod: string; at: number; expires_at: number; tries: number; durum: string; used_at: number | null; used_by: string | null; gonderildi_at: number | null }

function kodIste(app: App, ham: string, cihaz: string, ip: string): Cevap {
  const eposta = normalizeEposta(ham);
  if (!epostaGecerli(eposta)) return hata(400, 'E-posta adresi doğru görünmüyor; bir daha bakar mısın?');
  const now = app.now();
  const cihazKey = /^[A-Za-z0-9_-]{8,64}$/.test(cihaz) ? cihaz : '';
  const sinirli = (ip && iz(app, `kod-ip:${ip}`, HOUR).length >= KURTARMA_SINIR.ipSaatlik)
    || (cihazKey && iz(app, `kod-cihaz:${cihazKey}`, DAY_MS).length >= KURTARMA_SINIR.cihazGunluk)
    || app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM kurtarma_istek WHERE eposta = ? AND at > ?', eposta, now - DAY_MS)!.n >= KURTARMA_SINIR.epostaGunluk;
  if (sinirli) { log(app, ip, '', 'kod-sinir'); return hata(429, COK_SIK); }
  if (ip) izEkle(app, `kod-ip:${ip}`, HOUR);
  if (cihazKey) izEkle(app, `kod-cihaz:${cihazKey}`, DAY_MS);
  // adres başına tek geçerli kod: önceki bekleyen istek geçersizleşir
  app.db.run("UPDATE kurtarma_istek SET durum = 'yenilendi' WHERE eposta = ? AND durum = 'bekliyor'", eposta);
  const kod = String(randomInt(0, 10 ** KURTARMA_KURALLARI.kodHane)).padStart(KURTARMA_KURALLARI.kodHane, '0');
  app.db.run('INSERT INTO kurtarma_istek(id, eposta, kod, at, expires_at) VALUES(?, ?, ?, ?, ?)', `k${randomBytes(8).toString('hex')}`, eposta, kod, now, now + KURTARMA_KURALLARI.kodSureMs);
  // kayıtta e-posta ve hesap eşleşmesi yazılmaz (yönetici ekranı istekten okur)
  log(app, ip, '', 'kod-istendi');
  return { status: 200, body: { ok: true, alindi: true } };
}

const ayni = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function girisYap(app: App, ham: string, rawKod: string, id: string | undefined, ip: string): Cevap {
  const eposta = normalizeEposta(ham);
  const kod = rawKod.replace(/\D/g, '');
  if (ip && iz(app, `yanlis-ip:${ip}`, KURTARMA_SINIR.yanlisPencereMs).length >= KURTARMA_SINIR.yanlisIp) { log(app, ip, '', 'giris-sinir'); return hata(429, 'Çok fazla yanlış deneme. 10 dakika sonra yeniden dene.'); }
  const yanlis = (neden: string): Cevap => { if (ip) izEkle(app, `yanlis-ip:${ip}`, KURTARMA_SINIR.yanlisPencereMs); log(app, ip, '', neden); return hata(400, KOD_YANLIS); };
  if (!epostaGecerli(eposta) || kod.length !== KURTARMA_KURALLARI.kodHane) return yanlis('yanlis');
  const now = app.now();
  const r = app.db.get<IstekRow>("SELECT * FROM kurtarma_istek WHERE eposta = ? AND durum = 'bekliyor' AND expires_at > ? ORDER BY at DESC LIMIT 1", eposta, now);
  if (!r) return yanlis('yanlis');
  if (!ayni(r.kod, kod)) {
    const tries = r.tries + 1;
    app.db.run(`UPDATE kurtarma_istek SET tries = ?${tries >= KURTARMA_KURALLARI.yanlisHak ? ", durum = 'kilitlendi'" : ''} WHERE id = ?`, tries, r.id);
    if (tries >= KURTARMA_KURALLARI.yanlisHak) { if (ip) izEkle(app, `yanlis-ip:${ip}`, KURTARMA_SINIR.yanlisPencereMs); log(app, ip, '', 'kilitlendi'); return hata(400, 'Bu kodla çok fazla yanlış deneme yapıldı; kod artık geçmiyor. Yeni kod iste.'); }
    return yanlis('yanlis');
  }
  const hesaplar = hesaplarOf(app, eposta);
  if (!hesaplar.length) { log(app, ip, '', 'hesap-yok'); return hata(400, 'Bu adrese bağlı bir hesap bulunamadı. Hesabına kurtarma e-postası eklememiş olabilirsin; bize Ayarlar › Gizlilik ve hesap › Hakkında / iletişim adresinden yaz.'); }
  // birden çok hesap: kod harcanmaz, oyuncu seçer ve aynı kodla yeniden gönderir
  if (!id && hesaplar.length > 1) { log(app, ip, '', 'secim'); return { status: 200, body: { ok: true, hesaplar } }; }
  const hedef = id ?? hesaplar[0]!.id;
  if (!hesaplar.some((h) => h.id === hedef)) return hata(400, 'Bu hesap bu adrese bağlı değil.');
  app.db.run("UPDATE kurtarma_istek SET durum = 'kullanildi', used_at = ?, used_by = ? WHERE id = ?", now, hedef, r.id);
  const token = hesabiDevret(app, hedef);
  log(app, ip, hedef, 'giris');
  return { status: 200, body: { ok: true, token, name: app.player(hedef).name, ilerleme: ilerlemeOf(app, hedef) } };
}

/** POST /kurtarma gövdesi (JSON, en çok ~1 KB). İşlem tek seferde (app.run). */
export function receiveKurtarma(app: App, raw: string, ip: string): Cevap {
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw) as Record<string, unknown>; } catch { return hata(400, 'Geçersiz istek.'); }
  if (!b || typeof b !== 'object') return hata(400, 'Geçersiz istek.');
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.length <= max ? v : '');
  const eposta = str(b.eposta, KURTARMA_KURALLARI.epostaMax + 20);
  return app.run(() => {
    if (b.istek === 'kod') return kodIste(app, eposta, str(b.cihaz, 64), ip);
    if (b.istek === 'giris') {
      const id = str(b.id, 40);
      return girisYap(app, eposta, str(b.kod, 20), id && /^[A-Za-z0-9]+$/.test(id) ? id : undefined, ip);
    }
    return hata(400, 'Geçersiz istek.');
  });
}

// ------------------------------------------------------------------ geri alma kodu (yönetici)
/** yeni kod: GERI-XXXX-XXXX; aynı hesabın kullanılmamış eski kodları silinir. Kod yalnız döndürülür, özeti saklanır. */
export function geriKodUret(app: App, adminPid: string, pid: string): { code: string; expiresAt: number } {
  if (!app.db.get(`SELECT 1 AS x FROM players WHERE id = ? AND ${NOT_DELETED}`, pid)) fail('YOK', 'Oyuncu bulunamadı.');
  app.db.run('DELETE FROM geri_kod WHERE player_id = ? AND used_at IS NULL', pid);
  const now = app.now(); const expiresAt = now + KURTARMA_KURALLARI.geriSureMs;
  for (let i = 0; i < 20; i++) {
    const code = `${GERI_KOD_ONEKI}${randomCode(4)}-${randomCode(4)}`;
    if (app.db.get('SELECT 1 AS x FROM geri_kod WHERE code_hash = ?', sha(code))) continue;
    app.db.run('INSERT INTO geri_kod(code_hash, player_id, created_at, expires_at, created_by) VALUES(?, ?, ?, ?, ?)', sha(code), pid, now, expiresAt, adminPid);
    return { code, expiresAt };
  }
  return fail('SUNUCU', 'Kod üretilemedi.');
}

/**
 * Kod Gir'e yazılan kod bir geri alma kodu mu: değilse null (codes.ts ödül koduna bakar). Geçersiz/eski kod için hata sonucu
 * (yanlış deneme sayısını çağıran sayar), geçerliyse bu cihaz o hesaba geçer: yeni anahtar ve ilerleme.
 */
export function geriKodKullan(app: App, curPid: string, ip: string, raw: string): CodeRedeemResult | 'yok' | null {
  const code = normalizeCode(raw);
  if (!code.startsWith(GERI_KOD_ONEKI)) return null;
  const r = app.db.get<{ player_id: string; expires_at: number; used_at: number | null }>('SELECT player_id, expires_at, used_at FROM geri_kod WHERE code_hash = ?', sha(code));
  if (!r || r.used_at != null || !app.db.get(`SELECT 1 AS x FROM players WHERE id = ? AND ${NOT_DELETED}`, r.player_id)) return 'yok';
  if (r.expires_at <= app.now()) { log(app, ip, r.player_id, 'geri-suresi'); return { kind: 'hata', error: 'suresi', message: 'Bu geri alma kodunun süresi dolmuş; bize yaz, yenisini gönderelim.' }; }
  if (r.player_id === curPid) return { kind: 'hata', error: 'kullanildi', message: 'Bu cihaz zaten o hesapta.' };
  app.db.run('UPDATE geri_kod SET used_at = ? WHERE code_hash = ?', app.now(), sha(code));
  const token = hesabiDevret(app, r.player_id);
  log(app, ip, r.player_id, 'geri-kod');
  return { kind: 'hesap', token, name: app.player(r.player_id).name, ilerleme: ilerlemeOf(app, r.player_id) };
}

// ------------------------------------------------------------------ yönetici ekranı › Kurtarma
const durumOf = (r: IstekRow, now: number): AdminKurtarmaDurum =>
  (r.durum === 'bekliyor' && r.expires_at <= now ? 'suresi' : (['bekliyor', 'kullanildi', 'yenilendi', 'kilitlendi'].includes(r.durum) ? r.durum as AdminKurtarmaDurum : 'bekliyor'));

function adminView(app: App, r: IstekRow): AdminKurtarma {
  const hesaplar = app.db.all<{ id: string; name: string; friend_code: string; xp: number; highest: number; last_seen: number }>(
    `SELECT id, name, friend_code, xp, highest, last_seen FROM players WHERE recovery_email = ? AND ${NOT_DELETED} ORDER BY last_seen DESC LIMIT 10`, r.eposta)
    .map((p) => ({ id: p.id, name: p.name, friendCode: p.friend_code, level: levelFromXp(p.xp), highest: p.highest, lastSeen: app.online.has(p.id) ? app.now() : p.last_seen }));
  return {
    id: r.id, eposta: r.eposta, kod: r.kod, at: r.at, expiresAt: r.expires_at, durum: durumOf(r, app.now()),
    gonderildi: r.gonderildi_at != null, ...(r.gonderildi_at != null ? { gonderildiAt: r.gonderildi_at } : {}), hesaplar,
  };
}
/** gönderilmeyi bekleyen geçerli istek sayısı (sekme rozeti) */
export const bekleyenSayisi = (app: App) =>
  app.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM kurtarma_istek WHERE durum = 'bekliyor' AND expires_at > ? AND gonderildi_at IS NULL", app.now())!.n;

export function kurtarmaListesi(app: App, filtre: 'bekleyen' | 'hepsi', offset: number): { items: AdminKurtarma[]; total: number; hasMore: boolean; bekleyen: number } {
  const where = filtre === 'bekleyen' ? "WHERE durum = 'bekliyor' AND expires_at > ?" : '';
  const args = filtre === 'bekleyen' ? [app.now()] : [];
  const total = app.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM kurtarma_istek ${where}`, ...args)!.n;
  const rows = app.db.all<IstekRow>(`SELECT * FROM kurtarma_istek ${where} ORDER BY at DESC, id LIMIT ? OFFSET ?`, ...args, ADMIN_PAGE, offset);
  return { items: rows.map((r) => adminView(app, r)), total, hasMore: offset + rows.length < total, bekleyen: bekleyenSayisi(app) };
}
export function kurtarmaGonderildi(app: App, id: string, on: boolean): AdminKurtarma {
  if (!app.db.run('UPDATE kurtarma_istek SET gonderildi_at = ? WHERE id = ?', on ? app.now() : null, id)) fail('YOK', 'İstek bulunamadı.');
  return adminView(app, app.db.get<IstekRow>('SELECT * FROM kurtarma_istek WHERE id = ?', id)!);
}

/** saatlik bakım: süresi geçmiş istekler (7 gün sonra), eski kayıtlar, bellek izleri */
export function pruneKurtarma(app: App): void {
  const now = app.now();
  app.db.run('DELETE FROM kurtarma_istek WHERE expires_at < ?', now - KURTARMA_ISTEK_TUT_MS);
  app.db.run('DELETE FROM kurtarma_log WHERE at < ?', now - KURTARMA_LOG_TUT_MS);
  app.db.run('DELETE FROM geri_kod WHERE expires_at < ?', now - KURTARMA_ISTEK_TUT_MS);
  app.db.run('DELETE FROM tasinan_anahtar WHERE at < ?', now - TASINAN_TUT_MS);
  izBudama(app);
}

export const kurtarmaHandlers: Handlers = {
  'eposta.ayarla': (app, s, { eposta }) => { epostaAyarla(app, s.pid, eposta); return { me: app.myProfile(app.player(s.pid)) }; },
};
