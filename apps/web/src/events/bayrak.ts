import { DELETED_PLAYER_NAME, type RelayLeg } from '@odi/shared';

/** Bayrak süreleri hep tek ondalıklı ("83,0 sn", "72,7 sn"): yan yana iki süre aynı biçimde okunur (OT-rekabetci-40) */
export const fmtSecs = (s: number) => `${s.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} sn`;

/**
 * Bayrak koşusu sonuç kartının metni (OT-buyuk-yazi-48, OT-rekabetci-40): rekor kırıldıysa parkura bu süre sayılır; kırılmadıysa önce
 * oyuncunun süresi, sonra sunucunun yanıttaki rekoru ve fark ("Senin koşun 83,0 sn · rekor 72,7 sn (Ayşe): 10,3 sn farkla geçemedin");
 * parkurda rekor kalır. "kala" kalan süre gibi okunuyordu. Fark ekranda yazan (yuvarlanmış) iki süreden hesaplanır.
 */
export function relayRunText(timeSec: number, improved: boolean, record: { name: string; timeSec: number } | null): string {
  if (improved || !record) return 'Ayağın en iyi süresi senin: parkura bu süre sayılır.';
  const who = record.name === DELETED_PLAYER_NAME ? 'hesabı silinmiş bir oyuncu' : record.name;
  const gap = (Math.round(timeSec * 10) - Math.round(record.timeSec * 10)) / 10;
  const how = gap > 0 ? `${fmtSecs(gap)} farkla geçemedin` : 'rekora eşit, geçemedin (eşit süre rekoru geçmez)';
  return `Senin koşun ${fmtSecs(timeSec)} · rekor ${fmtSecs(record.timeSec)} (${who}): ${how}. Parkurda rekor süre sayılıyor.`;
}

/**
 * Ayağın altındaki "takımdaki en iyi" satırı (YN-194, OT-rekabetci-43): rekor şimdiki üyelerden birinde değilse (ayrılan ya da hesabı
 * silinen oyuncu) bugünkü takımın en iyi süresi ya da hiç koşulmadığı söylenir; rekor zaten bir üyedeyse satır yok (aynı bilgi).
 * Sunucu `teamBest` göndermiyorsa (eski sunucu) null: sahte sayı yazılmaz.
 */
export function relayTeamBestLine(l: Pick<RelayLeg, 'best' | 'teamBest'>): string | null {
  if (!l.best || l.teamBest === undefined) return null;
  if (!l.teamBest) return 'Takımdaki en iyi: bugünkü üyelerden koşan yok';
  if (l.teamBest.id === l.best.id && l.teamBest.timeSec === l.best.timeSec) return null;
  return `Takımdaki en iyi: ${l.teamBest.name} ${fmtSecs(l.teamBest.timeSec)}`;
}

/** bugünkü takımın (şimdiki üyelerin) koştuğu ayak sayısı; sunucu bilmiyorsa null */
export function relayTeamLegs(legs: Pick<RelayLeg, 'teamBest'>[]): number | null {
  if (legs.some((l) => l.teamBest === undefined)) return null;
  return legs.filter((l) => l.teamBest).length;
}
