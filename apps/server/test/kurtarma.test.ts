import { afterEach, describe, expect, it } from 'vitest';
import { createClient, type NetError } from '@odi/net';
import { KURTARMA_KURALLARI, epostaGecerli, normalizeEposta, type KurtarmaYanit } from '@odi/shared';
import { hashAdminCode } from '../src/codes';
import { KURTARMA_SINIR } from '../src/kurtarma';
import { run, setup, waitStatus, type Env, type TC } from './helpers';

/**
 * 1.2.0 hesap kurtarma (kurtarma.ts): isteğe bağlı kurtarma e-postası, POST /kurtarma (kod iste, kodla giriş, hesap seçimi),
 * yönetici ekranı › Kurtarma (kod okunur, "gönderildi" işareti), geri alma kodu (GERI-XXXX-XXXX, Kod Gir), anahtar döndürme
 * (eski cihaz TASINDI alır, yeni hesap açmaz). Bu sürümde e-posta gönderilmez: hiçbir dış adrese istek gitmemeli.
 */
let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };
const TEST_ADMIN = 'deneme yönetici';
const adminEnv = () => setup({ adminCodeHash: hashAdminCode(TEST_ADMIN) });
async function makeAdmin(e: Env, name: string): Promise<TC> {
  const a = await e.connect(name);
  expect((await a.call('code.redeem', { code: TEST_ADMIN })).result.kind).toBe('yonetici');
  return a;
}
async function post(e: Env, body: unknown, ip?: string): Promise<{ status: number; j: KurtarmaYanit }> {
  const r = await fetch(`${e.srv.httpUrl}/kurtarma`, { method: 'POST', headers: { 'content-type': 'application/json', ...(ip ? { 'x-forwarded-for': ip } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, j: await r.json() as KurtarmaYanit };
}
const kodOf = (e: Env, eposta: string) => (e.srv.app.db.get<{ kod: string }>("SELECT kod FROM kurtarma_istek WHERE eposta = ? AND durum = 'bekliyor' ORDER BY at DESC", eposta))?.kod ?? '';

describe('kurtarma e-postası (1.2.0)', () => {
  it('biçim denetimi, küçük harf, kaldırma; yalnız kendi profilinde; günlük değişiklik sınırı', async () => {
    expect(normalizeEposta('  Ayse.Kaya@Ornek.COM ')).toBe('ayse.kaya@ornek.com');
    for (const ok of ['a@b.co', 'ayse+oyun@ornek.com.tr']) expect(epostaGecerli(ok)).toBe(true);
    for (const bad of ['', 'ayse', 'a@b', 'a b@c.com', '@ornek.com', 'a@.com', 'a@b.c']) expect(epostaGecerli(bad)).toBe(false);
    env = await setup();
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora');
    expect(a.me!.kurtarmaEposta).toBeUndefined();
    expect((await err(a.call('eposta.ayarla', { eposta: 'yanlis-adres' }))).code).toBe('GECERSIZ');
    const r = await a.call('eposta.ayarla', { eposta: ' Ayse@Ornek.com ' });
    expect(r.me.kurtarmaEposta).toBe('ayse@ornek.com');
    // başka oyuncu göremez
    const pub = (await b.call('profile.get', { id: a.me!.id })).profile as unknown as Record<string, unknown>;
    expect(JSON.stringify(pub)).not.toContain('ornek.com');
    expect((await a.call('eposta.ayarla', { eposta: '' })).me.kurtarmaEposta).toBeUndefined();
    expect(env.srv.app.db.get('SELECT recovery_email FROM players WHERE id = ?', a.me!.id)).toEqual({ recovery_email: null });
    // günde en çok 5 değişiklik (aynı adresi yeniden yazmak sayılmaz)
    for (let i = 0; i < KURTARMA_KURALLARI.degisimGunluk - 2; i++) await a.call('eposta.ayarla', { eposta: `x${i}@ornek.com` });
    await a.call('eposta.ayarla', { eposta: 'X2@ornek.com' });
    expect((await err(a.call('eposta.ayarla', { eposta: 'son@ornek.com' }))).code).toBe('HIZ');
    // yeni bağlantıda da (hello) kendi profilinde gelir
    const a2 = await env.connect(undefined, a.token);
    expect(a2.me!.kurtarmaEposta).toBe('x2@ornek.com');
  });
});

describe('POST /kurtarma (1.2.0)', () => {
  it('kod iste: genel yanıt (adres kayıtlı olsun olmasın aynı), e-posta gönderilmez, kod yönetici ekranında; yeni istek eskisini geçersiz kılar', async () => {
    env = await adminEnv();
    const sahte = globalThis.fetch;
    const giden: string[] = [];
    globalThis.fetch = ((u: string | URL | Request, i?: RequestInit) => { const s = String(u); if (!s.startsWith(env!.srv.httpUrl)) giden.push(s); return sahte(u, i); }) as typeof fetch;
    try {
      const a = await env.connect('Ayşe');
      await a.call('eposta.ayarla', { eposta: 'ayse@ornek.com' });
      const var_ = await post(env, { istek: 'kod', eposta: 'AYSE@ornek.com' });
      env.clock.advance(1000);
      const yok = await post(env, { istek: 'kod', eposta: 'kimse@ornek.com' });
      expect(var_).toEqual({ status: 200, j: { ok: true, alindi: true } });
      expect(yok).toEqual(var_);
      expect((await post(env, { istek: 'kod', eposta: 'olmaz' })).status).toBe(400);
      expect(giden).toEqual([]);
      const ilk = kodOf(env, 'ayse@ornek.com');
      expect(ilk).toMatch(/^\d{6}$/);
      // yönetici listesi: en yeni önce, eşleşen hesaplar, kod, süre 24 saat
      const y = await makeAdmin(env, 'Yönetici');
      const l = await y.call('admin.kurtarma.list', {});
      expect(l.total).toBe(2); expect(l.bekleyen).toBe(2);
      expect(l.items.map((x) => x.eposta)).toEqual(['kimse@ornek.com', 'ayse@ornek.com']);
      expect(l.items[0]!.hesaplar).toEqual([]);
      const it0 = l.items[1]!;
      expect(it0).toMatchObject({ kod: ilk, durum: 'bekliyor', gonderildi: false, hesaplar: [{ id: a.me!.id, name: 'Ayşe', friendCode: a.me!.friendCode }] });
      expect(it0.expiresAt - it0.at).toBe(KURTARMA_KURALLARI.kodSureMs);
      // oyuncu yönetici işlerini kullanamaz
      expect((await err(a.call('admin.kurtarma.list', {}))).code).toBe('YETKI');
      // gönderildi işareti: rozet sayısı düşer, kayıt tutulur
      const g = await y.call('admin.kurtarma.gonderildi', { id: it0.id, on: true });
      expect(g.item.gonderildi).toBe(true);
      expect((await y.call('admin.kurtarma.list', {})).bekleyen).toBe(1);
      expect(env.srv.app.db.get("SELECT COUNT(*) AS n FROM promo_log WHERE result LIKE 'kurtarma-gonderildi:%'")).toEqual({ n: 1 });
      // yeni istek eskisini geçersiz kılar (adres başına tek geçerli kod)
      env.clock.advance(1000);
      await post(env, { istek: 'kod', eposta: 'ayse@ornek.com' });
      const ikinci = kodOf(env, 'ayse@ornek.com');
      const hepsi = (await y.call('admin.kurtarma.list', { filtre: 'hepsi' })).items.filter((x) => x.eposta === 'ayse@ornek.com');
      expect(hepsi.map((x) => x.durum)).toEqual(['bekliyor', 'yenilendi']);
      if (ikinci !== ilk) expect((await post(env, { istek: 'giris', eposta: 'ayse@ornek.com', kod: ilk })).status).toBe(400);
      // deneme kaydı: e-posta ve kod yazılmaz
      const log = JSON.stringify(env.srv.app.db.all('SELECT * FROM kurtarma_log'));
      expect(log).not.toContain('ornek.com'); expect(log).not.toContain(ikinci);
    } finally { globalThis.fetch = sahte; }
  });

  it('doğru kodla giriş: yeni anahtar, sunucu ilerlemesi; eski cihaz kapanır ve TASINDI alır (yeni hesap açmaz); kod tek kullanımlık', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    for (const lv of [1, 2, 3]) await a.call('progress.submit', run(lv, { stars: lv === 2 ? 2 : 3, score: 1000 + lv }));
    await a.call('eposta.ayarla', { eposta: 'ayse@ornek.com' });
    const eskiToken = a.token; const aid = a.me!.id;
    const oyuncuSayisi = () => env!.srv.app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM players')!.n;
    await post(env, { istek: 'kod', eposta: 'ayse@ornek.com' });
    const kod = kodOf(env, 'ayse@ornek.com');
    const yanlis = await post(env, { istek: 'giris', eposta: 'ayse@ornek.com', kod: kod === '000000' ? '111111' : '000000' });
    expect(yanlis.status).toBe(400);
    const kicked = a.waitFor('kicked');
    const r = await post(env, { istek: 'giris', eposta: 'ayse@ornek.com', kod });
    expect(r.status).toBe(200);
    if (!('token' in r.j)) throw new Error('anahtar bekleniyordu');
    expect(r.j.name).toBe('Ayşe');
    expect(r.j.ilerleme.best).toEqual([{ level: 1, stars: 3, score: 1001 }, { level: 2, stars: 2, score: 1002 }, { level: 3, stars: 3, score: 1003 }]);
    expect(r.j.ilerleme.xp).toBeGreaterThan(0);
    await kicked;
    // yeni cihaz: yeni anahtarla aynı hesap
    const n0 = oyuncuSayisi();
    const yeni = await env.connect(undefined, r.j.token);
    expect(yeni.me!.id).toBe(aid);
    // eski anahtar: TASINDI, istemci durur, yeni hesap açılmaz
    let fatal = '';
    const eski = createClient({ url: env.srv.url, getToken: () => eskiToken, saveToken: () => undefined, maxBackoffMs: 300, onFatal: (c) => { fatal = c; } });
    eski.connect();
    await waitStatus(eski, 'kapalı');
    eski.close();
    expect(fatal).toBe('TASINDI');
    expect(oyuncuSayisi()).toBe(n0);
    // kod tek kullanımlık
    expect((await post(env, { istek: 'giris', eposta: 'ayse@ornek.com', kod })).status).toBe(400);
    expect(env.srv.app.db.get('SELECT durum, used_by FROM kurtarma_istek WHERE kod = ?', kod)).toEqual({ durum: 'kullanildi', used_by: aid });
    expect(env.srv.app.db.get("SELECT COUNT(*) AS n FROM kurtarma_log WHERE result = 'giris' AND player_id = ?", aid)).toEqual({ n: 1 });
  });

  it('aynı adreste birden çok hesap: kod harcanmadan liste döner, seçilen hesaba girilir; yanlış hesap kimliği reddedilir', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora'); const c = await env.connect('Cem');
    await a.call('eposta.ayarla', { eposta: 'aile@ornek.com' }); await b.call('eposta.ayarla', { eposta: 'aile@ornek.com' });
    await post(env, { istek: 'kod', eposta: 'aile@ornek.com' });
    const kod = kodOf(env, 'aile@ornek.com');
    const l = await post(env, { istek: 'giris', eposta: 'aile@ornek.com', kod });
    if (!('hesaplar' in l.j)) throw new Error('liste bekleniyordu');
    expect(l.j.hesaplar.map((h) => h.name).sort()).toEqual(['Ayşe', 'Bora']);
    expect(l.j.hesaplar[0]).toEqual(expect.objectContaining({ level: expect.any(Number), highest: expect.any(Number), lastSeen: expect.any(Number), color: expect.any(Number) }));
    expect((await post(env, { istek: 'giris', eposta: 'aile@ornek.com', kod, id: c.me!.id })).status).toBe(400);
    const r = await post(env, { istek: 'giris', eposta: 'aile@ornek.com', kod, id: b.me!.id });
    if (!('token' in r.j)) throw new Error('anahtar bekleniyordu');
    expect(r.j.name).toBe('Bora');
  });

  it('kod başına 5 yanlış denemede kilitlenir; süre 24 saat; IP ve adres başına istek sınırı', async () => {
    env = await setup({ trustProxy: 1 });
    const a = await env.connect('Ayşe');
    await a.call('eposta.ayarla', { eposta: 'ayse@ornek.com' });
    await post(env, { istek: 'kod', eposta: 'ayse@ornek.com' }, '10.0.0.1');
    const kod = kodOf(env, 'ayse@ornek.com');
    const yanlisKod = kod === '123456' ? '654321' : '123456';
    for (let i = 0; i < KURTARMA_KURALLARI.yanlisHak; i++) expect((await post(env, { istek: 'giris', eposta: 'ayse@ornek.com', kod: yanlisKod }, `10.1.0.${i}`)).status).toBe(400);
    const kilit = await post(env, { istek: 'giris', eposta: 'ayse@ornek.com', kod }, '10.2.0.1');
    expect(kilit.status).toBe(400);
    // süre: 24 saat sonra geçmez
    await post(env, { istek: 'kod', eposta: 'ayse@ornek.com' }, '10.0.0.2');
    const k2 = kodOf(env, 'ayse@ornek.com');
    env.clock.advance(KURTARMA_KURALLARI.kodSureMs + 1000);
    expect((await post(env, { istek: 'giris', eposta: 'ayse@ornek.com', kod: k2 }, '10.2.0.2')).status).toBe(400);
    // adres başına günde 3 istek (yeni gün başladı: sayaç sıfır)
    for (let i = 0; i < KURTARMA_SINIR.epostaGunluk; i++) expect((await post(env, { istek: 'kod', eposta: 'ayse@ornek.com' }, `10.3.0.${i}`)).status).toBe(200);
    expect((await post(env, { istek: 'kod', eposta: 'ayse@ornek.com' }, '10.3.1.1')).status).toBe(429);
    // IP başına saatte 5 istek
    for (let i = 0; i < KURTARMA_SINIR.ipSaatlik; i++) expect((await post(env, { istek: 'kod', eposta: `k${i}@ornek.com` }, '10.4.0.1')).status).toBe(200);
    expect((await post(env, { istek: 'kod', eposta: 'baska@ornek.com' }, '10.4.0.1')).status).toBe(429);
    // bakım: süresi geçen istekler 7 gün sonra silinir
    env.clock.advance(9 * 86_400_000);
    const { pruneKurtarma } = await import('../src/kurtarma');
    pruneKurtarma(env.srv.app);
    expect(env.srv.app.db.get('SELECT COUNT(*) AS n FROM kurtarma_istek')).toEqual({ n: 0 });
  });
});

describe('geri alma kodu (1.2.0, yönetici)', () => {
  it('yönetici üretir (yalnız özeti saklanır); başka cihazda Kod Gir hesaba geçirir; tek kullanımlık, 24 saat, kayıtlı', async () => {
    env = await adminEnv();
    const sahip = await env.connect('Sahip');
    await sahip.call('progress.submit', run(1, { stars: 3 }));
    const y = await makeAdmin(env, 'Yönetici');
    const yeniCihaz = await env.connect();
    expect((await err(yeniCihaz.call('admin.geri.kod', { id: sahip.me!.id }))).code).toBe('YETKI');
    const g = await y.call('admin.geri.kod', { id: sahip.me!.id });
    expect(g.code).toMatch(/^GERI-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(g.expiresAt - env.clock.now()).toBe(KURTARMA_KURALLARI.geriSureMs);
    expect(JSON.stringify(env.srv.app.db.all('SELECT * FROM geri_kod'))).not.toContain(g.code);
    expect(JSON.stringify(env.srv.app.db.all('SELECT * FROM promo_log'))).not.toContain(g.code);
    // sahibin kendi bağlantısından: zaten o hesapta
    expect((await sahip.call('code.redeem', { code: g.code })).result.kind).toBe('hata');
    // Türkçe yazım (GERİ) da geçer
    const res = (await yeniCihaz.call('code.redeem', { code: `GERİ${g.code.slice(4)}` })).result;
    if (res.kind !== 'hesap') throw new Error(`hesap bekleniyordu: ${JSON.stringify(res)}`);
    expect(res.name).toBe('Sahip');
    expect(res.ilerleme.best).toEqual([{ level: 1, stars: 3, score: 1000 }]);
    const yeni = await env.connect(undefined, res.token);
    expect(yeni.me!.id).toBe(sahip.me!.id);
    // tek kullanımlık
    const ucuncu = await env.connect();
    expect((await ucuncu.call('code.redeem', { code: g.code })).result).toMatchObject({ kind: 'hata', error: 'gecersiz' });
    // süresi dolan kod geçmez; yeni kod eskisini geçersiz kılar
    const g2 = await y.call('admin.geri.kod', { id: sahip.me!.id });
    const g3 = await y.call('admin.geri.kod', { id: sahip.me!.id });
    expect((await ucuncu.call('code.redeem', { code: g2.code })).result).toMatchObject({ kind: 'hata', error: 'gecersiz' });
    env.clock.advance(KURTARMA_KURALLARI.geriSureMs + 1);
    expect((await ucuncu.call('code.redeem', { code: g3.code })).result).toMatchObject({ kind: 'hata', error: 'suresi' });
    expect(env.srv.app.db.get("SELECT COUNT(*) AS n FROM promo_log WHERE result LIKE 'geri-kod:%' AND ip = 'panel'")).toEqual({ n: 3 });
    // ödül kodu GERI- önekini kullanamaz
    expect((await err(y.call('code.create', { code: 'GERI-DENEME', rewards: { jeton: 5 } }))).code).toBe('GECERSIZ');
    // yönetici ayrıntısında kurtarma e-postası
    await yeni.call('eposta.ayarla', { eposta: 'sahip@ornek.com' });
    expect((await y.call('admin.player', { id: sahip.me!.id })).player.kurtarmaEposta).toBe('sahip@ornek.com');
  });

  it('hesap silinince kurtarma e-postası, istekleri ve taşınan anahtarları silinir', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    await a.call('eposta.ayarla', { eposta: 'ayse@ornek.com' });
    await post(env, { istek: 'kod', eposta: 'ayse@ornek.com' });
    const r = await post(env, { istek: 'giris', eposta: 'ayse@ornek.com', kod: kodOf(env, 'ayse@ornek.com') });
    if (!('token' in r.j)) throw new Error('anahtar bekleniyordu');
    const yeni = await env.connect(undefined, r.j.token);
    await post(env, { istek: 'kod', eposta: 'ayse@ornek.com' });
    await yeni.call('account.delete', {});
    const db = env.srv.app.db;
    expect(db.get('SELECT recovery_email FROM players WHERE id = ?', a.me!.id)).toEqual({ recovery_email: null });
    expect(db.get('SELECT COUNT(*) AS n FROM kurtarma_istek')).toEqual({ n: 0 });
    expect(db.get('SELECT COUNT(*) AS n FROM tasinan_anahtar')).toEqual({ n: 0 });
  });
});
