import { audio } from '@odi/audio';
import { platform } from '../platform';
import { useStore } from '../store';
import { stripEmoji } from '../ui/art';
import { textHash } from './script';
import { NARRATOR_TTS } from './voicePick';

/**
 * Tüy Dede'nin sesi. Önce uygulamaya gömülü kayıt (voice/<id>.mp3, bkz. tools/voice/), yoksa cihaz sesi (TTS).
 *  - Kayıt yalnız metin parmak izi tutuyorsa çalar (altyazıyla birebir aynı söz).
 *  - Tarayıcı: tek bir <audio> öğesi (ilk dokunuşta kilidi açılır; iOS Safari sonraki çalmalara izin verir).
 *  - Mobil (Expo DOM): yerel oynatıcı (expo-audio) köprüsü; dosyalar uygulama paketinde.
 *  - Genel ses ve "Anlatıcı sesi" ayarına uyar, efekt ses düzeyini kullanır, konuşurken müziği kısar, ileri/atla'da susar.
 */
export interface VoiceManifest { version: number; format?: string; lines: Record<string, { file: string; hash: string; ms?: number }> }
const EMPTY: VoiceManifest = { version: 1, lines: {} };

let manifestP: Promise<VoiceManifest> | null = null;
/** gömülü ses listesi (bir kez yüklenir; yoksa boş) */
export function voiceManifest(): Promise<VoiceManifest> {
  if (!manifestP) {
    manifestP = (async () => {
      try {
        const p = platform();
        const raw = p.voiceManifest ? await p.voiceManifest() : await fetch(voiceUrl('manifest.json')).then((r) => (r.ok ? r.text() : null));
        const m = raw ? (JSON.parse(raw) as VoiceManifest) : null;
        return m && typeof m === 'object' && m.lines && typeof m.lines === 'object' ? m : EMPTY;
      } catch { return EMPTY; }
    })();
  }
  return manifestP;
}
/** platform değişince (mobil köprü kurulunca) listeyi yeniden oku */
export function resetVoiceManifest() { manifestP = null; }

function voiceUrl(file: string): string {
  try { return new URL(`voice/${file}`, document.baseURI).href; } catch { return `voice/${file}`; }
}

/** bu satır için çalınabilir kayıt (yoksa null) */
export async function recordedFile(id: string | undefined, text: string): Promise<string | null> {
  if (!id) return null;
  const e = (await voiceManifest()).lines[id];
  return e && e.hash === textHash(text) ? e.file : null;
}

// ---- tarayıcı oynatıcısı: tek öğe (iOS Safari yalnız dokunuşla açılmış öğeye sonradan çalma izni verir)
let el: HTMLAudioElement | null = null;
const SILENT = 'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YaAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
function audioEl(): HTMLAudioElement | null {
  if (el) return el;
  try { if (typeof Audio === 'undefined') return null; el = new Audio(); el.preload = 'auto'; return el; } catch { return null; }
}
let unlocked = false;
/** ilk dokunuşta sessiz bir klip çal: sonraki anlatıcı satırları dokunuşsuz da çalabilsin */
export function unlockVoice() {
  if (unlocked || platform().playVoice) return;
  const a = audioEl(); if (!a) return;
  unlocked = true;
  try { a.src = SILENT; a.muted = true; void a.play().then(() => { a.pause(); a.muted = false; }, () => { a.muted = false; unlocked = false; }); } catch { unlocked = false; }
}
if (typeof document !== 'undefined') {
  const once = () => { unlockVoice(); if (unlocked) { document.removeEventListener('pointerdown', once, true); document.removeEventListener('touchend', once, true); } };
  document.addEventListener('pointerdown', once, true); document.addEventListener('touchend', once, true);
}

function playWeb(file: string, volume: number, isLive: () => boolean): Promise<boolean> {
  const a = audioEl(); if (!a) return Promise.resolve(false);
  return new Promise((resolve) => {
    let started = false; let settled = false;
    const end = (ok: boolean) => { if (settled) return; settled = true; a.removeEventListener('ended', onEnd); a.removeEventListener('error', onErr); a.removeEventListener('pause', onPause); resolve(ok); };
    const onEnd = () => end(true);
    const onErr = () => end(started);
    const onPause = () => { if (!isLive()) end(true); };
    a.addEventListener('ended', onEnd); a.addEventListener('error', onErr); a.addEventListener('pause', onPause);
    try {
      a.muted = false; a.volume = Math.max(0, Math.min(1, volume)); a.src = voiceUrl(file);
      void a.play().then(() => { started = true; if (!isLive()) { a.pause(); end(true); } }, () => end(false));
    } catch { end(false); }
  });
}

// ---- konuşma
let token = 0;
const DUCK = 0.3;
const duckOn = () => { try { audio.duck(900, DUCK); } catch { /* yok */ } };
const duckOff = () => { try { audio.duck(0, 1); } catch { /* yok */ } };

/** Tüy Dede bu satırı söyler (kayıt varsa kayıt, yoksa cihaz sesi). Ayar kapalıysa sessiz; altyazı her zaman ekranda.
 *  Dönen sayı bu konuşmanın kimliğidir: stopVoiceIf(kimlik) yalnız hâlâ bu satır konuşuluyorsa susturur. */
export function speakLine(text: string, id?: string): number {
  stopVoice();
  const s = useStore.getState();
  if (!s.sounds || !s.narratorVoice) return token;
  const my = ++token; const live = () => my === token;
  const volume = Math.max(0.2, Math.min(1, s.sfxVol ?? 0.9));
  duckOn();
  void (async () => {
    let played = false;
    try {
      const file = await recordedFile(id, text);
      if (!live()) return;
      if (file) {
        const p = platform();
        played = p.playVoice ? await p.playVoice(file, volume).catch(() => false) : await playWeb(file, volume, live);
      }
      if (!live()) return;
      if (!played) await platform().speak(stripEmoji(text).replace(/[“”"]/g, ''), { rate: NARRATOR_TTS.rate, pitch: NARRATOR_TTS.pitch });
    } catch { /* ses yok: altyazı yeter */ }
    if (live()) duckOff();
  })();
  return my;
}

/** yalnız verilen konuşma sürüyorsa sus (bir notun kapanması sonraki anlatıcı satırını kesmesin) */
export function stopVoiceIf(id: number) { if (id === token) stopVoice(); }

/** hemen sus (ileri / atla / ekran değişti) */
export function stopVoice() {
  token++;
  try { if (el && !el.paused) el.pause(); } catch { /* yok */ }
  const p = platform();
  try { p.stopVoice?.(); } catch { /* yok */ }
  try { p.stopSpeaking(); } catch { /* yok */ }
  duckOff();
}
