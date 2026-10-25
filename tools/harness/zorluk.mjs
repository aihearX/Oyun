#!/usr/bin/env node
// Zorluk eğrisi ölçümü (docs/12-zorluk-egrisi.md). İnsan benzeri oyuncu modeli (game-core play/human.ts), Phaser'sız, paralel.
// Kullanım:
//   node tools/harness/zorluk.mjs --odalar [--k 16] [--parallel 4] [--ids oda1,oda2]
//        her odayı tek başına ölçer → packages/content/src/chunks/puanlar.ts (üretici oda seçiminde kullanır)
//   node tools/harness/zorluk.mjs --bolumler [--levels 1-40] [--k 8] [--parallel 4] [--tag sonra] [--fail 0] [--stars 2]
//        her bölümü k tohumla oynar → tools/harness/out/zorluk/<tag>.json
//   node tools/harness/zorluk.mjs --kalibre [--k 12] [--v 10] [--levels 8,12,23]
//        bölüm başına üretici varyantı: hedefe tahminen en yakın 3 varyant ölçülür, en yakını → packages/level-gen/src/kalibrasyon.ts
//   node tools/harness/zorluk.mjs --sure [--k 48]
//        süreli bölümlerin 3★/2★ süre oranları (bitirenlerin süre dilimlerinden) → packages/level-gen/src/sure.ts
//   node tools/harness/zorluk.mjs --odalar --notaci [--ids a,b] [--k 48] [--tag oda-nota] [--once oda-nota-once]
//        odaların (varsayılan: bütün yüzme odaları) toplanan nota oranı: ana yol kitlesi ve notaya dalan kademe (MK-015);
//        puanlar.ts'e dokunmaz → tools/harness/out/zorluk/<tag>.json
//   node tools/harness/zorluk.mjs --yildiz [--levels 21,22,27,28] [--k 48] [--tag yildiz] [--once yildiz-once] [--ilk | --notaci]
//        bölümleri oyundaki yıldız kuralıyla (scoreRun) oynar: bitirenlerin nota oranı ve yıldız dağılımı; --once ile önce/sonra tablosu;
//        --notaci: notaya dalan kademe (human.ts → notaciOf)
//   node tools/harness/zorluk.mjs --belge [--once once] [--sonra sonra] [--ilk ilk]
//        tabloyu docs/12-zorluk-egrisi.md içine (işaretler arasına) ve grafiği docs/img/zorluk-egrisi.svg'ye yazar
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1'] : []).filter(Boolean));
const root = resolve(new URL('../..', import.meta.url).pathname);
const outDir = resolve(root, 'tools/harness/out/zorluk'); mkdirSync(outDir, { recursive: true });
const parallel = Number(args.parallel ?? 4);
const K = Number(args.k ?? 8);

async function worker() {
  const file = resolve(outDir, 'olc.mjs');
  await build({ entryPoints: [resolve(root, 'tools/harness/zorluk-olc.ts')], bundle: true, platform: 'node', format: 'esm', outfile: file, logLevel: 'warning' });
  return file;
}
/** paketlerden küçük bir modül derleyip yükle (her çalıştırmada taze) */
async function bundled(contents, name) {
  const f = resolve(outDir, `${name}-${Date.now()}.mjs`);
  await build({ stdin: { contents, resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile: f, logLevel: 'warning' });
  try { return await import(f); } finally { rmSync(f, { force: true }); }
}
/** işleri paralel işçilere dağıt; her satır bir JSON */
async function runAll(file, mode, items, extra = [], part = null) {
  // ara sonuçlar `part` dosyasına satır satır yazılır; yeniden çalıştırınca bitmiş işler atlanır (kap yeniden başlarsa devam)
  const out = []; const key = (r) => String(r.id ?? r.n);
  if (part && existsSync(part)) for (const l of readFileSync(part, 'utf8').split('\n')) if (l.trim()) out.push(JSON.parse(l));
  const have = new Set(out.map(key)); const queue = items.filter((i) => !have.has(String(i))); let done = 0;
  if (have.size) console.log(`${have.size} iş önceki çalıştırmadan alındı`);
  const one = (batch) => new Promise((res, rej) => {
    const p = spawn(process.execPath, [file, mode, ...batch.map(String), '--k', String(K), ...extra], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = ''; p.stdout.on('data', (d) => { buf += d; });
    p.on('exit', (c) => { if (c !== 0) return rej(new Error(`işçi ${c}`)); for (const l of buf.split('\n')) if (l.trim()) { out.push(JSON.parse(l)); if (part) appendFileSync(part, l + '\n'); } res(); });
  });
  await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, async () => {
    while (queue.length) { const batch = queue.splice(0, mode === 'oda' ? 6 : 1); await one(batch); done += batch.length; process.stdout.write(`\r${done}/${queue.length + done}`); }
  }));
  process.stdout.write('\n');
  return out;
}

/** bölüm zorluk puanı: game-core play/human.ts `scoreRuns` (tek tanım) */
const { scoreRuns: scoreOf } = await bundled("export { scoreRuns } from './packages/game-core/src/play/human';", 'puan');

if (args.odalar && args.notaci) {
  // MK-015: odaların nota toplama oranı, iki kitle (puanlar.ts değişmez)
  const { SWIM } = await bundled("import { ALL_CHUNKS } from '@odi/content'; export const SWIM = ALL_CHUNKS.filter((c) => c.mechanic === 'yuzme').map((c) => c.id);", 'yuzme');
  const ids = args.ids ? String(args.ids).split(',') : SWIM;
  const file = await worker(); const tag = args.tag ?? 'oda-nota';
  const rows = (await runAll(file, 'odanota', ids, [], resolve(outDir, `${tag}.part.jsonl`))).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  writeFileSync(resolve(outDir, `${tag}.json`), JSON.stringify({ k: K, rows }, null, 1));
  rmSync(resolve(outDir, `${tag}.part.jsonl`), { force: true });
  const of = args.once && resolve(outDir, `${args.once}.json`); const B = of && existsSync(of) ? Object.fromEntries(JSON.parse(readFileSync(of, 'utf8')).rows.map((r) => [r.id, r])) : {};
  const pc = (x) => `${Math.round(x * 100)}%`; const f2 = (x) => x.toFixed(2);
  console.log(`| Oda | Nota | Kitle: toplama | Notacı: toplama | Notacı: bitirme / can kaybı |${of ? ' Önce notacı: toplama |' : ''}\n|---|---|---|---|---|${of ? '---|' : ''}`);
  for (const r of rows) console.log(`| ${r.id} | ${r.total} | ${pc(r.kitle.col)} | ${pc(r.notaci.col)} | ${pc(r.notaci.fin)} / ${f2(r.notaci.dmg)} |${of ? ` ${B[r.id] ? pc(B[r.id].notaci.col) : '–'} |` : ''}`);
  console.log(`→ tools/harness/out/zorluk/${tag}.json`);
}

if (args.odalar && !args.notaci) {
  const { ALL_CHUNKS } = await bundled("export { ALL_CHUNKS } from '@odi/content';", 'chunks');
  const file = await worker();
  const ids = ALL_CHUNKS.map((c) => c.id);
  // --ids a,b: yalnız bu odaları (yeni/değişen) ölç, diğerlerinin ölçümü dosyadan korunur
  const only = args.ids ? String(args.ids).split(',') : null;
  const pfile = resolve(root, 'packages/content/src/chunks/puanlar.ts');
  const old = new Map(); if (only && existsSync(pfile)) for (const m of readFileSync(pfile, 'utf8').matchAll(/^ {2}'([^']+)': (\{.*\}),$/gm)) old.set(m[1], m[2]);
  const measured = (await runAll(file, 'oda', only ?? ids, [], resolve(outDir, 'odalar.part.jsonl')));
  const rows = ids.map((id) => measured.find((r) => r.id === id) ?? (old.has(id) ? { id, raw: old.get(id) } : null)).filter(Boolean);
  const r2 = (x) => Math.round(x * 1000) / 1000;
  const body = rows.map((r) => r.raw ? `  '${r.id}': ${r.raw},` : `  '${r.id}': { dmg: ${r2(r.dmg)}, h0: ${r2(r.h0)}, h1: ${r2(r.h1)}, hit: ${r2(r.hit)}, nm: ${r2(r.nm)}, n: ${r.n} },`).join('\n');
  const src = `/**
 * Oda zorluk ölçümleri — ÜRETİLMİŞ dosya, elle düzenlemeyin: \`node tools/harness/zorluk.mjs --odalar\`.
 * Her oda tek başına (önünde/arkasında düz zemin), her tohumda rastgele başlangıç evresiyle n'er kez oynanır (game-core \`play/human.ts\`).
 * dmg: acemi modelin (NOVICE, düğmesiz oda) ortalama can kaybı · h0 / h1: oyuncu kitlesinin en bağışlayıcı (sıkılık 0) ve en sıkı
 * (sıkılık 1) geometri/zamanlama düğmeleriyle ortalama can kaybı · hit: acemi modelin hasar alma olasılığı · nm: yakın kaçış.
 */
export interface RoomRating { dmg: number; h0: number; h1: number; hit: number; nm: number; n: number }
export const ROOM_RATINGS: Record<string, RoomRating> = {
${body}
};
`;
  writeFileSync(resolve(root, 'packages/content/src/chunks/puanlar.ts'), src);
  rmSync(resolve(outDir, 'odalar.part.jsonl'), { force: true });
  console.log(`${rows.length} oda ölçüldü → packages/content/src/chunks/puanlar.ts`);
}

if (args.kalibre) {
  // bölüm başına varyant seçimi: ölçülen can kaybı hedefe en yakın (boss'lar hariç; onlar düğmelerle ayarlı)
  // --levels 8,12,23: yalnız bu bölümler yeniden kalibre edilir, diğerlerinin seçimi dosyadan korunur
  const only = args.levels ? String(args.levels).split(',').map(Number) : null;
  const levels = (only ?? Array.from({ length: 40 }, (_, i) => i + 1)).filter((n) => n % 20 !== 0).sort((a, b) => b - a);
  const kfile = resolve(root, 'packages/level-gen/src/kalibrasyon.ts');
  const keep = new Map(); if (only && existsSync(kfile)) for (const m of readFileSync(kfile, 'utf8').matchAll(/^ {2}(\d+): (\d+),$/gm)) if (!only.includes(Number(m[1]))) keep.set(Number(m[1]), Number(m[2]));
  const file = await worker();
  const rows = (await runAll(file, 'kalibre', levels, ['--v', String(args.v ?? 10)], resolve(outDir, 'kalibre.part.jsonl'))).sort((a, b) => a.n - b.n);
  writeFileSync(resolve(outDir, 'kalibre.json'), JSON.stringify(rows, null, 1));
  // en yakın; final hedefin altında, bölge girişi hedefin üstünde kalırsa ek ceza (sıralama: final doruk, giriş nefes)
  const { ZONES: KZ } = await bundled("export { CURVE_ZONES as ZONES } from '@odi/level-gen';", 'kz');
  const cost = (r, c) => { const z = KZ.find((q) => r.n >= q.from && r.n <= q.to); const d = c.dmg - r.target; return Math.abs(d) + (z && r.n === z.peak && d < 0 ? -0.5 * d : 0) + (z && r.n === z.from && d > 0 ? 0.5 * d : 0); };
  const pickBest = (r) => r.cands.slice().sort((a, b) => cost(r, a) - cost(r, b))[0];
  const chosen = new Map(keep);
  const body0 = rows.map((r) => { const b = pickBest(r); console.log(`L${String(r.n).padStart(2, '0')} hedef ${r.target.toFixed(2)} → v${b.v} (tahmin ${b.pred.toFixed(2)}, ölçülen ${b.dmg.toFixed(2)})  [${r.cands.map((c) => `v${c.v}:${c.dmg.toFixed(2)}`).join(' ')}]`); chosen.set(r.n, b.v); return null; });
  void body0;
  const body = [...chosen].filter(([, v]) => v).sort((a, b) => a[0] - b[0]).map(([n, v]) => `  ${n}: ${v},`).join('\n');
  const src = `/**
 * Bölüm kalibrasyonu — ÜRETİLMİŞ dosya: \`node tools/harness/zorluk.mjs --kalibre\`. Bölüm → üretici varyantı (0 = varsayılan).
 * Her bölüm için hedef eğriye tahminen en yakın birkaç varyant insan modeliyle ölçülür, ölçülen can kaybı hedefe en yakın olan seçilir.
 * 4-8 (ilk kez oynayan kademe ve kitle), 11, 12, 18, 19, 23-26, 30, 32, 33, 36 ve 39 sonradan 48 oyunculuk varyant taramasıyla
 * elle seçildi (docs/12 §8); \`--kalibre\` yalnız \`--levels\` ile verilen bölümleri yazar.
 */
export const KALIBRASYON: Record<number, number> = {
${body}
};
`;
  writeFileSync(resolve(root, 'packages/level-gen/src/kalibrasyon.ts'), src);
  rmSync(resolve(outDir, 'kalibre.part.jsonl'), { force: true });
  console.log('→ packages/level-gen/src/kalibrasyon.ts');
}

if (args.sure) {
  // süreli bölümlerin yıldız süreleri. Otomatik koşuda süre çoğunlukla düşüş ve geri dönüşle uzar (bitirenlerin süreleri birkaç
  // saniyelik bir bantta toplanır), bu yüzden dilim değil "temiz koşu" ölçüsü: bitirenlerin en hızlı %10'unun süresi (T10);
  // 3★ = T10 × 1,06 (temiz ya da tek takılmalı koşu), 2★ = T10 × 1,2 (birkaç düşüşlü koşu). Par'a oranla yazılır (yardım
  // kademesi bölümü kısaltınca süreler de kısalır)
  const SURE_CLEAN = 0.1, SURE_3 = 1.06, SURE_2 = 1.2;
  const { PLAN } = await bundled("import { HUMAN_JOURNEY } from '@odi/content'; export const PLAN = HUMAN_JOURNEY.levels.map((l) => ({ n: l.number, o: l.objective }));", 'plan');
  const levels = PLAN.filter((l) => l.o === 'timed').map((l) => l.n);
  const file = await worker();
  const rows = (await runAll(file, 'sure', levels, [], resolve(outDir, 'sure.part.jsonl'))).sort((a, b) => a.n - b.n);
  const q = (xs, p) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))]; };
  const up = (x) => Math.ceil(x * 100 - 1e-6) / 100; // yukarı yuvarla: dilimdeki oyuncu eşiğin içinde kalsın
  const body = rows.map((r) => { const t = r.runs.filter((x) => x.fin).map((x) => x.t); const clean = q(t, SURE_CLEAN); const a = up((clean * SURE_3) / r.par), b = up(Math.max((clean * SURE_2) / r.par, a + 0.03)); console.log(`L${r.n} par ${r.par} bitiren ${t.length}/${r.runs.length}, temiz koşu ${clean} sn → 3★ ${Math.round(r.par * a)} sn (${a}), 2★ ${Math.round(r.par * b)} sn (${b})`); return `  ${r.n}: [${a}, ${b}],`; }).join('\n');
  const sfile = resolve(root, 'packages/level-gen/src/sure.ts');
  writeFileSync(sfile, readFileSync(sfile, 'utf8').replace(/= \{[\s\S]*\};/, `= {\n${body}\n};`));
  rmSync(resolve(outDir, 'sure.part.jsonl'), { force: true });
  console.log('→ packages/level-gen/src/sure.ts');
}

if (args.bolumler) {
  const [lo, hi] = String(args.levels ?? '1-40').split('-').map(Number);
  const levels = Array.from({ length: (hi ?? lo) - lo + 1 }, (_, i) => lo + i);
  // ağır bölümler (boss, uzun) önce: paralel kuyruk dengeli bitsin
  levels.sort((a, b) => (b % 20 === 0) - (a % 20 === 0) || b - a);
  const file = await worker();
  const extra = []; if (args.fail) extra.push('--fail', String(args.fail)); if (args.stars) extra.push('--stars', String(args.stars)); if (args.salt) extra.push('--salt', String(args.salt)); if (args.acemi) extra.push('--acemi'); if (args.ilk) extra.push('--ilk');
  const tag = args.tag ?? 'sonra';
  const rows = (await runAll(file, 'bolum', levels, extra, resolve(outDir, `${tag}.part.jsonl`))).sort((a, b) => a.n - b.n);
  writeFileSync(resolve(outDir, `${tag}.json`), JSON.stringify({ k: K, params: extra, rows }, null, 1));
  rmSync(resolve(outDir, `${tag}.part.jsonl`), { force: true });
  for (const r of rows) { const s = scoreOf(r.runs); console.log(`L${String(r.n).padStart(2, '0')} bitirme ${(s.fin * 100).toFixed(0).padStart(3)}%  can kaybı ${s.dmg.toFixed(2)}  düşme ${s.deaths.toFixed(2)}  yakın/dk ${s.nmPerMin.toFixed(1).padStart(4)}  puan ${s.score.toFixed(2)}`); }
  console.log(`→ tools/harness/out/zorluk/${tag}.json`);
}

if (args.yildiz) {
  // yıldızlar (docs/12 §6, MK-008): oran = bitirenler içinde; "≥ %x" sütunları 2★ nota eşiği x olsaydı bitirenlerin kaçı alırdı
  const levels = String(args.levels ?? '21,22,27,28').split(',').flatMap((p) => { const [a, b] = p.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); });
  const file = await worker(); const tag = args.tag ?? 'yildiz';
  const rows = (await runAll(file, 'yildiz', levels, args.ilk ? ['--ilk'] : args.notaci ? ['--notaci'] : [], resolve(outDir, `${tag}.part.jsonl`))).sort((a, b) => a.n - b.n);
  writeFileSync(resolve(outDir, `${tag}.json`), JSON.stringify({ k: K, rows }, null, 1));
  rmSync(resolve(outDir, `${tag}.part.jsonl`), { force: true });
  const pc = (x) => `${Math.round(x * 100)}%`;
  const stat = (r) => { const f = r.runs.filter((x) => x.fin); const n = Math.max(1, f.length); const rs = f.map((x) => x.r).sort((a, b) => a - b);
    return { fin: f.length / r.runs.length, med: rs.length ? rs[Math.floor((rs.length - 1) / 2)] : 0, s2: f.filter((x) => x.s >= 2).length / n, s3: f.filter((x) => x.s === 3).length / n, at: (q) => f.filter((x) => x.r >= q - 1e-9).length / n }; };
  for (const r of rows) { const a = stat(r); console.log(`L${r.n} notalar ${r.total}  bitirme ${pc(a.fin)}  nota medyanı ${pc(a.med)}  bitirenlerde ★≥2 ${pc(a.s2)} ★3 ${pc(a.s3)}  (≥%45 ${pc(a.at(0.45))} · ≥%50 ${pc(a.at(0.5))} · ≥%55 ${pc(a.at(0.55))} · ≥%60 ${pc(a.at(0.6))})`); }
  const of = args.once && resolve(outDir, `${args.once}.json`);
  if (of && existsSync(of)) {
    const B = Object.fromEntries(JSON.parse(readFileSync(of, 'utf8')).rows.map((r) => [r.n, stat(r)]));
    console.log(`\n| Bölüm | Bitirme | Bitirenlerin nota medyanı | Önce: ★≥2 / ★3 (bitirenler) | Sonra: ★≥2 / ★3 (bitirenler) |\n|---|---|---|---|---|`);
    for (const r of rows) { const a = stat(r), b = B[r.n]; console.log(`| ${r.n} | ${pc(a.fin)} | ${pc(a.med)} | ${b ? `${pc(b.s2)} / ${pc(b.s3)}` : '–'} | ${pc(a.s2)} / ${pc(a.s3)} |`); }
  }
  console.log(`→ tools/harness/out/zorluk/${tag}.json`);
}

if (args.belge) {
  const load = (t) => { const f = resolve(outDir, `${t}.json`); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; };
  const after = load(args.sonra ?? 'sonra'); const before = load(args.once ?? 'once');
  if (!after) throw new Error('önce --bolumler çalıştırın');
  const { TARGET, ZONES, knobs } = await bundled("export { TARGET_CURVE as TARGET, CURVE_ZONES as ZONES, levelKnobs as knobs } from '@odi/level-gen';", 'egri');
  // standart hata: can kaybının oyuncular arası standart sapması / √n
  const seOf = (runs) => { const n = runs.length; const m = runs.reduce((a, r) => a + r.dmg, 0) / n; return Math.sqrt(runs.reduce((a, r) => a + (r.dmg - m) ** 2, 0) / Math.max(1, n - 1) / n); };
  const A = Object.fromEntries(after.rows.map((r) => [r.n, { ...scoreOf(r.runs), se: seOf(r.runs) }]));
  const B = before ? Object.fromEntries(before.rows.map((r) => [r.n, scoreOf(r.runs)])) : {};
  // ---- tablo
  const zoneOf = (n) => ZONES.find((z) => n >= z.from && n <= z.to);
  const pct = (x) => `${Math.round(x * 100)}%`; const f2 = (x) => x.toFixed(2); const f1 = (x) => x.toFixed(1);
  const lines = ['| Bölüm | Bölge | Rol | Hedef | Önce: bitirme | Önce: can kaybı | Önce: puan | Sonra: bitirme | Sonra: can kaybı ± SE | Sonra: yakın/dk | Sonra: puan ± SE |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (let n = 1; n <= 40; n++) {
    const z = zoneOf(n); const a = A[n]; const b = B[n];
    const role = n % 20 === 0 ? '**boss**' : n === z.from ? 'giriş (nefes)' : n === z.peak ? '**final**' : '';
    lines.push(`| ${n} | ${z.name} | ${role} | ${f1(TARGET[n - 1])} | ${b ? pct(b.fin) : '–'} | ${b ? f2(b.dmg) : '–'} | ${b ? f1(b.score) : '–'} | ${a ? pct(a.fin) : '–'} | ${a ? `${f2(a.dmg)} ± ${f2(a.se)}` : '–'} | ${a ? f1(a.nmPerMin) : '–'} | ${a ? `${f1(a.score)} ± ${f1(3 * a.se)}` : '–'} |`);
  }
  const doc = resolve(root, 'docs/12-zorluk-egrisi.md');
  const md = readFileSync(doc, 'utf8');
  const meta = `_Ölçüm: ${after.k} oyuncu (tohum) × 40 bölüm (bölüm tuzu 0 — oyuncunun gördüğü bölüm), varsayılan profil; önce: ${before ? `${before.k} tohum, eski eğri` : '–'}._`;
  writeFileSync(doc, md.replace(/<!-- tablo:basla -->[\s\S]*<!-- tablo:bitir -->/, `<!-- tablo:basla -->\n${meta}\n\n${lines.join('\n')}\n<!-- tablo:bitir -->`));
  // ---- ilk kez oynayan kademe (1-8): eski oyun / yeni oyun (--bolumler --ilk --tag ilk; eski: ilk-once)
  const ilk = load(args.ilk ?? 'ilk'); const ilk0 = load(args.ilkOnce ?? 'ilk-once');
  if (ilk) {
    const I = Object.fromEntries(ilk.rows.map((r) => [r.n, { ...scoreOf(r.runs), se: seOf(r.runs) }]));
    const I0 = ilk0 ? Object.fromEntries(ilk0.rows.map((r) => [r.n, { ...scoreOf(r.runs), se: seOf(r.runs) }])) : {};
    const goal = (n) => (n <= 3 ? '100%, ≤ 0,1 can' : n <= 6 ? '≥ %90' : n === 7 ? '≥ %80' : n === 8 ? '≥ %70' : n <= 12 ? '≥ %65' : '–');
    const il = [`_İlk kez oynayan kademe (§2), ${ilk.k} oyuncu × bölüm; önce: aynı kademe eski oyunda (${ilk0 ? ilk0.k : '–'} oyuncu)._`, '', '| Bölüm | Hedef | Önce: bitirme | Önce: can kaybı | Sonra: bitirme | Sonra: can kaybı ± SE |', '|---|---|---|---|---|---|'];
    for (const n of Object.keys(I).map(Number).sort((a, b) => a - b)) { const a = I[n], b = I0[n]; il.push(`| ${n} | ${goal(n)} | ${b ? pct(b.fin) : '–'} | ${b ? f2(b.dmg) : '–'} | ${pct(a.fin)} | ${f2(a.dmg)} ± ${f2(a.se)} |`); }
    const md1 = readFileSync(doc, 'utf8');
    writeFileSync(doc, md1.replace(/<!-- ilk:basla -->[\s\S]*<!-- ilk:bitir -->/, `<!-- ilk:basla -->\n${il.join('\n')}\n<!-- ilk:bitir -->`));
  }
  // ---- düğme tablosu (varsayılan profil)
  const kl = ['| Bölüm | λ hedef | Oda | Oda puanı hedefi / tavan | Aile ≤ | Sıkılık | Diken × | Çukur × | Basamak × | Ufalanma (sn) | Zar penceresi (sn) | Düşman / platform temposu | Değiştirici |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (let n = 1; n <= 40; n++) {
    const k = knobs(n); const boss = n % 20 === 0;
    kl.push(boss ? `| ${n} | ${f2(k.lambda)} | boss | can ${k.timing.bossHp}, uyarı ×${k.timing.bossWarn}, tempo ×${k.timing.bossTempo ?? 1} | – | – | – | – | – | – | – | – | – |`
      : `| ${n} | ${f2(k.lambda)} | ${k.rooms} | ${f1(k.roomTarget)} / ${f1(k.roomMax)} | ${k.maxFamilies} | ${f2(k.tight)} | ${k.geom.spike} | ${k.geom.gap} | ${k.geom.landing} | ${k.timing.crumble} | ${k.timing.tramp} | ${k.timing.enemy} / ${k.timing.moving} | ${k.modifiers.join(', ') || '–'} |`);
  }
  const md2 = readFileSync(doc, 'utf8');
  writeFileSync(doc, md2.replace(/<!-- dugmeler:basla -->[\s\S]*<!-- dugmeler:bitir -->/, `<!-- dugmeler:basla -->\n${kl.join('\n')}\n<!-- dugmeler:bitir -->`));
  // ---- grafik (SVG, açık zemin; tek eksen: puan 0-10)
  const W = 960, H = 440, L = 56, R = 20, T = 56, Bm = 74; const pw = W - L - R, ph = H - T - Bm;
  const allV = [...Object.values(A), ...Object.values(B)].map((q) => q.score).concat(TARGET);
  const YMAX = Math.min(10, Math.max(6, Math.ceil(Math.max(...allV))));
  const x = (n) => L + ((n - 0.5) / 40) * pw; const y = (v) => T + ph - (Math.min(YMAX, v) / YMAX) * ph;
  const path = (vals) => vals.map((v, i) => (v == null ? null : `${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).map((p, i) => (i ? 'L' : 'M') + p).join(' ');
  const ink = '#0b0b0b', ink2 = '#52514e', muted = '#8a8984', grid = '#e6e5e0', surface = '#fcfcfb', blue = '#2a78d6', orange = '#eb6834';
  const sv = [];
  sv.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">`);
  sv.push(`<rect width="${W}" height="${H}" fill="${surface}"/>`);
  sv.push(`<text x="${L}" y="24" font-size="17" font-weight="600" fill="${ink}">Zorluk eğrisi: insan benzeri oyuncu modeliyle ölçülen bölüm puanı</text>`);
  sv.push(`<text x="${L}" y="43" font-size="12" fill="${ink2}">puan = 3 × ortalama can kaybı (bitiremeyen 3) + yakın kaçış yoğunluğu (en çok 1) · ${after.k} tohum/bölüm</text>`);
  ZONES.forEach((z, i) => {
    const x0 = L + ((z.from - 1) / 40) * pw, x1 = L + (z.to / 40) * pw;
    if (i % 2 === 0) sv.push(`<rect x="${x0.toFixed(1)}" y="${T}" width="${(x1 - x0).toFixed(1)}" height="${ph}" fill="#f1f0ec"/>`);
    sv.push(`<text x="${((x0 + x1) / 2).toFixed(1)}" y="${H - Bm + 34}" font-size="10.5" fill="${ink2}" text-anchor="middle">${z.short}</text>`);
  });
  for (let v = 0; v <= YMAX; v += 1) { sv.push(`<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${grid}" stroke-width="1"/>`); sv.push(`<text x="${L - 8}" y="${y(v) + 4}" font-size="11" fill="${muted}" text-anchor="end">${v}</text>`); }
  for (let n = 1; n <= 40; n++) if (n === 1 || n % 5 === 0) sv.push(`<text x="${x(n)}" y="${H - Bm + 16}" font-size="11" fill="${muted}" text-anchor="middle">${n}</text>`);
  sv.push(`<text x="${W - R}" y="${H - 10}" font-size="11" fill="${ink2}" text-anchor="end">bölüm</text>`);
  sv.push(`<path d="${path(TARGET)}" fill="none" stroke="${muted}" stroke-width="2" stroke-dasharray="5 4"/>`);
  if (before) sv.push(`<path d="${path(Array.from({ length: 40 }, (_, i) => B[i + 1]?.score ?? null))}" fill="none" stroke="${orange}" stroke-width="2" stroke-opacity="0.85"/>`);
  const av = Array.from({ length: 40 }, (_, i) => A[i + 1]?.score ?? null);
  sv.push(`<path d="${path(av)}" fill="none" stroke="${blue}" stroke-width="2.5"/>`);
  av.forEach((v, i) => { if (v == null) return; const n = i + 1; const z = zoneOf(n); const big = n === z.peak || n % 20 === 0; sv.push(`<circle cx="${x(n).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${big ? 5 : 3}" fill="${blue}" stroke="${surface}" stroke-width="2"><title>Bölüm ${n}: puan ${v.toFixed(1)}, bitirme ${pct(A[n].fin)}, can kaybı ${f2(A[n].dmg)}</title></circle>`); });
  for (const n of [20, 40]) if (A[n]) sv.push(`<text x="${x(n) - 6}" y="${y(A[n].score) - 10}" font-size="11" font-weight="600" fill="${ink}" text-anchor="end">boss ${A[n].score.toFixed(1)}</text>`);
  // açıklama (lejant)
  const lg = [[blue, 'sonra (yeni eğri)', ''], ...(before ? [[orange, 'önce (doğrusal)', '']] : []), [muted, 'hedef', '5 4']];
  lg.forEach(([c, t, dash], i) => { const lx = W - R - 470 + i * 160; sv.push(`<line x1="${lx}" x2="${lx + 26}" y1="${T - 2}" y2="${T - 2}" stroke="${c}" stroke-width="2.5"${dash ? ` stroke-dasharray="${dash}"` : ''}/><text x="${lx + 32}" y="${T + 2}" font-size="12" fill="${ink2}">${t}</text>`); });
  sv.push('</svg>');
  mkdirSync(resolve(root, 'docs/img'), { recursive: true });
  writeFileSync(resolve(root, 'docs/img/zorluk-egrisi.svg'), sv.join('\n') + '\n');
  console.log('→ docs/12-zorluk-egrisi.md tablo, docs/img/zorluk-egrisi.svg');
}
