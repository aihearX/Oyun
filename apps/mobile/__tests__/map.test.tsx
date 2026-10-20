import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Home from '../src/app/index';

const captured: Record<string, unknown>[] = [];
jest.mock('@/dom/WebApp', () => ({ __esModule: true, default: (p: Record<string, unknown>) => { captured.push(p); return null; } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }), SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { hostUri: '192.168.1.20:8081' } } }));
jest.mock('expo-speech', () => ({
  speak: jest.fn((_t: string, o?: { onDone?: () => void }) => o?.onDone?.()), stop: jest.fn(async () => undefined),
  // iOS'ta olduğu gibi yalnız kadın ses (Yelda) ve Android'deki gibi bir erkek ses: erkek olan seçilmeli
  getAvailableVoicesAsync: jest.fn(async () => [{ identifier: 'com.apple.voice.compact.tr-TR.Yelda', name: 'Yelda', language: 'tr-TR', quality: 'Default' }, { identifier: 'tr-tr-x-tmc-local', name: 'tr-tr-x-tmc-local', language: 'tr-TR', quality: 'Enhanced' }]),
}));
// gömülü kayıtlar: kabuk dosyanın baytlarını base64 verir (yerel oynatıcı yok; WebView'deki WebAudio çözer)
jest.mock('expo-asset', () => ({ Asset: { fromModule: jest.fn(() => ({ localUri: null, uri: 'http://metro/voice.mp3', downloadAsync: jest.fn(async function (this: { localUri: string | null }) { this.localUri = 'file:///cache/voice.mp3'; }) })) } }));
jest.mock('expo-file-system', () => ({ File: jest.fn().mockImplementation((uri: string) => ({ base64: jest.fn(async () => (uri.startsWith('file://') ? 'SUQzBAAAAAAA' : '')) })) }));
jest.mock('@/voice/files', () => ({ VOICE_FILES: { 'hikaye-01.mp3': 7 } }));
jest.mock('@react-native-async-storage/async-storage', () => { const m = new Map<string, string>(); return { __esModule: true, default: { getItem: jest.fn(async (k: string) => m.get(k) ?? null), setItem: jest.fn(async (k: string, v: string) => { m.set(k, v); }), removeItem: jest.fn(async (k: string) => { m.delete(k); }), clear: jest.fn(async () => { m.clear(); }) } }; });
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), notificationAsync: jest.fn(), ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));

/** Duman testi: kabuk web arayüzünü yerel köprüyle (depolama, titreşim, paylaşım, sunucu, çentik) başlatır. */
describe('Mobil kabuk', () => {
  it('web arayüzüne yerel köprüyü verir', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<Home />); });
    expect(tree).toBeTruthy();
    const p = captured[captured.length - 1]!;
    expect(p.serverUrl).toBe('ws://192.168.1.20:8787');
    expect(p.insetTop).toBe(47);
    expect(p.insetBottom).toBe(34);
    // kaydırma web tarafındaki #root kabında; iOS içeriği ayrıca kaydırmaz (güvenli alan prop'larla gelir)
    const dom = p.dom as { scrollEnabled?: boolean; contentInsetAdjustmentBehavior?: string };
    expect(dom.scrollEnabled).toBe(false);
    expect(dom.contentInsetAdjustmentBehavior).toBe('never');
    for (const k of ['getItem', 'setItem', 'removeItem', 'haptic', 'share', 'speak', 'stopSpeaking', 'voiceManifest', 'voiceData', 'clearAll', 'restartApp']) expect(typeof p[k]).toBe('function');
    // yedek anlatıcı sesi (TTS): Türkçe, erkek ses tercih edilir, cümle cümle sıraya alınır
    const Speech = jest.requireMock('expo-speech') as { speak: jest.Mock };
    expect(await (p.speak as (t: string, r: number, pi: number, m: boolean) => Promise<boolean>)('Merhaba, ben Tüy Dede. Seni bekliyordum.', 0.86, 0.74, true)).toBe(true);
    expect(Speech.speak).toHaveBeenNthCalledWith(1, 'Merhaba, ben Tüy Dede.', expect.objectContaining({ language: 'tr-TR', voice: 'tr-tr-x-tmc-local', rate: 0.88, pitch: 0.9 }));
    expect(Speech.speak).toHaveBeenNthCalledWith(2, 'Seni bekliyordum.', expect.anything());
    // gömülü kayıtlar: liste köprüden gelir; listede olmayan dosya çalınmaz (web tarafı TTS'ye düşer)
    const man = JSON.parse(String(await (p.voiceManifest as () => Promise<string>)())) as { lines: Record<string, { file: string }> };
    expect(typeof man.lines).toBe('object');
    const data = p.voiceData as (f: string) => Promise<string | null>;
    expect(await data('hikaye-01.mp3')).toBe('SUQzBAAAAAAA'); // indirilip yerel dosyadan okundu
    expect(await data('yok.mp3')).toBeNull();
    // Sıfırla: bütün kayıtlar silinir
    await (p.setItem as (k: string, v: string) => Promise<void>)('odi-v1', '{}');
    await (p.clearAll as () => Promise<void>)();
    expect(await (p.getItem as (k: string) => Promise<string | null>)('odi-v1')).toBeNull();
    await (p.setItem as (k: string, v: string) => Promise<void>)('x', '1');
    expect(await (p.getItem as (k: string) => Promise<string | null>)('x')).toBe('1');
  });
});

describe('base64 köprüsü', () => {
  it('bayt → base64 (btoa olmadan) doğru', () => {
    const { bytesToBase64 } = jest.requireActual('../src/voice/player') as { bytesToBase64: (b: Uint8Array) => string };
    for (const s of ['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar', 'ID3\u0004\u0000']) {
      expect(bytesToBase64(new Uint8Array([...s].map((c) => c.charCodeAt(0))))).toBe(btoa(s));
    }
  });
});
