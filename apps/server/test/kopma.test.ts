// MK-019: sunucu oturum ortasında yeniden başlarken tekrar korumalı işlemler ve istemcinin kendiliğinden bağlanması
// (uçtan uca tarayıcı testi: tools/harness/kopma-e2e.mjs)
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createClient, type NetClient } from '@odi/net';
import { startServer, type OdiServer } from '../src/server';
import { setup, sleep, waitStatus, type Env } from './helpers';

let env: Env | null = null;
let srv: OdiServer | null = null;
const clients: NetClient[] = [];
afterEach(async () => { for (const c of clients.splice(0)) c.close(); await srv?.close(); srv = null; await env?.close(); env = null; });

describe('chat.send tekrar koruması (cid)', () => {
  it('aynı cid ile yeniden gönderilen ileti bir kez yazılır ve yayınlanır; ilk ileti döner', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora');
    const { team } = await a.call('team.create', { name: 'Kopma', emblem: '🐚' });
    await b.call('team.join', { teamId: team.id });
    const room = `takim:${team.id}`;
    b.drain();
    const first = await a.call('chat.send', { room, text: 'tek kez', cid: 'cid-0001-abc' });
    await b.waitFor('chat', (d) => d.msg.id === first.msg.id);
    // yanıt kaybolmuş gibi: aynı cid ile hemen yeniden (sohbet hız sınırına takılmadan)
    const again = await a.call('chat.send', { room, text: 'tek kez', cid: 'cid-0001-abc' });
    expect(again.msg.id).toBe(first.msg.id);
    await sleep(150);
    expect(b.log.filter((e) => e.ev === 'chat' && (e.data as { msg: { text: string } }).msg.text === 'tek kez')).toHaveLength(1);
    expect(env.srv.app.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM chat WHERE text = 'tek kez'")!.n).toBe(1);
    // farklı cid yeni iletidir (hız sınırı geçince)
    env.clock.advance(5_000);
    await sleep(1300);
    const other = await a.call('chat.send', { room, text: 'tek kez', cid: 'cid-0002-abc' });
    expect(other.msg.id).not.toBe(first.msg.id);
    // geçersiz cid reddedilir
    await expect(a.call('chat.send', { room, text: 'x', cid: 'kısa' })).rejects.toMatchObject({ code: 'GECERSIZ' });
  }, 20_000); // MK-020: CPU 0,08 sn ama sunucu + bağlantılar; yük 30'da duvar 2,3 sn

  it('cid başka oyuncunun ya da başka odanın iletisini döndürmez; hesap silinince cid kayıtları da silinir', async () => {
    env = await setup();
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora');
    const m1 = await a.call('chat.send', { room: 'genel', text: 'genel selam', cid: 'ortak-cid-01' });
    const m2 = await b.call('chat.send', { room: 'genel', text: 'benim selamım', cid: 'ortak-cid-01' });
    expect(m2.msg.id).not.toBe(m1.msg.id);
    expect(m2.msg.from).not.toBe(m1.msg.from);
    await a.call('account.delete', {});
    expect(env.srv.app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM chat_cid WHERE player_id = ?', m1.msg.from)!.n).toBe(0);
  });
});

describe('istemci: sunucu yeniden başlarken', () => {
  it('maxPerSec: bağlanınca giden istek fırtınası sunucunun hız sınırına (30/sn) takılmaz, sıra korunur', { timeout: 20_000 }, async () => {
    srv = await startServer({ port: 0, host: '127.0.0.1', msgPerSec: 30 });
    let token = '';
    const c = createClient({ url: srv.url, name: 'Fırtına', getToken: () => token, saveToken: (t) => { token = t; }, maxPerSec: 20 });
    clients.push(c);
    c.connect();
    await waitStatus(c, 'bağlı');
    const t0 = Date.now();
    const results = await Promise.allSettled(Array.from({ length: 45 }, () => c.call('wallet.get', {})));
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);
    // 20 hemen, kalan 25 saniyede 20 hızla: ~1,2 sn
    expect(Date.now() - t0).toBeGreaterThan(900);
  });

  it('kopukken yapılan istek bağlantıyı offlineWaitMs kadar bekler; retryNow beklemeyi kısaltır; aynı veritabanıyla yeniden açılınca oturum sürer', { timeout: 30_000 }, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'odi-kopma-'));
    const dbFile = join(dir, 'odi.sqlite');
    srv = await startServer({ port: 0, host: '127.0.0.1', dbFile, freeTextCleared: 0 });
    const port = srv.port;
    let token = '';
    const c = createClient({ url: `ws://127.0.0.1:${port}`, name: 'Kopma', getToken: () => token, saveToken: (t) => { token = t; },
      maxBackoffMs: 60_000, timeoutMs: 2_000, offlineWaitMs: 15_000 });
    clients.push(c);
    c.connect();
    await waitStatus(c, 'bağlı');
    const id = c.me!.id;
    await srv.close(); srv = null;
    await waitStatus(c, 'çevrimdışı');
    // timeoutMs (2 sn) geçse de istek bekler: kısa yeniden başlatmada işlem kaybolmaz.
    // 7,5 sn kopuk: denemeler ~0,5 + 1 + 2 + 4 sn; sıradaki deneme ~8 sn sonra olurdu
    const pending = c.call('wallet.get', {});
    await sleep(7_500);
    srv = await startServer({ port, host: '127.0.0.1', dbFile, freeTextCleared: 0 });
    // bekleme süresi uzun (maxBackoffMs 60 sn) olsa da retryNow hemen dener
    c.retryNow();
    await waitStatus(c, 'bağlı', 3_000);
    expect(c.me!.id).toBe(id);
    expect((await pending).wallet.jeton).toBeGreaterThan(0);
    c.close(); await srv.close(); srv = null;
    rmSync(dir, { recursive: true, force: true });
  });
});
