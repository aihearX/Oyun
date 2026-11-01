/**
 * Satır sonunda bölünmeyen sayılar (YN-069; YN-046'nın devamı). Dar ekranda "1,1" / "ml" ya da "2,5–" / "3 kHz" diye
 * ayrılmasın diye:
 * - sayı ile birim (Hz, kHz, dB, daPa, ml, mm, cm, ms, µPa, mV, sn, dk) ve "dB HL" arasına bölünmez boşluk (U+00A0);
 * - aralıklarda (2,5–3 kHz, 20 Hz–20 kHz, 1 Hz – 100 Hz, −100…+50 daPa) tire ya da üç noktanın iki yanına WORD JOINER (U+2060).
 * Görünür metin değişmez; WORD JOINER seslendirmede yok sayılır (ftue/script.ts textHash) ve üretilen belgelerden ayıklanır.
 * İçerik dizileri bununla bir kez geçirilir (bolunmezYap); ekranda birleştirilen metinler (ör. test sonuç satırları) de
 * bolunmez() ile geçer. Aynı metne iki kez uygulamak bir şey değiştirmez.
 */
const NB = '\u00A0';
const WJ = '\u2060';
const BIRIM = 'dBA|dB|kHz|Hz|daPa|ml|mm|cm|ms|µPa|mV|sn|dk';
const SAYI_BIRIM = new RegExp(`(\\d) (${BIRIM})(?![\\p{L}\\d])`, 'gu');
const DB_OLCEK = /dB (HL|SPL|nHL|SL)(?![\p{L}\d])/gu;
const ARALIK = new RegExp(`(\\d|${BIRIM})( ?)${WJ}?–${WJ}?( ?)(?=[\\d−+])`, 'gu');
const UC_NOKTA = new RegExp(`(\\d)${WJ}?…${WJ}?(?=[\\d−+])`, 'gu');

/** tek metin: sayı–birim ve aralıkları satır sonunda bölünmez yapar */
export function bolunmez(s: string): string {
  return s
    .replace(SAYI_BIRIM, `$1${NB}$2`)
    .replace(DB_OLCEK, `dB${NB}$1`)
    .replace(ARALIK, (_m, a: string, s1: string, s2: string) => `${a}${s1 ? NB : ''}${WJ}–${WJ}${s2 ? NB : ''}`)
    .replace(UC_NOKTA, `$1${WJ}…${WJ}`);
}

/** içerik verisindeki bütün metinleri yerinde bolunmez() ile geçirir ve aynı nesneyi döndürür (seslendirme okunuşu `spoken` hariç) */
export function bolunmezYap<T>(x: T): T {
  const seen = new Set<object>();
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return bolunmez(v);
    if (!v || typeof v !== 'object' || seen.has(v)) return v;
    seen.add(v);
    const o = v as Record<string, unknown>;
    for (const k of Object.keys(o)) if (k !== 'spoken') o[k] = walk(o[k]);
    return v;
  };
  return walk(x) as T;
}

/** görünmez biçim karakterini ayıklar (belge, seslendirme metni) */
export const bicimsiz = (s: string): string => s.replace(/\u2060/g, '');
