/**
 * SFX kütüphanesi: Sfx türündeki HER ses için katmanlı sentez tasarımı.
 * Her tasarım (kit, başlangıç zamanı, perde çarpanı, ses düzeyi) alır ve bitiş zamanını döndürür.
 * Perde çarpanı `semitones` seçeneğinden gelir (seri/çoklu ödülde artan perde).
 */
import type { Sfx } from './index';
import { bell, brass, clap, cymbal, kick, marimba, mtof, noise, pad, pluck, riser, snare, tom, tone, wood, type Kit } from './synth';

export type SfxDesign = (k: Kit, t: number, p: number, v: number) => number;

const C6 = mtof(84), E6 = mtof(88), G6 = mtof(91), C7 = mtof(96), E7 = mtof(100), G7 = mtof(103);
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

/** parlak iki notalı jeton + çan kuyruğu */
function coinAt(k: Kit, t: number, p: number, v: number, pan = 0): number {
  tone(k, { type: 'square', f: 987.8 * p, t, dur: 0.045, vol: 0.07 * v, a: 0.001, d: 0.04, s: 0.4, r: 0.03, lp: 5200, pan });
  tone(k, { type: 'square', f: 1318.5 * p, t: t + 0.055, dur: 0.1, vol: 0.075 * v, a: 0.001, d: 0.08, s: 0.3, r: 0.08, lp: 6000, pan });
  tone(k, { type: 'sine', f: 1318.5 * p, t: t + 0.055, dur: 0.12, vol: 0.09 * v, a: 0.001, d: 0.1, s: 0.3, r: 0.1, pan });
  return bell(k, 2637 * p, t + 0.06, 0.45, 0.035 * v, { pan, verb: 0.25, bright: 0.6 });
}
function whoosh(k: Kit, t: number, dur: number, v: number, up = true): number {
  return noise(k, { t, dur, vol: 0.16 * v, filter: 'bandpass', f: up ? 500 : 3500, f2: up ? 3800 : 500, q: 1.3, a: dur * 0.55, d: 0.08, s: 1, r: dur * 0.45 });
}
function sparkle(k: Kit, t: number, n: number, v: number, base = 2600, spread = 0.03): number {
  let end = t;
  for (let i = 0; i < n; i++) {
    const f = base * Math.pow(2, ((i * 7) % 12) / 12 + (i % 3) * 0.5);
    end = Math.max(end, tone(k, { type: 'sine', f, t: t + i * spread, dur: 0.01, vol: 0.03 * v, a: 0.001, d: 0.12, s: 0, r: 0.12, pan: ((i * 37) % 11) / 5.5 - 1, verb: 0.4 }));
  }
  return end;
}
function chord(k: Kit, ms: number[], t: number, dur: number, v: number, inst: 'brass' | 'pad' | 'pluck' = 'brass'): number {
  let end = t;
  for (const m of ms) {
    const f = mtof(m);
    end = Math.max(end, inst === 'brass' ? brass(k, f, t, dur, 0.06 * v, { verb: 0.3 }) : inst === 'pad' ? pad(k, f, t, dur, 0.05 * v, { verb: 0.4, a: 0.5 }) : pluck(k, f, t, dur, 0.1 * v, { verb: 0.2 }));
  }
  return end;
}
const sub = (k: Kit, t: number, v: number, f = 70, dur = 0.5) => tone(k, { type: 'sine', f: f * 1.6, f2: f * 0.7, glide: 0.25, t, dur: 0.01, vol: 0.45 * v, a: 0.003, d: dur, s: 0, r: dur });

export const SFX: Record<Sfx, SfxDesign> = {
  // ------------------------------------------------ arayüz
  tap: (k, t, p, v) => {
    tone(k, { type: 'sine', f: 1500 * p, f2: 900 * p, glide: 0.03, t, dur: 0.012, vol: 0.13 * v, a: 0.001, d: 0.03, s: 0, r: 0.03 });
    return noise(k, { t, dur: 0.004, vol: 0.03 * v, filter: 'highpass', f: 4000, a: 0.001, d: 0.008, s: 0, r: 0.01 });
  },
  back: (k, t, p, v) => {
    tone(k, { type: 'sine', f: 1000 * p, f2: 620 * p, glide: 0.05, t, dur: 0.02, vol: 0.12 * v, a: 0.001, d: 0.05, s: 0, r: 0.05 });
    return wood(k, 500 * p, t + 0.035, 0.05 * v);
  },
  tab: (k, t, p, v) => {
    tone(k, { type: 'triangle', f: 660 * p, t, dur: 0.02, vol: 0.12 * v, a: 0.002, d: 0.05, s: 0, r: 0.05 });
    return tone(k, { type: 'triangle', f: 990 * p, t: t + 0.04, dur: 0.03, vol: 0.12 * v, a: 0.002, d: 0.08, s: 0, r: 0.08, verb: 0.15 });
  },
  toggle: (k, t, p, v) => {
    wood(k, 1400 * p, t, 0.08 * v);
    return tone(k, { type: 'square', f: 700 * p, f2: 1100 * p, glide: 0.04, t: t + 0.01, dur: 0.03, vol: 0.05 * v, a: 0.001, d: 0.04, s: 0, r: 0.04, lp: 3000 });
  },
  whoosh: (k, t, _p, v) => whoosh(k, t, 0.35, v),
  pop: (k, t, p, v) => tone(k, { type: 'sine', f: 280 * p, f2: 950 * p, glide: 0.04, t, dur: 0.02, vol: 0.2 * v, a: 0.001, d: 0.06, s: 0, r: 0.06 }),
  error: (k, t, p, v) => {
    tone(k, { type: 'triangle', f: 330 * p, t, dur: 0.08, vol: 0.13 * v, a: 0.005, d: 0.08, s: 0.5, r: 0.06, lp: 1500 });
    return tone(k, { type: 'triangle', f: 262 * p, t: t + 0.11, dur: 0.12, vol: 0.13 * v, a: 0.005, d: 0.1, s: 0.5, r: 0.1, lp: 1500 });
  },
  notify: (k, t, p, v) => { bell(k, 1318.5 * p, t, 0.7, 0.06 * v, { verb: 0.3 }); return bell(k, 1760 * p, t + 0.1, 0.9, 0.06 * v, { verb: 0.3 }); },

  // ------------------------------------------------ ödül anları
  coin: (k, t, p, v) => coinAt(k, t, p, v),
  coinBurst: (k, t, p, v) => {
    let end = t;
    for (let i = 0; i < 10; i++) end = Math.max(end, coinAt(k, t + i * 0.055 + (i % 3) * 0.006, p * Math.pow(2, PENTA[i % PENTA.length]! / 12 / 2), v * (0.65 + i * 0.03), ((i % 5) - 2) * 0.3));
    return Math.max(end, sparkle(k, t + 0.5, 6, v, 3000));
  },
  countTick: (k, t, p, v) => {
    tone(k, { type: 'sine', f: 1800 * p, t, dur: 0.008, vol: 0.08 * v, a: 0.001, d: 0.025, s: 0, r: 0.025 });
    return tone(k, { type: 'triangle', f: 3600 * p, t, dur: 0.004, vol: 0.025 * v, a: 0.001, d: 0.012, s: 0, r: 0.012 });
  },
  star1: (k, t, p, v) => { whoosh(k, t, 0.22, v * 0.6); bell(k, C6 * p, t + 0.2, 0.9, 0.09 * v, { verb: 0.35 }); sub(k, t + 0.2, v * 0.5, 90, 0.25); return bell(k, E6 * p, t + 0.28, 1, 0.08 * v, { verb: 0.35 }); },
  star2: (k, t, p, v) => {
    whoosh(k, t, 0.22, v * 0.7); sub(k, t + 0.2, v * 0.6, 85, 0.3);
    [C6, E6, G6].forEach((f, i) => bell(k, f * p * 1.0595, t + 0.2 + i * 0.07, 1.1, 0.085 * v, { verb: 0.35 }));
    return sparkle(k, t + 0.35, 5, v);
  },
  star3: (k, t, p, v) => {
    whoosh(k, t, 0.24, v * 0.8); sub(k, t + 0.22, v * 0.8, 75, 0.45); cymbal(k, t + 0.22, 0.05 * v, 1.2);
    [C6, E6, G6, C7].forEach((f, i) => bell(k, f * p * 1.1225, t + 0.22 + i * 0.065, 1.4, 0.085 * v, { verb: 0.4 }));
    chord(k, [60 + 2, 64 + 2, 67 + 2], t + 0.22, 0.5, v * 0.7, 'pad');
    return sparkle(k, t + 0.4, 9, v, 3200);
  },
  newRecord: (k, t, p, v) => {
    kick(k, t, 0.35 * v); snare(k, t, 0.15 * v, { verb: 0.3 });
    chord(k, [60, 64, 67, 72].map((m) => m + 12 * Math.log2(p)), t, 0.18, v);
    chord(k, [65, 69, 72, 77].map((m) => m + 12 * Math.log2(p)), t + 0.2, 0.55, v);
    riser(k, t, 0.25, 0.06 * v, { f: 800, f2: 6000 });
    return sparkle(k, t + 0.2, 8, v, 3000);
  },
  xpFill: (k, t, p, v) => {
    tone(k, { type: 'sine', f: 420 * p, f2: 1680 * p, glide: 0.6, t, dur: 0.6, vol: 0.08 * v, a: 0.05, d: 0.2, s: 0.8, r: 0.12, vib: { rate: 18, depth: 25, delay: 0 } });
    tone(k, { type: 'triangle', f: 840 * p, f2: 3360 * p, glide: 0.6, t, dur: 0.6, vol: 0.03 * v, a: 0.05, d: 0.2, s: 0.8, r: 0.12 });
    return sparkle(k, t + 0.55, 4, v);
  },
  levelUp: (k, t, p, v) => {
    const s = 12 * Math.log2(p);
    sub(k, t, v * 0.8, 65, 0.7); kick(k, t, 0.4 * v);
    tone(k, { type: 'triangle', f: mtof(36 + s), t, dur: 1, vol: 0.25 * v, a: 0.01, d: 0.3, s: 0.6, r: 0.3, lp: 600 });
    chord(k, [60, 64, 67].map((m) => m + s), t, 0.22, v);
    [67, 72, 76, 79].forEach((m, i) => brass(k, mtof(m + s), t + 0.2 + i * 0.09, i === 3 ? 0.7 : 0.1, 0.07 * v, { verb: 0.3 }));
    chord(k, [64, 67, 72].map((m) => m + s), t + 0.47, 0.7, v * 0.8);
    cymbal(k, t + 0.47, 0.07 * v, 1.4);
    [C7, E7, G7].forEach((f, i) => bell(k, f * p, t + 0.5 + i * 0.06, 1.2, 0.05 * v, { verb: 0.45 }));
    return t + 1.9;
  },
  chestShake: (k, t, p, v) => {
    let end = t;
    for (const [dt, f, a] of [[0, 260, 1], [0.07, 330, 0.8], [0.15, 240, 0.9], [0.21, 310, 0.6]] as const) {
      end = Math.max(end, wood(k, f * p, t + dt, 0.16 * v * a));
      noise(k, { t: t + dt, dur: 0.02, vol: 0.1 * v * a, filter: 'bandpass', f: 900 * p, q: 2.5, a: 0.001, d: 0.04, s: 0, r: 0.04 });
    }
    tom(k, 90 * p, t, 0.2 * v); tom(k, 80 * p, t + 0.15, 0.15 * v);
    noise(k, { t: t + 0.02, dur: 0.18, vol: 0.03 * v, filter: 'highpass', f: 6000, a: 0.02, d: 0.1, s: 0.3, r: 0.08 }); // içerideki şıngırtı
    return end;
  },
  chestOpen: (k, t, p, v) => {
    sub(k, t, v, 60, 0.7); kick(k, t, 0.5 * v);
    noise(k, { t, dur: 0.05, vol: 0.3 * v, filter: 'lowpass', f: 2600, f2: 300, q: 0.7, a: 0.001, d: 0.35, s: 0, r: 0.3, verb: 0.3 });
    cymbal(k, t, 0.08 * v, 1.6);
    let end = t;
    for (let i = 0; i < 12; i++) end = Math.max(end, bell(k, mtof(72 + PENTA[i % PENTA.length]!) * p, t + 0.08 + i * 0.055, 0.9, 0.05 * v, { verb: 0.45, pan: ((i % 5) - 2) * 0.3 }));
    noise(k, { t: t + 0.05, dur: 0.9, vol: 0.05 * v, filter: 'highpass', f: 5000, a: 0.4, d: 0.2, s: 0.8, r: 0.5, verb: 0.5 });
    chord(k, [60, 64, 67, 72], t + 0.1, 1.2, v * 0.6, 'pad');
    return Math.max(end, t + 1.8);
  },
  itemReveal: (k, t, p, v) => {
    tone(k, { type: 'sine', f: 300 * p, f2: 1000 * p, glide: 0.04, t, dur: 0.02, vol: 0.15 * v, a: 0.001, d: 0.06, s: 0, r: 0.06 });
    bell(k, 1046.5 * p, t + 0.04, 0.8, 0.08 * v, { verb: 0.35 });
    return sparkle(k, t + 0.08, 3, v * 0.8, 3500, 0.04);
  },
  unlock: (k, t, p, v) => {
    bell(k, E6 * p, t, 1, 0.09 * v, { verb: 0.4 }); bell(k, mtof(95) * p, t + 0.13, 1.4, 0.09 * v, { verb: 0.45 });
    tone(k, { type: 'sine', f: 1200 * p, f2: 4800 * p, glide: 0.5, t, dur: 0.5, vol: 0.025 * v, a: 0.1, d: 0.2, s: 0.6, r: 0.2, vib: { rate: 22, depth: 60, delay: 0 } });
    return sparkle(k, t + 0.15, 8, v, 3500, 0.045);
  },
  fanfare: (k, t, p, v) => {
    const s = 12 * Math.log2(p);
    for (let i = 0; i < 8; i++) snare(k, t + i * 0.045, (0.04 + i * 0.012) * v);
    [0, 0.12, 0.24].forEach((dt) => brass(k, mtof(67 + s), t + 0.36 + dt, 0.09, 0.08 * v));
    chord(k, [60, 64, 72].map((m) => m + s), t + 0.72, 0.4, v);
    kick(k, t + 0.72, 0.4 * v); cymbal(k, t + 0.72, 0.06 * v, 1);
    brass(k, mtof(74 + s), t + 1.14, 0.12, 0.08 * v); brass(k, mtof(76 + s), t + 1.28, 0.12, 0.08 * v);
    chord(k, [64, 67, 72, 79].map((m) => m + s), t + 1.42, 0.65, v);
    kick(k, t + 1.42, 0.45 * v); cymbal(k, t + 1.42, 0.08 * v, 1.4); sub(k, t + 1.42, v * 0.7, 65, 0.6);
    [C7, E7, G7].forEach((f, i) => bell(k, f * p, t + 1.45 + i * 0.05, 1, 0.045 * v, { verb: 0.45 }));
    return t + 2.6;
  },
  questDone: (k, t, p, v) => {
    [72, 76, 79].forEach((m, i) => marimba(k, mtof(m) * p, t + i * 0.08, 0.2 * v, { verb: 0.2 }));
    bell(k, C7 * p, t + 0.24, 1, 0.07 * v, { verb: 0.4 });
    clap(k, t + 0.24, 0.07 * v);
    return sparkle(k, t + 0.26, 5, v);
  },
  streak: (k, t, p, v) => {
    noise(k, { t, dur: 0.5, vol: 0.12 * v, filter: 'bandpass', f: 300, f2: 2400, q: 0.8, a: 0.25, d: 0.1, s: 0.8, r: 0.2 });
    tone(k, { type: 'triangle', f: mtof(76) * p, t: t + 0.25, dur: 0.1, vol: 0.12 * v, a: 0.003, d: 0.1, s: 0.3, r: 0.1 });
    return bell(k, mtof(83) * p, t + 0.36, 1, 0.08 * v, { verb: 0.35 });
  },

  // ------------------------------------------------ harita
  nodePop: (k, t, p, v) => { SFX.pop(k, t, p, v); return bell(k, 1568 * p, t + 0.03, 0.6, 0.06 * v, { verb: 0.3 }); },
  pathDraw: (k, t, p, v) => tone(k, { type: 'sine', f: 600 * p, f2: 1250 * p, glide: 0.35, t, dur: 0.32, vol: 0.06 * v, a: 0.04, d: 0.1, s: 0.8, r: 0.1, vib: { rate: 14, depth: 18, delay: 0 }, verb: 0.3 }),
  odiStep: (k, t, p, v) => tone(k, { type: 'sine', f: 190 * p, f2: 120 * p, glide: 0.05, t, dur: 0.01, vol: 0.14 * v, a: 0.002, d: 0.06, s: 0, r: 0.06 }),
  restore: (k, t, p, v) => {
    const s = 12 * Math.log2(p);
    for (const m of [48, 55, 60, 64, 67, 74]) tone(k, { type: m < 55 ? 'triangle' : 'sawtooth', f: mtof(m + s), t, dur: 1.6, vol: (m < 55 ? 0.12 : 0.03) * v, a: 0.9, d: 0.3, s: 0.9, r: 0.8, lp: 400, lpEnd: 3000, lpTime: 1.4, verb: 0.5 });
    [72, 76, 79, 84].forEach((m, i) => bell(k, mtof(m + s), t + 0.9 + i * 0.12, 1.3, 0.06 * v, { verb: 0.5 }));
    return t + 2.6;
  },
  biomeAwaken: (k, t, p, v) => {
    const s = 12 * Math.log2(p);
    sub(k, t, v * 0.7, 55, 1.2);
    for (const m of [36, 48, 55, 60, 64, 67, 71, 74]) tone(k, { type: m < 50 ? 'triangle' : 'sawtooth', f: mtof(m + s), t, dur: 2.2, vol: (m < 50 ? 0.12 : 0.025) * v, a: 1.2, d: 0.4, s: 0.9, r: 1, lp: 300, lpEnd: 3500, lpTime: 1.8, verb: 0.6, detune: (m % 3) * 4 });
    riser(k, t, 1.3, 0.06 * v, { f: 200, f2: 5000 });
    cymbal(k, t + 1.3, 0.07 * v, 2);
    [72, 76, 79, 83, 84, 88].forEach((m, i) => bell(k, mtof(m + s), t + 1.3 + i * 0.11, 1.6, 0.055 * v, { verb: 0.55, pan: (i % 2 ? 0.4 : -0.4) }));
    return t + 3.4;
  },
  flagPlant: (k, t, p, v) => {
    tom(k, 110 * p, t, 0.3 * v); noise(k, { t, dur: 0.05, vol: 0.12 * v, filter: 'lowpass', f: 1200, a: 0.001, d: 0.08, s: 0, r: 0.08 });
    noise(k, { t: t + 0.08, dur: 0.3, vol: 0.06 * v, filter: 'bandpass', f: 1800, f2: 3000, q: 3, a: 0.05, d: 0.1, s: 0.6, r: 0.1 });
    return bell(k, 1318.5 * p, t + 0.12, 0.9, 0.07 * v, { verb: 0.35 });
  },

  // ------------------------------------------------ oyun içi
  jump: (k, t, p, v) => tone(k, { type: 'triangle', f: 300 * p, f2: 720 * p, glide: 0.13, t, dur: 0.1, vol: 0.14 * v, a: 0.003, d: 0.08, s: 0.4, r: 0.05 }),
  doubleJump: (k, t, p, v) => { tone(k, { type: 'triangle', f: 500 * p, f2: 1100 * p, glide: 0.11, t, dur: 0.09, vol: 0.13 * v, a: 0.003, d: 0.08, s: 0.4, r: 0.05 }); return sparkle(k, t + 0.04, 3, v * 0.7, 3200, 0.025); },
  land: (k, t, p, v) => { noise(k, { t, dur: 0.03, vol: 0.08 * v, filter: 'lowpass', f: 400, a: 0.001, d: 0.05, s: 0, r: 0.05 }); return tone(k, { type: 'sine', f: 130 * p, f2: 70 * p, glide: 0.06, t, dur: 0.01, vol: 0.14 * v, a: 0.002, d: 0.07, s: 0, r: 0.07 }); },
  hit: (k, t, p, v) => {
    noise(k, { t, dur: 0.06, vol: 0.22 * v, filter: 'lowpass', f: 1400, f2: 300, a: 0.001, d: 0.15, s: 0, r: 0.12 });
    tone(k, { type: 'sawtooth', f: 170 * p, f2: 60 * p, glide: 0.22, t, dur: 0.12, vol: 0.12 * v, a: 0.002, d: 0.15, s: 0.3, r: 0.1, lp: 900 });
    return sub(k, t, v * 0.5, 80, 0.2);
  },
  power: (k, t, p, v) => {
    [72, 76, 79, 84].forEach((m, i) => tone(k, { type: 'triangle', f: mtof(m) * p, t: t + i * 0.055, dur: 0.07, vol: 0.12 * v, a: 0.003, d: 0.08, s: 0.3, r: 0.08, verb: 0.2 }));
    return sparkle(k, t + 0.22, 4, v, 3000);
  },
  bounce: (k, t, p, v) => tone(k, { type: 'sine', f: 200 * p, f2: 480 * p, glide: 0.1, t, dur: 0.1, vol: 0.18 * v, a: 0.003, d: 0.1, s: 0.3, r: 0.08, vib: { rate: 24, depth: 30, delay: 0.04 } }),
  perfect: (k, t, p, v) => { bell(k, G6 * p, t, 0.9, 0.09 * v, { verb: 0.35 }); bell(k, C7 * p, t + 0.06, 1.1, 0.08 * v, { verb: 0.4 }); return sparkle(k, t + 0.08, 5, v); },
  combo: (k, t, p, v) => {
    const s = 12 * Math.log2(p);
    [72, 76, 79].forEach((m) => tone(k, { type: 'square', f: mtof(m + s), t, dur: 0.1, vol: 0.035 * v, a: 0.002, d: 0.1, s: 0.3, r: 0.1, lp: 3500, verb: 0.2 }));
    clap(k, t, 0.06 * v);
    return bell(k, mtof(84 + s), t + 0.05, 0.8, 0.06 * v, { verb: 0.35 });
  },
  gameOver: (k, t, p, v) => {
    let end = t;
    [67, 64, 60, 55].forEach((m, i) => { end = tone(k, { type: 'triangle', f: mtof(m) * p, t: t + i * 0.17, dur: 0.2, vol: 0.12 * v, a: 0.01, d: 0.15, s: 0.5, r: 0.2, lp: 2000, verb: 0.3 }); });
    return end;
  },
  win: (k, t, p, v) => {
    [72, 76, 79, 84].forEach((m, i) => bell(k, mtof(m) * p, t + i * 0.08, 1.2, 0.07 * v, { verb: 0.4 }));
    chord(k, [60, 64, 67], t + 0.32, 0.6, v * 0.8);
    kick(k, t + 0.32, 0.3 * v);
    return sparkle(k, t + 0.35, 8, v, 3000);
  },
  tick: (k, t, p, v) => tone(k, { type: 'sine', f: 1500 * p, t, dur: 0.012, vol: 0.08 * v, a: 0.001, d: 0.03, s: 0, r: 0.03 }),
  countdown: (k, t, p, v) => {
    tone(k, { type: 'triangle', f: 440 * p, t, dur: 0.12, vol: 0.16 * v, a: 0.003, d: 0.1, s: 0.5, r: 0.08 });
    return tone(k, { type: 'square', f: 440 * p, t, dur: 0.1, vol: 0.03 * v, a: 0.003, d: 0.08, s: 0.4, r: 0.06, lp: 2000 });
  },
  countdownGo: (k, t, p, v) => {
    chord(k, [69, 73, 76].map((m) => m + 12 * Math.log2(p)), t, 0.35, v);
    tone(k, { type: 'triangle', f: 880 * p, t, dur: 0.3, vol: 0.13 * v, a: 0.003, d: 0.2, s: 0.5, r: 0.15 });
    tone(k, { type: 'triangle', f: 1320 * p, t: t + 0.08, dur: 0.28, vol: 0.1 * v, a: 0.003, d: 0.2, s: 0.5, r: 0.15 });
    return cymbal(k, t, 0.04 * v, 0.6);
  },
};

/** ödül anlarında müziği otomatik kıs (sn) */
export const AUTO_DUCK: Partial<Record<Sfx, number>> = {
  levelUp: 1.6, fanfare: 2.4, chestOpen: 1.6, star3: 1, newRecord: 1, biomeAwaken: 3, restore: 2.2, unlock: 1, win: 1, coinBurst: 0.8, questDone: 0.8,
};

/** sınırlayıcı kuralları: birleştirme penceresi, eşzamanlı üst sınır, öncelik */
export function sfxRule(name: string): { cap: number; merge: number; prio: number } {
  switch (name) {
    case 'coin': return { cap: 5, merge: 0.03, prio: 2 };
    case 'countTick': case 'tick': return { cap: 3, merge: 0.035, prio: 1 };
    case 'tap': case 'tab': case 'back': case 'toggle': return { cap: 2, merge: 0.06, prio: 1 };
    case 'coinBurst': case 'chestOpen': case 'levelUp': case 'fanfare': case 'biomeAwaken': case 'restore': return { cap: 1, merge: 0.2, prio: 3 };
    case 'odiStep': case 'land': return { cap: 2, merge: 0.05, prio: 1 };
    default: return name.startsWith('tone') ? { cap: 6, merge: 0.012, prio: 2 } : { cap: 3, merge: 0.03, prio: 2 };
  }
}
