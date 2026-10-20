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
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn(() => ({ volume: 1, play: jest.fn(), pause: jest.fn(), remove: jest.fn(), addListener: jest.fn(() => ({ remove: jest.fn() })) })) }));
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
    for (const k of ['getItem', 'setItem', 'removeItem', 'haptic', 'share', 'speak', 'stopSpeaking', 'voiceManifest', 'playVoice', 'stopVoice']) expect(typeof p[k]).toBe('function');
    // yedek anlatıcı sesi (TTS): Türkçe, erkek ses tercih edilir, cümle cümle sıraya alınır
    const Speech = jest.requireMock('expo-speech') as { speak: jest.Mock };
    await (p.speak as (t: string, r: number, pi: number) => Promise<void>)('Merhaba, ben Tüy Dede. Seni bekliyordum.', 0.86, 0.74);
    expect(Speech.speak).toHaveBeenNthCalledWith(1, 'Merhaba, ben Tüy Dede.', expect.objectContaining({ language: 'tr-TR', voice: 'tr-tr-x-tmc-local', rate: 0.88, pitch: 0.9 }));
    expect(Speech.speak).toHaveBeenNthCalledWith(2, 'Seni bekliyordum.', expect.anything());
    // gömülü kayıtlar: liste köprüden gelir; listede olmayan dosya çalınmaz (web tarafı TTS'ye düşer)
    const man = JSON.parse(String(await (p.voiceManifest as () => Promise<string>)())) as { lines: Record<string, { file: string }> };
    expect(typeof man.lines).toBe('object');
    expect(await (p.playVoice as (f: string, v: number) => Promise<boolean>)('yok.mp3', 1)).toBe(false);
    await (p.setItem as (k: string, v: string) => Promise<void>)('x', '1');
    expect(await (p.getItem as (k: string) => Promise<string | null>)('x')).toBe('1');
  });
});
