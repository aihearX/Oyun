import Phaser from 'phaser';
import type { Mechanic, LevelContext } from './types';
import { sfx } from '../audio';
import { heroTexture, tonotopyColor } from '../art';
import { BIOMES } from '@odi/content';
import { GAME_W, HERO_SIZE } from '@odi/shared';
import { FONT, COLORS } from '../ui';

/** Yüzme sabitleri (px, px/s, px/s²). */
const SWIM_SPEED = 220;        // otomatik sağa akış
const NET_GRAVITY = 350;       // su içinde net batma ivmesi
const THRUST = 1250;           // basılı tutunca yukarı ivme
const RISE_MAX = 280;          // yukarı hız sınırı
const SINK_MAX = 240;          // batma hız sınırı
const SURFACE_Y = 60;          // su yüzeyi: kahramanın tepesi bunun üstüne çıkamaz
const BREATH_BASE = 10;        // saniye; + 4 × nefes yeteneği
const BOT_MARGIN_X = 22;
const BOT_MARGIN_Y = 30;

interface Rect { l: number; r: number; t: number; b: number }

function breathSeconds(ctx: LevelContext) { return BREATH_BASE + 4 * ctx.skills.breath; }

/** Biyomun tonotopi orta noktası (0 taban/ince → 1 apeks/kalın). */
function tonotopyT(ctx: LevelContext): number {
  const b = BIOMES[ctx.spec.biome]; const r = b?.tonotopy;
  return r ? (r[0] + r[1]) / 2 : 0.2;
}

/** Nefes çubuğu: HUD altında, kamera sabit. */
class BreathBar {
  g: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; private color: number;
  constructor(scene: Phaser.Scene, color: number) {
    this.color = color;
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.label = scene.add.text(GAME_W / 2 - 92, 110, '🫧', { fontFamily: FONT, fontSize: '14px' }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(101);
  }
  draw(v: number, now: number) {
    const x = GAME_W / 2 - 80, y = 104, w = 160, h = 12;
    const low = v < 0.3; const blink = low && Math.floor(now / 200) % 2 === 0;
    this.g.clear();
    this.g.fillStyle(0xffffff, 0.85); this.g.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 8);
    this.g.fillStyle(0xe6e8f0, 1); this.g.fillRoundedRect(x, y, w, h, 6);
    const fw = Math.max(0, Math.min(1, v)) * w;
    if (fw > 6) { this.g.fillStyle(low ? (blink ? 0xff8a9c : 0xf0567a) : this.color, 1); this.g.fillRoundedRect(x, y, fw, h, 6); }
    this.g.lineStyle(1, 0xcfd3e0, 1); this.g.strokeRoundedRect(x, y, w, h, 6);
  }
  destroy() { this.g.destroy(); this.label.destroy(); }
}

let bar: BreathBar | null = null;

/** Yüzme: koklea sıvısında serbest yüzme. Basılı tut = yüksel, bırak = yavaşça bat; nefes ölçeği; kabarcık = hava; akıntı = ek hız. */
export const yuzme: Mechanic = {
  id: 'yuzme',
  setup(ctx) {
    const { state, hero, scene } = ctx; const c = state.custom;
    c.breath = 1; c.curDx = 0; c.curDy = 0; c.curUntil = 0; c.botHoldUntil = 0; c.wasDown = false; c.gaspAt = 0; c.tintAt = 0;
    const g = scene.physics.world.gravity.y;
    hero.body.setGravityY(-g + NET_GRAVITY * state.gravityDir);
    hero.body.setDragX(0); hero.body.setDrag(0, 0); hero.body.setMaxVelocityY(RISE_MAX);
    // tonotopi: biyoma göre kahraman rengi (taban mor → apeks turuncu)
    const color = tonotopyColor(tonotopyT(ctx));
    for (const m of ['happy', 'hurt', 'wow'] as const) { if (scene.textures.exists(`odi-${m}`)) scene.textures.remove(`odi-${m}`); heroTexture(scene, 'odi', color, HERO_SIZE, m); }
    hero.sprite.setTexture('odi-happy');
    bar?.destroy(); bar = new BreathBar(scene, color); bar.draw(1, 0);
    if (ctx.spec.tutorial) ctx.hint('Basılı tut: yüksel · Bırak: alçal · Kabarcıklar nefes verir', 5000);
  },
  update(ctx, input, dt) {
    const { hero, state, scene } = ctx; const b = hero.body; const now = scene.time.now; const c = state.custom; const gd = state.gravityDir;
    // yerçekimi telafisi (ters yerçekimi değiştiricisi dünya yerçekimini çevirebilir); dikey hareket fizik motorunda
    // ivme olarak integre edilir ki düşük fps'te de aynı hissi versin
    b.setGravityY(-scene.physics.world.gravity.y + NET_GRAVITY * gd);
    b.setMaxVelocityY(RISE_MAX);
    // yatay: otomatik akış + akıntı
    const inCurrent = (c.curUntil as number) > now;
    let vx = SWIM_SPEED * state.speedMult; if (inCurrent) vx += Number(c.curDx);
    b.setVelocityX(vx);
    // dikey: basılı tut = yukarı itiş; bırak = yavaş batma; akıntı ek itiş
    let ay = 0;
    if (input.primaryDown) { ay -= THRUST * gd; if (!c.wasDown) { hero.stretch(); sfx.tick(); } }
    if (inCurrent) ay += Number(c.curDy) * 3;
    b.setAccelerationY(ay);
    if (b.velocity.y * gd > SINK_MAX) b.setVelocityY(SINK_MAX * gd);
    c.wasDown = !!input.primaryDown;
    // su yüzeyi: tepe sınırı
    if (gd === 1 && b.top < SURFACE_Y) { hero.sprite.y += SURFACE_Y - b.top; b.updateFromGameObject(); if (b.velocity.y < 0) b.setVelocityY(0); }
    // hafif yüzme salınımı
    hero.sprite.setAngle(Phaser.Math.Clamp(b.velocity.y / 30, -14, 14));
    // nefes
    let breath = Number(c.breath) - dt / breathSeconds(ctx);
    if (breath <= 0) {
      breath = 0.5; sfx.hit();
      if (ctx.damage('nefes')) ctx.float(hero.x, hero.y - 70, 'Nefes bitti!', COLORS.coral);
    }
    else if (breath < 0.3 && now > (c.gaspAt as number)) { c.gaspAt = now + 1200; ctx.haptic('light'); ctx.float(hero.x, hero.y - 64, 'nefes!', COLORS.coral); }
    c.breath = breath;
    bar?.draw(breath, now);
    // tonotopi: kabarcıklara biyom rengi
    if (now > (c.tintAt as number)) {
      c.tintAt = now + 400;
      const tint = tonotopyColor(tonotopyT(ctx));
      for (const o of ctx.groups.specials.getChildren() as Phaser.Physics.Arcade.Sprite[]) { if (o.active && !o.getData('ton') && (o.getData('e') as { type: string }).type === 'bubble') { o.setTint(tint); o.setData('ton', 1); } }
    }
  },
  onSpecial(ctx, sprite, e) {
    const { state, hero } = ctx; const c = state.custom; const now = ctx.scene.time.now;
    if (e.type === 'bubble') {
      if (!sprite.active) return true;
      sprite.destroy(); c.breath = 1; sfx.power(); ctx.haptic('light');
      ctx.float(hero.x, hero.y - 70, '+hava', COLORS.accent2); hero.mood('wow', 250);
      return true;
    }
    if (e.type === 'current') {
      c.curDx = Number(e.props?.dx ?? 0); c.curDy = Number(e.props?.dy ?? 0); c.curUntil = now + 60;
      return true;
    }
    return false;
  },
  onDamage(ctx) { ctx.state.custom.breath = Math.max(Number(ctx.state.custom.breath), 0.5); },
  botTick(ctx, input) {
    const { hero, state, scene } = ctx; const b = hero.body; const now = scene.time.now; const c = state.custom;
    const hx = hero.x, hy = b.center.y; const hh = b.height / 2; const vx = Math.max(120, Math.abs(b.velocity.x));
    const breath = Number(c.breath); const gd = state.gravityDir;
    const groundTop = ctx.groundY;
    // üç pencere: yakın (kaçınılmaz), orta (planla), uzak (tercih)
    const near: Rect[] = [], mid: Rect[] = [], far: Rect[] = [];
    const NEAR = [hx - 10, hx + 170] as const, MID = [hx + 170, hx + 330] as const, FAR = [hx + 330, hx + 480] as const;
    const add = (r: Rect) => {
      if (r.r >= NEAR[0] && r.l <= NEAR[1]) near.push(r);
      if (r.r >= MID[0] && r.l <= MID[1]) mid.push(r);
      if (r.r >= FAR[0] && r.l <= FAR[1]) far.push(r);
    };
    const rectOf = (o: Phaser.Physics.Arcade.Sprite, mx: number, my: number): Rect => { const bb = o.body as Phaser.Physics.Arcade.Body; return { l: bb.left - mx, r: bb.right + mx, t: bb.top - my, b: bb.bottom + my }; };
    const children = (g: Phaser.Physics.Arcade.Group | Phaser.Physics.Arcade.StaticGroup) => (g.getChildren() as Phaser.Physics.Arcade.Sprite[]).filter((o) => o.active && o.body);
    for (const o of children(ctx.groups.hazards)) add(rectOf(o, BOT_MARGIN_X + 6, BOT_MARGIN_Y + 8));
    for (const o of children(ctx.groups.enemies)) add(rectOf(o, BOT_MARGIN_X + 60, BOT_MARGIN_Y + 10));
    for (const o of [...children(ctx.groups.platforms), ...children(ctx.groups.movers)]) { const bb = o.body as Phaser.Physics.Arcade.Body; if (bb.top >= groundTop - 2) continue; add(rectOf(o, BOT_MARGIN_X, BOT_MARGIN_Y - 4)); }
    // çekim noktaları
    const coins: { x: number; y: number }[] = [], bubbles: { x: number; y: number }[] = [];
    for (const o of children(ctx.groups.coins)) if (o.x > hx + 20 && o.x < hx + 360) coins.push({ x: o.x, y: o.y });
    for (const o of children(ctx.groups.specials)) { const e = o.getData('e') as { type: string }; if (e.type === 'bubble' && o.x > hx + 20 && o.x < hx + 700) bubbles.push({ x: o.x, y: o.y }); }
    bubbles.sort((p, q) => p.x - q.x);
    const blocked = (list: Rect[], y: number) => list.some((r) => y > r.t && y < r.b);
    // şu anki bandı kapatan ilk engel: ona kadar kalan süre → ulaşılabilir dikey mesafe
    let tEsc = Infinity;
    for (const r of [...near, ...mid]) if (hy > r.t && hy < r.b) tEsc = Math.min(tEsc, Math.max(0.05, (r.l - hx) / vx));
    const reachUp = RISE_MAX * tEsc + 20, reachDown = SINK_MAX * tEsc + 20;
    const yMin = SURFACE_Y + hh + 6, yMax = groundTop - hh - 6;
    let best = hy, bestCost = Infinity;
    for (let y = yMin; y <= yMax; y += 8) {
      let cost = 0;
      if (blocked(near, y)) cost += 1000;
      if (blocked(mid, y)) cost += 160;
      if (blocked(far, y)) cost += 40;
      const dy = y - hy; const upward = gd === 1 ? dy < 0 : dy > 0;
      if (Math.abs(dy) > (upward ? reachUp : reachDown)) cost += 600;
      cost += Math.abs(dy) * 0.35;
      for (const k of coins) { const d = Math.abs(k.y - y); if (d < 26) cost -= 28 * (1 - Math.abs(k.x - hx) / 400); }
      const bub = bubbles[0];
      if (bub) { const d = Math.abs(bub.y - y); const want = breath < 0.4 ? 420 : breath < 0.75 ? 90 : 25; if (d < 24) cost -= want; else cost += (d / 40) * (breath < 0.4 ? 10 : 1); }
      if (cost < bestCost) { bestCost = cost; best = y; }
    }
    // tahmin: hız ataletini hesaba kat
    const predicted = hy + b.velocity.y * 0.18;
    const wantUp = gd === 1 ? best < predicted - 4 : best > predicted + 4;
    if (wantUp) {
      // basılı tut: ilk karede hold (basma kenarı), sonra sanal giriş her kare basılı tutar
      if (!input.virtual) { input.hold(80); input.virtual = { primaryDown: true }; }
      c.botHoldUntil = now + 80;
    } else if (input.virtual || now > (c.botHoldUntil as number)) { input.virtual = null; input.state.primaryDown = false; c.botHoldUntil = 0; }
  },
  teardown() { bar?.destroy(); bar = null; },
};
