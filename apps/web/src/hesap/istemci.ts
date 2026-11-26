/**
 * 1.2.0 hesap kurtarma: POST /kurtarma (oturumsuz; yeni kurulumda ve oturumu başka cihaza taşınmış cihazda da çalışır).
 * Sunucu: apps/server/src/kurtarma.ts. Bu sürümde kod e-postayla elle gönderilir (en geç 24 saat).
 */
import { serverHttpEndpoint, type KurtarmaIstek, type KurtarmaYanit } from '@odi/shared';
import { platform } from '../platform';

/** kurtarma ucu (sunucu adresi yoksa boş: giriş seçeneği gösterilmez) */
export const kurtarmaUcu = (): string => serverHttpEndpoint(platform().serverUrl(), 'kurtarma');

const CIHAZ = 'odi.kurtarma.cihaz';
/** yalnız istek sınırı için cihazda rastgele üretilen kimlik (sunucu saklamaz; en çok bir gün bellekte) */
function cihazKimligi(): string {
  try {
    let v = localStorage.getItem(CIHAZ);
    if (!v || !/^[A-Za-z0-9_-]{8,64}$/.test(v)) { v = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem(CIHAZ, v); }
    return v;
  } catch { return ''; }
}

export async function kurtarmaIstegi(body: KurtarmaIstek): Promise<KurtarmaYanit> {
  const url = kurtarmaUcu();
  if (!url) return { ok: false, error: 'Sunucu adresi yok.' };
  const govde = body.istek === 'kod' ? { ...body, cihaz: cihazKimligi() || undefined } : body;
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(govde) });
    const j = await r.json().catch(() => null) as KurtarmaYanit | null;
    if (j && typeof j === 'object' && 'ok' in j) return j;
    return { ok: false, error: r.status === 429 ? 'Çok sık istek gönderildi. Biraz sonra yeniden dene.' : 'Sunucu yanıt vermedi; bir daha dener misin?' };
  } catch { return { ok: false, error: 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol edip yeniden dene.' }; }
}
