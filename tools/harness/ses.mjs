#!/usr/bin/env node
/* global OdiSes */
// ODİ ses ölçümü: @odi/audio motorunu Playwright'ta (Chromium) OfflineAudioContext ile çalıştırır;
// her müzik parçasının 8 saniyesini ve her SFX'i WAV olarak yazar, RMS/tepe/kırpılma/spektral merkezi raporlar.
// Kullanım: node tools/harness/ses.mjs [--saniye 8]
// Çıktı: tools/harness/out/ses/{muzik,sfx}/*.wav + rapor.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] ?? '1'] : []).filter((x) => x.length));
const seconds = Number(args.saniye ?? 8);
const root = resolve(new URL('../..', import.meta.url).pathname);
const out = resolve(root, 'tools/harness/out/ses');
for (const d of ['muzik', 'sfx']) mkdirSync(resolve(out, d), { recursive: true });

const bundle = await build({ entryPoints: [resolve(root, 'tools/harness/ses-page.ts')], bundle: true, write: false, format: 'iife', target: 'es2020', logLevel: 'warning' });
const code = bundle.outputFiles[0].text;

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
await page.setContent('<!doctype html><title>ses</title>');
await page.addScriptTag({ content: code });

const report = { muzik: [], sfx: [], ozel: [] };
const save = (dir, r) => { writeFileSync(resolve(out, dir, `${r.name.replace(':', '-')}.wav`), Buffer.from(r.wav, 'base64')); delete r.wav; return r; };
const line = (r) => `${r.name.padEnd(20)} ${String(r.seconds).padStart(5)} sn  RMS ${String(r.rmsDb).padStart(6)} dB  tepe ${String(r.peakDb).padStart(6)} dB  kırpılma ${String(r.clipped).padStart(3)}  merkez ${String(r.centroidHz).padStart(5)} Hz  bant %${r.bands.low}/${r.bands.mid}/${r.bands.high}`;

console.log('— müzik —');
for (const t of await page.evaluate(() => OdiSes.tracks())) { const r = save('muzik', await page.evaluate(([n, s]) => OdiSes.track(n, s), [t, seconds])); report.muzik.push(r); console.log(line(r)); }
console.log('— efektler —');
for (const s of await page.evaluate(() => OdiSes.sfx())) { const r = save('sfx', await page.evaluate((n) => OdiSes.effect(n), s)); report.sfx.push(r); console.log(line(r)); }
console.log('— sınırlayıcı: 30 jeton / 15 ms —');
{ const r = save('sfx', await page.evaluate(() => OdiSes.coinRain())); report.ozel.push(r); console.log(line(r)); }

const all = [...report.muzik, ...report.sfx, ...report.ozel];
const problems = [];
for (const r of all) { if (r.clipped > 0) problems.push(`${r.name}: kırpılma ${r.clipped}`); if (r.peak < 0.02) problems.push(`${r.name}: neredeyse sessiz`); }
const cents = report.muzik.map((r) => r.centroidHz).sort((a, b) => a - b);
let minGap = Infinity; for (let i = 1; i < cents.length; i++) minGap = Math.min(minGap, cents[i] - cents[i - 1]);
const sigs = new Set(report.muzik.map((r) => `${r.centroidHz}|${r.rmsDb}`));
if (sigs.size !== report.muzik.length) problems.push('iki parça ölçüde aynı');
report.ozet = { parca: report.muzik.length, efekt: report.sfx.length, kirpilma: all.reduce((a, r) => a + r.clipped, 0), merkezAraligi: [cents[0], cents[cents.length - 1]], enYakinMerkezFarki: minGap, sorunlar: problems, hatalar: errors };
writeFileSync(resolve(out, 'rapor.json'), JSON.stringify(report, null, 2));
console.log(`\nözet: ${report.muzik.length} parça, ${report.sfx.length} efekt; kırpılma toplam ${report.ozet.kirpilma}; spektral merkez ${cents[0]}–${cents[cents.length - 1]} Hz (en yakın iki parça farkı ${minGap} Hz)`);
if (problems.length || errors.length) { console.log('SORUNLAR:\n  ' + [...problems, ...errors].join('\n  ')); }
await browser.close();
process.exit(problems.length || errors.length ? 1 : 0);
