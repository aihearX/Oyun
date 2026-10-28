import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { build as esbuild } from 'esbuild';
import { execFileSync } from 'node:child_process';

/**
 * Herkese açık yasal sayfalar (YN-009): /gizlilik, /en/privacy, /hesap-sil (mağaza listelerindeki gizlilik ve hesap silme
 * adresleri). Metin src/yasal/metin.ts'ten (oyun içindeki sayfalarla aynı kaynak) durağan HTML olarak dist'e yazılır
 * (gizlilik.html, en/privacy.html, hesap-sil.html); service worker önden önbelleğe alır. Sunucu /gizlilik → gizlilik.html
 * (Caddy try_files {path}.html, vite preview); eski Caddyfile'da index.html'deki küçük yönlendirme aynı dosyayı açar.
 * Metin modülü (TypeScript) esbuild ile o anda paketlenip yüklenir: yapılandırma dosyası uygulama kaynağını doğrudan içe aktarmaz.
 */
interface YasalModul { YASAL_SAYFALAR: { yol: string; dosya: string }[]; sayfaHtml(b: unknown): string }
async function yasalYukle(): Promise<YasalModul> {
  const r = await esbuild({ entryPoints: [path.resolve(import.meta.dirname, 'src/yasal/sayfa.ts')], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0]!.text).toString('base64')}`) as Promise<YasalModul>;
}
function odiYasalSayfalar(): Plugin {
  return {
    name: 'odi-yasal-sayfalar',
    // geliştirme sunucusu: aynı sayfalar bellekten (her istekte metin.ts'in son hâli)
    configureServer(server) {
      const YOLLAR = new Set(['/gizlilik', '/en/privacy', '/hesap-sil']);
      server.middlewares.use((req, res, next) => {
        const yol = (req.url ?? '').split(/[?#]/)[0]!.replace(/\/+$/, '').replace(/\.html$/, '');
        if (!YOLLAR.has(yol)) return next();
        yasalYukle().then((m) => {
          const b = m.YASAL_SAYFALAR.find((x) => x.yol === yol);
          if (!b) return next();
          res.setHeader('content-type', 'text/html; charset=utf-8');
          res.end(m.sayfaHtml(b));
        }, next);
      });
    },
    async generateBundle() {
      const m = await yasalYukle();
      for (const b of m.YASAL_SAYFALAR) this.emitFile({ type: 'asset', fileName: b.dosya, source: m.sayfaHtml(b) });
    },
  };
}

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

/**
 * Çökme raporundaki derleme kimliği (YN-011, src/hata.ts): yalnız `vite build`te (git kısa özeti, yoksa derleme günü).
 * Geliştirme sunucusunda boş kalır: raporlama orada kapalıdır.
 */
function odiDerleme(): Plugin {
  return {
    name: 'odi-derleme',
    config(_c, { command }) {
      let id = '';
      if (command === 'build') {
        try { id = execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* git yok */ }
        if (!/^[0-9a-f]{4,40}$/.test(id)) id = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      }
      return { define: { __ODI_BUILD__: JSON.stringify(id) } };
    },
  };
}

export default defineConfig({
  plugins: [react(), odiYasalSayfalar(), odiServiceWorker(), odiDerleme()],
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
