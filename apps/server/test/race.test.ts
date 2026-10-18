import { afterEach, describe, expect, it } from 'vitest';
import type { NetError } from '@odi/net';
import { setup, run, sleep, type Env } from './helpers';

let env: Env;
afterEach(async () => { await env?.close(); });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };

describe('canlı yarış', () => {
  it('3 istemci: hazır → geri sayım → yarış, konum iletimi, bitiş sırası, lig puanına bağlanma', async () => {
    env = await setup({ raceCountdownMs: 150, raceFinishGraceMs: 60_000 });
    const [a, b, c] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem')];
    for (const p of [a, b, c]) for (let l = 1; l <= 3; l++) await p.call('progress.submit', run(l));
    const room = (await a.call('race.create', {})).room;
    expect(room).toMatchObject({ hostId: a.me!.id, level: 4, status: 'lobi', max: 4 });
    expect((await err(a.call('race.create', { level: 9 }))).code).toBe('GECERSIZ');
    // arkadaş daveti
    expect((await err(a.call('race.invite', { friendId: b.me!.id }))).code).toBe('YETKI');
    await a.call('friends.add', { code: b.me!.friendCode });
    await a.call('race.invite', { friendId: b.me!.id });
    const inv = await b.waitFor('race.invited');
    expect(inv.room.id).toBe(room.id);
    expect(inv.from.name).toBe('Ayşe');
    await b.call('race.join', { roomId: room.id });
    // hızlı eşleşme: açık lobiye katılır (bot yok)
    const q = await c.call('race.quick', {});
    expect(q.room.id).toBe(room.id);
    expect(q.room.players.map((p) => p.name)).toEqual(['Ayşe', 'Bora', 'Cem']);
    // yarış başlamadan konum yok sayılır
    a.fire('race.pos', { x: 1, y: 2, pct: 0.1 });
    await a.call('race.ready', { ready: true });
    await b.call('race.ready', { ready: true });
    const lobby = (await c.call('race.ready', { ready: false })).room;
    expect(lobby.status).toBe('lobi');
    const cd = (await c.call('race.ready', { ready: true })).room;
    expect(cd.status).toBe('geri-sayim');
    expect(cd.startsAt).toBe(env.clock.t + 150);
    // geri sayım bitince 'yarista' (sunucu zamanlayıcısı; zaman sağlayıcısı da ilerletilir)
    env.clock.advance(150);
    const started = await c.waitFor('race.updated', (x) => x.room.status === 'yarista', 2000);
    expect(started.room.players.every((p) => p.ready)).toBe(true);
    expect(b.log.some((e) => e.ev === 'race.pos')).toBe(false);
    // konum iletimi: diğerlerine gider, gönderene gitmez; 8 Hz üstü düşürülür
    a.fire('race.pos', { x: 100, y: 200, pct: 0.25 });
    a.fire('race.pos', { x: 101, y: 200, pct: 0.26 });
    const pb = await b.waitFor('race.pos');
    const pc = await c.waitFor('race.pos');
    expect(pb).toMatchObject({ id: a.me!.id, x: 100, y: 200, pct: 0.25 });
    expect(pc.id).toBe(a.me!.id);
    await sleep(150);
    expect(b.log.filter((e) => e.ev === 'race.pos')).toHaveLength(1);
    expect(a.log.some((e) => e.ev === 'race.pos')).toBe(false);
    // bitiş sırası
    const f1 = (await b.call('race.finish', { completed: true, score: 900, timeSec: 50 })).room;
    expect(f1.players.find((p) => p.id === b.me!.id)!.place).toBe(1);
    expect((await err(b.call('race.finish', { completed: true, score: 900, timeSec: 50 }))).code).toBe('TEKRAR');
    await a.call('race.finish', { completed: true, score: 800, timeSec: 55 });
    const fin = (await c.call('race.finish', { completed: false, score: 100, timeSec: 70 })).room;
    expect(fin.status).toBe('bitti');
    expect(fin.players.map((p) => [p.name, p.place])).toEqual([['Ayşe', 2], ['Bora', 1], ['Cem', null]]);
    expect((await a.waitFor('race.updated', (x) => x.room.status === 'bitti')).room.id).toBe(room.id);
    // yarış derecesi lig puanına bir kez bağlanır
    const lp = await b.call('progress.submit', run(4, { raceId: room.id }));
    expect(lp.leaguePoints).toBe(5 + 15 + 30);
    expect((await b.call('progress.submit', run(4, { raceId: room.id }))).leaguePoints).toBe(20);
    expect((await a.call('progress.submit', run(4, { raceId: room.id }))).leaguePoints).toBe(20 + 15);
  });

  it('ilk bitirenden sonra süre dolunca yarış biter; ayrılan "left" olur; boş oda silinir', async () => {
    env = await setup({ raceCountdownMs: 50, raceFinishGraceMs: 200 });
    const [a, b, c] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem')];
    const room = (await a.call('race.create', {})).room;
    await b.call('race.join', { roomId: room.id });
    await c.call('race.join', { roomId: room.id });
    // lobiden ayrılan listeden çıkar
    await c.call('race.leave', {});
    expect((await a.waitFor('race.updated', (x) => x.room.players.length === 2)).room.players.map((p) => p.name)).toEqual(['Ayşe', 'Bora']);
    await c.call('race.join', { roomId: room.id });
    await a.call('race.ready', { ready: true });
    await b.call('race.ready', { ready: true });
    await c.call('race.ready', { ready: true });
    env.clock.advance(50);
    await a.waitFor('race.updated', (x) => x.room.status === 'yarista', 2000);
    const d = await env.connect('Deniz');
    expect((await err(d.call('race.join', { roomId: room.id }))).code).toBe('BASLADI');
    // yarış sırasında ayrılan 'left'
    await c.call('race.leave', {});
    const left = await a.waitFor('race.updated', (x) => x.room.players.some((p) => p.left));
    expect(left.room.players.find((p) => p.id === c.me!.id)!.left).toBe(true);
    await a.call('race.finish', { completed: true, score: 500, timeSec: 40 });
    env.clock.advance(200);
    const end = await b.waitFor('race.updated', (x) => x.room.status === 'bitti', 2000);
    expect(end.room.players.find((p) => p.id === b.me!.id)!.finishedAt).toBeNull();
    // bağlantısı kopan oyuncu odadan çıkar; herkes çıkınca oda silinir
    a.close(); b.close();
    await sleep(100);
    expect((await err(c.call('race.join', { roomId: room.id }))).code).toBe('YOK');
  });
});
