import { PURCHASE_GIFT_REF, SHOP, isRestorable, SPEND_LIMIT_SUGGESTED_TRY, TEAM_GIFT_ANON, type PurchaseRecord, type ShopProduct, type SpendState } from '@odi/shared';
import { fail, rid, type App, type Grant, type Handlers } from './app';
import { systemMessage, teamRoom } from './chat';
import { PURCHASE_RETAIN_YEARS } from './account-veri';
import { passDaily } from './players';
import { createGift } from './teamextra';
import { DAY_MS, dayNumber, dayNumberStart, monthStart, nextMonthStart } from './time';

/**
 * Aylık harcama sınırı (karar 28): varsayılan sınır yok; oyuncu ilk satın almadan önce kendisi seçer (`spend_chosen`, göç 7).
 * Seçim ekranında önerilen değer SPEND_LIMIT_SUGGESTED_TRY (100 TL); seçilene kadar gösterilen sınır da odur.
 * Seçilmeden satın alma yapılamaz (SINIR_SEC). Düşürmek hemen; yükseltmek ayrı onay (confirmRaise) + LIMIT_RAISE_DELAY_MS.
 * Harcama sayacı takvim ayıdır (İstanbul): ayın 1'i 00:00'dan bu yana alınanlar sayılır; sonraki ayın 1'i 00:00'da sıfırlanır
 * (`resetAt`; mağaza "Kalan: … · 1 Aralık’ta sıfırlanır" diye bunu yazar, YN-197).
 */
export const SPEND_LIMIT_MAX_TRY = 10_000;
export const LIMIT_RAISE_DELAY_MS = DAY_MS;

/**
 * takım hediyesi içeriği ürün fiyatına göre sabittir (önceden belli, şans yok). Jetonu `PURCHASE_GIFT_REF` işaretlidir: alan
 * oyuncunun cüzdanında satın alma hediyesi jetonu olarak ayrı sayılır, takım teknolojisine bağışlanamaz (karar 29 / YN-065).
 */
export function teamGiftFor(priceTry: number): Grant[] {
  const jeton = priceTry < 50 ? 50 : priceTry < 100 ? 100 : 200;
  const kristal = priceTry < 50 ? 20 : priceTry < 100 ? 50 : 100;
  return [{ kind: 'kristal', amount: kristal, ref: '' }, { kind: 'jeton', amount: jeton, ref: PURCHASE_GIFT_REF }];
}

export type ReceiptResult = { ok: true; transactionId: string; at: number | null } | { ok: false; error: string };

/** RevenueCat v1 `GET /subscribers/<id>` yanıtında bizi ilgilendiren alanlar (store_transaction_id App Store'da sayı gelebilir) */
type RcTx = { id?: string; store_transaction_id?: string | number; store?: string; purchase_date?: string };
type RcSubscriber = { non_subscriptions?: Record<string, RcTx[]>; subscriptions?: Record<string, RcTx> };
type StoreName = 'app-store' | 'play';
const RC_STORE: Record<string, StoreName> = { app_store: 'app-store', play_store: 'play' };

/** mağaza işleminin sunucudaki tek anahtarı (`purchases.receipt`, UNIQUE): mağaza + mağazanın işlem numarası */
const txKey = (store: StoreName, t: RcTx, fallback = '') => `${store}:${String(t.store_transaction_id ?? t.id ?? fallback)}`;
const txAt = (t: RcTx): number | null => { const v = t.purchase_date ? Date.parse(t.purchase_date) : NaN; return Number.isFinite(v) ? v : null; };

/**
 * Bir ürünün RevenueCat'teki işlemleri. Tüketilebilir, tüketilmeyen ürün ve (Apple) yenilenmeyen abonelik RevenueCat'te
 * `non_subscriptions[<ürün>]` altında gelir (RevenueCat yenilenmeyen aboneliği bitiş tarihi bilmediği için abonelik saymaz).
 * Güvenlik payı: aynı kimlik bir gün `subscriptions` altında gelirse o kayıt da okunur.
 */
function productTxs(sub: RcSubscriber | undefined, productId: string): RcTx[] {
  const list = [...(sub?.non_subscriptions?.[productId] ?? [])];
  const s = sub?.subscriptions?.[productId];
  if (s && (s.store_transaction_id != null || s.id)) list.push(s);
  return list;
}

async function fetchSubscriber(apiKey: string, playerId: string): Promise<{ ok: true; sub: RcSubscriber | undefined } | { ok: false; error: string }> {
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(playerId)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: `Makbuz doğrulama servisi hata verdi (${res.status}).` };
    return { ok: true, sub: (await res.json() as { subscriber?: RcSubscriber }).subscriber };
  } catch {
    return { ok: false, error: 'Makbuz doğrulama servisine ulaşılamadı; lütfen daha sonra tekrar dene.' };
  }
}

const NO_KEY = 'Gerçek mağaza satın alımları bu sunucuda henüz doğrulanamıyor (sunucuda REVENUECAT_API_KEY tanımlı değil).';

/**
 * Gerçek mağaza makbuzu doğrulaması (RevenueCat REST API).
 * REVENUECAT_API_KEY yoksa her zaman reddeder: sahte doğrulama yapılmaz.
 * İstemci RevenueCat'i appUserID = oyuncu kimliği ile yapılandırmalı; receipt = mağaza işlem kimliği.
 */
export async function verifyReceipt(apiKey: string | null, store: StoreName, productId: string, receipt: string | undefined, playerId: string): Promise<ReceiptResult> {
  if (!apiKey) return { ok: false, error: NO_KEY };
  if (!receipt) return { ok: false, error: 'Satın alma makbuzu (işlem kimliği) eksik.' };
  const r = await fetchSubscriber(apiKey, playerId);
  if (!r.ok) return r;
  const wantStore = store === 'app-store' ? 'app_store' : 'play_store';
  const hit = productTxs(r.sub, productId).find((t) => (String(t.store_transaction_id) === receipt || t.id === receipt) && (!t.store || t.store === wantStore));
  if (!hit) return { ok: false, error: 'Makbuz doğrulanamadı: bu ürün için eşleşen bir işlem bulunamadı.' };
  return { ok: true, transactionId: txKey(store, hit, receipt), at: txAt(hit) };
}

/** satın alma kayıtlarının saklama sınırı (prunePurchases ile aynı): bundan eski işlem geri yüklemede yeniden işlenmez */
function purchaseCutoff(app: App): number {
  const y = Number(new Date(app.now() + 3 * 3_600_000).toISOString().slice(0, 4));
  return Date.UTC(y - PURCHASE_RETAIN_YEARS, 0, 1) - 3 * 3_600_000;
}

function effectiveLimit(app: App, pid: string): number {
  const p = app.player(pid);
  if (!p.spend_chosen) return SPEND_LIMIT_SUGGESTED_TRY;
  if (p.spend_pending != null && p.spend_pending_at != null && app.now() >= p.spend_pending_at) {
    app.db.run('UPDATE players SET spend_limit = ?, spend_pending = NULL, spend_pending_at = NULL WHERE id = ?', p.spend_pending, pid);
    return p.spend_pending;
  }
  return p.spend_limit;
}

export function spendState(app: App, pid: string): SpendState {
  const limitTry = effectiveLimit(app, pid);
  const since = monthStart(app.now());
  const monthTry = app.db.get<{ s: number | null }>('SELECT SUM(amount_try) AS s FROM purchases WHERE player_id = ? AND at >= ?', pid, since)!.s ?? 0;
  const purchases = app.db.all<PurchaseRecord>('SELECT id, product_id AS productId, at, store, amount_try AS amountTry FROM purchases WHERE player_id = ? ORDER BY at DESC LIMIT 30', pid).map((r) => ({ ...r }));
  const p = app.player(pid);
  return { monthTry: Math.round(monthTry * 100) / 100, limitTry, purchases, pendingLimitTry: p.spend_pending ?? null, pendingLimitAt: p.spend_pending_at ?? null, limitChosen: !!p.spend_chosen, resetAt: nextMonthStart(app.now()) };
}

const boughtCount = (app: App, pid: string, productId: string) => app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM purchases WHERE player_id = ? AND product_id = ?', pid, productId)!.n;

/** sınır kontrolleri (ürün sınırı + aylık harcama sınırı) */
function checkLimits(app: App, pid: string, prod: ShopProduct): void {
  if (prod.limit > 0 && boughtCount(app, pid, prod.id) >= prod.limit) fail('LIMIT', 'Bu ürünü satın alma sınırına ulaştın.');
  const sp = spendState(app, pid);
  if (!sp.limitChosen) fail('SINIR_SEC', 'Satın almadan önce aylık harcama sınırını seç (önerilen 100 TL).');
  if (sp.monthTry + prod.priceTry > sp.limitTry + 1e-9) fail('HARCAMA_SINIRI', `Bu satın alma aylık harcama sınırını (${sp.limitTry} TL) aşıyor. Sınırı ayarlardan değiştirebilirsin.`);
}

function deliver(app: App, pid: string, prod: ShopProduct): void {
  for (const c of prod.contents) {
    switch (c.kind) {
      case 'kristal': case 'jeton': case 'm5': case 'm60': case 's8': app.addCurrency(pid, c.kind, c.amount); break;
      case 'kozmetik': app.grant(pid, { kind: 'kozmetik', amount: 1, ref: c.ref ?? '' }); break;
      case 'pass': {
        // Sezon Kartı (karar 30): satın alınan gün 1. gün; süren kart varsa günler ona eklenir. pass_until yalnız gösterim/uyumluluk:
        // son günün bittiği an (İstanbul gece yarısı), 29. günün sabahı fazladan ödeme olmaz (ödeme pass_paid ile sayılır).
        passDaily(app, pid); // önceki kartın birikmiş günleri önce ödenir
        const p = app.player(pid);
        const active = p.pass_start > 0 && p.pass_paid < p.pass_days;
        const start = active ? p.pass_start : dayNumber(app.now());
        const days = (active ? p.pass_days : 0) + c.amount;
        const paid = active ? p.pass_paid : 0;
        app.db.run('UPDATE players SET pass_start = ?, pass_days = ?, pass_paid = ?, pass_until = ? WHERE id = ?', start, days, paid, dayNumberStart(start + days), pid);
        passDaily(app, pid);
        break;
      }
    }
  }
}

/** satın almayı kaydet, içeriği ver, takım hediyesini gönder (app.run içinde çağrılır); takım hediyesi gitti mi */
function recordAndDeliver(app: App, pid: string, prod: ShopProduct, store: 'test' | StoreName, txId: string | null, at: number): boolean {
  app.db.run('INSERT INTO purchases(id, player_id, product_id, at, store, amount_try, receipt) VALUES(?, ?, ?, ?, ?, ?, ?)', rid('s'), pid, prod.id, at, store, prod.priceTry, txId);
  deliver(app, pid, prod);
  const p = app.player(pid);
  if (!prod.teamGift || !p.team_id) return false;
  const others = app.teamMemberIds(p.team_id).filter((id) => id !== p.id);
  if (!others.length) return false;
  // adsız (karar 39): alıcının kimliği yalnız sunucuda (hesap verisi için), ad hiçbir yerde yazılmaz
  createGift(app, p.team_id, { id: p.id, name: TEAM_GIFT_ANON.fromName }, TEAM_GIFT_ANON.reason(prod.name), teamGiftFor(prod.priceTry), others);
  systemMessage(app, teamRoom(p.team_id), TEAM_GIFT_ANON.chat, 'system', { product: prod.id });
  return true;
}

/** mağaza işlemi kime işlendi: null (hiçbir hesaba), oyuncu kimliği ya da silinen hesapta "silinmis" */
const processedFor = (app: App, txId: string) => app.db.get<{ player_id: string }>('SELECT player_id FROM purchases WHERE receipt = ?', txId)?.player_id ?? null;

const BASKA_HESAP = 'Bu mağaza işlemi başka bir oyun hesabına işlenmiş; aynı işlem ikinci bir hesaba verilmez.';
/** doğrulanan işlemin zamanı: mağazadaki satın alma anı (gelecekte ya da okunamazsa şimdi); aylık harcama ve geçmiş bu zamanla */
const paidAt = (app: App, at: number | null) => (at != null && at <= app.now() ? at : app.now());

/** geri yüklemede oyuncu başına en kısa aralık (RevenueCat isteği; düğmeye art arda basılınca) */
export const RESTORE_MIN_INTERVAL_MS = 10_000;
const lastRestore = new Map<string, number>();

export const shopHandlers: Handlers = {
  'shop.list': (app, s) => ({
    products: SHOP.map((p) => ({ ...p, contents: p.contents.map((c) => ({ ...c })), ...(p.teamGift ? { teamGiftContents: teamGiftFor(p.priceTry) } : {}), bought: boughtCount(app, s.pid, p.id) })),
    spend: spendState(app, s.pid),
    testStore: app.cfg.testStore,
    realStore: !!app.cfg.revenueCatKey,
  }),
  // ödeme başlamadan önce: ürün sınırı ve aylık sınır (ödeme alındıktan sonra sınır yüzünden reddetmek parayı ürünsüz bırakırdı)
  'shop.check': (app, s, { productId }) => {
    const prod = SHOP.find((p) => p.id === productId);
    if (!prod) return fail('YOK', 'Ürün bulunamadı.');
    checkLimits(app, s.pid, prod);
    return { ok: true as const };
  },
  'shop.purchase': async (app, s, { productId, store, receipt }) => {
    const prod = SHOP.find((p) => p.id === productId);
    if (!prod) return fail('YOK', 'Ürün bulunamadı.');
    if (store === 'test') {
      if (!app.cfg.testStore) fail('TEST_KAPALI', 'Test mağazası bu sunucuda kapalı.');
      return app.run(() => {
        checkLimits(app, s.pid, prod);
        const teamGiftSent = recordAndDeliver(app, s.pid, prod, 'test', null, app.now());
        return { wallet: app.walletChanged(s.pid), spend: spendState(app, s.pid), teamGiftSent };
      });
    }
    // Gerçek mağaza: para alınmıştır. Aynı işlem idempotent (bekleyen ödeme kuyruğu ve geri yükleme yeniden gönderir): bu hesaba
    // işlendiyse yeniden verilmez ama başarı döner (`already`); başka hesaba işlendiyse ikinci hesaba verilmez (BASKA_HESAP).
    const already = () => ({ wallet: app.walletChanged(s.pid), spend: spendState(app, s.pid), teamGiftSent: false, already: true });
    if (receipt) {
      const row = app.db.get<{ player_id: string; product_id: string }>('SELECT player_id, product_id FROM purchases WHERE receipt = ?', `${store}:${receipt}`);
      if (row && row.player_id !== s.pid) return fail('BASKA_HESAP', BASKA_HESAP);
      if (row && row.product_id !== prod.id) return fail('MAKBUZ', 'Makbuz doğrulanamadı: bu işlem başka bir ürüne ait.');
      if (row) return app.run(already);
    }
    const v = await verifyReceipt(app.cfg.revenueCatKey, store, productId, receipt, s.pid);
    if (!v.ok) return fail('MAKBUZ', v.error);
    return app.run(() => {
      const owner = processedFor(app, v.transactionId);
      if (owner === s.pid) return already();
      if (owner) fail('BASKA_HESAP', BASKA_HESAP);
      // doğrulanmış ödeme: ürün ve aylık sınır ödemeden önce (shop.check) denetlendi; burada reddedilmez
      const teamGiftSent = recordAndDeliver(app, s.pid, prod, store, v.transactionId, paidAt(app, v.at));
      return { wallet: app.walletChanged(s.pid), spend: spendState(app, s.pid), teamGiftSent };
    });
  },
  /**
   * Satın alımları geri yükle (Apple 3.1.1: tüketilmeyen ürün ve yenilenmeyen abonelik) ve ödemesi alınıp hiç işlenmemiş işlemleri
   * tamamla (YN-285: istemcinin kuyruğu kaybolsa da). RevenueCat'te bu oyuncunun (appUserID) bütün mağaza işlemleri okunur:
   * - hiçbir hesaba işlenmemiş → bu hesaba işlenir (içerik ve takım hediyesi; sınırlar ödemeden önce denetlenmişti);
   * - bu hesaba işlenmiş → yeniden verilmez (tüketilebilir paketler harcanmıştır; kalıcı içerik zaten hesapta);
   * - başka hesaba (ya da silinen hesaba) işlenmiş → verilmez. RevenueCat geri yüklemede işlemi yeni appUserID'ye taşısa da
   *   (Transfer davranışı) sahiplik sunucudaki `purchases.receipt` kaydıdır.
   */
  'shop.restore': async (app, s) => {
    if (!app.cfg.revenueCatKey) return fail('MAKBUZ', NO_KEY);
    const now = app.now();
    const last = lastRestore.get(s.pid);
    if (last != null && now - last < RESTORE_MIN_INTERVAL_MS && now >= last) return fail('HIZ', 'Geri yükleme az önce denendi; birkaç saniye sonra yeniden dene.');
    lastRestore.set(s.pid, now);
    if (lastRestore.size > 5000) for (const [k, t] of lastRestore) if (now - t > RESTORE_MIN_INTERVAL_MS) lastRestore.delete(k);
    const r = await fetchSubscriber(app.cfg.revenueCatKey, s.pid);
    if (!r.ok) return fail('MAKBUZ', r.error);
    return app.run(() => {
      const restored: { productId: string; store: StoreName }[] = []; const here = new Set<string>(); const elsewhere = new Set<string>();
      let teamGiftSent = false;
      const cutoff = purchaseCutoff(app);
      for (const prod of SHOP) {
        for (const t of productTxs(r.sub, prod.id)) {
          const store = t.store ? RC_STORE[t.store] : undefined;
          if (!store || (t.store_transaction_id == null && !t.id)) continue; // promosyon / başka mağaza: bizim satışımız değil
          const at = txAt(t);
          if (at != null && at < cutoff) continue; // saklama süresi geçmiş (kaydı silinmiş) eski işlem yeniden işlenmez
          const key = txKey(store, t);
          const owner = processedFor(app, key);
          if (owner === s.pid) { if (isRestorable(prod)) here.add(prod.id); continue; }
          if (owner) { elsewhere.add(prod.id); continue; }
          if (recordAndDeliver(app, s.pid, prod, store, key, paidAt(app, at))) teamGiftSent = true;
          restored.push({ productId: prod.id, store });
        }
      }
      return { restored, alreadyHere: [...here].filter((id) => !restored.some((x) => x.productId === id)), elsewhere: [...elsewhere], wallet: app.walletChanged(s.pid), spend: spendState(app, s.pid), teamGiftSent };
    });
  },
  'shop.limit': (app, s, { limitTry, confirmRaise }) => {
    const chosen = !!app.player(s.pid).spend_chosen;
    const current = effectiveLimit(app, s.pid);
    // ilk seçim (karar 28): hangi değer seçilirse hemen geçerli; düşürmek hemen; yükseltmek ayrı onay + 24 saat
    if (!chosen || limitTry <= current) app.db.run('UPDATE players SET spend_limit = ?, spend_pending = NULL, spend_pending_at = NULL, spend_chosen = 1 WHERE id = ?', limitTry, s.pid);
    else if (!confirmRaise) fail('ONAY', 'Sınırı yükseltmek için ayrıca onay vermelisin.');
    else app.db.run('UPDATE players SET spend_pending = ?, spend_pending_at = ? WHERE id = ?', limitTry, app.now() + LIMIT_RAISE_DELAY_MS, s.pid);
    return { spend: spendState(app, s.pid) };
  },
};
