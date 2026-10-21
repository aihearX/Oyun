/**
 * Bölge anıtları (web tarafı): oyuncunun ulaştığı bölgeler (Kulak Sözlüğü ile aynı kural) ve hangi anıtın kutlanacağı.
 * "Görüldü" listesi bu cihazda tutulur (kolaylık; kaybolursa en ileri anıt bir kez daha kutlanır). Bir ziyarette en çok bir kutlama:
 * görülmemişlerin en ilerisi; diğerleri sessizce görülmüş sayılır.
 */
import { MONUMENT_ORDER } from '@odi/game-core';
import { reachedRegions } from '../screens/GlossaryScreen';

const KEY = 'odi.kamp.anitlar';
export function regionsNow(cleared: number): string[] { const r = reachedRegions(cleared); return MONUMENT_ORDER.filter((b) => r.has(b)); }
function seen(): string[] { try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown; return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; } }
/** kutlanacak anıt (yoksa null) */
export function monumentToCelebrate(regions: string[]): string | null { const s = new Set(seen()); const fresh = regions.filter((r) => !s.has(r)); return fresh.length ? fresh[fresh.length - 1]! : null; }
export function markSeen(regions: string[]): void { try { localStorage.setItem(KEY, JSON.stringify([...new Set([...seen(), ...regions])])); } catch { /* gizli mod */ } }
