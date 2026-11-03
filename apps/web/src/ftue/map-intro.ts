import { BIOMES } from '@odi/content';
// yalnız saf yerleşim hesabı (lite girişi harita boyamasını da taşır; bu dosya ilk parçada)
import { planReturn, type StarMap, type ZoneId } from '@odi/game-core/map/layout';
import type { ArtName } from '../ui/art';
import { FEATURES, featureById, type FeatureId, type FtueState } from './features';

/**
 * Haritada (Kulak Kanalı) kendiliğinden başlayacak anlatıcı turları: tek doğruluk kaynağı.
 * Yönetmen (Director.tsx) sekme ekranlarında sıradaki turu buradan seçer; sonuç ekranı aynı kuyruğa bakıp "Sonraki" yerine
 * "Haritaya dön" gösterir (sahip isteği 2026-10-31, YN-066): yeni bir yer açıldıysa ya da Tüy Dede'nin anlatacağı bir şey varsa
 * oyuncu anlatımı bölüme geçerek kaçırmasın. Aynı kural haritanın dönüş sahnesinde bekleyen bölge canlanması ve hazine için de
 * geçerli (YN-114, OT-ilk-kez-oyun-34): hedef kutusunun söz verdiği an bölüme atlanarak kaçmasın.
 */

/**
 * Anlatıcı yükü: bir bölüm geçişinden sonra en çok bu kadar açılım turu art arda gelir; fazlası bir sonraki bölüme kalır
 * (6. bölümde 3, kampa dönüşte 3 tur birikiyordu — docs/yonetim/is-listesi.md MK-007). Hikâye, sonuç, harita ve kamp
 * öğreticisi bu sayıya girmez. Sayaç bellektedir: uygulama yeniden açılınca sıfırlanır (bekleyen turlar kaybolmaz).
 */
export const MAX_UNLOCK_TOURS_PER_LEVEL = 2;
/** kamp turları yalnız kampta başlar (oyuncu kampa girince; başka bir akışı bölmez). `vaka-kur`: klinik kurulmamışken Hasta Vakaları
 *  yerine söylenen yazı satırı ("Önce Odyoloji Kliniği'ni kur"; Director.tsx) */
export const CAMP_TOURS: ReadonlySet<string> = new Set(['gorev', 'kampoyun', 'vaka', 'vaka-kur']);
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

/**
 * Haritaya gelinince dönüş sahnesinde kutlanacaklar (MapScreen onZoneRise / onTreasure ile aynı kural): ilk kez canlanan bölgeler
 * (aşama 3 ve üstü, daha önce kutlanmamış; son bölge şeritle) ve açılan hazine sandıkları. `seen`: haritanın en son gösterdiği
 * yıldızlar (mapSeen); harita hiç açılmamışsa (null) ilk açılış sahnesiz kaydedilir, beklenen bir şey yoktur. Eski bölüm tekrarında
 * fark yoktur → null.
 * `grows`: haritanın hedef kutusunun söz verdiği öbür aşamalar (map/goals.ts pickGoal): çiçeklenme (2) ve canlanmış bölgenin ışıl
 * ışıl olması (4). Dönüş sahnesi bölgeyi büyütür, hedef kutusu "Koklea · Apeks çiçeklendi!" der (YN-136, OT-ilk-kez-oyun-36: 28.
 * bölümden sonra "Sonraki" çiçeklenmeyi atlatıyordu). Uyanma (1) sayılmaz: hedef kutusu onu söz vermez; bölgeler başka bir aşamayla
 * birlikte uyanır (son bölge 39'da sözsüz uyanır).
 */
export interface MapReveal { zones: ZoneId[]; grows: { zone: ZoneId; to: 2 | 4 }[]; treasures: number[] }
export function mapRevealPending(seen: StarMap | null, now: StarMap, restored: readonly string[]): MapReveal | null {
  if (!seen) return null;
  const steps = planReturn(seen, now);
  const zones = steps.flatMap((st) => (st.kind === 'zone' && st.to >= 3 && !restored.includes(st.zone) ? [st.zone] : []));
  const grows = steps.flatMap((st) => (st.kind === 'zone' && st.zone !== 'finale' && !zones.includes(st.zone) && (st.to === 2 || st.to === 4) ? [{ zone: st.zone, to: st.to }] : []));
  const treasures = steps.flatMap((st) => (st.kind === 'treasure' ? [st.n] : []));
  return zones.length || grows.length || treasures.length ? { zones, grows, treasures } : null;
}
const andJoin = (xs: readonly string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} ve ${xs[xs.length - 1]}` : xs[0] ?? '');
/** dönüş sahnesinde bölgenin büyüyeceği aşamanın fiili (map/goals.ts VITALITY_WILL'in gelecek zamanı) */
const GROW_WILL: Record<2 | 4, string> = { 2: 'çiçeklenecek', 4: 'ışıl ışıl olacak' };
/** haritada bekleyen kutlamanın satırı: "Kulak Kanalı haritada canlanacak." / "Koklea · Apeks haritada çiçeklenecek." / "Hazine sandığını haritada göreceksin." */
function revealView(r: MapReveal, tour: string): MapIntroView {
  const places = r.zones.flatMap((z) => (z === 'finale' ? [] : [BIOMES[z].name])); const finale = r.zones.includes('finale');
  // aşamalar sırayla: canlanma, ışıl ışıl, çiçeklenme; ilki başlık, öbürleri "Ayrıca …" notu
  const grows = ([4, 2] as const).flatMap((to) => { const ns = r.grows.flatMap((g) => (g.to === to && g.zone !== 'finale' ? [BIOMES[g.zone].name] : [])); return ns.length ? [{ who: andJoin(ns), will: GROW_WILL[to] }] : []; });
  const zone = places.length > 0 || finale || grows.length > 0; const first = !places.length && !finale ? grows[0] : undefined;
  const title = places.length ? `${andJoin(places)} haritada canlanacak.` : finale ? 'Ninni Merkezi haritada ışıl ışıl yanacak.' : first ? `${first.who} haritada ${first.will}.` : 'Hazine sandığını haritada göreceksin.';
  const also = [places.length && finale ? 'Ninni Merkezi de ışıl ışıl yanacak.' : '', ...grows.filter((g) => g !== first).map((g) => `Ayrıca ${g.who} ${g.will}.`), zone && r.treasures.length ? 'Hazine sandığını da orada göreceksin.' : '', tour].filter(Boolean);
  return { art: zone ? 'sprout' : 'chest', title, note: also.join(' ') || 'Sıradaki bölüm haritadan.', button: 'Haritaya dön' };
}

/** sonuç ekranındaki dürüst satır ve düğme: neyin beklediği (emoji yok); haritada kutlama bekliyorsa önce o söylenir */
export interface MapIntroView { art: ArtName; title: string; note: string; button: string }
export function mapIntroView(queue: readonly string[], reveal?: MapReveal | null): MapIntroView | null {
  const ids = queue.filter((id): id is FeatureId => FEATURES.some((f) => f.id === id)); const names = ids.map(tourShortName).join(' ve ');
  if (reveal) return revealView(reveal, queue[0] === 'map' ? 'Tüy Dede de yolunu gösterecek.' : ids.length ? `Tüy Dede de anlatacak: ${names}.` : '');
  const first = queue[0]; if (!first) return null;
  if (first === 'map') return { art: 'map', title: 'Tüy Dede’nin anlatacakları var', note: 'Haritada yolunu gösterecek.', button: 'Haritaya git' };
  if (!ids.length) return null;
  return { art: featureById(ids[0]!).art, title: `Yeni: ${names}`, note: 'Tüy Dede haritada anlatacak.', button: 'Haritaya dön' };
}
