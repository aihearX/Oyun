import Phaser from 'phaser';
import type { BuildingId, CampState } from '@odi/shared';
import { CampScene, type CampSceneOpts, type CampTeam } from './CampScene';

export type { CampSceneOpts as CampOptions, CampTeam } from './CampScene';
export { buildingCanvas, PAINT_BOX, TIER_ACCENT } from './buildings';
export { BUILDING_ORDER, LOTS, CAMP_TIER_NAMES, ZONE_LEVELS, DEPOT_CAP_H, DEPOT_RATE, activeBuild, depotStored, levelOf, tierChanged, tierOf, zonesOpen } from './layout';

/** etkileşimde 60 fps; 6 sn dokunuş yoksa 30 fps (animasyonlar sürer, işlemci yarıya iner) */
const ACTIVE_FPS = 61, IDLE_FPS = 30, IDLE_AFTER_MS = 6000;

export interface CampHandle {
  /** canlı güncelleme: kamp durumu, takım, yardım istenebilirliği */
  update(p: { camp?: CampState; team?: CampTeam | null; canAskHelp?: boolean }): void;
  /** takım arkadaşı yardım etti (camp.helped) */
  helped(id: BuildingId, seconds: number): void;
  /** depo toplandı: jeton fışkırması */
  collected(amount: number): void;
  /** binanın ekrandaki noktası (CSS px, sayfa koordinatı) */
  screenPos(id: BuildingId): { x: number; y: number } | null;
  bounce(id: BuildingId): void;
  /** binaya kaydır (above: alttaki panel için binayı üste al) */
  focus(id: BuildingId, above?: boolean): void;
  /** kamera merkezi ve yakınlaştırma (test/hata ayıklama) */
  view(): { x: number; y: number; zoom: number } | null;
  /** panel kapanınca kamerayı önceki yerine döndür */
  unfocus(): void;
  /** döngüyü uyut/uyandır (ekranda değilken) */
  sleep(on: boolean): void;
  destroy(): void;
}

/**
 * Kulak Kampı üs sahnesini verilen DOM öğesinde başlatır (öğe boyutunu doldurur; boyut değişimini izler).
 * Keskinlik için kanvas aygıt pikselinde çizilir (en çok 2×), CSS ile küçültülür.
 */
export function startCamp(parent: HTMLElement, opts: CampSceneOpts): CampHandle {
  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const size = () => ({ w: Math.max(1, Math.round(parent.clientWidth * dpr)), h: Math.max(1, Math.round(parent.clientHeight * dpr)) });
  const s0 = size();
  const scene = new CampScene(opts);
  let pending: (() => void)[] = [];
  const userReady = opts.onReady;
  scene.opts.onReady = () => { for (const f of pending) f(); pending = []; userReady?.(); };
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: s0.w, height: s0.h, backgroundColor: '#1b1446', banner: false,
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
    input: { activePointers: 3, touch: { capture: true } }, render: { antialias: true, pixelArt: false, roundPixels: false, powerPreference: 'high-performance' },
    audio: { noAudio: true }, fps: { target: 60, min: 20, limit: ACTIVE_FPS },
    disablePreFX: true, disablePostFX: true, // kullanılmayan FX boru hatlarının gizli çizim hedefleri (bellek)
    scene: [scene],
    callbacks: { preBoot: (g) => g.registry.set('dpr', dpr) },
  });
  const canvasStyle = () => { const c = game.canvas; if (c) { c.style.touchAction = 'none'; c.style.display = 'block'; } };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (!game.isBooted || !game.canvas) return; const s = size(); if (s.w !== game.scale.width || s.h !== game.scale.height) game.scale.resize(s.w, s.h); }) : null;
  ro?.observe(parent);
  const run = (f: () => void) => { if (scene.ready) f(); else pending.push(f); };
  game.events.once('ready', canvasStyle);
  // güç tasarrufu: dokunuş yokken kare hızı düşer; sayfa gizliyken döngü uyur
  let lastActive = performance.now();
  const setRate = (fps: number) => { const l = game.loop as unknown as { _limitRate: number } | undefined; if (l) l._limitRate = 1000 / fps; };
  const boost = (ms = 0) => { lastActive = Math.max(lastActive, performance.now() + ms); setRate(ACTIVE_FPS); };
  const onInput = () => boost();
  for (const ev of ['pointerdown', 'pointermove', 'wheel', 'touchstart'] as const) parent.addEventListener(ev, onInput, { passive: true });
  const idleTimer = setInterval(() => { if (performance.now() - lastActive > IDLE_AFTER_MS) setRate(IDLE_FPS); }, 1000);
  const onVis = () => { if (!game.loop) return; if (document.hidden) game.loop.sleep(); else { game.loop.wake(); boost(); } };
  document.addEventListener('visibilitychange', onVis);
  let dead = false;
  return {
    update: (p) => run(() => { if (p.camp) boost(4000); if (p.team !== undefined) scene.setTeam(p.team); if (p.canAskHelp !== undefined) scene.setCanAskHelp(p.canAskHelp); if (p.camp) scene.applyState(p.camp); }),
    helped: (id, seconds) => run(() => { boost(3000); scene.helped(id, seconds); }),
    collected: (n) => run(() => { boost(3000); scene.collected(n); }),
    screenPos: (id) => {
      if (!scene.ready || !game.canvas) return null; const p = scene.screenPoint(id); if (!p) return null;
      const r = game.canvas.getBoundingClientRect(); return { x: r.left + p.x / dpr, y: r.top + p.y / dpr };
    },
    bounce: (id) => run(() => scene.bounce(id)),
    view: () => { if (!scene.ready) return null; const c = scene.cameras.main; return { x: c.midPoint.x, y: c.midPoint.y, zoom: scene.userZoom }; },
    unfocus: () => run(() => { boost(1200); scene.unfocus(); }),
    focus: (id, above) => run(() => { boost(1500); scene.focus(id, above); }),
    sleep: (on) => { if (!game.loop) return; if (on) game.loop.sleep(); else { game.loop.wake(); boost(); } },
    destroy: () => { if (dead) return; dead = true; ro?.disconnect(); clearInterval(idleTimer); document.removeEventListener('visibilitychange', onVis); for (const ev of ['pointerdown', 'pointermove', 'wheel', 'touchstart'] as const) parent.removeEventListener(ev, onInput); try { game.destroy(true); } catch { /* yok */ } },
  };
}
