import Phaser from 'phaser';
import type { AbilityId } from '@odi/shared';
import { GAME_W, GAME_H } from '@odi/shared';
import { ABILITIES } from '@odi/content';
import { FONT } from '../ui';

/**
 * Öğretici an: yeni yeteneğin ilk karşılaşmasında zaman yavaşlar (×0,35), ekranda büyük el işareti hareketi gösterir.
 * Oyuncu hareketi yaptığı an normal hıza döner ("Harika!"). Süre sayacı, ceza ya da sahte baskı yok;
 * kaçırırsa oyun normal kurallarla sürer, aynı yere döndüğünde an yeniden açılır.
 */
export const TUTORIAL_SLOW = 0.35;

/** yeteneğin "başardın" sayılan sim olayı */
export const TUTORIAL_SUCCESS: Record<AbilityId, string[]> = {
  zipla: ['jump'], kayma: ['slide'], duvar: ['walljump'], suzul: ['glide'], trambolin: ['tramp-strong'], kanca: ['unhook'],
  cakil: ['poundland'], yuz: ['swim', 'jump'], darbe: ['dash'], cevir: ['flip'],
};

export class TutorialOverlay {
  private c: Phaser.GameObjects.Container; private hand: Phaser.GameObjects.Text; private t0: number;
  constructor(private scene: Phaser.Scene, public ability: AbilityId, public tutorId: number) {
    const def = ABILITIES[ability];
    const veil = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0d1024, 0.28);
    const title = scene.add.text(GAME_W / 2, GAME_H * 0.62, `Yeni: ${def.name}`, { fontFamily: FONT, fontSize: '26px', fontStyle: '800', color: '#ffd27a', stroke: '#0d1024', strokeThickness: 6 }).setOrigin(0.5);
    const how = scene.add.text(GAME_W / 2, GAME_H * 0.62 + 40, def.how, { fontFamily: FONT, fontSize: '17px', fontStyle: '700', color: '#ffffff', align: 'center', stroke: '#0d1024', strokeThickness: 5, wordWrap: { width: GAME_W - 50 } }).setOrigin(0.5, 0);
    this.hand = scene.add.text(GAME_W / 2, GAME_H * 0.8, '👆', { fontSize: '72px' }).setOrigin(0.5);
    this.c = scene.add.container(0, 0, [veil, title, how, this.hand]).setScrollFactor(0).setDepth(240).setAlpha(0);
    scene.tweens.add({ targets: this.c, alpha: 1, duration: 160 });
    this.t0 = scene.time.now;
  }
  /** el işareti hareketi (gerçek zamanda) */
  tick() {
    const u = ((this.scene.time.now - this.t0) % 1100) / 1100; const g = ABILITIES[this.ability].gesture; const y0 = GAME_H * 0.8;
    if (g === 'dokun') { this.hand.setPosition(GAME_W / 2, y0 + (u < 0.25 ? u * 60 : u < 0.45 ? (0.45 - u) * 75 : 0)).setScale(u < 0.3 ? 0.9 : 1); }
    else if (g === 'basili') { this.hand.setPosition(GAME_W / 2, y0 + Math.min(1, u * 4) * 14).setScale(1 - Math.min(1, u * 4) * 0.12); }
    else if (g === 'asagi') { this.hand.setPosition(GAME_W / 2, y0 - 30 + u * 80).setAlpha(u < 0.8 ? 1 : (1 - u) * 5); }
    else { this.hand.setPosition(GAME_W / 2 - 60 + u * 130, y0).setAlpha(u < 0.8 ? 1 : (1 - u) * 5); }
  }
  done(success: boolean) {
    const c = this.c; this.scene.tweens.add({ targets: c, alpha: 0, duration: success ? 220 : 400, onComplete: () => c.destroy() });
  }
}
