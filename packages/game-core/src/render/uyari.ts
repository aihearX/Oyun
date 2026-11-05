/**
 * Canavar bölümü okunurluğu (YN-233): saldırı uyarılarının (yere düşen gölge, duvar şeridi, ok) ve "kalbi açıkta" işaretinin
 * renkleri, uyarı nabzı ve canavar hasarı yazısı. Gölge dolu ve koyudur (her biyomun açık zemin üstünde koyu leke), içinde
 * saldırının açık renkli halkası vardır (koyu zemin gövdesinde/arka planda da seçilsin); ikisi de koyu konturlu.
 * Yüksek görünürlükte ve azaltılmış harekette uyarı tam opak ve sabittir (nabız yok). Phaser'dan bağımsız (birim testi: uyari.test.ts).
 */
import { relLuma } from './flash';

/** gölge dolgusu (dolu, koyu) */
export const WARN_INK = 0x1a0826;
/** uyarıların ve kalp işaretinin dış konturu */
export const WARN_EDGE = 0x07020e;
/** uyarının açık halkası / oku: saldırı türünün rengi, koyu zemin üstünde de seçilecek açıklıkta */
export const WARN_RING = { golem: 0xffb347, canavar: 0xd9b8ff, wave: 0xff8fb0, high: 0xd9b8ff, gold: 0xffd65a } as const;
/** normal görünümde uyarı nabzının en düşük opaklığı (yüksek görünürlükte / azaltılmış harekette hep 1) */
export const WARN_MIN_ALPHA = 0.8;

/** WCAG kontrast oranı (1..21) */
export function contrast(a: number, b: number): number {
  const la = relLuma(a), lb = relLuma(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** `fg` rengi `alpha` saydamlıkla `bg` üstünde: görünen renk */
export function over(bg: number, fg: number, alpha: number): number {
  const m = (sh: number) => Math.round(((bg >> sh) & 255) * (1 - alpha) + ((fg >> sh) & 255) * alpha);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

/**
 * Uyarının opaklık çarpanı: normalde hafif nabız (WARN_MIN_ALPHA..1, ~2,5 Hz — parlaklık farkı küçük, flaş sayılmaz; render/flash.ts);
 * `steady` (yüksek görünürlük ya da azaltılmış hareket) iken sabit 1.
 */
export function warnPulse(t: number, steady: boolean): number {
  return steady ? 1 : WARN_MIN_ALPHA + (1 - WARN_MIN_ALPHA) * Math.abs(Math.sin(t * 8));
}

/** canavara verilen hasarın uçan yazısı: kime olduğunu söyler ("Canavar −3", "Golem −2"; eksi işareti U+2212) */
export function bossHitLabel(kind: 'golem' | 'canavar', n: number): string {
  return `${kind === 'golem' ? 'Golem' : 'Canavar'} −${n}`;
}
