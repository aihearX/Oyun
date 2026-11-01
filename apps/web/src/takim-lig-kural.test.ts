// Takım Ligi kuralı (OT-rekabetci-18): sunucunun yükselme kuralıyla aynı cümle; yükselme yoksa "İlk – takım" yerine açık cümle.
import { describe, expect, it } from 'vitest';
import { moveRule } from './teamrace/TeamRace';

describe('Takım Ligi yükselme cümlesi', () => {
  it('grupta tek ya da iki takım: yükselme yok, nedeni yazılı; boşluk/tire hatası yok', () => {
    for (const n of [1, 2]) {
      const t = moveRule('bronz', n, 0, 0);
      expect(t).toContain(n === 1 ? 'Grupta şimdilik yalnız takımınız var' : 'Grupta şimdilik 2 takım var');
      expect(t).toContain('grupta en az 3 takım olunca');
      expect(t).not.toMatch(/–| \.|İlk 0/);
    }
  });
  it('yükselme ve düşme varsa sayılar; Koklea en üst kademe', () => {
    expect(moveRule('gumus', 8, 3, 3)).toBe('İlk 3 takım (puanı 0 değilse) bir üst kademeye çıkar. Son 3 takım bir alt kademeye iner.');
    expect(moveRule('bronz', 4, 1, 0)).toBe('İlk 1 takım (puanı 0 değilse) bir üst kademeye çıkar.');
    expect(moveRule('koklea', 6, 0, 3)).toBe('Koklea en üst kademe: buradan yükselme yok. Son 3 takım bir alt kademeye iner.');
  });
});
