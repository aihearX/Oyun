// Kamp üst bandı (başlık + gösterge çipleri) ekrana sığıyor mu? Tarayıcıda çalışır (page.evaluate(measureHudFit)).
// Her çip ekranın içinde (0..innerWidth) olmalı ve kaydırma/gizleme kabı tarafından kırpılmamalı; .camp-hud yatay kaydırmamalı.
// ui-mobile-check.mjs her ekranda, camp-e2e.mjs ziyaret kipinde kullanır (docs/14-kamp.md §7).
export function measureHudFit() {
  const top = document.querySelector('.camp-top');
  if (!top || top.getBoundingClientRect().width === 0) return { present: false, offenders: [] };
  const W = window.innerWidth; const off = [];
  const name = (el) => (el.getAttribute('aria-label') || el.textContent || el.className || el.tagName).toString().trim().replace(/\s+/g, ' ').slice(0, 40);
  const items = top.querySelectorAll('.camp-hud > *, .topbar2 > *, .tb-pills > *, .camp-demo-tag, .visit-bar > *');
  for (const el of items) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.left < -0.5 || r.right > W + 0.5) { off.push(`${name(el)} [${Math.round(r.left)}..${Math.round(r.right)} / ${W}]`); continue; }
    // kırpan ata (overflow ≠ visible) varsa çip onun içinde kalmalı
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const ar = a.getBoundingClientRect();
      if (r.left < ar.left - 0.5 || r.right > ar.right + 0.5) { off.push(`${name(el)} kırpılıyor (${a.className || a.tagName})`); break; }
    }
  }
  for (const h of top.querySelectorAll('.camp-hud')) if (h.scrollWidth > h.clientWidth + 1) off.push(`.camp-hud yatay kayıyor (${h.scrollWidth} > ${h.clientWidth})`);
  return { present: true, offenders: off };
}
