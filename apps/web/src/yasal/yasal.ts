/**
 * Yasal metinlerin ortak yapısı (YN-009, YN-017): gizlilik politikası + KVKK aydınlatma metni, hesap silme sayfası, hakkında.
 * Metnin TEK kaynağı `metin.ts`. Aynı metin iki yerde gösterilir:
 *  - oyunun içinde (Ayarlar › Gizlilik ve hesap; bağlantısız da açılır): `YasalBelge.tsx`
 *  - herkese açık durağan sayfalar (/gizlilik, /en/privacy, /hesap-sil; mağaza listelerindeki adresler): `sayfa.ts`,
 *    `vite build` sırasında üretilir (apps/web/vite.config.ts → odiYasalSayfalar), service worker önden önbelleğe alır.
 *
 * Yer tutucular (`{YAYINCI}`, `{ILETISIM_EPOSTA}` …) `ayar.json`dan doldurulur. Boş alan sayfada açıkça "‹… eklenecek›" yazar;
 * mağazaya gönderimden önce `node tools/magaza/denetle.mjs` boş alan bırakmaz (marketing/magaza/YAYIN-LISTESI.md).
 */
import ayarDosyasi from './ayar.json';

export interface YasalAyar {
  /** marka / yayıncı adı (mağazadaki geliştirici adı) */
  YAYINCI: string;
  /** veri sorumlusunun tam ticari unvanı (KVKK m.10); boşsa YAYINCI */
  YAYINCI_UNVAN: string;
  /** veri sorumlusunun adresi (KVKK m.10) */
  YAYINCI_ADRES: string;
  /** başvuru ve iletişim e-postası (KVKK m.13 başvuruları, hesap silme istekleri, destek) */
  ILETISIM_EPOSTA: string;
  /** oyun sunucusunun bulunduğu veri merkezi (Oracle Cloud bölgesi, ör. "Frankfurt, Almanya") */
  SUNUCU_BOLGESI: string;
  /** yürürlük tarihi, YYYY-AA-GG */
  YURURLUK: string;
}

export const AYAR: YasalAyar = { ...(ayarDosyasi as YasalAyar) };

/** zorunlu alanlar: mağaza gönderiminden önce dolu olmalı (tools/magaza/denetle.mjs) */
export const ZORUNLU_ALANLAR: (keyof YasalAyar)[] = ['YAYINCI', 'YAYINCI_UNVAN', 'YAYINCI_ADRES', 'ILETISIM_EPOSTA', 'SUNUCU_BOLGESI', 'YURURLUK'];

export type Dil = 'tr' | 'en';

/** blok: başlık, paragraf, liste, tablo ya da vurgulu not. Satır içi: **kalın**, [metin](adres) */
export type Blok =
  | { t: 'h2'; x: string; id?: string }
  | { t: 'h3'; x: string }
  | { t: 'p'; x: string }
  | { t: 'ul'; x: string[] }
  | { t: 'ol'; x: string[] }
  | { t: 'tablo'; bas: string[]; satir: string[][] }
  | { t: 'not'; x: string };

export interface Belge {
  dil: Dil;
  /** herkese açık yol (ör. /gizlilik) */
  yol: string;
  /** derlemede yazılan dosya (ör. gizlilik.html) */
  dosya: string;
  baslik: string;
  /** <meta name="description"> */
  ozet: string;
  bloklar: Blok[];
}

const AYLAR: Record<Dil, string[]> = {
  tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
export function tarihYaz(iso: string, dil: Dil): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const ay = AYLAR[dil][Number(m[2]) - 1] ?? m[2];
  return dil === 'tr' ? `${Number(m[3])} ${ay} ${m[1]}` : `${ay} ${Number(m[3])}, ${m[1]}`;
}

/** boş alanın sayfadaki yazısı (köşeli ayraç yok: satır içi bağlantı sözdizimiyle karışmasın) */
const EKSIK: Record<Dil, Record<string, string>> = {
  tr: { YAYINCI_ADRES: '‹adres eklenecek›', ILETISIM_EPOSTA: '‹iletişim e-postası eklenecek›', SUNUCU_BOLGESI: '‹bölge eklenecek›' },
  en: { YAYINCI_ADRES: '‹address to be added›', ILETISIM_EPOSTA: '‹contact e-mail to be added›', SUNUCU_BOLGESI: '‹region to be added›' },
};

/** yer tutucu → değer (boş alan için "eklenecek" yazısı; YAYINCI_UNVAN boşsa YAYINCI) */
export function degerler(dil: Dil, ayar: YasalAyar = AYAR, surum = ''): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [k, x] of Object.entries(ayar)) v[k] = String(x ?? '').trim();
  v.YAYINCI ||= 'aiHear';
  v.YAYINCI_UNVAN ||= v.YAYINCI;
  for (const [k, yaz] of Object.entries(EKSIK[dil])) v[k] ||= yaz;
  v.YURURLUK = tarihYaz(v.YURURLUK ?? '', dil);
  v.SURUM = surum;
  return v;
}

/** metindeki {ALAN} yer tutucularını doldurur; bilinmeyen yer tutucu hata (yazım yanlışı sayfaya çıkmasın) */
export function doldur(s: string, v: Record<string, string>): string {
  return s.replace(/\{([A-Z_]+)\}/g, (_, k: string) => {
    if (!(k in v)) throw new Error(`yasal metin: bilinmeyen yer tutucu {${k}}`);
    return v[k]!;
  });
}

export type Parca = { t: 'yazi'; x: string } | { t: 'kalin'; x: string } | { t: 'bag'; x: string; href: string };

/** satır içi biçim: **kalın** ve [metin](adres). Adresi geçersiz bağlantı (ör. e-postası boş mailto:) düz yazı olur. */
export function satirParcala(s: string): Parca[] {
  const out: Parca[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let i = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > i) out.push({ t: 'yazi', x: s.slice(i, m.index) });
    if (m[1] != null) out.push({ t: 'kalin', x: m[1] });
    else if (gecerliAdres(m[3]!)) out.push({ t: 'bag', x: m[2]!, href: m[3]! });
    else out.push({ t: 'yazi', x: m[2]! });
    i = m.index + m[0].length;
  }
  if (i < s.length) out.push({ t: 'yazi', x: s.slice(i) });
  return out;
}

/** yalnız göreli yol, #çapa, https:// ve geçerli e-postalı mailto: */
export function gecerliAdres(href: string): boolean {
  if (href.startsWith('mailto:')) return /^mailto:[^@\s?]+@[^@\s?]+\.[^@\s?]+(\?.*)?$/.test(href);
  return href.startsWith('/') || href.startsWith('#') || href.startsWith('https://');
}

/** belgenin bütün yer tutucuları doldurulmuş kopyası */
export function belgeDoldur(b: Belge, ayar: YasalAyar = AYAR, surum = ''): Belge {
  const v = degerler(b.dil, ayar, surum);
  const d = (s: string) => doldur(s, v);
  return {
    ...b, baslik: d(b.baslik), ozet: d(b.ozet),
    bloklar: b.bloklar.map((k): Blok => {
      switch (k.t) {
        case 'ul': case 'ol': return { ...k, x: k.x.map(d) };
        case 'tablo': return { ...k, bas: k.bas.map(d), satir: k.satir.map((r) => r.map(d)) };
        default: return { ...k, x: d(k.x) };
      }
    }),
  };
}

/** belgenin düz metni (karakter sayımı, testler) */
export function duzMetin(b: Belge): string {
  const sat = (s: string) => satirParcala(s).map((p) => p.x).join('');
  return [b.baslik, ...b.bloklar.flatMap((k) => (k.t === 'ul' || k.t === 'ol' ? k.x : k.t === 'tablo' ? [...k.bas, ...k.satir.flat()] : [k.x]))].map(sat).join('\n');
}
