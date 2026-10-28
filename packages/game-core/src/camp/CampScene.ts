import Phaser from 'phaser';
import type { BuildingId, BuildingState, CampState } from '@odi/shared';
import { buildingCanvas, type Anchors } from './buildings';
import { BRIDGE, GROUND_BOX, ISLAND, ROADS, STREAM_PTS, onIsland, paintGround, paintSky, shoreK } from './ground';
import { BUILDING_ORDER, LOTS, MAIN_BUILDINGS, campZoom, depotStored, tierOf, zonesOpen } from './layout';
import { ATLAS, TEX, WORKER_COLORS, buildAtlas, makeTex, scaffold, worker } from './props';
import { MONUMENT_BOX, MONUMENT_SPOTS, MONUMENT_TINT, paintMonument } from './monuments';
import { DISTRICTS, cellFree, depotCapHours, cellPoint, decorById, footprint, inDistrict, libStored, pointCell, remedyById, remedyShelf, taramaFactor, type District } from '@odi/content';
import type { BiomeId, DecorPlaced } from '@odi/shared';
import { bridgeBox, districtBox, paintBridge, paintDistrict, paintDistrictLocked } from './districts';
import { DECOR_BOX, paintDecor } from './decor';
import { HELPER_COLORS } from './props';
import { FLASH, safeFlashColor, setFlashPolicy, takeFlash } from '../render/flash';

export interface CampTeam { emblem: string; name: string }
export interface CampSceneOpts {
  camp: CampState;
  /** sunucu saatine eşitlenmiş şimdi (ms) */
  now(): number;
  team: CampTeam | null;
  /** süren inşaat için takımdan yardım istenebilir mi (takım var ve henüz istenmedi) */
  canAskHelp: boolean;
  reducedMotion?: boolean;
  onTap(id: BuildingId): void;
  onAskHelp(id: BuildingId): void;
  onSpeedup(id: BuildingId): void;
  onCollect(): void;
  /** inşaat bitti (sahnede bitiş animasyonu oynadıktan hemen sonra) */
  onBuilt(id: BuildingId, level: number, tierUp: boolean): void;
  onReady?(): void;
  /** oyuncunun Odi rengi (0xRRGGBB): ilk işçi oyuncunun kendisidir, bu renkle çizilir */
  heroColor?: number;
  /** haritada ulaşılan bölgeler: her biri için ön kıyıdaki "Kulak Yolu"nda bir anıt (docs/14-kamp.md) */
  regions?: string[];
  /** anıta (ya da boş kaideye) dokunuldu; fresh: yeni yükselen anıtın kutlaması bitti */
  onMonument?(region: string, fresh: boolean): void;
  /** Tedavi Odası rafındaki hazır malzemeleri çantaya al */
  onCollectRemedy?(): void;
  /** salt okunur (başka oyuncunun kampını gezme): inşaat düğmeleri, toplama baloncukları yok */
  readOnly?: boolean;
  /** yerleştirilmiş süse dokunuldu (normal kipte: bilgi) */
  onDecor?(id: string, uid: number): void;
  /** süsleme kipinde dokunuş: süs (uid) ya da boş yer (null) */
  onEditTap?(uid: number | null, cell: [number, number]): void;
  /** süsleme kipinde hayalet süs taşındı */
  onGhost?(g: { gx: number; gy: number; ok: boolean }): void;
  /** Kütüphane okuma köşesindeki Kamp XP'yi al */
  onCollectLib?(): void;
  /** kilitli bölgenin tabelasına dokunuldu */
  onDistrict?(id: string): void;
}
interface DView { d: District; open: boolean; img?: Phaser.GameObjects.Image; key?: string; fog: Phaser.GameObjects.Image[]; sign?: Phaser.GameObjects.Container; bridge?: Phaser.GameObjects.Image; scatter: Phaser.GameObjects.Image[] }
interface Ghost { img: Phaser.GameObjects.Image; foot: Phaser.GameObjects.Graphics; id: string; gx: number; gy: number; flip: boolean; uid?: number; ok: boolean }
interface Helper { sprite: Phaser.GameObjects.Image; c: number; f: number; t: number; walking: boolean; tw?: Phaser.Tweens.Tween }

const FONT = '"SF Pro Rounded","Segoe UI Rounded",Nunito,"Helvetica Neue",Arial,sans-serif';
const GTEX = 1.25; // zemin dokusu çözünürlüğü
/** bina ölçeği (arsayı dolduracak kadar) */
const BS: Record<BuildingId, number> = { merkez: 1.25, laboratuvar: 1.15, kule: 1.12, atolye: 1.15, depo: 1.15, revir: 1.15, tedavi: 1.15, kabin: 1.15, tarama: 1.15, park: 1.15, denge: 1.15, kutuphane: 1.15 };
const DEPTH = { sky: -2000, waves: -1500, ground: -1000, fog: 4000, fx: 4500, ui: 6000 };
/** kameranın gezebileceği dünya (ana ada + bütün bölgeler; kilitliler de görünür ki hedef belli olsun) */
const WORLD = (() => {
  let x0 = -ISLAND.rx, x1 = ISLAND.rx, y0 = ISLAND.cy - ISLAND.ry, y1 = ISLAND.cy + ISLAND.ry;
  for (const d of DISTRICTS) { x0 = Math.min(x0, d.cx - d.rx); x1 = Math.max(x1, d.cx + d.rx); y0 = Math.min(y0, d.cy - d.ry); y1 = Math.max(y1, d.cy + d.ry); }
  return { x0: x0 * 0.85, x1: x1 * 0.85, y0: y0 * 0.85 - 40, y1: y1 * 0.85 };
})();
const fmtLeft = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return h > 0 ? `${h} sa ${String(m).padStart(2, '0')} dk` : `${m}:${String(sec).padStart(2, '0')}`; };
const bez = (p: [number, number][], t: number): [number, number] => { const [a, b, c] = p as [[number, number], [number, number], [number, number]]; return [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]]; };

interface BView {
  id: BuildingId; level: number; /** kutlaması sürüyor: varılacak seviye (setLevel'e kadar) */ goal?: number; key: string; sprite: Phaser.GameObjects.Image; anchors: Anchors;
  fx: Phaser.GameObjects.GameObject[]; tweens: Phaser.Tweens.Tween[]; timers: Phaser.Time.TimerEvent[];
  badge: Phaser.GameObjects.Container; badgeText: Phaser.GameObjects.Text; badgeImg: Phaser.GameObjects.Image;
  build?: { scaffold: Phaser.GameObjects.Image; crane?: Phaser.GameObjects.Image; dust: Phaser.GameObjects.Particles.ParticleEmitter; bubble: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Graphics; help: Phaser.GameObjects.Image; fast: Phaser.GameObjects.Image; to: number; tw: Phaser.Tweens.Tween[] };
}
interface Worker { sprite: Phaser.GameObjects.Image; hammer: Phaser.GameObjects.Image; color: number; busy: boolean; site: boolean; tw?: Phaser.Tweens.Tween; frameT: number; walking: boolean; /** kahraman işçinin ayrı dokusu (oyuncunun rengi) */ hero?: string; f: number }
interface Hot { owner: string; x: () => number; y: () => number; r: number; act: () => void; visible: () => boolean }

export class CampScene extends Phaser.Scene {
  opts: CampSceneOpts;
  dpr = 1;
  private groundImg?: Phaser.GameObjects.Image;
  userZoom = 1;
  ready = false;
  private views = new Map<BuildingId, BView>();
  private texMeta = new Map<string, { anchors: Anchors; ox: number; oy: number }>();
  private workers: Worker[] = [];
  private hots: Hot[] = [];
  private sky!: Phaser.GameObjects.Image;
  private waves!: Phaser.GameObjects.Graphics;
  private fog: { zone: number; img: Phaser.GameObjects.Image }[] = [];
  private decor: { zone: number; obj: Phaser.GameObjects.Image; shown: boolean; minMerkez?: number; maxMerkez?: number; covered?: boolean }[] = [];
  private campLevel = 1;
  private dviews = new Map<string, DView>();
  private decorViews = new Map<number, { img: Phaser.GameObjects.Image; id: string; gx: number; gy: number; flip: boolean }>();
  private edit = false;
  private ghostV?: Ghost;
  private dragGhost = false;
  private selRing?: Phaser.GameObjects.Graphics;
  private helpers: Helper[] = [];
  private libBubble?: { bubble: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text };
  private depot?: { bubble: Phaser.GameObjects.Container; glow: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; full: boolean };
  private teamFlag?: Phaser.GameObjects.Container;
  private monuments = new Map<string, { img: Phaser.GameObjects.Image; built: boolean; glow?: Phaser.GameObjects.Image; tw?: Phaser.Tweens.Tween }>();
  private remedyBubble?: { bubble: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text; ready: number };
  private pointers = new Map<number, { x: number; y: number; x0: number; y0: number; t0: number }>();
  private pinch: { d: number; z: number } | null = null;
  private vel = { x: 0, y: 0 };
  private moved = 0;
  private lastTick = 0;
  private merkezLevel = 1;

  constructor(opts: CampSceneOpts) { super({ key: 'camp' }); this.opts = opts; }

  create() {
    this.dpr = (this.registry.get('dpr') as number) ?? 1;
    setFlashPolicy({ reduced: !!this.opts.reducedMotion });
    const cam = this.cameras.main; cam.setBackgroundColor('#1b1446'); cam.roundPixels = false;
    buildAtlas(this.textures);
    // gökyüzü (ekrana sabit)
    makeTex(this.textures, 'c-sky', 256, 512, 0, 0, (c) => paintSky(c, 256, 512), 1);
    this.sky = this.add.image(0, 0, 'c-sky').setScrollFactor(0).setDepth(DEPTH.sky);
    this.waves = this.add.graphics().setDepth(DEPTH.waves);
    // zemin
    const gb = GROUND_BOX;
    makeTex(this.textures, 'c-ground', gb.x1 - gb.x0, gb.y1 - gb.y0, -gb.x0, -gb.y0, paintGround, GTEX);
    this.groundImg = this.add.image(gb.x0, gb.y0, 'c-ground').setOrigin(0, 0).setScale(1 / GTEX).setDepth(DEPTH.ground);
    this.campLevel = this.opts.camp.xp?.level ?? 1;
    this.placeDecor();
    this.placeDistricts();
    this.placeMonuments();
    this.placeFog();
    for (const id of MAIN_BUILDINGS) this.makeView(id, 0);
    this.ensureViews();
    this.ambient();
    this.applyState(this.opts.camp, true);
    this.setupInput();
    this.scale.on('resize', () => this.layout());
    // açılış yakınlaştırması genişlik ve yüksekliğe göre: uzun telefonda ada ekranı doldurur (layout.ts campZoom, MK-028)
    this.userZoom = campZoom(this.scale.width / this.dpr, this.scale.height / this.dpr);
    this.layout();
    cam.centerOn(0, -24);
    this.ready = true;
    this.opts.onReady?.();
  }

  // ------------------------------------------------------------------ kamera
  private layout() {
    const cam = this.cameras.main; cam.setSize(this.scale.width, this.scale.height);
    this.applyZoom();
  }
  private applyZoom() {
    const cam = this.cameras.main; cam.setZoom(this.dpr * this.userZoom);
    this.sky.setPosition(cam.width / 2, cam.height / 2).setDisplaySize(cam.width / cam.zoom + 4, cam.height / cam.zoom + 4);
    this.clampCam();
  }
  private clampCam() {
    const cam = this.cameras.main; const cx = cam.scrollX + cam.width / 2, cy = cam.scrollY + cam.height / 2;
    const B = WORLD; const nx = Phaser.Math.Clamp(cx, B.x0, B.x1), ny = Phaser.Math.Clamp(cy, B.y0, B.y1);
    if (nx !== cx || ny !== cy) { cam.scrollX += nx - cx; cam.scrollY += ny - cy; this.vel.x = 0; this.vel.y = 0; }
  }
  /** ekran noktası (oyun pikseli) sabit kalacak şekilde yakınlaştır */
  private zoomAt(z: number, sx: number, sy: number) {
    // dünya noktasını analitik hesapla (getWorldPoint önceki karenin matrisini kullanır; bir karede çok hareket gelebilir)
    const cam = this.cameras.main; const before = { x: cam.scrollX + cam.width / 2 + (sx - cam.width / 2) / cam.zoom, y: cam.scrollY + cam.height / 2 + (sy - cam.height / 2) / cam.zoom };
    this.userZoom = Phaser.Math.Clamp(z, 0.2, 1.8);
    cam.setZoom(this.dpr * this.userZoom);
    cam.scrollX = before.x - cam.width / 2 - (sx - cam.width / 2) / cam.zoom;
    cam.scrollY = before.y - cam.height / 2 - (sy - cam.height / 2) / cam.zoom;
    this.applyZoom();
  }
  /** görünümün boş (deniz / gök) payı: [top, bottom) oyun pikseli bandında, ızgara noktalarının kaçı zemin dokusuna (ana ada,
   *  bölge adaları, köprüler; sığ su halesi sayılmaz) düşmüyor. zoom: aynı merkezde başka bir yakınlaştırma (karşılaştırma).
   *  Ölçüm ve test içindir (MK-028). */
  emptyShare(top = 0, bottom = this.cameras.main.height, zoom?: number): number {
    const cam = this.cameras.main; const imgs: Phaser.GameObjects.Image[] = [];
    if (this.groundImg) imgs.push(this.groundImg);
    for (const dv of this.dviews.values()) { if (dv.img) imgs.push(dv.img); if (dv.bridge) imgs.push(dv.bridge); }
    const land = (wx: number, wy: number) => imgs.some((im) => {
      const src = im.texture.getSourceImage() as HTMLCanvasElement; const lx = (wx - im.x) / im.scaleX, ly = (wy - im.y) / im.scaleY;
      return lx >= 0 && ly >= 0 && lx < src.width && ly < src.height && (this.textures.getPixelAlpha(Math.floor(lx), Math.floor(ly), im.texture.key) ?? 0) > 128;
    });
    const t = Math.max(0, top), b = Math.min(cam.height, bottom); if (b <= t) return 0;
    const z = zoom ? this.dpr * zoom : cam.zoom;
    const NX = 30, NY = 50; let empty = 0;
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
      const sx = ((i + 0.5) / NX) * cam.width, sy = t + ((j + 0.5) / NY) * (b - t);
      if (!land(cam.scrollX + cam.width / 2 + (sx - cam.width / 2) / z, cam.scrollY + cam.height / 2 + (sy - cam.height / 2) / z)) empty++;
    }
    return empty / (NX * NY);
  }
  get uiScale() { return Phaser.Math.Clamp(1 / this.userZoom, 0.8, 1.9); }

  private setupInput() {
    const inp = this.input;
    inp.addPointer(1);
    inp.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // basış süresi DOM olay zamanlarıyla ölçülür (time.now son karenin zamanıdır: kare geç gelirse kısa dokunuş "uzun bası" sayılıp yutulurdu)
      this.pointers.set(p.id, { x: p.x, y: p.y, x0: p.x, y0: p.y, t0: p.downTime });
      this.vel.x = 0; this.vel.y = 0;
      // süsleme kipi: hayalet süsün üstünden başlayan sürükleme süsü taşır (kamera kaymaz)
      if (this.edit && this.ghostV && this.pointers.size === 1) { const w = this.cameras.main.getWorldPoint(p.x, p.y); const [gx, gy] = this.ghostCenter(); this.dragGhost = Math.hypot(w.x - gx, (w.y - (gy - 12)) * 1.2) < 34 * this.uiScale; }
      if (this.pointers.size === 1) this.moved = 0;
      if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()] as unknown as [{ x: number; y: number }, { x: number; y: number }]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.userZoom }; this.moved = 99; }
    });
    inp.on('pointermove', (p: Phaser.Input.Pointer) => {
      const s = this.pointers.get(p.id); if (!s) return;
      const dx = p.x - s.x, dy = p.y - s.y; s.x = p.x; s.y = p.y;
      const cam = this.cameras.main;
      if (this.pointers.size >= 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()] as unknown as [{ x: number; y: number }, { x: number; y: number }];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoomAt(this.pinch.z * (d / Math.max(1, this.pinch.d)), (a.x + b.x) / 2, (a.y + b.y) / 2);
        cam.scrollX -= dx / 2 / cam.zoom; cam.scrollY -= dy / 2 / cam.zoom;
        return;
      }
      this.moved = Math.max(this.moved, Math.hypot(p.x - s.x0, p.y - s.y0));
      if (this.dragGhost && this.ghostV) { const w = cam.getWorldPoint(p.x, p.y); const [gx, gy] = pointCell(w.x, w.y + 8); const sz = decorById(this.ghostV.id)?.size ?? 1; this.moveGhost(gx - (sz - 1), gy); return; }
      if (this.moved > 6 * this.dpr) { this.restoreCam = null; cam.scrollX -= dx / cam.zoom; cam.scrollY -= dy / cam.zoom; this.vel.x = dx / cam.zoom; this.vel.y = dy / cam.zoom; this.clampCam(); }
    });
    const up = (p: Phaser.Input.Pointer) => {
      const s = this.pointers.get(p.id); this.pointers.delete(p.id);
      if (this.pointers.size < 2) this.pinch = null;
      if (this.dragGhost) { this.dragGhost = false; this.moved = 99; return; }
      if (this.pointers.size === 1) { const o = [...this.pointers.values()][0]!; o.x0 = o.x; o.y0 = o.y; }
      if (s && this.pointers.size === 0 && this.moved <= 8 * this.dpr && p.upTime - s.t0 < 600) { this.vel.x = 0; this.vel.y = 0; this.tap(p.x, p.y); }
    };
    inp.on('pointerup', up); inp.on('pointerupoutside', up);
    inp.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.zoomAt(this.userZoom * (dy > 0 ? 0.9 : 1.1), p.x, p.y));
  }

  private tap(sx: number, sy: number) {
    const w = this.cameras.main.getWorldPoint(sx, sy);
    if (this.edit) { const uid = this.hitDecor(w.x, w.y); this.opts.onEditTap?.(uid, pointCell(w.x, w.y + 8)); return; }
    for (const h of [...this.hots].reverse()) if (h.visible() && Math.hypot(w.x - h.x(), w.y - h.y()) < h.r * this.uiScale) { h.act(); return; }
    const uid = this.hitDecor(w.x, w.y);
    const hit = this.hitBuilding(w.x, w.y);
    if (uid != null && (!hit || (this.decorViews.get(uid)!.img.depth > this.views.get(hit)!.sprite.depth))) { const d = this.decorViews.get(uid)!; this.bounceImg(d.img); this.opts.onDecor?.(d.id, uid); return; }
    if (hit) { this.bounce(hit); this.opts.onTap(hit); }
  }
  /** dokunulan süs (piksel saydamlığına göre; en öndeki) */
  hitDecor(wx: number, wy: number): number | null {
    const order = [...this.decorViews.entries()].filter(([, d]) => d.img.visible).sort((a, b) => b[1].img.depth - a[1].img.depth);
    for (const [uid, d] of order) {
      const s = d.img; const tex = s.texture.getSourceImage() as HTMLCanvasElement;
      let lx = (wx - s.x) / Math.abs(s.scaleX) + s.originX * tex.width; const ly = (wy - s.y) / s.scaleY + s.originY * tex.height;
      if (s.flipX) lx = tex.width - lx;
      if (lx >= 0 && ly >= 0 && lx < tex.width && ly < tex.height && (this.textures.getPixelAlpha(Math.floor(lx), Math.floor(ly), s.texture.key) ?? 0) > 30) return uid;
    }
    return null;
  }
  hitBuilding(wx: number, wy: number): BuildingId | null {
    const order = [...this.views.values()].sort((a, b) => b.sprite.depth - a.sprite.depth);
    for (const v of order) {
      const s = v.sprite; const tex = s.texture.getSourceImage() as HTMLCanvasElement;
      const lx = (wx - s.x) / s.scaleX + s.originX * tex.width, ly = (wy - s.y) / s.scaleY + s.originY * tex.height;
      if (lx >= 0 && ly >= 0 && lx < tex.width && ly < tex.height) { const a = this.textures.getPixelAlpha(Math.floor(lx), Math.floor(ly), v.key); if ((a ?? 0) > 20) return v.id; }
    }
    // arsa elmasına dokunuş
    for (const id of this.views.keys()) { const l = LOTS[id]; const h = l.tiles * 16 + 4; if (Math.abs(wx - l.x) / (h * 2) + Math.abs(wy - l.y) / h <= 1) return id; }
    return null;
  }

  override update(time: number, delta: number) {
    const cam = this.cameras.main;
    if (this.pointers.size === 0 && (Math.abs(this.vel.x) > 0.05 || Math.abs(this.vel.y) > 0.05)) {
      cam.scrollX -= this.vel.x; cam.scrollY -= this.vel.y; const k = Math.pow(0.86, delta / 16.7); this.vel.x *= k; this.vel.y *= k; this.clampCam();
    }
    // ses dalgası halkaları adanın etrafında yayılır
    const g = this.waves; g.clear();
    for (let i = 0; i < 3; i++) {
      const t = ((time / 5200) + i / 3) % 1; const k = 1.04 + t * 0.32;
      g.lineStyle(3 - t * 2, 0x9fe8ff, (1 - t) * 0.28);
      g.beginPath(); for (let j = 0; j <= 72; j++) { const a = (j / 72) * Math.PI * 2; const s = shoreK(a) * k; const x = ISLAND.cx + Math.cos(a) * ISLAND.rx * s, y = ISLAND.cy + 30 + Math.sin(a) * ISLAND.ry * s; if (j) g.lineTo(x, y); else g.moveTo(x, y); } g.strokePath();
      for (const dv of this.dviews.values()) { if (!dv.open || i > 1) continue; const d = dv.d; g.lineStyle(2.5 - t * 1.6, 0x9fe8ff, (1 - t) * 0.24); g.strokeEllipse(d.cx, d.cy + 24, d.rx * 2 * k, d.ry * 2 * k); }
    }
    // arayüz ölçeği (ekranda sabit boy)
    const us = this.uiScale;
    for (const v of this.views.values()) { v.badge.setScale(us); if (v.build) { v.build.bubble.setScale(us); } }
    if (this.depot) this.depot.bubble.setScale(us);
    if (this.remedyBubble) this.remedyBubble.bubble.setScale(us);
    if (this.libBubble) this.libBubble.bubble.setScale(us);
    for (const dv of this.dviews.values()) dv.sign?.setScale(us);
    for (const h of this.helpers) { if (!h.walking) continue; h.t += delta; if (h.t > 200) { h.t = 0; h.f = h.f ? 0 : 1; h.sprite.setFrame(`c-tuy-${h.c}-${h.f}`, false, false); } }
    // işçi yürüme kareleri
    for (const w of this.workers) { if (!w.walking) continue; w.frameT += delta; if (w.frameT > 170) { w.frameT = 0; this.workerFrame(w, w.f ? 0 : 1); } }
    if (time - this.lastTick > 250) { this.lastTick = time; this.tick(); }
  }

  /** geri sayım, ilerleme çubuğu, depo baloncuğu */
  private tick() {
    const now = this.opts.now();
    for (const v of this.views.values()) {
      const b = v.build; if (!b) continue;
      const st = this.opts.camp.buildings.find((x) => x.id === v.id);
      if (!st?.endsAt || !st.startedAt) continue;
      const left = st.endsAt - now; const total = Math.max(1, st.endsAt - st.startedAt);
      b.text.setText(left > 0 ? fmtLeft(left) : 'Bitiyor…');
      b.bar.clear(); b.bar.fillStyle(0x2d1d6e, 0.18); b.bar.fillRoundedRect(-30, -9, 60, 5, 2.5);
      b.bar.fillStyle(0x3ccf7e, 1); b.bar.fillRoundedRect(-30, -9, Math.max(5, 60 * Phaser.Math.Clamp(1 - left / total, 0, 1)), 5, 2.5);
      b.help.setVisible(!this.opts.readOnly && this.opts.canAskHelp && left > 0);
    }
    this.updateDepot(now);
    this.updateRemedy(now);
    this.updateLib(now);
  }

  // ------------------------------------------------------------------ durum
  applyState(camp: CampState, initial = false) {
    this.opts.camp = camp;
    const merkez = camp.buildings.find((b) => b.id === 'merkez')?.level ?? 1;
    const zonesBefore = zonesOpen(this.merkezLevel); this.merkezLevel = merkez;
    for (const st of camp.buildings) {
      const v = this.views.get(st.id); if (!v) continue;
      // aynı bitiş art arda birkaç durumla gelebilir (işlem yanıtı + camp.updated itmesi): kutlanmakta olan seviye tekrar kutlanmaz
      const cur = v.goal ?? v.level;
      if (st.level !== cur) {
        const up = !initial && st.level > cur; const from = cur;
        if (up) this.celebrateBuilt(v, st, from); else this.setLevel(v, st.level);
      }
      this.syncBuild(v, st);
    }
    this.updateZones(zonesBefore, initial);
    const lvBefore = this.campLevel; this.campLevel = camp.xp?.level ?? this.campLevel;
    if (this.campLevel !== lvBefore) this.updateDistricts(initial);
    this.ensureViews();
    this.syncDecor(camp.decor?.placed ?? []);
    this.syncWorkers();
    this.syncHelpers();
    this.tick();
  }
  setTeam(team: CampTeam | null) { this.opts.team = team; this.refreshTeamFlag(); }
  setCanAskHelp(v: boolean) { this.opts.canAskHelp = v; this.tick(); }

  private texFor(id: BuildingId, level: number): { key: string; anchors: Anchors; ox: number; oy: number } {
    const key = `cb-${id}-${level}`;
    if (!this.textures.exists(key)) {
      const { canvas, ox, oy, anchors } = buildingCanvas(id, level, TEX);
      this.textures.addCanvas(key, canvas); this.texMeta.set(key, { anchors, ox, oy });
    }
    const m = this.texMeta.get(key)!;
    return { key, anchors: m.anchors, ox: m.ox, oy: m.oy };
  }

  private makeView(id: BuildingId, level: number) {
    const l = LOTS[id]; const t = this.texFor(id, level);
    const img = this.add.image(l.x, l.y, t.key).setScale(BS[id] / TEX).setDepth(l.y);
    const src = img.texture.getSourceImage() as HTMLCanvasElement; img.setOrigin(t.ox / src.width, t.oy / src.height);
    const badgeImg = this.add.image(0, 0, ATLAS, 'c-badge-0').setScale(1 / TEX);
    const badgeText = this.add.text(0, -1, '', { fontFamily: FONT, fontSize: '11px', fontStyle: '900', color: '#ffffff', stroke: '#2d1d6e', strokeThickness: 2.5 }).setOrigin(0.5).setResolution(this.dpr * 1.5);
    const badge = this.add.container(l.x, l.y + l.tiles * 16 + 2, [badgeImg, badgeText]).setDepth(DEPTH.ui - 10);
    const v: BView = { id, level, key: t.key, sprite: img, anchors: t.anchors, fx: [], tweens: [], timers: [], badge, badgeText, badgeImg };
    this.views.set(id, v);
    this.setLevel(v, level);
  }

  private setLevel(v: BView, level: number) {
    const t = this.texFor(v.id, level); const old = v.key;
    v.level = level; v.goal = undefined; v.key = t.key; v.anchors = t.anchors;
    v.sprite.setTexture(t.key); const src = v.sprite.texture.getSourceImage() as HTMLCanvasElement; v.sprite.setOrigin(t.ox / src.width, t.oy / src.height);
    // bellek: önceki seviyenin dokusu artık kullanılmıyorsa bırakılır (her seviye ayrı bir tuvaldir)
    if (old !== t.key && this.textures.exists(old) && ![...this.views.values()].some((x) => x.key === old)) { this.textures.remove(old); this.texMeta.delete(old); }
    const tier = tierOf(level);
    v.badge.setVisible(level > 0); v.badgeImg.setFrame(`c-badge-${Math.max(0, tier)}`); v.badgeText.setText(String(level));
    this.rebuildFx(v);
    if (v.id === 'merkez') this.refreshTeamFlag();
    if (v.id === 'depo') this.ensureDepot();
    if (v.id === 'tedavi') this.ensureRemedy();
    if (v.id === 'kutuphane') this.ensureLib();
    if (v.id === 'park') this.syncHelpers();
  }

  /** bina efektleri: dişliler, ışıklar, duman, ses dalgası, kalp, parıltı */
  private rebuildFx(v: BView) {
    for (const o of v.fx) o.destroy(); for (const t of v.tweens) t.remove(); for (const t of v.timers) t.remove();
    v.fx = []; v.tweens = []; v.timers = [];
    if (v.level <= 0) return;
    const l = LOTS[v.id]; const a = v.anchors; const tier = tierOf(v.level); const calm = !!this.opts.reducedMotion;
    const k = BS[v.id]; const at = (p: [number, number]) => [l.x + p[0] * k, l.y + p[1] * k] as const;
    for (const [gx, gy, r] of a.gears) {
      const [x, y] = at([gx, gy]);
      const g = this.add.image(x, y, ATLAS, `c-gear-${Math.min(4, tier)}`).setScale((r * k / 11) / TEX, (r * k / 11) / TEX * 0.82).setDepth(l.y + 0.5);
      v.fx.push(g); if (!calm) v.tweens.push(this.tweens.add({ targets: g, angle: 360 * (r > 6 ? 1 : -1), duration: 2600 + r * 300, repeat: -1 }));
    }
    for (const [lx, ly, c] of a.lights) {
      const [x, y] = at([lx, ly]);
      const gl = this.add.image(x, y, ATLAS, 'c-glow').setTint(c).setBlendMode(Phaser.BlendModes.ADD).setScale(0.32 / TEX * 2).setAlpha(0.75).setDepth(l.y + 0.6);
      v.fx.push(gl); if (!calm) v.tweens.push(this.tweens.add({ targets: gl, alpha: { from: 0.35, to: 0.95 }, duration: 600 + Math.random() * 900, yoyo: true, repeat: -1, delay: Math.random() * 800, ease: 'Sine.InOut' }));
    }
    for (const s of a.smoke) {
      const [x, y] = at(s);
      const em = this.add.particles(x, y, ATLAS, { frame: 'c-puff',  lifespan: 2800, speedY: { min: -20, max: -12 }, speedX: { min: 3, max: 9 }, scale: { start: 0.18, end: 0.65 }, alpha: { start: 0.55, end: 0 }, frequency: calm ? 1400 : 520, tint: [0xe8e0ff, 0xd8cff0, 0xfff0e0] }).setDepth(l.y + 0.7);
      v.fx.push(em);
    }
    if (a.wave && !calm) {
      const [x, y] = at(a.wave);
      const ev = this.time.addEvent({ delay: 1100, loop: true, callback: () => {
        const arc = this.add.image(x, y, ATLAS, 'c-arc').setTint(tier >= 3 ? 0x7df3ff : 0xfff0c0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.4 / TEX * 2).setDepth(DEPTH.fx);
        this.tweens.add({ targets: arc, scale: 2.2 / TEX * 2, x: x + 26, alpha: { from: 0.95, to: 0 }, duration: 1700, ease: 'Sine.Out', onComplete: () => arc.destroy() });
        const arc2 = this.add.image(x, y, ATLAS, 'c-arc').setFlipX(true).setTint(0xff8fb1).setBlendMode(Phaser.BlendModes.ADD).setScale(0.4 / TEX * 2).setDepth(DEPTH.fx);
        this.tweens.add({ targets: arc2, scale: 1.8 / TEX * 2, x: x - 22, alpha: { from: 0.7, to: 0 }, duration: 1600, ease: 'Sine.Out', onComplete: () => arc2.destroy() });
      } });
      v.timers.push(ev);
    }
    if (a.heart) {
      const [x, y] = at(a.heart);
      const h = this.add.image(x, y, ATLAS, 'c-heart').setScale(0.8).setDepth(l.y + 0.8);
      v.fx.push(h); if (!calm) v.tweens.push(this.tweens.add({ targets: h, y: y - 5, scale: 0.95, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
    }
    // Kristal (Sv 16+) ve Efsane (Sv 21+): binanın altında nabız gibi atan ışık halkası
    if (tier >= 5) {
      const ring = this.add.image(l.x, l.y + 2, ATLAS, 'c-ring').setTint(tier >= 6 ? 0xffd66b : 0xb49bff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9 * l.tiles / 2 * k).setAlpha(0.5).setDepth(l.y - 1);
      v.fx.push(ring); if (!calm) v.tweens.push(this.tweens.add({ targets: ring, alpha: { from: 0.2, to: tier >= 6 ? 0.5 : 0.7 }, scale: { from: 0.85 * l.tiles / 2 * k, to: 1.05 * l.tiles / 2 * k }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
    }
    if (!calm) for (const s of a.sparkles) {
      const [x, y] = at(s);
      const sp = this.add.image(x, y, ATLAS, 'c-sparkle').setScale(0.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(l.y + 0.9).setAlpha(0);
      v.fx.push(sp); v.tweens.push(this.tweens.add({ targets: sp, alpha: { from: 0, to: 1 }, scale: { from: 0.2, to: 0.6 }, angle: 90, duration: 700, yoyo: true, repeat: -1, repeatDelay: 600 + Math.random() * 1600, delay: Math.random() * 1500 }));
    }
  }

  // ------------------------------------------------------------------ inşaat
  private syncBuild(v: BView, st: BuildingState) {
    const active = !!(st.upgradingTo && st.endsAt);
    if (!active) { if (v.build) this.removeBuild(v, false); return; }
    if (v.build && v.build.to === st.upgradingTo) return;
    if (v.build) this.removeBuild(v, false);
    const l = LOTS[v.id]; const s = v.sprite;
    const bw = v.level > 0 ? Math.min(150, s.displayWidth * 0.72) : l.tiles * 30; const bh = v.level > 0 ? Math.min(150, s.displayHeight * 0.62) : 34;
    const key = `c-scaf-${Math.round(bw / 8)}-${Math.round(bh / 8)}`;
    makeTex(this.textures, key, Math.round(bw / 8) * 8 + 8, Math.round(bh / 8) * 8 + 8, Math.round(bw / 8) * 4 + 4, Math.round(bh / 8) * 8 + 6, (c) => scaffold(c, Math.round(bw / 8) * 8, Math.round(bh / 8) * 8));
    const sc = this.add.image(l.x, l.y + l.tiles * 8, key).setOrigin(0.5, 1).setScale(1 / TEX).setDepth(l.y + 1).setAlpha(0);
    this.tweens.add({ targets: sc, alpha: 0.96, y: { from: sc.y + 10, to: sc.y }, duration: 400, ease: 'Back.Out' });
    let crane: Phaser.GameObjects.Image | undefined;
    if (v.id === 'merkez' || v.id === 'kule' || v.level >= 7) {
      crane = this.add.image(l.x + l.tiles * 18, l.y - l.tiles * 10, ATLAS, 'c-crane').setOrigin(34 / 100, 122 / 126).setScale(1 / TEX * (v.id === 'merkez' ? 1.1 : 0.85)).setDepth(l.y - l.tiles * 10);
    }
    const dust = this.add.particles(l.x, l.y + l.tiles * 6, ATLAS, { frame: 'c-puff',  lifespan: 1200, speed: { min: 8, max: 26 }, angle: { min: 190, max: 350 }, scale: { start: 0.25, end: 0.8 }, alpha: { start: 0.55, end: 0 }, tint: [0xe9d3b0, 0xd9c09a], frequency: this.opts.reducedMotion ? 1800 : 520, emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-bw / 2, -6, bw, 8), quantity: 1 } as never }).setDepth(l.y + 2);
    // geri sayım baloncuğu + yardım + hızlandırıcı
    const topY = s.y - s.originY * s.displayHeight;
    const bg = this.add.image(0, 0, ATLAS, 'c-bubble').setScale(1 / TEX).setOrigin(0.5, 1);
    const text = this.add.text(0, -24, '', { fontFamily: FONT, fontSize: '14px', fontStyle: '900', color: '#2d1d6e' }).setOrigin(0.5, 0.5).setResolution(this.dpr * 1.5);
    const bar = this.add.graphics();
    const help = this.add.image(-50, -16, ATLAS, 'c-btn-help').setScale(1 / TEX);
    const fast = this.add.image(50, -16, ATLAS, 'c-btn-fast').setScale(1 / TEX);
    const bubble = this.add.container(l.x, Math.min(topY, l.y - 40) - 6, [bg, bar, text, help, fast]).setDepth(DEPTH.ui);
    const tw = [
      this.tweens.add({ targets: help, scale: { from: 1 / TEX, to: 1.15 / TEX }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' }),
      this.tweens.add({ targets: crane ?? sc, angle: crane ? { from: -4, to: 5 } : 0, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.InOut' }),
    ];
    bubble.setScale(0.2); this.tweens.add({ targets: bubble, scale: this.uiScale, duration: 350, ease: 'Back.Out' });
    v.build = { scaffold: sc, crane, dust, bubble, text, bar, help, fast, to: st.upgradingTo!, tw };
    const id = v.id;
    const owner = `build:${id}`;
    if (this.opts.readOnly) { help.setVisible(false); fast.setVisible(false); this.syncWorkers(); return; }
    this.hots.push({ owner, x: () => bubble.x - 50 * this.uiScale, y: () => bubble.y - 16 * this.uiScale, r: 18, act: () => this.opts.onAskHelp(id), visible: () => help.visible });
    this.hots.push({ owner, x: () => bubble.x + 50 * this.uiScale, y: () => bubble.y - 16 * this.uiScale, r: 18, act: () => this.opts.onSpeedup(id), visible: () => true });
    this.hots.push({ owner, x: () => bubble.x, y: () => bubble.y - 18 * this.uiScale, r: 30, act: () => { this.bounce(id); this.opts.onTap(id); }, visible: () => true });
    this.syncWorkers();
  }
  private removeBuild(v: BView, animate: boolean) {
    const b = v.build; if (!b) return; v.build = undefined;
    this.hots = this.hots.filter((h) => h.owner !== `build:${v.id}`);
    for (const t of b.tw) t.remove();
    b.dust.stop(); this.time.delayedCall(1300, () => b.dust.destroy());
    if (animate) {
      this.tweens.add({ targets: b.scaffold, y: b.scaffold.y + 28, alpha: 0, angle: 6, duration: 520, ease: 'Quad.In', onComplete: () => b.scaffold.destroy() });
      if (b.crane) this.tweens.add({ targets: b.crane, alpha: 0, y: b.crane.y + 20, duration: 600, onComplete: () => b.crane?.destroy() });
      this.tweens.add({ targets: b.bubble, scale: 0, alpha: 0, duration: 250, onComplete: () => b.bubble.destroy() });
    } else { b.scaffold.destroy(); b.crane?.destroy(); b.bubble.destroy(); }
    this.syncWorkers();
  }

  /** inşaat bitti: iskele düşer, bina "pop" ile büyür, ışık patlaması, konfeti */
  private celebrateBuilt(v: BView, st: BuildingState, from: number) {
    const tierUp = tierOf(from) !== tierOf(st.level);
    v.goal = st.level;
    this.removeBuild(v, true);
    const l = LOTS[v.id];
    this.time.delayedCall(380, () => {
      if (v.goal !== st.level) return; // bu arada başka bir seviyeye geçildi
      this.setLevel(v, st.level);
      const s = v.sprite; const sx = BS[v.id] / TEX;
      s.setScale(sx * 0.55, sx * 0.4);
      this.tweens.add({ targets: s, scaleX: sx, scaleY: sx, duration: 700, ease: 'Elastic.Out', easeParams: [1.1, 0.5] });
      const cy = s.y - s.originY * s.displayHeight * 0.5;
      const glow = this.add.image(l.x, cy, ATLAS, 'c-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0b0).setScale(0.5).setDepth(DEPTH.fx);
      this.tweens.add({ targets: glow, scale: tierUp ? 6 : 4, alpha: { from: 1, to: 0 }, duration: 900, ease: 'Cubic.Out', onComplete: () => glow.destroy() });
      const rays = this.add.image(l.x, cy, ATLAS, 'c-rays').setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setDepth(DEPTH.fx);
      this.tweens.add({ targets: rays, scale: tierUp ? 1.6 : 1.1, angle: 60, alpha: { from: 1, to: 0 }, duration: 1300, ease: 'Cubic.Out', onComplete: () => rays.destroy() });
      const conf = this.add.particles(l.x, cy, ATLAS, { frame: 'c-confetti',  speed: { min: 80, max: tierUp ? 260 : 180 }, angle: { min: 200, max: 340 }, gravityY: 260, lifespan: 1600, rotate: { min: 0, max: 360 }, scale: { start: 1.2, end: 0.6 }, alpha: { start: 1, end: 0 }, tint: [0xffc93c, 0xff5c8a, 0x2ee6d6, 0x8ef0b0, 0x8b6bff], emitting: false }).setDepth(DEPTH.fx);
      conf.explode(tierUp ? 90 : 45); this.time.delayedCall(1800, () => conf.destroy());
      v.badge.setScale(0); this.tweens.add({ targets: v.badge, scale: this.uiScale * 1.4, duration: 300, yoyo: true, hold: 300, ease: 'Back.Out', onComplete: () => v.badge.setScale(this.uiScale) });
      this.floatText(l.x, cy - 30, `Sv ${st.level}!`, '#ffc93c', tierUp ? 26 : 20);
      if (tierUp) { const cam = this.cameras.main; cam.shake(220, 0.004); for (let i = 0; i < 3; i++) this.time.delayedCall(250 + i * 260, () => this.firework(l.x + (i - 1) * 60, cy - 70 - i * 10)); }
      this.opts.onBuilt(v.id, st.level, tierUp);
    });
  }
  private firework(x: number, y: number) {
    const p = this.add.particles(x, y, ATLAS, { frame: 'c-sparkle',  speed: { min: 60, max: 150 }, lifespan: 900, scale: { start: 0.5, end: 0 }, gravityY: 90, blendMode: 'ADD', tint: [0xffc93c, 0xff5c8a, 0x2ee6d6, 0xffffff][Math.floor(Math.random() * 4)], emitting: false }).setDepth(DEPTH.fx);
    p.explode(28); this.time.delayedCall(1000, () => p.destroy());
  }
  private floatText(x: number, y: number, s: string, color: string, size = 18) {
    const t = this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: '900', color, stroke: '#2d1d6e', strokeThickness: 5 }).setOrigin(0.5).setResolution(this.dpr * 1.5).setDepth(DEPTH.ui + 5).setScale(this.uiScale * 0.4);
    this.tweens.add({ targets: t, scale: this.uiScale, duration: 300, ease: 'Back.Out' });
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, delay: 900, duration: 800, onComplete: () => t.destroy() });
  }

  /** takım arkadaşı yardım etti: kalpler/eller uçar, süre kısalır */
  helped(id: BuildingId, seconds: number) {
    const v = this.views.get(id); if (!v) return;
    const b = v.build; const tx = b ? b.bubble.x : LOTS[id].x, ty = b ? b.bubble.y - 18 * this.uiScale : LOTS[id].y - 60;
    const cam = this.cameras.main; const wv = cam.worldView;
    for (let i = 0; i < 7; i++) {
      const sx = Phaser.Math.Between(0, 1) ? wv.x - 10 : wv.right + 10, sy = wv.y + wv.height * (0.3 + Math.random() * 0.5);
      const img = this.add.image(sx, sy, ATLAS, i % 2 ? 'c-hand' : 'c-heart').setDepth(DEPTH.ui + 3).setScale(this.uiScale * 0.9);
      this.tweens.add({ targets: img, x: tx + (Math.random() - 0.5) * 30, y: ty, duration: 700 + i * 90, ease: 'Cubic.In', onComplete: () => { img.destroy(); if (b?.bubble.active) { this.tweens.add({ targets: b.bubble, scale: this.uiScale * 1.15, duration: 90, yoyo: true }); } } });
      this.tweens.add({ targets: img, angle: { from: -20, to: 20 }, duration: 200, yoyo: true, repeat: 3 });
    }
    this.time.delayedCall(900, () => this.floatText(tx, ty - 26 * this.uiScale, `−${seconds >= 60 ? `${Math.round(seconds / 60)} dk` : `${seconds} sn`}`, '#8ef0b0', 18));
  }

  // ------------------------------------------------------------------ depo
  private ensureDepot() {
    const v = this.views.get('depo'); if (!v) return;
    if (this.depot) { this.depot.bubble.destroy(); this.depot.glow.destroy(); this.depot = undefined; }
    this.hots = this.hots.filter((h) => h.owner !== 'depot');
    if (v.level <= 0 || this.opts.readOnly) return;
    const l = LOTS.depo; const s = v.sprite; const topY = s.y - s.originY * s.displayHeight;
    const bg = this.add.image(0, 0, ATLAS, 'c-bubble-s').setScale(1 / TEX).setOrigin(0.5, 1);
    const coin = this.add.image(0, -18, ATLAS, 'c-coin').setScale(1 / TEX * 1.1);
    const label = this.add.text(0, -40, 'DOLU', { fontFamily: FONT, fontSize: '11px', fontStyle: '900', color: '#ffffff', backgroundColor: '#ff5c8a', padding: { x: 4, y: 1 } }).setOrigin(0.5).setResolution(this.dpr * 1.5).setVisible(false);
    const bubble = this.add.container(l.x + 6, topY - 4, [bg, coin, label]).setDepth(DEPTH.ui).setVisible(false);
    if (!this.opts.reducedMotion) this.tweens.add({ targets: bubble, y: topY - 10, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const cp = v.anchors.coins ?? [20, 10];
    const glow = this.add.image(l.x + cp[0] * BS.depo, l.y + cp[1] * BS.depo, ATLAS, 'c-glow').setTint(0xffc93c).setBlendMode(Phaser.BlendModes.ADD).setScale(0.7).setDepth(l.y + 0.9).setVisible(false);
    this.tweens.add({ targets: glow, alpha: { from: 0.4, to: 1 }, scale: { from: 0.6, to: 0.85 }, duration: 800, yoyo: true, repeat: -1 });
    this.depot = { bubble, glow, label, full: false };
    this.hots.push({ owner: 'depot', x: () => bubble.x, y: () => bubble.y - 16 * this.uiScale, r: 22, act: () => this.opts.onCollect(), visible: () => bubble.visible });
    this.updateDepot(this.opts.now());
  }
  private updateDepot(now: number) {
    const d = this.depot; if (!d) return;
    const v = this.views.get('depo')!; const st = depotStored(v.level, this.opts.camp.depotStoredAt, now, depotCapHours(this.opts.camp.buildings.find((b) => b.id === 'denge')?.level ?? 0));
    const show = st.stored >= Math.max(1, st.max * 0.1) && !v.build;
    d.bubble.setVisible(show); d.glow.setVisible(st.ratio >= 0.5); d.full = st.ratio >= 1; d.label.setVisible(d.full);
  }
  /** toplandı: jetonlar depodan fışkırır */
  collected(amount: number) {
    const v = this.views.get('depo'); if (!v || amount <= 0) return;
    const l = LOTS.depo; const x = l.x, y = l.y - 30;
    const n = Math.min(18, 6 + Math.round(amount / 40));
    for (let i = 0; i < n; i++) {
      const c = this.add.image(x + (Math.random() - 0.5) * 30, y, ATLAS, 'c-coin').setScale(1 / TEX * 1.2).setDepth(DEPTH.fx);
      this.tweens.add({ targets: c, y: y - 50 - Math.random() * 40, x: c.x + (Math.random() - 0.5) * 60, duration: 420, ease: 'Quad.Out', delay: i * 25, onComplete: () => this.tweens.add({ targets: c, alpha: 0, y: c.y - 30, duration: 380, onComplete: () => c.destroy() }) });
    }
    this.floatText(x, y - 40, `+${amount}`, '#ffc93c', 20);
    this.updateDepot(this.opts.now());
  }

  // ------------------------------------------------------------------ Tedavi Odası rafı
  private ensureRemedy() {
    const v = this.views.get('tedavi'); if (!v) return;
    if (this.remedyBubble) { this.remedyBubble.bubble.destroy(); this.remedyBubble = undefined; }
    this.hots = this.hots.filter((h) => h.owner !== 'remedy');
    if (v.level <= 0 || this.opts.readOnly) return;
    const l = LOTS.tedavi; const s = v.sprite; const topY = s.y - s.originY * s.displayHeight;
    const bg = this.add.image(0, 0, ATLAS, 'c-bubble-s').setScale(1 / TEX).setOrigin(0.5, 1);
    const drop = this.add.image(-5, -18, ATLAS, 'c-drop').setScale(1 / TEX * 1.05);
    const text = this.add.text(8, -18, '', { fontFamily: FONT, fontSize: '12px', fontStyle: '900', color: '#2d1d6e' }).setOrigin(0.5).setResolution(this.dpr * 1.5);
    const bubble = this.add.container(l.x - 8, topY - 4, [bg, drop, text]).setDepth(DEPTH.ui).setVisible(false);
    if (!this.opts.reducedMotion) this.tweens.add({ targets: bubble, y: topY - 10, duration: 760, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.remedyBubble = { bubble, text, ready: 0 };
    this.hots.push({ owner: 'remedy', x: () => bubble.x, y: () => bubble.y - 16 * this.uiScale, r: 22, act: () => this.opts.onCollectRemedy?.(), visible: () => bubble.visible });
    this.updateRemedy(this.opts.now());
  }
  private updateRemedy(now: number) {
    const rb = this.remedyBubble; if (!rb) return;
    const v = this.views.get('tedavi')!; const r = this.opts.camp.remedy; const def = r?.item ? remedyById(r.item) : undefined;
    const tarama = this.opts.camp.buildings.find((b) => b.id === 'tarama')?.level ?? 0;
    const ready = def && r ? remedyShelf(def, v.level, r.since, now, taramaFactor(tarama)).ready : 0;
    rb.ready = ready; rb.bubble.setVisible(ready > 0 && !v.build); if (ready > 0) rb.text.setText(`×${ready}`);
  }
  /** raftakiler toplandı: damlalar çantaya uçar */
  remediesCollected(n: number) {
    const l = LOTS.tedavi; const x = l.x, y = l.y - 40;
    for (let i = 0; i < Math.min(8, 3 + n); i++) {
      const d = this.add.image(x + (Math.random() - 0.5) * 24, y, ATLAS, 'c-drop').setScale(1 / TEX * 1.2).setDepth(DEPTH.fx);
      this.tweens.add({ targets: d, y: y - 46 - Math.random() * 30, x: d.x + (Math.random() - 0.5) * 50, duration: 420, ease: 'Quad.Out', delay: i * 40, onComplete: () => this.tweens.add({ targets: d, alpha: 0, y: d.y - 24, duration: 360, onComplete: () => d.destroy() }) });
    }
    this.floatText(x, y - 36, `+${n}`, '#7df3ff', 20);
    this.updateRemedy(this.opts.now());
  }

  // ------------------------------------------------------------------ bölge anıtları ("Kulak Yolu")
  private monTex(region: string, built: boolean): string {
    const key = `c-mon-${region}-${built ? 1 : 0}`;
    const b = MONUMENT_BOX;
    makeTex(this.textures, key, b.w, b.h, b.ox, b.oy, (c) => paintMonument(c, region as BiomeId, built));
    return key;
  }
  private placeMonuments() {
    const have = new Set(this.opts.regions ?? []);
    for (const sp of MONUMENT_SPOTS) {
      const built = have.has(sp.region);
      const img = this.add.image(sp.x, sp.y, this.monTex(sp.region, built)).setScale(1 / TEX).setDepth(sp.y);
      const src = img.texture.getSourceImage() as HTMLCanvasElement; img.setOrigin((MONUMENT_BOX.ox * TEX) / src.width, (MONUMENT_BOX.oy * TEX) / src.height);
      if (!built) img.setAlpha(0.8);
      const m: { img: Phaser.GameObjects.Image; built: boolean; glow?: Phaser.GameObjects.Image; tw?: Phaser.Tweens.Tween } = { img, built };
      this.monuments.set(sp.region, m);
      if (built) this.monGlow(sp.region);
      this.hots.push({ owner: `mon:${sp.region}`, x: () => sp.x, y: () => sp.y - 24, r: 20, act: () => { this.bounceImg(img); this.opts.onMonument?.(sp.region, false); }, visible: () => true });
    }
  }
  private monGlow(region: string) {
    const m = this.monuments.get(region); const sp = MONUMENT_SPOTS.find((x) => x.region === region); if (!m || !sp || m.glow) return;
    const g = this.add.image(sp.x, sp.y - 34, ATLAS, 'c-glow').setTint(MONUMENT_TINT[sp.region]).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setAlpha(0.32).setDepth(sp.y - 0.5);
    m.glow = g;
    if (!this.opts.reducedMotion) m.tw = this.tweens.add({ targets: g, alpha: { from: 0.18, to: 0.42 }, scale: { from: 0.55, to: 0.68 }, duration: 1400 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }
  private bounceImg(img: Phaser.GameObjects.Image) {
    const sx = 1 / TEX; this.tweens.killTweensOf(img); img.setScale(sx);
    this.tweens.add({ targets: img, scaleX: sx * 1.08, scaleY: sx * 0.92, duration: 90, yoyo: true, ease: 'Quad.Out' });
  }
  /** ulaşılan bölgeler değişti; celebrate: yeni yükselen anıt (kamera oraya kayar, kutlama, sonra onMonument(fresh)) */
  setRegions(regions: string[], celebrate?: string | null) {
    this.opts.regions = regions; const have = new Set(regions);
    for (const sp of MONUMENT_SPOTS) {
      const m = this.monuments.get(sp.region); if (!m) continue;
      const built = have.has(sp.region); if (built === m.built) continue;
      m.built = built; m.img.setTexture(this.monTex(sp.region, built)).setAlpha(built ? 1 : 0.8);
      if (!built) { m.tw?.remove(); m.glow?.destroy(); m.glow = undefined; m.tw = undefined; continue; }
      if (sp.region === celebrate) this.raiseMonument(sp.region); else this.monGlow(sp.region);
    }
    if (celebrate && have.has(celebrate) && !this.raising.has(celebrate)) { const m = this.monuments.get(celebrate); if (m?.built) this.raiseMonument(celebrate); }
  }
  private raising = new Set<string>();
  private raiseMonument(region: string) {
    const m = this.monuments.get(region); const sp = MONUMENT_SPOTS.find((x) => x.region === region); if (!m || !sp) return;
    this.raising.add(region);
    const cam = this.cameras.main; const calm = !!this.opts.reducedMotion;
    // anıt ekranın üst yarısına gelsin (alttaki Tüy Dede kartı örtmesin); kamera sınırının içinde
    cam.pan(sp.x * 0.8, Math.min(sp.y + 110, ISLAND.ry * 0.85), calm ? 1 : 700, 'Sine.easeInOut');
    const img = m.img; const sx = 1 / TEX;
    img.setScale(sx, 0.01).setAlpha(1);
    const cy = sp.y - 34;
    this.time.delayedCall(calm ? 50 : 650, () => {
      this.opts.onMonument?.(region, true);
      this.tweens.add({ targets: img, scaleY: sx, duration: calm ? 1 : 900, ease: 'Back.Out' });
      const dust = this.add.particles(sp.x, sp.y, ATLAS, { frame: 'c-puff', lifespan: 900, speed: { min: 10, max: 40 }, angle: { min: 190, max: 350 }, scale: { start: 0.3, end: 0.8 }, alpha: { start: 0.6, end: 0 }, tint: [0xe9d3b0, 0xd9c09a], emitting: false }).setDepth(DEPTH.fx);
      dust.explode(calm ? 6 : 18); this.time.delayedCall(1100, () => dust.destroy());
      // büyüyen ışık geniş alanı kaplar: ışığa duyarlılık sınırı (≤ 0,35, ≤ 3/sn; azaltılmış harekette yok — render/flash.ts)
      if (takeFlash(this.time.now)) { const glow = this.add.image(sp.x, cy, ATLAS, 'c-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(safeFlashColor(MONUMENT_TINT[sp.region])).setScale(0.4).setDepth(DEPTH.fx);
        this.tweens.add({ targets: glow, scale: 4.5, alpha: { from: FLASH.maxAlpha, to: 0 }, duration: 1100, ease: 'Cubic.Out', onComplete: () => glow.destroy() }); }
      const rays = this.add.image(sp.x, cy, ATLAS, 'c-rays').setBlendMode(Phaser.BlendModes.ADD).setTint(MONUMENT_TINT[sp.region]).setScale(0.25).setDepth(DEPTH.fx);
      this.tweens.add({ targets: rays, scale: 1.2, angle: 70, alpha: { from: 1, to: 0 }, duration: 1500, ease: 'Cubic.Out', onComplete: () => rays.destroy() });
      if (!calm) {
        const conf = this.add.particles(sp.x, cy, ATLAS, { frame: 'c-confetti', speed: { min: 70, max: 190 }, angle: { min: 210, max: 330 }, gravityY: 240, lifespan: 1500, rotate: { min: 0, max: 360 }, scale: { start: 1.2, end: 0.6 }, alpha: { start: 1, end: 0 }, tint: [0xffc93c, 0xff5c8a, 0x2ee6d6, 0x8ef0b0, MONUMENT_TINT[sp.region]], emitting: false }).setDepth(DEPTH.fx);
        conf.explode(60); this.time.delayedCall(1700, () => conf.destroy());
        for (let i = 0; i < 2; i++) this.time.delayedCall(300 + i * 280, () => this.firework(sp.x + (i ? 40 : -40), cy - 50));
      }
      this.monGlow(region);
      this.time.delayedCall(calm ? 200 : 1300, () => { this.raising.delete(region); });
    });
  }

  // ------------------------------------------------------------------ takım bayrağı
  private refreshTeamFlag() {
    this.teamFlag?.destroy(); this.teamFlag = undefined;
    const v = this.views.get('merkez'); const team = this.opts.team;
    if (!v || !team || v.level <= 0) return;
    const l = LOTS.merkez;
    const pole = this.add.graphics();
    pole.fillStyle(0x2d1d6e, 0.35); pole.fillEllipse(3, 0, 16, 6);
    pole.fillStyle(0x8a8274, 1); pole.fillRect(-4, -4, 8, 4); pole.fillStyle(0x5b3a24, 1); pole.fillRect(-1.3, -78, 2.6, 75); pole.fillStyle(0xffc93c, 1); pole.fillCircle(0, -79, 3);
    const cloth = this.add.graphics();
    cloth.fillStyle(0x6c4cf1, 1); cloth.beginPath(); cloth.moveTo(1, -76); cloth.lineTo(38, -73); cloth.lineTo(34, -61); cloth.lineTo(38, -49); cloth.lineTo(1, -52); cloth.closePath(); cloth.fillPath();
    cloth.fillStyle(0x8b6bff, 1); cloth.fillRect(1, -76, 34, 4); cloth.lineStyle(1.4, 0xffc93c, 1); cloth.strokePath();
    const em = this.add.text(17, -63, team.emblem, { fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif', fontSize: '15px' }).setOrigin(0.5).setResolution(this.dpr * 1.5);
    const c = this.add.container(l.x - 128, l.y + 40, [pole, cloth, em]).setDepth(l.y + 40);
    if (!this.opts.reducedMotion) this.tweens.add({ targets: [cloth, em], scaleX: { from: 1, to: 0.82 }, scaleY: { from: 1, to: 1.04 }, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.teamFlag = c;
  }

  // ------------------------------------------------------------------ süsler ve sis
  private placeDecor() {
    const r = Phaser.Math.RND; r.sow(['kulak-kampi']);
    const busy = (x: number, y: number, pad = 0) => {
      if ((x / 180) ** 2 + ((y - 4) / 92) ** 2 < 1) return true;
      for (const id of BUILDING_ORDER) { const l = LOTS[id]; const h = l.tiles * 16 + 14 + pad; if (Math.abs(x - l.x) / (h * 2) + Math.abs(y - (l.y - 10)) / (h * 1.2) <= 1) return true; }
      for (const road of ROADS) for (let t = 0; t <= 1; t += 0.05) { const [px, py] = bez(road, t); if (Math.hypot(x - px, (y - py) * 2) < 26) return true; }
      for (let i = 0; i < STREAM_PTS.length; i += 2) { const [px, py] = STREAM_PTS[i]!; if (Math.hypot(x - px, (y - py) * 1.6) < 22) return true; }
      for (const m of MONUMENT_SPOTS) if (Math.abs(x - m.x) < 46 && y - m.y > -62 && y - m.y < 48) return true; // anıtın önü ve arkası açık kalsın
      return false;
    };
    const zoneOf = (x: number, y: number) => { const dx = x / ISLAND.rx, dy = (y - ISLAND.cy) / ISLAND.ry; const rr = Math.hypot(dx, dy); if (rr < 0.6) return 0; const a = Math.atan2(dy, dx); if (a > Math.PI * 0.28 && a < Math.PI * 0.72) return 0; if (Math.abs(a) >= Math.PI * 0.72) return 1; if (a >= -Math.PI * 0.4 && a <= Math.PI * 0.28) return 2; if (a < -Math.PI * 0.4 && a > -Math.PI * 0.72) return 4; return 3; };
    const add = (key: string, x: number, y: number, zone: number, scale = 1, minMerkez?: number, maxMerkez?: number) => {
      const img = this.add.image(x, y, ATLAS, key).setScale(scale / TEX).setDepth(y);
      this.decor.push({ zone, obj: img, shown: true, minMerkez, maxMerkez });
    };
    const keys = { tree: [0, 1, 2, 3, 4].map((i) => `c-tree-${i}`), hair: [0, 1, 2, 3].map((i) => `c-hair-${i}`), pine: ['c-pine-0', 'c-pine-1'], flower: [0, 1, 2, 3].map((i) => `c-flower-${i}`), rock: ['c-rock-0', 'c-rock-1'], bush: ['c-bush-0', 'c-bush-1'] };
    const pick = <T,>(a: T[]) => a[Math.floor(r.frac() * a.length)]!;
    // ağaç ve çiçek saçılımı
    for (let i = 0; i < 520; i++) {
      const x = (r.frac() - 0.5) * 2 * ISLAND.rx, y = ISLAND.cy + (r.frac() - 0.5) * 2 * ISLAND.ry;
      if (!onIsland(x, y, 0.94) || busy(x, y)) continue;
      const dx = x / ISLAND.rx, dy = (y - ISLAND.cy) / ISLAND.ry; const rr = Math.hypot(dx, dy);
      const z = zoneOf(x, y);
      const roll = r.frac();
      let key: string;
      if (rr > 0.72 && roll < 0.55) key = pick(roll < 0.2 ? keys.pine : roll < 0.38 ? keys.hair : keys.tree);
      else if (rr > 0.55 && roll < 0.3) key = pick(r.frac() < 0.4 ? keys.hair : keys.tree);
      else if (roll < 0.62) key = pick(keys.flower);
      else if (roll < 0.74) key = pick(keys.bush);
      else if (roll < 0.8) key = pick(keys.rock);
      else continue;
      if (dy < -0.62 && Math.abs(dx) > 0.15 && key.startsWith('c-flower')) continue;
      add(key, x, y, z, key.startsWith('c-tree') || key.startsWith('c-hair') ? 0.9 + r.frac() * 0.35 : 1);
    }
    // merkez seviyesine bağlı süsler: yol fenerleri (4+), meydan çiti (7+), heykel (7+), çeşme (10+), altın (13+)
    const pool = (x: number, y: number, minMerkez: number) => { const g = this.add.image(x, y, ATLAS, 'c-glow').setTint(0xffb84a).setBlendMode(Phaser.BlendModes.ADD).setScale(1.1, 0.55).setAlpha(0.35).setDepth(DEPTH.ground + 1); this.decor.push({ zone: 0, obj: g, shown: true, minMerkez }); };
    ROADS.forEach((road) => { for (const t of [0.42, 0.8]) { const [px, py] = bez(road, t); add('c-lamp', px + 15, py - 2, 0, 1, 4, 12); add('c-lamp-g', px + 15, py - 2, 0, 1, 13); pool(px + 17, py, 4); } });
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; if (Math.sin(a) > 0.55 && Math.abs(Math.cos(a)) < 0.45) continue; const x = Math.cos(a) * 176, y = 4 + Math.sin(a) * 90; if (ROADS.some((rd) => Math.hypot(rd[1]![0] * 0.6 - x, rd[1]![1] * 0.6 - y) < 34)) continue; const axis = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) * 1.6 ? 'v' : 'u'; add(`c-fence-${axis}`, x, y, 0, 0.9, 7, 12); add(`c-fence-${axis}-g`, x, y, 0, 0.9, 13); }
    add('c-statue', 128, 120, 0, 1, 7, 12); add('c-statue-g', 128, 120, 0, 1, 13);
    add('c-fountain', -128, 116, 0, 1, 10, 12); add('c-fountain-g', -128, 116, 0, 1, 13);
    // bölge süsleri (sis kalkınca görünür)
    add('c-statue', -360, -200, 3, 1.1); add('c-fountain-g', 360, -210, 4, 1.1); add('c-statue-g', 440, -150, 4, 1);
    add('c-bridge', BRIDGE[0], BRIDGE[1] + 6, zoneOf(BRIDGE[0], BRIDGE[1]), 1);
    add('c-pier', -40, 300, 0, 1);
  }
  private placeFog() {
    const r = Phaser.Math.RND; r.sow(['sis']);
    const zones: [number, number, number][] = [[1, Math.PI * 0.78, Math.PI * 1.22], [2, -Math.PI * 0.36, Math.PI * 0.26], [3, Math.PI * 1.28, Math.PI * 1.6], [4, Math.PI * 1.6, Math.PI * 1.86]];
    for (const [zone, a0, a1] of zones) {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = a0 + (a1 - a0) * (i / (n - 1)) + (r.frac() - 0.5) * 0.08;
        for (const k of [0.78, 0.93]) {
          const s = shoreK(a) * k; const x = Math.cos(a) * ISLAND.rx * s, y = ISLAND.cy + Math.sin(a) * ISLAND.ry * s + 8;
          if (BUILDING_ORDER.some((id) => Math.hypot(x - LOTS[id].x, (y - LOTS[id].y) * 1.6) < 110)) continue; // arsa sisin altında kalmasın
          const img = this.add.image(x, y, ATLAS, `c-cloud-${Math.floor(r.frac() * 4)}`).setScale((0.8 + r.frac() * 0.35) / TEX).setDepth(y + 30).setAlpha(0.86);
          if (!this.opts.reducedMotion) this.tweens.add({ targets: img, x: x + 14, duration: 4000 + r.frac() * 3000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
          this.fog.push({ zone, img });
        }
      }
    }
  }
  private updateZones(before: number, initial: boolean) {
    const open = zonesOpen(this.merkezLevel);
    for (const f of this.fog) {
      const should = f.zone >= open;
      if (f.img.visible && !should) { if (initial) f.img.setVisible(false); else this.tweens.add({ targets: f.img, alpha: 0, scale: f.img.scale * 1.6, y: f.img.y - 30, duration: 1400 + Math.random() * 600, ease: 'Sine.In', onComplete: () => f.img.setVisible(false) }); }
      else if (!f.img.visible && should) f.img.setVisible(true).setAlpha(0.86);
    }
    for (const d of this.decor) {
      const show = !d.covered && d.zone < Math.max(1, open) && (d.minMerkez == null || this.merkezLevel >= d.minMerkez) && (d.maxMerkez == null || this.merkezLevel <= d.maxMerkez);
      if (show === d.shown) continue;
      d.shown = show;
      if (show && !initial && open > before && d.obj.blendMode !== Phaser.BlendModes.ADD) { const sc = d.obj.scaleX; d.obj.setVisible(true).setScale(0); this.tweens.add({ targets: d.obj, scale: sc, duration: 500, delay: 600 + Math.random() * 900, ease: 'Back.Out' }); }
      else d.obj.setVisible(show);
    }
  }

  // ------------------------------------------------------------------ yaşam: işçiler, notalar, ateşböcekleri
  private ambient() {
    const calm = !!this.opts.reducedMotion;
    if (!calm) {
      this.time.addEvent({ delay: 2300, loop: true, callback: () => {
        const v = this.views.get(Math.random() < 0.5 ? 'kule' : 'merkez'); if (!v || v.level <= 0) return;
        const s = v.sprite; const x = s.x + (Math.random() - 0.5) * 30, y = s.y - s.originY * s.displayHeight * 0.8;
        const n = this.add.image(x, y, ATLAS, `c-note-${Math.floor(Math.random() * 4)}`).setScale(0.55).setDepth(DEPTH.fx).setAlpha(0);
        this.tweens.add({ targets: n, y: y - 70, alpha: { from: 1, to: 0 }, duration: 3200, ease: 'Sine.Out', onComplete: () => n.destroy() });
        this.tweens.add({ targets: n, x: x + 16, duration: 800, yoyo: true, repeat: 2, ease: 'Sine.InOut' });
      } });
      for (let i = 0; i < 16; i++) {
        let x = 0, y = 0; for (let k = 0; k < 20; k++) { x = (Math.random() - 0.5) * ISLAND.rx * 1.6; y = (Math.random() - 0.5) * ISLAND.ry * 1.6; if (onIsland(x, y, 0.85)) break; }
        const f = this.add.image(x, y, ATLAS, 'c-firefly').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fx - 1).setScale(0.9);
        this.tweens.add({ targets: f, x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 40 - 10, duration: 3000 + Math.random() * 3000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        this.tweens.add({ targets: f, alpha: { from: 0.1, to: 1 }, duration: 700 + Math.random() * 900, yoyo: true, repeat: -1, delay: Math.random() * 1000 });
      }
    }
  }
  private workerFrame(w: Worker, f: number) {
    w.f = f;
    if (w.hero) w.sprite.setTexture(`${w.hero}-${f}`); else w.sprite.setFrame(`c-odi-${w.color}-${f}`, false, false);
  }
  private syncWorkers() {
    const want = Math.min(6, 2 + Math.floor(this.merkezLevel / 4));
    while (this.workers.length < want) {
      const i = this.workers.length; const color = i % WORKER_COLORS.length;
      const [x, y] = bez(ROADS[i % ROADS.length]!, 0.3 + Math.random() * 0.4);
      const hc = i === 0 ? this.opts.heroColor : undefined;
      const hero = hc === undefined ? undefined : `c-hero-${hc.toString(16)}`;
      if (hero) for (const f of [0, 1]) makeTex(this.textures, `${hero}-${f}`, 16, 20, 8, 18, (c) => worker(c, hc!, f));
      const sprite = (hero ? this.add.image(x, y, `${hero}-0`) : this.add.image(x, y, ATLAS, `c-odi-${color}-0`)).setOrigin(0.5, 0.9).setScale(1 / TEX * 1.25).setDepth(y);
      const hammer = this.add.image(x, y, ATLAS, 'c-hammer').setOrigin(0.5, 0.9).setScale(1 / TEX * 1.25).setVisible(false);
      const w: Worker = { sprite, hammer, color, busy: false, site: false, frameT: 0, walking: false, f: 0, ...(hero ? { hero } : {}) };
      this.workers.push(w);
      this.time.delayedCall(300 + i * 500, () => this.nextWalk(w));
    }
    const site = [...this.views.values()].find((v) => v.build);
    this.workers.forEach((w, i) => { const should = !!site && i < 2; if (should !== w.site) { w.site = should; w.tw?.stop(); this.nextWalk(w); } });
  }
  private walkTo(w: Worker, x: number, y: number, then: () => void) {
    const s = w.sprite; const d = Math.hypot(x - s.x, (y - s.y) * 2);
    s.setFlipX(x < s.x); w.walking = true; w.hammer.setVisible(false);
    w.tw = this.tweens.add({ targets: s, x, y, duration: Math.max(200, d * 45), ease: 'Linear', onUpdate: () => s.setDepth(s.y), onComplete: () => { w.walking = false; this.workerFrame(w, 0); then(); } });
  }
  private nextWalk(w: Worker) {
    if (!w.sprite.active) return;
    const site = [...this.views.values()].find((v) => v.build);
    if (w.site && site) {
      const l = LOTS[site.id]; const side = this.workers.indexOf(w) === 0 ? -1 : 1;
      const x = l.x + side * (l.tiles * 20), y = l.y + l.tiles * 11;
      this.walkTo(w, x, y, () => this.hammerLoop(w, side));
      return;
    }
    const road = ROADS[Math.floor(Math.random() * ROADS.length)]!;
    const [x, y] = bez(road, 0.2 + Math.random() * 0.75);
    this.walkTo(w, x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 4, () => { w.tw = this.tweens.add({ targets: w.sprite, scaleY: w.sprite.scaleY * 0.94, duration: 300, yoyo: true, repeat: 2, onComplete: () => this.nextWalk(w) }); });
  }
  private hammerLoop(w: Worker, side: number) {
    const s = w.sprite; s.setFlipX(side > 0);
    w.hammer.setVisible(true).setPosition(s.x + (side > 0 ? -6 : 6), s.y - 6).setDepth(s.depth + 0.1).setFlipX(side > 0).setAngle(side > 0 ? 30 : -30);
    w.tw = this.tweens.add({ targets: w.hammer, angle: side > 0 ? -50 : 50, duration: 180, yoyo: true, repeat: -1, repeatDelay: 220,
      onRepeat: () => { if (Math.random() < 0.5 && !this.opts.reducedMotion) { const p = this.add.image(w.hammer.x + (side > 0 ? -6 : 6), s.y - 2, ATLAS, 'c-puff').setScale(0.2).setDepth(s.depth + 0.2).setAlpha(0.7); this.tweens.add({ targets: p, scale: 0.5, alpha: 0, y: p.y - 6, duration: 500, onComplete: () => p.destroy() }); } } });
    this.tweens.add({ targets: s, scaleY: { from: s.scaleY, to: s.scaleY * 0.92 }, duration: 180, yoyo: true, repeat: -1, repeatDelay: 220 });
  }

  // ------------------------------------------------------------------ bölgeler (Kamp Seviyesiyle açılan uydu adalar)
  private placeDistricts() { for (const d of DISTRICTS) { const dv: DView = { d, open: false, fog: [], scatter: [] }; this.dviews.set(d.id, dv); this.renderDistrict(dv, this.campLevel >= d.level, true); } }
  private updateDistricts(initial: boolean) { for (const dv of this.dviews.values()) { const open = this.campLevel >= dv.d.level; if (open !== dv.open) this.renderDistrict(dv, open, initial); } }
  private renderDistrict(dv: DView, open: boolean, initial: boolean) {
    const d = dv.d; const b = districtBox(d); const wasLocked = !dv.open && !!dv.img;
    // eski görünümü kaldır (kilitli doku bellekten de çıkar)
    const oldImg = dv.img, oldKey = dv.key, oldFog = dv.fog, oldSign = dv.sign;
    dv.fog = []; dv.sign = undefined; this.hots = this.hots.filter((h) => h.owner !== `dist:${d.id}`);
    dv.open = open;
    if (open) {
      const q = 1; // bölge zemini çözünürlüğü (bellek: en büyük bölge ~2 MB)
      const key = makeTex(this.textures, `c-dist-${d.id}`, b.x1 - b.x0, b.y1 - b.y0, -b.x0, -b.y0, (c) => paintDistrict(c, d), q);
      dv.key = key; dv.img = this.add.image(b.x0, b.y0, key).setOrigin(0, 0).setScale(1 / q).setDepth(DEPTH.ground + 1);
      const bb = bridgeBox(d); const bk = makeTex(this.textures, `c-bridge-${d.id}`, bb.x1 - bb.x0, bb.y1 - bb.y0, -bb.x0, -bb.y0, (c) => paintBridge(c, d), 1.5);
      dv.bridge = this.add.image(bb.x0, bb.y0, bk).setOrigin(0, 0).setScale(1 / 1.5).setDepth(DEPTH.ground + 2);
      this.scatterDistrict(dv);
      if (!initial && wasLocked) {
        dv.img.setAlpha(0); this.tweens.add({ targets: dv.img, alpha: 1, duration: 1200, ease: 'Sine.Out' });
        dv.bridge.setAlpha(0).setY(bb.y0 + 30); this.tweens.add({ targets: dv.bridge, alpha: 1, y: bb.y0, duration: 900, delay: 500, ease: 'Back.Out' });
        this.celebrateLand(d);
      }
    } else {
      const q = 0.3;
      const key = makeTex(this.textures, `c-dist-${d.id}-l`, b.x1 - b.x0, b.y1 - b.y0, -b.x0, -b.y0, (c) => paintDistrictLocked(c, d), q);
      dv.key = key; dv.img = this.add.image(b.x0, b.y0, key).setOrigin(0, 0).setScale(1 / q).setDepth(DEPTH.ground + 1).setAlpha(0.92);
      const r = Phaser.Math.RND; r.sow([`sis-${d.id}`]);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + r.frac() * 0.4; const x = d.cx + Math.cos(a) * d.rx * 0.45, y = d.cy + Math.sin(a) * d.ry * 0.45;
        const img = this.add.image(x, y, ATLAS, `c-cloud-${Math.floor(r.frac() * 4)}`).setScale((1 + r.frac() * 0.4) / TEX).setDepth(y + 40).setAlpha(0.88);
        if (!this.opts.reducedMotion) this.tweens.add({ targets: img, x: x + 16, duration: 4500 + r.frac() * 3000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        dv.fog.push(img);
      }
      const lock = this.add.image(0, 0, ATLAS, 'c-lock').setScale(1 / TEX);
      const label = this.add.text(0, -46, `${d.name}\nKamp Sv ${d.level}`, { fontFamily: FONT, fontSize: '13px', fontStyle: '900', color: '#ffffff', align: 'center', stroke: '#2d1d6e', strokeThickness: 4 }).setOrigin(0.5, 1).setResolution(this.dpr * 1.5);
      dv.sign = this.add.container(d.cx, d.cy + 10, [lock, label]).setDepth(DEPTH.fog + 5);
      this.hots.push({ owner: `dist:${d.id}`, x: () => d.cx, y: () => d.cy - 10, r: 40, act: () => this.opts.onDistrict?.(d.id), visible: () => true });
    }
    if (oldImg) oldImg.destroy();
    if (oldKey && oldKey !== dv.key && this.textures.exists(oldKey)) this.textures.remove(oldKey);
    for (const f of oldFog) { if (initial) f.destroy(); else this.tweens.add({ targets: f, alpha: 0, y: f.y - 40, scale: f.scale * 1.6, duration: 1400 + Math.random() * 500, ease: 'Sine.In', onComplete: () => f.destroy() }); }
    oldSign?.destroy();
  }
  /** bölgenin iç alanına birkaç süs (ağaç/çiçek/çalı); yerleştirilen süsün altında kalanlar gizlenir */
  private scatterDistrict(dv: DView) {
    for (const o of dv.scatter) o.destroy(); dv.scatter = [];
    const d = dv.d; const r = Phaser.Math.RND; r.sow([`dagit-${d.id}`]);
    const n = d.id === 'orman' ? 46 : 24;
    for (let i = 0; i < n * 3 && dv.scatter.length < n; i++) {
      const x = d.cx + (r.frac() - 0.5) * d.rx * 1.7, y = d.cy + (r.frac() - 0.5) * d.ry * 1.7;
      if (!inDistrict(d, x, y, 0.8)) continue;
      if (d.buildings.some((id) => { const l = LOTS[id]; return Math.abs(x - l.x) < 90 && y > l.y - 110 && y < l.y + 46; })) continue;
      if (d.id === 'koy' && Math.hypot(x - (d.cx - 10), (y - (d.cy + 100)) * 2) < 74) continue; // lagün
      const roll = r.frac();
      const key = d.id === 'orman' ? (roll < 0.7 ? `c-hair-${Math.floor(r.frac() * 4)}` : `c-flower-${Math.floor(r.frac() * 4)}`) : d.id === 'koru' ? (roll < 0.45 ? `c-pine-${Math.floor(r.frac() * 2)}` : roll < 0.75 ? `c-bush-${Math.floor(r.frac() * 2)}` : `c-flower-${Math.floor(r.frac() * 4)}`) : roll < 0.25 ? `c-tree-${Math.floor(r.frac() * 5)}` : roll < 0.75 ? `c-flower-${Math.floor(r.frac() * 4)}` : `c-rock-${Math.floor(r.frac() * 2)}`;
      dv.scatter.push(this.add.image(x, y, ATLAS, key).setScale((key.startsWith('c-tree') || key.startsWith('c-hair') || key.startsWith('c-pine') ? 0.85 + r.frac() * 0.3 : 1) / TEX).setDepth(y));
    }
    this.coverScatter();
  }
  /** yeni bölge açıldı: ışık, konfeti, havai fişek; kamera bölgeye kayar */
  private celebrateLand(d: District) {
    const calm = !!this.opts.reducedMotion; const cam = this.cameras.main;
    if (!this.opts.readOnly) cam.pan(d.cx, d.cy - 20, calm ? 1 : 900, 'Sine.easeInOut', true);
    this.time.delayedCall(calm ? 50 : 700, () => {
      if (takeFlash(this.time.now)) { const glow = this.add.image(d.cx, d.cy - 20, ATLAS, 'c-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(safeFlashColor(0xfff0b0)).setScale(0.6).setDepth(DEPTH.fx);
        this.tweens.add({ targets: glow, scale: 9, alpha: { from: FLASH.maxAlpha, to: 0 }, duration: 1300, ease: 'Cubic.Out', onComplete: () => glow.destroy() }); }
      const rays = this.add.image(d.cx, d.cy - 20, ATLAS, 'c-rays').setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setDepth(DEPTH.fx);
      this.tweens.add({ targets: rays, scale: 2.2, angle: 70, alpha: { from: 1, to: 0 }, duration: 1600, ease: 'Cubic.Out', onComplete: () => rays.destroy() });
      if (!calm) {
        const conf = this.add.particles(d.cx, d.cy - 30, ATLAS, { frame: 'c-confetti', speed: { min: 90, max: 260 }, angle: { min: 200, max: 340 }, gravityY: 240, lifespan: 1700, rotate: { min: 0, max: 360 }, scale: { start: 1.3, end: 0.6 }, alpha: { start: 1, end: 0 }, tint: [0xffc93c, 0xff5c8a, 0x2ee6d6, 0x8ef0b0, 0x8b6bff], emitting: false }).setDepth(DEPTH.fx);
        conf.explode(110); this.time.delayedCall(1900, () => conf.destroy());
        for (let i = 0; i < 4; i++) this.time.delayedCall(300 + i * 260, () => this.firework(d.cx + (i - 1.5) * 70, d.cy - 80 - (i % 2) * 20));
      }
    });
  }
  /** açık bölgelerin binaları için görünüm (kilitliler çizilmez) */
  private ensureViews() {
    for (const dv of this.dviews.values()) {
      if (!dv.open) continue;
      for (const id of dv.d.buildings) if (!this.views.has(id)) { this.makeView(id, 0); const st = this.opts.camp.buildings.find((b) => b.id === id); if (st) { this.setLevel(this.views.get(id)!, st.level); this.syncBuild(this.views.get(id)!, st); } }
    }
  }
  /** bölgenin orta noktası (oyun pikseli) */
  districtPoint(id: string): { x: number; y: number } | null { const dv = this.dviews.get(id); if (!dv) return null; const cam = this.cameras.main; return { x: (dv.d.cx - cam.worldView.x) * cam.zoom, y: (dv.d.cy - 20 - cam.worldView.y) * cam.zoom }; }
  focusDistrict(id: string) { const dv = this.dviews.get(id); if (dv) this.cameras.main.pan(dv.d.cx, dv.d.cy - 20, 600, 'Sine.easeInOut', true); }
  openDistricts(): string[] { return [...this.dviews.values()].filter((d) => d.open).map((d) => d.d.id); }

  // ------------------------------------------------------------------ süslemeler
  private decorTex(id: string): string {
    const sz = decorById(id)?.size ?? 1; const b = DECOR_BOX[sz];
    return makeTex(this.textures, `c-dec-${id}`, b.w, b.h, b.ox, b.oy, (c) => paintDecor(c, id));
  }
  private decorPos(id: string, gx: number, gy: number): [number, number] { const sz = decorById(id)?.size ?? 1; return cellPoint(gx + (sz - 1) / 2, gy + (sz - 1) / 2); }
  private placeDecorImg(img: Phaser.GameObjects.Image, id: string, gx: number, gy: number, flip: boolean) {
    const sz = decorById(id)?.size ?? 1; const b = DECOR_BOX[sz]; const [x, y] = this.decorPos(id, gx, gy);
    img.setPosition(x, y).setOrigin(b.ox / b.w, b.oy / b.h).setScale(1 / TEX).setFlipX(flip).setDepth(y + 0.2);
  }
  syncDecor(placed: DecorPlaced[]) {
    const seen = new Set<number>();
    for (const p of placed) {
      seen.add(p.uid); let v = this.decorViews.get(p.uid);
      if (!v) {
        const img = this.add.image(0, 0, this.decorTex(p.id)); v = { img, id: p.id, gx: p.gx, gy: p.gy, flip: p.flip }; this.decorViews.set(p.uid, v);
        this.placeDecorImg(img, p.id, p.gx, p.gy, p.flip);
        if (!this.opts.reducedMotion && this.ready) { const sc = img.scaleY; img.setScale(img.scaleX * 0.3, sc * 0.3); this.tweens.add({ targets: img, scaleX: 1 / TEX, scaleY: sc, duration: 420, ease: 'Back.Out' }); }
      } else if (v.gx !== p.gx || v.gy !== p.gy || v.flip !== p.flip) { v.gx = p.gx; v.gy = p.gy; v.flip = p.flip; this.placeDecorImg(v.img, p.id, p.gx, p.gy, p.flip); }
      v.img.setVisible(!(this.ghostV?.uid === p.uid));
    }
    for (const [uid, v] of this.decorViews) if (!seen.has(uid)) { v.img.destroy(); this.decorViews.delete(uid); }
    this.coverScatter();
  }
  /** yerleştirilen süslerin altında kalan ağaç/çiçekleri gizle */
  private coverScatter() {
    const spots = [...this.decorViews.values()].map((v) => { const [x, y] = this.decorPos(v.id, v.gx, v.gy); return { x, y, r: (decorById(v.id)?.size ?? 1) * 22 }; });
    const hit = (x: number, y: number) => spots.some((p) => Math.hypot(x - p.x, (y - p.y) * 1.6) < p.r);
    for (const d of this.decor) { if (d.minMerkez != null || d.obj.blendMode === Phaser.BlendModes.ADD) continue; d.covered = hit(d.obj.x, d.obj.y); }
    this.updateZones(zonesOpen(this.merkezLevel), true);
    for (const dv of this.dviews.values()) for (const o of dv.scatter) o.setVisible(!hit(o.x, o.y));
  }
  /** süsleme kipi (hayalet süs, seçili süs halkası) */
  setEdit(on: boolean) { this.edit = on; if (!on) { this.setGhost(null); this.selectDecor(null); } }
  /** seçili süsün altına halka */
  selectDecor(uid: number | null) {
    this.selRing?.destroy(); this.selRing = undefined; if (uid == null) return;
    const v = this.decorViews.get(uid); if (!v) return; const sz = decorById(v.id)?.size ?? 1; const [x, y] = this.decorPos(v.id, v.gx, v.gy);
    const g = this.add.graphics().setDepth(v.img.depth - 0.1); g.lineStyle(2.5, 0xffc93c, 1); g.strokeEllipse(x, y, 34 * sz, 17 * sz); g.lineStyle(1, 0xffffff, 0.8); g.strokeEllipse(x, y, 40 * sz, 20 * sz);
    if (!this.opts.reducedMotion) this.tweens.add({ targets: g, alpha: { from: 1, to: 0.45 }, duration: 600, yoyo: true, repeat: -1 });
    this.selRing = g;
  }
  /** bu hücreler boş mu (arazi, arsa, başka süs; taşınan süs kendisini saymaz) */
  decorFits(id: string, gx: number, gy: number, except?: number): boolean {
    const sz = decorById(id)?.size ?? 1; const taken = new Set<string>();
    for (const [uid, v] of this.decorViews) { if (uid === except) continue; for (const [x, y] of footprint(v.gx, v.gy, decorById(v.id)?.size ?? 1)) taken.add(`${x},${y}`); }
    return footprint(gx, gy, sz).every(([x, y]) => cellFree(x, y, this.campLevel) && !taken.has(`${x},${y}`));
  }
  private ghostCenter(): [number, number] { const g = this.ghostV; if (!g) return [0, 0]; return this.decorPos(g.id, g.gx, g.gy); }
  /** hayalet süs: yeni yerleştirme ya da taşıma (uid). Hücre verilmezse ekran ortasına en yakın boş hücre. */
  setGhost(g: { id: string; flip: boolean; uid?: number; gx?: number; gy?: number } | null): { gx: number; gy: number; ok: boolean } | null {
    if (this.ghostV) { const old = this.ghostV; old.img.destroy(); old.foot.destroy(); if (old.uid != null) this.decorViews.get(old.uid)?.img.setVisible(true); this.ghostV = undefined; }
    if (!g) return null;
    let gx = g.gx, gy = g.gy;
    if (gx == null || gy == null) {
      // alt panel ekranın alt yarısını örter: hayalet ekranın üst üçte birine yakın bir boş hücreye konur
      const cam = this.cameras.main; const [cx, cy] = pointCell(cam.midPoint.x, cam.midPoint.y - (cam.height / cam.zoom) * 0.12); gx = cx; gy = cy;
      outer: for (let r = 0; r < 14; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) { if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue; if (this.decorFits(g.id, cx + i, cy + j, g.uid)) { gx = cx + i; gy = cy + j; break outer; } }
    }
    const img = this.add.image(0, 0, this.decorTex(g.id)).setAlpha(0.85);
    const foot = this.add.graphics();
    this.ghostV = { img, foot, id: g.id, gx, gy, flip: g.flip, uid: g.uid, ok: false };
    if (g.uid != null) this.decorViews.get(g.uid)?.img.setVisible(false);
    if (!this.opts.reducedMotion) this.tweens.add({ targets: img, alpha: { from: 0.95, to: 0.65 }, duration: 700, yoyo: true, repeat: -1 });
    const r = this.moveGhost(gx, gy, true);
    const [px, py] = this.decorPos(g.id, gx, gy); const cam = this.cameras.main; this.restoreCam = null;
    cam.pan(px, py + (cam.height / cam.zoom) * 0.14, this.opts.reducedMotion ? 1 : 350, 'Sine.easeInOut', true);
    return r;
  }
  /** hayaleti hücreye taşı (geçerliyse yeşil, değilse kırmızı taban) */
  moveGhost(gx: number, gy: number, force = false): { gx: number; gy: number; ok: boolean } | null {
    const g = this.ghostV; if (!g) return null;
    if (!force && g.gx === gx && g.gy === gy) return { gx, gy, ok: g.ok };
    g.gx = gx; g.gy = gy; g.ok = this.decorFits(g.id, gx, gy, g.uid);
    this.placeDecorImg(g.img, g.id, gx, gy, g.flip); g.img.setDepth(DEPTH.ui - 20);
    const f = g.foot; f.clear(); f.setDepth(DEPTH.ui - 21);
    const sz = decorById(g.id)?.size ?? 1; const col = g.ok ? 0x3ccf7e : 0xff5c5c;
    // çevre ızgarası (yakın hücreler soluk) + kapladığı hücreler renkli
    f.lineStyle(1, 0xffffff, 0.22);
    for (let i = -2; i < sz + 2; i++) for (let j = -2; j < sz + 2; j++) { const [x, y] = cellPoint(gx + i, gy + j); f.strokePoints([{ x, y: y - 8 }, { x: x + 16, y }, { x, y: y + 8 }, { x: x - 16, y }], true); }
    for (const [cx, cy] of footprint(gx, gy, sz)) { const [x, y] = cellPoint(cx, cy); f.fillStyle(col, 0.45); f.fillPoints([{ x, y: y - 8 }, { x: x + 16, y }, { x, y: y + 8 }, { x: x - 16, y }], true); f.lineStyle(1.6, col, 1); f.strokePoints([{ x, y: y - 8 }, { x: x + 16, y }, { x, y: y + 8 }, { x: x - 16, y }], true); }
    this.opts.onGhost?.({ gx, gy, ok: g.ok });
    return { gx, gy, ok: g.ok };
  }
  /** hayaleti çevir */
  flipGhost(): boolean { const g = this.ghostV; if (!g) return false; g.flip = !g.flip; g.img.setFlipX(g.flip); return g.flip; }
  ghostState(): { id: string; gx: number; gy: number; flip: boolean; ok: boolean; uid?: number } | null { const g = this.ghostV; return g ? { id: g.id, gx: g.gx, gy: g.gy, flip: g.flip, ok: g.ok, ...(g.uid != null ? { uid: g.uid } : {}) } : null; }
  /** süsün ekran noktası (oyun pikseli) */
  decorPoint(uid: number): { x: number; y: number } | null { const v = this.decorViews.get(uid); if (!v) return null; const cam = this.cameras.main; const [x, y] = this.decorPos(v.id, v.gx, v.gy); return { x: (x - cam.worldView.x) * cam.zoom, y: (y - 12 - cam.worldView.y) * cam.zoom }; }
  /** hayaletin ekran noktası */
  ghostPoint(): { x: number; y: number } | null { if (!this.ghostV) return null; const cam = this.cameras.main; const [x, y] = this.ghostCenter(); return { x: (x - cam.worldView.x) * cam.zoom, y: (y - 12 - cam.worldView.y) * cam.zoom }; }
  /** yeni süs yerleşti: parıltı */
  decorPlaced(uid: number) { const v = this.decorViews.get(uid); if (!v) return; const [x, y] = this.decorPos(v.id, v.gx, v.gy); const p = this.add.particles(x, y - 14, ATLAS, { frame: 'c-sparkle', speed: { min: 30, max: 90 }, lifespan: 700, scale: { start: 0.5, end: 0 }, blendMode: 'ADD', tint: [0xffc93c, 0x8ef0b0, 0xffffff], emitting: false }).setDepth(DEPTH.fx); p.explode(this.opts.reducedMotion ? 6 : 18); this.time.delayedCall(800, () => p.destroy()); this.bounceImg(v.img); }

  // ------------------------------------------------------------------ tüy hücresi yardımcıları (Kamp Seviyesi ve Park ile çoğalır)
  private syncHelpers() {
    const park = this.opts.camp.buildings.find((b) => b.id === 'park')?.level ?? 0;
    const want = Math.min(10, 1 + Math.floor(this.campLevel / 3) + Math.floor(park / 4));
    while (this.helpers.length < want) {
      const i = this.helpers.length; const [x, y] = this.landPoint();
      const sprite = this.add.image(x, y, ATLAS, `c-tuy-${i % HELPER_COLORS.length}-0`).setOrigin(0.5, 0.9).setScale(1 / TEX * 1.15).setDepth(y);
      const h: Helper = { sprite, c: i % HELPER_COLORS.length, f: 0, t: 0, walking: false };
      this.helpers.push(h); this.time.delayedCall(400 + i * 350, () => this.helperWalk(h));
    }
  }
  /** açık arazide rastgele bir nokta (arsalar dışında) */
  private landPoint(): [number, number] {
    const open = [...this.dviews.values()].filter((d) => d.open).map((d) => d.d);
    for (let k = 0; k < 30; k++) {
      const useD = open.length && Math.random() < 0.35 ? open[Math.floor(Math.random() * open.length)]! : null;
      const x = useD ? useD.cx + (Math.random() - 0.5) * useD.rx * 1.4 : (Math.random() - 0.5) * ISLAND.rx * 1.5;
      const y = useD ? useD.cy + (Math.random() - 0.5) * useD.ry * 1.4 : ISLAND.cy + (Math.random() - 0.5) * ISLAND.ry * 1.4;
      const ok = useD ? inDistrict(useD, x, y, 0.75) : onIsland(x, y, 0.8);
      if (ok && !BUILDING_ORDER.some((id) => { const l = LOTS[id]; return Math.abs(x - l.x) < 70 && Math.abs(y - l.y) < 40; })) return [x, y];
    }
    return [0, 60];
  }
  private helperWalk(h: Helper) {
    if (!h.sprite.active) return;
    const s = h.sprite; let [x, y] = this.landPoint();
    // yakın bir hedef (aynı kara parçasında kalsın): uzaksa yarı yola
    if (Math.hypot(x - s.x, y - s.y) > 260) { x = s.x + (x - s.x) * 0.3; y = s.y + (y - s.y) * 0.3; if (!onIsland(x, y, 0.85) && ![...this.dviews.values()].some((d) => d.open && inDistrict(d.d, x, y, 0.8))) { x = s.x; y = s.y; } }
    s.setFlipX(x < s.x); h.walking = true;
    h.tw = this.tweens.add({ targets: s, x, y, duration: Math.max(400, Math.hypot(x - s.x, (y - s.y) * 2) * 55), onUpdate: () => s.setDepth(s.y), onComplete: () => {
      h.walking = false; s.setFrame(`c-tuy-${h.c}-0`, false, false);
      // durup dinler: tüyleri titrer, bazen nota çıkar
      if (!this.opts.reducedMotion && Math.random() < 0.4) { const n = this.add.image(s.x, s.y - 18, ATLAS, `c-note-${Math.floor(Math.random() * 4)}`).setScale(0.4).setDepth(DEPTH.fx); this.tweens.add({ targets: n, y: n.y - 26, alpha: { from: 1, to: 0 }, duration: 1600, onComplete: () => n.destroy() }); }
      h.tw = this.tweens.add({ targets: s, scaleY: s.scaleY * 0.92, duration: 260, yoyo: true, repeat: 2, onComplete: () => this.helperWalk(h) });
    } });
  }

  // ------------------------------------------------------------------ Kütüphane okuma köşesi (Kamp XP)
  private ensureLib() {
    const v = this.views.get('kutuphane');
    if (this.libBubble) { this.libBubble.bubble.destroy(); this.libBubble = undefined; }
    this.hots = this.hots.filter((h) => h.owner !== 'lib');
    if (!v || v.level <= 0 || this.opts.readOnly) return;
    const l = LOTS.kutuphane; const s = v.sprite; const topY = s.y - s.originY * s.displayHeight;
    const bg = this.add.image(0, 0, ATLAS, 'c-bubble-s').setScale(1 / TEX).setOrigin(0.5, 1);
    const icon = this.add.image(-6, -18, ATLAS, 'c-book').setScale(1 / TEX * 1.1);
    const text = this.add.text(9, -18, '', { fontFamily: FONT, fontSize: '11px', fontStyle: '900', color: '#2d1d6e' }).setOrigin(0.5).setResolution(this.dpr * 1.5);
    const bubble = this.add.container(l.x + 8, topY - 4, [bg, icon, text]).setDepth(DEPTH.ui).setVisible(false);
    if (!this.opts.reducedMotion) this.tweens.add({ targets: bubble, y: topY - 10, duration: 720, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.libBubble = { bubble, text };
    this.hots.push({ owner: 'lib', x: () => bubble.x, y: () => bubble.y - 16 * this.uiScale, r: 22, act: () => this.opts.onCollectLib?.(), visible: () => bubble.visible });
    this.updateLib(this.opts.now());
  }
  private updateLib(now: number) {
    const lb = this.libBubble; if (!lb) return; const v = this.views.get('kutuphane'); if (!v) return;
    const st = libStored(v.level, this.opts.camp.libAt ?? 0, now);
    lb.bubble.setVisible(st.stored >= Math.max(1, st.max * 0.1) && !v.build); lb.text.setText(`+${st.stored}`);
  }
  /** Kütüphane toplandı: XP notaları uçar */
  libCollected(n: number) {
    const l = LOTS.kutuphane; const x = l.x, y = l.y - 40;
    for (let i = 0; i < Math.min(10, 3 + Math.round(n / 6)); i++) { const d = this.add.image(x + (Math.random() - 0.5) * 24, y, ATLAS, 'c-book').setScale(1 / TEX).setDepth(DEPTH.fx); this.tweens.add({ targets: d, y: y - 50 - Math.random() * 30, x: d.x + (Math.random() - 0.5) * 50, alpha: { from: 1, to: 0 }, duration: 900, delay: i * 50, ease: 'Quad.Out', onComplete: () => d.destroy() }); }
    this.floatText(x, y - 36, `+${n} XP`, '#c8b6ff', 20);
    this.updateLib(this.opts.now());
  }

  // ------------------------------------------------------------------ dış yardımcılar
  bounce(id: BuildingId) {
    const v = this.views.get(id); if (!v) return; const s = v.sprite; const sx = BS[id] / TEX;
    this.tweens.killTweensOf(s); s.setScale(sx);
    this.tweens.add({ targets: s, scaleX: sx * 1.06, scaleY: sx * 0.93, duration: 90, yoyo: true, ease: 'Quad.Out', onComplete: () => this.tweens.add({ targets: s, scaleY: sx * 1.04, duration: 110, yoyo: true }) });
    const gl = this.add.image(s.x, s.y - 4, ATLAS, 'c-ring').setScale(0.3 * (LOTS[id].tiles / 2)).setTint(0xffc93c).setBlendMode(Phaser.BlendModes.ADD).setDepth(s.depth - 0.5);
    this.tweens.add({ targets: gl, scale: 0.9 * (LOTS[id].tiles / 2), alpha: { from: 1, to: 0 }, duration: 500, onComplete: () => gl.destroy() });
  }
  /** binanın tepe noktası: oyun pikseli (kanvas içi) */
  /** kamera duruyor mu: odak/bölge geçişi ve kaydırma ataleti bitti (ekran konumları artık kaymaz) */
  camStill(): boolean { return !this.cameras.main.panEffect.isRunning && this.pointers.size === 0 && Math.abs(this.vel.x) <= 0.05 && Math.abs(this.vel.y) <= 0.05; }
  screenPoint(id: BuildingId): { x: number; y: number } | null {
    const v = this.views.get(id); if (!v) return null; const cam = this.cameras.main; const s = v.sprite;
    const wy = s.y - s.originY * s.displayHeight * 0.6;
    return { x: (s.x - cam.worldView.x) * cam.zoom, y: (wy - cam.worldView.y) * cam.zoom };
  }
  /** anıtın orta noktası: oyun pikseli (kanvas içi) */
  monumentPoint(region: string): { x: number; y: number } | null {
    const m = this.monuments.get(region); if (!m) return null; const cam = this.cameras.main;
    return { x: (m.img.x - cam.worldView.x) * cam.zoom, y: (m.img.y - 24 - cam.worldView.y) * cam.zoom };
  }
  /** binaya kaydır; above: alttan açılan panel için binayı ekranın üst kısmına al */
  private restoreCam: { x: number; y: number } | null = null;
  focus(id: BuildingId, above = false) {
    const l = LOTS[id]; const cam = this.cameras.main; const v = this.views.get(id);
    if (above && !this.restoreCam) this.restoreCam = { x: cam.midPoint.x, y: cam.midPoint.y };
    const midY = v ? v.sprite.y - v.sprite.originY * v.sprite.displayHeight * 0.5 : l.y - 30;
    const viewH = cam.height / cam.zoom;
    cam.pan(l.x, above ? midY + viewH * 0.2 : midY, 450, 'Sine.easeInOut', true);
  }
  unfocus() {
    const r = this.restoreCam; this.restoreCam = null; if (!r) return;
    this.cameras.main.pan(r.x, r.y, 400, 'Sine.easeInOut', true);
  }
}
