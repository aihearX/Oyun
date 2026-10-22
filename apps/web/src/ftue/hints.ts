import { useStore } from '../store';
import { hasLine, lineText } from './script';
import { speakWhenFree } from './voice';

/**
 * Bölüm içi ipuçlarından Tüy Dede'nin sesli söylediği küçük bir seçki (GameEvent 'hint'; kimlikler game-core bridge.ts →
 * HINT_IDS ve öğretici anlar `ogret-<yetenek>`). Geveze olmasın diye yalnız: her yeteneğin ilk öğretici anı, 5. bölümün
 * kayma tazelemesi ve ilk kıl perdesi. Her biri OYUNCU BAŞINA BİR KEZ (FTUE kaydında `said`); oyun durmaz, başka satırın
 * üstüne binmez (sıra), genel ses / "Anlatıcı sesi" ayarına uyar. Ekrandaki yazı oyunundur; ses aynı anlamda kısa bir cümle.
 */
export const VOICED_HINTS = ['tazele-kayma', 'perde-kay'] as const;
/** ipucunun anlatıcı satırı kimliği (script.ts `ipucu-<ipucu kimliği>`) */
export const hintLineId = (hintId: string) => `ipucu-${hintId}`;
export function isVoicedHint(hintId: string): boolean {
  return ((VOICED_HINTS as readonly string[]).includes(hintId) || hintId.startsWith('ogret-')) && hasLine(hintLineId(hintId));
}

/** ipucu olayı geldi: seçkideyse ve bu oyuncu daha önce duymadıysa söyle (ayar kapalıysa hiç; işaretlenmez) */
export function sayHint(hintId: string): { cancel(): void } | null {
  if (!isVoicedHint(hintId)) return null;
  const st = useStore.getState();
  if (!st.sounds || !st.narratorVoice) return null;
  const id = hintLineId(hintId);
  const said = st.ftue.said ?? [];
  if (said.includes(id)) return null;
  useStore.setState({ ftue: { ...st.ftue, said: [...said, id] } });
  return speakWhenFree(lineText(id), id, 6000);
}
