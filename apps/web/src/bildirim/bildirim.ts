/**
 * Anlık bildirimler (1.3.0), web katmanı. Telefon kabuğu (apps/mobile/src/bildirim.ts) izin, anahtar ve "telefon ayarlarını aç"
 * yeteneklerini platform köprüsüyle verir (platform().push); tarayıcıda yoktur ve burada hiçbir şey yapılmaz.
 *
 * - Bağlanınca ve uygulama öne gelince: izin varsa cihazın anahtarı sunucuya yazılır ('push.register'; hesap değişince anahtar yeni
 *   hesaba geçer), izin kapandıysa bu cihazın anahtarı silinir ('push.unregister'). Ayarlar sunucudan okunur.
 * - Uygulama arka plana geçince sunucuya 'push.away' gider: bağlantı bir süre açık kalsa da bildirimler gelir.
 * - İzin ilk açılışta sorulmaz. İlk özel mesajı gönderince bir kez oyun içi ön soru (BildirimHost) çıkar; "Evet" derse sistemin izin
 *   penceresi açılır. Ayarlar › Bildirimler'de bir tür açılınca da izin istenir.
 * - Bildirime dokununca kabuk veriyi ({kind, id}) iletir; BildirimHost ilgili yere götürür (oyuncu bölümdeyse bölüm bitince).
 * Ağ istemcisi net.ts'ten bağlanır (bindPush); bu dosya net.ts'i içe aktarmaz.
 */
import { create } from 'zustand';
import type { NetClient } from '@odi/net';
import type { PushHedef, PushKategori, PushSettings, PushVeri } from '@odi/shared';
import { platform, type PushIzin } from '../platform';

interface BildirimState {
  /** sunucudaki bildirim türleri (bağlanınca okunur) */
  settings: PushSettings | null;
  /** telefonun bildirim izni (bilinmiyorsa null) */
  izin: PushIzin | null;
  /** oyun içi ön soru açık mı */
  onIzin: boolean;
}
export const useBildirim = create<BildirimState>()(() => ({ settings: null, izin: null, onIzin: false }));

const K = { token: 'odi.push.token', soruldu: 'odi.push.soruldu' } as const;
let bound: NetClient | null = null;
let onde = true;

/** bu cihazda anlık bildirim var mı (yalnız telefon kabuğu) */
export const pushDestekli = () => !!platform().push;
/** bağlı istemci (Ayarlar kartı) */
export const pushNet = () => bound;

/** net.ts startNet: bağlanınca anahtar ve ayarlar eşitlenir */
export function bindPush(c: NetClient): void {
  if (bound === c) return;
  bound = c;
  c.onStatus((st) => { if (st === 'bağlı') void eslestir(); });
  // kabuğun AppState sinyaline ek olarak sayfa görünürlüğü (WebView arka plana geçerken de değişir); yalnız telefon kabuğunda
  try {
    document.addEventListener('visibilitychange', () => { if (pushDestekli()) uygulamaOnde(document.visibilityState === 'visible'); });
  } catch { /* belge yok */ }
  if (c.status === 'bağlı') void eslestir();
}

let suruyor: Promise<void> | null = null;
/** izin durumu → anahtar kaydı ya da silinmesi → ayarlar (aynı anda tek) */
export function eslestir(): Promise<void> {
  if (!suruyor) suruyor = eslestirBir().finally(() => { suruyor = null; });
  return suruyor;
}
async function eslestirBir(): Promise<void> {
  const c = bound; const p = platform().push;
  if (!c || c.status !== 'bağlı' || !p) return;
  try {
    const izin = await p.status();
    useBildirim.setState({ izin });
    let settings: PushSettings | null = null;
    const st = platform().storage;
    if (izin === 'granted') {
      const t = await p.token();
      if (t) { settings = (await c.call('push.register', t)).settings; await st.setItem(K.token, t.token).catch(() => undefined); }
    } else {
      // izin kapandı: bu cihazın anahtarı sunucudan silinir (gizlilik metni)
      const eski = await st.getItem(K.token).catch(() => null);
      if (eski) { await c.call('push.unregister', { token: eski }); await st.removeItem(K.token).catch(() => undefined); }
    }
    settings ??= (await c.call('push.settings', {})).settings;
    useBildirim.setState({ settings });
    if (!onde) await c.call('push.away', { away: true });
  } catch { /* bağlantı koptu: bir sonraki bağlanışta yeniden */ }
}

/** sistemin izin penceresi (yalnız daha önce sorulmadıysa açılır); izin verilirse anahtar hemen yazılır */
export async function izinIste(): Promise<PushIzin | null> {
  const p = platform().push; if (!p) return null;
  let izin: PushIzin;
  try { izin = await p.request(); } catch { return null; }
  useBildirim.setState({ izin });
  if (izin === 'granted') await eslestir();
  return izin;
}

/** Ayarlar › Bildirimler: bir türü aç/kapat (açarken izin yoksa istenir). Sunucu yanıtını döndürür; bağlı değilse hata fırlatır. */
export async function turAyarla(k: PushKategori, on: boolean): Promise<PushSettings> {
  const c = bound; if (!c) throw new Error('Sunucuya bağlı değilsin.');
  const r = await c.call('push.settings', { [k]: on } as Partial<PushSettings>);
  useBildirim.setState({ settings: r.settings });
  if (on) {
    const izin = useBildirim.getState().izin;
    if (izin === 'undetermined') await izinIste();
    else await eslestir(); // bütün türler kapalıyken anahtar silinmişti: yeniden yazılır
  }
  return r.settings;
}

/**
 * Oyun içi ön soru (bir kez): oyuncu ilk özel mesajını gönderince. İzin daha önce sorulmadıysa ve özel mesaj bildirimi açıksa çıkar;
 * "Şimdi değil" denirse bir daha kendiliğinden sorulmaz (Ayarlar › Bildirimler'den açılabilir).
 */
export async function bildirimOner(): Promise<void> {
  const p = platform().push; if (!p || useBildirim.getState().onIzin) return;
  try {
    if (await platform().storage.getItem(K.soruldu)) return;
    const izin = await p.status();
    useBildirim.setState({ izin });
    if (izin !== 'undetermined' || useBildirim.getState().settings?.dm === false) return;
    useBildirim.setState({ onIzin: true });
  } catch { /* yok */ }
}
export async function onIzinYanit(evet: boolean): Promise<void> {
  useBildirim.setState({ onIzin: false });
  await platform().storage.setItem(K.soruldu, String(Date.now())).catch(() => undefined);
  if (evet) await izinIste();
}

/** uygulama öne geldi / arka plana geçti (kabuk AppState): sunucuya bildirilir; öne gelince izin yeniden okunur */
export function uygulamaOnde(on: boolean): void {
  if (onde === on) return;
  onde = on;
  const c = bound;
  if (c?.status === 'bağlı') void c.call('push.away', { away: !on }).catch(() => undefined);
  if (on) void eslestir();
}

// ------------------------------------------------------------------ bildirime dokunma
const HEDEFLER: readonly PushHedef[] = ['dm', 'takim', 'basvuru', 'arkadas', 'odul'];
let bekleyen: PushVeri | null = null;
const dinleyiciler = new Set<(d: PushVeri) => void>();
/** kabuktan gelen dokunma verisi (bilinmeyen tür yok sayılır); dinleyen yoksa (başlık ekranı, bölüm) bekletilir */
export function pushDokunuldu(d: { kind?: unknown; id?: unknown } | null | undefined): void {
  if (!d || typeof d.kind !== 'string' || !(HEDEFLER as readonly string[]).includes(d.kind)) return;
  const v: PushVeri = { kind: d.kind as PushHedef, id: typeof d.id === 'string' ? d.id.slice(0, 40) : '' };
  if (dinleyiciler.size) for (const f of dinleyiciler) f(v);
  else bekleyen = v;
}
/** BildirimHost: dokunmaları dinle; bekleyen varsa hemen verilir */
export function pushDokunusDinle(f: (d: PushVeri) => void): () => void {
  dinleyiciler.add(f);
  if (bekleyen) { const b = bekleyen; bekleyen = null; f(b); }
  return () => { dinleyiciler.delete(f); };
}
