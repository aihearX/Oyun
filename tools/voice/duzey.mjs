#!/usr/bin/env node
/* global OdiDuzey */
// Ses düzeyi ölçümü (MK-018): bütünleşik yükseklik (LUFS), yükseklik aralığı (LRA), en yüksek anlık/kısa süreli yükseklik
// (M/S, 400 ms / 3 sn) ve gerçek tepe (dBTP), ITU-R BS.1770 / EBU R128 — /usr/bin/ffmpeg `ebur128=peak=true` ile. Dış paket yok.
//
//   node tools/voice/duzey.mjs                  # anlatıcı dosyaları (apps/web/public/voice/*.mp3), dosya düzeyinde
//   node tools/voice/duzey.mjs --oyun           # + oyunda duyulan: anlatıcı, müzik (normal ve anlatıcı altında kısık), efektler,
//                                               #   oyunun kendi motoruyla (packages/audio) Chromium OfflineAudioContext'te,
//                                               #   varsayılan ayarlarla (müzik 0,6, efekt 0,9) işlenip ölçülür
//   node tools/voice/duzey.mjs --oyun --muzik 1 --efekt 0.5   # başka kaydırıcı ayarlarıyla
//   node tools/voice/duzey.mjs a.wav b.mp3      # verilen dosyaları ölç
//   --json <yol>   sonuçları JSON'a yaz (varsayılan tools/harness/out/duzey/duzey.json)
//   --is <n>       eşzamanlı ffmpeg sayısı (3)
//   --sakla        --oyun'da işlenen WAV'ları tools/harness/out/duzey/ altında bırak (varsayılan: ölçünce siler)
//
// Notlar: mono dosya ffmpeg'de tek kanal ölçülür; oyunda mono kayıt iki kanala kopyalanır (stereo ölçümde +3 LU).
// Bu yüzden karşılaştırma için --oyun ölçümleri esastır (hepsi stereo, aynı zincirden geçmiş). Kısa efektlerde bütünleşik
// değer anlamsızlaşır (400 ms'den kısa): efektler için en yüksek anlık yükseklik (M en yüksek) karşılaştırılır.
// Onaylı ses dosyalarına dokunmaz; yalnız okur. --oyun için Playwright Chromium gerekir (PLAYWRIGHT_CHROMIUM).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FFMPEG = existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : 'ffmpeg';
const argv = process.argv.slice(2);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const flag = (f) => argv.includes(f);
const VALUED = new Set(['--json', '--is', '--muzik', '--efekt']);
const files = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
const OUT = resolve(root, 'tools/harness/out/duzey');
const jsonPath = resolve(opt('--json', join(OUT, 'duzey.json')));
const jobs = Math.max(1, Number(opt('--is', 3)));

/** ffmpeg ebur128: { I, LRA, thresh, tp, mMax, sMax, dur } (sessizse I = null) */
export function measure(file) {
  return new Promise((res, rej) => {
    const p = spawn('nice', ['-n', '10', FFMPEG, '-hide_banner', '-nostats', '-i', file, '-filter_complex', 'ebur128=peak=true:framelog=info', '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', rej);
    p.on('close', (code) => {
      if (code !== 0) return rej(new Error(`${file}: ffmpeg ${code}\n${err.slice(-400)}`));
      let mMax = -Infinity, sMax = -Infinity, dur = 0;
      for (const m of err.matchAll(/t:\s*([\d.]+)\s+TARGET:.*?M:\s*(-?[\d.]+|-inf)\s+S:\s*(-?[\d.]+|-inf)/g)) {
        dur = Math.max(dur, Number(m[1])); const M = Number(m[2]), S = Number(m[3]);
        if (Number.isFinite(M)) mMax = Math.max(mMax, M); if (Number.isFinite(S)) sMax = Math.max(sMax, S);
      }
      const sum = err.slice(err.lastIndexOf('Summary:'));
      const num = (re) => { const m = sum.match(re); return m ? Number(m[1]) : null; };
      const I = num(/I:\s*(-?[\d.]+) LUFS/);
      const tp = num(/Peak:\s*(-?[\d.]+|-inf) dBFS/);
      res({ I: I != null && I > -69.9 ? I : null, LRA: num(/LRA:\s*([\d.]+) LU/), thresh: num(/Threshold:\s*(-?[\d.]+) LUFS/), tp: Number.isFinite(tp) ? tp : null, mMax: Number.isFinite(mMax) ? mMax : null, sMax: Number.isFinite(sMax) ? sMax : null, dur: Math.round(dur * 100) / 100 });
    });
  });
}

/** sınırlı eşzamanlılıkla eşle */
async function pool(items, fn, n = jobs) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}

const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const fmt = (x, w = 6) => String(x == null ? '—' : r1(x).toFixed(1)).padStart(w);
const stats = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b); if (!s.length) return null;
  const q = (p) => { const k = (s.length - 1) * p; const lo = Math.floor(k), hi = Math.ceil(k); return s[lo] + (s[hi] - s[lo]) * (k - lo); };
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return { n: s.length, min: r1(s[0]), p10: r1(q(0.1)), median: r1(q(0.5)), mean: r1(mean), p90: r1(q(0.9)), max: r1(s[s.length - 1]), sd: r1(Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length)) };
};
/** güç toplamı (dB) */
const powSum = (...dbs) => 10 * Math.log10(dbs.reduce((a, d) => a + 10 ** (d / 10), 0));

const result = { olcum: new Date().toISOString(), ffmpeg: FFMPEG };

// ---- 1) verilen dosyalar
if (files.length) {
  const rows = await pool(files, async (f) => ({ file: f, ...(await measure(f)) }));
  for (const r of rows) console.log(`${basename(r.file).padEnd(36)} I ${fmt(r.I)} LUFS  LRA ${fmt(r.LRA, 5)}  M en yüksek ${fmt(r.mMax)}  tepe ${fmt(r.tp)} dBTP  ${r.dur} sn`);
  result.dosyalar = rows;
  mkdirSync(dirname(jsonPath), { recursive: true }); writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  process.exit(0);
}

// ---- 2) anlatıcı dosyaları (dosya düzeyinde, mono)
const VOICE = join(root, 'apps/web/public/voice');
const mp3s = readdirSync(VOICE).filter((f) => f.endsWith('.mp3')).sort();
const t0 = Date.now();
const voice = await pool(mp3s, async (f) => ({ id: f.replace(/\.mp3$/, ''), ...(await measure(join(VOICE, f))) }));
result.anlatici = { dosya: voice, ozet: { I: stats(voice.map((v) => v.I)), tp: stats(voice.map((v) => v.tp)), LRA: stats(voice.map((v) => v.LRA)), mMax: stats(voice.map((v) => v.mMax)) } };
const byI = voice.filter((v) => v.I != null).sort((a, b) => b.I - a.I);
console.log(`— anlatıcı dosyaları: ${voice.length} satır (${((Date.now() - t0) / 1000).toFixed(1)} sn) —`);
const s = result.anlatici.ozet.I;
console.log(`I (LUFS): en düşük ${s.min}  %10 ${s.p10}  ortanca ${s.median}  ortalama ${s.mean}  %90 ${s.p90}  en yüksek ${s.max}  (std ${s.sd})`);
console.log(`gerçek tepe (dBTP): en yüksek ${result.anlatici.ozet.tp.max}, ortanca ${result.anlatici.ozet.tp.median}`);
const row = (v) => `  ${v.id.padEnd(30)} I ${fmt(v.I)}  LRA ${fmt(v.LRA, 5)}  M en yüksek ${fmt(v.mMax)}  tepe ${fmt(v.tp)}  ${v.dur} sn`;
console.log('en yüksek 10:'); for (const v of byI.slice(0, 10)) console.log(row(v));
console.log('en düşük 10:'); for (const v of byI.slice(-10).reverse()) console.log(row(v));
const silent = voice.filter((v) => v.I == null); if (silent.length) console.log(`ölçülemeyen (sessiz?): ${silent.map((v) => v.id).join(', ')}`);

// ---- 3) oyunda duyulan (motor üzerinden, varsayılan ayarlar)
if (flag('--oyun')) {
  const vols = { music: Number(opt('--muzik', 0.6)), sfx: Number(opt('--efekt', 0.9)) };
  const { build } = await import('esbuild');
  const { chromium } = await import('playwright');
  const tag = `m${vols.music}-e${vols.sfx}`;
  for (const d of ['anlatici', 'muzik', 'muzik-kisik', 'sfx', 'karisim']) mkdirSync(join(OUT, tag, d), { recursive: true });
  const bundle = await build({ entryPoints: [join(root, 'tools/harness/duzey-sayfa.ts')], bundle: true, write: false, format: 'iife', target: 'es2020', logLevel: 'warning' });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  await page.setContent('<!doctype html><title>düzey</title>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  // işlenen WAV'lar (32 bit, 48 kHz) büyüktür: ölçülünce silinir; --sakla ile kalır (dinlemek için)
  const measureWav = async (p) => { const m = await measure(p); if (!flag('--sakla')) { try { unlinkSync(p); } catch { /* yok */ } } return m; };
  const save = (dir, name, r) => { const p = join(OUT, tag, dir, `${name.replace(':', '-')}.wav`); writeFileSync(p, Buffer.from(r.wav, 'base64')); return p; };
  const oyun = { ayar: vols, anlatici: [], muzik: [], sfx: [], karisim: [] };
  const t1 = Date.now();

  // anlatıcı: her satır (sayfada sırayla işlenir, ölçüm ffmpeg havuzunda)
  const vpaths = [];
  for (const f of mp3s) {
    const b64 = readFileSync(join(VOICE, f)).toString('base64');
    vpaths.push(save('anlatici', f.replace(/\.mp3$/, ''), await page.evaluate(([b, v]) => OdiDuzey.voice(b, v), [b64, vols])));
  }
  oyun.anlatici = await pool(vpaths, async (p) => ({ id: basename(p, '.wav'), ...(await measureWav(p)) }));

  // öneri sınaması: ortancanın 1 LU'dan fazla altında kalan satırlara oynatma kazancı (dosyaya dokunmadan).
  // voice() kazancı 1,5'te keser → efekt 0,9'da en çok ×1,67 (+4,4 dB); tepe motorun kompresöründe tutulur.
  const target = stats(oyun.anlatici.map((v) => v.I)).median;
  const quiet = oyun.anlatici.filter((v) => v.I != null && v.I < target - 1);
  mkdirSync(join(OUT, tag, 'anlatici-kazanc'), { recursive: true });
  oyun.kazanc = { hedef: target, satir: [] };
  for (const v of quiet) {
    const want = 10 ** ((target - v.I) / 20); const extra = Math.min(want, 1.5 / Math.max(0.2, Math.min(1, vols.sfx)));
    const p = save('anlatici-kazanc', v.id, await page.evaluate(([b, vv, x]) => OdiDuzey.voice(b, vv, undefined, x), [readFileSync(join(VOICE, `${v.id}.mp3`)).toString('base64'), vols, extra]));
    const m = await measureWav(p);
    oyun.kazanc.satir.push({ id: v.id, once: v.I, onceTp: v.tp, carpan: Math.round(extra * 100) / 100, db: r1(20 * Math.log10(extra)), sonra: m.I, sonraTp: m.tp, istenenDb: r1(20 * Math.log10(want)) });
  }

  // müzik: tam döngü, normal ve anlatıcı altında (duck 0,3)
  const tracks = await page.evaluate(() => OdiDuzey.tracks());
  for (const t of tracks) {
    const a = save('muzik', t, await page.evaluate(([n, v]) => OdiDuzey.track(n, v), [t, vols]));
    const b = save('muzik-kisik', t, await page.evaluate(([n, v]) => OdiDuzey.track(n, v, 0.3), [t, vols]));
    const [ma, mb] = await Promise.all([measureWav(a), measureWav(b)]);
    oyun.muzik.push({ id: t, ...ma, kisik: mb });
  }
  // efektler (vol 1)
  const effects = await page.evaluate(() => OdiDuzey.sfx());
  const spaths = []; for (const e of effects) spaths.push(save('sfx', e, await page.evaluate(([n, v]) => OdiDuzey.effect(n, v), [e, vols])));
  oyun.sfx = await pool(spaths, async (p) => ({ id: basename(p, '.wav'), ...(await measureWav(p)) }));

  // karışım: anlatıcı satırları müziğin üstünde (gerçek zincir: duck + ortak kompresör) — tipik eşleşmeler
  const MIX = [['akis-01', 'harita'], ['kamp-sira-01', 'menu'], ['pat-otitis-eksterna', 'biyom:dis-kulak'], ['pat-otoskleroz', 'biyom:kemikcikler'], ['akis-02', 'boss']];
  for (const [id, t] of MIX) {
    const f = mp3s.find((x) => x === `${id}.mp3`); if (!f) throw new Error(`karışım satırı yok: ${id}`);
    const p = save('karisim', `${f.replace(/\.mp3$/, '')}+${t}`, await page.evaluate(([b, v, tr]) => OdiDuzey.voice(b, v, tr), [readFileSync(join(VOICE, f)).toString('base64'), vols, t]));
    const lineAlone = oyun.anlatici.find((v) => v.id === f.replace(/\.mp3$/, ''));
    const mus = oyun.muzik.find((m) => m.id === t);
    const m = await measureWav(p);
    oyun.karisim.push({ id: f.replace(/\.mp3$/, ''), parca: t, ...m, anlaticiTek: lineAlone?.I ?? null, muzikKisik: mus?.kisik.I ?? null, beklenenToplam: lineAlone?.I != null && mus?.kisik.I != null ? r1(powSum(lineAlone.I, mus.kisik.I)) : null });
  }
  await browser.close();

  const vI = stats(oyun.anlatici.map((v) => v.I));
  oyun.ozet = { anlatici: { I: vI, tp: stats(oyun.anlatici.map((v) => v.tp)), mMax: stats(oyun.anlatici.map((v) => v.mMax)) }, muzik: { I: stats(oyun.muzik.map((m) => m.I)), kisikI: stats(oyun.muzik.map((m) => m.kisik.I)) }, sfx: { mMax: stats(oyun.sfx.map((x) => x.mMax)), tp: stats(oyun.sfx.map((x) => x.tp)) }, hatalar: errors };
  // dosya → oyun farkı (motor zincirinin net kazancı: mono→stereo +3, kazanç 0,9, kompresör ve ana kazanç)
  const fileI = Object.fromEntries(voice.map((v) => [v.id, v.I]));
  oyun.ozet.zincirFarki = stats(oyun.anlatici.map((v) => (v.I != null && fileI[v.id] != null ? v.I - fileI[v.id] : null)));
  result.oyun = oyun;

  const ref = vI.median;
  console.log(`\n— oyunda duyulan (müzik ${vols.music}, efekt ${vols.sfx}; ${((Date.now() - t1) / 1000).toFixed(0)} sn) —`);
  console.log(`anlatıcı I: ortanca ${vI.median} (en düşük ${vI.min}, en yüksek ${vI.max}); dosya→oyun farkı ortanca ${oyun.ozet.zincirFarki.median} LU; gerçek tepe en yüksek ${oyun.ozet.anlatici.tp.max} dBTP`);
  console.log(`öneri sınaması: ortancanın (${oyun.kazanc.hedef}) 1 LU'dan fazla altındaki ${oyun.kazanc.satir.length} satıra oynatma kazancı:`);
  for (const k of oyun.kazanc.satir) console.log(`  ${k.id.padEnd(24)} ${fmt(k.once)} → ${fmt(k.sonra)} LUFS  kazanç ×${k.carpan} (${k.db} dB${k.istenenDb > k.db ? `, istenen ${k.istenenDb}` : ''})  tepe ${fmt(k.onceTp)} → ${fmt(k.sonraTp)} dBTP`);
  console.log('müzik (tam döngü):                 I      kısık I   anlatıcı−kısık   tepe');
  for (const m of oyun.muzik) console.log(`  ${m.id.padEnd(22)} ${fmt(m.I)}  ${fmt(m.kisik.I)}  ${fmt(m.kisik.I != null ? ref - m.kisik.I : null, 8)} LU   ${fmt(m.tp)}`);
  console.log('efektler (M en yüksek, anlatıcı ortancasına göre):');
  for (const x of [...oyun.sfx].sort((a, b) => (b.mMax ?? -99) - (a.mMax ?? -99))) console.log(`  ${x.id.padEnd(14)} M ${fmt(x.mMax)}  fark ${fmt(x.mMax != null ? x.mMax - ref : null)} LU  tepe ${fmt(x.tp)} dBTP`);
  console.log('karışım (anlatıcı + müzik, kompresör ortak):');
  for (const k of oyun.karisim) console.log(`  ${k.id.padEnd(16)} + ${k.parca.padEnd(18)} I ${fmt(k.I)}  (ayrı ölçümlerden beklenen ${fmt(k.beklenenToplam)})  tepe ${fmt(k.tp)}`);
  if (errors.length) console.log('SAYFA HATALARI:\n  ' + errors.join('\n  '));
}

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, JSON.stringify(result, null, 2));
console.log(`\nJSON: ${jsonPath}`);
