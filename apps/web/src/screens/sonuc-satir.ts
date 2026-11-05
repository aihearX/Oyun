import { timeBonus, type LevelSpec, type RunResult } from '@odi/shared';
import { achievementById, achievementName, cosmeticById, type RewardItem } from '@odi/content';
import { sureYazi, type EarnLine, type RunSummary } from '@odi/meta';
import { itemPrefix, itemView } from '../celebrate/CelebrationLayer';

/**
 * Süre kutusunun alt yazısı. Süreli bölümde yıldızı hedef süre belirler: yalnız "süre" (OT-rekabetci-2). Öbürlerinde
 * `parTimeSec` süre bonusunun ölçüsüdür (shared timeBonus, scoreRun'daki hesap): bonus alındıysa gerçek değeri ve neye
 * eklendiği ("skora +20 süre bonusu"), kaçtıysa kaç saniyeyle ("113 sn'yi 1 sn kaçırdın"; OT-eski-telefon-34: "113 sn altı bonus"
 * 114 sn'de alınıp alınmadığını söylemiyordu). Kayıpta bonus yoktur: yalnız "süre". Yazı kısa: 360 px'te tek satır (kutular
 * büyüyüp kayıpta neden/yardım kartını ilk ekrandan itmesin). "par" kelimesi oyuncuya yazılmaz, "para" sanıldı (OT-ilk-kez-oyun-54).
 */
export function sureAlt(spec: Pick<LevelSpec, 'objective' | 'parTimeSec'>, r: Pick<RunResult, 'completed' | 'timeSec'>): string {
  if (spec.objective.id === 'timed' || !r.completed) return 'süre';
  const par = spec.parTimeSec; const bonus = timeBonus(spec, r);
  if (bonus > 0) return `skora +${bonus.toLocaleString('tr-TR')} süre bonusu`;
  return r.timeSec > par ? `${par}\u00a0sn'yi ${sureYazi(r.timeSec - par)}\u00a0sn kaçırdın` : `süre bonusu yok (tam ${par}\u00a0sn)`;
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
 * Hazine satırı jeton dışındakileri de söyler (OT-sinav-adayi-36): haritadaki hazine penceresiyle aynı adlar ve önek (celebrate itemView,
 * itemPrefix; aynı defter kaydı `hazine:N`): "Ayrıca: +60 XP", "Ayrıca: ×1 Seri koruyucu", "Ayrıca: Kulaklık". Jeton tutarı ve toplam
 * değişmez.
 */
export function hazineNotu(items: readonly RewardItem[]): string {
  const rest = items.filter((i) => i.kind !== 'jeton').map((i) => { const v = itemView(i); return v.amount == null ? v.name : `${itemPrefix(i)}${v.amount.toLocaleString('tr-TR')} ${v.name}`; });
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

/**
 * Oyuncu Seviye penceresinin listesi: yalnız oyuncu seviyesiyle gerçekten açılanlar (seviye koşullu kozmetik, "Seviye N ol"
 * başarımı). Bu bölümün hazinesi, öteki başarımlar, kart, Şanslı Nota ve yeni hareket bölümün kendi kazancıdır, sonuç kartında
 * yazar; pencerede seviyeyle açılmış gibi görünmesin (YN-229, OT-ogrenci-birinci-46; YN-050 ailesi). Boşsa pencerede liste yok.
 */
export function seviyeAcilanlar(s: Pick<RunSummary, 'events'>): string[] {
  const out: string[] = [];
  for (const e of s.events) {
    if (e.kind === 'cosmetic') { const c = cosmeticById(e.id); if (c?.unlock.by === 'level') out.push(`Dolaba yeni: ${c.name}`); }
    else if (e.kind === 'achievement') { const a = achievementById(e.id); if (a?.metric === 'playerLevel') out.push(`Başarım: ${achievementName(a, e.tier)}`); }
  }
  return out;
}
