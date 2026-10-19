/**
 * Oyun içi görsel modül (render): biyom arka planları, zemin, öğe/düşman çizimleri, kahraman görseli, efektler ve HUD.
 * Motor fizik ve davranışı yönetir; bu modül yalnızca görünümü üretir. Tüm dokular Canvas 2D ile bir kez boyanır ve önbelleğe alınır.
 */
export * from './types';
export { setRenderResolution, renderResolution, THEME, FONT, tono, screenOrigin as screenOriginOf, viewTopLeft } from './util';
export { BIOME_ART, BIOME_IDS, artOf, variantArt, LEVEL_VARIANTS, type BiomeArt, type Motif, type SkyAccent } from './palette';
export { paintBiome } from './backdrop';
export { makeTerrain, terrainPiece, mergeRects, LIP_H } from './terrain';
export { entitySprite, DEPTH } from './entities';
export { EntityView } from './view';
export { enemyKind } from './enemies';
export { idColor } from './mech';
export { createHeroVisual, hatTex } from './hero';
export { createFx, type LevelFx } from './fx';
export { LevelHud, type HintKind, type GhostMark } from './hud';
export { createBossArt, type BossArt, type BossArtState } from './boss';
export { setFxQuality, fxQuality } from './quality';
