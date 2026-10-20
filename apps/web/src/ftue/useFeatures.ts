import { useStore } from '../store';
import { clearedCount, isOpen, lockText, featureById, type FeatureId } from './features';

/** bileşenler için: hangi yerler açık, kilitliyse ne zaman açılır */
export function useFeatures() {
  const progress = useStore((s) => s.progress); const ftue = useStore((s) => s.ftue);
  const cleared = clearedCount(progress);
  return {
    cleared,
    open: (id: FeatureId) => isOpen(id, cleared, ftue),
    at: (id: FeatureId) => featureById(id).at,
    lock: (id: FeatureId) => lockText(id),
  };
}
/** bileşen dışı (olay işleyicileri) */
export function featureOpen(id: FeatureId): boolean {
  const s = useStore.getState(); return isOpen(id, clearedCount(s.progress), s.ftue);
}
