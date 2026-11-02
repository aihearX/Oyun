/**
 * Kutlama anları — SÖZLEŞME (ses+kutlama ekibi uygular; harita ekibi ve diğer ekranlar çağırır).
 * Hepsi tam ekran katmanında oynar, dokunuşla hızlandırılabilir, prefers-reduced-motion'da kısa sürer.
 * Dürüstlük: gösterilen içerik her zaman verilen içerikle aynıdır; gizli olasılık yok.
 */
import { create } from 'zustand';
import type { RewardItem as JourneyReward } from '@odi/content';

export interface RewardItem { kind: 'jeton' | 'kristal' | 'kalkan' | 'kozmetik' | 'kart' | 'xp' | 'koruyucu' | 'hizlandirici'; amount: number; label?: string; ref?: string }
export interface ScreenPoint { x: number; y: number }
/** birikmiş kutlama penceresinin bir satırı (ör. "Hazine · Bölüm 20" ve içindekiler; "Kulak Kanalı yeniden canlandı!") */
export interface RecapRow { icon: string; text: string; items?: JourneyReward[] }

type Impl = {
  /** granted: içerik cüzdana zaten girdi ve sayaçta görüldü (ör. sonuç ekranında verilen hazine): sayaç yeniden saymaz, düğme "Tamam" */
  chest(o: { title: string; items: RewardItem[]; tier?: 'bronz' | 'gumus' | 'altin'; granted?: boolean }): Promise<void>;
  coins(o: { amount: number; from?: ScreenPoint; kind?: 'jeton' | 'kristal' }): Promise<void>;
  /** title/kicker: başka bir seviye türü (ör. Kamp Seviyesi) için başlık ve rozet yazısı */
  levelUp(o: { level: number; unlocks?: string[]; title?: string; kicker?: string }): Promise<void>;
  biomeRestored(o: { biome: string; name: string; reward?: RewardItem[] }): Promise<void>;
  /** birikmiş kutlamalar tek pencerede (her biri satır); ödül vermez, yalnız gösterir */
  recap(o: { title: string; sub?: string; note?: string; rows: RecapRow[] }): Promise<void>;
  banner(o: { icon: string; title: string; body?: string; tone?: 'accent' | 'gold' | 'green' | 'coral' }): void;
};

const noop: Impl = {
  async chest() {}, async coins() {}, async levelUp() {}, async biomeRestored() {}, async recap() {}, banner() {},
};
let impl: Impl = noop;
/** kutlama katmanı (CelebrationLayer) bağlanınca kendini kaydeder */
export function registerCelebrations(i: Impl) { impl = i; }
export const celebrate: Impl = {
  chest: (o) => impl.chest(o), coins: (o) => impl.coins(o), levelUp: (o) => impl.levelUp(o), biomeRestored: (o) => impl.biomeRestored(o), recap: (o) => impl.recap(o), banner: (o) => impl.banner(o),
};

/**
 * Etkileşimli kutlama sahnesi (sandık, seviye, bölge canlandı) ekranda mı: kutlama katmanı yazar. Bir anda tek etkileşimli katman
 * (YN-067): anlatıcı turu bu sırada duraklar, kutlama kapanınca kaldığı adımdan sürer; Yönetmen yeni turu başlatmaz.
 */
export const useCelebrating = create<{ on: boolean }>(() => ({ on: false }));
