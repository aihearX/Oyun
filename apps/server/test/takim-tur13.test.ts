import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FRIEND_LIMITS } from '@odi/shared';
import { Db } from '../src/db';
import { userVersion, MIGRATIONS } from '../src/migrations';
import { run, setup, type Env } from './helpers';
import { team2 } from './events-util';

/**
 * Oyuncu testi tur 13 (YN-224, YN-141 (1)):
 *  - Ralli "Takım arkadaşını çağır" kaydı: kimi çağırdım ve davet görüldü mü. Okundu bilgisi özel mesajdaki çift tikle aynı kaynak
 *    (dm_reads); okunmadan "gördü" yok, başkasının çağrıları ve başka rallinin davetleri listede yok.
 *  - Bölge Savaşı "Bu hafta N puan getirdin": takıma katılmadan önce kazanılan savaş puanı ayrı (takım puanına sayılmaz).
 */
let env: Env;
let tmp = '';
afterEach(async () => { await env?.close(); env = undefined as unknown as Env; if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); tmp = ''; });

describe('ralli çağrı kaydı (OT-takim-kaptani-39)', () => {
  it('çağrılan, davet okunana dek "henüz görmedi"; özel mesajı okuyunca "gördü"', async () => {
    env = await setup();
    const [a, b, teamId] = await team2(env, ['Ayşe', 'Hesapli'], 'Çağrı Takımı');
    const c = await env.connect('Cem'); await c.call('team.join', { teamId });
    const { rally } = await a.c.call('rally.start', { monster: 'serumen-yavrusu' });
    expect((await a.c.call('rally.calls', { rallyId: rally.id })).calls).toEqual([]);
    const invite = (to: string, roomId = rally.id) => a.c.call('dm.send', { to, text: 'Ralliye katıl!', kind: 'davet', meta: { type: 'ralli', roomId, title: 'Serumen Yavrusu' } });
    await invite(b.c.me!.id);
    let calls = (await a.c.call('rally.calls', { rallyId: rally.id })).calls;
    expect(calls).toMatchObject([{ id: b.c.me!.id, name: 'Hesapli', seen: false }]);
    // özel mesajdaki çift tik ile aynı kaynak: dm.open'ın peerReadSeq'i
    const dmSeq = (await a.c.call('dm.open', { id: b.c.me!.id })).messages.at(-1)!.seq;
    expect((await a.c.call('dm.open', { id: b.c.me!.id })).peerReadSeq).toBeLessThan(dmSeq);
    await b.c.call('dm.read', { id: a.c.me!.id });
    expect((await a.c.call('dm.open', { id: b.c.me!.id })).peerReadSeq).toBeGreaterThanOrEqual(dmSeq);
    calls = (await a.c.call('rally.calls', { rallyId: rally.id })).calls;
    expect(calls).toMatchObject([{ id: b.c.me!.id, seen: true }]);
    // ikinci davet: yeni davet okunana dek yine "henüz görmedi" (kişi başına son davet)
    env.clock.advance(FRIEND_LIMITS.dmCooldownMs + 1);
    await invite(b.c.me!.id);
    calls = (await a.c.call('rally.calls', { rallyId: rally.id })).calls;
    expect(calls).toHaveLength(1);
    expect(calls[0]!.seen).toBe(false);
    // Cem'e başka bir oda için davet: bu rallinin listesine girmez
    env.clock.advance(FRIEND_LIMITS.dmCooldownMs + 1);
    await invite(c.me!.id, 'baskaOda');
    expect((await a.c.call('rally.calls', { rallyId: rally.id })).calls.map((x) => x.id)).toEqual([b.c.me!.id]);
    // başkası (Hesapli) kendi çağrılarını görür, Ayşe'ninkileri değil
    expect((await b.c.call('rally.calls', { rallyId: rally.id })).calls).toEqual([]);
  });

  it('başka takımın rallisi: boş liste', async () => {
    env = await setup();
    const [a] = await team2(env, ['Ayşe', 'Bora'], 'Bir Takım');
    const [x] = await team2(env, ['Xen', 'Yasin'], 'Öbür Takım');
    const { rally } = await a.c.call('rally.start', { monster: 'serumen-yavrusu' });
    expect((await x.c.call('rally.calls', { rallyId: rally.id })).calls).toEqual([]);
  });
});

describe('Bölge Savaşı: takıma getirilen puan (OT-ilk-kez-oyun-66, YN-141)', () => {
  it('takıma katılmadan önce kazanılan puan ayrı; takım puanına sayılmaz', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const c = await env.connect('Cem');
    const A = (await a.call('team.create', { name: 'Katılım Takımı', emblem: '🦉' })).team;
    await c.call('progress.submit', run(1)); // takımsız
    const before = (await c.call('war.state', {})).war;
    expect(before.myPoints).toBeGreaterThan(0);
    expect(before.myTeamPoints).toBe(0);
    await c.call('team.join', { teamId: A.id });
    await c.call('progress.submit', run(2));
    const w = (await c.call('war.state', {})).war;
    expect(w.myTeamPoints).toBe(w.teamPoints); // takıma yalnız katıldıktan sonraki puanı yazıldı
    expect(w.myPoints - w.myTeamPoints).toBe(before.myPoints);
    // başka takıma geçince yeni takıma getirilen sıfırdan sayılır
    await c.call('team.leave', {});
    await c.call('team.create', { name: 'Yeni Takım', emblem: '🌱' });
    expect((await c.call('war.state', {})).war.myTeamPoints).toBe(0);
    await c.call('progress.submit', run(3));
    const w2 = (await c.call('war.state', {})).war;
    expect(w2.myTeamPoints).toBe(w2.teamPoints);
    expect(w2.myRegionPoints).toBe(0); // önceki takımın bölgelerine yazılan pay bu takımın kutusunda "Sen" diye sayılmaz
    expect(w2.myPoints - w2.myTeamPoints).toBe(w.myPoints);
  });

  it('göç 15: var olan satır şimdiki takıma ve bütün puanına yazılır ("katılmadan önce" diye yanlış satır çıkmaz)', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'odi-goc-'));
    const file = path.join(tmp, 'eski.sqlite');
    const old = new Db(file);
    old.run('INSERT INTO players(id, token_hash, name, color, friend_code, depot_at, created_at, last_seen, team_id) VALUES(?, ?, ?, 0, ?, 0, 0, 0, ?)', 'p1', 'h1', 'p1', 'K1', 't1');
    old.run('INSERT INTO player_week(week, player_id, war_points, region_points) VALUES(?, ?, 120, 40)', '2026-W42', 'p1');
    old.raw.exec('ALTER TABLE player_week DROP COLUMN team_id; ALTER TABLE player_week DROP COLUMN team_points');
    old.raw.exec(`PRAGMA user_version = ${MIGRATIONS.findIndex((m) => m.name === 'savas-takim-payi')}`);
    old.close();
    const db = new Db(file);
    expect(userVersion(db.raw)).toBe(MIGRATIONS.length);
    expect(db.get('SELECT team_id, team_points FROM player_week WHERE player_id = ?', 'p1')).toEqual({ team_id: 't1', team_points: 120 });
    db.close();
  });
});
