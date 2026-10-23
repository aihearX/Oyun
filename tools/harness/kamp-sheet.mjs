#!/usr/bin/env node
// Kulak Kampı görünüm sayfaları (docs/14-kamp.md §11): binaları Sv 1..en yüksek yan yana tek bir PNG'ye çizer ve ardışık
// seviyelerin gözle görülür biçimde farklı olduğunu denetler (piksel farkı eşiği). Ayrıca süslemelerin sayfası.
// Kullanım: node tools/harness/kamp-sheet.mjs [--only merkez] [--min 0.03] [--min-diger 0.01]
// Çıktı: tools/harness/out/kamp-sayfa/<bina>.png, susler.png; özet konsolda. Eşik altı fark → çıkış kodu 1.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1]; };
const only = opt('only', null);
/** ardışık seviyeler arası en küçük piksel farkı: Merkez her seviyede büyük bir parça alır (%3), diğerleri en az %1 */
const MIN_MERKEZ = Number(opt('min', '0.03')); const MIN_OTHER = Number(opt('min-diger', '0.01'));
const root = resolve(new URL('../..', import.meta.url).pathname);
const out = resolve(root, 'tools/harness/out/kamp-sayfa'); mkdirSync(out, { recursive: true });

const entry = resolve(out, 'entry.ts');
writeFileSync(entry, `
import { buildingCanvas } from '${resolve(root, 'packages/game-core/src/camp/buildings.ts')}';
import { decorCanvas } from '${resolve(root, 'packages/game-core/src/camp/decor.ts')}';
import { BUILDINGS } from '${resolve(root, 'packages/shared/src/index.ts')}';
import { DECORATIONS } from '${resolve(root, 'packages/content/src/index.ts')}';
(window as any).kamp = { buildingCanvas, decorCanvas, BUILDINGS, DECORATIONS };
`);
const res = await build({ entryPoints: [entry], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2020', logLevel: 'warning',
  alias: { '@odi/shared': resolve(root, 'packages/shared/src/index.ts'), '@odi/content': resolve(root, 'packages/content/src/index.ts') } });
const js = res.outputFiles[0].text;

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || (await import('node:fs')).existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined });
const page = await browser.newPage();
await page.setContent('<html><body style="margin:0;background:#1b1446"></body></html>');
await page.addScriptTag({ content: js });

const result = await page.evaluate(({ only }) => {
  const K = window.kamp; const sheets = {};
  /** iki tuvalin farkı: değişen piksel oranı (ortak kutuya, alt-orta hizalı) */
  /** sabit ölçek ve ortak orijin (arsa merkezi hücrenin alt üçte birinde): seviyeler gerçek boylarıyla karşılaştırılır */
  const place = (x, r, cx, cy, w, h, sc) => x.drawImage(r.canvas, cx + w / 2 - r.ox * sc, cy + h * 0.74 - r.oy * sc, r.canvas.width * sc, r.canvas.height * sc);
  const norm = (r, w, h, sc) => { const n = document.createElement('canvas'); n.width = w; n.height = h; const x = n.getContext('2d'); place(x, r, 0, 0, w, h, sc); return x.getImageData(0, 0, w, h).data; };
  const diff = (a, b) => { let n = 0, tot = 0; for (let i = 0; i < a.length; i += 4) { const on = a[i + 3] > 20 || b[i + 3] > 20; if (!on) continue; tot++; if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) + Math.abs(a[i + 3] - b[i + 3]) > 60) n++; } return tot ? n / tot : 0; };
  const report = {};
  for (const b of K.BUILDINGS) {
    if (only && b.id !== only) continue;
    const cols = 5; const rows = Math.ceil(b.maxLevel / cols);
    const big = b.id === 'merkez'; const tall = b.id === 'kule'; const cw = big ? 360 : 260, ch = big ? 420 : tall ? 360 : 250, sc = big ? 0.8 : 0.95;
    const sheet = document.createElement('canvas'); sheet.width = cols * cw; sheet.height = rows * (ch + 24); const sx = sheet.getContext('2d');
    let prev = null; const diffs = [];
    for (let l = 1; l <= b.maxLevel; l++) {
      const r = K.buildingCanvas(b.id, l, 1.2);
      const d = norm(r, cw, ch, sc); if (prev) diffs.push({ level: l, diff: diff(prev, d) }); prev = d;
      const cx = ((l - 1) % cols) * cw, cy = Math.floor((l - 1) / cols) * (ch + 24);
      sx.fillStyle = (l - 1) % 2 ? '#79bd55' : '#6aaa4c'; sx.fillRect(cx, cy, cw, ch + 24);
      sx.save(); sx.beginPath(); sx.rect(cx, cy, cw, ch); sx.clip(); place(sx, r, cx, cy, cw, ch, sc); sx.restore();
      sx.fillStyle = '#2d1d6e'; sx.font = 'bold 15px sans-serif'; sx.fillText(`${b.short ?? b.name} Sv ${l}`, cx + 6, cy + ch + 18);
    }
    sheets[b.id] = sheet.toDataURL('image/png'); report[b.id] = diffs;
  }
  if (!only) {
    const ds = K.DECORATIONS; const cols = 6; const c2 = 150; const rows = Math.ceil(ds.length / cols);
    const sheet = document.createElement('canvas'); sheet.width = cols * c2; sheet.height = rows * (c2 + 22); const sx = sheet.getContext('2d');
    ds.forEach((d, i) => { const cv = K.decorCanvas(d.id, d.size, 2.4); const cx = (i % cols) * c2, cy = Math.floor(i / cols) * (c2 + 22); sx.fillStyle = i % 2 ? '#79bd55' : '#6aaa4c'; sx.fillRect(cx, cy, c2, c2 + 22); const s = Math.min(c2 / cv.width, c2 / cv.height, 1); sx.drawImage(cv, cx + (c2 - cv.width * s) / 2, cy + c2 - cv.height * s, cv.width * s, cv.height * s); sx.fillStyle = '#2d1d6e'; sx.font = 'bold 11px sans-serif'; sx.fillText(d.name, cx + 4, cy + c2 + 15); });
    sheets.susler = sheet.toDataURL('image/png');
  }
  return { sheets, report };
}, { only });
await browser.close();

let bad = 0;
for (const [id, url] of Object.entries(result.sheets)) writeFileSync(resolve(out, `${id}.png`), Buffer.from(url.split(',')[1], 'base64'));
for (const [id, diffs] of Object.entries(result.report)) {
  const MIN = id === 'merkez' ? MIN_MERKEZ : MIN_OTHER;
  const low = diffs.filter((d) => d.diff < MIN);
  const min = diffs.reduce((m, d) => Math.min(m, d.diff), 1);
  console.log(`${low.length ? '✗' : '✓'} ${id}: en küçük ardışık fark %${(min * 100).toFixed(1)}${low.length ? ` · eşik altı: ${low.map((d) => `Sv ${d.level} (%${(d.diff * 100).toFixed(1)})`).join(', ')}` : ''}`);
  if (low.length) bad++;
}
console.log(`sayfalar: ${out}`);
process.exit(bad ? 1 : 0);
