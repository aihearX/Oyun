/**
 * Tek kişilik bilgi pratiği (YN-078, sahip kararı 35): canlı Kulak Bilgi Yarışması'nın soru havuzu ve seçim işlevi
 * (@odi/content `pickQuizQuestions`, Pratik kipi), cihazda, çevrimdışı. Tek fark (sahip kararı 41, YN-109): Odyoloji öğrencisi düzeyinde
 * 10 sorunun hepsi öğrenci düzeyinden (canlı yarışma karışık kalır: 6 öğrenci + 4 genel). Saf durum: hiçbir yere yazmaz; ödül, XP, takım/lig puanı,
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
  const qs = pickQuizQuestions(level, (n) => Math.min(n - 1, Math.floor(rand() * n)), PRATIK_SORU, { mode: 'pratik' });
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

/** sonuç ekranındaki "Yanlışların" (YN-101): yanlış cevaplanan her soru ve oyuncunun seçtiği şık, turdaki sırasıyla */
export const pratikYanlislar = (t: PratikTur): { soru: QuizQuestion; secim: number }[] =>
  t.qs.flatMap((q, k) => { const s = t.picks[k]; const soru = QUIZ_QUESTIONS[q]!; return s != null && s !== soru.answer ? [{ soru, secim: s }] : []; });

/** Pratik'te soruların geldiği düzey: Genel'de "Meraklı" (genel) sorular, Odyoloji öğrencisinde yalnız öğrenci soruları (karar 41) */
const pratikDuzey = (level: 'genel' | 'odyoloji'): QuizQuestion['level'] => (level === 'odyoloji' ? 'odyoloji' : 'merakli');

/** "Yeni tur" notu için havuz büyüklüğü: her tur bu havuzdan baştan seçilir (önceki tur hatırlanmaz, aynı soru yine gelebilir) */
export const pratikHavuz = (level: 'genel' | 'odyoloji'): number => QUIZ_QUESTIONS.filter((q) => q.level === pratikDuzey(level)).length;

/** giriş ekranında düzeyin ne getirdiği (gerçek seçim kuralını yazar; pratik.test.ts denetler) */
export const pratikDuzeyNotu = (level: 'genel' | 'odyoloji'): string => level === 'odyoloji'
  ? `Odyoloji öğrencisi: ${PRATIK_SORU} sorunun hepsi öğrenci düzeyinden.`
  : `Genel: ${PRATIK_SORU} sorunun hepsi genel düzeyden.`;
