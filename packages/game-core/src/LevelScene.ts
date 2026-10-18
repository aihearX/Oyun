import Phaser from 'phaser';
import type { Entity, LevelSpec, RunResult } from '@odi/shared';
import { GROUND_Y, GAME_W, GAME_H, mulberry32, scoreRun } from '@odi/shared';
import { BIOMES, FIRSTS, type BiomeDef } from '@odi/content';
import type { GameEvent, LevelOptions } from './bridge';
import { Hero } from './hero';
import { TouchInput } from './input';
import { buildParallax } from './parallax';
import { spawnEntity } from './entities';
import { getMechanic, type LevelContext, type LevelState, type Mechanic, type Scan } from './mechanics';
import { scanAhead } from './bot';
import { Hud, flash, floatText, tapToStart, FONT, COLORS, ComboMeter, cheer, banner, endCard } from './ui';
import { sfx, unlock, setSoundsEnabled } from './audio';
import { tonotopyFreq, luckyNoteTexture } from './art';
import { RaceLayer } from './race';

const START_PAD = 220;
const END_PAD = 260;
const SPAWN_AHEAD = 900;
const DESPAWN_BEHIND = 700;

interface PlacedChunk { x: number; spec: LevelSpec['chunks'][number]; spawned: boolean }

/** Tek bölüm sahnesi: parça akışı, varlıklar, çarpışmalar, hedefler, değiştiriciler, sonuç. Mekanik hareketi yönetir. */
export class LevelScene extends Phaser.Scene {
  opts!: LevelOptions; spec!: LevelSpec; biome!: BiomeDef; mechanic!: Mechanic;
  hero!: Hero; input_!: TouchInput; hud!: Hud; ctx!: LevelContext; state!: LevelState;
  private chunks: PlacedChunk[] = []; private worldW = 0; private parallax?: { update(x: number): void };
  private gateX = 0; private startAt = 0; private lastProgress = 0; private hintText?: Phaser.GameObjects.Text; private hintTimer?: Phaser.Time.TimerEvent;
  private fog?: Phaser.GameObjects.Image; private escort?: Phaser.Physics.Arcade.Sprite; private gravityFlipAt = 0; private objectiveText!: Phaser.GameObjects.Text;
  private inputDelay: { at: number; key: 'primaryPressed' | 'secondaryPressed' }[] = [];
  private lastScan: Scan | null = null; private lastScanAt = 0;
  private noteXs: number[] = [];
  /** son güvenli zeminler: düşünce çukurun gerisinden devam (bölüm başına atmak yerine) */
  private safeSpots: { x: number; y: number }[] = []; private lastSafeCheck = 0; private lastGroundX = 0;
  private sparks?: Phaser.GameObjects.Particles.ParticleEmitter; private dust?: Phaser.GameObjects.Particles.ParticleEmitter;
  private wasAirborne = false; private combo = 0; private comboAt = 0; private progressBar!: Phaser.GameObjects.Rectangle; private nearMissed = new WeakSet<Phaser.GameObjects.GameObject>(); private lastDamageAt = -9999;
  // juice (yalnızca görsel + sonuç bayrakları): seri göstergesi, kutlama zincirleri, Şanslı Nota, "ilk kez" anları
  private comboMeter!: ComboMeter; private maxCombo = 0; private chain = 0; private chainAt = 0; private firstsDone: string[] = [];
  /** canlı yarış: hayaletler, üst şerit, geri sayım (opts.race varsa) */
  private race?: RaceLayer;
  private luckyCoin?: Phaser.Physics.Arcade.Sprite; private luckyGlow?: Phaser.GameObjects.Image; private luckyState: 'off' | 'armed' | 'placed' | 'got' | 'missed' = 'off'; private luckyCheckAt = 0;

  constructor() { super('level'); }

  create() {
    this.opts = this.registry.get('opts') as LevelOptions; this.spec = this.opts.spec;
    this.biome = BIOMES[this.spec.biome];
    this.mechanic = getMechanic(this.spec.mechanic) ?? getMechanic('kosu')!;
    setSoundsEnabled(this.opts.sounds !== false && !this.spec.modifiers.includes('cihaz-kapali'));
    const ts = this.opts.timeScale ?? 1;
    if (ts !== 1) { this.physics.world.timeScale = 1 / ts; this.time.timeScale = ts; this.tweens.timeScale = ts; }

    // dünya
    const chunks = this.spec.chunks.length ? this.spec.chunks : [];
    let x = START_PAD;
    for (const c of chunks) { this.chunks.push({ x, spec: c, spawned: false }); for (const e of c.entities) if (e.type === 'note') this.noteXs.push(x + e.x); x += c.length; }
    this.noteXs.sort((a, b) => a - b);
    if (!chunks.length) x = START_PAD + Math.max(1200, this.spec.lengthPx);
    this.worldW = x + END_PAD; this.gateX = this.worldW - 150;
    this.physics.world.setBounds(0, -1200, this.worldW, GROUND_Y + 1200 + 400);
    this.cameras.main.setBounds(0, -1200, this.worldW, GROUND_Y + 300 + 1200);

    this.parallax = buildParallax(this, this.biome, this.worldW);
    const groups = {
      platforms: this.physics.add.staticGroup(), movers: this.physics.add.group(), coins: this.physics.add.group(),
      hazards: this.physics.add.staticGroup(), enemies: this.physics.add.group(), powerups: this.physics.add.group(), specials: this.physics.add.group(),
    };
    const lives = this.spec.modifiers.includes('tek-can') ? 1 : (this.opts.lives ?? 3);
    this.state = {
      started: false, finished: false, lives, coins: 0, score: 0, timeSec: 0, deaths: 0, damageTaken: 0,
      invulnUntil: 0, shield: this.opts.skills.shield > 0 ? 1 : 0, magnetUntil: 0, speedMult: this.spec.modifiers.includes('hiz') ? 1.3 : 1,
      gravityDir: 1, notesCollected: 0, notesNeeded: this.spec.objective.id === 'melody' ? (this.spec.objective.target ?? 5) : 0, nextNote: 0,
      checkpointX: 100, secretFound: false, escortAlive: true, objectiveMet: false, custom: {},
    };
    const firstY = chunks[0]?.entryY ?? GROUND_Y;
    this.hero = new Hero(this, 100, firstY, this.opts.cosmetic?.color ?? (this.spec.mechanic === 'yuzme' ? 0x0e9c98 : 0x6c4cf1), this.opts.cosmetic?.hat);
    this.hero.sprite.setCollideWorldBounds(false);
    this.input_ = new TouchInput(this, this.spec.modifiers.includes('ayna'));
    this.hud = new Hud(this);
    this.hud.set(0, lives, `${this.spec.number} · ${this.spec.name}`);
    this.objectiveText = this.add.text(GAME_W / 2, 84, this.spec.objective.label, { fontFamily: FONT, fontSize: '13px', fontStyle: '700', color: COLORS.muted, backgroundColor: 'rgba(255,255,255,0.8)', padding: { x: 10, y: 4 } }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    this.progressBar = this.add.rectangle(0, 72, 0, 4, 0x6c4cf1, 1).setOrigin(0, 0.5).setScrollFactor(0).setDepth(102);
    this.comboMeter = new ComboMeter(this, this.opts.race ? 156 : 116);
    if (this.opts.race) this.objectiveText.setY(132); // yarış şeridine yer aç
    if (this.opts.lucky && !this.opts.bot) this.luckyState = 'armed';
    if (!this.textures.exists('spark')) { const g = this.add.graphics(); g.fillStyle(0xffffff, 1); g.fillCircle(4, 4, 4); g.generateTexture('spark', 8, 8); g.destroy(); }
    this.sparks = this.add.particles(0, 0, 'spark', { speed: { min: 60, max: 220 }, angle: { min: 0, max: 360 }, scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 }, lifespan: 420, gravityY: 500, tint: [0xffc25c, 0xffe6a8, 0xffffff], emitting: false }).setDepth(30);
    this.dust = this.add.particles(0, 0, 'spark', { speed: { min: 20, max: 80 }, angle: { min: 200, max: 340 }, scale: { start: 0.9, end: 0 }, alpha: { start: 0.5, end: 0 }, lifespan: 350, tint: this.biome.palette.groundDark, emitting: false }).setDepth(19);
    const rng = mulberry32(this.spec.seed ^ 0x9e3779b9);
    this.ctx = {
      scene: this, spec: this.spec, hero: this.hero, input: this.input_, skills: this.opts.skills, state: this.state, groups, rng,
      worldW: this.worldW, groundY: GROUND_Y, bot: !!this.opts.bot,
      damage: (r) => this.damage(r), finish: () => this.finish(), fail: (r) => this.fail(r),
      float: (x, y, t, c) => floatText(this, x, y, t, c), flash: (c) => flash(this, c), shake: (ms = 120, i = 0.008) => this.cameras.main.shake(ms, i),
      haptic: (k) => this.emit({ type: 'haptic', kind: k }), scan: (range) => this.scan(range), hint: (t, ms) => this.hint(t, ms),
    };

    // başlangıç platformu + kapı
    spawnEntity(this.ctx, { type: 'platform', x: 0, y: firstY, w: START_PAD + 10, h: 200 }, 0, this.biome);
    if (!chunks.length) spawnEntity(this.ctx, { type: 'platform', x: START_PAD, y: GROUND_Y, w: this.worldW - START_PAD, h: 200 }, 0, this.biome);
    const lastY = chunks[chunks.length - 1]?.exitY ?? GROUND_Y;
    spawnEntity(this.ctx, { type: 'platform', x: x, y: lastY, w: END_PAD + 10, h: 200 }, 0, this.biome);
    spawnEntity(this.ctx, { type: 'gate', x: this.gateX, y: lastY }, 0, this.biome);
    this.streamChunks(true);

    // çarpışmalar
    this.physics.add.collider(this.hero.sprite, groups.platforms);
    this.physics.add.collider(this.hero.sprite, groups.movers);
    this.physics.add.overlap(this.hero.sprite, groups.coins, (_h, c) => this.collectCoin(c as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.hero.sprite, groups.hazards, (_h, o) => { if (this.hazardTouch(o as Phaser.Physics.Arcade.Sprite)) this.damage('hazard'); });
    this.physics.add.overlap(this.hero.sprite, groups.enemies, (_h, e) => this.enemyTouch(e as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.hero.sprite, groups.powerups, (_h, p) => this.powerup(p as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.hero.sprite, groups.specials, (_h, s) => this.special(s as Phaser.Physics.Arcade.Sprite));

    // değiştiriciler
    if (this.spec.modifiers.includes('sis') || this.spec.modifiers.includes('gece')) this.buildFog(this.spec.modifiers.includes('gece') ? 0.96 : 0.8);
    if (this.spec.modifiers.includes('ters-yercekimi') && this.spec.mechanic !== 'ruya') { this.buildCeiling(); this.gravityFlipAt = 0; }
    if (this.spec.modifiers.includes('cihaz-kapali')) this.hint('Cihaz kapalı: jetonlar yaklaşınca görünür, ses yok', 3500);

    this.mechanic.setup(this.ctx);
    this.cameras.main.startFollow(this.hero.sprite, true, 0.12, 0.1, -GAME_W * 0.2, 120);
    this.emit({ type: 'ready' });

    const begin = () => {
      unlock(); this.state.started = true; this.startAt = this.time.now; this.emit({ type: 'started' }); if (this.spec.intro) this.hint(this.spec.intro, 3200);
      if (this.luckyState === 'armed') this.time.delayedCall(500, () => banner(this, '🍀 Bu bölümde bir Şanslı Nota var!', 0x22a565, 2200));
    };
    if (this.opts.race) {
      // yarış: dokunarak başlama yok; herkes için aynı anda (sunucu saati) 3-2-1-Başla!, öncesinde giriş kilitli
      const race = this.opts.race;
      this.race = new RaceLayer({
        scene: this, hero: this.hero, gateX: this.gateX, startX: 100, startY: firstY, timeScale: ts,
        haptic: (k) => this.emit({ type: 'haptic', kind: k }), live: () => this.state.started && !this.state.finished,
      }, race);
      const go = () => {
        this.input_.tick(); // geri sayımda biriken dokunuşları at
        begin();
        const o = this.objectiveText; this.time.delayedCall(5000, () => this.tweens.add({ targets: o, alpha: 0, duration: 400 }));
      };
      const delay = this.opts.bot ? Math.max(0, race.botDelayMs ?? 0) : 0;
      this.race.countdown(`${this.spec.number}. ${this.spec.name}\n${this.spec.objective.label}`, () => { if (delay) this.time.delayedCall(delay, go); else go(); });
    } else if (this.opts.bot) begin(); else tapToStart(this, `${this.spec.name}\n\n${this.spec.objective.label}\n\nDokun ve başla`, begin);

    // DOM köprüsü (harness / web kabuğu)
    (globalThis as unknown as { __odiScene?: LevelScene }).__odiScene = this;
    this.events.once('shutdown', () => { this.mechanic.teardown?.(this.ctx); (globalThis as unknown as { __odiScene?: LevelScene }).__odiScene = undefined; });
  }

  override update(_t: number, dtMs: number) {
    this.race?.update();
    if (!this.state.started || this.state.finished) return;
    const dt = Math.min(0.05, dtMs / 1000);
    this.state.timeSec += (dtMs / 1000) * (this.opts.timeScale ?? 1);
    const raw = this.input_.tick();
    const input = { ...raw };
    // yankı: girişler gecikmeli ulaşır
    if (this.spec.modifiers.includes('yanki')) {
      const now = this.time.now;
      if (raw.primaryPressed) this.inputDelay.push({ at: now + 140, key: 'primaryPressed' });
      if (raw.secondaryPressed) this.inputDelay.push({ at: now + 140, key: 'secondaryPressed' });
      input.primaryPressed = false; input.secondaryPressed = false;
      this.inputDelay = this.inputDelay.filter((q) => { if (q.at <= now) { input[q.key] = true; return false; } return true; });
    }
    if (this.opts.bot && !this.opts.botIdle) { this.mechanic.botTick(this.ctx, this.input_, this.scan()); Object.assign(input, this.input_.tick(), { primaryPressed: input.primaryPressed || this.input_.state.primaryPressed }); }
    this.mechanic.update(this.ctx, input, dt);
    this.streamChunks(false);
    this.parallax?.update(this.cameras.main.scrollX);
    if (this.fog) { const cam = this.cameras.main; this.fog.setPosition(this.hero.x - cam.scrollX, this.hero.y - 30 - cam.scrollY); }
    if (this.spec.modifiers.includes('ters-yercekimi') && !this.state.custom.manualGravity) this.tickGravityFlip();
    if (this.spec.modifiers.includes('cihaz-kapali')) this.revealNearbyCoins();
    if (this.state.magnetUntil > this.time.now || this.opts.skills.magnet > 0) this.magnet(80 + this.opts.skills.magnet * 50);
    if (this.escort) { this.escort.x += (this.hero.x - 56 - this.escort.x) * 0.08; this.escort.y += (this.hero.y - 40 - this.escort.y) * 0.08; }
    // iniş tozu
    const hb = this.hero.body; const groundedNow = this.state.gravityDir === 1 ? hb.blocked.down || hb.touching.down : hb.blocked.up || hb.touching.up;
    if (groundedNow && this.wasAirborne) { this.dust?.explode(8, this.hero.x, this.hero.y - (this.state.gravityDir === 1 ? 2 : 46)); this.hero.squash(1.18, 0.82, 70); }
    this.wasAirborne = !groundedNow;
    if (groundedNow && this.state.gravityDir === 1) { this.lastGroundX = this.hero.x; if (this.time.now - this.lastSafeCheck > 200) { this.lastSafeCheck = this.time.now; this.recordSafeSpot(); } }
    this.nearMiss();
    this.comboMeter.tick(this.combo >= 2 ? 1 - (this.time.now - this.comboAt) / 1400 : 0);
    if (this.luckyState !== 'off') this.tickLucky();
    this.progressBar.width = GAME_W * Math.min(1, this.hero.x / this.gateX);
    // düşme
    if (this.hero.y > GROUND_Y + 420 || this.hero.y < -1300) this.damage('fall');
    // ilerleme olayı
    if (this.time.now - this.lastProgress > 500) { this.lastProgress = this.time.now; this.emit({ type: 'progress', pct: Math.min(1, this.hero.x / this.gateX), coins: this.state.coins, score: this.state.score }); }
    // kapı: kahraman kapıyı geçerse (overlap kaçsa da) bitir
    if (this.hero.x >= this.gateX + 20) this.finish();
    this.hud.set(this.state.score, this.state.lives);
  }

  // ---- parça akışı
  private streamChunks(initial: boolean) {
    const camR = this.cameras.main.scrollX + GAME_W + SPAWN_AHEAD;
    for (const c of this.chunks) {
      if (!c.spawned && (initial ? c.x < GAME_W + SPAWN_AHEAD : c.x < camR)) {
        c.spawned = true;
        for (const e of c.spec.entities) { if (!(this.mechanic.spawn?.(this.ctx, e, c.x))) spawnEntity(this.ctx, e, c.x, this.biome); }
      }
    }
    if (!initial && (this.time.now & 15) === 0) {
      const limit = this.cameras.main.scrollX - DESPAWN_BEHIND;
      for (const g of [this.ctx.groups.coins, this.ctx.groups.enemies, this.ctx.groups.powerups]) { // hareketli platformlar silinmez: geri doğan oyuncu çukuru yine geçebilsin
        for (const o of g.getChildren() as Phaser.Physics.Arcade.Sprite[]) if (o.active && o.x + 200 < limit) o.destroy();
      }
    }
  }

  // ---- etkileşimler
  private collectCoin(c: Phaser.Physics.Arcade.Sprite) {
    if (!c.active) return; const e = c.getData('e') as Entity; const wasLucky = c === this.luckyCoin; c.destroy();
    if (wasLucky) this.collectLucky(c.x, c.y);
    if (e.type === 'note') {
      const wx = Number(c.getData('wx')); const gi = this.noteXs.indexOf(wx); const idx = gi >= 0 ? gi : Number(e.props?.idx ?? this.state.notesCollected);
      const t = Number(e.props?.t ?? idx / Math.max(1, this.state.notesNeeded));
      if (idx === this.state.nextNote) { this.state.nextNote++; this.state.notesCollected++; sfx.toneAt(tonotopyFreq(1 - t), 0.25); floatText(this, c.x, c.y - 10, `♪ ${this.state.notesCollected}/${this.state.notesNeeded}`, COLORS.accent); this.state.score += 40; }
      else { sfx.tick(); floatText(this, c.x, c.y - 10, 'sıra değil', COLORS.coral); this.state.score += 5; }
      return;
    }
    this.state.coins++; this.state.score += 10; sfx.coin(); this.emit({ type: 'haptic', kind: 'light' });
    this.sparks?.explode(6, c.x, c.y);
    const now = this.time.now; this.combo = now - this.comboAt < 1400 ? this.combo + 1 : 1; this.comboAt = now;
    this.maxCombo = Math.max(this.maxCombo, this.combo); this.comboMeter.bump(this.combo);
    if (this.combo > 0 && this.combo % 5 === 0) {
      const bonus = this.combo * 4; this.state.score += bonus; floatText(this, c.x, c.y - 16, `Seri x${this.combo}  +${bonus}`, COLORS.amber); sfx.power(); this.emit({ type: 'haptic', kind: 'medium' });
      const words = ['Güzel!', 'Harika!', 'Mükemmel!', 'Kulaklara ziyafet!', 'Efsane frekans!'];
      cheer(this, words[Math.min(words.length - 1, this.combo / 5 - 1)]!, this.combo >= 15 ? COLORS.coral : COLORS.amber); this.firstTime('seri5');
    }
    else if (this.state.coins % 10 === 0) floatText(this, c.x, c.y - 10, `${this.state.coins} 🪙`, COLORS.amber);
  }
  private hazardTouch(_o: Phaser.Physics.Arcade.Sprite) { return true; }
  private enemyTouch(e: Phaser.Physics.Arcade.Sprite) {
    if (!e.active) return;
    const hb = this.hero.body; const eb = e.body as Phaser.Physics.Arcade.Body;
    const stomp = hb.velocity.y > 60 && hb.bottom < eb.top + 22 && this.state.gravityDir === 1;
    if (stomp) {
      e.destroy(); hb.setVelocityY(-420); this.state.score += 50; sfx.bounce(); this.hero.mood('wow', 300); floatText(this, e.x, e.y - 30, '+50 ezme!', COLORS.accent2); this.emit({ type: 'haptic', kind: 'medium' });
      this.firstTime('ezme'); this.chainHit('ezme');
      return;
    }
    if (this.escort && Phaser.Math.Distance.Between(this.escort.x, this.escort.y, e.x, e.y) < 40 && this.state.escortAlive) { this.state.escortAlive = false; this.escort.setTint(0x999999); this.hint('Fısıltı yaralandı… hedef kaçtı', 2000); }
    this.damage('enemy');
  }
  private powerup(p: Phaser.Physics.Arcade.Sprite) {
    if (!p.active) return; const kind = String((p.getData('e') as Entity).props?.kind ?? 'shield'); p.destroy(); sfx.power(); this.emit({ type: 'haptic', kind: 'success' }); this.firstTime('guc');
    switch (kind) {
      case 'shield': this.state.shield = Math.min(2, this.state.shield + 1); this.hero.sprite.setTint(0xbfe3ff); floatText(this, this.hero.x, this.hero.y - 70, 'Kalkan!', COLORS.accent); break;
      case 'magnet': this.state.magnetUntil = this.time.now + 8000; floatText(this, this.hero.x, this.hero.y - 70, 'Mıknatıs 8s', COLORS.amber); break;
      case 'life': this.state.lives = Math.min(5, this.state.lives + 1); floatText(this, this.hero.x, this.hero.y - 70, '+1 can', COLORS.coral); break;
      case 'speed': this.state.speedMult *= 1.25; this.time.delayedCall(6000, () => { this.state.speedMult /= 1.25; }); floatText(this, this.hero.x, this.hero.y - 70, 'Hız!', COLORS.accent2); break;
    }
  }
  private special(s: Phaser.Physics.Arcade.Sprite) {
    if (!s.active) return; const e = s.getData('e') as Entity;
    if (this.mechanic.onSpecial?.(this.ctx, s, e)) return;
    const hb = this.hero.body;
    switch (e.type) {
      case 'spring': case 'trampoline': {
        if (hb.velocity.y * this.state.gravityDir <= 0) return;
        const power = Number(e.props?.power ?? 1); hb.setVelocityY(-900 * power * this.state.gravityDir); this.hero.stretch(); sfx.bounce(); this.emit({ type: 'haptic', kind: 'medium' });
        this.tweens.add({ targets: s, scaleY: 0.6, duration: 80, yoyo: true }); break;
      }
      case 'checkpoint': if (this.state.checkpointX < s.x) { this.state.checkpointX = s.x; s.setTint(0x8ef0b0); sfx.tick(); floatText(this, s.x, s.y - 60, 'Kontrol noktası', COLORS.accent2); this.emit({ type: 'checkpoint', x: s.x }); this.firstTime('kontrol'); } break;
      case 'secret': if (!this.state.secretFound) { this.state.secretFound = true; s.destroy(); this.state.score += 500; sfx.levelUp(); flash(this, 0xffc25c, 0.3); floatText(this, this.hero.x, this.hero.y - 80, 'Altın koklea! +500', COLORS.amber); this.emit({ type: 'haptic', kind: 'success' }); } break;
      case 'gate': this.finish(); break;
      case 'escortee': if (!this.escort) { this.escort = s; (s.body as Phaser.Physics.Arcade.Body).enable = false; this.hint('Fısıltı seni izliyor. Onu düşmanlardan koru!', 2500); } break;
      default: break;
    }
  }
  private magnet(r: number) {
    for (const c of this.ctx.groups.coins.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
      if (!c.active) continue; const d = Phaser.Math.Distance.Between(c.x, c.y, this.hero.x, this.hero.y - 24);
      if (d < r) { c.x += (this.hero.x - c.x) * 0.18; c.y += (this.hero.y - 24 - c.y) * 0.18; }
    }
  }
  private revealNearbyCoins() {
    for (const c of this.ctx.groups.coins.getChildren() as Phaser.Physics.Arcade.Sprite[]) { if (!c.active) continue; const d = Math.abs(c.x - this.hero.x); c.setAlpha(d < 90 ? 1 : d < 200 ? 0.35 : 0.04); }
  }

  // ---- hasar / sonuç
  damage(reason: string): boolean {
    if (this.state.finished || this.time.now < this.state.invulnUntil) return false;
    if (reason !== 'fall' && this.state.shield > 0) { this.state.shield--; this.state.invulnUntil = this.time.now + 1000; this.hero.blink(900); if (this.state.shield === 0) this.hero.sprite.clearTint(); sfx.hit(); floatText(this, this.hero.x, this.hero.y - 70, 'Kalkan kırıldı', COLORS.accent); return false; }
    this.state.lives--; this.state.damageTaken++; this.state.invulnUntil = this.time.now + 1500; this.lastDamageAt = this.time.now;
    this.mechanic.onDamage?.(this.ctx);
    sfx.hit(); flash(this); this.cameras.main.shake(160, 0.01); this.hero.mood('hurt', 700); this.hero.squash(); this.emit({ type: 'haptic', kind: 'heavy' }); this.emit({ type: 'damage', lives: this.state.lives });
    if (this.state.lives <= 0) { this.fail(reason); return true; }
    if (reason === 'fall') { this.state.deaths++; this.respawn(); } else this.hero.blink(1400);
    return true;
  }
  /** kahraman sabit bir platformun üstünde ve yakınında tehlike yoksa konumu kaydet */
  private recordSafeSpot() {
    const hb = this.hero.body; const x = hb.center.x, feet = hb.bottom;
    let onStatic = false;
    for (const o of this.ctx.groups.platforms.getChildren() as Phaser.Physics.Arcade.Sprite[]) { const b = o.body as Phaser.Physics.Arcade.StaticBody | null; if (b && x > b.left + 20 && x < b.right - 20 && Math.abs(b.top - feet) < 6) { onStatic = true; break; } }
    if (!onStatic) return;
    for (const g of [this.ctx.groups.hazards, this.ctx.groups.enemies]) for (const o of g.getChildren() as Phaser.Physics.Arcade.Sprite[]) { const b = o.body as Phaser.Physics.Arcade.Body | null; if (o.active && b && b.right > x - 70 && b.left < x + 70) return; }
    const last = this.safeSpots[this.safeSpots.length - 1];
    if (!last || Math.abs(last.x - x) > 40) { this.safeSpots.push({ x, y: feet }); if (this.safeSpots.length > 60) this.safeSpots.shift(); }
  }
  private respawn() {
    // düşülen yerden en az 180 px geride kalan son güvenli zemin; yoksa kontrol noktası
    let spot: { x: number; y: number } | undefined;
    for (let i = this.safeSpots.length - 1; i >= 0; i--) { const sp = this.safeSpots[i]!; if (sp.x <= this.lastGroundX - 180 && sp.x >= this.state.checkpointX) { spot = sp; break; } }
    const cx = spot?.x ?? this.state.checkpointX; const cy = spot ? spot.y - 2 : GROUND_Y - 10;
    this.hero.sprite.setPosition(cx, cy); this.hero.body.reset(cx, cy); this.hero.body.setVelocity(0, 0);
    if (this.state.gravityDir === -1) this.flipGravity();
    this.hero.blink(1400); this.cameras.main.flash(200, 255, 255, 255);
  }
  private result(completed: boolean): RunResult {
    const base = { levelId: this.spec.id, completed, coins: this.state.coins, timeSec: Math.round(this.state.timeSec * 10) / 10, deaths: this.state.deaths, damageTaken: this.state.damageTaken, objectiveMet: this.objectiveMet(completed), secretFound: this.state.secretFound };
    return { ...base, ...scoreRun(this.spec, base) };
  }
  private objectiveMet(completed: boolean): boolean {
    if (!completed) return false; const o = this.spec.objective; const s = this.state;
    switch (o.id) {
      case 'reach': return true; case 'collect-all': return s.coins >= (o.target ?? this.spec.coinsTotal); case 'timed': return s.timeSec <= (o.target ?? this.spec.parTimeSec);
      case 'escort': return s.escortAlive; case 'boss': return !!s.custom.bossDefeated; case 'secret': return s.secretFound; case 'no-damage': return s.damageTaken === 0; case 'melody': return s.notesCollected >= s.notesNeeded;
    }
  }
  finish() {
    if (this.state.finished || !this.state.started) return; this.state.finished = true;
    this.comboMeter.tick(0); this.race?.finished(true);
    const r = this.withJuice(this.result(true)); this.state.objectiveMet = r.objectiveMet;
    sfx.levelUp(); flash(this, 0x8ef0b0, 0.35, 400); this.hero.mood('wow'); this.emit({ type: 'haptic', kind: 'success' });
    this.hero.body.setVelocity(0, 0); this.hero.body.setAllowGravity(false);
    this.tweens.add({ targets: this.hero.sprite, y: this.hero.y - 40, scale: 1.2, duration: 500, ease: 'Back.Out' });
    endCard(this, { stars: r.stars, title: r.score.toLocaleString('tr-TR'), sub: r.stars === 3 ? 'Mükemmel!' : r.stars === 2 ? 'Harika!' : 'Kapıdan geçtin!' });
    this.time.delayedCall(this.opts.bot ? 100 : 900, () => this.emit({ type: 'levelComplete', result: r }));
  }
  fail(reason: string) {
    if (this.state.finished) return; this.state.finished = true; this.comboMeter.tick(0); this.race?.finished(false);
    this.hud.set(this.state.score, this.state.lives); const r = this.withJuice(this.result(false)); sfx.gameOver(); this.hero.mood('hurt'); this.emit({ type: 'haptic', kind: 'error' });
    const pct = Math.max(0, Math.min(1, this.hero.x / this.gateX));
    endCard(this, { title: reason === 'fall' ? 'Düştün…' : reason === 'yaris-bitti' ? 'Yarış bitti!' : 'Odi yoruldu…', sub: pct >= 0.5 ? `Kapıya %${Math.max(1, 100 - Math.round(pct * 100))} kaldı` : `Yolun %${Math.round(pct * 100)}'i geride` });
    this.time.delayedCall(this.opts.bot ? 100 : 900, () => this.emit({ type: 'levelFailed', result: { ...r, extra: { ...r.extra, reason, pct: Math.round(pct * 1000) / 1000 } } }));
  }

  // ---- yardımcılar
  /** Engeli hasarsız ve yakından geçince küçük ödül: "Kıl payı!" */
  private nearMiss() {
    if (this.time.now - this.lastDamageAt < 600) return;
    const hb = this.hero.body;
    for (const g of [this.ctx.groups.hazards, this.ctx.groups.enemies]) {
      for (const o of g.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
        if (!o.active || !o.body || this.nearMissed.has(o)) continue;
        const b = o.body as Phaser.Physics.Arcade.Body;
        if (b.right < hb.left && b.right > hb.left - 24) {
          this.nearMissed.add(o);
          const dy = Math.min(Math.abs(hb.bottom - b.top), Math.abs(b.bottom - hb.top));
          if (dy < 26) { this.state.score += 25; floatText(this, this.hero.x, this.hero.y - 76, 'Kıl payı! +25', COLORS.coral); sfx.tick(); this.emit({ type: 'haptic', kind: 'light' }); this.firstTime('kilpayi'); this.chainHit('kilpayi'); }
        }
      }
    }
  }
  // ---- juice yardımcıları (mekaniği etkilemez)
  /** sonuca görsel olayların bayraklarını ekler: en uzun seri, Şanslı Nota, ilk kez anları */
  private withJuice(r: RunResult): RunResult {
    const extra: Record<string, number | string | boolean> = { ...r.extra, maxCombo: this.maxCombo };
    if (this.luckyState === 'got') extra.luckyNote = true;
    if (this.firstsDone.length) extra.firsts = this.firstsDone.join(',');
    return { ...r, extra };
  }
  private firstTime(id: string) {
    if (!this.opts.firsts?.includes(id) || this.firstsDone.includes(id)) return;
    this.firstsDone.push(id); banner(this, `🎉 ${FIRSTS[id] ?? 'İlk kez!'}`, 0x6c4cf1, 1500); sfx.power();
  }
  /** kısa sürede art arda ezme / kıl payı: "Mükemmel!" zinciri */
  private chainHit(_kind: string) {
    const now = this.time.now; this.chain = now - this.chainAt < 4000 ? this.chain + 1 : 1; this.chainAt = now;
    if (this.chain >= 2) cheer(this, this.chain >= 4 ? 'Kulak ustası!' : this.chain === 3 ? 'Mükemmel!' : 'İkiledin!', this.chain >= 3 ? COLORS.coral : COLORS.accent, 28 + Math.min(3, this.chain) * 2);
  }
  /** Şanslı Nota: ileride, yolun ortasındaki bir jetonun üstüne yerleşir; o jetonla birlikte toplanır. */
  private tickLucky() {
    const now = this.time.now;
    if (this.luckyState === 'armed' && now - this.luckyCheckAt > 250) {
      this.luckyCheckAt = now; const lo = this.gateX * 0.3, hi = this.gateX * 0.85;
      if (this.hero.x > hi) { this.luckyState = 'missed'; return; }
      for (const c of this.ctx.groups.coins.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
        const e = c.getData('e') as Entity | undefined;
        if (c.active && e?.type === 'coin' && c.x > lo && c.x < hi && c.x > this.hero.x + GAME_W * 0.7) {
          this.luckyCoin = c; this.luckyState = 'placed';
          this.luckyGlow = this.add.image(c.x, c.y, luckyNoteTexture(this)).setDepth(16);
          this.tweens.add({ targets: this.luckyGlow, scale: 1.18, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.InOut' });
          break;
        }
      }
    } else if (this.luckyState === 'placed') {
      const c = this.luckyCoin;
      if (!c || !c.active) { if (this.luckyState === 'placed') { this.luckyState = 'missed'; this.luckyGlow?.destroy(); } return; }
      this.luckyGlow?.setPosition(c.x, c.y - 2);
    }
  }
  private collectLucky(x: number, y: number) {
    this.luckyState = 'got'; this.luckyGlow?.destroy(); this.luckyGlow = undefined;
    this.sparks?.explode(18, x, y); sfx.levelUp(); flash(this, 0x8ef0b0, 0.25, 260); this.emit({ type: 'haptic', kind: 'success' });
    cheer(this, '🍀 Şanslı Nota!', '#1b8f52', 32); floatText(this, x, y - 30, 'Bonus sonuçta!', '#1b8f52');
  }

  private emit(e: GameEvent) { try { void this.opts.onEvent(e); } catch { /* kabuk hatası oyunu durdurmasın */ } }
  private scan(range?: number): Scan { if (this.lastScan && this.time.now - this.lastScanAt < 33) return this.lastScan; this.lastScan = scanAhead(this.ctx, range); this.lastScanAt = this.time.now; return this.lastScan; }
  hint(text: string, ms = 2500) {
    this.hintText?.destroy(); this.hintTimer?.remove();
    this.hintText = this.add.text(GAME_W / 2, GAME_H - 70, text, { fontFamily: FONT, fontSize: '16px', fontStyle: '700', color: COLORS.text, align: 'center', backgroundColor: 'rgba(255,255,255,0.9)', padding: { x: 14, y: 8 }, wordWrap: { width: GAME_W - 60 } }).setOrigin(0.5).setScrollFactor(0).setDepth(160);
    this.hintTimer = this.time.delayedCall(ms, () => { const t = this.hintText; if (t) this.tweens.add({ targets: t, alpha: 0, duration: 300, onComplete: () => t.destroy() }); });
  }
  private buildFog(strength: number) {
    const key = `fog-${strength}`; const W = GAME_W * 3, H = GAME_H * 3;
    if (!this.textures.exists(key)) {
      const c = this.textures.createCanvas(key, W, H)!; const g = c.context; const grad = g.createRadialGradient(W / 2, H / 2, 110, W / 2, H / 2, 260);
      grad.addColorStop(0, 'rgba(10,12,30,0)'); grad.addColorStop(1, `rgba(10,12,30,${strength})`); g.fillStyle = grad; g.fillRect(0, 0, W, H); c.refresh();
    }
    this.fog = this.add.image(0, 0, key).setScrollFactor(0).setDepth(80);
  }
  private buildCeiling() {
    for (const o of this.ctx.groups.platforms.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
      const e = o.getData('e') as Entity | undefined; if (!e || (e.h ?? 0) < 100) continue;
      spawnEntity(this.ctx, { type: 'platform', x: e.x, y: GROUND_Y - 520, w: e.w, h: 40 }, Number(o.getData('wx')) - e.x, this.biome);
    }
    this.hint('Ters yerçekimi: her 8 saniyede yön değişir', 3000);
  }
  private tickGravityFlip() {
    if (this.gravityFlipAt === 0) this.gravityFlipAt = this.time.now + 8000;
    if (this.time.now >= this.gravityFlipAt) { this.gravityFlipAt = this.time.now + 8000; this.flipGravity(); }
    else if (this.gravityFlipAt - this.time.now < 1000 && Math.floor(this.time.now / 250) % 2 === 0) this.hero.sprite.setTint(0xffd166); else if (this.state.shield === 0) this.hero.sprite.clearTint();
  }
  private flipGravity() {
    this.state.gravityDir = this.state.gravityDir === 1 ? -1 : 1;
    this.physics.world.gravity.y = 1400 * this.state.gravityDir; this.hero.sprite.setFlipY(this.state.gravityDir === -1); sfx.power(); this.cameras.main.flash(120, 255, 240, 200);
  }
}
