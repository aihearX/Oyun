import { afterEach, describe, expect, it } from 'vitest';
import { NetError } from '@odi/net';
import { maskProfanity, hasProfanity } from '../src/profanity';
import { dmRoom, teamRoom } from '../src/chat';
import { setup, sleep, waitStatus, type Env } from './helpers';

let env: Env;
afterEach(async () => { await env?.close(); });

const err = async (p: Promise<unknown>): Promise<NetError> => {
  try { await p; } catch (e) { return e as NetError; }
  throw new Error('hata bekleniyordu');
};

describe('kimlik ve oturum', () => {
  it('yeni oyuncu: gizli anahtar, arkadaş kodu, varsayılan isim; anahtarla yeniden bağlanma', async () => {
    env = await setup();
    const a = await env.connect();
    expect(a.token).toMatch(/^[0-9a-f]{64}$/);
    expect(a.me!.friendCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(a.me!.name).toMatch(/^Odi\d{4}$/);
    expect(a.me!.token).toBeUndefined();
    const id = a.me!.id;
    a.close();
    const again = await env.connect(undefined, a.token);
    expect(again.me!.id).toBe(id);
    // HTTP sağlık
    const h = await (await fetch(env.srv.httpUrl + '/saglik')).json();
    expect(h).toMatchObject({ ok: true, players: 1, online: 1 });
    expect(await (await fetch(env.srv.httpUrl + '/')).text()).toContain('ODİ');
  });

  it('aynı anahtar ikinci bağlantıdan gelince eskisi atılır', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    expect(a.me!.name).toBe('Ayşe');
    const b = await env.connect(undefined, a.token);
    const k = await a.waitFor('kicked');
    expect(k.reason).toContain('başka bir cihazda');
    await waitStatus(a, 'kapalı');
    expect(b.status).toBe('bağlı');
    expect(b.me!.id).toBe(a.me!.id);
  });

  it('isim doğrulama ve küfür filtresi', async () => {
    env = await setup();
    const a = await env.connect('Çağrı_Öz 7');
    expect(a.me!.name).toBe('Çağrı_Öz 7');
    expect((await err(a.call('profile.update', { name: 'ab' }))).code).toBe('ISIM');
    expect((await err(a.call('profile.update', { name: 'Kötü<script>' }))).code).toBe('ISIM');
    expect((await err(a.call('profile.update', { name: 'S1kt1r Git' }))).code).toBe('ISIM');
    const r = await a.call('profile.update', { name: 'Şükrü Işık', color: 0x123456 });
    expect(r.me.name).toBe('Şükrü Işık');
    expect(a.me!.name).toBe('Şükrü Işık');
    // küfürlü kayıt ismi varsayılana düşer
    const b = await env.connect('orospu');
    expect(b.me!.name).toMatch(/^Odi\d{4}$/);
    expect(hasProfanity('Ali Veli')).toBe(false);
    expect(hasProfanity('Nigar Şikayet')).toBe(false);
    expect(maskProfanity('selam amk naber').text).toBe('selam *** naber');
    expect(maskProfanity('FUUUCK this').text).toBe('****** this');
  });

  it('şema doğrulama, bilinmeyen işlem, oturumsuz istek, hız sınırı', async () => {
    env = await setup({ msgPerSec: 30 });
    const a = await env.connect();
    expect((await err(a.call('progress.submit', { level: 99 } as never))).code).toBe('GECERSIZ');
    expect((await err(a.call('nope' as never, {} as never))).code).toBe('BILINMEYEN');
    // ham soket: hello olmadan istek ve 8 KB sınırı
    const ws = new WebSocket(env.srv.url);
    await new Promise((r) => { ws.onopen = r; });
    const got: string[] = [];
    ws.onmessage = (e) => got.push(String(e.data));
    ws.send(JSON.stringify({ t: 'req', id: 1, op: 'wallet.get', data: {} }));
    await sleep(100);
    expect(JSON.parse(got[0]!)).toMatchObject({ id: 1, ok: false, code: 'OTURUM' });
    const closed = new Promise<number>((r) => { ws.onclose = (e) => r(e.code); });
    ws.send(JSON.stringify({ t: 'req', id: 2, op: 'hello', data: { version: 1, name: 'x'.repeat(9000) } }));
    expect(await closed).toBe(1009);
    // hız sınırı: 30/sn üstü reddedilir
    const results = await Promise.allSettled(Array.from({ length: 45 }, () => a.call('wallet.get', {})));
    const limited = results.filter((r) => r.status === 'rejected' && (r.reason as NetError).code === 'HIZ');
    expect(limited.length).toBeGreaterThan(5);
  });
});

describe('arkadaşlar', () => {
  it('kodla karşılıklı ekleme, presence, listeleme, silme', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    const b = await env.connect('Bora');
    const r = await a.call('friends.add', { code: b.me!.friendCode.toLowerCase() });
    expect(r.friend.id).toBe(b.me!.id);
    const upd = await b.waitFor('friend.updated');
    expect(upd.friend.id).toBe(a.me!.id);
    expect((await b.call('friends.list', {})).friends.map((f) => f.id)).toEqual([a.me!.id]);
    expect((await a.call('friends.list', {})).friends[0]!.online).toBe(true);
    expect((await err(a.call('friends.add', { code: a.me!.friendCode }))).code).toBe('GECERSIZ');
    expect((await err(a.call('friends.add', { code: 'ZZZZZZ' }))).code).toBe('YOK');
    b.close();
    expect(await a.waitFor('presence', (p) => p.id === b.me!.id)).toEqual({ id: b.me!.id, online: false });
    const b2 = await env.connect(undefined, b.token);
    expect(await a.waitFor('presence', (p) => p.id === b2.me!.id)).toEqual({ id: b2.me!.id, online: true });
    await a.call('friends.remove', { id: b.me!.id });
    expect((await b2.call('friends.list', {})).friends).toEqual([]);
  });
});

describe('sohbet', () => {
  it('genel/takım/dm odaları, filtre, hız sınırı, geçmiş', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    const b = await env.connect('Bora');
    const c = await env.connect('Cem');
    await a.call('chat.join', { room: 'genel' });
    await b.call('chat.join', { room: 'genel' });
    const sent = await a.call('chat.send', { room: 'genel', text: '  merhaba   amk  dünya ' });
    expect(sent.msg.text).toBe('merhaba *** dünya');
    expect((await b.waitFor('chat')).msg.text).toBe('merhaba *** dünya');
    // hız sınırı (sunucu saati)
    expect((await err(a.call('chat.send', { room: 'genel', text: 'tekrar' }))).code).toBe('HIZ');
    env.clock.advance(1300);
    await a.call('chat.send', { room: 'genel', text: 'tekrar' });
    expect((await err(a.call('chat.send', { room: 'genel', text: 'x'.repeat(201) }))).code).toBe('GECERSIZ');
    // geçmiş
    const h = await c.call('chat.join', { room: 'genel' });
    expect(h.history.map((m) => m.text)).toEqual(['merhaba *** dünya', 'tekrar']);
    // dm: yalnızca arkadaşlar
    const room = dmRoom(a.me!.id, b.me!.id);
    expect((await err(a.call('chat.join', { room }))).code).toBe('YETKI');
    await a.call('friends.add', { code: b.me!.friendCode });
    await a.call('chat.join', { room });
    env.clock.advance(1300);
    await a.call('chat.send', { room, text: 'gizli selam' });
    expect((await b.waitFor('chat', (x) => x.msg.room === room)).msg.text).toBe('gizli selam');
    expect((await err(c.call('chat.join', { room }))).code).toBe('YETKI');
    // takım odası: yalnızca üyeler
    const t = await a.call('team.create', { name: 'Kulaklar', emblem: '👂' });
    expect((await err(c.call('chat.join', { room: teamRoom(t.team.id) }))).code).toBe('YETKI');
    await b.call('team.join', { teamId: t.team.id });
    const joinMsg = await a.waitFor('chat', (x) => x.msg.room === teamRoom(t.team.id) && x.msg.kind === 'system' && x.msg.text.includes('Bora'));
    expect(joinMsg.msg.from).toBe('sistem');
    env.clock.advance(1300);
    await b.call('chat.send', { room: teamRoom(t.team.id), text: 'takım!' });
    expect((await a.waitFor('chat', (x) => x.msg.text === 'takım!')).msg.from).toBe(b.me!.id);
  });

  it('3 farklı şikâyet mesajı gizler ve göndereni 10 dk susturur; kişisel engel', async () => {
    env = await setup();
    const [a, b, c, d] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem'), await env.connect('Deniz')];
    const m = await a.call('chat.send', { room: 'genel', text: 'rahatsız edici mesaj' });
    expect((await err(a.call('chat.report', { msgId: m.msg.id }))).code).toBe('GECERSIZ');
    await b.call('chat.report', { msgId: m.msg.id });
    await b.call('chat.report', { msgId: m.msg.id }); // aynı kişi iki kez sayılmaz
    await c.call('chat.report', { msgId: m.msg.id });
    expect((await d.call('chat.join', { room: 'genel' })).history).toHaveLength(1);
    await d.call('chat.report', { msgId: m.msg.id });
    expect((await d.call('chat.join', { room: 'genel' })).history).toHaveLength(0);
    env.clock.advance(2000);
    const e1 = await err(a.call('chat.send', { room: 'genel', text: 'yine ben' }));
    expect(e1.code).toBe('SUSTURULDU');
    env.clock.advance(10 * 60_000);
    await a.call('chat.send', { room: 'genel', text: 'özür dilerim' });
    // kişisel engel: b, a'yı engeller → a'nın mesajları b'ye gelmez, geçmişte görünmez
    expect((await b.call('chat.mute', { id: a.me!.id, on: true })).muted).toEqual([a.me!.id]);
    expect((await b.call('chat.join', { room: 'genel' })).history).toHaveLength(0);
    await c.call('chat.join', { room: 'genel' });
    b.drain(); c.drain();
    env.clock.advance(2000);
    await a.call('chat.send', { room: 'genel', text: 'görünmez' });
    await c.waitFor('chat', (x) => x.msg.text === 'görünmez');
    await sleep(50);
    expect(b.log.some((e) => !e.used && e.ev === 'chat')).toBe(false);
  });
});
