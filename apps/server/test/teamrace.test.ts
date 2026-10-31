import { afterEach, describe, expect, it } from 'vitest';
import type { NetError } from '@odi/net';
import type { RaceRoom } from '@odi/shared';
import { setup, run, sleep, type Env, type TC } from './helpers';
import { finalize } from '../src/teamrace';
import { seasonInfo } from '../src/teamrace/league';

let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };
const inbox = async (c: TC, ref: string) => (await c.call('inbox.list', {})).items.filter((i) => i.ref === ref);

/** lider + üyeler: takım kur, katıl */
async function team(e: Env, name: string, emblem: string, members: string[]): Promise<{ id: string; ps: TC[] }> {
  const ps: TC[] = [];
  for (const m of members) ps.push(await e.connect(m));
  const t = (await ps[0]!.call('team.create', { name, emblem })).team;
  for (const p of ps.slice(1)) await p.call('team.join', { teamId: t.id });
  return { id: t.id, ps };
}
/** lobi aç, herkes katılıp hazır */
async function gather(ps: TC[], size: 3 | 5 = 3, ready = ps): Promise<void> {
  await ps[0]!.call('trace.open', { size });
  for (const p of ps.slice(1)) await p.call('trace.join', {});
  for (const p of ready) await p.call('trace.ready', { ready: true });
}
async function started(e: Env, c: TC, room: RaceRoom): Promise<void> {
  e.clock.advance(150);
  await c.waitFor('race.updated', (x) => x.room.id === room.id && x.room.status === 'yarista', 3000);
}

describe('Takım Yarışı', () => {
  it('lobi → arama → eşleşme → yarış → şeffaf puan → sonuç bir kez, ödül ve lig puanı', async () => {
    env = await setup({ raceCountdownMs: 100 });
    const A = await team(env, 'Kulaklar', '🦉', ['Ayşe', 'Ali', 'Asya']);
    const B = await team(env, 'Yunuslar', '🐬', ['Bora', 'Banu', 'Berk']);
    // üye lobi açamaz; az hazırla arama olmaz
    expect((await err(A.ps[1]!.call('trace.open', { size: 3 }))).code).toBe('YETKI');
    await A.ps[0]!.call('trace.open', { size: 3 });
    expect((await err(A.ps[0]!.call('trace.search', { on: true }))).code).toBe('AZ');
    for (const p of A.ps.slice(1)) await p.call('trace.join', {});
    for (const p of A.ps) await p.call('trace.ready', { ready: true });
    const la = (await A.ps[0]!.call('trace.search', { on: true })).lobby;
    expect(la.status).toBe('ariyor');
    expect(la.note).toContain('arayan başka takım yok');
    expect((await B.ps[0]!.call('trace.state', {})).state.searching).toBe(1);
    await gather(B.ps);
    await B.ps[0]!.call('trace.search', { on: true });
    const m = await A.ps[1]!.waitFor('trace.matched');
    const room = m.room;
    expect(room.team).toMatchObject({ size: 3, friendly: false, a: { name: 'Kulaklar', n: 3, mult: 1 }, b: { name: 'Yunuslar', n: 3, mult: 1 } });
    expect(room.players.map((p) => p.side)).toEqual(['a', 'a', 'a', 'b', 'b', 'b']);
    expect(room.status).toBe('geri-sayim');
    // takımın süren yarışı varken yeni lobi yok
    expect((await err(A.ps[0]!.call('trace.open', { size: 3 }))).code).toBe('SURUYOR');
    await started(env, A.ps[0]!, room);
    // bitiş: Ayşe 1, Bora 2, Ali 3, Banu 4, Berk 5, Asya bitiremedi
    const [ay, al, as] = A.ps; const [bo, ba, be] = B.ps;
    await ay!.call('race.finish', { completed: true, score: 900, timeSec: 40 });
    await bo!.call('race.finish', { completed: true, score: 900, timeSec: 41 });
    await al!.call('race.finish', { completed: true, score: 900, timeSec: 42 });
    await ba!.call('race.finish', { completed: true, score: 900, timeSec: 43 });
    await be!.call('race.finish', { completed: true, score: 900, timeSec: 44 });
    await as!.call('race.finish', { completed: false, score: 100, timeSec: 60 });
    // yıldızlar doğrulanmış koşudan (raceId ile): Ayşe 3, Ali 1, Bora 2, Banu 3, Berk 0
    await ay!.call('progress.submit', run(1, { raceId: room.id, stars: 3 }));
    await al!.call('progress.submit', run(1, { raceId: room.id, stars: 1 }));
    await bo!.call('progress.submit', run(1, { raceId: room.id, stars: 2 }));
    await ba!.call('progress.submit', run(1, { raceId: room.id, stars: 3 }));
    await be!.call('progress.submit', run(1, { raceId: room.id, stars: 0 }));
    const res = (await ay!.waitFor('trace.result', undefined, 4000)).result;
    // A: (10+6) + (6+2) + 0 = 24; B: (8+4) + (5+6) + (4+0) = 27
    expect([res.a.score, res.b.score, res.winner]).toEqual([24, 27, 'b']);
    expect(res.rows.map((r) => [r.name, r.place, r.points])).toEqual([['Ayşe', 1, 16], ['Bora', 2, 12], ['Ali', 3, 8], ['Banu', 4, 11], ['Berk', 5, 4], ['Asya', null, 0]]);
    expect(res.counted).toBe(true);
    // bir kez: ikinci yazım yok
    expect(finalize(env.srv.app, res.matchId)).toBeNull();
    // ödüller: kazanan takım 60 jeton + 3 kristal; kaybedende yalnız bitirenler 20 jeton
    expect((await inbox(ba!, 'takim-yarisi')).map((i) => [i.kind, i.amount]).sort()).toEqual([['jeton', 60], ['kristal', 3]]);
    expect((await inbox(al!, 'takim-yarisi')).map((i) => [i.kind, i.amount])).toEqual([['jeton', 20]]);
    expect(await inbox(as!, 'takim-yarisi')).toEqual([]);
    // akış kartı (iki takımda), lig puanı, son sonuçlar
    const h = (await bo!.call('chat.join', { room: `takim:${B.id}` })).history;
    expect(h.some((x) => x.kind === 'feed' && x.meta?.type === 'tyaris' && x.meta?.outcome === 'win' && x.text.includes('27 – 24'))).toBe(true);
    expect((await bo!.call('tlig.state', {})).state.mine.race).toBe(20);
    expect((await ay!.call('tlig.state', {})).state.mine.race).toBe(4);
    const stA = (await ay!.call('trace.state', {})).state;
    expect([stA.lobby, stA.live, stA.recent[0]?.matchId]).toEqual([null, null, res.matchId]);
    expect((await ay!.call('trace.result', { matchId: res.matchId })).result?.winner).toBe('b');
  });

  it('eşleşme güç penceresiyle; pencere zamanla genişler; rakip yoksa dürüst not ve süre sonunda arama biter', async () => {
    env = await setup({ raceCountdownMs: 100 });
    const A = await team(env, 'Güçlüler', '👑', ['Ada', 'Arda']);
    const B = await team(env, 'Yeniler', '🌱', ['Bal', 'Bulut']);
    for (let l = 1; l <= 12; l++) await A.ps[0]!.call('progress.submit', run(l, { stars: 3 }));
    await gather(A.ps); await gather(B.ps);
    await A.ps[0]!.call('trace.search', { on: true });
    const lb = (await B.ps[0]!.call('trace.search', { on: true })).lobby;
    // güç farkı (12 bölüm × 3 yıldız) pencerenin dışında: henüz eşleşme yok
    expect(lb.status).toBe('ariyor');
    expect(lb.note).toContain('aranıyor');
    env.clock.advance(20_000); env.srv.sweep();
    expect((await B.ps[0]!.call('trace.state', {})).state.lobby?.status).toBe('ariyor');
    env.clock.advance(40_000); env.srv.sweep();
    const m = await B.ps[1]!.waitFor('trace.matched');
    expect(m.room.team?.a.name).toBe('Güçlüler');
    // tek başına arayan: dürüst not, 3 dk sonra arama durur
    const C = await team(env, 'Yalnızlar', '🌙', ['Can', 'Cem']);
    await gather(C.ps);
    const lc = (await C.ps[0]!.call('trace.search', { on: true })).lobby;
    expect(lc.note).toContain('arayan başka takım yok');
    env.clock.advance(181_000); env.srv.sweep();
    const st = (await C.ps[0]!.call('trace.state', {})).state.lobby!;
    expect(st.status).toBe('toplaniyor');
    expect(st.note).toContain('bulunamadı');
  });

  it('dostluk daveti → kabul; az kişili takıma denge çarpanı; bağlantısı kopan süre sonunda bitiremedi sayılır', async () => {
    env = await setup({ raceCountdownMs: 100, teamRaceGraceMs: 150 });
    const A = await team(env, 'Davetçiler', '🧭', ['Efe', 'Ece', 'Eda']);
    const B = await team(env, 'İkililer', '🍀', ['Gül', 'Gök']);
    await gather(A.ps);
    await A.ps[0]!.call('trace.challenge', { teamId: B.id });
    const ch = await B.ps[1]!.waitFor('trace.challenged');
    expect(ch.challenge).toMatchObject({ name: 'Davetçiler', size: 3 });
    // kabul için lobide hazır üye gerekir
    expect((await err(B.ps[0]!.call('trace.accept', { teamId: A.id }))).code).toBe('AZ');
    await B.ps[1]!.call('trace.join', {});
    for (const p of B.ps) await p.call('trace.ready', { ready: true });
    await B.ps[0]!.call('trace.accept', { teamId: A.id });
    const room = (await A.ps[2]!.waitFor('trace.matched')).room;
    expect(room.team).toMatchObject({ friendly: true, a: { name: 'Davetçiler', n: 3, mult: 1 }, b: { name: 'İkililer', n: 2, mult: 1.5 } });
    await started(env, A.ps[0]!, room);
    // Eda'nın bağlantısı kopar: bekleme içinde hâlâ yarışta, sonra ayrılmış
    A.ps[2]!.close();
    await sleep(40);
    let live = (await A.ps[0]!.call('trace.state', {})).state.live!;
    expect(live.players.find((p) => p.name === 'Eda')!.left).toBe(false);
    await sleep(250);
    live = (await A.ps[0]!.call('trace.state', {})).state.live!;
    expect(live.players.find((p) => p.name === 'Eda')!.left).toBe(true);
    // Gül 1, Efe 2, Gök 3, Ece 4
    for (const [c, s] of [[B.ps[0]!, 1], [A.ps[0]!, 1], [B.ps[1]!, 1], [A.ps[1]!, 1]] as const) {
      await c.call('race.finish', { completed: true, score: 500, timeSec: 50 });
      await c.call('progress.submit', run(1, { raceId: room.id, stars: s }));
    }
    const res = (await A.ps[0]!.waitFor('trace.result', undefined, 4000)).result;
    // A: (8+2) + (5+2) + 0 = 17; B ham: (10+2) + (6+2) = 20 → ×1.5 = 30
    expect([res.a.raw, res.a.score, res.b.raw, res.b.score, res.winner]).toEqual([17, 17, 20, 30, 'b']);
    // rövanş: karşı takıma yeni dostluk daveti
    const lob = (await A.ps[0]!.call('trace.rematch', { matchId: res.matchId })).lobby;
    expect(lob.outgoing?.name).toBe('İkililer');
    expect((await B.ps[0]!.waitFor('trace.challenged')).challenge.name).toBe('Davetçiler');
  });

  it('istek doğrulama: boyut, tepki, takımsız oyuncu', async () => {
    env = await setup();
    const a = await env.connect('Yalnız');
    expect((await err(a.call('trace.open', { size: 4 as 3 }))).code).toBe('GECERSIZ');
    expect((await err(a.call('trace.react', { emoji: '💩' }))).code).toBe('GECERSIZ');
    expect((await err(a.call('trace.state', {}))).code).toBe('TAKIMSIZ');
    expect((await err(a.call('tlig.state', {}))).code).toBe('TAKIMSIZ');
  });
});

describe('Takım Ligi', () => {
  it('sezon kapanışı bir kez: yükselme / düşme, geçmiş, rozet, üye başına ödül bir kez, duyuru; Sıralama "Takım Ligi" tablosu', async () => {
    env = await setup();
    const app = env.srv.app;
    // 7 Bronz takım + 6 Gümüş takım (her biri tek üyeli)
    const bronz: { id: string; c: TC }[] = []; const gumus: { id: string; c: TC }[] = [];
    for (let i = 0; i < 7; i++) { const c = await env.connect(`Br${i}`); bronz.push({ id: (await c.call('team.create', { name: `Bronz ${i}`, emblem: '🔥' })).team.id, c }); }
    for (let i = 0; i < 6; i++) { const c = await env.connect(`Gm${i}`); gumus.push({ id: (await c.call('team.create', { name: `Gümüş ${i}`, emblem: '🌙' })).team.id, c }); }
    for (const t of gumus) app.db.run("INSERT INTO tl_team(team_id, tier) VALUES(?, 'gumus')", t.id);
    const st0 = (await bronz[0]!.c.call('tlig.state', {})).state;
    expect(st0.tier).toBe('bronz');
    expect(st0.rows).toHaveLength(7);
    expect([st0.promoteTop, st0.demoteBottom]).toEqual([3, 0]);
    expect((await gumus[0]!.c.call('tlig.state', {})).state).toMatchObject({ tier: 'gumus', promoteTop: 3, demoteBottom: 3 });
    // puanlar (takım yarışı kaydı): Bronz i → (6 - i) × 10 (sonuncu 0); Gümüş i → (6 - i) × 5
    const s = seasonInfo(app.now());
    const put = (teamId: string, pts: number) => app.db.run('INSERT INTO tl_race(match_id, team_id, season, day, rival_id, points, counted, at) VALUES(?, ?, ?, ?, ?, ?, 1, ?)', `m${teamId}`, teamId, s.key, 'gün', 'x', pts, app.now());
    bronz.forEach((t, i) => put(t.id, (6 - i) * 10)); gumus.forEach((t, i) => put(t.id, (6 - i) * 5));
    const rows = (await bronz[3]!.c.call('tlig.state', {})).state.rows;
    expect(rows.map((r) => [r.rank, r.points])).toEqual([[1, 60], [2, 50], [3, 40], [4, 30], [5, 20], [6, 10], [7, 0]]);
    expect(rows.find((r) => r.me)?.name).toBe('Bronz 3');
    const board = (await bronz[0]!.c.call('rank.board', { board: 't-lig', scope: 'herkes' })).view;
    expect(board.rows[0]).toMatchObject({ name: 'Bronz 0', value: 60 });
    // sezon biter (2 hafta)
    env.clock.advance(14 * 24 * 3_600_000);
    const n1 = (await bronz[0]!.c.call('tlig.state', {})).state;
    expect(n1.season.no).toBe(s.no + 1);
    expect(n1.tier).toBe('gumus');
    expect(n1.history[0]).toMatchObject({ no: s.no, tier: 'bronz', rank: 1, outcome: 'yukseldi', points: 60, groupSize: 7 });
    expect(n1.badge).toEqual({ tier: 'bronz', no: s.no, rank: 1 });
    expect((await bronz[6]!.c.call('tlig.state', {})).state).toMatchObject({ tier: 'bronz', history: [{ outcome: 'kaldi', rank: 7 }] });
    expect((await gumus[5]!.c.call('tlig.state', {})).state).toMatchObject({ tier: 'bronz', history: [{ outcome: 'dustu' }] });
    expect((await gumus[0]!.c.call('tlig.state', {})).state.tier).toBe('altin');
    expect((await gumus[3]!.c.call('tlig.state', {})).state.tier).toBe('bronz');
    // ödül: Bronz 1. 5 × 3 = 15, 2. 10, 3. 8 (7,5), diğer puanlı 5, puansız yok; Gümüş 1. 8 × 3 = 24
    const amt = async (c: TC) => (await inbox(c, 'takim-ligi')).map((i) => i.amount);
    expect(await amt(bronz[0]!.c)).toEqual([15]);
    expect(await amt(bronz[1]!.c)).toEqual([10]);
    expect(await amt(bronz[2]!.c)).toEqual([8]);
    expect(await amt(bronz[5]!.c)).toEqual([5]);
    expect(await amt(bronz[6]!.c)).toEqual([]);
    expect(await amt(gumus[0]!.c)).toEqual([24]);
    // ikinci kapanış denemesi ödül vermez
    env.srv.sweep();
    expect(await amt(bronz[0]!.c)).toEqual([15]);
    // duyuru takım sohbetinde
    const h = (await bronz[0]!.c.call('chat.join', { room: `takim:${bronz[0]!.id}` })).history;
    expect(h.some((m) => m.meta?.event === 'tlig' && m.text.includes('Gümüş kademesine yükseldiniz'))).toBe(true);
  });
});
