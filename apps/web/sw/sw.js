/* ODİ service worker (MK-037): ana ekrandan açılış, bağlantısız açılış ve güncelleme.
 * Bu dosya bir kalıptır: `vite build` (apps/web/vite.config.ts → odiServiceWorker) sürümü ve ön bellek listesini yazıp
 * dist/sw.js olarak çıkarır. Geliştirme sunucusunda yoktur ve kaydedilmez (apps/web/src/sw-kayit.ts).
 *
 * Kurallar:
 *  - Uygulama kabuğu (index.html, /assets/*, simgeler, manifest, voice/manifest.json) kurulumda önden önbelleğe alınır.
 *  - /assets/* (parmak izli) ve kabuk dosyaları: önce önbellek.
 *  - Sayfa açılışı (index.html): önce ağ (en çok AG_SURE ms), olmazsa önbellekteki index.html → `odi-guncelle`den sonra
 *    oyuncu eski sürümde takılmaz; bağlantı yokken oyun yine açılır.
 *  - Yasal sayfalar (/gizlilik, /en/privacy, /hesap-sil → gizlilik.html …; vite.config.ts odiYasalSayfalar): aynı kural, ama
 *    bağlantı yokken önbellekteki kendi dosyaları açılır (oyunun index.html'i değil).
 *  - /voice/*.mp3: çalındıkça önbelleğe girer.
 *  - WebSocket (service worker'a hiç gelmez), /saglik, /olcum ve diğer her şey: dokunulmaz (önbellek yok).
 *  - Güncelleme: yeni sürüm kurulur ve BEKLER (skipWaiting yok); eski sürümün açık sayfası kalmayınca, yani bir sonraki
 *    açılışta etkinleşir ve eski önbellekleri siler. Oyun ortasında sayfa yenilenmez.
 */
const SURUM = '__ODI_SW_SURUM__';
/** [istek adresi, önbellek anahtarı] */
const ONDEN = __ODI_SW_ONDEN__;
const ONEK = 'odi-kabuk-';
const CACHE = ONEK + SURUM;
const AG_SURE = 5000;
const KABUK = new Set(ONDEN.map(([, k]) => k));
const DOKUNMA = /^\/(saglik|olcum)(\/|$)/;
const SES = /^\/voice\/[^/]+\.mp3$/;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(ONDEN.map(async ([url, key]) => {
      // parmak izli dosyalar HTTP önbelleğinden gelebilir (değişmezler); diğerleri sunucuda doğrulanır
      const r = await fetch(new Request(url, { cache: url.startsWith('/assets/') ? 'default' : 'no-cache' }));
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      await c.put(key, await temiz(r));
    }));
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith(ONEK) && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || DOKUNMA.test(url.pathname)) return;
  if (req.mode === 'navigate') { e.respondWith(acilis(req, url.pathname)); return; }
  if (req.headers.has('range')) return;
  if (url.pathname.startsWith('/assets/') || KABUK.has(url.pathname)) { e.respondWith(onceOnbellek(e)); return; }
  if (SES.test(url.pathname)) e.respondWith(onceOnbellek(e));
});

/** yönlendirilmiş yanıt sayfa açılışında kullanılamaz (Safari): gövdeyi yeni yanıta taşı */
async function temiz(r) {
  if (!r.redirected) return r;
  return new Response(await r.blob(), { status: r.status, statusText: r.statusText, headers: r.headers });
}

async function acilis(req, yol) {
  try {
    const r = await new Promise((ok, no) => {
      const t = setTimeout(() => no(new Error('zaman aşımı')), AG_SURE);
      fetch(req).then((x) => { clearTimeout(t); ok(x); }, (err) => { clearTimeout(t); no(err); });
    });
    if (r.status < 500) return r;
    return (await kayitliSayfa(yol)) ?? r;
  } catch (err) {
    const k = await kayitliSayfa(yol);
    if (k) return k;
    throw err;
  }
}
/** önbellekteki durağan sayfa (/gizlilik → /gizlilik.html) ya da bu sürümün index.html'i (kendi /assets dosyalarıyla
 *  tutarlı); yoksa herhangi bir sürümünki */
async function kayitliSayfa(yol) {
  const c = await caches.open(CACHE);
  const sade = yol.replace(/\/+$/, '').replace(/\.html$/, '');
  if (sade && KABUK.has(sade + '.html')) {
    const s = (await c.match(sade + '.html')) ?? (await caches.match(sade + '.html'));
    if (s) return s;
  }
  return (await c.match('/index.html')) ?? (await caches.match('/index.html')) ?? null;
}

async function onceOnbellek(e) {
  const req = e.request;
  // bütün sürümlerin önbelleklerinde ara: eski sürüm etkinken yeni sürümün (kurulmuş, bekleyen) dosyaları da bulunur
  const hit = await caches.match(req, { ignoreSearch: true, ignoreVary: true });
  if (hit) return hit;
  let r;
  // ağ yok ve önbellekte yok (ör. bağlantısızken ilk kez çalınan ses kaydı): ağ hatası, service worker'da yakalanmamış hata değil
  try { r = await fetch(req); } catch { return Response.error(); }
  if (r.ok && r.status === 200 && r.type === 'basic') {
    const kopya = r.clone();
    const yol = new URL(req.url).pathname;
    e.waitUntil(caches.open(CACHE).then((c) => c.put(yol, kopya)).catch(() => undefined));
  }
  return r;
}
