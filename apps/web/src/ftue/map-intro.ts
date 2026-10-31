import type { ArtName } from '../ui/art';
import { FEATURES, featureById, type FeatureId, type FtueState } from './features';

/**
 * Haritada (Kulak Kanalı) kendiliğinden başlayacak anlatıcı turları: tek doğruluk kaynağı.
 * Yönetmen (Director.tsx) sekme ekranlarında sıradaki turu buradan seçer; sonuç ekranı aynı kuyruğa bakıp "Sonraki" yerine
 * "Haritaya dön" gösterir (sahip isteği 2026-10-31, YN-066): yeni bir yer açıldıysa ya da Tüy Dede'nin anlatacağı bir şey varsa
 * oyuncu anlatımı bölüme geçerek kaçırmasın.
 */

/**
 * Anlatıcı yükü: bir bölüm geçişinden sonra en çok bu kadar açılım turu art arda gelir; fazlası bir sonraki bölüme kalır
 * (6. bölümde 3, kampa dönüşte 3 tur birikiyordu — docs/yonetim/is-listesi.md MK-007). Hikâye, sonuç, harita ve kamp
 * öğreticisi bu sayıya girmez. Sayaç bellektedir: uygulama yeniden açılınca sıfırlanır (bekleyen turlar kaybolmaz).
 */
export const MAX_UNLOCK_TOURS_PER_LEVEL = 2;
/** kamp turları yalnız kampta başlar (oyuncu kampa girince; başka bir akışı bölmez) */
export const CAMP_TOURS: ReadonlySet<string> = new Set(['gorev', 'kampoyun', 'vaka']);
export type TourGroup = 'genel' | 'kamp';
/** kamp turları ve diğerleri ayrı sayılır: biri ötekini aç bırakmasın */
export const groupOf = (id: string): TourGroup => (CAMP_TOURS.has(id) ? 'kamp' : 'genel');

/** bu bölüm geçişinden sonra başlamış açılım turu sayısı (geçilen bölüm sayısına bağlı; değişince sıfırlanır) */
export interface UnlockTally { cleared: number; genel: number; kamp: number }
export const unlockTally: UnlockTally = { cleared: -1, genel: 0, kamp: 0 };
export function countUnlockTour(id: string, cleared: number, tally: UnlockTally = unlockTally): void {
  if (!FEATURES.some((f) => f.id === id && f.tour)) return;
  if (tally.cleared !== cleared) { tally.cleared = cleared; tally.genel = 0; tally.kamp = 0; }
  tally[groupOf(id)]++;
}
export const groupFull = (id: string, cleared: number, tally: UnlockTally = unlockTally) => tally.cleared === cleared && tally[groupOf(id)] >= MAX_UNLOCK_TOURS_PER_LEVEL;

/** sekme ekranlarında (harita dahil) sırayla başlayacak genel açılım turları; bu geçişin sınırı kadar */
export function genelUnlockQueue(cleared: number, done: readonly string[], tally: UnlockTally = unlockTally): FeatureId[] {
  const used = tally.cleared === cleared ? tally.genel : 0;
  const out = FEATURES.filter((f) => f.tour && groupOf(f.id) === 'genel' && cleared >= f.at && !done.includes(f.id)).map((f) => f.id);
  return out.slice(0, Math.max(0, MAX_UNLOCK_TOURS_PER_LEVEL - used));
}

/**
 * Haritaya şimdi gelinirse kendiliğinden başlayacak turlar, başlama sırasıyla: önce harita turu (1. bölümden sonra bir kez),
 * sonra açılım turları (bölüm başına sınırla). Kamp turları ve kamp öğreticisi burada yok: onlar yalnız kampta başlar.
 * Test atlaması ve yönetici kipinde tur yoktur → boş.
 */
export function mapIntroQueue(cleared: number, ftue: Pick<FtueState, 'tours' | 'bypass' | 'admin'>, tally: UnlockTally = unlockTally): string[] {
  if (ftue.bypass || ftue.admin || cleared < 1) return [];
  return [...(ftue.tours.includes('map') ? [] : ['map']), ...genelUnlockQueue(cleared, ftue.tours, tally)];
}
/** sonuç ekranının sorusu: haritada Tüy Dede'nin anlatacağı bir şey bekliyor mu */
export const mapIntroPending = (cleared: number, ftue: Pick<FtueState, 'tours' | 'bypass' | 'admin'>, tally: UnlockTally = unlockTally) => mapIntroQueue(cleared, ftue, tally).length > 0;

/** sonuç ekranında kısa ad (uzun özellik adı yerine; "X ve Y" birleşimi) */
const SHORT: Partial<Record<FeatureId, string>> = { friends: 'Arkadaşlar', shop: 'Mağaza', race: 'Canlı yarış', akis: 'Takım Akışı', tyaris: 'Takım Yarışı' };
export const tourShortName = (id: FeatureId) => SHORT[id] ?? featureById(id).name;

/** sonuç ekranındaki dürüst satır ve düğme: neyin beklediği (emoji yok) */
export interface MapIntroView { art: ArtName; title: string; note: string; button: string }
export function mapIntroView(queue: readonly string[]): MapIntroView | null {
  const first = queue[0]; if (!first) return null;
  if (first === 'map') return { art: 'map', title: 'Tüy Dede’nin anlatacakları var', note: 'Haritada yolunu gösterecek.', button: 'Haritaya git' };
  const ids = queue.filter((id): id is FeatureId => FEATURES.some((f) => f.id === id));
  if (!ids.length) return null;
  return { art: featureById(ids[0]!).art, title: `Yeni: ${ids.map(tourShortName).join(' ve ')}`, note: 'Tüy Dede haritada anlatacak.', button: 'Haritaya dön' };
}
