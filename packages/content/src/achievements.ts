import type { BiomeId } from '@odi/shared';
import { BIOMES, BIOME_ORDER } from './biomes';
import { HUMAN_JOURNEY } from './journeys';
import { R, type Reward } from './rewards';

/** Başarım ölçütleri: @odi/meta bunları oyuncu durumundan hesaplar. */
export type MetricId =
  | 'clears' | 'stars' | 'threeStars' | 'coins' | 'secrets' | 'noDamage' | 'bosses' | 'underPar' | 'lucky' | 'shares'
  | 'quests' | 'chests' | 'calendar' | 'maxStreak' | 'cards' | 'cosmetics' | 'playerLevel' | 'biomesDone' | 'maxCombo'
  | 'comebacks' | 'plays' | 'melody' | 'escort' | 'timed' | 'collectAll' | 'perfect' | 'shieldsEarned' | 'skills'
  | 'highest' | 'days' | 'xp' | 'mechanics' | `biomeStars:${BiomeId}`;

export type Tier = 1 | 2 | 3;
export const TIER_NAMES: Record<Tier, string> = { 1: 'Bronz', 2: 'Gümüş', 3: 'Altın' };
export const TIER_REWARD: Record<Tier, Reward> = { 1: [R.jeton(15), R.xp(10)], 2: [R.jeton(40), R.xp(25)], 3: [R.jeton(100), R.xp(60)] };

export interface AchievementDef {
  id: string; emoji: string; name: string;
  /** {n} yerine kademenin hedefi yazılır */
  desc: string;
  metric: MetricId;
  /** kademe eşikleri (artan): 1-3 kademe */
  tiers: number[];
}

const A = (id: string, emoji: string, name: string, desc: string, metric: MetricId, tiers: number[]): AchievementDef => ({ id, emoji, name, desc, metric, tiers });

const biomeAch: AchievementDef[] = BIOME_ORDER.map((b) => {
  const n = HUMAN_JOURNEY.levels.filter((l) => l.biome === b).length;
  return A(`biyom-${b}`, '🗺️', `${BIOMES[b].name} Ustası`, `${BIOMES[b].name} biyomunda toplam {n} yıldız topla`, `biomeStars:${b}`, [n, n * 2, n * 3]);
});

export const ACHIEVEMENTS: AchievementDef[] = [
  A('ilk-ses', '🎵', 'İlk Ses', '{n} bölüm bitir', 'clears', [1, 25, 100]),
  A('yildiz-avcisi', '⭐', 'Yıldız Avcısı', 'Toplam {n} yıldız topla', 'stars', [10, 50, 120]),
  A('kusursuz-kulak', '🌟', 'Kusursuz Kulak', '{n} bölümde 3 yıldız al', 'threeStars', [3, 15, 40]),
  A('jeton-kumbarasi', '🪙', 'Jeton Kumbarası', 'Bölümlerde toplam {n} jeton topla', 'coins', [100, 1000, 5000]),
  A('altin-kulak', '🐚', 'Altın Kulak', '{n} farklı altın koklea bul', 'secrets', [1, 2, 4]),
  A('tuy-gibi', '🪶', 'Tüy Gibi', '{n} bölümü hiç hasar almadan bitir', 'noDamage', [1, 10, 30]),
  A('gurultu-avcisi', '👹', 'Gürültü Avcısı', '{n} canavar yen', 'bosses', [1, 2]),
  A('ses-hizinda', '💨', 'Ses Hızında', '{n} bölümü par süresinden hızlı bitir', 'underPar', [1, 10, 30]),
  A('sansli-kulak', '🍀', 'Şanslı Kulak', '{n} Şanslı Nota topla', 'lucky', [1, 5, 15]),
  A('meydan-okuyucu', '📣', 'Meydan Okuyucu', '{n} kez arkadaşına meydan oku', 'shares', [1, 5, 20]),
  A('gorev-kulagi', '📋', 'Görev Kulağı', '{n} günlük görev tamamla', 'quests', [3, 30, 100]),
  A('sandik-sesi', '🎁', 'Sandık Sesi', '{n} günlük sandık aç', 'chests', [1, 7, 30]),
  A('takvim-dostu', '📅', 'Takvim Dostu', 'Giriş takviminden {n} ödül al', 'calendar', [3, 7, 28]),
  A('seri', '🔥', 'Kulak Ritmi', '{n} günlük seri yap', 'maxStreak', [3, 7, 30]),
  A('koleksiyoncu', '🃏', 'Kart Koleksiyoncusu', '{n} Kulak Kartı topla', 'cards', [5, 25, 50]),
  A('moda-kulagi', '🎩', 'Moda Kulağı', '{n} kozmetiğe sahip ol', 'cosmetics', [3, 7, 12]),
  A('usta-dinleyici', '🎧', 'Usta Dinleyici', 'Seviye {n} ol', 'playerLevel', [3, 8, 15]),
  A('kasif', '🧭', 'Kâşif', '{n} biyomun tüm bölümlerini bitir', 'biomesDone', [1, 5, 10]),
  A('kombo', '🔗', 'Seri Ustası', 'Tek bölümde art arda {n} nota topla', 'maxCombo', [10, 20, 35]),
  A('pes-etmeyen', '💪', 'Pes Etmeyen', 'Üst üste kaybettikten sonra {n} kez kazan', 'comebacks', [1, 5, 15]),
  A('bir-daha', '🔁', 'Bir Daha!', '{n} bölüm oyna', 'plays', [10, 100, 500]),
  A('kulagi-muzikli', '🎼', 'Kulağı Müzikli', 'Melodi hedefini {n} kez tamamla', 'melody', [1, 3, 6]),
  A('fisilti-koruyucu', '🌬️', 'Fısıltı Koruyucusu', 'Fısıltıyı {n} kez sağ salim taşı', 'escort', [1, 3, 8]),
  A('saat-kulesi', '⏰', 'Saat Kulesi', 'Süreli hedefi {n} kez tamamla', 'timed', [1, 5, 15]),
  A('supurge-kulak', '🧹', 'Süpürge Kulak', '"Tüm jetonları topla" hedefini {n} kez tamamla', 'collectAll', [1, 5, 15]),
  A('mukemmeliyetci', '💎', 'Mükemmeliyetçi', '{n} bölümü 3 yıldız ve hasarsız bitir', 'perfect', [1, 5, 20]),
  A('seri-bekcisi', '🛡️', 'Seri Bekçisi', '{n} seri koruyucu kazan', 'shieldsEarned', [1, 3, 10]),
  A('beyin-jimnastigi', '🧠', 'Beyin Jimnastiği', '{n} yetenek aç', 'skills', [1, 5, 11]),
  A('uzun-yol', '🛤️', 'Uzun Yol', '{n}. bölüme ulaş', 'highest', [10, 25, 40]),
  A('sadik-kulak', '🤝', 'Sadık Kulak', '{n} farklı gün oyna', 'days', [3, 14, 60]),
  A('deneyim-dalgasi', '🌊', 'Deneyim Dalgası', 'Toplam {n} XP kazan', 'xp', [500, 3000, 10000]),
  A('cok-yonlu', '🎛️', 'Çok Yönlü', '{n} farklı mekanikte bölüm bitir', 'mechanics', [3, 5, 7]),
  ...biomeAch,
];
export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);
export const achievementDesc = (a: AchievementDef, tier: Tier) => a.desc.replace('{n}', (a.tiers[Math.min(tier, a.tiers.length) - 1] ?? 0).toLocaleString('tr-TR'));
