import { describe, expect, it } from 'vitest';
import { installPlatform, platform } from './platform';
import { useStore } from './store';
import { prefersReducedMotion } from './ui/bits';

/** YN-043: Ayarlar › Titreşim ve Hareketi azalt kalıcı ve etkili */
describe('Titreşim anahtarı (store.haptics → platform().haptic)', () => {
  it('kapalıyken hiçbir çağrı cihazı titretmez; kurulan platformun haptic\'i de bu kapıdan geçer', () => {
    const calls: string[] = [];
    installPlatform({ haptic: (k) => { calls.push(k); } });
    useStore.getState().setHaptics(true);
    platform().haptic('light');
    useStore.getState().setHaptics(false);
    platform().haptic('heavy');
    installPlatform({ kind: 'native' }); // sonradan kurulum kapıyı bozmaz
    platform().haptic('success');
    expect(calls).toEqual(['light']);
    useStore.getState().setHaptics(true);
    platform().haptic('success');
    expect(calls).toEqual(['light', 'success']);
  });
  it('kalıcı: kayda yazılır; eski kayıtta yoksa açık, hareketi azalt kapalı başlar', () => {
    useStore.getState().setHaptics(false); useStore.getState().setReduceMotion(true);
    const saved = useStore.persist.getOptions().partialize!(useStore.getState()) as { haptics?: boolean; reduceMotion?: boolean };
    expect(saved).toMatchObject({ haptics: false, reduceMotion: true });
    const merge = useStore.persist.getOptions().merge!;
    expect(merge({}, useStore.getState())).toMatchObject({ haptics: true, reduceMotion: false });
    expect(merge({ haptics: false, reduceMotion: true }, useStore.getState())).toMatchObject({ haptics: false, reduceMotion: true });
    useStore.getState().setHaptics(true); useStore.getState().setReduceMotion(false);
  });
});

describe('Hareketi azalt (store.reduceMotion)', () => {
  it('oyun içi ayar, sistem tercihi kapalıyken de prefersReducedMotion\'ı açar', () => {
    expect(prefersReducedMotion()).toBe(false);
    useStore.getState().setReduceMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    useStore.getState().setReduceMotion(false);
    expect(prefersReducedMotion()).toBe(false);
  });
});
