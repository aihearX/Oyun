#!/usr/bin/env node
// Mağaza kiti denetimi (marketing/magaza): karakter sınırları, ürün kataloğu ↔ kod (SHOP), yasal yer tutucular.
//   node tools/magaza/denetle.mjs            → sınırlar + katalog; boş yasal alan UYARI
//   node tools/magaza/denetle.mjs --yayin    → mağaza gönderimi öncesi: boş yasal alan da HATA (YAYIN-LISTESI.md)
//   --adres <alan adı> --eposta <adres>      → <adres> ve {ILETISIM_EPOSTA} gerçek uzunlukla sayılır (verilmezse 40'ar karakter varsayılır)
// Karakter sayımı Unicode kod noktasıyla ([...s].length): App Store Connect ve Play Console da harf sayar (İ, ş, ü tek karakter).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i < 0 ? undefined : argv[i + 1]; };
const yayin = argv.includes('--yayin');
const root = resolve(new URL('../..', import.meta.url).pathname);
const oku = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const metin = oku('marketing/magaza/metinler.json');
const iap = oku('marketing/magaza/iap-urunler.json');
const ayar = oku('apps/web/src/yasal/ayar.json');
const adres = opt('adres') ?? 'x'.repeat(40);
const eposta = opt('eposta') ?? (ayar.ILETISIM_EPOSTA || 'x'.repeat(40));

let hata = 0, uyari = 0;
const H = (m) => { hata++; console.log(`✗ ${m}`); };
const U = (m) => { uyari++; console.log(`! ${m}`); };
const len = (s) => [...s].length;
const doldur = (s) => s.replaceAll('<adres>', adres).replaceAll('{ILETISIM_EPOSTA}', eposta);
const cozum = (v) => (typeof v === 'string' && v.startsWith('@') ? v.slice(1).split('.').reduce((o, k) => o?.[k], metin) : v);
const satirlar = [];

// ---------------------------------------------------------------- liste metinleri
for (const [magaza, diller] of [['google', metin.google], ['apple', metin.apple]]) {
  for (const [dil, alanlar] of Object.entries(diller)) {
    for (const [alan, sinir] of Object.entries(metin.sinirlar[magaza])) {
      const v = cozum(alanlar[alan]);
      if (typeof v !== 'string' || !v) { H(`${magaza} ${dil} ${alan}: boş`); continue; }
      const n = len(doldur(v));
      satirlar.push([magaza, dil, alan, n, sinir]);
      if (n > sinir) H(`${magaza} ${dil} ${alan}: ${n} > ${sinir} karakter`);
    }
    if (magaza === 'apple') {
      const k = alanlar.keywords;
      if (/,\s/.test(k)) H(`apple ${dil} keywords: virgülden sonra boşluk (karakter harcar)`);
      const kel = k.split(',');
      if (new Set(kel).size !== kel.length) H(`apple ${dil} keywords: tekrar eden sözcük`);
      const adAlt = `${alanlar.name} ${alanlar.subtitle}`.toLocaleLowerCase(dil === 'tr' ? 'tr' : 'en');
      for (const w of kel) if (adAlt.split(/[^\p{L}]+/u).includes(w)) U(`apple ${dil} keywords: "${w}" adda/alt başlıkta zaten var (gereksiz)`);
    }
  }
}

// ---------------------------------------------------------------- ürün kataloğu ↔ kod
const paket = await build({ entryPoints: [resolve(root, 'packages/shared/src/social.ts')], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const { SHOP } = await import(`data:text/javascript;base64,${Buffer.from(paket.outputFiles[0].text).toString('base64')}`);
const kod = new Map(SHOP.map((p) => [p.id, p]));
const kat = new Map(iap.urunler.map((p) => [p.id, p]));
for (const id of kod.keys()) if (!kat.has(id)) H(`katalogda yok: ${id} (SHOP'ta var)`);
for (const [id, u] of kat) {
  const p = kod.get(id);
  if (!p) { H(`kodda yok: ${id} (SHOP'ta yok)`); continue; }
  if (p.priceTry !== u.fiyatTry) H(`${id}: fiyat ${u.fiyatTry} ≠ SHOP ${p.priceTry}`);
  if (p.limit !== u.sinir) H(`${id}: sınır ${u.sinir} ≠ SHOP ${p.limit}`);
  if (!/^[a-z0-9][a-z0-9._]*$/.test(id)) H(`${id}: ürün kimliği Apple/Google biçimine uymuyor`);
  if (u.tur !== 'consumable') U(`${id}: tür ${u.tur} (istemci getProducts NON_SUBSCRIPTION ile çağırır; sunucu non_subscriptions'ta arar)`);
  for (const dil of ['tr', 'en']) {
    const t = u[dil];
    for (const [alan, sinir, m] of [['ad', iap.sinirlar.apple.ad, 'apple'], ['aciklama', iap.sinirlar.apple.aciklama, 'apple'], ['ad', iap.sinirlar.google.ad, 'google'], ['uzun', iap.sinirlar.google.uzun, 'google']]) {
      const n = len(t?.[alan] ?? '');
      if (!n) H(`${id} ${dil} ${alan}: boş`);
      else if (n > sinir) H(`${id} ${dil} ${alan}: ${n} > ${sinir} (${m})`);
    }
    satirlar.push(['iap', dil, `${id} ad/açıklama/uzun`, `${len(t.ad)}/${len(t.aciklama)}/${len(t.uzun)}`, `${iap.sinirlar.apple.ad}/${iap.sinirlar.apple.aciklama}/${iap.sinirlar.google.uzun}`]);
  }
}

// ---------------------------------------------------------------- yasal yer tutucular (apps/web/src/yasal/ayar.json)
for (const k of ['YAYINCI', 'YAYINCI_UNVAN', 'YAYINCI_ADRES', 'ILETISIM_EPOSTA', 'SUNUCU_BOLGESI', 'YURURLUK']) {
  if (!String(ayar[k] ?? '').trim()) (yayin ? H : U)(`ayar.json ${k} boş: herkese açık sayfada "eklenecek" yazar`);
}
if (ayar.ILETISIM_EPOSTA && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ayar.ILETISIM_EPOSTA)) H(`ayar.json ILETISIM_EPOSTA geçersiz: ${ayar.ILETISIM_EPOSTA}`);
if (yayin && !opt('adres')) H('--adres verilmedi: <adres> gerçek alan adıyla sayılmalı');

for (const [a, b, c, n, s] of satirlar) console.log(`  ${String(a).padEnd(6)} ${String(b).padEnd(6)} ${String(c).padEnd(34)} ${String(n).padStart(10)} / ${s}`);
console.log(`\n${hata ? '✗' : '✓'} mağaza kiti: ${hata} hata, ${uyari} uyarı`);
process.exit(hata ? 1 : 0);
