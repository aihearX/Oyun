/**
 * Kampın Hikâyesi'nin şu an istediği bina (MK-016): açık bölümün tamamlanmamış ilk "bina:<id>" adımı.
 * Bina panelinde ve listede küçük bir not olarak gösterilir; oyuncu sırayı en ucuz binaya değil hikâyeye göre seçebilsin.
 * Bilgi verir, zorlamaz (sahte aciliyet yok).
 */
import type { BuildingId, KgState } from '@odi/shared';
import { KG_HIKAYE } from '@odi/content';

export interface HikayeBina { id: BuildingId; need: number; bolum: string }

export function hikayeBinasi(kg: Pick<KgState, 'story'> | null | undefined): HikayeBina | null {
  const ch = kg?.story.chapter;
  if (!ch || ch.done) return null;
  const def = KG_HIKAYE.find((b) => b.no === ch.no);
  if (!def) return null;
  for (const step of ch.steps) {
    if (step.done) continue;
    const sd = def.steps.find((s) => s.id === step.id);
    if (sd && sd.olcut.startsWith('bina:')) return { id: sd.olcut.slice(5) as BuildingId, need: sd.need, bolum: def.title };
  }
  return null;
}
