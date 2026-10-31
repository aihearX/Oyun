// Oyuncu testi altyapısı: test derlemesi (VITE_ODI_E2E=1), ortak yerel oyun sunucusu, statik önizleme. `baslat` ve `durdur`.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { DB, DIST, OUT, PORTLAR, ROOT, SUNUCU_DIR, daemonKapat, durumOku, durumYaz, gitHead, httpOk, kilitBekle, kisiler, pidYasiyor, sleep, soket, yuvaAl } from './ortak.mjs';

const ALIAS = Object.fromEntries(['shared', 'content', 'meta', 'level-gen', 'game-core', 'net', 'audio'].map((p) => [`@odi/${p}`, resolve(ROOT, 'packages', p, 'src')]));

function calistir(cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    const p = spawn('nice', ['-n', '10', cmd, ...args], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let log = ''; p.stdout.on('data', (d) => { log += d; }); p.stderr.on('data', (d) => { log += d; });
    p.on('exit', (c) => (c === 0 ? res(log) : rej(new Error(`${cmd} ${args.join(' ')} → ${c}\n${log.slice(-2000)}`))));
  });
}

/** sunucu ve önizleme ayrık (detached) süreçler: CLI çıkınca yaşamaya devam eder; pid'leri durum dosyasında */
function ayrikBaslat(cmd, args, { cwd = ROOT, env = process.env, log }) {
  const fd = openSync(log, 'a');
  const p = spawn(cmd, args, { cwd, env, detached: true, stdio: ['ignore', fd, fd] });
  p.unref(); return p.pid;
}
async function durdurPid(pid) {
  if (!pidYasiyor(pid)) return;
  try { process.kill(-pid, 'SIGTERM'); } catch { try { process.kill(pid, 'SIGTERM'); } catch { /* yok */ } }
  for (let i = 0; i < 40 && pidYasiyor(pid); i++) await sleep(150);
  if (pidYasiyor(pid)) { try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch { /* yok */ } } }
}
async function portBos(port) {
  const { createServer } = await import('node:net');
  return new Promise((res) => { const s = createServer(); s.once('error', () => res(false)); s.listen(port, '127.0.0.1', () => s.close(() => res(true))); });
}

/** durum özetinde kullanılan saf yardımcılar (oyunun kendi kaynağından; sürümle birlikte güncellenir) */
async function kitaplikDerle(outfile) {
  await build({
    stdin: { contents: [
      "export { levelFromXp, PROTOCOL_VERSION } from '@odi/shared';",
      "export { clearedCount, FEATURES } from './apps/web/src/ftue/features';",
      "export { HUMAN_JOURNEY } from '@odi/content';",
    ].join('\n'), resolveDir: ROOT, loader: 'ts' },
    bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile, alias: ALIAS, logLevel: 'error',
  });
}
async function sunucuDerle(outfile) {
  await build({
    entryPoints: [resolve(ROOT, 'apps/server/src/main.ts')], outfile, bundle: true, platform: 'node', target: 'node22', format: 'esm',
    external: ['bufferutil', 'utf-8-validate'], alias: ALIAS, logLevel: 'error',
    banner: { js: "import { createRequire as __odiCreateRequire } from 'node:module'; const require = __odiCreateRequire(import.meta.url);" },
  });
}

/**
 * baslat: HEAD derlenmemişse test derlemesini kur (yuva kilidiyle), sunucuyu (yeni sürümde yeniden: göçler çalışsın) ve önizlemeyi
 * aç. Yinelenebilir: her şey yerindeyse yalnız durumu yazar. Dönüş: ekrana yazılacak satırlar.
 */
export async function baslat({ zorla = false, sessiz = false } = {}) {
  const birak = await kilitBekle(resolve(OUT, 'baslat.lock'));
  const satir = [];
  try {
    const head = gitHead(); const st = durumOku();
    mkdirSync(SUNUCU_DIR, { recursive: true });
    const derlemeGerek = zorla || st.webCommit !== head || !existsSync(resolve(DIST, 'index.html')) || !existsSync(resolve(SUNUCU_DIR, 'server.mjs')) || !existsSync(resolve(OUT, 'kitaplik.mjs'));
    let yeniDerleme = false;
    if (derlemeGerek) {
      const y = await yuvaAl('derleme', { bekliyor: () => satir.push('derleme: boş yuva bekleniyor (bölümler koşuyor)…') });
      const t0 = Date.now();
      try {
        const yeni = resolve(OUT, 'dist.yeni'); rmSync(yeni, { recursive: true, force: true });
        await calistir(process.execPath, [resolve(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', yeni, '--emptyOutDir', '--logLevel', 'warn'], { cwd: resolve(ROOT, 'apps/web'), env: { ...process.env, VITE_ODI_E2E: '1' } });
        await sunucuDerle(resolve(SUNUCU_DIR, 'server.yeni.mjs'));
        await kitaplikDerle(resolve(OUT, 'kitaplik.yeni.mjs'));
        // önizleme eski klasörü sunuyor olabilir: kapat, değiştir (sirv dosya listesini açılışta okur), yeniden aç
        await durdurPid(st.onizlemePid);
        const eski = resolve(OUT, 'dist.eski'); rmSync(eski, { recursive: true, force: true });
        if (existsSync(DIST)) renameSync(DIST, eski);
        renameSync(yeni, DIST); rmSync(eski, { recursive: true, force: true });
        renameSync(resolve(OUT, 'kitaplik.yeni.mjs'), resolve(OUT, 'kitaplik.mjs'));
        st.onizlemePid = 0; st.webCommit = head; st.derlendi = new Date().toISOString(); yeniDerleme = true;
        satir.push(`derleme: ${head.slice(0, 8)} (${Math.round((Date.now() - t0) / 1000)} sn)`);
      } finally { y.birak(); }
    }
    // sunucu: yeni derlemede yeniden başlar (göçler açılışta çalışır; veritabanı aynı dosya, kalıcı)
    const sunucuUrl = `http://127.0.0.1:${PORTLAR.sunucu}/saglik`;
    if (yeniDerleme || !pidYasiyor(st.sunucuPid) || !(await httpOk(sunucuUrl))) {
      await durdurPid(st.sunucuPid);
      if (existsSync(resolve(SUNUCU_DIR, 'server.yeni.mjs'))) renameSync(resolve(SUNUCU_DIR, 'server.yeni.mjs'), resolve(SUNUCU_DIR, 'server.mjs'));
      if (!(await portBos(PORTLAR.sunucu))) throw new Error(`sunucu portu ${PORTLAR.sunucu} başka bir süreçte (ODI_OYUNCU_SUNUCU_PORT ile değiştir)`);
      // yönetici kodu: her açılışta rastgele, kimsenin bilmediği bir kodun özeti → Kod Gir'de yönetici yetkisi yok (depodaki varsayılan da kullanılmaz)
      const salt = randomBytes(16).toString('hex');
      const adminHash = `scrypt:${salt}:${scryptSync(randomBytes(24).toString('hex'), salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex')}`;
      st.sunucuPid = ayrikBaslat('nice', ['-n', '5', process.execPath, '--disable-warning=ExperimentalWarning', resolve(SUNUCU_DIR, 'server.mjs')], {
        log: resolve(OUT, 'sunucu.log'),
        env: { ...process.env, PORT: String(PORTLAR.sunucu), HOST: '127.0.0.1', ODI_DB: DB, ODI_TEST_STORE: '1', ODI_LOG: '0', ODI_ADMIN_CODE_HASH: adminHash, NODE_ENV: 'development' },
      });
      st.sunucuCommit = st.webCommit;
      let ok = false; for (let i = 0; i < 100 && !ok; i++) { await sleep(200); ok = await httpOk(sunucuUrl, 1000); }
      if (!ok) throw new Error(`oyun sunucusu açılmadı (günlük: tools/harness/out/oyuncular/sunucu.log)`);
      satir.push(`sunucu: ws://127.0.0.1:${PORTLAR.sunucu} (yeniden başladı; veritabanı ${DB.replace(ROOT + '/', '')})`);
    }
    const onizlemeUrl = `http://127.0.0.1:${PORTLAR.onizleme}/`;
    if (!pidYasiyor(st.onizlemePid) || !(await httpOk(onizlemeUrl))) {
      await durdurPid(st.onizlemePid);
      if (!(await portBos(PORTLAR.onizleme))) throw new Error(`önizleme portu ${PORTLAR.onizleme} başka bir süreçte (ODI_OYUNCU_ONIZLEME_PORT ile değiştir — kişilerin kayıtları porta bağlı!)`);
      st.onizlemePid = ayrikBaslat(process.execPath, [resolve(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(PORTLAR.onizleme), '--strictPort', '--outDir', DIST], { cwd: resolve(ROOT, 'apps/web'), log: resolve(OUT, 'onizleme.log') });
      let ok = false; for (let i = 0; i < 150 && !ok; i++) { await sleep(200); ok = await httpOk(onizlemeUrl, 1000); }
      if (!ok) throw new Error('önizleme açılmadı (günlük: tools/harness/out/oyuncular/onizleme.log)');
      satir.push(`önizleme: ${onizlemeUrl}`);
    }
    st.portlar = PORTLAR; st.commit = st.webCommit; durumYaz(st);
    const acik = kisiler().filter((k) => existsSync(soket(k.id))).map((k) => k.id);
    if (!sessiz || satir.length) {
      satir.unshift(`HAZIR · sürüm ${st.webCommit.slice(0, 8)}${head !== st.webCommit ? ` (HEAD ${head.slice(0, 8)})` : ''} · derlendi ${st.derlendi ?? '?'}`);
      if (yeniDerleme && acik.length) satir.push(`açık kişi oturumları (${acik.join(', ')}) bir sonraki komutta yeni sürümü yükler`);
    }
    return satir;
  } finally { birak(); }
}

/** durdur: bütün kişi daemon'ları, sunucu, önizleme */
export async function durdur() {
  const satir = [];
  // oturumlar düzgün kapanır (tarayıcı profili diske yazılsın), hepsi birlikte
  await Promise.all(kisiler().filter((k) => existsSync(soket(k.id)) || existsSync(resolve(OUT, k.id, 'daemon.pid'))).map(async (k) => { await daemonKapat(k.id); satir.push(`${k.id}: kapatıldı`); }));
  // yanıt vermeyen daemon kaldıysa pid dosyasından
  for (const d of existsSync(OUT) ? readdirSync(OUT) : []) {
    const pf = resolve(OUT, d, 'daemon.pid'); if (!existsSync(pf)) continue;
    try { const pid = Number(readFileSync(pf, 'utf8')); if (pidYasiyor(pid)) { await durdurPid(pid); satir.push(`${d}: daemon öldürüldü`); } } catch { /* yok */ }
    rmSync(pf, { force: true });
  }
  const st = durumOku();
  if (pidYasiyor(st.sunucuPid)) { await durdurPid(st.sunucuPid); satir.push('sunucu kapatıldı'); }
  if (pidYasiyor(st.onizlemePid)) { await durdurPid(st.onizlemePid); satir.push('önizleme kapatıldı'); }
  st.sunucuPid = 0; st.onizlemePid = 0; durumYaz(st);
  return satir.length ? satir : ['zaten kapalı'];
}

/** komutlardan önce: sunucu ve önizleme ayakta mı (değilse baslat'ı sessizce çalıştır) */
export async function hazirla() {
  const st = durumOku();
  const ok = existsSync(resolve(DIST, 'index.html')) && (await httpOk(`http://127.0.0.1:${PORTLAR.onizleme}/`)) && (await httpOk(`http://127.0.0.1:${PORTLAR.sunucu}/saglik`));
  if (ok && st.webCommit) return [];
  return baslat({ sessiz: true });
}

