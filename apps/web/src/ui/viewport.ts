/**
 * Görünüm yardımcıları.
 * Belge kaydırılmaz; uygulamanın tek kaydırma kabı #root'tur (styles.css). Ekran geçişinde başa dönmek ve
 * klavye açıkken alttaki payı (--kb) bilmek için buradaki yardımcılar kullanılır.
 */
export function appScroller(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.getElementById('root');
}

/** ekran değişince en üste dön (kap + güvenlik için belge) */
export function scrollAppTop(): void {
  try { const r = appScroller(); if (r) r.scrollTop = 0; } catch { /* yok */ }
  try { window.scrollTo(0, 0); } catch { /* yok */ }
}

/**
 * Klavye: görsel görünüm küçülünce kapanan alt pay --kb (px) olarak yazılır, 80 px'ten büyükse html.kb-open.
 * iOS klavye açarken belgeyi kaydırabilir (yerel kaydırma kilitliyken bile); sabit düzen kaymasın diye geri alınır.
 */
export function installViewport(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const vv = window.visualViewport; const de = document.documentElement;
  if (!vv) return () => undefined;
  let last = -1;
  const on = () => {
    const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    if (kb !== last) {
      last = kb;
      de.style.setProperty('--kb', `${kb}px`);
      de.classList.toggle('kb-open', kb > 80);
    }
    if (kb > 80 && (window.scrollY || vv.offsetTop)) window.scrollTo(0, 0);
  };
  on();
  vv.addEventListener('resize', on); vv.addEventListener('scroll', on);
  return () => { vv.removeEventListener('resize', on); vv.removeEventListener('scroll', on); };
}
