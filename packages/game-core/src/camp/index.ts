import Phaser from 'phaser';
import type { BuildingId, CampState } from '@odi/shared';
import { CampScene, type CampSceneOpts, type CampTeam } from './CampScene';

export type { CampSceneOpts as CampOptions, CampTeam } from './CampScene';
export { buildingCanvas, PAINT_BOX, TIER_ACCENT } from './buildings';
export { BUILDING_ORDER, LOTS, CAMP_TIER_NAMES, ZONE_LEVELS, DEPOT_CAP_H, DEPOT_RATE, activeBuild, depotStored, levelOf, tierChanged, tierOf, zonesOpen } from './layout';

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
  focus(id: BuildingId): void;
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
    audio: { noAudio: true }, fps: { target: 60, min: 20 },
    scene: [scene],
    callbacks: { preBoot: (g) => g.registry.set('dpr', dpr) },
  });
  const canvasStyle = () => { const c = game.canvas; if (c) { c.style.touchAction = 'none'; c.style.display = 'block'; } };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (!game.isBooted || !game.canvas) return; const s = size(); if (s.w !== game.scale.width || s.h !== game.scale.height) game.scale.resize(s.w, s.h); }) : null;
  ro?.observe(parent);
  const run = (f: () => void) => { if (scene.ready) f(); else pending.push(f); };
  game.events.once('ready', canvasStyle);
  let dead = false;
  return {
    update: (p) => run(() => { if (p.team !== undefined) scene.setTeam(p.team); if (p.canAskHelp !== undefined) scene.setCanAskHelp(p.canAskHelp); if (p.camp) scene.applyState(p.camp); }),
    helped: (id, seconds) => run(() => scene.helped(id, seconds)),
    collected: (n) => run(() => scene.collected(n)),
    screenPos: (id) => {
      if (!scene.ready || !game.canvas) return null; const p = scene.screenPoint(id); if (!p) return null;
      const r = game.canvas.getBoundingClientRect(); return { x: r.left + p.x / dpr, y: r.top + p.y / dpr };
    },
    bounce: (id) => run(() => scene.bounce(id)),
    focus: (id) => run(() => scene.focus(id)),
    destroy: () => { if (dead) return; dead = true; ro?.disconnect(); try { game.destroy(true); } catch { /* yok */ } },
  };
}
