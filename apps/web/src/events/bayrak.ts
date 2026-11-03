import { DELETED_PLAYER_NAME } from '@odi/shared';

const sn = (s: number) => `${s.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} sn`;

/**
 * Bayrak koşusu sonuç kartının metni (OT-buyuk-yazi-48): rekor kırıldıysa parkura bu süre sayılır; kırılmadıysa sunucunun yanıttaki
 * rekoruyla karşılaştırma ("Rekor 46,9 sn · senin koşun 47,1 sn: 0,2 sn kala geçemedin"), parkurda rekor kalır.
 */
export function relayRunText(timeSec: number, improved: boolean, record: { name: string; timeSec: number } | null): string {
  if (improved || !record) return 'Ayağın en iyi süresi senin: parkura bu süre sayılır.';
  const who = record.name === DELETED_PLAYER_NAME ? 'hesabı silinmiş bir oyuncu' : record.name;
  const gap = Math.round((timeSec - record.timeSec) * 10) / 10;
  const how = gap > 0 ? `${sn(gap)} kala geçemedin` : 'rekora eşit; geçmek için daha hızlı koşmalısın';
  return `Rekor ${sn(record.timeSec)} (${who}) · senin koşun ${sn(timeSec)}: ${how}. Parkura rekor sayılmaya devam ediyor.`;
}
