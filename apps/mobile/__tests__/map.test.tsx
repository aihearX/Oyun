import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Home from '../src/app/index';

const captured: Record<string, unknown>[] = [];
jest.mock('@/dom/WebApp', () => ({ __esModule: true, default: (p: Record<string, unknown>) => { captured.push(p); return null; } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }), SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { hostUri: '192.168.1.20:8081' } } }));
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn(async () => undefined), getAvailableVoicesAsync: jest.fn(async () => [{ identifier: 'tr-1', language: 'tr-TR', quality: 'Enhanced' }]) }));
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
    for (const k of ['getItem', 'setItem', 'removeItem', 'haptic', 'share', 'speak', 'stopSpeaking']) expect(typeof p[k]).toBe('function');
    // anlatıcı sesi: Türkçe, seçilen gelişmiş sesle
    const Speech = jest.requireMock('expo-speech') as { speak: jest.Mock };
    await (p.speak as (t: string, r: number, pi: number) => Promise<void>)('Merhaba, ben Tüy Dede.', 0.95, 0.92);
    expect(Speech.speak).toHaveBeenCalledWith('Merhaba, ben Tüy Dede.', expect.objectContaining({ language: 'tr-TR', voice: 'tr-1' }));
    await (p.setItem as (k: string, v: string) => Promise<void>)('x', '1');
    expect(await (p.getItem as (k: string) => Promise<string | null>)('x')).toBe('1');
  });
});
