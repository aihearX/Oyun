import type { LevelSpec, PlayerSkills, RunResult } from '@odi/shared';

export type GameEvent =
  | { type: 'ready' }
  | { type: 'started' }
  | { type: 'progress'; pct: number; coins: number; score: number }
  | { type: 'checkpoint'; x: number }
  | { type: 'damage'; lives: number }
  | { type: 'haptic'; kind: 'light' | 'medium' | 'heavy' | 'success' | 'error' }
  | { type: 'levelComplete'; result: RunResult }
  | { type: 'levelFailed'; result: RunResult }
  | { type: 'quit' };

export interface LevelOptions {
  spec: LevelSpec;
  onEvent: (e: GameEvent) => void | Promise<void>;
  skills: PlayerSkills;
  /** harness/test: otomatik oyuncu */
  bot?: boolean;
  /** test: bot modunda başlar ama hiçbir giriş yapmaz (boşta oyuncu). Her bölüm boşta kaybedilmeli. */
  botIdle?: boolean;
  sounds?: boolean;
  /** bölüm başı can (varsayılan 3) */
  lives?: number;
  /** bot: hız çarpanı (test süresini kısaltmak için) */
  timeScale?: number;
}

export interface LevelHandle { destroy: () => void; pause: () => void; resume: () => void }
