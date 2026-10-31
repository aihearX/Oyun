import { afterEach, describe, expect, it } from 'vitest';
import type { NetError } from '@odi/net';
import { PASS_DAILY_KRISTAL, PASS_DAYS, PASS_TOTAL_KRISTAL, SPEND_LIMIT_SUGGESTED_TRY } from '@odi/shared';
import { teamGiftFor } from '../src/shop';
import { setup, type Env, type TC } from './helpers';

let env: Env;
afterEach(async () => { await env?.close(); });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };
/** ilk satın almadan önce aylık sınır seçimi (karar 28) */
const sinirSec = (c: TC, limitTry = 1000) => c.call('shop.limit', { limitTry });
const HOUR = 3600_000; const DAY = 24 * HOUR;

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
    await sinirSec(a);
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
    await sinirSec(solo);
    expect((await solo.call('shop.purchase', { productId: 'odi.kristal.2', store: 'test' })).teamGiftSent).toBe(false);
  });

  it('aylık harcama sınırı (karar 28): ilk alımdan önce oyuncu seçer, önerilen 100 TL; seçmeden satın alma yok', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    const sp0 = (await a.call('shop.list', {})).spend;
    expect(sp0).toMatchObject({ limitChosen: false, limitTry: SPEND_LIMIT_SUGGESTED_TRY, pendingLimitTry: null });
    expect(SPEND_LIMIT_SUGGESTED_TRY).toBe(100);
    const e = await err(a.call('shop.purchase', { productId: 'odi.kristal.1', store: 'test' }));
    expect(e.code).toBe('SINIR_SEC');
    expect((await a.call('wallet.get', {})).wallet.kristal).toBe(0);
    // ilk seçim hangi değer olursa olsun hemen geçerli (yükseltme sayılmaz, onay ve bekleme yok)
    const sp1 = (await a.call('shop.limit', { limitTry: 250 })).spend;
    expect(sp1).toMatchObject({ limitChosen: true, limitTry: 250, pendingLimitTry: null });
    await a.call('shop.purchase', { productId: 'odi.kristal.1', store: 'test' });
    // önerilen değeri seçen
    const b = await env.connect('Bora');
    expect((await b.call('shop.limit', { limitTry: SPEND_LIMIT_SUGGESTED_TRY })).spend).toMatchObject({ limitChosen: true, limitTry: 100 });
    await b.call('shop.purchase', { productId: 'odi.pass', store: 'test' }); // 99.99
    expect((await err(b.call('shop.purchase', { productId: 'odi.kristal.1', store: 'test' }))).code).toBe('HARCAMA_SINIRI');
    // "Kapalı" (0) seçen hiç satın alamaz
    const c = await env.connect('Cem');
    await c.call('shop.limit', { limitTry: 0 });
    expect((await err(c.call('shop.purchase', { productId: 'odi.kristal.1', store: 'test' }))).code).toBe('HARCAMA_SINIRI');
  });

  it('aylık harcama sınırı: düşürme hemen; yükseltme ayrı onay ister ve 24 saat sonra geçerli', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    await sinirSec(a, 1000);
    expect((await a.call('shop.list', {})).spend.limitTry).toBe(1000);
    expect((await a.call('shop.limit', { limitTry: 200 })).spend.limitTry).toBe(200);
    await a.call('shop.purchase', { productId: 'odi.kristal.2', store: 'test' }); // 149.99
    expect((await err(a.call('shop.purchase', { productId: 'odi.kristal.2', store: 'test' }))).code).toBe('HARCAMA_SINIRI');
    await a.call('shop.purchase', { productId: 'odi.kristal.1', store: 'test' }); // 29.99 → 179.98
    // onaysız yükseltme reddedilir, sınır değişmez
    expect((await err(a.call('shop.limit', { limitTry: 1000 }))).code).toBe('ONAY');
    expect((await a.call('shop.list', {})).spend).toMatchObject({ limitTry: 200, pendingLimitTry: null });
    expect((await a.call('shop.limit', { limitTry: 1000, confirmRaise: true })).spend.limitTry).toBe(200);
    env.clock.advance(24 * 3600_000);
    expect((await a.call('shop.list', {})).spend.limitTry).toBe(1000);
    await a.call('shop.purchase', { productId: 'odi.kristal.2', store: 'test' });
    expect((await a.call('wallet.get', {})).wallet.kristal).toBe(650 + 120 + 650);
  });

  it('gerçek mağaza makbuzu anahtarsız reddedilir; test mağazası kapalıysa reddedilir', async () => {
    env = await setup({ testStore: false, revenueCatKey: null });
    const a = await env.connect('Ayşe');
    await sinirSec(a);
    const e = await err(a.call('shop.purchase', { productId: 'odi.kristal.1', store: 'app-store', receipt: 'abc' }));
    expect(e.code).toBe('MAKBUZ');
    expect(e.message).toContain('REVENUECAT_API_KEY');
    expect((await err(a.call('shop.purchase', { productId: 'odi.kristal.1', store: 'play', receipt: 'abc' }))).code).toBe('MAKBUZ');
    expect((await err(a.call('shop.purchase', { productId: 'odi.kristal.1', store: 'test' }))).code).toBe('TEST_KAPALI');
    expect((await a.call('shop.list', {})).testStore).toBe(false);
    expect((await a.call('wallet.get', {})).wallet.kristal).toBe(0);
  });

  /** ödül kutusundaki Sezon Kartı kristallerini alır; alınan toplam */
  const passAl = async (c: TC) => {
    let n = 0;
    for (const it of (await c.call('inbox.list', {})).items.filter((x) => x.ref === 'odi.pass')) { await c.call('inbox.claim', { id: it.id }); n += it.amount; }
    return n;
  };
  const yenidenGir = async (c: TC) => { c.close(); return env.connect(undefined, c.token); };

  it('sezon kartı (karar 30): satın alınan gün 1. gün, her gün 30 kristal; aynı gün ikinci kez yok', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    await sinirSec(a);
    await a.call('shop.purchase', { productId: 'odi.pass', store: 'test' });
    const items = (await a.call('inbox.list', {})).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'kristal', amount: PASS_DAILY_KRISTAL, ref: 'odi.pass' });
    expect((await a.call('inbox.list', {})).items).toHaveLength(1); // aynı gün ikinci kez yok
    expect((await a.call('inbox.claim', { id: items[0]!.id })).wallet.kristal).toBe(30);
    env.clock.advance(DAY);
    const again = await yenidenGir(a);
    expect(await passAl(again)).toBe(30);
    expect(await passAl(again)).toBe(0);
  });

  it('sezon kartı: girilmeyen günlerin kristali birikir (1. ve 10. gün girişi → 10. günde 300)', async () => {
    env = await setup();
    let a = await env.connect('Ayşe');
    await sinirSec(a);
    await a.call('shop.purchase', { productId: 'odi.pass', store: 'test' }); // 1. gün
    expect(await passAl(a)).toBe(30);
    env.clock.advance(9 * DAY); // 10. gün
    a = await yenidenGir(a);
    const items = (await a.call('inbox.list', {})).items.filter((x) => x.ref === 'odi.pass');
    expect(items).toHaveLength(1); // birikmiş günler tek satırda
    expect(items[0]!.amount).toBe(9 * 30);
    expect(items[0]!.reason).toContain('9 gün');
    expect(30 + (await passAl(a))).toBe(300);
  });

  it('sezon kartı: toplam hiçbir zaman 840ı aşmaz; 28. günden sonra (29. gün sabahı dahil) hiçbir şey gelmez', async () => {
    env = await setup();
    // her gün giren oyuncu: tam 840, 29. günün sabahı ek ödeme yok
    let a = await env.connect('Ayşe');
    await sinirSec(a);
    env.clock.advance(11 * HOUR); // satın alma akşamı (T0 12:00 → 23:00 İstanbul): satın alınan gün kısa da olsa 1. gün sayılır
    await a.call('shop.purchase', { productId: 'odi.pass', store: 'test' });
    let toplam = await passAl(a);
    for (let gun = 2; gun <= PASS_DAYS + 3; gun++) {
      env.clock.advance(DAY);
      a = await yenidenGir(a);
      toplam += await passAl(a);
      expect(toplam).toBeLessThanOrEqual(PASS_TOTAL_KRISTAL);
      if (gun === PASS_DAYS) expect(toplam).toBe(PASS_TOTAL_KRISTAL);
    }
    expect(PASS_TOTAL_KRISTAL).toBe(840);
    expect(toplam).toBe(840);
    // aradaki girişleri seyrek: yine tam 840, sonrasında 0
    let b = await env.connect('Bora');
    await sinirSec(b);
    await b.call('shop.purchase', { productId: 'odi.pass', store: 'test' });
    let tb = await passAl(b);
    for (const ileri of [3, 7, 11, 6, 30, 40]) {
      env.clock.advance(ileri * DAY);
      b = await yenidenGir(b);
      tb += await passAl(b);
      expect(tb).toBeLessThanOrEqual(840);
    }
    expect(tb).toBe(840);
    // hiç girmeyen (yalnız 40 gün sonra): 28 günün hepsi bir kez, fazlası yok
    let c = await env.connect('Cem');
    await sinirSec(c);
    await c.call('shop.purchase', { productId: 'odi.pass', store: 'test' });
    let tc = await passAl(c);
    env.clock.advance(40 * DAY);
    c = await yenidenGir(c);
    tc += await passAl(c);
    expect(tc).toBe(840);
    env.clock.advance(DAY);
    c = await yenidenGir(c);
    expect(await passAl(c)).toBe(0);
  });
});
