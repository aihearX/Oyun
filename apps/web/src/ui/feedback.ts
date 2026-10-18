/**
 * Global dokunma geri bildirimi (tek yerden, olay delegasyonu):
 * - ilk dokunuşta ses kilidini açar (iOS: ses ancak bir kullanıcı hareketinden sonra çalar),
 * - her düğmeye basınca hafif 'tap' (sekme → 'tab', geri → 'back', seçim → 'toggle').
 * Görsel basma (ölçek/çökme) CSS :active ile.
 */
import { audio, type Sfx } from '@odi/audio';

function soundFor(el: Element): Sfx | null {
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return null;
  if (el.closest('.cel-root.on')) return null; // kutlama kendi seslerini çalar
  if (el.classList.contains('tab') || el.classList.contains('subtab')) return 'tab';
  const label = (el.getAttribute('aria-label') ?? '') + ' ' + (el.textContent ?? '').trim().slice(0, 2);
  if (/^Geri|^←/.test(label.trim()) || el.getAttribute('aria-label') === 'Geri' || el.getAttribute('aria-label') === 'Kapat') return 'back';
  if (el.matches('.seg button, .chip-btn, .swatch, .emoji-opt, .wtile, .quick')) return 'toggle';
  return 'tap';
}

let installed = false;
export function installUiFeedback(): () => void {
  if (installed) return () => undefined;
  installed = true;
  const unlock = () => audio.unlock();
  const down = (e: Event) => {
    unlock();
    const t = e.target as Element | null; if (!t || !('closest' in t)) return;
    const el = t.closest('button, .btn, [role="button"], [role="tab"], a[href], .menu-tile, .region');
    if (!el) return;
    const s = soundFor(el); if (s) audio.play(s, { vol: 0.9 });
  };
  // iOS bazı sürümlerde kilidi yalnızca touchend/click'te açar: hepsinde dene (ucuz, idempotent)
  addEventListener('pointerdown', down, { passive: true, capture: true });
  addEventListener('touchend', unlock, { passive: true, capture: true });
  addEventListener('click', unlock, { passive: true, capture: true });
  addEventListener('keydown', unlock, { capture: true });
  return () => { installed = false; removeEventListener('pointerdown', down, { capture: true }); removeEventListener('touchend', unlock, { capture: true }); removeEventListener('click', unlock, { capture: true }); removeEventListener('keydown', unlock, { capture: true }); };
}
