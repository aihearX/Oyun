import Phaser from 'phaser';
import { GAME_W, GAME_H, GROUND_Y } from '@odi/shared';
import type { InputState } from '@odi/shared';
import type { LevelContext, Mechanic } from './types';
import type { TouchInput } from '../input';
import { sfx } from '../audio';
import { emojiTexture, roundRectTexture } from '../art';
import { FONT, COLORS } from '../ui';

/**
 * Boss savaşları: sabit kameralı arena, serbest koşu (sol/sağ yarıya basılı), dokun zıpla, aşağı kaydır kay.
 * - serumen-golemi (bölüm 20, kanal): yere yumruk (gölge → 600 ms → yumruk) · kaçırınca sersemler → kafasına zıpla.
 *   Faz 2: yuvarlanan serumen topları. Faz 3: hızlı çift yumruk.
 * - gurultu-canavari (bölüm 40, korteks): ses dalgaları (alçak: zıpla · yüksek: kay), gürültü (girişler 100 ms gecikir),
 *   bağırırken beliren 3 notayı topla → ağzına fırlar → sersemler → ezme ile hasar. Yenilince ninni.
 */

const RUN_SPEED = 240;
const JUMP_V = 620;
const ARENA_L = 0;
const ARENA_R = ARENA_L + GAME_W;
const CAM_Y = 120;
const BOSS_X = ARENA_R - 78;
const HERO_MIN = ARENA_L + 22;
const HERO_MAX = ARENA_R - 22;

type Kind = 'golem' | 'canavar';
type Mode = 'idle' | 'warn' | 'slam' | 'stun' | 'recover' | 'attack' | 'scream';
type WaveKind = 'low' | 'high';

interface BossState {
  kind: Kind; name: string; hp: number; maxHp: number; phase: number; phases: number; defeated: boolean; camLocked: boolean;
  /** fizikle tutarlı saat (ms): loop.delta birikimi; time.now duvar saati olduğundan düşük fps'de ayrışır */
  clock: number; contactSafeUntil: number; telegraphAt: number;
  sprite: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; bar: Phaser.GameObjects.Graphics; nameText: Phaser.GameObjects.Text;
  mode: Mode; modeUntil: number; stunHits: number; hintedStun: boolean;
  /** golem */
  targets: number[]; shadows: Phaser.GameObjects.Image[]; fists: Phaser.GameObjects.Image[]; balls: Phaser.Physics.Arcade.Sprite[]; nextBallAt: number;
  /** canavar */
  waves: { s: Phaser.Physics.Arcade.Sprite; kind: WaveKind }[]; notes: Phaser.GameObjects.Image[]; noteCount: number; nextWaveAt: number; nextScreamAt: number;
  jamUntil: number; nextJamAt: number; jamOverlay: Phaser.GameObjects.Rectangle; delayed: { at: number; key: 'primaryPressed' | 'secondaryPressed' }[];
  /** kahraman */
  slideUntil: number; holdUntil: number; coyote: number; knockUntil: number; botJumpAt: number; botSlideAt: number;
}

let S: BossState | null = null;

// ---------- dokular (Graphics ile; varlık dosyası yok)
function golemTexture(s: Phaser.Scene): string {
  const key = 'boss-golem';
  if (s.textures.exists(key)) return key;
  const g = s.add.graphics();
  g.fillStyle(0x8a5a28, 0.6); g.fillEllipse(65, 132, 122, 16);
  g.fillStyle(0xc9a24a, 1); g.fillEllipse(65, 86, 118, 104);
  g.fillStyle(0xb8903d, 1); g.fillCircle(24, 102, 22); g.fillCircle(106, 102, 22);
  g.fillStyle(0x9c6b2f, 1); g.fillCircle(40, 110, 9); g.fillCircle(92, 118, 7); g.fillCircle(70, 124, 6); g.fillCircle(100, 86, 5);
  g.fillStyle(0xd4b25a, 1); g.fillCircle(65, 42, 40);
  g.fillStyle(0xffffff, 0.25); g.fillCircle(50, 28, 12);
  g.fillStyle(0xffffff, 1); g.fillCircle(50, 42, 10); g.fillCircle(80, 42, 10);
  g.fillStyle(0x13162a, 1); g.fillCircle(52, 43, 5); g.fillCircle(78, 43, 5);
  g.lineStyle(5, 0x6b3a1a, 1); g.beginPath(); g.moveTo(36, 26); g.lineTo(58, 35); g.strokePath(); g.beginPath(); g.moveTo(94, 26); g.lineTo(72, 35); g.strokePath();
  g.lineStyle(4, 0x4a2a10, 1); g.beginPath(); g.arc(65, 66, 13, Math.PI * 1.1, Math.PI * 1.9); g.strokePath();
  g.generateTexture(key, 130, 140); g.destroy();
  return key;
}
function fistTexture(s: Phaser.Scene): string {
  const key = 'boss-fist';
  if (s.textures.exists(key)) return key;
  const g = s.add.graphics();
  g.fillStyle(0xb8903d, 1); g.fillRoundedRect(4, 10, 76, 58, 22);
  g.fillStyle(0x8a5a28, 1); g.fillRoundedRect(4, 52, 76, 16, { tl: 0, tr: 0, bl: 22, br: 22 });
  g.fillStyle(0xd4b25a, 1); for (let i = 0; i < 4; i++) g.fillCircle(16 + i * 17, 16, 9);
  g.generateTexture(key, 84, 70); g.destroy();
  return key;
}
function ballTexture(s: Phaser.Scene): string {
  const key = 'boss-ball';
  if (s.textures.exists(key)) return key;
  const g = s.add.graphics();
  g.fillStyle(0xc9a24a, 1); g.fillCircle(20, 20, 19);
  g.lineStyle(4, 0x8a5a28, 1); g.beginPath(); g.arc(20, 20, 11, 0, Math.PI * 1.5); g.strokePath();
  g.fillStyle(0xffffff, 0.3); g.fillCircle(13, 12, 5);
  g.generateTexture(key, 40, 40); g.destroy();
  return key;
}
function shadowTexture(s: Phaser.Scene): string {
  const key = 'boss-shadow';
  if (s.textures.exists(key)) return key;
  const g = s.add.graphics();
  g.fillStyle(0x000000, 0.35); g.fillEllipse(50, 12, 96, 22);
  g.fillStyle(0xe5484d, 0.6); g.fillEllipse(50, 12, 60, 12);
  g.generateTexture(key, 100, 24); g.destroy();
  return key;
}
function glowTexture(s: Phaser.Scene): string {
  const key = 'boss-glow';
  if (s.textures.exists(key)) return key;
  const g = s.add.graphics();
  g.fillStyle(0xffe066, 0.3); g.fillCircle(44, 44, 44); g.fillStyle(0xffe066, 0.55); g.fillCircle(44, 44, 28); g.fillStyle(0xfff6b0, 0.95); g.fillCircle(44, 44, 12);
  g.generateTexture(key, 88, 88); g.destroy();
  return key;
}
function monsterTexture(s: Phaser.Scene, phase: number, open: boolean): string {
  const key = `boss-canavar-${phase}-${open ? 1 : 0}`;
  if (s.textures.exists(key)) return key;
  const body = [0x4a2a6a, 0x5a1f4a, 0x1a0f2a][phase - 1] ?? 0x4a2a6a;
  const spike = [0x2a163a, 0x3a0f2a, 0x0a0510][phase - 1] ?? 0x2a163a;
  const eye = [0xff4fd8, 0xff6b3d, 0xff2d2d][phase - 1] ?? 0xff4fd8;
  const g = s.add.graphics();
  g.fillStyle(spike, 1);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const a1 = a - 0.16, a2 = a + 0.16; g.fillTriangle(75 + Math.cos(a1) * 60, 72 + Math.sin(a1) * 52, 75 + Math.cos(a2) * 60, 72 + Math.sin(a2) * 52, 75 + Math.cos(a) * 76, 72 + Math.sin(a) * 66); }
  g.fillStyle(body, 1); g.fillCircle(75, 72, 52); g.fillCircle(40, 84, 34); g.fillCircle(110, 84, 34); g.fillCircle(58, 46, 28); g.fillCircle(94, 46, 28); g.fillCircle(75, 100, 36);
  g.fillStyle(0xffffff, 0.08); g.fillCircle(55, 40, 16);
  g.fillStyle(eye, 1); g.fillCircle(55, 58, 11); g.fillCircle(95, 58, 11);
  g.fillStyle(0x000000, 1); g.fillCircle(57, 59, 5); g.fillCircle(93, 59, 5);
  g.lineStyle(5, 0x000000, 1); g.beginPath(); g.moveTo(40, 42); g.lineTo(64, 50); g.strokePath(); g.beginPath(); g.moveTo(110, 42); g.lineTo(86, 50); g.strokePath();
  if (open) {
    g.fillStyle(0x1a0208, 1); g.fillEllipse(75, 96, 76, 46);
    g.fillStyle(0xd9304f, 1); g.fillEllipse(75, 110, 34, 16);
    g.fillStyle(0xffffff, 1); for (let i = 0; i < 5; i++) { const x = 44 + i * 15; g.fillTriangle(x, 74, x + 12, 74, x + 6, 86); g.fillTriangle(x, 118, x + 12, 118, x + 6, 106); }
  } else {
    g.lineStyle(6, 0x0a0510, 1); g.beginPath(); g.moveTo(42, 94); g.lineTo(56, 104); g.lineTo(70, 94); g.lineTo(84, 104); g.lineTo(98, 94); g.lineTo(110, 102); g.strokePath();
    g.fillStyle(0xffffff, 1); g.fillTriangle(50, 95, 60, 95, 55, 104); g.fillTriangle(78, 95, 88, 95, 83, 104);
  }
  g.generateTexture(key, 150, 130); g.destroy();
  return key;
}
function waveTexture(s: Phaser.Scene, kind: WaveKind): string {
  const key = `boss-wave-${kind}`;
  if (s.textures.exists(key)) return key;
  const w = 26, h = kind === 'low' ? 28 : 40;
  const g = s.add.graphics();
  g.fillStyle(kind === 'low' ? 0xff5c5c : 0xc44dff, 0.9); g.fillRoundedRect(0, 0, w, h, 6);
  g.lineStyle(3, 0xffffff, 0.85); g.beginPath(); for (let y = 0; y <= h; y += 2) { const x = w / 2 + Math.sin((y / h) * Math.PI * 3) * 7; if (y === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.strokePath();
  g.generateTexture(key, w, h); g.destroy();
  return key;
}
function sparkTexture(s: Phaser.Scene): string {
  const key = 'boss-spark';
  if (s.textures.exists(key)) return key;
  const g = s.add.graphics(); g.fillStyle(0xffffff, 1); g.fillCircle(5, 5, 5); g.generateTexture(key, 10, 10); g.destroy();
  return key;
}

// ---------- yardımcılar
const now = (ctx: LevelContext) => S?.clock ?? ctx.scene.time.now;
const grounded = (ctx: LevelContext) => { const b = ctx.hero.body; return b.blocked.down || b.touching.down; };
/** Kahramanın çarpışma kutusu: ayak tabanından yukarı; kayarken 12 px (fizik gövdesinin bir karelik gecikmesine bağlı kalmaz). */
function heroBox(ctx: LevelContext): { l: number; r: number; t: number; b: number } {
  const b = ctx.hero.body; const sliding = !!S && S.slideUntil > now(ctx); const h = sliding ? 12 : 44; const cx = b.center.x;
  return { l: cx - 17, r: cx + 17, t: b.bottom - h, b: b.bottom };
}
function overlapRect(ctx: LevelContext, l: number, t: number, r: number, btm: number): boolean {
  const h = heroBox(ctx); return h.l < r && h.r > l && h.t < btm && h.b > t;
}
function overlapBody(ctx: LevelContext, o: Phaser.Physics.Arcade.Body): boolean {
  return overlapRect(ctx, o.left, o.top, o.right, o.bottom);
}
/** boss'tan hasar: can düşer, geri tepme */
function hurtHero(ctx: LevelContext, fromX: number, src: string) {
  if (!S || S.defeated) return;
  if (ctx.damage('boss')) {
    const dir = ctx.hero.x < fromX ? -1 : 1; ctx.hero.body.setVelocity(300 * dir, -340); S.knockUntil = now(ctx) + 260;
    // QA/harness: son vuruşun kaynağı ve durumu
    ctx.state.custom.bossLastHit = `${src} mode=${S.mode} ph=${S.phase} hx=${Math.round(ctx.hero.x)} hy=${Math.round(ctx.hero.y)} g=${grounded(ctx) ? 1 : 0} sl=${S.slideUntil > now(ctx) ? 1 : 0} from=${Math.round(fromX)} t=${Math.round(now(ctx))} jam=${S.jamUntil > now(ctx) ? 1 : 0}`;
  }
}
function drawBar(ctx: LevelContext) {
  if (!S) return; const g = S.bar; const x0 = GAME_W / 2 - 120, y0 = 116, w = 240, h = 14;
  g.clear();
  g.fillStyle(0x13162a, 0.25); g.fillRoundedRect(x0, y0, w, h, 7);
  const ratio = Math.max(0, S.hp / S.maxHp);
  if (ratio > 0) { g.fillStyle(S.phase === 3 ? 0xb3122e : S.phase === 2 ? 0xe5484d : 0xf0567a, 1); g.fillRoundedRect(x0 + 2, y0 + 2, Math.max(10, (w - 4) * ratio), h - 4, 5); }
  g.lineStyle(2, 0xffffff, 0.9); g.strokeRoundedRect(x0, y0, w, h, 7);
  S.nameText.setText(S.defeated ? `${S.name} · Yenildi!` : `${S.name} · Faz ${S.phase}/${S.phases}`);
  ctx.state.custom.bossHp = S.hp; ctx.state.custom.bossPhase = S.phase;
}
function bossRect(): { l: number; t: number; r: number; b: number } {
  const hw = S?.kind === 'golem' ? 52 : 60; const top = S?.kind === 'golem' ? 125 : 110;
  return { l: BOSS_X - hw, t: GROUND_Y - top, r: BOSS_X + hw, b: GROUND_Y };
}
/** sersemlemiş boss'un kafa üstü (dünya y) */
function headTop(): number { return S?.kind === 'golem' ? GROUND_Y - 100 : GROUND_Y - 84; }

function setMode(ctx: LevelContext, m: Mode, ms: number) { if (!S) return; S.mode = m; S.modeUntil = now(ctx) + ms; ctx.state.custom.bossMode = m; }

function startStun(ctx: LevelContext, ms: number) {
  if (!S) return; const sc = ctx.scene;
  setMode(ctx, 'stun', ms); S.stunHits = 0;
  S.glow.setVisible(true);
  sc.tweens.killTweensOf(S.sprite);
  sc.tweens.add({ targets: S.sprite, scaleY: 0.72, scaleX: 1.12, duration: 160, ease: 'Quad.Out' });
  sc.tweens.add({ targets: S.sprite, angle: { from: -4, to: 4 }, duration: 180, yoyo: true, repeat: Math.floor(ms / 360) });
  if (S.kind === 'canavar') { S.sprite.setTexture(monsterTexture(sc, S.phase, false)); S.sprite.setTint(0x9ad0ff); }
  ctx.float(BOSS_X, GROUND_Y - 150, 'Sersemledi!', COLORS.amber); sfx.power();
  if (!S.hintedStun) { S.hintedStun = true; ctx.hint('Şimdi! Zıpla ve kafasına bas', 2200); }
}
function endStun(ctx: LevelContext) {
  if (!S) return; const sc = ctx.scene;
  S.glow.setVisible(false); S.contactSafeUntil = now(ctx) + 1000;
  sc.tweens.killTweensOf(S.sprite); S.sprite.setAngle(0);
  sc.tweens.add({ targets: S.sprite, scaleY: 1, scaleX: 1, duration: 200, ease: 'Back.Out' });
  if (S.kind === 'canavar') S.sprite.clearTint();
}

/** ezme kontrolü: düşerken kahramanın altı sersemlemiş boss'un kafasında */
function stompCheck(ctx: LevelContext): boolean {
  if (!S || S.mode !== 'stun') return false;
  const hb = ctx.hero.body; const top = headTop();
  if (hb.velocity.y > 40 && hb.bottom >= top - 16 && hb.bottom <= top + 40 && Math.abs(ctx.hero.x - BOSS_X) < 60) { hitBoss(ctx); return true; }
  return false;
}
function hitBoss(ctx: LevelContext) {
  if (!S || S.defeated) return; const sc = ctx.scene;
  S.hp--; S.stunHits++; ctx.state.score += 100;
  ctx.hero.body.setVelocityY(-470); ctx.hero.stretch(); ctx.hero.mood('wow', 400);
  ctx.flash(0xffe066); ctx.shake(160, 0.012); ctx.haptic('heavy'); sfx.bounce();
  ctx.float(BOSS_X, GROUND_Y - 150, '-1', COLORS.coral);
  S.sprite.setTintFill(0xffffff); sc.time.delayedCall(90, () => { if (S && !S.defeated) { if (S.mode === 'stun' && S.kind === 'canavar') S.sprite.setTint(0x9ad0ff); else if (S.kind === 'canavar') S.sprite.clearTint(); else S.sprite.setTint(S.phase === 3 ? 0xff8a7a : S.phase === 2 ? 0xffb38a : 0xffffff); } });
  const t2 = S.kind === 'golem' ? 8 : 12, t3 = S.kind === 'golem' ? 4 : 6;
  const np = S.hp <= t3 ? 3 : S.hp <= t2 ? 2 : 1;
  drawBar(ctx);
  if (S.hp <= 0) { defeat(ctx); return; }
  if (np > S.phase) { S.phase = np; onPhase(ctx); }
}
function onPhase(ctx: LevelContext) {
  if (!S) return; const sc = ctx.scene;
  endStun(ctx); setMode(ctx, 'recover', 1100); drawBar(ctx);
  ctx.shake(250, 0.015); ctx.haptic('medium'); sfx.toneAt(110, 0.5);
  sc.tweens.add({ targets: S.sprite, scale: 1.15, duration: 120, yoyo: true, repeat: 2 });
  if (S.kind === 'golem') {
    S.sprite.setTint(S.phase === 2 ? 0xffb38a : 0xff8a7a);
    ctx.hint(S.phase === 2 ? 'Faz 2: Serumen topları yuvarlanıyor, üstlerinden zıpla!' : 'Faz 3: Çift yumruk! İki gölgeden de uzak dur', 2800);
    S.nextBallAt = now(ctx) + 1800;
  } else {
    S.sprite.setTexture(monsterTexture(sc, S.phase, false)); S.sprite.clearTint();
    ctx.hint(S.phase === 2 ? 'Faz 2: Yüksek dalga gelirse kay · Gürültü dokunuşları geciktirir' : 'Faz 3: Çift dalga: zıpla, sonra kay!', 2800);
    S.nextJamAt = now(ctx) + 3500;
  }
}

function defeat(ctx: LevelContext) {
  if (!S || S.defeated) return; const sc = ctx.scene; S.defeated = true;
  ctx.state.custom.bossDefeated = true; ctx.state.score += 500;
  setMode(ctx, 'recover', 1e9); endStun(ctx); drawBar(ctx);
  for (const o of [...S.shadows, ...S.fists, ...S.notes]) o.destroy(); S.shadows = []; S.fists = []; S.notes = [];
  for (const b of S.balls) b.destroy(); S.balls = []; for (const w of S.waves) w.s.destroy(); S.waves = [];
  S.jamUntil = 0; S.jamOverlay.setAlpha(0); S.glow.setVisible(false);
  // patlama + konfeti
  const bx = BOSS_X, by = GROUND_Y - 70;
  const em = sc.add.particles(0, 0, sparkTexture(sc), { speed: { min: 120, max: 460 }, angle: { min: 0, max: 360 }, scale: { start: 1.6, end: 0 }, alpha: { start: 1, end: 0 }, lifespan: 900, gravityY: 600, tint: [0xffc25c, 0xff5c7a, 0x6c4cf1, 0x2ee6d6, 0xffffff], emitting: false }).setDepth(35);
  em.explode(90, bx, by);
  const cols = [0xffc25c, 0xff5c7a, 0x6c4cf1, 0x2ee6d6, 0x8ef0b0];
  for (let i = 0; i < 36; i++) {
    const c = cols[i % cols.length] ?? 0xffc25c; const p = sc.add.image(bx, by, roundRectTexture(sc, `confetti-${c}`, 12, 7, c, 2)).setDepth(34);
    const a = ctx.rng() * Math.PI * 2, d = 90 + ctx.rng() * 220;
    sc.tweens.add({ targets: p, x: bx + Math.cos(a) * d, y: by + Math.sin(a) * d * 0.6 + 140, angle: ctx.rng() * 720 - 360, alpha: 0, duration: 900 + ctx.rng() * 500, ease: 'Cubic.Out', onComplete: () => p.destroy() });
  }
  ctx.flash(0xffffff); ctx.shake(420, 0.02); ctx.haptic('success');
  sc.tweens.killTweensOf(S.sprite);
  sc.tweens.add({ targets: S.sprite, scale: 0, alpha: 0, angle: 200, y: GROUND_Y - 60, duration: 650, ease: 'Back.In' });
  if (S.kind === 'canavar') {
    // kısa ninni (toneAt dizisi)
    const ninni = [392, 392, 440, 392, 330, 294, 262, 294, 330, 262];
    ninni.forEach((f, i) => sc.time.delayedCall(120 + i * 180, () => sfx.toneAt(f, 0.22)));
    sc.time.delayedCall(400, () => ctx.float(GAME_W / 2, GROUND_Y - 220, 'Ninni beyne ulaştı', COLORS.accent));
  } else {
    sc.time.delayedCall(400, () => ctx.float(GAME_W / 2, GROUND_Y - 220, 'Kanal açıldı!', COLORS.accent2));
  }
  // kapı açılır: arenaya kayar; kahraman koşar → kapı ya da 1,2 s
  const gate = (ctx.groups.specials.getChildren() as Phaser.Physics.Arcade.Sprite[]).find((o) => (o.getData('e') as { type?: string } | undefined)?.type === 'gate');
  if (gate) { gate.setPosition(ARENA_R + 60, GROUND_Y); sc.tweens.add({ targets: gate, x: BOSS_X, duration: 500, delay: 350, ease: 'Cubic.Out' }); }
  sc.time.delayedCall(1200, () => ctx.finish());
}

// ---------- kahraman hareketi (arena)
function heroMove(ctx: LevelContext, input: InputState, dt: number) {
  if (!S) return; const { hero } = ctx; const b = hero.body; const t = now(ctx);
  const onGround = grounded(ctx);
  if (onGround) S.coyote = t + 100;
  const sliding = S.slideUntil > t;
  if (S.defeated) { b.setVelocityX(RUN_SPEED); hero.sprite.setFlipX(false); return; }
  if (t >= S.knockUntil) b.setVelocityX(input.dir * RUN_SPEED * (sliding ? 1.15 : 1));
  if (input.dir !== 0) hero.sprite.setFlipX(input.dir < 0);
  // kayma: yalnızca görsel ölçek (fizik gövdesi ölçekle küçülür); boss çarpışmaları heroBox ile anında hesaplanır
  if (sliding) hero.sprite.setScale(1.1, 0.55);
  else if (!(hero.sprite.scaleY < 1) || t > S.slideUntil + 120) hero.sprite.setScale(1, 1);
  if (input.primaryPressed && (onGround || t < S.coyote) && !sliding) {
    b.setVelocityY(-JUMP_V); S.coyote = 0; S.holdUntil = t + 220; hero.stretch(); sfx.jump(); ctx.haptic('light');
  }
  if (input.primaryDown && t < S.holdUntil && b.velocity.y < 0) b.setVelocityY(b.velocity.y - 1400 * 0.45 * dt);
  if (input.primaryReleased && b.velocity.y < 0) b.setVelocityY(b.velocity.y * 0.55);
  if (input.secondaryPressed && onGround) { S.slideUntil = t + (ctx.skills.longSlide ? 1100 : 900); sfx.tick(); ctx.haptic('light'); }
  if (input.secondaryPressed && !onGround) b.setVelocityY(900);
}

// ---------- Serumen Golemi
function golemTick(ctx: LevelContext) {
  if (!S) return; const sc = ctx.scene; const t = now(ctx); const ph = S.phase;
  switch (S.mode) {
    case 'idle': if (t >= S.modeUntil) golemWarn(ctx); break;
    case 'warn': if (t >= S.modeUntil) golemSlam(ctx); break;
    case 'slam': if (t >= S.modeUntil) golemImpact(ctx); break;
    case 'stun': stompCheck(ctx); if (t >= S.modeUntil || S.stunHits >= 2) { endStun(ctx); setMode(ctx, 'idle', ph === 3 ? 600 : ph === 2 ? 900 : 1100); } break;
    case 'recover': if (t >= S.modeUntil) setMode(ctx, 'idle', ph === 3 ? 500 : 800); break;
    default: break;
  }
  // serumen topları (faz 2+)
  if (ph >= 2 && S.mode !== 'stun' && S.mode !== 'recover' && t >= S.nextBallAt) {
    S.nextBallAt = t + (ph === 3 ? 2100 : 2700);
    const b = sc.physics.add.sprite(BOSS_X - 70, GROUND_Y - 20, ballTexture(sc)).setDepth(12);
    const body = b.body as Phaser.Physics.Arcade.Body; body.setAllowGravity(false); body.setCircle(18, 2, 2); body.setVelocityX(-(190 + ph * 20));
    S.balls.push(b); sfx.tick();
  }
  for (const b of S.balls) { if (!b.active) continue; b.angle -= 6; if (b.x < ARENA_L - 30) { b.destroy(); continue; } if (overlapBody(ctx, b.body as Phaser.Physics.Arcade.Body)) { hurtHero(ctx, b.x, 'top'); b.destroy(); } }
  S.balls = S.balls.filter((b) => b.active);
  // gövdeye temas (sersemlemiş değilse; sersemleme sonrası 1 s koruma)
  const r = bossRect();
  if (S.mode !== 'stun' && t >= S.contactSafeUntil && overlapRect(ctx, r.l, r.t, r.r, r.b)) hurtHero(ctx, BOSS_X, 'govde');
}
function golemWarn(ctx: LevelContext) {
  if (!S) return; const sc = ctx.scene; const hx = ctx.hero.x;
  const clampX = (x: number) => Math.max(HERO_MIN + 10, Math.min(BOSS_X - 70, x));
  const esc = ctx.hero.body.velocity.x < -10 ? -1 : ctx.hero.body.velocity.x > 10 ? 1 : (hx < 150 ? 1 : -1);
  // faz 3: ikinci yumruk 150 px öteye; arada (75 px) ve dışında güvenli alan kalır
  S.targets = S.phase === 3 ? [clampX(hx), clampX(hx + 150 * esc)] : [clampX(hx)];
  for (const tx of S.targets) {
    const sh = sc.add.image(tx, GROUND_Y - 2, shadowTexture(sc)).setDepth(6).setAlpha(0.6);
    sc.tweens.add({ targets: sh, alpha: 1, scaleX: 1.15, duration: 160, yoyo: true, repeat: -1 });
    S.shadows.push(sh);
  }
  sc.tweens.add({ targets: S.sprite, y: GROUND_Y - 16, duration: 200, yoyo: true, hold: 250 });
  sfx.tick(); setMode(ctx, 'warn', S.phase === 3 ? 520 : 600);
}
function golemSlam(ctx: LevelContext) {
  if (!S) return; const sc = ctx.scene;
  for (const tx of S.targets) {
    const f = sc.add.image(tx, GROUND_Y - 320, fistTexture(sc)).setOrigin(0.5, 1).setDepth(12);
    sc.tweens.add({ targets: f, y: GROUND_Y + 2, duration: 120, ease: 'Quad.In' });
    S.fists.push(f);
  }
  setMode(ctx, 'slam', 120);
}
function golemImpact(ctx: LevelContext) {
  if (!S) return; const sc = ctx.scene;
  ctx.shake(160, 0.014); sfx.hit();
  // tehlike: tek kare kontrol — yumruk sütunu (x ± 46, zemine kadar 150 px)
  let hit = false;
  for (const tx of S.targets) if (Math.abs(ctx.hero.x - tx) < 46 && ctx.hero.y > GROUND_Y - 150) { hit = true; hurtHero(ctx, tx, 'yumruk'); }
  for (const f of S.fists) { sc.tweens.add({ targets: f, alpha: 0, y: f.y - 30, duration: 360, delay: 120, onComplete: () => f.destroy() }); }
  for (const sh of S.shadows) sh.destroy();
  S.fists = []; S.shadows = []; S.targets = [];
  const ph = S.phase;
  if (hit) setMode(ctx, 'recover', 500);
  else { ctx.float(BOSS_X, GROUND_Y - 160, 'Kaçırdı!', COLORS.accent2); startStun(ctx, ph === 3 ? 1700 : 2000); }
}

// ---------- Gürültü Canavarı
/** gürültü: girişler 100 ms gecikmeli (kahraman hareketinden önce uygulanır) */
function monsterJam(ctx: LevelContext, input: InputState) {
  if (!S) return; const t = now(ctx);
  if (S.jamUntil > t) {
    if (input.primaryPressed) { S.delayed.push({ at: t + 100, key: 'primaryPressed' }); input.primaryPressed = false; }
    if (input.secondaryPressed) { S.delayed.push({ at: t + 100, key: 'secondaryPressed' }); input.secondaryPressed = false; }
    S.jamOverlay.setAlpha(0.06 + ctx.rng() * 0.1);
  } else S.jamOverlay.setAlpha(0);
  if (S.delayed.length) S.delayed = S.delayed.filter((q) => { if (q.at <= t) { input[q.key] = true; return false; } return true; });
}
function monsterTick(ctx: LevelContext) {
  if (!S) return; const sc = ctx.scene; const t = now(ctx); const ph = S.phase;
  switch (S.mode) {
    case 'attack':
      if (t >= S.nextScreamAt) monsterScream(ctx);
      else if (ph >= 2 && t >= S.nextJamAt) { S.jamUntil = t + (ph === 3 ? 3000 : 2500); S.nextJamAt = S.jamUntil + (ph === 3 ? 4500 : 6500); ctx.hint('Gürültü! Dokunuşlar 100 ms gecikiyor', 1600); ctx.haptic('medium'); sfx.hit(); }
      break;
    case 'scream':
      if (t >= S.modeUntil) { for (const n of S.notes) n.destroy(); S.notes = []; S.noteCount = 0; S.sprite.setTexture(monsterTexture(sc, ph, false)); setMode(ctx, 'attack', 0); S.nextScreamAt = t + 2500; }
      break;
    case 'stun':
      stompCheck(ctx);
      if (t >= S.modeUntil || S.stunHits >= 3) { endStun(ctx); setMode(ctx, 'recover', 700); }
      break;
    case 'recover':
      if (t >= S.modeUntil) { setMode(ctx, 'attack', 0); S.nextScreamAt = t + (ph === 1 ? 4000 : 5000); S.nextWaveAt = t + 600; }
      break;
    default: break;
  }
  // dalgalar (400 ms önce telegraf: canavar kasılır); faz 1'de bağırırken dalga yok (nota toplamayı öğret)
  const waving = S.mode === 'attack' || (S.mode === 'scream' && ph >= 2);
  if (waving && S.telegraphAt < S.nextWaveAt && t >= S.nextWaveAt - 420) {
    S.telegraphAt = S.nextWaveAt; sfx.tick();
    if (S.mode === 'attack') sc.tweens.add({ targets: S.sprite, scaleX: 1.1, scaleY: 0.92, duration: 130, yoyo: true, repeat: 1 });
  }
  if (!waving && t >= S.nextWaveAt) S.nextWaveAt = t + 1200;
  if (waving && t >= S.nextWaveAt) {
    const every = (ph === 3 ? 2300 : ph === 2 ? 1900 : 2400) * (S.mode === 'scream' ? 1.6 : 1);
    S.nextWaveAt = t + every;
    const speed = ph === 3 ? 270 : ph === 2 ? 250 : 220;
    if (ph === 1) spawnWave(ctx, 'low', 0, speed);
    else if (ph === 2) spawnWave(ctx, ctx.rng() < 0.5 ? 'low' : 'high', 0, speed);
    else { const first: WaveKind = ctx.rng() < 0.5 ? 'low' : 'high'; spawnWave(ctx, first, 0, speed); spawnWave(ctx, first === 'low' ? 'high' : 'low', 420, speed); }
  }
  for (const w of S.waves) {
    if (!w.s.active) continue;
    if (w.s.x < ARENA_L - 40) { w.s.destroy(); continue; }
    if (overlapBody(ctx, w.s.body as Phaser.Physics.Arcade.Body)) { hurtHero(ctx, w.s.x, `dalga-${w.kind}`); w.s.destroy(); }
  }
  S.waves = S.waves.filter((w) => w.s.active);
  // notalar
  if (S.notes.length) {
    const hx = ctx.hero.x, hy = ctx.hero.y - 24;
    for (const n of S.notes) {
      if (!n.active) continue;
      if (Phaser.Math.Distance.Between(n.x, n.y, hx, hy) < 36) {
        n.destroy(); S.noteCount++; ctx.state.score += 30;
        sfx.toneAt(440 * Math.pow(2, S.noteCount / 12 + 0.5), 0.18); ctx.haptic('light');
        ctx.float(n.x, n.y - 10, `♪ ${S.noteCount}/3`, COLORS.accent);
        if (S.noteCount >= 3) monsterThrowNote(ctx);
      }
    }
    S.notes = S.notes.filter((n) => n.active);
  }
  const r = bossRect();
  if (S.mode !== 'stun' && t >= S.contactSafeUntil && overlapRect(ctx, r.l, r.t, r.r, r.b)) hurtHero(ctx, BOSS_X, 'govde');
}
function spawnWave(ctx: LevelContext, kind: WaveKind, offset: number, speed: number) {
  if (!S) return; const sc = ctx.scene;
  const h = kind === 'low' ? 28 : 40; const y = kind === 'low' ? GROUND_Y - h / 2 : GROUND_Y - 34 - h / 2;
  const w = sc.physics.add.sprite(BOSS_X - 50 + offset, y, waveTexture(sc, kind)).setDepth(12);
  const body = w.body as Phaser.Physics.Arcade.Body; body.setAllowGravity(false); body.setSize(24, kind === 'low' ? 26 : 36); body.setVelocityX(-speed);
  sc.tweens.add({ targets: w, scaleY: 1.12, duration: 160, yoyo: true, repeat: -1 });
  S.waves.push({ s: w, kind });
  if (offset === 0) sfx.toneAt(kind === 'low' ? 160 : 520, 0.15);
}
function monsterScream(ctx: LevelContext) {
  if (!S) return; const sc = ctx.scene;
  S.sprite.setTexture(monsterTexture(sc, S.phase, true));
  sc.tweens.add({ targets: S.sprite, scale: 1.08, duration: 140, yoyo: true, repeat: 3 });
  ctx.shake(200, 0.008); sfx.toneAt(80, 0.5);
  setMode(ctx, 'scream', 9000); S.noteCount = 0;
  const key = emojiTexture(sc, 'note-tex', '♪', 40);
  const xs = [60, 125, 190].map((x) => x + (ctx.rng() - 0.5) * 30);
  const ys = [GROUND_Y - 36, GROUND_Y - 108, GROUND_Y - 36];
  xs.forEach((x, i) => {
    const n = sc.add.image(x, ys[i] ?? GROUND_Y - 36, key).setDepth(14).setScale(0);
    sc.tweens.add({ targets: n, scale: 1, duration: 250, ease: 'Back.Out' });
    sc.tweens.add({ targets: n, y: n.y - 8, duration: 600 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: 250 });
    S!.notes.push(n);
  });
  if (!S.hintedStun) ctx.hint('Bağırıyor! 3 notayı topla, ağzına fırlasın', 2200);
}
function monsterThrowNote(ctx: LevelContext) {
  if (!S) return; const sc = ctx.scene;
  for (const n of S.notes) n.destroy(); S.notes = [];
  const p = sc.add.image(ctx.hero.x, ctx.hero.y - 30, emojiTexture(sc, 'note-tex', '♪', 40)).setDepth(25).setScale(1.3);
  setMode(ctx, 'scream', 1500);
  sc.tweens.add({ targets: p, x: BOSS_X, y: GROUND_Y - 36, angle: 360, duration: 340, ease: 'Quad.In', onComplete: () => { p.destroy(); if (S && !S.defeated && S.mode === 'scream') { ctx.float(BOSS_X, GROUND_Y - 120, 'Ninni!', COLORS.accent); startStun(ctx, S.phase === 3 ? 2600 : 3000); } } });
}

// ---------- bot
function botCommon(ctx: LevelContext, input: TouchInput): { t: number; onGround: boolean; sliding: boolean; set: (d: -1 | 0 | 1) => void; jump: (ms?: number) => void } {
  const t = now(ctx);
  return {
    t, onGround: grounded(ctx), sliding: (S?.slideUntil ?? 0) > t,
    set: (d) => { input.virtual = { dir: d }; },
    jump: (ms = 160) => { if (S && t - S.botJumpAt > 260 && grounded(ctx)) { S.botJumpAt = t; input.hold(ms); } },
  };
}
const toward = (from: number, to: number, dead = 10): -1 | 0 | 1 => (Math.abs(to - from) <= dead ? 0 : to > from ? 1 : -1);
/** sersemlemiş boss'a koş, zıpla, havada kafasının üstüne yönlen */
function botStomp(ctx: LevelContext, input: TouchInput): boolean {
  if (!S || S.mode !== 'stun') return false;
  const c = botCommon(ctx, input); const hx = ctx.hero.x; const tx = BOSS_X - 6; const dx = tx - hx;
  if (c.onGround) {
    if (Math.abs(dx) > 72) c.set(toward(hx, tx));
    else { c.set(toward(hx, tx, 6)); c.jump(210); }
  } else c.set(toward(hx, tx, 8));
  return true;
}

function golemBot(ctx: LevelContext, input: TouchInput) {
  if (!S) return; const c = botCommon(ctx, input); const hx = ctx.hero.x;
  if (S.defeated) { c.set(1); return; }
  // yuvarlanan toplar: yaklaşınca zıpla
  let ball: Phaser.Physics.Arcade.Sprite | null = null;
  for (const b of S.balls) { if (!b.active || b.x < hx - 10) continue; if (!ball || b.x < ball.x) ball = b; }
  if (ball) { const d = ball.x - 18 - (hx + 17); if (d < 100 && d > -30 && c.onGround) c.jump(140); }
  if (botStomp(ctx, input)) return;
  const bossLeft = BOSS_X - 70;
  // sersemleme bitti: gövdeden uzaklaş
  if (hx > BOSS_X - 105) { c.set(-1); return; }
  if (S.mode === 'warn' || S.mode === 'slam') {
    const minD = Math.min(...S.targets.map((tx) => Math.abs(hx - tx)));
    if (minD >= 72) { c.set(0); return; }
    const lo = HERO_MIN + 12, hi = bossLeft - 40;
    // kalan uyarı süresinde erişilebilir adaylar: kenarlar, ±130, iki hedefin ortası
    const reach = Math.max(40, (RUN_SPEED * Math.max(0, S.modeUntil - c.t)) / 1000 + 12);
    const mid = S.targets.length > 1 ? ((S.targets[0] ?? hx) + (S.targets[1] ?? hx)) / 2 : hx - 130;
    const cands = [lo, hx - 130, hx + 130, hi, mid].map((x) => Math.max(lo, Math.min(hi, Math.max(hx - reach, Math.min(hx + reach, x)))));
    let best = cands[0] ?? lo; let bestScore = -1;
    for (const x of cands) { const s = Math.min(...S.targets.map((tx) => Math.abs(x - tx))) - Math.abs(x - hx) * 0.1; if (s > bestScore) { bestScore = s; best = x; } }
    c.set(toward(hx, best, 6)); return;
  }
  // boşta: dodge alanı geniş olsun diye arena ortasının solunda bekle
  c.set(toward(hx, 120, 24));
}

function monsterBot(ctx: LevelContext, input: TouchInput) {
  if (!S) return; const c = botCommon(ctx, input); const hx = ctx.hero.x;
  if (S.defeated) { c.set(1); return; }
  // en yakın yaklaşan dalga
  let wave: { s: Phaser.Physics.Arcade.Sprite; kind: WaveKind } | null = null; let wd = Infinity;
  for (const w of S.waves) { if (!w.s.active) continue; const d = (w.s.x - 12) - (hx + 17); if (d < -40) continue; if (d < wd) { wd = d; wave = w; } }
  if (wave) {
    // kare hızından bağımsız: kare süresi + gürültü gecikmesi kadar öncü mesafe
    const frameDt = Math.min(0.15, ctx.scene.game.loop.delta / 1000);
    const speed = Math.abs((wave.s.body as Phaser.Physics.Arcade.Body).velocity.x) || 220;
    const lead = speed * (frameDt + (S.jamUntil > c.t ? 0.1 : 0));
    if (wave.kind === 'low' && wd < 90 + lead && c.onGround) c.jump(120);
    if (wave.kind === 'high' && wd < 60 + lead && c.onGround && !c.sliding && c.t - S.botSlideAt > 700) { S.botSlideAt = c.t; input.swipeDown(); }
  }
  if (S.mode === 'stun') { if (wave && wd < 150 && c.onGround) { c.set(0); return; } botStomp(ctx, input); return; }
  if (hx > BOSS_X - 105) { c.set(-1); return; } // sersemleme bitti: gövdeden uzaklaş
  if (wave && wd < 170) { c.set(0); return; }
  if (S.notes.length) {
    let n: Phaser.GameObjects.Image | null = null;
    for (const o of S.notes) if (o.active && (!n || Math.abs(o.x - hx) < Math.abs(n.x - hx))) n = o;
    if (n) {
      const dx = n.x - hx; c.set(toward(hx, n.x, 6));
      const waveSoon = (wave && wd < 260) || (S.phase >= 2 && S.nextWaveAt - c.t < 1400);
      if (Math.abs(dx) < 34 && n.y < GROUND_Y - 60 && c.onGround && !waveSoon) c.jump(60);
      return;
    }
  }
  c.set(toward(hx, 110, 24));
}

// ---------- mekanik
export const boss: Mechanic = {
  id: 'boss',
  setup(ctx) {
    const sc = ctx.scene; const spec = ctx.spec.boss;
    const kind: Kind = spec?.id === 'gurultu-canavari' ? 'canavar' : 'golem';
    const name = spec?.name ?? (kind === 'golem' ? 'Serumen Golemi' : 'Gürültü Canavarı');
    const hp = spec?.hp ?? (kind === 'golem' ? 12 : 18);
    ctx.hero.body.setGravityY(0);
    ctx.hero.body.setBoundsRectangle(new Phaser.Geom.Rectangle(HERO_MIN - 17, -1200, HERO_MAX - HERO_MIN + 34, GROUND_Y + 1200 + 300));
    ctx.hero.sprite.setCollideWorldBounds(true);
    const sprite = sc.add.image(BOSS_X, GROUND_Y, kind === 'golem' ? golemTexture(sc) : monsterTexture(sc, 1, false)).setOrigin(0.5, 1).setDepth(10);
    sc.tweens.add({ targets: sprite, scaleX: 1.03, scaleY: 0.97, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const glow = sc.add.image(BOSS_X, GROUND_Y - 70, glowTexture(sc)).setDepth(11).setVisible(false);
    sc.tweens.add({ targets: glow, scale: { from: 0.85, to: 1.2 }, alpha: { from: 0.7, to: 1 }, duration: 320, yoyo: true, repeat: -1 });
    const bar = sc.add.graphics().setScrollFactor(0).setDepth(102);
    const nameText = sc.add.text(GAME_W / 2, 104, '', { fontFamily: FONT, fontSize: '12px', fontStyle: '800', color: COLORS.text, backgroundColor: 'rgba(255,255,255,0.85)', padding: { x: 8, y: 2 } }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
    const jamOverlay = sc.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x222233, 1).setScrollFactor(0).setDepth(90).setAlpha(0);
    const t = 0;
    S = {
      kind, name, hp, maxHp: hp, phase: 1, phases: spec?.phases ?? 3, defeated: false, camLocked: false, clock: 0, contactSafeUntil: 0, telegraphAt: -1,
      sprite, glow, bar, nameText, mode: kind === 'golem' ? 'idle' : 'attack', modeUntil: t + 2200, stunHits: 0, hintedStun: false,
      targets: [], shadows: [], fists: [], balls: [], nextBallAt: 0,
      waves: [], notes: [], noteCount: 0, nextWaveAt: t + 2600, nextScreamAt: t + 3800, jamUntil: 0, nextJamAt: 0, jamOverlay, delayed: [],
      slideUntil: 0, holdUntil: 0, coyote: 0, knockUntil: 0, botJumpAt: 0, botSlideAt: 0,
    };
    ctx.state.custom.bossDefeated = false; ctx.state.custom.bossMode = S.mode;
    glow.setPosition(BOSS_X, headTop() + 26);
    drawBar(ctx);
    sc.time.delayedCall(3400, () => { if (S && !S.defeated) ctx.hint(kind === 'golem' ? 'Sol/sağ: koş · Dokun: zıpla · Gölgeden uzaklaş, yumruğu kaçırınca kafasına zıpla' : 'Sol/sağ: koş · Alçak dalga: zıpla · Yüksek dalga: aşağı kaydır', 3500); });
  },
  update(ctx, input, dt) {
    if (!S) return;
    if (!S.camLocked) { S.camLocked = true; const cam = ctx.scene.cameras.main; cam.stopFollow(); cam.setScroll(ARENA_L, CAM_Y); }
    S.clock += ctx.scene.game.loop.delta * ctx.scene.time.timeScale;
    // sıra: giriş gecikmesi → kahraman (zıplama/kayma bu karede işlensin) → boss ve çarpışmalar
    if (S.kind === 'canavar') monsterJam(ctx, input);
    heroMove(ctx, input, dt);
    if (S.kind === 'golem') golemTick(ctx); else monsterTick(ctx);
  },
  botTick(ctx, input) {
    if (!S) return;
    if (S.kind === 'golem') golemBot(ctx, input); else monsterBot(ctx, input);
  },
  teardown(ctx) { ctx.input.virtual = null; S = null; },
};
