/**
 * Phaser'sız giriş: arayüzün (React ekranları) sahne açmadan kullandığı saf yardımcılar.
 * Buradan alınan hiçbir şey Phaser'ı paketin ilk parçasına çekmez; sahneler (`./boot`, `./map/index`, `./camp/index`)
 * arayüzde `import()` ile, gerektiği anda yüklenir (apps/web/src/engine.ts).
 */
export { BUILDING_ORDER, MAIN_BUILDINGS, DISTRICT_BUILDINGS, LOTS, CAMP_TIER_NAMES, ZONE_LEVELS, DEPOT_CAP_H, DEPOT_RATE, activeBuild, depotStored, levelOf, tierChanged, tierOf, zonesOpen } from './camp/layout';
export { buildingCanvas, PAINT_BOX, TIER_ACCENT } from './camp/buildings';
export { MONUMENT_ORDER, MONUMENT_SPOTS, MONUMENT_TINT, paintMonument } from './camp/monuments';
export { decorCanvas, DECOR_BOX } from './camp/decor';
export * from './map/layout';
export type * from './map/types';
export { ZONE_PLACE, zoneName } from './map/paint';
export type { CampHandle, CampOptions, CampTeam } from './camp/index';
export type { GameEvent, LevelHandle, LevelOptions, RaceOptions } from './bridge';
