// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// YN-242: ses listesi bir kez okunamadı diye anlatıcı oturum boyu susmasın
vi.mock('@odi/audio', () => ({ audio: { decode: async () => ({ duration: 3 }) } }));

const { recordedFile, resetVoiceManifest, retryVoiceManifest, tryVoice, useVoiceStatus, voiceBuffer, voiceManifest } = await import('./voice');
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

  // YN-272 (OT-eski-telefon-42): uçak modundan sonra bağlıyken Ayarlar hâlâ "liste okunamadı" diyor, anlatıcı susuyordu
  it('bağlantı dönünce liste kendiliğinden yeniden iner, eski hata ve "internet yok" durumu kalkar', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(ok(manifest));
    vi.stubGlobal('fetch', fetch);
    useVoiceStatus.setState({ error: null, waiting: false });
    await voiceManifest();
    await Promise.resolve();
    expect(useVoiceStatus.getState()).toMatchObject({ error: 'liste okunamadı: TypeError: Failed to fetch', waiting: true });
    // window 'online' (ya da sunucu 'bağlı'): sıradaki satırı beklemeden listeyi ister
    window.dispatchEvent(new Event('online'));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(Object.keys((await voiceManifest()).lines)).toEqual(['hikaye-01']);
    await Promise.resolve();
    expect(useVoiceStatus.getState()).toMatchObject({ error: null, waiting: false });
    // liste zaten doluyken bağlantı olayı yeni istek açmaz
    window.dispatchEvent(new Event('online'));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('"Sesi dene": otomatik deneme düştükten hemen sonra da listeyi ister ve kaydı çalar', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(ok(manifest));
    vi.stubGlobal('fetch', fetch);
    useVoiceStatus.setState({ mode: 'sessiz', error: null, decoded: 0 });
    await voiceManifest(); await Promise.resolve();
    // bağlantı döndü ama ilk deneme de düştü (ağ henüz oturmamış): bekleme süresi yeniden başlar
    window.dispatchEvent(new Event('online')); await voiceManifest(); await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(useVoiceStatus.getState().error).toMatch(/liste okunamadı/);
    // bekleme dolmadan "Sesi dene": liste yeniden istenir, kayıt iner ve çalınır
    const played = vi.fn(() => ({ stop() {}, done: Promise.resolve() }));
    const { audio } = await import('@odi/audio');
    Object.assign(audio, { voice: played, unlock: () => undefined, running: () => true });
    const { useStore } = await import('../store');
    useStore.setState({ sounds: true, narratorVoice: true });
    tryVoice('Merhaba.', 'hikaye-01');
    expect(useVoiceStatus.getState().trying).toBe(true);
    await vi.waitFor(() => expect(useVoiceStatus.getState().mode).toBe('kayıt'));
    expect(fetch).toHaveBeenCalledTimes(4); // liste + kayıt dosyası
    expect(played).toHaveBeenCalledTimes(1);
    expect(useVoiceStatus.getState()).toMatchObject({ line: 'hikaye-01', error: null, waiting: false, trying: false });
    expect(useVoiceStatus.getState().decoded).toBeGreaterThan(0);
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
