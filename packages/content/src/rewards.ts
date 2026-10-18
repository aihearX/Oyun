/**
 * Yerel ödül biçimi. Sunucudaki InboxItem ({ kind, amount, ref }) ile aynı şekil: ileride sunucu cüzdanıyla eşitlenecek.
 * Hiçbir ödül parayla alınmaz; hepsi oynayarak kazanılır ve içerikleri önceden görünür.
 */
export type RewardKind = 'jeton' | 'xp' | 'koruyucu' | 'kozmetik' | 'kart';
export interface RewardItem { kind: RewardKind; amount: number; ref?: string }
export type Reward = RewardItem[];

/** Kısa yardımcılar (tanım dosyalarını okunur tutmak için) */
export const R = {
  jeton: (amount: number): RewardItem => ({ kind: 'jeton', amount }),
  xp: (amount: number): RewardItem => ({ kind: 'xp', amount }),
  koruyucu: (amount = 1): RewardItem => ({ kind: 'koruyucu', amount }),
  kozmetik: (ref: string): RewardItem => ({ kind: 'kozmetik', amount: 1, ref }),
  kart: (ref: string): RewardItem => ({ kind: 'kart', amount: 1, ref }),
};

/** Seri koruyucu: en fazla bu kadar birikir (fazlası önceden yazıldığı gibi jetona döner). */
export const MAX_STREAK_SHIELDS = 2;
/** Zaten sahip olunan şey tekrar gelirse karşılığı (önizlemede de böyle gösterilir). */
export const DUPLICATE_VALUE = { kozmetik: 50, kart: 15, koruyucu: 30 } as const;
/** Şanslı Nota: her bölümde görünen, sabit ihtimalli küçük sürpriz. Para ile ilgisi yok. */
export const LUCKY_NOTE = { chance: 0.1, reward: [R.jeton(25), R.xp(10)] as Reward } as const;
