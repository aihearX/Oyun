import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Service worker (MK-037): derleme bitince dist/sw.js'i sw/sw.js kalıbından yazar. Sürüm = dist'teki bütün dosyaların
 * içeriğinin özeti (aynı derleme → aynı sürüm; bir bayt değişse yeni sürüm, yeni önbellek adı). Ön bellek listesi: dist'teki
 * her şey, ses kayıtları (voice/*.mp3, çalındıkça önbelleğe girer) hariç. Kaydı: src/sw-kayit.ts.
 */
function odiServiceWorker(): Plugin {
  let outDir = '';
  return {
    name: 'odi-service-worker',
    apply: 'build',
    configResolved(c) { outDir = path.resolve(c.root, c.build.outDir); },
    closeBundle() {
      const files: string[] = [];
      const walk = (d: string) => { for (const n of readdirSync(d).sort()) { const p = path.join(d, n); if (statSync(p).isDirectory()) walk(p); else files.push(p); } };
      walk(outDir);
      const hash = createHash('sha256');
      const onden: [string, string][] = [];
      for (const f of files) {
        const yol = '/' + path.relative(outDir, f).split(path.sep).join('/');
        if (yol === '/sw.js') continue;
        hash.update(yol).update('\0').update(readFileSync(f)).update('\0');
        if (/^\/voice\/[^/]+\.mp3$/.test(yol) || yol.endsWith('.map')) continue;
        onden.push(yol === '/index.html' ? ['/', '/index.html'] : [yol, yol]);
      }
      const surum = hash.digest('hex').slice(0, 12);
      const kalip = readFileSync(path.resolve(import.meta.dirname, 'sw/sw.js'), 'utf8');
      writeFileSync(path.join(outDir, 'sw.js'), kalip.replace('__ODI_SW_SURUM__', surum).replace('__ODI_SW_ONDEN__', JSON.stringify(onden)));
    },
  };
}

export default defineConfig({
  plugins: [react(), odiServiceWorker()],
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
