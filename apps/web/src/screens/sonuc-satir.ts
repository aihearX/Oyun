import { noteThresholds, timeBonus, type LevelSpec, type RunResult } from '@odi/shared';
import { achievementById, achievementName, cosmeticById, type RewardItem } from '@odi/content';
import type { EarnLine, RunSummary } from '@odi/meta';
import { itemPrefix, itemView } from '../celebrate/CelebrationLayer';

/**
 * Süre kutusunun alt yazısı. Süreli bölümde yıldızı hedef süre belirler: yalnız "süre" (OT-rekabetci-2). Öbürlerinde
 * `parTimeSec` süre bonusunun ölçüsüdür (shared timeBonus, scoreRun'daki hesap): bonus alındıysa gerçek değeri ve neye
 * eklendiği ("skora +20 süre bonusu"), kaçtıysa suçlamadan ne olduğu ve neyle geldiği ("süre bonusu yok (113 sn altında gelir)";
 * OT-eski-telefon-34: "113 sn altı bonus" 114 sn'de alınıp alınmadığını söylemiyordu; OT-ilk-kez-oyun-79: "90 sn'yi 11 sn kaçırdın"
 * hedefi süre olmayan 3 yıldızlı bölümde ödül kaybedildi sanıldı). Kayıpta bonus yoktur: yalnız "süre". Yazı kısa (kutular
 * büyüyüp kayıpta neden/yardım kartını ilk ekrandan itmesin). "par" kelimesi oyuncuya yazılmaz, "para" sanıldı (OT-ilk-kez-oyun-54).
 */
export function sureAlt(spec: Pick<LevelSpec, 'objective' | 'parTimeSec'>, r: Pick<RunResult, 'completed' | 'timeSec'>): string {
  if (spec.objective.id === 'timed' || !r.completed) return 'süre';
  const par = spec.parTimeSec; const bonus = timeBonus(spec, r);
  if (bonus > 0) return `skora +${bonus.toLocaleString('tr-TR')} süre bonusu`;
  return r.timeSec > par ? `süre bonusu yok (${par}\u00a0sn altında gelir)` : `süre bonusu yok (tam ${par}\u00a0sn)`;
}

/** bölüm hedefinin tuttuğunu söyleyen baş (yıldız sırası cümlesi); hedefin adı objectives.ts'deki etiketlerle aynı */
const HEDEF_TUTTU: Partial<Record<LevelSpec['objective']['id'], string>> = {
  'no-damage': 'Hasarsız bitirdin', secret: 'Altın kokleaların hepsini buldun', melody: 'Notaları sırayla topladın', escort: 'Fısıltıyı kapıya götürdün',
};
/**
 * Yıldızlar sırayla gelir (shared scoreRun: 3★ 2★'ın üstüne): bölüm hedefi tuttuğu hâlde 2. yıldız eksikse tek yıldız kalır ve
 * yalnız 2. yıldızın kartı görünür; oyuncu hasarsız bitirip neden yıldız gelmediğini anlamıyordu (OT-ilk-kez-oyun-78). Yıldızların
 * altındaki tek cümle bunu söyler: "Hasarsız bitirdin: 3. yıldızın hedefi var, ama önce 2. yıldız gerekir (58 nota, 12 eksik)."
 * 3. yıldızın hedefli koşulunda nota da vardır ("hiç hasar alma ve 58 nota"): koşulun tamamı tutmadıkça "tamam" denmez, tutan
 * yarı "var", eksik olan "eksik" (YN-262, OT-buyuk-yazi-74). Eşikler yıldız kuralıyla aynı yerden (noteThresholds); yüzmede 2★ %45
 * notayla gelir ama hedefle 3★ %60 ister: o zaman ikisi de yazılır. Süreli bölümde hedef süre 3★'ı tek başına verir, "Tüm notaları
 * topla" 2★'ın üstündedir, notasız bölümde hasarsız 3★'dır: bu durumlar oluşmaz, cümle yok (null).
 */
export function yildizSirasi(spec: Pick<LevelSpec, 'mechanic' | 'objective' | 'coinsTotal'>, r: Pick<RunResult, 'completed' | 'stars' | 'coins' | 'objectiveMet' | 'rahat'>): string | null {
  const lead = HEDEF_TUTTU[spec.objective.id];
  const th = noteThresholds(spec);
  if (!lead || !r.completed || r.rahat || r.stars !== 1 || !r.objectiveMet || spec.coinsTotal <= 0 || th.star3Objective === null) return null;
  const notesAt = (q: number) => Math.ceil(spec.coinsTotal * q - 1e-9);
  const n2 = notesAt(th.star2); const need = Math.max(n2, notesAt(th.star3Objective));
  if (r.coins >= need) return null;
  const eksik = `${need - r.coins}\u00a0eksik`;
  return need === n2 ? `${lead}: 3. yıldızın hedefi var, ama önce 2. yıldız gerekir (${n2}\u00a0nota, ${eksik}).`
    : `${lead}: 3. yıldızın hedefi var, ama önce 2. yıldız (${n2}\u00a0nota) ve hedefle ${need}\u00a0nota gerekir (${eksik}).`;
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
