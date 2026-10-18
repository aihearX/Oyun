import type { StarMap, Vitality, ZoneId } from './layout';

/** haritanın çaldığı sesler (@odi/audio Sfx adlarıyla aynı; çağıran ses motoruna iletir) */
export type MapSfx = 'nodePop' | 'pathDraw' | 'odiStep' | 'restore' | 'biomeAwaken' | 'flagPlant' | 'tap' | 'star1' | 'star2' | 'star3' | 'chestShake' | 'whoosh' | 'pop';
export interface MapFriend { id: string; name: string; color: number; highest: number }
/** Bölge Savaşı işareti: takımın sahip olduğu (bayrak) ya da hedeflediği (hedef işareti) bölge */
export interface MapWarMark { regionId: string; name: string; zone: ZoneId; emblem: string; owned: boolean; target: boolean }
export interface MapSocial { friends: MapFriend[]; war: MapWarMark[]; teamColor?: number }

export interface MapOptions {
  /** güncel yıldızlar (bölüm → 0..3) */
  stars: StarMap;
  /** haritada en son gösterilen yıldızlar; farklıysa dönüş sahnesi oynar. null: sahne yok */
  seen: StarMap | null;
  /** açılmış hazine bölümleri */
  treasuresOpen: number[];
  hero: { color: number; hat?: string };
  social?: MapSocial | null;
  /** üst HUD ve alt düğme/sekme çubuğunun kapladığı alan (CSS px) — odak bu boşluğun ortasına */
  insets: { top: number; bottom: number };
  reducedMotion?: boolean;
  /** hafif mod (düşük güç): sürekli animasyon yok, boşta döngü uyur. Verilmezse: test tarayıcısı ya da azaltılmış harekette açık */
  light?: boolean;
  sfx?(s: MapSfx, o?: { semitones?: number; vol?: number }): void;
  haptic?(k: 'light' | 'medium' | 'heavy' | 'success'): void;
  onNodeTap?(n: number): void;
  onTreasureTap?(n: number): void;
  onZoneTap?(z: ZoneId): void;
  /** dönüş sahnesi: hazine sandığı açılır (çağıran gerçek içeriği gösterir) */
  onTreasure?(n: number): Promise<void>;
  /** dönüş sahnesi: bölge canlandı (seviye 3'e ilk ulaşma vb.) */
  onZoneRise?(z: ZoneId, from: Vitality, to: Vitality): Promise<void>;
  onSequence?(phase: 'start' | 'done'): void;
  /** mevcut düğüm görünür mü (görünmüyorsa "bana dön" düğmesi) */
  onCurrentVisible?(visible: boolean, dir: 'up' | 'down'): void;
}

export interface MapHandle {
  destroy(): void;
  setSocial(s: MapSocial | null): void;
  /** yeni ilerleme (ör. sunucu eşitlemesi): farkı oynatır */
  update(stars: StarMap, treasuresOpen: number[]): void;
  focusCurrent(animate?: boolean): void;
  /** dönüş sahnesini hızlandır (dokunuş) */
  speedUp(): void;
}
