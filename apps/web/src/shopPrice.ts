/**
 * Mağaza fiyat gösterimi (YN-032). Oyuncu ödeyeceği tutarı mağazanın kendi biçimiyle görür: mobil kabuk RevenueCat'ten
 * ürünlerin `priceString` değerini köprüyle verir. Fiyat gelmezse (web, Expo Go, çevrimdışı, RevenueCat yok) gösterilen tek fiyat
 * `SHOP.priceTry` TL liste fiyatıdır ve yanında "Mağaza fiyatı satın alırken gösterilir" notu durur.
 * Yanlış para birimi gösterilmez: ya listedeki her ürünün mağaza fiyatı (hepsi aynı para biriminde) ya da hepsi TL.
 * Sunucu satın almayı ve aylık harcama sınırını TL liste fiyatıyla sayar; sınır her zaman TL gösterilir.
 */
import type { StorePrice } from '@odi/shared';

export const STORE_PRICE_NOTE = 'Mağaza fiyatı satın alırken gösterilir';

/** TL liste fiyatı (sunucunun saydığı tutar; aylık sınır ve satın alma geçmişi) */
export const fmtTry = (n: number) => `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;

/** ürün kimliği → mağazanın biçimlediği fiyat; null = mağaza fiyatı yok, TL liste fiyatı gösterilir */
export type StorePriceMap = ReadonlyMap<string, StorePrice> | null;

/**
 * Köprüden gelen veriyi doğrula (JSON'dan gelir: tür güvencesi yok). Listedeki her ürün için boş olmayan bir `priceString`
 * ve ISO 4217 para birimi olmalı, hepsi aynı para biriminde olmalı; biri bile eksik ya da tutarsızsa null (hepsi TL'ye düşer).
 */
export function storePriceMap(ids: readonly string[], raw: unknown): StorePriceMap {
  if (!Array.isArray(raw) || ids.length === 0) return null;
  const m = new Map<string, StorePrice>();
  for (const r of raw as unknown[]) {
    if (!r || typeof r !== 'object') continue;
    const { id, priceString, currencyCode } = r as Record<string, unknown>;
    if (typeof id !== 'string' || typeof priceString !== 'string' || typeof currencyCode !== 'string') continue;
    const ps = priceString.trim(), cc = currencyCode.trim().toUpperCase();
    if (!ps || !/^[A-Z]{3}$/.test(cc)) continue;
    m.set(id, { id, priceString: ps, currencyCode: cc });
  }
  const picked = ids.map((id) => m.get(id));
  if (picked.some((p) => !p)) return null;
  const cur = picked[0]!.currencyCode;
  if (picked.some((p) => p!.currencyCode !== cur)) return null;
  return new Map(picked.map((p) => [p!.id, p!]));
}

/** ürünün gösterilecek fiyatı: mağaza fiyatı varsa o, yoksa TL liste fiyatı (`store: false` → not gösterilir) */
export function priceLabel(p: { id: string; priceTry: number }, prices: StorePriceMap): { text: string; store: boolean } {
  const s = prices?.get(p.id);
  return s ? { text: s.priceString, store: true } : { text: fmtTry(p.priceTry), store: false };
}

/**
 * Köprü işlevini çağır, doğrula; hata, geçersiz yanıt ya da zaman aşımında null. Kabuk yalnız gerçek satın alma açıkken verir.
 * playerId: RevenueCat kullanıcı kimliği (satın almadakiyle aynı).
 */
export async function loadStorePrices(
  fn: ((ids: string[], playerId: string) => Promise<StorePrice[]>) | undefined,
  ids: readonly string[], playerId: string, timeoutMs = 6000,
): Promise<StorePriceMap> {
  if (!fn || ids.length === 0) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const raw = await Promise.race([
      fn([...ids], playerId),
      new Promise<null>((res) => { timer = setTimeout(() => res(null), timeoutMs); }),
    ]);
    return storePriceMap(ids, raw);
  } catch { return null; } finally { if (timer) clearTimeout(timer); }
}
