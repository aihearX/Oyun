import type { MechanicId } from '@odi/shared';

export interface MechanicDef { id: MechanicId; name: string; hint: string; icon: string }
export const MECHANICS: Record<MechanicId, MechanicDef> = {
  kosu: { id: 'kosu', name: 'Koşu', hint: 'Dokun: zıpla · Basılı tut: yüksek · Aşağı kaydır: kay · Ters yöne kaydır: geri dön · Duvara değince dokun: karşıya zıpla', icon: '🏃' },
  yuzme: { id: 'yuzme', name: 'Yüzme', hint: 'Sıvıda basılı tut: yüksel · Bırak: dal · Diyapazonla kapının rengini eşle', icon: '🫧' },
  trambolin: { id: 'trambolin', name: 'Zar ve Süzülme', hint: 'Zara değdiğin an dokun · Havada basılı tut: süzül · Ritim platformları vuruşla belirir', icon: '🥁' },
  makine: { id: 'makine', name: 'Kanca ve Çakılma', hint: 'Kancanın yanında basılı tut: sallan, bırak: fırla · Havada aşağı kaydır: çakıl', icon: '⚙️' },
  impuls: { id: 'impuls', name: 'Ses Darbesi', hint: 'Koşu yönüne kaydır: atıl · Ters yöne kaydır: geri dön · Gürültü duvarını kır · Yankı yollarını görünür kıl', icon: '⚡' },
  ruya: { id: 'ruya', name: 'Yerçekimi', hint: 'Mor bölgede dokun: yerçekimini çevir', icon: '🌀' },
  boss: { id: 'boss', name: 'Canavar', hint: 'Zayıf noktasına vur, saldırısını atlat', icon: '👹' },
};
