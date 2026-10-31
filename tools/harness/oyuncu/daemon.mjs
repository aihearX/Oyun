// Kişi daemon'u: kişinin kalıcı tarayıcı profilini (launchPersistentContext) açık tutar, CLI komutlarını unix soketinden alır,
// sırayla yürütür. ~20 dk boşta kalınca kendini kapatır. Başlatan: tools/harness/oyuncu.mjs (elle çalıştırılmaz).
import { createServer } from 'node:http';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, webkit } from 'playwright';
import { BOSTA_MS, CHROMIUM, DB, HIZ, OUT, PORTLAR, durumOku, kisi, kisiDir, rel, sleep, soket, yuvaAl } from './ortak.mjs';
import { ekranOzeti, kaydirKutu, oyuncuInit } from './sayfa.mjs';

const ID = process.argv[2];
const K = kisi(ID);
const DIR = kisiDir(ID); const PROFIL = resolve(DIR, 'profil'); const EKRAN = resolve(DIR, 'ekran'); const KAYIT = resolve(DIR, 'kayit.jsonl');
mkdirSync(PROFIL, { recursive: true }); mkdirSync(EKRAN, { recursive: true });
writeFileSync(resolve(DIR, 'daemon.pid'), String(process.pid));
const C = K.cihaz; const WEBKIT = C.tarayici === 'webkit';
const log = (...a) => console.log(new Date().toISOString(), ...a);
const kayit = (o) => { try { appendFileSync(KAYIT, JSON.stringify({ t: new Date().toISOString(), ...o }) + '\n'); } catch { /* yok */ } };
const tur = () => { try { return JSON.parse(readFileSync(resolve(DIR, 'tur.json'), 'utf8')).tur; } catch { return 1; } };

let ctx = null; let page = null; let cdp = null; let yukluSurum = ''; let sonKomut = Date.now(); let mesgul = false;
/** son ekran özetinden bu yana yakalanan konsol/sayfa hataları */
let hatalar = [];
/** bölüm bittiğinde CLI kopmuşsa (Bash zaman aşımı) sonuç burada bekler; bir sonraki `bolum` yazar */
let bekleyenSonuc = null;
let shotNo = Math.max(0, ...readdirSync(EKRAN).map((f) => Number(f.slice(0, 4)) || 0));
const shotYolu = (etiket) => resolve(EKRAN, `${String(++shotNo).padStart(4, '0')}-${etiket}.png`);

const beceriParam = K.beceri < 0.99 ? `&oyun-beceri=${K.beceri}` : '';
const url = () => `http://127.0.0.1:${PORTLAR.onizleme}/?sunucu=${encodeURIComponent(`ws://127.0.0.1:${PORTLAR.sunucu}`)}&oyun-bot=1&oyun-hiz=${HIZ}${beceriParam}`;
/** ilk açılışta kayda yazılan kişi ayarları (yalnız kayıt yoksa) */
const tohum = (() => { const s = {}; if (C.buyukYazi) s.bigText = true; if (K.ses === false) s.sounds = false; return Object.keys(s).length ? s : null; })();
const GURULTU = /favicon|AudioContext|WebGL|GPU stall|Autoplay|WebSocket connection|ERR_INTERNET_DISCONNECTED|net::ERR|Failed to load resource|swiftshader|GroupMarkerNotSet/i;

/** tarayıcı süreçleri ve iş parçacıkları düşük öncelikte (Chromium bazılarını kendisi -8'e çekiyor): nice 10'a geri al */
function oncelik() {
  try {
    const cocuk = new Map();
    for (const d of readdirSync('/proc')) { if (!/^\d+$/.test(d)) continue; try { const st = readFileSync(`/proc/${d}/stat`, 'utf8'); const pp = Number(st.slice(st.lastIndexOf(')') + 2).split(' ')[1]); if (!cocuk.has(pp)) cocuk.set(pp, []); cocuk.get(pp).push(Number(d)); } catch { /* bitti */ } }
    const yigin = [...(cocuk.get(process.pid) ?? [])];
    while (yigin.length) {
      const p = yigin.pop(); yigin.push(...(cocuk.get(p) ?? []));
      for (const t of readdirSync(`/proc/${p}/task`)) { try { if (os.getPriority(Number(t)) < 10) os.setPriority(Number(t), 10); } catch { /* yok */ } }
    }
  } catch { /* /proc yok */ }
}
setInterval(oncelik, 20_000).unref();
async function ac() {
  const B = WEBKIT ? webkit : chromium;
  ctx = await B.launchPersistentContext(PROFIL, {
    headless: true,
    ...(WEBKIT ? {} : { executablePath: CHROMIUM, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'], isMobile: true }),
    viewport: { width: C.genislik, height: C.yukseklik }, deviceScaleFactor: C.olcek ?? 2, hasTouch: true,
    locale: 'tr-TR', timezoneId: 'Europe/Istanbul', reducedMotion: C.hareketAzalt ? 'reduce' : 'no-preference',
    // service worker kapalı: yeni derleme her yüklemede gelsin (önbellekteki eski kabuk kişiyi eski sürümde tutmasın)
    serviceWorkers: 'block',
  });
  await ctx.addInitScript(oyuncuInit, tohum);
  page = ctx.pages()[0] ?? (await ctx.newPage());
  for (const p of ctx.pages()) if (p !== page) await p.close().catch(() => undefined);
  page.on('pageerror', (e) => hatalar.push(`sayfa hatası: ${String(e.message ?? e).split('\n')[0]}`));
  page.on('console', (m) => { if (m.type() === 'error' && !GURULTU.test(m.text())) hatalar.push(`konsol: ${m.text().split('\n')[0].slice(0, 200)}`); });
  page.on('dialog', (d) => { hatalar.push(`tarayıcı penceresi (${d.type()}): ${d.message().slice(0, 150)} → kabul edildi`); d.accept().catch(() => undefined); });
  if (!WEBKIT && C.yavasAg) {
    // eski telefon: yavaş mobil ağ (≈1,5 Mbit/s, 400 ms gecikme) + yavaş işlemci (yalnız menü komutları sürerken: Chromium'un
    // yavaşlatması boştaki sayfada da çekirdeğin yarısını yakıyordu; bölüm sırasında da yok — el modeli yavaşlamadan oynar)
    cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await agYavaslat();
  }
  await yukle();
  oncelik();
}
async function agYavaslat() { if (cdp) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 1.5e6 / 8, uploadThroughput: 0.75e6 / 8 }).catch(() => undefined); }
async function yukle() {
  const st = durumOku();
  await page.goto(url(), { waitUntil: 'load', timeout: 120_000 });
  yukluSurum = st.webCommit ?? '';
  // uygulama kendini kurana kadar (yükte birkaç saniye): ilk düğme ya da bölüm ekranı, yazı tipleri; sonra DOM durulsun
  await page.waitForFunction(() => !!document.querySelector('#root button, #root [role=button], .level-host'), null, { timeout: 60_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
  await durul(4000);
}
/** DOM 300 ms boyunca değişmeyene kadar (en çok `ms`) bekle */
async function durul(ms = 3000) {
  await page.evaluate((max) => new Promise((res) => {
    let t = 0; const bitir = () => { mo.disconnect(); clearTimeout(t); clearTimeout(son); res(); };
    const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(bitir, 300); });
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true });
    t = setTimeout(bitir, 300); const son = setTimeout(bitir, max);
  }), ms).catch(() => undefined);
}
const bolumAcik = () => page.evaluate(() => !!document.querySelector('.level-host') && !window.__odi?.done).catch(() => false);
async function coz() { await page.evaluate(() => { if (!document.querySelector('.level-host') || window.__odi?.done) window.__oyuncu?.dondur(false); }).catch(() => undefined); }
async function dondur() { await page.evaluate(() => { window.__oyuncu.izin = false; window.__oyuncu?.dondur(true); }).catch(() => undefined); }

// ---------------------------------------------------------------- ekran
async function ekran(etiket = 'ekran', { notlar = [] } = {}) {
  await sleep(150);
  const yol = shotYolu(etiket);
  await page.screenshot({ path: yol, scale: 'css', timeout: 30_000 }).catch((e) => notlar.push(`ekran görüntüsü alınamadı: ${e.message.split('\n')[0]}`));
  const o = await page.evaluate(ekranOzeti, { maxMetin: 1500 });
  const s = [];
  s.push(`[${ID}] ${C.genislik}×${C.yukseklik} ${C.tarayici} · sürüm ${yukluSurum.slice(0, 8)} · görüntü: ${rel(yol)}`);
  for (const n of notlar) s.push(`! ${n}`);
  if (hatalar.length) { s.push(`⚠ ${hatalar.length} hata (konsol/sayfa): ${[...new Set(hatalar)].slice(0, 3).join(' | ')}`); hatalar = []; }
  if (o.bolum) s.push(o.bolum.bitti ? `BÖLÜM BİTTİ: ${o.bolum.ad} (sonuç ekranı geliyor)` : `BÖLÜM AÇIK ve bekliyor: ${o.bolum.ad} → "bolum" komutuyla oynat`);
  s.push('--- metin ---'); s.push(...(o.metin.length ? o.metin : ['(görünen metin yok)']));
  s.push('--- dokunulabilir ---');
  // art arda aynı rol + ad (ör. 8 renk seçeneği) tek satır
  for (let i = 0; i < o.dok.length; i++) {
    const d = o.dok[i]; let j = i; while (j + 1 < o.dok.length && o.dok[j + 1].rol === d.rol && o.dok[j + 1].ad === d.ad) j++;
    if (j - i >= 2) { const sec = o.dok.slice(i, j + 1).filter((x) => /açık|seçili/.test(x.durum)).map((x) => x.no); s.push(`${d.no}–${o.dok[j].no}. ${d.rol} "${d.ad}" ×${j - i + 1}${sec.length ? ` (açık/seçili: ${sec.join(',')})` : ''}`); i = j; continue; }
    s.push(`${d.no}. ${d.rol} "${d.ad}"${d.durum ? ` (${d.durum})` : ''}`);
  }
  if (!o.dok.length) s.push('(yok)');
  if (o.tuval.length) s.push(`tuval: ${o.tuval.join(', ')} → içindeki şeylere koordinatla dokun: dokun @x,y (görüntüye bak)`);
  if (o.asagi || o.yukari) s.push(`kaydırma: ${[o.yukari && '↑ yukarıda içerik var', o.asagi && '↓ aşağıda içerik var (kaydir asagi)'].filter(Boolean).join(' · ')}`);
  return s.join('\n');
}

// ---------------------------------------------------------------- eylemler
async function hedef(arg) {
  // numaralar son `ekran`dan; sayfa yenilendiyse ya da metinle aranıyorsa yeniden numarala (metin araması güncel ekranda olsun)
  const numarali = await page.evaluate(() => !!document.querySelector('[data-oyuncu-no]'));
  if (!numarali || !/^\d+$/.test(arg)) await page.evaluate(ekranOzeti, { maxMetin: 0 });
  if (/^\d+$/.test(arg)) {
    const l = page.locator(`[data-oyuncu-no="${arg}"]`);
    if (!(await l.count())) throw new Error(`${arg} numaralı öğe yok (ekran değişmiş olabilir; önce ekran)`);
    const ad = await l.first().evaluate((e) => (e.getAttribute('aria-label') || e.innerText || e.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().slice(0, 50)).catch(() => '');
    return { loc: l.first(), ad: `#${arg}${ad ? ` "${ad}"` : ''}` };
  }
  const liste = await page.evaluate(() => [...document.querySelectorAll('[data-oyuncu-no]')].map((e) => ({ no: e.getAttribute('data-oyuncu-no'), ad: (e.getAttribute('aria-label') || e.innerText || e.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim() })));
  const n = (s) => s.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
  const a = n(arg);
  const bul = liste.find((x) => n(x.ad) === a) ?? liste.find((x) => n(x.ad).startsWith(a)) ?? liste.find((x) => n(x.ad).includes(a));
  if (bul) return { loc: page.locator(`[data-oyuncu-no="${bul.no}"]`).first(), ad: `#${bul.no} "${bul.ad.slice(0, 50)}"` };
  const t = page.getByText(arg, { exact: false });
  const say = await t.count();
  // listede olmayan görünür metin (ör. dokunulabilir olduğu anlaşılmayan yazı): yalnız üstte kalıyorsa (bir pencerenin arkasında değil)
  for (let i = 0; i < Math.min(say, 10); i++) {
    const l = t.nth(i);
    if (!(await l.isVisible())) continue;
    const ustte = await l.evaluate((e) => { const r = e.getBoundingClientRect(); const x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!x && (x === e || e.contains(x) || x.contains(e)); }).catch(() => false);
    if (ustte) return { loc: l, ad: `metin "${arg}" (listede yoktu)` };
  }
  throw new Error(`"${arg}" ekranda bulunamadı (numarayla dene; önce ekran)`);
}
async function dokun(arg) {
  const m = /^@?(\d+)\s*[,x ]\s*(\d+)$/.exec(arg.trim());
  if (m) { await page.touchscreen.tap(Number(m[1]), Number(m[2])); return `dokunuldu: (${m[1]}, ${m[2]})`; }
  const { loc, ad } = await hedef(arg);
  await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => undefined);
  try { await loc.tap({ timeout: 6000 }); } catch (e) {
    // örtülü ya da hareket eden öğe: tıklamayı dene, o da olmazsa zorla
    try { await loc.click({ timeout: 4000 }); } catch { await loc.click({ force: true, timeout: 4000 }).catch(() => { throw e; }); }
  }
  return `dokunuldu: ${ad}`;
}
async function yaz(metin, enter) {
  let loc = null;
  const odak = await page.evaluate(() => { const e = document.activeElement; return !!e && (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' || e.isContentEditable); });
  if (odak) loc = page.locator(':focus');
  else {
    const t = page.locator('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([disabled]), textarea:not([disabled])');
    for (let i = 0; i < (await t.count()); i++) if (await t.nth(i).isVisible()) { loc = t.nth(i); break; }
  }
  if (!loc) throw new Error('yazılacak alan yok (önce alana dokun)');
  await loc.fill(metin, { timeout: 5000 });
  if (enter) await loc.press('Enter');
  return `yazıldı: "${metin}"${enter ? ' + Enter' : ''}`;
}
async function kaydir(yon) {
  if (yon !== 'asagi' && yon !== 'yukari') throw new Error('kaydir asagi|yukari');
  const r = await page.evaluate(kaydirKutu, { yon });
  if (!r.kaydi || r.tuval) { await page.mouse.move(C.genislik / 2, C.yukseklik / 2); await page.mouse.wheel(0, (yon === 'asagi' ? 1 : -1) * Math.round(C.yukseklik * 0.6)); }
  return `kaydırıldı: ${yon}`;
}
async function surukle(arg) {
  const m = /^@?(\d+),(\d+)\s+@?(\d+),(\d+)$/.exec(arg.trim()); if (!m) throw new Error('surukle x1,y1 x2,y2');
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move(x2, y2, { steps: 15 }); await page.mouse.up();
  return `sürüklendi: (${x1},${y1}) → (${x2},${y2})`;
}
async function geri() {
  const b = await page.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
    const all = [...document.querySelectorAll('button,[role=button],a')].filter(vis);
    const ad = (e) => (e.getAttribute('aria-label') || e.innerText || '').replace(/\s+/g, ' ').trim();
    const e = all.find((x) => /^(geri|← ?geri|‹ ?geri)$/i.test(ad(x))) ?? all.find((x) => /^(←|‹)$/.test(ad(x))) ?? all.find((x) => /^kapat$/i.test(ad(x)));
    if (!e) return null; e.setAttribute('data-oyuncu-geri', '1'); return ad(e);
  });
  if (b) { await page.locator('[data-oyuncu-geri="1"]').first().click({ timeout: 4000 }).catch(() => undefined); await page.evaluate(() => document.querySelector('[data-oyuncu-geri]')?.removeAttribute('data-oyuncu-geri')).catch(() => undefined); return `dokunuldu: "${b}"`; }
  await page.keyboard.press('Escape');
  return 'Escape (görünür geri/kapat düğmesi yok)';
}

// ---------------------------------------------------------------- bölüm
async function bolum({ zamanSn = 600 } = {}) {
  if (!(await bolumAcik())) {
    if (bekleyenSonuc) { const s = bekleyenSonuc; bekleyenSonuc = null; return `(önceki bölümün sonucu; o sırada komut kopmuştu)\n${s}`; }
    throw new Error('açık bölüm yok: önce bölümü başlatan düğmeye dokun (ör. "Bölüm 3", "Oyna", "Tekrar oyna"), sonra bolum');
  }
  const t0 = Date.now();
  const y = await yuvaAl(ID, { bekliyor: () => log('bölüm: yuva bekleniyor') });
  const notlar = []; if (y.beklemeMs > 1500) notlar.push(`yuva için ${Math.round(y.beklemeMs / 1000)} sn beklendi`);
  const kareler = [];
  let sonuc; let spec; let el; let cikti = false;
  try {
    await page.evaluate(() => { window.__oyuncu.izin = true; window.__oyuncu.dondur(false); });
    const tb = Date.now(); const esik = [0.25, 0.5, 0.75]; let ei = 0;
    for (;;) {
      await sleep(400);
      const d = await page.evaluate(() => {
        const o = window.__odi; const p = o?.events?.filter((e) => e.type === 'progress').pop();
        return { var: !!document.querySelector('.level-host'), done: !!o?.done, started: !!o?.events?.some((e) => e.type === 'started'), pct: p ? p.pct : 0, ad: o?.spec ? `${o.spec.number}. ${o.spec.name}` : '' };
      });
      if (d.done) break;
      if (!d.var) { cikti = true; break; }
      const gecen = (Date.now() - tb) / 1000;
      if (ei < 3 && d.started && (d.pct >= esik[ei] || gecen > (ei + 1) * 25 / Math.max(1, HIZ / 2))) {
        const yol = shotYolu(`bolum-${ei + 1}`); await page.screenshot({ path: yol, scale: 'css' }).catch(() => undefined); kareler.push(`${rel(yol)} (%${Math.round(d.pct * 100)})`); ei++;
      }
      if (gecen > zamanSn) { notlar.push(`bölüm ${zamanSn} sn'de bitmedi: donduruldu (bot takılmış olabilir — hata olarak yaz)`); break; }
    }
    const r = await page.evaluate(() => ({ result: window.__odi?.result ?? null, spec: window.__odi?.spec ? { number: window.__odi.spec.number, name: window.__odi.spec.name, mechanic: window.__odi.spec.mechanic, biome: window.__odi.spec.biome, objective: window.__odi.spec.objective?.label, coinsTotal: window.__odi.spec.coinsTotal, par: window.__odi.spec.parTimeSec, modifiers: window.__odi.spec.modifiers } : null, el: window.__odiEl ?? null }));
    sonuc = r.result; spec = r.spec; el = r.el;
    // sonuç ekranı (App levelDone 250 ms'de bir yoklar) + kutlama animasyonları
    if (sonuc) { for (let i = 0; i < 40 && (await page.evaluate(() => !!document.querySelector('.level-host'))); i++) await sleep(250); await sleep(1500); }
  } finally {
    await page.evaluate(() => { window.__oyuncu.izin = false; }).catch(() => undefined);
    y.birak();
  }
  const sure = Math.round((Date.now() - t0) / 1000);
  const s = [];
  if (sonuc) {
    const x = sonuc;
    s.push(`SONUÇ: ${spec ? `${spec.number}. ${spec.name}` : '?'} → ${x.completed ? `GEÇTİ ${'★'.repeat(x.stars)}${'☆'.repeat(3 - x.stars)} (${x.stars} yıldız)` : `KAYBETTİ${x.extra?.reason ? ` (${x.extra.reason})` : ''}`}`);
    s.push(`nota ${x.coins}/${spec?.coinsTotal ?? '?'} · oyun süresi ${Math.round(x.timeSec)} sn (hedef ${spec?.par ?? '?'} sn) · düşme ${x.deaths} · hasar ${x.damageTaken} · skor ${Math.round(x.score)}`);
    if (spec) s.push(`bölüm: ${spec.mechanic} / ${spec.biome} · hedef: ${spec.objective ?? '?'}${spec.modifiers?.length ? ` · değiştirici: ${spec.modifiers.join(', ')}` : ''}`);
    s.push(`el: ${el ? `${el.model} (beceri ${el.beceri}, deneme ${el.deneme})` : 'kusursuz bot'} · gerçek süre ${sure} sn`);
    kayit({ komut: 'bolum', bolum: spec?.number, gecti: x.completed, yildiz: x.stars, nota: x.coins, notaTop: spec?.coinsTotal, sure: Math.round(x.timeSec), dusme: x.deaths, hasar: x.damageTaken, neden: x.extra?.reason, el, duvar: sure, tur: tur(), surum: yukluSurum.slice(0, 8) });
  } else if (cikti) s.push('bölüm ekranı kapandı (çıkıldı ya da sayfa değişti); sonuç yok');
  else s.push('sonuç yok');
  if (kareler.length) s.push(`bölüm içi kareler: ${kareler.join(' · ')}`);
  return s.join('\n') + '\n' + (await ekran('sonuc', { notlar }));
}

// ---------------------------------------------------------------- durum
async function kitaplik() { const f = resolve(OUT, 'kitaplik.mjs'); return import(pathToFileURL(f).href + `?v=${statSync(f).mtimeMs}`); }
async function sunucuKaydi(token) {
  if (!token) return null;
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(DB, { readOnly: true });
    try {
      const p = db.prepare('SELECT id, name, friend_code, jeton, kristal, xp, highest, stars, team_id, team_role, league_tier FROM players WHERE token_hash = ?').get(createHash('sha256').update(token).digest('hex'));
      if (!p) return { hesap: 'sunucuda yok (henüz bağlanmadı ya da silindi)' };
      let takim = null; if (p.team_id) { try { takim = db.prepare('SELECT name FROM teams WHERE id = ?').get(p.team_id)?.name ?? p.team_id; } catch { takim = p.team_id; } }
      return { ad: p.name, arkadasKodu: p.friend_code, jeton: p.jeton, kristal: p.kristal, sunucuEnYuksekBolum: p.highest, takim, takimRolu: p.team_role, lig: p.league_tier };
    } finally { db.close(); }
  } catch (e) { return { hata: String(e.message ?? e).slice(0, 120) }; }
}
function denemeler() {
  if (!existsSync(KAYIT)) return {};
  const t = tur(); const by = {};
  for (const l of readFileSync(KAYIT, 'utf8').split('\n')) { if (!l) continue; try { const o = JSON.parse(l); if (o.komut !== 'bolum' || (o.tur ?? 1) !== t || !o.bolum) continue; const b = (by[o.bolum] ??= { deneme: 0, kayip: 0 }); b.deneme++; if (!o.gecti) b.kayip++; } catch { /* bozuk satır */ } }
  return by;
}
async function durum() {
  const ls = await page.evaluate(() => ({ kayit: localStorage.getItem('odi-v1'), token: localStorage.getItem('odi.net.token') }));
  const lib = await kitaplik();
  const s = ls.kayit ? JSON.parse(ls.kayit).state ?? {} : {};
  const progress = s.progress ?? {};
  const toplam = lib.HUMAN_JOURNEY.levels.length;
  const gecilen = lib.clearedCount(progress);
  const yildizlar = Object.keys(progress).map(Number).sort((a, b) => a - b).map((n) => `${n}:${progress[n].stars}`).join(' ');
  const ftue = s.ftue ?? {};
  const acik = lib.FEATURES.filter((f) => ftue.bypass || ftue.admin || gecilen >= f.at).map((f) => f.name);
  const kilitli = lib.FEATURES.filter((f) => !(ftue.bypass || ftue.admin || gecilen >= f.at)).map((f) => `${f.name} (${f.at})`);
  const den = denemeler(); const zor = Object.entries(den).filter(([, v]) => v.kayip > 0).sort((a, b) => b[1].kayip - a[1].kayip).slice(0, 5).map(([k, v]) => `${k}: ${v.kayip}/${v.deneme} kayıp`);
  const o = {
    kisi: ID, tur: tur(), surum: yukluSurum.slice(0, 8),
    oyunBitti: gecilen >= toplam, gecilenBolum: `${gecilen}/${toplam}`, siradakiBolum: Math.min(toplam, gecilen + 1),
    yildizToplam: Object.values(progress).reduce((a, p) => a + (p.stars ?? 0), 0), ucYildiz: Object.values(progress).filter((p) => p.stars >= 3).length,
    yildizlar, jetonCihaz: s.coins ?? 0, xp: s.xp ?? 0, oyuncuSeviyesi: lib.levelFromXp(s.xp ?? 0), seri: s.streak ?? 0,
    ayarlar: { ses: s.sounds !== false, buyukYazi: !!s.bigText, bilgiDuzeyi: s.knowledge ?? 'genel' },
    sunucu: await sunucuKaydi(ls.token),
    acikYerler: acik, kilitliYerler: kilitli,
    denemeler: { toplam: Object.values(den).reduce((a, v) => a + v.deneme, 0), kayip: Object.values(den).reduce((a, v) => a + v.kayip, 0), enZor: zor },
  };
  // üst düzey anahtar başına bir satır (kısa; ajanların bağlamı sınırlı) — yine geçerli JSON
  return '{\n' + Object.entries(o).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n}';
}

// ---------------------------------------------------------------- sıfırla
async function hesapSil(token) {
  const { PROTOCOL_VERSION } = await kitaplik();
  const ws = new WebSocket(`ws://127.0.0.1:${PORTLAR.sunucu}`); let id = 0; const bek = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.t === 'res' && bek.has(m.id)) { const p = bek.get(m.id); bek.delete(m.id); if (m.ok) p.res(m.data); else p.rej(new Error(`${m.code}: ${m.error}`)); } };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('sunucuya bağlanılamadı')); setTimeout(() => rej(new Error('bağlantı zaman aşımı')), 8000); });
  const call = (op, data) => new Promise((res, rej) => { const i = ++id; bek.set(i, { res, rej }); ws.send(JSON.stringify({ t: 'req', id: i, op, data })); setTimeout(() => rej(new Error(op + ' zaman aşımı')), 10_000); });
  try { const h = await call('hello', { token, version: PROTOCOL_VERSION }); await call('account.delete', {}); return h?.me?.name ?? '?'; } finally { ws.close(); }
}
async function sifirla(evet) {
  const d = await durum().then(JSON.parse).catch(() => ({}));
  if (!d.oyunBitti && !evet) throw new Error(`oyun bitmedi (${d.gecilenBolum ?? '?'}); yine de sıfırlamak için: sifirla --evet`);
  const token = await page.evaluate(() => localStorage.getItem('odi.net.token')).catch(() => null);
  // önce tarayıcıyı kapat: uygulama silinen hesabın yerine kendiliğinden yeni hesap açmasın
  await ctx.close().catch(() => undefined); ctx = null; page = null;
  let hesap = 'sunucu hesabı yoktu';
  if (token) { try { hesap = `sunucu hesabı silindi (account.delete; ad "${await hesapSil(token)}")`; } catch (e) { hesap = `sunucu hesabı silinemedi: ${e.message}`; } }
  rmSync(PROFIL, { recursive: true, force: true });
  const yeniTur = tur() + 1; writeFileSync(resolve(DIR, 'tur.json'), JSON.stringify({ tur: yeniTur, at: new Date().toISOString() }));
  kayit({ komut: 'sifirla', onceki: d.gecilenBolum, tur: yeniTur, surum: yukluSurum.slice(0, 8) });
  return `SIFIRLANDI · ${hesap} · tarayıcı profili silindi · yeni tur: ${yeniTur} (ekran görüntüleri kanıt için duruyor). Sonraki komut oyunu ilk kez açar.`;
}

// ---------------------------------------------------------------- komutlar
async function yurut({ komut, arg = '', secenek = {} }) {
  const t0 = Date.now();
  if (!ctx) await ac();
  const notlar = [];
  if ((durumOku().webCommit ?? '') !== yukluSurum) { const eski = yukluSurum.slice(0, 8); await yukle(); notlar.push(`yeni sürüm yüklendi: ${eski} → ${yukluSurum.slice(0, 8)} (sayfa yenilendi)`); }
  if (komut !== 'bolum') await coz();
  const yavas = !!cdp && komut !== 'bolum' && komut !== 'durum';
  if (yavas) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 }).catch(() => undefined);
  try { return await yurutIc(komut, arg, secenek, notlar, t0); } finally { if (yavas && cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => undefined); }
}
async function yurutIc(komut, arg, secenek, notlar, t0) {
  let cikti;
  switch (komut) {
    case 'ekran': await durul(1500); cikti = await ekran('ekran', { notlar }); break;
    case 'dokun': { const m = await dokun(arg); await sleep(350); await durul(); notlar.unshift(m); cikti = await ekran('dokun', { notlar }); break; }
    case 'yaz': { const m = await yaz(arg, !!secenek.enter); await durul(); notlar.unshift(m); cikti = await ekran('yaz', { notlar }); break; }
    case 'kaydir': { const m = await kaydir(arg.trim()); await sleep(400); await durul(1500); notlar.unshift(m); cikti = await ekran('kaydir', { notlar }); break; }
    case 'surukle': { const m = await surukle(arg); await sleep(400); await durul(1500); notlar.unshift(m); cikti = await ekran('surukle', { notlar }); break; }
    case 'geri': { const m = await geri(); await sleep(300); await durul(); notlar.unshift(m); cikti = await ekran('geri', { notlar }); break; }
    case 'bekle': { const sn = Math.min(300, Math.max(1, Number(arg) || 5)); await sleep(sn * 1000); notlar.unshift(`${sn} sn beklendi`); cikti = await ekran('bekle', { notlar }); break; }
    case 'yenile': await yukle(); notlar.unshift('sayfa yenilendi (uygulamayı kapatıp açmak gibi)'); cikti = await ekran('yenile', { notlar }); break;
    case 'ag': {
      const kapat = /^(kapat|kes|off|cevrimdisi)$/.test(arg.trim()); if (!kapat && !/^(ac|aç|on|cevrimici)$/.test(arg.trim())) throw new Error('ag kapat|ac');
      await ctx.setOffline(kapat);
      // Playwright'ın çevrimdışı/çevrimiçi geçişi ağ koşullarını sıfırlar: eski telefonun yavaş ağı geri gelsin
      if (!kapat) await agYavaslat();
      await sleep(kapat ? 800 : 2500); await durul();
      notlar.unshift(kapat ? 'ağ KAPALI (uçak modu gibi) — "ag ac" ile geri aç' : 'ağ açık'); cikti = await ekran('ag', { notlar }); break;
    }
    case 'bolum': cikti = (notlar.length ? notlar.map((n) => `! ${n}`).join('\n') + '\n' : '') + (await bolum({ zamanSn: Number(secenek.zaman) || 600 })); break;
    case 'durum': cikti = await durum(); break;
    case 'gelistirici-ac': {
      // YALNIZ GELİŞTİRİCİ / duman testi (oyuncu ajanları kullanmaz): 1..n-1 bölümleri 1 yıldızla geçilmiş say, hikâyeyi izlenmiş say
      const n = Math.max(1, Math.min(40, Number(arg) || 1));
      await page.evaluate((n) => { const k = JSON.parse(localStorage.getItem('odi-v1') || '{"state":{},"version":3}'); const st = k.state; st.progress ??= {}; for (let i = 1; i < n; i++) if (!(st.progress[i]?.stars > 0)) st.progress[i] = { stars: 1, best: 0, plays: 1 }; st.ftue = { ...(st.ftue ?? { v: 1, tours: [] }), v: 1, story: true, bypass: true }; localStorage.setItem('odi-v1', JSON.stringify(k)); }, n);
      await yukle(); notlar.unshift(`geliştirici: 1-${n - 1} geçilmiş sayıldı, rehber turları kapalı (ftue bypass)`); cikti = await ekran('ac', { notlar }); break;
    }
    case 'sifirla': cikti = await sifirla(!!secenek.evet); kayit({ komut, sure: Date.now() - t0 }); kapaniyor = true; try { srv.close(); rmSync(soket(ID), { force: true }); rmSync(resolve(DIR, 'daemon.pid'), { force: true }); } catch { /* yok */ } setTimeout(() => process.exit(0), 300); return cikti;
    default: throw new Error(`bilinmeyen komut: ${komut}`);
  }
  if (page) await dondur();
  kayit({ komut, arg: arg.slice(0, 80), ms: Date.now() - t0 });
  return cikti;
}

let kuyruk = Promise.resolve();
let kapaniyor = false;
async function kapat(neden) {
  if (kapaniyor) return; kapaniyor = true;
  log('kapanıyor:', neden);
  // önce yeni bağlantıları kes: kapanırken gelen komut yarıda kalmasın (CLI yeni bir oturum açar)
  try { srv.close(); rmSync(soket(ID), { force: true }); } catch { /* yok */ }
  try { await ctx?.close(); } catch { /* yok */ }
  try { rmSync(soket(ID), { force: true }); rmSync(resolve(DIR, 'daemon.pid'), { force: true }); } catch { /* yok */ }
  process.exit(0);
}
rmSync(soket(ID), { force: true });
const srv = createServer((req, res) => {
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    let msg; try { msg = JSON.parse(body); } catch { res.end(JSON.stringify({ kod: 2, cikti: 'bozuk istek' })); return; }
    if (msg.komut === 'ping') { res.end(JSON.stringify({ kod: 0, cikti: mesgul ? 'meşgul' : 'hazır' })); return; }
    if (kapaniyor) { res.end(JSON.stringify({ kod: 3, cikti: 'oturum kapanıyor; komutu yeniden gönder' })); return; }
    if (msg.komut === 'kapat') { try { srv.close(); rmSync(soket(ID), { force: true }); } catch { /* yok */ } res.end(JSON.stringify({ kod: 0, cikti: 'kapanıyor' })); kuyruk = kuyruk.then(() => kapat('komut')); return; }
    kuyruk = kuyruk.then(async () => {
      mesgul = true; sonKomut = Date.now();
      try {
        const cikti = await yurut(msg);
        // CLI kopmuşsa (Bash zaman aşımı) bölüm sonucu kaybolmasın: bir sonraki `bolum` yazar
        if (msg.komut === 'bolum' && (res.destroyed || req.socket.destroyed)) bekleyenSonuc = cikti;
        res.end(JSON.stringify({ kod: 0, cikti }));
      }
      catch (e) {
        log('hata', msg.komut, e);
        let ek = ''; try { if (page && msg.komut !== 'sifirla') { ek = '\n' + (await ekran('hata')); await dondur(); } } catch { /* yok */ }
        res.end(JSON.stringify({ kod: 1, cikti: `HATA: ${String(e.message ?? e).split('\n')[0]}${ek}` }));
      } finally { mesgul = false; sonKomut = Date.now(); }
    });
  });
});
srv.requestTimeout = 0; srv.headersTimeout = 60_000;
srv.listen(soket(ID), () => log('dinliyor', soket(ID), 'kişi', ID));
setInterval(() => { if (!mesgul && Date.now() - sonKomut > BOSTA_MS) void kuyruk.then(() => kapat('boşta')); }, 30_000).unref();
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, () => void kapat(sig));
process.on('unhandledRejection', (e) => log('unhandledRejection', e));
