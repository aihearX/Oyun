/**
 * Kulak Kampı yerleşimi ve saf kurallar (Phaser'sız; React ve testler de kullanır).
 */
import type { BuildingId, BuildingState, CampState } from '@odi/shared';
import { CAMP_LOTS } from '@odi/content';

/** binaların arsa merkezleri (dünya birimi; ekran izdüşümünde) ve arsa yarıçapı (karo) — @odi/content kamp-arazi.ts */
export const LOTS: Record<BuildingId, { x: number; y: number; tiles: number }> = CAMP_LOTS;
/** ana adadaki binalar */
export const MAIN_BUILDINGS: BuildingId[] = ['merkez', 'laboratuvar', 'kule', 'atolye', 'depo', 'revir', 'tedavi'];
/** bölge binaları (Kamp Seviyesiyle açılır) */
export const DISTRICT_BUILDINGS: BuildingId[] = ['kabin', 'tarama', 'park', 'denge', 'kutuphane'];
export const BUILDING_ORDER: BuildingId[] = [...MAIN_BUILDINGS, ...DISTRICT_BUILDINGS];

/** görsel kademe: 1-3 ahşap, 4-6 taş, 7-9 tuğla+bayrak, 10-12 metal+ışık, 13-15 altın süs, 16-20 kristal, 21-25 efsane. 0 = boş arsa */
export const CAMP_TIER_NAMES = ['Ahşap', 'Taş', 'Tuğla', 'Metal', 'Altın', 'Kristal', 'Efsane'] as const;
export function tierOf(level: number): number { return level <= 0 ? -1 : level <= 15 ? Math.floor((level - 1) / 3) : level <= 20 ? 5 : 6; }
export const tierChanged = (from: number, to: number) => tierOf(from) !== tierOf(to);

/** Kamp Merkezi seviyesine göre açılan arazi halkaları (sis kalkar, süsler gelir) */
export const ZONE_LEVELS = [1, 4, 7, 10, 13] as const;
export function zonesOpen(merkez: number): number { return ZONE_LEVELS.filter((l) => merkez >= l).length; }

export const DEPOT_RATE = 20;
export const DEPOT_CAP_H = 8;
const HOUR = 3_600_000;
/** depodaki jeton (sunucu kuralının aynısı). capH: dolma süresi (8 sa + Vestibüler Laboratuvar 0,5 sa/Sv) */
export function depotStored(level: number, storedAt: number, now: number, capH = DEPOT_CAP_H): { stored: number; max: number; ratio: number } {
  if (level <= 0) return { stored: 0, max: 0, ratio: 0 };
  const max = Math.floor(level * DEPOT_RATE * capH);
  const stored = Math.floor((Math.min(Math.max(0, now - storedAt), capH * HOUR) / HOUR) * level * DEPOT_RATE);
  return { stored, max, ratio: max ? Math.min(1, stored / max) : 0 };
}

export const levelOf = (camp: CampState | null | undefined, id: BuildingId) => camp?.buildings.find((b) => b.id === id)?.level ?? 0;
export const activeBuild = (camp: CampState | null | undefined): BuildingState | undefined => camp?.buildings.find((b) => b.upgradingTo && b.endsAt);

/**
 * Kamp kamerasının açılış yakınlaştırması (CSS pikseli / dünya birimi). Eski kural yalnız genişliğe bakıyordu
 * (`min(w/540, h/600)`): uzun telefonda görünür dünya ~1170 birim yüksekliğe çıkıyor, ada (~800 birim: arka tepeler → ön uçurum)
 * ekranın ancak %60'ını dolduruyordu. Yeni kural:
 *  · sığdır: görünür yükseklik CAMP_FIT_H (ada yüksekliği + az pay) olacak kadar yakınlaş,
 *  · üst sınır: görünür genişlik CAMP_MIN_W'nin altına inmesin (Odyoloji Merkezi ve iki yanı hep görünsün),
 *  · eski kuralın değerinin altına hiç inilmez (yatay / geniş ekranda aynı görünüm; dokunma hedefleri küçülmez).
 */
export const CAMP_FIT_H = 820;
export const CAMP_MIN_W = 380;
export function campZoom(cssW: number, cssH: number): number {
  const w = Math.max(1, cssW), h = Math.max(1, cssH);
  const old = Math.min(1.1, Math.max(0.5, Math.min(w / 540, h / 600)));
  const fit = Math.min(1.25, Math.min(h / CAMP_FIT_H, w / CAMP_MIN_W));
  return Math.max(old, fit);
}
