import { describe, expect, it } from 'vitest';
import { FEATURES, veteranTours } from './features';
import { pickGoal } from '../map/goals';
import { CAMP_TOURS, MAX_UNLOCK_TOURS_PER_LEVEL, countUnlockTour, mapIntroPending, mapIntroQueue, mapIntroView, mapRevealPending, tourShortName, type UnlockTally } from './map-intro';

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

/**
 * YN-114 (OT-ilk-kez-oyun-34): bölge sonu (canavar) ya da hazine bölümü ilk kez geçilince haritanın dönüş sahnesinde canlanma /
 * sandık bekler; sonuç ekranı "Sonraki" yerine "Haritaya dön" der. Eski bölüm tekrarında (görülmüş) Sonraki kalır.
 */
describe('haritada bekleyen kutlama (mapRevealPending)', () => {
  /** 1..n-1 iki yıldızla geçilmiş (harita bunları göstermiş); `now`: n de geçildi */
  const upTo = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 2])) as Record<number, number>;
  const restoredBefore = (n: number) => { const r: string[] = []; for (let k = 1; k < n; k++) { const x = mapRevealPending(upTo(k - 1), upTo(k), r); if (x) r.push(...x.zones); } return r; };
  it('Golem (20) ilk geçiş: Kulak Kanalı canlanır ve hazine açılır → "Haritaya dön" ve satır', () => {
    const r = mapRevealPending(upTo(19), upTo(20), restoredBefore(20));
    expect(r?.zones).toContain('kanal'); expect(r?.treasures).toEqual([20]);
    const v = mapIntroView([], r)!;
    expect(v.button).toBe('Haritaya dön'); expect(v.title).toBe('Kulak Kanalı haritada canlanacak.'); expect(v.note).toBe('Hazine sandığını da orada göreceksin.');
  });
  it('Gürültü Canavarı (40) ilk geçiş: bölge sonu kutlaması bekler', () => {
    const r = mapRevealPending(upTo(39), upTo(40), restoredBefore(40));
    expect(r).toEqual({ zones: ['korteks', 'finale'], grows: [], treasures: [40] });
    expect(mapIntroView([], r)).toMatchObject({ title: 'İşitme Korteksi haritada canlanacak.', note: 'Ninni Merkezi de ışıl ışıl yanacak. Hazine sandığını da orada göreceksin.', button: 'Haritaya dön' });
  });
  it('hazine ve çiçeklenme (10): başlık çiçeklenme, sandık notta; yalnız sandık bekliyorsa sandık satırı; tanıtım da bekliyorsa Tüy Dede de söylenir', () => {
    const r = mapRevealPending(upTo(9), upTo(10), restoredBefore(10));
    expect(r).toEqual({ zones: [], grows: [{ zone: 'zar', to: 2 }], treasures: [10] });
    expect(mapIntroView([], r)).toMatchObject({ art: 'sprout', title: 'Kulak Zarı haritada çiçeklenecek.', note: 'Hazine sandığını da orada göreceksin.' });
    const chest = { zones: [], grows: [], treasures: [10] };
    expect(mapIntroView([], chest)).toMatchObject({ art: 'chest', title: 'Hazine sandığını haritada göreceksin.', note: 'Sıradaki bölüm haritadan.' });
    expect(mapIntroView(['events'], chest)?.note).toBe('Tüy Dede de anlatacak: Etkinlikler.');
    // 5. bölüm: Dış Kulak canlanır, sandık açılır, Takım ve Sıralama tanıtılır
    expect(mapIntroView(['team', 'siralama'], mapRevealPending(upTo(4), upTo(5), restoredBefore(5)))?.note).toBe('Hazine sandığını da orada göreceksin. Tüy Dede de anlatacak: Takım ve Sıralama.');
  });
  /**
   * YN-136 (OT-ilk-kez-oyun-36): hedef kutusu "Bölüm 28 bitince Koklea · Apeks çiçeklenir" der; 28 geçilince "Sonraki" çiçeklenmeyi
   * atlatıyordu (32'de İşitme Siniri de). Söz verilen her aşama haritada bekler: çiçeklenme ve canlanmış bölgenin ışıl ışıl olması.
   */
  it('çiçeklenme (28, 32, 3): "Haritaya dön" ve "… haritada çiçeklenecek."; hedef kutusunun söz verdiği bölümle aynı', () => {
    for (const [n, zone, name] of [[28, 'koklea-3', 'Koklea · Apeks'], [32, 'sinir', 'İşitme Siniri'], [3, 'dis-kulak', 'Dış Kulak']] as const) {
      const r = mapRevealPending(upTo(n - 1), upTo(n), restoredBefore(n));
      expect(r, `${n}`).toEqual({ zones: [], grows: [{ zone, to: 2 }], treasures: [] });
      expect(mapIntroView([], r), `${n}`).toEqual({ art: 'sprout', title: `${name} haritada çiçeklenecek.`, note: 'Sıradaki bölüm haritadan.', button: 'Haritaya dön' });
      expect(pickGoal(upTo(n - 2))?.key === `b:${zone}:2` || pickGoal(upTo(n - 1))?.key === `b:${zone}:2`, `${n}: hedef kutusu söz veriyor`).toBe(true);
    }
    // uyanma tek başına beklemez (hedef kutusu söz vermez): 8'de Kulak Zarı uyanır ama başlık Kulak Kanalı'nın çiçeklenmesi
    expect(mapRevealPending(upTo(7), upTo(8), restoredBefore(8))).toEqual({ zones: [], grows: [{ zone: 'kanal', to: 2 }], treasures: [] });
    expect(mapRevealPending(upTo(38), upTo(39), restoredBefore(39))).toBeNull();
  });
  it('canlanmış bölge ışıl ışıl olur (eski bölüm tekrarında yıldız tamamlanınca): yine "Haritaya dön"', () => {
    const all = restoredBefore(41); const five = { ...upTo(40), 1: 3, 2: 3, 3: 3, 4: 3 };
    const r = mapRevealPending(five, { ...five, 5: 3 }, all);
    expect(r).toEqual({ zones: [], grows: [{ zone: 'dis-kulak', to: 4 }], treasures: [] });
    expect(mapIntroView([], r)?.title).toBe('Dış Kulak haritada ışıl ışıl olacak.');
    // aynı dönüşte iki aşama: biri başlık, öbürü notta
    expect(mapIntroView([], { zones: [], grows: [{ zone: 'zar', to: 4 }, { zone: 'kanal', to: 2 }], treasures: [] })).toMatchObject({ title: 'Kulak Zarı haritada ışıl ışıl olacak.', note: 'Ayrıca Kulak Kanalı çiçeklenecek.' });
  });
  it('sıradan bölüm, eski bölüm tekrarı (yıldız artsa da) ve hiç açılmamış harita: bekleyen yok → Sonraki', () => {
    for (const n of [2, 11, 13, 21]) expect(mapRevealPending(upTo(n - 1), upTo(n), restoredBefore(n)), `${n}`).toBeNull();
    const all = restoredBefore(41);
    expect(mapRevealPending(upTo(40), upTo(40), all)).toBeNull();
    expect(mapRevealPending(upTo(40), { ...upTo(40), 20: 3, 8: 3 }, all)).toBeNull();
    expect(mapRevealPending(upTo(12), upTo(12), restoredBefore(13))).toBeNull();
    expect(mapRevealPending(null, upTo(20), [])).toBeNull();
    expect(mapIntroView([], null)).toBeNull();
  });
});
