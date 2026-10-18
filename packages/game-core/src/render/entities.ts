/**
 * entitySprite: her öğe türü için görsel (fizik gövdesini motor ekler). Koordinat sözleşmesi types.ts'de.
 * Dönen kap EntityView'dir: setOpen / pulse / setSolid / reveal / crack / telegraph / collect / shatter / setFacing.
 */
import type Phaser from 'phaser';
import type { RenderEntity } from './types';
import { artOf } from './palette';
import { EntityView } from './view';
import { num, buildBarrier, buildBigNote, buildBubble, buildBullet, buildCochlea, buildCoin, buildFork, buildHazardCloud, buildMine, buildNote, buildPowerup, buildSpike } from './items';
import { buildBeat, buildCheckpoint, buildCrumble, buildCurrent, buildDecor, buildDoor, buildEcho, buildEscortee, buildFlip, buildFreqGate, buildGate, buildGear, buildGravZone, buildHook, buildLauncher, buildMoving, buildPlatform, buildSpring, buildSwitch, buildText, buildTrampoline, buildWall, buildWater } from './mech';
import { buildEnemy } from './enemies';

/** önerilen derinlikler (motor isterse değiştirir) */
export const DEPTH = { region: 3, decor: 4, platform: 5, hazard: 6, item: 8, enemy: 9, text: 15, hero: 20, fx: 30, foreground: 60, hud: 100 } as const;

export function entitySprite(scene: Phaser.Scene, e: RenderEntity, biomeId: string): EntityView {
  const A = artOf(biomeId); const p = e.props ?? {};
  const w = e.w ?? 0, h = e.h ?? 0;
  const v = new EntityView(scene, e.x, e.y, e.type);
  switch (e.type) {
    case 'platform': buildPlatform(v, A, e.x, e.y, w || 128, h || 24); v.setDepth(DEPTH.platform); break;
    case 'moving': buildMoving(v, A, e.x, e.y, w || 120, h || 24, false); v.setDepth(DEPTH.platform); break;
    case 'lift': buildMoving(v, A, e.x, e.y, w || 110, h || 24, true); v.setDepth(DEPTH.platform); break;
    case 'wall': buildWall(v, A, e.x, e.y, w || 40, h || 220); v.setDepth(DEPTH.platform); break;
    case 'crumble': buildCrumble(v, A, e.x, e.y, w || 110, h || 24); v.setDepth(DEPTH.platform); break;
    case 'beat': buildBeat(v, w || 110, h || 24, String(p.pattern ?? '1010'), A); v.setDepth(DEPTH.platform); break;
    case 'echo': buildEcho(v, w || 110, h || 24); v.setDepth(DEPTH.platform); break;
    case 'spike': buildSpike(v, A, w || 32); v.setDepth(DEPTH.hazard); break;
    case 'hazard': buildHazardCloud(v, String(p.kind ?? 'gurultu'), w || 100, h || 80); v.setDepth(DEPTH.hazard); break;
    case 'barrier': buildBarrier(v, w || 34, h || 160); v.setDepth(DEPTH.hazard); break;
    case 'lane': buildMine(v); v.setDepth(DEPTH.hazard); break;
    case 'projectile': case 'bullet': buildBullet(v); v.setDepth(DEPTH.enemy); break;
    case 'coin': buildCoin(v); v.setDepth(DEPTH.item); break;
    case 'note': buildNote(v); v.setDepth(DEPTH.item); break;
    case 'collect': buildBigNote(v); v.setDepth(DEPTH.item); break;
    case 'secret': buildCochlea(v); v.setDepth(DEPTH.item); break;
    case 'powerup': buildPowerup(v, String(p.kind ?? 'shield')); v.setDepth(DEPTH.item); break;
    case 'bubble': buildBubble(v); v.setDepth(DEPTH.item); break;
    case 'fork': buildFork(v, num(p.color, 0.5)); v.setDepth(DEPTH.item); break;
    case 'enemy': buildEnemy(v, p.kind); v.setDepth(DEPTH.enemy); break;
    case 'spring': buildSpring(v); v.setDepth(DEPTH.item); break;
    case 'trampoline': buildTrampoline(v, w || 96); v.setDepth(DEPTH.platform); break;
    case 'gear': buildGear(v, num(p.r, 40), num(p.speed, 1), num(p.dir, 1)); v.setDepth(DEPTH.platform); break;
    case 'current': buildCurrent(v, w || 160, h || 80, num(p.vx, 120), num(p.vy, 0)); v.setDepth(DEPTH.region); break;
    case 'flip': buildFlip(v); v.setDepth(DEPTH.item); break;
    case 'launcher': buildLauncher(v, num(p.vx, 0), num(p.vy, -1)); v.setDepth(DEPTH.item); break;
    case 'hook': buildHook(v, num(p.r, 0)); v.setDepth(DEPTH.item); break;
    case 'switch': buildSwitch(v, p.id); v.setDepth(DEPTH.item); break;
    case 'door': buildDoor(v, w || 36, h || 150, p.id); v.setDepth(DEPTH.platform); if (p.open === true) v.setOpen(true); break;
    case 'freqgate': buildFreqGate(v, w || 36, h || 150, num(p.color, 0.5)); v.setDepth(DEPTH.platform); break;
    case 'water': buildWater(v, A, w || 300, h || 160); v.setDepth(DEPTH.region); break;
    case 'gravzone': buildGravZone(v, w || 160, h || 300); v.setDepth(DEPTH.region); break;
    case 'checkpoint': buildCheckpoint(v); v.setDepth(DEPTH.decor); if (p.active === true) v.setOpen(true); break;
    case 'gate': buildGate(v, A); v.setDepth(DEPTH.decor); break;
    case 'escortee': buildEscortee(v); v.setDepth(DEPTH.item); break;
    case 'decor': buildDecor(v, A, String(p.kind ?? 'ot'), num(p.scale, 1)); v.setDepth(DEPTH.decor); break;
    case 'text': buildText(v, String(p.text ?? '')); v.setDepth(DEPTH.text); break;
    default: buildNote(v); v.setAlpha(0.4); break;
  }
  return v;
}
