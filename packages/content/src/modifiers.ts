import type { ModifierId } from '@odi/shared';
export const MODIFIERS: Record<ModifierId, { name: string; desc: string; minLevel: number }> = {
  'hiz': { name: 'Hız', desc: 'Her şey %30 hızlı.', minLevel: 15 },
  'sis': { name: 'Sis', desc: 'Görüş kısa; engeller geç belirir.', minLevel: 18 },
  'ayna': { name: 'Ayna', desc: 'Sağ-sol ters.', minLevel: 22 },
  'tek-can': { name: 'Tek Can', desc: 'Bir hasar, bölüm biter.', minLevel: 24 },
  'yanki': { name: 'Yankı', desc: 'Hareketlerin gölgesi seni takip eder.', minLevel: 26 },
  'gece': { name: 'Gece', desc: 'Yalnızca ses dalgaları görünür.', minLevel: 28 },
  'ters-yercekimi': { name: 'Ters Yerçekimi', desc: 'Tavan zemindir.', minLevel: 30 },
  'cihaz-kapali': { name: 'Cihaz Kapalı', desc: 'Jetonlar görünmez; sesle oyna.', minLevel: 33 },
};
