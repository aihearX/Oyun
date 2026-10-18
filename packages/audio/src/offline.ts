/**
 * Çevrimdışı işleme (ölçüm/harness): aynı motor OfflineAudioContext üzerinde çalışır; SFX ve müzik parçaları
 * dosyaya yazılıp RMS/tepe/spektrum ölçülebilsin diye AudioBuffer olarak döner. Oyun kodu bunu kullanmaz.
 */
import type { Sfx, Track } from './index';
import { Engine } from './engine';
import { TRACKS } from './music';

export const ALL_SFX: Sfx[] = [
  'tap', 'back', 'tab', 'toggle', 'whoosh', 'pop', 'error', 'notify',
  'coin', 'coinBurst', 'countTick', 'star1', 'star2', 'star3', 'newRecord', 'xpFill', 'levelUp',
  'chestShake', 'chestOpen', 'itemReveal', 'unlock', 'fanfare', 'questDone', 'streak',
  'nodePop', 'pathDraw', 'odiStep', 'restore', 'biomeAwaken', 'flagPlant',
  'jump', 'doubleJump', 'land', 'hit', 'power', 'bounce', 'perfect', 'combo', 'gameOver', 'win', 'tick', 'countdown', 'countdownGo',
];
export const ALL_TRACKS = Object.keys(TRACKS) as Track[];

function offline(seconds: number, sr: number) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
  const eng = new Engine({ context: () => ctx, intervalMs: 0 });
  eng.unlock();
  return { ctx, eng };
}

export async function renderSfx(name: Sfx, seconds = 3.5, sr = 44100, semitones = 0): Promise<AudioBuffer> {
  const { ctx, eng } = offline(seconds, sr);
  eng.play(name, { semitones });
  return ctx.startRendering();
}

export async function renderTrack(track: Track, seconds = 8, sr = 44100): Promise<AudioBuffer> {
  const { ctx, eng } = offline(seconds, sr);
  eng.music(track, { fade: 0.05 });
  eng.tick(seconds + 1);
  return ctx.startRendering();
}

/** jeton yağmuru: 30 jeton 15 ms arayla (sınırlayıcı sınaması) */
export async function renderCoinRain(n = 30, gapMs = 15, sr = 44100): Promise<AudioBuffer> {
  const { ctx, eng } = offline(2.5, sr);
  for (let i = 0; i < n; i++) eng.play('coin', { delay: (i * gapMs) / 1000, semitones: Math.min(12, i) });
  return ctx.startRendering();
}

export { Engine, TRACKS };
