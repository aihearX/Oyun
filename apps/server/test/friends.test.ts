import { afterEach, describe, expect, it } from 'vitest';
import type { NetError } from '@odi/net';
import { FRIEND_LIMITS } from '@odi/shared';
import { setup, run, sleep, type Env, type TC } from './helpers';

let env: Env;
afterEach(async () => { await env?.close(); });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };
/** iki oyuncuyu istek + kabul ile arkadaş yap */
async function befriend(a: TC, b: TC) {
  const r = await a.call('friends.request', { id: b.me!.id });
  await b.call('friends.respond', { requestId: r.request!.id, accept: true });
}

describe('arkadaşlık istekleri', () => {
  it('istek → kabul; istek → ret; iptal; olaylar ve listeler', async () => {
    env = await setup();
    const [a, b, c] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem')];
    // A, B'ye isimle istek atar
    const r = await a.call('friends.request', { name: 'bora' });
    expect(r.status).toBe('istek');
    expect(r.request!.from.id).toBe(a.me!.id);
    const ev = await b.waitFor('friend.request');
    expect(ev.request.from.name).toBe('Ayşe');
    expect(ev.removed).toBeUndefined();
    // tekrar istek: aynı istek döner (sayaç artmaz)
    expect((await a.call('friends.request', { id: b.me!.id })).request!.id).toBe(r.request!.id);
    const reqB = await b.call('friends.requests', {});
    expect(reqB.incoming.map((x) => x.from.id)).toEqual([a.me!.id]);
    expect((await a.call('friends.requests', {})).outgoing.map((x) => x.to.id)).toEqual([b.me!.id]);
    expect((await a.call('profile.card', { id: b.me!.id })).card.relation).toBe('istek-giden');
    expect((await b.call('profile.card', { id: a.me!.id })).card).toMatchObject({ relation: 'istek-gelen', requestId: r.request!.id });
    // yalnız alıcı yanıtlayabilir
    expect((await err(a.call('friends.respond', { requestId: r.request!.id, accept: true }))).code).toBe('YOK');
    const acc = await b.call('friends.respond', { requestId: r.request!.id, accept: true });
    expect(acc.friend!.id).toBe(a.me!.id);
    expect((await a.waitFor('friend.accepted')).friend.id).toBe(b.me!.id);
    expect((await a.call('friends.list', {})).friends.map((f) => f.id)).toEqual([b.me!.id]);
    expect((await b.call('friends.list', {})).friends.map((f) => f.id)).toEqual([a.me!.id]);
    expect((await b.call('friends.requests', {})).incoming).toEqual([]);
    // C → A istek, A reddeder: C'ye "kaldırıldı" olayı, arkadaşlık yok
    const rc = await c.call('friends.request', { code: a.me!.friendCode });
    await a.waitFor('friend.request', (x) => x.request.from.id === c.me!.id);
    expect((await a.call('friends.respond', { requestId: rc.request!.id, accept: false })).friend).toBeNull();
    expect((await c.waitFor('friend.request', (x) => !!x.removed)).request.id).toBe(rc.request!.id);
    expect((await c.call('friends.list', {})).friends).toEqual([]);
    // C → B istek, C iptal eder
    const rc2 = await c.call('friends.request', { id: b.me!.id });
    await c.call('friends.cancel', { requestId: rc2.request!.id });
    expect((await b.waitFor('friend.request', (x) => x.request.id === rc2.request!.id && !!x.removed)).removed).toBe(true);
    expect((await b.call('friends.requests', {})).incoming).toEqual([]);
    expect((await err(b.call('friends.cancel', { requestId: rc2.request!.id }))).code).toBe('YOK');
    // hatalar
    expect((await err(a.call('friends.request', { id: a.me!.id }))).code).toBe('GECERSIZ');
    expect((await err(a.call('friends.request', { name: 'Kimse Yok' }))).code).toBe('YOK');
    expect((await err(a.call('friends.request', {}))).code).toBe('GECERSIZ');
    // zaten arkadaşsa
    expect((await a.call('friends.request', { id: b.me!.id })).status).toBe('arkadas');
  });

  it('geriye uyumlu friends.add: tek taraf istek, iki taraf ekleyince otomatik kabul; aynı isimde birden çok oyuncu', async () => {
    env = await setup();
    const [a, b] = [await env.connect('Ayşe'), await env.connect('Bora')];
    const r1 = await a.call('friends.add', { code: b.me!.friendCode });
    expect(r1).toMatchObject({ status: 'istek', friend: { id: b.me!.id } });
    await b.waitFor('friend.request');
    const r2 = await b.call('friends.add', { code: a.me!.friendCode });
    expect(r2.status).toBe('arkadas');
    await a.waitFor('friend.accepted');
    expect((await a.call('friends.list', {})).friends.map((f) => f.id)).toEqual([b.me!.id]);
    expect((await a.call('friends.requests', {})).outgoing).toEqual([]);
    // aynı isim iki kişide → isimle istek belirsiz
    await env.connect('Deniz'); await env.connect('Deniz');
    expect((await err(a.call('friends.request', { name: 'Deniz' }))).code).toBe('BELIRSIZ');
  });

  it('sınırlar: günde 50 istek, en çok 200 arkadaş', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    const others: TC[] = [];
    for (let i = 0; i < FRIEND_LIMITS.requestsPerDay + 1; i++) others.push(await env.connect(`Oyuncu${i}`));
    for (let i = 0; i < FRIEND_LIMITS.requestsPerDay; i++) await a.call('friends.request', { id: others[i]!.me!.id });
    const e = await err(a.call('friends.request', { id: others[FRIEND_LIMITS.requestsPerDay]!.me!.id }));
    expect(e.code).toBe('LIMIT');
    expect(e.message).toContain('50');
    // ertesi gün yeniden açılır
    env.clock.advance(24 * 3_600_000);
    expect((await a.call('friends.request', { id: others[FRIEND_LIMITS.requestsPerDay]!.me!.id })).status).toBe('istek');
    // 200 arkadaş sınırı (veritabanına doğrudan dolduruluyor)
    const z = await env.connect('Zeynep');
    const rz = await z.call('friends.request', { id: a.me!.id });
    const db = env.srv.app.db;
    for (let i = 0; i < FRIEND_LIMITS.friendsMax; i++) db.run('INSERT INTO friends(a, b, at) VALUES(?, ?, ?)', a.me!.id, `pdolgu${i}`, 0);
    expect((await err(a.call('friends.respond', { requestId: rz.request!.id, accept: true }))).code).toBe('LIMIT');
    const w = await env.connect('Wale');
    const ew = await err(w.call('friends.request', { id: a.me!.id }));
    expect(ew.code).toBe('LIMIT');
    expect(ew.message).toContain('dolu');
  });
});

describe('arama, öneriler, profil kartı', () => {
  it('isimle arama: en az 3 harf, Türkçe harf katlama, sayfalı, engellenen ve kendisi hariç; kodla arama', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    const b = await env.connect('Ayşegül');
    const c = await env.connect('Aysel');
    for (let i = 0; i < 22; i++) await env.connect(`Kulak${String(i).padStart(2, '0')}`);
    await env.connect(); // varsayılan isimli, hiç oynamamış hesap aramada çıkmaz
    expect((await err(a.call('players.search', { query: 'ay' }))).code).toBe('KISA');
    const r = await a.call('players.search', { query: 'ayseg' });
    expect(r.players.map((h) => h.profile.name)).toEqual(['Ayşegül']); // ş ≈ s
    expect((await a.call('players.search', { query: 'ayşe' })).players.map((h) => h.profile.name).sort()).toEqual(['Aysel', 'Ayşegül']); // kendisi hariç
    expect(r.players[0]!.relation).toBe('yok');
    const r2 = await a.call('players.search', { query: 'AYS' });
    expect(r2.players.map((h) => h.profile.name).sort()).toEqual(['Aysel', 'Ayşegül']);
    // sayfalama
    const p0 = await a.call('players.search', { query: 'kulak' });
    expect(p0.players).toHaveLength(FRIEND_LIMITS.searchPage);
    expect(p0.hasMore).toBe(true);
    const p1 = await a.call('players.search', { query: 'kulak', page: 1 });
    expect(p1.players).toHaveLength(2);
    expect(p1.hasMore).toBe(false);
    expect((await a.call('players.search', { query: 'Odi' })).players).toEqual([]);
    // ilişki etiketi ve engel
    await a.call('friends.request', { id: b.me!.id });
    expect((await a.call('players.search', { query: 'ayşegül' })).players[0]!.relation).toBe('istek-giden');
    await c.call('players.block', { id: a.me!.id });
    expect((await a.call('players.search', { query: 'aysel' })).players).toEqual([]);
    expect((await c.call('players.search', { query: 'ayşe' })).players.map((h) => h.profile.name)).toEqual(['Ayşegül']);
    // kodla arama
    const byCode = await a.call('players.search', { query: b.me!.friendCode });
    expect(byCode.players[0]!.profile.id).toBe(b.me!.id);
  });

  it('öneriler: takım arkadaşı, son yarış rakibi, aynı lig, ortak arkadaş — sebebiyle; arkadaşlar/istekler/engelliler hariç', async () => {
    env = await setup({ raceCountdownMs: 50 });
    const [a, b, c, d, e, f] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem'), await env.connect('Deniz'), await env.connect('Ece'), await env.connect('Fikret')];
    const t = await a.call('team.create', { name: 'Kulaklar', emblem: '👂' });
    await b.call('team.join', { teamId: t.team.id });
    // yarış: A ve C
    const room = (await a.call('race.create', {})).room;
    await c.call('race.join', { roomId: room.id });
    await a.call('race.ready', { ready: true }); await c.call('race.ready', { ready: true });
    env.clock.advance(60);
    await sleep(120);
    await a.call('race.finish', { completed: true, score: 100, timeSec: 30 });
    await c.call('race.finish', { completed: true, score: 90, timeSec: 31 });
    // lig: A ve D aynı grupta (ilerleme gönderince lige yazılır)
    await a.call('progress.submit', run(1));
    await d.call('progress.submit', run(1));
    // ortak arkadaş: E, F'nin arkadaşı; F, A'nın arkadaşı
    await befriend(a, f); await befriend(e, f);
    const s = await a.call('friends.suggest', {});
    const why = Object.fromEntries(s.suggestions.map((x) => [x.profile.name, x.reason]));
    expect(why).toMatchObject({ Bora: 'Takım arkadaşın', Cem: 'Seninle yarıştı', Deniz: 'Aynı ligdesiniz', Ece: '1 ortak arkadaşınız var' });
    expect(why.Fikret).toBeUndefined(); // zaten arkadaş
    expect(s.suggestions[0]!.kind).toBe('takim');
    // istek gönderilen ve engellenen düşer
    await a.call('friends.request', { id: c.me!.id });
    await a.call('players.block', { id: d.me!.id });
    const s2 = (await a.call('friends.suggest', {})).suggestions.map((x) => x.profile.name);
    expect(s2).not.toContain('Cem');
    expect(s2).not.toContain('Deniz');
    expect(s2).toContain('Bora');
  });

  it('profil kartı: herkese açık profil, rozetler, aramızdaki durum, mesaj izni', async () => {
    env = await setup();
    const [a, b, c] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem')];
    for (let l = 1; l <= 3; l++) await b.call('progress.submit', run(l));
    const t = await b.call('team.create', { name: 'Kokleacılar', emblem: '🐚' });
    const k = (await a.call('profile.card', { id: b.me!.id })).card;
    expect(k.profile).toMatchObject({ name: 'Bora', stars: 9, highest: 4, teamName: 'Kokleacılar', teamEmblem: '🐚', league: 'bronz' });
    expect(k).toMatchObject({ relation: 'yok', canMessage: false, sameTeam: false, friendCount: 0, mutualFriends: 0, giftedToday: false });
    await c.call('team.join', { teamId: t.team.id });
    expect((await c.call('profile.card', { id: b.me!.id })).card).toMatchObject({ sameTeam: true, canMessage: true, relation: 'yok' });
    await befriend(a, b); await befriend(a, c);
    expect((await b.call('profile.card', { id: c.me!.id })).card.mutualFriends).toBe(1);
    expect((await a.call('profile.card', { id: b.me!.id })).card).toMatchObject({ relation: 'arkadas', canMessage: true, friendCount: 1 });
    expect((await a.call('profile.card', { id: a.me!.id })).card.relation).toBe('ben');
    await a.call('players.block', { id: b.me!.id });
    expect((await a.call('profile.card', { id: b.me!.id })).card).toMatchObject({ relation: 'engelledin', canMessage: false });
    expect((await b.call('profile.card', { id: a.me!.id })).card).toMatchObject({ relation: 'yok', canMessage: false });
    expect((await err(a.call('profile.card', { id: 'pyok' }))).code).toBe('YOK');
  });
});

describe('engelleme ve şikâyet', () => {
  it('engel: arkadaşlıktan çıkarır, istek/mesaj/davet/hediye gönderilemez; liste; kaldırınca yeniden istek', async () => {
    env = await setup();
    const [a, c] = [await env.connect('Ayşe'), await env.connect('Cem')];
    await befriend(c, a);
    const req = await c.call('friends.request', { id: a.me!.id });
    expect(req.status).toBe('arkadas');
    const blk = await a.call('players.block', { id: c.me!.id });
    expect(blk.blocked).toEqual([c.me!.id]);
    expect((await c.waitFor('friend.removed')).id).toBe(a.me!.id);
    expect((await a.call('friends.list', {})).friends).toEqual([]);
    expect((await c.call('friends.list', {})).friends).toEqual([]);
    expect((await err(c.call('friends.request', { id: a.me!.id }))).code).toBe('ENGEL');
    expect((await err(c.call('friends.add', { code: a.me!.friendCode }))).code).toBe('ENGEL');
    expect((await err(c.call('dm.send', { to: a.me!.id, text: 'selam' }))).code).toBe('ENGEL');
    expect((await err(a.call('dm.send', { to: c.me!.id, text: 'selam' }))).code).toBe('ENGEL');
    expect((await err(c.call('friends.gift', { id: a.me!.id }))).code).toBe('YETKI');
    await c.call('race.create', {});
    expect((await err(c.call('race.invite', { friendId: a.me!.id }))).code).toBe('ENGEL');
    // engellenen kişi genel sohbette de sessize alınır
    expect((await a.call('chat.mute', { id: 'pyok', on: false })).muted).toEqual([c.me!.id]);
    expect((await a.call('players.blocked', {})).players.map((p) => p.name)).toEqual(['Cem']);
    // bekleyen istek de silinir
    const d = await env.connect('Deniz');
    await d.call('friends.request', { id: a.me!.id });
    await a.call('players.block', { id: d.me!.id });
    expect((await a.call('friends.requests', {})).incoming).toEqual([]);
    // kaldır
    expect((await a.call('players.unblock', { id: c.me!.id })).blocked).toEqual([d.me!.id]);
    expect((await c.call('friends.request', { id: a.me!.id })).status).toBe('istek');
    expect((await err(a.call('players.block', { id: a.me!.id }))).code).toBe('GECERSIZ');
  });

  it('şikâyet birikimi: 24 saatte 3 farklı kişi → 10 dk susturma (sohbetle aynı eşik)', async () => {
    env = await setup();
    const [a, b, c, d] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem'), await env.connect('Deniz')];
    for (const x of [b, c, d]) await befriend(a, x);
    const ids: string[] = [];
    for (const x of [b, c, d]) { env.clock.advance(1000); ids.push((await a.call('dm.send', { to: x.me!.id, text: 'rahatsız edici' })).msg.id); }
    await b.call('dm.report', { msgId: ids[0]! });
    await b.call('dm.report', { msgId: ids[0]! }); // aynı kişi iki kez sayılmaz
    expect((await err(a.call('dm.report', { msgId: ids[0]! }))).code).toBe('GECERSIZ');
    await c.call('players.report', { id: a.me!.id, reason: 'taciz' });
    env.clock.advance(1000);
    await a.call('dm.send', { to: b.me!.id, text: 'hâlâ yazabiliyorum' });
    await d.call('dm.report', { msgId: ids[2]! });
    env.clock.advance(1000);
    expect((await err(a.call('dm.send', { to: b.me!.id, text: 'yine' }))).code).toBe('SUSTURULDU');
    expect((await err(a.call('chat.send', { room: 'genel', text: 'yine' }))).code).toBe('SUSTURULDU');
    // şikâyet eden kişi o mesajı artık görmez
    const opened = await b.call('dm.open', { id: a.me!.id });
    expect(opened.messages.map((m) => m.id)).not.toContain(ids[0]);
    env.clock.advance(10 * 60_000);
    await a.call('dm.send', { to: b.me!.id, text: 'özür dilerim' });
  });
});

describe('arkadaş hediyesi', () => {
  it('günde her arkadaşa 1 kez: alıcıya 10 jeton ödül kutusuna, gönderene 2 jeton; günde en çok 20', async () => {
    env = await setup();
    const [a, b] = [await env.connect('Ayşe'), await env.connect('Bora')];
    expect((await err(a.call('friends.gift', { id: b.me!.id }))).code).toBe('YETKI');
    await befriend(a, b);
    const before = (await a.call('wallet.get', {})).wallet.jeton;
    const g = await a.call('friends.gift', { id: b.me!.id });
    expect(g.thanks).toBe(FRIEND_LIMITS.giftThanksJeton);
    expect(g.wallet.jeton).toBe(before + 2);
    expect(g.left).toBe(FRIEND_LIMITS.giftsPerDay - 1);
    const ev = await b.waitFor('friend.gift');
    expect(ev).toMatchObject({ amount: 10, from: { name: 'Ayşe' } });
    const item = (await b.waitFor('inbox.new')).item;
    expect(item).toMatchObject({ kind: 'jeton', amount: 10 });
    expect(item.reason).toContain('Ayşe');
    expect((await b.call('inbox.list', {})).items.some((i) => i.id === item.id)).toBe(true);
    expect((await err(a.call('friends.gift', { id: b.me!.id }))).code).toBe('TEKRAR');
    expect((await a.call('friends.list', {})).gifted).toEqual([b.me!.id]);
    expect((await a.call('profile.card', { id: b.me!.id })).card.giftedToday).toBe(true);
    // ertesi gün yine
    env.clock.advance(24 * 3_600_000);
    await a.call('friends.gift', { id: b.me!.id });
    // günlük 20 sınırı
    const many: TC[] = [];
    for (let i = 0; i < FRIEND_LIMITS.giftsPerDay; i++) { const x = await env.connect(`Dost${i}`); await befriend(a, x); many.push(x); }
    for (let i = 0; i < FRIEND_LIMITS.giftsPerDay - 1; i++) await a.call('friends.gift', { id: many[i]!.me!.id });
    const e = await err(a.call('friends.gift', { id: many[FRIEND_LIMITS.giftsPerDay - 1]!.me!.id }));
    expect(e.code).toBe('LIMIT');
  });
});
