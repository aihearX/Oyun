/**
 * Web Audio ile sentezlenmiş oyun sesleri (WebView içinde). Varlık dosyası yok.
 * iOS'ta ses ancak bir dokunuştan sonra başlar: unlock() ilk pointerdown'da çağrılır.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

export function setSoundsEnabled(v: boolean) { enabled = v; if (master) master.gain.value = v ? 0.5 : 0; }

export function unlock() {
  try {
    if (!ctx) {
      const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = enabled ? 0.5 : 0; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { /* ses yoksa oyun yine çalışır */ }
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.25, slideTo?: number) {
  if (!ctx || !master || !enabled) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.2, cutoff = 1200) {
  if (!ctx || !master || !enabled) return;
  const t = ctx.currentTime; const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}

export const sfx = {
  jump: () => tone(300, 0.15, 'square', 0.18, 700),
  doubleJump: () => tone(500, 0.12, 'square', 0.16, 1000),
  coin: () => { tone(1047, 0.06, 'square', 0.14); setTimeout(() => tone(1319, 0.12, 'square', 0.14), 50); },
  hit: () => { noise(0.18, 0.3, 700); tone(160, 0.25, 'sawtooth', 0.2, 60); },
  power: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.1, 'triangle', 0.18), i * 60)); },
  levelUp: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'square', 0.16), i * 80)); },
  gameOver: () => { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.2), i * 160)); },
  bounce: () => tone(220, 0.1, 'sine', 0.2, 440),
  tick: () => tone(1500, 0.03, 'square', 0.08),
  /** Tonotopi: koklea derinliğine göre nota (taban ince, apeks kalın) */
  toneAt: (freq: number, dur = 0.1) => tone(freq, dur, 'sine', 0.12),
};
