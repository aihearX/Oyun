/**
 * Cihaz sesi (TTS) ayarları ve Türkçe ses seçimi: tarayıcı (speechSynthesis) ve mobil kabuk (expo-speech) ortak kullanır.
 * Bağımlılığı yok (React Native tarafı da içe aktarır).
 *
 * Ara çözüm: Tüy Dede yaşlı bir erkek. iOS'ta yalnız kadın Türkçe ses (Yelda) var, bu yüzden kadın seste perde belirgin
 * düşürülür ve tempo yavaşlar; erkek bir tr-TR ses bulunursa (Android Google TTS, masaüstü tarayıcılar) o seçilir ve
 * perde daha az düşürülür (doğal kalsın). Kayıtlı ses dosyası varsa hiçbiri kullanılmaz (bkz. voice.ts).
 */
export const NARRATOR_TTS = {
  /** erkek ses bulunamazsa (ör. iOS Yelda): derin ve yavaş */
  rate: 0.86, pitch: 0.74,
  /** erkek ses bulunduysa: hafif derin, dede temposu */
  maleRate: 0.88, malePitch: 0.9,
} as const;

export interface VoiceLike { name?: string; identifier?: string; voiceURI?: string; lang?: string; language?: string; quality?: string; localService?: boolean }

const isTurkish = (v: VoiceLike) => /^tr([-_]|$)/i.test(String(v.lang ?? v.language ?? ''));
const FEMALE = /\b(female|kad[ıi]n|woman)\b|yelda|seda|filiz|emel|zeynep|elif|ay[sş]e|grandma|nine|-(ama|cfs|efu)-/i;
const ELDER_MALE = /grandpa|dede|b[üu]y[üu]kbaba/i;
const MALE = /\b(male|erkek|man)\b|tolga|ahmet|\bcem\b|kerem|mehmet|emre|murat|yusuf|burak|\bali\b|-(mfm|tmc)-/i;

/** sesin puanı: yaşlı erkek > erkek > kaliteli > yerel; kadın olduğu bilinen sesler geride */
export function voiceScore(v: VoiceLike): number {
  const n = `${v.name ?? ''} ${v.identifier ?? ''} ${v.voiceURI ?? ''}`;
  let s = 0;
  if (ELDER_MALE.test(n)) s += 100;
  else if (MALE.test(n) && !/female/i.test(n)) s += 60;
  if (FEMALE.test(n) && !ELDER_MALE.test(n)) s -= 20;
  if (/natural|enhanced|premium|neural/i.test(`${n} ${v.quality ?? ''}`)) s += 10;
  if (v.localService) s += 2;
  return s;
}
export const isMaleVoice = (v: VoiceLike | null | undefined) => !!v && voiceScore(v) >= 40;

/** en uygun Türkçe ses (yoksa null: dil koduyla varsayılan ses) */
export function pickTurkishVoice<T extends VoiceLike>(voices: readonly T[]): T | null {
  const tr = voices.filter(isTurkish);
  if (!tr.length) return null;
  return [...tr].sort((a, b) => voiceScore(b) - voiceScore(a))[0]!;
}

/** seçilen sese göre hız/perde */
export function ttsParams(male: boolean, base: { rate?: number; pitch?: number } = {}): { rate: number; pitch: number } {
  return male ? { rate: NARRATOR_TTS.maleRate, pitch: NARRATOR_TTS.malePitch } : { rate: base.rate ?? NARRATOR_TTS.rate, pitch: base.pitch ?? NARRATOR_TTS.pitch };
}

/** cümlelere (ve ; : sonrasına) böl: her parça ayrı okunur, aralarda doğal bir nefes olur */
export function ttsChunks(text: string): string[] {
  const parts = text.replace(/\s+/g, ' ').trim().match(/[^.!?…;:]+[.!?…;:]*/g) ?? [];
  const out: string[] = [];
  for (const p of parts) { const t = p.trim(); if (!t) continue; if (out.length && t.length < 4) out[out.length - 1] += ` ${t}`; else out.push(t); }
  return out.length ? out : [text];
}
