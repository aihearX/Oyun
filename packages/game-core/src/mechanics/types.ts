import type Phaser from 'phaser';
import type { Entity, InputState, LevelSpec, MechanicId, PlayerSkills } from '@odi/shared';
import type { Hero } from '../hero';
import type { TouchInput } from '../input';
import type { LevelScene } from '../LevelScene';

export interface LevelState {
  started: boolean; finished: boolean;
  lives: number; coins: number; score: number; timeSec: number; deaths: number; damageTaken: number;
  invulnUntil: number; shield: number; magnetUntil: number; speedMult: number;
  gravityDir: 1 | -1; notesCollected: number; notesNeeded: number; nextNote: number;
  checkpointX: number; secretFound: boolean; escortAlive: boolean; objectiveMet: boolean;
  /** mekanik özel durumu (örn. nefes, tutunulan dişli) */
  custom: Record<string, number | string | boolean>;
}

export interface Scan {
  /** önde en yakın ölümcül engelin mesafesi (px) ve türü */
  hazard: { dist: number; type: string; y: number; h: number } | null;
  /** önde en yakın boşluğun başlangıç mesafesi ve genişliği */
  gap: { dist: number; width: number } | null;
  /** önde en yakın yükseltinin (platform) mesafesi ve yüksekliği */
  step: { dist: number; y: number } | null;
  /** önde zeminin aşağı düştüğü yer (platform ucu) ve düşüş derinliği */
  drop: { dist: number; depth: number } | null;
  /** önde jeton var mı (y) */
  coin: { dist: number; y: number } | null;
}

export interface LevelContext {
  scene: LevelScene; spec: LevelSpec; hero: Hero; input: TouchInput; skills: PlayerSkills; state: LevelState;
  groups: { platforms: Phaser.Physics.Arcade.StaticGroup; movers: Phaser.Physics.Arcade.Group; coins: Phaser.Physics.Arcade.Group; hazards: Phaser.Physics.Arcade.StaticGroup; enemies: Phaser.Physics.Arcade.Group; powerups: Phaser.Physics.Arcade.Group; specials: Phaser.Physics.Arcade.Group };
  rng: () => number; worldW: number; groundY: number; bot: boolean;
  damage(reason: string): boolean;
  finish(): void;
  fail(reason: string): void;
  float(x: number, y: number, text: string, color?: string): void;
  flash(color?: number): void;
  shake(ms?: number, intensity?: number): void;
  haptic(kind: 'light' | 'medium' | 'heavy' | 'success' | 'error'): void;
  scan(range?: number): Scan;
  /** ekranda kısa ipucu */
  hint(text: string, ms?: number): void;
}

export interface Mechanic {
  id: MechanicId;
  /** yerçekimi, başlangıç hızı, ipucu */
  setup(ctx: LevelContext): void;
  update(ctx: LevelContext, input: InputState, dt: number): void;
  /** mekaniğe özel varlık; true dönerse genel üretici atlar */
  spawn?(ctx: LevelContext, e: Entity, worldX: number): boolean;
  /** özel varlıkla temas (dişli, akıntı, baloncuk, şerit, döndürücü…); true dönerse genel işleyici atlar */
  onSpecial?(ctx: LevelContext, sprite: Phaser.Physics.Arcade.Sprite, e: Entity): boolean;
  /** hasar alındığında (yeniden doğma öncesi) */
  onDamage?(ctx: LevelContext): void;
  /** otomatik oyuncu: harness ve test */
  botTick(ctx: LevelContext, input: TouchInput, scan: Scan): void;
  teardown?(ctx: LevelContext): void;
}
