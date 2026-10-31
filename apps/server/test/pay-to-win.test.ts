/**
 * Pay-to-win yok (karar 29, YN-057): kamp binaları parayla satılan hızlandırıcılarla da büyür; bu yüzden hiçbir bina seviyesi takım
 * rekabetine (Bölge Savaşı, Baskın, Takım Yarışı) ya da lige yansımaz. Binalar yalnız kişisel etki verir (jeton, kalkan, klinik).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { NetError } from '@odi/net';
import { BUILDINGS, PURCHASE_GIFT_REF, buildCost } from '@odi/shared';
import { teamGiftFor } from '../src/shop';
import { setup, run, type Env, type TC } from './helpers';

let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });

const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };
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

/**
 * Satın alma hediyesi jetonu (YN-065): gerçek parayla alınan paketin takıma düşen hediyesindeki jeton takım teknolojisine
 * (Savaş Borusu, Baskın Gücü, …) bağışlanamaz; oyunda kazanılan jeton bağışlanır. Kampta ve yeteneklerde harcanır (önce o harcanır).
 */
describe('satın alma hediyesi jetonu takım teknolojisine gitmez', () => {
  const kur = async () => {
    const e = env = await setup();
    const [a, b] = [await e.connect('Ayşe'), await e.connect('Bora')];
    const t = (await a.call('team.create', { name: 'Hediye Takımı', emblem: '🦉' })).team;
    await b.call('team.join', { teamId: t.id });
    await a.call('shop.limit', { limitTry: 500 });
    await a.call('shop.purchase', { productId: 'odi.kristal.3', store: 'test' });
    const g = await b.waitFor('team.gift');
    expect(g.gift.contents).toContainEqual({ kind: 'jeton', amount: 200, ref: PURCHASE_GIFT_REF });
    const claimed = await b.call('team.gift.claim', { giftId: g.gift.id });
    return { e, a, b, wallet: claimed.wallet };
  };

  it('hediye jetonu bağışlanamaz (Savaş Borusu, Baskın Gücü); oyunda kazanılan jeton bağışlanır', async () => {
    const { e, b, wallet } = await kur();
    expect(teamGiftFor(299.99).find((x) => x.kind === 'jeton')).toMatchObject({ amount: 200, ref: PURCHASE_GIFT_REF });
    // başlangıç 100 jeton + hediye 200; 200'ü bağışlanamaz
    expect(wallet).toMatchObject({ jeton: 300, bagislanamaz: 200 });
    for (const tech of ['savas', 'baskin'] as const) {
      const x = await err(b.call('team.donate', { tech, jeton: 101 }));
      expect(x.code).toBe('HEDIYE_JETONU');
      expect(x.message).toMatch(/200 jetonun takım teknolojisine bağışlanamaz.*Bağışlayabileceğin: 100 jeton/);
    }
    // kazanılmış 100 jeton bağışlanır; ardından tek jeton bile hediyeden karşılanamaz
    const d1 = await b.call('team.donate', { tech: 'savas', jeton: 100 });
    expect(d1.wallet).toMatchObject({ jeton: 200, bagislanamaz: 200 });
    expect((await err(b.call('team.donate', { tech: 'baskin', jeton: 1 }))).code).toBe('HEDIYE_JETONU');
    // oyunda kazanılan jeton yine bağışlanır
    const ack = await b.call('progress.submit', run(1, { coins: 150 }));
    expect(ack.wallet).toMatchObject({ jeton: 200 + ack.jeton, bagislanamaz: 200 });
    const d2 = await b.call('team.donate', { tech: 'baskin', jeton: ack.jeton });
    expect(d2.wallet).toMatchObject({ jeton: 200, bagislanamaz: 200 });
    // takıma giden toplam = yalnız kazanılan jeton; teknoloji ilerlemesi de öyle
    expect(d2.extra.contributionWeek.find((r) => r.id === b.me!.id)!.donated).toBe(100 + ack.jeton);
    const tech = (id: string) => d2.extra.tech.find((x) => x.id === id)!;
    expect(tech('savas').progress + tech('baskin').progress).toBe(100 + ack.jeton);
    // yetmeyen jetonda eski hata
    expect((await err(b.call('team.donate', { tech: 'savas', jeton: 5000 }))).code).toBe('YETERSIZ');
    // satın alma hediyesi olmayan jeton (ör. arkadaş hediyesi, takım hedefi) bağışlanabilir sayılır
    e.srv.app.grant(b.me!.id, { kind: 'jeton', amount: 40, ref: 'arkadas' });
    expect(e.srv.app.wallet(b.me!.id)).toMatchObject({ jeton: 240, bagislanamaz: 200 });
    expect((await b.call('team.donate', { tech: 'savas', jeton: 40 })).wallet).toMatchObject({ jeton: 200, bagislanamaz: 200 });
  });

  it('kampta önce hediye jetonu harcanır; sıradan çıkarılan bedel yine hediye jetonu olarak döner (bağışa aklanmaz)', async () => {
    const { e, b } = await kur();
    const cost = (id: Parameters<typeof buildCost>[0]) => buildCost(id, 1).jeton;
    expect(cost('laboratuvar') + cost('depo')).toBeLessThanOrEqual(200);
    // ilk inşaat hediye jetonundan
    const up = await b.call('camp.upgrade', { id: 'laboratuvar' });
    expect(up.wallet).toMatchObject({ jeton: 300 - cost('laboratuvar'), bagislanamaz: 200 - cost('laboratuvar') });
    // sıraya alınan inşaat da hediye jetonundan; sıradan çıkınca aynı ayrımla geri gelir
    const q = await b.call('camp.queue', { id: 'depo' });
    expect(q.started).toBe(false);
    expect(q.wallet.bagislanamaz ?? 0).toBe(200 - cost('laboratuvar') - cost('depo'));
    const un = await b.call('camp.unqueue', {});
    expect(un.wallet).toMatchObject({ jeton: 300 - cost('laboratuvar'), bagislanamaz: 200 - cost('laboratuvar') });
    // bağışlanabilir kısım hiç değişmedi: yalnız başlangıçtaki 100
    expect((await err(b.call('team.donate', { tech: 'savas', jeton: 101 }))).code).toBe('HEDIYE_JETONU');
    expect((await b.call('team.donate', { tech: 'savas', jeton: 100 })).wallet.jeton).toBe(200 - cost('laboratuvar'));
    // hediye jetonu bitince alan cüzdanda görünmez
    e.srv.app.spend(b.me!.id, 'jeton', 200 - cost('laboratuvar'));
    expect(e.srv.app.wallet(b.me!.id)).toEqual({ jeton: 0, kristal: 100, hizlandirici: { m5: 0, m60: 0, s8: 0 } });
  });
});
