import { afterEach, describe, expect, it } from 'vitest';
import type { NetError } from '@odi/net';
import { CODE_PATTERN } from '@odi/shared';
import { setup, type Env, type TC } from './helpers';
import { createRozetCodes, hashAdminCode, rozetVer } from '../src/codes';
import { kurucuListesi } from '../src/rozet';

/**
 * Kurucu Yolcular (YN-041): tek kullanımlık rozet kodları, kalıcı rozet ve çerçeve, Kurucular listesi (yalnız izin verenler),
 * Hata Avcısı unvanı, hesap silinince rozet ve liste kaydının silinmesi. Yalnız görünüş: cüzdan ve ödül kutusu değişmez.
 * Bu dosyada yönetici kodu sınaması (scrypt) yalnız bir testte; süre sınırı onda açık (codes.test.ts notu, MK-020).
 */
let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };
const redeem = (c: TC, code: string) => c.call('code.redeem', { code }).then((r) => r.result);
const uses = (e: Env, code: string) => e.srv.app.db.get<{ uses: number }>('SELECT uses FROM promo_codes WHERE code = ?', code)!.uses;
const kurucuKodlari = (e: Env, n: number) => e.srv.app.run(() => createRozetCodes(e.srv.app, 'kurucu', n));
/** sunucudan güncel kendi profilim (profile.update boş istek; istemcinin me'si de güncellenir) */
const me = async (c: TC) => (await c.call('profile.update', {})).me;

describe('Kurucu Yolcular: rozet kodları', () => {
  it('kodlar KURUCU-XXXX-XXXX, tek kullanımlık; bir kez işler, aynı hesap ikinci kez kurucu olamaz (kod harcanmaz); ekonomi değişmez', async () => {
    env = await setup();
    const codes = kurucuKodlari(env, 3);
    expect(codes).toHaveLength(3);
    expect(new Set(codes).size).toBe(3);
    for (const c of codes) { expect(c).toMatch(/^KURUCU-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/); expect(CODE_PATTERN.test(c)).toBe(true); }
    expect(env.srv.app.db.all('SELECT max_uses, rewards FROM promo_codes')).toEqual(codes.map(() => ({ max_uses: 1, rewards: '{"rozet":["kurucu"]}' })));
    const [k1, k2] = codes as [string, string, string];
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora');
    const walletBefore = (await a.call('wallet.get', {})).wallet;
    // küçük harf, boşluk: oyuncunun yazdığı gibi
    expect(await redeem(a, ` ${k1.toLowerCase()} `)).toMatchObject({ kind: 'odul', code: k1, title: 'Kurucu Yolcu', rewards: { rozet: ['kurucu'] } });
    // yalnız görünüş: cüzdan ve ödül kutusu aynı
    expect((await a.call('wallet.get', {})).wallet).toEqual(walletBefore);
    expect((await a.call('inbox.list', {})).items.filter((i) => i.reason.startsWith('Kod:'))).toEqual([]);
    // aynı kod başka hesapta: hakkı doldu
    expect(await redeem(b, k1)).toMatchObject({ kind: 'hata', error: 'tukendi' });
    // aynı hesap ikinci bir kurucu koduyla: reddedilir, kod harcanmaz → başkası kullanabilir
    const again = await redeem(a, k2);
    expect(again).toMatchObject({ kind: 'hata', error: 'kullanildi' });
    expect(again.kind === 'hata' && again.message).toMatch(/zaten Kurucu Yolcu/);
    expect(uses(env, k2)).toBe(0);
    expect((await redeem(b, k2)).kind).toBe('odul');
    expect(env.srv.app.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM player_badges WHERE badge = 'kurucu'")!.n).toBe(2);
    // kayıt: rozet engeli ayrı sonuçla
    expect(env.srv.app.db.all<{ result: string }>('SELECT result FROM promo_log ORDER BY rowid').map((r) => r.result)).toEqual(['odul', 'tukendi', 'rozet-var', 'odul']);
    // adet sınırı
    expect(() => env!.srv.app.run(() => createRozetCodes(env!.srv.app, 'kurucu', 0))).toThrow(/Adet/);
  });

  it('rozet kalıcı: yeniden bağlanınca, günler sonra, profil kartında ve takım üye listesinde görünür; çerçeve seçilebilir', async () => {
    env = await setup();
    const [k] = kurucuKodlari(env, 1) as [string];
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora');
    await redeem(a, k);
    const m = await me(a);
    expect(m).toMatchObject({ rozetler: ['kurucu'], cerceve: 'kurucu', listede: false });
    expect(a.me).toMatchObject({ rozetler: ['kurucu'] }); // istemcinin profili de güncel
    // rozeti olmayanın profilinde alan yok (eski istemciler etkilenmez)
    const bm = await me(b);
    expect('rozetler' in bm || 'cerceve' in bm || 'listede' in bm).toBe(false);
    // yeniden bağlan + zaman geçer
    a.close(); env.clock.advance(400 * 86_400_000);
    const a2 = await env.connect(undefined, a.token);
    expect(a2.me).toMatchObject({ id: m.id, rozetler: ['kurucu'], cerceve: 'kurucu' });
    // başkasının gördüğü profil kartı: rozet ve çerçeve var, liste seçimi yok
    const card = (await b.call('profile.card', { id: m.id })).card.profile;
    expect(card).toMatchObject({ rozetler: ['kurucu'], cerceve: 'kurucu' });
    expect('listede' in card).toBe(false);
    // takım üye listesi
    const t = (await a2.call('team.create', { name: 'Kurucular', emblem: '🧭' })).team;
    await b.call('team.join', { teamId: t.id });
    const roster = (await b.call('team.detail', {})).team!.roster;
    expect(roster.find((x) => x.id === m.id)).toMatchObject({ rozetler: ['kurucu'] });
    expect(roster.find((x) => x.id === b.me!.id)?.rozetler).toBeUndefined();
    // çerçeveyi çıkar / giy (Dolap); rozet kalır
    expect((await a2.call('profile.update', { cerceve: '' })).me).toMatchObject({ rozetler: ['kurucu'] });
    expect((await me(a2)).cerceve).toBeUndefined();
    expect((await a2.call('profile.update', { cerceve: 'kurucu' })).me.cerceve).toBe('kurucu');
    // rozeti olmayan seçemez
    expect((await err(b.call('profile.update', { cerceve: 'kurucu' }))).code).toBe('YOK');
    expect((await err(b.call('profile.update', { listede: true }))).code).toBe('YOK');
  });

  it('Kurucular listesi: yalnız "Adım listede görünsün" diyenler, kod kullanım sırasıyla; varsayılan kapalı; yönetici kurucu olamaz', async () => {
    env = await setup({ adminCodeHash: hashAdminCode('deneme yönetici') });
    const codes = kurucuKodlari(env, 4);
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora'); const c = await env.connect('Cem'); const y = await env.connect('Yönetici');
    // yönetici: kurucu kodu işlemez, kod harcanmaz
    expect((await redeem(y, 'deneme yönetici')).kind).toBe('yonetici');
    const ry = await redeem(y, codes[3]!);
    expect(ry).toMatchObject({ kind: 'hata', error: 'kullanildi' });
    expect(ry.kind === 'hata' && ry.message).toMatch(/Yönetici/);
    expect(uses(env, codes[3]!)).toBe(0);
    // uygulama içi kod paneli kişiye özel rozet kodlarını göstermez (yalnız sunucu terminali)
    const panel = (await y.call('code.list', {})).codes;
    expect(panel.map((c) => c.code)).toEqual(codes.map(() => 'KURUCU-••••-••••'));
    expect(JSON.stringify(panel)).not.toContain(codes[0]!.slice(7));
    // sıra: Cem, Ayşe, Bora
    await redeem(c, codes[0]!); env.clock.advance(1000); await redeem(a, codes[1]!); env.clock.advance(1000); await redeem(b, codes[2]!);
    // varsayılan: kimse listede değil
    expect(await a.call('kurucu.liste', {})).toEqual({ names: [], gizli: 3 });
    await b.call('profile.update', { listede: true });
    await c.call('profile.update', { listede: true });
    expect(await y.call('kurucu.liste', {})).toEqual({ names: ['Cem', 'Bora'], gizli: 1 });
    // fikrini değiştirebilir
    await c.call('profile.update', { listede: false });
    expect(await a.call('kurucu.liste', {})).toEqual({ names: ['Bora'], gizli: 2 });
    expect((await me(c)).listede).toBe(false);
    // sonradan yönetici olan hesap listede ve sayıda görünmez
    env.srv.app.db.run("INSERT INTO player_flags(player_id, admin, admin_on) VALUES(?, 1, 0)", b.me!.id);
    expect(kurucuListesi(env.srv.app)).toEqual({ names: [], gizli: 2 });
  }, 15_000); // yönetici kodu sınaması (scrypt)

  it('hesap silinince rozet ve liste kaydı silinir; diğer kurucular kalır', async () => {
    env = await setup();
    const codes = kurucuKodlari(env, 2);
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora');
    await redeem(a, codes[0]!); await redeem(b, codes[1]!);
    await a.call('profile.update', { listede: true }); await b.call('profile.update', { listede: true });
    rozetVer(env.srv.app, a.me!.id, 'hata-avcisi');
    const aid = a.me!.id;
    expect(await b.call('kurucu.liste', {})).toEqual({ names: ['Ayşe', 'Bora'], gizli: 0 });
    await a.call('account.delete', {});
    expect(env.srv.app.db.all('SELECT badge FROM player_badges WHERE player_id = ?', aid)).toEqual([]);
    expect(await b.call('kurucu.liste', {})).toEqual({ names: ['Bora'], gizli: 0 });
    expect((await b.call('profile.get', { id: aid })).profile.rozetler).toBeUndefined();
  });

  it('Hata Avcısı: sunucu komutuyla verilir/geri alınır ve yönetim kaydına yazılır; AVCI kodları tek kullanımlık', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora');
    const app = env.srv.app;
    expect(rozetVer(app, a.me!.id, 'hata-avcisi')).toBe(true);
    expect(rozetVer(app, a.me!.id, 'hata-avcisi')).toBe(false); // ikinci kez değişiklik yok
    expect((await me(a)).rozetler).toEqual(['hata-avcisi']);
    // unvan kurucu değildir: liste seçimi ve çerçeve yok
    expect('listede' in (await me(a))).toBe(false);
    expect(app.db.all<{ ip: string; result: string }>("SELECT ip, result FROM promo_log WHERE player_id = ? ORDER BY rowid", a.me!.id))
      .toEqual([{ ip: 'cli', result: 'rozet:hata-avcisi' }, { ip: 'cli', result: 'rozet:hata-avcisi:degisiklik-yok' }]);
    expect(rozetVer(app, a.me!.id, 'hata-avcisi', true)).toBe(true);
    expect((await me(a)).rozetler).toBeUndefined();
    const [avci] = app.run(() => createRozetCodes(app, 'hata-avcisi', 1)) as [string];
    expect(avci).toMatch(/^AVCI-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(await redeem(b, avci)).toMatchObject({ kind: 'odul', rewards: { rozet: ['hata-avcisi'] } });
    expect((await me(b)).rozetler).toEqual(['hata-avcisi']);
    expect(await redeem(a, avci)).toMatchObject({ kind: 'hata', error: 'tukendi' });
  });
});
