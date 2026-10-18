import Phaser from 'phaser';
import { GAME_W, GAME_H } from '@odi/shared';
import type { LevelHandle, LevelOptions } from './bridge';
import { LevelScene } from './LevelScene';
import { setSoundsEnabled } from './audio';

/** Bir bölümü verilen DOM ebeveyninde başlatır. Tek sahne, tek Phaser.Game; kapatınca tamamen yok edilir. */
export function startLevel(parent: HTMLElement | string, opts: LevelOptions): LevelHandle {
  setSoundsEnabled(opts.sounds !== false);
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: GAME_W, height: GAME_H, backgroundColor: '#ffffff',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1400 }, debug: false } },
    input: { activePointers: 2 }, render: { antialias: true, pixelArt: false, roundPixels: false },
    fps: { target: 60, min: opts.bot ? 10 : 30 },
    scene: [LevelScene],
    callbacks: { preBoot: (g) => g.registry.set('opts', opts) },
  });
  return {
    destroy: () => { try { game.destroy(true); } catch { /* yok sayılır */ } },
    pause: () => { const s = game.scene.getScene('level'); if (s && game.scene.isActive('level')) { s.scene.pause(); } },
    resume: () => { const s = game.scene.getScene('level'); if (s && game.scene.isPaused('level')) { s.scene.resume(); } },
    end: (reason) => { const s = game.scene.getScene('level') as LevelScene | null; if (s?.state && !s.state.finished) { if (game.scene.isPaused('level')) s.scene.resume(); s.fail(reason); } },
  };
}
