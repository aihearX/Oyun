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
  /** sıkıştırılmış ses kaydını çöz (anlatıcı kayıtları) */
  decode(data: ArrayBuffer): Promise<AudioBuffer | null>;
  /** çözülmüş kaydı anlatıcı yolundan çal; çalınamıyorsa null */
  voice(buf: AudioBuffer, vol?: number): { stop(): void; done: Promise<void> } | null;
  /** ses bağlamı çalışıyor mu */
  running(): boolean;
}

// ---- Uygulama: engine.ts (sentez araç seti synth.ts, SFX kütüphanesi sfx.ts, müzik music.ts, sıralayıcı sequencer.ts, sınırlayıcı limiter.ts).
// Not (mobil): iOS'ta WebView/Web Audio, telefonun sessiz anahtarını her zaman dikkate almaz; oyuncu sesi Ayarlar'daki
// müzik/efekt kaydırıcılarından kısar. Android'de medya ses düzeyi geçerlidir.
import { Engine } from './engine';
export { Engine, type EngineOptions } from './engine';
export { TRACKS, resolveTrack } from './music';
export const audio: AudioEngine & { playing(): string | null; beatClock(): { now: number; startAt: number; beatDur: number; track: string } | null } = new Engine();
