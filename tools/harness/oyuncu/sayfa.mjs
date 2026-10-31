// Oyuncu testi: sayfa içinde çalışan işlevler (Playwright addInitScript / evaluate ile verilir; dış değişken kullanmaz).

/**
 * Her sayfa açılışında (uygulama betiklerinden önce):
 *  1) ilk açılışta kişinin cihaz ayarları (Büyük yazı, ses) — yalnız kayıt yoksa (oyuncu Ayarlar'dan açmış gibi)
 *  2) requestAnimationFrame kapısı: komutlar arasında Phaser döngüleri (harita, kamp, bölüm) durur → boştaki 10 kişi işlemci yemez
 *  3) bölüm ekranı (.level-host) açılınca, `bolum` komutu izin vermediyse hemen dondur: bölüm yalnız yuva kilidiyle koşar
 *  4) açık WebSocket'lerin listesi: `ag kapat` onları gerçek uçak modu gibi koparır (Playwright'ın setOffline'ı açık bağlantıya
 *     dokunmaz; uygulama "bağlı" sanır, istekler zaman aşımına düşerdi)
 * Harita dönüş sahnesi (yıldız uçuşu, yürüyüş) dondurmadan önce biter: daemon ekran görüntüsünden önce bekler (daemon.mjs diziBekle).
 */
export function oyuncuInit(seed) {
  if (window.top !== window) return;
  try { if (seed && !localStorage.getItem('odi-v1')) localStorage.setItem('odi-v1', JSON.stringify({ state: seed, version: 3 })); } catch { /* depolama yok */ }
  const raf = window.requestAnimationFrame.bind(window); const caf = window.cancelAnimationFrame.bind(window);
  let frozen = false; let seq = 0; const q = new Map();
  window.requestAnimationFrame = (cb) => { if (!frozen) return raf(cb); const id = -(++seq); q.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => { if (id < 0) q.delete(id); else caf(id); };
  // donukken CSS/SVG animasyonları da durur (yazılım GL'de yıldızlı arka planlar, yüzen Odi vb. boşta bile çekirdek yiyordu)
  const css = () => { let st = document.getElementById('__oyuncu_donuk'); if (!st) { st = document.createElement('style'); st.id = '__oyuncu_donuk'; st.textContent = '*,*::before,*::after{animation-play-state:paused!important;transition:none!important}'; } return st; };
  const svg = (dur) => { for (const e of document.querySelectorAll('svg')) { try { if (dur) e.pauseAnimations(); else e.unpauseAnimations(); } catch { /* yok */ } } };
  const o = { izin: false, donuk: false, dondur(v) {
    frozen = !!v; o.donuk = frozen;
    if (frozen) { (document.head ?? document.documentElement).appendChild(css()); svg(true); }
    else { document.getElementById('__oyuncu_donuk')?.remove(); svg(false); const l = [...q.values()]; q.clear(); for (const cb of l) raf(cb); }
  } };
  window.__oyuncu = o;
  // bağlantı kesme: uygulama anormal kapanış (1006) görür, alttaki bağlantı da kapatılır (gerçek kapanış olayı sonradan gelse de
  // uygulama o soketi çoktan bırakmıştır)
  const WS = window.WebSocket; const acik = new Set();
  window.WebSocket = class extends WS {
    constructor(...a) { super(...a); acik.add(this); this.addEventListener('close', () => acik.delete(this)); }
  };
  o.wsKopar = () => {
    const l = [...acik]; acik.clear();
    for (const ws of l) { try { ws.dispatchEvent(new CloseEvent('close', { code: 1006, reason: '', wasClean: false })); ws.close(); } catch { /* kapalı */ } }
    return l.length;
  };
  const mo = new MutationObserver(() => { if (!frozen && !o.izin && document.querySelector('.level-host')) o.dondur(true); });
  const start = () => mo.observe(document.documentElement, { childList: true, subtree: true });
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);
}

/**
 * Ekran özeti: görünen metin (başlıklar #), numaralı dokunulabilir öğeler (data-oyuncu-no ile işaretlenir), kaydırma ve tuval bilgisi.
 * Dönüş: { metin: string[], dok: {no, rol, ad, durum}[], asagi, yukari, tuval: string[], bolum: {...}|null }
 */
export function ekranOzeti({ maxMetin }) {
  const vw = innerWidth; const vh = innerHeight;
  const tr = (s) => s.replace(/\s+/g, ' ').trim();
  const kisalt = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const gorunur = (el) => {
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return null;
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return null;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return null; }
    return r;
  };
  /** öğe üstte mi (bir örtü/pencere arkasında kalmamış): merkez ve iki yan noktadan biri öğeye düşmeli */
  const ustte = (el, r) => {
    const ys = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
    for (const x of [r.left + r.width / 2, r.left + Math.min(8, r.width / 3), r.right - Math.min(8, r.width / 3)]) {
      const t = document.elementFromPoint(Math.min(vw - 1, Math.max(0, x)), ys);
      if (t && (t === el || el.contains(t) || t.contains(el))) return true;
    }
    return false;
  };
  for (const e of document.querySelectorAll('[data-oyuncu-no]')) e.removeAttribute('data-oyuncu-no');
  const SEL = 'button, a[href], [role=button], [role=tab], [role=link], [role=switch], [role=checkbox], [role=radio], [role=menuitem], [role=option], [role=slider], input:not([type=hidden]), textarea, select, summary, label[for], [onclick], [tabindex]:not([tabindex="-1"])';
  const adi = (el) => {
    const al = el.getAttribute('aria-label'); if (al) return tr(al);
    const lb = el.getAttribute('aria-labelledby'); if (lb) { const t = lb.split(/\s+/).map((id) => document.getElementById(id)?.innerText ?? '').join(' '); if (tr(t)) return tr(t); }
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      const lab = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : el.closest('label');
      const ph = el.getAttribute('placeholder');
      return tr([lab ? lab.innerText : '', ph ? `(${ph})` : ''].join(' ')) || el.getAttribute('name') || '';
    }
    const t = tr(el.innerText || ''); if (t) return t;
    return tr(el.getAttribute('title') || el.querySelector('img[alt]')?.getAttribute('alt') || el.querySelector('svg title')?.textContent || '');
  };
  const rolu = (el) => {
    const r = el.getAttribute('role'); const tag = el.tagName;
    if (r === 'tab') return 'sekme'; if (r === 'switch' || r === 'checkbox' || (tag === 'INPUT' && el.type === 'checkbox')) return 'anahtar';
    if (r === 'radio' || (tag === 'INPUT' && el.type === 'radio')) return 'seçenek'; if (r === 'slider' || (tag === 'INPUT' && el.type === 'range')) return 'kaydırıcı';
    if (tag === 'A' || r === 'link') return 'bağlantı'; if (tag === 'INPUT' || tag === 'TEXTAREA') return 'yazı alanı'; if (tag === 'SELECT') return 'liste';
    if (r === 'option' || r === 'menuitem') return 'seçenek';
    return 'düğme';
  };
  const durum = (el) => {
    const d = [];
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') d.push('devre dışı');
    if (el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-current') === 'page' || el.getAttribute('aria-current') === 'true') d.push('seçili');
    const ch = el.getAttribute('aria-checked') ?? el.getAttribute('aria-pressed') ?? (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio') ? String(el.checked) : null);
    if (ch === 'true') d.push('açık'); else if (ch === 'false') d.push('kapalı');
    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.value && el.type !== 'checkbox' && el.type !== 'radio') d.push(`değer: "${kisalt(el.value, 40)}"`);
    if (el.tagName === 'INPUT' && el.type === 'range') d.push(`değer ${el.value}/${el.max}`);
    return d.join(', ');
  };
  /** React'in DOM düğümüne koyduğu özellikler: onClick'li div/li (rolsüz) de dokunulabilirdir */
  const tepki = (el) => { for (const k of Object.keys(el)) if (k.startsWith('__reactProps$')) { const p = el[k]; return !!(p && (p.onClick || p.onPointerDown || p.onPointerUp || p.onTouchStart || p.onMouseDown)); } return false; };
  const adaylar = [];
  const hepsi = new Set(document.querySelectorAll(SEL));
  for (const el of document.body.querySelectorAll('*')) if (!hepsi.has(el) && el.tagName !== 'CANVAS' && tepki(el)) hepsi.add(el);
  const sirali = [...hepsi].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  for (const el of sirali) {
    const r = gorunur(el); if (!r) continue;
    const tag = el.tagName;
    const etkin = ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT', 'SUMMARY'].includes(tag) || el.hasAttribute('role');
    // kapsayıcı (kaydırma kutusu vb. tabindex/onclick) ekranın yarısından büyükse dokunulabilir sayılmaz
    if (!etkin && r.width * r.height > vw * vh * 0.5) continue;
    // düğmenin içindeki düğme (geçersiz iç içe) ya da aynı adlı iç öğe: dıştaki yeter
    let dis = el.parentElement; while (dis && !hepsi.has(dis)) dis = dis.parentElement;
    if (dis && gorunur(dis) && (['BUTTON', 'A'].includes(dis.tagName) || dis.getAttribute('role') === 'button') && dis !== el) continue;
    if (!ustte(el, r)) continue;
    const ad = adi(el);
    if (!ad && tag !== 'INPUT' && tag !== 'TEXTAREA') { if (!el.querySelector('svg,img,canvas')) continue; }
    // adı kendi yazısından geliyorsa (ve kısaysa) içindeki yazı metin bölümünde tekrar edilmez; büyük dokunulabilir kutuların
    // (ör. dokununca ilerleyen anlatıcı penceresi) yazısı metinde kalır
    const yazidan = !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && tr(el.innerText || '').length <= 80;
    adaylar.push({ el, r, ad: kisalt(ad || '(simge, adsız)', 80), rol: rolu(el), durum: durum(el), yazidan });
  }
  const dok = adaylar.map((a, i) => { a.el.setAttribute('data-oyuncu-no', String(i + 1)); return { no: i + 1, rol: a.rol, ad: a.ad, durum: a.durum }; });
  const dokEl = new Set(adaylar.filter((a) => a.yazidan).map((a) => a.el));

  // görünen metin: metin düğümleri belge sırasıyla, blok ataya göre satırlara; dokunulabilir öğelerin içi tekrar edilmez
  const blok = (n) => { for (let e = n.parentElement; e; e = e.parentElement) { const d = getComputedStyle(e).display; if (d !== 'inline' && d !== 'inline-block' && d !== 'contents') return e; } return document.body; };
  const ORTU = '.overlay,[role=dialog],[role=alertdialog],[aria-modal="true"],.sheet-wrap';
  const satirlar = []; let son = null; let cur = '';
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const rng = document.createRange();
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = tr(n.textContent || ''); if (!t) continue;
    const p = n.parentElement; if (!p || p.closest('script,style,noscript,[aria-hidden="true"]')) continue;
    let inDok = false; for (let e = p; e; e = e.parentElement) if (dokEl.has(e)) { inDok = true; break; }
    if (inDok) continue;
    rng.selectNodeContents(n); const r = rng.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
    if (!gorunur(p)) continue;
    // açık bir pencerenin/örtünün arkasında kalan metin (harita başlığı vb.) yazılmaz
    const ust = document.elementFromPoint(Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), Math.min(vh - 1, Math.max(0, r.top + r.height / 2)));
    const ort = ust?.closest(ORTU); if (ort && !ort.contains(p)) continue;
    const b = blok(n);
    const baslik = p.closest('h1,h2,h3,[role=heading]');
    if (b !== son) { if (cur) satirlar.push(cur); cur = (baslik ? '# ' : '') + t; son = b; } else cur += ' ' + t;
  }
  if (cur) satirlar.push(cur);
  const metin = []; let toplam = 0; let kesik = 0;
  for (const s of satirlar) { if (metin[metin.length - 1] === s) continue; if (toplam + s.length > maxMetin) { kesik += s.length; continue; } metin.push(s); toplam += s.length; }
  if (kesik) metin.push(`…(+${kesik} karakter daha; ekran görüntüsüne bak)`);
  for (const d of document.querySelectorAll('[role=dialog],[role=alertdialog]')) { const r = gorunur(d); const l = d.getAttribute('aria-label'); if (r && l) metin.unshift(`[pencere: ${l}]`); }

  // kaydırma: görünen en büyük kaydırılabilir kutu (ya da belge)
  let kutu = null; let alan = 0;
  for (const el of [document.scrollingElement, ...document.querySelectorAll('*')]) {
    if (!el || el.scrollHeight <= el.clientHeight + 8) continue;
    if (el !== document.scrollingElement) { const oy = getComputedStyle(el).overflowY; if (oy !== 'auto' && oy !== 'scroll') continue; }
    const r = el === document.scrollingElement ? { width: vw, height: vh } : gorunur(el); if (!r) continue;
    const a = Math.min(r.width, vw) * Math.min(r.height, vh); if (a > alan) { alan = a; kutu = el; }
  }
  const asagi = kutu ? kutu.scrollTop + kutu.clientHeight < kutu.scrollHeight - 8 : false; const yukari = kutu ? kutu.scrollTop > 8 : false;
  const tuval = [];
  for (const c of document.querySelectorAll('canvas')) { const r = gorunur(c); if (r && r.width * r.height > vw * vh * 0.15) tuval.push(`${Math.round(r.width)}×${Math.round(r.height)} @${Math.round(r.left)},${Math.round(r.top)}`); }
  const lh = document.querySelector('.level-host');
  const o = window.__odi;
  const bolum = lh ? { ad: o?.spec ? `${o.spec.number}. ${o.spec.name}` : '?', bitti: !!o?.done } : null;
  return { metin, dok, asagi, yukari, tuval, bolum };
}

/** kaydırma: ekranın ortasındaki en yakın kaydırılabilir kutu (yoksa belge) — tuvalde (harita) tekerlek olayı ayrıca gönderilir */
export function kaydirKutu({ yon }) {
  const vw = innerWidth; const vh = innerHeight;
  let el = document.elementFromPoint(vw / 2, vh / 2);
  for (; el; el = el.parentElement) { const oy = getComputedStyle(el).overflowY; if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 8) break; }
  const k = el ?? document.scrollingElement; const once = k.scrollTop;
  k.scrollBy({ top: (yon === 'asagi' ? 1 : -1) * Math.round(k.clientHeight * 0.75), behavior: 'instant' });
  return { kaydi: k.scrollTop !== once, tuval: document.elementFromPoint(vw / 2, vh / 2)?.tagName === 'CANVAS' };
}
