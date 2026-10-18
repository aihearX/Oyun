import { afterEach, describe, expect, it } from 'vitest';
import type { NetError } from '@odi/net';
import { FRIEND_LIMITS } from '@odi/shared';
import { setup, sleep, type Env, type TC } from './helpers';

let env: Env;
afterEach(async () => { await env?.close(); });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };
async function befriend(a: TC, b: TC) {
  const r = await a.call('friends.request', { id: b.me!.id });
  await b.call('friends.respond', { requestId: r.request!.id, accept: true });
}

describe('özel mesaj', () => {
  it('izin: arkadaş ya da takım arkadaşı; diğerlerine kapalı', async () => {
    env = await setup();
    const [a, b, c] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem')];
    const e = await err(a.call('dm.send', { to: b.me!.id, text: 'selam' }));
    expect(e.code).toBe('YETKI');
    expect(e.message).toContain('arkadaş');
    expect((await a.call('dm.open', { id: b.me!.id })).canMessage).toBe(false);
    // takım arkadaşı
    const t = await a.call('team.create', { name: 'Kulaklar', emblem: '👂' });
    await c.call('team.join', { teamId: t.team.id });
    await a.call('dm.send', { to: c.me!.id, text: 'takımdan selam' });
    expect((await c.waitFor('dm.message')).msg.text).toBe('takımdan selam');
    // arkadaş
    await befriend(a, b);
    env.clock.advance(1000);
    await a.call('dm.send', { to: b.me!.id, text: 'artık arkadaşız' });
    expect((await err(a.call('dm.send', { to: a.me!.id, text: 'ben' }))).code).toBe('YETKI');
  });

  it('gönder → okunmamış → görüldü; yazıyor; tepki; silme; sohbet listesi; küfür filtresi; hız sınırı; sayfalama', async () => {
    env = await setup();
    const [a, b] = [await env.connect('Ayşe'), await env.connect('Bora')];
    await befriend(a, b);
    const m1 = (await a.call('dm.send', { to: b.me!.id, text: '  merhaba   amk  dünya ' })).msg;
    expect(m1).toMatchObject({ from: a.me!.id, to: b.me!.id, text: 'merhaba *** dünya', kind: 'text' });
    const got = await b.waitFor('dm.message');
    expect(got.msg.id).toBe(m1.id);
    expect(got.from.name).toBe('Ayşe');
    expect((await b.waitFor('dm.unread')).total).toBe(1);
    expect((await err(a.call('dm.send', { to: b.me!.id, text: 'çok hızlı' }))).code).toBe('HIZ');
    env.clock.advance(FRIEND_LIMITS.dmCooldownMs);
    const m2 = (await a.call('dm.send', { to: b.me!.id, text: '👋🔥', kind: 'emoji' })).msg;
    expect((await b.waitFor('dm.unread', (x) => x.total === 2)).total).toBe(2);
    env.clock.advance(1000);
    expect((await err(a.call('dm.send', { to: b.me!.id, text: 'yazı', kind: 'emoji' }))).code).toBe('GECERSIZ');
    expect((await err(a.call('dm.send', { to: b.me!.id, text: 'yok-boyle', kind: 'sticker' }))).code).toBe('GECERSIZ');
    const st = (await a.call('dm.send', { to: b.me!.id, text: 'kalp', kind: 'sticker' })).msg;
    expect(st.kind).toBe('sticker');
    env.clock.advance(1000);
    expect((await err(a.call('dm.send', { to: b.me!.id, text: 'x'.repeat(FRIEND_LIMITS.dmMax + 1) }))).code).toBe('GECERSIZ');
    // sohbet listesi (B tarafı)
    const th = await b.call('dm.threads', {});
    expect(th.unread).toBe(3);
    expect(th.threads).toHaveLength(1);
    expect(th.threads[0]).toMatchObject({ other: { id: a.me!.id, name: 'Ayşe', online: true }, unread: 3, friend: true, canMessage: true });
    expect(th.threads[0]!.last!.id).toBe(st.id);
    // B sohbeti açar ve okur → A'ya görüldü
    const op = await b.call('dm.open', { id: a.me!.id });
    expect(op.messages.map((m) => m.id)).toEqual([m1.id, m2.id, st.id]);
    expect(op.myReadSeq).toBe(0);
    expect((await b.call('dm.read', { id: a.me!.id })).unread).toBe(0);
    expect((await a.waitFor('dm.read')).seq).toBe(st.seq);
    expect((await a.call('dm.open', { id: b.me!.id })).peerReadSeq).toBe(st.seq);
    // yazıyor… (fire, 4 sn)
    b.fire('dm.typing', { to: a.me!.id });
    const ty = await a.waitFor('dm.typing');
    expect(ty).toEqual({ from: b.me!.id, until: env.clock.t + FRIEND_LIMITS.typingMs });
    // tepki: 6 sabit emoji, kişi başı bir; aynısı geri alır
    expect((await err(b.call('dm.react', { msgId: m1.id, emoji: '🍕' }))).code).toBe('GECERSIZ');
    const r1 = await b.call('dm.react', { msgId: m1.id, emoji: '😂' });
    expect(r1.msg.reactions).toEqual({ [b.me!.id]: '😂' });
    expect((await a.waitFor('dm.reaction')).msg.reactions).toEqual({ [b.me!.id]: '😂' });
    expect((await b.call('dm.react', { msgId: m1.id, emoji: '❤️' })).msg.reactions).toEqual({ [b.me!.id]: '❤️' });
    await a.call('dm.react', { msgId: m1.id, emoji: '👍' });
    expect((await b.call('dm.open', { id: a.me!.id })).messages[0]!.reactions).toEqual({ [b.me!.id]: '❤️', [a.me!.id]: '👍' });
    expect((await b.call('dm.react', { msgId: m1.id, emoji: '❤️' })).msg.reactions).toEqual({ [a.me!.id]: '👍' });
    // silme: yalnız kendi mesajı, herkes için "silindi"
    expect((await err(b.call('dm.delete', { msgId: m1.id }))).code).toBe('YETKI');
    b.drain();
    const del = await a.call('dm.delete', { msgId: m1.id });
    expect(del.msg).toMatchObject({ id: m1.id, deleted: true, text: '' });
    expect((await b.waitFor('dm.message', (x) => x.msg.id === m1.id)).msg.deleted).toBe(true);
    expect((await b.call('dm.open', { id: a.me!.id })).messages[0]).toMatchObject({ deleted: true, text: '' });
    expect((await err(b.call('dm.react', { msgId: m1.id, emoji: '😂' }))).code).toBe('GECERSIZ');
    // yabancı mesaja erişim yok
    const c = await env.connect('Cem');
    expect((await err(c.call('dm.react', { msgId: m2.id, emoji: '😂' }))).code).toBe('YOK');
    // B yanıt verince A'nınkiler okunmuş sayılır, A'da okunmamış 1
    env.clock.advance(1000);
    const rep = (await b.call('dm.send', { to: a.me!.id, text: 'selam!' })).msg;
    expect((await a.waitFor('dm.unread', (x) => x.total === 1)).total).toBe(1);
    expect((await a.call('dm.threads', {})).threads[0]!.last!.id).toBe(rep.id);
    // sayfalama: 40 mesaj daha → ilk sayfa 30, before ile önceki
    for (let i = 0; i < 40; i++) { env.clock.advance(1000); await a.call('dm.send', { to: b.me!.id, text: `m${i}` }); }
    const p1 = await b.call('dm.open', { id: a.me!.id });
    expect(p1.messages).toHaveLength(FRIEND_LIMITS.dmPage);
    expect(p1.hasMore).toBe(true);
    expect(p1.messages.at(-1)!.text).toBe('m39');
    const p2 = await b.call('dm.open', { id: a.me!.id, before: p1.messages[0]!.seq });
    expect(p2.messages.at(-1)!.seq).toBeLessThan(p1.messages[0]!.seq);
    expect(p2.hasMore).toBe(false);
    expect(p1.messages.length + p2.messages.length).toBe(44); // 3 + 1 yanıt + 40
    // kısmi okundu (upTo)
    await b.call('dm.read', { id: a.me!.id, upTo: p1.messages[9]!.seq });
    expect((await b.call('dm.threads', {})).threads[0]!.unread).toBe(20);
  });

  it('davet kartı: yarış odasında olmalısın; meta korunur; kalıcılık ve son 500', async () => {
    env = await setup();
    const [a, b] = [await env.connect('Ayşe'), await env.connect('Bora')];
    await befriend(a, b);
    expect((await err(a.call('dm.send', { to: b.me!.id, text: 'Yarışa gel!', kind: 'davet', meta: { type: 'yaris', roomId: 'ryok' } }))).code).toBe('YOK');
    expect((await err(a.call('dm.send', { to: b.me!.id, text: 'Gel', kind: 'davet' }))).code).toBe('GECERSIZ');
    const room = (await a.call('race.create', {})).room;
    const inv = (await a.call('dm.send', { to: b.me!.id, text: 'Yarışa gel!', kind: 'davet', meta: { type: 'yaris', roomId: room.id, level: room.level, hack: 'x' } })).msg;
    expect(inv.meta).toEqual({ type: 'yaris', roomId: room.id, level: room.level });
    const got = await b.waitFor('dm.message');
    expect(got.msg.kind).toBe('davet');
    await b.call('race.join', { roomId: inv.meta!.roomId as string });
    // ralli vb. serbest tür (istemci yönlendirir)
    env.clock.advance(1000);
    const r2 = (await a.call('dm.send', { to: b.me!.id, text: 'Ralliye katıl', kind: 'davet', meta: { type: 'ralli', roomId: 'abc123' } })).msg;
    expect(r2.meta).toMatchObject({ type: 'ralli', roomId: 'abc123' });
    // 500'den fazlası budanır
    const db = env.srv.app.db;
    const pair = a.me!.id < b.me!.id ? `${a.me!.id}:${b.me!.id}` : `${b.me!.id}:${a.me!.id}`;
    for (let i = 0; i < FRIEND_LIMITS.dmKeep + 20; i++) db.run('INSERT INTO dm(id, pair, from_id, to_id, text, kind, at) VALUES(?, ?, ?, ?, ?, ?, ?)', `dtoplu${i}`, pair, a.me!.id, b.me!.id, `t${i}`, 'text', 1);
    env.clock.advance(1000);
    await a.call('dm.send', { to: b.me!.id, text: 'son' });
    expect(db.get<{ n: number }>('SELECT COUNT(*) AS n FROM dm WHERE pair = ?', pair)!.n).toBe(FRIEND_LIMITS.dmKeep);
    // kalıcı: B yeniden bağlanınca da görür
    b.close();
    await sleep(30);
    const b2 = await env.connect(undefined, b.token);
    const th = await b2.call('dm.threads', {});
    expect(th.threads[0]!.last!.text).toBe('son');
  });

  it('engellenen mesaj gönderemez, yazıyor iletilmez, sohbet listesinden düşer; arkadaşlıktan çıkınca takımda değilse kapanır', async () => {
    env = await setup();
    const [a, c] = [await env.connect('Ayşe'), await env.connect('Cem')];
    await befriend(a, c);
    await c.call('dm.send', { to: a.me!.id, text: 'selam' });
    await a.waitFor('dm.message');
    await a.call('players.block', { id: c.me!.id });
    expect((await a.call('dm.threads', {})).threads).toEqual([]);
    expect((await a.call('dm.threads', {})).unread).toBe(0);
    env.clock.advance(1000);
    expect((await err(c.call('dm.send', { to: a.me!.id, text: 'neden?' }))).code).toBe('ENGEL');
    a.drain();
    c.fire('dm.typing', { to: a.me!.id });
    await sleep(80);
    expect(a.log.some((e) => !e.used && e.ev === 'dm.typing')).toBe(false);
    await a.call('players.unblock', { id: c.me!.id });
    // engel kalktı ama arkadaşlık geri gelmez → mesaj kapalı
    expect((await err(c.call('dm.send', { to: a.me!.id, text: 'tekrar' }))).code).toBe('YETKI');
  });
});
