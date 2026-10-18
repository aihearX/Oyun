/**
 * Ekranların doğrudan kullanabileceği küçük parçacık yardımcıları (yıldız ışıltısı, rekor konfetisi).
 * CelebrationLayer bağlanınca canvas motorunu kaydeder; yoksa ya da azaltılmış harekette hiçbir şey yapmaz.
 */
import type { Particles } from './particles';

let engine: Particles | null = null;
export function setFxEngine(p: Particles | null) { engine = p; }
const ok = () => { try { return !!engine && !matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return !!engine; } };
const at = (el: Element | null | undefined) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

export const fx = {
  confetti(el: Element | null | undefined, n = 70) { const p = at(el); if (p && ok()) engine!.confetti(p.x, p.y, n); },
  sparkle(el: Element | null | undefined, n = 16) { const p = at(el); if (p && ok()) { engine!.sparkle(p.x, p.y, n, 50); engine!.ring(p.x, p.y, '#ffe08a', 24); } },
  rain(n = 60) { if (ok()) engine!.rain(n); },
};
