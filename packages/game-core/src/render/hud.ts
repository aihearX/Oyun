/**
 * Oyun içi gösterge (HUD): koyu cam paneller + altın. Nota sayacı (uçan nota), 3 altın koklea yuvası, canlar, kalkanlar,
 * ilerleme çubuğu (kontrol noktası çentikleri, yarış hayaletleri), seri/çarpan rozeti ve övgü sözleri, duraklat düğmesi,
 * öğretici el işareti. Ekran-sabit (scrollFactor 0); kamera yakınlaştırması/kökeni ne olursa olsun tasarım biriminde konumlanır.
 */
import Phaser from 'phaser';
import { I, R, T, glassPanel, drawGoldNote, drawGoldCochlea, drawMelodyNote, softGlowTex, sparkTex, ringTex } from './tex';
import { css, FONT, heartPath, screenOrigin, THEME, type Ctx } from './util';
import { motionReduced } from './flash';
import { spiritTex } from './mech';
import { paintWarning } from './patoloji';
import type { Box } from './float-lane';
import { dropBelow, praiseY } from './hud-yer';

const ADD = Phaser.BlendModes.ADD;
/** koklea yuvası ölçeği: üç yuva + "n/3" yazısı nota ve can panelleri arasına aralıklı sığsın */
const COCH_K = 0.84;
/** yuva dolunca açılan halkanın son ölçeği (128 px doku → ~31 px): koklea panelinin içinde kalır, nota kutusuna taşmaz */
const COCH_RING = 0.24;
export type HintKind = 'tap' | 'hold' | 'swipeDown' | 'swipeRight' | 'swipeLeft';
/** Fısıltıyı Taşı göstergesi: yanında / tehlikede (düşman yaklaşıyor) / yolda kaldı (simge gri); null gizler */
export type EscortHud = 'ok' | 'danger' | 'lost' | null;
export interface GhostMark { id: string; pct: number; color: number; label?: string }
/** melodi hapının durumu (YN-183): sırada / sıra bozuldu (kalıcı) / sıradaki nota geride (dönülebilir) */
export type MelodyHud = 'ok' | 'broken' | 'behind';

// ---------------------------------------------------------------- dokular
const panelTex = (s: Phaser.Scene, w: number, h: number, r: number) => T(s, `hud-panel-${w}x${h}-${r}`, w + 16, h + 16, (ctx) => glassPanel(ctx, 8, 6, w, h, r));
const noteIcon = (s: Phaser.Scene) => T(s, 'hud-note', 30, 32, (ctx) => drawGoldNote(ctx, 15, 16, 24, false));
// bulunan altın koklea dolu ve parlak; bulunmayan yalnız açık çerçeve + sarmal çizgisi (dolgu yok: ikisi bir bakışta ayrılır)
const cochleaIcon = (s: Phaser.Scene, lit: boolean) => T(s, `hud-coch-${lit ? 1 : 'cerceve'}`, 34, 34, (ctx) => {
  if (lit) { drawGoldCochlea(ctx, 17, 17, 10, true); return; }
  ctx.beginPath(); ctx.arc(17, 17, 9.4, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(201,193,255,0.85)'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.save(); ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = 0; i <= 60; i++) { const a = (i / 60) * Math.PI * 4.4; const r = 7.6 * (1 - i / 70); const x = 17 + Math.cos(a) * r, y = 17 + Math.sin(a) * r; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.strokeStyle = 'rgba(201,193,255,0.6)'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
});
/** süre göstergesinin kronometresi (çizili simge) */
const clockTex = (s: Phaser.Scene) => T(s, 'hud-saat', 26, 28, (ctx) => {
  ctx.fillStyle = css(THEME.gold); ctx.beginPath(); ctx.roundRect(10, 1.5, 6, 3.5, 1.2); ctx.fill();
  ctx.beginPath(); ctx.arc(13, 16, 10, 0, Math.PI * 2); ctx.fillStyle = css(0x140c35, 0.6); ctx.fill(); ctx.strokeStyle = css(THEME.gold); ctx.lineWidth = 2.2; ctx.stroke();
  ctx.strokeStyle = '#fff6e5'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(13, 16); ctx.lineTo(13, 9.5); ctx.moveTo(13, 16); ctx.lineTo(17.5, 18.5); ctx.stroke();
});
const heartIcon = (s: Phaser.Scene, full: boolean) => T(s, `hud-heart-${full ? 1 : 0}`, 26, 24, (ctx) => {
  if (full) {
    ctx.save(); ctx.translate(0.8, 1.4); heartPath(ctx, 13, 12, 20); ctx.fillStyle = 'rgba(60,0,20,0.5)'; ctx.fill(); ctx.restore();
    heartPath(ctx, 13, 12, 20); const g = ctx.createLinearGradient(0, 2, 0, 22); g.addColorStop(0, '#ffb3c8'); g.addColorStop(0.45, css(THEME.coral)); g.addColorStop(1, '#c0204e'); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#6a0a28'; ctx.lineWidth = 1.3; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(8.4, 7.6, 2.6, 1.6, -0.6, 0, Math.PI * 2); ctx.fill();
  } else { heartPath(ctx, 13, 12, 20); ctx.fillStyle = 'rgba(20,10,60,0.6)'; ctx.fill(); ctx.strokeStyle = 'rgba(201,193,255,0.45)'; ctx.lineWidth = 1.4; ctx.stroke(); }
});
/** kalkan sayacının baloncuğu: Odi'nin çevresindeki kalkanla aynı camgöbeği baloncuk (hero.ts shieldTex), küçük */
const shieldIcon = (s: Phaser.Scene) => T(s, 'hud-kalkan', 28, 28, (ctx) => {
  const g = ctx.createRadialGradient(14, 14, 5, 14, 14, 12); g.addColorStop(0, 'rgba(46,230,214,0.12)'); g.addColorStop(0.75, 'rgba(46,230,214,0.4)'); g.addColorStop(1, 'rgba(200,255,250,0.85)');
  ctx.beginPath(); ctx.arc(14, 14, 11.5, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#dcfffc'; ctx.lineWidth = 1.8; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(14, 14, 7.5, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
});
const pauseTex = (s: Phaser.Scene) => T(s, 'hud-pause', 56, 56, (ctx) => {
  ctx.save(); ctx.shadowColor = 'rgba(5,0,25,0.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; ctx.beginPath(); ctx.arc(28, 27, 20, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(0, 7, 0, 47); g.addColorStop(0, css(0x3a2788, 0.92)); g.addColorStop(1, css(0x1a1046, 0.94)); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.arc(28, 27, 19.2, 0, Math.PI * 2); ctx.strokeStyle = css(THEME.gold, 0.75); ctx.lineWidth = 1.6; ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.arc(28, 27, 19, 0, Math.PI * 2); ctx.clip(); const sh = ctx.createLinearGradient(0, 7, 0, 27); sh.addColorStop(0, 'rgba(255,255,255,0.18)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sh; ctx.fillRect(0, 0, 56, 27); ctx.restore();
  for (const x of [21.5, 30.5]) { ctx.beginPath(); ctx.roundRect(x, 18, 4.5, 18, 2.2); const b = ctx.createLinearGradient(0, 18, 0, 36); b.addColorStop(0, '#fff3b0'); b.addColorStop(1, css(THEME.gold)); ctx.fillStyle = b; ctx.fill(); }
});
const barTrackTex = (s: Phaser.Scene) => T(s, 'hud-track', 64, 16, (ctx) => {
  ctx.beginPath(); ctx.roundRect(1, 2, 62, 12, 6); ctx.fillStyle = css(0x120a36, 0.82); ctx.fill(); ctx.strokeStyle = css(THEME.gold, 0.45); ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(3, 4, 58, 3, 1.5); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
});
const barFillTex = (s: Phaser.Scene) => T(s, 'hud-fill', 64, 12, (ctx) => {
  ctx.beginPath(); ctx.roundRect(1, 1, 62, 10, 5); const g = ctx.createLinearGradient(0, 1, 0, 11); g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, css(THEME.gold)); g.addColorStop(1, css(THEME.gold2)); ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.roundRect(4, 2.5, 56, 2.2, 1.1); ctx.fill();
});
const tickTex = (s: Phaser.Scene, lit: boolean) => T(s, `hud-tick-${lit ? 1 : 0}`, 14, 14, (ctx) => {
  ctx.beginPath(); ctx.moveTo(7, 1.5); ctx.lineTo(12.5, 7); ctx.lineTo(7, 12.5); ctx.lineTo(1.5, 7); ctx.closePath();
  ctx.fillStyle = lit ? css(THEME.gold) : css(0x2a1b63); ctx.fill(); ctx.strokeStyle = lit ? '#fff3b0' : 'rgba(201,193,255,0.7)'; ctx.lineWidth = 1.3; ctx.stroke();
});
const flagTex = (s: Phaser.Scene) => T(s, 'hud-flag', 18, 22, (ctx) => {
  ctx.strokeStyle = '#fff6e5'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(4, 21); ctx.lineTo(4, 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(5, 2.5); ctx.lineTo(16, 5.5); ctx.lineTo(5, 10); ctx.closePath(); ctx.fillStyle = css(THEME.coral); ctx.fill();
});
const markerTex = (s: Phaser.Scene, c: number) => T(s, `hud-mark-${c.toString(16)}`, 22, 22, (ctx) => {
  ctx.beginPath(); ctx.arc(11, 11, 7.5, 0, Math.PI * 2); const g = ctx.createRadialGradient(9, 8, 1, 11, 11, 8); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, css(c)); g.addColorStop(1, css(c)); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#fff6e5'; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = 'rgba(10,0,30,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(11, 11, 9, 0, Math.PI * 2); ctx.stroke();
});
/** melodi sayacının simgesi: sahnedeki melodi notasıyla aynı çizim (camgöbeği nota + halka) */
const melodyIcon = (s: Phaser.Scene) => T(s, 'hud-melodi', 28, 28, (ctx) => drawMelodyNote(ctx, 14, 14, 16));
/** melodi hapında geride kalan notanın yönü: sola bakan kalın ok (amber, koyu çerçeve; emoji değil) */
const backArrowTex = (s: Phaser.Scene) => T(s, 'hud-geri-ok', 28, 28, (ctx) => {
  ctx.beginPath(); ctx.moveTo(3, 14); ctx.lineTo(13, 4.5); ctx.lineTo(13, 10); ctx.lineTo(25, 10); ctx.lineTo(25, 18); ctx.lineTo(13, 18); ctx.lineTo(13, 23.5); ctx.closePath();
  ctx.lineJoin = 'round'; ctx.strokeStyle = '#140c35'; ctx.lineWidth = 4; ctx.stroke(); ctx.fillStyle = '#ffe08a'; ctx.fill();
});
/** değiştirici rozetinin çizili simgeleri (22×22, krem çizgi; emoji yok) */
const modIcon = (s: Phaser.Scene, id: string) => T(s, `hud-mod-${id}`, 22, 22, (ctx) => {
  ctx.strokeStyle = '#fff6e5'; ctx.fillStyle = '#fff6e5'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const line = (pts: number[]) => { ctx.beginPath(); ctx.moveTo(pts[0]!, pts[1]!); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!); ctx.stroke(); };
  switch (id) {
    case 'hiz': line([4, 5, 10, 11, 4, 17]); line([11, 5, 17, 11, 11, 17]); break;
    case 'sis': for (const y of [6, 11, 16]) { ctx.beginPath(); ctx.moveTo(3, y); ctx.bezierCurveTo(7, y - 3, 10, y + 3, 14, y); ctx.bezierCurveTo(16, y - 2, 18, y - 1, 19, y); ctx.stroke(); } break;
    case 'gece': ctx.beginPath(); ctx.arc(11, 11, 8, 0.6, Math.PI * 2 - 0.6, false); ctx.arc(15, 8, 6.4, Math.PI * 2 - 1.2, 1.9, true); ctx.closePath(); ctx.fill(); break;
    case 'yanki': ctx.beginPath(); ctx.arc(5, 11, 2, 0, Math.PI * 2); ctx.fill(); for (const r of [6, 10, 14]) { ctx.beginPath(); ctx.arc(5, 11, r, -0.75, 0.75); ctx.stroke(); } break;
    case 'ayna': line([11, 3, 11, 19]); ctx.beginPath(); ctx.moveTo(8, 6); ctx.lineTo(2, 11); ctx.lineTo(8, 16); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(14, 6); ctx.lineTo(20, 11); ctx.lineTo(14, 16); ctx.closePath(); ctx.stroke(); break;
    case 'tek-can': heartPath(ctx, 11, 11, 17); ctx.fill(); break;
    case 'ters-yercekimi': line([7, 18, 7, 4]); line([3, 8, 7, 4, 11, 8]); line([15, 4, 15, 18]); line([11, 14, 15, 18, 19, 14]); break;
    case 'cihaz-kapali': ctx.beginPath(); ctx.moveTo(3, 8); ctx.lineTo(7, 8); ctx.lineTo(11, 4); ctx.lineTo(11, 18); ctx.lineTo(7, 14); ctx.lineTo(3, 14); ctx.closePath(); ctx.fill(); line([14, 8, 20, 14]); line([20, 8, 14, 14]); break;
    default: ctx.beginPath(); ctx.arc(11, 11, 7, 0, Math.PI * 2); ctx.stroke(); break;
  }
});
/**
 * Bölge patolojisi uyarı simgesi (YN-119): pembe üçgen içinde "!" (çizili; emoji ya da tıbbi artı değil: artı "ödül" gibi
 * okunuyordu). Engelin üstündeki rozetle aynı çizim (render/patoloji.ts `paintWarning`).
 */
const warnTex = (s: Phaser.Scene) => T(s, 'hud-uyari', 30, 28, (ctx) => paintWarning(ctx, 15, 15, 26));
const handTex = (s: Phaser.Scene) => T(s, 'hud-hand', 70, 92, (ctx) => paintHand(ctx));
function paintHand(ctx: Ctx) {
  // işaret parmağı yukarıda, sevimli eldiven el
  const p = () => {
    ctx.beginPath();
    ctx.moveTo(27, 8); ctx.quadraticCurveTo(27, 2, 33, 2); ctx.quadraticCurveTo(39, 2, 39, 8); ctx.lineTo(39, 38);
    ctx.quadraticCurveTo(40, 32, 46, 33); ctx.quadraticCurveTo(51, 34, 50.5, 41);
    ctx.quadraticCurveTo(52, 36, 57, 38); ctx.quadraticCurveTo(61, 40, 60.5, 46);
    ctx.quadraticCurveTo(62, 43, 65, 45.5); ctx.quadraticCurveTo(68, 48, 67, 56);
    ctx.lineTo(65, 70); ctx.quadraticCurveTo(62, 84, 48, 86); ctx.lineTo(34, 86); ctx.quadraticCurveTo(22, 85, 16, 74);
    ctx.lineTo(6, 56); ctx.quadraticCurveTo(3, 50, 8, 47); ctx.quadraticCurveTo(13, 45, 17, 51); ctx.lineTo(27, 62); ctx.closePath();
  };
  ctx.save(); ctx.shadowColor = 'rgba(5,0,25,0.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4; p(); ctx.fillStyle = '#fff6e5'; ctx.fill(); ctx.restore();
  p(); const g = ctx.createLinearGradient(10, 0, 66, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e8dcf8'); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#2a1b63'; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.strokeStyle = 'rgba(42,27,99,0.55)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (const [x0, y0, y1] of [[39, 40, 52], [50.5, 43, 55], [60.5, 48, 58]] as [number, number, number][]) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(31, 12, 2, 5, 0, 0, Math.PI * 2); ctx.fill();
  // bileklik (altın)
  ctx.beginPath(); ctx.roundRect(22, 80, 40, 10, 4); const b = ctx.createLinearGradient(0, 80, 0, 90); b.addColorStop(0, '#fff3b0'); b.addColorStop(1, css(THEME.gold2)); ctx.fillStyle = b; ctx.fill(); ctx.strokeStyle = '#8a4500'; ctx.lineWidth = 1.4; ctx.stroke();
}
const chevTex = (s: Phaser.Scene) => T(s, 'hud-chev', 24, 24, (ctx) => { ctx.strokeStyle = '#fff6e5'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(6, 4); ctx.lineTo(16, 12); ctx.lineTo(6, 20); ctx.stroke(); });
const arcTex = (s: Phaser.Scene) => T(s, 'hud-arc', 64, 64, (ctx) => { ctx.strokeStyle = css(THEME.gold); ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(32, 32, 26, -Math.PI / 2, Math.PI * 1.5); ctx.stroke(); });

// ---------------------------------------------------------------- HUD
export class LevelHud {
  readonly root: Phaser.GameObjects.Container;
  private w: number; private h: number;
  private notesPanel: Phaser.GameObjects.Image; private noteIco: Phaser.GameObjects.Image; private notesText: Phaser.GameObjects.Text; private notesTotal: Phaser.GameObjects.Text;
  private cochPanel: Phaser.GameObjects.Image; private coch: Phaser.GameObjects.Image[] = []; private cochOn: Phaser.GameObjects.Image[] = []; private cochText: Phaser.GameObjects.Text; private cochTotal = 3;
  /**
   * süreli bölümün geri sayımı (ikinci satırın ortası); yalnız setTimer çağrılırsa görünür. Süre yalnız 3. yıldızın koşulu: panelde
   * "3. yıldız" etiketi yazar (OT-ilk-kez-oyun-47: oyuncu süre bitince kaybedeceğini sandı)
   */
  private timerPanel: Phaser.GameObjects.Image; private timerIco: Phaser.GameObjects.Image; private timerLabel: Phaser.GameObjects.Text; private timerText: Phaser.GameObjects.Text; private timerShown = -999;
  /** eskort bölümünde fısıltının durumu (ikinci satırın solu; sesi kapalı oyuncu da tehlikeyi ve kaybı görsün) */
  private escPanel: Phaser.GameObjects.Image; private escIco: Phaser.GameObjects.Image; private escText: Phaser.GameObjects.Text; private escState: EscortHud = null;
  /** bölüm değiştiricileri (YN-102): ikinci satırın solunda küçük kalıcı rozet (çizili simge + ad); süre/fısıltı varsa bir alt satıra iner */
  private modPanel: Phaser.GameObjects.Image; private modIcons: Phaser.GameObjects.Image[] = []; private modText: Phaser.GameObjects.Text; private modShown = false;
  /**
   * melodi hedefi (YN-102): "Nota 3/8" sayacı baştan sona (ikinci satırın ortası; süre de varsa bir alt satır). Sıra bozulunca
   * kalıcı olarak "Sıra bozuldu · 2/8" (pembe yazı, gri nota); sıradaki nota geride ve dönülebiliyorsa sola ok + "3. nota geride" (YN-183)
   */
  private melPanel: Phaser.GameObjects.Image; private melIco: Phaser.GameObjects.Image; private melText: Phaser.GameObjects.Text; private melKey = '';
  /** bölüm başı değiştirici duyurusu (göstergenin altında, birkaç saniye) */
  private announceC?: Phaser.GameObjects.Container;
  /** bölge patolojisi adı (üst bantta, Odi'nin ve yolun üstünde değil); aynı anda birden çoksa sırayla */
  private pathoC?: Phaser.GameObjects.Container; private pathoQ: string[] = [];
  /** nota ve koklea panellerinin görünür genişliği (içeriğe göre büyür; Büyük yazıda yazılar büyüdüğü için) */
  private notesW = 112; private cochW = 92;
  /** bölüm başı kalkanlar (YN-099): ikinci satırın sağında baloncuk + "×2"; kalkan yoksa gizli (seri rozeti o zaman yukarıda) */
  private shieldPanel: Phaser.GameObjects.Image; private shieldIco: Phaser.GameObjects.Image; private shieldText: Phaser.GameObjects.Text; private shields = 0;
  /** canavar bölümü: can çubuğunun alt kenarı (kamera tasarım px'i); kalkan sayacı ikinci satır yerine onun altında, sağda */
  private bossBottom: number | null = null;
  private livesPanel: Phaser.GameObjects.Image; private hearts: Phaser.GameObjects.Image[] = []; private heartsOff: Phaser.GameObjects.Image[] = []; private lives = 3;
  /** can yuvası sayısı: bölümde görülen en yüksek can (en az 3, en çok 5); Rahat denemenin fazladan canı hasardan sonra boş yuva olarak kalır (OT-ilk-kez-oyun-49) */
  private slots = 3; private heartK = 1;
  private pause: Phaser.GameObjects.Image; private pauseCb: (() => void) | null = null;
  private bar: Phaser.GameObjects.Container; private track: Phaser.GameObjects.NineSlice | Phaser.GameObjects.Image; private fill: Phaser.GameObjects.NineSlice | Phaser.GameObjects.Image; private head: Phaser.GameObjects.Image; private headDot: Phaser.GameObjects.Arc; private flag: Phaser.GameObjects.Image;
  private ticks: { pct: number; off: Phaser.GameObjects.Image; on: Phaser.GameObjects.Image }[] = []; private ghosts = new Map<string, Phaser.GameObjects.Container>();
  private combo: Phaser.GameObjects.Container; private comboBg: Phaser.GameObjects.Image; private comboMult: Phaser.GameObjects.Text; private comboCount: Phaser.GameObjects.Text; private comboShown = false; private comboW = 96;
  private hint?: Phaser.GameObjects.Container; private hintTweens: Phaser.Tweens.Tween[] = []; private hintTimer?: Phaser.Time.TimerEvent;
  private toastC?: Phaser.GameObjects.Container; private toastTimer?: Phaser.Time.TimerEvent;
  private pct = 0; private notes = 0;
  private barX = 16; private barY = 0; private barW = 0; private k = 1;

  /** ts: yazı ölçeği (Büyük yazı: 1,2) — sayaç, koklea sayısı, süre, bilgi şeridi ve öğretici yazısı büyür; paneller içeriğe göre genişler */
  constructor(private scene: Phaser.Scene, private top = 0, heroColor = 0x6c4cf1, private ts = 1) {
    const s = scene; const cam = s.cameras.main; this.w = cam.width / cam.zoom; this.h = cam.height / cam.zoom;
    const O = screenOrigin(cam);
    this.root = s.add.container(O.x, O.y).setDepth(100).setScrollFactor(0);
    const txt = (size: number, color: string, weight = '900') => s.add.text(0, 0, '', { fontFamily: FONT, fontSize: `${Math.round(size * ts)}px`, fontStyle: weight, color, resolution: R() }).setOrigin(0, 0.5);
    // nota sayacı
    this.notesPanel = I(s, panelTex(s, 112, 40, 20)).setOrigin(0, 0);
    this.noteIco = I(s, noteIcon(s)).setOrigin(0.5);
    this.notesText = txt(20, '#fff6e5'); this.notesText.setStroke('#140c35', 4);
    this.notesTotal = txt(13, '#e4dcff', '800');
    // koklea yuvaları + "1/3"
    this.cochPanel = I(s, panelTex(s, 92, 40, 20)).setOrigin(0, 0);
    for (let i = 0; i < 3; i++) { this.coch.push(I(s, cochleaIcon(s, false)).setScale(COCH_K / R())); const on = I(s, cochleaIcon(s, true)).setScale(COCH_K / R()).setVisible(false); this.cochOn.push(on); }
    this.cochText = txt(15, '#fff6e5'); this.cochText.setStroke('#140c35', 4);
    // süre (yalnız süreli bölüm)
    this.timerPanel = I(s, panelTex(s, 100, 32, 16)).setOrigin(0.5).setVisible(false);
    this.timerIco = I(s, clockTex(s)).setVisible(false);
    this.timerLabel = txt(13, '#ffe08a', '800'); this.timerLabel.setStroke('#140c35', 4).setVisible(false);
    this.timerText = txt(18, '#fff6e5'); this.timerText.setStroke('#140c35', 4).setVisible(false);
    // fısıltı (yalnız eskort bölümü)
    this.escPanel = I(s, panelTex(s, 100, 32, 16)).setOrigin(0.5).setVisible(false);
    this.escIco = I(s, spiritTex(s)).setScale(0.62 / R()).setVisible(false);
    this.escText = txt(14, '#fff6e5', '800'); this.escText.setStroke('#140c35', 4).setVisible(false);
    // değiştirici rozeti ve melodi sayacı (yalnız ilgili bölümde)
    this.modPanel = I(s, panelTex(s, 100, 30, 15)).setOrigin(0.5).setVisible(false);
    this.modText = txt(13, '#fff6e5', '800'); this.modText.setStroke('#140c35', 4).setVisible(false);
    this.melPanel = I(s, panelTex(s, 100, 32, 16)).setOrigin(0.5).setVisible(false);
    this.melIco = I(s, melodyIcon(s)).setVisible(false);
    this.melText = txt(16, '#fff6e5'); this.melText.setStroke('#140c35', 4).setVisible(false);
    // kalkanlar (yalnız kalkan varken)
    this.shieldPanel = I(s, panelTex(s, 64, 32, 16)).setOrigin(0.5).setVisible(false);
    this.shieldIco = I(s, shieldIcon(s)).setVisible(false);
    this.shieldText = txt(17, '#dcfffc'); this.shieldText.setStroke('#140c35', 4).setVisible(false);
    // canlar
    this.livesPanel = I(s, panelTex(s, 86, 40, 20)).setOrigin(0, 0);
    for (let i = 0; i < 5; i++) { this.heartsOff.push(I(s, heartIcon(s, false))); this.hearts.push(I(s, heartIcon(s, true))); }
    // duraklat
    // duraklat: isabet testi oyunun girdi katmanında yapılır (pauseHit) — Phaser'ın kaydırma-çarpanı 0 + yakınlaştırılmış kamera
    // altındaki etkileşim eşlemesine güvenilmez (telefonda DPR > 1); dokunuş asla zıplama olarak da sayılmaz
    this.pause = I(s, pauseTex(s));
    // ilerleme çubuğu
    this.bar = s.add.container(0, 0);
    const RR = R(); const gl = !!(s.sys.renderer as { gl?: unknown }).gl;
    this.track = gl ? s.add.nineslice(0, 0, barTrackTex(s), undefined, 64 * RR, 16 * RR, 8 * RR, 8 * RR, 0, 0).setOrigin(0, 0.5).setScale(1 / RR) : I(s, barTrackTex(s)).setOrigin(0, 0.5);
    this.fill = gl ? s.add.nineslice(0, 0, barFillTex(s), undefined, 64 * RR, 12 * RR, 6 * RR, 6 * RR, 0, 0).setOrigin(0, 0.5).setScale(1 / RR) : I(s, barFillTex(s)).setOrigin(0, 0.5);
    this.head = s.add.image(0, 0, softGlowTex(s)).setBlendMode(ADD).setTint(THEME.gold).setDisplaySize(34, 34).setAlpha(0.85);
    this.headDot = s.add.circle(0, 0, 6.5, heroColor).setStrokeStyle(2, 0xfff6e5);
    this.flag = I(s, flagTex(s)).setOrigin(0.2, 0.95);
    this.bar.add([this.track, this.fill, this.flag, this.head, this.headDot]);
    // seri rozeti: "×2  Seri 5" tek satır; seri sayısı da okunur boyda (OT-sessiz-oyuncu-22: sesi kapalı oyuncu seriyi buradan izliyor)
    this.comboBg = I(s, panelTex(s, 96, 40, 16)).setOrigin(0.5);
    this.comboMult = s.add.text(0, -2, '×2', { fontFamily: FONT, fontSize: `${Math.round(26 * ts)}px`, fontStyle: '900', color: '#ffc93c', stroke: '#140c35', strokeThickness: 5, resolution: R() }).setOrigin(0, 0.5);
    this.comboCount = s.add.text(0, -2, 'Seri 12', { fontFamily: FONT, fontSize: `${Math.round(16 * ts)}px`, fontStyle: '900', color: '#fff6e5', stroke: '#140c35', strokeThickness: 4, resolution: R() }).setOrigin(0, 0.5);
    this.combo = s.add.container(0, 0, [this.comboBg, this.comboMult, this.comboCount]).setAlpha(0);
    this.root.add([this.notesPanel, this.noteIco, this.notesText, this.notesTotal, this.cochPanel, ...this.coch, ...this.cochOn, this.cochText, this.timerPanel, this.timerIco, this.timerLabel, this.timerText, this.escPanel, this.escIco, this.escText, this.modPanel, this.modText, this.melPanel, this.melIco, this.melText, this.shieldPanel, this.shieldIco, this.shieldText, this.livesPanel, ...this.heartsOff, ...this.hearts, this.pause, this.bar, this.combo]);
    this.root.setScrollFactor(0, 0, true);
    this.layout(); this.setNotes(0, 0); this.setCochleas(0); this.setLives(3); this.setProgress(0);
  }

  /** dar ekranda (tasarım genişliği < 390) tüm gösterge orantılı küçülür */
  private get iw() { return this.w / this.k; }
  private get ih() { return this.h / this.k; }
  private layout() {
    this.k = Math.min(1, this.w / 390); this.root.setScale(this.k);
    const t = this.top / this.k + 10; const W = this.iw;
    this.notesPanel.setPosition(4, t - 6); this.noteIco.setPosition(30, t + 20); this.notesText.setPosition(46, t + 19); this.positionTotal();
    this.pause.setPosition(W - 32, t + 19);
    this.placeHearts();
    this.fitTop();
    this.timerPanel.setPosition(W / 2, t + 88); this.placeTimer(); this.escPanel.y = t + 88; this.placeEscort(); this.placeRow2();
    this.barX = 18; this.barW = W - 36; this.barY = t + 58;
    this.bar.setPosition(this.barX, this.barY);
    this.setW(this.track, this.barW, 16); this.flag.setPosition(this.barW - 2, -3);
    for (const k of this.ticks) { k.off.setPosition(k.pct * this.barW, 0); k.on.setPosition(k.pct * this.barW, 0); }
    for (const [, g] of this.ghosts) g.x = (g.getData('pct') as number) * this.barW;
    this.placeShield();
    this.setProgress(this.pct);
  }
  private setW(o: Phaser.GameObjects.NineSlice | Phaser.GameObjects.Image, w: number, h: number) {
    if (o instanceof Phaser.GameObjects.NineSlice) { const RR = R(); o.setSize(Math.max(12, w) * RR, h * RR); } else o.setDisplaySize(Math.max(12, w), h);
  }
  private positionTotal() { this.notesTotal.setPosition(this.notesText.x + this.notesText.width + 2, this.notesText.y + 2); }
  /**
   * Üst satır: nota paneli içeriğine göre genişler, koklea paneli onun hemen sağında; can panelinin solunda kalsın diye
   * gerekirse koklea yuvaları sıklaşır (taşma yok). Panel dokusu 8 px gölge payıyla çizilir: görünür sol kenar = x + 8.
   */
  private fitTop() {
    const t = this.top / this.k + 10;
    const notesW = Math.max(112, Math.ceil((this.notesTotal.x + this.notesTotal.width + 10 - 12) / 4) * 4);
    if (notesW !== this.notesW) { this.notesW = notesW; this.notesPanel.setTexture(panelTex(this.scene, notesW, 40, 20)); }
    const left = 12 + this.notesW + 6; const limit = this.livesPanel.x + 8 - 6; const textW = this.cochText.width;
    // yuva aralığı 21 (sığmazsa en az 16; 4-5 can yuvasında can paneli genişler); yazı son yuvanın 11 px sağında
    const sp = Math.max(16, Math.min(21, (limit - left - 14 - 11 - textW - 9) / 2));
    const x0 = left + 14; this.coch.forEach((c, i) => { c.setPosition(x0 + i * sp, t + 20); this.cochOn[i]!.setPosition(x0 + i * sp, t + 20); });
    this.cochText.setPosition(x0 + 2 * sp + 11, t + 19);
    const cochW = Math.ceil((this.cochText.x + textW + 9 - left) / 4) * 4;
    if (cochW !== this.cochW) { this.cochW = cochW; this.cochPanel.setTexture(panelTex(this.scene, cochW, 40, 20)); }
    this.cochPanel.setPosition(left - 8, t - 6);
  }
  /**
   * Can paneli: yuva sayısı `slots`; 3'ten fazla yuvada kalpler küçülüp sıklaşır ve panel sola genişler (sağ kenarı ve duraklat
   * düğmesi yerinde kalır; koklea yuvaları fitTop'ta gerekirse sıklaşır).
   */
  private placeHearts() {
    const n = Math.max(3, Math.min(5, this.slots)); const sp = n <= 3 ? 25 : n === 4 ? 19 : 17; const pw = Math.max(86, (n - 1) * sp + 34);
    const hk = n <= 3 ? 1 : n === 4 ? 0.85 : 0.78;
    if (hk !== this.heartK) { this.heartK = hk; for (const h of [...this.hearts, ...this.heartsOff]) { this.scene.tweens.killTweensOf(h); h.setScale(hk / R()); } }
    if (this.livesPanel.getData('w') !== pw) { this.livesPanel.setData('w', pw); this.livesPanel.setTexture(panelTex(this.scene, pw, 40, 20)); }
    this.livesPanel.setPosition(this.iw - 68 - pw, this.top / this.k + 10 - 6);
    const x0 = this.livesPanel.x + 8 + pw / 2 - ((n - 1) * sp) / 2;
    for (let i = 0; i < 5; i++) { const vis = i < n; const x = x0 + i * sp, y = this.livesPanel.y + 26; this.heartsOff[i]!.setPosition(x, y).setVisible(vis); this.hearts[i]!.setPosition(x, y).setVisible(vis && i < this.lives); }
  }
  /** kısa zıplama; taban ölçek bir kez saklanır (üst üste çağrılar büyümez) */
  private bump(o: Phaser.GameObjects.Image, k = 1.25) {
    let base = o.getData('base') as number | undefined; if (base == null) { base = o.scale; o.setData('base', base); }
    this.scene.tweens.killTweensOf(o); o.setScale(base); this.scene.tweens.add({ targets: o, scale: base * k, duration: 90, yoyo: true, ease: 'Sine.Out' });
  }

  setNotes(n: number, total: number) {
    const up = n > this.notes; this.notes = n;
    const w0 = this.notesText.width + this.notesTotal.width;
    this.notesText.setText(String(n)); this.notesTotal.setText(total > 0 ? `/${total}` : ''); this.positionTotal();
    // toplanacak nota yoksa (canavar arenası) "0" sayacı gizli: canavarın 3 notası bu sayaca girmez, oyuncu boşuna bakmasın (YN-179)
    const shown = total > 0 || n > 0; for (const o of [this.notesPanel, this.noteIco, this.notesText, this.notesTotal]) o.setVisible(shown);
    if (this.notesText.width + this.notesTotal.width > w0) this.fitTop();
    if (up && !motionReduced()) { this.bump(this.noteIco, 1.25); }
  }
  /** dünyadaki noktadan sayaca uçan nota; varınca sayaç zıplar */
  flyNote(worldX: number, worldY: number, onArrive?: () => void) {
    const s = this.scene;
    // azaltılmış harekette uçuş yok: sayaç yalnız güncellenir (setNotes)
    if (motionReduced()) { onArrive?.(); return; }
    const cam = s.cameras.main; const v = { x: (worldX - cam.worldView.x) / this.k, y: (worldY - cam.worldView.y) / this.k };
    // uçan nota panelin üstünde ama simge ve rakamların altında çizilir (rakam hiç örtülmez); simgeye alttan, rakamların
    // sırasından değil simgenin sütunundan yaklaşır (kontrol noktası simgenin altında)
    const n = I(s, noteIcon(s), v.x, v.y).setScrollFactor(0); this.root.addAt(n, this.root.getIndex(this.notesPanel) + 1);
    const tx = this.noteIco.x, ty = this.noteIco.y; const mx = tx + (v.x - tx) * 0.15, my = Math.max(v.y, ty) + 90;
    const path = { t: 0 };
    s.tweens.add({ targets: path, t: 1, duration: 520, ease: 'Cubic.In', onUpdate: () => { const t = path.t, u = 1 - t; n.setPosition(u * u * v.x + 2 * u * t * mx + t * t * tx, u * u * v.y + 2 * u * t * my + t * t * ty); n.setScale((1 - t * 0.45) / R()); },
      onComplete: () => { n.destroy(); this.bump(this.noteIco, 1.3); const g = s.add.image(tx, ty, softGlowTex(s)).setBlendMode(ADD).setTint(THEME.gold).setDisplaySize(48, 48).setScrollFactor(0); this.root.addAt(g, this.root.getIndex(this.notesPanel) + 1); s.tweens.add({ targets: g, alpha: 0, duration: 300, onComplete: () => g.destroy() }); onArrive?.(); } });
  }
  /** bulunan altın koklea sayısı (dolu yuvalar + "n/3"); total: bölümdeki gizli koklea sayısı (en çok 3; 0 = boss arenası, panel gizli) */
  setCochleas(n: number, total = this.cochTotal) {
    const w0 = this.cochText.width; this.cochTotal = total = Math.max(0, Math.min(3, total));
    this.cochText.setText(`${Math.min(n, total)}/${total}`).setColor(n > 0 ? '#ffc93c' : '#fff6e5').setVisible(total > 0); this.cochPanel.setVisible(total > 0);
    if (this.cochText.width !== w0) this.fitTop();
    for (let i = 0; i < 3; i++) { const on = i < n && i < total; const was = this.cochOn[i]!.visible; this.cochOn[i]!.setVisible(on); this.coch[i]!.setVisible(!on && i < total);
      // yeni dolan yuva: küçük zıplama ve yuvadan taşmayan halka (yandaki nota kutusunu örtmez); azaltılmış harekette yok
      if (on && !was && !motionReduced()) { const c = this.cochOn[i]!; const b = COCH_K / R(); this.scene.tweens.killTweensOf(c); c.setScale(b * 1.3); this.scene.tweens.add({ targets: c, scale: b, duration: 320, ease: 'Back.Out' }); const r = this.scene.add.image(c.x, c.y, ringTex(this.scene)).setBlendMode(ADD).setTint(THEME.gold).setScale(0.08).setScrollFactor(0); this.root.addAt(r, this.root.getIndex(this.cochPanel) + 1); this.scene.tweens.add({ targets: r, scale: COCH_RING, alpha: 0, duration: 420, onComplete: () => r.destroy() }); }
    }
  }
  setLives(n: number) {
    const lost = n < this.lives; this.lives = Math.max(0, n);
    const slots = Math.min(5, Math.max(this.slots, this.lives)); const grew = slots !== this.slots; this.slots = slots;
    this.placeHearts(); if (grew) this.fitTop();
    if (lost) { const h = this.heartsOff[this.lives]; if (h) { const b = this.heartK / R(); this.scene.tweens.killTweensOf(h); h.setScale(b * 1.5); this.scene.tweens.add({ targets: h, scale: b, duration: 300, ease: 'Back.Out' }); } this.scene.tweens.add({ targets: this.livesPanel, x: this.livesPanel.x + 4, duration: 50, yoyo: true, repeat: 2 }); }
  }
  /**
   * Süreli bölümün geri sayımı (kalan oyun saniyesi; null gizler): "3. yıldız 1:04". Son 10 saniyede yalnız renk değil yazı da
   * değişir ("Son 8 sn!"), süre bitince "Süre doldu · yine de kapıya git" (bölüm sürer; yalnız 3. yıldızın süre koşulu tutmadı).
   */
  setTimer(left: number | null) {
    const parts = [this.timerPanel, this.timerIco, this.timerLabel, this.timerText];
    if (left == null) { for (const o of parts) o.setVisible(false); if (this.timerShown !== -999) { this.timerShown = -999; this.placeShield(); } return; }
    const sec = Math.max(0, Math.ceil(left)); if (sec === this.timerShown) return;
    const prev = this.timerShown; this.timerShown = sec;
    for (const o of parts) o.setVisible(true);
    const label = sec <= 0 ? 'yine de kapıya git' : sec <= 10 ? `Son ${sec} sn!` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    this.timerLabel.setText(sec <= 0 ? 'Süre doldu ·' : '3. yıldız').setColor(sec <= 0 ? '#c9c1ff' : '#ffe08a');
    this.timerText.setText(label).setColor(sec <= 0 ? '#fff6e5' : sec <= 10 ? '#ff9ab8' : '#fff6e5').setFontSize(`${Math.round((sec <= 0 ? 15 : 18) * this.ts)}px`);
    this.placeTimer();
    if (sec > 0 && sec <= 10 && sec !== prev) this.bump(this.timerIco, 1.3);
  }
  private placeTimer() {
    const lw = this.timerLabel.width + 6; const w = Math.ceil((lw + this.timerText.width + 44) / 4) * 4; const x = this.timerPanel.x, y = this.timerPanel.y;
    if (this.timerPanel.getData('w') !== w) { this.timerPanel.setData('w', w); this.timerPanel.setTexture(panelTex(this.scene, w, 32, 16)); }
    // panel dokusu gölge payıyla (8, 6) kaydırılmış: görünür merkez dokunun merkezinin 2 px üstünde
    const l = x - w / 2; this.timerIco.setPosition(l + 16, y - 1); this.timerLabel.setPosition(l + 30, y - 1); this.timerText.setPosition(l + 30 + lw, y - 1);
    this.placeRow2(); this.placeShield();
  }
  setEscort(st: EscortHud) {
    if (st === this.escState) return; const prev = this.escState; this.escState = st;
    for (const o of [this.escPanel, this.escIco, this.escText]) o.setVisible(st != null);
    if (st == null) return;
    this.escText.setText(st === 'lost' ? 'Fısıltı yolda kaldı' : st === 'danger' ? 'Fısıltı tehlikede!' : 'Fısıltı yanında').setColor(st === 'lost' ? '#c9c1ff' : st === 'danger' ? '#ff9ab8' : '#fff6e5');
    // tehlikede yüz kızarır, kaybolunca simge gri (renk + yazı birlikte: yalnız renge dayanmaz)
    this.escIco.setTint(st === 'lost' ? 0x8e8aa6 : st === 'danger' ? 0xff8aa6 : 0xffffff).setAlpha(st === 'lost' ? 0.6 : 1);
    this.placeEscort();
    if (st === 'danger' && prev === 'ok' && !motionReduced()) this.bump(this.escIco, 1.3);
  }
  /** ikinci satırın solunda, görünür sol kenar ilerleme çubuğuyla hizalı (seri rozeti sağda kalır) */
  private placeEscort() {
    const w = Math.ceil((this.escText.width + 46) / 4) * 4;
    if (this.escPanel.getData('w') !== w) { this.escPanel.setData('w', w); this.escPanel.setTexture(panelTex(this.scene, w, 32, 16)); }
    const l = 18, y = this.escPanel.y; this.escPanel.x = l + w / 2;
    this.escIco.setPosition(l + 18, y - 1); this.escText.setPosition(l + 34, y - 1);
    this.placeRow2();
  }
  /**
   * Kalan kalkan sayısı (YN-099): baloncuk + "×2". Kalkan bir vuruşu karşılayınca sayı düşer ve baloncuk zıplar; 0'da gizlenir.
   * Sesi kapalı oyuncu da kalkanı olduğunu ve harcandığını görsün (patlama sesine dayanmaz).
   */
  setShield(n: number) {
    n = Math.max(0, n); if (n === this.shields) return; const lost = n < this.shields; this.shields = n;
    for (const o of [this.shieldPanel, this.shieldIco, this.shieldText]) o.setVisible(n > 0);
    this.shieldText.setText(`×${n}`); this.placeShield();
    if (n > 0 && !motionReduced()) this.bump(this.shieldIco, lost ? 0.8 : 1.3);
  }
  /**
   * ikinci satırın sağı, görünür sağ kenar ilerleme çubuğuyla hizalı; süre paneline ya da melodi hapına değecekse onun altına iner.
   * Seri rozeti kalkanın, süre panelinin ya da melodi hapının altına iner (üst üste binmez).
   */
  private placeShield() {
    if (!this.combo) return;
    const t = this.top / this.k + 10; const W = this.iw; const boss = this.bossBottom != null;
    const w = Math.ceil((this.shieldText.width + 44) / 4) * 4;
    if (this.shieldPanel.getData('w') !== w) { this.shieldPanel.setData('w', w); this.shieldPanel.setTexture(panelTex(this.scene, w, 32, 16)); }
    const l = W - 18 - w; const timerOn = this.timerPanel.visible && !boss;
    const y = boss ? (this.bossBottom! + 4) / this.k + 18 : dropBelow({ x: l + w / 2, y: t + 86, w, h: 32 }, this.rowBoxes(this.shieldPanel)) + 2;
    this.shieldPanel.setPosition(l + w / 2, y);
    this.shieldIco.setPosition(l + 17, y - 1); this.shieldText.setPosition(l + 32, y - 1);
    const below = boss ? 0 : Math.max(this.shields > 0 ? y + 52 : 0, timerOn ? t + 140 : 0);
    // ikinci satırdaki bir panele (melodi hapı, süre, kalkan) değecekse onun altına iner: hap hiç örtülmez (YN-183)
    const cx = W - 18 - this.comboW / 2, cy = Math.max(t + 100, below);
    // (rozet her seride ×1,18 zıplar: boşluk o taşmayı da karşılar)
    this.combo.setPosition(cx, boss ? cy : dropBelow({ x: cx, y: cy - 2, w: this.comboW, h: 40 }, this.rowBoxes(), 10) + 2);
  }
  /** canavar bölümünde ikinci satırın yerinde can çubuğu var: kalkan sayacı çubuğun altına iner (bottom: çubuğun alt kenarı) */
  belowBossBar(bottom: number | null) { this.bossBottom = bottom; this.placeShield(); }
  /** bölümün değiştiricileri (boş liste gizler): "Hız · Gecikme" ve her birinin çizili simgesi */
  setModifiers(list: { id: string; name: string }[]) {
    for (const o of this.modIcons) o.destroy(); this.modIcons = [];
    this.modShown = list.length > 0; this.modPanel.setVisible(this.modShown); this.modText.setVisible(this.modShown);
    if (!this.modShown) return;
    this.modText.setText(list.map((m) => m.name).join(' · '));
    for (const m of list) { const ic = I(this.scene, modIcon(this.scene, m.id)).setScale(0.8 / R()); this.modIcons.push(ic); this.root.add(ic); }
    this.placeRow2();
  }
  /** melodi hedefi sayacı: sırayla toplanan / hedef (null gizler); st: sırada / sıra bozuldu / sıradaki nota (`next`. nota) geride */
  setMelody(n: number | null, total = 0, st: MelodyHud = 'ok', next = 0) {
    const key = n == null ? '' : `${n}/${total}/${st}/${next}`; if (key === this.melKey) return;
    const prev = this.melKey.split('/'); const up = !!this.melKey && n != null && n > Number(prev[0]); const stChanged = !!this.melKey && prev[2] !== st; this.melKey = key;
    for (const o of [this.melPanel, this.melIco, this.melText]) o.setVisible(n != null);
    if (n == null) { this.placeRow2(); return; }
    // renk + yazı birlikte (yalnız renge dayanmaz): bozulunca pembe yazı ve gri nota; geride amber ok ve yazı
    const done = n >= total;
    this.melIco.setTexture(st === 'behind' ? backArrowTex(this.scene) : melodyIcon(this.scene)).setTint(st === 'broken' ? 0x8e8aa6 : 0xffffff).setAlpha(st === 'broken' ? 0.7 : 1);
    this.melText.setText(st === 'broken' ? `Sıra bozuldu · ${n}/${total}` : st === 'behind' ? `${next}. nota geride · ${n}/${total}` : `Nota ${n}/${total}`)
      .setColor(st === 'broken' ? '#ffb3c8' : st === 'behind' ? '#ffe08a' : done ? '#8ef0b0' : '#fff6e5');
    this.placeRow2();
    if ((up || (stChanged && st !== 'ok')) && !motionReduced()) this.bump(this.melIco, 1.35);
  }
  /** ikinci satırda görünen panellerin görünür kutuları (doku 8, 6 gölge payıyla: görünür merkez dokunun 2 px üstünde) */
  private rowBoxes(...skip: Phaser.GameObjects.Image[]): Box[] {
    const out: Box[] = [];
    for (const [p, h] of [[this.timerPanel, 32], [this.escPanel, 32], [this.modPanel, 30], [this.melPanel, 32], [this.shieldPanel, 32]] as const) {
      if (p.visible && !skip.includes(p)) out.push({ x: p.x, y: p.y - 2, w: Number(p.getData('w') ?? 100), h });
    }
    return out;
  }
  /**
   * İkinci satır: solda fısıltı ya da değiştirici rozeti, ortada süre ya da melodi sayacı. Sığmayan (sol rozet ortadakine
   * değiyorsa ya da ikisi de ortada istiyorsa) bir alt satıra (+36) iner: hiçbir şey üst üste binmez.
   */
  private placeRow2() {
    if (!this.modPanel || !this.melPanel) return;
    this.placeRow2Panels(); this.placeShield();
  }
  private placeRow2Panels() {
    const y2 = this.timerPanel.y, y3 = y2 + 36; const W = this.iw;
    const timerOn = this.timerPanel.visible;
    // melodi sayacı: ortada; süre de görünüyorsa bir alt satırda
    if (this.melPanel.visible) {
      const w = Math.ceil((this.melText.width + 46) / 4) * 4;
      if (this.melPanel.getData('w') !== w) { this.melPanel.setData('w', w); this.melPanel.setTexture(panelTex(this.scene, w, 32, 16)); }
      const y = timerOn ? y3 : y2; const x = W / 2; this.melPanel.setPosition(x, y);
      const l = x - w / 2; this.melIco.setPosition(l + 17, y - 1); this.melText.setPosition(l + 32, y - 1);
    }
    if (!this.modShown) return;
    const n = this.modIcons.length; const w = Math.ceil((this.modText.width + 18 * n + 24) / 4) * 4;
    if (this.modPanel.getData('w') !== w) { this.modPanel.setData('w', w); this.modPanel.setTexture(panelTex(this.scene, w, 30, 15)); }
    // fısıltı, süre ya da melodi hapına değecekse onun altına iner (süre + melodi birlikteyse ikisinin de altına)
    const l = 18; const y = dropBelow({ x: l + w / 2, y: y2 - 2, w, h: 30 }, this.rowBoxes(this.modPanel, this.shieldPanel)) + 2;
    this.modPanel.setPosition(l + w / 2, y);
    this.modIcons.forEach((ic, i) => ic.setPosition(l + 14 + i * 18, y - 1));
    this.modText.setPosition(l + 8 + 18 * n, y - 1);
  }
  /** bölüm başı duyurusu (değiştiriciler): göstergenin altında koyu cam panel, ms sonra söner. Oynanışı durdurmaz. */
  announce(text: string, ms = 2800) {
    const s = this.scene; this.announceC?.destroy(); if (!text) { this.announceC = undefined; return; }
    const label = s.add.text(0, 0, text, { fontFamily: FONT, fontSize: `${Math.round(15 * this.ts)}px`, fontStyle: '800', color: '#fff6e5', align: 'center', lineSpacing: 3, wordWrap: { width: this.iw - 72 }, resolution: R() }).setOrigin(0.5);
    const pw = Math.round(Math.min(this.iw - 32, label.width + 36)), ph = Math.round(label.height + 18);
    const bg = I(s, panelTex(s, pw, ph, Math.min(16, Math.round(ph / 2)))).setPosition(0, 2);
    // ikinci (ve varsa üçüncü) satırın altında
    const below = this.row2Bottom;
    const c = s.add.container(this.iw / 2, below + 10 + ph / 2, [bg, label]).setScrollFactor(0, 0, true).setAlpha(0).setName('duyuru').setData('h', ph);
    this.root.add(c); this.announceC = c;
    s.tweens.add({ targets: c, alpha: 1, duration: 200 });
    s.tweens.add({ targets: c, alpha: 0, delay: ms, duration: 300, onComplete: () => { c.destroy(); if (this.announceC === c) this.announceC = undefined; } });
  }
  /** ikinci (ve varsa üçüncü) satırın ve seri rozetinin altı: duyuru ve patoloji adı buradan aşağı dizilir */
  private get row2Bottom() { return Math.max(this.timerPanel.y + 22, this.modPanel.y + 21, this.melPanel.visible ? this.melPanel.y + 22 : 0); }
  /**
   * Bölge patolojisinin adı (YN-119): üst bantta koyu cam panel, solunda çizili uyarı üçgeni; ms sonra söner. Dünyada (engelin
   * üstünde) Odi'yi ve önündeki yolu örtüyordu. Aynı anda ikinci ad gelirse ilki sönünce çıkar (alt alta yığılmaz).
   * Duyuru açıksa onun altında. Yalnız saydamlıkla açılıp kapanır (hareket yok).
   */
  pathology(text: string, ms = 2600) {
    if (this.pathoC) { if (!this.pathoQ.includes(text)) this.pathoQ.push(text); return; }
    const s = this.scene; const ts = this.ts;
    const ico = I(s, warnTex(s)).setScale(ts / R());
    const label = s.add.text(0, 0, text, { fontFamily: FONT, fontSize: `${Math.round(16 * ts)}px`, fontStyle: '900', color: '#ffe1ea', wordWrap: { width: this.iw - 96 }, resolution: R() }).setOrigin(0, 0.5);
    const iw = 30 * ts; const pw = Math.round(Math.min(this.iw - 24, label.width + iw + 34)), ph = Math.round(Math.max(label.height, 26 * ts) + 16);
    const bg = I(s, panelTex(s, pw, ph, Math.min(16, Math.round(ph / 2)))).setPosition(0, 2);
    const l = -pw / 2 + 12; ico.setPosition(l + iw / 2, 0); label.setPosition(l + iw + 6, 0);
    const a = this.announceC; const top = Math.max(this.row2Bottom + 18, a ? a.y + Number(a.getData('h') ?? 0) / 2 + 8 : 0);
    const c = s.add.container(this.iw / 2, top + ph / 2, [bg, ico, label]).setScrollFactor(0, 0, true).setAlpha(0).setName('patoloji').setData('h', ph);
    this.root.add(c); this.pathoC = c;
    s.tweens.add({ targets: c, alpha: 1, duration: 200 });
    s.tweens.add({ targets: c, alpha: 0, delay: ms, duration: 300, onComplete: () => {
      c.destroy(); if (this.pathoC === c) this.pathoC = undefined;
      const next = this.pathoQ.shift(); if (next) this.pathology(next, ms);
    } });
  }
  setProgress(pct: number) {
    this.pct = Math.max(0, Math.min(1, pct)); const x = this.pct * this.barW;
    this.setW(this.fill, Math.max(12, x + 4), 12); this.fill.setVisible(x > 2);
    this.head.setPosition(x, 0); this.headDot.setPosition(x, 0);
    for (const k of this.ticks) { const lit = this.pct >= k.pct; if (lit !== k.on.visible) { k.on.setVisible(lit); k.off.setVisible(!lit); if (lit) this.bump(k.on, 1.6); } }
  }
  setCheckpoints(pcts: number[]) {
    for (const k of this.ticks) { k.off.destroy(); k.on.destroy(); } this.ticks = [];
    for (const p of pcts) { const off = I(this.scene, tickTex(this.scene, false), p * this.barW, 0).setScrollFactor(0); const on = I(this.scene, tickTex(this.scene, true), p * this.barW, 0).setScrollFactor(0).setVisible(false); this.bar.addAt(off, 2); this.bar.addAt(on, 2); this.ticks.push({ pct: p, off, on }); }
    this.setProgress(this.pct);
  }
  setGhosts(list: GhostMark[]) {
    const keep = new Set(list.map((g) => g.id));
    for (const [id, c] of this.ghosts) if (!keep.has(id)) { c.destroy(); this.ghosts.delete(id); }
    for (const g of list) {
      let c = this.ghosts.get(g.id);
      if (!c) {
        c = this.scene.add.container(0, -12).setScrollFactor(0);
        const m = I(this.scene, markerTex(this.scene, g.color)); c.add(m);
        if (g.label) { const t = this.scene.add.text(0, -12, g.label, { fontFamily: FONT, fontSize: '9px', fontStyle: '900', color: '#fff6e5', stroke: '#140c35', strokeThickness: 3, resolution: R() }).setOrigin(0.5); c.add(t); }
        this.bar.addAt(c, 3); this.ghosts.set(g.id, c);
      }
      const p = Math.max(0, Math.min(1, g.pct)); c.setData('pct', p); c.x = p * this.barW;
    }
    this.bar.bringToTop(this.head); this.bar.bringToTop(this.headDot);
  }
  setCombo(n: number, mult: number) {
    if (n < 2 || mult < 2) { if (this.comboShown) { this.comboShown = false; this.scene.tweens.add({ targets: this.combo, alpha: 0, scale: 0.8, duration: 200 }); } return; }
    this.comboMult.setText(`×${mult}`); this.comboCount.setText(`Seri ${n}`);
    const gap = 8; const inner = this.comboMult.width + gap + this.comboCount.width; const w = Math.ceil((inner + 28) / 4) * 4;
    this.comboMult.x = -inner / 2; this.comboCount.x = -inner / 2 + this.comboMult.width + gap;
    if (w !== this.comboW || this.comboBg.getData('w') !== w) { this.comboW = w; this.comboBg.setData('w', w).setTexture(panelTex(this.scene, w, 40, 16)); this.placeShield(); }
    const hot = mult >= 4 ? '#ff5c8a' : mult >= 3 ? '#ff9f1c' : '#ffc93c'; this.comboMult.setColor(hot);
    this.scene.tweens.killTweensOf(this.combo);
    if (!this.comboShown) { this.comboShown = true; this.combo.setAlpha(1).setScale(0.4); this.scene.tweens.add({ targets: this.combo, scale: 1, duration: 260, ease: 'Back.Out' }); }
    else { this.combo.setAlpha(1).setScale(1.18); this.scene.tweens.add({ targets: this.combo, scale: 1, duration: 180, ease: 'Back.Out' }); }
  }
  /** övgü sözü: "Güzel!", "Mükemmel!" — ekranın üst-ortasında altın, büyüyüp süzülür */
  praise(text: string) {
    const s = this.scene; const p = this.pathoC;
    const prev = this.root.getByName('praise') as Phaser.GameObjects.Container | null; prev?.destroy();
    const t = s.add.text(0, 0, text, { fontFamily: FONT, fontSize: '38px', fontStyle: '900', color: '#ffc93c', stroke: '#2a0f4a', strokeThickness: 8, resolution: R(), padding: { x: 6, y: 6 } }).setOrigin(0.5);
    // patoloji adı açıksa övgü onun altında; açılışı ve yükselişi boyunca ikinci satırın panellerine (melodi hapı) ve seri rozetine
    // değmez (YN-183: "Güzel!" hapın üstüne düşüyordu)
    const blocks = this.rowBoxes(); if (this.comboShown) blocks.push({ x: this.combo.x, y: this.combo.y - 2, w: this.comboW * 1.18, h: 48 });
    const y0 = praiseY(this.iw / 2, Math.max(this.top / this.k + 168, p ? p.y + Number(p.getData('h') ?? 0) / 2 + 34 : 0), t.width, t.height, 26, blocks);
    const grd = t.context.createLinearGradient(0, 0, 0, t.height); grd.addColorStop(0.2, '#fff6c4'); grd.addColorStop(0.55, '#ffc93c'); grd.addColorStop(0.9, '#ff8a1c'); t.setFill(grd);
    t.setShadow(0, 4, 'rgba(20,0,40,0.6)', 6, true, true);
    const g = s.add.image(0, 0, softGlowTex(s)).setBlendMode(ADD).setTint(THEME.gold).setDisplaySize(t.width * 1.4, 90).setAlpha(0.5);
    const sp = [-1, 1].map((d) => s.add.image(d * (t.width / 2 + 8), -10, sparkTex(s)).setBlendMode(ADD).setScale(0.6).setTint(0xfff1a8));
    const c = s.add.container(this.iw / 2, y0, [g, t, ...sp]).setName('praise').setScrollFactor(0, 0, true).setScale(0.3).setAlpha(0);
    this.root.add(c);
    s.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
    s.tweens.add({ targets: sp, angle: 180, scale: 0, duration: 700 });
    s.tweens.add({ targets: c, y: y0 - 26, alpha: 0, delay: 700, duration: 380, ease: 'Cubic.In', onComplete: () => c.destroy() });
  }
  /** ekrandaki övgü sözünü hemen kaldır (oyuncu hasar aldı: eski "Güzel!" ekranda kalmasın) */
  clearPraise() {
    const prev = this.root.getByName('praise') as Phaser.GameObjects.Container | null; if (!prev) return;
    this.scene.tweens.killTweensOf(prev); this.scene.tweens.killTweensOf(prev.list); prev.destroy();
  }
  onPause(cb: () => void) { this.pauseCb = cb; }
  /** duraklat düğmesi isabeti (tasarım ekran koordinatı; parmak için cömert 34 px yarıçap) */
  pauseCenter(): { x: number; y: number } { return { x: this.pause.x * this.k, y: this.pause.y * this.k }; }
  pauseHit(x: number, y: number): boolean { const px = this.pause.x * this.k, py = this.pause.y * this.k; return Math.hypot(x - px, y - py) <= 34 * this.k; }
  /** duraklat düğmesine basıldı: küçük basılma animasyonu + geri çağrı */
  pressPause() { this.scene.tweens.killTweensOf(this.pause); this.pause.setScale(1 / R()); this.scene.tweens.add({ targets: this.pause, scale: 0.88 / R(), duration: 70, yoyo: true }); this.pauseCb?.(); }

  /**
   * alt-orta bilgi şeridi: koyu cam üstünde krem yazı (bölüm girişi, faz uyarıları). Boş metin gizler. now: geçişsiz — eski yazı
   * aynı karede kalkar, yenisi o karede tam görünür (canavar fazı: çubuk yeni fazı gösterirken eski fazın yazısı sönmeye devam etmesin)
   */
  toast(text: string, ms = 2500, now = false) {
    const s = this.scene; this.toastTimer?.remove(false);
    const prev = this.toastC; this.toastC = undefined;
    if (prev && now) { s.tweens.killTweensOf(prev); prev.destroy(); }
    else if (prev) s.tweens.add({ targets: prev, alpha: 0, duration: 140, onComplete: () => prev.destroy() });
    if (!text) return;
    const label = s.add.text(0, 0, text, { fontFamily: FONT, fontSize: `${Math.round(15 * this.ts)}px`, fontStyle: '800', color: '#fff6e5', align: 'center', lineSpacing: 2, wordWrap: { width: this.iw - 64 }, resolution: R() }).setOrigin(0.5);
    const pw = Math.round(Math.min(this.iw - 32, label.width + 40)), ph = Math.round(label.height + 20);
    const bg = I(s, panelTex(s, pw, ph, Math.min(18, Math.round(ph / 2)))).setPosition(0, 2);
    const c = s.add.container(this.iw / 2, this.ih - 74, [bg, label]).setScrollFactor(0, 0, true).setAlpha(0);
    this.root.add(c); this.toastC = c;
    if (now) c.setAlpha(1).setY(c.y - 6); else s.tweens.add({ targets: c, alpha: 1, y: c.y - 6, duration: 220, ease: 'Cubic.Out' });
    this.toastTimer = s.time.delayedCall(ms, () => { if (this.toastC !== c) return; this.toastC = undefined; s.tweens.add({ targets: c, alpha: 0, duration: 300, onComplete: () => c.destroy() }); });
  }

  /** öğretici el işareti + açıklama (ekranın alt-ortası) */
  showHint(kind: HintKind, text: string) {
    this.hideHint(); const s = this.scene; const cx = this.iw / 2, cy = this.ih * 0.62;
    const c = s.add.container(0, 0).setScrollFactor(0); this.root.add(c); this.hint = c;
    const tw = (cfg: Phaser.Types.Tweens.TweenBuilderConfig) => { const t = s.tweens.add(cfg); this.hintTweens.push(t); return t; };
    // açıklama
    const label = s.add.text(0, 0, text, { fontFamily: FONT, fontSize: `${Math.round(17 * this.ts)}px`, fontStyle: '900', color: '#fff6e5', align: 'center', wordWrap: { width: this.iw - 80 }, resolution: R() }).setOrigin(0.5);
    const pw = Math.min(this.iw - 40, label.width + 40), ph = label.height + 20;
    const bg = I(s, panelTex(s, Math.round(pw), Math.round(ph), Math.min(20, Math.round(ph / 2)))); const lab = s.add.container(cx, cy - 120, [bg, label]); c.add(lab);
    bg.setPosition(0, 2);
    const hand = I(s, handTex(s)).setOrigin(0.47, 0.03); const hx = cx, hy = cy;
    const ring = s.add.image(hx, hy, ringTex(s)).setBlendMode(ADD).setTint(THEME.gold).setScale(0.1).setAlpha(0);
    const glowI = s.add.image(hx, hy, softGlowTex(s)).setBlendMode(ADD).setTint(THEME.gold).setDisplaySize(90, 90).setAlpha(0.5);
    c.add([glowI, ring]);
    if (kind === 'swipeDown' || kind === 'swipeRight' || kind === 'swipeLeft') {
      const d = kind === 'swipeDown' ? { x: 0, y: 1 } : kind === 'swipeLeft' ? { x: -1, y: 0 } : { x: 1, y: 0 };
      for (let i = 0; i < 3; i++) { const ch = I(s, chevTex(s), hx + d.x * (30 + i * 22), hy + d.y * (30 + i * 22)).setAngle(kind === 'swipeDown' ? 90 : kind === 'swipeLeft' ? 180 : 0).setAlpha(0); c.add(ch); tw({ targets: ch, alpha: { from: 0, to: 1 }, duration: 300, delay: i * 120, yoyo: true, repeat: -1, repeatDelay: 600 }); }
      hand.setPosition(hx - d.x * 40, hy - d.y * 40); c.add(hand);
      tw({ targets: hand, x: hx + d.x * 70, y: hy + d.y * 70, duration: 750, ease: 'Cubic.InOut', repeat: -1, repeatDelay: 450, onRepeat: () => hand.setPosition(hx - d.x * 40, hy - d.y * 40) });
      tw({ targets: glowI, x: { from: hx - d.x * 40, to: hx + d.x * 70 }, y: { from: hy - d.y * 40, to: hy + d.y * 70 }, duration: 750, ease: 'Cubic.InOut', repeat: -1, repeatDelay: 450 });
    } else {
      hand.setPosition(hx, hy + 6); c.add(hand);
      if (kind === 'tap') {
        tw({ targets: hand, y: hy - 2, scale: hand.scale * 0.92, duration: 160, yoyo: true, repeat: -1, repeatDelay: 700, ease: 'Sine.InOut' });
        tw({ targets: ring, scale: { from: 0.08, to: 0.6 }, alpha: { from: 1, to: 0 }, duration: 600, repeat: -1, repeatDelay: 260, delay: 140 });
      } else {
        const arc = I(s, arcTex(s), hx, hy).setAlpha(0.95); c.addAt(arc, 1);
        const mask = { p: 0 }; const gfx = s.add.graphics().setScrollFactor(0); c.addAt(gfx, 1); arc.setVisible(false);
        tw({ targets: hand, y: hy - 2, scale: hand.scale * 0.92, duration: 180, ease: 'Sine.Out', yoyo: true, hold: 1100, repeat: -1, repeatDelay: 300 });
        tw({ targets: mask, p: 1, duration: 1200, delay: 180, repeat: -1, repeatDelay: 380, onUpdate: () => { gfx.clear(); gfx.lineStyle(5, THEME.gold, 1); gfx.beginPath(); gfx.arc(hx, hy, 26, -Math.PI / 2, -Math.PI / 2 + mask.p * Math.PI * 2); gfx.strokePath(); gfx.lineStyle(10, THEME.gold, 0.25); gfx.beginPath(); gfx.arc(hx, hy, 26, -Math.PI / 2, -Math.PI / 2 + mask.p * Math.PI * 2); gfx.strokePath(); } });
      }
    }
    tw({ targets: glowI, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
    c.setAlpha(0); tw({ targets: c, alpha: 1, duration: 220 });
    lab.setScale(0.8); tw({ targets: lab, scale: 1, duration: 260, ease: 'Back.Out' });
    c.setScrollFactor(0, 0, true);
  }
  hideHint() {
    for (const t of this.hintTweens) t.remove(); this.hintTweens = []; this.hintTimer?.remove(false);
    const c = this.hint; this.hint = undefined; if (!c) return;
    this.scene.tweens.add({ targets: c, alpha: 0, duration: 180, onComplete: () => c.destroy() });
  }
  resize(w: number, h: number, top = this.top) {
    const ow = this.iw, oh = this.ih;
    this.w = w; this.h = h; this.top = top; const O = screenOrigin(this.scene.cameras.main); this.root.setPosition(O.x, O.y); this.layout();
    // açık bilgi şeridi alt-ortada, el işareti ekranın alt-ortasında kalsın (oluşturulduğu boyuta göre konumlanmışlardı)
    if (this.toastC) this.toastC.setPosition(this.toastC.x + (this.iw - ow) / 2, this.toastC.y + (this.ih - oh));
    if (this.pathoC) this.pathoC.x = this.iw / 2;
    if (this.hint) this.hint.setPosition(this.hint.x + (this.iw - ow) / 2, this.hint.y + (this.ih - oh) * 0.62);
  }
  destroy() { this.hideHint(); this.root.destroy(); }
}
