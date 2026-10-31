import { humanHand, skillHand } from '@odi/game-core/play/human';
import { hashString } from '@odi/shared';
import type { LevelOptions } from '@odi/game-core/lite';

/**
 * YALNIZ TEST DERLEMESİ (VITE_ODI_E2E=1). App.tsx bu modülü yalnız `__ODI_E2E__` doğruyken ve `&oyun-beceri=` verilince
 * `import()` ile yükler; üretim derlemesinde ne parametre ne bu modül vardır (tools/harness/oyuncu.mjs README'sindeki grep).
 *
 * Oyuncu ajanları (docs/yonetim/oyuncu-testi/README.md) bölümü harness botuna oynatır; bot kusursuz planlayıcı yerine
 * play/human.ts el modeliyle oynar: beceri 0 (hiç oynamamış) … 1 (kusursuz). Her deneme başka bir "el" (tohum): yeniden denemede
 * sonuç değişebilir, gerçek oyuncu gibi. `tohum` verilirse deneme dizisi tekrarlanabilir.
 */
export interface OyuncuEliBilgi { beceri: number; deneme: number; model: 'kusursuz' | 'ilk-kez' | 'kitle' }
declare global { interface Window { __odiEl?: OyuncuEliBilgi } }

export function oyuncuEli(beceri: number, tohum: number | null): LevelOptions['botHand'] {
  let n = 0;
  const base = tohum ?? Math.floor(Math.random() * 1e9);
  return (w) => {
    const k = base + n++;
    const params = skillHand(beceri, k);
    window.__odiEl = { beceri, deneme: k, model: params ? (beceri < 0.25 ? 'ilk-kez' : 'kitle') : 'kusursuz' };
    if (!params) return { prefs: {} };
    return humanHand(w, hashString(`oyuncu:${k}`), params);
  };
}
