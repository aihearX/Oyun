import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerSkills, RunResult } from '@odi/shared';
import { xpForRun, levelFromXp } from '@odi/shared';
import { DEFAULT_SKILLS, SKILL_TREE, HUMAN_JOURNEY } from '@odi/content';

export interface LevelProgress { stars: number; best: number; plays: number; lastResult?: RunResult }
interface State {
  journey: string; progress: Record<number, LevelProgress>; coins: number; xp: number; skills: PlayerSkills; sounds: boolean; failStreak: number; recentStars: number[];
  highestUnlocked(): number;
  recordRun(number: number, r: RunResult): void;
  buySkill(id: string): boolean;
  setSounds(v: boolean): void;
  reset(): void;
  playerLevel(): number;
}

export const useStore = create<State>()(persist((set, get) => ({
  journey: HUMAN_JOURNEY.id, progress: {}, coins: 0, xp: 0, skills: { ...DEFAULT_SKILLS }, sounds: true, failStreak: 0, recentStars: [],
  highestUnlocked() { const p = get().progress; let n = 1; while (p[n] && p[n]!.stars > 0) n++; return Math.min(n, HUMAN_JOURNEY.levels.length); },
  recordRun(number, r) {
    set((s) => {
      const prev = s.progress[number] ?? { stars: 0, best: 0, plays: 0 };
      const progress = { ...s.progress, [number]: { stars: Math.max(prev.stars, r.stars), best: Math.max(prev.best, r.score), plays: prev.plays + 1, lastResult: r } };
      return { progress, coins: s.coins + r.coins, xp: s.xp + xpForRun(r), failStreak: r.completed ? 0 : s.failStreak + 1, recentStars: [...s.recentStars, r.stars].slice(-5) };
    });
  },
  buySkill(id) {
    const node = SKILL_TREE.find((n) => n.id === id); if (!node) return false;
    const s = get(); if (s.coins < node.cost) return false;
    if (node.requires && !ownsSkill(s.skills, node.requires)) return false;
    if (ownsSkill(s.skills, id)) return false;
    const skills = { ...s.skills } as Record<string, number | boolean>;
    skills[node.key] = node.level ?? true;
    set({ coins: s.coins - node.cost, skills: skills as unknown as PlayerSkills }); return true;
  },
  setSounds(v) { set({ sounds: v }); },
  reset() { set({ progress: {}, coins: 0, xp: 0, skills: { ...DEFAULT_SKILLS }, failStreak: 0, recentStars: [] }); },
  playerLevel() { return levelFromXp(get().xp); },
}), { name: 'odi-v1', partialize: (s) => ({ journey: s.journey, progress: s.progress, coins: s.coins, xp: s.xp, skills: s.skills, sounds: s.sounds, failStreak: s.failStreak, recentStars: s.recentStars }) }));

export function ownsSkill(skills: PlayerSkills, id: string): boolean {
  const node = SKILL_TREE.find((n) => n.id === id); if (!node) return false;
  const v = skills[node.key]; return typeof v === 'boolean' ? v : v >= (node.level ?? 1);
}
