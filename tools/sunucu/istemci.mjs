// ODİ protokolünü doğrudan konuşan küçük istemci (packages/shared/src/social.ts: WireReq / WireRes / WireEvt).
// Uzak denetim araçları ortak kullanır: tools/harness/uzak-duman.mjs, tools/sunucu/yuk.mjs.
// Bağımlılık yok: Node 22'nin yerleşik WebSocket'i (el sıkışmasına başlık eklenebilir: D14 sahte X-Forwarded-For).
// Sunucuda /opt/odi/kaynak içinden npm kurulumu olmadan da çalışır.

/** packages/shared/src/social.ts PROTOCOL_VERSION ile aynı olmalı (sunucu uyumsuz sürüme SURUM döner) */
export const PROTOCOL_VERSION = 1;

/** ws(s):// adresinden sağlık adresi: wss://ad → https://ad/saglik */
export function saglikAdresi(wsUrl) {
  const u = new URL(wsUrl);
  u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:';
  u.pathname = '/saglik'; u.search = ''; u.hash = '';
  return u.href;
}

/** GET /saglik → { ok, version, players, online } */
export async function saglik(wsUrl, zamanAsimi = 8000) {
  const r = await fetch(saglikAdresi(wsUrl), { signal: AbortSignal.timeout(zamanAsimi), headers: { 'cache-control': 'no-store' } });
  if (!r.ok) throw new Error(`/saglik ${r.status}`);
  return r.json();
}

/**
 * Bağlan. Dönen nesne:
 *  call(op, data, ms?) → Promise<{ ok, data?, code?, error?, ms }> (hiçbir zaman reddetmez; zaman aşımı/kopma ok:false)
 *  on(evt, fn) → kaldırıcı; bekle(evt, kosul?, ms?) → Promise<data>
 *  kapat(); acik; kapanis (Promise<{ code, reason, bizden }>)
 */
export function baglan(url, { headers, zamanAsimi = 10_000, acilisSuresi = 15_000 } = {}) {
  return new Promise((resolve, reject) => {
    let ws;
    try { ws = headers ? new WebSocket(url, { headers }) : new WebSocket(url); } catch (e) { reject(e); return; }
    const bekleyen = new Map();
    const dinleyiciler = new Map();
    let sira = 0; let bizden = false; let acildi = false; let kapanisCoz;
    const kapanis = new Promise((r) => { kapanisCoz = r; });
    const acilisZaman = setTimeout(() => { if (!acildi) { try { ws.close(); } catch { /* yok */ } reject(new Error(`bağlantı ${acilisSuresi} ms içinde açılmadı: ${url}`)); } }, acilisSuresi);
    const ist = {
      url,
      get acik() { return ws.readyState === 1; },
      kapanis,
      async call(op, data = {}, ms = zamanAsimi) {
        if (ws.readyState !== 1) return { ok: false, code: 'KOPTU', error: 'bağlantı kapalı', ms: 0 };
        const id = ++sira; const t0 = performance.now();
        return new Promise((res) => {
          const zaman = setTimeout(() => { bekleyen.delete(id); res({ ok: false, code: 'ZAMAN_ASIMI', error: `${op}: ${ms} ms içinde yanıt yok`, ms: performance.now() - t0 }); }, ms);
          bekleyen.set(id, (m) => { clearTimeout(zaman); res({ ...m, ms: performance.now() - t0 }); });
          try { ws.send(JSON.stringify({ t: 'req', id, op, data })); } catch (e) { bekleyen.delete(id); clearTimeout(zaman); res({ ok: false, code: 'KOPTU', error: String(e), ms: 0 }); }
        });
      },
      /** call ok değilse hata fırlatır; data'yı döndürür */
      async iste(op, data = {}, ms = zamanAsimi) {
        const r = await ist.call(op, data, ms);
        if (!r.ok) { const e = new Error(`${op}: ${r.code} ${r.error ?? ''}`.trim()); e.code = r.code; throw e; }
        return r.data;
      },
      on(evt, fn) {
        if (!dinleyiciler.has(evt)) dinleyiciler.set(evt, new Set());
        dinleyiciler.get(evt).add(fn);
        return () => dinleyiciler.get(evt)?.delete(fn);
      },
      bekle(evt, kosul = () => true, ms = zamanAsimi) {
        return new Promise((res, rej) => {
          const z = setTimeout(() => { kaldir(); rej(new Error(`'${evt}' olayı ${ms} ms içinde gelmedi`)); }, ms);
          const kaldir = ist.on(evt, (d) => { if (kosul(d)) { clearTimeout(z); kaldir(); res(d); } });
        });
      },
      kapat() { bizden = true; try { ws.close(); } catch { /* yok */ } },
    };
    ws.addEventListener('open', () => { acildi = true; clearTimeout(acilisZaman); resolve(ist); });
    ws.addEventListener('error', () => { if (!acildi) { clearTimeout(acilisZaman); reject(new Error(`bağlanılamadı: ${url}`)); } });
    ws.addEventListener('close', (e) => {
      for (const [, f] of bekleyen) f({ ok: false, code: 'KOPTU', error: 'bağlantı koptu' });
      bekleyen.clear();
      kapanisCoz({ code: e.code, reason: e.reason, bizden });
    });
    ws.addEventListener('message', (e) => {
      let m; try { m = JSON.parse(String(e.data)); } catch { return; }
      if (m.t === 'res') { const f = bekleyen.get(m.id); if (f) { bekleyen.delete(m.id); f(m.ok ? { ok: true, data: m.data } : { ok: false, code: m.code, error: m.error }); } }
      else if (m.t === 'evt') for (const fn of dinleyiciler.get(m.ev) ?? []) { try { fn(m.data); } catch { /* dinleyici hatası */ } }
    });
  });
}

/** sıralı dizide yüzdelik (0–100) */
export function yuzdelik(sirali, p) {
  if (!sirali.length) return NaN;
  const i = Math.min(sirali.length - 1, Math.max(0, Math.ceil((p / 100) * sirali.length) - 1));
  return sirali[i];
}

/** komut satırı: --ad deger | --bayrak (değersiz → '1') */
export function argumanlar(argv = process.argv.slice(2)) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2); const v = argv[i + 1];
    if (v !== undefined && !v.startsWith('--')) { o[k] = v; i++; } else o[k] = '1';
  }
  return o;
}

export const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
