import { REMEDIES } from '@odi/content';

/**
 * Tedavi Odası malzemesinin bölümdeki etkisi (sözleşme: docs/14-kamp.md §4). Her adet, `counters` listesindeki bir patoloji
 * engelinin (props.patoloji; level-gen/src/patoloji.ts) İLK karşılaşmasını bir kez etkisiz kılar: bulut/diken çarpması can
 * götürmez ve engel söner, patoloji çukuruna düşüş can götürmez, patoloji kapısı anahtarsız açılır. Birden çok uygun malzeme
 * varsa en ucuz (en düşük `level`) harcanır; bölüm başına en çok REMEDY_MAX_USES adet. Malzemeler girdinin parçasıdır
 * (InitOpts.remedies): simülasyon deterministik kalır, planlayıcının kopyaları da aynı malzemeyle ileriye bakar.
 * Zorluk ölçümleri ve boşta oyuncu denetimi malzemesiz koşulur.
 */
export const REMEDY_MAX_USES = 4;
export interface RemedyIn { id: string; count: number }

const ORDER = [...REMEDIES].sort((a, b) => a.level - b.level);

/** bilinen kimlikler, pozitif tam sayı adet; bilinmeyenler yok sayılır */
export function initRemedies(list?: RemedyIn[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of list ?? []) if (ORDER.some((d) => d.id === r.id) && r.count > 0) out[r.id] = (out[r.id] ?? 0) + Math.floor(r.count);
  return out;
}

/** bu patolojiye karşı elde kalan en ucuz malzeme (yoksa null) */
export function remedyFor(rem: Record<string, number>, pathology: string): string | null {
  for (const r of ORDER) if ((rem[r.id] ?? 0) > 0 && (r.counters as string[]).includes(pathology)) return r.id;
  return null;
}

export const remedyName = (id: string) => ORDER.find((r) => r.id === id)?.name ?? id;
export const usedTotal = (used: Record<string, number>) => Object.values(used).reduce((a, b) => a + b, 0);
