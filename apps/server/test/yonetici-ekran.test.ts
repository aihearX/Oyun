import { afterEach, describe, expect, it } from 'vitest';
import type { NetError } from '@odi/net';
import { ADMIN_PAGE, PHOTO_RULES, photoUrl } from '@odi/shared';
import { hashAdminCode } from '../src/codes';
import { checkJpeg } from '../src/foto';
import { configFromEnv } from '../src/server';
import { Db } from '../src/db';
import { MIGRATIONS, runMigrations } from '../src/migrations';
import { setup, type Env, type TC } from './helpers';

/**
 * 1.1.0: yönetici ekranı (Profil › Admin), profil fotoğrafı (POST /foto, GET /foto/<id>.jpg) ve sürüm ucu (GET /surum).
 * Yönetici kodu sınaması scrypt'tir: süre sınırları codes.test.ts'teki gibi geniş.
 */
let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };
const TEST_ADMIN = 'deneme yönetici';
const adminEnv = () => setup({ adminCodeHash: hashAdminCode(TEST_ADMIN) });
async function makeAdmin(e: Env, name: string): Promise<TC> {
  const a = await e.connect(name);
  expect((await a.call('code.redeem', { code: TEST_ADMIN })).result).toEqual({ kind: 'yonetici', admin: { isAdmin: true, on: false } });
  return a;
}

/** en küçük geçerli JPEG başlığı (SOI, APP0, SOF0 w×h) + dolgu + EOI */
function jpeg(w = 256, h = 256, pad = 400): Buffer {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.alloc(pad, 0x11), Buffer.from([0xff, 0xd9])]);
}
const upload = (e: Env, token: string, body: Buffer | string) =>
  fetch(`${e.srv.httpUrl}/foto`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': typeof body === 'string' ? 'text/plain' : 'image/jpeg' }, body: typeof body === 'string' ? body : new Uint8Array(body) });
/** fotoğraf Dolap'la açılır (6 bölüm): testte doğrudan ilerleme yazılır */
const unlock = (e: Env, c: TC) => e.srv.app.db.run('UPDATE players SET highest = ? WHERE id = ?', PHOTO_RULES.minCleared + 1, c.me!.id);

describe('yönetici kodu (1.1.0)', () => {
  it('kod hesabı yönetici yapar ama "her şey açık" modunu açmaz; ekran işlemleri yalnız yönetici hesabında', async () => {
    env = await adminEnv();
    const a = await env.connect('Ayşe');
    for (const [op, d] of [['admin.players', {}], ['admin.player', { id: a.me!.id }], ['admin.messages', {}], ['admin.reports', {}], ['admin.photos', {}],
      ['admin.gift', { all: true, jeton: 5 }], ['admin.mute', { id: a.me!.id, days: 1 }], ['code.list', {}]] as const) {
      expect((await err(a.call(op as 'admin.players', d as never))).code, op).toBe('YETKI');
    }
    const adm = await makeAdmin(env, 'Yönetici');
    expect((await adm.call('admin.state', {})).admin).toEqual({ isAdmin: true, on: false });
    // mod kapalıyken de kodlar ve oyuncu listesi açık
    expect((await adm.call('code.list', {})).codes).toEqual([]);
    expect((await adm.call('admin.players', {})).total).toBe(2);
    // doğrulama
    expect((await err(adm.call('admin.gift', { jeton: 5 } as never))).code).toBe('GECERSIZ');
    expect((await err(adm.call('admin.players', { query: 'x'.repeat(41) }))).code).toBe('GECERSIZ');
  }, 15_000);
});

describe('göç 19: eski kodla açılmış "her şey açık" modu bir kez kapanır', () => {
  it('admin kalır, admin_on 0 olur', () => {
    const db = new Db(':memory:');
    db.run('INSERT INTO player_flags(player_id, admin, admin_on, admin_at) VALUES(?, 1, 1, 1)', 'p1');
    const i = MIGRATIONS.findIndex((m) => m.name === 'yonetici-modu-kapali');
    expect(i).toBeGreaterThan(0);
    db.raw.exec(`PRAGMA user_version = ${i}`);
    runMigrations(db.raw);
    expect(db.get('SELECT admin, admin_on FROM player_flags WHERE player_id = ?', 'p1')).toEqual({ admin: 1, admin_on: 0 });
    db.close();
  });
});

describe('yönetici ekranı: oyuncular, mesajlar, şikâyetler, hediye', () => {
  it('oyuncu listesi son bağlantıya göre, arama, ayrıntı; mesajlar iki yönlü ve sayfalı; şikâyetler; susturma', async () => {
    env = await adminEnv();
    const app = env.srv.app;
    const adm = await makeAdmin(env, 'Yönetici');
    const a = await env.connect('Ayşe'); env.clock.advance(1000);
    const b = await env.connect('Bora'); env.clock.advance(1000);
    b.close(); await new Promise((r) => setTimeout(r, 150));
    const list = (await adm.call('admin.players', {})).players;
    // çevrimiçiler önce; Bora çevrimdışı
    expect(list.map((p) => p.name).at(-1)).toBe('Bora');
    expect(list.find((p) => p.name === 'Bora')).toMatchObject({ online: false, highest: 1, jeton: expect.any(Number), friendCode: b.me!.friendCode });
    expect(list.find((p) => p.name === 'Yönetici')!.admin).toBe(true);
    expect((await adm.call('admin.players', { query: 'ayş' })).players.map((p) => p.name)).toEqual(['Ayşe']);
    expect((await adm.call('admin.players', { query: b.me!.friendCode.toLowerCase() })).players.map((p) => p.name)).toEqual(['Bora']);

    // özel mesaj ve sohbet
    const b2 = await env.connect('Bora', b.token);
    await a.call('friends.request', { code: b2.me!.friendCode });
    const req = (await b2.call('friends.requests', {})).incoming[0]!;
    await b2.call('friends.respond', { requestId: req.id, accept: true });
    for (let i = 0; i < ADMIN_PAGE + 2; i++) { env.clock.advance(5_000); await a.call('dm.send', { to: b2.me!.id, text: `merhaba ${i}` }); }
    env.clock.advance(5_000);
    const back = (await b2.call('dm.send', { to: a.me!.id, text: 'selam Ayşe' })).msg;
    await a.call('chat.join', { room: 'genel' });
    env.clock.advance(5_000);
    await a.call('chat.send', { room: 'genel', text: 'herkese merhaba' });
    const p1 = await adm.call('admin.messages', { id: a.me!.id });
    expect(p1.messages.length).toBe(ADMIN_PAGE);
    expect(p1.hasMore).toBe(true);
    expect(p1.messages[0]).toMatchObject({ kind: 'sohbet', text: 'herkese merhaba', fromName: 'Ayşe', room: 'Genel sohbet' });
    expect(p1.messages[1]).toMatchObject({ kind: 'dm', text: 'selam Ayşe', fromName: 'Bora', toName: 'Ayşe' });
    const p2 = await adm.call('admin.messages', { id: a.me!.id, before: p1.messages.at(-1)!.at });
    expect(p2.messages.length).toBe(ADMIN_PAGE + 2 + 2 - ADMIN_PAGE);
    expect(p2.hasMore).toBe(false);
    expect((await adm.call('admin.messages', { id: a.me!.id, kind: 'sohbet' })).messages.map((m) => m.text)).toEqual(['herkese merhaba']);
    expect((await adm.call('admin.messages', {})).messages[0]!.text).toBe('herkese merhaba');

    // şikâyet: özel mesaj → metniyle
    await a.call('dm.report', { msgId: back.id });
    const reps = (await adm.call('admin.reports', {})).reports;
    expect(reps[0]).toMatchObject({ kind: 'dm', targetName: 'Bora', reporterName: 'Ayşe', text: 'selam Ayşe' });

    // ayrıntı
    const d = (await adm.call('admin.player', { id: b2.me!.id })).player;
    expect(d).toMatchObject({ name: 'Bora', friends: 1, dmCount: 1, reportsBy: 0, adminOn: false });
    expect(d.reportsAgainst.length).toBe(1);

    // susturma: sohbet ve özel mesaj kapanır, 0 ile açılır
    const m = await adm.call('admin.mute', { id: b2.me!.id, days: 2 });
    expect(m.mutedUntil).toBe(app.now() + 2 * 86_400_000);
    expect((await err(b2.call('dm.send', { to: a.me!.id, text: 'x' }))).code).toBeTruthy();
    expect((await adm.call('admin.mute', { id: b2.me!.id, days: 0 })).mutedUntil).toBe(0);
    expect(app.db.all<{ result: string }>("SELECT result FROM promo_log WHERE ip = 'panel'").map((r) => r.result.split(':')[0])).toEqual(['sustur', 'sustur']);
  }, 20_000);

  it('hediye: arkadaş koduyla tek oyuncuya ya da herkese (silinmiş hesaplar hariç) ödül kutusuna', async () => {
    env = await adminEnv();
    const app = env.srv.app;
    const adm = await makeAdmin(env, 'Yönetici');
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora'); const c = await env.connect('Cem');
    await c.call('account.delete', {});
    const hediye = async (x: TC) => (await x.call('inbox.list', {})).items.filter((i) => i.ref === 'hediye');
    expect((await adm.call('admin.gift', { code: a.me!.friendCode.toLowerCase(), jeton: 250, note: 'Teşekkürler!' })).count).toBe(1);
    expect((await hediye(a)).map((i) => [i.kind, i.amount, i.reason])).toEqual([['jeton', 250, 'Teşekkürler!']]);
    expect((await err(adm.call('admin.gift', { code: 'YOKYOK', jeton: 1 }))).code).toBe('YOK');
    expect((await err(adm.call('admin.gift', { code: a.me!.friendCode }))).code).toBe('GECERSIZ');
    b.drain();
    const r = await adm.call('admin.gift', { all: true, kristal: 20, kalkan: 1 });
    expect(r.count).toBe(3); // Yönetici, Ayşe, Bora (Cem silindi)
    await b.waitFor('inbox.new', (x) => x.item.kind === 'kristal');
    expect((await hediye(b)).map((i) => [i.kind, i.amount, i.reason]).sort()).toEqual([['kalkan', 1, "ODİ'den hediye"], ['kristal', 20, "ODİ'den hediye"]]);
    expect(app.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM inbox WHERE player_id = ? AND ref = 'hediye'", c.me!.id)!.n).toBe(0);
    const claimed = await b.call('inbox.claim', { id: (await hediye(b)).find((i) => i.kind === 'kristal')!.id });
    expect(claimed.item.amount).toBe(20);
    expect(app.db.all<{ result: string }>("SELECT result FROM promo_log WHERE ip = 'panel' ORDER BY at").map((x) => x.result.split(':').slice(0, 2).join(':'))).toEqual([`hediye:${a.me!.friendCode}`, 'hediye:hepsi']);
  }, 15_000);
});

describe('profil fotoğrafı (POST /foto, GET /foto/<id>.jpg)', () => {
  it('JPEG denetimi', () => {
    expect(checkJpeg(jpeg()).ok).toBe(true);
    expect(checkJpeg(Buffer.from('GIF89a' + 'x'.repeat(200))).ok).toBe(false);
    expect(checkJpeg(jpeg(4000, 4000)).ok).toBe(false);
    expect(checkJpeg(jpeg(256, 256, PHOTO_RULES.maxBytes)).ok).toBe(false);
    expect(photoUrl('wss://odi.example.com', 'p1', 5)).toBe('https://odi.example.com/foto/p1.jpg?v=5');
    expect(photoUrl('ws://127.0.0.1:8787', 'p1', undefined)).toBe('');
  });

  it('yükleme oturum ister, Dolap açılınca; herkes görür; şikâyetle gizlenir; yönetici siler; hesap silinince gider', async () => {
    env = await adminEnv();
    const app = env.srv.app;
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora');
    expect((await upload(env, 'yanlis0000000000000000', jpeg())).status).toBe(401);
    expect((await fetch(`${env.srv.httpUrl}/foto`)).status).toBe(405);
    // WebView'den (başka köken) çağrılır: ön uçuş (Authorization + content-type) ve yanıtlar CORS başlıklı
    const pre = await fetch(`${env.srv.httpUrl}/foto`, { method: 'OPTIONS', headers: { origin: 'https://uygulama.example', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('*');
    expect(pre.headers.get('access-control-allow-methods')).toContain('POST');
    expect(pre.headers.get('access-control-allow-headers')).toMatch(/authorization/);
    expect(pre.headers.get('access-control-allow-headers')).toMatch(/content-type/);
    // Dolap açılmadan yok
    expect((await upload(env, a.token, jpeg())).status).toBe(403);
    unlock(env, a);
    expect((await upload(env, a.token, Buffer.from('GIF89a' + 'x'.repeat(300)))).status).toBe(415);
    expect((await upload(env, a.token, Buffer.alloc(200_000, 1))).status).toBe(413);
    b.drain();
    const ok = await upload(env, a.token, jpeg());
    expect(ok.status).toBe(200);
    expect(ok.headers.get('access-control-allow-origin')).toBe('*');
    const v = ((await ok.json()) as { v: number }).v;
    expect(v).toBeGreaterThan(0);
    // çevrimiçi herkese duyuru; profilde sürüm; toplu sorgu
    expect(await b.waitFor('photo.changed')).toEqual({ id: a.me!.id, v });
    expect((await b.call('profile.get', { id: a.me!.id })).profile.photo).toBe(v);
    expect((await b.call('photo.of', { ids: [a.me!.id, b.me!.id] })).photos).toEqual({ [a.me!.id]: v });
    const img = await fetch(`${env.srv.httpUrl}/foto/${a.me!.id}.jpg?v=${v}`);
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type')).toBe('image/jpeg');
    expect(img.headers.get('cache-control')).toContain('immutable');
    expect(img.headers.get('access-control-allow-origin')).toBe('*');
    expect(Buffer.from(await img.arrayBuffer()).equals(jpeg())).toBe(true);
    expect((await fetch(`${env.srv.httpUrl}/foto/${b.me!.id}.jpg`)).status).toBe(404);
    // data URL da olur; sürüm artar
    const ok2 = await upload(env, a.token, `data:image/jpeg;base64,${jpeg(128, 128).toString('base64')}`);
    expect(ok2.status).toBe(200);
    const v2 = ((await ok2.json()) as { v: number }).v;
    expect(v2).toBeGreaterThan(v);

    // şikâyet: eşikte gizlenir (sohbet susturması yok)
    const reporters: TC[] = [b];
    for (let i = 1; i < PHOTO_RULES.reportsToHide; i++) reporters.push(await env.connect(`Şikâyetçi${i}`));
    for (const r of reporters.slice(0, -1)) await r.call('players.report', { id: a.me!.id, reason: 'foto' });
    expect((await b.call('photo.of', { ids: [a.me!.id] })).photos[a.me!.id]).toBe(v2);
    await reporters.at(-1)!.call('players.report', { id: a.me!.id, reason: 'foto' });
    expect((await b.call('photo.of', { ids: [a.me!.id] })).photos).toEqual({});
    expect((await fetch(`${env.srv.httpUrl}/foto/${a.me!.id}.jpg?v=${v2}`)).status).toBe(404);
    expect(app.player(a.me!.id).chat_muted_until).toBe(0);
    expect((await err(b.call('players.report', { id: a.me!.id, reason: 'foto' }))).code).toBe('YOK');

    // yönetici: şikâyetli fotoğraflar, geri aç, sil
    const adm = await makeAdmin(env, 'Yönetici');
    const rep = (await adm.call('admin.photos', { filter: 'sikayet' })).photos;
    expect(rep).toEqual([expect.objectContaining({ id: a.me!.id, hidden: true, reports: PHOTO_RULES.reportsToHide, v: v2 })]);
    expect((await adm.call('admin.reports', {})).reports.filter((r) => r.kind === 'foto').length).toBe(PHOTO_RULES.reportsToHide);
    expect((await adm.call('admin.photo.data', { id: a.me!.id })).data).toBe(`data:image/jpeg;base64,${jpeg(128, 128).toString('base64')}`);
    await adm.call('admin.photo.show', { id: a.me!.id });
    expect((await b.call('photo.of', { ids: [a.me!.id] })).photos[a.me!.id]).toBe(v2);
    expect((await adm.call('admin.photos', {})).photos.map((p) => p.id)).toEqual([a.me!.id]);
    await adm.call('admin.photo.delete', { id: a.me!.id });
    expect((await b.call('photo.of', { ids: [a.me!.id] })).photos).toEqual({});
    expect((await err(adm.call('admin.photo.delete', { id: a.me!.id }))).code).toBe('YOK');

    // kendi kaldırma ve hesap silme
    expect((await upload(env, a.token, jpeg())).status).toBe(200);
    expect((await a.call('photo.remove', {})).me.photo).toBeUndefined();
    expect((await upload(env, a.token, jpeg())).status).toBe(200);
    await a.call('account.delete', {});
    expect(app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM player_photos WHERE player_id = ?', a.me!.id)!.n).toBe(0);
  }, 20_000);

  it('saatlik yükleme sınırı ve susturulan oyuncu', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    unlock(env, a);
    for (let i = 0; i < PHOTO_RULES.perHour; i++) expect((await upload(env, a.token, jpeg())).status).toBe(200);
    expect((await upload(env, a.token, jpeg())).status).toBe(429);
    env.clock.advance(3_600_001);
    env.srv.app.db.run('UPDATE players SET chat_muted_until = ? WHERE id = ?', env.clock.t + 1000, a.me!.id);
    expect((await upload(env, a.token, jpeg())).status).toBe(403);
  });
});

describe('GET /surum (açılıştaki güncelleme sorusu)', () => {
  it('ortamdan son sürümler; yoksa boş; 5 dk önbellek', async () => {
    expect(configFromEnv({ ODI_SON_SURUM_IOS: '1.1.0', ODI_SON_SURUM_ANDROID: ' 1.1.2 ' }).sonSurum).toEqual({ ios: '1.1.0', android: '1.1.2' });
    expect(configFromEnv({ ODI_SON_SURUM_IOS: '1.1.0' }).sonSurum).toEqual({ ios: '1.1.0' });
    expect(configFromEnv({ ODI_SON_SURUM_IOS: 'yeni' }).sonSurum).toBeUndefined();
    env = await setup({ sonSurum: { android: '1.2.0' } });
    const r = await fetch(`${env.srv.httpUrl}/surum`);
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('public, max-age=300');
    expect(r.headers.get('access-control-allow-origin')).toBe('*');
    expect(await r.json()).toEqual({ android: '1.2.0' });
    await env.close();
    env = await setup();
    expect(await (await fetch(`${env.srv.httpUrl}/surum`)).json()).toEqual({});
  });
  it('1.3.0: ODI_MAGAZA_GIZLI=1 iken "magaza":"gizli" (istemci Mağaza girişlerini gizler)', async () => {
    expect(configFromEnv({ ODI_MAGAZA_GIZLI: '1' }).magazaGizli).toBe(true);
    expect(configFromEnv({}).magazaGizli).toBeUndefined();
    env = await setup({ magazaGizli: true, sonSurum: { ios: '1.3.0' } });
    expect(await (await fetch(`${env.srv.httpUrl}/surum`)).json()).toEqual({ ios: '1.3.0', magaza: 'gizli' });
  });
});
