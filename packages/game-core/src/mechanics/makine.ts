import type { Mechanic } from './types';
import { kosu } from './kosu';
/** GEÇİCİ: koşu davranışını kopyalar. Mekanik ekibi bu dosyayı gerçek uygulamayla değiştirir. */
export const makine: Mechanic = { ...kosu, id: 'makine' };
