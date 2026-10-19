import type Phaser from 'phaser';
/**
 * Görsel modülün ortak tipleri. Motor henüz yeni öğe türlerini `@odi/shared` içine eklemediği için
 * çizim katmanı kendi gevşek tipini kabul eder (shared `Entity` de buna uyar).
 */

/** Çizilecek öğe. Koordinat sözleşmesi (dünya px):
 *  - Dikdörtgenler (platform, moving, lift, wall, crumble, beat, echo, hazard, barrier, current, water, gravzone, door, freqgate): (x,y) sol-üst, w×h.
 *  - spike: x sol kenar, y taban çizgisi, w genişlik (dikenler y'nin üstünde).
 *  - Yerde duranlar (enemy, spring, trampoline, checkpoint, gate, switch, launcher, decor, escortee yürüyüşte): (x,y) alt-orta.
 *  - Noktasal (coin, note, collect, secret, bubble, powerup, fork, hook, flip, lane, gear, text, projectile): (x,y) merkez.
 */
export interface RenderEntity { type: string; x: number; y: number; w?: number; h?: number; props?: Record<string, unknown> }

export interface Rect { x: number; y: number; w: number; h: number }

/** Biyom arka planı: kamera her karede update ile bildirilir (scrollX, scrollY). */
export interface BiomeBackdrop {
  update(camX: number, camY: number): void;
  /** görünüm boyutu değişti (tasarım birimi) */
  resize(viewW: number, viewH: number): void;
  /** ön plan katmanını aç/kapa (ör. öğretici anında) */
  setForegroundAlpha(a: number): void;
  /** çalışırken kalite değiştir: 'low' toplamsal ışık huzmelerini, sis bandını ve parçacıkları kapatır (yeniden boyamaz) */
  setQuality(q: 'high' | 'low'): void;
  destroy(): void;
  readonly objects: Phaser.GameObjects.GameObject[];
}

export type HeroPose = 'run' | 'jump' | 'fall' | 'slide' | 'wall' | 'glide' | 'swing' | 'swim' | 'dash' | 'pound' | 'hurt' | 'win' | 'idle';
export interface HeroCosmetic { color?: number; hat?: string | null }

export interface HeroVisual {
  /** kök kap: (x,y) = ayak tabanı ortası (motorun Hero sprite'ı gibi origin 0.5,1) */
  readonly root: Phaser.GameObjects.Container;
  setPose(state: HeroPose, vx?: number, vy?: number): void;
  setPosition(x: number, y: number): void;
  setFlipX(flip: boolean): void;
  setVisible(v: boolean): void;
  setAlpha(a: number): void;
  setDepth(d: number): void;
  /** iniş: hız (px/s) ile orantılı basılma */
  land(impact?: number): void;
  /** ters yerçekimi: baş aşağı */
  setGravityFlip(flip: boolean): void;
  setShield(on: boolean): void;
  /** basılı tutarak yüksek zıplama: 0 (yok) … 1 (tam yükseklik) — şarj parıltısı ve kıvılcım izi */
  setCharge(k: number): void;
  destroy(): void;
}

/** entitySprite dönüşü: her öğe aynı küçük durum API'sini taşır (ilgisiz olanlarda etkisiz). */
export interface EntityApi {
  readonly kind: string;
  /** door / freqgate / switch (basılı) / checkpoint (yanık) */
  setOpen(open: boolean): void;
  /** beat: vuruş evresi 0..1 (0 = vuruş anı) */
  pulse(beatPhase: number): void;
  /** beat: katı mı (görünür) */
  setSolid(solid: boolean): void;
  /** echo: görünürlük 0..1 */
  reveal(alpha: number): void;
  /** crumble: çatlama 0..1 (1 = kırıldı, parçalar düşer) */
  crack(t: number): void;
  /** düşman: saldırı öncesi uyarı */
  telegraph(): void;
  /** nota / jeton / collect / secret / powerup / fork: toplama patlaması (sonra kendini yok eder) */
  collect(): void;
  /** barrier / enemy: kırılma / dağılma (sonra kendini yok eder) */
  shatter(): void;
  /** düşman / yürüyen: yön */
  setFacing(dir: 1 | -1): void;
}
