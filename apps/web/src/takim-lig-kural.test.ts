// Takım Ligi kuralı (OT-rekabetci-18): sunucunun yükselme kuralıyla aynı cümle; yükselme yoksa "İlk – takım" yerine açık cümle.
import { describe, expect, it } from 'vitest';
import { moveRule, rewardRule, weekLine } from './teamrace/TeamRace';

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

describe('Takım Ligi sezon dökümü ve ödül cümlesi (OT-rekabetci-26, 27)', () => {
  const w = (war: number, warRaw: number) => ({ war, raid: 0, quiz: 0, warRaw, raidRaw: 0 });
  it('2. haftada: 1. hafta + bu hafta (ham savaş puanıyla)', () => {
    expect(weekLine('war', [w(46, 4650), w(7, 792)], 1)).toBe('Bu sezon (2 hafta): 1. hafta 46 + bu hafta 7 (792 savaş puanı)');
  });
  it('1. haftada: yalnız bu hafta; eski sunucu dökümü göndermezse satır yok', () => {
    expect(weekLine('war', [w(7, 792), w(0, 0)], 0)).toBe('Bu sezon (2 hafta): 1. hafta (bu hafta) 7 (792 savaş puanı)');
    expect(weekLine('quiz', [{ war: 0, raid: 0, quiz: 12, warRaw: 0, raidRaw: 0 }, w(0, 0)], 1)).toBe('Bu sezon (2 hafta): 1. hafta 12 + bu hafta 0');
    expect(weekLine('war', undefined, undefined)).toBeNull();
  });
  it('ödül: çarpanlar okunur, kademe örneği gerçek tutarla, Bronz 3. sıra yuvarlaması yazılı', () => {
    const t = rewardRule('bronz');
    expect(t).toContain('1. takım taban ×3, 2. ×2, 3. ×1,5, diğer puanlı takımlar ×1');
    expect(t).toContain('Bronz kademesinde: 1. takım 15, 2. 10, 3. 8 (7,5 → 8), diğerleri 5 kristal');
    expect(t).toContain('Bronz 5, Gümüş 8, Altın 12, Platin 16, Koklea 20');
    expect(rewardRule('gumus')).toContain('Gümüş kademesinde: 1. takım 24, 2. 16, 3. 12, diğerleri 8 kristal');
  });
});
