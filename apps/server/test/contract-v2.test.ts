import { afterEach, describe, expect, it } from 'vitest';
import { buildCost, techCost } from '@odi/shared';
import { teamGiftFor } from '../src/shop';
import { SCHEMAS } from '../src/schemas';
import { setup, run, type Env } from './helpers';

let env: Env;
afterEach(async () => { await env?.close(); });

describe('sözleşme v2 eklemeleri', () => {
  it('progress.submit runId ile idempotent: aynı koşu iki kez sayılmaz, aynı yanıt döner', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    const r = run(1, { runId: 'kosu-123', coins: 50 });
    const first = await a.call('progress.submit', r);
    const again = await a.call('progress.submit', r);
    expect(again).toEqual(first);
    expect((await a.call('wallet.get', {})).wallet.jeton).toBe(150);
    expect((await a.call('league.state', {})).league.points).toBe(first.leaguePoints);
    // başka oyuncu aynı runId'yi kullanabilir
    const b = await env.connect('Bora');
    expect((await b.call('progress.submit', r)).jeton).toBe(50);
    // runId vermeden kısayol: istemci üretir
    const s = await a.submitProgress({ level: 2, completed: true, stars: 1, score: 10, timeSec: 30, coins: 0, biome: 'kanal', mechanic: 'kosu' });
    expect(s.highest).toBe(3);
    // runId sunucuda zorunlu (istemci boşsa kendisi üretir)
    expect(SCHEMAS['progress.submit'].safeParse({ ...r, runId: undefined }).success).toBe(false);
    expect(SCHEMAS['progress.submit'].safeParse({ ...r, runId: '' }).success).toBe(false);
  });

  it('MyProfile: kalkan, kozmetik, kart alanları', async () => {
    env = await setup();
    const [a, b] = [await env.connect('Ayşe'), await env.connect('Bora')];
    expect(a.me).toMatchObject({ shields: 0, cosmetics: [], cards: [] });
    const t = (await a.call('team.create', { name: 'Profil Takımı', emblem: '☀️' })).team;
    await b.call('team.join', { teamId: t.id });
    const req = (await a.call('team.help.request', { level: 1 })).request;
    expect(req.expiresAt).toBe(req.at + 24 * 3600_000);
    await b.call('team.help.give', { requestId: req.id });
    const item = (await a.call('inbox.list', {})).items[0]!;
    await a.call('inbox.claim', { id: item.id });
    await a.call('shop.limit', { limitTry: 100 });
    await a.call('shop.purchase', { productId: 'odi.baslangic', store: 'test' });
    const me = (await a.call('profile.update', {})).me;
    expect(me).toMatchObject({ shields: 1, cosmetics: ['sapka-kasif'], cards: [] });
    expect(a.me!.shields).toBe(1);
    a.close();
    const again = await env.connect(undefined, a.token);
    expect(again.me).toMatchObject({ shields: 1, cosmetics: ['sapka-kasif'] });
  });

  it('me.bonuses: kamp + takım teknolojisi toplamı', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    expect(await a.call('me.bonuses', {})).toEqual({ coinPct: 0, shieldChancePct: 0, firstHitIgnorePct: 0, warPct: 0, raidPct: 0 });
    await a.call('team.create', { name: 'Bonus Takımı', emblem: '🎯' });
    await a.call('camp.upgrade', { id: 'atolye' });
    env.clock.advance(buildCost('atolye', 1).seconds * 1000);
    for (let l = 1; l <= 2; l++) await a.call('progress.submit', run(l, { coins: 400 }));
    await a.call('team.donate', { tech: 'kalkan', jeton: techCost(0) });
    expect(await a.call('me.bonuses', {})).toEqual({ coinPct: 0, shieldChancePct: 8, firstHitIgnorePct: 0, warPct: 0, raidPct: 0 });
  });

  it('SpendState bekleyen yükseltme, ShopProduct.teamGiftContents', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    const list = await a.call('shop.list', {});
    expect(list.spend).toMatchObject({ pendingLimitTry: null, pendingLimitAt: null, limitChosen: false });
    for (const p of list.products) {
      if (p.teamGift) expect(p.teamGiftContents).toEqual(teamGiftFor(p.priceTry));
      else expect(p.teamGiftContents).toBeUndefined();
    }
    await a.call('shop.limit', { limitTry: 100 });
    const up = (await a.call('shop.limit', { limitTry: 500, confirmRaise: true })).spend;
    expect(up).toMatchObject({ limitTry: 100, pendingLimitTry: 500, pendingLimitAt: env.clock.t + 24 * 3600_000 });
    env.clock.advance(24 * 3600_000);
    expect((await a.call('shop.list', {})).spend).toMatchObject({ limitTry: 500, pendingLimitTry: null, pendingLimitAt: null });
  });
});
