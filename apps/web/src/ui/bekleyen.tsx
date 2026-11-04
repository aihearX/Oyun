/**
 * Bağlantı yokken basılan istek (Klinik kararı, Kamp Görevleri "Al", Ödül kutusu "Al"/"Hepsini al"; OT-eski-telefon-26, -30, -33):
 * istek bağlantıyı bekler (net.ts `offlineWaitMs`) ve bağlanınca bir kez gider; düğme o arada kilitli. Düğme sessizce griye
 * dönmesin: yanında kamp yükseltmesindeki desenle ("Bağlanınca başlayacak", camp/model.ts) tek satır durur. Bağlantı gelince satır
 * kalkar; yanıt (ödül, sonuç) kısa süre sonra gelir.
 */
import { useNet } from '@odi/net/store';
import { Art } from './art';

export const BEKLEYEN_GONDER = 'Bağlanınca gönderilecek';
export const BEKLEYEN_AL = 'Bağlanınca alınacak';
/** basıldığı anda bağlantı yok mu (istek bağlantıyı bekleyecek) */
export const cevrimdisi = () => useNet.getState().status !== 'bağlı';

/** yalnız bağlantı yokken görünür */
export function BekleyenSatir({ text }: { text: string }) {
  const st = useNet((s) => s.status);
  if (st === 'bağlı') return null;
  return <div className="muted small-note" role="status" data-testid="bekleyen-istek"><Art name="signal" size={16} className="art-inline" /> {text}</div>;
}
