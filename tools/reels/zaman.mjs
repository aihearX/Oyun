#!/usr/bin/env node
// Reels sahne zamanlaması: tools/reels/zaman.ts'yi paketleyip bölümleri Phaser'sız oynatır (saniyeler içinde).
// Çıktı: tools/harness/out/reels/zaman/L<NN>[-s<salt>].json ve kısa özet. Stüdyo sahnesinin `fromT`'si buradan seçilir.
// Kullanım: node tools/reels/zaman.mjs --levels 1-40 [--salt 0] [--grep walljump]
import { build } from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('../..', import.meta.url).pathname);
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1'] : [])).filter((x) => x.length));
const out = resolve(root, 'tools/harness/out/reels/zaman'); mkdirSync(out, { recursive: true });
const levels = String(args.levels ?? '1-40').split(',').flatMap((r) => { const [a, b] = r.split('-').map(Number); return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a]; });
const salt = Number(args.salt ?? 0);
const f = resolve(out, `zaman-${Date.now()}.mjs`);
await build({ entryPoints: [resolve(root, 'tools/reels/zaman.ts')], bundle: true, platform: 'node', format: 'esm', outfile: f, logLevel: 'warning' });
const { timeline } = await import(f); rmSync(f, { force: true });
for (const n of levels) {
  const r = timeline(n, salt);
  writeFileSync(resolve(out, `L${String(n).padStart(2, '0')}${salt ? `-s${salt}` : ''}.json`), JSON.stringify(r, null, 1));
  const ev = args.grep ? r.events.filter((e) => e.includes(args.grep)) : r.events;
  console.log(`L${n} ${r.name} [${r.biome}${r.modifiers.length ? ' ' + r.modifiers.join('+') : ''}] ${r.finished ? 'bitti' : 'BİTMEDİ'} ${r.t}s` +
    (r.pathologies.length ? ` · patoloji: ${r.pathologies.map((p) => `${p.t}s ${p.ad}`).join(', ')}` : '') + `\n   ${ev.slice(0, 80).join(' ')}`);
}
