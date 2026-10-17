import Phaser from 'phaser';
import type { InputState } from '@odi/shared';

/** Dokunma → soyut giriş. Tek elle: tap, basılı tutma, aşağı kaydırma, sağ/sol yarım. */
export class TouchInput {
  state: InputState = { primaryDown: false, primaryPressed: false, primaryReleased: false, secondaryPressed: false, dir: 0, pointerX: 0.5 };
  private downAt = 0; private downY = 0; private downX = 0; private swiped = false; private pressedQueue = 0; private releasedQueue = 0; private secondaryQueue = 0;
  /** bot girişleri için */
  virtual: Partial<InputState> | null = null;
  constructor(private scene: Phaser.Scene, private mirrored = false) {
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.downAt = scene.time.now; this.downY = p.y; this.downX = p.x; this.swiped = false;
      this.state.primaryDown = true; this.pressedQueue++;
      this.state.pointerX = p.x / scene.scale.width;
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || this.swiped) return;
      if (p.y - this.downY > 40 && scene.time.now - this.downAt < 400) { this.swiped = true; this.secondaryQueue++; this.state.primaryDown = false; }
      this.state.pointerX = p.x / scene.scale.width;
    });
    scene.input.on('pointerup', () => { if (this.state.primaryDown) this.releasedQueue++; this.state.primaryDown = false; });
  }
  /** her karede bir kez çağrılır; edge olaylarını tüketir */
  tick(): InputState {
    const s = this.state;
    s.primaryPressed = this.pressedQueue > 0; s.primaryReleased = this.releasedQueue > 0; s.secondaryPressed = this.secondaryQueue > 0;
    this.pressedQueue = 0; this.releasedQueue = 0; this.secondaryQueue = 0;
    const px = this.mirrored ? 1 - s.pointerX : s.pointerX;
    s.dir = s.primaryDown ? (px < 0.4 ? -1 : px > 0.6 ? 1 : 0) : 0;
    if (this.virtual) Object.assign(s, this.virtual);
    return s;
  }
  /** bot: tek kare basma */
  tap() { this.pressedQueue++; this.state.primaryDown = true; this.scene.time.delayedCall(60, () => { this.state.primaryDown = false; this.releasedQueue++; }); }
  hold(ms: number) { this.pressedQueue++; this.state.primaryDown = true; this.scene.time.delayedCall(ms, () => { this.state.primaryDown = false; this.releasedQueue++; }); }
  swipeDown() { this.secondaryQueue++; }
}
