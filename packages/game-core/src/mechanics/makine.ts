import type Phaser from 'phaser';
import type { Entity } from '@odi/shared';
import { BIOMES } from '@odi/content';
import type { Mechanic, LevelContext } from './types';
import { sfx } from '../audio';
import { geometry, simulate, spawnNoteSequenced, grounded, type Circle, type SimResult } from './sim';

const RUN_SPEED = 260;
const JUMP_V = 620;
const LAUNCH_V = 520;      // teğet fırlatma hızı
const LAUNCH_UP = 140;     // fırlatmaya eklenen yukarı bileşen
const OMEGA = (Math.PI * 2) / 4; // rad/s (speed=1 → 4 s'de tam tur; entities.ts dişli tween'iyle aynı)
const RIM_PAD = 4;         // ayak, dişli yarıçapı + bu kadar dışarıda

type ASprite = Phaser.Physics.Arcade.Sprite;
interface MakState {
  gear: ASprite | null; gx: number; gy: number; r: number; speed: number; dir: number; angle: number; turns: number; hinted: boolean; attachedAt: number;
  detachUntil: number; flying: boolean; launchVx: number;
  jumps: number; slideUntil: number; holdUntil: number; coyote: number; wasAirborne: boolean; tutorialShown: boolean;
}
let st: MakState;
const reset = (): MakState => ({ gear: null, gx: 0, gy: 0, r: 40, speed: 1, dir: 1, angle: 0, turns: 0, hinted: false, attachedAt: 0, detachUntil: 0, flying: false, launchVx: 0, jumps: 0, slideUntil: 0, holdUntil: 0, coyote: 0, wasAirborne: false, tutorialShown: false });

/** dişli dokusu: dişler, göbek ve tutunma halkası */
function gearTex(s: Phaser.Scene, r: number, color: number, accent: number): string {
  const key = `mgear-${r}-${color}`; const pad = 24; const S = (r + pad) * 2; const c = r + pad;
  if (!s.textures.exists(key)) {
    const g = s.add.graphics();
    g.lineStyle(2, accent, 0.35); g.strokeCircle(c, c, r + 18);                       // tutunma halkası
    const teeth = Math.max(8, Math.round(r / 5));
    g.fillStyle(color, 1);
    for (let i = 0; i < teeth; i++) { const a = (i / teeth) * Math.PI * 2; const tx = c + Math.cos(a) * (r - 4), ty = c + Math.sin(a) * (r - 4); g.save(); g.translateCanvas(tx, ty); g.rotateCanvas(a); g.fillRoundedRect(-5, -7, 12, 14, 3); g.restore(); }
    g.fillCircle(c, c, r - 4);
    g.fillStyle(0xffffff, 0.22); g.fillCircle(c, c, r * 0.55);
    g.fillStyle(accent, 0.9); g.fillCircle(c, c, 7);
    g.lineStyle(3, 0xffffff, 0.35); for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; g.beginPath(); g.moveTo(c + Math.cos(a) * 10, c + Math.sin(a) * 10); g.lineTo(c + Math.cos(a) * (r * 0.5), c + Math.sin(a) * (r * 0.5)); g.strokePath(); }
    g.generateTexture(key, S, S); g.destroy();
  }
  return key;
}

function detach(ctx: LevelContext, vy: number, flying: boolean, vx = 0) {
  const b = ctx.hero.body; const s = ctx.hero.sprite;
  st.gear = null; st.detachUntil = ctx.scene.time.now + 420; st.flying = flying; st.launchVx = vx;
  s.setRotation(0); b.setAllowGravity(true); b.setVelocity(vx, vy);
}

function attach(ctx: LevelContext, g: ASprite, e: Entity) {
  const b = ctx.hero.body; const now = ctx.scene.time.now;
  st.gear = g; st.gx = g.x; st.gy = g.y; st.r = Number(e.props?.r ?? 40); st.speed = Number(e.props?.speed ?? 1); st.dir = Number(e.props?.dir ?? 1) < 0 ? -1 : 1;
  st.angle = Math.atan2(b.center.y - g.y, b.center.x - g.x); st.turns = 0; st.hinted = false; st.attachedAt = now; st.flying = false;
  b.setAllowGravity(false); b.setVelocity(0, 0); b.setSize(34, 44).setOffset(7, 4); ctx.hero.sprite.setScale(1, 1);
  sfx.tick(); ctx.haptic('light'); ctx.hero.mood('wow', 250);
  ctx.scene.tweens.add({ targets: g, scale: 1.08, duration: 90, yoyo: true });
  if (ctx.spec.tutorial && !st.tutorialShown) { st.tutorialShown = true; ctx.hint('Tutundun! Dokun: teğet yönde fırla · Aşağı kaydır: bırak', 3500); }
}

/** teğet fırlatma hızı (dişli açısına göre) */
function launchVel(angle: number, dir: number): { x: number; y: number } {
  const tx = -Math.sin(angle) * dir, ty = Math.cos(angle) * dir;
  return { x: LAUNCH_V * tx, y: LAUNCH_V * ty - LAUNCH_UP };
}

/** Makine: yerde koşu + tek zıplama; dişliye değince tutun, dokununca teğet yönde fırla, aşağı kaydır bırak. */
export const makine: Mechanic = {
  id: 'makine',
  setup(ctx) {
    st = reset(); ctx.state.custom.noteSeq = 0; ctx.hero.body.setGravityY(0);
    if (ctx.spec.tutorial) ctx.hint('Dokun: zıpla · Dişliye değ: tutun · Dokun: fırla', 4500);
  },
  spawn(ctx, e, worldX) {
    if (e.type === 'note') return spawnNoteSequenced(ctx, e, worldX);
    if (e.type !== 'gear') return false;
    const s = ctx.scene; const p = BIOMES[ctx.spec.biome].palette; const r = Number(e.props?.r ?? 40); const speed = Number(e.props?.speed ?? 1); const dir = Number(e.props?.dir ?? 1) < 0 ? -1 : 1;
    const key = gearTex(s, r, p.groundDark, p.accent); const pad = 24;
    const o = ctx.groups.specials.create(worldX + e.x, e.y, key) as ASprite;
    o.setOrigin(0.5, 0.5).setDepth(7); o.setData('e', e); o.setData('wx', worldX + e.x);
    const body = o.body as Phaser.Physics.Arcade.Body; body.setAllowGravity(false); body.setImmovable(true); body.setCircle(r + 6, pad - 6, pad - 6);
    s.tweens.add({ targets: o, angle: 360 * dir, duration: 4000 / Math.max(0.2, speed), repeat: -1 });
    return true;
  },
  onSpecial(ctx, sprite, e) {
    if (e.type !== 'gear') return false;
    if (st.gear) return true;
    if (ctx.scene.time.now < st.detachUntil) return true;
    attach(ctx, sprite, e);
    return true;
  },
  update(ctx, input, dt) {
    const { hero, state } = ctx; const b = hero.body; const now = ctx.scene.time.now; const g = state.gravityDir;
    // ---- dişlide
    if (st.gear) {
      if (!st.gear.active) { detach(ctx, 0, false); }
      else {
        const da = OMEGA * st.speed * st.dir * dt; st.angle += da; st.turns += Math.abs(da) / (Math.PI * 2);
        const R = st.r + RIM_PAD; const fx = st.gx + Math.cos(st.angle) * R, fy = st.gy + Math.sin(st.angle) * R;
        hero.sprite.setPosition(fx, fy); hero.sprite.setRotation(st.angle + Math.PI / 2); b.setVelocity(0, 0);
        if (st.turns >= 1.5 && !st.hinted) { st.hinted = true; ctx.hint('Dokun: fırla', 1800); }
        if (input.primaryPressed) {
          const v = launchVel(st.angle, st.dir); const gs = st.gear;
          detach(ctx, v.y, true, v.x);
          hero.stretch(); sfx.jump(); ctx.haptic('medium'); hero.mood('wow', 300);
          ctx.scene.tweens.add({ targets: gs, scale: 0.92, duration: 70, yoyo: true });
        } else if (input.secondaryPressed) { detach(ctx, 160, false); sfx.tick(); ctx.haptic('light'); }
        return;
      }
    }
    // ---- yerde / havada
    const onGround = grounded(ctx);
    if (onGround) { st.jumps = 0; st.coyote = now + 100; st.flying = false; }
    b.setVelocityX(st.flying ? st.launchVx : RUN_SPEED * state.speedMult);
    const sliding = st.slideUntil > now;
    if (sliding) { b.setSize(34, 22).setOffset(7, 26); hero.sprite.setScale(1.1, 0.55); }
    else { b.setSize(34, 44).setOffset(7, 4); if (!(hero.sprite.scaleY < 1) || now > st.slideUntil + 120) hero.sprite.setScale(1, 1); }
    const canJump = (onGround || now < st.coyote) && st.jumps < 1;
    if (input.primaryPressed && canJump && !sliding) {
      b.setVelocityY(-JUMP_V * g); st.jumps = 1; st.coyote = 0; st.holdUntil = now + 220;
      hero.stretch(); sfx.jump(); ctx.haptic('light');
    }
    if (input.primaryDown && now < st.holdUntil && b.velocity.y * g < 0) b.setVelocityY(b.velocity.y - 1400 * 0.45 * dt * g);
    if (input.primaryReleased && b.velocity.y * g < 0 && st.jumps === 1 && !st.flying) b.setVelocityY(b.velocity.y * 0.55);
    if (input.secondaryPressed && onGround) { st.slideUntil = now + (ctx.skills.longSlide ? 900 : 500); sfx.tick(); ctx.haptic('light'); }
    if (input.secondaryPressed && !onGround) b.setVelocityY(900 * g);
    if (onGround && st.wasAirborne) hero.squash(1.2, 0.8, 70);
    st.wasAirborne = !onGround;
  },
  onDamage(ctx) { if (st.gear) detach(ctx, -200, false); st.flying = false; },
  botTick(ctx, input) {
    const { hero } = ctx; const b = hero.body; const now = ctx.scene.time.now; const feet = hero.y;
    const geo = geometry(ctx, 1100);
    const good = (r: SimResult) => r.kind === 'ok' || r.kind === 'bounce' || r.kind === 'gear';

    // ---- dişlide: hedefe bakan teğet + güvenli yörünge → dokun
    if (st.gear) {
      const cur: Circle | undefined = geo.gears.find((c) => c.sprite === st.gear);
      const v = launchVel(st.angle, st.dir);
      const r = simulate(geo, { x: hero.x, y: feet, vx: v.x, vy: v.y, ignoreGear: cur ?? null, ignoreUntil: 0.45, maxT: 3 });
      let score = -1;
      if (r.kind === 'gear' && r.gear) score = r.gear.x > st.gx + 10 ? 3 : -1;
      else if (r.kind === 'bounce') score = 2;
      else if (r.kind === 'ok') score = r.landX != null ? (r.landX > st.gx + st.r * 0.5 ? 2 : 0) : -1;
      // hedef: sağdaki en yakın dişli, yoksa sağdaki platform
      let aim: { x: number; y: number } | null = null;
      const nextGear = geo.gears.filter((c) => c.x > st.gx + 10 && c.x - st.gx < 760).sort((a, c) => a.x - c.x)[0];
      if (nextGear) aim = { x: nextGear.x, y: nextGear.y - 10 };
      else { const sup = geo.supports.filter((s) => s.r > st.gx + st.r && s.l - st.gx < 640).sort((a, c) => a.l - c.l)[0]; if (sup) aim = { x: Math.max(sup.l + 50, st.gx + st.r + 60), y: sup.t - 30 }; }
      let aimOk = false;
      if (aim) {
        const want = Math.atan2(aim.y - feet, aim.x - hero.x) - 0.3; // biraz yukarı nişan
        let d = Math.atan2(v.y, v.x) - want; d = Math.atan2(Math.sin(d), Math.cos(d));
        aimOk = Math.abs(d) <= (15 * Math.PI) / 180;
      }
      const elapsed = now - st.attachedAt;
      if (score >= 2 && (aimOk || !aim || st.turns >= 1.1)) input.tap();
      else if (score >= 0 && st.turns >= 2.6) input.tap();
      else if (elapsed > 14000 && st.turns >= 4) input.swipeDown();
      return;
    }
    if (!grounded(ctx)) return;
    // ---- yerde: hiçbir şey yapma / tam zıpla / kısa zıpla / kay — ilk güvenli seçenek
    const vx = RUN_SPEED * ctx.state.speedMult; const base = { x: hero.x, y: feet, vx };
    if (st.slideUntil > now) return;
    const none = simulate(geo, { ...base, vy: 0, maxT: 1.2 });
    if (good(none)) return;
    const full = simulate(geo, { ...base, vy: -JUMP_V, lowGravUntil: 0.22, releaseAt: 0.6, maxT: 2.4 });
    if (good(full)) { input.hold(600); return; }
    const short = simulate(geo, { ...base, vy: -JUMP_V, lowGravUntil: 0.22, releaseAt: 0.06, maxT: 2 });
    if (good(short)) { input.tap(); return; }
    const slide = simulate(geo, { ...base, vy: 0, slideUntil: 0.5, maxT: 1.2 });
    if (good(slide) && none.kind === 'hazard' && none.t < 0.45) { input.swipeDown(); return; }
  },
  teardown(ctx) { ctx.hero.sprite.setRotation(0); },
};

