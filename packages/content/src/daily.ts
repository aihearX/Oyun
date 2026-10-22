import { R, type Reward } from './rewards';
import { PATOLOJI_IDS, PATOLOJILER, patolojiKey } from './patolojiler';

/**
 * Günlük görevler, 7 günlük giriş takvimi ve harita hazineleri. Hepsinin ödülü önceden görünür; rastgele sandık yok.
 * Görev seçimi deterministiktir (tarih tohumu): aynı gün herkes aynı üç görevi görür.
 */
export type QuestMetric = 'plays' | 'clears' | 'clears2' | 'threeStar' | 'coins' | 'noDamage' | 'underPar' | 'combo10' | 'share' | 'replay';
export interface QuestDef { id: string; slot: 'a' | 'b' | 'c'; text: string; metric: QuestMetric; target: number; reward: Reward; emoji: string }

export const QUESTS: QuestDef[] = [
  // a: kolay ısınma
  { id: 'oyna-3', slot: 'a', emoji: '▶️', text: '3 bölüm oyna', metric: 'plays', target: 3, reward: [R.jeton(20), R.xp(10)] },
  { id: 'jeton-50', slot: 'a', emoji: '🪙', text: '50 jeton topla', metric: 'coins', target: 50, reward: [R.jeton(20), R.xp(10)] },
  { id: 'bitir-2', slot: 'a', emoji: '🚪', text: '2 bölüm bitir', metric: 'clears', target: 2, reward: [R.jeton(20), R.xp(10)] },
  // b: beceri
  { id: 'iki-yildiz-3', slot: 'b', emoji: '⭐', text: '3 bölümü 2+ yıldızla bitir', metric: 'clears2', target: 3, reward: [R.jeton(30), R.xp(20)] },
  { id: 'uc-yildiz-1', slot: 'b', emoji: '🌟', text: 'Bir bölümde 3 yıldız al', metric: 'threeStar', target: 1, reward: [R.jeton(30), R.xp(20)] },
  { id: 'hasarsiz-1', slot: 'b', emoji: '🪶', text: 'Bir bölümü hiç hasar almadan bitir', metric: 'noDamage', target: 1, reward: [R.jeton(30), R.xp(20)] },
  { id: 'par-1', slot: 'b', emoji: '💨', text: 'Bir bölümü par süresinden hızlı bitir', metric: 'underPar', target: 1, reward: [R.jeton(30), R.xp(20)] },
  { id: 'seri-10', slot: 'b', emoji: '🔗', text: 'Tek bölümde 10\'luk jeton serisi yap', metric: 'combo10', target: 1, reward: [R.jeton(30), R.xp(20)] },
  // c: çeşitlilik / sosyal
  { id: 'meydan-1', slot: 'c', emoji: '📣', text: 'Bir arkadaşa meydan oku', metric: 'share', target: 1, reward: [R.jeton(25), R.xp(15)] },
  { id: 'tekrar-1', slot: 'c', emoji: '🔁', text: 'Yıldızlı bir bölümü tekrar oyna', metric: 'replay', target: 1, reward: [R.jeton(25), R.xp(15)] },
  { id: 'jeton-120', slot: 'c', emoji: '💰', text: '120 jeton topla', metric: 'coins', target: 120, reward: [R.jeton(25), R.xp(15)] },
];
export const questById = (id: string) => QUESTS.find((q) => q.id === id);

/** Günlük sandık (3 görev bitince): taban içerik; kart, @odi/meta tarafından sıradaki sandık kartıyla doldurulur. */
export const DAILY_CHEST_BASE: Reward = [R.jeton(50), R.xp(25), R.koruyucu(1)];

/** 7 günlük giriş takvimi: ödüller baştan görünür. Seri sayacıyla ilerler; 8. günde döngü baştan başlar. */
export const CALENDAR: { day: number; reward: Reward; big?: boolean }[] = [
  { day: 1, reward: [R.jeton(20)] },
  { day: 2, reward: [R.jeton(30), R.xp(20)] },
  { day: 3, reward: [R.kozmetik('sapka-bere'), R.jeton(20)] },
  { day: 4, reward: [R.koruyucu(1), R.jeton(20)] },
  { day: 5, reward: [R.jeton(60)] },
  { day: 6, reward: [R.jeton(40), R.xp(40)] },
  { day: 7, reward: [R.kozmetik('renk-nane'), R.jeton(100)], big: true },
];

/** Harita hazineleri: bölümü ilk kez bitirince açılır. Haritada "2 bölüm sonra hazine" diye görünür. */
export const TREASURES: { level: number; reward: Reward }[] = [
  { level: 5, reward: [R.jeton(50), R.xp(20)] },
  { level: 10, reward: [R.jeton(60), R.koruyucu(1)] },
  { level: 15, reward: [R.kozmetik('sapka-kulaklik'), R.jeton(40)] },
  { level: 20, reward: [R.kozmetik('renk-gece'), R.jeton(100)] },
  { level: 25, reward: [R.jeton(80), R.koruyucu(1)] },
  { level: 30, reward: [R.kozmetik('sapka-dalgic'), R.jeton(60)] },
  { level: 35, reward: [R.jeton(100), R.xp(60)] },
  { level: 40, reward: [R.kozmetik('sapka-tac'), R.jeton(200)] },
];
export const treasureAt = (level: number) => TREASURES.find((t) => t.level === level);

/** Oyun içi "ilk kez" kutlamaları (görsel; mekaniği etkilemez) */
export const FIRSTS: Record<string, string> = {
  ezme: 'İlk ezme!', seri5: 'İlk 5\'li seri!', kilpayi: 'İlk kıl payı!', guc: 'İlk güçlendirme!', kontrol: 'İlk kontrol noktası!',
  // yeni yeteneğin öğretici anı (bir kez yavaşlatılmış, oynanarak öğrenilir)
  'ogret-zipla': 'Yeni yetenek: Zıpla!', 'ogret-kayma': 'Yeni yetenek: Kayma!', 'ogret-duvar': 'Yeni yetenek: Duvar Zıplaması!',
  'ogret-suzul': 'Yeni yetenek: Süzülme!', 'ogret-trambolin': 'Yeni yetenek: Zar Sıçrayışı!', 'ogret-kanca': 'Yeni yetenek: Kanca!',
  'ogret-cakil': 'Yeni yetenek: Yere Çakılma!', 'ogret-yuz': 'Yeni yetenek: Yüzme!', 'ogret-darbe': 'Yeni yetenek: Ses Darbesi!', 'ogret-cevir': 'Yeni yetenek: Yerçekimi Çevirme!',
  // 5. bölümün kayma tazeleme anı: iki perde başarıyla geçilince kalıcı olarak kapanır (kutlama gösterilmez)
  'tazele-kayma': 'Kayma tazelendi!',
  // bölge patolojisiyle ilk karşılaşma (Tüy Dede'nin cümlesi bir kez; kutlama gösterilmez). patolojiler.ts
  ...Object.fromEntries(PATOLOJI_IDS.map((id) => [patolojiKey(id), `Tanıştın: ${PATOLOJILER[id].ad}`])),
};
