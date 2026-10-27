/**
 * Cüzdan outbox'ı (MK-035): yerel meta ödüllerinin jetonu (`wallet.local`, ledgerId ile tek) ve çevrimdışı harcamalar
 * (`wallet.spend`) sunucuya sırayla buradan gider. React'e ve depoya bağımlı değildir (birim testi sahte istemciyle: outbox.test.ts).
 *
 * Kurallar:
 * - Kayıt yalnız sunucu yanıtı gelince (ya da sunucu kalıcı olarak reddedince) silinir; bağlantı kaynaklı hata (CEVRIMDISI, KOPTU,
 *   KAPALI) kaydı bir sonraki bağlanışa bırakır, geçici ret (HIZ, ZAMAN_ASIMI, SUNUCU) kısa süre sonra yeniden dener.
 *   Sunucu ledgerId ile tek yazar: yanıtı kaybolan istek aynı kimlikle yeniden gider, iki kez yazılmaz.
 * - Tur sürerken gelen tetik (bağlanınca, yeni ödül, yeniden deneme) kaybolmaz: "yeniden" bayrağı tutulur, tur bağlantı yüzünden
 *   kesildiyse ve bağlantı geri geldiyse tur hemen yeniden başlar.
 * - Sunucu yanıtındaki cüzdan uygulanır (wallet.updated olayı kaybolsa da üst çubuk sunucuyla aynı kalır).
 */
import { NetError, type NetClient } from '@odi/net';
import type { OpMap, Wallet } from '@odi/shared';

export type OutItem = { k: 'local'; ledgerId: string; jeton: number; reason: string } | { k: 'spend'; id: string; jeton: number; reason: string };

/** bağlantı kaynaklı: kayıt kalır, bir sonraki bağlanışta gider */
const OFFLINE = new Set(['CEVRIMDISI', 'KOPTU', 'KAPALI']);
/** bağlıyken geçici ret: kayıt kalır, `retryMs` sonra yeniden */
const TRANSIENT = new Set(['HIZ', 'ZAMAN_ASIMI']);
/** sunucuda beklenmeyen hata (ör. veritabanı meşgul): kayıt kalır, artan aralıkla yeniden (ödül sessizce düşmesin) */
const SERVER = 'SUNUCU';
const SERVER_RETRY_MAX_MS = 60_000;

export interface OutboxDeps {
  client: () => Pick<NetClient, 'status' | 'call'> | null;
  items: () => OutItem[];
  /** kaydı sil (durum + kalıcı depo + üst çubuk) */
  save: (items: OutItem[]) => void;
  /** sunucu yanıtındaki cüzdan */
  onWallet?: (wallet: Wallet) => void;
  onLocal?: (item: Extract<OutItem, { k: 'local' }>, res: OpMap['wallet.local']['res']) => void;
  onSpend?: (item: Extract<OutItem, { k: 'spend' }>, res: OpMap['wallet.spend']['res']) => void;
  /** çağrı yanıtsız sonlandı (bağlantı, geçici ret): `busy()` bitti, üst çubuk yeniden hesaplanabilir */
  onSettled?: () => void;
  /** tur outbox boşken bitti ve bu turda en az bir kayıt gitti (uzlaşma için) */
  onDrained?: () => void;
  /** geçici retten sonra bekleme (ms), varsayılan 1500 */
  retryMs?: number;
}

export interface OutboxStats { runs: number; again: number; reruns: number; retries: number; sent: number; dropped: number }
export interface Outbox {
  /** outbox'ı gönder; tur sürüyorsa onun sözünü döner (ve tur bitince gerekirse yeniden çalışır) */
  flush(): Promise<void>;
  /**
   * Bir wallet.local/spend çağrısı yanıt bekliyor mu. Sunucu wallet.updated olayını yanıttan ÖNCE yollar: bu arada üst çubuk
   * "yeni cüzdan + hâlâ bekleyen aynı kayıt" (fazla) gösterir. Çağıran bu sürede üst çubuğu güncellemez; yanıt cüzdanı getirir.
   */
  busy(): boolean;
  stats(): OutboxStats;
}

type End = 'bos' | 'kopuk' | 'bekle';

export function createOutbox(d: OutboxDeps): Outbox {
  const retryMs = d.retryMs ?? 1500;
  let running: Promise<void> | null = null;
  let again = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let serverFails = 0;
  let inflight = false;
  const st: OutboxStats = { runs: 0, again: 0, reruns: 0, retries: 0, sent: 0, dropped: 0 };
  const live = () => { const c = d.client(); return c && c.status === 'bağlı' ? c : null; };
  const retryLater = (ms: number) => {
    if (retryTimer) return;
    st.retries++;
    retryTimer = setTimeout(() => { retryTimer = null; void flush(); }, ms);
  };

  async function drain(): Promise<{ end: End; sent: number }> {
    let sent = 0;
    for (;;) {
      const c = live(); if (!c) return { end: 'kopuk', sent };
      const item = d.items()[0]; if (!item) return { end: 'bos', sent };
      let done: (() => void) | null = null;
      inflight = true;
      try {
        if (item.k === 'local') {
          const r = await c.call('wallet.local', { ledgerId: item.ledgerId, jeton: item.jeton, reason: item.reason });
          done = () => { d.onWallet?.(r.wallet); d.onLocal?.(item, r); };
        } else {
          const r = await c.call('wallet.spend', { jeton: item.jeton, reason: item.reason });
          done = () => { d.onWallet?.(r.wallet); d.onSpend?.(item, r); };
        }
        serverFails = 0;
        inflight = false;
      } catch (e) {
        inflight = false;
        try { d.onSettled?.(); } catch { /* tanı */ }
        const code = e instanceof NetError ? e.code : '';
        if (OFFLINE.has(code)) return { end: 'kopuk', sent };
        if (TRANSIENT.has(code)) { retryLater(retryMs); return { end: 'bekle', sent }; }
        if (code === SERVER) { serverFails++; retryLater(Math.min(SERVER_RETRY_MAX_MS, retryMs * 2 ** (serverFails - 1))); return { end: 'bekle', sent }; }
        // sunucu kalıcı olarak reddetti (ör. zaten alınmış yetenek, geçersiz kayıt): kayıt atılır, kuyruk takılmaz
        st.dropped++;
      }
      // önce kayıt silinir, sonra yanıttaki cüzdan uygulanır (ikisi aynı anda: üst çubuk ara değer göstermez)
      d.save(d.items().filter((x) => x !== item));
      if (done) { sent++; st.sent++; done(); }
    }
  }

  function flush(): Promise<void> {
    if (running) { again = true; st.again++; return running; }
    if (!live()) return Promise.resolve();
    st.runs++;
    running = (async () => {
      try {
        for (;;) {
          again = false;
          const r = await drain();
          if (r.end === 'bos' && r.sent > 0) { try { d.onDrained?.(); } catch { /* tanı */ } }
          // tur sürerken tetik geldiyse (ör. bağlantı koptu ve geri geldi: bekleyen istek KOPTU ile düştü, bağlanınca gelen tetik
          // "tur sürüyor" diye dönmüştü) hemen yeniden; geçici retlerde zamanlayıcı yeniden dener
          if (!again || r.end === 'bekle' || !live() || !d.items().length) break;
          st.reruns++;
        }
      } finally { running = null; }
    })();
    return running;
  }

  return { flush, busy: () => inflight, stats: () => ({ ...st }) };
}

/**
 * Uzlaşma (outbox boşalınca ve bağlanınca): gösterilen jeton = sunucu cüzdanı + bekleyenler olmalı. Değilse sunucu kazanır;
 * `diff` (gösterilen − olması gereken) tanı içindir.
 */
export function reconcileCoins({ shown, server, pending }: { shown: number; server: number; pending: number }): { coins: number; diff: number } {
  const coins = Math.max(0, server + pending);
  return { coins, diff: shown - coins };
}
