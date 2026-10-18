/**
 * Kutlama anları — SÖZLEŞME (ses+kutlama ekibi uygular; harita ekibi ve diğer ekranlar çağırır).
 * Hepsi tam ekran katmanında oynar, dokunuşla hızlandırılabilir, prefers-reduced-motion'da kısa sürer.
 * Dürüstlük: gösterilen içerik her zaman verilen içerikle aynıdır; gizli olasılık yok.
 */
export interface RewardItem { kind: 'jeton' | 'kristal' | 'kalkan' | 'kozmetik' | 'kart' | 'xp' | 'koruyucu' | 'hizlandirici'; amount: number; label?: string; ref?: string }
export interface ScreenPoint { x: number; y: number }

type Impl = {
  chest(o: { title: string; items: RewardItem[]; tier?: 'bronz' | 'gumus' | 'altin' }): Promise<void>;
  coins(o: { amount: number; from?: ScreenPoint; kind?: 'jeton' | 'kristal' }): Promise<void>;
  levelUp(o: { level: number; unlocks?: string[] }): Promise<void>;
  biomeRestored(o: { biome: string; name: string; reward?: RewardItem[] }): Promise<void>;
  banner(o: { icon: string; title: string; body?: string; tone?: 'accent' | 'gold' | 'green' | 'coral' }): void;
};

const noop: Impl = {
  async chest() {}, async coins() {}, async levelUp() {}, async biomeRestored() {}, banner() {},
};
let impl: Impl = noop;
/** kutlama katmanı (CelebrationLayer) bağlanınca kendini kaydeder */
export function registerCelebrations(i: Impl) { impl = i; }
export const celebrate: Impl = {
  chest: (o) => impl.chest(o), coins: (o) => impl.coins(o), levelUp: (o) => impl.levelUp(o), biomeRestored: (o) => impl.biomeRestored(o), banner: (o) => impl.banner(o),
};
