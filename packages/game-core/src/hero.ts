import Phaser from 'phaser';
import { heroTexture } from './art';
import { HERO_SIZE } from '@odi/shared';

export type Mood = 'happy' | 'hurt' | 'wow';

/** Odi: fizikli sprite + ruh hali + squash/stretch. */
export class Hero {
  sprite: Phaser.Physics.Arcade.Sprite;
  private moodTimer?: Phaser.Time.TimerEvent;
  constructor(public scene: Phaser.Scene, x: number, y: number, public color = 0x6c4cf1) {
    heroTexture(scene, 'odi', color, HERO_SIZE, 'happy'); heroTexture(scene, 'odi', color, HERO_SIZE, 'hurt'); heroTexture(scene, 'odi', color, HERO_SIZE, 'wow');
    this.sprite = scene.physics.add.sprite(x, y, 'odi-happy');
    this.sprite.setOrigin(0.5, 1);
    this.sprite.body!.setSize(HERO_SIZE * 0.7, HERO_SIZE * 0.9).setOffset(HERO_SIZE * 0.15, HERO_SIZE * 0.1);
    this.sprite.setDepth(20);
  }
  mood(m: Mood, ms = 0) {
    this.sprite.setTexture(`odi-${m}`);
    this.moodTimer?.remove();
    if (ms > 0) this.moodTimer = this.scene.time.delayedCall(ms, () => this.sprite.setTexture('odi-happy'));
  }
  squash(sx = 1.25, sy = 0.75, ms = 90) {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(sx, sy);
    this.scene.tweens.add({ targets: this.sprite, scaleX: 1, scaleY: 1, duration: ms * 2, ease: 'Back.Out' });
  }
  stretch() { this.squash(0.8, 1.25, 80); }
  blink(ms = 1200) {
    this.scene.tweens.add({ targets: this.sprite, alpha: 0.25, yoyo: true, repeat: Math.floor(ms / 120), duration: 60, onComplete: () => this.sprite.setAlpha(1) });
  }
  get x() { return this.sprite.x; } get y() { return this.sprite.y; }
  get body() { return this.sprite.body as Phaser.Physics.Arcade.Body; }
}
