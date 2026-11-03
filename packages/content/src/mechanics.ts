import type { MechanicId } from '@odi/shared';

export interface MechanicDef { id: MechanicId; name: string; hint: string; icon: string }
/**
 * hint: her madde "ne yaparsan ne olur" (OT-ilk-kez-oyun-37), mekaniğin sim kuralına göre (game-core play/sim.ts); bölgeyi görünen
 * işaretiyle anar, yalnız rengiyle değil (OT-buyuk-yazi-36: yerçekimi bölgesi oklu ve kesik kenarlı).
 */
export const MECHANICS: Record<MechanicId, MechanicDef> = {
  kosu: { id: 'kosu', name: 'Koşu', hint: 'Dokun: zıpla · Basılı tut: yüksek · Aşağı kaydır: kay · Ters yöne kaydır: geri dön · Duvara değince dokun: karşıya zıpla', icon: '🏃' },
  yuzme: { id: 'yuzme', name: 'Yüzme', hint: 'Sıvıda basılı tut: yüksel · Bırak: dal · Diyapazonla kapının rengini eşle', icon: '🫧' },
  trambolin: { id: 'trambolin', name: 'Zar ve Süzülme', hint: 'Zara değdiğin an dokun · Havada basılı tut: süzül · Ritim platformu her vuruşta parlar: doluyken bas, kesik çizgiliyken basma', icon: '🥁' },
  makine: { id: 'makine', name: 'Kanca ve Çakılma', hint: 'Kancanın yanında basılı tut: sallan, bırak: fırla · Havada aşağı kaydır: yere çakıl (hızla in)', icon: '⚙️' },
  impuls: { id: 'impuls', name: 'Ses Darbesi', hint: 'Koşu yönüne kaydır: ileri fırla · Ters yöne kaydır: geri dön · Gürültü duvarına fırlayarak çarp: kırılır · Fırlayınca gizli yankı yolları 3 saniye belirir: üstüne bas', icon: '⚡' },
  ruya: { id: 'ruya', name: 'Yerçekimi', hint: 'Oklu mor bölgede dokun: yerçekimini çevir', icon: '🌀' },
  // simge: hedef (zayıf noktasına vur); korkutucu canavar yüzü değil (OT-ilk-kez-oyun-22). Nasıl vurulacağını söyler (OT-ilk-kez-oyun-46):
  // iki canavarda da zayıf nokta (saplanan yumruk, inen kalp) çakılmayla vurulur (play/boss.ts)
  boss: { id: 'boss', name: 'Canavar', hint: 'Zayıf noktası açılınca havadan aşağı kaydırıp üstüne in · Saldırıdan önceki uyarıyı görünce kaç', icon: '🎯' },
};
