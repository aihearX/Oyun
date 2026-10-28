/**
 * Efektler: iniş tozu, zıplama pufu, nota parıltısı, vuruş flaşı, "Mükemmel" halkası, seri patlaması, kontrol noktası ışığı,
 * altın koklea toplama, ekran vinyeti ve yumuşak ışıklar. Hepsi önceden boyanmış dokular + toplamsal karışım; shader yok.
 * Parçacık yayıcıları bir kez kurulur, olaylarda `explode` ile kullanılır (kare başına ayırma yok).
 */
import Phaser from 'phaser';
import { artOf } from './palette';
import { R, T, dotTex, puffTex, ringTex, softGlowTex, sparkTex, drawGoldNote, drawGoldCochlea } from './tex';
import { canvasTex, FONT, screenOrigin, THEME } from './util';
import { fxQuality } from './quality';
import { FLASH, takeFlash } from './flash';

/** düşük kalitede parçacık sayısı azalır (en az 1) */
const q = (n: number) => Math.max(1, Math.round(n * fxQuality()));

const ADD = Phaser.BlendModes.ADD;
type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

export interface LevelFx {
  landDust(x: number, y: number, strength?: number): void;
  jumpPuff(x: number, y: number): void;
  noteSparkle(x: number, y: number): void;
  hitFlash(x?: number, y?: number): void;
  /** altın halka + parıltı; label: övgü sözü (null: söz yok — motor kendi yazısını gösteriyorsa) */
  perfectRing(x: number, y: number, label?: string | null): void;
  comboBurst(x: number, y: number, n?: number): void;
  checkpointLight(x: number, y: number): void;
  cochleaPickup(x: number, y: number): void;
  /** gizli altın koklea ipucu: (x0,y0)'dan koklea yönüne süzülüp yolun yarısında sönen birkaç ince kıvılcım (yeri söylemez, yönü fısıldar) */
  hintTrail(x0: number, y0: number, x1: number, y1: number): void;
  /** kalıcı yumuşak ışık (toplamsal); dönen görüntüyü motor taşır/yok eder */
  softGlow(x: number, y: number, color: number, size: number, alpha?: number): Phaser.GameObjects.Image;
  /** ekran kenarı vinyeti: 0..1 (varsayılan 0.55); renk (ör. hasar anında kırmızı) */
  setVignette(intensity: number, color?: number): void;
  /** görünüm boyutu değişti */
  resize(w: number, h: number): void;
  destroy(): void;
}

const vignetteTex = (s: Phaser.Scene) => canvasTex(s, 'fx-vignette', 256, 256, 1, (ctx) => {
  const g = ctx.createRadialGradient(128, 118, 70, 128, 128, 182); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
});
const noteMiniTex = (s: Phaser.Scene) => T(s, 'fx-note', 24, 26, (ctx) => drawGoldNote(ctx, 12, 13, 18, false));
const cochleaMiniTex = (s: Phaser.Scene) => T(s, 'fx-cochlea', 40, 40, (ctx) => drawGoldCochlea(ctx, 20, 20, 13));
const beamTex = (s: Phaser.Scene) => canvasTex(s, 'fx-beam', 64, 256, 1, (ctx) => {
  const g = ctx.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 256);
  ctx.globalCompositeOperation = 'destination-in'; const v = ctx.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.7, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, 64, 256);
});

export function createFx(scene: Phaser.Scene, biomeId: string): LevelFx {
  const s = scene; const A = artOf(biomeId); const cam = s.cameras.main;
  let vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
  const dustTint = [A.ground.topHi, A.ground.top, 0xffffff];
  const em = (key: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, depth = 30): Emitter => s.add.particles(0, 0, key, { emitting: false, ...cfg }).setDepth(depth);
  const dust = em(puffTex(s), { speed: { min: 30, max: 120 }, angle: { min: 190, max: 350 }, scale: { start: 0.42, end: 0.06 }, alpha: { start: 0.7, end: 0 }, lifespan: { min: 300, max: 520 }, gravityY: -30, tint: dustTint }, 19);
  const sparks = em(sparkTex(s), { speed: { min: 60, max: 210 }, angle: { min: 0, max: 360 }, scale: { start: 0.55, end: 0 }, rotate: { min: 0, max: 360 }, alpha: { start: 1, end: 0 }, lifespan: { min: 320, max: 620 }, gravityY: 220, blendMode: ADD, tint: [THEME.gold, 0xfff1a8, 0xffffff] });
  const dots = em(dotTex(s), { speed: { min: 20, max: 140 }, angle: { min: 0, max: 360 }, scale: { start: 0.8, end: 0 }, alpha: { start: 1, end: 0 }, lifespan: { min: 400, max: 800 }, blendMode: ADD, tint: [THEME.gold, THEME.teal, THEME.coral, THEME.violet, THEME.lime] });
  const notes = em(noteMiniTex(s), { speed: { min: 80, max: 200 }, angle: { min: 220, max: 320 }, scale: { start: 1 / R(), end: 0.2 / R() }, rotate: { min: -40, max: 40 }, alpha: { start: 1, end: 0 }, lifespan: 700, gravityY: 300 });
  const O0 = screenOrigin(cam);
  const vig = s.add.image(O0.x, O0.y, vignetteTex(s)).setOrigin(0, 0).setScrollFactor(0).setDepth(90).setTint(0x05001a).setAlpha(0.55).setDisplaySize(vw, vh);
  const flashI = s.add.image(O0.x, O0.y, vignetteTex(s)).setOrigin(0, 0).setScrollFactor(0).setDepth(91).setTint(THEME.hazard).setAlpha(0).setDisplaySize(vw, vh).setBlendMode(ADD);
  const ring = (x: number, y: number, tint: number, from: number, to: number, ms: number, sy = 1) => { const r = s.add.image(x, y, ringTex(s)).setBlendMode(ADD).setTint(tint).setDepth(31).setScale(from, from * sy); s.tweens.add({ targets: r, scaleX: to, scaleY: to * sy, alpha: 0, duration: ms, ease: 'Cubic.Out', onComplete: () => r.destroy() }); };
  const flare = (x: number, y: number, tint: number, size: number, ms: number) => { const g = s.add.image(x, y, softGlowTex(s)).setBlendMode(ADD).setTint(tint).setDepth(30).setDisplaySize(size * 0.4, size * 0.4).setAlpha(1); s.tweens.add({ targets: g, displayWidth: size, displayHeight: size, alpha: 0, duration: ms, ease: 'Cubic.Out', onComplete: () => g.destroy() }); };
  const praise = (x0: number, y: number, text: string, color: string) => {
    const wv = cam.worldView; const x = wv.width > 0 ? Math.max(wv.x + 70, Math.min(wv.right - 70, x0)) : x0;
    const t = s.add.text(x, y, text, { fontFamily: FONT, fontSize: '20px', fontStyle: '900', color, stroke: '#1a0b3e', strokeThickness: 5, resolution: R() }).setOrigin(0.5).setDepth(32).setScale(0.4);
    s.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.Out' }); s.tweens.add({ targets: t, y: y - 36, alpha: 0, delay: 420, duration: 360, onComplete: () => t.destroy() });
  };
  return {
    landDust(x, y, k = 0.6) { dust.explode(q(Math.round(4 + k * 8)), x, y - 2); if (k > 0.7) ring(x, y - 2, A.ground.topHi, 0.08, 0.5, 300, 0.25); },
    jumpPuff(x, y) { dust.explode(q(5), x, y - 2); ring(x, y - 2, 0xffffff, 0.06, 0.32, 240, 0.3); },
    noteSparkle(x, y) { sparks.explode(q(7), x, y); flare(x, y, THEME.gold, 80, 280); },
    hitFlash(x, y) {
      // ekran kenarı kırmızı vinyet nabzı: ışığa duyarlılık sınırı (≤ 0,35, ≤ 3/sn ortak sayaç, azaltılmış harekette yok; flash.ts)
      if (takeFlash(s.time.now)) { s.tweens.killTweensOf(flashI); flashI.setAlpha(FLASH.maxAlpha); s.tweens.add({ targets: flashI, alpha: 0, duration: 420, ease: 'Cubic.Out' }); }
      if (x != null && y != null) { flare(x, y, 0xffffff, 120, 200); ring(x, y, THEME.hazard, 0.1, 0.6, 320); const st = s.add.image(x, y, sparkTex(s)).setBlendMode(ADD).setDepth(32).setScale(1.4).setTint(0xffd0e0); s.tweens.add({ targets: st, scale: 0, angle: 90, duration: 260, onComplete: () => st.destroy() }); }
    },
    perfectRing(x, y, label = 'Mükemmel!') { ring(x, y, THEME.gold, 0.1, 0.9, 420); ring(x, y, 0xffffff, 0.05, 0.6, 320); sparks.explode(q(10), x, y); if (label) praise(x, y - 40, label, '#ffc93c'); },
    comboBurst(x, y, n = 10) { dots.explode(q(Math.min(40, 10 + n)), x, y); notes.explode(q(Math.min(8, 2 + Math.floor(n / 5))), x, y); flare(x, y, THEME.violet, 160, 380); },
    checkpointLight(x, y) {
      const b = s.add.image(x, y, beamTex(s)).setOrigin(0.5, 1).setBlendMode(ADD).setTint(THEME.gold).setDepth(29).setDisplaySize(10, 420).setAlpha(0.9);
      s.tweens.add({ targets: b, displayWidth: 70, alpha: 0, duration: 900, ease: 'Cubic.Out', onComplete: () => b.destroy() });
      ring(x, y - 70, THEME.gold, 0.1, 1.1, 600); sparks.explode(q(16), x, y - 70); flare(x, y - 70, THEME.gold, 220, 600);
    },
    cochleaPickup(x, y) {
      const c = s.add.image(x, y, cochleaMiniTex(s)).setDepth(33).setScale(1 / R());
      s.tweens.add({ targets: c, scale: 2.2 / R(), angle: 360, duration: 520, ease: 'Back.Out' });
      s.tweens.add({ targets: c, alpha: 0, y: y - 30, delay: 520, duration: 300, onComplete: () => c.destroy() });
      ring(x, y, THEME.gold, 0.1, 1.4, 700); ring(x, y, 0xffffff, 0.05, 0.8, 500); sparks.explode(q(24), x, y); dots.explode(q(20), x, y); flare(x, y, THEME.gold, 300, 700);
      praise(x, y - 52, 'Altın Koklea!', '#ffc93c');
    },
    hintTrail(x0, y0, x1, y1) {
      for (let i = 0; i < q(5); i++) {
        const sp = s.add.image(x0, y0, sparkTex(s)).setBlendMode(ADD).setTint(i % 2 ? THEME.gold : 0xfff1a8).setDepth(29).setScale(0.22).setAlpha(0);
        const k = 0.35 + i * 0.07;
        s.tweens.add({ targets: sp, x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, alpha: { from: 0.75, to: 0 }, scale: 0.08, angle: 160, delay: i * 110, duration: 900, ease: 'Sine.Out', onComplete: () => sp.destroy() });
      }
    },
    softGlow(x, y, color, size, alpha = 0.6) { return s.add.image(x, y, softGlowTex(s)).setBlendMode(ADD).setTint(color).setDisplaySize(size, size).setAlpha(alpha).setDepth(29); },
    setVignette(intensity, color = 0x05001a) { vig.setTint(color).setAlpha(intensity); },
    resize(w, h) { vw = w; vh = h; const O = screenOrigin(cam); vig.setPosition(O.x, O.y).setDisplaySize(vw, vh); flashI.setPosition(O.x, O.y).setDisplaySize(vw, vh); },
    destroy() { for (const o of [dust, sparks, dots, notes, vig, flashI]) o.destroy(); },
  };
}
