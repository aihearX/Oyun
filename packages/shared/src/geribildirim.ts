/**
 * Beta geri bildirimi: oyuncu oyundan çıkmadan kısa bir not gönderir ("şu ekranda takıldım"). Web arayüzü (Ayarlar › Geri bildirim
 * gönder; telefonda aynı arayüz Expo DOM içinde) ve sunucu (`POST /geri-bildirim`) bu dosyadaki kuralları paylaşır.
 *
 * Gönderilen alanların TAMAMI (sunucu şeması fazla alanı reddeder): konu (Hata / Zorluk / Öneri / Diğer), oyuncunun yazdığı metin
 * (en çok 500 karakter; istemcide ve sunucuda `scrubFreeText` ile e-posta, telefon numarası, uzun rakam dizisi, anahtar ve arkadaş
 * kodu benzeri dizgiler çıkarılır), oyuncunun geldiği ekranın adı, uygulama sürümü + derleme, platform (web / ios / android).
 * Oyuncu kimliği, takma ad, anahtar, cihaz kimliği, IP HİÇ gönderilmez ve kaydedilmez; ad, telefon, e-posta istenmez.
 * Gizlilik metni: apps/web/src/yasal/metin.ts §3; mağaza beyanları: marketing/magaza/*.md; docs/yonetim/gizlilik.md.
 */
import { CRASH_APP_RE, CRASH_BUILD_RE, CRASH_SCREEN_RE, scrubFreeText, serverHttpEndpoint, type CrashPlatform } from './hata';

export const FEEDBACK_LIMITS = {
  /** istek gövdesi en çok (bayt) */
  maxBytes: 4 * 1024,
  /** metin en çok (karakter) */
  textMax: 500,
  /** sunucu: IP başına saatte / günde (IP yalnız bellekte, tuzlu özet; sınır için) */
  perIpHour: 5,
  perIpDay: 20,
  /** sunucu: günde en çok yeni kayıt (çok adresten gelen sel veritabanını şişirmesin) */
  perDay: 1000,
  /** sunucu: kayıtlar bu kadar gün sonra kendiliğinden silinir */
  retainDays: 90,
} as const;

export const FEEDBACK_TOPICS = ['hata', 'zorluk', 'oneri', 'diger'] as const;
export type FeedbackTopic = typeof FEEDBACK_TOPICS[number];
export const FEEDBACK_TOPIC_LABEL: Record<FeedbackTopic, string> = { hata: 'Hata', zorluk: 'Zorluk', oneri: 'Öneri', diger: 'Diğer' };

/** sunucuya giden geri bildirimin tamamı (başka alan yok) */
export interface FeedbackReport {
  v: 1;
  topic: FeedbackTopic;
  /** temizlenmiş metin (1–500 karakter) */
  text: string;
  /** oyuncunun Ayarlar'a gelmeden önceki ekranı (map, level, camp …) */
  screen: string;
  /** uygulama sürümü (0.1.0) */
  app: string;
  /** derleme (web: git kısa özeti; telefon: mağaza derleme numarası; geliştirmede boş) */
  build: string;
  platform: CrashPlatform;
}

export interface FeedbackContext { screen: string; app: string; build: string; platform: CrashPlatform }

/** konu + ham metin + bağlam → gönderilecek kayıt; temizlenince boş kalan metin → null */
export function buildFeedback(topic: FeedbackTopic, raw: string, ctx: FeedbackContext): FeedbackReport | null {
  const text = scrubFreeText(raw, FEEDBACK_LIMITS.textMax);
  if (!text || !FEEDBACK_TOPICS.includes(topic)) return null;
  return {
    v: 1, topic, text,
    screen: CRASH_SCREEN_RE.test(ctx.screen) ? ctx.screen : '',
    app: CRASH_APP_RE.test(ctx.app) ? ctx.app : '0.0.0',
    build: CRASH_BUILD_RE.test(ctx.build) ? ctx.build : '',
    platform: ctx.platform,
  };
}

/** ws://, wss://, http(s):// sunucu adresi → geri bildirim ucu (http(s)://kök/geri-bildirim); geçersizse boş */
export const feedbackEndpoint = (serverUrl: string): string => serverHttpEndpoint(serverUrl, 'geri-bildirim');
