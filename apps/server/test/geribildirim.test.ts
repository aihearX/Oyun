import { afterEach, describe, expect, it } from 'vitest';
import { FEEDBACK_LIMITS, type FeedbackReport } from '@odi/shared';
import { startServer, type OdiServer } from '../src/server';
import { feedbackList, feedbackRateEntries, pruneFeedback } from '../src/geribildirim';
import { MIGRATIONS, userVersion } from '../src/migrations';
import { Clock } from './helpers';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
let srv: OdiServer | null = null;
afterEach(async () => { await srv?.close(); srv = null; });

async function sunucu(clock = new Clock()) {
  srv = await startServer({ port: 0, host: '127.0.0.1', now: clock.now, trustProxy: 1 });
  return { srv, clock };
}
const kayit = (o: Partial<Record<keyof FeedbackReport, unknown>> & Record<string, unknown> = {}): Record<string, unknown> => ({
  v: 1, topic: 'hata', text: 'Haritada 3. bölüme dokununca ekran donuyor', screen: 'map', app: '0.1.0', build: 'abc123', platform: 'web', ...o,
});
const gonder = (s: OdiServer, body: unknown, ip = '203.0.113.7', ham = false) =>
  fetch(`${s.httpUrl}/geri-bildirim`, { method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8', 'x-forwarded-for': ip }, body: ham ? String(body) : JSON.stringify(body) });
const satirlar = (s: OdiServer) => s.app.db.all<Record<string, unknown>>('SELECT * FROM feedback ORDER BY id');

describe('geri bildirim ucu (POST /geri-bildirim)', () => {
  it('geçerli kayıt saklanır; tabloda oyuncu ve IP sütunu yok; özet yalnız sayı verir; göç 4 uygulandı', async () => {
    const { srv: s, clock } = await sunucu();
    expect((await gonder(s, kayit())).status).toBe(204);
    const r = satirlar(s);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ topic: 'hata', text: 'Haritada 3. bölüme dokununca ekran donuyor', screen: 'map', app: '0.1.0', build: 'abc123', platform: 'web', at: Math.floor(clock.t / 60_000) * 60_000 });
    expect(Object.keys(r[0]!).sort()).toEqual(['app', 'at', 'build', 'id', 'platform', 'screen', 'text', 'topic']);
    expect(JSON.stringify(r)).not.toContain('203.0.113.7');
    const oz = await (await fetch(`${s.httpUrl}/geri-bildirim/ozet`)).json() as Record<string, unknown>;
    expect(oz).toEqual({ ok: true, son24: 1, gun7: 1 });
    expect(userVersion(s.app.db.raw)).toBe(MIGRATIONS.length);
    expect(MIGRATIONS.map((m) => m.name)).toContain('geri-bildirim');
    // OPTIONS (CORS ön isteği) ve yanlış yöntem
    expect((await fetch(`${s.httpUrl}/geri-bildirim`, { method: 'OPTIONS' })).status).toBe(204);
    expect((await fetch(`${s.httpUrl}/geri-bildirim`)).status).toBe(405);
  });

  it('boyut sınırı: 4 KB üstü 413', async () => {
    const { srv: s } = await sunucu();
    const buyuk = JSON.stringify(kayit({ text: 'ş'.repeat(FEEDBACK_LIMITS.maxBytes) }));
    expect(Buffer.byteLength(buyuk)).toBeGreaterThan(FEEDBACK_LIMITS.maxBytes);
    expect((await gonder(s, buyuk, undefined, true)).status).toBe(413);
    expect(satirlar(s)).toHaveLength(0);
  });

  it('şema: eksik/yanlış alan, boş ya da 500 karakterden uzun metin, JSON olmayan gövde reddedilir', async () => {
    const { srv: s } = await sunucu();
    const kotu: unknown[] = [
      kayit({ v: 2 }), (() => { const r = kayit(); delete r.text; return r; })(), kayit({ topic: 'sikayet' }), kayit({ platform: 'windows' }),
      kayit({ text: '' }), kayit({ text: '   ' }), kayit({ text: 'x'.repeat(FEEDBACK_LIMITS.textMax + 1) }), kayit({ text: 5 }),
      kayit({ screen: 'harita ekranı' }), kayit({ app: 'abc' }), kayit({ build: 'a b' }), [], 'metin', null,
    ];
    let ip = 0;
    for (const k of kotu) expect((await gonder(s, k, `192.0.2.${++ip}`)).status, JSON.stringify(k).slice(0, 80)).toBe(400);
    expect((await gonder(s, '{bozuk', '192.0.2.200', true)).status).toBe(400);
    expect(satirlar(s)).toHaveLength(0);
  });

  it('kişisel veri alanı taşıyan kayıt reddedilir; metindeki e-posta, telefon, uzun rakam dizisi sunucuda da temizlenir', async () => {
    const { srv: s } = await sunucu();
    const alanlar = { playerId: 'p3fa91b2c7d4e5f60', pid: 'p3fa91b2c7d4e5f60', nick: 'Ayşe', name: 'Ayşe', token: 'f'.repeat(64), ip: '203.0.113.7', email: 'a@b.co', phone: '05321234567', friendCode: 'K7M2QX', deviceId: 'x', at: 1 };
    let ip = 0;
    for (const [k, v] of Object.entries(alanlar)) expect((await gonder(s, kayit({ [k]: v }), `192.0.2.${++ip}`)).status, k).toBe(400);
    expect(satirlar(s)).toHaveLength(0);
    expect((await gonder(s, kayit({ text: 'Bana ayse@ornek.com ya da 0532 123 45 67 üzerinden ulaşın, TC 12345678901, kod K7M2QX' }), '192.0.2.99')).status).toBe(204);
    const t = String(satirlar(s)[0]!.text);
    expect(t).toBe('Bana <e-posta> ya da <numara> üzerinden ulaşın, TC <numara>, kod <kod>');
    // temizlenince boş kalan metin
    expect((await gonder(s, kayit({ text: '​‮' }), '192.0.2.98')).status).toBe(400);
  });

  it('hız sınırı: IP başına saatte 5, günde 20; başka IP etkilenmez; IP özeti gün sonunda bellekten silinir', async () => {
    const { srv: s, clock } = await sunucu();
    clock.t = Math.floor(clock.t / DAY) * DAY + DAY + HOUR; // günün başı: 20 istek aynı güne sığsın
    const ip = '203.0.113.50';
    for (let i = 0; i < FEEDBACK_LIMITS.perIpHour; i++) expect((await gonder(s, kayit(), ip)).status).toBe(204);
    expect((await gonder(s, kayit(), ip)).status).toBe(429);
    expect((await gonder(s, kayit(), '203.0.113.51')).status).toBe(204);
    // saat dolunca yeniden; geçersiz gövde de sayılır (sınır gövdeden önce)
    let n = FEEDBACK_LIMITS.perIpHour;
    while (n < FEEDBACK_LIMITS.perIpDay) {
      clock.advance(HOUR);
      for (let i = 0; i < FEEDBACK_LIMITS.perIpHour && n < FEEDBACK_LIMITS.perIpDay; i++, n++) {
        expect((await gonder(s, i % 2 ? kayit() : '{', ip, i % 2 === 0)).status).not.toBe(429);
      }
    }
    clock.advance(HOUR);
    expect((await gonder(s, kayit(), ip)).status).toBe(429);
    expect(feedbackRateEntries(s.app)).toBe(2);
    clock.advance(DAY);
    s.sweep();
    expect(feedbackRateEntries(s.app)).toBe(0);
    expect((await gonder(s, kayit(), ip)).status).toBe(204);
    expect(JSON.stringify(satirlar(s))).not.toMatch(/203\.0\.113/);
  });

  it('90 günden eski kayıtlar silinir; daha yeni kayıt kalır; okuma aracı yeniden eskiye listeler', async () => {
    const { srv: s, clock } = await sunucu();
    expect((await gonder(s, kayit({ text: 'eski' }), '203.0.113.1')).status).toBe(204);
    clock.advance(60 * DAY);
    expect((await gonder(s, kayit({ text: 'yeni', topic: 'oneri' }), '203.0.113.1')).status).toBe(204);
    expect(feedbackList(s.app, 7).map((r) => r.text)).toEqual(['yeni']);
    expect(feedbackList(s.app, 90).map((r) => r.text)).toEqual(['yeni', 'eski']);
    clock.advance(31 * DAY);
    pruneFeedback(s.app);
    expect(satirlar(s).map((r) => r.text)).toEqual(['yeni']);
    clock.advance(60 * DAY);
    pruneFeedback(s.app);
    expect(satirlar(s)).toHaveLength(0);
  });
});
