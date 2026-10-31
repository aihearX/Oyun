// Oyuncu testi (tools/harness/oyuncu.mjs) ortak parçaları: yollar, kişiler, durum dosyası, yuva (slot) kilidi, daemon istemcisi.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { resolve, relative } from 'node:path';

export const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
export const OUT = resolve(ROOT, 'tools/harness/out/oyuncular');
export const DIST = resolve(OUT, 'dist');
export const DURUM = resolve(OUT, 'durum.json');
export const SUNUCU_DIR = resolve(OUT, 'sunucu');
export const DB = resolve(OUT, 'sunucu.sqlite');
mkdirSync(OUT, { recursive: true });

/** sabit portlar: localStorage kökene (port dahil) bağlı olduğundan önizleme portu hiç değişmemeli (yoksa kişiler ilerlemesini kaybeder).
 *  İşletim sisteminin geçici port aralığının (32768+) altında: diğer harness'lerin rastgele portlarıyla çakışmaz. */
export const PORTLAR = { onizleme: Number(process.env.ODI_OYUNCU_ONIZLEME_PORT ?? 4791), sunucu: Number(process.env.ODI_OYUNCU_SUNUCU_PORT ?? 4792) };
/** aynı anda en çok bu kadar bölüm (ve derleme) koşar (4 çekirdek; bölüm başına ~1 çekirdek tarayıcı + yazılım GL) */
export const SLOT_SAYISI = Number(process.env.ODI_OYUNCU_SLOT ?? 3);
/** boşta bu kadar kalan daemon kendini kapatır */
export const BOSTA_MS = Number(process.env.ODI_OYUNCU_BOSTA_DK ?? 20) * 60_000;
/** bölüm botunun hız çarpanı (oyun-hiz; 1–4). Sonucu değiştirmez (el modeli oyun saatiyle çalışır), yalnız duvar süresini kısaltır. */
export const HIZ = Math.min(4, Math.max(1, Number(process.env.ODI_OYUNCU_HIZ ?? 2)));
export const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const rel = (p) => relative(ROOT, p);

/** kişi dosyası; ODI_OYUNCU_KISILER başka bir dosya verir (yalnız harness'in kendi duman testi için) */
export function kisiler() { return JSON.parse(readFileSync(process.env.ODI_OYUNCU_KISILER ? resolve(process.env.ODI_OYUNCU_KISILER) : resolve(ROOT, 'tools/harness/oyuncu/kisiler.json'), 'utf8')).kisiler; }
export function kisi(id) {
  const k = kisiler().find((x) => x.id === id);
  if (!k) throw new Error(`Bilinmeyen kişi: ${id}. Kişiler: ${kisiler().map((x) => x.id).join(', ')}`);
  return k;
}
export const kisiDir = (id) => resolve(OUT, id);
export const soket = (id) => resolve(kisiDir(id), 'd.sock');

export function durumOku() { try { return JSON.parse(readFileSync(DURUM, 'utf8')); } catch { return {}; } }
export function durumYaz(d) { const t = `${DURUM}.${process.pid}`; writeFileSync(t, JSON.stringify(d, null, 2)); renameSync(t, DURUM); }

export function gitHead() { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); }
export function pidYasiyor(pid) { if (!pid) return false; try { process.kill(pid, 0); return true; } catch { return false; } }
export async function httpOk(url, ms = 3000) { try { return (await fetch(url, { signal: AbortSignal.timeout(ms) })).ok; } catch { return false; } }

/**
 * Yuva kilidi: `flock` ile SLOT_SAYISI dosyadan birini tutar. Tutan süreç (`flock … sh -c 'echo OK; read _'`) bizim stdin borumuzu
 * okur: biz ölürsek (SIGKILL dahil) boru kapanır, kabuk çıkar, kilit kendiliğinden bırakılır — yetim kilit kalmaz.
 * Dönüş: { yuva, beklemeMs, birak() }.
 */
export async function yuvaAl(kim, { sureMs = 45 * 60_000, bekliyor } = {}) {
  const t0 = Date.now(); let haber = false;
  for (;;) {
    for (let i = 0; i < SLOT_SAYISI; i++) {
      const h = await flockDene(resolve(OUT, `yuva-${i}.lock`));
      if (h) {
        try { writeFileSync(resolve(OUT, `yuva-${i}.kim`), JSON.stringify({ kim, pid: process.pid, at: new Date().toISOString() })); } catch { /* yok */ }
        return { yuva: i, beklemeMs: Date.now() - t0, birak: () => { try { rmSync(resolve(OUT, `yuva-${i}.kim`), { force: true }); } catch { /* yok */ } h(); } };
      }
    }
    if (!haber) { haber = true; bekliyor?.(); }
    if (Date.now() - t0 > sureMs) throw new Error(`boş yuva bekleme süresi doldu (${Math.round(sureMs / 60000)} dk)`);
    await sleep(1500 + Math.random() * 1500);
  }
}
function flockDene(file) {
  return new Promise((res) => {
    const p = spawn('flock', ['-n', '-E', '75', file, 'sh', '-c', 'echo OK; read _'], { stdio: ['pipe', 'pipe', 'ignore'] });
    let bitti = false;
    p.stdout.on('data', (d) => {
      if (bitti || !String(d).includes('OK')) return; bitti = true;
      res(() => { try { p.stdin.end(); } catch { /* yok */ } try { p.kill(); } catch { /* yok */ } });
    });
    p.on('exit', () => { if (!bitti) { bitti = true; res(null); } });
    p.on('error', () => { if (!bitti) { bitti = true; res(null); } });
  });
}
/** yuvaları kimin tuttuğu (bilgi için) */
export function yuvalar() {
  const out = [];
  for (let i = 0; i < SLOT_SAYISI; i++) { try { const k = JSON.parse(readFileSync(resolve(OUT, `yuva-${i}.kim`), 'utf8')); if (pidYasiyor(k.pid)) out.push({ yuva: i, ...k }); } catch { /* boş */ } }
  return out;
}

/** daemon'a komut gönder (unix soketi üzerinden HTTP). Dönüş: { kod, cikti } */
export function daemonCagir(id, body, { zamanAsimi = 0 } = {}) {
  return new Promise((res, rej) => {
    const data = JSON.stringify(body);
    const req = request({ socketPath: soket(id), path: '/komut', method: 'POST', agent: false, headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) }, timeout: zamanAsimi || undefined }, (r) => {
      let s = ''; r.setEncoding('utf8'); r.on('data', (d) => { s += d; }); r.on('end', () => { try { res(JSON.parse(s)); } catch { rej(new Error('daemon yanıtı okunamadı: ' + s.slice(0, 200))); } });
    });
    req.on('error', rej);
    req.on('timeout', () => req.destroy(new Error('zaman aşımı')));
    req.end(data);
  });
}
/** daemon kapanana kadar bekle (pid dosyası) */
export async function daemonKapat(id, ms = 30_000) {
  let pid = 0; try { pid = Number(readFileSync(resolve(kisiDir(id), 'daemon.pid'), 'utf8')); } catch { /* yok */ }
  try { await daemonCagir(id, { komut: 'kapat' }, { zamanAsimi: 10_000 }); } catch { /* zaten kapalı */ }
  const son = Date.now() + ms; while (pid && pidYasiyor(pid) && Date.now() < son) await sleep(200);
  if (pid && pidYasiyor(pid)) { try { process.kill(pid, 'SIGKILL'); } catch { /* yok */ } }
  rmSync(soket(id), { force: true });
}
export async function daemonVar(id) { if (!existsSync(soket(id))) return false; try { const r = await daemonCagir(id, { komut: 'ping' }, { zamanAsimi: 4000 }); return r.kod === 0; } catch { return false; } }

/** dosya kilidi (sırayla bekler): baslat/durdur aynı anda iki kez koşmasın. Dönüş: birak() */
export function kilitBekle(file) {
  return new Promise((res, rej) => {
    const p = spawn('flock', [file, 'sh', '-c', 'echo OK; read _'], { stdio: ['pipe', 'pipe', 'ignore'] });
    let bitti = false;
    p.stdout.on('data', (d) => { if (bitti || !String(d).includes('OK')) return; bitti = true; res(() => { try { p.stdin.end(); } catch { /* yok */ } try { p.kill(); } catch { /* yok */ } }); });
    p.on('exit', (c) => { if (!bitti) { bitti = true; rej(new Error('flock çıktı: ' + c)); } });
  });
}
