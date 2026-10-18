import type { Mechanic } from './types';
import { sfx } from '../audio';

const RUN_SPEED = 260;
const JUMP_V = 620;

/** Koşu: otomatik ilerleme; dokun zıpla (basılı tut yüksek), çift zıplama (yetenek), aşağı kaydır kay. */
export const kosu: Mechanic = {
  id: 'kosu',
  setup(ctx) {
    ctx.state.custom.jumps = 0; ctx.state.custom.slideUntil = 0; ctx.state.custom.holdUntil = 0; ctx.state.custom.coyote = 0;
    ctx.hero.body.setGravityY(0);
    if (ctx.spec.tutorial) ctx.hint('Dokun: zıpla · Basılı tut: yüksek · Aşağı kaydır: kay', 5000);
  },
  update(ctx, input, dt) {
    const { hero, state } = ctx; const b = hero.body; const now = ctx.scene.time.now;
    const g = state.gravityDir;
    const grounded = g === 1 ? b.blocked.down || b.touching.down : b.blocked.up || b.touching.up;
    if (grounded) { state.custom.jumps = 0; state.custom.coyote = now + 100; }
    b.setVelocityX(RUN_SPEED * state.speedMult);
    const sliding = (state.custom.slideUntil as number) > now;
    // kayma: hitbox küçülür
    if (sliding) { b.setSize(34, 22).setOffset(7, 26); hero.sprite.setScale(1.1, 0.55); }
    else { b.setSize(34, 44).setOffset(7, 4); if (!(hero.sprite.scaleY < 1) || now > (state.custom.slideUntil as number) + 120) hero.sprite.setScale(1, 1); }
    const canJump = grounded || now < (state.custom.coyote as number) || ((state.custom.jumps as number) < 1 && ctx.skills.doubleJump);
    // zıplama kaymayı iptal eder (kayarken kilitlenme hissi olmasın)
    if (input.primaryPressed && canJump) {
      if (sliding) { state.custom.slideUntil = 0; b.setSize(34, 44).setOffset(7, 4); hero.sprite.setScale(1, 1); }
      const second = !grounded && now >= (state.custom.coyote as number);
      b.setVelocityY(-JUMP_V * g * (second ? 0.85 : 1));
      state.custom.jumps = (state.custom.jumps as number) + (second ? 2 : 1);
      state.custom.coyote = 0; state.custom.holdUntil = now + 220;
      hero.stretch(); if (second) { sfx.doubleJump(); hero.mood('wow', 300); } else sfx.jump();
      ctx.haptic('light');
    }
    // basılı tutma: düşük yerçekimi penceresi
    if (input.primaryDown && now < (state.custom.holdUntil as number) && b.velocity.y * g < 0) b.setVelocityY(b.velocity.y - 1400 * 0.45 * dt * g);
    if (input.primaryReleased && b.velocity.y * g < 0) b.setVelocityY(b.velocity.y * 0.55);
    if (input.secondaryPressed && grounded) { state.custom.slideUntil = now + (ctx.skills.longSlide ? 900 : 500); sfx.tick(); ctx.haptic('light'); }
    if (input.secondaryPressed && !grounded) b.setVelocityY(900 * g); // hızlı düş
    void dt;
  },
  botTick(ctx, input, scan) {
    const b = ctx.hero.body; const now = ctx.scene.time.now; const feet = ctx.hero.y;
    const grounded = b.blocked.down || b.touching.down;
    const hz = scan.hazard;
    const low = hz && hz.y < feet - 60 && hz.y + hz.h < feet - 10 && hz.h < 120; // havada asılı engel: altından kay
    if (low && hz && hz.dist < 120 && grounded && (ctx.state.custom.slideUntil as number) < now) { input.swipeDown(); return; }
    const near = (d: number, lim = 110) => d < lim && d > -10;
    if (grounded) {
      const jumpHazard = hz && !low && near(hz.dist, hz.type === 'enemy' ? 130 : 110);
      const jumpGap = scan.gap && near(scan.gap.dist + 10, 120);
      const jumpStep = scan.step && scan.step.dist < 90 && scan.step.y < feet - 40;
      const jumpDrop = scan.drop && scan.drop.dist < 40 && ((hz && hz.dist < 320) || (scan.gap && scan.gap.dist < 320));
      if (jumpHazard || jumpGap || jumpStep || jumpDrop) input.hold(jumpGap && scan.gap && scan.gap.width > 150 ? 230 : 180);
    } else if (b.velocity.y > 0) {
      const canDouble = ctx.skills.doubleJump && (ctx.state.custom.jumps as number) === 1;
      const landingOnHazard = hz && hz.y > feet - 10 && hz.dist > -40 && hz.dist < 70;
      const longGap = scan.gap && scan.gap.dist <= 0 && scan.gap.width > 200;
      if (canDouble && (landingOnHazard || longGap)) input.tap();
    }
  },
};
