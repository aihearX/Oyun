/** @odi/meta: bağlılık sistemlerinin saf mantığı (görevler, takvim, seri, başarımlar, albüm, kozmetik, ödül kapısı). */
import { LUCKY_NOTE } from '@odi/content';
export * from './time';
export * from './state';
export * from './rewards';
export * from './unlocks';
export * from './daily';
export * from './progress';
export * from './run';

/** Şanslı Nota zarı: ihtimal sabit ve bilgi ekranında yazılı (%10). */
export function rollLucky(rand: () => number = Math.random): boolean { return rand() < LUCKY_NOTE.chance; }
