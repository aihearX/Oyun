// Cüzdan outbox'ı (MK-035): sahte istemciyle. Sunucu modeli ledgerId ile tek yazar (apps/server/src/wallet.ts gibi).
// Her durumda: outbox ≤ 2 sn'de boşalır, aynı ledgerId sunucuda iki kez yazılmaz, ödül sessizce düşmez.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetError, type NetStatus } from '@odi/net';
import type { Wallet } from '@odi/shared';
import { createOutbox, reconcileCoins, type OutItem } from './outbox';

type Res = Record<string, unknown>;
/** sahte istemci + sunucu: `next` ile sıradaki isteğin davranışı (ret, tutulan yanıt) verilir; yoksa sunucu hemen yanıtlar */
function fake(start: OutItem[]) {
  const srv = { jeton: 100, writes: new Map<string, number>(), calls: [] as string[] };
  const wallet = (): Wallet => ({ jeton: srv.jeton, kristal: 0, hizlandirici: { m5: 0, m60: 0, s8: 0 } });
  const handle = (op: string, data: { ledgerId?: string; jeton: number }): Res => {
    if (op !== 'wallet.local') { srv.jeton -= data.jeton; return { wallet: wallet(), skills: [] }; }
    const id = data.ledgerId!;
    // ledgerId ile tek: ilk istek yazar (writes 1), aynı kimlikle gelen sonraki istek önceki sonucu döner
    if (!srv.writes.has(id)) { srv.writes.set(id, 1); srv.jeton += data.jeton; }
    return { wallet: wallet(), credited: data.jeton, dailyLeft: 1000 };
  };
  const ctl = { status: 'bağlı' as NetStatus, next: [] as ((op: string, data: never) => Promise<Res>)[] };
  const client = {
    get status() { return ctl.status; },
    call: ((op: string, data: never) => {
      srv.calls.push(op === 'wallet.local' ? (data as { ledgerId: string }).ledgerId : op);
      const f = ctl.next.shift();
      return f ? f(op, data) : Promise.resolve(handle(op, data));
    }) as never,
  };
  let items = [...start];
  const seen: Wallet[] = [];
  const ob = createOutbox({ client: () => client, items: () => items, save: (x) => { items = x; }, onWallet: (w) => seen.push(w) });
  /** sunucu isteği işler (yazar) ama yanıt tutulur; dönen fonksiyon bekleyen çağrıyı verilen kodla düşürür */
  const holdAfterWrite = () => {
    let fail: (code: string) => void = () => undefined;
    ctl.next.push((op, data) => { handle(op, data); return new Promise((_, rej) => { fail = (code) => rej(new NetError(code, code)); }); });
    return (code: string) => fail(code);
  };
  const reject = (code: string) => ctl.next.push(() => Promise.reject(new NetError(code, code)));
  return { srv, ctl, ob, seen, holdAfterWrite, reject, items: () => items };
}
const local = (ledgerId: string, jeton: number): OutItem => ({ k: 'local', ledgerId, jeton, reason: 'gorev:test' });

describe('cüzdan outbox (MK-035)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('bekleyen çağrı varken bağlantı kopar ve geri gelir (tetik tur sürerken gelir): ≤ 2 sn boşalır, tek yazılır', async () => {
    const f = fake([local('a', 30), local('b', 15)]);
    const failPending = f.holdAfterWrite();
    void f.ob.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.srv.writes.get('a')).toBe(1); // sunucu yazdı, yanıt gelmedi
    // bağlantı koptu ve hemen geri geldi; bağlanınca gelen tetik eski çağrı düşmeden önce gelir
    f.ctl.status = 'çevrimdışı';
    f.ctl.status = 'bağlı';
    void f.ob.flush();
    failPending('KOPTU');
    await vi.advanceTimersByTimeAsync(2000);
    expect(f.items()).toEqual([]);
    expect(f.srv.writes.get('a')).toBe(1);
    expect(f.srv.writes.get('b')).toBe(1);
    expect(f.srv.calls.filter((x) => x === 'a')).toHaveLength(2); // aynı ledgerId ile yeniden gitti
    expect(f.srv.jeton).toBe(145);
    expect(f.ob.stats().reruns).toBe(1);
  });

  it('bekleyen çağrı bağlantı koparken düşer, bağlanınca tetik gelir: ≤ 2 sn boşalır, tek yazılır', async () => {
    const f = fake([local('a', 30)]);
    const failPending = f.holdAfterWrite();
    void f.ob.flush();
    await vi.advanceTimersByTimeAsync(0);
    f.ctl.status = 'çevrimdışı';
    failPending('KOPTU');
    await vi.advanceTimersByTimeAsync(500);
    expect(f.items()).toHaveLength(1); // kopukken bekler
    f.ctl.status = 'bağlı';
    void f.ob.flush();
    await vi.advanceTimersByTimeAsync(2000);
    expect(f.items()).toEqual([]);
    expect(f.srv.writes.get('a')).toBe(1);
    expect(f.srv.jeton).toBe(130);
  });

  it('HIZ sonra başarı: ≤ 2 sn boşalır, tek yazılır', async () => {
    const f = fake([local('a', 20), local('b', 10)]);
    f.reject('HIZ');
    void f.ob.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.items()).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(f.items()).toEqual([]);
    expect([f.srv.writes.get('a'), f.srv.writes.get('b')]).toEqual([1, 1]);
    expect(f.srv.jeton).toBe(130);
  });

  it('ZAMAN_ASIMI (sunucu yazdı, yanıt gelmedi) sonra başarı: ≤ 2 sn boşalır, tek yazılır', async () => {
    const f = fake([local('a', 20)]);
    const failPending = f.holdAfterWrite();
    void f.ob.flush();
    await vi.advanceTimersByTimeAsync(0);
    failPending('ZAMAN_ASIMI');
    await vi.advanceTimersByTimeAsync(2000);
    expect(f.items()).toEqual([]);
    expect(f.srv.writes.get('a')).toBe(1);
    expect(f.srv.calls).toEqual(['a', 'a']);
  });

  it('SUNUCU hatası ödülü düşürmez: yeniden dener, ≤ 2 sn boşalır', async () => {
    const f = fake([local('a', 20)]);
    f.reject('SUNUCU');
    void f.ob.flush();
    await vi.advanceTimersByTimeAsync(2000);
    expect(f.items()).toEqual([]);
    expect(f.srv.writes.get('a')).toBe(1);
    expect(f.ob.stats().dropped).toBe(0);
  });

  it('kalıcı ret (ör. GECERSIZ) kaydı atar, kuyruk takılmaz', async () => {
    const f = fake([local('a', 20), local('b', 5)]);
    f.reject('GECERSIZ');
    void f.ob.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.items()).toEqual([]);
    expect(f.srv.writes.has('a')).toBe(false);
    expect(f.srv.writes.get('b')).toBe(1);
  });

  it('tur sürerken eklenen kayıt aynı turda gider; yanıttaki cüzdan uygulanır', async () => {
    const f = fake([local('a', 20)]);
    const p = f.ob.flush();
    // ödül tur sürerken eklenir (setOutbox → flush)
    const items = f.items(); items.push(local('b', 5));
    void f.ob.flush();
    await p; await vi.advanceTimersByTimeAsync(0);
    expect(f.items()).toEqual([]);
    expect(f.seen.at(-1)?.jeton).toBe(125);
  });

  it('busy(): çağrı yanıt beklerken true, yanıt ya da ret gelince false', async () => {
    const f = fake([local('a', 20)]);
    const failPending = f.holdAfterWrite();
    void f.ob.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.ob.busy()).toBe(true);
    failPending('HIZ');
    await vi.advanceTimersByTimeAsync(0);
    expect(f.ob.busy()).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(f.ob.busy()).toBe(false);
    expect(f.items()).toEqual([]);
  });

  it('kopukken tetik bir şey yapmaz; çağrı yapılmaz', async () => {
    const f = fake([local('a', 20)]);
    f.ctl.status = 'çevrimdışı';
    await f.ob.flush();
    expect(f.srv.calls).toEqual([]);
    expect(f.items()).toHaveLength(1);
  });
});

describe('cüzdan uzlaşması', () => {
  it('üst çubuk = sunucu + bekleyen ise değişmez; değilse sunucu kazanır', () => {
    expect(reconcileCoins({ shown: 130, server: 100, pending: 30 })).toEqual({ coins: 130, diff: 0 });
    expect(reconcileCoins({ shown: 160, server: 100, pending: 30 })).toEqual({ coins: 130, diff: 30 });
    expect(reconcileCoins({ shown: 75, server: 100, pending: 0 })).toEqual({ coins: 100, diff: -25 });
    expect(reconcileCoins({ shown: 0, server: 10, pending: -40 })).toEqual({ coins: 0, diff: 0 });
  });
});
