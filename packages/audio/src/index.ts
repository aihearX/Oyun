/**
 * ODİ ses motoru — SÖZLEŞME (ses ekibi içini zenginleştirir; imzalar sabit).
 * Tamamen Web Audio ile sentez; varlık dosyası yok. Tarayıcıda ve mobil WebView'da çalışır.
 * iOS: ses ancak bir dokunuştan sonra açılır → ilk pointerdown'da audio.unlock().
 */
export type Sfx =
  // arayüz
  | 'tap' | 'back' | 'tab' | 'toggle' | 'whoosh' | 'pop' | 'error' | 'notify'
  // ödül anları
  | 'coin' | 'coinBurst' | 'countTick' | 'star1' | 'star2' | 'star3' | 'newRecord' | 'xpFill' | 'levelUp'
  | 'chestShake' | 'chestOpen' | 'itemReveal' | 'unlock' | 'fanfare' | 'questDone' | 'streak'
  // harita
  | 'nodePop' | 'pathDraw' | 'odiStep' | 'restore' | 'biomeAwaken' | 'flagPlant'
  // oyun içi
  | 'jump' | 'doubleJump' | 'land' | 'hit' | 'power' | 'bounce' | 'perfect' | 'combo' | 'gameOver' | 'win' | 'tick' | 'countdown' | 'countdownGo';

/** müzik parçaları: harita teması, biyom temaları, boss, zafer jingle'ı */
export type Track = 'harita' | 'menu' | 'boss' | 'zafer' | `biyom:${string}`;

export interface PlayOpts { /** 0..1 */ vol?: number; /** yarım ton kaydırma (seri/çoklu ödülde artan perde) */ semitones?: number; /** saniye gecikme */ delay?: number }

export interface AudioEngine {
  unlock(): void;
  play(sfx: Sfx, opts?: PlayOpts): void;
  /** frekansla nota (tonotopi, melodi notaları) */
  tone(freq: number, dur?: number, vol?: number): void;
  /** müzik: null → durdur; aynı parça çalıyorsa yeniden başlatmaz; fade sn */
  music(track: Track | null, opts?: { fade?: number }): void;
  /** kısa süre müziği kıs (ödül fanfarı vb. için) */
  duck(seconds: number, level?: number): void;
  setVolumes(v: { music?: number; sfx?: number; enabled?: boolean }): void;
  volumes(): { music: number; sfx: number; enabled: boolean };
}

// ---- Geçici asgari uygulama (ses ekibi değiştirecek): basit bip sesleri, müzik yok.
let ctx: AudioContext | null = null; let master: GainNode | null = null;
const vol = { music: 0.6, sfx: 0.9, enabled: true };
function ensure() {
  if (ctx) return ctx;
  try { const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); } catch { ctx = null; }
  return ctx;
}
function beep(freq: number, dur = 0.08, v = 0.15) {
  const c = ensure(); if (!c || !master || !vol.enabled) return;
  const t = c.currentTime; const o = c.createOscillator(); const g = c.createGain();
  o.frequency.value = freq; g.gain.setValueAtTime(v * vol.sfx, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
export const audio: AudioEngine = {
  unlock() { const c = ensure(); if (c && c.state === 'suspended') void c.resume(); },
  play(_s, o) { beep(660 * Math.pow(2, (o?.semitones ?? 0) / 12), 0.08, o?.vol ?? 0.15); },
  tone(f, d = 0.1, v = 0.12) { beep(f, d, v); },
  music() { /* ses ekibi */ },
  duck() { /* ses ekibi */ },
  setVolumes(v) { Object.assign(vol, v); },
  volumes() { return { ...vol }; },
};
