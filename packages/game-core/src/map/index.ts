import Phaser from 'phaser';
import { MapScene } from './MapScene';
import type { MapHandle, MapOptions } from './types';

export * from './layout';
export * from './types';
export { ZONE_PLACE, zoneName } from './paint';

/**
 * Yaşayan Kulak Haritası'nı verilen DOM ebeveyninde başlatır (tam ekran, yüksek DPI net).
 * Kapatınca oyun, dokular ve dinleyiciler tamamen yok edilir.
 */
export function startMap(parent: HTMLElement, opts: MapOptions): MapHandle {
  // hafif mod: otomasyon tarayıcısı (test) ya da azaltılmış hareket (opts.light ile açıkça seçilebilir)
  const light = opts.light ?? (!!opts.reducedMotion || (typeof navigator !== 'undefined' && navigator.webdriver === true));
  // DPI en çok 2: 3 kat çözünürlükte harita dokuları iPhone WebView'inin bellek sınırını aşıp sayfayı çökertiyordu (fark gözle seçilmiyor)
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const size = () => ({ w: Math.max(1, Math.round(parent.clientWidth * dpr)), h: Math.max(1, Math.round(parent.clientHeight * dpr)) });
  const s0 = size();
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: s0.w, height: s0.h, backgroundColor: '#140c35', transparent: false,
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
    render: { antialias: true, pixelArt: false, roundPixels: false, powerPreference: 'high-performance' },
    input: { activePointers: 1 }, fps: { target: 60, min: 20, limit: 62 }, banner: false, audio: { noAudio: true },
    // Phaser'ın hazır FX boru hatları kullanılmıyor; açık kalırsa ekran boyutunda ~20 gizli çizim hedefi ayırıp belleği şişiriyor
    disablePreFX: true, disablePostFX: true,
    scene: [],
    callbacks: { preBoot: (g) => { g.registry.set('mapOpts', opts); g.registry.set('dpr', dpr); g.registry.set('light', light); } },
  });
  game.scene.add('map', MapScene, true);
  const scene = () => { const s = game.scene.getScene('map') as MapScene | null; return s && s.sys?.isActive() ? s : null; };
  let ro: ResizeObserver | null = null;
  try { ro = new ResizeObserver(() => { const s = size(); if (s.w !== game.scale.width || s.h !== game.scale.height) game.scale.resize(s.w, s.h); }); ro.observe(parent); } catch { /* yok */ }
  // uyuyan döngüyü dokunuşla uyandır (Phaser girişi döngüde işlenir); sayfa gizliyken uyu
  const poke = () => scene()?.poke();
  parent.addEventListener('pointerdown', poke, { capture: true, passive: true }); parent.addEventListener('wheel', poke, { capture: true, passive: true });
  const vis = () => { if (document.visibilityState === 'hidden') { try { game.loop.sleep(); } catch { /* yok */ } } else { try { game.loop.wake(); } catch { /* yok */ } poke(); } };
  document.addEventListener('visibilitychange', vis);
  let dead = false;
  return {
    destroy: () => { if (dead) return; dead = true; ro?.disconnect(); document.removeEventListener('visibilitychange', vis); parent.removeEventListener('pointerdown', poke, { capture: true }); parent.removeEventListener('wheel', poke, { capture: true }); try { game.destroy(true); } catch { /* yok sayılır */ } },
    setSocial: (s) => { opts.social = s; scene()?.setSocial(s); },
    update: (stars, treasures) => { opts.stars = stars; opts.treasuresOpen = treasures; scene()?.updateProgress(stars, treasures); },
    focusCurrent: (a = true) => scene()?.focusCurrent(a),
    speedUp: () => scene()?.speedUp(),
    setHeroColor: (c) => { opts.hero = { ...opts.hero, color: c }; scene()?.setHeroColor(c); },
  };
}
