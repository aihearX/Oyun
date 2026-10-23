import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BUILDINGS, LEGACY_BUILDINGS, buildCost, type CampState } from '@odi/shared';
import { CAMP_XP, campXpNeed, campXpState, campXpTotalFor, decorSlots, depotCapHours, libStored, pointCell, CAMP_LOTS } from '@odi/content';
import type { NetError } from '@odi/net';
import { startServer } from '../src/server';
import { grantCampXp, grantDecoration } from '../src/camp-xp';
import { setup, type Env } from './helpers';

let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };
const HOUR = 3_600_000;
function setLevels(e: Env, pid: string, levels: Record<string, number>) {
  for (const [id, l] of Object.entries(levels)) e.srv.app.db.run('UPDATE buildings SET level = ? WHERE player_id = ? AND id = ?', l, pid, id);
}
/** sunucu işleminin içinde çalıştır (dışa açık API'ler çağıranın işleminde çalışır) */
const inTx = <T,>(e: Env, f: () => T) => e.srv.app.run(f);
const xpOf = (c: CampState) => c.xp!;
/** ana adada boş bir hücre (merkezin önünde, meydanın kenarı) */
const FREE: [number, number] = pointCell(-120, 110);
/** bölge anıtlarını (ilerleme) dışarıda tut: XP toplamları yalnız sınanan kaynaktan gelsin */
const noRegions = (e: Env, pid: string) => e.srv.app.db.run('UPDATE players SET highest = 0 WHERE id = ?', pid);

describe('Kamp Seviyesi ve Kamp XP', () => {
  it('yeni oyuncu Sv 1 / 0 XP; inşaat XP verir (ref ile bir kez), seviye ödülleri bir kez', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const pid = a.me!.id; noRegions(env, pid);
    const s0 = await a.call('camp.state', {});
    expect(xpOf(s0.camp)).toEqual({ level: 1, total: 0, into: 0, need: campXpNeed(1) });
    // Sv 1 ödülü: başlangıç süsleri
    expect(s0.camp.decor!.inv).toEqual({ diyapazon: 1, 'odyogram-tarhi': 1 });
    expect(s0.camp.decor!.cap).toBe(decorSlots(1, 0));
    // depoyu kur → süre dolunca XP
    await a.call('camp.upgrade', { id: 'depo' });
    env.clock.advance(buildCost('depo', 1).seconds * 1000);
    const s1 = await a.call('camp.state', {});
    expect(xpOf(s1.camp).total).toBe(CAMP_XP.build('depo', 1));
    // aynı ref ikinci kez XP vermez
    const g = inTx(env, () => grantCampXp(env!.srv.app, pid, 30, 'test', 'bina:depo:1'));
    expect(g.gained).toBe(0);
    // görev gibi başka bir sistem: ref ile bir kez; seviye atlarsa ödül bir kez
    const before = (await a.call('camp.state', {})).camp.xp!;
    const g2 = inTx(env, () => grantCampXp(env!.srv.app, pid, campXpTotalFor(3) - before.total, 'Görev', 'gorev:deneme'));
    expect(g2.levelsUp).toEqual([2, 3]);
    expect(inTx(env, () => grantCampXp(env!.srv.app, pid, 500, 'Görev', 'gorev:deneme')).gained).toBe(0);
    const s2 = await a.call('camp.state', {});
    expect(xpOf(s2.camp).level).toBe(3);
    expect(s2.camp.decor!.inv['odyogram-tarhi']).toBe(3); // Sv 1: 1 + Sv 2: 2
    expect(s2.camp.decor!.inv.stereosilya).toBe(2); // Sv 3
    await a.call('camp.state', {});
    expect((await a.call('camp.state', {})).camp.decor!.inv.stereosilya).toBe(2); // tekrar verilmez
  });

  it('seviye eğrisi ve durum hesabı tutarlı', () => {
    expect(campXpState(0)).toEqual({ level: 1, total: 0, into: 0, need: campXpNeed(1) });
    expect(campXpState(campXpTotalFor(10)).level).toBe(10);
    expect(campXpState(campXpTotalFor(10) - 1).level).toBe(9);
    expect(campXpState(10 ** 9)).toMatchObject({ level: 30, need: 0, into: 0 });
    for (let l = 1; l < 29; l++) expect(campXpNeed(l + 1)).toBeGreaterThan(campXpNeed(l));
  });

  it('bölge binası Kamp Seviyesiyle açılır; Akustik Kabin Kamp XP bonusu verir', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const pid = a.me!.id;
    env.srv.app.db.run('UPDATE players SET jeton = 100000 WHERE id = ?', pid); noRegions(env, pid);
    await a.call('camp.state', {});
    setLevels(env, pid, { merkez: 5 });
    expect((await err(a.call('camp.upgrade', { id: 'kabin' }))).code).toBe('SART');
    inTx(env, () => grantCampXp(env!.srv.app, pid, campXpTotalFor(3), 'test'));
    await a.call('camp.upgrade', { id: 'kabin' });
    env.clock.advance(buildCost('kabin', 1).seconds * 1000);
    await a.call('camp.state', {});
    setLevels(env, pid, { kabin: 10 });
    expect(inTx(env, () => grantCampXp(env!.srv.app, pid, 100, 'test')).gained).toBe(130);
  });

  it('eski oyuncu: XP bina seviyelerinden geriye dönük tohumlanır, anıtlar XP ve süs verir', async () => {
    env = await setup();
    const a = await env.connect('Eski'); const pid = a.me!.id;
    // camp_xp satırı henüz yok (ilk kamp okumasından önce): binalar ve ilerleme var
    env.srv.app.db.run('DELETE FROM camp_xp WHERE player_id = ?', pid);
    setLevels(env, pid, { merkez: 3, depo: 2 });
    env.srv.app.db.run('UPDATE players SET highest = 4 WHERE id = ?', pid);
    const s = await a.call('camp.state', {});
    let build = 0; for (let l = 2; l <= 3; l++) build += CAMP_XP.build('merkez', l); for (let l = 1; l <= 2; l++) build += CAMP_XP.build('depo', l);
    const regions = s.camp.xp!.total - build;
    expect(regions % CAMP_XP.monument).toBe(0);
    expect(regions).toBeGreaterThan(0);
    expect(s.camp.decor!.inv['otoskop-lamba']).toBeGreaterThanOrEqual(1); // Dış Kulak anıtı
    const again = await a.call('camp.state', {});
    expect(again.camp.xp!.total).toBe(s.camp.xp!.total);
  });
});

describe('Eski istemci uyumu', () => {
  it('campV gönderilmeyen bağlantıya yalnız eski binalar gider', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const pid = a.me!.id;
    expect((await a.call('camp.state', {})).camp.buildings.length).toBe(BUILDINGS.length);
    env.srv.app.online.get(pid)!.campV = 0;
    const old = await a.call('camp.state', {});
    expect(old.camp.buildings.map((b) => b.id)).toEqual(LEGACY_BUILDINGS);
  });
});

describe('Süslemeler', () => {
  it('yerleştir / taşı / çevir / depoya kaldır; geçersiz yer, çakışma ve sınır', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const pid = a.me!.id; noRegions(env, pid);
    await a.call('camp.state', {});
    // denizde ve binanın arsasında olmaz
    expect((await err(a.call('camp.decor.place', { id: 'diyapazon', gx: 100, gy: -100 }))).code).toBe('YER');
    const [mx, my] = pointCell(CAMP_LOTS.merkez.x, CAMP_LOTS.merkez.y);
    expect((await err(a.call('camp.decor.place', { id: 'diyapazon', gx: mx, gy: my }))).code).toBe('YER');
    expect((await err(a.call('camp.decor.place', { id: 'koklea-cesme', gx: FREE[0], gy: FREE[1] }))).code).toBe('YOK'); // envanterde yok
    const p = await a.call('camp.decor.place', { id: 'diyapazon', gx: FREE[0], gy: FREE[1] });
    expect(p.camp.decor!.placed).toMatchObject([{ id: 'diyapazon', gx: FREE[0], gy: FREE[1], flip: false }]);
    expect(p.camp.decor!.inv.diyapazon).toBeUndefined();
    expect(p.camp.xp!.total).toBe(CAMP_XP.decorFirst); // ilk kez yerleştirme
    // aynı hücreye ikinci süs olmaz
    expect((await err(a.call('camp.decor.place', { id: 'odyogram-tarhi', gx: FREE[0], gy: FREE[1] }))).code).toBe('YER');
    const uid = p.camp.decor!.placed[0]!.uid;
    const m = await a.call('camp.decor.move', { uid, gx: FREE[0] + 2, gy: FREE[1], flip: true });
    expect(m.camp.decor!.placed[0]).toMatchObject({ gx: FREE[0] + 2, flip: true });
    const st = await a.call('camp.decor.store', { uid });
    expect(st.camp.decor!.placed).toEqual([]);
    expect(st.camp.decor!.inv.diyapazon).toBe(1);
    // ikinci yerleştirme ilk-kez XP'sini tekrar vermez
    const p2 = await a.call('camp.decor.place', { id: 'diyapazon', gx: FREE[0], gy: FREE[1] });
    expect(p2.camp.xp!.total).toBe(CAMP_XP.decorFirst);
    // başkasının süsü taşınamaz
    const b = await env.connect('Bora');
    expect((await err(b.call('camp.decor.move', { uid: p2.camp.decor!.placed[0]!.uid, gx: 0, gy: 0 }))).code).toBe('YOK');
    // sınır: cap kadar
    inTx(env, () => grantDecoration(env!.srv.app, pid, 'stereosilya', 10));
    const cap = p2.camp.decor!.cap; let placed = 1; let gx = FREE[0] - 6;
    while (placed < cap) { await a.call('camp.decor.place', { id: 'stereosilya', gx, gy: FREE[1] - 4 }); placed++; gx += 1; }
    expect((await err(a.call('camp.decor.place', { id: 'stereosilya', gx: gx + 1, gy: FREE[1] - 4 }))).code).toBe('DOLU');
  });

  it('grantDecoration: bilinmeyen kimlik 0, ref ile bir kez, envanter sınırı', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const pid = a.me!.id;
    await a.call('camp.state', {});
    expect(inTx(env, () => grantDecoration(env!.srv.app, pid, 'yok-boyle', 1))).toBe(0);
    expect(inTx(env, () => grantDecoration(env!.srv.app, pid, 'vaka-panosu', 1, 'gorev:vaka-1'))).toBe(1);
    expect(inTx(env, () => grantDecoration(env!.srv.app, pid, 'vaka-panosu', 1, 'gorev:vaka-1'))).toBe(0);
    expect(inTx(env, () => grantDecoration(env!.srv.app, pid, 'vaka-panosu', 99))).toBe(19);
    expect((await a.call('camp.state', {})).camp.decor!.inv['vaka-panosu']).toBe(20);
  });
});

describe('Yeni bina etkileri', () => {
  it('Kütüphane okuma köşesi zamanla Kamp XP biriktirir; ikinci toplama 0', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const pid = a.me!.id;
    await a.call('camp.state', {});
    expect((await err(a.call('camp.lib.collect', {}))).code).toBe('SART');
    setLevels(env, pid, { kutuphane: 3 });
    env.srv.app.db.run('UPDATE camp_xp SET lib_at = ? WHERE player_id = ?', env.clock.t, pid);
    env.clock.advance(2 * HOUR);
    const r = await a.call('camp.lib.collect', {});
    expect(r.xp).toBe(libStored(3, 1, 1 + 2 * HOUR).stored);
    expect(r.xp).toBe(12);
    expect((await a.call('camp.lib.collect', {})).xp).toBe(0);
  });
  it('Vestibüler Laboratuvar depo dolma süresini uzatır; bina gücü Sv 15te tavan yapar', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const pid = a.me!.id;
    setLevels(env, pid, { depo: 1, denge: 4 });
    env.srv.app.db.run('UPDATE players SET depot_at = ? WHERE id = ?', env.clock.t, pid);
    env.clock.advance(20 * HOUR);
    const c = await a.call('camp.collect', {});
    expect(c.collected).toBe(20 * depotCapHours(4));
    setLevels(env, pid, { laboratuvar: 25, atolye: 20, revir: 16, kule: 25 });
    const b = await a.call('me.bonuses', {});
    expect(b).toMatchObject({ coinPct: 45, shieldChancePct: 60, firstHitIgnorePct: 45, warPct: 30 });
  });
});

describe('Kamp ziyareti ve alkış', () => {
  it('yalnız arkadaş ya da takım arkadaşı gezer; günde bir tepki, iki tarafa XP, bildirim', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora'); const c = await env.connect('Cem');
    for (const x of [a, b, c]) noRegions(env, x.me!.id);
    await b.call('camp.state', {});
    expect((await err(a.call('camp.visit', { playerId: b.me!.id }))).code).toBe('YETKI');
    await a.call('friends.add', { code: b.me!.friendCode }); await b.call('friends.add', { code: a.me!.friendCode });
    const v = await a.call('camp.visit', { playerId: b.me!.id });
    expect(v.visit).toMatchObject({ id: b.me!.id, name: 'Bora', relation: 'arkadas', cheeredToday: null, cheers: 0 });
    expect(v.visit.buildings.length).toBe(BUILDINGS.length);
    expect(v.visit.xp.level).toBe(1);
    b.drain();
    const ch = await a.call('camp.cheer', { playerId: b.me!.id, kind: 'alkis' });
    expect(ch.visit.cheeredToday).toBe('alkis'); expect(ch.visit.cheers).toBe(1); expect(ch.xp).toBe(CAMP_XP.cheerGive);
    expect(await b.waitFor('camp.cheered')).toMatchObject({ from: a.me!.id, name: 'Ayşe', kind: 'alkis' });
    expect((await err(a.call('camp.cheer', { playerId: b.me!.id, kind: 'guzel' }))).code).toBe('TEKRAR');
    expect((await b.call('camp.state', {})).camp.xp!.total).toBe(CAMP_XP.cheerGot);
    // ertesi gün yeniden
    env.clock.advance(24 * HOUR);
    expect((await a.call('camp.cheer', { playerId: b.me!.id, kind: 'guzel' })).visit.cheers).toBe(2);
    // takım arkadaşı
    env.srv.app.db.run('UPDATE players SET team_id = ? WHERE id IN (?, ?)', 'takim1', a.me!.id, c.me!.id);
    expect((await c.call('camp.visit', { playerId: a.me!.id })).visit.relation).toBe('takim');
    expect((await err(c.call('camp.visit', { playerId: c.me!.id }))).code).toBe('GECERSIZ');
  });
});

describe('Kamp büyümesi göçü', () => {
  it('eski veritabanı: yeni bina satırları ve tablolar eklenir; iki kez açmak bir şey değiştirmez', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'odi-kamp2-')); const file = join(dir, 'odi.db');
    try {
      let srv = await startServer({ port: 0, host: '127.0.0.1', dbFile: file, testStore: true, sweepMs: 60_000 });
      const id = 'peski2';
      srv.app.db.run(`INSERT INTO players(id, token_hash, name, color, friend_code, jeton, depot_at, created_at, last_seen) VALUES(?, 'h', 'Eski', 1, 'ESKI33', 0, 0, 0, 0)`, id);
      for (const b of LEGACY_BUILDINGS) srv.app.db.run('INSERT INTO buildings(player_id, id, level) VALUES(?, ?, ?)', id, b, b === 'merkez' ? 6 : 3);
      srv.app.db.raw.exec('DROP TABLE camp_xp; DROP TABLE camp_xp_log; DROP TABLE decor_inv; DROP TABLE decor_placed; DROP TABLE camp_cheers;');
      await srv.close();
      for (let i = 0; i < 2; i++) {
        srv = await startServer({ port: 0, host: '127.0.0.1', dbFile: file, testStore: true, sweepMs: 60_000 });
        const rows = srv.app.db.all<{ id: string; level: number }>('SELECT id, level FROM buildings WHERE player_id = ? ORDER BY id', id);
        expect(rows).toHaveLength(BUILDINGS.length);
        expect(rows.find((r) => r.id === 'kabin')).toEqual({ id: 'kabin', level: 0 });
        expect(rows.find((r) => r.id === 'merkez')!.level).toBe(6);
        for (const t of ['camp_xp', 'camp_xp_log', 'decor_inv', 'decor_placed', 'camp_cheers']) expect(srv.app.db.get('SELECT name FROM sqlite_master WHERE type = ? AND name = ?', 'table', t)).toBeTruthy();
        await srv.close();
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
