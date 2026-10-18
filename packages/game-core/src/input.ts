import Phaser from 'phaser';
import type { InputState } from '@odi/shared';
import { GAME_W } from '@odi/shared';

/** dokunuştan bu kadar ms sonra (parmak kaymadıysa) basış kesinleşir: kaydırma ile zıplama karışmasın */
const PRESS_DELAY = 70;
/** kaydırma eşiği (px) ve süresi (ms) */
const SWIPE_PX = 34;
const SWIPE_MS = 320;

/**
 * Dokunma → soyut giriş. Tek el: dokun (zıpla), basılı tut (yüksek zıpla / süzül / kanca / yüzerken yüksel),
 * aşağı kaydır (kay / havada çakıl), ileri kaydır (ses darbesi; ayna değiştiricisinde sola).
 * Kaydırma ile zıplamanın karışmaması için basış, parmak 70 ms sabit kalınca ya da kalkınca kesinleşir.
 * `state.primaryDown` mantıksal basılı durumudur (harness/stüdyo okur); bot `virtual` ile yazar.
 */
export class TouchInput {
  state: InputState = { primaryDown: false, primaryPressed: false, primaryReleased: false, secondaryPressed: false, dir: 0, pointerX: 0.5, dashPressed: false };
  private downAt = 0; private downY = 0; private downX = 0; private pointerIsDown = false; private resolved = true;
  private pressedQueue = 0; private releasedQueue = 0; private secondaryQueue = 0; private dashQueue = 0;
  /** bot girişleri için */
  virtual: Partial<InputState> | null = null;
  constructor(private scene: Phaser.Scene, private mirrored = false) {
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.downAt = scene.time.now; this.downY = p.y; this.downX = p.x; this.pointerIsDown = true; this.resolved = false;
      this.state.pointerX = p.x / scene.scale.width;
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !this.pointerIsDown) return;
      this.state.pointerX = p.x / scene.scale.width;
      if (scene.time.now - this.downAt > SWIPE_MS) return;
      const k = scene.scale.width / GAME_W; const dx = (p.x - this.downX) / k, dy = (p.y - this.downY) / k; // tasarım pikseli
      if (dy > SWIPE_PX && dy > Math.abs(dx)) this.swipe('down');
      else if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) && (this.mirrored ? dx < 0 : dx > 0)) this.swipe('dash');
    });
    scene.input.on('pointerup', () => {
      if (!this.resolved) { this.resolved = true; this.pressedQueue++; this.releasedQueue++; } // kısa dokunuş
      else if (this.state.primaryDown) this.releasedQueue++;
      this.pointerIsDown = false; this.state.primaryDown = false;
    });
  }
  private swipe(kind: 'down' | 'dash') {
    if (kind === 'down') this.secondaryQueue++; else this.dashQueue++;
    if (this.state.primaryDown) this.releasedQueue++;
    this.state.primaryDown = false; this.resolved = true; this.pointerIsDown = false;
  }
  /** her karede bir kez çağrılır; kenar olaylarını tüketir */
  tick(): InputState {
    const s = this.state;
    if (!this.resolved && this.pointerIsDown && this.scene.time.now - this.downAt >= PRESS_DELAY) { this.resolved = true; this.pressedQueue++; s.primaryDown = true; }
    s.primaryPressed = this.pressedQueue > 0; s.primaryReleased = this.releasedQueue > 0; s.secondaryPressed = this.secondaryQueue > 0; s.dashPressed = this.dashQueue > 0;
    this.pressedQueue = 0; this.releasedQueue = 0; this.secondaryQueue = 0; this.dashQueue = 0;
    const px = this.mirrored ? 1 - s.pointerX : s.pointerX;
    s.dir = s.primaryDown ? (px < 0.4 ? -1 : px > 0.6 ? 1 : 0) : 0;
    if (this.virtual) Object.assign(s, this.virtual);
    return s;
  }
  /** bot/araçlar: tek kare basma */
  tap() { this.pressedQueue++; this.releasedQueue++; }
  hold(ms: number) { this.pressedQueue++; this.state.primaryDown = true; this.scene.time.delayedCall(ms, () => { this.state.primaryDown = false; this.releasedQueue++; }); }
  swipeDown() { this.secondaryQueue++; }
  swipeRight() { this.dashQueue++; }
}
