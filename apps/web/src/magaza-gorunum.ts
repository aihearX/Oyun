/**
 * Mağaza girişlerinin görünürlüğü (1.3.0).
 * - Kabuk `platform().shopHidden` derken her zaman gizli (eski kabuk kararı, ör. anahtarsız derleme).
 * - Sunucu `GET /surum` yanıtında `"magaza":"gizli"` derse de gizli: mağaza yayına hazır değilken yeni derleme almadan kapatmak için
 *   (sunucuda ODI_MAGAZA_GIZLI=1). Yanıt gelene kadar ve ağ hatasında son bilinen değer (bu cihazda saklı) geçerlidir.
 */
import { useSyncExternalStore } from 'react';
import { serverHttpEndpoint } from '@odi/shared';
import { platform } from './platform';

const ANAHTAR = 'odi.magazaGizli';
const dinleyenler = new Set<() => void>();
let sunucuGizli = ((): boolean => { try { return localStorage.getItem(ANAHTAR) === '1'; } catch { return false; } })();

/** /surum gövdesinden: mağaza gizli mi */
export const yanittanGizli = (body: unknown): boolean => !!body && typeof body === 'object' && (body as Record<string, unknown>).magaza === 'gizli';

export function sunucuMagazaGizliAyarla(v: boolean): void {
  if (v === sunucuGizli) return;
  sunucuGizli = v;
  try { if (v) localStorage.setItem(ANAHTAR, '1'); else localStorage.removeItem(ANAHTAR); } catch { /* yok */ }
  for (const f of dinleyenler) f();
}

/** şu an gizli mi (olay işleyicileri için) */
export const magazaGizli = (): boolean => !!platform().shopHidden || sunucuGizli;

/** bileşenlerde: sunucu kararı gelince yeniden çizilir */
export function useMagazaGizli(): boolean {
  const s = useSyncExternalStore((f) => { dinleyenler.add(f); return () => { dinleyenler.delete(f); }; }, () => sunucuGizli, () => sunucuGizli);
  return !!platform().shopHidden || s;
}

/** açılışta bir kez: sunucunun mağaza kararını oku. Hiçbir durumda fırlatmaz. */
export async function magazaDurumunuYukle(serverUrl: string, f: typeof fetch | null = typeof fetch === 'function' ? fetch : null): Promise<void> {
  try {
    const url = serverHttpEndpoint(serverUrl, 'surum'); if (!url || !f) return;
    const r = await f(url, { method: 'GET', cache: 'no-store' });
    if (!r.ok) return;
    sunucuMagazaGizliAyarla(yanittanGizli(await r.json()));
  } catch { /* ağ yok: son bilinen değer */ }
}
