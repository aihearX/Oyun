import { describe, expect, it } from 'vitest';
import { FEATURES, veteranTours } from './features';
import { CAMP_TOURS, MAX_UNLOCK_TOURS_PER_LEVEL, countUnlockTour, mapIntroPending, mapIntroQueue, mapIntroView, tourShortName, type UnlockTally } from './map-intro';

/**
 * Sahip isteği 2026-10-31 (YN-066): bölüm geçilince yeni bir yer açıldıysa ya da Tüy Dede'nin haritada anlatacağı bir şey
 * varsa sonuç ekranı "Sonraki" yerine haritaya götürür. Karar tek yerde: mapIntroQueue (Yönetmen de aynı kuyruğu kullanır).
 */
const fresh = (): UnlockTally => ({ cleared: -1, genel: 0, kamp: 0 });
const ftue = (tours: string[], extra: { bypass?: boolean; admin?: boolean } = {}) => ({ tours, ...extra });
/** n bölüme kadar açılmış her şeyi görmüş oyuncu */
const seenUpTo = (n: number) => veteranTours(n);

describe('haritada bekleyen tanıtım (mapIntroQueue)', () => {
  it('1. bölümden sonra harita turu bekler; hiç bölüm geçilmediyse bir şey yok', () => {
    expect(mapIntroQueue(1, ftue(['result1']), fresh())).toEqual(['map']);
    expect(mapIntroQueue(0, ftue([]), fresh())).toEqual([]);
  });

  it('açılım bölümleri: Bugün (2), Kamp (3), Arkadaşlar + Sözlük (4), Takım + Sıralama (5)', () => {
    expect(mapIntroQueue(2, ftue(seenUpTo(1)), fresh())).toEqual(['today']);
    expect(mapIntroQueue(3, ftue(seenUpTo(2)), fresh())).toEqual(['camp']);
    expect(mapIntroQueue(4, ftue(seenUpTo(3)), fresh())).toEqual(['friends', 'glossary']);
    expect(mapIntroQueue(5, ftue(seenUpTo(4)), fresh())).toEqual(['team', 'siralama']);
  });

  it('eski bölümü tekrar oynayan (her şeyi görmüş) oyuncuda bekleyen yok → normal Sonraki', () => {
    for (const n of [1, 3, 5, 8, 12, 40]) expect(mapIntroPending(n, ftue(seenUpTo(n)), fresh())).toBe(false);
  });

  it('test atlaması ve yönetici kipinde tur yok', () => {
    expect(mapIntroQueue(3, ftue([], { bypass: true }), fresh())).toEqual([]);
    expect(mapIntroQueue(3, ftue([], { admin: true }), fresh())).toEqual([]);
  });

  it('bölüm başına sınır: bu geçişte sınır dolduysa kalan tur bir sonraki bölüme kalır (haritada başlamayacak şey için yönlendirme yok)', () => {
    const t = fresh();
    expect(mapIntroQueue(6, ftue(seenUpTo(5)), t)).toEqual(['tlig', 'shop']);
    expect(MAX_UNLOCK_TOURS_PER_LEVEL).toBe(2);
    countUnlockTour('tlig', 6, t); countUnlockTour('shop', 6, t);
    const after6 = [...seenUpTo(5), 'tlig', 'shop'];
    expect(mapIntroQueue(6, ftue(after6), t)).toEqual([]); // akis bekliyor ama bu geçişte başlamaz
    expect(mapIntroQueue(7, ftue(after6), t)).toEqual(['events', 'akis']); // yeni geçiş: sayaç sıfırlanır
  });

  it('kamp turları (Görevler, oyunlar, vakalar) haritada başlamaz: sonuç ekranını yönlendirmez', () => {
    const genelSeen = seenUpTo(7).filter((id) => !CAMP_TOURS.has(id));
    expect(genelSeen).not.toContain('gorev');
    expect(mapIntroQueue(7, ftue(genelSeen), fresh())).toEqual([]);
    countUnlockTour('gorev', 4, fresh()); // kamp sayacı genel sırayı etkilemez
    const t = fresh(); countUnlockTour('gorev', 4, t); countUnlockTour('kampoyun', 4, t);
    expect(mapIntroQueue(4, ftue(seenUpTo(3)), t)).toEqual(['friends', 'glossary']);
  });
});

describe('sonuç ekranındaki satır ve düğme (mapIntroView)', () => {
  it('boş kuyrukta görünüm yok', () => { expect(mapIntroView([])).toBeNull(); });
  it('harita turu: "Haritaya git"', () => {
    expect(mapIntroView(['map'])).toMatchObject({ button: 'Haritaya git', art: 'map' });
  });
  it('açılım: "Yeni: Kamp", "Haritaya dön"; iki açılım "ve" ile', () => {
    expect(mapIntroView(['camp'])).toEqual({ art: 'tent', title: 'Yeni: Kamp', note: 'Tüy Dede haritada anlatacak.', button: 'Haritaya dön' });
    expect(mapIntroView(['friends', 'glossary'])?.title).toBe('Yeni: Arkadaşlar ve Kulak Sözlüğü');
  });
  it('kısa adlar dar ekrana sığar ve emoji içermez', () => {
    for (const f of FEATURES.filter((x) => x.tour && !CAMP_TOURS.has(x.id))) {
      const name = tourShortName(f.id);
      expect(name.length, f.id).toBeLessThanOrEqual(16);
      expect(/\p{Extended_Pictographic}/u.test(name), f.id).toBe(false);
    }
  });
});
