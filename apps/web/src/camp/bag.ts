/**
 * Çanta: bölüm kartında Tedavi Odası malzemelerinden seçilenler (docs/14-kamp.md).
 * Seçim bu cihazda hatırlanır (kolaylık; localStorage); gerçek envanter sunucudadır (camp.remedy.inv) ve seçim her zaman
 * envantere ve çanta yerine göre kırpılır. Malzeme bölüme verilir (LevelOptions.remedies); yalnız KULLANILAN adet
 * progress.submit ile envanterden düşer — kullanılmayan kaybolmaz.
 */
import { create } from 'zustand';
import { useNet } from '@odi/net/store';
import { carrySlots, remedyById } from '@odi/content';
import type { CampState } from '@odi/shared';

const KEY = 'odi.canta';
function load(): Record<string, number> {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown; if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k, n]) => remedyById(k) && typeof n === 'number' && n > 0).map(([k, n]) => [k, Math.floor(n as number)])); } catch { /* gizli mod */ }
  return {};
}
export const useBag = create<{ pick: Record<string, number> }>()(() => ({ pick: load() }));
function save(pick: Record<string, number>) { useBag.setState({ pick }); try { localStorage.setItem(KEY, JSON.stringify(pick)); } catch { /* gizli mod */ } }

export const campLevel = (camp: CampState | null | undefined, id: string) => camp?.buildings.find((b) => b.id === id)?.level ?? 0;
export function slotsOf(camp: CampState | null | undefined): number { return carrySlots({ tedavi: campLevel(camp, 'tedavi'), merkez: campLevel(camp, 'merkez') }); }

/** seçim, envanter ve çanta yerine göre kırpılmış (sıra: seçim sırası) */
export function bagList(camp: CampState | null | undefined, pick = useBag.getState().pick): { id: string; count: number }[] {
  const inv = camp?.remedy?.inv ?? {}; let left = slotsOf(camp); const out: { id: string; count: number }[] = [];
  for (const [id, n] of Object.entries(pick)) {
    const c = Math.min(n, inv[id] ?? 0, left); if (c <= 0) continue;
    out.push({ id, count: c }); left -= c; if (left <= 0) break;
  }
  return out;
}
export const bagTotal = (l: { count: number }[]) => l.reduce((a, b) => a + b.count, 0);

/** çantaya bir tane ekle / çıkar (kırpma kuralına uyar) */
export function bagAdd(id: string, camp: CampState | null | undefined): boolean {
  const cur = Object.fromEntries(bagList(camp).map((x) => [x.id, x.count]));
  if (bagTotal(bagList(camp)) >= slotsOf(camp)) return false;
  if ((cur[id] ?? 0) >= (camp?.remedy?.inv?.[id] ?? 0)) return false;
  save({ ...cur, [id]: (cur[id] ?? 0) + 1 }); return true;
}
export function bagRemove(id: string, camp: CampState | null | undefined): void {
  const cur = Object.fromEntries(bagList(camp).map((x) => [x.id, x.count]));
  const n = (cur[id] ?? 0) - 1; if (n > 0) cur[id] = n; else delete cur[id];
  save(cur);
}
export const bagClear = () => save({});

/** bölüm başlarken: LevelOptions.remedies (çanta boşsa ya da kamp yoksa undefined) */
export function takeRemedies(): { id: string; count: number }[] | undefined {
  const l = bagList(useNet.getState().camp);
  return l.length ? l : undefined;
}
