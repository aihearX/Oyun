import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  // sosyal sunucu adresi derleme zamanında verilebilir: VITE_ODI_SERVER=wss://... npm run build:web
  define: { __ODI_SERVER__: JSON.stringify(process.env.VITE_ODI_SERVER ?? ''), __ODI_E2E__: JSON.stringify(process.env.VITE_ODI_E2E === '1') },
  resolve: {
    alias: {
      '@odi/game-core': path.resolve(import.meta.dirname, '../../packages/game-core/src'),
      '@odi/content': path.resolve(import.meta.dirname, '../../packages/content/src'),
      '@odi/level-gen': path.resolve(import.meta.dirname, '../../packages/level-gen/src'),
      '@odi/shared': path.resolve(import.meta.dirname, '../../packages/shared/src'),
      '@odi/meta': path.resolve(import.meta.dirname, '../../packages/meta/src'),
      '@odi/net': path.resolve(import.meta.dirname, '../../packages/net/src'),
      '@odi/audio': path.resolve(import.meta.dirname, '../../packages/audio/src'),
    },
  },
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
  server: { host: true, port: 5173 },
});
