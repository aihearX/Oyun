/** Öğe görünümü: tüm öğeler aynı küçük durum API'sini taşıyan bir kap döndürür. */
import Phaser from 'phaser';
import type { EntityApi } from './types';

export type Handlers = Partial<{
  open(o: boolean): void; pulse(p: number): void; solid(s: boolean): void; reveal(a: number): void; crack(t: number): void;
  telegraph(): void; collect(): void; shatter(): void; facing(d: 1 | -1): void;
  /** bölge patolojisi (render/patoloji.ts): ilk görüşte rozet; malzemeyle etkisiz kalınca sönükleşir */
  sighted(): void; cured(): void;
}>;

export class EntityView extends Phaser.GameObjects.Container implements EntityApi {
  readonly kind: string;
  h: Handlers = {};
  private owned: (Phaser.Tweens.Tween | Phaser.Time.TimerEvent)[] = [];
  private gone = false;
  constructor(scene: Phaser.Scene, x: number, y: number, kind: string) {
    super(scene, x, y); this.kind = kind; scene.add.existing(this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => { this.gone = true; for (const o of this.owned) { if (o instanceof Phaser.Time.TimerEvent) o.remove(false); else o.remove(); } this.owned.length = 0; });
  }
  /** kaba bağlı tween (kap yok edilince durur) */
  tw(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Phaser.Tweens.Tween { const t = this.scene.tweens.add(cfg); this.owned.push(t); return t; }
  every(ms: number, fn: () => void, jitter = 0): void {
    const loop = () => { if (this.gone) return; fn(); const e = this.scene.time.delayedCall(ms + Math.random() * jitter, loop); this.owned.push(e); };
    const e = this.scene.time.delayedCall(Math.random() * ms, loop); this.owned.push(e);
  }
  get dead() { return this.gone; }
  setOpen(open: boolean) { this.h.open?.(open); }
  pulse(beatPhase: number) { this.h.pulse?.(beatPhase); }
  setSolid(solid: boolean) { this.h.solid?.(solid); }
  reveal(alpha: number) { this.h.reveal?.(alpha); }
  crack(t: number) { this.h.crack?.(t); }
  telegraph() { this.h.telegraph?.(); }
  collect() { if (this.h.collect) this.h.collect(); else this.fadeAway(); }
  shatter() { if (this.h.shatter) this.h.shatter(); else this.fadeAway(); }
  setFacing(dir: 1 | -1) { if (this.h.facing) this.h.facing(dir); else this.scaleX = Math.abs(this.scaleX) * dir; }
  fadeAway(ms = 220) { if (this.gone) return; this.tw({ targets: this, alpha: 0, scale: this.scale * 1.3, duration: ms, onComplete: () => this.destroy() }); }
}
