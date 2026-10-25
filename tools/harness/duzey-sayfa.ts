/**
 * Ses düzeyi ölçümü, sayfa tarafı (tools/voice/duzey.mjs --oyun esbuild ile paketler, Playwright Chromium'da çalıştırır).
 * Oyunun kendi motoru (@odi/audio Engine) OfflineAudioContext üzerinde, oyuncunun duyduğu zincirle çalışır:
 * kaynak → (anlatıcı / müzik+duck / efekt) veriyolu → kompresör → ana kazanç (0,9) → çıkış.
 * Her işleme 32 bit kayan noktalı stereo WAV (base64) döner; LUFS / gerçek tepe ölçümünü ffmpeg yapar.
 */
import { Engine } from '../../packages/audio/src/engine';
import { ALL_SFX, ALL_TRACKS } from '../../packages/audio/src/offline';
import { TRACKS } from '../../packages/audio/src/music';
import type { Sfx, Track } from '../../packages/audio/src/index';

const SR = 48000;
/** oyuncunun varsayılan ayarları (apps/web/src/store.ts INITIAL): müzik 0,6, efekt 0,9; anlatıcı kazancı = efekt düzeyi (ftue/voice.ts) */
export interface Vols { music: number; sfx: number }
const DEFAULT: Vols = { music: 0.6, sfx: 0.9 };

function make(seconds: number, v: Vols) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * SR), SR);
  const eng = new Engine({ context: () => ctx, intervalMs: 0 });
  eng.unlock();
  // motorun kendi varsayılanları da 0,6 / 0,9; farklı bir ayar verilirse veriyolları anında o değere oturur
  eng.setVolumes({ music: v.music, sfx: v.sfx, enabled: true });
  return { ctx, eng };
}

function wav(b: AudioBuffer): string {
  const n = b.length, ch = b.numberOfChannels;
  const bytes = new Uint8Array(44 + n * ch * 4); const dv = new DataView(bytes.buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 4, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 3, true); dv.setUint16(22, ch, true); dv.setUint32(24, b.sampleRate, true); dv.setUint32(28, b.sampleRate * ch * 4, true);
  dv.setUint16(32, ch * 4, true); dv.setUint16(34, 32, true); str(36, 'data'); dv.setUint32(40, n * ch * 4, true);
  const data = Array.from({ length: ch }, (_, c) => b.getChannelData(c));
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) dv.setFloat32(44 + (i * ch + c) * 4, data[c]![i]!, true);
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function decode(b64: string): Promise<AudioBuffer> {
  const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const tmp = new OfflineAudioContext(1, 1, SR);
  return tmp.decodeAudioData(u.buffer);
}

/** bir parçanın tam döngüsü (tek seferlik parça: kendi uzunluğu) + 1 sn */
function loopSeconds(track: string): number {
  const d = TRACKS[track]!; return Math.max(8, (d.bars * 4 * 60) / d.bpm) + 1;
}

const api = {
  tracks: () => ALL_TRACKS as string[],
  sfx: () => ALL_SFX as string[],
  defaults: () => DEFAULT,
  /** müzik parçası, tam döngü; duck verilirse baştan sona o düzeye kısık (anlatıcı konuşurken: 0,3) */
  async track(name: string, v: Vols = DEFAULT, duck?: number) {
    const seconds = loopSeconds(name);
    const { ctx, eng } = make(seconds, v);
    eng.music(name as Track, { fade: 0.05 });
    if (duck != null) eng.duck(3600, duck, 0);
    eng.tick(seconds + 1);
    return { seconds, wav: wav(await ctx.startRendering()) };
  },
  /** tek efekt, vol 1 (çağrı yerlerinin çoğu gibi) */
  async effect(name: string, v: Vols = DEFAULT) {
    const seconds = name === 'biomeAwaken' || name === 'fanfare' || name === 'restore' ? 4 : 2.5;
    const { ctx, eng } = make(seconds, v);
    eng.play(name as Sfx);
    return { seconds, wav: wav(await ctx.startRendering()) };
  },
  /** anlatıcı satırı oyundaki gibi: audio.voice(buf, efekt düzeyi [0,2..1]); `extra`: satır başı kazanç denemesi (öneri sınaması) */
  async voice(b64: string, v: Vols = DEFAULT, withTrack?: string, extra = 1) {
    const buf = await decode(b64);
    const seconds = buf.duration + 0.6;
    const { ctx, eng } = make(seconds, v);
    if (withTrack) { eng.music(withTrack as Track, { fade: 0.05 }); eng.tick(seconds + 1); }
    const h = eng.voice(buf, Math.max(0.2, Math.min(1, v.sfx)) * extra);
    if (!h) throw new Error('voice() çalmadı');
    return { seconds, wav: wav(await ctx.startRendering()) };
  },
};
(globalThis as unknown as { OdiDuzey: typeof api }).OdiDuzey = api;
