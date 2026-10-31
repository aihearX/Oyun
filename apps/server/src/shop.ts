import { PURCHASE_GIFT_REF, SHOP, SPEND_LIMIT_SUGGESTED_TRY, type PurchaseRecord, type ShopProduct, type SpendState } from '@odi/shared';
import { fail, rid, type App, type Grant, type Handlers } from './app';
import { systemMessage, teamRoom } from './chat';
import { passDaily } from './players';
import { createGift } from './teamextra';
import { DAY_MS, dayNumber, dayNumberStart, monthStart } from './time';

/**
 * Aylık harcama sınırı (karar 28): varsayılan sınır yok; oyuncu ilk satın almadan önce kendisi seçer (`spend_chosen`, göç 7).
 * Seçim ekranında önerilen değer SPEND_LIMIT_SUGGESTED_TRY (100 TL); seçilene kadar gösterilen sınır da odur.
 * Seçilmeden satın alma yapılamaz (SINIR_SEC). Düşürmek hemen; yükseltmek ayrı onay (confirmRaise) + LIMIT_RAISE_DELAY_MS.
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

export type ReceiptResult = { ok: true; transactionId: string } | { ok: false; error: string };

/**
 * Gerçek mağaza makbuzu doğrulaması (RevenueCat REST API).
 * REVENUECAT_API_KEY yoksa her zaman reddeder: sahte doğrulama yapılmaz.
 * İstemci RevenueCat'i appUserID = oyuncu kimliği ile yapılandırmalı; receipt = mağaza işlem kimliği.
 */
export async function verifyReceipt(apiKey: string | null, store: 'app-store' | 'play', productId: string, receipt: string | undefined, playerId: string): Promise<ReceiptResult> {
  if (!apiKey) return { ok: false, error: 'Gerçek mağaza satın alımları henüz doğrulanamıyor (sunucuda REVENUECAT_API_KEY tanımlı değil). Ödeme kabul edilmedi.' };
  if (!receipt) return { ok: false, error: 'Satın alma makbuzu (işlem kimliği) eksik.' };
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(playerId)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: `Makbuz doğrulama servisi hata verdi (${res.status}).` };
    const body = await res.json() as { subscriber?: { non_subscriptions?: Record<string, { id?: string; store_transaction_id?: string; store?: string }[]> } };
    const list = body.subscriber?.non_subscriptions?.[productId] ?? [];
    const wantStore = store === 'app-store' ? 'app_store' : 'play_store';
    const hit = list.find((t) => (t.store_transaction_id === receipt || t.id === receipt) && (!t.store || t.store === wantStore));
    if (!hit) return { ok: false, error: 'Makbuz doğrulanamadı: bu ürün için eşleşen bir işlem bulunamadı.' };
    return { ok: true, transactionId: `${store}:${hit.store_transaction_id ?? hit.id ?? receipt}` };
  } catch {
    return { ok: false, error: 'Makbuz doğrulama servisine ulaşılamadı; lütfen daha sonra tekrar dene.' };
  }
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
  return { monthTry: Math.round(monthTry * 100) / 100, limitTry, purchases, pendingLimitTry: p.spend_pending ?? null, pendingLimitAt: p.spend_pending_at ?? null, limitChosen: !!p.spend_chosen };
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

export const shopHandlers: Handlers = {
  'shop.list': (app, s) => ({
    products: SHOP.map((p) => ({ ...p, contents: p.contents.map((c) => ({ ...c })), ...(p.teamGift ? { teamGiftContents: teamGiftFor(p.priceTry) } : {}), bought: boughtCount(app, s.pid, p.id) })),
    spend: spendState(app, s.pid),
    testStore: app.cfg.testStore,
  }),
  'shop.purchase': async (app, s, { productId, store, receipt }) => {
    const prod = SHOP.find((p) => p.id === productId);
    if (!prod) return fail('YOK', 'Ürün bulunamadı.');
    let txId: string | null = null;
    if (store === 'test') {
      if (!app.cfg.testStore) fail('TEST_KAPALI', 'Test mağazası bu sunucuda kapalı.');
    } else {
      app.run(() => checkLimits(app, s.pid, prod)); // ödeme başlamadan önce de istemci shop.list ile kontrol etmeli
      const v = await verifyReceipt(app.cfg.revenueCatKey, store, productId, receipt, s.pid);
      if (!v.ok) return fail('MAKBUZ', v.error);
      txId = v.transactionId;
    }
    return app.run(() => {
      if (txId && app.db.get('SELECT 1 AS x FROM purchases WHERE receipt = ?', txId)) fail('TEKRAR', 'Bu makbuz zaten kullanıldı.');
      checkLimits(app, s.pid, prod);
      app.db.run('INSERT INTO purchases(id, player_id, product_id, at, store, amount_try, receipt) VALUES(?, ?, ?, ?, ?, ?, ?)', rid('s'), s.pid, prod.id, app.now(), store, prod.priceTry, txId);
      deliver(app, s.pid, prod);
      let teamGiftSent = false;
      const p = app.player(s.pid);
      if (prod.teamGift && p.team_id) {
        const others = app.teamMemberIds(p.team_id).filter((id) => id !== p.id);
        if (others.length) {
          createGift(app, p.team_id, { id: p.id, name: p.name }, `${p.name} takıma hediye gönderdi (${prod.name})`, teamGiftFor(prod.priceTry), others);
          systemMessage(app, teamRoom(p.team_id), `${p.name} takıma hediye gönderdi! Hediye kutunuza bakın.`, 'system', { product: prod.id });
          teamGiftSent = true;
        }
      }
      return { wallet: app.walletChanged(s.pid), spend: spendState(app, s.pid), teamGiftSent };
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
