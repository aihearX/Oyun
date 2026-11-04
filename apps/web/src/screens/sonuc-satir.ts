import type { LevelSpec, RunResult } from '@odi/shared';
import type { RewardItem } from '@odi/content';
import type { EarnLine } from '@odi/meta';
import { itemView } from '../celebrate/CelebrationLayer';

/**
 * Süre kutusunun alt yazısı. Süreli bölümde yıldızı hedef süre belirler: yalnız "süre" (OT-rekabetci-2). Öbürlerinde
 * `parTimeSec` süre bonusunun ölçüsüdür (shared scoreRun: altında kalan her saniye puan): "120 sn altı bonus". "par" kelimesi
 * oyuncuya yazılmaz, "para" sanıldı (OT-ilk-kez-oyun-54).
 */
export function sureAlt(spec: Pick<LevelSpec, 'objective' | 'parTimeSec'>): string {
  return spec.objective.id === 'timed' ? 'süre' : `${spec.parTimeSec} sn altı bonus`;
}

/**
 * Melodi bölümünün satırı (OT-sinav-adayi-35), koşunun kendi sayısından (LevelScene extra.melody / melodyTotal): "Melodi tamam"
 * ya da "Melodi: 5/7 sırayla". Sayı yoksa yalnız geçişte hedefin tutup tutmadığı; kayıpta sayı yoksa satır yok (bilinmeyen yazılmaz).
 */
export function melodiSatir(spec: Pick<LevelSpec, 'objective'>, r: Pick<RunResult, 'completed' | 'objectiveMet' | 'extra'>): string | null {
  if (spec.objective.id !== 'melody') return null;
  const n = r.extra?.melody; const t = r.extra?.melodyTotal ?? spec.objective.target;
  if (typeof n === 'number' && typeof t === 'number' && t > 0) return n >= t ? 'Melodi tamam' : `Melodi: ${n}/${t}\u00a0sırayla`;
  if (!r.completed) return null;
  return r.objectiveMet ? 'Melodi tamam' : 'Melodi tamamlanmadı';
}

/**
 * Hazine satırı jeton dışındakileri de söyler (OT-sinav-adayi-36): haritadaki hazine penceresiyle aynı adlar (celebrate itemView,
 * aynı defter kaydı `hazine:N`): "Ayrıca: ×1 Seri koruyucu", "Ayrıca: Kulaklık". Jeton tutarı ve toplam değişmez.
 */
export function hazineNotu(items: readonly RewardItem[]): string {
  const rest = items.filter((i) => i.kind !== 'jeton').map((i) => { const v = itemView(i); return v.amount == null ? v.name : `×${v.amount.toLocaleString('tr-TR')} ${v.name}`; });
  return rest.length ? `Ayrıca: ${rest.join(' · ')}` : '';
}
/** "Bu bölümden" dökümünde hazine satırına bu koşunun hazine kaydındaki jeton dışı ödüller (earnLines yalnız jetonu sayar) */
export function hazineNotlu(lines: EarnLine[], grants: readonly { reason: string; items: RewardItem[] }[]): EarnLine[] {
  return lines.map((l) => {
    const n = /^Bölüm (\d+) hazinesi$/.exec(l.label)?.[1]; if (!n) return l;
    const note = hazineNotu(grants.find((g) => g.reason === `hazine:${n}`)?.items ?? []);
    return note ? { ...l, note } : l;
  });
}
