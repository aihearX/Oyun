import { PATOLOJILER, type PatolojiId } from '@odi/content';
import { speakWhenFree } from './voice';

/** bölge patolojisinin Tüy Dede cümlesinin kayıt kimliği (tools/voice/generate.mjs aynı adı üretir) */
export const pathologyLineId = (id: string) => `pat-${id}`;

/**
 * Bölümde bir patoloji İLK KEZ görüldü (GameEvent `pathology`, first): Tüy Dede'nin cümlesini sesli söyler.
 * Oyunu durdurmaz; konuşurken müzik kısılır (ses motoru); başka bir anlatıcı satırı sürüyorsa üstüne binmez, kısa bir süre
 * sırada bekler (en çok ~9 sn: en uzun cümle 7,7 sn), gecikirse atlanır (yazısı zaten ekranda). Genel ses / "Anlatıcı sesi" ayarına uyar.
 */
export function sayPathology(id: string): { cancel(): void } | null {
  const P = PATOLOJILER[id as PatolojiId];
  if (!P) return null;
  return speakWhenFree(P.sade, pathologyLineId(P.id), 9000);
}
