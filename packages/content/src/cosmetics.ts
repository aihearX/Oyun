import { achievementById } from './achievements';

/**
 * Odi kozmetikleri: yalnızca görünüm, oyun gücü yok. Çoğu oynayarak açılır;
 * mağaza paketlerindeki iki kimlik (social.ts SHOP: 'sapka-kasif', 'kostum-altin') burada da tanımlıdır.
 */
export type CosmeticKind = 'renk' | 'sapka';
export type CosmeticUnlock =
  | { by: 'default' }
  | { by: 'level'; level: number }
  | { by: 'achievement'; id: string; tier: 1 | 2 | 3 }
  | { by: 'album'; pct: number }
  | { by: 'calendar'; day: number }
  | { by: 'treasure'; level: number }
  | { by: 'shop'; product: string };

export interface CosmeticDef {
  id: string;
  kind: CosmeticKind;
  name: string;
  /** renk: Odi gövde rengi (0xRRGGBB) */
  color?: number;
  /** şapka çizim anahtarı (oyun ve arayüz aynı anahtarı çizer) */
  hat?: HatId;
  unlock: CosmeticUnlock;
  desc: string;
}
export type HatId = 'bere' | 'kulaklik' | 'nota' | 'dalgic' | 'tac' | 'parti' | 'kasif' | 'koklea' | 'yildiz' | 'altin';

export const COSMETICS: CosmeticDef[] = [
  // renkler
  { id: 'renk-mor', kind: 'renk', name: 'Klasik Mor', color: 0x6c4cf1, unlock: { by: 'default' }, desc: 'Odi\'nin ilk günkü rengi.' },
  { id: 'renk-turkuaz', kind: 'renk', name: 'Koklea Turkuazı', color: 0x0e9c98, unlock: { by: 'level', level: 2 }, desc: 'Sıvının içinden geçmiş gibi.' },
  { id: 'renk-mercan', kind: 'renk', name: 'Mercan', color: 0xf0567a, unlock: { by: 'level', level: 4 }, desc: 'Sıcak bir "merhaba".' },
  { id: 'renk-amber', kind: 'renk', name: 'Bal Kehribarı', color: 0xd98b00, unlock: { by: 'level', level: 6 }, desc: 'Apeksin kalın sesi gibi tatlı.' },
  { id: 'renk-lavanta', kind: 'renk', name: 'Yıldız Tozu', color: 0x9b7bff, unlock: { by: 'achievement', id: 'yildiz-avcisi', tier: 2 }, desc: 'Elli yıldızın parıltısı.' },
  { id: 'renk-nane', kind: 'renk', name: 'Nane', color: 0x22a565, unlock: { by: 'calendar', day: 7 }, desc: 'Yedi günlük takvimin büyük ödülü.' },
  { id: 'renk-gece', kind: 'renk', name: 'Gece Mavisi', color: 0x2b3a8c, unlock: { by: 'treasure', level: 20 }, desc: 'Serumen Golemi\'nin hazinesinden.' },
  { id: 'renk-pembe', kind: 'renk', name: 'Korteks Pembesi', color: 0xff6f9f, unlock: { by: 'album', pct: 50 }, desc: 'Albümün yarısını dolduranlara.' },
  { id: 'kostum-altin', kind: 'renk', name: 'Altın Koklea Kostümü', color: 0xd9a400, hat: 'altin', unlock: { by: 'shop', product: 'odi.pass' }, desc: 'Sezon Kartı kostümü (yalnızca görünüm).' },
  // şapkalar
  { id: 'sapka-yok', kind: 'sapka', name: 'Şapkasız', unlock: { by: 'default' }, desc: 'Sade ve rüzgârlı.' },
  { id: 'sapka-bere', kind: 'sapka', name: 'Kulaklı Bere', hat: 'bere', unlock: { by: 'calendar', day: 3 }, desc: 'Kulaklar üşümesin.' },
  { id: 'sapka-nota', kind: 'sapka', name: 'Nota Anteni', hat: 'nota', unlock: { by: 'achievement', id: 'kombo', tier: 1 }, desc: 'Her frekansı yakalar.' },
  { id: 'sapka-koklea', kind: 'sapka', name: 'Salyangoz Tokası', hat: 'koklea', unlock: { by: 'album', pct: 25 }, desc: 'İki buçuk tur şıklık.' },
  { id: 'sapka-kulaklik', kind: 'sapka', name: 'Kulaklık', hat: 'kulaklik', unlock: { by: 'treasure', level: 15 }, desc: 'Sesi kısık tut, keyfi açık.' },
  { id: 'sapka-parti', kind: 'sapka', name: 'Parti Külahı', hat: 'parti', unlock: { by: 'achievement', id: 'seri', tier: 2 }, desc: '7 günlük seriye özel.' },
  { id: 'sapka-yildiz', kind: 'sapka', name: 'Yıldız Tacı', hat: 'yildiz', unlock: { by: 'achievement', id: 'kusursuz-kulak', tier: 2 }, desc: '15 bölümde üç yıldız.' },
  { id: 'sapka-dalgic', kind: 'sapka', name: 'Dalgıç Gözlüğü', hat: 'dalgic', unlock: { by: 'treasure', level: 30 }, desc: 'Koklea sıvısına hazır.' },
  { id: 'sapka-tac', kind: 'sapka', name: 'Ninni Tacı', hat: 'tac', unlock: { by: 'treasure', level: 40 }, desc: 'Ninniyi beyne ulaştıranlara.' },
  { id: 'sapka-kasif', kind: 'sapka', name: 'Kâşif Şapkası', hat: 'kasif', unlock: { by: 'shop', product: 'odi.baslangic' }, desc: 'Başlangıç Paketi şapkası (yalnızca görünüm).' },
];
export const cosmeticById = (id: string) => COSMETICS.find((c) => c.id === id);
export const DEFAULT_COLOR_ID = 'renk-mor';
export const DEFAULT_HAT_ID = 'sapka-yok';

/** Kilit açıklaması (Dolap ekranı): dürüst, net. */
export function cosmeticUnlockText(u: CosmeticUnlock): string {
  switch (u.by) {
    case 'default': return 'Başlangıçta açık';
    case 'level': return `Seviye ${u.level}`;
    case 'achievement': return `${achievementById(u.id)?.name ?? 'Başarım'} · ${u.tier === 1 ? 'bronz' : u.tier === 2 ? 'gümüş' : 'altın'}`;
    case 'album': return `Albüm %${u.pct}`;
    case 'calendar': return `Giriş takvimi ${u.day}. gün`;
    case 'treasure': return `Hazine: Bölüm ${u.level}`;
    case 'shop': return 'Mağaza paketinde';
  }
}
