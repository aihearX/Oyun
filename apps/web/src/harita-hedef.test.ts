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
    expect(g.text).toBe('Hazine açıldı, Kulak Zarı çiçeklendi! Sıradaki: 2 bölüm sonra Kulak Zarı canlanır: Kemikçikler açılır');
    // haritaya bir sonraki gelişte (gösterilen durum güncel) yalnız hedef
    expect(mapGoal(upTo(10), upTo(10))).toEqual({ icon: '🌟', text: '2 bölüm sonra Kulak Zarı canlanır: Kemikçikler açılır' });
  });

  it('birlikte gerçekleşen hazine ve aşama tek cümlede, doğru bağlaçla', () => {
    expect(mapGoal(upTo(9), null).text).toBe('Bölüm 10 bitince hazine! Kulak Zarı da çiçeklenir.');
  });

  it('canlanmanın getirdiği tek sözle: son bölümden sonra açılan yeni bölge ya da bölgenin tamamlanması (OT-ogrenci-birinci-30)', () => {
    // 3. bölümden sonra (tur 8 kanıtı): 5. bölüm bitince Dış Kulak canlanır ve 6. bölümle Kulak Kanalı açılır
    expect(mapGoal(upTo(3), upTo(2)).text).toBe('Dış Kulak çiçeklendi! Sıradaki: 2 bölüm sonra hazine! Dış Kulak da canlanır: Kulak Kanalı açılır.');
    // Kemikçikler 19'da canlanır; 20. bölüm Kulak Kanalı'nın (zaten açık): yeni bölge vaadi yok
    expect(mapGoal(upTo(16), null).text).toBe('3 bölüm sonra Kemikçikler canlanır: bölge tamamlanır');
    // her canlanma hedefi: "açılır" dediği bölge gerçekten o bölümden sonra ilk kez açılan bölge
    const levels = HUMAN_JOURNEY.levels;
    for (let n = 0; n < levels.length; n++) {
      const pick = pickGoal(upTo(n)); if (pick?.biome?.to !== 3) continue;
      const m = /canlanır: (.+) açılır/.exec(mapGoal(upTo(n), null).text); if (!m) continue;
      const next = levels.find((l) => l.number === pick.level! + 1)!;
      expect(BIOMES[next.biome].name).toBe(m[1]);
      expect(levels.find((l) => l.biome === next.biome)!.number).toBe(next.number);
    }
  });

  it('her durumda yer adı ve (sıradaki bölümse) bölüm numarası yazar (OT-sinav-adayi-24)', () => {
    const total = HUMAN_JOURNEY.levels.length;
    for (let n = 0; n < total; n++) {
      for (const before of [null, upTo(Math.max(0, n - 1)), upTo(Math.max(0, n - 3))]) {
        const g = mapGoal(upTo(n), before); const pick = pickGoal(upTo(n), undefined, before ? pickGoal(before) : null)!;
        // "Sıradaki: …" kısmı (ulaşılan hedefin cümlesi ayrı) her zaman neyin olacağını söyler
        const next = g.text.split('Sıradaki: ').pop()!;
        expect(next).not.toMatch(/Bu bölüm/);
        if (pick.biome) expect(next).toMatch(new RegExp(`${BIOMES[pick.biome.id].name}( |'na )`));
        else if (pick.treasure) expect(next).toMatch(/hazine/);
        // geri dönülen bölümde (YN-195, YN-241) önce bölüm ve ne yapılacağı: "Bölüm 20 · Kulak Kanalı'na dön, …. Bitince …" ("Hedefe
        // ulaştın!" anında yalnız ne yapılacağı)
        if (pick.left === 1 && (pick.biome || pick.treasure)) expect(next).toMatch(new RegExp(HUMAN_JOURNEY.levels[n]!.back ? `^Bölüm ${n + 1} · .+\\.(${g.small ? '$' : ' Bitince '})` : `^Bölüm ${n + 1} bitince `));
      }
    }
    // tur 5 kanıtı (İşitme Siniri 31-33): 32 geçildi, sinir çiçeklendi; sıradaki 33. bölümde canlanır
    expect(HUMAN_JOURNEY.levels.filter((l) => l.biome === 'sinir').map((l) => l.number)).toEqual([31, 32, 33]);
    expect(mapGoal(upTo(32), upTo(31)).text).toBe('İşitme Siniri çiçeklendi! Sıradaki: Bölüm 33 bitince İşitme Siniri canlanır: Beyin Sapı açılır');
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

describe('yolculuğun bitişi (YN-241, OT-sessiz-oyuncu-33)', () => {
  it('40. bölüm ilk kez geçilince kutu "Sıradaki" yıldız hedefini öne çıkarmaz, alta yerleşir (final); sonra yıldız hedefi', () => {
    const total = HUMAN_JOURNEY.levels.length;
    const g = mapGoal(upTo(total), upTo(total - 1));
    expect(g.final).toBe(true); expect(g.small).toBe('Hedefe ulaştın!');
    expect(g.text).not.toMatch(/Sıradaki|yıldız daha/); expect(g.text).toMatch(/Ninni beyne ulaştı!$/);
    // kutu kapandıktan sonra (gösterilen durum güncel) her zamanki yıldız hedefi, final değil
    const after = mapGoal(upTo(total), upTo(total));
    expect(after.final).toBeUndefined(); expect(after.text).toMatch(/yıldız daha: .+ ışıl ışıl olur$/);
    // yolculuk zaten bitmişken ulaşılan yıldız hedefi final sayılmaz
    expect(mapGoal({ ...upTo(total), 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 }, upTo(total)).final).toBeUndefined();
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

// YN-195 (OT-uzman-odyolog-35): Kemikçikler'den sonra yol Bölüm 20'de dış kulak yoluna (Serumen Golemi) geri döner; hedef kartı
// ve bölümün giriş yazısı bunu söyler, serumen zarın ötesinde sanılmasın. Bölüm dizilimi değişmez.
describe('Serumen Golemi: geri dönüş', () => {
  it('Kemikçikler canlanınca hedef geri dönüşü ve Koklea\'yı söyler; düğme gibi okunan "Geri dön" yok (YN-241)', () => {
    const g = mapGoal(upTo(19), upTo(18));
    expect(g.small).toBe('Hedefe ulaştın!');
    // "Hedefe ulaştın!" anında yalnız ne yapılacağı (kutu 320 px'te de üç satır); ödül kutu sıradaki hedefe dönünce
    expect(g.text).toBe("Kemikçikler canlandı! Sıradaki: Bölüm 20 · Kulak Kanalı'na dön, kanalı tıkayan Serumen Golemi'ni temizle.");
    expect(mapGoal(upTo(19), upTo(19)).text).toBe("Bölüm 20 · Kulak Kanalı'na dön, kanalı tıkayan Serumen Golemi'ni temizle. Bitince hazine ve yeni bölge: Koklea.");
    // geri dönüş yalnız sıradaki bölümse söylenir (daha uzaktaki hedef "N bölüm sonra" kalır)
    expect(mapGoal(upTo(16), null).text).not.toMatch(/Kulak Kanalı'na dön|Geri dön/);
    for (let n = 0; n <= 40; n++) expect(mapGoal(upTo(n), n ? upTo(n - 1) : null).text).not.toMatch(/Geri dön/);
    // "yeni bölge" gerçekten 20'den sonra ilk kez açılan bölge (21: Koklea · Taban)
    expect(HUMAN_JOURNEY.levels[20]!.biome).toBe('koklea-1'); expect(HUMAN_JOURNEY.levels.findIndex((l) => l.biome === 'koklea-1')).toBe(20);
  });
  it('bölüm dizilimi aynı; 20. bölümün girişi dış kulak yolunu ve zarın dışını söyler', () => {
    const l20 = HUMAN_JOURNEY.levels.find((l) => l.number === 20)!;
    expect([l20.biome, l20.mechanic, l20.boss]).toEqual(['kanal', 'boss', 'serumen-golemi']);
    expect(HUMAN_JOURNEY.levels.slice(12, 19).map((l) => l.biome)).toEqual(['kemikcikler', 'kemikcikler', 'kemikcikler', 'kemikcikler', 'kanal', 'kemikcikler', 'kemikcikler']);
    expect(l20.intro).toBe('Dış kulak yoluna geri dön: zarın dışında serumenden bir dev kanalı tıkıyor.');
    expect(HUMAN_JOURNEY.levels.filter((l) => l.back).map((l) => l.number)).toEqual([20]);
    for (const l of HUMAN_JOURNEY.levels) expect(`${l.intro ?? ''} ${l.back ?? ''}`).not.toMatch(/Salyangoz/i);
  });
});
