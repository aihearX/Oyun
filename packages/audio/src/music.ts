/**
 * Müzik parçaları: her biri ölçü üreten bir fonksiyon (saf veri; ses düğümü yok → test edilebilir).
 * Ortak dil (tools/reels/music.py ile aynı): ninni esintili, sıcak, neşeli; harita teması 104 BPM Do majör C-G-Am-F.
 * Döngüler 8-16 ölçü; bölümler (A/A'/B), dolgular ve döngü başına deterministik çeşitlemeler (aynı döngü sıkmasın).
 */
import { hash, rng } from './sequencer';

export type Inst =
  | 'pluck' | 'bell' | 'celesta' | 'pad' | 'bass' | 'sub' | 'saw' | 'kick' | 'heart' | 'snare' | 'clap' | 'hat' | 'ohat' | 'shaker'
  | 'tom' | 'wood' | 'drop' | 'pulse' | 'marimba' | 'lead' | 'brass' | 'stab' | 'cym' | 'riser' | 'boing';
/** at/dur: vuruş cinsinden (ölçü başından); m: MIDI nota; v: 0-1 */
export interface NoteEv { at: number; dur: number; inst: Inst; m: number; v: number; pan?: number; lp?: number }
export interface TrackDef {
  id: string;
  /** insan okur: "Do majör · 104 BPM · pluck + çan" */
  desc: string;
  bpm: number;
  bars: number;
  oneShot?: boolean;
  /** parça seviyesi (0-1) ve yankı gönderme */
  gain: number;
  verb: number;
  /** tüm parçayı boğuklaştıran alçak geçiren (kulak kanalı tüneli) */
  busLp?: number;
  bar(i: number, loop: number, rnd: () => number): NoteEv[];
}

interface Ch { b: number; t: number[] }
const ev = (at: number, dur: number, inst: Inst, m: number, v: number, x: Partial<NoteEv> = {}): NoteEv => ({ at, dur, inst, m, v, ...x });
const padCh = (c: Ch, v: number, oct = 0, x: Partial<NoteEv> = {}): NoteEv[] => c.t.map((m) => ev(0, 4, 'pad', m + oct, v, x));
/** 16'lık (ya da 8'lik) vuruş deseni: x = tam, o = yumuşak, . = yok */
function steps(pat: string, inst: Inst, m: number, v: number, x: Partial<NoteEv> = {}): NoteEv[] {
  const step = 4 / pat.length; const out: NoteEv[] = [];
  for (let i = 0; i < pat.length; i++) { const ch = pat[i]; if (ch === 'x' || ch === 'o') out.push(ev(i * step, step, inst, m, ch === 'x' ? v : v * 0.55, x)); }
  return out;
}
/** melodi: [nota, vuruş] (nota ≤ 0: es) */
function mel(notes: [number, number][], inst: Inst, v: number, start = 0, x: Partial<NoteEv> = {}): NoteEv[] {
  const out: NoteEv[] = []; let t = start;
  for (const [m, d] of notes) { if (m > 0) out.push(ev(t, d * 0.95, inst, m, v, x)); t += d; }
  return out;
}
/** arpej: akor seslerinden sıra ile, verilen adımda */
function arp(tones: number[], order: number[], step: number, inst: Inst, v: number, oct = 0, x: Partial<NoteEv> & { panAlt?: number } = {}): NoteEv[] {
  const { panAlt, ...rest } = x;
  return order.map((k, i) => ev(i * step, step, inst, tones[k % tones.length]! + oct + 12 * Math.floor(k / tones.length), v, { ...rest, ...(panAlt ? { pan: i % 2 ? panAlt : -panAlt } : {}) }));
}

// ------------------------------------------------------------------ harita (ana tema)
const H_P: Ch[] = [{ b: 36, t: [60, 64, 67] }, { b: 43, t: [59, 62, 67] }, { b: 45, t: [60, 64, 69] }, { b: 41, t: [60, 65, 69] }];
/** özgün ninni motifi (music.py ile aynı) — 4 ölçü */
const MOTIF: [number, number][][] = [
  [[72, 1], [76, 0.5], [74, 0.5], [72, 1], [67, 1]],
  [[71, 1], [74, 0.5], [72, 0.5], [71, 1], [67, 1]],
  [[69, 1], [72, 0.5], [71, 0.5], [69, 1], [76, 1]],
  [[77, 1], [76, 0.5], [74, 0.5], [72, 2]],
];
const harita: TrackDef = {
  id: 'harita', desc: 'Do majör · 104 BPM · C-G-Am-F · ninni motifi: pluck + çan, B bölümünde celesta karşı ezgi', bpm: 104, bars: 16, gain: 0.9, verb: 0.9,
  bar(i, loop, r) {
    const c = H_P[i % 4]!; const sec = i >> 2; const o: NoteEv[] = [];
    o.push(...padCh(c, sec === 2 ? 0.9 : 0.7));
    o.push(ev(0, 0.9, 'bass', c.b, 0.9), ev(1, 0.9, 'bass', c.b + 12, 0.5), ev(2, 0.9, 'bass', c.b, 0.8), ev(3, 0.9, 'bass', c.b + 7, 0.5));
    if (!(loop === 0 && i === 0)) {
      if (sec !== 2) { o.push(...steps('x.......x.......', 'kick', 0, 0.8), ...steps('..o...o...o...o.', 'hat', 0, 0.8), ...steps('....o.......o...', 'clap', 0, 0.8)); }
      else o.push(...steps('o.o.x.o.o.o.x.o.', 'shaker', 0, 0.9));
    }
    const mot = MOTIF[i % 4]!;
    if (sec !== 2) {
      const shift = sec === 3 && loop % 2 === 1 && i % 4 < 2 ? 12 : 0; // her ikinci döngüde son bölüm oktav yukarıda başlar
      o.push(...mel(mot.map(([m, d]) => [m + shift, d] as [number, number]), 'pluck', 0.85));
      if (sec >= 1) o.push(ev(0, 2, 'bell', mot[0]![0] + 12, 0.7));
      if (sec === 3) o.push(...arp(c.t, [0, 1, 2, 1, 0, 1, 2, 1], 0.5, 'marimba', 0.45, 12, { panAlt: 0.3 }));
      if (i % 4 !== 3 && r() < 0.4) o.push(ev(3.5, 0.5, 'celesta', c.t[2]! + 24, 0.5));
    } else {
      o.push(ev(0, 1.9, 'lead', c.t[2]! + 12, 0.75), ev(2, 1.9, 'lead', c.t[1]! + 12 + (i % 2 ? 2 : 0), 0.6));
      o.push(...arp(c.t, [0, 2, 1, 2], 1, 'celesta', 0.55, 24));
    }
    if (i === 7) o.push(ev(3.5, 0.5, 'ohat', 0, 0.8), ev(3, 0.25, 'tom', 55, 0.5), ev(3.25, 0.25, 'tom', 50, 0.5));
    if (i === 15) { o.push(...steps('............oxox', 'snare', 0, 0.7)); if (r() < 0.6) o.push(ev(2, 2, 'riser', 0, 0.5)); }
    return o;
  },
};

// ------------------------------------------------------------------ menü (aynı ton/tempo: haritayla yumuşak geçiş)
const M_P: Ch[] = [{ b: 36, t: [60, 64, 67] }, { b: 45, t: [60, 64, 69] }, { b: 41, t: [60, 65, 69] }, { b: 43, t: [59, 62, 67] }];
const menu: TrackDef = {
  id: 'menu', desc: 'Do majör · 104 BPM · C-Am-F-G · marimba arpejleri, yumuşak pad, ninni başı çanda', bpm: 104, bars: 8, gain: 0.8, verb: 1,
  bar(i, loop, r) {
    const c = M_P[i % 4]!; const o: NoteEv[] = [];
    o.push(...padCh(c, 0.6));
    o.push(ev(0, 1.8, 'bass', c.b, 0.7), ev(2.5, 1.3, 'bass', c.b + 7, 0.45));
    o.push(...arp(c.t, [0, 1, 2, 1, 0, 2, 1, 2], 0.5, 'marimba', 0.5, 12, { panAlt: 0.35 }));
    if (loop > 0 || i > 0) o.push(...steps('o.o.o.o.o.o.o.o.', 'shaker', 0, 0.7));
    if (i % 4 === 0) o.push(...mel([[72, 1], [76, 0.5], [74, 0.5]], 'bell', 0.5));
    if (i % 4 === 2 && r() < 0.6) o.push(ev(2, 1, 'celesta', c.t[2]! + 24, 0.5));
    if (i === 7) o.push(ev(3, 1, 'riser', 0, 0.35));
    return o;
  },
};

// ------------------------------------------------------------------ biyomlar
const disKulak: TrackDef = {
  id: 'biyom:dis-kulak', desc: 'Sol majör · 100 BPM · G-D-Em-C · hafif pluck gitar, el çırpma, sıcak ve açık', bpm: 100, bars: 8, gain: 0.85, verb: 0.7,
  bar(i, loop, r) {
    const P: Ch[] = [{ b: 43, t: [55, 59, 62] }, { b: 38, t: [54, 57, 62] }, { b: 40, t: [55, 59, 64] }, { b: 36, t: [55, 60, 64] }];
    const M: [number, number][][] = [
      [[74, 1], [71, 0.5], [74, 0.5], [76, 1], [74, 1]], [[74, 1.5], [69, 0.5], [66, 1], [69, 1]],
      [[71, 1], [74, 1], [79, 1], [76, 1]], [[76, 1], [74, 0.5], [72, 0.5], [71, 2]],
    ];
    const c = P[i % 4]!; const o: NoteEv[] = [];
    // tel vuruşu (strum) + kırık akor 8'likler
    c.t.forEach((m, k) => o.push(ev(k * 0.03, 1, 'pluck', m + 12, 0.55, { pan: -0.2 })));
    o.push(...arp(c.t, [0, 1, 2, 1, 2, 1, 0, 1], 0.5, 'pluck', 0.4, 12, { panAlt: 0.25 }).slice(1));
    o.push(ev(0, 0.9, 'bass', c.b, 0.85), ev(1.5, 0.45, 'bass', c.b, 0.5), ev(2, 0.9, 'bass', c.b + 7, 0.6), ev(3, 0.9, 'bass', c.b + 12, 0.5));
    if (loop > 0 || i > 0) o.push(...steps('x.....x.x.......', 'kick', 0, 0.65), ...steps('....x.......x...', 'clap', 0, 0.7), ...steps('o.o.o.o.o.o.o.o.', 'shaker', 0, 0.7));
    const sec = i >> 2;
    o.push(...mel(M[i % 4]!.map(([m, d]) => [m + (sec === 1 && loop % 2 ? 12 : 0), d] as [number, number]), sec ? 'bell' : 'pluck', sec ? 0.45 : 0.75, 0, { pan: 0.15 }));
    if (r() < 0.3) o.push(ev(3.5, 0.5, 'pluck', c.t[2]! + 24, 0.4));
    if (i === 7) o.push(...steps('............xxxx', 'tom', 52, 0.4));
    return o;
  },
};

const kanal: TrackDef = {
  id: 'biyom:kanal', desc: 'Mi minör · 90 BPM · Em-C-G-D · boğuk tünel: kalp atışı davul, derin sub bas, yankılı damlalar', bpm: 90, bars: 8, gain: 1, verb: 1.3, busLp: 1700,
  bar(i, loop, r) {
    const P: Ch[] = [{ b: 40, t: [52, 55, 59] }, { b: 36, t: [52, 55, 60] }, { b: 43, t: [50, 55, 59] }, { b: 38, t: [50, 54, 57] }];
    const c = P[i % 4]!; const o: NoteEv[] = [];
    o.push(...padCh(c, 0.8, 12, { lp: 800 }));
    o.push(ev(0, 3.8, 'sub', c.b - 12 + 12, 0.85));
    o.push(ev(0, 0.3, 'heart', 0, 0.9), ev(0.35, 0.3, 'heart', 0, 0.6), ev(2, 0.3, 'heart', 0, 0.85), ev(2.35, 0.3, 'heart', 0, 0.55));
    o.push(...arp(c.t, [0, 1, 2, 1], 1, 'pluck', 0.55, 12, { panAlt: 0.4 }));
    if (i % 2 === 1 || loop > 0) o.push(...steps('..o...o...o...o.', 'shaker', 0, 0.6));
    const k = Math.floor(r() * 4); o.push(ev(k + 0.5, 0.5, 'drop', c.t[k % 3]! + 24, 0.6, { pan: r() * 1.2 - 0.6 }));
    if (i % 4 === 3) o.push(...mel([[c.t[2]! + 12, 1.5], [c.t[1]! + 12, 1.5]], 'bell', 0.5, 1));
    if (i === 7) o.push(ev(2, 2, 'riser', 0, 0.4));
    return o;
  },
};

const zar: TrackDef = {
  id: 'biyom:zar', desc: 'Fa majör · 112 BPM · F-C-Dm-Bb · zıplayan zar: boing davullar, oktav zıplayan bas, marimba', bpm: 112, bars: 8, gain: 0.85, verb: 0.7,
  bar(i, loop, r) {
    const P: Ch[] = [{ b: 41, t: [65, 69, 72] }, { b: 36, t: [64, 67, 72] }, { b: 38, t: [62, 65, 69] }, { b: 46, t: [62, 65, 70] }];
    const M: [number, number][][] = [
      [[72, 0.5], [77, 0.5], [76, 0.5], [72, 0.5], [69, 1], [72, 1]], [[72, 0.5], [76, 0.5], [79, 1], [76, 1], [72, 1]],
      [[74, 0.5], [77, 0.5], [81, 1], [77, 0.5], [74, 0.5], [69, 1]], [[70, 1], [74, 0.5], [77, 0.5], [76, 2]],
    ];
    const c = P[i % 4]!; const o: NoteEv[] = [];
    o.push(...padCh(c, 0.45));
    for (let s = 0; s < 8; s++) o.push(ev(s * 0.5, 0.45, 'bass', c.b + (s % 2 ? 12 : 0), s % 2 ? 0.5 : 0.85));
    o.push(...steps('x.o.x.o.x.o.x.o.', 'boing', 0, 0.8).map((e, k) => ({ ...e, m: [57, 62, 55, 60][k % 4]!, pan: k % 2 ? 0.3 : -0.3 })));
    if (loop > 0 || i > 0) o.push(...steps('x.........x.....', 'kick', 0, 0.7), ...steps('....x.......x...', 'snare', 0, 0.55), ...steps('..o...o...o...o.', 'hat', 0, 0.7));
    o.push(...mel(M[i % 4]!, i >= 4 ? 'bell' : 'marimba', i >= 4 ? 0.45 : 0.75, 0, { pan: 0.1 }));
    if (i >= 4) o.push(...arp(c.t, [0, 1, 2, 3], 1, 'marimba', 0.4, 12));
    if (i === 7 || (i === 3 && r() < 0.5)) o.push(...steps('............xoxx', 'tom', 50, 0.5));
    return o;
  },
};

const kemikcikler: TrackDef = {
  id: 'biyom:kemikcikler', desc: 'Re majör · 116 BPM · D-A-Bm-G · saat mekanizması: tahta tik-tak 16\'lıklar, marimba ostinato, kesik testere', bpm: 116, bars: 8, gain: 0.85, verb: 0.55,
  bar(i, loop, r) {
    const P: Ch[] = [{ b: 38, t: [62, 66, 69] }, { b: 45, t: [61, 64, 69] }, { b: 47, t: [62, 66, 71] }, { b: 43, t: [62, 67, 71] }];
    const c = P[i % 4]!; const o: NoteEv[] = [];
    o.push(...steps('xoxoxoxoxoxoxoxo', 'wood', 0, 0.7).map((e, k) => ({ ...e, m: k % 2 ? 88 : 95, pan: k % 2 ? 0.35 : -0.35 })));
    o.push(...arp(c.t, [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 1, 2, 3], 0.25, 'marimba', 0.4, 12));
    for (let s = 0; s < 8; s++) o.push(ev(s * 0.5, 0.2, 'bass', c.b + (s === 3 || s === 7 ? 7 : 0), 0.7));
    if (loop > 0 || i > 1) o.push(...steps('x.......x.......', 'kick', 0, 0.75), ...steps('....x.......x...', 'snare', 0, 0.45));
    o.push(...steps('..x...x...x...x.', 'stab', 0, 0.55).flatMap((e) => c.t.map((m) => ({ ...e, m }))));
    if (i % 2 === 0) o.push(ev(0, 2, 'bell', c.b + 36, 0.4));
    if (i >= 4) o.push(...mel([[c.t[2]! + 12, 1], [c.t[1]! + 12, 1], [c.t[0]! + 12, 1], [c.t[1]! + 12 + (r() < 0.5 ? 2 : 0), 1]], 'lead', 0.45));
    if (i === 7) o.push(...steps('............xxxx', 'wood', 100, 0.8));
    return o;
  },
};

function kokleaTrack(id: string, desc: string, bpm: number, P: Ch[], oct: number, dense: boolean, gain = 0.85): TrackDef {
  return {
    id, desc, bpm, bars: 8, gain, verb: 1.3,
    bar(i, loop, r) {
      const c = P[i % 4]!; const o: NoteEv[] = [];
      o.push(...padCh(c, 0.75, 0, { lp: 900 + oct * 120 }));
      o.push(ev(0, 3.6, 'sub', c.b, 0.85));
      const order = dense ? [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 1, 3, 2, 1, 0, 1] : [0, 2, 1, 3, 2, 1, 0, 2];
      const step = dense ? 0.25 : 0.5;
      o.push(...arp(c.t, order, step, 'drop', 0.75, oct, { panAlt: 0.5 }).filter((_, k) => !(r() < 0.12 && k % 4 === 3)));
      if (dense && (loop > 0 || i > 0)) o.push(...steps('x.......x.......', 'kick', 0, 0.5), ...steps('....o.......o...', 'clap', 0, 0.6), ...steps('o.o.o.o.o.o.o.o.', 'shaker', 0, 0.6));
      else if (loop > 0 || i > 1) o.push(...steps('o...o...o...o...', 'shaker', 0, 0.7));
      if (i % 4 === 0 || i % 4 === 2) o.push(...mel([[c.t[2]! + oct - 12 + 12, 1.5], [c.t[1]! + oct, 1.5], [c.t[0]! + oct + 12, 1]], 'celesta', 0.5));
      if (i >= 4 && dense) o.push(...arp(c.t, [0, 1, 2, 1], 1, 'marimba', 0.45, 12));
      if (i === 7) o.push(ev(2, 2, 'riser', 0, 0.35));
      return o;
    },
  };
}
const koklea1 = kokleaTrack('biyom:koklea-1', 'Mi majör · 98 BPM · E-B-C#m-A · tiz su damlası arpejleri (taban = ince sesler), celesta', 98,
  [{ b: 40, t: [64, 68, 71, 76] }, { b: 47, t: [63, 66, 71, 75] }, { b: 49, t: [64, 68, 73, 76] }, { b: 45, t: [64, 69, 73, 76] }], 24, false, 0.8);
const koklea2 = kokleaTrack('biyom:koklea-2', 'Si bemol majör · 100 BPM · Bb-F-Gm-Eb · orta perde damlalar + marimba, hafif ritim (konuşma bölgesi)', 100,
  [{ b: 46, t: [62, 65, 70, 74] }, { b: 41, t: [60, 65, 69, 72] }, { b: 43, t: [62, 67, 70, 74] }, { b: 39, t: [63, 67, 70, 75] }], 12, true);
const koklea3 = kokleaTrack('biyom:koklea-3', 'Fa majör · 86 BPM · F-C-Dm-Bb · kalın damlalar, derin bas, yavaş pad (apeks = kalın sesler)', 86,
  [{ b: 29 + 12, t: [53, 57, 60, 65] }, { b: 36, t: [52, 55, 60, 64] }, { b: 38, t: [50, 53, 57, 62] }, { b: 34 + 12, t: [50, 53, 58, 62] }], 0, false, 0.95);

const sinir: TrackDef = {
  id: 'biyom:sinir', desc: 'La minör · 124 BPM · Am-F-C-G · elektronik nabız: 16\'lık kare dalga arpej + açılan filtre, dört vuruş kick', bpm: 124, bars: 8, gain: 0.8, verb: 0.6,
  bar(i, loop, r) {
    const P: Ch[] = [{ b: 45, t: [57, 60, 64] }, { b: 41, t: [57, 60, 65] }, { b: 36, t: [55, 60, 64] }, { b: 43, t: [55, 59, 62] }];
    const c = P[i % 4]!; const o: NoteEv[] = [];
    const lp = 500 + 2600 * ((i % 8) / 7);
    o.push(...arp(c.t, [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 4, 3, 2, 1], 0.25, 'pulse', 0.75, 12, { lp, panAlt: 0.2 }));
    o.push(...padCh(c, 0.45, 0, { lp: 1400 }));
    o.push(...steps('..x...x...x...x.', 'saw', c.b, 0.8));
    if (loop > 0 || i > 0) o.push(...steps('x...x...x...x...', 'kick', 0, 0.8), ...steps('..x...x...x...x.', 'ohat', 0, 0.5), ...steps('....x.......x...', 'clap', 0, 0.55));
    if (i >= 4) o.push(...steps('oooooooooooooooo', 'hat', 0, 0.45));
    if (i === 3 || i === 7) o.push(ev(2, 2, 'riser', 0, 0.45));
    if (i >= 4 && r() < 0.7) o.push(ev(0, 1.5, 'lead', c.t[2]! + 12, 0.45), ev(2, 1.5, 'lead', c.t[1]! + 12, 0.4));
    return o;
  },
};

const beyinSapi: TrackDef = {
  id: 'biyom:beyin-sapi', desc: 'Re minör · 112 BPM · Dm-Bb-F-C · sağ-sol ping-pong nabızlar (yön duygusu), yarım tempo trampet, derin pad', bpm: 112, bars: 8, gain: 0.85, verb: 0.9,
  bar(i, loop, r) {
    const P: Ch[] = [{ b: 38, t: [62, 65, 69] }, { b: 46, t: [62, 65, 70] }, { b: 41, t: [60, 65, 69] }, { b: 36, t: [60, 64, 67] }];
    const c = P[i % 4]!; const o: NoteEv[] = [];
    o.push(...padCh(c, 0.8, -12, { lp: 1000 }));
    o.push(...arp(c.t, [0, 2, 1, 2, 0, 2, 1, 3], 0.5, 'pulse', 0.75, 12, { panAlt: 0.85, lp: 2200 }));
    o.push(ev(0, 3.8, 'sub', c.b, 0.8));
    if (loop > 0 || i > 0) o.push(...steps('x.....x...x.....', 'kick', 0, 0.75), ...steps('........x.......', 'snare', 0, 0.6), ...steps('o.o.o.o.o.o.o.o.', 'hat', 0, 0.45));
    if (i % 2 === 1) o.push(...arp(c.t, [2, 1], 1, 'marimba', 0.4, 12, { panAlt: 0.7 }).map((e) => ({ ...e, at: e.at + 2 })));
    if (i >= 4) o.push(...mel([[c.t[2]! + 12, 1], [c.t[1]! + 12, 0.5], [c.t[0]! + 12, 2.5]], 'bell', 0.4, 0, { pan: r() < 0.5 ? -0.5 : 0.5 }));
    if (i === 7) o.push(...steps('............xxxx', 'tom', 45, 0.5));
    return o;
  },
};

const korteks: TrackDef = {
  id: 'biyom:korteks', desc: 'Mi bemol majör · 80 BPM · Ebmaj7-Cm7-Abmaj7-Bb · rüya padleri, seyrek celesta, uzun yankılı çanlar', bpm: 80, bars: 8, gain: 0.95, verb: 1.6,
  bar(i, loop, r) {
    const P: Ch[] = [{ b: 39, t: [58, 62, 63, 67] }, { b: 36, t: [58, 60, 63, 67] }, { b: 44, t: [60, 63, 67, 68] }, { b: 46, t: [58, 62, 65, 70] }];
    const c = P[i % 4]!; const o: NoteEv[] = [];
    o.push(...padCh(c, 0.85, 0, { lp: 1600 }));
    o.push(ev(0, 3.9, 'sub', c.b, 0.7));
    const pick = (k: number) => c.t[k % c.t.length]! + 24;
    const pattern = [[0, 0], [1.5, 2], [2.5, 1], [3, 3]] as const;
    for (const [at, k] of pattern) if (r() < 0.8) o.push(ev(at, 1, 'celesta', pick(k + i), 0.55, { pan: r() * 1.2 - 0.6 }));
    if (i % 2 === 0) o.push(ev(0, 3, 'bell', c.t[3]! + 12, 0.45));
    if (loop > 0 || i > 1) o.push(...steps('o.......o.......', 'shaker', 0, 0.5));
    if (i % 4 === 3) o.push(ev(2, 2, 'riser', 0, 0.3));
    if (i >= 4) o.push(ev(0, 3.8, 'lead', c.t[2]! + 12, 0.35));
    return o;
  },
};

// ------------------------------------------------------------------ boss + zafer
const boss: TrackDef = {
  id: 'boss', desc: 'Do minör · 132 BPM · Cm-Ab-Bb-G · gerilimli ostinato testere bas, tomlar, kesik akor vuruşları, pirinç riff', bpm: 132, bars: 8, gain: 0.85, verb: 0.6,
  bar(i, loop, r) {
    const P: Ch[] = [{ b: 36, t: [60, 63, 67] }, { b: 44, t: [60, 63, 68] }, { b: 46, t: [62, 65, 70] }, { b: 43, t: [59, 62, 67] }];
    const c = P[i % 4]!; const o: NoteEv[] = [];
    const ost = [0, 0, 12, 0, 0, 12, 10, 0];
    ost.forEach((d, k) => o.push(ev(k * 0.5, 0.4, 'saw', c.b - 12 + d, k % 4 === 0 ? 0.95 : 0.7)));
    o.push(...steps('x.....x.x.......', 'kick', 0, 0.85), ...steps('....x.......x...', 'snare', 0, 0.75), ...steps('oxoxoxoxoxoxoxox', 'hat', 0, 0.45));
    o.push(...[1.5, 3.5].flatMap((at) => c.t.map((m) => ev(at, 0.3, 'stab', m, 0.6))));
    o.push(...padCh(c, 0.4, -12, { lp: 900 }));
    if (i >= 4) {
      const riff: [number, number][][] = [[[67, 1], [68, 0.5], [67, 0.5], [63, 1], [60, 1]], [[68, 1], [70, 0.5], [68, 0.5], [67, 2]], [[70, 1], [72, 0.5], [70, 0.5], [74, 2]], [[71, 1.5], [74, 0.5], [79, 2]]];
      o.push(...mel(riff[i % 4]!, 'brass', 0.6));
    } else if (r() < 0.5) o.push(ev(3, 1, 'bell', c.t[2]! + 12, 0.35));
    if (i === 3 || i === 7) o.push(...steps('........xoxoxxxx', 'tom', 48, 0.55).map((e, k) => ({ ...e, m: 52 - k })));
    if (i === 7) o.push(ev(0, 4, 'riser', 0, 0.55));
    if (i === 0 && loop > 0) o.push(ev(0, 2, 'cym', 0, 0.6));
    return o;
  },
};

const zafer: TrackDef = {
  id: 'zafer', desc: 'Do majör · 120 BPM · 2 ölçü (4 sn) tek seferlik zafer jingle\'ı: trampet rulosu, pirinç G-G-G→C, zil, çan arpeji', bpm: 120, bars: 2, oneShot: true, gain: 0.95, verb: 0.9,
  bar(i) {
    const o: NoteEv[] = [];
    if (i === 0) {
      o.push(...steps('xxxxxxxx........', 'snare', 0, 0.45).map((e, k) => ({ ...e, v: 0.25 + k * 0.06 })));
      o.push(ev(1, 0.3, 'brass', 67, 0.7), ev(1.333, 0.3, 'brass', 67, 0.7), ev(1.666, 0.3, 'brass', 67, 0.7));
      o.push(ev(2, 1.8, 'brass', 72, 0.9), ev(2, 1.8, 'brass', 64, 0.55), ev(2, 1.8, 'brass', 60, 0.5));
      o.push(ev(2, 0.3, 'kick', 0, 0.9), ev(2, 2, 'cym', 0, 0.6), ev(2, 1.8, 'bass', 36, 0.9));
      o.push(ev(3, 0.4, 'brass', 74, 0.6), ev(3.5, 0.4, 'brass', 76, 0.65));
    } else {
      o.push(ev(0, 3.5, 'brass', 79, 0.85), ev(0, 3.5, 'brass', 72, 0.6), ev(0, 3.5, 'brass', 67, 0.55), ev(0, 3.5, 'brass', 64, 0.5));
      o.push(ev(0, 0.3, 'kick', 0, 1), ev(0, 3, 'cym', 0, 0.8), ev(0, 3.5, 'bass', 36, 0.9), ev(0, 3.5, 'tom', 43, 0.6));
      [84, 88, 91, 96].forEach((m, k) => o.push(ev(k * 0.25, 2, 'bell', m, 0.55)));
      o.push(...padCh({ b: 36, t: [60, 64, 67, 72] }, 0.7));
    }
    return o;
  },
};

export const TRACKS: Record<string, TrackDef> = Object.fromEntries([harita, menu, disKulak, kanal, zar, kemikcikler, koklea1, koklea2, koklea3, sinir, beyinSapi, korteks, boss, zafer].map((t) => [t.id, t]));
export const BIOME_TRACKS = Object.keys(TRACKS).filter((k) => k.startsWith('biyom:'));

/** parça seçimi: bilinmeyen biyom → adından türetilen sabit bir biyom teması (her yerde aynı); bilinmeyen ad → null */
export function resolveTrack(name: string): TrackDef | null {
  const t = TRACKS[name]; if (t) return t;
  if (name.startsWith('biyom:')) return TRACKS[BIOME_TRACKS[hash(name) % BIOME_TRACKS.length]!]!;
  return null;
}

/** ölçü üretimi: döngü sayısına göre deterministik rastgelelik */
export function barEvents(def: TrackDef, absBar: number): NoteEv[] {
  const i = absBar % def.bars; const loop = Math.floor(absBar / def.bars);
  return def.bar(i, loop, rng(hash(def.id) ^ (absBar * 2654435761)));
}
