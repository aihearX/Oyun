import { describe, expect, it } from 'vitest';
import { migrateVoiceVol, useStore } from './store';

/** MK-023: anlatıcının kendi düzeyi. Eski kayıtta yok → oyuncunun o güne kadar duyduğu düzey (efekt düzeyi, en az 0,2). */
describe('Anlatıcı ses düzeyi (store.voiceVol)', () => {
  it('eski kayıt: efekt düzeyinden türetilir, kimsenin duyduğu değişmez', () => {
    expect(migrateVoiceVol({ sfxVol: 0.9 })).toBe(0.9);
    expect(migrateVoiceVol({ sfxVol: 0.55 })).toBe(0.55);
    expect(migrateVoiceVol({ sfxVol: 0.05 })).toBe(0.2); // speakLine eskiden 0,2'nin altına inmezdi
    expect(migrateVoiceVol({ sfxVol: 0 })).toBe(0.2);
    expect(migrateVoiceVol({})).toBe(0.9); // hiç ayar yok: varsayılan efekt 0,9
    expect(migrateVoiceVol({ sfxVol: 'x' })).toBe(0.9);
  });
  it('kayıtlı değer korunur (sınırlanarak); efekt değişse de etkilenmez', () => {
    expect(migrateVoiceVol({ voiceVol: 0.4, sfxVol: 0.9 })).toBe(0.4);
    expect(migrateVoiceVol({ voiceVol: 0, sfxVol: 0.9 })).toBe(0);
    expect(migrateVoiceVol({ voiceVol: 3 })).toBe(1);
    expect(migrateVoiceVol({ voiceVol: Number.NaN, sfxVol: 0.5 })).toBe(0.5);
  });
  it('yeni oyuncu varsayılanı bugünkü etkin düzey (0,9); kaydırıcı ayrı ve kalıcı alan', () => {
    const s = useStore.getState();
    expect(s.voiceVol).toBe(0.9);
    s.setVolumes({ voiceVol: 0.35 });
    expect(useStore.getState()).toMatchObject({ voiceVol: 0.35, sfxVol: 0.9 });
    s.setVolumes({ sfxVol: 0.2 });
    expect(useStore.getState().voiceVol).toBe(0.35);
    const saved = useStore.persist.getOptions().partialize!(useStore.getState()) as { voiceVol?: number };
    expect(saved.voiceVol).toBe(0.35);
  });
  it('yükleme (merge): voiceVol olmayan kayıt efekt düzeyinden alır', () => {
    const merge = useStore.persist.getOptions().merge!;
    expect((merge({ sfxVol: 0.4 }, useStore.getState()) as { voiceVol: number }).voiceVol).toBe(0.4);
    expect((merge({ sfxVol: 0.4, voiceVol: 0.8 }, useStore.getState()) as { voiceVol: number }).voiceVol).toBe(0.8);
  });
});
