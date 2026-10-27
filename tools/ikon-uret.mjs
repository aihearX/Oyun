#!/usr/bin/env node
// Ana ekran simgeleri (MK-037): tek SVG kaynaktan web uygulamasının PNG simgelerini üretir (yeni paket yok; Playwright Chromium ile).
//   icon-180.png           apple-touch-icon (iPhone "Ana Ekrana Ekle"): kare, tam dolu mor zemin; iOS köşeleri kendisi yuvarlar
//   icon-192.png, -512.png manifest "any": saydam zemin, simge olduğu gibi (Android yükleme önerisi 192 + 512 ister)
//   icon-maskable-512.png  manifest "maskable": mor zemin, simge güvenli alanın (merkezde %80 çaplı daire) içinde
// Sahip yeni simge verdiğinde (sahip kararı 6) yeniden çalıştırılır:
//   node tools/ikon-uret.mjs [--kaynak yol.svg] [--zemin '#6c4cf1'] [--cikti apps/web/public/icons]
// Varsayılan kaynak apps/web/public/favicon.svg (geçici simge). Zemin rengi kaynak SVG'nin ana rengiyle aynı olmalı.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i < 0 ? d : argv[i + 1]; };
const root = resolve(new URL('..', import.meta.url).pathname);
const kaynak = resolve(root, opt('kaynak', 'apps/web/public/favicon.svg'));
const zemin = opt('zemin', '#6c4cf1');
const cikti = resolve(root, opt('cikti', 'apps/web/public/icons'));
if (!/^#[0-9a-f]{3,8}$/i.test(zemin)) throw new Error(`--zemin bir renk olmalı (#rrggbb): ${zemin}`);
const svg = readFileSync(kaynak, 'utf8');
if (!/<svg[\s>]/.test(svg)) throw new Error(`SVG değil: ${kaynak}`);
const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

/** ad, kenar (px), zemin (yoksa saydam), simgenin kenara oranı */
const SIMGELER = [
  { ad: 'icon-180.png', kenar: 180, zemin, oran: 0.86 },
  { ad: 'icon-192.png', kenar: 192, zemin: null, oran: 1 },
  { ad: 'icon-512.png', kenar: 512, zemin: null, oran: 1 },
  // güvenli alan: merkezde yarıçapı kenarın %40'ı olan daire. Simge kutusu %80 → içindeki daire (30/32) güvenli alanda kalır
  { ad: 'icon-maskable-512.png', kenar: 512, zemin, oran: 0.8 },
];

mkdirSync(cikti, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const s of SIMGELER) {
    await page.setViewportSize({ width: s.kenar, height: s.kenar });
    const ic = Math.round(s.kenar * s.oran);
    await page.setContent(`<!doctype html><html><head><style>
      html,body{margin:0;width:${s.kenar}px;height:${s.kenar}px;overflow:hidden;background:${s.zemin ?? 'transparent'}}
      img{position:absolute;left:${(s.kenar - ic) / 2}px;top:${(s.kenar - ic) / 2}px;width:${ic}px;height:${ic}px}
    </style></head><body><img src="${src}"></body></html>`);
    await page.waitForFunction(() => { const i = document.querySelector('img'); return i && i.complete && i.naturalWidth > 0; });
    const png = await page.screenshot({ omitBackground: !s.zemin, clip: { x: 0, y: 0, width: s.kenar, height: s.kenar } });
    writeFileSync(resolve(cikti, s.ad), png);
    console.log(`${s.ad.padEnd(24)} ${s.kenar}×${s.kenar} ${s.zemin ? `zemin ${s.zemin}` : 'saydam'} ${png.length} B`);
  }
} finally { await browser.close(); }
