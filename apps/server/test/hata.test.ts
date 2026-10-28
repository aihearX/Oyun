import { afterEach, describe, expect, it } from 'vitest';
import { CRASH_LIMITS, type CrashReport } from '@odi/shared';
import { startServer, type OdiServer } from '../src/server';
import { crashRateEntries, pruneCrashes } from '../src/hata';
import { Clock } from './helpers';

const DAY = 86_400_000;
let srv: OdiServer | null = null;
afterEach(async () => { await srv?.close(); srv = null; });

async function sunucu(clock = new Clock()) {
  srv = await startServer({ port: 0, host: '127.0.0.1', now: clock.now, trustProxy: 1 });
  return { srv, clock };
}
const rapor = (clock: Clock, o: Partial<CrashReport> & Record<string, unknown> = {}): Record<string, unknown> => ({
  v: 1, kind: 'TypeError', message: 'Cannot read properties of undefined (reading \'x\')', stack: ['render@index-B1x.js:1:200', 'index-B1x.js:1:900'],
  app: '0.1.0', build: 'abc123', platform: 'web', os: 'android 14', screen: 'map', at: Math.floor(clock.t / 60_000) * 60_000, ...o,
});
const gonder = (s: OdiServer, body: unknown, ip = '203.0.113.7', ham = false) =>
  fetch(`${s.httpUrl}/hata`, { method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8', 'x-forwarded-for': ip }, body: ham ? String(body) : JSON.stringify(body) });
const satirlar = (s: OdiServer) => s.app.db.all<Record<string, unknown>>('SELECT * FROM crash_reports');

describe('çökme raporu ucu (POST /hata)', () => {
  it('geçerli rapor kaydedilir; aynı imza sayaçta toplanır; özet yalnız toplam verir; IP hiçbir yere yazılmaz', async () => {
    const { srv: s, clock } = await sunucu();
    expect((await gonder(s, rapor(clock))).status).toBe(204);
    expect((await gonder(s, rapor(clock, { message: 'Cannot read properties of undefined (reading \'x\')' }), '198.51.100.9')).status).toBe(204);
    const r = satirlar(s);
    expect(r).toHaveLength(1);
    expect(r[0]!.n).toBe(2);
    expect(JSON.stringify(r)).not.toMatch(/203\.0\.113\.7|198\.51\.100\.9/);
    const oz = await (await fetch(`${s.httpUrl}/hata/ozet`)).json() as { ok: boolean; toplam: number; son24: number; imzalar: { imza: string; n: number; son24: number }[] };
    expect(oz).toMatchObject({ ok: true, toplam: 2, son24: 2 });
    expect(oz.imzalar).toEqual([{ imza: r[0]!.sig, n: 2, son24: 2 }]);
    // özet ileti/yığın/sürüm taşımaz
    expect(JSON.stringify(oz)).not.toMatch(/TypeError|render|0\.1\.0|android/);
    // OPTIONS (CORS ön isteği) ve yanlış yöntem
    expect((await fetch(`${s.httpUrl}/hata`, { method: 'OPTIONS' })).status).toBe(204);
    expect((await fetch(`${s.httpUrl}/hata`)).status).toBe(405);
  });

  it('boyut sınırı: 8 KB üstü 413', async () => {
    const { srv: s, clock } = await sunucu();
    const buyuk = JSON.stringify(rapor(clock, { message: 'x'.repeat(CRASH_LIMITS.maxBytes) }));
    expect(Buffer.byteLength(buyuk)).toBeGreaterThan(CRASH_LIMITS.maxBytes);
    expect((await gonder(s, buyuk, undefined, true)).status).toBe(413);
    expect(satirlar(s)).toHaveLength(0);
  });

  it('şema: eksik/yanlış alan, JSON olmayan gövde ve uzun yığın reddedilir', async () => {
    const { srv: s, clock } = await sunucu();
    const kotu: unknown[] = [
      { ...rapor(clock), v: 2 }, (() => { const r = rapor(clock); delete r.kind; return r; })(), rapor(clock, { platform: 'windows' as never }),
      rapor(clock, { stack: Array.from({ length: 21 }, (_, i) => `a.js:${i + 1}`) }), rapor(clock, { stack: ['https://odi.example/assets/a.js?pid=p1:1:2'] }),
      rapor(clock, { at: clock.t + 30_123 }), rapor(clock, { at: clock.t + 3_600_000 }), rapor(clock, { os: 'Android 14.2.1 (SM-A546B)' }),
      rapor(clock, { screen: 'harita ekranı' }), rapor(clock, { app: 'abc' }), rapor(clock, { message: 'x'.repeat(CRASH_LIMITS.messageMax + 1) }), [], 'metin', null,
    ];
    let ip = 0;
    for (const k of kotu) expect((await gonder(s, k, `192.0.2.${++ip}`)).status, JSON.stringify(k).slice(0, 80)).toBe(400);
    expect((await gonder(s, '{bozuk', '192.0.2.200', true)).status).toBe(400);
    expect(satirlar(s)).toHaveLength(0);
  });

  it('kişisel veri alanı taşıyan rapor reddedilir; iletideki kişisel veri sunucuda da temizlenir', async () => {
    const { srv: s, clock } = await sunucu();
    const alanlar = { playerId: 'p3fa91b2c7d4e5f60', pid: 'p3fa91b2c7d4e5f60', nick: 'Ayşe', name: 'Ayşe', token: 'f'.repeat(64), ip: '203.0.113.7', chat: 'merhaba', friendCode: 'K7M2QX', email: 'a@b.co', deviceId: 'x' };
    let ip = 0;
    for (const [k, v] of Object.entries(alanlar)) expect((await gonder(s, rapor(clock, { [k]: v }), `192.0.2.${++ip}`)).status, k).toBe(400);
    expect(satirlar(s)).toHaveLength(0);
    expect((await gonder(s, rapor(clock, { message: 'ayse@ornek.com p3fa91b2c7d4e5f60 hata 123456' }), '192.0.2.99')).status).toBe(204);
    const m = String(satirlar(s)[0]!.message);
    expect(m).not.toMatch(/ayse|ornek|p3fa|\d/);
  });

  it('hız sınırı: IP başına dakikada 10, günde 100; başka IP etkilenmez', async () => {
    const { srv: s, clock } = await sunucu();
    const ip = '203.0.113.50';
    for (let i = 0; i < CRASH_LIMITS.perIpMinute; i++) expect((await gonder(s, rapor(clock), ip)).status).toBe(204);
    expect((await gonder(s, rapor(clock), ip)).status).toBe(429);
    expect((await gonder(s, rapor(clock), '203.0.113.51')).status).toBe(204);
    // dakika dolunca yeniden; geçersiz gövde de sayılır (sınır gövdeden önce)
    let n = CRASH_LIMITS.perIpMinute;
    while (n < CRASH_LIMITS.perIpDay) {
      clock.advance(60_000);
      for (let i = 0; i < CRASH_LIMITS.perIpMinute && n < CRASH_LIMITS.perIpDay; i++, n++) {
        expect((await gonder(s, i % 2 ? rapor(clock) : '{', ip, i % 2 === 0)).status).not.toBe(429);
      }
    }
    clock.advance(60_000);
    expect((await gonder(s, rapor(clock), ip)).status).toBe(429);
    expect(crashRateEntries(s.app)).toBe(2);
    // gün değişince IP özetleri bellekten silinir (zamanlayıcı turu)
    clock.advance(DAY);
    s.sweep();
    expect(crashRateEntries(s.app)).toBe(0);
    expect((await gonder(s, rapor(clock), ip)).status).toBe(204);
  });

  it('30 günden eski kayıtlar silinir; daha yeni kayıt kalır; saklama süresinden eski rapor kaydedilmez', async () => {
    const { srv: s, clock } = await sunucu();
    expect((await gonder(s, rapor(clock), '203.0.113.1')).status).toBe(204);
    clock.advance(20 * DAY);
    expect((await gonder(s, rapor(clock, { kind: 'RangeError' }), '203.0.113.1')).status).toBe(204);
    clock.advance(11 * DAY);
    pruneCrashes(s.app);
    expect(satirlar(s).map((r) => r.kind)).toEqual(['RangeError']);
    clock.advance(20 * DAY);
    pruneCrashes(s.app);
    expect(satirlar(s)).toHaveLength(0);
    // bağlantısız 31 gün bekleyip gelen rapor: kabul edilir ama kaydedilmez
    expect((await gonder(s, rapor(clock, { at: Math.floor((clock.t - 31 * DAY) / 60_000) * 60_000 }), '203.0.113.2')).status).toBe(204);
    expect(satirlar(s)).toHaveLength(0);
  });
});
