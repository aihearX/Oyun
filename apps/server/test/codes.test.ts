import { afterEach, describe, expect, it } from 'vitest';
import type { NetError } from '@odi/net';
import { setup, run, type Env, type TC } from './helpers';
import { ADMIN_CHECKS_PER_WINDOW, DEFAULT_ADMIN_CODE_HASH, PROMO_LOG_RETAIN_MS, checkAdminCode, hashAdminCode, prunePromoLog, redeem as redeemDirect } from '../src/codes';
import { ADMIN_DISABLED, clientIp, configFromEnv } from '../src/server';

/**
 * Süre sınırları (MK-020): yönetici kodu sınaması scrypt'tir (N=16384; bir özet ≈ 35 ms CPU). Bu dosyada scrypt çağıran her testin sınırı
 * açıktır: ölçülen CPU × ~20, en az 15 sn. Ölçüm (yük ≈ 15, nice 5, tam vitest): duvar süresi CPU'nun 3–10 katı; yük 28–40'ta 5 sn'lik
 * varsayılan "yanlış deneme sınırı" testinde (CPU 0,95 sn, duvar 5,1 sn) aşıldı. Sınır yalnız süredir; davranış denetimi değişmez.
 */
let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };
/** testte gerçek yönetici kodu kullanılmaz: kendi özetimizle sunucu kurulur */
const TEST_ADMIN = 'deneme yönetici';
const adminEnv = () => setup({ adminCodeHash: hashAdminCode(TEST_ADMIN) });
const redeem = (c: TC, code: string) => c.call('code.redeem', { code }).then((r) => r.result);
const inbox = async (c: TC) => (await c.call('inbox.list', {})).items.filter((i) => i.ref === 'kod' || i.reason.startsWith('Kod:'));
async function makeAdmin(e: Env, name: string): Promise<TC> { const a = await e.connect(name); expect((await redeem(a, TEST_ADMIN)).kind).toBe('yonetici'); return a; }

describe('Kod Gir: ödül kodları', () => {
  it('bir kez, toplam sınır, süre, kapalı kod; Türkçe güvenli biçim; ödüller ödül kutusuna ve cüzdana; her deneme kayıtlı', async () => {
    env = await adminEnv();
    const adm = await makeAdmin(env, 'Yönetici');
    // yönetici panelinden kod (yalnızca yönetici modu açıkken)
    const made = (await adm.call('code.create', { code: 'odi yakında', note: 'Yakında!', maxUses: 2, rewards: { jeton: 500, kristal: 20, kalkan: 1, kozmetik: ['sapka-kasif'], hizlandirici: { m5: 2 } } })).code;
    expect(made).toMatchObject({ code: 'ODIYAKINDA', maxUses: 2, uses: 0, active: true });
    expect((await err(adm.call('code.create', { code: 'ODIYAKINDA', rewards: { jeton: 1 } }))).code).toBe('VAR');
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora'); const c = await env.connect('Cem');
    const ra = await redeem(a, '  odiyakında ');
    expect(ra).toMatchObject({ kind: 'odul', code: 'ODIYAKINDA', title: 'Yakında!', rewards: { jeton: 500, kristal: 20, kalkan: 1, kozmetik: ['sapka-kasif'], hizlandirici: { m5: 2 } } });
    expect((await inbox(a)).map((i) => [i.kind, i.amount]).sort()).toEqual([['jeton', 500], ['kalkan', 1], ['kozmetik', 1], ['kristal', 20]]);
    expect((await a.call('wallet.get', {})).wallet.hizlandirici.m5).toBe(2);
    // bir kez
    expect(await redeem(a, 'ODIYAKINDA')).toEqual({ kind: 'hata', error: 'kullanildi', message: 'Bu kodu zaten kullandın.' });
    // toplam sınır
    expect((await redeem(b, 'odiyakinda')).kind).toBe('odul');
    expect(await redeem(c, 'ODIYAKINDA')).toMatchObject({ kind: 'hata', error: 'tukendi' });
    // süre ve başlangıç
    const now = env.clock.t;
    await adm.call('code.create', { code: 'GECMIS', rewards: { jeton: 5 }, endsAt: now - 1 });
    await adm.call('code.create', { code: 'GELECEK', rewards: { jeton: 5 }, startsAt: now + 86_400_000 });
    expect(await redeem(c, 'gecmis')).toMatchObject({ kind: 'hata', error: 'suresi', message: 'Bu kodun süresi dolmuş.' });
    expect(await redeem(c, 'gelecek')).toMatchObject({ kind: 'hata', error: 'baslamadi' });
    env.clock.advance(86_400_000);
    expect((await redeem(c, 'gelecek')).kind).toBe('odul');
    // kapatılan kod
    await adm.call('code.create', { code: 'KAPALI', rewards: { kristal: 1 } });
    await adm.call('code.close', { code: 'kapali' });
    expect(await redeem(c, 'KAPALI')).toMatchObject({ kind: 'hata', error: 'suresi' });
    expect(await redeem(c, 'YOKBOYLE')).toEqual({ kind: 'hata', error: 'gecersiz', message: 'Kod geçersiz.' });
    // liste ve kayıt (bilinmeyen kodun metni yazılmaz)
    expect((await adm.call('code.list', {})).codes.find((x) => x.code === 'ODIYAKINDA')).toMatchObject({ uses: 2 });
    const log = env.srv.app.db.all<{ code: string; result: string }>('SELECT code, result FROM promo_log ORDER BY at');
    expect(log.filter((l) => l.result === 'odul').length).toBe(3);
    expect(log.find((l) => l.result === 'gecersiz')).toEqual({ code: '', result: 'gecersiz' });
    expect(log.some((l) => l.code.includes('YONETICI') || l.code.includes('YÖNETICI'))).toBe(false);
  }, 15_000); // CPU 0,44 sn (yönetici özeti + sınama, ödül kodları)

  it('yanlış deneme sınırı: oyuncu başına 5 / 10 dk (doğru kod bile beklemeli), IP başına 20', async () => {
    env = await adminEnv();
    const adm = await makeAdmin(env, 'Yönetici');
    await adm.call('code.create', { code: 'DOGRU', rewards: { jeton: 10 } });
    const a = await env.connect('Ayşe');
    for (let i = 0; i < 5; i++) expect((await redeem(a, `YANLIS${i}`)).kind).toBe('hata');
    expect(await redeem(a, 'DOGRU')).toMatchObject({ kind: 'hata', error: 'cok' });
    env.clock.advance(600_000);
    expect((await redeem(a, 'DOGRU')).kind).toBe('odul');
    // aynı IP (127.0.0.1) üzerinden 20 yanlış: başka oyuncu da bekler
    const ps: TC[] = []; for (let i = 0; i < 4; i++) ps.push(await env.connect(`Oyuncu${i}`));
    for (const p of ps) for (let i = 0; i < 5; i++) await redeem(p, `HATALI${i}`);
    const late = await env.connect('Geç');
    expect(await redeem(late, 'DOGRU')).toMatchObject({ kind: 'hata', error: 'cok' });
  }, 30_000); // CPU 0,95 sn (≈ 27 scrypt: 5 + 20 yanlış deneme)

  it('kaba kuvvete karşı: sunucu genelinde yönetici sınama bütçesi (yeni hesap / IP değiştirmek aşamaz), ödül kodları etkilenmez', async () => {
    env = await adminEnv();
    const app = env.srv.app;
    const adm = await makeAdmin(env, 'Yönetici');
    await adm.call('code.create', { code: 'BAHAR', rewards: { jeton: 10 } });
    const tryCode = (pid: string, ip: string, code: string) => app.run(() => redeemDirect(app, pid, ip, code));
    // her biri farklı hesap ve IP: oyuncu/IP sınırına takılmadan bütçe tükenir
    for (let i = 0; i < ADMIN_CHECKS_PER_WINDOW - 1; i++) expect(tryCode(`p-kaba-${i}`, `10.0.${i >> 8}.${i & 255}`, `TAHMIN${i}`).kind).toBe('hata');
    // bütçe doldu: doğru yönetici kodu bile yönetici yapmaz (bekler)
    expect(tryCode('p-yeni', '10.9.9.9', TEST_ADMIN)).toMatchObject({ kind: 'hata', error: 'gecersiz' });
    // ödül kodu çalışmaya devam eder (scrypt'e hiç girmez)
    expect(tryCode('p-odul', '10.9.9.8', 'bahar').kind).toBe('odul');
    env.clock.advance(600_000);
    expect(tryCode('p-yeni', '10.9.9.9', TEST_ADMIN).kind).toBe('yonetici');
  }, 60_000); // CPU 2,8 sn (60+ scrypt); yük 15'te duvar 11,4 sn

  it('kod deneme kaydı (IP içerir) 90 gün sonra silinir', async () => {
    env = await adminEnv();
    const app = env.srv.app;
    app.run(() => redeemDirect(app, 'p-eski', '10.1.1.1', 'YOKBOYLE'));
    env.clock.advance(PROMO_LOG_RETAIN_MS - 1000);
    app.run(() => redeemDirect(app, 'p-yeni', '10.1.1.2', 'YOKBOYLE2'));
    env.clock.advance(2000);
    prunePromoLog(app);
    expect(app.db.all<{ player_id: string }>('SELECT player_id FROM promo_log').map((r) => r.player_id)).toEqual(['p-yeni']);
  }, 15_000); // CPU 0,15 sn (özet + 2 yanlış kod sınaması)

  it('IP: X-Forwarded-For yalnızca güvenilir vekil sayısı kadar sağdan okunur; üretimde varsayılan özet kullanılmaz', () => {
    // vekilsiz: başlık sahte olabilir, soket adresi
    expect(clientIp('1.2.3.4', '9.9.9.9', 0)).toBe('9.9.9.9');
    // tek vekil (Render): istemcinin yazdığı soldaki girdiler yok sayılır
    expect(clientIp('6.6.6.6, 5.5.5.5', '10.0.0.1', 1)).toBe('5.5.5.5');
    expect(clientIp('5.5.5.5', '10.0.0.1', 1)).toBe('5.5.5.5');
    expect(clientIp(undefined, '10.0.0.1', 1)).toBe('10.0.0.1');
    expect(clientIp('7.7.7.7, 5.5.5.5, 172.16.0.2', '10.0.0.1', 2)).toBe('5.5.5.5');
    expect(configFromEnv({ ODI_TRUST_PROXY: '1' }).trustProxy).toBe(1);
    expect(configFromEnv({ NODE_ENV: 'production' }).adminCodeHash).toBe(ADMIN_DISABLED);
    expect(checkAdminCode({ cfg: { adminCodeHash: ADMIN_DISABLED } } as never, 'HERHANGI')).toBe(false);
    expect(configFromEnv({ NODE_ENV: 'production', ODI_ADMIN_CODE_HASH: 'scrypt:aa:bb' }).adminCodeHash).toBe('scrypt:aa:bb');
    expect(configFromEnv({}).adminCodeHash).toBeUndefined();
  });

  it('istek doğrulama ve yetki: panel yalnızca yönetici modunda', async () => {
    env = await adminEnv();
    const a = await env.connect('Ayşe');
    expect((await err(a.call('code.list', {}))).code).toBe('YETKI');
    expect((await err(a.call('code.create', { code: 'X1Y2', rewards: { jeton: 1 } }))).code).toBe('YETKI');
    expect((await err(a.call('admin.set', { on: true }))).code).toBe('YETKI');
    expect((await err(a.call('code.redeem', { code: '' }))).code).toBe('GECERSIZ');
    expect(await redeem(a, 'a!')).toMatchObject({ kind: 'hata', error: 'gecersiz' });
  }, 15_000); // CPU 0,06 sn (yönetici özeti)
});

describe('Kod Gir: yönetici kodu', () => {
  it('özet kontrolü: düz metin yok; varsayılan özet biçimi; yanlış kod yönetici yapmaz', async () => {
    expect(DEFAULT_ADMIN_CODE_HASH).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{64}$/);
    env = await adminEnv();
    const app = env.srv.app;
    expect(checkAdminCode(app, 'DENEMEYÖNETICI')).toBe(true);
    expect(checkAdminCode(app, 'DENEMEYÖNETIC')).toBe(false);
    // yanlış özet biçimi hiçbir kodu kabul etmez
    expect(checkAdminCode({ cfg: { adminCodeHash: 'md5:abc' } } as never, 'X')).toBe(false);
    // ortam değişkeninden gerçek kod verildiyse varsayılan özetle de sınanır (depoda düz metin yok)
    const real = process.env.ODI_TEST_ADMIN_CODE;
    if (real) expect(checkAdminCode({ cfg: {} } as never, real.toUpperCase())).toBe(true);
    const a = await env.connect('Ayşe');
    expect((await redeem(a, 'YONETICI')).kind).toBe('hata');
    expect((await a.call('admin.state', {})).admin).toEqual({ isAdmin: false, on: false });
  }, 15_000); // CPU 0,19 sn (özet + yanlış/doğru sınamalar)

  it('yönetici modu: tüm bölümler oynanabilir ama gerçek ilerleme atlamaz; kapatınca kilit geri; serbest yazı açık; rekabetten ve ödüllerden çıkar', async () => {
    env = await setup({ adminCodeHash: hashAdminCode(TEST_ADMIN), freeTextCleared: 8 });
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora');
    await a.call('progress.submit', run(1, { stars: 3 }));
    await b.call('progress.submit', run(1, { stars: 2 }));
    expect((await err(a.call('progress.submit', run(30)))).code).toBe('GECERSIZ');
    expect((await a.call('rank.board', { board: 'guc', scope: 'herkes' })).view.rows.map((r) => r.name)).toEqual(['Ayşe', 'Bora']);
    // yönetici kodu
    const res = await redeem(a, ' deneme yönetici ');
    expect(res).toEqual({ kind: 'yonetici', admin: { isAdmin: true, on: true } });
    // 30. bölüm oynanabilir; highest (gerçek ilerleme) atlamaz; savaş/baskın/lig puanı yok
    const ack = await a.call('progress.submit', run(30, { stars: 3 }));
    expect([ack.highest, ack.warPoints, ack.raidDamage, ack.leaguePoints]).toEqual([2, 0, 0, 0]);
    // serbest yazı (8 bölüm kuralı) yönetici modunda açık
    expect((await a.call('comm.state', {})).settings.canFreeText).toBe(true);
    // Sıralama: yönetici hesabı tablolarda yok
    expect((await a.call('rank.board', { board: 'guc', scope: 'herkes' })).view.rows.map((r) => r.name)).toEqual(['Bora']);
    // takım gücü yöneticiyi saymaz
    const t = (await a.call('team.create', { name: 'Testçiler', emblem: '🔊' })).team;
    await b.call('team.join', { teamId: t.id });
    const tg = (await b.call('rank.board', { board: 't-guc', scope: 'herkes' })).view.rows[0]!;
    const bora = (await b.call('rank.board', { board: 'guc', scope: 'herkes' })).view.rows[0]!;
    expect(tg.value).toBe(bora.value);
    // haftalık ödül: takım tablosunda 1. olsa da yönetici ödül almaz
    await b.call('progress.submit', run(2, { stars: 3 }));
    env.clock.advance(7 * 24 * 3_600_000);
    await b.call('rank.board', { board: 'yildiz', scope: 'herkes' });
    const ia = (await a.call('inbox.list', {})).items.filter((i) => i.ref === 'siralama');
    const ib = (await b.call('inbox.list', {})).items.filter((i) => i.ref === 'siralama');
    expect(ia).toEqual([]);
    expect(ib.length).toBeGreaterThan(0);
    // mod kapanır (gerçek ilerlemeye kilit); yeniden açmak kod gerektirmez (hesap yönetici olarak işaretli), ama kapalıyken bölüm sınırı geri gelir
    expect((await a.call('admin.set', { on: false })).admin).toEqual({ isAdmin: true, on: false });
    expect((await err(a.call('progress.submit', run(30)))).code).toBe('GECERSIZ');
    expect((await a.call('comm.state', {})).settings.canFreeText).toBe(false);
    expect((await a.call('admin.set', { on: true })).admin.on).toBe(true);
    // kapalıyken de rekabetten çıkarılmış kalır (bayrak kalıcı)
    await a.call('admin.set', { on: false });
    expect((await a.call('rank.board', { board: 'guc', scope: 'herkes' })).view.rows.some((r) => r.name === 'Ayşe')).toBe(false);
  }, 15_000); // CPU 0,15 sn

  it('Takım Ligi sezon ödülü yöneticiye gitmez (takım arkadaşı alır)', async () => {
    env = await setup({ adminCodeHash: hashAdminCode(TEST_ADMIN), raceCountdownMs: 50 });
    const app = env.srv.app;
    const a = await makeAdmin(env, 'Yönetici'); const b = await env.connect('Bora');
    const t = (await a.call('team.create', { name: 'Testçiler', emblem: '🔊' })).team; await b.call('team.join', { teamId: t.id });
    const s = (await b.call('tlig.state', {})).state.season;
    app.db.run('INSERT INTO tl_race(match_id, team_id, season, day, rival_id, points, counted, at) VALUES(?, ?, ?, ?, ?, ?, 1, ?)', 'm1', t.id, s.key, 'gün', 'x', 20, app.now());
    env.clock.advance(14 * 24 * 3_600_000);
    await b.call('tlig.state', {});
    const lig = async (c: TC) => (await c.call('inbox.list', {})).items.filter((i) => i.ref === 'takim-ligi');
    expect(await lig(a)).toEqual([]);
    expect((await lig(b)).length).toBe(1);
  }, 15_000); // CPU 0,14 sn
});
