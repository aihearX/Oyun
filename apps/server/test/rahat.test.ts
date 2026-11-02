/**
 * Rahat deneme (sahip kararı 42, YN-110): canavar bölümünde oyuncunun seçtiği kolay deneme en çok 1 yıldız verir; lig, düello,
 * savaş, baskın, takım katkısı, sıralama ve meydan okuma puanı yazmaz. Sunucu kuralı kendisi uygular (bayrak yalnız oyuncunun
 * aleyhinedir). Sonraki normal koşu yıldızı ve puanları normal kuralla yazar.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { run, setup, type Env } from './helpers';
import { err, team2 } from './events-util';

let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });

const boss = (over: Parameters<typeof run>[1] = {}) => run(20, { mechanic: 'boss', biome: 'kanal', coins: 0, stars: 1, score: 1800, ...over });

describe('Rahat deneme (sunucu)', () => {
  it('rekabet puanı yok, en çok 1 yıldız; sonraki normal koşu yıldızı ve puanları yükseltir', async () => {
    const e = env = await setup({ eventsFast: true, raidAlways: true });
    const [a] = await team2(e, ['Ayşe', 'Ali'], 'Rahat Kartalları');
    const app = e.srv.app; const pid = a.c.me!.id;
    app.db.run('UPDATE players SET highest = 20 WHERE id = ?', pid);
    const duel = async () => (await a.c.call('duel.state', {})).duel.myPoints;
    const lig0 = (await a.c.call('league.state', {})).league.points;

    // kayıp (Rahat): lig 1 puanı da yazılmaz
    const lost = await a.c.call('progress.submit', boss({ completed: false, stars: 0, rahat: true }));
    expect([lost.warPoints, lost.raidDamage, lost.leaguePoints, lost.rahat]).toEqual([0, 0, 0, true]);

    const ack = await a.c.call('progress.submit', boss({ rahat: true }));
    expect([ack.warPoints, ack.raidDamage, ack.leaguePoints, ack.rahat]).toEqual([0, 0, 0, true]);
    expect(ack.highest).toBe(21); // bölüm geçildi: sonraki açılır
    expect((await a.c.call('league.state', {})).league.points).toBe(lig0);
    expect(await duel()).toBe(0);
    expect(app.db.get<{ stars: number; score: number }>('SELECT stars, score FROM level_best WHERE player_id = ? AND level = 20', pid)).toEqual({ stars: 1, score: 0 });
    expect(app.db.get('SELECT stars FROM rank_level WHERE player_id = ? AND level = 20', pid)).toBeUndefined();
    expect(app.db.get<{ s: number }>('SELECT COALESCE(SUM(stars), 0) AS s FROM rank_week WHERE player_id = ?', pid)!.s).toBe(0);
    expect(app.db.get<{ s: number }>('SELECT COALESCE(SUM(stars), 0) AS s FROM contrib WHERE player_id = ?', pid)!.s).toBe(0);

    // kurallar: 2 yıldız, canavar dışı bölüm, yarış reddedilir
    expect((await err(a.c.call('progress.submit', boss({ rahat: true, stars: 2 })))).code).toBe('GECERSIZ');
    expect((await err(a.c.call('progress.submit', run(19, { rahat: true, stars: 1 })))).code).toBe('GECERSIZ');

    // sonraki normal koşu: yıldız 1 → 3, puanlar normal kuralla
    const up = await a.c.call('progress.submit', boss({ stars: 3, score: 3100 }));
    expect(up.leaguePoints).toBeGreaterThan(0); expect(up.warPoints).toBeGreaterThan(0); expect(up.rahat).toBeUndefined();
    expect(await duel()).toBeGreaterThan(0);
    expect(app.db.get<{ stars: number; score: number }>('SELECT stars, score FROM level_best WHERE player_id = ? AND level = 20', pid)).toEqual({ stars: 3, score: 3100 });
    // sıralamaya yıldızın tamamı normal koşuyla girer (Rahat yıldızı sayılmamıştı)
    expect(app.db.get<{ stars: number }>('SELECT stars FROM rank_level WHERE player_id = ? AND level = 20', pid)!.stars).toBe(3);
    expect(app.db.get<{ s: number }>('SELECT COALESCE(SUM(stars), 0) AS s FROM rank_week WHERE player_id = ?', pid)!.s).toBe(3);
    expect(app.player(pid).stars).toBe(3);
  });

  it('aynı koşu normal gönderilse yazacağı puanlar (karşılaştırma): Rahat bayrağı yalnız bunları sıfırlar', async () => {
    const e = env = await setup({ eventsFast: true, raidAlways: true });
    const [a] = await team2(e, ['Ayşe', 'Ali'], 'Normalciler');
    e.srv.app.db.run('UPDATE players SET highest = 20 WHERE id = ?', a.c.me!.id);
    const n = await a.c.call('progress.submit', boss());
    expect(n.leaguePoints).toBeGreaterThan(0); expect(n.warPoints).toBeGreaterThan(0); expect(n.raidDamage).toBeGreaterThan(0);
  });
});
