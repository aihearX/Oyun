import { afterEach, describe, expect, it } from 'vitest';
import type { NetError } from '@odi/net';
import { teamGiftFor } from '../src/shop';
import { setup, type Env } from './helpers';

let env: Env;
afterEach(async () => { await env?.close(); });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };

describe('mağaza', () => {
  it('test mağazası: içerik cüzdana, takım hediyesi diğer üyede, ürün sınırı', async () => {
    env = await setup();
    const [a, b, c] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem')];
    const t = (await a.call('team.create', { name: 'Hediyeciler', emblem: '🎯' })).team;
    await b.call('team.join', { teamId: t.id });
    await c.call('team.join', { teamId: t.id });
    const list = await a.call('shop.list', {});
    expect(list.testStore).toBe(true);
    expect(list.products.find((p) => p.id === 'odi.baslangic')!.bought).toBe(0);
    const r = await a.call('shop.purchase', { productId: 'odi.baslangic', store: 'test' });
    expect(r.wallet).toMatchObject({ jeton: 100, kristal: 300, hizlandirici: { m5: 10, m60: 0, s8: 0 } });
    expect(r.teamGiftSent).toBe(true);
    expect(r.spend.monthTry).toBeCloseTo(49.99);
    expect(r.spend.purchases[0]).toMatchObject({ productId: 'odi.baslangic', store: 'test', amountTry: 49.99 });
    expect(JSON.parse(env.srv.app.player(a.me!.id).cosmetics)).toEqual(['sapka-kasif']);
    // hediye: diğer üyelere düşer, alana düşmez; içerik sabit ve önceden belli
    const g = await b.waitFor('team.gift');
    expect(g.gift.contents).toEqual(teamGiftFor(49.99));
    expect(g.gift.fromName).toBe('Ayşe');
    expect(g.gift.expiresAt - g.gift.at).toBe(24 * 3600_000);
    expect((await b.waitFor('chat', (x) => x.msg.text.includes('hediye'))).msg.from).toBe('sistem');
    const extraA = (await a.call('team.extra', {})).extra;
    expect(extraA.gifts).toHaveLength(0);
    const extraB = (await b.call('team.extra', {})).extra;
    expect(extraB.gifts.map((x) => x.id)).toEqual([g.gift.id]);
    const claimed = await b.call('team.gift.claim', { giftId: g.gift.id });
    expect(claimed.wallet).toMatchObject({ jeton: 150, kristal: 20 });
    expect(claimed.extra.gifts[0]!.claimed).toBe(true);
    expect((await err(b.call('team.gift.claim', { giftId: g.gift.id }))).code).toBe('TEKRAR');
    // süresi dolan hediye alınamaz
    env.clock.advance(25 * 3600_000);
    expect((await err(c.call('team.gift.claim', { giftId: g.gift.id }))).code).toBe('SURE');
    // ürün sınırı (limit 1)
    expect((await err(a.call('shop.purchase', { productId: 'odi.baslangic', store: 'test' }))).code).toBe('LIMIT');
    expect((await a.call('shop.list', {})).products.find((p) => p.id === 'odi.baslangic')!.bought).toBe(1);
    // takımı olmayan → hediye gönderilmez
    const solo = await env.connect('Yalnız');
    expect((await solo.call('shop.purchase', { productId: 'odi.kristal.2', store: 'test' })).teamGiftSent).toBe(false);
  });

  it('aylık harcama sınırı: düşürme hemen, yükseltme 24 saat sonra', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    expect((await a.call('shop.list', {})).spend.limitTry).toBe(1000);
    expect((await a.call('shop.limit', { limitTry: 200 })).spend.limitTry).toBe(200);
    await a.call('shop.purchase', { productId: 'odi.kristal.2', store: 'test' }); // 149.99
    expect((await err(a.call('shop.purchase', { productId: 'odi.kristal.2', store: 'test' }))).code).toBe('HARCAMA_SINIRI');
    await a.call('shop.purchase', { productId: 'odi.kristal.1', store: 'test' }); // 29.99 → 179.98
    expect((await a.call('shop.limit', { limitTry: 1000 })).spend.limitTry).toBe(200);
    env.clock.advance(24 * 3600_000);
    expect((await a.call('shop.list', {})).spend.limitTry).toBe(1000);
    await a.call('shop.purchase', { productId: 'odi.kristal.2', store: 'test' });
    expect((await a.call('wallet.get', {})).wallet.kristal).toBe(650 + 120 + 650);
  });

  it('gerçek mağaza makbuzu anahtarsız reddedilir; test mağazası kapalıysa reddedilir', async () => {
    env = await setup({ testStore: false, revenueCatKey: null });
    const a = await env.connect('Ayşe');
    const e = await err(a.call('shop.purchase', { productId: 'odi.kristal.1', store: 'app-store', receipt: 'abc' }));
    expect(e.code).toBe('MAKBUZ');
    expect(e.message).toContain('REVENUECAT_API_KEY');
    expect((await err(a.call('shop.purchase', { productId: 'odi.kristal.1', store: 'play', receipt: 'abc' }))).code).toBe('MAKBUZ');
    expect((await err(a.call('shop.purchase', { productId: 'odi.kristal.1', store: 'test' }))).code).toBe('TEST_KAPALI');
    expect((await a.call('shop.list', {})).testStore).toBe(false);
    expect((await a.call('wallet.get', {})).wallet.kristal).toBe(0);
  });

  it('sezon kartı: her gün ilk girişte 30 kristal ödül kutusuna, 28 gün', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    await a.call('shop.purchase', { productId: 'odi.pass', store: 'test' });
    let items = (await a.call('inbox.list', {})).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'kristal', amount: 30 });
    expect((await a.call('inbox.list', {})).items).toHaveLength(1); // aynı gün ikinci kez yok
    const cl = await a.call('inbox.claim', { id: items[0]!.id });
    expect(cl.wallet.kristal).toBe(30);
    env.clock.advance(24 * 3600_000);
    a.close();
    const again = await env.connect(undefined, a.token);
    items = (await again.call('inbox.list', {})).items;
    expect(items).toHaveLength(1);
    env.clock.advance(30 * 24 * 3600_000);
    await again.call('inbox.claim', { id: items[0]!.id });
    expect((await again.call('inbox.list', {})).items).toHaveLength(0);
  });
});
