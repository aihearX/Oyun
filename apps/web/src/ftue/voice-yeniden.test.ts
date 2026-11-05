import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// YN-242: ses listesi bir kez okunamadı diye anlatıcı oturum boyu susmasın
vi.mock('@odi/audio', () => ({ audio: { decode: async () => ({ duration: 3 }) } }));

const { recordedFile, resetVoiceManifest, retryVoiceManifest, voiceBuffer, voiceManifest } = await import('./voice');
const { textHash } = await import('./script');
const { installPlatform } = await import('../platform');
const { useNet } = await import('@odi/net/store');

const manifest = JSON.stringify({ version: 1, lines: { 'hikaye-01': { file: 'hikaye-01.mp3', hash: textHash('Merhaba.') } } });
const ok = (body: string) => ({ ok: true, status: 200, text: async () => body, arrayBuffer: async () => new ArrayBuffer(4) });

describe('anlatıcı ses listesi: hata önbellekte kalmaz', () => {
  beforeEach(() => { resetVoiceManifest(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(1_000_000); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('fetch önce reddeder sonra verir: ikinci çağrı kaydı bulur (kısa beklemeden sonra)', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(ok(manifest));
    vi.stubGlobal('fetch', fetch);
    expect(await recordedFile('hikaye-01', 'Merhaba.')).toBeNull();
    // hemen ardından: kısa bekleme (art arda istek açılmaz)
    expect(await recordedFile('hikaye-01', 'Merhaba.')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.setSystemTime(1_000_000 + 3500);
    expect(await recordedFile('hikaye-01', 'Merhaba.')).toBe('hikaye-01.mp3');
    expect(fetch).toHaveBeenCalledTimes(2);
    // dolu liste önbellekte kalır
    await voiceManifest();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('boş yanıt da önbelleğe alınmaz; "Sesi dene" / bağlantı dönüşü beklemeden yeniden dener', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 503, text: async () => '' }).mockResolvedValue(ok(manifest));
    vi.stubGlobal('fetch', fetch);
    expect(Object.keys((await voiceManifest()).lines)).toHaveLength(0);
    retryVoiceManifest();
    expect(await recordedFile('hikaye-01', 'Merhaba.')).toBe('hikaye-01.mp3');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('sunucu bağlantısı "bağlı"ya dönünce bekleme kalkar', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(ok(manifest));
    vi.stubGlobal('fetch', fetch);
    useNet.setState({ status: 'kapalı' });
    expect(await recordedFile('hikaye-01', 'Merhaba.')).toBeNull();
    useNet.setState({ status: 'bağlı' });
    expect(await recordedFile('hikaye-01', 'Merhaba.')).toBe('hikaye-01.mp3');
  });

  it('indirilemeyen kayıt dosyası önbellekte tutulmaz', async () => {
    let n = 0;
    installPlatform({ voiceData: async () => (n++ === 0 ? null : 'AAAA') });
    expect(await voiceBuffer('hikaye-01.mp3')).toBeNull();
    await Promise.resolve();
    expect(await voiceBuffer('hikaye-01.mp3')).not.toBeNull();
    expect(n).toBe(2);
  });
});
