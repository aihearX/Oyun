import { create } from 'zustand';
import type { LevelSpec, RunResult } from '@odi/shared';

/** Oturum içi, kalıcı olmayan durum: oynanan bölüm ve son sonuç (sonuç ekranı için). */
interface Session { spec: LevelSpec | null; result: RunResult | null; setRun(spec: LevelSpec): void; setResult(spec: LevelSpec, result: RunResult): void; clear(): void }
export const useSession = create<Session>()((set) => ({
  spec: null, result: null,
  setRun: (spec) => set({ spec, result: null }),
  setResult: (spec, result) => set({ spec, result }),
  clear: () => set({ spec: null, result: null }),
}));
