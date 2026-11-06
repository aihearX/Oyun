/**
 * Bekleyen mağaza ödemeleri (YN-285): App Store / Google Play ödemeyi aldıktan sonra sunucu işlemi hesaba işleyemezse (bağlantı yok,
 * sunucu ya da RevenueCat yanıt vermedi) ürün kaybolmasın. React'e ve ağ istemcisine bağımlı değildir (birim testi: odeme-kuyrugu.test.ts,
 * telefon kabuğunda AsyncStorage benzeri depoyla apps/mobile/__tests__/odeme-kuyrugu.test.ts).
 *
 * Kurallar:
 * - Mağaza işlem kimliği (makbuz) sunucuya gönderilmeden ÖNCE kalıcı depoya yazılır (`odemeAlindi`); uygulama kapansa da kalır.
 * - Bağlanınca ve uygulama açılınca (`bosalt`) yeniden `shop.purchase` ile gönderilir. Sunucu aynı işlemi bir kez işler: bu hesaba
 *   zaten işlendiyse `already` ile başarı döner, kayıt "işlendi" sayılıp silinir. Kalıcı ret (başka hesaba işlenmiş, ürün yok)
 *   kaydı siler ve nedeni bildirir. Öteki her hata (bağlantı, zaman aşımı, RevenueCat'e ulaşılamadı) kaydı bırakır.
 * - Makbuzu hiç gelmeyen ödeme (mağaza işlemi yarıda kaldı, ödeme onay bekliyor): RevenueCat SDK'sı bitmemiş işlemi kendi tutar ve
 *   uygulama açılınca RevenueCat'e iletir; bu kayıt yalnız "tarama isteği"dir (`taramaIste`). Bağlanınca en çok TARAMA_ARALIK_MS'de bir
 *   sunucu RevenueCat'teki işlemleri okur (`shop.restore`) ve işlenmemiş olanı işler; TARAMA_OMUR_MS sonra istek kendiliğinden düşer.
 */
import type { OpMap } from '@odi/shared';

export type MagazaAdi = 'app-store' | 'play';
export interface BekleyenOdeme { playerId: string; productId: string; store: MagazaAdi; receipt: string; at: number; tries: number }
export interface TaramaIstegi { playerId: string; at: number; last: number }
type PurchaseRes = OpMap['shop.purchase']['res'];
type RestoreRes = OpMap['shop.restore']['res'];

export const ODEME_KUYRUGU_ANAHTARI = 'odi.magaza.bekleyen';
/** otomatik tarama en çok bu aralıkla (RevenueCat'e gereksiz istek gitmesin) */
export const TARAMA_ARALIK_MS = 5 * 60_000;
/** tarama isteği bu kadar sonra düşer (onay bekleyen ödeme günler sürebilir; "Satın alımları geri yükle" her zaman elle çalışır) */
export const TARAMA_OMUR_MS = 7 * 24 * 3_600_000;
/** sunucu kalıcı olarak reddetti: yeniden göndermek sonucu değiştirmez */
const KALICI = new Set(['BASKA_HESAP', 'YOK']);

export type GonderSonuc =
  | { k: 'islendi'; item: BekleyenOdeme; res: PurchaseRes }
  /** bu hesaba daha önce işlenmişti (yanıtı kaybolmuştu): ikinci kez verilmedi; eski sunucunun TEKRAR yanıtında res yok */
  | { k: 'zaten'; item: BekleyenOdeme; res?: PurchaseRes }
  | { k: 'ret'; item: BekleyenOdeme; code: string; message: string }
  | { k: 'bekle'; item: BekleyenOdeme; code: string; message: string };

export interface OdemeKuyruguDeps {
  storage: { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void> };
  purchase: (req: OpMap['shop.purchase']['req']) => Promise<PurchaseRes>;
  restore: () => Promise<RestoreRes>;
  now?: () => number;
}

export interface OdemeKuyrugu {
  /**
   * Mağaza ödemesi alındı (satın alma ekranı): makbuzu önce kalıcı yaz, sonra sunucuya gönder. Depoya yazılamazsa (dolu disk) yine
   * gönderilir; o durumda kaybolan işlemi sunucu taraması / "Satın alımları geri yükle" bulur.
   */
  odemeAlindi(item: Omit<BekleyenOdeme, 'at' | 'tries'>): Promise<GonderSonuc & { kalici: boolean }>;
  /** bu oyuncunun bekleyen kayıtlarını gönder, gerekirse tarama yap */
  bosalt(playerId: string): Promise<{ sonuclar: GonderSonuc[]; tarama: RestoreRes | null }>;
  /** makbuzu gelmeyen (yarım kalan / onay bekleyen) ödeme: sunucu bağlanınca RevenueCat'i tarasın */
  taramaIste(playerId: string): Promise<void>;
  /** elle geri yükleme başarılı oldu: otomatik taramaya gerek kalmadı */
  taramaBitti(playerId: string): Promise<void>;
  bekleyenler(playerId: string): Promise<BekleyenOdeme[]>;
  /** kayıt değişince (eklendi / silindi) */
  abone(fn: () => void): () => void;
}

interface Kayit { odemeler: BekleyenOdeme[]; tarama: TaramaIstegi[] }

const codeOf = (e: unknown): { code: string; message: string } => {
  const x = e as { code?: unknown; message?: unknown } | null;
  return { code: typeof x?.code === 'string' ? x.code : 'BILINMIYOR', message: typeof x?.message === 'string' ? x.message : 'Bilinmeyen hata' };
};

function gecerli(o: unknown): o is BekleyenOdeme {
  const x = o as BekleyenOdeme;
  return !!x && typeof x.playerId === 'string' && typeof x.productId === 'string' && typeof x.receipt === 'string' && !!x.receipt
    && (x.store === 'app-store' || x.store === 'play') && typeof x.at === 'number';
}

export function createOdemeKuyrugu(deps: OdemeKuyruguDeps): OdemeKuyrugu {
  const now = deps.now ?? Date.now;
  const listeners = new Set<() => void>();
  const ucusta = new Set<string>();
  let zincir: Promise<unknown> = Promise.resolve();

  async function oku(): Promise<Kayit> {
    try {
      const v = await deps.storage.getItem(ODEME_KUYRUGU_ANAHTARI);
      const j = v ? JSON.parse(v) as Partial<Kayit> : {};
      return {
        odemeler: Array.isArray(j.odemeler) ? j.odemeler.filter(gecerli).map((o) => ({ ...o, tries: typeof o.tries === 'number' ? o.tries : 0 })) : [],
        tarama: Array.isArray(j.tarama) ? j.tarama.filter((t) => t && typeof t.playerId === 'string' && typeof t.at === 'number').map((t) => ({ playerId: t.playerId, at: t.at, last: typeof t.last === 'number' ? t.last : 0 })) : [],
      };
    } catch { return { odemeler: [], tarama: [] }; }
  }
  /** oku-değiştir-yaz sırayla (aynı anda gelen ekleme/silme birbirini ezmesin); yazma hatası çağırana gider */
  function degistir<T>(fn: (k: Kayit) => T): Promise<T> {
    const p = zincir.then(async () => {
      const k = await oku();
      const r = fn(k);
      await deps.storage.setItem(ODEME_KUYRUGU_ANAHTARI, JSON.stringify(k));
      return r;
    });
    zincir = p.catch(() => undefined);
    return p.finally(() => { for (const f of listeners) { try { f(); } catch { /* dinleyici */ } } });
  }
  const sil = (receipt: string) => degistir((k) => { k.odemeler = k.odemeler.filter((o) => o.receipt !== receipt); }).catch(() => undefined);

  async function gonderItem(item: BekleyenOdeme): Promise<GonderSonuc> {
    ucusta.add(item.receipt);
    try {
      const res = await deps.purchase({ productId: item.productId, store: item.store, receipt: item.receipt });
      await sil(item.receipt);
      return res.already ? { k: 'zaten', item, res } : { k: 'islendi', item, res };
    } catch (e) {
      const { code, message } = codeOf(e);
      if (code === 'TEKRAR') { await sil(item.receipt); return { k: 'zaten', item }; }
      if (KALICI.has(code)) { await sil(item.receipt); return { k: 'ret', item, code, message }; }
      await degistir((k) => { const o = k.odemeler.find((x) => x.receipt === item.receipt); if (o) o.tries++; }).catch(() => undefined);
      return { k: 'bekle', item, code, message };
    } finally { ucusta.delete(item.receipt); }
  }

  return {
    async odemeAlindi(o) {
      const item: BekleyenOdeme = { ...o, at: now(), tries: 0 };
      ucusta.add(item.receipt); // yazılır yazılmaz başlayan bir bosalt turu bunu ikinci kez göndermesin (gonderItem bırakır)
      const kalici = await degistir((k) => { if (!k.odemeler.some((x) => x.receipt === item.receipt)) k.odemeler.push(item); }).then(() => true, () => false);
      return { ...(await gonderItem(item)), kalici };
    },
    async bosalt(playerId) {
      const k = await oku();
      const sonuclar: GonderSonuc[] = [];
      for (const item of k.odemeler.filter((o) => o.playerId === playerId)) {
        // tur sürerken başka yol (satın alma ekranı, ikinci tur) aynı kaydı göndermiş ya da işlemiş olabilir: iki kez gönderilmez
        if (ucusta.has(item.receipt) || !(await oku()).odemeler.some((o) => o.receipt === item.receipt)) continue;
        const r = await gonderItem(item);
        sonuclar.push(r);
        // bağlantı yoksa ötekiler de gitmez: bir sonraki bağlanışa
        if (r.k === 'bekle' && (r.code === 'CEVRIMDISI' || r.code === 'KAPALI' || r.code === 'KOPTU')) return { sonuclar, tarama: null };
      }
      const t = k.tarama.find((x) => x.playerId === playerId);
      if (!t) return { sonuclar, tarama: null };
      const simdi = now();
      if (simdi - t.at > TARAMA_OMUR_MS) { await degistir((kk) => { kk.tarama = kk.tarama.filter((x) => x.playerId !== playerId); }).catch(() => undefined); return { sonuclar, tarama: null }; }
      if (t.last && simdi - t.last < TARAMA_ARALIK_MS) return { sonuclar, tarama: null };
      await degistir((kk) => { const x = kk.tarama.find((y) => y.playerId === playerId); if (x) x.last = simdi; }).catch(() => undefined);
      try {
        const res = await deps.restore();
        if (res.restored.length) await degistir((kk) => { kk.tarama = kk.tarama.filter((x) => x.playerId !== playerId); }).catch(() => undefined);
        return { sonuclar, tarama: res };
      } catch { return { sonuclar, tarama: null }; }
    },
    async taramaIste(playerId) {
      await degistir((k) => {
        const t = k.tarama.find((x) => x.playerId === playerId);
        if (t) { t.at = now(); t.last = 0; } else k.tarama.push({ playerId, at: now(), last: 0 });
      }).catch(() => undefined);
    },
    async taramaBitti(playerId) {
      await degistir((k) => { k.tarama = k.tarama.filter((x) => x.playerId !== playerId); }).catch(() => undefined);
    },
    async bekleyenler(playerId) { return (await oku()).odemeler.filter((o) => o.playerId === playerId); },
    abone(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };
}
