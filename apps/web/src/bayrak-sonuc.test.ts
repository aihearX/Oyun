import { describe, expect, it } from 'vitest';
import { DELETED_PLAYER_NAME } from '@odi/shared';
import { fmtSecs, relayRunText } from './events/bayrak';
import { afterText } from './ftue/features';

describe('Bayrak sonucu (YN-160, OT-buyuk-yazi-48, OT-rekabetci-40)', () => {
  it('rekor kırılmadıysa önce senin koşun, sonra rekor ve fark; süreler tek ondalıklı; parkurda rekor kalır', () => {
    expect(relayRunText(47.1, false, { name: DELETED_PLAYER_NAME, timeSec: 46.9 }))
      .toBe('Senin koşun 47,1 sn · rekor 46,9 sn (hesabı silinmiş bir oyuncu): 0,2 sn farkla geçemedin. Parkurda rekor süre sayılıyor.');
    expect(relayRunText(83, false, { name: 'Ayşe', timeSec: 72.7 }))
      .toBe('Senin koşun 83,0 sn · rekor 72,7 sn (Ayşe): 10,3 sn farkla geçemedin. Parkurda rekor süre sayılıyor.');
    expect(relayRunText(83, false, { name: 'Ayşe', timeSec: 72.7 })).not.toMatch(/kala|sayılmaya/);
  });
  it('eşitlik aynı dilde: rekora eşit, geçemedin', () => {
    expect(relayRunText(50, false, { name: 'Bora', timeSec: 50 }))
      .toBe('Senin koşun 50,0 sn · rekor 50,0 sn (Bora): rekora eşit, geçemedin (eşit süre rekoru geçmez). Parkurda rekor süre sayılıyor.');
    // ekranda aynı yazan süreler (50,04 ve 50,0) eşit sayılır, "0,0 sn farkla" denmez
    expect(relayRunText(50.04, false, { name: 'Bora', timeSec: 50 })).toContain('rekora eşit');
  });
  it('rekor kırıldıysa parkura bu süre sayılır', () => {
    expect(relayRunText(45, true, { name: 'Ayşe', timeSec: 45 })).toBe('Ayağın en iyi süresi senin: parkura bu süre sayılır.');
  });
  it('süre biçimi hep tek ondalıklı', () => {
    expect(fmtSecs(83)).toBe('83,0 sn'); expect(fmtSecs(281.94)).toBe('281,9 sn'); expect(fmtSecs(0.25)).toBe('0,3 sn');
  });
});

describe('kilit cümlesi (YN-161)', () => {
  it('ayrılma eki: Bölüm 7\'den sonra', () => { expect(afterText('events')).toBe("Bölüm 7'den sonra"); expect(afterText('team')).toBe("Bölüm 5'ten sonra"); });
});
