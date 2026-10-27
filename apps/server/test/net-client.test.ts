import { afterEach, describe, expect, it } from 'vitest';
import { createClient, type NetClient, type NetStatus } from '@odi/net';
import type { ProgressSubmit } from '@odi/shared';
import { startServer, type OdiServer } from '../src/server';
import { run, waitStatus } from './helpers';

let srv: OdiServer | null = null;
const clients: NetClient[] = [];
afterEach(async () => { for (const c of clients.splice(0)) c.close(); await srv?.close(); srv = null; });

async function freePort(): Promise<number> {
  const s = await startServer({ port: 0, host: '127.0.0.1' });
  const p = s.port;
  await s.close();
  return p;
}

describe('@odi/net istemcisi', () => {
  it('çevrimdışıyken ilerleme kalıcı kuyruğa alınır; sunucu gelince otomatik bağlanır ve sırayla gönderir', { timeout: 20_000 }, async () => {
    const port = await freePort();
    let token = '';
    let saved: ProgressSubmit[] = [run(1, { coins: 10 })]; // önceki oturumdan kalan kayıt
    const statuses: NetStatus[] = [];
    const c = createClient({
      url: `ws://127.0.0.1:${port}`, name: 'Kuyruk', getToken: () => token, saveToken: (t) => { token = t; },
      getQueue: async () => saved, saveQueue: (q) => { saved = q; }, maxBackoffMs: 200, timeoutMs: 3000,
    });
    clients.push(c);
    c.onStatus((s) => statuses.push(s));
    c.connect();
    await waitStatus(c, 'çevrimdışı');
    const p2 = c.call('progress.submit', run(2, { coins: 20 }));
    const p3 = c.call('progress.submit', run(3, { coins: 30 }));
    await new Promise((r) => setTimeout(r, 20));
    expect(saved).toHaveLength(3);
    expect(c.queued()).toBe(3);
    // diğer istekler bağlantıyı bekler (zaman aşımına kadar)
    const wallet = c.call('wallet.get', {});
    srv = await startServer({ port, host: '127.0.0.1' });
    await waitStatus(c, 'bağlı', 5000);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const [a2, a3] = await Promise.all([p2, p3]);
    expect(a2.highest).toBe(3);
    expect(a3.highest).toBe(4);
    expect(a3.wallet.jeton).toBe(100 + 10 + 20 + 30);
    expect((await wallet).wallet.jeton).toBeGreaterThanOrEqual(100);
    expect(saved).toEqual([]);
    expect(c.queued()).toBe(0);
    expect(statuses).toContain('bağlanıyor');
    // sunucu reddederse kayıt kuyruktan atılır (sonsuza dek takılmaz)
    await expect(c.call('progress.submit', run(30))).rejects.toMatchObject({ code: 'GECERSIZ' });
    expect(c.queued()).toBe(0);
    // sunucu kapanınca çevrimdışı; yeniden açılınca aynı anahtarla aynı hesap
    const id = c.me!.id;
    await srv.close();
    srv = null;
    await waitStatus(c, 'çevrimdışı');
    const p4 = c.call('progress.submit', run(4));
    // aynı veritabanı yok (bellek içi): sunucu anahtarı tanımaz → istemci yeni hesapla devam eder
    srv = await startServer({ port, host: '127.0.0.1' });
    await waitStatus(c, 'bağlı', 5000);
    expect(c.me!.id).not.toBe(id);
    await expect(p4).rejects.toMatchObject({ code: 'GECERSIZ' }); // yeni hesapta 4. bölüm açık değil
  });

  it('bölüm sonu: sunucu olayı yanıttan önce gelirken submitting() true; kayıt kuyruktan düşerken false (MK-036)', { timeout: 10_000 }, async () => {
    srv = await startServer({ port: 0, host: '127.0.0.1' });
    const seen: { ev?: { submitting: boolean; queued: number; jeton: number }; save: { submitting: boolean; n: number }[] } = { save: [] };
    let token = '';
    const c: NetClient = createClient({
      url: `ws://127.0.0.1:${srv.port}`, name: 'Bolum', getToken: () => token, saveToken: (t) => { token = t; },
      getQueue: () => [], saveQueue: (q) => { seen.save.push({ submitting: c.submitting(), n: q.length }); },
    });
    clients.push(c);
    c.on('wallet.updated', ({ wallet }) => { seen.ev ??= { submitting: c.submitting(), queued: c.queued(), jeton: wallet.jeton }; });
    c.connect();
    await waitStatus(c, 'bağlı', 5000);
    expect(c.submitting()).toBe(false);
    const ack = await c.call('progress.submit', run(1, { coins: 20 }));
    // olay geldiğinde cüzdan bölüm jetonunu içeriyor ve kayıt hâlâ kuyrukta: gösterge bu arada güncellenmemeli
    expect(seen.ev).toEqual({ submitting: true, queued: 1, jeton: ack.wallet.jeton });
    // kayıt düşerken (saveQueue) bayrak kapalı: gösterge yanıtla birlikte doğru değere geçer
    expect(seen.save.at(-1)).toEqual({ submitting: false, n: 0 });
    expect(c.submitting()).toBe(false);
  });

  it('yanıt kaybolur: submitting() zaman aşımı, kopma ve yeniden bağlanma boyunca yanıt gelene dek true; HIZ sonrası false (MK-038)', { timeout: 10_000 }, async () => {
    // sahte WebSocket: sunucu davranışı testte yazılır (yanıt yutulur, bağlantı koparılır)
    type Msg = { t: string; id: number; op: string; data: { runId?: string } };
    const socks: FakeWS[] = [];
    let onSubmit: (ws: FakeWS, m: Msg) => void = () => undefined;
    class FakeWS {
      readyState = 0;
      onopen: (() => void) | null = null; onmessage: ((e: { data: string }) => void) | null = null;
      onclose: (() => void) | null = null; onerror: (() => void) | null = null;
      constructor() { socks.push(this); setTimeout(() => { this.readyState = 1; this.onopen?.(); }, 0); }
      send(raw: string) {
        const m = JSON.parse(raw) as Msg;
        if (m.op === 'hello') this.res(m.id, { serverTime: Date.now(), me: { id: 'p1', name: 'Kayip', token: 'tok' } });
        else if (m.op === 'progress.submit') onSubmit(this, m);
      }
      close() { if (this.readyState === 3) return; this.readyState = 3; setTimeout(() => this.onclose?.(), 0); }
      res(id: number, data: unknown, code?: string) { this.onmessage?.({ data: JSON.stringify(code ? { t: 'res', id, ok: false, code, error: code } : { t: 'res', id, ok: true, data }) }); }
      evt(ev: string, data: unknown) { this.onmessage?.({ data: JSON.stringify({ t: 'evt', ev, data }) }); }
    }
    const wallet = (jeton: number) => ({ jeton, kristal: 0, hizlandirici: { m5: 0, m60: 0, s8: 0 } });
    const ack = (jeton: number) => ({ highest: 2, stars: 3, warPoints: 0, raidDamage: 0, leaguePoints: 0, newInbox: 0, jeton, wallet: wallet(100 + jeton) });
    const log: string[] = [];
    const c: NetClient = createClient({
      url: 'ws://sahte', getToken: () => null, saveToken: () => {}, WebSocketImpl: FakeWS as unknown as typeof WebSocket,
      timeoutMs: 150, maxBackoffMs: 30,
      getQueue: () => [], saveQueue: (q) => { log.push(`kuyruk ${q.length} ${c.submitting()}`); },
      onSubmitAck: (_, a) => { log.push(`yanıt ${a.jeton} ${c.queued()}`); },
    });
    clients.push(c);
    c.onStatus((st) => { if (st === 'bağlı') log.push(`bağlı ${c.submitting()}`); });
    c.connect();
    await waitStatus(c, 'bağlı', 2000);
    log.length = 0;
    // 1) sunucu yazar, olayı yollar, yanıt kaybolur; sonra ağ kopar
    onSubmit = (ws, m) => { ws.evt('wallet.updated', { wallet: wallet(120) }); log.push('olay'); void m; };
    const p = c.call('progress.submit', run(1, { coins: 20 }));
    await new Promise((r) => setTimeout(r, 20));
    expect(c.submitting()).toBe(true);
    let resent = 0;
    onSubmit = (ws, m) => { resent++; ws.res(m.id, ack(21)); }; // yeniden gönderim: kayıtlı yanıt
    socks.at(-1)!.close();
    await waitStatus(c, 'çevrimdışı', 2000);
    expect(c.submitting()).toBe(true); // sunucu yazmış olabilir: yanıt gelene dek
    await expect(p).resolves.toMatchObject({ jeton: 21 });
    expect(resent).toBe(1);
    // bağlanınca (durum bildirimi, yenileme cüzdanı) kayıt hâlâ yanıtsız sayılır; yanıt kayıt düşmeden önce bildirilir
    expect(log).toEqual(['kuyruk 1 false', 'olay', 'bağlı true', 'yanıt 21 1', 'kuyruk 0 false']);
    expect(c.submitting()).toBe(false);
    // 2) bağlantı açık, yanıt gelmez: zaman aşımından sonra da (yeniden denemeye dek) true
    log.length = 0;
    onSubmit = () => undefined;
    const p2 = c.call('progress.submit', run(2, { coins: 20 }));
    await new Promise((r) => setTimeout(r, 300));
    expect(c.submitting()).toBe(true);
    onSubmit = (ws, m) => ws.res(m.id, ack(22));
    await expect(p2).resolves.toMatchObject({ jeton: 22 });
    expect(c.submitting()).toBe(false);
    // 3) sunucu işlemeden reddetti (HIZ): yanıtsız kayıt yok
    onSubmit = (ws, m) => ws.res(m.id, null, 'HIZ');
    const p3 = c.call('progress.submit', run(3, { coins: 20 }));
    await new Promise((r) => setTimeout(r, 20));
    expect(c.queued()).toBe(1);
    expect(c.submitting()).toBe(false);
    onSubmit = (ws, m) => ws.res(m.id, ack(23));
    await expect(p3).resolves.toMatchObject({ jeton: 23 });
  });

  it('zaman aşımı ve kapalı istemci hataları Türkçe', async () => {
    const c = createClient({ url: 'ws://127.0.0.1:1', getToken: () => null, saveToken: () => {}, timeoutMs: 100, maxBackoffMs: 100 });
    clients.push(c);
    await expect(c.call('wallet.get', {})).rejects.toMatchObject({ code: 'KAPALI', message: 'Bağlantı kapalı.' });
    c.connect();
    await expect(c.call('wallet.get', {})).rejects.toMatchObject({ code: 'CEVRIMDISI' });
    c.close();
    expect(c.status).toBe('kapalı');
  });
});
