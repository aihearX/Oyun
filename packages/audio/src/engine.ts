/**
 * Ses motoru: master zinciri (kompresör), efekt ve müzik veriyolları, yankı, ses sınırlayıcı, sıralayıcı, crossfade, duck.
 * Tarayıcıda gerçek AudioContext; testte/ölçümde OfflineAudioContext ile aynı kod çalışır.
 */
import type { AudioEngine, PlayOpts, Sfx, Track } from './index';
import { VoiceLimiter } from './limiter';
import { alignStart, Sequencer } from './sequencer';
import { barEvents, resolveTrack, type NoteEv, type TrackDef } from './music';
import { AUTO_DUCK, SFX, sfxRule } from './sfx';
import { bell, brass, clap, cymbal, drop, hat, kick, makeImpulse, marimba, mtof, pad, pluck, riser, shaker, snare, tom, tone, wood, type Kit } from './synth';

/** müzik enstrümanları (parça olaylarını sese çevirir) */
export function playNote(k: Kit, e: NoteEv, t: number, beat: number): void {
  const f = mtof(e.m); const d = Math.max(0.05, e.dur * beat); const v = e.v; const pan = e.pan;
  switch (e.inst) {
    case 'pluck': pluck(k, f, t, d, 0.16 * v, { pan, verb: 0.25 }); break;
    case 'bell': bell(k, f, t, Math.max(0.9, d * 1.5), 0.075 * v, { pan, verb: 0.4 }); break;
    case 'celesta': bell(k, f, t, 1, 0.05 * v, { pan, verb: 0.45, bright: 0.45 }); break;
    case 'pad': pad(k, f, t, d, 0.03 * v, { pan, verb: 0.35, lp: e.lp }); break;
    case 'bass': tone(k, { type: 'triangle', f, t, dur: d * 0.85, vol: 0.22 * v, a: 0.006, d: 0.15, s: 0.6, r: 0.07, lp: 900 }); tone(k, { type: 'sine', f, t, dur: d * 0.85, vol: 0.14 * v, a: 0.006, d: 0.2, s: 0.7, r: 0.07 }); break;
    case 'sub': tone(k, { type: 'sine', f, t, dur: d, vol: 0.26 * v, a: 0.03, d: 0.3, s: 0.8, r: 0.2 }); break;
    case 'saw': tone(k, { type: 'sawtooth', f, t, dur: d * 0.8, vol: 0.1 * v, a: 0.004, d: 0.12, s: 0.4, r: 0.05, lp: 2200, lpEnd: 500, lpTime: 0.15, q: 2 }); tone(k, { type: 'sine', f, t, dur: d * 0.8, vol: 0.12 * v, a: 0.004, d: 0.15, s: 0.6, r: 0.05 }); break;
    case 'kick': kick(k, t, 0.42 * v); break;
    case 'heart': kick(k, t, 0.38 * v, { f: 95, f2: 38, dur: 0.3 }); break;
    case 'snare': snare(k, t, 0.15 * v, { verb: 0.2 }); break;
    case 'clap': clap(k, t, 0.12 * v, { pan }); break;
    case 'hat': hat(k, t, 0.045 * v, { pan }); break;
    case 'ohat': hat(k, t, 0.04 * v, { open: true, pan }); break;
    case 'shaker': shaker(k, t, 0.035 * v, { pan }); break;
    case 'tom': tom(k, f, t, 0.24 * v, { pan, verb: 0.2 }); break;
    case 'wood': wood(k, f, t, 0.07 * v, { pan }); break;
    case 'drop': drop(k, f, t, 0.12 * v, { pan, verb: 0.45 }); break;
    case 'pulse': tone(k, { type: 'square', f, t, dur: d * 0.6, vol: 0.05 * v, a: 0.003, d: 0.08, s: 0.3, r: 0.04, lp: e.lp ?? 1600, q: 3, pan, verb: 0.2 }); break;
    case 'marimba': marimba(k, f, t, 0.12 * v, { pan, verb: 0.2 }); break;
    case 'lead': tone(k, { type: 'triangle', f, t, dur: d, vol: 0.09 * v, a: 0.05, d: 0.2, s: 0.7, r: 0.2, pan, verb: 0.4, vib: { rate: 5, depth: f * 0.008, delay: 0.25 } }); tone(k, { type: 'sine', f: f * 2, t, dur: d, vol: 0.025 * v, a: 0.06, d: 0.2, s: 0.6, r: 0.2, pan }); break;
    case 'brass': brass(k, f, t, d, 0.07 * v, { pan, verb: 0.3 }); break;
    case 'stab': tone(k, { type: 'sawtooth', f, t, dur: Math.min(d, 0.12), vol: 0.05 * v, a: 0.003, d: 0.1, s: 0.2, r: 0.06, lp: 2400, lpEnd: 600, lpTime: 0.1, pan }); break;
    case 'cym': cymbal(k, t, 0.06 * v, Math.max(1, d)); break;
    case 'riser': riser(k, t, d, 0.06 * v, { verb: 0.4 }); break;
    case 'boing': tone(k, { type: 'sine', f: f * 1.7, f2: f, glide: 0.1, t, dur: 0.02, vol: 0.22 * v, a: 0.002, d: 0.22, s: 0, r: 0.2, pan, vib: { rate: 18, depth: f * 0.03, delay: 0.05 } }); break;
  }
}

interface Live {
  name: string; def: TrackDef; gain: GainNode; seq: Sequencer; kit: Kit;
  /** solup kapanacağı an (yoksa sürüyor) */
  stopAt?: number;
}

export interface EngineOptions {
  /** bağlam üreticisi (verilmezse tarayıcının AudioContext'i); OfflineAudioContext verilirse kilitsiz sayılır */
  context?: () => BaseAudioContext | null;
  /** planlama aralığı (ms); 0 = zamanlayıcı yok (çevrimdışı işleme elle tick eder) */
  intervalMs?: number;
  /** hoparlöre giden son seviye */
  masterGain?: number;
}

export class Engine implements AudioEngine {
  ctx: BaseAudioContext | null = null;
  private master!: GainNode; private comp!: DynamicsCompressorNode; private sfxBus!: GainNode; private musicBus!: GainNode; private duckGain!: GainNode; private verbIn!: GainNode;
  private vol = { music: 0.6, sfx: 0.9, enabled: true };
  private unlocked = false;
  private wanted: Track | null = null;
  private live: Live[] = [];
  private current: Live | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  readonly limiter = new VoiceLimiter(16, sfxRule);
  constructor(private o: EngineOptions = {}) {}

  /** bağlamı ve zinciri kur (ilk dokunuşta ya da çevrimdışı işleme başında) */
  private ensure(): BaseAudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const make = this.o.context ?? (() => {
        const w = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
        const AC = w.AudioContext ?? w.webkitAudioContext; return AC ? new AC({ latencyHint: 'interactive' }) : null;
      });
      const c = make(); if (!c) return null;
      this.ctx = c;
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.knee.value = 8; this.comp.ratio.value = 6; this.comp.attack.value = 0.003; this.comp.release.value = 0.18;
      this.master = c.createGain(); this.master.gain.value = this.vol.enabled ? (this.o.masterGain ?? 0.9) : 0;
      this.comp.connect(this.master); this.master.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.vol.sfx; this.sfxBus.connect(this.comp);
      this.duckGain = c.createGain(); this.duckGain.connect(this.comp);
      this.musicBus = c.createGain(); this.musicBus.gain.value = this.vol.music; this.musicBus.connect(this.duckGain);
      const conv = c.createConvolver(); conv.buffer = makeImpulse(c, 1.8, 3.4);
      this.verbIn = c.createGain(); this.verbIn.gain.value = 0.35; this.verbIn.connect(conv); conv.connect(this.comp);
      if (!this.o.context) {
        this.unlocked = false;
        // görünmezken (arka plan) bağlamı askıya al: pil ve CPU dostu
        try { document.addEventListener('visibilitychange', () => { const ac = this.ctx as AudioContext | null; if (!ac || !this.unlocked) return; if (document.hidden) void ac.suspend(); else void ac.resume(); }); } catch { /* DOM yok */ }
      } else this.unlocked = true;
      return c;
    } catch { this.ctx = null; return null; }
  }

  private now(): number { return this.ctx?.currentTime ?? 0; }
  private kit(out: AudioNode, verb: AudioNode | null = this.verbIn): Kit { return { ctx: this.ctx!, out, verb }; }

  unlock(): void {
    const c = this.ensure(); if (!c) return;
    const ac = c as AudioContext;
    if (!this.o.context && typeof ac.resume === 'function' && ac.state === 'suspended') void ac.resume().catch(() => undefined);
    if (!this.unlocked) {
      this.unlocked = true;
      // iOS: sessiz kısa bir tampon çalmak hoparlör yolunu açar
      try { const b = c.createBuffer(1, 1, c.sampleRate); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch { /* yok */ }
      if (this.wanted) { const w = this.wanted; this.wanted = null; this.music(w, { fade: 0.8 }); }
    }
  }

  play(name: Sfx, opts: PlayOpts = {}): void {
    if (!this.vol.enabled || !this.unlocked) return;
    const c = this.ensure(); if (!c) return;
    const design = SFX[name]; if (!design) return;
    const t = this.now() + 0.005 + Math.max(0, opts.delay ?? 0);
    const gain = this.limiter.request(name, t, name === 'coinBurst' ? 0.7 : 0.15);
    if (gain <= 0) return;
    const out = c.createGain(); out.gain.value = Math.max(0, Math.min(1.5, (opts.vol ?? 1) * gain)); out.connect(this.sfxBus);
    const end = design(this.kit(out), t, Math.pow(2, (opts.semitones ?? 0) / 12), 1);
    const dk = AUTO_DUCK[name]; if (dk) this.duck(dk, 0.35, t);
    this.cleanup(out, end);
  }

  tone(freq: number, dur = 0.1, vol = 0.12): void {
    if (!this.vol.enabled || !this.unlocked) return;
    const c = this.ensure(); if (!c) return;
    const t = this.now() + 0.005;
    const g = this.limiter.request('tone', t, dur); if (g <= 0) return;
    const out = c.createGain(); out.gain.value = g; out.connect(this.sfxBus);
    const k = this.kit(out);
    tone(k, { type: 'sine', f: freq, t, dur, vol: vol * 1.1, a: 0.006, d: dur * 0.6, s: 0.5, r: Math.min(0.25, dur), verb: 0.25 });
    const end = tone(k, { type: 'triangle', f: freq * 2, t, dur: dur * 0.6, vol: vol * 0.18, a: 0.004, d: dur * 0.4, s: 0.2, r: 0.08 });
    this.cleanup(out, end);
  }

  private cleanup(node: AudioNode, end: number) {
    if (this.o.context) return; // çevrimdışı: bağlam zaten kapanır
    const ms = Math.max(50, (end - this.now()) * 1000 + 400);
    setTimeout(() => { try { node.disconnect(); } catch { /* yok */ } }, ms);
  }

  /** şu an çalan parça (bitmiş tek seferlik parça sayılmaz) */
  playing(): string | null {
    const c = this.current; if (!c || c.stopAt != null) return null;
    if (c.def.oneShot && this.now() >= c.seq.endTime) return null;
    return c.name;
  }

  music(track: Track | null, opts: { fade?: number } = {}): void {
    if (!this.unlocked) { this.wanted = track; return; }
    const c = this.ensure(); if (!c) return;
    const fade = Math.max(0.05, opts.fade ?? 1.2);
    if (track && this.playing() === track) return;
    const now = this.now();
    const prev = this.current;
    if (prev && prev.stopAt == null) this.fadeOut(prev, fade);
    this.current = null;
    if (!track) return;
    const def = resolveTrack(track); if (!def) return;
    const gain = c.createGain(); gain.gain.value = 0;
    let out: AudioNode = gain;
    if (def.busLp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = def.busLp; f.Q.value = 0.5; gain.connect(f); out = f; }
    out.connect(this.musicBus);
    const send = c.createGain(); send.gain.value = def.verb; send.connect(this.verbIn);
    const kit = this.kit(gain, send);
    const prevSeq = prev && prev.stopAt != null && !prev.def.oneShot && Math.abs(prev.def.bpm - def.bpm) < 0.5 ? { startAt: prev.seq.barTime(0), beatDur: prev.seq.beatDur } : null;
    const startAt = alignStart(now, prevSeq, prev ? 0.08 : 0.05);
    const seq = new Sequencer({ bpm: def.bpm, startAt, lookahead: 0.35, maxBars: def.oneShot ? def.bars : undefined,
      onBar: (bar, time) => { if (!this.vol.enabled) return; const beat = 60 / def.bpm; for (const e of barEvents(def, bar)) playNote(kit, e, time + e.at * beat, beat); } });
    const lv: Live = { name: track, def, gain, seq, kit };
    const fadeIn = prev ? fade : Math.min(fade, 0.6);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(def.gain, now + fadeIn);
    this.live.push(lv); this.current = lv;
    this.tick();
    this.startTimer();
  }

  private fadeOut(lv: Live, fade: number) {
    const now = this.now();
    lv.gain.gain.cancelScheduledValues(now); lv.gain.gain.setValueAtTime(lv.gain.gain.value, now); lv.gain.gain.linearRampToValueAtTime(0, now + fade);
    lv.stopAt = now + fade;
  }

  /** planlama adımı: canlı parçaların ölçülerini ileriden planla, sönenleri kaldır */
  tick(until?: number): void {
    if (!this.ctx) return;
    const real = this.now();
    for (const lv of this.live) if (lv.stopAt == null || real < lv.stopAt) lv.seq.tick(real, until);
    this.live = this.live.filter((lv) => {
      const gone = (lv.stopAt != null && real > lv.stopAt + 0.1) || (lv.def.oneShot && lv.seq.done && real > lv.seq.endTime + 3);
      if (gone) { setTimeout(() => { try { lv.gain.disconnect(); } catch { /* yok */ } }, this.o.context ? 0 : 3000); if (this.current === lv) this.current = null; }
      return !gone;
    });
    if (!this.live.length) this.stopTimer();
  }
  private startTimer() {
    if (this.timer || this.o.intervalMs === 0) return;
    this.timer = setInterval(() => this.tick(), this.o.intervalMs ?? 60);
  }
  private stopTimer() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  duck(seconds: number, level = 0.3, at?: number): void {
    if (!this.ctx) return;
    const g = this.duckGain.gain; const t = at ?? this.now();
    g.cancelScheduledValues(t); g.setTargetAtTime(Math.max(0, Math.min(1, level)), t, 0.04);
    if (seconds > 0) g.setTargetAtTime(1, t + seconds, 0.35); else g.setTargetAtTime(1, t, 0.1);
  }

  setVolumes(v: { music?: number; sfx?: number; enabled?: boolean }): void {
    const clamp = (x: number) => Math.max(0, Math.min(1, x));
    if (v.music != null) this.vol.music = clamp(v.music);
    if (v.sfx != null) this.vol.sfx = clamp(v.sfx);
    if (v.enabled != null) this.vol.enabled = v.enabled;
    if (!this.ctx) return;
    const t = this.now();
    this.musicBus.gain.setTargetAtTime(this.vol.music, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.master.gain.setTargetAtTime(this.vol.enabled ? (this.o.masterGain ?? 0.9) : 0, t, 0.05);
  }
  volumes() { return { ...this.vol }; }
}
