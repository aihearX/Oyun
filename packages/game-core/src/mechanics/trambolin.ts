import type Phaser from 'phaser';
import type { Entity } from '@odi/shared';
import type { Mechanic, LevelContext } from './types';
import { sfx } from '../audio';
import { geometry, simulate, spawnNoteSequenced, grounded, type Box } from './sim';

const RUN_SPEED = 260;
const BOUNCE_V = 900;
const PERFECT_MULT = 1.45;
const PERFECT_WINDOW = 120;   // ms: temasın ± penceresi
const FLOAT_CAP = 230;        // basılı tutarken en yüksek düşüş hızı
const DIVE_V = 900;

interface TramState {
  lastTapAt: number; lastBounceAt: number; lastBouncer: Phaser.GameObjects.GameObject | null; bouncePower: number; upgraded: boolean;
  wasAirborne: boolean; perfects: number;
  // bot
  plan: 'normal' | 'perfect' | null; planFor: Phaser.GameObjects.GameObject | null; tapped: boolean; floating: boolean;
}
let st: TramState;

const reset = (): TramState => ({ lastTapAt: -1e9, lastBounceAt: -1e9, lastBouncer: null, bouncePower: 1, upgraded: false, wasAirborne: false, perfects: 0, plan: null, planFor: null, tapped: false, floating: false });

function perfectFx(ctx: LevelContext) {
  const { hero } = ctx; st.perfects++;
  ctx.float(hero.x, hero.y - 80, 'Mükemmel!', '#ff4f7a'); ctx.flash(0xffffff); ctx.haptic('medium');
  sfx.toneAt(880, 0.08); ctx.scene.time.delayedCall(70, () => sfx.toneAt(1320, 0.14));
  hero.mood('wow', 400); ctx.state.score += 25;
}

/** trambolin/yay temasında sıçrama; zamanlama tutarsa mükemmel */
function bounce(ctx: LevelContext, s: Phaser.Physics.Arcade.Sprite, e: Entity) {
  const b = ctx.hero.body; const now = ctx.scene.time.now; const g = ctx.state.gravityDir;
  const power = Number(e.props?.power ?? 1);
  const sb = s.body as Phaser.Physics.Arcade.Body;
  // iniş: ayakları üst yüzeye oturt (görsel temizlik)
  if (g === 1 && ctx.hero.y > sb.top && ctx.hero.y < sb.top + 60) ctx.hero.sprite.y = sb.top;
  const perfect = now - st.lastTapAt <= PERFECT_WINDOW;
  const v = BOUNCE_V * power * (perfect ? PERFECT_MULT : 1);
  b.setVelocityY(-v * g);
  st.lastBounceAt = now; st.lastBouncer = s; st.bouncePower = power; st.upgraded = perfect;
  ctx.hero.stretch(); sfx.bounce(); ctx.haptic(perfect ? 'medium' : 'light');
  ctx.scene.tweens.add({ targets: s, scaleY: 0.55, duration: 90, yoyo: true });
  if (perfect) perfectFx(ctx);
}

/** Trambolin: otomatik koşu, zıplama yok; yalnızca zar/yay sıçratır. Temasın ±120 ms'inde dokun → ×1.45. */
export const trambolin: Mechanic = {
  id: 'trambolin',
  setup(ctx) {
    st = reset(); ctx.state.custom.noteSeq = 0;
    ctx.hero.body.setGravityY(0);
    if (ctx.spec.tutorial) ctx.hint('Zıplayamazsın: zar seni fırlatır. Zara değdiğin an dokun → Mükemmel!', 5000);
  },
  spawn(ctx, e, worldX) { return spawnNoteSequenced(ctx, e, worldX); },
  onSpecial(ctx, sprite, e) {
    if (e.type !== 'trampoline' && e.type !== 'spring') return false;
    const b = ctx.hero.body; const g = ctx.state.gravityDir;
    const now = ctx.scene.time.now;
    if (now - st.lastBounceAt < 150) return true;             // aynı temas
    if (b.velocity.y * g < -1) return true;                   // yükselirken temas yok
    const sb = sprite.body as Phaser.Physics.Arcade.Body;
    if (g === 1 && b.bottom < sb.top - 4) return true;         // henüz değmedi
    bounce(ctx, sprite, e);
    return true;
  },
  update(ctx, input, dt) {
    const { hero, state } = ctx; const b = hero.body; const now = ctx.scene.time.now; const g = state.gravityDir;
    const onGround = grounded(ctx);
    b.setVelocityX(RUN_SPEED * state.speedMult);
    b.setSize(34, 44).setOffset(7, 4);
    if (input.primaryPressed) {
      st.lastTapAt = now;
      // geç dokunuş: sıçramadan hemen sonra geldiyse mükemmele yükselt
      if (!st.upgraded && now - st.lastBounceAt <= PERFECT_WINDOW && b.velocity.y * g < 0) {
        st.upgraded = true; b.setVelocityY(-BOUNCE_V * st.bouncePower * PERFECT_MULT * g); perfectFx(ctx);
      }
    }
    // havada basılı tutma: süzülme
    const floating = !onGround && input.primaryDown && b.velocity.y * g >= FLOAT_CAP;
    b.setGravityY(floating ? -1400 * g : 0); // süzülme: yerçekimi askıya (kare hızından bağımsız)
    if (floating) { if (b.velocity.y * g > FLOAT_CAP + 1) b.setVelocityY(FLOAT_CAP * g); hero.sprite.setScale(1.12, 0.92); }
    else if (!onGround && Math.abs(hero.sprite.scaleX - 1) > 0.05 && now - st.lastBounceAt > 250) hero.sprite.setScale(1, 1);
    // aşağı kaydırma: dalış
    if (input.secondaryPressed && !onGround) { b.setVelocityY(Math.max(b.velocity.y * g, DIVE_V) * g); sfx.tick(); ctx.haptic('light'); hero.sprite.setScale(0.85, 1.2); }
    // iniş squash'ı LevelScene (iniş tozu) yapar
    st.wasAirborne = !onGround;
    void dt;
  },
  onDamage() { st.plan = null; st.planFor = null; },
  botTick(ctx, input) {
    const { hero } = ctx; const b = hero.body; const now = ctx.scene.time.now; const feet = hero.y;
    const onGround = grounded(ctx); const vx = RUN_SPEED * ctx.state.speedMult;
    const geo = geometry(ctx, 1100);
    const stopFloat = () => { if (st.floating) { st.floating = false; input.virtual = null; } };
    const good = (k: string) => k === 'ok' || k === 'bounce' || k === 'gear';

    // sıçramanın hemen ardından: planlanan mükemmel için geç dokunuş
    if (st.plan === 'perfect' && st.planFor === st.lastBouncer && !st.upgraded && now - st.lastBounceAt <= PERFECT_WINDOW - 20 && b.velocity.y < 0) { input.tap(); st.plan = null; st.tapped = true; return; }

    // bir sonraki temas tahmini
    let contact: { bouncer: Box; x: number; t: number } | null = null;
    if (onGround) {
      for (const bo of geo.bouncers) { const d = bo.l - (hero.x + 17); if (d >= -4 && d < 70 && Math.abs(bo.b - feet) <= 8) contact = { bouncer: bo, x: bo.l - 17, t: Math.max(0, d) / vx }; }
    } else if (b.velocity.y > -1) {
      const r = simulate(geo, { x: hero.x, y: feet, vx, vy: b.velocity.y, maxT: 2.5, postLand: 1.2 });
      if (r.kind === 'bounce' && r.bouncer) contact = { bouncer: r.bouncer, x: r.x, t: r.t };
      else if (!good(r.kind)) {
        // tehlikeli iniş: dalış ya da süzülme kurtarır mı?
        const dive = simulate(geo, { x: hero.x, y: feet, vx, vy: DIVE_V, maxT: 2.5, postLand: 1.2 });
        if (good(dive.kind) && !st.floating) { input.swipeDown(); return; }
        const fl = simulate(geo, { x: hero.x, y: feet, vx, vy: Math.min(b.velocity.y, FLOAT_CAP), floatCap: FLOAT_CAP, maxT: 3, postLand: 1.2 });
        if (good(fl.kind)) { if (!st.floating) { st.floating = true; input.virtual = { primaryDown: true }; } return; }
        stopFloat(); return;
      } else stopFloat();
    } else { stopFloat(); return; }
    if (!contact) { stopFloat(); st.plan = null; return; }

    // temas sonrası: normal mi mükemmel mi? (güvenli olan; eşitse jeton sayısı, sonra mükemmel)
    if (st.planFor !== contact.bouncer.sprite) {
      const p = Number(contact.bouncer.e.props?.power ?? 1);
      const from = { x: contact.x, y: contact.bouncer.t, vx, maxT: 3.2, postLand: 1.5 };
      const n = simulate(geo, { ...from, vy: -BOUNCE_V * p });
      const q = simulate(geo, { ...from, vy: -BOUNCE_V * p * PERFECT_MULT });
      const nOk = good(n.kind), qOk = good(q.kind);
      st.plan = qOk && (!nOk || q.coins >= n.coins) ? 'perfect' : nOk ? 'normal' : 'perfect';
      st.planFor = contact.bouncer.sprite; st.tapped = false;
    }
    if (st.plan === 'perfect' && !st.tapped) {
      const frame = Math.max(0.05, ctx.scene.game.loop.delta / 1000);
      if (contact.t <= Math.max(0.045, frame * 1.1) || (!onGround && contact.bouncer.t - feet < 40 && b.velocity.y > 0)) { input.tap(); st.tapped = true; }
    }
    stopFloat();
  },
  teardown(ctx) { ctx.input.virtual = null; },
};
