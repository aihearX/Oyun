import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@odi/game-core': path.resolve(import.meta.dirname, '../../packages/game-core/src'),
      '@odi/content': path.resolve(import.meta.dirname, '../../packages/content/src'),
      '@odi/level-gen': path.resolve(import.meta.dirname, '../../packages/level-gen/src'),
      '@odi/shared': path.resolve(import.meta.dirname, '../../packages/shared/src'),
    },
  },
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
  server: { host: true, port: 5173 },
});
