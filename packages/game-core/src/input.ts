import Phaser from 'phaser';
import type { InputState } from '@odi/shared';
import { GAME_W } from '@odi/shared';

/** dokunuştan bu kadar ms sonra (parmak kaymadıysa) basış kesinleşir: kaydırma ile zıplama karışmasın */
const PRESS_DELAY = 70;
/** kaydırma eşiği (tasarım px) ve süresi (ms) */
const SWIPE_PX = 34;
const SWIPE_MS = 320;
/** yatay kaydırma (geri dön / ses darbesi) daha sıkı: en az 42 px, en az 0,28 px/ms ve yatay ağırlıklı — gevşek bir dokunuş
 *  ya da basılı tutarken kayan parmak yanlışlıkla döndürmesin */
const HSWIPE_PX = 42;
const HSWIPE_V = 0.28;

/**
 * Dokunma → soyut giriş. Tek el: dokun (zıpla), basılı tut (yüksek zıpla / süzül / kanca / yüzerken yüksel),
 * aşağı kaydır (kay / havada çakıl), yatay kaydır: koşunun tersine → geri dön, koşu yönüne → ses darbesi (açıksa).
 * `swipeX` oyun yönüdür (ayna değiştiricisinde ters çevrilmiş). Gösterge düğmeleri (`blockZones`) oynanış girdisi üretmez.
 * Kaydırma ile zıplamanın karışmaması için basış, parmak 70 ms sabit kalınca ya da kalkınca kesinleşir.
 * `state.primaryDown` mantıksal basılı durumudur (harness/stüdyo okur); bot `virtual` ile yazar.
 */
export class TouchInput {
  state: InputState = { primaryDown: false, primaryPressed: false, primaryReleased: false, secondaryPressed: false, dir: 0, pointerX: 0.5, dashPressed: false, swipeX: 0 };
  private hQueue: -1 | 0 | 1 = 0;
  /** başlatma dokunuşu gibi tüketilmiş bir dokunuş: parmak kalkana dek oynanış girdisi üretmez */
  private ignoring = false;
  private downT = 0;
  /** gösterge düğmeleri (duraklat): bu bölgede başlayan dokunuş oynanışa hiç gitmez; tasarım ekran koordinatı */
  blockZones: { hit: (x: number, y: number) => boolean; onTap: () => void }[] = [];
  private downAt = 0; private downY = 0; private downX = 0; private pointerIsDown = false; private resolved = true;
  private pressedQueue = 0; private releasedQueue = 0; private secondaryQueue = 0; private dashQueue = 0;
  /** bot girişleri için */
  virtual: Partial<InputState> | null = null;
  constructor(private scene: Phaser.Scene, private mirrored = false) {
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const k0 = scene.scale.width / GAME_W; const zx = p.x / k0, zy = p.y / k0;
      const z = this.blockZones.find((b) => b.hit(zx, zy));
      if (z) { this.pointerIsDown = false; this.resolved = true; z.onTap(); return; }
      this.downAt = scene.time.now; this.downT = p.downTime || performance.now(); this.downY = p.y; this.downX = p.x; this.pointerIsDown = true; this.resolved = false;
      this.state.pointerX = p.x / scene.scale.width;
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !this.pointerIsDown || this.ignoring) return;
      this.state.pointerX = p.x / scene.scale.width;
      // kaydırma zamanlaması DOM olay zamanlarından (kare takılsa bile hız doğru ölçülür)
      const tNow = p.moveTime || performance.now(); if (tNow - this.downT > SWIPE_MS) return;
      const k = scene.scale.width / GAME_W; const dx = (p.x - this.downX) / k, dy = (p.y - this.downY) / k; // tasarım pikseli
      const el = Math.max(16, tNow - this.downT);
      if (dy > SWIPE_PX && dy > Math.abs(dx)) this.swipe('down');
      else if (Math.abs(dx) > HSWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.4 && Math.abs(dx) / el > HSWIPE_V) this.swipe((dx > 0) !== this.mirrored ? 'right' : 'left');
    });
    scene.input.on('pointerup', () => {
      if (this.ignoring) { this.ignoring = false; this.resolved = true; this.pointerIsDown = false; this.state.primaryDown = false; return; }
      if (!this.resolved) { this.resolved = true; this.pressedQueue++; this.releasedQueue++; } // kısa dokunuş
      else if (this.state.primaryDown) this.releasedQueue++;
      this.pointerIsDown = false; this.state.primaryDown = false;
    });
  }
  private swipe(kind: 'down' | 'right' | 'left') {
    if (kind === 'down') this.secondaryQueue++; else { this.hQueue = kind === 'right' ? 1 : -1; if (kind === 'right') this.dashQueue++; }
    if (this.state.primaryDown) this.releasedQueue++;
    this.state.primaryDown = false; this.resolved = true; this.pointerIsDown = false;
  }
  /** her karede bir kez çağrılır; kenar olaylarını tüketir */
  tick(): InputState {
    const s = this.state;
    if (!this.resolved && this.pointerIsDown && !this.ignoring && this.scene.time.now - this.downAt >= PRESS_DELAY) { this.resolved = true; this.pressedQueue++; s.primaryDown = true; }
    s.primaryPressed = this.pressedQueue > 0; s.primaryReleased = this.releasedQueue > 0; s.secondaryPressed = this.secondaryQueue > 0; s.dashPressed = this.dashQueue > 0; s.swipeX = this.hQueue;
    this.pressedQueue = 0; this.releasedQueue = 0; this.secondaryQueue = 0; this.dashQueue = 0; this.hQueue = 0;
    const px = this.mirrored ? 1 - s.pointerX : s.pointerX;
    s.dir = s.primaryDown ? (px < 0.4 ? -1 : px > 0.6 ? 1 : 0) : 0;
    if (this.virtual) Object.assign(s, this.virtual);
    return s;
  }
  /** şu an basılı dokunuşu (ör. "Dokun ve başla") ve bekleyen girdileri yok say */
  consumeActive() { this.ignoring = true; this.resolved = true; this.state.primaryDown = false; this.pressedQueue = 0; this.releasedQueue = 0; this.secondaryQueue = 0; this.dashQueue = 0; this.hQueue = 0; }
  /** bot/araçlar: tek kare basma */
  tap() { this.pressedQueue++; this.releasedQueue++; }
  hold(ms: number) { this.pressedQueue++; this.state.primaryDown = true; this.scene.time.delayedCall(ms, () => { this.state.primaryDown = false; this.releasedQueue++; }); }
  swipeDown() { this.secondaryQueue++; }
  swipeRight() { this.dashQueue++; this.hQueue = 1; }
  swipeLeft() { this.hQueue = -1; }
}
