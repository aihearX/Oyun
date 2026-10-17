import type { MechanicId } from '@odi/shared';

export interface MechanicDef { id: MechanicId; name: string; hint: string; icon: string }
export const MECHANICS: Record<MechanicId, MechanicDef> = {
  kosu: { id: 'kosu', name: 'Koşu', hint: 'Dokun: zıpla · Basılı tut: yüksek · Aşağı kaydır: kay', icon: '🏃' },
  yuzme: { id: 'yuzme', name: 'Yüzme', hint: 'Basılı tut: yüksel · Bırak: alçal · Kabarcıkları kaçırma', icon: '🫧' },
  trambolin: { id: 'trambolin', name: 'Trambolin', hint: 'Zara değdiğin an dokun: güçlü sıçra', icon: '🥁' },
  makine: { id: 'makine', name: 'Makine', hint: 'Dişliye tutun · Doğru anda bırak', icon: '⚙️' },
  impuls: { id: 'impuls', name: 'İmpuls', hint: 'Sağa/sola kaydır: şerit değiştir · Çok hızlı', icon: '⚡' },
  ruya: { id: 'ruya', name: 'Rüya', hint: 'Dokun: yerçekimini çevir', icon: '🌀' },
  boss: { id: 'boss', name: 'Canavar', hint: 'Zayıf noktasına vur, saldırısını atlat', icon: '👹' },
};
