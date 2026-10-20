import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { VOICE_FILES } from './files';

/**
 * Tüy Dede'nin kayıtlı sesleri: uygulama paketindeki dosyaları yerel oynatıcıyla çalar (WebView'in otomatik oynatma
 * kısıtlarına takılmaz). Web arayüzü (Expo DOM) köprü üzerinden ister: voiceManifest → playVoice(file) → stopVoice.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MANIFEST = require('../../../web/public/voice/manifest.json') as { lines?: Record<string, unknown> };

export async function voiceManifest(): Promise<string | null> {
  try { return JSON.stringify(MANIFEST); } catch { return null; }
}

let current: { player: AudioPlayer; done: (ok: boolean) => void } | null = null;

/** dosyayı çal; bitince (ya da kesilince) true, dosya yoksa/çalınamazsa false */
export function playVoice(file: string, volume: number): Promise<boolean> {
  stopVoice();
  const src = VOICE_FILES[file];
  if (src == null) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return; settled = true;
      try { sub?.remove(); } catch { /* yok */ }
      try { player.remove(); } catch { /* yok */ }
      if (current?.player === player) current = null;
      resolve(ok);
    };
    let player: AudioPlayer; let sub: { remove(): void } | undefined;
    try {
      player = createAudioPlayer(src);
      player.volume = Math.max(0, Math.min(1, volume));
      sub = player.addListener('playbackStatusUpdate', (st) => { if (st.didJustFinish) done(true); });
      current = { player, done };
      player.play();
      // güvenlik: durum olayı hiç gelmezse (bozuk dosya) takılı kalma
      setTimeout(() => done(true), 30_000);
    } catch { resolve(false); }
  });
}

export function stopVoice() {
  const c = current; current = null;
  if (!c) return;
  try { c.player.pause(); } catch { /* yok */ }
  c.done(true);
}
