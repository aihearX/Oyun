import { describe, expect, it } from 'vitest';
import { DELETED_PLAYER_NAME } from '@odi/shared';
import { relayRunText } from './events/bayrak';
import { afterText } from './ftue/features';

describe('Bayrak sonucu (YN-160, OT-buyuk-yazi-48)', () => {
  it('rekor kırılmadıysa rekorla karşılaştırır, parkurda rekor kalır', () => {
    expect(relayRunText(47.1, false, { name: DELETED_PLAYER_NAME, timeSec: 46.9 }))
      .toBe('Rekor 46,9 sn (hesabı silinmiş bir oyuncu) · senin koşun 47,1 sn: 0,2 sn kala geçemedin. Parkura rekor sayılmaya devam ediyor.');
    expect(relayRunText(50, false, { name: 'Bora', timeSec: 50 })).toContain('rekora eşit');
  });
  it('rekor kırıldıysa parkura bu süre sayılır', () => {
    expect(relayRunText(45, true, { name: 'Ayşe', timeSec: 45 })).toBe('Ayağın en iyi süresi senin: parkura bu süre sayılır.');
  });
});

describe('kilit cümlesi (YN-161)', () => {
  it('ayrılma eki: Bölüm 7\'den sonra', () => { expect(afterText('events')).toBe("Bölüm 7'den sonra"); expect(afterText('team')).toBe("Bölüm 5'ten sonra"); });
});
