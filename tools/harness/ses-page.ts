/**
 * Ses ölçümü sayfa tarafı (tools/harness/ses.mjs esbuild ile paketler, Playwright'ta çalıştırır):
 * her parçayı/efekti OfflineAudioContext ile işler; WAV (16 bit stereo, base64) + RMS, tepe, spektral merkez döndürür.
 */
import { ALL_SFX, ALL_TRACKS, renderCoinRain, renderSfx, renderTrack } from '../../packages/audio/src/offline';

interface Report { name: string; seconds: number; rmsDb: number; peakDb: number; peak: number; clipped: number; centroidHz: number; bands: { low: number; mid: number; high: number }; wav: string }

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j]!, re[i]!]; [im[i], im[j]] = [im[j]!, im[i]!]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len; const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b]! * cr - im[b]! * ci, ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr; im[b] = im[a]! - ti; re[a] = re[a]! + tr; im[a] = im[a]! + ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

function analyze(name: string, b: AudioBuffer): Report {
  const L = b.getChannelData(0), R = b.numberOfChannels > 1 ? b.getChannelData(1) : L; const n = L.length;
  let sum = 0, peak = 0, clipped = 0;
  for (let i = 0; i < n; i++) { const l = L[i]!, r = R[i]!; sum += l * l + r * r; const a = Math.max(Math.abs(l), Math.abs(r)); if (a > peak) peak = a; if (a >= 0.999) clipped++; }
  const rms = Math.sqrt(sum / (2 * n));
  // spektral merkez: 4096'lık pencerelerin güç ağırlıklı ortalaması (sessiz pencereler atlanır)
  const N = 4096; let wsum = 0, fsum = 0; const band = [0, 0, 0];
  for (let off = 0; off + N <= n; off += N) {
    const re = new Float64Array(N), im = new Float64Array(N); let e = 0;
    for (let i = 0; i < N; i++) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)); re[i] = ((L[off + i]! + R[off + i]!) / 2) * w; e += re[i]! * re[i]!; }
    if (e < 1e-6) continue;
    fft(re, im);
    for (let k = 1; k < N / 2; k++) { const p = re[k]! * re[k]! + im[k]! * im[k]!; const m = Math.sqrt(p); const f = (k * b.sampleRate) / N; wsum += m; fsum += m * f; band[f < 250 ? 0 : f < 2500 ? 1 : 2]! += p; }
  }
  // WAV
  const bytes = new Uint8Array(44 + n * 4); const dv = new DataView(bytes.buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
  dv.setUint32(24, b.sampleRate, true); dv.setUint32(28, b.sampleRate * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) { dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i]!)) * 32767, true); dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i]!)) * 32767, true); }
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const db = (x: number) => Math.round(20 * Math.log10(Math.max(1e-9, x)) * 10) / 10;
  return { name, seconds: Math.round((n / b.sampleRate) * 100) / 100, rmsDb: db(rms), peakDb: db(peak), peak: Math.round(peak * 1000) / 1000, clipped, centroidHz: Math.round(wsum ? fsum / wsum : 0), bands: (() => { const t = band[0]! + band[1]! + band[2]! || 1; return { low: Math.round((band[0]! / t) * 100), mid: Math.round((band[1]! / t) * 100), high: Math.round((band[2]! / t) * 100) }; })(), wav: btoa(bin) };
}

const api = {
  tracks: () => ALL_TRACKS as string[],
  sfx: () => ALL_SFX as string[],
  async track(name: string, seconds = 8) { return analyze(name, await renderTrack(name as never, seconds)); },
  async effect(name: string) { return analyze(name, await renderSfx(name as never, name === 'biomeAwaken' || name === 'fanfare' || name === 'restore' ? 4 : 2.5)); },
  async coinRain() { return analyze('coinRain', await renderCoinRain()); },
};
(globalThis as unknown as { OdiSes: typeof api }).OdiSes = api;
