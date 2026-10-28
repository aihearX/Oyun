import { describe, expect, it } from 'vitest';
import {
  buildCrashReport, CRASH_LIMITS, CRASH_STACK_RE, crashEndpoint, crashSignature, CrashReporter, fingerprintStack, osFromUserAgent, scrubText,
  type CrashContext,
} from './hata';

const ctx: CrashContext = { app: '0.1.0', build: 'abc123', platform: 'web', os: 'android 14', screen: 'map' };

describe('çökme raporu: temizleyici', () => {
  it('e-postaları, uzun rakam dizilerini ve anahtar benzeri dizgileri çıkarır', () => {
    const pid = 'p3fa91b2c7d4e5f60';
    const token = 'a'.repeat(10) + '0123456789abcdef'.repeat(4);
    const s = scrubText(`ali.veli+test@ornek.com.tr oyuncu ${pid} anahtar ${token} telefon 05321234567 kod K7M2QX`);
    expect(s).not.toContain('@');
    expect(s).not.toContain('ali.veli');
    expect(s).not.toContain(pid);
    expect(s).not.toContain(token.slice(0, 16));
    expect(s).not.toMatch(/\d/);
    expect(s).not.toContain('K7M2QX');
    expect(s).toContain('<e-posta>');
    expect(s).toContain('<anahtar>');
  });

  it('URL sorgu ve parça kısmını, tırnak içindeki serbest yazıyı çıkarır; kısa tanımlayıcıları korur', () => {
    const s = scrubText('GET https://odi.example/api/x?token=abc&pid=p1#frag başarısız; Cannot read properties of undefined (reading \'getBoundingClientRect\')');
    expect(s).toContain('https://odi.example/api/x');
    expect(s).not.toMatch(/token=|pid=|frag/);
    expect(s).toContain("'getBoundingClientRect'");
    const j = scrubText('Unexpected token \'m\', "merhaba arkadaşım nasılsın" is not valid JSON');
    expect(j).not.toContain('merhaba');
    expect(j).toContain('is not valid JSON');
  });

  it('uzunluğu sınırlar; aynı hatanın farklı sayıları tek imzada toplanır', () => {
    expect(scrubText('x '.repeat(1000)).length).toBeLessThanOrEqual(CRASH_LIMITS.messageMax);
    const a = buildCrashReport(new RangeError('index 4521 out of range'), ctx);
    const b = buildCrashReport(new RangeError('index 17 out of range'), ctx);
    expect(a.message).toBe(b.message);
    a.stack = b.stack = ['f@a.js:1:2'];
    expect(crashSignature(a)).toBe(crashSignature(b));
  });

  it('yığın: yalnız işlev@dosya:satır:sütun, en çok 20 satır; klasör, alan adı ve sorgu yok', () => {
    const v8 = ['TypeError: x', ...Array.from({ length: 30 }, (_, i) => `    at fn${i} (https://odi.example/assets/index-B1x_k9.js?v=p3fa91b2c7d4e5f60:1:${100 + i})`), '    at https://odi.example/assets/vendor.js:2:3'].join('\n');
    const st = fingerprintStack(v8);
    expect(st).toHaveLength(20);
    expect(st[0]).toBe('fn0@index-B1x_k9.js:1:100');
    for (const l of st) { expect(l).toMatch(CRASH_STACK_RE); expect(l).not.toMatch(/odi\.example|p3fa|\?/); }
    expect(fingerprintStack('render@http://localhost:5173/src/App.tsx:12:5\n@http://x/y.js:3:4')).toEqual(['render@App.tsx:12:5', 'y.js:3:4']);
    expect(fingerprintStack('    at anonymous (address at /data/app/index.android.bundle:1:23456)')).toEqual(['anonymous@index.android.bundle:1:23456']);
    expect(fingerprintStack(undefined)).toEqual([]);
  });

  it('rapor yalnız izinli alanları taşır; Error olmayan değerin içeriği gönderilmez', () => {
    const r = buildCrashReport(new Error('x'), { ...ctx, screen: 'bad screen!' }, 1_700_000_123_456);
    expect(Object.keys(r).sort()).toEqual(['app', 'at', 'build', 'kind', 'message', 'os', 'platform', 'screen', 'stack', 'v']);
    expect(r.at % 60_000).toBe(0);
    expect(r.screen).toBe('');
    const n = buildCrashReport({ chat: 'özel mesaj metni' }, ctx);
    expect(JSON.stringify(n)).not.toContain('özel');
    const s = buildCrashReport('gizli sohbet', ctx);
    expect(s.kind).toBe('NonError'); expect(s.message).toBe('string');
  });

  it('işletim sistemi yalnız aile + ana sürüm; uç adresi ws/wss → http/https', () => {
    expect(osFromUserAgent('Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36')).toBe('android 14');
    expect(osFromUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X)')).toBe('ios 17');
    expect(osFromUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows');
    expect(crashEndpoint('wss://ornek.duckdns.org')).toBe('https://ornek.duckdns.org/hata');
    expect(crashEndpoint('ws://127.0.0.1:8787/?x=1')).toBe('http://127.0.0.1:8787/hata');
    expect(crashEndpoint('')).toBe('');
  });
});

describe('çökme raporu: istemci raporlayıcısı', () => {
  const memStore = () => { let v: string | null = null; return { get: async () => v, set: async (x: string) => { v = x; }, peek: () => v }; };
  const tick = () => new Promise((r) => setTimeout(r, 5));

  it('aynı imza oturumda bir kez; oturumda en çok 5 rapor', async () => {
    const sent: string[] = [];
    const rep = new CrashReporter({ context: () => ctx, post: async (b) => { sent.push(b); return true; } });
    const ayni = () => new Error('aynı yer');
    const ilk = [0, 1].map(() => rep.report(ayni())); // aynı atış yeri iki kez
    expect(ilk[0]).not.toBeNull();
    expect(ilk[1]).toBeNull();
    for (let i = 0; i < 10; i++) rep.report(new TypeError(`farklı ${'abcdefghij'[i]}`));
    await tick(); await rep.flush();
    expect(sent).toHaveLength(CRASH_LIMITS.perSession);
  });

  it('gönderilemeyen son 5 rapor kuyrukta bekler, bağlantı gelince gider; gönderim hatası dışarı sızmaz', async () => {
    let online = false; const sent: string[] = []; const store = memStore();
    const mk = () => new CrashReporter({ context: () => ctx, store, post: async (b) => { if (!online) throw new Error('ağ yok'); sent.push(b); return true; } });
    for (let s = 0; s < 3; s++) { const rep = mk(); for (let i = 0; i < 3; i++) rep.report(new Error(`oturum ${'abc'[s]} hata ${'xyz'[i]}`)); await tick(); }
    expect(sent).toHaveLength(0);
    expect(JSON.parse(store.peek()!)).toHaveLength(CRASH_LIMITS.queueMax);
    online = true;
    await mk().flush();
    expect(sent).toHaveLength(CRASH_LIMITS.queueMax);
    expect(JSON.parse(store.peek()!)).toEqual([]);
    // bozuk depo ve fırlatan bağlam raporlamayı bozmaz
    const bad = new CrashReporter({ context: () => { throw new Error('bağlam yok'); }, post: async () => true });
    expect(bad.report(new Error('x'))).toBeNull();
    const broken = new CrashReporter({ context: () => ctx, store: { get: async () => '{bozuk', set: async () => { throw new Error('dolu'); } }, post: async () => true });
    expect(broken.report(new Error('y'))).not.toBeNull();
    await tick();
  });
});
