#!/usr/bin/env node
// ODİ uzak duman denetimi (docs/yonetim/sunucu-dogrulama.md D5, D13, D14): ÇALIŞAN bir sunucuyu (üretim dahil) veri bırakmadan sınar.
// - Kendi sunucusunu açmaz, test bayrağı istemez: NODE_ENV=production, ODI_TEST_STORE=0, IP başına yeni hesap sınırı açıkken çalışır.
// - En çok 3 test hesabı açar (adları test_ ile başlar; oyuncu adında tire kullanılamaz). Veritabanına doğrudan dokunmaz.
// - Bitişte, düşse de (finally + SIGINT/SIGTERM/SIGHUP + yakalanmamış hata), her test hesabı account.delete ile silinir;
//   /saglik players sayısının başlangıçtaki değere döndüğü denetlenir.
//
// Akış: A (Chromium arayüzü), B (WebKit arayüzü), C (protokol istemcisi; tarayıcısız)
//   takım: A arayüzden kurar, B arayüzden davet koduyla katılır, C protokolle katılır
//   takım sohbetinde hazır söz: B gönderir → A ekranda görür; A gönderir → B görür; C ikisini de olay olarak alır
//   arkadaşlık: C → A ve C → B istek; A ve B arayüzden kabul eder; C friend.accepted alır
//   kamp görünümü: iki tarayıcıda Kamp sekmesi yüklenir; C camp.state
//   yarış daveti: C oda kurar, A'yı ve B'yi davet eder; davet kartı iki tarayıcıda görünür
//   D13: C ile 6 yanlış yönetici kodu (rastgele, biçimi geçerli); 1–5 "geçersiz", 6. "çok fazla deneme" (bekleme).
//        Sunucu geneli yönetici sınama bütçesinden (60 / 10 dk) en çok 5 harcanır; 6. deneme sınamaya hiç ulaşmaz.
//   D14: her hesap açılışı WebSocket el sıkışmasında sahte X-Forwarded-For ile yapılır. Sunucunun IP sınırı (--ip-siniri N)
//        3 ise dördüncü bir hesap açma denemesi (yine sahte başlıkla) HIZ almalıdır: sınır gerçek IP'ye uygulanıyor.
//        N > 3 ise bu bütçeyle kesin sonuç çıkmaz; araç bunu söyler (D14 için bkz. sunucu-dogrulama.md).
//   D6 (--kopma, MK-032): takım kurulduktan sonra A (Chromium) ve C (protokol) bağlıyken araç "Şimdi sunucuyu yeniden başlatın:
//        sudo systemctl restart odi" yazar ve en çok 5 dk bekler. Kopmayı kendisi algılar (C'nin bağlantısı düşer ya da /saglik
//        yanıt vermez), sonra ölçer: A'da "Bağlantı koptu" şeridi; sunucu döndükten (/saglik yeniden yanıt verdi) sonra A'nın
//        ≤ 15 sn'de kendiliğinden bağlanması; C'nin cüzdanı, kampı ve takımı kopmadan önce ve sonra protokolden okunur, eşit;
//        A'nın kopukken bastığı hazır söz bağlanınca bir kez gider (cid): sunucu geçmişinde, C'de ve A'nın ekranında tek.
//        --kopma'da arkadaşlık, kamp, yarış daveti, D13 ve D14 atlanır (onlar D5 koşusunda).
//
// Kullanım:
//   node tools/harness/uzak-duman.mjs --sunucu wss://<adres> --web https://<adres>       # üretim: aynı kökenden web
//   node tools/harness/uzak-duman.mjs --sunucu ws://127.0.0.1:8787                        # web derlemesi yerelde önizlenir
// Seçenekler:
//   --web <url>            açılacak web sayfası (yoksa apps/web yerelde derlenip önizlenir ve ?sunucu= ile hedefe bağlanır)
//   --tarayici <liste>     chromium,webkit (varsayılan) | chromium | webkit | yok (yalnız protokol)
//   --ip-siniri N          sunucunun ODI_NEW_PER_IP_HOUR değeri (varsayılan 20, kur.sh). 3 → D14 kesin sınanır
//   --vekil-taklit [ip]    araç tek bir vekil gibi davranır: X-Forwarded-For'a sahte girdinin sağına gerçek IP'yi (varsayılan 127.0.0.1)
//                          ekler. Yalnız önünde vekil olmayan, ODI_TRUST_PROXY=1 ile açılmış yerel sunucuyu sınarken.
//   --kopma                D6: yeniden başlatmayı PY sunucuda yapar (araç ne zaman yapılacağını yazar)
//   --kopma-kendim <komut> yalnız yerel deneme: yeniden başlatmayı araç bu kabuk komutuyla kendisi yapar (üretimde kullanılmaz)
//   --no-build             yerel web derlemesi varsa yeniden derleme  · --headed  tarayıcıyı göster
// Çıktı: tools/harness/out/uzak-duman/ (hata anında ekran görüntüleri). Çıkış kodu: 0 geçti, 1 hata, 2 kullanım hatası.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { argumanlar, baglan, bekle, PROTOCOL_VERSION, saglik } from '../sunucu/istemci.mjs';

const A = argumanlar();
const kok = resolve(new URL('../..', import.meta.url).pathname);
const outDir = resolve(kok, 'tools/harness/out/uzak-duman');
function kullanim(m) { console.error(`uzak-duman.mjs: ${m}\nYardım: dosyanın başındaki açıklama.`); process.exit(2); }
if (!A.sunucu || !/^wss?:\/\//.test(A.sunucu)) kullanim('--sunucu ws://… ya da wss://… gerekli.');
const sunucu = A.sunucu.replace(/\/+$/, '');
const tarayicilar = (A.tarayici ?? 'chromium,webkit').split(',').map((x) => x.trim()).filter((x) => x && x !== 'yok');
for (const t of tarayicilar) if (!['chromium', 'webkit'].includes(t)) kullanim(`bilinmeyen tarayıcı: ${t}`);
const ipSiniri = Number(A['ip-siniri'] ?? 20);
if (!(ipSiniri >= 3)) kullanim('--ip-siniri en az 3 olmalı (araç 3 hesap açar).');
const vekilTaklit = A['vekil-taklit'] ? (A['vekil-taklit'] === '1' ? '127.0.0.1' : A['vekil-taklit']) : null;
const EN_COK_HESAP = 3;
const kopmaKendim = A['kopma-kendim'] && A['kopma-kendim'] !== '1' ? A['kopma-kendim'] : null;
if (A['kopma-kendim'] === '1') kullanim('--kopma-kendim bir komut ister (ör. --kopma-kendim "./yeniden-baslat.sh").');
const kopma = !!A.kopma || !!kopmaKendim;
if (kopma && tarayicilar[0] !== 'chromium') kullanim('--kopma A için Chromium arayüzü ister: --tarayici chromium ya da chromium,webkit.');
/** D6: sunucu döndükten sonra istemcinin kendiliğinden bağlanması için üst sınır (MK-019) */
const KOPMA_BAGLANMA_MS = 15_000;
/** D6: PY'nin yeniden başlatmayı yapması için en uzun bekleme */
const KOPMA_BEKLEME_MS = 5 * 60_000;

mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (f.endsWith('.png')) rmSync(resolve(outDir, f));
const kosu = randomBytes(2).toString('hex');
let hata = 0; const uyarilar = [];
const adim = (m) => { if (!durduruldu || m.startsWith('Temizlik')) console.log(`\n▶ ${m}`); };
const ok = (m) => console.log(`  ✓ ${m}`);
const bozuk = (m) => { hata++; console.log(`  ✗ ${m}`); };
const uyar = (m) => { if (durduruldu) return; uyarilar.push(m); console.log(`  ⚠ ${m}`); };
const denetle = (k, m) => { if (k) ok(m); else bozuk(m); return !!k; };

// ---------------------------------------------------------------- sahte X-Forwarded-For (D14)
let sahteSira = 10;
/** her el sıkışmasında farklı sahte IP (TEST-NET-3 belgeleme bloğu); vekil taklidinde sağa gerçek IP eklenir */
function sahteBaslik() {
  const sahte = `203.0.113.${sahteSira++}`;
  return { 'X-Forwarded-For': vekilTaklit ? `${sahte}, ${vekilTaklit}` : sahte };
}

// ---------------------------------------------------------------- hesaplar ve temizlik
/** @type {{ rol: string, ad: string, id: string, token: string, ist?: any, silindi?: boolean }[]} */
const hesaplar = [];
const surecler = [];
let tarayiciNesneleri = [];
let temizlikSozu = null;
/** sinyal ya da yakalanmamış hata: akış yeni adım başlatmaz, yalnız temizlik sürer */
let durduruldu = false;
let basla = null;

/** sürmekte olan hesap açılışları: temizlik bunları bekler (yarıda kalan hello'dan doğan hesap da silinsin) */
const acilislar = new Set();
function hesapAc(rol) {
  const p = hesapAcIc(rol);
  acilislar.add(p); p.finally(() => acilislar.delete(p)).catch(() => undefined);
  return p;
}
async function hesapAcIc(rol) {
  if (durduruldu) throw new Error('durduruldu');
  if (hesaplar.length >= EN_COK_HESAP + 1) throw new Error('hesap bütçesi aşıldı');
  const ad = `test_${kosu}_${rol}`;
  const ist = await baglan(sunucu, { headers: sahteBaslik() });
  const r = await ist.call('hello', { version: PROTOCOL_VERSION, name: ad });
  if (!r.ok) { ist.kapat(); const e = new Error(`${rol} hesabı açılamadı: ${r.code} ${r.error}`); e.code = r.code; throw e; }
  const h = { rol, ad: r.data.me.name, id: r.data.me.id, token: r.data.me.token, ist };
  hesaplar.push(h);
  if (h.ad !== ad) uyar(`${rol}: sunucu adı değiştirdi (${h.ad})`);
  return h;
}

async function hesapSil(h) {
  if (h.silindi) return true;
  let ist = h.ist?.acik ? h.ist : null;
  for (let deneme = 0; deneme < 3 && !h.silindi; deneme++) {
    try {
      if (!ist) {
        ist = await baglan(sunucu);
        const r = await ist.call('hello', { version: PROTOCOL_VERSION, token: h.token });
        if (!r.ok) throw new Error(`hello ${r.code} ${r.error}`);
      }
      const d = await ist.call('account.delete', {});
      if (!d.ok) throw new Error(`${d.code} ${d.error}`);
      h.silindi = true;
    } catch (e) {
      console.log(`  … ${h.rol} silme denemesi ${deneme + 1}: ${e.message}`);
      try { ist?.kapat(); } catch { /* yok */ }
      ist = null; await bekle(1000);
    }
  }
  try { ist?.kapat(); } catch { /* yok */ }
  return !!h.silindi;
}

/** tek sefer çalışır; aynı anda çağıran (sinyal + akışın finally'si) aynı temizliği bekler */
function temizle(neden) { return (temizlikSozu ??= temizlikYap(neden)); }
async function temizlikYap(neden) {
  adim(`Temizlik${neden ? ` (${neden})` : ''}: test hesapları siliniyor`);
  for (const b of tarayiciNesneleri) { try { await b.close(); } catch { /* yok */ } }
  tarayiciNesneleri = [];
  await Promise.allSettled([...acilislar]);
  for (const h of hesaplar) {
    const s = await hesapSil(h);
    if (s) ok(`${h.rol} (${h.ad}) silindi (account.delete)`); else bozuk(`${h.rol} (${h.ad}) SİLİNEMEDİ: kimlik ${h.id}; sunucuda elle bakın`);
  }
  for (const p of surecler) { try { p.kill(); } catch { /* yok */ } }
  if (basla) {
    let son = null;
    for (let i = 0; i < 20; i++) {
      son = await saglik(sunucu).catch(() => null);
      if (son && son.players === basla.players) break;
      await bekle(500);
    }
    if (!son) bozuk('/saglik okunamadı (son)');
    else {
      denetle(son.players === basla.players, `/saglik players başlangıçtaki değere döndü: ${basla.players} → ${son.players}`);
      if (son.players !== basla.players) console.log('    (aynı anda gerçek bir oyuncu hesap açtıysa fark ondan olabilir; silme sonuçlarına bakın)');
      console.log(`    çevrimiçi: ${basla.online} → ${son.online}`);
    }
  }
}

let cikiyor = false;
async function acilCikis(neden, kod) {
  if (cikiyor) return; cikiyor = true; durduruldu = true;
  console.log(`\n${neden}`);
  hata++;
  const zaman = setTimeout(() => { console.error('temizlik 60 sn içinde bitmedi'); process.exit(kod); }, 60_000);
  try { await temizle(neden); } finally { clearTimeout(zaman); process.exit(kod); }
}
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => { void acilCikis(`${s} alındı`, 130); });
process.on('uncaughtException', (e) => { void acilCikis(`yakalanmamış hata: ${e?.stack ?? e}`, 1); });
process.on('unhandledRejection', (e) => { void acilCikis(`yakalanmamış söz: ${e?.stack ?? e}`, 1); });

// ---------------------------------------------------------------- web (tarayıcı) yardımcıları
const run = (cmd, a, o = {}) => new Promise((res, rej) => { const p = spawn(cmd, a, { cwd: kok, stdio: 'inherit', ...o }); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${a.join(' ')} → ${c}`)))); });
const bosPort = () => new Promise((res, rej) => { const s = createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });

async function webAdresi() {
  if (A.web) {
    const w = new URL(A.web);
    // aynı köken (varsayılan port): sayfa WebSocket'i kendisi bulur (apps/web/src/platform.ts); değilse ?sunucu= ile verilir
    const ayniKoken = !w.port && sunucu === `${w.protocol === 'https:' ? 'wss' : 'ws'}://${w.host}`;
    if (!ayniKoken) w.searchParams.set('sunucu', sunucu);
    return w.href;
  }
  const dist = resolve(outDir, 'dist');
  if (!A['no-build'] || !existsSync(resolve(dist, 'index.html'))) {
    console.log('web derleniyor (apps/web → tools/harness/out/uzak-duman/dist)…');
    await run(process.execPath, [resolve(kok, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'warn'], { cwd: resolve(kok, 'apps/web') });
  }
  const port = await bosPort();
  const pv = spawn(process.execPath, [resolve(kok, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1', '--outDir', dist], { cwd: resolve(kok, 'apps/web'), stdio: 'ignore' });
  surecler.push(pv);
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) break; } catch { /* henüz */ } await bekle(200); }
  return `http://127.0.0.1:${port}/?sunucu=${encodeURIComponent(sunucu)}`;
}

const HATA_DISI = /favicon|AudioContext|WebGL|GPU|Autoplay|WebSocket connection|Failed to load resource|manifest/i;
const tarayiciHatalari = [];
async function sayfaAc(tur, h, url) {
  const pw = await import('playwright');
  const tarayici = await (tur === 'webkit' ? pw.webkit : pw.chromium).launch({
    headless: !A.headed,
    // Playwright'ın kendi sinyal işleyicisi süreci hemen kapatır; temizlik (hesap silme) bitmeden çıkılmasın
    handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
    executablePath: tur === 'chromium' ? process.env.PLAYWRIGHT_CHROMIUM : undefined,
    args: tur === 'chromium' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] : [],
  });
  tarayiciNesneleri.push(tarayici);
  const ctx = await tarayici.newContext({ viewport: { width: 390, height: 780 }, isMobile: tur === 'chromium', hasTouch: true, locale: 'tr-TR' });
  // hesap yeni açılmaz: araç bu hesabı protokolle açtı, anahtarı sayfaya verilir. İlk açılış rehberi atlanır (başka bir akışı sınar).
  await ctx.addInitScript(([token]) => {
    try {
      if (!localStorage.getItem('odi.net.token')) localStorage.setItem('odi.net.token', token);
      if (!localStorage.getItem('odi-v1')) localStorage.setItem('odi-v1', JSON.stringify({ state: { ftue: { v: 1, story: true, tours: [], bypass: true } }, version: 3 }));
    } catch { /* depolama yok */ }
  }, [h.token]);
  // D6 (--kopma): bağlantı noktasının (yeşil/değil) ve "Bağlantı koptu" şeridinin göründüğü anlar, kısa görünenler de
  await ctx.addInitScript(() => {
    const o = { nokta: [], serit: [] }; window.__kopma = o; let on = null;
    const bak = () => {
      const n = !!document.querySelector('.net-dot.on'); if (n !== on) { on = n; o.nokta.push({ at: Date.now(), on: n }); }
      for (const b of document.querySelectorAll('.net-banner')) if (!b.__kayit && /Bağlantı koptu/.test(b.textContent ?? '')) { b.__kayit = 1; o.serit.push({ at: Date.now(), text: (b.textContent ?? '').trim() }); }
    };
    const start = () => new MutationObserver(bak).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);
  });
  const page = await ctx.newPage();
  const etiket = `${h.rol}/${tur}`;
  page.on('pageerror', (e) => tarayiciHatalari.push(`${etiket}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !HATA_DISI.test(m.text())) tarayiciHatalari.push(`${etiket}: ${m.text()}`); });
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  const yolaCik = page.getByRole('button', { name: /Yola çık|Devam/ }).first();
  await yolaCik.waitFor({ timeout: 30_000 }).catch(() => undefined);
  if (await yolaCik.count()) await yolaCik.click();
  await page.locator('nav.tabbar').waitFor({ timeout: 30_000 });
  return { page, tur, etiket };
}
/** alt sekmeye geç; tam ekran bir alt sayfadaysa (ör. Arkadaşlar) önce "Geri" ile çık */
async function sekme(s, ad) {
  for (let i = 0; i < 4 && !(await s.page.locator('nav.tabbar').isVisible().catch(() => false)); i++) {
    await s.page.locator('.screen-head button[aria-label="Geri"], .dm-head button[aria-label="Geri"]').first().click({ timeout: 3000 }).catch(() => undefined);
    await bekle(300);
  }
  await s.page.locator('nav.tabbar .tab', { hasText: ad }).click();
}
const bildirimKapat = async (s) => { for (let i = 0; i < 8 && await s.page.locator('.toast-top').count(); i++) { await s.page.locator('.toast-top').click({ timeout: 500 }).catch(() => undefined); await bekle(150); } };
async function goruntu(s, ad) { try { await s.page.screenshot({ path: resolve(outDir, `${ad}-${s.etiket.replace('/', '-')}.png`) }); } catch { /* yok */ } }
/** adımı çalıştır; düşerse hatayı say, iki sayfanın ekran görüntüsünü al, sonraki adımlara geç */
async function guvenli(ad, fn, sayfalar = []) {
  if (durduruldu) return false;
  try { await fn(); return true; } catch (e) {
    if (durduruldu) return false;
    bozuk(`${ad}: ${String(e.message ?? e).split('\n')[0]}`);
    for (const s of sayfalar) await goruntu(s, `hata-${ad.replace(/[^a-z0-9]+/gi, '-')}`);
    return false;
  }
}

// ---------------------------------------------------------------- D6: sunucu yeniden başlatma (--kopma, MK-032)
const KOPMA_SOZ = { id: 'nasilsin', metin: 'Nasıl gidiyor?' };
/** C'nin cüzdanı, kampı ve takımı (protokol; zamanla kendiliğinden değişmeyen alanlar) */
async function durumOku(ist) {
  const k = await ist.iste('camp.state', {}); const w = await ist.iste('wallet.get', {}); const t = await ist.iste('team.detail', {});
  return {
    cuzdan: { jeton: w.wallet.jeton, kristal: w.wallet.kristal },
    kamp: { binalar: k.camp.buildings.map((b) => `${b.id}:Sv${b.level}→${b.upgradingTo ?? '-'}@${b.endsAt ?? '-'}`).sort(), sira: k.camp.queued?.id ?? null },
    takim: t.team ? { id: t.team.id, ad: t.team.name, uyeler: t.team.roster.map((m) => `${m.id}:${m.role}`).sort() } : null,
  };
}
const sn = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)} sn`);
/** /saglik yanıt veriyor mu (kısa zaman aşımı) */
const saglikVar = () => saglik(sunucu, 1500).then(() => true, () => false);

/**
 * A (tarayıcı) ve C (protokol) bağlıyken sunucu yeniden başlar. Kopma kendiliğinden algılanır: C'nin bağlantısı düşer ya da
 * /saglik yanıt vermez. Dönüş: /saglik yeniden yanıt verdiği an. Ölçülenler dosyanın başında (D6).
 */
async function kopmaDenetimi({ ha, hc, sa, sb, takim }) {
  const room = `takim:${takim.id}`;
  // A takım sohbetinde (kopukken hazır söz buradan yazılır)
  await sekme(sa, 'Takım');
  const altSekme = sa.page.locator('.subtabs .subtab', { hasText: 'Sohbet' }).first();
  if (await altSekme.count()) await altSekme.click();
  const soz = sa.page.locator(`.quick-line .phrase[data-phrase="${KOPMA_SOZ.id}"]`);
  await soz.waitFor({ timeout: 15_000 });
  await bildirimKapat(sa);
  const once = await durumOku(hc.ist);
  ok(`önce (C, protokol): ${once.cuzdan.jeton} jeton, ${once.cuzdan.kristal} kristal; kamp ${once.kamp.binalar.length} bina; takım ${once.takim?.ad} (${once.takim?.uyeler.length} üye)`);
  const balon = (x) => x.page.locator('.msg.preset .bubble', { hasText: KOPMA_SOZ.metin });
  const onceBalon = await balon(sa).count();
  if (onceBalon) throw new Error(`"${KOPMA_SOZ.metin}" sohbette zaten var (${onceBalon}); ölçüm için yeni bir söz gerekir`);
  if (!(await sa.page.locator('.net-dot.on').count())) throw new Error(`A (${sa.etiket}) bağlı değil`);

  // yeniden başlatma: PY sunucuda yapar (ya da yerel denemede araç kendisi)
  let tDown = null; let neden = '';
  const cKapandi = hc.ist.kapanis.then(() => { if (tDown == null) { tDown = Date.now(); neden = 'C bağlantısı düştü'; } });
  void cKapandi;
  const tIstek = Date.now();
  if (kopmaKendim) {
    console.log(`\n  ⏵ Yerel deneme: yeniden başlatma komutu çalışıyor: ${kopmaKendim}`);
    // temizlikte öldürülmez (sunucuyu başlatan sarmalayıcı olabilir); komut kendisi biter
    const p = spawn('sh', ['-c', kopmaKendim], { cwd: kok, stdio: 'inherit' });
    p.on('exit', (kod) => { if (kod) uyar(`--kopma-kendim komutu ${kod} ile bitti`); });
  } else {
    console.log('\n  ⏵ Şimdi sunucuyu yeniden başlatın: sudo systemctl restart odi');
    console.log(`    (araç kopmayı kendisi algılar; en çok ${KOPMA_BEKLEME_MS / 60_000} dk bekler)`);
  }
  // kopmayı algıla: C düştü ya da /saglik yanıt vermiyor
  while (tDown == null && !durduruldu && Date.now() - tIstek < KOPMA_BEKLEME_MS) {
    if (!(await saglikVar()) && tDown == null) { tDown = Date.now(); neden = '/saglik yanıt vermedi'; break; }
    await bekle(250);
  }
  if (durduruldu) return;
  if (tDown == null) { bozuk(`${KOPMA_BEKLEME_MS / 60_000} dk içinde yeniden başlatma algılanmadı (C bağlı kaldı, /saglik hep yanıt verdi)`); return; }
  ok(`kopma algılandı (${neden}; isteğe göre ${sn(tDown - tIstek)} sonra)`);

  // A'da şerit; görünür görünmez (hâlâ kopukken) hazır söz
  const serit = sa.page.locator('.net-banner', { hasText: 'Bağlantı koptu' }).first();
  const seritVar = await serit.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true, () => false);
  let kopukYazildi = false;
  if (seritVar && !(await sa.page.locator('.net-dot.on').count())) {
    await soz.click({ timeout: 3000 }).then(() => { kopukYazildi = true; }, () => undefined);
  }
  const tSoz = Date.now();
  // sunucunun dönüşü: /saglik yeniden yanıt verir
  let tUp = null;
  while (!durduruldu && Date.now() - tDown < KOPMA_BEKLEME_MS) { if (await saglikVar()) { tUp = Date.now(); break; } await bekle(200); }
  if (durduruldu) return;
  if (tUp == null) { bozuk(`sunucu ${KOPMA_BEKLEME_MS / 60_000} dk içinde dönmedi (/saglik yanıt vermiyor)`); return; }
  ok(`sunucu döndü: /saglik ${sn(tUp - tDown)} yanıt vermedi`);
  if (!kopukYazildi) {
    // kopukluk çok kısaydı: söz bağlıyken gönderilir (yine bir kez görünmeli); kopukken yazma bu koşuda sınanamadı
    uyar('kopukluk A şeridi görünüp söz basılana kadar sürmedi; hazır söz bağlıyken gönderildi');
    await soz.click({ timeout: 5000 }).catch(() => undefined);
  }

  // A (ve B) kendiliğinden bağlanır: noktanın yeniden yeşil olduğu an
  for (const s of [sa, sb].filter(Boolean)) {
    const t = await s.page.waitForFunction((t0) => window.__kopma?.nokta.find((x) => x.on && x.at >= t0)?.at ?? null, tDown, { timeout: KOPMA_BAGLANMA_MS + 20_000, polling: 100 })
      .then((h) => h.jsonValue(), () => null);
    const kayit = await s.page.evaluate(() => window.__kopma).catch(() => null);
    const seridi = kayit?.serit.find((x) => x.at >= tDown - 2000);
    denetle(!!seridi || (s === sa && seritVar), `${s.etiket}: "Bağlantı koptu" şeridi göründü${seridi ? ` (kopmadan ${sn(seridi.at - tDown)} sonra)` : ''}`);
    denetle(t != null && t - tUp <= KOPMA_BAGLANMA_MS, `${s.etiket}: sunucu döndükten ${sn(t == null ? null : Math.max(0, t - tUp))} sonra kendiliğinden bağlandı (≤ ${KOPMA_BAGLANMA_MS / 1000} sn)`);
  }

  // C yeniden bağlanır (aynı anahtar) ve aynı veriyi okur
  let c2 = null;
  for (let i = 0; i < 20 && !c2 && !durduruldu; i++) {
    try { const x = await baglan(sunucu); const r = await x.call('hello', { version: PROTOCOL_VERSION, token: hc.token }); if (r.ok) c2 = x; else x.kapat(); } catch { /* henüz */ }
    if (!c2) await bekle(500);
  }
  if (!c2) { bozuk('C yeniden bağlanamadı'); return; }
  hc.ist = c2;
  const sonra = await durumOku(c2);
  const fark = [];
  for (const k of ['cuzdan', 'kamp', 'takim']) if (JSON.stringify(once[k]) !== JSON.stringify(sonra[k])) fark.push(`${k}: ${JSON.stringify(once[k])} → ${JSON.stringify(sonra[k])}`);
  denetle(!fark.length, `cüzdan, kamp ve takım kopmadan önce ve sonra aynı (C, protokol)${fark.length ? ` — ${fark.join('; ')}` : ''}`);

  // kopukken yazılan hazır söz bir kez (cid): sunucu geçmişinde, C'de, A'nın ve B'nin ekranında
  for (const s of [sa, sb].filter(Boolean)) await balon(s).first().waitFor({ timeout: 25_000 }).catch(() => undefined);
  await bekle(1500);
  const gecmis = await c2.iste('chat.join', { room });
  const sunucuda = gecmis.history.filter((m) => m.from === ha.id && m.kind === 'hazir' && (m.meta?.p === KOPMA_SOZ.id || m.text === KOPMA_SOZ.metin) && m.at >= tDown - 60_000);
  denetle(sunucuda.length === 1, `${kopukYazildi ? 'kopukken yazılan' : 'kopmadan sonra yazılan'} hazır söz ("${KOPMA_SOZ.metin}") sunucuda ${sunucuda.length} kez (1 olmalı; cid)`);
  for (const s of [sa, sb].filter(Boolean)) {
    const n = await balon(s).count();
    denetle(n === 1, `${s.etiket}: hazır söz ekranda ${n} kez (1 olmalı)`);
  }
  if (kopukYazildi) ok(`söz kopukken basıldı (kopmadan ${sn(tSoz - tDown)} sonra), bağlanınca gitti`);
}

// ---------------------------------------------------------------- akış
try {
  console.log(`ODİ uzak duman · ${new Date().toISOString()} · hedef ${sunucu}${A.web ? ` · web ${A.web}` : ''} · tarayıcı: ${tarayicilar.join('+') || 'yok'} · koşu ${kosu}`);

  adim('Başlangıç sağlığı');
  basla = await saglik(sunucu);
  ok(`/saglik: sürüm ${basla.version}, oyuncu ${basla.players}, çevrimiçi ${basla.online}`);

  adim(`Test hesapları (en çok ${EN_COK_HESAP}; el sıkışmada sahte X-Forwarded-For${vekilTaklit ? ` + vekil taklidi ${vekilTaklit}` : ''})`);
  let ha, hb, hc;
  try {
    ha = await hesapAc('A'); hb = await hesapAc('B'); hc = await hesapAc('C');
  } catch (e) {
    if (e.code === 'HIZ') bozuk(`${e.message}. Bu IP'den son bir saatte çok hesap açılmış (ODI_NEW_PER_IP_HOUR); bir saat sonra yeniden deneyin.`);
    throw e;
  }
  for (const h of [ha, hb, hc]) ok(`${h.rol}: ${h.ad}`);
  // A ve B'nin oturumunu tarayıcı açacak (aynı anahtarla ikinci bağlantı ilkini atar); C protokolde kalır
  if (tarayicilar.length) { ha.ist.kapat(); hb.ist.kapat(); }
  const c = hc.ist;
  const cOlaylari = []; c.on('chat', (d) => cOlaylari.push(d.msg));

  // A ve B: tarayıcı oturumları ya da protokol
  let sa = null; let sb = null;
  if (tarayicilar.length) {
    adim(`Tarayıcılar: A ${tarayicilar[0]}, B ${tarayicilar[1] ?? tarayicilar[0]}`);
    const url = await webAdresi();
    console.log(`  sayfa: ${url}`);
    sa = await sayfaAc(tarayicilar[0], ha, url);
    sb = await sayfaAc(tarayicilar[1] ?? tarayicilar[0], hb, url);
    for (const s of [sa, sb]) {
      await guvenli(`${s.etiket} bağlandı`, async () => { await s.page.locator('.net-dot.on').first().waitFor({ timeout: 20_000 }); ok(`${s.etiket}: bağlı (yeşil nokta)`); }, [s]);
    }
  }

  adim('Takım kur ve katıl');
  const takimAdi = `test-${kosu}`;
  let takim = null;
  await guvenli('takım', async () => {
    let kod;
    if (sa) {
      await sekme(sa, 'Takım');
      await sa.page.getByRole('button', { name: '＋ Takım kur' }).first().click({ timeout: 15_000 });
      await sa.page.locator('.sheet').getByPlaceholder('ör. Koklea Kaşifleri').fill(takimAdi);
      await sa.page.locator('.emoji-opt').first().click();
      await sa.page.locator('.sheet').getByRole('button', { name: /Takımı kur/ }).click();
      await sa.page.locator('.team-head').waitFor({ timeout: 15_000 });
      await bildirimKapat(sa);
      await sa.page.getByLabel('Takım menüsü').click();
      kod = (await sa.page.locator('.big-code').innerText()).trim();
      await sa.page.locator('.sheet-wrap').click({ position: { x: 10, y: 10 } });
      ok(`A (${sa.etiket}) arayüzden takım kurdu: ${takimAdi}, kod ${kod}`);
      await sekme(sb, 'Takım');
      await sb.page.getByLabel('Takım davet kodu').fill(kod);
      await sb.page.locator('.code-join').getByRole('button', { name: 'Katıl' }).click();
      await sb.page.locator('.team-head').waitFor({ timeout: 15_000 });
      await bildirimKapat(sb);
      ok(`B (${sb.etiket}) arayüzden kodla katıldı`);
    } else {
      const t = await ha.ist.iste('team.create', { name: takimAdi, emblem: '🎧', open: true });
      kod = t.team.code;
      await hb.ist.iste('team.join', { teamId: t.team.id });
      ok('A takım kurdu, B katıldı (protokol)');
    }
    const j = await c.iste('team.join', { code: kod });
    takim = j.team;
    ok(`C protokolle katıldı (team.join kod)`);
    const d = await c.iste('team.detail', {});
    const ids = new Set(d.team.roster.map((m) => m.id));
    denetle([ha, hb, hc].every((h) => ids.has(h.id)) && d.team.roster.length === 3, `takımda üç test hesabı (${d.team.name}, ${d.team.roster.length} üye)`);
  }, [sa, sb].filter(Boolean));

  adim('Takım sohbetinde hazır söz');
  if (takim) await guvenli('sohbet', async () => {
    const room = `takim:${takim.id}`;
    const gel = (from, p) => c.bekle('chat', (d) => d.msg.from === from && d.msg.kind === 'hazir' && d.msg.meta?.p === p, 10_000).catch(() => null);
    if (sa) {
      const cB = gel(hb.id, 'selam');
      const altSekme = sb.page.locator('.subtabs .subtab', { hasText: 'Sohbet' }).first();
      if (await altSekme.count()) await altSekme.click();
      await sb.page.locator('.quick-line .phrase[data-phrase="selam"]').click({ timeout: 15_000 });
      await sa.page.locator('.msg.preset .bubble', { hasText: 'Selam!' }).last().waitFor({ timeout: 10_000 });
      ok(`B (${sb.etiket}) arayüzden "Selam!" gönderdi → A (${sa.etiket}) ekranda gördü`);
      denetle(await cB, 'C olayı aldı (B → selam)');
      await bekle(1300); // sohbet aralığı
      const cA = gel(ha.id, 'tesekkur');
      const altSekmeA = sa.page.locator('.subtabs .subtab', { hasText: 'Sohbet' }).first();
      if (await altSekmeA.count()) await altSekmeA.click();
      await sa.page.locator('.quick-line .phrase[data-phrase="tesekkur"]').click({ timeout: 15_000 });
      await sb.page.locator('.msg.preset .bubble', { hasText: 'Teşekkürler!' }).last().waitFor({ timeout: 10_000 });
      ok(`A arayüzden "Teşekkürler!" gönderdi → B ekranda gördü`);
      denetle(await cA, 'C olayı aldı (A → tesekkur)');
    } else {
      const cB = gel(hb.id, 'selam');
      await hb.ist.iste('chat.send', { room, text: 'selam', kind: 'hazir' });
      denetle(await cB, 'B hazır söz gönderdi → C aldı');
    }
    // serbest yazı yeni hesapta kapalı (üretim kuralı; ODI_FREE_TEXT_AT varsayılan)
    const serbest = await c.call('chat.send', { room, text: 'deneme yazısı' });
    denetle(!serbest.ok, `yeni hesap serbest yazamaz (üretim kuralı): ${serbest.ok ? 'GÖNDERİLDİ' : serbest.code}`);
  }, [sa, sb].filter(Boolean));

  if (kopma) {
    adim('D6: sunucu yeniden başlatma (kopma)');
    if (!takim || !sa) bozuk('D6 yapılamadı: takım kurulamadı ya da A tarayıcısı yok');
    else await guvenli('D6', () => kopmaDenetimi({ ha, hc, sa, sb, takim }), [sa, sb].filter(Boolean));
  }

  // D5'in geri kalanı (--kopma'da atlanır)
  if (!kopma) {
    adim('Arkadaşlık isteği ve kabul');
    const arkadas = new Set();
    for (const [h, s] of [[ha, sa], [hb, sb]]) {
      await guvenli(`arkadaşlık ${h.rol}`, async () => {
        const kabul = c.bekle('friend.accepted', () => true, 20_000);
        const r = await c.iste('friends.request', { id: h.id });
        denetle(r.status === 'istek', `C → ${h.rol} istek gitti`);
        if (s) {
          await s.page.locator('[data-testid="mesaj-bildirimi"]', { hasText: 'arkadaşlık isteği' }).waitFor({ timeout: 10_000 });
          await s.page.locator('.fr-banner-card').first().click();
          const satir = s.page.locator('[data-testid="gelen-istek"]', { hasText: hc.ad });
          await satir.waitFor({ timeout: 10_000 });
          await satir.getByRole('button', { name: 'Kabul' }).click();
          ok(`${h.rol} (${s.etiket}) bildirimi gördü, arayüzden kabul etti`);
        } else {
          const g = await h.ist.iste('friends.requests', {});
          const req = g.incoming.find((x) => x.from.id === hc.id);
          await h.ist.iste('friends.respond', { requestId: req.id, accept: true });
        }
        await kabul;
        arkadas.add(h.id);
        ok(`C friend.accepted aldı (${h.rol})`);
      }, [s].filter(Boolean));
    }

    adim('Kamp görünümü');
    await guvenli('kamp (protokol)', async () => {
      const k = await c.iste('camp.state', {});
      denetle(Array.isArray(k.camp.buildings) && k.camp.buildings.length >= 7, `C camp.state: ${k.camp.buildings?.length} bina, ${k.wallet.jeton} jeton`);
    });
    for (const s of [sa, sb].filter(Boolean)) {
      await guvenli(`kamp ${s.etiket}`, async () => {
        await bildirimKapat(s);
        await sekme(s, 'Kamp');
        await s.page.locator('.camp-base').waitFor({ timeout: 30_000 });
        await s.page.locator('.camp-loading').waitFor({ state: 'detached', timeout: 30_000 });
        ok(`${s.etiket}: Kamp yüklendi`);
        await goruntu(s, 'kamp');
      }, [s]);
    }

    adim('Yarış daveti');
    await guvenli('yarış', async () => {
      const oda = await c.iste('race.create', { level: 1 });
      ok(`C yarış odası kurdu (${oda.room.id})`);
      try {
        for (const [h, s] of [[ha, sa], [hb, sb]]) {
          if (!arkadas.has(h.id)) { bozuk(`${h.rol} arkadaş değil; davet atlandı`); continue; }
          const bekleme = s ? null : h.ist.bekle('race.invited', (d) => d.room.id === oda.room.id, 10_000);
          await c.iste('race.invite', { friendId: h.id });
          if (s) {
            const kart = s.page.locator('[data-testid="yaris-davet-karti"]');
            await kart.waitFor({ timeout: 10_000 });
            denetle((await kart.innerText()).includes(hc.ad), `${h.rol} (${s.etiket}) davet kartını gördü: "${hc.ad} seni yarışa çağırıyor!"`);
            await goruntu(s, 'yaris-daveti');
            await s.page.getByRole('button', { name: 'Daveti kapat' }).click();
          } else { await bekleme; ok(`${h.rol} race.invited aldı`); }
        }
      } finally { await c.call('race.leave', {}); }
    }, [sa, sb].filter(Boolean));

    adim('D13: yönetici kodu deneme sınırı (6 yanlış kod)');
    await guvenli('D13', async () => {
      const sonuc = [];
      for (let i = 0; i < 6; i++) {
        // biçimi geçerli, rastgele, tahmin edilemez: gerçek yönetici kodu araçta yok ve istenmez
        const kod = `TEST-${randomBytes(9).toString('base64').replace(/[^A-Za-z0-9]/g, '').toUpperCase().padEnd(12, 'X').slice(0, 12)}`;
        const r = await c.iste('code.redeem', { code: kod });
        sonuc.push(r.result.kind === 'hata' ? r.result.error : r.result.kind);
      }
      console.log(`    sonuçlar: ${sonuc.join(', ')}`);
      if (sonuc[0] === 'cok') bozuk('ilk deneme bile "çok": bu IP 10 dk içinde 20 yanlış deneme yapmış (önceki koşular); 10 dk sonra yeniden deneyin');
      denetle(sonuc.slice(0, 5).every((x) => x === 'gecersiz'), '1–5. denemeler "Kod geçersiz."');
      denetle(sonuc[5] === 'cok', '6. deneme beklemeye düştü ("Çok fazla yanlış deneme. 10 dakika sonra yeniden dene.")');
      denetle(!sonuc.includes('yonetici'), 'hiçbir deneme yönetici yapmadı');
      ok('sunucu geneli sınama bütçesi: en çok 5/60 harcandı (6. deneme sınamaya ulaşmaz); sahibin kodu kilitlenmez');
    });

    adim(`D14: sahte X-Forwarded-For IP sınırını aşamaz (sunucu sınırı ${ipSiniri}/saat)`);
    if (ipSiniri <= EN_COK_HESAP) {
      await guvenli('D14', async () => {
        // hesapAc el sıkışmada yeni bir sahte X-Forwarded-For gönderir; açılırsa hesap listeye girer ve temizlikte silinir
        let acildi = false;
        try { await hesapAc('D'); acildi = true; } catch (e) {
          if (!e.code) throw e;
          denetle(e.code === 'HIZ', `${ipSiniri + 1}. hesap sahte başlıkla da reddedildi: ${e.code} (sınır gerçek IP'ye uygulanıyor)`);
        }
        if (acildi) bozuk('D14 KALDI: sahte X-Forwarded-For ile sınır aşıldı (yeni hesap açıldı; temizlikte silinecek). ODI_TRUST_PROXY vekil sayısıyla uyuşmuyor ya da önde vekil yok');
      });
    } else {
      uyar(`D14 kesin değil: sınır ${ipSiniri}, araç en çok ${EN_COK_HESAP} hesap açar. Sahte başlıkla açılan hesaplar sorunsuz çalıştı; kesin sınama için sunucu-dogrulama.md D14`);
    }
  }

  if (durduruldu) { /* temizlik sürüyor */ } else if (tarayiciHatalari.length) for (const e of [...new Set(tarayiciHatalari)]) bozuk(`tarayıcı konsolu: ${e.slice(0, 300)}`);
  else if (tarayicilar.length) ok('tarayıcı konsolunda hata yok');
} catch (e) {
  bozuk(`akış durdu: ${String(e.message ?? e).split('\n')[0]}`);
} finally {
  await temizle();
}
console.log(`\n${hata ? `✗ ${hata} hata` : '✓ 0 hata'}${uyarilar.length ? ` · ${uyarilar.length} uyarı` : ''} · test hesapları: ${hesaplar.length} açıldı, ${hesaplar.filter((h) => h.silindi).length} silindi`);
process.exit(durduruldu ? 130 : hata ? 1 : 0);
