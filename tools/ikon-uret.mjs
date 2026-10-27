#!/usr/bin/env node
// Uygulama ikonu, açılış görseli, web simgeleri ve mağaza görselleri (YN-010, sahip kararı 6; MK-037 web simgeleri).
// Tek kaynak: tools/ikon/kavramlar.mjs (elle yazılmış vektör SVG). Tarama Playwright Chromium ile; yeni paket yok.
//
//   node tools/ikon-uret.mjs                 hepsini üret (seçilen kavram + kavram sayfası)
//   node tools/ikon-uret.mjs --yalniz uretim yalnız uygulama / web / mağaza dosyaları
//   node tools/ikon-uret.mjs --yalniz kavram yalnız marketing/ikon/ (3 kavram SVG + karşılaştırma sayfası)
//   node tools/ikon-uret.mjs --kavram kulak  başka kavramla üret (odi | kulak | koklea; varsayılan SECILEN)
//
// Çıktılar
//   apps/mobile/assets/icon.png               1024 iOS / Expo ikonu: kare, tam dolu, alfa kanalı yok (köşeleri iOS yuvarlar)
//   apps/mobile/assets/adaptive-icon.png      1024 Android uyarlanabilir ön yüz: saydam, özne 66 dp güvenli dairenin içinde
//   apps/mobile/assets/adaptive-background.png 1024 uyarlanabilir arka yüz (gece gökyüzü)
//   apps/mobile/assets/adaptive-monochrome.png 1024 Android 13 temalı ikon: tek renk siluet, ön yüzle aynı ölçek
//   apps/mobile/assets/splash-icon.png        1024 açılış görseli (saydam; zemin app.json'da #140c35)
//   apps/mobile/assets/favicon.png            64 Expo web favicon (yuvarlatılmış köşe)
//   apps/web/public/favicon.svg               web sekme simgesi (sade sürüm, yuvarlatılmış köşe)
//   apps/web/public/icons/icon-180.png        apple-touch-icon: kare, tam dolu (iOS köşeleri kendisi yuvarlar)
//   apps/web/public/icons/icon-192.png, -512  manifest "any": yuvarlatılmış kare, köşeler saydam
//   apps/web/public/icons/icon-maskable-512   manifest "maskable": tam dolu, özne merkezdeki %80 güvenli dairede
//   marketing/magaza/play-ikon-512.png        Google Play mağaza ikonu (kare, tam dolu; köşeleri Play yuvarlar)
//   marketing/magaza/play-tanitim-1024x500.png Google Play öne çıkan görsel
//   marketing/ikon/kavram-*.svg, karsilastirma.png  üç kavram ve karşılaştırma sayfası (sahip görsün diye)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import zlib from 'node:zlib';
import { chromium } from 'playwright';
import { KAVRAMLAR, kavramSvg } from './ikon/kavramlar.mjs';

/** Seçilen kavram (YN-010): A · Odi. Gerekçe docs/yonetim/is-listesi.md YN-010 satırında. */
const SECILEN = 'odi';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1]; };
const root = resolve(new URL('..', import.meta.url).pathname);
const yalniz = opt('yalniz', null);
const k = KAVRAMLAR[opt('kavram', SECILEN)];
if (!k) throw new Error(`bilinmeyen kavram: ${opt('kavram')} (${Object.keys(KAVRAMLAR).join(', ')})`);

// Android uyarlanabilir ikon: 108 dp tuval, görünen alan 72 dp, her maskede görünür güvenli daire 66 dp çap → yarıçap 1024 × 33/108
const ANDROID_GUVENLI = (1024 * 33) / 108; // ≈ 313 px
// PWA maskable: güvenli alan merkezde yarıçapı kenarın %40'ı olan daire → 1024 çerçevede 410 px
const MASKABLE_GUVENLI = 1024 * 0.4;
const KOSE = 1024 * 0.2237; // iOS'a yakın köşe yarıçapı (favicon / "any" simgeleri)

const dataUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const yaz = (yol, veri) => { const p = resolve(root, yol); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, veri); return p; };

// ---------------------------------------------------------------- PNG: alfa kanalını at (App Store 1024 ikonu alfa kanalı kabul etmez)
function pngCoz(buf) {
  let o = 8; let w = 0, h = 0, tip = 0; const idat = [];
  while (o < buf.length) {
    const n = buf.readUInt32BE(o); const t = buf.toString('ascii', o + 4, o + 8); const d = buf.subarray(o + 8, o + 8 + n);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); tip = d[9]; if (d[8] !== 8 || d[12] !== 0) throw new Error('yalnız 8 bit, taramasız PNG'); }
    else if (t === 'IDAT') idat.push(d);
    o += 12 + n;
  }
  const bpp = tip === 6 ? 4 : tip === 2 ? 3 : 0; if (!bpp) throw new Error(`PNG renk tipi ${tip}`);
  const ham = zlib.inflateSync(Buffer.concat(idat)); const sat = w * bpp; const px = Buffer.alloc(sat * h);
  for (let y = 0; y < h; y++) {
    const ft = ham[y * (sat + 1)]; const s = ham.subarray(y * (sat + 1) + 1, (y + 1) * (sat + 1)); const c = px.subarray(y * sat, (y + 1) * sat); const u = y ? px.subarray((y - 1) * sat, y * sat) : null;
    for (let i = 0; i < sat; i++) {
      const a = i >= bpp ? c[i - bpp] : 0, b = u ? u[i] : 0, cc = u && i >= bpp ? u[i - bpp] : 0;
      let v = s[i];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) { const p = a + b - cc, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - cc); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : cc; }
      c[i] = v & 255;
    }
  }
  return { w, h, bpp, px };
}
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const parca = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
function rgbPng(buf) {
  const { w, h, bpp, px } = pngCoz(buf); if (bpp === 3) return buf;
  const ham = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; if (px[i + 3] !== 255) throw new Error(`saydam piksel (${x},${y}): tam dolu ikon bekleniyordu`);
    const j = y * (w * 3 + 1) + 1 + x * 3; ham[j] = px[i]; ham[j + 1] = px[i + 1]; ham[j + 2] = px[i + 2];
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), parca('IHDR', ihdr), parca('IDAT', zlib.deflateSync(ham, { level: 9 })), parca('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------- tarama
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function tara(html, w, h, { saydam = false, otoYukseklik = false } = {}) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${w}px;min-height:${h}px;overflow:hidden;background:${saydam ? 'transparent' : '#140c35'}}</style></head><body>${html}</body></html>`);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((ok) => { i.onload = i.onerror = ok; })))); });
  if (otoYukseklik) { h = await page.evaluate(() => Math.ceil(document.body.firstElementChild.getBoundingClientRect().height)); await page.setViewportSize({ width: w, height: h }); }
  return page.screenshot({ omitBackground: saydam, clip: { x: 0, y: 0, width: w, height: h } });
}
const svgPng = (svg, n, saydam = false) => tara(`<img src="${dataUri(svg)}" width="${n}" height="${n}" style="display:block">`, n, n, { saydam });
const kaydet = (yol, png, not) => { yaz(yol, png); console.log(`${yol.padEnd(48)} ${not} ${png.length} B`); };

try {
  if (yalniz !== 'kavram') await uretim();
  if (yalniz !== 'uretim') await kavramSayfasi();
} finally { await browser.close(); }

async function uretim() {
  const on = ANDROID_GUVENLI / k.yaricap;
  const tam = kavramSvg(k);
  kaydet('apps/mobile/assets/icon.png', rgbPng(await svgPng(tam, 1024)), '1024 tam dolu, alfa yok');
  kaydet('apps/mobile/assets/adaptive-icon.png', await svgPng(kavramSvg(k, { tur: 'ozne', olcek: on }), 1024, true), `1024 saydam ön yüz, ölçek ${on.toFixed(3)}`);
  kaydet('apps/mobile/assets/adaptive-background.png', rgbPng(await svgPng(kavramSvg(k, { tur: 'zemin' }), 1024)), '1024 arka yüz');
  kaydet('apps/mobile/assets/adaptive-monochrome.png', await svgPng(kavramSvg(k, { tur: 'mono', olcek: on }), 1024, true), '1024 tek renk');
  kaydet('apps/mobile/assets/splash-icon.png', await svgPng(kavramSvg(k, { tur: 'ozne' }), 1024, true), '1024 saydam açılış');
  kaydet('apps/mobile/assets/favicon.png', await svgPng(kavramSvg(k, { sade: true, kose: KOSE }), 64, true), '64 yuvarlatılmış');
  const fav = kavramSvg(k, { sade: true, kose: KOSE }).replace(' width="1024" height="1024"', '');
  yaz('apps/web/public/favicon.svg', `${fav}\n`); console.log(`${'apps/web/public/favicon.svg'.padEnd(48)} ${fav.length} B`);
  kaydet('apps/web/public/icons/icon-180.png', rgbPng(await svgPng(tam, 180)), '180 apple-touch, tam dolu');
  for (const n of [192, 512]) kaydet(`apps/web/public/icons/icon-${n}.png`, await svgPng(kavramSvg(k, { kose: KOSE }), n, true), `${n} any, yuvarlatılmış`);
  kaydet('apps/web/public/icons/icon-maskable-512.png', rgbPng(await svgPng(kavramSvg(k, { olcek: MASKABLE_GUVENLI / k.yaricap }), 512)), '512 maskable, tam dolu');
  kaydet('marketing/magaza/play-ikon-512.png', await svgPng(tam, 512), '512 Play ikonu (32 bit, tam dolu)'); // Play Console 32 bit PNG ister
  kaydet('marketing/magaza/play-tanitim-1024x500.png', rgbPng(await tara(tanitimHtml(), 1024, 500)), '1024×500 öne çıkan görsel');
}

/** Google Play öne çıkan görsel: solda Odi ve ses dalgaları, sağda oyunun açılış ekranındaki logo (altın ODİ, turkuaz İ) */
function tanitimHtml() {
  const odiSvg = kavramSvg(KAVRAMLAR.odi, { tur: 'ozne' });
  const zemin = kavramSvg(KAVRAMLAR.odi, { tur: 'zemin' });
  const font = `'SF Pro Rounded','Nunito','Inter','Segoe UI',sans-serif`; // tek tırnak: style="" içinde
  return `<div style="position:absolute;inset:0;overflow:hidden;font-family:${font}">
  <img src="${dataUri(zemin)}" style="position:absolute;left:0;top:-262px;width:1024px;height:1024px">
  ${[255, 345, 450].map((r, i) => `<div style="position:absolute;left:${286 - r}px;top:${250 - r}px;width:${r * 2}px;height:${r * 2}px;border-radius:50%;border:2px solid ${['rgba(255,201,60,.22)', 'rgba(46,230,214,.16)', 'rgba(139,107,255,.2)'][i]}"></div>`).join('')}
  <img src="${dataUri(odiSvg)}" style="position:absolute;left:46px;top:10px;width:480px;height:480px">
  <div style="position:absolute;left:520px;right:40px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px">
    <div lang="tr" style="font-size:150px;line-height:1;font-weight:900;letter-spacing:4px;background:linear-gradient(180deg,#fff9e0 0%,#ffe27a 38%,#ffc93c 58%,#ff9f1c 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 5px 0 #b85c00) drop-shadow(0 14px 26px rgba(255,159,28,.35))">OD<span style="background:linear-gradient(180deg,#e9fffc 0%,#2ee6d6 60%,#12a89e 100%);-webkit-background-clip:text;background-clip:text">İ</span></div>
    <div style="display:flex;align-items:center;gap:16px;margin-top:6px;font-weight:900;font-size:30px;letter-spacing:8px;color:#fff6e5"><i style="width:46px;height:3px;border-radius:2px;background:linear-gradient(90deg,transparent,#ffc93c)"></i>SESİN YOLU<i style="width:46px;height:3px;border-radius:2px;background:linear-gradient(90deg,#ffc93c,transparent)"></i></div>
    <div style="margin-top:22px;font-weight:700;font-size:28px;color:#d3ccff;letter-spacing:.3px">Sesi kulaktan beyne taşı.</div>
  </div></div>`;
}

// ---------------------------------------------------------------- kavram karşılaştırma sayfası
async function kavramSayfasi() {
  const harf = { odi: 'a', kulak: 'b', koklea: 'c' };
  for (const kv of Object.values(KAVRAMLAR)) yaz(`marketing/ikon/kavram-${harf[kv.ad]}-${kv.ad}.svg`, `${kavramSvg(kv)}\n`);
  const font = `'Inter','SF Pro Text','Segoe UI',sans-serif`;
  const ios = (kv, n, o = {}) => `<img src="${dataUri(kavramSvg(kv, { sade: n < 100, ...o }))}" width="${n}" height="${n}" style="display:block;border-radius:${n * 0.2237}px">`;
  // Android uyarlanabilir: 108 birim tuvalden ortadaki 72'lik daire görünür
  const andr = (kv, n, mono = false) => { const t = n * 1.5, on = ANDROID_GUVENLI / kv.yaricap;
    const ic = mono ? `<div style="position:absolute;inset:0;background:#d9e2ff"></div><div style="position:absolute;left:${-n / 4}px;top:${-n / 4}px;width:${t}px;height:${t}px;background:#1d3a8a;-webkit-mask:url('${dataUri(kavramSvg(kv, { tur: 'mono', olcek: on }))}') center/100% 100% no-repeat"></div>`
      : `<img src="${dataUri(kavramSvg(kv, { tur: 'zemin' }))}" style="position:absolute;left:${-n / 4}px;top:${-n / 4}px;width:${t}px;height:${t}px"><img src="${dataUri(kavramSvg(kv, { tur: 'ozne', olcek: on }))}" style="position:absolute;left:${-n / 4}px;top:${-n / 4}px;width:${t}px;height:${t}px">`;
    return `<div style="position:relative;width:${n}px;height:${n}px;border-radius:50%;overflow:hidden">${ic}</div>`; };
  const kutu = (bg, ic, yazi) => `<div style="display:flex;flex-direction:column;align-items:center;gap:8px"><div style="background:${bg};padding:18px;border-radius:14px;display:flex;align-items:center;justify-content:center;gap:16px">${ic}</div><span style="font-size:12px;color:#8a83b8">${yazi}</span></div>`;
  const satir = (kv) => `<section style="display:flex;gap:28px;align-items:center;padding:22px 26px;border-radius:22px;background:${kv.ad === SECILEN ? 'rgba(255,201,60,.08)' : 'rgba(255,255,255,.03)'};border:1.5px solid ${kv.ad === SECILEN ? 'rgba(255,201,60,.55)' : 'rgba(255,255,255,.08)'}">
    <div style="width:250px;flex:none"><div style="font-size:24px;font-weight:800;color:#fff">${kv.baslik}</div>
      ${kv.ad === SECILEN ? '<div style="display:inline-block;margin:8px 0 4px;padding:4px 10px;border-radius:999px;background:#ffc93c;color:#3b2200;font-size:12px;font-weight:800;letter-spacing:1px">ÖNERİLEN</div>' : ''}
      <p style="margin:8px 0 0;font-size:14px;line-height:1.45;color:#c9c1ff">${kv.aciklama}</p></div>
    ${kutu('transparent', ios(kv, 260), '1024 (küçültülmüş)')}
    ${kutu('#140c35', ios(kv, 180) + ios(kv, 48), '180 · 48 koyu zemin')}
    ${kutu('#f2f2f7', ios(kv, 180) + ios(kv, 48), '180 · 48 açık zemin')}
    ${kutu('#2b2d31', andr(kv, 96) + andr(kv, 48), 'Android uyarlanabilir 96 · 48')}
    ${kutu('#e8ecf8', andr(kv, 96, true) + andr(kv, 48, true), 'Android 13 temalı (tek renk)')}
  </section>`;
  // sahte ana ekran: sade renkli yer tutucu uygulamalar (marka taklidi yok) + üç kavram
  const yerTutucu = [['Takvim', '#ff6b5b'], ['Notlar', '#ffd23c'], ['Hava', '#4c8dff'], ['Müzik', '#ff5c8a'], ['Fotoğraf', '#8ef06a'], ['Harita', '#2ee6d6'], ['Saat', '#3a3a3c'], ['Ayarlar', '#8e8e93'], ['Kamera', '#5a5a5e'], ['Posta', '#4c8dff'], ['Kitap', '#ff9f1c'], ['Sağlık', '#ff5c8a'], ['Dosyalar', '#4c8dff'], ['Hesap', '#636366'], ['Podcast', '#8b6bff'], ['Mesaj', '#34c759'], ['Telefon', '#34c759']];
  const sekil = (i) => ['<circle cx="30" cy="30" r="13" fill="#fff" opacity=".9"/>', '<rect x="17" y="17" width="26" height="26" rx="6" fill="#fff" opacity=".9"/>', '<path d="M30 15 45 43H15Z" fill="#fff" opacity=".9"/>', '<rect x="16" y="26" width="28" height="8" rx="4" fill="#fff" opacity=".9"/>'][i % 4];
  const telefon = (duvar, yaziRengi) => { const hucre = []; let j = 0;
    for (let i = 0; i < 20; i++) {
      const kv = { 5: KAVRAMLAR.odi, 10: KAVRAMLAR.kulak, 15: KAVRAMLAR.koklea }[i];
      if (kv) hucre.push(`<div style="display:flex;flex-direction:column;align-items:center;gap:5px">${ios(kv, 60)}<span style="font-size:11px;color:${yaziRengi}">ODİ ${kv.baslik[0]}</span></div>`);
      else { const [ad, renk] = yerTutucu[j++ % yerTutucu.length]; hucre.push(`<div style="display:flex;flex-direction:column;align-items:center;gap:5px"><svg width="60" height="60" viewBox="0 0 60 60" style="border-radius:13.4px;display:block"><rect width="60" height="60" fill="${renk}"/>${sekil(j)}</svg><span style="font-size:11px;color:${yaziRengi}">${ad}</span></div>`); }
    }
    return `<div style="width:340px;height:620px;border-radius:46px;padding:14px;background:#0b0b0f;box-shadow:0 20px 50px rgba(0,0,0,.5)"><div style="width:100%;height:100%;border-radius:34px;background:${duvar};padding:64px 22px 0;box-sizing:border-box;display:grid;grid-template-columns:repeat(4,1fr);row-gap:22px;align-content:start">${hucre.join('')}</div></div>`; };
  const html = `<div style="width:100%;background:#0f0a26;font-family:${font};padding:40px 44px;box-sizing:border-box;color:#fff">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:22px"><div><div style="font-size:13px;letter-spacing:3px;color:#ffc93c;font-weight:800">ODİ: SESİN YOLU · UYGULAMA İKONU (YN-010)</div>
      <div style="font-size:34px;font-weight:800;margin-top:6px">Üç kavram: A · Odi, B · Kulak, C · Koklea yolu</div></div>
      <div style="max-width:560px;font-size:14px;line-height:1.5;color:#c9c1ff;text-align:right">Öneri <b style="color:#ffc93c">A · Odi</b>: oyunun kahramanı tek bakışta tanınır, 48 px'te bile yüz ve ses dalgaları okunur; oyun içi çizim, açılış ekranı ve mağaza görselleriyle aynı karakter.</div></div>
    <div style="display:flex;flex-direction:column;gap:16px">${Object.values(KAVRAMLAR).map(satir).join('')}</div>
    <div style="display:flex;gap:40px;margin-top:30px;align-items:flex-start">
      ${telefon('linear-gradient(160deg,#ffd9c7 0%,#c9d6ff 55%,#e9e0ff 100%)', '#1c1c1e')}
      ${telefon('linear-gradient(160deg,#1b2a4a 0%,#0d0d1a 60%,#26103a 100%)', '#f2f2f7')}
      <div style="flex:1;font-size:14px;line-height:1.6;color:#c9c1ff;padding-top:10px">
        <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:8px">Notlar</div>
        <p style="margin:0 0 10px"><b style="color:#fff">A · Odi</b>: karakter ikonu; oyun türünü (sevimli koşu oyunu) ve markayı birlikte söyler. Altın ve turkuaz dalgalar sesi anlatır. Android temalı ikonda da yüz ve dalgalar okunur.</p>
        <p style="margin:0 0 10px"><b style="color:#fff">B · Kulak</b>: işitme bilimi duruşu güçlü, sakin ve ciddi; ama küçük boyutta "9" ya da soru işareti gibi okunabiliyor, oyun olduğunu söylemiyor.</p>
        <p style="margin:0 0 10px"><b style="color:#fff">C · Koklea yolu</b>: oyunun haritasını ve tonotopiyi anlatır, renkli ve dikkat çekici; ama sarmal + yuvarlak baş 48 px'te salyangoz gibi algılanabilir (oyunun "Koklea, salyangoz değil" ilkesiyle çelişme riski), iç turlar küçükte kaybolur.</p>
        <p style="margin:0">Tüm çizimler elle yazılmış SVG (tools/ikon/kavramlar.mjs); dış görsel, yapay zekâ görüntü servisi ya da lisansı belirsiz varlık yok.</p></div>
    </div></div>`;
  kaydet('marketing/ikon/karsilastirma.png', await tara(html, 1800, 1000, { otoYukseklik: true }), '1800 genişlik karşılaştırma');
}
