#!/usr/bin/env node
// ODİ oyuncu testi: LLM oyuncu ajanları (10 kişi, tools/harness/oyuncu/kisiler.json) oyunu adım adım oynar.
// Her çağrı bir komut; kişinin durumu (tarayıcı profili, ilerleme, hesap) çağrılar ve günler arasında kalır.
// Ayrıntı ve geri bildirim biçimi: docs/yonetim/oyuncu-testi/README.md
//
//   node tools/harness/oyuncu.mjs baslat [--zorla]        test derlemesi + ortak yerel sunucu + önizleme (yinelenebilir)
//   node tools/harness/oyuncu.mjs durdur                  bütün kişi oturumlarını, sunucuyu ve önizlemeyi kapat
//   node tools/harness/oyuncu.mjs kisiler                 kişi listesi
//   node tools/harness/oyuncu.mjs yuvalar                 bölüm yuvalarını (en çok 3 bölüm aynı anda) kim tutuyor
//   node tools/harness/oyuncu.mjs <komut> --kisi <id> […]
//     ekran                      ekran görüntüsü + görünen metin + numaralı dokunulabilir öğeler
//     dokun <n | "metin" | @x,y> dokun, sonra yeni ekran
//     yaz "metin" [--enter]      odaktaki (yoksa ilk görünen) yazı alanına yaz
//     kaydir asagi|yukari        sayfayı (ya da haritayı) kaydır
//     surukle x1,y1 x2,y2        sürükle (harita, kamp)
//     geri                       görünür Geri/Kapat düğmesi, yoksa Escape
//     bekle <sn>                 bekle (en çok 300), sonra ekran
//     yenile                     sayfayı yenile (uygulamayı kapatıp aç)
//     ag kapat|ac                bağlantıyı kes / geri getir
//     bolum [--zaman 600]        açık bölümü kişinin becerisiyle oynat (yuva kilidiyle), 3 ara kare + sonuç
//     durum                      ilerleme JSON (geçilen bölüm, yıldız, jeton, seviye, seri, açık yerler, oyunBitti)
//     sifirla [--evet]           hesabı sil (sunucu, account.delete) + profili sil → yeni tur (oyun bitmediyse --evet gerekir)
//     kapat                      bu kişinin oturumunu kapat (ilerleme kalır)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, rmdirSync, statSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, daemonCagir, daemonKapat, daemonVar, kisi, kisiDir, kisiler, sleep, soket, yuvalar } from './oyuncu/ortak.mjs';
import { baslat, durdur, hazirla } from './oyuncu/altyapi.mjs';

const argv = process.argv.slice(2);
const secenek = {}; const konum = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--kisi') secenek.kisi = argv[++i];
  else if (a === '--zaman') secenek.zaman = argv[++i];
  else if (a.startsWith('--')) secenek[a.slice(2)] = true;
  else konum.push(a);
}
const komut = konum.shift();
const arg = konum.join(' ');
const yaz = (s) => process.stdout.write(s.endsWith('\n') ? s : s + '\n');

async function daemonAc(id) {
  if (await daemonVar(id)) return;
  const dir = kisiDir(id); mkdirSync(dir, { recursive: true });
  const kilit = resolve(dir, 'baslatiliyor');
  let ben = false;
  for (let i = 0; i < 2 && !ben; i++) {
    try { mkdirSync(kilit); ben = true; } catch { try { if (Date.now() - statSync(kilit).mtimeMs > 120_000) rmdirSync(kilit); else break; } catch { /* yarış */ } }
  }
  try {
    if (ben) {
      rmSync(soket(id), { force: true });
      const fd = openSync(resolve(dir, 'daemon.log'), 'a');
      // nice: tarayıcılar (alt süreçler) de düşük öncelikte
      const p = spawn('nice', ['-n', '10', process.execPath, '--disable-warning=ExperimentalWarning', resolve(ROOT, 'tools/harness/oyuncu/daemon.mjs'), id], { cwd: ROOT, detached: true, stdio: ['ignore', fd, fd], env: process.env });
      p.unref();
    }
    for (let i = 0; i < 240; i++) { if (await daemonVar(id)) return; await sleep(500); }
    throw new Error(`${id} oturumu açılamadı (günlük: tools/harness/out/oyuncular/${id}/daemon.log)`);
  } finally { if (ben) { try { rmdirSync(kilit); } catch { /* yok */ } } }
}

async function main() {
  if (!komut || komut === 'yardim' || komut === 'help' || secenek.help) {
    const { readFileSync } = await import('node:fs');
    yaz(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
    return 0;
  }
  if (komut === 'baslat') { yaz((await baslat({ zorla: !!secenek.zorla })).join('\n')); return 0; }
  if (komut === 'durdur') { yaz((await durdur()).join('\n')); return 0; }
  if (komut === 'kisiler') { for (const k of kisiler()) yaz(`${k.id.padEnd(16)} ${k.ad.padEnd(13)} ${k.cihaz.tarayici.padEnd(8)} ${k.cihaz.genislik}×${k.cihaz.yukseklik} beceri ${k.beceri}${existsSync(soket(k.id)) ? ' · oturum açık' : ''}`); return 0; }
  if (komut === 'yuvalar') { const y = yuvalar(); yaz(y.length ? y.map((x) => `yuva ${x.yuva}: ${x.kim} (pid ${x.pid}, ${x.at})`).join('\n') : 'bütün yuvalar boş'); return 0; }
  if (!secenek.kisi) { yaz('--kisi <id> gerekli (kişiler: node tools/harness/oyuncu.mjs kisiler)'); return 2; }
  kisi(secenek.kisi); // bilinmeyen kişide hata
  if (komut === 'kapat') { await daemonKapat(secenek.kisi); yaz('kapatıldı (ilerleme kayıtlı)'); return 0; }
  const on = await hazirla(); if (on.length) yaz(on.join('\n'));
  let r;
  for (let i = 0; ; i++) {
    await daemonAc(secenek.kisi);
    try { r = await daemonCagir(secenek.kisi, { komut, arg, secenek }); } catch (e) { if (i < 2 && /hang up|ECONNREFUSED|ENOENT|ECONNRESET/.test(String(e.message))) { await sleep(1500); continue; } throw e; }
    if (r.kod === 3 && i < 3) { await sleep(1500); continue; }
    break;
  }
  yaz(r.cikti);
  return r.kod;
}
main().then((k) => process.exit(k ?? 0), (e) => { yaz(`HATA: ${e.message ?? e}`); process.exit(1); });

