/**
 * Oyun içi sesler: mevcut `sfx` API'si korunur, içi @odi/audio motoruna yönlenir (Web Audio sentezi, varlık dosyası yok).
 * iOS'ta ses ancak bir dokunuştan sonra başlar: unlock() ilk pointerdown'da çağrılır.
 * setSoundsEnabled yalnızca BU bölümün seslerini açıp kapatır (bot/test, "cihaz kapalı" değiştiricisi);
 * oyuncunun genel ses ayarı kabuktan audio.setVolumes ile gelir.
 */
import { audio, type PlayOpts, type Sfx, type Track } from '@odi/audio';

let enabled = true;

export function setSoundsEnabled(v: boolean) { enabled = v; if (!v) audio.music(null, { fade: 0.3 }); }
export function unlock() { if (enabled) audio.unlock(); }

const play = (s: Sfx, o?: PlayOpts) => { if (enabled) audio.play(s, o); };
/** seri arttıkça perde majör gamda yükselir (en çok bir oktav) */
const SCALE = [0, 2, 4, 5, 7, 9, 11, 12];
export const comboSemitones = (combo: number) => SCALE[Math.max(0, Math.min(SCALE.length - 1, combo - 1))]!;

export const sfx = {
  jump: () => play('jump'),
  doubleJump: () => play('doubleJump'),
  /** combo: o anki jeton serisi (perde yükselir) */
  coin: (combo = 0) => play('coin', { semitones: comboSemitones(combo) }),
  hit: () => play('hit'),
  power: () => play('power'),
  levelUp: () => play('levelUp'),
  gameOver: () => play('gameOver'),
  bounce: () => play('bounce'),
  tick: () => play('tick'),
  land: () => play('land', { vol: 0.7 }),
  perfect: (chain = 0) => play('perfect', { semitones: Math.min(12, chain * 2) }),
  combo: (combo = 0) => play('combo', { semitones: Math.min(12, Math.floor(combo / 5) * 2) }),
  win: () => play('win'),
  /** Tonotopi: koklea derinliğine göre nota (taban ince, apeks kalın) */
  toneAt: (freq: number, dur = 0.1) => { if (enabled) audio.tone(freq, dur, 0.12); },
  /** yarış geri sayımı: 3-2-1 kısa bip, "Başla!" uzun ve tiz */
  countdown: (go: boolean) => play(go ? 'countdownGo' : 'countdown'),
};

/** bölüm müziği (bölüm sesi kapalıysa çalmaz) */
export function music(track: Track | null, fade?: number) { if (enabled || track === null) audio.music(track, fade != null ? { fade } : undefined); }

/** müziğin vuruş saati (ritim platformları müziğe kilitlenir); bölüm sesi kapalıysa null */
export function beatClock() { return enabled ? audio.beatClock() : null; }
