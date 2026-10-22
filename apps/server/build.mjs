// apps/server → dist/server.mjs (tek dosya, Node 22). Yerel derleme gerektiren bağımlılık yok.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [path.join(here, 'src/main.ts')],
  outfile: path.join(here, 'dist/server.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  // ws'nin isteğe bağlı yerel hızlandırıcıları: yoksa saf JS kullanılır
  external: ['bufferutil', 'utf-8-validate'],
  // paketlenen CommonJS modülleri (ws) için require
  banner: { js: "import { createRequire as __odiCreateRequire } from 'node:module'; const require = __odiCreateRequire(import.meta.url);" },
  logLevel: 'info',
});
// kod yönetimi aracı (npm run kod -- …)
await build({
  entryPoints: [path.join(here, 'src/kod-cli.ts')],
  outfile: path.join(here, 'dist/kod.mjs'),
  bundle: true, platform: 'node', target: 'node22', format: 'esm',
  external: ['bufferutil', 'utf-8-validate'],
  banner: { js: "import { createRequire as __odiCreateRequire } from 'node:module'; const require = __odiCreateRequire(import.meta.url);" },
  logLevel: 'warning',
});
