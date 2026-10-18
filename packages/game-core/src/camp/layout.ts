/**
 * Kulak Kampı yerleşimi ve saf kurallar (Phaser'sız; React ve testler de kullanır).
 */
import type { BuildingId, BuildingState, CampState } from '@odi/shared';

/** binaların arsa merkezleri (dünya birimi; ekran izdüşümünde) ve arsa yarıçapı (karo) */
export const LOTS: Record<BuildingId, { x: number; y: number; tiles: number }> = {
  merkez: { x: 0, y: 0, tiles: 3 },
  laboratuvar: { x: -176, y: -112, tiles: 2 },
  kule: { x: 176, y: -112, tiles: 2 },
  atolye: { x: -240, y: 56, tiles: 2 },
  depo: { x: 240, y: 56, tiles: 2 },
  revir: { x: 0, y: 168, tiles: 2 },
};
export const BUILDING_ORDER: BuildingId[] = ['merkez', 'laboratuvar', 'kule', 'atolye', 'depo', 'revir'];

/** görsel kademe: 1-3 ahşap, 4-6 taş, 7-9 tuğla+bayrak, 10-12 metal+ışık, 13-15 altın süs. 0 = boş arsa */
export const CAMP_TIER_NAMES = ['Ahşap', 'Taş', 'Tuğla', 'Metal', 'Altın'] as const;
export function tierOf(level: number): number { return level <= 0 ? -1 : Math.min(4, Math.floor((level - 1) / 3)); }
export const tierChanged = (from: number, to: number) => tierOf(from) !== tierOf(to);

/** Kamp Merkezi seviyesine göre açılan arazi halkaları (sis kalkar, süsler gelir) */
export const ZONE_LEVELS = [1, 4, 7, 10, 13] as const;
export function zonesOpen(merkez: number): number { return ZONE_LEVELS.filter((l) => merkez >= l).length; }

export const DEPOT_RATE = 20;
export const DEPOT_CAP_H = 8;
const HOUR = 3_600_000;
/** depodaki jeton (sunucu kuralının aynısı) */
export function depotStored(level: number, storedAt: number, now: number): { stored: number; max: number; ratio: number } {
  if (level <= 0) return { stored: 0, max: 0, ratio: 0 };
  const max = level * DEPOT_RATE * DEPOT_CAP_H;
  const stored = Math.floor((Math.min(Math.max(0, now - storedAt), DEPOT_CAP_H * HOUR) / HOUR) * level * DEPOT_RATE);
  return { stored, max, ratio: max ? stored / max : 0 };
}

export const levelOf = (camp: CampState | null | undefined, id: BuildingId) => camp?.buildings.find((b) => b.id === id)?.level ?? 0;
export const activeBuild = (camp: CampState | null | undefined): BuildingState | undefined => camp?.buildings.find((b) => b.upgradingTo && b.endsAt);
