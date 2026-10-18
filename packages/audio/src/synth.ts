/**
 * Küçük sentez araç seti: osilatör, gürültü, zarf, filtre, kısa yankı (convolver IR üretimi), çan, perde kaydırma.
 * Hem AudioContext hem OfflineAudioContext ile çalışır (BaseAudioContext). Varlık dosyası yok.
 */

/** sentez hedefi: ses düğümleri bu çıkışa bağlanır; verb = yankı gönderme girişi (isteğe bağlı) */
export interface Kit { ctx: BaseAudioContext; out: AudioNode; verb?: AudioNode | null }

export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const semi = (s: number) => Math.pow(2, s / 12);
const EPS = 0.0001;

export interface ToneOpts {
  type?: OscillatorType;
  f: number;
  /** perdenin kayacağı hedef (Hz) */
  f2?: number;
  /** kayma süresi (sn); verilmezse dur */
  glide?: number;
  t: number;
  dur: number;
  vol?: number;
  /** atak, düşüş (sn), sürdürme seviyesi (0-1), bırakma (sn) */
  a?: number; d?: number; s?: number; r?: number;
  detune?: number;
  /** alçak geçiren: başlangıç ve (zarfla) bitiş kesimi */
  lp?: number; lpEnd?: number; lpTime?: number; q?: number;
  hp?: number;
  pan?: number;
  /** yankı gönderme miktarı (0-1) */
  verb?: number;
  vib?: { rate: number; depth: number; delay?: number };
}

/** paylaşılan yönlendirme düğümleri: aynı pan değeri / yankı miktarı için tek düğüm (nota başına düğüm sayısını azaltır) */
type Shared = { pan: Map<number, AudioNode>; vs: Map<number, GainNode> };
const shared = new WeakMap<Kit, Shared>();
function sh(k: Kit): Shared { let x = shared.get(k); if (!x) { x = { pan: new Map(), vs: new Map() }; shared.set(k, x); } return x; }
function panDest(k: Kit, pan: number | undefined): AudioNode {
  const q = Math.round(Math.max(-1, Math.min(1, pan ?? 0)) * 10) / 10;
  if (!q || typeof k.ctx.createStereoPanner !== 'function') return k.out;
  const m = sh(k).pan; let n = m.get(q);
  if (!n) { const p = k.ctx.createStereoPanner(); p.pan.value = q; p.connect(k.out); n = p; m.set(q, n); }
  return n;
}
function verbSend(k: Kit, amt: number): AudioNode | null {
  if (!k.verb || amt <= 0) return null;
  const q = Math.round(amt * 20) / 20; const m = sh(k).vs; let g = m.get(q);
  if (!g) { g = k.ctx.createGain(); g.gain.value = q; g.connect(k.verb); m.set(q, g); }
  return g;
}

/** çıkış: (pan) → out (+ yankı gönderme) */
function route(k: Kit, node: AudioNode, o: { pan?: number; verb?: number }) {
  node.connect(panDest(k, o.pan));
  const v = verbSend(k, o.verb ?? 0); if (v) node.connect(v);
}

/** ADSR zarfı: gain parametresine yazar; bitiş zamanını döndürür */
export function envelope(g: AudioParam, t: number, dur: number, vol: number, a = 0.005, d = 0.08, s = 0.6, r = 0.08): number {
  const peak = Math.max(EPS, vol);
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(peak, t + a);
  const sus = Math.max(EPS, peak * s);
  g.setTargetAtTime(sus, t + a, Math.max(0.001, d / 3));
  const rel = Math.max(t + a, t + dur);
  g.setTargetAtTime(0, rel, Math.max(0.001, r / 4));
  return rel + r + 0.02;
}

/** tek osilatörlü ton (filtre, perde kayması, vibrato, pan, yankı) */
export function tone(k: Kit, o: ToneOpts): number {
  const { ctx } = k;
  const osc = ctx.createOscillator(); osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(Math.max(20, o.f), o.t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), o.t + (o.glide ?? o.dur));
  if (o.detune) osc.detune.value = o.detune;
  let node: AudioNode = osc;
  if (o.lp) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = o.q ?? 0.7;
    f.frequency.setValueAtTime(o.lp, o.t);
    if (o.lpEnd) f.frequency.setTargetAtTime(o.lpEnd, o.t, Math.max(0.005, (o.lpTime ?? o.dur) / 3));
    node.connect(f); node = f;
  }
  if (o.hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; node.connect(f); node = f; }
  const g = ctx.createGain(); node.connect(g);
  const end = envelope(g.gain, o.t, o.dur, o.vol ?? 0.2, o.a, o.d, o.s, o.r);
  if (o.vib) {
    const lfo = ctx.createOscillator(); lfo.frequency.value = o.vib.rate;
    const lg = ctx.createGain(); lg.gain.setValueAtTime(0, o.t); lg.gain.linearRampToValueAtTime(o.vib.depth, o.t + (o.vib.delay ?? 0.08) + 0.05);
    lfo.connect(lg); lg.connect(osc.frequency); lfo.start(o.t); lfo.stop(end);
  }
  route(k, g, o);
  osc.start(o.t); osc.stop(end);
  return end;
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
/** 2 sn beyaz gürültü (bağlam başına bir kez üretilir; sabit tohum → tekrarlanabilir) */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (b) return b;
  const n = Math.floor(ctx.sampleRate * 2);
  b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0); let s = 0x2f6e2b1;
  for (let i = 0; i < n; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; d[i] = ((s >>> 0) / 4294967296) * 2 - 1; }
  noiseCache.set(ctx, b);
  return b;
}

export interface NoiseOpts {
  t: number; dur: number; vol?: number;
  filter?: BiquadFilterType; f?: number; f2?: number; q?: number;
  a?: number; d?: number; s?: number; r?: number;
  pan?: number; verb?: number;
}
/** filtrelenmiş gürültü patlaması (vuruş, tıkırtı, whoosh, zil) */
export function noise(k: Kit, o: NoiseOpts): number {
  const { ctx } = k;
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx); src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = o.filter ?? 'bandpass'; f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.f ?? 2000, o.t);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), o.t + o.dur);
  const g = ctx.createGain();
  src.connect(f); f.connect(g);
  const end = envelope(g.gain, o.t, o.dur, o.vol ?? 0.2, o.a ?? 0.002, o.d ?? o.dur * 0.6, o.s ?? 0.2, o.r ?? 0.05);
  route(k, g, o);
  // farklı vuruşlar aynı gürültü parçasını duymasın: rastgele değil, zamana bağlı ofset (tekrarlanabilir)
  src.start(o.t, (o.t * 7.919) % 1.5); src.stop(end);
  return end;
}

/** çan: uyumsuz kısmi sesler (1, 2.76, 5.4, 8.93), yüksek kısmiler daha hızlı söner */
export function bell(k: Kit, f: number, t: number, dur = 1.2, vol = 0.12, o: { pan?: number; verb?: number; bright?: number } = {}): number {
  const parts: [number, number, number][] = [[1, 1, 1], [2.76, 0.42 * (o.bright ?? 1), 0.55], [5.4, 0.2 * (o.bright ?? 1), 0.32], [8.93, 0.08 * (o.bright ?? 1), 0.2]];
  let end = t;
  for (const [m, a, dk] of parts) {
    if (f * m > 16000) continue;
    end = Math.max(end, tone(k, { f: f * m, t, dur: 0.001, vol: vol * a, a: 0.002, d: dur * dk, s: 0, r: dur * dk, pan: o.pan, verb: o.verb }));
  }
  return end;
}

/** yumuşak tel (pluck): üçgen + oktav sinüs, parlaktan koyuya süzülen filtre */
export function pluck(k: Kit, f: number, t: number, dur: number, vol = 0.18, o: { pan?: number; verb?: number; bright?: number; decay?: number } = {}): number {
  const br = o.bright ?? 1; const dec = o.decay ?? 0.35;
  const e1 = tone(k, { type: 'triangle', f, t, dur, vol, a: 0.003, d: dec, s: 0.15, r: 0.12, lp: Math.min(12000, f * 7 * br), lpEnd: f * 2.2, lpTime: dec, pan: o.pan, verb: o.verb });
  tone(k, { type: 'sine', f: f * 2, t, dur: dur * 0.5, vol: vol * 0.28, a: 0.002, d: dec * 0.5, s: 0.05, r: 0.08, pan: o.pan, verb: o.verb });
  return e1;
}

/** pad: hafif ayrık testere + üçgen → tek filtre → tek zarf (yavaş atak, yumuşak) */
export function pad(k: Kit, f: number, t: number, dur: number, vol = 0.05, o: { pan?: number; verb?: number; lp?: number; a?: number } = {}): number {
  const { ctx } = k; const a = o.a ?? 0.35;
  const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = o.lp ?? 1200; flt.Q.value = 0.4;
  const g = ctx.createGain(); flt.connect(g);
  const end = envelope(g.gain, t, dur, vol, a, 0.4, 0.85, Math.min(1.2, a * 2 + 0.3));
  for (const [type, det, v] of [['sawtooth', 7, 0.55], ['triangle', -4, 0.9]] as const) {
    const osc = ctx.createOscillator(); osc.type = type; osc.frequency.value = f; osc.detune.value = det;
    const og = ctx.createGain(); og.gain.value = v; osc.connect(og); og.connect(flt); osc.start(t); osc.stop(end);
  }
  route(k, g, o);
  return end;
}

/** kick: hızla düşen sinüs + tık */
export function kick(k: Kit, t: number, vol = 0.5, o: { f?: number; f2?: number; dur?: number } = {}): number {
  const end = tone(k, { type: 'sine', f: o.f ?? 140, f2: o.f2 ?? 44, glide: 0.09, t, dur: 0.02, vol, a: 0.002, d: o.dur ?? 0.24, s: 0, r: o.dur ?? 0.24 });
  noise(k, { t, dur: 0.012, vol: vol * 0.25, filter: 'highpass', f: 2500, a: 0.001, d: 0.008, s: 0, r: 0.01 });
  return end;
}
export function snare(k: Kit, t: number, vol = 0.22, o: { pan?: number; verb?: number; tone?: number } = {}): number {
  tone(k, { type: 'triangle', f: o.tone ?? 190, f2: (o.tone ?? 190) * 0.75, t, dur: 0.01, vol: vol * 0.7, a: 0.001, d: 0.08, s: 0, r: 0.08, pan: o.pan });
  return noise(k, { t, dur: 0.02, vol, filter: 'bandpass', f: 2200, q: 0.7, a: 0.001, d: 0.14, s: 0, r: 0.12, pan: o.pan, verb: o.verb });
}
export function clap(k: Kit, t: number, vol = 0.16, o: { pan?: number; verb?: number } = {}): number {
  for (const dt of [0, 0.011, 0.023]) noise(k, { t: t + dt, dur: 0.006, vol: vol * 0.6, filter: 'bandpass', f: 1500, q: 1.2, a: 0.001, d: 0.01, s: 0, r: 0.01, pan: o.pan });
  return noise(k, { t: t + 0.03, dur: 0.02, vol, filter: 'bandpass', f: 1300, q: 1, a: 0.001, d: 0.12, s: 0, r: 0.1, pan: o.pan, verb: o.verb ?? 0.2 });
}
export function hat(k: Kit, t: number, vol = 0.06, o: { open?: boolean; pan?: number } = {}): number {
  return noise(k, { t, dur: o.open ? 0.12 : 0.02, vol, filter: 'highpass', f: 7500, q: 0.5, a: 0.001, d: o.open ? 0.18 : 0.035, s: 0, r: o.open ? 0.15 : 0.03, pan: o.pan });
}
export function shaker(k: Kit, t: number, vol = 0.04, o: { pan?: number } = {}): number {
  return noise(k, { t, dur: 0.03, vol, filter: 'bandpass', f: 6500, q: 1.5, a: 0.012, d: 0.04, s: 0, r: 0.03, pan: o.pan });
}
export function tom(k: Kit, f: number, t: number, vol = 0.3, o: { pan?: number; verb?: number } = {}): number {
  return tone(k, { type: 'sine', f: f * 1.5, f2: f, glide: 0.08, t, dur: 0.01, vol, a: 0.002, d: 0.3, s: 0, r: 0.3, pan: o.pan, verb: o.verb });
}
export function wood(k: Kit, f: number, t: number, vol = 0.12, o: { pan?: number } = {}): number {
  tone(k, { type: 'sine', f, t, dur: 0.005, vol, a: 0.001, d: 0.05, s: 0, r: 0.05, pan: o.pan });
  return noise(k, { t, dur: 0.004, vol: vol * 0.5, filter: 'bandpass', f: f * 1.7, q: 4, a: 0.001, d: 0.02, s: 0, r: 0.02, pan: o.pan });
}
/** su damlası: kısa sinüs, perde hızla yukarı kayar ("bloop") */
export function drop(k: Kit, f: number, t: number, vol = 0.14, o: { pan?: number; verb?: number } = {}): number {
  return tone(k, { type: 'sine', f: f * 0.62, f2: f * 1.35, glide: 0.05, t, dur: 0.02, vol, a: 0.002, d: 0.12, s: 0, r: 0.12, pan: o.pan, verb: o.verb ?? 0.35 });
}
/** marimba: sinüs + 4× kısmi (çok kısa) */
export function marimba(k: Kit, f: number, t: number, vol = 0.16, o: { pan?: number; verb?: number } = {}): number {
  tone(k, { type: 'sine', f: f * 4, t, dur: 0.003, vol: vol * 0.35, a: 0.001, d: 0.03, s: 0, r: 0.03, pan: o.pan });
  return tone(k, { type: 'sine', f, t, dur: 0.01, vol, a: 0.002, d: 0.32, s: 0, r: 0.3, pan: o.pan, verb: o.verb });
}
/** pirinç benzeri: testere, filtre zarfı açılıp kapanır */
export function brass(k: Kit, f: number, t: number, dur: number, vol = 0.12, o: { pan?: number; verb?: number } = {}): number {
  tone(k, { type: 'sawtooth', f, t, dur, vol, a: 0.03, d: 0.2, s: 0.7, r: 0.15, lp: 700, lpEnd: Math.min(5000, f * 5), lpTime: 0.12, q: 1.1, pan: o.pan, verb: o.verb, vib: { rate: 5.5, depth: f * 0.006, delay: 0.25 } });
  return tone(k, { type: 'sawtooth', f, t, dur, vol: vol * 0.6, detune: 9, a: 0.04, d: 0.2, s: 0.7, r: 0.15, lp: 900, lpEnd: Math.min(4000, f * 4), lpTime: 0.12, pan: (o.pan ?? 0) * -1, verb: o.verb });
}
/** zil: uzun yüksek geçiren gürültü */
export function cymbal(k: Kit, t: number, vol = 0.08, dur = 1.4, o: { verb?: number } = {}): number {
  return noise(k, { t, dur: 0.01, vol, filter: 'highpass', f: 5200, q: 0.4, a: 0.002, d: dur, s: 0, r: dur, verb: o.verb ?? 0.3 });
}
/** yükselen gerilim/whoosh: bant geçiren gürültü süpürmesi */
export function riser(k: Kit, t: number, dur: number, vol = 0.1, o: { f?: number; f2?: number; q?: number; pan?: number; verb?: number } = {}): number {
  return noise(k, { t, dur, vol, filter: 'bandpass', f: o.f ?? 300, f2: o.f2 ?? 4000, q: o.q ?? 1.4, a: dur * 0.7, d: 0.1, s: 1, r: Math.min(0.25, dur * 0.4), pan: o.pan, verb: o.verb });
}

/** kısa oda yankısı için dürtü yanıtı: stereo, üstel sönen, yumuşak gürültü (sabit tohum) */
export function makeImpulse(ctx: BaseAudioContext, seconds = 1.8, decay = 3.2): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c); let s = 0x1234567 + c * 977; let lp = 0;
    for (let i = 0; i < n; i++) {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      const w = ((s >>> 0) / 4294967296) * 2 - 1;
      lp += (w - lp) * (0.35 + 0.6 * (1 - i / n)); // zamanla koyulaşan kuyruk
      const pre = i < ctx.sampleRate * 0.012 ? i / (ctx.sampleRate * 0.012) : 1; // kısa ön gecikme yumuşatması
      d[i] = lp * Math.pow(1 - i / n, decay) * pre;
    }
  }
  return b;
}
