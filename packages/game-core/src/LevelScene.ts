import Phaser from 'phaser';
import type { AbilityId, Entity, LevelSpec, RunResult } from '@odi/shared';
import { GROUND_Y, GAME_W, GAME_H, scoreRun } from '@odi/shared';
import { BIOMES, FIRSTS, tutorialKey, type BiomeDef } from '@odi/content';
import { resolveTrack } from '@odi/audio';
import type { GameEvent, LevelOptions } from './bridge';
import { TouchInput } from './input';
import { flash, floatText, tapToStart, COLORS, banner, endCard } from './ui';
import { sfx, unlock, setSoundsEnabled, music, beatClock } from './audio';
import { tonotopyFreq } from './art';
import { RaceLayer } from './race';
import { DT, HERO_H, HERO_HW, BREATH } from './play/consts';
import { buildWorld, near, type WEnt, type World } from './play/world';
import { beatState, colorMatch, enemyAt, enemyKind, hazardAt, hazardWarn, initState, lastRect, NO_INPUT, projectiles, solidAt, step, type SimEvent, type SimInput, type SimState } from './play/sim';
import { Planner } from './play/planner';
import { Tutorial, TUTORIAL_SLOW, TUTORIAL_SUCCESS } from './play/tutorial';
import {
  paintBiome, makeTerrain, drawEntity, createHeroView, createHud, createFx, createBossView, createProjectileLayer, createEscortView, luckyGlow, setVisualResolution, setFxQuality,
  type BiomeBackdrop, type EntityView, type EntityVisual, type HeroView, type HeroHandle, type LevelHudView, type LevelFx, type BossView, type ProjectileLayer, type TerrainRect, type TerrainLayer, type HintKind,
} from './play/visuals';

/** kabuğun/harness'in okuduğu özet durum (geriye uyum: state.finished, lives, custom.boss*) */
export interface LevelState {
  started: boolean; finished: boolean; lives: number; coins: number; score: number; timeSec: number; deaths: number; damageTaken: number; shield: number;
  custom: Record<string, number | string | boolean>;
}

const RECT_TYPES = new Set(['moving', 'lift', 'crumble', 'wall', 'barrier', 'door', 'freqgate', 'beat', 'echo', 'water', 'gravzone', 'current', 'hazard', 'platform']);
const STREAM_AHEAD = 700, STREAM_KEEP = 1000;

/**
 * Tek bölüm sahnesi. Oynanış play/sim.ts'teki deterministik adımla (1/60 sn sabit) yürür; bu sahne yalnızca
 * girdiyi toplar, adımları çalıştırır, sim olaylarını sese/ışığa/kutlamaya çevirir ve play/visuals.ts seam'leriyle çizer.
 * Bot (opts.bot) aynı adımın üstünde planlayıcı (play/planner.ts) ile oynar; boşta (botIdle) hiçbir girdi vermez.
 */
export class LevelScene extends Phaser.Scene {
  opts!: LevelOptions; spec!: LevelSpec; biome!: BiomeDef;
  world!: World; sim!: SimState; planner?: Planner;
  input_!: TouchInput; state!: LevelState; race?: RaceLayer;
  heroView!: HeroView; hud!: LevelHudView;
  private backdrop?: BiomeBackdrop; private views = new Map<number, EntityView>(); private streamAt = 0;
  private projLayer!: ProjectileLayer; private bossView?: BossView; private escortView?: { update(x: number, y: number, alive: boolean): void };
  private acc = 0; private startAt = 0; private lastProgress = 0; private camX = 0; private camY = 0;
  private hintTimer?: Phaser.Time.TimerEvent; private fog?: Phaser.GameObjects.Image;
  private fx!: LevelFx; private terrain!: TerrainLayer; private dpr = 1; private praiseFree = 0; private comboShown = 0;
  private combo = 0; private comboAt = -99; private maxCombo = 0; private chain = 0; private chainAt = -99; private firstsDone: string[] = [];
  private nearMissed = new Set<number>(); private lastHurtAt = -99;
  private luckyId = -1; private luckyGlowImg?: Phaser.GameObjects.Image; private luckyState: 'off' | 'armed' | 'got' | 'missed' = 'off';
  private tutorial?: Tutorial; private tutorialT = 0; private tutorAbilities = new Set<AbilityId>();
  private resultSent = false; private lastWall = 0;
  /** görsel kalite: gerçek cihazda kare hızı 2 sn boyunca ~45'in altında kalırsa 'low'a iner (bot/harness'te ölçülmez) */
  quality: 'high' | 'low' = 'high'; private perfMs = 0; private perfN = 0; private perfLast = 0;

  constructor() { super('level'); }

  /** yarış katmanı ve harness araçları: hero.x / hero.y */
  get hero(): HeroHandle { return this.heroView.hero; }

  create() {
    this.opts = this.registry.get('opts') as LevelOptions; this.spec = this.opts.spec;
    this.biome = BIOMES[this.spec.biome];
    setSoundsEnabled(this.opts.sounds !== false && !this.spec.modifiers.includes('cihaz-kapali'));
    const ts = this.opts.timeScale ?? 1;
    // parçacıklar da sahne hız çarpanıyla (ağır çekim kayıt: tools/reels)
    this.sys.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, (o: Phaser.GameObjects.GameObject) => { if (o instanceof Phaser.GameObjects.Particles.ParticleEmitter) o.timeScale = this.opts.timeScale ?? 1; });
    if (ts !== 1) this.setTimeScale(ts);
    const isBoss = this.spec.mechanic === 'boss' || !!this.spec.boss;
    const track = isBoss ? 'boss' : (`biyom:${this.spec.biome}` as const);
    const bpm = resolveTrack(track)?.bpm ?? 100;

    // ---- simülasyon
    this.world = buildWorld(this.spec, { skills: this.opts.skills, bpm });
    const revirPct = this.opts.firstHitIgnorePct ?? 0;
    this.sim = initState(this.world, { lives: this.opts.lives, revir: !this.opts.bot && revirPct > 0 && Math.random() * 100 < revirPct });
    this.sim.events = [];
    if (this.opts.bot && !this.opts.botIdle) this.planner = new Planner(this.world);
    this.state = { started: false, finished: false, lives: this.sim.lives, coins: 0, score: 0, timeSec: 0, deaths: 0, damageTaken: 0, shield: this.sim.shield, custom: {} };

    // ---- görünüm (seam'ler: play/visuals.ts)
    const w = this.world;
    // keskinlik: oyun cihaz piksel oranında boyutlanır, kamera aynı oranda yakınlaşır (köşe kökenli: tasarım birimi = 390×780)
    this.dpr = Number(this.registry.get('dpr') ?? 1) || 1; setVisualResolution(this.dpr);
    this.cameras.main.setZoom(this.dpr).setOrigin(0, 0);
    this.quality = this.dpr > 1 ? 'high' : 'low'; setFxQuality(1);
    this.backdrop = paintBiome(this, this.biome, w.worldW, GROUND_Y + 1200, this.quality);
    const terrain: TerrainRect[] = [];
    for (const e of w.ents) if (isTerrain(e)) terrain.push({ l: e.l, t: e.t, r: e.r, b: e.b, kind: e.type === 'wall' ? 'wall' : e.p.tavan ? 'ceiling' : 'platform' });
    this.terrain = makeTerrain(this, terrain, this.biome);
    const heroColor = this.opts.cosmetic?.color ?? (this.spec.biome.startsWith('koklea') ? 0x0e9c98 : 0x6c4cf1);
    this.heroView = createHeroView(this, this.opts.cosmetic, w.startX, w.startY, heroColor);
    this.projLayer = createProjectileLayer(this, this.biome);
    if (this.sim.boss) this.bossView = createBossView(this, this.sim.boss.kind, this.sim.boss.name, GROUND_Y, this.biome);
    this.fx = createFx(this, this.biome);
    this.hud = createHud(this, heroColor, 0);
    if (!w.boss) this.hud.setCheckpoints(w.sectionX.slice(1).map((x) => x / w.gateX));
    this.hud.onPause(() => this.opts.onPauseRequest?.());
    this.input_ = new TouchInput(this, this.spec.modifiers.includes('ayna'));
    if (this.spec.modifiers.includes('sis') || this.spec.modifiers.includes('gece')) this.buildFog(this.spec.modifiers.includes('gece') ? 0.96 : 0.8);
    if (this.spec.modifiers.includes('cihaz-kapali')) this.hint('Cihaz kapalı: notalar yaklaşınca görünür, ses yok', 3500);
    if (this.opts.lucky && !this.opts.bot) this.armLucky();
    this.camX = Math.max(0, w.startX - GAME_W * 0.3); this.camY = w.startY - GAME_H * 0.62;
    this.syncCamera(1); this.syncViews(true); this.syncHero(); this.syncHud();

    this.emit({ type: 'ready' });
    music(track);
    const begin = () => {
      unlock(); music(track); this.state.started = true; this.startAt = this.time.now; this.emit({ type: 'started' });
      if (this.spec.intro) this.hint(this.spec.intro, 3200);
      if (this.luckyState === 'armed') this.time.delayedCall(500, () => banner(this, '🍀 Bu bölümde bir Şanslı Nota var!', 0x22a565, 2200));
      if (this.spec.modifiers.includes('ters-yercekimi')) this.hint('Ters yerçekimi: tavanlı yerlerde zaman zaman yön değişir', 3000);
    };
    if (this.opts.race) {
      const race = this.opts.race;
      this.race = new RaceLayer({ scene: this, hero: this.hero, gateX: w.gateX, startX: w.startX, startY: w.startY, timeScale: ts, haptic: (k) => this.emit({ type: 'haptic', kind: k }), live: () => this.state.started && !this.state.finished, heroColor }, race);
      const go = () => { this.input_.tick(); begin(); };
      const delay = this.opts.bot ? Math.max(0, race.botDelayMs ?? 0) : 0;
      this.race.countdown(`${this.spec.number}. ${this.spec.name}\n${this.spec.objective.label}`, () => { if (delay) this.time.delayedCall(delay, go); else go(); });
    } else if (this.opts.bot) begin(); else tapToStart(this, `${this.spec.name}\n\n${this.spec.objective.label}\n\nDokun ve başla`, begin);

    (globalThis as unknown as { __odiScene?: LevelScene }).__odiScene = this;
    this.events.once('shutdown', () => { (globalThis as unknown as { __odiScene?: LevelScene }).__odiScene = undefined; });
  }

  override update(_t: number, dtMs: number) {
    this.race?.update();
    if (!this.state.started) { this.syncHero(); return; }
    if (this.state.finished) return; // bitiş animasyonu kahraman sprite'ını kendisi taşır
    // bot (harness): duvar saati — Phaser düşük kare hızında deltayı kırptığından simülasyon gerçek zamanın gerisinde kalmasın
    const wall = performance.now(); const botDt = this.lastWall ? (wall - this.lastWall) / 1000 : dtMs / 1000; this.lastWall = wall;
    // kare başına en çok 0,25 oyun saniyesi (ağır çekimde gerçek süre buna göre uzar)
    const ts = this.opts.timeScale ?? 1;
    const realDt = Math.min(0.25 / Math.min(1, ts), this.opts.bot ? botDt : dtMs / 1000);
    const slow = this.tutorial ? TUTORIAL_SLOW : 1;
    this.acc += realDt * ts * slow;
    if (this.tutorial) { this.tutorialT += realDt * Math.min(1, ts); if (this.tutorialT > 6) this.endTutorial(false); }
    if (this.comboShown && this.sim.t - this.comboAt > 1.4) { this.comboShown = 0; this.hud.setCombo(0, 1); }
    this.beatSync();
    const raw = this.input_.tick();
    let first = true; let n = 0;
    while (this.acc >= DT && n < 40 && !this.sim.finished && !this.sim.failed) {
      let inp: SimInput;
      if (this.planner) { inp = this.planner.next(this.sim); this.mirrorBotInput(inp); }
      else if (this.opts.bot) inp = NO_INPUT;
      else inp = { down: raw.primaryDown, pressed: first && raw.primaryPressed, released: first && raw.primaryReleased, swipeDown: first && raw.secondaryPressed, dash: first && !!raw.dashPressed };
      step(this.world, this.sim, inp);
      first = false; this.acc -= DT; n++;
      this.handleEvents();
      if (this.state.finished) break;
    }
    if (n >= 40) this.acc = 0;
    if (this.sim.failed && !this.state.finished) { this.fail(this.sim.failed); return; }
    if (this.sim.finished && !this.state.finished) { this.finish(); }
    this.state.timeSec = this.sim.t; this.state.lives = this.sim.lives; this.state.coins = this.sim.coins; this.state.deaths = this.sim.deaths; this.state.damageTaken = this.sim.damageTaken; this.state.shield = this.sim.shield;
    if (this.sim.boss) { const b = this.sim.boss; this.state.custom.bossHp = b.hp; this.state.custom.bossPhase = b.phase; this.state.custom.bossMode = b.mode; this.state.custom.bossDefeated = b.defeated; }
    this.syncCamera(realDt * Math.min(1, ts)); this.syncViews(false); this.syncHero(); this.syncHud();
    this.backdrop?.update(this.cameras.main);
    this.watchPerf();
    if (this.fog) { const cam = this.cameras.main; this.fog.setPosition(this.hero.x - cam.scrollX, this.hero.y - 30 - cam.scrollY); }
    this.nearMiss();
    if (this.luckyState === 'armed') this.tickLucky();
    if (this.time.now - this.lastProgress > 500) { this.lastProgress = this.time.now; this.emit({ type: 'progress', pct: this.pct(), coins: this.sim.coins, score: this.state.score }); }
  }

  // ------------------------------------------------------------------ olaylar → his
  private handleEvents() {
    const evs = this.sim.events!; if (!evs.length) return;
    for (const e of evs) this.onEvent(e);
    evs.length = 0;
  }
  private onEvent(e: SimEvent) {
    const hv = this.heroView; const S = this.state;
    if (this.tutorial && TUTORIAL_SUCCESS[this.tutorial.ability].includes(e.k)) this.endTutorial(true);
    switch (e.k) {
      case 'jump': sfx.jump(); this.fx.jumpPuff(e.x, e.y); this.emit({ type: 'haptic', kind: 'light' }); break;
      case 'airjump': sfx.doubleJump(); this.fx.jumpPuff(e.x, e.y); break;
      case 'walljump': sfx.jump(); this.fx.jumpPuff(e.x, e.y - 20); this.emit({ type: 'haptic', kind: 'light' }); break;
      case 'cling': sfx.tick(); break;
      case 'land': hv.land(Number(e.n ?? 600)); this.fx.landDust(e.x, e.y, Math.min(1, Number(e.n ?? 600) / 900)); sfx.land(); break;
      case 'slide': sfx.tick(); this.emit({ type: 'haptic', kind: 'light' }); break;
      case 'tramp-strong': sfx.bounce(); this.fx.perfectRing(e.x, e.y, 'Güçlü!'); this.emit({ type: 'haptic', kind: 'medium' }); break;
      case 'tramp-weak': sfx.tick(); break;
      case 'spring': case 'launch': sfx.bounce(); this.fx.jumpPuff(e.x, e.y); this.emit({ type: 'haptic', kind: 'medium' }); break;
      case 'hook': sfx.tick(); this.emit({ type: 'haptic', kind: 'light' }); break;
      case 'unhook': sfx.jump(); break;
      case 'pound': sfx.tick(); break;
      case 'poundland': sfx.hit(); this.cameras.main.shake(120, 0.008); this.fx.landDust(e.x, e.y, 1); hv.land(1400); this.emit({ type: 'haptic', kind: 'medium' }); break;
      case 'dash': sfx.power(); this.emit({ type: 'haptic', kind: 'light' }); break;
      case 'flip': sfx.power(); this.cameras.main.flash(90, 214, 184, 255); break;
      case 'splash': sfx.land(); this.fx.landDust(e.x, e.y, 0.6); break;
      case 'coin': this.collectCoin(e); break;
      case 'collect': S.score += 50; this.fx.comboBurst(e.x, e.y, 16); this.hud.flyNote(e.x, e.y); sfx.combo(10); floatText(this, e.x, e.y - 20, '+5 ♪', COLORS.amber); break;
      case 'note': { const ent = this.world.ents[e.id!]!; sfx.toneAt(tonotopyFreq(1 - Number(ent.p.t ?? 0.5)), 0.25); floatText(this, e.x, e.y - 10, `♪ ${e.n}/${this.spec.objective.target ?? this.world.notesTotal}`, COLORS.accent); S.score += 40; break; }
      case 'noteWrong': sfx.tick(); floatText(this, e.x, e.y - 10, 'sıra değil', COLORS.coral); break;
      case 'cochlea': S.score += 200; sfx.levelUp(); this.afterPraise(() => this.fx.cochleaPickup(e.x, e.y)); this.emit({ type: 'haptic', kind: 'success' }); break;
      case 'power': {
        sfx.power(); this.emit({ type: 'haptic', kind: 'success' }); this.firstTime('guc');
        const k = e.s; floatText(this, this.hero.x, this.hero.y - 70, k === 'shield' ? 'Kalkan!' : k === 'magnet' ? 'Mıknatıs 8s' : k === 'life' ? '+1 can' : 'Hız!', k === 'life' ? COLORS.coral : COLORS.accent); break;
      }
      case 'fork': sfx.toneAt(tonotopyFreq(Number(e.n ?? 0.5)), 0.4); floatText(this, e.x, e.y - 30, 'Frekans ayarlandı', COLORS.accent2); break;
      case 'freqwrong': floatText(this, e.x, e.y - 60, 'Yanlış frekans!', COLORS.coral); break;
      case 'checkpoint': sfx.tick(); this.fx.checkpointLight(e.x, e.y); floatText(this, e.x, e.y - 60, 'Kontrol noktası', COLORS.accent2); this.emit({ type: 'checkpoint', x: e.x }); this.firstTime('kontrol'); break;
      case 'hurt': this.onHurt(e); break;
      case 'respawn': this.cameras.main.flash(200, 255, 255, 255); this.resetTutorTrigger(); break;
      case 'kill': S.score += 50; sfx.bounce(); this.fx.perfectRing(e.x, e.y - 20, null); floatText(this, e.x, e.y - 40, e.s === 'stomp' ? '+50 ezme!' : '+50', COLORS.accent2); this.emit({ type: 'haptic', kind: 'medium' }); this.firstTime('ezme'); this.chainHit(); break;
      case 'shieldbounce': sfx.tick(); floatText(this, e.x, e.y - 50, 'Kalkanlı! Çakıl ya da atıl', COLORS.muted); break;
      case 'break': S.score += 20; sfx.hit(); this.fx.hitFlash(e.x, e.y); this.cameras.main.shake(80, 0.005); break;
      case 'crumble': if (e.s === 'kir') sfx.hit(); else sfx.tick(); break;
      case 'switch': sfx.power(); floatText(this, e.x, e.y - 60, 'Kapı açıldı!', COLORS.accent2); this.emit({ type: 'haptic', kind: 'success' }); break;
      case 'tutor': this.startTutorial(e); break;
      case 'escort': this.hint('Fısıltı seni izliyor. Onu düşmanlardan koru!', 2500); break;
      case 'escortLost': this.hint('Fısıltı yaralandı… hedef kaçtı', 2000); break;
      case 'chase': this.hint('Işık treni geliyor! Durma, atıl!', 2200); this.cameras.main.shake(200, 0.006); break;
      case 'nefes': floatText(this, e.x, e.y - 60, 'Nefes!', COLORS.coral); break;
      case 'bubble': sfx.tick(); break;
      case 'bossWarn': sfx.tick(); break;
      case 'bossSlam': this.cameras.main.shake(160, 0.014); sfx.hit(); break;
      case 'bossHit': sfx.bounce(); flash(this, 0xffe066, 0.3); this.cameras.main.shake(160, 0.012); floatText(this, e.x, e.y - 60, `-${e.n}`, COLORS.coral); this.emit({ type: 'haptic', kind: 'heavy' }); S.score += 100; break;
      case 'bossPhase': this.hint(this.sim.boss?.kind === 'golem' ? (e.n === 2 ? 'Faz 2: Serumen topları! Üstlerinden zıpla' : 'Faz 3: Çift yumruk ve damlalar!') : (e.n === 2 ? 'Faz 2: Yüksek dalgada kay · Bulutlara dikkat' : 'Faz 3: Çift dalga!'), 2600); sfx.toneAt(110, 0.5); break;
      case 'bossScream': this.hint('Bağırıyor! 3 notayı topla', 2000); sfx.toneAt(80, 0.5); this.cameras.main.shake(200, 0.008); break;
      case 'bossNote': sfx.toneAt(440 * Math.pow(2, Number(e.n ?? 1) / 12), 0.18); floatText(this, e.x, e.y - 10, `♪ ${e.n}/3`, COLORS.accent); break;
      case 'bossStun': this.hint('Kalbi açıkta! Atıl ya da üstüne çakıl', 2200); sfx.power(); break;
      case 'bossDown': flash(this, 0xffffff, 0.5); this.cameras.main.shake(420, 0.02); this.emit({ type: 'haptic', kind: 'success' }); this.fx.comboBurst(e.x, e.y, 60);
        if (this.sim.boss?.kind === 'canavar') [392, 392, 440, 392, 330, 294, 262, 294, 330, 262].forEach((f, i) => this.time.delayedCall(120 + i * 180, () => sfx.toneAt(f, 0.22)));
        floatText(this, GAME_W / 2, GROUND_Y - 220, this.sim.boss?.kind === 'canavar' ? 'Ninni beyne ulaştı' : 'Kanal açıldı!', COLORS.accent); break;
      default: break;
    }
  }
  private onHurt(e: SimEvent) {
    if (e.s === 'shield') { sfx.hit(); floatText(this, e.x, e.y - 70, 'Kalkan kırıldı', COLORS.accent); return; }
    if (e.s === 'revir') { sfx.power(); floatText(this, e.x, e.y - 70, '💚 Revir korudu!', COLORS.accent2); return; }
    this.lastHurtAt = this.sim.t;
    sfx.hit(); this.fx.hitFlash(); this.cameras.main.shake(160, 0.01); this.emit({ type: 'haptic', kind: 'heavy' }); this.emit({ type: 'damage', lives: this.sim.lives });
  }
  private collectCoin(e: SimEvent) {
    const S = this.state; S.coins = this.sim.coins; S.score += 10; this.emit({ type: 'haptic', kind: 'light' });
    this.fx.noteSparkle(e.x, e.y); this.hud.flyNote(e.x, e.y);
    if (e.id === this.luckyId && this.luckyState === 'armed') this.collectLucky(e.x, e.y);
    const now = this.sim.t; this.combo = now - this.comboAt < 1.4 ? this.combo + 1 : 1; this.comboAt = now;
    sfx.coin(this.combo); this.maxCombo = Math.max(this.maxCombo, this.combo);
    const mult = Math.min(4, 1 + Math.floor(this.combo / 5)); this.hud.setCombo(this.combo, mult); this.comboShown = this.combo;
    if (this.combo % 5 === 0) {
      const bonus = this.combo * 4; S.score += bonus; floatText(this, e.x, e.y - 16, `Seri x${this.combo}  +${bonus}`, COLORS.amber); sfx.combo(this.combo); this.emit({ type: 'haptic', kind: 'medium' });
      const words = ['Güzel!', 'Harika!', 'Mükemmel!', 'Kulaklara ziyafet!', 'Efsane frekans!'];
      this.fx.comboBurst(e.x, e.y, this.combo); this.praise(words[Math.min(words.length - 1, this.combo / 5 - 1)]!); this.firstTime('seri5');
    }
  }

  // ------------------------------------------------------------------ öğretici an
  private showTutorial(a: AbilityId): boolean {
    if (this.opts.race) return false;
    const key = tutorialKey(a);
    if (this.firstsDone.includes(key)) return false;
    return this.opts.firsts === undefined || this.opts.firsts.includes(key);
  }
  private startTutorial(e: SimEvent) {
    const a = e.s as AbilityId; if (!a || this.tutorial || !this.showTutorial(a)) return;
    this.tutorial = new Tutorial(a, e.id ?? -1, this.hud, this.backdrop); this.tutorialT = 0; this.tutorAbilities.add(a);
  }
  private endTutorial(success: boolean) {
    const t = this.tutorial; if (!t) return; this.tutorial = undefined; t.done();
    if (success) {
      this.praise('Harika!'); sfx.perfect(2);
      const key = tutorialKey(t.ability); if (this.opts.firsts?.includes(key) && !this.firstsDone.includes(key)) this.firstsDone.push(key);
      else if (!this.firstsDone.includes(key)) this.firstsDone.push(key);
    }
  }
  /** düşüp geri dönen oyuncu öğretici anı yeniden yaşar (başaramadıysa) */
  private resetTutorTrigger() {
    if (this.tutorial) { const id = this.tutorial.tutorId; this.endTutorial(false); if (id >= 0) this.sim.collected.delete(id); }
    for (const e of this.world.ents) if (e.type === 'tutor' && this.sim.collected.has(e.id) && !this.firstsDone.includes(tutorialKey(String(e.p.ability) as AbilityId)) && e.l > this.sim.hero.x) this.sim.collected.delete(e.id);
  }

  // ------------------------------------------------------------------ çizim eşitleme
  private syncCamera(dt: number) {
    const cam = this.cameras.main; const h = this.sim.hero;
    if (this.world.boss) { cam.setScroll(0, GROUND_Y - GAME_H + 140); return; }
    const tx = h.x - (h.dir > 0 ? GAME_W * 0.32 : GAME_W * 0.68); const ty = h.y - GAME_H * 0.6 - (h.g < 0 ? -200 : 0);
    const k = 1 - Math.pow(0.0008, Math.min(0.1, dt)); const ky = 1 - Math.pow(0.004, Math.min(0.1, dt));
    this.camX += (tx - this.camX) * k; this.camY += (ty - this.camY) * ky;
    this.camX = Math.max(0, Math.min(Math.max(0, this.world.worldW - GAME_W), this.camX)); this.camY = Math.max(-1200, Math.min(GROUND_Y + 700 - GAME_H, this.camY));
    cam.setScroll(Math.round(this.camX * this.dpr) / this.dpr, Math.round(this.camY * this.dpr) / this.dpr);
  }
  private syncHero() {
    const h = this.sim.hero; const hook = h.hookId >= 0 ? this.world.ents[h.hookId]! : null;
    this.heroView.update({
      x: h.x, y: h.y, vx: h.vx, vy: h.vy, dir: h.dir, g: h.g, t: this.sim.t, grounded: h.grounded, sliding: h.slide > 0, gliding: h.glideT > 0.05, dashing: h.dash > 0, pounding: h.pound,
      hook: hook ? { x: hook.x, y: hook.y } : null, wall: h.wallId >= 0, water: h.water >= 0, invuln: h.invuln > 0.05 && !this.state.finished, hurt: this.sim.t - this.lastHurtAt < 0.35,
      win: this.state.finished && this.sim.finished, shield: this.sim.shield, breath: h.breath, breathMax: BREATH + 2 * (this.opts.skills.breath ?? 0), echo: h.echoUntil > this.sim.t,
    });
    const esc = this.sim.escort; if (esc) { this.escortView ??= createEscortView(this, this.biome); this.escortView.update(esc.x, esc.y, esc.alive); }
  }
  private syncHud() {
    this.hud.update({ notes: this.sim.coins, notesTotal: this.world.coinsTotal, cochleas: this.sim.cochleas, lives: this.sim.lives, pct: this.pct() });
  }
  private syncViews(initial: boolean) {
    const cam = this.cameras.main; const L = cam.scrollX, Rr = cam.scrollX + GAME_W; const s = this.sim; const t = s.t;
    if (initial || this.time.now - this.streamAt > 150) {
      this.streamAt = this.time.now;
      for (const id of near(this.world, L - 300, Rr + STREAM_AHEAD)) {
        const e = this.world.ents[id]!; if (this.views.has(id) || isTerrain(e) || this.gone(e)) continue;
        const v = drawEntity(this, worldEntity(e), this.biome); if (v) this.views.set(id, v);
      }
      for (const e of this.world.ents) if ((e.cls === 'none') && !this.views.has(e.id) && e.x > L - 300 && e.x < Rr + STREAM_AHEAD) { const v = drawEntity(this, worldEntity(e), this.biome); if (v) this.views.set(e.id, v); }
      for (const [id, v] of this.views) { const e = this.world.ents[id]!; if (e.sr < L - STREAM_KEEP || e.sl > Rr + STREAM_KEEP) { v.destroy(); this.views.delete(id); if (id === this.luckyId) this.luckyGlowImg?.setVisible(false); } }
      this.terrain.cull(L, Rr);
    }
    // toplanan / kırılan / ölen: render kendi patlamasını oynatıp yok olur
    for (const [id, v] of this.views) { const e = this.world.ents[id]!; if (this.gone(e)) { if (e.cls === 'pickup') v.collect(); else v.shatter(); this.views.delete(id); if (id === this.luckyId) this.luckyGlowImg?.setVisible(false); } }
    const V: EntityVisual = { x: 0, y: 0, visible: true, alpha: 1, warn: 0, on: false, phase: 0, t, color: s.hero.color, face: -1 };
    const bt = (t + s.beatOff) / this.world.beatDur; const beatPhase = bt - Math.floor(bt);
    const hx = s.hero.x;
    for (const [id, view] of this.views) {
      const e = this.world.ents[id]!;
      V.visible = true; V.alpha = 1; V.warn = 0; V.on = false; V.face = -1; V.x = e.x; V.y = e.y;
      if (RECT_TYPES.has(e.type)) { V.x = e.l; V.y = e.t; }
      switch (e.type) {
        case 'moving': case 'lift': solidAt(this.world, s, e, t); V.x = rectX(); V.y = rectY(); break;
        case 'beat': { const b = beatState(this.world, s, e, t); solidAt(this.world, s, e, t); V.x = rectX(); V.on = b.on; V.warn = b.warn; V.phase = beatPhase; break; }
        case 'crumble': { const trig = s.crumble.get(id); if (trig !== undefined) { const u = t - trig; if (u < 0.4) V.warn = u / 0.4; else if (u < 3.4) V.visible = false; } break; }
        case 'echo': V.on = t < s.hero.echoUntil; break;
        case 'door': V.on = s.opened.has(e.key) !== (e.p.open === true); break;
        case 'switch': V.on = s.opened.has(e.key); break;
        case 'checkpoint': V.on = s.cpX >= e.x - 1; break;
        case 'freqgate': V.on = colorMatch(s.hero.color, Number(e.p.color ?? 0)); break;
        case 'fork': V.on = colorMatch(s.hero.color, Number(e.p.color ?? 0)); break;
        case 'trampoline': V.on = s.hero.tramp > 0 && s.hero.trampId === id; break;
        case 'text': V.on = !!this.tutorial; break;
        case 'hazard': {
          if (e.p.chase && !s.timers.has(id)) { V.visible = false; break; }
          if (hazardAt(this.world, s, e, t)) { V.x = rectX() - 8; V.y = rectY() - 8; } else if (Number(e.p.on ?? 0) > 0) { V.alpha = 0.3; }
          V.warn = hazardWarn(e, t);
          break;
        }
        case 'enemy': { const p = enemyAt(e, t); V.x = p.x; V.y = p.y; V.face = p.face; V.warn = p.warn; break; }
        case 'coin': case 'note': case 'collect':
          if (this.spec.modifiers.includes('cihaz-kapali')) { const d = Math.abs(e.x - hx); V.alpha = d < 90 ? 1 : d < 200 ? 0.35 : 0.04; }
          if (s.magnetUntil > t && Math.abs(e.x - hx) < 140) { V.x += (hx - e.x) * 0.25; V.y += (s.hero.y - 24 - e.y) * 0.25; }
          break;
        default: break;
      }
      view.update(V);
      if (id === this.luckyId && this.luckyGlowImg) this.luckyGlowImg.setPosition(V.x, V.y - 2).setVisible(true);
    }
    // atıcı mermileri
    const list: { x: number; y: number }[] = []; const tmp: { x: number; y: number }[] = [];
    for (const id of near(this.world, L - 200, Rr + 200)) { const e = this.world.ents[id]!; if (e.cls === 'enemy' && enemyKind(e) === 'atici') { projectiles(e, t, s.killed.get(id), tmp); list.push(...tmp); } }
    this.projLayer.update(list);
    if (this.bossView && s.boss) { const b = s.boss; this.bossView.update({ ...b, t, fists: b.fists, warnWall: b.warnWall ? { side: b.warnWall.side, kind: b.warnWall.kind } : null, heroX: s.hero.x }, GROUND_Y); }
  }
  /** varlık artık görünmeyecek mi (toplandı, öldü, kırıldı) */
  private gone(e: WEnt): boolean {
    const s = this.sim;
    if (e.cls === 'pickup' && e.type !== 'fork') return s.collected.has(e.id);
    if (e.cls === 'enemy') return s.killed.has(e.id);
    if (e.type === 'barrier' || (e.type === 'hazard' && e.p.dash)) return s.broken.has(e.id);
    return false;
  }

  // ------------------------------------------------------------------ yardımcılar
  private pct() { return Math.max(0, Math.min(1, this.world.boss ? (this.sim.boss ? 1 - this.sim.boss.hp / this.sim.boss.maxHp : 0) : this.sim.hero.x / this.world.gateX)); }
  private mirrorBotInput(inp: SimInput) {
    this.input_.virtual = { primaryDown: inp.down, dir: inp.dash ? 1 : 0 };
    if (inp.swipeDown) this.input_.swipeDown();
    if (inp.dash) this.input_.swipeRight();
  }
  /** bot/kayıt: oyun hızı çarpanı (simülasyon, zamanlayıcı, tween ve parçacıklar birlikte). Yalnız harness ve Reels stüdyosu kullanır. */
  setTimeScale(ts: number) {
    this.opts = { ...this.opts, timeScale: ts }; this.time.timeScale = ts; this.tweens.timeScale = ts;
    for (const o of this.children.list) if (o instanceof Phaser.GameObjects.Particles.ParticleEmitter) o.timeScale = ts;
  }
  /** kare hızı bekçisi: oyuncu oyununda, başladıktan 1,5 sn sonra 2 sn'lik pencerelerle ölçer; ortalama < 45 fps ise kaliteyi düşürür */
  private watchPerf() {
    if (this.opts.bot || this.sim.t < 1.5 || this.quality === 'low') return;
    // Phaser düşük kare hızında deltayı kırpar: gerçek süre duvar saatinden
    const now = performance.now(); const gap = now - this.perfLast; this.perfLast = now;
    // ilk kare ya da duraklatma/sekme değişimi sonrası (tek karede 250 ms+): pencereyi yeniden başlat
    if (!this.perfMs || gap > 250) { this.perfMs = now; this.perfN = 0; return; }
    this.perfN++; const span = now - this.perfMs;
    if (span < 2000) return;
    const fps = (this.perfN * 1000) / span; this.perfMs = now; this.perfN = 0;
    if (fps < 45) this.setQuality('low');
  }
  /** görsel kaliteyi değiştir (oynanışa etkisi yok): arka plan ışık/sis/parçacıkları ve efekt yoğunluğu */
  setQuality(q: 'high' | 'low') {
    if (q === 'low') setFxQuality(0.45); else setFxQuality(1);
    if (q === this.quality) return; this.quality = q;
    this.backdrop?.setQuality(q);
  }
  private beatSync() {
    const c = beatClock(); if (!c || c.track !== (this.world.boss ? 'boss' : `biyom:${this.spec.biome}`)) return;
    // müzik vuruşu ile sim vuruşu arasındaki faz farkını yavaşça kapat (fark edilmez kayma)
    const bd = this.world.beatDur; const audioPh = ((c.now - c.startAt) / bd) % 1; const simPh = ((this.sim.t + this.sim.beatOff) / bd) % 1;
    let err = (audioPh - simPh) * bd; if (err > bd / 2) err -= bd; if (err < -bd / 2) err += bd;
    this.sim.beatOff += Math.max(-0.004, Math.min(0.004, err));
  }
  private nearMiss() {
    if (this.sim.t - this.lastHurtAt < 0.6) return;
    const h = this.sim.hero; const hl = h.x - HERO_HW, ht = h.y - HERO_H, hb = h.y;
    for (const id of near(this.world, h.x - 80, h.x + 10)) {
      const e = this.world.ents[id]!; if (this.nearMissed.has(id)) continue;
      let r: number, top: number, bot: number;
      if (e.cls === 'hazard') { if (!hazardAt(this.world, this.sim, e, this.sim.t)) continue; const R = solidRect(); r = R.r; top = R.t; bot = R.b; }
      else if (e.cls === 'enemy' && !this.sim.killed.has(id)) { const p = enemyAt(e, this.sim.t); r = p.x + 15; top = p.y - 28; bot = p.y; }
      else continue;
      if (h.dir > 0 && r < hl && r > hl - 24) {
        this.nearMissed.add(id);
        const dy = Math.min(Math.abs(hb - top), Math.abs(bot - ht));
        if (dy < 26) { this.state.score += 25; floatText(this, h.x, h.y - 76, 'Kıl payı! +25', COLORS.coral); sfx.tick(); this.emit({ type: 'haptic', kind: 'light' }); this.firstTime('kilpayi'); this.chainHit(); }
      }
    }
  }
  private firstTime(id: string) {
    if (!this.opts.firsts?.includes(id) || this.firstsDone.includes(id)) return;
    this.firstsDone.push(id); banner(this, `🎉 ${FIRSTS[id] ?? 'İlk kez!'}`, 0x6c4cf1, 1500); sfx.power();
  }
  private chainHit() {
    const now = this.sim.t; this.chain = now - this.chainAt < 4 ? this.chain + 1 : 1; this.chainAt = now;
    if (this.chain >= 2) { sfx.perfect(this.chain); this.praise(this.chain >= 4 ? 'Kulak ustası!' : this.chain === 3 ? 'Mükemmel!' : 'İkiledin!'); }
  }
  /** Şanslı Nota: yolun ortasındaki bir notanın üstüne yerleşir; o notayla birlikte toplanır */
  private armLucky() {
    const lo = this.world.gateX * 0.35, hi = this.world.gateX * 0.8;
    const cands = this.world.ents.filter((e) => e.type === 'coin' && e.x > lo && e.x < hi && e.y > GROUND_Y - 200);
    const c = cands[Math.floor(Math.random() * cands.length)]; if (!c) return;
    this.luckyId = c.id; this.luckyState = 'armed'; this.luckyGlowImg = luckyGlow(this, c.x, c.y).setVisible(false);
  }
  private tickLucky() { const c = this.world.ents[this.luckyId]; if (c && this.sim.hero.x > c.x + 400 && !this.sim.collected.has(c.id)) { this.luckyState = 'missed'; this.luckyGlowImg?.destroy(); } }
  private collectLucky(x: number, y: number) {
    this.luckyState = 'got'; this.luckyGlowImg?.destroy(); this.luckyGlowImg = undefined;
    this.fx.comboBurst(x, y, 18); sfx.levelUp(); flash(this, 0x8ef0b0, 0.25, 260); this.emit({ type: 'haptic', kind: 'success' });
    this.praise('🍀 Şanslı Nota!'); floatText(this, x, y - 30, 'Bonus sonuçta!', '#1b8f52');
  }

  // ------------------------------------------------------------------ sonuç
  private result(completed: boolean): RunResult {
    const s = this.sim; const cochleasTotal = this.world.cochleasTotal;
    const base = {
      levelId: this.spec.id, completed, coins: s.coins, timeSec: Math.round(s.t * 10) / 10, deaths: s.deaths, damageTaken: s.damageTaken,
      objectiveMet: this.objectiveMet(completed), secretFound: cochleasTotal > 0 && s.cochleas >= cochleasTotal,
      extra: { cochleas: s.cochleas, cochleasTotal } as Record<string, number | string | boolean>,
    };
    return { ...base, ...scoreRun(this.spec, base) };
  }
  private objectiveMet(completed: boolean): boolean {
    if (!completed) return false; const o = this.spec.objective; const s = this.sim;
    switch (o.id) {
      case 'reach': return true; case 'collect-all': return s.coins >= (o.target ?? this.world.coinsTotal); case 'timed': return s.t <= (o.target ?? this.spec.parTimeSec);
      case 'escort': return !!s.escort?.alive; case 'boss': return !!s.boss?.defeated; case 'secret': return s.cochleas >= Math.max(1, this.world.cochleasTotal);
      case 'no-damage': return s.damageTaken === 0; case 'melody': return s.notes >= (o.target ?? this.world.notesTotal);
    }
  }
  private withJuice(r: RunResult): RunResult {
    const extra: Record<string, number | string | boolean> = { ...r.extra, maxCombo: this.maxCombo };
    if (this.luckyState === 'got') extra.luckyNote = true;
    if (this.firstsDone.length) extra.firsts = this.firstsDone.join(',');
    return { ...r, extra };
  }
  finish() {
    if (this.state.finished || !this.state.started) return; this.state.finished = true; this.sim.finished = true;
    this.endTutorial(false); this.hud.setCombo(0, 1); this.hud.toast('', 0); this.race?.finished(true);
    const r = this.withJuice(this.result(true));
    sfx.win(); music('zafer', 0.4); flash(this, 0x8ef0b0, 0.35, 400); this.syncHero(); this.emit({ type: 'haptic', kind: 'success' });
    endCard(this, { stars: r.stars, title: r.score.toLocaleString('tr-TR'), sub: r.stars === 3 ? 'Mükemmel!' : r.stars === 2 ? 'Harika!' : 'Kapıdan geçtin!' });
    this.sendResult('levelComplete', r);
  }
  fail(reason: string) {
    if (this.state.finished) return; this.state.finished = true; this.endTutorial(false); this.hud.setCombo(0, 1); this.hud.toast('', 0); this.race?.finished(false);
    this.syncHud(); const r = this.withJuice(this.result(false)); sfx.gameOver(); music(null, 1.2); this.emit({ type: 'haptic', kind: 'error' });
    const pct = this.pct();
    endCard(this, { title: reason === 'fall' ? 'Düştün…' : reason === 'yaris-bitti' ? 'Yarış bitti!' : 'Odi yoruldu…', sub: pct >= 0.5 ? `Kapıya %${Math.max(1, 100 - Math.round(pct * 100))} kaldı` : `Yolun %${Math.round(pct * 100)}'i geride` });
    this.sendResult('levelFailed', { ...r, extra: { ...r.extra, reason, pct: Math.round(pct * 1000) / 1000 } });
  }
  private sendResult(type: 'levelComplete' | 'levelFailed', result: RunResult) {
    if (this.resultSent) return; this.resultSent = true;
    this.time.delayedCall(this.opts.bot ? 100 : 900, () => this.emit({ type, result }));
  }

  private emit(e: GameEvent) { try { void this.opts.onEvent(e); } catch { /* kabuk hatası oyunu durdurmasın */ } }
  /** övgü sözleri ve altın koklea yazısı üst üste binmesin: sırayla (en az 0,8 sn arayla) */
  private praise(text: string) { this.afterPraise(() => this.hud.praise(text)); }
  private afterPraise(f: () => void) {
    const now = this.time.now; const at = Math.max(now, this.praiseFree); this.praiseFree = at + 800;
    if (at <= now) f(); else this.time.delayedCall(at - now, f);
  }
  /** ekranda kısa ipucu; `kind` verilirse göstergenin el işaretiyle (dokun / basılı / aşağı / ileri) */
  hint(text: string, ms = 2500, kind?: HintKind) {
    if (kind) { this.hud.showHint(kind, text); this.hintTimer?.remove(); this.hintTimer = this.time.delayedCall(ms, () => this.hud.hideHint()); return; }
    this.hud.toast(text, ms);
  }
  private buildFog(strength: number) {
    const r0 = this.opts.skills.echoSight ? 160 : 110, r1 = this.opts.skills.echoSight ? 340 : 260;
    const key = `fog-${strength}-${r0}`; const W = GAME_W * 3, H = GAME_H * 3;
    if (!this.textures.exists(key)) {
      const c = this.textures.createCanvas(key, W, H)!; const g = c.context; const grad = g.createRadialGradient(W / 2, H / 2, r0, W / 2, H / 2, r1);
      grad.addColorStop(0, 'rgba(10,12,30,0)'); grad.addColorStop(1, `rgba(10,12,30,${strength})`); g.fillStyle = grad; g.fillRect(0, 0, W, H); c.refresh();
    }
    this.fog = this.add.image(0, 0, key).setScrollFactor(0).setDepth(80);
  }
}

// ------------------------------------------------------------------ küçük yardımcılar
/** durağan zemin (makeTerrain toptan çizer) */
function isTerrain(e: WEnt): boolean { return (e.type === 'platform' && !e.p.boss) || e.type === 'wall'; }
/** WEnt → dünya koordinatlı Entity (görsel seam'e verilen) */
function worldEntity(e: WEnt): Entity { return { type: e.type, x: e.x, y: e.y, w: e.w, h: e.h, props: e.p }; }
// solidAt/hazardAt son sonucu paylaşılan dikdörtgene yazar; okumak için:
const rectX = () => lastRect().l; const rectY = () => lastRect().t;
const solidRect = () => lastRect();
