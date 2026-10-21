import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCost, type CampState } from '@odi/shared';
import { REMEDY_INV_CAP, remedyById, remedyPeriodMs, remedyShelfCap } from '@odi/content';
import type { NetError } from '@odi/net';
import { startServer } from '../src/server';
import { setup, run, type Env } from './helpers';

let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };
const lvl = (camp: CampState, id: string) => camp.buildings.find((x) => x.id === id)!.level;
const MIN = 60_000;

/** oyuncunun binalarını doğrudan ayarla (test kısayolu) */
function setLevels(e: Env, pid: string, levels: Record<string, number>) {
  for (const [id, l] of Object.entries(levels)) e.srv.app.db.run('UPDATE buildings SET level = ? WHERE player_id = ? AND id = ?', l, pid, id);
}

describe('Tedavi Odası (Kulak Kampı)', () => {
  it('yeni bina: 7 bina, Tedavi Odası Sv 0 başlar ve merkez sınırına uyar', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    const s = await a.call('camp.state', {});
    expect(s.camp.buildings.map((b) => b.id)).toEqual(['merkez', 'laboratuvar', 'atolye', 'depo', 'kule', 'revir', 'tedavi']);
    expect(lvl(s.camp, 'tedavi')).toBe(0);
    expect(s.camp.remedy).toEqual({ item: null, since: 0, inv: {} });
    expect((await err(a.call('camp.remedy.make', { item: 'kulak-tikaci' }))).code).toBe('SART');
    const up = await a.call('camp.upgrade', { id: 'tedavi' });
    expect(up.wallet.jeton).toBe(100 - buildCost('tedavi', 1).jeton);
  });

  it('üretim zamanı: adet adet hazırlanır, raf sınırında durur, toplama zamana bağlı (ikinci çağrı 0)', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const pid = a.me!.id;
    setLevels(env, pid, { tedavi: 1 });
    const def = remedyById('kulak-tikaci')!; const per = remedyPeriodMs(def, 1);
    expect(per).toBe(20 * MIN);
    // kilitli tarif (Sv 3) seçilemez; bilinmeyen tarif reddedilir
    expect((await err(a.call('camp.remedy.make', { item: 'zar-yamasi' }))).code).toBe('SART');
    expect((await err(a.call('camp.remedy.make', { item: 'yok-boyle' }))).code).toBe('YOK');
    const m = await a.call('camp.remedy.make', { item: 'kulak-tikaci' });
    expect(m.camp.remedy).toMatchObject({ item: 'kulak-tikaci', since: env.clock.t, inv: {} });
    env.clock.advance(per - 1000);
    expect((await a.call('camp.remedy.collect', {})).collected).toBe(0);
    env.clock.advance(1000);
    const c1 = await a.call('camp.remedy.collect', {});
    expect(c1.collected).toBe(1);
    expect(c1.camp.remedy!.inv).toEqual({ 'kulak-tikaci': 1 });
    expect((await a.call('camp.remedy.collect', {})).collected).toBe(0); // idempotent: aynı an ikinci toplama boş
    // yarım kalan adet korunur: 1,5 dönem sonra 1 alınır, kalan yarım dönemde bir tane daha
    env.clock.advance(per * 1.5);
    expect((await a.call('camp.remedy.collect', {})).collected).toBe(1);
    env.clock.advance(per * 0.5);
    expect((await a.call('camp.remedy.collect', {})).collected).toBe(1);
    // raf sınırı (Sv 1: 2): uzun beklemede yalnız 2 birikir
    env.clock.advance(per * 10);
    expect((await a.call('camp.remedy.collect', {})).collected).toBe(remedyShelfCap(1));
    expect((await a.call('camp.state', {})).camp.remedy!.inv['kulak-tikaci']).toBe(5);
  });

  it('seviye süreyi kısaltır ve tarif açar; aynı tarifi yeniden seçmek sayacı sıfırlamaz', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const pid = a.me!.id;
    setLevels(env, pid, { merkez: 8, tedavi: 7 });
    const def = remedyById('stapes-protezi')!;
    expect(remedyPeriodMs(def, 7)).toBeLessThan(remedyPeriodMs(def, 1));
    await a.call('camp.remedy.make', { item: 'stapes-protezi' });
    const since = (await a.call('camp.state', {})).camp.remedy!.since;
    env.clock.advance(10 * MIN);
    await a.call('camp.remedy.make', { item: 'stapes-protezi' });
    expect((await a.call('camp.state', {})).camp.remedy!.since).toBe(since);
    expect((await err(a.call('camp.remedy.make', { item: 'koklear-implant' }))).code).toBe('SART'); // Sv 13
  });

  it('çanta sınırı: sığmayan rafta kalır; raf boşalmadan tarif değiştirilemez', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const pid = a.me!.id; const db = env.srv.app.db;
    setLevels(env, pid, { merkez: 3, tedavi: 3 });
    await a.call('camp.remedy.make', { item: 'kulak-tikaci' });
    db.run('INSERT INTO remedy_inv(player_id, id, n) VALUES(?, ?, ?)', pid, 'kulak-tikaci', REMEDY_INV_CAP - 1);
    const per = remedyPeriodMs(remedyById('kulak-tikaci')!, 3);
    env.clock.advance(per * 3);
    const c = await a.call('camp.remedy.collect', {});
    expect(c.collected).toBe(1);
    expect(c.camp.remedy!.inv['kulak-tikaci']).toBe(REMEDY_INV_CAP);
    expect((await err(a.call('camp.remedy.make', { item: 'serumen-damlasi' }))).code).toBe('DOLU');
    // bir tanesi bölümde kullanılınca rafta kalanlardan biri sığar
    await a.call('progress.submit', run(1, { remediesUsed: [{ id: 'kulak-tikaci', count: 1 }] }));
    expect((await a.call('camp.remedy.collect', {})).collected).toBe(1);
  });

  it('bölümde kullanılan malzeme envanterden bir kez düşer (runId), sıfırın altına inmez; yarışta ve bilinmeyende yok sayılır', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const pid = a.me!.id; const db = env.srv.app.db;
    db.run('INSERT INTO remedy_inv(player_id, id, n) VALUES(?, ?, 3), (?, ?, 1)', pid, 'kulak-tikaci', pid, 'serumen-damlasi');
    const r = run(1, { remediesUsed: [{ id: 'kulak-tikaci', count: 2 }, { id: 'serumen-damlasi', count: 4 }, { id: 'yok-boyle', count: 1 }] });
    const upd = a.waitFor('camp.updated');
    await a.call('progress.submit', r);
    expect((await upd).camp.remedy!.inv).toEqual({ 'kulak-tikaci': 1 });
    await a.call('progress.submit', r); // aynı koşu ikinci kez: hiçbir şey düşmez
    expect((await a.call('camp.state', {})).camp.remedy!.inv).toEqual({ 'kulak-tikaci': 1 });
    expect(db.all('SELECT * FROM remedy_use WHERE player_id = ?', pid)).toHaveLength(1);
    // yarış koşusu malzeme düşürmez (yarışta malzeme verilmez)
    await a.call('progress.submit', run(1, { raceId: 'yaris1', remediesUsed: [{ id: 'kulak-tikaci', count: 1 }] })).catch(() => undefined);
    expect((await a.call('camp.state', {})).camp.remedy!.inv).toEqual({ 'kulak-tikaci': 1 });
  });

  it('kamp açılımı: bina seviyesiyle kozmetik bir kez verilir (inşaat bitince ve kamp açılınca)', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const pid = a.me!.id; const db = env.srv.app.db;
    const cos = () => JSON.parse(db.get<{ cosmetics: string }>('SELECT cosmetics FROM players WHERE id = ?', pid)!.cosmetics) as string[];
    setLevels(env, pid, { merkez: 3, laboratuvar: 2 });
    db.run('UPDATE players SET jeton = 50000 WHERE id = ?', pid);
    await a.call('camp.upgrade', { id: 'laboratuvar' });
    expect(cos()).not.toContain('renk-sol-kulak');
    env.clock.advance(buildCost('laboratuvar', 3).seconds * 1000);
    env.srv.sweep();
    await a.waitFor('camp.updated', (x) => lvl(x.camp, 'laboratuvar') === 3);
    expect(cos()).toContain('renk-sol-kulak');
    // eski oyuncu: seviyesi zaten yeterliyse kamp açılınca verilir; tekrar çağrı çoğaltmaz
    setLevels(env, pid, { revir: 4 });
    await a.call('camp.state', {}); await a.call('camp.state', {});
    expect(cos().filter((c) => c === 'renk-klinik')).toHaveLength(1);
    expect(db.all('SELECT ref FROM camp_unlocks WHERE player_id = ?', pid).length).toBe(2);
  });
});

describe('Kamp göçü (var olan veritabanı)', () => {
  it('eski veritabanına Tedavi Odası satırı ve yeni tablolar eklenir; iki kez açmak bir şey değiştirmez', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'odi-kamp-')); const file = join(dir, 'odi.db');
    try {
      let srv = await startServer({ port: 0, host: '127.0.0.1', dbFile: file, testStore: true, sweepMs: 60_000 });
      // eski sunucunun durumu: oyuncu var, tedavi satırı ve kamp tabloları yok
      const id = 'peski1';
      srv.app.db.run(`INSERT INTO players(id, token_hash, name, color, friend_code, jeton, depot_at, created_at, last_seen) VALUES(?, 'h', 'Eski', 1, 'ESKI22', 0, 0, 0, 0)`, id);
      for (const b of ['merkez', 'laboratuvar', 'atolye', 'depo', 'kule', 'revir']) srv.app.db.run('INSERT INTO buildings(player_id, id, level) VALUES(?, ?, ?)', id, b, b === 'merkez' ? 4 : 2);
      srv.app.db.raw.exec('DROP TABLE remedy_inv; DROP TABLE remedy_prod; DROP TABLE remedy_use; DROP TABLE camp_unlocks;');
      await srv.close();
      for (let i = 0; i < 2; i++) {
        srv = await startServer({ port: 0, host: '127.0.0.1', dbFile: file, testStore: true, sweepMs: 60_000 });
        const rows = srv.app.db.all<{ id: string; level: number }>('SELECT id, level FROM buildings WHERE player_id = ? ORDER BY id', id);
        expect(rows.find((r) => r.id === 'tedavi')).toEqual({ id: 'tedavi', level: 0 });
        expect(rows.find((r) => r.id === 'merkez')!.level).toBe(4); // var olan satırlara dokunulmaz
        expect(rows).toHaveLength(7);
        for (const t of ['remedy_inv', 'remedy_prod', 'remedy_use', 'camp_unlocks']) expect(srv.app.db.get('SELECT name FROM sqlite_master WHERE type = ? AND name = ?', 'table', t)).toBeTruthy();
        await srv.close();
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
