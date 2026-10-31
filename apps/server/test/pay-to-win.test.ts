/**
 * Pay-to-win yok (karar 29, YN-057): kamp binaları parayla satılan hızlandırıcılarla da büyür; bu yüzden hiçbir bina seviyesi takım
 * rekabetine (Bölge Savaşı, Baskın, Takım Yarışı) ya da lige yansımaz. Binalar yalnız kişisel etki verir (jeton, kalkan, klinik).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILDINGS } from '@odi/shared';
import { setup, run, type Env, type TC } from './helpers';

let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });

const maxBuildings = (e: Env, pid: string) => {
  for (const b of BUILDINGS) e.srv.app.db.run('UPDATE buildings SET level = ? WHERE player_id = ? AND id = ?', b.maxLevel, pid, b.id);
};

describe('bina seviyesi takım puanlarını değiştirmez (karar 29)', () => {
  it('aynı kosular: savaş, baskın ve lig puanı binalar en üstteyken ve hiç yokken birebir aynı', async () => {
    const e = env = await setup({ raidAlways: true });
    const [a, b] = [await e.connect('Ayşe'), await e.connect('Bora')];
    await a.call('team.create', { name: 'Kule Ustaları', emblem: '🦉' });
    await b.call('team.create', { name: 'Çadırcılar', emblem: '🌱' });
    maxBuildings(e, a.me!.id);
    const ba = await a.call('me.bonuses', {}); const bb = await b.call('me.bonuses', {});
    // kişisel etkiler kalır, takım etkisi binadan gelmez
    expect(ba.coinPct).toBeGreaterThan(0);
    expect(ba.shieldChancePct).toBeGreaterThan(0);
    expect([ba.warPct, ba.raidPct]).toEqual([0, 0]);
    expect([bb.warPct, bb.raidPct]).toEqual([0, 0]);

    const kosular = [run(1, { mechanic: 'boss' }), run(2, { stars: 2, biome: 'kanal' }), run(3, { stars: 1 }), run(1), run(1), run(2, { completed: false, stars: 0 })];
    const play = async (c: TC) => {
      const out = [];
      for (const k of kosular) { const ack = await c.call('progress.submit', { ...k, runId: `${k.runId}-${c.me!.id}` }); out.push([ack.warPoints, ack.raidDamage, ack.leaguePoints]); }
      return out;
    };
    const pa = await play(a); const pb = await play(b);
    expect(pa).toEqual(pb);
    const wa = (await a.call('war.state', {})).war; const wb = (await b.call('war.state', {})).war;
    expect([wa.teamPoints, wa.myPoints]).toEqual([wb.teamPoints, wb.myPoints]);
    expect(wa.teamPoints).toBeGreaterThan(0);
    const ra = (await a.call('raid.state', {})).raid; const rb = (await b.call('raid.state', {})).raid;
    expect(ra.maxHp - ra.hp).toBe(rb.maxHp - rb.hp);
    expect((await a.call('league.state', {})).league.points).toBe((await b.call('league.state', {})).league.points);
    // kişisel jeton farkı ise beklenir (Odyometri + Kule)
    const ja = (await a.call('wallet.get', {})).wallet.jeton; const jb = (await b.call('wallet.get', {})).wallet.jeton;
    expect(ja).toBeGreaterThan(jb);
  });

  it('takım rekabeti modülleri bina tablosunu ve bina etkilerini okumaz', () => {
    const src = resolve(__dirname, '../src');
    const files = ['war.ts', 'raid.ts', 'league.ts', ...readdirSync(resolve(src, 'teamrace')).map((f) => `teamrace/${f}`)];
    for (const f of files) {
      const s = readFileSync(resolve(src, f), 'utf8');
      expect(s, f).not.toMatch(/\bbuildings\b|bonusesFor|KULE_PCT/);
    }
  });
});
