import type { ArtName } from '../ui/art';
import { KG_ACILIS } from '@odi/content';

/**
 * İlk deneyim (FTUE): yeni oyuncuda her şey bir anda açık olmaz; yerler bölüm geçtikçe tek tek açılır ve
 * anlatıcı (Tüy Dede) her yeni yeri gösterir. Kilitli yerler dürüstçe "Bölüm N'de açılır" yazar (sahte sayaç yok).
 * `at`: o kadar bölüm (art arda) GEÇİLİNCE açılır.
 */
export type FeatureId = 'profile' | 'today' | 'album' | 'camp' | 'skills' | 'friends' | 'glossary' | 'team' | 'league' | 'shop' | 'events' | 'race'
  /** iletişim (docs/13-iletisim.md) */
  | 'yazi' | 'akis' | 'soru' | 'ikili' | 'usta'
  /** sıralama (docs/15-siralama.md) */
  | 'siralama'
  /** takım rekabeti (docs/16-takim-rekabeti.md): Takım Ligi, Canlı Takım Yarışı */
  | 'tlig' | 'tyaris'
  /** kamp görevleri ve etkinlikleri (docs/17-kamp-gorevleri.md): Görevler, kamp oyunları, Hasta Vakaları */
  | 'gorev' | 'kampoyun' | 'vaka';
export interface FeatureDef { id: FeatureId; at: number; name: string; art: ArtName; /** anlatıcıyla duyurulur mu (sessizler yalnızca kilidi kalkar) */ tour: boolean }

export const FEATURES: FeatureDef[] = [
  { id: 'profile', at: 1, name: 'Profil', art: 'users', tour: false },
  { id: 'today', at: 2, name: 'Bugün', art: 'sun', tour: true },
  { id: 'album', at: 2, name: 'Başarımlar ve Kulak Kartları', art: 'card', tour: false },
  { id: 'camp', at: 3, name: 'Kamp', art: 'tent', tour: true },
  { id: 'skills', at: 3, name: 'Yetenekler', art: 'bolt', tour: false },
  { id: 'friends', at: 4, name: 'Arkadaşlar ve mesajlar', art: 'users', tour: true },
  { id: 'glossary', at: 4, name: 'Kulak Sözlüğü', art: 'bulb', tour: true },
  { id: 'team', at: 5, name: 'Takım', art: 'shield', tour: true },
  { id: 'league', at: 5, name: 'Lig', art: 'medal', tour: false },
  // sıralama: takımla aynı anda (takım tablolarında yerini görsün); turu takım turundan sonra
  { id: 'siralama', at: 5, name: 'Sıralama', art: 'trophy', tour: true },
  // takım rekabeti: lig takımla birlikte görünür (6), canlı takım yarışı tek kişilik yarıştan sonra (9)
  { id: 'tlig', at: 6, name: 'Takım Ligi', art: 'shield', tour: true },
  { id: 'tyaris', at: 9, name: 'Canlı Takım Yarışı', art: 'flag', tour: true },
  { id: 'shop', at: 6, name: 'Mağaza, Dolap ve Ödül kutusu', art: 'crystal', tour: true },
  { id: 'events', at: 7, name: 'Etkinlikler', art: 'bigtop', tour: true },
  { id: 'race', at: 8, name: 'Canlı yarış ve meydan okuma', art: 'finish', tour: true },
  // güvenli sohbet ZORUNLU: 8 bölüme kadar yalnız hazır sözler ve emoji; 8 geçilince serbest yazı kendiliğinden açılır (kurallar bir kez)
  { id: 'yazi', at: 8, name: 'Serbest yazı', art: 'pencil', tour: true },
  // iletişim: takım sohbetinden sonra, adım adım (yeni oyuncuyu boğmadan)
  { id: 'akis', at: 6, name: 'Takım Akışı ve tepkiler', art: 'chat', tour: true },
  { id: 'soru', at: 9, name: 'Günün Sorusu', art: 'bulb', tour: true },
  { id: 'ikili', at: 10, name: 'İkili Görev', art: 'users', tour: true },
  { id: 'usta', at: 11, name: 'Usta–Çırak', art: 'crown', tour: true },
  // kamp görevleri: kamp öğreticisinden sonra adım adım (görevler → oyunlar → vakalar); bölüm sayıları @odi/content KG_ACILIS
  { id: 'gorev', at: KG_ACILIS.gorev, name: 'Kamp Görevleri', art: 'check', tour: true },
  { id: 'kampoyun', at: KG_ACILIS.oyun, name: 'Kamp oyunları', art: 'sound', tour: true },
  { id: 'vaka', at: KG_ACILIS.vaka, name: 'Hasta Vakaları', art: 'heal', tour: true },
];
export const featureById = (id: FeatureId) => FEATURES.find((f) => f.id === id)!;

/** Anlatıcı turları (yapıldıkça kaydedilir) */
export const TOUR_IDS = ['result1', 'map', 'today', 'camp', 'camp-build', 'friends', 'team', 'shop', 'events', 'race', 'yazi', 'akis', 'soru', 'ikili', 'usta', 'siralama', 'tlig', 'tyaris', 'gorev', 'kampoyun', 'vaka'] as const;
export type TourId = (typeof TOUR_IDS)[number];

/** Kalıcı ilk deneyim durumu (odi-v1 kaydında, sürümlü) */
export interface FtueState {
  v: 1;
  /** hikâye girişi izlendi/atlandı */
  story: boolean;
  /** bitirilen (ya da atlanan) anlatıcı turları */
  tours: string[];
  /** test/geliştirme: her şey açık, tur yok (yalnızca test derlemesinde ?ftue=0 ya da tohumlanmış kayıt) */
  bypass?: boolean;
  /** yönetici modu (Kod Gir; sunucu doğruladı): tüm yerler ve bölümler açık, tur yok. Sıfırlamada silinir. */
  admin?: boolean;
  /** Tüy Dede'nin bölüm içinde bir kez söylediği ipucu satırları (ftue/hints.ts; oyuncu başına bir kez) */
  said?: string[];
}
export const FRESH_FTUE: FtueState = { v: 1, story: false, tours: [] };

/** art arda geçilen bölüm sayısı */
export function clearedCount(progress: Record<number, { stars: number } | undefined>): number {
  let n = 0; while (progress[n + 1] && progress[n + 1]!.stars > 0) n++; return n;
}

/**
 * Kayıttan gelen durumu doğrula. Eski kayıt (ftue alanı yok) ama ilerlemesi olan oyuncu: hikâye ve şimdiye kadar
 * açılmış yerlerin turları görülmüş sayılır (açılımlar yine ilerlemeye göre; sonraki yerler oynadıkça duyurulur).
 */
export function normalizeFtue(raw: unknown, progress: Record<number, { stars: number } | undefined>): FtueState {
  const r = raw && typeof raw === 'object' ? raw as Partial<FtueState> : null;
  if (r && r.v === 1) {
    const said = Array.isArray(r.said) ? r.said.filter((t) => typeof t === 'string') : [];
    return { v: 1, story: !!r.story, tours: Array.isArray(r.tours) ? r.tours.filter((t) => typeof t === 'string') : [], ...(r.bypass ? { bypass: true } : {}), ...(r.admin ? { admin: true } : {}), ...(said.length ? { said } : {}) };
  }
  const cleared = clearedCount(progress);
  if (cleared === 0 && !Object.keys(progress).length) return { ...FRESH_FTUE };
  return { v: 1, story: true, tours: veteranTours(cleared) };
}
/** ilerlemesi olan (FTUE öncesinden gelen) oyuncu için görülmüş sayılacak turlar */
export function veteranTours(cleared: number): string[] {
  const out: string[] = ['result1', 'map'];
  for (const f of FEATURES) if (f.tour && cleared >= f.at) out.push(f.id);
  if (cleared >= featureById('camp').at) out.push('camp-build');
  return out;
}

/** bir yer açık mı (test atlaması her şeyi açar) */
export function isOpen(id: FeatureId, cleared: number, ftue: FtueState): boolean {
  return !!ftue.bypass || !!ftue.admin || cleared >= featureById(id).at;
}
export const lockText = (id: FeatureId) => `Bölüm ${featureById(id).at}'${suffix(featureById(id).at)} açılır`;
/** Türkçe bulunma eki (son rakama göre): 1'de 2'de 3'te 4'te 5'te 6'da 7'de 8'de 9'da 10'da */
function suffix(n: number): string {
  if (n % 10 === 0) return ({ 10: 'da', 20: 'de', 30: 'da', 40: 'ta', 50: 'de', 60: 'ta', 70: 'te', 80: 'de', 90: 'da' } as Record<number, string>)[n % 100] ?? 'de';
  return ['', 'de', 'de', 'te', 'te', 'te', 'da', 'de', 'de', 'da'][n % 10]!;
}
