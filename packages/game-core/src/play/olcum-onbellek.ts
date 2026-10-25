/**
 * İnsan modeli ölçümlerinin önbelleği (yalnız vitest'te; docs/12 §7, is-listesi MK-013).
 * Zorluk testleri (zorluk-*.test.ts) yüzlerce bölümü insan modeliyle oynatır: boşta ~10 dk, yük altında 20-25 dk.
 * Sonuç tamamen deterministiktir: aynı simülasyon kodu + aynı girdi → aynı sonuç. Anahtar, simülasyonun ÇALIŞAN kodudur:
 * testkit.ts girişinden esbuild ile kurulan paketin (ağaç sallanmış, yorumsuz) SHA-256'sı + Node sürümü. Bölüm üretimi, içerik
 * parçaları, insan modeli ya da fizik değişirse anahtar değişir ve her şey yeniden ölçülür; kamp metni, sunucu, arayüz
 * değişikliği anahtarı değiştirmez. Önbellek depoda değil, makinenin geçici klasöründe (çalışma ağaçları arasında paylaşılır;
 * içerik adresli olduğu için güvenli). Kapatmak için ODI_OLCUM_ONBELLEK=0 (tam ölçüm).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const on = !!process.env.VITEST && process.env.ODI_OLCUM_ONBELLEK !== '0';
let dir: string | null | undefined;

/** simülasyon kodunun özeti (bir kez hesaplanır; esbuild yoksa önbellek kapalı) */
function cacheDir(): string | null {
  if (dir !== undefined) return dir;
  dir = null;
  if (!on) return dir;
  try {
    const require = createRequire(resolve(here, '../../../../package.json'));
    const { buildSync } = require('esbuild') as typeof import('esbuild');
    const out = buildSync({ entryPoints: [join(here, 'testkit.ts')], bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent' });
    const h = createHash('sha256').update(out.outputFiles[0]!.text).update(process.version).digest('hex').slice(0, 24);
    dir = join(tmpdir(), 'odi-olcum', h);
    mkdirSync(dir, { recursive: true });
  } catch { dir = null; }
  return dir;
}

/** fn(...) sonucunu anahtarla önbellekten ver ya da hesaplayıp yaz (JSON'a dönüşebilen sonuçlar) */
export function olcumOnbellek<T>(ad: string, girdi: unknown, fn: () => T): T {
  const d = cacheDir();
  if (!d) return fn();
  // girdide işlev varsa (ör. planlayıcı `motor`) anahtar onu temsil edemez: önbelleği atla
  let fonksiyon = false;
  const json = JSON.stringify(girdi, (_k, v: unknown) => { if (typeof v === 'function') fonksiyon = true; return v; }) ?? '';
  if (fonksiyon) return fn();
  const key = createHash('sha256').update(ad).update(json).digest('hex').slice(0, 32);
  const file = join(d, `${key}.json`);
  try { return JSON.parse(readFileSync(file, 'utf8')) as T; } catch { /* yok: hesapla */ }
  const v = fn();
  try { const tmp = `${file}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify(v)); renameSync(tmp, file); } catch { /* yazılamadı: önemsiz */ }
  return v;
}
