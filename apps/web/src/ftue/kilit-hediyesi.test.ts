import { describe, expect, it } from 'vitest';
import { FEATURES, FRESH_FTUE, giftOpen, isOpen, levelCapOf, normalizeFtue, reachCleared, type FtueState } from './features';
import { hediyeUnlockQueue, mapIntroQueue, unlockIntroPending } from './map-intro';

/**
 * 1.2.0: "her şey açık" modu ve yöneticinin kilit hediyesi istemcide aynı kapılardan geçer (isOpen, store.highestUnlocked → levelCapOf).
 * Hediyeyle açılan yerin tanıtımı haritada gelir ama bölüm kapısını tutmaz; gerçek ilerleme (clearedCount) değişmez.
 */
const st = (o: Partial<FtueState> = {}): FtueState => ({ ...FRESH_FTUE, story: true, tours: ['result1', 'map'], ...o });

describe('kilit hediyesi ve her şey açık (istemci kapıları)', () => {
  it('her şey açık modu her yeri ve bütün bölümleri açar', () => {
    const f = st({ admin: true });
    for (const x of FEATURES) expect(isOpen(x.id, 0, f), x.id).toBe(true);
    expect(levelCapOf(1, f)).toBe(40);
    expect(reachCleared(0, f)).toBe(40);
  });
  it('hediye yalnız seçilen yerleri açar; "hepsi" hepsini; bölüm sınırı gerçek ilerlemeyi geçmez ama oynatır', () => {
    const f = st({ acik: { levels: 12, features: ['friends', 'yazi'] } });
    expect(isOpen('friends', 0, f)).toBe(true);
    expect(isOpen('yazi', 0, f)).toBe(true);
    expect(isOpen('team', 0, f)).toBe(false);
    expect(isOpen('team', 5, f)).toBe(true); // ilerlemeyle açılma aynen
    expect(levelCapOf(3, f)).toBe(12);
    expect(levelCapOf(20, f)).toBe(20);
    expect(reachCleared(2, f)).toBe(11);
    const hepsi = st({ acik: { levels: 0, features: ['hepsi'] } });
    for (const x of FEATURES) expect(giftOpen(x.id, hepsi), x.id).toBe(true);
    expect(levelCapOf(1, hepsi)).toBe(1);
  });
  it('hediye tanıtımları haritada sırayla, bölüm kapısını tutmaz; serbest yazı tanıtımı (Sekiz bölümü geçtin) hediyede söylenmez', () => {
    const f = st({ acik: { levels: 0, features: ['friends', 'team', 'yazi'] } });
    expect(hediyeUnlockQueue(1, f)).toEqual(['friends', 'team']);
    expect(unlockIntroPending(1, f)).toBe(false);
    expect(mapIntroQueue(1, f)).toEqual([]);
    // anlatılan (ya da atlanan) gelmez; ilerlemeyle açıldığında da yeniden gelmez
    const g = st({ acik: f.acik, tours: ['result1', 'map', 'friends', 'team'] });
    expect(hediyeUnlockQueue(1, g)).toEqual([]);
    expect(mapIntroQueue(5, g)).not.toContain('friends');
    // hikâye görülmeden, test atlamasında ve her şey açık modunda yok
    expect(hediyeUnlockQueue(1, { ...f, story: false })).toEqual([]);
    expect(hediyeUnlockQueue(1, { ...f, admin: true })).toEqual([]);
  });
  it('kayıttan okunurken hediye korunur, bozuk değer atılır', () => {
    expect(normalizeFtue({ v: 1, story: true, tours: [], acik: { levels: 7, features: ['camp'] } }, {}).acik).toEqual({ levels: 7, features: ['camp'] });
    expect(normalizeFtue({ v: 1, story: true, tours: [], acik: { levels: 'x' } }, {}).acik).toBeUndefined();
  });
});
