import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createClient, type NetError } from '@odi/net';
import type { ProgressSubmit } from '@odi/shared';
import { startServer, type OdiServer } from '../src/server';
import { setup, run, sleep, waitStatus, wrap, type Env, type TC } from './helpers';

let env: Env;
afterEach(async () => { const e = env; env = undefined!; await e?.close(); });
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
    await b.call('friends.add', { code: a.me!.friendCode }); // karşılıklı ekleme = arkadaş
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

  it('tuz 1..999; geri sayımda katılım kapalı; hızlı eşleşme geri sayımdaki odayı seçmez; bitiremeyenin derecesi yok', async () => {
    env = await setup({ raceCountdownMs: 100, raceFinishGraceMs: 60_000 });
    const [a, b, c] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem')];
    for (let i = 0; i < 25; i++) {
      const s = (await a.call('race.create', {})).room.salt;
      expect(Number.isInteger(s) && s >= 1 && s <= 999).toBe(true);
    }
    const room = (await a.call('race.create', {})).room;
    await b.call('race.join', { roomId: room.id });
    await a.call('race.ready', { ready: true });
    expect((await b.call('race.ready', { ready: true })).room.status).toBe('geri-sayim');
    // geri sayımda kodla katılım yok; hızlı yarış yeni oda açar
    expect((await err(c.call('race.join', { roomId: room.id }))).code).toBe('BASLADI');
    const q = await c.call('race.quick', {});
    expect(q.room.id).not.toBe(room.id);
    expect(q.room.players.map((p) => p.name)).toEqual(['Cem']);
    await c.call('race.leave', {});
    env.clock.advance(100);
    await a.waitFor('race.updated', (x) => x.room.status === 'yarista', 2000);
    await a.call('race.finish', { completed: true, score: 700, timeSec: 30 });
    // b hiç bitirmez: ilk bitirenden 60 sn sonra (bekleme süresi) yarış biter
    env.clock.advance(59_000); env.srv.sweep();
    expect(a.log.filter((e) => e.ev === 'race.updated' && (e.data as { room: { status: string } }).room.status === 'bitti')).toHaveLength(0);
    env.clock.advance(1_000); env.srv.sweep();
    const end = await b.waitFor('race.updated', (x) => x.room.status === 'bitti', 2000);
    expect(end.room.players.map((p) => [p.name, p.place])).toEqual([['Ayşe', 1], ['Bora', null]]);
  });

  it('en geç 3 dk: kimse bitirmese de yarış biter', async () => {
    env = await setup({ raceCountdownMs: 50, raceFinishGraceMs: 60_000 });
    const [a, b] = [await env.connect('Ayşe'), await env.connect('Bora')];
    const room = (await a.call('race.create', {})).room;
    await b.call('race.join', { roomId: room.id });
    await a.call('race.ready', { ready: true });
    await b.call('race.ready', { ready: true });
    env.clock.advance(50);
    await a.waitFor('race.updated', (x) => x.room.status === 'yarista', 2000);
    env.clock.advance(3 * 60_000 - 1); env.srv.sweep();
    await sleep(30);
    expect(a.log.some((e) => e.ev === 'race.updated' && (e.data as { room: { status: string } }).room.status === 'bitti')).toBe(false);
    env.clock.advance(1); env.srv.sweep();
    const end = await a.waitFor('race.updated', (x) => x.room.status === 'bitti', 2000);
    expect(end.room.players.every((p) => p.place == null && p.finishedAt == null)).toBe(true);
    const e = await err(b.call('race.finish', { completed: true, score: 1, timeSec: 1 }));
    expect([e.code, e.message]).toEqual(['GECERSIZ', 'Yarış bitti.']);
  });

  it('yarış sohbeti: yalnız odadakiler okur/yazar; ayrılan almaz', async () => {
    env = await setup({ raceCountdownMs: 50 });
    const [a, b, c] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem')];
    const room = (await a.call('race.create', {})).room;
    await b.call('race.join', { roomId: room.id });
    const rr = `race:${room.id}`;
    expect((await a.call('chat.join', { room: rr })).history).toEqual([]);
    expect((await err(c.call('chat.join', { room: rr }))).code).toBe('YETKI');
    expect((await err(c.call('chat.send', { room: rr, text: 'selam' }))).code).toBe('YETKI');
    expect((await err(c.call('chat.join', { room: 'race:yok123' }))).code).toBe('YETKI');
    await a.call('chat.send', { room: rr, text: 'Hazır mısın?' });
    // katılmamış (chat.join yapmamış) oda üyesine de gider; odada olmayana gitmez
    expect((await b.waitFor('chat', (x) => x.msg.room === rr)).msg.text).toBe('Hazır mısın?');
    await sleep(50);
    expect(c.log.some((e) => e.ev === 'chat')).toBe(false);
    // üçüncü katılınca geçmişi görür
    await c.call('race.join', { roomId: room.id });
    expect((await c.call('chat.join', { room: rr })).history.map((m) => m.text)).toEqual(['Hazır mısın?']);
    // ayrılan artık almaz ve yazamaz
    await b.call('race.leave', {});
    b.drain();
    env.clock.advance(2000);
    await c.call('chat.send', { room: rr, text: 'Başlıyoruz' });
    await a.waitFor('chat', (x) => x.msg.text === 'Başlıyoruz');
    await sleep(50);
    expect(b.log.some((e) => e.ev === 'chat' && !e.used)).toBe(false);
    expect((await err(b.call('chat.send', { room: rr, text: 'ben de' }))).code).toBe('YETKI');
  });

  it('rövanş: arkadaş olmayan son rakipler davet edilebilir; aynı bölümde oda kurulabilir', async () => {
    env = await setup({ raceCountdownMs: 50, raceFinishGraceMs: 60_000 });
    const [a, b, c] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem')];
    for (let l = 1; l <= 3; l++) await a.call('progress.submit', run(l));
    const room = (await a.call('race.create', {})).room;
    expect(room.level).toBe(4);
    await b.call('race.join', { roomId: room.id });
    await a.call('race.ready', { ready: true });
    await b.call('race.ready', { ready: true });
    env.clock.advance(50);
    await a.waitFor('race.updated', (x) => x.room.status === 'yarista', 2000);
    await a.call('race.finish', { completed: true, score: 900, timeSec: 40 });
    await b.call('race.finish', { completed: true, score: 800, timeSec: 45 });
    await b.waitFor('race.updated', (x) => x.room.status === 'bitti');
    // b'nin açık bölümü 1, ama son yarışın bölümünde (4) rövanş odası kurabilir; başka yüksek bölümde kuramaz
    expect((await err(b.call('race.create', { level: 5 }))).code).toBe('GECERSIZ');
    const re = (await b.call('race.create', { level: 4 })).room;
    expect(re.level).toBe(4);
    await b.call('race.invite', { friendId: a.me!.id });
    expect((await a.waitFor('race.invited')).room.id).toBe(re.id);
    // yarışmadığı biri: arkadaş da değilse davet edilemez
    expect((await err(b.call('race.invite', { friendId: c.me!.id }))).code).toBe('YETKI');
    const j = await a.call('race.join', { roomId: re.id });
    expect(j.room.players.map((p) => p.name)).toEqual(['Bora', 'Ayşe']);
  });
});

describe('canlı yarış kaydı (race_room)', () => {
  it('lobi yazılmaz; başlamış yarış yazılır; yarış sürerken hesabını silenin adı kayıtta kalmaz', async () => {
    env = await setup({ raceCountdownMs: 50, raceFinishGraceMs: 60_000 });
    const [a, b] = [await env.connect('Ayşe'), await env.connect('Borakqx')];
    const db = env.srv.app.db;
    const room = (await a.call('race.create', { level: 1 })).room;
    await b.call('race.join', { roomId: room.id });
    await a.call('race.ready', { ready: true });
    expect(db.get<{ n: number }>('SELECT COUNT(*) AS n FROM race_room')!.n).toBe(0);
    await b.call('race.ready', { ready: true });
    env.clock.advance(50);
    await a.waitFor('race.updated', (x) => x.room.status === 'yarista', 2000);
    expect(db.get<{ data: string }>('SELECT data FROM race_room WHERE id = ?', room.id)!.data).toContain('Borakqx');
    await b.call('account.delete', {});
    await a.call('race.finish', { completed: true, score: 900, timeSec: 40 });
    await sleep(50);
    const kayit = db.get<{ data: string }>('SELECT data FROM race_room WHERE id = ?', room.id)!.data;
    expect(kayit).not.toContain('Borakqx');
    expect(JSON.parse(kayit).players.map((p: { place: number | null }) => p.place)).toEqual([1, null]);
  });
});

// MK-031: sunucu yarış sürerken yeniden başlar (güncelleme, çökme). Uçtan uca tarayıcı testi: tools/harness/kopma-e2e.mjs --only yaris-ici
describe('canlı yarış: sunucu yarış sürerken yeniden başlar', () => {
  let srv: OdiServer | null = null; let dir = '';
  const tcs: TC[] = [];
  afterEach(async () => { for (const c of tcs.splice(0)) c.close(); await srv?.close(); srv = null; if (dir) rmSync(dir, { recursive: true, force: true }); dir = ''; });
  // raceRejoinMs: yeniden başlatmadan sonra dönmeyenin "ayrıldı" sayılması (testte kısa; yük altında bağlanma payı)
  const opts = (port: number, dbFile: string, raceRejoinMs = 4000) => ({ port, host: '127.0.0.1', dbFile, testStore: true, msgPerSec: 1000, freeTextCleared: 0, raceCountdownMs: 50, raceFinishGraceMs: 60_000, raceRejoinMs });
  const connect = async (port: number, name: string, token = ''): Promise<TC> => {
    const ref = { token }; let queue: ProgressSubmit[] = [];
    const c = wrap(createClient({ url: `ws://127.0.0.1:${port}`, name, getToken: () => ref.token, saveToken: (t) => { ref.token = t; }, getQueue: () => queue, saveQueue: (q) => { queue = q; }, maxBackoffMs: 200 }), ref);
    tcs.push(c); c.connect(); await waitStatus(c, 'bağlı'); return c;
  };

  it('başlamış yarış kayıttan geri gelir: süren oyuncular bitirir, sıra ve derece bağlantısı korunur; dönmeyen ayrılmış sayılır; lobi kapanır', async () => {
    dir = mkdtempSync(join(tmpdir(), 'odi-yaris-'));
    const dbFile = join(dir, 'odi.sqlite');
    srv = await startServer(opts(0, dbFile));
    const port = srv.port;
    const [a, b, c, d, e] = [await connect(port, 'Ayşe'), await connect(port, 'Bora'), await connect(port, 'Cem'), await connect(port, 'Deniz'), await connect(port, 'Ece')];
    const room = (await a.call('race.create', { level: 1 })).room;
    for (const p of [b, c, d]) await p.call('race.join', { roomId: room.id });
    for (const p of [a, b, c, d]) await p.call('race.ready', { ready: true });
    await a.waitFor('race.updated', (x) => x.room.status === 'yarista', 8000);
    // a bitirir ve derecesini lig puanına bağlar (yeniden başlatmadan önce)
    expect((await a.call('race.finish', { completed: true, score: 900, timeSec: 40 })).room.players.find((p) => p.id === a.me!.id)!.place).toBe(1);
    expect((await a.call('progress.submit', run(1, { raceId: room.id }))).leaguePoints).toBe(5 + 15 + 30);
    // ayrı bir lobi (başlamamış): yeniden başlatmada kapanır
    const lobby = (await e.call('race.create', { level: 1 })).room;

    // sunucu kapanır (yarış sürüyor), d hiç dönmez
    d.close();
    await srv.close(); srv = null;
    for (const p of [a, b, c]) await waitStatus(p, 'çevrimdışı', 3000).catch(() => undefined);
    srv = await startServer(opts(port, dbFile));
    for (const p of [a, b, c, e]) { p.retryNow(); await waitStatus(p, 'bağlı', 5000); }

    const back = (await b.call('race.state', { roomId: room.id })).room;
    expect(back.status).toBe('yarista');
    expect(back.players.map((p) => [p.name, p.place, p.left])).toEqual([['Ayşe', 1, false], ['Bora', null, false], ['Cem', null, false], ['Deniz', null, false]]);
    // derece bağlantısı kayıttan: a'nın ikinci gönderimi yarış bonusu almaz
    expect((await a.call('progress.submit', run(1, { raceId: room.id }))).leaguePoints).toBe(5 + 15);
    // b ve c bitirir (sunucu sırasıyla); d dönmediği için bekleme sonunda ayrılmış sayılır ve yarış biter
    expect((await b.call('race.finish', { completed: true, score: 800, timeSec: 45 })).room.players.find((p) => p.id === b.me!.id)!.place).toBe(2);
    await c.call('race.finish', { completed: true, score: 700, timeSec: 50 });
    const end = await b.waitFor('race.updated', (x) => x.room.status === 'bitti', 12_000);
    expect(end.room.players.map((p) => [p.name, p.place, p.left])).toEqual([['Ayşe', 1, false], ['Bora', 2, false], ['Cem', 3, false], ['Deniz', null, true]]);
    expect((await b.call('progress.submit', run(1, { raceId: room.id }))).leaguePoints).toBe(5 + 15 + 15);
    // aynı bitiş ikinci kez yazılmaz; bitmiş oda okunabilir
    expect((await err(c.call('race.finish', { completed: true, score: 1, timeSec: 1 }))).code).toBe('GECERSIZ');
    expect((await c.call('race.state', { roomId: room.id })).room.status).toBe('bitti');
    // lobi kapandı (açık ileti için 'YOK'); odada hiç olmayan oyuncu okuyamaz
    expect((await err(e.call('race.join', { roomId: lobby.id }))).code).toBe('YOK');
    expect((await err(e.call('race.state', { roomId: room.id }))).code).toBe('YOK');
    // bitmiş oda bir kez daha yeniden başlatmada da (10 dk) okunur, lobi satırı yok
    expect(srv.app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM race_room')!.n).toBe(1);
  }, 40_000);

  it('yarış sürerken kısa ağ kopması dereceyi silmez; bekleme süresi geçerse ayrılmış sayılır', async () => {
    dir = mkdtempSync(join(tmpdir(), 'odi-yaris-'));
    srv = await startServer(opts(0, join(dir, 'odi.sqlite'), 1500));
    const [a, b, c] = [await connect(srv.port, 'Ayşe'), await connect(srv.port, 'Bora'), await connect(srv.port, 'Cem')];
    const room = (await a.call('race.create', { level: 1 })).room;
    for (const p of [b, c]) await p.call('race.join', { roomId: room.id });
    for (const p of [a, b, c]) await p.call('race.ready', { ready: true });
    await a.waitFor('race.updated', (x) => x.room.status === 'yarista', 8000);
    // b'nin bağlantısı kısa süre kopar (aynı anahtarla döner): yarışta kalır, bitirir
    const bId = b.me!.id; const cId = c.me!.id;
    b.close();
    await sleep(150);
    const b2 = await connect(srv.port, 'Bora', b.token);
    expect(b2.me!.id).toBe(bId);
    // c kopar ve dönmez: bekleme (1,5 sn) sonunda ayrıldı
    c.close();
    const left = await a.waitFor('race.updated', (x) => x.room.players.some((p) => p.id === cId && p.left), 5000);
    expect(left.room.players.find((p) => p.id === bId)!.left).toBe(false);
    expect((await b2.call('race.finish', { completed: true, score: 800, timeSec: 45 })).room.players.find((p) => p.id === bId)!.place).toBe(1);
  }, 15_000);
});
