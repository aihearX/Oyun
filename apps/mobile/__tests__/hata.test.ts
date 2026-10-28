/** Çökme raporu, telefon kabuğu (YN-011): global hata işleyicisi rapor gönderir, önceki işleyiciyi bozmaz; geliştirmede kapalı. */
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '0.1.0' }, platform: { ios: { buildNumber: '7' } } } }));

function load() {
  let m!: typeof import('../src/hata');
  jest.isolateModules(() => { m = jest.requireActual('../src/hata'); });
  return m;
}

describe('telefon kabuğu çökme raporu', () => {
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler(): (e: unknown, f?: boolean) => void; setGlobalHandler(h: (e: unknown, f?: boolean) => void): void }; fetch: unknown };
  const realEU = g.ErrorUtils; const realFetch = g.fetch;
  afterEach(() => { g.ErrorUtils = realEU; g.fetch = realFetch; jest.useRealTimers(); });

  it('geliştirmede ve sunucu adresi yokken kurulmaz', () => {
    const m = load();
    expect(m.nativeAppInfo(true)).toBeNull();
    expect(m.installNativeCrashReporting('', { platform: 'ios', os: 'ios 17', app: '0.1.0', build: '7' })).toBe(false);
  });

  it('yayın derlemesi: platform + işletim sistemi ana sürümü + sürüm + derleme; kimlik yok', () => {
    const info = load().nativeAppInfo(false)!;
    expect(info.platform).toMatch(/^(ios|android)$/);
    expect(info.os).toMatch(/^(ios|android)( \d{1,3})?$/);
    expect(info.app).toBe('0.1.0');
    expect(Object.keys(info).sort()).toEqual(['app', 'build', 'os', 'platform']);
  });

  it('global işleyici raporu sunucuya gönderir ve önceki işleyiciyi çağırır', async () => {
    let handler: (e: unknown, f?: boolean) => void = () => undefined;
    const prev = jest.fn();
    g.ErrorUtils = { getGlobalHandler: () => prev, setGlobalHandler: (h) => { handler = h; } };
    const calls: { url: string; body: string }[] = [];
    g.fetch = jest.fn(async (url: string, init: { body: string }) => { calls.push({ url, body: init.body }); return { ok: true, status: 204 }; });
    const m = load();
    expect(m.installNativeCrashReporting('wss://ornek.invalid', { platform: 'android', os: 'android 14', app: '0.1.0', build: '12' })).toBe(true);
    const e = new TypeError('oyuncu p3fa91b2c7d4e5f60 için ayse@ornek.com hata');
    handler(e, true);
    expect(prev).toHaveBeenCalledWith(e, true);
    for (let i = 0; i < 20 && !calls.length; i++) await new Promise((r) => setTimeout(r, 5));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://ornek.invalid/hata');
    const body = JSON.parse(calls[0]!.body);
    expect(body).toMatchObject({ v: 1, kind: 'TypeError', platform: 'android', os: 'android 14', app: '0.1.0', build: '12', screen: 'kabuk-olumcul' });
    expect(calls[0]!.body).not.toMatch(/p3fa91b2c7d4e5f60|ayse|ornek\.com/);
  });
});
