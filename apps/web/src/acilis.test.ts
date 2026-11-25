// Açılış kontrolleri (1.1.0, acilis.ts): sürüm karşılaştırma, /surum yanıtı, "sesi açın" kararı, açılış başına bir kez.
import { describe, expect, it, vi } from 'vitest';
import { STORE_URL, checkForUpdate, isNewerVersion, onceThisLaunch, parseVersion, soundWarning, storeVersionFor, versionEndpoint } from './acilis';
import { installPlatform } from './platform';

const ok = (body: unknown) => vi.fn(async () => ({ ok: true, json: async () => body }) as unknown as Response);

describe('sürüm', () => {
  it('ayrıştırma ve karşılaştırma (sayısal, alan alan)', () => {
    expect(parseVersion('1.1.0')).toEqual([1, 1, 0]);
    expect(parseVersion('2')).toEqual([2, 0, 0]);
    expect(parseVersion('1.1.0-beta')).toBeNull();
    expect(parseVersion(110)).toBeNull();
    expect(isNewerVersion('1.1.0', '1.0.0')).toBe(true);
    expect(isNewerVersion('1.10.0', '1.9.9')).toBe(true);
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
    expect(isNewerVersion('1.0.9', '1.1.0')).toBe(false);
    expect(isNewerVersion('x', '1.0.0')).toBe(false);
  });
  it('/surum yanıtı: platform alanı yoksa ya da bozuksa sorulmaz', () => {
    expect(storeVersionFor({ ios: '1.1.0', android: '1.1.1' }, 'android')).toBe('1.1.1');
    expect(storeVersionFor({ ios: '1.1.0' }, 'android')).toBeNull();
    expect(storeVersionFor({ ios: 5 }, 'ios')).toBeNull();
    expect(storeVersionFor(null, 'ios')).toBeNull();
    expect(versionEndpoint('wss://odi.example.org')).toBe('https://odi.example.org/surum');
    expect(versionEndpoint('ws://192.168.1.20:8787')).toBe('http://192.168.1.20:8787/surum');
    expect(versionEndpoint('')).toBe('');
  });
  it('yeni sürüm varsa mağaza bağlantısı; yoksa, ağ hatasında, geliştirmede null', async () => {
    const f = ok({ ios: '1.2.0', android: '1.1.0' });
    expect(await checkForUpdate({ serverUrl: 'wss://odi.example.org', installed: '1.1.0', platform: 'ios', fetch: f })).toEqual({ version: '1.2.0', url: STORE_URL.ios });
    expect(f).toHaveBeenCalledWith('https://odi.example.org/surum', expect.objectContaining({ method: 'GET' }));
    expect(await checkForUpdate({ serverUrl: 'wss://odi.example.org', installed: '1.1.0', platform: 'android', fetch: f })).toBeNull();
    expect(await checkForUpdate({ serverUrl: 'wss://odi.example.org', installed: null, platform: 'ios', fetch: f })).toBeNull();
    expect(await checkForUpdate({ serverUrl: '', installed: '1.0.0', platform: 'ios', fetch: f })).toBeNull();
    const bad = vi.fn(async () => { throw new Error('ağ yok'); });
    expect(await checkForUpdate({ serverUrl: 'wss://odi.example.org', installed: '1.0.0', platform: 'ios', fetch: bad as unknown as typeof fetch })).toBeNull();
    const notOk = vi.fn(async () => ({ ok: false, json: async () => ({ ios: '9.0.0' }) }) as unknown as Response);
    expect(await checkForUpdate({ serverUrl: 'wss://odi.example.org', installed: '1.0.0', platform: 'ios', fetch: notOk })).toBeNull();
  });
});

describe('sesi açın uyarısı', () => {
  it('oyun sesi kapalı → oyun; medya sesi ~0 → cihaz; bilinmiyorsa yalnız oyun ayarı', () => {
    expect(soundWarning(false, 0.8)).toBe('oyun');
    expect(soundWarning(true, 0)).toBe('cihaz');
    expect(soundWarning(true, 0.5)).toBeNull();
    expect(soundWarning(true, null)).toBeNull();
    expect(soundWarning(true, undefined)).toBeNull();
  });
});

describe('açılış başına bir kez', () => {
  it('tarayıcıda bellekte, kabukta yerel bayrakla', async () => {
    expect(await onceThisLaunch('deneme-web')).toBe(true);
    expect(await onceThisLaunch('deneme-web')).toBe(false);
    const seen = new Set<string>();
    installPlatform({ onceThisLaunch: async (k) => { if (seen.has(k)) return false; seen.add(k); return true; } });
    expect(await onceThisLaunch('x')).toBe(true);
    expect(await onceThisLaunch('x')).toBe(false);
    installPlatform({ onceThisLaunch: undefined });
  });
});
