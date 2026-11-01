/**
 * Tek kişilik bilgi pratiği (YN-078, sahip kararı 35): canlı Kulak Bilgi Yarışması'nın soru havuzu ve seçim kuralı
 * (@odi/content `pickQuizQuestions`), cihazda, çevrimdışı. Saf durum: hiçbir yere yazmaz; ödül, XP, takım/lig puanı,
 * başarım ya da günlük görev ilerlemesi YOK (pratik.test.ts bu dosyanın ve ekranın yalnız içerik paketine dayandığını denetler).
 */
import { QUIZ_QUESTIONS, QUIZ_ROUND, pickQuizQuestions, type QuizQuestion } from '@odi/content';

export interface PratikTur {
  /** QUIZ_QUESTIONS sıra numaraları (canlı yarışmadaki gibi) */
  readonly qs: readonly number[];
  /** şu anki soru (qs.length: tur bitti) */
  readonly i: number;
  /** her sorunun seçilen cevabı (null: henüz cevaplanmadı) */
  readonly picks: readonly (number | null)[];
}

export const PRATIK_SORU = QUIZ_ROUND;

export function pratikBaslat(level: 'genel' | 'odyoloji', rand: () => number = Math.random): PratikTur {
  const qs = pickQuizQuestions(level, (n) => Math.min(n - 1, Math.floor(rand() * n)), PRATIK_SORU);
  return { qs, i: 0, picks: qs.map(() => null) };
}

export const pratikBitti = (t: PratikTur): boolean => t.i >= t.qs.length;
export const pratikSoru = (t: PratikTur): QuizQuestion | null => (pratikBitti(t) ? null : QUIZ_QUESTIONS[t.qs[t.i]!]!);
export const pratikSecim = (t: PratikTur): number | null => (pratikBitti(t) ? null : t.picks[t.i] ?? null);

/** cevap ver: her soru bir kez cevaplanır (değiştirilemez) */
export function pratikCevapla(t: PratikTur, choice: number): PratikTur {
  if (pratikBitti(t) || t.picks[t.i] != null || choice < 0 || choice > 3) return t;
  const picks = t.picks.slice(); picks[t.i] = choice;
  return { ...t, picks };
}

/** sonraki soru (yalnız cevaplanınca) */
export function pratikSonraki(t: PratikTur): PratikTur {
  if (pratikBitti(t) || t.picks[t.i] == null) return t;
  return { ...t, i: t.i + 1 };
}

export const pratikDogru = (t: PratikTur): number => t.qs.reduce((a, q, k) => a + (t.picks[k] === QUIZ_QUESTIONS[q]!.answer ? 1 : 0), 0);
