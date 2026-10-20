/**
 * Basit küfür filtresi (Türkçe + İngilizce). Amaç kusursuzluk değil, makul bir ilk savunma hattı.
 * Normalizasyon: küçük harf, Türkçe harfler → Latin (ı→i, ş→s…), rakam/simge benzerleri → harf,
 * harf olmayanlar atılır, art arda tekrarlayan harfler teke indirilir ("siiik" → "sik").
 */

/** kelimenin herhangi bir yerinde geçerse yakalanan kökler (yeterince uzun ve özgül) */
const SUBSTRING = [
  'orospu', 'orosbu', 'siktir', 'sikerim', 'sikeyim', 'sikik', 'sikis', 'yarak', 'amcik', 'aminak', 'aminako', 'gotveren', 'gotlek',
  'kahpe', 'pezevenk', 'gavat', 'kaltak', 'surtuk', 'yavsak', 'serefsiz', 'dalyarak', 'tasak', 'ibne', 'pust', 'kancik', 'godos',
  'sikko', 'siktr', 'gerizekali', 'dangalak', 'amina', 'yarrak', 'orrospu', 'pic kurusu', 'gotos', 'kevase', 'fahise',
  'fuck', 'motherfuck', 'shit', 'bitch', 'cunt', 'pusy', 'asshole', 'bastard', 'whore', 'slut', 'retard', 'wanker', 'twat',
];
/** yalnızca tam kelime olarak yakalananlar (kısa; başka kelimelerin içinde masum geçebilir) */
const WHOLE = ['sik', 'amk', 'amq', 'aq', 'oc', 'pic', 'got', 'mk', 'sg', 'amina', 'dick', 'cock', 'fag', 'ass', 'nigga', 'nigger',
  // sohbette sık kısaltmalar
  'skm', 'sktr', 'skrm', 'ananskm'];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's', '!': 'i', '€': 'e' };
const TR: Record<string, string> = { 'ı': 'i', 'i̇': 'i', 'ş': 's', 'ğ': 'g', 'ü': 'u', 'ö': 'o', 'ç': 'c', 'â': 'a', 'î': 'i', 'û': 'u' };

export function normalizeWord(s: string): string {
  let out = '';
  for (const ch of s.toLocaleLowerCase('tr')) {
    const c = TR[ch] ?? LEET[ch] ?? ch;
    if (/[a-z]/.test(c)) out += c;
  }
  return out.replace(/(.)\1+/g, '$1');
}

const SUB_N = SUBSTRING.map(normalizeWord);
const WHOLE_N = new Set(WHOLE.map(normalizeWord));

function wordIsBad(word: string): boolean {
  const n = normalizeWord(word);
  if (!n) return false;
  if (WHOLE_N.has(n)) return true;
  return SUB_N.some((w) => n.includes(w));
}

/** metin içinde küfür var mı (isimler için: boşluklar da birleştirilerek denenir) */
export function hasProfanity(text: string): boolean {
  const words = text.split(/[\s_.\-,]+/).filter(Boolean);
  if (words.some(wordIsBad)) return true;
  const joined = normalizeWord(text);
  return SUB_N.some((w) => joined.includes(w));
}

/** sohbet: kötü kelimeleri yıldızla maskele, gerisini olduğu gibi bırak */
export function maskProfanity(text: string): { text: string; masked: boolean } {
  let masked = false;
  const out = text.replace(/[^\s]+/g, (w) => {
    if (!wordIsBad(w)) return w;
    masked = true;
    return '*'.repeat([...w].length);
  });
  return { text: out, masked };
}
