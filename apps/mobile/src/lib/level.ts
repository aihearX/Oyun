import { generateLevel } from '@odi/level-gen';
import type { LevelSpec } from '@odi/shared';
import { HUMAN_JOURNEY } from '@odi/content';
import { useStore } from '@/store';

export const LEVEL_COUNT = HUMAN_JOURNEY.levels.length;
export const clampLevel = (n: number) => Math.max(1, Math.min(LEVEL_COUNT, Number.isFinite(n) ? Math.round(n) : 1));

/** Bölüm üretimi native tarafta; spec JSON olarak DOM bileşenine prop geçer. Profil o anki kalıcı durumdan okunur. */
export function buildLevel(number: number, salt = 0): LevelSpec {
  const s = useStore.getState();
  return generateLevel(s.journey, clampLevel(number), { recentStars: s.avgRecentStars(), failStreak: s.failStreak, skills: s.skills }, salt);
}

export function shareTextFor(spec: LevelSpec, completed: boolean, stars: number, score: number): string {
  return completed
    ? `ODİ: ${spec.number}. bölümü ${'⭐'.repeat(stars)} ile geçtim, ${score.toLocaleString('tr-TR')} puan! Sen kulağın neresindesin?`
    : `ODİ'de ${spec.number}. bölümde takıldım. Sen geçebilir misin?`;
}
