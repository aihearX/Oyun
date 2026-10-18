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
