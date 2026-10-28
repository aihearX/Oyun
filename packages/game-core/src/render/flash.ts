/**
 * Işığa duyarlılık güvenliği (WCAG 2.3.1, "üç flaş ya da eşik altı"): oyundaki bütün ekran flaşları buradan geçer.
 *  - Beyaza yakın tam ekran kare yok: flaş renginin bağıl parlaklığı en çok FLASH.maxLuma (gerekirse koyulaştırılır),
 *    örtünün saydamlığı en çok FLASH.maxAlpha. Böylece koyu sahnede bir flaş karesinin ortalama parlaklığı ~0,15'i geçmez.
 *  - Saniyede en çok FLASH.maxPerSec flaş: kayan 1 sn'lik pencere; tam ekran flaş, hasar vinyeti ve kutlama ışığı aynı sayacı paylaşır.
 *  - Azaltılmış harekette (prefers-reduced-motion ya da LevelOptions.reducedMotion) hiç flaş yok.
 * Phaser'a bağlı değil (birim testi: flash.test.ts). Bir anda tek bölüm/kamp sahnesi olduğundan durum modül düzeyinde (quality.ts gibi).
 */
export const FLASH = {
  /** tam ekran örtünün en yüksek saydamlığı */
  maxAlpha: 0.35,
  /** flaş renginin en yüksek bağıl parlaklığı (0..1; saf beyaz 1) */
  maxLuma: 0.6,
  /** kayan pencerede en çok flaş */
  maxPerSec: 3,
  windowMs: 1000,
  /** boss yenilgi parıltısının hızı (Hz; saniyede 3'ün altında) */
  blinkHz: 2,
} as const;

let reduced = false;
const recent: number[] = [];

/** sahne kurulurken: azaltılmış hareket açıksa flaşlar tümden kapanır; sayaç sıfırlanır */
export function setFlashPolicy(o: { reduced: boolean }): void { reduced = o.reduced; recent.length = 0; }
export function flashesEnabled(): boolean { return !reduced; }

/** tarayıcının "hareketi azalt" tercihi (yoksa ya da okunamazsa false) */
export function prefersReducedMotion(): boolean {
  try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/**
 * Yeni bir flaş için izin: azaltılmış harekette hep hayır; son 1 sn'de FLASH.maxPerSec flaş olduysa hayır (flaş atlanır, ertelenmez).
 * now: ms (sahne saati; ağır çekim kaydında sanal saat).
 */
export function takeFlash(now: number): boolean {
  if (reduced) return false;
  while (recent.length && now - recent[0]! >= FLASH.windowMs) recent.shift();
  // saat geri gittiyse (yeni sahne, sanal saat) eski kayıtlar geçersiz
  if (recent.length && now < recent[recent.length - 1]!) recent.length = 0;
  if (recent.length >= FLASH.maxPerSec) return false;
  recent.push(now); return true;
}

const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
/** 0xRRGGBB → bağıl parlaklık (WCAG; 0 siyah, 1 beyaz) */
export function relLuma(rgb: number): number {
  return 0.2126 * lin((rgb >> 16) & 255) + 0.7152 * lin((rgb >> 8) & 255) + 0.0722 * lin(rgb & 255);
}
/** flaş rengi: tonu korur, bağıl parlaklığı FLASH.maxLuma'yı aşıyorsa kanalları aynı oranda koyulaştırır */
export function safeFlashColor(rgb: number): number {
  if (relLuma(rgb) <= FLASH.maxLuma) return rgb;
  let lo = 0, hi = 1;
  const scale = (k: number) => (Math.round(((rgb >> 16) & 255) * k) << 16) | (Math.round(((rgb >> 8) & 255) * k) << 8) | Math.round((rgb & 255) * k);
  for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (relLuma(scale(m)) <= FLASH.maxLuma) lo = m; else hi = m; }
  return scale(lo);
}
export function safeFlashAlpha(a: number): number { return Math.max(0, Math.min(FLASH.maxAlpha, a)); }

/** düz örtü (normal karışım): `bg` zeminin üstüne `alpha` saydamlıkla `color` → sonuç karenin bağıl parlaklığı */
export function overlayLuma(bg: number, color: number, alpha: number): number {
  const mix = (sh: number) => Math.round(((bg >> sh) & 255) * (1 - alpha) + ((color >> sh) & 255) * alpha);
  return relLuma((mix(16) << 16) | (mix(8) << 8) | mix(0));
}

/** boss yenilgisi parıltısı: FLASH.blinkHz'de açık/kapalı (azaltılmış harekette hiç) */
export function blinkOn(tSec: number): boolean { return !reduced && Math.sin(tSec * Math.PI * 2 * FLASH.blinkHz) > 0.6; }
/** sprite vuruş parlaması rengi (tintFill): beyaz yerine sıcak, parlaklığı sınırlı */
export const HIT_FILL = safeFlashColor(0xfff0d0);
