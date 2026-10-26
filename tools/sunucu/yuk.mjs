#!/usr/bin/env node
// ODİ yük denetimi (docs/yonetim/sunucu-dogrulama.md D10, D11). Sanal oyuncular protokolü doğrudan konuşur (tarayıcı yok):
// bağlan → kimlik (hello) → takım (kur / katıl) → döngü: takım sohbetinde hazır söz, kamp işlemleri, ping (wallet.get).
// p50/p95 yanıt süresi, hata, kopma; geçici örnekte sunucu sürecinin işlemci ve belleği.
//
// Kullanım (varsayılan: sunucunun KENDİSİNDE, geçici ikinci örneğe karşı; üretim örneğine ve veritabanına dokunulmaz):
//   node tools/sunucu/yuk.mjs --yerel-ornek --oyuncu 50 --sure 600                 # D10
//   node tools/sunucu/yuk.mjs --sunucu wss://<adres> --oyuncu 5 --sure 60           # Caddy üzerinden kısa koşu (en çok 5)
//   node tools/sunucu/yuk.mjs --sunucu wss://<adres> --bosta 600                    # D11: tek istemci 10 dk boşta
// Seçenekler:
//   --yerel-ornek            geçici örnek açar: ayrı port (8787 değil), ODI_DB geçici klasörde, NODE_ENV=production, test bayrağı yok;
//                            IP başına yeni hesap sınırı yalnız bu örnekte ortam değişkeniyle yükseltilir. Bitince örnek kapanır, klasör silinir.
//   --sunucu-dosya <yol>     örnek için server.mjs (varsayılan /opt/odi/guncel/sunucu/server.mjs, yoksa apps/server/dist/server.mjs)
//   --db-kopya <dosya>       geçici örnek boş veritabanı yerine bu dosyanın KOPYASIYLA açılır (ör. son yedek; özgün dosya açılmaz)
//   --sunucu <ws(s)://…>     var olan sunucu (geçici örnek yoksa). Üretime karşı en çok 5 sanal oyuncu; hesaplar sonunda account.delete
//   --oyuncu N (50) --sure SN (600) --aralik MS (2000, oyuncu başına işlem aralığı ortalaması) --takim N (10, takım başına oyuncu)
//   --bosta SN               D11: yük yerine tek istemci SN saniye boşta kalır; kopma / yeniden bağlanma raporlanır
//   --pid N                  yerel bir sürecin işlemci/belleğini de ölç (ör. üretim örneği: $(systemctl show -p MainPID --value odi))
//   --json <dosya>           raporu JSON olarak da yaz
// Çıkış kodu: 0 geçti, 1 ölçüt dışı / hata, 2 kullanım hatası.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, copyFileSync, readFileSync, rmSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argumanlar, baglan, bekle, PROTOCOL_VERSION, saglik, yuzdelik } from './istemci.mjs';

const A = argumanlar();
const kok = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const yerelOrnek = !!A['yerel-ornek'];
const oyuncu = Number(A.oyuncu ?? 50);
const sure = Number(A.sure ?? 600);
const aralik = Number(A.aralik ?? 2000);
const takimBoyu = Math.max(1, Math.min(30, Number(A.takim ?? 10)));
const bosta = A.bosta ? Number(A.bosta) : 0;
const URETIM_EN_COK = 5;

function kullanim(m) { console.error(`yuk.mjs: ${m}\nYardım: dosyanın başındaki açıklama (tools/sunucu/yuk.mjs).`); process.exit(2); }
if (!yerelOrnek && !A.sunucu) kullanim('--yerel-ornek ya da --sunucu <ws(s)://…> gerekli.');
if (yerelOrnek && A.sunucu) kullanim('--yerel-ornek ile --sunucu birlikte verilmez (örnek kendi adresini açar).');
if (!bosta && (!(oyuncu >= 1) || !(sure >= 5))) kullanim('--oyuncu ≥ 1 ve --sure ≥ 5 olmalı.');
if (!yerelOrnek && !bosta && oyuncu > URETIM_EN_COK) kullanim(`çalışan sunucuya en çok ${URETIM_EN_COK} sanal oyuncu (IP başına yeni hesap sınırı, üretim verisi). ${oyuncu} oyuncu için --yerel-ornek kullanın.`);
if (A.sunucu && !/^wss?:\/\//.test(A.sunucu)) kullanim('--sunucu ws:// ya da wss:// ile başlamalı.');

const kosu = Math.random().toString(36).slice(2, 6);
const ts = () => new Date().toISOString().slice(11, 19);
const log = (...m) => console.log(ts(), ...m);

// ---------------------------------------------------------------- temizlik (düşse de: finally + sinyaller)
const temizlikler = [];
let temizlendi = false;
async function temizle() {
  if (temizlendi) return; temizlendi = true;
  for (const f of temizlikler.reverse()) { try { await f(); } catch (e) { console.error('temizlik:', e.message ?? e); } }
}
let durdur = false;
let sinyalSayisi = 0;
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => {
  sinyalSayisi++;
  if (sinyalSayisi === 1) { log(`${s}: durduruluyor, temizlik yapılıyor…`); durdur = true; setTimeout(() => { void temizle().finally(() => process.exit(130)); }, 15_000).unref(); }
  else { log('ikinci sinyal: hemen temizlik'); void temizle().finally(() => process.exit(130)); }
});

// ---------------------------------------------------------------- geçici örnek
async function bosPort() {
  for (;;) {
    const p = await new Promise((res, rej) => { const s = createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });
    if (p !== 8787) return p;
  }
}
async function ornekAc() {
  const dosya = A['sunucu-dosya'] ? resolve(A['sunucu-dosya'])
    : existsSync('/opt/odi/guncel/sunucu/server.mjs') ? '/opt/odi/guncel/sunucu/server.mjs'
    : resolve(kok, 'apps/server/dist/server.mjs');
  if (!existsSync(dosya)) kullanim(`sunucu dosyası yok: ${dosya} (geliştirmede: npm run build:server)`);
  const klasor = mkdtempSync(join(os.tmpdir(), 'odi-yuk-'));
  temizlikler.push(() => rmSync(klasor, { recursive: true, force: true }));
  const db = join(klasor, 'yuk.sqlite');
  if (A['db-kopya']) { copyFileSync(resolve(A['db-kopya']), db); log(`veritabanı kopyası: ${A['db-kopya']} → geçici klasör`); }
  const port = await bosPort();
  const env = {
    PATH: process.env.PATH ?? '/usr/bin:/bin', NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), ODI_DB: db, ODI_LOG: '0',
    ODI_TRUST_PROXY: '0', ODI_TEST_STORE: '0',
    // yalnız bu geçici örnekte: tek IP'den oyuncu sayısı kadar yeni hesap açılabilsin (üretim örneğinin ayarı değişmez)
    ODI_NEW_PER_IP_HOUR: String(oyuncu * 2 + 20),
  };
  const cikti = join(klasor, 'cikti.log');
  const fd = openSync(cikti, 'a');
  const sp = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', dosya], { env, stdio: ['ignore', fd, fd] });
  closeSync(fd);
  let bitti = false;
  sp.on('exit', () => { bitti = true; });
  temizlikler.push(async () => {
    if (bitti) return;
    sp.kill('SIGTERM');
    for (let i = 0; i < 50 && !bitti; i++) await bekle(100);
    if (!bitti) sp.kill('SIGKILL');
  });
  const url = `ws://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    if (bitti) break;
    try { if ((await saglik(url, 1000)).ok) { log(`geçici örnek hazır: ${url} (pid ${sp.pid}, ${dosya})`); return { url, pid: sp.pid, cikti }; } } catch { /* henüz değil */ }
    await bekle(200);
  }
  console.error(readFileSync(cikti, 'utf8').split('\n').slice(-20).join('\n'));
  throw new Error('geçici örnek açılmadı');
}

// ---------------------------------------------------------------- süreç ölçümü (/proc; Linux)
const CLK_TCK = 100;
function procOrnek(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const f = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    const cpu = (Number(f[11]) + Number(f[12])) / CLK_TCK; // utime + stime (sn)
    const rss = Number(/VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, 'utf8'))?.[1] ?? 0) / 1024; // MB
    return { t: performance.now() / 1000, cpu, rss };
  } catch { return null; }
}
function olcer(pid) {
  const ornekler = []; let son = procOrnek(pid);
  const z = setInterval(() => {
    const o = procOrnek(pid); if (!o || !son) return;
    ornekler.push({ t: o.t, cpuPct: (100 * (o.cpu - son.cpu)) / Math.max(0.001, o.t - son.t), rss: o.rss });
    son = o;
  }, 5000);
  return {
    durdur: () => clearInterval(z),
    ozet() {
      if (!ornekler.length) return null;
      const cpu = ornekler.map((o) => o.cpuPct); const rss = ornekler.map((o) => o.rss);
      const q = Math.max(1, Math.floor(ornekler.length / 4));
      const ort = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      // ısınma (ilk çeyrek) sonrası ikinci çeyrek ile son çeyreğin ortalaması karşılaştırılır
      const rssErken = ort(rss.slice(q, 2 * q).length ? rss.slice(q, 2 * q) : rss.slice(0, q));
      const rssGec = ort(rss.slice(-q));
      return { ornek: ornekler.length, cpuOrt: ort(cpu), cpuEnCok: Math.max(...cpu), rssIlk: rss[0], rssSon: rss.at(-1), rssEnCok: Math.max(...rss), rssErken, rssGec, rssArtisPct: (100 * (rssGec - rssErken)) / rssErken };
    },
  };
}

// ---------------------------------------------------------------- sanal oyuncu
const BINALAR = ['laboratuvar', 'atolye', 'depo', 'kule', 'revir'];
const SOZLER = ['selam', 'nasilsin', 'birlikte', 'hedef', 'tesekkur', 'tebrik'];
/** işlem başına beklenen (oyun kuralı) retler: hata sayılmaz, ayrıca sayılır */
const BEKLENEN = { 'camp.upgrade': new Set(['YETERSIZ', 'MESGUL', 'SART', 'MAKS', 'LIMIT', 'SURE', 'DOLU']), 'chat.send': new Set(['HIZ']) };

const olc = { sureler: new Map(), hatalar: new Map(), beklenenRet: 0, kopma: 0, yenidenBaglanma: 0, olay: 0, istek: 0 };
function kaydet(op, r) {
  olc.istek++;
  if (!olc.sureler.has(op)) olc.sureler.set(op, []);
  olc.sureler.get(op).push(r.ms);
  if (r.ok) return;
  if (BEKLENEN[op]?.has(r.code)) { olc.beklenenRet++; return; }
  const k = `${op} ${r.code}`; olc.hatalar.set(k, (olc.hatalar.get(k) ?? 0) + 1);
}
async function cagir(o, op, data) { const r = await o.ist.call(op, data); kaydet(op, r); return r; }

const oyuncular = [];
async function oyuncuAc(url, ad) {
  const ist = await baglan(url);
  const r = await ist.call('hello', { version: PROTOCOL_VERSION, name: ad });
  kaydet('hello', r);
  if (!r.ok) { ist.kapat(); throw new Error(`hello: ${r.code} ${r.error}`); }
  const o = { ad, ist, token: r.data.me.token, id: r.data.me.id, takim: null, sonSohbet: 0, kopuk: false, silindi: false };
  oyuncular.push(o);
  izle(o, url);
  return o;
}
function izle(o, url) {
  o.ist.on('chat', () => { olc.olay++; });
  o.ist.on('kicked', () => { o.atildi = true; });
  void o.ist.kapanis.then(async ({ bizden, code }) => {
    if (bizden || durdur || o.silindi) return;
    olc.kopma++; o.kopuk = true;
    log(`kopma: ${o.ad} (kod ${code})`);
    // gerçek istemci gibi: kısa bekleme, aynı anahtarla yeniden bağlan
    for (let i = 0; i < 10 && !durdur; i++) {
      await bekle(Math.min(15_000, 500 * 2 ** i));
      try {
        const ist = await baglan(url);
        const r = await ist.call('hello', { version: PROTOCOL_VERSION, token: o.token });
        if (r.ok) { o.ist = ist; o.kopuk = false; olc.yenidenBaglanma++; log(`yeniden bağlandı: ${o.ad}`); izle(o, url); return; }
        ist.kapat();
      } catch { /* yeniden dene */ }
    }
  });
}

async function oyuncuDongusu(o, bitis) {
  await bekle(Math.random() * aralik);
  while (!durdur && performance.now() < bitis) {
    if (!o.kopuk) {
      const z = Math.random();
      if (z < 0.25 && o.takim && Date.now() - o.sonSohbet > 1500) {
        o.sonSohbet = Date.now();
        await cagir(o, 'chat.send', { room: `takim:${o.takim}`, text: SOZLER[Math.floor(Math.random() * SOZLER.length)], kind: 'hazir' });
      } else if (z < 0.40) await cagir(o, 'camp.state', {});
      else if (z < 0.50) await cagir(o, 'camp.collect', {});
      else if (z < 0.55) await cagir(o, 'camp.upgrade', { id: BINALAR[Math.floor(Math.random() * BINALAR.length)] });
      else if (z < 0.65 && o.takim) await cagir(o, 'team.detail', {});
      else await cagir(o, 'wallet.get', {}); // ping: en hafif istek
    }
    await bekle(aralik * (0.5 + Math.random()));
  }
}

async function hesaplariSil() {
  const silinecek = oyuncular.filter((o) => !o.silindi);
  if (!silinecek.length) return;
  let n = 0;
  await Promise.all(silinecek.map(async (o) => {
    try {
      let ist = o.ist;
      if (!ist.acik || o.atildi) { ist = await baglan(o.ist.url); const h = await ist.call('hello', { version: PROTOCOL_VERSION, token: o.token }); if (!h.ok) throw new Error(`hello ${h.code}`); }
      o.silindi = true;
      const r = await ist.call('account.delete', {});
      if (!r.ok) { o.silindi = false; throw new Error(`${r.code} ${r.error}`); }
      n++; ist.kapat();
    } catch (e) { console.error(`  ✗ ${o.ad} silinemedi: ${e.message}`); }
  }));
  log(`test hesapları silindi: ${n}/${silinecek.length} (account.delete)`);
  if (n !== silinecek.length) olc.hatalar.set('account.delete', silinecek.length - n);
}

// ---------------------------------------------------------------- rapor
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '–');
function sureOzeti() {
  const satir = [];
  const hepsi = [];
  for (const [op, a] of [...olc.sureler].sort((x, y) => y[1].length - x[1].length)) {
    const s = [...a].sort((x, y) => x - y); hepsi.push(...s);
    satir.push({ op, n: s.length, p50: yuzdelik(s, 50), p95: yuzdelik(s, 95), enCok: s.at(-1) });
  }
  hepsi.sort((x, y) => x - y);
  return { satir, n: hepsi.length, p50: yuzdelik(hepsi, 50), p95: yuzdelik(hepsi, 95), p99: yuzdelik(hepsi, 99), enCok: hepsi.at(-1) };
}

// ---------------------------------------------------------------- ana akış
let cikis = 0;
const rapor = { arac: 'yuk.mjs', tarih: new Date().toISOString(), node: process.version, makine: `${os.cpus().length} çekirdek, ${Math.round(os.totalmem() / 2 ** 30)} GB` };
try {
  let url = A.sunucu; let pid = A.pid ? Number(A.pid) : null;
  if (yerelOrnek) { const o = await ornekAc(); url = o.url; pid = o.pid; rapor.ornek = 'geçici (ayrı port, geçici veritabanı, NODE_ENV=production)'; }
  rapor.hedef = yerelOrnek ? 'geçici örnek' : url;
  if (!yerelOrnek) temizlikler.push(hesaplariSil); // çalışan sunucuda iz bırakma: her hesap silinir
  const once = await saglik(url).catch(() => null);
  if (once) log(`sağlık: sürüm ${once.version}, oyuncu ${once.players}, çevrimiçi ${once.online}`);
  const olcum = pid ? olcer(pid) : null;
  const ben0 = process.cpuUsage(); const t0 = performance.now();

  if (bosta) {
    // ---- D11: tek istemci boşta
    rapor.tur = 'bosta'; rapor.bostaSn = bosta;
    const o = await oyuncuAc(url, `test_bosta_${kosu}`);
    log(`D11: tek istemci ${bosta} sn boşta (yalnız sunucunun WebSocket ping'leri; uygulama mesajı yok)…`);
    const bitis = performance.now() + bosta * 1000;
    let sonDurum = performance.now();
    while (!durdur && performance.now() < bitis) {
      await bekle(1000);
      if (performance.now() - sonDurum >= 60_000) { sonDurum = performance.now(); log(`  ${Math.round((performance.now() - t0) / 1000)} sn: ${o.kopuk ? 'KOPUK' : 'bağlı'}, kopma ${olc.kopma}, yeniden bağlanma ${olc.yenidenBaglanma}`); }
    }
    for (let i = 0; i < 30 && o.kopuk && !durdur; i++) await bekle(1000);
    const r = await cagir(o, 'wallet.get', {});
    rapor.d11 = { kopma: olc.kopma, yenidenBaglanma: olc.yenidenBaglanma, sonIstek: r.ok ? `yanıt ${f1(r.ms)} ms` : `${r.code}` };
    log(`D11 sonuç: kopma ${olc.kopma}, yeniden bağlanma ${olc.yenidenBaglanma}, boşluk sonrası istek: ${rapor.d11.sonIstek}`);
    const gecti = r.ok && olc.yenidenBaglanma >= olc.kopma;
    log(`D11 ${gecti ? 'GEÇTİ' : 'KALDI'}: ${olc.kopma === 0 ? 'kopmadı' : `${olc.kopma} kopma, ${olc.yenidenBaglanma} kendiliğinden yeniden bağlanma`}`);
    if (!gecti) cikis = 1;
  } else {
    // ---- D10: sanal oyuncular
    rapor.tur = 'yuk'; rapor.oyuncu = oyuncu; rapor.sureSn = sure; rapor.aralikMs = aralik;
    log(`${oyuncu} sanal oyuncu bağlanıyor (takım başına ${takimBoyu})…`);
    for (let i = 0; i < oyuncu && !durdur; i++) {
      try { await oyuncuAc(url, `yuk_${kosu}_${String(i).padStart(3, '0')}`); } catch (e) { const k = `bağlantı/hello ${e.message}`; olc.hatalar.set(k, (olc.hatalar.get(k) ?? 0) + 1); }
      await bekle(50);
    }
    log(`${oyuncular.length} oyuncu bağlı; takımlar kuruluyor…`);
    for (let k = 0; k * takimBoyu < oyuncular.length && !durdur; k++) {
      const grup = oyuncular.slice(k * takimBoyu, (k + 1) * takimBoyu);
      const r = await cagir(grup[0], 'team.create', { name: `yuk-${kosu}-${k}`, emblem: '🎧', open: true });
      if (!r.ok) continue;
      const teamId = r.data.team.id; grup[0].takim = teamId;
      for (const o of grup.slice(1)) { const j = await cagir(o, 'team.join', { teamId }); if (j.ok) o.takim = teamId; }
    }
    log(`yük başladı: ${sure} sn, oyuncu başına ~${aralik} ms'de bir işlem`);
    const bitis = performance.now() + sure * 1000;
    const durum = setInterval(() => { const s = sureOzeti(); log(`  ${Math.round((performance.now() - t0) / 1000)} sn: istek ${olc.istek}, p50 ${f1(s.p50)} ms, p95 ${f1(s.p95)} ms, hata ${[...olc.hatalar.values()].reduce((a, b) => a + b, 0)}, kopma ${olc.kopma}${olcum?.ozet() ? `, işlemci %${f1(olcum.ozet().cpuOrt)}, bellek ${f1(olcum.ozet().rssSon)} MB` : ''}`); }, 30_000);
    await Promise.all(oyuncular.map((o) => oyuncuDongusu(o, bitis)));
    clearInterval(durum);
  }

  olcum?.durdur();
  const gecen = (performance.now() - t0) / 1000;
  const ben = process.cpuUsage(ben0);
  const s = sureOzeti();
  const hataToplam = [...olc.hatalar.values()].reduce((a, b) => a + b, 0);
  rapor.sonuc = { sureSn: Math.round(gecen), istek: olc.istek, istekSn: olc.istek / gecen, p50: s.p50, p95: s.p95, p99: s.p99, enCok: s.enCok, hata: hataToplam, hatalar: Object.fromEntries(olc.hatalar), beklenenRet: olc.beklenenRet, kopma: olc.kopma, yenidenBaglanma: olc.yenidenBaglanma, sohbetOlayi: olc.olay, islemler: s.satir };
  rapor.yukUretici = { cpuPct: (100 * (ben.user + ben.system)) / 1e6 / gecen };
  const sur = olcum?.ozet() ?? null;
  rapor.surec = sur;

  console.log(`\n=== ODİ yük raporu (${rapor.tarih}) ===`);
  console.log(`hedef: ${rapor.hedef} · makine: ${rapor.makine} · Node ${process.version}`);
  if (!bosta) console.log(`sanal oyuncu: ${oyuncular.length}/${oyuncu} · süre ${Math.round(gecen)} sn · istek ${olc.istek} (${f1(olc.istek / gecen)}/sn) · sohbet olayı ${olc.olay}`);
  console.log(`yanıt süresi: p50 ${f1(s.p50)} ms · p95 ${f1(s.p95)} ms · p99 ${f1(s.p99)} ms · en çok ${f1(s.enCok)} ms`);
  console.log('işlem            adet     p50     p95   en çok');
  for (const r of s.satir) console.log(`${r.op.padEnd(14)} ${String(r.n).padStart(6)} ${f1(r.p50).padStart(7)} ${f1(r.p95).padStart(7)} ${f1(r.enCok).padStart(8)}`);
  console.log(`hata: ${hataToplam}${hataToplam ? ` (${[...olc.hatalar].map(([k, v]) => `${k}: ${v}`).join('; ')})` : ''} · beklenen ret (oyun kuralı): ${olc.beklenenRet} · kopma: ${olc.kopma} · yeniden bağlanma: ${olc.yenidenBaglanma}`);
  if (sur) console.log(`sunucu süreci (pid ${pid}): işlemci ort %${f1(sur.cpuOrt)} / en çok %${f1(sur.cpuEnCok)} (tek çekirdeğe göre; makinede ${os.cpus().length} çekirdek) · bellek ${f1(sur.rssIlk)} → ${f1(sur.rssSon)} MB (en çok ${f1(sur.rssEnCok)}; ısınma sonrası ${f1(sur.rssErken)} → son çeyrek ${f1(sur.rssGec)} MB, ${sur.rssArtisPct >= 0 ? '+' : ''}${f1(sur.rssArtisPct)}%)`);
  console.log(`yük üretici (bu süreç): işlemci %${f1(rapor.yukUretici.cpuPct)} (aynı makinedeyse sunucuyla paylaşılır)`);

  if (!bosta) {
    // D10 ölçütleri (docs/yonetim/sunucu-dogrulama.md): işlemci < %50, p95 < 200 ms, 0 kopma, bellek sabit
    const olcut = [
      ['p95 < 200 ms', s.p95 < 200],
      ['0 kopma', olc.kopma === 0],
      ['0 hata', hataToplam === 0],
    ];
    if (sur) olcut.push(['işlemci ort < %50', sur.cpuOrt < 50], ['bellek sabit (son çeyrek ≤ ısınma sonrası +%20)', sur.rssArtisPct <= 20]);
    else console.log('(işlemci/bellek ölçülmedi: --yerel-ornek ya da --pid ile ölçülür)');
    rapor.olcutler = Object.fromEntries(olcut);
    for (const [ad, ok] of olcut) console.log(`${ok ? '✓' : '✗'} ${ad}`);
    const gecti = olcut.every(([, ok]) => ok);
    console.log(gecti ? 'D10 ölçütleri: GEÇTİ' : 'D10 ölçütleri: KALDI');
    if (!gecti) cikis = 1;
  }
  if (A.json) writeFileSync(resolve(A.json), JSON.stringify(rapor, null, 2));
} catch (e) {
  console.error('yuk.mjs hata:', e.message ?? e);
  cikis = 1;
} finally {
  durdur = true;
  await temizle();
  if (!yerelOrnek && A.sunucu) {
    const son = await saglik(A.sunucu).catch(() => null);
    if (son) log(`sağlık (son): oyuncu ${son.players}, çevrimiçi ${son.online}`);
  }
}
process.exit(sinyalSayisi ? 130 : cikis);
