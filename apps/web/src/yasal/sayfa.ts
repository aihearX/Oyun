/**
 * Herkese açık durağan yasal sayfalar (/gizlilik, /en/privacy, /hesap-sil): metin.ts'ten tam HTML belgesi üretir.
 * `vite build` sırasında çağrılır (apps/web/vite.config.ts → odiYasalSayfalar). Dış yazı tipi, betik, izleyici yok;
 * stil satır içi (tek dosya: service worker önden önbelleğe alır, bağlantısız açılır). Renkler oyunla aynı (styles.css :root),
 * metin kontrastı WCAG AA (koyu zeminde beyaz / açık mor).
 */
import { AYAR, belgeDoldur, satirParcala, type Belge, type Blok, type YasalAyar } from './yasal';

export { YASAL_SAYFALAR } from './metin';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function satir(s: string): string {
  return satirParcala(s).map((p) => (p.t === 'kalin' ? `<strong>${esc(p.x)}</strong>` : p.t === 'bag' ? `<a href="${esc(p.href)}">${esc(p.x)}</a>` : esc(p.x))).join('');
}

function blokHtml(b: Blok): string {
  switch (b.t) {
    case 'h2': return `<h2${b.id ? ` id="${esc(b.id)}"` : ''}>${satir(b.x)}</h2>`;
    case 'h3': return `<h3>${satir(b.x)}</h3>`;
    case 'p': return `<p>${satir(b.x)}</p>`;
    case 'not': return `<p class="not">${satir(b.x)}</p>`;
    case 'ul': case 'ol': return `<${b.t}>${b.x.map((x) => `<li>${satir(x)}</li>`).join('')}</${b.t}>`;
    case 'tablo': return `<table><thead><tr>${b.bas.map((h) => `<th scope="col">${satir(h)}</th>`).join('')}</tr></thead><tbody>${
      b.satir.map((r) => `<tr>${r.map((c, i) => `<td data-k="${esc(satirParcala(b.bas[i] ?? '').map((p) => p.x).join(''))}">${satir(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
}

const CSS = `
:root{color-scheme:dark;--bg:#140c35;--panel:#2a1b63;--edge:rgba(255,255,255,.14);--text:#fff;--text-2:#d3ccff;--gold:#ffc93c;--teal:#2ee6d6}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 "SF Pro Rounded","Segoe UI Rounded","Nunito","Helvetica Neue",Arial,sans-serif;overflow-wrap:anywhere}
main{max-width:760px;margin:0 auto;padding:max(20px,env(safe-area-inset-top)) 16px max(40px,env(safe-area-inset-bottom))}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
header .marka{font-weight:800;color:var(--gold);text-decoration:none;font-size:1.0625rem}
h1{font-size:1.625rem;line-height:1.25;margin:12px 0 16px}
h2{font-size:1.1875rem;margin:28px 0 8px;color:var(--gold);scroll-margin-top:16px}
h3{font-size:1rem;margin:20px 0 6px}
p,li{color:var(--text-2)}
strong{color:var(--text)}
a{color:var(--teal);text-underline-offset:2px}
a:focus-visible{outline:2px solid var(--gold);outline-offset:2px;border-radius:4px}
ul,ol{padding-left:22px;margin:8px 0}
li{margin:6px 0}
.not{background:var(--panel);border:1px solid var(--edge);border-radius:16px;padding:14px 16px;color:var(--text)}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:.9375rem}
th,td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--edge);color:var(--text-2)}
th{color:var(--text);background:var(--panel)}
footer{margin-top:36px;padding-top:16px;border-top:1px solid var(--edge);font-size:.875rem;color:var(--text-2)}
@media (max-width:640px){
  thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  table,tbody,tr,td{display:block;width:100%}
  tr{background:var(--panel);border:1px solid var(--edge);border-radius:14px;padding:6px 12px;margin:10px 0}
  td{border:0;padding:4px 0}
  td::before{content:attr(data-k);display:block;font-size:.75rem;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:var(--gold)}
}`;

const UI = {
  tr: { oyun: 'Oyuna dön', alt: 'Bu sayfa çevrimdışı da açılır. Metin oyunun içinde de var: Profil › Ayarlar › Gizlilik ve hesap.' },
  en: { oyun: 'Back to the game', alt: 'This page also opens offline. The same text is in the game: Profile › Settings › Gizlilik ve hesap.' },
};

/** belgenin tam HTML sayfası (yer tutucular ayar.json'dan doldurulur) */
export function sayfaHtml(belge: Belge, ayar: YasalAyar = AYAR): string {
  const b = belgeDoldur(belge, ayar);
  const ui = UI[b.dil];
  const esi = b.yol === '/gizlilik' ? '/en/privacy' : b.yol === '/en/privacy' ? '/gizlilik' : '';
  return `<!doctype html>
<html lang="${b.dil}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#140c35">
<meta name="description" content="${esc(b.ozet)}">
<title>${esc(b.baslik)} · ODİ: Sesin Yolu</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
${esi ? `<link rel="alternate" hreflang="${b.dil === 'tr' ? 'en' : 'tr'}" href="${esi}">\n` : ''}<style>${CSS}</style>
</head>
<body>
<main>
<header><a class="marka" href="/">ODİ: Sesin Yolu</a><a href="/">${ui.oyun}</a></header>
<h1>${esc(b.baslik)}</h1>
${b.bloklar.map(blokHtml).join('\n')}
<footer>${esc(ui.alt)}</footer>
</main>
</body>
</html>
`;
}
