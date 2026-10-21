import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { TuyDede } from '../ftue/Narrator';
import { lineText } from '../ftue/script';
import { speakLine, stopVoiceIf } from '../ftue/voice';
import { MoreLine } from '../ftue/Notes';
import { Icon } from '../ui/icons';

/**
 * Kampta Tüy Dede'nin tek satırı: bina yükselince (dönüşümlü satır), anıt yükselince ya da anıta dokununca.
 * Hiçbir şeyi engellemez, kapatılabilir; kayıtlı ses varsa kayıt, yoksa cihaz sesi (ayar kapalıysa sessiz, altyazı ekranda).
 */
export interface DedeSay { id?: string; text: string; kicker: string; tech?: string; key: number; /** seslendirilsin mi (dokunuşla açılan bilgi kartları sessizdir) */ voice: boolean }
export const useDede = create<{ say: DedeSay | null }>()(() => ({ say: null }));
let seq = 0;
/** anlatıcı satırı (script.ts kimliği) */
export function sayDede(lineId: string, kicker: string, tech?: string): void {
  let text: string;
  try { text = lineText(lineId); } catch { return; }
  useDede.setState({ say: { id: lineId, text, kicker, tech, key: ++seq, voice: true } });
}
/** serbest metin (anıt bilgisi gibi; sessiz) */
export function showDede(text: string, kicker: string, tech?: string): void { useDede.setState({ say: { text, kicker, tech, key: ++seq, voice: false } }); }
export const hushDede = () => useDede.setState({ say: null });

export function DedeCard({ className = '' }: { className?: string }) {
  const say = useDede((s) => s.say);
  const talk = useRef(-1);
  useEffect(() => {
    if (!say) return;
    if (say.voice) talk.current = speakLine(say.text, say.id);
    // uzun süre açık kalmasın (dokunmadan da kaybolur)
    const h = setTimeout(() => useDede.setState((s) => (s.say?.key === say.key ? { say: null } : {})), say.tech ? 16_000 : 11_000);
    return () => { clearTimeout(h); stopVoiceIf(talk.current); };
  }, [say?.key]);
  if (!say) return null;
  return (
    <aside key={say.key} className={`ear-note dede-card ${className}`} data-testid="kamp-dede" data-line={say.id ?? ''} onClick={(e) => e.stopPropagation()} aria-live="polite" aria-label="Tüy Dede">
      <span className="en-face" aria-hidden><TuyDede size={46} talking={false} mood="wink" /></span>
      <div className="en-body">
        <div className="en-k">{say.kicker}</div>
        <p className="en-plain">{say.text}</p>
        {say.tech && <MoreLine text={say.tech} />}
      </div>
      <button type="button" className="en-x" aria-label="Kapat" onClick={() => { stopVoiceIf(talk.current); hushDede(); }}><Icon name="close" size="0.95em" /></button>
    </aside>
  );
}
