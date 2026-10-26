import Phaser from 'phaser';
import type { BuildingId, CampState } from '@odi/shared';
import { CampScene, type CampSceneOpts, type CampTeam } from './CampScene';

export type { CampSceneOpts as CampOptions, CampTeam } from './CampScene';
export { buildingCanvas, PAINT_BOX, TIER_ACCENT } from './buildings';
export { MONUMENT_ORDER, MONUMENT_SPOTS, MONUMENT_TINT, paintMonument } from './monuments';
export { decorCanvas, DECOR_BOX } from './decor';
export { BUILDING_ORDER, MAIN_BUILDINGS, DISTRICT_BUILDINGS, LOTS, CAMP_TIER_NAMES, ZONE_LEVELS, DEPOT_CAP_H, DEPOT_RATE, activeBuild, depotStored, levelOf, tierChanged, tierOf, zonesOpen } from './layout';

/** etkileşimde 60 fps; 6 sn dokunuş yoksa 30 fps (animasyonlar sürer, işlemci yarıya iner) */
const ACTIVE_FPS = 61, IDLE_FPS = 30, IDLE_AFTER_MS = 6000;

export interface CampHandle {
  /** canlı güncelleme: kamp durumu, takım, yardım istenebilirliği */
  update(p: { camp?: CampState; team?: CampTeam | null; canAskHelp?: boolean; /** ulaşılan bölgeler (anıtlar) ve kutlanacak yeni anıt */ regions?: string[]; celebrate?: string | null }): void;
  /** Tedavi Odası rafı toplandı: damlalar uçar */
  remediesCollected(n: number): void;
  /** anıtın ekrandaki noktası (CSS px, sayfa koordinatı; test ve kutlama) */
  monumentPos(region: string): { x: number; y: number } | null;
  /** takım arkadaşı yardım etti (camp.helped) */
  helped(id: BuildingId, seconds: number): void;
  /** depo toplandı: jeton fışkırması */
  collected(amount: number): void;
  /** binanın ekrandaki noktası (CSS px, sayfa koordinatı) */
  screenPos(id: BuildingId): { x: number; y: number } | null;
  /** kamera duruyor mu (odak geçişi, atalet bitti; test: dokunmadan önce konum kararlı olsun) */
  still(): boolean;
  bounce(id: BuildingId): void;
  /** binaya kaydır (above: alttaki panel için binayı üste al) */
  focus(id: BuildingId, above?: boolean): void;
  /** kamera merkezi ve yakınlaştırma (test/hata ayıklama) */
  view(): { x: number; y: number; zoom: number } | null;
  /** panel kapanınca kamerayı önceki yerine döndür */
  unfocus(): void;
  /** Kütüphane okuma köşesi toplandı */
  libCollected(n: number): void;
  /** süsleme kipi aç/kapat */
  setEdit(on: boolean): void;
  /** hayalet süs (yeni yerleştirme ya da uid ile taşıma); null kaldırır. Dönüş: hücre ve uygunluk */
  setGhost(g: { id: string; flip: boolean; uid?: number; gx?: number; gy?: number } | null): { gx: number; gy: number; ok: boolean } | null;
  flipGhost(): boolean;
  /** hayaleti hücreye taşı (dokunulan yere) */
  moveGhost(gx: number, gy: number): { gx: number; gy: number; ok: boolean } | null;
  ghostState(): { id: string; gx: number; gy: number; flip: boolean; ok: boolean; uid?: number } | null;
  selectDecor(uid: number | null): void;
  /** yeni yerleşen süse parıltı */
  decorPlaced(uid: number): void;
  /** süsün / hayaletin / bölgenin ekrandaki noktası (CSS px, sayfa koordinatı; test) */
  decorPos(uid: number): { x: number; y: number } | null;
  ghostPos(): { x: number; y: number } | null;
  districtPos(id: string): { x: number; y: number } | null;
  focusDistrict(id: string): void;
  openDistricts(): string[];
  /** doku belleği (test): doku sayısı ve kaba toplam (MB, RGBA) */
  mem(): { textures: number; mb: number };
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
  // dokunuş koordinatları: tuval sayfada kaydıysa (ekran geçişi, üst şerit) Phaser'ın önbellekli sınırları eskir → dokunuştan hemen önce tazele
  const onDown = () => { try { if (game.isBooted) game.scale.updateBounds(); } catch { /* yok */ } };
  for (const ev of ['pointerdown', 'touchstart', 'mousedown'] as const) parent.addEventListener(ev, onDown, { capture: true, passive: true });
  const idleTimer = setInterval(() => { if (performance.now() - lastActive > IDLE_AFTER_MS) setRate(IDLE_FPS); }, 1000);
  const onVis = () => { if (!game.loop) return; if (document.hidden) game.loop.sleep(); else { game.loop.wake(); boost(); } };
  document.addEventListener('visibilitychange', onVis);
  let dead = false;
  /** oyun pikseli → sayfa CSS pikseli */
  const page = (p: { x: number; y: number } | null) => { if (!p || !game.canvas) return null; const r = game.canvas.getBoundingClientRect(); return { x: r.left + p.x / dpr, y: r.top + p.y / dpr }; };
  return {
    update: (p) => run(() => { if (p.camp) boost(4000); if (p.team !== undefined) scene.setTeam(p.team); if (p.canAskHelp !== undefined) scene.setCanAskHelp(p.canAskHelp); if (p.camp) scene.applyState(p.camp); if (p.regions) { boost(4000); scene.setRegions(p.regions, p.celebrate); } }),
    remediesCollected: (n) => run(() => { boost(3000); scene.remediesCollected(n); }),
    monumentPos: (region) => {
      if (!scene.ready || !game.canvas) return null; const p = scene.monumentPoint(region); if (!p) return null;
      const r = game.canvas.getBoundingClientRect(); return { x: r.left + p.x / dpr, y: r.top + p.y / dpr };
    },
    helped: (id, seconds) => run(() => { boost(3000); scene.helped(id, seconds); }),
    collected: (n) => run(() => { boost(3000); scene.collected(n); }),
    screenPos: (id) => {
      if (!scene.ready || !game.canvas) return null; const p = scene.screenPoint(id); if (!p) return null;
      const r = game.canvas.getBoundingClientRect(); return { x: r.left + p.x / dpr, y: r.top + p.y / dpr };
    },
    still: () => scene.ready && scene.camStill(),
    bounce: (id) => run(() => scene.bounce(id)),
    libCollected: (n) => run(() => { boost(3000); scene.libCollected(n); }),
    setEdit: (on) => run(() => { boost(2000); scene.setEdit(on); }),
    setGhost: (g) => { if (!scene.ready) return null; boost(3000); return scene.setGhost(g); },
    flipGhost: () => { if (!scene.ready) return false; boost(1000); return scene.flipGhost(); },
    moveGhost: (gx, gy) => { if (!scene.ready) return null; boost(1500); return scene.moveGhost(gx, gy); },
    ghostState: () => (scene.ready ? scene.ghostState() : null),
    selectDecor: (uid) => run(() => { boost(1500); scene.selectDecor(uid); }),
    decorPlaced: (uid) => run(() => { boost(2000); scene.decorPlaced(uid); }),
    decorPos: (uid) => page(scene.ready ? scene.decorPoint(uid) : null),
    ghostPos: () => page(scene.ready ? scene.ghostPoint() : null),
    districtPos: (id) => page(scene.ready ? scene.districtPoint(id) : null),
    focusDistrict: (id) => run(() => { boost(1500); scene.focusDistrict(id); }),
    openDistricts: () => (scene.ready ? scene.openDistricts() : []),
    mem: () => {
      let bytes = 0, n = 0;
      for (const key of game.textures.getTextureKeys()) { const t = game.textures.get(key); for (const src of t.source) { bytes += (src.width || 0) * (src.height || 0) * 4; } n++; }
      return { textures: n, mb: Math.round((bytes / 1048576) * 10) / 10 };
    },
    view: () => { if (!scene.ready) return null; const c = scene.cameras.main; return { x: c.midPoint.x, y: c.midPoint.y, zoom: scene.userZoom }; },
    unfocus: () => run(() => { boost(1200); scene.unfocus(); }),
    focus: (id, above) => run(() => { boost(1500); scene.focus(id, above); }),
    sleep: (on) => { if (!game.loop) return; if (on) game.loop.sleep(); else { game.loop.wake(); boost(); } },
    destroy: () => { if (dead) return; dead = true; ro?.disconnect(); clearInterval(idleTimer); document.removeEventListener('visibilitychange', onVis); for (const ev of ['pointerdown', 'pointermove', 'wheel', 'touchstart'] as const) parent.removeEventListener(ev, onInput); for (const ev of ['pointerdown', 'touchstart', 'mousedown'] as const) parent.removeEventListener(ev, onDown, { capture: true }); try { game.destroy(true); } catch { /* yok */ } },
  };
}
