import { afterEach, describe, expect, it } from 'vitest';
import type { NetError } from '@odi/net';
import { ADMIN_PAGE, PHOTO_RULES } from '@odi/shared';
import { hashAdminCode } from '../src/codes';
import { receivePhoto } from '../src/foto';
import { createRozetCodes } from '../src/codes';
import { run, setup, type Env, type TC } from './helpers';

/**
 * 1.2.0: "her şey açık" modu her kilidi açar; yöneticinin kilit hediyesi (ödül kutusunda kart, "Al"la açılır); yöneticinin düzenlediği
 * Kurucular listesi; "Kimler mesaj atabilir" (herkes / takım ve arkadaşlar / yalnız arkadaşlar).
 */
let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };
const TEST_ADMIN = 'deneme yönetici';
/** güvenli sohbet kuralı gerçek değeriyle (8 bölüm) */
const adminEnv = () => setup({ adminCodeHash: hashAdminCode(TEST_ADMIN), freeTextCleared: 8 });
async function makeAdmin(e: Env, name: string): Promise<TC> {
  const a = await e.connect(name);
  await a.call('code.redeem', { code: TEST_ADMIN });
  return a;
}
const highest = (e: Env, c: TC) => e.srv.app.db.get<{ highest: number }>('SELECT highest FROM players WHERE id = ?', c.me!.id)!.highest;
const setHighest = (e: Env, c: TC, h: number) => e.srv.app.db.run('UPDATE players SET highest = ? WHERE id = ?', h, c.me!.id);
async function befriend(a: TC, b: TC): Promise<void> {
  const r = await a.call('friends.request', { id: b.me!.id });
  await b.call('friends.respond', { requestId: r.request!.id, accept: true });
}
/** en küçük geçerli JPEG (SOI, APP0, SOF0 256×256, dolgu, EOI) */
function jpeg(): Buffer {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 1, 0, 1, 0, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.alloc(400, 0x11), Buffer.from([0xff, 0xd9])]);
}

describe('"her şey açık" modu her kilidi açar (1.2.0)', () => {
  it('bölüm, yarış, serbest yazı, kamp görevleri, fotoğraf; kapanınca gerçek ilerleme', async () => {
    env = await adminEnv();
    const adm = await makeAdmin(env, 'Yönetici');
    const photo = () => receivePhoto(env!.srv.app, `Bearer ${adm.token}`, jpeg()).status;
    // kapalıyken: hepsi gerçek ilerlemeye göre kilitli
    expect((await err(adm.call('progress.submit', run(20)))).code).toBe('GECERSIZ');
    expect((await err(adm.call('race.create', { level: 15 }))).code).toBe('GECERSIZ');
    expect((await adm.call('comm.state', {})).settings.canFreeText).toBe(false);
    expect((await err(adm.call('kg.claim', { ref: 'hikaye:1' }))).code).toBe('KILIT');
    // yönetici hesabı fotoğrafı her durumda yükleyebilir (1.1.0 kuralı aynı)
    expect(photo()).toBe(200);
    await adm.call('admin.set', { on: true });
    await adm.call('progress.submit', run(20));
    expect(highest(env, adm)).toBe(1); // gerçek ilerleme atlamaz
    const room = (await adm.call('race.create', { level: 15 })).room;
    expect(room.level).toBe(15);
    await adm.call('race.leave', {}).catch(() => undefined);
    expect((await adm.call('comm.state', {})).settings.canFreeText).toBe(true);
    expect((await err(adm.call('kg.claim', { ref: 'hikaye:1' }))).code).not.toBe('KILIT');
    // ayrık oynanan bölüm çevrimdışı taşımada da gerçek ilerlemeyi atlatmaz
    expect((await adm.call('progress.sync', { best: [{ level: 20, stars: 3, score: 100 }] })).highest).toBe(1);
    await adm.call('admin.set', { on: false });
    expect((await err(adm.call('progress.submit', run(21)))).code).toBe('GECERSIZ');
    expect((await adm.call('comm.state', {})).settings.canFreeText).toBe(false);
    expect((await err(adm.call('kg.claim', { ref: 'hikaye:1' }))).code).toBe('KILIT');
  });
});

describe('kilit hediyesi (1.2.0)', () => {
  it('yalnız yönetici gönderir; kart ödül kutusuna düşer, "Al" deyince açılır; gerçek ilerleme ve sıralama değişmez', async () => {
    env = await adminEnv();
    const a = await env.connect('Ayşe');
    const code = (await a.call('profile.update', {})).me.friendCode;
    expect((await err(a.call('admin.unlock.gift', { code, levels: 12 }))).code).toBe('YETKI');
    expect((await err(a.call('admin.unlock.clear', { id: a.me!.id }))).code).toBe('YETKI');
    const adm = await makeAdmin(env, 'Yönetici');
    expect((await err(adm.call('admin.unlock.gift', { code }))).code).toBe('GECERSIZ');
    expect((await err(adm.call('admin.unlock.gift', { code: 'YOKKOD', levels: 3 }))).code).toBe('YOK');
    expect((await err(adm.call('admin.unlock.gift', { code, levels: 41 }))).code).toBe('GECERSIZ'); // şema: en çok 40
    expect((await err(adm.call('admin.unlock.gift', { code, features: ['uydurma' as never] }))).code).toBe('GECERSIZ');
    const { item } = await adm.call('admin.unlock.gift', { code, levels: 12, features: ['friends', 'yazi'], note: 'Test için' });
    expect(item).toMatchObject({ kind: 'kilit', amount: 12, ref: 'friends,yazi', reason: 'Kilit hediyesi: ilk 12 bölüm açık, Arkadaşlar ve özel mesaj, Serbest yazı (Test için)' });
    expect((await a.waitFor('inbox.new')).item.id).toBe(item.id);
    // kart kimliği oyuncuya yönetici kimliği göstermez
    expect(JSON.stringify(item)).not.toContain(adm.me!.id);
    // almadan önce hiçbir kilit açılmaz
    expect((await err(a.call('progress.submit', run(12)))).code).toBe('GECERSIZ');
    expect((await a.call('comm.state', {})).settings.canFreeText).toBe(false);
    expect((await a.call('admin.state', {})).admin).toEqual({ isAdmin: false, on: false });
    // yönetici ekranı bekleyen kartı görür
    expect((await adm.call('admin.player', { id: a.me!.id })).player).toMatchObject({ acikBekleyen: 1 });
    const claim = await a.call('inbox.claim', { id: item.id });
    expect(claim.acik).toEqual({ levels: 12, features: ['friends', 'yazi'] });
    expect(claim.wallet).toEqual((await a.call('wallet.get', {})).wallet); // cüzdana bir şey eklenmez
    await a.call('progress.submit', run(12, { stars: 3 }));
    expect((await err(a.call('progress.submit', run(13)))).code).toBe('GECERSIZ');
    expect(highest(env, a)).toBe(1); // ilk 12 bölüm açık ama sıradaki bölüm yine 1
    expect((await a.call('comm.state', {})).settings.canFreeText).toBe(true);
    // çevrimdışı ilerleme taşıma ayrık bölümle gerçek ilerlemeyi atlatmaz
    expect((await a.call('progress.sync', { best: [{ level: 12, stars: 3, score: 100 }] })).highest).toBe(1);
    // ikinci hediye birikir; profil (hello yanıtı) açılımları taşır
    const g2 = await adm.call('admin.unlock.gift', { code, levels: 5, features: ['team'] });
    await a.call('inbox.claim', { id: g2.item.id });
    const again = await env.connect(undefined, a.token);
    expect(again.me!.acik).toEqual({ levels: 12, features: ['friends', 'yazi', 'team'] });
    expect((await adm.call('admin.player', { id: a.me!.id })).player.acik).toEqual({ levels: 12, features: ['friends', 'yazi', 'team'] });
    // veren yönetici denetim için kayıtlı; yönetim kaydı
    expect(env.srv.app.db.get<{ granted_by: string }>('SELECT granted_by FROM player_unlocks WHERE player_id = ?', a.me!.id)!.granted_by).toBe(adm.me!.id);
    expect(env.srv.app.db.all<{ result: string }>("SELECT result FROM promo_log WHERE ip = 'panel' AND result LIKE 'kilit:%'").length).toBe(2);
    // kaldırma: hediye açılımları ve alınmamış kartlar gider, gerçek ilerleme kalır
    const g3 = await adm.call('admin.unlock.gift', { code, features: ['hepsi'] });
    await adm.call('admin.unlock.clear', { id: a.me!.id });
    expect((await err(again.call('inbox.claim', { id: g3.item.id }))).code).toBe('YOK');
    expect((await err(again.call('progress.submit', run(12)))).code).toBe('GECERSIZ');
    expect((await again.call('comm.state', {})).settings.canFreeText).toBe(false);
    expect((await env.connect(undefined, a.token)).me!.acik).toBeUndefined();
    expect(env.srv.app.db.get('SELECT 1 AS x FROM level_best WHERE player_id = ? AND level = 12', a.me!.id)).toBeTruthy();
  });

  it('yer açılımları sunucu kapılarında: kamp görevleri, fotoğraf (Dolap), "hepsi"', async () => {
    env = await adminEnv();
    const a = await env.connect('Bora');
    const code = (await a.call('profile.update', {})).me.friendCode;
    const adm = await makeAdmin(env, 'Yönetici');
    const photo = () => receivePhoto(env!.srv.app, `Bearer ${a.token}`, jpeg()).status;
    expect(photo()).toBe(403);
    expect((await err(a.call('kg.claim', { ref: 'hikaye:1' }))).code).toBe('KILIT');
    const g = await adm.call('admin.unlock.gift', { code, features: ['shop', 'gorev'] });
    await a.call('inbox.claim', { id: g.item.id });
    expect(photo()).toBe(200);
    expect((await err(a.call('kg.claim', { ref: 'hikaye:1' }))).code).not.toBe('KILIT');
    expect((await a.call('comm.state', {})).settings.canFreeText).toBe(false);
    const h = await adm.call('admin.unlock.gift', { code, features: ['hepsi'], levels: 40 });
    await a.call('inbox.claim', { id: h.item.id });
    expect((await a.call('comm.state', {})).settings.canFreeText).toBe(true);
    await a.call('progress.submit', run(40));
    expect(highest(env, a)).toBe(1);
    expect(PHOTO_RULES.minCleared).toBeGreaterThan(0);
  });
});

describe('Kurucular listesini yönetici düzenler (1.2.0)', () => {
  it('düzenlenmeden eski kural; ilk düzenlemede listede görünenler taşınır; ekle, düzenle, sırala, çıkar; kendisi gizleyen görünmez', async () => {
    env = await adminEnv();
    const [k1, k2, k3] = env.srv.app.run(() => createRozetCodes(env!.srv.app, 'kurucu', 3)) as [string, string, string];
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora'); const c = await env.connect('Cem'); const d = await env.connect('Deniz');
    for (const [p, k] of [[a, k1], [b, k2], [c, k3]] as const) await p.call('code.redeem', { code: k });
    await a.call('profile.update', { listede: true }); await b.call('profile.update', { listede: true });
    expect(await d.call('kurucu.liste', {})).toEqual({ names: ['Ayşe', 'Bora'], gizli: 1 });
    expect((await err(d.call('admin.kurucu.list', {}))).code).toBe('YETKI');
    expect((await err(d.call('admin.kurucu.set', { code: 'ABCDEF' }))).code).toBe('YETKI');
    expect((await err(d.call('admin.kurucu.move', { id: a.me!.id, sira: 1 }))).code).toBe('YETKI');
    expect((await err(d.call('admin.kurucu.remove', { id: a.me!.id }))).code).toBe('YETKI');
    const adm = await makeAdmin(env, 'Yönetici');
    const pre = await adm.call('admin.kurucu.list', {});
    expect(pre).toMatchObject({ kuratorlu: false, total: 2 });
    expect(pre.items.map((x) => [x.name, x.sira])).toEqual([['Ayşe', 1], ['Bora', 2]]);
    // ilk değişiklik: Deniz (rozetsiz) eklenir, eski liste taşınır
    const dCode = (await d.call('profile.update', {})).me.friendCode;
    const added = await adm.call('admin.kurucu.set', { code: dCode });
    expect(added.item).toMatchObject({ name: 'Deniz', sira: 3, rozet: false });
    await adm.call('admin.kurucu.set', { id: d.me!.id, gorunenAd: 'Deniz Hoca', unvan: 'Ses tasarımı', fotoGizli: true });
    await adm.call('admin.kurucu.move', { id: d.me!.id, sira: 1 });
    // Cem rozetli ama "Adım listede görünsün" kapalı: listeye eklense de herkese açık ekranda görünmez
    await adm.call('admin.kurucu.set', { code: (await c.call('profile.update', {})).me.friendCode });
    const list = await adm.call('admin.kurucu.list', {});
    expect(list.kuratorlu).toBe(true);
    expect(list.items.map((x) => [x.name, x.sira, x.gorunenAd, x.unvan, x.fotoGizli, !!x.kendisiGizledi])).toEqual([
      ['Deniz', 1, 'Deniz Hoca', 'Ses tasarımı', true, false], ['Ayşe', 2, '', '', false, false], ['Bora', 3, '', '', false, false], ['Cem', 4, '', '', false, true]]);
    const pub = await d.call('kurucu.liste', {});
    expect(pub.names).toEqual(['Deniz Hoca', 'Ayşe', 'Bora']);
    expect(pub.kisiler![0]).toEqual({ id: d.me!.id, ad: 'Deniz Hoca', unvan: 'Ses tasarımı', color: expect.any(Number) });
    await adm.call('admin.kurucu.remove', { id: a.me!.id });
    await adm.call('admin.kurucu.move', { id: b.me!.id, sira: 1 });
    expect((await d.call('kurucu.liste', {})).names).toEqual(['Bora', 'Deniz Hoca']);
    expect((await adm.call('admin.kurucu.list', {})).items.map((x) => x.sira)).toEqual([1, 2, 3]);
    // her şey çıkarılırsa ekran boş (eski kurala dönmez)
    for (const p of [b, c, d]) await adm.call('admin.kurucu.remove', { id: p.me!.id });
    expect(await d.call('kurucu.liste', {})).toEqual({ names: [], gizli: 0, kisiler: [] });
    expect((await err(adm.call('admin.kurucu.remove', { id: d.me!.id }))).code).toBe('YOK');
    expect((await err(adm.call('admin.kurucu.set', { id: d.me!.id, unvan: 'x' }))).code).toBe('YOK');
    expect(env.srv.app.db.all<{ result: string }>("SELECT result FROM promo_log WHERE ip = 'panel' AND result LIKE 'kurucu-%'").length).toBeGreaterThan(5);
    expect(ADMIN_PAGE).toBeGreaterThan(3);
  });
});

describe('Kimler mesaj atabilir (1.2.0)', () => {
  it('izin tablosu: herkes / takım ve arkadaşlar / yalnız arkadaşlar × arkadaş / takım arkadaşı / yabancı / engellenen', async () => {
    env = await setup();
    const r = await env.connect('Alıcı'); const f = await env.connect('Arkadaş'); const t = await env.connect('Takımdaş'); const x = await env.connect('Yabancı'); const bl = await env.connect('Engelli');
    for (const p of [r, f, t, x, bl]) setHighest(env, p, 6); // özel mesaj kilidi açık (4 bölüm)
    await befriend(r, f);
    const team = await r.call('team.create', { name: 'Kulaklar', emblem: '👂' });
    await t.call('team.join', { teamId: team.team.id });
    await r.call('players.block', { id: bl.me!.id });
    expect((await r.call('comm.state', {})).settings.dmKimden).toBe('herkes');
    const can = async (from: TC) => (await from.call('profile.card', { id: r.me!.id })).card.canMessage;
    const send = async (from: TC) => { env!.clock.advance(5000); try { await from.call('dm.send', { to: r.me!.id, text: 'selam' }); return true; } catch { return false; } };
    const matrix: Record<string, boolean[]> = {};
    for (const k of ['herkes', 'takim', 'arkadas'] as const) {
      await r.call('comm.settings', { dmKimden: k });
      matrix[k] = [];
      for (const s of [f, t, x, bl]) { const c = await can(s); const ok = await send(s); expect(ok, `${k}`).toBe(c); matrix[k]!.push(ok); }
    }
    expect(matrix).toEqual({ herkes: [true, true, true, false], takim: [true, true, false, false], arkadas: [true, false, false, false] });
    // gerekçe kartta yazılır
    expect((await x.call('profile.card', { id: r.me!.id })).card.dmReason).toContain('yalnız arkadaşlarından');
    // engellenen kişiye neden söylenmez (engellendiğini öğrenmesin)
    expect((await bl.call('profile.card', { id: r.me!.id })).card).toMatchObject({ canMessage: false });
    expect((await bl.call('profile.card', { id: r.me!.id })).card.dmReason).toBeUndefined();
    // yabancıyla başlayan konuşma iki tarafın mesaj kutusunda
    await r.call('comm.settings', { dmKimden: 'herkes' });
    expect((await r.call('dm.threads', {})).threads.map((th) => th.other.id)).toContain(x.me!.id);
    expect((await x.call('dm.threads', {})).threads.map((th) => th.other.id)).toContain(r.me!.id);
  });

  it('yabancıya yazmak için iki tarafın da mesaj kilidi açık olmalı; kilit hediyesi ya da her şey açık da açar; ayarlar doğrulanır', async () => {
    env = await setup({ adminCodeHash: hashAdminCode(TEST_ADMIN) });
    const r = await env.connect('Alıcı'); const x = await env.connect('Yeni');
    const xCode = (await x.call('profile.update', {})).me.friendCode;
    expect((await err(x.call('dm.send', { to: r.me!.id, text: 'selam' }))).message).toContain('bölüm geçince açılır');
    setHighest(env, x, 6);
    // alıcı yeni başladı: yabancıdan mesaj gelmez
    expect((await err(x.call('dm.send', { to: r.me!.id, text: 'selam' }))).message).toContain('yeni başladı');
    setHighest(env, r, 6); setHighest(env, x, 1);
    const adm = await makeAdmin(env, 'Yönetici');
    const g = await adm.call('admin.unlock.gift', { code: xCode, features: ['friends'] });
    await x.call('inbox.claim', { id: g.item.id });
    await x.call('dm.send', { to: r.me!.id, text: 'hediyeyle açıldı' });
    expect((await r.waitFor('dm.message')).msg.text).toBe('hediyeyle açıldı');
    // yönetici "her şey açık" modunda yazabilir
    await adm.call('admin.set', { on: true });
    env.clock.advance(5000);
    await adm.call('dm.send', { to: r.me!.id, text: 'yönetici' });
    expect((await err(r.call('comm.settings', { dmKimden: 'kimse' as never }))).code).toBe('GECERSIZ');
  });
});
