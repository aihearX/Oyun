import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  resolve: { alias: { '@odi/game-core': path.resolve('packages/game-core/src'), '@odi/content': path.resolve('packages/content/src'), '@odi/level-gen': path.resolve('packages/level-gen/src'), '@odi/shared': path.resolve('packages/shared/src') } },
  test: { include: ['packages/**/*.test.ts'] },
});
