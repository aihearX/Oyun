import { DELETED_PLAYER_NAME } from '@odi/shared';

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
