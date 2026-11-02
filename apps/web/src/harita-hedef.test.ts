// Haritanın "Sıradaki hedef"i (OT-ilk-kez-oyun-13): tek hedef, ulaşılana kadar aynı; ulaşılan aşama bir kez söylenir.
import { describe, expect, it } from 'vitest';
import { BIOMES, HUMAN_JOURNEY } from '@odi/content';
import { mapGoal, pickGoal, returnCelebrations } from './map/goals';

/** ilk n bölüm geçilmiş (her biri k yıldız) */
const upTo = (n: number, k = 2): Record<number, number> => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, k]));

describe('pickGoal', () => {
  it('en yakın bölüm hedefi seçilir ve her bölümle bir yaklaşır', () => {
    // bölüm 1 açık: Dış Kulak (1-5) 3. bölümde çiçeklenir; hazine 5'te
    expect(pickGoal({})).toMatchObject({ key: 'b:dis-kulak:2', left: 3 });
    expect(pickGoal(upTo(1))).toMatchObject({ key: 'b:dis-kulak:2', left: 2 });
    expect(pickGoal(upTo(2))).toMatchObject({ key: 'b:dis-kulak:2', left: 1 });
    // çiçeklendi: sıradaki 5. bölüm (hazine + Dış Kulak canlanır, birlikte)
    expect(pickGoal(upTo(3))).toMatchObject({ key: 't:5+b:dis-kulak:3', left: 2 });
  });

  it('hedef ulaşılana kadar değişmez (bölüm bölüm yolculuk boyunca)', () => {
    const total = HUMAN_JOURNEY.levels.length;
    let prev = pickGoal({})!;
    for (let n = 1; n < total; n++) {
      const g = pickGoal(upTo(n))!;
      // ya aynı hedef bir bölüm yaklaştı ya da önceki hedef bu bölümde gerçekleşti (left 1 idi)
      if (g.key === prev.key) expect(g.left).toBe(prev.left - 1);
      else expect(prev.left).toBe(1);
      expect(g.left).toBeGreaterThanOrEqual(1);
      prev = g;
    }
  });

  it('bölgenin bölümleri ardışık değilse gerçek bölüm sayısı söylenir', () => {
    // Kulak Kanalı 6,7,8,17,20: 16 geçilmişken kanal 17'yi bitirince değil 20'yi bitirince canlanır (4 bölüm sonra);
    // Kemikçikler (13-16,18,19) 19'da canlanır: en yakın olan o (17, 18, 19: 3 bölüm sonra)
    expect(pickGoal(upTo(16))).toMatchObject({ key: 'b:kemikcikler:3', left: 3 });
  });

  it('yolculuk bitince yıldız hedefi, hepsi tamamsa taç', () => {
    const total = HUMAN_JOURNEY.levels.length;
    expect(pickGoal(upTo(total, 2))).toMatchObject({ stars: { n: expect.any(Number) } });
    expect(pickGoal(upTo(total, 3))).toMatchObject({ key: 'son' });
  });
});

describe('mapGoal', () => {
  it('ilk açılış ve aynı hedef: yalnız hedef', () => {
    expect(mapGoal(upTo(1), null)).toEqual({ icon: '🌱', text: '2 bölüm sonra Dış Kulak çiçeklenir' });
    expect(mapGoal(upTo(2), upTo(1)).text).toBe('Bölüm 3 bitince Dış Kulak çiçeklenir');
  });

  it('ulaşılan aşama bir kez söylenir; sıradaki hedef yine yer adını söyler', () => {
    // Kulak Zarı 9-12: 10'da çiçeklenir (hazine de 10'da), 12'de canlanır
    const g = mapGoal(upTo(10), upTo(9));
    expect(g.small).toBe('Hedefe ulaştın!');
    expect(g.text).toBe('Hazine açıldı, Kulak Zarı çiçeklendi! Sıradaki: 2 bölüm sonra Kulak Zarı canlanır');
    // haritaya bir sonraki gelişte (gösterilen durum güncel) yalnız hedef
    expect(mapGoal(upTo(10), upTo(10))).toEqual({ icon: '🌟', text: '2 bölüm sonra Kulak Zarı canlanır' });
  });

  it('birlikte gerçekleşen hazine ve aşama tek cümlede, doğru bağlaçla', () => {
    expect(mapGoal(upTo(9), null).text).toBe('Bölüm 10 bitince hazine! Kulak Zarı da çiçeklenir.');
  });

  it('her durumda yer adı ve (sıradaki bölümse) bölüm numarası yazar (OT-sinav-adayi-24)', () => {
    const total = HUMAN_JOURNEY.levels.length;
    for (let n = 0; n < total; n++) {
      for (const before of [null, upTo(Math.max(0, n - 1)), upTo(Math.max(0, n - 3))]) {
        const g = mapGoal(upTo(n), before); const pick = pickGoal(upTo(n), undefined, before ? pickGoal(before) : null)!;
        // "Sıradaki: …" kısmı (ulaşılan hedefin cümlesi ayrı) her zaman neyin olacağını söyler
        const next = g.text.split('Sıradaki: ').pop()!;
        expect(next).not.toMatch(/Bu bölüm/);
        if (pick.biome) expect(next).toContain(`${BIOMES[pick.biome.id].name} `);
        else if (pick.treasure) expect(next).toMatch(/hazine/);
        if (pick.left === 1 && (pick.biome || pick.treasure)) expect(next).toMatch(new RegExp(`^Bölüm ${n + 1} bitince `));
      }
    }
    // tur 5 kanıtı (İşitme Siniri 31-33): 32 geçildi, sinir çiçeklendi; sıradaki 33. bölümde canlanır
    expect(HUMAN_JOURNEY.levels.filter((l) => l.biome === 'sinir').map((l) => l.number)).toEqual([31, 32, 33]);
    expect(mapGoal(upTo(32), upTo(31)).text).toBe('İşitme Siniri çiçeklendi! Sıradaki: Bölüm 33 bitince İşitme Siniri canlanır');
  });
});

describe('yıldız hedefi (yolculuk bitti)', () => {
  it('başka bölgeden gelen yıldız hedefi değiştirmez; ulaşılmayan hedef "ulaştın" diye söylenmez', () => {
    const total = HUMAN_JOURNEY.levels.length;
    const all2 = upTo(total, 2);
    const first = pickGoal(all2)!; expect(first.stars).toBeDefined();
    // başka bölgede (İşitme Korteksi 37-40) yıldızlar artınca o bölge daha yakın olur; yine de hedef aynı kalır
    expect(first.stars!.id).not.toBe('korteks');
    const other = { ...all2, 37: 3, 38: 3, 39: 3 };
    expect(pickGoal(other)!.stars!.id).toBe('korteks');
    const g = mapGoal(other, all2);
    expect(g.small).toBeUndefined();
    expect(g.text).toBe(`${first.stars!.n} yıldız daha: ${BIOMES[first.stars!.id].name} ışıl ışıl olur`);
  });
});

describe('dönüş kutlamaları (returnCelebrations)', () => {
  it('tek bölüm: en çok hazine + canlanma; art arda bölümler: hepsi sayılır, kutlanmış bölge sayılmaz', () => {
    expect(returnCelebrations(upTo(3, 3), upTo(4, 3), [])).toBe(0);
    // 5. bölüm: hazine + Dış Kulak canlanır
    expect(returnCelebrations(upTo(4, 3), upTo(5, 3), [])).toBe(2);
    expect(returnCelebrations(upTo(4, 3), upTo(5, 3), ['dis-kulak'])).toBe(1);
    // 1-10 birden: iki hazine ve en az bir canlanma → üç ya da daha çok (tek pencere)
    expect(returnCelebrations({}, upTo(10, 3), [])).toBeGreaterThanOrEqual(3);
  });
});
