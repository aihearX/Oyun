import { useStore } from '../store';
import { hasLine, lineText } from './script';
import { speakWhenFree } from './voice';

/**
 * Bölüm içi ipuçlarından Tüy Dede'nin sesli söylediği küçük bir seçki (GameEvent 'hint'; kimlikler game-core bridge.ts →
 * HINT_IDS ve öğretici anlar `ogret-<yetenek>`). Geveze olmasın diye yalnız: her yeteneğin ilk öğretici anı, 5. bölümün
 * kayma tazelemesi ve (kayma öğrenildikten sonraki bölümde) ilk kıl perdesi. Her biri OYUNCU BAŞINA BİR KEZ (FTUE kaydında `said`); oyun durmaz, başka satırın
 * üstüne binmez (sıra), genel ses / "Anlatıcı sesi" ayarına uyar. Ekrandaki yazı oyunundur; ses aynı anlamda kısa bir cümle.
 */
export const VOICED_HINTS = ['tazele-kayma', 'perde-kay'] as const;
/** ipucunun anlatıcı satırı kimliği (script.ts `ipucu-<ipucu kimliği>`) */
export const hintLineId = (hintId: string) => `ipucu-${hintId}`;
export function isVoicedHint(hintId: string): boolean {
  return ((VOICED_HINTS as readonly string[]).includes(hintId) || hintId.startsWith('ogret-')) && hasLine(hintLineId(hintId));
}

/** bölüm başında söylenmiş satırlar (LevelHost bölüm kurulurken alır; "önceki bölümde söylendi mi" kuralı için) */
export const saidSoFar = (): readonly string[] => [...(useStore.getState().ftue.said ?? [])];
/**
 * Bir ipucu, ancak şu satır DAHA ÖNCEKİ bir bölümde söylendiyse seslenir: kıl perdesi ipucu kaymayı öğreten satırdan sonra
 * gelir (3. bölümde öğretici ve perde ipucu art arda iki kayma talimatı olmasın; perde sesi ilk kez sonraki bölümde).
 */
const AFTER: Record<string, string> = { 'perde-kay': hintLineId('ogret-kayma') };

/** ipucu olayı geldi: seçkideyse ve bu oyuncu daha önce duymadıysa söyle (ayar kapalıysa hiç; işaretlenmez).
 *  `before`: bölüm başındaki `saidSoFar()` (verilmezse şimdiki kayıt). */
export function sayHint(hintId: string, before?: readonly string[]): { cancel(): void } | null {
  if (!isVoicedHint(hintId)) return null;
  const st = useStore.getState();
  if (!st.sounds || !st.narratorVoice) return null;
  const id = hintLineId(hintId);
  const said = st.ftue.said ?? [];
  if (said.includes(id)) return null;
  const need = AFTER[hintId];
  if (need && !(before ?? said).includes(need)) return null;
  useStore.setState({ ftue: { ...st.ftue, said: [...said, id] } });
  return speakWhenFree(lineText(id), id, 6000);
}

/**
 * Tek seferlik anlatıcı anı (bölüm dışı; ör. kampta "Sıraya al" düğmesi ilk kez görününce `kamp-sira-01`): bu oyuncu satırı daha
 * önce görmediyse FTUE kaydına (`said`) yazar ve true döner; görmüşse false. Kayıt kalıcıdır (yeniden açılışta tekrar gelmez),
 * Sıfırla siler. Ses ayarından bağımsız sayılır: kart yazılı görünür, ses "Anlatıcı sesi" ayarına uyar.
 */
export function claimOnce(lineId: string): boolean {
  const st = useStore.getState(); const said = st.ftue.said ?? [];
  if (said.includes(lineId)) return false;
  useStore.setState({ ftue: { ...st.ftue, said: [...said, lineId] } });
  return true;
}
