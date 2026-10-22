import { create } from 'zustand';
import { audio } from '@odi/audio';
import { platform } from '../platform';
import { useStore } from '../store';
import { stripEmoji } from '../ui/art';
import { textHash } from './script';
import { NARRATOR_TTS } from './voicePick';

/**
 * Tüy Dede'nin sesi. Önce uygulamaya gömülü kayıt (voice/<id>.mp3, bkz. tools/voice/), WebAudio ile:
 *  - Mobil (Expo DOM): yerel kabuk dosyanın baytlarını köprüden verir (base64); WebView'deki ses motorunda çözülüp çalınır
 *    (müzik ve efektlerle aynı, cihazda çalıştığı bilinen yol). Yerel oynatıcı kullanılmaz.
 *  - Tarayıcı: dosya indirilir, aynı motorla çözülüp çalınır.
 *  - Kayıt metin parmak izi tutmazsa ya da çalınamazsa: yalnız ERKEK bir Türkçe cihaz sesi varsa o okur; yoksa sessiz kalır
 *    (Tüy Dede kadın sesle konuşmaz). Altyazı her zaman ekranda.
 *  - Genel ses ve "Anlatıcı sesi" ayarına uyar, efekt ses düzeyini kullanır, konuşurken müziği kısar, ileri/atla'da susar.
 *  - Sıradaki 1-2 satır önceden çözülür (gecikme olmasın).
 * Ayarlar ekranı son durumu gösterir (kayıt ✓ / cihaz sesi / sessiz + son hata): cihazda ne olduğunu görmek için.
 */
export interface VoiceManifest { version: number; format?: string; lines: Record<string, { file: string; hash: string; ms?: number }> }
const EMPTY: VoiceManifest = { version: 1, lines: {} };

// ---- durum (Ayarlar'daki küçük gösterge + test günlüğü)
export type VoiceMode = 'kayıt' | 'cihaz sesi' | 'sessiz';
export interface VoiceStatus { mode: VoiceMode | null; line: string | null; error: string | null; at: number; source: 'köprü' | 'indirme' | null; decoded: number }
export const useVoiceStatus = create<VoiceStatus>()(() => ({ mode: null, line: null, error: null, at: 0, source: null, decoded: 0 }));
type LogItem = { mode: VoiceMode; id: string | null; file: string | null; error?: string; at: number };
const log: LogItem[] = [];
/** sıraya alınabilen istekler (bölüm içi patoloji cümlesi): ne olduğu — test günlüğü */
export type RequestOutcome = 'hemen' | 'sırada' | 'çalındı' | 'atlandı (eski)' | 'atlandı (sıra dolu)' | 'iptal' | 'kapalı';
type RequestItem = { id: string; outcome: RequestOutcome; at: number };
const requests: RequestItem[] = [];
/** son istekler (en çok 100; test / tanı) */
export const voiceRequests = (): RequestItem[] => requests;
const request = (id: string, outcome: RequestOutcome) => { requests.push({ id, outcome, at: Date.now() }); if (requests.length > 100) requests.splice(0, requests.length - 100); };
if (typeof window !== 'undefined') (window as unknown as { __odiVoice?: unknown }).__odiVoice = { log, requests, status: () => useVoiceStatus.getState() };
function report(mode: VoiceMode, id: string | null, file: string | null, error?: string) {
  log.push({ mode, id, file, ...(error ? { error } : {}), at: Date.now() }); if (log.length > 200) log.splice(0, log.length - 200);
  useVoiceStatus.setState((s) => ({ mode, line: id, at: Date.now(), ...(error ? { error } : mode === 'kayıt' ? { error: null } : { error: s.error }) }));
}
const fail = (error: string) => useVoiceStatus.setState({ error, at: Date.now() });

let manifestP: Promise<VoiceManifest> | null = null;
/** gömülü ses listesi (bir kez yüklenir; yoksa boş) */
export function voiceManifest(): Promise<VoiceManifest> {
  if (!manifestP) {
    manifestP = (async () => {
      try {
        const p = platform();
        // telefon paketi (file://) dosyayı yalnız köprüden okur: köprü yoksa indirme denenmez (file:// isteği konsol hatası verir)
        const fileUrl = typeof location !== 'undefined' && location.protocol === 'file:';
        const raw = p.voiceManifest ? await p.voiceManifest() : fileUrl ? null : await fetch(voiceUrl('manifest.json')).then((r) => (r.ok ? r.text() : null));
        const m = raw ? (JSON.parse(raw) as VoiceManifest) : null;
        return m && typeof m === 'object' && m.lines && typeof m.lines === 'object' ? m : EMPTY;
      } catch (e) { fail(`liste okunamadı: ${String(e).slice(0, 80)}`); return EMPTY; }
    })();
  }
  return manifestP;
}
/** platform değişince (mobil köprü kurulunca) / sıfırlamada önbellekleri boşalt */
export function resetVoiceManifest() { manifestP = null; buffers.clear(); }

function voiceUrl(file: string): string {
  try { return new URL(`voice/${file}`, document.baseURI).href; } catch { return `voice/${file}`; }
}

/** bu satır için çalınabilir kayıt (yoksa null) */
export async function recordedFile(id: string | undefined, text: string): Promise<string | null> {
  if (!id) return null;
  const e = (await voiceManifest()).lines[id];
  return e && e.hash === textHash(text) ? e.file : null;
}

/** base64 → ArrayBuffer (köprüden gelen dosya baytları) */
export function base64ToBytes(b64: string): ArrayBuffer {
  const clean = b64.replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

// ---- çözülmüş kayıt önbelleği (en son kullanılan ~16 satır)
const buffers = new Map<string, Promise<AudioBuffer | null>>();
async function loadBytes(file: string): Promise<ArrayBuffer | null> {
  const p = platform();
  if (p.voiceData) {
    useVoiceStatus.setState({ source: 'köprü' });
    const b64 = await p.voiceData(file);
    if (!b64) { fail(`köprü dosyayı vermedi: ${file}`); return null; }
    return base64ToBytes(b64);
  }
  useVoiceStatus.setState({ source: 'indirme' });
  const r = await fetch(voiceUrl(file));
  if (!r.ok) { fail(`indirilemedi (${r.status}): ${file}`); return null; }
  return r.arrayBuffer();
}
export function voiceBuffer(file: string): Promise<AudioBuffer | null> {
  const hit = buffers.get(file);
  if (hit) { buffers.delete(file); buffers.set(file, hit); return hit; }
  const p = (async () => {
    try {
      const bytes = await loadBytes(file); if (!bytes) return null;
      const buf = await audio.decode(bytes);
      if (!buf) { fail(`çözülemedi: ${file}`); return null; }
      useVoiceStatus.setState((s) => ({ decoded: s.decoded + 1 }));
      return buf;
    } catch (e) { fail(`yüklenemedi: ${file} · ${String(e).slice(0, 80)}`); return null; }
  })();
  buffers.set(file, p);
  void p.then((b) => { if (!b) buffers.delete(file); });
  while (buffers.size > 16) buffers.delete(buffers.keys().next().value!);
  return p;
}
/** sıradaki satırları önceden çöz (anlatıcı turu / hikâye) */
export function prefetchLines(lines: { id?: string; text: string }[]) {
  const s = useStore.getState(); if (!s.sounds || !s.narratorVoice) return;
  for (const l of lines) void recordedFile(l.id, l.text).then((f) => { if (f) void voiceBuffer(f); }).catch(() => undefined);
}

// ---- konuşma
let token = 0;
let current: { stop(): void } | null = null;
/** süren konuşma (yükleme dahil); bitince ya da kesilince null */
let active: Promise<void> | null = null;
/** şu an Tüy Dede konuşuyor mu (ya da satırı yükleniyor mu) */
export function voiceBusy(): boolean { return active !== null; }

/** Tüy Dede bu satırı söyler (kayıt varsa kayıt, yoksa yalnız erkek cihaz sesi, o da yoksa sessiz). Ayar kapalıysa sessiz.
 *  Dönen sayı bu konuşmanın kimliğidir: stopVoiceIf(kimlik) yalnız hâlâ bu satır konuşuluyorsa susturur. */
export function speakLine(text: string, id?: string): number {
  halt();
  const s = useStore.getState();
  if (!s.sounds || !s.narratorVoice) return token;
  const my = ++token; const live = () => my === token;
  const volume = Math.max(0.2, Math.min(1, s.sfxVol ?? 0.9));
  try { audio.unlock(); } catch { /* yok */ }
  const run = (async () => {
    let file: string | null = null;
    try {
      file = await recordedFile(id, text);
      if (!live()) return;
      if (file) {
        const buf = await voiceBuffer(file);
        if (!live()) return;
        if (buf) {
          const h = audio.voice(buf, volume);
          if (h) {
            current = h; report('kayıt', id ?? null, file);
            await h.done;
            if (current === h) current = null;
            return;
          }
          fail(audio.running() ? 'kayıt çalınamadı' : 'ses kilitli: ekrana bir kez dokunun');
        }
      }
      if (!live()) return;
      // yedek: yalnız erkek Türkçe cihaz sesi (yoksa sessiz — altyazı ekranda)
      const spoken = await platform().speak(stripEmoji(text).replace(/[“”"]/g, ''), { rate: NARRATOR_TTS.rate, pitch: NARRATOR_TTS.pitch, maleOnly: true });
      if (live()) report(spoken === false ? 'sessiz' : 'cihaz sesi', id ?? null, file);
    } catch (e) { if (live()) report('sessiz', id ?? null, file, String(e).slice(0, 80)); }
  })();
  active = run;
  void run.finally(() => { if (active === run) { active = null; pump(); } });
  return my;
}

// ---- sıra: bölüm içindeki cümleler (patoloji) başka bir anlatıcı satırının üstüne binmez
type Queued = { text: string; id: string; at: number; maxWaitMs: number; started?: number; cancelled?: boolean };
const queue: Queued[] = [];
/** bekleyen satırların üst sınırı: üçüncüsü gelirse en eskisi atlanır (bölüm içinde konuşma birikmesin) */
const QUEUE_MAX = 2;
function pump() {
  while (!active && queue.length) {
    const q = queue.shift()!;
    if (q.cancelled) continue;
    if (Date.now() - q.at > q.maxWaitMs) { request(q.id, 'atlandı (eski)'); continue; }
    q.started = speakLine(q.text, q.id); request(q.id, 'çalındı');
  }
}
/**
 * Tüy Dede bu satırı BOŞTAYKEN söyler: başka bir satır sürüyorsa sıraya girer (en çok `maxWaitMs` bekler, sonra atlanır);
 * hiçbir satırı kesmez. Ayar kapalıysa hiç çalmaz. Dönen `cancel()` sıradaysa çıkarır, konuşuyorsa susturur.
 */
export function speakWhenFree(text: string, id: string, maxWaitMs = 6000): { cancel(): void } {
  const s = useStore.getState();
  const q: Queued = { text, id, at: Date.now(), maxWaitMs };
  const handle = { cancel() { if (q.cancelled) return; q.cancelled = true; if (q.started != null) stopVoiceIf(q.started); else if (queue.includes(q)) request(id, 'iptal'); } };
  if (!s.sounds || !s.narratorVoice) { request(id, 'kapalı'); q.cancelled = true; return handle; }
  if (!active && !queue.length) { q.started = speakLine(text, id); request(id, 'hemen'); return handle; }
  queue.push(q); request(id, 'sırada');
  while (queue.length > QUEUE_MAX) { const old = queue.shift()!; if (!old.cancelled) request(old.id, 'atlandı (sıra dolu)'); }
  return handle;
}

/** yalnız verilen konuşma sürüyorsa sus (bir notun kapanması sonraki anlatıcı satırını kesmesin); sıradaki satır varsa o başlar */
export function stopVoiceIf(id: number) { if (id === token) { halt(); pump(); } }

/** hemen sus (ileri / atla / ekran değişti) */
export function stopVoice() {
  queue.length = 0;
  halt();
}
/** süren satırı kes (sıra kalır: speakLine yeni satıra geçerken) */
function halt() {
  token++; active = null;
  const c = current; current = null;
  try { c?.stop(); } catch { /* yok */ }
  try { platform().stopSpeaking(); } catch { /* yok */ }
}
