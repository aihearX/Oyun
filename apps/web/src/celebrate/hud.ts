/**
 * HUD sayaçları ile jeton uçuşunun bağlantısı (dürüst: sayaç sonunda HER ZAMAN gerçek değeri gösterir).
 * Uçuş başlarken ödül miktarı "yolda" sayılır: sayaç gerçek değerin o kadar altında görünür; her jeton varınca
 * yoldaki miktar azalır ve sayaç zıplar. Uçuş bitince yolda 0 kalır.
 * Sayaçlar `data-hud="jeton"` / `data-hud="kristal"` özniteliğiyle işaretlenir; useHudCount ile gösterilir.
 */
import { useSyncExternalStore } from 'react';

export type HudKind = 'jeton' | 'kristal';
const pending: Record<HudKind, number> = { jeton: 0, kristal: 0 };
const bumps: Record<HudKind, number> = { jeton: 0, kristal: 0 };
const subs = new Set<() => void>();
let snap = { ...pending, bj: 0, bk: 0 };
const emit = () => { snap = { ...pending, bj: bumps.jeton, bk: bumps.kristal }; subs.forEach((f) => f()); };

export const hud = {
  hold(kind: HudKind, amount: number) { pending[kind] += Math.max(0, amount); emit(); },
  arrive(kind: HudKind, amount: number) { pending[kind] = Math.max(0, pending[kind] - amount); bumps[kind]++; emit(); },
  release(kind: HudKind) { pending[kind] = 0; emit(); },
  /** ekranda görünen sayaç öğesi (uçuş hedefi) */
  target(kind: HudKind): HTMLElement | null {
    const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-hud="${kind}"]`));
    return els.find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight; }) ?? null;
  },
};

function subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }
/** sayaç değeri: gerçek değer − yoldaki miktar; `bump` her varışta artar (zıplama animasyonu için anahtar) */
export function useHudCount(kind: HudKind, real: number): { value: number; bump: number } {
  const s = useSyncExternalStore(subscribe, () => snap, () => snap);
  return { value: Math.max(0, real - s[kind]), bump: kind === 'jeton' ? s.bj : s.bk };
}
