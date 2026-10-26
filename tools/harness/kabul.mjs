#!/usr/bin/env node
// ODİ kabul takımı: bir turun bütün denetimlerini tek komutla, sırayla çalıştırır.
//   typecheck, lint, vitest, ses denetimi, mobil tsc/jest/expo-doctor, DOM paketi (bir kez), domcheck,
//   bot 1-40 + boşta oyuncu, bütün *-e2e.mjs (web + dom; kopma: sunucu oturum ortasında yeniden başlar), ui-mobile-check (web + dom).
// Her takım: `nice -n 5`, kendi zaman sınırı, süreç grubu olarak çalışır (sınır aşılınca hepsi kapanır).
// Düşen takım bir kez tek başına yeniden koşulur: ikinci koşu geçerse "tekrarda geçti (yük/zaman kaynaklı olabilir)",
// yine düşerse "gerçek". Her takımdan sonra o takımın yazdığı çıktı klasörleri (tools/harness/out/<x>, apps/mobile/tools/out)
// silinir (--sakla ile korunur) ve takımın bıraktığı vite preview / sunucu süreçleri kapatılır.
// Kullanım: node tools/harness/kabul.mjs [--yalniz a,b] [--atla a,b] [--sakla] [--liste]
// Çıktı: tools/harness/out/kabul/ozet.json, tools/harness/out/kabul/<takım>.log ve ekranda Türkçe özet tablo.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(new URL('../..', import.meta.url).pathname);
const outRoot = resolve(root, 'tools/harness/out');
const kabulDir = resolve(outRoot, 'kabul');
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const has = (k) => argv.includes(k);
const yalniz = opt('--yalniz')?.split(',').filter(Boolean);
const atla = new Set(opt('--atla')?.split(',').filter(Boolean) ?? []);
const sakla = has('--sakla');
const win = process.platform === 'win32';
process.env.PLAYWRIGHT_CHROMIUM ??= '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const node = (script, ...a) => [process.execPath, resolve(root, script), ...a];
const npx = (...a) => ['npx', ...a];
const H = 'tools/harness';
/** takımlar: ad, komut, çalışma klasörü, zaman sınırı (sn), DOM paketi gerekir mi */
const STEPS = [
  { ad: 'typecheck', cmd: npx('tsc', '-p', 'tsconfig.json', '--noEmit'), sure: 900 },
  { ad: 'lint', cmd: npx('eslint', 'packages', 'apps/web/src', 'apps/server/src', 'apps/server/test', 'tools/harness'), sure: 900 },
  { ad: 'vitest', cmd: npx('vitest', 'run'), sure: 2400 },
  { ad: 'ses', cmd: node('tools/voice/generate.mjs', '--check'), sure: 300 },
  { ad: 'mobil-tsc', cmd: npx('tsc', '--noEmit'), cwd: 'apps/mobile', sure: 600 },
  { ad: 'jest', cmd: npx('jest'), cwd: 'apps/mobile', sure: 600 },
  { ad: 'expo-doctor', cmd: npx('expo-doctor'), cwd: 'apps/mobile', sure: 300 },
  { ad: 'dom-paketi', cmd: ['bash', '-c', 'rm -rf dist && npx expo export --platform ios --output-dir dist'], cwd: 'apps/mobile', sure: 1200 },
  { ad: 'domcheck', cmd: node('apps/mobile/tools/domcheck.mjs', '--level', '1', '--ts', '2'), sure: 900, dom: true },
  // bot derlemesi boşta koşusunda yeniden kullanılır: çıktısı bir sonraki takımla birlikte silinir
  { ad: 'bot', cmd: node(`${H}/bot.mjs`, '--levels', '1-40', '--parallel', '2', '--tag', 'kabul-bot'), sure: 4800, sonraSil: true },
  { ad: 'bot-bos', cmd: node(`${H}/bot.mjs`, '--levels', '1-40', '--idle', '1', '--parallel', '2', '--tag', 'kabul-bot', '--no-build'), sure: 3600, beklenen: /0 tamamlandı/ },
  { ad: 'reset', cmd: node(`${H}/reset-e2e.mjs`, '--target', 'both'), sure: 1500, dom: true },
  { ad: 'onboarding', cmd: node(`${H}/onboarding-e2e.mjs`, '--target', 'both'), sure: 4800, dom: true },
  { ad: 'codes', cmd: node(`${H}/codes-e2e.mjs`, '--target', 'both'), sure: 1200, dom: true },
  { ad: 'team-apply', cmd: node(`${H}/team-apply-e2e.mjs`, '--target', 'both'), sure: 1500, dom: true },
  { ad: 'teamrace', cmd: node(`${H}/teamrace-e2e.mjs`, '--target', 'both'), sure: 1500, dom: true },
  { ad: 'comm', cmd: node(`${H}/comm-e2e.mjs`, '--target', 'both'), sure: 2400, dom: true },
  { ad: 'social', cmd: node(`${H}/social-e2e.mjs`), sure: 1200 },
  { ad: 'friends', cmd: node(`${H}/friends-e2e.mjs`), sure: 1200 },
  { ad: 'events', cmd: node(`${H}/events-e2e.mjs`), sure: 1500 },
  { ad: 'race', cmd: node(`${H}/race-e2e.mjs`), sure: 1200 },
  // MK-019: oturum ortasında sunucu yeniden başlatma (aynı veritabanı; Chromium + WebKit)
  { ad: 'kopma', cmd: node(`${H}/kopma-e2e.mjs`), sure: 2400 },
  { ad: 'camp', cmd: node(`${H}/camp-e2e.mjs`), sure: 2400, dom: true },
  { ad: 'vaka', cmd: node(`${H}/vaka-e2e.mjs`), sure: 1500, dom: true },
  { ad: 'ui-mobile', cmd: node(`${H}/ui-mobile-check.mjs`, '--target', 'both', '--tag', 'kabul'), sure: 4800, dom: true },
];

if (has('--liste')) { for (const s of STEPS) console.log(`${s.ad.padEnd(12)} ${s.cmd.slice(s.cmd[0] === process.execPath ? 1 : 0).join(' ').replace(root + '/', '')}`); process.exit(0); }
const bilinmeyen = [...(yalniz ?? []), ...atla].filter((a) => !STEPS.some((s) => s.ad === a));
if (bilinmeyen.length) { console.error(`Bilinmeyen takım: ${bilinmeyen.join(', ')} (liste: --liste)`); process.exit(2); }
let steps = STEPS.filter((s) => (!yalniz || yalniz.includes(s.ad)) && !atla.has(s.ad));
// DOM paketi gerektiren takım varsa ve paket yoksa (ya da tam koşuysa) paketi bir kez kur
const domGerekli = steps.some((s) => s.dom);
if (domGerekli && !steps.some((s) => s.ad === 'dom-paketi') && !existsSync(resolve(root, 'apps/mobile/dist/www.bundle'))) steps = [STEPS.find((s) => s.ad === 'dom-paketi'), ...steps];
mkdirSync(kabulDir, { recursive: true });

// ---------------------------------------------------------------- yardımcılar
const sh = (cmd, a) => { try { return execFileSync(cmd, a, { encoding: 'utf8' }); } catch { return ''; } };
/** bu depodan başlatılmış, artık kalabilen süreçler (vite preview, oyun sunucusu) */
function leftovers() {
  if (win) return [];
  return sh('ps', ['-eo', 'pid=,args=']).split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => ({ pid: Number(l.split(/\s+/)[0]), args: l.slice(l.indexOf(' ') + 1) }))
    .filter((p) => /vite(\.js)? preview|apps\/server\/dist\/server\.mjs/.test(p.args) && p.pid !== process.pid)
    // sunucu göreli yolla başlar: süreç bu depodan mı, çalışma klasörüne de bak
    // (yalnız bu kopya: /home/user/oyun, /home/user/oyun-x'i kapsamasın diye yol + '/')
    .filter((p) => { if (p.args.includes(root + '/')) return true; try { const c = realpathSync(`/proc/${p.pid}/cwd`); return c === root || c.startsWith(root + '/'); } catch { return false; } });
}
/** takım süresince yazılmış dosyası olan çıktı klasörleri */
function touched(dirs, since) {
  const hit = [];
  const walk = (p, depth) => {
    let st; try { st = statSync(p); } catch { return false; }
    if (st.mtimeMs >= since) return true;
    if (!st.isDirectory() || depth > 6) return false;
    try { for (const e of readdirSync(p)) if (walk(join(p, e), depth + 1)) return true; } catch { /* yok */ }
    return false;
  };
  for (const base of dirs) {
    if (!existsSync(base)) continue;
    for (const e of readdirSync(base)) { const p = join(base, e); if (p === kabulDir) continue; if (walk(p, 0)) hit.push(p); }
  }
  return hit;
}
function runStep(s, deneme) {
  return new Promise((done) => {
    const log = resolve(kabulDir, `${s.ad}${deneme > 1 ? `-${deneme}` : ''}.log`);
    const ws = createWriteStream(log);
    const t0 = Date.now();
    const before = new Set(leftovers().map((p) => p.pid));
    const [cmd, ...a] = win ? s.cmd : ['nice', '-n', '5', ...s.cmd];
    const p = spawn(cmd, a, { cwd: resolve(root, s.cwd ?? '.'), env: process.env, stdio: ['ignore', 'pipe', 'pipe'], detached: !win, shell: win });
    let tail = '';
    const take = (d) => { ws.write(d); tail = (tail + d).slice(-4000); };
    p.stdout.on('data', take); p.stderr.on('data', take);
    let zaman = false;
    const timer = setTimeout(() => { zaman = true; try { if (win) p.kill(); else process.kill(-p.pid, 'SIGKILL'); } catch { /* yok */ } }, s.sure * 1000);
    p.on('exit', (code) => {
      clearTimeout(timer); ws.end();
      // takımın bıraktığı vite preview / sunucu süreçleri
      for (const q of leftovers()) if (!before.has(q.pid)) { try { process.kill(q.pid, 'SIGKILL'); } catch { /* yok */ } }
      let ok = code === 0 && !zaman;
      if (ok && s.beklenen && !s.beklenen.test(tail)) ok = false;
      done({ ok, code, zaman, sn: Math.round((Date.now() - t0) / 1000), log: log.replace(root + '/', ''), son: tail.split('\n').filter((l) => /✗|FAIL|Error|hata|sorun|geçti|passed|tamamlandı/i.test(l)).slice(-3).join(' | ').slice(0, 300) });
    });
  });
}

// ---------------------------------------------------------------- koşu
const sonuc = [];
const basla = Date.now();
let bekleyen = Infinity; // silinmesi ertelenen takımın başlangıcı
for (const s of steps) {
  process.stdout.write(`▶ ${s.ad} … `);
  const t0 = Date.now();
  let r = await runStep(s, 1);
  let durum = r.ok ? 'geçti' : '';
  if (!r.ok) {
    process.stdout.write(`düştü (${r.zaman ? 'zaman sınırı' : `çıkış ${r.code}`}), tek başına yeniden… `);
    const r2 = await runStep(s, 2);
    durum = r2.ok ? 'tekrarda geçti (yük/zaman kaynaklı olabilir)' : 'gerçek hata (iki kez düştü)';
    r = { ...r2, ilk: { code: r.code, zaman: r.zaman, son: r.son } };
  }
  if (s.sonraSil) bekleyen = Math.min(bekleyen, t0);
  else if (!sakla) { for (const d of touched([outRoot, resolve(root, 'apps/mobile/tools/out')], Math.min(bekleyen, t0))) rmSync(d, { recursive: true, force: true }); bekleyen = Infinity; }
  sonuc.push({ takim: s.ad, durum, ...r });
  console.log(`${durum} · ${r.sn} sn`);
}
if (!sakla && bekleyen !== Infinity) for (const d of touched([outRoot, resolve(root, 'apps/mobile/tools/out')], bekleyen)) rmSync(d, { recursive: true, force: true });
const ozet = { tarih: new Date().toISOString(), sureSn: Math.round((Date.now() - basla) / 1000), saklandi: sakla, takimlar: sonuc };
writeFileSync(resolve(kabulDir, 'ozet.json'), JSON.stringify(ozet, null, 2));
const gercek = sonuc.filter((r) => r.durum.startsWith('gerçek'));
const tekrar = sonuc.filter((r) => r.durum.startsWith('tekrarda'));
console.log('\n— kabul özeti —');
console.log('| Takım | Sonuç | Süre | Son satırlar |\n|---|---|---|---|');
for (const r of sonuc) console.log(`| ${r.takim} | ${r.durum} | ${r.sn} sn | ${r.son || '-'} |`);
console.log(`\n${gercek.length ? `✗ ${gercek.length} gerçek hata` : '✓ gerçek hata yok'}${tekrar.length ? ` · ${tekrar.length} takım tekrarda geçti` : ''} · toplam ${Math.round(ozet.sureSn / 60)} dk · tools/harness/out/kabul/ozet.json`);
process.exit(gercek.length ? 1 : 0);
