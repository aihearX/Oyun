import Phaser from 'phaser';
import type { LevelHandle, LevelOptions } from './bridge';
import { LevelScene } from './LevelScene';
import { setSoundsEnabled } from './audio';
import { levelView, levelZoom, ZOOM_MAX, ZOOM_MAX_SHOT, type ViewSize } from './view';

/** Bir bölümü verilen DOM ebeveyninde başlatır. Tek sahne, tek Phaser.Game; kapatınca tamamen yok edilir. */
export function startLevel(parent: HTMLElement | string, opts: LevelOptions): LevelHandle {
  setSoundsEnabled(opts.sounds !== false);
  const el = typeof parent === 'string' ? (typeof document !== 'undefined' ? document.getElementById(parent) : null) : parent;
  const css = () => {
    const w = el?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 0); const h = el?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 0);
    return { w, h };
  };
  // görünüm: uzun/geniş ekranda kenar bandı yerine kamera fazladan payı gösterir (oyun alanı 390×780 aynı; view.ts)
  const c0 = css(); let view: ViewSize = levelView(c0.w, c0.h);
  // keskinlik: tuval cihaz piksel oranını izler (CSS pikseli başına dpr piksel), tasarım pikseli başına en çok 2 (bellek: dokular da bu
  // çözünürlükte üretilir — view.ts ZOOM_MAX); bot/harness 1 (yazılım GL'de hız); renderScale (harness/pazarlama çekimi) oranı zorlar (1–3).
  // Yakınlaştırma açılışta sabitlenir; sonraki boyut değişimlerinde yalnız görünüm değişir.
  const ratio = opts.renderScale ? Math.max(1, Math.min(3, opts.renderScale)) : opts.bot ? 1 : Math.max(1, Math.min(4, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
  const zoom = levelZoom(c0.w, c0.h, view, ratio, opts.renderScale ? ZOOM_MAX_SHOT : ZOOM_MAX);
  const px = (v: ViewSize) => ({ w: Math.round(v.w * zoom), h: Math.round(v.h * zoom) });
  const g0 = px(view);
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: g0.w, height: g0.h, backgroundColor: '#140c35',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1400 }, debug: false } },
    input: { activePointers: 2 }, render: { antialias: true, pixelArt: false, roundPixels: false },
    fps: { target: 60, min: opts.bot ? 10 : 30 },
    disablePreFX: true, disablePostFX: true, // kullanılmayan FX boru hatlarının gizli çizim hedefleri (bellek)
    scene: [LevelScene],
    callbacks: { preBoot: (g) => { g.registry.set('opts', opts); g.registry.set('dpr', zoom); } },
  });
  // ebeveyn boyutu değişince (döndürme, tarayıcı penceresi, çekim aracının görünüm değişimi) görünüm yeniden hesaplanır;
  // güvenli alan payı da değişmiş olabilir (geç gelen yerel inset): sahne kendisi bakar, değişen yoksa bir şey yapmaz
  const relayout = () => {
    const c = css(); const v = levelView(c.w, c.h);
    // Phaser ebeveyn ölçüsünü kendi adımında (en geç 0,5 sn) yeniler; setGameSize eski ölçüyle sığdırmasın diye önce okunur
    if (v.w !== view.w || v.h !== view.h) { const g = px(v); try { game.scale.getParentBounds(); game.scale.setGameSize(g.w, g.h); view = v; } catch { return; } }
    const s = game.scene.getScene('level') as LevelScene | null; s?.onViewResize?.();
  };
  let ro: ResizeObserver | null = null;
  try { if (el && typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(relayout); ro.observe(el); } } catch { /* yok */ }
  if (typeof window !== 'undefined') window.addEventListener('resize', relayout);
  return {
    destroy: () => { ro?.disconnect(); if (typeof window !== 'undefined') window.removeEventListener('resize', relayout); try { game.destroy(true); } catch { /* yok sayılır */ } },
    pause: () => { const s = game.scene.getScene('level'); if (s && game.scene.isActive('level')) { s.scene.pause(); } },
    resume: () => { const s = game.scene.getScene('level'); if (s && game.scene.isPaused('level')) { s.scene.resume(); } },
    end: (reason) => { const s = game.scene.getScene('level') as LevelScene | null; if (s?.state && !s.state.finished) { if (game.scene.isPaused('level')) s.scene.resume(); s.fail(reason); } },
  };
}
