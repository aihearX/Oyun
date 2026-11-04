/**
 * Mağaza fiyat gösterimi (YN-032). Oyuncu ödeyeceği tutarı mağazanın kendi biçimiyle görür: mobil kabuk RevenueCat'ten
 * ürünlerin `priceString` değerini köprüyle verir. Fiyat gelmezse (web, Expo Go, çevrimdışı, RevenueCat yok) gösterilen tek fiyat
 * `SHOP.priceTry` TL liste fiyatıdır: gerçek mağazada notu "ödenecek tutarı mağazanın onay penceresi gösterir", TEST mağazasında
 * "para çekilmez" (olmayan bir mağaza fiyatı vaat edilmez; YN-073, OT-ekonomi-denetci-7).
 * Yanlış para birimi gösterilmez: ya listedeki her ürünün mağaza fiyatı (hepsi aynı para biriminde) ya da hepsi TL.
 * Sunucu satın almayı ve aylık harcama sınırını TL liste fiyatıyla sayar; sınır her zaman TL gösterilir.
 */
import type { ShopProduct, SpendState, StorePrice } from '@odi/shared';

/** gerçek mağaza, mağaza fiyatı gelmediğinde: ödenecek tutarı mağazanın kendi onay penceresi gösterir */
export const STORE_PRICE_NOTE = 'Ödeyeceğin tutarı App Store / Google Play kendi onay penceresinde gösterir';

/** mağaza kipi: gerçek satın alma, TEST mağazası (para çekilmez) ya da kapalı */
export type ShopMode = 'real' | 'test' | 'closed';

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

/** listenin üstündeki not (yalnız TL liste fiyatı gösterilirken): TEST'te para çekilmez, gerçekte mağazanın penceresi */
export function listPriceNote(mode: ShopMode): string {
  return `Fiyatlar TL liste fiyatıdır. ${mode === 'test' ? 'TEST mağazasında para çekilmez' : STORE_PRICE_NOTE}.`;
}

/** satın alma penceresindeki "ödenecek tutar" cümlesi: tek ve net; TEST'te ödeme yok, gerçekte mağaza fiyatı ya da mağazanın penceresi */
export function payLine(mode: ShopMode, p: { id: string; priceTry: number }, prices: StorePriceMap): string {
  if (mode === 'test') return `Bu bir test alımı: hesabından para çekilmez (liste fiyatı ${fmtTry(p.priceTry)}).`;
  const s = prices?.get(p.id);
  return s ? `Ödenecek tutar: ${s.priceString} (mağaza fiyatı).` : `${STORE_PRICE_NOTE}; liste fiyatı ${fmtTry(p.priceTry)}.`;
}

/**
 * Aylık harcama sınırı engeli (karar 28; sunucu shop.ts ile aynı kural): liste düğmesi ve onay penceresi bunu kullanır.
 * null = alınabilir. Sınır henüz seçilmediyse engel yok: ilk alımdan önce oyuncu sınırı seçer (OT-ekonomi-denetci-18).
 */
export function limitBlock(sp: Pick<SpendState, 'limitChosen' | 'monthTry' | 'limitTry'>, priceTry: number): string | null {
  if (!sp.limitChosen) return null;
  if (sp.monthTry + priceTry <= sp.limitTry + 1e-9) return null;
  return sp.limitTry <= 0 ? 'Satın alma kapalı (aylık sınır)' : 'Aylık sınırını aşıyor';
}

export const BEST_VALUE_LABEL = 'Kristal paketlerinde en iyi değer';
/** yalnız kristal içeren, sınırsız alınan paketler (Başlangıç ve Sezon Kartı tek seferlik, karışık içerikli: karşılaştırmaya girmez) */
export const isCrystalPack = (p: Pick<ShopProduct, 'limit' | 'contents'>) => p.limit === 0 && p.contents.length > 0 && p.contents.every((c) => c.kind === 'kristal');
/** TL liste fiyatıyla lira başına kristal */
export const crystalsPerTry = (p: Pick<ShopProduct, 'priceTry' | 'contents'>) => p.contents.reduce((a, c) => a + (c.kind === 'kristal' ? c.amount : 0), 0) / p.priceTry;

/**
 * "En iyi değer" rozeti gerçek oranlardan hesaplanır (OT-ekonomi-denetci-34): kristal paketleri arasında lira başına en çok kristal
 * veren tek paket; eşitlik ya da ikiden az paket varsa rozet yok. Sezon Kartı 28 güne yayıldığı için karşılaştırmada değil, bu yüzden
 * rozet bağlamını söyler: "Kristal paketlerinde en iyi değer".
 */
export function bestValue(products: readonly Pick<ShopProduct, 'id' | 'limit' | 'contents' | 'priceTry'>[]): { id: string; perTry: number } | null {
  const packs = products.filter(isCrystalPack).map((p) => ({ id: p.id, perTry: crystalsPerTry(p) })).sort((a, b) => b.perTry - a.perTry);
  if (packs.length < 2 || packs[0]!.perTry - packs[1]!.perTry < 1e-9) return null;
  return packs[0]!;
}
/** "4,7": bir ondalık, Türkçe virgül */
export const fmtPerTry = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
